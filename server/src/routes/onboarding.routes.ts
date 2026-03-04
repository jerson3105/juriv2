import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { onboardingController } from '../controllers/onboarding.controller.js';

const router = Router();

// All routes require authenticated TEACHER
router.use(authenticate, authorize('TEACHER'));

router.get('/', onboardingController.get);
router.post('/experienced', onboardingController.markExperienced);
router.post('/objective', onboardingController.setObjective);
router.post('/complete', onboardingController.complete);
router.post('/activate', onboardingController.activateFeatures);
router.post('/early-unlock', onboardingController.earlyUnlock);
router.post('/dismiss-badge', onboardingController.dismissBadge);

export default router;
