import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useSelectedClassroom } from '../../contexts/SelectedClassroomContext';
import { motion } from 'framer-motion';
import {
  Heart,
  Zap,
  Coins,
  Shield,
  TrendingUp,
  TrendingDown,
  Award,
  Calendar,
  Clock,
  ShoppingBag,
  Flame,
  Users,
  Star,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  Activity,
} from 'lucide-react';
import { parentApi } from '../../lib/parentApi';
import type { ChildReport } from '../../lib/parentApi';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function ParentReportPage() {
  const { studentId: paramStudentId } = useParams<{ studentId: string }>();
  const { selected } = useSelectedClassroom();
  const studentId = paramStudentId || selected?.studentProfileId;

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['parent-child-report', studentId],
    queryFn: () => parentApi.getChildReport(studentId!),
    enabled: !!studentId,
  });

  if (isLoading) {
    return (
      <div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div>
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No se pudo cargar el reporte
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Verifica que tienes acceso a este estudiante.
          </p>
          <Link to="/parent">
            <Button>Volver al inicio</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Reporte de {report.studentName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {report.classroomName} · Prof. {report.teacherName} · {report.currentBimester.replace('-B', ' - Bimestre ')}
            </p>
          </div>
          <span className="hidden sm:inline-flex px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium">
            <BarChart3 size={16} className="mr-1.5" />
            Analíticas
          </span>
        </div>
      </div>

      {/* Profile Stats */}
      <ProfileStatsRow report={report} />

      {/* Behavior Summary */}
      <BehaviorSection report={report} />

      {/* Badges */}
      {report.badges.total > 0 && <BadgesSection report={report} />}

      {/* Grades */}
      {report.grades.list.length > 0 && <GradesSection report={report} />}

      {/* Attendance */}
      {report.attendance.total > 0 && <AttendanceSection report={report} />}

      {/* XP Trend */}
      <XpTrendSection report={report} />

      {/* Weekly Pattern */}
      <WeeklyPatternSection report={report} />

      {/* Login Streak + Timed Activities + Shop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {report.loginStreak && <LoginStreakCard report={report} />}
        <TimedActivitiesCard report={report} />
        <ShopCard report={report} />
      </div>

      {/* Clan */}
      {report.clan && <ClanCard report={report} />}
    </div>
  );
}

// ==================== PROFILE STATS ====================

function ProfileStatsRow({ report }: { report: ChildReport }) {
  const hpPercent = report.profile.maxHp > 0
    ? Math.round((report.profile.hp / report.profile.maxHp) * 100)
    : 100;
  const hpBg = hpPercent > 60 ? 'bg-green-500' : hpPercent > 30 ? 'bg-yellow-500' : 'bg-red-500';

  const stats = [
    {
      label: 'Nivel',
      value: report.profile.level,
      icon: <Shield size={20} />,
      gradient: 'from-indigo-500 to-purple-500',
      subtitle: `Clase: ${translateClass(report.profile.characterClass)}`,
    },
    {
      label: 'Experiencia (XP)',
      value: report.profile.xp.toLocaleString(),
      icon: <Zap size={20} />,
      gradient: 'from-blue-500 to-cyan-500',
      subtitle: 'Puntos acumulados',
    },
    {
      label: 'Vida (HP)',
      value: `${report.profile.hp}/${report.profile.maxHp}`,
      icon: <Heart size={20} />,
      gradient: 'from-rose-500 to-pink-500',
      subtitle: hpPercent >= 70 ? 'Excelente estado' : hpPercent >= 40 ? 'Estado regular' : 'Necesita mejorar',
      extra: (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
          <div className={`${hpBg} h-1.5 rounded-full transition-all`} style={{ width: `${Math.min(hpPercent, 100)}%` }} />
        </div>
      ),
    },
    {
      label: 'Monedas (GP)',
      value: report.profile.gp.toLocaleString(),
      icon: <Coins size={20} />,
      gradient: 'from-amber-500 to-yellow-500',
      subtitle: 'Para la tienda',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Card className="p-4 !shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center text-white`}>
                {stat.icon}
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.subtitle}</p>
            {stat.extra}
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

// ==================== BEHAVIORS ====================

function BehaviorSection({ report }: { report: ChildReport }) {
  const { behaviors } = report;
  const total = behaviors.totalPositive + behaviors.totalNegative;
  const positivePercent = total > 0 ? Math.round((behaviors.totalPositive / total) * 100) : 0;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white">
          <Activity size={18} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Comportamiento</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Cómo se ha portado tu hijo en clase
          </p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
            <ThumbsUp size={14} />
            {behaviors.totalPositive} reconocimientos
          </span>
          <span className="flex items-center gap-1 text-red-500 dark:text-red-400 font-medium">
            {behaviors.totalNegative} observaciones
            <ThumbsDown size={14} />
          </span>
        </div>
        <div className="w-full bg-red-200 dark:bg-red-900/30 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-green-400 to-emerald-500 h-3 rounded-full transition-all"
            style={{ width: `${positivePercent}%` }}
          />
        </div>
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-1.5">
          {positivePercent}% de las acciones fueron positivas
        </p>
      </div>

      {/* Last 30 days */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 mb-5">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Últimos 30 días</p>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-green-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              <strong>{behaviors.recentPositive}</strong> reconocimientos
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown size={16} className="text-red-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              <strong>{behaviors.recentNegative}</strong> observaciones
            </span>
          </div>
        </div>
      </div>

      {/* Top behaviors grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Positive */}
        {behaviors.topPositive.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <Star size={14} className="text-green-500" />
              Lo que más destaca
            </h3>
            <div className="space-y-2">
              {behaviors.topPositive.slice(0, 5).map((b, i) => (
                <div key={i} className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{b.name}</p>
                    {b.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{b.description}</p>
                    )}
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">{b.count}x</span>
                    <p className="text-xs text-gray-500">+{b.totalXp} XP</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Negative */}
        {behaviors.topNegative.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-orange-500" />
              Áreas a mejorar
            </h3>
            <div className="space-y-2">
              {behaviors.topNegative.slice(0, 5).map((b, i) => (
                <div key={i} className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{b.name}</p>
                    {b.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{b.description}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-red-500 dark:text-red-400 ml-3 flex-shrink-0">{b.count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {total === 0 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
          Aún no hay registros de comportamiento.
        </p>
      )}
    </Card>
  );
}

// ==================== BADGES ====================

function BadgesSection({ report }: { report: ChildReport }) {
  const rarityColors: Record<string, string> = {
    COMMON: 'from-gray-400 to-gray-500',
    RARE: 'from-blue-400 to-blue-600',
    EPIC: 'from-purple-400 to-purple-600',
    LEGENDARY: 'from-amber-400 to-orange-500',
  };

  const rarityLabels: Record<string, string> = {
    COMMON: 'Común',
    RARE: 'Rara',
    EPIC: 'Épica',
    LEGENDARY: 'Legendaria',
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white">
          <Award size={18} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Insignias ganadas ({report.badges.total})
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Logros y reconocimientos especiales
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {report.badges.list.map((badge, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-start gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3"
          >
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${rarityColors[badge.rarity] || rarityColors.COMMON} flex items-center justify-center text-white text-lg flex-shrink-0`}>
              {badge.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{badge.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{badge.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-gradient-to-r ${rarityColors[badge.rarity] || rarityColors.COMMON} text-white`}>
                  {rarityLabels[badge.rarity] || 'Común'}
                </span>
                <span className="text-[10px] text-gray-400">
                  {new Date(badge.unlockedAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

// ==================== GRADES ====================

function GradesSection({ report }: { report: ChildReport }) {
  const gradeLabelColors: Record<string, string> = {
    AD: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    A: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    B: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    C: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const gradeLabelDescriptions: Record<string, string> = {
    AD: 'Logro destacado',
    A: 'Logro esperado',
    B: 'En proceso',
    C: 'En inicio',
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white">
            <BarChart3 size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Calificaciones actuales</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Rendimiento por competencia</p>
          </div>
        </div>
        {report.grades.average !== null && (
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.grades.average}</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${gradeLabelColors[report.grades.averageLabel || 'B']}`}>
              {report.grades.averageLabel} · {gradeLabelDescriptions[report.grades.averageLabel || 'B']}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {report.grades.list.map((grade, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{grade.competencyName}</p>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{Math.round(grade.score)}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${gradeLabelColors[grade.gradeLabel] || gradeLabelColors.B}`}>
                    {grade.gradeLabel}
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    grade.score >= 90 ? 'bg-green-500' :
                    grade.score >= 70 ? 'bg-blue-500' :
                    grade.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(grade.score, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ==================== ATTENDANCE ====================

function AttendanceSection({ report }: { report: ChildReport }) {
  const { attendance } = report;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white">
          <Calendar size={18} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Asistencia</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Registro de asistencia a clases</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <AttendanceStat
          icon={<CheckCircle size={16} className="text-green-500" />}
          label="Presente"
          value={attendance.present}
          color="bg-green-50 dark:bg-green-900/20"
        />
        <AttendanceStat
          icon={<XCircle size={16} className="text-red-500" />}
          label="Ausente"
          value={attendance.absent}
          color="bg-red-50 dark:bg-red-900/20"
        />
        <AttendanceStat
          icon={<Clock size={16} className="text-yellow-500" />}
          label="Tardanza"
          value={attendance.late}
          color="bg-yellow-50 dark:bg-yellow-900/20"
        />
        <AttendanceStat
          icon={<AlertTriangle size={16} className="text-blue-500" />}
          label="Justificado"
          value={attendance.excused}
          color="bg-blue-50 dark:bg-blue-900/20"
        />
      </div>

      {attendance.rate !== null && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">Tasa de asistencia</p>
          <p className={`text-3xl font-bold ${attendance.rate >= 80 ? 'text-green-600' : attendance.rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
            {attendance.rate}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {attendance.rate >= 90 ? 'Excelente asistencia' :
             attendance.rate >= 80 ? 'Buena asistencia' :
             attendance.rate >= 60 ? 'Asistencia regular, puede mejorar' :
             'Asistencia baja, necesita atención'}
          </p>
        </div>
      )}
    </Card>
  );
}

function AttendanceStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className={`${color} rounded-lg p-3 text-center`}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

// ==================== XP TREND ====================

function XpTrendSection({ report }: { report: ChildReport }) {
  const { xpByWeek } = report.behaviors;
  const maxXp = Math.max(...xpByWeek.map(w => w.xp), 1);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
          <TrendingUp size={18} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Progreso semanal de XP</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Experiencia ganada en las últimas 4 semanas</p>
        </div>
      </div>

      <div className="flex items-end gap-3 h-36">
        {xpByWeek.map((week, i) => {
          const height = maxXp > 0 ? Math.max((week.xp / maxXp) * 100, 4) : 4;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {week.xp > 0 ? `+${week.xp}` : '0'}
              </span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="w-full bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t-lg min-h-[4px]"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">{week.weekLabel}</span>
            </div>
          );
        })}
      </div>

      {xpByWeek.every(w => w.xp === 0) && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
          No se ha ganado XP en las últimas 4 semanas.
        </p>
      )}
    </Card>
  );
}

// ==================== WEEKLY PATTERN ====================

function WeeklyPatternSection({ report }: { report: ChildReport }) {
  const { weeklyPattern } = report.behaviors;
  const maxCount = Math.max(...weeklyPattern.map(d => d.count), 1);
  const totalActivity = weeklyPattern.reduce((s, d) => s + d.count, 0);

  if (totalActivity === 0) return null;

  const mostActiveDay = weeklyPattern.reduce((a, b) => a.count > b.count ? a : b);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white">
          <Calendar size={18} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Días más activos</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Actividad por día de la semana (últimos 30 días) · Día más activo: <strong>{mostActiveDay.day}</strong>
          </p>
        </div>
      </div>

      <div className="flex items-end gap-2 h-28">
        {weeklyPattern.map((day, i) => {
          const height = maxCount > 0 ? Math.max((day.count / maxCount) * 100, 4) : 4;
          const isMax = day.count === mostActiveDay.count && day.count > 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{day.count}</span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className={`w-full rounded-t-lg min-h-[4px] ${
                  isMax
                    ? 'bg-gradient-to-t from-violet-500 to-purple-400'
                    : 'bg-gradient-to-t from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-500'
                }`}
              />
              <span className="text-[10px] text-gray-500 dark:text-gray-400">{day.day.slice(0, 3)}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ==================== LOGIN STREAK ====================

function LoginStreakCard({ report }: { report: ChildReport }) {
  const streak = report.loginStreak;
  if (!streak) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white">
          <Flame size={16} />
        </div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Racha de conexión</h3>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Racha actual</span>
          <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{streak.current} días</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Mejor racha</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{streak.longest} días</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Total conexiones</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{streak.totalLogins}</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
        {streak.current >= 7
          ? 'Tu hijo se conecta constantemente. ¡Excelente compromiso!'
          : streak.current >= 3
          ? 'Buena racha. Anímalo a seguir conectándose.'
          : 'Puede mejorar su constancia de conexión.'}
      </p>
    </Card>
  );
}

// ==================== TIMED ACTIVITIES ====================

function TimedActivitiesCard({ report }: { report: ChildReport }) {
  const { timedActivities } = report;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white">
          <Clock size={16} />
        </div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Actividades en clase</h3>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Total participaciones</span>
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{timedActivities.total}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Puntos ganados</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">+{timedActivities.totalPoints}</span>
        </div>
      </div>
      {timedActivities.recent.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Recientes:</p>
          {timedActivities.recent.slice(0, 3).map((a, i) => (
            <div key={i} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-700/50 rounded-lg px-2 py-1.5">
              <span className="text-gray-700 dark:text-gray-300 truncate">{a.name}</span>
              <span className="text-blue-600 dark:text-blue-400 font-medium ml-2 flex-shrink-0">+{a.points}</span>
            </div>
          ))}
        </div>
      )}
      {timedActivities.total === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Sin actividades registradas aún.</p>
      )}
    </Card>
  );
}

// ==================== SHOP ====================

function ShopCard({ report }: { report: ChildReport }) {
  const { shop } = report;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center text-white">
          <ShoppingBag size={16} />
        </div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Tienda</h3>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Monedas disponibles</span>
          <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{shop.currentGp} GP</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Compras realizadas</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{shop.purchaseCount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Total gastado</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{shop.totalSpent} GP</span>
        </div>
      </div>
      {shop.recentPurchases.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Últimas compras:</p>
          {shop.recentPurchases.slice(0, 3).map((p, i) => (
            <div key={i} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-700/50 rounded-lg px-2 py-1.5">
              <span className="text-gray-700 dark:text-gray-300 truncate">{p.itemName}</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium ml-2 flex-shrink-0">-{p.price} GP</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ==================== CLAN ====================

function ClanCard({ report }: { report: ChildReport }) {
  const { clan } = report;
  if (!clan) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white">
          <Users size={16} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Clan: {clan.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Equipo al que pertenece tu hijo</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{clan.totalXp}</p>
          <p className="text-xs text-gray-500">XP del clan</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-green-600 dark:text-green-400">{clan.wins}</p>
          <p className="text-xs text-gray-500">Victorias</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-red-600 dark:text-red-400">{clan.losses}</p>
          <p className="text-xs text-gray-500">Derrotas</p>
        </div>
      </div>
    </Card>
  );
}

// ==================== HELPERS ====================

function translateClass(characterClass: string): string {
  const map: Record<string, string> = {
    WARRIOR: 'Guerrero',
    MAGE: 'Mago',
    HEALER: 'Sanador',
    ROGUE: 'Pícaro',
    RANGER: 'Explorador',
    PALADIN: 'Paladín',
  };
  return map[characterClass] || characterClass;
}
