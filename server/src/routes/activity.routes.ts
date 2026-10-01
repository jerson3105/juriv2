import { Router } from 'express';
import { activityController } from '../controllers/activity.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, authorize('TEACHER'));

// Observatorio de Jiro: partidas (reanudar, Bitácora, recompensa a los presentes)
router.get('/classroom/:classroomId/overview', activityController.overview.bind(activityController));
router.get('/classroom/:classroomId/album', activityController.album.bind(activityController));
router.post('/classroom/:classroomId/sessions', activityController.create.bind(activityController));
router.get('/sessions/:sessionId', activityController.get.bind(activityController));
router.put('/sessions/:sessionId/state', activityController.saveState.bind(activityController));
router.post('/sessions/:sessionId/finish', activityController.finish.bind(activityController));
router.post('/sessions/:sessionId/abandon', activityController.abandon.bind(activityController));
router.put('/sessions/:sessionId/name', activityController.rename.bind(activityController));
router.put('/sessions/:sessionId/self-assessment', activityController.selfAssessment.bind(activityController));
router.post('/sessions/:sessionId/reward', activityController.reward.bind(activityController));
router.delete('/sessions/:sessionId/reward', activityController.undoReward.bind(activityController));

export default router;
