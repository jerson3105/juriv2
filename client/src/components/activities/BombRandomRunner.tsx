import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  RotateCcw,
  Check,
  Trophy,
  AlertTriangle,
  Users,
  Shuffle,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { classroomApi } from '../../lib/classroomApi';
import {
  timedActivityApi,
  type TimedActivity,
} from '../../lib/timedActivityApi';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

// Tema para Bomba Aleatoria
const BOMB_RANDOM_THEME = {
  gradient: 'from-purple-500 via-fuchsia-500 to-pink-600',
  bgGradient: 'from-purple-50 via-fuchsia-50 to-pink-50',
  shadow: 'shadow-purple-500/40',
  particles: ['💣', '🎲', '❓', '💥', '✨', '🔥'],
};

interface Student {
  id: string;
  visibleId: string;
  characterName: string | null;
  realName: string | null;
  realLastName: string | null;
  characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
  avatarGender: 'MALE' | 'FEMALE';
  level: number;
  xp: number;
  hp: number;
  gp: number;
  avatarUrl: string | null;
}

interface BombRandomRunnerProps {
  activity: TimedActivity;
  classroom: any;
  onBack: () => void;
}

export const BombRandomRunner = ({ activity: initialActivity, classroom, onBack }: BombRandomRunnerProps) => {
  const queryClient = useQueryClient();
  const [activity, setActivity] = useState(initialActivity);
  const [elapsedSeconds, setElapsedSeconds] = useState(initialActivity.elapsedSeconds || 0);
  const [isRunning, setIsRunning] = useState(false);
  const [bombExploded, setBombExploded] = useState(false);
  const [showExplosion, setShowExplosion] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Turnos aleatorios
  const [remainingStudents, setRemainingStudents] = useState<Student[]>([]);
  const [completedStudents, setCompletedStudents] = useState<Student[]>([]);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [explodedStudent, setExplodedStudent] = useState<Student | null>(null);
  const [isSelectingNext, setIsSelectingNext] = useState(false);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const explosionSfxRef = useRef<HTMLAudioElement | null>(null);

  // Inicializar audio para bomba aleatoria
  useEffect(() => {
    bgMusicRef.current = new Audio('/sounds/music_bomb.mp3');
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.5;
    explosionSfxRef.current = new Audio('/sounds/bomb_explota.mp3');
    explosionSfxRef.current.volume = 0.8;
    
    return () => {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
      if (explosionSfxRef.current) {
        explosionSfxRef.current = null;
      }
    };
  }, []);

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

  // Iniciar música cuando empieza el juego
  useEffect(() => {
    if (gameStarted && isRunning && !bombExploded && bgMusicRef.current && !isMuted) {
      bgMusicRef.current.currentTime = 0;
      bgMusicRef.current.volume = 0.5;
      bgMusicRef.current.play().catch(() => {});
    } else if (!isRunning && bgMusicRef.current && !bombExploded) {
      bgMusicRef.current.pause();
    }
  }, [isRunning, gameStarted, bombExploded, isMuted]);

  // Manejar mute/unmute
  useEffect(() => {
    if (bgMusicRef.current) {
      if (isMuted) {
        bgMusicRef.current.pause();
      } else if (isRunning && !bombExploded && gameStarted) {
        bgMusicRef.current.play().catch(() => {});
      }
    }
  }, [isMuted, isRunning, bombExploded, gameStarted]);

  // Obtener estudiantes de la clase
  const { data: classroomData } = useQuery({
    queryKey: ['classroom', classroom.id],
    queryFn: () => classroomApi.getById(classroom.id),
  });
  const students = (classroomData?.students || []) as Student[];

  // Mutations
  const startMutation = useMutation({
    mutationFn: () => timedActivityApi.start(activity.id),
    onSuccess: (data) => {
      setActivity(data);
      // Ahora que tenemos el actualBombTime del backend, iniciamos el juego
      const shuffled = [...students].sort(() => Math.random() - 0.5);
      setRemainingStudents(shuffled.slice(1));
      setCurrentStudent(shuffled[0]);
      setCompletedStudents([]);
      setGameStarted(true);
      setIsRunning(true);
      setBombExploded(false);
      setElapsedSeconds(0);
      startTimeRef.current = Date.now();
      toast.success('¡Bomba activada!');
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => timedActivityApi.complete(activity.id, elapsedSeconds),
    onSuccess: (data) => {
      setActivity(data);
      setIsRunning(false);
      toast.success('¡Todos completaron! 🎉');
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
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
      setGameStarted(false);
      setCurrentStudent(null);
      setExplodedStudent(null);
      setCompletedStudents([]);
      setRemainingStudents([]);
      toast.success('Actividad reiniciada');
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: ({ studentId }: { studentId: string }) =>
      timedActivityApi.markStudentComplete(activity.id, studentId, elapsedSeconds),
    onSuccess: (result, { studentId }) => {
      const student = students.find(s => s.id === studentId);
      if (student) {
        setCompletedStudents(prev => [...prev, student]);
        toast.success(
          <div>
            <strong>{student.characterName || student.realName}</strong> ✓
            <br />
            <span className="text-emerald-500">+{result.pointsAwarded} {activity.pointType}</span>
          </div>
        );
      }
      queryClient.invalidateQueries({ queryKey: ['timed-activities', classroom.id] });
      timedActivityApi.getById(activity.id).then(setActivity);
    },
  });

  const markExplodedMutation = useMutation({
    mutationFn: ({ studentId }: { studentId: string }) =>
      timedActivityApi.markStudentExploded(activity.id, studentId),
    onSuccess: (result, { studentId }) => {
      const student = students.find(s => s.id === studentId);
      toast.error(
        <div>
          <strong>💥 ¡BOOM!</strong>
          <br />
          {student?.characterName || student?.realName} perdió{' '}
          <span className="text-red-500">-{result.penaltyApplied} {activity.bombPenaltyType}</span>
        </div>
      );
      queryClient.invalidateQueries({ queryKey: ['timed-activities', classroom.id] });
    },
  });

  // Iniciar el juego
  const startGame = useCallback(() => {
    if (students.length === 0) {
      toast.error('No hay estudiantes en la clase');
      return;
    }
    
    // Iniciar la actividad en el backend - el juego se inicia en onSuccess
    startMutation.mutate();
  }, [students, startMutation]);

  // Seleccionar siguiente estudiante aleatorio
  const selectNextStudent = useCallback(() => {
    if (remainingStudents.length === 0) {
      // Todos completaron!
      setCurrentStudent(null);
      setIsRunning(false);
      completeMutation.mutate();
      return;
    }

    // Marcar al estudiante actual como completado
    if (currentStudent) {
      markCompleteMutation.mutate({ studentId: currentStudent.id });
    }

    // Animación de selección
    setIsSelectingNext(true);
    
    // Simular "ruleta" de selección
    let iterations = 0;
    const maxIterations = 10 + Math.floor(Math.random() * 5);
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * remainingStudents.length);
      setCurrentStudent(remainingStudents[randomIndex]);
      iterations++;
      
      if (iterations >= maxIterations) {
        clearInterval(interval);
        // Selección final
        const finalIndex = Math.floor(Math.random() * remainingStudents.length);
        const selected = remainingStudents[finalIndex];
        setCurrentStudent(selected);
        setRemainingStudents(prev => prev.filter(s => s.id !== selected.id));
        setIsSelectingNext(false);
      }
    }, 100);
  }, [remainingStudents, currentStudent, markCompleteMutation, completeMutation]);

  // Timer logic
  useEffect(() => {
    if (isRunning && gameStarted) {
      startTimeRef.current = startTimeRef.current || Date.now();
      
      intervalRef.current = setInterval(() => {
        const newElapsed = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
        setElapsedSeconds(newElapsed);

        // Check bomb explosion
        if (activity.actualBombTime && newElapsed >= activity.actualBombTime && !bombExploded) {
          setBombExploded(true);
          setShowExplosion(true);
          setIsRunning(false);
          
          // Fadeout música y reproducir SFX de explosión
          fadeOutMusic();
          if (explosionSfxRef.current && !isMuted) {
            explosionSfxRef.current.currentTime = 0;
            explosionSfxRef.current.play().catch(() => {});
          }
          
          // Guardar y marcar al estudiante actual como explotado
          if (currentStudent) {
            setExplodedStudent(currentStudent);
            markExplodedMutation.mutate({ studentId: currentStudent.id });
          }
          
          setTimeout(() => setShowExplosion(false), 2500);
        }
      }, 100);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, gameStarted, activity.actualBombTime, bombExploded, currentStudent, fadeOutMusic, isMuted]);

  // Format time display
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Get avatar URL - usar placeholder si no hay avatar
  const getAvatarUrl = (student: Student) => {
    if (student.avatarUrl) return student.avatarUrl;
    // Placeholder basado en la clase
    const colors: Record<string, string> = {
      GUARDIAN: '3b82f6',
      ARCANE: '8b5cf6',
      EXPLORER: '22c55e',
      ALCHEMIST: 'f97316',
    };
    const color = colors[student.characterClass] || '6b7280';
    const initial = (student.characterName?.[0] || student.realName?.[0] || '?').toUpperCase();
    return `https://ui-avatars.com/api/?name=${initial}&background=${color}&color=fff&size=128`;
  };

  // Get class info
  const getClassInfo = (characterClass: string) => {
    const classes: Record<string, { name: string; icon: string }> = {
      GUARDIAN: { name: 'Guardián', icon: '🛡️' },
      ARCANE: { name: 'Arcano', icon: '🔮' },
      EXPLORER: { name: 'Explorador', icon: '🧭' },
      ALCHEMIST: { name: 'Alquimista', icon: '⚗️' },
    };
    return classes[characterClass] || { name: characterClass, icon: '🎮' };
  };

  // Urgency level based on time
  const urgencyLevel = useMemo(() => {
    if (!activity.actualBombTime) return 0;
    const percent = (elapsedSeconds / activity.actualBombTime) * 100;
    if (percent >= 80) return 3; // Critical
    if (percent >= 60) return 2; // High
    if (percent >= 40) return 1; // Medium
    return 0; // Low
  }, [elapsedSeconds, activity.actualBombTime]);

  const theme = BOMB_RANDOM_THEME;

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
            <span className="text-2xl">🎲</span>
          </motion.div>
          <div>
            <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">
              {activity.name}
              {isRunning && (
                <motion.span 
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }} 
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  <Sparkles size={16} className="text-purple-500" />
                </motion.span>
              )}
            </h1>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className={`flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r ${theme.bgGradient} text-purple-600 rounded-full font-medium`}>
                <Shuffle size={12} />
                Bomba Aleatoria
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
          <motion.span 
            animate={isRunning ? { scale: [1, 1.1, 1], opacity: [1, 0.8, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-red-100 to-rose-100 text-red-700 rounded-full text-sm font-semibold shadow-sm"
          >
            <AlertTriangle size={14} />
            -{activity.bombPenaltyPoints} {activity.bombPenaltyType}
          </motion.span>
          {/* Botón de mute */}
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
        </div>
      </motion.div>

      {/* Main content */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Bomb & Current Student - Main Area */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          className="lg:col-span-2 relative rounded-3xl min-h-[450px] overflow-hidden shadow-2xl"
        >
          {/* Fondo dinámico */}
          <div className={`absolute inset-0 bg-gradient-to-br ${
            urgencyLevel >= 3 ? 'from-red-500 via-rose-500 to-orange-500' :
            urgencyLevel >= 2 ? 'from-orange-500 via-amber-500 to-yellow-500' :
            urgencyLevel >= 1 ? 'from-amber-500 via-yellow-500 to-orange-400' :
            theme.gradient
          } transition-all duration-500`}>
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
                className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-br from-red-600/95 to-orange-600/95"
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
                    className="text-[150px] mb-4"
                  >
                    💥
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-5xl font-black text-white drop-shadow-lg"
                  >
                    ¡BOOM!
                  </motion.h2>
                  {currentStudent && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-xl text-white/90 mt-4"
                    >
                      {currentStudent.characterName || currentStudent.realName} perdió {activity.bombPenaltyPoints} {activity.bombPenaltyType}
                    </motion.p>
                  )}
                </motion.div>
                {/* Particles */}
                {[...Array(30)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{
                      x: (Math.random() - 0.5) * 500,
                      y: (Math.random() - 0.5) * 500,
                      opacity: 0,
                      scale: 0,
                    }}
                    transition={{ duration: 1.5, delay: Math.random() * 0.3 }}
                    className="absolute text-3xl"
                    style={{ left: '50%', top: '50%' }}
                  >
                    {['🔥', '💥', '✨', '⚡', '💫'][Math.floor(Math.random() * 5)]}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[450px] p-6">
            {!gameStarted ? (
              // Start screen - Gamificado
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6"
              >
                {/* Bomba animada */}
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, -5, 5, 0]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="relative inline-block"
                >
                  <span className="text-[120px] block drop-shadow-2xl">💣</span>
                  <motion.div
                    animate={{ opacity: [0, 1, 0], y: [-10, -30, -10] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="absolute -top-4 right-4 text-4xl"
                  >✨</motion.div>
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="absolute -bottom-2 -left-2 text-3xl"
                  >🎲</motion.div>
                </motion.div>

                <div>
                  <h2 className="text-4xl font-black text-white drop-shadow-lg mb-2">
                    Bomba Aleatoria
                  </h2>
                  <p className="text-white/80 text-lg max-w-sm mx-auto">
                    La bomba pasará de estudiante en estudiante al azar.
                    <br />
                    <span className="text-yellow-200 font-semibold">¡El que tenga la bomba cuando explote pierde HP!</span>
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
                  <Users size={18} className="text-white" />
                  <span className="text-white font-semibold">{students.length} estudiantes participarán</span>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startGame}
                  disabled={startMutation.isPending || students.length === 0}
                  className="flex items-center gap-3 px-8 py-4 bg-white text-gray-800 font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 mx-auto"
                >
                  <Play size={24} className="text-purple-500" />
                  <span className="text-lg">¡Iniciar Bomba!</span>
                </motion.button>
              </motion.div>
            ) : (
              // Game in progress - Centrado
              <div className="text-center space-y-4">
                {/* Bomba grande con animaciones - Similar a TimedActivityRunner */}
                <motion.div
                  animate={isRunning && !bombExploded ? {
                    scale: [1, 1.08, 1],
                    rotate: [0, -5, 5, 0],
                  } : {}}
                  transition={{ duration: 0.5, repeat: isRunning ? Infinity : 0 }}
                  className="relative inline-block"
                >
                  <motion.span
                    className="text-[100px] block drop-shadow-2xl"
                    animate={isRunning ? {
                      filter: urgencyLevel >= 2 
                        ? ['brightness(1)', 'brightness(1.5)', 'brightness(1)']
                        : ['brightness(1)', 'brightness(1.2)', 'brightness(1)'],
                    } : {}}
                    transition={{ 
                      duration: urgencyLevel >= 3 ? 0.15 : urgencyLevel >= 2 ? 0.25 : 0.4, 
                      repeat: Infinity 
                    }}
                  >
                    {bombExploded ? '💥' : '💣'}
                  </motion.span>
                  {isRunning && !bombExploded && (
                    <>
                      <motion.div
                        animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], y: [-10, -30, -10] }}
                        transition={{ duration: 0.3, repeat: Infinity }}
                        className="absolute -top-2 right-4 text-3xl"
                      >
                        ✨
                      </motion.div>
                      <motion.div
                        animate={{ opacity: [1, 0.5, 1], scale: [1, 1.3, 1] }}
                        transition={{ duration: 0.2, repeat: Infinity }}
                        className="absolute -top-4 right-0 text-2xl"
                      >
                        🔥
                      </motion.div>
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5], y: [-5, -15, -5] }}
                        transition={{ duration: 0.25, repeat: Infinity, delay: 0.1 }}
                        className="absolute -top-6 left-4 text-xl"
                      >
                        💥
                      </motion.div>
                    </>
                  )}
                </motion.div>

                {/* Timer grande - Estilo consistente */}
                <motion.div
                  animate={urgencyLevel >= 2 ? { scale: [1, 1.03, 1] } : {}}
                  transition={{ duration: 0.4, repeat: Infinity }}
                  className="relative"
                >
                  <span className={`text-7xl font-black tracking-wider drop-shadow-lg ${
                    urgencyLevel >= 3 ? 'text-white' :
                    urgencyLevel >= 2 ? 'text-white' :
                    'text-white'
                  }`}>
                    {formatTime(elapsedSeconds)}
                  </span>
                  {/* Mensaje de estado */}
                  <motion.p 
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-white/80 text-sm mt-2 font-medium"
                  >
                    {urgencyLevel >= 3 ? '🔥 ¡PELIGRO! ¡Va a explotar!' :
                     urgencyLevel >= 2 ? '⚠️ ¡Cuidado! El tiempo se acaba' :
                     '💣 ¡Puede explotar en cualquier momento!'}
                  </motion.p>
                </motion.div>

                {/* Current student - Tarjeta mejorada */}
                {currentStudent && !bombExploded && (
                  <motion.div
                    key={currentStudent.id}
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className={`bg-white/95 backdrop-blur-sm rounded-2xl p-5 shadow-2xl border-2 max-w-sm mx-auto ${
                      isSelectingNext 
                        ? 'border-amber-400' 
                        : urgencyLevel >= 2 
                          ? 'border-red-400' 
                          : 'border-purple-400'
                    }`}
                  >
                    <div className="flex items-center gap-1 justify-center mb-3">
                      <span className={`w-2 h-2 rounded-full ${isSelectingNext ? 'bg-amber-500 animate-pulse' : 'bg-purple-500'}`}></span>
                      <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">
                        {isSelectingNext ? 'Seleccionando...' : 'Tiene la bomba'}
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-4">
                      <motion.div
                        animate={isSelectingNext ? { rotate: [0, 10, -10, 0] } : {}}
                        transition={{ duration: 0.2, repeat: isSelectingNext ? Infinity : 0 }}
                        className="relative"
                      >
                        <img
                          src={getAvatarUrl(currentStudent)}
                          alt="Avatar"
                          className="w-16 h-16 rounded-full border-4 border-purple-200 shadow-lg"
                        />
                        {!isSelectingNext && (
                          <motion.div 
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 0.5, repeat: Infinity }}
                            className="absolute -top-1 -right-1 text-lg"
                          >
                            💣
                          </motion.div>
                        )}
                      </motion.div>
                      <div className="text-left">
                        <h3 className="text-lg font-bold text-gray-800">
                          {currentStudent.characterName || currentStudent.realName}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {getClassInfo(currentStudent.characterClass).icon} {getClassInfo(currentStudent.characterClass).name} • Nivel {currentStudent.level}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Action button - Estilo mejorado */}
                {!bombExploded && currentStudent && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={selectNextStudent}
                    disabled={isSelectingNext || markCompleteMutation.isPending}
                    className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 mx-auto"
                  >
                    <Check size={22} />
                    <span className="text-lg">¡Correcto! Pasar bomba</span>
                  </motion.button>
                )}

                {/* Game over - Mostrar quién perdió */}
                {bombExploded && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <p className="text-white font-black text-2xl drop-shadow-lg">
                      💥 ¡La bomba explotó!
                    </p>
                    
                    {/* Mostrar estudiante que perdió */}
                    {explodedStudent && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-2xl border-2 border-red-400 max-w-sm mx-auto"
                      >
                        <div className="flex items-center gap-1 justify-center mb-2">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          <p className="text-xs text-red-600 uppercase tracking-wider font-semibold">
                            Le explotó la bomba
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <div className="relative">
                            <img
                              src={getAvatarUrl(explodedStudent)}
                              alt="Avatar"
                              className="w-14 h-14 rounded-full border-4 border-red-200 shadow-lg"
                            />
                            <motion.div 
                              animate={{ scale: [1, 1.3, 1] }}
                              transition={{ duration: 0.5, repeat: Infinity }}
                              className="absolute -top-1 -right-1 text-lg"
                            >
                              💥
                            </motion.div>
                          </div>
                          <div className="text-left">
                            <h3 className="text-lg font-bold text-gray-800">
                              {explodedStudent.characterName || explodedStudent.realName}
                            </h3>
                            <p className="text-sm text-red-500 font-semibold">
                              -{activity.bombPenaltyPoints} {activity.bombPenaltyType}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => resetMutation.mutate()}
                      disabled={resetMutation.isPending}
                      className="flex items-center gap-2 px-6 py-3 bg-white text-gray-800 font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 mx-auto"
                    >
                      <RotateCcw size={20} />
                      Jugar de nuevo
                    </motion.button>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Borde decorativo */}
          <div className="absolute inset-0 rounded-3xl border-2 border-white/20 pointer-events-none" />
        </motion.div>

        {/* Sidebar - Students list - Homologado con TimedActivityRunner */}
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
                <span className="text-2xl font-black text-gray-800">{completedStudents.length}</span>
                <span className="text-gray-400">/{students.length}</span>
              </div>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
            <motion.div 
              className={`h-full bg-gradient-to-r ${theme.gradient} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${(completedStudents.length / Math.max(students.length, 1)) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Lista de estudiantes */}
          <div className="space-y-2 flex-1 overflow-y-auto max-h-[320px] pr-1">
            {/* Exploded student - Mostrar primero si existe */}
            {explodedStudent && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-200"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <motion.div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md bg-gradient-to-br from-red-400 to-rose-500"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    💥
                  </motion.div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate text-sm">
                      {explodedStudent.characterName || explodedStudent.realName}
                    </p>
                    <span className="text-red-600 font-semibold flex items-center gap-1 text-xs">
                      💥 -{activity.bombPenaltyPoints} {activity.bombPenaltyType}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Completed students */}
            {completedStudents.map((student, index) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <motion.div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md bg-gradient-to-br from-emerald-400 to-green-500"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.3 }}
                  >
                    <Check size={18} />
                  </motion.div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate text-sm">
                      {student.characterName || student.realName}
                    </p>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1 text-xs">
                      <Trophy size={10} />
                      +{activity.basePoints} {activity.pointType}
                    </span>
                  </div>
                </div>
                <span className="text-emerald-500 text-lg">✓</span>
              </motion.div>
            ))}

            {/* Remaining students (waiting) */}
            {gameStarted && remainingStudents.map((student, index) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-transparent"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md bg-gradient-to-br from-gray-400 to-gray-500">
                    {student.characterName?.[0] || student.realName?.[0] || '?'}
                  </div>
                  <p className="font-semibold text-gray-800 truncate text-sm">
                    {student.characterName || student.realName}
                  </p>
                </div>
              </motion.div>
            ))}

            {/* Not started yet - show all students */}
            {!gameStarted && students.map((student, index) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-transparent"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md bg-gradient-to-br from-gray-400 to-gray-500">
                    {student.characterName?.[0] || student.realName?.[0] || '?'}
                  </div>
                  <p className="font-semibold text-gray-800 truncate text-sm">
                    {student.characterName || student.realName}
                  </p>
                </div>
              </motion.div>
            ))}

            {students.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <Users size={40} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay estudiantes en esta clase</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
