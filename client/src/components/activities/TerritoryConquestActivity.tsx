import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronDown,
  Crown,
  Flag,
  SlidersHorizontal,
  Pause,
  Play,
  Search,
  Shield,
  Swords,
  Timer,
  Map as MapIcon,
  Trophy,
  Target,
  Clock3,
  AlertCircle,
  CheckCircle2,
  Info,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  questionBankApi,
  type Question,
  type QuestionBank,
  type QuestionDifficulty,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  parseQuestionData,
} from '../../lib/questionBankApi';
import { clanApi, type ClanWithMembers, CLAN_EMBLEMS } from '../../lib/clanApi';
import { behaviorApi, type Behavior } from '../../lib/behaviorApi';
import { studentApi } from '../../lib/studentApi';
import { MultiPointsAnimation, useMultiPointsEffect } from '../effects/PurchaseEffects';
import { PointsModal } from '../modals/PointsModal';
import { useSound, type SoundName } from '../../hooks/useSound';

type GamePhase = 'setup' | 'playing' | 'question' | 'finished';
type VictoryMode = 'territories' | 'points';
type ActionType = 'conquer' | 'attack' | 'defend';
type TerritoryState = 'neutral' | 'occupied';
type DefenseLevel = 'normal' | 'reinforced';

type TerritoryConquestActivityProps = {
  classroom: {
    id: string;
    name: string;
    students?: Array<{ id: string }>;
    clansEnabled?: boolean;
    useCompetencies?: boolean;
    curriculumAreaId?: string;
  };
  onBack: () => void;
};

type ConquestTeam = {
  id: string;
  nombre: string;
  color: string;
  emblema: string;
  puntos_totales: number;
  territorios_controlados: string[];
};

type Territory = {
  id: string;
  nombre: string;
  estado: TerritoryState;
  equipo_dueno_id: string | null;
  nivel_defensa: DefenseLevel;
  valor_puntos: number;
};

type QuestionStep = {
  responderTeamId: string;
  difficulty: QuestionDifficulty;
  label: string;
};

type PendingAction = {
  type: ActionType;
  actorTeamId: string;
  targetTerritoryId: string;
  defenderTeamId?: string;
  targetWasReinforced?: boolean;
};

type SupportedQuestionType = 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';

type NormalizedQuestion = Question & {
  type: SupportedQuestionType;
  optionsParsed: Array<{ text: string; isCorrect: boolean }>;
  correctAnswerParsed: boolean | string | null;
};

const TERRITORY_VALUES = [10, 20, 30];

const ACTION_LABELS: Record<ActionType, string> = {
  conquer: 'Conquistar',
  attack: 'Atacar',
  defend: 'Defender',
};

const getTerritoryRewardMeta = (value: number) => {
  if (value >= 30) {
    return {
      tier: 'Alta recompensa',
      border: 'rgba(251, 191, 36, 0.56)',
      glow: 'rgba(245, 158, 11, 0.48)',
      highlight: 'rgba(251, 191, 36, 0.32)',
      neutralStart: '#4a3a20',
      panelBackground: 'linear-gradient(180deg, rgba(245, 158, 11, 0.24) 0%, rgba(245, 158, 11, 0.08) 100%)',
      statusBackground: 'rgba(245, 158, 11, 0.14)',
    };
  }

  if (value >= 20) {
    return {
      tier: 'Recompensa media',
      border: 'rgba(45, 212, 191, 0.54)',
      glow: 'rgba(20, 184, 166, 0.42)',
      highlight: 'rgba(45, 212, 191, 0.24)',
      neutralStart: '#214457',
      panelBackground: 'linear-gradient(180deg, rgba(45, 212, 191, 0.22) 0%, rgba(45, 212, 191, 0.08) 100%)',
      statusBackground: 'rgba(45, 212, 191, 0.14)',
    };
  }

  return {
    tier: 'Recompensa ligera',
    border: 'rgba(96, 165, 250, 0.48)',
    glow: 'rgba(96, 165, 250, 0.38)',
    highlight: 'rgba(96, 165, 250, 0.24)',
    neutralStart: '#294364',
    panelBackground: 'linear-gradient(180deg, rgba(96, 165, 250, 0.22) 0%, rgba(96, 165, 250, 0.08) 100%)',
    statusBackground: 'rgba(96, 165, 250, 0.14)',
  };
};

const randomTerritoryValue = (index: number) => TERRITORY_VALUES[index % TERRITORY_VALUES.length];

const createTerritories = (count: number): Territory[] =>
  Array.from({ length: count }, (_, idx) => ({
    id: `territory-${idx + 1}`,
    nombre: `Territorio ${idx + 1}`,
    estado: 'neutral',
    equipo_dueno_id: null,
    nivel_defensa: 'normal',
    valor_puntos: randomTerritoryValue(idx),
  }));

const formatSeconds = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const TerritoryChip = ({ team }: { team: ConquestTeam | null }) => {
  if (!team) {
    return (
      <span className="rounded-full border border-white/15 bg-slate-950/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/70 backdrop-blur-sm">
        Neutral
      </span>
    );
  }

  const emblem = CLAN_EMBLEMS[team.emblema] || '🏳️';

  return (
    <span
      className="inline-flex max-w-[138px] items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black text-white backdrop-blur-sm"
      style={{
        backgroundColor: `${team.color}cc`,
        borderColor: `${team.color}f0`,
        boxShadow: `0 0 18px ${team.color}55`,
      }}
    >
      <Flag size={11} className="shrink-0 text-white/90" />
      <span className="shrink-0">{emblem}</span>
      <span className="truncate">{team.nombre}</span>
    </span>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Pantalla final (componente separado para usar hooks de forma limpia)
// ──────────────────────────────────────────────────────────────────────────────
function FinishedScreen({
  ranking,
  winner,
  MEDALS,
  victoryMode,
  allGameStudents,
  classroom,
  restartToSetup,
  onBack,
  play,
}: {
  ranking: ConquestTeam[];
  winner: ConquestTeam | undefined;
  MEDALS: string[];
  victoryMode: 'territories' | 'points';
  allGameStudents: Array<{ id: string; characterName: string | null; firstName: string; lastName: string; clanName: string; clanColor: string }>;
  classroom: { id: string; name: string; useCompetencies?: boolean; curriculumAreaId?: string };
  restartToSetup: () => void;
  onBack: () => void;
  play: (sound: SoundName) => void;
}) {
  const queryClient = useQueryClient();
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [pointsModalPositive, setPointsModalPositive] = useState(true);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const { effect: pointsEffect, showMultiPointsEffect, hideMultiPointsEffect } = useMultiPointsEffect();

  const { data: behaviors = [] } = useQuery({
    queryKey: ['behaviors', classroom.id],
    queryFn: () => behaviorApi.getByClassroom(classroom.id),
  });

  const applyBehaviorMutation = useMutation({
    mutationFn: async ({ behavior, studentIds }: { behavior: Behavior; studentIds: string[] }) => {
      return await behaviorApi.apply({ behaviorId: behavior.id, studentIds });
    },
    onMutate: ({ behavior, studentIds }) => {
      const studentSuffix = studentIds.length === 1 ? '' : 's';
      return {
        toastId: toast.loading(`Aplicando "${behavior.name}" a ${studentIds.length} estudiante${studentSuffix}...`),
      };
    },
    onSuccess: (result, _variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      const behavior = result.behavior;
      const xp = behavior.xpValue || (behavior.pointType === 'XP' ? behavior.pointValue : 0);
      const hp = behavior.hpValue || (behavior.pointType === 'HP' ? behavior.pointValue : 0);
      const gp = behavior.gpValue || (behavior.pointType === 'GP' ? behavior.pointValue : 0);
      const sign = behavior.isPositive ? '+' : '-';
      const parts = [];
      if (xp > 0) parts.push(`${sign}${xp} XP`);
      if (hp > 0) parts.push(`${sign}${hp} HP`);
      if (gp > 0) parts.push(`${sign}${gp} GP`);
      const pointsSummary = parts.length > 0 ? parts.join(', ') : 'Aplicado';

      if (xp > 0 || hp > 0 || gp > 0) {
        showMultiPointsEffect(xp, hp, gp, behavior.isPositive);
      }

      play(pointsModalPositive ? 'pointsGain' : 'pointsLoss');
      if (context?.toastId) {
        toast.success(`${pointsSummary} — ${behavior.name}`, { id: context.toastId, duration: 2500 });
      } else {
        toast.success(`${pointsSummary} — ${behavior.name}`, { duration: 2500 });
      }
    },
    onError: (error: any, variables, context) => {
      setSelectedStudentIds((current) => current.size === 0 ? new Set(variables.studentIds) : current);

      const message = error?.response?.data?.message || 'Error al aplicar comportamiento';
      if (context?.toastId) {
        toast.error(message, { id: context.toastId });
      } else {
        toast.error(message);
      }
    },
  });

  const applyManualMutation = useMutation({
    mutationFn: async ({ pointType, amount, reason, competencyId }: { pointType: string; amount: number; reason: string; competencyId?: string }) => {
      const ids = Array.from(selectedStudentIds);
      const sign = pointsModalPositive ? 1 : -1;
      await Promise.all(
        ids.map((studentId) =>
          studentApi.updatePoints(studentId, {
            pointType: pointType as any,
            amount: sign * amount,
            reason,
            ...(competencyId ? { competencyId } : {}),
          })
        )
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      const xp = variables.pointType === 'XP' ? variables.amount : 0;
      const hp = variables.pointType === 'HP' ? variables.amount : 0;
      const gp = variables.pointType === 'GP' ? variables.amount : 0;

      if (xp > 0 || hp > 0 || gp > 0) {
        showMultiPointsEffect(xp, hp, gp, pointsModalPositive);
      }

      play(pointsModalPositive ? 'pointsGain' : 'pointsLoss');
      setShowPointsModal(false);
    },
  });

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleApplyBehavior = (behavior: Behavior) => {
    const studentIds = Array.from(selectedStudentIds);
    if (studentIds.length === 0) {
      toast.error('Selecciona al menos un estudiante');
      return;
    }

    setShowPointsModal(false);
    setSelectedStudentIds(new Set());
    applyBehaviorMutation.mutate({ behavior, studentIds });
  };

  const selectTeam = (clanName: string) => {
    const teamIds = allGameStudents.filter((s) => s.clanName === clanName).map((s) => s.id);
    setSelectedStudentIds((prev) => {
      const allSelected = teamIds.every((id) => prev.has(id));
      const next = new Set(prev);
      teamIds.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const selectedStudentNames = allGameStudents
    .filter((s) => selectedStudentIds.has(s.id))
    .map((s) => s.characterName || `${s.firstName} ${s.lastName}`);

  // Agrupar estudiantes por equipo para mostrar en la UI
  const byTeam = ranking.map((team) => ({
    team,
    students: allGameStudents.filter((s) => s.clanName === team.nombre),
  }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <MultiPointsAnimation
        show={pointsEffect.show}
        xp={pointsEffect.xp}
        hp={pointsEffect.hp}
        gp={pointsEffect.gp}
        isPositive={pointsEffect.isPositive}
        onComplete={hideMultiPointsEffect}
      />

      {/* Hero compacto */}
      <div
        className="relative overflow-hidden rounded-2xl py-8 px-6 text-center shadow-xl"
        style={{ background: `linear-gradient(135deg, #0f172a 0%, ${winner?.color || '#6366f1'}55 50%, #0f172a 100%)` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-slate-900/70" />
        <div className="relative flex flex-col items-center gap-2">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 140 }}
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl"
            style={{ backgroundColor: winner?.color || '#6366f1' }}
          >
            <Trophy size={28} className="text-white" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-2xl md:text-3xl font-black text-white"
          >
            ¡{winner?.nombre || '?'} gana!
          </motion.h2>
          <p className="text-white/50 text-xs">
            {victoryMode === 'territories' ? 'Territorios' : 'Puntos'} &bull; {winner?.territorios_controlados.length} territorios &bull; {winner?.puntos_totales} pts
          </p>
        </div>
      </div>

      {/* Ranking compacto */}
      <div className="grid grid-cols-3 gap-3">
        {ranking.map((team, idx) => (
          <motion.div
            key={team.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + idx * 0.1 }}
            className={`relative rounded-xl border p-3 text-center ${
              idx === 0 ? 'border-amber-300 shadow-md dark:shadow-amber-900/20' : 'border-gray-200 dark:border-gray-700'
            }`}
            style={idx === 0 ? { backgroundColor: `${team.color}18` } : undefined}
          >
            <div className="text-2xl mb-1">{MEDALS[idx] || `#${idx + 1}`}</div>
            <p className="text-sm font-bold truncate" style={{ color: team.color }}>{team.nombre}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {team.territorios_controlados.length} terr &bull; {team.puntos_totales}pts
            </p>
          </motion.div>
        ))}
      </div>

      {/* Sección premiar estudiantes */}
      {allGameStudents.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" />
              <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Premiar estudiantes</span>
            </div>
            {selectedStudentIds.size > 0 && (
              <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                {selectedStudentIds.size} seleccionado{selectedStudentIds.size !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="p-3 space-y-3">
            {byTeam.map(({ team, students }) => (
              <div key={team.id}>
                <button
                  onClick={() => selectTeam(team.nombre)}
                  className="flex items-center gap-2 mb-1.5 group"
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    {team.nombre}
                  </span>
                  <span className="text-[10px] text-gray-400 group-hover:text-gray-500 transition-colors">(seleccionar equipo)</span>
                </button>
                <div className="flex flex-wrap gap-1.5">
                  {students.map((student) => {
                    const sel = selectedStudentIds.has(student.id);
                    return (
                      <button
                        key={student.id}
                        onClick={() => toggleStudent(student.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          sel
                            ? 'border-indigo-500 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                            : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {sel && <CheckCircle2 size={10} className="inline mr-1 text-indigo-500" />}
                        {student.characterName || `${student.firstName}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Botones de puntos */}
          <div className="flex gap-2 px-3 pb-3">
            <button
              onClick={() => { setPointsModalPositive(true); setShowPointsModal(true); }}
              disabled={selectedStudentIds.size === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Sparkles size={14} />
              + Puntos
            </button>
            <button
              onClick={() => { setPointsModalPositive(false); setShowPointsModal(true); }}
              disabled={selectedStudentIds.size === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Zap size={14} />
              - Puntos
            </button>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={restartToSetup}
          className="rounded-xl px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold hover:from-indigo-700 hover:to-violet-700 shadow-md"
        >
          Nueva partida
        </button>
        <button
          onClick={onBack}
          className="rounded-xl px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
        >
          Volver a actividades
        </button>
      </div>

      {/* Modal de puntos */}
      {showPointsModal && (
        <PointsModal
          isOpen={showPointsModal}
          onClose={() => setShowPointsModal(false)}
          isPositive={pointsModalPositive}
          selectedCount={selectedStudentIds.size}
          selectedStudentNames={selectedStudentNames}
          behaviors={(behaviors as Behavior[]).filter((b) => b.isPositive === pointsModalPositive)}
          onApplyBehavior={handleApplyBehavior}
          onApplyManual={(pointType, amount, reason, competencyId) =>
            applyManualMutation.mutateAsync({ pointType, amount, reason, competencyId })
          }
          isLoading={applyBehaviorMutation.isPending || applyManualMutation.isPending}
          classroomId={classroom.id}
          classroom={classroom as any}
        />
      )}
    </motion.div>
  );
}

export const TerritoryConquestActivity = ({ classroom, onBack }: TerritoryConquestActivityProps) => {
  const { play } = useSound();
  const [phase, setPhase] = useState<GamePhase>('setup');

  const [selectedClanIds, setSelectedClanIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<ConquestTeam[]>([]);

  const [territoryCount, setTerritoryCount] = useState<number>(8);
  const [territories, setTerritories] = useState<Territory[]>([]);

  const [victoryMode, setVictoryMode] = useState<VictoryMode>('territories');
  const [gameDurationMinutes, setGameDurationMinutes] = useState<number>(25);
  const [turnDurationSeconds, setTurnDurationSeconds] = useState<number>(90);
  const [questionDurationSeconds, setQuestionDurationSeconds] = useState<number>(15);

  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [usedQuestionIds, setUsedQuestionIds] = useState<Set<string>>(new Set());
  const [isBankComboboxOpen, setIsBankComboboxOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  const [activeTeamIndex, setActiveTeamIndex] = useState(0);
  const [turnTimeLeft, setTurnTimeLeft] = useState(turnDurationSeconds);
  const [gameTimeLeft, setGameTimeLeft] = useState(gameDurationMinutes * 60);
  const [isPaused, setIsPaused] = useState(false);

  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const [questionSteps, setQuestionSteps] = useState<QuestionStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<NormalizedQuestion | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(questionDurationSeconds);
  const [stepResults, setStepResults] = useState<boolean[]>([]);

  const [singleSelection, setSingleSelection] = useState<number | null>(null);
  const [multiSelection, setMultiSelection] = useState<number[]>([]);
  const [isAnswerLocked, setIsAnswerLocked] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [battleOverlay, setBattleOverlay] = useState<{
    attackerTeam: ConquestTeam;
    defenderTeam: ConquestTeam | null;
    territoryName: string;
    pendingAction: PendingAction;
    steps: QuestionStep[];
  } | null>(null);
  const [conquestCelebration, setConquestCelebration] = useState<{
    teamName: string;
    teamColor: string;
    territoryName: string;
  } | null>(null);
  const [defenseCelebration, setDefenseCelebration] = useState<{
    teamName: string;
    teamColor: string;
    territoryName: string;
  } | null>(null);
  const [lastConqueredId, setLastConqueredId] = useState<string | null>(null);
  const [teamStreaks, setTeamStreaks] = useState<Record<string, number>>({});

  const [eventLog, setEventLog] = useState<string[]>([]);

  const { data: questionBanks = [] } = useQuery({
    queryKey: ['questionBanks', classroom.id],
    queryFn: () => questionBankApi.getBanks(classroom.id),
  });

  const bankComboboxRef = useRef<HTMLDivElement | null>(null);

  const { data: classroomClans = [] } = useQuery({
    queryKey: ['clans', classroom.id],
    queryFn: () => clanApi.getClassroomClans(classroom.id),
    enabled: !!classroom.id,
  });

  const { data: rawPool = [], isLoading: isLoadingQuestions } = useQuery({
    queryKey: ['territory-conquest-questions', classroom.id, [...selectedBankIds].sort().join(',')],
    queryFn: async () => {
      const banksQuestions = await Promise.all(selectedBankIds.map((bankId) => questionBankApi.getQuestions(bankId)));
      return banksQuestions.flat();
    },
    enabled: selectedBankIds.length > 0,
  });

  const normalizedQuestionPool = useMemo<NormalizedQuestion[]>(() => {
    return rawPool
      .map((q) => parseQuestionData(q))
      .filter((q) => q.isActive !== false)
      .filter((q) => q.type === 'TRUE_FALSE' || q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE')
      .map((q) => {
        const optionsParsed = Array.isArray(q.options) ? q.options : [];
        const correctAnswerParsed =
          typeof q.correctAnswer === 'boolean' || typeof q.correctAnswer === 'string' ? q.correctAnswer : null;

        return {
          ...q,
          type: q.type as SupportedQuestionType,
          optionsParsed,
          correctAnswerParsed,
        };
      });
  }, [rawPool]);

  const poolStats = useMemo(() => {
    return normalizedQuestionPool.reduce(
      (acc, q) => {
        acc.total += 1;
        acc[q.difficulty] += 1;
        return acc;
      },
      { total: 0, EASY: 0, MEDIUM: 0, HARD: 0 }
    );
  }, [normalizedQuestionPool]);

  const filteredQuestionBanks = useMemo(() => {
    const query = bankSearch.trim().toLowerCase();
    if (!query) return questionBanks;

    return questionBanks.filter((bank: QuestionBank) => bank.name.toLowerCase().includes(query));
  }, [bankSearch, questionBanks]);

  const selectedBankLabel = useMemo(() => {
    if (selectedBankIds.length === 0) return 'Selecciona uno o mas bancos';

    const selectedBanks = questionBanks.filter((bank: QuestionBank) => selectedBankIds.includes(bank.id));
    if (selectedBanks.length <= 2) return selectedBanks.map((bank: QuestionBank) => bank.name).join(', ');

    return `${selectedBanks.length} bancos seleccionados`;
  }, [questionBanks, selectedBankIds]);

  const activeClans = useMemo(
    () => classroomClans.filter((clan) => clan.isActive !== false),
    [classroomClans]
  );

  const selectedClans = useMemo(
    () => activeClans.filter((clan) => selectedClanIds.includes(clan.id)),
    [activeClans, selectedClanIds]
  );

  const selectedClanMembersCount = useMemo(
    () => selectedClans.reduce((sum, clan) => sum + (clan.members?.length || clan.memberCount || 0), 0),
    [selectedClans]
  );

  const currentTeam = teams[activeTeamIndex] || null;
  const currentStep = questionSteps[currentStepIndex] || null;
  const leadingTeam = useMemo(() => {
    if (teams.length === 0) return null;
    return [...teams].sort((a, b) => {
      if (victoryMode === 'points' && b.puntos_totales !== a.puntos_totales) return b.puntos_totales - a.puntos_totales;
      if (b.territorios_controlados.length !== a.territorios_controlados.length) {
        return b.territorios_controlados.length - a.territorios_controlados.length;
      }
      return b.puntos_totales - a.puntos_totales;
    })[0];
  }, [teams, victoryMode]);

  useEffect(() => {
    if (activeClans.length === 0) {
      setSelectedClanIds([]);
      return;
    }

    setSelectedClanIds((prev) => {
      const stillValid = prev.filter((id) => activeClans.some((clan) => clan.id === id));
      if (stillValid.length > 0) return stillValid;
      return activeClans.map((clan) => clan.id);
    });
  }, [activeClans]);

  useEffect(() => {
    if (!isBankComboboxOpen) {
      setBankSearch('');
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!bankComboboxRef.current?.contains(event.target as Node)) {
        setIsBankComboboxOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isBankComboboxOpen]);

  const teamsById = useMemo(() => {
    const map = new Map<string, ConquestTeam>();
    teams.forEach((team) => map.set(team.id, team));
    return map;
  }, [teams]);

  const availableNeutralTerritories = territories.filter((t) => t.estado === 'neutral');
  const availableEnemyTerritories = currentTeam
    ? territories.filter((t) => t.equipo_dueno_id && t.equipo_dueno_id !== currentTeam.id)
    : [];
  const availableOwnTerritories = currentTeam
    ? territories.filter((t) => t.equipo_dueno_id === currentTeam.id)
    : [];

  const addLog = (text: string) => {
    setEventLog((prev) => [text, ...prev].slice(0, 16));
  };

  const syncTerritoryOwnership = (nextTeams: ConquestTeam[], nextTerritories: Territory[]) => {
    const byTeam = new Map<string, string[]>();
    nextTeams.forEach((team) => byTeam.set(team.id, []));

    nextTerritories.forEach((territory) => {
      if (!territory.equipo_dueno_id) return;
      const list = byTeam.get(territory.equipo_dueno_id);
      if (list) list.push(territory.id);
    });

    return nextTeams.map((team) => ({
      ...team,
      territorios_controlados: byTeam.get(team.id) || [],
    }));
  };

  const rotateTurn = () => {
    play('turnChange');
    setSelectedAction(null);
    setPendingAction(null);
    setQuestionSteps([]);
    setCurrentStepIndex(0);
    setCurrentQuestion(null);
    setStepResults([]);
    setSingleSelection(null);
    setMultiSelection([]);
    setIsAnswerLocked(false);
    setPhase('playing');

    setActiveTeamIndex((prev) => {
      const next = teams.length > 0 ? (prev + 1) % teams.length : 0;
      return next;
    });

    setTurnTimeLeft(turnDurationSeconds);
  };

  const togglePause = () => {
    if (phase !== 'playing' && phase !== 'question') return;
    setIsPaused((prev) => !prev);
  };

  const getQuestionByDifficulty = (difficultyPreference: QuestionDifficulty[]) => {
    const unusedPool = normalizedQuestionPool.filter((q) => !usedQuestionIds.has(q.id));
    if (unusedPool.length === 0) return null;

    for (const difficulty of difficultyPreference) {
      const subset = unusedPool.filter((q) => q.difficulty === difficulty);
      if (subset.length > 0) {
        const picked = subset[Math.floor(Math.random() * subset.length)];
        return picked;
      }
    }

    const fallback = unusedPool[Math.floor(Math.random() * unusedPool.length)];
    return fallback;
  };

  const setQuestionForStep = (steps: QuestionStep[], stepIndex: number) => {
    const step = steps[stepIndex];
    if (!step) return false;

    const difficultyPreference: QuestionDifficulty[] =
      step.difficulty === 'HARD'
        ? ['HARD', 'MEDIUM']
        : step.difficulty === 'MEDIUM'
          ? ['MEDIUM', 'EASY', 'HARD']
          : ['EASY', 'MEDIUM'];

    const picked = getQuestionByDifficulty(difficultyPreference);
    if (!picked) {
      toast.error('No hay más preguntas disponibles en esta sesión para continuar');
      addLog('Sin preguntas disponibles. El turno se omitió.');
      rotateTurn();
      return false;
    }

    setUsedQuestionIds((prev) => {
      const next = new Set(prev);
      next.add(picked.id);
      return next;
    });

    setCurrentQuestion(picked);
    setQuestionTimeLeft(questionDurationSeconds);
    setSingleSelection(null);
    setMultiSelection([]);
    setIsAnswerLocked(false);
    setPhase('question');
    return true;
  };

  const startQuestionFlow = (action: PendingAction, steps: QuestionStep[]) => {
    setPendingAction(action);
    setQuestionSteps(steps);
    setCurrentStepIndex(0);
    setStepResults([]);

    const ok = setQuestionForStep(steps, 0);
    if (ok) {
      addLog(`${currentTeam?.nombre || 'Equipo'} inició acción ${action.type.toUpperCase()} en ${territories.find((t) => t.id === action.targetTerritoryId)?.nombre || 'territorio'}`);
    }
  };

  const resolveAction = (action: PendingAction, results: boolean[]) => {
    const target = territories.find((t) => t.id === action.targetTerritoryId);
    if (!target) {
      rotateTurn();
      return;
    }

    let nextTerritories = [...territories];
    let nextTeams = [...teams];

    const attackerTeam = teamsById.get(action.actorTeamId);
    const defenderTeam = action.defenderTeamId ? teamsById.get(action.defenderTeamId) : null;

    if (action.type === 'conquer') {
      if (results[0]) {
        nextTerritories = nextTerritories.map((territory) =>
          territory.id === action.targetTerritoryId
            ? {
                ...territory,
                estado: 'occupied',
                equipo_dueno_id: action.actorTeamId,
                nivel_defensa: 'normal',
              }
            : territory
        );

        nextTeams = nextTeams.map((team) =>
          team.id === action.actorTeamId
            ? { ...team, puntos_totales: team.puntos_totales + target.valor_puntos }
            : team
        );
        play('conquer');
        addLog(`✅ ${attackerTeam?.nombre || 'Equipo'} conquistó ${target.nombre} (+${target.valor_puntos} pts)`);
        setLastConqueredId(action.targetTerritoryId);
        setTimeout(() => setLastConqueredId(null), 2500);
        if (attackerTeam) {
          setConquestCelebration({ teamName: attackerTeam.nombre, teamColor: attackerTeam.color, territoryName: target.nombre });
          setTimeout(() => setConquestCelebration(null), 2200);
        }
      } else {
        play('pointsLoss');
        addLog(`❌ ${attackerTeam?.nombre || 'Equipo'} falló al conquistar ${target.nombre}`);
      }
    }

    if (action.type === 'defend') {
      if (results[0]) {
        nextTerritories = nextTerritories.map((territory) =>
          territory.id === action.targetTerritoryId
            ? { ...territory, nivel_defensa: 'reinforced' }
            : territory
        );
        play('defend');
        addLog(`🛡️ ${attackerTeam?.nombre || 'Equipo'} reforzó ${target.nombre}`);
        if (attackerTeam) {
          setDefenseCelebration({ teamName: attackerTeam.nombre, teamColor: attackerTeam.color, territoryName: target.nombre });
          setTimeout(() => setDefenseCelebration(null), 2200);
        }
      } else {
        play('pointsLoss');
        nextTerritories = nextTerritories.map((territory) =>
          territory.id === action.targetTerritoryId
            ? { ...territory, nivel_defensa: 'normal' }
            : territory
        );
        addLog(`⚠️ ${attackerTeam?.nombre || 'Equipo'} no logró defender ${target.nombre}`);
      }
    }

    if (action.type === 'attack') {
      const attackerCorrect = results[0] || false;
      const secondAttackerCorrect = action.targetWasReinforced ? (results[1] || false) : true;
      const defenderCorrect = action.targetWasReinforced ? (results[2] || false) : (results[1] || false);

      const attackSucceeded = attackerCorrect && secondAttackerCorrect && !defenderCorrect;

      if (attackSucceeded) {
        nextTerritories = nextTerritories.map((territory) =>
          territory.id === action.targetTerritoryId
            ? {
                ...territory,
                estado: 'occupied',
                equipo_dueno_id: action.actorTeamId,
                nivel_defensa: 'normal',
              }
            : territory
        );

        nextTeams = nextTeams.map((team) =>
          team.id === action.actorTeamId
            ? { ...team, puntos_totales: team.puntos_totales + target.valor_puntos }
            : team
        );

        play('conquer');
        addLog(`⚔️ ${attackerTeam?.nombre || 'Equipo'} conquistó ${target.nombre} a ${defenderTeam?.nombre || 'otro equipo'} (+${target.valor_puntos} pts)`);
        setLastConqueredId(action.targetTerritoryId);
        setTimeout(() => setLastConqueredId(null), 2500);
        if (attackerTeam) {
          setConquestCelebration({ teamName: attackerTeam.nombre, teamColor: attackerTeam.color, territoryName: target.nombre });
          setTimeout(() => setConquestCelebration(null), 2200);
        }
      } else if (!attackerCorrect || !secondAttackerCorrect) {
        play('pointsLoss');
        addLog(`❌ ${attackerTeam?.nombre || 'Equipo'} falló el ataque sobre ${target.nombre}`);
      } else {
        play('defend');
        addLog(`🧱 ${defenderTeam?.nombre || 'Equipo defensor'} resistió el ataque en ${target.nombre}`);
      }
    }

    nextTeams = syncTerritoryOwnership(nextTeams, nextTerritories);

    setTerritories(nextTerritories);
    setTeams(nextTeams);

    rotateTurn();
  };

  const evaluateCurrentAnswer = () => {
    if (!currentQuestion) return false;

    if (currentQuestion.type === 'TRUE_FALSE') {
      if (singleSelection === null) return false;
      const expected = currentQuestion.correctAnswerParsed === true || String(currentQuestion.correctAnswerParsed).toLowerCase() === 'true';
      const selected = singleSelection === 0;
      return selected === expected;
    }

    if (currentQuestion.type === 'SINGLE_CHOICE') {
      if (singleSelection === null) return false;
      const correctIndex = currentQuestion.optionsParsed.findIndex((opt) => opt.isCorrect === true);
      return correctIndex !== -1 && singleSelection === correctIndex;
    }

    if (currentQuestion.type === 'MULTIPLE_CHOICE') {
      if (multiSelection.length === 0) return false;
      const correctIndices = currentQuestion.optionsParsed
        .map((opt, idx) => (opt.isCorrect ? idx : -1))
        .filter((idx) => idx !== -1);

      const selectedSet = new Set(multiSelection);
      const correctSet = new Set(correctIndices);
      if (selectedSet.size !== correctSet.size) return false;

      for (const idx of correctSet) {
        if (!selectedSet.has(idx)) return false;
      }
      return true;
    }

    return false;
  };

  const processStepResult = (isCorrect: boolean, byTimeout?: boolean) => {
    if (isAnswerLocked) return;
    setIsAnswerLocked(true);
    play(isCorrect ? 'correct' : 'wrong');
    setAnswerFeedback(isCorrect ? 'correct' : 'incorrect');
    setTimeout(() => setAnswerFeedback(null), 900);

    const step = questionSteps[currentStepIndex];
    const responderTeam = step ? teamsById.get(step.responderTeamId) : null;

    if (step?.responderTeamId) {
      setTeamStreaks(prev => ({
        ...prev,
        [step.responderTeamId]: isCorrect ? (prev[step.responderTeamId] || 0) + 1 : 0,
      }));
    }

    addLog(`${isCorrect ? '✅' : '❌'} ${responderTeam?.nombre || 'Equipo'} ${isCorrect ? 'acertó' : 'falló'} (${step?.label || 'pregunta'})${byTimeout ? ' por tiempo' : ''}`);

    const nextResults = [...stepResults, isCorrect];
    setStepResults(nextResults);

    const nextStepIndex = currentStepIndex + 1;
    if (nextStepIndex < questionSteps.length) {
      setCurrentStepIndex(nextStepIndex);
      const ok = setQuestionForStep(questionSteps, nextStepIndex);
      if (!ok && pendingAction) {
        resolveAction(pendingAction, nextResults);
      }
      return;
    }

    if (pendingAction) {
      resolveAction(pendingAction, nextResults);
    }
  };

  const submitAnswer = () => {
    const correct = evaluateCurrentAnswer();
    processStepResult(correct);
  };

  const finishGame = () => {
    const ranking = [...teams].sort((a, b) => {
      if (victoryMode === 'points' && b.puntos_totales !== a.puntos_totales) {
        return b.puntos_totales - a.puntos_totales;
      }

      if (victoryMode === 'territories' && b.territorios_controlados.length !== a.territorios_controlados.length) {
        return b.territorios_controlados.length - a.territorios_controlados.length;
      }

      if (b.puntos_totales !== a.puntos_totales) return b.puntos_totales - a.puntos_totales;
      return b.territorios_controlados.length - a.territorios_controlados.length;
    });

    const winner = ranking[0] || null;
    setIsPaused(false);
    setPhase('finished');

    if (winner) {
      play('levelUp');
      addLog(`🏆 Ganador: ${winner.nombre}`);
      toast.success(`Ganador: ${winner.nombre}`);
    }
  };

  const startGame = () => {
    const validTeams = selectedClans.map((clan) => ({
        id: clan.id,
        nombre: clan.name,
        color: clan.color || '#6366f1',
        emblema: clan.emblem || 'shield',
        puntos_totales: 0,
        territorios_controlados: [],
      }));

    if (validTeams.length < 2) {
      toast.error('Selecciona al menos 2 clanes para iniciar');
      return;
    }

    if (selectedBankIds.length === 0) {
      toast.error('Selecciona al menos un banco de preguntas');
      return;
    }

    if (normalizedQuestionPool.length < 6) {
      toast.error('Necesitas al menos 6 preguntas compatibles en los bancos seleccionados');
      return;
    }

    const generatedTerritories = createTerritories(territoryCount);
    const syncedTeams = syncTerritoryOwnership(validTeams, generatedTerritories);

    setTeams(syncedTeams);
    setTerritories(generatedTerritories);
    setUsedQuestionIds(new Set());
    setEventLog([]);

    setActiveTeamIndex(0);
    setTurnTimeLeft(turnDurationSeconds);
    setGameTimeLeft(gameDurationMinutes * 60);
    setIsPaused(false);
    setSelectedAction(null);
    setPendingAction(null);
    setCurrentQuestion(null);
    setQuestionSteps([]);
    setCurrentStepIndex(0);
    setStepResults([]);
    setSingleSelection(null);
    setMultiSelection([]);

    setBattleOverlay(null);
    setConquestCelebration(null);
    setDefenseCelebration(null);
    setLastConqueredId(null);
    setTeamStreaks({});
    setPhase('playing');
    addLog('🎮 Partida iniciada');
  };

  const restartToSetup = () => {
    setPhase('setup');
    setIsPaused(false);
    setTeams([]);
    setTerritories([]);
    setSelectedAction(null);
    setPendingAction(null);
    setCurrentQuestion(null);
    setQuestionSteps([]);
    setCurrentStepIndex(0);
    setStepResults([]);
    setUsedQuestionIds(new Set());
    setBattleOverlay(null);
    setConquestCelebration(null);
    setDefenseCelebration(null);
    setLastConqueredId(null);
    setTeamStreaks({});
  };

  const buildActionSteps = (action: PendingAction, target: Territory): QuestionStep[] => {
    if (action.type === 'conquer') {
      return [{ responderTeamId: action.actorTeamId, difficulty: 'MEDIUM', label: 'Conquistar' }];
    }

    if (action.type === 'defend') {
      const preferred: QuestionDifficulty = Math.random() > 0.5 ? 'EASY' : 'MEDIUM';
      return [{ responderTeamId: action.actorTeamId, difficulty: preferred, label: 'Defender' }];
    }

    const steps: QuestionStep[] = [
      { responderTeamId: action.actorTeamId, difficulty: 'HARD', label: 'Ataque' },
    ];

    if (target.nivel_defensa === 'reinforced') {
      steps.push({ responderTeamId: action.actorTeamId, difficulty: 'HARD', label: 'Ataque reforzado' });
    }

    if (action.defenderTeamId) {
      steps.push({ responderTeamId: action.defenderTeamId, difficulty: 'HARD', label: 'Defensa' });
    }

    return steps;
  };

  const getTerritoryAction = (territory: Territory): ActionType | null => {
    if (!currentTeam || phase !== 'playing') return null;
    if (territory.estado === 'neutral') return 'conquer';
    if (territory.equipo_dueno_id === currentTeam.id) return 'defend';
    if (territory.equipo_dueno_id) return 'attack';
    return null;
  };

  const isTerritorySelectable = (territory: Territory) => {
    return getTerritoryAction(territory) !== null;
  };

  const hasActionTargets = (action: ActionType) => {
    if (action === 'conquer') return availableNeutralTerritories.length > 0;
    if (action === 'attack') return availableEnemyTerritories.length > 0;
    return availableOwnTerritories.length > 0;
  };

  const handleTerritoryClick = (territory: Territory) => {
    if (!currentTeam || phase !== 'playing' || isPaused) return;

    const actionType = getTerritoryAction(territory);

    if (!actionType) {
      toast.error('Ese territorio no es válido para esta acción');
      return;
    }

    setSelectedAction(actionType);

    const action: PendingAction = {
      type: actionType,
      actorTeamId: currentTeam.id,
      targetTerritoryId: territory.id,
      defenderTeamId: territory.equipo_dueno_id || undefined,
      targetWasReinforced: territory.nivel_defensa === 'reinforced',
    };

    const steps = buildActionSteps(action, territory);

    if (actionType === 'attack') {
      const defenderTeam = territory.equipo_dueno_id ? teamsById.get(territory.equipo_dueno_id) || null : null;
      play('battleStart');
      setBattleOverlay({
        attackerTeam: currentTeam,
        defenderTeam,
        territoryName: territory.nombre,
        pendingAction: action,
        steps,
      });
      setTimeout(() => {
        setBattleOverlay(null);
        startQuestionFlow(action, steps);
      }, 1800);
      return;
    }

    play('select');
    startQuestionFlow(action, steps);
  };

  const toggleBank = (bankId: string) => {
    setSelectedBankIds((prev) =>
      prev.includes(bankId) ? prev.filter((id) => id !== bankId) : [...prev, bankId]
    );
  };

  const toggleClan = (clanId: string) => {
    setSelectedClanIds((prev) =>
      prev.includes(clanId) ? prev.filter((id) => id !== clanId) : [...prev, clanId]
    );
  };

  useEffect(() => {
    if (phase !== 'playing' && phase !== 'question') return;
    if (isPaused) return;
    if (gameTimeLeft <= 0) {
      finishGame();
      return;
    }

    const timeout = setTimeout(() => {
      setGameTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [phase, gameTimeLeft, isPaused]);

  useEffect(() => {
    if (phase !== 'playing' && phase !== 'question') return;
    if (isPaused) return;
    if (turnTimeLeft <= 0) {
      if (phase === 'question') {
        toast.error('Tiempo del turno agotado: respuesta marcada incorrecta');
        processStepResult(false, true);
      } else {
        toast.error('Tiempo del turno agotado: se pasa al siguiente equipo');
        addLog(`⏱️ Turno de ${currentTeam?.nombre || 'equipo'} expiró`);
        rotateTurn();
      }
      return;
    }

    const timeout = setTimeout(() => {
      setTurnTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [phase, turnTimeLeft, currentTeam?.nombre, isPaused]);

  useEffect(() => {
    if (phase !== 'question') return;
    if (isPaused) return;
    if (questionTimeLeft <= 0) {
      toast.error('Tiempo de pregunta agotado');
      processStepResult(false, true);
      return;
    }

    const timeout = setTimeout(() => {
      setQuestionTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [phase, questionTimeLeft, isPaused]);

  if (phase === 'setup') {
    const totalStudents = classroom.students?.length || 0;
    const clansEnabled = classroom?.clansEnabled !== false;
    const hasEnoughClans = selectedClans.length >= 2;
    const sectionPanelClass = 'rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-900/80';
    const setupInputClass = 'mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-800 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-indigo-600 dark:focus:ring-indigo-900/30';
    const setupMetrics = [
      {
        label: 'Estudiantes en clase',
        value: totalStudents,
        helper: 'Base total disponible',
        className: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200',
      },
      {
        label: 'En clanes elegidos',
        value: selectedClanMembersCount,
        helper: 'Participan en la partida',
        className: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300',
      },
      {
        label: 'Clanes listos',
        value: selectedClans.length,
        helper: 'Equipos seleccionados',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300',
      },
    ];
    const quickStartGuide = [
      {
        title: '1. Prepara la partida',
        description: 'Selecciona al menos 2 clanes, define los territorios y elige los bancos de preguntas compatibles.',
        icon: <Flag size={16} />,
        accent: 'text-emerald-600 dark:text-emerald-300',
        bg: 'bg-emerald-500/10',
      },
      {
        title: '2. Juega por turnos',
        description: 'Cada equipo entra en turno y actua tocando un territorio del mapa para conquistar, atacar o defender.',
        icon: <Target size={16} />,
        accent: 'text-cyan-600 dark:text-cyan-300',
        bg: 'bg-cyan-500/10',
      },
      {
        title: '3. Resuelve y avanza',
        description: 'Las respuestas correctas cambian el control del mapa. Si necesitas detener la clase, usa el boton de pausa.',
        icon: <Sparkles size={16} />,
        accent: 'text-violet-600 dark:text-violet-300',
        bg: 'bg-violet-500/10',
      },
    ];

    return (
      <div className="relative space-y-5">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/70 dark:border-emerald-800/50 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-5 shadow-xl">
          <div className="absolute -top-20 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2.5 rounded-xl bg-white/20 text-white border border-white/30 hover:bg-white/30"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center border border-white/30">
                <MapIcon size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">Conquista del Territorio</h1>
                <p className="text-sm text-white/85">Modo show para aula proyectada: clanes, mapa y preguntas en tiempo real</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-white/95">
              <span className="rounded-full px-3 py-1 bg-white/20 border border-white/30 text-xs font-bold">{selectedClans.length} clanes</span>
              <span className="rounded-full px-3 py-1 bg-white/20 border border-white/30 text-xs font-bold">{territoryCount} territorios</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-800 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-sky-500/15 p-2 text-sky-600 dark:text-sky-300">
              <Info size={16} />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-wide">Tipos de pregunta permitidos</p>
              <p className="mt-1 text-sm leading-relaxed text-sky-700 dark:text-sky-100/90">
                Esta actividad solo usa preguntas de verdadero o falso, selección única y selección múltiple. Las preguntas de relación no se incluyen en la partida.
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-3xl border border-gray-200/80 bg-white/95 p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/95 space-y-5">
            <div className={sectionPanelClass}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <Flag size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-gray-900 dark:text-gray-100">Equipos desde clanes</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Elige qué clanes participarán en la conquista y verifica cuántos estudiantes entran al tablero.
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                  {selectedClans.length} seleccionados
                </span>
              </div>

              {!clansEnabled && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-700 p-3 text-sm font-medium">
                  Debes activar clanes en la configuración del aula para usar esta actividad.
                </div>
              )}

              {clansEnabled && activeClans.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-700 p-3 text-sm font-medium">
                  No hay clanes activos en esta clase. Crea al menos 2 clanes para iniciar.
                </div>
              )}

              {clansEnabled && activeClans.length > 0 && (
                <div className="space-y-3">
                  {activeClans.map((clan: ClanWithMembers) => {
                    const isSelected = selectedClanIds.includes(clan.id);
                    const membersCount = clan.members?.length || clan.memberCount || 0;
                    return (
                      <button
                        key={clan.id}
                        onClick={() => toggleClan(clan.id)}
                        className={`group w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                          isSelected
                            ? 'border-indigo-300 bg-gradient-to-r from-indigo-50 via-white to-violet-50 dark:from-indigo-950/30 dark:via-gray-900 dark:to-violet-950/20 dark:border-indigo-700 shadow-md'
                            : 'border-gray-200 bg-white/90 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30 dark:hover:border-gray-600 dark:hover:bg-gray-900/50'
                        }`}
                        style={isSelected ? { boxShadow: `0 12px 24px ${clan.color}18` } : undefined}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/70 text-lg shadow-sm"
                              style={{ background: `linear-gradient(135deg, ${clan.color} 0%, ${clan.color}cc 100%)` }}
                            >
                              <span>{CLAN_EMBLEMS[clan.emblem] || '🛡️'}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-black text-gray-900 dark:text-gray-100">{clan.name}</span>
                                {isSelected && (
                                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                    En partida
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Clan listo para conquistar, atacar o defender territorios.
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${isSelected ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                              <Users size={12} />
                              {membersCount} miembros
                            </span>
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${isSelected ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'border-gray-200 bg-white text-gray-300 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-500'}`}>
                              {isSelected ? <CheckCircle2 size={16} /> : <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: clan.color }} />}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  <div className="grid gap-3 sm:grid-cols-3">
                    {setupMetrics.map((metric) => (
                      <div key={metric.label} className={`rounded-2xl border p-3 ${metric.className}`}>
                        <p className="text-[11px] font-black uppercase tracking-wide opacity-70">{metric.label}</p>
                        <p className="mt-1 text-2xl font-black tabular-nums">{metric.value}</p>
                        <p className="text-xs opacity-75">{metric.helper}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={sectionPanelClass}>
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-gray-100">Configuración de la partida</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Ajusta el tamaño del mapa, la condición de victoria y los tiempos antes de iniciar la actividad.
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-gray-400 dark:text-gray-500">Mapa</p>
                      <label className="mt-1 block text-sm font-bold text-gray-900 dark:text-gray-100">Territorios</label>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Controla el tamaño del tablero de conquista.</p>
                    </div>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                      {territoryCount}
                    </span>
                  </div>
                <input
                  type="range"
                  min={6}
                  max={16}
                  value={territoryCount}
                  onChange={(e) => setTerritoryCount(Number(e.target.value))}
                  className="mt-4 w-full accent-indigo-500"
                />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
                    <span>6</span>
                    <span className="font-semibold text-gray-600 dark:text-gray-300">{territoryCount} territorios</span>
                    <span>16</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-gray-400 dark:text-gray-500">Objetivo</p>
                      <label className="mt-1 block text-sm font-bold text-gray-900 dark:text-gray-100">Victoria por</label>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Define si gana el clan con mas territorio o mas puntos.</p>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
                      <Crown size={16} />
                    </div>
                  </div>
                  <select
                    value={victoryMode}
                    onChange={(e) => setVictoryMode(e.target.value as VictoryMode)}
                    className={setupInputClass}
                  >
                    <option value="territories">Cantidad de territorios</option>
                    <option value="points">Puntos totales</option>
                  </select>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-gray-400 dark:text-gray-500">Ritmo</p>
                      <label className="mt-1 block text-sm font-bold text-gray-900 dark:text-gray-100">Duración total</label>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Tiempo disponible para completar toda la partida.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {gameDurationMinutes} min
                    </span>
                  </div>
                  <input
                    type="number"
                    min={20}
                    max={30}
                    value={gameDurationMinutes}
                    onChange={(e) => setGameDurationMinutes(Number(e.target.value))}
                    className={setupInputClass}
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-gray-400 dark:text-gray-500">Turnos</p>
                      <label className="mt-1 block text-sm font-bold text-gray-900 dark:text-gray-100">Tiempo por turno</label>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Marca cuánto dura el turno de cada clan en juego.</p>
                    </div>
                    <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                      {turnDurationSeconds}s
                    </span>
                  </div>
                  <input
                    type="number"
                    min={60}
                    max={120}
                    value={turnDurationSeconds}
                    onChange={(e) => setTurnDurationSeconds(Number(e.target.value))}
                    className={setupInputClass}
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50 sm:col-span-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-gray-400 dark:text-gray-500">Preguntas</p>
                      <label className="mt-1 block text-sm font-bold text-gray-900 dark:text-gray-100">Tiempo por pregunta</label>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Controla la ventana de respuesta para cada reto del mapa.</p>
                    </div>
                    <div className="flex h-9 min-w-[68px] items-center justify-center rounded-full bg-violet-50 px-3 text-xs font-bold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                      {questionDurationSeconds}s
                    </div>
                  </div>
                  <input
                    type="number"
                    min={10}
                    max={20}
                    value={questionDurationSeconds}
                    onChange={(e) => setQuestionDurationSeconds(Number(e.target.value))}
                    className={setupInputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Banco de preguntas</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Selecciona uno o más bancos. Solo se usarán preguntas de V/F, selección única y selección múltiple.</p>

            <div ref={bankComboboxRef} className="relative">
              <button
                type="button"
                onClick={() => setIsBankComboboxOpen((prev) => !prev)}
                disabled={questionBanks.length === 0}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900/30 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/20"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Bancos seleccionados</p>
                  <p className="mt-1 truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{questionBanks.length === 0 ? 'No hay bancos disponibles' : selectedBankLabel}</p>
                </div>
                {questionBanks.length > 0 && (
                  <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                    {selectedBankIds.length}
                  </span>
                )}
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-gray-400 transition-transform dark:text-gray-500 ${isBankComboboxOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {isBankComboboxOpen && questionBanks.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="border-b border-gray-100 p-3 dark:border-gray-700">
                      <div className="relative">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                        <input
                          type="text"
                          value={bankSearch}
                          onChange={(e) => setBankSearch(e.target.value)}
                          placeholder="Buscar banco..."
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-800 outline-none transition-colors focus:border-indigo-300 focus:bg-white dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-indigo-600"
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                        Puedes seleccionar varios bancos sin expandir el layout.
                      </p>
                    </div>

                    <div className="max-h-64 space-y-2 overflow-y-auto p-2">
                      {filteredQuestionBanks.map((bank: QuestionBank) => {
                        const isSelected = selectedBankIds.includes(bank.id);

                        return (
                          <button
                            key={bank.id}
                            type="button"
                            onClick={() => toggleBank(bank.id)}
                            className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                              isSelected
                                ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-700'
                                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30 dark:hover:bg-gray-900/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{bank.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{bank.questionCount ?? 0} preguntas</p>
                              </div>
                              {isSelected && (
                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                  Activo
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}

                      {filteredQuestionBanks.length === 0 && (
                        <div className="rounded-xl border border-dashed border-gray-300 p-3 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400">
                          No hay bancos que coincidan con tu busqueda.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Preguntas compatibles</p>
              <p className="mt-1 text-lg font-black text-gray-800 dark:text-gray-100">
                {isLoadingQuestions ? 'Cargando...' : poolStats.total}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <span className="rounded-md bg-emerald-100 text-emerald-700 px-2 py-1 text-center">Fácil: {poolStats.EASY}</span>
                <span className="rounded-md bg-amber-100 text-amber-700 px-2 py-1 text-center">Media: {poolStats.MEDIUM}</span>
                <span className="rounded-md bg-rose-100 text-rose-700 px-2 py-1 text-center">Difícil: {poolStats.HARD}</span>
              </div>
            </div>

            <button
              onClick={startGame}
              disabled={!clansEnabled || !hasEnoughClans}
              className="w-full rounded-xl py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black shadow-lg hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Iniciar Conquista del Territorio
            </button>
            {!hasEnoughClans && clansEnabled && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Selecciona al menos 2 clanes para iniciar.
              </p>
            )}

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-gray-400 dark:text-gray-500">Guia rapida</p>
                  <h3 className="text-sm font-black text-gray-900 dark:text-gray-100">Como funciona</h3>
                </div>
                <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  Usuarios nuevos
                </span>
              </div>

              <div className="space-y-2.5">
                {quickStartGuide.map((step) => (
                  <div key={step.title} className="rounded-xl border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-800/80">
                    <div className="flex items-start gap-2.5">
                      <div className={`mt-0.5 rounded-lg p-2 ${step.bg} ${step.accent}`}>
                        {step.icon}
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-900 dark:text-gray-100">{step.title}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">{step.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'finished') {
    const ranking = [...teams].sort((a, b) => {
      if (victoryMode === 'points' && b.puntos_totales !== a.puntos_totales) return b.puntos_totales - a.puntos_totales;
      if (victoryMode === 'territories' && b.territorios_controlados.length !== a.territorios_controlados.length) {
        return b.territorios_controlados.length - a.territorios_controlados.length;
      }
      return b.puntos_totales - a.puntos_totales;
    });
    const winner = ranking[0];
    const MEDALS = ['🥇', '🥈', '🥉'];

    // All students across participating clans
    const allGameStudents = selectedClans.flatMap((clan) =>
      (clan.members || []).map((m) => ({ ...m, clanName: clan.name, clanColor: clan.color || '#6366f1' }))
    );

    return <FinishedScreen
      ranking={ranking}
      winner={winner}
      MEDALS={MEDALS}
      victoryMode={victoryMode}
      allGameStudents={allGameStudents}
      classroom={classroom}
      restartToSetup={restartToSetup}
      onBack={onBack}
      play={play}
    />;
  }

  const questionProgress = Math.max(0, Math.min(1, questionDurationSeconds > 0 ? questionTimeLeft / questionDurationSeconds : 0));
  const timerRadius = 42;
  const timerCircumference = 2 * Math.PI * timerRadius;
  const timerOffset = timerCircumference * (1 - questionProgress);

  return (
    <div className="relative space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-slate-700 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 shadow-2xl">
        <div className="absolute -top-20 -right-14 w-64 h-64 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={restartToSetup}
              className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20"
              title="Volver a configuración"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-11 h-11 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/20">
              <MapIcon size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Conquista del Territorio</h2>
              <p className="text-xs text-slate-200/90">{classroom.name}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-indigo-300/30 bg-indigo-400/10 px-3 py-2 text-indigo-100">
              <div className="flex items-center gap-1 text-xs font-semibold"><Clock3 size={13} /> Partida</div>
              <p className="text-base font-black tabular-nums">{formatSeconds(gameTimeLeft)}</p>
            </div>
            <motion.div
              animate={turnTimeLeft <= 10 ? { scale: [1, 1.06, 1] } : {}}
              transition={{ duration: 0.5, repeat: turnTimeLeft <= 10 ? Infinity : 0 }}
              className={`rounded-xl border px-3 py-2 ${
                turnTimeLeft <= 10
                  ? 'border-rose-300/60 bg-rose-500/30 text-rose-100'
                  : turnTimeLeft <= 20
                  ? 'border-amber-300/40 bg-amber-500/20 text-amber-100'
                  : 'border-amber-300/40 bg-amber-500/20 text-amber-100'
              }`}
            >
              <div className="flex items-center gap-1 text-xs font-semibold"><Timer size={13} /> Turno</div>
              <p className="text-base font-black tabular-nums">{formatSeconds(turnTimeLeft)}</p>
            </motion.div>
            {leadingTeam && (
              <div className="rounded-xl border border-amber-300/40 bg-amber-500/20 px-3 py-2 text-amber-100">
                <div className="flex items-center gap-1 text-xs font-semibold"><Crown size={13} /> Lidera</div>
                <p className="text-sm font-black truncate max-w-[150px]" style={{ color: leadingTeam.color }}>{leadingTeam.nombre}</p>
              </div>
            )}
            <button
              onClick={togglePause}
              className={`rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                isPaused
                  ? 'border-emerald-300/60 bg-emerald-500/25 text-emerald-50 hover:bg-emerald-500/35'
                  : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <span className="flex items-center gap-2">
                {isPaused ? <Play size={15} /> : <Pause size={15} />}
                {isPaused ? 'Reanudar' : 'Pausar'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500">Turno actual</p>
              <p className="text-2xl font-black" style={{ color: currentTeam?.color || '#111827' }}>{currentTeam?.nombre}</p>
            </div>
            <span className="text-[11px] rounded-full px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
              Victoria por {victoryMode === 'territories' ? 'territorios' : 'puntos'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
            {teams.map((team) => {
              const isActiveTeam = currentTeam?.id === team.id;
              const isLeaderTeam = leadingTeam?.id === team.id;
              const streak = teamStreaks[team.id] || 0;
              const minTerr = teams.length > 1 ? Math.min(...teams.map(t => t.territorios_controlados.length)) : 0;
              const isInDanger = teams.length > 1
                && team.territorios_controlados.length === minTerr
                && teams.some(t => t.id !== team.id && t.territorios_controlados.length > minTerr);
              const statusBadge =
                isLeaderTeam && team.territorios_controlados.length > 0
                  ? { label: '\ud83d\udc51 Dominando', cn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' }
                  : streak >= 2
                  ? { label: '\ud83d\udd25 En racha', cn: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' }
                  : isInDanger
                  ? { label: '\u26a0\ufe0f En peligro', cn: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' }
                  : null;
              return (
                <motion.div
                  key={team.id}
                  animate={isActiveTeam ? { scale: [1, 1.025, 1] } : { scale: 1 }}
                  transition={{ duration: 1.5, repeat: isActiveTeam ? Infinity : 0 }}
                  className={`relative rounded-xl overflow-hidden border ${
                    isActiveTeam
                      ? 'border-gray-300 dark:border-gray-500 shadow-md'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                  style={isActiveTeam ? { boxShadow: `0 0 16px ${team.color}40` } : undefined}
                >
                  <div className="h-1.5" style={{ backgroundColor: team.color }} />
                  <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{team.nombre}</p>
                      {isLeaderTeam && <Crown size={13} className="text-amber-500 shrink-0" />}
                    </div>
                    {statusBadge && (
                      <span className={`inline-block mb-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadge.cn}`}>
                        {statusBadge.label}
                      </span>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Terr. <span className="font-bold text-gray-900 dark:text-white">{team.territorios_controlados.length}</span></span>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Pts <span className="font-bold text-gray-900 dark:text-white">{team.puntos_totales}</span></span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(100,120,160,0.10) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-black tracking-[0.18em] uppercase text-gray-500 dark:text-gray-400">
                Mapa de Territorios
              </p>
              <button className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium border border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-300 transition-colors">
                <Info size={10} /> Ver leyenda
              </button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] rounded-full px-3 py-0.5 font-semibold bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200">
                Haz clic en un territorio y la acción se activa automáticamente
              </span>
              {selectedAction && (
                <span className="text-[11px] rounded-full px-3 py-0.5 font-semibold bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/40 text-indigo-600 dark:text-indigo-300">
                  Última acción: {ACTION_LABELS[selectedAction]}
                </span>
              )}
            </div>

            <div className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200">
              El botín de cada zona (+10, +20 o +30) solo suma puntos al conquistarla. La dificultad depende de la acción: conquistar usa media, defender usa fácil o media y atacar usa difícil.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
              {territories.map((territory, idx) => {
                const ownerTeam = territory.equipo_dueno_id ? teamsById.get(territory.equipo_dueno_id) || null : null;
                const territoryAction = getTerritoryAction(territory);
                const selectable = isTerritorySelectable(territory);
                const isLastConquered = lastConqueredId === territory.id;
                const isReinforced = territory.nivel_defensa === 'reinforced';
                const isNotTarget = phase === 'playing' && !selectable;
                const rewardMeta = getTerritoryRewardMeta(territory.valor_puntos);
                const territoryStatusLabel = ownerTeam
                  ? (isReinforced ? 'Fortificado' : 'Bajo control')
                  : 'Sin conquistar';
                const actionBadgeClass = territoryAction === 'conquer'
                  ? 'border-emerald-200/50 bg-emerald-500/20 text-emerald-50'
                  : territoryAction === 'attack'
                    ? 'border-rose-200/50 bg-rose-500/20 text-rose-50'
                    : territoryAction === 'defend'
                      ? 'border-sky-200/50 bg-sky-500/20 text-sky-50'
                      : 'border-white/10 bg-black/10 text-white/60';

                return (
                  <motion.button
                    key={territory.id}
                    animate={isLastConquered ? { scale: [1, 1.1, 1, 1.04, 1] } : {}}
                    transition={isLastConquered ? { duration: 1.2, ease: 'easeInOut' } : {}}
                      whileHover={selectable ? { y: -4, scale: 1.02 } : undefined}
                    whileTap={selectable ? { scale: 0.96 } : undefined}
                    onClick={() => handleTerritoryClick(territory)}
                    disabled={!selectable || phase !== 'playing' || isPaused}
                      className={`relative overflow-hidden rounded-[26px] border text-left min-h-[182px] p-3 transition-opacity duration-200 ${
                        isNotTarget ? 'opacity-[0.42]' : 'opacity-100'
                      } ${selectable ? 'cursor-pointer' : 'cursor-default'}`}
                    style={{
                        borderColor: ownerTeam ? `${ownerTeam.color}45` : rewardMeta.border,
                      background: ownerTeam
                        ? `radial-gradient(circle at 16% 18%, ${rewardMeta.highlight} 0%, transparent 38%), linear-gradient(148deg, ${ownerTeam.color}f2 0%, ${ownerTeam.color}cc 52%, #101828 100%)`
                        : `radial-gradient(circle at 16% 18%, ${rewardMeta.highlight} 0%, transparent 38%), linear-gradient(148deg, ${rewardMeta.neutralStart} 0%, #223250 55%, #101828 100%)`,
                      boxShadow: selectable
                        ? `0 0 0 2.5px rgba(255,255,255,0.75), 0 0 28px ${ownerTeam ? ownerTeam.color + '80' : rewardMeta.glow}, 0 8px 20px rgba(0,0,0,0.55)`
                        : isLastConquered && ownerTeam
                        ? `0 0 36px ${ownerTeam.color}95, 0 8px 24px rgba(0,0,0,0.5)`
                        : ownerTeam
                        ? `0 6px 20px ${ownerTeam.color}50, 0 3px 8px rgba(0,0,0,0.45)`
                        : `0 4px 14px ${rewardMeta.glow}, 0 4px 14px rgba(0,0,0,0.55)`,
                    }}
                  >
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'linear-gradient(138deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 38%, rgba(0,0,0,0.08) 62%, rgba(0,0,0,0.30) 100%)',
                      }}
                    />
                    <div
                      className="absolute inset-0 pointer-events-none opacity-35"
                      style={{
                        backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
                        backgroundSize: '26px 26px',
                      }}
                    />
                    <div
                      className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.42) 0%, transparent 100%)' }}
                    />

                    <div className="relative z-10 flex h-full flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 max-w-[62%]">
                          <div className="mb-1 flex items-center gap-2">
                          <p className="text-[10px] font-bold leading-none" style={{ color: 'rgba(255,255,255,0.44)' }}>{idx + 1}.</p>
                          <span
                            className="rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-white/80"
                            style={{ borderColor: rewardMeta.border, backgroundColor: rewardMeta.statusBackground }}
                          >
                            {rewardMeta.tier}
                          </span>
                        </div>
                          <p className="text-[12px] font-black text-white leading-snug" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                          {territory.nombre}
                        </p>
                          <p className="mt-1 text-[10px] font-medium leading-relaxed text-white/72">
                          {ownerTeam ? `Zona de ${ownerTeam.nombre}` : 'Territorio neutral disponible'}
                        </p>
                        </div>
                        {territoryAction && (
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${actionBadgeClass}`}>
                            {ACTION_LABELS[territoryAction]}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex items-end justify-between gap-2">
                        <div className="flex min-w-0 flex-col items-start gap-1.5">
                          <TerritoryChip team={ownerTeam} />
                          <div className="flex flex-wrap gap-1.5">
                            <span
                              className="rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/78 backdrop-blur-sm"
                              style={{
                                borderColor: ownerTeam ? `${ownerTeam.color}66` : rewardMeta.border,
                                backgroundColor: ownerTeam ? 'rgba(15,23,42,0.28)' : rewardMeta.statusBackground,
                              }}
                            >
                              {territoryStatusLabel}
                            </span>
                            {isReinforced && (
                              <span className="rounded-full border border-sky-300/50 bg-sky-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-sky-50">
                                Reforzado
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          className="shrink-0 rounded-2xl border px-2.5 py-2 text-right text-white backdrop-blur-sm"
                          style={{
                            borderColor: rewardMeta.border,
                            background: rewardMeta.panelBackground,
                            boxShadow: `0 0 20px ${rewardMeta.glow}`,
                          }}
                        >
                          <p className="text-[8px] font-black uppercase tracking-[0.24em] text-white/55">Botin</p>
                          <p className="text-lg font-black leading-none">+{territory.valor_puntos}</p>
                          <p className="mt-1 text-[9px] font-semibold text-white/72">Puntos al ganar</p>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="h-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <p className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Acciones</p>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Se activan desde la tarjeta del territorio que elijas en el mapa.</p>
            <div className="space-y-2">
              <div
                className={`w-full rounded-xl border-2 px-3 py-3 text-left font-bold transition-all ${
                  selectedAction === 'conquer'
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                    : hasActionTargets('conquer')
                      ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 text-gray-400 dark:text-gray-500 opacity-60'
                }`}
              >
                <span className="flex items-center gap-2 text-sm"><Target size={16} className="shrink-0" /> Conquistar neutral</span>
                <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500 mt-0.5 block">Haz clic en un territorio neutral</span>
              </div>

              <div
                className={`w-full rounded-xl border-2 px-3 py-3 text-left font-bold transition-all ${
                  selectedAction === 'attack'
                    ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300'
                    : hasActionTargets('attack')
                      ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-900/10 text-rose-700 dark:text-rose-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 text-gray-400 dark:text-gray-500 opacity-60'
                }`}
              >
                <span className="flex items-center gap-2 text-sm"><Swords size={16} className="shrink-0" /> Atacar enemigo</span>
                <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500 mt-0.5 block">Haz clic en un territorio rival</span>
              </div>

              <div
                className={`w-full rounded-xl border-2 px-3 py-3 text-left font-bold transition-all ${
                  selectedAction === 'defend'
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : hasActionTargets('defend')
                      ? 'border-blue-200 bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 text-gray-400 dark:text-gray-500 opacity-60'
                }`}
              >
                <span className="flex items-center gap-2 text-sm"><Shield size={16} className="shrink-0" /> Defender propio</span>
                <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500 mt-0.5 block">Haz clic en un territorio de tu clan</span>
              </div>
            </div>

            <button
              onClick={rotateTurn}
              disabled={phase !== 'playing' || isPaused}
              className="mt-3 w-full rounded-xl px-3 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40"
            >
              Pasar turno
            </button>
          </div>

          <div className="h-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <p className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Feed de batalla</p>
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {eventLog.length === 0 && (
                <p className="text-xs text-gray-400 italic">Sin eventos aún.</p>
              )}
              {eventLog.map((item, idx) => (
                <motion.div
                  key={`${item}-${idx}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-gray-700 dark:text-gray-300"
                >
                  {item}
                </motion.div>
              ))}
            </div>
          </div>

          <div className="h-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Fin de partida</p>
              <AlertCircle size={13} className="text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Termina cuando el docente lo decida.</p>
            <button
              onClick={finishGame}
              className="mt-auto w-full rounded-xl px-3 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:from-amber-600 hover:to-orange-600 shadow-md"
            >
              Finalizar ahora
            </button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-2">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-emerald-700 dark:text-emerald-400">
          <p className="text-xs font-bold flex items-center gap-1"><Target size={12} /> Conquistar</p>
          <p className="text-[11px] mt-0.5 text-emerald-600/70 dark:text-emerald-500/80">Neutral + respuesta media correcta = control del territorio</p>
        </div>
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-rose-700 dark:text-rose-400">
          <p className="text-xs font-bold flex items-center gap-1"><Swords size={12} /> Atacar</p>
          <p className="text-[11px] mt-0.5 text-rose-600/70 dark:text-rose-500/80">Atacante acierta y defensor falla para conquistar</p>
        </div>
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 p-3 text-blue-700 dark:text-blue-400">
          <p className="text-xs font-bold flex items-center gap-1"><Shield size={12} /> Defender</p>
          <p className="text-[11px] mt-0.5 text-blue-600/70 dark:text-blue-500/80">Acierto = reforzado, fallo = normal</p>
        </div>
      </div>

      <AnimatePresence>
        {conquestCelebration && (
          <motion.div
            key="conquest-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[155] flex flex-col items-center justify-center pointer-events-none bg-slate-950/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.3, rotate: -15, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 14 }}
              className="flex flex-col items-center gap-5 text-center px-8"
            >
              <div
                className="w-28 h-28 rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white/20"
                style={{ backgroundColor: conquestCelebration.teamColor }}
              >
                <Flag size={56} className="text-white drop-shadow-lg" />
              </div>
              <div className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-5 py-1.5">
                <p className="text-emerald-300 uppercase tracking-widest text-sm font-bold">✅ Territorio conquistado</p>
              </div>
              <p
                className="text-5xl md:text-7xl font-black leading-none text-white"
                style={{ textShadow: `-2px -2px 0 ${conquestCelebration.teamColor}, 2px -2px 0 ${conquestCelebration.teamColor}, -2px 2px 0 ${conquestCelebration.teamColor}, 2px 2px 0 ${conquestCelebration.teamColor}, 0 0 40px ${conquestCelebration.teamColor}` }}
              >
                {conquestCelebration.teamName}
              </p>
              <div className="rounded-2xl border border-white/20 bg-slate-800/80 px-6 py-2.5">
                <p className="text-xl font-bold text-white">{conquestCelebration.territoryName}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {defenseCelebration && (
          <motion.div
            key="defense-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[155] flex flex-col items-center justify-center pointer-events-none bg-slate-950/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.3, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 1.15, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 160, damping: 14 }}
              className="flex flex-col items-center gap-5 text-center px-8"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -6, 6, 0] }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="w-28 h-28 rounded-full bg-blue-600 flex items-center justify-center shadow-2xl ring-4 ring-blue-400/40"
              >
                <Shield size={56} className="text-white drop-shadow-lg" fill="rgba(255,255,255,0.3)" />
              </motion.div>
              <div className="rounded-full bg-blue-500/20 border border-blue-400/40 px-5 py-1.5">
                <p className="text-blue-300 uppercase tracking-widest text-sm font-bold">🛡️ ¡Defensa exitosa!</p>
              </div>
              <p
                className="text-5xl md:text-7xl font-black leading-none text-white"
                style={{ textShadow: `-2px -2px 0 ${defenseCelebration.teamColor}, 2px -2px 0 ${defenseCelebration.teamColor}, -2px 2px 0 ${defenseCelebration.teamColor}, 2px 2px 0 ${defenseCelebration.teamColor}, 0 0 40px ${defenseCelebration.teamColor}` }}
              >
                {defenseCelebration.teamName}
              </p>
              <div className="rounded-2xl border border-white/20 bg-slate-800/80 px-6 py-2.5">
                <p className="text-xl font-bold text-white">{defenseCelebration.territoryName} reforzado</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {battleOverlay && (
          <motion.div
            key="battle-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="fixed inset-0 z-[160] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md"
          >
            <motion.p
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-white/50 uppercase tracking-widest text-xs mb-8"
            >
              ⚔️ Batalla por territorio
            </motion.p>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 md:gap-12 w-full max-w-3xl px-6">
              <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.08, type: 'spring', stiffness: 160 }}
                className="text-right"
              >
                <p className="text-xs uppercase text-white/40 tracking-wider mb-2">Atacante</p>
                <p
                  className="text-3xl md:text-5xl font-black leading-tight"
                  style={{ color: battleOverlay.attackerTeam.color }}
                >
                  {battleOverlay.attackerTeam.nombre}
                </p>
              </motion.div>

              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.22, type: 'spring', stiffness: 200 }}
                className="flex flex-col items-center gap-3"
              >
                <Swords size={52} className="text-white drop-shadow-lg" />
                <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-center">
                  <p className="text-[11px] text-white/50 uppercase tracking-wide">Por el control de</p>
                  <p className="text-lg font-black text-cyan-300">{battleOverlay.territoryName}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.08, type: 'spring', stiffness: 160 }}
                className="text-left"
              >
                <p className="text-xs uppercase text-white/40 tracking-wider mb-2">Defensor</p>
                <p
                  className="text-3xl md:text-5xl font-black leading-tight"
                  style={{ color: battleOverlay.defenderTeam?.color || '#94a3b8' }}
                >
                  {battleOverlay.defenderTeam?.nombre || 'Sin dueño'}
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {answerFeedback && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-[150] px-5 py-2.5 rounded-full text-white font-bold shadow-xl ${
            answerFeedback === 'correct' ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        >
          {answerFeedback === 'correct' ? '✅ Respuesta correcta' : '❌ Respuesta incorrecta'}
        </motion.div>
      )}

      {phase === 'question' && currentQuestion && currentStep && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[140] bg-slate-950/75 backdrop-blur-sm p-4 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.96, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            className="w-full max-w-5xl rounded-3xl border border-white/20 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 md:p-6 text-white shadow-2xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-indigo-200">Paso {currentStepIndex + 1}/{questionSteps.length}</p>
                <p className="text-lg font-black">
                  Responde: <span style={{ color: teamsById.get(currentStep.responderTeamId)?.color || '#fff' }}>{teamsById.get(currentStep.responderTeamId)?.nombre}</span>
                </p>
                <p className="text-xs text-slate-300">{currentStep.label}</p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold ${DIFFICULTY_COLORS[currentStep.difficulty] || 'bg-gray-100 text-gray-700'}`}>
                  {DIFFICULTY_LABELS[currentStep.difficulty] || currentStep.difficulty}
                </span>

                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={timerRadius} stroke="rgba(148,163,184,0.35)" strokeWidth="8" fill="none" />
                    <circle
                      cx="50"
                      cy="50"
                      r={timerRadius}
                      stroke={questionTimeLeft <= 5 ? '#fb7185' : '#22d3ee'}
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={timerCircumference}
                      strokeDashoffset={timerOffset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-2xl font-black tabular-nums">
                    {questionTimeLeft}
                  </div>
                </div>
                <button
                  onClick={togglePause}
                  className={`rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                    isPaused
                      ? 'border-emerald-300/60 bg-emerald-500/25 text-emerald-50 hover:bg-emerald-500/35'
                      : 'border-white/15 bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {isPaused ? <Play size={15} /> : <Pause size={15} />}
                    {isPaused ? 'Reanudar' : 'Pausar'}
                  </span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-300/40 bg-indigo-400/10 px-4 py-4 mb-4">
              <p className="text-base md:text-lg font-bold leading-relaxed">{currentQuestion.questionText}</p>
            </div>

            {currentQuestion.type === 'TRUE_FALSE' && (
              <div className="grid md:grid-cols-2 gap-3 mb-4">
                {['Verdadero', 'Falso'].map((label, idx) => (
                  <button
                    key={label}
                    onClick={() => setSingleSelection(idx)}
                    className={`rounded-2xl border-2 p-4 text-lg font-black transition-all ${
                      singleSelection === idx
                        ? 'border-cyan-300 bg-cyan-400/20 text-cyan-100 scale-[1.01]'
                        : 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {(currentQuestion.type === 'SINGLE_CHOICE' || currentQuestion.type === 'MULTIPLE_CHOICE') && (
              <div className="grid md:grid-cols-2 gap-3 mb-4">
                {currentQuestion.optionsParsed.map((option, idx) => {
                  const isSelected =
                    currentQuestion.type === 'SINGLE_CHOICE'
                      ? singleSelection === idx
                      : multiSelection.includes(idx);

                  return (
                    <button
                      key={`${currentQuestion.id}-${idx}`}
                      onClick={() => {
                        if (currentQuestion.type === 'SINGLE_CHOICE') {
                          setSingleSelection(idx);
                        } else {
                          setMultiSelection((prev) =>
                            prev.includes(idx) ? prev.filter((item) => item !== idx) : [...prev, idx]
                          );
                        }
                      }}
                      className={`rounded-2xl border-2 p-4 text-left transition-all ${
                        isSelected
                          ? 'border-cyan-300 bg-cyan-400/20 text-cyan-100'
                          : 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                      }`}
                    >
                      <span className="text-sm font-black opacity-90">{String.fromCharCode(65 + idx)}.</span>
                      <p className="text-sm md:text-base font-semibold mt-1">{option.text}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === 'MULTIPLE_CHOICE' && (
              <p className="text-xs text-slate-300 mb-3">Selecciona todas las opciones correctas antes de validar.</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={submitAnswer}
                disabled={isAnswerLocked || isPaused}
                className="rounded-xl px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 text-white font-bold hover:from-cyan-600 hover:to-indigo-600 disabled:opacity-50"
              >
                Validar respuesta
              </button>
              <button
                onClick={() => processStepResult(false)}
                disabled={isAnswerLocked || isPaused}
                className="rounded-xl px-5 py-2.5 bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 disabled:opacity-50"
              >
                Marcar incorrecta
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <AnimatePresence>
        {isPaused && (phase === 'playing' || phase === 'question') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.94, y: 18, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/95 p-6 text-center shadow-2xl"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
                <Pause size={30} />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-300">Pausa general</p>
              <h3 className="mt-2 text-2xl font-black text-white">La partida esta detenida</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                El tiempo de la partida, del turno y de la pregunta queda congelado hasta que la reanudes.
              </p>
              <button
                onClick={togglePause}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 font-bold text-white shadow-lg hover:from-emerald-600 hover:to-teal-600"
              >
                <Play size={16} /> Reanudar partida
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
