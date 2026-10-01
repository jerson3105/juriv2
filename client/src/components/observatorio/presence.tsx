import { Check, Moon } from 'lucide-react';
import type { Student } from '../../lib/classroomApi';
import { studentNames } from '../students/profile/profileHelpers';

interface PresenceEditorProps {
  students: Student[];
  presentIds: Set<string>;
  showCharacterName?: boolean;
  onToggle: (id: string) => void;
  onSetAll: (present: boolean) => void;
  /** stage = sobre el escenario nocturno; page = página normal (claro/oscuro). */
  tone?: 'stage' | 'page';
  label?: string;
}

const TONES = {
  stage: {
    action: 'border-white/30 text-white hover:bg-white/10',
    count: 'text-indigo-100',
    on: 'border-emerald-300/70 bg-emerald-400/15 text-white',
    off: 'border-white/15 bg-white/5 text-indigo-200 line-through',
    boxOn: 'border-emerald-300 bg-emerald-300 text-emerald-950',
    boxOff: 'border-white/40',
    moon: 'text-indigo-100',
  },
  page: {
    action: 'border-gray-300 text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700',
    count: 'text-gray-700 dark:text-gray-200',
    on: 'border-emerald-400 bg-emerald-50 text-gray-900 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-white',
    off: 'border-gray-200 bg-gray-50 text-gray-600 line-through dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
    boxOn: 'border-emerald-600 bg-emerald-600 text-white',
    boxOff: 'border-gray-400 dark:border-gray-500',
    moon: 'text-slate-600 dark:text-slate-300',
  },
};

/** Lista rápida: un toque marca o desmarca. 🌙 = descansando (sin HP). */
export const PresenceEditor = ({ students, presentIds, showCharacterName, onToggle, onSetAll, tone = 'stage', label = 'presentes' }: PresenceEditorProps) => {
  const t = TONES[tone];
  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onSetAll(true)} className={`min-h-[44px] rounded-xl border px-3 text-sm font-bold ${t.action}`}>
          Todos
        </button>
        <button type="button" onClick={() => onSetAll(false)} className={`min-h-[44px] rounded-xl border px-3 text-sm font-bold ${t.action}`}>
          Ninguno
        </button>
        <span className={`text-sm font-semibold ${t.count}`}>{presentIds.size} de {students.length} {label}</span>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label={`Lista de ${label}`}>
        {students.map((student) => {
          const present = presentIds.has(student.id);
          const resting = student.hp <= 0;
          const name = studentNames(student, showCharacterName).primary;
          return (
            <li key={student.id}>
              <button
                type="button"
                onClick={() => onToggle(student.id)}
                aria-pressed={present}
                className={`flex min-h-[44px] w-full items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold transition-colors ${present ? t.on : t.off}`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${present ? t.boxOn : t.boxOff}`} aria-hidden="true">
                  {present && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{name}</span>
                {resting && (
                  <span className={`inline-flex items-center gap-1 text-xs font-bold no-underline ${t.moon}`} title="Descansando: no recibe HP">
                    <Moon size={14} aria-hidden="true" />
                    <span className="sr-only">Descansando</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
