import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Heart,
  Zap,
  Clock,
  Users,
  Sparkles,
  Coins,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { battleApi } from '../../lib/battleApi';

interface Props {
  bossId: string;
  studentId: string;
  onBack: () => void;
}

export const StudentBattleView = ({ bossId, studentId, onBack }: Props) => {
  const queryClient = useQueryClient();
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [lastResult, setLastResult] = useState<{ correct: boolean; damage: number } | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);

  const { data: battleState } = useQuery({
    queryKey: ['battle-state', bossId],
    queryFn: () => battleApi.getBattleState(bossId),
    refetchInterval: 2000, // Polling cada 2 segundos
  });

  const submitMutation = useMutation({
    mutationFn: (data: { questionId: string; selectedIndex: number; timeSpent: number }) =>
      battleApi.submitAnswer(bossId, studentId, data),
    onSuccess: (result) => {
      setLastResult({ correct: result.isCorrect ?? false, damage: result.damage ?? 0 });
      setHasAnswered(true);
      queryClient.invalidateQueries({ queryKey: ['battle-state', bossId] });
    },
  });

  // Detectar cambio de pregunta activa
  useEffect(() => {
    if (battleState?.questions) {
      // Usar la primera pregunta disponible
      const activeQuestion = battleState.questions[0];
      
      if (activeQuestion && activeQuestion.id !== currentQuestionId) {
        setCurrentQuestionId(activeQuestion.id);
        setSelectedAnswer(null);
        setHasAnswered(false);
        setLastResult(null);
        setTimeLeft(activeQuestion.timeLimit);
        setStartTime(Date.now());
      }
    }
  }, [battleState?.questions, currentQuestionId]);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0 || hasAnswered) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, hasAnswered]);

  const handleSelectAnswer = (index: number) => {
    if (hasAnswered || timeLeft <= 0 || !currentQuestionId) return;
    
    setSelectedAnswer(index);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    
    submitMutation.mutate({
      questionId: currentQuestionId,
      selectedIndex: index,
      timeSpent,
    });
  };

  if (!battleState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  // Batalla terminada
  if (battleState.status !== 'ACTIVE') {
    const isVictory = battleState.status === 'VICTORY';
    const myParticipation = battleState.participants.find(p => p.studentId === studentId);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md mx-auto text-center"
        >
          <div className={`text-8xl mb-6 ${isVictory ? 'animate-bounce' : ''}`}>
            {isVictory ? '🎉' : '💀'}
          </div>
          <h1 className={`text-4xl font-black mb-4 ${isVictory ? 'text-yellow-400' : 'text-red-400'}`}>
            {isVictory ? '¡VICTORIA!' : 'DERROTA'}
          </h1>
          <p className="text-white/70 mb-8">
            {isVictory 
              ? `¡Han derrotado a ${battleState.bossName}!`
              : `${battleState.bossName} ha ganado esta vez...`
            }
          </p>

          {myParticipation && (
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6">
              <h3 className="text-white font-bold mb-4">Tu contribución</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Zap className="w-6 h-6 mx-auto text-amber-400 mb-1" />
                  <p className="text-2xl font-bold text-white">{myParticipation.totalDamage}</p>
                  <p className="text-xs text-white/60">Daño total</p>
                </div>
                <div>
                  <CheckCircle className="w-6 h-6 mx-auto text-green-400 mb-1" />
                  <p className="text-2xl font-bold text-white">{myParticipation.correctAnswers}</p>
                  <p className="text-xs text-white/60">Correctas</p>
                </div>
                <div>
                  <XCircle className="w-6 h-6 mx-auto text-red-400 mb-1" />
                  <p className="text-2xl font-bold text-white">{myParticipation.wrongAnswers}</p>
                  <p className="text-xs text-white/60">Incorrectas</p>
                </div>
              </div>
            </div>
          )}

          {isVictory && (
            <div className="flex justify-center gap-6 mb-8">
              <div className="flex items-center gap-2 text-emerald-400">
                <Sparkles size={20} />
                <span className="font-bold">+{battleState.xpReward} XP</span>
              </div>
              <div className="flex items-center gap-2 text-amber-400">
                <Coins size={20} />
                <span className="font-bold">+{battleState.gpReward} GP</span>
              </div>
            </div>
          )}

          <Button onClick={onBack} className="bg-white/20 hover:bg-white/30">
            <ArrowLeft size={18} className="mr-2" />
            Volver
          </Button>
        </motion.div>
      </div>
    );
  }

  const currentQuestion = battleState.questions.find(q => q.id === currentQuestionId);
  const hpPercentage = Math.round((battleState.currentHp / battleState.bossHp) * 100);
  const timePercentage = currentQuestion ? (timeLeft / currentQuestion.timeLimit) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Salir</span>
        </button>
        <div className="flex items-center gap-2 text-white/70">
          <Users size={16} />
          <span>{battleState.participants.length}</span>
        </div>
      </div>

      {/* Boss */}
      <div className="text-center mb-6">
        <motion.div
          className="w-32 h-32 mx-auto mb-3 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-2xl shadow-red-500/30"
          animate={lastResult?.correct ? { x: [0, -5, 5, -5, 5, 0] } : {}}
        >
          {battleState.bossImageUrl ? (
            <img src={battleState.bossImageUrl} alt={battleState.bossName} className="w-full h-full object-cover rounded-full" />
          ) : (
            <span className="text-6xl">🐉</span>
          )}
        </motion.div>
        <h2 className="text-xl font-bold text-white">{battleState.bossName}</h2>
        
        {/* HP Bar */}
        <div className="max-w-xs mx-auto mt-2">
          <div className="flex items-center justify-between text-xs text-white/60 mb-1">
            <span className="flex items-center gap-1">
              <Heart size={12} className="text-red-400" />
              HP
            </span>
            <span>{battleState.currentHp} / {battleState.bossHp}</span>
          </div>
          <div className="h-3 bg-black/50 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${hpPercentage}%` }}
              className={`h-full rounded-full ${
                hpPercentage > 50 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                hpPercentage > 25 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                'bg-gradient-to-r from-red-400 to-red-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Pregunta */}
      {currentQuestion ? (
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
          {/* Timer */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/60 text-sm flex items-center gap-1">
                <Clock size={14} />
                Tiempo
              </span>
              <span className={`font-bold text-xl ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                {timeLeft}s
              </span>
            </div>
            <div className="h-2 bg-black/50 rounded-full overflow-hidden">
              <motion.div
                animate={{ width: `${timePercentage}%` }}
                className={`h-full rounded-full ${
                  timePercentage > 50 ? 'bg-green-500' :
                  timePercentage > 25 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
              />
            </div>
          </div>

          {/* Pregunta */}
          <p className="text-white text-lg font-medium text-center mb-4">
            {currentQuestion.question}
          </p>

          {currentQuestion.imageUrl && (
            <img
              src={currentQuestion.imageUrl}
              alt="Pregunta"
              className="max-h-32 mx-auto rounded-xl mb-4"
            />
          )}

          {/* Opciones */}
          <div className="grid grid-cols-2 gap-2">
            {(Array.isArray(currentQuestion.options) ? currentQuestion.options : []).map((option: string, index: number) => {
              const isSelected = selectedAnswer === index;
              const showResult = hasAnswered && isSelected;
              const isCorrect = lastResult?.correct;

              return (
                <motion.button
                  key={index}
                  onClick={() => handleSelectAnswer(index)}
                  disabled={hasAnswered || timeLeft <= 0}
                  whileTap={{ scale: 0.95 }}
                  className={`
                    p-4 rounded-xl text-left font-medium transition-all
                    ${hasAnswered || timeLeft <= 0 ? 'cursor-not-allowed' : 'cursor-pointer active:scale-95'}
                    ${showResult
                      ? isCorrect
                        ? 'bg-green-500 text-white ring-4 ring-green-300'
                        : 'bg-red-500 text-white ring-4 ring-red-300'
                      : isSelected
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }
                  `}
                >
                  <span className="font-bold mr-2">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  {option}
                </motion.button>
              );
            })}
          </div>

          {/* Resultado */}
          <AnimatePresence>
            {lastResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-4 p-3 rounded-xl text-center ${
                  lastResult.correct
                    ? 'bg-green-500/20 text-green-300'
                    : 'bg-red-500/20 text-red-300'
                }`}
              >
                {lastResult.correct ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle size={20} />
                    <span className="font-bold">¡Correcto! +{lastResult.damage} daño</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <XCircle size={20} />
                    <span className="font-bold">Incorrecto</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Esperando siguiente pregunta */}
          {hasAnswered && (
            <p className="text-center text-white/50 text-sm mt-4">
              Esperando siguiente pregunta...
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center border border-white/20">
          <div className="animate-pulse">
            <Clock size={48} className="mx-auto text-white/50 mb-4" />
            <p className="text-white/70">Esperando que el profesor muestre la pregunta...</p>
          </div>
        </div>
      )}

      {/* Mi stats */}
      {battleState.participants.find(p => p.studentId === studentId) && (
        <div className="mt-4 bg-white/5 rounded-xl p-3 flex justify-around">
          <div className="text-center">
            <p className="text-amber-400 font-bold">
              {battleState.participants.find(p => p.studentId === studentId)?.totalDamage || 0}
            </p>
            <p className="text-xs text-white/50">Mi daño</p>
          </div>
          <div className="text-center">
            <p className="text-green-400 font-bold">
              {battleState.participants.find(p => p.studentId === studentId)?.correctAnswers || 0}
            </p>
            <p className="text-xs text-white/50">Correctas</p>
          </div>
          <div className="text-center">
            <p className="text-red-400 font-bold">
              {battleState.participants.find(p => p.studentId === studentId)?.wrongAnswers || 0}
            </p>
            <p className="text-xs text-white/50">Incorrectas</p>
          </div>
        </div>
      )}
    </div>
  );
};
