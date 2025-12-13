import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Sparkles, 
  Zap, 
  Heart, 
  Coins,
  History,
  Users,
  Crown,
  Target,
  Shuffle,
  BookOpen,
  RotateCw
} from 'lucide-react';
import { eventsApi } from '../../lib/eventsApi';
import type { SystemEvent, TriggerResult, EventEffect, ChallengeData } from '../../lib/eventsApi';
import type { RandomEvent } from '../../lib/eventsApi';
import { EventLibrary } from './EventLibrary';
import { useTimer } from '../../contexts/TimerContext';
import toast from 'react-hot-toast';

interface RandomEventsActivityProps {
  classroom: {
    id: string;
    name: string;
    students: any[];
  };
  onBack: () => void;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  BONUS: { label: 'Bonificación', color: 'emerald', icon: '🎁' },
  CHALLENGE: { label: 'Desafío', color: 'red', icon: '⚡' },
  ROULETTE: { label: 'Ruleta', color: 'pink', icon: '🎰' },
  SPECIAL: { label: 'Especial', color: 'violet', icon: '✨' },
};

const TARGET_LABELS: Record<string, string> = {
  ALL: 'Todos',
  RANDOM_ONE: '1 aleatorio',
  RANDOM_SOME: 'Varios aleatorios',
  TOP: 'Mejor estudiante',
  BOTTOM: 'Estudiante rezagado',
};

export const RandomEventsActivity = ({ classroom, onBack }: RandomEventsActivityProps) => {
  const queryClient = useQueryClient();
  const { prepareTimer } = useTimer();
  const [selectedEvent, setSelectedEvent] = useState<{ event: SystemEvent; index: number } | null>(null);
  const [triggerResult, setTriggerResult] = useState<TriggerResult | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  
  // Estado para desafíos
  const [challengeData, setChallengeData] = useState<ChallengeData | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(false);

  // Obtener eventos del sistema
  const { data: systemEvents = [] } = useQuery({
    queryKey: ['system-events'],
    queryFn: eventsApi.getSystemEvents,
  });

  // Obtener eventos personalizados
  const { data: customEvents = [] } = useQuery({
    queryKey: ['custom-events', classroom.id],
    queryFn: () => eventsApi.getCustomEvents(classroom.id),
  });

  // Obtener historial
  const { data: eventLogs = [] } = useQuery({
    queryKey: ['event-logs', classroom.id],
    queryFn: () => eventsApi.getEventLogs(classroom.id, 10),
  });

  // Mutation para activar evento
  const triggerMutation = useMutation({
    mutationFn: (eventIndex: number) => eventsApi.triggerSystemEvent(classroom.id, eventIndex),
    onSuccess: (result) => {
      setTriggerResult(result);
      queryClient.invalidateQueries({ queryKey: ['classroom'] });
      queryClient.invalidateQueries({ queryKey: ['event-logs'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
    onError: () => {
      toast.error('Error al activar el evento');
      setIsAnimating(false);
    },
  });

  // Estado para resultado de ruleta
  const [rouletteResult, setRouletteResult] = useState<TriggerResult | null>(null);

  // Mutation para girar ruleta
  const rouletteMutation = useMutation({
    mutationFn: () => eventsApi.spinRoulette(classroom.id),
    onSuccess: (result) => {
      setTimeout(() => {
        setIsSpinning(false);
        if (result.success) {
          // Si es un desafío o tiene temporizador
          if (result.isChallenge && result.challengeData) {
            const data = result.challengeData as any;
            const hasTimed = data.durationType === 'TIMED' && data.durationMinutes > 0;
            
            // Si tiene temporizador, mostrar widget de timer
            if (hasTimed) {
              prepareTimer({
                classroomId: classroom.id,
                eventName: data.eventName,
                eventIcon: data.eventIcon,
                durationMinutes: data.durationMinutes,
                effects: data.effects,
                selectedStudents: data.selectedStudents,
              });
            } else {
              // Es desafío sin temporizador, mostrar modal
              setChallengeData(result.challengeData);
            }
          } else {
            // Evento normal, mostrar resultado
            setRouletteResult(result);
            queryClient.invalidateQueries({ queryKey: ['classroom'] });
            queryClient.invalidateQueries({ queryKey: ['event-logs'] });
          }
        } else {
          toast.error(result.message || 'Error al girar la ruleta');
        }
      }, 2000); // Esperar animación
    },
    onError: () => {
      toast.error('Error al girar la ruleta');
      setIsSpinning(false);
    },
  });

  // Mutation para activar evento personalizado
  const triggerCustomMutation = useMutation({
    mutationFn: (eventId: string) => eventsApi.triggerEvent(classroom.id, eventId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ['classroom'] });
        queryClient.invalidateQueries({ queryKey: ['event-logs'] });
      }
    },
    onError: () => {
      toast.error('Error al activar el evento');
    },
  });

  const handleSpinRoulette = () => {
    setIsSpinning(true);
    rouletteMutation.mutate();
  };

  const handleTriggerEvent = (event: SystemEvent, index: number) => {
    setSelectedEvent({ event, index });
    setTriggerResult(null);
    setIsAnimating(true);

    // Animación antes de mostrar resultado
    setTimeout(() => {
      triggerMutation.mutate(index);
      setTimeout(() => {
        setIsAnimating(false);
      }, 500);
    }, 2000);
  };

  // Manejar evento personalizado (con lógica de desafío y temporizador)
  const handleCustomEvent = async (event: RandomEvent) => {
    const hasTimed = event.durationType === 'TIMED' && event.durationMinutes > 0;
    const isChallenge = event.category === 'CHALLENGE';
    
    // Si tiene temporizador O es un desafío, necesitamos seleccionar estudiantes primero
    if (hasTimed || isChallenge) {
      setChallengeLoading(true);
      try {
        const data = await eventsApi.startChallenge(classroom.id, event.id);
        
        // Si tiene temporizador, mostrar widget de timer global
        if (hasTimed) {
          prepareTimer({
            classroomId: classroom.id,
            eventName: data.eventName,
            eventIcon: data.eventIcon,
            durationMinutes: event.durationMinutes,
            effects: data.effects,
            selectedStudents: data.selectedStudents,
          });
        } else {
          // Es desafío sin temporizador, mostrar modal normal
          setChallengeData(data);
        }
      } catch (error) {
        console.error('Error en startChallenge:', error);
        toast.error('Error al iniciar evento');
      } finally {
        setChallengeLoading(false);
      }
    } else {
      // Evento normal sin temporizador - aplicar directamente
      triggerCustomMutation.mutate(event.id);
    }
  };

  // Resolver desafío
  const handleResolveChallenge = async (completed: boolean) => {
    if (!challengeData) return;
    
    try {
      const result = await eventsApi.resolveChallenge(classroom.id, {
        studentIds: challengeData.selectedStudents.map(s => s.id),
        effects: challengeData.effects,
        completed,
        eventName: challengeData.eventName,
      });
      
      if (result.success) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ['classroom'] });
        queryClient.invalidateQueries({ queryKey: ['event-logs'] });
      }
      setChallengeData(null);
    } catch (error) {
      toast.error('Error al resolver desafío');
    }
  };

  const closeResult = () => {
    setSelectedEvent(null);
    setTriggerResult(null);
  };

  const getEffectIcon = (type: string) => {
    switch (type) {
      case 'XP': return <Zap className="text-emerald-500" size={16} />;
      case 'HP': return <Heart className="text-red-500" size={16} />;
      case 'GP': return <Coins className="text-amber-500" size={16} />;
      default: return null;
    }
  };

  const formatEffect = (effect: EventEffect) => {
    const sign = effect.action === 'ADD' ? '+' : '-';
    const color = effect.action === 'ADD' ? 'text-emerald-600' : 'text-red-600';
    return (
      <span className={`font-bold ${color}`}>
        {sign}{effect.value} {effect.type}
      </span>
    );
  };

  const getTargetIcon = (targetType: string) => {
    switch (targetType) {
      case 'ALL': return <Users size={14} />;
      case 'RANDOM_ONE': return <Shuffle size={14} />;
      case 'RANDOM_SOME': return <Shuffle size={14} />;
      case 'TOP': return <Crown size={14} />;
      case 'BOTTOM': return <Target size={14} />;
      default: return <Users size={14} />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onBack}
            className="p-1.5 sm:p-2 hover:bg-white/50 rounded-xl transition-colors"
          >
            <ArrowLeft size={18} className="sm:w-5 sm:h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-pink-500/30 flex-shrink-0">
              <Sparkles size={18} className="sm:w-5 sm:h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-gray-800">
                Eventos Aleatorios
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block">
                {classroom.students?.length || 0} estudiantes en la clase
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleSpinRoulette}
            disabled={isSpinning}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs sm:text-sm font-medium rounded-xl shadow-lg shadow-pink-500/25 transition-all disabled:opacity-50"
          >
            <RotateCw size={14} className={`sm:w-4 sm:h-4 ${isSpinning ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Girar Ruleta</span>
            <span className="sm:hidden">Girar</span>
          </button>
          <button
            onClick={() => setShowLibrary(true)}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-white/90 hover:bg-white text-gray-700 text-xs sm:text-sm font-medium rounded-xl shadow-lg transition-all"
          >
            <BookOpen size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Biblioteca</span>
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-1.5 sm:p-2 rounded-xl transition-colors ${showHistory ? 'bg-pink-100 text-pink-600' : 'hover:bg-white/50 text-gray-500'}`}
          >
            <History size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
        </div>
      </div>

      {/* Eventos personalizados */}
      {customEvents.length > 0 && (
        <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl border border-violet-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              ✨ Mis Eventos Personalizados
              <span className="text-xs bg-violet-500 text-white px-2 py-0.5 rounded-full">
                {customEvents.length}
              </span>
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {customEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => handleCustomEvent(event)}
                disabled={triggerCustomMutation.isPending || challengeLoading}
                className={`flex items-center gap-2 px-3 py-2 bg-white border rounded-xl hover:shadow-md transition-all text-left ${
                  event.category === 'CHALLENGE' 
                    ? 'border-red-300 hover:border-red-400' 
                    : 'border-gray-200 hover:border-violet-300'
                }`}
              >
                <span className="text-lg">{event.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">
                    {event.name}
                  </p>
                  <p className={`text-[10px] truncate ${
                    event.category === 'CHALLENGE' ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {CATEGORY_LABELS[event.category]?.label}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Grid de eventos */}
        <div className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 gap-3">
            {systemEvents.map((event, index) => {
              const category = CATEGORY_LABELS[event.category];
              
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div 
                    className="bg-white/90 backdrop-blur-sm rounded-xl border border-white/50 p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] shadow-lg"
                    onClick={() => handleTriggerEvent(event, index)}
                  >
                    <div className="flex items-start gap-3">
                      <div 
                        className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                          event.color === 'amber' ? 'bg-amber-100' :
                          event.color === 'emerald' ? 'bg-emerald-100' :
                          event.color === 'pink' ? 'bg-pink-100' :
                          event.color === 'violet' ? 'bg-violet-100' :
                          event.color === 'red' ? 'bg-red-100' : 'bg-gray-100'
                        }`}
                      >
                        {event.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-800 text-sm truncate mb-0.5">
                          {event.name}
                        </h3>
                        <p className="text-[11px] text-gray-500 line-clamp-2 mb-2">
                          {event.description}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] flex-wrap">
                          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${
                            category.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                            category.color === 'red' ? 'bg-red-100 text-red-700' :
                            category.color === 'pink' ? 'bg-pink-100 text-pink-700' :
                            category.color === 'violet' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {category.icon} {category.label}
                          </span>
                          <span className="flex items-center gap-1 text-gray-400">
                            {getTargetIcon(event.targetType)}
                            {TARGET_LABELS[event.targetType]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          {event.effects.map((effect, i) => (
                            <span key={i} className="flex items-center gap-0.5 text-[11px]">
                              {getEffectIcon(effect.type)}
                              {formatEffect(effect)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Panel lateral */}
        <div className="space-y-4">
          {/* Historial */}
          {showHistory && (
            <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-white/50 p-4 shadow-lg">
              <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
                <History size={16} />
                Historial reciente
              </h3>
              {eventLogs.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">
                  No hay eventos activados
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {eventLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-2 p-2 bg-pink-50 rounded-lg"
                    >
                      <span className="text-base">{log.eventIcon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">
                          {log.eventName}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(log.triggeredAt).toLocaleString('es', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {(log.affectedStudents as string[])?.length || 0} 👤
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Instrucciones */}
          <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-white/50 p-4 shadow-lg">
            <h4 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-pink-500" />
              ¿Cómo funciona?
            </h4>
            <ul className="text-xs text-gray-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</span>
                Elige un evento de la lista
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">2</span>
                El evento se activa automáticamente
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">3</span>
                Los efectos se aplican a los estudiantes
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">4</span>
                ¡Revisa quién fue afectado!
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal de animación y resultado */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !isAnimating && closeResult()}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              {isAnimating ? (
                // Animación
                <div className="text-center">
                  <motion.div
                    animate={{ 
                      rotate: [0, 360],
                      scale: [1, 1.2, 1],
                    }}
                    transition={{ 
                      duration: 1,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="text-7xl mb-4 inline-block"
                  >
                    {selectedEvent.event.icon}
                  </motion.div>
                  <motion.h2
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-xl font-bold text-white"
                  >
                    Activando evento...
                  </motion.h2>
                  <p className="text-gray-400 text-sm mt-1">{selectedEvent.event.name}</p>
                </div>
              ) : triggerResult ? (
                // Resultado
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 10 }}
                    className="text-6xl mb-3"
                  >
                    {selectedEvent.event.icon}
                  </motion.div>
                  
                  <h2 className="text-xl font-bold text-white mb-1">
                    {selectedEvent.event.name}
                  </h2>
                  
                  <p className="text-gray-400 text-sm mb-4">
                    {selectedEvent.event.description}
                  </p>

                  {/* Estudiantes afectados */}
                  {triggerResult.affectedStudents && triggerResult.affectedStudents.length > 0 && (
                    <div className="bg-gray-800 rounded-xl p-3 mb-4">
                      <h3 className="text-xs font-medium text-gray-400 mb-2">
                        Estudiantes afectados ({triggerResult.affectedStudents.length})
                      </h3>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {triggerResult.affectedStudents.slice(0, 10).map((student) => (
                          <span
                            key={student.id}
                            className="px-2 py-1 bg-gray-700 rounded-full text-xs font-medium text-white"
                          >
                            {student.name}
                          </span>
                        ))}
                        {triggerResult.affectedStudents.length > 10 && (
                          <span className="px-2 py-1 text-xs text-gray-500">
                            +{triggerResult.affectedStudents.length - 10} más
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Efectos aplicados */}
                  <div className="flex items-center justify-center gap-3 mb-4">
                    {selectedEvent.event.effects.map((effect, i) => (
                      <div key={i} className="flex items-center gap-1 text-sm">
                        {getEffectIcon(effect.type)}
                        {formatEffect(effect)}
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={closeResult} 
                    className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium rounded-xl shadow-lg shadow-pink-500/25"
                  >
                    ¡Entendido!
                  </button>
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Biblioteca */}
      {showLibrary && (
        <EventLibrary
          classroomId={classroom.id}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {/* Modal de Ruleta girando */}
      <AnimatePresence>
        {isSpinning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
                className="text-9xl mb-6"
              >
                🎰
              </motion.div>
              <motion.h2
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-3xl font-bold text-white"
              >
                Girando la ruleta...
              </motion.h2>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Resultado de Ruleta */}
      <AnimatePresence>
        {rouletteResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setRouletteResult(null)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-800 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 10 }}
                className="text-7xl mb-4"
              >
                {rouletteResult.event?.icon || '🎉'}
              </motion.div>
              
              <h2 className="text-2xl font-bold text-white mb-2">
                ¡Evento Activado!
              </h2>
              
              <p className="text-lg text-pink-400 font-medium mb-2">
                {rouletteResult.event?.name || rouletteResult.message}
              </p>

              {/* Descripción del evento */}
              {rouletteResult.event?.description && (
                <p className="text-sm text-gray-400 mb-4">
                  {rouletteResult.event.description}
                </p>
              )}

              {/* Efectos aplicados */}
              {rouletteResult.event?.effects && rouletteResult.event.effects.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {rouletteResult.event.effects.map((effect, idx) => (
                    <span 
                      key={idx}
                      className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                        effect.action === 'ADD'
                          ? effect.type === 'XP' ? 'bg-emerald-500/20 text-emerald-400'
                          : effect.type === 'HP' ? 'bg-red-500/20 text-red-400'
                          : 'bg-amber-500/20 text-amber-400'
                          : 'bg-gray-600/20 text-gray-400'
                      }`}
                    >
                      {effect.action === 'ADD' ? '+' : '-'}{effect.value} {effect.type}
                    </span>
                  ))}
                </div>
              )}

              {rouletteResult.affectedStudents && rouletteResult.affectedStudents.length > 0 && (
                <div className="bg-gray-800 rounded-xl p-4 mb-6">
                  <p className="text-sm text-gray-400 mb-2">
                    Estudiantes afectados: {rouletteResult.affectedStudents.length}
                  </p>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {rouletteResult.affectedStudents.slice(0, 5).map((s) => (
                      <span key={s.id} className="px-2 py-1 bg-gray-700 rounded text-sm text-white">
                        {s.name}
                      </span>
                    ))}
                    {rouletteResult.affectedStudents.length > 5 && (
                      <span className="px-2 py-1 text-sm text-gray-500">
                        +{rouletteResult.affectedStudents.length - 5} más
                      </span>
                    )}
                  </div>
                </div>
              )}

              <button 
                onClick={() => setRouletteResult(null)} 
                className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium rounded-xl shadow-lg shadow-pink-500/25"
              >
                ¡Genial!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Desafío */}
      <AnimatePresence>
        {challengeData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-gray-800"
            >
              {/* Header del desafío */}
              <div className="text-center mb-5">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-5xl mb-3"
                >
                  {challengeData.eventIcon}
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-1">
                  ⚡ {challengeData.eventName}
                </h2>
                <p className="text-gray-400 text-sm">
                  Desafío para {challengeData.selectedStudents.length} estudiante(s)
                </p>
              </div>

              {/* Estudiantes seleccionados */}
              <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-xl p-4 mb-4">
                <h3 className="text-xs font-medium text-red-400 mb-2 text-center">
                  🎯 Estudiante(s) seleccionado(s)
                </h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {challengeData.selectedStudents.map((student) => (
                    <motion.div
                      key={student.id}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="px-3 py-1.5 bg-gray-800 rounded-lg"
                    >
                      <span className="text-sm font-bold text-white">
                        {student.name}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Efectos del desafío */}
              <div className="bg-gray-800 rounded-xl p-3 mb-4">
                <h3 className="text-xs font-medium text-gray-400 mb-2 text-center">
                  Efectos del desafío
                </h3>
                <div className="flex items-center justify-center gap-3">
                  {challengeData.effects.map((effect, i) => (
                    <div key={i} className="flex items-center gap-1 text-sm">
                      {getEffectIcon(effect.type)}
                      <span className={`font-bold ${effect.action === 'ADD' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {effect.action === 'ADD' ? '+' : '-'}{effect.value} {effect.type}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-center text-gray-500 mt-1.5">
                  {challengeData.effects.some(e => e.action === 'REMOVE') 
                    ? 'Si NO cumple: se aplica la penalización'
                    : 'Si cumple: recibe la recompensa'}
                </p>
              </div>

              {/* Botones de resolución */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleResolveChallenge(false)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium text-sm transition-colors"
                >
                  ❌ No cumplió
                </button>
                <button
                  onClick={() => handleResolveChallenge(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium text-sm transition-colors"
                >
                  ✅ Cumplió
                </button>
              </div>

              {/* Botón cancelar */}
              <button
                onClick={() => setChallengeData(null)}
                className="w-full mt-3 text-gray-500 hover:text-gray-300 text-xs"
              >
                Cancelar desafío
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
