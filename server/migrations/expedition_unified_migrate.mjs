// Pasa las expediciones clásicas al modelo unificado (correr DESPUÉS de expedition_unified.sql), desde server/
// (lee ./.env):
//   node migrations/expedition_unified_migrate.mjs           → solo muestra qué haría
//   node migrations/expedition_unified_migrate.mjs --apply   → lo guarda
// Cada pin pasa a ser una parada con el mismo id, en el orden de sus conexiones (con entrega → Evidencia,
// sin entrega → Relato), conservando textos, recursos, fecha, recompensa y posición en el mapa.
// El avance trabado (LOCKED/UNLOCKED sin decisión) no se copia: con el modelo nuevo la primera parada
// siempre está abierta. Sí se copian las paradas aprobadas (sin volver a pagar) y las entregas.
// Es idempotente: salta las expediciones que ya tienen paradas.
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const require = createRequire(resolve('package.json'));
const mysql = require('mysql2/promise');

const env = Object.fromEntries(readFileSync(resolve('.env'), 'utf8').split(/\r?\n/)
  .filter((line) => /^[A-Z_]+=/.test(line))
  .map((line) => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '')]; }));

const apply = process.argv.slice(2).includes('--apply');

// En MariaDB las columnas JSON llegan como texto; en MySQL 8, ya parseadas.
const asArray = (value) => {
  let parsed = value;
  for (let i = 0; i < 3 && typeof parsed === 'string'; i++) {
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }
  return Array.isArray(parsed) ? parsed : [];
};
// Lo que se recorta o se descarta se cuenta: la simulación lo muestra antes de aplicar.
const lost = { truncated: 0, resources: 0, files: 0, submissions: 0, longExpeditions: 0 };
const clip = (text, max) => {
  const value = typeof text === 'string' ? text.trim() : '';
  if (value.length > max) lost.truncated++;
  return value ? value.slice(0, max) : null;
};
const OWN_UPLOAD = /^\/api\/uploads\/expeditions\/[\w.-]+$/;
const uploadsDir = env.UPLOAD_DIR || resolve('uploads');
// Entre 2025-12 y 2026-01 la subida devolvía /uploads/expeditions/… (sin /api) y algunos clientes guardaron la
// URL absoluta: si el archivo está en esta carpeta, pasa a la ruta actual.
const ownUpload = (url) => {
  if (typeof url !== 'string') return null;
  const value = url.trim();
  if (OWN_UPLOAD.test(value)) return value;
  const match = value.match(/^(?:https?:\/\/[^/]+)?\/(?:api\/)?uploads\/expeditions\/([\w.-]+)$/i);
  return match && existsSync(join(uploadsDir, 'expeditions', match[1])) ? `/api/uploads/expeditions/${match[1]}` : null;
};
const toResource = (url) => {
  const own = ownUpload(url);
  if (own) return { kind: 'FILE', url: own, name: own.split('/').pop() };
  const value = typeof url === 'string' ? url.trim() : '';
  if (/^https:\/\/[^\s<>"']+$/i.test(value)) return { kind: 'LINK', url: value, name: null };
  if (value) lost.resources++;
  return null;
};

// Orden del recorrido: desde los pines sin entrada, siguiendo las conexiones («si pasa» o lineal antes que
// «si no pasa»); los que quedan sueltos van al final por su orden y fecha.
const orderPins = (pins, connections) => {
  const byId = new Map(pins.map((pin) => [pin.id, pin]));
  const incoming = new Set(connections.map((c) => c.to_pin_id));
  const sortKey = (a, b) => (a.order_index - b.order_index) || (new Date(a.created_at) - new Date(b.created_at));
  const roots = pins.filter((pin) => !incoming.has(pin.id)).sort(sortKey);
  const ordered = [];
  const seen = new Set();
  const visit = (pin) => {
    if (!pin || seen.has(pin.id)) return;
    seen.add(pin.id);
    ordered.push(pin);
    const next = connections
      .filter((c) => c.from_pin_id === pin.id)
      .sort((a, b) => (a.on_success === 0 ? 1 : 0) - (b.on_success === 0 ? 1 : 0));
    for (const connection of next) visit(byId.get(connection.to_pin_id));
  };
  roots.forEach(visit);
  pins.filter((pin) => !seen.has(pin.id)).sort(sortKey).forEach(visit);
  return ordered;
};

const db = await mysql.createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME });
const [[{ ready }]] = await db.query("SELECT COUNT(*) ready FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'expedition_stops'");
if (!ready) {
  console.error('Falta correr migrations/expedition_unified.sql');
  process.exit(1);
}

const [expeditions] = await db.query('SELECT id, expedition_status AS status FROM expeditions ORDER BY created_at');
const summary = { expeditions: 0, skipped: 0, stops: 0, done: 0, evidence: 0 };
const now = new Date();

for (const expedition of expeditions) {
  const [[{ existing }]] = await db.query('SELECT COUNT(*) existing FROM expedition_stops WHERE expedition_id = ?', [expedition.id]);
  if (existing > 0) {
    summary.skipped++;
    continue;
  }
  const [pins] = await db.query('SELECT * FROM expedition_pins WHERE expedition_id = ?', [expedition.id]);
  const [connections] = await db.query('SELECT from_pin_id, to_pin_id, on_success FROM expedition_connections WHERE expedition_id = ?', [expedition.id]);
  const ordered = orderPins(pins, connections);
  if (ordered.length > 10) {
    lost.longExpeditions++;
    console.warn(`  ⚠ ${expedition.id} tiene ${ordered.length} paradas (el editor admite 10): el docente deberá quitar algunas para reordenarlas`);
  }
  const stops = ordered.map((pin, index) => {
    const mission = [clip(pin.task_name, 255), clip(pin.task_content, 4000)].filter(Boolean).join('\n');
    const resources = [...asArray(pin.story_files), ...asArray(pin.task_files)]
      .map(toResource)
      .filter(Boolean)
      .filter((resource, i, all) => all.findIndex((other) => other.url === resource.url) === i)
      .slice(0, 5);
    return {
      id: pin.id,
      expedition_id: expedition.id,
      sort_order: index,
      kind: pin.requires_submission ? 'EVIDENCE' : 'STORY',
      title: clip(pin.name, 120) ?? `Parada ${index + 1}`,
      story: clip(pin.story_content, 4000),
      mission: mission || null,
      resources: resources.length ? JSON.stringify(resources) : null,
      review_mode: 'ADVANCE',
      due_at: pin.due_date ?? null,
      reward_xp: Math.max(0, Math.min(500, Number(pin.reward_xp) || 0)),
      reward_gold: Math.max(0, Math.min(500, Number(pin.reward_gp) || 0)),
      map_x: Math.max(0, Math.min(100, Number(pin.position_x) || 0)),
      map_y: Math.max(0, Math.min(100, Number(pin.position_y) || 0)),
      requiresSubmission: !!pin.requires_submission,
    };
  });

  // Paradas ya aprobadas por el docente: quedan logradas y marcadas como pagadas (ya se pagaron).
  const [passed] = await db.query(
    "SELECT pin_id, student_profile_id, teacher_decision, completed_at FROM expedition_pin_progress WHERE expedition_id = ? AND expedition_progress_status IN ('PASSED','COMPLETED')",
    [expedition.id],
  );
  const [submissions] = await db.query('SELECT * FROM expedition_submissions WHERE expedition_id = ? ORDER BY submitted_at', [expedition.id]);
  const stopById = new Map(stops.map((stop) => [stop.id, stop]));
  const progress = new Map();
  for (const row of passed) {
    const stop = stopById.get(row.pin_id);
    if (!stop) continue;
    const at = row.completed_at ?? now;
    progress.set(`${row.pin_id}:${row.student_profile_id}`, {
      stop_id: row.pin_id, student_profile_id: row.student_profile_id, status: 'DONE',
      review: stop.requiresSubmission ? 'APPROVED' : null, done_at: at, rewarded_at: at, reviewed_at: stop.requiresSubmission ? at : null,
    });
  }
  const evidence = [];
  for (const row of submissions) {
    const stop = stopById.get(row.pin_id);
    if (!stop) continue;
    const raw = asArray(row.files);
    const files = [...new Set(raw.map(ownUpload).filter(Boolean))].slice(0, 5);
    lost.files += raw.length - files.length;
    const note = clip(row.comment, 2000);
    // Una entrega con solo texto también vale (el modelo nuevo acepta archivos o texto).
    if (files.length === 0 && !note) {
      lost.submissions++;
      continue;
    }
    evidence.push({ stop_id: row.pin_id, student_profile_id: row.student_profile_id, files: JSON.stringify(files), note, submitted_at: row.submitted_at });
    const key = `${row.pin_id}:${row.student_profile_id}`;
    if (!progress.has(key)) {
      // Entregada sin decisión: con «avanza ya» el alumno sigue y la evidencia queda por revisar.
      progress.set(key, { stop_id: row.pin_id, student_profile_id: row.student_profile_id, status: 'DONE', review: 'PENDING', done_at: row.submitted_at, rewarded_at: null, reviewed_at: null });
    }
  }

  summary.expeditions++;
  summary.stops += stops.length;
  summary.done += progress.size;
  summary.evidence += evidence.length;
  console.log(`${expedition.id} (${expedition.status}): ${stops.length} paradas [${stops.map((s) => s.kind[0]).join('')}], ${progress.size} avances, ${evidence.length} evidencias`);
  if (!apply) continue;

  await db.beginTransaction();
  try {
    for (const stop of stops) {
      await db.query(
        `INSERT INTO expedition_stops (id, expedition_id, sort_order, kind, title, story, mission, resources, review_mode, due_at, reward_xp, reward_gold, map_x, map_y, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [stop.id, stop.expedition_id, stop.sort_order, stop.kind, stop.title, stop.story, stop.mission, stop.resources, stop.review_mode, stop.due_at, stop.reward_xp, stop.reward_gold, stop.map_x, stop.map_y, now, now],
      );
    }
    for (const row of progress.values()) {
      await db.query(
        `INSERT INTO expedition_stop_progress (id, expedition_id, stop_id, student_profile_id, status, review, done_at, rewarded_at, reviewed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), expedition.id, row.stop_id, row.student_profile_id, row.status, row.review, row.done_at, row.rewarded_at, row.reviewed_at, now, now],
      );
    }
    for (const row of evidence) {
      await db.query(
        'INSERT INTO expedition_evidence (id, expedition_id, stop_id, student_profile_id, files, note, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [randomUUID(), expedition.id, row.stop_id, row.student_profile_id, row.files, row.note, row.submitted_at],
      );
    }
    await db.commit();
  } catch (error) {
    await db.rollback();
    throw error;
  }
}

console.log(apply ? 'Aplicado:' : 'Simulación (usa --apply para guardar):', summary);
console.log('Recortado o descartado (textos más largos que el editor, recursos y archivos no válidos, entregas vacías, expediciones de más de 10 paradas):', lost);
await db.end();
