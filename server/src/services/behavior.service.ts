import { db } from '../db/index.js';
import { behaviors, studentProfiles, pointLogs, classrooms, notifications, curriculumCompetencies, classroomCompetencies, classroomCompetencyIndicators } from '../db/schema.js';
import { eq, and, inArray, gte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { badgeService } from './badge.service.js';
import { clanService } from './clan.service.js';
import { storyService } from './story.service.js';
import { prepareForTx } from '../utils/notificationEmitter.js';
import { applyPointDeltasBulk } from '../utils/points.js';

type PointType = 'XP' | 'HP' | 'GP';

interface CreateBehaviorData {
  classroomId: string;
  name: string;
  description?: string;
  pointType: PointType; // Legacy - tipo principal
  pointValue: number; // Legacy - valor principal
  xpValue?: number;
  hpValue?: number;
  gpValue?: number;
  isPositive: boolean;
  icon?: string;
  competencyId?: string | null;
  competencyIndicatorId?: string | null;
}

interface ApplyBehaviorData {
  behaviorId: string;
  studentIds: string[];
  teacherId: string;
  multiplier?: number;
}

export class BehaviorService {
  private async resolveCompetencyAssignment(
    classroomId: string,
    competencyId?: string | null,
    competencyIndicatorId?: string | null,
  ): Promise<{ competencyId: string | null; competencyIndicatorId: string | null }> {
    if (competencyIndicatorId) {
      const [indicator] = await db
        .select({
          id: classroomCompetencyIndicators.id,
          competencyId: classroomCompetencyIndicators.competencyId,
        })
        .from(classroomCompetencyIndicators)
        .where(and(
          eq(classroomCompetencyIndicators.id, competencyIndicatorId),
          eq(classroomCompetencyIndicators.classroomId, classroomId),
          eq(classroomCompetencyIndicators.isActive, true),
        ));

      if (!indicator) {
        throw new Error('La destreza seleccionada no existe o no pertenece a esta clase');
      }

      if (competencyId && competencyId !== indicator.competencyId) {
        throw new Error('La destreza seleccionada no pertenece a la competencia elegida');
      }

      return {
        competencyId: indicator.competencyId,
        competencyIndicatorId: indicator.id,
      };
    }

    if (!competencyId) {
      return {
        competencyId: null,
        competencyIndicatorId: null,
      };
    }

    const [enabledCompetency] = await db
      .select({ competencyId: classroomCompetencies.competencyId })
      .from(classroomCompetencies)
      .where(and(
        eq(classroomCompetencies.classroomId, classroomId),
        eq(classroomCompetencies.competencyId, competencyId),
        eq(classroomCompetencies.isActive, true),
      ));

    if (!enabledCompetency) {
      throw new Error('La competencia seleccionada no esta habilitada en esta clase');
    }

    return {
      competencyId,
      competencyIndicatorId: null,
    };
  }

  private buildBehaviorResponse(row: any) {
    return {
      id: row.id,
      classroomId: row.classroomId,
      name: row.name,
      description: row.description,
      pointType: row.pointType,
      pointValue: row.pointValue,
      xpValue: row.xpValue,
      hpValue: row.hpValue,
      gpValue: row.gpValue,
      isPositive: row.isPositive,
      icon: row.icon,
      isActive: row.isActive,
      competencyId: row.competencyId,
      competencyIndicatorId: row.competencyIndicatorId,
      schoolBehaviorId: row.schoolBehaviorId,
      createdAt: row.createdAt,
      competency: row.competency_id ? {
        id: row.competency_id,
        name: row.competency_name,
        shortName: row.competency_shortName,
        areaId: row.competency_areaId,
      } : null,
      competencyIndicator: row.indicator_id ? {
        id: row.indicator_id,
        name: row.indicator_name,
        description: row.indicator_description,
        competencyId: row.indicator_competencyId,
      } : null,
    };
  }

  private async getBehaviorRows(classroomId: string, isPositive?: boolean) {
    const filters = [
      eq(behaviors.classroomId, classroomId),
      eq(behaviors.isActive, true),
    ];

    if (typeof isPositive === 'boolean') {
      filters.push(eq(behaviors.isPositive, isPositive));
    }

    return db
      .select({
        id: behaviors.id,
        classroomId: behaviors.classroomId,
        name: behaviors.name,
        description: behaviors.description,
        pointType: behaviors.pointType,
        pointValue: behaviors.pointValue,
        xpValue: behaviors.xpValue,
        hpValue: behaviors.hpValue,
        gpValue: behaviors.gpValue,
        isPositive: behaviors.isPositive,
        icon: behaviors.icon,
        isActive: behaviors.isActive,
        competencyId: behaviors.competencyId,
        competencyIndicatorId: behaviors.competencyIndicatorId,
        schoolBehaviorId: behaviors.schoolBehaviorId,
        createdAt: behaviors.createdAt,
        competency_id: curriculumCompetencies.id,
        competency_name: curriculumCompetencies.name,
        competency_shortName: curriculumCompetencies.shortName,
        competency_areaId: curriculumCompetencies.areaId,
        indicator_id: classroomCompetencyIndicators.id,
        indicator_name: classroomCompetencyIndicators.name,
        indicator_description: classroomCompetencyIndicators.description,
        indicator_competencyId: classroomCompetencyIndicators.competencyId,
      })
      .from(behaviors)
      .leftJoin(curriculumCompetencies, eq(behaviors.competencyId, curriculumCompetencies.id))
      .leftJoin(classroomCompetencyIndicators, eq(behaviors.competencyIndicatorId, classroomCompetencyIndicators.id))
      .where(and(...filters));
  }

  // Crear un nuevo comportamiento/preset
  async create(data: CreateBehaviorData) {
    const id = uuidv4();
    const now = new Date();

    // Si se proporcionan valores combinados, usarlos; sino usar legacy
    const xpValue = data.xpValue ?? (data.pointType === 'XP' ? data.pointValue : 0);
    const hpValue = data.hpValue ?? (data.pointType === 'HP' ? data.pointValue : 0);
    const gpValue = data.gpValue ?? (data.pointType === 'GP' ? data.pointValue : 0);
    const assignment = await this.resolveCompetencyAssignment(
      data.classroomId,
      data.competencyId,
      data.competencyIndicatorId,
    );

    await db.insert(behaviors).values({
      id,
      classroomId: data.classroomId,
      name: data.name,
      description: data.description || null,
      pointType: data.pointType,
      pointValue: data.pointValue,
      xpValue,
      hpValue,
      gpValue,
      isPositive: data.isPositive,
      icon: data.icon || null,
      competencyId: assignment.competencyId,
      competencyIndicatorId: assignment.competencyIndicatorId,
      createdAt: now,
    });

    return this.getById(id);
  }

  // Obtener comportamiento por ID
  async getById(id: string) {
    return db.query.behaviors.findFirst({
      where: eq(behaviors.id, id),
    });
  }

  // Obtener todos los comportamientos de una clase
  async getByClassroom(classroomId: string) {
    const rows = await this.getBehaviorRows(classroomId);

    return rows.map((row) => this.buildBehaviorResponse(row));
  }

  // Obtener comportamientos positivos (para agregar puntos)
  async getPositive(classroomId: string) {
    const rows = await this.getBehaviorRows(classroomId, true);

    return rows.map((row) => this.buildBehaviorResponse(row));
  }

  // Obtener comportamientos negativos (para quitar puntos)
  async getNegative(classroomId: string) {
    const rows = await this.getBehaviorRows(classroomId, false);

    return rows.map((row) => this.buildBehaviorResponse(row));
  }

  // Actualizar comportamiento
  async update(id: string, data: Partial<CreateBehaviorData>) {
    const currentBehavior = await this.getById(id);
    if (!currentBehavior) {
      throw new Error('Comportamiento no encontrado');
    }

    const hasCompetencyUpdate = Object.prototype.hasOwnProperty.call(data, 'competencyId');
    const hasIndicatorUpdate = Object.prototype.hasOwnProperty.call(data, 'competencyIndicatorId');
    const payload: Partial<typeof behaviors.$inferInsert> = { ...data };

    if (hasCompetencyUpdate || hasIndicatorUpdate) {
      const assignment = await this.resolveCompetencyAssignment(
        currentBehavior.classroomId,
        hasCompetencyUpdate ? data.competencyId ?? null : currentBehavior.competencyId,
        hasIndicatorUpdate ? data.competencyIndicatorId ?? null : currentBehavior.competencyIndicatorId,
      );

      payload.competencyId = assignment.competencyId;
      payload.competencyIndicatorId = assignment.competencyIndicatorId;
    }

    await db.update(behaviors)
      .set(payload)
      .where(eq(behaviors.id, id));

    return this.getById(id);
  }

  // Eliminar comportamiento (soft delete)
  async delete(id: string) {
    await db.update(behaviors)
      .set({ isActive: false })
      .where(eq(behaviors.id, id));
  }

  // Restaurar un comportamiento eliminado ("Deshacer" del soft delete)
  async restore(id: string) {
    await db.update(behaviors)
      .set({ isActive: true })
      .where(eq(behaviors.id, id));
    return this.getById(id);
  }

  // Uso de los comportamientos activos de una clase en los últimos N días.
  // Una aplicación crea varios logs (alumno × XP/HP/GP) con el mismo created_at,
  // por eso se cuentan instantes distintos y no filas.
  async getUsage(classroomId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        behaviorId: pointLogs.behaviorId,
        uses: sql<number>`count(distinct ${pointLogs.createdAt})`,
        lastUsedAt: sql`max(${pointLogs.createdAt})`.mapWith(pointLogs.createdAt),
      })
      .from(pointLogs)
      .innerJoin(behaviors, eq(behaviors.id, pointLogs.behaviorId))
      .where(and(
        eq(behaviors.classroomId, classroomId),
        eq(behaviors.isActive, true),
        eq(pointLogs.isReverted, false),
        gte(pointLogs.createdAt, since),
      ))
      .groupBy(pointLogs.behaviorId);

    return rows.map((row) => ({
      behaviorId: row.behaviorId as string,
      uses: Number(row.uses),
      lastUsedAt: row.lastUsedAt,
    }));
  }

  // Aplicar comportamiento a múltiples estudiantes
  async applyToStudents(data: ApplyBehaviorData) {
    const behavior = await this.getById(data.behaviorId);
    if (!behavior) {
      throw new Error('Comportamiento no encontrado');
    }

    // Verificar que el profesor tenga acceso a esta clase
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, behavior.classroomId),
    });

    if (!classroom || classroom.teacherId !== data.teacherId) {
      throw new Error('No tienes permiso para aplicar este comportamiento');
    }

    // Obtener los perfiles de estudiantes
    const students = await db.query.studentProfiles.findMany({
      where: and(
        inArray(studentProfiles.id, data.studentIds),
        eq(studentProfiles.classroomId, behavior.classroomId)
      ),
    });

    if (students.length === 0) {
      throw new Error('No se encontraron estudiantes válidos');
    }

    const now = new Date();
    const results: { studentId: string; studentName: string; pointLogEntryId?: string | null; xpChange: number; hpChange: number; gpChange: number; newXp: number; newHp: number; newGp: number; leveledUp?: boolean; newLevel?: number }[] = [];
    const levelUps: { studentId: string; studentName: string; newLevel: number }[] = [];
    const xpPerLevel = classroom.xpPerLevel || 100;

    // Usar valores combinados, con fallback a legacy
    const multiplier = data.multiplier ?? 1;
    const roundPoints = (value: number) => value > 0 ? Math.max(1, Math.round(value * multiplier)) : 0;
    const baseXpChange = behavior.xpValue ?? (behavior.pointType === 'XP' ? behavior.pointValue : 0);
    const baseHpChange = behavior.hpValue ?? (behavior.pointType === 'HP' ? behavior.pointValue : 0);
    const baseGpChange = behavior.gpValue ?? (behavior.pointType === 'GP' ? behavior.pointValue : 0);
    const xpChange = roundPoints(baseXpChange);
    const hpChange = roundPoints(baseHpChange);
    const gpChange = roundPoints(baseGpChange);
    const multiplierValue = Math.round(multiplier * 1000);

    // Preparar datos para batch inserts
    const pointLogsBatch: typeof pointLogs.$inferInsert[] = [];
    const notificationsBatch: typeof notifications.$inferInsert[] = [];
    // Deltas por alumno: se aplican de forma atómica (ver utils/points.ts). Los valores
    // calculados abajo solo alimentan avisos y la respuesta.
    const signedDeltas = behavior.isPositive
      ? { xp: xpChange, hp: hpChange, gp: gpChange }
      : { xp: -xpChange, hp: -hpChange, gp: -gpChange };
    const pointRules = {
      xpPerLevel,
      hpMin: classroom.allowNegativeHp ? null : 0,
      hpMax: classroom.maxHp,
    };
    const studentUpdates: { studentId: string }[] = [];
    const xpAwardsForSideEffects: { studentId: string; xpAmount: number }[] = [];

    // Calcular nuevos valores para cada estudiante
    for (const student of students) {
      let newXp = student.xp;
      let newHp = student.hp;
      let newGp = student.gp;
      let leveledUp = false;
      let newLevel = student.level;
      let pointLogEntryId: string | null = null;

      // Aplicar cambios según si es positivo o negativo
      if (behavior.isPositive) {
        newXp += xpChange;
        newHp = Math.min(newHp + hpChange, classroom.maxHp); // HP no puede exceder máximo
        newGp += gpChange;
      } else {
        newXp -= xpChange;
        newHp = classroom.allowNegativeHp ? newHp - hpChange : Math.max(0, newHp - hpChange);
        newGp -= gpChange;
      }

      // Verificar nivel (solo si hay cambio de XP positivo)
      if (xpChange > 0 && behavior.isPositive) {
        newLevel = this.calculateLevel(newXp, xpPerLevel);
        if (newLevel > student.level) {
          leveledUp = true;
          levelUps.push({
            studentId: student.id,
            studentName: student.characterName || 'Estudiante',
            newLevel,
          });
        }
      }

      studentUpdates.push({ studentId: student.id });

      // Contribuir XP al clan y procesar storytelling después del commit
      if (behavior.isPositive && xpChange > 0) {
        xpAwardsForSideEffects.push({
          studentId: student.id,
          xpAmount: xpChange,
        });
      }

      // Preparar logs para cada tipo de punto que cambió
      if (xpChange > 0) {
        const logId = uuidv4();
        if (!pointLogEntryId) pointLogEntryId = logId;
        pointLogsBatch.push({
          id: logId,
          studentId: student.id,
          behaviorId: behavior.id,
          competencyId: behavior.competencyId || null,
          competencyIndicatorId: behavior.competencyIndicatorId || null,
          pointType: 'XP',
          action: behavior.isPositive ? 'ADD' : 'REMOVE',
          amount: xpChange,
          baseAmount: baseXpChange,
          multiplier: multiplierValue,
          reason: behavior.name,
          givenBy: data.teacherId,
          createdAt: now,
        });
      }
      if (hpChange > 0) {
        const logId = uuidv4();
        if (!pointLogEntryId) pointLogEntryId = logId;
        pointLogsBatch.push({
          id: logId,
          studentId: student.id,
          behaviorId: behavior.id,
          competencyId: behavior.competencyId || null,
          competencyIndicatorId: behavior.competencyIndicatorId || null,
          pointType: 'HP',
          action: behavior.isPositive ? 'ADD' : 'REMOVE',
          amount: hpChange,
          baseAmount: baseHpChange,
          multiplier: multiplierValue,
          reason: behavior.name,
          givenBy: data.teacherId,
          createdAt: now,
        });
      }
      if (gpChange > 0) {
        const logId = uuidv4();
        if (!pointLogEntryId) pointLogEntryId = logId;
        pointLogsBatch.push({
          id: logId,
          studentId: student.id,
          behaviorId: behavior.id,
          competencyId: behavior.competencyId || null,
          competencyIndicatorId: behavior.competencyIndicatorId || null,
          pointType: 'GP',
          action: behavior.isPositive ? 'ADD' : 'REMOVE',
          amount: gpChange,
          baseAmount: baseGpChange,
          multiplier: multiplierValue,
          reason: behavior.name,
          givenBy: data.teacherId,
          createdAt: now,
        });
      }

      // Preparar notificaciones para batch (solo si el estudiante tiene userId vinculado)
      if (classroom.notifyOnPoints && student.userId) {
        const actionText = behavior.isPositive ? 'recibiste' : 'perdiste';
        const parts: string[] = [];
        if (xpChange > 0) parts.push(`⚡${xpChange} XP`);
        if (hpChange > 0) parts.push(`❤️${hpChange} HP`);
        if (gpChange > 0) parts.push(`🪙${gpChange} Oro`);
        
        const pointsText = parts.join(', ');
        
        notificationsBatch.push({
          id: uuidv4(),
          userId: student.userId,
          type: 'POINTS',
          title: behavior.isPositive ? '¡Puntos recibidos!' : 'Puntos perdidos',
          message: classroom.showReasonToStudent 
            ? `${actionText} ${pointsText} por: ${behavior.name}`
            : `${actionText} ${pointsText}`,
          isRead: false,
          createdAt: now,
        });

        if (leveledUp) {
          // Notificación para el estudiante
          notificationsBatch.push({
            id: uuidv4(),
            userId: student.userId,
            type: 'LEVEL_UP',
            title: '🎉 ¡Subiste de nivel!',
            message: `¡Felicidades! Has alcanzado el nivel ${newLevel}`,
            isRead: false,
            createdAt: now,
          });
        }
      }
      
      // Notificación de level up para el profesor (siempre, independiente del userId del estudiante)
      if (classroom.notifyOnPoints && leveledUp) {
        notificationsBatch.push({
          id: uuidv4(),
          userId: data.teacherId,
          classroomId: behavior.classroomId,
          type: 'LEVEL_UP',
          title: '🎉 ¡Estudiante subió de nivel!',
          message: `${student.characterName || 'Un estudiante'} ha alcanzado el nivel ${newLevel}`,
          isRead: false,
          createdAt: now,
        });
      }

      results.push({ 
        studentId: student.id, 
        studentName: student.characterName || 'Estudiante',
        pointLogEntryId,
        xpChange: behavior.isPositive ? xpChange : -xpChange,
        hpChange: behavior.isPositive ? hpChange : -hpChange,
        gpChange: behavior.isPositive ? gpChange : -gpChange,
        newXp,
        newHp,
        newGp,
        leveledUp,
        newLevel: leveledUp ? newLevel : undefined,
      });
    }

    const notifTx = prepareForTx(notificationsBatch);

    await db.transaction(async (tx) => {
      // Mismos deltas para todos: una sentencia en vez de 2-3 idas y vueltas por alumno.
      await applyPointDeltasBulk(tx, studentUpdates.map((u) => u.studentId), signedDeltas, pointRules);

      if (pointLogsBatch.length > 0) {
        await tx.insert(pointLogs).values(pointLogsBatch);
      }

      if (notifTx.entries.length > 0) {
        await tx.insert(notifications).values(notifTx.entries);
      }
    });

    await notifTx.emitAfterCommit();

    // Side effects externos: ejecutar solo después de confirmar cambios de puntos.
    // Clan: solo alumnos con clan y si la clase tiene clanes (en otro caso la función no hace nada).
    const teamByStudent = new Map(students.map((s) => [s.id, s.teamId]));
    for (const xpAward of xpAwardsForSideEffects) {
      if (!classroom.clansEnabled || !teamByStudent.get(xpAward.studentId)) continue;
      try {
        await clanService.contributeXpToClan(xpAward.studentId, xpAward.xpAmount, behavior.name);
      } catch (error) {
        // Silently fail - don't break behavior application
      }
    }

    // Historia: la historia activa de la clase se consulta una vez para todos los alumnos.
    if (xpAwardsForSideEffects.length > 0) {
      try {
        await storyService.onXpAwardedBatch(
          behavior.classroomId,
          xpAwardsForSideEffects.map((a) => ({ studentProfileId: a.studentId, xpAmount: a.xpAmount }))
        );
      } catch (error) {
        // Silently fail - don't break behavior application
      }
    }

    // Verificar insignias: las de la clase se cargan una vez; sin insignias automáticas no hay nada que comprobar.
    const awardedBadges: { studentId: string; badges: string[] }[] = [];
    const classroomBadges = await badgeService.getClassroomBadges(behavior.classroomId);
    const hasAutomaticBadges = classroomBadges.some(
      (b) => (b.assignmentMode === 'AUTOMATIC' || b.assignmentMode === 'BOTH') && b.unlockCondition !== null
    );
    const badgeCounts = hasAutomaticBadges
      ? await badgeService.getBadgeCountsForStudents(students.map((s) => s.id))
      : new Map<string, Map<string, number>>();
    for (const student of hasAutomaticBadges ? students : []) {
      try {
        const earnedBadges = await badgeService.checkAndAwardBadges({
          type: 'BEHAVIOR_APPLIED',
          data: {
            studentProfileId: student.id,
            classroomId: behavior.classroomId,
            behaviorId: behavior.id,
            behaviorType: behavior.isPositive ? 'positive' : 'negative',
          },
        }, classroomBadges, badgeCounts.get(student.id) ?? new Map());
        if (earnedBadges.length > 0) {
          awardedBadges.push({
            studentId: student.id,
            badges: earnedBadges.map(b => b.name),
          });
        }
      } catch (error) {
        console.error('Error checking badges for student:', student.id, error);
      }
    }

    return {
      behavior,
      studentsAffected: results.length,
      results,
      levelUps,
      awardedBadges,
    };
  }

  // Exportar comportamientos a otras clases del mismo profesor
  async exportBehaviors(
    behaviorIds: string[],
    targetClassroomIds: string[],
    teacherId: string,
  ) {
    if (behaviorIds.length === 0 || targetClassroomIds.length === 0) {
      throw new Error('Se requieren comportamientos y clases destino');
    }

    // 1. Obtener los comportamientos a exportar
    const sourceBehaviors = await db.query.behaviors.findMany({
      where: and(
        inArray(behaviors.id, behaviorIds),
        eq(behaviors.isActive, true),
      ),
    });

    if (sourceBehaviors.length === 0) {
      throw new Error('No se encontraron comportamientos válidos');
    }

    // 2. Verificar que todos los comportamientos pertenecen a una clase del profesor
    const sourceClassroomId = sourceBehaviors[0].classroomId;
    const sourceClassroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, sourceClassroomId),
    });

    if (!sourceClassroom || sourceClassroom.teacherId !== teacherId) {
      throw new Error('No tienes permiso para exportar estos comportamientos');
    }

    // Verificar que todos son de la misma clase
    const allSameClass = sourceBehaviors.every(b => b.classroomId === sourceClassroomId);
    if (!allSameClass) {
      throw new Error('Todos los comportamientos deben pertenecer a la misma clase');
    }

    // 3. Obtener clases destino y verificar propiedad
    const targetClassrooms = await db.query.classrooms.findMany({
      where: and(
        inArray(classrooms.id, targetClassroomIds),
        eq(classrooms.teacherId, teacherId),
      ),
    });

    if (targetClassrooms.length === 0) {
      throw new Error('No se encontraron clases destino válidas');
    }

    // Excluir la clase origen si la enviaron por error
    const validTargets = targetClassrooms.filter(c => c.id !== sourceClassroomId);
    if (validTargets.length === 0) {
      throw new Error('No puedes exportar a la misma clase origen');
    }

    // 4. Obtener competencias habilitadas en cada clase destino
    const targetIds = validTargets.map(c => c.id);
    const targetCompetencies = await db.query.classroomCompetencies.findMany({
      where: and(
        inArray(classroomCompetencies.classroomId, targetIds),
        eq(classroomCompetencies.isActive, true),
      ),
    });

    // Agrupar competencyIds por classroomId
    const competenciesByClassroom = new Map<string, Set<string>>();
    for (const tc of targetCompetencies) {
      if (!competenciesByClassroom.has(tc.classroomId)) {
        competenciesByClassroom.set(tc.classroomId, new Set());
      }
      competenciesByClassroom.get(tc.classroomId)!.add(tc.competencyId);
    }

    // 5. Clonar comportamientos
    const now = new Date();
    const insertBatch: (typeof behaviors.$inferInsert)[] = [];
    let totalCreated = 0;

    for (const target of validTargets) {
      const enabledCompetencies = competenciesByClassroom.get(target.id) || new Set<string>();

      for (const src of sourceBehaviors) {
        const competencyId = src.competencyId && enabledCompetencies.has(src.competencyId)
          ? src.competencyId
          : null;

        insertBatch.push({
          id: uuidv4(),
          classroomId: target.id,
          name: src.name,
          description: src.description,
          pointType: src.pointType,
          pointValue: src.pointValue,
          xpValue: src.xpValue,
          hpValue: src.hpValue,
          gpValue: src.gpValue,
          isPositive: src.isPositive,
          icon: src.icon,
          isActive: true,
          competencyId,
          competencyIndicatorId: null,
          createdAt: now,
        });
        totalCreated++;
      }
    }

    // Insert en batch (chunks de 50 para evitar problemas con queries muy grandes)
    const CHUNK_SIZE = 50;
    for (let i = 0; i < insertBatch.length; i += CHUNK_SIZE) {
      const chunk = insertBatch.slice(i, i + CHUNK_SIZE);
      await db.insert(behaviors).values(chunk);
    }

    return {
      exported: totalCreated,
      targetClassrooms: validTargets.length,
      behaviors: sourceBehaviors.length,
    };
  }

  // Calcular nivel basado en XP y xpPerLevel configurado
  // Sistema progresivo: nivel N requiere N * xpPerLevel para subir al siguiente
  private calculateLevel(xp: number, xpPerLevel: number = 100): number {
    const level = Math.floor((1 + Math.sqrt(1 + (8 * xp) / xpPerLevel)) / 2);
    return Math.max(1, level);
  }
}

export const behaviorService = new BehaviorService();
