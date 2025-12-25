import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  RotateCcw,
  Check,
  Bomb,
  Clock,
  Zap,
  Trophy,
  AlertTriangle,
  Users,
  Timer,
  Sparkles,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { classroomApi } from '../../lib/classroomApi';
import {
  timedActivityApi,
  type TimedActivity,
  MODE_CONFIG,
} from '../../lib/timedActivityApi';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

// Colores y configuración por modo
const MODE_THEMES = {
  STOPWATCH: {
    gradient: 'from-cyan-500 via-blue-500 to-indigo-600',
    bgGradient: 'from-cyan-50 via-blue-50 to-indigo-50',
    shadow: 'shadow-cyan-500/40',
    ring: 'ring-cyan-400',
    text: 'text-cyan-600',
    icon: '⏱️',
    particles: ['💨', '⚡', '✨', '🏃'],
  },
  TIMER: {
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    bgGradient: 'from-amber-50 via-orange-50 to-red-50',
    shadow: 'shadow-orange-500/40',
    ring: 'ring-orange-400',
    text: 'text-orange-600',
    icon: '⏰',
    particles: ['⏳', '🔥', '⚡', '💫'],
  },
  BOMB: {
    gradient: 'from-red-500 via-rose-500 to-pink-600',
    bgGradient: 'from-red-50 via-rose-50 to-pink-50',
    shadow: 'shadow-red-500/40',
    ring: 'ring-red-400',
    text: 'text-red-600',
    icon: '💣',
    particles: ['💥', '🔥', '💀', '⚡'],
  },
  BOMB_RANDOM: {
    gradient: 'from-purple-500 via-fuchsia-500 to-pink-600',
    bgGradient: 'from-purple-50 via-fuchsia-50 to-pink-50',
    shadow: 'shadow-purple-500/40',
    ring: 'ring-purple-400',
    text: 'text-purple-600',
    icon: '🎲',
    particles: ['💣', '🎲', '❓', '💥'],
  },
};

interface TimedActivityRunnerProps {
  activity: TimedActivity;
  classroom: any;
  onBack: () => void;
}

export const TimedActivityRunner = ({ activity: initialActivity, classroom, onBack }: TimedActivityRunnerProps) => {
  const queryClient = useQueryClient();
  const [activity, setActivity] = useState(initialActivity);
  const [elapsedSeconds, setElapsedSeconds] = useState(initialActivity.elapsedSeconds || 0);
  const [isRunning, setIsRunning] = useState(initialActivity.status === 'ACTIVE');
  const [bombExploded, setBombExploded] = useState(false);
  const [showExplosion, setShowExplosion] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const studentsPerPage = 8;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const explosionSfxRef = useRef<HTMLAudioElement | null>(null);

  // Inicializar audio para modo bomba
  useEffect(() => {
    if (activity.mode === 'BOMB') {
      bgMusicRef.current = new Audio('/sounds/music_bomb.mp3');
      bgMusicRef.current.loop = true;
      bgMusicRef.current.volume = 0.5;
      explosionSfxRef.current = new Audio('/sounds/bomb_explota.mp3');
      explosionSfxRef.current.volume = 0.8;
    }
    return () => {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
      if (explosionSfxRef.current) {
        explosionSfxRef.current = null;
      }
    };
  }, [activity.mode]);

  // Función para fadeout de música
  const fadeOutMusic = useCallback(() => {
    if (!bgMusicRef.current) return;
    const audio = bgMusicRef.current;
    const fadeInterval = setInterval(() => {
      if (audio.volume > 0.05) {
        audio.volume = Math.max(0, audio.volume - 0.05);
      } else {
        audio.volume = 0;
        audio.pause();
        clearInterval(fadeInterval);
      }
    }, 50);
  }, []);

  // Iniciar música cuando empieza la bomba
  useEffect(() => {
    if (activity.mode === 'BOMB' && isRunning && !bombExploded && bgMusicRef.current && !isMuted) {
      bgMusicRef.current.currentTime = 0;
      bgMusicRef.current.volume = 0.5;
      bgMusicRef.current.play().catch(() => {});
    } else if (!isRunning && bgMusicRef.current) {
      bgMusicRef.current.pause();
    }
  }, [isRunning, activity.mode, bombExploded, isMuted]);

  // Manejar mute/unmute
  useEffect(() => {
    if (bgMusicRef.current) {
      if (isMuted) {
        bgMusicRef.current.pause();
      } else if (isRunning && !bombExploded && activity.mode === 'BOMB') {
        bgMusicRef.current.play().catch(() => {});
      }
    }
  }, [isMuted, isRunning, bombExploded, activity.mode]);

  // Obtener estudiantes de la clase
  const { data: classroomData } = useQuery({
    queryKey: ['classroom', classroom.id],
    queryFn: () => classroomApi.getById(classroom.id),
  });
  const students = classroomData?.students || [];

  // Estudiantes que ya completaron
  const completedStudentIds = new Set(
    activity.results?.filter(r => r.completedAt).map(r => r.studentProfileId) || []
  );

  // Estudiantes que explotaron (modo bomba)
  const explodedStudentIds = new Set(
    activity.results?.filter(r => r.wasExploded).map(r => r.studentProfileId) || []
  );

  // Mutations
  const startMutation = useMutation({
    mutationFn: () => timedActivityApi.start(activity.id),
    onSuccess: (data) => {
      setActivity(data);
      setIsRunning(true);
      setElapsedSeconds(0);
      startTimeRef.current = Date.now();
      toast.success('¡Actividad iniciada!');
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => timedActivityApi.pause(activity.id, elapsedSeconds),
    onSuccess: (data) => {
      setActivity(data);
      setIsRunning(false);
      toast.success('Actividad pausada');
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => timedActivityApi.resume(activity.id),
    onSuccess: (data) => {
      setActivity(data);
      setIsRunning(true);
      startTimeRef.current = Date.now() - (elapsedSeconds * 1000);
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => timedActivityApi.complete(activity.id, elapsedSeconds),
    onSuccess: (data) => {
      setActivity(data);
      setIsRunning(false);
      toast.success('¡Actividad completada!');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => timedActivityApi.reset(activity.id),
    onSuccess: (data) => {
      setActivity(data);
      setIsRunning(false);
      setElapsedSeconds(0);
      setBombExploded(false);
      setShowExplosion(false);
      toast.success('Actividad reiniciada');
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: ({ studentId }: { studentId: string }) =>
      timedActivityApi.markStudentComplete(activity.id, studentId, elapsedSeconds),
    onSuccess: (result, { studentId }) => {
      const student = students.find(s => s.id === studentId);
      const studentName = student?.characterName || student?.realName || 'Estudiante';
      
      toast.success(
        <div>
          <strong>{studentName}</strong> completó
          <br />
          <span className="text-emerald-500">+{result.pointsAwarded} {activity.pointType}</span>
          {result.multiplier > 100 && (
            <span className="text-purple-500 ml-2">x{(result.multiplier / 100).toFixed(1)}</span>
          )}
        </div>
      );

      queryClient.invalidateQueries({ queryKey: ['timed-activities', classroom.id] });
      timedActivityApi.getById(activity.id).then(setActivity);
    },
  });

  const markExplodedMutation = useMutation({
    mutationFn: ({ studentId }: { studentId: string }) =>
      timedActivityApi.markStudentExploded(activity.id, studentId),
    onSuccess: (result, { studentId }) => {
      const student = students.find(s => s.id === studentId);
      const studentName = student?.characterName || student?.realName || 'Estudiante';
      
      toast.error(
        <div>
          <strong>💥 ¡BOOM!</strong>
          <br />
          {studentName} perdió <span className="text-red-500">-{result.penaltyApplied} {activity.bombPenaltyType}</span>
        </div>
      );

      queryClient.invalidateQueries({ queryKey: ['timed-activities', classroom.id] });
      timedActivityApi.getById(activity.id).then(setActivity);
    },
  });

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now() - (elapsedSeconds * 1000);
      
      intervalRef.current = setInterval(() => {
        const newElapsed = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
        setElapsedSeconds(newElapsed);

        // Check bomb explosion
        if (activity.mode === 'BOMB' && activity.actualBombTime && newElapsed >= activity.actualBombTime && !bombExploded) {
          setBombExploded(true);
          setShowExplosion(true);
          setIsRunning(false);
          
          // Fadeout música y reproducir SFX de explosión
          fadeOutMusic();
          if (explosionSfxRef.current && !isMuted) {
            explosionSfxRef.current.currentTime = 0;
            explosionSfxRef.current.play().catch(() => {});
          }
          
          // Trigger explosion effect
          setTimeout(() => setShowExplosion(false), 2000);
        }

        // Check timer end
        if (activity.mode === 'TIMER' && activity.timeLimitSeconds && newElapsed >= activity.timeLimitSeconds) {
          setIsRunning(false);
          completeMutation.mutate();
        }
      }, 100);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, activity.mode, activity.actualBombTime, activity.timeLimitSeconds, bombExploded, fadeOutMusic, isMuted]);

  // Format time display
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Calculate remaining time for TIMER mode
  const getRemainingTime = () => {
    if (activity.mode === 'TIMER' && activity.timeLimitSeconds) {
      return Math.max(0, activity.timeLimitSeconds - elapsedSeconds);
    }
    return elapsedSeconds;
  };

  // Get progress percentage for TIMER
  const getProgress = () => {
    if (activity.mode === 'TIMER' && activity.timeLimitSeconds) {
      return Math.min(100, (elapsedSeconds / activity.timeLimitSeconds) * 100);
    }
    return 0;
  };

  // Get multiplier info
  const getCurrentMultiplier = () => {
    if (!activity.useMultipliers || !activity.timeLimitSeconds) return 100;
    const percentComplete = (elapsedSeconds / activity.timeLimitSeconds) * 100;
    if (percentComplete <= 50) return activity.multiplier50;
    if (percentComplete <= 75) return activity.multiplier75;
    return 100;
  };

  const modeConfig = MODE_CONFIG[activity.mode];
  const theme = MODE_THEMES[activity.mode] || MODE_THEMES.STOPWATCH;
  const timeDisplay = activity.mode === 'TIMER' ? formatTime(getRemainingTime()) : formatTime(elapsedSeconds);

  return (
    <div className="space-y-5">
      {/* Header Gamificado */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-all border border-white/20"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <motion.div 
            animate={{ 
              rotate: isRunning ? [0, 5, -5, 0] : 0,
              scale: isRunning ? [1, 1.05, 1] : 1 
            }} 
            transition={{ duration: 1, repeat: isRunning ? Infinity : 0 }}
            className={`w-12 h-12 bg-gradient-to-br ${theme.gradient} rounded-xl flex items-center justify-center text-white shadow-lg ${theme.shadow}`}
          >
            <span className="text-2xl">{theme.icon}</span>
          </motion.div>
          <div>
            <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">
              {activity.name}
              {isRunning && (
                <motion.span 
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }} 
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  <Sparkles size={16} className={theme.text} />
                </motion.span>
              )}
            </h1>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className={`flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r ${theme.bgGradient} ${theme.text} rounded-full font-medium`}>
                {modeConfig.label}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                <Trophy size={12} />
                +{activity.basePoints} {activity.pointType}
              </span>
            </div>
          </div>
        </div>

        {/* Info badges */}
        <div className="flex gap-2 items-center">
          {activity.useMultipliers && (
            <motion.span 
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-100 to-fuchsia-100 text-purple-700 rounded-full text-sm font-semibold shadow-sm"
            >
              <Zap size={14} />
              Multiplicadores
            </motion.span>
          )}
          {(activity.mode === 'BOMB' || activity.mode === 'BOMB_RANDOM') && (
            <>
              <motion.span 
                animate={isRunning ? { scale: [1, 1.1, 1], opacity: [1, 0.8, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-red-100 to-rose-100 text-red-700 rounded-full text-sm font-semibold shadow-sm"
              >
                <AlertTriangle size={14} />
                -{activity.bombPenaltyPoints} {activity.bombPenaltyType}
              </motion.span>
              {/* Botón de mute para modo bomba */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsMuted(!isMuted)}
                className={`p-2 rounded-full transition-all shadow-sm ${
                  isMuted 
                    ? 'bg-gray-200 text-gray-500' 
                    : 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700'
                }`}
                title={isMuted ? 'Activar sonido' : 'Silenciar'}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </motion.button>
            </>
          )}
        </div>
      </motion.div>

      {/* Main content */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Timer Display - Gamificado */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          className="lg:col-span-2 relative rounded-3xl min-h-[400px] overflow-hidden shadow-2xl"
        >
          {/* Fondo dinámico por modo */}
          <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient}`}>
            {/* Partículas flotantes */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-2xl opacity-30"
                style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
                animate={{ 
                  y: [0, -30, 0], 
                  x: [0, Math.random() * 20 - 10, 0],
                  opacity: [0.2, 0.5, 0.2],
                  scale: [1, 1.2, 1] 
                }}
                transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
              >
                {theme.particles[i % theme.particles.length]}
              </motion.div>
            ))}
            <div className="absolute top-10 left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-56 h-56 bg-black/10 rounded-full blur-3xl" />
          </div>

          {/* Explosion overlay */}
          <AnimatePresence>
            {showExplosion && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-br from-red-600/95 via-orange-500/95 to-yellow-500/95"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.5, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.3, repeat: 5 }}
                    className="text-[150px] mb-4 drop-shadow-2xl"
                  >
                    💥
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-6xl font-black text-white drop-shadow-lg"
                  >
                    ¡BOOM!
                  </motion.h2>
                </motion.div>
                {[...Array(25)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{ 
                      x: (Math.random() - 0.5) * 500,
                      y: (Math.random() - 0.5) * 500,
                      opacity: 0,
                      scale: 0,
                      rotate: Math.random() * 360
                    }}
                    transition={{ duration: 1.5, delay: Math.random() * 0.3 }}
                    className="absolute text-3xl"
                    style={{ left: '50%', top: '50%' }}
                  >
                    {['🔥', '💥', '✨', '⚡', '💀', '☠️'][Math.floor(Math.random() * 6)]}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Timer content */}
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[400px] p-6">
            {/* Icono principal animado */}
            <motion.div
              animate={isRunning && !bombExploded ? {
                scale: [1, 1.08, 1],
                rotate: activity.mode.includes('BOMB') ? [0, -3, 3, 0] : 0,
              } : {}}
              transition={{ duration: activity.mode.includes('BOMB') ? 0.4 : 1, repeat: isRunning ? Infinity : 0 }}
              className="mb-4"
            >
              {/* Cronómetro */}
              {activity.mode === 'STOPWATCH' && (
                <div className="relative">
                  <motion.div
                    className="w-36 h-36 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-2xl border-4 border-white/30"
                    animate={isRunning ? { boxShadow: ['0 0 30px rgba(255,255,255,0.3)', '0 0 60px rgba(255,255,255,0.5)', '0 0 30px rgba(255,255,255,0.3)'] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <motion.div
                      animate={isRunning ? { rotate: 360 } : {}}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Timer size={70} className="text-white drop-shadow-lg" />
                    </motion.div>
                  </motion.div>
                  {isRunning && (
                    <motion.div
                      className="absolute -inset-2 rounded-full border-4 border-white/40 border-dashed"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                </div>
              )}

              {/* Temporizador */}
              {activity.mode === 'TIMER' && (
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="12" />
                    <motion.circle
                      cx="80" cy="80" r="70" fill="none"
                      stroke={getProgress() > 75 ? '#ef4444' : getProgress() > 50 ? '#f59e0b' : '#10b981'}
                      strokeWidth="12"
                      strokeDasharray={2 * Math.PI * 70}
                      strokeDashoffset={2 * Math.PI * 70 * (1 - getProgress() / 100)}
                      strokeLinecap="round"
                      className="transition-all duration-200 drop-shadow-lg"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      animate={isRunning && getProgress() > 75 ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    >
                      <Clock size={50} className={`drop-shadow-lg ${getProgress() > 75 ? 'text-red-200' : getProgress() > 50 ? 'text-amber-200' : 'text-white'}`} />
                    </motion.div>
                  </div>
                </div>
              )}

              {/* Bomba Manual */}
              {activity.mode === 'BOMB' && (
                <div className="relative">
                  <motion.span 
                    className="text-[120px] block drop-shadow-2xl"
                    animate={isRunning && !bombExploded ? { 
                      filter: ['brightness(1)', 'brightness(1.4)', 'brightness(1)']
                    } : {}}
                    transition={{ duration: 0.3, repeat: Infinity }}
                  >
                    {bombExploded ? '💥' : '💣'}
                  </motion.span>
                  {isRunning && !bombExploded && (
                    <>
                      <motion.div
                        animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], y: [-5, -25, -5] }}
                        transition={{ duration: 0.25, repeat: Infinity }}
                        className="absolute -top-4 right-6 text-4xl"
                      >✨</motion.div>
                      <motion.div
                        animate={{ opacity: [1, 0.5, 1], scale: [1, 1.3, 1] }}
                        transition={{ duration: 0.15, repeat: Infinity }}
                        className="absolute -top-6 right-3 text-3xl"
                      >🔥</motion.div>
                    </>
                  )}
                </div>
              )}

              {/* Bomba Aleatoria */}
              {activity.mode === 'BOMB_RANDOM' && (
                <div className="relative">
                  <motion.span 
                    className="text-[120px] block drop-shadow-2xl"
                    animate={isRunning && !bombExploded ? { 
                      filter: ['brightness(1)', 'brightness(1.4)', 'brightness(1)'],
                      rotate: [0, -5, 5, 0]
                    } : {}}
                    transition={{ duration: 0.4, repeat: Infinity }}
                  >
                    {bombExploded ? '💥' : '💣'}
                  </motion.span>
                  {isRunning && !bombExploded && (
                    <>
                      <motion.div
                        animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], y: [-5, -25, -5] }}
                        transition={{ duration: 0.25, repeat: Infinity }}
                        className="absolute -top-4 right-6 text-4xl"
                      >✨</motion.div>
                      <motion.div
                        animate={{ opacity: [1, 0.5, 1], scale: [1, 1.3, 1] }}
                        transition={{ duration: 0.15, repeat: Infinity }}
                        className="absolute -top-6 right-3 text-3xl"
                      >🔥</motion.div>
                      <motion.div
                        animate={{ rotate: [0, 360], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="absolute -bottom-2 -left-2 text-3xl"
                      >🎲</motion.div>
                    </>
                  )}
                </div>
              )}
            </motion.div>

            {/* Time display */}
            <motion.div
              key={timeDisplay}
              animate={isRunning ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
              className="mb-4"
            >
              <span className={`text-8xl font-mono font-black text-white drop-shadow-2xl tracking-wider ${
                activity.mode === 'TIMER' && getProgress() > 75 ? 'animate-pulse' : ''
              }`}>
                {timeDisplay}
              </span>
            </motion.div>

            {/* Status message */}
            {activity.mode.includes('BOMB') && isRunning && !bombExploded && (
              <motion.div
                animate={{ opacity: [0.6, 1, 0.6], y: [0, -3, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-4"
              >
                <AlertTriangle size={18} className="text-yellow-300" />
                <span className="text-white font-semibold text-sm">
                  {activity.mode === 'BOMB_RANDOM' ? '¡La bomba pasará aleatoriamente!' : '¡La bomba puede explotar en cualquier momento!'}
                </span>
              </motion.div>
            )}
            {bombExploded && (
              <motion.p 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-white font-black text-2xl mb-4 bg-black/30 px-6 py-2 rounded-full"
              >
                💥 ¡LA BOMBA EXPLOTÓ!
              </motion.p>
            )}

            {/* Multiplier indicator */}
            {activity.useMultipliers && getCurrentMultiplier() > 100 && (
              <motion.div
                animate={{ scale: [1, 1.1, 1], boxShadow: ['0 0 20px rgba(168,85,247,0.4)', '0 0 40px rgba(168,85,247,0.6)', '0 0 20px rgba(168,85,247,0.4)'] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/90 text-purple-600 rounded-full mb-4 font-bold shadow-xl"
              >
                <Zap size={20} className="fill-purple-500" />
                <span>x{(getCurrentMultiplier() / 100).toFixed(1)} Puntos</span>
              </motion.div>
            )}

            {/* Controls */}
            <div className="flex gap-3 justify-center mt-4">
              {activity.status === 'DRAFT' && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                  className="flex items-center gap-3 px-8 py-4 bg-white text-gray-800 font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all disabled:opacity-50"
                >
                  <Play size={24} className="text-emerald-500" />
                  <span className="text-lg">
                    {activity.mode.includes('BOMB') ? '¡Iniciar Bomba!' : 'Iniciar'}
                  </span>
                </motion.button>
              )}

              {activity.status === 'ACTIVE' && !bombExploded && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => pauseMutation.mutate()}
                    disabled={pauseMutation.isPending}
                    className="flex items-center gap-2 px-6 py-3 bg-white/90 text-amber-600 font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                  >
                    <Pause size={20} />
                    Pausar
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                    className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm text-white font-bold rounded-xl border border-white/30 transition-all disabled:opacity-50"
                  >
                    <Square size={20} />
                    Finalizar
                  </motion.button>
                </>
              )}

              {activity.status === 'PAUSED' && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => resumeMutation.mutate()}
                    disabled={resumeMutation.isPending}
                    className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                  >
                    <Play size={20} />
                    Reanudar
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                    className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm text-white font-bold rounded-xl border border-white/30 transition-all disabled:opacity-50"
                  >
                    <Square size={20} />
                    Finalizar
                  </motion.button>
                </>
              )}

              {(activity.status === 'COMPLETED' || bombExploded) && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => resetMutation.mutate()}
                  disabled={resetMutation.isPending}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  <RotateCcw size={20} />
                  Reiniciar
                </motion.button>
              )}
            </div>
          </div>

          {/* Borde decorativo */}
          <div className="absolute inset-0 rounded-3xl border-2 border-white/20 pointer-events-none" />
        </motion.div>

        {/* Student List - Gamificado */}
        <motion.div 
          initial={{ x: 20, opacity: 0 }} 
          animate={{ x: 0, opacity: 1 }} 
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-xl p-5 border border-gray-100 flex flex-col"
        >
          {/* Header con progreso */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-md`}>
                <Users size={18} className="text-white" />
              </div>
              <div>
                <span className="font-bold text-gray-800 block text-sm">Progreso</span>
                <span className="text-xs text-gray-500">{students.length} estudiantes</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-2xl font-black text-gray-800">{completedStudentIds.size}</span>
                <span className="text-gray-400">/{students.length}</span>
              </div>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
            <motion.div 
              className={`h-full bg-gradient-to-r ${theme.gradient} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${(completedStudentIds.size / Math.max(students.length, 1)) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Búsqueda de estudiantes */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar estudiante..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
            />
          </div>

          {/* Lista de estudiantes con paginación */}
          {(() => {
            const filteredStudents = students.filter(s => 
              (s.characterName || s.realName || '').toLowerCase().includes(searchQuery.toLowerCase())
            );
            const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
            const startIndex = (currentPage - 1) * studentsPerPage;
            const paginatedStudents = filteredStudents.slice(startIndex, startIndex + studentsPerPage);

            return (
              <>
                <div className="space-y-2 flex-1 pr-1">
                  {paginatedStudents.map((student, index) => {
                    const isCompleted = completedStudentIds.has(student.id);
                    const isExploded = explodedStudentIds.has(student.id);
                    const result = activity.results?.find(r => r.studentProfileId === student.id);

                    return (
                      <motion.div
                        key={student.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={`flex items-center justify-between gap-3 p-3 rounded-xl transition-all ${
                          isCompleted
                            ? 'bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200'
                            : isExploded
                            ? 'bg-gradient-to-r from-red-50 to-rose-50 border border-red-200'
                            : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <motion.div 
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md ${
                              isCompleted ? 'bg-gradient-to-br from-emerald-400 to-green-500' :
                              isExploded ? 'bg-gradient-to-br from-red-400 to-pink-500' :
                              'bg-gradient-to-br from-gray-400 to-gray-500'
                            }`}
                            animate={isCompleted ? { scale: [1, 1.1, 1] } : {}}
                            transition={{ duration: 0.3 }}
                          >
                            {isCompleted ? <Check size={18} /> :
                             isExploded ? <Bomb size={18} /> :
                             (student.characterName?.[0] || student.realName?.[0] || '?')}
                          </motion.div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate text-sm">
                              {student.characterName || student.realName || 'Sin nombre'}
                            </p>
                            {result && (
                              <p className="text-xs">
                                {isCompleted && (
                                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                    <Trophy size={10} />
                                    +{result.pointsAwarded} {activity.pointType}
                                    {result.multiplierApplied > 100 && (
                                      <span className="text-purple-500 ml-1">x{(result.multiplierApplied / 100).toFixed(1)}</span>
                                    )}
                                  </span>
                                )}
                                {isExploded && (
                                  <span className="text-red-600 font-semibold">
                                    💥 -{result.penaltyApplied} {activity.bombPenaltyType}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        {!isCompleted && !isExploded && (activity.status === 'ACTIVE' || activity.status === 'PAUSED' || bombExploded) && (
                          <div className="flex gap-2 flex-shrink-0">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => markCompleteMutation.mutate({ studentId: student.id })}
                              disabled={markCompleteMutation.isPending}
                              className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                            >
                              <Check size={14} />
                              Completó
                            </motion.button>
                            {(activity.mode === 'BOMB' || activity.mode === 'BOMB_RANDOM') && bombExploded && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => markExplodedMutation.mutate({ studentId: student.id })}
                                disabled={markExplodedMutation.isPending}
                                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                              >
                                <Bomb size={14} />
                                Explotó
                              </motion.button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}

                  {filteredStudents.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <Users size={40} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        {searchQuery ? 'No se encontraron estudiantes' : 'No hay estudiantes en esta clase'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Controles de paginación */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500">
                      {startIndex + 1}-{Math.min(startIndex + studentsPerPage, filteredStudents.length)} de {filteredStudents.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={18} className="text-gray-600" />
                      </button>
                      <span className="text-xs font-medium text-gray-600 px-2">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight size={18} className="text-gray-600" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </motion.div>
      </div>
    </div>
  );
};
