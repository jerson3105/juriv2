import { Router } from 'express';
import { studentController } from '../controllers/student.controller.js';
import { celebrationController } from '../controllers/celebration.controller.js';
import { studentNewsController } from '../controllers/studentNews.controller.js';
import { studentProgressController } from '../controllers/studentProgress.controller.js';
import { seasonController } from '../controllers/season.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { codeRedemptionLimiter } from '../middleware/security.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Rutas para estudiantes (solo rol STUDENT puede unirse)
router.post('/verify-code', authorize('STUDENT'), codeRedemptionLimiter, studentController.verifyCode.bind(studentController));
router.post('/join', authorize('STUDENT'), codeRedemptionLimiter, studentController.joinClass.bind(studentController));
router.post('/join-roster', authorize('STUDENT'), codeRedemptionLimiter, studentController.joinRoster.bind(studentController));
router.get('/my-classes', studentController.getMyClasses.bind(studentController));
// «Mis temporadas»: sus clases de años escolares cerrados.
router.get('/me/seasons', authorize('STUDENT'), seasonController.mine.bind(seasonController));
router.get('/profile/:classroomId', studentController.getMyProfile.bind(studentController));
router.put('/profile/:classroomId', studentController.updateProfile.bind(studentController));
router.get('/profiles/:profileId/celebrations', authorize('STUDENT'), celebrationController.getPending.bind(celebrationController));
router.post('/profiles/:profileId/celebrations/seen', authorize('STUDENT'), celebrationController.markSeen.bind(celebrationController));
router.get('/profiles/:profileId/news', authorize('STUDENT'), studentNewsController.getNews.bind(studentNewsController));
router.post('/profiles/:profileId/news/seen', authorize('STUDENT'), studentNewsController.markSeen.bind(studentNewsController));
router.get('/profiles/:profileId/progress', authorize('STUDENT'), studentProgressController.getProgress.bind(studentProgressController));
router.get('/profiles/:profileId/progress/history', authorize('STUDENT'), studentProgressController.getHistory.bind(studentProgressController));

// Rutas para profesores
router.get('/:studentId', authorize('TEACHER'), studentController.getStudent.bind(studentController));
router.patch('/:studentId', authorize('TEACHER'), studentController.updateStudent.bind(studentController));
router.post('/:studentId/points', authorize('TEACHER'), studentController.updatePoints.bind(studentController));
router.get('/:studentId/history', authorize('TEACHER'), studentController.getPointHistory.bind(studentController));
router.delete('/:studentId/remove-from-class', authorize('TEACHER'), studentController.removeFromClass.bind(studentController));

// Rutas para estudiante demo (onboarding)
router.post('/demo/:classroomId', authorize('TEACHER'), studentController.createDemoStudent.bind(studentController));
router.delete('/demo/:classroomId', authorize('TEACHER'), studentController.deleteDemoStudent.bind(studentController));
router.get('/demo/:classroomId/check', authorize('TEACHER'), studentController.hasDemoStudent.bind(studentController));

// Rutas para estudiantes placeholder (sin cuenta)
router.post('/placeholder/:classroomId', authorize('TEACHER'), studentController.createPlaceholderStudent.bind(studentController));
router.post('/placeholder/:classroomId/bulk', authorize('TEACHER'), studentController.createBulkPlaceholderStudents.bind(studentController));
router.get('/placeholder/:classroomId', authorize('TEACHER'), studentController.getPlaceholderStudents.bind(studentController));
router.post('/:studentId/reset-access', authorize('TEACHER'), studentController.resetAccess.bind(studentController));
router.post('/placeholder/:studentId/regenerate-code', authorize('TEACHER'), studentController.regenerateLinkCode.bind(studentController));

// Generar PDFs de tarjetas de vinculación
router.post('/placeholder/:classroomId/pdf', authorize('TEACHER'), studentController.generateLinkCardsPDF.bind(studentController));
router.get('/placeholder/:studentId/pdf/single', authorize('TEACHER'), studentController.generateSingleCardPDF.bind(studentController));

// Vincular cuenta de estudiante con código
router.post('/link-account', authorize('STUDENT'), codeRedemptionLimiter, studentController.linkAccount.bind(studentController));

export default router;
