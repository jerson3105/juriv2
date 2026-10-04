import type { Student } from './classroomApi';

type AccessFields = Pick<Student, 'linkedEmail' | 'accessType' | 'pinPending' | 'pinLockedUntil' | 'pinBlocked'>;

/** Tiene acceso propio: correo, Google o PIN (los alumnos con PIN no tienen correo visible). */
export const hasStudentAccount = (s: Pick<Student, 'linkedEmail' | 'accessType'>) => !!s.linkedEmail || !!s.accessType;

export const isPinStudent = (s: Pick<Student, 'accessType'>) => s.accessType === 'PIN';

/** El docente restableció su acceso y aún no crea el PIN nuevo. */
export const isPinPending = (s: AccessFields) => isPinStudent(s) && Number(s.pinPending) === 1;

/** Su acceso quedó bloqueado tras el último bloqueo por PIN equivocados: hay que restablecerlo. */
export const isPinBlocked = (s: AccessFields) => isPinStudent(s) && Number(s.pinBlocked) === 1;

/** Hasta cuándo está bloqueado su PIN por intentos fallidos (null = no lo está). */
export const pinLockedUntil = (s: AccessFields): Date | null => {
  if (!s.pinLockedUntil) return null;
  const until = new Date(s.pinLockedUntil);
  return until.getTime() > Date.now() ? until : null;
};

/** Cómo entra, para mostrar junto a su nombre. */
export const accessLabel = (s: Pick<Student, 'linkedEmail' | 'accessType'>): string | null =>
  isPinStudent(s) ? 'Entra con PIN' : s.linkedEmail ?? null;
