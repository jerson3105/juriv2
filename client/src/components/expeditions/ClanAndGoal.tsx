import { CLAN_EMBLEMS } from '../../lib/clanApi';
import type { ClanProgress, ClassGoal } from '../../lib/expeditionApi';
import { isOverdue, plural } from './expeditionHelpers';

type Tone = 'stage' | 'page';

const dayFormat = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short' });

/** Un segmento por parada: encendido cuando cuenta para el clan (forma además de color: lleno o vacío). */
const Segments = ({ stopIds, counted, tone }: { stopIds: string[]; counted: Set<string>; tone: Tone }) => (
  <div className="mt-2 flex gap-1" aria-hidden="true">
    {stopIds.map((id) => (
      <span key={id} className={`h-2.5 flex-1 rounded-full ${counted.has(id)
        ? 'bg-amber-400'
        : tone === 'stage' ? 'border border-white/30 bg-white/10' : 'border border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-700'}`} />
    ))}
  </div>
);

/**
 * Capa de clanes (proyección y progreso): una tarjeta por clan con su emblema y color. Cada parada cuenta para
 * el clan cuando la logra más de la mitad de sus miembros; con todas, el clan llegó a la meta. Sin nombres de alumnos.
 */
export const ClanCards = ({ clans, stopIds, tone }: { clans: ClanProgress[]; stopIds: string[]; tone: Tone }) => {
  if (clans.length === 0) return null;
  const stage = tone === 'stage';
  return (
    <ul className={`grid w-full gap-3 ${stage ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`} aria-label="Avance de los clanes">
      {clans.map((clan) => {
        const counted = new Set(clan.countedStopIds);
        const status = clan.finished ? '¡En la meta!' : `${counted.size} de ${stopIds.length}`;
        return (
          <li key={clan.id} className={`rounded-2xl border-2 p-3 ${stage ? 'bg-white/5' : 'bg-white dark:bg-gray-800'}`} style={{ borderColor: clan.color }}
            aria-label={`${clan.name}: ${clan.finished ? 'llegó a la meta' : `${counted.size} de ${stopIds.length} paradas`} · ${plural(clan.members, 'miembro', 'miembros')}`}>
            <p className={`flex items-center gap-2 font-black ${stage ? 'text-xl text-white' : 'text-base text-gray-900 dark:text-white'}`}>
              <span aria-hidden="true">{CLAN_EMBLEMS[clan.emblem] ?? '🛡️'}</span>
              <span className="min-w-0 truncate">{clan.name}</span>
            </p>
            <Segments stopIds={stopIds} counted={counted} tone={tone} />
            <p className={`mt-1.5 font-bold ${stage ? 'text-lg text-amber-100' : 'text-sm text-gray-800 dark:text-gray-100'}`} aria-hidden="true">
              {clan.finished && <span className="mr-1">🏁</span>}{status}
            </p>
          </li>
        );
      })}
    </ul>
  );
};

/** Meta de la clase: cuántos llegaron, la marca del porcentaje, la fecha y el premio (o «¡Lograda!»). */
export const ClassGoalBar = ({ goal, tone, studentRewarded }: {
  goal: ClassGoal; tone: Tone;
  /** Vista del alumno: si ya cobró el premio (si no, se le dice qué falta). */
  studentRewarded?: boolean;
}) => {
  const stage = tone === 'stage';
  const percent = goal.total ? Math.round((goal.finished / goal.total) * 100) : 0;
  const reached = !!goal.reachedAt;
  const pastDue = isOverdue(goal.dueAt);
  const expired = !reached && pastDue;
  const due = goal.dueAt ? ` · hasta el ${dayFormat.format(new Date(goal.dueAt))}` : '';
  const prize = goal.xp > 0 ? `+${goal.xp} XP para quienes llegaron` : '';
  let note: string;
  if (reached) {
    note = studentRewarded === undefined
      ? `¡Lograda!${prize ? ` ${prize}.` : ''}`
      : studentRewarded
        ? `¡Lograda!${goal.xp > 0 ? ` Ganaste +${goal.xp} XP.` : ''}`
        // Pasada la fecha ya no se cobra: no se promete el premio.
        : `¡La clase la logró!${goal.xp > 0 && !pastDue ? ` Llega a la meta para ganar +${goal.xp} XP.` : ''}`;
  } else if (expired) {
    note = 'Venció la fecha de la meta.';
  } else {
    note = `Meta: ${goal.percent} %${due}${prize ? ` · si la logran: ${prize}` : ''}`;
  }
  return (
    <section aria-label="Meta de la clase" className={stage
      ? 'w-full rounded-2xl border border-amber-200/30 bg-indigo-950/60 px-4 py-3'
      : 'rounded-2xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40'}>
      <p className={`flex flex-wrap items-baseline gap-x-2 font-bold ${stage ? 'text-xl text-white' : 'text-base text-amber-950 dark:text-amber-50'}`}>
        <span aria-hidden="true">{reached ? '🎉' : '🎯'}</span> Meta de la clase: {goal.finished} de {goal.total} en la meta
      </p>
      <div className={`relative mt-2 h-3 rounded-full ${stage ? 'bg-white/15' : 'bg-amber-200/70 dark:bg-amber-900/60'}`}
        role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${percent} % llegó a la meta; la meta es ${goal.percent} %`}>
        <div className={`h-full rounded-full ${reached ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, percent)}%` }} />
        <span className={`absolute -top-1 h-5 w-1 -translate-x-1/2 rounded-full ${stage ? 'bg-white' : 'bg-amber-900 dark:bg-amber-100'}`} style={{ left: `${goal.percent}%` }} aria-hidden="true" />
      </div>
      <p className={`mt-1.5 ${stage ? 'text-base font-semibold text-indigo-100' : 'text-sm text-amber-950 dark:text-amber-50'}`}>{note}</p>
    </section>
  );
};

/** «Tu clan» en la vista del alumno: cuántas paradas cuentan para su clan y cuándo cuentan. */
export const MyClanCard = ({ clan, stopIds }: { clan: Omit<ClanProgress, 'id'>; stopIds: string[] }) => {
  const counted = new Set(clan.countedStopIds);
  return (
    <section aria-label="Tu clan" className="rounded-2xl border-2 bg-white p-3 dark:bg-gray-800" style={{ borderColor: clan.color }}>
      <p className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
        <span aria-hidden="true">{CLAN_EMBLEMS[clan.emblem] ?? '🛡️'}</span>
        <span className="min-w-0 truncate">Tu clan · {clan.name}</span>
      </p>
      <Segments stopIds={stopIds} counted={counted} tone="page" />
      <p className="mt-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {clan.finished ? '🏁 ¡Tu clan llegó a la meta!' : `${counted.size} de ${plural(stopIds.length, 'parada', 'paradas')}`}
      </p>
      {!clan.finished && <p className="text-xs text-gray-700 dark:text-gray-300">Una parada cuenta cuando la logra más de la mitad del clan.</p>}
    </section>
  );
};
