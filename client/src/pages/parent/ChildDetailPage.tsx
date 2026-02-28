import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useSelectedClassroom } from '../../contexts/SelectedClassroomContext';
import { 
  BookOpen, 
  Activity, 
  AlertTriangle,
  Calendar,
  User,
  School,
  CheckCircle,
  XCircle,
  Award,
  Star,
  ChevronDown,
  ChevronUp,
  Timer,
  Trophy,
  Zap,
  Heart,
  Info,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { parentApi } from '../../lib/parentApi';
import type { ChildDetail, ActivityLogItem } from '../../lib/parentApi';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useState } from 'react';

type TabType = 'resumen' | 'calificaciones' | 'actividad';

export default function ChildDetailPage() {
  const { studentId: paramStudentId } = useParams<{ studentId: string }>();
  const { selected } = useSelectedClassroom();
  const studentId = paramStudentId || selected?.studentProfileId;
  const [activeTab, setActiveTab] = useState<TabType>('resumen');
  const { data: detail, isLoading, error } = useQuery({
    queryKey: ['parent-child-detail', studentId],
    queryFn: () => parentApi.getChildDetail(studentId!),
    enabled: !!studentId,
  });

  if (isLoading) {
    return (
      <div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div>
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No se pudo cargar la información
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

  const studentName = detail.studentProfile.displayName || detail.studentProfile.characterName || 'Estudiante';

  return (
    <div>
      {/* Info del estudiante */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {studentName}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <School size={14} />
                {detail.classroom.name} · {detail.classroom.teacherName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/parent/report/${studentId}`}>
              <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700">
                <BarChart3 size={18} />
                Reporte
              </Button>
            </Link>
            <span className="hidden sm:inline-flex px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium">
              {detail.currentBimester.replace('-B', ' - Bimestre ')}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        <TabButton 
          active={activeTab === 'resumen'} 
          onClick={() => setActiveTab('resumen')}
          icon={<BookOpen size={18} />}
          label="Resumen"
        />
        <TabButton 
          active={activeTab === 'calificaciones'} 
          onClick={() => setActiveTab('calificaciones')}
          icon={<Award size={18} />}
          label="Calificaciones"
        />
        <TabButton 
          active={activeTab === 'actividad'} 
          onClick={() => setActiveTab('actividad')}
          icon={<Activity size={18} />}
          label="Actividad"
        />
      </div>

      {/* Content */}
      {activeTab === 'resumen' && <ResumenTab detail={detail} />}
      {activeTab === 'calificaciones' && <CalificacionesTab studentId={studentId!} />}
      {activeTab === 'actividad' && <ActividadTab studentId={studentId!} />}

    </div>
  );
}

function TabButton({ 
  active, 
  onClick, 
  icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
        active
          ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200 dark:border-gray-600'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-white/50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ResumenTab({ detail }: { detail: ChildDetail }) {
  const getGradeColor = (label: string) => {
    if (label === 'AD') return 'bg-emerald-500';
    if (label === 'A') return 'bg-blue-500';
    if (label === 'B') return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getGradeBgColor = (label: string) => {
    if (label === 'AD') return 'bg-emerald-100 text-emerald-700';
    if (label === 'A') return 'bg-blue-100 text-blue-700';
    if (label === 'B') return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="space-y-4">
      {/* Alertas */}
      {detail.alerts.length > 0 && (
        <Card className="p-4 border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-900/20">
          <h3 className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-3">
            <AlertTriangle size={20} />
            Alertas ({detail.alerts.length})
          </h3>
          <ul className="space-y-2">
            {detail.alerts.map((alert, idx) => (
              <li key={idx} className="text-sm text-amber-700 dark:text-amber-400">
                • {alert.message}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Calificaciones actuales */}
      <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <BookOpen size={20} className="text-indigo-500" />
          Calificaciones Actuales
        </h3>
        
        {detail.grades.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            Aún no hay calificaciones registradas para este período.
          </p>
        ) : (
          <div className="space-y-3">
            {detail.grades.map((grade) => (
              <div key={grade.competencyId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                    {grade.competencyName}
                  </p>
                  <div className="mt-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${getGradeColor(grade.gradeLabel)} transition-all`}
                      style={{ width: `${grade.score}%` }}
                    />
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-sm font-bold ${getGradeBgColor(grade.gradeLabel)}`}>
                  {grade.gradeLabel}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Actividad reciente */}
      <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <Calendar size={20} className="text-indigo-500" />
          Actividad Reciente
        </h3>
        
        {detail.recentActivity.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            Sin actividad reciente en los últimos 7 días.
          </p>
        ) : (
          <div className="space-y-3">
            {detail.recentActivity.slice(0, 5).map((activity, idx) => (
              <ActivityItem key={idx} activity={activity} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function getActivityTypeLabel(type: string) {
  switch (type) {
    case 'TIMED': return { label: 'Actividad de Tiempo', icon: <Timer size={14} className="text-orange-500" />, color: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300' };
    case 'BEHAVIOR': return { label: 'Comportamiento', icon: <Heart size={14} className="text-emerald-500" />, color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' };
    case 'BADGE': return { label: 'Insignia', icon: <Award size={14} className="text-amber-500" />, color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' };
    case 'JIRO_EXPEDITION': return { label: 'Expedición de Jiro', icon: <Trophy size={14} className="text-purple-500" />, color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300' };
    case 'EXPEDITION': return { label: 'Expedición', icon: <Star size={14} className="text-blue-500" />, color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' };
    case 'TOURNAMENT': return { label: 'Torneo', icon: <Trophy size={14} className="text-red-500" />, color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' };
    default: return { label: type, icon: <Zap size={14} className="text-gray-500" />, color: 'bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
  }
}

function CalificacionesTab({ studentId }: { studentId: string }) {
  const { data: gradesData } = useQuery({
    queryKey: ['parent-child-grades', studentId],
    queryFn: () => parentApi.getChildGrades(studentId),
  });
  const [expandedComp, setExpandedComp] = useState<string | null>(null);

  const periods = ['B1', 'B2', 'B3', 'B4'];
  // Derive year from backend's currentPeriod (e.g. "2025-B1") instead of hardcoding
  const currentYear = gradesData?.currentPeriod?.match(/^(\d{4})-/)?.[1] || String(new Date().getFullYear());

  return (
    <div className="space-y-4">
      <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 overflow-x-auto">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <Award size={20} className="text-indigo-500" />
          Calificaciones por Bimestre
        </h3>

        {!gradesData || gradesData.competencies.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Aún no hay calificaciones registradas.
          </p>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-[1fr_repeat(4,60px)] gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Competencia</span>
              {periods.map((p) => (
                <span key={p} className="text-center text-sm font-semibold text-gray-700 dark:text-gray-300">{p}</span>
              ))}
            </div>

            {/* Rows */}
            {gradesData.competencies.map((comp) => {
              const isExpanded = expandedComp === comp.id;
              // Find the best grade to show details for - try all periods to find one with activities
              const allGradeEntries = Object.entries(comp.grades);
              const gradeWithActivities = allGradeEntries.find(([_, g]) => g.activities && g.activities.length > 0);
              const expandableGrade = gradeWithActivities?.[1] || allGradeEntries[0]?.[1];
              const hasAnyGrade = allGradeEntries.length > 0;

              return (
                <div key={comp.id} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => hasAnyGrade ? setExpandedComp(isExpanded ? null : comp.id) : null}
                    className={`w-full grid grid-cols-[1fr_repeat(4,60px)] gap-2 px-3 py-3 items-center transition-colors ${
                      hasAnyGrade ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer' : 'cursor-default'
                    } ${isExpanded ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                  >
                    <span className="text-left text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      {hasAnyGrade && (
                        isExpanded ? <ChevronUp size={16} className="text-indigo-500 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />
                      )}
                      {comp.name}
                    </span>
                    {periods.map((p) => {
                      const periodKey = `${currentYear}-${p}`;
                      const grade = comp.grades[periodKey];
                      return (
                        <span key={p} className="text-center">
                          {grade ? (
                            <span className={`inline-block px-2 py-1 rounded text-sm font-bold ${getGradeBgColor(grade.label)}`}>
                              {grade.label}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </span>
                      );
                    })}
                  </button>

                  <AnimatePresence>
                    {isExpanded && expandableGrade && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1">
                            <Info size={12} />
                            Actividades que contribuyen a esta nota ({expandableGrade.label} - {Math.round(expandableGrade.score)}%)
                          </p>
                          {expandableGrade.activities && expandableGrade.activities.length > 0 ? (
                            <div className="space-y-2">
                              {expandableGrade.activities.map((act: { type: string; name: string; score: number; weight: number }, idx: number) => {
                                const typeInfo = getActivityTypeLabel(act.type);
                                return (
                                  <div key={idx} className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {typeInfo.icon}
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{act.name}</p>
                                        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{Math.round(act.score)}%</p>
                                      <p className="text-[10px] text-gray-500">peso: {act.weight}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 text-center py-3">El desglose de actividades estará disponible cuando el profesor recalcule las calificaciones.</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Leyenda explicativa */}
      <Card className="p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <Info size={14} className="shrink-0" />
          <span>Haz clic en una competencia para ver las actividades, comportamientos e insignias que contribuyen a la calificación de tu hijo.</span>
        </p>
      </Card>
    </div>
  );
}

function getGradeBgColor(label: string) {
  if (label === 'AD') return 'bg-emerald-100 text-emerald-700';
  if (label === 'A') return 'bg-blue-100 text-blue-700';
  if (label === 'B') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function ActividadTab({ studentId }: { studentId: string }) {
  const { data: activity = [], isLoading } = useQuery({
    queryKey: ['parent-child-activity', studentId],
    queryFn: () => parentApi.getChildActivity(studentId),
  });

  // Agrupar por fecha
  const groupedActivity = activity.reduce((acc: Record<string, ActivityLogItem[]>, item) => {
    const date = new Date(item.date).toLocaleDateString('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
      <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <Activity size={20} className="text-indigo-500" />
        Historial de Actividad
      </h3>

      {Object.keys(groupedActivity).length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          Sin actividad registrada en este período.
        </p>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedActivity).map(([date, items]) => (
            <div key={date}>
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 capitalize">
                {date}
              </h4>
              <div className="space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                {items.map((item, idx) => (
                  <ActivityItem key={idx} activity={item} showTime />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ActivityItem({ activity, showTime = false }: { activity: ActivityLogItem; showTime?: boolean }) {
  const getIcon = () => {
    if (activity.type === 'BADGE') return <Award size={16} className="text-purple-500" />;
    if (activity.isPositive) return <CheckCircle size={16} className="text-green-500" />;
    return <XCircle size={16} className="text-red-500" />;
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${
      activity.isPositive 
        ? 'bg-green-50 dark:bg-green-900/20' 
        : 'bg-red-50 dark:bg-red-900/20'
    }`}>
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${
          activity.isPositive 
            ? 'text-green-800 dark:text-green-300' 
            : 'text-red-800 dark:text-red-300'
        }`}>
          {activity.description}
        </p>
        {activity.details && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {activity.details}
          </p>
        )}
      </div>
      {showTime && (
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          {new Date(activity.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

