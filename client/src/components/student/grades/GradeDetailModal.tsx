import { Award, Check, ClipboardCheck, Compass, Gamepad2, PenLine, RotateCcw, type LucideIcon } from 'lucide-react';
import { HomeModal } from '../../home/HomeModal';
import { cancelButton } from '../../home/homeHelpers';
import type { StudentCompetencyView, StudentGradeSource } from '../../../lib/gradeApi';
import { cardText } from '../home/studentHomeHelpers';
import { LevelBlock, LevelPath } from './CompetencyCard';
import { detailTip, goodAndBetter, smallChip } from './gradesHelpers';

const SOURCE: Record<Exclude<StudentGradeSource['kind'], 'behaviors'>, { icon: LucideIcon; label: string }> = {
  evaluation: { icon: ClipboardCheck, label: 'Evaluación' },
  activity: { icon: Gamepad2, label: 'Actividad' },
  expedition: { icon: Compass, label: 'Expedición' },
  badge: { icon: Award, label: 'Insignia' },
  teacher: { icon: PenLine, label: 'Registro de tu profe' },
};

const sectionTitle = 'text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300';
const box = 'rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40';

const GoodBetter = ({ positive, negative }: { positive: number; negative: number }) => (
  <span className="inline-flex flex-wrap items-center gap-x-2 text-sm text-gray-800 dark:text-gray-100">
    {positive > 0 && <span className="inline-flex items-center gap-1"><Check size={14} className="text-emerald-700 dark:text-emerald-300" aria-hidden="true" />{goodAndBetter(positive, 0)}</span>}
    {negative > 0 && <span className="inline-flex items-center gap-1"><RotateCcw size={14} className="text-gray-700 dark:text-gray-300" aria-hidden="true" />{goodAndBetter(0, negative)}</span>}
  </span>
);

/** "De dónde sale tu nota": en español, sin porcentajes, pesos ni puntos. */
export const GradeDetailModal = ({ competency, isClosed, onClose }: { competency: StudentCompetencyView; isClosed: boolean; onClose: () => void }) => {
  const tip = isClosed ? null : detailTip(competency);
  const hasSources = competency.skills.length > 0 || competency.sources.length > 0;

  return (
    <HomeModal
      title={competency.shortName || 'Tu competencia'}
      subtitle={competency.shortName ? competency.name ?? undefined : undefined}
      onClose={onClose}
      size="lg"
      footer={<button type="button" onClick={onClose} className={cancelButton} data-autofocus>Cerrar</button>}
    >
      {!competency.shortName && competency.name && <p className="break-words text-base font-bold text-gray-900 dark:text-white">{competency.name}</p>}
      {competency.level && (
        <div className="space-y-3">
          <LevelBlock level={competency.level} />
          <LevelPath level={competency.level} className="max-w-xs" />
        </div>
      )}
      {competency.isManual && <p className={cardText}><span aria-hidden="true">✍️ </span>Tu profe puso esta nota.</p>}
      {competency.lowEvidence && <p className={cardText}><span aria-hidden="true">📝 </span>Aún hay pocas evidencias: tu nota puede cambiar con lo que hagas en clase.</p>}
      {competency.comment && (
        <div className={box}>
          <p className="text-sm font-semibold text-gray-900 dark:text-white"><span aria-hidden="true">💬 </span>Comentario de tu profe</p>
          <p className="mt-1 break-words text-sm text-gray-800 dark:text-gray-100">{competency.comment}</p>
        </div>
      )}
      {competency.conclusion && (
        <div className={box}>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Conclusión de tu profe</p>
          <p className="mt-1 break-words text-sm text-gray-800 dark:text-gray-100">{competency.conclusion}</p>
        </div>
      )}

      <section aria-labelledby="sources-title" className="space-y-2">
        <h3 id="sources-title" className={sectionTitle}>De dónde sale tu nota</h3>
        {!hasSources && <p className={cardText}>{competency.isManual ? 'Tu profe la puso directamente.' : 'Tu profe aún no registra evidencias aquí.'}</p>}
        {competency.skills.length > 0 && (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700" aria-label="Destrezas">
            {competency.skills.map((skill) => (
              <li key={skill.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-gray-900 dark:text-white">{skill.name}</p>
                  {skill.level ? <GoodBetter positive={skill.positive} negative={skill.negative} /> : <p className={cardText}>Aún sin registros</p>}
                </div>
                {skill.level && <span className={smallChip}>{skill.level.label}</span>}
              </li>
            ))}
          </ul>
        )}
        {competency.sources.length > 0 && (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700" aria-label="Lo que cuenta para esta nota">
            {competency.sources.map((source, index) => {
              if (source.kind === 'behaviors') {
                return (
                  <li key={`behaviors-${index}`} className="py-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Lo que registró tu profe en clase</p>
                    {source.items && source.items.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {source.items.map((item) => (
                          <li key={item.name} className="flex items-center gap-1.5 text-sm text-gray-800 dark:text-gray-100">
                            {item.isPositive
                              ? <Check size={14} className="flex-shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                              : <RotateCcw size={14} className="flex-shrink-0 text-gray-700 dark:text-gray-300" aria-hidden="true" />}
                            <span className="sr-only">{item.isPositive ? 'Bien: ' : 'Por mejorar: '}</span>
                            <span className="break-words">{item.name} · {item.count === 1 ? '1 vez' : `${item.count} veces`}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <GoodBetter positive={source.positive ?? 0} negative={source.negative ?? 0} />
                    )}
                  </li>
                );
              }
              const meta = SOURCE[source.kind];
              const Icon = meta.icon;
              return (
                <li key={`${source.kind}-${index}`} className="flex items-start justify-between gap-3 py-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <Icon size={16} className="mt-0.5 flex-shrink-0 text-indigo-700 dark:text-indigo-300" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="break-words text-sm text-gray-900 dark:text-white">
                        <span className="font-semibold">{meta.label}</span>{source.name ? ` «${source.name}»` : ''}
                      </p>
                      {source.comment && <p className="mt-0.5 break-words text-sm text-gray-700 dark:text-gray-300">Tu profe: {source.comment}</p>}
                    </div>
                  </div>
                  {source.level && <span className={smallChip}>{source.level.label}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {tip && (
        <div className="rounded-xl bg-primary-50 p-3 dark:bg-primary-900/30">
          <p className="text-sm font-semibold text-primary-900 dark:text-primary-100">Para avanzar</p>
          <p className="mt-1 text-sm text-gray-900 dark:text-white">{tip}</p>
        </div>
      )}
    </HomeModal>
  );
};
