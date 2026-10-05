import { and, desc, eq, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { activityLetters, activitySessions, classrooms, notifications, studentProfiles, users } from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { prepareForTx } from '../utils/notificationEmitter.js';
import { affectedRows } from '../utils/points.js';
import { activityService } from './activity.service.js';

export type CorreoMode = 'papel' | 'dispositivo';
export interface CorreoPair { writerId: string; recipientId: string }
export interface CorreoState {
  prompt: string;
  mode: CorreoMode;
  pairs: CorreoPair[];
  /** Papel: quién entregó su carta. */
  delivered: string[];
  /** Cartas (o destinatarios en papel) ya presentados por Jiro en el escenario. */
  announced: string[];
}

const parseJson = <T>(raw: unknown): T | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const isDuplicate = (error: unknown) => {
  const e = error as { code?: string; errno?: number; cause?: { code?: string; errno?: number } };
  return e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062 || e?.cause?.code === 'ER_DUP_ENTRY' || e?.cause?.errno === 1062;
};

/** Ciclo al azar: cada uno escribe al siguiente. Nadie se escribe a sí mismo y todos reciben una. */
const secretStars = (ids: string[]): CorreoPair[] => {
  const order = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.map((writerId, i) => ({ writerId, recipientId: order[(i + 1) % order.length] }));
};

/** Nombre que ve el alumno de su estrella (según cómo muestra los nombres la clase). */
const displayName = (s: { characterName: string | null; realName: string | null }, showCharacterName: boolean) =>
  (showCharacterName ? s.characterName || s.realName : s.realName || s.characterName) || 'tu compañero';

/**
 * Correo Estelar: el servidor arma las parejas de "estrella secreta" entre los presentes. En modo
 * dispositivo, cada alumno solo puede escribir a su estrella asignada; las cartas se moderan y quien
 * las recibe las lee en privado y sin autor.
 */
class CorreoService {
  async create(classroomId: string, teacherId: string, studentIds: string[], prompt: string, mode: CorreoMode) {
    const rows = await db.select({ id: studentProfiles.id }).from(studentProfiles)
      .where(and(eq(studentProfiles.classroomId, classroomId), inArray(studentProfiles.id, [...new Set(studentIds)]), eq(studentProfiles.isActive, true)));
    if (rows.length < 2) throw new ValidationError('Se necesitan al menos 2 alumnos presentes');
    const state: CorreoState = { prompt, mode, pairs: secretStars(rows.map((r) => r.id)), delivered: [], announced: [] };
    return activityService.create(classroomId, teacherId, 'CORREO', prompt.slice(0, 120), state);
  }

  private async correoSession(sessionId: string, teacherId: string, write = false) {
    const session = await activityService.ownedSession(sessionId, teacherId, write);
    if (session.activityType !== 'CORREO') throw new NotFoundError('Partida no encontrada');
    return session;
  }

  /** Cartas de la partida para el docente (con autor, para moderar). */
  async letters(sessionId: string, teacherId: string) {
    await this.correoSession(sessionId, teacherId);
    const rows = await db.select().from(activityLetters)
      .where(eq(activityLetters.sessionId, sessionId))
      .orderBy(activityLetters.createdAt);
    return rows.map((r) => ({
      id: r.id, writerId: r.writerId, recipientId: r.recipientId, message: r.message, status: r.status, createdAt: r.createdAt,
    }));
  }

  async moderate(letterId: string, teacherId: string, status: 'APPROVED' | 'REJECTED' | 'PENDING') {
    const [letter] = await db.select().from(activityLetters).where(eq(activityLetters.id, letterId));
    if (!letter) throw new NotFoundError('Carta no encontrada');
    await this.correoSession(letter.sessionId, teacherId, true);
    const [recipient] = await db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.id, letter.recipientId));
    const now = new Date();
    let notifTx = prepareForTx([]);
    await db.transaction(async (tx) => {
      await tx.update(activityLetters).set({ status, reviewedAt: status === 'PENDING' ? null : now }).where(eq(activityLetters.id, letterId));
      // Solo la primera aprobación avisa al destinatario.
      if (status === 'APPROVED' && letter.status !== 'APPROVED' && recipient?.userId) {
        notifTx = prepareForTx({
          userId: recipient.userId,
          classroomId: letter.classroomId,
          type: 'SCROLL_RECEIVED',
          title: '💌 Te llegó una carta estelar',
          message: 'Tu estrella secreta te escribió. Ábrela en tu inicio.',
          data: { kind: 'CORREO', letterId },
          createdAt: now,
        });
        await tx.insert(notifications).values(notifTx.entries);
      }
    });
    await notifTx.emitAfterCommit();
    return { id: letterId, status };
  }

  /** Perfil del propio alumno (404 si no es suyo). */
  private async ownProfile(profileId: string, userId: string) {
    const [profile] = await db.select({
      id: studentProfiles.id, userId: studentProfiles.userId, classroomId: studentProfiles.classroomId, showCharacterName: classrooms.showCharacterName,
      classActive: classrooms.isActive,
    })
      .from(studentProfiles)
      .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
      .where(eq(studentProfiles.id, profileId));
    if (!profile || profile.userId !== userId || !profile.classActive) throw new NotFoundError('Perfil no encontrado');
    return profile;
  }

  /** Partida de Correo en curso (modo dispositivo) en la que este alumno escribe. */
  private async activeAssignment(classroomId: string, profileId: string) {
    const [session] = await db.select().from(activitySessions)
      .where(and(eq(activitySessions.classroomId, classroomId), eq(activitySessions.activityType, 'CORREO'), eq(activitySessions.status, 'ACTIVE')))
      .orderBy(desc(activitySessions.createdAt))
      .limit(1);
    const state = parseJson<CorreoState>(session?.state);
    if (!session || !state || state.mode !== 'dispositivo') return null;
    const pair = state.pairs.find((p) => p.writerId === profileId);
    return pair ? { session, state, pair } : null;
  }

  /** Lo que ve el alumno: su estrella secreta (si hay Correo abierto) y las cartas aprobadas que recibió. */
  async forStudent(profileId: string, userId: string) {
    const profile = await this.ownProfile(profileId, userId);
    const assignment = await this.activeAssignment(profile.classroomId, profileId);
    let current = null;
    if (assignment) {
      const [recipient] = await db.select({ characterName: studentProfiles.characterName, firstName: users.firstName, displayName: studentProfiles.displayName })
        .from(studentProfiles)
        .leftJoin(users, eq(users.id, studentProfiles.userId))
        .where(eq(studentProfiles.id, assignment.pair.recipientId));
      const [mine] = await db.select({ status: activityLetters.status, message: activityLetters.message }).from(activityLetters)
        .where(and(eq(activityLetters.sessionId, assignment.session.id), eq(activityLetters.writerId, profileId)));
      current = {
        sessionId: assignment.session.id,
        prompt: assignment.state.prompt,
        recipientName: recipient
          ? displayName({ characterName: recipient.characterName, realName: recipient.firstName || recipient.displayName }, profile.showCharacterName)
          : 'tu compañero',
        sent: mine ? { status: mine.status, message: mine.message } : null,
      };
    }
    const received = await db.select({ id: activityLetters.id, message: activityLetters.message, createdAt: activityLetters.createdAt })
      .from(activityLetters)
      .where(and(eq(activityLetters.recipientId, profileId), eq(activityLetters.status, 'APPROVED')))
      .orderBy(desc(activityLetters.createdAt))
      .limit(10);
    return { current, received };
  }

  /** El alumno escribe a SU estrella (el destinatario lo pone el servidor, nunca el cliente). */
  async send(profileId: string, userId: string, message: string) {
    const profile = await this.ownProfile(profileId, userId);
    const assignment = await this.activeAssignment(profile.classroomId, profileId);
    if (!assignment) throw new NotFoundError('No hay Correo Estelar abierto para ti');
    try {
      await db.insert(activityLetters).values({
        id: uuidv4(),
        sessionId: assignment.session.id,
        classroomId: profile.classroomId,
        writerId: profileId,
        recipientId: assignment.pair.recipientId,
        message,
        status: 'PENDING',
        createdAt: new Date(),
      });
    } catch (error) {
      if (!isDuplicate(error)) throw error;
      // Si el docente la rechazó, puede reescribirla (vuelve a revisión). Si no, ya la envió.
      const rewrite = await db.update(activityLetters)
        .set({ message, status: 'PENDING', reviewedAt: null, createdAt: new Date() })
        .where(and(
          eq(activityLetters.sessionId, assignment.session.id),
          eq(activityLetters.writerId, profileId),
          eq(activityLetters.status, 'REJECTED'),
        ));
      if (affectedRows(rewrite) !== 1) throw new ConflictError('Ya enviaste tu carta');
    }
    return { status: 'PENDING' };
  }
}

export const correoService = new CorreoService();
