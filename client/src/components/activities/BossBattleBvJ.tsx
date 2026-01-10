import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Heart,
  Zap,
  HelpCircle,
  ChevronRight,
  Users,
  Trophy,
  Sparkles,
  Coins,
  RotateCcw,
  Check,
  X,
  Clock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '../ui/Button';
import confetti from 'canvas-confetti';
import { 
  battleApi, 
  type BvJChallenger,
  type BattleQuestion,
  type BattleQuestionType,
  type MatchingPair,
} from '../../lib/battleApi';
import { StudentAvatarMini } from '../avatar/StudentAvatarMini';
import type { AvatarGender } from '../../lib/avatarApi';
import toast from 'react-hot-toast';

// ===== EFFECTS =====
const fireVictoryConfetti = () => {
  const end = Date.now() + 3000;
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
};

const fireDamageParticles = (el: HTMLElement | null, dmg: number) => {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  
  const flash = document.createElement('div');
  flash.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:9997;background:radial-gradient(circle at ${cx}px ${cy}px, rgba(239,68,68,0.7) 0%, rgba(239,68,68,0.4) 30%, transparent 70%);animation:boss-damage-flash 0.8s ease-out forwards;`;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 800);
  
  const txt = document.createElement('div');
  txt.textContent = `-${dmg}`;
  txt.style.cssText = `position:fixed;left:${cx}px;top:${cy-40}px;font-size:80px;font-weight:900;color:#fff;text-shadow:0 0 10px #ef4444, 0 0 20px #ef4444, 0 0 40px #ef4444, 0 4px 0 #b91c1c;pointer-events:none;z-index:9999;animation:dmg-float 2s ease-out forwards;font-family:system-ui,-apple-system,sans-serif;`;
  document.body.appendChild(txt);
  setTimeout(() => txt.remove(), 2000);
  
  const label = document.createElement('div');
  label.textContent = '⚔️ ¡DAÑO! ⚔️';
  label.style.cssText = `position:fixed;left:${cx}px;top:${cy-110}px;font-size:28px;font-weight:900;color:#fbbf24;text-shadow:0 0 10px #f59e0b, 0 0 20px #f59e0b;pointer-events:none;z-index:9999;animation:dmg-label 1.5s ease-out forwards;transform:translateX(-50%);letter-spacing:3px;`;
  document.body.appendChild(label);
  setTimeout(() => label.remove(), 1500);
  
  const syms = ['⚔️', '💥', '✨', '🔥', '💫', '⭐', '💢', '🗡️'];
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('div');
    const a = (Math.PI * 2 * i) / 16, d = 120 + Math.random() * 100;
    p.textContent = syms[Math.floor(Math.random() * syms.length)];
    p.style.cssText = `position:fixed;font-size:${36 + Math.random() * 20}px;pointer-events:none;z-index:9999;left:${cx}px;top:${cy}px;animation:particle-burst 1.2s ease-out forwards;--tx:${Math.cos(a)*d}px;--ty:${Math.sin(a)*d}px;`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
  
  for (let i = 0; i < 4; i++) {
    const wave = document.createElement('div');
    wave.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:50px;height:50px;border:5px solid rgba(239,68,68,0.9);border-radius:50%;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);animation:impact-wave 1.2s ease-out forwards;animation-delay:${i * 0.15}s;`;
    document.body.appendChild(wave);
    setTimeout(() => wave.remove(), 1500);
  }
};

const fireStudentDamage = () => {
  const flash = document.createElement('div');
  flash.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:9998;background:radial-gradient(circle,rgba(239,68,68,0.6) 0%,rgba(239,68,68,0.8) 100%);animation:student-damage-flash 0.8s ease-out forwards;`;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 800);
  
  const txt = document.createElement('div');
  txt.innerHTML = '💔 ¡DAÑO RECIBIDO! 💔';
  txt.style.cssText = `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);font-size:48px;font-weight:900;color:#fff;text-shadow:0 0 20px #ef4444, 0 0 40px #ef4444;pointer-events:none;z-index:9999;animation:student-damage-text 1.5s ease-out forwards;white-space:nowrap;`;
  document.body.appendChild(txt);
  setTimeout(() => txt.remove(), 1500);
  
  const hearts = ['💔', '❤️‍🩹', '🩸', '😵', '⚡'];
  for (let i = 0; i < 12; i++) {
    const h = document.createElement('div');
    h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    const startX = Math.random() * window.innerWidth;
    h.style.cssText = `position:fixed;left:${startX}px;top:-50px;font-size:${40 + Math.random() * 30}px;pointer-events:none;z-index:9999;animation:heart-fall 2s ease-in forwards;--endX:${startX + (Math.random() - 0.5) * 200}px;`;
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 2000);
  }
};

// Inject styles if not present
if (typeof document !== 'undefined' && !document.getElementById('bvj-battle-styles')) {
  const s = document.createElement('style');
  s.id = 'bvj-battle-styles';
  s.textContent = `
    @keyframes dmg-float{0%{transform:translate(-50%,0)scale(0.3);opacity:0}10%{transform:translate(-50%,-30px)scale(1.4);opacity:1}25%{transform:translate(-50%,-50px)scale(1.1);opacity:1}50%{transform:translate(-50%,-60px)scale(1);opacity:1}100%{transform:translate(-50%,-150px)scale(0.5);opacity:0}}
    @keyframes dmg-label{0%{transform:translateX(-50%) scale(0);opacity:0}15%{transform:translateX(-50%) scale(1.3);opacity:1}35%{transform:translateX(-50%) scale(1);opacity:1}70%{transform:translateX(-50%) scale(1);opacity:1}100%{transform:translateX(-50%) translateY(-40px);opacity:0}}
    @keyframes particle-burst{0%{transform:translate(-50%,-50%)scale(0);opacity:1}50%{opacity:1}100%{transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty)))scale(2);opacity:0}}
    @keyframes boss-damage-flash{0%{opacity:1}100%{opacity:0}}
    @keyframes impact-wave{0%{width:50px;height:50px;opacity:1;border-width:5px}50%{opacity:0.8}100%{width:400px;height:400px;opacity:0;border-width:2px}}
    @keyframes student-damage-flash{0%{opacity:0}10%{opacity:1}30%{opacity:0.7}50%{opacity:1}100%{opacity:0}}
    @keyframes student-damage-text{0%{transform:translate(-50%,-50%) scale(0);opacity:0}15%{transform:translate(-50%,-50%) scale(1.3);opacity:1}30%{transform:translate(-50%,-50%) scale(1);opacity:1}70%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-50%) scale(0.8);opacity:0}}
    @keyframes heart-fall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(${typeof window !== 'undefined' ? window.innerHeight + 100 : 1000}px) rotate(720deg);opacity:0}}
  `;
  document.head.appendChild(s);
}

// Helper para parsear JSON de forma segura
const safeJsonParse = (val: any) => {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return null; }
};

// Componente de Avatar del Challenger en círculo (como en torneos)
const ChallengerAvatar = ({ 
  challenger,
  size = 120 
}: { 
  challenger: BvJChallenger;
  size?: number;
}) => {
  // Si tenemos studentId y gender, usar el sistema de avatares dinámico
  if (challenger.id && challenger.avatarGender) {
    const sizeMap: Record<number, 'xs' | 'sm' | 'md' | 'lg' | 'xl'> = {
      60: 'sm', 80: 'md', 100: 'md', 120: 'lg', 140: 'lg', 160: 'xl'
    };
    const avatarSize = sizeMap[size] || 'lg';
    return (
      <div 
        style={{ width: size, height: size }} 
        className="rounded-full overflow-hidden bg-gradient-to-br from-indigo-500/30 to-purple-500/30 ring-4 ring-blue-400/50 shadow-2xl relative"
      >
        <div className="absolute z-0" style={{ top: '-5%', left: '-40%' }}>
          <StudentAvatarMini 
            studentProfileId={challenger.id} 
            gender={challenger.avatarGender as AvatarGender} 
            size={avatarSize}
          />
        </div>
      </div>
    );
  }
  
  // Fallback: mostrar inicial
  const initial = (challenger.characterName || '?').charAt(0).toUpperCase();
  return (
    <div 
      className="rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-blue-500 to-purple-600 ring-4 ring-blue-400/50 shadow-2xl" 
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
};

// Componente de Matching Question
const MatchingQuestion = ({ pairs, shuffled, showAnswer }: { pairs: MatchingPair[]; shuffled: MatchingPair[]; showAnswer: boolean }) => {
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [connections, setConnections] = useState<Map<number, number>>(new Map());
  
  const handleLeftClick = (index: number) => {
    if (showAnswer) return;
    setSelectedLeft(selectedLeft === index ? null : index);
  };
  
  const handleRightClick = (rightIndex: number) => {
    if (showAnswer || selectedLeft === null) return;
    const newConnections = new Map(connections);
    newConnections.set(selectedLeft, rightIndex);
    setConnections(newConnections);
    setSelectedLeft(null);
  };
  
  const removeConnection = (leftIndex: number) => {
    if (showAnswer) return;
    const newConnections = new Map(connections);
    newConnections.delete(leftIndex);
    setConnections(newConnections);
  };
  
  const getCorrectRightIndex = (leftIndex: number) => {
    const leftItem = pairs[leftIndex];
    return shuffled.findIndex(s => s.right === leftItem.right);
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Columna izquierda */}
      <div className="space-y-2">
        {pairs.map((p, i) => {
          const isSelected = selectedLeft === i;
          const hasConnection = connections.has(i);
          const connectedTo = connections.get(i);
          
          return (
            <motion.div
              key={i}
              whileHover={!showAnswer ? { scale: 1.02 } : {}}
              onClick={() => hasConnection ? removeConnection(i) : handleLeftClick(i)}
              className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                showAnswer 
                  ? 'bg-blue-500/30 border-2 border-blue-400'
                  : isSelected 
                    ? 'bg-purple-500/40 border-2 border-purple-400 ring-2 ring-purple-400/50' 
                    : hasConnection
                      ? 'bg-green-500/20 border-2 border-green-400'
                      : 'bg-white/10 border-2 border-transparent hover:border-purple-400/50'
              }`}
            >
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-sm font-bold">
                {i + 1}
              </span>
              <span className="text-white text-sm flex-1">{p.left}</span>
              {hasConnection && !showAnswer && (
                <span className="text-green-400 text-xs font-bold">→ {String.fromCharCode(97 + connectedTo!)}</span>
              )}
              {showAnswer && (
                <div className="flex flex-col items-end gap-1">
                  {/* Conexión del estudiante si existe y es incorrecta */}
                  {hasConnection && connectedTo !== getCorrectRightIndex(i) && (
                    <span className="text-red-400 text-xs font-bold">✗ {String.fromCharCode(97 + connectedTo!)}</span>
                  )}
                  {/* Conexión correcta */}
                  <span className="text-green-400 text-xs font-bold">✓ {String.fromCharCode(97 + getCorrectRightIndex(i))}</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      
      {/* Columna derecha */}
      <div className="space-y-2">
        {shuffled.map((p, i) => {
          const isConnectedFrom = Array.from(connections.entries()).find(([_, v]) => v === i);
          
          return (
            <motion.div
              key={i}
              whileHover={!showAnswer && selectedLeft !== null ? { scale: 1.02 } : {}}
              onClick={() => handleRightClick(i)}
              className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                showAnswer
                  ? 'bg-green-500/30 border-2 border-green-400'
                  : isConnectedFrom
                    ? 'bg-green-500/20 border-2 border-green-400'
                    : selectedLeft !== null
                      ? 'bg-white/10 border-2 border-transparent hover:border-orange-400/50'
                      : 'bg-white/10 border-2 border-transparent'
              }`}
            >
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center text-sm font-bold">
                {String.fromCharCode(97 + i)}
              </span>
              <span className="text-white text-sm flex-1">{p.right}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// Renderizar opciones según tipo de pregunta
const renderQuestionOptions = (
  question: BattleQuestion, 
  showAnswer: boolean, 
  shuffledPairs: MatchingPair[],
  selectedOption: number | number[] | null,
  onSelectOption: (idx: number) => void
) => {
  const qType = (question.battleQuestionType || 'SINGLE_CHOICE') as BattleQuestionType;
  const opts = Array.isArray(question.options) ? question.options : safeJsonParse(question.options) || [];
  const pairs = safeJsonParse(question.pairs) || [];
  const ci = safeJsonParse(question.correctIndices) || [];
  
  const getStyle = (idx: number, isCorrect: boolean) => {
    const isSelected = Array.isArray(selectedOption) ? selectedOption.includes(idx) : selectedOption === idx;
    if (showAnswer) {
      if (isCorrect) return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white ring-2 ring-green-300';
      if (isSelected && !isCorrect) return 'bg-gradient-to-r from-red-500 to-red-600 text-white ring-2 ring-red-300';
      return 'bg-white/10 text-white/60';
    }
    if (isSelected) return 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white ring-2 ring-purple-300';
    return 'bg-white/10 text-white hover:bg-white/20 cursor-pointer';
  };
  
  // TRUE_FALSE
  if (qType === 'TRUE_FALSE') {
    return (
      <div className="grid grid-cols-2 gap-4">
        {['Verdadero', 'Falso'].map((o, i) => (
          <motion.div
            key={i}
            whileHover={!showAnswer ? { scale: 1.02 } : {}}
            whileTap={!showAnswer ? { scale: 0.98 } : {}}
            onClick={() => !showAnswer && onSelectOption(i)}
            className={`p-4 rounded-xl font-bold text-lg text-white text-center transition-all ${getStyle(i, question.correctIndex === i)}`}
          >
            {i === 0 ? '✓' : '✗'} {o}
            {showAnswer && question.correctIndex === i && <Check className="inline ml-2 text-green-400" size={18} />}
            {showAnswer && selectedOption === i && question.correctIndex !== i && <X className="inline ml-2 text-red-400" size={18} />}
          </motion.div>
        ))}
      </div>
    );
  }
  
  // MATCHING
  if (qType === 'MATCHING' && pairs.length > 0) {
    return <MatchingQuestion pairs={pairs} shuffled={shuffledPairs} showAnswer={showAnswer} />;
  }
  
  // MULTIPLE_CHOICE - Permite selección múltiple
  if (qType === 'MULTIPLE_CHOICE') {
    const selectedArray = Array.isArray(selectedOption) ? selectedOption : [];
    return (
      <div className="grid grid-cols-2 gap-3">
        {opts.map((o: string, i: number) => {
          const isCorrect = ci.includes(i);
          const isSelected = selectedArray.includes(i);
          return (
            <motion.div
              key={i}
              whileHover={!showAnswer ? { scale: 1.02 } : {}}
              whileTap={!showAnswer ? { scale: 0.98 } : {}}
              onClick={() => !showAnswer && onSelectOption(i)}
              className={`p-3 rounded-xl text-sm font-medium transition-all ${getStyle(i, isCorrect)}`}
            >
              <span className="font-bold mr-2 text-orange-400">{String.fromCharCode(65 + i)}.</span>
              {o}
              {showAnswer && isCorrect && <span className="ml-2">✓</span>}
              {showAnswer && !isCorrect && isSelected && <span className="ml-2">✗</span>}
            </motion.div>
          );
        })}
      </div>
    );
  }
  
  // SINGLE_CHOICE (default)
  return (
    <div className="grid grid-cols-2 gap-3">
      {opts.map((o: string, i: number) => (
        <motion.div
          key={i}
          whileHover={!showAnswer ? { scale: 1.02 } : {}}
          whileTap={!showAnswer ? { scale: 0.98 } : {}}
          onClick={() => !showAnswer && onSelectOption(i)}
          className={`p-3 rounded-xl text-sm font-medium text-white transition-all ${getStyle(i, i === question.correctIndex)}`}
        >
          <span className="font-bold mr-2 text-orange-400">{String.fromCharCode(65 + i)}.</span>
          {o}
          {showAnswer && i === question.correctIndex && <Check className="inline ml-2 text-green-400" size={16} />}
          {showAnswer && selectedOption === i && i !== question.correctIndex && <X className="inline ml-2 text-red-400" size={16} />}
        </motion.div>
      ))}
    </div>
  );
};

interface BossBattleBvJProps {
  bossId: string;
  students: any[];
  onBack: () => void;
}

type BattlePhase = 'waiting' | 'selecting' | 'vs_screen' | 'question' | 'result' | 'round_end' | 'victory' | 'defeat';

export const BossBattleBvJ = ({ bossId, students, onBack }: BossBattleBvJProps) => {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<BattlePhase>('waiting');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | number[] | null>(null);
  const [challenger, setChallenger] = useState<BvJChallenger | null>(null);
  const [lastResult, setLastResult] = useState<{ correct: boolean; damage: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showQuestion, setShowQuestion] = useState(false); // Controla si el timer está activo
  const [expired, setExpired] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
  
  const bossRef = useRef<HTMLDivElement>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const damageBoss1Ref = useRef<HTMLAudioElement | null>(null);
  const damageBoss2Ref = useRef<HTMLAudioElement | null>(null);
  const damageStudentRef = useRef<HTMLAudioElement | null>(null);

  // Resetear estados cuando cambia el bossId (nueva batalla)
  useEffect(() => {
    setPhase('waiting');
    setCurrentQuestionIndex(0);
    setShowAnswer(false);
    setAnswerRevealed(false);
    setSelectedOption(null);
    setChallenger(null);
    setLastResult(null);
    setTimeLeft(0);
    setShowQuestion(false);
    setExpired(false);
    setIsProcessingAnswer(false);
  }, [bossId]);

  // Inicializar audio
  useEffect(() => {
    bgMusicRef.current = new Audio('/sounds/boss_music1.mp3');
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.4;
    damageBoss1Ref.current = new Audio('/sounds/damage_boss1.mp3');
    damageBoss1Ref.current.volume = 0.7;
    damageBoss2Ref.current = new Audio('/sounds/damage_boss2.mp3');
    damageBoss2Ref.current.volume = 0.7;
    damageStudentRef.current = new Audio('/sounds/damage_student.mp3');
    damageStudentRef.current.volume = 0.7;

    bgMusicRef.current.play().catch(() => {});

    return () => {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
    };
  }, []);

  // Manejar mute/unmute
  useEffect(() => {
    if (bgMusicRef.current) {
      if (isMuted) {
        bgMusicRef.current.pause();
      } else {
        bgMusicRef.current.play().catch(() => {});
      }
    }
  }, [isMuted]);

  // Funciones para reproducir SFX
  const playBossDamageSfx = useCallback(() => {
    if (isMuted) return;
    const sfx = Math.random() < 0.5 ? damageBoss1Ref.current : damageBoss2Ref.current;
    if (sfx) {
      sfx.currentTime = 0;
      sfx.play().catch(() => {});
    }
  }, [isMuted]);

  const playStudentDamageSfx = useCallback(() => {
    if (isMuted) return;
    if (damageStudentRef.current) {
      damageStudentRef.current.currentTime = 0;
      damageStudentRef.current.play().catch(() => {});
    }
  }, [isMuted]);

  // Obtener estado de la batalla
  const { data: battleState, refetch } = useQuery({
    queryKey: ['bvj-battle', bossId],
    queryFn: () => battleApi.getBvJBattleState(bossId),
    refetchInterval: phase === 'waiting' ? 3000 : false,
  });

  const selectChallengerMutation = useMutation({
    mutationFn: () => battleApi.selectRandomChallenger(bossId, students.map(s => s.id)),
    onSuccess: (result) => {
      if (result.needsNewRound) {
        setPhase('round_end');
      } else if (result.challenger) {
        setChallenger(result.challenger);
        // Resetear estados de pregunta antes de mostrar VS
        setAnswerRevealed(false);
        setSelectedOption(null);
        setShowAnswer(false);
        setShowQuestion(false);
        setExpired(false);
        setTimeLeft(0);
        setIsProcessingAnswer(false);
        setPhase('vs_screen');
        // Mostrar pantalla VS por 3 segundos
        setTimeout(() => {
          setPhase('question');
        }, 3000);
      }
      refetch();
    },
    onError: () => toast.error('Error al seleccionar retador'),
  });

  const newRoundMutation = useMutation({
    mutationFn: () => battleApi.startNewRound(bossId),
    onSuccess: () => {
      setPhase('waiting');
      refetch();
      toast.success('¡Nueva ronda iniciada!');
    },
  });

  const applyDamageMutation = useMutation({
    mutationFn: ({ damage, studentIds, wrongStudentIds, hpDamage }: {
      damage: number;
      studentIds: string[];
      wrongStudentIds?: string[];
      hpDamage?: number;
    }) => battleApi.applyManualDamage(bossId, damage, studentIds, wrongStudentIds && hpDamage ? { wrongStudentIds, hpDamage } : undefined),
    onSuccess: () => {
      refetch();
      // Limpiar lastResult después de 2 segundos y cambiar a fase result
      setTimeout(() => {
        setLastResult(null);
        setPhase('result');
      }, 2000);
    },
  });

  const endBattleMutation = useMutation({
    mutationFn: (status: 'VICTORY' | 'DEFEAT') => battleApi.endBattle(bossId, status),
    onSuccess: (_, status) => {
      setPhase(status === 'VICTORY' ? 'victory' : 'defeat');
      queryClient.invalidateQueries({ queryKey: ['bosses'] });
    },
  });

  const updateQuestionIndexMutation = useMutation({
    mutationFn: (questionIndex: number) => battleApi.updateCurrentQuestionIndex(bossId, questionIndex),
  });

  const boss = battleState?.boss;
  const questions = battleState?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];

  // Sincronizar currentQuestionIndex con el backend al cargar
  useEffect(() => {
    if (battleState?.currentQuestionIndex !== undefined && battleState.currentQuestionIndex !== currentQuestionIndex) {
      setCurrentQuestionIndex(battleState.currentQuestionIndex);
    }
  }, [battleState?.currentQuestionIndex]);

  // Shuffle pairs para preguntas MATCHING (memoizado por pregunta)
  const shuffledPairs = useMemo(() => {
    if (!currentQuestion) return [];
    const pairs = safeJsonParse(currentQuestion.pairs) || [];
    return [...pairs].sort(() => Math.random() - 0.5);
  }, [currentQuestion?.id]);

  // Verificar si el boss fue derrotado
  useEffect(() => {
    if (boss && boss.currentHp <= 0 && phase !== 'victory') {
      fireVictoryConfetti();
      endBattleMutation.mutate('VICTORY');
    }
  }, [boss?.currentHp]);

  // Iniciar pregunta - similar a startQ() en BossBattleLive
  const startQuestion = () => {
    if (!currentQuestion) return;
    setExpired(false);
    setTimeLeft(currentQuestion.timeLimit || 30);
    setShowQuestion(true);
  };

  // Timer countdown - igual que BossBattleLive: solo corre cuando showQuestion && timeLeft > 0
  useEffect(() => {
    if (!showQuestion || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [showQuestion, timeLeft]);

  // Auto-revelar cuando se agota el tiempo - igual que BossBattleLive
  useEffect(() => {
    if (timeLeft === 0 && !showAnswer && !expired && showQuestion) {
      setExpired(true);
      setShowAnswer(true);
      setAnswerRevealed(true);
      toast.error('¡Tiempo agotado!', { icon: '⏰' });
    }
  }, [timeLeft, showAnswer, expired, showQuestion]);

  // Iniciar timer cuando entra a fase question
  useEffect(() => {
    if (phase === 'question' && currentQuestion && !showQuestion) {
      startQuestion();
    }
  }, [phase, currentQuestion?.id]);

  const handleSelectChallenger = () => {
    setPhase('selecting');
    selectChallengerMutation.mutate();
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (!currentQuestion || !challenger || isProcessingAnswer) return;

    setIsProcessingAnswer(true); // Deshabilitar botones inmediatamente

    const damage = isCorrect ? currentQuestion.damage : 0;
    const hpPenalty = !isCorrect ? (currentQuestion.hpPenalty || 10) : 0;

    setLastResult({ correct: isCorrect, damage: isCorrect ? damage : hpPenalty });

    // Efectos visuales y sonoros
    if (isCorrect) {
      setShaking(true);
      fireDamageParticles(bossRef.current, damage);
      playBossDamageSfx();
      setTimeout(() => setShaking(false), 500);
    } else {
      fireStudentDamage();
      playStudentDamageSfx();
    }

    // Actualizar HP del challenger localmente si es incorrecto
    if (!isCorrect && challenger) {
      setChallenger(prev => prev ? {
        ...prev,
        hp: Math.max(0, (prev.hp || 100) - hpPenalty)
      } : null);
    }

    // Aplicar daño - la fase result se cambiará en onSuccess después de refetch
    applyDamageMutation.mutate({
      damage,
      studentIds: isCorrect ? [challenger.id] : [],
      wrongStudentIds: !isCorrect ? [challenger.id] : undefined,
      hpDamage: hpPenalty,
    });
  };

  const handleNextQuestion = () => {
    // Resetear estados de la pregunta
    setAnswerRevealed(false);
    setSelectedOption(null);
    setShowAnswer(false);
    setShowQuestion(false);
    setExpired(false);
    setTimeLeft(0);
    setIsProcessingAnswer(false);
    
    if (currentQuestionIndex < questions.length - 1) {
      const newIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(newIndex);
      setChallenger(null);
      setPhase('waiting');
      // Persistir el índice en el backend
      updateQuestionIndexMutation.mutate(newIndex);
    } else {
      // No hay más preguntas, finalizar
      if (boss && boss.currentHp > 0) {
        endBattleMutation.mutate('DEFEAT');
      }
    }
  };

  if (!battleState || !boss) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const hpPercentage = Math.max(0, (boss.currentHp / boss.bossHp) * 100);
  // Parsear usedStudentIds correctamente
  let usedStudentIds: string[] = [];
  if (boss.usedStudentIds) {
    if (Array.isArray(boss.usedStudentIds)) {
      usedStudentIds = boss.usedStudentIds;
    } else if (typeof boss.usedStudentIds === 'string') {
      try {
        const parsed = JSON.parse(boss.usedStudentIds);
        usedStudentIds = Array.isArray(parsed) ? parsed : [];
      } catch { usedStudentIds = []; }
    }
  }
  
  const usedCount = usedStudentIds.length;
  const totalStudents = students.filter(s => (s.hp || s.currentHp || 100) > 0).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 -m-4 -mt-6">
      {/* Header */}
      <div className="bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Salir</span>
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold text-white">{boss.name}</h1>
            <p className="text-xs text-orange-400">Ronda {boss.currentRound || 1} • Pregunta {currentQuestionIndex + 1}/{questions.length}</p>
          </div>
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <Users size={16} />
            <span>{usedCount}/{totalStudents} participaron</span>
          </div>
        </div>
      </div>

      {/* Arena Principal */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {/* Vista VS: Boss vs Challenger */}
        <div className="relative">
          {/* Background arena */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-transparent to-blue-500/20 rounded-3xl" />
          
          <div className="relative grid grid-cols-3 gap-4 items-center min-h-[280px] p-6">
            {/* Boss (izquierda) */}
            <div className="flex flex-col items-center" ref={bossRef}>
              <motion.div
                animate={{ 
                  scale: phase === 'vs_screen' ? [1, 1.1, 1] : 1,
                  x: shaking ? [0, -10, 10, -10, 10, 0] : 0,
                }}
                transition={{ duration: shaking ? 0.5 : 0.5, repeat: phase === 'vs_screen' ? Infinity : 0 }}
                className="relative"
              >
                <div className={`w-28 h-28 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-2xl ring-4 ring-red-400/50 ${shaking ? 'animate-pulse' : ''}`}>
                  {boss.bossImageUrl ? (
                    <img 
                      src={boss.bossImageUrl} 
                      alt={boss.bossName}
                      className="w-20 h-20 object-contain"
                    />
                  ) : (
                    <span className="text-5xl">🐉</span>
                  )}
                </div>
                {/* Indicador de daño */}
                <AnimatePresence>
                  {lastResult && lastResult.correct && (
                    <motion.div
                      initial={{ opacity: 0, y: 0, scale: 0.5 }}
                      animate={{ opacity: 1, y: -30, scale: 1 }}
                      exit={{ opacity: 0, y: -60 }}
                      className="absolute top-0 left-1/2 -translate-x-1/2 text-3xl font-bold text-red-400"
                    >
                      -{lastResult.damage}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              
              <h3 className="text-lg font-bold text-white mt-3">{boss.bossName}</h3>
              
              {/* HP Bar del Boss */}
              <div className="w-full max-w-[200px] mt-2">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-red-400 font-medium flex items-center gap-1">
                    <Heart size={14} /> HP
                  </span>
                  <span className="text-white">{boss.currentHp}/{boss.bossHp}</span>
                </div>
                <div className="h-4 bg-gray-800 rounded-full overflow-hidden border border-red-500/30">
                  <motion.div
                    className="h-full bg-gradient-to-r from-red-600 to-red-400"
                    initial={{ width: '100%' }}
                    animate={{ width: `${hpPercentage}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            </div>

            {/* VS Central */}
            <div className="flex flex-col items-center justify-center">
              <AnimatePresence mode="wait">
                {phase === 'vs_screen' && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    className="relative"
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-2xl">
                      <span className="text-2xl font-black text-white">VS</span>
                    </div>
                    <motion.div
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="absolute inset-0 bg-yellow-400/30 rounded-full blur-xl"
                    />
                  </motion.div>
                )}

                {phase === 'waiting' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                  >
                    <Button
                      onClick={handleSelectChallenger}
                      className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white px-6 py-3"
                      leftIcon={<Zap size={20} />}
                      isLoading={selectChallengerMutation.isPending}
                    >
                      ¡Siguiente Retador!
                    </Button>
                    <p className="text-white/60 text-sm mt-2">
                      Selección aleatoria
                    </p>
                  </motion.div>
                )}

                {phase === 'selecting' && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
                  />
                )}

                {phase === 'round_end' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center bg-black/50 backdrop-blur-sm rounded-2xl p-6"
                  >
                    <p className="text-white text-lg mb-4">
                      ¡Todos han participado en esta ronda!
                    </p>
                    <Button
                      onClick={() => newRoundMutation.mutate()}
                      className="bg-gradient-to-r from-purple-500 to-indigo-500"
                      leftIcon={<RotateCcw size={18} />}
                      isLoading={newRoundMutation.isPending}
                    >
                      Nueva Ronda
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Challenger (derecha) */}
            <div className="flex flex-col items-center">
              <AnimatePresence mode="wait">
                {challenger ? (
                  <motion.div
                    key={challenger.id}
                    initial={{ x: 100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -100, opacity: 0 }}
                    className="flex flex-col items-center"
                  >
                    <motion.div
                      animate={{ 
                        scale: phase === 'vs_screen' ? [1, 1.1, 1] : 1,
                      }}
                      transition={{ duration: 0.5, repeat: phase === 'vs_screen' ? Infinity : 0, delay: 0.25 }}
                      className="relative"
                    >
                      <ChallengerAvatar challenger={challenger} size={112} />
                      {/* Indicador de HP perdido */}
                      <AnimatePresence>
                        {lastResult && !lastResult.correct && (
                          <motion.div
                            initial={{ opacity: 0, y: 0, scale: 0.5 }}
                            animate={{ opacity: 1, y: -30, scale: 1 }}
                            exit={{ opacity: 0, y: -60 }}
                            className="absolute top-0 left-1/2 -translate-x-1/2 text-2xl font-bold text-red-400"
                          >
                            -{currentQuestion?.hpPenalty || 10} HP
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                    
                    <h3 className="text-lg font-bold text-white mt-3">
                      {challenger.characterName || 'Héroe'}
                    </h3>
                    <p className="text-blue-400 text-xs">Nivel {challenger.level}</p>
                    
                    {/* HP Bar del Challenger */}
                    <div className="w-full max-w-[200px] mt-2">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-blue-400 font-medium flex items-center gap-1">
                          <Heart size={14} /> HP
                        </span>
                        <span className="text-white">{challenger.hp}/{challenger.maxHp}</span>
                      </div>
                      <div className="h-4 bg-gray-800 rounded-full overflow-hidden border border-blue-500/30">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-600 to-cyan-400"
                          style={{ width: `${(challenger.hp / challenger.maxHp) * 100}%` }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-28 h-28 border-4 border-dashed border-white/20 rounded-full flex items-center justify-center"
                  >
                    <span className="text-white/40 text-4xl">?</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Pregunta */}
        <AnimatePresence mode="wait">
          {(phase === 'question' || phase === 'result') && currentQuestion && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="mt-4 bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20"
            >
              {/* Timer Bar */}
              {phase === 'question' && !showAnswer && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-white/60 flex items-center gap-1">
                      <Clock size={14} /> Tiempo
                    </span>
                    <span className={`font-bold ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                      {timeLeft}s
                    </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${timeLeft <= 5 ? 'bg-red-500' : timeLeft <= 10 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      initial={{ width: '100%' }}
                      animate={{ width: `${(timeLeft / (currentQuestion.timeLimit || 30)) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <span className="text-white/60 text-sm flex items-center gap-2">
                  <HelpCircle size={16} />
                  Pregunta {currentQuestionIndex + 1} de {questions.length}
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-green-400 text-sm flex items-center gap-1">
                    <Zap size={14} /> +{currentQuestion.damage} daño
                  </span>
                  <span className="text-red-400 text-sm flex items-center gap-1">
                    <Heart size={14} /> -{currentQuestion.hpPenalty || 10} HP si falla
                  </span>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white mb-6 text-center">
                {currentQuestion.question}
              </h2>

              {currentQuestion.imageUrl && (
                <img 
                  src={currentQuestion.imageUrl} 
                  alt="Pregunta"
                  className="max-w-md mx-auto rounded-xl mb-6"
                />
              )}

              {/* Opciones - usando renderQuestionOptions para todos los tipos */}
              <div className="mb-6">
                {renderQuestionOptions(
                  currentQuestion, 
                  showAnswer, 
                  shuffledPairs,
                  selectedOption,
                  (idx) => {
                    const qType = (currentQuestion.battleQuestionType || 'SINGLE_CHOICE') as BattleQuestionType;
                    if (qType === 'MULTIPLE_CHOICE') {
                      // Toggle para selección múltiple
                      setSelectedOption(prev => {
                        const current = Array.isArray(prev) ? prev : [];
                        return current.includes(idx) 
                          ? current.filter(x => x !== idx) 
                          : [...current, idx];
                      });
                    } else {
                      // Selección simple
                      setSelectedOption(idx);
                    }
                  }
                )}
              </div>

              {/* Indicador de selección */}
              {phase === 'question' && !answerRevealed && selectedOption !== null && (
                <div className="text-center mb-4">
                  <span className="text-purple-400 text-sm">
                    ✓ Respuesta seleccionada: <span className="font-bold">
                      {Array.isArray(selectedOption) 
                        ? selectedOption.map(i => String.fromCharCode(65 + i)).join(', ')
                        : String.fromCharCode(65 + selectedOption)
                      }
                    </span>
                  </span>
                </div>
              )}

              {/* Botones de acción - NUEVO FLUJO */}
              {phase === 'question' && !answerRevealed && (
                <div className="flex justify-center">
                  <Button
                    onClick={() => {
                      setAnswerRevealed(true);
                      setShowAnswer(true);
                    }}
                    className="bg-gradient-to-r from-purple-500 to-indigo-500 px-8"
                    leftIcon={<HelpCircle size={18} />}
                  >
                    Revelar Respuesta
                  </Button>
                </div>
              )}

              {/* Indicadores después de revelar */}
              {phase === 'question' && answerRevealed && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  {/* Tiempo agotado */}
                  {expired && (
                    <div className="text-center py-2 bg-red-500/20 rounded-lg border border-red-500/30">
                      <span className="text-red-400 font-bold">⏰ Tiempo agotado</span>
                    </div>
                  )}
                  
                  {/* Respuesta correcta - Solo para no-MATCHING */}
                  {currentQuestion.battleQuestionType !== 'MATCHING' && (
                    <div className="text-center py-2 bg-green-500/20 rounded-lg border border-green-500/30">
                      <span className="text-green-400 font-bold">
                        ✓ Correcta: {(() => {
                          const qType = currentQuestion.battleQuestionType || 'SINGLE_CHOICE';
                          if (qType === 'TRUE_FALSE') {
                            return currentQuestion.correctIndex === 0 ? 'Verdadero' : 'Falso';
                          }
                          if (qType === 'MULTIPLE_CHOICE') {
                            const ci = safeJsonParse(currentQuestion.correctIndices) || [];
                            return ci.map((i: number) => String.fromCharCode(65 + i)).join(', ');
                          }
                          return String.fromCharCode(65 + currentQuestion.correctIndex);
                        })()}
                      </span>
                    </div>
                  )}

                  {/* Botones Correcto/Incorrecto */}
                  {!isProcessingAnswer && (
                    <div className="flex justify-center gap-4">
                      <Button
                        onClick={() => handleAnswer(true)}
                        disabled={isProcessingAnswer}
                        className="bg-green-500 hover:bg-green-600 px-8"
                        leftIcon={<Check size={18} />}
                      >
                        ¡Correcto!
                      </Button>
                      <Button
                        onClick={() => handleAnswer(false)}
                        disabled={isProcessingAnswer}
                        className="bg-red-500 hover:bg-red-600 px-8"
                        leftIcon={<X size={18} />}
                      >
                        Incorrecto
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}

              {phase === 'result' && (
                <div className="flex justify-center">
                  <Button
                    onClick={handleNextQuestion}
                    className="bg-gradient-to-r from-orange-500 to-yellow-500 px-8"
                    rightIcon={<ChevronRight size={18} />}
                  >
                    {currentQuestionIndex < questions.length - 1 ? 'Siguiente Pregunta' : 'Finalizar'}
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pantalla de Victoria */}
        <AnimatePresence>
          {phase === 'victory' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
            >
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-8xl mb-6"
                >
                  🏆
                </motion.div>
                <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-4">
                  ¡VICTORIA!
                </h1>
                <p className="text-white/80 text-xl mb-2">
                  ¡El {boss.bossName} ha sido derrotado!
                </p>
                <div className="flex items-center justify-center gap-6 mt-6 mb-8">
                  <div className="text-center">
                    <Sparkles className="w-8 h-8 text-blue-400 mx-auto mb-1" />
                    <span className="text-2xl font-bold text-blue-400">+{boss.xpReward}</span>
                    <p className="text-white/60 text-sm">XP para todos</p>
                  </div>
                  <div className="text-center">
                    <Coins className="w-8 h-8 text-amber-400 mx-auto mb-1" />
                    <span className="text-2xl font-bold text-amber-400">+{boss.gpReward}</span>
                    <p className="text-white/60 text-sm">GP para todos</p>
                  </div>
                  {boss.participantBonus > 0 && (
                    <div className="text-center">
                      <Trophy className="w-8 h-8 text-purple-400 mx-auto mb-1" />
                      <span className="text-2xl font-bold text-purple-400">+{boss.participantBonus}</span>
                      <p className="text-white/60 text-sm">Bonus participantes</p>
                    </div>
                  )}
                </div>
                <Button
                  onClick={onBack}
                  className="bg-gradient-to-r from-green-500 to-emerald-500"
                >
                  Volver al menú
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pantalla de Derrota */}
        <AnimatePresence>
          {phase === 'defeat' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
            >
              <div className="text-center">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-8xl mb-6"
                >
                  💀
                </motion.div>
                <h1 className="text-5xl font-black text-red-500 mb-4">
                  DERROTA
                </h1>
                <p className="text-white/80 text-xl mb-8">
                  El {boss.bossName} sigue en pie...
                </p>
                <Button
                  onClick={onBack}
                  className="bg-gradient-to-r from-gray-600 to-gray-700"
                >
                  Volver al menú
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
