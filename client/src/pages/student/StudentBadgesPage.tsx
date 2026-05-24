import { useNavigate, useOutletContext } from 'react-router-dom';
import { useStudentStore } from '../../store/studentStore';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Medal, Sparkles, Target } from 'lucide-react';
import { studentApi } from '../../lib/studentApi';
import { badgeApi, type Badge, RARITY_COLORS, RARITY_LABELS } from '../../lib/badgeApi';

export const StudentBadgesPage = () => {
  const navigate = useNavigate();
  const { selectedClassIndex } = useStudentStore();
  const { hasStoryTheme } = useOutletContext<{ hasStoryTheme?: boolean }>();

  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });

  const currentProfile = myClasses?.[selectedClassIndex];

  const { data: studentBadges = [] } = useQuery({
    queryKey: ['student-badges', currentProfile?.id],
    queryFn: () => badgeApi.getStudentBadges(currentProfile!.id),
    enabled: !!currentProfile?.id,
  });

  const { data: badgeProgress = [] } = useQuery({
    queryKey: ['badge-progress', currentProfile?.id, currentProfile?.classroomId],
    queryFn: () => badgeApi.getStudentProgress(currentProfile!.id, currentProfile!.classroomId),
    enabled: !!currentProfile?.id && !!currentProfile?.classroomId,
  });

  if (!currentProfile) return null;

  return (
    <div className={`min-h-screen -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 ${hasStoryTheme ? '' : 'bg-gradient-to-br from-slate-50 via-amber-50 to-orange-50 dark:from-slate-950 dark:via-amber-950/40 dark:to-orange-950/60'}`}>
      {!hasStoryTheme && (
        <div className="absolute top-20 right-10 w-64 h-64 bg-amber-200 dark:bg-amber-950 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-30 animate-pulse" />
      )}

      <div className="relative z-10 space-y-6">
        <button
          onClick={() => navigate('/my-class')}
          className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Volver a mi clase</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center ring-4 ring-amber-200 dark:ring-amber-500/20">
            <Medal className="w-6 h-6 text-amber-600 dark:text-amber-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Mis Insignias</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {studentBadges.length} insignia{studentBadges.length !== 1 ? 's' : ''} desbloqueada{studentBadges.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {studentBadges.length > 0 && (
          <>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Desbloqueadas
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {studentBadges.map((studentBadge: any) => {
                const badge = studentBadge.badge as Badge;
                const colors = RARITY_COLORS[badge.rarity];
                return (
                  <motion.div
                    key={studentBadge.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    className={`bg-white dark:bg-gray-900/85 rounded-xl p-4 shadow-lg dark:shadow-black/20 border-2 ${colors.border} relative`}
                  >
                    {studentBadge.count > 1 && (
                      <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                        x{studentBadge.count}
                      </div>
                    )}
                    <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-br ${colors.gradient} shadow-lg mb-3`}>
                      {badge.customImage ? (
                        <img
                          src={`http://localhost:3001${badge.customImage}`}
                          alt={badge.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl">{badge.icon}</span>
                      )}
                    </div>
                    <h4 className="font-bold text-gray-800 dark:text-white text-center text-sm">{badge.name}</h4>
                    <p className={`text-xs text-center font-medium mt-1 ${colors.text}`}>
                      {RARITY_LABELS[badge.rarity]}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2 line-clamp-2">{badge.description}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
                      {new Date(studentBadge.unlockedAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {badgeProgress.length > 0 && (
          <>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mt-6">
              <Target className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              Por desbloquear
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {badgeProgress.map((progress: any) => {
                const badge = progress.badge as Badge;
                return (
                  <motion.div
                    key={badge.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gray-100 dark:bg-gray-900/80 rounded-xl p-4 shadow-lg dark:shadow-black/20 border-2 border-gray-300 dark:border-gray-700 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gray-900/10 dark:bg-black/20 pointer-events-none" />

                    <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-400 to-gray-500 shadow-lg mb-3 grayscale">
                      {badge.customImage ? (
                        <img
                          src={`http://localhost:3001${badge.customImage}`}
                          alt={badge.name}
                          className="w-full h-full object-cover opacity-50"
                        />
                      ) : (
                        <span className="text-3xl opacity-50">{badge.icon}</span>
                      )}
                    </div>
                    <h4 className="font-bold text-gray-600 dark:text-gray-200 text-center text-sm">{badge.name}</h4>
                    <p className="text-xs text-center font-medium mt-1 text-gray-500 dark:text-gray-400">
                      {RARITY_LABELS[badge.rarity]}
                    </p>

                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>{progress.currentValue}/{progress.targetValue}</span>
                        <span>{progress.percentage}%</span>
                      </div>
                      <div className="h-2 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress.percentage}%` }}
                          transition={{ duration: 0.5 }}
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {studentBadges.length === 0 && badgeProgress.length === 0 && (
          <div className="bg-white dark:bg-gray-900/85 rounded-2xl p-12 text-center shadow-lg dark:shadow-black/20 border border-transparent dark:border-gray-800">
            <Medal className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Aún no tienes insignias</h3>
            <p className="text-gray-500 dark:text-gray-400">¡Sigue participando en clase para desbloquear logros!</p>
          </div>
        )}
      </div>
    </div>
  );
};