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
} from 'lucide-react';
import { Button } from '../ui/Button';
import { classroomApi } from '../../lib/classroomApi';
import {
  timedActivityApi,
  type TimedActivity,
} from '../../lib/timedActivityApi';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

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
  
  // Turnos aleatorios
  const [remainingStudents, setRemainingStudents] = useState<Student[]>([]);
  const [completedStudents, setCompletedStudents] = useState<Student[]>([]);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [isSelectingNext, setIsSelectingNext] = useState(false);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

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
          
          // Marcar al estudiante actual como explotado
          if (currentStudent) {
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
  }, [isRunning, gameStarted, activity.actualBombTime, bombExploded, currentStudent]);

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

  return (
    <div className="min-h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br from-pink-500 to-rose-500 shadow-pink-500/30">
            <Shuffle size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">
              {activity.name}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Bomba Aleatoria - Turnos al azar
            </p>
          </div>
        </div>

        {/* Info badges */}
        <div className="flex gap-2">
          <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-sm">
            <Trophy size={14} />
            +{activity.basePoints} {activity.pointType}
          </span>
          <span className="flex items-center gap-1 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm">
            <AlertTriangle size={14} />
            -{activity.bombPenaltyPoints} {activity.bombPenaltyType}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 grid lg:grid-cols-3 gap-6">
        {/* Bomb & Current Student - Main Area */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center relative overflow-hidden">
          {/* Background gradient based on urgency */}
          <div className={`absolute inset-0 transition-all duration-500 ${
            urgencyLevel === 3 ? 'bg-gradient-to-br from-red-500/20 to-orange-500/20' :
            urgencyLevel === 2 ? 'bg-gradient-to-br from-orange-500/10 to-amber-500/10' :
            urgencyLevel === 1 ? 'bg-gradient-to-br from-amber-500/5 to-yellow-500/5' :
            'bg-gradient-to-br from-pink-500/5 to-rose-500/5'
          }`} />

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
          <div className="relative z-10 text-center w-full max-w-md">
            {!gameStarted ? (
              // Start screen
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="text-8xl mb-6">💣</div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  Bomba Aleatoria
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  La bomba pasará de estudiante en estudiante al azar.
                  <br />
                  ¡El que tenga la bomba cuando explote pierde HP!
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Users size={16} />
                  {students.length} estudiantes participarán
                </div>
                <Button
                  size="lg"
                  onClick={startGame}
                  disabled={startMutation.isPending || students.length === 0}
                  className="gap-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-lg shadow-pink-500/30 px-8"
                >
                  <Play size={20} />
                  ¡Iniciar Bomba!
                </Button>
              </motion.div>
            ) : (
              // Game in progress
              <div className="space-y-6">
                {/* Bomb with animation */}
                <motion.div
                  animate={isRunning && !bombExploded ? {
                    scale: [1, 1.05, 1],
                    rotate: [0, -3, 3, 0],
                  } : {}}
                  transition={{ duration: 0.4, repeat: isRunning ? Infinity : 0 }}
                  className="relative inline-block"
                >
                  <motion.span
                    className="text-7xl block"
                    animate={isRunning ? {
                      filter: urgencyLevel >= 2 
                        ? ['brightness(1)', 'brightness(1.5)', 'brightness(1)']
                        : ['brightness(1)', 'brightness(1.2)', 'brightness(1)'],
                    } : {}}
                    transition={{ 
                      duration: urgencyLevel >= 3 ? 0.2 : urgencyLevel >= 2 ? 0.3 : 0.5, 
                      repeat: Infinity 
                    }}
                  >
                    {bombExploded ? '💥' : '💣'}
                  </motion.span>
                  {isRunning && !bombExploded && (
                    <>
                      <motion.div
                        animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5], y: [-5, -15, -5] }}
                        transition={{ duration: 0.2, repeat: Infinity }}
                        className="absolute -top-1 right-2 text-xl"
                      >
                        ✨
                      </motion.div>
                      <motion.div
                        animate={{ opacity: [1, 0.5, 1], scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.15, repeat: Infinity }}
                        className="absolute -top-3 right-0 text-lg"
                      >
                        🔥
                      </motion.div>
                    </>
                  )}
                </motion.div>

                {/* Timer */}
                <motion.div
                  animate={urgencyLevel >= 2 ? { scale: [1, 1.02, 1] } : {}}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className={`text-5xl font-mono font-black ${
                    urgencyLevel >= 3 ? 'text-red-500' :
                    urgencyLevel >= 2 ? 'text-orange-500' :
                    urgencyLevel >= 1 ? 'text-amber-500' :
                    'text-gray-800 dark:text-white'
                  }`}
                >
                  {formatTime(elapsedSeconds)}
                </motion.div>

                {/* Current student */}
                {currentStudent && !bombExploded && (
                  <motion.div
                    key={currentStudent.id}
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className={`bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-2xl p-6 shadow-lg border-2 ${
                      isSelectingNext 
                        ? 'border-amber-400 animate-pulse' 
                        : urgencyLevel >= 2 
                          ? 'border-red-400' 
                          : 'border-pink-400'
                    }`}
                  >
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                      {isSelectingNext ? '🎲 Seleccionando...' : '💣 Tiene la bomba'}
                    </p>
                    <div className="flex items-center justify-center gap-4">
                      <motion.img
                        src={getAvatarUrl(currentStudent)}
                        alt="Avatar"
                        className="w-20 h-20 rounded-full border-4 border-white dark:border-gray-600 shadow-lg"
                        animate={isSelectingNext ? { rotate: [0, 10, -10, 0] } : {}}
                        transition={{ duration: 0.2, repeat: isSelectingNext ? Infinity : 0 }}
                      />
                      <div className="text-left">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                          {currentStudent.characterName || currentStudent.realName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {getClassInfo(currentStudent.characterClass).icon} {getClassInfo(currentStudent.characterClass).name} • Nivel {currentStudent.level}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Action buttons */}
                {!bombExploded && currentStudent && (
                  <div className="flex gap-3 justify-center">
                    <Button
                      size="lg"
                      onClick={selectNextStudent}
                      disabled={isSelectingNext || markCompleteMutation.isPending}
                      className="gap-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 shadow-lg shadow-emerald-500/30"
                    >
                      <Check size={20} />
                      ¡Correcto! Pasar bomba
                    </Button>
                  </div>
                )}

                {/* Game over */}
                {bombExploded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <p className="text-red-500 font-bold text-xl">
                      💥 ¡La bomba explotó!
                    </p>
                    <Button
                      size="lg"
                      onClick={() => resetMutation.mutate()}
                      disabled={resetMutation.isPending}
                      className="gap-2 bg-gradient-to-r from-gray-500 to-slate-500 hover:from-gray-600 hover:to-slate-600"
                    >
                      <RotateCcw size={20} />
                      Jugar de nuevo
                    </Button>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Students list */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-gray-500" />
              <span className="font-bold text-gray-800 dark:text-white">Progreso</span>
            </div>
            <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
              {completedStudents.length}/{students.length}
            </span>
          </div>

          {/* Completed students */}
          {completedStudents.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-2 uppercase tracking-wider">
                ✓ Completaron
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {completedStudents.map((student) => (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg"
                  >
                    <img
                      src={getAvatarUrl(student)}
                      alt=""
                      className="w-8 h-8 rounded-full"
                    />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300 truncate">
                      {student.characterName || student.realName}
                    </span>
                    <Check size={14} className="text-emerald-500 ml-auto flex-shrink-0" />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Remaining students */}
          {remainingStudents.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wider">
                ⏳ Esperando ({remainingStudents.length})
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {remainingStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <img
                      src={getAvatarUrl(student)}
                      alt=""
                      className="w-8 h-8 rounded-full opacity-60"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {student.characterName || student.realName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not started yet */}
          {!gameStarted && students.length > 0 && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <img
                    src={getAvatarUrl(student)}
                    alt=""
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                    {student.characterName || student.realName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
