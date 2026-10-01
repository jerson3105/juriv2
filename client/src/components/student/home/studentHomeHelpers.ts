import type { ClassNote } from '../../../lib/classNoteApi';

// Estilos del inicio del alumno: tarjetas neutras como las del Inicio del docente.
export const homeCard = 'rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-700 dark:bg-gray-800';
export const cardTitle = 'text-base font-bold text-gray-900 dark:text-white';
export const cardText = 'text-sm text-gray-700 dark:text-gray-300';
export const cardLink = 'inline-flex min-h-[44px] items-center gap-1 rounded-lg px-1 text-sm font-semibold text-primary-700 hover:underline dark:text-primary-300';
export const rowButton = 'inline-flex min-h-[44px] flex-shrink-0 items-center rounded-xl bg-primary-50 px-3 text-sm font-bold text-primary-800 hover:bg-primary-100 dark:bg-primary-900/40 dark:text-primary-100 dark:hover:bg-primary-900/60';
// Sobre la noche del bloque principal.
export const nightLink = 'inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20';
export const nightPrimary = 'inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-slate-900 shadow hover:bg-indigo-50';

/** Fecha de un aviso (se guarda a mediodía: la clave UTC es el día que eligió el docente). */
export const noteDateKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

/** Hoy en la hora del alumno, como AAAA-MM-DD. */
export const localDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const addDaysKey = (key: string, days: number) => {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
};

/** "Hoy", "Mañana", "sáb 3" o, si es de otro mes, "lun 3 nov". */
export const dayLabel = (key: string, today: string) => {
  if (key === today) return 'Hoy';
  if (key === addDaysKey(today, 1)) return 'Mañana';
  const sameMonth = key.slice(0, 7) === today.slice(0, 7);
  return new Date(`${key}T12:00:00`)
    .toLocaleDateString('es', sameMonth ? { weekday: 'short', day: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/[.,]/g, '');
};

/** "Jueves 1 de octubre". */
export const longDayLabel = (key: string) => {
  const text = new Date(`${key}T12:00:00`).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** "el sábado" para frases ("cierra el sábado"). */
export const weekdayName = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('es', { weekday: 'long' });

export const NOTE_CATEGORY: Record<ClassNote['category'], string> = {
  task: 'Tarea',
  material: 'Material',
  review: 'Revisión',
  other: 'Aviso',
};

/** Avisos vigentes: con fecha, sin cerrar y no vencidos (el alumno no puede cerrarlos). */
export const activeNotes = (notes: ClassNote[], today: string) =>
  notes
    .filter((note) => note.dueDate && !note.isCompleted && noteDateKey(note.dueDate) >= today)
    .sort((a, b) => noteDateKey(a.dueDate!).localeCompare(noteDateKey(b.dueDate!)));

/** Número estable a partir de un id: cada clase tiene su cielo. */
export const seedOf = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(hash) || 7;
};

export const plural = (n: number, one: string, many: string) => `${n.toLocaleString('es')} ${n === 1 ? one : many}`;
