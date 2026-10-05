import { createHash } from 'node:crypto';
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  classrooms, curriculumAreas, schoolEnrollmentEvents, schoolEnrollments, schoolRosterBuilds, schoolRosterDrafts, schoolSections, schoolStudents,
  schoolTeachingAssignments, schoolYears, studentProfiles, users,
} from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { affectedRows } from '../utils/points.js';
import { containsWords, matchWords, splitPersonName, type NameSplit } from '../utils/personNames.js';
import { cleanText, comparableText } from '../utils/textClean.js';
import { schoolAutoEnrollService } from './schoolAutoEnroll.service.js';
import { sectionDisplayName } from './schoolSection.service.js';

/**
 * «Armar desde clases»: un estudiante aparece una vez por cada clase. Se mapea cada clase a su sección, se proponen
 * las uniones de perfiles (Segura, Probable, Revisar) y, al confirmar, se crean los estudiantes del padrón y se vinculan
 * sus perfiles. Cada perfil conserva su XP, notas y asistencia; los estudiantes no ven ningún cambio.
 */

export interface MappingEntry {
  sectionId: string | null;
}
export type Mapping = Record<string, MappingEntry>;

export type Decision =
  | { kind: 'SAFE'; name?: { lastNames: string; firstNames: string } }
  | { kind: 'PROBABLE'; action: 'merge' | 'split'; name?: { lastNames: string; firstNames: string } }
  | { kind: 'REVIEW'; assignments: Record<string, number | 'new'>; names?: Record<string, { lastNames: string; firstNames: string }> };

interface Draft {
  mapping: Mapping;
  decisions: Record<string, Decision>;
}

interface ProfileView {
  id: string;
  displayName: string;
  classroomId: string;
  classroomName: string;
  teacher: string | null;
  xp: number;
}

interface Cluster {
  profiles: ProfileView[];
  words: string[];
  anchor?: { studentId: string; name: string };
}

export interface Group {
  key: string;
  kind: 'SAFE' | 'PROBABLE' | 'REVIEW';
  sectionId: string;
  sectionLabel: string;
  why: string;
  profiles: ProfileView[];
  anchor?: { studentId: string; name: string };
  name: NameSplit;
  /** PROBABLE: cada parte («Separar» deja una persona por parte; la que ya está en el padrón sigue siéndolo). */
  parts?: Array<{ profileIds: string[]; anchorStudentId?: string }>;
  /** REVIEW: las personas posibles y los perfiles por asignar. */
  people?: Array<{ anchorProfileIds: string[]; anchorStudentId?: string; name: NameSplit }>;
  loose?: string[];
}

const emptyDraft = (): Draft => ({ mapping: {}, decisions: {} });

const loadYear = async (schoolId: string, yearId: string, forWrite: boolean) => {
  const [year] = await db.select({ id: schoolYears.id, status: schoolYears.status }).from(schoolYears)
    .where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)));
  if (!year) throw new NotFoundError('Año escolar no encontrado');
  if (forWrite && year.status === 'CLOSED') throw new ConflictError('Este año escolar ya cerró: solo se puede consultar');
  return year;
};

const loadDraft = async (schoolId: string, yearId: string): Promise<Draft & { updatedAt: Date | null }> => {
  const [row] = await db.select().from(schoolRosterDrafts)
    .where(and(eq(schoolRosterDrafts.schoolId, schoolId), eq(schoolRosterDrafts.yearId, yearId)));
  if (!row) return { ...emptyDraft(), updatedAt: null };
  const data = (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) as Partial<Draft>;
  return { mapping: data.mapping ?? {}, decisions: data.decisions ?? {}, updatedAt: row.updatedAt };
};

const saveDraft = async (schoolId: string, yearId: string, actorId: string, draft: Draft) => {
  const values = { data: draft as unknown as Record<string, unknown>, updatedBy: actorId, updatedAt: new Date() };
  await db.insert(schoolRosterDrafts).values({ schoolId, yearId, ...values }).onDuplicateKeyUpdate({ set: values });
};

/** Sugerencia de sección para una clase: por su grado (o el número de su nombre) y el nombre de la sección. */
const suggestSection = (
  classroom: { name: string; gradeLevel: string | null },
  sections: Array<{ id: string; level: string; grade: number; name: string }>,
) => {
  let level: string | null = null;
  let grade: number | null = null;
  if (classroom.gradeLevel) {
    const [l, g] = classroom.gradeLevel.split('_');
    level = l;
    grade = Number(g) || null;
  }
  const text = comparableText(classroom.name);
  if (!grade) {
    const match = text.match(/(?:^|[^0-9])([1-6])\s*(?:°|º|ro|do|to|er|vo|mo|no)?(?![0-9])/);
    grade = match ? Number(match[1]) : null;
  }
  if (!level) {
    if (/\bsec/.test(text)) level = 'SECUNDARIA';
    else if (/\bprim/.test(text)) level = 'PRIMARIA';
    else if (/\binic|\banos\b/.test(text)) level = 'INICIAL';
  }
  if (!grade) return null;
  const candidates = sections.filter((s) => s.grade === grade && (!level || s.level === level));
  const words = new Set(text.split(/[^a-z0-9]+/).filter(Boolean));
  // «3C», «3roC»: la sección pegada al grado también cuenta como palabra.
  for (const word of [...words]) {
    const glued = word.match(/^[1-6](?:ro|do|to|er|vo|mo|no)?([a-z]+)$/)?.[1];
    if (glued) words.add(glued);
  }
  const named = candidates.filter((s) => comparableText(s.name).split(/\s+/).every((w) => words.has(w)));
  if (named.length === 1) return named[0].id;
  return candidates.length === 1 ? candidates[0].id : null;
};

const keyOf = (kind: string, ids: string[], anchor?: string) =>
  createHash('sha1').update(`${kind}|${[...ids].sort().join(',')}|${anchor ?? ''}`).digest('hex').slice(0, 16);

/** El nombre fuente: el del padrón si ya existe; si no, el que tiene coma o el más completo. */
const proposeName = (cluster: { profiles: ProfileView[]; anchor?: { name: string } }): NameSplit => {
  if (cluster.anchor) return splitPersonName(cluster.anchor.name);
  const sources = [...cluster.profiles].sort((a, b) =>
    Number(b.displayName.includes(',')) - Number(a.displayName.includes(','))
    || matchWords(b.displayName).length - matchWords(a.displayName).length);
  return splitPersonName(sources[0]?.displayName ?? '');
};

const classesOf = (cluster: Cluster) => new Set(cluster.profiles.map((p) => p.classroomId));
const hasInternalConflict = (cluster: Cluster) => classesOf(cluster).size < cluster.profiles.length;
const shareClass = (a: Cluster, b: Cluster) => { const ca = classesOf(a); return b.profiles.some((p) => ca.has(p.classroomId)); };

/**
 * Agrupa los perfiles de una sección. Mismo conjunto de palabras → un grupo; luego se relacionan grupos cuyo nombre
 * contiene al otro (o difiere en una letra) sin compartir una clase. Componente simple → Segura; par único → Probable;
 * lo demás (dos iguales en una clase, varios candidatos, nombres de una palabra) → Revisar.
 */
const groupSection = (sectionId: string, sectionLabel: string, profiles: ProfileView[], anchors: Array<{ studentId: string; name: string }>): Group[] => {
  const byKey = new Map<string, Cluster>();
  for (const profile of profiles) {
    const words = matchWords(profile.displayName);
    const key = [...words].sort().join(' ');
    const cluster = byKey.get(key) ?? { profiles: [], words };
    cluster.profiles.push(profile);
    byKey.set(key, cluster);
  }
  for (const anchor of anchors) {
    const words = matchWords(anchor.name);
    const key = [...words].sort().join(' ');
    const cluster = byKey.get(key);
    if (cluster && !cluster.anchor) cluster.anchor = anchor;
    else if (!cluster) byKey.set(`anchor:${anchor.studentId}`, { profiles: [], words, anchor });
  }
  const clusters = [...byKey.values()];

  // Relaciones entre grupos (contención o una letra), nunca si comparten una clase o si ambos ya están en el padrón.
  const related = clusters.map(() => new Set<number>());
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const a = clusters[i];
      const b = clusters[j];
      if ((a.anchor && b.anchor) || shareClass(a, b) || !a.words.length || !b.words.length) continue;
      const [small, big] = a.words.length <= b.words.length ? [a, b] : [b, a];
      if (containsWords(small.words, big.words, true)) {
        related[i].add(j);
        related[j].add(i);
      }
    }
  }

  const seen = new Set<number>();
  const groups: Group[] = [];
  for (let start = 0; start < clusters.length; start++) {
    if (seen.has(start)) continue;
    const component: number[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const i = stack.pop()!;
      component.push(i);
      for (const j of related[i]) if (!seen.has(j)) { seen.add(j); stack.push(j); }
    }
    const members = component.map((i) => clusters[i]);
    const allProfiles = members.flatMap((c) => c.profiles);
    if (allProfiles.length === 0) continue; // solo estudiantes del padrón, nada que vincular
    const anchor = members.find((c) => c.anchor)?.anchor;
    const display = allProfiles[0]?.displayName ?? '';
    const classCount = new Set(allProfiles.map((p) => p.classroomId)).size;

    if (members.length === 1 && !hasInternalConflict(members[0])) {
      const [only] = members;
      groups.push({
        key: keyOf('SAFE', only.profiles.map((p) => p.id), only.anchor?.studentId),
        kind: 'SAFE', sectionId, sectionLabel,
        why: only.anchor ? 'Ya está en el padrón con el mismo nombre' : only.profiles.length === 1 ? 'Está en una sola clase' : `El mismo nombre en ${only.profiles.length} clases de ${sectionLabel}`,
        profiles: only.profiles, anchor: only.anchor, name: proposeName(only),
      });
      continue;
    }

    const conflict = members.some(hasInternalConflict);
    const [first, second] = members;
    const smallWords = members.length === 2 ? Math.min(first.words.length, second.words.length) : 0;
    if (members.length === 2 && !conflict && smallWords >= 2) {
      const fuzzyOnly = first.words.length === second.words.length;
      groups.push({
        key: keyOf('PROBABLE', allProfiles.map((p) => p.id), anchor?.studentId),
        kind: 'PROBABLE', sectionId, sectionLabel,
        why: anchor ? 'Parece ser un estudiante que ya está en el padrón'
          : fuzzyOnly ? `El nombre cambia en una letra entre ${classCount} clases de ${sectionLabel}` : `El mismo nombre escrito distinto en ${classCount} clases de ${sectionLabel}`,
        profiles: allProfiles, anchor,
        name: proposeName({ profiles: allProfiles, anchor }),
        parts: members.map((c) => ({ profileIds: c.profiles.map((p) => p.id), anchorStudentId: c.anchor?.studentId })),
      });
      continue;
    }

    // Revisar: las personas posibles son los grupos «más completos» (que no están contenidos en otro); si uno tiene
    // dos perfiles en la misma clase, cada uno de esos perfiles es una persona distinta.
    const maximal = members.filter((c) => !members.some((other) => other !== c && other.words.length > c.words.length && containsWords(c.words, other.words, true)));
    const people: NonNullable<Group['people']> = [];
    const anchored = new Set<string>();
    for (const cluster of maximal) {
      const byClass = new Map<string, ProfileView[]>();
      for (const profile of cluster.profiles) byClass.set(profile.classroomId, [...(byClass.get(profile.classroomId) ?? []), profile]);
      const clash = [...byClass.values()].find((list) => list.length > 1);
      if (clash) {
        clash.forEach((profile, index) => {
          people.push({ anchorProfileIds: [profile.id], anchorStudentId: index === 0 ? cluster.anchor?.studentId : undefined, name: proposeName({ profiles: [profile] }) });
          anchored.add(profile.id);
        });
      } else {
        const ids = cluster.profiles.map((p) => p.id);
        people.push({ anchorProfileIds: ids, anchorStudentId: cluster.anchor?.studentId, name: proposeName(cluster) });
        ids.forEach((id) => anchored.add(id));
      }
    }
    const loose = allProfiles.filter((p) => !anchored.has(p.id)).map((p) => p.id);
    const twins = allProfiles.filter((p) => allProfiles.some((q) => q !== p && q.classroomId === p.classroomId && matchWords(q.displayName).join() === matchWords(p.displayName).join()));
    groups.push({
      key: keyOf('REVIEW', allProfiles.map((p) => p.id), anchor?.studentId),
      kind: 'REVIEW', sectionId, sectionLabel,
      why: conflict && twins.length > 1 ? `Hay ${twins.length} «${twins[0].displayName}» en ${twins[0].classroomName}: indica a quién corresponde cada perfil`
        : maximal.length > 1 ? `«${display}» se parece a más de una persona de ${sectionLabel}`
          : `«${display}» tiene un nombre incompleto: elige a quién corresponde`,
      profiles: allProfiles, anchor, name: people[0]?.name ?? proposeName({ profiles: allProfiles }),
      people, loose,
    });
  }
  return groups;
};

const toNames = (split: NameSplit | { lastNames: string; firstNames: string }) => {
  const last = cleanText(Array.isArray(split.lastNames) ? split.lastNames.join(' ') : split.lastNames).slice(0, 100);
  const first = cleanText(Array.isArray(split.firstNames) ? split.firstNames.join(' ') : split.firstNames).slice(0, 100);
  return first ? { firstNames: first, lastNames: last } : { firstNames: last, lastNames: '' };
};

/** Un armado se puede deshacer durante 24 horas. */
const UNDO_MS = 24 * 60 * 60 * 1000;

type BuildData = {
  createdStudentIds: string[];
  links: Array<{ profileId: string; studentId: string }>;
  sectionLinks: Array<{ classroomId: string; previous: string | null }>;
  draft: Draft;
};
const parseBuildData = (raw: unknown): BuildData => (typeof raw === 'string' ? JSON.parse(raw) : raw) as BuildData;

/**
 * Por qué ya no se puede deshacer un armado (o null si se puede): pasaron 24 horas, o alguno de sus estudiantes ya
 * tiene datos cargados (documento, fecha, correo, código) o movimientos además del alta.
 */
const undoBlocker = async (executor: Pick<typeof db, 'select' | 'selectDistinct'>, build: typeof schoolRosterBuilds.$inferSelect): Promise<string | null> => {
  if (Date.now() > new Date(build.createdAt).getTime() + UNDO_MS) return 'ya pasaron 24 horas desde el armado';
  const data = parseBuildData(build.data);
  const classIds = data.sectionLinks.map((l) => l.classroomId);
  if (classIds.length > 0) {
    const [assigned] = await executor.select({ id: schoolTeachingAssignments.id }).from(schoolTeachingAssignments)
      .where(inArray(schoolTeachingAssignments.classroomId, classIds)).limit(1);
    if (assigned) return 'algunas de sus clases ya tienen asignación: quítalas en «Docentes» antes de deshacer';
  }
  const ids = data.createdStudentIds;
  if (!ids.length) return null;
  const auto = await schoolAutoEnrollService.inspect(executor, ids, new Date(build.createdAt));
  if (auto.used > 0) return `ya hay actividad en ${auto.used} ${auto.used === 1 ? 'perfil' : 'perfiles'} que la matrícula automática creó en otras clases`;
  const withEvents = await executor.selectDistinct({ id: schoolEnrollmentEvents.studentId }).from(schoolEnrollmentEvents)
    .where(and(inArray(schoolEnrollmentEvents.studentId, ids), ne(schoolEnrollmentEvents.type, 'BUILT_FROM_CLASSES')));
  const withData = await executor.select({ id: schoolStudents.id }).from(schoolStudents).where(and(
    inArray(schoolStudents.id, ids),
    or(
      isNotNull(schoolStudents.documentIndex), isNotNull(schoolStudents.birthDate), isNotNull(schoolStudents.institutionalEmail),
      isNotNull(schoolStudents.siagieCode), ne(schoolStudents.status, 'ACTIVE'),
    ),
  ));
  const touched = new Set([...withEvents.map((r) => r.id), ...withData.map((r) => r.id)]).size;
  if (touched === 0) return null;
  return `ya cargaste datos o hiciste cambios en ${touched} ${touched === 1 ? 'estudiante' : 'estudiantes'} de ese armado`;
};

export const schoolRosterBuilderService = {
  /** Paso 1: clases de la escuela con su sugerencia de sección, las secciones del año y el borrador guardado. */
  async overview(schoolId: string, yearId: string) {
    await loadYear(schoolId, yearId, false);
    const sections = await db.select({ id: schoolSections.id, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name })
      .from(schoolSections).where(eq(schoolSections.yearId, yearId)).orderBy(asc(schoolSections.level), asc(schoolSections.grade), asc(schoolSections.name));
    const rows = await db.select({
      id: classrooms.id, name: classrooms.name, gradeLevel: classrooms.gradeLevel, schoolSectionId: classrooms.schoolSectionId,
      teacherFirstName: users.firstName, teacherLastName: users.lastName, areaName: curriculumAreas.name,
    }).from(classrooms)
      .leftJoin(users, eq(users.id, classrooms.teacherId))
      .leftJoin(curriculumAreas, eq(curriculumAreas.id, classrooms.curriculumAreaId))
      .where(and(eq(classrooms.schoolId, schoolId), eq(classrooms.isActive, true)))
      .orderBy(asc(classrooms.name));
    const ids = rows.map((r) => r.id);
    const profiles = ids.length
      ? await db.select({ classroomId: studentProfiles.classroomId, linked: studentProfiles.schoolStudentId }).from(studentProfiles)
        .where(and(inArray(studentProfiles.classroomId, ids), eq(studentProfiles.isActive, true), eq(studentProfiles.isDemo, false)))
      : [];
    const draft = await loadDraft(schoolId, yearId);
    const sectionIds = new Set(sections.map((s) => s.id));
    return {
      sections,
      classes: rows.map((r) => {
        const own = profiles.filter((p) => p.classroomId === r.id);
        return {
          id: r.id,
          name: r.name,
          teacher: r.teacherFirstName ? `${r.teacherFirstName} ${r.teacherLastName ?? ''}`.trim() : null,
          area: r.areaName,
          students: own.length,
          linked: own.filter((p) => p.linked).length,
          // La sección ya enlazada manda; si no, la sugerida.
          current: r.schoolSectionId && sectionIds.has(r.schoolSectionId) ? r.schoolSectionId : null,
          suggestion: suggestSection(r, sections),
        };
      }),
      draft: { mapping: draft.mapping, decisions: draft.decisions, updatedAt: draft.updatedAt },
    };
  },

  async saveMapping(schoolId: string, yearId: string, actorId: string, mapping: Mapping) {
    await loadYear(schoolId, yearId, true);
    const classIds = Object.keys(mapping);
    if (classIds.length) {
      const own = await db.select({ id: classrooms.id }).from(classrooms).where(and(inArray(classrooms.id, classIds), eq(classrooms.schoolId, schoolId)));
      if (own.length !== classIds.length) throw new ValidationError('Alguna de esas clases no es de la escuela');
      const sectionIds = [...new Set(Object.values(mapping).map((m) => m.sectionId).filter((id): id is string => !!id))];
      if (sectionIds.length) {
        const found = await db.select({ id: schoolSections.id }).from(schoolSections)
          .where(and(inArray(schoolSections.id, sectionIds), eq(schoolSections.yearId, yearId), eq(schoolSections.schoolId, schoolId)));
        if (found.length !== sectionIds.length) throw new ValidationError('Alguna sección no es de este año escolar');
      }
    }
    const draft = await loadDraft(schoolId, yearId);
    await saveDraft(schoolId, yearId, actorId, { mapping, decisions: draft.decisions });
  },

  async saveDecisions(schoolId: string, yearId: string, actorId: string, decisions: Record<string, Decision>) {
    await loadYear(schoolId, yearId, true);
    const draft = await loadDraft(schoolId, yearId);
    await saveDraft(schoolId, yearId, actorId, { mapping: draft.mapping, decisions });
  },

  /** Paso 2: las uniones propuestas para el mapeo guardado (perfiles aún sin estudiante del padrón). */
  async proposal(schoolId: string, yearId: string) {
    await loadYear(schoolId, yearId, false);
    const draft = await loadDraft(schoolId, yearId);
    const mapped = Object.entries(draft.mapping).filter(([, entry]) => !!entry.sectionId) as Array<[string, { sectionId: string }]>;
    if (!mapped.length) return { groups: [] as Group[], counts: { safe: 0, probable: 0, review: 0, profiles: 0, skipped: 0 }, decisions: draft.decisions };
    const classIds = mapped.map(([id]) => id);
    const sectionOf = new Map(mapped.map(([id, entry]) => [id, entry.sectionId]));
    const sections = await db.select({ id: schoolSections.id, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name })
      .from(schoolSections).where(and(eq(schoolSections.yearId, yearId), eq(schoolSections.schoolId, schoolId)));
    const label = new Map(sections.map((s) => [s.id, sectionDisplayName(s.level, s.grade, s.name)]));

    const rows = await db.select({
      id: studentProfiles.id, displayName: studentProfiles.displayName, characterName: studentProfiles.characterName, xp: studentProfiles.xp,
      classroomId: classrooms.id, classroomName: classrooms.name, teacherFirstName: users.firstName, teacherLastName: users.lastName,
    }).from(studentProfiles)
      .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
      .leftJoin(users, eq(users.id, classrooms.teacherId))
      .where(and(
        inArray(studentProfiles.classroomId, classIds), eq(classrooms.schoolId, schoolId),
        eq(studentProfiles.isActive, true), eq(studentProfiles.isDemo, false), isNull(studentProfiles.schoolStudentId),
      ));
    const anchorRows = await db.select({ studentId: schoolStudents.id, sectionId: schoolEnrollments.sectionId, firstNames: schoolStudents.firstNames, lastNames: schoolStudents.lastNames })
      .from(schoolEnrollments).innerJoin(schoolStudents, eq(schoolStudents.id, schoolEnrollments.studentId))
      .where(and(eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.schoolId, schoolId), eq(schoolStudents.status, 'ACTIVE')));

    let skipped = 0;
    const bySection = new Map<string, ProfileView[]>();
    for (const row of rows) {
      const name = cleanText(row.displayName || row.characterName || '');
      if (!matchWords(name).length) { skipped++; continue; }
      const sectionId = sectionOf.get(row.classroomId)!;
      const view: ProfileView = {
        id: row.id, displayName: name, classroomId: row.classroomId, classroomName: row.classroomName, xp: row.xp,
        teacher: row.teacherFirstName ? `${row.teacherFirstName} ${row.teacherLastName ?? ''}`.trim() : null,
      };
      bySection.set(sectionId, [...(bySection.get(sectionId) ?? []), view]);
    }
    const groups = [...bySection.entries()].flatMap(([sectionId, profiles]) =>
      groupSection(sectionId, label.get(sectionId) ?? 'la sección', profiles,
        anchorRows.filter((a) => a.sectionId === sectionId).map((a) => ({ studentId: a.studentId, name: `${a.lastNames}, ${a.firstNames}` }))));
    const order = { REVIEW: 0, PROBABLE: 1, SAFE: 2 } as const;
    groups.sort((a, b) => order[a.kind] - order[b.kind] || a.sectionLabel.localeCompare(b.sectionLabel, 'es', { numeric: true }));
    return {
      groups,
      counts: {
        safe: groups.filter((g) => g.kind === 'SAFE').length,
        probable: groups.filter((g) => g.kind === 'PROBABLE').length,
        review: groups.filter((g) => g.kind === 'REVIEW').length,
        profiles: rows.length - skipped,
        skipped,
      },
      decisions: draft.decisions,
    };
  },

  /**
   * Paso 3: crea los estudiantes y sus matrículas, vincula los perfiles y enlaza cada clase con su sección. Las uniones
   * Seguras y Probables sin decidir se aplican como se propusieron; las de Revisar tienen que estar decididas.
   */
  async confirm(schoolId: string, yearId: string, actorId: string) {
    await loadYear(schoolId, yearId, true);
    const { groups } = await this.proposal(schoolId, yearId);
    const draft = await loadDraft(schoolId, yearId);
    if (!Object.keys(draft.mapping).length) throw new ConflictError('Primero mapea las clases a sus secciones');

    type Person = { profileIds: string[]; anchorStudentId?: string; names: { firstNames: string; lastNames: string }; sectionId: string };
    const persons: Person[] = [];
    const byId = new Map(groups.flatMap((g) => g.profiles).map((p) => [p.id, p]));
    for (const group of groups) {
      const decision = draft.decisions[group.key];
      if (group.kind === 'SAFE') {
        const name = decision?.kind === 'SAFE' && decision.name ? decision.name : group.name;
        persons.push({ profileIds: group.profiles.map((p) => p.id), anchorStudentId: group.anchor?.studentId, names: toNames(name), sectionId: group.sectionId });
      } else if (group.kind === 'PROBABLE') {
        if (decision?.kind === 'PROBABLE' && decision.action === 'split') {
          for (const part of group.parts ?? []) {
            if (!part.profileIds.length) continue; // el estudiante del padrón sin perfiles nuevos no cambia
            persons.push({
              profileIds: part.profileIds,
              anchorStudentId: part.anchorStudentId,
              names: toNames(splitPersonName(byId.get(part.profileIds[0])!.displayName)),
              sectionId: group.sectionId,
            });
          }
        } else {
          const name = decision?.kind === 'PROBABLE' && decision.name ? decision.name : group.name;
          persons.push({ profileIds: group.profiles.map((p) => p.id), anchorStudentId: group.anchor?.studentId, names: toNames(name), sectionId: group.sectionId });
        }
      } else {
        if (decision?.kind !== 'REVIEW') throw new ConflictError('Faltan uniones por revisar: decide todas las marcadas «Revisar»');
        const people = group.people ?? [];
        const extra: string[][] = people.map(() => []);
        for (const id of group.loose ?? []) {
          const choice = decision.assignments[id];
          if (choice === 'new') persons.push({ profileIds: [id], names: toNames(splitPersonName(byId.get(id)!.displayName)), sectionId: group.sectionId });
          else if (typeof choice === 'number' && choice >= 0 && choice < people.length) extra[choice].push(id);
          else throw new ConflictError('Faltan uniones por revisar: asigna cada perfil a una persona');
        }
        people.forEach((person, index) => {
          const name = decision.names?.[String(index)] ?? person.name;
          persons.push({ profileIds: [...person.anchorProfileIds, ...extra[index]], anchorStudentId: person.anchorStudentId, names: toNames(name), sectionId: group.sectionId });
        });
      }
    }

    const now = new Date();
    let created = 0;
    const createdStudentIds: string[] = [];
    const links: Array<{ profileId: string; studentId: string }> = [];
    const buildId = uuidv4();
    await db.transaction(async (tx) => {
      // Una sola confirmación a la vez: el borrador queda bloqueado y, si otra sesión ya confirmó, ya no existe.
      const [lock] = await tx.select({ schoolId: schoolRosterDrafts.schoolId }).from(schoolRosterDrafts)
        .where(and(eq(schoolRosterDrafts.schoolId, schoolId), eq(schoolRosterDrafts.yearId, yearId))).for('update');
      if (!lock) throw new ConflictError('El padrón ya se armó desde otra sesión: recarga la página');
      for (const person of persons) {
        // Solo perfiles aún sin estudiante (bloqueados): si otra persona los vinculó entretanto, no se pisan.
        const free = (await tx.select({ id: studentProfiles.id }).from(studentProfiles)
          .where(and(inArray(studentProfiles.id, person.profileIds), isNull(studentProfiles.schoolStudentId))).for('update'))
          .map((p) => p.id);
        if (!free.length) continue; // nada que vincular: no se crea un estudiante vacío
        let studentId = person.anchorStudentId;
        if (!studentId) {
          studentId = uuidv4();
          await tx.insert(schoolStudents).values({ id: studentId, schoolId, ...person.names, createdBy: actorId, createdAt: now, updatedAt: now });
          await tx.insert(schoolEnrollments).values({ id: uuidv4(), schoolId, yearId, studentId, sectionId: person.sectionId, createdAt: now, updatedAt: now });
          await tx.insert(schoolEnrollmentEvents).values({
            id: uuidv4(), schoolId, studentId, yearId, type: 'BUILT_FROM_CLASSES', toSectionId: person.sectionId,
            metadata: { profiles: free.length }, actorUserId: actorId, createdAt: now,
          });
          createdStudentIds.push(studentId);
          created++;
        }
        await tx.update(studentProfiles).set({ schoolStudentId: studentId, updatedAt: now }).where(inArray(studentProfiles.id, free));
        for (const profileId of free) links.push({ profileId, studentId });
      }
      // Cada clase queda enlazada a su sección (o sin sección si no es de una); se guarda la anterior para deshacer.
      const classIds = Object.keys(draft.mapping);
      const before = classIds.length
        ? await tx.select({ id: classrooms.id, previous: classrooms.schoolSectionId }).from(classrooms)
          .where(and(inArray(classrooms.id, classIds), eq(classrooms.schoolId, schoolId)))
        : [];
      const sectionLinks: Array<{ classroomId: string; previous: string | null }> = [];
      for (const row of before) {
        const next = draft.mapping[row.id]?.sectionId ?? null;
        if (row.previous === next) continue;
        await tx.update(classrooms).set({ schoolSectionId: next, updatedAt: now }).where(eq(classrooms.id, row.id));
        sectionLinks.push({ classroomId: row.id, previous: row.previous });
      }
      if (sectionLinks.length > 0) {
        // Una clase que cambia de sección deja la asignación que tenía (la matriz la mostrará sin clase).
        await tx.update(schoolTeachingAssignments).set({ classroomId: null, updatedAt: now })
          .where(inArray(schoolTeachingAssignments.classroomId, sectionLinks.map((l) => l.classroomId)));
      }
      await tx.insert(schoolRosterBuilds).values({
        id: buildId, schoolId, yearId, actorUserId: actorId, createdCount: created, linkedCount: links.length,
        data: { createdStudentIds, links, sectionLinks, draft: { mapping: draft.mapping, decisions: draft.decisions } },
        createdAt: now,
      });
      await tx.delete(schoolRosterDrafts).where(and(eq(schoolRosterDrafts.schoolId, schoolId), eq(schoolRosterDrafts.yearId, yearId)));
    });
    // Matrícula automática: los estudiantes nuevos entran también a las demás clases vinculadas de su sección.
    const auto = await schoolAutoEnrollService.syncStudents(schoolId, yearId, createdStudentIds);
    return { buildId, created, linked: links.length, persons: persons.length, autoEnrolled: auto.created + auto.linked };
  },

  /** El último armado del año que sigue en pie y si todavía se puede deshacer. */
  async lastBuild(schoolId: string, yearId: string) {
    await loadYear(schoolId, yearId, false);
    const [build] = await db.select().from(schoolRosterBuilds)
      .where(and(eq(schoolRosterBuilds.schoolId, schoolId), eq(schoolRosterBuilds.yearId, yearId), isNull(schoolRosterBuilds.undoneAt)))
      .orderBy(desc(schoolRosterBuilds.createdAt))
      .limit(1);
    if (!build) return null;
    const blockedReason = await undoBlocker(db, build);
    return {
      id: build.id,
      createdAt: build.createdAt,
      created: build.createdCount,
      linked: build.linkedCount,
      undoableUntil: new Date(new Date(build.createdAt).getTime() + UNDO_MS),
      canUndo: !blockedReason,
      blockedReason,
    };
  },

  /**
   * Deshace el último armado (dentro de 24 h y sin estudiantes tocados): desvincula sus perfiles, borra los estudiantes
   * que creó, devuelve cada clase a su sección anterior y restaura el borrador para corregir y confirmar otra vez.
   */
  async undo(schoolId: string, yearId: string, buildId: string) {
    await loadYear(schoolId, yearId, true);
    const now = new Date();
    return db.transaction(async (tx) => {
      const [build] = await tx.select().from(schoolRosterBuilds)
        .where(and(eq(schoolRosterBuilds.id, buildId), eq(schoolRosterBuilds.schoolId, schoolId), eq(schoolRosterBuilds.yearId, yearId)))
        .for('update');
      if (!build || build.undoneAt) throw new NotFoundError('Ese armado ya no se puede deshacer');
      const [newer] = await tx.select({ id: schoolRosterBuilds.id }).from(schoolRosterBuilds)
        .where(and(
          eq(schoolRosterBuilds.schoolId, schoolId), eq(schoolRosterBuilds.yearId, yearId), isNull(schoolRosterBuilds.undoneAt),
          ne(schoolRosterBuilds.id, build.id), gt(schoolRosterBuilds.createdAt, build.createdAt),
        )).limit(1);
      if (newer) throw new ConflictError('Solo se puede deshacer el último armado');
      const blockedReason = await undoBlocker(tx, build);
      if (blockedReason) throw new ConflictError(`No se puede deshacer: ${blockedReason}`);

      const data = parseBuildData(build.data);
      // Perfiles: solo los que siguen vinculados como los dejó el armado.
      const byStudent = new Map<string, string[]>();
      for (const link of data.links) byStudent.set(link.studentId, [...(byStudent.get(link.studentId) ?? []), link.profileId]);
      let unlinked = 0;
      for (const [studentId, profileIds] of byStudent) {
        const result = await tx.update(studentProfiles).set({ schoolStudentId: null, updatedAt: now })
          .where(and(inArray(studentProfiles.id, profileIds), eq(studentProfiles.schoolStudentId, studentId)));
        unlinked += affectedRows(result);
      }
      const ids = data.createdStudentIds;
      // Los perfiles que la matrícula automática creó o ligó en otras clases para estos estudiantes (sin usar).
      await schoolAutoEnrollService.revert(tx, await schoolAutoEnrollService.inspect(tx, ids, new Date(build.createdAt)));
      if (ids.length) {
        await tx.delete(schoolEnrollmentEvents).where(and(inArray(schoolEnrollmentEvents.studentId, ids), eq(schoolEnrollmentEvents.schoolId, schoolId)));
        await tx.delete(schoolEnrollments).where(and(inArray(schoolEnrollments.studentId, ids), eq(schoolEnrollments.schoolId, schoolId)));
        await tx.delete(schoolStudents).where(and(inArray(schoolStudents.id, ids), eq(schoolStudents.schoolId, schoolId)));
      }
      for (const link of data.sectionLinks) {
        await tx.update(classrooms).set({ schoolSectionId: link.previous, updatedAt: now })
          .where(and(eq(classrooms.id, link.classroomId), eq(classrooms.schoolId, schoolId)));
      }
      await tx.update(schoolRosterBuilds).set({ undoneAt: now }).where(eq(schoolRosterBuilds.id, build.id));
      const draft = { data: data.draft as unknown as Record<string, unknown>, updatedBy: build.actorUserId, updatedAt: now };
      await tx.insert(schoolRosterDrafts).values({ schoolId, yearId, ...draft }).onDuplicateKeyUpdate({ set: draft });
      return { removed: ids.length, unlinked };
    });
  },
};

