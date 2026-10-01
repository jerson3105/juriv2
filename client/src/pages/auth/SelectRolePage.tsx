import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Presentation } from 'lucide-react';
import { AuthShell } from '../../components/auth/AuthShell';
import { RoleDoors } from '../../components/auth/RoleDoors';
import { errorMessage, studentLanding, type SignupRole } from '../../components/auth/authHelpers';
import { primaryButton } from '../../components/home/homeHelpers';
import { secondaryButton } from '../../components/gradebook/gradebookHelpers';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../lib/api';

const getHashParam = (name: string): string | null => {
  const hash = window.location.hash;
  return hash.length > 1 ? new URLSearchParams(hash.slice(1)).get(name) : null;
};

const afterSignup = (role: SignupRole) => (role === 'STUDENT' ? studentLanding().replace(/^\/dashboard$/, '/join-class') : '/dashboard');

/**
 * Cuenta nueva con Google sin puerta elegida. Antes un toque en "Docente" (la primera tarjeta)
 * creaba la cuenta: ahora Estudiante va primero y Docente pide confirmación.
 */
export const SelectRolePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();
  const [code] = useState(() => searchParams.get('code') || getHashParam('code') || undefined);
  const [confirmTeacher, setConfirmTeacher] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // El código es de un solo uso: no se deja en el historial.
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const complete = async (role: SignupRole) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await authApi.completeGoogleRegistration({ role, ...(code ? { code } : {}) });
      if (response.data.success && response.data.data) {
        setAuth(response.data.data);
        navigate(afterSignup(role));
      }
    } catch (err) {
      setError(errorMessage(err, 'No se pudo crear la cuenta. Vuelve a intentarlo desde el inicio de sesión.'));
      setBusy(false);
    }
  };

  if (confirmTeacher) {
    return (
      <AuthShell title="Vas a crear una cuenta de docente">
        <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-800 dark:bg-gray-900/40 dark:text-gray-100">
          <Presentation size={22} className="mt-0.5 shrink-0 text-gray-700 dark:text-gray-200" aria-hidden="true" />
          <p>Con esta cuenta podrás crear clases y dar puntos. <strong>Si eres estudiante, tu cuenta debe ser de estudiante</strong>: con una cuenta de docente no podrás unirte a la clase de tu profe.</p>
        </div>
        {error && <p className="mt-4 text-sm font-medium text-red-700 dark:text-red-300" role="alert">{error}</p>}
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => void complete('STUDENT')} disabled={busy} className={secondaryButton}>Soy estudiante</button>
          <button type="button" onClick={() => void complete('TEACHER')} disabled={busy} className={primaryButton}>Sí, soy docente</button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="¿Cómo vas a usar Juried?" subtitle="Es la primera vez que entras con esta cuenta de Google.">
      <RoleDoors onPick={(role) => (role === 'TEACHER' ? setConfirmTeacher(true) : void complete(role))} disabled={busy} />
      {error && <p className="mt-4 text-sm font-medium text-red-700 dark:text-red-300" role="alert">{error}</p>}
    </AuthShell>
  );
};
