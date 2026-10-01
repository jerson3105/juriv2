import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Check, EyeOff, Loader2, Mail, Moon, Printer, Projector, Send, Undo2, X } from 'lucide-react';
import type { ActivitySession } from '../../../lib/activityApi';
import type { Classroom, Student } from '../../../lib/classroomApi';
import { correoApi, correoKeys, type CorreoLetter, type CorreoMode, type CorreoState } from '../../../lib/correoApi';
import { shuffle } from '../../classroom/utilities/helpers';
import { studentNames } from '../../students/profile/profileHelpers';
import { Bitacora } from '../Bitacora';
import { EscenarioObservatorio } from '../EscenarioObservatorio';
import { useStageSound } from '../observatorioSound';
import { PresenceEditor } from '../presence';
import { useActivitySession } from '../useActivitySession';
import { useTodayPresence } from '../usePresence';
import { printSecretStars } from './printSecretStars';
import { hasStudentAccount } from '../../../lib/studentAccess';

type Stage = null | 'announce' | 'delivery' | 'bitacora';

interface CorreoResult extends Record<string, unknown> {
  mode: CorreoMode;
  stars: number;
  delivered: number;
  announced: number;
}

const PROMPTS = [
  'Escríbele algo que admiras de esa persona.',
  'Cuéntale un momento en que te ayudó o te hizo reír.',
  'Dale ánimo para algo que le cuesta.',
  'Agradécele algo concreto que hizo por la clase.',
];
const MAX_ON_STAGE = 5;

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const card = 'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5';
const option = (on: boolean) =>
  `min-h-[44px] rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${on
    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-500/20 dark:text-white'
    : 'border-gray-300 text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700'}`;
const primaryBtn = 'inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60';
const secondaryBtn = 'inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 px-4 text-sm font-bold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700';

interface CorreoActivityProps {
  classroom: Classroom & { students?: Student[] };
  resume?: ActivitySession<unknown, unknown> | null;
  onExit: () => void;
}

/**
 * Correo Estelar: cada presente recibe una "estrella secreta" (un compañero) y una consigna para
 * escribirle. En papel se imprimen las tarjetas y el docente marca quién entregó; en dispositivo
 * escriben desde su cuenta y el docente modera. El panel es privado (se ven autores): solo se
 * proyecta la consigna, la entrega de Jiro y la Bitácora.
 */
export const CorreoActivity = ({ classroom, resume, onExit }: CorreoActivityProps) => {
  const queryClient = useQueryClient();
  const students = useMemo(() => classroom.students ?? [], [classroom.students]);
  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const nameOf = (id: string) => {
    const s = byId.get(id);
    return s ? studentNames(s, classroom.showCharacterName).primary : 'Alumno';
  };
  const presence = useTodayPresence(classroom.id, students);
  const soundState = useStageSound();
  const game = useActivitySession<CorreoState, CorreoResult>(classroom.id, 'CORREO', resume as ActivitySession<CorreoState, CorreoResult> | null | undefined);
  const session = game.session;
  const state = (session?.state ?? null) as CorreoState | null;

  const [stage, setStage] = useState<Stage>(resume?.status === 'FINISHED' ? 'bitacora' : null);
  const [promptChoice, setPromptChoice] = useState(PROMPTS[0]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [mode, setMode] = useState<CorreoMode>('papel');
  const [editingPresence, setEditingPresence] = useState(false);

  // Con cuenta propia (correo, Google o PIN): puede escribir desde su dispositivo.
  const withAccount = (id: string) => { const s = byId.get(id); return !!s && hasStudentAccount(s); };
  const presentIds = students.filter((s) => presence.presentIds.has(s.id)).map((s) => s.id);
  const writers = mode === 'dispositivo' ? presentIds.filter(withAccount) : presentIds;
  const prompt = (customPrompt.trim() || promptChoice).slice(0, 300);

  const create = useMutation({
    mutationFn: () => correoApi.create(classroom.id, { studentIds: writers, prompt, mode }),
    onSuccess: (created) => game.setSession(created as ActivitySession<CorreoState, CorreoResult>),
    onError: (error) => toast.error(errorMessage(error, 'No se pudo abrir el Correo Estelar')),
  });

  const isDevice = state?.mode === 'dispositivo';
  const { data: letters = [], isFetching: lettersLoading } = useQuery({
    queryKey: correoKeys.letters(session?.id ?? ''),
    queryFn: () => correoApi.letters(session!.id),
    enabled: !!session && session.status === 'ACTIVE' && isDevice,
    refetchInterval: 15_000,
  });
  const moderate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CorreoLetter['status'] }) => correoApi.moderate(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: correoKeys.letters(session?.id ?? '') }),
    onError: (error) => toast.error(errorMessage(error, 'No se pudo revisar la carta')),
  });

  const update = (patch: Partial<CorreoState>) => {
    if (!session || !state) return;
    const next = { ...state, ...patch };
    game.setSession({ ...session, state: next });
    game.save(next);
  };
  const toggleDelivered = (writerId: string) => {
    if (!state) return;
    update({ delivered: state.delivered.includes(writerId) ? state.delivered.filter((id) => id !== writerId) : [...state.delivered, writerId] });
  };

  // Lo que Jiro puede entregar en escena: cartas aprobadas (dispositivo) o destinatarios de cartas entregadas (papel).
  const approved = letters.filter((l) => l.status === 'APPROVED');
  const deliveredCount = state ? (isDevice ? approved.length : state.delivered.length) : 0;
  const queue = useMemo(() => {
    if (!state) return [] as { key: string; recipientId: string; message: string | null }[];
    const items = isDevice
      ? approved.map((l) => ({ key: l.id, recipientId: l.recipientId, message: l.message }))
      : state.pairs.filter((p) => state.delivered.includes(p.writerId)).map((p) => ({ key: p.writerId, recipientId: p.recipientId, message: null }));
    return items.filter((i) => !state.announced.includes(i.key));
    // approved cambia con cada consulta; basta con su longitud y los estados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isDevice, approved.length]);
  const [deliveryPick, setDeliveryPick] = useState<typeof queue>([]);
  const [deliveryIndex, setDeliveryIndex] = useState(0);

  const openDelivery = () => {
    setDeliveryPick(shuffle(queue).slice(0, MAX_ON_STAGE));
    setDeliveryIndex(0);
    setStage('delivery');
  };
  const nextLetter = () => {
    const current = deliveryPick[deliveryIndex];
    if (current && state && !state.announced.includes(current.key)) update({ announced: [...state.announced, current.key] });
    soundState.sound.star(deliveryIndex);
    setDeliveryIndex((i) => i + 1);
  };

  const finish = async () => {
    if (!state) return;
    const result: CorreoResult = { mode: state.mode, stars: state.pairs.length, delivered: deliveredCount, announced: state.announced.length };
    try {
      await game.finish(result, state);
      soundState.sound.success();
      setStage('bitacora');
    } catch {
      toast.error('No se pudo guardar la partida. Inténtalo de nuevo.');
    }
  };

  // ── Escenario (lo único que se proyecta) ──
  if (stage) {
    const current = stage === 'delivery' ? deliveryPick[deliveryIndex] : undefined;
    const result = session?.result as CorreoResult | null | undefined;
    return (
      <EscenarioObservatorio
        label="Correo Estelar"
        onClose={() => (stage === 'bitacora' ? onExit() : setStage(null))}
        soundState={soundState}
        jiro={{
          pose: stage === 'bitacora' ? 'celebrando' : stage === 'delivery' && current ? 'emocionado' : 'senalando',
          line: stage === 'announce'
            ? '¡Cada uno tiene una estrella secreta!'
            : stage === 'delivery'
              ? (current ? '¡Correo estelar!' : 'Las demás cartas, a sus dueños.')
              : `¡Se escribieron ${result?.delivered ?? deliveredCount} cartas!`,
          placement: 'corner',
        }}
        primary={stage === 'delivery'
          ? (current ? { label: 'Siguiente carta', onClick: nextLetter } : { label: 'Volver al panel', onClick: () => setStage(null) })
          : stage === 'announce' ? { label: 'Volver al panel', onClick: () => setStage(null) } : null}
      >
        {stage === 'announce' && state && (
          <div className="flex w-full max-w-5xl flex-col items-center gap-5 text-center">
            <p className="stage-display" aria-hidden="true">💌</p>
            <h1 className="stage-title font-black text-white">Correo Estelar</h1>
            <p className="stage-option font-bold text-amber-100">«{state.prompt}»</p>
            <p className="stage-body text-indigo-50">
              {state.mode === 'papel'
                ? 'Lee en tu tarjeta quién es tu estrella secreta, escríbele y entrégale la carta a tu profe. ¡Es un secreto!'
                : 'Entra a Juried: en tu inicio verás a quién escribirle. ¡Es un secreto!'}
            </p>
          </div>
        )}

        {stage === 'delivery' && (
          current ? (
            <article key={current.key} className="obs-star-in flex w-full max-w-4xl flex-col items-center gap-4 rounded-3xl border-4 border-amber-200 bg-[#fdf6e3] p-6 text-center text-slate-900 shadow-2xl">
              <p className="text-[clamp(18px,2.6vh,30px)] font-bold text-slate-700">Para</p>
              <p className="stage-title font-black">{nameOf(current.recipientId)}</p>
              {current.message ? (
                <p className="stage-body font-medium italic">«{current.message}»</p>
              ) : (
                <p className="stage-body font-medium">¡Tienes correo estelar! Tu estrella secreta te lo entrega.</p>
              )}
              <p className="text-[clamp(16px,2.4vh,28px)] font-semibold text-slate-700">De: tu estrella secreta ✨</p>
              <p className="text-base font-semibold text-slate-600">{deliveryIndex + 1} de {deliveryPick.length}</p>
            </article>
          ) : (
            <div className="flex w-full max-w-4xl flex-col items-center gap-3 text-center">
              <p className="stage-display" aria-hidden="true">📬</p>
              <p className="stage-title font-black text-white">{deliveryPick.length > 0 ? '¡Entregadas!' : 'Aún no hay cartas para entregar'}</p>
              <p className="stage-body text-indigo-50">
                {isDevice ? 'Las demás cartas aprobadas ya están en las cuentas de sus dueños.' : 'Las demás cartas se entregan en mano.'}
              </p>
            </div>
          )
        )}

        {stage === 'bitacora' && session && (
          <Bitacora
            session={session}
            activityName="Correo Estelar"
            classroomId={classroom.id}
            students={students}
            showCharacterName={classroom.showCharacterName}
            achievements={[
              { icon: '💌', label: 'cartas escritas', value: `${result?.delivered ?? deliveredCount}/${result?.stars ?? state?.pairs.length ?? 0}` },
              { icon: '✨', label: 'entregadas por Jiro', value: String(result?.announced ?? state?.announced.length ?? 0) },
              { icon: '🤝', label: 'estrellas secretas', value: String(result?.stars ?? state?.pairs.length ?? 0) },
            ]}
            suggestedXp={15}
            onSessionChange={(s) => game.setSession(s as ActivitySession<CorreoState, CorreoResult>)}
            onExit={onExit}
          />
        )}
      </EscenarioObservatorio>
    );
  }

  // ── Panel del docente (privado) ──
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onExit} className={secondaryBtn}>
          <ArrowLeft size={18} aria-hidden="true" /> Observatorio
        </button>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">💌 Correo Estelar</h1>
      </div>

      {!session || session.status !== 'ACTIVE' || !state ? (
        <div className={`${card} space-y-5`}>
          <fieldset>
            <legend className="mb-2 text-base font-bold text-gray-900 dark:text-white">Consigna</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROMPTS.map((p) => (
                <button key={p} type="button" onClick={() => { setPromptChoice(p); setCustomPrompt(''); }} aria-pressed={!customPrompt.trim() && promptChoice === p} className={option(!customPrompt.trim() && promptChoice === p)}>
                  {p}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-sm font-semibold text-gray-800 dark:text-gray-100">
              O escribe la tuya
              <input
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value.slice(0, 300))}
                placeholder="Ej.: Cuéntale qué aprendiste de esa persona este bimestre"
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-400"
              />
            </label>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-base font-bold text-gray-900 dark:text-white">Cómo escriben</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setMode('papel')} aria-pressed={mode === 'papel'} className={option(mode === 'papel')}>
                <span className="block font-bold">📝 En papel</span>
                <span className="block font-normal">Imprimes una tarjeta por alumno y marcas quién entregó.</span>
              </button>
              <button type="button" onClick={() => setMode('dispositivo')} aria-pressed={mode === 'dispositivo'} className={option(mode === 'dispositivo')}>
                <span className="block font-bold">📱 Desde su cuenta</span>
                <span className="block font-normal">Escriben en Juried y tú revisas cada carta antes de que llegue.</span>
              </button>
            </div>
          </fieldset>

          <div>
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
              {writers.length} {writers.length === 1 ? 'participa' : 'participan'}
              {mode === 'dispositivo' && presentIds.length > writers.length && (
                <span className="font-normal text-gray-700 dark:text-gray-200">({presentIds.length - writers.length} presentes sin cuenta quedan fuera)</span>
              )}
              <button type="button" onClick={() => setEditingPresence((v) => !v)} aria-expanded={editingPresence} className={secondaryBtn}>
                {editingPresence ? 'Listo' : 'Ajustar presentes'}
              </button>
            </p>
            {!presence.fromAttendance && <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">Hoy no se pasó lista: todos cuentan como presentes.</p>}
            {editingPresence && (
              <div className="mt-3">
                <PresenceEditor tone="page" students={students} presentIds={presence.presentIds} showCharacterName={classroom.showCharacterName} onToggle={presence.toggle} onSetAll={presence.setAll} />
              </div>
            )}
          </div>

          <button type="button" onClick={() => create.mutate()} disabled={writers.length < 2 || create.isPending} className={primaryBtn}>
            {create.isPending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Mail size={18} aria-hidden="true" />}
            Asignar estrellas secretas
          </button>
          {writers.length < 2 && <p className="text-sm text-amber-800 dark:text-amber-200">Se necesitan al menos 2 participantes.</p>}
        </div>
      ) : (
        <>
          <div className={`${card} flex flex-wrap items-start gap-4`}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{state.mode === 'papel' ? '📝 En papel' : '📱 Desde su cuenta'} · {state.pairs.length} estrellas secretas</p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">«{state.prompt}»</p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                {state.mode === 'papel' ? `${state.delivered.length} de ${state.pairs.length} entregaron` : `${letters.length} de ${state.pairs.length} escribieron · ${letters.filter((l) => l.status === 'PENDING').length} por revisar`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {state.mode === 'papel' && (
                <button type="button" onClick={() => printSecretStars(state, nameOf, classroom.name)} className={secondaryBtn}>
                  <Printer size={18} aria-hidden="true" /> Imprimir tarjetas
                </button>
              )}
              <button type="button" onClick={() => setStage('announce')} className={secondaryBtn}>
                <Projector size={18} aria-hidden="true" /> Proyectar consigna
              </button>
              <button type="button" onClick={openDelivery} className={secondaryBtn}>
                <Send size={18} aria-hidden="true" /> Entrega en clase ({Math.min(queue.length, MAX_ON_STAGE)})
              </button>
              <button type="button" onClick={() => void finish()} className={primaryBtn}>Terminar y ver la Bitácora</button>
            </div>
          </div>

          <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">
            <EyeOff size={16} aria-hidden="true" /> No proyectes este panel: aquí se ven las parejas y los autores.
          </p>

          {state.mode === 'papel' ? (
            <section className={card} aria-labelledby="correo-entregas">
              <h2 id="correo-entregas" className="mb-3 text-base font-bold text-gray-900 dark:text-white">¿Quién entregó su carta?</h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {state.pairs.map((pair) => {
                  const on = state.delivered.includes(pair.writerId);
                  const resting = (byId.get(pair.writerId)?.hp ?? 1) <= 0;
                  return (
                    <li key={pair.writerId}>
                      <button type="button" onClick={() => toggleDelivered(pair.writerId)} aria-pressed={on} className={`flex min-h-[44px] w-full items-center gap-2 ${option(on)}`}>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-400'}`} aria-hidden="true">
                          {on && <Check size={14} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{nameOf(pair.writerId)} → {nameOf(pair.recipientId)}</span>
                        {resting && <Moon size={14} aria-label="Descansando" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <section className={card} aria-labelledby="correo-cartas">
              <h2 id="correo-cartas" className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
                Cartas {lettersLoading && <Loader2 size={16} className="animate-spin" aria-label="Actualizando" />}
              </h2>
              {letters.length === 0 ? (
                <p className="text-sm text-gray-700 dark:text-gray-200">Aún no llegan cartas. Se actualiza solo cada 15 segundos.</p>
              ) : (
                <ul className="space-y-2">
                  {[...letters].sort((a, b) => Number(a.status !== 'PENDING') - Number(b.status !== 'PENDING')).map((letter) => (
                    <li key={letter.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        De {nameOf(letter.writerId)} para {nameOf(letter.recipientId)} ·{' '}
                        <span className={letter.status === 'APPROVED' ? 'text-emerald-700 dark:text-emerald-300' : letter.status === 'REJECTED' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-800 dark:text-amber-200'}>
                          {letter.status === 'APPROVED' ? 'Aprobada' : letter.status === 'REJECTED' ? 'Rechazada' : 'Por revisar'}
                        </span>
                      </p>
                      <p className="mt-1 text-base text-gray-900 dark:text-white">{letter.message}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {letter.status === 'PENDING' ? (
                          <>
                            <button type="button" onClick={() => moderate.mutate({ id: letter.id, status: 'APPROVED' })} disabled={moderate.isPending} className={primaryBtn}>
                              <Check size={16} aria-hidden="true" /> Aprobar
                            </button>
                            <button type="button" onClick={() => moderate.mutate({ id: letter.id, status: 'REJECTED' })} disabled={moderate.isPending} className={secondaryBtn}>
                              <X size={16} aria-hidden="true" /> Rechazar
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={() => moderate.mutate({ id: letter.id, status: 'PENDING' })} disabled={moderate.isPending} className={secondaryBtn}>
                            <Undo2 size={16} aria-hidden="true" /> Volver a revisar
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};
