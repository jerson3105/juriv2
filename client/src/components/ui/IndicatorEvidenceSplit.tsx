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

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Positivos: {positiveObservations}</span>
          {positivePoints > 0 && (
            <span className="text-[10px] text-emerald-500/80 dark:text-emerald-300/80">
              (+{positivePoints} pts)
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 font-medium text-red-500 dark:text-red-400">
          <span>Negativos: {negativeObservations}</span>
          {negativePoints > 0 && (
            <span className="text-[10px] text-red-400/80 dark:text-red-300/80">
              (-{negativePoints} pts)
            </span>
          )}
          <TrendingDown className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="bg-emerald-400 transition-all"
          style={{ width: `${positiveWidth}%` }}
        />
        <div
          className="bg-red-400 transition-all"
          style={{ width: `${negativeWidth}%` }}
        />
      </div>
    </div>
  );
};