import { and, asc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  classrooms, purchases, schoolEnrollmentEvents, schoolEnrollments, schoolPeriods, schools, schoolSectionPromotions, schoolSections, schoolStudents,
  schoolYearClassrooms, schoolYearLevels, schoolYears, studentProfiles,
} from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { comparableText } from '../utils/textClean.js';
import { invalidateSchoolCalendar, unlinkedClassroomIds, yearClassroomIds } from './schoolCalendar.service.js';
import { sectionDisplayName } from './schoolSection.service.js';
import type { SchoolLevel } from './schoolYear.service.js';

/**
 * Promoción y cierre del año escolar. Por defecto cada estudiante pasa a la sección del grado siguiente con el mismo
 * nombre (o egresa si el colegio no ofrece ese grado); la administración marca las excepciones: Permanece (su mismo
 * grado), Recuperación (provisional en el grado siguiente hasta su resultado), No continúa o Egresa, y puede elegir otra
 * sección. «Cerrar» deja la situación final en la matrícula del año, matricula a cada uno en el año siguiente (en
 * preparación), archiva las clases del año y las del colegio sin vincular, y cierra el año. Las clases del año siguiente
 * reciben a sus estudiantes cuando ese año empieza.
 */

export const FINAL_SITUATIONS = ['PROMOTED', 'REPEATS', 'RECOVERY', 'LEAVES', 'GRADUATED'] as const;
export type FinalSituation = (typeof FINAL_SITUATIONS)[number];
/** Las que siguen en el colegio el año siguiente (necesitan sección). */
const STAYS = new Set<FinalSituation>(['PROMOTED', 'REPEATS', 'RECOVERY']);
const LABEL: Record<FinalSituation, string> = { PROMOTED: 'Promovido', REPEATS: 'Permanece', RECOVERY: 'Recuperación', LEAVES: 'No continúa', GRADUATED: 'Egresa' };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Pick<typeof db, 'select'>;
type SectionRow = { id: string; level: SchoolLevel; grade: number; name: string };
type Destination = { kind: 'SECTION'; sectionId: string } | { kind: 'GRADUATE' } | { kind: 'NONE' };

/** El grado siguiente en la EBR: 3 → 4 → 5 años → 1.° de primaria … 6.° → 1.° de secundaria … 5.° de secundaria egresa. */
export const nextGrade = (level: SchoolLevel, grade: number): { level: SchoolLevel; grade: number } | null => {
  if (level === 'INICIAL') return grade < 5 ? { level, grade: grade + 1 } : { level: 'PRIMARIA', grade: 1 };
  if (level === 'PRIMARIA') return grade < 6 ? { level, grade: grade + 1 } : { level: 'SECUNDARIA', grade: 1 };
  return grade < 5 ? { level, grade: grade + 1 } : null;
};

const label = (s: SectionRow) => sectionDisplayName(s.level, s.grade, s.name);

/** La sección de un grado del año siguiente: la de su mismo nombre o, si es la única del grado, esa. */
const namedIn = (targets: SectionRow[], level: SchoolLevel, grade: number, name: string) => {
  const inGrade = targets.filter((t) => t.level === level && t.grade === grade);
  return inGrade.find((t) => comparableText(t.name) === comparableText(name)) ?? (inGrade.length === 1 ? inGrade[0] : null);
};

/** Por defecto: la sección del grado siguiente; egresa si el año siguiente no ofrece ese nivel; sin destino si falta la sección. */
const defaultDestination = (section: SectionRow, targets: SectionRow[], targetLevels: Set<string>): Destination => {
  const next = nextGrade(section.level, section.grade);
  if (!next || !targetLevels.has(next.level)) return { kind: 'GRADUATE' };
  const target = namedIn(targets, next.level, next.grade, section.name);
  return target ? { kind: 'SECTION', sectionId: target.id } : { kind: 'NONE' };
};

/** El año que cierra y el que se prepara (el siguiente, en preparación). */
const loadYears = async (executor: Executor, schoolId: string, yearId: string) => {
  const [year] = await executor.select({ id: schoolYears.id, name: schoolYears.name, status: schoolYears.status, endsOn: schoolYears.endsOn }).from(schoolYears)
    .where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)));
  if (!year) throw new NotFoundError('Año escolar no encontrado');
  const following = await executor.select({ id: schoolYears.id, name: schoolYears.name, status: schoolYears.status }).from(schoolYears)
    .where(and(eq(schoolYears.schoolId, schoolId), eq(schoolYears.status, 'PLANNING')));
  const target = following.find((y) => y.name > year.name) ?? null;
  return { year, target };
};

interface PlanContext {
  sections: SectionRow[];
  targets: SectionRow[];
  destinations: Map<string, { destination: Destination; explicit: boolean }>;
}

/** Secciones del año, secciones del siguiente y el destino de cada sección (el elegido o el de por defecto). */
const planContext = async (executor: Executor, schoolId: string, yearId: string, targetYearId: string | null): Promise<PlanContext> => {
  const sections = await executor.select({ id: schoolSections.id, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name })
    .from(schoolSections).where(and(eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId)))
    .orderBy(asc(schoolSections.level), asc(schoolSections.grade), asc(schoolSections.name));
  const targets = targetYearId ? await executor.select({ id: schoolSections.id, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name })
    .from(schoolSections).where(and(eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, targetYearId)))
    .orderBy(asc(schoolSections.level), asc(schoolSections.grade), asc(schoolSections.name)) : [];
  const targetLevels = new Set(targetYearId ? (await executor.select({ level: schoolYearLevels.level }).from(schoolYearLevels)
    .where(eq(schoolYearLevels.yearId, targetYearId))).map((l) => l.level) : []);
  const chosen = sections.length ? await executor.select().from(schoolSectionPromotions).where(inArray(schoolSectionPromotions.sectionId, sections.map((s) => s.id))) : [];
  const chosenBy = new Map(chosen.map((c) => [c.sectionId, c]));
  const targetIds = new Set(targets.map((t) => t.id));
  const destinations = new Map<string, { destination: Destination; explicit: boolean }>();
  for (const section of sections) {
    const pick = chosenBy.get(section.id);
    if (pick?.graduates) destinations.set(section.id, { destination: { kind: 'GRADUATE' }, explicit: true });
    else if (pick?.targetSectionId && targetIds.has(pick.targetSectionId)) destinations.set(section.id, { destination: { kind: 'SECTION', sectionId: pick.targetSectionId }, explicit: true });
    else destinations.set(section.id, { destination: defaultDestination(section, targets, targetLevels), explicit: false });
  }
  return { sections, targets, destinations };
};

type EnrollmentRow = {
  id: string; studentId: string; sectionId: string | null; finalSituation: FinalSituation | null; nextSectionId: string | null;
  firstNames: string; lastNames: string;
};

/** La situación y la sección del año siguiente de una matrícula: la marcada o la de su sección. */
const resolve = (enrollment: EnrollmentRow, context: PlanContext) => {
  const section = enrollment.sectionId ? context.sections.find((s) => s.id === enrollment.sectionId) ?? null : null;
  const destination = section ? context.destinations.get(section.id)!.destination : { kind: 'NONE' as const };
  const targetIds = new Set(context.targets.map((t) => t.id));
  const chosenTarget = enrollment.nextSectionId && targetIds.has(enrollment.nextSectionId) ? enrollment.nextSectionId : null;
  let situation: FinalSituation;
  let target: string | null = null;
  if (enrollment.finalSituation) {
    situation = enrollment.finalSituation;
    if (STAYS.has(situation)) {
      const repeat = situation === 'REPEATS' && section ? namedIn(context.targets, section.level, section.grade, section.name)?.id ?? null : null;
      target = chosenTarget ?? (situation === 'REPEATS' ? repeat : destination.kind === 'SECTION' ? destination.sectionId : null);
    }
  } else if (destination.kind === 'GRADUATE') {
    situation = 'GRADUATED';
  } else {
    situation = 'PROMOTED';
    target = chosenTarget ?? (destination.kind === 'SECTION' ? destination.sectionId : null);
  }
  return { situation, target, explicit: !!enrollment.finalSituation, section };
};

/** Matrículas activas del año (de estudiantes activos en el colegio). */
const activeEnrollments = (executor: Executor, schoolId: string, yearId: string, sectionId?: string | null) => executor.select({
  id: schoolEnrollments.id, studentId: schoolEnrollments.studentId, sectionId: schoolEnrollments.sectionId,
  finalSituation: schoolEnrollments.finalSituation, nextSectionId: schoolEnrollments.nextSectionId,
  firstNames: schoolStudents.firstNames, lastNames: schoolStudents.lastNames,
}).from(schoolEnrollments)
  .innerJoin(schoolStudents, eq(schoolStudents.id, schoolEnrollments.studentId))
  .where(and(
    eq(schoolEnrollments.schoolId, schoolId), eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.status, 'ACTIVE'),
    eq(schoolStudents.status, 'ACTIVE'),
    sectionId === undefined ? undefined : sectionId === null ? undefined : eq(schoolEnrollments.sectionId, sectionId),
  ))
  .orderBy(asc(schoolStudents.lastNames), asc(schoolStudents.firstNames));

const emptyCounts = (): Record<FinalSituation | 'missing', number> => ({ PROMOTED: 0, REPEATS: 0, RECOVERY: 0, LEAVES: 0, GRADUATED: 0, missing: 0 });

export const schoolPromotionService = {
  /** La promoción del año: destinos por sección, conteos por situación y si ya se puede cerrar. */
  async overview(schoolId: string, yearId: string) {
    const { year, target } = await loadYears(db, schoolId, yearId);
    if (year.status === 'PLANNING') throw new ConflictError('La promoción es del año en curso');
    const periods = await db.select({ status: schoolPeriods.status }).from(schoolPeriods).where(eq(schoolPeriods.yearId, yearId));
    const locked = periods.filter((p) => p.status === 'LOCKED' || p.status === 'PUBLISHED').length;
    const context = await planContext(db, schoolId, yearId, target?.id ?? null);
    // Cerrado: las situaciones ya son las de la matrícula (incluye a quienes luego egresaron o no continuaron).
    const rows = year.status === 'CLOSED'
      ? await db.select({
        id: schoolEnrollments.id, studentId: schoolEnrollments.studentId, sectionId: schoolEnrollments.sectionId,
        finalSituation: schoolEnrollments.finalSituation, nextSectionId: schoolEnrollments.nextSectionId,
        firstNames: schoolStudents.firstNames, lastNames: schoolStudents.lastNames,
      }).from(schoolEnrollments).innerJoin(schoolStudents, eq(schoolStudents.id, schoolEnrollments.studentId))
        .where(and(eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.status, 'ACTIVE'), isNotNull(schoolEnrollments.finalSituation)))
        .orderBy(asc(schoolStudents.lastNames), asc(schoolStudents.firstNames))
      : await activeEnrollments(db, schoolId, yearId);
    const counts = emptyCounts();
    const bySection = new Map<string, ReturnType<typeof emptyCounts>>();
    let noSection = 0;
    const recovery: Array<{ studentId: string; name: string; from: string | null; target: string | null; targetLabel: string | null }> = [];
    for (const row of rows) {
      const plan = resolve(row, context);
      counts[plan.situation]++;
      const missing = STAYS.has(plan.situation) && !plan.target;
      if (missing) counts.missing++;
      if (!row.sectionId) noSection++;
      else {
        const own = bySection.get(row.sectionId) ?? emptyCounts();
        own[plan.situation]++;
        if (missing) own.missing++;
        bySection.set(row.sectionId, own);
      }
      if (year.status === 'CLOSED' && plan.situation === 'RECOVERY') {
        const t = context.targets.find((s) => s.id === plan.target);
        recovery.push({ studentId: row.studentId, name: `${row.lastNames}, ${row.firstNames}`, from: plan.section ? label(plan.section) : null, target: plan.target, targetLabel: t ? label(t) : null });
      }
    }
    const levels = [...new Set(context.sections.map((s) => s.level))];
    return {
      year: { id: year.id, name: year.name, status: year.status },
      target: target ? { id: target.id, name: target.name } : null,
      periods: { total: periods.length, locked },
      closable: year.status === 'ACTIVE' && !!target && periods.length > 0 && locked === periods.length && counts.missing === 0,
      counts,
      noSection,
      levels: levels.map((level) => ({
        level,
        sections: context.sections.filter((s) => s.level === level).map((s) => {
          const { destination, explicit } = context.destinations.get(s.id)!;
          const t = destination.kind === 'SECTION' ? context.targets.find((x) => x.id === destination.sectionId) : null;
          const own = bySection.get(s.id) ?? emptyCounts();
          return {
            id: s.id, label: label(s), grade: s.grade,
            students: FINAL_SITUATIONS.reduce((sum, k) => sum + own[k], 0),
            destination: { kind: destination.kind, sectionId: t?.id ?? null, label: t ? label(t) : null, explicit },
            counts: own,
          };
        }),
      })),
      targets: context.targets.map((t) => ({ id: t.id, level: t.level, grade: t.grade, label: label(t) })),
      recovery,
    };
  },

  /** Los estudiantes de una sección (o los sin sección) con su situación y su sección del año siguiente. */
  async sectionStudents(schoolId: string, yearId: string, sectionId: string | null) {
    const { year, target } = await loadYears(db, schoolId, yearId);
    if (year.status !== 'ACTIVE') throw new ConflictError('La promoción se edita en el año en curso');
    if (sectionId) {
      const [own] = await db.select({ id: schoolSections.id }).from(schoolSections)
        .where(and(eq(schoolSections.id, sectionId), eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId)));
      if (!own) throw new NotFoundError('Sección no encontrada');
    }
    const context = await planContext(db, schoolId, yearId, target?.id ?? null);
    const rows = (await activeEnrollments(db, schoolId, yearId, sectionId)).filter((r) => (sectionId ? r.sectionId === sectionId : !r.sectionId));
    return rows.map((row) => {
      const plan = resolve(row, context);
      const t = context.targets.find((s) => s.id === plan.target);
      return {
        studentId: row.studentId, name: `${row.lastNames}, ${row.firstNames}`,
        situation: plan.situation, explicit: plan.explicit, target: plan.target, targetLabel: t ? label(t) : null,
      };
    });
  },

  /** El destino de una sección: otra sección del año siguiente, «egresan» o volver al de por defecto (null). */
  async setSectionDestination(schoolId: string, yearId: string, sectionId: string, actorId: string, choice: { target: string | 'GRADUATE' | null }) {
    const { year, target } = await loadYears(db, schoolId, yearId);
    if (year.status !== 'ACTIVE') throw new ConflictError('La promoción se edita en el año en curso');
    if (!target) throw new ConflictError('Primero prepara el año siguiente');
    const [section] = await db.select({ id: schoolSections.id }).from(schoolSections)
      .where(and(eq(schoolSections.id, sectionId), eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId)));
    if (!section) throw new NotFoundError('Sección no encontrada');
    if (choice.target === null) {
      await db.delete(schoolSectionPromotions).where(eq(schoolSectionPromotions.sectionId, sectionId));
      return;
    }
    if (choice.target !== 'GRADUATE') {
      const [dest] = await db.select({ id: schoolSections.id }).from(schoolSections)
        .where(and(eq(schoolSections.id, choice.target), eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, target.id)));
      if (!dest) throw new ValidationError(`Esa sección no es de ${target.name}`);
    }
    const values = {
      targetSectionId: choice.target === 'GRADUATE' ? null : choice.target,
      graduates: choice.target === 'GRADUATE', updatedBy: actorId, updatedAt: new Date(),
    };
    await db.insert(schoolSectionPromotions).values({ sectionId, schoolId, ...values }).onDuplicateKeyUpdate({ set: values });
  },

  /**
   * La situación de un estudiante (null = la de su sección) y, si sigue, su sección del año siguiente. Antes del cierre
   * se marca cualquier situación; ya cerrado, solo se resuelve una recuperación (Promovido o Permanece) mientras el año
   * siguiente no empieza.
   */
  async setStudentSituation(schoolId: string, yearId: string, studentId: string, actorId: string, input: { situation: FinalSituation | null; targetSectionId?: string | null }) {
    const { year, target } = await loadYears(db, schoolId, yearId);
    if (!target) throw new ConflictError(year.status === 'CLOSED' ? 'El año siguiente ya empezó: la recuperación se resolvió en su momento' : 'Primero prepara el año siguiente');
    if (year.status === 'PLANNING') throw new ConflictError('La promoción es del año en curso');
    const closed = year.status === 'CLOSED';
    if (closed && (input.situation !== 'PROMOTED' && input.situation !== 'REPEATS')) throw new ValidationError('Una recuperación se resuelve como Promovido o Permanece');
    if (input.situation && !STAYS.has(input.situation) && input.targetSectionId) throw new ValidationError(`«${LABEL[input.situation]}» no tiene sección el año siguiente`);
    const now = new Date();
    return db.transaction(async (tx) => {
      const [enrollment] = await tx.select().from(schoolEnrollments)
        .where(and(eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.studentId, studentId), eq(schoolEnrollments.schoolId, schoolId)))
        .for('update');
      if (!enrollment || enrollment.status !== 'ACTIVE') throw new NotFoundError('No está matriculado en este año');
      if (closed && enrollment.finalSituation !== 'RECOVERY') throw new ConflictError('Ese estudiante no está en recuperación');
      const [student] = await tx.select({ status: schoolStudents.status }).from(schoolStudents).where(eq(schoolStudents.id, studentId));
      if (!closed && student?.status !== 'ACTIVE') throw new ConflictError('Ese estudiante ya no está activo en el colegio');
      const context = await planContext(tx, schoolId, yearId, target.id);
      const section = enrollment.sectionId ? context.sections.find((s) => s.id === enrollment.sectionId) ?? null : null;
      let nextSectionId: string | null = null;
      if (input.situation && STAYS.has(input.situation) && input.targetSectionId) {
        const dest = context.targets.find((t) => t.id === input.targetSectionId);
        if (!dest) throw new ValidationError(`Esa sección no es de ${target.name}`);
        if (input.situation === 'REPEATS' && section && (dest.level !== section.level || dest.grade !== section.grade)) {
          throw new ValidationError(`Quien permanece sigue en ${section.level === 'INICIAL' ? `${section.grade} años` : `${section.grade}.°`}: elige una sección de ese grado`);
        }
        nextSectionId = dest.id;
      }
      await tx.update(schoolEnrollments).set({ finalSituation: input.situation, nextSectionId, ...(closed ? { finalSituationAt: now } : {}), updatedAt: now })
        .where(eq(schoolEnrollments.id, enrollment.id));
      const plan = resolve({ ...enrollment, finalSituation: input.situation, nextSectionId, firstNames: '', lastNames: '' }, context);
      if (closed) {
        // Resuelta la recuperación: su matrícula del año siguiente pasa a la sección que corresponde.
        if (!plan.target) throw new ValidationError(`Elige su sección de ${target.name}`);
        const [next] = await tx.select({ id: schoolEnrollments.id, sectionId: schoolEnrollments.sectionId }).from(schoolEnrollments)
          .where(and(eq(schoolEnrollments.yearId, target.id), eq(schoolEnrollments.studentId, studentId))).for('update');
        if (next) await tx.update(schoolEnrollments).set({ sectionId: plan.target, updatedAt: now }).where(eq(schoolEnrollments.id, next.id));
        else await tx.insert(schoolEnrollments).values({ id: uuidv4(), schoolId, yearId: target.id, studentId, sectionId: plan.target, createdAt: now, updatedAt: now });
        await tx.insert(schoolEnrollmentEvents).values({
          id: uuidv4(), schoolId, studentId, yearId, type: 'SITUATION_CHANGED', fromSectionId: next?.sectionId ?? null, toSectionId: plan.target,
          metadata: { from: 'RECOVERY', to: plan.situation }, actorUserId: actorId, createdAt: now,
        });
      }
      const t = context.targets.find((s) => s.id === plan.target);
      return { studentId, situation: plan.situation, explicit: plan.explicit, target: plan.target, targetLabel: t ? label(t) : null };
    });
  },

  /**
   * Cierra el año: todos sus bimestres cerrados, el año siguiente en preparación y cada estudiante con su sección (si
   * sigue). Deja la situación final en cada matrícula, matricula a quienes siguen en el año siguiente (sin entrar aún a
   * sus clases), marca a quienes no continúan o egresan, archiva las clases del año y las del colegio sin vincular (que
   * quedan en este año), y cierra el año. Todo o nada.
   */
  async close(schoolId: string, yearId: string, actorId: string) {
    const now = new Date();
    // Las clases que se archivan: las del año y las activas del colegio que no son de ningún año (se leen antes de cerrar).
    const loose = await unlinkedClassroomIds(schoolId);
    const classIds = [...new Set([...(await yearClassroomIds(yearId)), ...loose])];
    const result = await db.transaction(async (tx) => {
      // Fila de la escuela bloqueada: no se cruza con crear o preparar otro año.
      await tx.select({ id: schools.id }).from(schools).where(eq(schools.id, schoolId)).for('update');
      const { year, target } = await loadYears(tx, schoolId, yearId);
      if (year.status !== 'ACTIVE') throw new ConflictError(year.status === 'CLOSED' ? `El año ${year.name} ya está cerrado` : 'Solo se cierra el año en curso');
      if (!target) throw new ConflictError(`Primero prepara ${Number(year.name) + 1}: sus secciones reciben a los estudiantes`);
      const periods = await tx.select({ status: schoolPeriods.status }).from(schoolPeriods).where(eq(schoolPeriods.yearId, yearId));
      const open = periods.filter((p) => p.status !== 'LOCKED' && p.status !== 'PUBLISHED').length;
      if (open > 0) throw new ConflictError(`Primero cierra ${open === 1 ? 'el bimestre que falta' : `los ${open} bimestres que faltan`} en «Año escolar»`);
      const context = await planContext(tx, schoolId, yearId, target.id);
      const rows = await activeEnrollments(tx, schoolId, yearId);
      const plans = rows.map((row) => ({ row, plan: resolve(row, context) }));
      const missing = plans.filter(({ plan }) => STAYS.has(plan.situation) && !plan.target).length;
      if (missing > 0) throw new ConflictError(`${missing} ${missing === 1 ? 'estudiante aún no tiene' : 'estudiantes aún no tienen'} sección en ${target.name}`);

      const counts = emptyCounts();
      const nextRows = plans.filter(({ plan }) => STAYS.has(plan.situation));
      const existing = nextRows.length ? await tx.select({ id: schoolEnrollments.id, studentId: schoolEnrollments.studentId, sectionId: schoolEnrollments.sectionId, status: schoolEnrollments.status })
        .from(schoolEnrollments).where(and(eq(schoolEnrollments.yearId, target.id), inArray(schoolEnrollments.studentId, nextRows.map(({ row }) => row.studentId))))
        .for('update') : [];
      const existingBy = new Map(existing.map((e) => [e.studentId, e]));
      const events: Array<typeof schoolEnrollmentEvents.$inferInsert> = [];
      const inserts: Array<typeof schoolEnrollments.$inferInsert> = [];
      for (const { row, plan } of plans) {
        counts[plan.situation]++;
        await tx.update(schoolEnrollments).set({ finalSituation: plan.situation, finalSituationAt: now, nextSectionId: plan.target, updatedAt: now })
          .where(eq(schoolEnrollments.id, row.id));
        events.push({ id: uuidv4(), schoolId, studentId: row.studentId, yearId, type: 'FINAL_SITUATION', fromSectionId: row.sectionId, toSectionId: plan.target, metadata: { situation: plan.situation }, actorUserId: actorId, createdAt: now });
        if (!STAYS.has(plan.situation)) continue;
        const before = existingBy.get(row.studentId);
        if (!before) {
          inserts.push({ id: uuidv4(), schoolId, yearId: target.id, studentId: row.studentId, sectionId: plan.target, createdAt: now, updatedAt: now });
          events.push({ id: uuidv4(), schoolId, studentId: row.studentId, yearId: target.id, type: 'ENROLLED', toSectionId: plan.target, metadata: { promotion: true, situation: plan.situation }, actorUserId: actorId, createdAt: now });
        } else if (!before.sectionId || before.status !== 'ACTIVE') {
          // Ya estaba en el año siguiente (por una importación): toma su sección.
          await tx.update(schoolEnrollments).set({ sectionId: plan.target, status: 'ACTIVE', updatedAt: now }).where(eq(schoolEnrollments.id, before.id));
          events.push({ id: uuidv4(), schoolId, studentId: row.studentId, yearId: target.id, type: 'SECTION_CHANGED', toSectionId: plan.target, metadata: { promotion: true, situation: plan.situation }, actorUserId: actorId, createdAt: now });
        }
      }
      for (let i = 0; i < inserts.length; i += 200) await tx.insert(schoolEnrollments).values(inserts.slice(i, i + 200));
      for (let i = 0; i < events.length; i += 200) await tx.insert(schoolEnrollmentEvents).values(events.slice(i, i + 200));
      // Quienes no continúan dejan el colegio (como un retiro); quienes egresan, también. Sus perfiles quedan en las clases
      // archivadas con su historia.
      const leaving = plans.filter(({ plan }) => plan.situation === 'LEAVES').map(({ row }) => row.studentId);
      const graduating = plans.filter(({ plan }) => plan.situation === 'GRADUATED').map(({ row }) => row.studentId);
      for (let i = 0; i < leaving.length; i += 500) await tx.update(schoolStudents).set({ status: 'WITHDRAWN', updatedAt: now }).where(inArray(schoolStudents.id, leaving.slice(i, i + 500)));
      for (let i = 0; i < graduating.length; i += 500) await tx.update(schoolStudents).set({ status: 'GRADUATED', updatedAt: now }).where(inArray(schoolStudents.id, graduating.slice(i, i + 500)));

      await tx.update(schoolYears).set({ status: 'CLOSED', updatedAt: now }).where(eq(schoolYears.id, yearId));
      // Las clases del año se archivan; sus compras pendientes ya no se atenderán (nunca cobraron).
      if (classIds.length > 0) {
        const profiles = (await tx.select({ id: studentProfiles.id }).from(studentProfiles).where(inArray(studentProfiles.classroomId, classIds))).map((p) => p.id);
        for (let i = 0; i < profiles.length; i += 500) {
          const part = profiles.slice(i, i + 500);
          await tx.update(purchases).set({ status: 'REJECTED' })
            .where(and(eq(purchases.status, 'PENDING'), or(inArray(purchases.studentId, part), inArray(purchases.buyerId, part))));
        }
        await tx.update(classrooms).set({ isActive: false, updatedAt: now }).where(and(inArray(classrooms.id, classIds), eq(classrooms.schoolId, schoolId)));
        // Las sueltas quedan en este año: ya no siguen al siguiente y son una temporada de sus estudiantes.
        for (let i = 0; i < loose.length; i += 500) {
          await tx.insert(schoolYearClassrooms).values(loose.slice(i, i + 500).map((classroomId) => ({ classroomId, schoolId, yearId, createdAt: now })))
            .onDuplicateKeyUpdate({ set: { yearId: sql`year_id` } });
        }
      }
      return { year: year.name, target: target.name, counts, archived: classIds.length };
    });
    invalidateSchoolCalendar(schoolId);
    return result;
  },
};
