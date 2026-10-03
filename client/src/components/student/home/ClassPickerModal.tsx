import { Link } from 'react-router-dom';
import { Check, Plus, Users } from 'lucide-react';
import { HomeModal } from '../../home/HomeModal';
import { deriveStoryAccent } from '../../../lib/storyTheme';
import type { MyClass } from '../../../hooks/useCurrentStudentProfile';
import { ClassSeal } from '../../layout/sidebar/ClassSeal';

interface ClassPickerModalProps {
  classes: MyClass[];
  currentId: string;
  onPick: (profileId: string) => void;
  onClose: () => void;
}

const row = 'flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/60';

/** «Tus clases» desde el saludo del Inicio (en el celular, sin abrir el menú): la misma lista del menú. */
export const ClassPickerModal = ({ classes, currentId, onPick, onClose }: ClassPickerModalProps) => (
  <HomeModal
    title="Tus clases"
    subtitle="Elige en qué clase quieres estar."
    onClose={onClose}
    footer={(
      <div className="flex w-full flex-wrap justify-between gap-2">
        <Link to="/join-class" onClick={onClose} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/30">
          <Plus size={16} aria-hidden="true" />
          Unirme a otra clase
        </Link>
        <Link to="/my-classes" onClick={onClose} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
          <Users size={16} aria-hidden="true" />
          Ver todas mis clases
        </Link>
      </div>
    )}
  >
    <ul className="space-y-1">
      {classes.map((profile) => {
        const current = profile.id === currentId;
        const name = profile.classroom?.name ?? 'Tu clase';
        return (
          <li key={profile.id}>
            <button
              type="button"
              onClick={() => onPick(profile.id)}
              aria-current={current ? 'true' : undefined}
              data-autofocus={current ? '' : undefined}
              className={`${row} ${current ? 'bg-primary-50 dark:bg-primary-900/30' : ''}`}
            >
              <ClassSeal classroomId={profile.classroomId} name={name} accent={deriveStoryAccent(profile.classroom?.themeConfig ?? null)} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-gray-900 dark:text-white">{name}</span>
                <span className="block text-sm text-gray-700 dark:text-gray-300">
                  Nivel {profile.level}
                  {profile.hp <= 0 && <> · <span aria-hidden="true">🌙</span> Descansando</>}
                </span>
              </span>
              {current && (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 dark:text-primary-300">
                  <Check size={16} aria-hidden="true" />
                  Actual
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  </HomeModal>
);
