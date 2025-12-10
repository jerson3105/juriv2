import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { attendanceController } from '../controllers/attendance.controller.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Rutas de profesor
router.post('/classroom/:classroomId', authorize('TEACHER'), attendanceController.recordAttendance);
router.post('/classroom/:classroomId/bulk', authorize('TEACHER'), attendanceController.recordBulkAttendance);
router.get('/classroom/:classroomId', authorize('TEACHER'), attendanceController.getAttendanceByDate);
router.get('/classroom/:classroomId/stats', authorize('TEACHER'), attendanceController.getClassroomStats);
router.get('/classroom/:classroomId/range', authorize('TEACHER'), attendanceController.getAttendanceByRange);

// Rutas de estudiante (pueden ver su propio historial)
router.get('/student/:studentProfileId/history', attendanceController.getStudentHistory);
router.get('/student/:studentProfileId/stats', attendanceController.getStudentStats);

// Mi asistencia (para estudiantes autenticados)
router.get('/my/:classroomId', attendanceController.getMyAttendance);

export default router;
