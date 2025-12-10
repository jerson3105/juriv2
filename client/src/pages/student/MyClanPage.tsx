import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Trophy, 
  Users, 
  TrendingUp, 
  Crown,
  Star,
  Zap,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clanApi, CLAN_EMBLEMS } from '../../lib/clanApi';
import { useStudentStore } from '../../store/studentStore';
import { studentApi } from '../../lib/studentApi';

export const MyClanPage = () => {
  const navigate = useNavigate();
  const { selectedClassIndex } = useStudentStore();

  // Obtener perfil del estudiante
  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });

  const currentProfile = myClasses?.[selectedClassIndex];

  // Obtener info del clan
  const { data: clanInfo, isLoading } = useQuery({
    queryKey: ['student-clan', currentProfile?.id],
    queryFn: () => clanApi.getStudentClanInfo(currentProfile!.id),
    enabled: !!currentProfile?.id,
  });

  // Obtener ranking de clanes
  const { data: ranking } = useQuery({
    queryKey: ['clan-ranking', currentProfile?.classroomId],
    queryFn: () => clanApi.getRanking(currentProfile!.classroomId),
    enabled: !!currentProfile?.classroomId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500" />
        </div>
      </div>
    );
  }

  if (!clanInfo) {
    return (
      <div className="space-y-6">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Volver al dashboard</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center ring-4 ring-teal-200 dark:ring-teal-800">
              <Shield className="text-teal-600 dark:text-teal-400 w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Mi Clan</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Trabaja en equipo con tu clan para ganar</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-xl">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
            Sin clan asignado
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Tu profesor te asignará a un clan pronto. ¡Mantente atento!
          </p>
        </div>
      </div>
    );
  }

  const { clan, members, myContribution } = clanInfo;

  // Ordenar miembros por contribución (si tuviéramos ese dato) o por nivel
  const sortedMembers = [...members].sort((a, b) => b.level - a.level);
  const myPosition = sortedMembers.findIndex(m => m.id === currentProfile?.id) + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Volver al dashboard</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center ring-4 ring-teal-200 dark:ring-teal-800">
            <Shield className="text-teal-600 dark:text-teal-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Mi Clan</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Trabaja en equipo con tu clan para ganar</p>
          </div>
        </div>
      </div>

      {/* Header del clan */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden shadow-xl"
        style={{ backgroundColor: clan.color }}
      >
          <div className="p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center text-5xl">
                {CLAN_EMBLEMS[clan.emblem] || '🛡️'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold">{clan.name}</h1>
                  <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-sm">
                    <Trophy size={14} />
                    <span>#{clan.rank}</span>
                  </div>
                </div>
                {clan.motto && (
                  <p className="text-white/80 italic mt-1">"{clan.motto}"</p>
                )}
              </div>
            </div>
          </div>

          {/* Stats del clan */}
          <div className="bg-white dark:bg-gray-800 p-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                <Zap className="w-5 h-5 text-violet-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-violet-600 dark:text-violet-400">
                  {clan.totalXp.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">XP Total</p>
              </div>
              <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <Trophy className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {clan.wins}
                </p>
                <p className="text-xs text-gray-500">Victorias</p>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {members.length}
                </p>
                <p className="text-xs text-gray-500">Miembros</p>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  +{myContribution}
                </p>
                <p className="text-xs text-gray-500">Mi aporte</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Grid de contenido */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Miembros del clan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg"
          >
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-500" />
              Miembros del Clan
            </h2>
            <div className="space-y-2">
              {sortedMembers.map((member, index) => {
                const isMe = member.id === currentProfile?.id;
                return (
                  <div
                    key={member.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      isMe 
                        ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800' 
                        : 'bg-gray-50 dark:bg-gray-700'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      index === 0 
                        ? 'bg-amber-100 text-amber-600' 
                        : index === 1 
                          ? 'bg-gray-200 text-gray-600' 
                          : index === 2 
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-gray-100 text-gray-500'
                    }`}>
                      {index === 0 ? <Crown size={16} /> : index + 1}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${isMe ? 'text-teal-700 dark:text-teal-300' : 'text-gray-800 dark:text-white'}`}>
                        {member.characterName || 'Sin nombre'}
                        {isMe && <span className="ml-2 text-xs bg-teal-500 text-white px-2 py-0.5 rounded-full">Tú</span>}
                      </p>
                      <p className="text-xs text-gray-500">Nivel {member.level}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-violet-600 dark:text-violet-400">
                        {member.xp.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">XP</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Ranking de clanes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg"
          >
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Ranking de Clanes
            </h2>
            <div className="space-y-2">
              {ranking?.slice(0, 5).map((rankedClan, index) => {
                const isMyClan = rankedClan.id === clan.id;
                return (
                  <div
                    key={rankedClan.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      isMyClan 
                        ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800' 
                        : 'bg-gray-50 dark:bg-gray-700'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                      index === 0 
                        ? 'bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-500/30' 
                        : index === 1 
                          ? 'bg-gradient-to-br from-gray-300 to-gray-400' 
                          : index === 2 
                            ? 'bg-gradient-to-br from-orange-400 to-amber-500'
                            : ''
                    }`}
                    style={index > 2 ? { backgroundColor: rankedClan.color } : undefined}
                    >
                      {index < 3 ? (
                        <span className="text-white font-bold">{index + 1}</span>
                      ) : (
                        CLAN_EMBLEMS[rankedClan.emblem] || '🛡️'
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${isMyClan ? 'text-teal-700 dark:text-teal-300' : 'text-gray-800 dark:text-white'}`}>
                        {rankedClan.name}
                        {isMyClan && <span className="ml-2 text-xs">⭐</span>}
                      </p>
                      <p className="text-xs text-gray-500">{rankedClan.wins} victorias</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-violet-600 dark:text-violet-400">
                        {rankedClan.totalXp.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">XP</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Mi posición en el clan */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-2xl p-6 text-white shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold mb-1">Tu posición en el clan</h3>
              <p className="text-teal-100 text-sm">
                Eres el #{myPosition} de {members.length} miembros
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                <Star className="w-6 h-6 text-yellow-300" />
                <span className="text-3xl font-bold">+{myContribution}</span>
              </div>
              <p className="text-teal-100 text-sm">XP aportados al clan</p>
            </div>
          </div>
        </motion.div>
    </div>
  );
};
