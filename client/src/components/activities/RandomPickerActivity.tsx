import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Dices, 
  RotateCcw, 
  Volume2, 
  VolumeX,
  UserMinus,
  History,
  Crown,
  Zap,
  Heart,
  Coins,
  Check,
  X,
  Settings,
  Sparkles
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentApi, CHARACTER_CLASSES } from '../../lib/studentApi';
import { behaviorApi, type Behavior } from '../../lib/behaviorApi';
import toast from 'react-hot-toast';

type AnimationType = 'roulette' | 'cards' | 'dice';

interface Student {
  id: string;
  visibleId: string;
  characterName: string | null;
  characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
  level: number;
  xp: number;
  hp: number;
  gp: number;
  avatarUrl: string | null;
}

interface RandomPickerActivityProps {
  classroom: {
    id: string;
    name: string;
    students: Student[];
  };
  onBack: () => void;
}

export const RandomPickerActivity = ({ classroom, onBack }: RandomPickerActivityProps) => {
  const queryClient = useQueryClient();
  
  // Estados
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [excludedStudents, setExcludedStudents] = useState<Set<string>>(new Set());
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [animationType, setAnimationType] = useState<AnimationType>('dice');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPointsPanel, setShowPointsPanel] = useState(false);
  const [pointsAnimation, setPointsAnimation] = useState<{ xp: number; hp: number; gp: number; isPositive: boolean } | null>(null);

  // Query para comportamientos
  const { data: behaviors = [] } = useQuery({
    queryKey: ['behaviors', classroom.id],
    queryFn: () => behaviorApi.getByClassroom(classroom.id),
  });

  // Inicializar estudiantes disponibles
  useEffect(() => {
    if (classroom?.students) {
      const available = classroom.students.filter(s => !excludedStudents.has(s.id));
      setAvailableStudents(available.filter(s => !selectedStudents.find(sel => sel.id === s.id)));
    }
  }, [classroom?.students, excludedStudents, selectedStudents]);

  // Mutation para dar/quitar puntos
  const pointsMutation = useMutation({
    mutationFn: ({ studentId, type, amount }: { studentId: string; type: 'xp' | 'hp' | 'gp'; amount: number }) =>
      studentApi.updatePoints(studentId, { 
        pointType: type.toUpperCase() as 'XP' | 'HP' | 'GP', 
        amount, 
        reason: 'Selección aleatoria' 
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['classroom'] });
      // Mostrar animación
      const { type, amount } = variables;
      setPointsAnimation({
        xp: type === 'xp' ? amount : 0,
        hp: type === 'hp' ? amount : 0,
        gp: type === 'gp' ? amount : 0,
        isPositive: amount > 0,
      });
      setTimeout(() => setPointsAnimation(null), 2000);
      toast.success('Puntos actualizados');
    },
    onError: () => {
      toast.error('Error al actualizar puntos');
    },
  });

  // Mutation para aplicar comportamiento
  const applyBehaviorMutation = useMutation({
    mutationFn: ({ behaviorId, studentIds }: { behaviorId: string; studentIds: string[] }) =>
      behaviorApi.apply({ behaviorId, studentIds }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['classroom'] });
      // Mostrar animación con los puntos del comportamiento
      if (result.behavior) {
        const b = result.behavior;
        const xp = b.xpValue ?? (b.pointType === 'XP' ? b.pointValue : 0);
        const hp = b.hpValue ?? (b.pointType === 'HP' ? b.pointValue : 0);
        const gp = b.gpValue ?? (b.pointType === 'GP' ? b.pointValue : 0);
        setPointsAnimation({
          xp: b.isPositive ? xp : -xp,
          hp: b.isPositive ? hp : -hp,
          gp: b.isPositive ? gp : -gp,
          isPositive: b.isPositive,
        });
        setTimeout(() => setPointsAnimation(null), 2000);
      }
      toast.success('Comportamiento aplicado');
    },
    onError: () => {
      toast.error('Error al aplicar comportamiento');
    },
  });

  // Función para reproducir sonido
  const playSound = useCallback((_type: 'spin' | 'select') => {
    if (!soundEnabled) return;
    // Los sonidos se pueden agregar después con archivos de audio
  }, [soundEnabled]);

  // Seleccionar estudiante aleatorio
  const pickRandomStudent = useCallback(() => {
    if (availableStudents.length === 0) {
      toast.error('No hay más estudiantes disponibles');
      return;
    }

    setIsSpinning(true);
    setShowPointsPanel(false);
    playSound('spin');

    // Duración de la animación según el tipo
    const duration = animationType === 'roulette' ? 3000 : animationType === 'cards' ? 2000 : 2500;

    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * availableStudents.length);
      const selected = availableStudents[randomIndex];
      
      setCurrentStudent(selected);
      setSelectedStudents(prev => [...prev, selected]);
      setAvailableStudents(prev => prev.filter(s => s.id !== selected.id));
      setIsSpinning(false);
      setShowPointsPanel(true);
      playSound('select');
    }, duration);
  }, [availableStudents, animationType, playSound]);

  // Reiniciar ronda
  const resetRound = () => {
    setSelectedStudents([]);
    setCurrentStudent(null);
    setShowPointsPanel(false);
    const available = classroom.students.filter(s => !excludedStudents.has(s.id));
    setAvailableStudents(available);
    toast.success('Nueva ronda iniciada');
  };

  // Excluir/incluir estudiante
  const toggleExclude = (studentId: string) => {
    setExcludedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  // Dar puntos rápidos
  const givePoints = (type: 'xp' | 'hp' | 'gp', amount: number) => {
    if (!currentStudent) return;
    pointsMutation.mutate({ studentId: currentStudent.id, type, amount });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/50 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
              <Dices size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">
                Selección Aleatoria
              </h1>
              <p className="text-xs text-gray-500">
                {availableStudents.length} disponibles • {selectedStudents.length} seleccionados
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-xl transition-colors ${showHistory ? 'bg-violet-100 text-violet-600' : 'hover:bg-white/50 text-gray-500'}`}
          >
            <History size={18} />
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 hover:bg-white/50 rounded-xl text-gray-500 transition-colors"
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl transition-colors ${showSettings ? 'bg-violet-100 text-violet-600' : 'hover:bg-white/50 text-gray-500'}`}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Panel principal */}
        <div className="lg:col-span-2 space-y-4">
          {/* Selector de animación */}
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-white/50 p-4 shadow-lg">
                <h3 className="font-semibold text-gray-800 text-sm mb-3">
                  Tipo de animación
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'roulette', name: 'Ruleta', icon: '🎰' },
                    { id: 'cards', name: 'Cartas', icon: '🃏' },
                    { id: 'dice', name: 'Dado', icon: '🎲' },
                  ].map((anim) => (
                    <button
                      key={anim.id}
                      onClick={() => setAnimationType(anim.id as AnimationType)}
                      className={`p-3 rounded-xl text-center transition-all ${
                        animationType === anim.id
                          ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      <span className="text-2xl">{anim.icon}</span>
                      <p className="text-xs font-medium mt-1">{anim.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Área de animación */}
          <div className="bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 rounded-2xl min-h-[320px] flex items-center justify-center relative overflow-hidden shadow-xl shadow-purple-500/25">
            {/* Decoración de fondo */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl" />
              <div className="absolute bottom-10 right-10 w-32 h-32 bg-white/10 rounded-full blur-xl" />
              <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-white/5 rounded-full blur-lg" />
            </div>

            <AnimatePresence mode="wait">
              {isSpinning ? (
                <SpinningAnimation type={animationType} />
              ) : currentStudent ? (
                <SelectedStudentDisplay student={currentStudent} />
              ) : (
                <IdleState availableCount={availableStudents.length} />
              )}
            </AnimatePresence>
          </div>

          {/* Controles */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={pickRandomStudent}
              disabled={isSpinning || availableStudents.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Dices size={18} />
              {isSpinning ? 'Seleccionando...' : 'Elegir estudiante'}
            </button>
            
            <button
              onClick={resetRound}
              disabled={isSpinning || selectedStudents.length === 0}
              className="flex items-center gap-2 px-4 py-3 bg-white/90 hover:bg-white text-gray-700 font-medium rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw size={16} />
              Nueva ronda
            </button>
          </div>

          {/* Panel de puntos */}
          <AnimatePresence>
            {showPointsPanel && currentStudent && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <PointsPanel 
                  student={currentStudent}
                  onGivePoints={givePoints}
                  onApplyBehavior={(behaviorId) => applyBehaviorMutation.mutate({ behaviorId, studentIds: [currentStudent.id] })}
                  behaviors={behaviors}
                  isLoading={pointsMutation.isPending || applyBehaviorMutation.isPending}
                  pointsAnimation={pointsAnimation}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Panel lateral */}
        <div className="space-y-4">
          {/* Historial */}
          {showHistory && (
            <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-white/50 p-4 shadow-lg">
              <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
                <History size={16} />
                Historial de ronda
              </h3>
              {selectedStudents.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">
                  Aún no hay selecciones
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedStudents.map((student, index) => (
                    <div
                      key={student.id}
                      className="flex items-center gap-2 p-2 bg-violet-50 rounded-lg"
                    >
                      <span className="w-5 h-5 bg-violet-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                        {index + 1}
                      </span>
                      <span className="text-base">
                        {CHARACTER_CLASSES[student.characterClass]?.icon}
                      </span>
                      <span className="text-xs font-medium text-gray-800">
                        {student.characterName || 'Sin nombre'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Estudiantes */}
          <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-white/50 p-4 shadow-lg">
            <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <UserMinus size={16} />
              Estudiantes
            </h3>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {classroom.students.map((student) => {
                const isExcluded = excludedStudents.has(student.id);
                const isSelected = selectedStudents.find(s => s.id === student.id);
                
                return (
                  <div
                    key={student.id}
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                      isExcluded 
                        ? 'bg-red-50' 
                        : isSelected
                          ? 'bg-emerald-50'
                          : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {CHARACTER_CLASSES[student.characterClass]?.icon}
                      </span>
                      <span className={`text-xs font-medium ${
                        isExcluded ? 'text-red-500 line-through' : 'text-gray-800'
                      }`}>
                        {student.characterName || 'Sin nombre'}
                      </span>
                      {isSelected && !isExcluded && (
                        <Check size={12} className="text-emerald-500" />
                      )}
                    </div>
                    <button
                      onClick={() => toggleExclude(student.id)}
                      className={`p-1 rounded transition-colors ${
                        isExcluded
                          ? 'text-emerald-600 hover:bg-emerald-100'
                          : 'text-red-400 hover:bg-red-100'
                      }`}
                      title={isExcluded ? 'Incluir' : 'Excluir'}
                    >
                      {isExcluded ? <Check size={14} /> : <X size={14} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente de estado inicial
const IdleState = ({ availableCount }: { availableCount: number }) => (
  <motion.div
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    exit={{ scale: 0.8, opacity: 0 }}
    className="text-center text-white"
  >
    <motion.div
      animate={{ 
        rotate: [0, 10, -10, 0],
        scale: [1, 1.1, 1]
      }}
      transition={{ 
        duration: 2,
        repeat: Infinity,
        repeatType: 'reverse'
      }}
      className="text-8xl mb-6"
    >
      🎲
    </motion.div>
    <h2 className="text-2xl font-bold mb-2">¿Quién será el elegido?</h2>
    <p className="text-white/70">
      {availableCount} {availableCount === 1 ? 'estudiante esperando' : 'estudiantes esperando'}
    </p>
  </motion.div>
);

// Animación de ruleta
const SpinningAnimation = ({ type }: { type: AnimationType }) => {
  if (type === 'roulette') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: 360 * 5 }}
          transition={{ duration: 3, ease: 'easeOut' }}
          className="w-48 h-48 mx-auto relative"
        >
          <div className="absolute inset-0 rounded-full border-8 border-white/30 border-t-yellow-400 border-r-pink-400 border-b-cyan-400 border-l-green-400" />
          <div className="absolute inset-4 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="text-5xl"
            >
              🎰
            </motion.span>
          </div>
        </motion.div>
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="text-white text-xl mt-6 font-medium"
        >
          Girando...
        </motion.p>
      </motion.div>
    );
  }

  if (type === 'cards') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex gap-4"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              rotateY: [0, 180, 360],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.2,
            }}
            className="w-24 h-36 bg-gradient-to-br from-white to-gray-200 rounded-xl shadow-2xl flex items-center justify-center"
          >
            <span className="text-4xl">🃏</span>
          </motion.div>
        ))}
      </motion.div>
    );
  }

  // Dice animation
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-center"
    >
      <motion.div
        animate={{
          rotateX: [0, 360],
          rotateY: [0, 360],
          rotateZ: [0, 180],
        }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="text-9xl inline-block"
        style={{ transformStyle: 'preserve-3d' }}
      >
        🎲
      </motion.div>
      <motion.p
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="text-white text-xl mt-6 font-medium"
      >
        Lanzando dado...
      </motion.p>
    </motion.div>
  );
};

// Estudiante seleccionado
const SelectedStudentDisplay = ({ student }: { student: Student }) => {
  const classInfo = CHARACTER_CLASSES[student.characterClass];
  
  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', damping: 15, stiffness: 200 }}
      className="text-center"
    >
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mb-4"
      >
        <Crown className="w-12 h-12 mx-auto text-yellow-400" />
      </motion.div>
      
      <motion.div
        animate={{ 
          boxShadow: [
            '0 0 20px rgba(255,255,255,0.3)',
            '0 0 60px rgba(255,255,255,0.6)',
            '0 0 20px rgba(255,255,255,0.3)',
          ]
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="w-32 h-32 mx-auto bg-white rounded-full flex items-center justify-center mb-4"
      >
        <span className="text-6xl">{classInfo?.icon}</span>
      </motion.div>
      
      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-bold text-white mb-2"
      >
        {student.characterName || 'Sin nombre'}
      </motion.h2>
      
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-white/70"
      >
        {classInfo?.name} • Nivel {student.level}
      </motion.p>

      {/* Confetti effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              y: -20, 
              x: Math.random() * 400 - 200,
              opacity: 1,
              scale: Math.random() * 0.5 + 0.5
            }}
            animate={{ 
              y: 500,
              rotate: Math.random() * 360,
              opacity: 0
            }}
            transition={{ 
              duration: Math.random() * 2 + 1,
              delay: Math.random() * 0.5,
              ease: 'easeOut'
            }}
            className="absolute top-0 left-1/2"
            style={{
              fontSize: '24px',
            }}
          >
            {['⭐', '✨', '🎉', '🎊', '💫'][Math.floor(Math.random() * 5)]}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

// Panel de puntos
const PointsPanel = ({ 
  student, 
  onGivePoints, 
  onApplyBehavior,
  behaviors,
  isLoading,
  pointsAnimation,
}: { 
  student: Student;
  onGivePoints: (type: 'xp' | 'hp' | 'gp', amount: number) => void;
  onApplyBehavior: (behaviorId: string) => void;
  behaviors: Behavior[];
  isLoading: boolean;
  pointsAnimation: { xp: number; hp: number; gp: number; isPositive: boolean } | null;
}) => {
  const [activeTab, setActiveTab] = useState<'quick' | 'behaviors'>('behaviors');
  
  const presets = [
    { type: 'xp' as const, amounts: [5, 10, 25, -5, -10], icon: <Zap size={14} />, label: 'XP', activeClass: 'bg-emerald-500 text-white', inactiveClass: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
    { type: 'hp' as const, amounts: [5, 10, -5, -10], icon: <Heart size={14} />, label: 'HP', activeClass: 'bg-red-500 text-white', inactiveClass: 'bg-red-100 text-red-700 hover:bg-red-200' },
    { type: 'gp' as const, amounts: [5, 10, 25, -5], icon: <Coins size={14} />, label: 'GP', activeClass: 'bg-amber-500 text-white', inactiveClass: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
  ];

  const positiveBehaviors = behaviors.filter(b => b.isPositive);
  const negativeBehaviors = behaviors.filter(b => !b.isPositive);

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-white/50 p-4 shadow-lg relative overflow-hidden">
      {/* Animación de puntos */}
      <AnimatePresence>
        {pointsAnimation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: -30 }}
            exit={{ opacity: 0, y: -60 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <div className="flex items-center gap-3 bg-white/95 px-6 py-3 rounded-2xl shadow-xl">
              {pointsAnimation.xp !== 0 && (
                <span className={`flex items-center gap-1 font-bold ${pointsAnimation.xp > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  <Zap size={18} />
                  {pointsAnimation.xp > 0 ? '+' : ''}{pointsAnimation.xp} XP
                </span>
              )}
              {pointsAnimation.hp !== 0 && (
                <span className={`flex items-center gap-1 font-bold ${pointsAnimation.hp > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  <Heart size={18} />
                  {pointsAnimation.hp > 0 ? '+' : ''}{pointsAnimation.hp} HP
                </span>
              )}
              {pointsAnimation.gp !== 0 && (
                <span className={`flex items-center gap-1 font-bold ${pointsAnimation.gp > 0 ? 'text-amber-600' : 'text-gray-600'}`}>
                  <Coins size={18} />
                  {pointsAnimation.gp > 0 ? '+' : ''}{pointsAnimation.gp} GP
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
        <Sparkles size={16} className="text-violet-500" />
        Dar puntos a {student.characterName}
      </h3>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('behaviors')}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'behaviors' ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-600'
          }`}
        >
          Comportamientos
        </button>
        <button
          onClick={() => setActiveTab('quick')}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'quick' ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-600'
          }`}
        >
          Puntos rápidos
        </button>
      </div>
      
      {activeTab === 'quick' ? (
        <div className="space-y-3">
          {presets.map((preset) => (
            <div key={preset.type} className="flex items-center gap-2">
              <div className="flex items-center gap-1 w-12 text-gray-600">
                {preset.icon}
                <span className="text-xs font-medium">{preset.label}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {preset.amounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => onGivePoints(preset.type, amount)}
                    disabled={isLoading}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      amount > 0
                        ? preset.inactiveClass
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    {amount > 0 ? `+${amount}` : amount}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3 max-h-48 overflow-y-auto">
          {/* Comportamientos positivos */}
          {positiveBehaviors.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">✨ Para dar puntos</p>
              <div className="space-y-1">
                {positiveBehaviors.map((b) => {
                  const xp = b.xpValue ?? (b.pointType === 'XP' ? b.pointValue : 0);
                  const hp = b.hpValue ?? (b.pointType === 'HP' ? b.pointValue : 0);
                  const gp = b.gpValue ?? (b.pointType === 'GP' ? b.pointValue : 0);
                  return (
                    <button
                      key={b.id}
                      onClick={() => onApplyBehavior(b.id)}
                      disabled={isLoading}
                      className="w-full flex items-center justify-between p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{b.icon || '⭐'}</span>
                        <span className="text-xs font-medium text-gray-800">{b.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {xp > 0 && <span className="text-xs bg-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded font-medium">+{xp} XP</span>}
                        {hp > 0 && <span className="text-xs bg-red-200 text-red-700 px-1.5 py-0.5 rounded font-medium">+{hp} HP</span>}
                        {gp > 0 && <span className="text-xs bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded font-medium">+{gp} GP</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comportamientos negativos */}
          {negativeBehaviors.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">⚡ Para quitar puntos</p>
              <div className="space-y-1">
                {negativeBehaviors.map((b) => {
                  const xp = b.xpValue ?? (b.pointType === 'XP' ? b.pointValue : 0);
                  const hp = b.hpValue ?? (b.pointType === 'HP' ? b.pointValue : 0);
                  const gp = b.gpValue ?? (b.pointType === 'GP' ? b.pointValue : 0);
                  return (
                    <button
                      key={b.id}
                      onClick={() => onApplyBehavior(b.id)}
                      disabled={isLoading}
                      className="w-full flex items-center justify-between p-2 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{b.icon || '💔'}</span>
                        <span className="text-xs font-medium text-gray-800">{b.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {xp > 0 && <span className="text-xs bg-red-200 text-red-700 px-1.5 py-0.5 rounded font-medium">-{xp} XP</span>}
                        {hp > 0 && <span className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-medium">-{hp} HP</span>}
                        {gp > 0 && <span className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-medium">-{gp} GP</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {behaviors.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-4">
              No hay comportamientos configurados
            </p>
          )}
        </div>
      )}
    </div>
  );
};
