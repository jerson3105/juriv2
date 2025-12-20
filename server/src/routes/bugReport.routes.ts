import { Router } from 'express';
import { bugReportController } from '../controllers/bugReport.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Rutas para profesores (TEACHER)
router.post('/', authenticate, authorize('TEACHER'), bugReportController.createReport);
router.get('/my-reports', authenticate, authorize('TEACHER'), bugReportController.getMyReports);

// Rutas para administradores (ADMIN)
router.get('/stats', authenticate, authorize('ADMIN'), bugReportController.getStats);
router.get('/', authenticate, authorize('ADMIN'), bugReportController.getAllReports);
router.get('/:reportId', authenticate, authorize('ADMIN'), bugReportController.getReportById);
router.patch('/:reportId/status', authenticate, authorize('ADMIN'), bugReportController.updateStatus);
router.patch('/:reportId/notes', authenticate, authorize('ADMIN'), bugReportController.updateNotes);

export default router;
