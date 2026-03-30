import { Router } from 'express';
import multer from 'multer';
import { questionBankController } from '../controllers/questionBank.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Multer config for PDF upload (memory only, no disk storage)
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'));
    }
  },
});

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

// Generación con IA
router.post('/generate-ai', authorize('TEACHER'), questionBankController.generateWithAI.bind(questionBankController));
router.post('/generate-from-pdf', authorize('TEACHER'), pdfUpload.single('pdf'), questionBankController.generateFromPDF.bind(questionBankController));

// Exportar bancos a otras clases
router.post('/export', authorize('TEACHER'), questionBankController.exportBanks.bind(questionBankController));

export default router;
