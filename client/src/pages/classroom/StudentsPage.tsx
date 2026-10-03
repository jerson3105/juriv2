import { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Copy, PlayCircle, RotateCcw, UserPlus } from 'lucide-react';
import { classroomApi, type Classroom, type Student } from '../../lib/classroomApi';
import { behaviorApi, type ApplyResult, type Behavior } from '../../lib/behaviorApi';
import { studentApi } from '../../lib/studentApi';
import { characterClassApi } from '../../lib/characterClassApi';
import { clanApi } from '../../lib/clanApi';
import { attendanceApi, type AttendanceRecord } from '../../lib/attendanceApi';
import { historyApi } from '../../lib/historyApi';
import { rankingApi, studentsPulseKey, type StudentsPulse } from '../../lib/rankingApi';
import { useCharacterClasses } from '../../hooks/useCharacterClasses';
import { useBehaviorUsage } from '../../hooks/useBehaviorUsage';
import { useQuickBehaviors } from '../../hooks/useQuickBehaviors';
import { useStudentRound } from '../../hooks/useStudentRound';
import { useSound } from '../../hooks/useSound';
import { useProjectorStore } from '../../store/projectorStore';
import { feedbackSoundOn } from '../../store/celebrationStore';
import { useMotionBudget } from '../../components/layout/sidebar/useSidebarState';
import { useTeacherOnboardingSafe } from '../../contexts/TeacherOnboardingContext';
import { celebrateApplyResult, celebrateBadgeAward, celebrateLevelUps } from '../../components/celebrations/celebrationHelpers';
import { TodayLevelUps } from '../../components/celebrations/TodayLevelUps';
import { RecoveryMissionModal } from '../../components/energy/RecoveryMissionModal';
import { isInitialLevel } from '../../components/energy/energyHelpers';
import { GiveBadgeModal } from '../../components/badges/GiveBadgeModal';
import { AddPlaceholderStudentsModal } from '../../components/students/AddPlaceholderStudentsModal';
import { StudentsManageMenu } from '../../components/students/StudentsManageMenu';
import { PointsModal } from '../../components/modals/PointsModal';
import { SelectionActionBar } from '../../components/students/SelectionActionBar';
import { StudentFocusView, type FocusPoints } from '../../components/students/StudentFocusView';
import { StudentsToolbar } from '../../components/students/StudentsToolbar';
import { StudentsTable, type RowPoints, type StudentRow } from '../../components/students/StudentsTable';
import { ClanBoard, type ClanColumn } from '../../components/students/ClanBoard';
import { HomeModal } from '../../components/home/HomeModal';
import { cancelButton, localToday, primaryButton } from '../../components/home/homeHelpers';
import { studentNames } from '../../components/students/profile/profileHelpers';
import {
  PRIVATE_FILTERS,
  attendanceOf,
  clanEmblem,
  energyOf,
  normalize,
  pulseBounds,
  readStudentsView,
  rewardText,
  roleOf,
  writeStudentsView,
  type ListFilter,
  type StudentsView,
} from '../../components/students/studentsHelpers';

type ClassroomContext = { classroom: Classroom & { showCharacterName?: boolean } };
type ClassroomWithStudents = Classroom & { students: Student[] };
type ApplyVars = {
  behaviorId: string;
  studentIds: string[];
  /** quick = un toque (fila o ficha) · round = «Pasar por todos» · bulk = varios (selección, clan o modal). */
  mode: 'quick' | 'round' | 'bulk';
  multiplier?: number;
  /** Cómo nombrar al grupo en el aviso («Dragones»). */
  label?: string;
};
type Target = { ids: string[]; fromSelection: boolean };

// La Lista se monta por clase: vista, filtros, selección y ronda empiezan de cero al cambiar de clase.
export const StudentsPage = () => {
  const { classroom } = useOutletContext<ClassroomContext>();
  return <StudentsPageInner key={classroom.id} classroom={classroom} />;
};

const StudentsPageInner = ({ classroom }: ClassroomContext) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const onboarding = useTeacherOnboardingSafe();
  const { play } = useSound();
  const projecting = useProjectorStore((s) => s.projecting);
  const motionLevel = useMotionBudget();
  const { classMap, classes: characterClasses } = useCharacterClasses(classroom.id);
  const behaviorUsage = useBehaviorUsage(classroom.id);
  const round = useStudentRound(classroom.id);

  const [view, setView] = useState<StudentsView>(() => readStudentsView(classroom.id, !!classroom.clansEnabled));
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [clanFilter, setClanFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pointsTarget, setPointsTarget] = useState<(Target & { positive: boolean }) | null>(null);
  const [badgeTarget, setBadgeTarget] = useState<Target | null>(null);
  const [recoveryFor, setRecoveryFor] = useState<{ id: string; name: string } | null>(null);
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [roundChoice, setRoundChoice] = useState<string | null>(null);
  const [undoingRound, setUndoingRound] = useState(false);

  const activeView: StudentsView = view === 'clanes' && !classroom.clansEnabled ? 'ficha' : view;
  const initial = isInitialLevel(classroom.gradeLevel);
  const maxHp = classroom.maxHp || 100;
  const { date: todayStr } = localToday();
  const bounds = pulseBounds();

  const { data: classroomData, isLoading } = useQuery({
    queryKey: ['classroom', classroom.id],
    queryFn: () => classroomApi.getById(classroom.id),
  });
  const { data: behaviors = [] } = useQuery({
    queryKey: ['behaviors', classroom.id],
    queryFn: () => behaviorApi.getByClassroom(classroom.id),
  });
  const { data: todayAttendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-today', classroom.id, todayStr],
    queryFn: () => attendanceApi.getAttendanceByDate(classroom.id, todayStr),
  });
  // Reconocidos hoy y, por clan, la semana y quién aportó hoy (solo para el profe).
  const { data: pulse } = useQuery({
    queryKey: [...studentsPulseKey(classroom.id), bounds.today, bounds.week],
    queryFn: () => rankingApi.getPulse(classroom.id, bounds.today, bounds.week),
    staleTime: 30_000,
  });
  const { data: clans = [] } = useQuery({
    queryKey: ['clans', classroom.id],
    queryFn: () => clanApi.getClassroomClans(classroom.id),
    enabled: !!classroom.clansEnabled && activeView === 'clanes',
  });

  // ── Alumnos y filas ──────────────────────────────────────────────────────────────────────────────
  const allStudents = classroomData?.students ?? [];
  const nameById = new Map(allStudents.map((s) => [s.id, studentNames(s, classroom.showCharacterName).primary]));
  const attendanceById = new Map(todayAttendance.map((record) => [record.studentProfileId, record]));
  const recognized = pulse ? new Set(pulse.recognizedToday) : null;
  const isAbsent = (s: Student) => attendanceOf(attendanceById.get(s.id)) === 'absent';

  const allRows: StudentRow[] = allStudents
    .map((s) => {
      const names = studentNames(s, classroom.showCharacterName);
      return {
        student: s,
        name: names.primary,
        secondary: names.secondary,
        role: roleOf(s, classMap),
        energy: projecting ? null : energyOf(s, maxHp),
        attendance: projecting ? null : attendanceOf(attendanceById.get(s.id)),
        recognized: projecting || !recognized ? null : recognized.has(s.id),
        roundCount: round.countFor(s.id),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  const restingCount = allStudents.filter((s) => energyOf(s, maxHp) === 'resting').length;
  const lowHpCount = allStudents.filter((s) => energyOf(s, maxHp) === 'low').length;
  const absentCount = allStudents.filter(isAbsent).length;
  // Quien faltó no cuenta como «sin reconocimiento».
  const unrecognizedCount = recognized ? allStudents.filter((s) => !recognized.has(s.id) && !isAbsent(s)).length : null;

  // Al proyectar, los filtros privados no se aplican (ni se ven); los de ronda, solo con ronda.
  const effectiveFilter: ListFilter =
    (projecting && PRIVATE_FILTERS.has(listFilter)) || (!round.round && listFilter.startsWith('round')) ? 'all' : listFilter;
  const query = normalize(search.trim());
  const rows = allRows.filter((row) => {
    const s = row.student;
    if (query && !normalize(`${row.name} ${row.secondary ?? ''} ${row.role?.name ?? ''}`).includes(query)) return false;
    if (clanFilter && s.teamId !== clanFilter) return false;
    switch (effectiveFilter) {
      case 'unrecognized': return !recognized || (!recognized.has(s.id) && !isAbsent(s));
      case 'resting': return energyOf(s, maxHp) === 'resting';
      case 'low_hp': return energyOf(s, maxHp) === 'low';
      case 'absent': return isAbsent(s);
      case 'round_pending': return round.countFor(s.id) === 0;
      case 'round_done': return round.countFor(s.id) > 0;
      default: return true;
    }
  });
  const emptyMessage = query ? `Nadie coincide con «${search.trim()}».` : 'Nadie con este filtro ahora.';

  const studentClans = new Map<string, { id: string; name: string; color: string }>();
  allStudents.forEach((s) => {
    if (s.teamId && s.clanName && !studentClans.has(s.teamId)) studentClans.set(s.teamId, { id: s.teamId, name: s.clanName, color: s.clanColor || '#6b7280' });
  });
  const clanOptions = [...studentClans.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  // ── Comportamientos: un solo conjunto (los más usados) en todas las vistas ─────────────────────
  const positives = behaviors.filter((b) => b.isPositive);
  const allowNegative = classroom.allowNegativePoints !== false;
  const negatives = projecting || !allowNegative ? [] : behaviors.filter((b) => !b.isPositive);
  const featuredPositives = behaviorUsage.mostUsed(positives, 4);
  const featuredNegatives = behaviorUsage.mostUsed(negatives, 2);
  const quick = useQuickBehaviors(classroom.id, positives, featuredPositives[0] ?? null);
  const roundBehavior = round.round ? positives.find((b) => b.id === round.round!.behaviorId) ?? null : null;

  // ── Aplicar puntos ───────────────────────────────────────────────────────────────────────────────
  const invalidateAfterPoints = () => {
    queryClient.invalidateQueries({ queryKey: ['history-today', classroom.id] });
    queryClient.invalidateQueries({ queryKey: studentsPulseKey(classroom.id) });
  };

  const undoAppliedBehavior = async (result: ApplyResult) => {
    const entryIds = result.results.map((r) => r.pointLogEntryId).filter((id): id is string => Boolean(id));
    if (entryIds.length === 0) {
      toast.error('No se pudo identificar lo aplicado para deshacerlo');
      return;
    }
    const toastId = toast.loading('Deshaciendo...');
    const outcomes = await Promise.allSettled(entryIds.map((id) => historyApi.revertEntry('POINTS', id)));
    const failed = outcomes.filter((outcome) => outcome.status === 'rejected').length;
    queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
    invalidateAfterPoints();
    if (failed === 0) toast.success(projecting && !result.behavior.isPositive ? 'Deshecho' : `Deshecho: ${result.behavior.name}`, { id: toastId });
    else toast.error(`No se pudo deshacer en ${failed} de ${entryIds.length} estudiante(s)`, { id: toastId });
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

  // Copia en caché lo que devolvió el servidor (un toque se ve al instante, sin recargar la clase).
  const syncStudents = (result: ApplyResult) =>
    queryClient.setQueryData<ClassroomWithStudents>(['classroom', classroom.id], (current) => current && {
      ...current,
      students: current.students.map((s) => {
        const r = result.results.find((item) => item.studentId === s.id);
        return r ? { ...s, xp: r.newXp, hp: r.newHp, gp: r.newGp, level: r.newLevel ?? s.level } : s;
      }),
    });

  // La estrella de hoy se enciende al instante; el servidor confirma al volver a pedir el pulso.
  const markPulse = (result: ApplyResult) => {
    if (!result.behavior.isPositive) return;
    const ids = result.results.map((r) => r.studentId);
    const byClan = new Map<string, string[]>();
    result.results.filter((r) => r.xpChange > 0).forEach((r) => {
      const team = allStudents.find((s) => s.id === r.studentId)?.teamId;
      if (team) byClan.set(team, [...(byClan.get(team) ?? []), r.studentId]);
    });
    queryClient.setQueriesData<StudentsPulse>({ queryKey: studentsPulseKey(classroom.id) }, (current) => {
      if (!current) return current;
      const clansNext = current.clans.map((c) => (byClan.has(c.id) ? { ...c, contributorsToday: [...new Set([...c.contributorsToday, ...byClan.get(c.id)!])] } : c));
      byClan.forEach((members, id) => {
        if (!clansNext.some((c) => c.id === id)) clansNext.push({ id, weekXp: 0, contributorsToday: members });
      });
      return { recognizedToday: [...new Set([...current.recognizedToday, ...ids])], clans: clansNext };
    });
  };

  const summaryOf = (result: ApplyResult) => {
    const first = result.results[0];
    const sign = result.behavior.isPositive ? '+' : '−';
    return [
      first?.xpChange ? `${sign}${Math.abs(first.xpChange)} XP` : null,
      first?.hpChange ? `${sign}${Math.abs(first.hpChange)} HP` : null,
      first?.gpChange ? `${sign}${Math.abs(first.gpChange)} oro` : null,
    ].filter(Boolean).join(' · ');
  };

  const applyMutation = useMutation({
    mutationFn: ({ behaviorId, studentIds, multiplier }: ApplyVars) => behaviorApi.apply({ behaviorId, studentIds, multiplier }),
    onMutate: (vars): { toastId?: string } => {
      if (vars.mode !== 'bulk') return {};
      const behavior = behaviors.find((b) => b.id === vars.behaviorId);
      const quiet = projecting && behavior && !behavior.isPositive;
      const n = vars.studentIds.length;
      return { toastId: toast.loading(quiet ? 'Anotando...' : `Aplicando «${behavior?.name ?? 'comportamiento'}» a ${n} estudiante${n === 1 ? '' : 's'}...`) };
    },
    onSuccess: (result, vars, context) => {
      behaviorUsage.recordUse(result.behavior.id);
      const behavior = result.behavior;
      if (vars.mode !== 'bulk' && !result.awardedBadges?.length) syncStudents(result);
      else queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      markPulse(result);
      invalidateAfterPoints();

      // Subidas e insignias: una sola celebración (con su sonido). Si no, el sonido del punto, salvo en
      // silencio, con los sonidos apagados o, al proyectar, si es negativo.
      const celebrated = celebrateApplyResult(queryClient, classroom.id, result);
      if (!celebrated && feedbackSoundOn() && (behavior.isPositive || !projecting)) play(behavior.isPositive ? 'pointsGain' : 'pointsLoss');

      if (vars.mode === 'round') {
        const first = result.results[0];
        round.recordAward(vars.studentIds[0], first?.pointLogEntryId ?? null);
        toast.success(`${nameById.get(vars.studentIds[0]) ?? first?.studentName ?? 'Estudiante'}: ${behavior.name}`, { id: 'round-award', duration: 1400 });
        return;
      }
      // Al proyectar, lo negativo no dice a quién ni cuánto.
      if (projecting && !behavior.isPositive) {
        showUndoableToast('Anotado', result, context?.toastId);
        return;
      }
      const who = vars.label
        ? `${vars.label}: `
        : result.studentsAffected === 1
          ? `${nameById.get(result.results[0]?.studentId) ?? result.results[0]?.studentName ?? 'Estudiante'}: `
          : `${result.studentsAffected} estudiantes: `;
      const resting = result.restingSkipped && !projecting ? ` · ${result.restingSkipped} descansando (sin HP)` : '';
      showUndoableToast(`${who}${behavior.name} ${summaryOf(result)}${resting}`.trim(), result, context?.toastId);
    },
    onError: (error: unknown, _vars, context) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudo aplicar el comportamiento';
      toast.error(message, context?.toastId ? { id: context.toastId } : undefined);
    },
  });

  const applyOne = (behavior: Behavior, studentId: string) =>
    applyMutation.mutate({ behaviorId: behavior.id, studentIds: [studentId], mode: round.round && behavior.id === round.round.behaviorId ? 'round' : 'quick' });

  const applyFromModal = (behavior: Behavior, multiplier = 1) => {
    if (!pointsTarget) return;
    const { ids, fromSelection } = pointsTarget;
    setPointsTarget(null);
    if (fromSelection) setSelected(new Set());
    applyMutation.mutate({ behaviorId: behavior.id, studentIds: ids, mode: ids.length === 1 ? 'quick' : 'bulk', multiplier });
  };

  const applyManual = async (pointType: 'XP' | 'HP' | 'GP', amount: number, reason: string, competencyId?: string) => {
    if (!pointsTarget) return;
    const { ids, positive, fromSelection } = pointsTarget;
    const levelUps: Array<{ studentId: string; studentName: string; from: number; to: number }> = [];
    let restingIgnored = 0;
    for (const studentId of ids) {
      const result = await studentApi.updatePoints(studentId, { pointType, amount: positive ? amount : -amount, reason, competencyId });
      if (result.restingIgnored) restingIgnored += 1;
      if (result.leveledUp && result.newLevel) {
        levelUps.push({ studentId, studentName: result.studentName, from: result.fromLevel ?? result.newLevel - 1, to: result.newLevel });
      }
    }
    queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
    invalidateAfterPoints();
    setPointsTarget(null);
    if (fromSelection) setSelected(new Set());
    if (projecting && !positive) toast.success('Anotado');
    else toast.success(`Puntos aplicados a ${ids.length} estudiante(s)${restingIgnored && !projecting ? ` · ${restingIgnored} descansando: su energía vuelve con la misión de recuperación` : ''}`);
    celebrateLevelUps(queryClient, classroom.id, levelUps, reason || undefined);
  };

  // ── Roles ───────────────────────────────────────────────────────────────────────────────────────
  const assignRole = useMutation({
    mutationFn: ({ studentIds, roleId }: { studentIds: string[]; roleId: string | null }) =>
      studentIds.length === 1
        ? characterClassApi.assign(classroom.id, studentIds[0], roleId)
        : characterClassApi.bulkAssign(classroom.id, studentIds, roleId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      if (vars.studentIds.length > 1) setSelected(new Set());
      toast.success(vars.roleId ? 'Rol asignado' : 'Rol quitado');
    },
    onError: () => toast.error('No se pudo asignar el rol'),
  });

  // ── «Pasar por todos» ─────────────────────────────────────────────────────────────────────────
  const startRound = () => {
    const behavior = positives.find((b) => b.id === roundChoice);
    if (!behavior) return;
    round.start(behavior);
    setRoundChoice(null);
    changeView('lista');
    setListFilter('round_pending');
    toast.success(`Pasar por todos: ${behavior.name}`);
  };

  const undoLastRound = async () => {
    const last = round.lastAction;
    if (!last?.pointLogEntryId) {
      toast.error('No se pudo identificar el último toque para deshacerlo');
      return;
    }
    setUndoingRound(true);
    try {
      await historyApi.revertEntry('POINTS', last.pointLogEntryId);
      round.dropLast();
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      invalidateAfterPoints();
      toast.success('Último toque deshecho');
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudo deshacer el último toque');
    } finally {
      setUndoingRound(false);
    }
  };

  const finishRound = () => {
    if (!round.round) return;
    const awards = Object.values(round.round.awards);
    toast.success(`Listo: ${awards.reduce((sum, n) => sum + n, 0)} toques a ${awards.length} estudiante(s)`);
    round.finish();
    setListFilter('all');
  };

  // ── Vista y selección ───────────────────────────────────────────────────────────────────────────
  function changeView(next: StudentsView) {
    setView(next);
    writeStudentsView(classroom.id, next);
  }
  const openFicha = (studentId: string) => {
    setSelectedStudentId(studentId);
    changeView('ficha');
  };
  const toggleStudent = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleMany = (ids: string[], select: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
      return next;
    });
  const toggleAll = () => {
    const ids = rows.map((row) => row.student.id);
    toggleMany(ids, !ids.every((id) => selected.has(id)));
  };

  const rowPoints: RowPoints = {
    behavior: roundBehavior ?? quick.rowBehavior,
    positives: featuredPositives,
    negatives: featuredNegatives,
    totalPositives: positives.length,
    totalNegatives: negatives.length,
    pinnedId: quick.pinnedId,
    onPin: round.round ? undefined : quick.pin,
    applying: applyMutation.isPending,
    onApply: applyOne,
    onOpenAll: (studentId, positive) => setPointsTarget({ ids: [studentId], positive, fromSelection: false }),
    onBadge: (studentId) => setBadgeTarget({ ids: [studentId], fromSelection: false }),
    onProfile: (studentId) => navigate(`/classroom/${classroom.id}/student/${studentId}`),
  };
  const focusPoints: FocusPoints = {
    positives: featuredPositives,
    negatives: featuredNegatives,
    totalPositives: positives.length,
    totalNegatives: negatives.length,
    applying: applyMutation.isPending,
    onApply: (behavior, studentId) => applyMutation.mutate({ behaviorId: behavior.id, studentIds: [studentId], mode: 'quick' }),
    onOpenAll: rowPoints.onOpenAll,
  };

  // ── Clanes como columnas ───────────────────────────────────────────────────────────────────────
  const clanSource = clans.length > 0
    ? clans.filter((clan) => clan.isActive !== false).map((clan) => ({ id: clan.id, name: clan.name, color: clan.color, emblem: clan.emblem, motto: clan.motto }))
    : clanOptions.map((clan) => {
      const first = allStudents.find((s) => s.teamId === clan.id);
      return { id: clan.id, name: clan.name, color: clan.color, emblem: first?.clanEmblem ?? null, motto: first?.clanMotto ?? null };
    });
  const clanIds = new Set(clanSource.map((clan) => clan.id));
  const pulseByClan = new Map((pulse?.clans ?? []).map((clan) => [clan.id, clan]));
  const clanColumns: ClanColumn[] = clanSource
    .filter((clan) => !clanFilter || clan.id === clanFilter)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((clan) => {
      const stats = pulseByClan.get(clan.id);
      return {
        id: clan.id,
        name: clan.name,
        color: clan.color,
        emblem: clanEmblem(clan.emblem),
        motto: clan.motto,
        rows: rows.filter((row) => row.student.teamId === clan.id),
        memberIds: allStudents.filter((s) => s.teamId === clan.id).map((s) => s.id),
        weekXp: pulse ? stats?.weekXp ?? 0 : null,
        contributors: projecting || !pulse ? null : new Set(stats?.contributorsToday ?? []),
      };
    });
  const unassignedRows = rows.filter((row) => !row.student.teamId || !clanIds.has(row.student.teamId));

  const attendanceUnlocked = !onboarding || onboarding.isFeatureUnlocked('attendance');
  const showSelectionBar = activeView !== 'ficha' && selected.size > 0;

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/50 dark:bg-gray-800/50" />)}
      </div>
    );
  }

  return (
    <div data-pg="" data-motion={motionLevel} className={`space-y-4 ${showSelectionBar ? 'pb-24' : ''}`}>
      {allStudents.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
          <div className="mx-auto flex w-fit gap-3" aria-hidden="true">
            <span className="text-4xl">🎒</span><span className="text-5xl">🧑‍🎓</span><span className="text-4xl">✏️</span>
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Agrega estudiantes a tu clase</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">
            Añádelos tú, sin cuenta, o que se unan desde su cuenta con el código de la clase
            {projecting ? '.' : <>: <span className="font-mono font-bold">{classroom.code}</span>.</>}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => setShowAddStudents(true)} className={primaryButton}>
              <UserPlus size={16} aria-hidden="true" />
              Añadir alumnos sin cuenta
            </button>
            {!projecting && (
              <button
                type="button"
                onClick={() => { void navigator.clipboard.writeText(classroom.code); toast.success('Código copiado'); }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                <Copy size={16} aria-hidden="true" />
                Copiar código
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <StudentsToolbar
            view={activeView}
            onViewChange={changeView}
            clansEnabled={!!classroom.clansEnabled}
            search={search}
            onSearchChange={setSearch}
            filter={effectiveFilter}
            onFilterChange={setListFilter}
            clans={clanOptions}
            clanFilter={clanFilter}
            onClanFilterChange={setClanFilter}
            total={allStudents.length}
            shown={rows.length}
            projecting={projecting}
            unrecognized={unrecognizedCount}
            resting={restingCount}
            lowHp={lowHpCount}
            absent={absentCount}
            round={round.round ? { pending: allStudents.length - Object.keys(round.round.awards).length, done: Object.keys(round.round.awards).length } : null}
            attendance={attendanceUnlocked && todayAttendance.length < allStudents.length
              ? { marked: todayAttendance.length, onOpen: () => navigate(`/classroom/${classroom.id}/attendance`) }
              : null}
            onStartRound={!round.round && positives.length > 0 ? () => setRoundChoice(quick.rowBehavior?.id ?? positives[0]?.id ?? null) : null}
            levelUps={<TodayLevelUps classroomId={classroom.id} nameOf={(id, fallback) => nameById.get(id) ?? fallback ?? 'Estudiante'} />}
            manage={<StudentsManageMenu classroomId={classroom.id} onAddStudents={() => setShowAddStudents(true)} />}
          />

          {round.round && (
            <div className="pg-surface flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2" role="status">
              <PlayCircle size={18} className="flex-shrink-0 pg-pos-ink" aria-hidden="true" />
              <span className="text-sm pg-fg">
                <span className="font-semibold">Pasar por todos:</span> {round.round.behaviorIcon ?? '⭐'} {round.round.behaviorName}
              </span>
              <span className="text-sm pg-fg2">{Object.keys(round.round.awards).length} de {allStudents.length}</span>
              <span className="ml-auto flex items-center gap-2">
                <button type="button" onClick={undoLastRound} disabled={!round.lastAction || undoingRound} className="pg-btn pg-btn-ghost">
                  <RotateCcw size={16} className={undoingRound ? 'animate-spin' : ''} aria-hidden="true" />
                  Deshacer el último
                </button>
                <button type="button" onClick={finishRound} className="pg-btn">Terminar</button>
              </span>
            </div>
          )}

          {activeView === 'ficha' && (
            <StudentFocusView
              classroom={classroom}
              rows={rows}
              selectedStudentId={selectedStudentId}
              onSelectStudent={setSelectedStudentId}
              projecting={projecting}
              lively={motionLevel === 'full'}
              initial={initial}
              characterClasses={characterClasses}
              points={focusPoints}
              onAwardBadge={(studentId) => setBadgeTarget({ ids: [studentId], fromSelection: false })}
              onRecovery={(studentId) => setRecoveryFor({ id: studentId, name: nameById.get(studentId) ?? 'Estudiante' })}
              onViewProfile={rowPoints.onProfile}
              onAssignRole={(studentId, roleId) => assignRole.mutate({ studentIds: [studentId], roleId })}
              emptyMessage={emptyMessage}
            />
          )}

          {activeView === 'lista' && (
            <StudentsTable
              rows={rows}
              clansEnabled={!!classroom.clansEnabled}
              projecting={projecting}
              selected={selected}
              onToggle={toggleStudent}
              onToggleAll={toggleAll}
              points={rowPoints}
              onOpenFicha={openFicha}
              onRecovery={(studentId) => setRecoveryFor({ id: studentId, name: nameById.get(studentId) ?? 'Estudiante' })}
              emptyMessage={emptyMessage}
            />
          )}

          {activeView === 'clanes' && (
            <ClanBoard
              classroomId={classroom.id}
              clans={clanColumns}
              unassigned={unassignedRows}
              projecting={projecting}
              selected={selected}
              onToggle={toggleStudent}
              onToggleMany={toggleMany}
              points={rowPoints}
              onGiveClan={(behavior, memberIds, clanName) => applyMutation.mutate({ behaviorId: behavior.id, studentIds: memberIds, mode: 'bulk', label: clanName })}
              onOpenAllClan={(memberIds, positive) => setPointsTarget({ ids: memberIds, positive, fromSelection: false })}
              onOpenFicha={openFicha}
            />
          )}
        </>
      )}

      {activeView !== 'ficha' && (
        <SelectionActionBar
          count={selected.size}
          canCorrect={negatives.length > 0}
          characterClasses={characterClasses}
          onGive={() => setPointsTarget({ ids: [...selected], positive: true, fromSelection: true })}
          onCorrect={() => setPointsTarget({ ids: [...selected], positive: false, fromSelection: true })}
          onBadge={() => setBadgeTarget({ ids: [...selected], fromSelection: true })}
          onAssignRole={(roleId) => assignRole.mutate({ studentIds: [...selected], roleId })}
          onClear={() => setSelected(new Set())}
        />
      )}

      {roundChoice !== null && (
        <HomeModal
          title="Pasar por todos"
          subtitle="Un toque por alumno con el mismo comportamiento positivo."
          onClose={() => setRoundChoice(null)}
          footer={(
            <>
              <button type="button" onClick={() => setRoundChoice(null)} className={cancelButton}>Cancelar</button>
              <button type="button" onClick={startRound} disabled={!positives.some((b) => b.id === roundChoice)} className={primaryButton}>Empezar</button>
            </>
          )}
        >
          <div role="radiogroup" aria-label="Comportamiento" className="space-y-1.5">
            {positives.map((behavior) => (
              <button
                key={behavior.id}
                type="button"
                role="radio"
                aria-checked={roundChoice === behavior.id}
                onClick={() => setRoundChoice(behavior.id)}
                className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-3 text-left text-sm font-medium ${
                  roundChoice === behavior.id
                    ? 'border-primary-600 bg-primary-50 text-primary-900 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-100'
                    : 'border-gray-300 text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span className="text-lg" aria-hidden="true">{behavior.icon || '⭐'}</span>
                <span className="line-clamp-2 min-w-0 flex-1 break-words py-1 leading-snug">{behavior.name}</span>
                <span className="flex-shrink-0 text-xs font-bold text-emerald-800 dark:text-emerald-300">{rewardText(behavior)}</span>
              </button>
            ))}
          </div>
        </HomeModal>
      )}

      <PointsModal
        isOpen={!!pointsTarget}
        onClose={() => setPointsTarget(null)}
        isPositive={pointsTarget?.positive ?? true}
        selectedCount={pointsTarget?.ids.length ?? 0}
        selectedStudentNames={(pointsTarget?.ids ?? []).map((id) => nameById.get(id) ?? 'Estudiante')}
        behaviors={projecting || !allowNegative ? positives : behaviors}
        onApplyBehavior={applyFromModal}
        classroom={classroom}
        onApplyManual={applyManual}
        isLoading={applyMutation.isPending}
        classroomId={classroom.id}
      />

      <GiveBadgeModal
        isOpen={!!badgeTarget}
        onClose={() => setBadgeTarget(null)}
        classroomId={classroom.id}
        selectedStudentIds={badgeTarget?.ids ?? []}
        studentNames={(badgeTarget?.ids ?? []).map((id) => nameById.get(id) ?? 'Estudiante')}
        onSuccess={(badge, names) => {
          if (badgeTarget?.fromSelection) setSelected(new Set());
          setBadgeTarget(null);
          celebrateBadgeAward(badge, names);
        }}
      />

      {recoveryFor && (
        <RecoveryMissionModal
          classroomId={classroom.id}
          studentId={recoveryFor.id}
          studentName={recoveryFor.name}
          initial={initial}
          onClose={() => setRecoveryFor(null)}
        />
      )}

      <AddPlaceholderStudentsModal
        isOpen={showAddStudents}
        onClose={() => setShowAddStudents(false)}
        classroomId={classroom.id}
        onStudentsCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
          queryClient.invalidateQueries({ queryKey: ['placeholder-students', classroom.id] });
        }}
      />
    </div>
  );
};
