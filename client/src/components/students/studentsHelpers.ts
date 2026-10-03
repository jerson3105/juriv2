import type { MouseEvent } from 'react';
import type { AttendanceRecord } from '../../lib/attendanceApi';
import type { Behavior } from '../../lib/behaviorApi';
import { getBehaviorRewards } from '../../lib/behaviorPoints';
import type { Student } from '../../lib/classroomApi';
import { CLAN_EMBLEMS } from '../../lib/clanApi';
import { LOW_ENERGY_RATIO } from '../energy/energyHelpers';

export type StudentsView = 'ficha' | 'lista' | 'clanes';
export type ListFilter = 'all' | 'unrecognized' | 'resting' | 'low_hp' | 'absent' | 'round_pending' | 'round_done';

/** Filtros con información privada: al proyectar ni se muestran ni se aplican. */
export const PRIVATE_FILTERS: ReadonlySet<ListFilter> = new Set<ListFilter>(['unrecognized', 'resting', 'low_hp', 'absent']);

// Última vista de la Lista, por clase y en este navegador.
const viewKey = (classroomId: string) => `juried-students-view:${classroomId}`;

export const readStudentsView = (classroomId: string, clansEnabled: boolean): StudentsView => {
  try {
    const value = localStorage.getItem(viewKey(classroomId));
    if (value === 'lista' || (value === 'clanes' && clansEnabled)) return value;
  } catch {
    // Sin almacenamiento: la ficha.
  }
  return 'ficha';
};

export const writeStudentsView = (classroomId: string, view: StudentsView) => {
  try {
    localStorage.setItem(viewKey(classroomId), view);
  } catch {
    // Sin almacenamiento: vale hasta recargar.
  }
};

export type ClassMap = Record<string, { name: string; icon: string } | undefined>;
export type Role = { name: string; icon: string };

/** Rol (clase de personaje): el asignado o, si no, el de su clase base. */
export const roleOf = (student: Student, classMap: ClassMap): Role | null =>
  (student.characterClassId ? classMap[student.characterClassId] : undefined) ?? classMap[student.characterClass] ?? null;

/** Emblema real del clan (emoji); el escudo si no tiene. */
export const clanEmblem = (emblem: string | null | undefined) => (emblem && CLAN_EMBLEMS[emblem]) || '🛡️';

export type EnergyState = 'resting' | 'low' | null;

export const energyOf = (student: Student, maxHp: number): EnergyState => {
  if (student.hp <= 0) return 'resting';
  return student.hp / Math.max(1, maxHp) < LOW_ENERGY_RATIO ? 'low' : null;
};

export type AttendanceMark = 'absent' | 'late' | null;

export const attendanceOf = (record: AttendanceRecord | undefined): AttendanceMark =>
  record?.status === 'ABSENT' ? 'absent' : record?.status === 'LATE' ? 'late' : null;

/** Lo que da un comportamiento, corto: «+10 XP · +5 oro» (con «−» si corrige). */
export const rewardText = (behavior: Behavior) => {
  const sign = behavior.isPositive ? '+' : '−';
  return getBehaviorRewards(behavior)
    .map((reward) => `${sign}${reward.amount} ${reward.type === 'GP' ? 'oro' : reward.type}`)
    .join(' · ');
};

/**
 * Un clic en el fondo de una fila también la marca (atajo de ratón; la casilla es el camino accesible). Los
 * menús van en un portal: sus clics suben por React pero no están dentro de la fila en el DOM.
 */
export const rowClick = (studentId: string, onToggle: (id: string) => void) => (event: MouseEvent<HTMLElement>) => {
  const target = event.target as HTMLElement;
  if (!event.currentTarget.contains(target) || target.closest('button, a, input, label')) return;
  onToggle(studentId);
};

/** Para buscar sin tildes ni mayúsculas. */
export const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Inicio de hoy y del lunes en la hora local (ISO), para el pulso de la Lista. */
export const pulseBounds = (now = new Date()) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const week = new Date(today);
  week.setDate(week.getDate() - ((week.getDay() + 6) % 7));
  return { today: today.toISOString(), week: week.toISOString() };
};
