import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, 
  MicOff, 
  AlertTriangle,
  ArrowLeft,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Trophy,
  Flame,
  Leaf,
  Wind,
  Sparkles,
  Clock,
  Target,
  TrendingUp,
  Check,
  StopCircle,
  Gift,
  Coins,
  Star,
  Users,
  Loader2
} from 'lucide-react';
import { studentApi } from '../../lib/studentApi';
import toast from 'react-hot-toast';

interface AulaZenActivityProps {
  classroom: any;
  onBack: () => void;
}

type GameState = 'config' | 'playing' | 'paused' | 'finished';
type ZenState = 'zen' | 'calm' | 'alert' | 'chaos';

interface GameConfig {
  duration: number; // en segundos
  maxThreshold: number; // 0-100
  pointsPerSecond: number;
  penaltyPoints: number;
  streakMultiplier: number;
}

interface GameStats {
  totalPoints: number;
  timeInZen: number;
  timeInChaos: number;
  peakNoise: number;
  longestStreak: number;
  currentStreak: number;
  chaosCount: number;
}

const DEFAULT_CONFIG: GameConfig = {
  duration: 300, // 5 minutos
  maxThreshold: 60,
  pointsPerSecond: 1,
  penaltyPoints: 5,
  streakMultiplier: 0.1, // 10% extra por cada 10 segundos de racha
};

export const AulaZenActivity = ({ classroom, onBack }: AulaZenActivityProps) => {
  // Estados del juego
  const [gameState, setGameState] = useState<GameState>('config');
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [timeRemaining, setTimeRemaining] = useState(DEFAULT_CONFIG.duration);
  const [stats, setStats] = useState<GameStats>({
    totalPoints: 0,
    timeInZen: 0,
    timeInChaos: 0,
    peakNoise: 0,
    longestStreak: 0,
    currentStreak: 0,
    chaosCount: 0,
  });

  // Estados del audio
  const [noiseLevel, setNoiseLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  
  // Estados para recompensas
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardXP, setRewardXP] = useState(10);
  const [rewardGP, setRewardGP] = useState(5);
  const [isGivingRewards, setIsGivingRewards] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  
  // Referencias
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const gameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noiseLevelRef = useRef(0);

  // Historial de ruido para el gráfico
  const [noiseHistory, setNoiseHistory] = useState<number[]>(Array(60).fill(0));

  // Calcular el estado zen basado en el nivel de ruido
  const getZenState = useCallback((level: number): ZenState => {
    const threshold = config.maxThreshold;
    if (level < threshold * 0.4) return 'zen';
    if (level < threshold * 0.7) return 'calm';
    if (level < threshold) return 'alert';
    return 'chaos';
  }, [config.maxThreshold]);

  const zenState = getZenState(noiseLevel);

  // Colores y estilos según el estado
  const zenStyles = {
    zen: {
      gradient: 'from-emerald-400 to-teal-500',
      bg: 'bg-emerald-500',
      text: 'text-emerald-500',
      glow: 'shadow-emerald-500/50',
      icon: Leaf,
      label: '🧘 Zen Perfecto',
      message: 'El aula está en perfecta armonía',
    },
    calm: {
      gradient: 'from-green-400 to-emerald-500',
      bg: 'bg-green-500',
      text: 'text-green-500',
      glow: 'shadow-green-500/50',
      icon: Wind,
      label: '😌 Tranquilo',
      message: 'Buen ambiente, sigan así',
    },
    alert: {
      gradient: 'from-yellow-400 to-orange-500',
      bg: 'bg-yellow-500',
      text: 'text-yellow-500',
      glow: 'shadow-yellow-500/50',
      icon: AlertTriangle,
      label: '⚠️ Alerta',
      message: 'El ruido está subiendo...',
    },
    chaos: {
      gradient: 'from-red-400 to-rose-500',
      bg: 'bg-red-500',
      text: 'text-red-500',
      glow: 'shadow-red-500/50',
      icon: Flame,
      label: '🔥 ¡Caos!',
      message: '¡Demasiado ruido!',
    },
  };

  const currentStyle = zenStyles[zenState];
  const ZenIcon = currentStyle.icon;

  // Función para calcular el nivel de ruido
  const calculateNoiseLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = Math.min(100, Math.round((average / 128) * 100));
    
    setNoiseLevel(normalizedLevel);
    noiseLevelRef.current = normalizedLevel;

    // Actualizar historial
    setNoiseHistory(prev => [...prev.slice(1), normalizedLevel]);

    animationFrameRef.current = requestAnimationFrame(calculateNoiseLevel);
  }, []);

  // Iniciar el micrófono
  const startMicrophone = async () => {
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      calculateNoiseLevel();
      return true;

    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      
      if (err.name === 'NotAllowedError') {
        setError('Permiso denegado. Por favor, permite el acceso al micrófono.');
      } else if (err.name === 'NotFoundError') {
        setError('No se encontró ningún micrófono.');
      } else {
        setError('Error al acceder al micrófono: ' + err.message);
      }
      return false;
    }
  };

  // Detener el micrófono
  const stopMicrophone = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  // Iniciar el juego
  const startGame = async () => {
    const micStarted = await startMicrophone();
    if (!micStarted) return;

    setTimeRemaining(config.duration);
    setStats({
      totalPoints: 0,
      timeInZen: 0,
      timeInChaos: 0,
      peakNoise: 0,
      longestStreak: 0,
      currentStreak: 0,
      chaosCount: 0,
    });
    setNoiseHistory(Array(60).fill(0));
    setGameState('playing');
  };

  // Pausar/Reanudar
  const togglePause = () => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  };

  // Reiniciar
  const resetGame = () => {
    stopMicrophone();
    setGameState('config');
    setNoiseLevel(0);
    setTimeRemaining(config.duration);
    setShowFinishConfirm(false);
  };

  // Finalizar anticipadamente
  const finishEarly = () => {
    stopMicrophone();
    setGameState('finished');
    setShowFinishConfirm(false);
  };

  // Dar recompensas a todos los estudiantes
  const giveRewardsToClass = async () => {
    if (!classroom?.students?.length) {
      toast.error('No hay estudiantes en la clase');
      return;
    }

    setIsGivingRewards(true);
    try {
      const students = classroom.students;
      const reason = `Recompensa Aula Zen - ${stats.totalPoints} puntos conseguidos`;
      
      // Dar XP y GP a cada estudiante
      const promises = students.map(async (student: any) => {
        // Dar XP
        if (rewardXP > 0) {
          await studentApi.updatePoints(student.id, {
            pointType: 'XP',
            amount: rewardXP,
            reason,
          });
        }
        // Dar GP
        if (rewardGP > 0) {
          await studentApi.updatePoints(student.id, {
            pointType: 'GP',
            amount: rewardGP,
            reason,
          });
        }
      });

      await Promise.all(promises);
      toast.success(`¡Recompensas entregadas a ${students.length} estudiantes!`);
      setShowRewardModal(false);
    } catch (err) {
      console.error('Error giving rewards:', err);
      toast.error('Error al entregar recompensas');
    } finally {
      setIsGivingRewards(false);
    }
  };

  // Loop del juego
  useEffect(() => {
    if (gameState !== 'playing') {
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current);
      }
      return;
    }

    gameIntervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setGameState('finished');
          stopMicrophone();
          return 0;
        }
        return prev - 1;
      });

      // Actualizar estadísticas
      setStats(prev => {
        const currentNoise = noiseLevelRef.current;
        const currentZenState = getZenState(currentNoise);
        const isZen = currentZenState === 'zen' || currentZenState === 'calm';
        const isChaos = currentZenState === 'chaos';

        let newStreak = isZen ? prev.currentStreak + 1 : 0;
        let newLongestStreak = Math.max(prev.longestStreak, newStreak);
        
        // Calcular puntos con multiplicador de racha
        let pointsEarned = 0;
        if (isZen) {
          const streakBonus = 1 + Math.floor(newStreak / 10) * config.streakMultiplier;
          pointsEarned = Math.round(config.pointsPerSecond * streakBonus);
        } else if (isChaos) {
          pointsEarned = -config.penaltyPoints;
        }

        return {
          totalPoints: Math.max(0, prev.totalPoints + pointsEarned),
          timeInZen: prev.timeInZen + (isZen ? 1 : 0),
          timeInChaos: prev.timeInChaos + (isChaos ? 1 : 0),
          peakNoise: Math.max(prev.peakNoise, currentNoise),
          longestStreak: newLongestStreak,
          currentStreak: newStreak,
          chaosCount: prev.chaosCount + (isChaos && prev.currentStreak > 0 ? 1 : 0),
        };
      });
    }, 1000);

    return () => {
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current);
      }
    };
  }, [gameState, config, getZenState]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopMicrophone();
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current);
      }
    };
  }, []);

  // Formatear tiempo
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Pantalla de configuración
  if (gameState === 'config') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
              <Leaf size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">
                🧘 Aula Zen
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Configura la actividad antes de comenzar
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
            <AlertTriangle className="text-red-500 flex-shrink-0" size={20} />
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Configuración principal */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg space-y-6">
          {/* Duración */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <Clock size={16} className="inline mr-2" />
              Duración de la actividad
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[60, 180, 300, 600].map((seconds) => (
                <button
                  key={seconds}
                  onClick={() => {
                    setConfig(prev => ({ ...prev, duration: seconds }));
                    setTimeRemaining(seconds);
                  }}
                  className={`
                    py-3 px-4 rounded-xl font-medium transition-all
                    ${config.duration === seconds
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  {formatTime(seconds)}
                </button>
              ))}
            </div>
          </div>

          {/* Umbral máximo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <Target size={16} className="inline mr-2" />
              Umbral máximo de ruido: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{config.maxThreshold}%</span>
            </label>
            <input
              type="range"
              min="30"
              max="90"
              value={config.maxThreshold}
              onChange={(e) => setConfig(prev => ({ ...prev, maxThreshold: Number(e.target.value) }))}
              className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
              <span>Muy estricto (30%)</span>
              <span>Relajado (90%)</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Si el ruido supera este umbral, se considera "caos" y se pierden puntos.
            </p>
          </div>

          {/* Configuración avanzada */}
          <div>
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              <Settings size={16} />
              Configuración avanzada
              <motion.span
                animate={{ rotate: showAdvancedSettings ? 180 : 0 }}
                className="ml-auto"
              >
                ▼
              </motion.span>
            </button>

            <AnimatePresence>
              {showAdvancedSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Puntos por segundo en zen
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={config.pointsPerSecond}
                        onChange={(e) => setConfig(prev => ({ ...prev, pointsPerSecond: Number(e.target.value) }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Penalización por caos
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={config.penaltyPoints}
                        onChange={(e) => setConfig(prev => ({ ...prev, penaltyPoints: Number(e.target.value) }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Botón de inicio */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={startGame}
          className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all flex items-center justify-center gap-3"
        >
          <Play size={24} />
          Comenzar Aula Zen
        </motion.button>

        {/* Info */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
          <h4 className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm mb-2">
            ¿Cómo funciona?
          </h4>
          <ul className="text-emerald-600 dark:text-emerald-400 text-xs space-y-1">
            <li>• Mantén el aula en silencio para ganar puntos</li>
            <li>• Las rachas de silencio dan puntos extra</li>
            <li>• Si el ruido supera el umbral, pierdes puntos</li>
            <li>• Al final, puedes dar recompensas a la clase</li>
          </ul>
        </div>
      </div>
    );
  }

  // Pantalla de resultados - Animación tipo Kahoot
  if (gameState === 'finished') {
    const zenPercentage = Math.round((stats.timeInZen / config.duration) * 100);
    const grade = zenPercentage >= 90 ? 'S' : zenPercentage >= 75 ? 'A' : zenPercentage >= 60 ? 'B' : zenPercentage >= 40 ? 'C' : 'D';
    const gradeColors: Record<string, string> = {
      'S': 'from-yellow-400 to-amber-500',
      'A': 'from-emerald-400 to-teal-500',
      'B': 'from-blue-400 to-indigo-500',
      'C': 'from-orange-400 to-red-500',
      'D': 'from-gray-400 to-gray-500',
    };
    const gradeEmoji: Record<string, string> = {
      'S': '🏆',
      'A': '🌟',
      'B': '👍',
      'C': '💪',
      'D': '🎯',
    };
    const gradeMessage: Record<string, string> = {
      'S': '¡PERFECCIÓN ABSOLUTA!',
      'A': '¡Excelente trabajo!',
      'B': '¡Buen esfuerzo!',
      'C': 'Pueden mejorar',
      'D': 'A practicar más',
    };

    return (
      <div className="min-h-[calc(100vh-200px)] relative overflow-hidden">
        {/* Fondo animado de celebración */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            className={`absolute inset-0 bg-gradient-to-br ${gradeColors[grade]}`}
          />
          {/* Confetti de emojis */}
          {grade === 'S' || grade === 'A' ? (
            [...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-3xl"
                initial={{ 
                  x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 800), 
                  y: -50,
                  rotate: 0
                }}
                animate={{ 
                  y: (typeof window !== 'undefined' ? window.innerHeight : 600) + 100,
                  rotate: 360 * (Math.random() > 0.5 ? 1 : -1)
                }}
                transition={{ 
                  duration: 4 + Math.random() * 3,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: 'linear'
                }}
              >
                {['🧘', '🍃', '✨', '🌟', '💫', '🎉'][Math.floor(Math.random() * 6)]}
              </motion.div>
            ))
          ) : null}
        </div>

        <div className="space-y-6 relative z-10">
          {/* Header con animación dramática */}
          <div className="text-center py-8">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 10, duration: 0.8 }}
              className="relative inline-block"
            >
              {/* Glow de fondo */}
              <motion.div
                className={`absolute inset-0 rounded-full blur-2xl bg-gradient-to-br ${gradeColors[grade]}`}
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <div className={`relative w-32 h-32 mx-auto bg-gradient-to-br ${gradeColors[grade]} rounded-full flex items-center justify-center text-white shadow-2xl border-4 border-white/30`}>
                <motion.span 
                  className="text-6xl font-black"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {grade}
                </motion.span>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-6"
            >
              <div className="text-5xl mb-3">{gradeEmoji[grade]}</div>
              <h1 className="text-3xl font-black text-gray-800 dark:text-white mb-2">
                {gradeMessage[grade]}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                Sesión de Aula Zen completada
              </p>
            </motion.div>
          </div>

          {/* Estadísticas con animación escalonada */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl"
          >
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Trophy, color: 'emerald', value: stats.totalPoints, label: 'Puntos totales', delay: 1 },
                { icon: Leaf, color: 'blue', value: `${zenPercentage}%`, label: 'Tiempo en zen', delay: 1.2 },
                { icon: Flame, color: 'purple', value: formatTime(stats.longestStreak), label: 'Racha más larga', delay: 1.4 },
                { icon: TrendingUp, color: 'orange', value: `${stats.peakNoise}%`, label: 'Pico máximo', delay: 1.6 },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: stat.delay, type: 'spring' }}
                  whileHover={{ scale: 1.05 }}
                  className={`text-center p-5 bg-${stat.color}-50 dark:bg-${stat.color}-900/20 rounded-2xl border border-${stat.color}-200 dark:border-${stat.color}-800/50 shadow-lg`}
                >
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                  >
                    <stat.icon className={`w-10 h-10 mx-auto text-${stat.color}-500 mb-2`} />
                  </motion.div>
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: stat.delay + 0.2, type: 'spring' }}
                    className={`text-3xl font-black text-${stat.color}-600 dark:text-${stat.color}-400`}
                  >
                    {stat.value}
                  </motion.div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            {stats.chaosCount > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
                className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-center border border-red-200 dark:border-red-800/50"
              >
                <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                  ⚠️ Momentos de caos: {stats.chaosCount}
                </span>
              </motion.div>
            )}
          </motion.div>

        {/* Sección de recompensas - Mejorada */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2 }}
        >
          {!showRewardModal ? (
            <motion.button
              whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(245, 158, 11, 0.5)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowRewardModal(true)}
              className="w-full py-5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-amber-500/30 transition-all flex items-center justify-center gap-3 relative overflow-hidden"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
              <Gift size={24} className="relative z-10" />
              <span className="relative z-10">🎁 Dar recompensas a la clase</span>
              <Users size={20} className="relative z-10" />
            </motion.button>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-3xl p-6 border-2 border-amber-300 dark:border-amber-700 shadow-2xl"
            >
              <h3 className="font-black text-xl text-gray-800 dark:text-white mb-5 flex items-center justify-center gap-2">
                <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 1, repeat: Infinity }}>
                  <Gift className="text-amber-500" size={28} />
                </motion.div>
                Recompensas para la clase
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 border border-purple-200 dark:border-purple-800">
                  <label className="block text-sm text-purple-600 dark:text-purple-400 mb-2 font-medium text-center">
                    <Star size={16} className="inline mr-1" />
                    XP por estudiante
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={rewardXP}
                    onChange={(e) => setRewardXP(Math.max(0, Number(e.target.value)))}
                    className="w-full px-4 py-3 rounded-xl border-2 border-purple-300 dark:border-purple-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-center text-2xl font-black focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  />
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-4 border border-yellow-200 dark:border-yellow-800">
                  <label className="block text-sm text-yellow-600 dark:text-yellow-400 mb-2 font-medium text-center">
                    <Coins size={16} className="inline mr-1" />
                    GP por estudiante
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={rewardGP}
                    onChange={(e) => setRewardGP(Math.max(0, Number(e.target.value)))}
                    className="w-full px-4 py-3 rounded-xl border-2 border-yellow-300 dark:border-yellow-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-center text-2xl font-black focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all"
                  />
                </div>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 text-center bg-gray-100 dark:bg-gray-700/50 rounded-xl py-2">
                👥 Se dará a <span className="font-bold text-gray-700 dark:text-gray-300">{classroom?.students?.length || 0}</span> estudiantes
              </p>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowRewardModal(false)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={giveRewardsToClass}
                  disabled={isGivingRewards || (rewardXP === 0 && rewardGP === 0)}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-yellow-500 text-white rounded-xl font-semibold hover:from-amber-500 hover:to-yellow-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                >
                  {isGivingRewards ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Entregando...
                    </>
                  ) : (
                    <>
                      <Gift size={20} />
                      ¡Entregar! 🎉
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Acciones - Mejoradas */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.2 }}
          className="flex gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={resetGame}
            className="flex-1 py-4 bg-white/80 dark:bg-gray-700/80 backdrop-blur-md text-gray-700 dark:text-gray-300 rounded-2xl font-semibold hover:bg-white dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-2 shadow-lg border border-gray-200 dark:border-gray-600"
          >
            <RotateCcw size={20} />
            Repetir
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(16, 185, 129, 0.5)' }}
            whileTap={{ scale: 0.97 }}
            onClick={onBack}
            className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-semibold shadow-xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-2"
          >
            <Check size={20} />
            Finalizar ✓
          </motion.button>
        </motion.div>
        </div>
      </div>
    );
  }

  // Pantalla de juego
  return (
    <div className="min-h-[calc(100vh-200px)] relative">
      {/* Fondo animado según estado */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            opacity: zenState === 'zen' ? 0.3 : zenState === 'calm' ? 0.2 : zenState === 'alert' ? 0.15 : 0.1
          }}
          className={`absolute inset-0 bg-gradient-to-br ${currentStyle.gradient}`}
        />
        {/* Partículas flotantes */}
        {gameState === 'playing' && zenState !== 'chaos' && (
          <>
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-4xl opacity-20"
                initial={{ 
                  x: Math.random() * window.innerWidth, 
                  y: window.innerHeight + 50 
                }}
                animate={{ 
                  y: -100,
                  x: Math.random() * window.innerWidth
                }}
                transition={{ 
                  duration: 8 + Math.random() * 4,
                  repeat: Infinity,
                  delay: i * 1.5,
                  ease: 'linear'
                }}
              >
                {zenState === 'zen' ? '🧘' : '🍃'}
              </motion.div>
            ))}
          </>
        )}
        {/* Efectos de caos */}
        {zenState === 'chaos' && (
          <motion.div
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 0.3, repeat: Infinity }}
            className="absolute inset-0 bg-red-500"
          />
        )}
      </div>

      <div className="space-y-4 relative z-10">
        {/* Header con controles - Mejorado */}
        <div className="flex items-center justify-between bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/20">
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ 
                scale: gameState === 'playing' ? [1, 1.15, 1] : 1,
                rotate: zenState === 'chaos' ? [0, -10, 10, -10, 0] : 0,
                boxShadow: zenState === 'zen' 
                  ? ['0 0 20px rgba(16, 185, 129, 0.5)', '0 0 40px rgba(16, 185, 129, 0.8)', '0 0 20px rgba(16, 185, 129, 0.5)']
                  : zenState === 'chaos'
                    ? ['0 0 20px rgba(239, 68, 68, 0.5)', '0 0 40px rgba(239, 68, 68, 0.8)', '0 0 20px rgba(239, 68, 68, 0.5)']
                    : '0 0 20px rgba(0,0,0,0.1)'
              }}
              transition={{ duration: zenState === 'chaos' ? 0.2 : 1, repeat: gameState === 'playing' ? Infinity : 0 }}
              className={`w-14 h-14 bg-gradient-to-br ${currentStyle.gradient} rounded-2xl flex items-center justify-center text-white shadow-xl`}
            >
              <ZenIcon size={28} />
            </motion.div>
            <div>
              <motion.h1 
                key={zenState}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-black text-gray-800 dark:text-white"
              >
                {currentStyle.label}
              </motion.h1>
              <motion.p 
                key={`msg-${zenState}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-gray-500 dark:text-gray-400 text-sm"
              >
                {currentStyle.message}
              </motion.p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={togglePause}
              className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-md"
              title={gameState === 'playing' ? 'Pausar' : 'Reanudar'}
            >
              {gameState === 'playing' ? <Pause size={22} /> : <Play size={22} />}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowFinishConfirm(true)}
              className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors shadow-md"
              title="Finalizar"
            >
              <StopCircle size={22} />
            </motion.button>
          </div>
        </div>

        {/* Timer y puntos - Mejorado */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div 
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl p-4 text-center border border-white/20 shadow-lg"
            animate={timeRemaining <= 30 ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 0.5, repeat: timeRemaining <= 30 ? Infinity : 0 }}
          >
            <motion.div
              animate={timeRemaining <= 30 ? { color: ['#ef4444', '#f59e0b', '#ef4444'] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Clock size={24} className={`mx-auto mb-1 ${timeRemaining <= 30 ? 'text-red-500' : 'text-blue-500'}`} />
            </motion.div>
            <div className={`text-3xl font-black ${timeRemaining <= 30 ? 'text-red-500' : 'text-gray-800 dark:text-white'}`}>
              {formatTime(timeRemaining)}
            </div>
            <div className="text-xs text-gray-500 font-medium">Tiempo</div>
          </motion.div>
          
          <motion.div 
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl p-4 text-center border border-white/20 shadow-lg relative overflow-hidden"
            whileHover={{ scale: 1.02 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-t from-yellow-500/20 to-transparent"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <Trophy size={24} className="mx-auto text-yellow-500 mb-1 relative z-10" />
            <motion.div 
              key={stats.totalPoints}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="text-3xl font-black text-gray-800 dark:text-white relative z-10"
            >
              {stats.totalPoints}
            </motion.div>
            <div className="text-xs text-gray-500 font-medium relative z-10">Puntos</div>
          </motion.div>
          
          <motion.div 
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl p-4 text-center border border-white/20 shadow-lg relative overflow-hidden"
            animate={stats.currentStreak >= 10 ? { 
              boxShadow: ['0 0 0 rgba(168, 85, 247, 0)', '0 0 20px rgba(168, 85, 247, 0.5)', '0 0 0 rgba(168, 85, 247, 0)']
            } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Sparkles size={24} className="mx-auto text-purple-500 mb-1" />
            <div className="text-3xl font-black text-gray-800 dark:text-white">
              x{(1 + Math.floor(stats.currentStreak / 10) * config.streakMultiplier).toFixed(1)}
            </div>
            <div className="text-xs text-gray-500 font-medium">Multiplicador</div>
          </motion.div>
        </div>

      {/* Medidor principal - Mejorado */}
      <motion.div 
        className={`bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-3xl p-8 border-2 shadow-2xl transition-colors duration-500 ${
          zenState === 'zen' ? 'border-emerald-400/50' :
          zenState === 'calm' ? 'border-green-400/50' :
          zenState === 'alert' ? 'border-yellow-400/50' :
          'border-red-400/50'
        }`}
        animate={zenState === 'chaos' ? { x: [-2, 2, -2, 2, 0] } : {}}
        transition={{ duration: 0.3, repeat: zenState === 'chaos' ? Infinity : 0 }}
      >
        <div className="flex flex-col items-center">
          {/* Círculo del medidor - Más grande y dramático */}
          <div className="relative w-72 h-72 mb-6">
            {/* Glow de fondo */}
            <motion.div
              className={`absolute inset-4 rounded-full blur-2xl ${currentStyle.bg}`}
              animate={{ opacity: [0.2, 0.4, 0.2], scale: [0.9, 1, 0.9] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            
            <svg className="w-full h-full transform -rotate-90 relative z-10">
              {/* Fondo del círculo */}
              <circle
                cx="144"
                cy="144"
                r="120"
                fill="none"
                stroke="currentColor"
                strokeWidth="16"
                className="text-gray-200 dark:text-gray-700"
              />
              {/* Progreso del ruido */}
              <motion.circle
                cx="144"
                cy="144"
                r="120"
                fill="none"
                stroke="url(#noiseGradient)"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${noiseLevel * 7.54} 754`}
                style={{ filter: 'drop-shadow(0 0 8px currentColor)' }}
              />
              {/* Marcador del umbral */}
              <circle
                cx="144"
                cy="144"
                r="120"
                fill="none"
                stroke="#ef4444"
                strokeWidth="3"
                strokeDasharray={`${config.maxThreshold * 7.54} 754`}
                opacity="0.5"
              />
              {/* Gradiente dinámico */}
              <defs>
                <linearGradient id="noiseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={zenState === 'chaos' ? '#ef4444' : zenState === 'alert' ? '#f59e0b' : '#10b981'} />
                  <stop offset="100%" stopColor={zenState === 'chaos' ? '#dc2626' : zenState === 'alert' ? '#d97706' : '#059669'} />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Centro del medidor */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.div
                animate={{ 
                  scale: gameState === 'playing' ? [1, 1.1, 1] : 1,
                  rotate: zenState === 'chaos' ? [0, -5, 5, 0] : 0
                }}
                transition={{ duration: zenState === 'chaos' ? 0.2 : 1.5, repeat: Infinity }}
                className={`p-4 rounded-full ${zenState === 'chaos' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}
              >
                {gameState === 'playing' ? (
                  <Mic size={48} className={currentStyle.text} />
                ) : (
                  <MicOff size={48} className="text-gray-400" />
                )}
              </motion.div>
              <motion.span 
                key={noiseLevel}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className={`text-6xl font-black mt-3 ${currentStyle.text}`}
              >
                {noiseLevel}%
              </motion.span>
              <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Nivel de ruido</span>
            </div>
          </div>

          {/* Barra de progreso mejorada */}
          <div className="w-full max-w-lg">
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2 font-medium">
              <span className="flex items-center gap-1">
                <Leaf size={14} className="text-emerald-500" />
                Silencio
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <Flame size={14} />
                Umbral ({config.maxThreshold}%)
              </span>
            </div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative shadow-inner">
              {/* Marcador del umbral */}
              <motion.div 
                className="absolute top-0 bottom-0 w-1 bg-red-500 z-20 rounded-full"
                style={{ left: `${config.maxThreshold}%` }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              {/* Barra de progreso */}
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${currentStyle.gradient} shadow-lg`}
                animate={{ width: `${noiseLevel}%` }}
                transition={{ duration: 0.1 }}
                style={{ boxShadow: `0 0 20px ${zenState === 'chaos' ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.5)'}` }}
              />
            </div>
          </div>

          {/* Mini gráfico de historial mejorado */}
          <div className="w-full max-w-lg mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Historial de ruido</span>
              <span className="text-xs text-gray-400">Últimos 60 segundos</span>
            </div>
            <div className="h-20 flex items-end gap-0.5 bg-gray-100 dark:bg-gray-700/50 rounded-xl p-2">
              {noiseHistory.map((level, i) => (
                <motion.div
                  key={i}
                  className={`flex-1 rounded-t-sm ${
                    getZenState(level) === 'chaos' ? 'bg-gradient-to-t from-red-500 to-red-400' : 
                    getZenState(level) === 'alert' ? 'bg-gradient-to-t from-yellow-500 to-yellow-400' : 
                    'bg-gradient-to-t from-emerald-500 to-emerald-400'
                  }`}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(8, level)}%` }}
                  transition={{ duration: 0.1 }}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Racha actual - Mejorada */}
      {stats.currentStreak > 5 && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl p-5 text-white text-center shadow-xl shadow-emerald-500/30 relative overflow-hidden"
        >
          {/* Efecto de brillo */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
          <div className="flex items-center justify-center gap-3 relative z-10">
            <motion.div
              animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Flame size={28} />
            </motion.div>
            <div>
              <span className="font-black text-xl">
                ¡Racha de {formatTime(stats.currentStreak)}!
              </span>
              {stats.currentStreak >= 10 && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="ml-3 bg-white/30 px-3 py-1 rounded-full text-sm font-bold"
                >
                  🔥 +{Math.floor(stats.currentStreak / 10) * 10}% bonus
                </motion.span>
              )}
            </div>
          </div>
        </motion.div>
      )}
      </div>

      {/* Estado pausado */}
      {gameState === 'paused' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-2xl">
            <Pause size={48} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              Pausado
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              El tiempo está detenido
            </p>
            <button
              onClick={togglePause}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium"
            >
              Continuar
            </button>
          </div>
        </motion.div>
      )}

      {/* Modal de confirmación para finalizar */}
      <AnimatePresence>
        {showFinishConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="text-center">
                <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                  <StopCircle size={32} className="text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
                  ¿Finalizar la sesión?
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                  Aún quedan {formatTime(timeRemaining)} en el temporizador. 
                  Los puntos actuales se conservarán.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowFinishConfirm(false)}
                    className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Continuar
                  </button>
                  <button
                    onClick={finishEarly}
                    className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
                  >
                    Finalizar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AulaZenActivity;
