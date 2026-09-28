import type { Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
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

/** Clase a la que pertenece un mensaje de chat (para scope de borrado). */
export const classroomIdOfChatMessage = async (messageId: string): Promise<string | null> => {
  const [row] = await db
    .select({ classroomId: classroomMessages.classroomId })
    .from(classroomMessages)
    .where(eq(classroomMessages.id, messageId));
  return row?.classroomId ?? null;
};

/** Clase dueña de un ítem de la tienda de avatar (por id de classroom_avatar_items). */
export const classroomIdOfShopItem = async (shopItemId: string): Promise<string | null> => {
  const [row] = await db
    .select({ classroomId: classroomAvatarItems.classroomId })
    .from(classroomAvatarItems)
    .where(eq(classroomAvatarItems.id, shopItemId));
  return row?.classroomId ?? null;
};

/** Clase de un perfil de estudiante. */
export const classroomIdOfStudentProfile = async (studentProfileId: string): Promise<string | null> => {
  const [row] = await db
    .select({ classroomId: studentProfiles.classroomId })
    .from(studentProfiles)
    .where(eq(studentProfiles.id, studentProfileId));
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

const deny = (res: Response, status: number, message: string): false => {
  res.status(status).json({ success: false, message });
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
