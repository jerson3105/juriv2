import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Gift } from 'lucide-react';
import { type Badge, RARITY_COLORS, RARITY_LABELS } from '../../lib/badgeApi';
import confetti from 'canvas-confetti';

interface BadgeUnlockModalProps {
  badge: Badge | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BadgeUnlockModal = ({ badge, isOpen, onClose }: BadgeUnlockModalProps) => {
  useEffect(() => {
    if (isOpen && badge) {
      // Confetti para insignias épicas y legendarias
      if (badge.rarity === 'EPIC' || badge.rarity === 'LEGENDARY') {
        const duration = badge.rarity === 'LEGENDARY' ? 3000 : 1500;
        const end = Date.now() + duration;

        const frame = () => {
          confetti({
            particleCount: badge.rarity === 'LEGENDARY' ? 5 : 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: badge.rarity === 'LEGENDARY' 
              ? ['#fbbf24', '#f59e0b', '#d97706'] 
              : ['#a855f7', '#8b5cf6', '#7c3aed'],
          });
          confetti({
            particleCount: badge.rarity === 'LEGENDARY' ? 5 : 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: badge.rarity === 'LEGENDARY' 
              ? ['#fbbf24', '#f59e0b', '#d97706'] 
              : ['#a855f7', '#8b5cf6', '#7c3aed'],
          });

          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        };
        frame();
      }
    }
  }, [isOpen, badge]);

  if (!badge) return null;

  const colors = RARITY_COLORS[badge.rarity];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 15 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            {/* Header con gradiente */}
            <div className={`bg-gradient-to-br ${colors.gradient} p-6 text-center relative overflow-hidden`}>
              {/* Partículas decorativas */}
              <div className="absolute inset-0 overflow-hidden">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-white/30 rounded-full"
                    initial={{ 
                      x: Math.random() * 100 + '%', 
                      y: '100%',
                      opacity: 0 
                    }}
                    animate={{ 
                      y: '-20%',
                      opacity: [0, 1, 0],
                    }}
                    transition={{
                      duration: 2 + Math.random() * 2,
                      repeat: Infinity,
                      delay: Math.random() * 2,
                    }}
                  />
                ))}
              </div>
              
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="relative z-10"
              >
                <div className="w-24 h-24 mx-auto bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xl">
                  <span className="text-5xl">{badge.icon}</span>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-4 relative z-10"
              >
                <div className="flex items-center justify-center gap-2 text-white/80 text-sm mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span>¡Nueva Insignia!</span>
                  <Sparkles className="w-4 h-4" />
                </div>
                <h2 className="text-2xl font-bold text-white">{badge.name}</h2>
                <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-full text-sm text-white font-medium">
                  {RARITY_LABELS[badge.rarity]}
                </span>
              </motion.div>
              
              {/* Botón cerrar */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Contenido */}
            <div className="p-6">
              <p className="text-center text-gray-600 dark:text-gray-300 mb-4">
                {badge.description}
              </p>
              
              {/* Recompensas */}
              {(badge.rewardXp > 0 || badge.rewardGp > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl p-4 mb-4"
                >
                  <div className="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400 mb-2">
                    <Gift className="w-5 h-5" />
                    <span className="font-semibold">¡Recompensa!</span>
                  </div>
                  <div className="flex justify-center gap-6">
                    {badge.rewardXp > 0 && (
                      <div className="text-center">
                        <span className="text-2xl font-bold text-emerald-600">+{badge.rewardXp}</span>
                        <p className="text-xs text-gray-500">XP</p>
                      </div>
                    )}
                    {badge.rewardGp > 0 && (
                      <div className="text-center">
                        <span className="text-2xl font-bold text-amber-600">+{badge.rewardGp}</span>
                        <p className="text-xs text-gray-500">GP</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
              
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                onClick={onClose}
                className={`
                  w-full py-3 rounded-xl font-semibold text-white
                  bg-gradient-to-r ${colors.gradient}
                  hover:opacity-90 transition-opacity
                `}
              >
                ¡Genial!
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
