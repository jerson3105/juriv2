import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { expeditionUploadLimiter } from '../middleware/security.js';
import { expeditionController as c, uploadExpeditionFile } from '../controllers/expedition.controller.js';

// Expedición unificada. Cada controlador revisa además la clase: el docente dueño (o el admin) para
// gestionar, y el alumno con perfil activo en la clase (sale de la sesión) para jugar.
const router = Router();
router.use(authenticate);

const teacher = authorize('TEACHER', 'ADMIN');
const student = authorize('STUDENT');

// Subidas: recursos del docente y evidencias del alumno (máximo 5 MB, 60 por hora).
router.post('/upload', authorize('TEACHER', 'STUDENT'), expeditionUploadLimiter, ...uploadExpeditionFile, c.upload);

// Alumno (antes que '/:id' para que «mine» y «stops» no se lean como id).
router.get('/mine/:classroomId', student, c.mine);
router.get('/stops/:stopId/challenge', student, c.challenge);
router.post('/stops/:stopId/continue', student, c.continueStory);
router.post('/stops/:stopId/answer', student, c.answer);
router.post('/stops/:stopId/evidence', student, c.evidence);
router.get('/:id/play', student, c.play);

// Docente
router.get('/classroom/:classroomId', teacher, c.list);
router.post('/', teacher, c.create);
router.patch('/stops/:stopId', teacher, c.updateStop);
router.delete('/stops/:stopId', teacher, c.deleteStop);
router.post('/stops/:stopId/class', teacher, c.markClass);
router.get('/:id', teacher, c.get);
router.patch('/:id', teacher, c.update);
router.delete('/:id', teacher, c.remove);
router.post('/:id/publish', teacher, c.publish);
router.post('/:id/close', teacher, c.close);
router.post('/:id/reopen', teacher, c.reopen);
router.post('/:id/stops', teacher, c.addStop);
router.put('/:id/stops/order', teacher, c.reorder);
router.get('/:id/board', teacher, c.board);
router.get('/:id/review', teacher, c.reviewQueue);
router.post('/:id/review', teacher, c.review);

export default router;
