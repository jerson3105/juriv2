import { useState } from 'react';
import { ChevronDown, Eye, Medal, MoreHorizontal, Pin, Plus } from 'lucide-react';
import type { Behavior } from '../../lib/behaviorApi';
import { usePopover } from '../../hooks/usePopover';
import { Popover } from '../ui/Popover';
import { rewardText } from './studentsHelpers';

/** El botón de cada fila: dice la conducta (no solo «+15 XP»); verde solo para dar. */
export const GiveButton = ({ behavior, studentName, onApply, disabled, count = 0, wrap = false }: {
  behavior: Behavior;
  studentName: string;
  onApply: (behavior: Behavior) => void;
  disabled?: boolean;
  /** En «Pasar por todos»: cuántas veces lo recibió en esta ronda. */
  count?: number;
  /** Celular: el nombre puede ocupar dos líneas (los comportamientos suelen ser largos). */
  wrap?: boolean;
}) => (
  <button
    type="button"
    onClick={() => onApply(behavior)}
    disabled={disabled}
    aria-label={`Dar ${behavior.name} a ${studentName} (${rewardText(behavior)})${count > 0 ? `, ya lo recibió ${count} ${count === 1 ? 'vez' : 'veces'} en esta ronda` : ''}`}
    title={`${behavior.name} · ${rewardText(behavior)}`}
    className={`pg-btn pg-btn-give min-w-0 ${wrap ? 'flex-1 justify-start whitespace-normal py-1 text-left' : 'max-w-[18rem]'}`}
  >
    <Plus size={14} className="flex-shrink-0" aria-hidden="true" />
    <span className={wrap ? 'line-clamp-2 leading-tight' : 'truncate'}>{behavior.name}</span>
    <span className="hidden flex-shrink-0 text-xs font-bold xl:inline" aria-hidden="true">{rewardText(behavior)}</span>
    {count > 0 && <span className="flex-shrink-0 rounded-full bg-black/10 px-1.5 text-xs font-bold dark:bg-white/15" aria-hidden="true">✓{count > 1 ? count : ''}</span>}
  </button>
);

interface BehaviorMenuProps {
  /** more = «⋯» de una fila · clan = «Dar al clan» · fix = «Corregir ▾» de la ficha. */
  mode: 'more' | 'clan' | 'fix';
  /** Quién recibe: «Abril», «Dragones». */
  target: string;
  /** Los más usados de la clase (el mismo conjunto en todas las vistas). */
  positives: Behavior[];
  /** Los más usados para corregir; vacío al proyectar o si la clase no usa negativos. */
  negatives: Behavior[];
  totalPositives: number;
  totalNegatives: number;
  onApply: (behavior: Behavior) => void;
  /** Abre todos los comportamientos (con puntos manuales) para el mismo destino. */
  onOpenAll: (positive: boolean) => void;
  pinnedId?: string | null;
  onPin?: (id: string | null) => void;
  onBadge?: () => void;
  onProfile?: () => void;
  disabled?: boolean;
  align?: 'start' | 'end';
}

/** Menú de puntos compartido por la ficha, las filas y los clanes: positivos primero y «Corregir» plegado. */
export const BehaviorMenu = ({
  mode,
  target,
  positives,
  negatives,
  totalPositives,
  totalNegatives,
  onApply,
  onOpenAll,
  pinnedId,
  onPin,
  onBadge,
  onProfile,
  disabled,
  align = 'end',
}: BehaviorMenuProps) => {
  const { open, anchorRef, close, toggle } = usePopover();
  const [fixOpen, setFixOpen] = useState(mode === 'fix');

  const dismiss = (restoreFocus = false) => {
    close(restoreFocus);
    setFixOpen(mode === 'fix');
  };
  const apply = (behavior: Behavior) => {
    dismiss(true);
    onApply(behavior);
  };
  const leave = (action: () => void) => {
    dismiss(false);
    action();
  };

  const negativeItems = (
    <>
      {negatives.map((behavior) => (
        <button key={behavior.id} type="button" onClick={() => apply(behavior)} disabled={disabled} title={behavior.name} className="pg-menu-item py-1.5">
          <span className="w-5 flex-shrink-0 text-center text-base" aria-hidden="true">{behavior.icon || '•'}</span>
          <span className="line-clamp-2 min-w-0 flex-1 break-words leading-snug">{behavior.name}</span>
          <span className="flex-shrink-0 text-xs font-bold pg-fix">{rewardText(behavior)}</span>
        </button>
      ))}
      <button type="button" onClick={() => leave(() => onOpenAll(false))} className="pg-menu-item pg-fg2">
        {totalNegatives > negatives.length ? `Ver todos para corregir (${totalNegatives})` : 'Más opciones para corregir'}
      </button>
    </>
  );

  return (
    <>
      {mode === 'more' && (
        <button ref={anchorRef} type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog" aria-label={`Más para ${target}`} title="Más" className="pg-icon-btn">
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
      )}
      {mode === 'clan' && (
        <button ref={anchorRef} type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog" disabled={disabled} className="pg-btn pg-btn-give">
          <Plus size={16} aria-hidden="true" />
          Dar al clan
          <span className="sr-only"> {target}</span>
        </button>
      )}
      {mode === 'fix' && (
        <button ref={anchorRef} type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog" className="pg-btn pg-btn-fix">
          Corregir
          <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      )}

      <Popover open={open} onClose={dismiss} anchorRef={anchorRef} label={mode === 'fix' ? `Corregir a ${target}` : `Dar a ${target}`} align={align}>
        {mode === 'fix' ? (
          <>
            <p className="pg-menu-label">Corregir a {target}</p>
            {negativeItems}
          </>
        ) : (
          <>
            <p className="pg-menu-label">Dar a {target}</p>
            {positives.length === 0 && <p className="px-3 py-2 text-sm pg-fg2">La clase aún no tiene comportamientos positivos.</p>}
            {positives.map((behavior) => {
              const pinned = pinnedId === behavior.id;
              return (
                <div key={behavior.id} className="flex items-center gap-1">
                  <button type="button" onClick={() => apply(behavior)} disabled={disabled} title={behavior.name} className="pg-menu-item min-w-0 flex-1 py-1.5">
                    <span className="w-5 flex-shrink-0 text-center text-base" aria-hidden="true">{behavior.icon || '⭐'}</span>
                    <span className="line-clamp-2 min-w-0 flex-1 break-words leading-snug">{behavior.name}</span>
                    <span className="flex-shrink-0 text-xs font-bold pg-pos-ink">{rewardText(behavior)}</span>
                  </button>
                  {onPin && (
                    <button
                      type="button"
                      onClick={() => onPin(pinned ? null : behavior.id)}
                      aria-pressed={pinned}
                      aria-label={pinned ? `${behavior.name} está fijado en el botón de las filas: quitar` : `Fijar ${behavior.name} en el botón de las filas`}
                      title={pinned ? 'Fijado en el botón de las filas' : 'Fijar en el botón de las filas'}
                      className="pg-icon-btn"
                    >
                      <Pin size={16} className={pinned ? 'fill-current' : ''} aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
            <button type="button" onClick={() => leave(() => onOpenAll(true))} className="pg-menu-item pg-fg2">
              {totalPositives > positives.length ? `Ver todos (${totalPositives})` : 'Más opciones'}
            </button>
            {mode === 'more' && negatives.length > 0 && (
              <>
                <div className="pg-menu-sep" />
                <button type="button" onClick={() => setFixOpen((value) => !value)} aria-expanded={fixOpen} className="pg-menu-item pg-fix">
                  Corregir
                  <ChevronDown size={16} className={`ml-auto transition-transform ${fixOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {fixOpen && <div className="pl-3">{negativeItems}</div>}
              </>
            )}
            {mode === 'more' && (onBadge || onProfile) && <div className="pg-menu-sep" />}
            {mode === 'more' && onBadge && (
              <button type="button" onClick={() => leave(onBadge)} className="pg-menu-item">
                <Medal size={16} aria-hidden="true" /> Insignia
              </button>
            )}
            {mode === 'more' && onProfile && (
              <button type="button" onClick={() => leave(onProfile)} className="pg-menu-item">
                <Eye size={16} aria-hidden="true" /> Ver perfil
              </button>
            )}
          </>
        )}
      </Popover>
    </>
  );
};
