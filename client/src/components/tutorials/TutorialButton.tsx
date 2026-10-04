import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { PlayCircle } from 'lucide-react';
import { TutorialModal, TUTORIALS, type TutorialId } from './TutorialModal';

/**
 * Acceso a un tutorial en video. «pill»: junto al título de la página, siempre a mano y sin competir con sus
 * acciones. «link»: en el estado vacío («¿Primera vez?…»), el momento en que más ayuda. Abre el TutorialModal.
 */
export const TutorialButton = ({ id, variant = 'pill' }: { id: TutorialId; variant?: 'pill' | 'link' }) => {
  const [open, setOpen] = useState(false);
  const { minutes } = TUTORIALS[id];
  return (
    <>
      {variant === 'pill' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-primary-50 px-3 text-xs font-bold text-primary-700 ring-1 ring-primary-200 hover:bg-primary-100 dark:bg-primary-900/40 dark:text-primary-200 dark:ring-primary-800 dark:hover:bg-primary-900/60"
        >
          <PlayCircle size={15} aria-hidden="true" />
          Ver tutorial · {minutes} min
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mx-auto mt-2 flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-900/30"
        >
          <PlayCircle size={16} aria-hidden="true" />
          ¿Primera vez? Mira el tutorial de {minutes} {minutes === 1 ? 'minuto' : 'minutos'}
        </button>
      )}
      <AnimatePresence>
        {open && <TutorialModal key={id} id={id} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
};
