import { Router } from 'express';
import { timedActivityController } from '../controllers/timedActivity.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// CRUD de actividades
router.post('/classroom/:classroomId', timedActivityController.create);
router.get('/classroom/:classroomId', timedActivityController.getByClassroom);
router.get('/classroom/:classroomId/active', timedActivityController.getActiveActivity);
router.get('/:id', timedActivityController.getById);
router.put('/:id', timedActivityController.update);
router.delete('/:id', timedActivityController.delete);

// Control de actividad
router.post('/:id/start', timedActivityController.start);
router.post('/:id/pause', timedActivityController.pause);
router.post('/:id/resume', timedActivityController.resume);
router.post('/:id/complete', timedActivityController.complete);
router.post('/:id/reset', timedActivityController.reset);

// Marcar estudiantes
router.post('/:id/mark-complete', timedActivityController.markStudentComplete);
router.post('/:id/mark-exploded', timedActivityController.markStudentExploded);

export default router;
