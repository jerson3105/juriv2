import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { config_app } from '../config/env.js';
import { db, refreshTokens, users } from '../db/index.js';
import { authSessions } from '../db/schema.js';
import { v4 as uuidv4 } from 'uuid';
import { getIO } from './notificationEmitter.js';
import { cache } from './cache.js';

type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  /** Sesión del dispositivo (los tokens anteriores a las sesiones no lo traen). */
  sid?: string;
}

export interface SessionTokens {
  accessToken: string;
  /** Opaco: viaja en una cookie httpOnly, nunca en el cuerpo de la respuesta. */
  refreshToken: string;
  sessionId: string;
  /** false = cookie de sesión (se borra al cerrar el navegador). */
  persistent: boolean;
  expiresAt: Date;
}

const HOUR = 60 * 60 * 1000;
/**
 * Vida máxima de una sesión: alumnos 8 h (equipos compartidos del colegio), administración 12 h (la
 * cuenta que puede todo no queda abierta días), el resto 30 días.
 */
export const sessionMaxMs = (role: UserRole) => (role === 'STUDENT' ? 8 * HOUR : role === 'ADMIN' ? 12 * HOUR : 30 * 24 * HOUR);
/** Alumnos y administración: cookie de sesión, se borra al cerrar el navegador. */
const isPersistentRole = (role: UserRole) => role !== 'STUDENT' && role !== 'ADMIN';
/** Dos pestañas que renuevan a la vez con el mismo refresh: no se toma como robo. */
const REUSE_GRACE_MS = 30 * 1000;
const SESSION_CACHE_TTL = 30;
const sessionCacheKey = (sid: string) => `session:${sid}`;

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');
const isLegacyJwt = (token: string) => token.split('.').length === 3;

export class SessionError extends Error {
  constructor(message: string, public code: 'INVALID' | 'REUSED' | 'EXPIRED') {
    super(message);
  }
}

// ==================== Emisión ====================

export const generateAccessToken = (payload: TokenPayload): string =>
  jwt.sign(
    { userId: payload.userId, email: payload.email, role: payload.role, ...(payload.sid ? { sid: payload.sid } : {}) },
    config_app.jwt.secret,
    { expiresIn: config_app.jwt.expiresIn as jwt.SignOptions['expiresIn'], algorithm: 'HS256' },
  );

const newOpaqueToken = () => crypto.randomBytes(32).toString('base64url');

const insertRefreshToken = async (tx: any, userId: string, sessionId: string, expiresAt: Date): Promise<string> => {
  const refreshToken = newOpaqueToken();
  await tx.insert(refreshTokens).values({
    id: uuidv4(),
    token: hashToken(refreshToken),
    userId,
    sessionId,
    expiresAt,
    createdAt: new Date(),
  });
  return refreshToken;
};

/** Último ingreso (para retirar cuentas docentes sin verificar): como mucho una escritura al día. */
const touchLastLogin = async (tx: any, userId: string) => {
  await tx.update(users)
    .set({ lastLoginAt: new Date() })
    .where(and(eq(users.id, userId), sql`(${users.lastLoginAt} IS NULL OR ${users.lastLoginAt} < ${new Date(Date.now() - 24 * HOUR)})`));
};

/** Inicia una sesión nueva (login, registro, Google…) y entrega sus tokens. */
export const generateTokenPair = async (
  payload: TokenPayload,
  tx: any = db,
  options: { userAgent?: string | null } = {},
): Promise<SessionTokens> => {
  const now = new Date();
  const sessionId = uuidv4();
  const persistent = isPersistentRole(payload.role);
  const expiresAt = new Date(now.getTime() + sessionMaxMs(payload.role));
  await tx.insert(authSessions).values({
    id: sessionId,
    userId: payload.userId,
    persistent,
    userAgent: options.userAgent?.slice(0, 255) ?? null,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
  });
  const refreshToken = await insertRefreshToken(tx, payload.userId, sessionId, expiresAt);
  await touchLastLogin(tx, payload.userId);
  return {
    accessToken: generateAccessToken({ ...payload, sid: sessionId }),
    refreshToken,
    sessionId,
    persistent,
    expiresAt,
  };
};

// ==================== Renovación ====================

/** Refresh anterior a las sesiones (JWT): se canjea una vez por una sesión nueva. */
const exchangeLegacyRefresh = async (token: string, userAgent?: string | null): Promise<SessionTokens> => {
  let decoded: TokenPayload;
  try {
    decoded = jwt.verify(token, config_app.jwt.refreshSecret, { algorithms: ['HS256'] }) as TokenPayload;
  } catch {
    throw new SessionError('Token de actualización inválido o expirado', 'INVALID');
  }
  return db.transaction(async (tx) => {
    const deleted = await tx.delete(refreshTokens).where(or(eq(refreshTokens.token, hashToken(token)), eq(refreshTokens.token, token)));
    const header = Array.isArray(deleted) ? deleted[0] : deleted;
    if (Number((header as { affectedRows?: number }).affectedRows ?? 0) < 1) {
      throw new SessionError('Token de actualización inválido o expirado', 'INVALID');
    }
    const user = await tx.query.users.findFirst({ where: eq(users.id, decoded.userId), columns: { id: true, email: true, role: true, isActive: true } });
    if (!user || !user.isActive) throw new SessionError('Token de actualización inválido o expirado', 'INVALID');
    return generateTokenPair({ userId: user.id, email: user.email, role: user.role as UserRole }, tx, { userAgent });
  });
};

/**
 * Rota el refresh de una sesión: el usado queda marcado y se entrega uno nuevo. Si llega un refresh
 * ya usado (fuera del margen de dos pestañas a la vez), alguien lo copió: se cierra esa sesión.
 */
export const rotateRefreshToken = async (rawToken: string, userAgent?: string | null): Promise<SessionTokens> => {
  const token = rawToken.trim();
  if (!token) throw new SessionError('Token de actualización requerido', 'INVALID');
  if (isLegacyJwt(token)) return exchangeLegacyRefresh(token, userAgent);

  const outcome = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(refreshTokens).where(eq(refreshTokens.token, hashToken(token))).for('update');
    if (!row?.sessionId) return { kind: 'invalid' as const };
    const [session] = await tx.select().from(authSessions).where(eq(authSessions.id, row.sessionId)).for('update');
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt.getTime() <= now.getTime()) {
      await tx.delete(refreshTokens).where(eq(refreshTokens.id, row.id));
      return { kind: session && !session.revokedAt ? 'expired' as const : 'invalid' as const };
    }
    if (row.usedAt && now.getTime() - row.usedAt.getTime() > REUSE_GRACE_MS) {
      return { kind: 'reuse' as const, sessionId: session.id };
    }
    const user = await tx.query.users.findFirst({ where: eq(users.id, session.userId), columns: { id: true, email: true, role: true, isActive: true } });
    if (!user || !user.isActive) return { kind: 'invalid' as const };

    if (!row.usedAt) await tx.update(refreshTokens).set({ usedAt: now }).where(eq(refreshTokens.id, row.id));
    await tx.update(authSessions).set({ lastSeenAt: now }).where(eq(authSessions.id, session.id));
    const refreshToken = await insertRefreshToken(tx, user.id, session.id, session.expiresAt);
    await touchLastLogin(tx, user.id);
    return {
      kind: 'ok' as const,
      tokens: {
        accessToken: generateAccessToken({ userId: user.id, email: user.email, role: user.role as UserRole, sid: session.id }),
        refreshToken,
        sessionId: session.id,
        persistent: session.persistent,
        expiresAt: session.expiresAt,
      },
    };
  });

  if (outcome.kind === 'ok') return outcome.tokens;
  if (outcome.kind === 'reuse') {
    await revokeSession(outcome.sessionId);
    throw new SessionError('Por seguridad cerramos esta sesión. Vuelve a entrar.', 'REUSED');
  }
  if (outcome.kind === 'expired') throw new SessionError('Tu sesión terminó. Vuelve a entrar.', 'EXPIRED');
  throw new SessionError('Token de actualización inválido o expirado', 'INVALID');
};

// ==================== Estado y revocación ====================

interface SessionState { userId: string; active: boolean }

/** ¿Sigue viva la sesión? (caché corta; se borra al revocar, así que el corte es inmediato). */
export const getSessionState = async (sid: string): Promise<SessionState | null> => {
  const cached = cache.get<SessionState>(sessionCacheKey(sid));
  if (cached) return cached;
  const [session] = await db.select({ userId: authSessions.userId, revokedAt: authSessions.revokedAt, expiresAt: authSessions.expiresAt })
    .from(authSessions).where(eq(authSessions.id, sid)).limit(1);
  if (!session) return null;
  const state = { userId: session.userId, active: !session.revokedAt && session.expiresAt.getTime() > Date.now() };
  cache.set(sessionCacheKey(sid), state, SESSION_CACHE_TTL);
  return state;
};

const disconnect = (room: string) => {
  try {
    getIO()?.in(room).disconnectSockets(true);
  } catch {
    // Socket.io aún no inicializado: no hay sockets que cerrar.
  }
};

/** Cierra una sesión: sus refresh, su access token (por el sid) y sus sockets. */
export const revokeSession = async (sessionId: string): Promise<void> => {
  await db.update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)));
  await db.delete(refreshTokens).where(eq(refreshTokens.sessionId, sessionId));
  cache.delete(sessionCacheKey(sessionId));
  disconnect(`session:${sessionId}`);
};

/** Sesión a la que pertenece un refresh (para cerrar sesión con la cookie). */
export const sessionIdForRefreshToken = async (rawToken: string): Promise<string | null> => {
  const token = rawToken.trim();
  if (!token) return null;
  const [row] = await db.select({ sessionId: refreshTokens.sessionId }).from(refreshTokens)
    .where(or(eq(refreshTokens.token, hashToken(token)), eq(refreshTokens.token, token))).limit(1);
  return row?.sessionId ?? null;
};

/** Cierra un refresh anterior a las sesiones (cerrar sesión desde un cliente viejo). */
export const revokeRefreshToken = async (rawToken: string): Promise<void> => {
  const token = rawToken.trim();
  if (!token) return;
  await db.delete(refreshTokens).where(or(eq(refreshTokens.token, hashToken(token)), eq(refreshTokens.token, token)));
};

/** Cierra todas las sesiones de una persona (cambio de contraseña, de rol, "cerrar todas"…). */
export const revokeAllUserTokens = async (userId: string): Promise<void> => {
  const active = await db.select({ id: authSessions.id }).from(authSessions)
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
  if (active.length > 0) {
    await db.update(authSessions).set({ revokedAt: new Date() }).where(inArray(authSessions.id, active.map((s) => s.id)));
    for (const s of active) cache.delete(sessionCacheKey(s.id));
  }
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  disconnect(`user:${userId}`);
};

// Limpieza periódica: refresh vencidos o ya usados y sesiones terminadas hace más de una semana.
export const cleanExpiredTokens = async (): Promise<number> => {
  const now = Date.now();
  const result = await db.delete(refreshTokens).where(or(
    lt(refreshTokens.expiresAt, new Date(now)),
    lt(refreshTokens.usedAt, new Date(now - 24 * HOUR)),
  ));
  await db.delete(authSessions).where(or(
    lt(authSessions.expiresAt, new Date(now - 7 * 24 * HOUR)),
    lt(authSessions.revokedAt, new Date(now - 7 * 24 * HOUR)),
  ));
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number }).affectedRows ?? 0);
};
