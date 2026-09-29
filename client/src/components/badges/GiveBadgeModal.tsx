import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Gift, Medal, X } from 'lucide-react';
import { RARITY_LABELS, badgeApi, type Badge } from '../../lib/badgeApi';
import { REWARD_PILL_CLASS } from '../../lib/behaviorPoints';
import { useAwardBadge } from '../../hooks/useAwardBadge';
import { BadgeMedallion } from './BadgeMedallion';
import { RARITY_ORDER, RARITY_STYLE, badgeAwardCountsKey, canAwardManually } from './badgeHelpers';

interface GiveBadgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroomId: string;
  selectedStudentIds: string[];
  studentNames: string[];
  onSuccess: (badge: Badge, studentNames: string[]) => void;
}

const QUICK_REASONS = ['Excelente participación', 'Ayudó a un compañero', 'Gran esfuerzo', 'Superó un reto'];

const Content = ({ onClose, classroomId, selectedStudentIds, studentNames, onSuccess }: Omit<GiveBadgeModalProps, 'isOpen'>) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const { award, isAwarding } = useAwardBadge(classroomId);
  const isPresent = useIsPresent();

  const { data: badges = [], isLoading } = useQuery({
    queryKey: ['badges', classroomId],
    queryFn: () => badgeApi.getClassroomBadges(classroomId),
  });
  const { data: counts = [] } = useQuery({
    queryKey: badgeAwardCountsKey(classroomId),
    queryFn: () => badgeApi.getAwardCounts(classroomId),
  });

  // Solo las que se pueden dar a mano; de más rara a más común.
  const available = useMemo(
    () => badges.filter(canAwardManually).sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || a.name.localeCompare(b.name, 'es')),
    [badges],
  );
  const selected = available.find((b) => b.id === selectedId) ?? null;
  const holdersAmongSelected = (badgeId: string) =>
    counts.filter((row) => row.badgeId === badgeId && selectedStudentIds.includes(row.studentProfileId)).length;

  const nameOf = (id: string) => studentNames[selectedStudentIds.indexOf(id)] ?? 'Estudiante';
  const target = selectedStudentIds.length === 1 ? studentNames[0] : `${selectedStudentIds.length} estudiantes`;

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isPresent && !event.defaultPrevented) onClose();
  }, [isPresent, onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const submit = async () => {
    if (!selected) return;
    const result = await award(selected, selectedStudentIds, nameOf, reason.trim() || undefined);
    if (result && result.awarded.length > 0) {
      onSuccess(selected, result.awarded.map((a) => nameOf(a.studentProfileId)));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="give-badge-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="min-w-0">
            <h2 id="give-badge-title" className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
              <Medal size={20} className="text-amber-600 dark:text-amber-300" aria-hidden="true" />
              Dar insignia
            </h2>
            <p className="truncate text-sm text-gray-700 dark:text-gray-300">Para {target}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-gray-600 dark:text-gray-300">Cargando insignias...</p>
          ) : available.length === 0 ? (
            <div className="py-8 text-center">
              <p className="font-semibold text-gray-900 dark:text-white">No hay insignias para dar a mano</p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Créalas en Gamificación → Insignias.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {available.map((badge) => {
                const isSelected = badge.id === selectedId;
                const holders = holdersAmongSelected(badge.id);
                return (
                  <li key={badge.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(isSelected ? null : badge.id)}
                      aria-pressed={isSelected}
                      className={`group flex h-full w-full flex-col items-center rounded-2xl border-2 bg-gradient-to-b to-white p-3 text-center transition-all dark:to-gray-800 ${RARITY_STYLE[badge.rarity].tile} ${
                        isSelected ? 'ring-4 ring-primary-500/60 ring-offset-2 dark:ring-offset-gray-800' : 'hover:-translate-y-0.5 hover:shadow-md'
                      }`}
                    >
                      <BadgeMedallion badge={badge} size="sm" animated={isSelected} />
                      <span className="mt-2 line-clamp-2 text-sm font-bold leading-4 text-gray-900 dark:text-white">{badge.name}</span>
                      <span className={`mt-1 rounded-full px-2 py-0.5 text-xs font-bold ${RARITY_STYLE[badge.rarity].chip}`}>{RARITY_LABELS[badge.rarity]}</span>
                      {holders > 0 && (
                        <span className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                          {selectedStudentIds.length === 1 ? 'Ya la tiene' : `${holders} ya la tienen`}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <AnimatePresence initial={false}>
          {selected && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40"
            >
              <div className="space-y-2 px-5 py-3">
                <p className="flex flex-wrap items-center gap-1.5 text-sm text-gray-800 dark:text-gray-200">
                  <span className="font-bold">{selected.icon} {selected.name}</span>
                  {selected.rewardXp > 0 && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${REWARD_PILL_CLASS.XP}`}>+{selected.rewardXp} XP</span>}
                  {selected.rewardGp > 0 && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${REWARD_PILL_CLASS.GP}`}>+{selected.rewardGp} GP</span>}
                </p>
                <input
                  type="text"
                  maxLength={255}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                  aria-label="Motivo (opcional)"
                  placeholder="Motivo (opcional, lo verá el estudiante)"
                  className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
                />
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REASONS.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => setReason(text)}
                      aria-pressed={reason === text}
                      className={`min-h-[32px] rounded-full border px-3 text-xs font-semibold ${
                        reason === text ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                      }`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!selected || isAwarding}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300"
          >
            <Gift size={16} aria-hidden="true" />
            {isAwarding ? 'Otorgando...' : selected ? `Dar «${selected.name}»` : 'Elige una insignia'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const GiveBadgeModal = ({ isOpen, ...props }: GiveBadgeModalProps) => (
  <AnimatePresence>{isOpen && <Content key="give-badge" {...props} />}</AnimatePresence>
);
