import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { users, userTotp } from '../db/schema.js';
import { recordAudit } from '../utils/audit.js';
import { cache } from '../utils/cache.js';
import { RateLimitError, UnauthorizedError, ValidationError } from '../utils/errors.js';
import { formatDuration } from '../utils/helpers.js';
import { generateTokenPair, revokeAllUserTokens } from '../utils/jwt.js';
import { decryptPii, encryptPii } from '../utils/piiCrypto.js';
import { affectedRows } from '../utils/points.js';
import { generateTotpSecret, otpauthUri, verifyTotp } from '../utils/totp.js';

/**
 * Verificación en dos pasos de las cuentas de administración: contraseña y luego el código de 6 números de una app.
 * Se activa solo desde el servidor (src/scripts/adminTotp.ts): quien tenga solo la contraseña no puede activarla
 * ni cambiarla. La clave va cifrada con la llave de datos personales.
 */

const CHALLENGE_TTL_SECONDS = 5 * 60;
const MAX_FAILED = 5;
// Códigos equivocados: 15 minutos, luego 1 hora y luego 24 horas cada vez, hasta entrar bien.
const LOCK_STEPS_MS = [15 * 60_000, 60 * 60_000, 24 * 60 * 60_000];
const EXPIRED_MESSAGE = 'La verificación venció. Vuelve a escribir tu contraseña.';

const challengeKey = (id: string) => `admin-totp-challenge:${id}`;
const secretContext = (userId: string) => `user:${userId}:totp`;

type Challenge = { userId: string };
type VerifyOutcome =
  | { error: Error; failed?: boolean; lockLevel?: number }
  | { user: { email: string; firstName: string; lastName: string; avatarUrl: string | null }; tokens: Awaited<ReturnType<typeof generateTokenPair>> };

export const adminTotpService = {
  async isEnabled(userId: string): Promise<boolean> {
    const [row] = await db.select({ userId: userTotp.userId }).from(userTotp).where(eq(userTotp.userId, userId)).limit(1);
    return !!row;
  },

  /** Activación, paso 1 (en el servidor): clave nueva y enlace para la app. No guarda nada hasta confirmar. */
  newEnrollment(account: string) {
    const secret = generateTotpSecret();
    return { secret, uri: otpauthUri(secret, account) };
  },

  /** Activación, paso 2: con un código válido de la app guarda la clave cifrada y cierra las sesiones abiertas. */
  async confirmEnrollment(userId: string, secret: string, code: string): Promise<void> {
    const step = verifyTotp(secret, code);
    if (step === null) throw new ValidationError('El código no coincide. Revisa la hora del teléfono y prueba con el siguiente.');
    const values = { secretEncrypted: encryptPii(secret, secretContext(userId)), enabledAt: new Date(), lastStep: step, failedAttempts: 0, lockLevel: 0, lockedUntil: null };
    await db.insert(userTotp).values({ userId, ...values }).onDuplicateKeyUpdate({ set: values });
    // Una sesión abierta antes (quizá con una contraseña filtrada) no debe sobrevivir a la activación.
    await revokeAllUserTokens(userId);
    await recordAudit({ action: 'auth.admin_totp_enabled', target: { type: 'user', id: userId } });
  },

  async disable(userId: string): Promise<boolean> {
    const removed = affectedRows(await db.delete(userTotp).where(eq(userTotp.userId, userId))) === 1;
    if (removed) await recordAudit({ action: 'auth.admin_totp_disabled', target: { type: 'user', id: userId } });
    return removed;
  },

  /** Tras la contraseña correcta: un pase de 5 minutos para escribir el código. */
  issueChallenge(userId: string): string {
    const id = uuidv4();
    cache.set<Challenge>(challengeKey(id), { userId }, CHALLENGE_TTL_SECONDS);
    return id;
  },

  /** Entrada, paso 2: el código de la app. Devuelve la sesión; los intentos fallidos se cuentan y bloquean. */
  async verifyChallenge(challengeId: string, code: string, client: { ip?: string | null; userAgent?: string | null } = {}) {
    const challenge = cache.get<Challenge>(challengeKey(challengeId));
    if (!challenge) throw new UnauthorizedError(EXPIRED_MESSAGE);
    const { userId } = challenge;

    // Fila bloqueada: los intentos simultáneos no esquivan el contador. El error se lanza fuera, para que se guarde.
    const outcome: VerifyOutcome = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(userTotp).where(eq(userTotp.userId, userId)).for('update');
      if (!row) return { error: new UnauthorizedError(EXPIRED_MESSAGE) };
      const now = Date.now();
      if (row.lockedUntil && new Date(row.lockedUntil).getTime() > now) {
        const minutes = Math.ceil((new Date(row.lockedUntil).getTime() - now) / 60_000);
        return { error: new RateLimitError(`Demasiados códigos equivocados. Espera ${minutes} min.`) };
      }

      const step = verifyTotp(decryptPii(row.secretEncrypted, secretContext(userId)), code, { nowMs: now, afterStep: row.lastStep });
      if (step === null) {
        const attempts = row.failedAttempts + 1;
        if (attempts >= MAX_FAILED) {
          const lockLevel = row.lockLevel + 1;
          const lockMs = LOCK_STEPS_MS[Math.min(lockLevel, LOCK_STEPS_MS.length) - 1];
          await tx.update(userTotp).set({ failedAttempts: 0, lockLevel, lockedUntil: new Date(now + lockMs) }).where(eq(userTotp.userId, userId));
          return { error: new RateLimitError(`Demasiados códigos equivocados: espera ${formatDuration(lockMs)}.`), failed: true, lockLevel };
        }
        await tx.update(userTotp).set({ failedAttempts: attempts }).where(eq(userTotp.userId, userId));
        return { error: new UnauthorizedError('El código no es correcto.'), failed: true };
      }

      const [user] = await tx.select({
        email: users.email, firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl,
        role: users.role, isActive: users.isActive,
      }).from(users).where(eq(users.id, userId));
      if (!user || !user.isActive || user.role !== 'ADMIN') return { error: new UnauthorizedError(EXPIRED_MESSAGE) };
      await tx.update(userTotp).set({ lastStep: step, failedAttempts: 0, lockLevel: 0, lockedUntil: null }).where(eq(userTotp.userId, userId));
      const tokens = await generateTokenPair({ userId, email: user.email, role: 'ADMIN' }, tx, { userAgent: client.userAgent });
      return { user: { email: user.email, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl }, tokens };
    });

    if ('error' in outcome) {
      if (outcome.failed) {
        await recordAudit({
          action: 'auth.admin_totp_failed',
          target: { type: 'user', id: userId },
          metadata: { locked: !!outcome.lockLevel, level: outcome.lockLevel ?? 0 },
          ip: client.ip ?? null,
        });
      }
      // Tras un bloqueo, la contraseña se vuelve a pedir.
      if (outcome.lockLevel) cache.delete(challengeKey(challengeId));
      throw outcome.error;
    }
    cache.delete(challengeKey(challengeId));
    return {
      user: { id: userId, ...outcome.user, role: 'ADMIN' as const },
      ...outcome.tokens,
    };
  },
};
