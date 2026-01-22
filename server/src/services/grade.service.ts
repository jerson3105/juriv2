import { db } from '../db/index.js';
import {
  studentGrades,
  studentProfiles,
  classrooms,
  classroomCompetencies,
  activityCompetencies,
  curriculumCompetencies,
  behaviors,
  badges,
  studentMissions,
  missions,
  timedActivityResults,
  timedActivities,
  tournamentParticipants,
  tournaments,
  expeditionStudentProgress,
  expeditions,
  pointLogs,
  studentBadges,
  type GradeScaleType,
} from '../db/schema.js';
import { eq, and, inArray, sql, gte, lte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Escalas de calificación predefinidas
// Rangos Perú: AD (90-100), A (70-89), B (50-69), C (0-49)
const GRADE_SCALES: Record<string, Array<{ label: string; minPercent: number }>> = {
  PERU_LETTERS: [
    { label: 'AD', minPercent: 90 },
    { label: 'A', minPercent: 70 },
    { label: 'B', minPercent: 50 },
    { label: 'C', minPercent: 0 },
  ],
  PERU_VIGESIMAL: [
    { label: '20', minPercent: 95 },
    { label: '18', minPercent: 85 },
    { label: '16', minPercent: 75 },
    { label: '14', minPercent: 65 },
    { label: '12', minPercent: 55 },
    { label: '10', minPercent: 45 },
    { label: '08', minPercent: 35 },
    { label: '05', minPercent: 20 },
    { label: '00', minPercent: 0 },
  ],
  USA_LETTERS: [
    { label: 'A', minPercent: 90 },
    { label: 'B', minPercent: 80 },
    { label: 'C', minPercent: 70 },
    { label: 'D', minPercent: 60 },
    { label: 'F', minPercent: 0 },
  ],
};

interface ActivityScoreData {
  type: string;
  id: string;
  name: string;
  score: number;
  weight: number;
  competencyId: string;
}

interface GradeCalculationResult {
  competencyId: string;
  competencyName: string;
  score: number;
  gradeLabel: string;
  activitiesCount: number;
  activities: ActivityScoreData[];
}

// Interfaz para el rango de fechas del bimestre
interface BimesterDateRange {
  startDate: Date;
  endDate: Date;
}

class GradeService {

  /**
   * Calcula las fechas de inicio y fin de un bimestre basado en los cierres registrados
   */
  private async getBimesterDateRange(
    classroomId: string,
    period: string
  ): Promise<BimesterDateRange> {
    const [classroom] = await db.select({
      closedBimesters: classrooms.closedBimesters,
      createdAt: classrooms.createdAt,
    }).from(classrooms).where(eq(classrooms.id, classroomId));

    // Parse closedBimesters
    let closedBimesters: any[] = [];
    if (classroom?.closedBimesters) {
      if (typeof classroom.closedBimesters === 'string') {
        try { closedBimesters = JSON.parse(classroom.closedBimesters); } catch { closedBimesters = []; }
      } else if (Array.isArray(classroom.closedBimesters)) {
        closedBimesters = classroom.closedBimesters;
      }
    }

    // Ordenar bimestres cerrados por fecha
    closedBimesters.sort((a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime());

    // Extraer año y número de bimestre del período (ej: "2026-B2" -> year=2026, bimNum=2)
    const [yearStr, bimPart] = period.split('-B');
    const year = parseInt(yearStr);
    const bimNum = parseInt(bimPart);

    // Fecha de inicio: es la fecha de cierre del bimestre anterior, o la fecha de creación de la clase
    let startDate: Date;
    if (bimNum === 1) {
      // Para B1, buscar si existe B4 del año anterior cerrado
      const prevBim = closedBimesters.find(cb => cb.period === `${year - 1}-B4`);
      startDate = prevBim ? new Date(prevBim.closedAt) : new Date(classroom?.createdAt || '2020-01-01');
    } else {
      // Para B2, B3, B4, buscar el bimestre anterior del mismo año
      const prevBim = closedBimesters.find(cb => cb.period === `${year}-B${bimNum - 1}`);
      startDate = prevBim ? new Date(prevBim.closedAt) : new Date(classroom?.createdAt || '2020-01-01');
    }

    // Fecha de fin: es la fecha de cierre de este bimestre, o la fecha actual si está abierto
    const thisBim = closedBimesters.find(cb => cb.period === period);
    const endDate = thisBim ? new Date(thisBim.closedAt) : new Date();

    return { startDate, endDate };
  }

  /**
   * Verifica si un período es futuro (no se puede calcular)
   */
  private async isFuturePeriod(classroomId: string, period: string): Promise<boolean> {
    const [classroom] = await db.select({
      currentBimester: classrooms.currentBimester,
    }).from(classrooms).where(eq(classrooms.id, classroomId));

    if (!classroom) return true;

    const currentBimester = classroom.currentBimester || `${new Date().getFullYear()}-B1`;
    
    // Comparar períodos
    const [currentYear, currentBim] = currentBimester.split('-B').map((p, i) => i === 0 ? parseInt(p) : parseInt(p));
    const [periodYear, periodBim] = period.split('-B').map((p, i) => i === 0 ? parseInt(p) : parseInt(p));

    // Es futuro si el año es mayor, o si es el mismo año pero el bimestre es mayor
    if (periodYear > currentYear) return true;
    if (periodYear === currentYear && periodBim > currentBim) return true;

    return false;
  }
  
  /**
   * Calcula y guarda las calificaciones de un estudiante para todas sus competencias
   */
  async calculateStudentGrades(
    classroomId: string,
    studentProfileId: string,
    period: string = 'CURRENT'
  ): Promise<GradeCalculationResult[]> {
    // 1. Obtener la clase y verificar que use competencias
    const [classroom] = await db.select().from(classrooms).where(eq(classrooms.id, classroomId));
    if (!classroom) {
      return [];
    }
    if (!classroom.useCompetencies) {
      return [];
    }

    // 1.5. Validar que no sea un bimestre futuro
    if (await this.isFuturePeriod(classroomId, period)) {
      throw new Error('No se pueden calcular calificaciones de un bimestre futuro');
    }

    // 1.6. Obtener el rango de fechas del bimestre
    const dateRange = await this.getBimesterDateRange(classroomId, period);

    // 2. Obtener competencias de la clase
    const classCompetencies = await db.select({
      id: classroomCompetencies.id,
      competencyId: classroomCompetencies.competencyId,
      weight: classroomCompetencies.weight,
      competencyName: curriculumCompetencies.name,
    })
    .from(classroomCompetencies)
    .leftJoin(curriculumCompetencies, eq(classroomCompetencies.competencyId, curriculumCompetencies.id))
    .where(and(
      eq(classroomCompetencies.classroomId, classroomId),
      eq(classroomCompetencies.isActive, true)
    ));

    if (classCompetencies.length === 0) {
      return [];
    }

    const results: GradeCalculationResult[] = [];
    const now = new Date();

    // 3. Para cada competencia, calcular el puntaje
    for (const comp of classCompetencies) {
      const activities = await this.getStudentActivityScores(
        studentProfileId,
        comp.competencyId,
        classroomId,
        dateRange
      );

      // Calcular promedio ponderado
      let totalWeightedScore = 0;
      let totalWeight = 0;

      for (const activity of activities) {
        totalWeightedScore += activity.score * activity.weight;
        totalWeight += activity.weight;
      }

      const rawScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
      const gradeLabel = this.convertToGradeLabel(rawScore, classroom.gradeScaleType, classroom.gradeScaleConfig);

      // 4. Guardar o actualizar la calificación
      const existingGrade = await db.select()
        .from(studentGrades)
        .where(and(
          eq(studentGrades.studentProfileId, studentProfileId),
          eq(studentGrades.competencyId, comp.competencyId),
          eq(studentGrades.period, period)
        ));

      const calculationDetails = {
        activities: activities.map(a => ({
          type: a.type,
          id: a.id,
          name: a.name,
          score: a.score,
          weight: a.weight,
        })),
        totalWeight,
        rawScore,
      };

      const gradeData = {
        classroomId,
        studentProfileId,
        competencyId: comp.competencyId,
        period,
        score: rawScore.toFixed(2),
        gradeLabel,
        calculationDetails,
        activitiesCount: activities.length,
        calculatedAt: now,
        updatedAt: now,
      };

      if (existingGrade.length > 0) {
        if (!existingGrade[0].isManualOverride) {
          await db.update(studentGrades)
            .set(gradeData)
            .where(eq(studentGrades.id, existingGrade[0].id));
        }
      } else {
        await db.insert(studentGrades).values({
          id: uuidv4(),
          ...gradeData,
        });
      }

      results.push({
        competencyId: comp.competencyId,
        competencyName: comp.competencyName || '',
        score: rawScore,
        gradeLabel,
        activitiesCount: activities.length,
        activities,
      });
    }

    return results;
  }

  /**
   * Obtiene los puntajes de actividades de un estudiante para una competencia
   */
  private async getStudentActivityScores(
    studentProfileId: string,
    competencyId: string,
    classroomId: string,
    dateRange: BimesterDateRange
  ): Promise<ActivityScoreData[]> {
    const scores: ActivityScoreData[] = [];

    // 1. Misiones completadas
    const missionScores = await this.getMissionScores(studentProfileId, competencyId, dateRange);
    scores.push(...missionScores);

    // 2. Actividades temporizadas
    const timedScores = await this.getTimedActivityScores(studentProfileId, competencyId, dateRange);
    scores.push(...timedScores);

    // 3. Torneos
    const tournamentScores = await this.getTournamentScores(studentProfileId, competencyId, dateRange);
    scores.push(...tournamentScores);

    // 4. Expediciones
    const expeditionScores = await this.getExpeditionScores(studentProfileId, competencyId, dateRange);
    scores.push(...expeditionScores);

    // 5. Comportamientos positivos
    const behaviorScores = await this.getBehaviorScores(studentProfileId, competencyId, classroomId, dateRange);
    scores.push(...behaviorScores);

    // 6. Insignias
    const badgeScores = await this.getBadgeScores(studentProfileId, competencyId, classroomId, dateRange);
    scores.push(...badgeScores);

    return scores;
  }

  private async getMissionScores(studentProfileId: string, competencyId: string, dateRange: BimesterDateRange): Promise<ActivityScoreData[]> {
    const scores: ActivityScoreData[] = [];

    const missionCompetencies = await db.select({
      activityId: activityCompetencies.activityId,
      weight: activityCompetencies.weight,
    })
    .from(activityCompetencies)
    .where(and(
      eq(activityCompetencies.activityType, 'MISSION'),
      eq(activityCompetencies.competencyId, competencyId)
    ));

    if (missionCompetencies.length === 0) return scores;
    const missionIds = missionCompetencies.map(m => m.activityId);

    const completedMissions = await db.select({
      missionId: studentMissions.missionId,
      status: studentMissions.status,
      currentProgress: studentMissions.currentProgress,
      targetProgress: studentMissions.targetProgress,
      missionName: missions.name,
      completedAt: studentMissions.completedAt,
    })
    .from(studentMissions)
    .leftJoin(missions, eq(studentMissions.missionId, missions.id))
    .where(and(
      eq(studentMissions.studentProfileId, studentProfileId),
      inArray(studentMissions.missionId, missionIds),
      gte(studentMissions.assignedAt, dateRange.startDate),
      lte(studentMissions.assignedAt, dateRange.endDate)
    ));

    for (const cm of completedMissions) {
      const missionComp = missionCompetencies.find(m => m.activityId === cm.missionId);
      const progress = cm.currentProgress || 0;
      const target = cm.targetProgress || 1;
      const percentage = Math.min(100, (progress / target) * 100);

      if (cm.status === 'COMPLETED' || percentage >= 50) {
        scores.push({
          type: 'MISSION',
          id: cm.missionId,
          name: cm.missionName || 'Misión',
          score: cm.status === 'COMPLETED' ? 100 : percentage,
          weight: missionComp?.weight || 100,
          competencyId,
        });
      }
    }

    return scores;
  }

  private async getTimedActivityScores(studentProfileId: string, competencyId: string, dateRange: BimesterDateRange): Promise<ActivityScoreData[]> {
    const scores: ActivityScoreData[] = [];

    const timedCompetencies = await db.select({
      activityId: activityCompetencies.activityId,
      weight: activityCompetencies.weight,
    })
    .from(activityCompetencies)
    .where(and(
      eq(activityCompetencies.activityType, 'TIMED'),
      eq(activityCompetencies.competencyId, competencyId)
    ));

    if (timedCompetencies.length === 0) return scores;
    const timedIds = timedCompetencies.map(t => t.activityId);

    const completedTimed = await db.select({
      activityId: timedActivityResults.activityId,
      completedAt: timedActivityResults.completedAt,
      pointsAwarded: timedActivityResults.pointsAwarded,
      activityName: timedActivities.name,
      basePoints: timedActivities.basePoints,
    })
    .from(timedActivityResults)
    .leftJoin(timedActivities, eq(timedActivityResults.activityId, timedActivities.id))
    .where(and(
      eq(timedActivityResults.studentProfileId, studentProfileId),
      inArray(timedActivityResults.activityId, timedIds),
      gte(timedActivityResults.createdAt, dateRange.startDate),
      lte(timedActivityResults.createdAt, dateRange.endDate)
    ));

    for (const ct of completedTimed) {
      const timedComp = timedCompetencies.find(t => t.activityId === ct.activityId);
      
      if (ct.completedAt) {
        // Actividad completada exitosamente
        const basePoints = ct.basePoints || 10;
        const earnedPoints = ct.pointsAwarded || 0;
        const percentage = Math.min(100, (earnedPoints / basePoints) * 100);

        scores.push({
          type: 'TIMED',
          id: ct.activityId,
          name: ct.activityName || 'Actividad',
          score: Math.max(percentage, 70),
          weight: timedComp?.weight || 100,
          competencyId,
        });
      } else {
        // Actividad intentada pero no completada (perdida) - cuenta con 30% por participar
        scores.push({
          type: 'TIMED',
          id: ct.activityId,
          name: `${ct.activityName || 'Actividad'} (no completada)`,
          score: 30, // Mínimo por participar
          weight: timedComp?.weight || 100,
          competencyId,
        });
      }
    }

    return scores;
  }

  private async getTournamentScores(studentProfileId: string, competencyId: string, dateRange: BimesterDateRange): Promise<ActivityScoreData[]> {
    const scores: ActivityScoreData[] = [];

    const tournamentCompetencies = await db.select({
      activityId: activityCompetencies.activityId,
      weight: activityCompetencies.weight,
    })
    .from(activityCompetencies)
    .where(and(
      eq(activityCompetencies.activityType, 'TOURNAMENT'),
      eq(activityCompetencies.competencyId, competencyId)
    ));

    if (tournamentCompetencies.length === 0) return scores;
    const tournamentIds = tournamentCompetencies.map(t => t.activityId);

    const participations = await db.select({
      tournamentId: tournamentParticipants.tournamentId,
      finalPosition: tournamentParticipants.finalPosition,
      totalPoints: tournamentParticipants.totalPoints,
      tournamentName: tournaments.name,
      maxParticipants: tournaments.maxParticipants,
    })
    .from(tournamentParticipants)
    .leftJoin(tournaments, eq(tournamentParticipants.tournamentId, tournaments.id))
    .where(and(
      eq(tournamentParticipants.studentProfileId, studentProfileId),
      inArray(tournamentParticipants.tournamentId, tournamentIds),
      gte(tournamentParticipants.joinedAt, dateRange.startDate),
      lte(tournamentParticipants.joinedAt, dateRange.endDate)
    ));

    for (const p of participations) {
      const tournComp = tournamentCompetencies.find(t => t.activityId === p.tournamentId);
      const maxPos = p.maxParticipants || 8;
      const position = p.finalPosition || maxPos;
      const positionScore = 100 - ((position - 1) / Math.max(1, maxPos - 1)) * 50;

      scores.push({
        type: 'TOURNAMENT',
        id: p.tournamentId,
        name: p.tournamentName || 'Torneo',
        score: Math.max(50, positionScore),
        weight: tournComp?.weight || 100,
        competencyId,
      });
    }

    return scores;
  }

  private async getExpeditionScores(studentProfileId: string, competencyId: string, dateRange: BimesterDateRange): Promise<ActivityScoreData[]> {
    const scores: ActivityScoreData[] = [];

    const expeditionCompetencies = await db.select({
      activityId: activityCompetencies.activityId,
      weight: activityCompetencies.weight,
    })
    .from(activityCompetencies)
    .where(and(
      eq(activityCompetencies.activityType, 'EXPEDITION'),
      eq(activityCompetencies.competencyId, competencyId)
    ));

    if (expeditionCompetencies.length === 0) return scores;
    const expeditionIds = expeditionCompetencies.map(e => e.activityId);

    const progress = await db.select({
      expeditionId: expeditionStudentProgress.expeditionId,
      isCompleted: expeditionStudentProgress.isCompleted,
      completedAt: expeditionStudentProgress.completedAt,
      expeditionName: expeditions.name,
    })
    .from(expeditionStudentProgress)
    .leftJoin(expeditions, eq(expeditionStudentProgress.expeditionId, expeditions.id))
    .where(and(
      eq(expeditionStudentProgress.studentProfileId, studentProfileId),
      inArray(expeditionStudentProgress.expeditionId, expeditionIds),
      gte(expeditionStudentProgress.updatedAt, dateRange.startDate),
      lte(expeditionStudentProgress.updatedAt, dateRange.endDate)
    ));

    for (const ep of progress) {
      const expComp = expeditionCompetencies.find(e => e.activityId === ep.expeditionId);
      
      // Si está completada = 100%, si está en progreso = 60%
      const score = ep.isCompleted ? 100 : 60;

      scores.push({
        type: 'EXPEDITION',
        id: ep.expeditionId,
        name: ep.expeditionName || 'Expedición',
        score,
        weight: expComp?.weight || 100,
        competencyId,
      });
    }

    return scores;
  }

  private async getBehaviorScores(studentProfileId: string, competencyId: string, classroomId: string, dateRange: BimesterDateRange): Promise<ActivityScoreData[]> {
    const scores: ActivityScoreData[] = [];

    // Obtener TODOS los comportamientos de la competencia (positivos y negativos)
    const competencyBehaviors = await db.select()
      .from(behaviors)
      .where(and(
        eq(behaviors.classroomId, classroomId),
        eq(behaviors.competencyId, competencyId),
        eq(behaviors.isActive, true)
      ));

    if (competencyBehaviors.length === 0) return scores;

    // Calcular score neto basado en comportamientos positivos y negativos
    let totalPositiveXP = 0;
    let totalNegativeXP = 0;
    let hasAnyBehavior = false;
    const behaviorDetails: Array<{ name: string; count: number; xp: number; isPositive: boolean }> = [];

    for (const behavior of competencyBehaviors) {
      const logs = await db.select({ count: sql<number>`COUNT(*)` })
        .from(pointLogs)
        .where(and(
          eq(pointLogs.studentId, studentProfileId),
          eq(pointLogs.behaviorId, behavior.id),
          gte(pointLogs.createdAt, dateRange.startDate),
          lte(pointLogs.createdAt, dateRange.endDate)
        ));

      const count = Number(logs[0]?.count) || 0;
      if (count > 0) {
        hasAnyBehavior = true;
        const behaviorXP = Math.abs(behavior.xpValue || 0);
        const totalXPFromBehavior = count * behaviorXP;

        behaviorDetails.push({
          name: behavior.name,
          count,
          xp: totalXPFromBehavior,
          isPositive: behavior.isPositive ?? true,
        });

        if (behavior.isPositive) {
          totalPositiveXP += totalXPFromBehavior;
        } else {
          totalNegativeXP += totalXPFromBehavior;
        }
      }
    }

    if (hasAnyBehavior) {
      const totalXP = totalPositiveXP + totalNegativeXP;
      
      let scorePercent: number;
      if (totalNegativeXP === 0) {
        scorePercent = 100;
      } else if (totalPositiveXP === 0) {
        scorePercent = 0;
      } else {
        scorePercent = (totalPositiveXP / totalXP) * 100;
      }

      const dynamicWeight = Math.min(100, Math.max(30, Math.round(totalXP / 10)));

      // Crear nombre descriptivo con los comportamientos individuales
      const detailsText = behaviorDetails
        .map(b => `${b.isPositive ? '✓' : '✗'} ${b.name} (x${b.count})`)
        .join(', ');

      scores.push({
        type: 'BEHAVIOR',
        id: 'behavior-aggregate',
        name: `Comportamientos (+${totalPositiveXP} / -${totalNegativeXP}): ${detailsText}`,
        score: Math.round(scorePercent),
        weight: dynamicWeight,
        competencyId,
      });
    }

    return scores;
  }

  private async getBadgeScores(studentProfileId: string, competencyId: string, classroomId: string, dateRange: BimesterDateRange): Promise<ActivityScoreData[]> {
    const scores: ActivityScoreData[] = [];

    const competencyBadges = await db.select()
      .from(badges)
      .where(and(
        eq(badges.classroomId, classroomId),
        eq(badges.competencyId, competencyId),
        eq(badges.isActive, true)
      ));

    if (competencyBadges.length === 0) return scores;
    const badgeIds = competencyBadges.map(b => b.id);

    const earnedBadges = await db.select({
      badgeId: studentBadges.badgeId,
      badgeName: badges.name,
      rarity: badges.rarity,
    })
    .from(studentBadges)
    .leftJoin(badges, eq(studentBadges.badgeId, badges.id))
    .where(and(
      eq(studentBadges.studentProfileId, studentProfileId),
      inArray(studentBadges.badgeId, badgeIds),
      gte(studentBadges.unlockedAt, dateRange.startDate),
      lte(studentBadges.unlockedAt, dateRange.endDate)
    ));

    for (const eb of earnedBadges) {
      const weight = eb.rarity === 'LEGENDARY' ? 100 : 
                     eb.rarity === 'EPIC' ? 80 :
                     eb.rarity === 'RARE' ? 60 : 40;

      scores.push({
        type: 'BADGE',
        id: eb.badgeId,
        name: eb.badgeName || 'Insignia',
        score: 100,
        weight,
        competencyId,
      });
    }

    return scores;
  }

  private convertToGradeLabel(score: number, scaleType: GradeScaleType | null, customConfig: any): string {
    if (!scaleType) return score.toFixed(0);

    if (scaleType === 'CENTESIMAL') {
      return Math.round(score).toString();
    }

    if (scaleType === 'CUSTOM' && customConfig?.ranges) {
      const ranges = [...customConfig.ranges].sort((a: any, b: any) => b.minPercent - a.minPercent);
      for (const range of ranges) {
        if (score >= range.minPercent) {
          return range.label;
        }
      }
      return ranges[ranges.length - 1]?.label || 'N/A';
    }

    const scale = GRADE_SCALES[scaleType];
    if (scale && scale.length > 0) {
      for (const range of scale) {
        if (score >= range.minPercent) {
          return range.label;
        }
      }
      return scale[scale.length - 1]?.label || 'N/A';
    }

    return score.toFixed(0);
  }

  // ═══════════════════════════════════════════════════════════
  // CONSULTAS
  // ═══════════════════════════════════════════════════════════

  async getStudentGrades(studentProfileId: string, period: string = 'CURRENT') {
    return db.select({
      id: studentGrades.id,
      competencyId: studentGrades.competencyId,
      competencyName: curriculumCompetencies.name,
      score: studentGrades.score,
      gradeLabel: studentGrades.gradeLabel,
      activitiesCount: studentGrades.activitiesCount,
      calculationDetails: studentGrades.calculationDetails,
      isManualOverride: studentGrades.isManualOverride,
      manualScore: studentGrades.manualScore,
      manualNote: studentGrades.manualNote,
      calculatedAt: studentGrades.calculatedAt,
    })
    .from(studentGrades)
    .leftJoin(curriculumCompetencies, eq(studentGrades.competencyId, curriculumCompetencies.id))
    .where(and(
      eq(studentGrades.studentProfileId, studentProfileId),
      eq(studentGrades.period, period)
    ));
  }

  async getClassroomGrades(classroomId: string, period: string = 'CURRENT') {
    return db.select({
      id: studentGrades.id,
      studentProfileId: studentGrades.studentProfileId,
      studentName: studentProfiles.characterName,
      competencyId: studentGrades.competencyId,
      competencyName: curriculumCompetencies.name,
      score: studentGrades.score,
      gradeLabel: studentGrades.gradeLabel,
      activitiesCount: studentGrades.activitiesCount,
      calculationDetails: studentGrades.calculationDetails,
      isManualOverride: studentGrades.isManualOverride,
      manualScore: studentGrades.manualScore,
      notes: studentGrades.manualNote,
    })
    .from(studentGrades)
    .leftJoin(studentProfiles, eq(studentGrades.studentProfileId, studentProfiles.id))
    .leftJoin(curriculumCompetencies, eq(studentGrades.competencyId, curriculumCompetencies.id))
    .where(and(
      eq(studentGrades.classroomId, classroomId),
      eq(studentGrades.period, period)
    ));
  }

  async recalculateClassroomGrades(classroomId: string, period: string = 'CURRENT') {
    const students = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(eq(studentProfiles.classroomId, classroomId));

    const results = [];
    for (const student of students) {
      const grades = await this.calculateStudentGrades(classroomId, student.id, period);
      results.push({ studentId: student.id, grades });
    }

    return results;
  }

  async setManualGrade(gradeId: string, manualScore: number, manualNote?: string) {
    const now = new Date();
    
    const [grade] = await db.select({
      classroomId: studentGrades.classroomId,
    }).from(studentGrades).where(eq(studentGrades.id, gradeId));

    if (!grade) throw new Error('Calificación no encontrada');

    const [classroom] = await db.select().from(classrooms).where(eq(classrooms.id, grade.classroomId));
    const gradeLabel = this.convertToGradeLabel(manualScore, classroom?.gradeScaleType || null, classroom?.gradeScaleConfig);

    await db.update(studentGrades)
      .set({
        isManualOverride: true,
        manualScore: manualScore.toFixed(2),
        manualNote,
        gradeLabel,
        updatedAt: now,
      })
      .where(eq(studentGrades.id, gradeId));

    return { success: true };
  }

  async clearManualGrade(gradeId: string) {
    const [grade] = await db.select().from(studentGrades).where(eq(studentGrades.id, gradeId));
    if (!grade) throw new Error('Calificación no encontrada');

    await this.calculateStudentGrades(grade.classroomId, grade.studentProfileId, grade.period);
    
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════
  // GESTIÓN DE BIMESTRES
  // ═══════════════════════════════════════════════════════════

  /**
   * Obtiene el estado de los bimestres de un classroom
   */
  async getBimesterStatus(classroomId: string, year?: number) {
    const [classroom] = await db.select({
      currentBimester: classrooms.currentBimester,
      closedBimesters: classrooms.closedBimesters,
      createdAt: classrooms.createdAt,
    }).from(classrooms).where(eq(classrooms.id, classroomId));

    if (!classroom) throw new Error('Clase no encontrada');

    // Parse seguro de closedBimesters (puede venir como string JSON desde MySQL)
    let closedBimesters: any[] = [];
    if (classroom.closedBimesters) {
      if (typeof classroom.closedBimesters === 'string') {
        try {
          closedBimesters = JSON.parse(classroom.closedBimesters);
        } catch {
          closedBimesters = [];
        }
      } else if (Array.isArray(classroom.closedBimesters)) {
        closedBimesters = classroom.closedBimesters;
      }
    }
    const currentYear = new Date().getFullYear();
    const selectedYear = year || currentYear;
    
    // El bimestre actual por defecto usa el año actual
    const defaultBimester = `${currentYear}-B1`;
    const currentBimester = classroom.currentBimester || defaultBimester;

    // Definir todos los bimestres del año seleccionado
    const allBimesters = [
      `${selectedYear}-B1`,
      `${selectedYear}-B2`,
      `${selectedYear}-B3`,
      `${selectedYear}-B4`,
    ];

    // Obtener años disponibles (desde creación de clase hasta año actual)
    const classroomYear = classroom.createdAt ? new Date(classroom.createdAt).getFullYear() : currentYear;
    const availableYears: number[] = [];
    for (let y = classroomYear; y <= currentYear; y++) {
      availableYears.push(y);
    }
    
    return {
      currentBimester,
      closedBimesters,
      selectedYear,
      availableYears,
      allBimesters: allBimesters.map(b => ({
        period: b,
        label: `Bimestre ${b.split('-B')[1]}`,
        isCurrent: b === currentBimester,
        isClosed: closedBimesters.some((cb: any) => cb.period === b),
        closedAt: closedBimesters.find((cb: any) => cb.period === b)?.closedAt,
      })),
    };
  }

  /**
   * Establece el bimestre actual de trabajo
   */
  async setCurrentBimester(classroomId: string, period: string, userId: string) {
    const [classroom] = await db.select().from(classrooms).where(eq(classrooms.id, classroomId));
    if (!classroom) throw new Error('Clase no encontrada');

    // Parse seguro de closedBimesters
    let closedBimesters: any[] = [];
    if (classroom.closedBimesters) {
      if (typeof classroom.closedBimesters === 'string') {
        try { closedBimesters = JSON.parse(classroom.closedBimesters); } catch { closedBimesters = []; }
      } else if (Array.isArray(classroom.closedBimesters)) {
        closedBimesters = classroom.closedBimesters;
      }
    }
    
    // Verificar si el bimestre está cerrado
    if (closedBimesters.some((cb: any) => cb.period === period)) {
      throw new Error('Este bimestre está cerrado. Debes reabrirlo primero.');
    }

    await db.update(classrooms)
      .set({ 
        currentBimester: period,
        updatedAt: new Date(),
      })
      .where(eq(classrooms.id, classroomId));

    return { success: true, currentBimester: period };
  }

  /**
   * Cierra un bimestre (congela las calificaciones)
   */
  async closeBimester(classroomId: string, period: string, userId: string) {
    const [classroom] = await db.select().from(classrooms).where(eq(classrooms.id, classroomId));
    if (!classroom) throw new Error('Clase no encontrada');

    // Parse seguro de closedBimesters
    let closedBimesters: any[] = [];
    if (classroom.closedBimesters) {
      if (typeof classroom.closedBimesters === 'string') {
        try { closedBimesters = JSON.parse(classroom.closedBimesters); } catch { closedBimesters = []; }
      } else if (Array.isArray(classroom.closedBimesters)) {
        closedBimesters = classroom.closedBimesters;
      }
    }
    
    // Verificar si ya está cerrado
    if (closedBimesters.some((cb: any) => cb.period === period)) {
      throw new Error('Este bimestre ya está cerrado');
    }

    // Agregar a la lista de bimestres cerrados
    closedBimesters.push({
      period,
      closedAt: new Date().toISOString(),
      closedBy: userId,
    });

    // Si el bimestre que se cierra es el actual, avanzar al siguiente
    let newCurrentBimester = classroom.currentBimester;
    if (classroom.currentBimester === period) {
      const [yearPart] = period.split('-B');
      const bimesterNum = parseInt(period.split('-B')[1]);
      if (bimesterNum < 4) {
        newCurrentBimester = `${yearPart}-B${bimesterNum + 1}`;
      } else {
        // Si es B4, pasar a B1 del siguiente año
        newCurrentBimester = `${parseInt(yearPart) + 1}-B1`;
      }
    }

    await db.update(classrooms)
      .set({ 
        closedBimesters: closedBimesters,
        currentBimester: newCurrentBimester,
        updatedAt: new Date(),
      })
      .where(eq(classrooms.id, classroomId));

    return { 
      success: true, 
      closedPeriod: period,
      newCurrentBimester,
    };
  }

  /**
   * Reabre un bimestre cerrado
   */
  async reopenBimester(classroomId: string, period: string, userId: string) {
    const [classroom] = await db.select().from(classrooms).where(eq(classrooms.id, classroomId));
    if (!classroom) throw new Error('Clase no encontrada');

    // Parse seguro de closedBimesters
    let closedBimesters: any[] = [];
    if (classroom.closedBimesters) {
      if (typeof classroom.closedBimesters === 'string') {
        try { closedBimesters = JSON.parse(classroom.closedBimesters); } catch { closedBimesters = []; }
      } else if (Array.isArray(classroom.closedBimesters)) {
        closedBimesters = classroom.closedBimesters;
      }
    }
    
    // Verificar si está cerrado
    const closedIndex = closedBimesters.findIndex((cb: any) => cb.period === period);
    if (closedIndex === -1) {
      throw new Error('Este bimestre no está cerrado');
    }

    // Remover de la lista de cerrados
    closedBimesters.splice(closedIndex, 1);

    await db.update(classrooms)
      .set({ 
        closedBimesters: closedBimesters.length > 0 ? closedBimesters : null,
        updatedAt: new Date(),
      })
      .where(eq(classrooms.id, classroomId));

    return { success: true, reopenedPeriod: period };
  }
}

export const gradeService = new GradeService();
