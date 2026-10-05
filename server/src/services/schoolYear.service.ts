import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { classrooms, schoolPeriods, schoolPlanAreas, schools, schoolSections, schoolYearLevels, schoolYears } from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { affectedRows } from '../utils/points.js';
import { gradeService } from './grade.service.js';
import { invalidateSchoolCalendar, limaToday, schoolCalendars, syncCurrentPeriod } from './schoolCalendar.service.js';

/**
 * Año escolar de la consola: fechas, periodos (por ahora bimestres) y niveles que ofrece la escuela con su escala.
 * Un solo año activo por escuela. Las fechas viajan como texto AAAA-MM-DD (sin zona horaria). El reparto automático
 * de los periodos lo propone el cliente; aquí se validan las reglas.
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

const levelOrder = (level: string) => SCHOOL_LEVELS.indexOf(level as SchoolLevel);

/** Las clases del colegio siguen el bimestre en curso del año activo (lo leen familias, progreso y exportación). */
const syncClasses = async (schoolId: string) => {
  invalidateSchoolCalendar(schoolId);
  const calendar = (await schoolCalendars([schoolId])).get(schoolId);
  if (calendar) await syncCurrentPeriod(calendar);
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

  /** El primer año de la escuela nace activo. El siguiente se prepara al cerrar el actual (Entrega 2). */
  async create(schoolId: string, actorId: string, input: YearInput & { name: string }) {
    validateYear(input);
    const id = uuidv4();
    const now = new Date();
    await db.transaction(async (tx) => {
      // Fila de la escuela bloqueada: dos creaciones a la vez no dejan dos años activos.
      const [school] = await tx.select({ id: schools.id }).from(schools).where(eq(schools.id, schoolId)).for('update');
      if (!school) throw new NotFoundError('Escuela no encontrada');
      const existing = await tx.select({ name: schoolYears.name }).from(schoolYears).where(eq(schoolYears.schoolId, schoolId));
      if (existing.some((y) => y.name === input.name)) throw new ConflictError(`Ya existe el año escolar ${input.name}`);
      if (existing.length > 0) throw new ConflictError('La escuela ya tiene su año escolar: el siguiente se prepara al cerrar el actual');

      await tx.insert(schoolYears).values({
        id, schoolId, name: input.name, status: 'ACTIVE', periodType: input.periodType,
        startsOn: input.startsOn, endsOn: input.endsOn, createdBy: actorId, createdAt: now, updatedAt: now,
      });
      await tx.insert(schoolPeriods).values(input.periods.map((p) => ({
        id: uuidv4(), schoolId, yearId: id, code: p.code, startsOn: p.startsOn, endsOn: p.endsOn, createdAt: now, updatedAt: now,
      })));
      await tx.insert(schoolYearLevels).values(input.levels.map((l) => ({
        yearId: id, level: l.level, schoolId, gradeScale: l.gradeScale, createdAt: now,
      })));
    });
    await syncClasses(schoolId);
    return this.get(schoolId, id);
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
      // El plan de estudios de un nivel que se quita se va con él (no tenía secciones ni asignaciones).
      const removed = SCHOOL_LEVELS.filter((level) => !kept.has(level));
      if (removed.length > 0) await tx.delete(schoolPlanAreas).where(and(eq(schoolPlanAreas.yearId, yearId), inArray(schoolPlanAreas.level, removed)));
    });
    await syncClasses(schoolId);
    return this.get(schoolId, yearId);
  },

  /**
   * La administración cierra un bimestre en todas las clases del colegio: sus notas quedan congeladas (los docentes aún
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
    const classes = await db.select({ id: classrooms.id, useCompetencies: classrooms.useCompetencies })
      .from(classrooms).where(and(eq(classrooms.schoolId, schoolId), eq(classrooms.isActive, true)));
    finalizeInBackground(classes, gradebookPeriod);
    return { code: period.code, label, classes: classes.length };
  },

  /** Reabre un bimestre en todas las clases (también en las que lo habían cerrado por su cuenta): las notas vuelven a cambiar. */
  async reopenPeriod(schoolId: string, yearId: string, code: string) {
    const { period, label, gradebookPeriod } = await loadPeriod(schoolId, yearId, code);
    if (period.status !== 'LOCKED') throw new ConflictError(`El ${label} no está cerrado`);
    const now = new Date();
    const result = await db.update(schoolPeriods)
      .set({ status: 'OPEN', lockedAt: null, lockedBy: null, updatedAt: now })
      .where(and(eq(schoolPeriods.id, period.id), eq(schoolPeriods.status, 'LOCKED')));
    if (affectedRows(result) === 0) throw new ConflictError(`El ${label} no está cerrado`);
    invalidateSchoolCalendar(schoolId);
    const closedByClass = await db.select({ id: classrooms.id, closedBimesters: classrooms.closedBimesters }).from(classrooms)
      .where(and(eq(classrooms.schoolId, schoolId), sql`JSON_CONTAINS(COALESCE(${classrooms.closedBimesters}, JSON_ARRAY()), JSON_OBJECT('period', ${gradebookPeriod}))`));
    for (const c of closedByClass) {
      const rest = closedEntries(c.closedBimesters).filter((entry) => entry.period !== gradebookPeriod);
      await db.update(classrooms).set({ closedBimesters: rest.length > 0 ? rest : null, updatedAt: now }).where(eq(classrooms.id, c.id));
    }
    const classes = await db.select({ id: classrooms.id }).from(classrooms).where(and(eq(classrooms.schoolId, schoolId), eq(classrooms.isActive, true)));
    return { code: period.code, label, classes: classes.length };
  },
};
