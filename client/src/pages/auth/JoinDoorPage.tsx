import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Lock, Mail, School, User } from 'lucide-react';
import { AuthShell } from '../../components/auth/AuthShell';
import { GoogleButton, OrDivider } from '../../components/auth/GoogleButton';
import { PasswordRules } from '../../components/auth/PasswordRules';
import { Input } from '../../components/ui/Input';
import {
  errorMessage, isPasswordValid, normalizeJoinCode, setPendingJoinCode,
} from '../../components/auth/authHelpers';
import { primaryButton, cancelButton } from '../../components/home/homeHelpers';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

type Verified = (
  | { type: 'classroom'; classroomName: string; teacherName: string | null; open: boolean }
  | { type: 'student'; studentName: string | null; classroomName: string | null; alreadyLinked: boolean }
) & { teacherVerified?: boolean; message?: string };
type Step = 'code' | 'confirm' | 'notme' | 'access';

/**
 * Puerta del alumno (/unirse o /unirse/:code). Nunca muestra la opción de docente: el código dice a
 * qué clase entra, confirma quién es y crea el acceso como estudiante. El personaje se elige después.
 */
export const JoinDoorPage = () => {
  const navigate = useNavigate();
  const ids = useId();
  const params = useParams<{ code?: string }>();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, register, setAuth } = useAuthStore();

  const [code, setCode] = useState(() => normalizeJoinCode(params.code ?? searchParams.get('code') ?? ''));
  const [step, setStep] = useState<Step>('code');
  const [verified, setVerified] = useState<Verified | null>(null);
  const [checking, setChecking] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Acceso con correo
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [avatarGender, setAvatarGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  // Un alumno que YA tenía sesión al abrir la página no necesita crear acceso: termina de unirse.
  // (Solo al abrir: tras crear el acceso aquí, la navegación la decide createAccess.)
  const [startedAsStudent] = useState(() => isAuthenticated && user?.role === 'STUDENT');
  useEffect(() => {
    if (startedAsStudent) navigate(`/join-class${code ? `?code=${code}` : ''}`, { replace: true });
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verify = async (value = code) => {
    if (value.length < 6 || checking) return;
    setChecking(true);
    setCodeError(null);
    try {
      const response = await authApi.verifyJoinCode(value);
      const data = response.data.data as Verified;
      if (data.teacherVerified === false) {
        setCodeError(data.message ?? 'Tu profe aún está verificando su cuenta de docente. Avísale para que la verifique.');
      } else if (data.type === 'classroom' && !data.open) {
        setCodeError('Esta clase no está recibiendo estudiantes ahora. Avísale a tu profe.');
      } else if (data.type === 'student' && data.alreadyLinked) {
        setCodeError('Este código ya se usó. Si es tuyo, entra con tu cuenta o pídele a tu profe uno nuevo.');
      } else {
        setVerified(data);
        setStep('confirm');
      }
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setCodeError(status === 429
        ? 'Demasiados intentos. Espera unos minutos y vuelve a probar.'
        : 'No encontramos ese código. Revísalo letra por letra con tu profe.');
    } finally {
      setChecking(false);
    }
  };

  // Llegó con el código en el enlace o el QR: se revisa solo.
  useEffect(() => {
    if (code.length >= 6 && !isAuthenticated) void verify(code);
    // Solo al abrir la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPersonal = verified?.type === 'student';
  const problems = {
    firstName: !isPersonal && firstName.trim().length < 2 ? 'Escribe tu nombre' : undefined,
    lastName: !isPersonal && lastName.trim().length < 2 ? 'Escribe tu apellido' : undefined,
    email: /^\S+@\S+\.\S+$/.test(email.trim()) ? undefined : 'Escribe un correo válido',
    password: isPasswordValid(password) ? undefined : 'La clave no cumple los requisitos',
    confirm: confirm && confirm === password ? undefined : 'Las claves no coinciden',
  };
  const show = (key: keyof typeof problems) => (touched ? problems[key] : undefined);

  const createAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.values(problems).some(Boolean)) return;
    setBusy(true);
    setAccessError(null);
    try {
      if (isPersonal) {
        // Su perfil ya existe en la lista del docente: la cuenta se vincula a él directamente.
        const response = await authApi.registerStudentWithCode({ code, email: email.trim(), password, avatarGender });
        setAuth(response.data.data!);
        navigate('/dashboard');
      } else {
        await register({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, role: 'STUDENT' });
        navigate(`/join-class?code=${code}`);
      }
    } catch (error) {
      setAccessError(errorMessage(error, 'No se pudo crear tu acceso'));
    } finally {
      setBusy(false);
    }
  };

  // ==================== Paso 1: código ====================
  if (step === 'code') {
    return (
      <AuthShell
        title="Escribe tu código"
        subtitle="Tu profe te lo da en la pizarra o en tu tarjeta. Tiene letras y números."
        back={{ to: '/login', label: 'Volver' }}
        footer={(
          <p>
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" onClick={() => code.length >= 6 && setPendingJoinCode(code)} className="inline-flex min-h-[44px] items-center font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300">
              Entra con ella
            </Link>
          </p>
        )}
      >
        <form onSubmit={(e) => { e.preventDefault(); void verify(); }} className="space-y-4" noValidate>
          <div>
            <label htmlFor={`${ids}-code`} className="mb-1 block text-sm font-semibold text-gray-800 dark:text-gray-100">Código</label>
            <input
              id={`${ids}-code`}
              value={code}
              onChange={(e) => { setCode(normalizeJoinCode(e.target.value)); setCodeError(null); }}
              placeholder="Ej.: K7M2QX9P"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              inputMode="text"
              autoFocus
              aria-invalid={codeError ? true : undefined}
              aria-describedby={codeError ? `${ids}-code-error` : `${ids}-code-help`}
              className="min-h-[56px] w-full rounded-xl border border-gray-300 bg-white px-4 text-center font-mono text-2xl font-bold tracking-[0.2em] text-gray-900 outline-none placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-400"
            />
            {codeError ? (
              <p id={`${ids}-code-error`} role="alert" className="mt-2 text-sm font-medium text-red-700 dark:text-red-300">{codeError}</p>
            ) : (
              <p id={`${ids}-code-help`} className="mt-2 text-sm text-gray-700 dark:text-gray-300">Puede ser el código de tu clase o tu código personal.</p>
            )}
          </div>
          <button type="submit" disabled={code.length < 6 || checking} className={`${primaryButton} w-full`}>
            {checking ? 'Revisando…' : 'Seguir'}
          </button>
        </form>
      </AuthShell>
    );
  }

  // ==================== "No soy yo" ====================
  if (step === 'notme') {
    return (
      <AuthShell title="Esta tarjeta no es tuya" back={{ to: '/unirse', label: 'Escribir otro código' }}>
        <p className="text-gray-800 dark:text-gray-100">Devuélvele esta tarjeta a tu profe y pídele la tuya.</p>
        <button type="button" onClick={() => { setStep('code'); setCode(''); setVerified(null); }} className={`${primaryButton} mt-6 w-full`}>Escribir otro código</button>
      </AuthShell>
    );
  }

  // ==================== Paso 2: confirmar ====================
  if (step === 'confirm' && verified) {
    const goBack = () => { setStep('code'); setVerified(null); };
    return verified.type === 'student' ? (
      <AuthShell title="¿Eres tú?">
        <div className="rounded-xl bg-gray-50 p-4 text-center dark:bg-gray-900/40">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{verified.studentName ?? 'Estudiante'}</p>
          {verified.classroomName && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{verified.classroomName}</p>}
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setStep('notme')} className={cancelButton}>No soy yo</button>
          <button type="button" onClick={() => setStep('access')} className={primaryButton}>Sí, soy yo</button>
        </div>
      </AuthShell>
    ) : (
      <AuthShell title="Vas a unirte a tu clase">
        <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white" aria-hidden="true"><School size={22} /></span>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 dark:text-white">{verified.classroomName}</p>
            {verified.teacherName && <p className="text-sm text-gray-700 dark:text-gray-300">Docente: {verified.teacherName}</p>}
          </div>
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={goBack} className={cancelButton}>No es mi clase</button>
          <button type="button" onClick={() => setStep('access')} className={primaryButton}>Seguir</button>
        </div>
      </AuthShell>
    );
  }

  // ==================== Paso 3: crear el acceso ====================
  return (
    <AuthShell
      title="¿Cómo quieres entrar la próxima vez?"
      subtitle={verified?.classroomName ? `Clase: ${verified.classroomName}` : undefined}
      back={{ to: '/unirse', label: 'Volver' }}
    >
      <div onClickCapture={() => setPendingJoinCode(code)}>
        <GoogleButton role="STUDENT" label="Con Google (Gmail o correo del colegio)" />
      </div>
      <OrDivider text="o con tu correo y una clave" />
      <form onSubmit={createAccess} className="space-y-4" noValidate>
        {!isPersonal && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Tu nombre" name="firstName" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} leftIcon={<User size={18} />} error={show('firstName')} required />
            <Input label="Tu apellido" name="lastName" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} error={show('lastName')} required />
          </div>
        )}
        <Input label="Correo" type="email" name="email" autoComplete="email" inputMode="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} leftIcon={<Mail size={18} />} error={show('email')} required />
        <div>
          <Input label="Inventa una clave" type="password" name="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} leftIcon={<Lock size={18} />} error={show('password')} aria-describedby={`${ids}-rules`} required />
          <PasswordRules id={`${ids}-rules`} password={password} />
        </div>
        <Input label="Repite la clave" type="password" name="confirmPassword" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} leftIcon={<Lock size={18} />} error={show('confirm')} required />
        {isPersonal && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">Tu avatar</legend>
            <div className="grid grid-cols-2 gap-2">
              {([['MALE', 'Chico'], ['FEMALE', 'Chica']] as const).map(([value, label]) => (
                <label key={value} className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border-2 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500 ${avatarGender === value ? 'border-primary-600 bg-primary-50 text-primary-900 dark:border-primary-400 dark:bg-primary-500/15 dark:text-white' : 'border-gray-300 text-gray-800 dark:border-gray-600 dark:text-gray-100'}`}>
                  <input type="radio" name={`${ids}-gender`} value={value} checked={avatarGender === value} onChange={() => setAvatarGender(value)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <p className="text-sm text-gray-700 dark:text-gray-300">No compartas tu clave con nadie, ni con tus amigos.</p>
        {accessError && <p className="text-sm font-medium text-red-700 dark:text-red-300" role="alert">{accessError}</p>}
        <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
          {busy ? 'Creando tu acceso…' : 'Crear mi acceso'}
        </button>
      </form>
    </AuthShell>
  );
};
