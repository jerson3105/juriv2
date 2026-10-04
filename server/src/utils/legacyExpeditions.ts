import { sql, type SQL } from 'drizzle-orm';

type Exec = { execute: (query: SQL) => Promise<unknown> };

const missingTable = (error: unknown) => [error, (error as { cause?: unknown } | null)?.cause].some((e) =>
  !!e && typeof e === 'object' && ((e as { errno?: number }).errno === 1146 || (e as { code?: string }).code === 'ER_NO_SUCH_TABLE'));

/**
 * Tablas de la expedición clásica y de la de Jiro, retiradas del código el 2026-10-03 (siguen en la base hasta
 * que se borren). Al eliminar un alumno o una clase también se borran sus filas viejas: entregas, comentarios y
 * avance. Una tabla que ya no existe se salta (en MySQL el error revierte solo esa sentencia, no la transacción).
 */
const run = async (tx: Exec, statements: SQL[]) => {
  for (const statement of statements) {
    try {
      await tx.execute(statement);
    } catch (error) {
      if (!missingTable(error)) throw error;
    }
  }
};

export const deleteLegacyExpeditionRowsOfStudent = (tx: Exec, studentProfileId: string) => run(tx, [
  sql`DELETE FROM jiro_question_answers WHERE student_expedition_id IN (SELECT id FROM jiro_student_expeditions WHERE student_profile_id = ${studentProfileId})`,
  sql`DELETE FROM jiro_deliveries WHERE student_expedition_id IN (SELECT id FROM jiro_student_expeditions WHERE student_profile_id = ${studentProfileId})`,
  sql`DELETE FROM jiro_student_expeditions WHERE student_profile_id = ${studentProfileId}`,
  sql`DELETE FROM expedition_submissions WHERE student_profile_id = ${studentProfileId}`,
  sql`DELETE FROM expedition_pin_progress WHERE student_profile_id = ${studentProfileId}`,
  sql`DELETE FROM expedition_student_progress WHERE student_profile_id = ${studentProfileId}`,
]);

/** Antes de borrar `expeditions` de la clase (las de la clásica se buscan por ella). */
export const deleteLegacyExpeditionRowsOfClassroom = (tx: Exec, classroomId: string) => run(tx, [
  sql`DELETE FROM jiro_question_answers WHERE student_expedition_id IN (SELECT se.id FROM jiro_student_expeditions se JOIN jiro_expeditions e ON e.id = se.expedition_id WHERE e.classroom_id = ${classroomId})`,
  sql`DELETE FROM jiro_deliveries WHERE student_expedition_id IN (SELECT se.id FROM jiro_student_expeditions se JOIN jiro_expeditions e ON e.id = se.expedition_id WHERE e.classroom_id = ${classroomId})`,
  sql`DELETE FROM jiro_student_expeditions WHERE expedition_id IN (SELECT id FROM jiro_expeditions WHERE classroom_id = ${classroomId})`,
  sql`DELETE FROM jiro_delivery_stations WHERE expedition_id IN (SELECT id FROM jiro_expeditions WHERE classroom_id = ${classroomId})`,
  sql`DELETE FROM jiro_expedition_competencies WHERE expedition_id IN (SELECT id FROM jiro_expeditions WHERE classroom_id = ${classroomId})`,
  sql`DELETE FROM jiro_expeditions WHERE classroom_id = ${classroomId}`,
  sql`DELETE FROM expedition_submissions WHERE expedition_id IN (SELECT id FROM expeditions WHERE classroom_id = ${classroomId})`,
  sql`DELETE FROM expedition_pin_progress WHERE expedition_id IN (SELECT id FROM expeditions WHERE classroom_id = ${classroomId})`,
  sql`DELETE FROM expedition_student_progress WHERE expedition_id IN (SELECT id FROM expeditions WHERE classroom_id = ${classroomId})`,
  sql`DELETE FROM expedition_connections WHERE expedition_id IN (SELECT id FROM expeditions WHERE classroom_id = ${classroomId})`,
  sql`DELETE FROM expedition_pins WHERE expedition_id IN (SELECT id FROM expeditions WHERE classroom_id = ${classroomId})`,
]);
