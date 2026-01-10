import { Router } from 'express';
import { gradeController } from '../controllers/grade.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener calificaciones de un estudiante (estudiante o profesor)
router.get('/student/:studentProfileId', gradeController.getStudentGrades);

// Obtener calificaciones de toda una clase (solo profesor)
router.get('/classroom/:classroomId', authorize('TEACHER'), gradeController.getClassroomGrades);

// Calcular calificaciones de un estudiante (solo profesor)
router.post('/calculate/student/:studentProfileId', authorize('TEACHER'), gradeController.calculateStudentGrades);

// Recalcular calificaciones de toda una clase (solo profesor)
router.post('/calculate/classroom/:classroomId', authorize('TEACHER'), gradeController.recalculateClassroomGrades);

// Establecer calificación manual (solo profesor)
router.put('/:gradeId/manual', authorize('TEACHER'), gradeController.setManualGrade);

// Eliminar calificación manual (solo profesor)
router.delete('/:gradeId/manual', authorize('TEACHER'), gradeController.clearManualGrade);

// Exportar libro de calificaciones en PDF (solo profesor)
router.get('/export/pdf/:classroomId', authorize('TEACHER'), gradeController.exportPDF);

export default router;
