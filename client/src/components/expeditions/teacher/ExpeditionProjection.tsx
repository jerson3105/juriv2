import { Suspense, lazy, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Check, ExternalLink, Eye, EyeOff, Map as MapIcon, X } from 'lucide-react';
import { activityApi, type ActivitySession } from '../../../lib/activityApi';
import type { Classroom, Student } from '../../../lib/classroomApi';
import { assetUrl, expeditionApi, expeditionKeys, type StopKind, type TeacherExpedition, type TeacherStop } from '../../../lib/expeditionApi';
import { GENIALLY_SANDBOX, isGeniallyEmbed } from '../../../lib/geniallyEmbed';
import { questionBankApi } from '../../../lib/questionBankApi';
import { errorMessage } from '../../auth/authHelpers';
import { Bitacora, type BitacoraAchievement } from '../../observatorio/Bitacora';
import { EscenarioObservatorio, stageControlClass } from '../../observatorio/EscenarioObservatorio';
import type { JiroPose } from '../../observatorio/jiroPoses';
import { PresenceEditor } from '../../observatorio/presence';
import { answerOf, questionSizeClass } from '../../observatorio/questionHelpers';
import { StageEndButton } from '../../observatorio/StageEndButton';
import { useTodayPresence } from '../../observatorio/usePresence';
import { ExpeditionStage } from '../ExpeditionStage';
import { CLASS_ACTIVITY_INFO, KIND_INFO, isImageFile, plural, resourceLabel } from '../expeditionHelpers';

const EstrellasActivity = lazy(() => import('../../observatorio/estrellas/EstrellasActivity').then((m) => ({ default: m.EstrellasActivity })));
const ConquistaActivity = lazy(() => import('../../observatorio/conquista/ConquistaActivity').then((m) => ({ default: m.ConquistaActivity })));
const ErrorActivity = lazy(() => import('../../observatorio/error/ErrorActivity').then((m) => ({ default: m.ErrorActivity })));

type ClassroomWithStudents = Classroom & { students?: Student[] };
type View =
  | { kind: 'map' }
  | { kind: 'stop'; stopId: string }
  | { kind: 'mark'; stopId: string }
  | { kind: 'activity'; stopId: string }
  | { kind: 'bitacora'; session: ActivitySession<unknown, unknown> };
/** Reto proyectado: pregunta actual, si ya se reveló y si la mayoría acertó en cada una (para la Bitácora). */
interface Quiz { stopId: string; index: number; revealed: boolean; marks: (boolean | null)[] }

const KIND_POSE: Record<StopKind, JiroPose> = { STORY: 'senalando', CHALLENGE: 'emocionado', EVIDENCE: 'senalando', CLASS: 'emocionado' };
const MARK_NOTE: Record<StopKind, string> = {
  STORY: 'Quedan con el relato leído y reciben su recompensa (si tiene).',
  CHALLENGE: 'Lo jugado en clase no da nota individual: quien ya lo hizo desde su cuenta conserva su %.',
  EVIDENCE: 'Quedan con la evidencia aprobada. Lo que subieron desde su cuenta se revisa en «Por revisar».',
  CLASS: 'Cada uno recibe la recompensa de la parada.',
};
const choiceClass = (on: boolean, tone: 'yes' | 'no') =>
  `inline-flex min-h-[52px] items-center gap-2 rounded-2xl border-2 px-5 text-lg font-black ${on
    ? tone === 'yes' ? 'border-emerald-300 bg-emerald-400/25 text-white' : 'border-rose-300 bg-rose-400/25 text-white'
    : 'border-white/30 text-white hover:bg-white/10'}`;

/** Recursos del relato en grande: imágenes, Genially incrustado (con sandbox) y el resto como enlaces. */
const StageResources = ({ stop }: { stop: TeacherStop }) => {
  if (stop.resources.length === 0) return null;
  return (
    <div className="flex w-full flex-col items-center gap-4">
      {stop.resources.map((resource) => {
        if (resource.kind === 'FILE' && isImageFile(resource.url)) {
          return <img key={resource.url} src={assetUrl(resource.url)} alt={resource.name ?? ''} className="max-h-[42vh] max-w-full rounded-2xl object-contain" />;
        }
        if (resource.kind === 'LINK' && isGeniallyEmbed(resource.url)) {
          return <iframe key={resource.url} src={resource.url} title={resourceLabel(resource)} sandbox={GENIALLY_SANDBOX} allowFullScreen className="aspect-video w-full max-w-5xl rounded-2xl border-0" />;
        }
        return (
          <a key={resource.url} href={assetUrl(resource.url)} target="_blank" rel="noopener noreferrer" className={`${stageControlClass} border border-white/30 text-base`}>
            <ExternalLink size={18} aria-hidden="true" /> {resourceLabel(resource)}
          </a>
        );
      })}
    </div>
  );
};

/** Encabezado de una parada en el escenario. */
const StopHeading = ({ stop, index }: { stop: TeacherStop; index: number }) => (
  <>
    <p className="text-lg font-bold uppercase tracking-wide text-amber-200">
      Parada {index + 1} · <span aria-hidden="true">{KIND_INFO[stop.kind].emoji}</span> {KIND_INFO[stop.kind].label}
    </p>
    <h2 className="stage-title font-black text-white">{stop.title}</h2>
  </>
);

/**
 * Modo clase: la expedición proyectada en el escenario nocturno del Observatorio.
 * - Mapa con la capa de la clase (cuántos lograron cada parada, sin nombres) y la lista de paradas.
 * - Cada parada en pantalla completa: el relato en grande, el reto jugado con la clase (como Estrellas: se revela
 *   y el docente marca si la mayoría acertó), la evidencia o la parada «en clase», que puede abrir Estrellas,
 *   Conquista o El Error con su banco (su Bitácora paga una vez y marca la parada).
 * - «Marcar a los presentes» deja la parada lograda, también para quienes no tienen cuenta.
 * - «Terminar la clase» abre la Bitácora: logros del día, «¿Cómo nos fue?» y una recompensa opcional.
 */
export const ExpeditionProjection = ({ classroom, expedition, onExit }: {
  classroom: ClassroomWithStudents;
  expedition: TeacherExpedition;
  onExit: () => void;
}) => {
  const queryClient = useQueryClient();
  const students = useMemo(() => classroom.students ?? [], [classroom.students]);
  const presence = useTodayPresence(classroom.id, students);
  const stops = expedition.stops;
  const [view, setView] = useState<View>({ kind: 'map' });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCounts, setShowCounts] = useState(true);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  // Para la Bitácora: paradas abiertas hoy y si la mayoría acertó en los retos.
  const [log, setLog] = useState<{ opened: string[]; correct: number; answered: number }>({ opened: [], correct: 0, answered: 0 });
  const [lastMark, setLastMark] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const board = useQuery({ queryKey: expeditionKeys.board(expedition.id), queryFn: () => expeditionApi.board(expedition.id) });
  const classDone = useMemo(() => Object.fromEntries((board.data?.stops ?? []).map((stop) => [stop.id, stop.done])), [board.data]);
  const totalDone = (board.data?.stops ?? []).reduce((sum, stop) => sum + stop.done, 0);
  const finishedCount = board.data?.students.filter((student) => student.finished).length ?? 0;
  // Logradas al abrir la proyección: al terminar, la diferencia cuenta todo lo de hoy (también lo marcado
  // con una actividad del Observatorio o lo que hicieron los alumnos desde su cuenta durante la clase).
  const [startDone, setStartDone] = useState<number | null>(null);
  if (startDone === null && board.data) setStartDone(totalDone);

  const stopId = view.kind === 'stop' || view.kind === 'mark' || view.kind === 'activity' ? view.stopId : null;
  const stop = stopId ? stops.find((s) => s.id === stopId) ?? null : null;
  const stopIndex = stop ? stops.indexOf(stop) : -1;

  // Reto: solo las preguntas que se juegan levantando tarjetas (verdadero o falso, u opción única).
  const challenge = stop?.kind === 'CHALLENGE' ? stop : null;
  const questions = useQuery({
    queryKey: ['questions', challenge?.bankId],
    queryFn: () => questionBankApi.getQuestions(challenge!.bankId!),
    enabled: !!challenge?.bankId,
  });
  const playable = useMemo(() => {
    if (!challenge) return [];
    const byId = new Map((questions.data ?? []).map((q) => [q.id, q]));
    return challenge.questionIds.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => !!q && q.isActive && !!answerOf(q));
  }, [challenge, questions.data]);

  const refreshProgress = () => {
    void queryClient.invalidateQueries({ queryKey: expeditionKeys.board(expedition.id) });
    void queryClient.invalidateQueries({ queryKey: expeditionKeys.detail(expedition.id) });
    void queryClient.invalidateQueries({ queryKey: expeditionKeys.list(classroom.id) });
  };

  const mark = useMutation({
    mutationFn: (target: TeacherStop) => expeditionApi.markClass(target.id, [...presence.presentIds]),
    onSuccess: (result, target) => {
      setLastMark(result.marked > 0
        ? `«${target.title}»: lograda por ${plural(result.marked, 'alumno', 'alumnos')}`
        : `«${target.title}»: los presentes ya la tenían`);
      refreshProgress();
      setSelectedIndex(stops.indexOf(target));
      setView({ kind: 'map' });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo marcar la parada')),
  });

  const openStop = (index: number) => {
    const target = stops[index];
    if (!target) return;
    setSelectedIndex(index);
    setLastMark(null);
    setLog((current) => (current.opened.includes(target.id) ? current : { ...current, opened: [...current.opened, target.id] }));
    if (target.kind === 'CHALLENGE') setQuiz({ stopId: target.id, index: 0, revealed: false, marks: [] });
    setView({ kind: 'stop', stopId: target.id });
  };

  const finishClass = async () => {
    if (ending) return;
    setEnding(true);
    try {
      const created = await activityApi.create(classroom.id, 'EXPEDICION', { title: expedition.name, state: { expeditionId: expedition.id } });
      const finished = await activityApi.finish(created.id, {
        stopsOpened: log.opened.length, achievedToday: Math.max(0, totalDone - (startDone ?? totalDone)), correct: log.correct, answered: log.answered,
      });
      setView({ kind: 'bitacora', session: finished as ActivitySession<unknown, unknown> });
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo abrir la Bitácora'));
    } finally {
      setEnding(false);
    }
  };

  // ── Reto proyectado ──
  const question = quiz && challenge && quiz.stopId === challenge.id && quiz.index < playable.length ? playable[quiz.index] : null;
  const answer = question ? answerOf(question) : null;
  const quizDone = !!quiz && !!challenge && quiz.index >= playable.length;
  const quizCorrect = quiz?.marks.filter((m) => m === true).length ?? 0;
  const quizAnswered = quiz?.marks.filter((m) => m === true || m === false).length ?? 0;
  const markQuiz = (value: boolean) => setQuiz((current) => {
    if (!current) return current;
    const marks = [...current.marks];
    marks[current.index] = marks[current.index] === value ? null : value;
    return { ...current, marks };
  });
  const nextQuestion = () => {
    if (!quiz) return;
    const nextIndex = quiz.index + 1;
    if (nextIndex >= playable.length) setLog((current) => ({ ...current, correct: current.correct + quizCorrect, answered: current.answered + quizAnswered }));
    setQuiz({ ...quiz, index: nextIndex, revealed: false });
  };

  // ── Actividad del Observatorio jugada desde la parada (su propio escenario) ──
  if (view.kind === 'activity' && stop) {
    const props: ComponentProps<typeof EstrellasActivity> = {
      classroom, initialBankId: stop.bankId, expeditionStopId: stop.id,
      onExit: () => { refreshProgress(); setSelectedIndex(stopIndex); setView({ kind: 'map' }); },
    };
    return (
      <Suspense fallback={null}>
        {stop.classActivity === 'ESTRELLAS' && <EstrellasActivity {...props} />}
        {stop.classActivity === 'CONQUISTA' && <ConquistaActivity {...props} />}
        {stop.classActivity === 'ERROR' && <ErrorActivity {...props} />}
      </Suspense>
    );
  }

  const backToMap = () => { setView({ kind: 'map' }); setQuiz(null); };
  const mapButton = (
    <button type="button" onClick={backToMap} className={stageControlClass}>
      <MapIcon size={20} aria-hidden="true" /> <span className="hidden sm:inline">Mapa</span>
    </button>
  );

  // ── Bitácora: cierre de la clase ──
  if (view.kind === 'bitacora') {
    const stopsWorked = log.opened.length;
    const achievedToday = Math.max(0, totalDone - (startDone ?? totalDone));
    const achievements: BitacoraAchievement[] = [
      { icon: '⭐', label: stopsWorked === 1 ? 'parada trabajada hoy' : 'paradas trabajadas hoy', value: String(stopsWorked) },
      { icon: '✅', label: 'paradas logradas hoy, entre todos', value: String(achievedToday) },
      { icon: '🏁', label: 'llegaron a la meta', value: `${finishedCount} de ${students.length}` },
      ...(log.answered > 0 ? [{ icon: '❓', label: 'veces que la mayoría acertó en los retos', value: `${log.correct} de ${log.answered}` }] : []),
    ];
    return (
      <EscenarioObservatorio label="Bitácora de la expedición" onClose={onExit} jiro={{ pose: 'celebrando', line: null }}>
        <Bitacora
          session={view.session}
          activityName={`Expedición «${expedition.name}»`}
          classroomId={classroom.id}
          students={students}
          showCharacterName={classroom.showCharacterName}
          achievements={achievements}
          suggestedXp={10}
          onSessionChange={(session) => setView({ kind: 'bitacora', session })}
          onExit={onExit}
          exitLabel="Volver a la expedición"
        />
      </EscenarioObservatorio>
    );
  }

  // ── Marcar a los presentes ──
  if (view.kind === 'mark' && stop) {
    const already = board.data?.students.filter((student) => student.states.find((s) => s.stopId === stop.id)?.state === 'DONE').length ?? 0;
    return (
      <EscenarioObservatorio
        label={`Marcar «${stop.title}»`}
        onClose={() => setView({ kind: 'stop', stopId: stop.id })}
        primary={{ label: mark.isPending ? 'Marcando…' : `Marcar a ${presence.presentIds.size}`, onClick: () => mark.mutate(stop), disabled: presence.presentIds.size === 0 || mark.isPending }}
        status={`Parada ${stopIndex + 1}: ${stop.title}`}
        barExtra={(
          <button type="button" onClick={() => setView({ kind: 'stop', stopId: stop.id })} className={stageControlClass}>
            <ArrowLeft size={20} aria-hidden="true" /> <span className="hidden sm:inline">Volver</span>
          </button>
        )}
      >
        <div className="w-full max-w-6xl space-y-4">
          <h2 className="stage-option text-center font-black text-white">¿Quiénes estuvieron en «{stop.title}»?</h2>
          <p className="text-center text-lg text-indigo-100">
            {MARK_NOTE[stop.kind]}{already > 0 ? ` ${plural(already, 'alumno ya la tiene', 'alumnos ya la tienen')}: se saltan.` : ''}
          </p>
          {!presence.fromAttendance && !presence.isLoading && (
            <p className="text-center text-base text-indigo-100">Hoy no se pasó lista: todos cuentan como presentes. Desmarca a quien faltó.</p>
          )}
          <PresenceEditor students={students} presentIds={presence.presentIds} showCharacterName={classroom.showCharacterName}
            onToggle={presence.toggle} onSetAll={presence.setAll} tone="stage" />
        </div>
      </EscenarioObservatorio>
    );
  }

  // ── Una parada en pantalla completa ──
  if (view.kind === 'stop' && stop) {
    const toMark = () => setView({ kind: 'mark', stopId: stop.id });
    let primary: { label: string; onClick: () => void; disabled?: boolean } = { label: 'Marcar a los presentes', onClick: toMark };
    let content: ReactNode;
    let onKey: ((event: KeyboardEvent) => boolean) | undefined;

    if (stop.kind === 'CHALLENGE') {
      if (question && answer && quiz) {
        primary = quiz.revealed
          ? { label: quiz.index + 1 >= playable.length ? 'Ver el resultado' : 'Siguiente pregunta', onClick: nextQuestion }
          : { label: 'Revelar la respuesta', onClick: () => setQuiz({ ...quiz, revealed: true }) };
        onKey = (event) => {
          if (!quiz.revealed) return false;
          if (event.key === '1') { markQuiz(true); return true; }
          if (event.key === '2') { markQuiz(false); return true; }
          return false;
        };
        content = (
          <div className="flex w-full max-w-6xl flex-col items-center gap-6 text-center">
            <p className="text-lg font-bold text-amber-200">{stop.title} · Pregunta {quiz.index + 1} de {playable.length}</p>
            <h2 className={`${questionSizeClass(question.questionText)} font-black text-white`}>{question.questionText}</h2>
            <div className="grid w-full gap-4 sm:grid-cols-2">
              {answer.options.map((option, i) => {
                const correct = quiz.revealed && i === answer.index;
                const faded = quiz.revealed && i !== answer.index;
                return (
                  <div key={option + i} className={`flex min-h-[12vh] items-center gap-4 rounded-3xl border-4 px-6 py-4 text-left ${correct
                    ? 'border-emerald-300 bg-emerald-400/25' : faded ? 'border-white/10 bg-white/5 opacity-50' : 'border-white/30 bg-white/10'}`}>
                    <span className="stage-option font-black text-amber-200">{question.type === 'TRUE_FALSE' ? (i === 0 ? 'V' : 'F') : String.fromCharCode(65 + i)}</span>
                    <span className="stage-option min-w-0 flex-1 font-bold text-white">{option}</span>
                    {correct && <Check className="h-[6vh] w-[6vh] flex-shrink-0 text-emerald-200" aria-label="Correcta" />}
                  </div>
                );
              })}
            </div>
            {quiz.revealed && question.explanation && <p className="stage-body max-w-5xl text-indigo-50">{question.explanation}</p>}
            {quiz.revealed && (
              <div className="flex flex-wrap items-center justify-center gap-3" role="group" aria-label="¿La mayoría acertó?">
                <span className="text-lg font-semibold text-indigo-100">¿La mayoría acertó?</span>
                <button type="button" aria-pressed={quiz.marks[quiz.index] === true} onClick={() => markQuiz(true)} className={choiceClass(quiz.marks[quiz.index] === true, 'yes')}>
                  <Check size={22} aria-hidden="true" /> Sí <span className="text-sm font-bold opacity-70">(1)</span>
                </button>
                <button type="button" aria-pressed={quiz.marks[quiz.index] === false} onClick={() => markQuiz(false)} className={choiceClass(quiz.marks[quiz.index] === false, 'no')}>
                  <X size={22} aria-hidden="true" /> Nos costó <span className="text-sm font-bold opacity-70">(2)</span>
                </button>
              </div>
            )}
          </div>
        );
      } else if (quizDone && playable.length > 0) {
        content = (
          <div className="flex max-w-4xl flex-col items-center gap-4 text-center">
            <div className="text-[10vh] leading-none" aria-hidden="true">🎯</div>
            <h2 className="stage-title font-black text-white">¡Reto terminado!</h2>
            {quizAnswered > 0 && <p className="stage-body text-indigo-50">La mayoría acertó en {quizCorrect} de {quizAnswered}.</p>}
            <p className="text-lg text-indigo-100">Marca a los presentes para que la parada quede lograda.</p>
          </div>
        );
      } else {
        content = (
          <div className="flex max-w-4xl flex-col items-center gap-4 text-center">
            <StopHeading stop={stop} index={stopIndex} />
            <p className="stage-body text-indigo-50">
              {questions.isLoading ? 'Cargando las preguntas…' : 'Este reto no tiene preguntas para proyectar (verdadero o falso, u opción única). Pueden hacerlo desde sus cuentas, o márcalo como hecho en clase.'}
            </p>
          </div>
        );
      }
    } else {
      if (stop.kind === 'EVIDENCE') primary = { label: 'Marcar a quienes la mostraron', onClick: toMark };
      if (stop.kind === 'CLASS' && stop.classActivity) {
        primary = { label: `Jugar ${CLASS_ACTIVITY_INFO[stop.classActivity].label}`, onClick: () => setView({ kind: 'activity', stopId: stop.id }) };
      }
      content = (
        <div className="flex w-full max-w-5xl flex-col items-center gap-5 text-center">
          <StopHeading stop={stop} index={stopIndex} />
          {stop.kind === 'STORY' && stop.story && <p className="stage-body whitespace-pre-line text-indigo-50">{stop.story}</p>}
          {stop.kind !== 'STORY' && stop.mission && <p className="stage-body whitespace-pre-line text-indigo-50">{stop.mission}</p>}
          {stop.kind === 'EVIDENCE' && (
            <p className="text-lg text-indigo-100">Quien la muestre en clase (en papel o en la pizarra) queda con la evidencia aprobada.</p>
          )}
          {stop.kind === 'CLASS' && stop.classActivity && (
            <>
              <p className="text-lg text-indigo-100">
                {CLASS_ACTIVITY_INFO[stop.classActivity].hint} Al entregar la recompensa de su Bitácora, la parada queda lograda para los presentes.
              </p>
              <button type="button" onClick={toMark} className={`${stageControlClass} border border-white/30 text-base`}>Solo marcar a los presentes</button>
            </>
          )}
          {stop.kind !== 'CLASS' && stop.kind !== 'EVIDENCE' && <StageResources stop={stop} />}
          {stop.kind === 'EVIDENCE' && <StageResources stop={stop} />}
        </div>
      );
    }

    return (
      <EscenarioObservatorio
        label={`Parada ${stopIndex + 1}: ${stop.title}`}
        onClose={backToMap}
        jiro={{ pose: KIND_POSE[stop.kind], line: null }}
        primary={primary}
        onKey={onKey}
        status={`Parada ${stopIndex + 1} de ${stops.length} · ${KIND_INFO[stop.kind].label}`}
        barExtra={mapButton}
      >
        {content}
      </EscenarioObservatorio>
    );
  }

  // ── Mapa con la capa de la clase ──
  const selected = stops[Math.min(selectedIndex, stops.length - 1)] ?? null;
  const everyoneFinished = students.length > 0 && finishedCount >= students.length;
  return (
    <EscenarioObservatorio
      label={`Expedición «${expedition.name}»`}
      onClose={onExit}
      jiro={everyoneFinished
        ? { pose: 'celebrando', line: '¡Toda la clase llegó a la meta!' }
        : { pose: 'senalando', line: selected ? `¿Vamos a la parada ${selectedIndex + 1}?` : null }}
      primary={selected ? { label: `Abrir parada ${selectedIndex + 1}`, onClick: () => openStop(selectedIndex) } : null}
      onPrev={() => setSelectedIndex((i) => Math.max(0, i - 1))}
      onNext={() => setSelectedIndex((i) => Math.min(stops.length - 1, i + 1))}
      onKey={(event) => {
        const n = Number(event.key);
        if (Number.isInteger(n) && n >= 1 && n <= Math.min(9, stops.length)) { setSelectedIndex(n - 1); return true; }
        if (event.key === 'c' || event.key === 'C') { setShowCounts((v) => !v); return true; }
        return false;
      }}
      status={`${finishedCount} de ${students.length} en la meta`}
      barExtra={(
        <>
          <button type="button" onClick={() => setShowCounts((v) => !v)} aria-pressed={showCounts} className={stageControlClass} title="Conteos (C)">
            {showCounts ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            <span className="hidden md:inline">{showCounts ? 'Ocultar conteos' : 'Mostrar conteos'}</span>
          </button>
          <StageEndButton onEnd={() => void finishClass()} label={ending ? 'Abriendo…' : 'Terminar la clase'} />
        </>
      )}
    >
      <div className="grid w-full max-w-7xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="w-full">
          <h2 className="stage-option mb-4 text-center font-black text-white">{expedition.name}</h2>
          <div className="mx-auto w-full" style={{ maxWidth: 'calc((100vh - 15rem) / 0.7)' }}>
            <ExpeditionStage
              scenario={expedition.scenario}
              constellationId={expedition.constellationId}
              mapImageUrl={expedition.mapImageUrl}
              stops={stops.map((s) => ({ id: s.id, kind: s.kind, title: s.title, state: 'LOCKED', mapX: s.mapX, mapY: s.mapY }))}
              variant="class"
              classDone={classDone}
              showCounts={showCounts}
              finished={finishedCount > 0}
              selectedId={selected?.id ?? null}
              onSelect={(id) => openStop(stops.findIndex((s) => s.id === id))}
              label={`${expedition.name}: ${plural(stops.length, 'parada', 'paradas')}. Cuántos lograron cada una, sin nombres.`}
            />
          </div>
          {lastMark && <p role="status" className="mt-4 text-center text-xl font-bold text-emerald-200">✓ {lastMark}</p>}
        </div>
        <ol className="space-y-2" aria-label="Paradas">
          {stops.map((s, index) => (
            <li key={s.id}>
              <button type="button" onClick={() => openStop(index)} onFocus={() => setSelectedIndex(index)} aria-current={index === selectedIndex ? 'step' : undefined}
                className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left ${index === selectedIndex ? 'border-amber-300 bg-amber-300/15' : 'border-white/15 bg-white/5 hover:bg-white/10'}`}>
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-300 text-base font-extrabold text-amber-950">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold text-white">{s.title}</span>
                  <span className="block text-sm font-semibold text-indigo-100">
                    <span aria-hidden="true">{KIND_INFO[s.kind].emoji}</span> {KIND_INFO[s.kind].label}{showCounts ? ` · ${classDone[s.id] ?? 0} ✓` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </EscenarioObservatorio>
  );
};
