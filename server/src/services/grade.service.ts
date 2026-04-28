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
  timedActivityResults,
  timedActivities,
  tournamentParticipants,
  tournaments,
  expeditionStudentProgress,
  expeditions,
  pointLogs,
  studentBadges,
  jiroStudentExpeditions,
  jiroExpeditions,
  jiroExpeditionCompetencies,
  users,
  type GradeScaleType,
} from '../db/schema.js';
import { eq, and, inArray, sql, gte, lte, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

type ClosedBimesterEntry = {
  period: string;
  closedAt: string;
  closedBy: string;
};

const BIMESTER_PERIOD_REGEX = /^\d{4}-B[1-4]$/;

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

type PerformanceBucket = 'AD' | 'A' | 'B' | 'C';

export interface GradeAverageSummary {
  score: number;
  label: string;
  bucket: PerformanceBucket;
  evaluatedCompetencies: number;
}

export interface GradebookGradeEntry {
  id: string;
  competencyId: string;
  competencyName: string;
  score: number;
  gradeLabel: string;
  bucket: PerformanceBucket;
  activitiesCount: number;
  calculationDetails?: {
    activities: Array<{
      type: string;
      id: string;
      name: string;
      score: number;
      weight: number;
    }>;
    totalWeight: number;
    rawScore: number;
  } | null;
  isManualOverride: boolean;
  manualScore: number | null;
  manualNote: string | null;
  calculatedAt: Date;
}

export interface StudentGradebookResponse {
  studentProfileId: string;
  studentName: string;
  period: string;
  gradeScaleType: GradeScaleType | null;
  average: GradeAverageSummary;
  grades: GradebookGradeEntry[];
}

export interface ClassroomGradebookStudent {
  studentProfileId: string;
  studentName: string;
  average: GradeAverageSummary;
  grades: GradebookGradeEntry[];
}

export interface ClassroomGradebookResponse {
  classroomId: string;
  period: string;
  gradeScaleType: GradeScaleType | null;
  students: ClassroomGradebookStudent[];
  summary: {
    studentCount: number;
    evaluatedStudentCount: number;
    averageScore: number;
    distribution: Record<PerformanceBucket, number>;
  };
}

// Interfaz para el rango de fechas del bimestre
interface BimesterDateRange {
  startDate: Date;
  endDate: Date;
}

class GradeService {

  private normalizePeriod(period?: string): string {
    const normalizedPeriod = (period ?? 'CURRENT').trim().toUpperCase();

    if (normalizedPeriod === 'CURRENT') {
      return 'CURRENT';
    }

    if (!BIMESTER_PERIOD_REGEX.test(normalizedPeriod)) {
      throw new Error('Periodo invalido. Usa CURRENT o el formato YYYY-B1..B4');
    }

    return normalizedPeriod;
  }

  private parseClosedBimesters(rawValue: unknown): ClosedBimesterEntry[] {
    if (!rawValue) {
      return [];
    }

    let parsed: unknown = rawValue;
    if (typeof rawValue === 'string') {
      try {
        parsed = JSON.parse(rawValue);
      } catch {
        return [];
      }
    }

    if (!Array.isArray(parsed)) {
      return [];
    }

    const validEntries: ClosedBimesterEntry[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const candidate = entry as Partial<ClosedBimesterEntry>;
      if (typeof candidate.period !== 'string' || !BIMESTER_PERIOD_REGEX.test(candidate.period)) {
        continue;
      }

      if (typeof candidate.closedAt !== 'string' || Number.isNaN(new Date(candidate.closedAt).getTime())) {
        continue;
      }

      validEntries.push({
        period: candidate.period,
        closedAt: candidate.closedAt,
        closedBy: typeof candidate.closedBy === 'string' ? candidate.closedBy : '',
      });
    }

    return validEntries;
  }

  private parseGradeScaleConfig(rawValue: unknown): unknown {
    if (!rawValue) {
      return null;
    }

    if (typeof rawValue === 'string') {
      try {
        return JSON.parse(rawValue);
      } catch {
        return null;
      }
    }

    return rawValue;
  }

  private async resolveClassroomPeriod(classroomId: string, period: string): Promise<string> {
    const normalizedPeriod = this.normalizePeriod(period);
    if (normalizedPeriod !== 'CURRENT') {
      return normalizedPeriod;
    }

    const [classroom] = await db.select({
      currentBimester: classrooms.currentBimester,
    }).from(classrooms).where(eq(classrooms.id, classroomId));

    const resolvedCurrent = classroom?.currentBimester?.trim().toUpperCase();
    return resolvedCurrent && BIMESTER_PERIOD_REGEX.test(resolvedCurrent)
      ? resolvedCurrent
      : `${new Date().getFullYear()}-B1`;
  }

  private async ensurePeriodIsOpen(classroomId: string, period: string): Promise<void> {
    const [classroom] = await db.select({
      closedBimesters: classrooms.closedBimesters,
    }).from(classrooms).where(eq(classrooms.id, classroomId));

    if (!classroom) {
      throw new Error('Clase no encontrada');
    }

    const closedBimesters = this.parseClosedBimesters(classroom.closedBimesters);
    if (closedBimesters.some((entry) => entry.period === period)) {
      throw new Error('El bimestre esta cerrado. Debes reabrirlo para editar calificaciones');
    }
  }

  async getClassroomIdByStudentProfile(studentProfileId: string): Promise<string | null> {
    const [profile] = await db.select({
      classroomId: studentProfiles.classroomId,
    }).from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));

    return profile?.classroomId || null;
  }

  async getClassroomIdByGrade(gradeId: string): Promise<string | null> {
    const [grade] = await db.select({
      classroomId: studentGrades.classroomId,
    }).from(studentGrades).where(eq(studentGrades.id, gradeId));

    return grade?.classroomId || null;
  }

  async getStudentProfileIdByGrade(gradeId: string): Promise<string | null> {
    const [grade] = await db.select({
      studentProfileId: studentGrades.studentProfileId,
    }).from(studentGrades).where(eq(studentGrades.id, gradeId));

    return grade?.studentProfileId || null;
  }

  async verifyTeacherOwnsClassroom(teacherId: string, classroomId: string): Promise<boolean> {
    const [classroom] = await db.select({
      id: classrooms.id,
    }).from(classrooms).where(and(
      eq(classrooms.id, classroomId),
      eq(classrooms.teacherId, teacherId)
    ));

    return !!classroom;
  }

  async verifyStudentOwnsProfile(studentUserId: string, studentProfileId: string): Promise<boolean> {
    const [profile] = await db.select({
      id: studentProfiles.id,
    }).from(studentProfiles).where(and(
      eq(studentProfiles.id, studentProfileId),
      eq(studentProfiles.userId, studentUserId)
    ));

    return !!profile;
  }

  async verifyStudentInClassroom(studentUserId: string, classroomId: string): Promise<boolean> {
    const [profile] = await db.select({
      id: studentProfiles.id,
    }).from(studentProfiles).where(and(
      eq(studentProfiles.userId, studentUserId),
      eq(studentProfiles.classroomId, classroomId)
    ));

    return !!profile;
  }

  /**
   * Calcula las fechas de inicio y fin de un bimestre basado en los cierres registrados
   */
  async getBimesterDateRange(
    classroomId: string,
    period: string
  ): Promise<BimesterDateRange> {
    const resolvedPeriod = await this.resolveClassroomPeriod(classroomId, period);

    const [classroom] = await db.select({
      closedBimesters: classrooms.closedBimesters,
      createdAt: classrooms.createdAt,
    }).from(classrooms).where(eq(classrooms.id, classroomId));

    if (!classroom) {
      throw new Error('Clase no encontrada');
    }

    const closedBimesters = this.parseClosedBimesters(classroom.closedBimesters);

    // Ordenar bimestres cerrados por fecha
    closedBimesters.sort((a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime());

    // Extraer año y número de bimestre del período (ej: "2026-B2" -> year=2026, bimNum=2)
    const [yearStr, bimPart] = resolvedPeriod.split('-B');
    const year = Number(yearStr);
    const bimNum = Number(bimPart);

    if (!Number.isInteger(year) || !Number.isInteger(bimNum) || bimNum < 1 || bimNum > 4) {
      throw new Error('Periodo invalido. Usa CURRENT o el formato YYYY-B1..B4');
    }

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
    const thisBim = closedBimesters.find(cb => cb.period === resolvedPeriod);
    const endDate = thisBim ? new Date(thisBim.closedAt) : new Date();

    return { startDate, endDate };
  }

  /**
   * Verifica si un período es futuro (no se puede calcular)
   */
  private async isFuturePeriod(classroomId: string, period: string): Promise<boolean> {
    const normalizedPeriod = this.normalizePeriod(period);
    if (normalizedPeriod === 'CURRENT') {
      return false;
    }

    const [classroom] = await db.select({
      currentBimester: classrooms.currentBimester,
    }).from(classrooms).where(eq(classrooms.id, classroomId));

    if (!classroom) return true;

    const currentRaw = classroom.currentBimester?.trim().toUpperCase();
    const currentBimester = currentRaw && BIMESTER_PERIOD_REGEX.test(currentRaw)
      ? currentRaw
      : `${new Date().getFullYear()}-B1`;
    
    // Comparar períodos
    const [currentYear, currentBim] = currentBimester.split('-B').map((part) => Number(part));
    const [periodYear, periodBim] = normalizedPeriod.split('-B').map((part) => Number(part));

    // Es futuro si el año es mayor, o si es el mismo año pero el bimestre es mayor
    if (periodYear > currentYear) return true;
    if (periodYear === currentYear && periodBim > currentBim) return true;

    return false;
  }

  private toNumericScore(value: unknown): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  private buildManualPointActivityName(log: {
    action: string;
    amount: number;
    pointType: string;
    reason: string | null;
  }): string {
    const signedAmount = `${log.action === 'ADD' ? '+' : '-'}${log.amount} ${log.pointType}`;
    const normalizedReason = log.reason?.trim();

    if (normalizedReason) {
      return `${normalizedReason} (${signedAmount})`;
    }

    return `Punto manual ${signedAmount}`;
  }

  private getEvidenceConfidence(observationCount: number): number {
    if (observationCount <= 0) return 0;
    return Math.min(1, observationCount / 6);
  }

  private getEvidenceWeight(observationCount: number): number {
    if (observationCount <= 0) return 0;
    return Math.min(30, observationCount * 5);
  }

  private getEvidenceAdjustedScore(rawScore: number, observationCount: number): number {
    const confidence = this.getEvidenceConfidence(observationCount);
    return Number((50 + (rawScore - 50) * confidence).toFixed(2));
  }

  private resolveStudentDisplayName(student: {
    characterName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }): string {
    const realName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
    return student.characterName || realName || 'Estudiante';
  }

  private getPerformanceBucket(score: number): PerformanceBucket {
    if (score >= 90) return 'AD';
    if (score >= 70) return 'A';
    if (score >= 50) return 'B';
    return 'C';
  }

  private buildAverageSummary(
    grades: GradebookGradeEntry[],
    gradeScaleType: GradeScaleType | null,
    parsedScaleConfig: unknown,
  ): GradeAverageSummary {
    const countableGrades = grades.filter((grade) =>
      Number.isFinite(grade.score) && (grade.activitiesCount > 0 || grade.isManualOverride)
    );

    if (countableGrades.length === 0) {
      return {
        score: 0,
        label: '-',
        bucket: 'C',
        evaluatedCompetencies: 0,
      };
    }

    const averageScore = countableGrades.reduce((sum, grade) => sum + grade.score, 0) / countableGrades.length;

    return {
      score: Number(averageScore.toFixed(2)),
      label: this.convertToGradeLabel(averageScore, gradeScaleType, parsedScaleConfig),
      bucket: this.getPerformanceBucket(averageScore),
      evaluatedCompetencies: countableGrades.length,
    };
  }

  private buildClassroomSummary(students: ClassroomGradebookStudent[]): ClassroomGradebookResponse['summary'] {
    const distribution: Record<PerformanceBucket, number> = {
      AD: 0,
      A: 0,
      B: 0,
      C: 0,
    };

    const evaluatedStudents = students.filter((student) => student.average.evaluatedCompetencies > 0);
    for (const student of evaluatedStudents) {
      distribution[student.average.bucket]++;
    }

    const averageScore = evaluatedStudents.length > 0
      ? evaluatedStudents.reduce((sum, student) => sum + student.average.score, 0) / evaluatedStudents.length
      : 0;

    return {
      studentCount: students.length,
      evaluatedStudentCount: evaluatedStudents.length,
      averageScore: Number(averageScore.toFixed(2)),
      distribution,
    };
  }

  private async getClassroomScaleSettings(classroomId: string): Promise<{
    gradeScaleType: GradeScaleType | null;
    gradeScaleConfig: unknown;
  }> {
    const [classroom] = await db.select({
      gradeScaleType: classrooms.gradeScaleType,
      gradeScaleConfig: classrooms.gradeScaleConfig,
    }).from(classrooms).where(eq(classrooms.id, classroomId));

    return {
      gradeScaleType: classroom?.gradeScaleType || null,
      gradeScaleConfig: classroom?.gradeScaleConfig || null,
    };
  }

  private normalizeGradebookEntry(
    rawGrade: {
      id: string;
      competencyId: string;
      competencyName: string | null;
      score: unknown;
      activitiesCount: number;
      calculationDetails: GradebookGradeEntry['calculationDetails'] | string | null;
      isManualOverride: boolean;
      manualScore: unknown;
      manualNote: string | null;
      calculatedAt: Date;
    },
    gradeScaleType: GradeScaleType | null,
    parsedScaleConfig: unknown,
  ): GradebookGradeEntry {
    const hasManualScore = rawGrade.manualScore !== null && rawGrade.manualScore !== undefined;
    const effectiveScore = rawGrade.isManualOverride && hasManualScore
      ? this.toNumericScore(rawGrade.manualScore)
      : this.toNumericScore(rawGrade.score);
    const normalizedCalculationDetails = typeof rawGrade.calculationDetails === 'string'
      ? (() => {
          try {
            return JSON.parse(rawGrade.calculationDetails) as GradebookGradeEntry['calculationDetails'];
          } catch {
            return null;
          }
        })()
      : rawGrade.calculationDetails;

    return {
      id: rawGrade.id,
      competencyId: rawGrade.competencyId,
      competencyName: rawGrade.competencyName || 'Competencia',
      score: Number(effectiveScore.toFixed(2)),
      gradeLabel: this.convertToGradeLabel(effectiveScore, gradeScaleType, parsedScaleConfig),
      bucket: this.getPerformanceBucket(effectiveScore),
      activitiesCount: rawGrade.activitiesCount,
      calculationDetails: normalizedCalculationDetails,
      isManualOverride: rawGrade.isManualOverride,
      manualScore: hasManualScore ? Number(this.toNumericScore(rawGrade.manualScore).toFixed(2)) : null,
      manualNote: rawGrade.manualNote || null,
      calculatedAt: rawGrade.calculatedAt,
    };
  }
  
  /**
   * Calcula y guarda las calificaciones de un estudiante para todas sus competencias
   */
  async calculateStudentGrades(
    classroomId: string,
    studentProfileId: string,
    period: string = 'CURRENT'
  ): Promise<GradeCalculationResult[]> {
    const resolvedPeriod = await this.resolveClassroomPeriod(classroomId, period);

    // 1. Obtener la clase y verificar que use competencias
    const [classroom] = await db.select({
      id: classrooms.id,
      useCompetencies: classrooms.useCompetencies,
      gradeScaleType: classrooms.gradeScaleType,
      gradeScaleConfig: classrooms.gradeScaleConfig,
    }).from(classrooms).where(eq(classrooms.id, classroomId));
    if (!classroom) {
      throw new Error('Clase no encontrada');
    }

    if (!classroom.useCompetencies) {
      return [];
    }

    const [studentProfile] = await db.select({
      id: studentProfiles.id,
    }).from(studentProfiles).where(and(
      eq(studentProfiles.id, studentProfileId),
      eq(studentProfiles.classroomId, classroomId),
      eq(studentProfiles.isActive, true)
    ));

    if (!studentProfile) {
      throw new Error('Estudiante no encontrado en esta clase');
    }

    // 1.5. Validar que no sea un bimestre futuro
    if (await this.isFuturePeriod(classroomId, resolvedPeriod)) {
      throw new Error('No se pueden calcular calificaciones de un bimestre futuro');
    }

    // 1.6. Obtener el rango de fechas del bimestre
    const dateRange = await this.getBimesterDateRange(classroomId, resolvedPeriod);

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

    const competencyIds = classCompetencies.map((comp) => comp.competencyId);
    const existingGrades = await db.select({
      id: studentGrades.id,
      competencyId: studentGrades.competencyId,
      isManualOverride: studentGrades.isManualOverride,
    })
      .from(studentGrades)
      .where(and(
        eq(studentGrades.studentProfileId, studentProfileId),
        eq(studentGrades.period, resolvedPeriod),
        inArray(studentGrades.competencyId, competencyIds)
      ));

    const existingGradesByCompetency = new Map(
      existingGrades.map((grade) => [grade.competencyId, grade])
    );

    const results: GradeCalculationResult[] = [];
    const now = new Date();
    const parsedScaleConfig = this.parseGradeScaleConfig(classroom.gradeScaleConfig);
    const gradesToPersist: Array<{
      existingGradeId?: string;
      data: {
        classroomId: string;
        studentProfileId: string;
        competencyId: string;
        period: string;
        score: string;
        gradeLabel: string;
        calculationDetails: {
          activities: Array<{
            type: string;
            id: string;
            name: string;
            score: number;
            weight: number;
          }>;
          totalWeight: number;
          rawScore: number;
        };
        activitiesCount: number;
        calculatedAt: Date;
        updatedAt: Date;
      };
    }> = [];

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
      const gradeLabel = this.convertToGradeLabel(rawScore, classroom.gradeScaleType, parsedScaleConfig);

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
        period: resolvedPeriod,
        score: rawScore.toFixed(2),
        gradeLabel,
        calculationDetails,
        activitiesCount: activities.length,
        calculatedAt: now,
        updatedAt: now,
      };

      const existingGrade = existingGradesByCompetency.get(comp.competencyId);
      if (!existingGrade || !existingGrade.isManualOverride) {
        gradesToPersist.push({
          existingGradeId: existingGrade?.id,
          data: gradeData,
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

    if (gradesToPersist.length > 0) {
      await db.transaction(async (tx) => {
        for (const gradeToPersist of gradesToPersist) {
          if (gradeToPersist.existingGradeId) {
            await tx.update(studentGrades)
              .set(gradeToPersist.data)
              .where(eq(studentGrades.id, gradeToPersist.existingGradeId));
          } else {
            await tx.insert(studentGrades).values({
              id: uuidv4(),
              ...gradeToPersist.data,
            });
          }
        }
      });
    }

    return results;
  }

  /**
   * Obtiene los puntajes de actividades de un estudiante para una competencia
   */
  async getStudentActivityScores(
    studentProfileId: string,
    competencyId: string,
    classroomId: string,
    dateRange: BimesterDateRange
  ): Promise<ActivityScoreData[]> {
    const scores: ActivityScoreData[] = [];

    // 1. Actividades temporizadas
    const timedScores = await this.getTimedActivityScores(studentProfileId, competencyId, dateRange);
    scores.push(...timedScores);

    // 3. Torneos
    const tournamentScores = await this.getTournamentScores(studentProfileId, competencyId, dateRange);
    scores.push(...tournamentScores);

    // 4. Expediciones clásicas
    const expeditionScores = await this.getExpeditionScores(studentProfileId, competencyId, dateRange);
    scores.push(...expeditionScores);

    // 5. Expediciones de Jiro
    const jiroExpeditionScores = await this.getJiroExpeditionScores(studentProfileId, competencyId, dateRange);
    scores.push(...jiroExpeditionScores);

    // 6. Comportamientos positivos
    const behaviorScores = await this.getBehaviorScores(studentProfileId, competencyId, classroomId, dateRange);
    scores.push(...behaviorScores);

    // 7. Insignias
    const badgeScores = await this.getBadgeScores(studentProfileId, competencyId, classroomId, dateRange);
    scores.push(...badgeScores);

    // 8. Puntos manuales vinculados a competencia
    const manualScores = await this.getManualPointScores(studentProfileId, competencyId, dateRange);
    scores.push(...manualScores);

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
          weight: timedComp?.weight || 30,
          competencyId,
        });
      } else {
        // Actividad intentada pero no completada (perdida) - cuenta con 30% por participar
        scores.push({
          type: 'TIMED',
          id: ct.activityId,
          name: `${ct.activityName || 'Actividad'} (no completada)`,
          score: 30, // Mínimo por participar
          weight: timedComp?.weight || 30,
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

  private async getJiroExpeditionScores(studentProfileId: string, competencyId: string, dateRange: BimesterDateRange): Promise<ActivityScoreData[]> {
    const scores: ActivityScoreData[] = [];

    // Obtener expediciones de Jiro que tienen esta competencia asociada
    const jiroCompetencies = await db.select({
      expeditionId: jiroExpeditionCompetencies.expeditionId,
    })
    .from(jiroExpeditionCompetencies)
    .where(eq(jiroExpeditionCompetencies.competencyId, competencyId));

    if (jiroCompetencies.length === 0) return scores;
    const expeditionIds = jiroCompetencies.map(j => j.expeditionId);

    // Obtener progreso del estudiante en estas expediciones
    const progress = await db.select({
      expeditionId: jiroStudentExpeditions.expeditionId,
      status: jiroStudentExpeditions.status,
      finalScore: jiroStudentExpeditions.finalScore,
      correctAnswers: jiroStudentExpeditions.correctAnswers,
      wrongAnswers: jiroStudentExpeditions.wrongAnswers,
      completedAt: jiroStudentExpeditions.completedAt,
      expeditionName: jiroExpeditions.name,
      gradeWeight: jiroExpeditions.gradeWeight,
    })
    .from(jiroStudentExpeditions)
    .leftJoin(jiroExpeditions, eq(jiroStudentExpeditions.expeditionId, jiroExpeditions.id))
    .where(and(
      eq(jiroStudentExpeditions.studentProfileId, studentProfileId),
      inArray(jiroStudentExpeditions.expeditionId, expeditionIds),
      gte(jiroStudentExpeditions.updatedAt, dateRange.startDate),
      lte(jiroStudentExpeditions.updatedAt, dateRange.endDate)
    ));

    for (const jp of progress) {
      // Solo contar expediciones completadas
      if (jp.status !== 'COMPLETED') continue;

      // Calcular score basado en respuestas correctas
      const totalAnswers = (jp.correctAnswers || 0) + (jp.wrongAnswers || 0);
      const score = totalAnswers > 0 
        ? ((jp.correctAnswers || 0) / totalAnswers) * 100 
        : 0;

      scores.push({
        type: 'JIRO_EXPEDITION',
        id: jp.expeditionId,
        name: jp.expeditionName || 'Expedición de Jiro',
        score,
        weight: Number(jp.gradeWeight) || 100,
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

    const behaviorIds = competencyBehaviors.map((behavior) => behavior.id);
    const behaviorLogCounts = await db.select({
      behaviorId: pointLogs.behaviorId,
      count: sql<number>`COUNT(DISTINCT ${pointLogs.createdAt})`,
    })
      .from(pointLogs)
      .where(and(
        eq(pointLogs.studentId, studentProfileId),
        inArray(pointLogs.behaviorId, behaviorIds),
        eq(pointLogs.isReverted, false),
        gte(pointLogs.createdAt, dateRange.startDate),
        lte(pointLogs.createdAt, dateRange.endDate)
      ))
      .groupBy(pointLogs.behaviorId);

    const behaviorCountMap = new Map<string, number>(
      behaviorLogCounts.map((entry) => [entry.behaviorId || '', Number(entry.count) || 0])
    );

    // Calcular score neto basado en comportamientos positivos y negativos
    // Usar impacto total (XP + HP + GP), no solo XP
    let totalPositivePoints = 0;
    let totalNegativePoints = 0;
    let hasAnyBehavior = false;
    let totalObservations = 0;
    const behaviorDetails: Array<{ name: string; count: number; points: number; isPositive: boolean }> = [];

    for (const behavior of competencyBehaviors) {
      const count = behaviorCountMap.get(behavior.id) || 0;
      if (count > 0) {
        // Impacto total del comportamiento: XP + HP (GP es moneda de tienda, no afecta calificaciones)
        const behaviorPoints = Math.abs(behavior.xpValue || 0) + Math.abs(behavior.hpValue || 0);
        if (behaviorPoints <= 0) continue;

        hasAnyBehavior = true;
        totalObservations += count;
        const totalPointsFromBehavior = count * behaviorPoints;

        behaviorDetails.push({
          name: behavior.name,
          count,
          points: totalPointsFromBehavior,
          isPositive: behavior.isPositive ?? true,
        });

        if (behavior.isPositive) {
          totalPositivePoints += totalPointsFromBehavior;
        } else {
          totalNegativePoints += totalPointsFromBehavior;
        }
      }
    }

    if (hasAnyBehavior) {
      const totalPoints = totalPositivePoints + totalNegativePoints;
      
      let scorePercent: number;
      if (totalNegativePoints === 0) {
        scorePercent = 100;
      } else if (totalPositivePoints === 0) {
        scorePercent = 0;
      } else {
        scorePercent = (totalPositivePoints / totalPoints) * 100;
      }

      const evidenceAdjustedScore = this.getEvidenceAdjustedScore(scorePercent, totalObservations);
      const evidenceWeight = this.getEvidenceWeight(totalObservations);
      if (evidenceWeight === 0) return scores;

      // Crear nombre descriptivo con los comportamientos individuales
      const detailsText = behaviorDetails
        .map(b => `${b.isPositive ? '✓' : '✗'} ${b.name} (x${b.count})`)
        .join(', ');

      scores.push({
        type: 'BEHAVIOR',
        id: 'behavior-aggregate',
        name: `Comportamientos (+${totalPositivePoints} / -${totalNegativePoints}): ${detailsText}`,
        score: evidenceAdjustedScore,
        weight: evidenceWeight,
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
      unlockedAt: studentBadges.unlockedAt,
    })
    .from(studentBadges)
    .leftJoin(badges, eq(studentBadges.badgeId, badges.id))
    .where(and(
      eq(studentBadges.studentProfileId, studentProfileId),
      inArray(studentBadges.badgeId, badgeIds),
      gte(studentBadges.unlockedAt, dateRange.startDate),
      lte(studentBadges.unlockedAt, dateRange.endDate)
    ));

    if (earnedBadges.length === 0) return scores;

    const getBadgeWeight = (rarity: string | null) => (
      rarity === 'LEGENDARY' ? 100 :
      rarity === 'EPIC' ? 80 :
      rarity === 'RARE' ? 60 : 40
    );

    const highestImpactBadge = earnedBadges.reduce((best, current) => {
      const bestWeight = getBadgeWeight(best.rarity);
      const currentWeight = getBadgeWeight(current.rarity);

      if (currentWeight > bestWeight) return current;
      if (currentWeight < bestWeight) return best;
      return new Date(current.unlockedAt) > new Date(best.unlockedAt) ? current : best;
    });

    const highestImpactWeight = getBadgeWeight(highestImpactBadge.rarity);

    scores.push({
      type: 'BADGE',
      id: highestImpactBadge.badgeId,
      name: earnedBadges.length > 1
        ? `Insignia destacada: ${highestImpactBadge.badgeName || 'Insignia'} (+${earnedBadges.length - 1} más en el período)`
        : (highestImpactBadge.badgeName || 'Insignia'),
      score: 100,
      weight: highestImpactWeight,
      competencyId,
    });

    return scores;
  }

  /**
   * Puntos manuales vinculados directamente a una competencia (sin behaviorId).
   * Mantiene la misma fórmula agregada, pero desglosa cada registro manual para que
   * la razón del punto aparezca en calculationDetails y en la UI.
   */
  private async getManualPointScores(studentProfileId: string, competencyId: string, dateRange: BimesterDateRange): Promise<ActivityScoreData[]> {
    const scores: ActivityScoreData[] = [];

    const manualLogs = await db.select({
      id: pointLogs.id,
      action: pointLogs.action,
      amount: pointLogs.amount,
      pointType: pointLogs.pointType,
      reason: pointLogs.reason,
      createdAt: pointLogs.createdAt,
    })
      .from(pointLogs)
      .where(and(
        eq(pointLogs.studentId, studentProfileId),
        eq(pointLogs.competencyId, competencyId),
        sql`${pointLogs.behaviorId} IS NULL`,
        eq(pointLogs.isReverted, false),
        gte(pointLogs.createdAt, dateRange.startDate),
        lte(pointLogs.createdAt, dateRange.endDate)
      ))
      .orderBy(asc(pointLogs.createdAt));

    if (manualLogs.length === 0) return scores;

    const relevantLogs = manualLogs.filter((log) => log.pointType !== 'GP' && log.amount > 0);
    if (relevantLogs.length === 0) return scores;

    let totalPositive = 0;
    let totalNegative = 0;

    for (const log of relevantLogs) {
      if (log.action === 'ADD') {
        totalPositive += log.amount;
      } else {
        totalNegative += log.amount;
      }
    }

    const totalPoints = totalPositive + totalNegative;
    if (totalPoints === 0) return scores;

  const observationCount = relevantLogs.length;
  const evidenceWeight = this.getEvidenceWeight(observationCount);
  if (evidenceWeight === 0) return scores;

  const confidence = this.getEvidenceConfidence(observationCount);
  const positiveScore = Number((50 + 50 * confidence).toFixed(2));
  const negativeScore = Number((50 - 50 * confidence).toFixed(2));

    let scorePercent: number;
    if (totalNegative === 0) {
      scorePercent = 100;
    } else if (totalPositive === 0) {
      scorePercent = 0;
    } else {
      scorePercent = (totalPositive / totalPoints) * 100;
    }

    const evidenceAdjustedScore = this.getEvidenceAdjustedScore(scorePercent, observationCount);

    let assignedWeight = 0;
    relevantLogs.forEach((log, index) => {
      const proportionalWeight = (log.amount / totalPoints) * evidenceWeight;
      const weight = index === relevantLogs.length - 1
        ? Number(Math.max(0, evidenceWeight - assignedWeight).toFixed(2))
        : Number(proportionalWeight.toFixed(2));

      assignedWeight += weight;

      scores.push({
        type: 'MANUAL_POINTS',
        id: log.id,
        name: this.buildManualPointActivityName(log),
        score: log.action === 'ADD' ? positiveScore : negativeScore,
        weight,
        competencyId,
      });
    });

    if (scores.length > 0) {
      const weightedScore = scores.reduce((sum, score) => sum + score.score * score.weight, 0) / evidenceWeight;
      const roundedWeightedScore = Number(weightedScore.toFixed(2));
      if (Math.abs(roundedWeightedScore - evidenceAdjustedScore) > 0.1) {
        scores[scores.length - 1].score = Number((
          (evidenceAdjustedScore * evidenceWeight - scores.slice(0, -1).reduce((sum, score) => sum + score.score * score.weight, 0)) /
          Math.max(scores[scores.length - 1].weight, 0.01)
        ).toFixed(2));
      }
    }

    return scores;
  }

  private convertToGradeLabel(score: number, scaleType: GradeScaleType | null, customConfig: any): string {
    if (!scaleType) return score.toFixed(0);

    if (scaleType === 'CENTESIMAL') {
      return Math.round(score).toString();
    }

    if (
      scaleType === 'CUSTOM' &&
      customConfig &&
      typeof customConfig === 'object' &&
      Array.isArray((customConfig as { ranges?: unknown }).ranges)
    ) {
      const ranges = (customConfig as { ranges: Array<{ label?: unknown; minPercent?: unknown }> }).ranges
        .map((range) => ({
          label: typeof range.label === 'string' ? range.label : '',
          minPercent: Number(range.minPercent),
        }))
        .filter((range) => range.label && Number.isFinite(range.minPercent))
        .sort((a, b) => b.minPercent - a.minPercent);

      if (ranges.length === 0) {
        return score.toFixed(0);
      }

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

  async getStudentGrades(studentProfileId: string, period: string = 'CURRENT'): Promise<StudentGradebookResponse> {
    const classroomId = await this.getClassroomIdByStudentProfile(studentProfileId);
    if (!classroomId) {
      throw new Error('Estudiante no encontrado');
    }

    const resolvedPeriod = await this.resolveClassroomPeriod(classroomId, period);

    const { gradeScaleType, gradeScaleConfig } = await this.getClassroomScaleSettings(classroomId);
    const parsedScaleConfig = this.parseGradeScaleConfig(gradeScaleConfig);

    const rows = await db.select({
      id: studentGrades.id,
      competencyId: studentGrades.competencyId,
      competencyName: curriculumCompetencies.name,
      score: studentGrades.score,
      activitiesCount: studentGrades.activitiesCount,
      calculationDetails: studentGrades.calculationDetails,
      isManualOverride: studentGrades.isManualOverride,
      manualScore: studentGrades.manualScore,
      manualNote: studentGrades.manualNote,
      calculatedAt: studentGrades.calculatedAt,
      characterName: studentProfiles.characterName,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(studentGrades)
    .leftJoin(studentProfiles, eq(studentGrades.studentProfileId, studentProfiles.id))
    .leftJoin(users, eq(studentProfiles.userId, users.id))
    .leftJoin(curriculumCompetencies, eq(studentGrades.competencyId, curriculumCompetencies.id))
    .where(and(
      eq(studentGrades.studentProfileId, studentProfileId),
      eq(studentGrades.period, resolvedPeriod)
    ));

    const grades = rows.map((row) => this.normalizeGradebookEntry(row, gradeScaleType, parsedScaleConfig));
    const studentName = rows.length > 0
      ? this.resolveStudentDisplayName(rows[0])
      : 'Estudiante';

    return {
      studentProfileId,
      studentName,
      period: resolvedPeriod,
      gradeScaleType,
      average: this.buildAverageSummary(grades, gradeScaleType, parsedScaleConfig),
      grades,
    };
  }

  async getClassroomGrades(classroomId: string, period: string = 'CURRENT'): Promise<ClassroomGradebookResponse> {
    const resolvedPeriod = await this.resolveClassroomPeriod(classroomId, period);

    const { gradeScaleType, gradeScaleConfig } = await this.getClassroomScaleSettings(classroomId);
    const parsedScaleConfig = this.parseGradeScaleConfig(gradeScaleConfig);

    const rows = await db.select({
      id: studentGrades.id,
      studentProfileId: studentGrades.studentProfileId,
      competencyId: studentGrades.competencyId,
      competencyName: curriculumCompetencies.name,
      score: studentGrades.score,
      activitiesCount: studentGrades.activitiesCount,
      calculationDetails: studentGrades.calculationDetails,
      isManualOverride: studentGrades.isManualOverride,
      manualScore: studentGrades.manualScore,
      manualNote: studentGrades.manualNote,
      calculatedAt: studentGrades.calculatedAt,
      characterName: studentProfiles.characterName,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(studentGrades)
    .leftJoin(studentProfiles, eq(studentGrades.studentProfileId, studentProfiles.id))
    .leftJoin(users, eq(studentProfiles.userId, users.id))
    .leftJoin(curriculumCompetencies, eq(studentGrades.competencyId, curriculumCompetencies.id))
    .where(and(
      eq(studentGrades.classroomId, classroomId),
      eq(studentGrades.period, resolvedPeriod)
    ));

    const groupedStudents = new Map<string, ClassroomGradebookStudent>();

    for (const row of rows) {
      const gradeEntry = this.normalizeGradebookEntry(row, gradeScaleType, parsedScaleConfig);
      const existingStudent = groupedStudents.get(row.studentProfileId);

      if (existingStudent) {
        existingStudent.grades.push(gradeEntry);
        continue;
      }

      groupedStudents.set(row.studentProfileId, {
        studentProfileId: row.studentProfileId,
        studentName: this.resolveStudentDisplayName(row),
        average: {
          score: 0,
          label: '-',
          bucket: 'C',
          evaluatedCompetencies: 0,
        },
        grades: [gradeEntry],
      });
    }

    const students = Array.from(groupedStudents.values())
      .map((student) => ({
        ...student,
        average: this.buildAverageSummary(student.grades, gradeScaleType, parsedScaleConfig),
      }))
      .sort((a, b) => a.studentName.localeCompare(b.studentName, 'es'));

    return {
      classroomId,
      period: resolvedPeriod,
      gradeScaleType,
      students,
      summary: this.buildClassroomSummary(students),
    };
  }

  async recalculateClassroomGrades(classroomId: string, period: string = 'CURRENT') {
    const resolvedPeriod = await this.resolveClassroomPeriod(classroomId, period);

    const students = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true)
      ));

    const results = [];
    for (const student of students) {
      const grades = await this.calculateStudentGrades(classroomId, student.id, resolvedPeriod);
      results.push({ studentId: student.id, grades });
    }

    return results;
  }

  async setManualGrade(gradeId: string, manualScore: number, manualNote?: string) {
    if (!Number.isFinite(manualScore) || manualScore < 0 || manualScore > 100) {
      throw new Error('manualScore debe estar entre 0 y 100');
    }

    const now = new Date();
    
    const [grade] = await db.select({
      classroomId: studentGrades.classroomId,
      period: studentGrades.period,
    }).from(studentGrades).where(eq(studentGrades.id, gradeId));

    if (!grade) throw new Error('Calificación no encontrada');

    await this.ensurePeriodIsOpen(grade.classroomId, grade.period);

    const [classroom] = await db.select({
      gradeScaleType: classrooms.gradeScaleType,
      gradeScaleConfig: classrooms.gradeScaleConfig,
    }).from(classrooms).where(eq(classrooms.id, grade.classroomId));
    const parsedScaleConfig = this.parseGradeScaleConfig(classroom?.gradeScaleConfig);
    const gradeLabel = this.convertToGradeLabel(manualScore, classroom?.gradeScaleType || null, parsedScaleConfig);
    const normalizedManualNote = manualNote?.trim() || null;

    await db.update(studentGrades)
      .set({
        isManualOverride: true,
        score: manualScore.toFixed(2),
        manualScore: manualScore.toFixed(2),
        manualNote: normalizedManualNote,
        gradeLabel,
        updatedAt: now,
      })
      .where(eq(studentGrades.id, gradeId));

    return { success: true };
  }

  async clearManualGrade(gradeId: string) {
    const [grade] = await db.select({
      classroomId: studentGrades.classroomId,
      studentProfileId: studentGrades.studentProfileId,
      period: studentGrades.period,
    }).from(studentGrades).where(eq(studentGrades.id, gradeId));

    if (!grade) throw new Error('Calificación no encontrada');

    await this.ensurePeriodIsOpen(grade.classroomId, grade.period);

    await db.update(studentGrades)
      .set({
        isManualOverride: false,
        manualScore: null,
        manualNote: null,
        updatedAt: new Date(),
      })
      .where(eq(studentGrades.id, gradeId));

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

    const closedBimesters = this.parseClosedBimesters(classroom.closedBimesters);
    const currentYear = new Date().getFullYear();
    const selectedYear = Number.isInteger(year) ? Number(year) : currentYear;
    
    // El bimestre actual por defecto usa el año actual
    const defaultBimester = `${currentYear}-B1`;
    const normalizedCurrent = classroom.currentBimester?.trim().toUpperCase();
    const currentBimester = normalizedCurrent && BIMESTER_PERIOD_REGEX.test(normalizedCurrent)
      ? normalizedCurrent
      : defaultBimester;

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
        isClosed: closedBimesters.some((cb) => cb.period === b),
        closedAt: closedBimesters.find((cb) => cb.period === b)?.closedAt,
      })),
    };
  }

  /**
   * Establece el bimestre actual de trabajo
   */
  async setCurrentBimester(classroomId: string, period: string, userId: string) {
    if (!userId) {
      throw new Error('Usuario no autorizado');
    }

    const normalizedPeriod = this.normalizePeriod(period);
    if (normalizedPeriod === 'CURRENT') {
      throw new Error('Periodo invalido. Usa el formato YYYY-B1..B4');
    }

    const [classroom] = await db.select().from(classrooms).where(eq(classrooms.id, classroomId));
    if (!classroom) throw new Error('Clase no encontrada');

    const closedBimesters = this.parseClosedBimesters(classroom.closedBimesters);
    
    // Verificar si el bimestre está cerrado
    if (closedBimesters.some((cb) => cb.period === normalizedPeriod)) {
      throw new Error('Este bimestre está cerrado. Debes reabrirlo primero.');
    }

    await db.update(classrooms)
      .set({ 
        currentBimester: normalizedPeriod,
        updatedAt: new Date(),
      })
      .where(eq(classrooms.id, classroomId));

    return { success: true, currentBimester: normalizedPeriod };
  }

  /**
   * Cierra un bimestre (congela las calificaciones)
   */
  async closeBimester(classroomId: string, period: string, userId: string) {
    if (!userId) {
      throw new Error('Usuario no autorizado');
    }

    const normalizedPeriod = this.normalizePeriod(period);
    if (normalizedPeriod === 'CURRENT') {
      throw new Error('Periodo invalido. Usa el formato YYYY-B1..B4');
    }

    const [classroom] = await db.select().from(classrooms).where(eq(classrooms.id, classroomId));
    if (!classroom) throw new Error('Clase no encontrada');

    const closedBimesters = this.parseClosedBimesters(classroom.closedBimesters);
    
    // Verificar si ya está cerrado
    if (closedBimesters.some((cb) => cb.period === normalizedPeriod)) {
      throw new Error('Este bimestre ya está cerrado');
    }

    // Agregar a la lista de bimestres cerrados
    closedBimesters.push({
      period: normalizedPeriod,
      closedAt: new Date().toISOString(),
      closedBy: userId,
    });

    // Si el bimestre que se cierra es el actual, avanzar al siguiente
    const currentRaw = classroom.currentBimester?.trim().toUpperCase();
    const currentBimester = currentRaw && BIMESTER_PERIOD_REGEX.test(currentRaw)
      ? currentRaw
      : `${new Date().getFullYear()}-B1`;

    let newCurrentBimester = currentBimester;
    if (currentBimester === normalizedPeriod) {
      const [yearPart] = normalizedPeriod.split('-B');
      const bimesterNum = Number(normalizedPeriod.split('-B')[1]);
      if (bimesterNum < 4) {
        newCurrentBimester = `${yearPart}-B${bimesterNum + 1}`;
      } else {
        // Si es B4, pasar a B1 del siguiente año
        newCurrentBimester = `${Number(yearPart) + 1}-B1`;
      }
    }

    await db.update(classrooms)
      .set({ 
        closedBimesters: closedBimesters,
        currentBimester: newCurrentBimester,
        updatedAt: new Date(),
      })
      .where(eq(classrooms.id, classroomId));

    // Storytelling: completar capítulos tipo BIMESTER
    try {
      const { storyService } = await import('./story.service.js');
      await storyService.onBimesterClosed(classroomId);
    } catch (error) {
      // Silently fail - don't break bimester close
    }

    return { 
      success: true, 
      closedPeriod: normalizedPeriod,
      newCurrentBimester,
    };
  }

  /**
   * Reabre un bimestre cerrado
   */
  async reopenBimester(classroomId: string, period: string, userId: string) {
    if (!userId) {
      throw new Error('Usuario no autorizado');
    }

    const normalizedPeriod = this.normalizePeriod(period);
    if (normalizedPeriod === 'CURRENT') {
      throw new Error('Periodo invalido. Usa el formato YYYY-B1..B4');
    }

    const [classroom] = await db.select().from(classrooms).where(eq(classrooms.id, classroomId));
    if (!classroom) throw new Error('Clase no encontrada');

    const closedBimesters = this.parseClosedBimesters(classroom.closedBimesters);
    
    // Verificar si está cerrado
    const closedIndex = closedBimesters.findIndex((cb) => cb.period === normalizedPeriod);
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

    return { success: true, reopenedPeriod: normalizedPeriod };
  }
}

export const gradeService = new GradeService();
