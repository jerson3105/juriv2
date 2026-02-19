import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { config_app } from '../config/env.js';
import { db, users } from '../db/index.js';
import { cache, CACHE_KEYS, CACHE_TTL } from '../utils/cache.js';

type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

// Payload del JWT
interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

interface CachedAuthUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

const parseBearerToken = (authHeader?: string): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  return token || null;
};

const getUserFromCacheOrDb = async (userId: string): Promise<CachedAuthUser | null> => {
  const cacheKey = CACHE_KEYS.user(userId);
  const cachedUser = cache.get<CachedAuthUser>(cacheKey);
  if (cachedUser) {
    return cachedUser;
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });

  if (!dbUser) {
    return null;
  }

  cache.set(cacheKey, dbUser, CACHE_TTL.SHORT);
  return dbUser;
};

// Middleware de autenticación
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = parseBearerToken(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Token de acceso no proporcionado',
      });
      return;
    }

    // Verificar token
    const decoded = jwt.verify(token, config_app.jwt.secret) as JwtPayload;

    const user = await getUserFromCacheOrDb(decoded.userId);
    
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Usuario no encontrado o inactivo',
      });
      return;
    }
    
    // Adjuntar usuario al request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Token inválido',
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Error de autenticación',
    });
  }
};

// Middleware para verificar rol
export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }
    
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar esta acción',
      });
      return;
    }
    
    next();
  };
};

// Middleware opcional de autenticación (no falla si no hay token)
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = parseBearerToken(req.headers.authorization);
    if (!token) {
      next();
      return;
    }

    const decoded = jwt.verify(token, config_app.jwt.secret) as JwtPayload;

    const user = await getUserFromCacheOrDb(decoded.userId);
    
    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
        firstName: user.firstName,
        lastName: user.lastName,
      };
    }
    
    next();
  } catch {
    // Si hay error, simplemente continuar sin usuario
    next();
  }
};
