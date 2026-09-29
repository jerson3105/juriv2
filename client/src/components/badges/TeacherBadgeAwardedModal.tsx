import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Medal, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { RARITY_LABELS, type Badge } from '../../lib/badgeApi';
import { REWARD_PILL_CLASS } from '../../lib/behaviorPoints';
import { BadgeMedallion } from './BadgeMedallion';
import { RARITY_STYLE } from './badgeHelpers';

interface TeacherBadgeAwardedModalProps {
  badge: Badge | null;
  studentNames: string[];
  isOpen: boolean;
  onClose: () => void;
}

const CONFETTI_COLORS: Record<Badge['rarity'], string[]> = {
  COMMON: ['#94a3b8', '#e2e8f0', '#3b82f6'],
  RARE: ['#38bdf8', '#2563eb', '#bae6fd'],
  EPIC: ['#e879f9', '#7c3aed', '#f0abfc'],
  LEGENDARY: ['#fde047', '#f59e0b', '#fff7ae', '#ea580c'],
};

// Celebración para proyectar cuando uno o varios alumnos reciben una insignia.
export const TeacherBadgeAwardedModal = ({ badge, studentNames, isOpen, onClose }: TeacherBadgeAwardedModalProps) => {
  useEffect(() => {
    if (!isOpen || !badge) return;
    const colors = CONFETTI_COLORS[badge.rarity];
    confetti({ particleCount: badge.rarity === 'LEGENDARY' ? 180 : 110, spread: 80, origin: { y: 0.55 }, colors, disableForReducedMotion: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, badge, onClose]);

  return (
    <AnimatePresence>
      {isOpen && badge && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 220 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="badge-awarded-title"
            className={`relative w-full max-w-md overflow-hidden rounded-3xl border-2 bg-gradient-to-b to-white p-6 text-center shadow-2xl dark:to-gray-900 ${RARITY_STYLE[badge.rarity].tile}`}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-gray-700 hover:bg-black/5 dark:text-gray-200 dark:hover:bg-white/10"
            >
              <X size={20} aria-hidden="true" />
            </button>

            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: 'spring', damping: 11, stiffness: 180 }}
              className="mx-auto mt-2 flex justify-center"
            >
              <BadgeMedallion badge={badge} size="xl" />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <p className="mt-5 text-sm font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">¡Insignia otorgada!</p>
              <h2 id="badge-awarded-title" className="mt-1 text-3xl font-black text-gray-900 dark:text-white">{badge.name}</h2>
              <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-bold ${RARITY_STYLE[badge.rarity].chip}`}>
                {RARITY_LABELS[badge.rarity]}
              </span>
              {badge.description && <p className="mx-auto mt-3 max-w-xs text-sm text-gray-700 dark:text-gray-300">{badge.description}</p>}
            </motion.div>

            <div className="mt-5 rounded-2xl bg-white/80 p-4 text-left dark:bg-gray-800/80">
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                <Medal size={18} className="text-amber-600 dark:text-amber-300" aria-hidden="true" />
                {studentNames.length === 1 ? 'Para' : `Para ${studentNames.length} estudiantes`}
              </p>
              <ul className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {studentNames.map((name, index) => (
                  <motion.li
                    key={`${name}-${index}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.45 + Math.min(index, 15) * 0.05 }}
                    className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-900 dark:bg-gray-700 dark:text-white"
                  >
                    {name}
                  </motion.li>
                ))}
              </ul>
              {(badge.rewardXp > 0 || badge.rewardGp > 0) && (
                <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200">
                  Cada uno recibe
                  {badge.rewardXp > 0 && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${REWARD_PILL_CLASS.XP}`}>+{badge.rewardXp} XP</span>}
                  {badge.rewardGp > 0 && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${REWARD_PILL_CLASS.GP}`}>+{badge.rewardGp} GP</span>}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              autoFocus
              className="mt-5 min-h-[48px] w-full rounded-xl bg-primary-600 text-base font-bold text-white transition-colors hover:bg-primary-700"
            >
              ¡Genial!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
