import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import requestId from 'express-request-id';
import timeout from 'connect-timeout';
import compression from 'compression';
import { config_app } from '../config/env.js';
import type { Express } from 'express';

// Configurar CORS
export const corsOptions = {
  origin: config_app.isDev 
    ? ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174']
    : config_app.clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
};

// Rate limiter general
export const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: config_app.isDev ? 500 : 200,
  message: {
    success: false,
    message: 'Demasiadas solicitudes, por favor intenta más tarde.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter específico para polling (más permisivo pero no ilimitado)
export const pollingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: config_app.isDev ? 200 : 100,
  message: {
    success: false,
    message: 'Demasiadas solicitudes de polling.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para autenticación (más estricto)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: config_app.isDev ? 50 : 15, // más permisivo en dev
  message: {
    success: false,
    message: 'Demasiados intentos de inicio de sesión, intenta en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // No contar logins exitosos
});

// Aplicar middleware de seguridad
export const applySecurityMiddleware = (app: Express): void => {
  // Request ID para trazabilidad
  app.use(requestId());
  
  // Cookie parser
  app.use(cookieParser());
  
  // Compresión de responses
  app.use(compression({
    filter: (req: any, res: any) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6,
  }));
  
  // Timeout de 30 segundos
  app.use(timeout('30s'));
  
  // Helmet para headers de seguridad con CSP
  app.use(helmet({
    contentSecurityPolicy: config_app.isProd ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", config_app.clientUrl],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
  }));
  
  // CORS
  app.use(cors(corsOptions));
  
  // Rate limiting general
  app.use(generalLimiter);
  
  // Middleware para manejar timeouts
  app.use((req: any, res, next) => {
    if (!req.timedout) next();
  });
};
