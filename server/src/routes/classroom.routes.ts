import { Router } from 'express';
import { classroomController } from '../controllers/classroom.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { aiAssistantService } from '../services/aiAssistant.service.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Rutas para profesores
router.get('/curriculum-areas', authorize('TEACHER'), classroomController.getCurriculumAreas.bind(classroomController));
router.post('/generate-ai-content', authorize('TEACHER'), classroomController.generateAIContent.bind(classroomController));
router.post('/', authorize('TEACHER'), classroomController.create.bind(classroomController));
router.get('/my', authorize('TEACHER'), classroomController.getMyClassrooms.bind(classroomController));
router.put('/:id', authorize('TEACHER'), classroomController.update.bind(classroomController));
router.delete('/:id', authorize('TEACHER'), classroomController.delete.bind(classroomController));
router.post('/:id/reset-points', authorize('TEACHER'), classroomController.resetAllPoints.bind(classroomController));
router.post('/:id/sync-competencies', authorize('TEACHER'), classroomController.syncCompetencies.bind(classroomController));
router.get('/:classroomId/cloneable-counts', authorize('TEACHER'), classroomController.getCloneableCounts.bind(classroomController));
router.post('/:classroomId/clone', authorize('TEACHER'), classroomController.cloneClassroom.bind(classroomController));

// AI Assistant - Procesar comando natural
router.post('/:id/ai-assistant', authorize('TEACHER'), async (req, res) => {
  try {
    const { id: classroomId } = req.params;
    const { command } = req.body;

    if (!command || typeof command !== 'string' || command.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Comando requerido' });
    }

    const result = await aiAssistantService.processCommand({
      classroomId,
      command: command.trim(),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error in AI assistant:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// AI Assistant - Ejecutar acción confirmada
router.post('/:id/ai-assistant/execute', authorize('TEACHER'), async (req, res) => {
  try {
    const { id: classroomId } = req.params;
    const { action, targetId, studentIds } = req.body;
    const teacherId = (req as any).user.id;

    if (!action || !targetId || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Datos incompletos' });
    }

    const result = await aiAssistantService.executeAction(classroomId, action, targetId, studentIds, teacherId);
    res.json(result);
  } catch (error: any) {
    console.error('Error executing AI action:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Rutas para estudiantes
router.post('/join', authorize('STUDENT'), classroomController.join.bind(classroomController));

// Rutas compartidas
router.get('/:id', classroomController.getById.bind(classroomController));

export default router;
