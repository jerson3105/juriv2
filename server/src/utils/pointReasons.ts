// Motivos que el sistema escribe en point_logs. Los usan «Lo nuevo» del inicio y «Mi progreso».

/** Lo que el alumno gastó por su cuenta (tienda, regalos, canje con su profe, energía de expedición): lo decidió él. */
export const SELF_SPEND_PREFIXES = ['Compra en tienda', 'Regalo en tienda', 'Compra aprobada en tienda', 'Canje con tu profe', 'Compra de energía'];
export const isSelfSpend = (reason: string | null | undefined) =>
  !!reason && SELF_SPEND_PREFIXES.some((prefix) => reason.startsWith(prefix));

const SELF_SPEND_TEXT: [prefix: string, verb: string][] = [
  ['Compra aprobada en tienda: ', 'Compraste'],
  ['Compra en tienda: ', 'Compraste'],
  ['Regalo en tienda: ', 'Regalaste'],
  ['Canje con tu profe: ', 'Canjeaste con tu profe'],
  ['Compra de energía - Expedición: ', 'Energía para la expedición'],
];
/** El gasto propio en tuteo: «Compraste «Lápiz mágico»». */
export const selfSpendText = (reason: string) => {
  const match = SELF_SPEND_TEXT.find(([prefix]) => reason.startsWith(prefix));
  return match ? `${match[1]} «${reason.slice(match[0].length)}»` : reason;
};

/** Recompensa (XP y oro) de una insignia: «Insignia: <nombre>». */
export const BADGE_REWARD_PREFIX = 'Insignia: ';
export const isBadgeReward = (reason: string | null | undefined) => !!reason && reason.startsWith(BADGE_REWARD_PREFIX);
