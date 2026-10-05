import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { schoolStudents, studentProfiles, users } from '../db/schema.js';

/**
 * Cómo entra cada estudiante del colegio. 'pin': su cuenta tiene PIN (código del colegio + DNI + PIN, o su clase +
 * nombre + PIN). 'account': entra con correo o Google y aún no sumó un PIN. 'none': todavía no tiene cuenta (su
 * primera vez es con tarjeta). La cuenta es la del colegio o, si aún no tiene, la única que ya usa en sus clases.
 */
export type AccessState = 'pin' | 'account' | 'none';

export interface StudentAccess {
  state: AccessState;
  accountId: string | null;
  /** Último ingreso de su cuenta (se anota como mucho una vez al día). */
  lastLoginAt: Date | null;
  /** Tiene una tarjeta sin usar. */
  hasCard: boolean;
  hasDocument: boolean;
}

type Executor = Pick<typeof db, 'select' | 'selectDistinct'>;

/** Cómo entra, para la ficha y «Mi tutoría» (sin el id de su cuenta). */
export const accessOf = (access: StudentAccess | undefined) => ({
  state: access?.state ?? ('none' as AccessState),
  lastLoginAt: access?.lastLoginAt ?? null,
  hasCard: access?.hasCard ?? false,
});

export const accessStates = async (studentIds: string[], executor: Executor = db): Promise<Map<string, StudentAccess>> => {
  const result = new Map<string, StudentAccess>();
  const ids = [...new Set(studentIds)];
  if (ids.length === 0) return result;
  const students = await executor.select({
    id: schoolStudents.id, userId: schoolStudents.userId, accessCode: schoolStudents.accessCode, documentIndex: schoolStudents.documentIndex,
  }).from(schoolStudents).where(inArray(schoolStudents.id, ids));
  const linked = await executor.selectDistinct({ studentId: studentProfiles.schoolStudentId, userId: users.id })
    .from(studentProfiles)
    .innerJoin(users, eq(users.id, studentProfiles.userId))
    .where(and(inArray(studentProfiles.schoolStudentId, ids), eq(users.role, 'STUDENT'), eq(users.isActive, true)));
  const linkedOf = new Map<string, string[]>();
  for (const row of linked) linkedOf.set(row.studentId!, [...(linkedOf.get(row.studentId!) ?? []), row.userId]);
  const accountOf = new Map(students.map((s) => {
    const own = linkedOf.get(s.id) ?? [];
    return [s.id, s.userId ?? (own.length === 1 ? own[0] : null)] as const;
  }));
  const accountIds = [...new Set([...accountOf.values()].filter((id): id is string => !!id))];
  const accounts = accountIds.length === 0 ? [] : await executor.select({
    id: users.id, pinHash: users.pinHash, isActive: users.isActive, lastLoginAt: users.lastLoginAt,
  }).from(users).where(inArray(users.id, accountIds));
  const account = new Map(accounts.map((a) => [a.id, a]));
  for (const s of students) {
    const id = accountOf.get(s.id) ?? null;
    const user = id ? account.get(id) : undefined;
    const usable = !!user?.isActive;
    result.set(s.id, {
      state: usable && user?.pinHash ? 'pin' : usable ? 'account' : 'none',
      accountId: usable ? id : null,
      lastLoginAt: usable ? user?.lastLoginAt ?? null : null,
      hasCard: !!s.accessCode,
      hasDocument: !!s.documentIndex,
    });
  }
  return result;
};
