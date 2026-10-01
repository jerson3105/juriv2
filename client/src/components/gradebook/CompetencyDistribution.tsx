import type { PerformanceBucket } from '../../lib/gradeApi';
import { BUCKET_LABEL, BUCKET_STYLE } from './gradebookHelpers';

export interface DistributionRow {
  id: string;
  code: string;
  title: string;
  counts: Record<PerformanceBucket, number>;
  missing: number;
  /** Destreza dentro de la competencia anterior (se muestra sangrada). */
  nested?: boolean;
}

const BUCKETS: PerformanceBucket[] = ['AD', 'A', 'B', 'C'];

// Distribución de niveles por competencia: barra apilada con letra y cantidad visibles + tabla equivalente.
export const CompetencyDistribution = ({ rows, caption }: { rows: DistributionRow[]; caption: string }) => {
  const weakest = [...rows.filter((r) => !r.nested)]
    .map((r) => ({ r, total: BUCKETS.reduce((n, b) => n + r.counts[b], 0) }))
    .filter((x) => x.total > 0)
    .sort((a, b) => (b.r.counts.C + b.r.counts.B) / b.total - (a.r.counts.C + a.r.counts.B) / a.total)[0];
  return (
    <figure className="space-y-3">
      <figcaption className="text-sm text-gray-800 dark:text-gray-100">
        {caption}
        {weakest && ` La competencia con más alumnos en proceso o en inicio es ${weakest.r.code} ${weakest.r.title}.`}
      </figcaption>
      <ul className="space-y-3">
        {rows.map((row) => {
          const total = BUCKETS.reduce((n, b) => n + row.counts[b], 0) + row.missing;
          return (
            <li key={row.id} className={row.nested ? 'pl-5' : ''}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className={row.nested ? 'text-gray-800 dark:text-gray-100' : 'font-semibold text-gray-900 dark:text-white'}>
                  <span className="text-gray-700 dark:text-gray-300">{row.code}</span> {row.title}
                </span>
                {row.missing > 0 && <span className="flex-shrink-0 text-gray-700 dark:text-gray-300">{row.missing} sin nota</span>}
              </div>
              {total === 0 ? (
                <p className="text-sm text-gray-700 dark:text-gray-300">Sin alumnos.</p>
              ) : (
                <div className="flex h-8 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700" aria-hidden="true">
                  {BUCKETS.filter((b) => row.counts[b] > 0).map((b) => (
                    <span key={b} style={{ width: `${(row.counts[b] / total) * 100}%` }}
                      className={`flex min-w-[2.25rem] items-center justify-center border-r-2 border-white text-sm font-bold last:border-r-0 dark:border-gray-800 ${BUCKET_STYLE[b]}`}>
                      {b} {row.counts[b]}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <details className="text-sm">
        <summary className="min-h-[44px] cursor-pointer py-2 font-semibold text-primary-800 dark:text-primary-200">Ver como tabla</summary>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th scope="col" className="py-2 pr-3 font-bold text-gray-900 dark:text-white">Competencia</th>
                {BUCKETS.map((b) => <th key={b} scope="col" className="px-2 py-2 text-center font-bold text-gray-900 dark:text-white" title={BUCKET_LABEL[b]}>{b}</th>)}
                <th scope="col" className="px-2 py-2 text-center font-bold text-gray-900 dark:text-white">Sin nota</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 dark:border-gray-700">
                  <th scope="row" className={`py-2 pr-3 font-normal text-gray-900 dark:text-white ${row.nested ? 'pl-4' : ''}`}>{row.code} {row.title}</th>
                  {BUCKETS.map((b) => <td key={b} className="px-2 py-2 text-center tabular-nums text-gray-900 dark:text-white">{row.counts[b]}</td>)}
                  <td className="px-2 py-2 text-center tabular-nums text-gray-900 dark:text-white">{row.missing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
};
