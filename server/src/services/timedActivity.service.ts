import { db } from '../db/index.js';
import { 
  timedActivities, 
  timedActivityResults, 
  studentProfiles,
  behaviors,
  pointLogs,
  activityCompetencies,
  type TimedActivity,
  type TimedActivityMode,
  type TimedActivityStatus,
} from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { clanService } from './clan.service.js';
import { missionService } from './mission.service.js';

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

    await db.insert(timedActivities).values({
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

    // Guardar competencias asociadas si existen
    if (data.competencyIds && data.competencyIds.length > 0) {
      const competencyValues = data.competencyIds.map(competencyId => ({
        id: uuidv4(),
        activityType: 'TIMED' as const,
        activityId: id,
        competencyId,
        weight: 100,
        createdAt: now,
      }));
      await db.insert(activityCompetencies).values(competencyValues);
    }

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

    // Obtener resultados y comportamientos para cada actividad
    const activitiesWithData = await Promise.all(
      activities.map(async (activity) => {
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
          .where(eq(timedActivityResults.activityId, activity.id));

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
      })
    );

    return activitiesWithData;
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
    await db
      .update(timedActivities)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(timedActivities.id, id));

    return this.getById(id);
  }

  // Eliminar actividad
  async delete(id: string): Promise<void> {
    // Primero eliminar resultados
    await db.delete(timedActivityResults).where(eq(timedActivityResults.activityId, id));
    // Luego eliminar actividad
    await db.delete(timedActivities).where(eq(timedActivities.id, id));
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

    // Eliminar resultados anteriores
    await db.delete(timedActivityResults).where(eq(timedActivityResults.activityId, id));

    await db
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

    // Verificar si ya existe resultado para este estudiante
    const [existingResult] = await db
      .select()
      .from(timedActivityResults)
      .where(
        and(
          eq(timedActivityResults.activityId, data.activityId),
          eq(timedActivityResults.studentProfileId, data.studentProfileId)
        )
      );

    const resultId = existingResult?.id || uuidv4();
    const now = new Date();

    if (existingResult) {
      await db
        .update(timedActivityResults)
        .set({
          completedAt: now,
          elapsedSeconds: data.elapsedSeconds,
          multiplierApplied: multiplier,
          pointsAwarded,
        })
        .where(eq(timedActivityResults.id, existingResult.id));
    } else {
      await db.insert(timedActivityResults).values({
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

    // Aplicar puntos al estudiante
    const pointType = activity.pointType || 'XP';
    await this.applyPoints(data.studentProfileId, pointType as 'XP' | 'HP' | 'GP', pointsAwarded, 'ADD', activity.name);

    return {
      resultId,
      multiplier,
      pointsAwarded,
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

    const resultId = uuidv4();
    const now = new Date();

    await db.insert(timedActivityResults).values({
      id: resultId,
      activityId: data.activityId,
      studentProfileId: data.studentProfileId,
      wasExploded: true,
      penaltyApplied: penaltyPoints,
      createdAt: now,
    });

    // Aplicar penalización al estudiante
    const penaltyType = activity.bombPenaltyType || 'HP';
    await this.applyPoints(data.studentProfileId, penaltyType as 'XP' | 'HP' | 'GP', penaltyPoints, 'REMOVE', `Bomba - ${activity.name}`);

    return {
      resultId,
      penaltyApplied: penaltyPoints,
    };
  }

  // Aplicar puntos a un estudiante
  private async applyPoints(
    studentProfileId: string,
    pointType: 'XP' | 'HP' | 'GP',
    amount: number,
    action: 'ADD' | 'REMOVE',
    reason: string
  ): Promise<void> {
    const [student] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));

    if (!student) return;

    const currentValue = pointType === 'XP' ? student.xp : pointType === 'HP' ? student.hp : student.gp;
    const newValue = action === 'ADD' ? currentValue + amount : Math.max(0, currentValue - amount);

    const updateData: any = {};
    if (pointType === 'XP') updateData.xp = newValue;
    if (pointType === 'HP') updateData.hp = newValue;
    if (pointType === 'GP') updateData.gp = newValue;

    await db
      .update(studentProfiles)
      .set(updateData)
      .where(eq(studentProfiles.id, studentProfileId));

    // Registrar en log
    await db.insert(pointLogs).values({
      id: uuidv4(),
      studentId: studentProfileId,
      pointType,
      amount,
      action,
      reason,
      createdAt: new Date(),
    });

    // Contribuir XP al clan si es una adición de XP
    if (pointType === 'XP' && action === 'ADD' && amount > 0) {
      try {
        await clanService.contributeXpToClan(studentProfileId, amount, reason);
      } catch (error) {
        // Silently fail - don't break timed activity
        console.error('Error contributing XP to clan:', error);
      }
    }

    // Tracking de misiones - puntos ganados en actividad
    if (action === 'ADD' && amount > 0) {
      try {
        if (pointType === 'XP') {
          await missionService.updateMissionProgress(studentProfileId, 'EARN_XP', amount);
        } else if (pointType === 'GP') {
          await missionService.updateMissionProgress(studentProfileId, 'EARN_GP', amount);
        }
      } catch (error) {
        console.error('Error updating mission progress:', error);
      }
    }
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
