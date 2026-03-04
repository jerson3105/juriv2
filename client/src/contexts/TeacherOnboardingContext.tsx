import { createContext, useContext, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { onboardingApi, type OnboardingData } from '../lib/onboardingApi';
import { useAuthStore } from '../store/authStore';

interface TeacherOnboardingContextValue {
  data: OnboardingData | null;
  isLoading: boolean;
  /** Whether the onboarding flow needs to be shown (not yet completed) */
  needsOnboarding: boolean;
  /** Whether a feature is unlocked (always true for experienced teachers) */
  isFeatureUnlocked: (feature: string) => boolean;
  /** Whether a feature has the "¡Nuevo!" badge */
  isFeatureNew: (feature: string) => boolean;
  /** Whether there are pending unlock invitations */
  hasPendingUnlocks: boolean;
  /** Activate pending features */
  activateFeatures: (features: string[]) => Promise<void>;
  /** Early unlock features */
  earlyUnlock: (features: string[]) => Promise<void>;
  /** Dismiss "¡Nuevo!" badge for a feature */
  dismissBadge: (feature: string) => Promise<void>;
  /** Refetch onboarding data */
  refetch: () => void;
}

const TeacherOnboardingContext = createContext<TeacherOnboardingContextValue | null>(null);

export function TeacherOnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isTeacher = user?.role === 'TEACHER';

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-onboarding'],
    queryFn: onboardingApi.get,
    enabled: isTeacher,
    staleTime: 60_000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['teacher-onboarding'] });
  }, [queryClient]);

  const activateMutation = useMutation({
    mutationFn: (features: string[]) => onboardingApi.activateFeatures(features),
    onSuccess: () => invalidate(),
  });

  const earlyUnlockMutation = useMutation({
    mutationFn: (features: string[]) => onboardingApi.earlyUnlock(features),
    onSuccess: () => invalidate(),
  });

  const dismissBadgeMutation = useMutation({
    mutationFn: (feature: string) => onboardingApi.dismissBadge(feature),
    onSuccess: () => invalidate(),
  });

  const needsOnboarding = isTeacher && !!data && !data.onboardingCompleted;

  const isFeatureUnlocked = useCallback((feature: string) => {
    if (!data) return true; // No data yet → don't block
    if (data.isExperienced) return true;
    return (data.unlockedFeatures ?? []).includes(feature);
  }, [data]);

  const isFeatureNew = useCallback((feature: string) => {
    if (!data) return false;
    return (data.newFeatures ?? []).includes(feature);
  }, [data]);

  const hasPendingUnlocks = !!data && (data.pendingUnlocks ?? []).length > 0;

  const value = useMemo<TeacherOnboardingContextValue>(() => ({
    data: data ?? null,
    isLoading,
    needsOnboarding,
    isFeatureUnlocked,
    isFeatureNew,
    hasPendingUnlocks,
    activateFeatures: async (features) => { await activateMutation.mutateAsync(features); },
    earlyUnlock: async (features) => { await earlyUnlockMutation.mutateAsync(features); },
    dismissBadge: async (feature) => { await dismissBadgeMutation.mutateAsync(feature); },
    refetch: invalidate,
  }), [data, isLoading, needsOnboarding, isFeatureUnlocked, isFeatureNew, hasPendingUnlocks, activateMutation, earlyUnlockMutation, dismissBadgeMutation, invalidate]);

  return (
    <TeacherOnboardingContext.Provider value={value}>
      {children}
    </TeacherOnboardingContext.Provider>
  );
}

export function useTeacherOnboarding() {
  const ctx = useContext(TeacherOnboardingContext);
  if (!ctx) {
    throw new Error('useTeacherOnboarding must be used within TeacherOnboardingProvider');
  }
  return ctx;
}

/** Safe version that returns null if outside provider (for shared layouts) */
export function useTeacherOnboardingSafe() {
  return useContext(TeacherOnboardingContext);
}
