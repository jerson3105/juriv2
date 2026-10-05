import { and, desc, eq, inArray, max, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  classrooms, parentProfiles, parentStudentLinks, schoolPeriods, schoolReportPublications, schoolReportSnapshots, schoolSections, schoolStudents,
  schoolYears, schools, studentProfiles,
} from '../db/schema.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { createNotifications, type NotificationEntry } from '../utils/notificationEmitter.js';
import { affectedRows } from '../utils/points.js';
import { decryptPii, piiReady } from '../utils/piiCrypto.js';
import { gradeService } from './grade.service.js';
import { libretaImages } from './libretaAssets.js';
import { libretaPdfService } from './libretaPdf.service.js';
import { invalidateSchoolCalendar, yearClassroomIds } from './schoolCalendar.service.js';
import { schoolReportService, type SectionReport, type StudentReport } from './schoolReport.service.js';

/**
 * Publicación de las libretas. Con el bimestre cerrado, la administración publica las de todo el colegio: cada libreta queda
 * congelada (una copia por estudiante activo; lo que ve su familia no cambia aunque después se edite la asistencia o una
 * conclusión) y llega un aviso a la campana del estudiante y de su familia. Reabrir un bimestre publicado pide un motivo;
 * al publicarlo de nuevo sale la versión siguiente, con un aviso nuevo. El estudiante la descarga en «Mis calificaciones» y
 * su familia en la página de su hijo o hija.
 */

/** Lo que se guarda de una libreta: la cabecera y los periodos de su sección, y lo del estudiante (sin el DNI). */
type Snapshot = { report: Omit<SectionReport, 'students'>; student: StudentReport };

const parseSnapshot = (raw: unknown): Snapshot => (typeof raw === 'string' ? JSON.parse(raw) : raw) as Snapshot;
const documentContext = (studentId: string) => `school_student:${studentId}:document`;

/** El bimestre del año en curso (como al cerrarlo: solo se publican los del año activo). */
const loadPeriod = async (schoolId: string, yearId: string, code: string) => {
  const [year] = await db.select({ id: schoolYears.id, name: schoolYears.name, status: schoolYears.status })
    .from(schoolYears).where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)));
  if (!year) throw new NotFoundError('Año escolar no encontrado');
  if (year.status !== 'ACTIVE') throw new ConflictError('Solo se publican las libretas del año escolar en curso');
  const [period] = await db.select().from(schoolPeriods).where(and(eq(schoolPeriods.yearId, yearId), eq(schoolPeriods.code, code)));
  if (!period) throw new NotFoundError('Bimestre no encontrado');
  return { year, period, number: Number(code.slice(1)) };
};

export const schoolReportPublishService = {
  /** Las publicaciones del año: la última versión de cada bimestre (para «Libretas»). */
  async latestOfYear(yearId: string) {
    const rows = await db.select().from(schoolReportPublications)
      .where(eq(schoolReportPublications.yearId, yearId))
      .orderBy(desc(schoolReportPublications.version));
    const latest = new Map<string, typeof rows[number]>();
    for (const row of rows) if (!latest.has(row.periodCode)) latest.set(row.periodCode, row);
    return latest;
  },

  /**
   * Publica las libretas de un bimestre cerrado. Antes asegura la nota final de cada clase (el cierre la calcula en segundo
   * plano), congela la libreta de cada estudiante activo y avisa a estudiantes y familias.
   */
  async publish(schoolId: string, yearId: string, code: string, actorId: string) {
    const { year, period, number } = await loadPeriod(schoolId, yearId, code);
    if (period.status === 'PUBLISHED') throw new ConflictError(`Las libretas del bimestre ${number} ya están publicadas`);
    if (period.status !== 'LOCKED') throw new ConflictError(`Primero cierra el bimestre ${number}: sus notas deben estar congeladas`);

    // La nota final de cada clase con el bimestre cerrado (si el cierre aún no terminó de calcularla).
    const gradebookPeriod = `${year.name}-${code}`;
    const classIds = await yearClassroomIds(yearId);
    const classes = classIds.length
      ? await db.select({ id: classrooms.id }).from(classrooms).where(and(inArray(classrooms.id, classIds), eq(classrooms.useCompetencies, true)))
      : [];
    for (const c of classes) {
      try {
        await gradeService.finalizeLockedPeriod(c.id, gradebookPeriod);
      } catch (error) {
        logger.error('Nota final antes de publicar la libreta falló', { classroomId: c.id, period: gradebookPeriod, error: error instanceof Error ? error.message : String(error) });
      }
    }

    // La libreta de cada estudiante activo de cada sección, congelada (sin el DNI).
    const sections = await db.select({ id: schoolSections.id }).from(schoolSections)
      .where(and(eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId)));
    const snapshots: Array<{ studentId: string; sectionId: string; data: Snapshot }> = [];
    for (const section of sections) {
      const report = await schoolReportService.section(schoolId, yearId, section.id, code);
      const { students, ...header } = report;
      for (const student of students) {
        if (student.student.status !== 'ACTIVE') continue;
        snapshots.push({ studentId: student.student.id, sectionId: section.id, data: { report: { ...header, preview: false }, student: { ...student, student: { ...student.student, document: null } } } });
      }
    }
    if (snapshots.length === 0) throw new ConflictError('No hay estudiantes en las secciones de este año');

    const now = new Date();
    const publicationId = uuidv4();
    let version = 1;
    await db.transaction(async (tx) => {
      // Fila del bimestre bloqueada: dos publicaciones a la vez no se pisan.
      const [locked] = await tx.select({ status: schoolPeriods.status }).from(schoolPeriods).where(eq(schoolPeriods.id, period.id)).for('update');
      if (locked?.status !== 'LOCKED') throw new ConflictError(`Las libretas del bimestre ${number} ya están publicadas`);
      const [{ last }] = await tx.select({ last: max(schoolReportPublications.version) }).from(schoolReportPublications)
        .where(and(eq(schoolReportPublications.yearId, yearId), eq(schoolReportPublications.periodCode, code)));
      version = Number(last ?? 0) + 1;
      await tx.insert(schoolReportPublications).values({
        id: publicationId, schoolId, yearId, periodCode: code, version, students: snapshots.length, publishedBy: actorId, publishedAt: now,
      });
      for (let i = 0; i < snapshots.length; i += 100) {
        await tx.insert(schoolReportSnapshots).values(snapshots.slice(i, i + 100).map((s) => ({
          publicationId, studentId: s.studentId, sectionId: s.sectionId, data: s.data, createdAt: now,
        })));
      }
      const result = await tx.update(schoolPeriods).set({ status: 'PUBLISHED', updatedAt: now })
        .where(and(eq(schoolPeriods.id, period.id), eq(schoolPeriods.status, 'LOCKED')));
      if (affectedRows(result) === 0) throw new ConflictError(`Las libretas del bimestre ${number} ya están publicadas`);
    });
    invalidateSchoolCalendar(schoolId);

    const notified = await this.notify(snapshots.map((s) => ({ studentId: s.studentId, firstNames: s.data.student.student.firstNames })), yearId, number, version > 1);
    return { publicationId, version, students: snapshots.length, notified };
  },

  /** Aviso en la campana: a cada estudiante con cuenta y a su familia vinculada (en sus clases del año). */
  async notify(students: Array<{ studentId: string; firstNames: string }>, yearId: string, number: number, corrected: boolean) {
    if (students.length === 0) return 0;
    const ids = students.map((s) => s.studentId);
    const nameOf = new Map(students.map((s) => [s.studentId, s.firstNames]));
    const classIds = new Set(await yearClassroomIds(yearId));
    const profiles = await db.select({ id: studentProfiles.id, studentId: studentProfiles.schoolStudentId, userId: studentProfiles.userId, classroomId: studentProfiles.classroomId })
      .from(studentProfiles)
      .where(and(inArray(studentProfiles.schoolStudentId, ids), eq(studentProfiles.isActive, true)));
    const own = profiles.filter((p) => classIds.has(p.classroomId));
    const accounts = await db.select({ id: schoolStudents.id, userId: schoolStudents.userId }).from(schoolStudents).where(inArray(schoolStudents.id, ids));
    const studentUsers = new Map<string, string>();
    for (const a of accounts) if (a.userId) studentUsers.set(a.userId, a.id);
    for (const p of own) if (p.userId && p.studentId) studentUsers.set(p.userId, p.studentId);
    const families = own.length
      ? await db.select({ userId: parentProfiles.userId, profileId: parentStudentLinks.studentProfileId }).from(parentStudentLinks)
        .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
        .where(and(inArray(parentStudentLinks.studentProfileId, own.map((p) => p.id)), eq(parentStudentLinks.status, 'ACTIVE')))
      : [];
    const studentOfProfile = new Map(own.map((p) => [p.id, p.studentId!]));
    const title = corrected ? `Libreta corregida · bimestre ${number}` : `Libreta del bimestre ${number}`;
    const entries: NotificationEntry[] = [];
    for (const [userId, studentId] of studentUsers) {
      entries.push({ userId, type: 'ANNOUNCEMENT', title, message: corrected ? 'Tu colegio corrigió tu libreta: descarga la nueva en «Mis calificaciones».' : 'Ya puedes descargar tu libreta en «Mis calificaciones».', data: { kind: 'REPORT_PUBLISHED', studentId } });
    }
    const seen = new Set<string>();
    for (const f of families) {
      const studentId = studentOfProfile.get(f.profileId);
      if (!studentId || seen.has(`${f.userId}:${studentId}`)) continue;
      seen.add(`${f.userId}:${studentId}`);
      const name = nameOf.get(studentId) ?? 'tu hijo o hija';
      entries.push({ userId: f.userId, type: 'ANNOUNCEMENT', title, message: corrected ? `El colegio corrigió la libreta de ${name}: la nueva está en su página.` : `Ya está la libreta de ${name}: descárgala en su página.`, data: { kind: 'REPORT_PUBLISHED', studentId } });
    }
    for (let i = 0; i < entries.length; i += 200) await createNotifications(entries.slice(i, i + 200));
    return entries.length;
  },

  /** Antes de reabrir un bimestre publicado: el motivo queda en la versión que se va a corregir. */
  async markCorrection(yearId: string, code: string, reason: string) {
    const [latest] = await db.select({ id: schoolReportPublications.id }).from(schoolReportPublications)
      .where(and(eq(schoolReportPublications.yearId, yearId), eq(schoolReportPublications.periodCode, code)))
      .orderBy(desc(schoolReportPublications.version)).limit(1);
    if (latest) await db.update(schoolReportPublications).set({ correctionReason: reason }).where(eq(schoolReportPublications.id, latest.id));
  },

  /** Las libretas publicadas de un estudiante del padrón: la última versión de cada bimestre, de la más reciente. */
  async listForStudent(studentId: string) {
    const rows = await db.select({
      publicationId: schoolReportPublications.id, yearName: schoolYears.name, code: schoolReportPublications.periodCode,
      version: schoolReportPublications.version, publishedAt: schoolReportPublications.publishedAt, schoolName: schools.name,
    }).from(schoolReportSnapshots)
      .innerJoin(schoolReportPublications, eq(schoolReportPublications.id, schoolReportSnapshots.publicationId))
      .innerJoin(schoolYears, eq(schoolYears.id, schoolReportPublications.yearId))
      .innerJoin(schools, eq(schools.id, schoolReportPublications.schoolId))
      .where(eq(schoolReportSnapshots.studentId, studentId))
      .orderBy(desc(schoolYears.name), desc(schoolReportPublications.periodCode), desc(schoolReportPublications.version));
    const seen = new Set<string>();
    return rows.filter((r) => {
      const key = `${r.yearName}:${r.code}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((r) => ({
      id: r.publicationId, year: r.yearName, period: Number(r.code.slice(1)), version: r.version, publishedAt: r.publishedAt, school: r.schoolName,
    }));
  },

  /** Los estudiantes del padrón de una cuenta de estudiante (por sus perfiles en las clases del colegio). */
  async studentsOfUser(userId: string) {
    const rows = await db.select({ studentId: studentProfiles.schoolStudentId }).from(studentProfiles)
      .where(and(eq(studentProfiles.userId, userId), sql`${studentProfiles.schoolStudentId} IS NOT NULL`));
    const own = await db.select({ id: schoolStudents.id }).from(schoolStudents).where(eq(schoolStudents.userId, userId));
    return [...new Set([...rows.map((r) => r.studentId!), ...own.map((r) => r.id)])];
  },

  /** El PDF de una libreta publicada (de su copia congelada; el DNI se lee al descargar, si el servidor tiene las llaves). */
  async pdf(publicationId: string, studentIds: string[]) {
    if (studentIds.length === 0) throw new NotFoundError('Libreta no encontrada');
    const [row] = await db.select({ data: schoolReportSnapshots.data, studentId: schoolReportSnapshots.studentId }).from(schoolReportSnapshots)
      .where(and(eq(schoolReportSnapshots.publicationId, publicationId), inArray(schoolReportSnapshots.studentId, studentIds)));
    if (!row) throw new NotFoundError('Libreta no encontrada');
    const snapshot = parseSnapshot(row.data);
    const [student] = await db.select({ id: schoolStudents.id, documentType: schoolStudents.documentType, documentEncrypted: schoolStudents.documentEncrypted })
      .from(schoolStudents).where(eq(schoolStudents.id, row.studentId));
    let document: string | null = null;
    if (student?.documentEncrypted && student.documentType && piiReady()) {
      try {
        const number = decryptPii(student.documentEncrypted, documentContext(student.id));
        document = student.documentType === 'DNI' ? number : `${student.documentType} ${number}`;
      } catch {
        document = null;
      }
    }
    const [school] = await db.select({ logoUrl: schools.logoUrl }).from(schools).where(eq(schools.id, snapshot.report.school.id));
    const report: SectionReport = {
      ...snapshot.report,
      preview: false,
      students: [{ ...snapshot.student, student: { ...snapshot.student.student, document } }],
    };
    const pdf = await libretaPdfService.render(report, await libretaImages(school?.logoUrl ?? snapshot.report.school.logoUrl));
    const s = snapshot.student.student;
    return { pdf, name: `${s.lastNames} ${s.firstNames} ${snapshot.report.year.name} ${snapshot.report.upTo}` };
  },
};
