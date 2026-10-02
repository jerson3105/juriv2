// Rareza de los premios existentes según su precio y el oro semanal de su clase (la misma regla que
// server/src/utils/shopEconomy.ts). Correr una vez tras desplegar la tienda v2, desde server/ (lee ./.env):
//   node migrations/shop_rarity_backfill.mjs                    → solo muestra qué cambiaría
//   node migrations/shop_rarity_backfill.mjs --apply            → lo guarda
//   node migrations/shop_rarity_backfill.mjs --classroom <id>   → solo esa clase (con o sin --apply)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(resolve('package.json'));
const mysql = require('mysql2/promise');

const env = Object.fromEntries(readFileSync(resolve('.env'), 'utf8').split(/\r?\n/)
  .filter((line) => /^[A-Z_]+=/.test(line))
  .map((line) => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '')]; }));

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const onlyClassroom = args.includes('--classroom') ? args[args.indexOf('--classroom') + 1] : null;

const DEFAULT_WEEKLY_GOLD = 10;
const WINDOW_DAYS = 28;

const median = (values) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const rarityForPrice = (price, weekly) => (price <= weekly * 2 ? 'COMMON' : price <= weekly * 5 ? 'RARE' : 'LEGENDARY');

const conn = await mysql.createConnection({
  host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, timezone: 'Z',
});

try {
  const [items] = await conn.query(
    `SELECT id, classroom_id, name, price, rarity FROM shop_items${onlyClassroom ? ' WHERE classroom_id = ?' : ''}`,
    onlyClassroom ? [onlyClassroom] : [],
  );
  const classroomIds = [...new Set(items.map((item) => item.classroom_id))];
  if (classroomIds.length === 0) {
    console.log('Sin premios: nada que hacer.');
    process.exit(0);
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const [rows] = await conn.query(
    `SELECT sp.classroom_id, sp.id, COUNT(pl.id) AS logs,
            COALESCE(SUM(CASE WHEN pl.point_type = 'GP' AND pl.action = 'ADD' THEN pl.amount ELSE 0 END), 0) AS gold
       FROM student_profiles sp
       LEFT JOIN point_logs pl ON pl.student_id = sp.id AND pl.is_reverted = 0 AND pl.created_at >= ?
      WHERE sp.is_active = 1 AND sp.is_demo = 0 AND sp.classroom_id IN (?)
      GROUP BY sp.classroom_id, sp.id`,
    [since, classroomIds],
  );

  const weeklyByClass = new Map();
  for (const classroomId of classroomIds) {
    const active = rows.filter((row) => row.classroom_id === classroomId && Number(row.logs) > 0);
    const weekly = Math.round(median(active.map((row) => Number(row.gold) / (WINDOW_DAYS / 7))) * 10) / 10;
    weeklyByClass.set(classroomId, weekly > 0 ? weekly : DEFAULT_WEEKLY_GOLD);
  }

  const changes = items
    .map((item) => ({ ...item, next: rarityForPrice(item.price, weeklyByClass.get(item.classroom_id)) }))
    .filter((item) => item.next !== item.rarity);
  const summary = {};
  for (const change of changes) summary[`${change.rarity} → ${change.next}`] = (summary[`${change.rarity} → ${change.next}`] ?? 0) + 1;

  console.log(`Premios: ${items.length} en ${classroomIds.length} clases · cambian: ${changes.length}`);
  console.log(summary);
  if (onlyClassroom) for (const change of changes) console.log(`  ${change.name} (${change.price}): ${change.rarity} → ${change.next}`);

  if (apply && changes.length > 0) {
    await conn.beginTransaction();
    for (const change of changes) {
      await conn.query('UPDATE shop_items SET rarity = ? WHERE id = ?', [change.next, change.id]);
    }
    await conn.commit();
    console.log('Guardado.');
  } else if (!apply) {
    console.log('Solo vista previa: agrega --apply para guardar.');
  }
} finally {
  await conn.end();
}
