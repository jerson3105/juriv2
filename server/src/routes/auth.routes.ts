import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import passport from 'passport';
import * as authController from '../controllers/auth.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  authTokenLimiter, loginAccountLimiter, loginIpLimiter, oauthLimiter, pinLoginLimiter, registerLimiter, studentCodeLimiter,
} from '../middleware/security.js';
import { config_app } from '../config/env.js';
import { createUploadFilter, safeUploadFilename, verifyUploadedFile, IMAGE_MIMES } from '../utils/fileValidation.js';
import {
  generateOAuthState,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_MAX_AGE_MS,
} from '../utils/oauth-state.js';

const router = Router();

// Configuración de multer para avatares
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars');
  },
  filename: safeUploadFilename,
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: createUploadFilter(IMAGE_MIMES, 'Tipo de archivo no permitido. Solo PNG, JPG, GIF, WebP'),
});

// Rutas públicas (con rate limiting estricto)
router.post('/register', registerLimiter, authController.register);
router.post('/login', loginIpLimiter, loginAccountLimiter, authController.login);
router.post('/login/totp', loginIpLimiter, authController.loginWithTotp);
router.post('/student-code/verify', studentCodeLimiter, authController.verifyStudentCode);
router.post('/join-code/verify', studentCodeLimiter, authController.verifyJoinCode);
router.post('/student-code/register', studentCodeLimiter, authController.registerStudentWithCode);
// Alumnos sin correo: lista de la clase, crear PIN y entrar con PIN (además del bloqueo por cuenta).
router.post('/class-roster', studentCodeLimiter, authController.getClassRoster);
router.post('/pin/setup', studentCodeLimiter, authController.setupPin);
router.post('/pin/login', pinLoginLimiter, authController.loginWithPin);
router.post('/refresh', authTokenLimiter, authController.refresh);
router.post('/logout', authTokenLimiter, authController.logout);

// Rutas protegidas
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, authController.updateProfile);
router.post('/upload-avatar', authenticate, avatarUpload.single('avatar'), verifyUploadedFile, authController.uploadAvatar);
router.put('/notifications', authenticate, authController.updateNotifications);
router.post('/logout-all', authenticate, authController.logoutAll);
router.put('/change-password', authenticate, authController.changePassword);
router.put('/pin', authenticate, authorize('STUDENT'), pinLoginLimiter, authController.changePin);
router.get('/switch-to-student', authenticate, authorize('TEACHER'), authController.getStudentSwitch);
router.get('/teacher-status', authenticate, authorize('TEACHER'), authController.getTeacherStatus);
router.post('/teacher-status/request', authenticate, authorize('TEACHER'), authController.requestTeacherReview);
router.post('/switch-to-student', authenticate, authorize('TEACHER'), authController.switchToStudent);

// ==================== GOOGLE OAUTH ====================
// Iniciar autenticación con Google
router.get('/google', (req, res, next) => {
  const role = typeof req.query.role === 'string' ? req.query.role : undefined;
  const { state, nonce } = generateOAuthState(role);

  res.cookie(OAUTH_STATE_COOKIE_NAME, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config_app.isProd,
    maxAge: OAUTH_STATE_MAX_AGE_MS,
    path: '/api/auth',
  });

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state,
    // En computadoras compartidas del colegio, Google no debe entrar solo con la cuenta del alumno anterior.
    prompt: 'select_account',
  } as passport.AuthenticateOptions)(req, res, next);
});

// Callback de Google. Los fallos esperados vuelven al login con un código que la pantalla explica
// (antes salían como JSON 500).
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (error: unknown, user: unknown, info?: { code?: string }) => {
    if (error || !user) {
      if (error) console.error('Error en Google OAuth:', error);
      const code = info?.code ?? 'google_auth_failed';
      res.redirect(`${config_app.clientUrl}/login?error=${encodeURIComponent(code)}`);
      return;
    }
    req.user = user as Express.User;
    next();
  })(req, res, next);
}, authController.googleCallback);

// Completar registro de Google con rol seleccionado
router.post('/google/complete-registration', oauthLimiter, authController.completeGoogleRegistration);
router.post('/google/exchange-code', oauthLimiter, authController.exchangeGoogleCode);

export default router;
