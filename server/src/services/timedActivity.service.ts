import { db } from '../db/index.js';
import { 
  timedActivities, 
  timedActivityResults, 
  studentProfiles,
  classrooms,
  behaviors,
  pointLogs,
  activityCompetencies,
  type TimedActivity,
  type TimedActivityMode,
  type TimedActivityStatus,
} from '../db/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { clanService } from './clan.service.js';
import { storyService } from './story.service.js';

// DTOs
export interface CreateTimedActivityDto {
  classroomId: string;
  name: string;
  description?: string;
  mode: TimedActivityMode;
  timeLimitSeconds?: number;
  bombMinSeconds?: number;
  bombMaxSeconds?: number;
  behaviorId?: string;
  basePoints?: number;
  pointType?: 'XP' | 'HP' | 'GP';
  useMultipliers?: boolean;
  multiplier50?: number;
  multiplier75?: number;
  negativeBehaviorId?: string;
  bombPenaltyPoints?: number;
  bombPenaltyType?: 'XP' | 'HP' | 'GP';
  competencyIds?: string[];
}

export interface UpdateTimedActivityDto extends Partial<CreateTimedActivityDto> {}

export interface MarkStudentCompleteDto {
  activityId: string;
  studentProfileId: string;
  elapsedSeconds: number;
}

export interface MarkStudentExplodedDto {
  activityId: string;
  studentProfileId: string;
}

export interface TimedActivityWithResults extends TimedActivity {
  results?: any[];
  behavior?: any;
  negativeBehavior?: any;
}

class TimedActivityService {
  // Crear actividad
  async create(data: CreateTimedActivityDto): Promise<TimedActivity> {
    const id = uuidv4();
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(timedActivities).values({
        id,
        classroomId: data.classroomId,
        name: data.name,
        description: data.description || null,
        mode: data.mode,
        status: 'DRAFT',
        timeLimitSeconds: data.timeLimitSeconds || null,
        bombMinSeconds: data.bombMinSeconds || null,
        bombMaxSeconds: data.bombMaxSeconds || null,
        behaviorId: data.behaviorId || null,
        basePoints: data.basePoints || 10,
        pointType: data.pointType || 'XP',
        useMultipliers: data.useMultipliers || false,
        multiplier50: data.multiplier50 || 200,
        multiplier75: data.multiplier75 || 150,
        negativeBehaviorId: data.negativeBehaviorId || null,
        bombPenaltyPoints: data.bombPenaltyPoints || 10,
        bombPenaltyType: data.bombPenaltyType || 'HP',
        createdAt: now,
        updatedAt: now,
      });

      if (data.competencyIds && data.competencyIds.length > 0) {
        const competencyValues = data.competencyIds.map(competencyId => ({
          id: uuidv4(),
          activityType: 'TIMED' as const,
          activityId: id,
          competencyId,
          weight: 30,
          createdAt: now,
        }));
        await tx.insert(activityCompetencies).values(competencyValues);
      }
    });

    const [activity] = await db
      .select()
      .from(timedActivities)
      .where(eq(timedActivities.id, id));

    return activity;
  }

  // Obtener actividades de una clase
  async getByClassroom(classroomId: string): Promise<TimedActivityWithResults[]> {
    const activities = await db
      .select()
      .from(timedActivities)
      .where(eq(timedActivities.classroomId, classroomId))
      .orderBy(desc(timedActivities.createdAt));

    if (activities.length === 0) {
      return [];
    }

    const activityIds = activities.map((activity) => activity.id);

    const results = await db
      .select({
        activityId: timedActivityResults.activityId,
        id: timedActivityResults.id,
        studentProfileId: timedActivityResults.studentProfileId,
        completedAt: timedActivityResults.completedAt,
        elapsedSeconds: timedActivityResults.elapsedSeconds,
        multiplierApplied: timedActivityResults.multiplierApplied,
        pointsAwarded: timedActivityResults.pointsAwarded,
        wasExploded: timedActivityResults.wasExploded,
        penaltyApplied: timedActivityResults.penaltyApplied,
        student: {
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
          displayName: studentProfiles.displayName,
          characterClass: studentProfiles.characterClass,
          avatarGender: studentProfiles.avatarGender,
        },
      })
      .from(timedActivityResults)
      .leftJoin(studentProfiles, eq(timedActivityResults.studentProfileId, studentProfiles.id))
      .where(inArray(timedActivityResults.activityId, activityIds));

    const resultsByActivity = new Map<string, any[]>();
    for (const result of results) {
      const current = resultsByActivity.get(result.activityId) || [];
      current.push({
        id: result.id,
        studentProfileId: result.studentProfileId,
        completedAt: result.completedAt,
        elapsedSeconds: result.elapsedSeconds,
        multiplierApplied: result.multiplierApplied,
        pointsAwarded: result.pointsAwarded,
        wasExploded: result.wasExploded,
        penaltyApplied: result.penaltyApplied,
        student: result.student,
      });
      resultsByActivity.set(result.activityId, current);
    }

    const behaviorIds = Array.from(new Set(
      activities
        .flatMap((activity) => [activity.behaviorId, activity.negativeBehaviorId])
        .filter((id): id is string => Boolean(id))
    ));

    const behaviorById = new Map<string, any>();
    if (behaviorIds.length > 0) {
      const behaviorRows = await db
        .select()
        .from(behaviors)
        .where(inArray(behaviors.id, behaviorIds));

      for (const behavior of behaviorRows) {
        behaviorById.set(behavior.id, behavior);
      }
    }

    return activities.map((activity) => ({
      ...activity,
      results: resultsByActivity.get(activity.id) || [],
      behavior: activity.behaviorId ? (behaviorById.get(activity.behaviorId) || null) : null,
      negativeBehavior: activity.negativeBehaviorId ? (behaviorById.get(activity.negativeBehaviorId) || null) : null,
    }));
  }

  // Obtener una actividad por ID
  async getById(id: string): Promise<TimedActivityWithResults | null> {
    const [activity] = await db
      .select()
      .from(timedActivities)
      .where(eq(timedActivities.id, id));

    if (!activity) return null;

    const results = await db
      .select({
        id: timedActivityResults.id,
        studentProfileId: timedActivityResults.studentProfileId,
        completedAt: timedActivityResults.completedAt,
        elapsedSeconds: timedActivityResults.elapsedSeconds,
        multiplierApplied: timedActivityResults.multiplierApplied,
        pointsAwarded: timedActivityResults.pointsAwarded,
        wasExploded: timedActivityResults.wasExploded,
        penaltyApplied: timedActivityResults.penaltyApplied,
        student: {
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
          displayName: studentProfiles.displayName,
          characterClass: studentProfiles.characterClass,
          avatarGender: studentProfiles.avatarGender,
        },
      })
      .from(timedActivityResults)
      .leftJoin(studentProfiles, eq(timedActivityResults.studentProfileId, studentProfiles.id))
      .where(eq(timedActivityResults.activityId, id));

    let behavior = null;
    if (activity.behaviorId) {
      const [b] = await db
        .select()
        .from(behaviors)
        .where(eq(behaviors.id, activity.behaviorId));
      behavior = b;
    }

    let negativeBehavior = null;
    if (activity.negativeBehaviorId) {
      const [nb] = await db
        .select()
        .from(behaviors)
        .where(eq(behaviors.id, activity.negativeBehaviorId));
      negativeBehavior = nb;
    }

    return {
      ...activity,
      results,
      behavior,
      negativeBehavior,
    };
  }

  // Actualizar actividad
  async update(id: string, data: UpdateTimedActivityDto): Promise<TimedActivity | null> {
    const { competencyIds, classroomId: _ignoredClassroomId, ...activityData } = data;
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(timedActivities)
        .set({
          ...activityData,
          updatedAt: now,
        })
        .where(eq(timedActivities.id, id));

      if (typeof competencyIds !== 'undefined') {
        await tx
          .delete(activityCompetencies)
          .where(and(
            eq(activityCompetencies.activityType, 'TIMED'),
            eq(activityCompetencies.activityId, id)
          ));

        if (competencyIds.length > 0) {
          await tx.insert(activityCompetencies).values(
            competencyIds.map((competencyId) => ({
              id: uuidv4(),
              activityType: 'TIMED' as const,
              activityId: id,
              competencyId,
              weight: 30,
              createdAt: now,
            }))
          );
        }
      }
    });

    return this.getById(id);
  }

  // Eliminar actividad
  async delete(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(timedActivityResults).where(eq(timedActivityResults.activityId, id));
      await tx
        .delete(activityCompetencies)
        .where(and(
          eq(activityCompetencies.activityType, 'TIMED'),
          eq(activityCompetencies.activityId, id)
        ));
      await tx.delete(timedActivities).where(eq(timedActivities.id, id));
    });
  }

  // Iniciar actividad
  async start(id: string): Promise<TimedActivity | null> {
    const [activity] = await db
      .select()
      .from(timedActivities)
      .where(eq(timedActivities.id, id));

    if (!activity) return null;

    const now = new Date();
    let actualBombTime = null;

    // Para modo BOMB y BOMB_RANDOM, generar tiempo aleatorio
    if ((activity.mode === 'BOMB' || activity.mode === 'BOMB_RANDOM') && activity.bombMinSeconds && activity.bombMaxSeconds) {
      actualBombTime = Math.floor(
        Math.random() * (activity.bombMaxSeconds - activity.bombMinSeconds + 1) + activity.bombMinSeconds
      );
    }

    await db
      .update(timedActivities)
      .set({
        status: 'ACTIVE',
        startedAt: now,
        pausedAt: null,
        elapsedSeconds: 0,
        actualBombTime,
        updatedAt: now,
      })
      .where(eq(timedActivities.id, id));

    return this.getById(id);
  }

  // Pausar actividad
  async pause(id: string, elapsedSeconds: number): Promise<TimedActivity | null> {
    const now = new Date();

    await db
      .update(timedActivities)
      .set({
        status: 'PAUSED',
        pausedAt: now,
        elapsedSeconds,
        updatedAt: now,
      })
      .where(eq(timedActivities.id, id));

    return this.getById(id);
  }

  // Reanudar actividad
  async resume(id: string): Promise<TimedActivity | null> {
    const now = new Date();

    await db
      .update(timedActivities)
      .set({
        status: 'ACTIVE',
        pausedAt: null,
        updatedAt: now,
      })
      .where(eq(timedActivities.id, id));

    return this.getById(id);
  }

  // Completar actividad
  async complete(id: string, elapsedSeconds: number): Promise<TimedActivity | null> {
    const now = new Date();

    await db
      .update(timedActivities)
      .set({
        status: 'COMPLETED',
        completedAt: now,
        elapsedSeconds,
        updatedAt: now,
      })
      .where(eq(timedActivities.id, id));

    return this.getById(id);
  }

  // Reiniciar actividad (volver a DRAFT)
  async reset(id: string): Promise<TimedActivity | null> {
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.delete(timedActivityResults).where(eq(timedActivityResults.activityId, id));

      await tx
        .update(timedActivities)
        .set({
          status: 'DRAFT',
          startedAt: null,
          pausedAt: null,
          completedAt: null,
          elapsedSeconds: 0,
          actualBombTime: null,
          updatedAt: now,
        })
        .where(eq(timedActivities.id, id));
    });

    return this.getById(id);
  }

  // Marcar estudiante como completado
  async markStudentComplete(data: MarkStudentCompleteDto): Promise<any> {
    const [activity] = await db
      .select()
      .from(timedActivities)
      .where(eq(timedActivities.id, data.activityId));

    if (!activity) throw new Error('Actividad no encontrada');

    // Calcular multiplicador
    let multiplier = 100;
    if (activity.useMultipliers && activity.timeLimitSeconds) {
      const percentComplete = (data.elapsedSeconds / activity.timeLimitSeconds) * 100;
      if (percentComplete <= 50) {
        multiplier = activity.multiplier50 || 200;
      } else if (percentComplete <= 75) {
        multiplier = activity.multiplier75 || 150;
      }
    }

    // Calcular puntos
    let basePoints = activity.basePoints || 10;
    
    // Si hay comportamiento, usar sus puntos
    if (activity.behaviorId) {
      const [behavior] = await db
        .select()
        .from(behaviors)
        .where(eq(behaviors.id, activity.behaviorId));
      if (behavior) {
        basePoints = behavior.pointValue;
      }
    }

    const pointsAwarded = Math.round((basePoints * multiplier) / 100);

    const pointType = activity.pointType || 'XP';

    const result = await db.transaction(async (tx) => {
      const [student] = await tx
        .select({
          id: studentProfiles.id,
          classroomId: studentProfiles.classroomId,
          xp: studentProfiles.xp,
          hp: studentProfiles.hp,
          gp: studentProfiles.gp,
        })
        .from(studentProfiles)
        .where(and(
          eq(studentProfiles.id, data.studentProfileId),
          eq(studentProfiles.classroomId, activity.classroomId),
          eq(studentProfiles.isActive, true)
        ));

      if (!student) {
        throw new Error('El estudiante no pertenece a esta actividad');
      }

      const [existingResult] = await tx
        .select({
          id: timedActivityResults.id,
          pointsAwarded: timedActivityResults.pointsAwarded,
        })
        .from(timedActivityResults)
        .where(and(
          eq(timedActivityResults.activityId, data.activityId),
          eq(timedActivityResults.studentProfileId, data.studentProfileId)
        ));

      const resultId = existingResult?.id || uuidv4();
      const now = new Date();

      if (existingResult) {
        await tx
          .update(timedActivityResults)
          .set({
            completedAt: now,
            elapsedSeconds: data.elapsedSeconds,
            multiplierApplied: multiplier,
            pointsAwarded,
          })
          .where(eq(timedActivityResults.id, existingResult.id));
      } else {
        await tx.insert(timedActivityResults).values({
          id: resultId,
          activityId: data.activityId,
          studentProfileId: data.studentProfileId,
          completedAt: now,
          elapsedSeconds: data.elapsedSeconds,
          multiplierApplied: multiplier,
          pointsAwarded,
          createdAt: now,
        });
      }

      const previousPoints = Number(existingResult?.pointsAwarded || 0);
      const pointsDelta = pointsAwarded - previousPoints;
      let xpDeltaForSideEffects = 0;

      if (pointsDelta !== 0) {
        const deltaAmount = Math.abs(pointsDelta);
        const deltaAction = pointsDelta > 0 ? 'ADD' as const : 'REMOVE' as const;

        const pointUpdate = await this.applyPointsInTransaction(
          tx,
          student,
          pointType as 'XP' | 'HP' | 'GP',
          deltaAmount,
          deltaAction,
          activity.name
        );

        if (pointUpdate.triggerXpSideEffects) {
          xpDeltaForSideEffects = pointUpdate.appliedAmount;
        }
      }

      return {
        resultId,
        multiplier,
        pointsAwarded,
        classroomId: student.classroomId,
        xpDeltaForSideEffects,
      };
    });

    if (result.xpDeltaForSideEffects > 0) {
      await this.runXpSideEffects(result.classroomId, data.studentProfileId, result.xpDeltaForSideEffects, activity.name);
    }

    return {
      resultId: result.resultId,
      multiplier: result.multiplier,
      pointsAwarded: result.pointsAwarded,
    };
  }

  // Marcar estudiante como explotado (modo BOMB)
  async markStudentExploded(data: MarkStudentExplodedDto): Promise<any> {
    const [activity] = await db
      .select()
      .from(timedActivities)
      .where(eq(timedActivities.id, data.activityId));

    if (!activity) throw new Error('Actividad no encontrada');
    if (activity.mode !== 'BOMB' && activity.mode !== 'BOMB_RANDOM') throw new Error('Esta actividad no es modo bomba');

    // Calcular penalización
    let penaltyPoints = activity.bombPenaltyPoints || 10;
    
    // Si hay comportamiento negativo, usar sus puntos
    if (activity.negativeBehaviorId) {
      const [behavior] = await db
        .select()
        .from(behaviors)
        .where(eq(behaviors.id, activity.negativeBehaviorId));
      if (behavior) {
        penaltyPoints = behavior.pointValue;
      }
    }

    const penaltyType = activity.bombPenaltyType || 'HP';

    const result = await db.transaction(async (tx) => {
      const [student] = await tx
        .select({
          id: studentProfiles.id,
          classroomId: studentProfiles.classroomId,
          xp: studentProfiles.xp,
          hp: studentProfiles.hp,
          gp: studentProfiles.gp,
        })
        .from(studentProfiles)
        .where(and(
          eq(studentProfiles.id, data.studentProfileId),
          eq(studentProfiles.classroomId, activity.classroomId),
          eq(studentProfiles.isActive, true)
        ));

      if (!student) {
        throw new Error('El estudiante no pertenece a esta actividad');
      }

      const [existingResult] = await tx
        .select({
          id: timedActivityResults.id,
          wasExploded: timedActivityResults.wasExploded,
          penaltyApplied: timedActivityResults.penaltyApplied,
        })
        .from(timedActivityResults)
        .where(and(
          eq(timedActivityResults.activityId, data.activityId),
          eq(timedActivityResults.studentProfileId, data.studentProfileId)
        ));

      const resultId = existingResult?.id || uuidv4();
      const now = new Date();

      if (existingResult) {
        await tx
          .update(timedActivityResults)
          .set({
            wasExploded: true,
            penaltyApplied: penaltyPoints,
          })
          .where(eq(timedActivityResults.id, existingResult.id));
      } else {
        await tx.insert(timedActivityResults).values({
          id: resultId,
          activityId: data.activityId,
          studentProfileId: data.studentProfileId,
          wasExploded: true,
          penaltyApplied: penaltyPoints,
          createdAt: now,
        });
      }

      const previousPenalty = existingResult?.wasExploded ? Number(existingResult.penaltyApplied || 0) : 0;
      const penaltyDelta = penaltyPoints - previousPenalty;
      let xpDeltaForSideEffects = 0;

      if (penaltyDelta !== 0) {
        const deltaAmount = Math.abs(penaltyDelta);
        const deltaAction = penaltyDelta > 0 ? 'REMOVE' as const : 'ADD' as const;

        const pointUpdate = await this.applyPointsInTransaction(
          tx,
          student,
          penaltyType as 'XP' | 'HP' | 'GP',
          deltaAmount,
          deltaAction,
          `Bomba - ${activity.name}`
        );

        if (pointUpdate.triggerXpSideEffects) {
          xpDeltaForSideEffects = pointUpdate.appliedAmount;
        }
      }

      return {
        resultId,
        penaltyApplied: penaltyPoints,
        classroomId: student.classroomId,
        xpDeltaForSideEffects,
      };
    });

    if (result.xpDeltaForSideEffects > 0) {
      await this.runXpSideEffects(result.classroomId, data.studentProfileId, result.xpDeltaForSideEffects, `Bomba - ${activity.name}`);
    }

    return {
      resultId: result.resultId,
      penaltyApplied: result.penaltyApplied,
    };
  }

  private async applyPointsInTransaction(
    tx: any,
    student: { id: string; classroomId: string; xp: number; hp: number; gp: number },
    pointType: 'XP' | 'HP' | 'GP',
    amount: number,
    action: 'ADD' | 'REMOVE',
    reason: string
  ): Promise<{ triggerXpSideEffects: boolean; appliedAmount: number }> {
    const currentValue = pointType === 'XP' ? student.xp : pointType === 'HP' ? student.hp : student.gp;
    const newValue = action === 'ADD' ? currentValue + amount : Math.max(0, currentValue - amount);
    const appliedAmount = Math.abs(newValue - currentValue);

    if (appliedAmount === 0) {
      return {
        triggerXpSideEffects: false,
        appliedAmount: 0,
      };
    }

    const updateData: any = {};
    if (pointType === 'XP') updateData.xp = newValue;
    if (pointType === 'HP') updateData.hp = newValue;
    if (pointType === 'GP') updateData.gp = newValue;

    await tx
      .update(studentProfiles)
      .set(updateData)
      .where(eq(studentProfiles.id, student.id));

    await tx.insert(pointLogs).values({
      id: uuidv4(),
      studentId: student.id,
      pointType,
      amount: appliedAmount,
      action,
      reason,
      createdAt: new Date(),
    });

    return {
      triggerXpSideEffects: pointType === 'XP' && action === 'ADD' && appliedAmount > 0,
      appliedAmount,
    };
  }

  private async runXpSideEffects(
    classroomId: string,
    studentProfileId: string,
    amount: number,
    reason: string
  ): Promise<void> {
    try {
      await clanService.contributeXpToClan(studentProfileId, amount, reason);
    } catch (error) {
      console.error('Error contributing XP to clan:', error);
    }

    try {
      await storyService.onXpAwarded(classroomId, studentProfileId, amount);
    } catch {
      // Silently fail
    }
  }

  async getClassroomIdByActivity(activityId: string): Promise<string | null> {
    const [activity] = await db
      .select({ classroomId: timedActivities.classroomId })
      .from(timedActivities)
      .where(eq(timedActivities.id, activityId));

    return activity?.classroomId || null;
  }

  async verifyTeacherOwnsClassroom(teacherId: string, classroomId: string): Promise<boolean> {
    const [classroom] = await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(and(
        eq(classrooms.id, classroomId),
        eq(classrooms.teacherId, teacherId)
      ));

    return !!classroom;
  }

  // Obtener actividad activa de una clase
  async getActiveActivity(classroomId: string): Promise<TimedActivityWithResults | null> {
    const [activity] = await db
      .select()
      .from(timedActivities)
      .where(
        and(
          eq(timedActivities.classroomId, classroomId),
          eq(timedActivities.status, 'ACTIVE')
        )
      );

    if (!activity) return null;
    return this.getById(activity.id);
  }
}

export const timedActivityService = new TimedActivityService();
