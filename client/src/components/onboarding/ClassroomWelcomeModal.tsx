import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, UserPlus, Sparkles, SkipForward, X } from 'lucide-react';
import { useClassroomOnboardingStore } from '../../store/classroomOnboardingStore';
import { studentApi } from '../../lib/studentApi';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface ClassroomWelcomeModalProps {
  isOpen: boolean;
  classroomId: string;
  hasStudents: boolean;
}

export const ClassroomWelcomeModal = ({ isOpen, classroomId, hasStudents }: ClassroomWelcomeModalProps) => {
  const { startClassroomOnboarding, skipOnboarding, setHasDemoStudent } = useClassroomOnboardingStore();
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);
  const [hasDemoStudent, setLocalHasDemoStudent] = useState(false);
  const [isCheckingDemo, setIsCheckingDemo] = useState(true);
  const queryClient = useQueryClient();

  // Verificar si ya existe un estudiante demo
  useEffect(() => {
    const checkDemoStudent = async () => {
      if (!isOpen || !classroomId) return;
      
      setIsCheckingDemo(true);
      try {
        const hasDemo = await studentApi.hasDemoStudent(classroomId);
        setLocalHasDemoStudent(hasDemo);
        setHasDemoStudent(hasDemo);
      } catch (error) {
        console.error('Error checking demo student:', error);
      } finally {
        setIsCheckingDemo(false);
      }
    };

    checkDemoStudent();
  }, [isOpen, classroomId, setHasDemoStudent]);

  const handleStartWithDemo = async () => {
    setIsCreatingDemo(true);
    try {
      await studentApi.createDemoStudent(classroomId);
      setHasDemoStudent(true);
      setLocalHasDemoStudent(true);
      queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
      toast.success('¡Estudiante demo creado!');
      startClassroomOnboarding(classroomId);
    } catch (error) {
      toast.error('Error al crear estudiante demo');
      console.error(error);
    } finally {
      setIsCreatingDemo(false);
    }
  };

  const handleStartWithoutDemo = () => {
    startClassroomOnboarding(classroomId);
  };

  const handleSkip = () => {
    skipOnboarding();
  };

  if (!isOpen) return null;

  // Determinar si mostrar opción de crear demo
  const showDemoOption = !hasStudents && !hasDemoStudent;
  const showContinueWithDemo = hasDemoStudent;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header con gradiente */}
          <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500 p-5 text-white relative overflow-hidden">
            <button
              onClick={handleSkip}
              className="absolute top-3 right-3 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
            
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <GraduationCap size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Tour de tu clase</h2>
                <p className="text-white/80 text-xs">Aprende a usar la gamificación</p>
              </div>
            </div>
          </div>

          {/* Contenido */}
          <div className="p-5">
            {isCheckingDemo ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : showDemoOption ? (
              <>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-5">
                  <p className="text-amber-800 dark:text-amber-200 text-xs">
                    <strong>Tip:</strong> Crea un estudiante demo para practicar sin afectar datos reales.
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleStartWithDemo}
                    disabled={isCreatingDemo}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-xl transition-all disabled:opacity-50"
                  >
                    {isCreatingDemo ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <UserPlus size={18} />
                        Crear estudiante demo
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleStartWithoutDemo}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium rounded-xl transition-colors text-sm"
                  >
                    <Sparkles size={16} />
                    Continuar sin demo
                  </button>
                </div>
              </>
            ) : showContinueWithDemo ? (
              <>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 mb-5">
                  <p className="text-emerald-800 dark:text-emerald-200 text-xs">
                    ✓ Ya tienes un estudiante demo. ¡Perfecto para practicar!
                  </p>
                </div>

                <button
                  onClick={handleStartWithoutDemo}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-xl transition-all"
                >
                  <Sparkles size={18} />
                  Comenzar tour
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-5">
                  Te mostraremos cómo usar las funciones de gamificación.
                </p>

                <button
                  onClick={handleStartWithoutDemo}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-xl transition-all"
                >
                  <Sparkles size={18} />
                  Comenzar tour
                </button>
              </>
            )}

            {/* Botón de omitir */}
            <button
              onClick={handleSkip}
              className="w-full mt-3 flex items-center justify-center gap-1.5 px-4 py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs transition-colors"
            >
              <SkipForward size={14} />
              Omitir por ahora
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
