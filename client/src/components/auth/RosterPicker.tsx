import { useId, useMemo, useState } from 'react';
import { ChevronRight, IdCard, KeyRound, Mail, Search, Sparkles } from 'lucide-react';
import type { ClassRoster } from '../../lib/api';
import { liftable } from './authHelpers';

type RosterStudent = ClassRoster['students'][number];

const STATE_HINT: Record<RosterStudent['state'], { text: string; icon: typeof KeyRound }> = {
  pin: { text: 'Entra con tu PIN', icon: KeyRound },
  new: { text: 'Primera vez', icon: Sparkles },
  account: { text: 'Entra con tu correo', icon: Mail },
  card: { text: 'Primera vez: con tu tarjeta', icon: IdCard },
};

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Lista de la clase para que el alumno toque su nombre. Con muchos nombres aparece un buscador. */
export const RosterPicker = ({ students, onPick }: { students: RosterStudent[]; onPick: (student: RosterStudent) => void }) => {
  const id = useId();
  const [query, setQuery] = useState('');
  const visible = useMemo(
    () => (query.trim() ? students.filter((s) => fold(s.name).includes(fold(query.trim()))) : students),
    [students, query],
  );

  return (
    <div>
      {students.length > 10 && (
        <div className="relative mb-3">
          <label htmlFor={`${id}-q`} className="sr-only">Busca tu nombre</label>
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" aria-hidden="true" />
          <input
            id={`${id}-q`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribe tu nombre"
            autoComplete="off"
            className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3 text-base text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-400"
          />
        </div>
      )}
      <ul className="grid max-h-[50vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2" aria-label="Estudiantes de la clase">
        {visible.map((student) => {
          const hint = STATE_HINT[student.state];
          const Icon = hint.icon;
          return (
            <li key={student.id}>
              <button
                type="button"
                onClick={() => onPick(student)}
                className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2 text-left hover:border-primary-500 hover:bg-primary-50 dark:border-gray-600 dark:bg-gray-900 dark:hover:border-primary-400 dark:hover:bg-primary-500/10 ${liftable}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-gray-900 dark:text-white">{student.name}</span>
                  <span className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
                    <Icon size={12} aria-hidden="true" /> {hint.text}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-gray-600 dark:text-gray-300" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      {visible.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-700 dark:text-gray-300" role="status">No hay nadie con ese nombre en la lista.</p>
      )}
    </div>
  );
};
