import { TrendingDown, TrendingUp } from 'lucide-react';

type IndicatorEvidenceSplitProps = {
  positiveObservations: number;
  negativeObservations: number;
  positivePoints: number;
  negativePoints: number;
};

export const IndicatorEvidenceSplit = ({
  positiveObservations,
  negativeObservations,
  positivePoints,
  negativePoints,
}: IndicatorEvidenceSplitProps) => {
  const totalObservations = positiveObservations + negativeObservations;

  if (totalObservations <= 0) {
    return null;
  }

  const totalPoints = positivePoints + negativePoints;
  const positiveWidth = totalPoints > 0
    ? (positivePoints / totalPoints) * 100
    : (positiveObservations / totalObservations) * 100;
  const negativeWidth = totalPoints > 0
    ? (negativePoints / totalPoints) * 100
    : (negativeObservations / totalObservations) * 100;

  // Texto AA (14 px, tonos -800/-300); la barra es decorativa y el texto la describe.
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-300">
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
          <span>{positiveObservations} {positiveObservations === 1 ? 'positiva' : 'positivas'}</span>
          {positivePoints > 0 && <span className="font-normal">(+{positivePoints} pts)</span>}
        </span>
        <span className="flex items-center gap-1 font-semibold text-red-800 dark:text-red-300">
          <span>{negativeObservations} {negativeObservations === 1 ? 'negativa' : 'negativas'}</span>
          {negativePoints > 0 && <span className="font-normal">(−{negativePoints} pts)</span>}
          <TrendingDown className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
        <div className="bg-emerald-600 dark:bg-emerald-400" style={{ width: `${positiveWidth}%` }} />
        <div className="bg-red-600 dark:bg-red-400" style={{ width: `${negativeWidth}%` }} />
      </div>
    </div>
  );
};