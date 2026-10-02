import type { ClassNote } from '../../../lib/classNoteApi';
import { NOTE_CATEGORY, activeNotes, addDaysKey, dayLabel, localDateKey, noteDateKey, plural, weekdayName } from './studentHomeHelpers';

/** Lo que hace un botón del inicio: ir a una página o abrir un modal del propio inicio. */
export type HomeAction =
  | { kind: 'link'; to: string; label: string }
  | { kind: 'correo' | 'role' | 'energy'; label: string };

export interface JiroItem {
  id: string;
  name: string;
  status: string;
  endsAt: string | null;
  totalStations: number;
  studentProgress: { status: string; completedStations: number } | null;
}

export interface ClassicItem {
  id: string;
  name: string;
  studentProgress?: { isCompleted: boolean } | null;
}

export interface CorreoItem {
  prompt: string;
  rejected: boolean;
}

export interface HomeInput {
  today: string;
  resting: boolean;
  initial: boolean;
  mission: string | null;
  notes: ClassNote[];
  jiro: JiroItem[];
  classic: ClassicItem[];
  /** Carta por escribir (o por reescribir); null si no hay. */
  correo: CorreoItem | null;
  role: { needsChoice: boolean; current: string; others: string[] };
  /** La insignia a la que menos le falta (50–99 %), con su progreso en palabras. */
  badgeNear: { id: string; name: string; progress: string } | null;
  /** Premios a la venta (para «Ya te alcanza» cuando no eligió meta). */
  shop: { enabled: boolean; items: { id: string; name: string; price: number }[] };
  /**
   * Su meta de ahorro (la única): un premio de la Tienda o una prenda de «Mi personaje», solo si hoy se
   * puede comprar. have: el oro con que se compara (en ropa no cuenta lo que espera a su profe).
   */
  goal: { kind: 'ITEM' | 'AVATAR'; name: string; price: number; have: number } | null;
  /** Le espera su prenda de regalo (y la tienda de prendas está abierta). */
  gift: boolean;
  gold: number;
  level: { level: number; remaining: number };
}

export interface Goal {
  /** Para no repetir lo mismo en "Para hacer". */
  key: string;
  emoji: string;
  title: string;
  body?: string;
  detail?: string;
  primary?: HomeAction;
  secondary?: HomeAction;
  resting?: boolean;
}

export interface TodoItem {
  key: string;
  /** "Hoy", "Mañana", "sáb 3", "Cierra jue 3" o vacío. */
  chip: string;
  today: boolean;
  label: string;
  text: string;
  action?: HomeAction;
}

const calendarLink: HomeAction = { kind: 'link', to: '/my-calendar', label: 'Ver mi calendario' };

// Expediciones de Jiro abiertas y sin terminar, las que cierran antes primero.
export const openJiro = (jiro: JiroItem[]) =>
  jiro
    .filter((e) => (e.status === 'OPEN' || e.status === 'IN_PROGRESS') && e.studentProgress?.status !== 'COMPLETED' && e.studentProgress?.status !== 'PENDING_REVIEW')
    .sort((a, b) => (a.endsAt ?? '9999').localeCompare(b.endsAt ?? '9999'));

export const jiroEndsKey = (e: JiroItem) => (e.endsAt ? localDateKey(new Date(e.endsAt)) : null);
export const stations = (e: JiroItem) => `${e.studentProgress?.completedStations ?? 0} de ${plural(e.totalStations, 'estación', 'estaciones')}`;
export const jiroAction = (e: JiroItem): HomeAction => ({
  kind: 'link',
  to: `/jiro-expedition/${e.id}`,
  label: e.studentProgress && e.studentProgress.status !== 'NOT_STARTED' ? 'Continuar' : 'Empezar',
});

/**
 * "Tu próxima meta": gana la primera que se cumpla. Nunca es negativa y nunca promete lo que no
 * existe. Los avisos solo suben a la meta si vencen hoy (los demás van en "Para hacer").
 */
export const nextGoal = (input: HomeInput): Goal => {
  const { today } = input;

  // 1. Descansando
  if (input.resting) {
    const energy: HomeAction = { kind: 'energy', label: '¿Qué es la energía?' };
    if (input.initial) {
      return { key: 'rest', emoji: '🌙', title: 'Estás descansando', body: 'Tu profe te ayudará a volver cuando te sientas bien.', secondary: energy, resting: true };
    }
    return input.mission
      ? { key: 'rest', emoji: '🌙', title: 'Estás descansando', body: `Tu misión: «${input.mission}»`, detail: 'Al cumplirla vuelves con la mitad de tu energía. Mientras tanto sigues ganando XP y oro. La tienda de premios está en pausa.', secondary: energy, resting: true }
      : { key: 'rest', emoji: '🌙', title: 'Estás descansando', body: 'Pídele a tu profe tu misión. Al cumplirla vuelves con la mitad de tu energía.', detail: 'Mientras tanto sigues ganando XP y oro. La tienda de premios está en pausa.', secondary: energy, resting: true };
  }

  // 2. Algo vence hoy: primero una expedición (se puede hacer aquí), después un aviso.
  const jiro = openJiro(input.jiro);
  const closingToday = jiro.find((e) => jiroEndsKey(e) === today);
  if (closingToday) {
    return { key: `jiro:${closingToday.id}`, emoji: '🦊', title: 'Tu expedición cierra hoy', body: `«${closingToday.name}» · ${stations(closingToday)}`, primary: jiroAction(closingToday) };
  }
  const noteToday = activeNotes(input.notes, today).find((n) => noteDateKey(n.dueDate!) === today);
  if (noteToday) {
    return { key: `note:${noteToday.id}`, emoji: '📌', title: `Para hoy · ${NOTE_CATEGORY[noteToday.category]}`, body: noteToday.content, secondary: calendarLink };
  }

  // 3. Algo espera al alumno en la plataforma
  if (input.correo) {
    return input.correo.rejected
      ? { key: 'correo', emoji: '💌', title: 'Tu profe te pide reescribir tu carta', body: 'Con un mensaje amable.', primary: { kind: 'correo', label: 'Reescribir' } }
      : { key: 'correo', emoji: '💌', title: 'Tienes una carta por escribir', body: `«${input.correo.prompt}»`, primary: { kind: 'correo', label: 'Escribir mi carta' } };
  }
  const nextJiro = jiro[0];
  if (nextJiro) {
    const started = !!nextJiro.studentProgress && nextJiro.studentProgress.status !== 'NOT_STARTED';
    const ends = jiroEndsKey(nextJiro);
    return started
      ? { key: `jiro:${nextJiro.id}`, emoji: '🦊', title: 'Sigue tu expedición', body: `«${nextJiro.name}» · ${stations(nextJiro)}${ends ? ` · cierra el ${weekdayName(ends)}` : ''}`, primary: jiroAction(nextJiro) }
      : { key: `jiro:${nextJiro.id}`, emoji: '🦊', title: 'Nueva expedición', body: `«${nextJiro.name}»${ends ? ` · cierra el ${weekdayName(ends)}` : ''}`, primary: jiroAction(nextJiro) };
  }
  const classic = input.classic.find((e) => !e.studentProgress?.isCompleted);
  if (classic) {
    return { key: `classic:${classic.id}`, emoji: '🗺️', title: 'Sigue tu expedición', body: `«${classic.name}»`, primary: { kind: 'link', to: '/expeditions', label: 'Continuar' } };
  }

  // 4. Primer paso pendiente: elegir su rol
  if (input.role.needsChoice) {
    const others = input.role.others.length ? ` También puedes ser ${input.role.others.join(', ').replace(/, ([^,]*)$/, ' o $1')}.` : '';
    return { key: 'role', emoji: '✨', title: 'Elige tu rol', body: `Ahora eres ${input.role.current}.${others}`, primary: { kind: 'role', label: 'Elegir mi rol' } };
  }

  // 4b. Su prenda de regalo (una vez): la ropa solo sube a la meta así o si es su meta elegida.
  if (input.gift) {
    return { key: 'gift', emoji: '🎁', title: 'Tienes una prenda de regalo', body: 'Elige una prenda común para tu personaje: es gratis.', primary: { kind: 'link', to: '/my-avatar', label: 'Elegir mi regalo' } };
  }

  // 5. Una insignia a medio camino (el mismo «Te falta poco» de Mis insignias: 50–99 %, medible)
  if (input.badgeNear) {
    const near = input.badgeNear;
    return { key: `badge:${near.id}`, emoji: '🏅', title: 'Estás cerca de una insignia', body: `«${near.name}» · ${near.progress}`, primary: { kind: 'link', to: '/my-badges', label: 'Ver mis insignias' } };
  }

  // 6. Su meta de ahorro (un premio o una prenda) o, sin meta, un premio que ya alcanza (o casi)
  if (input.goal) {
    const { name, price, have, kind } = input.goal;
    const [to, go, see] = kind === 'AVATAR'
      ? ['/my-avatar', 'Ir a mi clóset', 'Ver mi clóset']
      : ['/my-shop', 'Ir a la tienda', 'Ver la tienda'];
    const emoji = kind === 'AVATAR' ? '👕' : '🛍️';
    return price <= have
      ? { key: 'shop', emoji, title: '¡Ya te alcanza tu meta!', body: `«${name}» · ${price.toLocaleString('es')} de oro`, primary: { kind: 'link', to, label: go } }
      : { key: 'shop', emoji, title: `Te faltan ${(price - have).toLocaleString('es')} de oro para tu meta`, body: `«${name}»`, primary: { kind: 'link', to, label: see } };
  }
  if (input.shop.enabled && input.shop.items.length > 0) {
    const affordable = input.shop.items.filter((i) => i.price <= input.gold).sort((a, b) => b.price - a.price)[0];
    if (affordable) {
      return { key: 'shop', emoji: '🛍️', title: 'Ya te alcanza', body: `«${affordable.name}» · ${affordable.price.toLocaleString('es')} de oro`, primary: { kind: 'link', to: '/my-shop', label: 'Ir a la tienda' } };
    }
    const cheapest = [...input.shop.items].sort((a, b) => a.price - b.price)[0];
    const missing = cheapest.price - input.gold;
    if (missing <= cheapest.price * 0.5) {
      return { key: 'shop', emoji: '🛍️', title: `Te faltan ${missing.toLocaleString('es')} de oro`, body: `para «${cheapest.name}»`, primary: { kind: 'link', to: '/my-shop', label: 'Ver la tienda' } };
    }
  }

  // 7. Siempre: el siguiente nivel
  return {
    key: 'xp',
    emoji: '⚡',
    title: `Te faltan ${input.level.remaining.toLocaleString('es')} XP para el nivel ${input.level.level + 1}`,
    body: 'Ganas XP cuando participas y cumples en clase.',
    secondary: { kind: 'link', to: '/my-progress', label: 'Ver mi progreso' },
  };
};

const TODO_DAYS = 14;

/** "Para hacer": hoy, lo que espera en la plataforma y los avisos de las próximas 2 semanas. */
export const todoItems = (input: HomeInput, goalKey: string): TodoItem[] => {
  const { today } = input;
  const until = addDaysKey(today, TODO_DAYS);
  const notes = activeNotes(input.notes, today).filter((n) => noteDateKey(n.dueDate!) <= until);
  const jiro = openJiro(input.jiro);
  const items: TodoItem[] = [];

  const noteItem = (n: ClassNote): TodoItem => {
    const key = noteDateKey(n.dueDate!);
    return { key: `note:${n.id}`, chip: dayLabel(key, today), today: key === today, label: NOTE_CATEGORY[n.category], text: n.content };
  };
  const jiroItem = (e: JiroItem): TodoItem => {
    const ends = jiroEndsKey(e);
    return {
      key: `jiro:${e.id}`,
      chip: ends ? `Cierra ${dayLabel(ends, today).toLowerCase()}` : '',
      today: ends === today,
      label: 'Expedición',
      text: `«${e.name}» · ${stations(e)}`,
      action: jiroAction(e),
    };
  };

  // 1. Hoy
  jiro.filter((e) => jiroEndsKey(e) === today).forEach((e) => items.push(jiroItem(e)));
  notes.filter((n) => noteDateKey(n.dueDate!) === today).forEach((n) => items.push(noteItem(n)));
  // 2. Esperando en la plataforma
  if (input.correo) {
    items.push({ key: 'correo', chip: '', today: false, label: 'Correo Estelar', text: input.correo.rejected ? 'Reescribe tu carta' : 'Escribe tu carta', action: { kind: 'correo', label: input.correo.rejected ? 'Reescribir' : 'Escribir' } });
  }
  jiro.filter((e) => jiroEndsKey(e) !== today).forEach((e) => items.push(jiroItem(e)));
  input.classic.filter((e) => !e.studentProgress?.isCompleted).forEach((e) => items.push({
    key: `classic:${e.id}`, chip: '', today: false, label: 'Expedición', text: `«${e.name}»`, action: { kind: 'link', to: '/expeditions', label: 'Continuar' },
  }));
  // 3. Próximos avisos
  notes.filter((n) => noteDateKey(n.dueDate!) !== today).forEach((n) => items.push(noteItem(n)));

  return items.filter((item) => item.key !== goalKey);
};
