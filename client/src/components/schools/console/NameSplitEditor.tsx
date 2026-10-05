import { ArrowLeftRight } from 'lucide-react';
import type { NameSplit } from '../../../lib/schoolRosterBuilderApi';

interface NameSplitEditorProps {
  value: NameSplit;
  onChange: (value: NameSplit) => void;
  /** Nombre accesible del editor (p. ej. «Nombre de la persona A»). */
  label: string;
  disabled?: boolean;
}

/**
 * Apellidos ┃ Nombres en fichas de palabras: tocar el espacio entre dos palabras mueve la división; ⇄ invierte qué lado
 * son los apellidos. Las palabras no se reescriben aquí (eso es «Editar datos» en la ficha).
 */
export const NameSplitEditor = ({ value, onChange, label, disabled = false }: NameSplitEditorProps) => {
  const words = [...value.lastNames, ...value.firstNames];
  const split = value.lastNames.length;
  const moveTo = (index: number) => onChange({ lastNames: words.slice(0, index), firstNames: words.slice(index) });
  const invert = () => onChange({ lastNames: value.firstNames, firstNames: value.lastNames });

  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-start gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {words.map((word, index) => (
          <span key={`${index}-${word}`} className="flex items-center gap-1">
            {index > 0 && (
              index === split ? (
                <span className="flex flex-col items-center px-0.5" aria-hidden="true">
                  <span className="h-7 w-0.5 rounded-full bg-primary-600 dark:bg-primary-300" />
                </span>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => moveTo(index)}
                  aria-label={`Dividir antes de «${word}»`}
                  className="pg-focus h-7 w-3 rounded hover:bg-primary-100 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-primary-500/20"
                />
              )
            )}
            <span
              className={`rounded-lg px-2 py-1 text-sm font-semibold ${index < split
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                : 'bg-primary-50 text-primary-900 dark:bg-primary-500/20 dark:text-primary-100'}`}
            >
              {word}
            </span>
          </span>
        ))}
        {split === 0 && words.length > 0 && <span className="text-xs text-amber-800 dark:text-amber-200">(sin apellidos)</span>}
      </div>
      <button type="button" className="pg-icon-btn pg-focus" onClick={invert} disabled={disabled || words.length < 2} aria-label="Invertir apellidos y nombres" title="Invertir apellidos y nombres">
        <ArrowLeftRight size={16} aria-hidden="true" />
      </button>
      <p className="w-full text-xs text-gray-600 dark:text-gray-300">
        <span className="font-semibold text-slate-800 dark:text-slate-200">Apellidos:</span> {value.lastNames.join(' ') || '—'}
        {' · '}
        <span className="font-semibold text-primary-800 dark:text-primary-200">Nombres:</span> {value.firstNames.join(' ') || '—'}
      </p>
    </div>
  );
};
