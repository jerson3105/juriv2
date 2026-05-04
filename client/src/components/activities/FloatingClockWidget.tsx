import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Minus, Pause, Play, Plus, RotateCcw, X } from 'lucide-react';

export type FloatingClockMode = 'timer' | 'stopwatch';

interface FloatingClockWidgetProps {
  mode: FloatingClockMode;
  initialDurationSeconds?: number;
  onClose: () => void;
}

const pad = (value: number) => value.toString().padStart(2, '0');

const formatClock = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
};

export const FloatingClockWidget = ({
  mode,
  initialDurationSeconds = 300,
  onClose,
}: FloatingClockWidgetProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(Math.max(10, initialDurationSeconds));
  const [timeLeft, setTimeLeft] = useState(Math.max(10, initialDurationSeconds));
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setIsRunning(false);
    setTimerSeconds(Math.max(10, initialDurationSeconds));
    setTimeLeft(Math.max(10, initialDurationSeconds));
    setElapsed(0);
  }, [mode, initialDurationSeconds]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (mode === 'timer') {
        setTimeLeft((current) => {
          if (current <= 1) {
            setIsRunning(false);
            return 0;
          }
          return current - 1;
        });
      } else {
        setElapsed((current) => current + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, mode]);

  const title = mode === 'timer' ? 'Temporizador' : 'Cronometro';
  const subtitle = mode === 'timer' ? 'Cuenta regresiva flotante' : 'Conteo progresivo flotante';
  const displayValue = mode === 'timer' ? timeLeft : elapsed;

  const progress = useMemo(() => {
    if (mode !== 'timer' || timerSeconds <= 0) return 0;
    return Math.min(100, ((timerSeconds - timeLeft) / timerSeconds) * 100);
  }, [mode, timerSeconds, timeLeft]);

  const adjustTimerMinutes = (deltaMinutes: number) => {
    if (mode !== 'timer') return;

    const nextDuration = Math.max(10, timerSeconds + deltaMinutes * 60);
    setTimerSeconds(nextDuration);

    if (!isRunning) {
      setTimeLeft(nextDuration);
    }
  };

  const resetClock = () => {
    setIsRunning(false);
    if (mode === 'timer') {
      setTimeLeft(timerSeconds);
    } else {
      setElapsed(0);
    }
  };

  const urgencyClass = mode === 'timer' && timeLeft <= 30
    ? 'text-red-500'
    : 'text-indigo-600 dark:text-indigo-300';

  return (
    <motion.div
      initial={{ opacity: 0, y: 70, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 70, scale: 0.9 }}
      drag
      dragMomentum={false}
      className="fixed right-6 bottom-6 z-[120]"
    >
      <div className="w-[320px] overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
        <button
          onClick={() => setIsExpanded((current) => !current)}
          className="w-full px-4 py-3 text-left bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Clock size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{title}</p>
              <p className="text-xs text-indigo-100 truncate">{subtitle}</p>
            </div>
            <div className={`font-mono text-xl font-bold ${mode === 'timer' && timeLeft <= 10 ? 'animate-pulse' : ''}`}>
              {formatClock(displayValue)}
            </div>
          </div>
        </button>

        {isExpanded && (
          <div className="p-4 space-y-4">
            {mode === 'timer' && (
              <div className="space-y-3">
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.35 }}
                  />
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => adjustTimerMinutes(-1)}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[90px] text-center">Ajustar minutos</span>
                  <button
                    onClick={() => adjustTimerMinutes(1)}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}

            <div className="text-center">
              <p className={`text-5xl font-mono font-bold tabular-nums ${urgencyClass}`}>
                {formatClock(displayValue)}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {mode === 'timer'
                  ? timeLeft === 0
                    ? 'Tiempo finalizado'
                    : isRunning
                      ? 'Corriendo'
                      : 'Pausado'
                  : isRunning
                    ? 'Corriendo'
                    : 'Pausado'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setIsRunning((current) => !current)}
                className="flex items-center justify-center gap-1 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 py-2.5 font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
              >
                {isRunning ? <Pause size={16} /> : <Play size={16} />}
                {isRunning ? 'Pausar' : 'Iniciar'}
              </button>
              <button
                onClick={resetClock}
                className="flex items-center justify-center gap-1 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <RotateCcw size={16} />
                Reiniciar
              </button>
              <button
                onClick={onClose}
                className="flex items-center justify-center gap-1 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 py-2.5 font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                <X size={16} />
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
