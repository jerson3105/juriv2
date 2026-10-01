import { Router } from 'express';
import { recoveryController } from '../controllers/recovery.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Misiones de recuperación (HP en 0 → "Descansando")
router.get('/classroom/:classroomId', authorize('TEACHER'), recoveryController.listResting.bind(recoveryController));
router.post('/classroom/:classroomId/students/:studentId', authorize('TEACHER'), recoveryController.assign.bind(recoveryController));
router.post('/missions/:missionId/complete', authorize('TEACHER'), recoveryController.complete.bind(recoveryController));
router.get('/me/:profileId', authorize('STUDENT'), recoveryController.forStudent.bind(recoveryController));

export default router;
