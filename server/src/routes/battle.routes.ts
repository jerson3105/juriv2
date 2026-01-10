import { Router } from 'express';
import { battleController } from '../controllers/battle.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ==================== BOSS CRUD (PROFESOR) ====================

// Crear boss
router.post('/bosses', authorize('TEACHER'), (req, res) => 
  battleController.createBoss(req, res)
);

// Obtener bosses de una clase
router.get('/classroom/:classroomId/bosses', (req, res) => 
  battleController.getBossesByClassroom(req, res)
);

// Obtener batallas activas para un estudiante
router.get('/student/:studentId/active', (req, res) => 
  battleController.getActiveBattlesForStudent(req, res)
);

// Obtener boss por ID (con estado completo)
router.get('/bosses/:id', (req, res) => 
  battleController.getBossById(req, res)
);

// Actualizar boss
router.put('/bosses/:id', authorize('TEACHER'), (req, res) => 
  battleController.updateBoss(req, res)
);

// Eliminar boss
router.delete('/bosses/:id', authorize('TEACHER'), (req, res) => 
  battleController.deleteBoss(req, res)
);

// Duplicar boss
router.post('/bosses/:id/duplicate', authorize('TEACHER'), (req, res) => 
  battleController.duplicateBoss(req, res)
);

// ==================== PREGUNTAS (PROFESOR) ====================

// Agregar pregunta
router.post('/bosses/:battleId/questions', authorize('TEACHER'), (req, res) => 
  battleController.addQuestion(req, res)
);

// Obtener preguntas de un boss
router.get('/bosses/:battleId/questions', (req, res) => 
  battleController.getQuestions(req, res)
);

// Actualizar pregunta
router.put('/questions/:id', authorize('TEACHER'), (req, res) => 
  battleController.updateQuestion(req, res)
);

// Eliminar pregunta
router.delete('/questions/:id', authorize('TEACHER'), (req, res) => 
  battleController.deleteQuestion(req, res)
);

// Reordenar preguntas
router.put('/bosses/:battleId/questions/reorder', authorize('TEACHER'), (req, res) => 
  battleController.reorderQuestions(req, res)
);

// ==================== BATALLA EN VIVO ====================

// Iniciar batalla (profesor)
router.post('/bosses/:id/start', authorize('TEACHER'), (req, res) => 
  battleController.startBattle(req, res)
);

// Obtener estado de batalla
router.get('/bosses/:id/state', (req, res) => 
  battleController.getBattleState(req, res)
);

// Enviar respuesta (estudiante)
router.post('/bosses/:id/student/:studentId/answer', (req, res) => 
  battleController.submitAnswer(req, res)
);

// Finalizar batalla (profesor)
router.post('/bosses/:id/end', authorize('TEACHER'), (req, res) => 
  battleController.endBattle(req, res)
);

// Aplicar daño manualmente (profesor - modo presencial)
router.post('/bosses/:id/manual-damage', authorize('TEACHER'), (req, res) => 
  battleController.applyManualDamage(req, res)
);

// Obtener resultados de batalla
router.get('/bosses/:id/results', (req, res) => 
  battleController.getBattleResults(req, res)
);

// ==================== MODO BVJ (Boss vs Jugador) ====================

// Obtener estado de batalla BvJ
router.get('/bosses/:id/bvj/state', (req, res) => 
  battleController.getBvJBattleState(req, res)
);

// Seleccionar retador aleatorio
router.post('/bosses/:id/bvj/select-challenger', authorize('TEACHER'), (req, res) => 
  battleController.selectRandomChallenger(req, res)
);

// Iniciar nueva ronda
router.post('/bosses/:id/bvj/new-round', authorize('TEACHER'), (req, res) => 
  battleController.startNewRound(req, res)
);

// Actualizar índice de pregunta actual
router.post('/bosses/:id/bvj/update-question-index', authorize('TEACHER'), (req, res) => 
  battleController.updateCurrentQuestionIndex(req, res)
);

export default router;
