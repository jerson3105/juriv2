import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { KeyRound, Lock, Mail, School, User } from 'lucide-react';
import { AuthShell } from '../../components/auth/AuthShell';
import { GoogleButton, OrDivider } from '../../components/auth/GoogleButton';
import { PasswordRules } from '../../components/auth/PasswordRules';
import { PinInput } from '../../components/auth/PinInput';
import { RosterPicker } from '../../components/auth/RosterPicker';
import { Input } from '../../components/ui/Input';
import {
  errorMessage, isPasswordValid, isWeakPin, normalizeJoinCode, setPendingJoinCode, pressable } from '../../components/auth/authHelpers';
import { primaryButton, cancelButton } from '../../components/home/homeHelpers';
import { authApi } from '../../lib/api';
import type { ClassRoster, PinAuthData } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

type Verified = (
  | { type: 'classroom'; classroomName: string; teacherName: string | null; open: boolean }
  | { type: 'student'; studentName: string | null; classroomName: string | null; alreadyLinked: boolean; access?: 'new' | 'pin-reset' }
) & { teacherVerified?: boolean; message?: string };
type RosterStudent = ClassRoster['students'][number];
type Step =
  | 'code' | 'confirm' | 'notme' | 'access' | 'email'
  | 'roster' | 'pick-confirm' | 'pin-login' | 'pin-create' | 'done'
  | 'not-listed' | 'need-card' | 'has-account';

const WEAK_PIN_HINT = 'No uses 1234 ni el mismo número cuatro veces.';

const linkClass = 'inline-flex min-h-[44px] items-center font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300';

/**
 * Puerta del alumno (/unirse o /unirse/:code). Nunca muestra la opción de docente.
 * - Código de clase con lista: toca su nombre y entra con su PIN (o lo crea, si la clase está abierta).
 * - Código personal (tarjeta): confirma quién es y crea su PIN, o su acceso con correo o Google.
 * - Código de clase sin lista: crea su acceso con correo o Google y se une.
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

  // Lista de la clase y PIN
  const [roster, setRoster] = useState<ClassRoster | null>(null);
  const [picked, setPicked] = useState<RosterStudent | null>(null);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinPhase, setPinPhase] = useState<'first' | 'repeat'>('first');
  const [pinError, setPinError] = useState<string | null>(null);
  const [created, setCreated] = useState<PinAuthData | null>(null);

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
  // (Solo al abrir: tras crear el acceso aquí, la navegación la decide cada paso.)
  const [startedAsStudent] = useState(() => isAuthenticated && user?.role === 'STUDENT');
  useEffect(() => {
    if (startedAsStudent) navigate(`/join-class${code ? `?code=${code}` : ''}`, { replace: true });
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetPin = () => { setPin(''); setPinConfirm(''); setPinPhase('first'); setPinError(null); };
  const goTo = (next: Step) => { resetPin(); setAccessError(null); setStep(next); };
  const backToCode = () => { setVerified(null); setRoster(null); setPicked(null); goTo('code'); };

  const verify = async (value = code) => {
    if (value.length < 6 || checking) return;
    setChecking(true);
    setCodeError(null);
    try {
      const response = await authApi.verifyJoinCode(value);
      const data = response.data.data as Verified;
      if (data.teacherVerified === false) {
        setCodeError(data.message ?? 'Tu profe aún está verificando su cuenta de docente. Avísale para que la verifique.');
      } else if (data.type === 'classroom') {
        // Con lista: cada alumno toca su nombre (también para volver a entrar con la clase cerrada).
        const list = (await authApi.classRoster(value)).data.data!;
        if (list.students.length > 0) {
          setVerified(data);
          setRoster(list);
          goTo('roster');
        } else if (!data.open) {
          setCodeError('Esta clase no está recibiendo estudiantes ahora. Avísale a tu profe.');
        } else {
          setVerified(data);
          goTo('confirm');
        }
      } else if (data.alreadyLinked) {
        setCodeError('Este código ya se usó. Si es tuyo, entra con tu cuenta o pídele a tu profe uno nuevo.');
      } else {
        setVerified(data);
        goTo('confirm');
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
  const isPinReset = verified?.type === 'student' && verified.access === 'pin-reset';
  // El acceso se vincula a un perfil que ya está en la lista (tarjeta o nombre tocado): sin pedir nombres.
  const hasProfile = isPersonal || !!picked;
  const problems = {
    firstName: !hasProfile && firstName.trim().length < 2 ? 'Escribe tu nombre' : undefined,
    lastName: !hasProfile && lastName.trim().length < 2 ? 'Escribe tu apellido' : undefined,
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
      if (hasProfile) {
        // Su perfil ya existe en la lista del docente: la cuenta se vincula a él directamente.
        const target = isPersonal ? { code } : { classCode: code, studentId: picked!.id };
        const response = await authApi.registerStudentWithCode({ ...target, email: email.trim(), password, avatarGender });
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

  // ==================== PIN ====================
  const pickStudent = (student: RosterStudent) => {
    setPicked(student);
    if (student.state === 'pin') goTo('pin-login');
    else if (student.state === 'account') goTo('has-account');
    else goTo(roster?.open ? 'pick-confirm' : 'need-card');
  };

  const loginWithPin = async (value = pin) => {
    if (!picked || value.length !== 4 || busy) return;
    setBusy(true);
    setPinError(null);
    try {
      const response = await authApi.loginWithPin({ classCode: code, studentId: picked.id, pin: value });
      setAuth(response.data.data!);
      navigate('/dashboard');
    } catch (error) {
      setPin('');
      setPinError(errorMessage(error, 'No se pudo entrar. Inténtalo otra vez.'));
    } finally {
      setBusy(false);
    }
  };

  const firstPinDone = (value: string) => {
    if (isWeakPin(value)) {
      setPin('');
      setPinError(`Ese PIN es muy fácil de adivinar. ${WEAK_PIN_HINT}`);
      return;
    }
    setPinError(null);
    setPinPhase('repeat');
  };

  const createPin = async (value = pinConfirm) => {
    if (value.length !== 4 || busy) return;
    if (value !== pin) {
      resetPin();
      setPinError('Los PIN no coinciden. Escríbelo de nuevo.');
      return;
    }
    setBusy(true);
    setPinError(null);
    try {
      const response = await authApi.setupPin(isPersonal
        ? { linkCode: code, pin, ...(isPinReset ? {} : { avatarGender }) }
        : { classCode: code, studentId: picked!.id, pin, avatarGender });
      setCreated(response.data.data!);
      setStep('done');
    } catch (error) {
      resetPin();
      setPinError(errorMessage(error, 'No se pudo crear tu PIN. Inténtalo otra vez.'));
    } finally {
      setBusy(false);
    }
  };

  const genderPicker = (
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
  );

  // ==================== Paso 1: código ====================
  if (step === 'code') {
    return (
      <AuthShell
        title="Escribe tu código"
        subtitle="Tu profe te lo da en la pizarra o en tu tarjeta. Tiene letras y números."
        back={{ to: '/login', label: 'Volver' }}
        footer={(
          <p>
            ¿Entras con correo o Google?{' '}
            <Link to="/login" onClick={() => code.length >= 6 && setPendingJoinCode(code)} className={linkClass}>
              Inicia sesión
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
          <button type="submit" disabled={code.length < 6 || checking} className={`${primaryButton} ${pressable} w-full`}>
            {checking ? 'Revisando…' : 'Seguir'}
          </button>
        </form>
      </AuthShell>
    );
  }

  // ==================== Lista de la clase ====================
  if (step === 'roster' && roster) {
    return (
      <AuthShell title="Toca tu nombre" subtitle={`Clase: ${roster.classroomName}`} back={{ onClick: backToCode, label: 'Otro código' }} wide>
        <RosterPicker students={roster.students} onPick={pickStudent} />
        <button type="button" onClick={() => { setPicked(null); goTo('not-listed'); }} className={`${cancelButton} mt-4 w-full`}>No estoy en la lista</button>
      </AuthShell>
    );
  }

  if (step === 'not-listed') {
    // Lista cerrada mientras queden nombres sin reclamar; si todos ya tienen acceso y la clase está
    // abierta, un alumno nuevo puede unirse con su correo o Google.
    const freeJoin = !!roster?.open && !roster.students.some((s) => s.state === 'new');
    return (
      <AuthShell title="Tu nombre no está en la lista">
        {freeJoin ? (
          <p className="text-gray-800 dark:text-gray-100">Puedes unirte con tu correo o con Google. ¿No tienes correo? Pídele a tu profe que te agregue a la lista.</p>
        ) : (
          <p className="text-gray-800 dark:text-gray-100">Pídele a tu profe que te agregue a la lista de la clase o que te dé tu tarjeta con tu código personal.</p>
        )}
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {freeJoin ? (
            <>
              <button type="button" onClick={() => goTo('roster')} className={cancelButton}>Volver a la lista</button>
              <button type="button" onClick={() => goTo('email')} className={`${primaryButton} ${pressable}`}>Crear mi acceso</button>
            </>
          ) : (
            <>
              <button type="button" onClick={backToCode} className={cancelButton}>Tengo mi tarjeta</button>
              <button type="button" onClick={() => goTo('roster')} className={`${primaryButton} ${pressable}`}>Volver a la lista</button>
            </>
          )}
        </div>
      </AuthShell>
    );
  }

  if (step === 'need-card' && picked) {
    return (
      <AuthShell title="Pide tu tarjeta a tu profe">
        <p className="text-gray-800 dark:text-gray-100">
          Es tu primera vez, <strong>{picked.name}</strong>. Ahora la clase no está recibiendo estudiantes: con la tarjeta que te da tu profe puedes crear tu PIN.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => goTo('roster')} className={cancelButton}>No soy yo</button>
          <button type="button" onClick={backToCode} className={`${primaryButton} ${pressable}`}>Escribir mi tarjeta</button>
        </div>
      </AuthShell>
    );
  }

  if (step === 'has-account' && picked) {
    return (
      <AuthShell title={`Hola, ${picked.name}`}>
        <p className="text-gray-800 dark:text-gray-100">Tú entras con tu correo o con Google.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => goTo('roster')} className={cancelButton}>No soy yo</button>
          <Link to="/login" className={`${primaryButton} ${pressable}`}>Ir a iniciar sesión</Link>
        </div>
      </AuthShell>
    );
  }

  if (step === 'pick-confirm' && picked) {
    return (
      <AuthShell title="¿Eres tú?">
        <div className="rounded-xl bg-gray-50 p-4 text-center dark:bg-gray-900/40">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{picked.name}</p>
          {roster && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{roster.classroomName}</p>}
        </div>
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">Elige solo tu nombre: usar el de otra persona no está permitido.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => goTo('roster')} className={cancelButton}>No soy yo</button>
          <button type="button" onClick={() => goTo('access')} className={`${primaryButton} ${pressable}`}>Sí, soy yo</button>
        </div>
      </AuthShell>
    );
  }

  // ==================== Entrar con PIN ====================
  if (step === 'pin-login' && picked) {
    return (
      <AuthShell title={`Hola, ${picked.name}`} subtitle="Escribe tu PIN de 4 números.">
        <form onSubmit={(e) => { e.preventDefault(); void loginWithPin(); }} className="space-y-5" noValidate>
          <PinInput label="Tu PIN" value={pin} onChange={(v) => { setPin(v); setPinError(null); }} onComplete={(v) => void loginWithPin(v)} error={pinError} autoFocus disabled={busy} />
          <button type="submit" disabled={pin.length !== 4 || busy} className={`${primaryButton} ${pressable} w-full`}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-gray-700 dark:text-gray-300">¿Olvidaste tu PIN? Pídele a tu profe que restablezca tu acceso.</p>
        <button type="button" onClick={() => goTo('roster')} className={`${cancelButton} mt-2 w-full`}>No soy {picked.name}</button>
      </AuthShell>
    );
  }

  // ==================== Crear PIN ====================
  if (step === 'pin-create') {
    const name = picked?.name ?? (verified?.type === 'student' ? verified.studentName : null);
    const repeating = pinPhase === 'repeat';
    return (
      <AuthShell
        title={isPinReset ? 'Crea tu PIN nuevo' : 'Crea tu PIN'}
        subtitle={name ? `${name} · 4 números que solo tú sepas` : '4 números que solo tú sepas'}
      >
        <form onSubmit={(e) => { e.preventDefault(); if (repeating) void createPin(); else if (pin.length === 4) firstPinDone(pin); }} className="space-y-5" noValidate>
          {!isPinReset && !repeating && genderPicker}
          {repeating ? (
            <PinInput key="repeat" label="Escríbelo otra vez" value={pinConfirm} onChange={(v) => { setPinConfirm(v); setPinError(null); }} onComplete={(v) => void createPin(v)} error={pinError} autoFocus disabled={busy} />
          ) : (
            <PinInput key="first" label="Tu PIN" value={pin} onChange={(v) => { setPin(v); setPinError(null); }} onComplete={firstPinDone} error={pinError} hint={WEAK_PIN_HINT} autoFocus />
          )}
          <p className="text-center text-sm text-gray-700 dark:text-gray-300">No le digas tu PIN a nadie, ni a tus amigos.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => (repeating ? resetPin() : goTo(isPinReset ? 'confirm' : 'access'))} className={cancelButton}>
              {repeating ? 'Cambiar PIN' : 'Volver'}
            </button>
            <button type="submit" disabled={(repeating ? pinConfirm : pin).length !== 4 || busy} className={`${primaryButton} ${pressable}`}>
              {busy ? 'Guardando…' : repeating ? 'Crear mi PIN' : 'Seguir'}
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  // ==================== Listo: cómo entrar la próxima vez ====================
  if (step === 'done' && created) {
    return (
      <AuthShell title={`¡Listo, ${created.user.firstName}!`} subtitle="Así entras la próxima vez:">
        <ol className="space-y-3">
          <li className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white" aria-hidden="true">1</span>
            <span className="text-gray-800 dark:text-gray-100">
              Escribe el código de tu clase: <strong className="font-mono text-lg tracking-widest text-gray-900 dark:text-white">{created.classroom.code}</strong>
            </span>
          </li>
          <li className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white" aria-hidden="true">2</span>
            <span className="text-gray-800 dark:text-gray-100">Toca tu nombre en la lista</span>
          </li>
          <li className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white" aria-hidden="true">3</span>
            <span className="flex items-center gap-1.5 text-gray-800 dark:text-gray-100"><KeyRound size={16} aria-hidden="true" /> Escribe tu PIN</span>
          </li>
        </ol>
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">También puedes escanear el QR de tu tarjeta. Si olvidas tu PIN, tu profe te ayuda.</p>
        <button type="button" onClick={() => { setAuth(created); navigate('/dashboard'); }} className={`${primaryButton} ${pressable} mt-6 w-full`}>
          Entrar a mi clase
        </button>
      </AuthShell>
    );
  }

  // ==================== "No soy yo" ====================
  if (step === 'notme') {
    return (
      <AuthShell title="Esta tarjeta no es tuya" back={{ onClick: () => { setCode(''); backToCode(); }, label: 'Escribir otro código' }}>
        <p className="text-gray-800 dark:text-gray-100">Devuélvele esta tarjeta a tu profe y pídele la tuya.</p>
        <button type="button" onClick={() => { setCode(''); backToCode(); }} className={`${primaryButton} ${pressable} mt-6 w-full`}>Escribir otro código</button>
      </AuthShell>
    );
  }

  // ==================== Paso 2: confirmar ====================
  if (step === 'confirm' && verified) {
    return verified.type === 'student' ? (
      <AuthShell title="¿Eres tú?">
        <div className="rounded-xl bg-gray-50 p-4 text-center dark:bg-gray-900/40">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{verified.studentName ?? 'Estudiante'}</p>
          {verified.classroomName && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{verified.classroomName}</p>}
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setStep('notme')} className={cancelButton}>No soy yo</button>
          {/* Tras "Restablecer acceso" del docente, la tarjeta solo sirve para crear un PIN nuevo. */}
          <button type="button" onClick={() => goTo(isPinReset ? 'pin-create' : 'access')} className={`${primaryButton} ${pressable}`}>Sí, soy yo</button>
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
          <button type="button" onClick={backToCode} className={cancelButton}>No es mi clase</button>
          <button type="button" onClick={() => goTo('email')} className={`${primaryButton} ${pressable}`}>Seguir</button>
        </div>
      </AuthShell>
    );
  }

  // ==================== Tarjeta o nombre de la lista: elegir cómo entrar ====================
  const backFromAccess = picked ? { onClick: () => goTo('roster'), label: 'Volver a la lista' } : { onClick: backToCode, label: 'Volver' };
  if (step === 'access' && hasProfile) {
    return (
      <AuthShell
        title="¿Cómo quieres entrar la próxima vez?"
        subtitle={verified?.classroomName ? `Clase: ${verified.classroomName}` : undefined}
        back={backFromAccess}
      >
        <button type="button" onClick={() => goTo('pin-create')} className={`${primaryButton} ${pressable} min-h-[56px] w-full text-base`}>
          <KeyRound size={20} aria-hidden="true" /> Con un PIN de 4 números
        </button>
        <p className="mt-2 text-center text-sm text-gray-700 dark:text-gray-300">Sin correo: código de tu clase, tu nombre y tu PIN.</p>
        <OrDivider text="o" />
        <button type="button" onClick={() => goTo('email')} className={`${cancelButton} w-full border border-gray-300 dark:border-gray-600`}>
          <span className="inline-flex items-center gap-2"><Mail size={18} aria-hidden="true" /> Con mi correo o Google</span>
        </button>
      </AuthShell>
    );
  }

  // ==================== Crear el acceso con correo o Google ====================
  return (
    <AuthShell
      title="¿Cómo quieres entrar la próxima vez?"
      subtitle={verified?.classroomName ? `Clase: ${verified.classroomName}` : undefined}
      back={backFromAccess}
    >
      {/* Con Google vuelve a /join-class con este código: si la clase tiene lista, toca su nombre allí. */}
      <div onClickCapture={() => setPendingJoinCode(code)}>
        <GoogleButton role="STUDENT" label="Con Google (Gmail o correo del colegio)" />
      </div>
      <OrDivider text="o con tu correo y una clave" />
      <form onSubmit={createAccess} className="space-y-4" noValidate>
        {!hasProfile && (
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
        {hasProfile && genderPicker}
        <p className="text-sm text-gray-700 dark:text-gray-300">No compartas tu clave con nadie, ni con tus amigos.</p>
        {!hasProfile && (
          <p className="text-sm text-gray-700 dark:text-gray-300">¿No tienes correo? Pídele a tu profe que te agregue a la lista de la clase: así entras con un PIN.</p>
        )}
        {accessError && <p className="text-sm font-medium text-red-700 dark:text-red-300" role="alert">{accessError}</p>}
        <button type="submit" disabled={busy} className={`${primaryButton} ${pressable} w-full`}>
          {busy ? 'Creando tu acceso…' : 'Crear mi acceso'}
        </button>
      </form>
      {hasProfile && (
        <button type="button" onClick={() => goTo('access')} className={`${cancelButton} mt-3 w-full`}>Mejor con un PIN</button>
      )}
    </AuthShell>
  );
};
