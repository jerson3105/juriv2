import { and, eq, inArray, lt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { classrooms, notifications, pointLogs, recoveryMissions, studentProfiles } from '../db/schema.js';

/**
 * Energía (HP) = convivencia y autorregulación. Con 0 HP el alumno "descansa": la tienda se pausa
 * y solo sale con una misión de recuperación que valida el profesor (o al empezar un capítulo).
 * Nunca afecta notas. Funciones para usar dentro de la misma transacción que el cambio de HP.
 */

type Executor = {
  update: typeof import('../db/index.js').db.update;
  select: typeof import('../db/index.js').db.select;
  insert: typeof import('../db/index.js').db.insert;
};

/** Plantillas de fábrica (el profesor las edita en Configuración > Reglas del juego). */
export const DEFAULT_RECOVERY_MISSIONS = [
  'Cuéntale a tu profe qué pasó y qué harás diferente la próxima vez.',
  'Ayuda a un compañero o a la clase en algo concreto.',
  'Termina la tarea o actividad que quedó pendiente.',
  'Propón cómo reparar lo que pasó con quien se vio afectado.',
];

/** Plantillas guardadas: MariaDB devuelve las columnas JSON como texto. */
export const parseTemplates = (raw: unknown): string[] | null => {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : null;
};

/** La clase es de inicial: corazones sin números, recuperación inmediata, sin pausa de tienda. */
export const isInitialLevel = (gradeLevel: string | null | undefined) => !!gradeLevel && gradeLevel.toUpperCase().startsWith('INICIAL');

/**
 * Pone al día "Descansando" tras cualquier cambio de HP: marca a quien llegó a 0 (y avisa al
 * profesor) y libera a quien volvió a tener energía (cancela su misión pendiente).
 */
export const syncRestingState = async (exec: Executor, studentProfileIds: string[]) => {
  const ids = [...new Set(studentProfileIds)];
  if (ids.length === 0) return { nowResting: [] as string[], recovered: [] as string[] };
  const rows = await exec
    .select({
      id: studentProfiles.id,
      hp: studentProfiles.hp,
      restingSince: studentProfiles.restingSince,
      classroomId: studentProfiles.classroomId,
      name: studentProfiles.characterName,
      teacherId: classrooms.teacherId,
    })
    .from(studentProfiles)
    .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
    .where(inArray(studentProfiles.id, ids));

  const now = new Date();
  const nowResting = rows.filter((r) => r.hp <= 0 && !r.restingSince);
  const recovered = rows.filter((r) => r.hp > 0 && r.restingSince);

  if (nowResting.length > 0) {
    await exec.update(studentProfiles).set({ restingSince: now }).where(inArray(studentProfiles.id, nowResting.map((r) => r.id)));
    await exec.insert(notifications).values(nowResting.map((r) => ({
      id: uuidv4(),
      userId: r.teacherId,
      classroomId: r.classroomId,
      type: 'POINTS' as const,
      title: '🌙 Se quedó sin energía',
      message: `${r.name || 'Un estudiante'} está descansando. Asígnale una misión de recuperación.`,
      data: { studentProfileId: r.id, kind: 'RESTING' },
      isRead: false,
      createdAt: now,
    })));
  }
  if (recovered.length > 0) {
    const recoveredIds = recovered.map((r) => r.id);
    await exec.update(studentProfiles).set({ restingSince: null }).where(inArray(studentProfiles.id, recoveredIds));
    await exec.update(recoveryMissions)
      .set({ status: 'CANCELLED' })
      .where(and(inArray(recoveryMissions.studentProfileId, recoveredIds), eq(recoveryMissions.status, 'ASSIGNED')));
  }
  return { nowResting: nowResting.map((r) => r.id), recovered: recovered.map((r) => r.id) };
};

/**
 * Devuelve energía: HALF (misión cumplida) o FULL (nuevo capítulo). Solo sube a quien está por
 * debajo del objetivo; deja un registro de puntos por alumno (revertible) y sincroniza el estado.
 * Devuelve el id del registro por alumno.
 */
export const restoreEnergy = async (
  exec: Executor,
  studentProfileIds: string[],
  target: 'HALF' | 'FULL',
  reason: string,
  givenBy: string | null,
) => {
  const ids = [...new Set(studentProfileIds)];
  const logIds = new Map<string, string>();
  if (ids.length === 0) return logIds;
  const rows = await exec
    .select({ id: studentProfiles.id, hp: studentProfiles.hp, maxHp: classrooms.maxHp })
    .from(studentProfiles)
    .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
    .where(inArray(studentProfiles.id, ids));

  const now = new Date();
  for (const row of rows) {
    const goal = target === 'FULL' ? row.maxHp : Math.ceil(row.maxHp * 0.5);
    if (row.hp >= goal) continue;
    // Condicional: si otra escritura ya lo subió, no se pisa.
    await exec.update(studentProfiles)
      .set({ hp: goal, updatedAt: now })
      .where(and(eq(studentProfiles.id, row.id), lt(studentProfiles.hp, goal)));
    const logId = uuidv4();
    await exec.insert(pointLogs).values({
      id: logId,
      studentId: row.id,
      pointType: 'HP',
      action: 'ADD',
      amount: goal - Math.max(0, row.hp),
      reason,
      givenBy,
      createdAt: now,
    });
    logIds.set(row.id, logId);
  }
  await syncRestingState(exec, ids);
  return logIds;
};
