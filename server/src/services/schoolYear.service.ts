import { and, asc, count, desc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  classrooms, schoolAreaCoordinators, schoolEnrollments, schoolImportBatches, schoolMembers, schoolPeriods, schoolPlanAreas,
  schoolReportPublications, schoolRosterBuilds, schoolRosterDrafts, schools, schoolSections, schoolStudentMoves,
  schoolTeachingAssignments, schoolWorkshops, schoolWorkshopSections, schoolWorkshopStudents, schoolYearLevels, schoolYears,
  users,
} from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { createNotifications } from '../utils/notificationEmitter.js';
import { affectedRows } from '../utils/points.js';
import { gradeService } from './grade.service.js';
import { classroomsFollowing, invalidateSchoolCalendar, limaToday, syncCurrentPeriod, yearCalendars, yearClassroomIds } from './schoolCalendar.service.js';
import { applyLevelScale } from './schoolClassScale.service.js';

/**
 * Año escolar de la consola: fechas, periodos (por ahora bimestres) y niveles que ofrece la escuela con su escala.
 * El primer año nace activo. El siguiente se prepara como borrador mientras el actual sigue en curso (copiando su
 * estructura): sus clases no reciben estudiantes hasta que empieza. Las fechas viajan como texto AAAA-MM-DD (sin zona
 * horaria). El reparto automático de los periodos lo propone el cliente; aquí se validan las reglas.
 */

export const SCHOOL_LEVELS = ['INICIAL', 'PRIMARIA', 'SECUNDARIA'] as const;
export type SchoolLevel = (typeof SCHOOL_LEVELS)[number];
export type PeriodType = 'BIMESTER' | 'TRIMESTER';
export type GradeScale = 'LITERAL' | 'VIGESIMAL';

export const PERIOD_CODES: Record<PeriodType, string[]> = { BIMESTER: ['B1', 'B2', 'B3', 'B4'], TRIMESTER: ['T1', 'T2', 'T3'] };
const PERIOD_LABEL: Record<PeriodType, string> = { BIMESTER: 'bimestre', TRIMESTER: 'trimestre' };
const LEVEL_NAME: Record<SchoolLevel, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' };

export interface YearInput {
  startsOn: string;
  endsOn: string;
  periodType: PeriodType;
  periods: Array<{ code: string; startsOn: string; endsOn: string }>;
  levels: Array<{ level: SchoolLevel; gradeScale: GradeScale }>;
}

/** Qué se copia del año de origen al preparar el siguiente. */
export interface CopyOptions {
  yearId: string;
  sections: boolean;
  tutors: boolean;
  plan: boolean;
  assignments: boolean;
  workshops: boolean;
  coordinators: boolean;
}

export interface CopySummary {
  sections: number;
  tutors: number;
  planLevels: number;
  assignments: number;
  workshops: number;
  coordinators: number;
  /** Tutorías, asignaciones, talleres y coordinaciones que no se copiaron: esa persona ya no está en el equipo. */
  notInTeam: number;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

/** Reglas: periodos completos, en orden, dentro del año y sin solaparse. Los huecos (vacaciones) se permiten. */
const validateYear = (input: YearInput) => {
  const start = dayNumber(input.startsOn);
  const end = dayNumber(input.endsOn);
  if (!(end > start)) throw new ValidationError('El año escolar debe terminar después de empezar');
  if (end - start > 366) throw new ValidationError('El año escolar no puede durar más de un año');

  const codes = PERIOD_CODES[input.periodType];
  const label = PERIOD_LABEL[input.periodType];
  if (input.periods.length !== codes.length || input.periods.some((p, i) => p.code !== codes[i])) {
    throw new ValidationError(`Un año por ${label}s tiene ${codes.length} ${label}s, en orden`);
  }
  let previousEnd = -Infinity;
  input.periods.forEach((p, i) => {
    const pStart = dayNumber(p.startsOn);
    const pEnd = dayNumber(p.endsOn);
    const name = `El ${label} ${i + 1}`;
    if (pEnd < pStart) throw new ValidationError(`${name} termina antes de empezar`);
    if (pStart < start || pEnd > end) throw new ValidationError(`${name} queda fuera de las fechas del año escolar`);
    if (pStart <= previousEnd) throw new ValidationError(`${name} empieza antes de que termine el anterior`);
    previousEnd = pEnd;
  });

  if (input.levels.length === 0) throw new ValidationError('Elige al menos un nivel');
  if (new Set(input.levels.map((l) => l.level)).size !== input.levels.length) throw new ValidationError('Hay un nivel repetido');
};

/** Los años van uno después de otro: el de nombre menor termina antes de que empiece el de nombre mayor. */
const assertInOrder = (year: { name: string; startsOn: string; endsOn: string }, others: Array<{ name: string; startsOn: string; endsOn: string }>) => {
  for (const other of others) {
    if (other.name < year.name && year.startsOn <= other.endsOn) {
      throw new ValidationError(`El año ${year.name} debe empezar después de que termine ${other.name} (${other.endsOn})`);
    }
    if (other.name > year.name && year.endsOn >= other.startsOn) {
      throw new ValidationError(`El año ${year.name} debe terminar antes de que empiece ${other.name} (${other.startsOn})`);
    }
  }
};

const levelOrder = (level: string) => SCHOOL_LEVELS.indexOf(level as SchoolLevel);

/** Las clases que siguen el año ponen al día su bimestre en curso (lo leen familias, progreso y exportación). */
const syncYear = async (schoolId: string, yearId: string) => {
  invalidateSchoolCalendar(schoolId);
  const calendar = (await yearCalendars([yearId])).get(yearId);
  if (calendar) await syncCurrentPeriod(calendar);
};

/** Las clases activas que siguen un año (las suyas y, si es el activo, las del colegio aún sin vincular). */
const followingClasses = async (schoolId: string, yearId: string) => {
  const calendar = (await yearCalendars([yearId])).get(yearId);
  const ids = calendar ? await classroomsFollowing(calendar) : [];
  if (ids.length === 0) return [];
  return db.select({ id: classrooms.id, useCompetencies: classrooms.useCompetencies }).from(classrooms)
    .where(and(inArray(classrooms.id, ids), eq(classrooms.schoolId, schoolId), eq(classrooms.isActive, true)));
};

/** Un bimestre del año en curso (solo se cierran y reabren los del año activo). */
const loadPeriod = async (schoolId: string, yearId: string, code: string) => {
  const [year] = await db.select({ id: schoolYears.id, name: schoolYears.name, status: schoolYears.status, periodType: schoolYears.periodType })
    .from(schoolYears).where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)));
  if (!year) throw new NotFoundError('Año escolar no encontrado');
  if (year.status !== 'ACTIVE' || year.periodType !== 'BIMESTER') throw new ConflictError('Solo se cierran los bimestres del año escolar en curso');
  const [period] = await db.select().from(schoolPeriods).where(and(eq(schoolPeriods.yearId, yearId), eq(schoolPeriods.code, code)));
  if (!period) throw new NotFoundError('Bimestre no encontrado');
  return { year, period, label: `Bimestre ${code.slice(1)}`, gradebookPeriod: `${year.name}-${code}` };
};

const closedEntries = (raw: unknown): Array<{ period: string; closedAt: string; closedBy: string }> => {
  const value = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  return Array.isArray(value) ? value.filter((e) => e && typeof e.period === 'string') : [];
};

/**
 * Tras cerrar un bimestre: la nota final de cada clase (con la evidencia hasta el cierre) y los capítulos «por bimestre»
 * de su Historia. De a una clase y en segundo plano; si algo falla, el registro de la clase la calcula al abrirse.
 */
const finalizeInBackground = (classes: Array<{ id: string; useCompetencies: boolean }>, period: string) => {
  void (async () => {
    const { storyService } = await import('./story.service.js');
    for (const c of classes) {
      if (c.useCompetencies) {
        try {
          await gradeService.finalizeLockedPeriod(c.id, period);
        } catch (error) {
          logger.error('Nota final del bimestre cerrado por el colegio falló', { classroomId: c.id, period, error: error instanceof Error ? error.message : String(error) });
        }
      }
      try {
        await storyService.onBimesterClosed(c.id);
      } catch {
        // La Historia no bloquea el cierre.
      }
    }
  })();
};

const chunks = <T>(items: T[], size = 200) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

/**
 * Copia la estructura de un año al borrador del siguiente: secciones (con su tutor), plan de estudios, asignaciones
 * (sin clase: se crean después), talleres (sin clase ni inscritos: se eligen cada año) y coordinaciones. Solo de los
 * niveles que ofrece el año nuevo y con quienes siguen en el equipo.
 */
const copyStructure = async (tx: Tx, input: {
  schoolId: string; sourceYearId: string; targetYearId: string; levels: Set<string>; actorId: string; options: CopyOptions; now: Date;
}): Promise<CopySummary> => {
  const { schoolId, sourceYearId, targetYearId, levels, actorId, options, now } = input;
  const summary: CopySummary = { sections: 0, tutors: 0, planLevels: 0, assignments: 0, workshops: 0, coordinators: 0, notInTeam: 0 };
  const team = new Set((await tx.select({ userId: schoolMembers.userId }).from(schoolMembers)
    .innerJoin(users, eq(users.id, schoolMembers.userId))
    .where(and(eq(schoolMembers.schoolId, schoolId), eq(schoolMembers.status, 'VERIFIED'), eq(users.isActive, true), eq(users.role, 'TEACHER'))))
    .map((m) => m.userId));

  const sectionMap = new Map<string, string>();
  if (options.sections) {
    const source = await tx.select().from(schoolSections).where(and(eq(schoolSections.yearId, sourceYearId), eq(schoolSections.schoolId, schoolId)));
    const rows = source.filter((s) => levels.has(s.level)).map((s) => {
      const id = uuidv4();
      sectionMap.set(s.id, id);
      const tutor = options.tutors && s.tutorUserId ? (team.has(s.tutorUserId) ? s.tutorUserId : null) : null;
      if (tutor) summary.tutors++;
      else if (options.tutors && s.tutorUserId) summary.notInTeam++;
      return { id, schoolId, yearId: targetYearId, level: s.level, grade: s.grade, name: s.name, shift: s.shift, tutorUserId: tutor, createdAt: now, updatedAt: now };
    });
    for (const part of chunks(rows)) await tx.insert(schoolSections).values(part);
    summary.sections = rows.length;
  }

  if (options.plan) {
    const source = await tx.select().from(schoolPlanAreas).where(and(eq(schoolPlanAreas.yearId, sourceYearId), eq(schoolPlanAreas.schoolId, schoolId)));
    const rows = source.filter((p) => levels.has(p.level)).map((p) => ({
      yearId: targetYearId, level: p.level, areaId: p.areaId, schoolId, grades: p.grades, displayOrder: p.displayOrder, createdAt: now,
    }));
    for (const part of chunks(rows)) await tx.insert(schoolPlanAreas).values(part);
    summary.planLevels = new Set(rows.map((r) => r.level)).size;
  }

  if (options.assignments) {
    const source = await tx.select().from(schoolTeachingAssignments)
      .where(and(eq(schoolTeachingAssignments.yearId, sourceYearId), eq(schoolTeachingAssignments.schoolId, schoolId)));
    const rows = [];
    for (const a of source) {
      const sectionId = sectionMap.get(a.sectionId);
      if (!sectionId) continue;
      if (!team.has(a.teacherUserId)) {
        summary.notInTeam++;
        continue;
      }
      rows.push({
        id: uuidv4(), schoolId, yearId: targetYearId, sectionId, areaId: a.areaId, teacherUserId: a.teacherUserId, classroomId: null,
        createdBy: actorId, createdAt: now, updatedAt: now,
      });
    }
    for (const part of chunks(rows)) await tx.insert(schoolTeachingAssignments).values(part);
    summary.assignments = rows.length;
  }

  if (options.workshops) {
    const source = await tx.select().from(schoolWorkshops).where(and(eq(schoolWorkshops.yearId, sourceYearId), eq(schoolWorkshops.schoolId, schoolId)));
    const links = source.length === 0 ? [] : await tx.select().from(schoolWorkshopSections)
      .where(inArray(schoolWorkshopSections.workshopId, source.map((w) => w.id)));
    for (const w of source) {
      if (!levels.has(w.level)) continue;
      if (!team.has(w.teacherUserId)) {
        summary.notInTeam++;
        continue;
      }
      const sectionIds = w.mode === 'SECTION'
        ? links.filter((l) => l.workshopId === w.id).map((l) => sectionMap.get(l.sectionId)).filter((id): id is string => !!id)
        : [];
      // Un taller de secciones sin ninguna de sus secciones en el año nuevo no tiene a quién llegar.
      if (w.mode === 'SECTION' && sectionIds.length === 0) continue;
      const id = uuidv4();
      await tx.insert(schoolWorkshops).values({
        id, schoolId, yearId: targetYearId, level: w.level, areaId: w.areaId, name: w.name, teacherUserId: w.teacherUserId, classroomId: null,
        mode: w.mode, weight: w.weight, createdBy: actorId, createdAt: now, updatedAt: now,
      });
      if (sectionIds.length > 0) await tx.insert(schoolWorkshopSections).values(sectionIds.map((sectionId) => ({ workshopId: id, sectionId })));
      summary.workshops++;
    }
  }

  if (options.coordinators) {
    const source = await tx.select().from(schoolAreaCoordinators)
      .where(and(eq(schoolAreaCoordinators.yearId, sourceYearId), eq(schoolAreaCoordinators.schoolId, schoolId)));
    const rows = [];
    for (const c of source) {
      if (!levels.has(c.level)) continue;
      if (!team.has(c.userId)) {
        summary.notInTeam++;
        continue;
      }
      rows.push({ id: uuidv4(), schoolId, yearId: targetYearId, level: c.level, areaId: c.areaId, userId: c.userId, createdBy: actorId, createdAt: now });
    }
    for (const part of chunks(rows)) await tx.insert(schoolAreaCoordinators).values(part);
    summary.coordinators = rows.length;
  }
  return summary;
};

export const schoolYearService = {
  async list(schoolId: string) {
    return db
      .select({
        id: schoolYears.id, name: schoolYears.name, status: schoolYears.status, periodType: schoolYears.periodType,
        startsOn: schoolYears.startsOn, endsOn: schoolYears.endsOn,
      })
      .from(schoolYears)
      .where(eq(schoolYears.schoolId, schoolId))
      .orderBy(desc(schoolYears.name));
  },

  async get(schoolId: string, yearId: string) {
    const [year] = await db.select().from(schoolYears).where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)));
    if (!year) throw new NotFoundError('Año escolar no encontrado');
    const periods = await db.select().from(schoolPeriods).where(eq(schoolPeriods.yearId, yearId)).orderBy(asc(schoolPeriods.code));
    const levels = await db.select().from(schoolYearLevels).where(eq(schoolYearLevels.yearId, yearId));
    return {
      id: year.id,
      name: year.name,
      status: year.status,
      periodType: year.periodType,
      startsOn: year.startsOn,
      endsOn: year.endsOn,
      periods: periods.map((p) => ({
        id: p.id, code: p.code, startsOn: p.startsOn, endsOn: p.endsOn, status: p.status, lockedAt: p.lockedAt, started: p.startsOn <= limaToday(),
      })),
      levels: levels
        .map((l) => ({ level: l.level, gradeScale: l.gradeScale }))
        .sort((a, b) => levelOrder(a.level) - levelOrder(b.level)),
    };
  },

  /**
   * El primer año de la escuela nace activo. Con un año en curso (o ya cerrado), el siguiente nace en preparación: uno
   * a la vez, después del último y, si se pide, copiando la estructura de un año anterior.
   */
  async create(schoolId: string, actorId: string, input: YearInput & { name: string; copyFrom?: CopyOptions }) {
    validateYear(input);
    const { copyFrom } = input;
    if (copyFrom) {
      if (copyFrom.tutors && !copyFrom.sections) throw new ValidationError('Para copiar las tutorías, copia también las secciones');
      if ((copyFrom.assignments || copyFrom.workshops) && !(copyFrom.sections && copyFrom.plan)) {
        throw new ValidationError('Para copiar asignaciones o talleres, copia también las secciones y el plan de estudios');
      }
    }
    const id = uuidv4();
    const now = new Date();
    let copied: CopySummary | null = null;
    await db.transaction(async (tx) => {
      // Fila de la escuela bloqueada: dos creaciones a la vez no dejan dos años activos ni dos borradores.
      const [school] = await tx.select({ id: schools.id }).from(schools).where(eq(schools.id, schoolId)).for('update');
      if (!school) throw new NotFoundError('Escuela no encontrada');
      const existing = await tx.select({ id: schoolYears.id, name: schoolYears.name, status: schoolYears.status, startsOn: schoolYears.startsOn, endsOn: schoolYears.endsOn })
        .from(schoolYears).where(eq(schoolYears.schoolId, schoolId));
      if (existing.some((y) => y.name === input.name)) throw new ConflictError(`Ya existe el año escolar ${input.name}`);
      const planning = existing.find((y) => y.status === 'PLANNING');
      if (planning) throw new ConflictError(`Ya estás preparando el año ${planning.name}: termina ese primero`);
      const latest = [...existing].sort((a, b) => b.name.localeCompare(a.name))[0];
      if (latest && input.name < latest.name) throw new ValidationError(`El año que se prepara va después de ${latest.name}`);
      assertInOrder(input, existing);
      const status = existing.length === 0 ? 'ACTIVE' as const : 'PLANNING' as const;
      if (copyFrom && status !== 'PLANNING') throw new ValidationError('Solo el año siguiente se prepara copiando otro');
      if (copyFrom && !existing.some((y) => y.id === copyFrom.yearId)) throw new NotFoundError('Año escolar no encontrado');

      await tx.insert(schoolYears).values({
        id, schoolId, name: input.name, status, periodType: input.periodType,
        startsOn: input.startsOn, endsOn: input.endsOn, createdBy: actorId, createdAt: now, updatedAt: now,
      });
      await tx.insert(schoolPeriods).values(input.periods.map((p) => ({
        id: uuidv4(), schoolId, yearId: id, code: p.code, startsOn: p.startsOn, endsOn: p.endsOn, createdAt: now, updatedAt: now,
      })));
      await tx.insert(schoolYearLevels).values(input.levels.map((l) => ({
        yearId: id, level: l.level, schoolId, gradeScale: l.gradeScale, createdAt: now,
      })));
      if (copyFrom) {
        copied = await copyStructure(tx, {
          schoolId, sourceYearId: copyFrom.yearId, targetYearId: id, levels: new Set(input.levels.map((l) => l.level)), actorId, options: copyFrom, now,
        });
      }
    });
    await syncYear(schoolId, id);
    return { ...(await this.get(schoolId, id)), copied: copied as CopySummary | null };
  },

  /** Guarda fechas, periodos y niveles. Un periodo que ya no está abierto (libreta) no cambia de fechas. */
  async update(schoolId: string, yearId: string, input: YearInput) {
    validateYear(input);
    const now = new Date();
    await db.transaction(async (tx) => {
      const [year] = await tx.select().from(schoolYears)
        .where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)))
        .for('update');
      if (!year) throw new NotFoundError('Año escolar no encontrado');
      if (year.status === 'CLOSED') throw new ConflictError('Este año escolar ya cerró: solo se puede consultar');
      const others = await tx.select({ name: schoolYears.name, startsOn: schoolYears.startsOn, endsOn: schoolYears.endsOn }).from(schoolYears)
        .where(and(eq(schoolYears.schoolId, schoolId), ne(schoolYears.id, yearId)));
      assertInOrder({ name: year.name, startsOn: input.startsOn, endsOn: input.endsOn }, others);

      const current = await tx.select().from(schoolPeriods).where(eq(schoolPeriods.yearId, yearId));
      const byCode = new Map(current.map((p) => [p.code, p]));
      const closed = current.filter((p) => p.status !== 'OPEN');
      if (closed.length > 0) {
        if (year.periodType !== input.periodType) throw new ConflictError('Ya hay periodos en revisión o cerrados: no se puede cambiar el tipo de periodo');
        for (const p of closed) {
          const next = input.periods.find((n) => n.code === p.code);
          if (!next || next.startsOn !== p.startsOn || next.endsOn !== p.endsOn) {
            throw new ConflictError('Las fechas de un periodo en revisión o cerrado no se pueden cambiar');
          }
        }
      }

      await tx.update(schoolYears)
        .set({ periodType: input.periodType, startsOn: input.startsOn, endsOn: input.endsOn, updatedAt: now })
        .where(eq(schoolYears.id, yearId));
      // Periodos por código: los que siguen conservan su id y estado; los que sobran se quitan y los nuevos se crean.
      const keep = new Set(input.periods.map((p) => p.code));
      for (const p of current) {
        if (!keep.has(p.code)) await tx.delete(schoolPeriods).where(eq(schoolPeriods.id, p.id));
      }
      for (const p of input.periods) {
        const existing = byCode.get(p.code);
        if (existing) {
          await tx.update(schoolPeriods).set({ startsOn: p.startsOn, endsOn: p.endsOn, updatedAt: now }).where(eq(schoolPeriods.id, existing.id));
        } else {
          await tx.insert(schoolPeriods).values({ id: uuidv4(), schoolId, yearId, code: p.code, startsOn: p.startsOn, endsOn: p.endsOn, createdAt: now, updatedAt: now });
        }
      }
      // Niveles: se reemplazan, pero no se quita uno que ya tiene secciones.
      const kept = new Set(input.levels.map((l) => l.level));
      const sections = await tx.select({ level: schoolSections.level }).from(schoolSections).where(eq(schoolSections.yearId, yearId));
      const orphaned = SCHOOL_LEVELS.filter((level) => !kept.has(level) && sections.some((s) => s.level === level));
      if (orphaned.length > 0) {
        const names = orphaned.map((level) => LEVEL_NAME[level]).join(' y ');
        throw new ConflictError(`No puedes quitar ${names}: tiene secciones. Quítalas primero en «Grados y secciones».`);
      }
      await tx.delete(schoolYearLevels).where(eq(schoolYearLevels.yearId, yearId));
      await tx.insert(schoolYearLevels).values(input.levels.map((l) => ({
        yearId, level: l.level, schoolId, gradeScale: l.gradeScale, createdAt: now,
      })));
      // El plan de estudios y las coordinaciones de un nivel que se quita se van con él (no tenía secciones).
      const removed = SCHOOL_LEVELS.filter((level) => !kept.has(level));
      if (removed.length > 0) {
        await tx.delete(schoolPlanAreas).where(and(eq(schoolPlanAreas.yearId, yearId), inArray(schoolPlanAreas.level, removed)));
        await tx.delete(schoolAreaCoordinators).where(and(eq(schoolAreaCoordinators.yearId, yearId), inArray(schoolAreaCoordinators.level, removed)));
      }
    });
    await syncYear(schoolId, yearId);
    // La escala de cada nivel manda en sus clases (si cambió, la toman; los bimestres cerrados conservan sus notas).
    await applyLevelScale(await yearClassroomIds(yearId));
    return this.get(schoolId, yearId);
  },

  /**
   * Descarta el año en preparación con lo que se copió o armó en él. No si ya tiene clases o estudiantes matriculados:
   * eso es trabajo de docentes y de la administración que no se borra de un clic.
   */
  async remove(schoolId: string, yearId: string) {
    let name = '';
    await db.transaction(async (tx) => {
      const [year] = await tx.select({ id: schoolYears.id, name: schoolYears.name, status: schoolYears.status }).from(schoolYears)
        .where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId))).for('update');
      if (!year) throw new NotFoundError('Año escolar no encontrado');
      if (year.status !== 'PLANNING') throw new ConflictError('Solo se puede descartar un año en preparación');
      name = year.name;
      const classes = await yearClassroomIds(yearId);
      if (classes.length > 0) {
        throw new ConflictError(`${year.name} ya tiene ${classes.length} ${classes.length === 1 ? 'clase creada' : 'clases creadas'}: quítalas de sus asignaciones y talleres antes de descartarlo`);
      }
      const [{ n }] = await tx.select({ n: count() }).from(schoolEnrollments).where(eq(schoolEnrollments.yearId, yearId));
      if (Number(n) > 0) {
        throw new ConflictError(`${year.name} ya tiene ${n} ${Number(n) === 1 ? 'estudiante matriculado' : 'estudiantes matriculados'}: no se puede descartar`);
      }
      const workshopIds = (await tx.select({ id: schoolWorkshops.id }).from(schoolWorkshops).where(eq(schoolWorkshops.yearId, yearId))).map((w) => w.id);
      if (workshopIds.length > 0) {
        await tx.delete(schoolWorkshopSections).where(inArray(schoolWorkshopSections.workshopId, workshopIds));
        await tx.delete(schoolWorkshopStudents).where(inArray(schoolWorkshopStudents.workshopId, workshopIds));
        await tx.delete(schoolWorkshops).where(inArray(schoolWorkshops.id, workshopIds));
      }
      await tx.delete(schoolTeachingAssignments).where(eq(schoolTeachingAssignments.yearId, yearId));
      await tx.delete(schoolAreaCoordinators).where(eq(schoolAreaCoordinators.yearId, yearId));
      await tx.delete(schoolPlanAreas).where(eq(schoolPlanAreas.yearId, yearId));
      await tx.delete(schoolSections).where(eq(schoolSections.yearId, yearId));
      await tx.delete(schoolRosterDrafts).where(eq(schoolRosterDrafts.yearId, yearId));
      await tx.delete(schoolRosterBuilds).where(eq(schoolRosterBuilds.yearId, yearId));
      await tx.delete(schoolImportBatches).where(eq(schoolImportBatches.yearId, yearId));
      await tx.delete(schoolStudentMoves).where(eq(schoolStudentMoves.yearId, yearId));
      await tx.delete(schoolYearLevels).where(eq(schoolYearLevels.yearId, yearId));
      await tx.delete(schoolPeriods).where(eq(schoolPeriods.yearId, yearId));
      await tx.delete(schoolYears).where(eq(schoolYears.id, yearId));
    });
    invalidateSchoolCalendar(schoolId);
    return { id: yearId, name };
  },

  /**
   * La administración cierra un bimestre en todas las clases del año: sus notas quedan congeladas (los docentes aún
   * escriben conclusiones y exportan). Solo uno que ya empezó.
   */
  async closePeriod(schoolId: string, yearId: string, code: string, actorId: string) {
    const { period, label, gradebookPeriod } = await loadPeriod(schoolId, yearId, code);
    if (period.status === 'LOCKED' || period.status === 'PUBLISHED') throw new ConflictError(`El ${label} ya está cerrado`);
    if (period.startsOn > limaToday()) throw new ConflictError(`El ${label} aún no empieza`);
    const now = new Date();
    // Condicional: dos cierres a la vez no se pisan.
    const result = await db.update(schoolPeriods)
      .set({ status: 'LOCKED', lockedAt: now, lockedBy: actorId, updatedAt: now })
      .where(and(eq(schoolPeriods.id, period.id), inArray(schoolPeriods.status, ['OPEN', 'REVIEW'])));
    if (affectedRows(result) === 0) throw new ConflictError(`El ${label} ya está cerrado`);
    invalidateSchoolCalendar(schoolId);
    const classes = await followingClasses(schoolId, yearId);
    finalizeInBackground(classes, gradebookPeriod);
    return { code: period.code, label, classes: classes.length };
  },

  /**
   * «En revisión»: el aviso de cierre del bimestre. Sigue abierto (los docentes aún editan) y cada docente del año recibe un
   * aviso en su campana para completar notas y conclusiones; la administración sigue el avance en «Libretas» y luego cierra.
   */
  async startReview(schoolId: string, yearId: string, code: string) {
    const { period, label } = await loadPeriod(schoolId, yearId, code);
    if (period.status !== 'OPEN') throw new ConflictError(period.status === 'REVIEW' ? `El ${label} ya está en revisión` : `El ${label} ya está cerrado`);
    if (period.startsOn > limaToday()) throw new ConflictError(`El ${label} aún no empieza`);
    const now = new Date();
    const result = await db.update(schoolPeriods).set({ status: 'REVIEW', updatedAt: now })
      .where(and(eq(schoolPeriods.id, period.id), eq(schoolPeriods.status, 'OPEN')));
    if (affectedRows(result) === 0) throw new ConflictError(`El ${label} ya está en revisión`);
    invalidateSchoolCalendar(schoolId);
    // Los docentes de las asignaciones y talleres del año (con clase).
    const teachers = [...new Set([
      ...(await db.select({ id: schoolTeachingAssignments.teacherUserId }).from(schoolTeachingAssignments)
        .where(and(eq(schoolTeachingAssignments.yearId, yearId), isNotNull(schoolTeachingAssignments.classroomId)))).map((t) => t.id),
      ...(await db.select({ id: schoolWorkshops.teacherUserId }).from(schoolWorkshops)
        .where(and(eq(schoolWorkshops.yearId, yearId), isNotNull(schoolWorkshops.classroomId)))).map((t) => t.id),
    ])];
    const number = Number(code.slice(1));
    await createNotifications(teachers.map((userId) => ({
      userId, type: 'ANNOUNCEMENT' as const, title: `Libretas del bimestre ${number}: en revisión`,
      message: `Tu colegio está revisando las libretas del ${label.toLowerCase()}: completa tus notas y las conclusiones que pide la norma antes del cierre.`,
      data: { kind: 'REPORT_REVIEW', yearId, period: code },
    })));
    return { code: period.code, label, teachers: teachers.length };
  },

  /**
   * Reabre un bimestre en todas las clases del año (también en las que lo habían cerrado por su cuenta): las notas vuelven a
   * cambiar. Uno en revisión vuelve a abierto; uno con las libretas publicadas pide un motivo (queda en esa versión) y, al
   * publicarlo de nuevo, sale la versión siguiente.
   */
  async reopenPeriod(schoolId: string, yearId: string, code: string, reason?: string | null) {
    const { period, label, gradebookPeriod } = await loadPeriod(schoolId, yearId, code);
    if (period.status === 'OPEN') throw new ConflictError(`El ${label} no está cerrado`);
    if (period.status === 'PUBLISHED' && !reason?.trim()) throw new ValidationError('Para corregir unas libretas publicadas, escribe el motivo');
    const now = new Date();
    const result = await db.update(schoolPeriods)
      .set({ status: 'OPEN', lockedAt: null, lockedBy: null, updatedAt: now })
      .where(and(eq(schoolPeriods.id, period.id), eq(schoolPeriods.status, period.status)));
    if (affectedRows(result) === 0) throw new ConflictError(`El ${label} cambió mientras tanto: recarga la página`);
    if (period.status === 'PUBLISHED') {
      const [latest] = await db.select({ id: schoolReportPublications.id }).from(schoolReportPublications)
        .where(and(eq(schoolReportPublications.yearId, yearId), eq(schoolReportPublications.periodCode, code)))
        .orderBy(desc(schoolReportPublications.version)).limit(1);
      if (latest) await db.update(schoolReportPublications).set({ correctionReason: reason!.trim().slice(0, 255) }).where(eq(schoolReportPublications.id, latest.id));
    }
    invalidateSchoolCalendar(schoolId);
    const closedByClass = await db.select({ id: classrooms.id, closedBimesters: classrooms.closedBimesters }).from(classrooms)
      .where(and(eq(classrooms.schoolId, schoolId), isNotNull(classrooms.closedBimesters),
        sql`JSON_CONTAINS(COALESCE(${classrooms.closedBimesters}, JSON_ARRAY()), JSON_OBJECT('period', ${gradebookPeriod}))`));
    for (const c of closedByClass) {
      const rest = closedEntries(c.closedBimesters).filter((entry) => entry.period !== gradebookPeriod);
      await db.update(classrooms).set({ closedBimesters: rest.length > 0 ? rest : null, updatedAt: now }).where(eq(classrooms.id, c.id));
    }
    const classes = await followingClasses(schoolId, yearId);
    return { code: period.code, label, classes: classes.length };
  },
};
