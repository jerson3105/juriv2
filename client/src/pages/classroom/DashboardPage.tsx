import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Award,
  Target,
  Zap as Activity,
  Heart,
  Sparkles,
  Coins,
  Clock,
  Star,
  Shield,
  Eye,
  BarChart3,
  Calendar,
  Medal,
  BookOpen,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Gamepad2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card } from '../../components/ui/Card';
import { StudentAvatarMini } from '../../components/avatar/StudentAvatarMini';
import { classroomApi, type Classroom, type Student } from '../../lib/classroomApi';
import { historyApi } from '../../lib/historyApi';
import { badgeApi } from '../../lib/badgeApi';
import { gradeApi } from '../../lib/gradeApi';
import { CHARACTER_CLASSES } from '../../lib/studentApi';

type StatsTab = 'gamification' | 'grades';

export const DashboardPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom & { showCharacterName?: boolean } }>();
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d' | 'all'>('7d');
  const [activeTab, setActiveTab] = useState<StatsTab>('gamification');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  // Obtener datos de la clase
  const { data: classroomData, isLoading } = useQuery({
    queryKey: ['classroom', classroom.id],
    queryFn: () => classroomApi.getById(classroom.id),
  });

  // Obtener historial para análisis
  const { data: historyData } = useQuery({
    queryKey: ['history', classroom.id],
    queryFn: () => historyApi.getClassroomHistory(classroom.id, { limit: 500 }),
    enabled: !!classroom.id,
  });

  // Obtener estadísticas
  const { data: stats } = useQuery({
    queryKey: ['history-stats', classroom.id],
    queryFn: () => historyApi.getClassroomStats(classroom.id),
    enabled: !!classroom.id,
  });

  // Obtener estadísticas de insignias
  const { data: badgeStats } = useQuery({
    queryKey: ['badge-stats', classroom.id],
    queryFn: () => badgeApi.getClassroomStats(classroom.id),
    enabled: !!classroom.id,
  });

  // Obtener calificaciones (solo si usa competencias)
  const { data: gradesData = [] } = useQuery({
    queryKey: ['classroom-grades', classroom.id, 'CURRENT'],
    queryFn: () => gradeApi.getClassroomGrades(classroom.id, 'CURRENT'),
    enabled: !!classroom.id && !!classroom.useCompetencies,
  });

  const students = classroomData?.students || [];

  // Función para obtener el nombre a mostrar según configuración
  const getDisplayName = (student: Student) => {
    if (classroom.showCharacterName === false) {
      if (student.realName && student.realLastName) {
        return `${student.realName} ${student.realLastName}`;
      } else if (student.realName) {
        return student.realName;
      }
    }
    return student.characterName || 'Sin nombre';
  };
  const maxHp = classroom.maxHp || 100;

  // Análisis de estudiantes
  const studentAnalysis = useMemo(() => {
    if (!students.length) return null;

    // Estudiantes con HP crítico (menos del 30%)
    const criticalHp = students.filter(s => (s.hp / maxHp) < 0.3);
    
    // Estudiantes con HP bajo (30-50%)
    const lowHp = students.filter(s => (s.hp / maxHp) >= 0.3 && (s.hp / maxHp) < 0.5);
    
    // Estudiantes destacados (top 3 por XP)
    const topPerformers = [...students].sort((a, b) => b.xp - a.xp).slice(0, 3);
    
    // Estudiantes que necesitan atención (HP bajo + poco XP)
    const needsAttention = students.filter(s => 
      (s.hp / maxHp) < 0.5 && s.xp < (students.reduce((sum, st) => sum + st.xp, 0) / students.length)
    );

    // Promedio de la clase
    const avgXp = students.reduce((sum, s) => sum + s.xp, 0) / students.length;
    const avgHp = students.reduce((sum, s) => sum + s.hp, 0) / students.length;
    const avgGp = students.reduce((sum, s) => sum + s.gp, 0) / students.length;
    const avgLevel = students.reduce((sum, s) => sum + s.level, 0) / students.length;

    // Distribución por clase de personaje
    const classDistribution = students.reduce((acc, s) => {
      acc[s.characterClass] = (acc[s.characterClass] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Estudiantes sin actividad reciente (basado en GP = 0, podría mejorarse con timestamps)
    const inactive = students.filter(s => s.xp === 0 && s.gp === 0);

    return {
      criticalHp,
      lowHp,
      topPerformers,
      needsAttention,
      inactive,
      avgXp: Math.round(avgXp),
      avgHp: Math.round(avgHp),
      avgGp: Math.round(avgGp),
      avgLevel: Math.round(avgLevel * 10) / 10,
      classDistribution,
      totalStudents: students.length,
      healthyStudents: students.filter(s => (s.hp / maxHp) >= 0.7).length,
    };
  }, [students, maxHp]);

  // Actividad reciente del historial
  const recentActivity = useMemo(() => {
    if (!historyData?.logs) return [];
    return historyData.logs.slice(0, 5);
  }, [historyData]);

  // Datos para gráficos de actividad por día
  const activityChartData = useMemo(() => {
    if (!historyData?.logs) return [];
    
    const days = chartPeriod === '7d' ? 7 : chartPeriod === '30d' ? 30 : 90;
    const now = new Date();
    const data: { date: string; xpGanado: number; xpPerdido: number; compras: number }[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayLogs = historyData.logs.filter(log => {
        const logDate = new Date(log.timestamp).toISOString().split('T')[0];
        return logDate === dateStr;
      });
      
      const xpGanado = dayLogs
        .filter(l => l.type === 'POINTS' && l.details.action === 'ADD' && l.details.pointType === 'XP')
        .reduce((sum, l) => sum + (l.details.amount || 0), 0);
      
      const xpPerdido = dayLogs
        .filter(l => l.type === 'POINTS' && l.details.action === 'REMOVE' && l.details.pointType === 'XP')
        .reduce((sum, l) => sum + (l.details.amount || 0), 0);
      
      const compras = dayLogs.filter(l => l.type === 'PURCHASE').length;
      
      data.push({
        date: date.toLocaleDateString('es', { day: 'numeric', month: 'short' }),
        xpGanado,
        xpPerdido,
        compras,
      });
    }
    
    return data;
  }, [historyData, chartPeriod]);

  // Datos para gráfico de distribución de clases
  const classChartData = useMemo(() => {
    if (!studentAnalysis) return [];
    
    const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b'];
    
    return Object.entries(studentAnalysis.classDistribution).map(([key, value], index) => ({
      name: CHARACTER_CLASSES[key as keyof typeof CHARACTER_CLASSES]?.name || key,
      value,
      color: COLORS[index % COLORS.length],
    }));
  }, [studentAnalysis]);

  // Datos para gráfico de niveles
  const levelDistribution = useMemo(() => {
    if (!students.length) return [];
    
    const levels: Record<number, number> = {};
    students.forEach(s => {
      levels[s.level] = (levels[s.level] || 0) + 1;
    });
    
    return Object.entries(levels)
      .map(([level, count]) => ({ level: `Nv.${level}`, count }))
      .sort((a, b) => parseInt(a.level.replace('Nv.', '')) - parseInt(b.level.replace('Nv.', '')));
  }, [students]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!studentAnalysis) {
    return (
      <Card className="text-center py-12">
        <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Sin estudiantes</h3>
        <p className="text-gray-500 dark:text-gray-400">Comparte el código de clase para que tus estudiantes se unan</p>
      </Card>
    );
  }

  // Calcular estadísticas de calificaciones
  const gradeStats = useMemo(() => {
    if (!gradesData.length) return null;
    
    // Agrupar por estudiante
    const byStudent: Record<string, { grades: any[]; avg: number; label: string }> = {};
    
    gradesData.forEach((grade: any) => {
      if (!byStudent[grade.studentProfileId]) {
        byStudent[grade.studentProfileId] = { grades: [], avg: 0, label: '' };
      }
      // Parse calculationDetails if it's a string (MySQL JSON column)
      let details = grade.calculationDetails;
      if (typeof details === 'string') {
        try { details = JSON.parse(details); } catch { details = undefined; }
      }
      byStudent[grade.studentProfileId].grades.push({
        ...grade,
        calculationDetails: details,
      });
    });
    
    // Calcular promedios
    Object.keys(byStudent).forEach(id => {
      const grades = byStudent[id].grades;
      const scores = grades.map((g: any) => parseFloat(g.score) || 0);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      byStudent[id].avg = avg;
      byStudent[id].label = avg >= 85 ? 'AD' : avg >= 65 ? 'A' : avg >= 50 ? 'B' : 'C';
    });
    
    // Contar por nivel de logro
    const distribution = { AD: 0, A: 0, B: 0, C: 0 };
    Object.values(byStudent).forEach(s => {
      distribution[s.label as keyof typeof distribution]++;
    });
    
    // Estudiantes ordenados por promedio
    const studentsWithGrades = students.map(s => ({
      ...s,
      gradeInfo: byStudent[s.id] || { grades: [], avg: 0, label: 'C' }
    })).sort((a, b) => b.gradeInfo.avg - a.gradeInfo.avg);
    
    // Identificar estudiantes que necesitan apoyo (C o B bajo)
    const needsSupport = studentsWithGrades.filter(s => s.gradeInfo.label === 'C' || (s.gradeInfo.label === 'B' && s.gradeInfo.avg < 55));
    
    // Top performers
    const topPerformers = studentsWithGrades.filter(s => s.gradeInfo.label === 'AD').slice(0, 5);
    
    return {
      distribution,
      studentsWithGrades,
      needsSupport,
      topPerformers,
      totalEvaluated: Object.keys(byStudent).length,
      avgScore: Object.values(byStudent).reduce((sum, s) => sum + s.avg, 0) / (Object.keys(byStudent).length || 1),
    };
  }, [gradesData, students]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
          <BarChart3 size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">
            Estadísticas
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Monitorea el progreso y bienestar académico de tus estudiantes
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('gamification')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'gamification'
              ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <Gamepad2 size={18} />
          Stats de Gamificación
        </button>
        {classroom.useCompetencies && (
          <button
            onClick={() => setActiveTab('grades')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'grades'
                ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <GraduationCap size={18} />
            Stats de Calificaciones
          </button>
        )}
      </div>

      {/* Contenido según tab activo */}
      {activeTab === 'gamification' ? (
        <>
      {/* Alertas importantes */}
      {(studentAnalysis.criticalHp.length > 0 || studentAnalysis.needsAttention.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {/* Alerta HP Crítico */}
          {studentAnalysis.criticalHp.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-800 dark:text-red-400">
                    ⚠️ {studentAnalysis.criticalHp.length} estudiante{studentAnalysis.criticalHp.length > 1 ? 's' : ''} con HP crítico
                  </h3>
                  <p className="text-sm text-red-600 mt-1">
                    Estos estudiantes tienen menos del 30% de vida. Considera darles puntos positivos o hablar con ellos.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {studentAnalysis.criticalHp.map(student => (
                      <div key={student.id} className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-1.5 shadow-sm">
                        <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{getDisplayName(student)}</span>
                        <span className="text-xs text-red-600 font-bold">{student.hp} HP</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Alerta necesitan atención */}
          {studentAnalysis.needsAttention.length > 0 && studentAnalysis.criticalHp.length === 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Eye className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-800 dark:text-amber-400">
                    👀 {studentAnalysis.needsAttention.length} estudiante{studentAnalysis.needsAttention.length > 1 ? 's' : ''} necesitan atención
                  </h3>
                  <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                    Tienen HP bajo y XP por debajo del promedio. Podrían necesitar motivación adicional.
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Users className="w-5 h-5" />}
          label="Total Estudiantes"
          value={studentAnalysis.totalStudents}
          color="blue"
        />
        <MetricCard
          icon={<Heart className="w-5 h-5" />}
          label="Salud Promedio"
          value={`${Math.round((studentAnalysis.avgHp / maxHp) * 100)}%`}
          subValue={`${studentAnalysis.healthyStudents} saludables`}
          color={studentAnalysis.avgHp / maxHp > 0.6 ? 'green' : studentAnalysis.avgHp / maxHp > 0.3 ? 'yellow' : 'red'}
        />
        <MetricCard
          icon={<Sparkles className="w-5 h-5" />}
          label="XP Promedio"
          value={studentAnalysis.avgXp}
          color="purple"
        />
        <MetricCard
          icon={<Star className="w-5 h-5" />}
          label="Nivel Promedio"
          value={studentAnalysis.avgLevel}
          color="amber"
        />
      </div>

      {/* Sección de Insignias */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
            <Medal className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-gray-800 dark:text-white">Estadísticas de Insignias</h3>
        </div>
        
        {!badgeStats ? (
          <div className="text-center py-8 text-gray-400">
            <Medal className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Cargando estadísticas...</p>
          </div>
        ) : badgeStats.totalBadges === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Medal className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay insignias creadas</p>
            <p className="text-xs mt-1">Crea insignias en la sección de Insignias</p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{badgeStats.totalBadges}</p>
              <p className="text-xs text-amber-600/70">Insignias disponibles</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{badgeStats.totalAwarded}</p>
              <p className="text-xs text-green-600/70">Total otorgadas</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{badgeStats.studentsWithBadges}</p>
              <p className="text-xs text-blue-600/70">Estudiantes con insignias</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">
                {badgeStats.totalStudents > 0 
                  ? Math.round((badgeStats.studentsWithBadges / badgeStats.totalStudents) * 100) 
                  : 0}%
              </p>
              <p className="text-xs text-purple-600/70">Cobertura</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Insignia más otorgada */}
            {badgeStats.mostAwardedBadge && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">🏆 Insignia más popular</h4>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg overflow-hidden">
                    {badgeStats.mostAwardedBadge.icon.startsWith('/') ? (
                      <img 
                        src={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${badgeStats.mostAwardedBadge.icon}`}
                        alt={badgeStats.mostAwardedBadge.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">{badgeStats.mostAwardedBadge.icon}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 dark:text-white">{badgeStats.mostAwardedBadge.name}</p>
                    <p className="text-sm text-gray-500">Otorgada {badgeStats.mostAwardedBadge.count} veces</p>
                  </div>
                </div>
              </div>
            )}

            {/* Últimas insignias otorgadas */}
            {badgeStats.recentAwards.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">🕐 Últimas otorgadas</h4>
                <div className="space-y-2">
                  {badgeStats.recentAwards.slice(0, 3).map((award, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center overflow-hidden">
                        {award.badgeIcon.startsWith('/') ? (
                          <img 
                            src={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${award.badgeIcon}`}
                            alt={award.badgeName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs">{award.badgeIcon}</span>
                        )}
                      </div>
                      <span className="font-medium text-gray-700 dark:text-gray-200">{award.studentName}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-gray-600 dark:text-gray-400">{award.badgeName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          </>
        )}
      </Card>

      {/* Sección de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Actividad */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-gray-800 dark:text-white">Actividad de XP</h3>
            </div>
            <div className="flex gap-1">
              {(['7d', '30d', 'all'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setChartPeriod(period)}
                  className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                    chartPeriod === period
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-medium'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {period === '7d' ? '7 días' : period === '30d' ? '30 días' : 'Todo'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            {activityChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityChartData}>
                  <defs>
                    <linearGradient id="colorXpGanado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorXpPerdido" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="xpGanado" stroke="#10b981" fillOpacity={1} fill="url(#colorXpGanado)" name="XP Ganado" />
                  <Area type="monotone" dataKey="xpPerdido" stroke="#ef4444" fillOpacity={1} fill="url(#colorXpPerdido)" name="XP Perdido" />
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

        {/* Gráfico de Distribución de Clases y Niveles */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-gray-800 dark:text-white">Distribución</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Pie Chart de Clases */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-2">Por Clase</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={classChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={55}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {classChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {classChartData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-gray-600 dark:text-gray-300">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar Chart de Niveles */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-2">Por Nivel</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={levelDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="level" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} name="Estudiantes" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Secciones principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estudiantes destacados */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                <Award className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-gray-800 dark:text-white">Top Estudiantes</h3>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Por XP acumulado</span>
          </div>
          <div className="space-y-3">
            {studentAnalysis.topPerformers.map((student, index) => (
              <StudentRow 
                key={student.id} 
                student={student} 
                rank={index + 1}
                maxHp={maxHp}
                showMedal
                displayName={getDisplayName(student)}
              />
            ))}
          </div>
        </Card>

        {/* Estudiantes que necesitan apoyo */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-rose-400 to-red-500 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-gray-800 dark:text-white">Necesitan Apoyo</h3>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">HP bajo o XP bajo</span>
          </div>
          {studentAnalysis.lowHp.length === 0 && studentAnalysis.criticalHp.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Shield className="w-12 h-12 mx-auto mb-2 text-green-300" />
              <p className="text-sm">¡Todos los estudiantes están bien! 🎉</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...studentAnalysis.criticalHp, ...studentAnalysis.lowHp].slice(0, 5).map((student) => (
                <StudentRow 
                  key={student.id} 
                  student={student}
                  maxHp={maxHp}
                  showHealth
                  displayName={getDisplayName(student)}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Distribución y estadísticas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribución por clase */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-gray-800 dark:text-white">Clases de Personaje</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(studentAnalysis.classDistribution).map(([classKey, count]) => {
              const classInfo = CHARACTER_CLASSES[classKey as keyof typeof CHARACTER_CLASSES];
              const percentage = Math.round((count / studentAnalysis.totalStudents) * 100);
              return (
                <div key={classKey} className="flex items-center gap-3">
                  <span className="text-2xl">{classInfo?.icon}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-200">{classInfo?.name}</span>
                      <span className="text-gray-500 dark:text-gray-400">{count} ({percentage}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Resumen de puntos */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-gray-800 dark:text-white">Resumen de Puntos</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span className="text-sm text-gray-600 dark:text-gray-300">XP Otorgado</span>
              </div>
              <span className="font-bold text-emerald-600">+{stats?.totalXpGiven || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                <span className="text-sm text-gray-600 dark:text-gray-300">XP Removido</span>
              </div>
              <span className="font-bold text-red-600">-{stats?.totalXpRemoved || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-600" />
                <span className="text-sm text-gray-600 dark:text-gray-300">GP en Circulación</span>
              </div>
              <span className="font-bold text-amber-600">{studentAnalysis.avgGp * studentAnalysis.totalStudents}</span>
            </div>
          </div>
        </Card>

        {/* Actividad reciente */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-gray-800 dark:text-white">Actividad Reciente</h3>
          </div>
          {recentActivity.length === 0 ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Sin actividad reciente</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    {activity.type === 'POINTS' && <Sparkles className="w-4 h-4 text-emerald-500" />}
                    {activity.type === 'PURCHASE' && <Coins className="w-4 h-4 text-amber-500" />}
                    {activity.type === 'LEVEL_UP' && <Star className="w-4 h-4 text-purple-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-200 truncate">
                      <span className="font-medium">{activity.studentName}</span>
                      {activity.type === 'POINTS' && activity.details.pointType === 'MIXED' && (
                        <>
                          {` ${activity.details.action === 'ADD' ? 'ganó' : 'perdió'} `}
                          {activity.details.xpAmount && <span className="text-emerald-500 font-medium">+{activity.details.xpAmount} XP</span>}
                          {activity.details.xpAmount && (activity.details.hpAmount || activity.details.gpAmount) && ', '}
                          {activity.details.hpAmount && <span className="text-rose-500 font-medium">+{activity.details.hpAmount} HP</span>}
                          {activity.details.hpAmount && activity.details.gpAmount && ', '}
                          {activity.details.gpAmount && <span className="text-amber-500 font-medium">+{activity.details.gpAmount} GP</span>}
                        </>
                      )}
                      {activity.type === 'POINTS' && activity.details.pointType !== 'MIXED' && ` ${activity.details.action === 'ADD' ? 'ganó' : 'perdió'} ${activity.details.amount} ${activity.details.pointType}`}
                      {activity.type === 'PURCHASE' && ` compró ${activity.details.itemName}`}
                      {activity.type === 'LEVEL_UP' && ` subió al nivel ${activity.details.newLevel}`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(activity.timestamp).toLocaleDateString('es', { 
                        day: 'numeric', 
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Consejos pedagógicos */}
      <Card className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border-indigo-100 dark:border-indigo-800">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <Target className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-2">💡 Sugerencias para mejorar el rendimiento</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              {studentAnalysis.criticalHp.length > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  <span>Habla con los estudiantes con HP crítico. Pueden estar desmotivados o enfrentando dificultades.</span>
                </li>
              )}
              {studentAnalysis.avgHp / maxHp < 0.6 && (
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>El HP promedio está bajo. Considera crear más oportunidades para ganar puntos positivos.</span>
                </li>
              )}
              {studentAnalysis.inactive.length > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">•</span>
                  <span>Hay {studentAnalysis.inactive.length} estudiantes sin actividad. Involúcralos con actividades grupales.</span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <span className="text-green-500">•</span>
                <span>Reconoce públicamente a los estudiantes destacados para motivar a los demás.</span>
              </li>
            </ul>
          </div>
        </div>
      </Card>
        </>
      ) : (
        /* Tab de Calificaciones */
        <div className="space-y-6">
          {/* Resumen de calificaciones */}
          {!gradeStats ? (
            <Card className="text-center py-12">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Sin calificaciones</h3>
              <p className="text-gray-500 dark:text-gray-400">Recalcula las calificaciones desde el Libro de Calificaciones</p>
            </Card>
          ) : (
            <>
              {/* Métricas principales de calificaciones */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-600 rounded-xl flex items-center justify-center text-white">
                      <GraduationCap size={20} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-800 dark:text-white">{gradeStats.totalEvaluated}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Evaluados</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-blue-600 rounded-xl flex items-center justify-center text-white">
                      <BarChart3 size={20} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-800 dark:text-white">{gradeStats.avgScore.toFixed(0)}%</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Promedio General</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center text-white">
                      <Award size={20} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-emerald-600">{gradeStats.distribution.AD}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Logro Destacado</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-rose-600 rounded-xl flex items-center justify-center text-white">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{gradeStats.needsSupport.length}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Necesitan Apoyo</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Distribución de calificaciones */}
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-white">Distribución de Logros</h3>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-emerald-600">AD</p>
                    <p className="text-xl font-semibold text-emerald-600 mt-1">{gradeStats.distribution.AD}</p>
                    <p className="text-xs text-gray-500 mt-1">Logro Destacado</p>
                    <p className="text-xs text-gray-400">
                      {gradeStats.totalEvaluated > 0 ? Math.round((gradeStats.distribution.AD / gradeStats.totalEvaluated) * 100) : 0}%
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-blue-600">A</p>
                    <p className="text-xl font-semibold text-blue-600 mt-1">{gradeStats.distribution.A}</p>
                    <p className="text-xs text-gray-500 mt-1">Logro Esperado</p>
                    <p className="text-xs text-gray-400">
                      {gradeStats.totalEvaluated > 0 ? Math.round((gradeStats.distribution.A / gradeStats.totalEvaluated) * 100) : 0}%
                    </p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-amber-600">B</p>
                    <p className="text-xl font-semibold text-amber-600 mt-1">{gradeStats.distribution.B}</p>
                    <p className="text-xs text-gray-500 mt-1">En Proceso</p>
                    <p className="text-xs text-gray-400">
                      {gradeStats.totalEvaluated > 0 ? Math.round((gradeStats.distribution.B / gradeStats.totalEvaluated) * 100) : 0}%
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-red-600">C</p>
                    <p className="text-xl font-semibold text-red-600 mt-1">{gradeStats.distribution.C}</p>
                    <p className="text-xs text-gray-500 mt-1">En Inicio</p>
                    <p className="text-xs text-gray-400">
                      {gradeStats.totalEvaluated > 0 ? Math.round((gradeStats.distribution.C / gradeStats.totalEvaluated) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </Card>

              {/* Alertas de estudiantes que necesitan apoyo */}
              {gradeStats.needsSupport.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-800 dark:text-red-400">
                        ⚠️ {gradeStats.needsSupport.length} estudiante{gradeStats.needsSupport.length > 1 ? 's' : ''} necesitan apoyo académico
                      </h3>
                      <p className="text-sm text-red-600 mt-1">
                        Estos estudiantes tienen calificación C o B bajo. Considera reforzar conceptos o brindar tutorías.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {gradeStats.needsSupport.slice(0, 6).map((student) => (
                          <div key={student.id} className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-1.5 shadow-sm">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                              student.gradeInfo.label === 'C' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                            }`}>
                              {student.gradeInfo.label}
                            </span>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{getDisplayName(student)}</span>
                            <span className="text-xs text-gray-500">{student.gradeInfo.avg.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Estudiantes por Calificación */}
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-500 rounded-lg flex items-center justify-center">
                        <Award className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-bold text-gray-800 dark:text-white">Top Calificaciones</h3>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Logro Destacado (AD)</span>
                  </div>
                  {gradeStats.topPerformers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Award className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Aún no hay estudiantes con AD</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {gradeStats.topPerformers.map((student, idx) => (
                        <div key={student.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                            <span className="font-bold text-emerald-600">#{idx + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-800 dark:text-white truncate block">{getDisplayName(student)}</span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Promedio: {student.gradeInfo.avg.toFixed(1)}%</p>
                          </div>
                          <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 font-bold rounded-lg text-sm">
                            AD
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Listado de todos los estudiantes con selector */}
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-bold text-gray-800 dark:text-white">Todos los Estudiantes</h3>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Por promedio</span>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {gradeStats.studentsWithGrades.map((student) => (
                      <div 
                        key={student.id} 
                        onClick={() => setSelectedStudent(selectedStudent === student.id ? null : student.id)}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedStudent === student.id 
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-300' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          student.gradeInfo.label === 'AD' ? 'bg-emerald-100 text-emerald-600' :
                          student.gradeInfo.label === 'A' ? 'bg-blue-100 text-blue-600' :
                          student.gradeInfo.label === 'B' ? 'bg-amber-100 text-amber-600' :
                          'bg-red-100 text-red-600'
                        }`}>
                          {student.gradeInfo.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-800 dark:text-white truncate block text-sm">{getDisplayName(student)}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                          {student.gradeInfo.avg.toFixed(0)}%
                        </span>
                        {selectedStudent === student.id ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Detalle del estudiante seleccionado */}
              {selectedStudent && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="p-5">
                    {(() => {
                      const student = gradeStats.studentsWithGrades.find(s => s.id === selectedStudent);
                      if (!student) return null;
                      return (
                        <>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                              <StudentAvatarMini
                                studentProfileId={student.id}
                                gender={student.avatarGender || 'MALE'}
                                size="xl"
                                className="scale-[0.22] origin-top"
                              />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-gray-800 dark:text-white">{getDisplayName(student)}</h3>
                              <p className="text-sm text-gray-500">Promedio: <span className="font-semibold">{student.gradeInfo.avg.toFixed(1)}%</span> ({student.gradeInfo.label})</p>
                            </div>
                            <span className={`px-3 py-1.5 rounded-xl text-lg font-bold ${
                              student.gradeInfo.label === 'AD' ? 'bg-emerald-100 text-emerald-600' :
                              student.gradeInfo.label === 'A' ? 'bg-blue-100 text-blue-600' :
                              student.gradeInfo.label === 'B' ? 'bg-amber-100 text-amber-600' :
                              'bg-red-100 text-red-600'
                            }`}>
                              {student.gradeInfo.label}
                            </span>
                          </div>
                          
                          {/* Calificaciones por competencia con detalle */}
                          <div className="space-y-4">
                            {student.gradeInfo.grades.map((grade: any) => (
                              <div key={grade.competencyId} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{grade.competencyName}</p>
                                    <p className="text-xs text-gray-500">{grade.activitiesCount || 0} actividades registradas</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">{parseFloat(grade.score).toFixed(0)}%</span>
                                    <span className={`px-2 py-1 rounded-lg text-sm font-bold ${
                                      grade.gradeLabel === 'AD' ? 'bg-emerald-100 text-emerald-600' :
                                      grade.gradeLabel === 'A' ? 'bg-blue-100 text-blue-600' :
                                      grade.gradeLabel === 'B' ? 'bg-amber-100 text-amber-600' :
                                      'bg-red-100 text-red-600'
                                    }`}>
                                      {grade.gradeLabel}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Detalle de actividades que contribuyen */}
                                {grade.calculationDetails?.activities && grade.calculationDetails.activities.length > 0 ? (
                                  <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                                    <p className="text-xs font-medium text-gray-500 mb-2">📋 Registros que contribuyen a esta nota:</p>
                                    {grade.calculationDetails.activities.map((activity: any, idx: number) => {
                                      const getActivityIcon = (type: string) => {
                                        switch (type) {
                                          case 'BEHAVIOR': return '🎯';
                                          case 'BADGE': return '🏅';
                                          case 'MISSION': return '📜';
                                          case 'TOURNAMENT': return '🏆';
                                          case 'EXPEDITION': return '🗺️';
                                          case 'TIMER': return '⏱️';
                                          default: return '📝';
                                        }
                                      };
                                      const getActivityLabel = (type: string) => {
                                        switch (type) {
                                          case 'BEHAVIOR': return 'Comportamiento';
                                          case 'BADGE': return 'Insignia';
                                          case 'MISSION': return 'Misión';
                                          case 'TOURNAMENT': return 'Torneo';
                                          case 'EXPEDITION': return 'Expedición';
                                          case 'TIMER': return 'Actividad';
                                          default: return 'Actividad';
                                        }
                                      };
                                      const isPositive = activity.score >= 50;
                                      
                                      return (
                                        <div 
                                          key={`${activity.id}-${idx}`} 
                                          className={`flex items-center justify-between p-2 rounded-lg ${
                                            isPositive 
                                              ? 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800' 
                                              : 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="text-lg">{getActivityIcon(activity.type)}</span>
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{activity.name}</p>
                                              <p className="text-xs text-gray-500">{getActivityLabel(activity.type)} • Peso: {activity.weight}%</p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 ml-2">
                                            <span className={`text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                              {activity.score}%
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                                    <p className="text-xs text-gray-400 italic">Sin actividades registradas para esta competencia</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </Card>
                </motion.div>
              )}

              {/* Consejos para mejorar calificaciones */}
              <Card className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border-indigo-100 dark:border-indigo-800">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                    <Target className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-white mb-2">💡 Recomendaciones para padres y profesores</h3>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                      {gradeStats.needsSupport.length > 0 && (
                        <li className="flex items-start gap-2">
                          <span className="text-red-500">•</span>
                          <span><strong>{gradeStats.needsSupport.length} estudiantes</strong> requieren refuerzo académico. Considera tutorías individuales.</span>
                        </li>
                      )}
                      {gradeStats.distribution.AD > 0 && (
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-500">•</span>
                          <span>¡Excelente! <strong>{gradeStats.distribution.AD} estudiantes</strong> tienen Logro Destacado. Reconoce su esfuerzo.</span>
                        </li>
                      )}
                      {gradeStats.avgScore < 65 && (
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500">•</span>
                          <span>El promedio general está por debajo del logro esperado. Revisa las estrategias de enseñanza.</span>
                        </li>
                      )}
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500">•</span>
                        <span>Las actividades gamificadas como misiones y torneos contribuyen a las calificaciones. ¡Incentívalas!</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Componente de métrica
const MetricCard = ({ 
  icon, 
  label, 
  value, 
  subValue,
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number;
  subValue?: string;
  color: 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'yellow';
}) => {
  const colors = {
    blue: 'from-blue-400 to-blue-600',
    green: 'from-green-400 to-emerald-600',
    purple: 'from-purple-400 to-indigo-600',
    amber: 'from-amber-400 to-orange-600',
    red: 'from-red-400 to-rose-600',
    yellow: 'from-yellow-400 to-amber-500',
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 bg-gradient-to-br ${colors[color]} rounded-xl flex items-center justify-center text-white`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          {subValue && <p className="text-xs text-gray-400 dark:text-gray-500">{subValue}</p>}
        </div>
      </div>
    </Card>
  );
};

// Componente de fila de estudiante
const StudentRow = ({ 
  student, 
  rank,
  maxHp,
  showMedal,
  showHealth,
  displayName
}: { 
  student: Student; 
  rank?: number;
  maxHp: number;
  showMedal?: boolean;
  showHealth?: boolean;
  displayName: string;
}) => {
  const classInfo = CHARACTER_CLASSES[student.characterClass];
  const hpPercent = (student.hp / maxHp) * 100;
  
  const medalColors = ['text-amber-500', 'text-gray-400', 'text-amber-700'];
  const medalBg = ['bg-amber-100', 'bg-gray-100', 'bg-amber-50'];

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      {showMedal && rank && (
        <div className={`w-8 h-8 ${medalBg[rank - 1]} rounded-full flex items-center justify-center`}>
          <span className={`font-bold ${medalColors[rank - 1]}`}>#{rank}</span>
        </div>
      )}
      
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
        <StudentAvatarMini
          studentProfileId={student.id}
          gender={student.avatarGender || 'MALE'}
          size="xl"
          className="scale-[0.22] origin-top"
        />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800 dark:text-white truncate">{displayName}</span>
          <span className="text-sm">{classInfo?.icon}</span>
        </div>
        {showHealth ? (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${
                  hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${hpPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{student.hp} HP</span>
          </div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">Nivel {student.level} • {student.xp} XP</p>
        )}
      </div>
      
      {!showHealth && (
        <div className="flex items-center gap-1 text-emerald-600">
          <Sparkles size={14} />
          <span className="font-bold text-sm">{student.xp}</span>
        </div>
      )}
    </div>
  );
};
