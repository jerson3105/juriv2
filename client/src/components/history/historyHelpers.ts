import type { FeedEntry, FeedType, PeriodParams } from '../../lib/historyApi';

export const feedKey = (classroomId: string, ...rest: unknown[]) => ['history-feed', classroomId, ...rest] as const;
export const summaryKey = (classroomId: string, ...rest: unknown[]) => ['history-summary', classroomId, ...rest] as const;

export const TYPE_FILTERS: { id: FeedType; label: string }[] = [
  { id: 'ALL', label: 'Todo' },
  { id: 'POINTS', label: 'Puntos' },
  { id: 'BADGE', label: 'Insignias' },
  { id: 'LEVEL_UP', label: 'Niveles' },
  { id: 'PURCHASE', label: 'Compras' },
  { id: 'ITEM_USED', label: 'Objetos usados' },
  { id: 'ATTENDANCE', label: 'Asistencia' },
];

/** De dónde vino una subida de nivel (registro del servidor). */
export const LEVEL_SOURCE_LABEL: Record<string, string> = {
  BEHAVIOR: 'Por comportamiento',
  POINTS: 'Por puntos',
  ATTENDANCE: 'Por asistencia',
  BADGE: 'Por insignia',
  STORY: 'Por la Historia',
  STREAK: 'Por racha',
  EXPEDITION: 'Por expedición',
  TOURNAMENT: 'Por torneo',
  EVENT: 'Por evento',
  ACTIVITY: 'Por actividad',
};

export type PeriodKey = 'today' | 'week' | 'bimester' | 'all' | 'custom';
export const PERIODS: { id: PeriodKey; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
  { id: 'bimester', label: 'Bimestre' },
  { id: 'all', label: 'Todo' },
  { id: 'custom', label: 'Fechas' },
];
export const PERIOD_LABEL: Record<PeriodKey, string> = {
  today: 'Hoy', week: 'Esta semana', bimester: 'Bimestre actual', all: 'Todo el curso', custom: 'Rango de fechas',
};

/** YYYY-MM-DD de la fecha local. */
export const localDateString = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const startOfLocalDay = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Periodo → parámetros de la API. Los días se calculan en la zona del profesor ([from, to) en ISO);
 * el bimestre lo resuelve el servidor. `today` fija el día para que la clave de la consulta sea estable.
 */
export const periodParams = (period: PeriodKey, custom: { from: string; to: string }, today: string): PeriodParams | null => {
  if (period === 'all') return {};
  if (period === 'bimester') return { period: 'bimester' };
  if (period === 'today') return { from: startOfLocalDay(today).toISOString() };
  if (period === 'week') {
    const start = startOfLocalDay(today);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // lunes
    return { from: start.toISOString() };
  }
  if (!custom.from && !custom.to) return {};
  if (custom.from && custom.to && custom.from > custom.to) return null; // rango inválido: no se consulta
  const params: PeriodParams = {};
  if (custom.from) params.from = startOfLocalDay(custom.from).toISOString();
  if (custom.to) {
    const end = startOfLocalDay(custom.to);
    end.setDate(end.getDate() + 1); // el día final se incluye completo
    params.to = end.toISOString();
  }
  return params;
};

// ---------- Día y hora ----------

export const dayLabel = (iso: string, now = new Date()) => {
  const date = new Date(iso);
  const key = localDateString(date);
  if (key === localDateString(now)) return 'Hoy';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === localDateString(yesterday)) return 'Ayer';
  const label = date.toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

// ---------- Descripción de una entrada ----------

const ATTENDANCE_LABEL: Record<string, string> = { PRESENT: 'Presente', LATE: 'Tardanza', ABSENT: 'Falta', EXCUSED: 'Justificada' };
const USAGE_LABEL: Record<string, string> = { APPROVED: 'aprobado', REJECTED: 'rechazado', PENDING: 'pendiente' };
const MULTIPLIER_LABEL: Record<number, string> = { 500: '½', 250: '¼', 125: '⅛' };

export type Tone = 'positive' | 'negative' | 'neutral';

export const describeEntry = (entry: FeedEntry): { title: string; amount: string; tone: Tone; note?: string } => {
  const d = entry.details;
  if (entry.type === 'POINTS') {
    const remove = d.action === 'REMOVE';
    const sign = remove ? '−' : '+';
    const parts = [
      d.xpAmount ? `${sign}${d.xpAmount} XP` : null,
      d.hpAmount ? `${sign}${d.hpAmount} HP` : null,
      d.gpAmount ? `${sign}${d.gpAmount} GP` : null,
    ].filter(Boolean);
    if (parts.length === 0 && d.amount) parts.push(`${sign}${d.amount} ${d.pointType ?? ''}`.trim());
    const partial = d.multiplier && d.multiplier !== 1000 ? ` (${MULTIPLIER_LABEL[d.multiplier] ?? `${d.multiplier / 1000}×`})` : '';
    return {
      title: `${entry.behaviorIcon ? `${entry.behaviorIcon} ` : ''}${d.reason || 'Puntos'}`,
      amount: parts.join(' · ') + partial,
      tone: remove ? 'negative' : 'positive',
    };
  }
  if (entry.type === 'BADGE') return { title: `${d.badgeIcon ?? '🏅'} Insignia: ${d.badgeName ?? ''}`, amount: '', tone: 'positive' };
  if (entry.type === 'PURCHASE') {
    return {
      title: `Compró ${d.itemIcon ? `${d.itemIcon} ` : ''}${d.itemName ?? 'un objeto'}${d.amount && d.amount > 1 ? ` ×${d.amount}` : ''}`,
      amount: d.totalPrice ? `−${d.totalPrice} GP` : '',
      tone: 'neutral',
      note: d.action === 'PENDING' ? 'Pendiente de aprobar' : d.action === 'REJECTED' ? 'Rechazada' : undefined,
    };
  }
  if (entry.type === 'ITEM_USED') {
    return {
      title: `Usó ${d.itemIcon ? `${d.itemIcon} ` : ''}${d.itemName ?? 'un objeto'}`,
      amount: '',
      tone: 'neutral',
      note: d.action ? `Uso ${USAGE_LABEL[d.action] ?? d.action.toLowerCase()}` : undefined,
    };
  }
  if (entry.type === 'LEVEL_UP') {
    return {
      title: d.fromLevel ? `Subió del nivel ${d.fromLevel} al ${d.newLevel}` : `Subió al nivel ${d.newLevel}`,
      amount: '',
      tone: 'positive',
      note: d.levelSource ? LEVEL_SOURCE_LABEL[d.levelSource] ?? undefined : undefined,
    };
  }
  const status = d.attendanceStatus ?? '';
  return {
    title: `Asistencia: ${ATTENDANCE_LABEL[status] ?? status}`,
    amount: d.amount ? `+${d.amount} XP` : '',
    tone: status === 'ABSENT' ? 'negative' : status === 'LATE' ? 'neutral' : 'positive',
  };
};

export const TONE_TILE: Record<Tone, string> = {
  positive: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  negative: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  neutral: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
};
export const TONE_TEXT: Record<Tone, string> = {
  positive: 'text-emerald-800 dark:text-emerald-300',
  negative: 'text-red-800 dark:text-red-300',
  neutral: 'text-gray-900 dark:text-white',
};

export const revertible = (entry: FeedEntry): entry is FeedEntry & { type: 'POINTS' | 'BADGE' | 'ATTENDANCE' } =>
  !entry.isReverted && (entry.type === 'POINTS' || entry.type === 'BADGE' || entry.type === 'ATTENDANCE');

// ---------- Agrupación: días y lotes ----------

export type FeedItem =
  | { kind: 'single'; entry: FeedEntry }
  | { kind: 'batch'; key: string; entries: FeedEntry[] };

export interface FeedDay {
  key: string;
  label: string;
  items: FeedItem[];
}

/**
 * Agrupa por día local y, dentro del día, junta en un lote la misma acción aplicada a varios alumnos
 * en el mismo instante (el servidor las entrega contiguas; entre páginas el lote crece solo).
 */
export const groupFeed = (entries: FeedEntry[], now = new Date()): FeedDay[] => {
  const days: FeedDay[] = [];
  for (const entry of entries) {
    const key = localDateString(new Date(entry.timestamp));
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = { key, label: dayLabel(entry.timestamp, now), items: [] };
      days.push(day);
    }
    const last = day.items[day.items.length - 1];
    if (entry.batchKey && last) {
      if (last.kind === 'batch' && last.key === entry.batchKey) {
        last.entries.push(entry);
        continue;
      }
      if (last.kind === 'single' && last.entry.batchKey === entry.batchKey) {
        day.items[day.items.length - 1] = { kind: 'batch', key: entry.batchKey, entries: [last.entry, entry] };
        continue;
      }
    }
    day.items.push({ kind: 'single', entry });
  }
  return days;
};

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
