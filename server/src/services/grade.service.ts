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
  studentBossBattles,
  studentBossBattleParticipants,
  bossBattles,
  battleParticipants,
  type GradeScaleType,
} from '../db/schema.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Escalas de calificación predefinidas
const GRADE_SCALES: Record<string, Array<{ label: string; minPercent: number }>> = {
  PERU_LETTERS: [
    { label: 'AD', minPercent: 85 },
    { label: 'A', minPercent: 65 },
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

class GradeService {
  
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
        classroomId
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
    classroomId: string
  ): Promise<ActivityScoreData[]> {
    const scores: ActivityScoreData[] = [];

    // 1. Misiones completadas
    const missionScores = await this.getMissionScores(studentProfileId, competencyId);
    scores.push(...missionScores);

    // 2. Actividades temporizadas
    const timedScores = await this.getTimedActivityScores(studentProfileId, competencyId);
    scores.push(...timedScores);

    // 3. Torneos
    const tournamentScores = await this.getTournamentScores(studentProfileId, competencyId);
    scores.push(...tournamentScores);

    // 4. Expediciones
    const expeditionScores = await this.getExpeditionScores(studentProfileId, competencyId);
    scores.push(...expeditionScores);

    // 5. Comportamientos positivos
    const behaviorScores = await this.getBehaviorScores(studentProfileId, competencyId, classroomId);
    scores.push(...behaviorScores);

    // 6. Insignias
    const badgeScores = await this.getBadgeScores(studentProfileId, competencyId, classroomId);
    scores.push(...badgeScores);

    // 7. Boss Battles (Cooperativas)
    const bossBattleScores = await this.getBossBattleScores(studentProfileId, competencyId);
    scores.push(...bossBattleScores);

    // 8. Boss Battles (Clásicas)
    const classicBattleScores = await this.getClassicBossBattleScores(studentProfileId, competencyId);
    scores.push(...classicBattleScores);

    return scores;
  }

  private async getMissionScores(studentProfileId: string, competencyId: string): Promise<ActivityScoreData[]> {
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
    })
    .from(studentMissions)
    .leftJoin(missions, eq(studentMissions.missionId, missions.id))
    .where(and(
      eq(studentMissions.studentProfileId, studentProfileId),
      inArray(studentMissions.missionId, missionIds)
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

  private async getTimedActivityScores(studentProfileId: string, competencyId: string): Promise<ActivityScoreData[]> {
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
      inArray(timedActivityResults.activityId, timedIds)
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

  private async getTournamentScores(studentProfileId: string, competencyId: string): Promise<ActivityScoreData[]> {
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
      inArray(tournamentParticipants.tournamentId, tournamentIds)
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

  private async getExpeditionScores(studentProfileId: string, competencyId: string): Promise<ActivityScoreData[]> {
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
      inArray(expeditionStudentProgress.expeditionId, expeditionIds)
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

  private async getBehaviorScores(studentProfileId: string, competencyId: string, classroomId: string): Promise<ActivityScoreData[]> {
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
          eq(pointLogs.behaviorId, behavior.id)
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

  private async getBadgeScores(studentProfileId: string, competencyId: string, classroomId: string): Promise<ActivityScoreData[]> {
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
      inArray(studentBadges.badgeId, badgeIds)
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

  private async getBossBattleScores(studentProfileId: string, competencyId: string): Promise<ActivityScoreData[]> {
    const scores: ActivityScoreData[] = [];

    // Obtener boss battles con competencia asignada que están completadas/victoria
    const battleParticipations = await db.select({
      battleId: studentBossBattles.id,
      battleName: studentBossBattles.bossName,
      status: studentBossBattles.status,
      correctAnswers: studentBossBattleParticipants.totalCorrectAnswers,
      wrongAnswers: studentBossBattleParticipants.totalWrongAnswers,
    })
    .from(studentBossBattleParticipants)
    .innerJoin(studentBossBattles, eq(studentBossBattleParticipants.battleId, studentBossBattles.id))
    .where(and(
      eq(studentBossBattleParticipants.studentProfileId, studentProfileId),
      eq(studentBossBattles.competencyId, competencyId),
      inArray(studentBossBattles.status, ['COMPLETED', 'VICTORY', 'DEFEAT'])
    ));

    for (const participation of battleParticipations) {
      const totalAnswers = participation.correctAnswers + participation.wrongAnswers;
      if (totalAnswers === 0) continue;

      // Score = porcentaje de respuestas correctas
      const scorePercent = (participation.correctAnswers / totalAnswers) * 100;
      
      // Peso dinámico basado en cantidad de respuestas (más participación = más peso)
      const dynamicWeight = Math.min(100, Math.max(30, totalAnswers * 5));

      scores.push({
        type: 'BOSS_BATTLE',
        id: participation.battleId,
        name: `Boss Battle: ${participation.battleName}`,
        score: Math.round(scorePercent),
        weight: dynamicWeight,
        competencyId,
      });
    }

    return scores;
  }

  private async getClassicBossBattleScores(studentProfileId: string, competencyId: string): Promise<ActivityScoreData[]> {
    const scores: ActivityScoreData[] = [];

    // Obtener boss battles clásicas con competencia asignada que están completadas
    const battleParticipations = await db.select({
      battleId: bossBattles.id,
      battleName: bossBattles.bossName,
      activityName: bossBattles.name,
      status: bossBattles.status,
      correctAnswers: battleParticipants.correctAnswers,
      wrongAnswers: battleParticipants.wrongAnswers,
    })
    .from(battleParticipants)
    .innerJoin(bossBattles, eq(battleParticipants.battleId, bossBattles.id))
    .where(and(
      eq(battleParticipants.studentId, studentProfileId),
      eq(bossBattles.competencyId, competencyId),
      inArray(bossBattles.status, ['COMPLETED', 'VICTORY', 'DEFEAT'])
    ));

    for (const participation of battleParticipations) {
      const totalAnswers = participation.correctAnswers + participation.wrongAnswers;
      if (totalAnswers === 0) continue;

      // Score = porcentaje de respuestas correctas
      const scorePercent = (participation.correctAnswers / totalAnswers) * 100;
      
      // Peso dinámico basado en cantidad de respuestas
      const dynamicWeight = Math.min(100, Math.max(30, totalAnswers * 5));

      scores.push({
        type: 'BOSS_BATTLE_CLASSIC',
        id: participation.battleId,
        name: `${participation.activityName}: ${participation.battleName}`,
        score: Math.round(scorePercent),
        weight: dynamicWeight,
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
}

export const gradeService = new GradeService();
