import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { loginStreakController } from '../controllers/loginStreak.controller.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Registrar login diario y obtener recompensas
router.post('/:classroomId/record', loginStreakController.recordLogin);

// Obtener estado actual de la racha
router.get('/:classroomId/status', loginStreakController.getStreakStatus);

export default router;
