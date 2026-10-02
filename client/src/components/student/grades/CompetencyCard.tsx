import { MessageCircle, PenLine } from 'lucide-react';
import type { StudentCompetencyView, StudentLevel } from '../../../lib/gradeApi';
import { cardText, homeCard, rowButton } from '../home/studentHomeHelpers';
import { LEVELS, PATH, evidenceLine, levelChip, levelIcon, noteChip } from './gradesHelpers';

/** El camino de 4 pasos (C → AD): muestra lo recorrido. Decorativo: el nivel ya se dice con texto. */
export const LevelPath = ({ level, className = '' }: { level: StudentLevel; className?: string }) => {
  const step = LEVELS[level.bucket].step;
  return (
    <div className={`grid grid-cols-4 gap-1 ${className}`} aria-hidden="true">
      {PATH.map((bucket, index) => (
        <div key={bucket} className="min-w-0">
          <p className={`text-center text-xs ${index + 1 === step ? 'font-black text-gray-900 dark:text-white' : 'font-semibold text-gray-700 dark:text-gray-300'}`}>{bucket}</p>
          <div className={`mt-1 h-2 rounded-full ${index < step ? 'bg-primary-600 dark:bg-primary-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
        </div>
      ))}
    </div>
  );
};

/** Letra (o número), ícono, nombre oficial del nivel y su frase. */
export const LevelBlock = ({ level }: { level: StudentLevel }) => {
  const info = LEVELS[level.bucket];
  const Icon = info.icon;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={levelChip}>{level.label}</span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-base font-bold text-gray-900 dark:text-white">
          <Icon size={18} className={levelIcon} aria-hidden="true" />
          {info.name}
        </p>
        <p className={cardText}>{info.phrase}</p>
      </div>
    </div>
  );
};

/** Una competencia con nota: nombre completo (nunca cortado), nivel, camino y de dónde sale. */
export const CompetencyCard = ({ competency, onOpen }: { competency: StudentCompetencyView; onOpen: () => void }) => {
  const level = competency.level!;
  const titleId = `competency-${competency.id}`;
  return (
    <article aria-labelledby={titleId} className={homeCard}>
      {competency.shortName && competency.shortName !== competency.name && (
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">{competency.shortName}</p>
      )}
      <h3 id={titleId} className="mt-0.5 break-words text-base font-bold text-gray-900 dark:text-white">{competency.name}</h3>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <LevelBlock level={level} />
        <LevelPath level={level} className="w-full sm:ml-auto sm:w-56" />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={cardText}>{evidenceLine(competency)}</span>
          {competency.lowEvidence && <span className={noteChip}>Pocas evidencias aún</span>}
          {competency.isManual && <span className={noteChip}><PenLine size={12} aria-hidden="true" />Nota de tu profe</span>}
          {competency.comment && <span className={noteChip}><MessageCircle size={12} aria-hidden="true" />Tu profe te dejó un comentario</span>}
        </div>
        <button type="button" onClick={onOpen} aria-haspopup="dialog" className={`${rowButton} max-sm:w-full max-sm:justify-center`}>
          Ver de dónde sale
        </button>
      </div>
    </article>
  );
};
