import { useMemo, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Sparkles,
  Heart,
  Coins,
  Star,
  TrendingUp,
  TrendingDown,
  Calendar,
  ShoppingBag,
  Award,
  Zap as Activity,
  Target,
  Users,
  Trophy,
  Filter,
  ChevronLeft,
  ChevronRight,
  Zap,
  Shield,
  CalendarCheck,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StudentAvatarMini } from '../../components/avatar/StudentAvatarMini';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import { historyApi } from '../../lib/historyApi';
import { useCharacterClasses } from '../../hooks/useCharacterClasses';
import { characterClassApi } from '../../lib/characterClassApi';
import { clanApi, CLAN_EMBLEMS } from '../../lib/clanApi';
import { badgeApi, RARITY_COLORS, type StudentBadge } from '../../lib/badgeApi';
import toast from 'react-hot-toast';

type HistoryFilter = 'ALL' | 'XP' | 'GP' | 'HP' | 'PURCHASE' | 'LEVEL_UP' | 'BADGE' | 'ATTENDANCE';
const ITEMS_PER_PAGE = 10;

const getLogMetric = (log: any, metric: 'XP' | 'HP' | 'GP'): number => {
  if (log.type !== 'POINTS') return 0;
  if (log.details.pointType === metric) return log.details.amount || 0;
  if (log.details.pointType === 'MIXED') {
    if (metric === 'XP') return log.details.xpAmount || 0;
    if (metric === 'HP') return log.details.hpAmount || 0;
    if (metric === 'GP') return log.details.gpAmount || 0;
  }
  return 0;
};

export const StudentDetailPage = () => {
  const { id: classroomId, studentId } = useParams<{ id: string; studentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { classroom } = useOutletContext<{ classroom: Classroom & { showCharacterName?: boolean } }>();
  const { classMap, classes: characterClasses } = useCharacterClasses(classroomId);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [chartMetric, setChartMetric] = useState<'XP' | 'HP' | 'GP'>('XP');
  const [chartDays, setChartDays] = useState(14);

  // Obtener datos de la clase
  const { data: classroomData, isLoading } = useQuery({
    queryKey: ['classroom', classroomId],
    queryFn: () => classroomApi.getById(classroomId!),
    enabled: !!classroomId,
  });

  // Obtener historial del estudiante
  const { data: historyData } = useQuery({
    queryKey: ['student-history', classroomId, studentId],
    queryFn: () => historyApi.getClassroomHistory(classroomId!, { studentId, limit: 200 }),
    enabled: !!classroomId && !!studentId,
  });

  // Obtener clanes de la clase
  const { data: clansData } = useQuery({
    queryKey: ['clans', classroomId],
    queryFn: () => clanApi.getClassroomClans(classroomId!),
    enabled: !!classroomId,
  });

  // Obtener insignias del estudiante
  const { data: studentBadges } = useQuery({
    queryKey: ['student-badges', studentId],
    queryFn: () => badgeApi.getStudentBadges(studentId!),
    enabled: !!studentId,
  });

  const student = classroomData?.students?.find(s => s.id === studentId);
  
  // Encontrar el clan del estudiante
  const studentClan = useMemo(() => {
    if (!clansData || !student) return null;
    return clansData.find((clan: any) => 
      clan.members?.some((member: any) => member.id === student.id)
    );
  }, [clansData, student]);
  const classInfo = student?.characterClassId
    ? characterClasses.find(c => c.id === student.characterClassId) || classMap[student.characterClass]
    : student ? classMap[student.characterClass] : null;

  const assignClassMutation = useMutation({
    mutationFn: ({ characterClassId }: { characterClassId: string | null }) =>
      characterClassApi.assign(classroomId!, studentId!, characterClassId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
      toast.success('Clase asignada correctamente');
    },
  });

  const maxHp = classroom?.maxHp || 100;
  const xpPerLevel = classroom?.xpPerLevel || 100;

  // Función para obtener el nombre a mostrar según configuración
  const getDisplayName = () => {
    if (!student) return 'Sin nombre';
    if (classroom?.showCharacterName === false) {
      if (student.realName && student.realLastName) {
        return `${student.realName} ${student.realLastName}`;
      } else if (student.realName) {
        return student.realName;
      }
    }
    return student.characterName || 'Sin nombre';
  };

  // Calcular progreso de XP (sistema progresivo)
  // Nivel N requiere N * xpPerLevel para subir al siguiente
  // XP total para nivel N = xpPerLevel * N * (N-1) / 2
  const level = student?.level || 1;
  const xpForCurrentLevel = (xpPerLevel * level * (level - 1)) / 2;
  const xpForNextLevel = (xpPerLevel * (level + 1) * level) / 2;
  const xpInLevel = student ? student.xp - xpForCurrentLevel : 0;
  const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel; // = level * xpPerLevel
  const xpToNextLevel = xpNeededForLevel - xpInLevel;
  const hpPercent = student ? Math.min((student.hp / maxHp) * 100, 100) : 0;

  // Estadísticas del historial
  const stats = useMemo(() => {
    if (!historyData?.logs) return null;
    const logs = historyData.logs;

    const addLogs = logs.filter(l => l.type === 'POINTS' && l.details.action === 'ADD');
    const removeLogs = logs.filter(l => l.type === 'POINTS' && l.details.action === 'REMOVE');

    const xpGained = addLogs.reduce((sum, l) => sum + getLogMetric(l, 'XP'), 0);
    const xpLost = removeLogs.reduce((sum, l) => sum + getLogMetric(l, 'XP'), 0);
    const hpGained = addLogs.reduce((sum, l) => sum + getLogMetric(l, 'HP'), 0);
    const hpLost = removeLogs.reduce((sum, l) => sum + getLogMetric(l, 'HP'), 0);
    const gpGained = addLogs.reduce((sum, l) => sum + getLogMetric(l, 'GP'), 0);
    const gpSpent = logs.filter(l => l.type === 'PURCHASE').reduce((sum, l) => sum + (l.details.totalPrice || 0), 0);

    const positiveBehaviors = addLogs.length;
    const negativeBehaviors = removeLogs.length;
    const badges = logs.filter(l => l.type === 'BADGE').length;
    const attendance = logs.filter(l => l.type === 'ATTENDANCE');
    const presentDays = attendance.filter(l => l.details.attendanceStatus === 'PRESENT' || l.details.attendanceStatus === 'LATE').length;
    const totalAttendance = attendance.length;

    return { xpGained, xpLost, hpGained, hpLost, gpGained, gpSpent, positiveBehaviors, negativeBehaviors, badges, presentDays, totalAttendance };
  }, [historyData]);

  // Top 5 comportamientos más frecuentes
  const topBehaviors = useMemo(() => {
    if (!historyData?.logs) return [];
    const behaviorCounts = new Map<string, { name: string; count: number; isPositive: boolean }>();

    for (const log of historyData.logs) {
      if (log.type !== 'POINTS' || !log.details.reason) continue;
      const key = `${log.details.reason}-${log.details.action}`;
      const existing = behaviorCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        behaviorCounts.set(key, { name: log.details.reason, count: 1, isPositive: log.details.action === 'ADD' });
      }
    }

    return Array.from(behaviorCounts.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [historyData]);

  const chartColor = chartMetric === 'XP' ? '#8b5cf6' : chartMetric === 'HP' ? '#ef4444' : '#f59e0b';

  // Datos para gráfico de actividad
  const activityChartData = useMemo(() => {
    if (!historyData?.logs) return [];

    const now = new Date();
    const data: { date: string; value: number }[] = [];

    for (let i = chartDays - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayLogs = historyData.logs.filter(log => {
        const logDate = new Date(log.timestamp).toISOString().split('T')[0];
        return logDate === dateStr;
      });

      const value = dayLogs.reduce((sum, l) => {
        const amount = getLogMetric(l, chartMetric);
        if (amount === 0) return sum;
        return sum + (l.details.action === 'ADD' ? amount : -amount);
      }, 0);

      data.push({
        date: date.toLocaleDateString('es', { day: 'numeric', month: 'short' }),
        value,
      });
    }

    return data;
  }, [historyData, chartMetric, chartDays]);

  // Filtrar y paginar historial
  const filteredHistory = useMemo(() => {
    if (!historyData?.logs) return [];
    if (historyFilter === 'ALL') return historyData.logs;
    if (historyFilter === 'XP') {
      return historyData.logs.filter(l => l.type === 'POINTS' &&
        (l.details.pointType === 'XP' || (l.details.pointType === 'MIXED' && l.details.xpAmount)));
    }
    if (historyFilter === 'GP') {
      return historyData.logs.filter(l => l.type === 'POINTS' &&
        (l.details.pointType === 'GP' || (l.details.pointType === 'MIXED' && l.details.gpAmount)));
    }
    if (historyFilter === 'HP') {
      return historyData.logs.filter(l => l.type === 'POINTS' &&
        (l.details.pointType === 'HP' || (l.details.pointType === 'MIXED' && l.details.hpAmount)));
    }
    if (historyFilter === 'BADGE') return historyData.logs.filter(l => l.type === 'BADGE');
    if (historyFilter === 'ATTENDANCE') return historyData.logs.filter(l => l.type === 'ATTENDANCE');
    return historyData.logs.filter(l => l.type === historyFilter);
  }, [historyData, historyFilter]);

  const totalItems = filteredHistory.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedHistory = filteredHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleFilterChange = (filter: HistoryFilter) => {
    setHistoryFilter(filter);
    setCurrentPage(1);
  };

  const filters: { id: HistoryFilter; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'ALL', label: 'Todo', icon: <Filter size={14} />, color: 'violet' },
    { id: 'XP', label: 'XP', icon: <Zap size={14} />, color: 'emerald' },
    { id: 'GP', label: 'Oro', icon: <Coins size={14} />, color: 'amber' },
    { id: 'HP', label: 'Salud', icon: <Heart size={14} />, color: 'red' },
    { id: 'PURCHASE', label: 'Compras', icon: <ShoppingBag size={14} />, color: 'blue' },
    { id: 'LEVEL_UP', label: 'Niveles', icon: <Star size={14} />, color: 'purple' },
    { id: 'BADGE', label: 'Insignias', icon: <Award size={14} />, color: 'amber' },
    { id: 'ATTENDANCE', label: 'Asistencia', icon: <CalendarCheck size={14} />, color: 'cyan' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-white/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!student) {
    return (
      <Card className="text-center py-12">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Estudiante no encontrado</h3>
        <Button onClick={() => navigate(`/classroom/${classroomId}/students`)}>
          Volver a la lista
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con botón de volver */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/classroom/${classroomId}/students`)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Perfil del Estudiante</h1>
          <p className="text-gray-500 dark:text-gray-400">Seguimiento detallado y análisis de progreso</p>
        </div>
      </div>

      {/* Card principal del estudiante */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-xl"
      >
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-32 h-56 bg-white/20 rounded-xl overflow-hidden backdrop-blur-sm">
              <StudentAvatarMini
                studentProfileId={student.id}
                gender={student.avatarGender || 'MALE'}
                size="md"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold">{getDisplayName()}</h2>
              <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="font-bold">Nivel {student.level}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-white/80 mb-4">
              <span className="text-2xl">{classInfo?.icon || '👤'}</span>
              <select
                value={student.characterClassId || ''}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  if (!selectedId) {
                    assignClassMutation.mutate({ characterClassId: null });
                    return;
                  }
                  assignClassMutation.mutate({ characterClassId: selectedId });
                }}
                className="text-lg font-medium bg-white/10 border border-white/20 rounded-lg px-2 py-0.5 text-white focus:outline-none focus:ring-1 focus:ring-white/50 cursor-pointer"
              >
                <option value="" className="text-gray-800">Sin clase</option>
                {characterClasses.filter(c => c.isActive).map(c => (
                  <option key={c.id} value={c.id} className="text-gray-800">{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            {/* Stats rápidos */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-emerald-300 mb-1">
                  <Sparkles size={18} />
                  <span className="text-2xl font-bold">{student.xp}</span>
                </div>
                <p className="text-xs text-white/70">XP Total</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-red-300 mb-1">
                  <Heart size={18} />
                  <span className="text-2xl font-bold">{student.hp}</span>
                </div>
                <p className="text-xs text-white/70">HP Actual</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-amber-300 mb-1">
                  <Coins size={18} />
                  <span className="text-2xl font-bold">{student.gp}</span>
                </div>
                <p className="text-xs text-white/70">Oro</p>
              </div>
            </div>

            {/* Barras de progreso */}
            <div className="space-y-3">
              {/* XP Progress */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Progreso al siguiente nivel</span>
                  <span>{Math.max(0, Math.round(xpInLevel))}/{Math.round(xpNeededForLevel)} XP</span>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transition-all"
                    style={{ width: `${Math.min((xpInLevel / xpNeededForLevel) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-white/60 mt-1">{Math.max(0, Math.round(xpToNextLevel))} XP para nivel {student.level + 1}</p>
              </div>

              {/* HP Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Salud</span>
                  <span>{student.hp}/{maxHp} HP</span>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      hpPercent > 50 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 
                      hpPercent > 25 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 
                      'bg-gradient-to-r from-red-400 to-rose-500'
                    }`}
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Información adicional: Insignias, Clan, Ranking */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Insignias */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                <Trophy className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-gray-800 dark:text-white">Insignias</h3>
            </div>
            {studentBadges && studentBadges.length > 0 && (
              <span className="text-sm text-gray-500">{studentBadges.length}</span>
            )}
          </div>
          {studentBadges && studentBadges.length > 0 ? (
            <div className="space-y-2">
              {/* Mostrar hasta 4 insignias */}
              <div className="flex flex-wrap gap-2 justify-center">
                {studentBadges.slice(0, 4).map((sb: StudentBadge) => (
                  <div
                    key={sb.id}
                    className={`relative group w-12 h-12 rounded-xl flex items-center justify-center text-2xl
                      ${RARITY_COLORS[sb.badge.rarity].bg} ${RARITY_COLORS[sb.badge.rarity].border} border-2
                      transition-transform hover:scale-110 cursor-pointer`}
                    title={`${sb.badge.name} - ${sb.badge.description}`}
                  >
                    {sb.badge.icon}
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {sb.badge.name}
                    </div>
                  </div>
                ))}
              </div>
              {studentBadges.length > 4 && (
                <p className="text-center text-xs text-gray-500 mt-2">
                  +{studentBadges.length - 4} más
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin insignias aún</p>
            </div>
          )}
        </Card>

        {/* Clan */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-gray-800 dark:text-white">Clan</h3>
          </div>
          {studentClan ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">{CLAN_EMBLEMS[studentClan.emblem] || studentClan.emblem || '⚔️'}</div>
              <div className="font-bold text-lg text-gray-800 dark:text-white mb-1">
                {studentClan.name}
              </div>
              {studentClan.motto && (
                <p className="text-xs text-gray-500 italic mb-2">"{studentClan.motto}"</p>
              )}
              <div className="flex items-center justify-center gap-4 text-sm">
                <div className="text-emerald-600">
                  <span className="font-bold">{studentClan.totalXp || 0}</span> XP
                </div>
                <div className="text-gray-400">•</div>
                <div className="text-gray-600">
                  <span className="font-bold">{studentClan.members?.length || 0}</span> miembros
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No pertenece a ningún clan</p>
            </div>
          )}
        </Card>

        {/* Ranking */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-gray-800 dark:text-white">Ranking</h3>
          </div>
          {classroomData?.students && (
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-emerald-600 mb-1">
                #{classroomData.students
                  .sort((a, b) => b.xp - a.xp)
                  .findIndex(s => s.id === studentId) + 1}
              </div>
              <p className="text-sm text-gray-500">de {classroomData.students.length} estudiantes</p>
              <p className="text-xs text-gray-400 mt-1">Por XP total</p>
            </div>
          )}
        </Card>
      </div>

      {/* Estadísticas y Análisis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resumen de actividad */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center">
              <Target className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-gray-800 dark:text-white">Resumen</h3>
          </div>

          {/* Barra positivos vs negativos */}
          {((stats?.positiveBehaviors || 0) + (stats?.negativeBehaviors || 0)) > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Positivos: {stats?.positiveBehaviors || 0}
                </span>
                <span className="text-red-500 font-medium flex items-center gap-1">
                  Negativos: {stats?.negativeBehaviors || 0} <TrendingDown className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                <div
                  className="bg-emerald-400 transition-all"
                  style={{ width: `${((stats?.positiveBehaviors || 0) / ((stats?.positiveBehaviors || 0) + (stats?.negativeBehaviors || 0))) * 100}%` }}
                />
                <div
                  className="bg-red-400 transition-all"
                  style={{ width: `${((stats?.negativeBehaviors || 0) / ((stats?.positiveBehaviors || 0) + (stats?.negativeBehaviors || 0))) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            {/* XP */}
            <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">XP</span>
              </div>
              <div className="text-sm">
                <span className="font-bold text-emerald-600">+{stats?.xpGained || 0}</span>
                <span className="text-gray-400 mx-1">/</span>
                <span className="font-bold text-red-500">-{stats?.xpLost || 0}</span>
              </div>
            </div>
            {/* HP */}
            <div className="flex items-center justify-between p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">Salud</span>
              </div>
              <div className="text-sm">
                <span className="font-bold text-emerald-600">+{stats?.hpGained || 0}</span>
                <span className="text-gray-400 mx-1">/</span>
                <span className="font-bold text-red-500">-{stats?.hpLost || 0}</span>
              </div>
            </div>
            {/* GP */}
            <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">Oro</span>
              </div>
              <div className="text-sm">
                <span className="font-bold text-amber-600">+{stats?.gpGained || 0}</span>
                <span className="text-gray-400 mx-1">/</span>
                <span className="font-bold text-red-500">-{stats?.gpSpent || 0}</span>
              </div>
            </div>
            {/* Insignias y Asistencia */}
            <div className="flex gap-2 pt-1">
              <div className="flex-1 flex items-center gap-2 p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <Trophy className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">Insignias</span>
                <span className="ml-auto font-bold text-purple-600">{stats?.badges || 0}</span>
              </div>
              {(stats?.totalAttendance || 0) > 0 && (
                <div className="flex-1 flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <CalendarCheck className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Asistencia</span>
                  <span className="ml-auto font-bold text-blue-600">{stats?.presentDays}/{stats?.totalAttendance}</span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Top comportamientos */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-rose-500 rounded-lg flex items-center justify-center">
              <Award className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-gray-800 dark:text-white">Comportamientos frecuentes</h3>
          </div>
          {topBehaviors.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin comportamientos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topBehaviors.map((b, i) => {
                const maxCount = topBehaviors[0]?.count || 1;
                const barWidth = (b.count / maxCount) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 dark:text-gray-200 truncate mr-2">{b.name}</span>
                      <span className={`text-sm font-bold shrink-0 ${b.isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {b.count}×
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${b.isPositive ? 'bg-emerald-400' : 'bg-red-400'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Gráfico de actividad */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-gray-800 dark:text-white">Actividad</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              {(['XP', 'HP', 'GP'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setChartMetric(m)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    chartMetric === m
                      ? m === 'XP' ? 'bg-purple-500 text-white'
                        : m === 'HP' ? 'bg-rose-500 text-white'
                        : 'bg-amber-500 text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              {([7, 14, 30] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setChartDays(d)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    chartDays === d
                      ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="h-64">
          {activityChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityChartData}>
                <defs>
                  <linearGradient id="colorChart" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="value" stroke={chartColor} fillOpacity={1} fill="url(#colorChart)" name={chartMetric} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sin datos de actividad</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Historial de actividad con filtros y paginación */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-gray-800 dark:text-white">Registro de actividad</h3>
            <span className="text-sm text-gray-400">({totalItems})</span>
          </div>
          
          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => handleFilterChange(filter.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  historyFilter === filter.id
                    ? `bg-${filter.color}-100 text-${filter.color}-700 ring-2 ring-${filter.color}-300`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {filter.icon}
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        
        {paginatedHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Sin actividad registrada</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paginatedHistory.map((activity: any) => (
                <div 
                  key={activity.id} 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-100 dark:border-gray-700"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    activity.type === 'POINTS' && activity.details.action === 'ADD' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                    activity.type === 'POINTS' && activity.details.action === 'REMOVE' ? 'bg-red-100 dark:bg-red-900/30' :
                    activity.type === 'PURCHASE' ? 'bg-amber-100 dark:bg-amber-900/30' :
                    activity.type === 'BADGE' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                    activity.type === 'ATTENDANCE' ? 'bg-blue-100 dark:bg-blue-900/30' :
                    activity.type === 'ITEM_USED' ? 'bg-indigo-100 dark:bg-indigo-900/30' :
                    'bg-purple-100 dark:bg-purple-900/30'
                  }`}>
                    {activity.type === 'POINTS' && activity.details.action === 'ADD' && <TrendingUp className="w-5 h-5 text-emerald-600" />}
                    {activity.type === 'POINTS' && activity.details.action === 'REMOVE' && <TrendingDown className="w-5 h-5 text-red-600" />}
                    {activity.type === 'PURCHASE' && <ShoppingBag className="w-5 h-5 text-amber-600" />}
                    {activity.type === 'LEVEL_UP' && <Star className="w-5 h-5 text-purple-600" />}
                    {activity.type === 'BADGE' && <Award className="w-5 h-5 text-yellow-600" />}
                    {activity.type === 'ATTENDANCE' && <CalendarCheck className="w-5 h-5 text-blue-600" />}
                    {activity.type === 'ITEM_USED' && <Sparkles className="w-5 h-5 text-indigo-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      {activity.type === 'POINTS' && activity.details.pointType !== 'MIXED' && (
                        <>
                          <span className={activity.details.action === 'ADD' ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                            {activity.details.action === 'ADD' ? '+' : '-'}{activity.details.amount} {activity.details.pointType}
                          </span>
                          {activity.details.reason && <span className="text-gray-500"> - {activity.details.reason}</span>}
                        </>
                      )}
                      {activity.type === 'POINTS' && activity.details.pointType === 'MIXED' && (
                        <>
                          {[
                            activity.details.xpAmount && { amount: activity.details.xpAmount, type: 'XP', color: activity.details.action === 'ADD' ? 'text-emerald-600' : 'text-red-500' },
                            activity.details.hpAmount && { amount: activity.details.hpAmount, type: 'HP', color: activity.details.action === 'ADD' ? 'text-rose-500' : 'text-red-500' },
                            activity.details.gpAmount && { amount: activity.details.gpAmount, type: 'GP', color: activity.details.action === 'ADD' ? 'text-amber-600' : 'text-red-500' },
                          ].filter(Boolean).map((p: any, i: number) => (
                            <span key={i}>
                              {i > 0 && <span className="text-gray-400">, </span>}
                              <span className={`${p.color} font-medium`}>{activity.details.action === 'ADD' ? '+' : '-'}{p.amount} {p.type}</span>
                            </span>
                          ))}
                          {activity.details.reason && <span className="text-gray-500"> - {activity.details.reason}</span>}
                        </>
                      )}
                      {activity.type === 'PURCHASE' && (
                        <>
                          Compró {activity.details.itemName}
                          {activity.details.totalPrice ? <span className="text-amber-600 ml-1">(-{activity.details.totalPrice} GP)</span> : null}
                        </>
                      )}
                      {activity.type === 'LEVEL_UP' && <span className="text-purple-600 font-medium">⭐ Subió al nivel {activity.details.newLevel}</span>}
                      {activity.type === 'BADGE' && (
                        <span className="text-yellow-700 dark:text-yellow-400 font-medium">
                          {activity.details.badgeIcon || '🏆'} Insignia: {activity.details.badgeName}
                        </span>
                      )}
                      {activity.type === 'ATTENDANCE' && (
                        <span className={
                          activity.details.attendanceStatus === 'PRESENT' ? 'text-emerald-600' :
                          activity.details.attendanceStatus === 'LATE' ? 'text-amber-600' :
                          activity.details.attendanceStatus === 'ABSENT' ? 'text-red-600' :
                          'text-blue-600'
                        }>
                          Asistencia: {
                            activity.details.attendanceStatus === 'PRESENT' ? 'Presente' :
                            activity.details.attendanceStatus === 'ABSENT' ? 'Ausente' :
                            activity.details.attendanceStatus === 'LATE' ? 'Tardanza' :
                            activity.details.attendanceStatus === 'EXCUSED' ? 'Justificado' :
                            activity.details.attendanceStatus
                          }
                        </span>
                      )}
                      {activity.type === 'ITEM_USED' && (
                        <span className="text-indigo-600">Usó {activity.details.itemName}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(activity.timestamp).toLocaleDateString('es', { 
                        day: 'numeric', 
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-500">
                  Mostrando {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} de {totalItems}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};
