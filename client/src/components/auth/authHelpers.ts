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
