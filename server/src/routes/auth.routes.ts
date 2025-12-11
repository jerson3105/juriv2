import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import passport from 'passport';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/security.js';
import { config_app } from '../config/env.js';

const router = Router();

// Configuración de multer para avatares
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo PNG, JPG, GIF, WebP'));
    }
  },
});

// Rutas públicas (con rate limiting estricto)
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// Rutas protegidas
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, authController.updateProfile);
router.post('/upload-avatar', authenticate, avatarUpload.single('avatar'), authController.uploadAvatar);
router.put('/notifications', authenticate, authController.updateNotifications);
router.post('/logout-all', authenticate, authController.logoutAll);
router.put('/change-password', authenticate, authController.changePassword);

// ==================== GOOGLE OAUTH ====================
// Iniciar autenticación con Google
router.get('/google', (req, res, next) => {
  const role = req.query.role || 'TEACHER';
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false,
    state: role as string, // Pasar el rol como state para recuperarlo en el callback
  })(req, res, next);
});

// Callback de Google
router.get('/google/callback', 
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${config_app.clientUrl}/login?error=google_auth_failed`
  }),
  authController.googleCallback
);

export default router;
