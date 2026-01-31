import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Zap, Clock, CheckCircle, Upload,
  AlertCircle, Trophy, Star, Coins, Play, ShoppingCart,
  FileText, Image, File, X, Loader2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { jiroExpeditionApi, type JiroStation } from '../../lib/jiroExpeditionApi';
import { studentApi } from '../../lib/studentApi';
import { useStudentStore } from '../../store/studentStore';
import toast from 'react-hot-toast';

export const StudentJiroExpeditionPage = () => {
  const { expeditionId } = useParams<{ expeditionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedClassIndex } = useStudentStore();
  
  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });
  
  const currentProfile = myClasses?.[selectedClassIndex];
  const studentProfileId = currentProfile?.id;
  
  const [currentStationIndex, setCurrentStationIndex] = useState<number | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; correctAnswer: any; explanation: string | null } | null>(null);
  
  // Estado local para countdown del temporizador (modo Examen)
  const [localTimeRemaining, setLocalTimeRemaining] = useState<number | null>(null);
  const lastServerTimeRef = useRef<number | null>(null);

  const { data: progress, isLoading, refetch } = useQuery({
    queryKey: ['jiro-my-progress', expeditionId, studentProfileId],
    queryFn: () => jiroExpeditionApi.getMyProgress(expeditionId!, studentProfileId!),
    enabled: !!expeditionId && !!studentProfileId,
    // Reducir polling: 30s para modo Examen (solo para sincronizar), 30s para ASYNC
    refetchInterval: 30000,
  });
  
  // Sincronizar tiempo del servidor con el estado local
  useEffect(() => {
    if (progress?.expedition.mode === 'EXAM' && progress.expedition.timeRemaining !== null) {
      const serverTime = progress.expedition.timeRemaining;
      // Solo actualizar si es la primera vez o si hay una diferencia significativa (>5s)
      if (lastServerTimeRef.current === null || Math.abs(serverTime - (localTimeRemaining ?? 0)) > 5) {
        setLocalTimeRemaining(serverTime);
        lastServerTimeRef.current = serverTime;
      }
    }
  }, [progress?.expedition.timeRemaining]);
  
  // Countdown local cada segundo para modo Examen
  useEffect(() => {
    if (progress?.expedition.mode !== 'EXAM' || localTimeRemaining === null || localTimeRemaining <= 0) {
      return;
    }
    
    const interval = setInterval(() => {
      setLocalTimeRemaining(prev => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [progress?.expedition.mode, localTimeRemaining !== null]);

  const startMutation = useMutation({
    mutationFn: () => jiroExpeditionApi.start(expeditionId!, studentProfileId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jiro-my-progress', expeditionId] });
      toast.success('¡Expedición iniciada!');
    },
    onError: () => toast.error('Error al iniciar'),
  });

  const answerMutation = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: any }) =>
      jiroExpeditionApi.answer(expeditionId!, studentProfileId!, questionId, answer),
    onSuccess: (result) => {
      setLastResult(result);
      setShowResult(true);
      queryClient.invalidateQueries({ queryKey: ['jiro-my-progress', expeditionId] });
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Error al responder'),
  });

  const buyEnergyMutation = useMutation({
    mutationFn: () => jiroExpeditionApi.buyEnergy(expeditionId!, studentProfileId!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['jiro-my-progress', expeditionId] });
      toast.success(`+1 energía! (-${result.gpSpent} GP)`);
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'No tienes suficiente GP'),
  });

  const timeoutMutation = useMutation({
    mutationFn: () => jiroExpeditionApi.forceCompleteByTimeout(expeditionId!, studentProfileId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jiro-my-progress', expeditionId] });
      toast('⏰ ¡Tiempo agotado! El examen ha finalizado.', { icon: '⏰' });
    },
    onError: () => toast.error('Error al finalizar examen'),
  });
  
  // Efecto para finalizar examen cuando el tiempo llega a 0
  const hasTriggeredTimeoutRef = useRef(false);
  useEffect(() => {
    if (
      progress?.expedition.mode === 'EXAM' && 
      localTimeRemaining !== null && 
      localTimeRemaining <= 0 && 
      progress?.studentProgress?.status === 'IN_PROGRESS' &&
      !hasTriggeredTimeoutRef.current &&
      !timeoutMutation.isPending
    ) {
      hasTriggeredTimeoutRef.current = true;
      timeoutMutation.mutate();
    }
  }, [localTimeRemaining, progress?.expedition.mode, progress?.studentProgress?.status]);

  const handleAnswer = () => {
    if (selectedAnswer === null || currentStationIndex === null || !progress) return;
    const station = progress.stations[currentStationIndex];
    if (station.type !== 'QUESTION' || !station.question) return;
    answerMutation.mutate({ questionId: station.question.id, answer: selectedAnswer });
  };

  const handleCloseResult = () => {
    setShowResult(false);
    setLastResult(null);
    setSelectedAnswer(null);
    setCurrentStationIndex(null);
    refetch();
  };

  // Calcular la posición actual de Jiro (primera estación pendiente) - debe estar antes de cualquier return
  const jiroPosition = useMemo(() => {
    if (!progress?.stations) return 0;
    const pendingIndex = progress.stations.findIndex((s: any) => s.status === 'PENDING');
    return pendingIndex >= 0 ? pendingIndex : progress.stations.length - 1;
  }, [progress?.stations]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🦊</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando expedición...</p>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold mb-2">Expedición no encontrada</h2>
          <Button onClick={() => navigate(-1)}>Volver</Button>
        </Card>
      </div>
    );
  }

  const { expedition, studentProgress, stations, totalStations } = progress;
  const currentEnergy = studentProgress?.currentEnergy ?? expedition.initialEnergy;
  // Contar estaciones respondidas basándose en el status de cada estación, no en completedStations
  const completedCount = stations.filter((s: any) => s.status !== 'PENDING').length;

  // Vista de inicio (no ha comenzado) - Iniciar directamente la expedición
  if (!studentProgress) {
    // Auto-iniciar la expedición cuando el estudiante llega a esta página
    if (!startMutation.isPending) {
      startMutation.mutate();
    }
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <motion.div 
            className="text-6xl mb-4"
            animate={{ scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            🦊
          </motion.div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Iniciando expedición...</p>
        </div>
      </div>
    );
  }

  // Vista de completado - Pantalla completa con animaciones
  if (studentProgress.status === 'COMPLETED') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center overflow-hidden relative -mx-4 md:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 lg:-mt-8 -mb-4 md:-mb-6 lg:-mb-8">
        {/* Confeti animado */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-2xl"
              initial={{ 
                top: -20, 
                left: `${Math.random() * 100}%`,
                rotate: 0,
                opacity: 1
              }}
              animate={{ 
                top: '110%',
                rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
                opacity: [1, 1, 0]
              }}
              transition={{ 
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 3,
                ease: "linear"
              }}
            >
              {['🎉', '⭐', '✨', '🏆', '🎊', '💫'][Math.floor(Math.random() * 6)]}
            </motion.div>
          ))}
        </div>

        {/* Estrellas de fondo */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={`star-${i}`}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{ 
                top: `${Math.random() * 100}%`, 
                left: `${Math.random() * 100}%` 
              }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [1, 1.5, 1] }}
              transition={{ 
                duration: 1 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2
              }}
            />
          ))}
        </div>

        {/* Contenido principal */}
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
          className="relative z-10 w-full max-w-4xl mx-auto px-4"
        >
          {/* Jiro celebrando */}
          <motion.div
            className="flex justify-center mb-6"
            animate={{ y: [0, -15, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          >
            <div className="relative">
              <motion.div
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
              >
                <img src="/assets/mascot/jiro-ranking-boss.png" alt="Jiro" className="w-32 h-32 object-contain drop-shadow-2xl" />
              </motion.div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className="absolute -top-2 -right-2 text-4xl"
              >
                🎉
              </motion.div>
            </div>
          </motion.div>

          {/* Título */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">
              ¡Expedición Completada!
            </h1>
            <p className="text-xl text-purple-200">{expedition.name}</p>
          </motion.div>

          {/* Puntuación principal */}
          {studentProgress.finalScore && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.4, type: "spring", bounce: 0.5 }}
              className="flex justify-center mb-8"
            >
              <div className="relative">
                <div className="w-40 h-40 rounded-full bg-gradient-to-br from-yellow-400 via-amber-400 to-orange-500 flex items-center justify-center shadow-2xl border-4 border-white">
                  <div className="text-center">
                    <Trophy size={32} className="mx-auto text-white mb-1" />
                    <p className="text-4xl font-bold text-white">{parseFloat(studentProgress.finalScore).toFixed(0)}%</p>
                  </div>
                </div>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border-4 border-dashed border-yellow-300/50"
                />
              </div>
            </motion.div>
          )}

          {/* Stats */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-3 gap-6 mb-8"
          >
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center border border-white/20"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2, repeatDelay: 1 }}
              >
                <CheckCircle className="mx-auto mb-3 text-emerald-400" size={40} />
              </motion.div>
              <p className="text-4xl font-bold text-white mb-1">{studentProgress.correctAnswers}</p>
              <p className="text-sm text-purple-200">Respuestas Correctas</p>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center border border-white/20"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Star className="mx-auto mb-3 text-blue-400" size={40} />
              </motion.div>
              <p className="text-4xl font-bold text-white mb-1">+{studentProgress.earnedXp}</p>
              <p className="text-sm text-purple-200">XP Ganado</p>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center border border-white/20"
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <Coins className="mx-auto mb-3 text-amber-400" size={40} />
              </motion.div>
              <p className="text-4xl font-bold text-white mb-1">+{studentProgress.earnedGp}</p>
              <p className="text-sm text-purple-200">GP Ganado</p>
            </motion.div>
          </motion.div>

          {/* Botón volver */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex justify-center"
          >
            <Button 
              onClick={() => navigate(-1)} 
              variant="secondary"
              className="gap-2 px-8 py-3 text-lg bg-white text-purple-900 hover:bg-purple-100 border-0"
            >
              <ChevronLeft size={20} /> Volver a Expediciones
            </Button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Vista del mapa/estaciones - Diseño gamificado
  return (
    <div className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-sky-100 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 -mx-4 md:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 lg:-mt-8 -mb-4 md:-mb-6 lg:-mb-8 overflow-hidden">
      {/* Header estilo RPG/Aventura */}
      <div className="relative bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 shadow-xl overflow-hidden">
        {/* Patrón decorativo de fondo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-0 right-0 w-24 h-24 bg-white rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-1/4 w-16 h-16 bg-white rounded-full translate-y-1/2" />
        </div>
        
        {/* Borde inferior decorativo tipo hierba */}
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-green-800 via-emerald-700 to-green-800" />
        
        <div className="relative px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Lado izquierdo: Botón volver + Avatar Jiro + Info */}
            <div className="flex items-center gap-3">
              <motion.button 
                onClick={() => navigate(-1)} 
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors backdrop-blur-sm border border-white/20"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ChevronLeft size={20} />
              </motion.button>
              
              {/* Avatar de Jiro */}
              <motion.div 
                className="relative"
                animate={{ y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 p-0.5 shadow-lg">
                  <img 
                    src="/jiro-mascot.png" 
                    alt="Jiro" 
                    className="w-full h-full object-cover rounded-[10px]"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white shadow">
                  <span className="text-[10px] text-white font-bold">{completedCount}</span>
                </div>
              </motion.div>
              
              {/* Nombre y progreso */}
              <div className="flex flex-col">
                <h1 className="font-bold text-white text-lg leading-tight drop-shadow-md">
                  {expedition.name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 w-24 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 rounded-full"
                      initial={{ width: 0 }} 
                      animate={{ width: `${(completedCount / totalStations) * 100}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-xs text-emerald-100 font-medium">{completedCount}/{totalStations}</span>
                </div>
              </div>
            </div>
            
            {/* Lado derecho: Stats del juego */}
            <div className="flex items-center gap-2">
              {/* Tiempo (modo examen) */}
              {expedition.mode === 'EXAM' && (localTimeRemaining ?? expedition.timeRemaining) !== null && (() => {
                const displayTime = localTimeRemaining ?? expedition.timeRemaining ?? 0;
                const isLowTime = displayTime < 300;
                return (
                  <motion.div 
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl shadow-lg border-2 ${
                      isLowTime 
                        ? 'bg-gradient-to-r from-red-500 to-rose-500 border-red-300' 
                        : 'bg-gradient-to-r from-purple-500 to-indigo-500 border-purple-300'
                    }`}
                    animate={isLowTime ? { scale: [1, 1.03, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 0.5 }}
                  >
                    <Clock size={14} className="text-white" />
                    <span className="font-bold text-white text-sm">{formatTime(displayTime)}</span>
                  </motion.div>
                );
              })()}
              
              {/* Energía - Estilo barra de vida de juego */}
              <motion.div 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-xl shadow-lg border-2 border-yellow-300"
                whileHover={{ scale: 1.05 }}
              >
                <Zap size={14} className="text-yellow-700" />
                <span className="font-bold text-yellow-800 text-sm">{currentEnergy}</span>
                <motion.button 
                  onClick={() => buyEnergyMutation.mutate()} 
                  disabled={buyEnergyMutation.isPending} 
                  className="ml-0.5 p-1 hover:bg-yellow-300 rounded-lg transition-colors" 
                  title={`Comprar energía (${expedition.energyPurchasePrice} GP)`}
                  whileHover={{ rotate: 15 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <ShoppingCart size={12} className="text-yellow-700" />
                </motion.button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Mapa de estaciones - Diseño horizontal tipo camino con scroll */}
      <div className="relative overflow-x-auto overflow-y-hidden" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {/* Fondo decorativo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-10 text-6xl opacity-20">🌳</div>
          <div className="absolute top-20 right-20 text-5xl opacity-20">🌲</div>
          <div className="absolute bottom-20 left-1/4 text-4xl opacity-20">🌿</div>
          <div className="absolute top-1/3 right-1/3 text-3xl opacity-15">☁️</div>
          <div className="absolute top-1/4 left-1/3 text-4xl opacity-15">☁️</div>
        </div>

        {/* Contenedor del camino con scroll horizontal */}
        <div className="flex items-center px-8 py-8" style={{ minHeight: 'calc(100vh - 200px)', width: 'max-content', minWidth: '100%' }}>
          <div className="flex items-center gap-0">
            {stations.map((station, index) => {
              const isCompleted = station.status === 'CORRECT' || station.status === 'APPROVED';
              const isFailed = station.status === 'INCORRECT' || station.status === 'REJECTED';
              const isPending = station.status === 'PENDING';
              const canAccess = isPending && currentEnergy > 0;
              const isJiroHere = index === jiroPosition;
              const isEven = index % 2 === 0;

              return (
                <div key={station.id} className="flex items-center">
                  {/* Estación */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1, type: "spring" }}
                    className={`relative flex flex-col items-center ${isEven ? 'mt-0' : 'mt-24'}`}
                  >
                    {/* Jiro en esta posición */}
                    {isJiroHere && (
                      <motion.div
                        className="absolute -top-16 z-20"
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ type: "spring", bounce: 0.5 }}
                      >
                        <motion.div
                          animate={{ y: [0, -8, 0] }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                          className="relative"
                        >
                          <div className="w-14 h-14 rounded-full shadow-lg border-4 border-white overflow-hidden bg-gradient-to-br from-orange-400 to-amber-500">
                            <img src="/jiro-mascot.png" alt="Jiro" className="w-full h-full object-cover" />
                          </div>
                          {currentEnergy === 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="absolute -top-14 left-1/2 -translate-x-1/2 bg-white rounded-xl px-3 py-2 shadow-lg text-xs whitespace-nowrap"
                            >
                              <p className="text-gray-700 font-medium">¡Sin energía! 💤</p>
                              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-white transform rotate-45 translate-y-1.5" />
                            </motion.div>
                          )}
                        </motion.div>
                      </motion.div>
                    )}

                    {/* Nodo de estación */}
                    <motion.button
                      onClick={() => canAccess && setCurrentStationIndex(index)}
                      disabled={!canAccess}
                      whileHover={canAccess ? { scale: 1.1 } : {}}
                      whileTap={canAccess ? { scale: 0.95 } : {}}
                      className={`relative w-20 h-20 rounded-2xl flex flex-col items-center justify-center shadow-lg transition-all ${
                        isCompleted ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white' :
                        isFailed ? 'bg-gradient-to-br from-red-400 to-red-600 text-white' :
                        canAccess ? 'bg-gradient-to-br from-white to-gray-100 border-4 border-emerald-400 cursor-pointer hover:shadow-xl' :
                        'bg-gradient-to-br from-gray-200 to-gray-300 text-gray-400'
                      }`}
                    >
                      {/* Icono según tipo */}
                      <span className="text-2xl mb-1">
                        {isCompleted ? '✓' :
                         isFailed ? '✗' :
                         station.type === 'QUESTION' ? '❓' : '📦'}
                      </span>
                      <span className={`text-xs font-bold ${isCompleted || isFailed ? 'text-white' : canAccess ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {index + 1}
                      </span>
                      
                      {/* Indicador de acceso */}
                      {canAccess && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"
                        >
                          <Play size={10} className="text-white ml-0.5" />
                        </motion.div>
                      )}
                    </motion.button>

                    {/* Etiqueta de estación */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.1 + 0.2 }}
                      className={`mt-2 text-center max-w-[100px] ${isEven ? '' : 'order-first mb-2 mt-0'}`}
                    >
                      <p className={`text-xs font-medium truncate ${
                        isCompleted ? 'text-emerald-700' :
                        isFailed ? 'text-red-600' :
                        canAccess ? 'text-gray-800' : 'text-gray-400'
                      }`}>
                        {station.type === 'QUESTION' ? 
                          (station.question?.type === 'TRUE_FALSE' ? 'V/F' :
                           station.question?.type === 'SINGLE_CHOICE' ? 'Opción' :
                           station.question?.type === 'MULTIPLE_CHOICE' ? 'Múltiple' : 'Parejas') :
                          'Entrega'}
                      </p>
                    </motion.div>
                  </motion.div>

                  {/* Conector entre estaciones */}
                  {index < stations.length - 1 && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: index * 0.1 + 0.15 }}
                      className="relative w-16 h-2 mx-1"
                      style={{ originX: 0 }}
                    >
                      <div className={`absolute inset-0 rounded-full ${
                        stations[index].status === 'CORRECT' || stations[index].status === 'APPROVED'
                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-300'
                          : 'bg-gradient-to-r from-gray-300 to-gray-200'
                      }`} />
                      {/* Puntos decorativos */}
                      <div className="absolute top-1/2 left-1/4 w-1.5 h-1.5 bg-white/50 rounded-full -translate-y-1/2" />
                      <div className="absolute top-1/2 right-1/4 w-1.5 h-1.5 bg-white/50 rounded-full -translate-y-1/2" />
                    </motion.div>
                  )}
                </div>
              );
            })}

            {/* Meta final */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: stations.length * 0.1 }}
              className="ml-4 flex flex-col items-center"
            >
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-16 h-16 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center text-3xl shadow-lg border-4 border-white"
              >
                🏆
              </motion.div>
              <p className="mt-2 text-xs font-bold text-amber-600">¡Meta!</p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Modal de pregunta */}
      <AnimatePresence>
        {currentStationIndex !== null && !showResult && stations[currentStationIndex]?.type === 'QUESTION' && (
          <QuestionModal
            station={stations[currentStationIndex]}
            selectedAnswer={selectedAnswer}
            setSelectedAnswer={setSelectedAnswer}
            onAnswer={handleAnswer}
            onClose={() => { setCurrentStationIndex(null); setSelectedAnswer(null); }}
            isLoading={answerMutation.isPending}
            currentEnergy={currentEnergy}
          />
        )}
      </AnimatePresence>

      {/* Modal de entrega de archivo */}
      <AnimatePresence>
        {currentStationIndex !== null && !showResult && stations[currentStationIndex]?.type === 'DELIVERY' && (
          <DeliveryModal
            station={stations[currentStationIndex]}
            expeditionId={expeditionId!}
            studentProfileId={studentProfileId!}
            onClose={() => setCurrentStationIndex(null)}
            onSuccess={() => { setCurrentStationIndex(null); refetch(); }}
          />
        )}
      </AnimatePresence>

      {/* Modal de resultado */}
      <AnimatePresence>
        {showResult && lastResult && (
          <ResultModal result={lastResult} onClose={handleCloseResult} rewardXp={expedition.rewardXpPerCorrect} rewardGp={expedition.rewardGpPerCorrect} />
        )}
      </AnimatePresence>
    </div>
  );
};

// Modal de pregunta
const QuestionModal = ({ station, selectedAnswer, setSelectedAnswer, onAnswer, onClose, isLoading, currentEnergy }: {
  station: JiroStation;
  selectedAnswer: any;
  setSelectedAnswer: (a: any) => void;
  onAnswer: () => void;
  onClose: () => void;
  isLoading: boolean;
  currentEnergy: number;
}) => {
  const [activeLeftIndex, setActiveLeftIndex] = useState<number | null>(null);
  
  if (station.type !== 'QUESTION' || !station.question) return null;
  const q = station.question;
  
  // Parsear options si viene como string JSON (puede estar doblemente serializado)
  let parsedOptions: Array<{ text: string; isCorrect?: boolean }> | null = null;
  if (q.options) {
    let opts = q.options;
    while (typeof opts === 'string') {
      try { opts = JSON.parse(opts); } catch { break; }
    }
    parsedOptions = Array.isArray(opts) ? opts : null;
  }
  
  // Parsear pairs para MATCHING
  let parsedPairs: Array<{ left: string; right: string }> | null = null;
  if (q.pairs) {
    let pairs = q.pairs;
    while (typeof pairs === 'string') {
      try { pairs = JSON.parse(pairs); } catch { break; }
    }
    parsedPairs = Array.isArray(pairs) ? pairs : null;
  }
  
  // Crear orden aleatorio para la columna derecha (estable durante la sesión)
  const shuffledRightIndices = useMemo(() => {
    if (!parsedPairs) return [];
    // Fisher-Yates shuffle
    const indices = parsedPairs.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [q.id]); // Solo recalcular si cambia la pregunta
  
  // Inicializar selectedAnswer para MATCHING si no existe
  const matchingAnswers: (number | null)[] = q.type === 'MATCHING' && parsedPairs ? 
    (selectedAnswer || new Array(parsedPairs.length).fill(null)) : [];
  
  // Verificar si MATCHING está completo
  const isMatchingComplete = q.type === 'MATCHING' && matchingAnswers.every((a: number | null) => a !== null);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full ${q.type === 'MATCHING' ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">❓</span>
              <span className="text-sm font-medium text-gray-500">
                {q.type === 'TRUE_FALSE' ? 'Verdadero o Falso' :
                 q.type === 'SINGLE_CHOICE' ? 'Selección única' :
                 q.type === 'MULTIPLE_CHOICE' ? 'Selección múltiple' : 'Emparejamiento'}
              </span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
              <Zap size={14} className="text-yellow-500" />
              <span className="text-xs font-bold text-yellow-700 dark:text-yellow-400">{currentEnergy}</span>
            </div>
          </div>

          {/* Pregunta */}
          <div className="mb-6">
            <p className="text-lg font-medium text-gray-900 dark:text-white">{q.questionText}</p>
            {q.imageUrl && <img src={q.imageUrl} alt="Imagen de la pregunta" className="mt-4 rounded-xl max-h-48 object-contain mx-auto" />}
          </div>

          {/* Opciones TRUE_FALSE */}
          {q.type === 'TRUE_FALSE' && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[true, false].map((val) => (
                <button key={String(val)} onClick={() => setSelectedAnswer(val)} className={`p-4 rounded-xl border-2 transition-all ${selectedAnswer === val ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                  <span className="text-2xl mb-1 block">{val ? '✓' : '✗'}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{val ? 'Verdadero' : 'Falso'}</span>
                </button>
              ))}
            </div>
          )}

          {/* Opciones SINGLE_CHOICE / MULTIPLE_CHOICE */}
          {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && parsedOptions && (
            <div className="space-y-2 mb-6">
              {parsedOptions.map((opt: { text: string; isCorrect?: boolean }, i: number) => {
                const isSelected = q.type === 'SINGLE_CHOICE' ? selectedAnswer === i : (selectedAnswer || []).includes(i);
                return (
                  <button key={i} onClick={() => {
                    if (q.type === 'SINGLE_CHOICE') {
                      setSelectedAnswer(i);
                    } else {
                      const current = selectedAnswer || [];
                      setSelectedAnswer(current.includes(i) ? current.filter((x: number) => x !== i) : [...current, i]);
                    }
                  }} className={`w-full p-4 rounded-xl border-2 text-left transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300'}`}>
                        {isSelected && <CheckCircle size={14} />}
                      </div>
                      <span className="text-gray-900 dark:text-white">{opt.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Opciones MATCHING */}
          {q.type === 'MATCHING' && parsedPairs && (
            <div className="mb-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Selecciona un elemento de la izquierda y luego su pareja de la derecha
              </p>
              <div className="grid grid-cols-2 gap-4">
                {/* Columna izquierda */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Concepto</div>
                  {parsedPairs.map((pair, i) => {
                    const isActive = activeLeftIndex === i;
                    const hasMatch = matchingAnswers[i] !== null;
                    const matchedRightText = hasMatch && parsedPairs ? parsedPairs[matchingAnswers[i] as number]?.right : null;
                    
                    return (
                      <button
                        key={`left-${i}`}
                        onClick={() => setActiveLeftIndex(isActive ? null : i)}
                        className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                          isActive 
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-300' 
                            : hasMatch 
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{pair.left}</span>
                          {hasMatch && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 truncate max-w-[80px]" title={matchedRightText || ''}>
                              → {matchedRightText?.substring(0, 15)}...
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                
                {/* Columna derecha (orden aleatorio) */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Definición</div>
                  {shuffledRightIndices.map((originalIndex) => {
                    const pair = parsedPairs![originalIndex];
                    const isUsed = matchingAnswers.includes(originalIndex);
                    const isDisabled = activeLeftIndex === null;
                    
                    return (
                      <button
                        key={`right-${originalIndex}`}
                        onClick={() => {
                          if (activeLeftIndex === null) return;
                          const newAnswers = [...matchingAnswers];
                          // Si este elemento ya estaba asignado a otro, limpiar esa asignación
                          const prevAssignment = newAnswers.indexOf(originalIndex);
                          if (prevAssignment !== -1) {
                            newAnswers[prevAssignment] = null;
                          }
                          newAnswers[activeLeftIndex] = originalIndex;
                          setSelectedAnswer(newAnswers);
                          setActiveLeftIndex(null);
                        }}
                        disabled={isDisabled}
                        className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                          isUsed 
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 opacity-60' 
                            : isDisabled
                              ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                              : 'border-gray-200 dark:border-gray-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10'
                        }`}
                      >
                        <span className="text-sm text-gray-900 dark:text-white">{pair.right}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Botón para limpiar selecciones */}
              {matchingAnswers.some((a: number | null) => a !== null) && (
                <button
                  onClick={() => {
                    setSelectedAnswer(new Array(parsedPairs!.length).fill(null));
                    setActiveLeftIndex(null);
                  }}
                  className="mt-3 text-sm text-red-500 hover:text-red-600 underline"
                >
                  Limpiar todas las selecciones
                </button>
              )}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button 
              onClick={onAnswer} 
              disabled={(q.type === 'MATCHING' ? !isMatchingComplete : selectedAnswer === null) || isLoading} 
              isLoading={isLoading} 
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              Responder
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Modal de resultado
const ResultModal = ({ result, onClose, rewardXp, rewardGp }: {
  result: { isCorrect: boolean; correctAnswer: any; explanation: string | null };
  onClose: () => void;
  rewardXp: number;
  rewardGp: number;
}) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden`}>
        <div className={`p-8 text-center ${result.isCorrect ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gradient-to-br from-red-500 to-orange-500'} text-white`}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} className="text-6xl mb-4">
            {result.isCorrect ? '🎉' : '😔'}
          </motion.div>
          <h2 className="text-2xl font-bold mb-2">{result.isCorrect ? '¡Correcto!' : 'Incorrecto'}</h2>
          {result.isCorrect ? (
            <div className="flex justify-center gap-4">
              <div className="flex items-center gap-1"><Star size={18} /><span>+{rewardXp} XP</span></div>
              <div className="flex items-center gap-1"><Coins size={18} /><span>+{rewardGp} GP</span></div>
            </div>
          ) : (
            <p className="text-white/80">-1 energía</p>
          )}
        </div>
        
        {result.explanation && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300"><strong>Explicación:</strong> {result.explanation}</p>
          </div>
        )}
        
        <div className="p-4">
          <Button onClick={onClose} className="w-full">Continuar</Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Modal de entrega de archivos
const DeliveryModal = ({ station, expeditionId, studentProfileId, onClose, onSuccess }: {
  station: JiroStation;
  expeditionId: string;
  studentProfileId: string;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (station.type !== 'DELIVERY' || !station.station) return null;
  const deliveryStation = station.station;

  // Parsear allowedFileTypes si viene como string
  let allowedTypes: string[] = [];
  if (deliveryStation.allowedFileTypes) {
    if (Array.isArray(deliveryStation.allowedFileTypes)) {
      allowedTypes = deliveryStation.allowedFileTypes;
    } else if (typeof deliveryStation.allowedFileTypes === 'string') {
      try {
        const parsed = JSON.parse(deliveryStation.allowedFileTypes);
        allowedTypes = Array.isArray(parsed) ? parsed : [deliveryStation.allowedFileTypes];
      } catch {
        allowedTypes = [deliveryStation.allowedFileTypes];
      }
    }
  }

  const maxSizeMb = deliveryStation.maxFileSizeMb || 10;
  const maxSizeBytes = maxSizeMb * 1024 * 1024;

  // Mapeo de tipos a extensiones y MIME types
  const typeConfig: Record<string, { extensions: string[]; mimeTypes: string[]; icon: React.ReactNode }> = {
    PDF: { extensions: ['.pdf'], mimeTypes: ['application/pdf'], icon: <FileText size={20} className="text-red-500" /> },
    IMAGE: { extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'], mimeTypes: ['image/*'], icon: <Image size={20} className="text-blue-500" /> },
    WORD: { extensions: ['.doc', '.docx'], mimeTypes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], icon: <FileText size={20} className="text-blue-600" /> },
    EXCEL: { extensions: ['.xls', '.xlsx'], mimeTypes: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], icon: <FileText size={20} className="text-green-600" /> },
  };

  const acceptedExtensions = allowedTypes.flatMap(t => typeConfig[t]?.extensions || []).join(',');
  const acceptedMimeTypes = allowedTypes.flatMap(t => typeConfig[t]?.mimeTypes || []).join(',');

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image size={20} className="text-blue-500" />;
    if (file.type === 'application/pdf') return <FileText size={20} className="text-red-500" />;
    if (file.type.includes('word')) return <FileText size={20} className="text-blue-600" />;
    if (file.type.includes('excel') || file.type.includes('spreadsheet')) return <FileText size={20} className="text-green-600" />;
    return <File size={20} className="text-gray-500" />;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles: File[] = [];
    
    for (const file of selectedFiles) {
      if (file.size > maxSizeBytes) {
        toast.error(`${file.name} excede el tamaño máximo de ${maxSizeMb}MB`);
        continue;
      }
      validFiles.push(file);
    }
    
    setFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error('Selecciona al menos un archivo');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Subir cada archivo
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(Math.round((i / files.length) * 100));

        // Subir archivo al servidor usando la API con axios
        const uploadResult = await jiroExpeditionApi.uploadDeliveryFile(file);
        const fileUrl = uploadResult.url;

        // Determinar el tipo de archivo
        let fileType: 'PDF' | 'IMAGE' | 'WORD' | 'EXCEL' = 'IMAGE';
        if (file.type === 'application/pdf') fileType = 'PDF';
        else if (file.type.includes('word')) fileType = 'WORD';
        else if (file.type.includes('excel') || file.type.includes('spreadsheet')) fileType = 'EXCEL';
        else if (file.type.startsWith('image/')) fileType = 'IMAGE';

        // Registrar la entrega
        await jiroExpeditionApi.submitDelivery(expeditionId, studentProfileId, {
          deliveryStationId: deliveryStation.id,
          fileUrl,
          fileName: file.name,
          fileType,
          fileSizeBytes: file.size,
        });
      }

      setUploadProgress(100);
      toast.success('¡Archivos entregados correctamente!');
      onSuccess();
    } catch (error: any) {
      console.error('Error al subir archivos:', error);
      toast.error(error.response?.data?.message || error.message || 'Error al subir los archivos');
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-500 to-orange-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Upload size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{deliveryStation.name}</h2>
                <p className="text-sm text-white/80">Entrega de archivos</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Instrucciones */}
          {deliveryStation.instructions && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">{deliveryStation.instructions}</p>
            </div>
          )}

          {/* Info de tipos permitidos */}
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            <span>Tipos permitidos:</span>
            {allowedTypes.map(t => (
              <span key={t} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{t}</span>
            ))}
            <span className="ml-auto">Máx: {maxSizeMb}MB</span>
          </div>

          {/* Área de drop/selección */}
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:border-amber-500 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={40} className="mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-300 font-medium">Haz clic para seleccionar archivos</p>
            <p className="text-xs text-gray-400 mt-1">o arrastra y suelta aquí</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptedExtensions || acceptedMimeTypes}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Lista de archivos seleccionados */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Archivos seleccionados ({files.length})
              </p>
              {files.map((file, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  {getFileIcon(file)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <X size={16} className="text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Barra de progreso */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">Subiendo archivos...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Entregas anteriores */}
          {station.delivery && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                ✓ Ya has entregado archivos en esta estación
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">
                Puedes subir más archivos si lo deseas
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={uploading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            disabled={files.length === 0 || uploading}
          >
            {uploading ? (
              <>
                <Loader2 size={18} className="animate-spin mr-2" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload size={18} className="mr-2" />
                Entregar ({files.length})
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default StudentJiroExpeditionPage;
