import { Lock } from 'lucide-react';
import type { BimesterStatus, PerformanceBucket, StudentGradesView } from '../../../lib/gradeApi';
import { cardText, cardTitle, homeCard, rowButton } from '../home/studentHomeHelpers';
import { LEVELS, levelIcon, smallChip, type AdvanceTip } from './gradesHelpers';

/** "Para avanzar": un paso concreto y, como mucho, un botón. */
export const AdvanceCard = ({ tip, onOpen, onPeriod }: { tip: AdvanceTip; onOpen: (competencyId: string) => void; onPeriod: (period: string) => void }) => (
  <section aria-labelledby="advance-title" className={homeCard}>
    <h2 id="advance-title" className={cardTitle}>Para avanzar</h2>
    <p className="mt-2 text-sm text-gray-900 dark:text-white">{tip.text}</p>
    {tip.competencyId && (
      <button type="button" onClick={() => onOpen(tip.competencyId!)} aria-haspopup="dialog" className={`${rowButton} mt-3`}>Ver detalle</button>
    )}
    {tip.period && (
      <button type="button" onClick={() => onPeriod(tip.period!)} className={`${rowButton} mt-3`}>{tip.periodLabel}</button>
    )}
  </section>
);

const VIGESIMAL: Record<PerformanceBucket, string> = { AD: '18–20', A: '14–17', B: '11–13', C: '0–10' };

/** "¿Qué significa cada nivel?": la escala de la clase (en vigesimal, con sus rangos). */
export const ScaleLegendCard = ({ scaleKind }: { scaleKind: StudentGradesView['scaleKind'] }) => (
  <section aria-labelledby="scale-title" className={homeCard}>
    <h2 id="scale-title" className={cardTitle}>¿Qué significa cada nivel?</h2>
    <ul className="mt-2 space-y-2">
      {(['AD', 'A', 'B', 'C'] as PerformanceBucket[]).map((bucket) => {
        const info = LEVELS[bucket];
        const Icon = info.icon;
        return (
          <li key={bucket} className="flex items-start gap-3">
            <span className={`${smallChip} mt-0.5 min-w-[3rem]`}>{scaleKind === 'vigesimal' ? VIGESIMAL[bucket] : bucket}</span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
                <Icon size={16} className={levelIcon} aria-hidden="true" />
                {info.name}
              </p>
              <p className={cardText}>{info.phrase}</p>
            </div>
          </li>
        );
      })}
    </ul>
  </section>
);

type Bimester = BimesterStatus['allBimesters'][number];

const stateOf = (bimester: Bimester) =>
  bimester.isFuture ? 'Aún no' : bimester.isClosed ? 'Final' : bimester.isCurrent ? 'En curso' : 'Avance';

/** Los 4 bimestres con su estado; los futuros, apagados. */
export const BimesterTabs = ({ bimesters, selected, onSelect }: { bimesters: Bimester[]; selected: string; onSelect: (period: string) => void }) => (
  <div className="grid grid-cols-4 gap-1 rounded-2xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800" role="group" aria-label="Bimestres">
    {bimesters.map((bimester) => {
      const active = bimester.period === selected;
      const state = stateOf(bimester);
      return (
        <button
          key={bimester.period}
          type="button"
          disabled={bimester.isFuture}
          aria-pressed={active}
          onClick={() => onSelect(bimester.period)}
          className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl px-1 text-center transition-colors ${
            active
              ? 'bg-primary-600 text-white dark:bg-primary-300 dark:text-gray-900'
              : bimester.isFuture
                ? 'cursor-not-allowed text-gray-600 dark:text-gray-400'
                : 'text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700'
          }`}
        >
          <span className="text-sm font-bold"><span className="hidden sm:inline">Bimestre </span><span className="sm:hidden">B</span>{bimester.period.split('-B')[1]}</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            {bimester.isClosed && <Lock size={11} aria-hidden="true" />}
            {state}
          </span>
        </button>
      );
    })}
  </div>
);

/** Si las notas del bimestre todavía pueden cambiar o ya son finales. */
export const PeriodNotice = ({ isClosed, period }: { isClosed: boolean; period: string }) => (
  <p role="status" className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
    {isClosed
      ? <><span aria-hidden="true">🔒 </span>Notas finales del Bimestre {period.split('-B')[1]}. Ya no cambian.</>
      : <><span aria-hidden="true">📝 </span>Notas de avance: pueden cambiar hasta que tu profe cierre el bimestre.</>}
  </p>
);
