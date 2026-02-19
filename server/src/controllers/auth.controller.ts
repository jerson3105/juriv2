import { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import * as authService from '../services/auth.service.js';
import { config_app } from '../config/env.js';
import { cache } from '../utils/cache.js';
import { OAUTH_STATE_COOKIE_NAME } from '../utils/oauth-state.js';

// Schema de validación de contraseña robusta
const passwordSchema = z.string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
  .regex(/[a-z]/, 'Debe contener al menos una letra minúscula')
  .regex(/[0-9]/, 'Debe contener al menos un número')
  .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial (@$!%*?&#)');

// Schemas de validación
const registerSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  password: passwordSchema,
  firstName: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().trim().min(2, 'El apellido debe tener al menos 2 caracteres'),
  role: z.enum(['TEACHER', 'STUDENT', 'PARENT']),
});

const loginSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1, 'Token de actualización requerido'),
});

const logoutSchema = z.object({
  refreshToken: z.string().trim().min(1, 'Token de actualización requerido'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: passwordSchema,
});

const updateProfileSchema = z.object({
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres').optional(),
  avatarUrl: z.string().url('URL de avatar inválida').nullable().optional(),
});

const googleCodeExchangeSchema = z.object({
  code: z.string().trim().uuid('Código inválido'),
});

const completeGoogleRegistrationSchema = z.object({
  code: z.string().trim().uuid('Código inválido'),
  role: z.enum(['TEACHER', 'STUDENT', 'PARENT']),
});

type PendingGoogleRegistrationData = {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
};

const OAUTH_CODE_TTL_SECONDS = 60;
const OAUTH_REGISTRATION_CODE_TTL_SECONDS = 300;
const oauthCodeKey = (code: string) => `oauth:code:${code}`;
const oauthRegistrationCodeKey = (code: string) => `oauth:registration:${code}`;

const clearOAuthStateCookie = (res: Response) => {
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config_app.isProd,
    path: '/api/auth',
  });
};

const issueOAuthCode = (tokens: { accessToken: string; refreshToken: string }): string => {
  const code = uuidv4();
  cache.set(oauthCodeKey(code), tokens, OAUTH_CODE_TTL_SECONDS);
  return code;
};

const consumeOAuthCode = (code: string): { accessToken: string; refreshToken: string } | null => {
  const key = oauthCodeKey(code);
  const tokens = cache.get<{ accessToken: string; refreshToken: string }>(key);
  if (!tokens) return null;

  cache.delete(key);
  return tokens;
};

const issueOAuthRegistrationCode = (googleData: PendingGoogleRegistrationData): string => {
  const code = uuidv4();
  cache.set(oauthRegistrationCodeKey(code), googleData, OAUTH_REGISTRATION_CODE_TTL_SECONDS);
  return code;
};

const consumeOAuthRegistrationCode = (code: string): PendingGoogleRegistrationData | null => {
  const key = oauthRegistrationCodeKey(code);
  const googleData = cache.get<PendingGoogleRegistrationData>(key);
  if (!googleData) return null;

  cache.delete(key);
  return googleData;
};

const isPendingGoogleRegistrationData = (value: unknown): value is PendingGoogleRegistrationData => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PendingGoogleRegistrationData>;
  if (typeof candidate.googleId !== 'string' || !candidate.googleId.trim()) {
    return false;
  }

  if (typeof candidate.email !== 'string' || !candidate.email.trim()) {
    return false;
  }

  if (typeof candidate.firstName !== 'string') {
    return false;
  }

  if (typeof candidate.lastName !== 'string') {
    return false;
  }

  if (
    candidate.avatarUrl !== undefined &&
    candidate.avatarUrl !== null &&
    typeof candidate.avatarUrl !== 'string'
  ) {
    return false;
  }

  return true;
};

const getAuthStatusCode = (error: Error): number => {
  const normalizedMessage = error.message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalizedMessage.includes('credenciales invalidas')) {
    return 401;
  }

  if (
    normalizedMessage.includes('token de actualizacion invalido') ||
    normalizedMessage.includes('token de actualizacion expirado') ||
    normalizedMessage.includes('token de actualizacion invalido o expirado')
  ) {
    return 401;
  }

  if (normalizedMessage.includes('token de actualizacion requerido')) {
    return 400;
  }

  if (
    normalizedMessage.includes('codigo invalido') ||
    normalizedMessage.includes('codigo expirado') ||
    normalizedMessage.includes('codigo de registro invalido') ||
    normalizedMessage.includes('codigo de registro expirado')
  ) {
    return 400;
  }

  if (normalizedMessage.includes('desactivada') || normalizedMessage.includes('no autorizado')) {
    return 403;
  }

  if (normalizedMessage.includes('no encontrado')) {
    return 404;
  }

  if (
    normalizedMessage.includes('ya esta registrado') ||
    normalizedMessage.includes('ya esta registrada') ||
    normalizedMessage.includes('ya está registrado') ||
    normalizedMessage.includes('ya está registrada')
  ) {
    return 409;
  }

  if (
    normalizedMessage.includes('datos invalidos') ||
    normalizedMessage.includes('datos inválidos') ||
    normalizedMessage.includes('invalido') ||
    normalizedMessage.includes('invalida') ||
    normalizedMessage.includes('inválido') ||
    normalizedMessage.includes('inválida') ||
    normalizedMessage.includes('requerido')
  ) {
    return 400;
  }

  return 500;
};

const handleValidationError = (res: Response, error: z.ZodError) => {
  res.status(400).json({
    success: false,
    message: 'Datos de entrada inválidos',
    errors: error.errors,
  });
};

const handleAuthError = (res: Response, error: unknown, fallbackMessage = 'Error interno del servidor') => {
  if (error instanceof z.ZodError) {
    handleValidationError(res, error);
    return;
  }

  if (error instanceof Error) {
    const statusCode = getAuthStatusCode(error);
    res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? fallbackMessage : error.message,
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
};

/**
 * POST /api/auth/register
 * Registrar nuevo usuario
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const result = await authService.register(validatedData);
    
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: result,
    });
  } catch (error) {
    handleAuthError(res, error, 'Error al registrar usuario');
  }
};

/**
 * POST /api/auth/login
 * Iniciar sesión
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await authService.login(validatedData);
    
    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: result,
    });
  } catch (error) {
    handleAuthError(res, error);
  }
};

/**
 * POST /api/auth/refresh
 * Refrescar tokens
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokens = await authService.refreshTokens(refreshToken);
    
    res.json({
      success: true,
      message: 'Tokens actualizados',
      data: tokens,
    });
  } catch (error) {
    handleAuthError(res, error);
  }
};

/**
 * POST /api/auth/logout
 * Cerrar sesión
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = logoutSchema.parse(req.body);
    await authService.logout(refreshToken);
    
    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente',
    });
  } catch (error) {
    handleAuthError(res, error, 'Error al cerrar sesión');
  }
};

/**
 * POST /api/auth/logout-all
 * Cerrar todas las sesiones
 */
export const logoutAll = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }
    
    await authService.logoutAll(req.user.id);
    
    res.json({
      success: true,
      message: 'Todas las sesiones han sido cerradas',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al cerrar sesiones',
    });
  }
};

/**
 * GET /api/auth/me
 * Obtener perfil del usuario autenticado
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }
    
    const profile = await authService.getProfile(req.user.id);
    
    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * PUT /api/auth/change-password
 * Cambiar contraseña
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }
    
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user.id, currentPassword, newPassword);
    
    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente. Por favor, inicia sesión nuevamente.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: error.errors,
      });
      return;
    }
    
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * PUT /api/auth/profile
 * Actualizar perfil del usuario
 */
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }
    
    const data = updateProfileSchema.parse(req.body);
    const updatedUser = await authService.updateProfile(req.user.id, data);
    
    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: updatedUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: error.errors,
      });
      return;
    }
    
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * POST /api/auth/upload-avatar
 * Subir avatar del usuario
 */
export const uploadAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }
    
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No se proporcionó ninguna imagen',
      });
      return;
    }
    
    const avatarUrl = `/api/static/avatars/${req.file.filename}`;
    const updatedUser = await authService.updateProfile(req.user.id, { avatarUrl });
    
    res.json({
      success: true,
      message: 'Avatar actualizado exitosamente',
      data: updatedUser,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * PUT /api/auth/notifications
 * Actualizar preferencias de notificaciones
 */
export const updateNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }
    
    const { notifyBadges, notifyLevelUp } = req.body;
    const updatedUser = await authService.updateNotifications(req.user.id, {
      notifyBadges,
      notifyLevelUp,
    });
    
    res.json({
      success: true,
      message: 'Preferencias de notificaciones actualizadas',
      data: updatedUser,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * GET /api/auth/google/callback
 * Callback de autenticación con Google
 */
export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as any;
    
    if (!user) {
      clearOAuthStateCookie(res);
      res.redirect(`${config_app.clientUrl}/login?error=google_auth_failed`);
      return;
    }

    // Verificar si es un usuario nuevo que necesita seleccionar rol
    if (user.needsRoleSelection && user.googleData) {
      if (!isPendingGoogleRegistrationData(user.googleData)) {
        clearOAuthStateCookie(res);
        res.redirect(`${config_app.clientUrl}/login?error=google_auth_failed`);
        return;
      }

      const registrationCode = issueOAuthRegistrationCode(user.googleData);
      const redirectUrl = new URL(`${config_app.clientUrl}/auth/select-role`);
      redirectUrl.searchParams.set('code', registrationCode);
      redirectUrl.hash = `code=${encodeURIComponent(registrationCode)}`;

      clearOAuthStateCookie(res);
      res.redirect(redirectUrl.toString());
      return;
    }

    if (typeof user.id !== 'string' || !user.id.trim()) {
      clearOAuthStateCookie(res);
      res.redirect(`${config_app.clientUrl}/login?error=google_auth_failed`);
      return;
    }

    // Generar tokens JWT para el usuario
    const tokens = await authService.generateTokensForUser(user.id);
    const code = issueOAuthCode(tokens);
    
    // Redirigir al frontend con un código de un solo uso (evita exponer tokens en URL)
    const redirectUrl = new URL(`${config_app.clientUrl}/auth/google/callback`);
    redirectUrl.searchParams.set('code', code);
    redirectUrl.hash = `code=${encodeURIComponent(code)}`;
    
    clearOAuthStateCookie(res);
    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Error en Google callback:', error);
    clearOAuthStateCookie(res);
    res.redirect(`${config_app.clientUrl}/login?error=google_auth_failed`);
  }
};

/**
 * POST /api/auth/google/exchange-code
 * Intercambiar código OAuth de un solo uso por tokens JWT
 */
export const exchangeGoogleCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = googleCodeExchangeSchema.parse(req.body);
    const tokens = consumeOAuthCode(code);

    if (!tokens) {
      res.status(400).json({
        success: false,
        message: 'Código inválido o expirado',
      });
      return;
    }

    res.json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    handleAuthError(res, error, 'Error al completar autenticación con Google');
  }
};

/**
 * POST /api/auth/google/complete-registration
 * Completar registro de Google con rol seleccionado
 */
export const completeGoogleRegistration = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, role } = completeGoogleRegistrationSchema.parse(req.body);
    const googleData = consumeOAuthRegistrationCode(code);

    if (!googleData) {
      res.status(400).json({
        success: false,
        message: 'Código de registro inválido o expirado',
      });
      return;
    }

    const result = await authService.completeGoogleRegistration(googleData, role);
    
    res.json({
      success: true,
      message: 'Registro completado exitosamente',
      data: result,
    });
  } catch (error) {
    handleAuthError(res, error, 'Error al completar registro con Google');
  }
};
