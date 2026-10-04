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
  admin_google_disabled: 'La cuenta de administración entra solo con correo y contraseña.',
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

// Código familiar de /familia/:code mientras la familia crea su cuenta, va a Google o inicia sesión.
const PENDING_FAMILY_KEY = 'juried:pending-family';

export const setPendingFamilyCode = (code: string) => {
  try {
    sessionStorage.setItem(PENDING_FAMILY_KEY, code);
  } catch {
    // Sin almacenamiento: la familia vuelve a abrir el enlace o escribe el código.
  }
};

/** Adónde va una familia tras entrar: de vuelta a pedir unirse si traía un código. */
export const familyLanding = (): string => {
  try {
    const code = sessionStorage.getItem(PENDING_FAMILY_KEY);
    sessionStorage.removeItem(PENDING_FAMILY_KEY);
    return code ? `/familia/${encodeURIComponent(code)}` : '/dashboard';
  } catch {
    return '/dashboard';
  }
};

/** Destino tras entrar según el rol. */
export const landingFor = (role: string | undefined): string =>
  role === 'STUDENT' ? studentLanding() : role === 'PARENT' ? familyLanding() : '/dashboard';

/** Lo que se muestra como "cuenta" del usuario: los alumnos con PIN no tienen correo visible. */
export const accountLabel = (user: { email?: string; provider?: string } | null | undefined) =>
  user?.provider === 'PIN' ? 'Entras con tu PIN' : user?.email ?? '';

// Los primeros que cualquiera probaría además de las reglas de abajo: columnas y diagonales del teclado y los más usados.
const COMMON_PINS = new Set(['1004', '2580', '0852', '1470', '0741', '3690', '0963', '7410', '9630', '1357', '2468', '6969', '1231', '1230', '0007', '7000']);

/**
 * PIN fácil de adivinar: repetido (1111), escalera (1234, 9876), pareja (1212, 1122), año (1950–2030) o muy usado.
 * El servidor aplica la misma regla (server/src/utils/pinPolicy.ts): si cambia aquí, cambia allá.
 */
export const isWeakPin = (pin: string) =>
  /^(\d)\1{3}$/.test(pin) ||
  '0123456789'.includes(pin) ||
  '9876543210'.includes(pin) ||
  /^(\d\d)\1$/.test(pin) ||
  /^(\d)\1(\d)\2$/.test(pin) ||
  (Number(pin) >= 1950 && Number(pin) <= 2030) ||
  COMMON_PINS.has(pin);

/** Pista bajo el campo y en el error de PIN débil. */
export const WEAK_PIN_HINT = 'No uses 1234, 1212, un año ni el mismo número cuatro veces.';

/** Código como lo escribe un niño: mayúsculas, sin espacios ni guiones. */
export const normalizeJoinCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

/** Botones de las pantallas de acceso: se hunden un poco al tocarlos (sin efecto si se pidió reducir el movimiento). */
export const pressable = 'transition duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100';
/** Tarjetas-puerta: se elevan al pasar el cursor. */
export const liftable = 'transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100';
