import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { 
  ArrowLeft, Dices, RotateCcw, Volume2, VolumeX, UserMinus, History,
  Crown, Zap, Heart, Coins, Check, X, Settings, Sparkles, Star, Trophy, Users
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentApi, CHARACTER_CLASSES } from '../../lib/studentApi';
import { behaviorApi, type Behavior } from '../../lib/behaviorApi';
import toast from 'react-hot-toast';

type AnimationType = 'slot' | 'wheel' | 'cards';

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
  classroom: { id: string; name: string; students: Student[] };
  onBack: () => void;
}

const NEON_COLORS = ['rgba(139,92,246,0.8)', 'rgba(236,72,153,0.8)', 'rgba(59,130,246,0.8)', 'rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)'];

export const RandomPickerActivity = ({ classroom, onBack }: RandomPickerActivityProps) => {
  const queryClient = useQueryClient();
  const slotRef = useRef<HTMLDivElement>(null);
  
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [excludedStudents, setExcludedStudents] = useState<Set<string>>(new Set());
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [animationType, setAnimationType] = useState<AnimationType>('slot');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPointsPanel, setShowPointsPanel] = useState(false);
  const [pointsAnimation, setPointsAnimation] = useState<{ xp: number; hp: number; gp: number; isPositive: boolean } | null>(null);
  const [slotItems, setSlotItems] = useState<Student[]>([]);
  const [slotPosition, setSlotPosition] = useState(0);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const { data: behaviors = [] } = useQuery({
    queryKey: ['behaviors', classroom.id],
    queryFn: () => behaviorApi.getByClassroom(classroom.id),
  });

  useEffect(() => {
    if (classroom?.students) {
      const available = classroom.students.filter(s => !excludedStudents.has(s.id));
      setAvailableStudents(available.filter(s => !selectedStudents.find(sel => sel.id === s.id)));
    }
  }, [classroom?.students, excludedStudents, selectedStudents]);

  const pointsMutation = useMutation({
    mutationFn: ({ studentId, type, amount }: { studentId: string; type: 'xp' | 'hp' | 'gp'; amount: number }) =>
      studentApi.updatePoints(studentId, { pointType: type.toUpperCase() as 'XP' | 'HP' | 'GP', amount, reason: 'Selección aleatoria' }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['classroom'] });
      const { type, amount } = variables;
      setPointsAnimation({ xp: type === 'xp' ? amount : 0, hp: type === 'hp' ? amount : 0, gp: type === 'gp' ? amount : 0, isPositive: amount > 0 });
      setTimeout(() => setPointsAnimation(null), 2000);
      toast.success('Puntos actualizados');
    },
    onError: () => toast.error('Error al actualizar puntos'),
  });

  const applyBehaviorMutation = useMutation({
    mutationFn: ({ behaviorId, studentIds }: { behaviorId: string; studentIds: string[] }) => behaviorApi.apply({ behaviorId, studentIds }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['classroom'] });
      if (result.behavior) {
        const b = result.behavior;
        const xp = b.xpValue ?? (b.pointType === 'XP' ? b.pointValue : 0);
        const hp = b.hpValue ?? (b.pointType === 'HP' ? b.pointValue : 0);
        const gp = b.gpValue ?? (b.pointType === 'GP' ? b.pointValue : 0);
        setPointsAnimation({ xp: b.isPositive ? xp : -xp, hp: b.isPositive ? hp : -hp, gp: b.isPositive ? gp : -gp, isPositive: b.isPositive });
        setTimeout(() => setPointsAnimation(null), 2000);
      }
      toast.success('Comportamiento aplicado');
    },
    onError: () => toast.error('Error al aplicar comportamiento'),
  });

  const launchConfetti = useCallback(() => {
    const end = Date.now() + 2500;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'] });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  const playSound = useCallback((_type: 'spin' | 'select') => { if (!soundEnabled) return; }, [soundEnabled]);

  const finishSelection = useCallback((selected: Student) => {
    setCurrentStudent(selected);
    setSelectedStudents(prev => [...prev, selected]);
    setAvailableStudents(prev => prev.filter(s => s.id !== selected.id));
    setIsSpinning(false);
    setShowPointsPanel(true);
    playSound('select');
    launchConfetti();
  }, [playSound, launchConfetti]);

  const pickRandomStudent = useCallback(() => {
    if (availableStudents.length === 0) { toast.error('No hay más estudiantes disponibles'); return; }
    setIsSpinning(true);
    setShowPointsPanel(false);
    setCurrentStudent(null);
    playSound('spin');

    const randomIndex = Math.floor(Math.random() * availableStudents.length);
    const selected = availableStudents[randomIndex];

    if (animationType === 'slot') {
      const items: Student[] = [];
      for (let i = 0; i < 30; i++) items.push(availableStudents[i % availableStudents.length]);
      items.push(selected);
      setSlotItems(items);
      const targetPos = items.length - 1;
      const duration = 3000;
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setSlotPosition(Math.floor(eased * targetPos));
        if (progress < 1) requestAnimationFrame(animate);
        else finishSelection(selected);
      };
      animate();
    } else if (animationType === 'wheel') {
      const spins = 5 + Math.random() * 3;
      const segmentAngle = 360 / availableStudents.length;
      setWheelRotation(spins * 360 + (randomIndex * segmentAngle) + (segmentAngle / 2));
      setTimeout(() => finishSelection(selected), 4000);
    } else {
      setTimeout(() => finishSelection(selected), 2500);
    }
  }, [availableStudents, animationType, playSound, finishSelection]);

  const resetRound = () => {
    setSelectedStudents([]);
    setCurrentStudent(null);
    setShowPointsPanel(false);
    setSlotPosition(0);
    setWheelRotation(0);
    setAvailableStudents(classroom.students.filter(s => !excludedStudents.has(s.id)));
    toast.success('Nueva ronda iniciada');
  };

  const toggleExclude = (studentId: string) => {
    setExcludedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) newSet.delete(studentId);
      else newSet.add(studentId);
      return newSet;
    });
  };

  const givePoints = (type: 'xp' | 'hp' | 'gp', amount: number) => {
    if (!currentStudent) return;
    pointsMutation.mutate({ studentId: currentStudent.id, type, amount });
  };

  return (
    <div className="space-y-5">
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-all border border-white/20">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <motion.div animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity }} className="w-12 h-12 bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/40">
            <Dices size={24} />
          </motion.div>
          <div>
            <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">
              Selección Aleatoria
              <motion.span animate={{ rotate: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}><Star size={16} className="text-amber-500 fill-amber-500" /></motion.span>
            </h1>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-medium"><Users size={12} />{availableStudents.length} disponibles</span>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium"><Trophy size={12} />{selectedStudents.length} seleccionados</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowHistory(!showHistory)} className={`p-2.5 rounded-xl transition-all ${showHistory ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30' : 'bg-white/80 hover:bg-white text-gray-500'}`}><History size={18} /></button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className={`p-2.5 rounded-xl transition-all ${soundEnabled ? 'bg-white/80 hover:bg-white text-gray-500' : 'bg-red-100 text-red-500'}`}>{soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <button onClick={() => setShowSettings(!showSettings)} className={`p-2.5 rounded-xl transition-all ${showSettings ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30' : 'bg-white/80 hover:bg-white text-gray-500'}`}><Settings size={18} /></button>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence>
            {showSettings && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/50 p-4 shadow-xl">
                  <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2"><Sparkles size={16} className="text-violet-500" />Estilo de Animación</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[{ id: 'slot', name: 'Tragamonedas', icon: '🎰', desc: 'Estilo casino' }, { id: 'wheel', name: 'Ruleta', icon: '🎡', desc: 'Gira la rueda' }, { id: 'cards', name: 'Cartas', icon: '🃏', desc: 'Voltea cartas' }].map((anim) => (
                      <motion.button key={anim.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setAnimationType(anim.id as AnimationType)} className={`p-4 rounded-xl text-center transition-all relative overflow-hidden ${animationType === anim.id ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                        {animationType === anim.id && <motion.div className="absolute inset-0 bg-white/20" animate={{ x: ['-100%', '100%'] }} transition={{ duration: 1.5, repeat: Infinity }} />}
                        <span className="text-3xl block mb-1">{anim.icon}</span>
                        <p className="text-sm font-bold">{anim.name}</p>
                        <p className={`text-[10px] ${animationType === anim.id ? 'text-white/70' : 'text-gray-500'}`}>{anim.desc}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative rounded-3xl min-h-[380px] overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-700">
              {[...Array(15)].map((_, i) => (
                <motion.div key={i} className="absolute w-2 h-2 rounded-full" style={{ background: NEON_COLORS[i % NEON_COLORS.length], left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }} animate={{ y: [0, -30, 0], opacity: [0.3, 0.8, 0.3], scale: [1, 1.5, 1] }} transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }} />
              ))}
              <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute bottom-10 right-10 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl" />
            </div>
            <div ref={slotRef} className="relative z-10 flex items-center justify-center min-h-[380px] p-6">
              <AnimatePresence mode="wait">
                {isSpinning ? <SpinningAnimation type={animationType} students={animationType === 'slot' ? slotItems : availableStudents} slotPosition={slotPosition} wheelRotation={wheelRotation} /> : currentStudent ? <SelectedStudentDisplay student={currentStudent} /> : <IdleState availableCount={availableStudents.length} />}
              </AnimatePresence>
            </div>
            <AnimatePresence mode="wait">
              <motion.img
                key={isSpinning ? 'spinning' : currentStudent ? 'selected' : 'idle'}
                src={isSpinning
                  ? '/assets/mascot/jiro-randomPickerWhile.png'
                  : currentStudent
                    ? '/assets/mascot/jiro-randomPickerSelect.png'
                    : '/assets/mascot/jiro-randomPicker.png'}
                alt="Jiro"
                className="absolute bottom-0 left-0 w-52 max-w-[45%] h-auto z-20 pointer-events-none"
                initial={{ x: -40, opacity: 0, scale: 0.9 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: -40, opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 180, damping: 18 }}
              />
            </AnimatePresence>
            <div className="absolute inset-0 rounded-3xl border-2 border-white/20 pointer-events-none" />
          </motion.div>

          <div className="flex items-center justify-center gap-3">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={pickRandomStudent} disabled={isSpinning || availableStudents.length === 0} className="group relative flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 text-white font-bold rounded-2xl shadow-xl shadow-violet-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden">
              <motion.div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0" animate={{ x: ['-100%', '100%'] }} transition={{ duration: 2, repeat: Infinity }} />
              <Dices size={22} className="relative z-10" />
              <span className="relative z-10 text-lg">{isSpinning ? '¡Seleccionando...!' : '¡Elegir Estudiante!'}</span>
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowResetConfirm(true)} disabled={isSpinning || selectedStudents.length === 0} className="flex items-center gap-2 px-5 py-4 bg-white/90 hover:bg-white text-gray-700 font-semibold rounded-2xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <RotateCcw size={18} />Nueva ronda
            </motion.button>
          </div>

          <AnimatePresence>
            {showPointsPanel && currentStudent && (
              <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.95 }}>
                <PointsPanel student={currentStudent} onGivePoints={givePoints} onApplyBehavior={(behaviorId) => applyBehaviorMutation.mutate({ behaviorId, studentIds: [currentStudent.id] })} behaviors={behaviors} isLoading={pointsMutation.isPending || applyBehaviorMutation.isPending} pointsAnimation={pointsAnimation} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {showHistory && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/50 p-4 shadow-xl">
                <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2"><History size={16} className="text-violet-500" />Historial de Ronda</h3>
                {selectedStudents.length === 0 ? (
                  <div className="text-center py-6"><motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-4xl mb-2">🎲</motion.div><p className="text-xs text-gray-500">Aún no hay selecciones</p></div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedStudents.map((student, index) => (
                      <motion.div key={student.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="flex items-center gap-2 p-2.5 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-100">
                        <span className="w-6 h-6 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-md">{index + 1}</span>
                        <span className="text-lg">{CHARACTER_CLASSES[student.characterClass]?.icon}</span>
                        <span className="text-xs font-semibold text-gray-800 flex-1">{student.characterName || 'Sin nombre'}</span>
                        <Crown size={12} className="text-amber-500" />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/50 p-4 shadow-xl">
            <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2"><UserMinus size={16} className="text-violet-500" />Estudiantes<span className="ml-auto text-[10px] px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">{classroom.students.length} total</span></h3>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {classroom.students.map((student) => {
                const isExcluded = excludedStudents.has(student.id);
                const isSelected = selectedStudents.find(s => s.id === student.id);
                return (
                  <motion.div key={student.id} whileHover={{ scale: 1.01 }} className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${isExcluded ? 'bg-red-50 border border-red-200' : isSelected ? 'bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200' : 'bg-gray-50 hover:bg-gray-100 border border-transparent'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{CHARACTER_CLASSES[student.characterClass]?.icon}</span>
                      <div>
                        <span className={`text-xs font-semibold block ${isExcluded ? 'text-red-400 line-through' : 'text-gray-800'}`}>{student.characterName || 'Sin nombre'}</span>
                        <span className="text-[10px] text-gray-400">Nivel {student.level}</span>
                      </div>
                      {isSelected && !isExcluded && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center"><Check size={12} className="text-white" /></motion.div>}
                    </div>
                    <button onClick={() => toggleExclude(student.id)} className={`p-1.5 rounded-lg transition-all ${isExcluded ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-red-100 text-red-400 hover:bg-red-200'}`} title={isExcluded ? 'Incluir' : 'Excluir'}>{isExcluded ? <Check size={14} /> : <X size={14} />}</button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Modal de confirmación Nueva Ronda */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowResetConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <RotateCcw className="w-8 h-8 text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
                  ¿Iniciar nueva ronda?
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                  La selección de estudiantes se reiniciará y todos estarán disponibles nuevamente.
                  <span className="block mt-1 font-medium text-violet-600 dark:text-violet-400">
                    {selectedStudents.length} estudiante{selectedStudents.length !== 1 ? 's' : ''} seleccionado{selectedStudents.length !== 1 ? 's' : ''} se perderá{selectedStudents.length !== 1 ? 'n' : ''}.
                  </span>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      resetRound();
                      setShowResetConfirm(false);
                    }}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl hover:from-violet-600 hover:to-purple-700 font-medium transition-colors"
                  >
                    Sí, reiniciar
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

// Estado inicial
const IdleState = ({ availableCount }: { availableCount: number }) => (
  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="text-center text-white">
    <motion.div className="relative w-32 h-32 mx-auto mb-6" animate={{ rotateY: [0, 360], rotateX: [0, 15, 0, -15, 0] }} transition={{ rotateY: { duration: 8, repeat: Infinity, ease: "linear" }, rotateX: { duration: 4, repeat: Infinity, ease: "easeInOut" } }} style={{ transformStyle: 'preserve-3d', perspective: 1000 }}>
      <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-200 rounded-2xl shadow-2xl flex items-center justify-center transform-gpu"><span className="text-6xl">🎲</span></div>
      <motion.div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent rounded-2xl" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity }} />
    </motion.div>
    <motion.h2 className="text-3xl font-black mb-2" animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 2, repeat: Infinity }}>¿Quién será el elegido?</motion.h2>
    <p className="text-white/70 text-lg">{availableCount} {availableCount === 1 ? 'estudiante esperando' : 'estudiantes esperando'}</p>
    <motion.div className="mt-6 flex items-center justify-center gap-2 text-white/60" animate={{ y: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}><Sparkles size={16} /><span className="text-sm">Presiona el botón para comenzar</span></motion.div>
  </motion.div>
);

// Animación de selección
const SpinningAnimation = ({ type, students, slotPosition, wheelRotation }: { type: AnimationType; students: Student[]; slotPosition: number; wheelRotation: number }) => {
  if (type === 'slot') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center w-full max-w-md">
        <div className="relative bg-gradient-to-b from-amber-400 via-yellow-500 to-amber-600 rounded-2xl p-3 shadow-2xl">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-2">
            {[...Array(5)].map((_, i) => (<motion.div key={i} className="w-3 h-3 rounded-full bg-red-500" animate={{ boxShadow: ['0 0 5px #ef4444', '0 0 20px #ef4444', '0 0 5px #ef4444'] }} transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }} />))}
          </div>
          <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl p-4 overflow-hidden">
            <div className="relative h-24 overflow-hidden rounded-lg bg-white/10">
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center pointer-events-none z-10"><div className="w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" /></div>
              <motion.div className="flex flex-col items-center" style={{ transform: `translateY(${-slotPosition * 96 + 48}px)`, transition: 'transform 0.1s ease-out' }}>
                {students.map((student, idx) => (<div key={idx} className="h-24 flex items-center justify-center gap-3 px-4"><span className="text-4xl">{CHARACTER_CLASSES[student.characterClass]?.icon}</span><span className="text-white font-bold text-lg truncate max-w-[150px]">{student.characterName || 'Sin nombre'}</span></div>))}
              </motion.div>
            </div>
          </div>
          <div className="mt-2 text-center"><span className="text-amber-900 font-black text-sm tracking-wider">🎰 LUCKY PICK 🎰</span></div>
        </div>
        <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.5, repeat: Infinity }} className="text-white text-xl mt-6 font-bold">¡Girando...!</motion.p>
      </motion.div>
    );
  }

  if (type === 'wheel') {
    const numStudents = Math.max(students.length, 1);
    const segmentAngle = 360 / numStudents;
    const colors = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];
    
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center">
        {/* Indicador/flecha */}
        <div className="relative z-20 mb-[-20px]">
          <div className="w-0 h-0 border-l-[20px] border-r-[20px] border-t-[35px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-lg" 
               style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }} />
        </div>
        
        {/* Rueda */}
        <motion.div 
          className="relative w-72 h-72"
          animate={{ rotate: wheelRotation }} 
          transition={{ duration: 4, ease: [0.15, 0.05, 0.25, 1] }}
        >
          {/* Borde exterior decorativo */}
          <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 shadow-2xl" />
          <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-gray-800 to-gray-900" />
          
          {/* SVG de la rueda */}
          <svg viewBox="0 0 200 200" className="relative w-full h-full">
            {students.map((student, idx) => {
              const startAngle = idx * segmentAngle;
              const endAngle = (idx + 1) * segmentAngle;
              const startRad = (startAngle - 90) * Math.PI / 180;
              const endRad = (endAngle - 90) * Math.PI / 180;
              const x1 = 100 + 90 * Math.cos(startRad);
              const y1 = 100 + 90 * Math.sin(startRad);
              const x2 = 100 + 90 * Math.cos(endRad);
              const y2 = 100 + 90 * Math.sin(endRad);
              const largeArc = segmentAngle > 180 ? 1 : 0;
              const midAngle = (startAngle + endAngle) / 2;
              const midRad = (midAngle - 90) * Math.PI / 180;
              const textX = 100 + 55 * Math.cos(midRad);
              const textY = 100 + 55 * Math.sin(midRad);
              
              return (
                <g key={idx}>
                  <path 
                    d={`M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArc} 1 ${x2} ${y2} Z`} 
                    fill={colors[idx % colors.length]} 
                    stroke="white" 
                    strokeWidth="2" 
                  />
                  <text 
                    x={textX} 
                    y={textY} 
                    textAnchor="middle" 
                    dominantBaseline="middle" 
                    fontSize="24"
                    transform={`rotate(${midAngle}, ${textX}, ${textY})`}
                  >
                    {CHARACTER_CLASSES[student.characterClass]?.icon}
                  </text>
                </g>
              );
            })}
            {/* Centro de la rueda */}
            <circle cx="100" cy="100" r="22" fill="white" stroke="#8b5cf6" strokeWidth="4" />
            <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" fontSize="20">🎯</text>
          </svg>
        </motion.div>
        
        <motion.p 
          animate={{ opacity: [0.5, 1, 0.5] }} 
          transition={{ duration: 0.5, repeat: Infinity }} 
          className="text-white text-xl mt-6 font-bold"
        >
          ¡Girando la rueda...!
        </motion.p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-4 perspective-1000">
      {[0, 1, 2].map((i) => (
        <motion.div key={i} className="relative w-28 h-40" animate={{ rotateY: [0, 180, 360], scale: [1, 1.1, 1] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }} style={{ transformStyle: 'preserve-3d' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-2xl flex items-center justify-center backface-hidden"><span className="text-5xl">❓</span></div>
          <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-100 rounded-xl shadow-2xl flex items-center justify-center" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}><span className="text-4xl">🎴</span></div>
        </motion.div>
      ))}
    </motion.div>
  );
};

// Estudiante seleccionado
const SelectedStudentDisplay = ({ student }: { student: Student }) => {
  const classInfo = CHARACTER_CLASSES[student.characterClass];
  return (
    <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 12, stiffness: 150 }} className="text-center relative">
      {/* Corona animada */}
      <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, type: 'spring' }} className="mb-2">
        <motion.div animate={{ y: [0, -5, 0], rotate: [0, 5, -5, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <Crown className="w-14 h-14 mx-auto text-yellow-400 drop-shadow-lg" fill="#facc15" />
        </motion.div>
      </motion.div>
      
      {/* Avatar con anillo giratorio */}
      <div className="relative w-40 h-40 mx-auto mb-4">
        {/* Anillo giratorio exterior */}
        <motion.div 
          className="absolute -inset-2 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, #facc15, #ec4899, #8b5cf6, #3b82f6, #facc15)',
            padding: '3px',
          }}
          animate={{ rotate: 360 }} 
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
          <div className="w-full h-full rounded-full bg-gradient-to-br from-violet-600 to-purple-700" />
        </motion.div>
        
        {/* Contenedor del avatar */}
        <motion.div 
          className="absolute inset-0 rounded-full bg-white p-2 shadow-2xl"
          animate={{ boxShadow: ['0 0 30px rgba(255,255,255,0.4)', '0 0 50px rgba(255,255,255,0.7)', '0 0 30px rgba(255,255,255,0.4)'] }} 
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <div className="w-full h-full rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center overflow-hidden">
            {student.avatarUrl ? (
              <img src={student.avatarUrl} alt={student.characterName || ''} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-7xl">{classInfo?.icon}</span>
            )}
          </div>
        </motion.div>
      </div>
      
      {/* Nombre */}
      <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-4xl font-black text-white mb-2 drop-shadow-lg">
        {student.characterName || 'Sin nombre'}
      </motion.h2>
      
      {/* Badges de clase y nivel */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center justify-center gap-3">
        <span className="px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-semibold">
          {classInfo?.name}
        </span>
        <span className="px-4 py-1.5 bg-yellow-400/30 backdrop-blur-sm rounded-full text-yellow-200 text-sm font-semibold flex items-center gap-1">
          <Star size={14} fill="currentColor" />
          Nivel {student.level}
        </span>
      </motion.div>
      
      {/* Confetti de emojis */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <motion.div 
            key={i} 
            initial={{ y: -20, x: Math.random() * 300 - 150, opacity: 1, scale: Math.random() * 0.5 + 0.7 }} 
            animate={{ y: 400, rotate: Math.random() * 720 - 360, opacity: 0 }} 
            transition={{ duration: Math.random() * 2 + 2, delay: Math.random() * 0.8, ease: 'easeOut' }} 
            className="absolute top-0 left-1/2 text-2xl"
          >
            {['⭐', '✨', '🎉', '🎊', '💫', '🌟', '🏆', '👑'][Math.floor(Math.random() * 8)]}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

// Panel de puntos
const PointsPanel = ({ student, onGivePoints, onApplyBehavior, behaviors, isLoading, pointsAnimation }: { 
  student: Student; onGivePoints: (type: 'xp' | 'hp' | 'gp', amount: number) => void; onApplyBehavior: (behaviorId: string) => void; behaviors: Behavior[]; isLoading: boolean; pointsAnimation: { xp: number; hp: number; gp: number; isPositive: boolean } | null;
}) => {
  const [activeTab, setActiveTab] = useState<'quick' | 'behaviors'>('behaviors');
  const presets = [
    { type: 'xp' as const, amounts: [5, 10, 25, -5, -10], icon: <Zap size={14} />, label: 'XP', color: 'emerald' },
    { type: 'hp' as const, amounts: [5, 10, -5, -10], icon: <Heart size={14} />, label: 'HP', color: 'rose' },
    { type: 'gp' as const, amounts: [5, 10, 25, -5], icon: <Coins size={14} />, label: 'GP', color: 'amber' },
  ];
  const positiveBehaviors = behaviors.filter(b => b.isPositive);
  const negativeBehaviors = behaviors.filter(b => !b.isPositive);

  return (
    <motion.div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-white/50 p-5 shadow-2xl relative overflow-hidden">
      <AnimatePresence>
        {pointsAnimation && (
          <motion.div initial={{ opacity: 0, scale: 0.5, y: 20 }} animate={{ opacity: 1, scale: 1, y: -40 }} exit={{ opacity: 0, scale: 0.5, y: -80 }} className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="flex items-center gap-4 bg-white px-8 py-4 rounded-2xl shadow-2xl border-2 border-violet-200">
              {pointsAnimation.xp !== 0 && <motion.span initial={{ scale: 0 }} animate={{ scale: [1, 1.2, 1] }} className={`flex items-center gap-1 font-black text-lg ${pointsAnimation.xp > 0 ? 'text-emerald-600' : 'text-red-600'}`}><Zap size={20} />{pointsAnimation.xp > 0 ? '+' : ''}{pointsAnimation.xp} XP</motion.span>}
              {pointsAnimation.hp !== 0 && <motion.span initial={{ scale: 0 }} animate={{ scale: [1, 1.2, 1] }} transition={{ delay: 0.1 }} className={`flex items-center gap-1 font-black text-lg ${pointsAnimation.hp > 0 ? 'text-rose-600' : 'text-gray-600'}`}><Heart size={20} />{pointsAnimation.hp > 0 ? '+' : ''}{pointsAnimation.hp} HP</motion.span>}
              {pointsAnimation.gp !== 0 && <motion.span initial={{ scale: 0 }} animate={{ scale: [1, 1.2, 1] }} transition={{ delay: 0.2 }} className={`flex items-center gap-1 font-black text-lg ${pointsAnimation.gp > 0 ? 'text-amber-600' : 'text-gray-600'}`}><Coins size={20} />{pointsAnimation.gp > 0 ? '+' : ''}{pointsAnimation.gp} GP</motion.span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center"><Sparkles size={16} className="text-white" /></div>
        <span>Dar puntos a <span className="text-violet-600">{student.characterName}</span></span>
      </h3>

      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl">
        <button onClick={() => setActiveTab('behaviors')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${activeTab === 'behaviors' ? 'bg-white text-violet-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>🎯 Comportamientos</button>
        <button onClick={() => setActiveTab('quick')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${activeTab === 'quick' ? 'bg-white text-violet-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>⚡ Puntos Rápidos</button>
      </div>
      
      {activeTab === 'quick' ? (
        <div className="space-y-3">
          {presets.map((preset) => (
            <div key={preset.type} className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 w-14 px-2 py-1 rounded-lg ${preset.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' : preset.color === 'rose' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{preset.icon}<span className="text-xs font-bold">{preset.label}</span></div>
              <div className="flex flex-wrap gap-2 flex-1">
                {preset.amounts.map((amount) => (
                  <motion.button key={amount} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => onGivePoints(preset.type, amount)} disabled={isLoading} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${amount > 0 ? preset.color === 'emerald' ? 'bg-emerald-500 text-white hover:bg-emerald-600' : preset.color === 'rose' ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'} disabled:opacity-50 shadow-sm`}>{amount > 0 ? `+${amount}` : amount}</motion.button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 max-h-56 overflow-y-auto pr-1">
          {positiveBehaviors.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2 font-semibold flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full" />Para dar puntos</p>
              <div className="space-y-1.5">
                {positiveBehaviors.map((b) => {
                  const xp = b.xpValue ?? (b.pointType === 'XP' ? b.pointValue : 0);
                  const hp = b.hpValue ?? (b.pointType === 'HP' ? b.pointValue : 0);
                  const gp = b.gpValue ?? (b.pointType === 'GP' ? b.pointValue : 0);
                  return (
                    <motion.button key={b.id} whileHover={{ scale: 1.01, x: 4 }} whileTap={{ scale: 0.99 }} onClick={() => onApplyBehavior(b.id)} disabled={isLoading} className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100 border border-emerald-200 transition-all disabled:opacity-50">
                      <div className="flex items-center gap-2"><span className="text-xl">{b.icon || '⭐'}</span><span className="text-sm font-semibold text-gray-800">{b.name}</span></div>
                      <div className="flex items-center gap-1">
                        {xp > 0 && <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">+{xp} XP</span>}
                        {hp > 0 && <span className="text-xs bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold">+{hp} HP</span>}
                        {gp > 0 && <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">+{gp} GP</span>}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}
          {negativeBehaviors.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2 font-semibold flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full" />Para quitar puntos</p>
              <div className="space-y-1.5">
                {negativeBehaviors.map((b) => {
                  const xp = b.xpValue ?? (b.pointType === 'XP' ? b.pointValue : 0);
                  const hp = b.hpValue ?? (b.pointType === 'HP' ? b.pointValue : 0);
                  const gp = b.gpValue ?? (b.pointType === 'GP' ? b.pointValue : 0);
                  return (
                    <motion.button key={b.id} whileHover={{ scale: 1.01, x: 4 }} whileTap={{ scale: 0.99 }} onClick={() => onApplyBehavior(b.id)} disabled={isLoading} className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 hover:from-red-100 hover:to-rose-100 border border-red-200 transition-all disabled:opacity-50">
                      <div className="flex items-center gap-2"><span className="text-xl">{b.icon || '💔'}</span><span className="text-sm font-semibold text-gray-800">{b.name}</span></div>
                      <div className="flex items-center gap-1">
                        {xp > 0 && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">-{xp} XP</span>}
                        {hp > 0 && <span className="text-xs bg-gray-500 text-white px-2 py-0.5 rounded-full font-bold">-{hp} HP</span>}
                        {gp > 0 && <span className="text-xs bg-gray-500 text-white px-2 py-0.5 rounded-full font-bold">-{gp} GP</span>}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}
          {behaviors.length === 0 && <p className="text-xs text-gray-500 text-center py-4">No hay comportamientos configurados</p>}
        </div>
      )}
    </motion.div>
  );
};

export default RandomPickerActivity;
