import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Backpack } from 'lucide-react';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { clearSessionData } from '../../lib/sessionCleanup';
import { primaryButton, cancelButton } from '../home/homeHelpers';
import { errorMessage } from './authHelpers';

interface StudentSwitchPanelProps {
  onCancel?: () => void;
}

/**
 * "¿Te registraste como docente por error?". Cambia la cuenta a estudiante y lleva a unirse a la
 * clase. Solo se ofrece si el servidor confirma que no hay alumnos reales ni escuela.
 */
export const StudentSwitchPanel = ({ onCancel }: StudentSwitchPanelProps) => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: async () => (await authApi.switchToStudent()).data.data!,
    onSuccess: async (data) => {
      setAuth(data);
      await clearSessionData();
      // Recarga completa: el menú y las rutas son los de un estudiante.
      window.location.replace('/join-class');
    },
    onError: (err) => setError(errorMessage(err, 'No se pudo cambiar la cuenta')),
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white" aria-hidden="true">
          <Backpack size={22} />
        </span>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">¿Te registraste como docente por error?</h2>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            Si eres estudiante, cambiamos tu cuenta ahora. Después podrás unirte a la clase de tu profe con su código.
          </p>
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-300" role="alert">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {onCancel && <button type="button" onClick={onCancel} className={cancelButton}>No, soy docente</button>}
        <button type="button" onClick={() => change.mutate()} disabled={change.isPending} className={primaryButton}>
          {change.isPending ? 'Cambiando…' : 'Sí, soy estudiante'}
        </button>
      </div>
    </div>
  );
};
