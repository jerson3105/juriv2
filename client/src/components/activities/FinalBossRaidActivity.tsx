import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  CheckCircle2,
  Flame,
  Play,
  RotateCcw,
  Shield,
  Skull,
  Timer,
  Target,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { type Student } from '../../lib/classroomApi';
import {
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  questionBankApi,
  type MatchingPair,
  type Question,
  type QuestionDifficulty,
  type QuestionOption,
} from '../../lib/questionBankApi';
import { FinalBossRaidScene, type FinalBossRaidTheme } from './FinalBossRaidScene';

type ClassroomLike = {
  id: string;
  students?: Student[];
};

type RaidDifficultyFilter = QuestionDifficulty | 'ALL';
type RaidView = 'setup' | 'battle' | 'result';
type TurnOutcome = 'perfect' | 'partial' | 'wrong' | 'timeout';
type ScenePulseType = 'idle' | 'hit' | 'boss' | 'victory' | 'defeat';

type RaidQuestion = Question & {
  maxDamage: number;
  resolveLoss: number;
};

type RaidRun = {
  questions: RaidQuestion[];
  responderOrder: string[];
  bossHp: number;
  bossMaxHp: number;
  resolve: number;
  resolveMax: number;
  fury: number;
  currentQuestionIndex: number;
  combo: number;
  bestCombo: number;
  perfectAnswers: number;
  partialAnswers: number;
  failedAnswers: number;
  totalDamage: number;
  bossBursts: number;
};

type TurnResult = {
  outcome: TurnOutcome;
  accuracy: number;
  damage: number;
  resolveLoss: number;
  comboBonusDamage: number;
  bossBurstDamage: number;
  summary: string;
};

const BOSS_THEMES: FinalBossRaidTheme[] = [
  {
    id: 'abyssal-vortex',
    bossName: 'Voragor del Vacio',
    title: 'Jefe cooperativo',
    subtitle: 'Un coloso astral que absorbe conocimiento y responde con furia cuando el aula duda.',
    description: 'Cada respuesta correcta abre grietas de luz en su coraza. Si el aula mantiene el combo, desata un golpe coral.',
    gradient: 'from-violet-600 via-fuchsia-500 to-rose-500',
    badge: 'Nexo del vacio',
    colors: {
      primary: '#8b5cf6',
      secondary: '#ec4899',
      tertiary: '#f472b6',
      arena: '#111827',
      fog: '#140f2d',
    },
  },
  {
    id: 'solar-warden',
    bossName: 'Aegis Solar',
    title: 'Jefe cooperativo',
    subtitle: 'Un guardian mecanico que cambia de fase y sobrecarga el campo cuando detecta errores.',
    description: 'La clase le rompe el blindaje resolviendo preguntas. Cada tres aciertos perfectos activa un impacto resonante.',
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    badge: 'Asedio solar',
    colors: {
      primary: '#f59e0b',
      secondary: '#fb7185',
      tertiary: '#fde047',
      arena: '#1f2937',
      fog: '#26140c',
    },
  },
  {
    id: 'glacier-hydra',
    bossName: 'Hidra Boreal',
    title: 'Jefe cooperativo',
    subtitle: 'Una bestia helada que endurece su escudo si la clase pierde el ritmo.',
    description: 'Las respuestas precisas congelan sus ataques y las asociaciones correctas parten sus cristales.',
    gradient: 'from-sky-500 via-cyan-500 to-emerald-500',
    badge: 'Ruptura glacial',
    colors: {
      primary: '#38bdf8',
      secondary: '#2dd4bf',
      tertiary: '#93c5fd',
      arena: '#0f172a',
      fog: '#08202d',
    },
  },
];

const DIFFICULTY_BASE_DAMAGE: Record<QuestionDifficulty, number> = {
  EASY: 90,
  MEDIUM: 120,
  HARD: 150,
};

const TYPE_DAMAGE_FACTOR: Record<Question['type'], number> = {
  TRUE_FALSE: 0.9,
  SINGLE_CHOICE: 1,
  MULTIPLE_CHOICE: 1.15,
  MATCHING: 1.25,
};

const QUESTION_COUNT_OPTIONS = [5, 8, 10, 12];

const clamp = (value: number, minValue: number, maxValue: number) => Math.min(maxValue, Math.max(minValue, value));

const shuffleArray = <T,>(items: T[]) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
  }
  return copy;
};

const parseQuestionOptions = (question: Question): QuestionOption[] => {
  if (Array.isArray(question.options)) {
    return question.options;
  }

  if (typeof question.options === 'string') {
    try {
      const parsed = JSON.parse(question.options);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const parseQuestionPairs = (question: Question): MatchingPair[] => {
  if (Array.isArray(question.pairs)) {
    return question.pairs;
  }

  if (typeof question.pairs === 'string') {
    try {
      const parsed = JSON.parse(question.pairs);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const getSingleCorrectIndex = (question: Question): number => {
  const options = parseQuestionOptions(question);
  const optionIndex = options.findIndex((option) => option.isCorrect === true || option.isCorrect === ('true' as unknown as boolean));
  if (optionIndex >= 0) {
    return optionIndex;
  }

  if (question.correctAnswer === true || question.correctAnswer === 'true') {
    return 0;
  }
  if (question.correctAnswer === false || question.correctAnswer === 'false') {
    return 1;
  }
  if (typeof question.correctAnswer === 'number') {
    return question.correctAnswer;
  }

  return 0;
};

const getMultipleCorrectIndices = (question: Question): number[] => {
  const options = parseQuestionOptions(question);
  const indices = options.reduce<number[]>((result, option, index) => {
    if (option.isCorrect === true || option.isCorrect === ('true' as unknown as boolean)) {
      result.push(index);
    }
    return result;
  }, []);

  return indices.length > 0 ? indices : [0];
};

const getQuestionMaxDamage = (question: Question) => {
  const baseDamage = DIFFICULTY_BASE_DAMAGE[question.difficulty] || DIFFICULTY_BASE_DAMAGE.MEDIUM;
  const typeFactor = TYPE_DAMAGE_FACTOR[question.type] || 1;
  return Math.round(baseDamage * typeFactor);
};

const getQuestionResolveLoss = (question: Question) => {
  return Math.max(10, Math.round(getQuestionMaxDamage(question) * 0.18));
};

const getQuestionAccuracy = (
  question: Question,
  answers: {
    trueFalseAnswer: boolean | null;
    selectedOption: number | null;
    selectedMultiple: number[];
    selectedPairs: MatchingPair[];
  },
) => {
  if (question.type === 'TRUE_FALSE') {
    if (answers.trueFalseAnswer === null) {
      return 0;
    }
    const correct = question.correctAnswer === true || question.correctAnswer === 'true';
    return answers.trueFalseAnswer === correct ? 1 : 0;
  }

  if (question.type === 'SINGLE_CHOICE') {
    if (answers.selectedOption === null) {
      return 0;
    }
    return answers.selectedOption === getSingleCorrectIndex(question) ? 1 : 0;
  }

  if (question.type === 'MULTIPLE_CHOICE') {
    const correctIndices = getMultipleCorrectIndices(question);
    if (answers.selectedMultiple.length === 0 || correctIndices.length === 0) {
      return 0;
    }

    const correctSet = new Set(correctIndices);
    const correctHits = answers.selectedMultiple.filter((answerIndex) => correctSet.has(answerIndex)).length;
    const wrongHits = answers.selectedMultiple.filter((answerIndex) => !correctSet.has(answerIndex)).length;
    const rawScore = (correctHits - wrongHits * 0.5) / correctIndices.length;
    return clamp(rawScore, 0, 1);
  }

  const pairs = parseQuestionPairs(question);
  if (pairs.length === 0 || answers.selectedPairs.length === 0) {
    return 0;
  }

  const correctMatches = answers.selectedPairs.filter((answer) => pairs.some((pair) => pair.left === answer.left && pair.right === answer.right)).length;
  return clamp(correctMatches / pairs.length, 0, 1);
};

const getBossPhase = (bossHp: number, bossMaxHp: number) => {
  const healthPercent = bossMaxHp > 0 ? (bossHp / bossMaxHp) * 100 : 0;
  if (healthPercent > 66) return 1;
  if (healthPercent > 33) return 2;
  return 3;
};

const battleOutcomeCopy: Record<TurnOutcome, { title: string; tone: string }> = {
  perfect: { title: 'Golpe critico', tone: 'text-emerald-300' },
  partial: { title: 'Impacto parcial', tone: 'text-amber-300' },
  wrong: { title: 'Contraataque del jefe', tone: 'text-rose-300' },
  timeout: { title: 'Tiempo agotado', tone: 'text-orange-300' },
};

const getStudentDisplayLabel = (student: Student, index: number) => {
  const realName = [student.realName, student.realLastName].filter(Boolean).join(' ').trim();
  if (realName) {
    return realName;
  }
  if (student.displayName?.trim()) {
    return student.displayName.trim();
  }
  if (student.characterName?.trim()) {
    return student.characterName.trim();
  }
  return `Estudiante ${index + 1}`;
};

const getStudentInitials = (name: string) => {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'AU';
};

const buildResponderOrder = (students?: Student[]) => {
  const roster = (students || []).map((student, index) => getStudentDisplayLabel(student, index));
  return roster.length > 0 ? shuffleArray(roster) : ['Vocero del aula'];
};

const MatchingComposer = ({
  pairs,
  answers,
  onChange,
  disabled,
  showResult,
}: {
  pairs: MatchingPair[];
  answers: MatchingPair[];
  onChange: (value: MatchingPair[]) => void;
  disabled: boolean;
  showResult: boolean;
}) => {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  const shuffledRight = useMemo(() => shuffleArray(pairs.map((pair) => pair.right)), [pairs]);

  useEffect(() => {
    setSelectedLeft(null);
  }, [pairs]);

  const handleLeftClick = (left: string) => {
    if (disabled || answers.some((answer) => answer.left === left)) {
      return;
    }
    setSelectedLeft(left);
  };

  const handleRightClick = (right: string) => {
    if (disabled || !selectedLeft || answers.some((answer) => answer.right === right)) {
      return;
    }
    onChange([...answers, { left: selectedLeft, right }]);
    setSelectedLeft(null);
  };

  const isCorrectPair = (left: string, right: string) => pairs.some((pair) => pair.left === left && pair.right === right);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        {pairs.map((pair) => {
          const matched = answers.find((answer) => answer.left === pair.left);
          return (
            <button
              key={pair.left}
              type="button"
              onClick={() => handleLeftClick(pair.left)}
              disabled={disabled || !!matched}
              className={`w-full rounded-2xl border px-3 py-3 text-left text-sm transition-all ${
                selectedLeft === pair.left
                  ? 'border-indigo-400 bg-indigo-500/20 text-white'
                  : matched
                    ? showResult
                      ? isCorrectPair(pair.left, matched.right)
                        ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                        : 'border-rose-400 bg-rose-500/15 text-rose-100'
                      : 'border-white/10 bg-white/10 text-white/70'
                    : 'border-white/10 bg-white/5 text-white/85 hover:border-white/25 hover:bg-white/10'
              }`}
            >
              {pair.left}
            </button>
          );
        })}
      </div>
      <div className="space-y-2">
        {shuffledRight.map((right) => {
          const matched = answers.find((answer) => answer.right === right);
          return (
            <button
              key={right}
              type="button"
              onClick={() => handleRightClick(right)}
              disabled={disabled || !selectedLeft || !!matched}
              className={`w-full rounded-2xl border px-3 py-3 text-left text-sm transition-all ${
                matched
                  ? showResult
                    ? isCorrectPair(matched.left, right)
                      ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                      : 'border-rose-400 bg-rose-500/15 text-rose-100'
                    : 'border-white/10 bg-white/10 text-white/70'
                  : selectedLeft
                    ? 'border-cyan-300 bg-cyan-500/15 text-white hover:bg-cyan-500/20'
                    : 'border-white/10 bg-white/5 text-white/60'
              }`}
            >
              {right}
            </button>
          );
        })}
      </div>
      <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
        <span>{answers.length} de {pairs.length} pares conectados</span>
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={disabled || answers.length === 0}
          className="rounded-full border border-white/10 px-3 py-1 text-white/80 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reiniciar pares
        </button>
      </div>
    </div>
  );
};

export const FinalBossRaidActivity = ({ classroom, onBack }: { classroom: ClassroomLike; onBack: () => void }) => {
  const [view, setView] = useState<RaidView>('setup');
  const [selectedThemeId, setSelectedThemeId] = useState(BOSS_THEMES[0].id);
  const [selectedDifficulty, setSelectedDifficulty] = useState<RaidDifficultyFilter>('ALL');
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(8);
  const [raidRun, setRaidRun] = useState<RaidRun | null>(null);
  const [battleOutcome, setBattleOutcome] = useState<'victory' | 'defeat' | null>(null);
  const [turnResult, setTurnResult] = useState<TurnResult | null>(null);
  const [pulseState, setPulseState] = useState<{ token: number; type: ScenePulseType }>({ token: 0, type: 'idle' });

  const [selectedTrueFalse, setSelectedTrueFalse] = useState<boolean | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedMultiple, setSelectedMultiple] = useState<number[]>([]);
  const [selectedPairs, setSelectedPairs] = useState<MatchingPair[]>([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [answerLocked, setAnswerLocked] = useState(false);

  const { data: questionBanks = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['questionBanks', classroom.id],
    queryFn: () => questionBankApi.getBanks(classroom.id),
    enabled: !!classroom.id,
  });

  const selectedBankKey = useMemo(() => [...selectedBankIds].sort().join('|'), [selectedBankIds]);

  const { data: questionPool = [], isLoading: loadingQuestionPool, isFetching: fetchingQuestionPool } = useQuery({
    queryKey: ['boss-raid-question-pool', classroom.id, selectedBankKey, selectedDifficulty],
    queryFn: async () => {
      const responses = await Promise.all(selectedBankIds.map((bankId) => questionBankApi.getQuestions(bankId)));
      return responses
        .flat()
        .filter((question) => question.isActive)
        .filter((question) => selectedDifficulty === 'ALL' || question.difficulty === selectedDifficulty);
    },
    enabled: selectedBankIds.length > 0,
  });

  const activeTheme = useMemo(
    () => BOSS_THEMES.find((theme) => theme.id === selectedThemeId) || BOSS_THEMES[0],
    [selectedThemeId],
  );

  const studentsCount = classroom.students?.length || 0;

  const questionPoolStats = useMemo(() => {
    return questionPool.reduce<Record<string, number>>((result, question) => {
      result[question.type] = (result[question.type] || 0) + 1;
      return result;
    }, {});
  }, [questionPool]);

  const difficultyStats = useMemo(() => {
    return questionPool.reduce<Record<string, number>>((result, question) => {
      result[question.difficulty] = (result[question.difficulty] || 0) + 1;
      return result;
    }, {});
  }, [questionPool]);

  const currentQuestion = raidRun?.questions[raidRun.currentQuestionIndex] || null;
  const currentQuestionOptions = currentQuestion ? parseQuestionOptions(currentQuestion) : [];
  const currentQuestionPairs = currentQuestion ? parseQuestionPairs(currentQuestion) : [];
  const currentQuestionTimeLimit = currentQuestion?.timeLimitSeconds || 30;

  const bossPhase = raidRun ? getBossPhase(raidRun.bossHp, raidRun.bossMaxHp) : 1;
  const healthPercent = raidRun ? Math.max(0, (raidRun.bossHp / raidRun.bossMaxHp) * 100) : 100;
  const resolvePercent = raidRun ? Math.max(0, (raidRun.resolve / raidRun.resolveMax) * 100) : 100;
  const furyPercent = raidRun ? raidRun.fury : 0;

  useEffect(() => {
    if (view !== 'battle' || !currentQuestion) {
      return;
    }

    setSelectedTrueFalse(null);
    setSelectedOption(null);
    setSelectedMultiple([]);
    setSelectedPairs([]);
    setTimeLeft(currentQuestionTimeLimit);
    setAnswerLocked(false);
  }, [view, currentQuestion?.id, currentQuestionTimeLimit]);

  useEffect(() => {
    if (view !== 'battle' || !currentQuestion || answerLocked || battleOutcome) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [view, currentQuestion?.id, answerLocked, battleOutcome, timeLeft]);

  useEffect(() => {
    if (view !== 'battle' || !currentQuestion || answerLocked || battleOutcome || timeLeft > 0) {
      return;
    }

    handleResolveTurn(true);
  }, [timeLeft, view, currentQuestion?.id, answerLocked, battleOutcome]);

  useEffect(() => {
    if (view === 'result' && battleOutcome === 'victory') {
      confetti({
        particleCount: 160,
        spread: 80,
        origin: { y: 0.25 },
        colors: ['#8b5cf6', '#ec4899', '#38bdf8', '#f59e0b', '#10b981'],
      });
    }
  }, [view, battleOutcome]);

  const toggleBankSelection = (bankId: string) => {
    setSelectedBankIds((current) => (
      current.includes(bankId)
        ? current.filter((item) => item !== bankId)
        : [...current, bankId]
    ));
  };

  const startRaid = () => {
    if (selectedBankIds.length === 0) {
      toast.error('Selecciona al menos un banco de preguntas');
      return;
    }

    if (questionPool.length < questionCount) {
      toast.error('No hay suficientes preguntas activas para iniciar el asalto');
      return;
    }

    const selectedQuestions = shuffleArray(questionPool)
      .slice(0, questionCount)
      .map((question) => ({
        ...question,
        maxDamage: getQuestionMaxDamage(question),
        resolveLoss: getQuestionResolveLoss(question),
      }));

    const bossMaxHp = selectedQuestions.reduce((total, question) => total + question.maxDamage, 0);
    const resolveMax = Math.max(80, selectedQuestions.reduce((total, question) => total + question.resolveLoss, 0));
    const responderOrder = buildResponderOrder(classroom.students);

    setRaidRun({
      questions: selectedQuestions,
      responderOrder,
      bossHp: bossMaxHp,
      bossMaxHp,
      resolve: resolveMax,
      resolveMax,
      fury: 8,
      currentQuestionIndex: 0,
      combo: 0,
      bestCombo: 0,
      perfectAnswers: 0,
      partialAnswers: 0,
      failedAnswers: 0,
      totalDamage: 0,
      bossBursts: 0,
    });
    setBattleOutcome(null);
    setTurnResult(null);
    setPulseState((current) => ({ token: current.token + 1, type: 'idle' }));
    setView('battle');
  };

  const handleResolveTurn = (timedOut = false) => {
    if (!raidRun || !currentQuestion || answerLocked) {
      return;
    }

    setAnswerLocked(true);

    const accuracy = timedOut
      ? 0
      : getQuestionAccuracy(currentQuestion, {
          trueFalseAnswer: selectedTrueFalse,
          selectedOption,
          selectedMultiple,
          selectedPairs,
        });

    const comboAfter = accuracy === 1 ? raidRun.combo + 1 : 0;
    const comboBonusDamage = accuracy === 1 && comboAfter > 0 && comboAfter % 3 === 0
      ? Math.round(currentQuestion.maxDamage * 0.2)
      : 0;
    const damage = Math.round(currentQuestion.maxDamage * accuracy) + comboBonusDamage;

    let resolveLoss = 0;
    let fury = raidRun.fury;
    let outcome: TurnOutcome = 'wrong';
    let summary = '';

    if (timedOut) {
      outcome = 'timeout';
      resolveLoss = Math.round(currentQuestion.resolveLoss * 1.15);
      fury = clamp(fury + 28, 0, 100);
      summary = 'El aula perdio el tiempo del turno y el jefe respondio con una descarga brutal.';
    } else if (accuracy === 1) {
      outcome = 'perfect';
      resolveLoss = 0;
      fury = clamp(fury - 14, 0, 100);
      summary = comboBonusDamage > 0
        ? 'Golpe perfecto. El combo coral desato una rafaga extra sobre el jefe.'
        : 'Respuesta perfecta. El aula encontro una abertura y ataco a plena potencia.';
    } else if (accuracy > 0) {
      outcome = 'partial';
      resolveLoss = Math.max(4, Math.round(currentQuestion.resolveLoss * 0.45));
      fury = clamp(fury + 12, 0, 100);
      summary = 'La clase conecto solo parte de la mecanica. Hubo dano, pero el jefe gano impulso.';
    } else {
      outcome = 'wrong';
      resolveLoss = currentQuestion.resolveLoss;
      fury = clamp(fury + 22, 0, 100);
      summary = 'La respuesta no rompio la defensa. El jefe aprovecho para contraatacar.';
    }

    let bossBurstDamage = 0;
    let nextBossBursts = raidRun.bossBursts;
    if (fury >= 100) {
      bossBurstDamage = Math.max(10, Math.round(raidRun.resolveMax * 0.12));
      resolveLoss += bossBurstDamage;
      fury = 35;
      nextBossBursts += 1;
      summary += ' La furia del jefe se desbordo y descargo una onda devastadora sobre el aula.';
    }

    const nextBossHp = Math.max(0, raidRun.bossHp - damage);
    const nextResolve = Math.max(0, raidRun.resolve - resolveLoss);
    const isLastQuestion = raidRun.currentQuestionIndex >= raidRun.questions.length - 1;
    const nextOutcome = nextBossHp <= 0
      ? 'victory'
      : nextResolve <= 0 || isLastQuestion
        ? 'defeat'
        : null;

    setRaidRun({
      ...raidRun,
      bossHp: nextBossHp,
      resolve: nextResolve,
      fury,
      combo: comboAfter,
      bestCombo: Math.max(raidRun.bestCombo, comboAfter),
      perfectAnswers: raidRun.perfectAnswers + (outcome === 'perfect' ? 1 : 0),
      partialAnswers: raidRun.partialAnswers + (outcome === 'partial' ? 1 : 0),
      failedAnswers: raidRun.failedAnswers + (outcome === 'wrong' || outcome === 'timeout' ? 1 : 0),
      totalDamage: raidRun.totalDamage + damage,
      bossBursts: nextBossBursts,
    });

    setTurnResult({
      outcome,
      accuracy,
      damage,
      resolveLoss,
      comboBonusDamage,
      bossBurstDamage,
      summary,
    });
    setBattleOutcome(nextOutcome);
    setPulseState((current) => ({
      token: current.token + 1,
      type: nextOutcome === 'victory'
        ? 'victory'
        : nextOutcome === 'defeat'
          ? 'defeat'
          : damage > 0
            ? 'hit'
            : 'boss',
    }));
  };

  const handleAdvance = () => {
    if (!raidRun) {
      return;
    }

    if (battleOutcome) {
      setView('result');
      return;
    }

    setRaidRun({
      ...raidRun,
      currentQuestionIndex: raidRun.currentQuestionIndex + 1,
    });
    setTurnResult(null);
    setAnswerLocked(false);
  };

  const restartEncounter = () => {
    setView('setup');
    setRaidRun(null);
    setTurnResult(null);
    setBattleOutcome(null);
    setAnswerLocked(false);
  };

  const canSubmitCurrentAnswer = useMemo(() => {
    if (!currentQuestion || answerLocked) {
      return false;
    }

    if (currentQuestion.type === 'TRUE_FALSE') {
      return selectedTrueFalse !== null;
    }
    if (currentQuestion.type === 'SINGLE_CHOICE') {
      return selectedOption !== null;
    }
    if (currentQuestion.type === 'MULTIPLE_CHOICE') {
      return selectedMultiple.length > 0;
    }

    return selectedPairs.length > 0;
  }, [currentQuestion, answerLocked, selectedTrueFalse, selectedOption, selectedMultiple, selectedPairs]);

  const answerProgressPercent = currentQuestionTimeLimit > 0
    ? Math.max(0, (timeLeft / currentQuestionTimeLimit) * 100)
    : 0;

  const resultTitle = battleOutcome === 'victory' ? 'Jefe derrotado' : 'La arena resistio';
  const weightedAccuracy = raidRun
    ? ((raidRun.perfectAnswers + raidRun.partialAnswers * 0.5) / raidRun.questions.length) * 100
    : 0;
  const isBattleView = view === 'battle';
  const currentResponderName = raidRun
    ? raidRun.responderOrder[raidRun.currentQuestionIndex % raidRun.responderOrder.length]
    : null;
  const currentResponderInitials = getStudentInitials(currentResponderName || 'Vocero del aula');

  const sceneFeedback = useMemo(() => {
    if (battleOutcome === 'victory') {
      return {
        eyebrow: 'Golpe final',
        title: 'Jefe derrotado',
        detail: `${currentResponderName || 'El aula'} abrio la grieta final y derribo a ${activeTheme.bossName}.`,
        surfaceClass: 'border-emerald-300/30 bg-emerald-500/15',
        icon: <Trophy size={28} className="text-emerald-100" />,
        chips: [`${turnResult?.damage ?? 0} dano final`, `Combo x${raidRun?.bestCombo ?? 0}`],
      };
    }

    if (battleOutcome === 'defeat') {
      return {
        eyebrow: 'Asalto fallido',
        title: 'El jefe resistio',
        detail: `${activeTheme.bossName} mantuvo su nucleo. Ajusta el ritmo del aula y vuelve a intentar.`,
        surfaceClass: 'border-rose-300/30 bg-rose-500/15',
        icon: <XCircle size={28} className="text-rose-100" />,
        chips: [`-${turnResult?.resolveLoss ?? 0} temple`, `${raidRun?.questions.length ?? 0} turnos usados`],
      };
    }

    if (!turnResult) {
      return null;
    }

    if (turnResult.bossBurstDamage > 0) {
      return {
        eyebrow: 'Peligro maximo',
        title: 'Furia desatada',
        detail: 'El jefe cargo por completo su energia y sacudio la arena con una onda brutal.',
        surfaceClass: 'border-fuchsia-300/30 bg-fuchsia-500/15',
        icon: <Flame size={28} className="text-fuchsia-100" />,
        chips: [`-${turnResult.resolveLoss} temple`, `-${turnResult.bossBurstDamage} extra`],
      };
    }

    if (turnResult.outcome === 'perfect') {
      return {
        eyebrow: 'Ataque del aula',
        title: 'Golpe critico',
        detail: `${currentResponderName || 'El aula'} conecto una respuesta perfecta y rompio la coraza del jefe.`,
        surfaceClass: 'border-emerald-300/30 bg-emerald-500/15',
        icon: <CheckCircle2 size={28} className="text-emerald-100" />,
        chips: [`-${turnResult.damage} vida`, turnResult.comboBonusDamage > 0 ? `+${turnResult.comboBonusDamage} combo` : '100% precision'],
      };
    }

    if (turnResult.outcome === 'partial') {
      return {
        eyebrow: 'Impacto parcial',
        title: 'El jefe tambalea',
        detail: 'La respuesta entro a medias. Hubo dano, pero tambien subio la presion del combate.',
        surfaceClass: 'border-amber-300/30 bg-amber-500/15',
        icon: <Target size={28} className="text-amber-100" />,
        chips: [`-${turnResult.damage} vida`, `-${turnResult.resolveLoss} temple`],
      };
    }

    if (turnResult.outcome === 'timeout') {
      return {
        eyebrow: 'Ventana cerrada',
        title: 'Tiempo agotado',
        detail: 'La clase perdio la oportunidad del turno y el jefe devolvio toda la presion.',
        surfaceClass: 'border-orange-300/30 bg-orange-500/15',
        icon: <Timer size={28} className="text-orange-100" />,
        chips: [`-${turnResult.resolveLoss} temple`, `${Math.round(turnResult.accuracy * 100)}% precision`],
      };
    }

    return {
      eyebrow: 'Contraataque',
      title: 'El jefe responde',
      detail: 'La defensa no cayo y el jefe aprovecho para devolver dano sobre el temple del aula.',
      surfaceClass: 'border-rose-300/30 bg-rose-500/15',
      icon: <XCircle size={28} className="text-rose-100" />,
      chips: [`-${turnResult.resolveLoss} temple`, `${Math.round(turnResult.accuracy * 100)}% precision`],
    };
  }, [activeTheme.bossName, battleOutcome, currentResponderName, raidRun?.bestCombo, raidRun?.questions.length, turnResult]);

  return (
    <div className={isBattleView ? '-m-4 space-y-0 md:-m-6' : 'space-y-6'}>
      {!isBattleView && (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-900 text-white shadow-lg transition hover:border-white/20 hover:bg-slate-800"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">Asalto al Jefe Final</h1>
                <span className={`rounded-full bg-gradient-to-r px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-white shadow-lg ${activeTheme.gradient}`}>
                  {activeTheme.badge}
                </span>
              </div>
              {view === 'setup' && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Actividad cooperativa del aula con banca de preguntas, fases de combate y escena 3D en tiempo real.</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/80 px-3 py-2 text-sm shadow-lg backdrop-blur dark:bg-slate-900/80 dark:text-white">
              <span className="font-semibold">{studentsCount}</span> estudiantes en la incursión
            </div>
          </div>
        </div>
      )}

      {view === 'setup' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <Card className="overflow-hidden border-none bg-slate-950 p-0 text-white shadow-[0_30px_90px_-40px_rgba(15,23,42,0.9)]">
            <div className={`relative overflow-hidden bg-gradient-to-br ${activeTheme.gradient}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.24),_transparent_35%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.12),_transparent_30%)]" />
              <div className="relative p-6 md:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">MVP cooperativo</p>
                    <h2 className="mt-3 text-3xl font-black md:text-4xl">{activeTheme.bossName}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85 md:text-base">{activeTheme.subtitle}</p>
                  </div>
                  <div className="rounded-2xl border border-white/20 bg-white/15 px-4 py-3 text-right shadow-xl backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/60">Meta del aula</p>
                    <p className="mt-1 text-lg font-black">Cooperar para bajar la vida completa del jefe</p>
                  </div>
                </div>

                <div className="mt-6">
                  <FinalBossRaidScene
                    theme={activeTheme}
                    bossHealthPercent={100}
                    resolvePercent={100}
                    furyPercent={8}
                    bossPhase={1}
                    pulseToken={pulseState.token}
                    pulseType="idle"
                    className="h-[280px] sm:h-[340px] lg:h-[400px]"
                  />
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/55">Escala del jefe</p>
                    <p className="mt-2 text-xl font-black">Vida dinamica</p>
                    <p className="mt-1 text-sm text-white/70">La vida se calcula desde el dano maximo de las preguntas elegidas.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/55">Golpe coral</p>
                    <p className="mt-2 text-xl font-black">Combo cada 3 perfectos</p>
                    <p className="mt-1 text-sm text-white/70">No es obligatorio para ganar, pero ayuda a recuperar margen si hubo errores.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/55">Castigo del jefe</p>
                    <p className="mt-2 text-xl font-black">Furia sin curacion</p>
                    <p className="mt-1 text-sm text-white/70">El jefe no recupera vida; castiga con perdida de temple del aula y ataques de furia.</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Configuracion del encuentro</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Arma la incursión del aula</h3>
                </div>
                <div className="rounded-full bg-slate-900/5 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-white/75">Sin backend nuevo</div>
              </div>

              <div className="mt-5 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Tema del jefe</label>
                  <div className="grid gap-2">
                    {BOSS_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setSelectedThemeId(theme.id)}
                        className={`rounded-2xl border p-3 text-left transition-all ${
                          selectedThemeId === theme.id
                            ? 'border-transparent text-white shadow-lg'
                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white'
                        } ${selectedThemeId === theme.id ? `bg-gradient-to-r ${theme.gradient}` : ''}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{theme.bossName}</p>
                            <p className={`mt-1 text-xs ${selectedThemeId === theme.id ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>{theme.description}</p>
                          </div>
                          {selectedThemeId === theme.id && <CheckCircle2 size={18} className="shrink-0" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Bancos de preguntas</label>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{selectedBankIds.length} seleccionados</span>
                  </div>
                  {loadingBanks ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">Cargando bancos...</div>
                  ) : questionBanks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                      Primero crea al menos un banco de preguntas para iniciar el jefe final.
                    </div>
                  ) : (
                    <div className="grid max-h-[240px] gap-2 overflow-y-auto pr-1">
                      {questionBanks.map((bank) => {
                        const isSelected = selectedBankIds.includes(bank.id);
                        return (
                          <button
                            key={bank.id}
                            type="button"
                            onClick={() => toggleBankSelection(bank.id)}
                            className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-50 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/30'
                                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/70'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">{bank.name}</p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{bank.questionCount || 0} preguntas disponibles</p>
                              </div>
                              {isSelected && <CheckCircle2 size={18} className="text-indigo-600 dark:text-indigo-300" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Cantidad de preguntas</label>
                    <div className="grid grid-cols-4 gap-2">
                      {QUESTION_COUNT_OPTIONS.map((count) => {
                        const disabled = questionPool.length > 0 && questionPool.length < count;
                        return (
                          <button
                            key={count}
                            type="button"
                            disabled={disabled}
                            onClick={() => setQuestionCount(count)}
                            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                              questionCount === count
                                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                            }`}
                          >
                            {count}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Dificultad</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['ALL', 'EASY', 'MEDIUM', 'HARD'] as RaidDifficultyFilter[]).map((difficulty) => (
                        <button
                          key={difficulty}
                          type="button"
                          onClick={() => setSelectedDifficulty(difficulty)}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                            selectedDifficulty === difficulty
                              ? 'border-indigo-500 bg-indigo-500 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                          }`}
                        >
                          {difficulty === 'ALL' ? 'Todas' : DIFFICULTY_LABELS[difficulty]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Pool listo para el encuentro</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">La vida del jefe se calculara en base al dano maximo posible del set elegido.</p>
                  </div>
                  {(loadingQuestionPool || fetchingQuestionPool) && <span className="text-xs text-slate-500 dark:text-slate-400">Preparando pool...</span>}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/70 bg-white p-3 shadow-sm dark:border-white/5 dark:bg-slate-950/60">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Preguntas activas</p>
                    <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{questionPool.length}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Necesitas al menos {questionCount} para iniciar.</p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white p-3 shadow-sm dark:border-white/5 dark:bg-slate-950/60">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Distribucion</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(questionPoolStats).length > 0 ? Object.entries(questionPoolStats).map(([type, count]) => (
                        <span key={type} className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900">
                          {QUESTION_TYPE_LABELS[type as Question['type']]}: {count}
                        </span>
                      )) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400">Aun no hay preguntas listas.</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(['EASY', 'MEDIUM', 'HARD'] as QuestionDifficulty[]).map((difficulty) => (
                    <span key={difficulty} className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:text-slate-300">
                      {DIFFICULTY_LABELS[difficulty]}: {difficultyStats[difficulty] || 0}
                    </span>
                  ))}
                </div>
              </div>

              <Button
                onClick={startRaid}
                disabled={questionBanks.length === 0 || selectedBankIds.length === 0 || questionPool.length < questionCount || loadingQuestionPool || fetchingQuestionPool}
                className={`mt-5 w-full gap-2 !rounded-2xl !py-3 !text-base !font-bold !text-white !shadow-xl ${`!bg-gradient-to-r ${activeTheme.gradient}`}`}
              >
                <Play size={18} />
                Iniciar asalto cooperativo
              </Button>
            </Card>
          </div>
        </div>
      )}

      {view === 'battle' && raidRun && currentQuestion && (
        <Card className="overflow-hidden border-none bg-slate-950/60 p-0 text-white shadow-[0_0_120px_-30px_rgba(15,23,42,1)] backdrop-blur-2xl ring-1 ring-white/10">
          <div className="relative">
            {/* Iluminacion global dramatica */}
            <div className={`absolute -inset-20 bg-gradient-to-br ${activeTheme.gradient} opacity-20 blur-3xl`} />
            <div className={`absolute inset-x-0 -top-24 h-64 bg-gradient-to-b ${activeTheme.gradient} opacity-40 blur-3xl`} />
            
            <div className={`absolute inset-x-0 top-0 h-40 bg-gradient-to-r ${activeTheme.gradient} opacity-[0.85] mix-blend-overlay`} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.25),_transparent_40%)]" />
            
            <div className="relative overflow-hidden rounded-[32px] border border-white/15 bg-black/40 shadow-2xl backdrop-blur-3xl">
              <div className="relative">
                <FinalBossRaidScene
                  theme={activeTheme}
                  bossHealthPercent={healthPercent}
                  resolvePercent={resolvePercent}
                  furyPercent={furyPercent}
                  bossPhase={bossPhase}
                  pulseToken={pulseState.token}
                  pulseType={pulseState.type}
                  className="h-[260px] sm:h-[320px] md:h-[380px] lg:h-[430px]"
                />

                <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-col gap-2 sm:inset-x-4 sm:top-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <button
                      onClick={restartEncounter}
                      className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-slate-950/75 text-white shadow-lg backdrop-blur-xl transition hover:border-white/25 hover:bg-slate-900/90"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <div className="max-w-md rounded-[28px] border border-white/15 bg-slate-950/70 px-4 py-3 backdrop-blur-xl">
                      <p className="text-[10px] uppercase tracking-[0.32em] text-white/45">Responder actual</p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${activeTheme.gradient} text-sm font-black text-white shadow-lg`}>
                          {currentResponderInitials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-white/75">
                            <Users size={14} />
                            <span className="text-xs uppercase tracking-[0.22em]">Turno del aula</span>
                          </div>
                          <p className="mt-1 text-lg font-black text-white">{currentResponderName}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-2xl border border-white/15 bg-slate-950/70 px-3 py-2 text-white backdrop-blur-xl">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Tiempo</p>
                      <p className="mt-1 flex items-center gap-2 text-xl font-black"><Timer size={16} /> {timeLeft}s</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-slate-950/70 px-3 py-2 text-white backdrop-blur-xl">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Fase</p>
                      <p className="mt-1 text-xl font-black">{bossPhase}</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-slate-950/70 px-3 py-2 text-white backdrop-blur-xl">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Pregunta</p>
                      <p className="mt-1 text-xl font-black">{raidRun.currentQuestionIndex + 1}/{raidRun.questions.length}</p>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {sceneFeedback && (
                    <motion.div
                      key={`${pulseState.token}-${sceneFeedback.title}`}
                      initial={{ opacity: 0, scale: 0.94, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: 10 }}
                      className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 py-8"
                    >
                      <div className={`w-full max-w-lg rounded-[32px] border px-5 py-5 text-center backdrop-blur-2xl shadow-2xl ${sceneFeedback.surfaceClass}`}>
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                          {sceneFeedback.icon}
                        </div>
                        <p className="mt-4 text-[11px] uppercase tracking-[0.34em] text-white/50">{sceneFeedback.eyebrow}</p>
                        <h3 className="mt-2 text-3xl font-black text-white">{sceneFeedback.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-white/78">{sceneFeedback.detail}</p>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
                          {sceneFeedback.chips.map((chip) => (
                            <span key={chip} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-semibold text-white/85">
                              {chip}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
              <div className="border-t border-white/10 bg-slate-950/96 p-4 sm:p-5 md:p-6">
                <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-3 sm:rounded-[28px] sm:p-4 lg:grid-cols-3">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-[10px] text-white/70 sm:text-xs">
                      <span className="flex items-center gap-1.5"><Skull size={12} /> Vida</span>
                      <span className="font-semibold text-[11px] text-white sm:text-sm">{Math.round(raidRun.bossHp)} / {raidRun.bossMaxHp}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full bg-gradient-to-r ${activeTheme.gradient} transition-all duration-500`} style={{ width: `${healthPercent}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-[10px] text-white/70 sm:text-xs">
                      <span className="flex items-center gap-1.5"><Shield size={12} /> Temple</span>
                      <span className="font-semibold text-[11px] text-white sm:text-sm">{Math.round(raidRun.resolve)} / {raidRun.resolveMax}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-400 transition-all duration-500" style={{ width: `${resolvePercent}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-[10px] text-white/70 sm:text-xs">
                      <span className="flex items-center gap-1.5"><Flame size={12} /> Furia</span>
                      <span className="font-semibold text-[11px] text-white sm:text-sm">{Math.round(raidRun.fury)}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-orange-400 via-rose-400 to-fuchsia-500 transition-all duration-500" style={{ width: `${furyPercent}%` }} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/85">{QUESTION_TYPE_LABELS[currentQuestion.type]}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/85">{DIFFICULTY_LABELS[currentQuestion.difficulty]}</span>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-200">Max dano: {currentQuestion.maxDamage}</span>
                  <span className="rounded-full bg-rose-500/15 px-3 py-1 font-semibold text-rose-200">Riesgo: {currentQuestion.resolveLoss}</span>
                  <span className="rounded-full bg-indigo-500/15 px-3 py-1 font-semibold text-indigo-200">Combo x{raidRun.combo}</span>
                </div>

                <div className="mt-4 overflow-hidden rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-500 transition-all duration-700" style={{ width: `${answerProgressPercent}%` }} />
                </div>

                <div className="mt-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">Pregunta del turno</p>
                  <p className="mt-3 text-lg font-semibold leading-7 text-white sm:text-xl sm:leading-8">{currentQuestion.questionText}</p>
                  {currentQuestion.imageUrl && (
                    <img
                      src={currentQuestion.imageUrl}
                      alt="Recurso de la pregunta"
                      className="mt-4 max-h-56 w-full rounded-2xl border border-white/10 object-cover"
                    />
                  )}
                </div>

                <div className="mt-4 space-y-4">
                  {currentQuestion.type === 'TRUE_FALSE' && (
                    <div className="grid grid-cols-2 gap-3">
                      {[true, false].map((value) => {
                        const correct = currentQuestion.correctAnswer === true || currentQuestion.correctAnswer === 'true';
                        const isSelected = selectedTrueFalse === value;
                        const isCorrect = correct === value;
                        return (
                          <button
                            key={value ? 'true' : 'false'}
                            type="button"
                            disabled={answerLocked}
                            onClick={() => setSelectedTrueFalse(value)}
                            className={`rounded-[24px] border px-4 py-4 text-left transition-all ${
                              answerLocked
                                ? isCorrect
                                  ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                                  : isSelected
                                    ? 'border-rose-400 bg-rose-500/15 text-rose-100'
                                    : 'border-white/10 bg-white/5 text-white/55'
                                : isSelected
                                  ? 'border-indigo-300 bg-indigo-500/20 text-white shadow-lg shadow-indigo-500/20'
                                  : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10'
                            }`}
                          >
                            <p className="text-sm uppercase tracking-[0.2em] text-white/45">Respuesta</p>
                            <p className="mt-2 text-2xl font-black">{value ? 'Verdadero' : 'Falso'}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {currentQuestion.type === 'SINGLE_CHOICE' && (
                    <div className="space-y-3">
                      {currentQuestionOptions.map((option, index) => {
                        const isSelected = selectedOption === index;
                        const isCorrect = index === getSingleCorrectIndex(currentQuestion);
                        return (
                          <button
                            key={`${option.text}-${index}`}
                            type="button"
                            disabled={answerLocked}
                            onClick={() => setSelectedOption(index)}
                            className={`flex w-full items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition-all ${
                              answerLocked
                                ? isCorrect
                                  ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                                  : isSelected
                                    ? 'border-rose-400 bg-rose-500/15 text-rose-100'
                                    : 'border-white/10 bg-white/5 text-white/55'
                                : isSelected
                                  ? 'border-indigo-300 bg-indigo-500/20 text-white shadow-lg shadow-indigo-500/20'
                                  : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10'
                            }`}
                          >
                            <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold">{String.fromCharCode(65 + index)}</span>
                            <span className="flex-1 text-sm leading-6">{option.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {currentQuestion.type === 'MULTIPLE_CHOICE' && (
                    <div className="space-y-3">
                      {currentQuestionOptions.map((option, index) => {
                        const isSelected = selectedMultiple.includes(index);
                        const isCorrect = getMultipleCorrectIndices(currentQuestion).includes(index);
                        return (
                          <button
                            key={`${option.text}-${index}`}
                            type="button"
                            disabled={answerLocked}
                            onClick={() => {
                              setSelectedMultiple((current) => (
                                current.includes(index)
                                  ? current.filter((item) => item !== index)
                                  : [...current, index]
                              ));
                            }}
                            className={`flex w-full items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition-all ${
                              answerLocked
                                ? isCorrect
                                  ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                                  : isSelected
                                    ? 'border-rose-400 bg-rose-500/15 text-rose-100'
                                    : 'border-white/10 bg-white/5 text-white/55'
                                : isSelected
                                  ? 'border-cyan-300 bg-cyan-500/20 text-white shadow-lg shadow-cyan-500/20'
                                  : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10'
                            }`}
                          >
                            <span className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-md border text-[11px] font-bold ${isSelected ? 'border-cyan-200 bg-cyan-100 text-cyan-700' : 'border-white/20 bg-white/5 text-white/60'}`}>
                              {isSelected ? '✓' : '+'}
                            </span>
                            <span className="flex-1 text-sm leading-6">{option.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {currentQuestion.type === 'MATCHING' && currentQuestionPairs.length > 0 && (
                    <MatchingComposer
                      pairs={currentQuestionPairs}
                      answers={selectedPairs}
                      onChange={setSelectedPairs}
                      disabled={answerLocked}
                      showResult={answerLocked}
                    />
                  )}

                  <AnimatePresence>
                    {turnResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="rounded-[28px] border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className={`text-sm font-semibold ${battleOutcomeCopy[turnResult.outcome].tone}`}>{battleOutcomeCopy[turnResult.outcome].title}</p>
                            <p className="mt-1 text-sm text-white/75">{turnResult.summary}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                            <div className="rounded-2xl bg-black/15 px-3 py-2 text-center"><p className="text-white/45">Dano</p><p className="mt-1 font-bold text-white">{turnResult.damage}</p></div>
                            <div className="rounded-2xl bg-black/15 px-3 py-2 text-center"><p className="text-white/45">Precision</p><p className="mt-1 font-bold text-white">{Math.round(turnResult.accuracy * 100)}%</p></div>
                            <div className="rounded-2xl bg-black/15 px-3 py-2 text-center"><p className="text-white/45">Temple</p><p className="mt-1 font-bold text-white">-{turnResult.resolveLoss}</p></div>
                            <div className="rounded-2xl bg-black/15 px-3 py-2 text-center"><p className="text-white/45">Combo</p><p className="mt-1 font-bold text-white">+{turnResult.comboBonusDamage}</p></div>
                          </div>
                        </div>
                        {currentQuestion.explanation && (
                          <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 px-3 py-3 text-sm text-white/70">
                            <span className="font-semibold text-white/80">Explicacion:</span> {currentQuestion.explanation}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    {!turnResult ? (
                      <Button
                        onClick={() => handleResolveTurn(false)}
                        disabled={!canSubmitCurrentAnswer}
                        className={`flex-1 gap-2 !rounded-2xl !py-3 !text-base !font-bold !text-white ${`!bg-gradient-to-r ${activeTheme.gradient}`}`}
                      >
                        <Target size={18} />
                        Resolver turno
                      </Button>
                    ) : (
                      <Button
                        onClick={handleAdvance}
                        className={`flex-1 gap-2 !rounded-2xl !py-3 !text-base !font-bold !text-white ${battleOutcome === 'victory' ? '!bg-gradient-to-r !from-emerald-500 !to-teal-500' : battleOutcome === 'defeat' ? '!bg-gradient-to-r !from-rose-500 !to-orange-500' : `!bg-gradient-to-r ${activeTheme.gradient}`}`}
                      >
                        {battleOutcome ? <Trophy size={18} /> : <Play size={18} />}
                        {battleOutcome ? 'Ver resultado del combate' : 'Siguiente pregunta'}
                      </Button>
                    )}
                    <Button variant="secondary" onClick={restartEncounter} className="!rounded-2xl !py-3">
                      <RotateCcw size={16} />
                      Reiniciar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {view === 'result' && raidRun && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="overflow-hidden border-none p-0 shadow-[0_30px_90px_-50px_rgba(15,23,42,1)]">
            <div className={`bg-gradient-to-br ${battleOutcome === 'victory' ? 'from-emerald-500 via-teal-500 to-cyan-500' : activeTheme.gradient} px-6 py-7 text-white`}>
              <p className="text-xs uppercase tracking-[0.35em] text-white/65">Resumen del enfrentamiento</p>
              <h2 className="mt-3 text-4xl font-black">{resultTitle}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/82">
                {battleOutcome === 'victory'
                  ? `El aula coordino sus respuestas y derribo a ${activeTheme.bossName}. Puedes reutilizar esta misma configuracion para nuevas incursiones.`
                  : `${activeTheme.bossName} sobrevivio a la primera embestida. Revisa la precision por tipo y vuelve a intentar con una nueva secuencia.`}
              </p>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Dano total</p>
                <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{raidRun.totalDamage}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">de {raidRun.bossMaxHp} posibles</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Precision ponderada</p>
                <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{Math.round(weightedAccuracy)}%</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Perfectas y parciales del asalto</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Mejor combo</p>
                <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">x{raidRun.bestCombo}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Rafagas perfectas encadenadas</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Furia desatada</p>
                <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{raidRun.bossBursts}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Veces que el jefe sobrecargo la arena</p>
              </div>
            </div>

            <div className="grid gap-4 px-6 pb-6 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 p-5 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-indigo-500" />
                  <h3 className="font-bold text-slate-900 dark:text-white">Desempeno por respuestas</h3>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-emerald-50 p-4 text-center dark:bg-emerald-950/20">
                    <p className="text-xs uppercase tracking-[0.18em] text-emerald-500">Perfectas</p>
                    <p className="mt-2 text-3xl font-black text-emerald-600">{raidRun.perfectAnswers}</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-4 text-center dark:bg-amber-950/20">
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-500">Parciales</p>
                    <p className="mt-2 text-3xl font-black text-amber-600">{raidRun.partialAnswers}</p>
                  </div>
                  <div className="rounded-2xl bg-rose-50 p-4 text-center dark:bg-rose-950/20">
                    <p className="text-xs uppercase tracking-[0.18em] text-rose-500">Fallidas</p>
                    <p className="mt-2 text-3xl font-black text-rose-600">{raidRun.failedAnswers}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 p-5 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-emerald-500" />
                  <h3 className="font-bold text-slate-900 dark:text-white">Estado final del aula</h3>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                      <span>Vida del jefe restante</span>
                      <span className="font-semibold">{raidRun.bossHp}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-full rounded-full bg-gradient-to-r ${activeTheme.gradient}`} style={{ width: `${Math.max(0, (raidRun.bossHp / raidRun.bossMaxHp) * 100)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                      <span>Temple restante</span>
                      <span className="font-semibold">{raidRun.resolve}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-400" style={{ width: `${Math.max(0, (raidRun.resolve / raidRun.resolveMax) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="overflow-hidden border-none bg-slate-950 p-0 text-white shadow-[0_30px_90px_-45px_rgba(15,23,42,1)]">
              <div className={`bg-gradient-to-br ${activeTheme.gradient} p-4`}>
                <p className="text-xs uppercase tracking-[0.25em] text-white/60">Escena final</p>
                <p className="mt-2 text-xl font-black">{activeTheme.bossName}</p>
              </div>
              <div className="p-4">
                <FinalBossRaidScene
                  theme={activeTheme}
                  bossHealthPercent={Math.max(0, (raidRun.bossHp / raidRun.bossMaxHp) * 100)}
                  resolvePercent={Math.max(0, (raidRun.resolve / raidRun.resolveMax) * 100)}
                  furyPercent={raidRun.fury}
                  bossPhase={getBossPhase(raidRun.bossHp, raidRun.bossMaxHp)}
                  pulseToken={pulseState.token}
                  pulseType={battleOutcome === 'victory' ? 'victory' : 'defeat'}
                  className="h-[240px] sm:h-[300px]"
                />
              </div>
            </Card>

            <Card className="p-5 shadow-xl">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                {battleOutcome === 'victory' ? <CheckCircle2 size={18} className="text-emerald-500" /> : <XCircle size={18} className="text-rose-500" />}
                <h3 className="font-bold">Siguiente paso</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">
                {battleOutcome === 'victory'
                  ? 'Puedes volver a intentarlo con mas preguntas o con otra tematica de jefe para subir la exigencia del aula.'
                  : 'Prueba con otra combinacion de bancos o reduce la dificultad del pool para que el aula entre mejor en ritmo.'}
              </p>
              <div className="mt-4 space-y-3">
                <Button onClick={restartEncounter} className={`w-full gap-2 !rounded-2xl !py-3 !text-base !font-bold !text-white ${`!bg-gradient-to-r ${activeTheme.gradient}`}`}>
                  <RotateCcw size={18} />
                  Reconfigurar asalto
                </Button>
                <Button variant="secondary" onClick={onBack} className="w-full !rounded-2xl !py-3">
                  <ArrowLeft size={16} />
                  Volver a actividades
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};