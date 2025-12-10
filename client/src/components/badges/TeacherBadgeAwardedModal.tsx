import { motion, AnimatePresence } from 'framer-motion';
import { X, Medal, Users } from 'lucide-react';
import { type Badge, RARITY_COLORS, RARITY_LABELS } from '../../lib/badgeApi';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';

interface TeacherBadgeAwardedModalProps {
  badge: Badge | null;
  studentNames: string[];
  isOpen: boolean;
  onClose: () => void;
}

export const TeacherBadgeAwardedModal = ({ 
  badge, 
  studentNames, 
  isOpen, 
  onClose 
}: TeacherBadgeAwardedModalProps) => {
  
  useEffect(() => {
    if (isOpen && badge) {
      // Confetti celebratorio
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#10b981', '#3b82f6'],
      });
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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header con gradiente */}
            <div className={`bg-gradient-to-br ${colors.gradient} p-6 text-center relative`}>
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
              >
                <X size={20} className="text-white" />
              </button>
              
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="w-20 h-20 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-4"
              >
                <span className="text-5xl">{badge.icon}</span>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <p className="text-white/80 text-sm mb-1">🏅 ¡Insignia Desbloqueada!</p>
                <h2 className="text-2xl font-bold text-white">{badge.name}</h2>
                <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-full text-white text-sm">
                  {RARITY_LABELS[badge.rarity]}
                </span>
              </motion.div>
            </div>

            {/* Contenido */}
            <div className="p-6">
              {/* Lista de estudiantes */}
              <div className="bg-amber-50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-amber-600" />
                  <span className="font-semibold text-amber-800">
                    {studentNames.length === 1 
                      ? '¡Estudiante premiado!' 
                      : `¡${studentNames.length} estudiantes premiados!`}
                  </span>
                </div>
                <div className="space-y-1">
                  {studentNames.map((name, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className="flex items-center gap-2 text-amber-700"
                    >
                      <Medal className="w-4 h-4" />
                      <span className="font-medium">{name}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <p className="text-gray-600 text-center text-sm mb-4">
                {badge.description}
              </p>

              {/* Recompensa si tiene */}
              {(badge.rewardXp > 0 || badge.rewardGp > 0) && (
                <div className="bg-green-50 rounded-xl p-3 text-center mb-4">
                  <p className="text-green-700 text-sm font-medium">
                    🎁 Cada estudiante recibió: 
                    {badge.rewardXp > 0 && <span className="ml-1">+{badge.rewardXp} XP</span>}
                    {badge.rewardXp > 0 && badge.rewardGp > 0 && ' y '}
                    {badge.rewardGp > 0 && <span>+{badge.rewardGp} GP</span>}
                  </p>
                </div>
              )}

              {/* Botón cerrar */}
              <button
                onClick={onClose}
                className={`w-full py-3 bg-gradient-to-r ${colors.gradient} text-white font-bold rounded-xl hover:opacity-90 transition-opacity`}
              >
                ¡Genial!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
