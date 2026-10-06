import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Check, Moon, RefreshCw, Shuffle } from 'lucide-react';
import type { ActivitySession } from '../../../lib/activityApi';
import type { Classroom, Student } from '../../../lib/classroomApi';
import { CLAN_EMBLEMS } from '../../../lib/clanApi';
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
import { answerOf, questionSizeClass } from '../questionHelpers';
import { StageEndButton } from '../StageEndButton';
import { useActivitySession } from '../useActivitySession';
import { useTodayPresence } from '../usePresence';
import { RegionMiniSky, SkyMap, TeamScoreboard } from './ConquistaBoard';
import { CardPanel, ConquestMoment, ConquistaFinale } from './ConquistaMoments';
import { starRain } from './conquistaFx';
import {
  CARD_EVERY, CARDS, QUICK_TEAMS, buildRegions, drawCard, freshQuestions, isPlayable, podium, regionTotal, scoreRound,
  startRound, startSecondChance, type CardId, type ConquistaState, type Region, type Team,
} from './conquistaLogic';
import { regionConstellation, regionIndex } from './conquistaSky';

type Step = 'map' | 'card' | 'ask' | 'reveal' | 'result' | 'finale';

interface LastResult {
  gained: number;
  /** Equipos que suman (con la Alianza, también su pareja). */
  teams: string[];
  cleared: Region | null;
  /** Estado antes de puntuar: el mapa y el marcador animan lo nuevo. */
  before: ConquistaState;
  regionId: string;
  /** Equipos con Segunda oportunidad (otra pregunta de la misma región). */
  retryTeams: string[] | null;
  /** Tocaba Segunda oportunidad pero la región no tiene preguntas nuevas. */
  retryMissing: boolean;
}

/** Lo que dice Jiro al aparecer cada carta. */
const cardLine = (id: CardId, pair: string) => {
  switch (id) {
    case 'lluvia': return '¡Lluvia de estrellas! Esta ronda, cada acierto vale doble.';
    case 'alianza': return `¡Alianza estelar! ${pair} responden juntos.`;
    case 'viento': return '¡Viento solar! La Niebla retrocede en todo el cielo.';
    case 'segunda': return '¡Segunda oportunidad! Quien falle tendrá revancha.';
    default: return 'Con mi telescopio descartaré una opción incorrecta.';
  }
};

interface ConquistaResult extends Record<string, unknown> {
  regions: number;
  regionsCleared: number;
  rounds: number;
  totalStars: number;
  podium: { teamId: string; name: string; emblem: string; color: string; total: number; conquered: number }[];
}

const MAX_BANKS = 6;
const CORNERS = [
  { letter: 'A', className: 'border-rose-300 bg-rose-400/20' },
  { letter: 'B', className: 'border-sky-300 bg-sky-400/20' },
  { letter: 'C', className: 'border-emerald-300 bg-emerald-400/20' },
  { letter: 'D', className: 'border-amber-300 bg-amber-400/20' },
];

const chip = (on: boolean) =>
  `min-h-[48px] rounded-xl border px-4 text-lg font-bold transition-colors ${on ? 'border-amber-300 bg-amber-300 text-amber-950' : 'border-white/30 text-white hover:bg-white/10'}`;

/** Clanes de la clase con sus integrantes presentes. */
const clanTeams = (students: Student[], present: Set<string>): Team[] => {
  const byClan = new Map<string, Team>();
  for (const s of students) {
    if (!s.teamId || !s.clanName || !present.has(s.id)) continue;
    const team = byClan.get(s.teamId) ?? {
      id: s.teamId, name: s.clanName, emblem: CLAN_EMBLEMS[s.clanEmblem || 'shield'] || '🛡️', color: s.clanColor || '#6366f1', memberIds: [],
    };
    team.memberIds.push(s.id);
    byClan.set(s.teamId, team);
  }
  return [...byClan.values()];
};

/** Equipos rápidos: presentes repartidos al azar y de forma pareja. */
const quickTeams = (presentIds: string[], count: number): Team[] => {
  const teams = QUICK_TEAMS.slice(0, count).map((t, i) => ({ id: `q${i}`, ...t, memberIds: [] as string[] }));
  shuffle(presentIds).forEach((id, i) => teams[i % count].memberIds.push(id));
  return teams;
};

interface ConquistaActivityProps {
  classroom: Classroom & { students?: Student[] };
  resume?: ActivitySession<unknown, unknown> | null;
  /** Banco elegido desde el Banco de preguntas ("Usar en clase"). */
  initialBankId?: string | null;
  /** Parada «en clase» de una expedición desde la que se juega: la recompensa la marca. */
  expeditionStopId?: string | null;
  onExit: () => void;
}

/**
 * Conquista del Cielo: la Niebla cubre las regiones (una por banco o por dificultad). Todos los
 * equipos responden a la vez con tarjetas A–D; el docente toca los que acertaron. Meta común
 * (despejar el cielo) con algo de competencia: la región toma el color de quien más estrellas
 * puso y lo premia con +3. Cartas de Jiro solo positivas. Se guarda para seguir otro día.
 */
export const ConquistaActivity = ({ classroom, resume, initialBankId, expeditionStopId, onExit }: ConquistaActivityProps) => {
  const students = useMemo(() => classroom.students ?? [], [classroom.students]);
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const soundState = useStageSound();
  const { sound } = soundState;
  const game = useActivitySession<ConquistaState, ConquistaResult>(classroom.id, 'CONQUISTA', resume as ActivitySession<ConquistaState, ConquistaResult> | null | undefined, expeditionStopId);
  const saved = (resume?.status === 'ACTIVE' ? resume.state : null) as ConquistaState | null;
  const presence = useTodayPresence(classroom.id, students);

  const [phase, setPhase] = useState<'setup' | 'playing' | 'bitacora'>(resume?.status === 'FINISHED' ? 'bitacora' : saved ? 'playing' : 'setup');
  const [state, setState] = useState<ConquistaState | null>(saved);
  const [step, setStep] = useState<Step>(saved?.round ? saved.round.phase : 'map');
  const [marked, setMarked] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  // Estado antes de sacar la carta (el Viento solar se anima sobre el mapa).
  const [cardBefore, setCardBefore] = useState<ConquistaState | null>(null);
  // Regiones recién conquistadas que esperan su momento (en orden) y la espera del primero.
  const [conquests, setConquests] = useState<{ ids: string[]; delay: number } | null>(null);
  // «Jiro elige»: región iluminada mientras el foco salta.
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((id) => window.clearTimeout(id));
  }, []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  // ── Configuración ──
  const presentIds = useMemo(() => students.filter((s) => presence.presentIds.has(s.id)).map((s) => s.id), [students, presence.presentIds]);
  const clans = useMemo(() => clanTeams(students, presence.presentIds), [students, presence.presentIds]);
  const [teamMode, setTeamMode] = useState<'clanes' | 'rapidos'>(clans.length >= 2 ? 'clanes' : 'rapidos');
  const [quickCount, setQuickCount] = useState(4);
  const [quickSeed, setQuickSeed] = useState(0);
  const quick = useMemo(
    () => quickTeams(presentIds, quickCount),
    // quickSeed rehace el reparto a pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [presentIds, quickCount, quickSeed],
  );
  const teams = teamMode === 'clanes' && clans.length >= 2 ? clans : quick;
  const [selectedBanks, setSelectedBanks] = useState<string[]>(() => (!saved && initialBankId ? [initialBankId] : []));
  const { data: banks = [], isLoading: banksLoading } = useTeacherBanks(phase === 'setup');
  const usableBanks = banks.filter((b) => b.countsByType.SINGLE_CHOICE + b.countsByType.TRUE_FALSE > 0);

  // Preguntas: en la configuración, las de los bancos elegidos; en juego, las de los bancos de la partida.
  const loadBankIds = phase === 'setup' ? selectedBanks : state?.bankIds ?? [];
  const questionQueries = useQueries({
    queries: loadBankIds.map((bankId) => ({ queryKey: ['questions', bankId], queryFn: () => questionBankApi.getQuestions(bankId) })),
  });
  const questionsLoading = questionQueries.some((q) => q.isLoading);
  const knownQuestions = new Map<string, Question>();
  questionQueries.forEach((q) => (q.data ?? []).forEach((question) => knownQuestions.set(question.id, question)));

  const toggleBank = (id: string) => setSelectedBanks((list) => (
    list.includes(id) ? list.filter((b) => b !== id) : list.length >= MAX_BANKS ? list : [...list, id]
  ));

  const start = async () => {
    const chosen = usableBanks.filter((b) => selectedBanks.includes(b.id));
    const byBank = new Map<string, Question[]>();
    questionQueries.forEach((q, i) => byBank.set(loadBankIds[i], (q.data ?? []).filter(isPlayable)));
    const regions = buildRegions(chosen, byBank, teams.length);
    if (regions.length === 0) {
      toast.error('Esos bancos no tienen preguntas para jugar con tarjetas (V/F u opción única de 2 a 4 opciones).');
      return;
    }
    sound.unlock();
    const initial: ConquistaState = {
      teams, regions, roundNumber: 1, bonus: {}, card: null, sinceCard: 0, round: null, usedCards: [], bankIds: chosen.map((b) => b.id),
    };
    try {
      await game.start(initial, chosen.map((b) => b.name).join(' · ').slice(0, 120));
    } catch {
      toast.error('No se pudo empezar la partida. Revisa la conexión.');
      return;
    }
    setState(initial);
    setStep('map');
    setPhase('playing');
  };

  // ── Juego ──
  const commit = (next: ConquistaState) => {
    setState(next);
    game.save(next);
  };

  const round = state?.round ?? null;
  const question = round ? knownQuestions.get(round.questionId) ?? null : null;
  const answer = question ? answerOf(question) : null;
  const region = round ? state?.regions.find((r) => r.id === round.regionId) ?? null : null;
  const clearedCount = state?.regions.filter((r) => r.cleared).length ?? 0;
  const allCleared = !!state && clearedCount === state.regions.length;
  const retryTeams = round?.retried ? round.retryTeams ?? [] : null;

  /** Opciones de una pregunta (el Telescopio necesita 3 o más para descartar una). */
  const optionCount = (questionId: string) => {
    const q = knownQuestions.get(questionId);
    return q ? answerOf(q)?.options.length ?? 0 : 0;
  };
  const hasTelescopeQuestion = (r: Region) => freshQuestions(r).some((id) => optionCount(id) >= 3);

  const pickRegion = (regionId: string) => {
    if (!state) return;
    const telescope = state.card?.id === 'telescopio';
    let next = startRound(state, regionId, telescope ? (id) => optionCount(id) >= 3 : undefined);
    // Telescopio: Jiro descarta una opción incorrecta (si la pregunta es V/F, la carta se guarda).
    const q = next.round ? knownQuestions.get(next.round.questionId) : null;
    const a = q ? answerOf(q) : null;
    if (telescope && a && a.options.length >= 3 && next.round) {
      const wrong = a.options.map((_, i) => i).filter((i) => i !== a.index);
      next = { ...next, round: { ...next.round, hiddenOption: shuffle(wrong)[0] } };
    }
    sound.tick();
    setMarked([]);
    setLastResult(null);
    setCardBefore(null);
    commit(next);
    setStep('ask');
  };

  /** Jiro elige: la región sin despejar con menos luz (con Telescopio, una que tenga preguntas de 3+ opciones). */
  const autoPick = () => {
    if (!state || spotlight) return;
    const open = state.regions.filter((r) => !r.cleared);
    if (open.length === 0) return;
    const telescope = state.card?.id === 'telescopio';
    const target = [...open].sort((a, b) => (telescope ? Number(hasTelescopeQuestion(b)) - Number(hasTelescopeQuestion(a)) : 0)
      || regionTotal(a) / a.goal - regionTotal(b) / b.goal)[0];
    if (reduce || open.length === 1) {
      pickRegion(target.id);
      return;
    }
    // Jiro «piensa»: el foco salta entre las regiones abiertas y se posa en la elegida.
    const hops: string[] = [];
    let k = Math.floor(Math.random() * open.length);
    for (let i = 0; i < 7; i += 1) {
      hops.push(open[k].id);
      k = (k + 1 + Math.floor(Math.random() * (open.length - 1))) % open.length;
    }
    if (hops[hops.length - 1] === target.id) hops.pop();
    hops.push(target.id);
    hops.forEach((id, i) => later(() => { setSpotlight(id); sound.tick(); }, i * 160));
    later(() => { setSpotlight(null); pickRegion(target.id); }, hops.length * 160 + 500);
  };

  const reveal = () => {
    if (!state?.round) return;
    sound.tick();
    commit({ ...state, round: { ...state.round, phase: 'reveal' } });
    setStep('reveal');
  };

  const confirm = () => {
    if (!state?.round) return;
    const current = state.round;
    const scoring = retryTeams ? marked.filter((id) => retryTeams.includes(id)) : marked;
    // Segunda oportunidad: los que fallaron responden otra pregunta de la misma región.
    const failing = state.card?.id === 'segunda' && !current.retried
      ? state.teams.map((t) => t.id).filter((id) => !scoring.includes(id))
      : [];
    const { state: scored, cleared, gained } = scoreRound(state, scoring);
    const retry = failing.length > 0 ? startSecondChance(scored, current.regionId, failing) : null;
    const pair = state.card?.id === 'alianza' ? state.card.pair : undefined;
    const lit = pair && (scoring.includes(pair[0]) || scoring.includes(pair[1])) ? [...new Set([...scoring, ...pair])] : scoring;
    if (gained > 0) sound.star(Math.min(7, gained));
    else sound.soft();
    setLastResult({
      gained, teams: lit, cleared, before: state, regionId: current.regionId,
      retryTeams: retry ? failing : null, retryMissing: failing.length > 0 && !retry,
    });
    if (cleared) setConquests({ ids: [cleared.id], delay: reduce ? 0 : 1300 });
    commit(retry ?? scored);
    setStep('result');
  };

  /** Termina el momento de conquista en pantalla (Espacio o al acabar): pasa al siguiente si hay. */
  const skipConquest = () => setConquests((c) => (c && c.ids.length > 1 ? { ids: c.ids.slice(1), delay: 0 } : null));

  const finish = async (final: ConquistaState) => {
    const board = podium(final);
    const result: ConquistaResult = {
      regions: final.regions.length,
      regionsCleared: final.regions.filter((r) => r.cleared).length,
      rounds: final.roundNumber - 1,
      totalStars: board.reduce((sum, p) => sum + p.total, 0),
      podium: board.map((p) => ({ teamId: p.team.id, name: p.team.name, emblem: p.team.emblem, color: p.team.color, total: p.total, conquered: p.conquered })),
    };
    try {
      await game.finish(result, final);
      sound.success();
      setPhase('bitacora');
    } catch {
      toast.error('No se pudo guardar la partida. Inténtalo de nuevo.');
    }
  };

  const nextAfterResult = () => {
    if (!state) return;
    if (state.round) {
      // Segunda oportunidad pendiente: otra pregunta de la misma región.
      sound.tick();
      setMarked([]);
      setStep('ask');
      return;
    }
    if (allCleared) {
      setStep('finale');
      return;
    }
    if (state.sinceCard >= CARD_EVERY) {
      const next = drawCard(state, { telescope: state.regions.some((r) => !r.cleared && hasTelescopeQuestion(r)) });
      setCardBefore(state);
      commit(next);
      setStep('card');
      sound.chime();
      if (next.card?.id === 'lluvia') starRain();
      if (next.card?.id === 'viento') {
        [0, 200, 420].forEach((ms) => later(() => sound.whoosh(), ms));
        // El viento puede despejar regiones: su conquista se celebra cuando pasan las ráfagas.
        const windCleared = next.regions.filter((r) => r.cleared && !state.regions.find((b) => b.id === r.id)?.cleared).map((r) => r.id);
        if (windCleared.length > 0) setConquests({ ids: windCleared, delay: reduce ? 0 : 1900 });
      }
      return;
    }
    setStep('map');
  };

  const afterCard = () => {
    setCardBefore(null);
    setStep(allCleared ? 'finale' : 'map');
  };

  const toggleMarked = (teamId: string) => setMarked((list) => (list.includes(teamId) ? list.filter((t) => t !== teamId) : [...list, teamId]));

  const onKey = (e: KeyboardEvent) => {
    if (phase !== 'playing' || step !== 'reveal' || !state) return false;
    const n = Number(e.key);
    if (n >= 1 && n <= state.teams.length) {
      const team = state.teams[n - 1];
      // En la Segunda oportunidad solo se marcan los equipos que tenían revancha.
      if (!retryTeams || retryTeams.includes(team.id)) toggleMarked(team.id);
      return true;
    }
    return false;
  };

  // ── Jiro, acción principal y estado de la barra ──
  const teamNames = (ids: string[], separator = ', ') =>
    ids.map((id) => state?.teams.find((t) => t.id === id)).map((t) => t && `${t.emblem} ${t.name}`).filter(Boolean).join(separator);
  const letterOf = (i: number) => (question?.type === 'TRUE_FALSE' ? (i === 0 ? 'V' : 'F') : CORNERS[i]?.letter ?? '');
  const conquestRegion = conquests ? state?.regions.find((r) => r.id === conquests.ids[0]) ?? null : null;
  const jiro: { pose: JiroPose; line: string | null } = (() => {
    if (phase === 'setup') return { pose: 'senalando', line: 'La Niebla cubre el cielo. ¡Despejémoslo entre todos!' };
    if (phase === 'bitacora') return { pose: 'celebrando', line: `¡Despejamos ${game.session?.result?.regionsCleared ?? clearedCount} regiones!` };
    if (conquestRegion) {
      const c = regionConstellation(regionIndex(conquestRegion));
      return { pose: 'celebrando', line: `${c.name}: ${c.fact}` };
    }
    if (spotlight) return { pose: 'senalando', line: 'Mmm… ¿cuál elijo?' };
    switch (step) {
      case 'card': return { pose: 'emocionado', line: state?.card ? cardLine(state.card.id, teamNames(state.card.pair ?? [], ' y ')) : null };
      case 'ask': return retryTeams
        ? { pose: 'emocionado', line: '¡Segunda oportunidad! Conversen y respondan.' }
        : { pose: 'emocionado', line: '¡Cada equipo levanta su tarjeta!' };
      case 'reveal': return { pose: 'senalando', line: answer ? `¡Era ${letterOf(answer.index)}!` : null };
      case 'result':
        if (lastResult?.retryTeams) return { pose: 'emocionado', line: '¡Segunda oportunidad para quienes fallaron!' };
        if (lastResult?.cleared) return { pose: 'celebrando', line: '¡Región despejada!' };
        return lastResult && lastResult.gained > 0 ? { pose: 'celebrando', line: '¡Más luz en el cielo!' } : { pose: 'confundido', line: 'La Niebla resiste… ¡a la próxima!' };
      case 'finale': return { pose: 'celebrando', line: '¡Cielo despejado! Lo logramos entre todos.' };
      default: return { pose: 'senalando', line: allCleared ? '¡Cielo despejado!' : 'Elige una región. Con Espacio, elijo yo.' };
    }
  })();

  const primary = (() => {
    if (phase === 'setup') {
      return { label: 'Empezar', onClick: () => void start(), disabled: teams.length < 2 || selectedBanks.length === 0 || questionsLoading };
    }
    if (phase !== 'playing') return null;
    if (conquests) return { label: 'Seguir', onClick: skipConquest };
    switch (step) {
      case 'map': return allCleared
        ? { label: '¡Cielo despejado!', onClick: () => setStep('finale') }
        : { label: 'Jiro elige', onClick: autoPick, disabled: !!spotlight };
      case 'card': return { label: 'Seguir', onClick: afterCard };
      case 'ask': return { label: 'Revelar', onClick: reveal, disabled: !question };
      case 'reveal': return { label: `Confirmar (${marked.length})`, onClick: confirm };
      case 'finale': return { label: 'Ver la Bitácora', onClick: () => state && void finish(state) };
      default: return { label: state?.round ? 'Segunda oportunidad' : allCleared ? '¡Cielo despejado!' : 'Seguir', onClick: nextAfterResult };
    }
  })();

  const result = game.session?.result;

  return (
    <EscenarioObservatorio
      label="Conquista del Cielo"
      onClose={() => { if (state && phase === 'playing') game.save(state); onExit(); }}
      jiro={{ ...jiro, placement: 'corner' }}
      primary={primary}
      onKey={onKey}
      soundState={soundState}
      status={phase === 'playing' && state ? `Ronda ${state.roundNumber} · ${clearedCount}/${state.regions.length} regiones` : undefined}
      barExtra={phase === 'playing' && state ? <StageEndButton onEnd={() => void finish(state)} /> : undefined}
    >
      {phase === 'setup' && (
        <div className="flex w-full max-w-5xl flex-col gap-5">
          <h1 className="stage-title text-center font-black">Conquista del Cielo</h1>

          <fieldset>
            <legend className="mb-2 text-lg font-bold text-indigo-100">Equipos ({presentIds.length} presentes)</legend>
            <div className="flex flex-wrap items-center gap-2">
              {clans.length >= 2 && (
                <button type="button" onClick={() => setTeamMode('clanes')} aria-pressed={teamMode === 'clanes'} className={chip(teamMode === 'clanes')}>
                  Clanes de la clase ({clans.length})
                </button>
              )}
              <button type="button" onClick={() => setTeamMode('rapidos')} aria-pressed={teamMode === 'rapidos' || clans.length < 2} className={chip(teamMode === 'rapidos' || clans.length < 2)}>
                <Shuffle size={18} className="mr-1 inline" aria-hidden="true" /> Equipos rápidos
              </button>
              {(teamMode === 'rapidos' || clans.length < 2) && (
                <>
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button key={n} type="button" onClick={() => setQuickCount(n)} aria-pressed={quickCount === n} className={chip(quickCount === n)} aria-label={`${n} equipos`}>
                      {n}
                    </button>
                  ))}
                  <button type="button" onClick={() => setQuickSeed((v) => v + 1)} className={`${stageControlClass} border border-white/25`}>
                    <RefreshCw size={16} aria-hidden="true" /> Rehacer
                  </button>
                </>
              )}
            </div>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Equipos de la partida">
              {teams.map((team) => (
                <li key={team.id} className="rounded-2xl border-2 p-3" style={{ borderColor: team.color, backgroundColor: `${team.color}1f` }}>
                  <p className="flex items-center gap-2 text-lg font-black text-white">
                    <span className="text-2xl" aria-hidden="true">{team.emblem}</span> {team.name}
                    <span className="ml-auto text-sm font-semibold text-indigo-100">{team.memberIds.length}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-sm text-indigo-50">
                    {team.memberIds.map((id) => {
                      const s = studentById.get(id);
                      if (!s) return null;
                      return (
                        <span key={id} className="inline-flex items-center gap-1">
                          {studentNames(s, classroom.showCharacterName).primary}
                          {s.hp <= 0 && <Moon size={12} aria-label="Descansando" />}
                        </span>
                      );
                    })}
                  </p>
                </li>
              ))}
            </ul>
            {teams.length < 2 && <p className="mt-2 text-base text-amber-100">Se necesitan al menos 2 equipos con alumnos presentes.</p>}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-lg font-bold text-indigo-100">Regiones del cielo: elige hasta {MAX_BANKS} bancos</legend>
            {banksLoading ? (
              <p className="text-indigo-100" role="status">Cargando bancos…</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {usableBanks.map((bank) => {
                  const on = selectedBanks.includes(bank.id);
                  return (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => toggleBank(bank.id)}
                      aria-pressed={on}
                      className={`flex min-h-[56px] items-center gap-3 rounded-2xl border-2 px-4 py-2 text-left ${on ? 'border-amber-300 bg-amber-300/15' : 'border-white/15 hover:bg-white/5'}`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${on ? 'border-amber-300 bg-amber-300 text-amber-950' : 'border-white/40'}`} aria-hidden="true">
                        {on && <Check size={16} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-lg font-bold text-white">{bank.name}</span>
                        <span className="block text-sm font-semibold text-indigo-200">
                          {bank.classroomName} · {bank.countsByType.SINGLE_CHOICE + bank.countsByType.TRUE_FALSE} para tarjetas
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-sm text-indigo-100">Con un solo banco, las regiones se forman por dificultad.</p>
          </fieldset>

          <UnreviewedNotice banks={banks.filter((b) => selectedBanks.includes(b.id))} classroomId={classroom.id} />

          <AiQuestionGenerator
            classroomId={classroom.id}
            kind="SINGLE_CHOICE"
            onCreated={({ bankId }) => setSelectedBanks((list) => (list.includes(bankId) || list.length >= MAX_BANKS ? list : [...list, bankId]))}
          />
        </div>
      )}

      {phase === 'playing' && state && (
        <div className="flex w-full max-w-6xl flex-col items-center gap-4">
          {step !== 'finale' && (
            <TeamScoreboard
              state={state}
              highlight={step === 'result' ? lastResult?.teams ?? [] : []}
              before={step === 'result' ? lastResult?.before ?? null : step === 'card' ? cardBefore : null}
              alliance={state.card?.id === 'alianza' && state.card.pair && (step === 'card' || step === 'ask' || step === 'reveal') ? state.card.pair : null}
            />
          )}

          {step === 'card' && state.card && <CardPanel card={state.card} state={state} />}

          {(step === 'map' || step === 'result' || step === 'card') && (
            <SkyMap
              state={state}
              onPick={step === 'map' && !allCleared && !spotlight ? pickRegion : undefined}
              activeRegionId={step === 'result' ? lastResult?.cleared?.id ?? null : null}
              before={step === 'result' ? lastResult?.before ?? null : step === 'card' ? cardBefore : null}
              wind={step === 'card' && state.card?.id === 'viento'}
              thickenRegionId={step === 'result' && lastResult && lastResult.gained === 0 ? lastResult.regionId : null}
              spotlightId={spotlight}
            />
          )}

          {step === 'result' && lastResult && (
            <div className="w-full max-w-4xl rounded-3xl border-2 border-amber-300/50 bg-amber-300/10 p-4 text-center" role="status">
              {lastResult.gained > 0 ? (
                <p className="stage-body font-black text-amber-100">+{lastResult.gained} ⭐ {teamNames(lastResult.teams)}</p>
              ) : (
                <p className="stage-body font-bold text-white">Nadie acertó esta vez. La Niebla espera.</p>
              )}
              {lastResult.cleared && (
                <p className="stage-body mt-1 font-black text-white">
                  ✨ ¡{lastResult.cleared.name} despejada!
                  {lastResult.cleared.conquerors.length > 0 && ` Conquista: ${lastResult.cleared.conquerors.map((id) => state.teams.find((t) => t.id === id)?.name).join(' y ')} (+3)`}
                </p>
              )}
              {lastResult.retryTeams && (
                <p className="stage-body mt-1 font-black text-white">🔁 Segunda oportunidad para {teamNames(lastResult.retryTeams)}</p>
              )}
              {lastResult.retryMissing && (
                <p className="stage-body mt-1 text-indigo-100">Esta región ya no tiene preguntas nuevas para la Segunda oportunidad.</p>
              )}
            </div>
          )}

          {(step === 'ask' || step === 'reveal') && region && (
            <>
              <p className="flex flex-wrap items-center justify-center gap-x-3 text-center text-[clamp(18px,2.8vh,32px)] font-bold text-indigo-100">
                <RegionMiniSky region={region} />
                <span>
                  {region.name} · {retryTeams
                    ? `🔁 Segunda oportunidad: ${teamNames(retryTeams)}`
                    : state.card ? `${CARDS[state.card.id].icon} ${CARDS[state.card.id].title}` : region.subtitle}
                </span>
              </p>
              {state.card?.id === 'telescopio' && round && round.hiddenOption === undefined && (
                <p className="text-[clamp(16px,2.4vh,26px)] text-indigo-100">🔭 Esta pregunta tiene dos opciones: el telescopio se guarda para la próxima.</p>
              )}
              {question && answer ? (
                <>
                  <p className={`${questionSizeClass(question.questionText)} max-w-5xl text-center font-black text-white`}>{question.questionText}</p>
                  <div className={`grid w-full max-w-5xl gap-3 ${answer.options.length > 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}>
                    {answer.options.map((text, i) => {
                      const hidden = round?.hiddenOption === i;
                      const isAnswer = step === 'reveal' && answer.index === i;
                      const dim = step === 'reveal' && answer.index !== i;
                      return (
                        <div key={i} className={`relative flex min-h-[11vh] items-center gap-4 rounded-3xl border-4 px-5 py-3 transition-opacity ${CORNERS[i].className} ${dim ? 'opacity-60' : ''} ${hidden ? 'cq-dim-late' : ''} ${isAnswer ? 'ring-4 ring-amber-300' : ''}`}>
                          <span className="stage-option font-black text-white">{letterOf(i)}</span>
                          <span className="stage-body relative font-bold text-white">
                            {text}
                            {hidden && <span className="cq-strike pointer-events-none absolute -left-1 -right-1 top-1/2 -mt-[3px] h-[6px] rounded-full bg-white" aria-hidden="true" />}
                          </span>
                          {hidden && <span className="cq-lens-in absolute -top-4 right-4 rounded-full border-2 border-indigo-200/60 bg-[#0b1026] px-3 py-0.5 text-[clamp(14px,2.2vh,24px)] font-bold text-indigo-50">🔭 descartada</span>}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="stage-body text-indigo-100" role="status">Cargando pregunta…</p>
              )}

              {step === 'reveal' && answer && (
                <>
                  {question?.explanation && (
                    <p className="stage-body w-full max-w-5xl rounded-2xl border border-amber-300/40 bg-amber-300/10 px-5 py-3 text-center text-white">{question.explanation}</p>
                  )}
                  <fieldset className="w-full max-w-5xl">
                    <legend className="mb-2 w-full text-center text-xl font-bold text-indigo-100">
                      {retryTeams ? '¿Quiénes acertaron la Segunda oportunidad?' : '¿Qué equipos acertaron?'} (teclas 1–{state.teams.length})
                    </legend>
                    <div className="flex flex-wrap justify-center gap-2">
                      {state.teams.map((team, i) => {
                        const on = marked.includes(team.id);
                        const allowed = !retryTeams || retryTeams.includes(team.id);
                        return (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => toggleMarked(team.id)}
                            aria-pressed={on}
                            disabled={!allowed}
                            className="inline-flex min-h-[56px] items-center gap-2 rounded-2xl border-4 px-4 text-xl font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                            style={{ borderColor: team.color, backgroundColor: on ? `${team.color}aa` : `${team.color}1f` }}
                          >
                            <span className="text-sm font-bold opacity-80">{i + 1}</span>
                            <span aria-hidden="true">{team.emblem}</span> {team.name}
                            {on && <Check size={22} strokeWidth={3} aria-hidden="true" />}
                            {!allowed && <span className="text-sm font-bold">ya acertó</span>}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                </>
              )}
            </>
          )}

          {step === 'finale' && <ConquistaFinale state={state} sound={sound} />}

          {conquestRegion && (
            <ConquestMoment
              key={conquestRegion.id}
              region={conquestRegion}
              teams={state.teams}
              sound={sound}
              delay={conquests?.delay ?? 0}
              onDone={skipConquest}
            />
          )}
        </div>
      )}

      {phase === 'bitacora' && game.session && (
        <Bitacora
          session={game.session}
          activityName="Conquista del Cielo"
          classroomId={classroom.id}
          students={students}
          showCharacterName={classroom.showCharacterName}
          achievements={[
            { icon: '☁️', label: 'regiones despejadas', value: `${result?.regionsCleared ?? 0}/${result?.regions ?? 0}` },
            { icon: '⭐', label: 'estrellas de la clase', value: String(result?.totalStars ?? 0) },
            { icon: '🔁', label: 'rondas jugadas', value: String(result?.rounds ?? 0) },
          ]}
          podium={(result?.podium ?? []).map((p) => ({ key: p.teamId, name: p.name, emblem: p.emblem, color: p.color, score: p.total, unit: 'estrellas' }))}
          suggestedXp={20}
          onSessionChange={(s) => game.setSession(s as ActivitySession<ConquistaState, ConquistaResult>)}
          onPlayAgain={() => {
            game.setSession(null); setState(null); setLastResult(null); setCardBefore(null); setConquests(null); setSpotlight(null);
            setStep('map'); setPhase('setup');
          }}
          onExit={onExit}
        />
      )}
    </EscenarioObservatorio>
  );
};
