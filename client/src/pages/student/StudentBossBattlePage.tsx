import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords,
  ArrowLeft,
  Heart,
  Zap,
  Coins,
  Trophy,
  Users,
  Target,
  CheckCircle,
  Skull,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import {
  studentBossBattleApi,
  type AvailableBattle,
  type BattleQuestion,
  type AnswerResult,
  STATUS_CONFIG,
} from '../../lib/studentBossBattleApi';
import { studentApi } from '../../lib/studentApi';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';

export const StudentBossBattlePage = () => {
  const { classroomId, battleId } = useParams<{ classroomId: string; battleId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Estados
  const [studentProfileId, setStudentProfileId] = useState<string | null>(null);
  const [battleState, setBattleState] = useState<'list' | 'fighting' | 'results'>('list');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<BattleQuestion[]>([]);
  const [, setAttemptId] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<any>(null);
  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [totalStats, setTotalStats] = useState({
    damageDealt: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    xpEarned: 0,
    gpEarned: 0,
  });

  // Obtener perfil del estudiante
  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: () => studentApi.getMyClasses(),
  });

  useEffect(() => {
    if (myClasses && classroomId) {
      const profile = myClasses.find(c => c.classroom.id === classroomId);
      if (profile) {
        setStudentProfileId(profile.id);
      }
    }
  }, [myClasses, classroomId]);

  // Obtener batallas disponibles
  const { data: battles = [], isLoading: loadingBattles } = useQuery({
    queryKey: ['student-boss-battles-available', classroomId, studentProfileId],
    queryFn: () => studentBossBattleApi.getAvailableForStudent(classroomId!, studentProfileId!),
    enabled: !!classroomId && !!studentProfileId,
    refetchInterval: 10000, // Refrescar cada 10 segundos
  });

  // Obtener batalla específica si hay battleId
  const selectedBattle = battleId ? battles.find(b => b.id === battleId) : null;

  // Polling del estado de la batalla actual
  const { data: battleStatus } = useQuery({
    queryKey: ['battle-status', battleId],
    queryFn: () => studentBossBattleApi.getBattleStatus(battleId!),
    enabled: !!battleId && battleState === 'fighting',
    refetchInterval: 2000, // Cada 2 segundos mientras pelea
  });

  // Mutations
  const startAttemptMutation = useMutation({
    mutationFn: () => {
      if (!battleId || !studentProfileId) {
        throw new Error('Faltan datos para iniciar la batalla');
      }
      return studentBossBattleApi.startAttempt(battleId, studentProfileId);
    },
    onSuccess: (data) => {
      setQuestions(data.questions);
      setAttemptId(data.attemptId);
      setCurrentQuestionIndex(0);
      setBattleState('fighting');
      setTotalStats({ damageDealt: 0, correctAnswers: 0, wrongAnswers: 0, xpEarned: 0, gpEarned: 0 });
      toast.success('¡Batalla iniciada!');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || error.message || 'No puedes iniciar la batalla';
      toast.error(message);
    },
  });

  const answerMutation = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: any }) =>
      studentBossBattleApi.answerQuestion(battleId!, studentProfileId!, questionId, answer),
    onSuccess: (result) => {
      setLastResult(result);
      setShowResult(true);
      
      // Actualizar estadísticas
      setTotalStats(prev => ({
        damageDealt: prev.damageDealt + result.damageDealt,
        correctAnswers: prev.correctAnswers + (result.isCorrect ? 1 : 0),
        wrongAnswers: prev.wrongAnswers + (result.isCorrect ? 0 : 1),
        xpEarned: prev.xpEarned + result.xpEarned,
        gpEarned: prev.gpEarned + result.gpEarned,
      }));

      if (result.isCorrect) {
        confetti({ particleCount: 30, spread: 60, origin: { y: 0.7 } });
      }

      // Verificar si la batalla terminó
      if (result.battleEnded && result.victory) {
        setTimeout(() => {
          confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
          toast.success('¡VICTORIA! ¡El boss ha sido derrotado!', { duration: 5000 });
          setBattleState('results');
        }, 2000);
      }
    },
  });

  const finishAttemptMutation = useMutation({
    mutationFn: () => studentBossBattleApi.finishAttempt(battleId!, studentProfileId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-boss-battles-available'] });
      queryClient.invalidateQueries({ queryKey: ['my-classes'] });
    },
  });

  // Handlers
  const handleStartBattle = (battle: AvailableBattle) => {
    navigate(`/student-battle/${classroomId}/${battle.id}`);
  };

  // Iniciar batalla cuando se navega a una batalla específica
  const handleBeginBattle = () => {
    if (battleId && studentProfileId) {
      startAttemptMutation.mutate();
    }
  };

  const handleAnswer = () => {
    if (selectedAnswer === null) return;
    const currentQuestion = questions[currentQuestionIndex];
    answerMutation.mutate({ questionId: currentQuestion.id, answer: selectedAnswer });
  };

  const handleNextQuestion = () => {
    setShowResult(false);
    setSelectedAnswer(null);
    setLastResult(null);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Fin del intento
      finishAttemptMutation.mutate();
      setBattleState('results');
    }
  };

  const handleBackToList = () => {
    setBattleState('list');
    navigate(`/student-battle/${classroomId}`);
    queryClient.invalidateQueries({ queryKey: ['student-boss-battles-available'] });
  };

  // Render de pre-batalla (cuando hay battleId pero no ha iniciado)
  if (battleState === 'list' && battleId && selectedBattle) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 max-w-md w-full text-center shadow-xl"
        >
          {/* Boss image */}
          <div className="relative w-28 h-28 mx-auto mb-5">
            {selectedBattle.bossImageUrl ? (
              <img src={selectedBattle.bossImageUrl} alt="" className="w-full h-full rounded-2xl object-cover" />
            ) : (
              <div className="w-full h-full rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <Skull className="text-white/80" size={44} />
              </div>
            )}
          </div>

          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">{selectedBattle.bossName}</h2>
          
          <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 mb-4">
            <Heart size={16} className="text-red-500" />
            <span>{selectedBattle.bossCurrentHp} / {selectedBattle.bossMaxHp} HP</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3">
              <Target className="mx-auto text-amber-500 mb-1" size={20} />
              <div className="text-gray-800 dark:text-white font-bold">{selectedBattle.questionsPerAttempt}</div>
              <div className="text-amber-600 dark:text-amber-400 text-xs">Preguntas</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-3">
              <Zap className="mx-auto text-purple-500 mb-1" size={20} />
              <div className="text-gray-800 dark:text-white font-bold">{selectedBattle.damagePerCorrect}</div>
              <div className="text-purple-600 dark:text-purple-400 text-xs">Daño/Correcta</div>
            </div>
          </div>

          <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
            Tienes <span className="text-gray-800 dark:text-white font-bold">{selectedBattle.attemptsRemaining}</span> intento{selectedBattle.attemptsRemaining !== 1 ? 's' : ''} restante{selectedBattle.attemptsRemaining !== 1 ? 's' : ''}
          </p>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate(`/student-battle/${classroomId}`)}
              className="flex-1"
            >
              Volver
            </Button>
            <Button
              onClick={handleBeginBattle}
              disabled={startAttemptMutation.isPending}
              className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
            >
              {startAttemptMutation.isPending ? 'Iniciando...' : '¡Batallar!'}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render de lista de batallas
  if (battleState === 'list' || !battleId) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <button 
            onClick={() => navigate('/dashboard')} 
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4 transition-colors"
          >
            <ArrowLeft size={18} />
            <span>Volver al dashboard</span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center ring-4 ring-red-200 dark:ring-red-800">
              <Swords className="text-red-600 dark:text-red-400 w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Boss Battles</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Derrota a los bosses respondiendo preguntas correctamente</p>
            </div>
          </div>
        </div>

        {/* Lista de batallas */}
        {loadingBattles ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-80 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : battles.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700"
          >
            <Skull className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={64} />
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">No hay batallas disponibles</h3>
            <p className="text-gray-400 dark:text-gray-500">Tu profesor aún no ha creado ninguna batalla</p>
          </motion.div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {battles.map((battle, index) => (
              <motion.div
                key={battle.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <BattleCard
                  battle={battle}
                  onStart={() => handleStartBattle(battle)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Render de batalla en progreso
  if (battleState === 'fighting' && selectedBattle) {
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
        <div className="max-w-3xl mx-auto">
          {/* Boss HP Bar */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                {selectedBattle.bossImageUrl ? (
                  <img src={selectedBattle.bossImageUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                    <Skull className="text-white" size={24} />
                  </div>
                )}
                <div>
                  <h2 className="font-bold text-white">{selectedBattle.bossName}</h2>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Users size={14} />
                    {battleStatus?.activeBattlers?.length || 0} batallando
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">HP</div>
                <div className="text-xl font-bold text-white">
                  {battleStatus?.bossCurrentHp ?? selectedBattle.bossCurrentHp} / {selectedBattle.bossMaxHp}
                </div>
              </div>
            </div>
            <div className="h-4 bg-black/30 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ 
                  width: `${((battleStatus?.bossCurrentHp ?? selectedBattle.bossCurrentHp) / selectedBattle.bossMaxHp) * 100}%` 
                }}
                className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
              />
            </div>
            
            {/* Compañeros batallando */}
            {battleStatus?.activeBattlers && battleStatus.activeBattlers.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-gray-400">Batallando:</span>
                <div className="flex -space-x-2">
                  {battleStatus.activeBattlers.slice(0, 5).map((battler) => (
                    <img
                      key={battler.id}
                      src={battler.avatarUrl || `https://ui-avatars.com/api/?name=${battler.characterName?.[0] || '?'}&background=random`}
                      alt=""
                      className="w-6 h-6 rounded-full border-2 border-purple-900"
                      title={battler.characterName || 'Estudiante'}
                    />
                  ))}
                  {battleStatus.activeBattlers.length > 5 && (
                    <div className="w-6 h-6 rounded-full bg-purple-600 border-2 border-purple-900 flex items-center justify-center text-xs text-white">
                      +{battleStatus.activeBattlers.length - 5}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Progreso de preguntas */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-400 mb-1">
              <span>Pregunta {currentQuestionIndex + 1} de {questions.length}</span>
              <span>Daño total: {totalStats.damageDealt}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
              />
            </div>
          </div>

          {/* Pregunta */}
          <AnimatePresence mode="wait">
            {!showResult ? (
              <motion.div
                key={currentQuestion?.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/10"
              >
                <QuestionRenderer
                  question={currentQuestion}
                  selectedAnswer={selectedAnswer}
                  onSelectAnswer={setSelectedAnswer}
                />

                <Button
                  onClick={handleAnswer}
                  disabled={selectedAnswer === null || answerMutation.isPending}
                  className="w-full mt-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  size="lg"
                >
                  {answerMutation.isPending ? 'Verificando...' : '¡Atacar!'}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-2xl p-6 border ${
                  lastResult?.isCorrect 
                    ? 'bg-emerald-500/20 border-emerald-500/50' 
                    : 'bg-red-500/20 border-red-500/50'
                }`}
              >
                <div className="text-center mb-4">
                  {lastResult?.isCorrect ? (
                    <>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                        className="inline-block text-6xl mb-2"
                      >
                        ⚔️
                      </motion.div>
                      <h3 className="text-2xl font-bold text-emerald-400">¡Correcto!</h3>
                      <p className="text-emerald-300">
                        Hiciste <span className="font-bold">{lastResult.damageDealt}</span> de daño al boss
                      </p>
                    </>
                  ) : (
                    <>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="inline-block text-6xl mb-2"
                      >
                        💔
                      </motion.div>
                      <h3 className="text-2xl font-bold text-red-400">¡Incorrecto!</h3>
                      <p className="text-red-300">
                        Perdiste <span className="font-bold">{lastResult?.damageReceived}</span> HP
                      </p>
                    </>
                  )}
                </div>

                {lastResult?.explanation && (
                  <div className="bg-white/10 rounded-xl p-4 mb-4">
                    <p className="text-sm text-gray-300">{lastResult.explanation}</p>
                  </div>
                )}

                <div className="flex items-center justify-center gap-4 mb-4">
                  {(lastResult?.xpEarned ?? 0) > 0 && (
                    <div className="flex items-center gap-1 text-purple-400">
                      <Zap size={16} />
                      +{lastResult?.xpEarned} XP
                    </div>
                  )}
                  {(lastResult?.gpEarned ?? 0) > 0 && (
                    <div className="flex items-center gap-1 text-amber-400">
                      <Coins size={16} />
                      +{lastResult?.gpEarned} GP
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleNextQuestion}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
                  size="lg"
                >
                  {currentQuestionIndex < questions.length - 1 ? 'Siguiente pregunta' : 'Ver resultados'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Render de resultados
  if (battleState === 'results') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/10 max-w-md w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="text-6xl mb-4"
          >
            {lastResult?.victory ? '🏆' : '⚔️'}
          </motion.div>
          
          <h2 className="text-2xl font-bold text-white mb-2">
            {lastResult?.victory ? '¡Victoria!' : '¡Batalla completada!'}
          </h2>
          <p className="text-gray-400 mb-6">
            {lastResult?.victory 
              ? '¡El boss ha sido derrotado!' 
              : 'Has terminado tu intento'}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white/10 rounded-xl p-4">
              <Target className="mx-auto text-red-400 mb-2" size={24} />
              <div className="text-2xl font-bold text-white">{totalStats.damageDealt}</div>
              <div className="text-xs text-gray-400">Daño total</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <CheckCircle className="mx-auto text-emerald-400 mb-2" size={24} />
              <div className="text-2xl font-bold text-white">
                {totalStats.correctAnswers}/{totalStats.correctAnswers + totalStats.wrongAnswers}
              </div>
              <div className="text-xs text-gray-400">Correctas</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <Zap className="mx-auto text-purple-400 mb-2" size={24} />
              <div className="text-2xl font-bold text-white">+{totalStats.xpEarned}</div>
              <div className="text-xs text-gray-400">XP ganado</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <Coins className="mx-auto text-amber-400 mb-2" size={24} />
              <div className="text-2xl font-bold text-white">+{totalStats.gpEarned}</div>
              <div className="text-xs text-gray-400">GP ganado</div>
            </div>
          </div>

          <Button
            onClick={handleBackToList}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
            size="lg"
          >
            Volver a batallas
          </Button>
        </motion.div>
      </div>
    );
  }

  // Loading inicial
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
    </div>
  );
};

// ==================== Componentes auxiliares ====================

interface BattleCardProps {
  battle: AvailableBattle;
  onStart: () => void;
}

const BattleCard = ({ battle, onStart }: BattleCardProps) => {
  const hpPercentage = battle.hpPercentage;
  const statusConfig = STATUS_CONFIG[battle.status];

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -3 }}
      className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-500/50 transition-all shadow-lg hover:shadow-xl"
    >
      {/* Header con imagen del boss */}
      <div className="relative h-36 bg-gradient-to-br from-red-500 via-orange-500 to-amber-500">
        {battle.bossImageUrl ? (
          <img src={battle.bossImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Skull className="text-white/50" size={56} />
            </motion.div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Status badge */}
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-white/90 dark:bg-black/50 text-gray-700 dark:text-white">
            {statusConfig.icon} {statusConfig.label}
          </span>
        </div>

        {/* Boss name */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="font-bold text-white text-lg drop-shadow-lg">{battle.bossName}</h3>
        </div>
      </div>

      {/* HP Bar */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1.5 text-sm font-medium">
            <Heart size={14} className="text-red-500" />
            HP del Boss
          </span>
          <span className="text-gray-800 dark:text-white font-bold">
            {battle.bossCurrentHp.toLocaleString()} / {battle.bossMaxHp.toLocaleString()}
          </span>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${hpPercentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full ${
              hpPercentage > 60 
                ? 'bg-gradient-to-r from-emerald-500 to-green-400' 
                : hpPercentage > 30 
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400' 
                  : 'bg-gradient-to-r from-red-500 to-red-400'
            }`}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 grid grid-cols-3 gap-2">
        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2 text-center">
          <Target size={16} className="mx-auto text-amber-500 mb-0.5" />
          <div className="text-xs text-amber-600 dark:text-amber-400">Preguntas</div>
          <div className="font-bold text-gray-800 dark:text-white">{battle.questionsPerAttempt}</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-500/10 rounded-lg p-2 text-center">
          <Zap size={16} className="mx-auto text-purple-500 mb-0.5" />
          <div className="text-xs text-purple-600 dark:text-purple-400">Daño</div>
          <div className="font-bold text-gray-800 dark:text-white">{battle.damagePerCorrect}</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-2 text-center">
          <Users size={16} className="mx-auto text-blue-500 mb-0.5" />
          <div className="text-xs text-blue-600 dark:text-blue-400">Batallando</div>
          <div className="font-bold text-gray-800 dark:text-white">{battle.activeBattlers}</div>
        </div>
      </div>

      {/* Action button */}
      <div className="p-4 pt-2">
        {battle.canParticipate ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStart}
            className="w-full py-3 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 hover:from-red-600 hover:via-orange-600 hover:to-amber-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 transition-all"
          >
            <Swords size={18} />
            <span>¡Batallar!</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {battle.attemptsRemaining} intento{battle.attemptsRemaining !== 1 ? 's' : ''}
            </span>
          </motion.button>
        ) : battle.status === 'VICTORY' ? (
          <div className="text-center py-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/30">
            <Trophy size={18} className="inline mr-2 text-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">¡Victoria!</span>
          </div>
        ) : (
          <div className="text-center py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-gray-500 dark:text-gray-400 text-sm">
            {battle.hasParticipated ? 'Sin intentos restantes' : 'No disponible'}
          </div>
        )}
      </div>
    </motion.div>
  );
};

interface QuestionRendererProps {
  question: BattleQuestion;
  selectedAnswer: any;
  onSelectAnswer: (answer: any) => void;
}

// Helper para parsear JSON de forma segura
const parseJsonField = (field: any): any[] => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const QuestionRenderer = ({ question, selectedAnswer, onSelectAnswer }: QuestionRendererProps) => {
  if (!question) return null;

  // Parsear options y pairs de forma segura
  const options = parseJsonField(question.options);
  const pairs = parseJsonField(question.pairs);

  return (
    <div>
      {/* Pregunta */}
      <h3 className="text-xl font-bold text-white mb-4">{question.questionText}</h3>
      
      {question.imageUrl && (
        <img src={question.imageUrl} alt="" className="w-full max-h-48 object-contain rounded-xl mb-4" />
      )}

      {/* Opciones según tipo */}
      {question.type === 'TRUE_FALSE' && (
        <div className="grid grid-cols-2 gap-3">
          {[true, false].map((value) => (
            <button
              key={String(value)}
              onClick={() => onSelectAnswer(value)}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedAnswer === value
                  ? 'border-purple-500 bg-purple-500/20'
                  : 'border-white/20 hover:border-white/40'
              }`}
            >
              <span className="text-2xl block mb-1">{value ? '✓' : '✗'}</span>
              <span className="text-white font-medium">{value ? 'Verdadero' : 'Falso'}</span>
            </button>
          ))}
        </div>
      )}

      {(question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') && options.length > 0 && (
        <div className="space-y-2">
          {options.map((option: any, index: number) => {
            const optionText = typeof option === 'string' ? option : option.text || option.label || String(option);
            return (
              <button
                key={index}
                onClick={() => {
                  if (question.type === 'SINGLE_CHOICE') {
                    onSelectAnswer(optionText);
                  } else {
                    const current = Array.isArray(selectedAnswer) ? selectedAnswer : [];
                    if (current.includes(optionText)) {
                      onSelectAnswer(current.filter((a: string) => a !== optionText));
                    } else {
                      onSelectAnswer([...current, optionText]);
                    }
                  }
                }}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  (question.type === 'SINGLE_CHOICE' && selectedAnswer === optionText) ||
                  (question.type === 'MULTIPLE_CHOICE' && Array.isArray(selectedAnswer) && selectedAnswer.includes(optionText))
                    ? 'border-purple-500 bg-purple-500/20'
                    : 'border-white/20 hover:border-white/40'
                }`}
              >
                <span className="text-white">{optionText}</span>
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'MATCHING' && pairs.length > 0 && (
        <div className="text-center text-gray-400">
          <p className="mb-4">Une cada elemento con su pareja</p>
          <div className="space-y-3">
            {pairs.map((pair: any, index: number) => {
              const leftText = typeof pair === 'string' ? pair : pair.left || pair.term || '';
              return (
                <div key={index} className="flex items-center gap-4">
                  <div className="flex-1 p-3 bg-white/10 rounded-lg text-white text-left">{leftText}</div>
                  <span className="text-gray-500">→</span>
                  <input
                    type="text"
                    placeholder="Respuesta..."
                    className="flex-1 p-3 bg-white/10 rounded-lg text-white border border-white/20 focus:border-purple-500 outline-none"
                    onChange={(e) => {
                      const current = Array.isArray(selectedAnswer) ? [...selectedAnswer] : [];
                      current[index] = { left: leftText, right: e.target.value };
                      onSelectAnswer(current);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fallback si no hay opciones */}
      {question.type !== 'TRUE_FALSE' && options.length === 0 && pairs.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          <p>Esta pregunta no tiene opciones configuradas</p>
        </div>
      )}
    </div>
  );
};

export default StudentBossBattlePage;
