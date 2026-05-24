import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  TrendingUp,
  Award,
  Sparkles,
} from 'lucide-react';
import { StudentAttendanceCalendarCard } from '../../components/student/StudentAttendanceCalendarCard';
import { useStudentStore } from '../../store/studentStore';
import { studentApi } from '../../lib/studentApi';
import { attendanceApi, type AttendanceStats } from '../../lib/attendanceApi';

// Configuración de estados
const STATUS_CONFIG = {
  PRESENT: { label: 'Presente', color: 'bg-green-500', textColor: 'text-green-600', bgLight: 'bg-green-100', icon: CheckCircle },
  ABSENT: { label: 'Ausente', color: 'bg-red-500', textColor: 'text-red-600', bgLight: 'bg-red-100', icon: XCircle },
  LATE: { label: 'Tardanza', color: 'bg-yellow-500', textColor: 'text-yellow-600', bgLight: 'bg-yellow-100', icon: Clock },
  EXCUSED: { label: 'Justificado', color: 'bg-blue-500', textColor: 'text-blue-600', bgLight: 'bg-blue-100', icon: FileText },
};

export const StudentAttendancePage = () => {
  const navigate = useNavigate();
  const { selectedClassIndex } = useStudentStore();

  // Obtener clases del estudiante
  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });

  const currentProfile = myClasses?.[selectedClassIndex];
  const classroomId = currentProfile?.classroomId;

  // Obtener asistencia
  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['my-attendance', classroomId],
    queryFn: () => attendanceApi.getMyAttendance(classroomId!),
    enabled: !!classroomId,
  });

  // Formatear tiempo relativo
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  if (!currentProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">No se encontró tu perfil</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const stats = attendanceData?.stats;
  const history = attendanceData?.history || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/my-class')}
          className="flex items-center gap-1.5 sm:gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-3 sm:mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          Volver a mi clase
        </button>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center ring-2 sm:ring-4 ring-indigo-200 dark:ring-indigo-800 flex-shrink-0">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Mi Asistencia</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Revisa tu historial y estadísticas de asistencia
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Porcentaje de asistencia */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl sm:rounded-2xl p-4 sm:p-5 text-white shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-xs sm:text-sm font-medium">Asistencia</p>
              <p className="text-3xl sm:text-4xl font-bold mt-1">{stats?.attendanceRate || 0}%</p>
              <p className="text-indigo-200 text-[10px] sm:text-xs mt-1">
                {stats?.present || 0} de {stats?.total || 0} clases
              </p>
            </div>
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
          </div>
        </motion.div>

        {/* XP Ganado */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-lg border border-emerald-100 dark:border-emerald-900"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 text-emerald-600 mb-1 sm:mb-2">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">XP Ganado</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            +{stats?.totalXpEarned || 0}
          </p>
        </motion.div>

        {/* Racha Actual */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-lg border border-orange-100 dark:border-orange-900"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 text-orange-600 mb-1 sm:mb-2">
            <Award className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">Racha Actual</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            {stats?.currentStreak || 0} días
          </p>
        </motion.div>

        {/* Mejor Racha */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-lg border border-amber-100 dark:border-amber-900"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 text-amber-600 mb-1 sm:mb-2">
            <Award className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">Mejor Racha</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            {stats?.bestStreak || 0} días
          </p>
        </motion.div>

        {/* Tardanzas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-lg border border-yellow-100 dark:border-yellow-900"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 text-yellow-600 mb-1 sm:mb-2">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">Tardanzas</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            {stats?.late || 0}
          </p>
        </motion.div>
      </div>

      {/* Resumen de estados */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const count = stats?.[status.toLowerCase() as keyof AttendanceStats] as number || 0;
          const Icon = config.icon;
          return (
            <div key={status} className={`${config.bgLight} rounded-xl p-2 sm:p-3 flex items-center gap-2 sm:gap-3 flex-shrink-0 min-w-[80px] sm:min-w-0 sm:flex-1`}>
              <div className={`w-8 h-8 sm:w-10 sm:h-10 ${config.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold text-gray-800">{count}</p>
                <p className={`text-[10px] sm:text-xs ${config.textColor} font-medium whitespace-nowrap`}>{config.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <StudentAttendanceCalendarCard classroomId={classroomId!} />
        </motion.div>

        {/* Historial Reciente */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg"
        >
          <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-indigo-500" />
            Historial Reciente
          </h2>

          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay registros de asistencia</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {history.slice(0, 20).map((record) => {
                const config = STATUS_CONFIG[record.status];
                const Icon = config.icon;
                return (
                  <div
                    key={record.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className={`w-10 h-10 ${config.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${config.textColor}`}>
                          {config.label}
                        </span>
                        {record.xpAwarded > 0 && (
                          <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-medium">
                            +{record.xpAwarded} XP
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(record.date).toLocaleDateString('es-ES', { 
                          weekday: 'long', 
                          day: 'numeric', 
                          month: 'long' 
                        })}
                      </p>
                      {record.notes && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          📝 {record.notes}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatTimeAgo(record.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
