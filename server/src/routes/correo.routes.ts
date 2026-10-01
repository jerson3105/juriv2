import { Router } from 'express';
import { correoController } from '../controllers/correo.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Correo Estelar (Observatorio): el docente abre la partida y modera; el alumno escribe a su estrella.
router.post('/classroom/:classroomId', authorize('TEACHER'), correoController.create.bind(correoController));
router.get('/sessions/:sessionId/letters', authorize('TEACHER'), correoController.letters.bind(correoController));
router.put('/letters/:letterId', authorize('TEACHER'), correoController.moderate.bind(correoController));
router.get('/me/:profileId', authorize('STUDENT'), correoController.mine.bind(correoController));
router.post('/me/:profileId/letter', authorize('STUDENT'), correoController.send.bind(correoController));

export default router;
