import { Router } from 'express';
import { questionBankController } from '../controllers/questionBank.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Bancos de preguntas
router.get('/classroom/:classroomId', authorize('TEACHER'), questionBankController.getBanks.bind(questionBankController));
router.post('/classroom/:classroomId', authorize('TEACHER'), questionBankController.createBank.bind(questionBankController));
router.get('/bank/:bankId', authorize('TEACHER'), questionBankController.getBank.bind(questionBankController));
router.put('/bank/:bankId', authorize('TEACHER'), questionBankController.updateBank.bind(questionBankController));
router.delete('/bank/:bankId', authorize('TEACHER'), questionBankController.deleteBank.bind(questionBankController));

// Preguntas
router.get('/bank/:bankId/questions', authorize('TEACHER'), questionBankController.getQuestions.bind(questionBankController));
router.post('/bank/:bankId/questions', authorize('TEACHER'), questionBankController.createQuestion.bind(questionBankController));
router.get('/question/:questionId', authorize('TEACHER'), questionBankController.getQuestion.bind(questionBankController));
router.put('/question/:questionId', authorize('TEACHER'), questionBankController.updateQuestion.bind(questionBankController));
router.delete('/question/:questionId', authorize('TEACHER'), questionBankController.deleteQuestion.bind(questionBankController));

// Utilidades
router.get('/bank/:bankId/random', authorize('TEACHER'), questionBankController.getRandomQuestions.bind(questionBankController));
router.get('/bank/:bankId/stats', authorize('TEACHER'), questionBankController.getStats.bind(questionBankController));
router.post('/question/:questionId/check', authorize('TEACHER'), questionBankController.checkAnswer.bind(questionBankController));

export default router;
