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

// Crear aplicación Express
const app = express();
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
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: config_app.isDev ? err.message : 'Error interno del servidor',
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
    // Conectar a la base de datos
    await connectDatabase();
    
    // Iniciar servidor HTTP
    httpServer.listen(config_app.port, () => {
      console.log(`
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
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();
