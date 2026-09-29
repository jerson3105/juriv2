import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronUp, Medal, Minus, Plus, Swords, X } from 'lucide-react';

type CharacterClassOption = { id?: string; name: string; icon?: string | null; isActive?: boolean };

interface SelectionActionBarProps {
  count: number;
  allowNegative: boolean;
  characterClasses: CharacterClassOption[];
  onGive: () => void;
  onRemove: () => void;
  onBadge: () => void;
  onAssignClass: (characterClassId: string | null) => void;
  onClear: () => void;
}

const actionClass =
  'inline-flex items-center gap-1.5 min-h-[44px] px-3 sm:px-4 rounded-xl text-sm font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500';

// Barra fija al pie que aparece al seleccionar alumnos: las acciones masivas quedan siempre a la
// vista aunque la selección se haga al final de una lista larga.
export const SelectionActionBar = ({
  count,
  allowNegative,
  characterClasses,
  onGive,
  onRemove,
  onBadge,
  onAssignClass,
  onClear,
}: SelectionActionBarProps) => {
  const [showClassMenu, setShowClassMenu] = useState(false);

  const assignClass = (characterClassId: string | null) => {
    setShowClassMenu(false);
    onAssignClass(characterClassId);
  };

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed bottom-4 inset-x-3 z-40 flex justify-center pointer-events-none"
          role="region"
          aria-label="Acciones para los estudiantes seleccionados"
        >
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur px-3 py-2 shadow-xl">
            <span className="inline-flex items-center gap-2 pl-1 pr-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
              <span className="inline-flex min-w-[28px] h-7 items-center justify-center rounded-full bg-primary-600 px-2 text-white">
                {count}
              </span>
              seleccionado{count !== 1 ? 's' : ''}
            </span>

            <button type="button" onClick={onGive} className={`${actionClass} bg-emerald-700 hover:bg-emerald-800`}>
              <Plus size={16} aria-hidden="true" />
              Dar puntos
            </button>
            {allowNegative && (
              <button type="button" onClick={onRemove} className={`${actionClass} bg-red-600 hover:bg-red-700`}>
                <Minus size={16} aria-hidden="true" />
                Quitar
              </button>
            )}
            <button type="button" onClick={onBadge} className={`${actionClass} bg-amber-700 hover:bg-amber-800`}>
              <Medal size={16} aria-hidden="true" />
              Insignia
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowClassMenu((open) => !open)}
                aria-expanded={showClassMenu}
                aria-haspopup="menu"
                className={`${actionClass} bg-violet-600 hover:bg-violet-700`}
              >
                <Swords size={16} aria-hidden="true" />
                Clase
                <ChevronUp size={14} aria-hidden="true" />
              </button>
              {showClassMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowClassMenu(false)} />
                  <div
                    role="menu"
                    className="absolute bottom-full mb-2 right-0 z-50 w-52 max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-xl"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => assignClass(null)}
                      className="w-full min-h-[40px] text-left px-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <X size={14} aria-hidden="true" />
                      Sin clase
                    </button>
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                    {characterClasses
                      .filter((characterClass) => characterClass.isActive !== false && characterClass.id)
                      .map((characterClass) => (
                        <button
                          key={characterClass.id}
                          type="button"
                          role="menuitem"
                          onClick={() => assignClass(characterClass.id!)}
                          className="w-full min-h-[40px] text-left px-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span aria-hidden="true">{characterClass.icon}</span>
                          {characterClass.name}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={onClear}
              aria-label="Quitar selección"
              title="Quitar selección"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
