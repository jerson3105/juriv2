import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  TrendingUp,
  Sparkles,
  Coins,
  Target,
  Flame,
  Calendar,
  Clock,
  Award,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Filter,
  Heart,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { studentApi } from '../../lib/studentApi';
import type { ThemeConfig } from '../../lib/storyApi';

interface StudentProgressViewProps {
  studentId: string;
  onBack: () => void;
  storyTheme?: ThemeConfig | null;
  isThemeDark?: boolean;
  hasStoryTheme?: boolean;
}

type HistoryFilter = 'ALL' | 'XP' | 'GP' | 'HP';

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ITEMS_PER_PAGE = 10;

export const StudentProgressView = ({
  studentId,
  onBack,
  storyTheme,
  isThemeDark = false,
  hasStoryTheme = false,
}: StudentProgressViewProps) => {
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const hasTheme = !!(hasStoryTheme && storyTheme);

  const pageBackgroundClasses = hasTheme
    ? ''
    : 'bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950';

  const surfaceCardClasses = hasTheme
    ? isThemeDark
      ? 'bg-white/10 border border-white/10 shadow-black/20'
      : 'bg-white/80 border border-white/45 shadow-black/5'
    : 'bg-white/90 border border-white/60 shadow-lg shadow-emerald-500/10 dark:bg-gray-900/85 dark:border-gray-800 dark:shadow-black/20';

  const titleTextClasses = hasTheme && isThemeDark ? 'text-white' : 'text-gray-800 dark:text-white';
  const mutedTextClasses = hasTheme && isThemeDark ? 'text-white/60' : 'text-gray-500 dark:text-gray-400';

  const { data: stats, isLoading } = useQuery({
    queryKey: ['student-stats', studentId],
    queryFn: () => studentApi.getStudentStats(studentId),
    staleTime: 60000,
  });

  // Filtrar y paginar historial
  const filteredHistory = useMemo(() => {
    if (!stats?.recentHistory) return [];
    if (historyFilter === 'ALL') return stats.recentHistory;
    return stats.recentHistory.filter(item => item.type === historyFilter);
  }, [stats?.recentHistory, historyFilter]);

  const totalItems = filteredHistory.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedHistory = filteredHistory.slice(startIndex, endIndex);

  // Reset página cuando cambia el filtro
  const handleFilterChange = (filter: HistoryFilter) => {
    setHistoryFilter(filter);
    setCurrentPage(1);
  };

  const filters: { id: HistoryFilter; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'ALL', label: 'Todo', icon: <Filter size={14} />, color: 'violet' },
    { id: 'XP', label: 'XP', icon: <Zap size={14} />, color: 'emerald' },
    { id: 'GP', label: 'Oro', icon: <Coins size={14} />, color: 'amber' },
    { id: 'HP', label: 'Salud', icon: <Heart size={14} />, color: 'red' },
  ];

  if (isLoading) {
    return (
      <div className={`min-h-screen -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 ${pageBackgroundClasses}`}>
        <div className="space-y-6">
          <div className={`h-12 w-48 rounded-xl animate-pulse ${hasTheme && isThemeDark ? 'bg-white/10' : 'bg-white dark:bg-gray-800'}`} />
          <div className={`h-32 rounded-2xl animate-pulse ${hasTheme && isThemeDark ? 'bg-white/10' : 'bg-white dark:bg-gray-800'}`} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`h-24 rounded-xl animate-pulse ${hasTheme && isThemeDark ? 'bg-white/10' : 'bg-white dark:bg-gray-800'}`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={`min-h-screen -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 flex items-center justify-center ${pageBackgroundClasses}`}>
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
          <p className={mutedTextClasses}>No se pudieron cargar las estadísticas</p>
        </div>
      </div>
    );
  }

  const maxActivity = Math.max(...stats.activityByDay, 1);

  return (
    <div className={`min-h-screen -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 ${pageBackgroundClasses}`}>
      {/* Decoración */}
      {!hasTheme && (
        <>
          <div className="absolute top-20 right-10 w-64 h-64 bg-emerald-200 dark:bg-emerald-950 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-30 animate-pulse" />
          <div className="absolute bottom-20 left-10 w-64 h-64 bg-teal-200 dark:bg-teal-950 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-30 animate-pulse" />
        </>
      )}

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={onBack}
            className={`flex items-center gap-2 mb-4 transition-colors ${hasTheme && isThemeDark ? 'text-white/65 hover:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Volver al dashboard</span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${hasTheme && isThemeDark ? 'bg-white/10 ring-1 ring-white/15' : hasTheme ? 'bg-white/70 ring-4 ring-white/35' : 'bg-emerald-100 ring-4 ring-emerald-200 dark:bg-emerald-500/15 dark:ring-emerald-500/20'}`}>
              <BarChart3 className={`w-6 h-6 ${hasTheme && isThemeDark ? 'text-white' : 'text-emerald-600 dark:text-emerald-300'}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${titleTextClasses}`}>Mi Progreso</h1>
              <p className={`text-sm ${mutedTextClasses}`}>Seguimiento de tu avance y retroalimentación</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl p-4 shadow-lg border ${hasTheme ? surfaceCardClasses : 'bg-white border-emerald-100 dark:bg-gray-900/85 dark:border-emerald-900/30 dark:shadow-black/20'}`}
          >
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-medium">XP Total</span>
            </div>
            <p className={`text-2xl font-bold ${titleTextClasses}`}>{stats.summary.netXp}</p>
            <p className={`text-xs ${mutedTextClasses}`}>
              +{stats.summary.totalXpGained} / -{stats.summary.totalXpLost}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`rounded-xl p-4 shadow-lg border ${hasTheme ? surfaceCardClasses : 'bg-white border-amber-100 dark:bg-gray-900/85 dark:border-amber-900/30 dark:shadow-black/20'}`}
          >
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <Coins className="w-5 h-5" />
              <span className="text-sm font-medium">Oro</span>
            </div>
            <p className={`text-2xl font-bold ${titleTextClasses}`}>{stats.summary.totalGpGained - stats.summary.totalGpSpent}</p>
            <p className={`text-xs ${mutedTextClasses}`}>
              Gastado: {stats.summary.totalGpSpent} GP
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`rounded-xl p-4 shadow-lg border ${hasTheme ? surfaceCardClasses : 'bg-white border-orange-100 dark:bg-gray-900/85 dark:border-orange-900/30 dark:shadow-black/20'}`}
          >
            <div className="flex items-center gap-2 text-orange-600 mb-2">
              <Flame className="w-5 h-5" />
              <span className="text-sm font-medium">Racha</span>
            </div>
            <p className={`text-2xl font-bold ${titleTextClasses}`}>{stats.summary.streak} días</p>
            <p className={`text-xs ${mutedTextClasses}`}>
              ¡Sigue así!
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`rounded-xl p-4 shadow-lg border ${hasTheme ? surfaceCardClasses : 'bg-white border-blue-100 dark:bg-gray-900/85 dark:border-blue-900/30 dark:shadow-black/20'}`}
          >
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Target className="w-5 h-5" />
              <span className="text-sm font-medium">Acciones</span>
            </div>
            <p className={`text-2xl font-bold ${titleTextClasses}`}>{stats.summary.totalActions}</p>
            <p className={`text-xs ${mutedTextClasses}`}>
              Total registradas
            </p>
          </motion.div>
        </div>

        {/* XP Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={`rounded-2xl p-6 shadow-lg ${surfaceCardClasses}`}
        >
          <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${titleTextClasses}`}>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            Progreso de XP
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div className={`text-center p-4 rounded-xl ${hasTheme && isThemeDark ? 'bg-white/5 border border-white/10' : hasTheme ? 'bg-white/55 border border-white/25' : 'bg-emerald-50 dark:bg-emerald-950/30'}`}>
              <p className="text-sm text-emerald-600 font-medium mb-1">Esta Semana</p>
              <p className="text-3xl font-bold text-emerald-700">+{stats.summary.xpThisWeek}</p>
              <p className="text-xs text-emerald-500">XP ganado</p>
            </div>
            <div className={`text-center p-4 rounded-xl ${hasTheme && isThemeDark ? 'bg-white/5 border border-white/10' : hasTheme ? 'bg-white/55 border border-white/25' : 'bg-teal-50 dark:bg-teal-950/30'}`}>
              <p className="text-sm text-teal-600 font-medium mb-1">Este Mes</p>
              <p className="text-3xl font-bold text-teal-700">+{stats.summary.xpThisMonth}</p>
              <p className="text-xs text-teal-500">XP ganado</p>
            </div>
          </div>
        </motion.div>

        {/* Activity Chart & Feedback */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Activity by Day */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`rounded-2xl p-6 shadow-lg ${surfaceCardClasses}`}
          >
            <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${titleTextClasses}`}>
              <Calendar className="w-5 h-5 text-purple-500" />
              XP por Día
            </h2>
            <div className="flex items-end justify-between gap-3 h-36">
              {stats.activityByDay.map((xpAmount, index) => {
                const heightPercent = maxActivity > 0 ? (xpAmount / maxActivity) * 100 : 0;
                const barHeight = xpAmount > 0 ? Math.max(heightPercent, 15) : 3;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    {/* Valor de XP */}
                    <span className={`text-xs font-semibold mb-1 ${xpAmount > 0 ? 'text-purple-600' : 'text-gray-300 dark:text-gray-600'}`}>
                      {xpAmount > 0 ? `+${xpAmount}` : '0'}
                    </span>
                    {/* Contenedor de barra con altura fija */}
                    <div className="w-full h-24 flex items-end justify-center">
                      <div
                        className={`w-full max-w-[40px] rounded-t-lg transition-all ${
                          xpAmount > 0 
                            ? 'bg-gradient-to-t from-purple-500 to-purple-400' 
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                        style={{ height: `${barHeight}%` }}
                      />
                    </div>
                    {/* Día */}
                    <span className={`text-xs font-medium mt-1 ${mutedTextClasses}`}>{DAY_NAMES[index]}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Strengths & Areas to Improve */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={`rounded-2xl p-6 shadow-lg ${surfaceCardClasses}`}
          >
            <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${titleTextClasses}`}>
              <Award className="w-5 h-5 text-amber-500" />
              Retroalimentación
            </h2>
            
            {/* Fortalezas */}
            {stats.strengths.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-emerald-600 mb-2 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Tus Fortalezas
                </h3>
                <div className="space-y-1">
                  {stats.strengths.slice(0, 3).map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className={titleTextClasses}>{s.name}</span>
                      <span className="text-emerald-600 font-medium">{s.count}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Áreas de mejora */}
            {stats.areasToImprove.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  Áreas de Mejora
                </h3>
                <div className="space-y-1">
                  {stats.areasToImprove.slice(0, 3).map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span className={titleTextClasses}>{a.name}</span>
                      <span className="text-amber-600 font-medium">{a.count}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.strengths.length === 0 && stats.areasToImprove.length === 0 && (
              <p className={`text-sm text-center py-4 ${mutedTextClasses}`}>
                Aún no hay suficientes datos para mostrar retroalimentación
              </p>
            )}
          </motion.div>
        </div>

        {/* Recent History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className={`rounded-2xl shadow-lg overflow-hidden ${surfaceCardClasses}`}
        >
          {/* Header con filtros */}
          <div className={`p-4 border-b ${hasTheme && isThemeDark ? 'border-white/10' : 'border-gray-100 dark:border-gray-800'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className={`text-lg font-bold flex items-center gap-2 ${titleTextClasses}`}>
                <Clock className="w-5 h-5 text-blue-500" />
                Historial Reciente
              </h2>
              
              {/* Filtros */}
              <div className="flex gap-1 flex-wrap">
                {filters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => handleFilterChange(filter.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      historyFilter === filter.id
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : hasTheme && isThemeDark
                          ? 'text-white/65 hover:bg-white/10'
                          : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                  >
                    {filter.icon}
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4">
            {filteredHistory.length === 0 ? (
              <p className={`text-center py-8 ${mutedTextClasses}`}>
                {historyFilter === 'ALL' 
                  ? 'No hay actividad registrada aún' 
                  : `No hay registros de ${historyFilter}`}
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedHistory.map((item) => {
                    const isCombined = (item.xpAmount ? 1 : 0) + (item.gpAmount ? 1 : 0) + (item.hpAmount ? 1 : 0) > 1;
                    const sign = item.action === 'ADD' ? '+' : '-';
                    return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${hasTheme && isThemeDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/80 dark:hover:bg-gray-800'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          item.action === 'ADD' 
                            ? 'bg-emerald-100 text-emerald-600' 
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {item.type === 'XP' && <Zap className="w-4 h-4" />}
                          {item.type === 'GP' && <Coins className="w-4 h-4" />}
                          {item.type === 'HP' && <Heart className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${titleTextClasses}`}>{item.reason}</p>
                          <p className={`text-xs ${mutedTextClasses}`}>
                            {new Date(item.date).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                      {isCombined ? (
                        <div className="flex flex-col items-end gap-0.5">
                          {item.xpAmount && <span className={`text-xs font-bold ${item.action === 'ADD' ? 'text-emerald-600' : 'text-red-600'}`}>{sign}{item.xpAmount} XP</span>}
                          {item.gpAmount && <span className={`text-xs font-bold ${item.action === 'ADD' ? 'text-amber-600' : 'text-red-600'}`}>{sign}{item.gpAmount} GP</span>}
                          {item.hpAmount && <span className={`text-xs font-bold ${item.action === 'ADD' ? 'text-rose-600' : 'text-red-600'}`}>{sign}{item.hpAmount} HP</span>}
                        </div>
                      ) : (
                        <div className={`text-sm font-bold ${
                          item.action === 'ADD' ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {sign}{item.amount} {item.type}
                        </div>
                      )}
                    </motion.div>
                    );
                  })}
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className={`flex items-center justify-between pt-4 mt-4 border-t ${hasTheme && isThemeDark ? 'border-white/10' : 'border-gray-100 dark:border-gray-800'}`}>
                    <p className={`text-xs ${mutedTextClasses}`}>
                      Mostrando {startIndex + 1}-{Math.min(endIndex, totalItems)} de {totalItems}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className={`p-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${hasTheme && isThemeDark ? 'hover:bg-white/10' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                      >
                        <ChevronLeft size={16} className={hasTheme && isThemeDark ? 'text-white/70' : 'text-gray-600 dark:text-gray-300'} />
                      </button>
                      
                      {/* Números de página */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                                currentPage === pageNum
                                  ? 'bg-emerald-500 text-white'
                                  : hasTheme && isThemeDark
                                    ? 'text-white/70 hover:bg-white/10'
                                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className={`p-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${hasTheme && isThemeDark ? 'hover:bg-white/10' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                      >
                        <ChevronRight size={16} className={hasTheme && isThemeDark ? 'text-white/70' : 'text-gray-600 dark:text-gray-300'} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
