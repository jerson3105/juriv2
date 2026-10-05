import { and, asc, eq, ne } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { schoolMembers, schoolSections, schoolYearLevels, schoolYears, users } from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError, isDuplicateEntry } from '../utils/errors.js';
import type { SchoolLevel } from './schoolYear.service.js';

/**
 * Grados y secciones del año escolar. Una sección es grado + nombre libre dentro de un nivel; el nombre no se repite en
 * el mismo grado (sin distinguir mayúsculas ni tildes, como la base). El tutor es un miembro verificado de la escuela.
 */

/** Grados de cada nivel (EBR): Inicial por edad, Primaria 1.°–6.°, Secundaria 1.°–5.°. */
export const LEVEL_GRADES: Record<SchoolLevel, number[]> = {
  INICIAL: [3, 4, 5],
  PRIMARIA: [1, 2, 3, 4, 5, 6],
  SECUNDARIA: [1, 2, 3, 4, 5],
};

// Caracteres de control e invisibles (incluye los de dirección del texto): no deben quedar en un nombre.
const INVISIBLE = new RegExp('[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069\\ufeff]', 'g');

/** Nombre limpio: sin invisibles ni espacios repetidos. */
export const cleanSectionName = (raw: string) => raw.normalize('NFC').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();

/** Como compara la base: sin mayúsculas ni tildes. */
const comparable = (name: string) => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const keyOf = (level: string, grade: number, name: string) => `${level}|${grade}|${comparable(name)}`;

export const sectionDisplayName = (level: string, grade: number, name: string) =>
  `${level === 'INICIAL' ? `${grade} años` : `${grade}.°`} ${name}`;

export type SectionItem = { level: SchoolLevel; grade: number; name: string };

const selectSections = () => db
  .select({
    id: schoolSections.id,
    level: schoolSections.level,
    grade: schoolSections.grade,
    name: schoolSections.name,
    shift: schoolSections.shift,
    tutorUserId: schoolSections.tutorUserId,
    tutorFirstName: users.firstName,
    tutorLastName: users.lastName,
  })
  .from(schoolSections)
  .leftJoin(users, eq(users.id, schoolSections.tutorUserId));

type SectionRow = Awaited<ReturnType<ReturnType<typeof selectSections>['where']>>[number];

const serialize = (row: SectionRow) => ({
  id: row.id,
  level: row.level,
  grade: row.grade,
  name: row.name,
  shift: row.shift,
  tutor: row.tutorUserId ? { userId: row.tutorUserId, firstName: row.tutorFirstName ?? '', lastName: row.tutorLastName ?? '' } : null,
});

/** El año de la escuela (y sus niveles); para escribir, que no esté cerrado. */
const loadYear = async (schoolId: string, yearId: string, forWrite: boolean) => {
  const [year] = await db.select({ id: schoolYears.id, status: schoolYears.status }).from(schoolYears)
    .where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)));
  if (!year) throw new NotFoundError('Año escolar no encontrado');
  if (forWrite && year.status === 'CLOSED') throw new ConflictError('Este año escolar ya cerró: solo se puede consultar');
  const levels = await db.select({ level: schoolYearLevels.level }).from(schoolYearLevels).where(eq(schoolYearLevels.yearId, yearId));
  return { ...year, levels: new Set(levels.map((l) => l.level)) };
};

const loadSection = async (schoolId: string, sectionId: string) => {
  const [section] = await db.select().from(schoolSections)
    .where(and(eq(schoolSections.id, sectionId), eq(schoolSections.schoolId, schoolId)));
  if (!section) throw new NotFoundError('Sección no encontrada');
  return section;
};

export const schoolSectionService = {
  async list(schoolId: string, yearId: string) {
    await loadYear(schoolId, yearId, false);
    const rows = await selectSections()
      .where(and(eq(schoolSections.yearId, yearId), eq(schoolSections.schoolId, schoolId)))
      .orderBy(asc(schoolSections.level), asc(schoolSections.grade), asc(schoolSections.name));
    return rows.map(serialize);
  },

  /** Crea varias de una vez; las que ya existen (o se repiten en el pedido) se omiten y se devuelven aparte. */
  async createMany(schoolId: string, yearId: string, items: SectionItem[]) {
    const year = await loadYear(schoolId, yearId, true);
    for (const item of items) {
      if (!year.levels.has(item.level)) throw new ValidationError('Ese nivel no está en el año escolar: agrégalo en «Año escolar»');
      if (!LEVEL_GRADES[item.level].includes(item.grade)) throw new ValidationError('Ese grado no existe en el nivel');
    }
    const existing = await db.select({ level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name })
      .from(schoolSections).where(eq(schoolSections.yearId, yearId));
    const taken = new Set(existing.map((s) => keyOf(s.level, s.grade, s.name)));
    const fresh: SectionItem[] = [];
    const skipped: SectionItem[] = [];
    for (const item of items) {
      const key = keyOf(item.level, item.grade, item.name);
      if (taken.has(key)) skipped.push(item);
      else {
        taken.add(key);
        fresh.push(item);
      }
    }
    const now = new Date();
    const ids = fresh.map(() => uuidv4());
    if (fresh.length > 0) {
      try {
        await db.insert(schoolSections).values(fresh.map((item, i) => ({
          id: ids[i], schoolId, yearId, level: item.level, grade: item.grade, name: item.name, createdAt: now, updatedAt: now,
        })));
      } catch (error) {
        // Otra persona creó una igual un instante antes: se pide volver a intentar (la lista se refresca).
        if (isDuplicateEntry(error)) throw new ConflictError('Alguna de esas secciones se acaba de crear. Revisa la lista y vuelve a intentar.');
        throw error;
      }
    }
    const created = ids.length
      ? (await selectSections().where(and(eq(schoolSections.yearId, yearId), eq(schoolSections.schoolId, schoolId)))).filter((s) => ids.includes(s.id)).map(serialize)
      : [];
    return { created, skipped };
  },

  /** Nombre, turno o tutoría. El tutor debe ser miembro verificado de la escuela. */
  async update(schoolId: string, sectionId: string, patch: { name?: string; shift?: 'MORNING' | 'AFTERNOON'; tutorUserId?: string | null }) {
    const section = await loadSection(schoolId, sectionId);
    await loadYear(schoolId, section.yearId, true);
    const values: Partial<typeof schoolSections.$inferInsert> = { updatedAt: new Date() };

    if (patch.name !== undefined && patch.name !== section.name) {
      const siblings = await db.select({ name: schoolSections.name }).from(schoolSections).where(and(
        eq(schoolSections.yearId, section.yearId), eq(schoolSections.level, section.level), eq(schoolSections.grade, section.grade), ne(schoolSections.id, section.id),
      ));
      if (siblings.some((s) => comparable(s.name) === comparable(patch.name!))) {
        throw new ConflictError(`Ya hay una sección «${sectionDisplayName(section.level, section.grade, patch.name)}»`);
      }
      values.name = patch.name;
    }
    if (patch.shift !== undefined) values.shift = patch.shift;
    if (patch.tutorUserId !== undefined) {
      if (patch.tutorUserId !== null) {
        const [member] = await db.select({ status: schoolMembers.status }).from(schoolMembers)
          .where(and(eq(schoolMembers.schoolId, schoolId), eq(schoolMembers.userId, patch.tutorUserId)));
        if (member?.status !== 'VERIFIED') throw new ValidationError('El tutor debe ser docente de la escuela');
      }
      values.tutorUserId = patch.tutorUserId;
    }

    try {
      await db.update(schoolSections).set(values).where(eq(schoolSections.id, section.id));
    } catch (error) {
      if (isDuplicateEntry(error)) throw new ConflictError(`Ya hay una sección «${sectionDisplayName(section.level, section.grade, patch.name ?? section.name)}»`);
      throw error;
    }
    const [row] = await selectSections().where(eq(schoolSections.id, section.id));
    return { section: serialize(row), before: section };
  },

  /** Quitar una sección (con estudiantes o asignaciones no se podrá, cuando existan). */
  async remove(schoolId: string, sectionId: string) {
    const section = await loadSection(schoolId, sectionId);
    await loadYear(schoolId, section.yearId, true);
    await db.delete(schoolSections).where(eq(schoolSections.id, section.id));
    return section;
  },
};
