import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, Mic, MicOff, Pencil, Play } from 'lucide-react';
import { activityApi, activityKeys, type ActivitySession } from '../../../lib/activityApi';
import type { Classroom, Student } from '../../../lib/classroomApi';
import { isInitialLevel } from '../../energy/energyHelpers';
import { Bitacora } from '../Bitacora';
import { EscenarioObservatorio, stageControlClass } from '../EscenarioObservatorio';
import { StageEndButton } from '../StageEndButton';
import type { JiroPose } from '../jiroPoses';
import { useStageSound } from '../observatorioSound';
import { useActivitySession } from '../useActivitySession';
import { ConstellationSky } from './ConstellationSky';
import { CONSTELLATIONS, constellationById } from './constellations';
import { useNoiseMeter } from './useNoiseMeter';

type Phase = 'setup' | 'calibrating' | 'playing' | 'completed' | 'bitacora';
type Mode = 'mic' | 'manual';
type Sensitivity = 'suave' | 'normal' | 'estricta';

interface DescansoState {
  durationMin: number;
  constellationId: string;
  mode: Mode;
  sensitivity: Sensitivity;
  calmMs: number;
  noisePauses: number;
}

interface DescansoResult extends Record<string, unknown> {
  constellationId: string;
  constellationName: string;
  customName: string | null;
  completed: boolean;
  percent: number;
  starsLit: number;
  totalStars: number;
  calmSeconds: number;
  noisePauses: number;
  mode: Mode;
}

// Umbral = ruido de fondo calibrado × factor (más alto = más tolerante).
const SENSITIVITY: Record<Sensitivity, { factor: number; label: string }> = {
  suave: { factor: 2.6, label: 'Suave' },
  normal: { factor: 1.9, label: 'Normal' },
  estricta: { factor: 1.45, label: 'Estricta' },
};
const CALIBRATION_SECONDS = 10;
const TICK_MS = 200;

const formatTime = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const chip = (on: boolean) =>
  `min-h-[48px] rounded-xl border px-4 text-lg font-bold transition-colors ${on ? 'border-amber-300 bg-amber-300 text-amber-950' : 'border-white/30 text-white hover:bg-white/10'}`;

interface DescansoActivityProps {
  classroom: Classroom & { students?: Student[] };
  resume?: ActivitySession<unknown, unknown> | null;
  onExit: () => void;
}

/**
 * Descanso de Jiro: se calibra el ruido del aula y, mientras hay calma, Jiro sueña y dibuja una
 * constelación estrella por estrella. El ruido solo pausa el dibujo (nunca resta). Sin micrófono,
 * el docente pausa a mano. Al completarla, la clase la nombra y queda en el Cielo de Jiro.
 */
export const DescansoActivity = ({ classroom, resume, onExit }: DescansoActivityProps) => {
  const queryClient = useQueryClient();
  const students = useMemo(() => classroom.students ?? [], [classroom.students]);
  const initial = isInitialLevel(classroom.gradeLevel);
  const durations = initial ? [1, 2, 3] : [3, 5, 10];
  const options = initial ? CONSTELLATIONS.filter((c) => c.small) : CONSTELLATIONS;
  const saved = (resume?.status === 'ACTIVE' ? resume.state : null) as DescansoState | null;

  const soundState = useStageSound();
  const { sound } = soundState;
  const { start: startMeter, stop: stopMeter, levelRef, thresholdRef, setMeter } = useNoiseMeter();
  const {
    session, setSession, start: startGame, save: saveGame, flush: flushGame, finish: finishGame,
  } = useActivitySession<DescansoState, DescansoResult>(classroom.id, 'DESCANSO', resume as ActivitySession<DescansoState, DescansoResult> | null | undefined);

  const { data: album = [] } = useQuery({
    queryKey: activityKeys.album(classroom.id),
    queryFn: () => activityApi.album(classroom.id),
  });
  const done = new Set(album.map((a) => a.constellationId));
  const suggested = options.find((c) => !done.has(c.id)) ?? options[0];

  const [phase, setPhase] = useState<Phase>(resume?.status === 'FINISHED' ? 'bitacora' : 'setup');
  const [durationMin, setDurationMin] = useState(saved?.durationMin ?? durations[1]);
  const [chosenId, setChosenId] = useState<string | null>(saved?.constellationId ?? null);
  const [mode, setMode] = useState<Mode>(saved?.mode ?? 'mic');
  const [sensitivity, setSensitivity] = useState<Sensitivity>(saved?.sensitivity ?? 'normal');
  const [micNotice, setMicNotice] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const [customName, setCustomName] = useState('');
  const [calibrationLeft, setCalibrationLeft] = useState(CALIBRATION_SECONDS);
  const [view, setView] = useState({ lit: 0, noisy: false, calmMs: saved?.calmMs ?? 0, paused: false });

  const constellation = constellationById(chosenId) ?? suggested;
  const total = constellation.stars.length;
  const msPerStar = (durationMin * 60_000) / total;

  // Estado del juego en refs: el bucle corre a 5 Hz sin reiniciarse con cada render.
  const calmMs = useRef(saved?.calmMs ?? 0);
  const noisePauses = useRef(saved?.noisePauses ?? 0);
  const litRef = useRef(0);
  const noisy = useRef(false);
  const paused = useRef(false);
  const loudTicks = useRef(0);
  const quietTicks = useRef(0);
  const lastSave = useRef(0);
  const cfg = useRef({ durationMin, constellationId: constellation.id, mode, sensitivity, total, msPerStar });
  useEffect(() => {
    cfg.current = { durationMin, constellationId: constellation.id, mode, sensitivity, total, msPerStar };
  });

  const snapshot = (): DescansoState => ({
    durationMin, constellationId: constellation.id, mode, sensitivity, calmMs: calmMs.current, noisePauses: noisePauses.current,
  });

  const percent = Math.round((Math.min(view.lit, total) / total) * 100);

  const finish = async (completed: boolean, name: string | null) => {
    stopMeter();
    const lit = Math.min(total, Math.floor(calmMs.current / msPerStar));
    const result: DescansoResult = {
      constellationId: constellation.id,
      constellationName: constellation.name,
      customName: completed ? name : null,
      completed,
      percent: Math.round((lit / total) * 100),
      starsLit: lit,
      totalStars: total,
      calmSeconds: Math.round(calmMs.current / 1000),
      noisePauses: noisePauses.current,
      mode,
    };
    try {
      await finishGame(result, snapshot());
      void queryClient.invalidateQueries({ queryKey: activityKeys.album(classroom.id) });
      setPhase('bitacora');
    } catch {
      toast.error('No se pudo guardar la partida. Revisa la conexión e inténtalo de nuevo.');
    }
  };

  // Bucle de juego (5 Hz): calma suma, ruido pausa (con histéresis para no parpadear).
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => {
      const c = cfg.current;
      const level = levelRef.current;
      const threshold = thresholdRef.current;
      const loud = c.mode === 'mic' && level > threshold;
      if (loud) { loudTicks.current += 1; quietTicks.current = 0; } else { quietTicks.current += 1; loudTicks.current = 0; }
      if (!noisy.current && loudTicks.current >= 2) {
        noisy.current = true;
        noisePauses.current += 1;
        sound.soft();
      } else if (noisy.current && quietTicks.current >= 5) {
        noisy.current = false;
      }
      if (!noisy.current && !paused.current) calmMs.current += TICK_MS;
      const lit = Math.min(c.total, Math.floor(calmMs.current / c.msPerStar));
      if (lit > litRef.current) {
        litRef.current = lit;
        sound.star(lit - 1);
      }
      setView({ lit, noisy: noisy.current, calmMs: calmMs.current, paused: paused.current });
      if (Date.now() - lastSave.current > 5000) {
        lastSave.current = Date.now();
        saveGame({
          durationMin: c.durationMin, constellationId: c.constellationId, mode: c.mode, sensitivity: c.sensitivity,
          calmMs: calmMs.current, noisePauses: noisePauses.current,
        });
      }
      if (lit >= c.total) {
        stopMeter();
        sound.success();
        void flushGame();
        setPhase('completed');
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, levelRef, thresholdRef, stopMeter, sound, saveGame, flushGame]);

  // Calibración: 10 s escuchando el aula; el umbral sale del ruido de fondo típico.
  useEffect(() => {
    if (phase !== 'calibrating') return;
    const samples: number[] = [];
    const started = Date.now();
    const id = window.setInterval(() => {
      samples.push(levelRef.current);
      const left = Math.max(0, CALIBRATION_SECONDS - Math.floor((Date.now() - started) / 1000));
      setCalibrationLeft(left);
      if (left === 0) {
        const sorted = [...samples].sort((a, b) => a - b);
        const baseline = sorted[Math.floor(sorted.length * 0.6)] ?? 0.01;
        thresholdRef.current = Math.max(0.012, baseline * SENSITIVITY[cfg.current.sensitivity].factor + 0.004);
        sound.tick();
        setPhase('playing');
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, levelRef, thresholdRef, sound]);

  const begin = async () => {
    sound.unlock();
    try {
      if (!session || session.status !== 'ACTIVE') {
        calmMs.current = 0;
        noisePauses.current = 0;
        await startGame(snapshot(), constellation.name);
      }
    } catch {
      toast.error('No se pudo empezar la partida. Revisa la conexión.');
      return;
    }
    litRef.current = Math.min(total, Math.floor(calmMs.current / msPerStar));
    setView((v) => ({ ...v, calmMs: calmMs.current, lit: litRef.current }));
    if (mode === 'mic') {
      if (await startMeter()) {
        setCalibrationLeft(CALIBRATION_SECONDS);
        setPhase('calibrating');
        return;
      }
      setMode('manual');
      setMicNotice(true);
    }
    setPhase('playing');
  };

  const togglePause = () => {
    paused.current = !paused.current;
    setView((v) => ({ ...v, paused: paused.current }));
  };

  const exit = () => {
    stopMeter();
    if (phase === 'playing' || phase === 'calibrating') saveGame(snapshot());
    onExit();
  };

  const playAgain = () => {
    calmMs.current = 0;
    noisePauses.current = 0;
    litRef.current = 0;
    setSession(null);
    setChosenId(null);
    setCustomName('');
    setView({ lit: 0, noisy: false, calmMs: 0, paused: false });
    setPhase('setup');
  };

  const rename = useMutation({
    mutationFn: ({ sessionId, name }: { sessionId: string; name: string | null }) => activityApi.renameConstellation(sessionId, name),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: activityKeys.album(classroom.id) }),
    onError: () => toast.error('No se pudo guardar el nombre'),
  });

  // ── Jiro y barra del docente según la fase ──
  const jiro: { pose: JiroPose; line: string | null; placement: 'center' | 'corner' } = (() => {
    switch (phase) {
      case 'setup': return { pose: 'despertando', line: saved ? '¿Seguimos donde nos quedamos?' : `¡Shh! Si hay calma, soñaré con ${constellation.name}.`, placement: 'corner' };
      case 'calibrating': return { pose: 'despertando', line: `Escucho el silencio del aula… ${calibrationLeft}`, placement: 'center' };
      case 'playing':
        if (view.paused) return { pose: 'dormido', line: 'Pausa', placement: 'center' };
        // El ruido fuerte no tiene una reacción especial: así no vale la pena gritar para verla.
        if (view.noisy) return { pose: 'despertando', line: 'Shh… ¡casi me despierto!', placement: 'center' };
        return { pose: 'dormido', line: null, placement: 'center' };
      case 'completed': return { pose: 'celebrando', line: constellation.fact, placement: 'center' };
      default: {
        const result = session?.result;
        return { pose: 'celebrando', line: result?.completed ? `¡${result.customName || result.constellationName} ya brilla en el Cielo de Jiro!` : `¡Encendimos ${result?.starsLit ?? 0} estrellas!`, placement: 'corner' };
      }
    }
  })();

  const primary = phase === 'setup'
    ? { label: saved ? 'Continuar' : 'Empezar', onClick: () => void begin() }
    : phase === 'playing'
      ? { label: view.paused ? 'Seguir' : 'Pausar', onClick: togglePause }
      : phase === 'completed'
        ? { label: 'Guardar en el Cielo de Jiro', onClick: () => void finish(true, customName.trim() || null) }
        : null;

  const result = session?.result;

  return (
    <EscenarioObservatorio
      label="Descanso de Jiro"
      onClose={exit}
      jiro={jiro}
      primary={primary}
      soundState={soundState}
      status={phase === 'playing' ? `${view.lit}/${total} ⭐ · ${formatTime(view.calmMs)} de calma` : undefined}
      barExtra={phase === 'playing' ? <StageEndButton onEnd={() => void finish(false, null)} /> : undefined}
    >
      {phase === 'setup' && (
        <div className="flex w-full max-w-5xl flex-col gap-5">
          <h1 className="stage-title text-center font-black">Descanso de Jiro</h1>
          {saved && (
            <p className="text-center text-xl text-indigo-100">
              Llevamos {Math.min(total, Math.floor(saved.calmMs / msPerStar))} de {total} estrellas de {constellation.name}.
            </p>
          )}
          {!saved && (
            <>
              <fieldset>
                <legend className="mb-2 text-lg font-bold text-indigo-100">Minutos de calma</legend>
                <div className="flex flex-wrap gap-2">
                  {durations.map((d) => (
                    <button key={d} type="button" onClick={() => setDurationMin(d)} aria-pressed={durationMin === d} className={chip(durationMin === d)}>{d} min</button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-lg font-bold text-indigo-100">Constelación</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {options.map((c) => {
                    const on = c.id === constellation.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setChosenId(c.id)}
                        aria-pressed={on}
                        className={`flex flex-col items-center rounded-2xl border-2 p-2 text-base font-bold ${on ? 'border-amber-300 bg-amber-300/15' : 'border-white/15 hover:bg-white/5'}`}
                      >
                        <ConstellationSky constellation={c} lit={c.stars.length} still className="h-16 w-full" label="" />
                        <span className="mt-1 text-white">{c.name}</span>
                        <span className="text-sm font-semibold text-indigo-200">{c.stars.length} estrellas{done.has(c.id) ? ' · ✓ en el Cielo' : ''}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}
          <div className="flex flex-wrap gap-6">
            <fieldset>
              <legend className="mb-2 text-lg font-bold text-indigo-100">Cómo escucha Jiro</legend>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setMode('mic')} aria-pressed={mode === 'mic'} className={`${chip(mode === 'mic')} inline-flex items-center gap-2`}>
                  <Mic size={20} aria-hidden="true" /> Micrófono
                </button>
                <button type="button" onClick={() => setMode('manual')} aria-pressed={mode === 'manual'} className={`${chip(mode === 'manual')} inline-flex items-center gap-2`}>
                  <MicOff size={20} aria-hidden="true" /> Manual
                </button>
              </div>
            </fieldset>
            {mode === 'mic' && (
              <fieldset>
                <legend className="mb-2 text-lg font-bold text-indigo-100">Sensibilidad</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(SENSITIVITY) as Sensitivity[]).map((s) => (
                    <button key={s} type="button" onClick={() => setSensitivity(s)} aria-pressed={sensitivity === s} className={chip(sensitivity === s)}>{SENSITIVITY[s].label}</button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
          <p className="text-base text-indigo-100">
            {mode === 'mic'
              ? 'Primero Jiro escucha 10 segundos el silencio del aula. El ruido solo pausa el dibujo: nunca se pierden estrellas.'
              : 'Sin micrófono: pulsa Pausar (Espacio) cuando haya ruido y Seguir cuando vuelva la calma.'}
          </p>

          {album.length > 0 && (
            <section aria-labelledby="cielo-title">
              <button type="button" id="cielo-title" onClick={() => setShowAlbum((v) => !v)} aria-expanded={showAlbum} className={`${stageControlClass} border border-white/25`}>
                ✨ Cielo de Jiro ({album.length})
              </button>
              {showAlbum && (
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {album.map((entry) => {
                    const c = constellationById(entry.constellationId);
                    if (!c) return null;
                    return (
                      <li key={entry.sessionId} className="rounded-2xl border border-white/15 bg-white/5 p-2 text-center">
                        <ConstellationSky constellation={c} lit={c.stars.length} still className="h-16 w-full" />
                        <p className="mt-1 text-base font-bold text-white">{entry.customName || c.name}</p>
                        {entry.customName && <p className="text-xs text-indigo-200">{c.name}</p>}
                        <button
                          type="button"
                          onClick={() => {
                            const name = window.prompt(`¿Cómo llamamos a ${c.name}?`, entry.customName ?? '');
                            if (name !== null) rename.mutate({ sessionId: entry.sessionId, name: name.trim().slice(0, 60) || null });
                          }}
                          className="mt-1 inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-indigo-100 hover:bg-white/10"
                        >
                          <Pencil size={14} aria-hidden="true" /> Nombrar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {(phase === 'calibrating' || phase === 'playing') && (
        <div className="flex w-full max-w-4xl flex-col items-center gap-3">
          {micNotice && (
            <p className="rounded-xl bg-white/10 px-4 py-2 text-base text-indigo-50" role="status">
              No pudimos usar el micrófono: jugamos en modo manual (Espacio pausa).
            </p>
          )}
          <ConstellationSky
            constellation={constellation}
            lit={phase === 'playing' ? view.lit : 0}
            charging={phase === 'playing' && !view.noisy && !view.paused ? (view.calmMs % msPerStar) / msPerStar : 0}
            className="h-[40vh] w-full max-w-4xl"
          />
          <p className="stage-body font-bold text-amber-100" aria-live="polite">
            {phase === 'calibrating' ? 'Silencio…' : `${view.lit} de ${total} estrellas`}
          </p>
          {mode === 'mic' && (
            <div className="flex w-full max-w-md items-center gap-3" aria-hidden="true">
              <span className="text-sm font-bold text-indigo-100">Ruido</span>
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/10">
                <div ref={setMeter} className={`h-full w-full origin-left rounded-full ${view.noisy ? 'bg-rose-300' : 'bg-emerald-300'}`} style={{ transform: 'scaleX(0)' }} />
                <span className="absolute inset-y-0 left-1/2 w-0.5 bg-white/60" />
              </div>
            </div>
          )}
          {phase === 'playing' && view.paused && (
            <button type="button" onClick={togglePause} className={`${stageControlClass} border border-white/30 text-lg`}>
              <Play size={20} aria-hidden="true" /> Seguir
            </button>
          )}
        </div>
      )}

      {phase === 'completed' && (
        <div className="flex w-full max-w-3xl flex-col items-center gap-4">
          <ConstellationSky constellation={constellation} lit={total} className="h-[26vh] w-full" />
          <h2 className="stage-title text-center font-black text-amber-100">¡Completamos {constellation.name}!</h2>
          <label className="flex w-full max-w-xl flex-col gap-2 text-lg font-bold text-indigo-100">
            ¿Cómo la llama la clase? (opcional)
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value.slice(0, 60))}
              placeholder={constellation.name}
              className="min-h-[56px] rounded-xl border border-white/30 bg-white/10 px-4 text-xl text-white placeholder:text-indigo-200"
            />
          </label>
          <button type="button" onClick={() => void finish(true, customName.trim() || null)} className="inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-amber-300 px-6 text-lg font-black text-amber-950 hover:bg-amber-200">
            <Check size={20} aria-hidden="true" /> Guardar en el Cielo de Jiro
          </button>
        </div>
      )}

      {phase === 'bitacora' && session && (
        <Bitacora
          session={session}
          classroomId={classroom.id}
          students={students}
          showCharacterName={classroom.showCharacterName}
          achievements={[
            { icon: '⭐', label: 'estrellas encendidas', value: `${result?.starsLit ?? 0}/${result?.totalStars ?? total}` },
            { icon: '🌙', label: 'de calma', value: formatTime((result?.calmSeconds ?? 0) * 1000) },
            ...(result?.completed ? [{ icon: '✨', label: 'nueva constelación', value: result.customName || result.constellationName }] : []),
          ]}
          suggestedXp={(result?.percent ?? percent) >= 100 ? 20 : (result?.percent ?? percent) >= 60 ? 15 : 10}
          activityName="Descanso de Jiro"
          allowGradeBehaviors={false}
          onSessionChange={(s) => setSession(s as ActivitySession<DescansoState, DescansoResult>)}
          onPlayAgain={playAgain}
          onExit={onExit}
        />
      )}
    </EscenarioObservatorio>
  );
};
