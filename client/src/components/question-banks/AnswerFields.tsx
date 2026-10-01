import { useId } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { inputClass, labelClass } from '../home/homeHelpers';
import type { EditorState } from './bankHelpers';

const LETTERS = 'ABCDEF';
const addButton = 'inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-500/10';
const removeButton = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-red-500/10 dark:hover:text-red-300';

interface AnswerFieldsProps {
  state: EditorState;
  onChange: (patch: Partial<EditorState>) => void;
}

/** Respuestas según el tipo: V/F, opciones (única o múltiple), pares o pasos con un error. */
export const AnswerFields = ({ state, onChange }: AnswerFieldsProps) => {
  const groupId = useId();

  if (state.kind === 'TRUE_FALSE') {
    return (
      <fieldset>
        <legend className={labelClass}>Respuesta correcta</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[true, false].map((value) => (
            <label
              key={String(value)}
              className={`flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 text-sm font-bold ${
                state.correctAnswer === value
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-100'
                  : 'border-gray-300 text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <input type="radio" name={`${groupId}-tf`} className="sr-only" checked={state.correctAnswer === value} onChange={() => onChange({ correctAnswer: value })} />
              {value ? 'Verdadero' : 'Falso'}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (state.kind === 'MATCHING') {
    const update = (index: number, side: 'left' | 'right', text: string) =>
      onChange({ pairs: state.pairs.map((p, i) => (i === index ? { ...p, [side]: text } : p)) });
    return (
      <fieldset>
        <legend className={labelClass}>Pares para unir</legend>
        <ul className="mt-2 space-y-2">
          {state.pairs.map((pair, i) => (
            <li key={i} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-2 dark:border-gray-700 sm:flex-row sm:items-center">
              <input aria-label={`Par ${i + 1}, izquierda`} value={pair.left} onChange={(e) => update(i, 'left', e.target.value)} placeholder="Izquierda" className={inputClass} />
              <span className="hidden text-gray-600 dark:text-gray-300 sm:inline" aria-hidden="true">↔</span>
              <input aria-label={`Par ${i + 1}, derecha`} value={pair.right} onChange={(e) => update(i, 'right', e.target.value)} placeholder="Derecha" className={inputClass} />
              <button type="button" onClick={() => onChange({ pairs: state.pairs.filter((_, j) => j !== i) })} disabled={state.pairs.length <= 2} aria-label={`Quitar el par ${i + 1}`} className={removeButton}>
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {state.pairs.length < 8 && (
          <button type="button" onClick={() => onChange({ pairs: [...state.pairs, { left: '', right: '' }] })} className={`${addButton} mt-1`}>
            <Plus size={16} aria-hidden="true" /> Agregar par
          </button>
        )}
      </fieldset>
    );
  }

  const isError = state.kind === 'ERROR';
  const multiple = state.kind === 'MULTIPLE_CHOICE';
  const max = isError ? 4 : 6;
  const setCorrect = (index: number) =>
    onChange({ options: state.options.map((o, i) => ({ ...o, isCorrect: multiple ? (i === index ? !o.isCorrect : o.isCorrect) : i === index })) });
  const setText = (index: number, text: string) => onChange({ options: state.options.map((o, i) => (i === index ? { ...o, text } : o)) });

  return (
    <fieldset>
      <legend className={labelClass}>
        {isError ? 'Pasos de la solución de Jiro (marca el que tiene el error)' : multiple ? 'Opciones (marca todas las correctas)' : 'Opciones (marca la correcta)'}
      </legend>
      <ul className="mt-2 space-y-2">
        {state.options.map((option, i) => {
          const label = isError ? `Paso ${i + 1}` : `Opción ${LETTERS[i] ?? i + 1}`;
          return (
            <li key={i} className="flex items-center gap-2">
              <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <input
                  type={multiple ? 'checkbox' : 'radio'}
                  name={`${groupId}-correct`}
                  checked={option.isCorrect}
                  onChange={() => setCorrect(i)}
                  className={`h-5 w-5 ${isError ? 'accent-rose-600' : 'accent-emerald-600'}`}
                  aria-label={isError ? `${label}: aquí está el error` : `${label}: correcta`}
                />
              </label>
              <input
                aria-label={label}
                value={option.text}
                onChange={(e) => setText(i, e.target.value)}
                placeholder={label}
                className={`${inputClass} ${option.isCorrect ? (isError ? 'border-rose-400 dark:border-rose-400' : 'border-emerald-500 dark:border-emerald-400') : ''}`}
              />
              <button type="button" onClick={() => onChange({ options: state.options.filter((_, j) => j !== i) })} disabled={state.options.length <= 2} aria-label={`Quitar ${label.toLowerCase()}`} className={removeButton}>
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      {state.options.length < max && (
        <button type="button" onClick={() => onChange({ options: [...state.options, { text: '', isCorrect: false }] })} className={`${addButton} mt-1`}>
          <Plus size={16} aria-hidden="true" /> {isError ? 'Agregar paso' : 'Agregar opción'}
        </button>
      )}
    </fieldset>
  );
};
