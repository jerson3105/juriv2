import type { StudentAvatarView } from '../../../lib/avatarApi';
import { HomeEmptyState } from '../../student/home/HomeEmptyState';
import { groupTitle } from '../../student/shop/shopStudentHelpers';
import { ClosetCard, NoneCard } from './ClosetCard';
import { FILTERS, ZONES, groupItems, isForSale, isGiftable, spendableOf, type ClosetFilter, type ZoneKey } from './closetHelpers';
import type { Closet } from './useCloset';

interface ClosetWardrobeProps {
  view: StudentAvatarView;
  closet: Closet;
  filter: ClosetFilter;
  onFilter: (filter: ClosetFilter) => void;
  zone: ZoneKey | null;
  onZone: (zone: ZoneKey) => void;
}

// Madera cálida: marco, repisas y placas; interior claro (en oscuro, gris). La placa: 14:1 y 13:1.
const plaque = 'inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1 font-black text-amber-950 shadow-sm ring-1 ring-amber-950/15 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-100/20';
const shelf = 'my-4 h-2.5 rounded-full bg-amber-800 shadow-[0_2px_0_rgba(0,0,0,0.15)] dark:bg-amber-900';
const tab = 'inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold transition-colors';
const youngTab = 'flex min-h-[64px] min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-2 text-sm font-bold transition-colors';
const tabOn = 'border-amber-800 bg-amber-800 text-white dark:border-amber-500 dark:bg-amber-500 dark:text-amber-950';
const tabOff = 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';
// Puertas abiertas a los lados (desde lg): dibujo fijo, sin animación.
const door = 'pointer-events-none absolute inset-y-8 hidden w-8 bg-amber-700 dark:bg-amber-900 lg:block';

/**
 * El clóset: compartimentos que siguen al cuerpo (cabeza en la repisa alta, ropa colgada, zapatero, cajones
 * de accesorios y el telón de los fondos). Lo que se vende cuelga junto a lo suyo con su etiqueta de precio.
 * En 375 px (y siempre para los pequeños) se ve un compartimento a la vez.
 */
export const ClosetWardrobe = ({ view, closet, filter, onFilter, zone, onZone }: ClosetWardrobeProps) => {
  const { young } = view;
  const spendable = spendableOf(view);
  const forSaleCount = view.items.filter((item) => isForSale(item, view)).length;
  const showFilter = !young && forSaleCount > 0;
  const current = showFilter ? filter : 'all';
  const goalId = view.goal?.kind === 'AVATAR' ? view.goal.itemId : null;

  const zones = ZONES
    .map((entry) => ({
      zone: entry,
      groups: entry.groups
        .map((group) => ({ group, ...groupItems(view.items, group, view, current) }))
        // «Sin sombrero» solo acompaña a prendas: un cajón sin prendas no se muestra.
        .filter((group) => group.items.length > 0),
    }))
    .filter((entry) => entry.groups.length > 0);
  const active = zones.find((entry) => entry.zone.key === zone)?.zone.key ?? zones[0]?.zone.key ?? null;

  return (
    <section aria-labelledby="closet-title" className="relative lg:mx-9">
      <span className={`${door} -left-8 rounded-l-xl [clip-path:polygon(0_7%,100%_0,100%_100%,0_93%)]`} aria-hidden="true">
        <span className="absolute right-2 top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-full bg-amber-300" />
      </span>
      <span className={`${door} -right-8 rounded-r-xl [clip-path:polygon(0_0,100%_7%,100%_93%,0_100%)]`} aria-hidden="true">
        <span className="absolute left-2 top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-full bg-amber-300" />
      </span>

      <div className="rounded-3xl bg-amber-800 p-1.5 shadow-md dark:bg-amber-900 sm:p-2.5">
        <div className="flex justify-center pb-2 pt-1">
          <h2 id="closet-title" className={`${plaque} text-base`}>Tu clóset</h2>
        </div>
        <div className="rounded-2xl bg-stone-50 p-2.5 dark:bg-gray-900 sm:p-4">
          {(showFilter || zones.length > 1) && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {zones.length > 1 && (
                <div role="group" aria-label="Partes del clóset" className={`flex flex-wrap gap-2 ${young ? 'w-full' : 'md:hidden'}`}>
                  {zones.map(({ zone: entry }) => (
                    <button
                      key={entry.key}
                      type="button"
                      aria-pressed={entry.key === active}
                      onClick={() => onZone(entry.key)}
                      className={`${young ? youngTab : tab} ${entry.key === active ? tabOn : tabOff}`}
                    >
                      <span className={young ? 'text-2xl leading-none' : ''} aria-hidden="true">{entry.emoji}</span>
                      {young ? entry.short : entry.label}
                    </button>
                  ))}
                </div>
              )}
              {showFilter && (
                <div className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800 sm:w-auto" role="group" aria-label="Qué ver">
                  {FILTERS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={current === option.value}
                      onClick={() => onFilter(option.value)}
                      className={`min-h-[44px] rounded-xl px-3 text-sm font-bold transition-colors ${
                        current === option.value ? 'bg-primary-600 text-white dark:bg-primary-300 dark:text-gray-900' : 'text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {zones.length === 0 && (
            <div className="mt-4">
              <HomeEmptyState
                emojis={['👕', '🧢', '👟']}
                title="Aún no hay prendas en la tienda"
                text="Cuando haya, aquí podrás probártelas y comprarlas con tu oro."
                primary={{ label: 'Ver todo mi clóset', onClick: () => onFilter('all') }}
              />
            </div>
          )}

          {zones.map(({ zone: entry, groups }, index) => (
            <div key={entry.key} className={entry.key === active ? '' : young ? 'hidden' : 'hidden md:block'}>
              {index > 0 && <div className={young ? 'hidden' : `${shelf} hidden md:block`} aria-hidden="true" />}
              <section aria-labelledby={`zone-${entry.key}`} className={index === 0 || young ? 'mt-4' : 'mt-4 md:mt-0'}>
                {entry.key === 'backgrounds' && (
                  // Telón de los fondos
                  <div className="mb-2 h-3 rounded-t-lg bg-[repeating-linear-gradient(90deg,#a21caf_0_8px,#86198f_8px_16px)]" aria-hidden="true" />
                )}
                <h3 id={`zone-${entry.key}`} className={`${plaque} text-sm`}>
                  <span aria-hidden="true">{entry.emoji}</span>
                  {entry.label}
                </h3>
                {groups.map(({ group, none, items }) => {
                  const drawer = entry.key === 'extras';
                  const count = items.length;
                  return (
                    <div
                      key={group.key}
                      className={drawer
                        ? 'relative mt-4 rounded-2xl border-2 border-amber-800/30 bg-amber-100/50 p-2.5 pt-5 dark:border-amber-700/40 dark:bg-amber-950/30'
                        : 'mt-4'}
                    >
                      {drawer && <span className="absolute left-1/2 top-1.5 h-1.5 w-12 -translate-x-1/2 rounded-full bg-amber-800/70 dark:bg-amber-600/70" aria-hidden="true" />}
                      <h4 className={groupTitle}>{group.label}{count > 0 ? ` · ${count}` : ''}</h4>
                      {entry.key === 'clothes' && <div className="mt-2 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" aria-hidden="true" />}
                      <ul className={`mt-2 grid gap-3 ${young ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4' : 'grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]'}`}>
                        {none && (
                          <NoneCard
                            label={group.none!}
                            worn={group.slots.every((slot) => !closet.worn(slot))}
                            young={young}
                            onSelect={() => closet.selectNone(group)}
                          />
                        )}
                        {items.map((item) => {
                          const forSale = isForSale(item, view);
                          return (
                            <ClosetCard
                              key={item.id}
                              item={item}
                              worn={closet.worn(item.slot)?.id === item.id}
                              trying={closet.tryOn.get(item.slot)?.id === item.id}
                              forSale={forSale}
                              giftable={isGiftable(item, view)}
                              missing={forSale ? Math.max(0, item.price! - spendable) : 0}
                              isGoal={item.id === goalId}
                              hanger={entry.key === 'clothes'}
                              young={young}
                              onSelect={() => closet.select(item)}
                            />
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </section>
            </div>
          ))}
        </div>
        <div className="mx-6 h-2 rounded-b-xl bg-amber-900/70 dark:bg-amber-950" aria-hidden="true" />
      </div>
    </section>
  );
};
