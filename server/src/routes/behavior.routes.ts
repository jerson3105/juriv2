import { Router } from 'express';
import { behaviorController } from '../controllers/behavior.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { aiGuard } from '../middleware/security.js';

const router = Router();

// Todas las rutas requieren autenticación y rol de profesor
router.use(authenticate);
router.use(authorize('TEACHER'));

// CRUD de comportamientos
router.post('/', behaviorController.create.bind(behaviorController));
router.get('/classroom/:classroomId', behaviorController.getByClassroom.bind(behaviorController));
router.get('/classroom/:classroomId/positive', behaviorController.getPositive.bind(behaviorController));
router.get('/classroom/:classroomId/negative', behaviorController.getNegative.bind(behaviorController));
router.get('/classroom/:classroomId/usage', behaviorController.getUsage.bind(behaviorController));
router.put('/:id', behaviorController.update.bind(behaviorController));
router.delete('/:id', behaviorController.delete.bind(behaviorController));
router.post('/:id/restore', behaviorController.restore.bind(behaviorController));

// Aplicar comportamiento a estudiantes
router.post('/apply', behaviorController.apply.bind(behaviorController));

// Exportar comportamientos a otras clases
router.post('/export', behaviorController.exportBehaviors.bind(behaviorController));

// Generar comportamientos con IA
router.post('/generate-ai', ...aiGuard, behaviorController.generateWithAI.bind(behaviorController));

export default router;
