import { Router } from 'express';
import { classStatsController } from '../controllers/classStats.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Estadísticas de la clase: atención, clima, comportamientos, notas y gamificación
router.get('/classroom/:classroomId/overview', authorize('TEACHER', 'ADMIN'), classStatsController.overview);

export default router;
