import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Rocket,
  Users,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Target,
  Brain,
  Heart,
  HelpCircle,
  Check,
  Zap,
  Award,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { onboardingApi } from '../../lib/onboardingApi';
import confetti from 'canvas-confetti';

type Objective = 'participation' | 'behavior' | 'learning' | 'unknown';

/** Shared transition for step changes */
const stepTransition = { duration: 0.3, ease: 'easeOut' };
const stepVariants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

export default function TeacherOnboardingFlow() {
  const [step, setStep] = useState<1 | 2 | 3 | 'celebration'>(1);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [setupStep, setSetupStep] = useState(0); // 0=create class, 1=add student, 2=apply behavior
  const queryClient = useQueryClient();

  const experiencedMutation = useMutation({
    mutationFn: () => onboardingApi.markExperienced(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teacher-onboarding'] }),
  });

  const objectiveMutation = useMutation({
    mutationFn: (obj: string) => onboardingApi.setObjective(obj),
  });

  const completeMutation = useMutation({
    mutationFn: () => onboardingApi.complete(),
    onSuccess: () => {
      // Show celebration screen, then redirect after 2.5s
      setStep('celebration');
    },
  });

  const handleExperienced = () => {
    experiencedMutation.mutate();
  };

  const handleObjectiveSelect = async (obj: Objective) => {
    setObjective(obj);
    objectiveMutation.mutate(obj);
    // Small delay so the user sees the selected state
    setTimeout(() => setStep(3), 400);
  };

  const handleSetupNext = () => {
    if (setupStep < 2) {
      setSetupStep(setupStep + 1);
    } else {
      completeMutation.mutate();
    }
  };

  // Celebration: fire confetti then invalidate after delay
  useEffect(() => {
    if (step !== 'celebration') return;
    // Fire confetti bursts
    const burst = () => {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6, x: 0.5 }, colors: ['#6366f1', '#a855f7', '#22c55e', '#f59e0b', '#ec4899'] });
    };
    burst();
    const t1 = setTimeout(burst, 600);
    const t2 = setTimeout(burst, 1200);
    // Redirect after 2.5s
    const redirect = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['teacher-onboarding'] });
    }, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(redirect); };
  }, [step, queryClient]);

  return (
    <div className="fixed inset-0 z-[200] bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950 flex items-center justify-center overflow-auto">
      {/* Background decoration */}
      <div className="absolute top-20 right-20 w-72 h-72 bg-indigo-200 dark:bg-indigo-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse pointer-events-none" />
      <div className="absolute bottom-20 left-20 w-72 h-72 bg-purple-200 dark:bg-purple-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

      <AnimatePresence mode="wait">
        {step === 1 && (
          <Step1Welcome
            key="step1"
            onNewbie={() => setStep(2)}
            onExperienced={handleExperienced}
            isLoading={experiencedMutation.isPending}
          />
        )}
        {step === 2 && (
          <Step2Objective
            key="step2"
            onSelect={handleObjectiveSelect}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3Setup
            key="step3"
            currentStep={setupStep}
            objective={objective}
            onNext={handleSetupNext}
            onBack={() => {
              if (setupStep > 0) setSetupStep(setupStep - 1);
              else setStep(2);
            }}
            isCompleting={completeMutation.isPending}
          />
        )}
        {step === 'celebration' && (
          <CelebrationScreen key="celebration" />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Step 1: Welcome ──

function Step1Welcome({
  onNewbie,
  onExperienced,
  isLoading,
}: {
  onNewbie: () => void;
  onExperienced: () => void;
  isLoading: boolean;
}) {
  const [selected, setSelected] = useState<'newbie' | 'experienced' | null>(null);

  const handleNewbie = () => {
    setSelected('newbie');
    setTimeout(onNewbie, 400);
  };

  const handleExperienced = () => {
    setSelected('experienced');
    onExperienced();
  };

  return (
    <motion.div
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={stepTransition}
      className="max-w-lg w-full mx-4"
    >
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <img
          src="/logo.png"
          alt="Juried"
          className="h-12 mx-auto mb-5"
        />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          ¡Bienvenido a Juried!
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          Gamificá tu aula y transformá la experiencia de tus estudiantes
        </p>
      </motion.div>

      <div className="space-y-4">
        {/* Newbie card */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          whileHover={!selected ? { scale: 1.02, boxShadow: '0 8px 30px rgba(99,102,241,0.15)' } : undefined}
          whileTap={!selected ? { scale: 0.98 } : undefined}
          onClick={handleNewbie}
          disabled={!!selected}
          className={`w-full p-5 bg-white dark:bg-gray-800 rounded-2xl border-2 transition-all text-left ${
            selected === 'newbie'
              ? 'border-indigo-500 dark:border-indigo-400 shadow-lg shadow-indigo-500/15 ring-1 ring-indigo-500/20'
              : selected === 'experienced'
              ? 'border-gray-200 dark:border-gray-700 opacity-50'
              : 'border-gray-200 dark:border-gray-700 shadow-sm'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
              {selected === 'newbie' ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  <Check size={24} className="text-white" />
                </motion.div>
              ) : (
                <Rocket size={24} className="text-white" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                Soy nuevo en gamificación
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Quiero que me guíen paso a paso. Empezaré con lo esencial e iré descubriendo más funciones a medida que avance.
              </p>
            </div>
          </div>
        </motion.button>

        {/* Experienced card */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          whileHover={!selected ? { scale: 1.02, boxShadow: '0 8px 30px rgba(16,185,129,0.15)' } : undefined}
          whileTap={!selected ? { scale: 0.98 } : undefined}
          onClick={handleExperienced}
          disabled={isLoading || !!selected}
          className={`w-full p-5 bg-white dark:bg-gray-800 rounded-2xl border-2 transition-all text-left ${
            selected === 'experienced'
              ? 'border-emerald-500 dark:border-emerald-400 shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-500/20'
              : selected === 'newbie'
              ? 'border-gray-200 dark:border-gray-700 opacity-50'
              : 'border-gray-200 dark:border-gray-700 shadow-sm'
          } disabled:cursor-not-allowed`}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
              {selected === 'experienced' ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  <Check size={24} className="text-white" />
                </motion.div>
              ) : (
                <Zap size={24} className="text-white" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                Ya conozco la gamificación
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Quiero acceso completo a todas las funciones desde el inicio.
              </p>
            </div>
          </div>
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Step 2: Objective ──

const OBJECTIVES: Array<{
  value: Objective;
  label: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
}> = [
  {
    value: 'participation',
    label: 'Participación y motivación',
    description: 'Quiero que mis estudiantes participen más activamente en clase',
    icon: Target,
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    value: 'behavior',
    label: 'Comportamiento',
    description: 'Quiero mejorar la disciplina y el comportamiento en el aula',
    icon: Heart,
    gradient: 'from-rose-500 to-pink-500',
  },
  {
    value: 'learning',
    label: 'Aprendizaje y comprensión',
    description: 'Quiero que comprendan mejor los temas de mi curso',
    icon: Brain,
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    value: 'unknown',
    label: 'Aún no lo sé',
    description: 'Quiero explorar y ver qué funciona mejor para mi clase',
    icon: HelpCircle,
    gradient: 'from-gray-500 to-slate-500',
  },
];

function Step2Objective({
  onSelect,
  onBack,
}: {
  onSelect: (obj: Objective) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<Objective | null>(null);

  const handleSelect = (obj: Objective) => {
    setSelected(obj);
    onSelect(obj);
  };

  return (
    <motion.div
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={stepTransition}
      className="max-w-lg w-full mx-4"
    >
      <button
        onClick={onBack}
        disabled={!!selected}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6 transition-colors disabled:opacity-40"
      >
        <ArrowLeft size={16} />
        Volver
      </button>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          ¿Qué es lo primero que querés mejorar en tu clase?
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Esto nos ayuda a personalizar tu experiencia
        </p>
      </div>

      <div className="space-y-3">
        {OBJECTIVES.map((obj, idx) => {
          const Icon = obj.icon;
          const isSelected = selected === obj.value;
          const isOther = selected !== null && !isSelected;
          return (
            <motion.button
              key={obj.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.06, duration: 0.25 }}
              whileHover={!selected ? { scale: 1.02, boxShadow: '0 6px 24px rgba(99,102,241,0.12)' } : undefined}
              whileTap={!selected ? { scale: 0.98 } : undefined}
              onClick={() => handleSelect(obj.value)}
              disabled={!!selected}
              className={`w-full p-4 bg-white dark:bg-gray-800 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? 'border-indigo-500 dark:border-indigo-400 shadow-lg ring-1 ring-indigo-500/20'
                  : isOther
                  ? 'border-gray-200 dark:border-gray-700 opacity-40'
                  : 'border-gray-200 dark:border-gray-700 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 bg-gradient-to-br ${obj.gradient} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  {isSelected ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <Check size={20} className="text-white" />
                    </motion.div>
                  ) : (
                    <Icon size={20} className="text-white" />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{obj.label}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{obj.description}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Step 3: Setup guiado ──

const SETUP_STEPS = [
  {
    title: 'Creá tu primera clase',
    description: 'Una clase es tu espacio gamificado. Tus estudiantes se unen con un código único.',
    icon: GraduationCap,
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    title: 'Agregá al menos un estudiante',
    description: 'Podés agregar estudiantes manualmente o compartirles el código de clase.',
    icon: Users,
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    title: 'Aplicá tu primer comportamiento',
    description: 'Los comportamientos son acciones que suman o restan puntos. Probá con uno positivo.',
    icon: Award,
    gradient: 'from-emerald-500 to-teal-500',
  },
];

function Step3Setup({
  currentStep,
  objective: _objective,
  onNext,
  onBack,
  isCompleting,
}: {
  currentStep: number;
  objective: Objective | null;
  onNext: () => void;
  onBack: () => void;
  isCompleting: boolean;
}) {
  const isLastStep = currentStep === SETUP_STEPS.length - 1;

  return (
    <motion.div
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={stepTransition}
      className="max-w-lg w-full mx-4"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Volver
      </button>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Configuración inicial
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-500">
            {currentStep + 1} de {SETUP_STEPS.length}
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / SETUP_STEPS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-8">
        {SETUP_STEPS.map((s, idx) => {
          const Icon = s.icon;
          const done = idx < currentStep;
          const active = idx === currentStep;

          return (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * idx, duration: 0.25 }}
              className={`relative p-4 rounded-xl border-2 transition-all ${
                active
                  ? 'border-indigo-400 dark:border-indigo-500 bg-white dark:bg-gray-800 shadow-md border-l-4 border-l-indigo-500'
                  : done
                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Step indicator */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  done
                    ? 'bg-emerald-500'
                    : active
                    ? `bg-gradient-to-br ${s.gradient}`
                    : 'bg-transparent border-2 border-gray-300 dark:border-gray-500'
                }`}>
                  {done ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 15, duration: 0.2 }}
                    >
                      <Check size={20} className="text-white" />
                    </motion.div>
                  ) : active ? (
                    <Icon size={20} className="text-white" />
                  ) : (
                    <span className="text-sm font-bold text-gray-400 dark:text-gray-500">{idx + 1}</span>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className={`font-semibold ${
                    done ? 'text-emerald-700 dark:text-emerald-400'
                    : active ? 'text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {s.title}
                  </h4>
                  <p className={`text-xs mt-0.5 ${
                    active ? 'text-gray-500 dark:text-gray-400'
                    : done ? 'text-emerald-600/70 dark:text-emerald-500/70'
                    : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {done ? '✓ Completado' : s.description}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Action */}
      <div className="flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNext}
          disabled={isCompleting}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-xl transition-all disabled:opacity-50"
        >
          {isCompleting ? (
            <span>Completando...</span>
          ) : isLastStep ? (
            <>
              <Sparkles size={18} />
              ¡Completar y empezar!
            </>
          ) : (
            <>
              Hecho, siguiente
              <ArrowRight size={18} />
            </>
          )}
        </motion.button>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
        Podés completar estos pasos ahora o más tarde dentro de la plataforma
      </p>
    </motion.div>
  );
}

// ── Celebration Screen ──

function CelebrationScreen() {
  return (
    <motion.div
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={stepTransition}
      className="text-center max-w-md w-full mx-4"
    >
      <motion.img
        src="/logo.png"
        alt="Juried"
        className="h-14 mx-auto mb-6"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
      >
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          ¡Todo listo!
        </h2>
        <p className="text-lg text-gray-500 dark:text-gray-400">
          Bienvenido a Juried
        </p>
      </motion.div>
      <motion.div
        className="mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div className="w-8 h-8 mx-auto border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Entrando al dashboard...
        </p>
      </motion.div>
    </motion.div>
  );
}
