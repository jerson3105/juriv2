import type { ProgressHistoryItem, ProgressPeriod } from '../../../lib/studentApi';
import { addDaysKey, localDateKey } from '../home/studentHomeHelpers';

export const fmt = (n: number) => n.toLocaleString('es');

const short = (key: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('es', options).replace('.', '');

/** Etiqueta bajo la barra: «28 sept» (semana) o «sept» (mes). */
export const bucketLabel = (start: string, bucket: 'week' | 'month') =>
  bucket === 'week' ? short(start, { day: 'numeric', month: 'short' }) : short(start, { month: 'short' });

/** «28 sept – 4 oct» o «septiembre de 2026». */
export const bucketLongLabel = (start: string, bucket: 'week' | 'month') =>
  bucket === 'week'
    ? `${bucketLabel(start, 'week')} – ${bucketLabel(addDaysKey(start, 6), 'week')}`
    : new Date(`${start}T12:00:00`).toLocaleDateString('es', { month: 'long', year: 'numeric' });

/** «Este bimestre» o «En total», para empezar frases. */
export const periodLead = (kind: ProgressPeriod) => (kind === 'bimester' ? 'Este bimestre' : 'En total');

/** Día del historial: «Hoy», «Ayer» o «lunes 28 de septiembre». */
export const historyDayLabel = (key: string, today: string) => {
  if (key === today) return 'Hoy';
  if (key === addDaysKey(today, -1)) return 'Ayer';
  const text = new Date(`${key}T12:00:00`).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Líneas agrupadas por día local (vienen de la más nueva a la más vieja). */
export const groupByDay = (items: ProgressHistoryItem[]) => {
  const groups: { key: string; items: ProgressHistoryItem[] }[] = [];
  for (const item of items) {
    const key = localDateKey(new Date(item.at));
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
};

/** Qué pasó, en tuteo. Si la clase no muestra motivos, una frase según lo que cambió. */
export const historyText = (item: ProgressHistoryItem) => {
  if (item.kind === 'badge') return `Insignia «${item.label}»`;
  if (item.label) return item.label;
  if (item.xp > 0) return 'Tu profe te dio XP';
  if (item.gp > 0) return 'Tu profe te dio oro';
  if (item.hp > 0) return 'Recuperaste energía';
  if (item.hp < 0) return 'Perdiste energía';
  return 'Ajuste de tu profe';
};

export type AmountTone = 'gain' | 'loss' | 'spend';

/** «+15 XP», «+5 de oro», «−5 de energía»; el gasto propio sin signo («30 de oro»). */
export const amountParts = (item: ProgressHistoryItem) => {
  const parts: { key: string; text: string; tone: AmountTone }[] = [];
  const signed = (n: number) => `${n > 0 ? '+' : '−'}${fmt(Math.abs(n))}`;
  if (item.xp) parts.push({ key: 'xp', text: `${signed(item.xp)} XP`, tone: item.xp > 0 ? 'gain' : 'loss' });
  if (item.gp) {
    const spend = item.kind === 'shop' && item.gp < 0;
    parts.push({ key: 'gp', text: spend ? `${fmt(-item.gp)} de oro` : `${signed(item.gp)} de oro`, tone: spend ? 'spend' : item.gp > 0 ? 'gain' : 'loss' });
  }
  if (item.hp) parts.push({ key: 'hp', text: `${signed(item.hp)} de energía`, tone: item.hp > 0 ? 'gain' : 'loss' });
  return parts;
};

// Un solo tono: lo ganado en azul; lo perdido y lo gastado en gris (el signo dice qué pasó, sin rojo).
export const amountChip: Record<AmountTone, string> = {
  gain: 'bg-primary-50 text-primary-900 ring-1 ring-primary-200 dark:bg-primary-900/40 dark:text-primary-100 dark:ring-primary-700/60',
  loss: 'bg-gray-100 text-gray-800 ring-1 ring-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:ring-gray-600',
  spend: 'bg-gray-100 text-gray-800 ring-1 ring-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:ring-gray-600',
};
