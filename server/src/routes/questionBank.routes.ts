import { Router } from 'express';
import multer from 'multer';
import { questionBankController } from '../controllers/questionBank.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { verifyUploadedFile } from '../utils/fileValidation.js';
import { aiGuard, aiLimiter, aiRequestTimeout } from '../middleware/security.js';

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
router.get('/mine', authorize('TEACHER'), questionBankController.getMyBanks.bind(questionBankController));
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

// Lote (vista previa de la IA), revisión, deshacer y duplicar
router.post('/bank/:bankId/questions/batch', authorize('TEACHER'), questionBankController.createQuestionsBatch.bind(questionBankController));
router.post('/question/:questionId/review', authorize('TEACHER'), questionBankController.reviewQuestion.bind(questionBankController));
router.post('/bank/:bankId/review-all', authorize('TEACHER'), questionBankController.reviewBank.bind(questionBankController));
router.post('/question/:questionId/restore', authorize('TEACHER'), questionBankController.restoreQuestion.bind(questionBankController));
router.post('/bank/:bankId/restore', authorize('TEACHER'), questionBankController.restoreBank.bind(questionBankController));
router.post('/bank/:bankId/duplicate', authorize('TEACHER'), questionBankController.duplicateBank.bind(questionBankController));

// Generación con IA: borradores para revisar (tema o PDF) y, en el Observatorio, directo a un banco
router.post('/classroom/:classroomId/ai-drafts', authorize('TEACHER'), ...aiGuard, questionBankController.aiDrafts.bind(questionBankController));
router.post('/classroom/:classroomId/ai-drafts/pdf', authorize('TEACHER'), aiLimiter, aiRequestTimeout, pdfUpload.single('pdf'), verifyUploadedFile, questionBankController.aiDraftsFromPdf.bind(questionBankController));
router.post('/classroom/:classroomId/generate-into-bank', authorize('TEACHER'), ...aiGuard, questionBankController.generateIntoBank.bind(questionBankController));

export default router;
