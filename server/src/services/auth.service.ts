import bcrypt from 'bcryptjs';
import { eq, or } from 'drizzle-orm';
import { db, users, refreshTokens as refreshTokensTable } from '../db/index.js';
import { generateTokenPair, verifyRefreshToken, revokeRefreshToken, revokeAllUserTokens } from '../utils/jwt.js';
import { v4 as uuidv4 } from 'uuid';

// Tipos
type UserRole = 'TEACHER' | 'STUDENT';

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

interface LoginInput {
  email: string;
  password: string;
}

interface GoogleAuthInput {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: UserRole;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    avatarUrl: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

// Constantes
const SALT_ROUNDS = 12;

/**
 * Registrar nuevo usuario
 */
export const register = async (input: RegisterInput): Promise<AuthResponse> => {
  const { email, password, firstName, lastName, role } = input;
  
  // Verificar si el email ya existe
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
  
  if (existingUser) {
    throw new Error('El correo electrónico ya está registrado');
  }
  
  // Hashear contraseña
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const now = new Date();
  const userId = uuidv4();
  
  // Crear usuario
  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    password: hashedPassword,
    firstName,
    lastName,
    role,
    provider: 'LOCAL',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  
  // Generar tokens
  const tokens = await generateTokenPair({
    userId,
    email: email.toLowerCase(),
    role,
  });
  
  return {
    user: {
      id: userId,
      email: email.toLowerCase(),
      firstName,
      lastName,
      role,
      avatarUrl: null,
    },
    ...tokens,
  };
};

/**
 * Iniciar sesión con email y contraseña
 */
export const login = async (input: LoginInput): Promise<AuthResponse> => {
  const { email, password } = input;
  
  // Buscar usuario
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
  
  if (!user) {
    throw new Error('Credenciales inválidas');
  }
  
  if (!user.isActive) {
    throw new Error('Tu cuenta ha sido desactivada');
  }
  
  if (user.provider !== 'LOCAL' || !user.password) {
    throw new Error('Esta cuenta usa inicio de sesión con Google');
  }
  
  // Verificar contraseña
  const isValidPassword = await bcrypt.compare(password, user.password);
  
  if (!isValidPassword) {
    throw new Error('Credenciales inválidas');
  }
  
  // Generar tokens
  const tokens = await generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
  });
  
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as UserRole,
      avatarUrl: user.avatarUrl,
    },
    ...tokens,
  };
};

/**
 * Autenticación con Google
 */
export const googleAuth = async (input: GoogleAuthInput): Promise<AuthResponse> => {
  const { googleId, email, firstName, lastName, avatarUrl, role } = input;
  
  // Buscar usuario existente por googleId o email
  let user = await db.query.users.findFirst({
    where: or(
      eq(users.googleId, googleId),
      eq(users.email, email.toLowerCase())
    ),
  });
  
  const now = new Date();
  
  if (user) {
    // Actualizar información de Google si es necesario
    if (!user.googleId) {
      await db.update(users)
        .set({
          googleId,
          provider: 'GOOGLE',
          avatarUrl: avatarUrl || user.avatarUrl,
          updatedAt: now,
        })
        .where(eq(users.id, user.id));
      
      user = { ...user, googleId, provider: 'GOOGLE', avatarUrl: avatarUrl || user.avatarUrl };
    }
    
    if (!user.isActive) {
      throw new Error('Tu cuenta ha sido desactivada');
    }
  } else {
    // Crear nuevo usuario
    const userId = uuidv4();
    await db.insert(users).values({
      id: userId,
      email: email.toLowerCase(),
      googleId,
      firstName,
      lastName,
      role,
      provider: 'GOOGLE',
      avatarUrl,
      isActive: true,
      notifyBadges: true,
      notifyLevelUp: true,
      createdAt: now,
      updatedAt: now,
    });
    
    user = {
      id: userId,
      email: email.toLowerCase(),
      password: null,
      googleId,
      firstName,
      lastName,
      role,
      provider: 'GOOGLE',
      avatarUrl: avatarUrl || null,
      isActive: true,
      notifyBadges: true,
      notifyLevelUp: true,
      createdAt: now,
      updatedAt: now,
    };
  }
  
  if (!user) {
    throw new Error('Error al autenticar con Google');
  }
  
  // Generar tokens
  const tokens = await generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
  });
  
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as UserRole,
      avatarUrl: user.avatarUrl,
    },
    ...tokens,
  };
};

/**
 * Refrescar tokens
 */
export const refreshTokens = async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
  const payload = await verifyRefreshToken(refreshToken);
  
  if (!payload) {
    throw new Error('Token de actualización inválido o expirado');
  }
  
  // Revocar token anterior
  await revokeRefreshToken(refreshToken);
  
  // Generar nuevos tokens
  const tokens = await generateTokenPair({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  });
  
  return tokens;
};

/**
 * Cerrar sesión
 */
export const logout = async (refreshToken: string): Promise<void> => {
  await revokeRefreshToken(refreshToken);
};

/**
 * Cerrar todas las sesiones de un usuario
 */
export const logoutAll = async (userId: string): Promise<void> => {
  await revokeAllUserTokens(userId);
};

/**
 * Cambiar contraseña
 */
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  
  if (!user || !user.password) {
    throw new Error('Usuario no encontrado o usa autenticación externa');
  }
  
  const isValidPassword = await bcrypt.compare(currentPassword, user.password);
  
  if (!isValidPassword) {
    throw new Error('Contraseña actual incorrecta');
  }
  
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  await db.update(users)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(users.id, userId));
  
  // Revocar todos los tokens para forzar re-login
  await revokeAllUserTokens(userId);
};

/**
 * Obtener perfil de usuario
 */
export const getProfile = async (userId: string) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      avatarUrl: true,
      provider: true,
      notifyBadges: true,
      notifyLevelUp: true,
      createdAt: true,
    },
  });
  
  if (!user) {
    throw new Error('Usuario no encontrado');
  }
  
  return user;
};

/**
 * Actualizar perfil de usuario
 */
export const updateProfile = async (
  userId: string, 
  data: { firstName?: string; lastName?: string; avatarUrl?: string | null }
) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  
  if (!user) {
    throw new Error('Usuario no encontrado');
  }
  
  const updateData: Record<string, any> = { updatedAt: new Date() };
  
  if (data.firstName !== undefined) {
    updateData.firstName = data.firstName;
  }
  if (data.lastName !== undefined) {
    updateData.lastName = data.lastName;
  }
  if (data.avatarUrl !== undefined) {
    updateData.avatarUrl = data.avatarUrl;
  }
  
  await db.update(users)
    .set(updateData)
    .where(eq(users.id, userId));
  
  return getProfile(userId);
};

/**
 * Actualizar preferencias de notificaciones
 */
export const updateNotifications = async (
  userId: string, 
  data: { notifyBadges?: boolean; notifyLevelUp?: boolean }
) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  
  if (!user) {
    throw new Error('Usuario no encontrado');
  }
  
  const updateData: Record<string, any> = { updatedAt: new Date() };
  
  if (data.notifyBadges !== undefined) {
    updateData.notifyBadges = data.notifyBadges;
  }
  if (data.notifyLevelUp !== undefined) {
    updateData.notifyLevelUp = data.notifyLevelUp;
  }
  
  await db.update(users)
    .set(updateData)
    .where(eq(users.id, userId));
  
  return getProfile(userId);
};

/**
 * Generar tokens para un usuario existente (usado en Google OAuth callback)
 */
export const generateTokensForUser = async (userId: string): Promise<{ accessToken: string; refreshToken: string }> => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  
  if (!user) {
    throw new Error('Usuario no encontrado');
  }
  
  const tokens = await generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
  });
  
  return tokens;
};
