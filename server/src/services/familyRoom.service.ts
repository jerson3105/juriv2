import { and, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  classroomChatSettings,
  classroomMessages,
  classroomRoomReads,
  classrooms,
  parentProfiles,
  parentStudentLinks,
  studentProfiles,
  users,
} from '../db/schema.js';
import { createNotification, createNotifications, getIO } from '../utils/notificationEmitter.js';
import { parentHasClassroomAccess } from '../utils/access.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

export type RoomKind = 'MESSAGE' | 'ANNOUNCEMENT';
export type RoomRole = 'TEACHER' | 'PARENT';
export interface RoomViewer { id: string; role: RoomRole }
export interface RoomCursor { createdAt: Date; id: string }

export interface RoomMessage {
  id: string;
  kind: RoomKind;
  senderId: string;
  senderRole: RoomRole;
  senderName: string;
  message: string | null;
  isDeleted: boolean;
  createdAt: string;
  /** Solo para el docente y solo en avisos: familias que abrieron la sala después del aviso. */
  seen?: { seen: number; total: number };
}

export interface RoomFamily { userId: string; name: string; relationship: string; students: string[] }

/** Sala de la clase: el docente y las familias vinculadas. Los alumnos no entran (join-chat los rechaza). */
export const familyRoomOf = (classroomId: string) => `classroom:${classroomId}:chat`;

const fullName = (first?: string | null, last?: string | null) => `${first ?? ''} ${last ?? ''}`.trim();
/** Ante las demás familias, un adulto es «Marta P.»: ni su apellido completo ni el nombre de su hijo. */
const shortName = (first?: string | null, last?: string | null) => {
  const initial = (last ?? '').trim().charAt(0).toUpperCase();
  return `${(first ?? '').trim()}${initial ? ` ${initial}.` : ''}`.trim() || 'Familia';
};
const senderLabel = (role: RoomRole, first?: string | null, last?: string | null) =>
  role === 'TEACHER' ? fullName(first, last) || 'Docente' : shortName(first, last);
const studentLabel = (displayName?: string | null, characterName?: string | null) => displayName || characterName || 'Sin nombre';

/** Cursor de páginas «fechaISO|id»: la fecha lleva milisegundos y el id desempata los del mismo instante. */
export const encodeRoomCursor = (createdAt: Date, id: string) => `${createdAt.toISOString()}|${id}`;
export const decodeRoomCursor = (cursor: string): RoomCursor | null => {
  const [iso, id, extra] = cursor.split('|');
  const createdAt = new Date(iso ?? '');
  if (extra !== undefined || !id || !/^[0-9a-f-]{36}$/i.test(id) || Number.isNaN(createdAt.getTime())) return null;
  return { createdAt, id };
};

const preview = (text: string) => (text.length > 200 ? `${text.slice(0, 200)}…` : text);

class FamilyRoomService {
  // ── Mensajes ──

  /** Página de la sala, de la más nueva hacia atrás; se devuelve en orden cronológico. */
  async listMessages(classroomId: string, viewer: RoomViewer, opts: { before?: RoomCursor; limit: number }) {
    const where = [eq(classroomMessages.classroomId, classroomId)];
    if (opts.before) {
      where.push(or(
        lt(classroomMessages.createdAt, opts.before.createdAt),
        and(eq(classroomMessages.createdAt, opts.before.createdAt), lt(classroomMessages.id, opts.before.id)),
      )!);
    }

    const rows = await db
      .select({
        id: classroomMessages.id,
        kind: classroomMessages.kind,
        senderId: classroomMessages.senderId,
        senderRole: classroomMessages.senderRole,
        message: classroomMessages.message,
        deletedAt: classroomMessages.deletedAt,
        createdAt: classroomMessages.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(classroomMessages)
      .leftJoin(users, eq(classroomMessages.senderId, users.id))
      .where(and(...where))
      .orderBy(desc(classroomMessages.createdAt), desc(classroomMessages.id))
      .limit(opts.limit + 1);

    const page = rows.slice(0, opts.limit);
    const oldest = page[page.length - 1];
    const nextCursor = rows.length > opts.limit && oldest ? encodeRoomCursor(oldest.createdAt, oldest.id) : null;

    const reads = viewer.role === 'TEACHER' && page.some((r) => r.kind === 'ANNOUNCEMENT')
      ? await this.familyReads(classroomId)
      : null;

    const messages: RoomMessage[] = page.map((r) => ({
      id: r.id,
      kind: r.kind,
      senderId: r.senderId,
      senderRole: r.senderRole,
      senderName: senderLabel(r.senderRole, r.firstName, r.lastName),
      message: r.deletedAt ? null : r.message,
      isDeleted: !!r.deletedAt,
      createdAt: r.createdAt.toISOString(),
      ...(reads && r.kind === 'ANNOUNCEMENT' ? { seen: { seen: seenSince(r.createdAt, reads.readAt), total: reads.total } } : {}),
    })).reverse();

    const { isOpen } = await this.getSettings(classroomId);
    return { messages, nextCursor, isOpen };
  }

  /** Publica en la sala. Avisos: solo el docente. Mensajes de familias: solo con la sala abierta. */
  async postMessage(classroomId: string, sender: RoomViewer, kind: RoomKind, text: string): Promise<RoomMessage> {
    if (kind === 'ANNOUNCEMENT' && sender.role !== 'TEACHER') throw new ForbiddenError('Solo el docente publica avisos');
    if (sender.role === 'PARENT' && !(await this.getSettings(classroomId)).isOpen) {
      throw new ForbiddenError('Por ahora solo el docente publica en la sala');
    }

    const [author] = await db.select({ firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.id, sender.id));
    const now = new Date();
    const id = uuidv4();
    await db.insert(classroomMessages).values({
      id, classroomId, senderId: sender.id, senderRole: sender.role, kind, message: text, createdAt: now,
    });

    const message: RoomMessage = {
      id,
      kind,
      senderId: sender.id,
      senderRole: sender.role,
      senderName: senderLabel(sender.role, author?.firstName, author?.lastName),
      message: text,
      isDeleted: false,
      createdAt: now.toISOString(),
    };
    // Mismo contenido para todos los de la sala; el «visto» solo vuelve al docente en la respuesta.
    getIO()?.to(familyRoomOf(classroomId)).emit('room:message', { classroomId, message });
    await this.markRead(classroomId, sender, now);

    if (kind === 'ANNOUNCEMENT') {
      const parentIds = await this.linkedParentUserIds(classroomId);
      await this.notifyFamilies(classroomId, parentIds, id, message.senderName, text, now);
      return { ...message, seen: { seen: 0, total: parentIds.length } };
    }
    if (sender.role === 'PARENT') await this.notifyTeacher(classroomId, id, message.senderName);
    return message;
  }

  /** «Borrar para todos» (docente): queda la marca de borrado y quién lo hizo. */
  async deleteMessage(classroomId: string, messageId: string, userId: string) {
    const [msg] = await db.select({ id: classroomMessages.id, deletedAt: classroomMessages.deletedAt })
      .from(classroomMessages)
      .where(and(eq(classroomMessages.id, messageId), eq(classroomMessages.classroomId, classroomId)));
    if (!msg) throw new NotFoundError('Mensaje no encontrado');
    if (!msg.deletedAt) {
      await db.update(classroomMessages).set({ deletedAt: new Date(), deletedBy: userId })
        .where(eq(classroomMessages.id, messageId));
      getIO()?.to(familyRoomOf(classroomId)).emit('room:message_deleted', { classroomId, messageId });
    }
    return { messageId };
  }

  // ── Ajustes ──

  async getSettings(classroomId: string): Promise<{ isOpen: boolean }> {
    const [row] = await db.select({ isOpen: classroomChatSettings.isOpen })
      .from(classroomChatSettings).where(eq(classroomChatSettings.classroomId, classroomId));
    return { isOpen: row?.isOpen ?? false };
  }

  async setOpen(classroomId: string, isOpen: boolean, userId: string) {
    const change = { isOpen, closedAt: isOpen ? null : new Date(), closedBy: isOpen ? null : userId };
    await db.insert(classroomChatSettings).values({ classroomId, ...change })
      .onDuplicateKeyUpdate({ set: change });
    getIO()?.to(familyRoomOf(classroomId)).emit('room:settings', { classroomId, isOpen });
    return { isOpen };
  }

  // ── Lectura ──

  /** Hasta aquí leyó `reader`. Si es una familia, el docente recibe el aviso para refrescar el «visto». */
  async markRead(classroomId: string, reader: RoomViewer, at = new Date()) {
    await db.insert(classroomRoomReads).values({ classroomId, userId: reader.id, lastReadAt: at })
      .onDuplicateKeyUpdate({ set: { lastReadAt: at } });
    if (reader.role !== 'PARENT') return;
    const [cls] = await db.select({ teacherId: classrooms.teacherId }).from(classrooms).where(eq(classrooms.id, classroomId));
    if (cls) getIO()?.to(`user:${cls.teacherId}`).emit('room:read', { classroomId });
  }

  /** Sin leer: para el docente, lo que escribieron las familias; para una familia, todo lo de los demás. */
  async unreadCount(classroomId: string, viewer: RoomViewer): Promise<number> {
    const [read] = await db.select({ at: classroomRoomReads.lastReadAt }).from(classroomRoomReads)
      .where(and(eq(classroomRoomReads.classroomId, classroomId), eq(classroomRoomReads.userId, viewer.id)));
    const where = [
      eq(classroomMessages.classroomId, classroomId),
      isNull(classroomMessages.deletedAt),
      ne(classroomMessages.senderId, viewer.id),
    ];
    if (viewer.role === 'TEACHER') where.push(eq(classroomMessages.senderRole, 'PARENT'));
    if (read) where.push(gt(classroomMessages.createdAt, read.at));
    const [row] = await db.select({ n: sql<number>`COUNT(*)` }).from(classroomMessages).where(and(...where));
    return Number(row?.n ?? 0);
  }

  /** Docente: quién vio un aviso y quién falta (con el nombre de su hijo; solo lo ve el docente). */
  async getReaders(classroomId: string, messageId: string) {
    const [msg] = await db.select({ createdAt: classroomMessages.createdAt }).from(classroomMessages)
      .where(and(
        eq(classroomMessages.id, messageId),
        eq(classroomMessages.classroomId, classroomId),
        eq(classroomMessages.kind, 'ANNOUNCEMENT'),
        isNull(classroomMessages.deletedAt),
      ));
    if (!msg) throw new NotFoundError('Aviso no encontrado');
    const families = await this.linkedFamilies(classroomId);
    const { readAt } = await this.familyReads(classroomId, families.map((f) => f.userId));
    const seen: RoomFamily[] = [];
    const missing: RoomFamily[] = [];
    for (const family of families) {
      ((readAt.get(family.userId)?.getTime() ?? 0) >= msg.createdAt.getTime() ? seen : missing).push(family);
    }
    return { seen, missing };
  }

  // ── Familias de la clase ──

  /** Pestaña «Familias»: alumnos con su código y sus familias, y solicitudes por aprobar. */
  async getFamilies(classroomId: string) {
    const students = await db.select({
      id: studentProfiles.id,
      displayName: studentProfiles.displayName,
      characterName: studentProfiles.characterName,
      parentLinkCode: studentProfiles.parentLinkCode,
    })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true),
        eq(studentProfiles.isDemo, false),
      ));
    if (students.length === 0) {
      return { students: [], pending: [], totals: { students: 0, withFamily: 0, families: 0, pending: 0 } };
    }

    const links = await db.select({
      linkId: parentStudentLinks.id,
      status: parentStudentLinks.status,
      studentProfileId: parentStudentLinks.studentProfileId,
      createdAt: parentStudentLinks.createdAt,
      userId: parentProfiles.userId,
      relationship: parentProfiles.relationship,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
      .from(parentStudentLinks)
      .innerJoin(parentProfiles, eq(parentStudentLinks.parentProfileId, parentProfiles.id))
      .innerJoin(users, eq(parentProfiles.userId, users.id))
      .where(and(
        inArray(parentStudentLinks.studentProfileId, students.map((s) => s.id)),
        inArray(parentStudentLinks.status, ['ACTIVE', 'PENDING']),
      ));

    const nameOf = new Map(students.map((s) => [s.id, studentLabel(s.displayName, s.characterName)]));
    const rows = students.map((s) => ({
      studentId: s.id,
      studentName: nameOf.get(s.id)!,
      code: s.parentLinkCode ?? null,
      families: links
        .filter((l) => l.studentProfileId === s.id && l.status === 'ACTIVE')
        .map((l) => ({ linkId: l.linkId, userId: l.userId, name: fullName(l.firstName, l.lastName), relationship: l.relationship })),
    }));
    // Primero quienes aún no tienen familia (es lo que hay que hacer), luego por nombre.
    rows.sort((a, b) => (a.families.length === 0) !== (b.families.length === 0)
      ? (a.families.length === 0 ? -1 : 1)
      : a.studentName.localeCompare(b.studentName, 'es'));

    const pending = links
      .filter((l) => l.status === 'PENDING')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((l) => ({
        linkId: l.linkId,
        parentName: fullName(l.firstName, l.lastName),
        parentEmail: l.email,
        relationship: l.relationship,
        studentId: l.studentProfileId,
        studentName: nameOf.get(l.studentProfileId) ?? 'Sin nombre',
        createdAt: l.createdAt.toISOString(),
      }));

    const active = links.filter((l) => l.status === 'ACTIVE');
    return {
      students: rows,
      pending,
      totals: {
        students: rows.length,
        withFamily: rows.filter((r) => r.families.length > 0).length,
        families: new Set(active.map((l) => l.userId)).size,
        pending: pending.length,
      },
    };
  }

  /** Docente: quita a una familia ya vinculada (la aprobó por error, o dejó de corresponder). */
  async revokeFamily(classroomId: string, linkId: string) {
    const [link] = await db.select({ id: parentStudentLinks.id, userId: parentProfiles.userId })
      .from(parentStudentLinks)
      .innerJoin(parentProfiles, eq(parentStudentLinks.parentProfileId, parentProfiles.id))
      .innerJoin(studentProfiles, eq(parentStudentLinks.studentProfileId, studentProfiles.id))
      .where(and(
        eq(parentStudentLinks.id, linkId),
        eq(studentProfiles.classroomId, classroomId),
        eq(parentStudentLinks.status, 'ACTIVE'),
      ));
    if (!link) throw new NotFoundError('Familia no encontrada');
    await db.update(parentStudentLinks).set({ status: 'REVOKED', updatedAt: new Date() })
      .where(and(eq(parentStudentLinks.id, linkId), eq(parentStudentLinks.status, 'ACTIVE')));
    await this.removeParentIfUnlinked(link.userId, classroomId);
    return { linkId };
  }

  // ── Sockets de las familias ──

  /** Clases donde la familia tiene un hijo vinculado: entra sola a esas salas al conectarse. */
  async classroomIdsForParent(userId: string): Promise<string[]> {
    const rows = await db.select({ classroomId: studentProfiles.classroomId })
      .from(parentStudentLinks)
      .innerJoin(parentProfiles, eq(parentStudentLinks.parentProfileId, parentProfiles.id))
      .innerJoin(studentProfiles, eq(parentStudentLinks.studentProfileId, studentProfiles.id))
      .where(and(
        eq(parentProfiles.userId, userId),
        eq(parentStudentLinks.status, 'ACTIVE'),
        eq(studentProfiles.isActive, true),
      ));
    return [...new Set(rows.map((r) => r.classroomId))];
  }

  /** Al aprobar el vínculo, la familia entra a la sala en vivo sin tener que reconectar. */
  joinParentToRoom(parentUserId: string, classroomId: string) {
    getIO()?.in(`user:${parentUserId}`).socketsJoin(familyRoomOf(classroomId));
  }

  /** Al revocar, sale de la sala en el acto, salvo que tenga otro hijo vinculado en la misma clase. */
  async removeParentIfUnlinked(parentUserId: string, classroomId: string) {
    if (await parentHasClassroomAccess(parentUserId, classroomId)) return;
    getIO()?.in(`user:${parentUserId}`).socketsLeave(familyRoomOf(classroomId));
  }

  // ── Ayudantes ──

  private async linkedParentUserIds(classroomId: string): Promise<string[]> {
    const rows = await db.select({ userId: parentProfiles.userId })
      .from(parentStudentLinks)
      .innerJoin(parentProfiles, eq(parentStudentLinks.parentProfileId, parentProfiles.id))
      .innerJoin(studentProfiles, eq(parentStudentLinks.studentProfileId, studentProfiles.id))
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(parentStudentLinks.status, 'ACTIVE'),
        eq(studentProfiles.isActive, true),
      ));
    return [...new Set(rows.map((r) => r.userId))];
  }

  private async linkedFamilies(classroomId: string): Promise<RoomFamily[]> {
    const rows = await db.select({
      userId: parentProfiles.userId,
      relationship: parentProfiles.relationship,
      firstName: users.firstName,
      lastName: users.lastName,
      displayName: studentProfiles.displayName,
      characterName: studentProfiles.characterName,
    })
      .from(parentStudentLinks)
      .innerJoin(parentProfiles, eq(parentStudentLinks.parentProfileId, parentProfiles.id))
      .innerJoin(users, eq(parentProfiles.userId, users.id))
      .innerJoin(studentProfiles, eq(parentStudentLinks.studentProfileId, studentProfiles.id))
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(parentStudentLinks.status, 'ACTIVE'),
        eq(studentProfiles.isActive, true),
      ));
    const byUser = new Map<string, RoomFamily>();
    for (const r of rows) {
      const family = byUser.get(r.userId)
        ?? { userId: r.userId, name: fullName(r.firstName, r.lastName), relationship: r.relationship, students: [] };
      family.students.push(studentLabel(r.displayName, r.characterName));
      byUser.set(r.userId, family);
    }
    return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  private async familyReads(classroomId: string, parentIds?: string[]) {
    const ids = parentIds ?? await this.linkedParentUserIds(classroomId);
    const readAt = new Map<string, Date>();
    if (ids.length > 0) {
      const rows = await db.select({ userId: classroomRoomReads.userId, lastReadAt: classroomRoomReads.lastReadAt })
        .from(classroomRoomReads)
        .where(and(eq(classroomRoomReads.classroomId, classroomId), inArray(classroomRoomReads.userId, ids)));
      for (const r of rows) readAt.set(r.userId, r.lastReadAt);
    }
    return { total: ids.length, readAt };
  }

  private async notifyFamilies(classroomId: string, parentIds: string[], messageId: string, teacherName: string, text: string, now: Date) {
    if (parentIds.length === 0) return;
    try {
      await createNotifications(parentIds.map((userId) => ({
        userId,
        classroomId,
        type: 'ANNOUNCEMENT' as const,
        title: `📢 Aviso de ${teacherName}`,
        message: preview(text),
        data: JSON.stringify({ roomMessageId: messageId }),
        createdAt: now,
      })));
    } catch { /* el aviso ya quedó publicado */ }
  }

  /** Al docente no le llega el texto: su campana puede verse mientras proyecta. */
  private async notifyTeacher(classroomId: string, messageId: string, familyName: string) {
    const [cls] = await db.select({ teacherId: classrooms.teacherId, name: classrooms.name })
      .from(classrooms).where(eq(classrooms.id, classroomId));
    if (!cls) return;
    try {
      await createNotification({
        userId: cls.teacherId,
        classroomId,
        type: 'ANNOUNCEMENT',
        title: `💬 ${familyName} escribió en la sala de familias`,
        message: `${cls.name}: abre «Familias» para leerlo.`,
        data: JSON.stringify({ roomMessageId: messageId }),
      });
    } catch { /* el mensaje ya quedó publicado */ }
  }
}

const seenSince = (createdAt: Date, readAt: Map<string, Date>) => {
  let seen = 0;
  for (const at of readAt.values()) if (at.getTime() >= createdAt.getTime()) seen++;
  return seen;
};

export const familyRoomService = new FamilyRoomService();
