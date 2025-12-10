import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, Check, X } from 'lucide-react';
import type { EventEffect } from '../../lib/eventsApi';

interface TimerWidgetProps {
  eventName: string;
  eventIcon: string;
  durationMinutes: number;
  effects: EventEffect[];
  selectedStudents: { id: string; name: string }[];
  onComplete: (completed: boolean) => void;
  onCancel: () => void;
}

export const TimerWidget = ({
  eventName,
  eventIcon,
  durationMinutes,
  effects,
  selectedStudents,
  onComplete,
  onCancel,
}: TimerWidgetProps) => {
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60); // en segundos
  const [isRunning, setIsRunning] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  // Temporizador
  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  // Formatear tiempo
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Calcular progreso
  const progress = ((durationMinutes * 60 - timeLeft) / (durationMinutes * 60)) * 100;

  // Color según tiempo restante
  const getTimeColor = () => {
    if (timeLeft <= 10) return 'text-red-500';
    if (timeLeft <= 30) return 'text-orange-500';
    return 'text-emerald-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 100, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 100, scale: 0.8 }}
      drag
      dragMomentum={false}
      className="fixed bottom-6 right-6 z-[110]"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header - siempre visible */}
        <div 
          className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="text-2xl">{eventIcon}</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{eventName}</p>
            <p className="text-xs text-indigo-200">
              {selectedStudents.map(s => s.name).join(', ')}
            </p>
          </div>
          <div className={`text-2xl font-mono font-bold ${timeLeft <= 10 ? 'animate-pulse' : ''}`}>
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Contenido expandible */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4">
                {/* Barra de progreso */}
                <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                {/* Tiempo grande */}
                <div className="text-center">
                  <div className={`text-5xl font-mono font-bold ${getTimeColor()}`}>
                    {formatTime(timeLeft)}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {timeLeft === 0 ? '¡Tiempo terminado!' : isRunning ? 'En curso...' : 'Pausado'}
                  </p>
                </div>

                {/* Efectos */}
                <div className="flex items-center justify-center gap-3 text-sm">
                  {effects.map((effect, i) => (
                    <span 
                      key={i} 
                      className={`px-2 py-1 rounded ${
                        effect.action === 'ADD' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {effect.action === 'ADD' ? '+' : '-'}{effect.value} {effect.type}
                    </span>
                  ))}
                </div>

                {/* Controles */}
                <div className="flex items-center justify-center gap-2">
                  {/* Play/Pause */}
                  <button
                    onClick={() => setIsRunning(!isRunning)}
                    disabled={timeLeft === 0}
                    className={`p-3 rounded-full transition-colors ${
                      isRunning 
                        ? 'bg-orange-100 text-orange-600 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400' 
                        : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                    } disabled:opacity-50`}
                  >
                    {isRunning ? <Pause size={20} /> : <Play size={20} />}
                  </button>

                  {/* Detener */}
                  <button
                    onClick={() => {
                      setIsRunning(false);
                      setTimeLeft(0);
                    }}
                    className="p-3 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400"
                  >
                    <Square size={20} />
                  </button>
                </div>

                {/* Botones de decisión */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => onComplete(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
                  >
                    <X size={18} />
                    No cumplió
                  </button>
                  <button
                    onClick={() => onComplete(true)}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
                  >
                    <Check size={18} />
                    Cumplió
                  </button>
                </div>

                {/* Cancelar */}
                <button
                  onClick={onCancel}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Cancelar evento
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mini vista cuando está colapsado */}
        {!isExpanded && (
          <div className="px-4 py-2 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRunning(!isRunning);
                }}
                className="p-1.5 rounded-full bg-gray-200 dark:bg-gray-600"
              >
                {isRunning ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <span className="text-xs text-gray-500">
                {selectedStudents[0]?.name}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete(false);
                }}
                className="p-1.5 rounded bg-red-100 text-red-600 dark:bg-red-900/30"
              >
                <X size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete(true);
                }}
                className="p-1.5 rounded bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
              >
                <Check size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
