import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  CheckCheck,
  type LucideIcon,
} from 'lucide-react';
import { classroomApi, type Classroom, type Student } from '../../lib/classroomApi';
import { attendanceApi, type AttendanceStatus, type BulkAttendanceData } from '../../lib/attendanceApi';
import { useCharacterClasses } from '../../hooks/useCharacterClasses';
import toast from 'react-hot-toast';

type StatusConfig = { label: string; short: string; icon: LucideIcon; active: string; dot: string };

// Colores con contraste AA en claro y oscuro (texto oscuro sobre fondo claro y viceversa).
const STATUS_CONFIG: Record<AttendanceStatus, StatusConfig> = {
  PRESENT: { label: 'Presente', short: 'Presente', icon: Check, active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200', dot: 'bg-emerald-500' },
  ABSENT: { label: 'Ausente', short: 'Ausente', icon: X, active: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200', dot: 'bg-red-500' },
  LATE: { label: 'Tardanza', short: 'Tarde', icon: Clock, active: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200', dot: 'bg-amber-500' },
  EXCUSED: { label: 'Justificado', short: 'Justif.', icon: AlertCircle, active: 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200', dot: 'bg-primary-500' },
};
const STATUSES = Object.keys(STATUS_CONFIG) as AttendanceStatus[];

const xpStorageKey = (classroomId: string) => `juried:attendance-xp:${classroomId}`;
const draftStorageKey = (classroomId: string, date: string) => `juried:attendance-draft:${classroomId}:${date}`;

const readStoredXp = (classroomId: string) => {
  try {
    const value = Number(localStorage.getItem(xpStorageKey(classroomId)));
    return Number.isInteger(value) && value >= 0 && value <= 100 && localStorage.getItem(xpStorageKey(classroomId)) !== null ? value : 5;
  } catch {
    return 5;
  }
};

const readDraft = (classroomId: string, date: string): Record<string, AttendanceStatus> | null => {
  try {
    const raw = localStorage.getItem(draftStorageKey(classroomId, date));
    return raw ? (JSON.parse(raw) as Record<string, AttendanceStatus>) : null;
  } catch {
    return null;
  }
};

const writeDraft = (classroomId: string, date: string, data: Record<string, AttendanceStatus> | null) => {
  try {
    if (data) localStorage.setItem(draftStorageKey(classroomId, date), JSON.stringify(data));
    else localStorage.removeItem(draftStorageKey(classroomId, date));
  } catch {
    // Sin almacenamiento: el borrador vale solo mientras la página esté abierta.
  }
};

export const AttendancePage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom & { showCharacterName?: boolean } }>();
  const queryClient = useQueryClient();
  const { classMap } = useCharacterClasses(classroom.id);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceStatus>>({});
  const [savedData, setSavedData] = useState<Record<string, AttendanceStatus>>({});
  // Fecha a la que pertenecen los datos en pantalla (evita guardar el borrador de un día en otro).
  const [dataDate, setDataDate] = useState<string | null>(null);
  const [xpForPresent, setXpForPresent] = useState(() => readStoredXp(classroom.id));
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  // Usar fecha local para evitar problemas de zona horaria
  const dateString = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  const todayString = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

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

  const changedIds = Object.keys(attendanceData).filter((id) => attendanceData[id] !== savedData[id]);
  const hasChanges = changedIds.length > 0;

  const saveMutation = useMutation({
    mutationFn: () => {
      // Solo lo que cambió: el servidor reajusta el XP de cada registro corregido.
      const data: BulkAttendanceData[] = changedIds.map((studentProfileId) => ({
        studentProfileId,
        status: attendanceData[studentProfileId],
      }));
      return attendanceApi.recordBulkAttendance(classroom.id, dateString, data, xpForPresent);
    },
    onSuccess: () => {
      writeDraft(classroom.id, dateString, null);
      setSavedData(attendanceData);
      queryClient.invalidateQueries({ queryKey: ['attendance', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['attendance-today', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['attendance-stats', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      toast.success('Asistencia guardada');
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Error al guardar asistencia');
    },
  });

  // Cargar lo guardado del día y, si había un borrador sin guardar, restaurarlo encima.
  useEffect(() => {
    if (!existingAttendance) return;
    const saved: Record<string, AttendanceStatus> = {};
    existingAttendance.forEach((record) => {
      saved[record.studentProfileId] = record.status;
    });
    setSavedData(saved);
    setDataDate(dateString);
    const draft = readDraft(classroom.id, dateString);
    if (draft && Object.keys(draft).some((id) => draft[id] !== saved[id])) {
      setAttendanceData({ ...saved, ...draft });
      toast('Se restauraron cambios sin guardar de este día', { icon: '📝', id: `attendance-draft-${dateString}` });
    } else {
      writeDraft(classroom.id, dateString, null);
      setAttendanceData(saved);
    }
  }, [existingAttendance, classroom.id, dateString]);

  // Guardar el borrador mientras haya cambios pendientes.
  useEffect(() => {
    if (dataDate !== dateString) return;
    writeDraft(classroom.id, dateString, hasChanges ? attendanceData : null);
  }, [attendanceData, hasChanges, classroom.id, dateString, dataDate]);

  // Avisar al cerrar o recargar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!hasChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasChanges]);

  const updateXp = (value: number) => {
    const next = Math.min(100, Math.max(0, Math.trunc(value) || 0));
    setXpForPresent(next);
    try {
      localStorage.setItem(xpStorageKey(classroom.id), String(next));
    } catch {
      // Ignorar: el valor vale para esta sesión.
    }
  };

  // Función para obtener el nombre a mostrar según configuración
  const getDisplayName = (student: Student) => {
    if (classroom.showCharacterName === false && student.realName) {
      return student.realLastName ? `${student.realName} ${student.realLastName}` : student.realName;
    }
    return student.characterName || student.displayName || 'Sin nombre';
  };

  // Ordenar estudiantes alfabéticamente por nombre
  const students = [...(classroomData?.students || [])].sort((a, b) =>
    getDisplayName(a).toLowerCase().localeCompare(getDisplayName(b).toLowerCase(), 'es'),
  );

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    if (newDate <= new Date()) setSelectedDate(newDate);
  };

  const pickDate = (value: string) => {
    if (!value || value > todayString) return;
    const [y, m, d] = value.split('-').map(Number);
    setSelectedDate(new Date(y, m - 1, d));
  };

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendanceData((prev) => ({ ...prev, [studentId]: status }));
  };

  // "Todos presentes" marca solo a quienes no tienen estado: no pisa excepciones ya marcadas.
  const markUnmarkedPresent = () => {
    setAttendanceData((prev) => {
      const next = { ...prev };
      students.forEach((student) => {
        if (!next[student.id]) next[student.id] = 'PRESENT';
      });
      return next;
    });
  };

  const counts = STATUSES.reduce((acc, status) => {
    acc[status] = students.filter((s) => attendanceData[s.id] === status).length;
    return acc;
  }, {} as Record<AttendanceStatus, number>);
  const unmarked = students.filter((s) => !attendanceData[s.id]).length;
  const isToday = dateString === todayString;

  // Descargar PDF de reporte general
  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    try {
      await attendanceApi.downloadAttendanceReportPDF(classroom.id);
      toast.success('PDF descargado');
    } catch {
      toast.error('Error al descargar PDF');
    } finally {
      setDownloadingPDF(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Cabecera: fecha, marcar todos y reporte */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white mr-auto">
            <Calendar size={20} className="text-primary-600 dark:text-primary-400" aria-hidden="true" />
            Asistencia
          </h1>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => changeDate(-1)}
              aria-label="Día anterior"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <label className="relative flex items-center gap-2 min-h-[40px] px-3 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-sm font-semibold text-primary-800 dark:text-primary-200 cursor-pointer">
              <span className="capitalize">
                {selectedDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              {isToday && <span className="px-2 py-0.5 rounded-full bg-primary-600 text-white text-xs">Hoy</span>}
              <input
                type="date"
                value={dateString}
                max={todayString}
                onChange={(e) => pickDate(e.target.value)}
                aria-label="Elegir fecha"
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
            <button
              type="button"
              onClick={() => changeDate(1)}
              disabled={isToday}
              aria-label="Día siguiente"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={markUnmarkedPresent}
            disabled={unmarked === 0}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold disabled:opacity-50"
          >
            <CheckCheck size={16} aria-hidden="true" />
            Todos presentes
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {downloadingPDF ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            ) : (
              <FileText size={16} aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Reporte PDF</span>
          </button>
        </div>

        {/* Progreso del pase de lista */}
        {students.length > 0 && (
          <div className="mt-3">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
              {(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] as AttendanceStatus[]).map((status) => (
                <span key={status} className={`${STATUS_CONFIG[status].dot} h-full transition-all`} style={{ width: `${(counts[status] / students.length) * 100}%` }} />
              ))}
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-700 dark:text-gray-300" aria-live="polite">
              <span><strong className="text-emerald-700 dark:text-emerald-300">{counts.PRESENT}</strong> presentes</span>
              <span><strong className="text-amber-700 dark:text-amber-300">{counts.LATE}</strong> tarde</span>
              <span><strong className="text-red-700 dark:text-red-300">{counts.ABSENT}</strong> ausentes</span>
              <span><strong className="text-primary-700 dark:text-primary-300">{counts.EXCUSED}</strong> justificados</span>
              <span className={unmarked > 0 ? 'font-semibold text-gray-900 dark:text-white' : ''}>
                <strong>{unmarked}</strong> sin marcar
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Lista de estudiantes */}
      {loadingAttendance ? (
        <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" aria-hidden="true" />
          <p className="text-gray-600 dark:text-gray-300">Cargando asistencia...</p>
        </div>
      ) : students.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" aria-hidden="true" />
          <p className="text-gray-600 dark:text-gray-300">No hay estudiantes en esta clase</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 xl:grid-cols-2 gap-2">
          {students.map((student) => {
            const currentStatus = attendanceData[student.id];
            const classInfo = (student.characterClassId && classMap[student.characterClassId]) || classMap[student.characterClass];
            const pending = attendanceData[student.id] !== savedData[student.id];
            return (
              <li
                key={student.id}
                className={`flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 rounded-xl border bg-white dark:bg-gray-800 px-3 py-2 ${
                  pending ? 'border-primary-300 dark:border-primary-700' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-base" aria-hidden="true" title={classInfo?.name}>
                  {classInfo?.icon || '👤'}
                </span>
                <span className="flex-1 min-w-0 truncate font-medium text-gray-900 dark:text-white">{getDisplayName(student)}</span>
                <div role="group" aria-label={`Asistencia de ${getDisplayName(student)}`} className="flex w-full sm:w-auto flex-shrink-0 overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
                  {STATUSES.map((status, index) => {
                    const config = STATUS_CONFIG[status];
                    const Icon = config.icon;
                    const isActive = currentStatus === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatus(student.id, status)}
                        aria-pressed={isActive}
                        title={config.label}
                        className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1 min-h-[36px] px-2 sm:px-2.5 text-xs sm:text-sm font-medium transition-colors ${
                          index > 0 ? 'border-l border-gray-300 dark:border-gray-600' : ''
                        } ${isActive ? config.active : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      >
                        <Icon size={14} aria-hidden="true" />
                        <span>{config.short}</span>
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Resumen del periodo */}
      {stats && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <TrendingUp size={16} aria-hidden="true" />
            Resumen del periodo
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Días registrados', value: stats.daysRecorded || 0 },
              { label: 'Tasa de asistencia', value: `${stats.attendanceRate}%` },
              { label: 'Total presentes', value: stats.present },
              { label: 'Total ausentes', value: stats.absent },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{item.value}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barra de guardado fija */}
      <div className="sticky bottom-3 z-30">
        <div className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-2.5 shadow-lg backdrop-blur bg-white/95 dark:bg-gray-800/95 ${
          hasChanges ? 'border-primary-400 dark:border-primary-600' : 'border-gray-200 dark:border-gray-700'
        }`}>
          <span className="flex-1 min-w-[160px] text-sm font-medium text-gray-800 dark:text-gray-100" aria-live="polite">
            {hasChanges ? `${changedIds.length} cambio${changedIds.length !== 1 ? 's' : ''} sin guardar` : 'Todo guardado'}
          </span>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300" title="Solo Presente suma XP">
            <Sparkles size={16} className="text-primary-600 dark:text-primary-400" aria-hidden="true" />
            XP por asistir
            <input
              type="number"
              value={xpForPresent}
              onChange={(e) => updateXp(parseInt(e.target.value, 10))}
              min={0}
              max={100}
              className="w-16 min-h-[36px] px-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center text-sm text-gray-900 dark:text-white"
            />
          </label>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
            className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:bg-gray-200 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {saveMutation.isPending ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            ) : (
              <Save size={16} aria-hidden="true" />
            )}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
