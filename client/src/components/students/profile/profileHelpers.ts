import type { Student } from '../../../lib/classroomApi';
import type { StudentSummary, SummaryPeriod } from '../../../lib/studentApi';

export const summaryKey = (classroomId: string, studentId: string, period: SummaryPeriod) =>
  ['student-summary', classroomId, studentId, period] as const;
export const activityKey = (classroomId: string, studentId: string, filter: string) =>
  ['student-activity', classroomId, studentId, filter] as const;
export const studentBadgesKey = (studentId: string) => ['student-badges', studentId] as const;

export type ProfileTab = 'resumen' | 'actividad' | 'logros' | 'aprendizaje';

export const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'actividad', label: 'Actividad' },
  { id: 'logros', label: 'Logros' },
  { id: 'aprendizaje', label: 'Aprendizaje' },
];

// Umbrales de alertas acordados con el usuario.
export const LOW_HP_RATIO = 0.3;
export const INACTIVE_DAYS = 7;
export const ABSENCE_STREAK = 3;

/** Progreso de nivel (nivel N pide N × xpPorNivel): el mismo cálculo que la Lista y el Foco. */
export const levelProgress = (xp: number, level: number, xpPerLevel: number) => {
  const lvl = level || 1;
  const start = (xpPerLevel * lvl * (lvl - 1)) / 2;
  const needed = xpPerLevel * lvl;
  const inLevel = Math.max(0, xp - start);
  return { inLevel: Math.round(inLevel), needed, percent: Math.min((inLevel / needed) * 100, 100) };
};

/** Nombre principal según la configuración de la clase y el otro como secundario. */
export const studentNames = (student: Student, showCharacterName?: boolean) => {
  const real = [student.realName, student.realLastName].filter(Boolean).join(' ') || student.displayName || '';
  const character = student.characterName || '';
  const primary = showCharacterName === false ? real || character : character || real;
  const secondary = primary === character ? real : character;
  return {
    primary: primary || 'Sin nombre',
    secondary: secondary && secondary !== primary ? secondary : null,
    secondaryLabel: primary === character ? 'Nombre real' : 'Personaje',
  };
};

// Días de calendario local (ayer a las 23:00 cuenta como 1, aunque hayan pasado pocas horas).
export const daysSince = (iso: string | null, now = new Date()) => {
  if (!iso) return null;
  const then = new Date(iso);
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(now) - day(then)) / 86_400_000);
};

export interface ProfileAlert {
  tone: 'danger' | 'warning';
  title: string;
  detail: string;
}

export const buildAlerts = (student: Student, summary: StudentSummary | undefined, maxHp: number): ProfileAlert[] => {
  const alerts: ProfileAlert[] = [];
  if (student.hp <= 0) {
    alerts.push({ tone: 'warning', title: 'Descansando', detail: 'Se quedó sin energía: asígnale una misión de recuperación.' });
  } else if (student.hp / maxHp < LOW_HP_RATIO) {
    alerts.push({ tone: 'danger', title: 'Energía baja', detail: `Tiene ${student.hp} de ${maxHp} HP (menos del ${Math.round(LOW_HP_RATIO * 100)} %).` });
  }
  if (summary) {
    const idle = daysSince(summary.lastActivityAt);
    if (idle === null) {
      alerts.push({ tone: 'warning', title: 'Sin actividad', detail: 'Todavía no recibió puntos en esta clase.' });
    } else if (idle >= INACTIVE_DAYS) {
      alerts.push({ tone: 'warning', title: 'Sin actividad reciente', detail: `Hace ${idle} días que no recibe puntos.` });
    }
    if (summary.attendance.consecutiveAbsences >= ABSENCE_STREAK) {
      alerts.push({ tone: 'danger', title: 'Faltas seguidas', detail: `Faltó a las últimas ${summary.attendance.consecutiveAbsences} clases registradas.` });
    }
  }
  return alerts;
};

export const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });

// Días del pase de lista: se guardan a las 12:00 UTC, se muestran en UTC para no correrse de día.
export const formatAttendanceDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Completa la serie con los días (o semanas) sin actividad para que el gráfico muestre huecos reales.
 * En "todo el curso" empieza en el primer punto registrado.
 */
export const fillTimeline = (summary: StudentSummary) => {
  const { bucket, points } = summary.timeline;
  const byDate = new Map(points.map((p) => [p.date, p]));
  const firstDate = summary.period.from ? new Date(summary.period.from) : points[0] ? new Date(`${points[0].date}T00:00:00`) : new Date();
  const start = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());
  if (bucket === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // lunes
  const end = new Date();
  const out: { date: string; label: string; xp: number; hp: number; gp: number }[] = [];
  for (let d = new Date(start); d <= end && out.length < 400; d.setDate(d.getDate() + (bucket === 'week' ? 7 : 1))) {
    const key = isoDay(d);
    const p = byDate.get(key);
    out.push({
      date: key,
      label: d.toLocaleDateString('es', { day: 'numeric', month: 'short' }),
      xp: p?.xp ?? 0,
      hp: p?.hp ?? 0,
      gp: p?.gp ?? 0,
    });
  }
  return out;
};
