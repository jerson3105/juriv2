import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  icon?: LucideIcon;
}

// Menú "Más" con acciones poco frecuentes: Esc o clic fuera lo cierran.
export const ActionMenu = ({ items, label, variant = 'icon' }: { items: ActionMenuItem[]; label: string; variant?: 'icon' | 'button' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); } };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative z-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={variant === 'icon'
          ? 'flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
          : 'inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
        {variant === 'button' && 'Más'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }}
            transition={{ duration: 0.12 }}
            role="menu"
            className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-600 dark:bg-gray-800"
          >
            {items.map((item) => (
              <li key={item.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setOpen(false); item.onClick(); }}
                  className={`flex min-h-[44px] w-full items-center gap-2.5 px-4 text-left text-sm font-semibold ${item.danger ? 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30' : 'text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700'}`}
                >
                  {item.icon && <item.icon size={16} aria-hidden={true} />}
                  {item.label}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};
