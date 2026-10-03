import type { Request, Response } from 'express';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  classrooms,
  studentProfiles,
  schoolMembers,
  parentStudentLinks,
  parentProfiles,
  classroomMessages,
  classroomAvatarItems,
  badges,
  collectibleAlbums,
  collectibleCards,
  behaviors,
  classroomCharacterClasses,
  itemUsages,
  questionBanks,
} from '../db/schema.js';

/**
 * Módulo central de control de acceso (ownership) para Juried V2.
 *
 * Unifica las comprobaciones que antes vivían duplicadas en cada controlador
 * (múltiples copias de `ensureTeacherClassroomAccess`). Reglas:
 *  - La identidad SIEMPRE sale de `req.user`; nunca de params/body.
 *  - ADMIN puede acceder a cualquier recurso (passthrough explícito).
 *  - Las funciones `require*` emiten la respuesta HTTP de error y devuelven
 *    `false`; el controlador debe hacer `if (!(await requireX(...))) return;`.
 *  - Las funciones `*Owns*` son consultas puras (sin efectos HTTP) reutilizables
 *    dentro de servicios o guards de socket.
 *
 * Contrato de error: `{ success: false, message }` (ver AGENTS.md).
 */

// ─────────────────────────────────────────────────────────────
// Consultas puras de ownership (sin efectos HTTP)
// ─────────────────────────────────────────────────────────────

/** ¿La clase `classroomId` pertenece al profesor `teacherId`? */
export const teacherOwnsClassroom = async (
  teacherId: string,
  classroomId: string
): Promise<boolean> => {
  const [row] = await db
    .select({ id: classrooms.id })
    .from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)));
  return !!row;
};

/** ¿El perfil de estudiante `studentProfileId` pertenece al usuario `userId`? */
export const userOwnsStudentProfile = async (
  userId: string,
  studentProfileId: string
): Promise<boolean> => {
  const [row] = await db
    .select({ id: studentProfiles.id })
    .from(studentProfiles)
    .where(and(eq(studentProfiles.id, studentProfileId), eq(studentProfiles.userId, userId)));
  return !!row;
};

/** ¿El usuario (ESTUDIANTE) tiene un perfil activo en esa clase? */
export const studentInClassroom = async (
  userId: string,
  classroomId: string
): Promise<boolean> => {
  const [row] = await db
    .select({ id: studentProfiles.id })
    .from(studentProfiles)
    .where(and(eq(studentProfiles.userId, userId), eq(studentProfiles.classroomId, classroomId)));
  return !!row;
};

/** Rol del usuario en la escuela, solo si su membresía está VERIFIED. `null` si no. */
export const verifiedSchoolRole = async (
  userId: string,
  schoolId: string
): Promise<'OWNER' | 'TEACHER' | null> => {
  const [row] = await db
    .select({ role: schoolMembers.role, status: schoolMembers.status })
    .from(schoolMembers)
    .where(and(eq(schoolMembers.schoolId, schoolId), eq(schoolMembers.userId, userId)));
  if (!row || row.status !== 'VERIFIED') return null;
  return row.role;
};

/**
 * ¿Puede el profesor poner sus clases en esa escuela? Miembro VERIFIED (dueño o profesor),
 * o el dueño que la registró y espera la aprobación del administrador (PENDING_ADMIN).
 */
export const canAttachClassroomsToSchool = async (userId: string, schoolId: string): Promise<boolean> => {
  const [row] = await db
    .select({ role: schoolMembers.role, status: schoolMembers.status })
    .from(schoolMembers)
    .where(and(eq(schoolMembers.schoolId, schoolId), eq(schoolMembers.userId, userId)));
  if (!row) return false;
  return row.status === 'VERIFIED' || (row.role === 'OWNER' && row.status === 'PENDING_ADMIN');
};

/** ¿El usuario (PADRE) tiene un hijo con vínculo ACTIVE en esa clase? */
export const parentHasClassroomAccess = async (
  parentUserId: string,
  classroomId: string
): Promise<boolean> => {
  const rows = await db
    .select({ id: parentStudentLinks.id })
    .from(parentStudentLinks)
    .innerJoin(parentProfiles, eq(parentStudentLinks.parentProfileId, parentProfiles.id))
    .innerJoin(studentProfiles, eq(parentStudentLinks.studentProfileId, studentProfiles.id))
    .where(and(
      eq(parentProfiles.userId, parentUserId),
      eq(studentProfiles.classroomId, classroomId),
      eq(parentStudentLinks.status, 'ACTIVE'),
      eq(studentProfiles.isActive, true),
    ))
    .limit(1);
  return rows.length > 0;
};

/** Escuela a la que pertenece una membresía (para resolver ownership por memberId). */
export const schoolIdOfMember = async (memberId: string): Promise<string | null> => {
  const [row] = await db
    .select({ schoolId: schoolMembers.schoolId })
    .from(schoolMembers)
    .where(eq(schoolMembers.id, memberId));
  return row?.schoolId ?? null;
};

/** Tablas con columnas `id` y `classroomId`: el recurso pertenece a una clase. */
type ClassroomScopedTable =
  | typeof classroomMessages
  | typeof classroomAvatarItems
  | typeof studentProfiles
  | typeof collectibleAlbums
  | typeof behaviors
  | typeof classroomCharacterClasses
  | typeof itemUsages;

/** Clase dueña de un recurso, o `null` si el recurso no existe. */
const classroomIdById = async (table: ClassroomScopedTable, id: string): Promise<string | null> => {
  if (!id) return null;
  const [row] = await db
    .select({ classroomId: table.classroomId })
    .from(table as typeof classroomMessages)
    .where(eq(table.id, id));
  return row?.classroomId ?? null;
};

/** Clase dueña de un ítem de la tienda de avatar (por id de classroom_avatar_items). */
export const classroomIdOfShopItem = (shopItemId: string) => classroomIdById(classroomAvatarItems, shopItemId);

/** Clase de un perfil de estudiante. */
export const classroomIdOfStudentProfile = (studentProfileId: string) => classroomIdById(studentProfiles, studentProfileId);

/** Clase de un álbum de figuritas. */
export const classroomIdOfAlbum = (albumId: string) => classroomIdById(collectibleAlbums, albumId);

/** Clase de un comportamiento. */
export const classroomIdOfBehavior = (behaviorId: string) => classroomIdById(behaviors, behaviorId);

/** Clase de una clase de personaje personalizada. */
export const classroomIdOfCharacterClass = (characterClassId: string) =>
  classroomIdById(classroomCharacterClasses, characterClassId);

/** Clase de una solicitud de uso de artículo de la tienda. */
export const classroomIdOfItemUsage = (usageId: string) => classroomIdById(itemUsages, usageId);

/** ¿Todos los perfiles de estudiante indicados pertenecen a la clase? */
export const studentsBelongToClassroom = async (
  studentProfileIds: string[],
  classroomId: string
): Promise<boolean> => {
  if (!Array.isArray(studentProfileIds) || studentProfileIds.some((id) => typeof id !== 'string' || !id)) {
    return false;
  }
  const unique = [...new Set(studentProfileIds)];
  if (unique.length === 0) return false;
  const rows = await db
    .select({ id: studentProfiles.id })
    .from(studentProfiles)
    .where(and(eq(studentProfiles.classroomId, classroomId), inArray(studentProfiles.id, unique)));
  return rows.length === unique.length;
};

/**
 * ¿Todos los bancos de preguntas pertenecen a clases del usuario? (ADMIN: siempre).
 * Permite reutilizar bancos entre clases del mismo profesor, no enlazar los de otros.
 */
export const questionBanksOwnedBy = async (
  user: { id: string; role: string },
  bankIds: unknown
): Promise<boolean> => {
  const ids = Array.isArray(bankIds) ? bankIds : [bankIds];
  if (ids.length === 0 || ids.some((id) => typeof id !== 'string' || !id)) return false;
  if (user.role === 'ADMIN') return true;
  const unique = [...new Set(ids as string[])];
  const rows = await db
    .select({ id: questionBanks.id })
    .from(questionBanks)
    .innerJoin(classrooms, eq(questionBanks.classroomId, classrooms.id))
    .where(and(inArray(questionBanks.id, unique), eq(classrooms.teacherId, user.id)));
  return rows.length === unique.length;
};

/** Clase de una figurita (a través de su álbum). */
export const classroomIdOfCard = async (cardId: string): Promise<string | null> => {
  if (!cardId) return null;
  const [row] = await db
    .select({ classroomId: collectibleAlbums.classroomId })
    .from(collectibleCards)
    .innerJoin(collectibleAlbums, eq(collectibleCards.albumId, collectibleAlbums.id))
    .where(eq(collectibleCards.id, cardId));
  return row?.classroomId ?? null;
};

/** Ámbito y clase de una insignia (para distinguir SYSTEM de CLASSROOM). */
export const badgeScopeAndClassroom = async (
  badgeId: string
): Promise<{ scope: 'SYSTEM' | 'CLASSROOM'; classroomId: string | null } | null> => {
  const [row] = await db
    .select({ scope: badges.scope, classroomId: badges.classroomId })
    .from(badges)
    .where(eq(badges.id, badgeId));
  return row ? { scope: row.scope as 'SYSTEM' | 'CLASSROOM', classroomId: row.classroomId } : null;
};

/** Clase a la que está asignada una clase (para verificar antes de desasignar). */
export const schoolIdOfClassroom = async (classroomId: string): Promise<string | null> => {
  const [row] = await db
    .select({ schoolId: classrooms.schoolId })
    .from(classrooms)
    .where(eq(classrooms.id, classroomId));
  return row?.schoolId ?? null;
};

/**
 * ¿El usuario puede acceder a la sala/datos de una clase? (sin efectos HTTP)
 * ADMIN siempre; TEACHER dueño; PARENT con hijo vinculado; STUDENT con perfil en la clase.
 * Pensado para autorizar `join` de Socket.io.
 */
export const userCanAccessClassroom = async (
  user: { id: string; role: string },
  classroomId: string
): Promise<boolean> => {
  if (!user || !classroomId) return false;
  switch (user.role) {
    case 'ADMIN': return true;
    case 'TEACHER': return teacherOwnsClassroom(user.id, classroomId);
    case 'PARENT': return parentHasClassroomAccess(user.id, classroomId);
    case 'STUDENT': return studentInClassroom(user.id, classroomId);
    default: return false;
  }
};

// ─────────────────────────────────────────────────────────────
// Guards HTTP (emiten respuesta y devuelven boolean)
// ─────────────────────────────────────────────────────────────

// `error` duplica `message` por compatibilidad: parte del cliente aún lee `data.error`
// (helpers antiguos respondían `{ error }`).
const deny = (res: Response, status: number, message: string): false => {
  res.status(status).json({ success: false, message, error: message });
  return false;
};

/**
 * El usuario es ADMIN, o es el TEACHER dueño de la clase.
 * Sustituye a las copias de `ensureTeacherClassroomAccess`.
 */
export const requireClassroomTeacher = async (
  req: Request,
  res: Response,
  classroomId: string
): Promise<boolean> => {
  const user = req.user;
  if (!user) return deny(res, 401, 'No autenticado');
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'TEACHER') return deny(res, 403, 'No tienes permisos para esta acción');
  if (!classroomId) return deny(res, 400, 'Falta el identificador de la clase');
  if (!(await teacherOwnsClassroom(user.id, classroomId))) {
    return deny(res, 403, 'No tienes acceso a esta clase');
  }
  return true;
};

/**
 * El usuario es dueño del perfil de estudiante (acción del propio alumno),
 * o es ADMIN. Para acciones donde el `studentProfileId` viene del cliente.
 */
export const requireStudentProfileOwner = async (
  req: Request,
  res: Response,
  studentProfileId: string
): Promise<boolean> => {
  const user = req.user;
  if (!user) return deny(res, 401, 'No autenticado');
  if (user.role === 'ADMIN') return true;
  if (!studentProfileId) return deny(res, 400, 'Falta el identificador del estudiante');
  if (!(await userOwnsStudentProfile(user.id, studentProfileId))) {
    return deny(res, 403, 'No tienes acceso a este perfil');
  }
  return true;
};

/**
 * El usuario es ADMIN, o es OWNER (verificado) de la escuela.
 */
export const requireSchoolOwner = async (
  req: Request,
  res: Response,
  schoolId: string
): Promise<boolean> => {
  const user = req.user;
  if (!user) return deny(res, 401, 'No autenticado');
  if (user.role === 'ADMIN') return true;
  if (!schoolId) return deny(res, 400, 'Falta el identificador de la escuela');
  const role = await verifiedSchoolRole(user.id, schoolId);
  if (role !== 'OWNER') return deny(res, 403, 'Solo el responsable de la escuela puede realizar esta acción');
  return true;
};

/**
 * Ver la escuela (profesores, clases, biblioteca): ADMIN, miembro VERIFIED, o el dueño que la registró
 * y espera verificación (PENDING_ADMIN). Gestionar (reportes, solicitudes, biblioteca, retirar) usa requireSchoolOwner.
 */
export const requireSchoolViewer = async (
  req: Request,
  res: Response,
  schoolId: string
): Promise<boolean> => {
  const user = req.user;
  if (!user) return deny(res, 401, 'No autenticado');
  if (user.role === 'ADMIN') return true;
  if (!schoolId) return deny(res, 400, 'Falta el identificador de la escuela');
  if (!(await canAttachClassroomsToSchool(user.id, schoolId))) {
    return deny(res, 403, 'No tienes acceso a esta escuela');
  }
  return true;
};

/**
 * Asignar clases a una escuela: ADMIN, o profesor que pertenece a ella (ver canAttachClassroomsToSchool).
 */
export const requireSchoolClassroomMember = async (
  req: Request,
  res: Response,
  schoolId: string
): Promise<boolean> => {
  const user = req.user;
  if (!user) return deny(res, 401, 'No autenticado');
  if (user.role === 'ADMIN') return true;
  if (!schoolId) return deny(res, 400, 'Falta el identificador de la escuela');
  if (!(await canAttachClassroomsToSchool(user.id, schoolId))) {
    return deny(res, 403, 'No perteneces a esa escuela');
  }
  return true;
};

/**
 * Lectura de una clase: ADMIN, el TEACHER dueño, o un PADRE con hijo vinculado.
 * Para endpoints compartidos entre profesor y familia (avisos, chat).
 */
export const requireClassroomTeacherOrParent = async (
  req: Request,
  res: Response,
  classroomId: string
): Promise<boolean> => {
  const user = req.user;
  if (!user) return deny(res, 401, 'No autenticado');
  if (user.role === 'ADMIN') return true;
  if (!classroomId) return deny(res, 400, 'Falta el identificador de la clase');
  if (user.role === 'TEACHER') {
    if (!(await teacherOwnsClassroom(user.id, classroomId))) {
      return deny(res, 403, 'No tienes acceso a esta clase');
    }
    return true;
  }
  if (user.role === 'PARENT') {
    if (!(await parentHasClassroomAccess(user.id, classroomId))) {
      return deny(res, 403, 'No tienes acceso a esta clase');
    }
    return true;
  }
  return deny(res, 403, 'No tienes permisos para esta acción');
};

type ClassroomResolver = (id: string) => Promise<string | null>;

/**
 * Resuelve la clase de un recurso (álbum, carta, comportamiento...) y exige que el
 * usuario sea el profesor dueño. 404 si el recurso no existe.
 */
export const requireResourceTeacher = async (
  req: Request,
  res: Response,
  resolveClassroom: ClassroomResolver,
  resourceId: string,
  notFoundMessage = 'Recurso no encontrado'
): Promise<boolean> => {
  const classroomId = await resolveClassroom(resourceId);
  if (!classroomId) return deny(res, 404, notFoundMessage);
  return requireClassroomTeacher(req, res, classroomId);
};

/** Como `requireResourceTeacher`, pero basta con ser miembro de la clase. */
export const requireResourceMember = async (
  req: Request,
  res: Response,
  resolveClassroom: ClassroomResolver,
  resourceId: string,
  notFoundMessage = 'Recurso no encontrado'
): Promise<boolean> => {
  const classroomId = await resolveClassroom(resourceId);
  if (!classroomId) return deny(res, 404, notFoundMessage);
  return requireClassroomMember(req, res, classroomId);
};

/** Copia solo las claves permitidas de un body (evita mass assignment). */
export const pickFields = <K extends string>(
  body: Record<string, unknown> | undefined,
  allowed: readonly K[]
): Partial<Record<K, unknown>> => {
  const out: Partial<Record<K, unknown>> = {};
  if (!body || typeof body !== 'object') return out;
  for (const key of allowed) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
};

/** El usuario tiene rol TEACHER (o ADMIN). Gate sin recurso concreto. */
export const requireTeacherRole = (req: Request, res: Response): boolean => {
  const user = req.user;
  if (!user) return deny(res, 401, 'No autenticado');
  if (user.role === 'ADMIN' || user.role === 'TEACHER') return true;
  return deny(res, 403, 'No tienes permisos para esta acción');
};

/** Cualquier miembro de la clase (profesor dueño, alumno, padre vinculado) o ADMIN. */
export const requireClassroomMember = async (
  req: Request,
  res: Response,
  classroomId: string
): Promise<boolean> => {
  const user = req.user;
  if (!user) return deny(res, 401, 'No autenticado');
  if (!classroomId) return deny(res, 400, 'Falta el identificador de la clase');
  if (await userCanAccessClassroom(user, classroomId)) return true;
  return deny(res, 403, 'No tienes acceso a esta clase');
};

/**
 * Lectura del perfil de un estudiante: el propio alumno, el profesor dueño de su
 * clase, un padre vinculado, o ADMIN.
 */
export const requireStudentProfileReadAccess = async (
  req: Request,
  res: Response,
  studentProfileId: string
): Promise<boolean> => {
  const user = req.user;
  if (!user) return deny(res, 401, 'No autenticado');
  if (user.role === 'ADMIN') return true;
  if (!studentProfileId) return deny(res, 400, 'Falta el identificador del estudiante');
  if (user.role === 'STUDENT') {
    if (await userOwnsStudentProfile(user.id, studentProfileId)) return true;
    return deny(res, 403, 'No tienes acceso a este perfil');
  }
  const classroomId = await classroomIdOfStudentProfile(studentProfileId);
  if (!classroomId) return deny(res, 404, 'Estudiante no encontrado');
  if (await userCanAccessClassroom(user, classroomId)) return true;
  return deny(res, 403, 'No tienes acceso a este perfil');
};

/**
 * Como `requireResourceMember` para varios alumnos: el usuario debe poder acceder a la clase de
 * cada uno (misma regla que `userCanAccessClassroom`). Ids inexistentes se ignoran.
 */
export const requireStudentsMember = async (
  req: Request,
  res: Response,
  studentProfileIds: string[]
): Promise<boolean> => {
  const user = req.user;
  if (!user) return deny(res, 401, 'No autenticado');
  if (studentProfileIds.length === 0) return true;
  const rows = await db
    .select({ classroomId: studentProfiles.classroomId })
    .from(studentProfiles)
    .where(inArray(studentProfiles.id, studentProfileIds));
  const classroomIds = [...new Set(rows.map((r) => r.classroomId))];
  for (const classroomId of classroomIds) {
    if (!(await userCanAccessClassroom(user, classroomId))) {
      return deny(res, 403, 'No tienes acceso a alguno de estos estudiantes');
    }
  }
  return true;
};

/** Como `requireSchoolOwner` pero resolviendo la escuela a partir de una membresía. */
export const requireSchoolOwnerByMember = async (
  req: Request,
  res: Response,
  memberId: string
): Promise<boolean> => {
  const schoolId = await schoolIdOfMember(memberId);
  if (!schoolId) return deny(res, 404, 'Solicitud no encontrada');
  return requireSchoolOwner(req, res, schoolId);
};
