import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Search } from 'lucide-react';

export type ComboboxOption = {
  id: string;
  name: string;
  description?: string | null;
};

interface SingleSelectComboboxProps {
  id: string;
  label: string;
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  emptyOptionLabel: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  openUpward?: boolean;
}

// Selector con búsqueda para competencias y destrezas.
export const SingleSelectCombobox = ({
  id,
  label,
  options,
  value,
  onChange,
  emptyOptionLabel,
  searchPlaceholder,
  noResultsLabel,
  openUpward = false,
}: SingleSelectComboboxProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const comboboxRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedOption = options.find((option) => option.id === value);
  const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();
  const filteredOptions = options.filter((option) =>
    `${option.name} ${option.description || ''}`.toLocaleLowerCase().includes(normalizedSearchTerm),
  );
  const selectedOptionClasses = 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/30';

  useEffect(() => {
    if (!isOpen) return;
    searchInputRef.current?.focus();
    const handleClickOutside = (event: MouseEvent) => {
      if (!comboboxRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  const selectOption = (optionId: string | null) => {
    onChange(optionId);
    close();
  };

  const closeAndRestoreFocus = () => {
    close();
    triggerRef.current?.focus();
  };

  return (
    <div ref={comboboxRef} className="relative">
      <button
        ref={triggerRef}
        id={`${id}-trigger`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-listbox` : undefined}
        aria-label={`${label}: ${selectedOption?.name || emptyOptionLabel}`}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-left transition-colors hover:border-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500"
      >
        <span className={`min-w-0 flex-1 truncate text-sm ${selectedOption ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
          {selectedOption?.name || emptyOptionLabel}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-gray-500 transition-transform dark:text-gray-400 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: openUpward ? 8 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: openUpward ? 8 : -8 }}
            transition={{ duration: 0.15 }}
            className={`absolute left-0 right-0 z-30 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-600 dark:bg-gray-800 ${openUpward ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          >
            <div className="border-b border-gray-100 p-2 dark:border-gray-700">
              <div className="relative">
                <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      closeAndRestoreFocus();
                    }
                  }}
                  aria-label={`Buscar ${label.toLocaleLowerCase()}`}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-500 focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900/50 dark:text-gray-100 dark:placeholder:text-gray-400"
                />
              </div>
            </div>

            <div id={`${id}-listbox`} role="listbox" aria-labelledby={`${id}-trigger`} className="max-h-56 overflow-y-auto p-2">
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => selectOption(null)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${!value ? selectedOptionClasses : 'border-transparent text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'}`}
              >
                {emptyOptionLabel}
              </button>

              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const isSelected = option.id === value;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => selectOption(option.id)}
                      className={`mt-1 w-full rounded-lg border px-3 py-2 text-left transition-colors ${isSelected ? selectedOptionClasses : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      <span className="flex items-start gap-2">
                        <Check size={15} aria-hidden="true" className={`mt-0.5 shrink-0 ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'invisible'}`} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-900 dark:text-white">{option.name}</span>
                          {option.description && (
                            <span className="mt-0.5 block text-xs text-gray-600 dark:text-gray-300">{option.description}</span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="px-3 py-4 text-center text-sm text-gray-600 dark:text-gray-300">{noResultsLabel}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
