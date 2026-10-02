import { Router } from 'express';
import { gradeController } from '../controllers/grade.controller.js';
import { aiGuard } from '../middleware/security.js';
import { gradeEvaluationController } from '../controllers/gradeEvaluation.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener calificaciones de un estudiante (estudiante o profesor)
router.get('/student/:studentProfileId', gradeController.getStudentGrades);

// "Mis calificaciones": vista del alumno dueño del perfil
router.get('/my/:studentProfileId', authorize('STUDENT'), gradeController.getMyGradesView);

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

// Comentario para el alumno, nota privada y conclusión descriptiva
router.patch('/:gradeId/notes', authorize('TEACHER'), gradeController.updateGradeNotes);

// Evaluaciones propias (examen, tarea…) con nota directa por alumno
router.get('/evaluations/:classroomId', authorize('TEACHER'), gradeEvaluationController.list);
router.post('/evaluations/:classroomId', authorize('TEACHER'), gradeEvaluationController.create);
router.get('/evaluations/item/:evaluationId', authorize('TEACHER'), gradeEvaluationController.get);
router.patch('/evaluations/item/:evaluationId', authorize('TEACHER'), gradeEvaluationController.update);
router.delete('/evaluations/item/:evaluationId', authorize('TEACHER'), gradeEvaluationController.remove);
router.put('/evaluations/item/:evaluationId/scores', authorize('TEACHER'), gradeEvaluationController.saveScores);
router.get('/evaluations/item/:evaluationId/template', authorize('TEACHER'), gradeEvaluationController.template);
router.post('/evaluations/item/:evaluationId/import-preview', authorize('TEACHER'), gradeEvaluationController.importPreview);

// Conclusiones descriptivas: la IA propone por alumno, el docente edita y guarda
router.post('/conclusions/:classroomId/propose', authorize('TEACHER'), ...aiGuard, gradeEvaluationController.proposeConclusions);
router.put('/conclusions/:classroomId', authorize('TEACHER'), gradeEvaluationController.saveConclusions);

// Copiar competencias, destrezas, escala y fechas a otras clases
router.post('/copy-config/:classroomId', authorize('TEACHER'), gradeEvaluationController.copyConfig);

// Escala y peso de evaluaciones de la clase
router.put('/settings/:classroomId', authorize('TEACHER'), gradeController.updateGradeSettings);

// Exportar libro de calificaciones en PDF (solo profesor)
router.get('/export/pdf/:classroomId', authorize('TEACHER'), gradeController.exportPDF);

// Exportar libro de calificaciones en Excel formato SIAGIE (solo profesor)
// La exportación a Excel genera conclusiones con IA: cuenta para el límite de IA.
router.get('/export/excel/:classroomId', authorize('TEACHER'), gradeController.exportExcel);

// ═══════════════════════════════════════════════════════════
// GESTIÓN DE BIMESTRES
// ═══════════════════════════════════════════════════════════

// Obtener estado de bimestres (profesor y estudiante)
router.get('/bimesters/:classroomId', authorize('TEACHER', 'STUDENT'), gradeController.getBimesterStatus);

// Establecer bimestre actual (solo profesor)
router.put('/bimesters/:classroomId/current', authorize('TEACHER'), gradeController.setCurrentBimester);

// Cerrar bimestre (solo profesor)
router.post('/bimesters/:classroomId/close', authorize('TEACHER'), gradeController.closeBimester);

// Fechas de un bimestre
router.put('/bimesters/:classroomId/dates', authorize('TEACHER'), gradeController.setBimesterDates);

// Reabrir bimestre (solo profesor)
router.post('/bimesters/:classroomId/reopen', authorize('TEACHER'), gradeController.reopenBimester);

export default router;
