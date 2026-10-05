import { and, desc, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  attendanceRecords, classroomCharacterClasses, classrooms, gradeEvaluationScores, parentProfiles, parentStudentLinks, schoolAutoProfiles,
  schoolMoveProfiles, schoolStudentMoves, schoolTeachingAssignments, schoolWorkshops, schoolYears, studentAvatarPurchases, studentBadges,
  studentEquippedItems, studentProfiles, type MoveTargetSnapshot,
} from '../db/schema.js';
import { calculateLevel } from '../utils/helpers.js';
import { avatarCatalogService } from './avatarCatalog.service.js';
import { yearClassroomIds } from './schoolCalendar.service.js';
import { deleteStudentProfileData } from './student.service.js';

/**
 * Lo que viaja con un traslado (decisión del dueño): el XP convertido por el XP por nivel de cada clase (mismo nivel),
 * el oro por el oro semanal de cada una, Energía llena, avatar y prendas, insignias «traídas de…» y el vínculo con la
 * familia. El perfil de origen no se toca: queda inactivo con su historial (notas, asistencia y su aporte al clan).
 */

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Para después de confirmar: la familia entra en vivo a la sala de la clase nueva. */
export interface CarryEffects {
  familyJoins: Array<{ parentUserId: string; classroomId: string }>;
}
export const newEffects = (): CarryEffects => ({ familyJoins: [] });

export interface ClassEconomy {
  xpPerLevel: number;
  maxHp: number;
  weekly: number | null;
}

/** Economía de una clase. Lee fuera de la transacción: no espera las filas que bloquea la matrícula automática. */
export const classEconomy = async (classroomId: string): Promise<ClassEconomy | null> => {
  const [row] = await db.select({ xpPerLevel: classrooms.xpPerLevel, maxHp: classrooms.maxHp }).from(classrooms).where(eq(classrooms.id, classroomId));
  if (!row) return null;
  return { xpPerLevel: row.xpPerLevel || 100, maxHp: row.maxHp || 100, weekly: await avatarCatalogService.peekWeeklyBase(classroomId) };
};

/** De una clase a otra: el mismo nivel (el XP escala con el XP por nivel) y las mismas semanas de oro. */
export const convertProgress = (from: { xp: number; gp: number; level: number }, a: ClassEconomy, b: ClassEconomy) => {
  const xp = Math.max(0, Math.round((from.xp * b.xpPerLevel) / a.xpPerLevel));
  const gp = a.weekly && b.weekly ? Math.max(0, Math.round((from.gp * b.weekly) / a.weekly)) : Math.max(0, from.gp);
  return { xp, gp, level: Math.max(from.level, calculateLevel(xp, b.xpPerLevel)) };
};

export interface PendingCarry {
  id: string;
  moveId: string;
  studentId: string;
  sourceProfileId: string;
  sourceLabel: string | null;
}

/** El origen pendiente más reciente de cada estudiante en un área y un año (su progreso más nuevo en esa área). */
export const pendingCarries = async (tx: Tx, studentIds: string[], areaId: string, yearId: string) => {
  const byStudent = new Map<string, PendingCarry>();
  if (studentIds.length === 0) return byStudent;
  const rows = await tx.select({
    id: schoolMoveProfiles.id, moveId: schoolMoveProfiles.moveId, studentId: schoolMoveProfiles.studentId,
    sourceProfileId: schoolMoveProfiles.sourceProfileId, sourceLabel: schoolMoveProfiles.sourceLabel,
  }).from(schoolMoveProfiles)
    .innerJoin(schoolStudentMoves, eq(schoolStudentMoves.id, schoolMoveProfiles.moveId))
    .where(and(
      inArray(schoolMoveProfiles.studentId, studentIds), eq(schoolMoveProfiles.areaId, areaId), eq(schoolStudentMoves.yearId, yearId),
      isNotNull(schoolMoveProfiles.sourceProfileId), isNull(schoolMoveProfiles.appliedAt),
    ))
    .orderBy(desc(schoolMoveProfiles.createdAt))
    .for('update');
  for (const row of rows) {
    if (!byStudent.has(row.studentId)) byStudent.set(row.studentId, { ...row, sourceProfileId: row.sourceProfileId! });
  }
  return byStudent;
};

const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null);
const date = (value: string | null) => (value ? new Date(value) : null);

const profileState = {
  id: studentProfiles.id, classroomId: studentProfiles.classroomId,
  xp: studentProfiles.xp, gp: studentProfiles.gp, hp: studentProfiles.hp, level: studentProfiles.level, restingSince: studentProfiles.restingSince,
  characterName: studentProfiles.characterName, characterClass: studentProfiles.characterClass, characterClassId: studentProfiles.characterClassId,
  avatarGender: studentProfiles.avatarGender, avatarGiftAt: studentProfiles.avatarGiftAt,
  shopGoalItemId: studentProfiles.shopGoalItemId, shopGoalKind: studentProfiles.shopGoalKind,
  homeSeenAt: studentProfiles.homeSeenAt, celebratedAt: studentProfiles.celebratedAt,
};

/** Avatar: lo que tiene puesto el origen reemplaza lo del destino y sus prendas compradas se suman (sin repetir). Ids añadidos. */
const copyAvatar = async (tx: Tx, sourceId: string, targetId: string, now: Date) => {
  const equipped = await tx.select({ avatarItemId: studentEquippedItems.avatarItemId, slot: studentEquippedItems.slot }).from(studentEquippedItems)
    .where(eq(studentEquippedItems.studentProfileId, sourceId));
  await tx.delete(studentEquippedItems).where(eq(studentEquippedItems.studentProfileId, targetId));
  if (equipped.length > 0) {
    await tx.insert(studentEquippedItems).values(equipped.map((e) => ({ id: uuidv4(), studentProfileId: targetId, avatarItemId: e.avatarItemId, slot: e.slot, equippedAt: now })));
  }
  const [bought, owned] = await Promise.all([
    tx.select({
      avatarItemId: studentAvatarPurchases.avatarItemId, classroomId: studentAvatarPurchases.classroomId,
      pricePaid: studentAvatarPurchases.pricePaid, purchasedAt: studentAvatarPurchases.purchasedAt,
    }).from(studentAvatarPurchases).where(eq(studentAvatarPurchases.studentProfileId, sourceId)),
    tx.select({ avatarItemId: studentAvatarPurchases.avatarItemId }).from(studentAvatarPurchases).where(eq(studentAvatarPurchases.studentProfileId, targetId)),
  ]);
  const ownedItems = new Set(owned.map((o) => o.avatarItemId));
  const rows = bought.filter((p) => !ownedItems.has(p.avatarItemId)).map((p) => ({ id: uuidv4(), studentProfileId: targetId, ...p }));
  for (let i = 0; i < rows.length; i += 200) await tx.insert(studentAvatarPurchases).values(rows.slice(i, i + 200));
  return rows.map((r) => r.id);
};

/** Familia: los vínculos activos de los perfiles de origen (cada familia una vez); entran en vivo a la sala. Ids añadidos. */
const copyFamily = async (tx: Tx, sourceIds: string[], targetId: string, classroomId: string, effects: CarryEffects, now: Date) => {
  if (sourceIds.length === 0) return [];
  const [links, linked] = await Promise.all([
    tx.select({ parentProfileId: parentStudentLinks.parentProfileId, linkCode: parentStudentLinks.linkCode, parentUserId: parentProfiles.userId })
      .from(parentStudentLinks)
      .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
      .where(and(inArray(parentStudentLinks.studentProfileId, sourceIds), eq(parentStudentLinks.status, 'ACTIVE'))),
    tx.select({ parentProfileId: parentStudentLinks.parentProfileId }).from(parentStudentLinks).where(eq(parentStudentLinks.studentProfileId, targetId)),
  ]);
  const seen = new Set(linked.map((l) => l.parentProfileId));
  const fresh = links.filter((l) => !seen.has(l.parentProfileId) && seen.add(l.parentProfileId));
  const rows = fresh.map((l) => ({
    id: uuidv4(), parentProfileId: l.parentProfileId, studentProfileId: targetId, status: 'ACTIVE' as const,
    linkCode: l.linkCode, linkedAt: now, createdAt: now, updatedAt: now,
  }));
  if (rows.length > 0) await tx.insert(parentStudentLinks).values(rows);
  for (const l of fresh) effects.familyJoins.push({ parentUserId: l.parentUserId, classroomId });
  return rows.map((r) => r.id);
};

/**
 * Temporada nueva (de un año a otro, decisión del dueño): de los perfiles del año anterior (el último cerrado) viajan el
 * avatar y sus prendas, los de su clase de la misma área (si el área es nueva, los de su clase más reciente), su nombre de
 * héroe y la familia de todos ellos. XP, nivel, oro, Energía, insignias, cartas, clan y rachas empiezan de cero.
 */
export const seasonArrivals = async (tx: Tx, input: {
  schoolId: string; yearId: string; classroomId: string; areaId: string | null; arrivals: Array<{ studentId: string; profileId: string }>;
}, effects: CarryEffects, now: Date) => {
  if (input.arrivals.length === 0) return 0;
  const [year] = await tx.select({ name: schoolYears.name }).from(schoolYears).where(eq(schoolYears.id, input.yearId));
  if (!year) return 0;
  const [previous] = await tx.select({ id: schoolYears.id }).from(schoolYears)
    .where(and(eq(schoolYears.schoolId, input.schoolId), eq(schoolYears.status, 'CLOSED'), lt(schoolYears.name, year.name)))
    .orderBy(desc(schoolYears.name)).limit(1);
  if (!previous) return 0;
  const previousClasses = await yearClassroomIds(previous.id);
  if (previousClasses.length === 0) return 0;
  const candidates = await tx.select({
    id: studentProfiles.id, studentId: studentProfiles.schoolStudentId, updatedAt: studentProfiles.updatedAt,
    characterName: studentProfiles.characterName, avatarGender: studentProfiles.avatarGender,
    byAssignment: schoolTeachingAssignments.areaId, byWorkshop: schoolWorkshops.areaId, ofClass: classrooms.curriculumAreaId,
  }).from(studentProfiles)
    .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
    .leftJoin(schoolTeachingAssignments, eq(schoolTeachingAssignments.classroomId, classrooms.id))
    .leftJoin(schoolWorkshops, eq(schoolWorkshops.classroomId, classrooms.id))
    .where(and(
      inArray(studentProfiles.schoolStudentId, [...new Set(input.arrivals.map((a) => a.studentId))]),
      inArray(studentProfiles.classroomId, previousClasses), eq(studentProfiles.isDemo, false),
    ));
  let carried = 0;
  for (const arrival of input.arrivals) {
    const own = candidates.filter((c) => c.studentId === arrival.studentId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    if (own.length === 0) continue;
    const source = (input.areaId ? own.find((c) => (c.byAssignment ?? c.byWorkshop ?? c.ofClass) === input.areaId) : undefined) ?? own[0];
    await tx.update(studentProfiles).set({
      avatarGender: source.avatarGender,
      ...(source.characterName ? { characterName: source.characterName } : {}),
      updatedAt: now,
    }).where(eq(studentProfiles.id, arrival.profileId));
    await copyAvatar(tx, source.id, arrival.profileId, now);
    await copyFamily(tx, own.map((c) => c.id), arrival.profileId, input.classroomId, effects, now);
    carried++;
  }
  return carried;
};

/**
 * Lleva el progreso de un perfil de origen a su destino (recién creado o que volvió a activarse) y cierra el pendiente.
 * Si el destino volvió, guarda cómo estaba para poder deshacer.
 */
export const applyCarry = async (
  tx: Tx,
  carry: PendingCarry,
  target: { profileId: string; classroomId: string; reactivated: boolean },
  effects: CarryEffects,
  now: Date,
) => {
  const [current] = await tx.select(profileState).from(studentProfiles).where(eq(studentProfiles.id, target.profileId));
  if (!current) return;
  const close = (values: Partial<typeof schoolMoveProfiles.$inferInsert>) => tx.update(schoolMoveProfiles)
    .set({ targetProfileId: target.profileId, targetReactivated: target.reactivated, appliedAt: now, ...values })
    .where(eq(schoolMoveProfiles.id, carry.id));
  const asIs = () => close({ targetXp: current.xp, targetGp: current.gp, snapshot: target.reactivated ? { reactivatedOnly: true } : null });

  // Vuelve a su propia clase (iba y venía sin que esa clase cambiara): nada que llevar.
  if (carry.sourceProfileId === target.profileId) return asIs();
  const [source] = await tx.select(profileState).from(studentProfiles).where(eq(studentProfiles.id, carry.sourceProfileId));
  if (!source) return asIs();
  const [a, b] = await Promise.all([classEconomy(source.classroomId), classEconomy(target.classroomId)]);
  if (!a || !b) return asIs();
  const converted = convertProgress(source, a, b);

  // Su clase de personaje: la del mismo tipo en la clase nueva, si existe.
  let characterClassId = current.characterClassId;
  if (source.characterClassId) {
    const [kind] = await tx.select({ key: classroomCharacterClasses.key }).from(classroomCharacterClasses)
      .where(eq(classroomCharacterClasses.id, source.characterClassId));
    const [same] = kind
      ? await tx.select({ id: classroomCharacterClasses.id }).from(classroomCharacterClasses)
        .where(and(eq(classroomCharacterClasses.classroomId, target.classroomId), eq(classroomCharacterClasses.key, kind.key))).limit(1)
      : [];
    if (same) characterClassId = same.id;
  }

  const equippedBefore = target.reactivated
    ? await tx.select({ avatarItemId: studentEquippedItems.avatarItemId, slot: studentEquippedItems.slot }).from(studentEquippedItems)
      .where(eq(studentEquippedItems.studentProfileId, target.profileId))
    : [];
  await tx.update(studentProfiles).set({
    xp: converted.xp, gp: converted.gp, level: converted.level, hp: b.maxHp, restingSince: null,
    characterName: source.characterName || current.characterName,
    characterClass: source.characterClass, characterClassId,
    avatarGender: source.avatarGender, avatarGiftAt: source.avatarGiftAt,
    // La meta de una prenda viaja; la de un premio es de la tienda de su clase anterior.
    ...(source.shopGoalKind === 'AVATAR' ? { shopGoalKind: 'AVATAR' as const, shopGoalItemId: source.shopGoalItemId } : {}),
    // Lo traído no es «nuevo»: sin celebraciones ni «Lo nuevo» por lo que ya tenía.
    homeSeenAt: now, celebratedAt: now, updatedAt: now,
  }).where(eq(studentProfiles.id, target.profileId));

  // Avatar: lo que tiene puesto y lo que compró (sin repetir prendas).
  const addedPurchaseIds = await copyAvatar(tx, source.id, target.profileId, now);

  // Insignias «traídas de…»: cada copia apunta a su original y no se repite la que ya tiene.
  const [badges, mine] = await Promise.all([
    tx.select({ id: studentBadges.id, badgeId: studentBadges.badgeId, unlockedAt: studentBadges.unlockedAt, isDisplayed: studentBadges.isDisplayed, originBadgeId: studentBadges.originBadgeId })
      .from(studentBadges).where(eq(studentBadges.studentProfileId, source.id)),
    tx.select({ id: studentBadges.id, originBadgeId: studentBadges.originBadgeId }).from(studentBadges).where(eq(studentBadges.studentProfileId, target.profileId)),
  ]);
  const roots = new Set(mine.map((m) => m.originBadgeId ?? m.id));
  const reason = `Traída de ${carry.sourceLabel || 'otra sección'}`.slice(0, 255);
  const badgeRows = badges.filter((x) => !roots.has(x.originBadgeId ?? x.id)).map((x) => ({
    id: uuidv4(), studentProfileId: target.profileId, badgeId: x.badgeId, unlockedAt: x.unlockedAt,
    awardedBy: null, awardReason: reason, isDisplayed: x.isDisplayed, originBadgeId: x.originBadgeId ?? x.id,
  }));
  for (let i = 0; i < badgeRows.length; i += 200) await tx.insert(studentBadges).values(badgeRows.slice(i, i + 200));

  // La familia: los mismos vínculos activos.
  const addedLinkIds = await copyFamily(tx, [source.id], target.profileId, target.classroomId, effects, now);

  const snapshot: MoveTargetSnapshot | null = target.reactivated
    ? {
      xp: current.xp, gp: current.gp, hp: current.hp, level: current.level, restingSince: iso(current.restingSince),
      characterName: current.characterName, characterClass: current.characterClass, characterClassId: current.characterClassId,
      avatarGender: current.avatarGender, avatarGiftAt: iso(current.avatarGiftAt),
      shopGoalItemId: current.shopGoalItemId, shopGoalKind: current.shopGoalKind,
      homeSeenAt: iso(current.homeSeenAt), celebratedAt: iso(current.celebratedAt),
      equipped: equippedBefore,
      addedPurchaseIds, addedBadgeIds: badgeRows.map((r) => r.id), addedLinkIds,
    }
    : null;
  await close({ targetXp: converted.xp, targetGp: converted.gp, snapshot });
};

/** Deshacer en un destino que volvió a activarse: su estado de antes, sin lo copiado, e inactivo otra vez. */
export const restoreTarget = async (tx: Tx, profileId: string, snapshot: MoveTargetSnapshot | { reactivatedOnly: true } | null, now: Date) => {
  if (!snapshot || 'reactivatedOnly' in snapshot) {
    await tx.update(studentProfiles).set({ isActive: false, updatedAt: now }).where(eq(studentProfiles.id, profileId));
    return;
  }
  await tx.update(studentProfiles).set({
    xp: snapshot.xp, gp: snapshot.gp, hp: snapshot.hp, level: snapshot.level, restingSince: date(snapshot.restingSince),
    characterName: snapshot.characterName, characterClass: snapshot.characterClass as typeof studentProfiles.$inferInsert.characterClass,
    characterClassId: snapshot.characterClassId, avatarGender: snapshot.avatarGender, avatarGiftAt: date(snapshot.avatarGiftAt),
    shopGoalItemId: snapshot.shopGoalItemId, shopGoalKind: snapshot.shopGoalKind,
    homeSeenAt: date(snapshot.homeSeenAt), celebratedAt: date(snapshot.celebratedAt),
    isActive: false, updatedAt: now,
  }).where(eq(studentProfiles.id, profileId));
  await tx.delete(studentEquippedItems).where(eq(studentEquippedItems.studentProfileId, profileId));
  if (snapshot.equipped.length > 0) {
    await tx.insert(studentEquippedItems).values(snapshot.equipped.map((e) => ({
      id: uuidv4(), studentProfileId: profileId, avatarItemId: e.avatarItemId, slot: e.slot as typeof studentEquippedItems.$inferInsert.slot, equippedAt: now,
    })));
  }
  if (snapshot.addedPurchaseIds.length) await tx.delete(studentAvatarPurchases).where(inArray(studentAvatarPurchases.id, snapshot.addedPurchaseIds));
  if (snapshot.addedBadgeIds.length) await tx.delete(studentBadges).where(inArray(studentBadges.id, snapshot.addedBadgeIds));
  if (snapshot.addedLinkIds.length) await tx.delete(parentStudentLinks).where(inArray(parentStudentLinks.id, snapshot.addedLinkIds));
};

/** Deshacer en un destino creado por el traslado (sin uso, lo comprobó quien llama): se borra con todo lo suyo. */
export const purgeTarget = async (tx: Tx, profile: { id: string; userId: string | null; classroomId: string }) => {
  // La asistencia tiene llave foránea al perfil: primero.
  await tx.delete(attendanceRecords).where(eq(attendanceRecords.studentProfileId, profile.id));
  await tx.delete(gradeEvaluationScores).where(eq(gradeEvaluationScores.studentProfileId, profile.id));
  await tx.delete(parentStudentLinks).where(eq(parentStudentLinks.studentProfileId, profile.id));
  await tx.delete(schoolAutoProfiles).where(eq(schoolAutoProfiles.profileId, profile.id));
  await deleteStudentProfileData(tx, profile);
};
