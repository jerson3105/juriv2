import { Router } from 'express';
import { classroomController } from '../controllers/classroom.controller.js';
import { announcementController } from '../controllers/announcement.controller.js';
import { chatController } from '../controllers/chat.controller.js';
import { classNoteController } from '../controllers/classNote.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { aiAssistantService } from '../services/aiAssistant.service.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Rutas para profesores
router.get('/curriculum-areas', authorize('TEACHER', 'STUDENT'), classroomController.getCurriculumAreas.bind(classroomController));
router.post('/generate-ai-content', authorize('TEACHER'), classroomController.generateAIContent.bind(classroomController));
router.post('/', authorize('TEACHER'), classroomController.create.bind(classroomController));
router.get('/my', authorize('TEACHER'), classroomController.getMyClassrooms.bind(classroomController));
router.put('/:id', authorize('TEACHER'), classroomController.update.bind(classroomController));
router.delete('/:id', authorize('TEACHER'), classroomController.delete.bind(classroomController));
router.post('/:id/reset-points', authorize('TEACHER'), classroomController.resetAllPoints.bind(classroomController));
router.post('/:id/reset-selective', authorize('TEACHER'), classroomController.resetClassroomSelective.bind(classroomController));
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

// Avisos (profesor → padres)
router.post('/:id/announcements', authorize('TEACHER'), announcementController.create.bind(announcementController));
router.get('/:id/announcements', authorize('TEACHER', 'PARENT'), announcementController.list.bind(announcementController));
router.get('/:id/announcements/parent-stats', authorize('TEACHER'), announcementController.parentStats.bind(announcementController));
router.get('/:id/announcements/families', authorize('TEACHER'), announcementController.families.bind(announcementController));
router.post('/:id/announcements/mark-read', authorize('PARENT'), announcementController.markRead.bind(announcementController));

// Chat grupal (profesor ↔ padres)
router.get('/:id/chat', authorize('TEACHER', 'PARENT'), chatController.getMessages.bind(chatController));
router.post('/:id/chat', authorize('TEACHER', 'PARENT'), chatController.sendMessage.bind(chatController));
router.delete('/:id/chat/:messageId', authorize('TEACHER'), chatController.deleteMessage.bind(chatController));
router.get('/:id/chat/settings', authorize('TEACHER', 'PARENT'), chatController.getSettings.bind(chatController));
router.patch('/:id/chat/settings', authorize('TEACHER'), chatController.updateSettings.bind(chatController));

// Notas de clase (profesor)
router.post('/:id/notes', authorize('TEACHER'), classNoteController.create.bind(classNoteController));
router.get('/:id/notes', authorize('TEACHER'), classNoteController.list.bind(classNoteController));
router.get('/:id/notes/pending-count', authorize('TEACHER'), classNoteController.pendingCount.bind(classNoteController));
router.patch('/:id/notes/:noteId/toggle', authorize('TEACHER'), classNoteController.toggleComplete.bind(classNoteController));
router.delete('/:id/notes/:noteId', authorize('TEACHER'), classNoteController.remove.bind(classNoteController));

// Rutas para estudiantes
router.post('/join', authorize('STUDENT'), classroomController.join.bind(classroomController));

// Rutas compartidas
router.get('/:id', classroomController.getById.bind(classroomController));

export default router;
