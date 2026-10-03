import { AnimatePresence, motion } from 'framer-motion';
import { ChevronUp, Medal, MoreHorizontal, Plus, Swords, X } from 'lucide-react';
import { usePopover } from '../../hooks/usePopover';
import { Popover } from '../ui/Popover';

type CharacterClassOption = { id?: string; name: string; icon?: string | null; isActive?: boolean };

interface SelectionActionBarProps {
  count: number;
  /** false al proyectar o si la clase no usa negativos. */
  canCorrect: boolean;
  characterClasses: CharacterClassOption[];
  onGive: () => void;
  onCorrect: () => void;
  onBadge: () => void;
  onAssignRole: (characterClassId: string | null) => void;
  onClear: () => void;
}

const RoleOptions = ({ options, onPick }: { options: CharacterClassOption[]; onPick: (id: string | null) => void }) => (
  <>
    <p className="pg-menu-label">Rol para la selección</p>
    {options.filter((option) => option.isActive !== false && option.id).map((option) => (
      <button key={option.id} type="button" onClick={() => onPick(option.id!)} className="pg-menu-item">
        <span className="w-5 text-center" aria-hidden="true">{option.icon}</span>
        {option.name}
      </button>
    ))}
    <div className="pg-menu-sep" />
    <button type="button" onClick={() => onPick(null)} className="pg-menu-item pg-fg2">
      <X size={14} aria-hidden="true" /> Sin rol
    </button>
  </>
);

// Barra fija al pie mientras haya alumnos seleccionados: un solo botón relleno («Dar puntos»), el resto
// con contorno; «Corregir» en pizarra. En el celular cabe en una fila (lo demás, en «⋯»).
export const SelectionActionBar = ({ count, canCorrect, characterClasses, onGive, onCorrect, onBadge, onAssignRole, onClear }: SelectionActionBarProps) => {
  const { open: roleOpen, anchorRef: roleAnchor, close: closeRole, toggle: toggleRole } = usePopover();
  const { open: moreOpen, anchorRef: moreAnchor, close: closeMore, toggle: toggleMore } = usePopover();

  const pickRole = (close: (restore?: boolean) => void) => (id: string | null) => {
    close();
    onAssignRole(id);
  };

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center"
          role="region"
          aria-label="Acciones para los estudiantes seleccionados"
        >
          <div className="pg-surface pointer-events-auto flex items-center gap-2 px-2 py-2 shadow-[var(--pg-shadow)] sm:px-3">
            <span className="inline-flex items-center gap-2 pl-1 pr-1 text-sm font-semibold pg-fg">
              <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-primary-600 px-2 text-white">{count}</span>
              <span className="hidden sm:inline">seleccionado{count !== 1 ? 's' : ''}</span>
            </span>

            <button type="button" onClick={onGive} className="pg-btn pg-btn-give" data-filled="true">
              <Plus size={16} aria-hidden="true" />
              Dar puntos
            </button>

            <span className="hidden items-center gap-2 sm:inline-flex">
              {canCorrect && (
                <button type="button" onClick={onCorrect} className="pg-btn pg-btn-fix">Corregir</button>
              )}
              <button type="button" onClick={onBadge} className="pg-btn">
                <Medal size={16} aria-hidden="true" />
                Insignia
              </button>
              <button ref={roleAnchor} type="button" onClick={toggleRole} aria-expanded={roleOpen} aria-haspopup="dialog" className="pg-btn">
                <Swords size={16} aria-hidden="true" />
                Rol
                <ChevronUp size={14} aria-hidden="true" />
              </button>
            </span>
            <Popover open={roleOpen} onClose={closeRole} anchorRef={roleAnchor} label="Rol para la selección" side="top">
              <RoleOptions options={characterClasses} onPick={pickRole(closeRole)} />
            </Popover>

            <button ref={moreAnchor} type="button" onClick={toggleMore} aria-expanded={moreOpen} aria-haspopup="dialog" aria-label="Más acciones para la selección" className="pg-icon-btn sm:hidden">
              <MoreHorizontal size={18} aria-hidden="true" />
            </button>
            <Popover open={moreOpen} onClose={closeMore} anchorRef={moreAnchor} label="Más acciones para la selección" side="top">
              {canCorrect && (
                <button type="button" onClick={() => { closeMore(); onCorrect(); }} className="pg-menu-item pg-fix">Corregir</button>
              )}
              <button type="button" onClick={() => { closeMore(); onBadge(); }} className="pg-menu-item">
                <Medal size={16} aria-hidden="true" /> Insignia
              </button>
              <div className="pg-menu-sep" />
              <RoleOptions options={characterClasses} onPick={pickRole(closeMore)} />
            </Popover>

            <button type="button" onClick={onClear} aria-label="Quitar selección" title="Quitar selección" className="pg-icon-btn">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
