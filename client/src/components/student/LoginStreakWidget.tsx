import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Gift, Sparkles, Check, ChevronRight } from 'lucide-react';
import api from '../../lib/api';
import confetti from 'canvas-confetti';

interface Milestone {
  day: number;
  xp: number;
  gp: number;
  randomItem: boolean;
}

interface StreakStatus {
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

interface LoginStreakResult {
  streak: {
    currentStreak: number;
    longestStreak: number;
    totalLogins: number;
    lastLoginDate: string;
    claimedMilestones: number[];
  };
  rewards: {
    dailyXp: number;
    milestoneReached: number | null;
    milestoneXp: number;
    milestoneGp: number;
    randomItem: any | null;
  } | null;
  isNewLogin: boolean;
  nextMilestone: {
    day: number;
    xp: number;
    gp: number;
    daysRemaining: number;
  } | null;
}

interface LoginStreakWidgetProps {
  classroomId: string;
}

export const LoginStreakWidget = ({ classroomId }: LoginStreakWidgetProps) => {
  const queryClient = useQueryClient();
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardData, setRewardData] = useState<LoginStreakResult['rewards'] | null>(null);
  const [newStreak, setNewStreak] = useState(0);

  // Obtener estado de la racha
  const { data: streakStatus, isLoading } = useQuery({
    queryKey: ['login-streak', classroomId],
    queryFn: async () => {
      const { data } = await api.get(`/login-streak/${classroomId}/status`);
      return data.data as StreakStatus;
    },
    enabled: !!classroomId,
  });

  // Mutation para registrar login
  const recordLoginMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/login-streak/${classroomId}/record`);
      return data.data as LoginStreakResult;
    },
    onSuccess: (data) => {
      if (data.isNewLogin && data.rewards) {
        setRewardData(data.rewards);
        setNewStreak(data.streak.currentStreak);
        setShowRewardModal(true);
        
        // Confetti si hay milestone
        if (data.rewards.milestoneReached) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['login-streak', classroomId] });
      queryClient.invalidateQueries({ queryKey: ['my-classes'] });
    },
  });

  // Registrar login automáticamente si puede reclamar hoy
  useEffect(() => {
    if (streakStatus?.enabled && streakStatus?.canClaimToday && !recordLoginMutation.isPending) {
      recordLoginMutation.mutate();
    }
  }, [streakStatus?.enabled, streakStatus?.canClaimToday]);

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-3 animate-pulse">
        <div className="h-12 bg-white/20 rounded-xl" />
      </div>
    );
  }

  if (!streakStatus?.enabled) {
    return null;
  }

  const { streak, config, nextMilestone } = streakStatus;
  const currentStreak = streak?.currentStreak || 0;
  const claimedMilestones = streak?.claimedMilestones || [];
  const milestones = config?.milestones || [];

  // Obtener los próximos días para mostrar (centrado en el día actual)
  const displayDays = Array.from({ length: 12 }, (_, i) => {
    const day = Math.max(1, currentStreak - 3) + i;
    return day;
  });

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-orange-500 via-orange-500 to-red-500 rounded-2xl p-4 text-white shadow-lg overflow-hidden relative"
      >
        {/* Fondo decorativo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-white rounded-full translate-y-1/2" />
        </div>

        <div className="relative flex flex-col md:flex-row md:items-center gap-4">
          {/* Left: Streak info */}
          <div className="flex items-center gap-3 md:min-w-[180px]">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Flame className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-bold">{currentStreak}</p>
                <p className="text-orange-100 text-sm">días</p>
              </div>
              <p className="text-orange-100 text-xs">Racha de Login</p>
            </div>
          </div>

          {/* Center: Progress days */}
          <div className="flex-1 bg-white/10 rounded-xl p-2 md:p-3">
            <div className="flex items-center justify-center gap-1 md:gap-2 overflow-x-auto pb-1">
              {displayDays.slice(0, 10).map((day) => {
                const isPast = day < currentStreak;
                const isCurrent = day === currentStreak;
                const isMilestone = milestones.some(m => m.day === day);
                const isClaimed = claimedMilestones.includes(day);

                return (
                  <div
                    key={day}
                    className={`flex flex-col items-center min-w-[36px] ${
                      isCurrent ? 'scale-110' : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isPast || isCurrent
                          ? isMilestone
                            ? 'bg-amber-400 text-amber-900'
                            : 'bg-white text-orange-500'
                          : 'bg-white/20 text-white/60'
                      } ${isCurrent ? 'ring-2 ring-white ring-offset-2 ring-offset-orange-500' : ''}`}
                    >
                      {isPast || isCurrent ? (
                        isMilestone && isClaimed ? (
                          <Gift className="w-4 h-4" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )
                      ) : isMilestone ? (
                        <Gift className="w-4 h-4" />
                      ) : (
                        day
                      )}
                    </div>
                    <span className="text-[10px] mt-1 text-white/70">
                      {isCurrent ? 'Hoy' : `D${day}`}
                    </span>
                  </div>
                );
              })}
              {nextMilestone && nextMilestone.day > displayDays[displayDays.length - 1] && (
                <div className="flex items-center gap-1 text-white/50">
                  <ChevronRight className="w-4 h-4" />
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-amber-400/30 flex items-center justify-center">
                      <Gift className="w-4 h-4 text-amber-300" />
                    </div>
                    <span className="text-[10px] mt-1">D{nextMilestone.day}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Next milestone & stats */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:min-w-[280px]">
            {nextMilestone && (
              <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
                <Gift className="w-4 h-4 text-amber-300 flex-shrink-0" />
                <div className="text-xs">
                  <span className="text-orange-100">Próxima en </span>
                  <strong>{nextMilestone.daysRemaining}d</strong>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="bg-white/20 px-2 py-0.5 rounded-full">+{nextMilestone.xp} XP</span>
                  {nextMilestone.gp > 0 && (
                    <span className="bg-amber-400/30 text-amber-200 px-2 py-0.5 rounded-full">+{nextMilestone.gp} GP</span>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center gap-4 text-xs text-orange-100 md:ml-auto">
              <span>🏆 {streak?.longestStreak || 0}</span>
              <span>📅 {streak?.totalLogins || 0}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Modal de recompensa */}
      <AnimatePresence>
        {showRewardModal && rewardData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowRewardModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 max-w-sm w-full text-white text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <Flame className="w-10 h-10" />
              </motion.div>

              <h2 className="text-2xl font-bold mb-2">
                {rewardData.milestoneReached 
                  ? `🎉 ¡${rewardData.milestoneReached} días de racha!`
                  : '🔥 ¡Login diario!'}
              </h2>
              
              <p className="text-orange-100 mb-4">
                {rewardData.milestoneReached
                  ? '¡Felicidades! Has alcanzado un milestone.'
                  : `Llevas ${newStreak} días conectándote.`}
              </p>

              <div className="space-y-2 mb-6">
                {rewardData.dailyXp > 0 && (
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center justify-center gap-2 bg-white/20 rounded-xl py-2"
                  >
                    <Sparkles className="w-5 h-5 text-yellow-300" />
                    <span className="font-bold">+{rewardData.dailyXp} XP</span>
                    <span className="text-orange-200 text-sm">(diario)</span>
                  </motion.div>
                )}

                {rewardData.milestoneXp > 0 && (
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center justify-center gap-2 bg-amber-400/30 rounded-xl py-2"
                  >
                    <Sparkles className="w-5 h-5 text-yellow-300" />
                    <span className="font-bold">+{rewardData.milestoneXp} XP</span>
                    <span className="text-orange-200 text-sm">(milestone)</span>
                  </motion.div>
                )}

                {rewardData.milestoneGp > 0 && (
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center justify-center gap-2 bg-amber-400/30 rounded-xl py-2"
                  >
                    <span className="text-xl">🪙</span>
                    <span className="font-bold">+{rewardData.milestoneGp} GP</span>
                  </motion.div>
                )}

                {rewardData.randomItem && (
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="flex items-center justify-center gap-2 bg-purple-400/30 rounded-xl py-2"
                  >
                    <Gift className="w-5 h-5 text-purple-300" />
                    <span className="font-bold">¡Item sorpresa!</span>
                  </motion.div>
                )}
              </div>

              <button
                onClick={() => setShowRewardModal(false)}
                className="w-full py-3 bg-white text-orange-500 rounded-xl font-bold hover:bg-orange-50 transition-colors"
              >
                ¡Genial!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
