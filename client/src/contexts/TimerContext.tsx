import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TimerWidget } from '../components/activities/TimerWidget';
import { eventsApi } from '../lib/eventsApi';
import type { EventEffect } from '../lib/eventsApi';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Clock, Play, X, Zap, Heart, Coins } from 'lucide-react';

// Datos para el temporizador
interface TimerData {
  classroomId: string;
  eventName: string;
  eventIcon: string;
  durationMinutes: number;
  effects: EventEffect[];
  selectedStudents: { id: string; name: string }[];
}

interface TimerContextType {
  timerData: TimerData | null;
  pendingTimer: TimerData | null;
  prepareTimer: (data: TimerData) => void;
  startTimer: () => void;
  stopTimer: () => void;
  cancelPending: () => void;
}

const TimerContext = createContext<TimerContextType | null>(null);

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within TimerProvider');
  }
  return context;
};

interface TimerProviderProps {
  children: ReactNode;
}

// Helper para iconos de efectos
const getEffectIcon = (type: string) => {
  switch (type) {
    case 'XP': return <Zap className="text-emerald-500" size={18} />;
    case 'HP': return <Heart className="text-red-500" size={18} />;
    case 'GP': return <Coins className="text-amber-500" size={18} />;
    default: return null;
  }
};

export const TimerProvider = ({ children }: TimerProviderProps) => {
  const [pendingTimer, setPendingTimer] = useState<TimerData | null>(null);
  const [timerData, setTimerData] = useState<TimerData | null>(null);
  const queryClient = useQueryClient();

  // Preparar temporizador (mostrar modal de vista previa)
  const prepareTimer = (data: TimerData) => {
    setPendingTimer(data);
  };

  // Iniciar temporizador (desde el modal de vista previa)
  const startTimer = () => {
    if (pendingTimer) {
      setTimerData(pendingTimer);
      setPendingTimer(null);
    }
  };

  const stopTimer = () => {
    setTimerData(null);
  };

  const cancelPending = () => {
    setPendingTimer(null);
  };

  // Resolver temporizador
  const handleResolveTimer = async (completed: boolean) => {
    if (!timerData) return;
    
    try {
      const result = await eventsApi.resolveChallenge(timerData.classroomId, {
        studentIds: timerData.selectedStudents.map(s => s.id),
        effects: timerData.effects,
        completed,
        eventName: timerData.eventName,
      });
      
      if (result.success) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ['classroom'] });
        queryClient.invalidateQueries({ queryKey: ['event-logs'] });
      }
      setTimerData(null);
    } catch (error) {
      toast.error('Error al resolver evento');
    }
  };

  return (
    <TimerContext.Provider value={{ timerData, pendingTimer, prepareTimer, startTimer, stopTimer, cancelPending }}>
      {children}
      
      {/* Modal de Vista Previa del Temporizador */}
      <AnimatePresence>
        {pendingTimer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[110]"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl"
            >
              {/* Header */}
              <div className="text-center mb-6">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                  className="text-6xl mb-4"
                >
                  {pendingTimer.eventIcon}
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {pendingTimer.eventName}
                </h2>
                <div className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Clock size={20} />
                  <span className="font-medium">{pendingTimer.durationMinutes} minutos</span>
                </div>
              </div>

              {/* Estudiantes seleccionados */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 mb-4">
                <h3 className="text-sm font-medium text-indigo-800 dark:text-indigo-300 mb-3 text-center">
                  🎯 Estudiante(s) seleccionado(s)
                </h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {pendingTimer.selectedStudents.map((student) => (
                    <span
                      key={student.id}
                      className="px-4 py-2 bg-white dark:bg-gray-700 rounded-lg shadow-md font-bold text-gray-900 dark:text-white"
                    >
                      {student.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Efectos */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-center">
                  Efectos del evento
                </h3>
                <div className="flex items-center justify-center gap-4">
                  {pendingTimer.effects.map((effect, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {getEffectIcon(effect.type)}
                      <span className={`font-bold ${effect.action === 'ADD' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {effect.action === 'ADD' ? '+' : '-'}{effect.value} {effect.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botones */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={cancelPending}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
                >
                  <X size={18} />
                  Cancelar
                </button>
                <button
                  onClick={startTimer}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-medium transition-colors"
                >
                  <Play size={18} />
                  Iniciar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Widget de Temporizador Activo */}
      {timerData && (
        <TimerWidget
          eventName={timerData.eventName}
          eventIcon={timerData.eventIcon}
          durationMinutes={timerData.durationMinutes}
          effects={timerData.effects}
          selectedStudents={timerData.selectedStudents}
          onComplete={handleResolveTimer}
          onCancel={() => setTimerData(null)}
        />
      )}
    </TimerContext.Provider>
  );
};
