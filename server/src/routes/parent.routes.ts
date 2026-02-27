import { Router } from 'express';
import { parentController } from '../controllers/parent.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Rutas públicas (registro)
router.post('/register', parentController.register);

// Rutas protegidas para padres
router.get('/profile', authenticate, authorize('PARENT'), parentController.getProfile);
router.post('/link', authenticate, authorize('PARENT'), parentController.linkChild);
router.get('/children', authenticate, authorize('PARENT'), parentController.getChildren);
router.get('/child/:studentId', authenticate, authorize('PARENT'), parentController.getChildDetail);
router.get('/child/:studentId/grades', authenticate, authorize('PARENT'), parentController.getChildGrades);
router.get('/child/:studentId/activity', authenticate, authorize('PARENT'), parentController.getChildActivity);
router.get('/child/:studentId/report', authenticate, authorize('PARENT'), parentController.getChildReport);
router.get('/child/:studentId/ai-report', authenticate, authorize('PARENT'), parentController.getAIReport);
router.post('/child/:studentId/ai-report/regenerate', authenticate, authorize('PARENT'), parentController.regenerateAIReport);
router.delete('/child/:studentId', authenticate, authorize('PARENT'), parentController.unlinkChild);
router.put('/preferences', authenticate, authorize('PARENT'), parentController.updatePreferences);

// Ruta para profesor: generar código de vinculación
router.post('/generate-code/:studentId', authenticate, authorize('TEACHER'), parentController.generateParentLinkCode);

// Ruta para profesor: generar códigos masivos para folletos de padres
router.post('/generate-codes-bulk/:classroomId', authenticate, authorize('TEACHER'), parentController.generateBulkParentLinkCodes);

export default router;
