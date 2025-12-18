import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Calendar,
  Check,
  X,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Save,
  Sparkles,
  Users,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import { attendanceApi, type AttendanceStatus, type BulkAttendanceData } from '../../lib/attendanceApi';
import { StudentAvatarMini } from '../../components/avatar/StudentAvatarMini';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; icon: any; color: string; bgColor: string }> = {
  PRESENT: { label: 'Presente', icon: Check, color: 'text-green-600', bgColor: 'bg-green-100' },
  ABSENT: { label: 'Ausente', icon: X, color: 'text-red-600', bgColor: 'bg-red-100' },
  LATE: { label: 'Tardanza', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  EXCUSED: { label: 'Justificado', icon: AlertCircle, color: 'text-blue-600', bgColor: 'bg-blue-100' },
};

export const AttendancePage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom & { showCharacterName?: boolean } }>();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceStatus>>({});
  const [xpForPresent, setXpForPresent] = useState(5);
  const [hasChanges, setHasChanges] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  // Usar fecha local para evitar problemas de zona horaria
  const dateString = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

  const { data: classroomData } = useQuery({
    queryKey: ['classroom', classroom.id],
    queryFn: () => classroomApi.getById(classroom.id),
  });

  const { data: existingAttendance, isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance', classroom.id, dateString],
    queryFn: () => attendanceApi.getAttendanceByDate(classroom.id, dateString),
  });

  const { data: stats } = useQuery({
    queryKey: ['attendance-stats', classroom.id],
    queryFn: () => attendanceApi.getClassroomStats(classroom.id),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const data: BulkAttendanceData[] = Object.entries(attendanceData).map(([studentProfileId, status]) => ({
        studentProfileId,
        status,
      }));
      return attendanceApi.recordBulkAttendance(classroom.id, dateString, data, xpForPresent);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['attendance-stats', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      setHasChanges(false);
      toast.success('Asistencia guardada correctamente');
    },
    onError: () => {
      toast.error('Error al guardar asistencia');
    },
  });

  // Cargar asistencia existente
  useEffect(() => {
    if (existingAttendance) {
      const data: Record<string, AttendanceStatus> = {};
      existingAttendance.forEach(record => {
        data[record.studentProfileId] = record.status;
      });
      setAttendanceData(data);
      setHasChanges(false);
    } else if (classroomData?.students) {
      // Si no hay asistencia, dejar sin marcar (vacío)
      setAttendanceData({});
    }
  }, [existingAttendance, classroomData?.students]);

  const students = classroomData?.students || [];

  // Función para obtener el nombre a mostrar según configuración
  const getDisplayName = (student: typeof students[0]) => {
    if (classroom.showCharacterName === false) {
      // Mostrar nombre real
      if (student.realName && student.realLastName) {
        return `${student.realName} ${student.realLastName}`;
      } else if (student.realName) {
        return student.realName;
      }
    }
    // Por defecto mostrar nombre de personaje
    return student.characterName || 'Sin nombre';
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    if (newDate <= new Date()) {
      setSelectedDate(newDate);
    }
  };

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendanceData(prev => ({ ...prev, [studentId]: status }));
    setHasChanges(true);
  };

  const setAllStatus = (status: AttendanceStatus) => {
    const data: Record<string, AttendanceStatus> = {};
    students.forEach(student => {
      data[student.id] = status;
    });
    setAttendanceData(data);
    setHasChanges(true);
  };

  const presentCount = Object.values(attendanceData).filter(s => s === 'PRESENT').length;
  const absentCount = Object.values(attendanceData).filter(s => s === 'ABSENT').length;
  const lateCount = Object.values(attendanceData).filter(s => s === 'LATE').length;

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  // Descargar PDF de reporte general
  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    try {
      await attendanceApi.downloadAttendanceReportPDF(classroom.id);
      toast.success('PDF descargado');
    } catch (error) {
      toast.error('Error al descargar PDF');
    } finally {
      setDownloadingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header con fecha */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 lg:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 lg:w-11 lg:h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 flex-shrink-0">
              <Calendar size={20} className="lg:w-[22px] lg:h-[22px]" />
            </div>
            <div>
              <h1 className="text-base lg:text-lg font-bold text-gray-800 dark:text-white">
                Control de Asistencia
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                Registra la asistencia diaria de tus estudiantes
              </p>
            </div>
          </div>
          
          {/* Selector de fecha y botón PDF */}
          <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-3">
            {/* Botón descargar PDF */}
            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPDF}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors disabled:opacity-50"
              title="Descargar reporte PDF"
            >
              {downloadingPDF ? (
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileText size={16} />
              )}
              <span className="hidden sm:inline">Reporte PDF</span>
            </button>

            {/* Selector de fecha */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => changeDate(-1)}
                className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 hidden sm:block" />
                <span className="font-medium text-indigo-900 dark:text-indigo-200 text-xs sm:text-sm lg:text-base">
                  {selectedDate.toLocaleDateString('es-ES', { 
                    weekday: 'short', 
                    day: 'numeric', 
                    month: 'short' 
                  })}
                </span>
                {isToday && (
                  <span className="px-1.5 sm:px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
                    Hoy
                  </span>
                )}
              </div>
              <button
                onClick={() => changeDate(1)}
                disabled={isToday}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
          <div className="hidden lg:block bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 sm:p-3 text-center">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-400 mx-auto mb-1" />
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{students.length}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-2 sm:p-3 text-center">
            <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
            <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{presentCount}</p>
            <p className="text-xs text-gray-500">Presentes</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-2 sm:p-3 text-center">
            <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400 mx-auto mb-1" />
            <p className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400">{absentCount}</p>
            <p className="text-xs text-gray-500">Ausentes</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-2 sm:p-3 text-center">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400 mx-auto mb-1" />
            <p className="text-lg sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{lateCount}</p>
            <p className="text-xs text-gray-500">Tardanzas</p>
          </div>
        </div>
      </div>

      {/* Controles rápidos */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Botones de marcar todos */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs sm:text-sm text-gray-600 w-full sm:w-auto mb-1 sm:mb-0">Marcar todos:</span>
            {Object.entries(STATUS_CONFIG).map(([status, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={status}
                  onClick={() => setAllStatus(status as AttendanceStatus)}
                  className={`flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${config.bgColor} ${config.color} hover:opacity-80`}
                >
                  <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{config.label}</span>
                </button>
              );
            })}
          </div>

          {/* XP y Guardar */}
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2">
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" />
              <span className="text-xs sm:text-sm text-gray-600">XP:</span>
              <input
                type="number"
                value={xpForPresent}
                onChange={(e) => setXpForPresent(parseInt(e.target.value) || 0)}
                className="w-12 sm:w-16 px-1 sm:px-2 py-1 border border-gray-200 rounded-lg text-center text-sm"
                min={0}
              />
            </div>

            <button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors ${
                hasChanges
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {saveMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Guardar</span>
              <span className="sm:hidden">Guardar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lista de estudiantes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loadingAttendance ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Cargando asistencia...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay estudiantes en esta clase</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {students.map((student, index) => {
              const currentStatus = attendanceData[student.id];

              return (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-12 h-[70px] relative rounded-lg overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50">
                    <StudentAvatarMini
                      studentProfileId={student.id}
                      gender={student.avatarGender || 'MALE'}
                      size="md"
                      className="absolute top-0 left-1/2 -translate-x-1/2 scale-[0.28] origin-top"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {getDisplayName(student)}
                    </h3>
                    <p className="text-sm text-gray-500">Nivel {student.level}</p>
                  </div>

                  {/* Status buttons */}
                  <div className="flex items-center gap-2">
                    {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                      const Icon = config.icon;
                      const isActive = currentStatus === status;

                      return (
                        <button
                          key={status}
                          onClick={() => setStatus(student.id, status as AttendanceStatus)}
                          className={`p-2 rounded-lg transition-all ${
                            isActive && currentStatus
                              ? `${config.bgColor} ${config.color} ring-2 ring-offset-1 ring-current`
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                          title={config.label}
                        >
                          <Icon className="w-5 h-5" />
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Estadísticas generales */}
      {stats && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-6 h-6" />
            <h3 className="text-lg font-bold">Estadísticas Generales</h3>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-3xl font-bold">{stats.daysRecorded || 0}</p>
              <p className="text-sm text-white/80">Días registrados</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-3xl font-bold">{stats.attendanceRate}%</p>
              <p className="text-sm text-white/80">Tasa de asistencia</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-3xl font-bold">{stats.present}</p>
              <p className="text-sm text-white/80">Total presentes</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-3xl font-bold">{stats.absent}</p>
              <p className="text-sm text-white/80">Total ausentes</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
