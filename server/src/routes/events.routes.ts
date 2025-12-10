import { Router } from 'express';
import { eventsController } from '../controllers/events.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener eventos predefinidos del sistema
router.get('/system', eventsController.getSystemEvents);

// Obtener eventos de una clase (incluye globales)
router.get('/classroom/:classroomId', eventsController.getClassroomEvents);

// Obtener solo eventos personalizados de una clase
router.get('/classroom/:classroomId/custom', eventsController.getCustomEvents);

// Obtener historial de eventos de una clase
router.get('/classroom/:classroomId/logs', eventsController.getEventLogs);

// Obtener un evento específico
router.get('/:eventId', eventsController.getEventById);

// Crear evento personalizado (solo profesores)
router.post(
  '/classroom/:classroomId',
  authorize('TEACHER'),
  eventsController.createEvent
);

// Actualizar evento personalizado (solo profesores)
router.put(
  '/classroom/:classroomId/:eventId',
  authorize('TEACHER'),
  eventsController.updateEvent
);

// Activar evento del sistema
router.post(
  '/classroom/:classroomId/trigger-system',
  authorize('TEACHER'),
  eventsController.triggerSystemEvent
);

// Activar evento específico
router.post(
  '/classroom/:classroomId/trigger/:eventId',
  authorize('TEACHER'),
  eventsController.triggerEvent
);

// Girar ruleta de eventos
router.post(
  '/classroom/:classroomId/spin-roulette',
  authorize('TEACHER'),
  eventsController.spinRoulette
);

// Iniciar desafío (selecciona estudiantes sin aplicar efectos)
router.post(
  '/classroom/:classroomId/challenge/:eventId/start',
  authorize('TEACHER'),
  eventsController.startChallenge
);

// Resolver desafío (aplicar efectos según resultado)
router.post(
  '/classroom/:classroomId/challenge/resolve',
  authorize('TEACHER'),
  eventsController.resolveChallenge
);

// Eliminar evento personalizado
router.delete(
  '/classroom/:classroomId/:eventId',
  authorize('TEACHER'),
  eventsController.deleteEvent
);

export default router;
