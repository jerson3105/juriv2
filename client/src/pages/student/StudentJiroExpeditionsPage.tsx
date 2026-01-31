import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronLeft, Zap, Clock, MapPin, Play, CheckCircle, Trophy, Star } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { jiroExpeditionApi } from '../../lib/jiroExpeditionApi';
import { useStudentStore } from '../../store/studentStore';
import { studentApi } from '../../lib/studentApi';

export const StudentJiroExpeditionsPage = () => {
  const navigate = useNavigate();
  const { selectedClassIndex } = useStudentStore();
  
  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });
  
  const currentProfile = myClasses?.[selectedClassIndex];

  const { data: expeditions = [], isLoading } = useQuery({
    queryKey: ['jiro-available-expeditions', currentProfile?.id],
    queryFn: () => jiroExpeditionApi.getAvailable(currentProfile!.id),
    enabled: !!currentProfile?.id,
  });

  const getStatusInfo = (exp: typeof expeditions[0]) => {
    if (!exp.studentProgress) {
      return { label: 'Sin iniciar', color: 'bg-gray-100 text-gray-600', icon: <Play size={14} /> };
    }
    switch (exp.studentProgress.status) {
      case 'IN_PROGRESS':
        return { label: 'En progreso', color: 'bg-blue-100 text-blue-700', icon: <Zap size={14} /> };
      case 'PENDING_REVIEW':
        return { label: 'Pendiente', color: 'bg-amber-100 text-amber-700', icon: <Clock size={14} /> };
      case 'COMPLETED':
        return { label: 'Completado', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={14} /> };
      default:
        return { label: 'Sin iniciar', color: 'bg-gray-100 text-gray-600', icon: <Play size={14} /> };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🦊</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Homologado con Mi Asistencia */}
      <div>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 sm:gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-3 sm:mb-4 transition-colors text-sm"
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          Volver al dashboard
        </button>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center ring-2 sm:ring-4 ring-emerald-200 dark:ring-emerald-800 flex-shrink-0">
            <span className="text-xl sm:text-2xl">🦊</span>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Expediciones de Jiro
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Aventuras de aprendizaje disponibles
            </p>
          </div>
        </div>
      </div>

      {expeditions.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No hay expediciones disponibles
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Tu profesor aún no ha creado expediciones para ti
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {expeditions.map((exp, index) => {
            const status = getStatusInfo(exp);
            const progress = exp.studentProgress;
            const progressPercent = progress ? (progress.completedStations / exp.totalStations) * 100 : 0;
            const isCompleted = progress?.status === 'COMPLETED';
            const isInProgress = progress && progress.status !== 'COMPLETED';

            return (
              <motion.div
                key={exp.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                whileHover={{ y: -4 }}
              >
                <Card
                  className={`overflow-hidden transition-all cursor-pointer group border-2 ${
                    isCompleted 
                      ? 'border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-800' 
                      : isInProgress 
                        ? 'border-blue-300 dark:border-blue-700' 
                        : 'border-transparent hover:border-emerald-300 dark:hover:border-emerald-700'
                  } hover:shadow-xl`}
                  onClick={() => navigate(`/jiro-expedition/${exp.id}`)}
                >
                  {/* Cover con overlay mejorado */}
                  <div className="h-36 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 relative overflow-hidden">
                    {exp.coverImageUrl ? (
                      <img src={exp.coverImageUrl} alt={exp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.span 
                          className="text-7xl opacity-40"
                          animate={{ rotate: [0, -5, 5, 0] }}
                          transition={{ duration: 4, repeat: Infinity }}
                        >
                          🦊
                        </motion.span>
                      </div>
                    )}
                    {/* Badge de estado */}
                    <div className="absolute top-3 right-3">
                      <span className={`px-3 py-1.5 text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-sm ${status.color}`}>
                        {status.icon} {status.label}
                      </span>
                    </div>
                    {/* Gradiente inferior */}
                    <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
                    {/* Nombre sobre la imagen */}
                    <div className="absolute bottom-3 left-4 right-4">
                      <h3 className="font-bold text-white text-lg drop-shadow-lg line-clamp-1">
                        {exp.name}
                      </h3>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    {/* Stats en grid */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                        <MapPin size={16} className="mx-auto text-emerald-500 mb-1" />
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{exp.totalStations}</p>
                        <p className="text-[10px] text-gray-500">estaciones</p>
                      </div>
                      <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <Zap size={16} className="mx-auto text-yellow-500 mb-1" />
                        <p className="text-sm font-bold text-yellow-700 dark:text-yellow-400">{progress?.currentEnergy ?? exp.initialEnergy}</p>
                        <p className="text-[10px] text-gray-500">energía</p>
                      </div>
                      <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <Star size={16} className="mx-auto text-purple-500 mb-1" />
                        <p className="text-sm font-bold text-purple-700 dark:text-purple-400">+{exp.rewardXpPerCorrect}</p>
                        <p className="text-[10px] text-gray-500">XP</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {progress && (
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                          <span className="font-medium">Progreso</span>
                          <span className="font-bold text-emerald-600">{progress.completedStations}/{exp.totalStations}</span>
                        </div>
                        <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${isCompleted ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-blue-400 to-blue-500'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    )}

                    {/* CTA Button */}
                    <motion.button
                      className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : isInProgress
                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isCompleted ? (
                        <>
                          <Trophy size={16} />
                          Ver resultados
                        </>
                      ) : isInProgress ? (
                        <>
                          <Play size={16} />
                          Continuar
                        </>
                      ) : (
                        <>
                          <Play size={16} />
                          Comenzar
                        </>
                      )}
                    </motion.button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentJiroExpeditionsPage;
