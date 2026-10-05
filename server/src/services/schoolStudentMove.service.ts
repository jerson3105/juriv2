import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, ne, notInArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  attendanceRecords, classrooms, curriculumAreas, gradeEvaluationScores, parentProfiles, parentStudentLinks, pointLogs, purchases,
  schoolAutoProfiles, schoolEnrollments, schoolMoveProfiles, schoolSections, schoolStudentMoves, schoolStudents,
  schoolTeachingAssignments, schoolWorkshops, schoolWorkshopSections, schoolWorkshopStudents, schoolYears, studentBadges, studentGrades,
  studentProfiles, users, type MoveTargetSnapshot,
} from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { familyRoomService } from './familyRoom.service.js';
import { runCarryEffects, schoolAutoEnrollService } from './schoolAutoEnroll.service.js';
import { classEconomy, convertProgress, newEffects, purgeTarget, restoreTarget, type ClassEconomy, type Tx } from './schoolCarry.service.js';
import { closedYearClassroomIds } from './schoolCalendar.service.js';
import { insertEvent, loadYear } from './schoolRoster.service.js';
import { sectionDisplayName } from './schoolSection.service.js';

/**
 * Traslados, retiros y reincorporaciones (baja blanda). Trasladar cambia la sección y, en la misma transacción, la
 * matrícula automática lo pone en las clases nuevas con su progreso convertido; las de su sección anterior quedan
 * inactivas con su historial. Retirar deja inactivos todos sus perfiles; reincorporar los recupera (o los lleva a otra
 * sección como un traslado). Un traslado se deshace mientras no reciba puntos ni notas en su sección nueva.
 */

export const TRANSFER_REASONS = ['FAMILY', 'COEXISTENCE', 'ACADEMIC', 'SCHEDULE', 'BALANCE', 'OTHER'] as const;
export const WITHDRAWAL_REASONS = ['SCHOOL_CHANGE', 'MOVING', 'ECONOMIC', 'HEALTH', 'OTHER'] as const;
export type TransferReason = (typeof TRANSFER_REASONS)[number];
export type WithdrawalReason = (typeof WITHDRAWAL_REASONS)[number];

type Executor = Pick<typeof db, 'select' | 'selectDistinct'>;
const tutors = alias(users, 'tutor');
const actors = alias(users, 'actor');

const loadStudent = async (executor: Executor, schoolId: string, studentId: string) => {
  const [student] = await executor.select({ id: schoolStudents.id, firstNames: schoolStudents.firstNames, lastNames: schoolStudents.lastNames, status: schoolStudents.status })
    .from(schoolStudents).where(and(eq(schoolStudents.id, studentId), eq(schoolStudents.schoolId, schoolId)));
  if (!student) throw new NotFoundError('Estudiante no encontrado');
  return student;
};

const sectionInfo = async (executor: Executor, schoolId: string, yearId: string, sectionId: string) => {
  const [section] = await executor.select({
    id: schoolSections.id, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name,
    tutorFirstName: tutors.firstName, tutorLastName: tutors.lastName,
  }).from(schoolSections)
    .leftJoin(tutors, eq(tutors.id, schoolSections.tutorUserId))
    .where(and(eq(schoolSections.id, sectionId), eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId)));
  if (!section) return null;
  return {
    id: section.id,
    label: sectionDisplayName(section.level, section.grade, section.name),
    tutor: section.tutorFirstName ? `${section.tutorFirstName} ${section.tutorLastName ?? ''}`.trim() : null,
  };
};

/** Clases vinculadas a una sección: las de sus áreas (con su área) y las de sus talleres de toda la sección. */
const sectionClasses = async (executor: Executor, sectionId: string) => {
  const [areas, workshops] = await Promise.all([
    executor.select({ classroomId: schoolTeachingAssignments.classroomId, areaId: schoolTeachingAssignments.areaId })
      .from(schoolTeachingAssignments)
      .where(and(eq(schoolTeachingAssignments.sectionId, sectionId), isNotNull(schoolTeachingAssignments.classroomId))),
    executor.select({ workshopId: schoolWorkshops.id, classroomId: schoolWorkshops.classroomId, name: schoolWorkshops.name })
      .from(schoolWorkshops)
      .innerJoin(schoolWorkshopSections, eq(schoolWorkshopSections.workshopId, schoolWorkshops.id))
      .where(and(eq(schoolWorkshopSections.sectionId, sectionId), eq(schoolWorkshops.mode, 'SECTION'), isNotNull(schoolWorkshops.classroomId))),
  ]);
  return {
    areas: areas.map((a) => ({ classroomId: a.classroomId!, areaId: a.areaId })),
    workshops: workshops.map((w) => ({ workshopId: w.workshopId, classroomId: w.classroomId!, name: w.name })),
  };
};

/** De una sección a otra: de qué clases sale (las de su sección y sus talleres que no siguen) y a cuáles entra. */
const transferClasses = async (executor: Executor, fromSectionId: string, toSectionId: string) => {
  const [from, to] = await Promise.all([sectionClasses(executor, fromSectionId), sectionClasses(executor, toSectionId)]);
  const sharedWorkshops = new Set(to.workshops.map((w) => w.workshopId).filter((id) => from.workshops.some((f) => f.workshopId === id)));
  const leavingWorkshops = from.workshops.filter((w) => !sharedWorkshops.has(w.workshopId));
  const enteringWorkshops = to.workshops.filter((w) => !sharedWorkshops.has(w.workshopId));
  return {
    fromAreas: from.areas,
    toAreas: to.areas,
    leavingWorkshops,
    enteringWorkshops,
    sourceClassIds: [...from.areas.map((a) => a.classroomId), ...leavingWorkshops.map((w) => w.classroomId)],
    targetClassIds: [...to.areas.map((a) => a.classroomId), ...enteringWorkshops.map((w) => w.classroomId)],
  };
};

/** Sus perfiles activos en esas clases. */
const activeProfilesIn = (executor: Executor, studentId: string, classroomIds: string[]) => (classroomIds.length === 0
  ? Promise.resolve([])
  : executor.select({ id: studentProfiles.id, userId: studentProfiles.userId, classroomId: studentProfiles.classroomId, xp: studentProfiles.xp, gp: studentProfiles.gp, level: studentProfiles.level })
    .from(studentProfiles)
    .where(and(eq(studentProfiles.schoolStudentId, studentId), inArray(studentProfiles.classroomId, classroomIds), eq(studentProfiles.isActive, true))));

/** Compras pendientes de esos perfiles (o que ellos regalan): se rechazan. Aún no cobraron nada. */
const rejectPendingPurchases = async (tx: Tx, profileIds: string[]) => {
  if (profileIds.length === 0) return;
  await tx.update(purchases).set({ status: 'REJECTED' })
    .where(and(eq(purchases.status, 'PENDING'), or(inArray(purchases.studentId, profileIds), inArray(purchases.buyerId, profileIds))));
};

/** Familias vinculadas a esos perfiles: salen en vivo de la sala de su clase si ya no tienen ahí a nadie activo. */
const leaveFamilyRooms = async (profileIds: string[]) => {
  if (profileIds.length === 0) return;
  const rows = await db.selectDistinct({ parentUserId: parentProfiles.userId, classroomId: studentProfiles.classroomId })
    .from(parentStudentLinks)
    .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
    .innerJoin(studentProfiles, eq(studentProfiles.id, parentStudentLinks.studentProfileId))
    .where(and(inArray(parentStudentLinks.studentProfileId, profileIds), eq(parentStudentLinks.status, 'ACTIVE')));
  for (const row of rows) await familyRoomService.removeParentIfUnlinked(row.parentUserId, row.classroomId);
};

const joinFamilyRooms = async (profileIds: string[]) => {
  if (profileIds.length === 0) return;
  const rows = await db.selectDistinct({ parentUserId: parentProfiles.userId, classroomId: studentProfiles.classroomId })
    .from(parentStudentLinks)
    .innerJoin(parentProfiles, eq(parentProfiles.id, parentStudentLinks.parentProfileId))
    .innerJoin(studentProfiles, eq(studentProfiles.id, parentStudentLinks.studentProfileId))
    .where(and(inArray(parentStudentLinks.studentProfileId, profileIds), eq(parentStudentLinks.status, 'ACTIVE'), eq(studentProfiles.isActive, true)));
  for (const row of rows) familyRoomService.joinParentToRoom(row.parentUserId, row.classroomId);
};

const lockEnrollment = async (tx: Tx, yearId: string, studentId: string) => {
  const [enrollment] = await tx.select().from(schoolEnrollments)
    .where(and(eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.studentId, studentId))).for('update');
  return enrollment ?? null;
};

/** Último movimiento vigente (sin deshacer) del estudiante en la escuela. */
const latestMove = async (executor: Executor, schoolId: string, studentId: string) => {
  const [move] = await executor.select().from(schoolStudentMoves)
    .where(and(eq(schoolStudentMoves.schoolId, schoolId), eq(schoolStudentMoves.studentId, studentId), isNull(schoolStudentMoves.undoneAt)))
    .orderBy(desc(schoolStudentMoves.createdAt))
    .limit(1);
  return move ?? null;
};

type UndoTarget = { id: string; userId: string | null; classroomId: string; restore: MoveTargetSnapshot | { reactivatedOnly: true } | null; purge: boolean };

/**
 * ¿Se puede deshacer este traslado? Sus destinos son los perfiles activos en las clases de la sección nueva: los que
 * creó (se borran) o recuperó (vuelven a como estaban). Se bloquea si alguno ya recibió puntos, notas, asistencia,
 * insignias o compras desde el traslado, o si tenía esa clase desde antes.
 */
const inspectUndo = async (executor: Executor, move: typeof schoolStudentMoves.$inferSelect, toLabel: string) => {
  const { targetClassIds } = await transferClasses(executor, move.fromSectionId!, move.toSectionId!);
  const current = await activeProfilesIn(executor, move.studentId, targetClassIds);
  if (current.length === 0) return { targets: [] as UndoTarget[], blocked: null as string | null };
  const ids = current.map((p) => p.id);
  const [rows, autos] = await Promise.all([
    executor.select().from(schoolMoveProfiles).where(inArray(schoolMoveProfiles.targetProfileId, ids)).orderBy(desc(schoolMoveProfiles.appliedAt)),
    executor.select().from(schoolAutoProfiles).where(and(inArray(schoolAutoProfiles.profileId, ids), eq(schoolAutoProfiles.kind, 'CREATED'))),
  ]);
  const rowOf = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (row.targetProfileId && !rowOf.has(row.targetProfileId)) rowOf.set(row.targetProfileId, row);
  const autoOf = new Map(autos.map((a) => [a.profileId, a]));

  const targets: UndoTarget[] = [];
  const baseline = new Map<string, { xp: number | null; gp: number | null }>();
  for (const p of current) {
    const row = rowOf.get(p.id);
    const auto = autoOf.get(p.id);
    if (row) {
      targets.push({ id: p.id, userId: p.userId, classroomId: p.classroomId, restore: row.targetReactivated ? (row.snapshot ?? { reactivatedOnly: true }) : null, purge: !row.targetReactivated });
      baseline.set(p.id, { xp: row.targetXp, gp: row.targetGp });
    } else if (auto && new Date(auto.createdAt).getTime() >= new Date(move.createdAt).getTime()) {
      targets.push({ id: p.id, userId: p.userId, classroomId: p.classroomId, restore: null, purge: true });
      baseline.set(p.id, { xp: auto.initialXp, gp: auto.initialGp });
    } else {
      return { targets, blocked: `Ya estaba en una clase de ${toLabel} desde antes del traslado: no se puede deshacer` };
    }
  }

  const since = move.createdAt;
  const used = new Set<string>();
  for (const p of current) {
    const base = baseline.get(p.id);
    if (base && ((base.xp !== null && base.xp !== p.xp) || (base.gp !== null && base.gp !== p.gp))) used.add(p.id);
  }
  const activity = await Promise.all([
    executor.selectDistinct({ id: pointLogs.studentId }).from(pointLogs).where(and(inArray(pointLogs.studentId, ids), gte(pointLogs.createdAt, since))),
    executor.selectDistinct({ id: attendanceRecords.studentProfileId }).from(attendanceRecords).where(and(inArray(attendanceRecords.studentProfileId, ids), gte(attendanceRecords.createdAt, since))),
    executor.selectDistinct({ id: studentGrades.studentProfileId }).from(studentGrades)
      .where(and(inArray(studentGrades.studentProfileId, ids), gte(studentGrades.updatedAt, since), or(sql`${studentGrades.activitiesCount} > 0`, eq(studentGrades.isManualOverride, true)))),
    executor.selectDistinct({ id: gradeEvaluationScores.studentProfileId }).from(gradeEvaluationScores).where(and(inArray(gradeEvaluationScores.studentProfileId, ids), gte(gradeEvaluationScores.updatedAt, since))),
    executor.selectDistinct({ id: studentBadges.studentProfileId }).from(studentBadges)
      .where(and(inArray(studentBadges.studentProfileId, ids), isNull(studentBadges.originBadgeId), gte(studentBadges.unlockedAt, since))),
    executor.selectDistinct({ id: purchases.studentId }).from(purchases).where(and(inArray(purchases.studentId, ids), gte(purchases.purchasedAt, since))),
    executor.selectDistinct({ id: purchases.buyerId }).from(purchases).where(and(inArray(purchases.buyerId, ids), gte(purchases.purchasedAt, since))),
  ]);
  for (const list of activity) for (const r of list) if (r.id) used.add(r.id);
  if (used.size > 0) return { targets, blocked: `Ya recibió puntos o notas en ${toLabel}: ya no se puede deshacer` };
  return { targets, blocked: null };
};

const isRealDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

const cleanNote = (note: string | null | undefined) => {
  const value = (note ?? '').replace(/\s+/g, ' ').trim();
  return value ? value.slice(0, 255) : null;
};

export const schoolStudentMoveService = {
  /** «Qué cambia»: de qué clases sale, a cuáles entra y cómo queda su progreso en cada área. */
  async preview(schoolId: string, yearId: string, studentId: string, toSectionId: string) {
    await loadYear(schoolId, yearId, true);
    const student = await loadStudent(db, schoolId, studentId);
    if (student.status === 'WITHDRAWN') throw new ConflictError('Está retirado: para que vuelva usa «Reincorporar»');
    const [enrollment] = await db.select().from(schoolEnrollments).where(and(eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.studentId, studentId)));
    if (!enrollment || enrollment.status !== 'ACTIVE' || !enrollment.sectionId) throw new ConflictError('Aún no tiene sección este año: asígnale una desde su ficha');
    if (enrollment.sectionId === toSectionId) throw new ValidationError('Ya está en esa sección');
    const [from, to] = await Promise.all([sectionInfo(db, schoolId, yearId, enrollment.sectionId), sectionInfo(db, schoolId, yearId, toSectionId)]);
    if (!from || !to) throw new ValidationError('Esa sección no es de este año escolar');

    const plan = await transferClasses(db, enrollment.sectionId, toSectionId);
    const profiles = await activeProfilesIn(db, studentId, plan.sourceClassIds);
    const profileOf = new Map(profiles.map((p) => [p.classroomId, p]));
    const classIds = [...new Set([...plan.sourceClassIds, ...plan.targetClassIds])];
    const areaIds = [...new Set([...plan.fromAreas, ...plan.toAreas].map((a) => a.areaId))];
    const [classRows, areaRows, [toCount], badgeRows, familyRows] = await Promise.all([
      classIds.length ? db.select({ id: classrooms.id, name: classrooms.name }).from(classrooms).where(inArray(classrooms.id, classIds)) : Promise.resolve([]),
      areaIds.length ? db.select({ id: curriculumAreas.id, name: curriculumAreas.name, order: curriculumAreas.displayOrder }).from(curriculumAreas).where(inArray(curriculumAreas.id, areaIds)) : Promise.resolve([]),
      db.select({ n: count() }).from(schoolEnrollments).where(and(eq(schoolEnrollments.sectionId, toSectionId), eq(schoolEnrollments.status, 'ACTIVE'))),
      profiles.length ? db.select({ n: count() }).from(studentBadges).where(inArray(studentBadges.studentProfileId, profiles.map((p) => p.id))) : Promise.resolve([{ n: 0 }]),
      profiles.length
        ? db.selectDistinct({ id: parentStudentLinks.parentProfileId }).from(parentStudentLinks)
          .where(and(inArray(parentStudentLinks.studentProfileId, profiles.map((p) => p.id)), eq(parentStudentLinks.status, 'ACTIVE')))
        : Promise.resolve([]),
    ]);
    const className = new Map(classRows.map((c) => [c.id, c.name]));
    const area = new Map(areaRows.map((a) => [a.id, a]));
    const economies = new Map<string, ClassEconomy | null>();
    await Promise.all(classIds.map(async (id) => economies.set(id, await classEconomy(id))));

    const rows = plan.fromAreas
      .filter((a) => profileOf.has(a.classroomId))
      .map((a) => {
        const p = profileOf.get(a.classroomId)!;
        const destination = plan.toAreas.find((d) => d.areaId === a.areaId);
        const ea = economies.get(a.classroomId);
        const eb = destination ? economies.get(destination.classroomId) : null;
        const converted = destination && ea && eb ? convertProgress(p, ea, eb) : null;
        return {
          areaId: a.areaId,
          areaName: area.get(a.areaId)?.name ?? 'Área',
          order: area.get(a.areaId)?.order ?? 0,
          from: { classroomName: className.get(a.classroomId) ?? '', level: p.level, xp: p.xp, gp: p.gp },
          to: destination
            ? {
              classroomName: className.get(destination.classroomId) ?? '',
              level: converted?.level ?? p.level, xp: converted?.xp ?? p.xp, gp: converted?.gp ?? p.gp,
              same: !converted || (converted.xp === p.xp && converted.gp === p.gp),
            }
            : null,
        };
      })
      .sort((x, y) => x.order - y.order || x.areaName.localeCompare(y.areaName, 'es'));

    return {
      student: { id: student.id, name: `${student.firstNames} ${student.lastNames}`.trim() },
      from: { id: from.id, label: from.label },
      to: { id: to.id, label: to.label, tutor: to.tutor, students: Number(toCount?.n ?? 0) },
      classes: { leaving: profiles.length, entering: plan.targetClassIds.length },
      areas: rows.map(({ order: _order, ...row }) => row),
      waiting: rows.filter((r) => !r.to).map((r) => r.areaName),
      workshops: {
        leaving: plan.leavingWorkshops.filter((w) => profileOf.has(w.classroomId)).map((w) => w.name),
        entering: plan.enteringWorkshops.map((w) => w.name),
      },
      badges: Number(badgeRows[0]?.n ?? 0),
      families: familyRows.length,
    };
  },

  async transfer(schoolId: string, yearId: string, studentId: string, actorId: string, input: { sectionId: string; effectiveDate: string; reason: TransferReason; note?: string | null }) {
    await loadYear(schoolId, yearId, true);
    if (!TRANSFER_REASONS.includes(input.reason)) throw new ValidationError('Elige el motivo del traslado');
    if (!isRealDate(input.effectiveDate)) throw new ValidationError('Revisa la fecha');
    const to = await sectionInfo(db, schoolId, yearId, input.sectionId);
    if (!to) throw new ValidationError('Esa sección no es de este año escolar');
    const now = new Date();
    const moveId = uuidv4();
    const effects = newEffects();
    let sourceIds: string[] = [];
    await db.transaction(async (tx) => {
      const enrollment = await lockEnrollment(tx, yearId, studentId);
      const student = await loadStudent(tx, schoolId, studentId);
      if (student.status === 'WITHDRAWN') throw new ConflictError('Está retirado: para que vuelva usa «Reincorporar»');
      if (!enrollment || enrollment.status !== 'ACTIVE' || !enrollment.sectionId) throw new ConflictError('Aún no tiene sección este año: asígnale una desde su ficha');
      if (enrollment.sectionId === input.sectionId) throw new ValidationError('Ya está en esa sección');
      const fromSectionId = enrollment.sectionId;
      const from = await sectionInfo(tx, schoolId, yearId, fromSectionId);
      const plan = await transferClasses(tx, fromSectionId, input.sectionId);
      const sources = await activeProfilesIn(tx, studentId, plan.sourceClassIds);
      sourceIds = sources.map((p) => p.id);
      await rejectPendingPurchases(tx, sourceIds);

      await tx.insert(schoolStudentMoves).values({
        id: moveId, schoolId, yearId, studentId, kind: 'TRANSFER', fromSectionId, toSectionId: input.sectionId,
        reason: input.reason, note: cleanNote(input.note), effectiveDate: input.effectiveDate, actorUserId: actorId, createdAt: now,
      });
      // Cada clase de un área deja su progreso esperando a la clase de esa área en la sección nueva; los talleres no.
      const areaOf = new Map(plan.fromAreas.map((a) => [a.classroomId, a.areaId]));
      if (sources.length > 0) {
        await tx.insert(schoolMoveProfiles).values(sources.map((p) => ({
          id: uuidv4(), moveId, schoolId, studentId, areaId: areaOf.get(p.classroomId) ?? null,
          sourceProfileId: p.id, sourceLabel: from?.label ?? null, appliedAt: areaOf.has(p.classroomId) ? null : now, createdAt: now,
        })));
      }
      await tx.update(schoolEnrollments).set({ sectionId: input.sectionId, updatedAt: now }).where(eq(schoolEnrollments.id, enrollment.id));
      await insertEvent(tx, {
        schoolId, studentId, yearId, type: 'SECTION_CHANGED', fromSectionId, toSectionId: input.sectionId, actorUserId: actorId,
        metadata: { transfer: true, moveId, reason: input.reason },
      });
      // Primero las clases nuevas (con lo que trae), después las anteriores quedan inactivas. Orden fijo: sin bloqueos cruzados.
      for (const classroomId of [...plan.targetClassIds].sort()) {
        await schoolAutoEnrollService.syncClassroomIn(tx, { schoolId, yearId, classroomId, studentIds: [studentId] }, { moveId, effects });
      }
      if (sourceIds.length > 0) await tx.update(studentProfiles).set({ isActive: false, updatedAt: now }).where(inArray(studentProfiles.id, sourceIds));
    });
    runCarryEffects(effects);
    await leaveFamilyRooms(sourceIds);
    return { moveId, sections: sourceIds.length };
  },

  /** Estado de «Deshacer» del último traslado (para la ficha). null si su último movimiento no es un traslado. */
  async undoState(schoolId: string, yearId: string, studentId: string) {
    const move = await latestMove(db, schoolId, studentId);
    if (!move || move.kind !== 'TRANSFER' || move.yearId !== yearId) return null;
    const [enrollment] = await db.select().from(schoolEnrollments).where(and(eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.studentId, studentId)));
    const to = await sectionInfo(db, schoolId, yearId, move.toSectionId!);
    if (!enrollment || enrollment.status !== 'ACTIVE' || enrollment.sectionId !== move.toSectionId) {
      return { moveId: move.id, canUndo: false, blocked: 'Su matrícula cambió después del traslado' };
    }
    const { blocked } = await inspectUndo(db, move, to?.label ?? 'la sección nueva');
    return { moveId: move.id, canUndo: !blocked, blocked };
  },

  async undoTransfer(schoolId: string, yearId: string, studentId: string, actorId: string, moveId: string) {
    await loadYear(schoolId, yearId, true);
    const now = new Date();
    let reactivated: string[] = [];
    let removed: Array<{ id: string; classroomId: string }> = [];
    await db.transaction(async (tx) => {
      const [move] = await tx.select().from(schoolStudentMoves)
        .where(and(eq(schoolStudentMoves.id, moveId), eq(schoolStudentMoves.schoolId, schoolId), eq(schoolStudentMoves.studentId, studentId)))
        .for('update');
      if (!move || move.kind !== 'TRANSFER' || move.yearId !== yearId) throw new NotFoundError('Traslado no encontrado');
      if (move.undoneAt) throw new ConflictError('Ese traslado ya se deshizo');
      const enrollment = await lockEnrollment(tx, yearId, studentId);
      const latest = await latestMove(tx, schoolId, studentId);
      if (latest?.id !== move.id) throw new ConflictError('Solo se puede deshacer su último movimiento');
      if (!enrollment || enrollment.status !== 'ACTIVE' || enrollment.sectionId !== move.toSectionId) throw new ConflictError('Su matrícula cambió después del traslado');
      const to = await sectionInfo(tx, schoolId, yearId, move.toSectionId!);
      const { targets, blocked } = await inspectUndo(tx, move, to?.label ?? 'la sección nueva');
      if (blocked) throw new ConflictError(blocked);

      for (const target of targets) {
        if (target.purge) await purgeTarget(tx, target);
        else await restoreTarget(tx, target.id, target.restore, now);
      }
      removed = targets.map((t) => ({ id: t.id, classroomId: t.classroomId }));
      // Lo que otros traslados habían traído a estos destinos vuelve a esperar su clase.
      if (targets.length > 0) {
        await tx.update(schoolMoveProfiles)
          .set({ targetProfileId: null, targetReactivated: false, targetXp: null, targetGp: null, snapshot: null, appliedAt: null })
          .where(and(inArray(schoolMoveProfiles.targetProfileId, targets.map((t) => t.id)), ne(schoolMoveProfiles.moveId, move.id), isNotNull(schoolMoveProfiles.sourceProfileId)));
      }
      const sources = await tx.select({ id: schoolMoveProfiles.sourceProfileId }).from(schoolMoveProfiles)
        .where(and(eq(schoolMoveProfiles.moveId, move.id), isNotNull(schoolMoveProfiles.sourceProfileId)));
      reactivated = sources.map((s) => s.id!);
      if (reactivated.length > 0) {
        await tx.update(studentProfiles).set({ isActive: true, updatedAt: now })
          .where(and(inArray(studentProfiles.id, reactivated), eq(studentProfiles.isActive, false)));
      }
      await tx.delete(schoolMoveProfiles).where(eq(schoolMoveProfiles.moveId, move.id));
      await tx.update(schoolStudentMoves).set({ undoneAt: now, undoneBy: actorId }).where(eq(schoolStudentMoves.id, move.id));
      await tx.update(schoolEnrollments).set({ sectionId: move.fromSectionId, updatedAt: now }).where(eq(schoolEnrollments.id, enrollment.id));
      await insertEvent(tx, {
        schoolId, studentId, yearId, type: 'SECTION_CHANGED', fromSectionId: move.toSectionId, toSectionId: move.fromSectionId, actorUserId: actorId,
        metadata: { undo: true, moveId: move.id },
      });
    });
    // Las familias vuelven a las salas de sus clases de antes y salen de las nuevas; clases creadas mientras tanto, completas.
    await joinFamilyRooms(reactivated);
    if (removed.length > 0) {
      const parents = await db.selectDistinct({ userId: parentProfiles.userId }).from(parentProfiles)
        .innerJoin(parentStudentLinks, eq(parentStudentLinks.parentProfileId, parentProfiles.id))
        .innerJoin(studentProfiles, eq(studentProfiles.id, parentStudentLinks.studentProfileId))
        .where(eq(studentProfiles.schoolStudentId, studentId));
      for (const { classroomId } of removed) {
        for (const parent of parents) await familyRoomService.removeParentIfUnlinked(parent.userId, classroomId);
      }
    }
    await schoolAutoEnrollService.syncStudents(schoolId, yearId, [studentId]);
    return { reactivated: reactivated.length, removed: removed.length };
  },

  async withdraw(schoolId: string, yearId: string, studentId: string, actorId: string, input: { effectiveDate: string; reason: WithdrawalReason; note?: string | null }) {
    const year = await loadYear(schoolId, yearId, true);
    // El retiro saca al estudiante del colegio: se hace en el año en curso. Entre el cierre de un año y el inicio del
    // siguiente (vacaciones, sin año en curso), en el que se prepara.
    if (year.status !== 'ACTIVE') {
      const [active] = await db.select({ id: schoolYears.id }).from(schoolYears)
        .where(and(eq(schoolYears.schoolId, schoolId), eq(schoolYears.status, 'ACTIVE')));
      if (active) throw new ConflictError('El retiro se hace en el año en curso');
    }
    // Sus perfiles en clases de años cerrados quedan como estaban (son la historia del colegio).
    const closedClasses = await closedYearClassroomIds(schoolId);
    if (!WITHDRAWAL_REASONS.includes(input.reason)) throw new ValidationError('Elige el motivo del retiro');
    if (!isRealDate(input.effectiveDate)) throw new ValidationError('Revisa la fecha');
    const now = new Date();
    const moveId = uuidv4();
    let sourceIds: string[] = [];
    await db.transaction(async (tx) => {
      const enrollment = await lockEnrollment(tx, yearId, studentId);
      const student = await loadStudent(tx, schoolId, studentId);
      if (student.status === 'WITHDRAWN' || enrollment?.status === 'WITHDRAWN') throw new ConflictError('Ya está retirado');
      if (!enrollment) throw new ConflictError('No está matriculado en este año escolar');
      // Todos sus perfiles activos en clases de la escuela (de su sección, talleres y otras).
      const sources = await tx.select({ id: studentProfiles.id, classroomId: studentProfiles.classroomId }).from(studentProfiles)
        .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
        .where(and(
          eq(studentProfiles.schoolStudentId, studentId), eq(classrooms.schoolId, schoolId), eq(studentProfiles.isActive, true),
          closedClasses.length > 0 ? notInArray(classrooms.id, closedClasses) : undefined,
        ));
      sourceIds = sources.map((p) => p.id);
      await rejectPendingPurchases(tx, sourceIds);
      const areas = sourceIds.length
        ? await tx.select({ classroomId: schoolTeachingAssignments.classroomId, areaId: schoolTeachingAssignments.areaId }).from(schoolTeachingAssignments)
          .where(inArray(schoolTeachingAssignments.classroomId, sources.map((p) => p.classroomId)))
        : [];
      const areaOf = new Map(areas.map((a) => [a.classroomId, a.areaId]));
      const from = enrollment.sectionId ? await sectionInfo(tx, schoolId, yearId, enrollment.sectionId) : null;

      await tx.insert(schoolStudentMoves).values({
        id: moveId, schoolId, yearId, studentId, kind: 'WITHDRAWAL', fromSectionId: enrollment.sectionId, toSectionId: null,
        reason: input.reason, note: cleanNote(input.note), effectiveDate: input.effectiveDate, actorUserId: actorId, createdAt: now,
      });
      // Anotados (cerrados, no esperan clase): si vuelve a otra sección, su progreso sale de aquí.
      if (sources.length > 0) {
        await tx.insert(schoolMoveProfiles).values(sources.map((p) => ({
          id: uuidv4(), moveId, schoolId, studentId, areaId: areaOf.get(p.classroomId) ?? null,
          sourceProfileId: p.id, sourceLabel: from?.label ?? null, appliedAt: now, createdAt: now,
        })));
      }
      await tx.update(schoolEnrollments).set({ status: 'WITHDRAWN', updatedAt: now }).where(eq(schoolEnrollments.id, enrollment.id));
      await tx.update(schoolStudents).set({ status: 'WITHDRAWN', updatedAt: now }).where(eq(schoolStudents.id, studentId));
      await insertEvent(tx, {
        schoolId, studentId, yearId, type: 'WITHDRAWN', fromSectionId: enrollment.sectionId, actorUserId: actorId,
        metadata: { moveId, reason: input.reason },
      });
      if (sourceIds.length > 0) await tx.update(studentProfiles).set({ isActive: false, updatedAt: now }).where(inArray(studentProfiles.id, sourceIds));
    });
    await leaveFamilyRooms(sourceIds);
    return { moveId, classes: sourceIds.length };
  },

  /**
   * Vuelve al colegio: a su misma sección (recupera sus clases tal como las dejó) o a otra (su progreso viaja como en
   * un traslado). Las clases que no son de una sección (talleres con inscripción, otras) también vuelven.
   */
  async reinstate(schoolId: string, yearId: string, studentId: string, actorId: string, input: { sectionId?: string | null; effectiveDate: string; note?: string | null }) {
    await loadYear(schoolId, yearId, true);
    if (!isRealDate(input.effectiveDate)) throw new ValidationError('Revisa la fecha');
    const now = new Date();
    const moveId = uuidv4();
    const effects = newEffects();
    let back: string[] = [];
    await db.transaction(async (tx) => {
      const enrollment = await lockEnrollment(tx, yearId, studentId);
      const student = await loadStudent(tx, schoolId, studentId);
      if (student.status === 'ACTIVE' && enrollment?.status !== 'WITHDRAWN') throw new ConflictError('No está retirado');
      const withdrawal = await latestMove(tx, schoolId, studentId);
      const oldSectionId = enrollment?.sectionId ?? null;
      const targetSectionId = input.sectionId ?? oldSectionId;
      if (!targetSectionId) throw new ValidationError('Elige su sección');
      const to = await sectionInfo(tx, schoolId, yearId, targetSectionId);
      if (!to) throw new ValidationError('Esa sección no es de este año escolar');

      // Solo un retiro de este mismo año: de un año a otro todo empieza de cero (salvo el avatar, Entrega 2).
      const sources = withdrawal?.kind === 'WITHDRAWAL' && withdrawal.yearId === yearId
        ? await tx.select({ id: schoolMoveProfiles.sourceProfileId, areaId: schoolMoveProfiles.areaId, classroomId: studentProfiles.classroomId })
          .from(schoolMoveProfiles)
          .innerJoin(studentProfiles, eq(studentProfiles.id, schoolMoveProfiles.sourceProfileId))
          .where(and(eq(schoolMoveProfiles.moveId, withdrawal.id), eq(studentProfiles.isActive, false)))
        : [];
      await tx.insert(schoolStudentMoves).values({
        id: moveId, schoolId, yearId, studentId, kind: 'REINSTATEMENT', fromSectionId: oldSectionId, toSectionId: targetSectionId,
        reason: 'RETURN', note: cleanNote(input.note), effectiveDate: input.effectiveDate, actorUserId: actorId, createdAt: now,
      });
      if (targetSectionId === oldSectionId || !oldSectionId) {
        back = sources.map((s) => s.id!);
      } else {
        // A otra sección: vuelven sus clases que no eran de la sección anterior; las de sus áreas llevan su progreso.
        const old = await sectionClasses(tx, oldSectionId);
        const oldClassIds = new Set([...old.areas.map((a) => a.classroomId), ...old.workshops.map((w) => w.classroomId)]);
        back = sources.filter((s) => !oldClassIds.has(s.classroomId)).map((s) => s.id!);
        const fromLabel = (await sectionInfo(tx, schoolId, yearId, oldSectionId))?.label ?? null;
        const carried = sources.filter((s) => s.areaId && old.areas.some((a) => a.classroomId === s.classroomId));
        if (carried.length > 0) {
          await tx.insert(schoolMoveProfiles).values(carried.map((s) => ({
            id: uuidv4(), moveId, schoolId, studentId, areaId: s.areaId, sourceProfileId: s.id, sourceLabel: fromLabel, createdAt: now,
          })));
        }
      }
      if (back.length > 0) await tx.update(studentProfiles).set({ isActive: true, updatedAt: now }).where(inArray(studentProfiles.id, back));
      if (enrollment) {
        await tx.update(schoolEnrollments).set({ status: 'ACTIVE', sectionId: targetSectionId, updatedAt: now }).where(eq(schoolEnrollments.id, enrollment.id));
      } else {
        await tx.insert(schoolEnrollments).values({ id: uuidv4(), schoolId, yearId, studentId, sectionId: targetSectionId, createdAt: now, updatedAt: now });
      }
      await tx.update(schoolStudents).set({ status: 'ACTIVE', updatedAt: now }).where(eq(schoolStudents.id, studentId));
      await insertEvent(tx, {
        schoolId, studentId, yearId, type: 'REINSTATED', fromSectionId: oldSectionId, toSectionId: targetSectionId, actorUserId: actorId,
        metadata: { moveId },
      });
      // Sus clases: las de la sección y sus talleres con inscripción de este año.
      const target = await sectionClasses(tx, targetSectionId);
      const chosen = await tx.selectDistinct({ classroomId: schoolWorkshops.classroomId }).from(schoolWorkshopStudents)
        .innerJoin(schoolWorkshops, eq(schoolWorkshops.id, schoolWorkshopStudents.workshopId))
        .where(and(eq(schoolWorkshopStudents.studentId, studentId), eq(schoolWorkshops.yearId, yearId), eq(schoolWorkshops.mode, 'CHOSEN'), isNotNull(schoolWorkshops.classroomId)));
      const classIds = [...new Set([...target.areas.map((a) => a.classroomId), ...target.workshops.map((w) => w.classroomId), ...chosen.map((c) => c.classroomId!)])].sort();
      for (const classroomId of classIds) {
        await schoolAutoEnrollService.syncClassroomIn(tx, { schoolId, yearId, classroomId, studentIds: [studentId] }, { moveId, effects });
      }
    });
    runCarryEffects(effects);
    await joinFamilyRooms(back);
    return { moveId, recovered: back.length };
  },

  /** Movimientos del estudiante para su ficha (la nota es interna: solo la ve la administración). */
  async history(schoolId: string, studentId: string) {
    const moves = await db.select({
      id: schoolStudentMoves.id, kind: schoolStudentMoves.kind, yearId: schoolStudentMoves.yearId,
      fromSectionId: schoolStudentMoves.fromSectionId, toSectionId: schoolStudentMoves.toSectionId,
      reason: schoolStudentMoves.reason, note: schoolStudentMoves.note, effectiveDate: schoolStudentMoves.effectiveDate,
      createdAt: schoolStudentMoves.createdAt, undoneAt: schoolStudentMoves.undoneAt,
      actorFirstName: actors.firstName, actorLastName: actors.lastName,
    }).from(schoolStudentMoves)
      .leftJoin(actors, eq(actors.id, schoolStudentMoves.actorUserId))
      .where(and(eq(schoolStudentMoves.schoolId, schoolId), eq(schoolStudentMoves.studentId, studentId)))
      .orderBy(desc(schoolStudentMoves.createdAt))
      .limit(20);
    const sectionIds = [...new Set(moves.flatMap((m) => [m.fromSectionId, m.toSectionId]).filter((id): id is string => !!id))];
    const sections = sectionIds.length
      ? await db.select({ id: schoolSections.id, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name })
        .from(schoolSections).where(inArray(schoolSections.id, sectionIds)).orderBy(asc(schoolSections.grade))
      : [];
    const label = new Map(sections.map((s) => [s.id, sectionDisplayName(s.level, s.grade, s.name)]));
    return moves.map((m) => ({
      id: m.id,
      kind: m.kind,
      from: m.fromSectionId ? label.get(m.fromSectionId) ?? null : null,
      to: m.toSectionId ? label.get(m.toSectionId) ?? null : null,
      reason: m.reason,
      note: m.note,
      effectiveDate: m.effectiveDate,
      createdAt: m.createdAt,
      undone: !!m.undoneAt,
      actor: m.actorFirstName ? `${m.actorFirstName} ${m.actorLastName ?? ''}`.trim() : null,
    }));
  },
};
