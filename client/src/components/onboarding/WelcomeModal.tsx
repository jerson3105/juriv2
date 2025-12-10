import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, X, GraduationCap, Copy, Users } from 'lucide-react';
import { useOnboardingStore } from '../../store/onboardingStore';

interface WelcomeModalProps {
  isOpen: boolean;
}

export const WelcomeModal = ({ isOpen }: WelcomeModalProps) => {
  const { startOnboarding, dismissWelcome } = useOnboardingStore();

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        dismissWelcome();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, dismissWelcome]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          >
            {/* Header con gradiente */}
            <div className="relative bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 p-6 text-white">
              {/* Botón cerrar */}
              <button
                onClick={dismissWelcome}
                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>

              {/* Decoración */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />

              {/* Contenido */}
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <GraduationCap size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">¡Bienvenido a Juried!</h2>
                    <p className="text-white/80 text-sm">Gamifica tu aula en minutos</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-5">
                Te guiaremos para crear tu primera clase. Es muy sencillo:
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                  <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-white text-sm">Crea tu clase</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Dale un nombre y personalízala</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-white text-sm flex items-center gap-1">
                      Comparte el código <Copy size={12} className="text-blue-500" />
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tus estudiantes se unen con un código único</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                  <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-white text-sm flex items-center gap-1">
                      ¡Listo! <Users size={12} className="text-emerald-500" />
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Comienza a gamificar tu clase</p>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex flex-col gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startOnboarding}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-xl transition-all"
                >
                  <Sparkles size={18} />
                  Crear mi primera clase
                  <ArrowRight size={18} />
                </motion.button>

                <button
                  onClick={dismissWelcome}
                  className="w-full py-2 text-gray-400 text-sm hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  Lo haré después
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
