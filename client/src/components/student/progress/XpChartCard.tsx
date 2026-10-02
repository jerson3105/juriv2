import type { StudentProgress } from '../../../lib/studentApi';
import { cardText, cardTitle, homeCard } from '../home/studentHomeHelpers';
import { bucketLabel, bucketLongLabel, fmt, periodLead } from './progressHelpers';

/** XP ganado por semana (o por mes en todo el año): crecer nunca es negativo. Barras en CSS, sin librería. */
export const XpChartCard = ({ data }: { data: StudentProgress }) => {
  const { series, totals, period } = data;
  const week = series.bucket === 'week';
  const points = series.points;
  const max = Math.max(1, ...points.map((point) => point.xp));
  const withXp = points.filter((point) => point.xp > 0);
  const best = withXp.length >= 2 ? withXp.reduce((top, point) => (point.xp > top.xp ? point : top)) : null;
  const title = week ? 'Tu XP semana a semana' : 'Tu XP mes a mes';
  // Con muchas barras, valores y fechas no caben debajo de cada una: el detalle va en la tabla para lectores.
  const showValues = points.length <= 8;
  const labelEvery = points.length <= 6 ? 1 : points.length <= 12 ? 2 : 3;

  return (
    <section aria-labelledby="chart-title" className={homeCard}>
      <h2 id="chart-title" className={cardTitle}>{title}</h2>
      {series.truncated && <p className={cardText}>Tus últimas {points.length} {week ? 'semanas' : 'meses'}</p>}

      {points.length > 0 && (
        <div className="mt-4 flex items-end gap-1 sm:gap-1.5" aria-hidden="true">
          {points.map((point, index) => {
            const height = point.xp > 0 ? Math.max(6, Math.round((point.xp / max) * 100)) : 0;
            const labeled = index % labelEvery === 0 || index === points.length - 1;
            return (
              <div key={point.start} className="flex min-w-0 flex-1 flex-col items-center">
                <span className="h-5 text-xs font-bold tabular-nums text-gray-900 dark:text-white">
                  {(showValues || point === best) && point.xp > 0 ? `+${fmt(point.xp)}` : ''}
                </span>
                <div className="flex h-28 w-full items-end justify-center">
                  <div
                    className={`w-full max-w-[44px] rounded-t-md ${point.xp > 0 ? 'bg-primary-600 dark:bg-primary-400' : 'bg-gray-300 dark:bg-gray-600'}`}
                    style={{ height: point.xp > 0 ? `${height}%` : '2px' }}
                  />
                </div>
                <span className={`mt-1 h-4 max-w-full truncate text-xs text-gray-700 dark:text-gray-300 ${labeled ? '' : 'invisible'}`}>
                  {bucketLabel(point.start, series.bucket)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th scope="col">{week ? 'Semana' : 'Mes'}</th><th scope="col">XP ganado</th></tr></thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.start}><td>{bucketLongLabel(point.start, series.bucket)}</td><td>{point.xp}</td></tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
        {periodLead(period.kind)} ganaste {fmt(totals.xpGained)} XP
      </p>
      {best && (
        <p className={cardText}>
          Tu mejor {week ? 'semana' : 'mes'}: {bucketLongLabel(best.start, series.bucket)} (+{fmt(best.xp)} XP)
        </p>
      )}
    </section>
  );
};
