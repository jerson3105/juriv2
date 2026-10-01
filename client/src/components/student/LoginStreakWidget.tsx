import { useState, useEffect, useId } from 'react';
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
    randomItem: unknown | null;
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
  /**
   * 'card': la tarjeta de días seguidos (en el inicio de la clase).
   * 'recorder': sin tarjeta; registra el día al entrar a cualquier pantalla y muestra el premio.
   */
  variant?: 'card' | 'recorder';
  /** recorder: no mostrar el premio todavía (p. ej. mientras se ve la historia); se registra igual. */
  paused?: boolean;
  /** recorder: avisa cuando ya no tiene nada pendiente que mostrar (para encadenar la celebración). */
  onSettledChange?: (settled: boolean) => void;
}

const useStreakStatus = (classroomId: string) => useQuery({
  queryKey: ['login-streak', classroomId],
  queryFn: async () => {
    const { data } = await api.get(`/login-streak/${classroomId}/status`);
    return data.data as StreakStatus;
  },
  enabled: !!classroomId,
});

export const LoginStreakWidget = ({ classroomId, variant = 'card', paused = false, onSettledChange }: LoginStreakWidgetProps) =>
  variant === 'recorder'
    ? <StreakRecorder classroomId={classroomId} paused={paused} onSettledChange={onSettledChange} />
    : <StreakCard classroomId={classroomId} />;

// ==================== Registro del día y premio ====================
const StreakRecorder = ({ classroomId, paused, onSettledChange }: { classroomId: string; paused: boolean; onSettledChange?: (settled: boolean) => void }) => {
  const queryClient = useQueryClient();
  const titleId = useId();
  const [rewardData, setRewardData] = useState<LoginStreakResult['rewards'] | null>(null);
  const [newStreak, setNewStreak] = useState(0);
  const { data: streakStatus, isError } = useStreakStatus(classroomId);

  const recordLoginMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/login-streak/${classroomId}/record`);
      return data.data as LoginStreakResult;
    },
    onSuccess: (data) => {
      if (data.isNewLogin && data.rewards) {
        setRewardData(data.rewards);
        setNewStreak(data.streak.currentStreak);
        if (data.rewards.milestoneReached) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, disableForReducedMotion: true });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['login-streak', classroomId] });
      queryClient.invalidateQueries({ queryKey: ['my-classes'] });
    },
  });

  // Registrar el día automáticamente si aún no se registró hoy.
  const { mutate, isPending } = recordLoginMutation;
  useEffect(() => {
    if (streakStatus?.enabled && streakStatus?.canClaimToday && !isPending) mutate();
    // Solo cuando cambia el estado del día (no en cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streakStatus?.enabled, streakStatus?.canClaimToday]);

  // Nada pendiente: el estado llegó (o falló), no hay día por registrar ni premio abierto.
  const settled = isError || (!!streakStatus && !isPending && !rewardData && !(streakStatus.enabled && streakStatus.canClaimToday));
  useEffect(() => { onSettledChange?.(settled); }, [settled, onSettledChange]);

  const showReward = !!rewardData && !paused;
  const close = () => setRewardData(null);
  useEffect(() => {
    if (!showReward) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showReward]);

  return (
    <AnimatePresence>
      {showReward && rewardData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gradient-to-br from-orange-700 to-red-700 rounded-2xl p-6 max-w-sm w-full text-white text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <Flame className="w-10 h-10" aria-hidden="true" />
            </motion.div>

            <h2 id={titleId} className="text-2xl font-bold mb-2">
              {rewardData.milestoneReached
                ? `🎉 ¡${rewardData.milestoneReached} días seguidos!`
                : '🔥 ¡Volviste hoy!'}
            </h2>

            <p className="text-white mb-4">
              {rewardData.milestoneReached
                ? '¡Llegaste a una meta de días seguidos!'
                : `Llevas ${newStreak} ${newStreak === 1 ? 'día seguido' : 'días seguidos'}.`}
            </p>

            <div className="space-y-2 mb-6">
              {rewardData.dailyXp > 0 && (
                <div className="flex items-center justify-center gap-2 bg-black/20 rounded-xl py-2">
                  <Sparkles className="w-5 h-5 text-yellow-200" aria-hidden="true" />
                  <span className="font-bold">+{rewardData.dailyXp} XP</span>
                  <span className="text-sm">(por entrar hoy)</span>
                </div>
              )}
              {rewardData.milestoneXp > 0 && (
                <div className="flex items-center justify-center gap-2 bg-black/20 rounded-xl py-2">
                  <Sparkles className="w-5 h-5 text-yellow-200" aria-hidden="true" />
                  <span className="font-bold">+{rewardData.milestoneXp} XP</span>
                  <span className="text-sm">(meta)</span>
                </div>
              )}
              {rewardData.milestoneGp > 0 && (
                <div className="flex items-center justify-center gap-2 bg-black/20 rounded-xl py-2">
                  <span className="text-xl" aria-hidden="true">🪙</span>
                  <span className="font-bold">+{rewardData.milestoneGp} de oro</span>
                </div>
              )}
              {!!rewardData.randomItem && (
                <div className="flex items-center justify-center gap-2 bg-black/20 rounded-xl py-2">
                  <Gift className="w-5 h-5 text-purple-200" aria-hidden="true" />
                  <span className="font-bold">¡Objeto sorpresa!</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={close}
              autoFocus
              className="w-full min-h-[44px] py-3 bg-white text-orange-800 rounded-xl font-bold hover:bg-orange-50 transition-colors"
            >
              ¡Genial!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ==================== Tarjeta de días seguidos ====================
const StreakCard = ({ classroomId }: { classroomId: string }) => {
  const { data: streakStatus, isLoading } = useStreakStatus(classroomId);

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-orange-700 to-red-700 rounded-2xl p-3 motion-safe:animate-pulse">
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

  // Los próximos días para mostrar (centrado en el día actual)
  const displayDays = Array.from({ length: 12 }, (_, i) => Math.max(1, currentStreak - 3) + i);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-orange-700 via-orange-700 to-red-700 rounded-2xl p-4 text-white shadow-lg overflow-hidden relative"
    >
      {/* Fondo decorativo */}
      <div className="absolute inset-0 opacity-10" aria-hidden="true">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-white rounded-full translate-y-1/2" />
      </div>

      <div className="relative flex flex-col md:flex-row md:items-center gap-4">
        {/* Días seguidos */}
        <div className="flex items-center gap-3 md:min-w-[180px]">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Flame className="w-7 h-7" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold">{currentStreak}</p>
              <p className="text-white text-sm">{currentStreak === 1 ? 'día' : 'días'}</p>
            </div>
            <p className="text-white text-xs font-semibold">Días seguidos</p>
          </div>
        </div>

        {/* Recorrido de días */}
        <div className="min-w-0 flex-1 bg-black/15 rounded-xl p-2 md:p-3">
          <div className="flex items-center justify-center gap-1 md:gap-2 overflow-x-auto pb-1">
            {displayDays.slice(0, 10).map((day) => {
              const isPast = day < currentStreak;
              const isCurrent = day === currentStreak;
              const isMilestone = milestones.some((m) => m.day === day);
              const isClaimed = claimedMilestones.includes(day);

              return (
                <div key={day} className={`flex flex-col items-center min-w-[36px] ${isCurrent ? 'scale-110' : ''}`}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isPast || isCurrent
                        ? isMilestone
                          ? 'bg-amber-300 text-amber-950'
                          : 'bg-white text-orange-800'
                        : 'bg-black/25 text-white'
                    } ${isCurrent ? 'ring-2 ring-white ring-offset-2 ring-offset-orange-700' : ''}`}
                  >
                    {isPast || isCurrent ? (
                      isMilestone && isClaimed ? <Gift className="w-4 h-4" aria-label="Regalo cobrado" /> : <Check className="w-4 h-4" aria-label="Hecho" />
                    ) : isMilestone ? (
                      <Gift className="w-4 h-4" aria-label="Regalo" />
                    ) : (
                      day
                    )}
                  </div>
                  <span className="text-xs mt-1 text-white">
                    {isCurrent ? 'Hoy' : `D${day}`}
                  </span>
                </div>
              );
            })}
            {nextMilestone && nextMilestone.day > displayDays[displayDays.length - 1] && (
              <div className="flex items-center gap-1 text-white">
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-black/25 flex items-center justify-center">
                    <Gift className="w-4 h-4 text-amber-200" aria-label="Regalo" />
                  </div>
                  <span className="text-xs mt-1">D{nextMilestone.day}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Próximo regalo y totales */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:min-w-[280px]">
          {nextMilestone && (
            <div className="flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2">
              <Gift className="w-4 h-4 text-amber-200 flex-shrink-0" aria-hidden="true" />
              <div className="text-xs">
                Próximo regalo en <strong>{nextMilestone.daysRemaining} {nextMilestone.daysRemaining === 1 ? 'día' : 'días'}</strong>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="bg-white/20 px-2 py-0.5 rounded-full">+{nextMilestone.xp} XP</span>
                {nextMilestone.gp > 0 && (
                  <span className="bg-white/20 px-2 py-0.5 rounded-full">+{nextMilestone.gp} de oro</span>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-white md:ml-auto">
            <span><span aria-hidden="true">🏆</span> <span className="sr-only">Mejor racha: </span>{streak?.longestStreak || 0}</span>
            <span><span aria-hidden="true">📅</span> <span className="sr-only">Días en total: </span>{streak?.totalLogins || 0}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
