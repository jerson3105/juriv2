import { Router } from 'express';
import { studentBossBattleController } from '../controllers/studentBossBattle.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ==================== Rutas para estudiante (más específicas primero) ====================

// Obtener batallas disponibles
router.get('/student/:classroomId/:studentProfileId/available', studentBossBattleController.getAvailableForStudent);

// Iniciar intento
router.post('/battle/:battleId/student/:studentProfileId/start', studentBossBattleController.startAttempt);

// Responder pregunta
router.post('/battle/:battleId/student/:studentProfileId/answer', studentBossBattleController.answerQuestion);

// Finalizar intento
router.post('/battle/:battleId/student/:studentProfileId/finish', studentBossBattleController.finishAttempt);

// Obtener estado actual (polling)
router.get('/battle/:battleId/status', studentBossBattleController.getBattleStatus);

// ==================== Rutas para profesor ====================

// CRUD de batallas
router.post('/classroom/:classroomId', studentBossBattleController.create);
router.get('/classroom/:classroomId', studentBossBattleController.getByClassroom);
router.get('/:id', studentBossBattleController.getById);
router.put('/:id', studentBossBattleController.update);
router.delete('/:id', studentBossBattleController.delete);
router.post('/:id/activate', studentBossBattleController.activate);

export default router;
