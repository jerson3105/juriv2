import { Router } from 'express';
import { parentController } from '../controllers/parent.controller.js';
import { reportCardFamilyController } from '../controllers/reportCardFamily.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { authLimiter, codeRedemptionLimiter } from '../middleware/security.js';
import { aiGuard } from '../middleware/security.js';

const router = Router();

// Rutas públicas (registro)
router.post('/register', authLimiter, parentController.register);

// Rutas protegidas para padres
router.get('/profile', authenticate, authorize('PARENT'), parentController.getProfile);
router.post('/link', authenticate, authorize('PARENT'), codeRedemptionLimiter, parentController.linkChild);
router.get('/children', authenticate, authorize('PARENT'), parentController.getChildren);
router.get('/pending-links', authenticate, authorize('PARENT'), parentController.getPendingLinks);
router.get('/child/:studentId', authenticate, authorize('PARENT'), parentController.getChildDetail);
router.get('/child/:studentId/grades', authenticate, authorize('PARENT'), parentController.getChildGrades);
router.get('/child/:studentId/activity', authenticate, authorize('PARENT'), parentController.getChildActivity);
router.get('/child/:studentId/report', authenticate, authorize('PARENT'), parentController.getChildReport);
// Las libretas publicadas por el colegio de su hijo o hija
router.get('/child/:studentId/report-cards', authenticate, authorize('PARENT'), reportCardFamilyController.child);
router.get('/child/:studentId/report-cards/:publicationId/pdf', authenticate, authorize('PARENT'), reportCardFamilyController.childPdf);
router.get('/child/:studentId/ai-report', authenticate, authorize('PARENT'), ...aiGuard, parentController.getAIReport);
router.post('/child/:studentId/ai-report/regenerate', authenticate, authorize('PARENT'), ...aiGuard, parentController.regenerateAIReport);
router.delete('/child/:studentId', authenticate, authorize('PARENT'), parentController.unlinkChild);
router.put('/preferences', authenticate, authorize('PARENT'), parentController.updatePreferences);

// Profesor: familias que esperan aprobación
router.get('/pending-approvals', authenticate, authorize('TEACHER'), parentController.getPendingApprovals.bind(parentController));
router.post('/links/:linkId/approve', authenticate, authorize('TEACHER'), parentController.reviewLink.bind(parentController));
router.post('/links/:linkId/reject', authenticate, authorize('TEACHER'), parentController.reviewLink.bind(parentController));

// Ruta para profesor: generar código de vinculación
router.post('/generate-code/:studentId', authenticate, authorize('TEACHER'), parentController.generateParentLinkCode);

// Ruta para profesor: generar códigos masivos para folletos de padres
router.post('/generate-codes-bulk/:classroomId', authenticate, authorize('TEACHER'), parentController.generateBulkParentLinkCodes);

export default router;
