import { and, eq, gte, inArray, isNull, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  attendanceRecords, classroomCharacterClasses, classrooms, gradeEvaluationScores, pointLogs, schoolAutoProfiles, schoolEnrollments, schoolMoveProfiles,
  schoolStudents, schoolTeachingAssignments, schoolWorkshops, schoolWorkshopSections, schoolWorkshopStudents, studentBadges, studentEquippedItems,
  studentGrades, studentProfiles, users,
} from '../db/schema.js';
import { generateRandomCode } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import { matchWords } from '../utils/personNames.js';
import { affectedRows } from '../utils/points.js';
import { avatarService } from './avatar.service.js';
import { familyRoomService } from './familyRoom.service.js';
import { applyCarry, newEffects, pendingCarries, type CarryEffects, type PendingCarry } from './schoolCarry.service.js';

/**
 * Matrícula automática: cada estudiante matriculado en una sección tiene un perfil en cada clase vinculada a una
 * asignación de esa sección. Si ya está en la clase (perfil ligado al padrón) no se toca; si el docente ya lo tenía con
 * el mismo nombre sin ligar, se liga ese perfil; si no, se crea. El perfil nuevo se liga a la cuenta del estudiante si
 * tiene exactamente una (la clase le aparece sola); si no, queda por reclamar con su tarjeta. Cada perfil creado o
 * ligado se anota para poder deshacer una importación o un armado mientras nadie lo use. Quien vuelve a una clase donde
 * quedó inactivo (retirado o trasladado) recupera su perfil.
 */

export interface SyncResult {
  created: number;
  linked: number;
  withAccount: number;
}
const ZERO: SyncResult = { created: 0, linked: 0, withAccount: 0 };
const add = (a: SyncResult, b: SyncResult): SyncResult => ({ created: a.created + b.created, linked: a.linked + b.linked, withAccount: a.withAccount + b.withAccount });

type Executor = Pick<typeof db, 'select' | 'selectDistinct'>;

/** Perfiles automáticos de unos estudiantes: los creados sin usar, los ligados y cuántos creados ya se usaron. */
export interface AutoInspection {
  unused: string[];
  linked: Array<{ profileId: string; studentId: string }>;
  used: number;
  all: string[];
}
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const nameKey = (text: string) => matchWords(text).sort().join(' ');
/** «Nombres Apellidos» (el orden que usan la puerta de la clase y las cuentas con PIN), hasta 100 caracteres. */
const profileName = (s: { firstNames: string; lastNames: string }) => `${s.firstNames} ${s.lastNames}`.trim().slice(0, 100);

const groupBy = <T>(items: T[], key: (item: T) => string) => {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return map;
};

/** Códigos de tarjeta (6 caracteres) que aún no usa ningún perfil. */
const uniqueLinkCodes = async (executor: Executor, count: number) => {
  const codes = new Set<string>();
  for (let round = 0; round < 6 && codes.size < count; round++) {
    const batch = new Set<string>();
    while (batch.size < (count - codes.size) * 2) {
      const code = generateRandomCode(6);
      if (!codes.has(code)) batch.add(code);
    }
    const taken = new Set((await executor.select({ code: studentProfiles.linkCode }).from(studentProfiles)
      .where(inArray(studentProfiles.linkCode, [...batch]))).map((r) => r.code));
    for (const code of batch) {
      if (codes.size >= count) break;
      if (!taken.has(code)) codes.add(code);
    }
  }
  if (codes.size < count) throw new Error('No se pudieron generar códigos de tarjeta');
  return [...codes];
};

export interface SyncInput {
  schoolId: string;
  yearId: string;
  classroomId: string;
  sectionIds?: string[];
  studentIds?: string[];
}

/** Después de confirmar: la familia de quien llegó entra en vivo a la sala de su clase nueva. */
export const runCarryEffects = (effects: CarryEffects) => {
  for (const join of effects.familyJoins) familyRoomService.joinParentToRoom(join.parentUserId, join.classroomId);
};

/** El progreso que trae cada recién llegado de su área y, dentro de un movimiento, su anotación para deshacerlo. */
const carryArrivals = async (tx: Tx, input: {
  schoolId: string;
  classroomId: string;
  arrivals: Array<{ studentId: string; profileId: string; reactivated: boolean }>;
  moveId?: string;
  effects: CarryEffects;
  now: Date;
}) => {
  const { schoolId, classroomId, arrivals, moveId, effects, now } = input;
  if (arrivals.length === 0) return;
  // La clase de un área trae el progreso de esa área; la de un taller empieza de cero (es otra actividad).
  const [assignment] = await tx.select({ areaId: schoolTeachingAssignments.areaId }).from(schoolTeachingAssignments)
    .where(eq(schoolTeachingAssignments.classroomId, classroomId)).limit(1);
  const pending = assignment
    ? await pendingCarries(tx, [...new Set(arrivals.map((a) => a.studentId))], assignment.areaId)
    : new Map<string, PendingCarry>();
  const plain: typeof arrivals = [];
  for (const arrival of arrivals) {
    const carry = pending.get(arrival.studentId);
    if (carry) {
      pending.delete(arrival.studentId);
      await applyCarry(tx, carry, { profileId: arrival.profileId, classroomId, reactivated: arrival.reactivated }, effects, now);
    } else if (moveId) {
      plain.push(arrival);
    }
  }
  if (!moveId || plain.length === 0) return;
  const state = await tx.select({ id: studentProfiles.id, xp: studentProfiles.xp, gp: studentProfiles.gp }).from(studentProfiles)
    .where(inArray(studentProfiles.id, plain.map((a) => a.profileId)));
  const byId = new Map(state.map((p) => [p.id, p]));
  await tx.insert(schoolMoveProfiles).values(plain.map((a) => ({
    id: uuidv4(), moveId, schoolId, studentId: a.studentId, areaId: assignment?.areaId ?? null,
    targetProfileId: a.profileId, targetReactivated: a.reactivated,
    targetXp: byId.get(a.profileId)?.xp ?? null, targetGp: byId.get(a.profileId)?.gp ?? null,
    snapshot: a.reactivated ? { reactivatedOnly: true as const } : null, appliedAt: now, createdAt: now,
  })));
};

export const schoolAutoEnrollService = {
  /**
   * Pone en una clase vinculada a sus estudiantes: los de una o varias secciones, o una lista (taller con inscripción).
   * Con la fila de la clase bloqueada: sin repetidos.
   */
  async syncClassroom(input: SyncInput): Promise<SyncResult> {
    const effects = newEffects();
    const result = await db.transaction((tx) => this.syncClassroomIn(tx, input, { effects }));
    runCarryEffects(effects);
    return result;
  },

  /**
   * Lo mismo dentro de una transacción ajena (traslado o reincorporación: todo o nada). Quien vuelve a una clase donde
   * tiene un perfil inactivo lo recupera; quien llega con progreso pendiente de esa área (un traslado) lo trae. Con
   * `moveId`, cada perfil que entra sin progreso pendiente se anota en ese movimiento para poder deshacerlo.
   */
  async syncClassroomIn(tx: Tx, input: SyncInput, context: { moveId?: string; effects: CarryEffects }): Promise<SyncResult> {
    const { schoolId, yearId, classroomId } = input;
    const sectionIds = input.sectionIds ?? [];
    const studentIds = input.studentIds ?? [];
    if (sectionIds.length === 0 && studentIds.length === 0) return ZERO;
    const now = new Date();
    const [classroom] = await tx.select({
      id: classrooms.id, isActive: classrooms.isActive, schoolId: classrooms.schoolId,
      defaultXp: classrooms.defaultXp, defaultHp: classrooms.defaultHp, defaultGp: classrooms.defaultGp,
    }).from(classrooms).where(eq(classrooms.id, classroomId)).for('update');
    // Una clase archivada o que ya no es de la escuela no recibe a nadie.
    if (!classroom || !classroom.isActive || classroom.schoolId !== schoolId) return ZERO;

    const enrolled = await tx.select({ studentId: schoolStudents.id, firstNames: schoolStudents.firstNames, lastNames: schoolStudents.lastNames, userId: schoolStudents.userId, sex: schoolStudents.sex })
      .from(schoolEnrollments)
      .innerJoin(schoolStudents, eq(schoolStudents.id, schoolEnrollments.studentId))
      .where(and(
        eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.status, 'ACTIVE'),
        or(
          sectionIds.length ? inArray(schoolEnrollments.sectionId, sectionIds) : undefined,
          studentIds.length ? inArray(schoolEnrollments.studentId, studentIds) : undefined,
        ),
        eq(schoolStudents.schoolId, schoolId), eq(schoolStudents.status, 'ACTIVE'),
      ));
    if (enrolled.length === 0) return ZERO;
    const profiles = await tx.select({
      id: studentProfiles.id, userId: studentProfiles.userId, schoolStudentId: studentProfiles.schoolStudentId,
      displayName: studentProfiles.displayName, characterName: studentProfiles.characterName,
      isActive: studentProfiles.isActive, isDemo: studentProfiles.isDemo,
    }).from(studentProfiles).where(eq(studentProfiles.classroomId, classroomId));
    // Ya en la clase: activo, nada que hacer; inactivo (retirado o trasladado que vuelve), se recupera.
    const bySchoolStudent = new Map<string, (typeof profiles)[number]>();
    for (const p of profiles) {
      if (!p.schoolStudentId) continue;
      const seen = bySchoolStudent.get(p.schoolStudentId);
      if (!seen || (!seen.isActive && p.isActive)) bySchoolStudent.set(p.schoolStudentId, p);
    }
    const present = new Set(bySchoolStudent.keys());
    const returning = enrolled
      .map((s) => bySchoolStudent.get(s.studentId))
      .filter((p): p is (typeof profiles)[number] => !!p && !p.isActive);
    let missing = enrolled.filter((s) => !present.has(s.studentId));
    if (missing.length === 0 && returning.length === 0) return ZERO;

    const tracked: Array<typeof schoolAutoProfiles.$inferInsert> = [];
    const link = async (profile: { id: string; userId: string | null }, studentId: string) => {
      const result = await tx.update(studentProfiles).set({ schoolStudentId: studentId, updatedAt: now })
        .where(and(eq(studentProfiles.id, profile.id), isNull(studentProfiles.schoolStudentId)));
      if (affectedRows(result) !== 1) return false;
      tracked.push({ profileId: profile.id, schoolId, studentId, classroomId, kind: 'LINKED', userId: profile.userId, createdAt: now });
      present.add(studentId);
      return true;
    };

    // 1) El docente ya lo tenía, sin ligar, con el mismo nombre (exacto y sin ambigüedad en ninguno de los lados).
    let linked = 0;
    const free = profiles.filter((p) => !p.schoolStudentId && p.isActive && !p.isDemo);
    const freeByKey = groupBy(free, (p) => nameKey(p.displayName || p.characterName || ''));
    for (const [key, students] of groupBy(missing, (s) => nameKey(`${s.lastNames} ${s.firstNames}`))) {
      const candidates = freeByKey.get(key) ?? [];
      if (!key || students.length !== 1 || candidates.length !== 1) continue;
      if (await link(candidates[0], students[0].studentId)) linked++;
    }
    missing = missing.filter((s) => !present.has(s.studentId));

    // 2) Su cuenta, si tiene exactamente una (de alumno, activa, fuera de perfiles demo). Cuenta también la de sus
    //    perfiles inactivos: quien llega trasladado ya dejó los de su sección anterior.
    const accounts = missing.length === 0 ? [] : await tx.select({
      studentId: studentProfiles.schoolStudentId, userId: studentProfiles.userId,
      characterName: studentProfiles.characterName, avatarGender: studentProfiles.avatarGender, updatedAt: studentProfiles.updatedAt,
    }).from(studentProfiles)
      .innerJoin(users, eq(users.id, studentProfiles.userId))
      .where(and(
        inArray(studentProfiles.schoolStudentId, missing.map((s) => s.studentId)),
        eq(studentProfiles.isDemo, false), eq(users.role, 'STUDENT'), eq(users.isActive, true),
      ));
    const accountsOf = groupBy(accounts, (a) => a.studentId!);
    const inClassByUser = new Map(profiles.filter((p) => p.userId).map((p) => [p.userId!, p]));
    // Su cuenta del colegio (la del DNI y el PIN) manda sobre la regla de «una sola cuenta en sus clases».
    const schoolAccountIds = [...new Set(missing.map((s) => s.userId).filter((id): id is string => !!id))];
    const usableSchoolAccounts = schoolAccountIds.length === 0 ? new Set<string>() : new Set((await tx.select({ id: users.id }).from(users)
      .where(and(inArray(users.id, schoolAccountIds), eq(users.role, 'STUDENT'), eq(users.isActive, true)))).map((u) => u.id));

    // 3) Crear los que faltan: con su cuenta (su nombre de héroe y su género de avatar) o por reclamar con tarjeta. Sin un
    //    personaje suyo, el avatar nace con el cuerpo de su sexo del padrón.
    const toCreate: Array<{ studentId: string; name: string; userId: string | null; characterName: string; gender: 'MALE' | 'FEMALE' }> = [];
    for (const student of missing) {
      const schoolAccount = student.userId && usableSchoolAccounts.has(student.userId) ? student.userId : null;
      const own = (accountsOf.get(student.studentId) ?? []).filter((a) => !schoolAccount || a.userId === schoolAccount);
      const userIds = schoolAccount ? [schoolAccount] : [...new Set(own.map((a) => a.userId!))];
      const name = profileName(student);
      if (userIds.length === 1) {
        const existing = inClassByUser.get(userIds[0]);
        if (existing) {
          // Ya estaba en la clase con su cuenta, sin ligar: se liga ese perfil (la clave clase+cuenta no admite otro).
          if (!existing.schoolStudentId && (await link(existing, student.studentId))) {
            linked++;
            continue;
          }
          toCreate.push({ studentId: student.studentId, name, userId: null, characterName: name, gender: student.sex ?? 'MALE' });
          continue;
        }
        const latest = [...own].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        toCreate.push({ studentId: student.studentId, name, userId: userIds[0], characterName: latest?.characterName || name, gender: latest?.avatarGender ?? student.sex ?? 'MALE' });
      } else {
        toCreate.push({ studentId: student.studentId, name, userId: null, characterName: name, gender: student.sex ?? 'MALE' });
      }
    }

    const created: Array<{ id: string; schoolStudentId: string }> = [];
    if (toCreate.length > 0) {
      const [guardian] = await tx.select({ id: classroomCharacterClasses.id }).from(classroomCharacterClasses)
        .where(and(eq(classroomCharacterClasses.classroomId, classroomId), eq(classroomCharacterClasses.key, 'GUARDIAN')))
        .limit(1);
      const codes = await uniqueLinkCodes(tx, toCreate.filter((c) => !c.userId).length);
      let next = 0;
      const rows = toCreate.map((c) => ({
        id: uuidv4(),
        userId: c.userId,
        classroomId,
        displayName: c.name,
        characterName: c.characterName,
        linkCode: c.userId ? null : codes[next++],
        characterClass: 'GUARDIAN' as const,
        characterClassId: guardian?.id ?? null,
        avatarGender: c.gender,
        hp: classroom.defaultHp,
        xp: classroom.defaultXp,
        gp: classroom.defaultGp,
        schoolStudentId: c.studentId,
        createdAt: now,
        updatedAt: now,
      }));
      for (let i = 0; i < rows.length; i += 200) await tx.insert(studentProfiles).values(rows.slice(i, i + 200));
      for (const gender of ['MALE', 'FEMALE'] as const) {
        await avatarService.equipDefaultItemsMany(rows.filter((r) => r.avatarGender === gender).map((r) => r.id), gender, tx);
      }
      tracked.push(...rows.map((r) => ({
        profileId: r.id, schoolId, studentId: r.schoolStudentId, classroomId, kind: 'CREATED' as const, userId: r.userId,
        initialXp: r.xp, initialGp: r.gp, createdAt: now,
      })));
      created.push(...rows.map((r) => ({ id: r.id, schoolStudentId: r.schoolStudentId })));
    }
    if (returning.length > 0) {
      await tx.update(studentProfiles).set({ isActive: true, updatedAt: now }).where(inArray(studentProfiles.id, returning.map((p) => p.id)));
    }
    for (let i = 0; i < tracked.length; i += 200) await tx.insert(schoolAutoProfiles).values(tracked.slice(i, i + 200));

    // Lo que trae cada uno de su área (traslado) y, dentro de un movimiento, quién entró sin progreso pendiente.
    const arrivals = [
      ...created.map((r) => ({ studentId: r.schoolStudentId, profileId: r.id, reactivated: false })),
      ...returning.map((p) => ({ studentId: p.schoolStudentId!, profileId: p.id, reactivated: true })),
    ];
    await carryArrivals(tx, { schoolId, classroomId, arrivals, moveId: context.moveId, effects: context.effects, now });
    return { created: toCreate.length, linked, withAccount: toCreate.filter((c) => c.userId).length };
  },

  /** La clase de un taller: sus secciones o sus inscritos. */
  async syncWorkshop(schoolId: string, yearId: string, workshopId: string): Promise<SyncResult> {
    const [workshop] = await db.select({ classroomId: schoolWorkshops.classroomId, mode: schoolWorkshops.mode }).from(schoolWorkshops)
      .where(and(eq(schoolWorkshops.id, workshopId), eq(schoolWorkshops.schoolId, schoolId)));
    if (!workshop?.classroomId) return ZERO;
    if (workshop.mode === 'SECTION') {
      const sections = await db.select({ id: schoolWorkshopSections.sectionId }).from(schoolWorkshopSections).where(eq(schoolWorkshopSections.workshopId, workshopId));
      return this.syncClassroom({ schoolId, yearId, classroomId: workshop.classroomId, sectionIds: sections.map((s) => s.id) });
    }
    const students = await db.select({ id: schoolWorkshopStudents.studentId }).from(schoolWorkshopStudents).where(eq(schoolWorkshopStudents.workshopId, workshopId));
    return this.syncClassroom({ schoolId, yearId, classroomId: workshop.classroomId, studentIds: students.map((s) => s.id) });
  },

  /** Todas las clases vinculadas de una sección: las de sus áreas y las de sus talleres de toda la sección. */
  async syncSection(schoolId: string, yearId: string, sectionId: string): Promise<SyncResult> {
    const links = await db.select({ classroomId: schoolTeachingAssignments.classroomId }).from(schoolTeachingAssignments)
      .where(and(eq(schoolTeachingAssignments.schoolId, schoolId), eq(schoolTeachingAssignments.yearId, yearId), eq(schoolTeachingAssignments.sectionId, sectionId)));
    let total = ZERO;
    for (const { classroomId } of links) {
      if (classroomId) total = add(total, await this.syncClassroom({ schoolId, yearId, sectionIds: [sectionId], classroomId }));
    }
    const workshops = await db.select({ id: schoolWorkshops.id }).from(schoolWorkshops)
      .innerJoin(schoolWorkshopSections, eq(schoolWorkshopSections.workshopId, schoolWorkshops.id))
      .where(and(eq(schoolWorkshops.schoolId, schoolId), eq(schoolWorkshops.yearId, yearId), eq(schoolWorkshops.mode, 'SECTION'), eq(schoolWorkshopSections.sectionId, sectionId)));
    for (const { id } of workshops) total = add(total, await this.syncWorkshop(schoolId, yearId, id));
    return total;
  },

  /**
   * Después de matricular o dar sección (alta, importación, armado): las clases de las secciones de estos estudiantes.
   * Nunca hace fallar la acción que la llamó; lo que falle se completa con «Sincronizar».
   */
  async syncStudents(schoolId: string, yearId: string, studentIds: string[]): Promise<SyncResult> {
    if (studentIds.length === 0) return ZERO;
    try {
      const sections = await db.selectDistinct({ sectionId: schoolEnrollments.sectionId }).from(schoolEnrollments)
        .where(and(eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.status, 'ACTIVE'), inArray(schoolEnrollments.studentId, studentIds)));
      let total = ZERO;
      for (const { sectionId } of sections) {
        if (sectionId) total = add(total, await this.syncSection(schoolId, yearId, sectionId));
      }
      // Talleres con inscripción donde están.
      const chosen = await db.selectDistinct({ id: schoolWorkshopStudents.workshopId }).from(schoolWorkshopStudents)
        .innerJoin(schoolWorkshops, eq(schoolWorkshops.id, schoolWorkshopStudents.workshopId))
        .where(and(inArray(schoolWorkshopStudents.studentId, studentIds), eq(schoolWorkshops.yearId, yearId), eq(schoolWorkshops.mode, 'CHOSEN')));
      for (const { id } of chosen) total = add(total, await this.syncWorkshop(schoolId, yearId, id));
      return total;
    } catch (error) {
      logger.error('Matrícula automática: no se pudo completar', { schoolId, yearId, error: error instanceof Error ? error.message : String(error) });
      return ZERO;
    }
  },

  /**
   * Los perfiles que la matrícula automática creó o ligó para estos estudiantes desde `since`. Un perfil creado «se
   * usó» si alguien lo reclamó, cambió su XP u oro, tiene clan o tiene puntos, asistencia, notas o insignias.
   */
  async inspect(executor: Executor, studentIds: string[], since: Date): Promise<AutoInspection> {
    if (studentIds.length === 0) return { unused: [], linked: [], used: 0, all: [] };
    const rows = await executor.select().from(schoolAutoProfiles)
      .where(and(inArray(schoolAutoProfiles.studentId, studentIds), gte(schoolAutoProfiles.createdAt, since)));
    const created = rows.filter((r) => r.kind === 'CREATED');
    const ids = created.map((r) => r.profileId);
    const current = ids.length === 0 ? [] : await executor.select({
      id: studentProfiles.id, userId: studentProfiles.userId, xp: studentProfiles.xp, gp: studentProfiles.gp, teamId: studentProfiles.teamId,
    }).from(studentProfiles).where(inArray(studentProfiles.id, ids));
    const byId = new Map(current.map((p) => [p.id, p]));
    const usedIds = new Set<string>();
    for (const row of created) {
      const p = byId.get(row.profileId);
      if (p && (p.userId !== row.userId || p.xp !== row.initialXp || p.gp !== row.initialGp || p.teamId)) usedIds.add(row.profileId);
    }
    const alive = current.map((p) => p.id);
    if (alive.length > 0) {
      const activity = [
        executor.selectDistinct({ id: pointLogs.studentId }).from(pointLogs).where(inArray(pointLogs.studentId, alive)),
        executor.selectDistinct({ id: attendanceRecords.studentProfileId }).from(attendanceRecords).where(inArray(attendanceRecords.studentProfileId, alive)),
        executor.selectDistinct({ id: studentGrades.studentProfileId }).from(studentGrades).where(inArray(studentGrades.studentProfileId, alive)),
        executor.selectDistinct({ id: gradeEvaluationScores.studentProfileId }).from(gradeEvaluationScores).where(inArray(gradeEvaluationScores.studentProfileId, alive)),
        executor.selectDistinct({ id: studentBadges.studentProfileId }).from(studentBadges).where(inArray(studentBadges.studentProfileId, alive)),
      ];
      for (const rowsOf of await Promise.all(activity)) rowsOf.forEach((r) => usedIds.add(r.id));
    }
    return {
      unused: alive.filter((id) => !usedIds.has(id)),
      linked: rows.filter((r) => r.kind === 'LINKED').map((r) => ({ profileId: r.profileId, studentId: r.studentId })),
      used: usedIds.size,
      all: rows.map((r) => r.profileId),
    };
  },

  /** Deshace lo que mostró `inspect` (sin perfiles usados): borra los creados y desliga los ligados. */
  async revert(tx: Tx, inspected: AutoInspection) {
    for (let i = 0; i < inspected.unused.length; i += 500) {
      const part = inspected.unused.slice(i, i + 500);
      await tx.delete(studentEquippedItems).where(inArray(studentEquippedItems.studentProfileId, part));
      await tx.delete(studentProfiles).where(inArray(studentProfiles.id, part));
    }
    for (const { profileId, studentId } of inspected.linked) {
      await tx.update(studentProfiles).set({ schoolStudentId: null, updatedAt: new Date() })
        .where(and(eq(studentProfiles.id, profileId), eq(studentProfiles.schoolStudentId, studentId)));
    }
    for (let i = 0; i < inspected.all.length; i += 500) {
      await tx.delete(schoolAutoProfiles).where(inArray(schoolAutoProfiles.profileId, inspected.all.slice(i, i + 500)));
    }
  },
};
