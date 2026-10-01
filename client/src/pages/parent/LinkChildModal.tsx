import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { parentApi } from '../../lib/parentApi';
import { HomeModal } from '../../components/home/HomeModal';
import { cancelButton, primaryButton } from '../../components/home/homeHelpers';
import { errorMessage, normalizeJoinCode } from '../../components/auth/authHelpers';

interface LinkChildModalProps {
  onClose: () => void;
}

/**
 * La familia pide ver el progreso de su hijo o hija con el código familiar (distinto del código de
 * la clase). El docente confirma la solicitud antes de que vea nada.
 */
export default function LinkChildModal({ onClose }: LinkChildModalProps) {
  const ids = useId();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const link = useMutation({
    mutationFn: () => parentApi.linkChild(code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['parent-children'] });
      void queryClient.invalidateQueries({ queryKey: ['parent-pending-links'] });
      toast.success('Solicitud enviada. El docente la confirmará pronto.');
      onClose();
    },
    onError: (err) => setError(errorMessage(err, 'Ese código no existe o ya se usó. Pide uno nuevo al docente.')),
  });

  return (
    <HomeModal
      title="Vincular a tu hijo o hija"
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
          <button type="button" onClick={() => link.mutate()} disabled={link.isPending || code.length < 6} className={primaryButton}>
            {link.isPending ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </>
      )}
    >
      <form onSubmit={(e) => { e.preventDefault(); if (code.length >= 6) link.mutate(); }}>
        <p className="text-sm text-gray-800 dark:text-gray-100">
          Pide al docente el <strong>código familiar</strong> de tu hijo o hija. Es distinto del código de la clase.
        </p>
        <label htmlFor={`${ids}-code`} className="mt-4 block text-sm font-semibold text-gray-800 dark:text-gray-100">Código familiar</label>
        <input
          id={`${ids}-code`}
          data-autofocus
          value={code}
          onChange={(e) => { setCode(normalizeJoinCode(e.target.value)); setError(null); }}
          placeholder="Ej.: ABC12345"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${ids}-error` : undefined}
          className="mt-1 min-h-[52px] w-full rounded-xl border border-gray-300 bg-white px-4 text-center font-mono text-2xl font-bold tracking-[0.2em] text-gray-900 outline-none placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-400"
        />
        {error && <p id={`${ids}-error`} role="alert" className="mt-2 text-sm font-medium text-red-700 dark:text-red-300">{error}</p>}
        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">El docente confirmará que eres su familia antes de que veas su progreso.</p>
      </form>
    </HomeModal>
  );
}
