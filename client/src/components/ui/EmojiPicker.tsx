import { useState } from 'react';

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
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-12 h-9 flex items-center justify-center border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg text-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer"
      >
        {value || '🎭'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 p-2 max-h-60 overflow-y-auto">
            {EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.label} className="mb-2">
                <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1 mb-1">
                  {cat.label}
                </div>
                <div className="grid grid-cols-10 gap-0.5">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => { onChange(emoji); setOpen(false); }}
                      className={`w-6 h-6 flex items-center justify-center rounded text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors ${
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
        </>
      )}
    </div>
  );
}
