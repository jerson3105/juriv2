import { Router } from 'express';
import { historyController } from '../controllers/history.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener historial de una clase
router.get('/classroom/:classroomId', historyController.getClassroomHistory);

// Obtener estadísticas de una clase
router.get('/classroom/:classroomId/stats', historyController.getClassroomStats);

export default router;
