import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
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
  CalendarCheck,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Undo2,
  Sword,
  Scroll,
  Flame,
  CheckSquare,
  Square,
} from 'lucide-react';
import { historyApi } from '../../lib/historyApi';
import type { ActivityLogEntry } from '../../lib/historyApi';
import { useCharacterClasses } from '../../hooks/useCharacterClasses';
import { classroomApi, type ResetOptions } from '../../lib/classroomApi';
import toast from 'react-hot-toast';

type FilterType = 'ALL' | 'POINTS' | 'PURCHASE' | 'ITEM_USED' | 'BADGE' | 'ATTENDANCE';

const ITEMS_PER_PAGE = 15;

export const HistoryPage = () => {
  const { classroom } = useOutletContext<{ classroom: any }>();
  const { classMap } = useCharacterClasses(classroom?.id);
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
  const { data: historyData, isLoading: historyLoading, isFetching: historyFetching, isError: historyError } = useQuery({
    queryKey: ['history', classroom?.id, filterType, selectedStudent, currentPage],
    queryFn: () => historyApi.getClassroomHistory(classroom.id, {
      type: filterType,
      studentId: selectedStudent,
      limit: ITEMS_PER_PAGE,
      offset: (currentPage - 1) * ITEMS_PER_PAGE,
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
  const totalItems = historyData?.total || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + (historyData?.logs.length || 0);
  const paginatedLogs = historyData?.logs || [];

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Obtener estadísticas
  const { data: stats } = useQuery({
    queryKey: ['history-stats', classroom?.id],
    queryFn: () => historyApi.getClassroomStats(classroom.id),
    enabled: !!classroom?.id,
  });

  // Revert
  const [revertConfirm, setRevertConfirm] = useState<{ id: string; type: string } | null>(null);
  const revertMutation = useMutation({
    mutationFn: ({ entryType, entryId }: { entryType: 'POINTS' | 'BADGE' | 'ATTENDANCE'; entryId: string }) =>
      historyApi.revertEntry(entryType, entryId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['history', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['history-stats', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      toast.success(data.message || 'Acción revertida');
      setRevertConfirm(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al revertir');
      setRevertConfirm(null);
    },
  });

  // === Reseteo selectivo ===
  const queryClient = useQueryClient();
  const [showResetPanel, setShowResetPanel] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetOptions, setResetOptions] = useState<ResetOptions>({
    points: false,
    history: false,
    purchases: false,
    badges: false,
    attendance: false,
    streaks: false,
    clans: false,
    scrolls: false,
    powerUsages: false,
  });

  const resetOptionsDef = [
    { key: 'points' as const, label: 'Puntos (XP, HP, GP, Nivel)', icon: <Zap size={16} className="text-emerald-500" />, desc: 'Devuelve XP, HP, GP a valores por defecto y nivel a 1' },
    { key: 'history' as const, label: 'Historial de puntos', icon: <ScrollText size={16} className="text-violet-500" />, desc: 'Elimina todos los registros de puntos otorgados/quitados' },
    { key: 'purchases' as const, label: 'Compras de tienda', icon: <ShoppingBag size={16} className="text-indigo-500" />, desc: 'Elimina compras realizadas y uso de items' },
    { key: 'badges' as const, label: 'Insignias ganadas', icon: <Medal size={16} className="text-amber-500" />, desc: 'Elimina insignias desbloqueadas y progreso' },
    { key: 'attendance' as const, label: 'Asistencia', icon: <CalendarCheck size={16} className="text-blue-500" />, desc: 'Elimina todos los registros de asistencia' },
    { key: 'streaks' as const, label: 'Rachas de login', icon: <Flame size={16} className="text-orange-500" />, desc: 'Reinicia rachas de inicio de sesión' },
    { key: 'clans' as const, label: 'Datos de clanes', icon: <Sword size={16} className="text-red-500" />, desc: 'Resetea XP, GP, victorias y derrotas de clanes' },
    { key: 'scrolls' as const, label: 'Pergaminos', icon: <Scroll size={16} className="text-pink-500" />, desc: 'Elimina todos los pergaminos del mural' },
    { key: 'powerUsages' as const, label: 'Uso de poderes', icon: <Sparkles size={16} className="text-cyan-500" />, desc: 'Elimina registros de poderes usados' },
  ];

  const selectedCount = Object.values(resetOptions).filter(Boolean).length;
  const allSelected = selectedCount === resetOptionsDef.length;

  const toggleAll = () => {
    const newVal = !allSelected;
    setResetOptions({
      points: newVal, history: newVal, purchases: newVal, badges: newVal,
      attendance: newVal, streaks: newVal, clans: newVal, scrolls: newVal, powerUsages: newVal,
    });
  };

  const resetMutation = useMutation({
    mutationFn: () => classroomApi.resetClassroomSelective(classroom.id, resetOptions),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['history', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['history-stats', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['students', classroom.id] });
      const count = data.cleaned.length;
      toast.success(`${count} ${count === 1 ? 'categoría reseteada' : 'categorías reseteadas'} correctamente`);
      setShowResetPanel(false);
      setResetOptions({ points: false, history: false, purchases: false, badges: false, attendance: false, streaks: false, clans: false, scrolls: false, powerUsages: false });
    },
    onError: () => toast.error('Error al resetear'),
  });

  const filters: { id: FilterType; label: string; icon: React.ReactNode }[] = [
    { id: 'ALL', label: 'Todo', icon: <ScrollText size={16} /> },
    { id: 'POINTS', label: 'Puntos', icon: <Zap size={16} /> },
    { id: 'PURCHASE', label: 'Compras', icon: <ShoppingBag size={16} /> },
    { id: 'ITEM_USED', label: 'Items usados', icon: <Sparkles size={16} /> },
    { id: 'BADGE', label: 'Insignias', icon: <Medal size={16} /> },
    { id: 'ATTENDANCE', label: 'Asistencia', icon: <CalendarCheck size={16} /> },
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
      case 'ATTENDANCE':
        return <CalendarCheck className="text-blue-500" size={20} />;
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
      case 'ATTENDANCE': {
        const statusMap: Record<string, { label: string; color: string }> = {
          PRESENT: { label: 'Presente', color: 'text-emerald-600' },
          ABSENT: { label: 'Ausente', color: 'text-red-600' },
          LATE: { label: 'Tardanza', color: 'text-amber-600' },
          EXCUSED: { label: 'Justificado', color: 'text-blue-600' },
        };
        const st = statusMap[entry.details.attendanceStatus || ''] || { label: entry.details.attendanceStatus, color: 'text-gray-600' };
        return (
          <span>
            <span className="font-medium">{studentName}</span>
            {' — '}
            <span className={`font-bold ${st.color}`}>{st.label}</span>
            {entry.details.amount && entry.details.amount > 0 && (
              <span className="text-emerald-500 font-medium"> +{entry.details.amount} XP</span>
            )}
          </span>
        );
      }
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
            <ScrollText size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">
              Registro de actividad
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Registro completo de puntos, compras y uso de items
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowResetPanel(!showResetPanel)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
            showResetPanel
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400'
          }`}
        >
          <RotateCcw size={14} />
          Resetear datos
        </button>
      </div>

      {/* Panel de reseteo selectivo */}
      <AnimatePresence>
        {showResetPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-red-50/80 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500" />
                  <h3 className="text-sm font-semibold text-red-800 dark:text-red-400">Resetear datos selectivamente</h3>
                </div>
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                >
                  {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                {resetOptionsDef.map((opt) => (
                  <label
                    key={opt.key}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors ${
                      resetOptions[opt.key]
                        ? 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={resetOptions[opt.key] || false}
                      onChange={() => setResetOptions(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                      className="mt-0.5 rounded border-gray-300 text-red-500 focus:ring-red-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {opt.icon}
                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{opt.label}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedCount === 0 ? 'Selecciona qué datos resetear' : `${selectedCount} categoría${selectedCount > 1 ? 's' : ''} seleccionada${selectedCount > 1 ? 's' : ''}`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResetPanel(false)}
                    className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    disabled={selectedCount === 0}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 size={13} />
                    Resetear seleccionados
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              ) : historyError ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 mx-auto mb-3 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
                    <ScrollText className="text-red-400" size={24} />
                  </div>
                  <p className="text-red-500 dark:text-red-300 text-sm">No se pudo cargar el historial</p>
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
                    {paginatedLogs.map((entry, index) => {
                      const canRevert = !entry.isReverted && ['POINTS', 'BADGE', 'ATTENDANCE'].includes(entry.type);
                      return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className={`flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group ${
                          entry.isReverted ? 'opacity-45' : ''
                        }`}
                      >
                        {/* Icono de clase del estudiante */}
                        <div className="w-9 h-9 bg-gradient-to-br from-violet-100 to-purple-100 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                          {classMap[entry.studentClass as string]?.icon || '👤'}
                        </div>
                        
                        {/* Icono de tipo de actividad */}
                        <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                          {getActivityIcon(entry)}
                        </div>
                        
                        {/* Descripción */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs text-gray-800 dark:text-gray-200 ${entry.isReverted ? 'line-through' : ''}`}>
                            {getActivityDescription(entry)}
                          </p>
                        </div>
                        
                        {/* Revertido badge */}
                        {entry.isReverted && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-full font-medium whitespace-nowrap">
                            Revertido
                          </span>
                        )}

                        {/* Botón Revertir */}
                        {canRevert && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRevertConfirm({ id: entry.id, type: entry.type });
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                            title="Revertir esta acción"
                          >
                            <Undo2 size={14} />
                          </button>
                        )}

                        {/* Tiempo */}
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {formatTime(entry.timestamp)}
                        </span>
                      </motion.div>
                      );
                    })}
                  </div>

                  {/* Paginación */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-xs text-gray-500">
                        Mostrando {startIndex + 1}-{Math.min(endIndex, totalItems)} de {totalItems}
                        {historyFetching ? ' • Actualizando...' : ''}
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

      {/* Modal de confirmación de reseteo selectivo */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-800 shadow-2xl"
          >
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 bg-red-100 dark:bg-red-500/20 rounded-2xl flex items-center justify-center">
                <AlertTriangle size={28} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">¿Confirmar reseteo?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Esta acción no se puede deshacer. Se eliminarán los datos seleccionados de <span className="font-medium text-gray-700 dark:text-gray-300">todos los estudiantes</span>.
              </p>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 mb-4">
              <p className="text-xs font-medium text-red-800 dark:text-red-400 mb-2">Se reseteará:</p>
              <div className="flex flex-wrap gap-1.5">
                {resetOptionsDef.filter(opt => resetOptions[opt.key]).map(opt => (
                  <span key={opt.key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] font-medium rounded-full">
                    {opt.icon}
                    {opt.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  resetMutation.mutate();
                  setShowResetConfirm(false);
                }}
                disabled={resetMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {resetMutation.isPending ? 'Reseteando...' : 'Confirmar reseteo'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de confirmación de revertir */}
      {revertConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setRevertConfirm(null)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-900 rounded-2xl p-5 max-w-sm w-full border border-gray-200 dark:border-gray-800 shadow-2xl"
          >
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center">
                <Undo2 size={24} className="text-amber-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">¿Revertir esta acción?</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Se deshará el efecto de esta acción sobre el estudiante. Los puntos, nivel e insignias se ajustarán.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setRevertConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => revertMutation.mutate({ entryType: revertConfirm.type as 'POINTS' | 'BADGE' | 'ATTENDANCE', entryId: revertConfirm.id })}
                disabled={revertMutation.isPending}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {revertMutation.isPending ? 'Revirtiendo...' : 'Revertir'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
