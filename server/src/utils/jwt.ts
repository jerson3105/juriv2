import jwt from 'jsonwebtoken';
import { eq, lt } from 'drizzle-orm';
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
export const generateTokenPair = async (payload: TokenPayload): Promise<TokenPair> => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  
  // Calcular fecha de expiración del refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 días
  
  // Guardar refresh token en la base de datos
  await db.insert(refreshTokens).values({
    id: uuidv4(),
    token: refreshToken,
    userId: payload.userId,
    expiresAt,
    createdAt: new Date(),
  });
  
  return { accessToken, refreshToken };
};

// Verificar Refresh Token
export const verifyRefreshToken = async (token: string): Promise<TokenPayload | null> => {
  try {
    // Verificar firma del token
    const decoded = jwt.verify(token, config_app.jwt.refreshSecret) as TokenPayload;
    
    // Verificar que existe en la base de datos y no ha expirado
    const storedToken = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.token, token),
    });
    
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

// Revocar Refresh Token
export const revokeRefreshToken = async (token: string): Promise<void> => {
  await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
};

// Revocar todos los tokens de un usuario
export const revokeAllUserTokens = async (userId: string): Promise<void> => {
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
};

// Limpiar tokens expirados (para ejecutar periódicamente)
export const cleanExpiredTokens = async (): Promise<number> => {
  const result = await db.delete(refreshTokens)
    .where(lt(refreshTokens.expiresAt, new Date()));
  return 0; // Drizzle no retorna count directamente
};
