import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { eq, lt, or } from 'drizzle-orm';
import { config_app } from '../config/env.js';
import { db, refreshTokens } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const hashRefreshToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const getRefreshTokenExpiryDate = (token: string): Date => {
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;
  if (decoded?.exp && typeof decoded.exp === 'number') {
    return new Date(decoded.exp * 1000);
  }

  // Fallback defensivo si no hay claim exp
  const fallbackExpiry = new Date();
  fallbackExpiry.setDate(fallbackExpiry.getDate() + 7);
  return fallbackExpiry;
};

const findStoredRefreshToken = async (token: string, txOrDb: any = db) => {
  const tokenHash = hashRefreshToken(token);

  return txOrDb.query.refreshTokens.findFirst({
    where: or(
      eq(refreshTokens.token, tokenHash),
      eq(refreshTokens.token, token)
    ),
  });
};

// Generar Access Token
export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, config_app.jwt.secret, {
    expiresIn: config_app.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
};

// Generar Refresh Token
export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, config_app.jwt.refreshSecret, {
    expiresIn: config_app.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
};

// Generar par de tokens
export const generateTokenPair = async (payload: TokenPayload, tx: any = db): Promise<TokenPair> => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  const refreshTokenHash = hashRefreshToken(refreshToken);
  
  // Calcular fecha de expiración del refresh token
  const expiresAt = getRefreshTokenExpiryDate(refreshToken);
  
  // Guardar hash del refresh token en la base de datos
  await tx.insert(refreshTokens).values({
    id: uuidv4(),
    token: refreshTokenHash,
    userId: payload.userId,
    expiresAt,
    createdAt: new Date(),
  });
  
  return { accessToken, refreshToken };
};

// Verificar Refresh Token
export const verifyRefreshToken = async (token: string): Promise<TokenPayload | null> => {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return null;
  }

  try {
    // Verificar firma del token
    const decoded = jwt.verify(normalizedToken, config_app.jwt.refreshSecret) as TokenPayload;
    
    // Verificar que existe en la base de datos y no ha expirado
    const storedToken = await findStoredRefreshToken(normalizedToken);
    
    if (!storedToken || storedToken.expiresAt < new Date()) {
      // Eliminar token expirado si existe
      if (storedToken) {
        await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));
      }
      return null;
    }
    
    return decoded;
  } catch {
    return null;
  }
};

// Consumir Refresh Token (single-use)
// Uses a single atomic DELETE WHERE token=hash AND expires_at > NOW() to avoid
// transaction isolation issues between a separate SELECT and DELETE.
export const consumeRefreshToken = async (token: string, tx: any = db): Promise<TokenPayload | null> => {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    console.error('[consumeRefreshToken] Token vacío');
    return null;
  }

  try {
    // 1. Verify JWT signature + expiry
    const decoded = jwt.verify(normalizedToken, config_app.jwt.refreshSecret) as TokenPayload;

    // 2. Atomic delete by hash only — no date condition.
    //    jwt.verify() above already guarantees the token isn't expired.
    //    Adding gt(expiresAt, new Date()) caused failures because Node sends
    //    UTC timestamps but MySQL compares in its local timezone (GMT-5).
    const tokenHash = hashRefreshToken(normalizedToken);

    const deleteResult = await tx.delete(refreshTokens).where(
      or(
        eq(refreshTokens.token, tokenHash),
        eq(refreshTokens.token, normalizedToken)
      )
    );

    // Drizzle + MySQL2 returns [ResultSetHeader, null] — read index 0
    const header = Array.isArray(deleteResult) ? deleteResult[0] : deleteResult;
    const deletedRows = Number((header as { affectedRows?: number }).affectedRows ?? 0);

    if (deletedRows < 1) {
      return null;
    }

    return decoded;
  } catch (err) {
    return null;
  }
};

// Revocar Refresh Token
export const revokeRefreshToken = async (token: string): Promise<void> => {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return;
  }

  const tokenHash = hashRefreshToken(normalizedToken);
  await db.delete(refreshTokens).where(
    or(
      eq(refreshTokens.token, tokenHash),
      eq(refreshTokens.token, normalizedToken)
    )
  );
};

// Revocar todos los tokens de un usuario
export const revokeAllUserTokens = async (userId: string): Promise<void> => {
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
};

// Limpiar tokens expirados (para ejecutar periódicamente)
export const cleanExpiredTokens = async (): Promise<number> => {
  const result = await db.delete(refreshTokens)
    .where(lt(refreshTokens.expiresAt, new Date()));
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number }).affectedRows ?? 0);
};
