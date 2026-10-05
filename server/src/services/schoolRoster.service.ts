import { and, asc, count, desc, eq, inArray, isNull, like, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  classrooms, schoolEnrollmentEvents, schoolEnrollments, schoolSections, schoolStudents, schoolYears, studentProfiles, users,
} from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError, isDuplicateEntry } from '../utils/errors.js';
import { decryptPii, encryptPii, piiReady } from '../utils/piiCrypto.js';
import { documentIndex, normalizeDocument, parseDocument, type DocumentType } from '../utils/personalDocument.js';
import { escapeLike } from '../utils/textClean.js';
import { accessOf, accessStates } from './schoolAccessState.js';
import { schoolAutoEnrollService } from './schoolAutoEnroll.service.js';
import { sectionDisplayName } from './schoolSection.service.js';

/**
 * Padrón de la escuela: un estudiante único (con sus perfiles en cada clase) y su matrícula del año. El documento se
 * guarda cifrado y nunca sale en claro, salvo «Mostrar» (administración, con motivo y registro).
 */

export type RosterFilter = 'all' | 'no_section' | 'incomplete' | 'withdrawn';
export const ROSTER_PAGE_SIZE = 50;

export interface StudentInput {
  firstNames: string;
  lastNames: string;
  document?: { type: DocumentType; number: string } | null;
  birthDate?: string | null;
  email?: string | null;
  siagieCode?: string | null;
}

const documentContext = (studentId: string) => `school_student:${studentId}:document`;
const tutors = alias(users, 'tutor');
const actors = alias(users, 'actor');
const teachers = alias(users, 'teacher');

/** El año de la escuela; para escribir, que no esté cerrado. */
export const loadYear = async (schoolId: string, yearId: string, forWrite: boolean) => {
  const [year] = await db.select({ id: schoolYears.id, status: schoolYears.status }).from(schoolYears)
    .where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)));
  if (!year) throw new NotFoundError('Año escolar no encontrado');
  if (forWrite && year.status === 'CLOSED') throw new ConflictError('Este año escolar ya cerró: solo se puede consultar');
  return year;
};

const loadStudent = async (schoolId: string, studentId: string) => {
  const [student] = await db.select().from(schoolStudents)
    .where(and(eq(schoolStudents.id, studentId), eq(schoolStudents.schoolId, schoolId)));
  if (!student) throw new NotFoundError('Estudiante no encontrado');
  return student;
};

const assertSection = async (schoolId: string, yearId: string, sectionId: string) => {
  const [section] = await db.select({ id: schoolSections.id }).from(schoolSections)
    .where(and(eq(schoolSections.id, sectionId), eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId)));
  if (!section) throw new ValidationError('Esa sección no es de este año escolar');
};

/** Valida, normaliza y cifra el documento (atado al estudiante). Sin llaves en el servidor, no se guarda. */
export const prepareDocument = (schoolId: string, studentId: string, document: { type: DocumentType; number: string }) => {
  if (!piiReady()) throw new ConflictError('El servidor aún no tiene las llaves para guardar documentos. Avísale al equipo de Juried.');
  const normalized = parseDocument(document.type, document.number);
  if (!normalized) throw new ValidationError(document.type === 'DNI' ? 'El DNI tiene 8 números' : 'Revisa el número del documento');
  return {
    documentType: document.type,
    documentEncrypted: encryptPii(normalized, documentContext(studentId)),
    documentIndex: documentIndex(schoolId, normalized),
    documentHint: normalized.slice(-3),
  };
};

/** Si el documento ya es de otro estudiante de la escuela, avisa de quién (la administración ve todo el padrón). */
const assertDocumentFree = async (schoolId: string, index: string, exceptId?: string) => {
  const [owner] = await db.select({ id: schoolStudents.id, firstNames: schoolStudents.firstNames, lastNames: schoolStudents.lastNames })
    .from(schoolStudents).where(and(eq(schoolStudents.schoolId, schoolId), eq(schoolStudents.documentIndex, index)));
  if (owner && owner.id !== exceptId) throw new ConflictError(`Ese documento ya es de ${owner.lastNames}, ${owner.firstNames}`);
};

const serializeStudent = (s: typeof schoolStudents.$inferSelect) => ({
  id: s.id,
  firstNames: s.firstNames,
  lastNames: s.lastNames,
  documentType: s.documentType,
  documentHint: s.documentHint,
  hasDocument: !!s.documentIndex,
  birthDate: s.birthDate,
  email: s.institutionalEmail,
  siagieCode: s.siagieCode,
  status: s.status,
  hasAccount: !!s.userId,
});

export const insertEvent = (executor: Pick<typeof db, 'insert'>, event: Omit<typeof schoolEnrollmentEvents.$inferInsert, 'id' | 'createdAt'>) =>
  executor.insert(schoolEnrollmentEvents).values({ id: uuidv4(), createdAt: new Date(), ...event });

export const schoolRosterService = {
  async list(schoolId: string, yearId: string, params: {
    filter: RosterFilter; level?: string; grade?: number; sectionId?: string; q?: string; page: number;
  }) {
    await loadYear(schoolId, yearId, false);
    const joinEnrollment = and(eq(schoolEnrollments.studentId, schoolStudents.id), eq(schoolEnrollments.yearId, yearId));
    const active = eq(schoolStudents.status, 'ACTIVE');
    const byFilter: Record<RosterFilter, SQL | undefined> = {
      all: active,
      no_section: and(active, isNull(schoolEnrollments.sectionId)),
      incomplete: and(active, or(isNull(schoolStudents.documentIndex), isNull(schoolStudents.birthDate))),
      withdrawn: eq(schoolStudents.status, 'WITHDRAWN'),
    };
    const conditions: (SQL | undefined)[] = [eq(schoolStudents.schoolId, schoolId), byFilter[params.filter]];
    if (params.level) conditions.push(eq(schoolSections.level, params.level as 'INICIAL' | 'PRIMARIA' | 'SECUNDARIA'));
    if (params.grade) conditions.push(eq(schoolSections.grade, params.grade));
    if (params.sectionId) conditions.push(eq(schoolEnrollments.sectionId, params.sectionId));
    const q = params.q?.trim();
    if (q) {
      const pattern = `%${escapeLike(q)}%`;
      const byName = or(
        like(schoolStudents.lastNames, pattern),
        like(schoolStudents.firstNames, pattern),
        like(sql`CONCAT(${schoolStudents.firstNames}, ' ', ${schoolStudents.lastNames})`, pattern),
        like(sql`CONCAT(${schoolStudents.lastNames}, ' ', ${schoolStudents.firstNames})`, pattern),
      );
      // Un documento completo se busca por su índice ciego: nunca se compara en claro.
      const doc = normalizeDocument(q);
      const looksLikeDocument = /^[A-Z0-9]{6,12}$/.test(doc) && /\d/.test(doc);
      conditions.push(looksLikeDocument && piiReady() ? or(eq(schoolStudents.documentIndex, documentIndex(schoolId, doc)), byName) : byName);
    }
    const where = and(...conditions);
    const from = () => db.select({
      id: schoolStudents.id,
      firstNames: schoolStudents.firstNames,
      lastNames: schoolStudents.lastNames,
      documentType: schoolStudents.documentType,
      documentHint: schoolStudents.documentHint,
      documentIndex: schoolStudents.documentIndex,
      birthDate: schoolStudents.birthDate,
      email: schoolStudents.institutionalEmail,
      status: schoolStudents.status,
      sectionId: schoolEnrollments.sectionId,
      sectionLevel: schoolSections.level,
      sectionGrade: schoolSections.grade,
      sectionName: schoolSections.name,
    }).from(schoolStudents)
      .leftJoin(schoolEnrollments, joinEnrollment)
      .leftJoin(schoolSections, eq(schoolSections.id, schoolEnrollments.sectionId));

    const [{ total }] = await db.select({ total: count() }).from(schoolStudents)
      .leftJoin(schoolEnrollments, joinEnrollment)
      .leftJoin(schoolSections, eq(schoolSections.id, schoolEnrollments.sectionId))
      .where(where);
    const rows = await from().where(where)
      .orderBy(asc(schoolStudents.lastNames), asc(schoolStudents.firstNames), asc(schoolStudents.id))
      .limit(ROSTER_PAGE_SIZE)
      .offset((params.page - 1) * ROSTER_PAGE_SIZE);

    const ids = rows.map((r) => r.id);
    const classCounts = ids.length
      ? await db.select({ studentId: studentProfiles.schoolStudentId, n: count() }).from(studentProfiles)
        .where(and(inArray(studentProfiles.schoolStudentId, ids), eq(studentProfiles.isActive, true)))
        .groupBy(studentProfiles.schoolStudentId)
      : [];
    const classesOf = new Map(classCounts.map((c) => [c.studentId, Number(c.n)]));

    // Los números de los chips: de toda la escuela en el año (sin los filtros de nivel o búsqueda).
    const countFor = async (condition: SQL | undefined) => {
      const [row] = await db.select({ n: count() }).from(schoolStudents).leftJoin(schoolEnrollments, joinEnrollment)
        .where(and(eq(schoolStudents.schoolId, schoolId), condition));
      return Number(row.n);
    };
    const counts = {
      all: await countFor(byFilter.all),
      no_section: await countFor(byFilter.no_section),
      incomplete: await countFor(byFilter.incomplete),
      withdrawn: await countFor(byFilter.withdrawn),
    };

    return {
      items: rows.map((r) => ({
        id: r.id,
        firstNames: r.firstNames,
        lastNames: r.lastNames,
        documentType: r.documentType,
        documentHint: r.documentHint,
        hasDocument: !!r.documentIndex,
        birthDate: r.birthDate,
        email: r.email,
        status: r.status,
        section: r.sectionId && r.sectionLevel
          ? { id: r.sectionId, level: r.sectionLevel, grade: r.sectionGrade!, name: r.sectionName! }
          : null,
        classes: classesOf.get(r.id) ?? 0,
      })),
      total: Number(total),
      page: params.page,
      pageSize: ROSTER_PAGE_SIZE,
      counts,
      piiReady: piiReady(),
    };
  },

  /** La ficha: identidad (documento enmascarado), matrícula del año, historial, clases y años. */
  async get(schoolId: string, yearId: string, studentId: string) {
    await loadYear(schoolId, yearId, false);
    const student = await loadStudent(schoolId, studentId);
    const [enrollment] = await db.select({
      id: schoolEnrollments.id,
      status: schoolEnrollments.status,
      sectionId: schoolEnrollments.sectionId,
      level: schoolSections.level,
      grade: schoolSections.grade,
      name: schoolSections.name,
      tutorFirstName: tutors.firstName,
      tutorLastName: tutors.lastName,
    }).from(schoolEnrollments)
      .leftJoin(schoolSections, eq(schoolSections.id, schoolEnrollments.sectionId))
      .leftJoin(tutors, eq(tutors.id, schoolSections.tutorUserId))
      .where(and(eq(schoolEnrollments.studentId, studentId), eq(schoolEnrollments.yearId, yearId)));

    const events = await db.select({
      id: schoolEnrollmentEvents.id,
      type: schoolEnrollmentEvents.type,
      fromSectionId: schoolEnrollmentEvents.fromSectionId,
      toSectionId: schoolEnrollmentEvents.toSectionId,
      metadata: schoolEnrollmentEvents.metadata,
      createdAt: schoolEnrollmentEvents.createdAt,
      actorFirstName: actors.firstName,
      actorLastName: actors.lastName,
    }).from(schoolEnrollmentEvents)
      .leftJoin(actors, eq(actors.id, schoolEnrollmentEvents.actorUserId))
      .where(and(eq(schoolEnrollmentEvents.studentId, studentId), eq(schoolEnrollmentEvents.schoolId, schoolId)))
      .orderBy(desc(schoolEnrollmentEvents.createdAt))
      .limit(50);
    const sectionIds = [...new Set(events.flatMap((e) => [e.fromSectionId, e.toSectionId]).filter((id): id is string => !!id))];
    const sectionRows = sectionIds.length
      ? await db.select({ id: schoolSections.id, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name })
        .from(schoolSections).where(inArray(schoolSections.id, sectionIds))
      : [];
    const sectionLabel = new Map(sectionRows.map((s) => [s.id, sectionDisplayName(s.level, s.grade, s.name)]));

    const classes = await db.select({
      profileId: studentProfiles.id,
      classroomId: classrooms.id,
      classroomName: classrooms.name,
      isActive: studentProfiles.isActive,
      xp: studentProfiles.xp,
      level: studentProfiles.level,
      teacherFirstName: teachers.firstName,
      teacherLastName: teachers.lastName,
    }).from(studentProfiles)
      .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
      .leftJoin(teachers, eq(teachers.id, classrooms.teacherId))
      .where(and(eq(studentProfiles.schoolStudentId, studentId), eq(classrooms.schoolId, schoolId)))
      .orderBy(asc(classrooms.name));

    const access = (await accessStates([studentId])).get(studentId);
    const years = await db.select({ yearId: schoolYears.id, name: schoolYears.name, status: schoolEnrollments.status, sectionId: schoolEnrollments.sectionId })
      .from(schoolEnrollments).innerJoin(schoolYears, eq(schoolYears.id, schoolEnrollments.yearId))
      .where(eq(schoolEnrollments.studentId, studentId))
      .orderBy(desc(schoolYears.name));

    return {
      student: serializeStudent(student),
      enrollment: enrollment
        ? {
          status: enrollment.status,
          section: enrollment.sectionId && enrollment.level
            ? { id: enrollment.sectionId, level: enrollment.level, grade: enrollment.grade!, name: enrollment.name! }
            : null,
          tutor: enrollment.tutorFirstName ? `${enrollment.tutorFirstName} ${enrollment.tutorLastName ?? ''}`.trim() : null,
        }
        : null,
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        from: e.fromSectionId ? sectionLabel.get(e.fromSectionId) ?? null : null,
        to: e.toSectionId ? sectionLabel.get(e.toSectionId) ?? null : null,
        metadata: typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata,
        createdAt: e.createdAt,
        actor: e.actorFirstName ? `${e.actorFirstName} ${e.actorLastName ?? ''}`.trim() : null,
      })),
      classes: classes.map((c) => ({
        profileId: c.profileId,
        classroomId: c.classroomId,
        classroomName: c.classroomName,
        isActive: c.isActive,
        xp: c.xp,
        level: c.level,
        teacher: c.teacherFirstName ? `${c.teacherFirstName} ${c.teacherLastName ?? ''}`.trim() : null,
      })),
      years: years.map((y) => ({ yearId: y.yearId, name: y.name, status: y.status, hasSection: !!y.sectionId })),
      access: accessOf(access),
    };
  },

  /** Alta manual: el estudiante y su matrícula del año (con o sin sección). */
  async create(schoolId: string, yearId: string, actorId: string, input: StudentInput & { sectionId?: string | null }) {
    await loadYear(schoolId, yearId, true);
    if (input.sectionId) await assertSection(schoolId, yearId, input.sectionId);
    const id = uuidv4();
    const document = input.document ? prepareDocument(schoolId, id, input.document) : null;
    if (document) await assertDocumentFree(schoolId, document.documentIndex);
    const now = new Date();
    try {
      await db.transaction(async (tx) => {
        await tx.insert(schoolStudents).values({
          id, schoolId, firstNames: input.firstNames, lastNames: input.lastNames,
          ...(document ?? {}),
          birthDate: input.birthDate ?? null,
          institutionalEmail: input.email ?? null,
          siagieCode: input.siagieCode ?? null,
          createdBy: actorId, createdAt: now, updatedAt: now,
        });
        await tx.insert(schoolEnrollments).values({
          id: uuidv4(), schoolId, yearId, studentId: id, sectionId: input.sectionId ?? null, createdAt: now, updatedAt: now,
        });
        await insertEvent(tx, { schoolId, studentId: id, yearId, type: 'ENROLLED', toSectionId: input.sectionId ?? null, actorUserId: actorId, metadata: { manual: true } });
      });
    } catch (error) {
      if (isDuplicateEntry(error)) throw new ConflictError('Ese documento ya está registrado en la escuela');
      throw error;
    }
    // Matrícula automática: entra a las clases vinculadas de su sección.
    if (input.sectionId) await schoolAutoEnrollService.syncStudents(schoolId, yearId, [id]);
    return this.get(schoolId, yearId, id);
  },

  /**
   * Datos del estudiante. La sección solo se asigna a quien aún no tiene (cambiarla es un traslado, con su impacto).
   * Devuelve la ficha y los campos que cambiaron.
   */
  async update(schoolId: string, yearId: string, studentId: string, actorId: string, patch: Partial<StudentInput> & { sectionId?: string | null }) {
    await loadYear(schoolId, yearId, true);
    const student = await loadStudent(schoolId, studentId);
    const values: Partial<typeof schoolStudents.$inferInsert> = { updatedAt: new Date() };
    const changed: string[] = [];
    if (patch.firstNames !== undefined && patch.firstNames !== student.firstNames) { values.firstNames = patch.firstNames; changed.push('firstNames'); }
    if (patch.lastNames !== undefined && patch.lastNames !== student.lastNames) { values.lastNames = patch.lastNames; changed.push('lastNames'); }
    if (patch.document !== undefined) {
      if (patch.document === null) {
        if (student.documentIndex) {
          Object.assign(values, { documentType: null, documentEncrypted: null, documentIndex: null, documentHint: null });
          changed.push('document');
        }
      } else {
        const document = prepareDocument(schoolId, studentId, patch.document);
        if (document.documentIndex !== student.documentIndex || document.documentType !== student.documentType) {
          await assertDocumentFree(schoolId, document.documentIndex, studentId);
          Object.assign(values, document);
          changed.push('document');
        }
      }
    }
    if (patch.birthDate !== undefined && patch.birthDate !== student.birthDate) { values.birthDate = patch.birthDate; changed.push('birthDate'); }
    if (patch.email !== undefined && patch.email !== student.institutionalEmail) { values.institutionalEmail = patch.email; changed.push('email'); }
    if (patch.siagieCode !== undefined && patch.siagieCode !== student.siagieCode) { values.siagieCode = patch.siagieCode; changed.push('siagieCode'); }

    const [enrollment] = await db.select().from(schoolEnrollments)
      .where(and(eq(schoolEnrollments.studentId, studentId), eq(schoolEnrollments.yearId, yearId)));
    let assignSection: string | null = null;
    if (patch.sectionId !== undefined && patch.sectionId !== (enrollment?.sectionId ?? null)) {
      if (enrollment?.sectionId) throw new ConflictError('Para cambiarlo de sección usa «Trasladar»: así se mueven también sus clases');
      if (patch.sectionId) {
        await assertSection(schoolId, yearId, patch.sectionId);
        assignSection = patch.sectionId;
      }
    }

    try {
      await db.transaction(async (tx) => {
        if (changed.length > 0) {
          await tx.update(schoolStudents).set(values).where(eq(schoolStudents.id, studentId));
          await insertEvent(tx, { schoolId, studentId, yearId, type: 'DATA_UPDATED', actorUserId: actorId, metadata: { fields: changed.join(',') } });
        }
        if (assignSection) {
          const now = new Date();
          if (enrollment) await tx.update(schoolEnrollments).set({ sectionId: assignSection, updatedAt: now }).where(eq(schoolEnrollments.id, enrollment.id));
          else await tx.insert(schoolEnrollments).values({ id: uuidv4(), schoolId, yearId, studentId, sectionId: assignSection, createdAt: now, updatedAt: now });
          await insertEvent(tx, { schoolId, studentId, yearId, type: 'SECTION_CHANGED', toSectionId: assignSection, actorUserId: actorId, metadata: { assigned: true } });
        }
      });
    } catch (error) {
      if (isDuplicateEntry(error)) throw new ConflictError('Ese documento ya está registrado en la escuela');
      throw error;
    }
    if (assignSection) await schoolAutoEnrollService.syncStudents(schoolId, yearId, [studentId]);
    return { detail: await this.get(schoolId, yearId, studentId), changed: [...changed, ...(assignSection ? ['section'] : [])] };
  },

  /** «Mostrar» el documento (solo administración; el controlador exige el motivo y lo registra). */
  async revealDocument(schoolId: string, studentId: string) {
    const student = await loadStudent(schoolId, studentId);
    if (!student.documentEncrypted || !student.documentType) throw new NotFoundError('Este estudiante no tiene documento registrado');
    if (!piiReady()) throw new ConflictError('El servidor aún no tiene las llaves para leer documentos. Avísale al equipo de Juried.');
    return { type: student.documentType, document: decryptPii(student.documentEncrypted, documentContext(student.id)) };
  },
};
