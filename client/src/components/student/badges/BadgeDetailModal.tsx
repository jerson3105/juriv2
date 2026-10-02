import { Archive, Award, Gem, Hand, Repeat } from 'lucide-react';
import { RARITY_LABELS, type BadgeToEarn, type EarnedBadge } from '../../../lib/badgeApi';
import { HomeModal } from '../../home/HomeModal';
import { cancelButton } from '../../home/homeHelpers';
import { BadgeMedallion } from '../../badges/BadgeMedallion';
import { RARITY_STYLE } from '../../badges/badgeHelpers';
import { cardText } from '../home/studentHomeHelpers';
import { awardWho, awardWhy, howText, progressFill, progressText, rewardText, savingsTrack, shortDate, sinceText } from './badgeStudentHelpers';

export type BadgeDetail = { kind: 'earned'; badge: EarnedBadge } | { kind: 'toEarn'; badge: BadgeToEarn };

const noteRow = 'flex items-start gap-2 text-sm text-gray-800 dark:text-gray-100';

/**
 * Detalle de una insignia: el porqué (si la ganó) o el cómo (si no), las fechas, lo que reconoce y,
 * al final, lo que da (el XP y el oro van en segundo plano; para pequeños no se muestran).
 */
export const BadgeDetailModal = ({ detail, young, onClose }: { detail: BadgeDetail; young: boolean; onClose: () => void }) => {
  const { badge } = detail;
  const earned = detail.kind === 'earned' ? detail.badge : null;
  const toEarn = detail.kind === 'toEarn' ? detail.badge : null;
  const reward = earned
    ? rewardText({ xp: earned.awards.reduce((sum, award) => sum + award.xp, 0), gp: earned.awards.reduce((sum, award) => sum + award.gp, 0) }, true)
    : rewardText(toEarn!.reward, false);

  const footer = <button type="button" onClick={onClose} className={cancelButton} data-autofocus>Cerrar</button>;

  return (
    <HomeModal title={badge.name} subtitle={earned ? 'Ya la tienes' : 'Puedes ganarla'} onClose={onClose} footer={footer}>
      <div className={`flex flex-col items-center rounded-2xl border-2 bg-gradient-to-b to-white p-4 text-center dark:to-gray-800 ${earned ? RARITY_STYLE[badge.rarity].tile : 'border-dashed border-gray-300 from-gray-50 dark:border-gray-600 dark:from-gray-900/40'}`}>
        <BadgeMedallion badge={badge} size="lg" dimmed={!earned} />
        <span className={`mt-3 rounded-full px-2.5 py-0.5 text-xs font-bold ${RARITY_STYLE[badge.rarity].chip}`}>{RARITY_LABELS[badge.rarity]}</span>
        {earned?.isSecret && <span className="mt-1 text-xs font-semibold text-gray-800 dark:text-gray-100">Secreta descubierta</span>}
        {badge.description && <p className={`${cardText} mt-2`}>{badge.description}</p>}
      </div>

      {earned ? (
        <section aria-label="Por qué la tienes" className="space-y-2">
          {earned.count > 1 && <p className="text-sm font-bold text-gray-900 dark:text-white">La ganaste {earned.count} veces</p>}
          <ul className="space-y-2">
            {earned.awards.map((award) => (
              <li key={award.at} className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{awardWhy(award, earned)}</p>
                <p className={cardText}>
                  {[awardWho(award), shortDate(award.at)].filter(Boolean).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section aria-label="Cómo ganarla" className="space-y-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{howText(toEarn!)}</p>
          {toEarn!.progress && toEarn!.percent !== null && (
            <div>
              <div
                role="progressbar"
                aria-label={`Progreso hacia «${badge.name}»`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={toEarn!.percent}
                aria-valuetext={progressText(toEarn!.progress)}
                className={savingsTrack}
              >
                <div className={progressFill} style={{ width: `${toEarn!.percent}%` }} />
              </div>
              <p className={`${cardText} mt-1`}>
                {[progressText(toEarn!.progress), young ? null : sinceText(toEarn!.progress)].filter(Boolean).join(' · ')}
              </p>
            </div>
          )}
        </section>
      )}

      <div className="space-y-1.5">
        {badge.competency && (
          <p className={noteRow}><Award size={16} className="mt-0.5 flex-shrink-0 text-violet-700 dark:text-violet-300" aria-hidden="true" />Reconoce: {badge.competency}</p>
        )}
        {badge.cumulative && (
          <p className={noteRow}><Repeat size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />Tu profe puede dártela más de una vez.</p>
        )}
        {toEarn?.kind === 'TEACHER' && !badge.description && (
          <p className={noteRow}><Hand size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />Pregúntale a tu profe qué necesitas para ganarla.</p>
        )}
        {earned?.archived && (
          <p className={noteRow}><Archive size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />Ya no se entrega. Lo que ganaste se queda.</p>
        )}
        {!young && reward && (
          <p className={noteRow}><Gem size={16} className="mt-0.5 flex-shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />{reward}</p>
        )}
      </div>
    </HomeModal>
  );
};
