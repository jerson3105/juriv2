import { Request, Response } from 'express';
import { onboardingService, ALL_FEATURES } from '../services/onboarding.service.js';

class OnboardingController {

  /** GET /api/onboarding — get current onboarding state */
  async get(req: Request, res: Response) {
    try {
      const teacherId = req.user!.id;
      let record = await onboardingService.get(teacherId);

      // Auto-create if missing (first time)
      if (!record) {
        const created = await onboardingService.create(teacherId);
        record = { ...created, level: 'Principiante' };
      }

      res.json({
        success: true,
        data: {
          ...record,
          lockedFeatures: onboardingService.getLockedFeatures(record.unlockedFeatures),
          schedule: onboardingService.getUnlockScheduleInfo(record.completedAt, record.unlockedFeatures),
        },
      });
    } catch (error) {
      console.error('Error getting onboarding:', error);
      res.status(500).json({ success: false, message: 'Error al obtener onboarding' });
    }
  }

  /** POST /api/onboarding/experienced — mark as experienced, unlock everything */
  async markExperienced(req: Request, res: Response) {
    try {
      const teacherId = req.user!.id;
      await onboardingService.markExperienced(teacherId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking experienced:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar onboarding' });
    }
  }

  /** POST /api/onboarding/objective — save objective selection */
  async setObjective(req: Request, res: Response) {
    try {
      const teacherId = req.user!.id;
      const { objective } = req.body;

      if (!['participation', 'behavior', 'learning', 'unknown'].includes(objective)) {
        return res.status(400).json({ success: false, message: 'Objetivo inválido' });
      }

      await onboardingService.setObjective(teacherId, objective);
      res.json({ success: true });
    } catch (error) {
      console.error('Error setting objective:', error);
      res.status(500).json({ success: false, message: 'Error al guardar objetivo' });
    }
  }

  /** POST /api/onboarding/complete — complete the onboarding flow */
  async complete(req: Request, res: Response) {
    try {
      const teacherId = req.user!.id;
      await onboardingService.completeOnboarding(teacherId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error completing onboarding:', error);
      res.status(500).json({ success: false, message: 'Error al completar onboarding' });
    }
  }

  /** POST /api/onboarding/activate — activate pending features */
  async activateFeatures(req: Request, res: Response) {
    try {
      const teacherId = req.user!.id;
      const { features } = req.body;

      if (!Array.isArray(features) || features.length === 0) {
        return res.status(400).json({ success: false, message: 'Se requiere un array de features' });
      }

      const unlocked = await onboardingService.activateFeatures(teacherId, features);
      res.json({ success: true, data: { unlockedFeatures: unlocked } });
    } catch (error) {
      console.error('Error activating features:', error);
      res.status(500).json({ success: false, message: 'Error al activar funciones' });
    }
  }

  /** POST /api/onboarding/early-unlock — early unlock features */
  async earlyUnlock(req: Request, res: Response) {
    try {
      const teacherId = req.user!.id;
      const { features } = req.body;

      if (!Array.isArray(features) || features.length === 0) {
        return res.status(400).json({ success: false, message: 'Se requiere un array de features' });
      }

      const unlocked = await onboardingService.earlyUnlock(teacherId, features);
      res.json({ success: true, data: { unlockedFeatures: unlocked } });
    } catch (error) {
      console.error('Error early unlocking:', error);
      res.status(500).json({ success: false, message: 'Error al desbloquear funciones' });
    }
  }

  /** POST /api/onboarding/dismiss-badge — clear "¡Nuevo!" badge for a feature */
  async dismissBadge(req: Request, res: Response) {
    try {
      const teacherId = req.user!.id;
      const { feature } = req.body;

      if (!feature || !ALL_FEATURES.includes(feature)) {
        return res.status(400).json({ success: false, message: 'Feature inválida' });
      }

      await onboardingService.dismissNewBadge(teacherId, feature);
      res.json({ success: true });
    } catch (error) {
      console.error('Error dismissing badge:', error);
      res.status(500).json({ success: false, message: 'Error al descartar badge' });
    }
  }
}

export const onboardingController = new OnboardingController();
