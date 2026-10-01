import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, Dices, Moon, Star, Undo2, X } from 'lucide-react';
import type { ActivitySession } from '../../../lib/activityApi';
import type { Classroom, Student } from '../../../lib/classroomApi';
import { questionBankApi, type Question } from '../../../lib/questionBankApi';
import { shuffle } from '../../classroom/utilities/helpers';
import { useTeacherBanks } from '../../classroom/utilities/questionDraw';
import { studentNames } from '../../students/profile/profileHelpers';
import { AiQuestionGenerator } from '../AiQuestionGenerator';
import { UnreviewedNotice } from '../UnreviewedNotice';
import { Bitacora } from '../Bitacora';
import { EscenarioObservatorio, stageControlClass } from '../EscenarioObservatorio';
import type { JiroPose } from '../jiroPoses';
import { useStageSound } from '../observatorioSound';
import { answerOf } from '../questionHelpers';
import { StageEndButton } from '../StageEndButton';
import { applyMark, maxStars, suggestedXpFor, type StreakState } from '../streak';
import { useActivitySession } from '../useActivitySession';
import { useTodayPresence } from '../usePresence';

// Igual que en el servidor (observatorioAi.service ERROR_PREFIX): así se reconocen en cualquier banco.
const ERROR_PREFIX = '¿En qué paso está el error?';
const ROUND_OPTIONS = [3, 5, 8];

interface ErrorState extends StreakState {
  bankId: string;
  bankName: string;
  rounds: number;
  questionIds: string[];
  explainers: string[];
}

interface ErrorResult extends Record<string, unknown> {
  bankName: string;
  rounds: number;
  found: number;
  stars: number;
  explainers: number;
}

const chip = (on: boolean) =>
  `min-h-[48px] rounded-xl border px-4 text-lg font-bold transition-colors ${on ? 'border-amber-300 bg-amber-300 text-amber-950' : 'border-white/30 text-white hover:bg-white/10'}`;

const isErrorQuestion = (q: Question) => q.questionText.startsWith(ERROR_PREFIX) && answerOf(q) !== null;
const problemOf = (q: Question) => q.questionText.slice(ERROR_PREFIX.length).trim();
const stepText = (text: string) => text.replace(/^Paso \d+:\s*/, '');

interface ErrorActivityProps {
  classroom: Classroom & { students?: Student[] };
  resume?: ActivitySession<unknown, unknown> | null;
  /** Banco elegido desde el Banco de preguntas ("Usar en clase"). */
  initialBankId?: string | null;
  onExit: () => void;
}

/**
 * El Error de Jiro: Jiro muestra un ejercicio resuelto con UN paso equivocado. En parejas o en clan
 * lo buscan y lo explican; el docente revela y marca si la mayoría lo encontró. Las preguntas se
 * guardan en el banco como opción única ("Paso 1…4"), generadas con IA o escritas por el docente.
 */
export const ErrorActivity = ({ classroom, resume, initialBankId, onExit }: ErrorActivityProps) => {
  const students = useMemo(() => classroom.students ?? [], [classroom.students]);
  const soundState = useStageSound();
  const { sound } = soundState;
  const game = useActivitySession<ErrorState, ErrorResult>(classroom.id, 'ERROR', resume as ActivitySession<ErrorState, ErrorResult> | null | undefined);
  const saved = (resume?.status === 'ACTIVE' ? resume.state : null) as ErrorState | null;
  const presence = useTodayPresence(classroom.id, students);

  const [phase, setPhase] = useState<'setup' | 'playing' | 'bitacora'>(resume?.status === 'FINISHED' ? 'bitacora' : saved ? 'playing' : 'setup');
  const [bank, setBank] = useState<{ bankId: string; bankName: string } | null>(saved ? { bankId: saved.bankId, bankName: saved.bankName } : null);
  const [rounds, setRounds] = useState(saved?.rounds ?? 5);
  const [state, setState] = useState<ErrorState | null>(saved);
  const [history, setHistory] = useState<ErrorState[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [explainer, setExplainer] = useState<string | null>(null);

  const { data: banks = [], isLoading: banksLoading } = useTeacherBanks(phase === 'setup');
  const candidateBanks = banks.filter((b) => b.countsByType.SINGLE_CHOICE > 0);
  // El banco que llega del Banco de preguntas se elige al cargar la lista.
  const [presetBank, setPresetBank] = useState(saved ? null : initialBankId ?? null);
  if (presetBank && !banksLoading) {
    setPresetBank(null);
    const preset = banks.find((b) => b.id === presetBank);
    if (preset) setBank({ bankId: preset.id, bankName: preset.name });
  }
  const bankId = state?.bankId ?? bank?.bankId ?? null;
  const { data: bankQuestions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ['questions', bankId],
    queryFn: () => questionBankApi.getQuestions(bankId!),
    enabled: !!bankId,
  });
  const playable = useMemo(() => bankQuestions.filter(isErrorQuestion), [bankQuestions]);
  const byId = useMemo(() => new Map(bankQuestions.map((q) => [q.id, q])), [bankQuestions]);

  const current = state ? byId.get(state.questionIds[state.index]) ?? null : null;
  const answer = current ? answerOf(current) : null;

  const start = async () => {
    if (!bank || playable.length === 0) return;
    sound.unlock();
    const questionIds = shuffle(playable).slice(0, rounds).map((q) => q.id);
    const initial: ErrorState = { bankId: bank.bankId, bankName: bank.bankName, rounds: questionIds.length, questionIds, explainers: [], index: 0, marks: [], stars: 0, streak: 0, bestStreak: 0 };
    try {
      await game.start(initial, bank.bankName);
    } catch {
      toast.error('No se pudo empezar la partida. Revisa la conexión.');
      return;
    }
    setState(initial);
    setHistory([]);
    setRevealed(false);
    setExplainer(null);
    setPhase('playing');
  };

  const finish = useCallback(async (final: ErrorState) => {
    const result: ErrorResult = {
      bankName: final.bankName, rounds: final.rounds, found: final.marks.filter(Boolean).length, stars: final.stars, explainers: final.explainers.length,
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
    if (!state || !revealed) return;
    const { next, bonus } = applyMark(state, correct);
    if (correct) sound.star(next.stars - 1);
    else sound.soft();
    if (bonus) window.setTimeout(() => sound.success(), 250);
    setHistory((h) => [...h.slice(-9), state]);
    setState(next);
    setRevealed(false);
    setExplainer(null);
    if (next.index >= next.rounds) void finish(next);
    else game.save(next);
  }, [state, revealed, sound, finish, game]);

  const undoMark = useCallback(() => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    setState(previous);
    setRevealed(false);
    game.save(previous);
  }, [history, game]);

  /** Jiro elige quién explica (entre presentes; quien descansa también participa). */
  const pickExplainer = () => {
    if (!state) return;
    const pool = students.filter((s) => presence.presentIds.has(s.id) && !state.explainers.includes(s.id));
    const source = pool.length ? pool : students.filter((s) => presence.presentIds.has(s.id));
    const chosen = shuffle(source)[0];
    if (!chosen) return;
    sound.tick();
    setExplainer(chosen.id);
    const next = { ...state, explainers: [...state.explainers.filter((id) => id !== chosen.id), chosen.id] };
    setState(next);
    game.save(next);
  };

  const onKey = useCallback((e: KeyboardEvent) => {
    if (phase !== 'playing' || !revealed) return false;
    if (e.key === 's' || e.key === 'S' || e.key === '1') { mark(true); return true; }
    if (e.key === 'n' || e.key === 'N' || e.key === '2') { mark(false); return true; }
    return false;
  }, [phase, revealed, mark]);

  const explainerStudent = explainer ? students.find((s) => s.id === explainer) : null;
  const jiro: { pose: JiroPose; line: string | null } = (() => {
    if (phase === 'setup') return { pose: 'confundido', line: 'Resolví unos ejercicios… pero creo que me equivoqué en algo.' };
    if (phase === 'bitacora') return { pose: 'celebrando', line: `¡Encontraron ${game.session?.result?.found ?? 0} de mis errores!` };
    if (revealed) return { pose: 'senalando', line: '¡Ahí estaba mi error!' };
    return { pose: 'confundido', line: 'Me equivoqué en un paso… ¿en cuál?' };
  })();

  const result = game.session?.result;
  const longProblem = (current ? problemOf(current) : '').length > 140;

  return (
    <EscenarioObservatorio
      label="El Error de Jiro"
      onClose={() => { if (state && phase === 'playing') game.save(state); onExit(); }}
      jiro={{ ...jiro, placement: 'corner' }}
      primary={phase === 'setup'
        ? { label: 'Empezar', onClick: () => void start(), disabled: !bank || questionsLoading || playable.length === 0 }
        : phase === 'playing' && !revealed ? { label: 'Revelar', onClick: () => { setRevealed(true); sound.tick(); }, disabled: !current } : null}
      onKey={onKey}
      onPrev={phase === 'playing' ? undoMark : undefined}
      soundState={soundState}
      status={phase === 'playing' && state ? `Error ${Math.min(state.index + 1, state.rounds)} de ${state.rounds} · ⭐ ${state.stars}` : undefined}
      barExtra={phase === 'playing' && state ? (
        <>
          {history.length > 0 && (
            <button type="button" onClick={undoMark} className={stageControlClass} title="Deshacer la última marca (←)">
              <Undo2 size={18} aria-hidden="true" /> <span className="hidden sm:inline">Deshacer</span>
            </button>
          )}
          {state.marks.length > 0 && <StageEndButton onEnd={() => void finish({ ...state, rounds: state.marks.length })} />}
        </>
      ) : undefined}
    >
      {phase === 'setup' && (
        <div className="flex w-full max-w-5xl flex-col gap-5">
          <h1 className="stage-title text-center font-black">El Error de Jiro</h1>
          <fieldset>
            <legend className="mb-2 text-lg font-bold text-indigo-100">Errores a buscar</legend>
            <div className="flex flex-wrap gap-2">
              {ROUND_OPTIONS.map((r) => (
                <button key={r} type="button" onClick={() => setRounds(r)} aria-pressed={rounds === r} className={chip(rounds === r)}>{r}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-lg font-bold text-indigo-100">Banco</legend>
            {banksLoading ? (
              <p className="text-indigo-100" role="status">Cargando bancos…</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {candidateBanks.map((b) => {
                  const on = bank?.bankId === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBank({ bankId: b.id, bankName: b.name })}
                      aria-pressed={on}
                      className={`flex min-h-[56px] flex-col items-start justify-center rounded-2xl border-2 px-4 py-2 text-left ${on ? 'border-amber-300 bg-amber-300/15' : 'border-white/15 hover:bg-white/5'}`}
                    >
                      <span className="text-lg font-bold text-white">{b.name}</span>
                      <span className="text-sm font-semibold text-indigo-200">{b.classroomName}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {bank && !questionsLoading && (
              <p className="mt-2 text-base text-amber-100" role="status">
                {playable.length === 0
                  ? 'Este banco no tiene ejercicios de "El Error de Jiro". Genera algunos abajo.'
                  : `${playable.length} ejercicio${playable.length === 1 ? '' : 's'} con error${playable.length < rounds ? `: jugaremos ${playable.length}` : ''}.`}
              </p>
            )}
          </fieldset>
          {bank && <UnreviewedNotice banks={banks.filter((b) => b.id === bank.bankId)} classroomId={classroom.id} />}
          <AiQuestionGenerator classroomId={classroom.id} kind="ERROR_STEPS" quantity={6} onCreated={(created) => setBank(created)} />
          <p className="text-sm text-indigo-100">
            También puedes escribirlos en tu banco: pregunta de opción única que empiece con «{ERROR_PREFIX}», cada opción es un paso y la correcta es el paso equivocado.
          </p>
        </div>
      )}

      {phase === 'playing' && state && (
        <div className="flex w-full max-w-6xl flex-col items-center gap-4">
          <ol className="flex flex-wrap justify-center gap-1.5" aria-label={`${state.stars} de ${maxStars(state.rounds)} estrellas`}>
            {Array.from({ length: maxStars(state.rounds) }, (_, i) => (
              <li key={i}>
                <Star aria-hidden="true" className={`h-[5vh] min-h-[22px] w-[5vh] min-w-[22px] ${i < state.stars ? 'obs-star-in fill-amber-300 text-amber-300' : 'text-white/40'}`} />
              </li>
            ))}
          </ol>

          {current && answer ? (
            <>
              <p className={`${longProblem ? 'stage-body' : 'stage-option'} max-w-5xl text-center font-black text-white`}>{problemOf(current)}</p>
              <ol className="flex w-full max-w-5xl flex-col gap-2" aria-label="Pasos de la solución de Jiro">
                {answer.options.map((text, i) => {
                  const wrong = revealed && answer.index === i;
                  return (
                    <li
                      key={i}
                      className={`flex items-center gap-4 rounded-2xl border-4 px-5 py-3 transition-colors ${wrong ? 'border-rose-300 bg-rose-500/25' : 'border-white/20 bg-white/5'}`}
                    >
                      <span className="stage-option w-[1.6em] shrink-0 text-center font-black text-amber-200">{i + 1}</span>
                      <span className="stage-body font-semibold text-white">{stepText(text)}</span>
                      {wrong && <span className="ml-auto shrink-0 rounded-xl bg-rose-200 px-3 py-1 text-base font-black text-rose-950">❌ Aquí</span>}
                    </li>
                  );
                })}
              </ol>
              {revealed && current.explanation && (
                <p className="stage-body w-full max-w-5xl rounded-2xl border border-amber-300/40 bg-amber-300/10 px-5 py-3 text-center text-white" role="status">
                  {current.explanation}
                </p>
              )}
            </>
          ) : (
            <p className="stage-body text-indigo-100" role="status">{questionsLoading ? 'Cargando ejercicio…' : 'Este ejercicio ya no está en el banco.'}</p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={pickExplainer} className={`${stageControlClass} border border-white/30 text-lg`}>
              <Dices size={20} aria-hidden="true" /> ¿Quién lo explica?
            </button>
            {explainerStudent && (
              <span className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-[clamp(18px,3vh,34px)] font-black text-white" aria-live="polite">
                Explica: {studentNames(explainerStudent, classroom.showCharacterName).primary}
                {explainerStudent.hp <= 0 && <Moon className="h-[0.8em] w-[0.8em]" aria-label="Descansando" />}
              </span>
            )}
          </div>

          {revealed && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-xl font-bold text-indigo-100">¿Lo encontró la mayoría?</span>
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
          activityName="El Error de Jiro"
          classroomId={classroom.id}
          students={students}
          showCharacterName={classroom.showCharacterName}
          achievements={[
            { icon: '🔍', label: 'errores encontrados', value: `${result?.found ?? 0}/${result?.rounds ?? 0}` },
            { icon: '⭐', label: 'estrellas encendidas', value: String(result?.stars ?? 0) },
            { icon: '🗣️', label: 'explicaron en voz alta', value: String(result?.explainers ?? 0) },
          ]}
          suggestedXp={suggestedXpFor(result?.found ?? 0, result?.rounds ?? 0)}
          onSessionChange={(s) => game.setSession(s as ActivitySession<ErrorState, ErrorResult>)}
          onPlayAgain={() => { game.setSession(null); setState(null); setHistory([]); setPhase('setup'); }}
          onExit={onExit}
        />
      )}
    </EscenarioObservatorio>
  );
};
