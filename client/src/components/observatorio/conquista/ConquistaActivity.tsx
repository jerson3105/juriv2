import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
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
import { SkyMap, TeamScoreboard } from './ConquistaBoard';
import {
  CARD_EVERY, CARDS, QUICK_TEAMS, buildRegions, drawCard, isPlayable, podium, regionTotal, scoreRound, startRound,
  type ConquistaState, type Region, type Team,
} from './conquistaLogic';

type Step = 'map' | 'card' | 'ask' | 'reveal' | 'result';

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
  onExit: () => void;
}

/**
 * Conquista del Cielo: la Niebla cubre las regiones (una por banco o por dificultad). Todos los
 * equipos responden a la vez con tarjetas A–D; el docente toca los que acertaron. Meta común
 * (despejar el cielo) con algo de competencia: la región toma el color de quien más estrellas
 * puso y lo premia con +3. Cartas de Jiro solo positivas. Se guarda para seguir otro día.
 */
export const ConquistaActivity = ({ classroom, resume, initialBankId, onExit }: ConquistaActivityProps) => {
  const students = useMemo(() => classroom.students ?? [], [classroom.students]);
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const soundState = useStageSound();
  const { sound } = soundState;
  const game = useActivitySession<ConquistaState, ConquistaResult>(classroom.id, 'CONQUISTA', resume as ActivitySession<ConquistaState, ConquistaResult> | null | undefined);
  const saved = (resume?.status === 'ACTIVE' ? resume.state : null) as ConquistaState | null;
  const presence = useTodayPresence(classroom.id, students);

  const [phase, setPhase] = useState<'setup' | 'playing' | 'bitacora'>(resume?.status === 'FINISHED' ? 'bitacora' : saved ? 'playing' : 'setup');
  const [state, setState] = useState<ConquistaState | null>(saved);
  const [step, setStep] = useState<Step>(saved?.round ? saved.round.phase : 'map');
  const [marked, setMarked] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<{ gained: number; teams: string[]; cleared: Region | null } | null>(null);

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

  const pickRegion = (regionId: string) => {
    if (!state) return;
    let next = startRound(state, regionId);
    // Telescopio: Jiro descarta una opción incorrecta.
    const q = next.round ? knownQuestions.get(next.round.questionId) : null;
    const a = q ? answerOf(q) : null;
    if (next.card?.id === 'telescopio' && a && a.options.length >= 3 && next.round) {
      const wrong = a.options.map((_, i) => i).filter((i) => i !== a.index);
      next = { ...next, round: { ...next.round, hiddenOption: shuffle(wrong)[0] } };
    }
    sound.tick();
    setMarked([]);
    commit(next);
    setStep('ask');
  };

  /** Jiro elige: la región sin despejar con menos luz. */
  const autoPick = () => {
    if (!state) return;
    const open = state.regions.filter((r) => !r.cleared);
    if (open.length === 0) return;
    const target = [...open].sort((a, b) => regionTotal(a) / a.goal - regionTotal(b) / b.goal)[0];
    pickRegion(target.id);
  };

  const reveal = () => {
    if (!state?.round) return;
    sound.tick();
    commit({ ...state, round: { ...state.round, phase: 'reveal' } });
    setStep('reveal');
  };

  const confirm = () => {
    if (!state) return;
    const { state: next, cleared, gained } = scoreRound(state, marked);
    if (gained > 0) sound.star(Math.min(7, gained));
    else sound.soft();
    if (cleared) window.setTimeout(() => sound.success(), 300);
    setLastResult({ gained, teams: marked, cleared });
    commit(next);
    setStep('result');
  };

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
    if (allCleared) {
      void finish(state);
      return;
    }
    if (state.sinceCard >= CARD_EVERY) {
      commit(drawCard(state));
      setStep('card');
      return;
    }
    setStep('map');
  };

  const toggleMarked = (teamId: string) => setMarked((list) => (list.includes(teamId) ? list.filter((t) => t !== teamId) : [...list, teamId]));

  const onKey = (e: KeyboardEvent) => {
    if (phase !== 'playing' || step !== 'reveal' || !state) return false;
    const n = Number(e.key);
    if (n >= 1 && n <= state.teams.length) {
      toggleMarked(state.teams[n - 1].id);
      return true;
    }
    return false;
  };

  // ── Jiro, acción principal y estado de la barra ──
  const card = state?.card ? CARDS[state.card.id] : null;
  const letterOf = (i: number) => (question?.type === 'TRUE_FALSE' ? (i === 0 ? 'V' : 'F') : CORNERS[i]?.letter ?? '');
  const jiro: { pose: JiroPose; line: string | null } = (() => {
    if (phase === 'setup') return { pose: 'senalando', line: 'La Niebla cubre el cielo. ¡Despejémoslo entre todos!' };
    if (phase === 'bitacora') return { pose: 'celebrando', line: `¡Despejamos ${game.session?.result?.regionsCleared ?? clearedCount} regiones!` };
    switch (step) {
      case 'card': return { pose: 'emocionado', line: card ? `${card.icon} ${card.title}` : null };
      case 'ask': return { pose: 'emocionado', line: '¡Cada equipo levanta su tarjeta!' };
      case 'reveal': return { pose: 'senalando', line: answer ? `¡Era ${letterOf(answer.index)}!` : null };
      case 'result':
        if (lastResult?.cleared) return { pose: 'celebrando', line: '¡Región despejada!' };
        return lastResult && lastResult.gained > 0 ? { pose: 'celebrando', line: '¡Más luz en el cielo!' } : { pose: 'confundido', line: 'La Niebla resiste… ¡a la próxima!' };
      default: return { pose: 'senalando', line: allCleared ? '¡Cielo despejado!' : 'Elige una región. Con Espacio, elijo yo.' };
    }
  })();

  const primary = (() => {
    if (phase === 'setup') {
      return { label: 'Empezar', onClick: () => void start(), disabled: teams.length < 2 || selectedBanks.length === 0 || questionsLoading };
    }
    if (phase !== 'playing') return null;
    switch (step) {
      case 'map': return allCleared ? { label: 'Ver la Bitácora', onClick: () => state && void finish(state) } : { label: 'Jiro elige', onClick: autoPick };
      case 'card': return { label: 'Seguir', onClick: () => setStep('map') };
      case 'ask': return { label: 'Revelar', onClick: reveal, disabled: !question };
      case 'reveal': return { label: `Confirmar (${marked.length})`, onClick: confirm };
      default: return { label: allCleared ? 'Ver la Bitácora' : 'Seguir', onClick: nextAfterResult };
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
          <TeamScoreboard state={state} highlight={step === 'result' ? lastResult?.teams ?? [] : []} />

          {(step === 'map' || step === 'result' || step === 'card') && (
            <SkyMap state={state} onPick={step === 'map' && !allCleared ? pickRegion : undefined} activeRegionId={lastResult?.cleared?.id ?? null} />
          )}

          {step === 'card' && card && (
            <div className="w-full max-w-3xl rounded-3xl border-2 border-amber-300 bg-amber-300/15 p-5 text-center" role="status">
              <p className="stage-display" aria-hidden="true">{card.icon}</p>
              <p className="stage-title font-black text-amber-100">{card.title}</p>
              <p className="stage-body mt-1 text-white">{card.text}</p>
              {state.card?.pair && (
                <p className="stage-body mt-2 font-bold text-white">
                  {state.card.pair.map((id) => state.teams.find((t) => t.id === id)).map((t) => t && `${t.emblem} ${t.name}`).join(' + ')}
                </p>
              )}
            </div>
          )}

          {step === 'result' && lastResult && (
            <div className="w-full max-w-4xl rounded-3xl border-2 border-amber-300/50 bg-amber-300/10 p-4 text-center" role="status">
              {lastResult.gained > 0 ? (
                <p className="stage-body font-black text-amber-100">
                  +{lastResult.gained} ⭐ {lastResult.teams.map((id) => state.teams.find((t) => t.id === id)).map((t) => t && `${t.emblem} ${t.name}`).join(', ')}
                </p>
              ) : (
                <p className="stage-body font-bold text-white">Nadie acertó esta vez. La Niebla espera.</p>
              )}
              {lastResult.cleared && (
                <p className="stage-body mt-1 font-black text-white">
                  ✨ ¡{lastResult.cleared.name} despejada!
                  {lastResult.cleared.conquerors.length > 0 && ` Conquista: ${lastResult.cleared.conquerors.map((id) => state.teams.find((t) => t.id === id)?.name).join(' y ')} (+3)`}
                </p>
              )}
            </div>
          )}

          {(step === 'ask' || step === 'reveal') && region && (
            <>
              <p className="text-[clamp(18px,2.8vh,32px)] font-bold text-indigo-100">
                {region.name} · {state.card ? `${CARDS[state.card.id].icon} ${CARDS[state.card.id].title}` : region.subtitle}
              </p>
              {question && answer ? (
                <>
                  <p className={`${questionSizeClass(question.questionText)} max-w-5xl text-center font-black text-white`}>{question.questionText}</p>
                  <div className={`grid w-full max-w-5xl gap-3 ${answer.options.length > 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}>
                    {answer.options.map((text, i) => {
                      const hidden = round?.hiddenOption === i;
                      const isAnswer = step === 'reveal' && answer.index === i;
                      const dim = (step === 'reveal' && answer.index !== i) || hidden;
                      return (
                        <div key={i} className={`flex min-h-[11vh] items-center gap-4 rounded-3xl border-4 px-5 py-3 transition-opacity ${CORNERS[i].className} ${dim ? 'opacity-60' : ''} ${isAnswer ? 'ring-4 ring-amber-300' : ''}`}>
                          <span className="stage-option font-black text-white">{letterOf(i)}</span>
                          <span className={`stage-body font-bold text-white ${hidden ? 'line-through' : ''}`}>{text}</span>
                          {hidden && <span className="ml-auto text-base font-bold text-indigo-100">🔭 descartada</span>}
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
                      ¿Qué equipos acertaron? (teclas 1–{state.teams.length})
                    </legend>
                    <div className="flex flex-wrap justify-center gap-2">
                      {state.teams.map((team, i) => {
                        const on = marked.includes(team.id);
                        return (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => toggleMarked(team.id)}
                            aria-pressed={on}
                            className="inline-flex min-h-[56px] items-center gap-2 rounded-2xl border-4 px-4 text-xl font-black text-white"
                            style={{ borderColor: team.color, backgroundColor: on ? `${team.color}aa` : `${team.color}1f` }}
                          >
                            <span className="text-sm font-bold opacity-80">{i + 1}</span>
                            <span aria-hidden="true">{team.emblem}</span> {team.name}
                            {on && <Check size={22} strokeWidth={3} aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                </>
              )}
            </>
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
          onPlayAgain={() => { game.setSession(null); setState(null); setLastResult(null); setStep('map'); setPhase('setup'); }}
          onExit={onExit}
        />
      )}
    </EscenarioObservatorio>
  );
};
