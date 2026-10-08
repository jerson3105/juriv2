// Rebaraja UNA VEZ las alternativas de las preguntas que generó la IA antes de 1605455 (la correcta quedaba casi
// siempre en la B; en múltiple, en A-B o A-B-C). La misma regla que mixOptions (server/src/services/questionAi.service.ts).
// Correr desde server/ (lee ./.env), después de desplegar 1605455 y a una hora sin clases:
//   node migrations/ai_options_reshuffle.mjs                    → solo muestra qué cambiaría (no guarda nada)
//   node migrations/ai_options_reshuffle.mjs --apply            → lo guarda
//   node migrations/ai_options_reshuffle.mjs --bank <id>        → solo ese banco (con o sin --apply)
//   --quiet-minutes <n>  minutos sin actividad que exige --apply (por defecto 20; 0 lo desactiva, solo para pruebas)
//
// Qué NO toca: las preguntas escritas a mano, «El Error de Jiro» (el orden de los pasos es el ejercicio), las que
// nombran a otras por su letra («A y B») y la pregunta de una ronda abierta de Conquista con el Telescopio (oculta
// una opción por su posición). Las respuestas guardadas de los retos de Expediciones (por posición) se reubican en la
// misma transacción para que sigan apuntando a la misma alternativa. Solo imprime números (nada de textos ni nombres).
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
const onlyBank = args.includes('--bank') ? args[args.indexOf('--bank') + 1] : null;
const quietMinutes = args.includes('--quiet-minutes') ? Number(args[args.indexOf('--quiet-minutes') + 1]) : 20;
if (!Number.isFinite(quietMinutes) || quietMinutes < 0) throw new Error('--quiet-minutes debe ser un número ≥ 0');

const ERROR_PREFIX = '¿En qué paso está el error?';
// Igual que mixOptions: «… de las anteriores» va al final; si una opción nombra a otras por su letra, no se baraja.
const PINNED_LAST = /\banteriores\b|\bambas (son|opciones|respuestas)\b/i;
const NAMES_LETTERS = /^[a-e]\)?\s*(y|o)\s*[a-e]\)?$/i;

// JSON: MySQL 8 lo devuelve como objeto y MariaDB como texto (a veces codificado dos veces).
const parseJson = (value) => {
  let current = value;
  while (typeof current === 'string') {
    try { current = JSON.parse(current); } catch { return null; }
  }
  return current ?? null;
};

/** Orden nuevo como permutación: nuevo[j] = viejo[perm[j]]. null si la pregunta no se baraja. */
const permutationFor = (options) => {
  if (options.some((o) => NAMES_LETTERS.test(String(o?.text ?? '').trim()))) return null;
  const pinned = (o) => PINNED_LAST.test(String(o?.text ?? ''));
  const free = options.map((_, i) => i).filter((i) => !pinned(options[i]));
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  const perm = [...free, ...options.map((_, i) => i).filter((i) => pinned(options[i]))];
  return perm.every((old, j) => old === j) ? 'same' : perm;
};

/** Respuesta guardada de un reto (única: número; múltiple: números) → la misma alternativa en el orden nuevo. */
const remapAnswer = (answer, perm) => {
  const to = (old) => (Number.isInteger(old) && old >= 0 && old < perm.length ? perm.indexOf(old) : old);
  if (Number.isInteger(answer)) return to(answer);
  if (Array.isArray(answer) && answer.every((v) => Number.isInteger(v))) return answer.map(to);
  return undefined;
};

const letters = (options) => options.map((o, i) => (o?.isCorrect === true ? 'ABCDE'[i] ?? '?' : '')).join('') || '—';
const tally = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
const show = (map, total) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  .map(([k, n]) => `${k} ${Math.round((n / Math.max(total, 1)) * 100)}%`).join(' · ') || '—';

const conn = await mysql.createConnection({
  host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, timezone: 'Z',
});

try {
  const [rows] = await conn.query(
    `SELECT id, type, question_text, options FROM questions
      WHERE ai_generated = 1 AND type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE')${onlyBank ? ' AND bank_id = ?' : ''}`,
    onlyBank ? [onlyBank] : [],
  );

  // La pregunta en juego de cada Conquista a medias con el Telescopio activo: su opción oculta va por posición.
  const [sessions] = await conn.query("SELECT state FROM activity_sessions WHERE status = 'ACTIVE' AND activity_type = 'CONQUISTA'");
  const protectedIds = new Set();
  for (const s of sessions) {
    const round = parseJson(s.state)?.round;
    if (round && Number.isInteger(round.hiddenOption) && typeof round.questionId === 'string') protectedIds.add(round.questionId);
  }

  const skipped = { conError: 0, sinOpciones: 0, nombranLetras: 0, telescopio: 0, quedaIgual: 0 };
  const plan = [];
  const before = { SINGLE_CHOICE: new Map(), MULTIPLE_CHOICE: new Map() };
  const after = { SINGLE_CHOICE: new Map(), MULTIPLE_CHOICE: new Map() };
  for (const row of rows) {
    if (String(row.question_text ?? '').startsWith(ERROR_PREFIX)) { skipped.conError += 1; continue; }
    const options = parseJson(row.options);
    if (!Array.isArray(options) || options.length < 2) { skipped.sinOpciones += 1; continue; }
    tally(before[row.type], letters(options));
    if (protectedIds.has(row.id)) { skipped.telescopio += 1; tally(after[row.type], letters(options)); continue; }
    const perm = permutationFor(options);
    if (perm === null) { skipped.nombranLetras += 1; tally(after[row.type], letters(options)); continue; }
    if (perm === 'same') { skipped.quedaIgual += 1; tally(after[row.type], letters(options)); continue; }
    const next = perm.map((old) => options[old]);
    tally(after[row.type], letters(next));
    plan.push({ id: row.id, options, next, perm });
  }

  // Respuestas de retos de Expediciones que hay que reubicar.
  let answerRows = [];
  if (plan.length > 0) {
    const [found] = await conn.query('SELECT id, question_id, answer FROM expedition_answers WHERE question_id IN (?)', [plan.map((p) => p.id)]);
    answerRows = found;
  }


  console.log(`Preguntas de IA (única/múltiple): ${rows.length}${onlyBank ? ' en ese banco' : ''} · se barajan: ${plan.length}`);
  console.log('No se tocan:', skipped);
  console.log(`Única, dónde está la correcta — antes: ${show(before.SINGLE_CHOICE, [...before.SINGLE_CHOICE.values()].reduce((a, b) => a + b, 0))}`);
  console.log(`                              después: ${show(after.SINGLE_CHOICE, [...after.SINGLE_CHOICE.values()].reduce((a, b) => a + b, 0))}`);
  console.log(`Múltiple — antes: ${show(before.MULTIPLE_CHOICE, [...before.MULTIPLE_CHOICE.values()].reduce((a, b) => a + b, 0))}`);
  console.log(`           después: ${show(after.MULTIPLE_CHOICE, [...after.MULTIPLE_CHOICE.values()].reduce((a, b) => a + b, 0))}`);
  console.log(`Respuestas de retos de Expediciones a reubicar: ${answerRows.length} (de ${new Set(answerRows.map((a) => a.question_id)).size} preguntas)`);
  if (plan.length === 0) console.log('Nada que barajar.');

  // Nadie respondiendo un reto ni jugando una actividad ahora mismo (una pantalla abierta guarda el orden viejo).
  let busy = null;
  if (apply && plan.length > 0 && quietMinutes > 0) {
    const since = new Date(Date.now() - quietMinutes * 60_000);
    const [[recentAnswers]] = await conn.query('SELECT COUNT(*) AS n FROM expedition_answers WHERE answered_at >= ?', [since]);
    const [[recentSessions]] = await conn.query("SELECT COUNT(*) AS n FROM activity_sessions WHERE status = 'ACTIVE' AND updated_at >= ?", [since]);
    if (Number(recentAnswers.n) > 0 || Number(recentSessions.n) > 0) busy = { respuestasDeRetos: Number(recentAnswers.n), partidasActivas: Number(recentSessions.n) };
  }

  if (!apply) {
    console.log('Solo vista previa: agrega --apply para guardar (el «después» cambia en cada corrida: es al azar).');
  } else if (busy) {
    console.log(`NO SE GUARDÓ: hubo actividad en los últimos ${quietMinutes} min`, busy, '— corre de nuevo más tarde.');
    process.exitCode = 2;
  } else if (plan.length > 0) {
    const byQuestion = new Map();
    for (const a of answerRows) byQuestion.set(a.question_id, [...(byQuestion.get(a.question_id) ?? []), a]);
    let changed = 0;
    let remapped = 0;
    let editedMeanwhile = 0;
    for (const p of plan) {
      await conn.beginTransaction();
      try {
        // Si un docente la editó entre la lectura y ahora, se deja como está.
        const [[current]] = await conn.query('SELECT options FROM questions WHERE id = ? FOR UPDATE', [p.id]);
        if (!current || JSON.stringify(parseJson(current.options)) !== JSON.stringify(p.options)) {
          editedMeanwhile += 1;
          await conn.rollback();
          continue;
        }
        await conn.query('UPDATE questions SET options = ?, updated_at = updated_at WHERE id = ?', [JSON.stringify(p.next), p.id]);
        for (const a of byQuestion.get(p.id) ?? []) {
          const mapped = remapAnswer(parseJson(a.answer), p.perm);
          if (mapped === undefined) continue;
          await conn.query('UPDATE expedition_answers SET answer = ? WHERE id = ?', [JSON.stringify(mapped), a.id]);
          remapped += 1;
        }
        await conn.commit();
        changed += 1;
      } catch (error) {
        await conn.rollback();
        throw error;
      }
    }
    console.log(`Guardado: ${changed} preguntas barajadas, ${remapped} respuestas de retos reubicadas${editedMeanwhile ? `, ${editedMeanwhile} se dejaron (editadas mientras corría)` : ''}.`);
  }
} finally {
  await conn.end();
}
