import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { classrooms, notifications, recoveryMissions, studentProfiles } from '../db/schema.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { DEFAULT_RECOVERY_MISSIONS, isInitialLevel, parseTemplates, restoreEnergy } from '../utils/energy.js';
import { affectedRows } from '../utils/points.js';
import { prepareForTx } from '../utils/notificationEmitter.js';

type MissionRow = typeof recoveryMissions.$inferSelect;

const publicMission = (m: MissionRow | undefined | null) =>
  m ? { id: m.id, text: m.text, status: m.status, createdAt: m.createdAt } : null;

/**
 * Misiones de recuperación: con 0 HP el alumno "descansa" (tienda en pausa) hasta que el profesor
 * valida una misión. La misión no depende de la Historia; al empezar un capítulo también se
 * recupera la energía (ver story.service y utils/energy.ts).
 */
class RecoveryService {
  async templates(classroomId: string) {
    const [classroom] = await db.select({ templates: classrooms.recoveryMissions }).from(classrooms).where(eq(classrooms.id, classroomId));
    const saved = parseTemplates(classroom?.templates);
    return saved?.length ? saved : DEFAULT_RECOVERY_MISSIONS;
  }

  /** Quién descansa en la clase y su misión pendiente (si tiene). */
  async listResting(classroomId: string) {
    const resting = await db.select({ id: studentProfiles.id, restingSince: studentProfiles.restingSince })
      .from(studentProfiles)
      .where(and(eq(studentProfiles.classroomId, classroomId), isNotNull(studentProfiles.restingSince)));
    const missions = resting.length
      ? await db.select().from(recoveryMissions)
        .where(and(inArray(recoveryMissions.studentProfileId, resting.map((r) => r.id)), eq(recoveryMissions.status, 'ASSIGNED')))
        .orderBy(desc(recoveryMissions.createdAt))
      : [];
    return {
      templates: await this.templates(classroomId),
      students: resting.map((r) => ({
        studentId: r.id,
        restingSince: r.restingSince,
        mission: publicMission(missions.find((m) => m.studentProfileId === r.id)),
      })),
    };
  }

  /**
   * Asigna una misión a quien descansa (reemplaza la pendiente). Con `complete` la valida en el
   * mismo paso (inicial: recuperación inmediata).
   */
  async assign(classroomId: string, studentId: string, teacherId: string, text: string, complete: boolean) {
    const [student] = await db.select({ id: studentProfiles.id, hp: studentProfiles.hp, userId: studentProfiles.userId })
      .from(studentProfiles)
      .where(and(eq(studentProfiles.id, studentId), eq(studentProfiles.classroomId, classroomId)));
    if (!student) throw new NotFoundError('Estudiante no encontrado en esta clase');
    if (student.hp > 0) throw new ConflictError('Este alumno ya no está descansando');

    const now = new Date();
    const missionId = uuidv4();
    let notifTx = prepareForTx([]);
    await db.transaction(async (tx) => {
      await tx.update(recoveryMissions)
        .set({ status: 'CANCELLED' })
        .where(and(eq(recoveryMissions.studentProfileId, studentId), eq(recoveryMissions.status, 'ASSIGNED')));
      await tx.insert(recoveryMissions).values({
        id: missionId, classroomId, studentProfileId: studentId, text, status: 'ASSIGNED', assignedBy: teacherId, createdAt: now,
      });
      if (complete) {
        await this.completeInTx(tx, missionId, teacherId, text, studentId);
      }
      if (student.userId) {
        notifTx = prepareForTx({
          userId: student.userId,
          classroomId,
          type: 'POINTS',
          title: complete ? '⚡ ¡Recuperaste tu energía!' : '🌙 Tu misión de recuperación',
          message: complete ? 'Vuelves con la mitad de tu energía. ¡A seguir!' : text,
          data: { kind: complete ? 'RECOVERED' : 'RECOVERY_MISSION', missionId },
          createdAt: now,
        });
        await tx.insert(notifications).values(notifTx.entries);
      }
    });
    await notifTx.emitAfterCommit();
    return { id: missionId, text, status: complete ? 'COMPLETED' : 'ASSIGNED' };
  }

  /** Valida una misión pendiente: vuelve al 50 % de HP y deja registro (revertible). */
  async complete(missionId: string, teacherId: string) {
    const [mission] = await db.select().from(recoveryMissions).where(eq(recoveryMissions.id, missionId));
    if (!mission) throw new NotFoundError('Misión no encontrada');
    const [owner] = await db.select({ teacherId: classrooms.teacherId }).from(classrooms).where(eq(classrooms.id, mission.classroomId));
    if (!owner || owner.teacherId !== teacherId) throw new NotFoundError('Misión no encontrada');
    const [student] = await db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.id, mission.studentProfileId));

    let notifTx = prepareForTx([]);
    await db.transaction(async (tx) => {
      await this.completeInTx(tx, missionId, teacherId, mission.text, mission.studentProfileId);
      if (student?.userId) {
        notifTx = prepareForTx({
          userId: student.userId,
          classroomId: mission.classroomId,
          type: 'POINTS',
          title: '⚡ ¡Recuperaste tu energía!',
          message: 'Cumpliste tu misión: vuelves con la mitad de tu energía.',
          data: { kind: 'RECOVERED', missionId },
          createdAt: new Date(),
        });
        await tx.insert(notifications).values(notifTx.entries);
      }
    });
    await notifTx.emitAfterCommit();
    return { id: missionId, status: 'COMPLETED' };
  }

  private async completeInTx(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], missionId: string, teacherId: string, text: string, studentId: string) {
    const now = new Date();
    // Solo una validación gana (doble clic o dos pestañas).
    const claim = await tx.update(recoveryMissions)
      .set({ status: 'COMPLETED', completedBy: teacherId, completedAt: now })
      .where(and(eq(recoveryMissions.id, missionId), eq(recoveryMissions.status, 'ASSIGNED')));
    if (affectedRows(claim) !== 1) throw new ConflictError('Esta misión ya se validó o se canceló');
    const [fresh] = await tx.select({ hp: studentProfiles.hp }).from(studentProfiles).where(eq(studentProfiles.id, studentId)).for('update');
    if (!fresh || fresh.hp > 0) throw new ConflictError('Este alumno ya no está descansando');
    const logs = await restoreEnergy(tx, [studentId], 'HALF', `Misión de recuperación: ${text}`, teacherId);
    const logId = logs.get(studentId);
    if (logId) await tx.update(recoveryMissions).set({ completionPointLogId: logId }).where(eq(recoveryMissions.id, missionId));
  }

  /** Lo que ve el alumno de sí mismo (solo el dueño del perfil). */
  async forStudent(profileId: string, userId: string) {
    const [profile] = await db.select({
      id: studentProfiles.id, userId: studentProfiles.userId, hp: studentProfiles.hp, restingSince: studentProfiles.restingSince,
      maxHp: classrooms.maxHp, gradeLevel: classrooms.gradeLevel,
    })
      .from(studentProfiles)
      .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
      .where(eq(studentProfiles.id, profileId));
    if (!profile || profile.userId !== userId) throw new NotFoundError('Perfil no encontrado');
    const [mission] = profile.restingSince
      ? await db.select().from(recoveryMissions)
        .where(and(eq(recoveryMissions.studentProfileId, profileId), eq(recoveryMissions.status, 'ASSIGNED')))
        .orderBy(desc(recoveryMissions.createdAt)).limit(1)
      : [];
    return {
      resting: profile.hp <= 0,
      restingSince: profile.restingSince,
      hp: profile.hp,
      maxHp: profile.maxHp,
      initial: isInitialLevel(profile.gradeLevel),
      mission: publicMission(mission),
    };
  }
}

export const recoveryService = new RecoveryService();
