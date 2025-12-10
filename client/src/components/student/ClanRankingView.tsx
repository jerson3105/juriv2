import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trophy, ArrowLeft, Medal } from 'lucide-react';
import { clanApi, CLAN_EMBLEMS } from '../../lib/clanApi';

interface ClanRankingViewProps {
  classroomId: string;
  myClanId?: string;
  onBack: () => void;
}

export const ClanRankingView = ({ classroomId, myClanId, onBack }: ClanRankingViewProps) => {
  const { data: ranking, isLoading } = useQuery({
    queryKey: ['clan-ranking', classroomId],
    queryFn: () => clanApi.getRanking(classroomId),
    enabled: !!classroomId,
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <span className="text-2xl">🥇</span>;
      case 2:
        return <span className="text-2xl">🥈</span>;
      case 3:
        return <span className="text-2xl">🥉</span>;
      default:
        return <span className="text-lg font-bold text-gray-400">#{rank}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Trophy size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">
              Ranking de Clanes
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Competencia entre equipos
            </p>
          </div>
        </div>
      </div>

      {/* Lista de ranking */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : ranking && ranking.length > 0 ? (
        <div className="space-y-3">
          {ranking.map((clan, index) => {
            const isMyTeam = clan.id === myClanId;
            
            return (
              <motion.div
                key={clan.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`rounded-xl overflow-hidden shadow-lg ${
                  isMyTeam 
                    ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-gray-900' 
                    : ''
                }`}
              >
                <div
                  className="p-4 flex items-center gap-4"
                  style={{ 
                    backgroundColor: index < 3 ? clan.color : undefined,
                    color: index < 3 ? 'white' : undefined,
                  }}
                >
                  {/* Posición */}
                  <div className="w-12 flex justify-center">
                    {getRankIcon(clan.rank)}
                  </div>

                  {/* Info del clan */}
                  <div className={`flex-1 ${index >= 3 ? 'bg-white dark:bg-gray-800' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{CLAN_EMBLEMS[clan.emblem] || '🛡️'}</span>
                      <div>
                        <h3 className={`font-bold ${index >= 3 ? 'text-gray-800 dark:text-white' : ''}`}>
                          {clan.name}
                          {isMyTeam && (
                            <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                              Tu clan
                            </span>
                          )}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right">
                    <p className={`text-lg font-bold ${index >= 3 ? 'text-violet-600 dark:text-violet-400' : ''}`}>
                      {clan.totalXp.toLocaleString()} XP
                    </p>
                    <p className={`text-xs ${index >= 3 ? 'text-gray-500' : 'opacity-80'}`}>
                      {clan.wins} victorias
                    </p>
                  </div>
                </div>

                {/* Barra de progreso visual para top 3 */}
                {index < 3 && ranking[0] && (
                  <div className="h-1 bg-white/20">
                    <div
                      className="h-full bg-white/50"
                      style={{ width: `${(clan.totalXp / ranking[0].totalXp) * 100}%` }}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
          <Medal className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No hay clanes en esta clase</p>
        </div>
      )}
    </div>
  );
};
