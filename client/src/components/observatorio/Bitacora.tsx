import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { BookOpen, Check, Gift, Loader2, Moon, RotateCcw, Undo2, Users } from 'lucide-react';
import { activityApi, activityKeys, type ActivityRewardResult, type ActivitySession, type ChapterProgress, type SelfAssessment } from '../../lib/activityApi';
import { behaviorApi, type ApplyResult } from '../../lib/behaviorApi';
import type { Student } from '../../lib/classroomApi';
import { celebrateApplyResult } from '../celebrations/celebrationHelpers';
import { PresenceEditor } from './presence';
import { useTodayPresence } from './usePresence';
import { stageControlClass, stagePrimaryClass } from './EscenarioObservatorio';

export interface BitacoraAchievement {
  icon: string;
  label: string;
  value: string;
}

export interface BitacoraPodiumEntry {
  key: string;
  name: string;
  emblem: string;
  color: string;
  score: number;
  unit: string;
}

const SELF_ASSESSMENT: { value: SelfAssessment; icon: string; label: string; ring: string }[] = [
  { value: 'GREEN', icon: '🟢', label: 'Lo logramos', ring: 'border-emerald-300 bg-emerald-400/20' },
  { value: 'YELLOW', icon: '🟡', label: 'Casi', ring: 'border-amber-300 bg-amber-400/20' },
  { value: 'RED', icon: '🔴', label: 'Nos costó', ring: 'border-rose-300 bg-rose-400/20' },
];

const XP_PRESETS = [10, 15, 20];
const GP_PRESETS = [0, 5, 10];

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const formatNumber = (value: number) => Math.round(value).toLocaleString('es-PE');

/** Avance del capítulo de la Historia: antes → después, con la barra que crece. */
const ChapterBar = ({ chapter }: { chapter: ChapterProgress }) => {
  const reduce = useReducedMotion();
  const target = Math.max(1, chapter.target);
  const from = Math.min(100, (chapter.before / target) * 100);
  const to = Math.min(100, (chapter.after / target) * 100);
  const unit = chapter.completionType === 'DONATION' ? 'XP donados' : 'XP';
  return (
    <div className="w-full rounded-2xl border border-indigo-300/30 bg-indigo-950/60 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-indigo-100">
        <BookOpen size={16} aria-hidden="true" /> Historia · {chapter.title}
      </p>
      <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-white/10" role="img"
        aria-label={`Capítulo: de ${formatNumber(chapter.before)} a ${formatNumber(chapter.after)} de ${formatNumber(chapter.target)} ${unit}`}>
        <motion.div
          className="h-full origin-left rounded-full bg-gradient-to-r from-amber-300 to-amber-400"
          initial={{ width: `${from}%` }}
          animate={{ width: `${to}%` }}
          transition={{ duration: reduce ? 0 : 1.2, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
      <p className="mt-2 text-base font-bold text-white">
        {formatNumber(chapter.before)} → {formatNumber(chapter.after)}
        <span className="font-semibold text-indigo-200"> de {formatNumber(chapter.target)} {unit}</span>
      </p>
    </div>
  );
};

type AnySession = ActivitySession<unknown, unknown>;

interface BitacoraProps {
  session: AnySession;
  /** Nombre de la actividad (contexto de la celebración en modo XP y oro). */
  activityName: string;
  /** false = la actividad no evalúa una competencia: no se ofrecen comportamientos que cuentan para la nota. */
  allowGradeBehaviors?: boolean;
  classroomId: string;
  students: Student[];
  showCharacterName?: boolean;
  /** Logros de la partida (3 a 5). */
  achievements: BitacoraAchievement[];
  /** Podio de clanes (Conquista). */
  podium?: BitacoraPodiumEntry[];
  /** XP sugerido para la recompensa libre. */
  suggestedXp?: number;
  onSessionChange: (session: AnySession) => void;
  onPlayAgain?: () => void;
  onExit: () => void;
  /** Texto del botón de salida (la expedición proyectada vuelve a su editor). */
  exitLabel?: string;
}

/**
 * Bitácora de Jiro: cierre de toda actividad. Logros, podio, recompensa a los presentes en un
 * toque (una vez por partida, con Deshacer), avance del capítulo y autoevaluación de la clase.
 */
export const Bitacora = ({
  session, activityName, allowGradeBehaviors = true, classroomId, students, showCharacterName, achievements, podium, suggestedXp = 20, onSessionChange, onPlayAgain, onExit,
  exitLabel = 'Volver al Observatorio',
}: BitacoraProps) => {
  const queryClient = useQueryClient();
  const presence = useTodayPresence(classroomId, students);
  const [editingPresence, setEditingPresence] = useState(false);
  const [mode, setMode] = useState<'free' | 'behavior'>('free');
  const [xp, setXp] = useState(suggestedXp);
  const [gp, setGp] = useState(0);
  const [behaviorId, setBehaviorId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ActivityRewardResult | null>(null);

  const { data: behaviors = [] } = useQuery({
    queryKey: ['behaviors', classroomId],
    queryFn: () => behaviorApi.getByClassroom(classroomId),
  });
  const positives = useMemo(
    () => behaviors
      .filter((b) => b.isPositive && (allowGradeBehaviors || !b.competencyId))
      // Los que cuentan para la nota, al final: lo habitual es premiar sin calificar.
      .sort((a, b) => Number(!!a.competencyId) - Number(!!b.competencyId)),
    [behaviors, allowGradeBehaviors],
  );
  const selectedBehavior = positives.find((b) => b.id === behaviorId) ?? null;
  const presentStudents = students.filter((s) => presence.presentIds.has(s.id));
  const restingPresent = presentStudents.filter((s) => s.hp <= 0).length;
  const rewarded = !!session.rewardedAt && !!session.reward;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
    void queryClient.invalidateQueries({ queryKey: activityKeys.overview(classroomId) });
    void queryClient.invalidateQueries({ queryKey: ['history-today', classroomId] });
  };

  const reward = useMutation({
    mutationFn: () => activityApi.reward(session.id, mode === 'behavior' && behaviorId
      ? { studentIds: [...presence.presentIds], behaviorId }
      : { studentIds: [...presence.presentIds], xp, gp }),
    onSuccess: (result) => {
      setLastResult(result);
      onSessionChange(result.session);
      refresh();
      celebrateApplyResult(queryClient, classroomId, {
        behavior: { name: mode === 'behavior' && selectedBehavior ? selectedBehavior.name : activityName },
        levelUps: result.levelUps,
        awardedBadges: result.awardedBadges,
      } as ApplyResult);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo entregar la recompensa')),
  });

  const undo = useMutation({
    mutationFn: () => activityApi.undoReward(session.id),
    onSuccess: (result) => {
      setLastResult(null);
      onSessionChange(result.session);
      refresh();
      toast.success(result.badgesReverted
        ? `Recompensa deshecha (y ${result.badgesReverted} insignia${result.badgesReverted === 1 ? '' : 's'})`
        : 'Recompensa deshecha');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo deshacer')),
  });

  const assess = useMutation({
    mutationFn: (value: SelfAssessment | null) => activityApi.setSelfAssessment(session.id, value),
    onMutate: (value) => onSessionChange({ ...session, selfAssessment: value }),
    onSuccess: (updated) => onSessionChange(updated),
    onError: (error) => {
      onSessionChange(session);
      toast.error(errorMessage(error, 'No se pudo guardar'));
    },
  });

  const pendingSummary = mode === 'behavior'
    ? selectedBehavior?.name ?? ''
    : [xp > 0 ? `+${xp} XP` : null, gp > 0 ? `+${gp} oro` : null].filter(Boolean).join(' y ');
  const canReward = presence.presentIds.size > 0 && (mode === 'behavior' ? !!behaviorId : xp > 0 || gp > 0);
  const rewardSummary = session.reward
    ? session.reward.behaviorName
      ? `${session.reward.behaviorName}`
      : [session.reward.xp > 0 ? `+${session.reward.xp} XP` : null, session.reward.gp > 0 ? `+${session.reward.gp} oro` : null].filter(Boolean).join(' · ')
    : '';

  return (
    <div className="flex w-full max-w-5xl flex-col gap-5 pb-4">
      <h2 className="stage-title text-center font-black text-white">Bitácora de Jiro</h2>

      {/* Logros */}
      {achievements.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Logros de la partida">
          {achievements.map((a) => (
            <li key={a.label} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-4">
              <span className="stage-option" aria-hidden="true">{a.icon}</span>
              <span className="min-w-0">
                <span className="stage-option block font-black text-amber-200">{a.value}</span>
                <span className="block text-[clamp(18px,2.8vh,32px)] font-semibold leading-tight text-indigo-100">{a.label}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Podio de equipos */}
      {podium && podium.length > 0 && (
        <ol className="flex flex-wrap items-end justify-center gap-3" aria-label="Podio de equipos">
          {podium.slice(0, 3).map((entry) => {
            // Empates comparten puesto (deportivo).
            const place = podium.filter((p) => p.score > entry.score).length + 1;
            return (
              <li
                key={entry.key}
                className="flex w-[clamp(10rem,18vw,18rem)] flex-col items-center rounded-2xl border-2 p-3 text-center"
                style={{ borderColor: entry.color, backgroundColor: `${entry.color}26`, minHeight: `${12 - (place - 1) * 2}vh` }}
              >
                <span className="text-[clamp(18px,2.8vh,32px)] font-black text-amber-200">{place}.º</span>
                <span className="stage-option" aria-hidden="true">{entry.emblem}</span>
                <span className="mt-1 text-[clamp(18px,2.8vh,32px)] font-bold text-white">{entry.name}</span>
                <span className="text-[clamp(16px,2.4vh,28px)] font-semibold text-indigo-100">{entry.score} {entry.unit}</span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Autoevaluación de la clase */}
      <section aria-labelledby="bitacora-assess" className="rounded-3xl border border-white/15 bg-[#121a3d] p-4 sm:p-5">
        <h3 id="bitacora-assess" className="text-xl font-black text-white">¿Cómo nos fue?</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          {SELF_ASSESSMENT.map((option) => {
            const active = session.selfAssessment === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => assess.mutate(active ? null : option.value)}
                className={`inline-flex min-h-[56px] items-center gap-3 rounded-2xl border-2 px-5 text-lg font-black text-white ${active ? option.ring : 'border-white/20 hover:bg-white/10'}`}
              >
                <span className="text-2xl" aria-hidden="true">{option.icon}</span>
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Recompensa */}
      <section aria-labelledby="bitacora-reward" className="rounded-3xl border border-white/15 bg-[#121a3d] p-4 sm:p-5">
        <h3 id="bitacora-reward" className="flex items-center gap-2 text-xl font-black text-white">
          <Gift size={22} aria-hidden="true" /> Recompensa para los presentes
        </h3>

        {rewarded ? (
          <div className="mt-3 space-y-3">
            <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-emerald-200" role="status">
              <Check size={22} aria-hidden="true" />
              Entregado a {session.reward!.studentIds.length} presentes: {rewardSummary}
            </p>
            {lastResult?.expeditionStop && lastResult.expeditionStop.marked > 0 && (
              <p className="flex items-center gap-2 text-base font-semibold text-amber-100">
                <span aria-hidden="true">🗺️</span> Expedición: «{lastResult.expeditionStop.title}» quedó lograda para {lastResult.expeditionStop.marked} presentes
              </p>
            )}
            {lastResult && lastResult.restingSkipped > 0 && (
              <p className="flex items-center gap-2 text-sm font-semibold text-indigo-100">
                <Moon size={16} aria-hidden="true" /> {lastResult.restingSkipped} descansando: no reciben HP
              </p>
            )}
            {lastResult && lastResult.levelUps.length > 0 && (
              <p className="stage-body font-semibold text-amber-200">
                ⬆️ Subieron de nivel: {lastResult.levelUps.map((l) => `${l.studentName} (Nv ${l.newLevel})`).join(', ')}
              </p>
            )}
            {lastResult?.chapter && <ChapterBar chapter={lastResult.chapter} />}
            <button type="button" onClick={() => undo.mutate()} disabled={undo.isPending} className={`${stageControlClass} border border-white/25`}>
              {undo.isPending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Undo2 size={18} aria-hidden="true" />}
              Deshacer recompensa
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-base font-semibold text-indigo-100">
              <Users size={18} aria-hidden="true" />
              <span><strong className="text-white">{presence.presentIds.size}</strong> presentes</span>
              {restingPresent > 0 && (
                <span className="inline-flex items-center gap-1"><Moon size={16} aria-hidden="true" /> {restingPresent} descansando</span>
              )}
              <button type="button" onClick={() => setEditingPresence((v) => !v)} aria-expanded={editingPresence} className={`${stageControlClass} border border-white/25`}>
                {editingPresence ? 'Listo' : 'Ajustar lista'}
              </button>
            </div>
            {!presence.fromAttendance && !presence.isLoading && (
              <p className="text-sm text-indigo-100">Hoy no se pasó lista: todos cuentan como presentes. Desmarca a quien faltó.</p>
            )}
            {editingPresence && (
              <PresenceEditor
                students={students}
                presentIds={presence.presentIds}
                showCharacterName={showCharacterName}
                onToggle={presence.toggle}
                onSetAll={presence.setAll}
              />
            )}

            <div role="radiogroup" aria-label="Tipo de recompensa" className="flex flex-wrap gap-2">
              {([['free', 'XP y oro'], ['behavior', 'Comportamiento']] as const).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={`min-h-[44px] rounded-xl border px-4 text-sm font-bold ${mode === value ? 'border-white bg-white text-slate-900' : 'border-white/30 text-white hover:bg-white/10'}`}
                >
                  {text}
                </button>
              ))}
            </div>

            {mode === 'free' ? (
              <div className="flex flex-wrap gap-6">
                <fieldset>
                  <legend className="mb-2 text-sm font-bold text-indigo-100">XP para cada uno</legend>
                  <div className="flex gap-2">
                    {XP_PRESETS.map((value) => (
                      <button key={value} type="button" onClick={() => setXp(value)} aria-pressed={xp === value}
                        className={`min-h-[44px] min-w-[64px] rounded-xl border px-3 text-base font-black ${xp === value ? 'border-amber-300 bg-amber-300 text-amber-950' : 'border-white/30 text-white hover:bg-white/10'}`}>
                        +{value}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-sm font-bold text-indigo-100">Oro para cada uno</legend>
                  <div className="flex gap-2">
                    {GP_PRESETS.map((value) => (
                      <button key={value} type="button" onClick={() => setGp(value)} aria-pressed={gp === value}
                        className={`min-h-[44px] min-w-[64px] rounded-xl border px-3 text-base font-black ${gp === value ? 'border-amber-300 bg-amber-300 text-amber-950' : 'border-white/30 text-white hover:bg-white/10'}`}>
                        {value === 0 ? 'Nada' : `+${value}`}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <p className="w-full text-sm text-indigo-100">XP y oro libres no cuentan para la nota.</p>
              </div>
            ) : positives.length === 0 ? (
              <p className="text-sm text-indigo-100">No hay comportamientos positivos en esta clase.</p>
            ) : (
              <div>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Comportamiento">
                  {positives.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      role="radio"
                      aria-checked={behaviorId === b.id}
                      onClick={() => setBehaviorId(b.id)}
                      className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-left text-sm font-bold ${behaviorId === b.id ? 'border-emerald-300 bg-emerald-300 text-emerald-950' : 'border-white/30 text-white hover:bg-white/10'}`}
                    >
                      <span aria-hidden="true">{b.icon || '⭐'}</span>
                      {b.name}
                      <span className="text-xs font-semibold opacity-90">
                        {[b.xpValue > 0 ? `+${b.xpValue} XP` : null, b.gpValue > 0 ? `+${b.gpValue} oro` : null, b.hpValue > 0 ? `+${b.hpValue} HP` : null].filter(Boolean).join(' · ')}
                      </span>
                      {b.competency && (
                        <span className={`rounded-md px-1.5 py-0.5 text-xs ${behaviorId === b.id ? 'bg-emerald-950/15' : 'bg-white/15'}`}>
                          Nota: {b.competency.shortName || b.competency.name}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {selectedBehavior?.competency ? (
                  <p className="mt-2 rounded-xl bg-amber-300/15 px-3 py-2 text-sm font-semibold text-amber-100" role="status">
                    Cuenta para la nota de {presence.presentIds.size} alumnos en {selectedBehavior.competency.shortName || selectedBehavior.competency.name}.
                  </p>
                ) : allowGradeBehaviors ? (
                  <p className="mt-2 text-sm text-indigo-100">Solo los que dicen «Nota» cuentan para la nota.</p>
                ) : null}
              </div>
            )}

            <button type="button" onClick={() => reward.mutate()} disabled={!canReward || reward.isPending} className={`${stagePrimaryClass} min-h-[52px] px-6 text-base`}>
              {reward.isPending ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Gift size={20} aria-hidden="true" />}
              Entregar {pendingSummary} a {presence.presentIds.size} presentes
            </button>
            {session.expeditionStopId && (
              <p className="text-sm text-indigo-100">Al entregarla, la parada de la expedición queda lograda para los presentes (sin pagarla otra vez).</p>
            )}
          </div>
        )}
      </section>

      <div className="flex flex-wrap justify-center gap-3">
        {onPlayAgain && (
          <button type="button" onClick={onPlayAgain} className={`${stageControlClass} border border-white/30 px-5 text-base`}>
            <RotateCcw size={18} aria-hidden="true" /> Jugar otra vez
          </button>
        )}
        <button type="button" onClick={onExit} className={`${stagePrimaryClass} px-6 text-base`}>
          {exitLabel}
        </button>
      </div>
    </div>
  );
};
