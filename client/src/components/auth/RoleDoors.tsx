import { Backpack, ChevronRight, Heart, Presentation } from 'lucide-react';
import { liftable, type SignupRole } from './authHelpers';

const ROLE_DOORS: { role: SignupRole; title: string; text: string; icon: typeof Backpack }[] = [
  { role: 'STUDENT', title: 'Soy estudiante', text: 'Tengo un código de mi profe', icon: Backpack },
  { role: 'TEACHER', title: 'Soy docente', text: 'Quiero crear y dirigir mis clases', icon: Presentation },
  { role: 'PARENT', title: 'Soy familia', text: 'Quiero ver el progreso de mi hijo o hija', icon: Heart },
];

interface RoleDoorsProps {
  onPick: (role: SignupRole) => void;
  disabled?: boolean;
}

/**
 * Puertas de entrada por rol. Estudiante va primero y es la más visible: antes "Docente" era la
 * primera tarjeta, la más grande y con un birrete (que un niño lee como "estudiante").
 */
export const RoleDoors = ({ onPick, disabled }: RoleDoorsProps) => (
  <ul className="space-y-3">
    {ROLE_DOORS.map((door, index) => {
      const primary = index === 0;
      return (
        <li key={door.role}>
          <button
            type="button"
            onClick={() => onPick(door.role)}
            disabled={disabled}
            className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left disabled:opacity-60 ${liftable} ${primary
              ? 'min-h-[72px] border-primary-600 bg-primary-50 hover:bg-primary-100 dark:border-primary-400 dark:bg-primary-500/10 dark:hover:bg-primary-500/20'
              : 'min-h-[64px] border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'}`}
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${primary ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`}
              aria-hidden="true"
            >
              <door.icon size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block font-bold text-gray-900 dark:text-white ${primary ? 'text-lg' : ''}`}>{door.title}</span>
              <span className="block text-sm text-gray-700 dark:text-gray-300">{door.text}</span>
            </span>
            <ChevronRight size={20} className="shrink-0 text-gray-600 dark:text-gray-300" aria-hidden="true" />
          </button>
        </li>
      );
    })}
  </ul>
);
