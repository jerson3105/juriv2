import { Router } from 'express';
import { classroomController } from '../controllers/classroom.controller.js';
import { announcementController } from '../controllers/announcement.controller.js';
import { chatController } from '../controllers/chat.controller.js';
import { classNoteController } from '../controllers/classNote.controller.js';
import { characterClassController } from '../controllers/characterClass.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

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
router.get('/:id/competencies', authorize('TEACHER', 'STUDENT'), classroomController.getCompetencies.bind(classroomController));
router.post('/:id/competencies', authorize('TEACHER'), classroomController.addCompetencies.bind(classroomController));
router.delete('/:id/competencies/:competencyId', authorize('TEACHER'), classroomController.removeCompetency.bind(classroomController));
router.post('/:id/competencies/custom', authorize('TEACHER'), classroomController.createCustomCompetency.bind(classroomController));
router.patch('/:id/competencies/custom/:competencyId', authorize('TEACHER'), classroomController.updateCustomCompetency.bind(classroomController));
router.delete('/:id/competencies/custom/:competencyId', authorize('TEACHER'), classroomController.deleteCustomCompetency.bind(classroomController));
router.post('/:id/competencies/:competencyId/indicators', authorize('TEACHER'), classroomController.createCompetencyIndicator.bind(classroomController));
router.patch('/:id/competencies/:competencyId/indicators/:indicatorId', authorize('TEACHER'), classroomController.updateCompetencyIndicator.bind(classroomController));
router.delete('/:id/competencies/:competencyId/indicators/:indicatorId', authorize('TEACHER'), classroomController.deleteCompetencyIndicator.bind(classroomController));
router.post('/:id/competency-indicators/transfer', authorize('TEACHER'), classroomController.transferCompetencyIndicators.bind(classroomController));
router.post('/:id/sync-competencies', authorize('TEACHER'), classroomController.syncCompetencies.bind(classroomController));
router.get('/:classroomId/cloneable-counts', authorize('TEACHER'), classroomController.getCloneableCounts.bind(classroomController));
router.post('/:classroomId/clone', authorize('TEACHER'), classroomController.cloneClassroom.bind(classroomController));

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

// Notas de clase (profesor crea/edita, estudiante lee)
router.post('/:id/notes', authorize('TEACHER'), classNoteController.create.bind(classNoteController));
router.get('/:id/notes', authorize('TEACHER', 'STUDENT'), classNoteController.list.bind(classNoteController));
router.get('/:id/notes/pending-count', authorize('TEACHER', 'STUDENT'), classNoteController.pendingCount.bind(classNoteController));
router.patch('/:id/notes/:noteId/toggle', authorize('TEACHER'), classNoteController.toggleComplete.bind(classNoteController));
router.delete('/:id/notes/:noteId', authorize('TEACHER'), classNoteController.remove.bind(classNoteController));

// Clases de personaje (profesor CRUD, estudiante lee activas)
router.get('/:classroomId/character-classes', authorize('TEACHER', 'STUDENT'), characterClassController.list.bind(characterClassController));
router.get('/:classroomId/character-classes/active', authorize('TEACHER', 'STUDENT'), characterClassController.listActive.bind(characterClassController));
router.post('/:classroomId/character-classes', authorize('TEACHER'), characterClassController.create.bind(characterClassController));
router.post('/:classroomId/character-classes/seed', authorize('TEACHER'), characterClassController.seedDefaults.bind(characterClassController));
router.post('/:classroomId/character-classes/reorder', authorize('TEACHER'), characterClassController.reorder.bind(characterClassController));
router.post('/:classroomId/character-classes/assign', authorize('TEACHER'), characterClassController.assign.bind(characterClassController));
router.post('/:classroomId/character-classes/bulk-assign', authorize('TEACHER'), characterClassController.bulkAssign.bind(characterClassController));
router.post('/:classroomId/character-classes/choose', authorize('STUDENT'), characterClassController.studentChoose.bind(characterClassController));
router.put('/:classroomId/character-classes/:id', authorize('TEACHER'), characterClassController.update.bind(characterClassController));
router.delete('/:classroomId/character-classes/:id', authorize('TEACHER'), characterClassController.remove.bind(characterClassController));

// Buscar clases de personaje por código de aula (para estudiantes al unirse)
router.get('/code/:code/character-classes', authorize('STUDENT'), characterClassController.listByCode.bind(characterClassController));

// Rutas para estudiantes
router.post('/join', authorize('STUDENT'), classroomController.join.bind(classroomController));

// Rutas compartidas
router.get('/:id', classroomController.getById.bind(classroomController));

export default router;
