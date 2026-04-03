import { Router } from 'express';
import { historyController } from '../controllers/history.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener historial de una clase
router.get('/classroom/:classroomId', authorize('TEACHER', 'ADMIN'), historyController.getClassroomHistory);

// Obtener estadísticas de una clase
router.get('/classroom/:classroomId/stats', authorize('TEACHER', 'ADMIN'), historyController.getClassroomStats);

// Revertir una entrada del historial
router.post('/revert/:entryType/:entryId', authorize('TEACHER', 'ADMIN'), historyController.revertEntry);

export default router;
