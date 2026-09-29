import type { Student } from '../../lib/classroomApi';
import type { ClanWithMembers } from '../../lib/clanApi';
import type { RankingDeltas } from '../../lib/rankingApi';
import { studentLabel } from '../badges/badgeHelpers';

export type Metric = 'xp' | 'gp';
export type Period = 'today' | 'week' | 'all';

export type ClassMap = Record<string, { name: string; icon: string } | undefined>;

export const classOf = (row: { student: Student }, classMap: ClassMap) =>
  classMap[row.student.characterClassId ?? ''] ?? classMap[row.student.characterClass];

export const classIcon = (row: { student: Student }, classMap: ClassMap) => classOf(row, classMap)?.icon ?? '🧙';

// Pedestales del podio: oro, plata y bronce (texto oscuro sobre metal, AA).
export const PEDESTAL_STYLE = [
  { bar: 'from-amber-200 via-amber-400 to-amber-600', text: 'text-amber-950', height: 'h-28 sm:h-32', ring: 'ring-amber-300' },
  { bar: 'from-slate-100 via-slate-300 to-slate-500', text: 'text-slate-900', height: 'h-20 sm:h-24', ring: 'ring-slate-300' },
  { bar: 'from-orange-200 via-orange-400 to-orange-600', text: 'text-orange-950', height: 'h-14 sm:h-16', ring: 'ring-orange-300' },
];

export const METRIC_UNIT: Record<Metric, string> = { xp: 'XP', gp: 'oro' };

export const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Semana' },
  { id: 'all', label: 'Siempre' },
];

// Inicio del periodo en la hora local del profesor (hoy 00:00 o lunes 00:00), en ISO.
export const periodStart = (period: Exclude<Period, 'all'>, now = new Date()) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString();
};

// Puestos con empates al estilo deportivo: 100, 90, 90, 80 → 1, 2, 2, 4. `values` ya viene ordenado desc.
export const competitionRanks = (values: number[]) => {
  const ranks: number[] = [];
  values.forEach((v, i) => {
    ranks.push(i > 0 && v === values[i - 1] ? ranks[i - 1] : i + 1);
  });
  return ranks;
};

export interface RankRow {
  student: Student;
  name: string;
  value: number;
  rank: number;
  tied: boolean;
  // Puestos ganados hoy en el ranking total (positivo = subió); null si no aplica.
  movement: number | null;
}

type DeltaMap = Map<string, { xp: number; gp: number }>;

export const deltaMap = (deltas?: RankingDeltas): DeltaMap =>
  new Map((deltas?.students ?? []).map((s) => [s.id, { xp: s.xp, gp: s.gp }]));

export const activeStudents = (students: Student[]) => students.filter((s) => s.isActive !== false);

const sortByValue = <T extends { value: number; name: string }>(items: T[]) =>
  items.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'es'));

// Puesto de cada alumno al empezar el día, deducido de lo ganado hoy (sin guardar nada en el navegador).
const startRanksById = (students: Student[], metric: Metric, today: DeltaMap) => {
  const start = sortByValue(students.map((s) => ({
    id: s.id,
    name: s.characterName ?? '',
    value: Math.max(0, s[metric] - (today.get(s.id)?.[metric] ?? 0)),
  })));
  const ranks = competitionRanks(start.map((s) => s.value));
  return new Map(start.map((s, i) => [s.id, ranks[i]]));
};

export const buildRows = (
  students: Student[],
  metric: Metric,
  period: Period,
  periodDeltas: DeltaMap,
  todayDeltas: DeltaMap | null,
  showCharacterName: boolean,
): RankRow[] => {
  const active = activeStudents(students);
  const sorted = sortByValue(active.map((student) => ({
    student,
    name: studentLabel(student, showCharacterName),
    value: period === 'all' ? student[metric] : periodDeltas.get(student.id)?.[metric] ?? 0,
  })));
  const ranks = competitionRanks(sorted.map((r) => r.value));
  const startRanks = period === 'all' && todayDeltas ? startRanksById(active, metric, todayDeltas) : null;
  return sorted.map((r, i) => ({
    ...r,
    rank: ranks[i],
    tied: ranks[i] === ranks[i - 1] || ranks[i] === ranks[i + 1],
    movement: startRanks ? (startRanks.get(r.student.id) ?? ranks[i]) - ranks[i] : null,
  }));
};

export interface ClanRow {
  clan: ClanWithMembers;
  value: number;
  rank: number;
}

export const buildClanRows = (clans: ClanWithMembers[], period: Period, deltas?: RankingDeltas): ClanRow[] => {
  const byId = new Map((deltas?.clans ?? []).map((c) => [c.id, c.xp]));
  const sorted = clans
    .filter((c) => c.isActive !== false)
    .map((clan) => ({ clan, value: period === 'all' ? clan.totalXp : byId.get(clan.id) ?? 0, name: clan.name }));
  sortByValue(sorted);
  const ranks = competitionRanks(sorted.map((c) => c.value));
  return sorted.map((c, i) => ({ clan: c.clan, value: c.value, rank: ranks[i] }));
};

// Destacados del día: mayor escalada en el ranking total de XP, más XP, más oro y clan del día.
export interface DayStars {
  climber?: { row: RankRow; places: number };
  xp?: { name: string; student: Student; amount: number };
  gold?: { name: string; student: Student; amount: number };
  clan?: { clan: ClanWithMembers; amount: number };
}

export const buildDayStars = (
  students: Student[],
  clans: ClanWithMembers[],
  today: RankingDeltas | undefined,
  showCharacterName: boolean,
): DayStars => {
  if (!today) return {};
  const todayMap = deltaMap(today);
  const stars: DayStars = {};

  const climbers = buildRows(students, 'xp', 'all', todayMap, todayMap, showCharacterName)
    .filter((r) => (r.movement ?? 0) > 0)
    .sort((a, b) => (b.movement ?? 0) - (a.movement ?? 0) || a.rank - b.rank);
  if (climbers[0]) stars.climber = { row: climbers[0], places: climbers[0].movement ?? 0 };

  const byId = new Map(activeStudents(students).map((s) => [s.id, s]));
  const best = (metric: Metric) => {
    const top = today.students
      .filter((d) => byId.has(d.id) && d[metric] > 0)
      .sort((a, b) => b[metric] - a[metric])[0];
    if (!top) return undefined;
    const student = byId.get(top.id)!;
    return { student, name: studentLabel(student, showCharacterName), amount: top[metric] };
  };
  stars.xp = best('xp');
  stars.gold = best('gp');

  const topClan = buildClanRows(clans, 'today', today)[0];
  if (topClan && topClan.value > 0) stars.clan = { clan: topClan.clan, amount: topClan.value };
  return stars;
};

export const hasStars = (stars: DayStars) => !!(stars.climber || stars.xp || stars.gold || stars.clan);

// "La carrera": XP acumulado de cada alumno a lo largo del día, en fotogramas.
export interface RaceData {
  students: Student[];
  names: string[];
  frames: number[][]; // frames[k][i] = XP del alumno i en el fotograma k
  minutes: number[]; // minuto (desde el inicio del día) de cada fotograma
}

export const buildRace = (
  students: Student[],
  today: RankingDeltas,
  fromZero: boolean,
  showCharacterName: boolean,
  frameCount = 72,
): RaceData | null => {
  const events = (today.timeline ?? []).filter((e) => e.xp !== 0);
  if (events.length === 0) return null;
  const active = activeStudents(students);
  const index = new Map(active.map((s, i) => [s.id, i]));
  const todayMap = deltaMap(today);
  const base = active.map((s) => (fromZero ? 0 : Math.max(0, s.xp - (todayMap.get(s.id)?.xp ?? 0))));

  const sorted = [...events].sort((a, b) => a.m - b.m);
  const first = sorted[0].m;
  const last = sorted[sorted.length - 1].m;
  // Arranca un poco antes del primer punto para ver la salida desde la línea.
  const start = Math.max(0, first - Math.max(1, Math.round((last - first) * 0.04)));
  const span = Math.max(1, last - start);

  const frames: number[][] = [];
  const minutes: number[] = [];
  const current = [...base];
  let cursor = 0;
  for (let k = 0; k <= frameCount; k++) {
    const until = start + (span * k) / frameCount;
    while (cursor < sorted.length && sorted[cursor].m <= until) {
      const i = index.get(sorted[cursor].id);
      if (i !== undefined) current[i] = Math.max(0, current[i] + sorted[cursor].xp);
      cursor++;
    }
    frames.push([...current]);
    minutes.push(Math.round(until));
  }
  return { students: active, names: active.map((s) => studentLabel(s, showCharacterName)), frames, minutes };
};

// Hora del día (hh:mm) de un minuto contado desde `since`.
export const clockAt = (since: string, minute: number) =>
  new Date(new Date(since).getTime() + minute * 60000).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

export const formatNumber = (n: number) => n.toLocaleString('es');
