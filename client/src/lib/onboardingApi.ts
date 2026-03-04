import { api } from './api';
import type { ApiResponse } from './api';

export interface OnboardingScheduleTier {
  daysAfter: number;
  features: string[];
  available: boolean;
  daysRemaining: number;
  allUnlocked: boolean;
}

export interface OnboardingData {
  id: string;
  teacherId: string;
  isExperienced: boolean;
  objective: 'participation' | 'behavior' | 'learning' | 'unknown';
  onboardingCompleted: boolean;
  completedAt: string | null;
  unlockedFeatures: string[];
  pendingUnlocks: string[];
  newFeatures: string[];
  lockedFeatures: string[];
  level: string;
  schedule: OnboardingScheduleTier[];
}

export const onboardingApi = {
  get: () =>
    api.get<ApiResponse<OnboardingData>>('/onboarding').then(r => r.data.data!),

  markExperienced: () =>
    api.post<ApiResponse<null>>('/onboarding/experienced'),

  setObjective: (objective: string) =>
    api.post<ApiResponse<null>>('/onboarding/objective', { objective }),

  complete: () =>
    api.post<ApiResponse<null>>('/onboarding/complete'),

  activateFeatures: (features: string[]) =>
    api.post<ApiResponse<{ unlockedFeatures: string[] }>>('/onboarding/activate', { features })
      .then(r => r.data.data!),

  earlyUnlock: (features: string[]) =>
    api.post<ApiResponse<{ unlockedFeatures: string[] }>>('/onboarding/early-unlock', { features })
      .then(r => r.data.data!),

  dismissBadge: (feature: string) =>
    api.post<ApiResponse<null>>('/onboarding/dismiss-badge', { feature }),
};
