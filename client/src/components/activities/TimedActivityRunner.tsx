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
} from 'lucide-react';
import { Button } from '../ui/Button';
import { classroomApi } from '../../lib/classroomApi';
import {
  timedActivityApi,
  type TimedActivity,
  MODE_CONFIG,
} from '../../lib/timedActivityApi';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

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
  }, [isRunning, activity.mode, activity.actualBombTime, activity.timeLimitSeconds, bombExploded]);

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
  const timeDisplay = activity.mode === 'TIMER' ? formatTime(getRemainingTime()) : formatTime(elapsedSeconds);

  return (
    <div className="min-h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg ${
            activity.mode === 'STOPWATCH' ? 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-blue-500/30' :
            activity.mode === 'TIMER' ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/30' :
            'bg-gradient-to-br from-red-500 to-pink-500 shadow-red-500/30'
          }`}>
            {activity.mode === 'STOPWATCH' ? <Timer size={22} /> :
             activity.mode === 'TIMER' ? <Clock size={22} /> :
             <Bomb size={22} />}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">
              {activity.name}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {modeConfig.label}
            </p>
          </div>
        </div>

        {/* Info badges */}
        <div className="flex gap-2">
          <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-sm">
            <Trophy size={14} />
            +{activity.basePoints} {activity.pointType}
          </span>
          {activity.useMultipliers && (
            <span className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm">
              <Zap size={14} />
              Multiplicadores
            </span>
          )}
          {activity.mode === 'BOMB' && (
            <span className="flex items-center gap-1 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm">
              <AlertTriangle size={14} />
              -{activity.bombPenaltyPoints} {activity.bombPenaltyType}
            </span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 grid lg:grid-cols-2 gap-6">
        {/* Timer Display */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center relative overflow-hidden">
          {/* Background decoration */}
          <div className={`absolute inset-0 opacity-5 ${
            activity.mode === 'STOPWATCH' ? 'bg-gradient-to-br from-blue-500 to-cyan-500' :
            activity.mode === 'TIMER' ? 'bg-gradient-to-br from-amber-500 to-orange-500' :
            'bg-gradient-to-br from-red-500 to-pink-500'
          }`} />

          {/* Explosion overlay */}
          <AnimatePresence>
            {showExplosion && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-red-500/90 to-orange-500/90"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ 
                    scale: [0, 1.5, 1],
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                    }}
                    transition={{ duration: 0.3, repeat: 3 }}
                    className="text-9xl mb-4"
                  >
                    💥
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-4xl font-black text-white drop-shadow-lg"
                  >
                    ¡BOOM!
                  </motion.h2>
                </motion.div>
                {/* Particles */}
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ 
                      x: 0, 
                      y: 0, 
                      opacity: 1,
                      scale: 1,
                    }}
                    animate={{ 
                      x: (Math.random() - 0.5) * 400,
                      y: (Math.random() - 0.5) * 400,
                      opacity: 0,
                      scale: 0,
                    }}
                    transition={{ duration: 1, delay: Math.random() * 0.3 }}
                    className="absolute text-2xl"
                    style={{ left: '50%', top: '50%' }}
                  >
                    {['🔥', '💥', '✨', '⚡'][Math.floor(Math.random() * 4)]}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Timer content */}
          <div className="relative z-10 text-center">
            {/* Mode icon with animation */}
            {activity.mode === 'BOMB' && (
              <motion.div
                animate={isRunning && !bombExploded ? {
                  scale: [1, 1.1, 1],
                  rotate: [0, -5, 5, 0],
                } : {}}
                transition={{ duration: 0.5, repeat: isRunning ? Infinity : 0 }}
                className="mb-6"
              >
                <div className="relative inline-block">
                  <motion.span 
                    className="text-8xl block"
                    animate={isRunning ? { 
                      filter: ['brightness(1)', 'brightness(1.3)', 'brightness(1)']
                    } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    {bombExploded ? '💥' : '💣'}
                  </motion.span>
                  {isRunning && !bombExploded && (
                    <>
                      {/* Fuse sparks */}
                      <motion.div
                        animate={{ 
                          opacity: [0, 1, 0],
                          scale: [0.5, 1, 0.5],
                          y: [-10, -20, -10],
                        }}
                        transition={{ duration: 0.3, repeat: Infinity }}
                        className="absolute -top-2 right-4 text-2xl"
                      >
                        ✨
                      </motion.div>
                      <motion.div
                        animate={{ 
                          opacity: [1, 0, 1],
                          scale: [1, 0.5, 1],
                        }}
                        transition={{ duration: 0.2, repeat: Infinity }}
                        className="absolute -top-4 right-2 text-xl"
                      >
                        🔥
                      </motion.div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {activity.mode === 'STOPWATCH' && (
              <div className="mb-6">
                <motion.div
                  animate={isRunning ? { rotate: 360 } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30"
                >
                  <Timer size={48} className="text-white" />
                </motion.div>
              </div>
            )}

            {activity.mode === 'TIMER' && (
              <div className="mb-6 relative">
                {/* Progress ring */}
                <svg className="w-32 h-32 mx-auto transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="58"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-gray-200 dark:text-gray-700"
                  />
                  <motion.circle
                    cx="64"
                    cy="64"
                    r="58"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 58}
                    strokeDashoffset={2 * Math.PI * 58 * (1 - getProgress() / 100)}
                    className={`transition-all duration-100 ${
                      getProgress() > 75 ? 'text-red-500' :
                      getProgress() > 50 ? 'text-amber-500' :
                      'text-emerald-500'
                    }`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Clock size={40} className={`${
                    getProgress() > 75 ? 'text-red-500' :
                    getProgress() > 50 ? 'text-amber-500' :
                    'text-emerald-500'
                  }`} />
                </div>
              </div>
            )}

            {/* Time display */}
            <motion.div
              key={timeDisplay}
              initial={{ scale: 1 }}
              animate={isRunning ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
              className="mb-4"
            >
              <span className={`text-7xl font-mono font-black ${
                activity.mode === 'TIMER' && getProgress() > 75 ? 'text-red-500' :
                activity.mode === 'BOMB' && bombExploded ? 'text-red-500' :
                'text-gray-800 dark:text-white'
              }`}>
                {timeDisplay}
              </span>
            </motion.div>

            {/* Status message */}
            {activity.mode === 'BOMB' && isRunning && !bombExploded && (
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-red-500 font-semibold mb-4"
              >
                ⚠️ ¡La bomba puede explotar en cualquier momento!
              </motion.p>
            )}
            {bombExploded && (
              <p className="text-red-600 font-bold text-xl mb-4">
                💥 ¡LA BOMBA EXPLOTÓ!
              </p>
            )}

            {/* Multiplier indicator */}
            {activity.useMultipliers && getCurrentMultiplier() > 100 && (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full mb-4"
              >
                <Zap size={18} />
                <span className="font-bold">x{(getCurrentMultiplier() / 100).toFixed(1)} Puntos</span>
              </motion.div>
            )}

            {/* Controls */}
            <div className="flex gap-3 justify-center mt-6">
              {activity.status === 'DRAFT' && (
                <Button
                  size="lg"
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                  className="gap-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 shadow-lg shadow-emerald-500/30"
                >
                  <Play size={20} />
                  Iniciar
                </Button>
              )}

              {activity.status === 'ACTIVE' && !bombExploded && (
                <>
                  <Button
                    size="lg"
                    onClick={() => pauseMutation.mutate()}
                    disabled={pauseMutation.isPending}
                    className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30"
                  >
                    <Pause size={20} />
                    Pausar
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                    variant="secondary"
                    className="gap-2"
                  >
                    <Square size={20} />
                    Finalizar
                  </Button>
                </>
              )}

              {activity.status === 'PAUSED' && (
                <>
                  <Button
                    size="lg"
                    onClick={() => resumeMutation.mutate()}
                    disabled={resumeMutation.isPending}
                    className="gap-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 shadow-lg shadow-emerald-500/30"
                  >
                    <Play size={20} />
                    Reanudar
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                    variant="secondary"
                    className="gap-2"
                  >
                    <Square size={20} />
                    Finalizar
                  </Button>
                </>
              )}

              {(activity.status === 'COMPLETED' || bombExploded) && (
                <Button
                  size="lg"
                  onClick={() => resetMutation.mutate()}
                  disabled={resetMutation.isPending}
                  className="gap-2 bg-gradient-to-r from-gray-500 to-slate-500 hover:from-gray-600 hover:to-slate-600"
                >
                  <RotateCcw size={20} />
                  Reiniciar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Student List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-gray-500" />
              <span className="font-bold text-gray-800 dark:text-white">Estudiantes</span>
            </div>
            <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
              {completedStudentIds.size}/{students.length} completaron
            </span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {students.map((student) => {
              const isCompleted = completedStudentIds.has(student.id);
              const isExploded = explodedStudentIds.has(student.id);
              const result = activity.results?.find(r => r.studentProfileId === student.id);

              return (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl transition-all ${
                    isCompleted
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                      : isExploded
                      ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${
                      isCompleted ? 'bg-gradient-to-br from-emerald-400 to-green-500' :
                      isExploded ? 'bg-gradient-to-br from-red-400 to-pink-500' :
                      'bg-gradient-to-br from-gray-400 to-gray-500'
                    }`}>
                      {isCompleted ? <Check size={18} /> :
                       isExploded ? <Bomb size={18} /> :
                       (student.characterName?.[0] || student.realName?.[0] || '?')}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 dark:text-white truncate">
                        {student.characterName || student.realName || 'Sin nombre'}
                      </p>
                      {result && (
                        <p className="text-xs">
                          {isCompleted && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              +{result.pointsAwarded} {activity.pointType}
                              {result.multiplierApplied > 100 && ` (x${(result.multiplierApplied / 100).toFixed(1)})`}
                            </span>
                          )}
                          {isExploded && (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              -{result.penaltyApplied} {activity.bombPenaltyType}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {!isCompleted && !isExploded && (activity.status === 'ACTIVE' || activity.status === 'PAUSED' || bombExploded) && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => markCompleteMutation.mutate({ studentId: student.id })}
                        disabled={markCompleteMutation.isPending}
                        className="gap-1 bg-emerald-500 hover:bg-emerald-600 text-xs px-3"
                      >
                        <Check size={14} />
                        Completó
                      </Button>
                      {activity.mode === 'BOMB' && bombExploded && (
                        <Button
                          size="sm"
                          onClick={() => markExplodedMutation.mutate({ studentId: student.id })}
                          disabled={markExplodedMutation.isPending}
                          className="gap-1 bg-red-500 hover:bg-red-600 text-xs px-3"
                        >
                          <Bomb size={14} />
                          Explotó
                        </Button>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
