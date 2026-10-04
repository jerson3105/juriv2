import { db } from '../db/index.js';
import {
  studentGrades,
  studentProfiles,
  classrooms,
  classroomCompetencies,
  classroomCompetencyIndicators,
  activityCompetencies,
  curriculumCompetencies,
  behaviors,
  badges,
  timedActivityResults,
  timedActivities,
  pointLogs,
  studentBadges,
  users,
  gradeEvaluations,
  gradeEvaluationScores,
  type BimesterDates,
  type GradeScaleType,
} from '../db/schema.js';
import { eq, and, inArray, sql, gte, lte, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { teacherOwnsClassroom } from '../utils/access.js';
import { affectedRows } from '../utils/points.js';
import { performanceBucket, scaleOptions, scaleValueToScore, scoreToLabel } from '../utils/gradeScale.js';

type ClosedBimesterEntry = {
  period: string;
  closedAt: string;
  closedBy: string;
};

const BIMESTER_PERIOD_REGEX = /^\d{4}-B[1-4]$/;
// Con esta cantidad de observaciones la evidencia cuenta completa (con menos, la nota se acerca a 50).
const FULL_CONFIDENCE_OBSERVATIONS = 3;
// Recálculo automático al abrir el libro: como mucho una vez por este intervalo y clase/bimestre.
const AUTO_RECALC_MS = 2 * 60 * 1000;
const recalcInFlight = new Map<string, Promise<unknown>>();

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
    evaluationScore?: number | null;
    evidenceScore?: number | null;
    evaluationWeight?: number;
  } | null;
  indicatorBreakdownStatus: 'AVAILABLE' | 'HISTORICAL_NO_BREAKDOWN' | 'NOT_CONFIGURED';
  indicatorStartPeriod: string | null;
  indicatorBreakdown: Array<{
    id: string;
    name: string;
    description: string | null;
    score: number | null;
    gradeLabel: string | null;
    bucket: PerformanceBucket | null;
    observations: number;
    positiveObservations: number;
    negativeObservations: number;
    positivePoints: number;
    negativePoints: number;
    evidenceWeight: number;
    hasEvidence: boolean;
  }>;
  isManualOverride: boolean;
  manualScore: number | null;
  manualLabel: string | null;
  /** Nota calculada por el sistema (aunque haya ajuste manual). */
  calculatedScore: number | null;
  calculatedLabel: string | null;
  /** Hay ajuste manual y la calculada ya no coincide con él. */
  calculatedChanged: boolean;
  manualNote: string | null;
  privateNote?: string | null;
  conclusion: string | null;
  calculatedAt: Date;
}

type GradeRow = {
  id: string;
  studentProfileId: string;
  competencyId: string;
  competencyName: string | null;
  score: unknown;
  gradeLabel: string | null;
  calculatedScore: unknown;
  calculatedLabel: string | null;
  activitiesCount: number;
  calculationDetails: GradebookGradeEntry['calculationDetails'] | string | null;
  isManualOverride: boolean;
  manualScore: unknown;
  manualLabel: string | null;
  manualNote: string | null;
  privateNote: string | null;
  conclusion: string | null;
  calculatedAt: Date;
};

export interface GradebookCompetencyColumn {
  id: string;
  code: string;
  name: string | null;
  shortName: string | null;
  weight: number;
  isCustom: boolean;
  indicatorCount: number;
  indicators: Array<{ id: string; code: string; name: string; weight: number }>;
}

export interface StudentGradebookResponse {
  studentProfileId: string;
  studentName: string;
  period: string;
  gradeScaleType: GradeScaleType | null;
  average: GradeAverageSummary;
  grades: GradebookGradeEntry[];
}

/** Nivel en la escala de la clase (la letra o el número que ve el alumno). */
type LevelView = { label: string; bucket: PerformanceBucket };

/** Una fuente de la nota, en el lenguaje del alumno (sin porcentajes, pesos ni puntos). */
export interface StudentGradeSource {
  kind: 'behaviors' | 'evaluation' | 'activity' | 'expedition' | 'badge' | 'teacher';
  name: string | null;
  level: LevelView | null;
  /** Evaluación: el comentario del docente para el alumno. */
  comment?: string | null;
  /** Comportamientos: veces que salió bien y por mejorar, y cuáles (solo si la clase muestra los motivos). */
  positive?: number;
  negative?: number;
  items?: Array<{ name: string; isPositive: boolean; count: number }>;
}

export interface StudentCompetencyView {
  id: string;
  name: string | null;
  shortName: string | null;
  /** null = aún sin evidencias en el bimestre ("Aún sin nota"; no es una C). */
  level: LevelView | null;
  isManual: boolean;
  /** Menos de FULL_CONFIDENCE_OBSERVATIONS registros, sin evaluaciones ni nota manual. */
  lowEvidence: boolean;
  records: number;
  evaluations: number;
  comment: string | null;
  /** Solo con el bimestre cerrado. */
  conclusion: string | null;
  skills: Array<{ id: string; name: string; level: LevelView | null; positive: number; negative: number }>;
  sources: StudentGradeSource[];
}

/** "Mis calificaciones": sin promedio, porcentajes, pesos ni la nota calculada detrás de una manual. */
export interface StudentGradesView {
  period: string;
  isCurrent: boolean;
  isClosed: boolean;
  isFuture: boolean;
  scaleKind: 'letters' | 'vigesimal' | 'number';
  showReasons: boolean;
  competencies: StudentCompetencyView[];
}

export interface ClassroomGradebookStudent {
  studentProfileId: string;
  studentName: string;
  characterName?: string | null;
  average: GradeAverageSummary;
  grades: GradebookGradeEntry[];
}

export interface ClassroomGradebookResponse {
  classroomId: string;
  period: string;
  gradeScaleType: GradeScaleType | null;
  scale: ReturnType<typeof scaleOptions>;
  competencies: GradebookCompetencyColumn[];
  isClosed: boolean;
  evaluationWeight: number;
  lastCalculatedAt: Date | null;
  students: ClassroomGradebookStudent[];
  summary: {
    studentCount: number;
    evaluatedStudentCount: number;
    averageScore: number;
    distribution: Record<PerformanceBucket, number>;
  };
}

type IndicatorDefinition = {
  id: string;
  competencyId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  weight: number;
};

type IndicatorStat = {
  positivePoints: number;
  negativePoints: number;
  observations: number;
  positiveObservations: number;
  negativeObservations: number;
};

type IndicatorAssessment = {
  id: string;
  name: string;
  description: string | null;
  score: number | null;
  observations: number;
  positiveObservations: number;
  negativeObservations: number;
  positivePoints: number;
  negativePoints: number;
  evidenceWeight: number;
  hasEvidence: boolean;
};

interface IndicatorBreakdownContext {
  indicatorStartPeriod: string | null;
  isHistoricalWithoutBreakdown: boolean;
  indicatorsByCompetency: Map<string, IndicatorDefinition[]>;
  statsByStudentIndicator: Map<string, IndicatorStat>;
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

  private parseBimesterDates(raw: unknown): Record<string, BimesterDates> {
    let parsed: unknown = raw;
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); } catch { return {}; }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, BimesterDates> = {};
    for (const [period, value] of Object.entries(parsed as Record<string, unknown>)) {
      const entry = value as Partial<BimesterDates> | null;
      if (!BIMESTER_PERIOD_REGEX.test(period) || !entry) continue;
      const start = new Date(String(entry.start));
      const end = new Date(String(entry.end));
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) continue;
      result[period] = { start: start.toISOString(), end: end.toISOString() };
    }
    return result;
  }

  /** CURRENT → bimestre actual de la clase (YYYY-B#). */
  async resolvePeriod(classroomId: string, period: string = 'CURRENT'): Promise<string> {
    return this.resolveClassroomPeriod(classroomId, period);
  }

  /** Se puede registrar notas: ni cerrado ni futuro. */
  async assertPeriodEditable(classroomId: string, period: string): Promise<void> {
    await this.ensurePeriodIsOpen(classroomId, period);
    if (await this.isFuturePeriod(classroomId, period)) throw new Error('Periodo invalido: el bimestre aún no empieza');
  }

  async getScaleSettings(classroomId: string) {
    const { gradeScaleType, gradeScaleConfig } = await this.getClassroomScaleSettings(classroomId);
    return { gradeScaleType, parsedScaleConfig: this.parseGradeScaleConfig(gradeScaleConfig) };
  }

  async isPeriodClosed(classroomId: string, period: string): Promise<boolean> {
    const [classroom] = await db.select({ closedBimesters: classrooms.closedBimesters })
      .from(classrooms).where(eq(classrooms.id, classroomId));
    return this.parseClosedBimesters(classroom?.closedBimesters).some((entry) => entry.period === period);
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
    return teacherOwnsClassroom(teacherId, classroomId);
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
      bimesterDates: classrooms.bimesterDates,
      createdAt: classrooms.createdAt,
    }).from(classrooms).where(eq(classrooms.id, classroomId));

    if (!classroom) {
      throw new Error('Clase no encontrada');
    }

    // Fechas configuradas por el docente (o fijadas al cerrar): mandan sobre la lógica de cierres.
    const dates = this.parseBimesterDates(classroom.bimesterDates);
    const configured = dates[resolvedPeriod];
    if (configured) {
      return { startDate: new Date(configured.start), endDate: new Date(configured.end) };
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
    // Bimestre anterior: su fin configurado, o su cierre, o la creación de la clase.
    const previousPeriod = bimNum === 1 ? `${year - 1}-B4` : `${year}-B${bimNum - 1}`;
    const previousEnd = dates[previousPeriod]?.end ?? closedBimesters.find((cb) => cb.period === previousPeriod)?.closedAt;
    const startDate = new Date(previousEnd ?? classroom?.createdAt ?? '2020-01-01');

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
    return Math.min(1, observationCount / FULL_CONFIDENCE_OBSERVATIONS);
  }

  private getEvidenceWeight(observationCount: number): number {
    if (observationCount <= 0) return 0;
    return Math.min(30, observationCount * 5);
  }

  private getEvidenceAdjustedScore(rawScore: number, observationCount: number): number {
    const confidence = this.getEvidenceConfidence(observationCount);
    return Number((50 + (rawScore - 50) * confidence).toFixed(2));
  }

  private compareBimesterPeriods(left: string, right: string): number {
    const [leftYear, leftBimester] = left.split('-B').map((part) => Number(part));
    const [rightYear, rightBimester] = right.split('-B').map((part) => Number(part));

    if (leftYear !== rightYear) {
      return leftYear - rightYear;
    }

    return leftBimester - rightBimester;
  }

  private buildIndicatorStatKey(studentProfileId: string, indicatorId: string): string {
    return `${studentProfileId}::${indicatorId}`;
  }

  private resolveStudentDisplayName(student: {
    characterName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }): string {
    const realName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
    return student.characterName || realName || 'Estudiante';
  }

  private getPerformanceBucket(
    score: number,
    gradeScaleType: GradeScaleType | null,
    gradeLabel?: string,
  ): PerformanceBucket {
    return performanceBucket(score, gradeScaleType, gradeLabel);
  }

  private buildAverageSummary(
    grades: GradebookGradeEntry[],
    gradeScaleType: GradeScaleType | null,
    parsedScaleConfig: unknown,
    weights: Map<string, number> = new Map(),
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

    const weightOf = (grade: GradebookGradeEntry) => Math.max(1, weights.get(grade.competencyId) ?? 100);
    const totalWeight = countableGrades.reduce((sum, grade) => sum + weightOf(grade), 0);
    const averageScore = countableGrades.reduce((sum, grade) => sum + grade.score * weightOf(grade), 0) / totalWeight;

    const averageLabel = this.convertToGradeLabel(averageScore, gradeScaleType, parsedScaleConfig);

    return {
      score: Number(averageScore.toFixed(2)),
      label: averageLabel,
      bucket: this.getPerformanceBucket(averageScore, gradeScaleType, averageLabel),
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
    competencyIndicatorStartPeriod: string | null;
  }> {
    const [classroom] = await db.select({
      gradeScaleType: classrooms.gradeScaleType,
      gradeScaleConfig: classrooms.gradeScaleConfig,
      competencyIndicatorStartPeriod: classrooms.competencyIndicatorStartPeriod,
    }).from(classrooms).where(eq(classrooms.id, classroomId));

    return {
      gradeScaleType: classroom?.gradeScaleType || null,
      gradeScaleConfig: classroom?.gradeScaleConfig || null,
      competencyIndicatorStartPeriod: classroom?.competencyIndicatorStartPeriod || null,
    };
  }

  private async buildIndicatorBreakdownContext(
    classroomId: string,
    studentProfileIds: string[],
    competencyIds: string[],
    dateRange: BimesterDateRange,
    period: string,
    indicatorStartPeriod: string | null,
  ): Promise<IndicatorBreakdownContext> {
    if (studentProfileIds.length === 0 || competencyIds.length === 0) {
      return {
        indicatorStartPeriod,
        isHistoricalWithoutBreakdown: false,
        indicatorsByCompetency: new Map(),
        statsByStudentIndicator: new Map(),
      };
    }

    const indicatorRows = await db.select({
      id: classroomCompetencyIndicators.id,
      competencyId: classroomCompetencyIndicators.competencyId,
      name: classroomCompetencyIndicators.name,
      description: classroomCompetencyIndicators.description,
      displayOrder: classroomCompetencyIndicators.displayOrder,
      weight: classroomCompetencyIndicators.weight,
    })
      .from(classroomCompetencyIndicators)
      .where(and(
        eq(classroomCompetencyIndicators.classroomId, classroomId),
        inArray(classroomCompetencyIndicators.competencyId, competencyIds),
        eq(classroomCompetencyIndicators.isActive, true),
      ))
      .orderBy(
        asc(classroomCompetencyIndicators.competencyId),
        asc(classroomCompetencyIndicators.displayOrder),
        asc(classroomCompetencyIndicators.createdAt),
      );

    const indicatorsByCompetency = new Map<string, IndicatorDefinition[]>();
    for (const indicator of indicatorRows) {
      const current = indicatorsByCompetency.get(indicator.competencyId) || [];
      current.push(indicator);
      indicatorsByCompetency.set(indicator.competencyId, current);
    }

    const indicatorIds = indicatorRows.map((indicator) => indicator.id);
    const isHistoricalWithoutBreakdown = !!indicatorStartPeriod
      && BIMESTER_PERIOD_REGEX.test(indicatorStartPeriod)
      && this.compareBimesterPeriods(period, indicatorStartPeriod) < 0;

    if (indicatorIds.length === 0 || isHistoricalWithoutBreakdown) {
      return {
        indicatorStartPeriod,
        isHistoricalWithoutBreakdown,
        indicatorsByCompetency,
        statsByStudentIndicator: new Map(),
      };
    }

    const logRows = await db.select({
      studentId: pointLogs.studentId,
      indicatorId: pointLogs.competencyIndicatorId,
      behaviorName: behaviors.name,
      isPositive: behaviors.isPositive,
      xpValue: behaviors.xpValue,
      hpValue: behaviors.hpValue,
      count: sql<number>`COUNT(DISTINCT ${pointLogs.createdAt})`,
    })
      .from(pointLogs)
      .innerJoin(behaviors, eq(pointLogs.behaviorId, behaviors.id))
      .where(and(
        inArray(pointLogs.studentId, studentProfileIds),
        inArray(pointLogs.competencyIndicatorId, indicatorIds),
        eq(pointLogs.isReverted, false),
        gte(pointLogs.createdAt, dateRange.startDate),
        lte(pointLogs.createdAt, dateRange.endDate),
      ))
      .groupBy(
        pointLogs.studentId,
        pointLogs.competencyIndicatorId,
        behaviors.name,
        behaviors.isPositive,
        behaviors.xpValue,
        behaviors.hpValue,
      );

    const statsByStudentIndicator = new Map<string, IndicatorStat>();

    for (const row of logRows) {
      if (!row.indicatorId) {
        continue;
      }

      const behaviorPoints = Math.abs(row.xpValue || 0) + Math.abs(row.hpValue || 0);
      if (behaviorPoints <= 0) {
        continue;
      }

      const observationCount = Number(row.count) || 0;
      if (observationCount <= 0) {
        continue;
      }

      const statKey = this.buildIndicatorStatKey(row.studentId, row.indicatorId);
      const current = statsByStudentIndicator.get(statKey) || {
        positivePoints: 0,
        negativePoints: 0,
        observations: 0,
        positiveObservations: 0,
        negativeObservations: 0,
      };
      const totalPointsFromBehavior = observationCount * behaviorPoints;

      current.observations += observationCount;
      if (row.isPositive) {
        current.positivePoints += totalPointsFromBehavior;
        current.positiveObservations += observationCount;
      } else {
        current.negativePoints += totalPointsFromBehavior;
        current.negativeObservations += observationCount;
      }

      statsByStudentIndicator.set(statKey, current);
    }

    return {
      indicatorStartPeriod,
      isHistoricalWithoutBreakdown,
      indicatorsByCompetency,
      statsByStudentIndicator,
    };
  }

  private buildIndicatorBreakdownForGrade(
    studentProfileId: string,
    competencyId: string,
    context: IndicatorBreakdownContext,
    gradeScaleType: GradeScaleType | null,
    parsedScaleConfig: unknown,
  ): Pick<GradebookGradeEntry, 'indicatorBreakdownStatus' | 'indicatorStartPeriod' | 'indicatorBreakdown'> {
    const indicatorDefinitions = context.indicatorsByCompetency.get(competencyId) || [];

    if (indicatorDefinitions.length === 0) {
      return {
        indicatorBreakdownStatus: 'NOT_CONFIGURED',
        indicatorStartPeriod: context.indicatorStartPeriod,
        indicatorBreakdown: [],
      };
    }

    if (context.isHistoricalWithoutBreakdown) {
      return {
        indicatorBreakdownStatus: 'HISTORICAL_NO_BREAKDOWN',
        indicatorStartPeriod: context.indicatorStartPeriod,
        indicatorBreakdown: [],
      };
    }

    const indicatorBreakdown = this.buildIndicatorAssessmentsForCompetency(studentProfileId, competencyId, context).map((indicator) => {
      const gradeLabel = indicator.hasEvidence && indicator.score !== null
        ? this.convertToGradeLabel(indicator.score, gradeScaleType, parsedScaleConfig)
        : null;

      return {
        id: indicator.id,
        name: indicator.name,
        description: indicator.description,
        score: indicator.score,
        gradeLabel,
        bucket: indicator.hasEvidence && indicator.score !== null && gradeLabel
          ? this.getPerformanceBucket(indicator.score, gradeScaleType, gradeLabel)
          : null,
        observations: indicator.observations,
        positiveObservations: indicator.positiveObservations,
        negativeObservations: indicator.negativeObservations,
        positivePoints: indicator.positivePoints,
        negativePoints: indicator.negativePoints,
        evidenceWeight: indicator.evidenceWeight,
        hasEvidence: indicator.hasEvidence,
      };
    });

    return {
      indicatorBreakdownStatus: 'AVAILABLE',
      indicatorStartPeriod: context.indicatorStartPeriod,
      indicatorBreakdown,
    };
  }

  private buildIndicatorAssessmentsForCompetency(
    studentProfileId: string,
    competencyId: string,
    context: IndicatorBreakdownContext,
  ): IndicatorAssessment[] {
    const indicatorDefinitions = context.indicatorsByCompetency.get(competencyId) || [];

    return indicatorDefinitions.map((indicator) => {
      const stat = context.statsByStudentIndicator.get(this.buildIndicatorStatKey(studentProfileId, indicator.id));

      if (!stat || stat.observations === 0) {
        return {
          id: indicator.id,
          name: indicator.name,
          description: indicator.description,
          score: null,
          observations: 0,
          positiveObservations: 0,
          negativeObservations: 0,
          positivePoints: 0,
          negativePoints: 0,
          evidenceWeight: 0,
          hasEvidence: false,
        };
      }

      const totalPoints = stat.positivePoints + stat.negativePoints;
      let scorePercent: number;
      if (stat.negativePoints === 0) {
        scorePercent = 100;
      } else if (stat.positivePoints === 0) {
        scorePercent = 0;
      } else {
        scorePercent = (stat.positivePoints / totalPoints) * 100;
      }

      const score = this.getEvidenceAdjustedScore(scorePercent, stat.observations);

      return {
        id: indicator.id,
        name: indicator.name,
        description: indicator.description,
        score: Number(score.toFixed(2)),
        observations: stat.observations,
        positiveObservations: stat.positiveObservations,
        negativeObservations: stat.negativeObservations,
        positivePoints: stat.positivePoints,
        negativePoints: stat.negativePoints,
        evidenceWeight: this.getEvidenceWeight(stat.observations),
        hasEvidence: true,
      };
    });
  }

  private buildIndicatorActivitiesForCompetency(
    studentProfileId: string,
    competencyId: string,
    context: IndicatorBreakdownContext,
  ): ActivityScoreData[] {
    if (context.isHistoricalWithoutBreakdown) {
      return [];
    }

    const weightOf = new Map((context.indicatorsByCompetency.get(competencyId) || []).map((d) => [d.id, Math.max(1, d.weight || 1)]));
    return this.buildIndicatorAssessmentsForCompetency(studentProfileId, competencyId, context)
      .filter((indicator) => indicator.hasEvidence && indicator.score !== null && indicator.evidenceWeight > 0)
      .map((indicator) => ({
        type: 'INDICATOR',
        id: indicator.id,
        name: indicator.name,
        score: indicator.score as number,
        // La evidencia de cada destreza pesa según el peso que le dio el docente.
        weight: indicator.evidenceWeight * (weightOf.get(indicator.id) ?? 1),
        competencyId,
      }));
  }

  private normalizeGradebookEntry(
    rawGrade: GradeRow,
    gradeScaleType: GradeScaleType | null,
    parsedScaleConfig: unknown,
    options: { isClosed: boolean; includePrivate: boolean },
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

    // Bimestre cerrado: vale la etiqueta guardada (un cambio de escala posterior no la reescribe).
    const gradeLabel = options.isClosed && rawGrade.gradeLabel
      ? rawGrade.gradeLabel
      : rawGrade.isManualOverride && rawGrade.manualLabel
        ? rawGrade.manualLabel
        : this.convertToGradeLabel(effectiveScore, gradeScaleType, parsedScaleConfig);
    const hasCalculated = rawGrade.calculatedScore !== null && rawGrade.calculatedScore !== undefined;
    const calculatedScore = hasCalculated ? Number(this.toNumericScore(rawGrade.calculatedScore).toFixed(2)) : null;
    const calculatedLabel = calculatedScore === null
      ? null
      : options.isClosed && rawGrade.calculatedLabel
        ? rawGrade.calculatedLabel
        : this.convertToGradeLabel(calculatedScore, gradeScaleType, parsedScaleConfig);

    return {
      id: rawGrade.id,
      competencyId: rawGrade.competencyId,
      competencyName: rawGrade.competencyName || 'Competencia',
      score: Number(effectiveScore.toFixed(2)),
      gradeLabel,
      bucket: this.getPerformanceBucket(effectiveScore, gradeScaleType, gradeLabel),
      activitiesCount: rawGrade.activitiesCount,
      calculationDetails: normalizedCalculationDetails,
      indicatorBreakdownStatus: 'NOT_CONFIGURED',
      indicatorStartPeriod: null,
      indicatorBreakdown: [],
      isManualOverride: rawGrade.isManualOverride,
      manualScore: hasManualScore ? Number(this.toNumericScore(rawGrade.manualScore).toFixed(2)) : null,
      manualLabel: rawGrade.isManualOverride ? rawGrade.manualLabel ?? gradeLabel : null,
      calculatedScore,
      calculatedLabel,
      calculatedChanged: rawGrade.isManualOverride && rawGrade.activitiesCount > 0 && calculatedLabel !== null && calculatedLabel !== gradeLabel,
      manualNote: rawGrade.manualNote || null,
      ...(options.includePrivate ? { privateNote: rawGrade.privateNote || null } : {}),
      conclusion: rawGrade.conclusion || null,
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
      competencyIndicatorStartPeriod: classrooms.competencyIndicatorStartPeriod,
      gradeEvaluationWeight: classrooms.gradeEvaluationWeight,
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
    // Un bimestre cerrado queda congelado: no se recalcula (hay que reabrirlo para cambiar notas).
    await this.ensurePeriodIsOpen(classroomId, resolvedPeriod);

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
    // Evaluaciones propias del docente en este bimestre (nota directa por competencia).
    const evaluationRows = await db.select({
      competencyId: gradeEvaluations.competencyId,
      id: gradeEvaluations.id,
      title: gradeEvaluations.title,
      weight: gradeEvaluations.weight,
      score: gradeEvaluationScores.score,
    })
      .from(gradeEvaluationScores)
      .innerJoin(gradeEvaluations, eq(gradeEvaluationScores.evaluationId, gradeEvaluations.id))
      .where(and(
        eq(gradeEvaluationScores.studentProfileId, studentProfileId),
        eq(gradeEvaluations.classroomId, classroomId),
        eq(gradeEvaluations.period, resolvedPeriod),
      ));
    const evaluationWeight = Math.min(100, Math.max(0, classroom.gradeEvaluationWeight ?? 100)) / 100;

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
    const indicatorContext = await this.buildIndicatorBreakdownContext(
      classroomId,
      [studentProfileId],
      competencyIds,
      dateRange,
      resolvedPeriod,
      classroom.competencyIndicatorStartPeriod || null,
    );
    const gradesToPersist: Array<{
      existingGradeId?: string;
      data: {
        classroomId: string;
        studentProfileId: string;
        competencyId: string;
        period: string;
        score: string;
        gradeLabel: string;
        calculatedScore: string;
        calculatedLabel: string;
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
          evaluationScore: number | null;
          evidenceScore: number | null;
          evaluationWeight: number;
        };
        activitiesCount: number;
        calculatedAt: Date;
        updatedAt: Date;
      };
    }> = [];

    // 3. Para cada competencia, calcular el puntaje
    for (const comp of classCompetencies) {
      const baseActivities = await this.getStudentActivityScores(
        studentProfileId,
        comp.competencyId,
        classroomId,
        dateRange
      );
      const hasConfiguredIndicators = !indicatorContext.isHistoricalWithoutBreakdown
        && (indicatorContext.indicatorsByCompetency.get(comp.competencyId)?.length || 0) > 0;
      const indicatorActivities = hasConfiguredIndicators
        ? this.buildIndicatorActivitiesForCompetency(studentProfileId, comp.competencyId, indicatorContext)
        : [];
      // Con destrezas, la evidencia por destreza reemplaza al agregado de comportamientos. Mientras el alumno
      // no tenga evidencia por destreza, sigue contando la general (agregar una destreza no borra su nota).
      const activities = hasConfiguredIndicators && indicatorActivities.length > 0
        ? [
            ...baseActivities.filter((activity) => activity.type !== 'BEHAVIOR'),
            ...indicatorActivities,
          ]
        : baseActivities;

      // Evidencia gamificada: promedio ponderado de actividades, comportamientos, insignias…
      let totalWeightedScore = 0;
      let totalWeight = 0;

      for (const activity of activities) {
        totalWeightedScore += activity.score * activity.weight;
        totalWeight += activity.weight;
      }

      const evidenceScore = totalWeight > 0 ? totalWeightedScore / totalWeight : null;

      // Evaluaciones propias: promedio ponderado por el peso de cada evaluación.
      const evaluations = evaluationRows
        .filter((row) => row.competencyId === comp.competencyId)
        .map((row) => ({
          type: 'EVALUATION',
          id: row.id,
          name: row.title,
          score: this.toNumericScore(row.score),
          weight: Math.max(1, row.weight || 1),
          competencyId: comp.competencyId,
        }));
      const evaluationTotal = evaluations.reduce((sum, e) => sum + e.weight, 0);
      const evaluationScore = evaluationTotal > 0
        ? evaluations.reduce((sum, e) => sum + e.score * e.weight, 0) / evaluationTotal
        : null;

      // Mezcla: con ambas, el peso de las evaluaciones lo decide el docente; si solo hay una, esa manda.
      const rawScore = evaluationScore !== null && evidenceScore !== null
        ? evaluationWeight * evaluationScore + (1 - evaluationWeight) * evidenceScore
        : evaluationScore ?? evidenceScore ?? 0;
      const gradeLabel = this.convertToGradeLabel(rawScore, classroom.gradeScaleType, parsedScaleConfig);
      const allSources = [...evaluations, ...activities];

      const calculationDetails = {
        activities: allSources.map(a => ({
          type: a.type,
          id: a.id,
          name: a.name,
          score: a.score,
          weight: a.weight,
        })),
        totalWeight,
        rawScore,
        evaluationScore: evaluationScore === null ? null : Number(evaluationScore.toFixed(2)),
        evidenceScore: evidenceScore === null ? null : Number(evidenceScore.toFixed(2)),
        evaluationWeight: Math.round(evaluationWeight * 100),
      };

      const gradeData = {
        classroomId,
        studentProfileId,
        competencyId: comp.competencyId,
        period: resolvedPeriod,
        score: rawScore.toFixed(2),
        gradeLabel,
        calculatedScore: rawScore.toFixed(2),
        calculatedLabel: gradeLabel,
        calculationDetails,
        activitiesCount: allSources.length,
        calculatedAt: now,
        updatedAt: now,
      };

      // Se guarda siempre la calculada; la efectiva solo cambia si no hay ajuste manual.
      const existingGrade = existingGradesByCompetency.get(comp.competencyId);
      gradesToPersist.push({
        existingGradeId: existingGrade?.id,
        data: gradeData,
      });

      results.push({
        competencyId: comp.competencyId,
        competencyName: comp.competencyName || '',
        score: rawScore,
        gradeLabel,
        activitiesCount: allSources.length,
        activities: allSources,
      });
    }

    if (gradesToPersist.length > 0) {
      await db.transaction(async (tx) => {
        for (const gradeToPersist of gradesToPersist) {
          if (gradeToPersist.existingGradeId) {
            const { score, gradeLabel, ...calculated } = gradeToPersist.data;
            await tx.update(studentGrades)
              .set(calculated)
              .where(eq(studentGrades.id, gradeToPersist.existingGradeId));
            // Condicional: un ajuste manual simultáneo no queda pisado por el cálculo.
            await tx.update(studentGrades)
              .set({ score, gradeLabel })
              .where(and(eq(studentGrades.id, gradeToPersist.existingGradeId), eq(studentGrades.isManualOverride, false)));
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

    // También las archivadas: lo ganado se queda, y la evidencia de la nota no desaparece al archivar.
    const competencyBadges = await db.select()
      .from(badges)
      .where(and(
        eq(badges.classroomId, classroomId),
        eq(badges.competencyId, competencyId),
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

    // Una insignia es una observación del profe: la rareza influye, pero con tope 30, como los
    // comportamientos (máx. 30) y las actividades cronometradas (30). Antes pesaba hasta 100.
    const getBadgeWeight = (rarity: string | null) => (
      rarity === 'LEGENDARY' ? 30 :
      rarity === 'EPIC' ? 25 :
      rarity === 'RARE' ? 20 : 15
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

  private convertToGradeLabel(score: number, scaleType: GradeScaleType | null, customConfig: unknown): string {
    return scoreToLabel(score, scaleType, customConfig);
  }

  // ═══════════════════════════════════════════════════════════
  // CONSULTAS
  // ═══════════════════════════════════════════════════════════

  /** Nombre real del alumno (libreta y exportación); el personaje va aparte. */
  private resolveRealName(row: { firstName?: string | null; lastName?: string | null; displayName?: string | null; characterName?: string | null }): string {
    const real = `${row.firstName || ''} ${row.lastName || ''}`.trim();
    return real || row.displayName?.trim() || row.characterName || 'Estudiante';
  }

  /** Cálculo más antiguo del grupo: con que una nota esté vieja, toca recalcular. */
  private async lastCalculatedAt(classroomId: string, period: string, studentProfileId?: string): Promise<Date | null> {
    const [row] = await db.select({ last: sql<Date | null>`MIN(${studentGrades.calculatedAt})`.mapWith(studentGrades.calculatedAt) })
      .from(studentGrades)
      .where(and(
        eq(studentGrades.classroomId, classroomId),
        eq(studentGrades.period, period),
        studentProfileId ? eq(studentGrades.studentProfileId, studentProfileId) : undefined,
      ));
    // mapWith: la fecha se lee como la columna (hora UTC guardada), no como hora local del servidor.
    return row?.last ?? null;
  }

  /**
   * Recálculo automático del bimestre abierto al consultar: como mucho una vez cada AUTO_RECALC_MS.
   * Las consultas simultáneas comparten el mismo recálculo en curso.
   */
  private async autoRecalculate(classroomId: string, period: string, studentProfileId?: string): Promise<void> {
    if (await this.isPeriodClosed(classroomId, period) || await this.isFuturePeriod(classroomId, period)) return;
    const last = await this.lastCalculatedAt(classroomId, period, studentProfileId);
    if (last && Date.now() - last.getTime() < AUTO_RECALC_MS) return;
    const key = `${classroomId}|${period}|${studentProfileId ?? '*'}`;
    let running = recalcInFlight.get(key);
    if (!running) {
      running = (studentProfileId
        ? this.calculateStudentGrades(classroomId, studentProfileId, period)
        : this.recalculateClassroomGrades(classroomId, period)
      ).finally(() => recalcInFlight.delete(key));
      recalcInFlight.set(key, running);
    }
    try {
      await running;
    } catch (error) {
      console.error('Recálculo automático de notas falló:', error);
    }
  }

  private gradeRowColumns() {
    return {
      id: studentGrades.id,
      studentProfileId: studentGrades.studentProfileId,
      competencyId: studentGrades.competencyId,
      competencyName: curriculumCompetencies.name,
      score: studentGrades.score,
      gradeLabel: studentGrades.gradeLabel,
      calculatedScore: studentGrades.calculatedScore,
      calculatedLabel: studentGrades.calculatedLabel,
      activitiesCount: studentGrades.activitiesCount,
      calculationDetails: studentGrades.calculationDetails,
      isManualOverride: studentGrades.isManualOverride,
      manualScore: studentGrades.manualScore,
      manualLabel: studentGrades.manualLabel,
      manualNote: studentGrades.manualNote,
      privateNote: studentGrades.privateNote,
      conclusion: studentGrades.conclusion,
      calculatedAt: studentGrades.calculatedAt,
    };
  }

  /** Competencias activas de la clase, en orden, con nombre corto, peso y cantidad de destrezas. */
  async getClassroomCompetencyColumns(classroomId: string) {
    const rows = await db.select({
      id: classroomCompetencies.competencyId,
      name: curriculumCompetencies.name,
      shortName: curriculumCompetencies.shortName,
      displayOrder: curriculumCompetencies.displayOrder,
      weight: classroomCompetencies.weight,
      isCustom: sql<number>`${curriculumCompetencies.sourceType} <> 'OFFICIAL'`,
    })
      .from(classroomCompetencies)
      .innerJoin(curriculumCompetencies, eq(classroomCompetencies.competencyId, curriculumCompetencies.id))
      .where(and(eq(classroomCompetencies.classroomId, classroomId), eq(classroomCompetencies.isActive, true)))
      .orderBy(asc(curriculumCompetencies.displayOrder), asc(curriculumCompetencies.name));
    // Destrezas de cada competencia (columnas del libro), en su orden.
    const indicatorRows = await db.select({
      id: classroomCompetencyIndicators.id,
      competencyId: classroomCompetencyIndicators.competencyId,
      name: classroomCompetencyIndicators.name,
      weight: classroomCompetencyIndicators.weight,
    })
      .from(classroomCompetencyIndicators)
      .where(and(eq(classroomCompetencyIndicators.classroomId, classroomId), eq(classroomCompetencyIndicators.isActive, true)))
      .orderBy(asc(classroomCompetencyIndicators.displayOrder), asc(classroomCompetencyIndicators.createdAt));
    return rows.map((r, index) => {
      const code = `C${index + 1}`;
      const indicators = indicatorRows
        .filter((i) => i.competencyId === r.id)
        .map((i, j) => ({ id: i.id, code: `${code}.${j + 1}`, name: i.name, weight: i.weight }));
      return {
        id: r.id,
        code,
        name: r.name,
        shortName: r.shortName,
        weight: r.weight,
        isCustom: Boolean(Number(r.isCustom)),
        indicatorCount: indicators.length,
        indicators,
      };
    });
  }

  private async buildGradeEntries(
    classroomId: string,
    period: string,
    rows: GradeRow[],
    options: { includePrivate: boolean },
  ) {
    const { gradeScaleType, gradeScaleConfig, competencyIndicatorStartPeriod } = await this.getClassroomScaleSettings(classroomId);
    const parsedScaleConfig = this.parseGradeScaleConfig(gradeScaleConfig);
    const isClosed = await this.isPeriodClosed(classroomId, period);
    const indicatorContext = rows.length > 0
      ? await this.buildIndicatorBreakdownContext(
          classroomId,
          [...new Set(rows.map((row) => row.studentProfileId))],
          [...new Set(rows.map((row) => row.competencyId))],
          await this.getBimesterDateRange(classroomId, period),
          period,
          competencyIndicatorStartPeriod,
        )
      : {
          indicatorStartPeriod: competencyIndicatorStartPeriod,
          isHistoricalWithoutBreakdown: false,
          indicatorsByCompetency: new Map(),
          statsByStudentIndicator: new Map(),
        };
    const entries = rows.map((row) => ({
      studentProfileId: row.studentProfileId,
      entry: {
        ...this.normalizeGradebookEntry(row, gradeScaleType, parsedScaleConfig, { isClosed, includePrivate: options.includePrivate }),
        ...this.buildIndicatorBreakdownForGrade(row.studentProfileId, row.competencyId, indicatorContext, gradeScaleType, parsedScaleConfig),
      },
    }));
    return { entries, gradeScaleType, parsedScaleConfig, isClosed };
  }

  async getStudentGrades(studentProfileId: string, period: string = 'CURRENT', options: { includePrivate?: boolean } = {}): Promise<StudentGradebookResponse> {
    const classroomId = await this.getClassroomIdByStudentProfile(studentProfileId);
    if (!classroomId) {
      throw new Error('Estudiante no encontrado');
    }

    const resolvedPeriod = await this.resolveClassroomPeriod(classroomId, period);
    await this.autoRecalculate(classroomId, resolvedPeriod, studentProfileId);

    const rows = await db.select({
      ...this.gradeRowColumns(),
      characterName: studentProfiles.characterName,
      displayName: studentProfiles.displayName,
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

    const { entries, gradeScaleType, parsedScaleConfig } = await this.buildGradeEntries(classroomId, resolvedPeriod, rows, { includePrivate: !!options.includePrivate });
    const grades = entries.map((e) => e.entry);
    const weights = new Map((await this.getClassroomCompetencyColumns(classroomId)).map((c) => [c.id, c.weight]));

    return {
      studentProfileId,
      studentName: rows.length > 0 ? this.resolveRealName(rows[0]) : 'Estudiante',
      period: resolvedPeriod,
      gradeScaleType,
      average: this.buildAverageSummary(grades, gradeScaleType, parsedScaleConfig, weights),
      grades,
    };
  }

  /**
   * Vista del alumno ("Mis calificaciones"): por competencia (en el orden de la clase), su nivel o null si
   * aún no tiene evidencias, de dónde sale y si hay pocas evidencias. Solo bimestres de los años de la
   * clase y nunca futuros: un GET del alumno no crea notas de periodos ajenos.
   */
  async getStudentGradesView(studentProfileId: string, period: string = 'CURRENT'): Promise<StudentGradesView> {
    const classroomId = await this.getClassroomIdByStudentProfile(studentProfileId);
    if (!classroomId) throw new Error('Estudiante no encontrado');

    const resolved = await this.resolveClassroomPeriod(classroomId, period);
    const status = await this.getBimesterStatus(classroomId);
    if (!status.availableYears.includes(Number(resolved.slice(0, 4)))) {
      throw new Error('Periodo invalido para esta clase');
    }

    const [{ gradeScaleType, gradeScaleConfig }, [settings], competencies, isFuture, isClosed] = await Promise.all([
      this.getClassroomScaleSettings(classroomId),
      db.select({ showReasonToStudent: classrooms.showReasonToStudent }).from(classrooms).where(eq(classrooms.id, classroomId)),
      this.getClassroomCompetencyColumns(classroomId),
      this.isFuturePeriod(classroomId, resolved),
      this.isPeriodClosed(classroomId, resolved),
    ]);
    const parsedScaleConfig = this.parseGradeScaleConfig(gradeScaleConfig);
    const showReasons = settings?.showReasonToStudent ?? true;
    const base = {
      period: resolved,
      isCurrent: resolved === status.currentBimester,
      isClosed,
      isFuture,
      scaleKind: gradeScaleType === 'PERU_VIGESIMAL'
        ? 'vigesimal' as const
        : scaleOptions(gradeScaleType, parsedScaleConfig).kind === 'letters' ? 'letters' as const : 'number' as const,
      showReasons,
    };
    const withoutGrade = (c: GradebookCompetencyColumn): StudentCompetencyView => ({
      id: c.id, name: c.name, shortName: c.shortName ?? null, level: null, isManual: false, lowEvidence: false,
      records: 0, evaluations: 0, comment: null, conclusion: null, skills: [], sources: [],
    });
    if (isFuture || competencies.length === 0) return { ...base, competencies: competencies.map(withoutGrade) };

    const gradebook = await this.getStudentGrades(studentProfileId, resolved, { includePrivate: false });
    const gradeByCompetency = new Map(gradebook.grades.map((grade) => [grade.competencyId, grade]));
    const dateRange = await this.getBimesterDateRange(classroomId, resolved);
    const competencyIds = competencies.map((c) => c.id);
    const [behaviorRows, evaluationRows] = await Promise.all([
      // Mismo criterio que getBehaviorScores: comportamientos activos de la competencia, una vez por registro.
      db.select({
        competencyId: behaviors.competencyId,
        name: behaviors.name,
        isPositive: behaviors.isPositive,
        xpValue: behaviors.xpValue,
        hpValue: behaviors.hpValue,
        count: sql<number>`COUNT(DISTINCT ${pointLogs.createdAt})`,
      })
        .from(pointLogs)
        .innerJoin(behaviors, eq(pointLogs.behaviorId, behaviors.id))
        .where(and(
          eq(pointLogs.studentId, studentProfileId),
          eq(pointLogs.isReverted, false),
          eq(behaviors.classroomId, classroomId),
          eq(behaviors.isActive, true),
          inArray(behaviors.competencyId, competencyIds),
          gte(pointLogs.createdAt, dateRange.startDate),
          lte(pointLogs.createdAt, dateRange.endDate),
        ))
        .groupBy(behaviors.id, behaviors.competencyId, behaviors.name, behaviors.isPositive, behaviors.xpValue, behaviors.hpValue),
      db.select({
        competencyId: gradeEvaluations.competencyId,
        title: gradeEvaluations.title,
        label: gradeEvaluationScores.label,
        score: gradeEvaluationScores.score,
        note: gradeEvaluationScores.note,
      })
        .from(gradeEvaluationScores)
        .innerJoin(gradeEvaluations, eq(gradeEvaluationScores.evaluationId, gradeEvaluations.id))
        .where(and(
          eq(gradeEvaluationScores.studentProfileId, studentProfileId),
          eq(gradeEvaluations.classroomId, classroomId),
          eq(gradeEvaluations.period, resolved),
        )),
    ]);

    const levelOf = (score: number): LevelView => {
      const label = this.convertToGradeLabel(score, gradeScaleType, parsedScaleConfig);
      return { label, bucket: performanceBucket(score, gradeScaleType, label) };
    };
    // "Revisó la tarea (+5 XP)" → "Revisó la tarea"; sin motivo ("Punto manual +5 XP") no hay nombre.
    const teacherReason = (name: string) => (name.startsWith('Punto manual') ? null : name.replace(/\s*\([+-]\d+ [A-Z]+\)$/, '').trim() || null);
    const OTHER_SOURCES: Record<string, StudentGradeSource['kind']> = {
      TIMED: 'activity', EXPEDITION: 'expedition', JIRO_EXPEDITION: 'expedition', BADGE: 'badge', MANUAL_POINTS: 'teacher',
    };

    return {
      ...base,
      competencies: competencies.map((competency) => {
        const grade = gradeByCompetency.get(competency.id);
        if (!grade || (grade.activitiesCount <= 0 && !grade.isManualOverride)) return withoutGrade(competency);

        const activities = grade.calculationDetails?.activities ?? [];
        const usesBehaviors = activities.some((activity) => activity.type === 'BEHAVIOR');
        const usesSkills = activities.some((activity) => activity.type === 'INDICATOR');
        const behaviorItems = usesBehaviors
          ? behaviorRows
            .filter((row) => row.competencyId === competency.id && Number(row.count) > 0 && Math.abs(row.xpValue || 0) + Math.abs(row.hpValue || 0) > 0)
            .map((row) => ({ name: row.name, isPositive: row.isPositive ?? true, count: Number(row.count) }))
          : [];
        const positive = behaviorItems.filter((item) => item.isPositive).reduce((sum, item) => sum + item.count, 0);
        const negative = behaviorItems.filter((item) => !item.isPositive).reduce((sum, item) => sum + item.count, 0);
        const skills = grade.indicatorBreakdownStatus === 'AVAILABLE'
          ? grade.indicatorBreakdown.map((indicator) => ({
            id: indicator.id,
            name: indicator.name,
            level: indicator.hasEvidence && indicator.gradeLabel && indicator.bucket ? { label: indicator.gradeLabel, bucket: indicator.bucket } : null,
            positive: indicator.positiveObservations,
            negative: indicator.negativeObservations,
          }))
          : [];
        const evaluations = evaluationRows.filter((row) => row.competencyId === competency.id);

        const sources: StudentGradeSource[] = [];
        if (usesBehaviors) sources.push({ kind: 'behaviors', name: null, level: null, positive, negative, items: showReasons ? behaviorItems : [] });
        evaluations.forEach((row) => sources.push({
          kind: 'evaluation',
          name: row.title,
          level: { label: row.label, bucket: performanceBucket(this.toNumericScore(row.score), gradeScaleType, row.label) },
          comment: row.note || null,
        }));
        const others = activities.filter((activity) => OTHER_SOURCES[activity.type]);
        others.forEach((activity) => {
          const kind = OTHER_SOURCES[activity.type];
          sources.push({
            kind,
            name: kind === 'teacher' ? (showReasons ? teacherReason(activity.name) : null) : activity.name,
            level: kind === 'badge' ? null : levelOf(activity.score),
          });
        });

        const records = positive + negative
          + (usesSkills ? skills.reduce((sum, skill) => sum + skill.positive + skill.negative, 0) : 0)
          + others.length;
        return {
          id: competency.id,
          name: competency.name,
          shortName: competency.shortName ?? null,
          level: { label: grade.gradeLabel, bucket: grade.bucket },
          isManual: grade.isManualOverride,
          lowEvidence: !grade.isManualOverride && evaluations.length === 0 && records < FULL_CONFIDENCE_OBSERVATIONS,
          records,
          evaluations: evaluations.length,
          comment: grade.manualNote ?? null,
          conclusion: isClosed ? grade.conclusion ?? null : null,
          skills,
          sources,
        };
      }),
    };
  }

  async getClassroomGrades(classroomId: string, period: string = 'CURRENT'): Promise<ClassroomGradebookResponse> {
    const resolvedPeriod = await this.resolveClassroomPeriod(classroomId, period);
    await this.autoRecalculate(classroomId, resolvedPeriod);

    const [competencies, studentRows, rows, [settings]] = await Promise.all([
      this.getClassroomCompetencyColumns(classroomId),
      db.select({
        id: studentProfiles.id,
        characterName: studentProfiles.characterName,
        displayName: studentProfiles.displayName,
        firstName: users.firstName,
        lastName: users.lastName,
      })
        .from(studentProfiles)
        .leftJoin(users, eq(studentProfiles.userId, users.id))
        .where(and(eq(studentProfiles.classroomId, classroomId), eq(studentProfiles.isActive, true), eq(studentProfiles.isDemo, false))),
      db.select(this.gradeRowColumns())
        .from(studentGrades)
        .leftJoin(curriculumCompetencies, eq(studentGrades.competencyId, curriculumCompetencies.id))
        .where(and(eq(studentGrades.classroomId, classroomId), eq(studentGrades.period, resolvedPeriod))),
      db.select({ gradeEvaluationWeight: classrooms.gradeEvaluationWeight }).from(classrooms).where(eq(classrooms.id, classroomId)),
    ]);

    const activeCompetencies = new Set(competencies.map((c) => c.id));
    const visibleRows = rows.filter((row) => activeCompetencies.has(row.competencyId));
    const { entries, gradeScaleType, parsedScaleConfig, isClosed } = await this.buildGradeEntries(classroomId, resolvedPeriod, visibleRows, { includePrivate: true });
    const gradesByStudent = new Map<string, GradebookGradeEntry[]>();
    for (const { studentProfileId, entry } of entries) {
      const list = gradesByStudent.get(studentProfileId) ?? [];
      list.push(entry);
      gradesByStudent.set(studentProfileId, list);
    }
    const weights = new Map(competencies.map((c) => [c.id, c.weight]));

    // Todos los alumnos activos (aunque aún no tengan notas) y todas las competencias.
    const students = studentRows
      .map((student) => {
        const grades = gradesByStudent.get(student.id) ?? [];
        return {
          studentProfileId: student.id,
          studentName: this.resolveRealName(student),
          characterName: student.characterName ?? null,
          average: this.buildAverageSummary(grades, gradeScaleType, parsedScaleConfig, weights),
          grades,
        };
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName, 'es'));

    return {
      classroomId,
      period: resolvedPeriod,
      gradeScaleType,
      scale: scaleOptions(gradeScaleType, parsedScaleConfig),
      competencies,
      isClosed,
      evaluationWeight: settings?.gradeEvaluationWeight ?? 100,
      lastCalculatedAt: await this.lastCalculatedAt(classroomId, resolvedPeriod),
      students,
      summary: this.buildClassroomSummary(students),
    };
  }

  async recalculateClassroomGrades(classroomId: string, period: string = 'CURRENT') {
    const resolvedPeriod = await this.resolveClassroomPeriod(classroomId, period);
    await this.ensurePeriodIsOpen(classroomId, resolvedPeriod);

    const students = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true)
      ));

    // De a pocos en paralelo: cada alumno son varias consultas por competencia.
    const results: Array<{ studentId: string; grades: GradeCalculationResult[] }> = [];
    const CONCURRENCY = 4;
    for (let i = 0; i < students.length; i += CONCURRENCY) {
      const chunk = students.slice(i, i + CONCURRENCY);
      const done = await Promise.all(chunk.map(async (student) => ({
        studentId: student.id,
        grades: await this.calculateStudentGrades(classroomId, student.id, resolvedPeriod),
      })));
      results.push(...done);
    }

    return results;
  }

  /** Recalcula a unos alumnos concretos (p. ej., tras guardar una evaluación). */
  async recalculateStudents(classroomId: string, period: string, studentProfileIds: string[]) {
    if (studentProfileIds.length === 0 || await this.isPeriodClosed(classroomId, period)) return;
    const CONCURRENCY = 4;
    for (let i = 0; i < studentProfileIds.length; i += CONCURRENCY) {
      await Promise.all(studentProfileIds.slice(i, i + CONCURRENCY).map((id) => this.calculateStudentGrades(classroomId, id, period)));
    }
  }

  /**
   * Nota manual con un valor de la escala de la clase (AD, 17, 85…). La calculada se conserva
   * para poder volver a ella y para avisar si cambia.
   */
  async setManualGrade(gradeId: string, value: string, manualNote?: string | null) {
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
    const { score, label } = scaleValueToScore(value, classroom?.gradeScaleType || null, parsedScaleConfig);

    await db.update(studentGrades)
      .set({
        isManualOverride: true,
        score: score.toFixed(2),
        gradeLabel: label,
        manualScore: score.toFixed(2),
        manualLabel: label,
        ...(manualNote !== undefined ? { manualNote: manualNote?.trim() || null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(studentGrades.id, gradeId));

    return { success: true, score, label };
  }

  /** Vuelve a la nota calculada (conserva los comentarios). */
  async clearManualGrade(gradeId: string) {
    const [grade] = await db.select({
      classroomId: studentGrades.classroomId,
      studentProfileId: studentGrades.studentProfileId,
      period: studentGrades.period,
      calculatedScore: studentGrades.calculatedScore,
      calculatedLabel: studentGrades.calculatedLabel,
    }).from(studentGrades).where(eq(studentGrades.id, gradeId));

    if (!grade) throw new Error('Calificación no encontrada');

    await this.ensurePeriodIsOpen(grade.classroomId, grade.period);

    await db.update(studentGrades)
      .set({
        isManualOverride: false,
        manualScore: null,
        manualLabel: null,
        ...(grade.calculatedScore !== null ? { score: String(grade.calculatedScore), gradeLabel: grade.calculatedLabel } : {}),
        updatedAt: new Date(),
      })
      .where(eq(studentGrades.id, gradeId));

    await this.calculateStudentGrades(grade.classroomId, grade.studentProfileId, grade.period);

    return { success: true };
  }

  /**
   * Comentario para el alumno, nota privada y conclusión descriptiva. Se pueden editar aunque el
   * bimestre esté cerrado (la conclusión se suele escribir al cerrar, para la libreta).
   */
  async updateGradeNotes(gradeId: string, notes: { manualNote?: string | null; privateNote?: string | null; conclusion?: string | null }) {
    const [grade] = await db.select({ id: studentGrades.id }).from(studentGrades).where(eq(studentGrades.id, gradeId));
    if (!grade) throw new Error('Calificación no encontrada');
    const clean = (value: string | null | undefined) => (value === undefined ? undefined : value?.trim() || null);
    const patch = Object.fromEntries(Object.entries({
      manualNote: clean(notes.manualNote),
      privateNote: clean(notes.privateNote),
      conclusion: clean(notes.conclusion),
    }).filter(([, value]) => value !== undefined));
    if (Object.keys(patch).length === 0) return { success: true };
    await db.update(studentGrades).set({ ...patch, updatedAt: new Date() }).where(eq(studentGrades.id, gradeId));
    return { success: true };
  }

  /** Ajustes de calificación de la clase: escala y peso de las evaluaciones propias. */
  async updateGradeSettings(classroomId: string, settings: {
    gradeScaleType?: GradeScaleType;
    customRanges?: Array<{ label: string; minPercent: number }>;
    evaluationWeight?: number;
    competencyWeights?: Array<{ competencyId: string; weight: number }>;
  }) {
    for (const item of settings.competencyWeights ?? []) {
      await db.update(classroomCompetencies)
        .set({ weight: Math.max(50, Math.min(300, Math.round(item.weight))) })
        .where(and(eq(classroomCompetencies.classroomId, classroomId), eq(classroomCompetencies.competencyId, item.competencyId)));
    }
    const patch: Partial<typeof classrooms.$inferInsert> = {};
    if (settings.gradeScaleType) patch.gradeScaleType = settings.gradeScaleType;
    if (settings.gradeScaleType === 'CUSTOM') {
      const ranges = (settings.customRanges ?? []).map((r) => ({ label: r.label.trim(), minPercent: r.minPercent, maxPercent: 100, xpReward: 0, gpReward: 0 }));
      if (ranges.length < 2) throw new Error('La escala personalizada debe tener al menos 2 niveles');
      if (!ranges.some((r) => r.minPercent === 0)) throw new Error('La escala personalizada debe tener un nivel que empiece en 0 %');
      if (new Set(ranges.map((r) => r.label.toUpperCase())).size !== ranges.length) throw new Error('Los niveles de la escala no pueden repetirse');
      patch.gradeScaleConfig = { ranges };
    }
    if (settings.evaluationWeight !== undefined) patch.gradeEvaluationWeight = Math.round(settings.evaluationWeight);
    if (Object.keys(patch).length === 0) return { success: true };
    await db.update(classrooms).set({ ...patch, updatedAt: new Date() }).where(eq(classrooms.id, classroomId));
    // Cambió la escala o el peso de las evaluaciones: el bimestre abierto se recalcula en la próxima consulta.
    const current = await this.resolveClassroomPeriod(classroomId, 'CURRENT');
    await db.update(studentGrades).set({ calculatedAt: new Date(0) })
      .where(and(eq(studentGrades.classroomId, classroomId), eq(studentGrades.period, current)));
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
      bimesterDates: classrooms.bimesterDates,
      createdAt: classrooms.createdAt,
    }).from(classrooms).where(eq(classrooms.id, classroomId));

    if (!classroom) throw new Error('Clase no encontrada');

    const closedBimesters = this.parseClosedBimesters(classroom.closedBimesters);
    const configuredDates = this.parseBimesterDates(classroom.bimesterDates);
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

    const bimesters = await Promise.all(allBimesters.map(async (b) => {
      const isFuture = await this.isFuturePeriod(classroomId, b);
      const range = isFuture && !configuredDates[b] ? null : await this.getBimesterDateRange(classroomId, b).catch(() => null);
      return {
        period: b,
        label: `Bimestre ${b.split('-B')[1]}`,
        isCurrent: b === currentBimester,
        isClosed: closedBimesters.some((cb) => cb.period === b),
        isFuture,
        closedAt: closedBimesters.find((cb) => cb.period === b)?.closedAt,
        // Rango efectivo; datesConfigured = el docente (o el cierre) fijó las fechas.
        start: range?.startDate.toISOString() ?? null,
        end: configuredDates[b]?.end ?? null,
        datesConfigured: !!configuredDates[b],
      };
    }));

    return {
      currentBimester,
      closedBimesters,
      selectedYear,
      availableYears,
      allBimesters: bimesters,
    };
  }

  /** Fija las fechas de un bimestre (no se puede si está cerrado; no pueden solaparse con otro). */
  async setBimesterDates(classroomId: string, period: string, start: Date, end: Date) {
    const normalizedPeriod = this.normalizePeriod(period);
    if (normalizedPeriod === 'CURRENT') throw new Error('Periodo invalido. Usa el formato YYYY-B1..B4');
    if (!(start < end)) throw new Error('La fecha de inicio debe ser anterior a la de fin');
    await this.ensurePeriodIsOpen(classroomId, normalizedPeriod);

    const [classroom] = await db.select({ bimesterDates: classrooms.bimesterDates }).from(classrooms).where(eq(classrooms.id, classroomId));
    if (!classroom) throw new Error('Clase no encontrada');
    const dates = this.parseBimesterDates(classroom.bimesterDates);
    const overlapping = Object.entries(dates).find(([p, d]) => p !== normalizedPeriod && new Date(d.start) < end && start < new Date(d.end));
    if (overlapping) throw new Error(`Las fechas no deben cruzarse con el Bimestre ${overlapping[0].split('-B')[1]} (${overlapping[0].split('-B')[0]})`);

    dates[normalizedPeriod] = { start: start.toISOString(), end: end.toISOString() };
    await db.update(classrooms).set({ bimesterDates: dates, updatedAt: new Date() }).where(eq(classrooms.id, classroomId));
    return { success: true, period: normalizedPeriod, ...dates[normalizedPeriod] };
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
   * Cierra un bimestre: recalcula por última vez, fija sus fechas (reabrirlo no las mueve)
   * y congela las notas.
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

    // Última foto: las notas no manuales quedan con la evidencia hasta el cierre.
    await this.recalculateClassroomGrades(classroomId, normalizedPeriod);

    const now = new Date();
    const dates = this.parseBimesterDates(classroom.bimesterDates);
    if (!dates[normalizedPeriod]) {
      const range = await this.getBimesterDateRange(classroomId, normalizedPeriod);
      dates[normalizedPeriod] = { start: range.startDate.toISOString(), end: now.toISOString() };
    }

    closedBimesters.push({
      period: normalizedPeriod,
      closedAt: now.toISOString(),
      closedBy: userId,
    });

    // Si el bimestre que se cierra es el actual, avanzar al siguiente
    const currentRaw = classroom.currentBimester?.trim().toUpperCase();
    const currentBimester = currentRaw && BIMESTER_PERIOD_REGEX.test(currentRaw)
      ? currentRaw
      : `${now.getFullYear()}-B1`;

    let newCurrentBimester = currentBimester;
    if (currentBimester === normalizedPeriod) {
      const [yearPart] = normalizedPeriod.split('-B');
      const bimesterNum = Number(normalizedPeriod.split('-B')[1]);
      newCurrentBimester = bimesterNum < 4 ? `${yearPart}-B${bimesterNum + 1}` : `${Number(yearPart) + 1}-B1`;
    }

    // Condicional: dos cierres simultáneos no duplican la entrada.
    const result = await db.update(classrooms)
      .set({
        closedBimesters,
        bimesterDates: dates,
        currentBimester: newCurrentBimester,
        updatedAt: now,
      })
      .where(and(
        eq(classrooms.id, classroomId),
        sql`NOT JSON_CONTAINS(COALESCE(${classrooms.closedBimesters}, JSON_ARRAY()), JSON_OBJECT('period', ${normalizedPeriod}))`,
      ));
    if (affectedRows(result) === 0) throw new Error('Este bimestre ya está cerrado');

    // Storytelling: completar capítulos tipo BIMESTER
    try {
      const { storyService } = await import('./story.service.js');
      await storyService.onBimesterClosed(classroomId);
    } catch {
      // No bloquea el cierre del bimestre.
    }

    return {
      success: true,
      closedPeriod: normalizedPeriod,
      newCurrentBimester,
    };
  }

  /**
   * Reabre un bimestre cerrado (sus fechas se conservan: la evidencia no se mueve de bimestre).
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

    const closedIndex = closedBimesters.findIndex((cb) => cb.period === normalizedPeriod);
    if (closedIndex === -1) {
      throw new Error('Este bimestre no está cerrado');
    }

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
