import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Swords, Heart, Users, ChevronRight, Skull } from 'lucide-react';
import { studentBossBattleApi, type AvailableBattle } from '../../lib/studentBossBattleApi';

interface BossBattleWidgetProps {
  classroomId: string;
  studentProfileId: string;
}

export const BossBattleWidget = ({ classroomId, studentProfileId }: BossBattleWidgetProps) => {
  const navigate = useNavigate();

  const { data: battles = [], isLoading } = useQuery({
    queryKey: ['student-boss-battles-available', classroomId, studentProfileId],
    queryFn: () => studentBossBattleApi.getAvailableForStudent(classroomId, studentProfileId),
    enabled: !!classroomId && !!studentProfileId,
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  // Filtrar solo batallas activas donde el estudiante puede participar
  const activeBattles = battles.filter(b => b.status === 'ACTIVE' && b.canParticipate);

  if (isLoading || activeBattles.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-lg rounded-2xl p-4 border border-red-500/30"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <Swords className="text-white" size={16} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Boss Battles</h3>
            <p className="text-xs text-gray-400">{activeBattles.length} batalla{activeBattles.length !== 1 ? 's' : ''} disponible{activeBattles.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/student-battle/${classroomId}`)}
          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
        >
          Ver todas <ChevronRight size={14} />
        </button>
      </div>

      <div className="space-y-2">
        {activeBattles.slice(0, 2).map((battle) => (
          <BattlePreview
            key={battle.id}
            battle={battle}
            onClick={() => navigate(`/student-battle/${classroomId}/${battle.id}`)}
          />
        ))}
      </div>
    </motion.div>
  );
};

interface BattlePreviewProps {
  battle: AvailableBattle;
  onClick: () => void;
}

const BattlePreview = ({ battle, onClick }: BattlePreviewProps) => {
  const hpPercentage = battle.hpPercentage;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full bg-white/10 hover:bg-white/15 rounded-xl p-3 flex items-center gap-3 transition-colors text-left"
    >
      {/* Boss icon */}
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0">
        {battle.bossImageUrl ? (
          <img src={battle.bossImageUrl} alt="" className="w-full h-full rounded-lg object-cover" />
        ) : (
          <Skull className="text-white" size={20} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-white text-sm truncate">{battle.bossName}</h4>
        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
          <span className="flex items-center gap-1">
            <Heart size={10} className="text-red-400" />
            {hpPercentage}%
          </span>
          <span className="flex items-center gap-1">
            <Users size={10} className="text-blue-400" />
            {battle.activeBattlers}
          </span>
        </div>
        {/* Mini HP bar */}
        <div className="h-1 bg-white/10 rounded-full mt-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full ${
              hpPercentage > 60 ? 'bg-emerald-500' : hpPercentage > 30 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${hpPercentage}%` }}
          />
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight className="text-gray-500 flex-shrink-0" size={16} />
    </motion.button>
  );
};

export default BossBattleWidget;
