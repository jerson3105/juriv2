import { Check, Moon } from 'lucide-react';
import type { Student } from '../../lib/classroomApi';
import { studentNames } from '../students/profile/profileHelpers';

interface PresenceEditorProps {
  students: Student[];
  presentIds: Set<string>;
  showCharacterName?: boolean;
  onToggle: (id: string) => void;
  onSetAll: (present: boolean) => void;
}

/** Lista rápida sobre el escenario: un toque marca o desmarca. 🌙 = descansando (sin HP). */
export const PresenceEditor = ({ students, presentIds, showCharacterName, onToggle, onSetAll }: PresenceEditorProps) => (
  <div className="w-full">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => onSetAll(true)} className="min-h-[44px] rounded-xl border border-white/30 px-3 text-sm font-bold text-white hover:bg-white/10">
        Todos presentes
      </button>
      <button type="button" onClick={() => onSetAll(false)} className="min-h-[44px] rounded-xl border border-white/30 px-3 text-sm font-bold text-white hover:bg-white/10">
        Ninguno
      </button>
      <span className="text-sm font-semibold text-indigo-100">{presentIds.size} de {students.length} presentes</span>
    </div>
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Presentes hoy">
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
              className={`flex min-h-[44px] w-full items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold transition-colors ${
                present ? 'border-emerald-300/70 bg-emerald-400/15 text-white' : 'border-white/15 bg-white/5 text-indigo-200 line-through'
              }`}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${present ? 'border-emerald-300 bg-emerald-300 text-emerald-950' : 'border-white/40'}`} aria-hidden="true">
                {present && <Check size={14} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1 truncate">{name}</span>
              {resting && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-100 no-underline" title="Descansando: no recibe HP">
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
