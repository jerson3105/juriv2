import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const EMOJI_CATEGORIES = [
  {
    label: 'RPG / Clases',
    emojis: ['⚔️', '🛡️', '🏹', '🪄', '🗡️', '🔮', '📖', '🎭', '💎', '🧙', '🧝', '🧛', '🧚', '🦸', '🥷', '🤺', '🏰', '👑', '⚡', '🔥'],
  },
  {
    label: 'Naturaleza',
    emojis: ['🌿', '🌊', '🌸', '🍀', '🌙', '☀️', '⭐', '🌈', '🦁', '🐉', '🦅', '🐺', '🦊', '🐻', '🦋', '🌺', '🍃', '❄️', '🌪️', '💧'],
  },
  {
    label: 'Objetos',
    emojis: ['🎯', '🏆', '🎪', '🎨', '🎵', '📜', '🧪', '🔬', '💡', '🕯️', '🗝️', '⚙️', '🧲', '💰', '🎲', '🪙', '📿', '🔔', '🎀', '🧿'],
  },
  {
    label: 'Símbolos',
    emojis: ['❤️', '💜', '💙', '💚', '🧡', '💛', '🤍', '🖤', '♟️', '🃏', '♠️', '♦️', '♣️', '♥️', '✨', '💫', '🌟', '⚜️', '🔱', '☯️'],
  },
];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  triggerClassName?: string;
  ariaLabel?: string;
}

export function EmojiPicker({ value, onChange, triggerClassName, ariaLabel = 'Seleccionar icono' }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0, maxHeight: 240 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const updatePopoverPosition = () => {
    const triggerBounds = triggerRef.current?.getBoundingClientRect();
    if (!triggerBounds) return;

    const popoverWidth = 288;
    const viewportPadding = 12;
    const availableBelow = window.innerHeight - triggerBounds.bottom - viewportPadding;
    const availableAbove = triggerBounds.top - viewportPadding;
    const openUpward = availableBelow < 220 && availableAbove > availableBelow;
    const maxHeight = Math.max(144, Math.min(280, (openUpward ? availableAbove : availableBelow) - 8));

    setPopoverPosition({
      top: openUpward ? Math.max(viewportPadding, triggerBounds.top - maxHeight - 8) : triggerBounds.bottom + 8,
      left: Math.max(viewportPadding, Math.min(triggerBounds.right - popoverWidth, window.innerWidth - popoverWidth - viewportPadding)),
      maxHeight,
    });
  };

  useEffect(() => {
    if (!open) return;

    updatePopoverPosition();
    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [open]);

  const togglePicker = () => {
    if (!open) updatePopoverPosition();
    setOpen((previous) => !previous);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={togglePicker}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={triggerClassName || 'w-12 h-9 flex items-center justify-center border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg text-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer'}
      >
        {value || '🎭'}
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Selector de iconos"
          className="fixed z-[100] w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-800"
          style={{ top: popoverPosition.top, left: popoverPosition.left, maxHeight: popoverPosition.maxHeight }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: popoverPosition.maxHeight - 24 }}>
            {EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.label} className="mb-3 last:mb-0">
                <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {cat.label}
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => { onChange(emoji); setOpen(false); }}
                      className={`flex h-7 w-7 items-center justify-center rounded text-base transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/40 ${
                        value === emoji ? 'bg-indigo-100 dark:bg-indigo-900/40 ring-1 ring-indigo-400' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
