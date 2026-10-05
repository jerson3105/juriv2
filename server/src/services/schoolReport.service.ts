import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  attendanceRecords, classrooms, curriculumCompetencies, notifications, schoolEnrollments, schoolExemptions, schoolReportSettings, schoolSections,
  schoolStudentMoves, schoolStudents, schoolTeachingAssignments, schoolWorkshops, schoolYearLevels, schoolYears, schools, studentGrades,
  studentProfiles, users,
  type GradeScaleType,
} from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { parseScaleConfig, performanceBucket, scoreToLabel } from '../utils/gradeScale.js';
import { createNotification } from '../utils/notificationEmitter.js';
import { decryptPii, piiReady } from '../utils/piiCrypto.js';
import { classroomYearIds, limaToday, yearCalendars } from './schoolCalendar.service.js';
import { effectivePlan } from './schoolPlan.service.js';
import { sectionDisplayName } from './schoolSection.service.js';

/**
 * Libreta («Informe de progreso del aprendizaje del estudiante», formato del MINEDU). Por estudiante de una sección: cada
 * área del plan de su grado con sus competencias oficiales del CNEB y el nivel de logro de cada bimestre, el de su clase del
 * área (con un traslado, el de la clase de cada sección; con talleres del área, ponderado por su peso). Decisiones del dueño:
 * sin calificativo de área; la última columna es el nivel final de cada competencia (el último del año, RVM 094-2020); la
 * conclusión de cada periodo se arma con las que exige la norma (inicial A/B/C, primaria B/C, secundaria C); la asistencia
 * se cuenta por día juntando sus clases; sin competencias transversales. Un área exonerada (Religión, Educación Física)
 * dice «EXO». Para la administración, el avance de cada bimestre por sección y área.
 */

export type SchoolLevel = 'INICIAL' | 'PRIMARIA' | 'SECUNDARIA';
export type ReportScale = 'LITERAL' | 'VIGESIMAL';

export interface ReportPeriod {
  code: string;
  number: number;
  startsOn: string;
  /** Cerrado por la administración: sus notas ya no cambian. */
  locked: boolean;
  started: boolean;
  /** Entra en esta libreta: hasta el bimestre elegido y ya empezó. */
  included: boolean;
  status: 'OPEN' | 'REVIEW' | 'LOCKED' | 'PUBLISHED';
}

export interface ReportCompetency {
  id: string;
  name: string;
  grades: Array<string | null>;
  final: string | null;
  /** Por periodo: su nivel pide conclusión y aún no tiene. */
  pending: boolean[];
}
export interface ReportArea { id: string; name: string; workshops: string[]; exempt: boolean; competencies: ReportCompetency[] }
export interface ReportConclusion { area: string; competency: string; text: string }
export interface ReportAttendance { absentJustified: number; absentUnjustified: number; lateJustified: number; lateUnjustified: number }

export interface StudentReport {
  student: {
    id: string;
    firstNames: string;
    lastNames: string;
    siagieCode: string | null;
    document: string | null;
    hasDocument: boolean;
    status: 'ACTIVE' | 'WITHDRAWN';
    withdrawnOn: string | null;
  };
  areas: ReportArea[];
  /** Por periodo: las conclusiones que exige la norma (vacío si el periodo no entra). */
  conclusions: ReportConclusion[][];
  attendance: Array<ReportAttendance | null>;
  /** En los periodos que entran: competencias sin nota y conclusiones obligatorias que faltan. */
  missing: { grades: number; conclusions: number };
}

export interface SectionReport {
  school: { id: string; name: string; logoUrl: string | null; dre: string | null; ugel: string | null; modularCode: string | null; directorName: string | null };
  year: { id: string; name: string; status: 'PLANNING' | 'ACTIVE' | 'CLOSED' };
  section: { id: string; label: string; level: SchoolLevel; levelName: string; grade: number; gradeLabel: string; name: string; tutor: string | null };
  scale: ReportScale;
  periods: ReportPeriod[];
  upTo: string;
  /** El último bimestre que entra aún está abierto: sus notas pueden cambiar. */
  preview: boolean;
  /** El último bimestre del año entra: la columna «final» tiene sentido. */
  showFinal: boolean;
  /** El servidor puede leer los documentos (llaves PII). */
  documentsReadable: boolean;
  /** Las áreas del plan del grado; las que admiten exoneración. */
  plan: Array<{ id: string; name: string }>;
  exemptable: Array<{ id: string; name: string }>;
  students: StudentReport[];
}

/** Las áreas de las que se exonera (Ley de Libertad Religiosa; Educación Física por salud). */
export const EXEMPTABLE_AREAS = ['area-pe-er', 'area-pe-ef'];
export const EXEMPT_LABEL = 'EXO';

const LEVEL_NAME: Record<SchoolLevel, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' };
const LEVEL_ORDER: SchoolLevel[] = ['INICIAL', 'PRIMARIA', 'SECUNDARIA'];
// Conclusiones que exige la norma por nivel (RVM 094-2020, modificada por la RVM 048-2024).
const REQUIRED: Record<SchoolLevel, ReadonlySet<string>> = {
  INICIAL: new Set(['A', 'B', 'C']),
  PRIMARIA: new Set(['B', 'C']),
  SECUNDARIA: new Set(['C']),
};
const LETTER_VALUE: Record<string, number> = { C: 1, B: 2, A: 3, AD: 4 };
const LETTERS = ['C', 'B', 'A', 'AD'];
// Lo que le queda a la clase del área cuando el estudiante lleva talleres del área (el resto, el peso de cada taller).
const MIN_MAIN_WEIGHT = 10;

const documentContext = (studentId: string) => `school_student:${studentId}:document`;
const fullName = (u: { firstName: string | null; lastName: string | null }) => `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();

/** El documento para la libreta: el DNI tal cual; otro documento, con su tipo. Sin llaves o si no se puede leer, nada. */
const readDocument = (student: { id: string; documentType: string | null; documentEncrypted: string | null }) => {
  if (!student.documentEncrypted || !student.documentType || !piiReady()) return null;
  try {
    const number = decryptPii(student.documentEncrypted, documentContext(student.id));
    return student.documentType === 'DNI' ? number : `${student.documentType} ${number}`;
  } catch {
    return null;
  }
};

type GradeRow = {
  classroomId: string;
  studentProfileId: string;
  competencyId: string;
  period: string;
  score: string;
  gradeLabel: string | null;
  isManualOverride: boolean;
  manualScore: string | null;
  manualLabel: string | null;
  activitiesCount: number;
  conclusion: string | null;
  calculatedAt: Date | null;
};

type ClassInfo = { scale: GradeScaleType | null; config: unknown; closed: Set<string> };

/** La nota de una fila en la escala de la libreta, como la ve Calificaciones; sin evidencias ni nota manual, no hay. */
const labelOf = (row: GradeRow, info: ClassInfo, scale: ReportScale, locked: boolean): string | null => {
  if (!(row.activitiesCount > 0 || row.isManualOverride)) return null;
  const score = row.isManualOverride && row.manualScore !== null ? Number(row.manualScore) : Number(row.score);
  const closed = locked || info.closed.has(row.period);
  // Bimestre cerrado: vale la etiqueta guardada; abierto, la manual o la del porcentaje en la escala de la clase.
  const own = closed && row.gradeLabel
    ? row.gradeLabel
    : row.isManualOverride && row.manualLabel
      ? row.manualLabel
      : scoreToLabel(score, info.scale, info.config);
  const target: GradeScaleType = scale === 'LITERAL' ? 'PERU_LETTERS' : 'PERU_VIGESIMAL';
  if (info.scale === target) return own;
  // Una clase en otra escala (anterior a la regla del nivel): de vigesimal a letras por su equivalencia; lo demás, por su %.
  return target === 'PERU_LETTERS' ? performanceBucket(score, info.scale, own) : scoreToLabel(score, 'PERU_VIGESIMAL', null);
};

const valueOf = (scale: ReportScale, label: string) => {
  if (scale === 'LITERAL') return LETTER_VALUE[label] ?? null;
  const n = Number.parseInt(label, 10);
  return Number.isFinite(n) ? n : null;
};

const labelOfValue = (scale: ReportScale, value: number) => {
  const rounded = Math.round(value + 1e-9);
  return scale === 'LITERAL'
    ? LETTERS[Math.min(4, Math.max(1, rounded)) - 1]
    : String(Math.min(20, Math.max(0, rounded))).padStart(2, '0');
};

/** La clase del área y sus talleres, cada uno con su peso (solo los que tienen nota). */
const combine = (scale: ReportScale, parts: Array<{ label: string; weight: number }>) => {
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0].label;
  let sum = 0;
  let weights = 0;
  for (const part of parts) {
    const value = valueOf(scale, part.label);
    if (value === null) continue;
    sum += value * part.weight;
    weights += part.weight;
  }
  return weights > 0 ? labelOfValue(scale, sum / weights) : parts[0].label;
};

const bucketOf = (scale: ReportScale, label: string) =>
  (scale === 'LITERAL' ? label : performanceBucket(0, 'PERU_VIGESIMAL', label));

const parseClosed = (raw: unknown) => {
  const value = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  return new Set(Array.isArray(value) ? value.map((entry) => entry?.period).filter((p): p is string => typeof p === 'string') : []);
};

/** Un área de la sección en el bimestre elegido: notas esperadas, puestas y conclusiones que faltan (solo estudiantes activos). */
const cellCounts = (report: SectionReport, areaId: string) => {
  const index = report.periods.findIndex((p) => p.code === report.upTo);
  let expected = 0;
  let graded = 0;
  let pending = 0;
  let exempt = 0;
  for (const student of report.students) {
    if (student.student.status !== 'ACTIVE') continue;
    const area = student.areas.find((a) => a.id === areaId);
    if (!area) continue;
    if (area.exempt) {
      exempt++;
      continue;
    }
    for (const competency of area.competencies) {
      expected++;
      if (competency.grades[index] !== null) graded++;
      if (competency.pending[index]) pending++;
    }
  }
  return { expected, graded, pending, exempt };
};

/** El día (AAAA-MM-DD) siguiente. */
const nextDay = (day: string) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

export const schoolReportService = {
  /** Datos del colegio para la cabecera (la administración). */
  async settings(schoolId: string) {
    const [school] = await db.select({ id: schools.id, name: schools.name, modularCode: schools.modularCode, logoUrl: schools.logoUrl })
      .from(schools).where(eq(schools.id, schoolId));
    if (!school) throw new NotFoundError('Escuela no encontrada');
    const [row] = await db.select().from(schoolReportSettings).where(eq(schoolReportSettings.schoolId, schoolId));
    return {
      name: school.name,
      modularCode: school.modularCode ?? null,
      logoUrl: school.logoUrl ?? null,
      dre: row?.dre ?? null,
      ugel: row?.ugel ?? null,
      directorName: row?.directorName ?? null,
      codes: { INICIAL: row?.inicialCode ?? null, PRIMARIA: row?.primariaCode ?? null, SECUNDARIA: row?.secundariaCode ?? null },
    };
  },

  async saveSettings(schoolId: string, input: {
    dre: string | null; ugel: string | null; directorName: string | null;
    codes: { INICIAL: string | null; PRIMARIA: string | null; SECUNDARIA: string | null };
  }, actorId: string) {
    const values = {
      dre: input.dre, ugel: input.ugel, directorName: input.directorName,
      inicialCode: input.codes.INICIAL, primariaCode: input.codes.PRIMARIA, secundariaCode: input.codes.SECUNDARIA,
      updatedBy: actorId, updatedAt: new Date(),
    };
    await db.insert(schoolReportSettings).values({ schoolId, ...values }).onDuplicateKeyUpdate({ set: values });
    return this.settings(schoolId);
  },

  /**
   * La libreta de una sección hasta un bimestre (o la de algunos de sus estudiantes). Entran quienes están en la sección este
   * año, también los retirados (su libreta llega hasta su retiro).
   */
  async section(schoolId: string, yearId: string, sectionId: string, upTo: string | null, options: { studentIds?: string[]; readDocuments?: boolean; attendance?: boolean } = {}): Promise<SectionReport> {
    const [year] = await db.select({ id: schoolYears.id, name: schoolYears.name, status: schoolYears.status, periodType: schoolYears.periodType })
      .from(schoolYears).where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)));
    if (!year) throw new NotFoundError('Año escolar no encontrado');
    const [section] = await db.select().from(schoolSections)
      .where(and(eq(schoolSections.id, sectionId), eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId)));
    if (!section) throw new NotFoundError('Sección no encontrada');
    const calendar = (await yearCalendars([yearId])).get(yearId);
    if (!calendar || calendar.periods.length === 0) throw new ConflictError('Este año aún no tiene bimestres');

    // Periodos: hasta el elegido (por defecto, el último que ya empezó).
    const today = limaToday();
    const started = calendar.periods.filter((p) => p.startsOn <= today);
    const target = upTo ? calendar.periods.find((p) => p.code === upTo) : (started[started.length - 1] ?? calendar.periods[0]);
    if (!target) throw new ValidationError('Ese bimestre no es de este año');
    const periods: ReportPeriod[] = calendar.periods.map((p) => ({
      code: p.code, number: p.number, startsOn: p.startsOn, locked: p.locked, started: p.startsOn <= today,
      included: p.number <= target.number && p.startsOn <= today, status: p.status,
    }));
    const included = calendar.periods.filter((p) => p.number <= target.number && p.startsOn <= today);
    const lockedPeriods = new Set(calendar.periods.filter((p) => p.locked).map((p) => p.period));

    const [settings, levelRow, tutor] = await Promise.all([
      this.settings(schoolId),
      db.select({ gradeScale: schoolYearLevels.gradeScale }).from(schoolYearLevels)
        .where(and(eq(schoolYearLevels.yearId, yearId), eq(schoolYearLevels.level, section.level))),
      section.tutorUserId
        ? db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, section.tutorUserId))
        : Promise.resolve([]),
    ]);
    const scale: ReportScale = levelRow[0]?.gradeScale === 'VIGESIMAL' ? 'VIGESIMAL' : 'LITERAL';
    const level = section.level as SchoolLevel;
    const codeOfLevel = settings.codes[level] ?? settings.modularCode;

    // Estudiantes de la sección este año (con su retiro, si lo hubo).
    const enrolled = await db.select({
      id: schoolStudents.id, firstNames: schoolStudents.firstNames, lastNames: schoolStudents.lastNames, siagieCode: schoolStudents.siagieCode,
      documentType: schoolStudents.documentType, documentEncrypted: schoolStudents.documentEncrypted, status: schoolEnrollments.status,
    }).from(schoolEnrollments)
      .innerJoin(schoolStudents, eq(schoolStudents.id, schoolEnrollments.studentId))
      .where(and(
        eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.sectionId, sectionId),
        ...(options.studentIds ? [inArray(schoolEnrollments.studentId, options.studentIds.length ? options.studentIds : [''])] : []),
      ))
      .orderBy(asc(schoolStudents.lastNames), asc(schoolStudents.firstNames));
    const studentIds = enrolled.map((s) => s.id);
    const withdrawals = studentIds.length
      ? await db.select({ studentId: schoolStudentMoves.studentId, effectiveDate: schoolStudentMoves.effectiveDate }).from(schoolStudentMoves)
        .where(and(eq(schoolStudentMoves.yearId, yearId), inArray(schoolStudentMoves.studentId, studentIds), eq(schoolStudentMoves.kind, 'WITHDRAWAL'), isNull(schoolStudentMoves.undoneAt)))
        .orderBy(desc(schoolStudentMoves.createdAt))
      : [];
    const withdrawnOn = new Map<string, string>();
    for (const w of withdrawals) if (!withdrawnOn.has(w.studentId)) withdrawnOn.set(w.studentId, w.effectiveDate);
    const exemptions = studentIds.length
      ? await db.select({ studentId: schoolExemptions.studentId, areaId: schoolExemptions.areaId }).from(schoolExemptions)
        .where(and(eq(schoolExemptions.yearId, yearId), inArray(schoolExemptions.studentId, studentIds)))
      : [];
    const exemptOf = new Map<string, Set<string>>();
    for (const e of exemptions) exemptOf.set(e.studentId, new Set([...(exemptOf.get(e.studentId) ?? []), e.areaId]));

    // Plan del grado y competencias oficiales de sus áreas.
    const plan = (await effectivePlan(yearId, level)).areas.filter((a) => a.grades.includes(section.grade));
    const areaIds = plan.map((a) => a.areaId);
    const competencies = areaIds.length
      ? await db.select({ id: curriculumCompetencies.id, areaId: curriculumCompetencies.areaId, name: curriculumCompetencies.name })
        .from(curriculumCompetencies)
        .where(and(inArray(curriculumCompetencies.areaId, areaIds), eq(curriculumCompetencies.sourceType, 'OFFICIAL'), eq(curriculumCompetencies.isActive, true)))
        .orderBy(asc(curriculumCompetencies.displayOrder), asc(curriculumCompetencies.name))
      : [];
    const competencyIds = new Set(competencies.map((c) => c.id));

    // Sus perfiles en las clases de este año (también los inactivos: un traslado deja las notas en la clase anterior).
    const profiles = studentIds.length
      ? await db.select({ id: studentProfiles.id, studentId: studentProfiles.schoolStudentId, classroomId: studentProfiles.classroomId, isActive: studentProfiles.isActive })
        .from(studentProfiles).where(and(inArray(studentProfiles.schoolStudentId, studentIds), eq(studentProfiles.isDemo, false)))
      : [];
    const yearOf = await classroomYearIds(profiles.map((p) => p.classroomId));
    const ownProfiles = profiles.filter((p) => yearOf.get(p.classroomId) === yearId);
    const classIds = [...new Set(ownProfiles.map((p) => p.classroomId))];
    const [classRows, assignmentRows, workshopRows] = classIds.length
      ? await Promise.all([
        db.select({ id: classrooms.id, scale: classrooms.gradeScaleType, config: classrooms.gradeScaleConfig, closed: classrooms.closedBimesters })
          .from(classrooms).where(inArray(classrooms.id, classIds)),
        db.select({ classroomId: schoolTeachingAssignments.classroomId, areaId: schoolTeachingAssignments.areaId })
          .from(schoolTeachingAssignments).where(inArray(schoolTeachingAssignments.classroomId, classIds)),
        db.select({ classroomId: schoolWorkshops.classroomId, areaId: schoolWorkshops.areaId, name: schoolWorkshops.name, weight: schoolWorkshops.weight })
          .from(schoolWorkshops).where(inArray(schoolWorkshops.classroomId, classIds)),
      ])
      : [[], [], []];
    const classInfo = new Map<string, ClassInfo>(classRows.map((c) => [c.id, { scale: c.scale, config: parseScaleConfig(c.config), closed: parseClosed(c.closed) }]));
    const areaClass = new Map(assignmentRows.filter((a) => a.classroomId).map((a) => [a.classroomId!, a.areaId]));
    const workshopOf = new Map(workshopRows.filter((w) => w.classroomId).map((w) => [w.classroomId!, w]));

    const periodKeys = included.map((p) => p.period);
    const profileIds = ownProfiles.map((p) => p.id);
    const grades = profileIds.length && periodKeys.length
      ? (await db.select({
        classroomId: studentGrades.classroomId, studentProfileId: studentGrades.studentProfileId, competencyId: studentGrades.competencyId,
        period: studentGrades.period, score: studentGrades.score, gradeLabel: studentGrades.gradeLabel, isManualOverride: studentGrades.isManualOverride,
        manualScore: studentGrades.manualScore, manualLabel: studentGrades.manualLabel, activitiesCount: studentGrades.activitiesCount,
        conclusion: studentGrades.conclusion, calculatedAt: studentGrades.calculatedAt,
      }).from(studentGrades)
        .where(and(inArray(studentGrades.studentProfileId, profileIds), inArray(studentGrades.period, periodKeys)))) as GradeRow[]
      : [];

    // Ventana de días de cada periodo: desde su inicio hasta el día antes del siguiente (el último, hasta su fin).
    const windows = calendar.periods.map((p, i) => ({
      from: p.startsOn,
      until: i + 1 < calendar.periods.length ? calendar.periods[i + 1].startsOn : nextDay(p.endsOn),
    }));
    // Asistencia: por día, juntando sus clases del año (sin lo revertido), en los periodos que entran.
    const dayOf = sql<string>`DATE_FORMAT(${attendanceRecords.date}, '%Y-%m-%d')`;
    const attendance = profileIds.length && included.length > 0 && options.attendance !== false
      ? await db.select({ studentProfileId: attendanceRecords.studentProfileId, day: dayOf, status: attendanceRecords.status })
        .from(attendanceRecords)
        .where(and(
          inArray(attendanceRecords.studentProfileId, profileIds), eq(attendanceRecords.isReverted, false),
          sql`${dayOf} >= ${windows[0].from}`, sql`${dayOf} < ${windows[included.length - 1].until}`,
        ))
      : [];

    const profileOwner = new Map(ownProfiles.map((p) => [p.id, p]));
    const gradesByStudent = new Map<string, GradeRow[]>();
    for (const row of grades) {
      const owner = profileOwner.get(row.studentProfileId);
      if (!owner?.studentId || !competencyIds.has(row.competencyId)) continue;
      gradesByStudent.set(owner.studentId, [...(gradesByStudent.get(owner.studentId) ?? []), row]);
    }
    const attendanceByStudent = new Map<string, Map<string, string[]>>();
    for (const row of attendance) {
      const owner = profileOwner.get(row.studentProfileId);
      if (!owner?.studentId) continue;
      const days = attendanceByStudent.get(owner.studentId) ?? new Map<string, string[]>();
      days.set(row.day, [...(days.get(row.day) ?? []), row.status]);
      attendanceByStudent.set(owner.studentId, days);
    }

    const readDocuments = options.readDocuments ?? false;
    const students: StudentReport[] = enrolled.map((student) => {
      const ownRows = gradesByStudent.get(student.id) ?? [];
      const activeProfile = new Set(ownProfiles.filter((p) => p.studentId === student.id && p.isActive).map((p) => p.id));
      const withdrawnDay = student.status === 'WITHDRAWN' ? withdrawnOn.get(student.id) ?? null : null;
      let missingGrades = 0;
      let missingConclusions = 0;
      const conclusions: ReportConclusion[][] = calendar.periods.map(() => []);

      const exempt = exemptOf.get(student.id) ?? new Set<string>();
      const areas: ReportArea[] = plan.map((area) => {
        // Exonerada: «EXO» en cada periodo que entra (y en el final); no falta nada.
        if (exempt.has(area.areaId)) {
          const marks = calendar.periods.map((period, index) =>
            (periods[index].included && !(withdrawnDay && period.startsOn > withdrawnDay) ? EXEMPT_LABEL : null));
          return {
            id: area.areaId, name: area.name, workshops: [], exempt: true,
            competencies: competencies.filter((c) => c.areaId === area.areaId).map((c) => ({
              id: c.id, name: c.name, grades: marks, final: EXEMPT_LABEL, pending: marks.map(() => false),
            })),
          };
        }
        const workshops = [...new Set(ownRows.filter((r) => workshopOf.get(r.classroomId)?.areaId === area.areaId).map((r) => workshopOf.get(r.classroomId)!.name))];
        const areaCompetencies = competencies.filter((c) => c.areaId === area.areaId).map((competency) => {
          const pending = calendar.periods.map(() => false);
          const labels = calendar.periods.map((period, index) => {
            // Fuera de esta libreta, o un periodo que empezó después de su retiro.
            if (!periods[index].included || (withdrawnDay && period.startsOn > withdrawnDay)) return null;
            const rows = ownRows.filter((r) => r.competencyId === competency.id && r.period === period.period);
            const locked = lockedPeriods.has(period.period);
            const graded = rows
              .map((row) => ({ row, label: classInfo.has(row.classroomId) ? labelOf(row, classInfo.get(row.classroomId)!, scale, locked) : null }))
              .filter((g): g is { row: GradeRow; label: string } => g.label !== null);
            // La clase del área (con un traslado, la de su sección actual primero); si no hay, otra clase que la calificó.
            const pick = (list: typeof graded) => [...list].sort((a, b) =>
              Number(activeProfile.has(b.row.studentProfileId)) - Number(activeProfile.has(a.row.studentProfileId))
              || new Date(b.row.calculatedAt ?? 0).getTime() - new Date(a.row.calculatedAt ?? 0).getTime())[0] ?? null;
            const main = pick(graded.filter((g) => areaClass.get(g.row.classroomId) === area.areaId))
              ?? pick(graded.filter((g) => !workshopOf.has(g.row.classroomId)));
            const fromWorkshops = graded.filter((g) => workshopOf.get(g.row.classroomId)?.areaId === area.areaId);
            const workshopWeight = fromWorkshops.reduce((sum, g) => sum + workshopOf.get(g.row.classroomId)!.weight, 0);
            const parts = [
              ...(main ? [{ label: main.label, weight: Math.max(MIN_MAIN_WEIGHT, 100 - workshopWeight) }] : []),
              ...fromWorkshops.map((g) => ({ label: g.label, weight: workshopOf.get(g.row.classroomId)!.weight })),
            ];
            const label = combine(scale, parts);
            if (label === null) {
              missingGrades++;
              return null;
            }
            if (REQUIRED[level].has(bucketOf(scale, label))) {
              const texts = [...new Set([main, ...fromWorkshops].map((g) => g?.row.conclusion?.trim()).filter((t): t is string => !!t))];
              if (texts.length === 0) {
                missingConclusions++;
                pending[index] = true;
              }
              for (const text of texts) conclusions[index].push({ area: area.name, competency: competency.name, text });
            }
            return label;
          });
          const last = [...labels].reverse().find((l) => l !== null) ?? null;
          return { id: competency.id, name: competency.name, grades: labels, final: last, pending };
        });
        return { id: area.areaId, name: area.name, workshops, exempt: false, competencies: areaCompetencies };
      });

      const days = attendanceByStudent.get(student.id) ?? new Map<string, string[]>();
      const studentAttendance = calendar.periods.map((period, index) => {
        if (!periods[index].included || (withdrawnDay && period.startsOn > withdrawnDay)) return null;
        const { from, until } = windows[index];
        const counts: ReportAttendance = { absentJustified: 0, absentUnjustified: 0, lateJustified: 0, lateUnjustified: 0 };
        for (const [day, statuses] of days) {
          if (day < from || day >= until || day > today || (withdrawnDay && day > withdrawnDay)) continue;
          if (statuses.some((s) => s === 'PRESENT' || s === 'LATE')) {
            // Llegó tarde a alguna clase: tardanza (Juried aún no tiene «tardanza justificada»).
            if (statuses.includes('LATE')) counts.lateUnjustified++;
          } else if (statuses.includes('EXCUSED')) {
            counts.absentJustified++;
          } else {
            counts.absentUnjustified++;
          }
        }
        return counts;
      });

      return {
        student: {
          id: student.id,
          firstNames: student.firstNames,
          lastNames: student.lastNames,
          siagieCode: student.siagieCode ?? null,
          document: readDocuments ? readDocument(student) : null,
          hasDocument: !!student.documentEncrypted,
          status: student.status === 'WITHDRAWN' ? 'WITHDRAWN' : 'ACTIVE',
          withdrawnOn: withdrawnDay,
        },
        areas,
        conclusions,
        attendance: studentAttendance,
        missing: { grades: missingGrades, conclusions: missingConclusions },
      };
    });

    const last = calendar.periods[calendar.periods.length - 1];
    return {
      school: {
        id: schoolId, name: settings.name, logoUrl: settings.logoUrl, dre: settings.dre, ugel: settings.ugel,
        modularCode: codeOfLevel, directorName: settings.directorName,
      },
      year: { id: year.id, name: year.name, status: year.status },
      section: {
        id: section.id, label: sectionDisplayName(section.level, section.grade, section.name), level, levelName: LEVEL_NAME[level],
        grade: section.grade, gradeLabel: level === 'INICIAL' ? `${section.grade} años` : `${section.grade}.°`, name: section.name,
        tutor: tutor[0] ? fullName(tutor[0]) || null : null,
      },
      scale,
      periods,
      upTo: target.code,
      preview: !target.locked,
      showFinal: target.code === last.code,
      documentsReadable: piiReady(),
      plan: plan.map((a) => ({ id: a.areaId, name: a.name })),
      exemptable: plan.filter((a) => EXEMPTABLE_AREAS.includes(a.areaId)).map((a) => ({ id: a.areaId, name: a.name })),
      students,
    };
  },

  /** Las exoneraciones de un estudiante en el año (las reemplaza). Solo Educación Religiosa y Educación Física. */
  async setExemptions(schoolId: string, yearId: string, studentId: string, areaIds: string[], actorId: string) {
    const [year] = await db.select({ status: schoolYears.status }).from(schoolYears)
      .where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)));
    if (!year) throw new NotFoundError('Año escolar no encontrado');
    if (year.status === 'CLOSED') throw new ConflictError('Este año escolar ya cerró: solo se puede consultar');
    const [enrollment] = await db.select({ id: schoolEnrollments.id }).from(schoolEnrollments)
      .where(and(eq(schoolEnrollments.schoolId, schoolId), eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.studentId, studentId)));
    if (!enrollment) throw new NotFoundError('Estudiante no encontrado en este año');
    const wanted = [...new Set(areaIds)];
    if (wanted.some((id) => !EXEMPTABLE_AREAS.includes(id))) throw new ValidationError('Solo se exonera de Educación Religiosa o de Educación Física');
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.delete(schoolExemptions).where(and(eq(schoolExemptions.yearId, yearId), eq(schoolExemptions.studentId, studentId)));
      if (wanted.length) {
        await tx.insert(schoolExemptions).values(wanted.map((areaId) => ({ yearId, studentId, areaId, schoolId, createdBy: actorId, createdAt: now })));
      }
    });
    return wanted;
  },

  /**
   * Avance de las libretas de un bimestre: por sección y área, las notas puestas de las esperadas (cada estudiante activo por
   * cada competencia; sin los exonerados) y las conclusiones que faltan, con el docente de su asignación.
   */
  async progress(schoolId: string, yearId: string, upTo: string | null) {
    const sections = (await db.select({ id: schoolSections.id, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name })
      .from(schoolSections).where(and(eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId))))
      .sort((a, b) => LEVEL_ORDER.indexOf(a.level as SchoolLevel) - LEVEL_ORDER.indexOf(b.level as SchoolLevel) || a.grade - b.grade || a.name.localeCompare(b.name, 'es'));
    const assignments = await db.select({
      sectionId: schoolTeachingAssignments.sectionId, areaId: schoolTeachingAssignments.areaId, classroomId: schoolTeachingAssignments.classroomId,
      teacherUserId: schoolTeachingAssignments.teacherUserId, firstName: users.firstName, lastName: users.lastName,
    }).from(schoolTeachingAssignments)
      .leftJoin(users, eq(users.id, schoolTeachingAssignments.teacherUserId))
      .where(and(eq(schoolTeachingAssignments.schoolId, schoolId), eq(schoolTeachingAssignments.yearId, yearId)));
    let periods: ReportPeriod[] = [];
    let target = upTo ?? '';
    const areas = new Map<string, string>();
    const rows = [];
    for (const section of sections) {
      const report = await this.section(schoolId, yearId, section.id, upTo, { attendance: false });
      periods = report.periods;
      target = report.upTo;
      for (const area of report.plan) if (!areas.has(area.id)) areas.set(area.id, area.name);
      const active = report.students.filter((s) => s.student.status === 'ACTIVE');
      rows.push({
        id: section.id,
        label: report.section.label,
        level: report.section.level,
        students: active.length,
        cells: report.plan.map((area) => {
          const counts = cellCounts(report, area.id);
          const assignment = assignments.find((a) => a.sectionId === section.id && a.areaId === area.id);
          return {
            areaId: area.id,
            ...counts,
            teacher: assignment ? { id: assignment.teacherUserId, name: fullName(assignment) || 'Docente' } : null,
            hasClass: !!assignment?.classroomId,
          };
        }),
      });
    }
    return { periods, upTo: target, areas: [...areas].map(([id, name]) => ({ id, name })), sections: rows };
  },

  /** «Recordar»: un aviso en la campana del docente de la asignación con lo que le falta para la libreta (uno por hora). */
  async remind(schoolId: string, yearId: string, sectionId: string, areaId: string, upTo: string | null) {
    const [assignment] = await db.select({ teacherUserId: schoolTeachingAssignments.teacherUserId, classroomId: schoolTeachingAssignments.classroomId })
      .from(schoolTeachingAssignments)
      .where(and(
        eq(schoolTeachingAssignments.schoolId, schoolId), eq(schoolTeachingAssignments.yearId, yearId),
        eq(schoolTeachingAssignments.sectionId, sectionId), eq(schoolTeachingAssignments.areaId, areaId),
      ));
    if (!assignment) throw new ConflictError('Esa área no tiene docente en esta sección');
    const report = await this.section(schoolId, yearId, sectionId, upTo, { attendance: false });
    const area = report.plan.find((a) => a.id === areaId);
    if (!area) throw new NotFoundError('Esa área no es del plan de esta sección');
    const { expected, graded, pending } = cellCounts(report, areaId);
    const missing = expected - graded;
    if (missing <= 0 && pending <= 0) throw new ConflictError('Esa área ya tiene todas sus notas y conclusiones');
    const period = report.periods.find((p) => p.code === report.upTo)!;
    const parts = [
      missing > 0 ? `${missing} ${missing === 1 ? 'nota' : 'notas'}` : null,
      pending > 0 ? `${pending} ${pending === 1 ? 'conclusión' : 'conclusiones'}` : null,
    ].filter(Boolean).join(' y ');
    const title = `Libretas del bimestre ${period.number}`;
    const message = `En ${report.section.label} · ${area.name} faltan ${parts} para la libreta.`;
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recent] = await db.select({ id: notifications.id }).from(notifications)
      .where(and(eq(notifications.userId, assignment.teacherUserId), eq(notifications.title, title), eq(notifications.message, message), gte(notifications.createdAt, hourAgo)));
    if (recent) throw new ConflictError('Ya se lo recordaste hace menos de una hora');
    await createNotification({
      userId: assignment.teacherUserId, classroomId: assignment.classroomId, type: 'ANNOUNCEMENT', title, message,
      data: { kind: 'REPORT_REMINDER', sectionId, areaId, period: period.code },
    });
    return { missing: Math.max(0, missing), pending };
  },

  /** La sección de un estudiante en el año (su libreta individual). */
  async sectionOf(schoolId: string, yearId: string, studentId: string) {
    const [row] = await db.select({ sectionId: schoolEnrollments.sectionId }).from(schoolEnrollments)
      .where(and(eq(schoolEnrollments.schoolId, schoolId), eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.studentId, studentId)));
    if (!row?.sectionId) throw new NotFoundError('Este estudiante no tiene sección este año');
    return row.sectionId;
  },
};
