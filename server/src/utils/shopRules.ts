// Reglas de la tienda del alumno que comparten compra, regalo y la vista del alumno.

/**
 * Mensajes de regalo: solo frases predefinidas (entre menores no hay texto libre sin moderar).
 * El cliente manda la clave; el servidor guarda el texto.
 */
export const GIFT_PHRASES = {
  gracias: '¡Gracias por ayudarme!',
  'buen-trabajo': '¡Buen trabajo!',
  disfrutalo: 'Para que lo disfrutes',
  'en-la-clase': 'Me alegra tenerte en la clase',
} as const;
export type GiftPhraseKey = keyof typeof GIFT_PHRASES;
export const GIFT_PHRASE_KEYS = Object.keys(GIFT_PHRASES) as [GiftPhraseKey, ...GiftPhraseKey[]];

/** Regalos que un alumno puede hacer por día. */
export const GIFTS_PER_DAY = 1;

/** Desfase por defecto (Perú, UTC−5) cuando el navegador no lo manda. */
export const DEFAULT_TZ_OFFSET = 300;

/**
 * Inicio del día local del alumno, en UTC. `tz` es su getTimezoneOffset() (Perú = 300).
 * El límite diario cuenta desde la medianoche del alumno, no la del servidor.
 */
export const localDayStart = (tz: number, now = new Date()) => {
  const local = new Date(now.getTime() - tz * 60_000);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + tz * 60_000);
};

/** Nombre con el que un alumno ve a un compañero, según si la clase muestra personajes. */
export const classmateName = (
  profile: { characterName: string | null; displayName: string | null },
  user: { firstName: string | null; lastName: string | null } | null,
  showCharacterName: boolean,
) => {
  const real = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || profile.displayName?.trim() || '';
  const character = profile.characterName?.trim() || '';
  return (showCharacterName ? character || real : real || character) || 'Un compañero';
};
