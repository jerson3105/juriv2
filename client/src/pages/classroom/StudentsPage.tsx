import { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Sparkles,
  Heart,
  Monitor,
  Moon,
  Coins,
  Check,
  Crown,
  Star,
  Search,
  LayoutGrid,
  List,
  Eye,
  Shield,
  ChevronDown,
  PlayCircle,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StudentAvatarMini } from '../../components/avatar/StudentAvatarMini';
import { classroomApi, type Classroom, type Student } from '../../lib/classroomApi';
import { behaviorApi, type ApplyResult, type Behavior } from '../../lib/behaviorApi';
import { studentApi } from '../../lib/studentApi';
import { useCharacterClasses } from '../../hooks/useCharacterClasses';
import { characterClassApi } from '../../lib/characterClassApi';
import { CLAN_EMBLEMS } from '../../lib/clanApi';
import { attendanceApi, type AttendanceRecord } from '../../lib/attendanceApi';
import { historyApi, type ActivityLogEntry, type HistoryResponse } from '../../lib/historyApi';
import { celebrateApplyResult, celebrateBadgeAward, celebrateLevelUps } from '../../components/celebrations/celebrationHelpers';
import { TodayLevelUps } from '../../components/celebrations/TodayLevelUps';
import { EnergyMeter } from '../../components/energy/EnergyMeter';
import { RecoveryMissionModal } from '../../components/energy/RecoveryMissionModal';
import { isInitialLevel, LOW_ENERGY_RATIO } from '../../components/energy/energyHelpers';
import { useProjectorStore } from '../../store/projectorStore';
import { GiveBadgeModal } from '../../components/badges/GiveBadgeModal';
import { AddPlaceholderStudentsModal } from '../../components/students/AddPlaceholderStudentsModal';
import { StudentsManageMenu } from '../../components/students/StudentsManageMenu';
import { PointsModal } from '../../components/modals/PointsModal';
import { SelectionActionBar } from '../../components/students/SelectionActionBar';
import { StudentFocusView } from '../../components/students/StudentFocusView';
import { useBehaviorUsage } from '../../hooks/useBehaviorUsage';
import { QuickBehaviorPicker, QuickPointButtons } from '../../components/students/QuickPoints';
import { useQuickBehaviors } from '../../hooks/useQuickBehaviors';
import { useSound } from '../../hooks/useSound';
import toast from 'react-hot-toast';
import { accessLabel } from '../../lib/studentAccess';

type ListFilter = 'all' | 'low_hp' | 'resting' | 'no_activity' | 'round_pending' | 'round_scored' | 'round_repeated';

type RoundBehaviorConfig = {
  behaviorId: string;
  behaviorName: string;
  behaviorIcon: string | null;
  multiplier: number;
};

type RoundStudentAwards = {
  positive: number;
  negative: number;
};

type RoundAction = {
  studentId: string;
  behaviorId: string;
  isPositive: boolean;
  pointLogEntryId?: string | null;
  timestamp: number;
};

type ActiveRoundState = {
  positiveBehavior: RoundBehaviorConfig | null;
  negativeBehavior: RoundBehaviorConfig | null;
  startedAt: number;
  updatedAt: number;
  awardsByStudent: Record<string, RoundStudentAwards>;
  lastAwardedAtByStudent: Record<string, number>;
  actions: RoundAction[];
};

const ROUND_STORAGE_TTL_MS = 1000 * 60 * 60 * 8;

export const StudentsPage = () => {
  const { classroom, storyTheme, isThemeDark } = useOutletContext<{ classroom: Classroom & { showCharacterName?: boolean }, storyTheme?: any, isThemeDark?: boolean }>();
  const { classMap, classes: characterClasses } = useCharacterClasses(classroom?.id);
  const { play: playSound } = useSound();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [showBehaviorModal, setShowBehaviorModal] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [behaviorType, setBehaviorType] = useState<'positive' | 'negative'>('positive');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list' | 'clans'>('cards');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);


  // Estado para modal de añadir estudiantes placeholder
  const [showAddPlaceholderModal, setShowAddPlaceholderModal] = useState(false);

  // Energía (HP): "Proyectando" oculta la energía; misión de recuperación para quien descansa.
  const projecting = useProjectorStore((s) => s.projecting);
  const setProjecting = useProjectorStore((s) => s.setProjecting);
  const [recoveryFor, setRecoveryFor] = useState<{ id: string; name: string } | null>(null);
  const initialLevel = isInitialLevel(classroom.gradeLevel);

  // Estado para filtros de vista lista
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [clanFilter, setClanFilter] = useState<string | null>(null);
  const [showClanDropdown, setShowClanDropdown] = useState(false);
  const [showRoundBehaviorPicker, setShowRoundBehaviorPicker] = useState(false);
  const [pendingRoundPositiveBehaviorId, setPendingRoundPositiveBehaviorId] = useState<string | null>(null);
  const [pendingRoundNegativeBehaviorId, setPendingRoundNegativeBehaviorId] = useState<string | null>(null);
  const [pendingRoundPositiveMultiplier, setPendingRoundPositiveMultiplier] = useState(1);
  const [pendingRoundNegativeMultiplier, setPendingRoundNegativeMultiplier] = useState(1);
  const [activeRound, setActiveRound] = useState<ActiveRoundState | null>(null);
  const [isUndoingRound, setIsUndoingRound] = useState(false);
  const [roundQuickActivityCounts, setRoundQuickActivityCounts] = useState<Record<string, number>>({});


  const { data: classroomData, isLoading } = useQuery({
    queryKey: ['classroom', classroom.id],
    queryFn: () => classroomApi.getById(classroom.id),
  });

  const { data: behaviors } = useQuery({
    queryKey: ['behaviors', classroom.id],
    queryFn: () => behaviorApi.getByClassroom(classroom.id),
  });

  // Asistencia de hoy (usar fecha local, no UTC)
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const { data: todayAttendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-today', classroom.id, todayStr],
    queryFn: () => attendanceApi.getAttendanceByDate(classroom.id, todayStr),
  });

  // Historial de hoy (para filtro "Sin actividad hoy")
  const { data: todayHistory } = useQuery({
    queryKey: ['history-today', classroom.id, todayStr],
    queryFn: () => historyApi.getClassroomHistory(classroom.id, { limit: 200 }),
  });

  useEffect(() => {
    setRoundQuickActivityCounts({});
  }, [classroom.id, todayStr]);

  const syncRoundQuickStudentCache = (studentResult: ApplyResult['results'][number]) => {
    let updated = false;

    queryClient.setQueryData<Classroom & { students: Student[] }>(['classroom', classroom.id], (current) => {
      if (!current) return current;

      const nextStudents = current.students.map((student) => {
        if (student.id !== studentResult.studentId) {
          return student;
        }

        updated = true;

        return {
          ...student,
          xp: studentResult.newXp,
          hp: studentResult.newHp,
          gp: studentResult.newGp,
          level: studentResult.newLevel ?? student.level,
        };
      });

      return updated ? { ...current, students: nextStudents } : current;
    });

    return updated;
  };

  const appendRoundQuickHistoryEntry = (
    result: ApplyResult,
    studentResult: ApplyResult['results'][number],
  ) => {
    queryClient.setQueryData<HistoryResponse>(['history-today', classroom.id, todayStr], (current) => {
      if (!current) return current;

      const cachedStudent = classroomData?.students?.find((student) => student.id === studentResult.studentId);
      const behavior = result.behavior;
      const xpAmount = Math.abs(studentResult.xpChange);
      const hpAmount = Math.abs(studentResult.hpChange);
      const gpAmount = Math.abs(studentResult.gpChange);
      const pointType = [xpAmount > 0, hpAmount > 0, gpAmount > 0].filter(Boolean).length > 1
        ? 'MIXED'
        : xpAmount > 0
          ? 'XP'
          : hpAmount > 0
            ? 'HP'
            : 'GP';

      const nextEntry: ActivityLogEntry = {
        id: studentResult.pointLogEntryId || `round-${behavior.id}-${studentResult.studentId}-${Date.now()}`,
        type: 'POINTS',
        timestamp: new Date().toISOString(),
        studentId: studentResult.studentId,
        studentName: studentResult.studentName || cachedStudent?.characterName || null,
        studentClass: cachedStudent?.characterClass || 'GUARDIAN',
        details: {
          pointType,
          action: behavior.isPositive ? 'ADD' : 'REMOVE',
          amount: xpAmount || hpAmount || gpAmount,
          reason: behavior.name,
          multiplier: Math.round((activeRound?.positiveBehavior?.behaviorId === behavior.id
            ? activeRound.positiveBehavior.multiplier
            : activeRound?.negativeBehavior?.behaviorId === behavior.id
              ? activeRound.negativeBehavior.multiplier
              : 1) * 1000),
          xpAmount: xpAmount || undefined,
          hpAmount: hpAmount || undefined,
          gpAmount: gpAmount || undefined,
        },
      };

      return {
        ...current,
        logs: [nextEntry, ...current.logs].slice(0, 200),
        total: current.total + 1,
      };
    });
  };

  type ApplyBehaviorMode = 'default' | 'round_quick' | 'apply_to_rest' | 'row_quick';
  type ApplyBehaviorPayload = {
    behaviorId: string;
    studentIds: string[];
    mode?: ApplyBehaviorMode;
    multiplier?: number;
  };

  // Deshace una aplicación completa: revierte el registro de cada alumno (el servidor revierte
  // juntos XP, HP y oro de ese registro).
  const undoAppliedBehavior = async (result: ApplyResult) => {
    const entryIds = result.results
      .map((studentResult) => studentResult.pointLogEntryId)
      .filter((id): id is string => Boolean(id));
    if (entryIds.length === 0) {
      toast.error('No se pudo identificar lo aplicado para deshacerlo');
      return;
    }

    const toastId = toast.loading('Deshaciendo...');
    const outcomes = await Promise.allSettled(entryIds.map((id) => historyApi.revertEntry('POINTS', id)));
    const failed = outcomes.filter((outcome) => outcome.status === 'rejected').length;
    queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
    queryClient.invalidateQueries({ queryKey: ['history-today', classroom.id] });
    if (failed === 0) {
      toast.success(`Deshecho: ${result.behavior.name}`, { id: toastId });
    } else {
      toast.error(`No se pudo deshacer en ${failed} de ${entryIds.length} estudiante(s)`, { id: toastId });
    }
  };

  const showUndoableToast = (message: string, result: ApplyResult, toastId?: string) => {
    toast.success(
      (t) => (
        <span className="flex items-center gap-3">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              void undoAppliedBehavior(result);
            }}
            className="shrink-0 min-h-[36px] rounded-lg border border-white/40 px-3 text-sm font-semibold text-white hover:bg-white/15"
          >
            Deshacer
          </button>
        </span>
      ),
      { id: toastId, duration: 8000 },
    );
  };

  const applyBehaviorMutation = useMutation({
    mutationFn: ({ mode, ...payload }: ApplyBehaviorPayload) => behaviorApi.apply(payload),
    onMutate: (variables) => {
      const mode = variables.mode || 'default';
      if (mode === 'round_quick' || mode === 'row_quick') return {};

      const behaviorName = behaviors?.find((behavior) => behavior.id === variables.behaviorId)?.name || 'comportamiento';
      const studentCount = variables.studentIds.length;
      const studentSuffix = studentCount === 1 ? '' : 's';
      const message = mode === 'apply_to_rest'
        ? `Aplicando "${behaviorName}" a ${studentCount} estudiante${studentSuffix} restantes...`
        : `Aplicando "${behaviorName}" a ${studentCount} estudiante${studentSuffix}...`;

      return { toastId: toast.loading(message) };
    },
    onSuccess: async (result, variables, context) => {
      behaviorUsage.recordUse(result.behavior.id);
      const mode = variables.mode || 'default';
      const isRoundQuick = mode === 'round_quick';
      const roundStudentResult = result.results[0];
      const hasAutomaticBadges = Boolean(result.awardedBadges && result.awardedBadges.length > 0);

      if (isRoundQuick) {
        if (roundStudentResult && !hasAutomaticBadges) {
          const updatedCache = syncRoundQuickStudentCache(roundStudentResult);
          if (!updatedCache) {
            queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
          }
        } else {
          queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
        }
      } else {
        queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      }
      
      const behavior = result.behavior;
      const appliedPoints = result.results[0];
      const xp = Math.abs(appliedPoints?.xpChange || 0);
      const hp = Math.abs(appliedPoints?.hpChange || 0);
      const gp = Math.abs(appliedPoints?.gpChange || 0);

      // Subidas de nivel e insignias: una sola celebración (con su propio sonido).
      const celebrated = celebrateApplyResult(queryClient, classroom.id, result);
      if (!celebrated) playSound(behavior.isPositive ? 'pointsGain' : 'pointsLoss');
      
      // Detailed feedback toast
      const beh = result.behavior;
      const txp = xp;
      const thp = hp;
      const tgp = gp;
      const sign = beh.isPositive ? '+' : '-';
      const parts = [];
      if (txp > 0) parts.push(`${sign}${txp} XP`);
      if (thp > 0) parts.push(`${sign}${thp} HP`);
      if (tgp > 0) parts.push(`${sign}${tgp} GP`);
      const pointsSummary = parts.length > 0 ? parts.join(', ') : '';

      if (isRoundQuick) {
        const studentName = result.results[0]?.studentName || 'Estudiante';
        toast.success(`${studentName}: ${beh.isPositive ? '+1' : '-1'} ${beh.name}`, { duration: 1400 });

        const awardedStudentId = variables.studentIds[0];
        const pointLogEntryId = roundStudentResult?.pointLogEntryId || null;
        if (roundStudentResult) {
          appendRoundQuickHistoryEntry(result, roundStudentResult);
        }
        if (awardedStudentId) {
          setRoundQuickActivityCounts((prev) => ({
            ...prev,
            [awardedStudentId]: (prev[awardedStudentId] || 0) + 1,
          }));
          setActiveRound((prev) => {
            const matchesPositiveBehavior = prev?.positiveBehavior?.behaviorId === beh.id;
            const matchesNegativeBehavior = prev?.negativeBehavior?.behaviorId === beh.id;

            if (!prev || (!matchesPositiveBehavior && !matchesNegativeBehavior)) return prev;

            const currentAwards = prev.awardsByStudent[awardedStudentId] || { positive: 0, negative: 0 };
            return {
              ...prev,
              updatedAt: Date.now(),
              awardsByStudent: {
                ...prev.awardsByStudent,
                [awardedStudentId]: {
                  positive: currentAwards.positive + (beh.isPositive ? 1 : 0),
                  negative: currentAwards.negative + (beh.isPositive ? 0 : 1),
                },
              },
              lastAwardedAtByStudent: {
                ...prev.lastAwardedAtByStudent,
                [awardedStudentId]: Date.now(),
              },
              actions: [
                ...prev.actions,
                {
                  studentId: awardedStudentId,
                  behaviorId: beh.id,
                  isPositive: beh.isPositive,
                  pointLogEntryId,
                  timestamp: Date.now(),
                },
              ].slice(-300),
            };
          });
        }
      } else {
        const who = mode === 'row_quick'
          ? `${result.results[0]?.studentName || 'Estudiante'}: `
          : result.studentsAffected > 1 ? `${result.studentsAffected} estudiantes: ` : '';
        const resting = result.restingSkipped ? ` · ${result.restingSkipped} descansando (sin HP)` : '';
        showUndoableToast(`${who}${pointsSummary || 'Aplicado'} — ${beh.name}${resting}`, result, context?.toastId);
      }
      
      if (!isRoundQuick) {
        queryClient.invalidateQueries({ queryKey: ['history-today', classroom.id] });
      }
      
    },
    onError: (error: any, variables, context) => {
      const mode = variables.mode || 'default';
      const isRoundQuick = mode === 'round_quick';
      const message = error?.response?.data?.message || 'Error al aplicar comportamiento';

      if (mode === 'default') {
        setSelectedStudents((current) => current.size === 0 ? new Set(variables.studentIds) : current);
      }

      if (isRoundQuick || !context?.toastId) {
        toast.error(message);
      } else {
        toast.error(message, { id: context.toastId });
      }
    },
  });

  const assignClassMutation = useMutation({
    mutationFn: ({ studentId, characterClassId }: { studentId: string; characterClassId: string | null }) =>
      characterClassApi.assign(classroom.id, studentId, characterClassId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      toast.success('Clase asignada correctamente');
    },
    onError: () => {
      toast.error('Error al asignar clase');
    },
  });

  const bulkAssignClassMutation = useMutation({
    mutationFn: ({ characterClassId }: { characterClassId: string | null }) =>
      characterClassApi.bulkAssign(classroom.id, Array.from(selectedStudents), characterClassId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      setSelectedStudents(new Set());
      toast.success('Clase asignada correctamente');
    },
    onError: () => {
      toast.error('Error al asignar clase');
    },
  });


  const allStudents = classroomData?.students || [];

  const getRealStudentName = (student: Student) => [student.realName, student.realLastName].filter(Boolean).join(' ').trim();

  // Función para obtener el nombre a mostrar según configuración
  const getDisplayName = (student: Student) => {
    if (classroom.showCharacterName === false) {
      // Mostrar nombre real
      if (student.realName && student.realLastName) {
        return `${student.realName} ${student.realLastName}`;
      }
      return student.realName || student.displayName || student.characterName || 'Sin nombre';
    }
    // Mostrar nombre de personaje (por defecto)
    return student.characterName || student.displayName || getRealStudentName(student) || 'Sin nombre';
  };

  // Mapa de asistencia de hoy por studentProfileId
  const attendanceMap = new Map<string, AttendanceRecord>();
  todayAttendance.forEach(r => attendanceMap.set(r.studentProfileId, r));

  // Set de estudiantes con actividad de comportamiento hoy
  const studentsWithActivityToday = new Set<string>();
  if (todayHistory?.logs) {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 86400000;
    todayHistory.logs.forEach(log => {
      const ts = new Date(log.timestamp).getTime();
      if (ts >= todayStart && ts < todayEnd && log.type === 'POINTS') {
        studentsWithActivityToday.add(log.studentId);
      }
    });
  }
  Object.entries(roundQuickActivityCounts).forEach(([studentId, count]) => {
    if (count > 0) {
      studentsWithActivityToday.add(studentId);
    }
  });

  // Extraer lista de clanes únicos para filtro dropdown
  const uniqueClans: { id: string; name: string; color: string }[] = [];
  const seenClans = new Set<string>();
  allStudents.forEach((s: any) => {
    const clanId = s.teamId || s.clanId;
    if (clanId && s.clanName && !seenClans.has(clanId)) {
      seenClans.add(clanId);
      uniqueClans.push({ id: clanId, name: s.clanName, color: s.clanColor || '#6366f1' });
    }
  });
  uniqueClans.sort((a, b) => a.name.localeCompare(b.name, 'es'));

  // Filtrar y ordenar estudiantes alfabéticamente
  const students = allStudents.filter((student) => {
    // Filtro de búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const displayName = getDisplayName(student).toLowerCase();
      const realName = `${student.realName || ''} ${student.realLastName || ''}`.toLowerCase();
      const className = (classMap[student.characterClassId!] || classMap[student.characterClass])?.name.toLowerCase() || '';
      if (!displayName.includes(query) && !realName.includes(query) && !className.includes(query)) return false;
    }
    // Filtros de lista
    if (listFilter === 'low_hp') {
      if (student.hp <= 0 || student.hp / (classroom.maxHp || 100) >= LOW_ENERGY_RATIO) return false;
    }
    if (listFilter === 'resting') {
      if (student.hp > 0) return false;
    }
    if (listFilter === 'no_activity') {
      if (studentsWithActivityToday.has(student.id)) return false;
    }
    if (listFilter === 'round_pending') {
      if (!activeRound) return false;
      if (getRoundAwardCount(student.id) > 0) return false;
    }
    if (listFilter === 'round_scored') {
      if (!activeRound) return false;
      if (getRoundAwardCount(student.id) === 0) return false;
    }
    if (listFilter === 'round_repeated') {
      if (!activeRound) return false;
      if (getRoundAwardCount(student.id) < 2) return false;
    }
    if (clanFilter) {
      const sClan = (student as any).teamId || (student as any).clanId;
      if (sClan !== clanFilter) return false;
    }
    return true;
  }).sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), 'es'));

  const toggleStudent = (studentId: string) => {
    setSelectedStudents((current) => {
      const newSelected = new Set(current);
      if (newSelected.has(studentId)) {
        newSelected.delete(studentId);
      } else {
        newSelected.add(studentId);
      }
      return newSelected;
    });
  };

  const selectAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map((s) => s.id)));
    }
  };

  const openBehaviorModal = (type: 'positive' | 'negative') => {
    if (selectedStudents.size === 0) {
      toast.error('Selecciona al menos un estudiante');
      return;
    }
    setBehaviorType(type);
    setShowBehaviorModal(true);
  };

  const applyBehavior = (behavior: Behavior, multiplier: number = 1) => {
    const studentIds = Array.from(selectedStudents);
    if (studentIds.length === 0) {
      toast.error('Selecciona al menos un estudiante');
      return;
    }

    setShowBehaviorModal(false);
    setSelectedStudents(new Set());
    applyBehaviorMutation.mutate({
      behaviorId: behavior.id,
      studentIds,
      multiplier,
    });
  };

  const positiveBehaviors = behaviors?.filter((b) => b.isPositive) || [];
  const negativeBehaviors = behaviors?.filter((b) => !b.isPositive) || [];
  const availableNegativeRoundBehaviors = classroom.allowNegativePoints === false ? [] : negativeBehaviors;
  const allowNegativePoints = classroom.allowNegativePoints !== false;
  const quickBehaviors = useQuickBehaviors(classroom.id, positiveBehaviors, negativeBehaviors);
  const behaviorUsage = useBehaviorUsage(classroom.id);
  // Vista de tarjetas: solo los más usados (4 positivos + 2 negativos); el resto, en "Ver todos".
  const featuredBehaviors = [
    ...behaviorUsage.mostUsed(positiveBehaviors, 4),
    ...(allowNegativePoints ? behaviorUsage.mostUsed(negativeBehaviors, 2) : []),
  ];
  const hasRoundBehaviors = positiveBehaviors.length > 0 || availableNegativeRoundBehaviors.length > 0;
  const roundStorageKey = `students-active-round:${classroom.id}`;

  const buildRoundBehaviorConfig = (behavior: Behavior, multiplier: number): RoundBehaviorConfig => ({
    behaviorId: behavior.id,
    behaviorName: behavior.name,
    behaviorIcon: behavior.icon || null,
    multiplier,
  });

  function getRoundAwardCount(studentId: string) {
    const awards = activeRound?.awardsByStudent[studentId];
    return (awards?.positive || 0) + (awards?.negative || 0);
  }

  function getRoundStudentAwards(studentId: string): RoundStudentAwards {
    return activeRound?.awardsByStudent[studentId] || { positive: 0, negative: 0 };
  }

  const selectedRoundPositiveBehavior = pendingRoundPositiveBehaviorId
    ? positiveBehaviors.find((behavior) => behavior.id === pendingRoundPositiveBehaviorId) || null
    : null;
  const selectedRoundNegativeBehavior = pendingRoundNegativeBehaviorId
    ? availableNegativeRoundBehaviors.find((behavior) => behavior.id === pendingRoundNegativeBehaviorId) || null
    : null;

  useEffect(() => {
    if (!showRoundBehaviorPicker || activeRound) {
      return;
    }

    setPendingRoundPositiveBehaviorId((current) => {
      if (current && positiveBehaviors.some((behavior) => behavior.id === current)) {
        return current;
      }

      return positiveBehaviors.find((behavior) => behavior.name.toLowerCase().includes('particip'))?.id
        ?? positiveBehaviors[0]?.id
        ?? null;
    });

    setPendingRoundNegativeBehaviorId((current) => {
      if (current && availableNegativeRoundBehaviors.some((behavior) => behavior.id === current)) {
        return current;
      }

      return availableNegativeRoundBehaviors[0]?.id ?? null;
    });
  }, [showRoundBehaviorPicker, activeRound, positiveBehaviors, availableNegativeRoundBehaviors]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(roundStorageKey);
      if (!raw) {
        setActiveRound(null);
        return;
      }

      const parsed = JSON.parse(raw) as ActiveRoundState & {
        behaviorId?: string;
        behaviorName?: string;
        behaviorIcon?: string | null;
        isPositive?: boolean;
        awardsByStudent?: Record<string, number | RoundStudentAwards>;
      };

      const normalizedRound = parsed?.positiveBehavior || parsed?.negativeBehavior
        ? {
            positiveBehavior: parsed.positiveBehavior ? { ...parsed.positiveBehavior, multiplier: parsed.positiveBehavior.multiplier ?? 1 } : null,
            negativeBehavior: parsed.negativeBehavior ? { ...parsed.negativeBehavior, multiplier: parsed.negativeBehavior.multiplier ?? 1 } : null,
            startedAt: parsed.startedAt,
            updatedAt: parsed.updatedAt,
            awardsByStudent: Object.fromEntries(
              Object.entries(parsed.awardsByStudent || {}).map(([studentId, value]) => {
                if (typeof value === 'number') {
                  return [studentId, { positive: value, negative: 0 } satisfies RoundStudentAwards];
                }

                return [studentId, {
                  positive: Number(value?.positive || 0),
                  negative: Number(value?.negative || 0),
                } satisfies RoundStudentAwards];
              })
            ),
            lastAwardedAtByStudent: parsed.lastAwardedAtByStudent || {},
            actions: parsed.actions || [],
          }
        : parsed?.behaviorId && parsed?.behaviorName
          ? {
              positiveBehavior: parsed.isPositive === false
                ? null
                : {
                    behaviorId: parsed.behaviorId,
                    behaviorName: parsed.behaviorName,
                    behaviorIcon: parsed.behaviorIcon || null,
                    multiplier: 1,
                  },
              negativeBehavior: parsed.isPositive === false
                ? {
                    behaviorId: parsed.behaviorId,
                    behaviorName: parsed.behaviorName,
                    behaviorIcon: parsed.behaviorIcon || null,
                    multiplier: 1,
                  }
                : null,
              startedAt: parsed.startedAt,
              updatedAt: parsed.updatedAt,
              awardsByStudent: Object.fromEntries(
                Object.entries(parsed.awardsByStudent || {}).map(([studentId, value]) => {
                  const count = typeof value === 'number' ? value : Number((parsed.isPositive === false ? value?.negative : value?.positive) || 0);
                  return [studentId, parsed.isPositive === false
                    ? { positive: 0, negative: count }
                    : { positive: count, negative: 0 }];
                })
              ),
              lastAwardedAtByStudent: parsed.lastAwardedAtByStudent || {},
              actions: (parsed.actions || []).map((action) => ({
                ...action,
                behaviorId: action.behaviorId || parsed.behaviorId!,
                isPositive: typeof action.isPositive === 'boolean' ? action.isPositive : parsed.isPositive !== false,
              })),
            }
          : null;

      if (!normalizedRound || (!normalizedRound.positiveBehavior && !normalizedRound.negativeBehavior) || !normalizedRound.startedAt || !normalizedRound.updatedAt) {
        localStorage.removeItem(roundStorageKey);
        setActiveRound(null);
        return;
      }

      if (Date.now() - normalizedRound.updatedAt > ROUND_STORAGE_TTL_MS) {
        localStorage.removeItem(roundStorageKey);
        setActiveRound(null);
        return;
      }

      setActiveRound(normalizedRound);
    } catch {
      localStorage.removeItem(roundStorageKey);
      setActiveRound(null);
    }
  }, [roundStorageKey]);

  useEffect(() => {
    if (!activeRound) {
      localStorage.removeItem(roundStorageKey);
      return;
    }

    localStorage.setItem(
      roundStorageKey,
      JSON.stringify({
        ...activeRound,
        updatedAt: Date.now(),
      })
    );
  }, [activeRound, roundStorageKey]);

  useEffect(() => {
    if (!activeRound && (listFilter === 'round_pending' || listFilter === 'round_scored' || listFilter === 'round_repeated')) {
      setListFilter('all');
    }
  }, [activeRound, listFilter]);

  const startRound = () => {
    if (!selectedRoundPositiveBehavior && !selectedRoundNegativeBehavior) {
      toast.error('Selecciona al menos un comportamiento para iniciar la ronda');
      return;
    }

    setActiveRound({
      positiveBehavior: selectedRoundPositiveBehavior ? buildRoundBehaviorConfig(selectedRoundPositiveBehavior, pendingRoundPositiveMultiplier) : null,
      negativeBehavior: selectedRoundNegativeBehavior ? buildRoundBehaviorConfig(selectedRoundNegativeBehavior, pendingRoundNegativeMultiplier) : null,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      awardsByStudent: {},
      lastAwardedAtByStudent: {},
      actions: [],
    });
    setShowRoundBehaviorPicker(false);
    setListFilter('round_pending');
    toast.success(`Ronda iniciada${selectedRoundPositiveBehavior ? `: + ${selectedRoundPositiveBehavior.name}` : ''}${selectedRoundNegativeBehavior ? `${selectedRoundPositiveBehavior ? ' / ' : ': '}- ${selectedRoundNegativeBehavior.name}` : ''}`);
  };

  const applyRoundAward = (studentId: string, behaviorId?: string) => {
    if (!activeRound) return;

    const targetBehaviorId = behaviorId
      || activeRound.positiveBehavior?.behaviorId
      || activeRound.negativeBehavior?.behaviorId;

    if (!targetBehaviorId) return;

    const selectedBehavior = activeRound.positiveBehavior?.behaviorId === targetBehaviorId
      ? activeRound.positiveBehavior
      : activeRound.negativeBehavior?.behaviorId === targetBehaviorId
        ? activeRound.negativeBehavior
        : null;
    applyBehaviorMutation.mutate({
      behaviorId: targetBehaviorId,
      studentIds: [studentId],
      mode: 'round_quick',
      multiplier: selectedBehavior?.multiplier ?? 1,
    });
  };

  const undoLastRoundAction = async () => {
    if (!activeRound || activeRound.actions.length === 0) {
      toast.error('No hay acciones para deshacer');
      return;
    }

    const lastAction = activeRound.actions[activeRound.actions.length - 1];
    if (!lastAction.pointLogEntryId) {
      toast.error('No se pudo identificar el último registro para deshacer');
      return;
    }

    setIsUndoingRound(true);
    try {
      await historyApi.revertEntry('POINTS', lastAction.pointLogEntryId);
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['history-today', classroom.id] });
      setRoundQuickActivityCounts((prev) => {
        const currentCount = prev[lastAction.studentId] || 0;
        if (currentCount <= 1) {
          const { [lastAction.studentId]: _removed, ...rest } = prev;
          return rest;
        }

        return {
          ...prev,
          [lastAction.studentId]: currentCount - 1,
        };
      });

      setActiveRound((prev) => {
        if (!prev) return prev;
        const current = prev.awardsByStudent[lastAction.studentId] || { positive: 0, negative: 0 };
        const nextAwards = { ...prev.awardsByStudent };
        const nextStudentAwards = {
          positive: Math.max(0, current.positive - (lastAction.isPositive ? 1 : 0)),
          negative: Math.max(0, current.negative - (lastAction.isPositive ? 0 : 1)),
        };

        if (nextStudentAwards.positive === 0 && nextStudentAwards.negative === 0) delete nextAwards[lastAction.studentId];
        else nextAwards[lastAction.studentId] = nextStudentAwards;

        const nextActions = prev.actions.slice(0, -1);
        return {
          ...prev,
          awardsByStudent: nextAwards,
          actions: nextActions,
          updatedAt: Date.now(),
        };
      });

      toast.success('Última acción revertida');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'No se pudo deshacer la última acción');
    } finally {
      setIsUndoingRound(false);
    }
  };

  const finishRound = () => {
    if (!activeRound) return;

    const totalAwards = Object.values(activeRound.awardsByStudent).reduce((sum, value) => sum + value.positive + value.negative, 0);
    const studentsTouched = Object.keys(activeRound.awardsByStudent).length;
    setActiveRound(null);
    setShowRoundBehaviorPicker(false);
    setListFilter('all');
    toast.success(`Ronda finalizada: ${totalAwards} intervenciones en ${studentsTouched} estudiante(s)`);
  };

  const roundPendingCount = allStudents.filter((s) => getRoundAwardCount(s.id) === 0).length;
  const roundScoredCount = allStudents.filter((s) => getRoundAwardCount(s.id) > 0).length;
  const roundRepeatedCount = allStudents.filter((s) => getRoundAwardCount(s.id) > 1).length;
  const roundSessionTone = {
    surface: 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20',
    text: 'text-sky-700 dark:text-sky-300',
    muted: 'text-sky-700 dark:text-sky-300',
    iconAction: 'text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900/40',
    outline: 'bg-white dark:bg-gray-800 text-sky-700 dark:text-sky-200 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/30',
    flash: 'ring-1 ring-sky-300 dark:ring-sky-700 bg-sky-50/40 dark:bg-sky-900/10',
  };
  const positiveRoundPillClasses = 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
  const negativeRoundPillClasses = 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300';
  const positiveRoundButtonClasses = 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50';
  const negativeRoundButtonClasses = 'bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50';
  const roundActiveSummary = activeRound ? (
    <div className="flex flex-wrap items-center gap-1.5">
      {activeRound.positiveBehavior && (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${positiveRoundPillClasses}`}>
          <span>{activeRound.positiveBehavior.behaviorIcon || '⭐'}</span>
          <span>+ {activeRound.positiveBehavior.behaviorName} ({activeRound.positiveBehavior.multiplier}x)</span>
        </span>
      )}
      {activeRound.negativeBehavior && (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${negativeRoundPillClasses}`}>
          <span>{activeRound.negativeBehavior.behaviorIcon || '💥'}</span>
          <span>- {activeRound.negativeBehavior.behaviorName} ({activeRound.negativeBehavior.multiplier}x)</span>
        </span>
      )}
    </div>
  ) : null;
  const roundBehaviorPickerContent = (
    <div className="space-y-3">
      {positiveBehaviors.length > 0 && (
        <div className="space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Comportamiento positivo
          </p>
          {positiveBehaviors.map((behavior) => (
            <button
              key={behavior.id}
              onClick={() => setPendingRoundPositiveBehaviorId((current) => current === behavior.id ? null : behavior.id)}
              className={`w-full text-left px-2 py-2 rounded-lg border text-sm text-gray-700 dark:text-gray-200 ${pendingRoundPositiveBehaviorId === behavior.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' : 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate"><span className="mr-2">{behavior.icon || '⭐'}</span>{behavior.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${pendingRoundPositiveBehaviorId === behavior.id ? positiveRoundPillClasses : 'bg-white/80 dark:bg-gray-900/40 text-emerald-700 dark:text-emerald-300'}`}>
                  {pendingRoundPositiveBehaviorId === behavior.id ? 'Seleccionado' : 'Elegir'}
                </span>
              </div>
              {behavior.competencyIndicator && <p className="mt-1 truncate pl-6 text-xs text-sky-700 dark:text-sky-300">Destreza: {behavior.competencyIndicator.name}</p>}
            </button>
          ))}
        </div>
      )}
      {availableNegativeRoundBehaviors.length > 0 && (
        <div className="space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
            Comportamiento negativo
          </p>
          {availableNegativeRoundBehaviors.map((behavior) => (
            <button
              key={behavior.id}
              onClick={() => setPendingRoundNegativeBehaviorId((current) => current === behavior.id ? null : behavior.id)}
              className={`w-full text-left px-2 py-2 rounded-lg border text-sm text-gray-700 dark:text-gray-200 ${pendingRoundNegativeBehaviorId === behavior.id ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/30' : 'border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate"><span className="mr-2">{behavior.icon || '💥'}</span>{behavior.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${pendingRoundNegativeBehaviorId === behavior.id ? negativeRoundPillClasses : 'bg-white/80 dark:bg-gray-900/40 text-rose-700 dark:text-rose-300'}`}>
                  {pendingRoundNegativeBehaviorId === behavior.id ? 'Seleccionado' : 'Elegir'}
                </span>
              </div>
              {behavior.competencyIndicator && <p className="mt-1 truncate pl-6 text-xs text-sky-700 dark:text-sky-300">Destreza: {behavior.competencyIndicator.name}</p>}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
        <p className="font-semibold text-gray-700 dark:text-gray-200">Configuración de la ronda</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedRoundPositiveBehavior ? (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${positiveRoundPillClasses}`}>
              <span>{selectedRoundPositiveBehavior.icon || '⭐'}</span>
              <span>+ {selectedRoundPositiveBehavior.name}</span>
              <select value={pendingRoundPositiveMultiplier} onChange={(event) => setPendingRoundPositiveMultiplier(Number(event.target.value))} className="bg-transparent text-xs font-semibold outline-none">
                <option value={1}>1x</option><option value={0.5}>1/2</option><option value={0.25}>1/4</option><option value={0.125}>1/8</option>
              </select>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              Sin positivo
            </span>
          )}
          {selectedRoundNegativeBehavior ? (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${negativeRoundPillClasses}`}>
              <span>{selectedRoundNegativeBehavior.icon || '💥'}</span>
              <span>- {selectedRoundNegativeBehavior.name}</span>
              <select value={pendingRoundNegativeMultiplier} onChange={(event) => setPendingRoundNegativeMultiplier(Number(event.target.value))} className="bg-transparent text-xs font-semibold outline-none">
                <option value={1}>1x</option><option value={0.5}>1/2</option><option value={0.25}>1/4</option><option value={0.125}>1/8</option>
              </select>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              Sin negativo
            </span>
          )}
        </div>
      </div>
      <Button
        onClick={startRound}
        disabled={!selectedRoundPositiveBehavior && !selectedRoundNegativeBehavior}
        className="w-full bg-gradient-to-r from-sky-500 to-primary-500 hover:from-sky-600 hover:to-primary-600 text-white"
      >
        Iniciar ronda
      </Button>
    </div>
  );

  // Funciones para estudiantes placeholder
  const copyLinkCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado al portapapeles');
  };

  // Verificar si un estudiante es placeholder (tiene linkCode)
  const getStudentLinkCode = (studentId: string): string | null => {
    const student = allStudents.find((item) => item.id === studentId);
    return student?.linkCode || null;
  };

  // Calcular top estudiante (sobre TODOS los estudiantes, no los filtrados)
  const topStudent = allStudents.length > 0 
    ? [...allStudents].sort((a, b) => b.xp - a.xp)[0]
    : null;
  const lowHpCount = allStudents.filter((s) => s.hp > 0 && s.hp / (classroom.maxHp || 100) < LOW_ENERGY_RATIO).length;
  const restingCount = allStudents.filter((s) => s.hp <= 0).length;
  const attendanceMarkedCount = todayAttendance.length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${(viewMode === 'list' || viewMode === 'clans') && selectedStudents.size > 0 ? 'pb-24' : ''}`}>
      {/* Barra de acciones */}
      <div className="bg-white dark:bg-gray-800 rounded-xl px-3 sm:px-4 py-2.5 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex flex-wrap items-center gap-2 min-w-0 xl:flex-1">
          {/* Controles de ronda rápida */}
          {viewMode === 'list' && hasRoundBehaviors && (
            <div className="hidden md:flex items-center min-w-0">
              {!activeRound ? (
                <div className="relative">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowRoundBehaviorPicker((prev) => !prev)}
                    className="!bg-primary-600 hover:!bg-primary-700 !text-white text-sm px-3 py-2"
                  >
                    <PlayCircle size={14} />
                    <span className="ml-1">Iniciar ronda</span>
                  </Button>
                  {showRoundBehaviorPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowRoundBehaviorPicker(false)} />
                      <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 p-2">
                        <p className="px-2 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                          Elegir comportamiento de ronda
                        </p>
                        <p className="px-2 pb-2 text-xs text-gray-500 dark:text-gray-400">
                          Elige un comportamiento positivo o negativo para puntuar en un toque.
                        </p>
                        <div className="max-h-64 overflow-y-auto pr-1">
                          {roundBehaviorPickerContent}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 max-w-full ${roundSessionTone.surface}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold ${roundSessionTone.text}`}>Ronda activa</p>
                    {roundActiveSummary}
                  </div>
                  <span className={`text-xs font-medium ${roundSessionTone.muted}`}>
                    {roundScoredCount}/{allStudents.length}
                  </span>
                  <button
                    onClick={undoLastRoundAction}
                    disabled={activeRound.actions.length === 0 || isUndoingRound}
                    className={`p-1 rounded-md disabled:opacity-40 ${roundSessionTone.iconAction}`}
                    title="Deshacer última acción"
                  >
                    <RotateCcw size={14} className={isUndoingRound ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={finishRound}
                    className={`px-2 py-1 rounded-md text-xs font-medium ${roundSessionTone.outline}`}
                  >
                    Finalizar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Contexto de clase - Vista tarjetas */}
          {viewMode === 'cards' && (
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {!projecting && restingCount > 0 && (
                <button
                  type="button"
                  onClick={() => { setListFilter(listFilter === 'resting' ? 'all' : 'resting'); setClanFilter(null); }}
                  aria-pressed={listFilter === 'resting'}
                  title="Mostrar solo alumnos sin energía"
                  className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border text-sm font-semibold transition-colors ${
                    listFilter === 'resting'
                      ? 'bg-slate-700 border-slate-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <Moon size={14} className="fill-current" aria-hidden="true" />
                  Descansando ({restingCount})
                </button>
              )}
              {!projecting && (
              <button
                type="button"
                onClick={() => { setListFilter(listFilter === 'low_hp' ? 'all' : 'low_hp'); setClanFilter(null); }}
                aria-pressed={listFilter === 'low_hp'}
                title="Mostrar solo alumnos con HP bajo"
                className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border text-sm font-semibold transition-colors ${
                  listFilter === 'low_hp'
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-white dark:bg-gray-800 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
                }`}
              >
                <Heart size={14} aria-hidden="true" />
                HP bajo ({lowHpCount})
              </button>
              )}
              <button
                type="button"
                onClick={() => navigate(`/classroom/${classroom.id}/attendance`)}
                title="Tomar asistencia"
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Users size={14} aria-hidden="true" />
                Asistencia {attendanceMarkedCount}/{allStudents.length}
              </button>
            </div>

          )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 ml-auto">
            <button
              type="button"
              onClick={() => setProjecting(!projecting)}
              aria-pressed={projecting}
              title={projecting ? 'Se oculta la energía y quién descansa' : 'Ocultar la energía al proyectar la Lista'}
              className={`inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold ${projecting ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'}`}
            >
              <Monitor size={16} aria-hidden="true" /> Proyectando
            </button>
            <TodayLevelUps
              classroomId={classroom.id}
              nameOf={(studentId, fallback) => {
                const s = allStudents.find((st) => st.id === studentId);
                return s ? getDisplayName(s) : fallback || 'Estudiante';
              }}
            />
            <StudentsManageMenu classroomId={classroom.id} onAddStudents={() => setShowAddPlaceholderModal(true)} />
            {/* Toggle de vista - Siempre visible, al final */}
            <div className="flex items-center bg-primary-100 dark:bg-primary-900/30 rounded-lg p-0.5 border border-primary-200 dark:border-primary-800 flex-shrink-0">
              <button
                onClick={() => setViewMode('cards')}
                aria-label="Vista de tarjetas"
                aria-pressed={viewMode === 'cards'}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'cards' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200'
                }`}
                title="Vista de tarjetas"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                aria-label="Vista de lista"
                aria-pressed={viewMode === 'list'}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200'
                }`}
                title="Vista de lista"
              >
                <List size={18} />
              </button>
              {classroom.clansEnabled && (
                <button
                  onClick={() => setViewMode('clans')}
                  aria-label="Vista por clanes"
                  aria-pressed={viewMode === 'clans'}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'clans' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200'
                  }`}
                  title="Vista por clanes"
                >
                  <Shield size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'list' && (
        <div className="md:hidden bg-white dark:bg-gray-800 rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-700 shadow-sm">
          {!activeRound ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Inicia una ronda para aplicar comportamientos positivos o negativos en un toque por estudiante.
                </p>
                {hasRoundBehaviors && (
                  <button
                    onClick={() => setShowRoundBehaviorPicker((prev) => !prev)}
                    className="md:hidden inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
                  >
                    <PlayCircle size={14} />
                    Iniciar ronda
                  </button>
                )}
              </div>
              {showRoundBehaviorPicker && (
                <div className="md:hidden mt-1 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                  <div className="max-h-56 overflow-y-auto pr-1">
                    {roundBehaviorPickerContent}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${roundSessionTone.surface}`}>
              <div className="space-y-1">
                <div className={`text-sm font-semibold ${roundSessionTone.text}`}>Ronda activa</div>
                {roundActiveSummary}
                <div className={`text-xs ${roundSessionTone.muted}`}>{roundScoredCount} de {allStudents.length} estudiantes</div>
              </div>
              <div className="md:hidden flex items-center gap-2">
                <button
                  onClick={undoLastRoundAction}
                  disabled={activeRound.actions.length === 0 || isUndoingRound}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-50 ${roundSessionTone.outline}`}
                >
                  <RotateCcw size={13} className={isUndoingRound ? 'animate-spin' : ''} />
                  Deshacer
                </button>
                <button
                  onClick={finishRound}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg bg-sky-700 text-white text-sm font-medium hover:bg-sky-800"
                >
                  Finalizar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista de estudiantes - Grid de Cards RPG */}
      {allStudents.length === 0 ? (
        <Card className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-primary-100 rounded-2xl flex items-center justify-center">
            <Users className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            Agrega estudiantes a tu clase
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm mb-2 max-w-md mx-auto">
            Agrega estudiantes a tu clase para empezar a gamificarla. Puedes hacerlo uno por uno o compartiendo el código de clase.
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            Código: <span className="font-mono font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded">{classroom.code}</span>
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowAddPlaceholderModal(true)}
            >
              <Users className="w-4 h-4 mr-2" />
              Agregar estudiante
            </Button>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-4">
            Los estudiantes también pueden unirse con el código de clase desde su cuenta
          </p>
        </Card>
      ) : (
        <>
          {/* Vista de Cards - Layout Dividido */}
          {viewMode === 'cards' && allStudents.length > 0 && (
            <StudentFocusView
              classroom={classroom}
              students={students}
              selectedStudentId={selectedStudentId}
              onSelectStudent={setSelectedStudentId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              characterClasses={characterClasses}
              classMap={classMap}
              topStudentId={topStudent?.id ?? null}
              getDisplayName={getDisplayName}
              getStudentLinkCode={getStudentLinkCode}
              onCopyLinkCode={copyLinkCode}
              featuredBehaviors={featuredBehaviors}
              totalBehaviors={positiveBehaviors.length + (allowNegativePoints ? negativeBehaviors.length : 0)}
              isApplying={applyBehaviorMutation.isPending}
              onApplyBehavior={(behavior, studentId) => applyBehaviorMutation.mutate({
                behaviorId: behavior.id,
                studentIds: [studentId],
                mode: 'row_quick',
              })}
              onOpenAllBehaviors={(studentId) => {
                setSelectedStudents(new Set([studentId]));
                setBehaviorType('positive');
                setShowBehaviorModal(true);
              }}
              onRecovery={(studentId) => {
                const s = allStudents.find((st) => st.id === studentId);
                if (s) setRecoveryFor({ id: s.id, name: getDisplayName(s) });
              }}
              onAwardBadge={(studentId) => {
                setSelectedStudents(new Set([studentId]));
                setShowBadgeModal(true);
              }}
              onViewProfile={(studentId) => navigate(`/classroom/${classroom.id}/student/${studentId}`)}
              onAssignClass={(studentId, characterClassId) => assignClassMutation.mutate({ studentId, characterClassId })}
              storyTheme={storyTheme}
              isThemeDark={isThemeDark}
            />
          )}

          {/* Vista de Lista */}
          {viewMode === 'list' && (
            <Card className="overflow-hidden !p-0">
              {/* Barra de búsqueda + filtros */}
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar estudiante..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-56 pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  {/* Filtros */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => { setListFilter('all'); setClanFilter(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        listFilter === 'all' && !clanFilter
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-700'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      Todos ({allStudents.length})
                    </button>
                    {!projecting && restingCount > 0 && (
                      <button
                        onClick={() => { setListFilter('resting'); setClanFilter(null); }}
                        aria-pressed={listFilter === 'resting'}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                          listFilter === 'resting'
                            ? 'bg-slate-700 text-white border border-slate-700'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        <Moon size={12} className="fill-current" aria-hidden="true" /> Descansando ({restingCount})
                      </button>
                    )}
                    {!projecting && (
                    <button
                      onClick={() => { setListFilter('low_hp'); setClanFilter(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                        listFilter === 'low_hp'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Heart size={12} /> HP bajo
                    </button>
                    )}
                    <button
                      onClick={() => { setListFilter('no_activity'); setClanFilter(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        listFilter === 'no_activity'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      Sin actividad hoy
                    </button>
                    {activeRound && (
                      <>
                        <button
                          onClick={() => { setListFilter('round_pending'); setClanFilter(null); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            listFilter === 'round_pending'
                              ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700'
                              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}
                        >
                          Pendientes ({roundPendingCount})
                        </button>
                        <button
                          onClick={() => { setListFilter('round_scored'); setClanFilter(null); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            listFilter === 'round_scored'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}
                        >
                          Ya puntuados ({roundScoredCount})
                        </button>
                        <button
                          onClick={() => { setListFilter('round_repeated'); setClanFilter(null); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            listFilter === 'round_repeated'
                              ? 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-300 dark:border-fuchsia-700'
                              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}
                        >
                          Repetidos x2+ ({roundRepeatedCount})
                        </button>
                      </>
                    )}
                    {classroom.clansEnabled && uniqueClans.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setShowClanDropdown(!showClanDropdown)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                            clanFilter
                              ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700'
                              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}
                        >
                          <Shield size={12} />
                          {clanFilter ? uniqueClans.find(c => c.id === clanFilter)?.name || 'Clan' : 'Por clan'}
                          <ChevronDown size={12} />
                        </button>
                        {showClanDropdown && (
                          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 min-w-[160px] py-1">
                            {uniqueClans.map(clan => (
                              <button
                                key={clan.id}
                                onClick={() => { setClanFilter(clan.id); setListFilter('all'); setShowClanDropdown(false); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              >
                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: clan.color }} />
                                {clan.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {!activeRound && (
                    <div className="ml-auto">
                      <QuickBehaviorPicker
                        positives={positiveBehaviors}
                        negatives={negativeBehaviors}
                        positive={quickBehaviors.positive}
                        negative={quickBehaviors.negative}
                        allowNegative={allowNegativePoints}
                        onPositiveChange={quickBehaviors.setPositiveId}
                        onNegativeChange={quickBehaviors.setNegativeId}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Seleccionar todos */}
              {students.length > 0 && (
                <div
                  onClick={selectAll}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 cursor-pointer hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-colors"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                    selectedStudents.size === students.length && students.length > 0 ? 'bg-primary-600 border-primary-600' : 'border-gray-300 dark:border-gray-500'
                  }`}>
                    {selectedStudents.size === students.length && students.length > 0 && <Check size={12} className="text-white" />}
                    {selectedStudents.size > 0 && selectedStudents.size < students.length && <div className="w-2 h-2 bg-primary-600 rounded-sm" />}
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Seleccionar todos los <span className="font-semibold">{students.length}</span> estudiantes
                  </span>
                  {selectedStudents.size > 0 && (
                    <span className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full font-medium">
                      {selectedStudents.size} seleccionado{selectedStudents.size !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}

              {students.length === 0 && (searchQuery.trim() || listFilter !== 'all' || clanFilter) ? (
                <div className="text-center py-12 px-4">
                  <Search className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-1">
                    No se encontraron resultados
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    No hay estudiantes que coincidan con "<span className="font-medium">{searchQuery}</span>"
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px]">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Estudiante</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Nivel</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">XP</th>
                    {!projecting && <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Energía</th>}
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">GP</th>
                    {activeRound && (
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Ronda</th>
                    )}
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {students.map((student) => {
                    const classInfo = (student.characterClassId && characterClasses.find(c => c.id === student.characterClassId)) || classMap[student.characterClass];
                    const isSelected = selectedStudents.has(student.id);
                    const isTopStudent = topStudent?.id === student.id;
                    const studentRoundAwards = getRoundStudentAwards(student.id);
                    const roundCount = getRoundAwardCount(student.id);
                    const lastAwardedAt = activeRound?.lastAwardedAtByStudent[student.id] || 0;
                    const justAwarded = lastAwardedAt > 0 && Date.now() - lastAwardedAt < 4500;

                    return (
                      <tr 
                        key={student.id}
                        onClick={() => toggleStudent(student.id)}
                        className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isSelected ? 'bg-primary-50 dark:bg-primary-900/30' : ''} ${justAwarded ? roundSessionTone.flash : ''}`}
                      >
                        {/* Estudiante */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {/* Checkbox inline */}
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                              isSelected ? 'bg-primary-600 border-primary-600' : 'border-gray-300 dark:border-gray-600'
                            }`}>
                              {isSelected && <Check size={12} className="text-white" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-800 dark:text-white">{getDisplayName(student)}</span>
                                {isTopStudent && <Crown size={14} className="text-amber-500" />}
                              </div>
                              {(getRealStudentName(student) || accessLabel(student)) && (
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                  {getRealStudentName(student) && (
                                    <span className="text-gray-500 dark:text-gray-400">{getRealStudentName(student)}</span>
                                  )}
                                  {accessLabel(student) && (
                                    <span className="text-gray-500 dark:text-gray-400">{accessLabel(student)}</span>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                {/* Attendance indicator dot */}
                                {(() => {
                                  const att = attendanceMap.get(student.id);
                                  const dotColor = att
                                    ? (att.status === 'PRESENT' || att.status === 'LATE') ? 'bg-emerald-500' : 'bg-red-500'
                                    : 'bg-gray-300 dark:bg-gray-600';
                                  const dotTitle = att
                                    ? att.status === 'PRESENT' ? 'Presente hoy' : att.status === 'LATE' ? 'Tarde hoy' : att.status === 'EXCUSED' ? 'Justificado' : 'Ausente hoy'
                                    : 'Sin registrar';
                                  return <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} title={dotTitle} />;
                                })()}
                                <span className="text-lg leading-none">{classInfo?.icon || '🎮'}</span>
                                <span>{classInfo?.name || 'Sin clase'}</span>
                                {(() => {
                                  const att = attendanceMap.get(student.id);
                                  const label = att
                                    ? att.status === 'PRESENT' ? 'Presente hoy' : att.status === 'LATE' ? 'Tarde hoy' : att.status === 'EXCUSED' ? 'Justificado' : 'Ausente hoy'
                                    : null;
                                  return label ? <><span className="text-gray-300">·</span><span className="text-xs">{label}</span></> : null;
                                })()}
                                {classroom.clansEnabled && (
                                  <>
                                    <span className="text-gray-300">•</span>
                                    {(student as any).clanName ? (
                                      <span 
                                        className="px-1.5 py-0.5 rounded text-xs font-medium text-gray-800 dark:text-gray-100"
                                        style={{ backgroundColor: `${(student as any).clanColor || '#6366f1'}33` }}
                                      >
                                        {(student as any).clanName}
                                      </span>
                                    ) : (
                                      <span className="text-gray-500 dark:text-gray-400 italic">Sin clan</span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Nivel */}
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-sm font-medium">
                            <Star size={12} className="fill-amber-500 text-amber-500" />
                            {student.level}
                          </div>
                        </td>

                        {/* XP */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                            <Sparkles size={14} />
                            {student.xp}
                          </div>
                        </td>

                        {/* Energía (HP): luna si descansa → misión de recuperación */}
                        {!projecting && (
                          <td className="px-4 py-3">
                            {student.hp <= 0 ? (
                              <button type="button"
                                onClick={(e) => { e.stopPropagation(); setRecoveryFor({ id: student.id, name: getDisplayName(student) }); }}
                                className="inline-flex min-h-[36px] items-center rounded-full hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-500"
                                aria-label={`${getDisplayName(student)} está descansando: misión de recuperación`}>
                                <EnergyMeter hp={student.hp} maxHp={classroom.maxHp || 100} initial={initialLevel} />
                              </button>
                            ) : (
                              <EnergyMeter hp={student.hp} maxHp={classroom.maxHp || 100} initial={initialLevel} />
                            )}
                          </td>
                        )}

                        {/* GP */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                            <Coins size={14} />
                            {student.gp}
                          </div>
                        </td>

                        {activeRound && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                              {roundCount === 0 ? (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
                                  Pendiente
                                </span>
                              ) : (
                                <>
                                  {studentRoundAwards.positive > 0 && (
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${positiveRoundPillClasses}`}>
                                      +{studentRoundAwards.positive}
                                    </span>
                                  )}
                                  {studentRoundAwards.negative > 0 && (
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${negativeRoundPillClasses}`}>
                                      -{studentRoundAwards.negative}
                                    </span>
                                  )}
                                </>
                              )}
                              {activeRound.positiveBehavior && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    applyRoundAward(student.id, activeRound.positiveBehavior?.behaviorId);
                                  }}
                                  disabled={applyBehaviorMutation.isPending}
                                  className={`min-h-[32px] min-w-[40px] px-2 rounded-lg text-sm font-bold disabled:opacity-50 ${positiveRoundButtonClasses}`}
                                  title={`Aplicar ${activeRound.positiveBehavior.behaviorName}`}
                                >
                                  +1
                                </button>
                              )}
                              {activeRound.negativeBehavior && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    applyRoundAward(student.id, activeRound.negativeBehavior?.behaviorId);
                                  }}
                                  disabled={applyBehaviorMutation.isPending}
                                  className={`min-h-[32px] min-w-[40px] px-2 rounded-lg text-sm font-bold disabled:opacity-50 ${negativeRoundButtonClasses}`}
                                  title={`Aplicar ${activeRound.negativeBehavior.behaviorName}`}
                                >
                                  -1
                                </button>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Acciones: +/− rápidos (fuera de ronda) y perfil */}
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-2">
                            {!activeRound && (
                              <QuickPointButtons
                                studentName={getDisplayName(student)}
                                positive={quickBehaviors.positive}
                                negative={quickBehaviors.negative}
                                allowNegative={allowNegativePoints}
                                disabled={applyBehaviorMutation.isPending}
                                onApply={(behavior) => applyBehaviorMutation.mutate({
                                  behaviorId: behavior.id,
                                  studentIds: [student.id],
                                  mode: 'row_quick',
                                })}
                              />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/classroom/${classroom.id}/student/${student.id}`);
                              }}
                              className="inline-flex items-center gap-1 min-h-[36px] px-2 rounded-lg text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 text-sm font-medium"
                            >
                              <Eye size={14} aria-hidden="true" />
                              Perfil
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Vista por Clanes */}
          {viewMode === 'clans' && allStudents.length > 0 && (() => {
            // Agrupar estudiantes por clan
            const studentsByClan: Record<string, { 
              clanId: string | null; 
              clanName: string; 
              clanColor: string; 
              clanEmblem: string;
              students: typeof students 
            }> = {};
            
            students.forEach((student: any) => {
              const clanId = student.teamId || student.clanId || 'sin-clan';
              const clanName = student.clanName || 'Sin Clan';
              const clanColor = student.clanColor || '#6b7280';
              const clanEmblem = CLAN_EMBLEMS[student.clanEmblem] || '🛡️';
              
              if (!studentsByClan[clanId]) {
                studentsByClan[clanId] = { clanId, clanName, clanColor, clanEmblem, students: [] };
              }
              studentsByClan[clanId].students.push(student);
            });

            // Ordenar: primero los clanes, luego sin clan
            const sortedClans = Object.values(studentsByClan).sort((a, b) => {
              if (a.clanId === 'sin-clan') return 1;
              if (b.clanId === 'sin-clan') return -1;
              return a.clanName.localeCompare(b.clanName);
            });

            return (
              <div className="space-y-6">
                {students.length === 0 && searchQuery.trim() && (
                  <Card className="text-center py-12 px-4">
                    <Search className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-1">
                      No se encontraron resultados
                    </h3>
                    <p className="text-sm text-gray-500">
                      No hay estudiantes que coincidan con "<span className="font-medium">{searchQuery}</span>"
                    </p>
                  </Card>
                )}
                {sortedClans.map((clan) => {
                  const clanStudentIds = clan.students.map(s => s.id);
                  const allClanSelected = clanStudentIds.every(id => selectedStudents.has(id));
                  const someClanSelected = clanStudentIds.some(id => selectedStudents.has(id));

                  const toggleClanSelection = () => {
                    const newSelected = new Set(selectedStudents);
                    if (allClanSelected) {
                      clanStudentIds.forEach(id => newSelected.delete(id));
                    } else {
                      clanStudentIds.forEach(id => newSelected.add(id));
                    }
                    setSelectedStudents(newSelected);
                  };

                  return (
                    <Card key={clan.clanId} className="overflow-hidden !p-0">
                      {/* Header del Clan */}
                      <div 
                        className="p-4 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: clan.clanId !== 'sin-clan' ? clan.clanColor : '#6b7280' }}
                        onClick={toggleClanSelection}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                            {clan.clanEmblem}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-white">{clan.clanName}</h3>
                            <p className="text-sm text-white/80">{clan.students.length} estudiante{clan.students.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                            allClanSelected 
                              ? 'bg-white border-white' 
                              : someClanSelected 
                                ? 'bg-white/50 border-white' 
                                : 'border-white/50 hover:border-white'
                          }`}>
                            {allClanSelected && <Check size={14} className="text-gray-800" />}
                            {someClanSelected && !allClanSelected && <div className="w-2 h-2 bg-gray-800 rounded-sm" />}
                          </div>
                          <span className="text-sm text-white/80 font-medium">
                            {allClanSelected ? 'Todos seleccionados' : 'Seleccionar todos'}
                          </span>
                        </div>
                      </div>

                      {/* Lista de estudiantes del clan */}
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {clan.students.map((student) => {
                          const isSelected = selectedStudents.has(student.id);
                          const classInfo = (student.characterClassId && characterClasses.find(c => c.id === student.characterClassId)) || classMap[student.characterClass];

                          return (
                            <div 
                              key={student.id}
                              className={`p-4 flex items-center gap-4 cursor-pointer transition-colors ${
                                isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                              }`}
                              onClick={() => toggleStudent(student.id)}
                            >
                              {/* Checkbox */}
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                isSelected 
                                  ? 'bg-primary-600 border-primary-600' 
                                  : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                              }`}>
                                {isSelected && <Check size={12} className="text-white" />}
                              </div>

                              {/* Avatar */}
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-primary-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                                <StudentAvatarMini
                                  studentProfileId={student.id}
                                  gender={student.avatarGender || 'MALE'}
                                  size="xl"
                                  className="scale-[0.22] origin-top"
                                />
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 dark:text-white truncate">
                                  {getDisplayName(student)}
                                </p>
                                {getRealStudentName(student) && (
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                    <span className="text-gray-500 dark:text-gray-400 truncate">{getRealStudentName(student)}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span className="text-base">{classInfo?.icon}</span>
                                  <span>{classInfo?.name}</span>
                                  <span className="text-gray-300">•</span>
                                  <span>Nv. {student.level}</span>
                                </div>
                              </div>

                              {/* Stats */}
                              <div className="hidden sm:flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                  <Sparkles size={14} className="text-yellow-500" />
                                  <span className="font-medium">{student.xp}</span>
                                </div>
                                {!projecting && <EnergyMeter hp={student.hp} maxHp={classroom.maxHp || 100} initial={initialLevel} />}
                                <div className="flex items-center gap-1">
                                  <Coins size={14} className="text-amber-500" />
                                  <span className="font-medium">{student.gp}</span>
                                </div>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/classroom/${classroom.id}/student/${student.id}`);
                                }}
                                className="text-primary-600 hover:text-primary-700 p-2"
                              >
                                <Eye size={18} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>
            );
          })()}
        </>
      )}

      {/* Acciones para la selección: fijas al pie mientras haya alumnos seleccionados */}
      {(viewMode === 'list' || viewMode === 'clans') && (
        <SelectionActionBar
          count={selectedStudents.size}
          allowNegative={allowNegativePoints}
          characterClasses={characterClasses}
          onGive={() => openBehaviorModal('positive')}
          onRemove={() => openBehaviorModal('negative')}
          onBadge={() => setShowBadgeModal(true)}
          onAssignClass={(characterClassId) => bulkAssignClassMutation.mutate({ characterClassId })}
          onClear={() => setSelectedStudents(new Set())}
        />
      )}

      {/* Modal de puntos con tabs */}
      <PointsModal
        isOpen={showBehaviorModal}
        onClose={() => {
          setShowBehaviorModal(false);
          if (viewMode === 'cards') setSelectedStudents(new Set());
        }}
        isPositive={behaviorType === 'positive'}
        selectedCount={selectedStudents.size}
        selectedStudentNames={Array.from(selectedStudents).map(id => {
          const s = allStudents.find(st => st.id === id);
          return s ? getDisplayName(s) : 'Estudiante';
        })}
        behaviors={allowNegativePoints ? (behaviors || []) : positiveBehaviors}
        onApplyBehavior={applyBehavior}
        classroom={classroom}
        onApplyManual={async (pointType, amount, reason, competencyId) => {
          // Aplicar manualmente a todos los estudiantes seleccionados
          const levelUps: Array<{ studentId: string; studentName: string; from: number; to: number }> = [];
          let restingIgnored = 0;
          
          for (const studentId of selectedStudents) {
            const result = await studentApi.updatePoints(studentId, {
              pointType,
              amount: behaviorType === 'positive' ? amount : -amount,
              reason,
              competencyId,
            });
            
            if (result.restingIgnored) restingIgnored += 1;
            // Verificar si hubo subida de nivel
            if (result.leveledUp && result.newLevel) {
              levelUps.push({
                studentId,
                studentName: result.studentName,
                from: result.fromLevel ?? result.newLevel - 1,
                to: result.newLevel,
              });
            }
          }
          
          queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
          setSelectedStudents(new Set());
          setShowBehaviorModal(false);
          toast.success(`Puntos aplicados a ${selectedStudents.size} estudiante(s)${restingIgnored ? ` · ${restingIgnored} descansando: su energía vuelve con la misión de recuperación` : ''}`);
          
          celebrateLevelUps(queryClient, classroom.id, levelUps, reason || undefined);
        }}
        isLoading={applyBehaviorMutation.isPending}
        classroomId={classroom.id}
      />

      {/* Modal de insignias */}
      <GiveBadgeModal
        isOpen={showBadgeModal}
        onClose={() => setShowBadgeModal(false)}
        classroomId={classroom.id}
        selectedStudentIds={Array.from(selectedStudents)}
        studentNames={Array.from(selectedStudents).map(id => {
          const student = allStudents.find(s => s.id === id);
          return student ? getDisplayName(student) : 'Estudiante';
        })}
        onSuccess={(badge, names) => {
          setSelectedStudents(new Set());
          setShowBadgeModal(false);
          celebrateBadgeAward(badge, names);
        }}
      />


      {recoveryFor && (
        <RecoveryMissionModal
          classroomId={classroom.id}
          studentId={recoveryFor.id}
          studentName={recoveryFor.name}
          initial={initialLevel}
          onClose={() => setRecoveryFor(null)}
        />
      )}

      {/* Modal para añadir estudiantes placeholder */}
      <AddPlaceholderStudentsModal
        isOpen={showAddPlaceholderModal}
        onClose={() => setShowAddPlaceholderModal(false)}
        classroomId={classroom.id}
        onStudentsCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
          queryClient.invalidateQueries({ queryKey: ['placeholder-students', classroom.id] });
        }}
      />

    </div>
  );
};
