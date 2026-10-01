import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

interface Milestone {
  day: number;
  xp: number;
  gp: number;
  randomItem: boolean;
}

/** Días seguidos (racha de ingreso) del alumno en una clase. */
export interface StreakStatus {
  enabled: boolean;
  streak?: {
    currentStreak: number;
    longestStreak: number;
    totalLogins: number;
    lastLoginDate: string | null;
    claimedMilestones: number[];
  };
  config?: {
    milestones: Milestone[];
    dailyXp: number;
  };
  nextMilestone?: {
    day: number;
    xp: number;
    gp: number;
    randomItem: boolean;
    daysRemaining: number;
  } | null;
  canClaimToday?: boolean;
}

export const useStreakStatus = (classroomId: string) => useQuery({
  queryKey: ['login-streak', classroomId],
  queryFn: async () => {
    const { data } = await api.get(`/login-streak/${classroomId}/status`);
    return data.data as StreakStatus;
  },
  enabled: !!classroomId,
});

/** Próximo regalo de días seguidos, salvo que ya se haya cobrado (el servidor puede anunciarlo igual). */
export const nextGiftOf = (status?: StreakStatus) => {
  const next = status?.nextMilestone;
  if (!next || status?.streak?.claimedMilestones?.includes(next.day)) return null;
  return next;
};
