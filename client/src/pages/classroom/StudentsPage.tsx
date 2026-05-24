import { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Sparkles,
  Heart,
  Coins,
  Check,
  X,
  Zap,
  Crown,
  Star,
  Search,
  LayoutGrid,
  List,
  Eye,
  Medal,
  Link2,
  Copy,
  ChevronLeft,
  Shield,
  Award,
  AlertTriangle,
  ChevronDown,
  PlayCircle,
  RotateCcw,
  Wrench,
  Swords,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StudentAvatarMini } from '../../components/avatar/StudentAvatarMini';
import { classroomApi, type Classroom, type Student } from '../../lib/classroomApi';
import { behaviorApi, type ApplyResult, type Behavior } from '../../lib/behaviorApi';
import { studentApi } from '../../lib/studentApi';
import { useCharacterClasses } from '../../hooks/useCharacterClasses';
import { characterClassApi } from '../../lib/characterClassApi';
import { badgeApi, type Badge, RARITY_COLORS, RARITY_LABELS } from '../../lib/badgeApi';
import { CLAN_EMBLEMS } from '../../lib/clanApi';
import { attendanceApi, type AttendanceRecord } from '../../lib/attendanceApi';
import { historyApi, type ActivityLogEntry, type HistoryResponse } from '../../lib/historyApi';
import { LevelUpAnimation } from '../../components/effects/LevelUpAnimation';
import { MultiPointsAnimation, useMultiPointsEffect } from '../../components/effects/PurchaseEffects';
import { TeacherBadgeAwardedModal } from '../../components/badges/TeacherBadgeAwardedModal';
import { AddPlaceholderStudentsModal } from '../../components/students/AddPlaceholderStudentsModal';
import { ClassroomUtilities } from '../../components/classroom/ClassroomUtilities';
import { PointsModal } from '../../components/modals/PointsModal';
import { useSound } from '../../hooks/useSound';
import { classNoteApi } from '../../lib/classNoteApi';
import toast from 'react-hot-toast';

type ListFilter = 'all' | 'low_hp' | 'no_activity' | 'round_pending' | 'round_scored' | 'round_repeated';

type RoundBehaviorConfig = {
  behaviorId: string;
  behaviorName: string;
  behaviorIcon: string | null;
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
  
  // Estado para animación de subida de nivel
  const [, setLevelUpQueue] = useState<Array<{ studentName: string; newLevel: number }>>([]);
  const [currentLevelUp, setCurrentLevelUp] = useState<{ studentName: string; newLevel: number } | null>(null);
  
  // Estado para modal de insignias otorgadas automáticamente
  const [awardedBadgeInfo, setAwardedBadgeInfo] = useState<{
    badge: Badge | null;
    studentNames: string[];
  }>({ badge: null, studentNames: [] });

  // Estado para modal de añadir estudiantes placeholder
  const [showAddPlaceholderModal, setShowAddPlaceholderModal] = useState(false);

  // Estado para filtros de vista lista
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [clanFilter, setClanFilter] = useState<string | null>(null);
  const [showClanDropdown, setShowClanDropdown] = useState(false);
  const [showRoundBehaviorPicker, setShowRoundBehaviorPicker] = useState(false);
  const [pendingRoundPositiveBehaviorId, setPendingRoundPositiveBehaviorId] = useState<string | null>(null);
  const [pendingRoundNegativeBehaviorId, setPendingRoundNegativeBehaviorId] = useState<string | null>(null);
  const [activeRound, setActiveRound] = useState<ActiveRoundState | null>(null);
  const [isUndoingRound, setIsUndoingRound] = useState(false);
  const [roundQuickActivityCounts, setRoundQuickActivityCounts] = useState<Record<string, number>>({});

  const [showUtilities, setShowUtilities] = useState(false);
  const [showBulkClassMenu, setShowBulkClassMenu] = useState(false);

  // Hook para animación de puntos
  const { effect: pointsEffect, showMultiPointsEffect, hideMultiPointsEffect } = useMultiPointsEffect();

  const { data: classroomData, isLoading } = useQuery({
    queryKey: ['classroom', classroom.id],
    queryFn: () => classroomApi.getById(classroom.id),
  });

  const { data: behaviors } = useQuery({
    queryKey: ['behaviors', classroom.id],
    queryFn: () => behaviorApi.getByClassroom(classroom.id),
  });

  const { data: pendingNotesCount = 0 } = useQuery({
    queryKey: ['class-notes-count', classroom.id],
    queryFn: () => classNoteApi.pendingCount(classroom.id),
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

  type ApplyBehaviorMode = 'default' | 'round_quick' | 'apply_to_rest';
  type ApplyBehaviorPayload = {
    behaviorId: string;
    studentIds: string[];
    mode?: ApplyBehaviorMode;
  };

  const applyBehaviorMutation = useMutation({
    mutationFn: ({ mode, ...payload }: ApplyBehaviorPayload) => behaviorApi.apply(payload),
    onMutate: (variables) => {
      const mode = variables.mode || 'default';
      if (mode === 'round_quick') return {};

      const behaviorName = behaviors?.find((behavior) => behavior.id === variables.behaviorId)?.name || 'comportamiento';
      const studentCount = variables.studentIds.length;
      const studentSuffix = studentCount === 1 ? '' : 's';
      const message = mode === 'apply_to_rest'
        ? `Aplicando "${behaviorName}" a ${studentCount} estudiante${studentSuffix} restantes...`
        : `Aplicando "${behaviorName}" a ${studentCount} estudiante${studentSuffix}...`;

      return { toastId: toast.loading(message) };
    },
    onSuccess: async (result, variables, context) => {
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
      
      // Mostrar animación de puntos
      const behavior = result.behavior;
      const xp = behavior.xpValue || (behavior.pointType === 'XP' ? behavior.pointValue : 0);
      const hp = behavior.hpValue || (behavior.pointType === 'HP' ? behavior.pointValue : 0);
      const gp = behavior.gpValue || (behavior.pointType === 'GP' ? behavior.pointValue : 0);
      
      if (!isRoundQuick && (xp > 0 || hp > 0 || gp > 0)) {
        showMultiPointsEffect(xp, hp, gp, behavior.isPositive);
      }
      
      // Sound effect
      playSound(behavior.isPositive ? 'pointsGain' : 'pointsLoss');
      
      // Detailed feedback toast
      const beh = result.behavior;
      const txp = beh.xpValue || (beh.pointType === 'XP' ? beh.pointValue : 0);
      const thp = beh.hpValue || (beh.pointType === 'HP' ? beh.pointValue : 0);
      const tgp = beh.gpValue || (beh.pointType === 'GP' ? beh.pointValue : 0);
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
        const successMessage = `${pointsSummary ? pointsSummary + ' aplicado' : 'Aplicado'} — ${beh.name}`;
        if (context?.toastId) {
          toast.success(successMessage, { id: context.toastId, duration: 2500 });
        } else {
          toast.success(successMessage, { duration: 2500 });
        }
      }
      
      if (!isRoundQuick) {
        queryClient.invalidateQueries({ queryKey: ['history-today', classroom.id] });
      }
      
      // Si hay subidas de nivel, mostrar animación
      if (!isRoundQuick && result.levelUps && result.levelUps.length > 0) {
        setLevelUpQueue(result.levelUps);
        setCurrentLevelUp(result.levelUps[0]);
        setTimeout(() => playSound('levelUp'), 400);
      }
      
      // Si hay insignias otorgadas, mostrar modal consolidado
      if (!isRoundQuick && result.awardedBadges && result.awardedBadges.length > 0) {
        // Agrupar por insignia (todas las insignias otorgadas deberían ser la misma)
        const badgeNames = result.awardedBadges.flatMap(ab => ab.badges);
        const uniqueBadgeName = badgeNames[0]; // Tomar la primera (deberían ser todas iguales)
        
        // Obtener los nombres de estudiantes que ganaron la insignia
        const studentNames = result.awardedBadges
          .filter(ab => ab.badges.includes(uniqueBadgeName))
          .map(ab => {
            const studentResult = result.results.find(r => r.studentId === ab.studentId);
            return studentResult?.studentName || 'Estudiante';
          });
        
        // Obtener la insignia completa desde la API
        try {
          const badges = await badgeApi.getClassroomBadges(classroom.id);
          const badge = badges.find((b: Badge) => b.name === uniqueBadgeName);
          if (badge) {
            setAwardedBadgeInfo({ badge, studentNames });
            playSound('badge');
          }
        } catch {
          // Error al obtener info de insignia - ignorar silenciosamente
        }
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
      setShowBulkClassMenu(false);
      toast.success('Clase asignada correctamente');
    },
    onError: () => {
      toast.error('Error al asignar clase');
    },
  });

  // Manejar cola de animaciones de nivel
  const handleLevelUpComplete = () => {
    setLevelUpQueue(prev => {
      const newQueue = prev.slice(1);
      if (newQueue.length > 0) {
        setCurrentLevelUp(newQueue[0]);
      } else {
        setCurrentLevelUp(null);
      }
      return newQueue;
    });
  };

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
    const todayStart = new Date(todayStr).getTime();
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

  // Helper: HP color semántico
  const getHpColor = (hp: number, maxHp: number) => {
    const pct = (hp / maxHp) * 100;
    if (pct < 30) return { bar: 'bg-red-500', text: 'text-red-600', warning: true };
    if (pct <= 60) return { bar: 'bg-amber-500', text: 'text-amber-600', warning: false };
    return { bar: 'bg-emerald-500', text: 'text-emerald-600', warning: false };
  };

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
      const pct = (student.hp / (classroom.maxHp || 100)) * 100;
      if (pct >= 40) return false;
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
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
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

  const applyBehavior = (behavior: Behavior) => {
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
    });
  };

  const positiveBehaviors = behaviors?.filter((b) => b.isPositive) || [];
  const negativeBehaviors = behaviors?.filter((b) => !b.isPositive) || [];
  const availableNegativeRoundBehaviors = classroom.allowNegativePoints === false ? [] : negativeBehaviors;
  const hasRoundBehaviors = positiveBehaviors.length > 0 || availableNegativeRoundBehaviors.length > 0;
  const roundStorageKey = `students-active-round:${classroom.id}`;

  const buildRoundBehaviorConfig = (behavior: Behavior): RoundBehaviorConfig => ({
    behaviorId: behavior.id,
    behaviorName: behavior.name,
    behaviorIcon: behavior.icon || null,
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
            positiveBehavior: parsed.positiveBehavior || null,
            negativeBehavior: parsed.negativeBehavior || null,
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
                  },
              negativeBehavior: parsed.isPositive === false
                ? {
                    behaviorId: parsed.behaviorId,
                    behaviorName: parsed.behaviorName,
                    behaviorIcon: parsed.behaviorIcon || null,
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
      positiveBehavior: selectedRoundPositiveBehavior ? buildRoundBehaviorConfig(selectedRoundPositiveBehavior) : null,
      negativeBehavior: selectedRoundNegativeBehavior ? buildRoundBehaviorConfig(selectedRoundNegativeBehavior) : null,
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

    applyBehaviorMutation.mutate({
      behaviorId: targetBehaviorId,
      studentIds: [studentId],
      mode: 'round_quick',
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
    muted: 'text-sky-600 dark:text-sky-300',
    iconAction: 'text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900/40',
    outline: 'bg-white dark:bg-gray-800 text-sky-700 dark:text-sky-200 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/30',
    flash: 'ring-1 ring-sky-300 dark:ring-sky-700 bg-sky-50/40 dark:bg-sky-900/10',
  };
  const positiveRoundPillClasses = 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
  const negativeRoundPillClasses = 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300';
  const positiveRoundButtonClasses = 'bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50';
  const negativeRoundButtonClasses = 'bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50';
  const roundActiveSummary = activeRound ? (
    <div className="flex flex-wrap items-center gap-1.5">
      {activeRound.positiveBehavior && (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${positiveRoundPillClasses}`}>
          <span>{activeRound.positiveBehavior.behaviorIcon || '⭐'}</span>
          <span>+ {activeRound.positiveBehavior.behaviorName}</span>
        </span>
      )}
      {activeRound.negativeBehavior && (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${negativeRoundPillClasses}`}>
          <span>{activeRound.negativeBehavior.behaviorIcon || '💥'}</span>
          <span>- {activeRound.negativeBehavior.behaviorName}</span>
        </span>
      )}
    </div>
  ) : null;
  const roundBehaviorPickerContent = (
    <div className="space-y-3">
      {positiveBehaviors.length > 0 && (
        <div className="space-y-1">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
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
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${pendingRoundPositiveBehaviorId === behavior.id ? positiveRoundPillClasses : 'bg-white/80 dark:bg-gray-900/40 text-emerald-700 dark:text-emerald-300'}`}>
                  {pendingRoundPositiveBehaviorId === behavior.id ? 'Seleccionado' : 'Elegir'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      {availableNegativeRoundBehaviors.length > 0 && (
        <div className="space-y-1">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">
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
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${pendingRoundNegativeBehaviorId === behavior.id ? negativeRoundPillClasses : 'bg-white/80 dark:bg-gray-900/40 text-rose-700 dark:text-rose-300'}`}>
                  {pendingRoundNegativeBehaviorId === behavior.id ? 'Seleccionado' : 'Elegir'}
                </span>
              </div>
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
        className="w-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white"
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
  const lowHpCount = allStudents.filter((s) => ((s.hp / (classroom.maxHp || 100)) * 100) < 40).length;
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
    <div className="space-y-5">
      {/* Animación de puntos */}
      <MultiPointsAnimation
        show={pointsEffect.show}
        xp={pointsEffect.xp}
        hp={pointsEffect.hp}
        gp={pointsEffect.gp}
        isPositive={pointsEffect.isPositive}
        onComplete={hideMultiPointsEffect}
      />

      {/* Animación de subida de nivel */}
      {currentLevelUp && (
        <LevelUpAnimation
          show={true}
          newLevel={currentLevelUp.newLevel}
          onComplete={handleLevelUpComplete}
        />
      )}

      {/* Barra de acciones */}
      <div className="bg-white dark:bg-gray-800 rounded-xl px-3 sm:px-4 py-2.5 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex flex-wrap items-center gap-2 min-w-0 xl:flex-1">
          {/* Acciones masivas - En vista lista y clanes, ocultas en móvil */}
          {(viewMode === 'list' || viewMode === 'clans') && students.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 flex-wrap">
              {/* Seleccionar todos */}
              <button
                onClick={selectAll}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1.5"
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  selectedStudents.size === students.length && students.length > 0 ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-500'
                }`}>
                  {selectedStudents.size === students.length && students.length > 0 && <Check size={10} className="text-white" />}
                </div>
                <span className="hidden md:inline">{selectedStudents.size > 0 ? `${selectedStudents.size}` : 'Todos'}</span>
              </button>

              {/* Botones de acción - Solo iconos en pantallas pequeñas */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openBehaviorModal('positive')}
                disabled={selectedStudents.size === 0}
                className="!bg-green-500 hover:!bg-green-600 !text-white text-xs px-2 py-1.5"
              >
                <Zap size={14} />
                <span className="hidden lg:inline ml-1">Dar puntos</span>
              </Button>
              {classroom.allowNegativePoints !== false && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openBehaviorModal('negative')}
                  disabled={selectedStudents.size === 0}
                  className="!bg-red-500 hover:!bg-red-600 !text-white text-xs px-2 py-1.5"
                >
                  <Zap size={14} />
                  <span className="hidden lg:inline ml-1">Quitar</span>
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowBadgeModal(true)}
                disabled={selectedStudents.size === 0}
                className="!bg-amber-500 hover:!bg-amber-600 !text-white text-xs px-2 py-1.5"
              >
                <Medal size={14} />
                <span className="hidden lg:inline ml-1">Insignia</span>
              </Button>

              {/* Botón de Clase masiva */}
              <div className="relative">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowBulkClassMenu(!showBulkClassMenu)}
                  disabled={selectedStudents.size === 0}
                  className="!bg-purple-500 hover:!bg-purple-600 !text-white text-xs px-2 py-1.5"
                >
                  <Swords size={14} />
                  <span className="hidden lg:inline ml-1">Clase</span>
                  <ChevronDown size={12} className="ml-0.5" />
                </Button>
                {showBulkClassMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowBulkClassMenu(false)} />
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 py-1">
                      <button
                        onClick={() => bulkAssignClassMutation.mutate({ characterClassId: null })}
                        className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <X size={14} />
                        Sin clase
                      </button>
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                      {characterClasses.filter(c => c.isActive !== false).map(cc => (
                        <button
                          key={cc.id}
                          onClick={() => bulkAssignClassMutation.mutate({ characterClassId: cc.id! })}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span>{cc.icon}</span>
                          <span className="dark:text-gray-200">{cc.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Controles de ronda rápida */}
          {viewMode === 'list' && hasRoundBehaviors && (
            <div className="hidden md:flex items-center min-w-0">
              {!activeRound ? (
                <div className="relative">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowRoundBehaviorPicker((prev) => !prev)}
                    className="!bg-blue-500 hover:!bg-blue-600 !text-white text-xs px-2.5 py-1.5"
                  >
                    <PlayCircle size={14} />
                    <span className="ml-1">Iniciar ronda</span>
                  </Button>
                  {showRoundBehaviorPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowRoundBehaviorPicker(false)} />
                      <div className="absolute top-full right-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 p-2">
                        <p className="px-2 py-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
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
                    <p className={`text-[11px] font-semibold ${roundSessionTone.text}`}>Ronda activa</p>
                    {roundActiveSummary}
                  </div>
                  <span className={`text-[10px] ${roundSessionTone.muted}`}>
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
            <div className="hidden md:flex items-center gap-2 flex-wrap min-w-0">
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                <Heart size={12} />
                <span className="text-[11px] font-semibold">HP bajo {lowHpCount}</span>
              </div>

              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
                <Award size={12} />
                <span className="text-[11px] font-semibold">Asistencia {attendanceMarkedCount}/{allStudents.length}</span>
              </div>

              <button
                onClick={() => navigate(`/classroom/${classroom.id}/attendance`)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Users size={12} />
                Tomar asistencia
              </button>

              {hasRoundBehaviors && (
                <button
                  onClick={() => {
                    setViewMode('list');
                    setShowRoundBehaviorPicker(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                >
                  <PlayCircle size={12} />
                  Iniciar ronda
                </button>
              )}
            </div>
          )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {/* Botón de Utilidades */}
            <button
              onClick={() => setShowUtilities(true)}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800 transition-colors text-sm font-medium flex-shrink-0"
              title="Utilidades"
            >
              <Wrench size={16} />
              <span className="hidden sm:inline">Utilidades</span>
              {pendingNotesCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center animate-pulse">
                  {pendingNotesCount}
                </span>
              )}
            </button>

            {/* Toggle de vista - Siempre visible, al final */}
            <div className="flex items-center bg-indigo-100 dark:bg-indigo-900/30 rounded-lg p-0.5 border border-indigo-200 dark:border-indigo-800 flex-shrink-0">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'cards' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300'
                }`}
                title="Vista de tarjetas"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300'
                }`}
                title="Vista de lista"
              >
                <List size={18} />
              </button>
              {classroom.clansEnabled && (
                <button
                  onClick={() => setViewMode('clans')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'clans' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300'
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
                    className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600"
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
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center">
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
          <p className="text-xs text-gray-400 mt-4">
            Los estudiantes también pueden unirse con el código de clase desde su cuenta
          </p>
        </Card>
      ) : (
        <>
          {/* Vista de Cards - Layout Dividido */}
          {viewMode === 'cards' && allStudents.length > 0 && (() => {
            // Obtener estudiante seleccionado para el panel de detalle
            const detailStudent = selectedStudentId 
              ? students.find(s => s.id === selectedStudentId) || students[0]
              : students[0];
            const detailClassInfo = detailStudent?.characterClassId
              ? characterClasses.find(c => c.id === detailStudent.characterClassId) || classMap[detailStudent.characterClass]
              : detailStudent ? classMap[detailStudent.characterClass] : null;
            const xpPerLevel = (classroom as any).xpPerLevel || 100;
            const lvl = detailStudent?.level || 1;
            const xpForCurrentLevel = (xpPerLevel * lvl * (lvl - 1)) / 2;
            const xpForNextLevel = (xpPerLevel * (lvl + 1) * lvl) / 2;
            const xpInLevel = (detailStudent?.xp || 0) - xpForCurrentLevel;
            const xpNeeded = xpForNextLevel - xpForCurrentLevel;
            const xpProgress = Math.min((xpInLevel / xpNeeded) * 100, 100);
            const hpPercent = detailStudent ? Math.min((detailStudent.hp / (classroom.maxHp || 100)) * 100, 100) : 100;
            const isTopStudent = topStudent?.id === detailStudent?.id;

            return (
              <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-200px)] min-h-[400px] lg:min-h-[500px]">
                {/* Sidebar izquierda - Lista compacta (oculta en móvil si hay estudiante seleccionado) */}
                <div className={`${selectedStudentId ? 'hidden lg:flex' : 'flex'} w-full lg:w-64 flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-col`}>
                  {/* Búsqueda en sidebar */}
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {students.length === 0 && searchQuery.trim() ? (
                      <div className="text-center py-8 px-3">
                        <Search className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">Sin resultados para "{searchQuery}"</p>
                      </div>
                    ) : students.map((student) => {
                      const classInfo = (student.characterClassId && characterClasses.find(c => c.id === student.characterClassId)) || classMap[student.characterClass];
                      const isActive = detailStudent?.id === student.id;
                      
                      return (
                        <div
                          key={student.id}
                          onClick={() => setSelectedStudentId(student.id)}
                          className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer border-l-4 transition-all ${
                            isActive 
                              ? storyTheme ? '' : 'bg-indigo-50 dark:bg-indigo-900/30 border-l-indigo-500' 
                              : storyTheme ? 'border-l-transparent hover:bg-white/10' : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                          style={isActive && storyTheme ? { 
                            backgroundColor: isThemeDark ? `${storyTheme.colors?.primary}30` : `${storyTheme.colors?.primary}20`,
                            borderLeftColor: storyTheme.colors?.primary || '#6366f1'
                          } : undefined}
                        >
                          {/* Info del estudiante */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{classInfo?.icon}</span>
                              <span 
                                className={`text-sm font-medium truncate ${isActive && !storyTheme ? 'text-indigo-700 dark:text-indigo-300' : storyTheme && isThemeDark ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}
                                style={isActive && storyTheme ? { color: isThemeDark ? '#fff' : storyTheme.colors?.primary } : undefined}
                              >
                                {getDisplayName(student)}
                              </span>
                              {topStudent?.id === student.id && <Crown size={12} className="text-amber-500 flex-shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>Nv.{student.level}</span>
                              <span>•</span>
                              <span className="text-emerald-600">{student.xp} XP</span>
                              {((student.hp / (classroom.maxHp || 100)) * 100) < 30 && (
                                <span className="text-red-500 font-semibold">HP bajo</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Panel central - Detalle del estudiante */}
                {detailStudent && (
                  <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                    {/* Header con info contextual */}
                    <div className={`relative h-32 bg-gradient-to-br ${
                      detailStudent.characterClass === 'GUARDIAN' ? 'from-blue-500 to-cyan-600' :
                      detailStudent.characterClass === 'ARCANE' ? 'from-purple-500 to-pink-600' :
                      detailStudent.characterClass === 'EXPLORER' ? 'from-green-500 to-emerald-600' :
                      'from-amber-500 to-orange-600'
                    }`}>
                      {/* Botón volver en móvil */}
                      <button
                        onClick={() => setSelectedStudentId(null)}
                        className="lg:hidden absolute top-3 left-3 flex items-center gap-1 bg-white/20 backdrop-blur text-white text-xs font-bold px-2 py-1 rounded-full hover:bg-white/30 transition-colors"
                      >
                        <ChevronLeft size={14} />
                        <span>Lista</span>
                      </button>
                      {/* Parent code + leader badge in top-right */}
                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        {isTopStudent && (
                          <div className="flex items-center gap-1 bg-white/20 backdrop-blur text-white text-xs font-bold px-2 py-1 rounded-full">
                            <Crown size={12} />
                            <span>Líder en XP</span>
                          </div>
                        )}
                        {getStudentLinkCode(detailStudent.id) && (
                          <button
                            onClick={() => copyLinkCode(getStudentLinkCode(detailStudent.id)!)}
                            className="flex flex-col items-end bg-white/20 backdrop-blur text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/30 transition-colors"
                            title="Clic para copiar código del estudiante"
                          >
                            <span className="text-[9px] text-white/70 leading-none">Código del estudiante</span>
                            <span className="font-mono font-bold flex items-center gap-1">
                              {getStudentLinkCode(detailStudent.id)}
                              <Copy size={10} className="opacity-70" />
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Contenido principal */}
                    <div className="flex-1 p-4 lg:p-6 -mt-16 overflow-hidden">
                      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full">
                        {/* Avatar grande + código de vinculación - Responsive */}
                        <div className="flex-shrink-0 flex flex-col items-center">
                          <div className="relative w-[160px] h-[280px] 2xl:w-[220px] 2xl:h-[390px] rounded-xl overflow-hidden bg-gradient-to-br from-white to-gray-100 dark:from-gray-700 dark:to-gray-800 border-4 border-white dark:border-gray-700 shadow-xl">
                            <StudentAvatarMini
                              studentProfileId={detailStudent.id}
                              gender={detailStudent.avatarGender || 'MALE'}
                              size="xl"
                              className="absolute top-0 left-1/2 -translate-x-1/2 scale-[0.62] 2xl:scale-[0.85] origin-top"
                            />
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                              <div className="flex items-center gap-1 bg-black/80 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg whitespace-nowrap">
                                <Star size={12} className="text-amber-400 fill-amber-400" />
                                <span>Nv.{detailStudent.level}</span>
                              </div>
                            </div>
                          </div>
                          {/* Código de vinculación debajo del avatar */}
                          {getStudentLinkCode(detailStudent.id) && (
                            <button
                              onClick={() => copyLinkCode(getStudentLinkCode(detailStudent.id)!)}
                              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-mono font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                              title="Clic para copiar"
                            >
                              <Link2 size={12} />
                              {getStudentLinkCode(detailStudent.id)}
                              <Copy size={10} className="opacity-50" />
                            </button>
                          )}
                        </div>

                        {/* Info del estudiante */}
                        <div className="flex-1 pt-4 lg:pt-16 overflow-y-auto">
                          {/* Nombre y clase */}
                          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">
                            {getDisplayName(detailStudent)}
                          </h2>
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 mb-2">
                            <span className="text-xl">{detailClassInfo?.icon || '👤'}</span>
                            <select
                              value={detailStudent.characterClassId || ''}
                              onChange={(e) => {
                                const selectedId = e.target.value;
                                if (!selectedId) {
                                  assignClassMutation.mutate({ studentId: detailStudent.id, characterClassId: null });
                                  return;
                                }
                                assignClassMutation.mutate({ studentId: detailStudent.id, characterClassId: selectedId });
                              }}
                              className="font-medium bg-transparent border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                              <option value="">Sin clase</option>
                              {characterClasses.filter(c => c.isActive).map(c => (
                                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                              ))}
                            </select>
                            <span className="text-gray-300 dark:text-gray-600">•</span>
                            <span className="text-sm">Nv. {detailStudent.level}</span>
                          </div>
                          {/* Context chips */}
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {classroom.clansEnabled && (
                              <span 
                                className="px-2 py-0.5 rounded-full text-white text-xs font-medium"
                                style={{ backgroundColor: (detailStudent as any).clanColor || '#6b7280' }}
                              >
                                🛡️ {(detailStudent as any).clanName || 'Sin clan'}
                              </span>
                            )}
                            {(() => {
                              const streak = (detailStudent as any).loginStreak || 0;
                              return streak > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium">
                                  🔥 {streak} días seguidos
                                </span>
                              ) : null;
                            })()}
                            {(detailStudent as any).badgeCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
                                🏅 {(detailStudent as any).badgeCount} insignias
                              </span>
                            )}
                          </div>

                          {/* Stats con barras */}
                          <div className="space-y-4 mb-6">
                            {/* HP */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="flex items-center gap-2 text-red-600 font-semibold">
                                  <Heart size={18} className="fill-red-500" />
                                  HP
                                </span>
                                <span className="text-lg font-bold text-gray-700 dark:text-gray-200">
                                  {detailStudent.hp} <span className="text-sm font-normal text-gray-400">/ {classroom.maxHp || 100}</span>
                                </span>
                              </div>
                              <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${hpPercent}%` }}
                                  className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-600"
                                />
                              </div>
                            </div>

                            {/* XP */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="flex items-center gap-2 text-indigo-600 font-semibold">
                                  <Sparkles size={18} />
                                  XP
                                </span>
                                <span className="text-lg font-bold text-gray-700 dark:text-gray-200">
                                  {Math.round(xpInLevel)} <span className="text-sm font-normal text-gray-400">/ {xpNeeded} para Nv. {lvl + 1}</span>
                                </span>
                              </div>
                              <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${xpProgress}%` }}
                                  className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full"
                                />
                              </div>
                            </div>

                            {/* GP */}
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-2 text-amber-600 font-semibold">
                                <Coins size={18} />
                                GP
                              </span>
                              <span className="text-lg font-bold text-gray-700 dark:text-gray-200">
                                {detailStudent.gp}
                              </span>
                            </div>
                          </div>

                          {/* Botones de acción rápida */}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => { setSelectedStudents(new Set([detailStudent.id])); setBehaviorType('positive'); setShowBehaviorModal(true); }}
                              className="!bg-green-500 hover:!bg-green-600 !text-white"
                            >
                              <Zap size={14} className="mr-1" /> Dar puntos
                            </Button>
                            {classroom.allowNegativePoints !== false && (
                              <Button
                                size="sm"
                                onClick={() => { setSelectedStudents(new Set([detailStudent.id])); setBehaviorType('negative'); setShowBehaviorModal(true); }}
                                className="!bg-red-500 hover:!bg-red-600 !text-white"
                              >
                                <Zap size={14} className="mr-1" /> Quitar
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => { setSelectedStudents(new Set([detailStudent.id])); setShowBadgeModal(true); }}
                              className="!bg-amber-500 hover:!bg-amber-600 !text-white"
                            >
                              <Medal size={14} className="mr-1" /> Insignia
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => navigate(`/classroom/${classroom.id}/student/${detailStudent.id}`)}
                              className="!bg-white dark:!bg-gray-700 !text-gray-600 dark:!text-gray-300 !border !border-gray-300 dark:!border-gray-600 hover:!bg-gray-50 dark:hover:!bg-gray-600"
                            >
                              <Eye size={14} className="mr-1" /> Ver perfil
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

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
                      className="w-56 pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {/* Filtros */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => { setListFilter('all'); setClanFilter(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        listFilter === 'all' && !clanFilter
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      Todos ({allStudents.length})
                    </button>
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
                </div>
              </div>

              {/* Seleccionar todos */}
              {students.length > 0 && (
                <div
                  onClick={selectAll}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                    selectedStudents.size === students.length && students.length > 0 ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-500'
                  }`}>
                    {selectedStudents.size === students.length && students.length > 0 && <Check size={12} className="text-white" />}
                    {selectedStudents.size > 0 && selectedStudents.size < students.length && <div className="w-2 h-2 bg-indigo-600 rounded-sm" />}
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Seleccionar todos los <span className="font-semibold">{students.length}</span> estudiantes
                  </span>
                  {selectedStudents.size > 0 && (
                    <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">
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
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">HP</th>
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
                    const hpPercent = Math.min((student.hp / (classroom.maxHp || 100)) * 100, 100);
                    const isTopStudent = topStudent?.id === student.id;
                    const studentRoundAwards = getRoundStudentAwards(student.id);
                    const roundCount = getRoundAwardCount(student.id);
                    const lastAwardedAt = activeRound?.lastAwardedAtByStudent[student.id] || 0;
                    const justAwarded = lastAwardedAt > 0 && Date.now() - lastAwardedAt < 4500;

                    return (
                      <tr 
                        key={student.id}
                        onClick={() => toggleStudent(student.id)}
                        className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''} ${justAwarded ? roundSessionTone.flash : ''}`}
                      >
                        {/* Estudiante */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {/* Checkbox inline */}
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                              isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600'
                            }`}>
                              {isSelected && <Check size={12} className="text-white" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-800 dark:text-white">{getDisplayName(student)}</span>
                                {isTopStudent && <Crown size={14} className="text-amber-500" />}
                              </div>
                              {(getRealStudentName(student) || student.linkedEmail) && (
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                  {getRealStudentName(student) && (
                                    <span className="text-gray-500 dark:text-gray-400">{getRealStudentName(student)}</span>
                                  )}
                                  {student.linkedEmail && (
                                    <span className="text-gray-400 dark:text-gray-500">{student.linkedEmail}</span>
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
                                  return label ? <><span className="text-gray-300">·</span><span className="text-[10px]">{label}</span></> : null;
                                })()}
                                {classroom.clansEnabled && (
                                  <>
                                    <span className="text-gray-300">•</span>
                                    {(student as any).clanName ? (
                                      <span 
                                        className="px-1.5 py-0.5 rounded text-white text-[10px]"
                                        style={{ backgroundColor: (student as any).clanColor || '#6366f1' }}
                                      >
                                        {(student as any).clanName}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 italic">Sin clan</span>
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
                          <div className="flex items-center justify-center gap-1 text-emerald-600 font-medium">
                            <Sparkles size={14} />
                            {student.xp}
                          </div>
                        </td>

                        {/* HP — semantic color */}
                        <td className="px-4 py-3">
                          {(() => {
                            const hpStyle = getHpColor(student.hp, classroom.maxHp || 100);
                            return (
                              <div className="flex items-center gap-2">
                                <Heart size={14} className={`${hpStyle.text} flex-shrink-0`} />
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[80px]">
                                  <div 
                                    className={`h-full rounded-full ${hpStyle.bar}`}
                                    style={{ width: `${hpPercent}%` }}
                                  />
                                </div>
                                <span className={`text-sm font-medium w-16 ${hpStyle.text}`}>{student.hp}/{classroom.maxHp || 100}</span>
                                {hpStyle.warning && <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />}
                              </div>
                            );
                          })()}
                        </td>

                        {/* GP */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 text-amber-600 font-medium">
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
                                  className={`px-2 py-1 rounded-lg text-xs font-semibold disabled:opacity-50 ${positiveRoundButtonClasses}`}
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
                                  className={`px-2 py-1 rounded-lg text-xs font-semibold disabled:opacity-50 ${negativeRoundButtonClasses}`}
                                  title={`Aplicar ${activeRound.negativeBehavior.behaviorName}`}
                                >
                                  -1
                                </button>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Acciones */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/classroom/${classroom.id}/student/${student.id}`);
                            }}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                          >
                            <Eye size={14} />
                            Ver perfil
                          </button>
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
                          const hpPercent = (student.hp / (classroom.maxHp || 100)) * 100;

                          return (
                            <div 
                              key={student.id}
                              className={`p-4 flex items-center gap-4 cursor-pointer transition-colors ${
                                isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                              }`}
                              onClick={() => toggleStudent(student.id)}
                            >
                              {/* Checkbox */}
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                isSelected 
                                  ? 'bg-indigo-600 border-indigo-600' 
                                  : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                              }`}>
                                {isSelected && <Check size={12} className="text-white" />}
                              </div>

                              {/* Avatar */}
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0">
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
                                <div className="flex items-center gap-1">
                                  <Heart size={14} className="text-red-500" />
                                  <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-gradient-to-r from-red-500 to-rose-400 rounded-full"
                                      style={{ width: `${hpPercent}%` }}
                                    />
                                  </div>
                                </div>
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
                                className="text-indigo-600 hover:text-indigo-700 p-2"
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

      {/* Modal de puntos con tabs */}
      <PointsModal
        isOpen={showBehaviorModal}
        onClose={() => setShowBehaviorModal(false)}
        isPositive={behaviorType === 'positive'}
        selectedCount={selectedStudents.size}
        selectedStudentNames={Array.from(selectedStudents).map(id => {
          const s = allStudents.find(st => st.id === id);
          return s ? getDisplayName(s) : 'Estudiante';
        })}
        behaviors={behaviorType === 'positive' ? positiveBehaviors : negativeBehaviors}
        onApplyBehavior={applyBehavior}
        classroom={classroom}
        onApplyManual={async (pointType, amount, reason, competencyId) => {
          // Aplicar manualmente a todos los estudiantes seleccionados
          const levelUps: Array<{ studentName: string; newLevel: number }> = [];
          
          for (const studentId of selectedStudents) {
            const result = await studentApi.updatePoints(studentId, {
              pointType,
              amount: behaviorType === 'positive' ? amount : -amount,
              reason,
              competencyId,
            });
            
            // Verificar si hubo subida de nivel
            if (result.leveledUp && result.newLevel) {
              levelUps.push({
                studentName: result.studentName,
                newLevel: result.newLevel,
              });
            }
          }
          
          queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
          setSelectedStudents(new Set());
          setShowBehaviorModal(false);
          toast.success(`Puntos aplicados a ${selectedStudents.size} estudiante(s)`);
          
          // Mostrar animación de subida de nivel si hay
          if (levelUps.length > 0) {
            setLevelUpQueue(levelUps);
            setCurrentLevelUp(levelUps[0]);
          }
        }}
        isLoading={applyBehaviorMutation.isPending}
        classroomId={classroom.id}
      />

      {/* Modal de insignias */}
      <BadgeAwardModal
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
          // Mostrar animación de insignia otorgada
          setAwardedBadgeInfo({ badge, studentNames: names });
          playSound('badge');
        }}
      />

      {/* Modal de insignia otorgada automáticamente (para el profesor) */}
      <TeacherBadgeAwardedModal
        badge={awardedBadgeInfo.badge}
        studentNames={awardedBadgeInfo.studentNames}
        isOpen={!!awardedBadgeInfo.badge}
        onClose={() => setAwardedBadgeInfo({ badge: null, studentNames: [] })}
      />

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

      {/* Utilidades del aula */}
      <ClassroomUtilities
        isOpen={showUtilities}
        onClose={() => setShowUtilities(false)}
        students={allStudents}
        showCharacterName={classroom.showCharacterName !== false}
        classroomId={classroom.id}
      />
    </div>
  );
};

// Modal para otorgar insignias desde lista de estudiantes
const BadgeAwardModal = ({
  isOpen,
  onClose,
  classroomId,
  selectedStudentIds,
  studentNames,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  classroomId: string;
  selectedStudentIds: string[];
  studentNames: string[];
  onSuccess: (badge: Badge, studentNames: string[]) => void;
}) => {
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  // Obtener insignias de la clase
  const { data: badges = [], isLoading: loadingBadges } = useQuery({
    queryKey: ['badges', classroomId],
    queryFn: () => badgeApi.getClassroomBadges(classroomId),
    enabled: isOpen,
  });

  // Mostrar todas las insignias
  const manualBadges = badges;

  const awardMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBadge) return;
      for (const studentId of selectedStudentIds) {
        await badgeApi.awardBadge(studentId, selectedBadge.id, reason);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges'] });
      toast.success(`Insignia "${selectedBadge?.name}" otorgada a ${selectedStudentIds.length} estudiante(s)`);
      if (selectedBadge) {
        onSuccess(selectedBadge, studentNames);
      }
      setSelectedBadge(null);
      setReason('');
    },
    onError: () => {
      toast.error('Error al otorgar insignia');
    },
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col md:flex-row"
        >
          {/* Panel izquierdo - Jiro */}
          <div className="hidden md:block md:w-64 flex-shrink-0 relative overflow-hidden">
            <motion.img
              src="/assets/mascot/jiro-insignias.jpg"
              alt="Jiro"
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {/* Panel derecho - Contenido */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Medal className="text-amber-500" size={24} />
                Dar Insignia
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* Info bar */}
            <div className="px-5 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <Users size={14} />
                {selectedStudentIds.length} estudiante(s) seleccionado(s)
              </p>
            </div>

            {/* Lista de insignias */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Tips para docentes */}
              <div className="mb-4 p-4 rounded-xl border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  💡 Consejos para otorgar insignias
                </h4>
                <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">✓</span>
                    <span><strong>Reconocimiento:</strong> Las insignias son logros permanentes que motivan a los estudiantes.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">✓</span>
                    <span><strong>Rarezas:</strong> Reserva las insignias épicas y legendarias para logros excepcionales.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">✓</span>
                    <span><strong>Personaliza:</strong> Añade una razón para que el estudiante recuerde por qué la recibió.</span>
                  </li>
                </ul>
              </div>

              {loadingBadges ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-gray-500">Cargando insignias...</p>
                </div>
              ) : manualBadges.length === 0 ? (
                <div className="text-center py-8">
                  <Medal className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">No hay insignias disponibles</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Crea insignias en Gamificación → Insignias
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {manualBadges.map((badge: Badge) => {
                    const colors = RARITY_COLORS[badge.rarity];
                    return (
                      <button
                        key={badge.id}
                        onClick={() => setSelectedBadge(badge)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left hover:scale-[1.01] active:scale-[0.99] ${
                          selectedBadge?.id === badge.id
                            ? `${colors.bg} ${colors.border} shadow-md`
                            : 'border-gray-200 dark:border-gray-600 hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-900/10'
                        }`}
                      >
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br ${colors.gradient} shadow-lg`}>
                          <span className="text-2xl">{badge.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-800 dark:text-white">{badge.name}</p>
                            {badge.assignmentMode === 'AUTOMATIC' && (
                              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">Auto</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{badge.description}</p>
                          <span className={`text-xs font-bold ${colors.text} mt-1 inline-block`}>
                            {RARITY_LABELS[badge.rarity]}
                          </span>
                        </div>
                        {selectedBadge?.id === badge.id && (
                          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Razón y botón */}
            {selectedBadge && (
              <div className="p-5 border-t border-gray-200 dark:border-gray-700 space-y-3 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br ${RARITY_COLORS[selectedBadge.rarity].gradient}`}>
                    <span className="text-lg">{selectedBadge.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 dark:text-white text-sm">{selectedBadge.name}</p>
                    <p className={`text-xs font-medium ${RARITY_COLORS[selectedBadge.rarity].text}`}>{RARITY_LABELS[selectedBadge.rarity]}</p>
                  </div>
                </div>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Razón del reconocimiento (opcional)"
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                />
                <Button
                  onClick={() => awardMutation.mutate()}
                  disabled={awardMutation.isPending}
                  className="w-full !py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
                >
                  {awardMutation.isPending ? 'Otorgando...' : `🏆 Dar "${selectedBadge.name}"`}
                </Button>
              </div>
          )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

