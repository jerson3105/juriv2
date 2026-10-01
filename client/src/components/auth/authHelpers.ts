export type SignupRole = 'TEACHER' | 'STUDENT' | 'PARENT';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');

/** Inicio de sesión con Google. Con rol: la cuenta nueva se crea con ese rol (la puerta lo fija). */
export const googleAuthUrl = (role?: SignupRole) =>
  `${API_BASE}/api/auth/google${role ? `?role=${role}` : ''}`;

/** Mensajes para /login?error=<código> (antes los fallos de Google eran silenciosos). */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  google_auth_failed: 'No se pudo entrar con Google. Inténtalo otra vez.',
  google_state_invalid: 'El inicio con Google tardó demasiado o se abrió en otra pestaña. Inténtalo otra vez.',
  google_email_missing: 'Google no compartió tu correo. Inténtalo con otra cuenta.',
  google_email_unverified: 'Tu correo de Google aún no está verificado.',
  account_disabled: 'Tu cuenta está desactivada. Escríbele al equipo de Juried.',
  session_expired: 'Tu sesión terminó. Vuelve a entrar.',
  session_changed: 'Alguien entró con otra cuenta en este navegador. Vuelve a entrar con la tuya.',
  missing_code: 'No se pudo completar el inicio con Google. Inténtalo otra vez.',
  token_error: 'No se pudo completar el inicio con Google. Inténtalo otra vez.',
};

/** Las mismas reglas que el servidor (utils/passwordPolicy.ts): cualquier símbolo cuenta como especial. */
export const passwordChecks = (password: string) => [
  { label: 'Al menos 8 caracteres', ok: password.length >= 8 },
  { label: 'Una letra mayúscula', ok: /[A-Z]/.test(password) },
  { label: 'Una letra minúscula', ok: /[a-z]/.test(password) },
  { label: 'Un número', ok: /[0-9]/.test(password) },
  { label: 'Un símbolo (por ejemplo # o !)', ok: /[^A-Za-z0-9]/.test(password) },
];

export const isPasswordValid = (password: string) => passwordChecks(password).every((c) => c.ok);

export const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  || (error instanceof Error && error.message)
  || fallback;

// Código de la puerta /unirse mientras el alumno va a Google (o inicia sesión) y vuelve.
const PENDING_JOIN_KEY = 'juried:pending-join';

export const setPendingJoinCode = (code: string) => {
  try {
    sessionStorage.setItem(PENDING_JOIN_KEY, code);
  } catch {
    // Sin almacenamiento: el alumno vuelve a escribir el código.
  }
};

/** Lee y borra el código pendiente. */
export const takePendingJoinCode = (): string | null => {
  try {
    const code = sessionStorage.getItem(PENDING_JOIN_KEY);
    sessionStorage.removeItem(PENDING_JOIN_KEY);
    return code;
  } catch {
    return null;
  }
};

/** Adónde va un alumno tras entrar: a terminar de unirse si traía un código. */
export const studentLanding = (): string => {
  const code = takePendingJoinCode();
  return code ? `/join-class?code=${encodeURIComponent(code)}` : '/dashboard';
};

/** Lo que se muestra como "cuenta" del usuario: los alumnos con PIN no tienen correo visible. */
export const accountLabel = (user: { email?: string; provider?: string } | null | undefined) =>
  user?.provider === 'PIN' ? 'Entras con tu PIN' : user?.email ?? '';

/** PIN que cualquiera probaría primero (0000, 1111, 1234, 4321…). El servidor aplica la misma regla. */
export const isWeakPin = (pin: string) => /^(\d)\1{3}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin);

/** Código como lo escribe un niño: mayúsculas, sin espacios ni guiones. */
export const normalizeJoinCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

/** Botones de las pantallas de acceso: se hunden un poco al tocarlos (sin efecto si se pidió reducir el movimiento). */
export const pressable = 'transition duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100';
/** Tarjetas-puerta: se elevan al pasar el cursor. */
export const liftable = 'transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100';
