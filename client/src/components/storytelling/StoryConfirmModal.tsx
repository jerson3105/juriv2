import { useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, inputClass, primaryButton } from '../home/homeHelpers';

interface StoryConfirmModalProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  // Para lo que no se puede deshacer: hay que escribir este texto para confirmar.
  typeToConfirm?: string;
  busy?: boolean;
  secondary?: { label: string; onClick: () => void };
  onConfirm: () => void;
  onClose: () => void;
}

const dangerButton = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300';

export const StoryConfirmModal = ({ title, children, confirmLabel, tone = 'danger', typeToConfirm, busy, secondary, onConfirm, onClose }: StoryConfirmModalProps) => {
  const [typed, setTyped] = useState('');
  const ok = !typeToConfirm || typed.trim().toLocaleLowerCase('es') === typeToConfirm.trim().toLocaleLowerCase('es');

  return (
    <HomeModal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
          {secondary && (
            <button type="button" onClick={secondary.onClick} disabled={busy} className="min-h-[44px] rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700">
              {secondary.label}
            </button>
          )}
          <button type="button" onClick={onConfirm} disabled={!ok || busy} className={tone === 'danger' ? dangerButton : primaryButton} data-autofocus={typeToConfirm ? undefined : true}>
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-2 text-sm text-gray-800 dark:text-gray-100">{children}</div>
      {typeToConfirm && (
        <div>
          <label htmlFor="story-confirm" className="block text-sm font-semibold text-gray-800 dark:text-gray-100">
            Escribe «{typeToConfirm}» para confirmar
          </label>
          <input id="story-confirm" data-autofocus value={typed} onChange={(e) => setTyped(e.target.value)} className={`${inputClass} mt-1`} autoComplete="off" />
        </div>
      )}
    </HomeModal>
  );
};
