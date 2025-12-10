import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  CheckCircle,
  Clock,
  Gift,
  Flame,
  ChevronRight,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  missionApi,
  type StudentMission,
  MISSION_TYPE_LABELS,
  MISSION_TYPE_COLORS,
} from '../../lib/missionApi';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

interface MissionsWidgetProps {
  classroomId: string;
}

export const MissionsWidget = ({ classroomId }: MissionsWidgetProps) => {
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Obtener misiones del estudiante
  const { data: missions = [], isLoading } = useQuery({
    queryKey: ['my-missions', classroomId],
    queryFn: () => missionApi.getMyMissions(classroomId),
    enabled: !!classroomId,
  });

  // Obtener racha
  const { data: streakData } = useQuery({
    queryKey: ['my-streak', classroomId],
    queryFn: () => missionApi.getMyStreak(classroomId),
    enabled: !!classroomId,
  });

  // Mutation para reclamar recompensa
  const claimMutation = useMutation({
    mutationFn: missionApi.claimReward,
    onSuccess: (rewards) => {
      queryClient.invalidateQueries({ queryKey: ['my-missions', classroomId] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      
      // Celebración
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });

      toast.success(
        <div className="flex flex-col">
          <span className="font-bold">¡Misión completada!</span>
          <span className="text-sm">
            {rewards.xp > 0 && `+${rewards.xp} XP `}
            {rewards.gp > 0 && `+${rewards.gp} 💰 `}
            {rewards.hp > 0 && `+${rewards.hp} ❤️`}
          </span>
        </div>
      );
      setClaimingId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al reclamar');
      setClaimingId(null);
    },
  });

  // Mutation para reclamar racha
  const claimStreakMutation = useMutation({
    mutationFn: ({ milestone }: { milestone: number }) => 
      missionApi.claimStreakReward(classroomId, milestone),
    onSuccess: (rewards) => {
      queryClient.invalidateQueries({ queryKey: ['my-streak', classroomId] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      toast.success(
        <div className="flex flex-col">
          <span className="font-bold">¡Recompensa de racha!</span>
          <span className="text-sm">+{rewards.xp} XP +{rewards.gp} 💰</span>
        </div>
      );
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al reclamar');
    },
  });

  const handleClaim = (studentMissionId: string) => {
    setClaimingId(studentMissionId);
    claimMutation.mutate(studentMissionId);
  };

  // Separar misiones por estado
  const activeMissions = missions.filter(m => m.status === 'ACTIVE');
  const completedMissions = missions.filter(m => m.status === 'COMPLETED');
  const claimedMissions = missions.filter(m => m.status === 'CLAIMED');
  const displayMissions = showAll ? missions : missions.slice(0, 3);

  // Calcular próximo milestone de racha disponible
  const nextMilestone = streakData?.milestones.find(
    m => (streakData.streak.currentStreak >= m.days) && 
         !streakData.streak.claimedMilestones?.includes(m.days)
  );

  if (isLoading) {
    return (
      <Card className="p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </Card>
    );
  }

  if (missions.length === 0) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-lg flex items-center justify-center">
            <Target className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-gray-800 dark:text-white">Misiones</h3>
        </div>
        <div className="text-center py-6 text-gray-400">
          <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No tienes misiones asignadas</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-lg flex items-center justify-center">
            <Target className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-gray-800 dark:text-white">Misiones</h3>
        </div>
        
        {/* Racha */}
        {streakData && streakData.streak.currentStreak > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-full">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
              {streakData.streak.currentStreak} días
            </span>
          </div>
        )}
      </div>

      {/* Milestone de racha disponible */}
      {nextMilestone && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl text-white"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5" />
              <span className="font-medium">¡Racha de {nextMilestone.days} días!</span>
            </div>
            <Button
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white"
              onClick={() => claimStreakMutation.mutate({ milestone: nextMilestone.days })}
              disabled={claimStreakMutation.isPending}
            >
              <Gift className="w-4 h-4 mr-1" />
              +{nextMilestone.xp} XP
            </Button>
          </div>
        </motion.div>
      )}

      {/* Contador */}
      <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
        <span className="flex items-center gap-1 text-blue-600">
          <Clock className="w-4 h-4" />
          {activeMissions.length} activas
        </span>
        <span className="flex items-center gap-1 text-amber-600">
          <Gift className="w-4 h-4" />
          {completedMissions.length} por reclamar
        </span>
        <span className="flex items-center gap-1 text-emerald-600">
          <CheckCircle className="w-4 h-4" />
          {claimedMissions.length} completadas
        </span>
      </div>

      {/* Lista de misiones */}
      <div className="space-y-3">
        <AnimatePresence>
          {displayMissions.map((studentMission) => (
            <MissionItem
              key={studentMission.id}
              studentMission={studentMission}
              onClaim={handleClaim}
              isClaiming={claimingId === studentMission.id}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Ver más */}
      {missions.length > 3 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full mt-4 py-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center justify-center gap-1"
        >
          {showAll ? 'Ver menos' : `Ver todas (${missions.length})`}
          <ChevronRight className={`w-4 h-4 transition-transform ${showAll ? 'rotate-90' : ''}`} />
        </button>
      )}
    </Card>
  );
};

// Componente de item de misión
interface MissionItemProps {
  studentMission: StudentMission;
  onClaim: (id: string) => void;
  isClaiming: boolean;
}

const MissionItem = ({ studentMission, onClaim, isClaiming }: MissionItemProps) => {
  const { mission, currentProgress, targetProgress, status } = studentMission;
  const progressPercent = Math.min((currentProgress / targetProgress) * 100, 100);
  const isCompleted = status === 'COMPLETED';
  const isClaimed = status === 'CLAIMED';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`p-4 rounded-xl border-2 transition-all ${
        isCompleted
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
          : isClaimed
          ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60'
          : `${MISSION_TYPE_COLORS[mission.type].bg} ${MISSION_TYPE_COLORS[mission.type].border}`
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icono */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
          isCompleted ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-white/50 dark:bg-gray-700/50'
        }`}>
          {isCompleted ? <CheckCircle className="w-6 h-6 text-emerald-600" /> : mission.icon}
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-800 dark:text-white truncate">
              {mission.name}
            </h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${MISSION_TYPE_COLORS[mission.type].bg} ${MISSION_TYPE_COLORS[mission.type].text}`}>
              {MISSION_TYPE_LABELS[mission.type]}
            </span>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-1">
            {mission.description}
          </p>

          {/* Barra de progreso */}
          {!isClaimed && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500">Progreso</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {currentProgress}/{targetProgress}
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  className={`h-full rounded-full ${
                    isCompleted
                      ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                      : 'bg-gradient-to-r from-purple-400 to-indigo-500'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Recompensas y acciones */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              {mission.rewardXp > 0 && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <TrendingUp className="w-3 h-3" />
                  +{mission.rewardXp} XP
                </span>
              )}
              {mission.rewardGp > 0 && (
                <span className="text-amber-600">💰 +{mission.rewardGp}</span>
              )}
              {mission.attachmentUrl && (
                <a
                  href={mission.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                >
                  <FileText className="w-3 h-3" />
                  Archivo
                </a>
              )}
            </div>

            {/* Botón reclamar */}
            {isCompleted && (
              <Button
                size="sm"
                onClick={() => onClaim(studentMission.id)}
                disabled={isClaiming}
                className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
              >
                {isClaiming ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <>
                    <Gift className="w-4 h-4 mr-1" />
                    Reclamar
                  </>
                )}
              </Button>
            )}

            {isClaimed && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Reclamada
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
