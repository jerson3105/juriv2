import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Maximize2, Minimize2, Pause, Play, RotateCcw, Timer, Volume2, VolumeX, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useSound } from '../../hooks/useSound';
import { TIMER_PRESETS_MINUTES } from '../../lib/timerPresets';

export type FloatingClockMode = 'timer' | 'stopwatch';

interface FloatingClockWidgetProps {
  mode: FloatingClockMode;
  initialDurationSeconds?: number;
  autoStart?: boolean;
  onClose: () => void;
}

const MUTE_KEY = 'juried:timer-muted';

const pad = (value: number) => value.toString().padStart(2, '0');

const formatClock = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};

const readMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

// Temporizador / cronómetro flotante. El tiempo se calcula con la hora de fin (o de inicio), no
// contando ticks: no se atrasa aunque la pestaña quede en segundo plano.
export const FloatingClockWidget = ({
  mode,
  initialDurationSeconds = 300,
  autoStart = false,
  onClose,
}: FloatingClockWidgetProps) => {
  const { play } = useSound();
  const [durationSec, setDurationSec] = useState(Math.max(10, initialDurationSeconds));
  const [isRunning, setIsRunning] = useState(false);
  // Temporizador: hora de fin mientras corre; segundos restantes mientras está pausado.
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState(Math.max(10, initialDurationSeconds));
  // Cronómetro: hora de inicio del tramo actual + milisegundos acumulados.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [accumulatedMs, setAccumulatedMs] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);
  const [muted, setMuted] = useState(readMuted);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const soundedRef = useRef(false);

  const startTimer = useCallback((seconds: number) => {
    const safe = Math.max(10, Math.round(seconds));
    setDurationSec(safe);
    setRemainingSec(safe);
    setEndAt(Date.now() + safe * 1000);
    setIsRunning(true);
    setFinished(false);
    soundedRef.current = false;
  }, []);

  useEffect(() => {
    if (mode === 'timer' && autoStart) startTimer(initialDurationSeconds);
    // Solo al montar: reabrir el widget lo vuelve a montar (key en TimerContext).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [isRunning]);

  const timeLeft = mode === 'timer'
    ? (isRunning && endAt ? Math.max(0, Math.ceil((endAt - now) / 1000)) : remainingSec)
    : 0;
  const elapsed = mode === 'stopwatch'
    ? Math.floor((accumulatedMs + (isRunning && startedAt ? now - startedAt : 0)) / 1000)
    : 0;

  // Fin del temporizador: aviso visual y sonido (una vez).
  useEffect(() => {
    if (mode !== 'timer' || !isRunning || timeLeft > 0) return;
    setIsRunning(false);
    setEndAt(null);
    setRemainingSec(0);
    setFinished(true);
    if (!soundedRef.current) {
      soundedRef.current = true;
      if (!muted) play('timerEnd');
    }
  }, [mode, isRunning, timeLeft, muted, play]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  const toggleRun = () => {
    if (mode === 'timer') {
      if (isRunning) {
        setRemainingSec(timeLeft);
        setEndAt(null);
        setIsRunning(false);
      } else {
        const base = finished || remainingSec <= 0 ? durationSec : remainingSec;
        setFinished(false);
        soundedRef.current = false;
        setRemainingSec(base);
        setEndAt(Date.now() + base * 1000);
        setIsRunning(true);
      }
    } else if (isRunning) {
      setAccumulatedMs((ms) => ms + (startedAt ? Date.now() - startedAt : 0));
      setStartedAt(null);
      setIsRunning(false);
    } else {
      setStartedAt(Date.now());
      setIsRunning(true);
    }
    setNow(Date.now());
  };

  const resetClock = () => {
    setIsRunning(false);
    setFinished(false);
    soundedRef.current = false;
    if (mode === 'timer') {
      setEndAt(null);
      setRemainingSec(durationSec);
    } else {
      setStartedAt(null);
      setAccumulatedMs(0);
    }
  };

  const toggleMuted = () => {
    setMuted((current) => {
      const next = !current;
      try {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      } catch {
        // Ignorar: vale para esta sesión.
      }
      return next;
    });
  };

  const startCustom = () => {
    const minutes = Number(customMinutes.replace(',', '.'));
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    startTimer(Math.min(180, minutes) * 60);
    setCustomMinutes('');
  };

  const displayValue = mode === 'timer' ? timeLeft : elapsed;
  const progress = mode === 'timer' && durationSec > 0 ? Math.min(100, ((durationSec - timeLeft) / durationSec) * 100) : 0;
  const urgent = mode === 'timer' && isRunning && timeLeft <= 10;
  const statusText = mode === 'timer'
    ? finished ? '¡Tiempo!' : isRunning ? 'Corriendo' : 'En pausa'
    : isRunning ? 'Corriendo' : 'En pausa';
  const title = mode === 'timer' ? 'Temporizador' : 'Cronómetro';

  const controls = (large: boolean) => (
    <div className={`grid grid-cols-3 gap-2 ${large ? 'w-full max-w-xl' : ''}`}>
      <button
        type="button"
        onClick={toggleRun}
        className={`flex items-center justify-center gap-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold ${large ? 'min-h-[56px] text-lg' : 'min-h-[44px] text-sm'}`}
      >
        {isRunning ? <Pause size={large ? 22 : 16} aria-hidden="true" /> : <Play size={large ? 22 : 16} aria-hidden="true" />}
        {isRunning ? 'Pausar' : finished ? 'Repetir' : 'Iniciar'}
      </button>
      <button
        type="button"
        onClick={resetClock}
        className={`flex items-center justify-center gap-1.5 rounded-xl font-semibold ${large ? 'min-h-[56px] text-lg bg-white/15 hover:bg-white/25 text-white' : 'min-h-[44px] text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
      >
        <RotateCcw size={large ? 22 : 16} aria-hidden="true" />
        Reiniciar
      </button>
      {large ? (
        <button
          type="button"
          onClick={() => setIsFullscreen(false)}
          className="flex items-center justify-center gap-1.5 rounded-xl min-h-[56px] text-lg font-semibold bg-white/15 hover:bg-white/25 text-white"
        >
          <Minimize2 size={22} aria-hidden="true" />
          Salir
        </button>
      ) : (
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 rounded-xl min-h-[44px] text-sm font-semibold bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50"
        >
          <X size={16} aria-hidden="true" />
          Cerrar
        </button>
      )}
    </div>
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 70, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 70, scale: 0.9 }}
        drag
        dragMomentum={false}
        className="fixed right-6 bottom-6 z-[120]"
        role="region"
        aria-label={title}
      >
        <div className={`w-[320px] overflow-hidden rounded-2xl border bg-white dark:bg-gray-800 shadow-2xl ${finished ? 'border-red-500 ring-4 ring-red-500/40' : 'border-gray-200 dark:border-gray-700'}`}>
          <div className={`flex items-center gap-2 px-3 py-2.5 text-white ${finished ? 'bg-red-600' : 'bg-primary-700'}`}>
            {mode === 'timer' ? <Timer size={18} aria-hidden="true" /> : <Clock size={18} aria-hidden="true" />}
            <span className="flex-1 font-semibold truncate">{title}</span>
            <span className={`font-mono text-lg font-bold tabular-nums ${urgent ? 'motion-safe:animate-pulse' : ''}`}>{formatClock(displayValue)}</span>
            <button type="button" onClick={toggleMuted} aria-label={muted ? 'Activar sonido' : 'Silenciar'} title={muted ? 'Activar sonido' : 'Silenciar'} className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg hover:bg-white/15">
              {muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => setIsFullscreen(true)} aria-label="Pantalla completa" title="Pantalla completa" className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg hover:bg-white/15">
              <Maximize2 size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setIsExpanded((v) => !v)} aria-label={isExpanded ? 'Contraer' : 'Expandir'} aria-expanded={isExpanded} className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg hover:bg-white/15">
              {isExpanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronUp size={16} aria-hidden="true" />}
            </button>
          </div>

          {isExpanded && (
            <div className="p-4 space-y-3">
              {mode === 'timer' && (
                <>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Minutos rápidos">
                    {TIMER_PRESETS_MINUTES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => startTimer(m * 60)}
                        className={`min-h-[36px] min-w-[44px] px-2 rounded-lg text-sm font-semibold border ${durationSec === m * 60 ? 'border-primary-500 bg-primary-50 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      >
                        {m} min
                      </button>
                    ))}
                  </div>
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      startCustom();
                    }}
                  >
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0.1}
                      max={180}
                      step="any"
                      value={customMinutes}
                      onChange={(event) => setCustomMinutes(event.target.value)}
                      placeholder="Otros minutos"
                      aria-label="Minutos personalizados"
                      className="flex-1 min-w-0 min-h-[36px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                    />
                    <button type="submit" className="min-h-[36px] px-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold">
                      Empezar
                    </button>
                  </form>
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden" aria-hidden="true">
                    <div className={`h-full ${finished ? 'bg-red-500' : 'bg-primary-500'}`} style={{ width: `${progress}%` }} />
                  </div>
                </>
              )}

              <div className="text-center" aria-live="polite">
                <p className={`text-5xl font-mono font-bold tabular-nums ${finished || urgent ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                  {formatClock(displayValue)}
                </p>
                <p className={`mt-1 text-sm font-semibold ${finished ? 'text-red-700 dark:text-red-300 text-lg' : 'text-gray-600 dark:text-gray-300'}`}>{statusText}</p>
              </div>

              {controls(false)}
            </div>
          )}
        </div>
      </motion.div>

      {/* Pantalla completa para proyectar */}
      {isFullscreen && (
        <div
          className={`fixed inset-0 z-[130] flex flex-col items-center justify-center gap-8 p-6 ${finished ? 'bg-red-700' : 'bg-gray-950'}`}
          role="dialog"
          aria-modal="true"
          aria-label={`${title} en pantalla completa`}
        >
          <p className="text-2xl font-semibold uppercase tracking-widest text-white/80">{title}</p>
          <p className={`font-mono font-bold tabular-nums leading-none text-white text-[22vw] ${urgent ? 'motion-safe:animate-pulse text-red-300' : ''}`} aria-live="polite">
            {formatClock(displayValue)}
          </p>
          {finished && <p className="text-5xl font-black text-white">¡Tiempo!</p>}
          {mode === 'timer' && (
            <div className="h-3 w-full max-w-3xl rounded-full bg-white/20 overflow-hidden" aria-hidden="true">
              <div className="h-full bg-white" style={{ width: `${progress}%` }} />
            </div>
          )}
          {controls(true)}
          <p className="text-sm text-white/70">Esc para salir de pantalla completa</p>
        </div>
      )}
    </>
  );
};
