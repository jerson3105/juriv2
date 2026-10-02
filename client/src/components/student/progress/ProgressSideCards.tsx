import { Check, RotateCcw } from 'lucide-react';
import type { ProgressPeriod, StudentProgress } from '../../../lib/studentApi';
import { cardLink, cardText, cardTitle, homeCard, plural } from '../home/studentHomeHelpers';
import { fmt, periodLead } from './progressHelpers';

const rowItem = 'flex items-start justify-between gap-3';
const rowName = 'flex min-w-0 items-start gap-2 text-sm font-semibold text-gray-900 dark:text-white';
const rowTimes = 'flex-shrink-0 text-sm text-gray-700 dark:text-gray-300';

/** Los dos periodos: el bimestre en curso o todo lo que lleva en la clase. */
export const PeriodToggle = ({ value, onChange }: { value: ProgressPeriod; onChange: (period: ProgressPeriod) => void }) => (
  <div className="grid grid-cols-2 gap-1 rounded-2xl border border-gray-200 bg-white p-1 sm:inline-grid dark:border-gray-700 dark:bg-gray-800" role="group" aria-label="Periodo">
    {(['bimester', 'all'] as const).map((period) => (
      <button
        key={period}
        type="button"
        aria-pressed={value === period}
        onClick={() => onChange(period)}
        className={`min-h-[44px] rounded-xl px-4 text-sm font-bold transition-colors ${
          value === period ? 'bg-primary-600 text-white dark:bg-primary-300 dark:text-gray-900' : 'text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700'
        }`}
      >
        {period === 'bimester' ? 'Este bimestre' : 'Todo el año'}
      </button>
    ))}
  </div>
);

/** Lo que más le reconocen. Sin motivos visibles en la clase, solo cuántas veces. */
export const StrengthsCard = ({ data }: { data: StudentProgress }) => {
  const { behaviors, period } = data;
  return (
    <section aria-labelledby="strengths-title" className={homeCard}>
      <h2 id="strengths-title" className={cardTitle}>En lo que más destacas</h2>
      {behaviors.positiveTimes === 0 ? (
        <p className={`mt-2 ${cardText}`}>Cuando tu profe reconozca algo que haces bien, aparecerá aquí.</p>
      ) : behaviors.namesVisible && behaviors.strengths.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {behaviors.strengths.map((strength) => (
            <li key={strength.name} className={rowItem}>
              <span className={rowName}>
                <Check size={16} className="mt-0.5 flex-shrink-0 text-primary-700 dark:text-primary-300" aria-hidden="true" />
                <span className="break-words">{strength.name}</span>
              </span>
              <span className={rowTimes}>{plural(strength.times, 'vez', 'veces')}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mt-2 ${cardText}`}>{periodLead(period.kind)} tu profe te reconoció {plural(behaviors.positiveTimes, 'vez', 'veces')}.</p>
      )}
    </section>
  );
};

const energyChange = (lost: number, recovered: number) => {
  if (lost > 0 && recovered > 0) return `perdiste ${fmt(lost)} de energía y recuperaste ${fmt(recovered)}`;
  if (lost > 0) return `perdiste ${fmt(lost)} de energía`;
  if (recovered > 0) return `recuperaste ${fmt(recovered)} de energía`;
  return null;
};

/** La energía del periodo y lo que no salió bien (con nombre solo si la clase muestra motivos), en tono neutro. */
export const EnergyCard = ({ data, hp, maxHp, onExplain }: { data: StudentProgress; hp: number; maxHp: number; onExplain: () => void }) => {
  const { totals, behaviors, period } = data;
  const change = energyChange(totals.hpLost, totals.hpRecovered);
  return (
    <section aria-labelledby="energy-title" className={homeCard}>
      <h2 id="energy-title" className={cardTitle}>Tu energía</h2>
      <p className={`mt-2 ${cardText}`}>{hp <= 0 ? 'Ahora estás descansando.' : `Ahora tienes ${fmt(hp)} de ${fmt(maxHp)}.`}</p>
      <p className={cardText}>{change ? `${periodLead(period.kind)} ${change}.` : `${periodLead(period.kind)} tu energía no cambió.`}</p>

      {behaviors.namesVisible && behaviors.toImprove.length > 0 && (
        <div className="mt-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Para mejorar</h3>
          <ul className="mt-2 space-y-2">
            {behaviors.toImprove.map((item) => (
              <li key={item.name} className={rowItem}>
                <span className={rowName}>
                  <RotateCcw size={16} className="mt-0.5 flex-shrink-0 text-gray-700 dark:text-gray-300" aria-hidden="true" />
                  <span className="break-words">{item.name}</span>
                </span>
                <span className={rowTimes}>{plural(item.times, 'vez', 'veces')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" onClick={onExplain} aria-haspopup="dialog" className={`${cardLink} mt-1`}>
        ¿Qué es la energía y cómo se recupera?
      </button>
    </section>
  );
};
