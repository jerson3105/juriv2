import { Check, Clock, FileText, X, type LucideIcon } from 'lucide-react';
import type { AttendanceStatus, MyAttendanceDay } from '../../../lib/attendanceApi';
import type { ClassNote } from '../../../lib/classNoteApi';
import { NOTE_CATEGORY, activeNotes, dayLabel, longDayLabel, noteDateKey, plural } from '../home/studentHomeHelpers';
import { jiroAction, jiroEndsKey, openJiro, stations, type JiroItem, type TodoItem } from '../home/nextGoal';

interface AttendanceStyle {
  /** Leyenda y conteos. */
  label: string;
  /** Frase del detalle del día. */
  phrase: string;
  icon: LucideIcon;
  /** Celda del mes: tinte con número AA (nunca solo el color: lleva su ícono). */
  cell: string;
  iconColor: string;
  chip: string;
}

export const ATTENDANCE: Record<AttendanceStatus, AttendanceStyle> = {
  PRESENT: {
    label: 'Presente', phrase: 'Asististe', icon: Check,
    cell: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-50',
    iconColor: 'text-emerald-700 dark:text-emerald-300',
    chip: 'bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:ring-emerald-700/60',
  },
  LATE: {
    label: 'Tarde', phrase: 'Llegaste tarde', icon: Clock,
    cell: 'bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-50',
    iconColor: 'text-amber-700 dark:text-amber-300',
    chip: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700/60',
  },
  ABSENT: {
    label: 'Falta', phrase: 'Faltaste', icon: X,
    cell: 'bg-red-100 text-red-950 dark:bg-red-900/60 dark:text-red-50',
    iconColor: 'text-red-700 dark:text-red-300',
    chip: 'bg-red-50 text-red-900 ring-red-200 dark:bg-red-900/40 dark:text-red-100 dark:ring-red-700/60',
  },
  EXCUSED: {
    label: 'Justificada', phrase: 'Falta justificada', icon: FileText,
    cell: 'bg-sky-100 text-sky-950 dark:bg-sky-900/60 dark:text-sky-50',
    iconColor: 'text-sky-700 dark:text-sky-300',
    chip: 'bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-900/40 dark:text-sky-100 dark:ring-sky-700/60',
  },
};

export const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export interface CalendarDay {
  key: string;
  attendance: MyAttendanceDay | null;
  notes: ClassNote[];
  /** Expediciones de Jiro que cierran ese día. */
  jiro: JiroItem[];
}

/** En el calendario: los avisos vigentes y, en días pasados, también los que el docente ya cerró (historial). */
const visibleNote = (note: ClassNote, today: string) => !!note.dueDate && (!note.isCompleted || noteDateKey(note.dueDate) < today);

/** Todo lo que tiene fecha para el alumno, por día (AAAA-MM-DD). */
export const buildCalendar = (attendance: MyAttendanceDay[], notes: ClassNote[], jiro: JiroItem[], today: string) => {
  const days = new Map<string, CalendarDay>();
  const dayOf = (key: string) => {
    const existing = days.get(key);
    if (existing) return existing;
    const created: CalendarDay = { key, attendance: null, notes: [], jiro: [] };
    days.set(key, created);
    return created;
  };
  attendance.forEach((record) => { dayOf(record.day).attendance = record; });
  notes.filter((note) => visibleNote(note, today)).forEach((note) => dayOf(noteDateKey(note.dueDate!)).notes.push(note));
  openJiro(jiro).forEach((expedition) => {
    const key = jiroEndsKey(expedition);
    if (key && key >= today) dayOf(key).jiro.push(expedition);
  });
  return days;
};

/** "Lo próximo": avisos vigentes desde hoy (de cualquier mes) y cierres de expediciones, por fecha. */
export const upcomingItems = (notes: ClassNote[], jiro: JiroItem[], today: string): TodoItem[] => {
  const dated: Array<{ sort: string; item: TodoItem }> = [];
  activeNotes(notes, today).forEach((note) => {
    const key = noteDateKey(note.dueDate!);
    dated.push({ sort: `${key}|1`, item: { key: `note:${note.id}`, chip: dayLabel(key, today), today: key === today, label: NOTE_CATEGORY[note.category], text: note.content } });
  });
  openJiro(jiro).forEach((expedition) => {
    const key = jiroEndsKey(expedition);
    if (!key || key < today) return;
    dated.push({
      sort: `${key}|0`,
      item: {
        key: `jiro:${expedition.id}`,
        chip: `Cierra ${dayLabel(key, today).toLowerCase()}`,
        today: key === today,
        label: 'Expedición',
        text: `«${expedition.name}» · ${stations(expedition)}`,
        action: jiroAction(expedition),
      },
    });
  });
  return dated.sort((a, b) => a.sort.localeCompare(b.sort)).map((entry) => entry.item);
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Celdas del mes empezando en domingo (null = hueco antes del día 1). */
export const monthCells = (year: number, month: number) => {
  const cells: (string | null)[] = Array.from({ length: new Date(year, month, 1).getDay() }, () => null);
  const total = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= total; day += 1) cells.push(`${year}-${pad(month + 1)}-${pad(day)}`);
  return cells;
};

export const monthPrefix = (year: number, month: number) => `${year}-${pad(month + 1)}`;

/** "Hoy", "Mañana", "Ayer", "En 3 días" o "Hace 2 días". */
export const relativeDay = (key: string, today: string) => {
  const diff = Math.round((new Date(`${key}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  return diff > 0 ? `En ${diff} días` : `Hace ${-diff} días`;
};

/** Lo que dice el lector de pantalla de un día: fecha, asistencia y avisos completos. */
export const dayAriaLabel = (day: CalendarDay) => {
  const parts = [longDayLabel(day.key)];
  if (day.attendance) {
    const xp = day.attendance.xpAwarded;
    parts.push(`${ATTENDANCE[day.attendance.status].phrase}${xp > 0 ? `, más ${xp} XP` : ''}`);
  }
  if (day.notes.length) {
    parts.push(`${plural(day.notes.length, 'aviso', 'avisos')}: ${day.notes.map((note) => `${NOTE_CATEGORY[note.category]}: ${note.content}`).join('; ')}`);
  }
  day.jiro.forEach((expedition) => parts.push(`cierra la expedición «${expedition.name}»`));
  return parts.join('. ');
};
