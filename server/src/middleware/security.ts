import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config_app } from '../config/env.js';
import type { Express } from 'express';

// Configurar CORS
export const corsOptions = {
  origin: config_app.isDev 
    ? true  // Permitir cualquier origen en desarrollo
    : config_app.clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Rate limiter general (más permisivo para desarrollo y polling)
export const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: config_app.isDev ? 500 : 200, // más permisivo en desarrollo
  message: {
    success: false,
    message: 'Demasiadas solicitudes, por favor intenta más tarde.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Excluir rutas de polling frecuente del rate limit
    return req.path.includes('/state') || req.path.includes('/unread-count');
  },
});

// Rate limiter para autenticación (más estricto)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos de login
  message: {
    success: false,
    message: 'Demasiados intentos de inicio de sesión, intenta en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar middleware de seguridad
export const applySecurityMiddleware = (app: Express): void => {
  // Helmet para headers de seguridad
  app.use(helmet({
    contentSecurityPolicy: config_app.isProd ? undefined : false,
  }));
  
  // CORS
  app.use(cors(corsOptions));
  
  // Rate limiting general
  app.use(generalLimiter);
};
