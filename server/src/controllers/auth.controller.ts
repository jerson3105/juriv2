import { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import * as authService from '../services/auth.service.js';
import { config_app } from '../config/env.js';
import { cache } from '../utils/cache.js';
import { OAUTH_STATE_COOKIE_NAME } from '../utils/oauth-state.js';
import { passwordSchema } from '../utils/passwordPolicy.js';
import { AppError } from '../utils/errors.js';
import { corsOptions } from '../middleware/security.js';
import { SessionError } from '../utils/jwt.js';
import { teacherVerificationService } from '../services/teacherVerification.service.js';
import { studentPinService } from '../services/studentPin.service.js';
import { recordAudit } from '../utils/audit.js';
import jwt from 'jsonwebtoken';

// Schema de validación de contraseña robusta

// Schemas de validación
const registerSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  password: passwordSchema,
  firstName: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().trim().min(2, 'El apellido debe tener al menos 2 caracteres'),
  role: z.enum(['TEACHER', 'STUDENT', 'PARENT']),
});

const studentCodeVerificationSchema = z.object({
  code: z.string().trim().min(6, 'El código debe tener entre 6 y 8 caracteres').max(8, 'El código debe tener entre 6 y 8 caracteres'),
});

// Con la tarjeta (code) o con el nombre de la lista de su clase (classCode + studentId).
const registerStudentWithCodeSchema = z.object({
  code: z.string().trim().min(6, 'El código debe tener entre 6 y 8 caracteres').max(8, 'El código debe tener entre 6 y 8 caracteres').optional(),
  classCode: z.string().trim().min(6).max(12).optional(),
  studentId: z.string().uuid().optional(),
  email: z.string().trim().email('Email inválido'),
  password: passwordSchema,
  avatarGender: z.enum(['MALE', 'FEMALE']).default('MALE'),
}).refine((d) => !!d.code || (!!d.classCode && !!d.studentId), 'Falta tu código o tu nombre');

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
  // Solo http(s): z.url() acepta esquemas como `javascript:`.
  avatarUrl: z.string().url('URL de avatar inválida')
    .refine((url) => /^https?:\/\//i.test(url), 'URL de avatar inválida')
    .nullable().optional(),
});

const googleCodeExchangeSchema = z.object({
  code: z.string().trim().optional(),
});

const completeGoogleRegistrationSchema = z.object({
  code: z.string().trim().optional(),
  role: z.enum(['TEACHER', 'STUDENT', 'PARENT']),
});

const oauthCodeSchema = z.string().trim().uuid('Código inválido');

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
const OAUTH_CODE_COOKIE_NAME = 'oauth_code_nonce';
const OAUTH_REGISTRATION_CODE_COOKIE_NAME = 'oauth_registration_code_nonce';

const getOAuthCookieDomain = (): string | undefined => {
  if (!config_app.isProd) {
    return undefined;
  }

  try {
    const hostname = new URL(config_app.clientUrl).hostname;

    if (hostname === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      return undefined;
    }

    const parts = hostname.split('.').filter(Boolean);
    if (parts.length < 2) {
      return undefined;
    }

    return `.${parts.slice(-2).join('.')}`;
  } catch {
    return undefined;
  }
};

const oauthCookieDomain = getOAuthCookieDomain();
const oauthCookieBaseOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config_app.isProd,
  path: '/api/auth',
  ...(oauthCookieDomain ? { domain: oauthCookieDomain } : {}),
};

// ==================== Cookie de sesión ====================
// El refresh viaja en una cookie httpOnly (JavaScript no la lee: un XSS ya no se lleva la sesión).
// Alumnos y administración: cookie de sesión, se borra al cerrar el navegador (equipos compartidos).
const SESSION_COOKIE = 'juried_rt';
const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config_app.isProd,
  path: '/api/auth',
  ...(oauthCookieDomain ? { domain: oauthCookieDomain } : {}),
};

const setSessionCookie = (res: Response, tokens: { refreshToken: string; persistent?: boolean; expiresAt?: Date }) => {
  const maxAge = tokens.persistent === false || !tokens.expiresAt ? undefined : Math.max(0, tokens.expiresAt.getTime() - Date.now());
  res.cookie(SESSION_COOKIE, tokens.refreshToken, { ...sessionCookieOptions, ...(maxAge ? { maxAge } : {}) });
};

const clearSessionCookie = (res: Response) => {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
};

/** Datos de sesión para el cuerpo: sin el refresh (va en la cookie) ni detalles de la sesión. */
const publicAuth = <T extends { refreshToken: string; sessionId?: string; persistent?: boolean; expiresAt?: Date }>(result: T) => {
  const { refreshToken: _refresh, sessionId: _sid, persistent: _persistent, expiresAt: _expires, ...rest } = result;
  return rest;
};

const sendAuth = <T extends { refreshToken: string; sessionId?: string; persistent?: boolean; expiresAt?: Date }>(
  res: Response, status: number, message: string, result: T,
) => {
  setSessionCookie(res, result);
  res.status(status).json({ success: true, message, data: publicAuth(result) });
};

/**
 * La cookie solo se usa en peticiones de la propia app: cabecera X-Juried-Client y origen permitido
 * (una página ajena no puede añadir esa cabecera sin que CORS la bloquee).
 */
const isTrustedAppRequest = (req: Request): boolean => {
  if (req.get('x-juried-client') !== '1') return false;
  const origin = req.get('origin');
  if (!origin) return true;
  const allowed = Array.isArray(corsOptions.origin) ? corsOptions.origin : [corsOptions.origin];
  return allowed.includes(origin);
};

const sidFromAccessToken = (req: Request): string | null => {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(header.slice(7).trim(), config_app.jwt.secret, { algorithms: ['HS256'], ignoreExpiration: true }) as { sid?: string };
    return decoded.sid ?? null;
  } catch {
    return null;
  }
};

const getCookieValue = (req: Request, cookieName: string): string | undefined => {
  const cookieBag = (req as Request & { cookies?: Record<string, unknown> }).cookies;
  const value = cookieBag?.[cookieName];
  return typeof value === 'string' ? value : undefined;
};

const parseOAuthCode = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const parsed = oauthCodeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

// El código de un solo uso se ata al navegador que inició el login: debe venir en la cookie y, si el
// cliente también lo manda, coincidir. Así nadie puede abrirle a otro un enlace con su propia sesión.
const resolveOAuthCode = (req: Request, bodyCode: string | undefined, cookieName: string): string | null => {
  const cookieCode = parseOAuthCode(getCookieValue(req, cookieName));
  if (!cookieCode) return null;
  if (bodyCode && parseOAuthCode(bodyCode) !== cookieCode) return null;
  return cookieCode;
};

const setOAuthCodeCookie = (res: Response, code: string) => {
  res.cookie(OAUTH_CODE_COOKIE_NAME, code, {
    ...oauthCookieBaseOptions,
    maxAge: OAUTH_CODE_TTL_SECONDS * 1000,
  });
};

const clearOAuthCodeCookie = (res: Response) => {
  res.clearCookie(OAUTH_CODE_COOKIE_NAME, oauthCookieBaseOptions);
};

const setOAuthRegistrationCodeCookie = (res: Response, code: string) => {
  res.cookie(OAUTH_REGISTRATION_CODE_COOKIE_NAME, code, {
    ...oauthCookieBaseOptions,
    maxAge: OAUTH_REGISTRATION_CODE_TTL_SECONDS * 1000,
  });
};

const clearOAuthRegistrationCodeCookie = (res: Response) => {
  res.clearCookie(OAUTH_REGISTRATION_CODE_COOKIE_NAME, oauthCookieBaseOptions);
};

const clearOAuthStateCookie = (res: Response) => {
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config_app.isProd,
    path: '/api/auth',
  });
};

type OAuthTokens = { accessToken: string; refreshToken: string; persistent?: boolean; expiresAt?: Date };

const issueOAuthCode = (tokens: OAuthTokens): string => {
  const code = uuidv4();
  cache.set(oauthCodeKey(code), tokens, OAUTH_CODE_TTL_SECONDS);
  return code;
};

const consumeOAuthCode = (code: string): OAuthTokens | null => {
  const key = oauthCodeKey(code);
  const tokens = cache.get<OAuthTokens>(key);
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
    (normalizedMessage.includes('codigo') && normalizedMessage.includes('invalido')) ||
    normalizedMessage.includes('codigo expirado') ||
    normalizedMessage.includes('codigo de registro invalido') ||
    normalizedMessage.includes('codigo de registro expirado')
  ) {
    return 400;
  }

  if (
    normalizedMessage.includes('ya esta registrado') ||
    normalizedMessage.includes('ya esta registrada') ||
    normalizedMessage.includes('ya fue usado')
  ) {
    return 409;
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

  if (error instanceof AppError) {
    res.status(error.statusCode).json({ success: false, message: error.statusCode >= 500 ? fallbackMessage : error.message });
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
    sendAuth(res, 201, 'Usuario registrado exitosamente', result);
  } catch (error) {
    handleAuthError(res, error, 'Error al registrar usuario');
  }
};

/**
 * POST /api/auth/student-code/verify
 * Verificar código de estudiante para activación de cuenta
 */
export const verifyStudentCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = studentCodeVerificationSchema.parse(req.body);
    const result = await authService.verifyStudentRegistrationCode(code);

    if (!result) {
      res.status(404).json({
        success: false,
        message: 'Código de estudiante no encontrado',
      });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleAuthError(res, error, 'Error al verificar el código de estudiante');
  }
};

/**
 * POST /api/auth/student-code/register
 * Crear cuenta de estudiante y vincularla con un código oficial
 */
export const registerStudentWithCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = registerStudentWithCodeSchema.parse(req.body);
    const result = await authService.registerStudentWithCode(validatedData);
    sendAuth(res, 201, 'Cuenta de estudiante activada exitosamente', result);
  } catch (error) {
    handleAuthError(res, error, 'Error al activar la cuenta de estudiante');
  }
};

/**
 * POST /api/auth/login
 * Iniciar sesión
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await authService.login(validatedData, { ip: req.ip ?? null });
    if (result.user.role === 'ADMIN') {
      await recordAudit({ action: 'auth.admin_login', actor: { id: result.user.id, role: 'ADMIN' }, metadata: { provider: 'LOCAL' }, ip: req.ip ?? null });
    }
    sendAuth(res, 200, 'Inicio de sesión exitoso', result);
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
    const cookieToken = getCookieValue(req, SESSION_COOKIE);
    if (cookieToken && !isTrustedAppRequest(req)) {
      res.status(403).json({ success: false, message: 'Solicitud no permitida' });
      return;
    }
    const refreshToken = cookieToken ?? refreshSchema.parse(req.body).refreshToken;
    const tokens = await authService.refreshTokens(refreshToken, req.get('user-agent'));
    setSessionCookie(res, tokens);
    res.json({ success: true, message: 'Tokens actualizados', data: { accessToken: tokens.accessToken } });
  } catch (error) {
    if (error instanceof SessionError) {
      clearSessionCookie(res);
      res.status(401).json({ success: false, message: error.message, code: error.code === 'INVALID' ? 'REFRESH_INVALID' : `SESSION_${error.code}` });
      return;
    }
    handleAuthError(res, error);
  }
};

/**
 * POST /api/auth/logout
 * Cerrar sesión
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const cookieToken = getCookieValue(req, SESSION_COOKIE);
    if (cookieToken && !isTrustedAppRequest(req)) {
      res.status(403).json({ success: false, message: 'Solicitud no permitida' });
      return;
    }
    const bodyToken = logoutSchema.safeParse(req.body ?? {});
    const refreshToken = cookieToken ?? (bodyToken.success ? bodyToken.data.refreshToken : undefined);
    if (refreshToken) {
      await authService.logout(refreshToken);
    } else {
      const sid = sidFromAccessToken(req);
      if (sid) await authService.logoutSession(sid);
    }
    clearSessionCookie(res);
    
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
    clearSessionCookie(res);
    
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
    clearOAuthCodeCookie(res);
    clearOAuthRegistrationCodeCookie(res);

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
      setOAuthRegistrationCodeCookie(res, registrationCode);

      const redirectUrl = new URL(`${config_app.clientUrl}/auth/select-role`);
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
    if (user.role === 'ADMIN') {
      await recordAudit({ action: 'auth.admin_login', actor: { id: user.id, role: 'ADMIN' }, metadata: { provider: 'GOOGLE' }, ip: req.ip ?? null });
    }
    const code = issueOAuthCode(tokens);
    setOAuthCodeCookie(res, code);
    
    // Redirigir al frontend con un código de un solo uso (evita exponer tokens en URL)
    const redirectUrl = new URL(`${config_app.clientUrl}/auth/google/callback`);
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
    const { code: bodyCode } = googleCodeExchangeSchema.parse(req.body);
    const code = resolveOAuthCode(req, bodyCode, OAUTH_CODE_COOKIE_NAME);
    clearOAuthCodeCookie(res);

    if (!code) {
      res.status(400).json({
        success: false,
        message: 'Código inválido o ausente',
      });
      return;
    }

    const tokens = consumeOAuthCode(code);

    if (!tokens) {
      res.status(400).json({
        success: false,
        message: 'Código inválido o expirado',
      });
      return;
    }

    sendAuth(res, 200, 'Inicio de sesión con Google', tokens);
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
    const { code: bodyCode, role } = completeGoogleRegistrationSchema.parse(req.body);
    const code = resolveOAuthCode(req, bodyCode, OAUTH_REGISTRATION_CODE_COOKIE_NAME);
    clearOAuthRegistrationCodeCookie(res);

    if (!code) {
      res.status(400).json({
        success: false,
        message: 'Código de registro inválido o ausente',
      });
      return;
    }

    const googleData = consumeOAuthRegistrationCode(code);

    if (!googleData) {
      res.status(400).json({
        success: false,
        message: 'Código de registro inválido o expirado',
      });
      return;
    }

    const result = await authService.completeGoogleRegistration(googleData, role);
    sendAuth(res, 200, 'Registro completado exitosamente', result);
  } catch (error) {
    handleAuthError(res, error, 'Error al completar registro con Google');
  }
};

/**
 * GET /api/auth/switch-to-student — ¿Puede esta cuenta de docente pasar a estudiante?
 * POST /api/auth/switch-to-student — Hace el cambio y devuelve una sesión nueva de estudiante.
 */
export const getStudentSwitch = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await authService.getStudentSwitchEligibility(req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    handleAuthError(res, error, 'No se pudo revisar la cuenta');
  }
};

export const switchToStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await authService.switchTeacherToStudent(req.user!.id);
    sendAuth(res, 200, 'Tu cuenta ahora es de estudiante', result);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    handleAuthError(res, error, 'No se pudo cambiar la cuenta');
  }
};

/**
 * POST /api/auth/join-code/verify — Puerta del alumno: código de clase o personal, sin sesión.
 */
export const verifyJoinCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = z.object({ code: z.string().trim().min(6).max(12) }).parse(req.body).code;
    const result = await authService.verifyJoinCode(code);
    if (!result) {
      res.status(404).json({ success: false, message: 'No encontramos ese código. Revísalo letra por letra con tu profe.' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    handleAuthError(res, error, 'No se pudo revisar el código');
  }
};

/**
 * GET /api/auth/teacher-status — Estado de verificación del docente.
 * POST /api/auth/teacher-status/request — Pedir revisión al equipo de Juried.
 */
export const getTeacherStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: await teacherVerificationService.getStatus(req.user!.id) });
  } catch (error) {
    handleAuthError(res, error, 'No se pudo obtener el estado');
  }
};

export const requestTeacherReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { note } = z.object({ note: z.string().trim().min(10, 'Cuéntanos tu colegio y tu curso').max(500) }).parse(req.body);
    res.json({ success: true, data: await teacherVerificationService.requestReview(req.user!.id, note) });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    handleAuthError(res, error, 'No se pudo enviar la solicitud');
  }
};

// ==================== Alumnos sin correo (PIN) ====================
const pinSchema = z.string().regex(/^[0-9]{4}$/, 'El PIN tiene 4 números');
const classCodeSchema = z.string().trim().min(6).max(12);

/**
 * POST /api/auth/class-roster — Puerta /unirse: la lista de la clase (nombres parciales) para
 * elegir su nombre. Sin sesión.
 */
export const getClassRoster = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = z.object({ code: classCodeSchema }).parse(req.body);
    const roster = await studentPinService.getClassRoster(code);
    if (!roster) {
      res.status(404).json({ success: false, message: 'No encontramos esa clase. Revisa el código con tu profe.' });
      return;
    }
    res.json({ success: true, data: roster });
  } catch (error) {
    handleAuthError(res, error, 'No se pudo cargar la lista de la clase');
  }
};

/** POST /api/auth/pin/setup — Crear el PIN con la tarjeta o eligiendo su nombre (clase abierta). */
export const setupPin = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = z.object({
      linkCode: z.string().trim().min(6).max(8).optional(),
      classCode: classCodeSchema.optional(),
      studentId: z.string().uuid().optional(),
      pin: pinSchema,
      avatarGender: z.enum(['MALE', 'FEMALE']).optional(),
    }).refine((d) => !!d.linkCode || (!!d.classCode && !!d.studentId), 'Falta tu código o tu nombre').parse(req.body);
    const result = await studentPinService.setupPin(data, req.get('user-agent'));
    sendAuth(res, 201, 'Tu PIN está listo', result);
  } catch (error) {
    handleAuthError(res, error, 'No se pudo crear tu PIN');
  }
};

/** POST /api/auth/pin/login — Código de la clase + nombre + PIN. */
export const loginWithPin = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = z.object({ classCode: classCodeSchema, studentId: z.string().uuid(), pin: pinSchema }).parse(req.body);
    const result = await studentPinService.loginWithPin(data, req.get('user-agent'), req.ip ?? null);
    sendAuth(res, 200, 'Inicio de sesión exitoso', result);
  } catch (error) {
    handleAuthError(res, error, 'No se pudo iniciar sesión');
  }
};

/** PUT /api/auth/pin — El alumno cambia su PIN; cierra sus otras sesiones y sigue en esta. */
export const changePin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPin, newPin } = z.object({ currentPin: pinSchema, newPin: pinSchema }).parse(req.body);
    const tokens = await studentPinService.changePin(req.user!.id, currentPin, newPin, req.get('user-agent'), req.ip ?? null);
    sendAuth(res, 200, 'PIN actualizado', tokens);
  } catch (error) {
    handleAuthError(res, error, 'No se pudo cambiar tu PIN');
  }
};
