import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import cors from 'cors';
import passport from 'passport';
import { config_app } from './config/env.js';
import { connectDatabase } from './db/index.js';
import { applySecurityMiddleware, corsOptions } from './middleware/security.js';
import { configurePassport } from './config/passport.js';
import routes from './routes/index.js';
import { logger, replaceConsole } from './utils/logger.js';
import { AppError } from './utils/errors.js';

// Crear aplicación Express
const app = express();

// Confiar en el proxy (necesario para express-rate-limit detrás de nginx/reverse proxy)
app.set('trust proxy', 1);

const httpServer = createServer(app);

// Configurar Socket.io
const io = new SocketServer(httpServer, {
  cors: corsOptions,
});

// Middleware de parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar Passport para Google OAuth
configurePassport();
app.use(passport.initialize());

// Servir archivos estáticos ANTES del middleware de seguridad (para evitar CORS issues)
app.use('/badges', cors(), express.static(path.join(process.cwd(), 'public', 'badges')));
app.use('/avatars', cors(), express.static(path.join(process.cwd(), 'uploads', 'avatars')));
app.use('/uploads/expeditions', cors(), express.static(path.join(process.cwd(), 'uploads', 'expeditions')));
app.use('/uploads/maps', cors(), express.static(path.join(process.cwd(), 'uploads', 'maps')));

// Aplicar middleware de seguridad
applySecurityMiddleware(app);

// Rutas de la API
app.use('/api', routes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    name: 'Juried API',
    version: '1.0.0',
    description: 'Plataforma de Gamificación Educativa',
    docs: '/api/health',
  });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
  });
});

// Manejo de errores global
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Log del error
  logger.error('Error capturado:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id,
  });

  // Si es un error operacional conocido
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Error no controlado
  res.status(500).json({
    success: false,
    message: config_app.isProd ? 'Error interno del servidor' : err.message,
  });
});

// Socket.io eventos básicos
io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`🔌 Cliente desconectado: ${socket.id}`);
  });
  
  // Unirse a sala de aula
  socket.on('join-classroom', (classroomId: string) => {
    socket.join(`classroom:${classroomId}`);
    console.log(`📚 Socket ${socket.id} se unió al aula ${classroomId}`);
  });
  
  // Salir de sala de aula
  socket.on('leave-classroom', (classroomId: string) => {
    socket.leave(`classroom:${classroomId}`);
  });
});

// Exportar io para usar en otros módulos
export { io };

// Iniciar servidor
const startServer = async () => {
  try {
    // Reemplazar console.log con logger en producción
    if (config_app.isProd) {
      replaceConsole();
    }

    // Conectar a la base de datos
    await connectDatabase();

    // Importar y configurar limpieza de tokens
    const { cleanExpiredTokens } = await import('./utils/jwt.js');
    
    // Limpiar tokens expirados cada 24 horas
    setInterval(async () => {
      try {
        await cleanExpiredTokens();
        logger.info('✅ Tokens expirados limpiados');
      } catch (error) {
        logger.error('❌ Error limpiando tokens expirados:', { error });
      }
    }, 24 * 60 * 60 * 1000); // 24 horas

    // Ejecutar limpieza inicial al iniciar
    cleanExpiredTokens().catch(err => 
      logger.error('Error en limpieza inicial de tokens:', { error: err })
    );
    
    // Iniciar servidor HTTP
    httpServer.listen(config_app.port, () => {
      logger.info(`
🎮 ═══════════════════════════════════════════════════
   JURIED - Plataforma de Gamificación Educativa
═══════════════════════════════════════════════════════
   🚀 Servidor:     http://localhost:${config_app.port}
   📡 API:          http://localhost:${config_app.port}/api
   🔌 WebSocket:    ws://localhost:${config_app.port}
   🌍 Entorno:      ${config_app.isDev ? 'Desarrollo' : 'Producción'}
═══════════════════════════════════════════════════════
      `);
    });
  } catch (error) {
    logger.error('❌ Error al iniciar el servidor:', { error });
    process.exit(1);
  }
};

startServer();
