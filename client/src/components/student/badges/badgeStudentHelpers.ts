import type { BadgeProgressInfo, BadgeRarity, BadgeToEarn, EarnedBadge } from '../../../lib/badgeApi';

export const myBadgesKey = (profileId: string) => ['my-badges', profileId] as const;

export const groupTitle = 'text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300';
export const subTitle = 'text-sm font-bold text-gray-900 dark:text-white';
export const newChip = 'inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-900 dark:bg-primary-900/40 dark:text-primary-100';
export const countChip = 'inline-flex items-center rounded-full bg-gray-900 px-2 py-0.5 text-xs font-black text-white dark:bg-white dark:text-gray-900';
export const savingsTrack = 'h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700';
// Mismo tono que la barra de «Tu camino» en Mi progreso.
export const progressFill = 'h-full rounded-full bg-primary-600 dark:bg-primary-300';

const RARITY_ORDER: BadgeRarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];

/** «29 sept» (fechas cortas en español). */
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** «hoy», «ayer», «el lunes» (esta semana) o «el 3 oct». */
export const whenText = (iso: string, now = new Date()) => {
  const days = Math.round((dayStart(now) - dayStart(new Date(iso))) / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `el ${new Date(iso).toLocaleDateString('es', { weekday: 'long' })}`;
  return `el ${shortDate(iso)}`;
};

/** Ganada en los últimos 7 días. */
export const isNew = (iso: string, now = new Date()) => now.getTime() - new Date(iso).getTime() < 7 * 86_400_000;

type Award = EarnedBadge['awards'][number];

/** Por qué la tiene (una vez): el motivo del profe primero; si no, de dónde vino. */
export const awardWhy = (award: Award, badge: Pick<EarnedBadge, 'condition' | 'description'>): string => {
  const reason = award.reason ?? '';
  switch (award.origin) {
    case 'STORY':
      return `Por la historia «${reason.replace(/^Historia:\s*/, '') || 'de tu clase'}»`;
    case 'ALBUM':
      return `Por completar el álbum «${reason.replace(/^Álbum completado:\s*/, '') || 'de figuritas'}»`;
    case 'AUTO':
      return badge.condition ? `La ganaste ${badge.condition}` : 'La ganaste sola';
    default:
      return reason ? `«${reason}»` : 'Te la dio tu profe';
  }
};

/** Quién se la dio, para acompañar el motivo del profe. */
export const awardWho = (award: Award) => (award.origin === 'TEACHER' ? 'Te la dio tu profe' : award.origin === 'AUTO' ? 'Se ganó sola' : null);

/** Cómo ganar una que aún no tiene. */
export const howText = (badge: Pick<BadgeToEarn, 'kind' | 'condition' | 'description'>) => {
  if (badge.kind === 'TEACHER') {
    return badge.description ? `Te la da tu profe: «${badge.description}»` : 'Te la da tu profe. Pregúntale cómo ganarla.';
  }
  const sola = badge.condition ? `Se gana sola ${badge.condition}` : 'Se gana sola';
  return badge.kind === 'BOTH' ? `${sola}, o te la da tu profe` : sola;
};

/** «4 de 5 veces», «350 de 500 XP», «Te faltan 120 XP para el nivel 5», «2 de 3 compras». */
export const progressText = (progress: BadgeProgressInfo) => {
  const current = Math.min(progress.current, progress.target).toLocaleString('es');
  const target = progress.target.toLocaleString('es');
  switch (progress.unit) {
    case 'times':
      return `${current} de ${target} ${progress.target === 1 ? 'vez' : 'veces'}`;
    case 'xp':
      return `${current} de ${target} XP`;
    case 'level': {
      const left = Math.max(0, progress.target - progress.current);
      return left > 0 ? `Te faltan ${left.toLocaleString('es')} XP para el nivel ${progress.level}` : `Ya casi llegas al nivel ${progress.level}`;
    }
    case 'purchases':
      return `${current} de ${target} ${progress.target === 1 ? 'compra' : 'compras'}`;
  }
};

/** «cuenta desde el 29 sept»: lo de antes de crear la insignia no cuenta (así se otorga). */
export const sinceText = (progress: BadgeProgressInfo) => (progress.since ? `Cuenta desde el ${shortDate(progress.since)}` : null);

/**
 * «Puedes ganar»: primero las que se ganan solas (las más avanzadas primero) y luego las que da el
 * profe (las comunes primero: lo alcanzable antes que lo épico).
 */
export const groupToEarn = (toEarn: BadgeToEarn[]) => ({
  auto: toEarn.filter((badge) => badge.kind !== 'TEACHER')
    .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.name.localeCompare(b.name, 'es')),
  teacher: toEarn.filter((badge) => badge.kind === 'TEACHER')
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name, 'es')),
});

/** La más alcanzable para quien no tiene ninguna: la medible más avanzada o, si no, una común del profe. */
export const firstToEarn = (toEarn: BadgeToEarn[]) => {
  const { auto, teacher } = groupToEarn(toEarn);
  return auto.find((badge) => (badge.percent ?? 0) > 0) ?? teacher[0] ?? auto[0] ?? null;
};

/** «Te dio +25 XP y 15 de oro» / «Al ganarla: +25 XP». */
export const rewardText = (reward: { xp: number; gp: number }, earned: boolean) => {
  const parts = [reward.xp > 0 ? `+${reward.xp.toLocaleString('es')} XP` : null, reward.gp > 0 ? `${reward.gp.toLocaleString('es')} de oro` : null].filter(Boolean);
  if (parts.length === 0) return null;
  return `${earned ? 'Te dio' : 'Al ganarla:'} ${parts.join(' y ')}`;
};
