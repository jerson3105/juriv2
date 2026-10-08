import { Router } from 'express';
import { bingoController } from '../controllers/bingo.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Bingo Estelar (Observatorio): el docente arma la partida y ve los cartones; el alumno con cuenta ve el suyo.
router.post('/classroom/:classroomId/preview', authorize('TEACHER'), bingoController.preview.bind(bingoController));
router.post('/classroom/:classroomId', authorize('TEACHER'), bingoController.create.bind(bingoController));
router.get('/sessions/:sessionId/cards', authorize('TEACHER'), bingoController.cards.bind(bingoController));
router.get('/me/:profileId', authorize('STUDENT'), bingoController.mine.bind(bingoController));

export default router;
