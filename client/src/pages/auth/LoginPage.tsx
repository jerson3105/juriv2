import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Backpack, ChevronRight, Lock, Mail } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { AuthShell } from '../../components/auth/AuthShell';
import { GoogleButton, OrDivider } from '../../components/auth/GoogleButton';
import { AUTH_ERROR_MESSAGES, errorMessage } from '../../components/auth/authHelpers';
import { primaryButton } from '../../components/home/homeHelpers';
import { useAuthStore } from '../../store/authStore';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isLoading, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const errorCode = searchParams.get('error');
  const notice = errorCode ? AUTH_ERROR_MESSAGES[errorCode] ?? AUTH_ERROR_MESSAGES.google_auth_failed : null;
  const signedOut = searchParams.get('salida') === '1';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setFormError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      const message = errorMessage(err, 'No se pudo iniciar sesión');
      setFormError(message === 'Credenciales inválidas'
        ? 'El correo o la contraseña no coinciden. ¿Antes entraste con Google? Usa el botón de Google.'
        : message);
    }
  };

  return (
    <AuthShell
      title="Inicia sesión"
      footer={(
        <p>
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="inline-flex min-h-[44px] items-center font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300">
            Crear una cuenta
          </Link>
        </p>
      )}
    >
      {signedOut && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100" role="status">
          <p className="font-semibold">Cerraste sesión.</p>
          <p className="mt-0.5">¿Usas una computadora del colegio y entraste con Google? Cierra también tu cuenta de Google.</p>
        </div>
      )}
      {notice && (
        <p className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100" role="alert">
          {notice}
        </p>
      )}

      {/* Puerta del alumno nuevo: lo primero que ve un niño, sin elegir rol. */}
      <Link
        to="/unirse"
        className="mb-6 flex min-h-[64px] items-center gap-3 rounded-xl border-2 border-primary-600 bg-primary-50 p-3 text-left hover:bg-primary-100 dark:border-primary-400 dark:bg-primary-500/10 dark:hover:bg-primary-500/20"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white" aria-hidden="true">
          <Backpack size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-gray-900 dark:text-white">Soy estudiante y tengo un código</span>
          <span className="block text-sm text-gray-700 dark:text-gray-300">Tu profe te lo da en la pizarra o en tu tarjeta</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-primary-700 dark:text-primary-300" aria-hidden="true" />
      </Link>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input
          label="Correo electrónico"
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setFormError(null); }}
          leftIcon={<Mail size={18} />}
          required
        />
        <Input
          label="Contraseña"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setFormError(null); }}
          leftIcon={<Lock size={18} />}
          required
        />
        {formError && (
          <p className="text-sm font-medium text-red-700 dark:text-red-300" role="alert">{formError}</p>
        )}
        <button type="submit" disabled={isLoading || !email.trim() || !password} className={`${primaryButton} w-full`}>
          {isLoading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <OrDivider />
      <GoogleButton />
    </AuthShell>
  );
};
