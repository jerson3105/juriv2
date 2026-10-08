import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Check, LayoutGrid, PlayCircle, Printer, RotateCcw, Sparkles, Undo2, X } from 'lucide-react';
import type { ActivitySession } from '../../../lib/activityApi';
import { bingoApi, bingoKeys, type BingoSize, type BingoSource } from '../../../lib/bingoApi';
import type { Classroom, Student } from '../../../lib/classroomApi';
import { hasStudentAccount } from '../../../lib/studentAccess';
import { useTeacherBanks } from '../../classroom/utilities/questionDraw';
import { ActivityWelcome } from '../ActivityWelcome';
import { Bitacora } from '../Bitacora';
import { CATALOG } from '../catalog';
import { starBurst, starRain } from '../conquista/conquistaFx';
import { EscenarioObservatorio, stageControlClass } from '../EscenarioObservatorio';
import type { JiroPose } from '../jiroPoses';
import { useStageSound } from '../observatorioSound';
import { PresenceEditor } from '../presence';
import { StageEndButton } from '../StageEndButton';
import { StageTutorial } from '../StageTutorial';
import { UnreviewedNotice } from '../UnreviewedNotice';
import { useActivitySession } from '../useActivitySession';
import { useTodayPresence } from '../usePresence';
import { Astro, CardConstellation, CieloDePalabras, EsferaJiro, VerifyForm } from './BingoBoard';
import {
  FIGURES, ballsPlayed, checkCard, classStars, missedBalls, revealedKeys, shuffled, sortedAnswers, suggestedXp,
  type BingoResult, type BingoState,
} from './bingoLogic';
import { printBingoCards } from './printBingoCards';

const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const THINK_OPTIONS = [0, 20, 30];
const SPARE_CARDS = 3;
const DRAW_MS = 1700;
// La pregunta ocupa todo el ancho y la explicación va junto a la esfera. La letra parte según el largo y, si aun así
// no entra en la pantalla, baja un escalón más (fit, hasta MAX_FIT) en vez de hacer scroll.
const PROMPT_SIZES = ['stage-title', 'stage-option', 'stage-body', 'stage-balloon', 'text-[clamp(18px,3vh,34px)] leading-snug'];
const EXPLAIN_SIZES = ['stage-balloon', 'text-[clamp(18px,3vh,34px)] leading-snug', 'text-[clamp(16px,2.6vh,30px)] leading-snug', 'text-[clamp(15px,2.3vh,26px)] leading-snug'];
const MAX_FIT = 3;
const promptSizeClass = (text: string, fit: number) =>
  PROMPT_SIZES[Math.min(PROMPT_SIZES.length - 1, (text.length > 140 ? 2 : text.length > 70 ? 1 : 0) + fit)];
const explainSizeClass = (text: string, fit: number) => EXPLAIN_SIZES[Math.min(EXPLAIN_SIZES.length - 1, (text.length > 120 ? 1 : 0) + fit)];
/**
 * ¿El contenido del escenario (EscenarioObservatorio) es más alto que su ventana? Se mide el alto de layout
 * (offsetHeight no cuenta las animaciones con transform) de lo que hay dentro de cada hijo del contenedor con scroll:
 * el hijo se estira a la altura del escenario y su contenido se le sale por abajo.
 */
const stageOverflows = (el: HTMLElement | null) => {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    if (!/(auto|scroll)/.test(getComputedStyle(node).overflowY)) continue;
    return [...node.children].some((child) => {
      const style = getComputedStyle(child);
      const inFlow = [...child.children].filter((c) => !/absolute|fixed/.test(getComputedStyle(c).position)) as HTMLElement[];
      const gaps = (parseFloat(style.rowGap) || 0) * Math.max(0, inFlow.length - 1);
      const content = inFlow.reduce((sum, c) => sum + c.offsetHeight, 0) + gaps + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      return content > node.clientHeight + 1;
    });
  }
  return false;
};
const COVER = CATALOG.find((entry) => entry.id === 'bingo')?.cover ?? '/assets/jiro/actividades/bingo.webp';

const chip = (on: boolean) =>
  `min-h-[48px] rounded-xl border px-4 text-lg font-bold transition-colors ${on ? 'border-amber-300 bg-amber-300 text-amber-950' : 'border-white/30 text-white hover:bg-white/10'}`;

interface BingoActivityProps {
  classroom: Classroom & { students?: Student[] };
  resume?: ActivitySession<unknown, unknown> | null;
  /** «Usar en clase» desde el Banco de preguntas: el banco ya elegido. */
  initialBankId?: string | null;
  onExit: () => void;
}

type Verified = { card: number; result: ReturnType<typeof checkCard>; bingoNumber: number | null; repeated: boolean } | null;

/**
 * Bingo Estelar: el docente sortea preguntas y cada alumno marca su cartón (en pantalla si tiene cuenta; en una hoja
 * impresa si no). Los bingos se verifican por número de cartón y se celebran sin nombres; lo que se premia es la
 * precisión de la clase (el docente marca si la mayoría acertó cada bola) y la revancha de las falladas.
 */
export const BingoActivity = ({ classroom, resume, initialBankId, onExit }: BingoActivityProps) => {
  const students = useMemo(() => classroom.students ?? [], [classroom.students]);
  const presence = useTodayPresence(classroom.id, students);
  const soundState = useStageSound();
  const { sound } = soundState;
  const reduce = useReducedMotion();
  const game = useActivitySession<BingoState, BingoResult>(classroom.id, 'BINGO', resume as ActivitySession<BingoState, BingoResult> | null | undefined);
  const saved = (resume?.status === 'ACTIVE' ? resume.state : null) as BingoState | null;

  const [state, setState] = useState<BingoState | null>(saved);
  const [finished, setFinished] = useState(resume?.status === 'FINISHED');
  // Bienvenida de pantalla completa al abrir (no al volver a la Bitácora de una partida terminada) y el tutorial
  // para estudiantes a demanda («Cómo se juega»).
  const [welcome, setWelcome] = useState(resume?.status !== 'FINISHED');
  const [tutorial, setTutorial] = useState(false);
  const [history, setHistory] = useState<BingoState[]>([]);
  // Preparación
  const [source, setSource] = useState<BingoSource>(() => (initialBankId ? { kind: 'bank', bankId: initialBankId } : { kind: 'tables', tables: [2, 3, 4, 5, 6, 7, 8, 9] }));
  const [size, setSize] = useState<BingoSize>(4);
  const [think, setThink] = useState(0);
  const [paperOverride, setPaperOverride] = useState<number | null>(null);
  const [editingPresence, setEditingPresence] = useState(false);
  const [creating, setCreating] = useState(false);
  // Escenario
  const [spin, setSpin] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verified, setVerified] = useState<Verified>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const phase: 'setup' | 'deal' | 'playing' | 'bitacora' = finished ? 'bitacora' : !state ? 'setup' : !state.order ? 'deal' : 'playing';

  // ── Preparación ──
  const { data: banks = [], isLoading: banksLoading } = useTeacherBanks(phase === 'setup');
  // Bancos con respuestas cortas (la misma regla que el mazo del servidor); el elegido desde el banco, siempre.
  const usableBanks = banks.filter((b) => b.stats.bingoAnswers > 0 || (source.kind === 'bank' && source.bankId === b.id));
  const sourceReady = source.kind === 'bank' || source.tables.length > 0;
  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: bingoKeys.preview(classroom.id, source),
    queryFn: () => bingoApi.preview(classroom.id, source),
    enabled: phase === 'setup' && sourceReady,
    staleTime: 30_000,
  });
  const present = students.filter((s) => presence.presentIds.has(s.id));
  const screenIds = present.filter(hasStudentAccount).map((s) => s.id);
  const paperCount = paperOverride ?? Math.max(0, present.length - screenIds.length) + SPARE_CARDS;
  const minimum = preview?.minimum[size] ?? 0;
  const enoughAnswers = !!preview && preview.answers >= minimum;

  const create = async () => {
    if (!enoughAnswers || creating) return;
    sound.unlock();
    setCreating(true);
    try {
      const created = await bingoApi.create<BingoState>(classroom.id, { source, size, paperCount, screenStudentIds: screenIds });
      game.setSession(created as ActivitySession<BingoState, BingoResult>);
      const initial = { ...(created.state as BingoState), thinkSeconds: think };
      setState(initial);
      game.save(initial);
      setHistory([]);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'No se pudo armar el Bingo. Revisa la conexión.');
    } finally {
      setCreating(false);
    }
  };

  // ── Cartones (imprimir y verificar): del servidor, la única fuente ──
  const sessionId = game.session?.id ?? '';
  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: bingoKeys.cards(sessionId, state?.seed ?? ''),
    queryFn: () => bingoApi.cards(sessionId),
    enabled: !!sessionId && !!state && phase !== 'bitacora',
    staleTime: Infinity,
  });
  const answerText = useMemo(() => new Map((state?.answers ?? []).map((a) => [a.key, a.text])), [state?.answers]);
  const print = (which: 'paper' | 'all') => {
    if (!cards || !state) return;
    if (!printBingoCards(cards, answerText, state.title, which)) toast.error('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.');
  };

  // ── Partida ──
  const ballsById = useMemo(() => new Map((state?.balls ?? []).map((b) => [b.id, b])), [state?.balls]);
  const order = useMemo(() => state?.order ?? [], [state?.order]);
  const drawn = state?.drawn ?? 0;
  const marks = useMemo(() => state?.marks ?? [], [state?.marks]);
  const figureIndex = state?.figure ?? 0;
  const figure = FIGURES[Math.min(figureIndex, FIGURES.length - 1)];
  const revancha = state?.revancha ?? null;
  const current = revancha ? ballsById.get(revancha.ids[revancha.index]) : drawn > 0 ? ballsById.get(order[drawn - 1]) : undefined;
  const revealed = revancha ? revancha.revealed : !!state?.revealed;
  const pendingMark = revancha ? revancha.revealed : drawn > 0 && !!state?.revealed && marks[drawn - 1] == null;

  // La explicación y «¿La mayoría acertó?» guardan su lugar (invisibles) desde que sale la bola: el escalón de letra se
  // calcula una vez por bola (y al cambiar la ventana) y al revelar no salta nada.
  const ballKey = revancha ? `r${revancha.index}` : String(drawn);
  const reserveMark = !!current && !drawing && (!!revancha || marks[drawn - 1] == null);
  const fitRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(() => `${window.innerWidth}x${window.innerHeight}`);
  const fitKey = `${ballKey}-${drawing ? 1 : 0}-${viewport}`;
  const [fitState, setFitState] = useState({ key: '', step: 0 });
  const fit = fitState.key === fitKey ? fitState.step : 0;
  useEffect(() => {
    const onResize = () => setViewport(`${window.innerWidth}x${window.innerHeight}`);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useLayoutEffect(() => {
    if (fit < MAX_FIT && stageOverflows(fitRef.current)) setFitState({ key: fitKey, step: fit + 1 });
  }, [fitKey, fit]);
  const lastFigureWon = state?.figureWonAt != null && figureIndex >= FIGURES.length - 1;
  const outOfBalls = drawn >= order.length && !pendingMark && (drawn === 0 || !!state?.revealed);
  const gameOver = phase === 'playing' && !revancha && (lastFigureWon || outOfBalls);
  const stars = state ? classStars(state) : 0;
  // Respuestas reveladas: la secuencia completa (con repetidas: 4 × 5 y 2 × 10 dan 20), sin repetir por orden de
  // encendido (número de salida) y las 6 más recientes (franja de las pantallas 4:3).
  const revealedSequence = useMemo(() => {
    if (!state) return [] as string[];
    const count = state.revealed ? drawn : Math.max(0, drawn - 1);
    return order.slice(0, count).map((id) => ballsById.get(id)?.key).filter((k): k is string => !!k);
  }, [state, order, drawn, ballsById]);
  const revealedInOrder = useMemo(() => revealedSequence.filter((k, i, all) => all.indexOf(k) === i), [revealedSequence]);
  const lastKey = revealedSequence[revealedSequence.length - 1] ?? null;
  const recentKeys = useMemo(() => [...revealedSequence].reverse().filter((k, i, all) => all.indexOf(k) === i).slice(0, 6), [revealedSequence]);
  const sortedBoard = useMemo(() => sortedAnswers(state?.answers ?? []), [state?.answers]);

  const commit = useCallback((next: BingoState) => {
    setHistory((h) => (state ? [...h.slice(-9), state] : h));
    setState(next);
    game.save(next);
  }, [state, game]);

  const undo = useCallback(() => {
    const previous = history[history.length - 1];
    if (!previous || drawing) return;
    setHistory((h) => h.slice(0, -1));
    setState(previous);
    game.save(previous);
    sound.soft();
  }, [history, drawing, game, sound]);

  // Tiempo para pensar (opcional): cuenta hacia atrás desde que sale la bola; no revela solo.
  useEffect(() => {
    const total = state?.thinkSeconds ?? 0;
    if (!total || drawing || revancha || drawn === 0 || state?.revealed) { setSecondsLeft(0); return undefined; }
    setSecondsLeft(total);
    const id = window.setInterval(() => setSecondsLeft((s) => {
      if (s <= 1) { window.clearInterval(id); sound.tick(); return 0; }
      return s - 1;
    }), 1000);
    return () => window.clearInterval(id);
  }, [drawn, drawing, revancha, state?.revealed, state?.thinkSeconds, sound]);

  const startDraws = () => {
    if (!state) return;
    sound.unlock();
    commit({ ...state, order: shuffled(state.balls.map((b) => b.id)), drawn: 0, revealed: false, marks: [], figure: 0, figureWonAt: null, winners: state.winners ?? [], revancha: null });
  };

  const draw = () => {
    if (!state || drawing || drawn >= order.length || gameOver) return;
    // Con la bola siguiente a un bingo se pasa a la figura siguiente (los empates ya se verificaron).
    const advance = state.figureWonAt != null && figureIndex < FIGURES.length - 1;
    commit({
      ...state,
      drawn: drawn + 1,
      revealed: false,
      marks: [...marks, null],
      ...(advance ? { figure: figureIndex + 1, figureWonAt: null } : {}),
    });
    setVerified(null);
    setSpin((n) => n + 1);
    setDrawing(true);
    timers.current.forEach((id) => window.clearTimeout(id));
    if (reduce) {
      timers.current = [window.setTimeout(() => { setDrawing(false); sound.chime(); }, 200)];
      return;
    }
    // Ticks cada vez más espaciados mientras gira; whoosh al soltar la estrella; campanilla con la pregunta.
    const ticks = [0, 60, 130, 210, 300, 400, 520, 660, 830];
    timers.current = [
      ...ticks.map((ms) => window.setTimeout(() => sound.tick(), ms)),
      window.setTimeout(() => sound.whoosh(), 1100),
      window.setTimeout(() => sound.chime(), 1450),
      window.setTimeout(() => setDrawing(false), DRAW_MS),
    ];
    if (advance) window.setTimeout(() => toast(`Ahora buscamos: ${FIGURES[figureIndex + 1].name}`, { icon: '✨' }), DRAW_MS);
  };

  const reveal = () => {
    if (!state || drawing || !current || revealed) return;
    if (revancha) commit({ ...state, revancha: { ...revancha, revealed: true } });
    else commit({ ...state, revealed: true });
    sound.star((revealedInOrder.length) % 8);
  };

  const finish = useCallback(async (final: BingoState) => {
    const result: BingoResult = {
      title: final.title,
      size: final.size,
      games: final.game,
      balls: ballsPlayed(final),
      stars: classStars(final),
      bingos: (final.winners ?? []).length,
      recovered: final.revancha?.recovered ?? 0,
      missed: final.revancha?.ids.length ?? 0,
    };
    try {
      await game.finish(result, final);
      sound.success();
      starRain();
      setFinished(true);
    } catch {
      toast.error('No se pudo guardar la partida. Inténtalo de nuevo.');
    }
  }, [game, sound]);

  const mark = useCallback((correct: boolean) => {
    if (!state || !pendingMark) return;
    if (correct) sound.chime();
    else sound.soft();
    if (revancha) {
      const next = { ...revancha, index: revancha.index + 1, revealed: false, recovered: revancha.recovered + (correct ? 1 : 0) };
      const nextState = { ...state, revancha: next };
      if (next.index >= next.ids.length) {
        setState(nextState);
        void finish(nextState);
      } else {
        commit(nextState);
      }
      return;
    }
    const nextMarks = [...marks];
    nextMarks[drawn - 1] = correct;
    commit({ ...state, marks: nextMarks });
  }, [state, pendingMark, revancha, marks, drawn, commit, finish, sound]);

  /** Fin del juego: primero la revancha con las que la clase falló; luego la Bitácora. */
  const endGame = useCallback(() => {
    if (!state || drawing) return;
    // Una bola sorteada que no se alcanzó a marcar no cuenta (las estadísticas solo cuentan las marcadas).
    const missed = missedBalls(state);
    if (!state.revancha && missed.length > 0) {
      commit({ ...state, revancha: { ids: missed, index: 0, revealed: false, recovered: 0 } });
      sound.whoosh();
      return;
    }
    void finish(state);
  }, [state, drawing, commit, finish, sound]);

  /** Otra partida con los MISMOS cartones: otro orden de sorteo y vuelve a la Línea. */
  const anotherGame = () => {
    if (!state) return;
    const played = marks.filter((m) => m !== null).length;
    const won = marks.filter((m) => m === true).length + (state.revancha?.recovered ?? 0);
    commit({
      ...state,
      game: state.game + 1,
      order: shuffled(state.balls.map((b) => b.id)),
      drawn: 0,
      revealed: false,
      marks: [],
      figure: 0,
      figureWonAt: null,
      revancha: null,
      totals: { balls: (state.totals?.balls ?? 0) + played, stars: (state.totals?.stars ?? 0) + won },
    });
    setVerified(null);
    sound.whoosh();
  };

  const verify = (card: number) => {
    if (!state || !cards) return;
    const cells = cards.cards[card - 1]?.cells;
    if (!cells) return;
    const result = checkCard(cells, revealedKeys(state), figure.id, state.size);
    if (!result.complete) {
      setVerified({ card, result, bingoNumber: null, repeated: false });
      sound.soft();
      return;
    }
    const winners = state.winners ?? [];
    const already = winners.find((w) => w.card === card && w.figure === figure.id && w.game === state.game);
    if (already) {
      setVerified({ card, result, bingoNumber: winners.indexOf(already) + 1, repeated: true });
      return;
    }
    const nextWinners = [...winners, { card, figure: figure.id, game: state.game, ball: drawn }];
    commit({ ...state, winners: nextWinners, figureWonAt: state.figureWonAt ?? drawn });
    setVerified({ card, result, bingoNumber: nextWinners.length, repeated: false });
    sound.conquer();
    starBurst();
  };

  const closeVerify = () => {
    setVerifyOpen(false);
    setVerified(null);
  };

  const onKey = useCallback((e: KeyboardEvent) => {
    if (phase !== 'playing') return false;
    if ((e.key === 'b' || e.key === 'B') && !revancha) { setVerified(null); setVerifyOpen(true); return true; }
    if (e.key === 't' || e.key === 'T') { setBoardOpen((v) => !v); return true; }
    if (!pendingMark) return false;
    if (e.key === 's' || e.key === 'S' || e.key === '1') { mark(true); return true; }
    if (e.key === 'n' || e.key === 'N' || e.key === '2') { mark(false); return true; }
    return false;
  }, [phase, revancha, pendingMark, mark]);

  const primary = (() => {
    if (phase === 'setup') return { label: creating ? 'Repartiendo…' : 'Repartir cartones', onClick: () => void create(), disabled: !enoughAnswers || creating || previewLoading || paperCount + screenIds.length < 1 };
    if (phase === 'deal') return { label: 'Empezar el sorteo', onClick: startDraws };
    if (phase !== 'playing' || verifyOpen) return null;
    if (drawing) return { label: 'Sorteando…', onClick: () => {}, disabled: true };
    if (current && !revealed) return { label: 'Revelar', onClick: reveal };
    if (pendingMark) return null;
    if (revancha) return null;
    if (gameOver) return { label: 'Terminar', onClick: endGame };
    return { label: drawn === 0 ? 'Sortear la primera' : 'Sortear', onClick: draw };
  })();

  const jiro: { pose: JiroPose; line: string | null } = (() => {
    if (phase === 'setup') return { pose: 'senalando', line: '¡Bingo Estelar! Cada cartón es un pedacito de cielo.' };
    if (phase === 'deal') return { pose: 'emocionado', line: 'Saquen su cartón… ¡y un lápiz!' };
    if (phase === 'bitacora') return { pose: 'celebrando', line: `¡La clase encendió ${game.session?.result?.stars ?? stars} estrellas!` };
    if (verifyOpen && verified) return verified.result.complete ? { pose: 'celebrando', line: '¡Constelación completa!' } : { pose: 'confundido', line: '¡Casi! Sigan jugando.' };
    if (verifyOpen) return { pose: 'nervioso', line: '¿Qué número tiene el cartón?' };
    if (revancha) return { pose: 'emocionado', line: revealed ? '¿Esta vez la mayoría acertó?' : '¡Revancha! Esta se nos escapó.' };
    if (gameOver) return { pose: 'celebrando', line: lastFigureWon ? '¡Cielo completo!' : '¡Ya no quedan bolas!' };
    if (drawing) return { pose: 'emocionado', line: '¡Gira la esfera!' };
    if (current && !revealed) return { pose: 'emocionado', line: '¿Quién la tiene? Piensen…' };
    if (current && revealed) return { pose: 'senalando', line: `¡Era ${answerText.get(current.key) ?? ''}!` };
    return { pose: 'senalando', line: `Buscamos: ${figure.name}.` };
  })();

  const result = game.session?.result;
  const playing = phase === 'playing';

  return (
    <EscenarioObservatorio
      label="Bingo Estelar"
      onClose={() => {
        if (verifyOpen) { closeVerify(); return; }
        if (boardOpen) { setBoardOpen(false); return; }
        if (state && !finished) game.save(state);
        onExit();
      }}
      jiro={{ ...jiro, placement: 'corner' }}
      primary={primary}
      onKey={onKey}
      onPrev={playing ? undo : undefined}
      soundState={soundState}
      status={playing && state
        ? (revancha ? `Revancha ${Math.min(revancha.index + 1, revancha.ids.length)} de ${revancha.ids.length} · ⭐ ${stars}` : `Juego ${state.game} · Bola ${drawn} de ${order.length} · ⭐ ${stars}`)
        : undefined}
      barExtra={playing && state ? (
        <>
          {history.length > 0 && (
            <button type="button" onClick={undo} className={stageControlClass} title="Deshacer (←)">
              <Undo2 size={18} aria-hidden="true" /> <span className="hidden sm:inline">Deshacer</span>
            </button>
          )}
          <button type="button" onClick={() => setBoardOpen((v) => !v)} aria-pressed={boardOpen} className={stageControlClass} title="Tablero (T)">
            <LayoutGrid size={18} aria-hidden="true" /> <span className="hidden sm:inline">Tablero</span>
          </button>
          {!revancha && (
            <button type="button" onClick={() => { setVerified(null); setVerifyOpen(true); }} className={`${stageControlClass} border border-amber-300/60`} title="Verificar un bingo (B)">
              <Sparkles size={18} aria-hidden="true" /> ¡Bingo!
            </button>
          )}
          {drawn > 0 && !gameOver && <StageEndButton onEnd={endGame} />}
        </>
      ) : undefined}
    >
      {phase === 'setup' && (
        <div className="flex w-full max-w-5xl flex-col gap-5">
          <h1 className="stage-title text-center font-black">Bingo Estelar</h1>
          <div className="flex justify-center">
            <button type="button" onClick={() => setTutorial(true)} className={`${stageControlClass} border border-white/25 text-base`}>
              <PlayCircle size={20} aria-hidden="true" /> Cómo se juega · 1 min
            </button>
          </div>
          <fieldset>
            <legend className="mb-2 text-lg font-bold text-indigo-100">De dónde salen las preguntas</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSource({ kind: 'tables', tables: [2, 3, 4, 5, 6, 7, 8, 9] })} aria-pressed={source.kind === 'tables'} className={chip(source.kind === 'tables')}>🔢 Tablas de multiplicar</button>
              {banksLoading && <span className="self-center text-indigo-100" role="status">Cargando bancos…</span>}
              {usableBanks.map((b) => (
                <button key={b.id} type="button" onClick={() => setSource({ kind: 'bank', bankId: b.id })} aria-pressed={source.kind === 'bank' && source.bankId === b.id} className={chip(source.kind === 'bank' && source.bankId === b.id)}>
                  📚 {b.name}
                </button>
              ))}
            </div>
            {source.kind === 'tables' && (
              <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Tablas">
                {TABLES.map((t) => {
                  const on = source.tables.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSource({ kind: 'tables', tables: on ? source.tables.filter((x) => x !== t) : [...source.tables, t].sort((a, b) => a - b) })}
                      className={`min-h-[44px] min-w-[52px] rounded-xl border px-3 text-lg font-black ${on ? 'border-amber-300 bg-amber-300/20 text-amber-100' : 'border-white/25 text-indigo-100 hover:bg-white/10'}`}
                    >
                      ×{t}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-sm text-indigo-100">Del banco sirven las preguntas de opción única y las de unir pares, con respuestas cortas (hasta 18 letras).</p>
          </fieldset>

          <div className="flex flex-wrap gap-6">
            <fieldset>
              <legend className="mb-2 text-lg font-bold text-indigo-100">Cartón</legend>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setSize(3)} aria-pressed={size === 3} className={chip(size === 3)}>3×3 · Jiro al centro</button>
                <button type="button" onClick={() => setSize(4)} aria-pressed={size === 4} className={chip(size === 4)}>4×4</button>
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-lg font-bold text-indigo-100">Tiempo para pensar</legend>
              <div className="flex flex-wrap gap-2">
                {THINK_OPTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => setThink(s)} aria-pressed={think === s} className={chip(think === s)}>{s === 0 ? 'Sin tiempo' : `${s} s`}</button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3" role="status" aria-live="polite">
            {previewLoading || !preview ? (
              <p className="text-base text-indigo-100">{sourceReady ? 'Revisando las preguntas…' : 'Elige al menos una tabla.'}</p>
            ) : (
              <>
                <p className={`text-lg font-bold ${enoughAnswers ? (preview.answers >= minimum * 2 - 8 ? 'text-emerald-200' : 'text-amber-200') : 'text-rose-200'}`}>
                  {enoughAnswers
                    ? `${preview.answers} respuestas distintas para ${preview.balls} bolas: alcanza para ${size}×${size}.`
                    : `Faltan ${minimum - preview.answers} respuestas cortas para ${size}×${size} (mínimo ${minimum}).`}
                </p>
                {preview.skipped > 0 && <p className="text-sm text-indigo-100">{preview.skipped} no sirven para el bingo (respuesta larga o sin una sola correcta).</p>}
              </>
            )}
          </div>
          {source.kind === 'bank' && <UnreviewedNotice banks={banks.filter((b) => b.id === source.bankId)} classroomId={classroom.id} />}

          <fieldset>
            <legend className="mb-2 text-lg font-bold text-indigo-100">Cartones</legend>
            <div className="flex flex-wrap items-center gap-3 text-lg text-white">
              <span className="rounded-xl bg-white/10 px-3 py-2 font-bold">📱 {screenIds.length} en pantalla</span>
              <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 font-bold">
                🖨️ En papel
                <button type="button" onClick={() => setPaperOverride(Math.max(0, paperCount - 1))} className="h-9 w-9 rounded-lg border border-white/30 hover:bg-white/10" aria-label="Un cartón de papel menos">−</button>
                <span className="min-w-[2ch] text-center" aria-live="polite">{paperCount}</span>
                <button type="button" onClick={() => setPaperOverride(Math.min(120, paperCount + 1))} className="h-9 w-9 rounded-lg border border-white/30 hover:bg-white/10" aria-label="Un cartón de papel más">+</button>
              </span>
              <button type="button" onClick={() => setEditingPresence((v) => !v)} aria-expanded={editingPresence} className={`${stageControlClass} border border-white/25 text-base`}>
                {editingPresence ? 'Listo' : `Ajustar presentes (${present.length})`}
              </button>
            </div>
            <p className="mt-2 text-sm text-indigo-100">En pantalla juegan los presentes con cuenta; los demás, en papel ({SPARE_CARDS} de repuesto incluidos).{!presence.fromAttendance && ' Hoy no se pasó lista: todos cuentan como presentes.'}</p>
            {editingPresence && (
              <div className="mt-3">
                <PresenceEditor students={students} presentIds={presence.presentIds} showCharacterName={classroom.showCharacterName} onToggle={presence.toggle} onSetAll={presence.setAll} />
              </div>
            )}
          </fieldset>
        </div>
      )}

      {phase === 'deal' && state && (
        <div className="flex w-full max-w-5xl flex-col items-center gap-6 text-center">
          <h1 className="stage-title font-black text-white">Bingo Estelar · Juego {state.game}</h1>
          <p className="stage-body font-bold text-amber-100">{state.title}</p>
          <div className="grid w-full gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
              <p className="text-[clamp(28px,5vh,52px)]" aria-hidden="true">📱</p>
              <p className="stage-option font-black text-white">{state.screen.length} en pantalla</p>
              <p className="stage-body text-indigo-100">Abran Juried: su cartón está en su inicio.</p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
              <p className="text-[clamp(28px,5vh,52px)]" aria-hidden="true">🖨️</p>
              <p className="stage-option font-black text-white">{state.cardCount - state.screen.length} en papel</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => print('paper')} disabled={!cards || state.cardCount === state.screen.length} className={`${stageControlClass} border border-white/30 text-base disabled:opacity-50`}>
                  <Printer size={18} aria-hidden="true" /> {cardsLoading ? 'Preparando…' : 'Imprimir los de papel'}
                </button>
                <button type="button" onClick={() => print('all')} disabled={!cards} className={`${stageControlClass} border border-white/20 text-base disabled:opacity-50`}>
                  Imprimir todos (respaldo)
                </button>
              </div>
            </div>
          </div>
          <p className="stage-body text-indigo-100">Figuras: {FIGURES.map((f) => f.name).join(' → ')}. Ganan todos los que completen con la misma bola.</p>
        </div>
      )}

      {playing && state && (
        <div ref={fitRef} className="flex w-full max-w-[110rem] items-start gap-6">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-4">
            {!revancha ? (
              <p className="rounded-full bg-white/10 px-5 py-2 text-[clamp(16px,2.4vh,28px)] font-bold text-indigo-50">
                Buscamos: <span className="font-black text-amber-200">{figure.name}</span> · {figure.hint}
              </p>
            ) : (
              <p className="rounded-full bg-amber-300/15 px-5 py-2 text-[clamp(16px,2.4vh,28px)] font-black text-amber-100">🔁 Revancha: las que la clase falló</p>
            )}
            {/* La pregunta va arriba, a todo el ancho: en la columna junto a la esfera una pregunta larga bajaba de la pantalla. */}
            <div className="w-full max-w-6xl text-center lg:text-left" aria-live="polite">
              {current && !drawing ? (
                <div key={`${revancha ? `r${revancha.index}` : drawn}`} className="aw-rise flex flex-col gap-2" style={{ '--aw-delay': '0ms' } as CSSProperties}>
                  <p className="text-lg font-bold uppercase tracking-wide text-amber-200">{revancha ? `Revancha ${revancha.index + 1}` : `Bola ${drawn}`}</p>
                  {current.context && <p className="stage-balloon text-indigo-100">{current.context}</p>}
                  <p className={`${promptSizeClass(current.prompt, fit)} font-black text-white`}>{current.prompt}</p>
                </div>
              ) : !current && !drawing ? (
                <p className="stage-option font-black text-white">{drawn === 0 ? '¿Listos con su cartón?' : ''}</p>
              ) : null}
            </div>
            <div className="flex w-full max-w-6xl flex-col items-center gap-6 lg:flex-row">
              <EsferaJiro remaining={Math.max(0, order.length - drawn)} spin={revancha ? 0 : spin}>
                <Astro
                  text={current && revealed ? answerText.get(current.key) ?? '' : null}
                  revealKey={`${revancha ? `r${revancha.index}` : drawn}-${revealed ? 1 : 0}`}
                  delayMs={drawing && !reduce ? 1100 : 0}
                />
              </EsferaJiro>
              <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center lg:items-start lg:text-left" aria-live="polite">
                {current && !drawing && secondsLeft > 0 && (
                  <p className="text-[clamp(20px,3vh,36px)] font-black text-amber-200" aria-label={`Quedan ${secondsLeft} segundos`}>⏳ {secondsLeft}</p>
                )}
                {current && !drawing && current.explanation && (
                  <p key={`e-${ballKey}`} className={`${revealed ? 'aw-rise' : 'invisible'} ${explainSizeClass(current.explanation, fit)} rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-white`} style={{ '--aw-delay': '0ms' } as CSSProperties}>
                    {current.explanation}
                  </p>
                )}
                {(pendingMark || reserveMark) && (
                  <div className={`flex flex-wrap items-center gap-3 ${pendingMark ? '' : 'invisible'}`}>
                    <span className="text-xl font-bold text-indigo-100">¿La mayoría acertó?</span>
                    <button type="button" onClick={() => mark(true)} className="inline-flex min-h-[56px] items-center gap-2 rounded-2xl bg-emerald-300 px-6 text-xl font-black text-emerald-950 hover:bg-emerald-200">
                      <Check size={24} aria-hidden="true" /> Sí <span className="text-sm font-bold opacity-70">(S)</span>
                    </button>
                    <button type="button" onClick={() => mark(false)} className="inline-flex min-h-[56px] items-center gap-2 rounded-2xl border-2 border-white/40 px-6 text-xl font-black text-white hover:bg-white/10">
                      <X size={24} aria-hidden="true" /> No <span className="text-sm font-bold opacity-70">(N)</span>
                    </button>
                  </div>
                )}
                {gameOver && (
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={anotherGame} className={`${stageControlClass} border border-amber-300/60 text-lg`}>
                      <RotateCcw size={20} aria-hidden="true" /> Otra partida (mismos cartones)
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* En pantallas 4:3 el tablero no cabe al lado: las últimas 6 abajo y el completo con T. */}
            <div className="w-full [@media(min-aspect-ratio:3/2)]:hidden">
              <CieloDePalabras answers={recentKeys.map((k) => ({ key: k, text: answerText.get(k) ?? k }))} revealedOrder={revealedInOrder} lastKey={lastKey} compact />
            </div>
          </div>
          <aside className="hidden w-[26vw] shrink-0 rounded-3xl bg-[#070b1c] p-4 [@media(min-aspect-ratio:3/2)]:block" aria-label="Cielo de palabras">
            <p className="mb-3 text-lg font-black text-amber-200">Cielo de palabras · {revealedInOrder.length} de {state.answers.length}</p>
            <CieloDePalabras answers={sortedBoard} revealedOrder={revealedInOrder} lastKey={lastKey} />
          </aside>
        </div>
      )}

      {playing && state && boardOpen && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-[#070b1c] p-6" role="dialog" aria-modal="true" aria-label="Tablero completo">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="stage-option font-black text-amber-200">Cielo de palabras · {revealedInOrder.length} de {state.answers.length}</p>
              <button type="button" onClick={() => setBoardOpen(false)} className={`${stageControlClass} border border-white/30`}>Cerrar (T)</button>
            </div>
            <CieloDePalabras answers={sortedBoard} revealedOrder={revealedInOrder} lastKey={lastKey} compact />
          </div>
        </div>
      )}

      {playing && state && verifyOpen && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-[#070b1c] p-6 text-center" role="dialog" aria-modal="true" aria-label="Verificar un bingo">
          <p className="text-lg font-bold uppercase tracking-wide text-amber-200">¡Bingo! · {figure.name}</p>
          {!cards ? (
            <p className="stage-body text-indigo-100" role="status">Cargando los cartones…</p>
          ) : verified ? (
            <>
              <CardConstellation cells={cards.cards[verified.card - 1].cells} size={state.size} answerText={answerText} result={verified.result} />
              <p className={`stage-option font-black ${verified.result.complete ? 'text-amber-200' : 'text-indigo-100'}`} role="status">
                {verified.result.complete
                  ? `¡Constelación completa! Cartón ${verified.card} · Bingo nº ${verified.bingoNumber}${verified.repeated ? ' (ya contado)' : ''}`
                  : `¡Casi! Le falta${verified.result.missing === 1 ? '' : 'n'} ${verified.result.missing} casilla${verified.result.missing === 1 ? '' : 's'}. ¡Sigue jugando!`}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => setVerified(null)} className={`${stageControlClass} border border-white/30 text-lg`}>Verificar otro cartón</button>
                <button type="button" onClick={closeVerify} className={`${stageControlClass} border border-amber-300/60 text-lg`}>Seguir jugando (Esc)</button>
              </div>
            </>
          ) : (
            <VerifyForm max={state.cardCount} onVerify={verify} />
          )}
        </div>
      )}

      {phase === 'bitacora' && game.session && (
        <Bitacora
          session={game.session}
          activityName="Bingo Estelar"
          classroomId={classroom.id}
          students={students}
          showCharacterName={classroom.showCharacterName}
          achievements={[
            { icon: '⭐', label: 'estrellas de la clase', value: `${result?.stars ?? 0}/${result?.balls ?? 0}` },
            { icon: '🎉', label: 'bingos cantados', value: String(result?.bingos ?? 0) },
            { icon: '🔁', label: 'recuperadas en la revancha', value: String(result?.recovered ?? 0) },
          ]}
          suggestedXp={suggestedXp(result?.stars ?? 0, result?.balls ?? 0, (result?.missed ?? 0) > 0 && result?.recovered === result?.missed)}
          onSessionChange={(s) => game.setSession(s as ActivitySession<BingoState, BingoResult>)}
          onPlayAgain={() => { game.setSession(null); setState(null); setHistory([]); setFinished(false); }}
          onExit={onExit}
        />
      )}
      {welcome && (
        <ActivityWelcome title="Bingo Estelar" tagline="Piensa, marca y canta ¡Bingo!" cover={COVER} sound={sound} mood="feria" onDone={() => setWelcome(false)} />
      )}
      {tutorial && <StageTutorial id="bingo" onClose={() => setTutorial(false)} />}
    </EscenarioObservatorio>
  );
};
