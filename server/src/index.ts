import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import cors from 'cors';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { config_app } from './config/env.js';
import { connectDatabase, db, users } from './db/index.js';
import { applySecurityMiddleware, corsOptions } from './middleware/security.js';
import { configurePassport } from './config/passport.js';
import routes from './routes/index.js';
import { logger, replaceConsole } from './utils/logger.js';
import { AppError } from './utils/errors.js';
import { setIO } from './utils/notificationEmitter.js';
import { serveUploads } from './utils/fileValidation.js';
import { PERF_TRACE, perfMiddleware } from './utils/perfTrace.js';
import { userCanAccessClassroom } from './utils/access.js';
import { eq } from 'drizzle-orm';
import { announcementService } from './services/announcement.service.js';
import { chatService } from './services/chat.service.js';

// Crear aplicación Express
const app = express();

// Confiar en X-Forwarded-For solo si la conexión llega desde el propio host (Apache como proxy).
// Con `1` se confiaba en cualquier cliente: quien llegara directo al puerto 3001 podía falsear su IP
// y saltarse los rate limits.
app.set('trust proxy', 'loopback');

const httpServer = createServer(app);

// Configurar Socket.io
const io = new SocketServer(httpServer, {
  cors: corsOptions,
});

// Traza de rendimiento (solo con PERF_TRACE=1, para medir en local)
if (PERF_TRACE) app.use(perfMiddleware);

// Middleware de parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar Passport para Google OAuth
configurePassport();
app.use(passport.initialize());

// Servir archivos estáticos ANTES del middleware de seguridad (para evitar CORS issues)
// En producción, estos se sirven bajo /api/ para que pasen por el proxy de Apache
// NOTA: Usamos /api/static/avatars para archivos, porque /api/avatars es para rutas de API
const uploadsBaseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
// Los uploads deben vivir fuera de la raíz pública del servidor web: si Apache los sirve
// directamente, se saltan la validación y cabeceras de `serveUploads` (y podría ejecutar scripts).
if (/[\\/](public_html|www|htdocs)([\\/]|$)/i.test(uploadsBaseDir) && config_app.isProd) {
  logger.warn('⚠️ UPLOAD_DIR está dentro de una carpeta pública del servidor web; muévelo fuera de ella', {
    uploadsBaseDir,
  });
}
app.use('/api/badges', cors(corsOptions), ...serveUploads(path.join(process.cwd(), 'public', 'badges')));
app.use('/api/static/avatars', cors(corsOptions), ...serveUploads(path.join(uploadsBaseDir, 'avatars')));
app.use('/api/uploads/expeditions', cors(corsOptions), ...serveUploads(path.join(uploadsBaseDir, 'expeditions')));
app.use('/api/uploads/maps', cors(corsOptions), ...serveUploads(path.join(uploadsBaseDir, 'maps')));
app.use('/api/uploads/collectibles', cors(corsOptions), ...serveUploads(path.join(uploadsBaseDir, 'collectibles')));
app.use('/api/uploads/shop-items', cors(corsOptions), ...serveUploads(path.join(uploadsBaseDir, 'shop-items')));
app.use('/api/uploads/jiro-deliveries', cors(corsOptions), ...serveUploads(path.join(uploadsBaseDir, 'jiro-deliveries')));
// También mantener rutas sin /api para desarrollo local
app.use('/badges', cors(corsOptions), ...serveUploads(path.join(process.cwd(), 'public', 'badges')));
app.use('/avatars', cors(corsOptions), ...serveUploads(path.join(uploadsBaseDir, 'avatars')));
app.use('/uploads/expeditions', cors(corsOptions), ...serveUploads(path.join(uploadsBaseDir, 'expeditions')));
app.use('/uploads/maps', cors(corsOptions), ...serveUploads(path.join(uploadsBaseDir, 'maps')));
app.use('/uploads/collectibles', cors(corsOptions), ...serveUploads(path.join(uploadsBaseDir, 'collectibles')));

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

// Middleware de autenticación para Socket.io
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      logger.warn('Socket.io: Intento de conexión sin token', {
        socketId: socket.id,
        ip: socket.handshake.address,
      });
      return next(new Error('Authentication error: No token provided'));
    }
    
    // Verificar token JWT
    const decoded = jwt.verify(token, config_app.jwt.secret, { algorithms: ['HS256'] }) as {
      userId: string;
      email: string;
      role: string;
    };
    
    // Verificar que el usuario existe y está activo
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.userId),
    });
    
    if (!user || !user.isActive) {
      logger.warn('Socket.io: Usuario inválido o inactivo', {
        userId: decoded.userId,
        socketId: socket.id,
      });
      return next(new Error('Authentication error: Invalid user'));
    }
    
    // Guardar datos del usuario en el socket
    socket.data.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    
    logger.info('Socket.io: Usuario autenticado', {
      userId: user.id,
      socketId: socket.id,
      role: user.role,
    });
    
    next();
  } catch (error) {
    logger.error('Socket.io: Error de autenticación', {
      error: error instanceof Error ? error.message : 'Unknown error',
      socketId: socket.id,
    });
    next(new Error('Authentication error'));
  }
});

// Registrar io en el emitter centralizado
setIO(io);

// Socket.io eventos con autenticación
io.on('connection', (socket) => {
  const user = socket.data.user;
  
  // Auto-join user to their personal room for notifications
  socket.join(`user:${user.id}`);

  // Auto-join parents to their children's classroom rooms for announcements + chat
  if (user.role === 'PARENT') {
    announcementService.getClassroomIdsForParent(user.id).then(classroomIds => {
      for (const cid of classroomIds) {
        socket.join(`classroom:${cid}`);
        socket.join(`classroom:${cid}:chat`);
      }
      if (classroomIds.length > 0) {
        logger.info(`📚 Padre auto-unido a ${classroomIds.length} aula(s) (anuncios + chat)`, { userId: user.id });
        // Emit parent stats update to each classroom so teachers see updated connected count
        for (const cid of classroomIds) {
          announcementService.getParentStats(cid).then(stats => {
            io.to(`classroom:${cid}`).emit('announcement:parent_stats', stats);
          }).catch(() => {});
        }
      }
    }).catch(() => {});
  }
  
  logger.info(`🔌 Cliente conectado autenticado`, {
    socketId: socket.id,
    userId: user.id,
    role: user.role,
  });
  
  socket.on('disconnect', () => {
    logger.info(`🔌 Cliente desconectado`, {
      socketId: socket.id,
      userId: user.id,
    });
    // If a parent disconnects, update parent stats for their classrooms
    if (user.role === 'PARENT') {
      announcementService.getClassroomIdsForParent(user.id).then(classroomIds => {
        for (const cid of classroomIds) {
          announcementService.getParentStats(cid).then(stats => {
            io.to(`classroom:${cid}`).emit('announcement:parent_stats', stats);
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  });
  
  // Unirse a sala de aula (con validación de permisos)
  socket.on('join-classroom', async (classroomId: string) => {
    try {
      if (!classroomId || !(await userCanAccessClassroom(user, classroomId))) {
        logger.warn('Socket.io: join-classroom denegado', {
          socketId: socket.id, userId: user.id, role: user.role, classroomId,
        });
        socket.emit('access:denied', { room: 'classroom', classroomId });
        return;
      }
      socket.join(`classroom:${classroomId}`);
      logger.info(`📚 Usuario se unió al aula`, {
        socketId: socket.id,
        userId: user.id,
        classroomId,
      });
    } catch (error) {
      logger.error('Error al unirse a sala de aula', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.id,
        classroomId,
      });
    }
  });
  
  // Salir de sala de aula
  socket.on('leave-classroom', (classroomId: string) => {
    socket.leave(`classroom:${classroomId}`);
    logger.info(`📚 Usuario salió del aula`, {
      socketId: socket.id,
      userId: user.id,
      classroomId,
    });
  });

  // Unirse a sala de chat grupal
  socket.on('join-chat', async (classroomId: string) => {
    // El chat es solo profesor dueño / padre vinculado (no estudiantes).
    const canChat = classroomId && user.role !== 'STUDENT' && await userCanAccessClassroom(user, classroomId);
    if (!canChat) {
      logger.warn('Socket.io: join-chat denegado', {
        socketId: socket.id, userId: user.id, role: user.role, classroomId,
      });
      socket.emit('access:denied', { room: 'chat', classroomId });
      return;
    }
    socket.join(`classroom:${classroomId}:chat`);
    logger.info(`💬 Usuario se unió al chat`, {
      socketId: socket.id,
      userId: user.id,
      classroomId,
    });
  });

  // Salir de sala de chat grupal
  socket.on('leave-chat', (classroomId: string) => {
    socket.leave(`classroom:${classroomId}:chat`);
    logger.info(`💬 Usuario salió del chat`, {
      socketId: socket.id,
      userId: user.id,
      classroomId,
    });
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
