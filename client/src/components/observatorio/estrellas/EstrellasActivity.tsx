import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, Star, Undo2, X } from 'lucide-react';
import type { ActivitySession } from '../../../lib/activityApi';
import type { Classroom, Student } from '../../../lib/classroomApi';
import { questionBankApi } from '../../../lib/questionBankApi';
import { shuffle } from '../../classroom/utilities/helpers';
import { useTeacherBanks } from '../../classroom/utilities/questionDraw';
import { AiQuestionGenerator } from '../AiQuestionGenerator';
import { UnreviewedNotice } from '../UnreviewedNotice';
import { Bitacora } from '../Bitacora';
import { EscenarioObservatorio, stageControlClass } from '../EscenarioObservatorio';
import { answerOf, questionSizeClass } from '../questionHelpers';
import { StageEndButton } from '../StageEndButton';
import { applyMark, maxStars, suggestedXpFor } from '../streak';
import type { JiroPose } from '../jiroPoses';
import { useStageSound } from '../observatorioSound';
import { useActivitySession } from '../useActivitySession';

type Variant = 'vf' | 'esquinas';
type Source = { kind: 'bank'; bankId: string; bankName: string } | { kind: 'free' };

interface EstrellasState {
  variant: Variant;
  source: Source;
  rounds: number;
  questionIds: string[];
  index: number;
  marks: boolean[];
  stars: number;
  streak: number;
  bestStreak: number;
}

interface EstrellasResult extends Record<string, unknown> {
  variant: Variant;
  bankName: string | null;
  rounds: number;
  correct: number;
  stars: number;
  bestStreak: number;
}

const ROUND_OPTIONS = [5, 10, 15];
const CORNERS = [
  { letter: 'A', className: 'border-rose-300 bg-rose-400/20' },
  { letter: 'B', className: 'border-sky-300 bg-sky-400/20' },
  { letter: 'C', className: 'border-emerald-300 bg-emerald-400/20' },
  { letter: 'D', className: 'border-amber-300 bg-amber-400/20' },
];

const chip = (on: boolean) =>
  `min-h-[48px] rounded-xl border px-4 text-lg font-bold transition-colors ${on ? 'border-amber-300 bg-amber-300 text-amber-950' : 'border-white/30 text-white hover:bg-white/10'}`;

interface EstrellasActivityProps {
  classroom: Classroom & { students?: Student[] };
  resume?: ActivitySession<unknown, unknown> | null;
  /** Banco elegido desde el Banco de preguntas ("Usar en clase"). */
  initialBankId?: string | null;
  /** Parada «en clase» de una expedición desde la que se juega: la recompensa la marca. */
  expeditionStopId?: string | null;
  onExit: () => void;
}

/**
 * Estrellas en Movimiento: Jiro lee una afirmación y todos se mueven (de pie = verdadero,
 * agachados = falso; o a una esquina A–D). Nadie queda eliminado: el docente marca si la
 * mayoría acertó y cada acierto enciende una estrella; las rachas dan estrellas extra.
 */
export const EstrellasActivity = ({ classroom, resume, initialBankId, expeditionStopId, onExit }: EstrellasActivityProps) => {
  const students = useMemo(() => classroom.students ?? [], [classroom.students]);
  const soundState = useStageSound();
  const { sound } = soundState;
  const game = useActivitySession<EstrellasState, EstrellasResult>(classroom.id, 'ESTRELLAS', resume as ActivitySession<EstrellasState, EstrellasResult> | null | undefined, expeditionStopId);
  const saved = (resume?.status === 'ACTIVE' ? resume.state : null) as EstrellasState | null;

  const [phase, setPhase] = useState<'setup' | 'playing' | 'bitacora'>(resume?.status === 'FINISHED' ? 'bitacora' : saved ? 'playing' : 'setup');
  const [variant, setVariant] = useState<Variant>(saved?.variant ?? 'vf');
  const [source, setSource] = useState<Source | null>(saved?.source ?? null);
  const [rounds, setRounds] = useState(saved?.rounds ?? 10);
  const [state, setState] = useState<EstrellasState | null>(saved);
  const [revealed, setRevealed] = useState(false);
  // Marcas anteriores (para deshacer un toque errado).
  const [history, setHistory] = useState<EstrellasState[]>([]);

  const { data: banks = [], isLoading: banksLoading } = useTeacherBanks(true);
  // El banco que llega del Banco de preguntas se elige al cargar la lista (con la variante que más preguntas tiene).
  const [presetBank, setPresetBank] = useState(saved ? null : initialBankId ?? null);
  if (presetBank && !banksLoading) {
    setPresetBank(null);
    const preset = banks.find((b) => b.id === presetBank);
    if (preset) {
      setVariant(preset.countsByType.TRUE_FALSE >= preset.countsByType.SINGLE_CHOICE ? 'vf' : 'esquinas');
      setSource({ kind: 'bank', bankId: preset.id, bankName: preset.name });
    }
  }
  const neededType = variant === 'vf' ? 'TRUE_FALSE' : 'SINGLE_CHOICE';
  const usableBanks = banks.filter((b) => b.countsByType[neededType] > 0);
  const bankId = (state?.source ?? source)?.kind === 'bank' ? ((state?.source ?? source) as { bankId: string }).bankId : null;

  const { data: bankQuestions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ['questions', bankId],
    queryFn: () => questionBankApi.getQuestions(bankId!),
    enabled: !!bankId,
  });
  const byId = useMemo(() => new Map(bankQuestions.map((q) => [q.id, q])), [bankQuestions]);
  const playable = useMemo(() => bankQuestions.filter((q) => q.type === neededType && answerOf(q)), [bankQuestions, neededType]);
  const available = playable.length;


  const current = state && state.source.kind === 'bank' ? byId.get(state.questionIds[state.index]) ?? null : null;
  const answer = current ? answerOf(current) : null;
  const roundNumber = (state?.index ?? 0) + 1;

  const start = async () => {
    if (!source) return;
    sound.unlock();
    let questionIds: string[] = [];
    let total = rounds;
    if (source.kind === 'bank') {
      const pool = shuffle(playable);
      questionIds = pool.slice(0, rounds).map((q) => q.id);
      total = questionIds.length;
      if (total === 0) return;
    }
    const initial: EstrellasState = { variant, source, rounds: total, questionIds, index: 0, marks: [], stars: 0, streak: 0, bestStreak: 0 };
    try {
      await game.start(initial, source.kind === 'bank' ? source.bankName : 'Modo libre');
    } catch {
      toast.error('No se pudo empezar la partida. Revisa la conexión.');
      return;
    }
    setState(initial);
    setHistory([]);
    setRevealed(false);
    setPhase('playing');
  };

  const finish = useCallback(async (final: EstrellasState) => {
    const result: EstrellasResult = {
      variant: final.variant,
      bankName: final.source.kind === 'bank' ? final.source.bankName : null,
      rounds: final.rounds,
      correct: final.marks.filter(Boolean).length,
      stars: final.stars,
      bestStreak: final.bestStreak,
    };
    try {
      await game.finish(result, final);
      sound.success();
      setPhase('bitacora');
    } catch {
      toast.error('No se pudo guardar la partida. Inténtalo de nuevo.');
    }
  }, [game, sound]);

  const mark = useCallback((correct: boolean) => {
    if (!state) return;
    const { next, bonus } = applyMark(state, correct);
    if (correct) sound.star(next.stars - 1);
    else sound.soft();
    if (bonus) window.setTimeout(() => sound.success(), 250);
    setHistory((h) => [...h.slice(-9), state]);
    setState(next);
    setRevealed(false);
    if (next.index >= next.rounds) void finish(next);
    else game.save(next);
  }, [state, sound, finish, game]);

  const undoMark = useCallback(() => {
    const previous = history[history.length - 1];
    if (!previous || phase !== 'playing') return;
    setHistory((h) => h.slice(0, -1));
    setState(previous);
    setRevealed(false);
    game.save(previous);
  }, [history, phase, game]);

  /** Terminar antes: cuentan las rondas jugadas. */
  const endEarly = () => {
    if (!state) return;
    void finish({ ...state, rounds: state.marks.length });
  };

  const isFree = state?.source.kind === 'free';
  const awaitingReveal = phase === 'playing' && !isFree && !revealed;

  const onKey = useCallback((e: KeyboardEvent) => {
    if (phase !== 'playing' || awaitingReveal) return false;
    if (e.key === 's' || e.key === 'S' || e.key === '1') { mark(true); return true; }
    if (e.key === 'n' || e.key === 'N' || e.key === '2') { mark(false); return true; }
    return false;
  }, [phase, awaitingReveal, mark]);

  const jiro: { pose: JiroPose; line: string | null } = (() => {
    if (phase === 'setup') {
      return { pose: 'senalando', line: variant === 'vf' ? '¡De pie si es verdadero, agachados si es falso!' : 'Cada esquina es una respuesta. ¡Caminen a su esquina!' };
    }
    if (phase === 'bitacora') return { pose: 'celebrando', line: `¡Encendimos ${state?.stars ?? 0} estrellas!` };
    if (revealed && answer) return { pose: 'senalando', line: `¡Era ${answer.text}!` };
    if (state && state.streak >= 2) return { pose: 'emocionado', line: `¡Racha de ${state.streak}! 🔥` };
    if (isFree) return { pose: 'emocionado', line: 'Escuchen la afirmación…' };
    return { pose: 'emocionado', line: variant === 'vf' ? '¿Verdadero o falso?' : '¿A, B, C o D?' };
  })();

  const primary = phase === 'setup'
    ? { label: 'Empezar', onClick: () => void start(), disabled: !source || (source.kind === 'bank' && (questionsLoading || available === 0)) }
    : awaitingReveal
      ? { label: 'Revelar', onClick: () => { setRevealed(true); sound.tick(); }, disabled: !current }
      : null;

  const result = game.session?.result;

  return (
    <EscenarioObservatorio
      label="Estrellas en Movimiento"
      onClose={() => { if (state && phase === 'playing') game.save(state); onExit(); }}
      jiro={{ ...jiro, placement: 'corner' }}
      primary={primary}
      onKey={onKey}
      onPrev={phase === 'playing' ? undoMark : undefined}
      soundState={soundState}
      barExtra={phase === 'playing' && state ? (
        <>
          {history.length > 0 && (
            <button type="button" onClick={undoMark} className={stageControlClass} title="Deshacer la última marca (←)">
              <Undo2 size={18} aria-hidden="true" /> <span className="hidden sm:inline">Deshacer</span>
            </button>
          )}
          {state.marks.length > 0 && <StageEndButton onEnd={endEarly} />}
        </>
      ) : undefined}
      status={phase === 'playing' && state ? `Ronda ${Math.min(roundNumber, state.rounds)} de ${state.rounds} · ⭐ ${state.stars}` : undefined}
    >
      {phase === 'setup' && (
        <div className="flex w-full max-w-5xl flex-col gap-5">
          <h1 className="stage-title text-center font-black">Estrellas en Movimiento</h1>
          <div className="flex flex-wrap gap-6">
            <fieldset>
              <legend className="mb-2 text-lg font-bold text-indigo-100">Cómo se juega</legend>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setVariant('vf'); setSource(null); }} aria-pressed={variant === 'vf'} className={chip(variant === 'vf')}>🧍 Verdadero o falso</button>
                <button type="button" onClick={() => { setVariant('esquinas'); setSource(null); }} aria-pressed={variant === 'esquinas'} className={chip(variant === 'esquinas')}>🔷 4 esquinas</button>
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-lg font-bold text-indigo-100">Rondas</legend>
              <div className="flex flex-wrap gap-2">
                {ROUND_OPTIONS.map((r) => (
                  <button key={r} type="button" onClick={() => setRounds(r)} aria-pressed={rounds === r} className={chip(rounds === r)}>{r}</button>
                ))}
              </div>
            </fieldset>
          </div>

          <fieldset>
            <legend className="mb-2 text-lg font-bold text-indigo-100">Preguntas</legend>
            {banksLoading ? (
              <p className="text-indigo-100" role="status">Cargando bancos…</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {usableBanks.map((bank) => {
                  const on = source?.kind === 'bank' && source.bankId === bank.id;
                  return (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => setSource({ kind: 'bank', bankId: bank.id, bankName: bank.name })}
                      aria-pressed={on}
                      className={`flex min-h-[56px] flex-col items-start justify-center rounded-2xl border-2 px-4 py-2 text-left ${on ? 'border-amber-300 bg-amber-300/15' : 'border-white/15 hover:bg-white/5'}`}
                    >
                      <span className="text-lg font-bold text-white">{bank.name}</span>
                      <span className="text-sm font-semibold text-indigo-200">
                        {bank.classroomName} · {bank.countsByType[neededType]} {variant === 'vf' ? 'de verdadero o falso' : 'de opción única'}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setSource({ kind: 'free' })}
                  aria-pressed={source?.kind === 'free'}
                  className={`flex min-h-[56px] flex-col items-start justify-center rounded-2xl border-2 px-4 py-2 text-left ${source?.kind === 'free' ? 'border-amber-300 bg-amber-300/15' : 'border-white/15 hover:bg-white/5'}`}
                >
                  <span className="text-lg font-bold text-white">Modo libre</span>
                  <span className="text-sm font-semibold text-indigo-200">Tú dices la afirmación en voz alta</span>
                </button>
              </div>
            )}
          </fieldset>

          {source?.kind === 'bank' && <UnreviewedNotice banks={banks.filter((b) => b.id === source.bankId)} classroomId={classroom.id} />}

          <AiQuestionGenerator
            classroomId={classroom.id}
            kind={neededType}
            onCreated={({ bankId, bankName }) => setSource({ kind: 'bank', bankId, bankName })}
          />

          {source?.kind === 'bank' && !questionsLoading && available < rounds && (
            <p className="text-base text-amber-100">Este banco tiene {available} preguntas: jugaremos {available} rondas.</p>
          )}
        </div>
      )}

      {phase === 'playing' && state && (
        <div className="flex w-full max-w-6xl flex-col items-center gap-5">
          {/* Estrellas de la clase */}
          <ol className="flex flex-wrap justify-center gap-1.5" aria-label={`${state.stars} de ${maxStars(state.rounds)} estrellas`}>
            {Array.from({ length: maxStars(state.rounds) }, (_, i) => (
              <li key={i}>
                <Star aria-hidden="true" className={`h-[6vh] min-h-[24px] w-[6vh] min-w-[24px] ${i < state.stars ? 'obs-star-in fill-amber-300 text-amber-300' : 'text-white/40'}`} />
              </li>
            ))}
          </ol>

          {isFree ? (
            <p className="stage-title text-center font-black text-white">Ronda {roundNumber}: escuchen a su profe</p>
          ) : current ? (
            <p className={`${questionSizeClass(current.questionText)} max-w-5xl text-center font-black text-white`}>{current.questionText}</p>
          ) : (
            <p className="stage-body text-indigo-100" role="status">{questionsLoading ? 'Cargando pregunta…' : 'Esta pregunta ya no está en el banco.'}</p>
          )}

          {state.variant === 'vf' ? (
            <div className="grid w-full max-w-4xl grid-cols-2 gap-4">
              {[{ emoji: '🧍', title: 'De pie', sub: 'Verdadero' }, { emoji: '🧎', title: 'Agachados', sub: 'Falso' }].map((card, i) => {
                const isAnswer = revealed && answer?.index === i;
                const dim = revealed && answer && answer.index !== i;
                return (
                  <div key={card.sub} className={`flex flex-col items-center rounded-3xl border-4 p-4 transition-opacity ${i === 0 ? 'border-emerald-300 bg-emerald-400/15' : 'border-rose-300 bg-rose-400/15'} ${dim ? 'opacity-60' : ''} ${isAnswer ? 'ring-4 ring-amber-300' : ''}`}>
                    <span className="stage-display" aria-hidden="true">{card.emoji}</span>
                    <span className="stage-option font-black text-white">{card.title}</span>
                    <span className="stage-body font-bold text-indigo-50">{card.sub}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2">
              {CORNERS.slice(0, isFree ? 4 : Math.max(2, answer?.options.length ?? 4)).map((corner, i) => {
                const text = answer?.options[i];
                const isAnswer = revealed && answer?.index === i;
                const dim = revealed && answer && answer.index !== i;
                return (
                  <div key={corner.letter} className={`flex min-h-[12vh] items-center gap-4 rounded-3xl border-4 px-5 py-3 transition-opacity ${corner.className} ${dim ? 'opacity-60' : ''} ${isAnswer ? 'ring-4 ring-amber-300' : ''}`}>
                    <span className="stage-option font-black text-white">{corner.letter}</span>
                    {text && <span className="stage-body font-bold text-white">{text}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {revealed && answer && (
            <div className="w-full max-w-5xl rounded-2xl border border-amber-300/40 bg-amber-300/10 px-5 py-3 text-center" role="status">
              <p className="stage-body font-black text-amber-100">Era {answer.text}</p>
              {current?.explanation && <p className="stage-body mt-1 text-white">{current.explanation}</p>}
            </div>
          )}

          {!awaitingReveal && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-xl font-bold text-indigo-100">¿Acertó la mayoría?</span>
              <button type="button" onClick={() => mark(true)} className="inline-flex min-h-[56px] items-center gap-2 rounded-2xl bg-emerald-300 px-6 text-xl font-black text-emerald-950 hover:bg-emerald-200">
                <Check size={24} aria-hidden="true" /> Sí <span className="text-sm font-bold opacity-70">(S)</span>
              </button>
              <button type="button" onClick={() => mark(false)} className="inline-flex min-h-[56px] items-center gap-2 rounded-2xl border-2 border-white/40 px-6 text-xl font-black text-white hover:bg-white/10">
                <X size={24} aria-hidden="true" /> No <span className="text-sm font-bold opacity-70">(N)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'bitacora' && game.session && (
        <Bitacora
          session={game.session}
          classroomId={classroom.id}
          students={students}
          showCharacterName={classroom.showCharacterName}
          achievements={[
            { icon: '⭐', label: 'estrellas encendidas', value: String(result?.stars ?? 0) },
            { icon: '✅', label: 'rondas acertadas', value: `${result?.correct ?? 0}/${result?.rounds ?? 0}` },
            { icon: '🔥', label: 'mejor racha', value: String(result?.bestStreak ?? 0) },
          ]}
          suggestedXp={suggestedXpFor(result?.correct ?? 0, result?.rounds ?? 0)}
          activityName="Estrellas en Movimiento"
          onSessionChange={(s) => game.setSession(s as ActivitySession<EstrellasState, EstrellasResult>)}
          onPlayAgain={() => { game.setSession(null); setState(null); setHistory([]); setPhase('setup'); }}
          onExit={onExit}
        />
      )}
    </EscenarioObservatorio>
  );
};
