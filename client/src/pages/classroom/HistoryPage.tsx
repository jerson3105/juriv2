import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  ScrollText, 
  Zap, 
  Heart, 
  Coins, 
  ShoppingBag, 
  Sparkles,
  TrendingUp,
  TrendingDown,
  Filter,
  Trophy,
  Package,
  ChevronLeft,
  ChevronRight,
  Medal,
  Swords
} from 'lucide-react';
import { historyApi } from '../../lib/historyApi';
import type { ActivityLogEntry } from '../../lib/historyApi';
import { CHARACTER_CLASSES } from '../../lib/studentApi';

type FilterType = 'ALL' | 'POINTS' | 'PURCHASE' | 'ITEM_USED' | 'BADGE' | 'BOSS_BATTLE';

const ITEMS_PER_PAGE = 15;

export const HistoryPage = () => {
  const { classroom } = useOutletContext<{ classroom: any }>();
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [selectedStudent, setSelectedStudent] = useState<string | undefined>();
  const [currentPage, setCurrentPage] = useState(1);

  // Función para obtener el nombre a mostrar según configuración
  const getDisplayName = (student: { characterName?: string; realName?: string; realLastName?: string }) => {
    if (classroom?.showCharacterName === false) {
      if (student.realName && student.realLastName) {
        return `${student.realName} ${student.realLastName}`;
      } else if (student.realName) {
        return student.realName;
      }
    }
    return student.characterName || 'Sin nombre';
  };

  // Obtener historial
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['history', classroom?.id, filterType, selectedStudent],
    queryFn: () => historyApi.getClassroomHistory(classroom.id, {
      type: filterType,
      studentId: selectedStudent,
      limit: 500, // Traer más para paginar en cliente
    }),
    enabled: !!classroom?.id,
  });

  // Reset página cuando cambian los filtros
  const handleFilterChange = (newFilter: FilterType) => {
    setFilterType(newFilter);
    setCurrentPage(1);
  };

  const handleStudentChange = (studentId: string | undefined) => {
    setSelectedStudent(studentId);
    setCurrentPage(1);
  };

  // Calcular paginación
  const totalItems = historyData?.logs.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedLogs = historyData?.logs.slice(startIndex, endIndex) || [];

  // Obtener estadísticas
  const { data: stats } = useQuery({
    queryKey: ['history-stats', classroom?.id],
    queryFn: () => historyApi.getClassroomStats(classroom.id),
    enabled: !!classroom?.id,
  });

  const filters: { id: FilterType; label: string; icon: React.ReactNode }[] = [
    { id: 'ALL', label: 'Todo', icon: <ScrollText size={16} /> },
    { id: 'POINTS', label: 'Puntos', icon: <Zap size={16} /> },
    { id: 'PURCHASE', label: 'Compras', icon: <ShoppingBag size={16} /> },
    { id: 'ITEM_USED', label: 'Items usados', icon: <Sparkles size={16} /> },
    { id: 'BADGE', label: 'Insignias', icon: <Medal size={16} /> },
    { id: 'BOSS_BATTLE', label: 'Boss Battles', icon: <Swords size={16} /> },
  ];

  const getActivityIcon = (entry: ActivityLogEntry) => {
    switch (entry.type) {
      case 'POINTS':
        if (entry.details.pointType === 'XP') return <Zap className="text-emerald-500" size={20} />;
        if (entry.details.pointType === 'HP') return <Heart className="text-red-500" size={20} />;
        if (entry.details.pointType === 'GP') return <Coins className="text-amber-500" size={20} />;
        return <Zap className="text-gray-500" size={20} />;
      case 'PURCHASE':
        return <ShoppingBag className="text-indigo-500" size={20} />;
      case 'ITEM_USED':
        return <Sparkles className="text-pink-500" size={20} />;
      case 'LEVEL_UP':
        return <Trophy className="text-yellow-500" size={20} />;
      case 'BADGE':
        return <Medal className="text-amber-500" size={20} />;
      case 'BOSS_BATTLE':
        return <Swords className="text-purple-500" size={20} />;
      default:
        return <ScrollText className="text-gray-500" size={20} />;
    }
  };

  const getActivityDescription = (entry: ActivityLogEntry) => {
    // Buscar el estudiante para obtener el nombre correcto según configuración
    const student = classroom?.students?.find((s: any) => s.id === entry.studentId);
    const studentName = student ? getDisplayName(student) : (entry.studentName || 'Estudiante');
    
    switch (entry.type) {
      case 'POINTS': {
        const isAdd = entry.details.action === 'ADD';
        const sign = isAdd ? '+' : '-';
        const color = isAdd ? 'text-emerald-600' : 'text-red-600';
        
        // Manejar puntos combinados (MIXED) cuando un comportamiento tiene XP+HP+GP
        if (entry.details.pointType === 'MIXED') {
          return (
            <span>
              <span className="font-medium">{studentName}</span>
              {' '}
              {entry.details.xpAmount && (
                <span className="font-bold text-emerald-500">{sign}{entry.details.xpAmount} XP</span>
              )}
              {entry.details.xpAmount && (entry.details.hpAmount || entry.details.gpAmount) && ', '}
              {entry.details.hpAmount && (
                <span className="font-bold text-rose-500">{sign}{entry.details.hpAmount} HP</span>
              )}
              {entry.details.hpAmount && entry.details.gpAmount && ', '}
              {entry.details.gpAmount && (
                <span className="font-bold text-amber-500">{sign}{entry.details.gpAmount} GP</span>
              )}
              {entry.details.reason && (
                <span className="text-gray-500"> • {entry.details.reason}</span>
              )}
            </span>
          );
        }
        
        return (
          <span>
            <span className="font-medium">{studentName}</span>
            {' '}
            <span className={`font-bold ${color}`}>
              {sign}{entry.details.amount} {entry.details.pointType}
            </span>
            {entry.details.reason && (
              <span className="text-gray-500"> • {entry.details.reason}</span>
            )}
          </span>
        );
      }
      case 'PURCHASE':
        return (
          <span>
            <span className="font-medium">{studentName}</span>
            {' compró '}
            <span className="font-medium">{entry.details.itemName}</span>
            {entry.details.amount && entry.details.amount > 1 && (
              <span className="text-gray-500"> x{entry.details.amount}</span>
            )}
            <span className="text-amber-600 font-medium"> (-{entry.details.totalPrice} GP)</span>
          </span>
        );
      case 'ITEM_USED':
        return (
          <span>
            <span className="font-medium">{studentName}</span>
            {' usó '}
            <span className="font-medium">{entry.details.itemName}</span>
            {entry.details.action && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                entry.details.action === 'APPROVED' 
                  ? 'bg-green-100 text-green-700'
                  : entry.details.action === 'REJECTED'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
              }`}>
                {entry.details.action === 'APPROVED' ? 'Aprobado' : 
                 entry.details.action === 'REJECTED' ? 'Rechazado' : 'Pendiente'}
              </span>
            )}
          </span>
        );
      case 'BADGE':
        return (
          <span>
            <span className="font-medium">{studentName}</span>
            {' obtuvo la insignia '}
            <span className="font-medium">
              {entry.details.badgeIcon} {entry.details.badgeName}
            </span>
          </span>
        );
      case 'BOSS_BATTLE':
        return (
          <span>
            <span className="font-medium">{studentName}</span>
            {entry.details.isVictory ? ' derrotó a ' : ' luchó contra '}
            <span className="font-medium">🐉 {entry.details.battleName}</span>
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
              entry.details.isVictory 
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {entry.details.isVictory ? '¡Victoria!' : 'Derrota'}
            </span>
            <span className="ml-2 text-emerald-600 font-medium">+{entry.details.xpEarned} XP</span>
            {entry.details.gpEarned && entry.details.gpEarned > 0 && (
              <span className="ml-1 text-amber-600 font-medium">+{entry.details.gpEarned} GP</span>
            )}
          </span>
        );
      default:
        return <span>{studentName}</span>;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes}m`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days}d`;
    
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
          <ScrollText size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">
            Historial de Actividades
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Registro completo de puntos, compras y uso de items
          </p>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center">
              <TrendingUp className="text-emerald-600 dark:text-emerald-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                +{stats?.totalXpGiven || 0}
              </p>
              <p className="text-xs text-emerald-600/70">XP otorgado</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center">
              <TrendingDown className="text-amber-600 dark:text-amber-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                -{stats?.totalXpRemoved || 0}
              </p>
              <p className="text-xs text-amber-600/70">XP quitado</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl border border-violet-200 dark:border-violet-800 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/50 rounded-xl flex items-center justify-center">
              <ShoppingBag className="text-violet-600 dark:text-violet-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                {stats?.totalPurchases || 0}
              </p>
              <p className="text-xs text-violet-600/70">Compras</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-xl border border-pink-200 dark:border-pink-800 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/50 rounded-xl flex items-center justify-center">
              <Package className="text-pink-600 dark:text-pink-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                {stats?.totalItemsUsed || 0}
              </p>
              <p className="text-xs text-pink-600/70">Items usados</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Lista de historial */}
        <div className="lg:col-span-3">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 dark:text-white text-sm flex items-center gap-2">
                  <Filter size={16} />
                  Actividad reciente
                </h3>
                
                {/* Filtros */}
                <div className="flex gap-1">
                  {filters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => handleFilterChange(filter.id)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        filterType === filter.id
                          ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {filter.icon}
                      <span className="hidden sm:inline">{filter.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4">
              {historyLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-14 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : totalItems === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                    <ScrollText className="text-gray-400" size={24} />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No hay actividad registrada</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    {paginatedLogs.map((entry, index) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        {/* Icono de clase del estudiante */}
                        <div className="w-9 h-9 bg-gradient-to-br from-violet-100 to-purple-100 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                          {CHARACTER_CLASSES[entry.studentClass as keyof typeof CHARACTER_CLASSES]?.icon || '👤'}
                        </div>
                        
                        {/* Icono de tipo de actividad */}
                        <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                          {getActivityIcon(entry)}
                        </div>
                        
                        {/* Descripción */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-800 dark:text-gray-200">
                            {getActivityDescription(entry)}
                          </p>
                        </div>
                        
                        {/* Tiempo */}
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {formatTime(entry.timestamp)}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Paginación */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-xs text-gray-500">
                        Mostrando {startIndex + 1}-{Math.min(endIndex, totalItems)} de {totalItems}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={16} className="text-gray-600" />
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
                                    ? 'bg-violet-500 text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
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
                          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronRight size={16} className="text-gray-600" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Panel lateral */}
        <div className="space-y-4">
          {/* Top estudiantes */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4">
            <h3 className="font-semibold text-gray-800 dark:text-white text-sm mb-3 flex items-center gap-2">
              <Trophy className="text-amber-500" size={16} />
              Top Estudiantes
            </h3>
            {stats?.topStudents.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">
                Sin datos
              </p>
            ) : (
              <div className="space-y-2">
                {stats?.topStudents.map((topStudent, index) => {
                  // Buscar el estudiante para obtener el nombre correcto
                  const studentData = classroom?.students?.find((s: any) => s.id === topStudent.id);
                  const displayName = studentData ? getDisplayName(studentData) : topStudent.name;
                  
                  return (
                  <div
                    key={topStudent.id}
                    className="flex items-center gap-2"
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      index === 0 ? 'bg-amber-100 text-amber-700' :
                      index === 1 ? 'bg-gray-200 text-gray-600' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                        {displayName}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-emerald-600">
                      {topStudent.xp} XP
                    </span>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Filtro por estudiante */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4">
            <h3 className="font-semibold text-gray-800 dark:text-white text-sm mb-3">Filtrar por estudiante</h3>
            <select
              value={selectedStudent || ''}
              onChange={(e) => handleStudentChange(e.target.value || undefined)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-200"
            >
              <option value="">Todos los estudiantes</option>
              {classroom?.students?.map((student: any) => (
                <option key={student.id} value={student.id}>
                  {getDisplayName(student)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
