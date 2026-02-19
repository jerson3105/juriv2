import { Router } from 'express';
import { studentController } from '../controllers/student.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Rutas para estudiantes (solo rol STUDENT puede unirse)
router.post('/join', authorize('STUDENT'), studentController.joinClass.bind(studentController));
router.get('/my-classes', studentController.getMyClasses.bind(studentController));
router.get('/profile/:classroomId', studentController.getMyProfile.bind(studentController));
router.put('/profile/:classroomId', studentController.updateProfile.bind(studentController));
router.get('/stats/:studentId', authorize('STUDENT', 'TEACHER', 'ADMIN'), studentController.getStudentStats.bind(studentController));

// Rutas para profesores
router.get('/:studentId', authorize('TEACHER'), studentController.getStudent.bind(studentController));
router.post('/:studentId/points', authorize('TEACHER'), studentController.updatePoints.bind(studentController));
router.get('/:studentId/history', authorize('TEACHER'), studentController.getPointHistory.bind(studentController));

// Rutas para estudiante demo (onboarding)
router.post('/demo/:classroomId', authorize('TEACHER'), studentController.createDemoStudent.bind(studentController));
router.delete('/demo/:classroomId', authorize('TEACHER'), studentController.deleteDemoStudent.bind(studentController));
router.get('/demo/:classroomId/check', authorize('TEACHER'), studentController.hasDemoStudent.bind(studentController));

// Rutas para estudiantes placeholder (sin cuenta)
router.post('/placeholder/:classroomId', authorize('TEACHER'), studentController.createPlaceholderStudent.bind(studentController));
router.post('/placeholder/:classroomId/bulk', authorize('TEACHER'), studentController.createBulkPlaceholderStudents.bind(studentController));
router.get('/placeholder/:classroomId', authorize('TEACHER'), studentController.getPlaceholderStudents.bind(studentController));
router.post('/placeholder/:studentId/regenerate-code', authorize('TEACHER'), studentController.regenerateLinkCode.bind(studentController));

// Generar PDFs de tarjetas de vinculación
router.post('/placeholder/:classroomId/pdf', authorize('TEACHER'), studentController.generateLinkCardsPDF.bind(studentController));
router.get('/placeholder/:studentId/pdf/single', authorize('TEACHER'), studentController.generateSingleCardPDF.bind(studentController));

// Vincular cuenta de estudiante con código
router.post('/link-account', authorize('STUDENT'), studentController.linkAccount.bind(studentController));

export default router;
