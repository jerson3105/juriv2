import { Router } from 'express';
import { classroomController } from '../controllers/classroom.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Rutas para profesores
router.get('/curriculum-areas', authorize('TEACHER'), classroomController.getCurriculumAreas.bind(classroomController));
router.post('/', authorize('TEACHER'), classroomController.create.bind(classroomController));
router.get('/my', authorize('TEACHER'), classroomController.getMyClassrooms.bind(classroomController));
router.put('/:id', authorize('TEACHER'), classroomController.update.bind(classroomController));
router.delete('/:id', authorize('TEACHER'), classroomController.delete.bind(classroomController));
router.post('/:id/reset-points', authorize('TEACHER'), classroomController.resetAllPoints.bind(classroomController));
router.post('/:id/sync-competencies', authorize('TEACHER'), classroomController.syncCompetencies.bind(classroomController));

// Rutas para estudiantes
router.post('/join', authorize('STUDENT'), classroomController.join.bind(classroomController));

// Rutas compartidas
router.get('/:id', classroomController.getById.bind(classroomController));

export default router;
