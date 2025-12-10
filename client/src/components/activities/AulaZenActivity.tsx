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

  // Pantalla de resultados
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

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className={`w-24 h-24 mx-auto bg-gradient-to-br ${gradeColors[grade]} rounded-full flex items-center justify-center text-white shadow-2xl mb-4`}
          >
            <span className="text-4xl font-bold">{grade}</span>
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            ¡Sesión Completada!
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {zenPercentage >= 75 ? '¡Excelente trabajo manteniendo la calma!' : 'Pueden mejorar la próxima vez'}
          </p>
        </div>

        {/* Estadísticas */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
              <Trophy className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.totalPoints}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Puntos totales</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <Leaf className="w-8 h-8 mx-auto text-blue-500 mb-2" />
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {zenPercentage}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Tiempo en zen</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
              <Flame className="w-8 h-8 mx-auto text-purple-500 mb-2" />
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatTime(stats.longestStreak)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Racha más larga</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
              <TrendingUp className="w-8 h-8 mx-auto text-orange-500 mb-2" />
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {stats.peakNoise}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Pico máximo</div>
            </div>
          </div>

          {stats.chaosCount > 0 && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
              <span className="text-sm text-red-600 dark:text-red-400">
                ⚠️ Momentos de caos: {stats.chaosCount}
              </span>
            </div>
          )}
        </div>

        {/* Sección de recompensas */}
        {!showRewardModal ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowRewardModal(true)}
            className="w-full py-4 bg-gradient-to-r from-amber-400 to-yellow-500 text-white rounded-xl font-semibold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all flex items-center justify-center gap-3"
          >
            <Gift size={20} />
            Dar recompensas a la clase
            <Users size={18} />
          </motion.button>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-amber-200 dark:border-amber-800 shadow-lg">
            <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Gift className="text-amber-500" size={20} />
              Recompensas para la clase
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <Star size={14} className="inline mr-1 text-purple-500" />
                  XP por estudiante
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={rewardXP}
                  onChange={(e) => setRewardXP(Math.max(0, Number(e.target.value)))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-center text-lg font-bold"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <Coins size={14} className="inline mr-1 text-yellow-500" />
                  GP por estudiante
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={rewardGP}
                  onChange={(e) => setRewardGP(Math.max(0, Number(e.target.value)))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-center text-lg font-bold"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-center">
              Se dará a {classroom?.students?.length || 0} estudiantes
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRewardModal(false)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={giveRewardsToClass}
                disabled={isGivingRewards || (rewardXP === 0 && rewardGP === 0)}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-white rounded-xl font-medium hover:from-amber-500 hover:to-yellow-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGivingRewards ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Entregando...
                  </>
                ) : (
                  <>
                    <Gift size={18} />
                    Entregar
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={resetGame}
            className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw size={18} />
            Repetir
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBack}
            className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all flex items-center justify-center gap-2"
          >
            <Check size={18} />
            Finalizar
          </motion.button>
        </div>
      </div>
    );
  }

  // Pantalla de juego
  return (
    <div className="space-y-4">
      {/* Header con controles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ 
              scale: gameState === 'playing' ? [1, 1.1, 1] : 1,
              rotate: zenState === 'chaos' ? [0, -5, 5, 0] : 0
            }}
            transition={{ duration: 0.5, repeat: gameState === 'playing' ? Infinity : 0 }}
            className={`w-12 h-12 bg-gradient-to-br ${currentStyle.gradient} rounded-xl flex items-center justify-center text-white shadow-lg ${currentStyle.glow}`}
          >
            <ZenIcon size={24} />
          </motion.div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">
              {currentStyle.label}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {currentStyle.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={togglePause}
            className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title={gameState === 'playing' ? 'Pausar' : 'Reanudar'}
          >
            {gameState === 'playing' ? <Pause size={20} /> : <Play size={20} />}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowFinishConfirm(true)}
            className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            title="Finalizar"
          >
            <StopCircle size={20} />
          </motion.button>
        </div>
      </div>

      {/* Timer y puntos */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center border border-gray-200 dark:border-gray-700">
          <Clock size={20} className="mx-auto text-gray-400 mb-1" />
          <div className="text-2xl font-bold text-gray-800 dark:text-white">
            {formatTime(timeRemaining)}
          </div>
          <div className="text-xs text-gray-500">Tiempo</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center border border-gray-200 dark:border-gray-700">
          <Trophy size={20} className="mx-auto text-yellow-500 mb-1" />
          <div className="text-2xl font-bold text-gray-800 dark:text-white">
            {stats.totalPoints}
          </div>
          <div className="text-xs text-gray-500">Puntos</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center border border-gray-200 dark:border-gray-700">
          <Sparkles size={20} className="mx-auto text-purple-500 mb-1" />
          <div className="text-2xl font-bold text-gray-800 dark:text-white">
            x{(1 + Math.floor(stats.currentStreak / 10) * config.streakMultiplier).toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">Multiplicador</div>
        </div>
      </div>

      {/* Medidor principal */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="flex flex-col items-center">
          {/* Círculo del medidor */}
          <div className="relative w-56 h-56 mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="112"
                cy="112"
                r="100"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-gray-200 dark:text-gray-700"
              />
              <motion.circle
                cx="112"
                cy="112"
                r="100"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${noiseLevel * 6.28} 628`}
                className={`transition-colors duration-300 ${currentStyle.text}`}
              />
              {/* Línea del umbral */}
              <circle
                cx="112"
                cy="112"
                r="100"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="4 4"
                strokeDashoffset={`${-config.maxThreshold * 6.28}`}
                className="text-red-400 dark:text-red-500"
              />
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.div
                animate={{ 
                  scale: gameState === 'playing' ? [1, 1.05, 1] : 1
                }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {gameState === 'playing' ? (
                  <Mic size={36} className={currentStyle.text} />
                ) : (
                  <MicOff size={36} className="text-gray-400" />
                )}
              </motion.div>
              <span className={`text-4xl font-bold mt-2 ${currentStyle.text}`}>
                {noiseLevel}%
              </span>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="w-full max-w-md">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Silencio</span>
              <span className="text-red-500">Umbral ({config.maxThreshold}%)</span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                style={{ left: `${config.maxThreshold}%` }}
              />
              <motion.div
                className={`h-full rounded-full ${currentStyle.bg}`}
                animate={{ width: `${noiseLevel}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>

          {/* Mini gráfico de historial */}
          <div className="w-full max-w-md mt-4 h-16 flex items-end gap-0.5">
            {noiseHistory.map((level, i) => (
              <motion.div
                key={i}
                className={`flex-1 rounded-t ${getZenState(level) === 'chaos' ? 'bg-red-400' : getZenState(level) === 'alert' ? 'bg-yellow-400' : 'bg-emerald-400'}`}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, level)}%` }}
                transition={{ duration: 0.1 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Racha actual */}
      {stats.currentStreak > 5 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-4 text-white text-center"
        >
          <div className="flex items-center justify-center gap-2">
            <Flame size={20} />
            <span className="font-semibold">
              ¡Racha de {formatTime(stats.currentStreak)}!
            </span>
            {stats.currentStreak >= 10 && (
              <span className="bg-white/20 px-2 py-0.5 rounded text-xs">
                +{Math.floor(stats.currentStreak / 10) * 10}% bonus
              </span>
            )}
          </div>
        </motion.div>
      )}

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
