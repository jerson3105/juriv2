/**
 * Política del PIN de los alumnos sin correo (4 números). El cliente aplica la misma regla de PIN débil en
 * client/src/components/auth/authHelpers.ts: si cambia aquí, cambia allá.
 */
export const isPinFormatValid = (pin: string) => /^\d{4}$/.test(pin);

// Los primeros que cualquiera probaría además de las reglas de abajo: columnas y diagonales del teclado y los más usados.
const COMMON_PINS = new Set(['1004', '2580', '0852', '1470', '0741', '3690', '0963', '7410', '9630', '1357', '2468', '6969', '1231', '1230', '0007', '7000']);

/** PIN fácil de adivinar: repetido (1111), escalera (1234, 9876), pareja (1212, 1122), año (1950–2030) o muy usado. */
export const isWeakPin = (pin: string) =>
  /^(\d)\1{3}$/.test(pin) ||
  '0123456789'.includes(pin) ||
  '9876543210'.includes(pin) ||
  /^(\d\d)\1$/.test(pin) ||
  /^(\d)\1(\d)\2$/.test(pin) ||
  (Number(pin) >= 1950 && Number(pin) <= 2030) ||
  COMMON_PINS.has(pin);

/** Intentos fallidos seguidos antes de cada bloqueo. */
export const PIN_MAX_ATTEMPTS = 5;
/**
 * Bloqueos escalonados: el 1.º dura 15 minutos y el 2.º una hora. El 3.º deja el acceso bloqueado hasta que el docente
 * lo restablezca. Entrar bien vuelve a empezar la escalera.
 */
export const PIN_LOCK_STEPS_MS = [15 * 60 * 1000, 60 * 60 * 1000];
export const PIN_BLOCK_LEVEL = PIN_LOCK_STEPS_MS.length + 1;
