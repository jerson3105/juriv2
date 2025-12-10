import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Sparkles, Trophy, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

interface LevelUpAnimationProps {
  show: boolean;
  newLevel: number;
  onComplete?: () => void;
}

export const LevelUpAnimation = ({ show, newLevel, onComplete }: LevelUpAnimationProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      
      // Lanzar confetti
      const duration = 3000;
      const end = Date.now() + duration;

      const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.8 },
          colors: colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.8 },
          colors: colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();

      // Auto-cerrar después de 4 segundos
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => {
            setIsVisible(false);
            onComplete?.();
          }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
            className="relative"
          >
            {/* Círculos de fondo animados */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 -m-20 rounded-full bg-gradient-to-r from-indigo-500/30 to-purple-500/30 blur-3xl"
            />
            <motion.div
              animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              className="absolute inset-0 -m-16 rounded-full bg-gradient-to-r from-amber-500/30 to-pink-500/30 blur-2xl"
            />

            {/* Contenido principal */}
            <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-8 shadow-2xl">
              {/* Estrellas decorativas */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                className="absolute -top-4 -left-4"
              >
                <Star className="w-8 h-8 text-amber-400 fill-amber-400" />
              </motion.div>
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                className="absolute -top-2 -right-6"
              >
                <Sparkles className="w-6 h-6 text-pink-300" />
              </motion.div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                className="absolute -bottom-4 -right-4"
              >
                <Zap className="w-7 h-7 text-amber-300 fill-amber-300" />
              </motion.div>

              <div className="text-center text-white">
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <Trophy className="w-16 h-16 mx-auto mb-4 text-amber-400" />
                </motion.div>

                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold mb-2"
                >
                  ¡SUBISTE DE NIVEL!
                </motion.h2>

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring', damping: 10 }}
                  className="relative"
                >
                  <div className="text-8xl font-black bg-gradient-to-b from-amber-300 to-amber-500 bg-clip-text text-transparent">
                    {newLevel}
                  </div>
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="text-8xl font-black text-white/10">
                      {newLevel}
                    </div>
                  </motion.div>
                </motion.div>

                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-lg text-white/80 mt-4"
                >
                  ¡Sigue así, campeón!
                </motion.p>

                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setIsVisible(false);
                    onComplete?.();
                  }}
                  className="mt-6 px-6 py-2 bg-white/20 hover:bg-white/30 rounded-full text-white font-medium transition-colors"
                >
                  ¡Genial!
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Hook para detectar subida de nivel
export const useLevelUp = (currentLevel: number) => {
  const [previousLevel, setPreviousLevel] = useState(currentLevel);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(currentLevel);

  useEffect(() => {
    if (currentLevel > previousLevel) {
      setNewLevel(currentLevel);
      setShowLevelUp(true);
    }
    setPreviousLevel(currentLevel);
  }, [currentLevel, previousLevel]);

  const closeLevelUp = () => setShowLevelUp(false);

  return { showLevelUp, newLevel, closeLevelUp };
};
