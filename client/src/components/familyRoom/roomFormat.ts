import type { RoomFamilies } from '../../lib/familyRoomApi';

const timeFormat = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
const fullFormat = new Intl.DateTimeFormat('es', { dateStyle: 'long', timeStyle: 'short' });

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export const timeLabel = (iso: string) => timeFormat.format(new Date(iso));
export const fullDateLabel = (iso: string) => fullFormat.format(new Date(iso));
export const sameDay = (a: string, b: string) => dayKey(new Date(a)) === dayKey(new Date(b));

/** «Hoy», «Ayer» o «Viernes, 3 de octubre». */
export const dayLabel = (iso: string, now = new Date()) => {
  const date = new Date(iso);
  if (dayKey(date) === dayKey(now)) return 'Hoy';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return 'Ayer';
  const label = dayFormat.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;

/** Solo para el docente: de qué alumno es cada familia («familia de Benja»). Las familias no lo ven. */
export const familyOfMap = (families?: RoomFamilies) => {
  const students = new Map<string, string[]>();
  for (const student of families?.students ?? []) {
    for (const family of student.families) students.set(family.userId, [...(students.get(family.userId) ?? []), student.studentName]);
  }
  return new Map([...students].map(([userId, names]) => [userId, `familia de ${joinNames(names)}`]));
};

/** Texto para mandar por el chat privado con esa familia (nunca al grupo: el código es solo suyo). */
export const familyInviteText = ({ studentName, code, classroomName }: { studentName: string; code: string; classroomName: string }) =>
  [
    `Hola. Para seguir el progreso de ${studentName} y recibir los avisos de ${classroomName} en Juried:`,
    `1. Entra a ${window.location.origin} y crea tu cuenta como familia.`,
    `2. Escribe este código: ${code}`,
    'El código es solo para tu familia: no lo compartas en grupos.',
  ].join('\n');
