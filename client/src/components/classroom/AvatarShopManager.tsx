import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Coins, EyeOff, Info, RefreshCw, Shirt } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  avatarApi,
  avatarImageUrl,
  type AvatarGender,
  type AvatarPriceLevel,
  type TeacherAvatarCatalog,
  type TeacherCatalogCollection,
  type TeacherCatalogItem,
} from '../../lib/avatarApi';
import { SHOP_RARITY_STYLE } from '../shop/shopHelpers';
import { Switch, SwitchRow } from '../settings/settingsUi';
import { BODY_LABEL, PRENDA_RARITY, PRICE_LEVELS, SLOT_NAMES, avatarCatalogKey, gold } from '../avatar/avatarHelpers';

const errorText = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const card = 'rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-5';
const segment = (active: boolean) =>
  `min-h-[40px] rounded-lg px-3 text-sm font-semibold transition-colors ${
    active ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
  }`;
const smallButton = 'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';

type BodyFilter = 'ALL' | AvatarGender;

/**
 * Tienda de avatar del docente: el catálogo llega solo a la clase con precios según el oro que ganan
 * sus estudiantes. Aquí solo se marcan excepciones (ocultar una colección o una prenda, precio propio)
 * y, si tiene varias clases, se aplican a todas de una vez.
 */
export const AvatarShopManager = ({ classroomId }: { classroomId: string }) => {
  const queryClient = useQueryClient();
  const { data: catalog, isLoading, isError, refetch } = useQuery({
    queryKey: avatarCatalogKey(classroomId),
    queryFn: () => avatarApi.getTeacherCatalog(classroomId),
  });
  const [applyAll, setApplyAll] = useState(true);
  const [body, setBody] = useState<BodyFilter>('ALL');
  const [open, setOpen] = useState<string | null>(null);
  const applyId = useId();

  const applyTo = applyAll ? (catalog?.otherClassrooms ?? []).map((other) => other.id) : [];
  const alsoText = applyTo.length ? ` (y en ${applyTo.length === 1 ? 'tu otra clase' : `tus otras ${applyTo.length} clases`})` : '';
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['avatar-catalog'] });
  };

  const settings = useMutation({
    mutationFn: (patch: { enabled?: boolean; priceLevel?: AvatarPriceLevel; refreshPrices?: boolean }) =>
      avatarApi.updateSettings(classroomId, { ...patch, applyTo }),
    onSuccess: (_data, patch) => {
      refresh();
      if (patch.enabled !== undefined) toast.success(`${patch.enabled ? 'Tienda de avatar activada' : 'Tienda de avatar desactivada'}${alsoText}`);
      else if (patch.refreshPrices) toast.success(`Precios actualizados con el oro de ahora${alsoText}`);
      else toast.success(`Precios guardados${alsoText}`);
    },
    onError: (error) => toast.error(errorText(error, 'No se pudo guardar')),
  });
  const collection = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean; name: string }) => avatarApi.setCollectionHidden(classroomId, id, hidden, applyTo),
    onSuccess: (_data, { hidden, name }) => {
      refresh();
      toast.success(`${hidden ? `«${name}» ya no aparece en tu tienda` : `«${name}» vuelve a tu tienda`}${alsoText}`);
    },
    onError: (error) => toast.error(errorText(error, 'No se pudo cambiar la colección')),
  });
  const item = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { hidden?: boolean; price?: number | null }; name: string }) =>
      avatarApi.setItemException(classroomId, id, { ...patch, applyTo }),
    onSuccess: (_data, { patch, name }) => {
      refresh();
      const text = patch.hidden !== undefined
        ? patch.hidden ? `«${name}» oculta` : `«${name}» visible otra vez`
        : patch.price === null ? `«${name}» vuelve al precio calculado` : `«${name}» cuesta ${gold(patch.price ?? 0)}`;
      toast.success(`${text}${alsoText}`);
    },
    onError: (error) => toast.error(errorText(error, 'No se pudo cambiar la prenda')),
  });

  if (isLoading) {
    return (
      <div role="status" aria-label="Cargando la tienda de avatar" className="space-y-4">
        <div className="h-48 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
        <div className="h-24 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
      </div>
    );
  }
  if (isError || !catalog) {
    return (
      <div className={`${card} text-center`}>
        <p className="text-sm text-gray-800 dark:text-gray-100">No pudimos cargar la tienda de avatar.</p>
        <button type="button" onClick={() => void refetch()} className={`${smallButton} mt-3`}>Reintentar</button>
      </div>
    );
  }

  const { settings: current, prices, economy } = catalog;
  const nowWeekly = economy.weeklyNow;
  const fixed = !!current.pricesAt;
  const busy = settings.isPending;

  return (
    <div className="space-y-5">
      <section aria-labelledby="avatar-shop-title" className={card}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300" aria-hidden="true">
            <Shirt size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="avatar-shop-title" className="text-base font-bold text-gray-900 dark:text-white">Tienda de avatar</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Las prendas del catálogo llegan solas a tu clase, con precios según el oro que ganan tus estudiantes. Tú solo decides qué ocultar.
            </p>
          </div>
        </div>

        <div className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
          <SwitchRow
            title="Tienda de avatar activada"
            description={current.enabled ? 'Tus estudiantes compran prendas con su oro.' : 'Se visten con lo que ya tienen, pero no compran.'}
            checked={current.enabled}
            onChange={(enabled) => settings.mutate({ enabled })}
            disabled={busy}
          />

          <div className="py-3">
            <p id="avatar-price-level" className="text-sm font-semibold text-gray-900 dark:text-white">Precios</p>
            <div className="mt-2 flex w-fit flex-wrap gap-1 rounded-xl border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-gray-800" role="radiogroup" aria-labelledby="avatar-price-level">
              {PRICE_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  role="radio"
                  aria-checked={current.priceLevel === level.value}
                  disabled={busy}
                  onClick={() => current.priceLevel !== level.value && settings.mutate({ priceLevel: level.value })}
                  className={segment(current.priceLevel === level.value)}
                >
                  {level.label}
                </button>
              ))}
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-800 dark:text-gray-200">
              <Coins size={16} className="text-amber-600 dark:text-amber-300" aria-hidden="true" />
              <span>Común <strong>{gold(prices.COMMON)}</strong></span>
              <span>· Rara <strong>{gold(prices.RARE)}</strong></span>
              <span>· Legendaria <strong>{gold(prices.LEGENDARY)}</strong></span>
            </p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {fixed
                ? `Calculados con ${gold(current.priceBase)} por semana (${new Date(current.pricesAt!).toLocaleDateString('es', { day: 'numeric', month: 'short' })})${nowWeekly !== current.priceBase ? `. Ahora ganan unos ${gold(nowWeekly)} por semana.` : '.'}`
                : `Según lo que ganan ahora: unos ${gold(current.priceBase)} por semana. Siguen el oro de la clase hasta que tenga 3 semanas de actividad; después quedan fijos.`}
            </p>
            {fixed && nowWeekly !== current.priceBase && (
              <button type="button" onClick={() => settings.mutate({ refreshPrices: true })} disabled={busy} className={`${smallButton} mt-2`}>
                <RefreshCw size={16} aria-hidden="true" />
                Actualizar precios
              </button>
            )}
            {!economy.behaviorsGiveGold && (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-900 dark:text-amber-200">
                <Info size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                Tus comportamientos no dan oro: así tus estudiantes no podrán comprar.
              </p>
            )}
            {!current.shopEnabled && (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-900 dark:text-amber-200">
                <Info size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                La tienda de la clase está cerrada: mientras tanto tampoco se compran prendas.
              </p>
            )}
          </div>

          {catalog.otherClassrooms.length > 0 && (
            <label htmlFor={applyId} className="flex cursor-pointer items-start gap-3 py-3">
              <input
                id={applyId}
                type="checkbox"
                checked={applyAll}
                onChange={(event) => setApplyAll(event.target.checked)}
                className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-gray-400 text-primary-600 focus:ring-primary-500"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">Aplicar los cambios también a mis otras clases</span>
                <span className="block text-sm text-gray-700 dark:text-gray-300">{catalog.otherClassrooms.map((other) => other.name).join(', ')}</span>
              </span>
            </label>
          )}
        </div>
      </section>

      {catalog.collections.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-10 text-center dark:border-gray-600 dark:bg-gray-800/60">
          <div className="mx-auto flex w-fit gap-3 text-4xl" aria-hidden="true"><span>👕</span><span>🧢</span><span>👟</span></div>
          <h2 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">Aún no hay prendas en el catálogo</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">Cuando Juried publique prendas, llegarán solas a tu tienda.</p>
        </div>
      ) : (
        <section aria-labelledby="avatar-collections-title" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="avatar-collections-title" className="text-base font-bold text-gray-900 dark:text-white">Colecciones</h2>
            <div className="flex rounded-xl border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-gray-800" role="group" aria-label="Cuerpo">
              {([['ALL', 'Todas'], ['MALE', 'Chico'], ['FEMALE', 'Chica']] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={body === value} onClick={() => setBody(value)} className={segment(body === value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {catalog.collections.map((entry) => (
            <CollectionCard
              key={entry.id || 'loose'}
              collection={entry}
              body={body}
              open={open === (entry.id || 'loose')}
              onToggleOpen={() => setOpen(open === (entry.id || 'loose') ? null : entry.id || 'loose')}
              onToggleHidden={(hidden) => collection.mutate({ id: entry.id, hidden, name: entry.name })}
              busy={collection.isPending || item.isPending}
              onItem={(target, patch) => item.mutate({ id: target.id, patch, name: target.name })}
              catalog={catalog}
            />
          ))}
        </section>
      )}
    </div>
  );
};

interface CollectionCardProps {
  collection: TeacherCatalogCollection;
  body: BodyFilter;
  open: boolean;
  busy: boolean;
  catalog: TeacherAvatarCatalog;
  onToggleOpen: () => void;
  onToggleHidden: (hidden: boolean) => void;
  onItem: (item: TeacherCatalogItem, patch: { hidden?: boolean; price?: number | null }) => void;
}

const CollectionCard = ({ collection, body, open, busy, onToggleOpen, onToggleHidden, onItem }: CollectionCardProps) => {
  const titleId = useId();
  const items = collection.items.filter((entry) => body === 'ALL' || entry.gender === body);
  const hiddenCount = collection.items.filter((entry) => entry.hidden).length;
  const boys = collection.items.filter((entry) => entry.gender === 'MALE').length;
  const girls = collection.items.length - boys;

  return (
    <article aria-labelledby={titleId} className={card}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-base font-bold text-gray-900 dark:text-white">{collection.name}</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {collection.items.length} prendas · {boys} de chico · {girls} de chica
            {hiddenCount > 0 && ` · ${hiddenCount} ${hiddenCount === 1 ? 'oculta' : 'ocultas'}`}
          </p>
          {collection.description && <p className="text-sm text-gray-700 dark:text-gray-300">{collection.description}</p>}
        </div>
        {collection.id && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{collection.hidden ? 'Oculta' : 'En tu tienda'}</span>
            <Switch checked={!collection.hidden} onChange={(visible) => onToggleHidden(!visible)} disabled={busy} label={`Mostrar «${collection.name}» en tu tienda`} />
          </div>
        )}
        <button type="button" onClick={onToggleOpen} aria-expanded={open} className={smallButton}>
          {open ? 'Ocultar prendas' : 'Ver prendas'}
          <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <>
          {collection.hidden && (
            <p className="mt-3 rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-800 dark:bg-gray-700/60 dark:text-gray-100">
              La colección está oculta: tus estudiantes no ven estas prendas en la tienda (las que ya compraron las conservan).
            </p>
          )}
          {items.length === 0 ? (
            <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">No hay prendas para este cuerpo en esta colección.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {items.map((entry) => <ItemTile key={entry.id} item={entry} dimmed={collection.hidden} busy={busy} onItem={onItem} />)}
            </ul>
          )}
        </>
      )}
    </article>
  );
};

const ItemTile = ({ item, dimmed, busy, onItem }: {
  item: TeacherCatalogItem;
  dimmed: boolean;
  busy: boolean;
  onItem: (item: TeacherCatalogItem, patch: { hidden?: boolean; price?: number | null }) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(item.price));
  const inputId = useId();
  const style = SHOP_RARITY_STYLE[item.rarity];
  const parsed = Number(draft);
  const valid = draft.trim() !== '' && Number.isInteger(parsed) && parsed >= 0 && parsed <= 100000;

  return (
    <li className={`flex flex-col rounded-xl border-2 bg-white p-3 dark:bg-gray-800 ${style.card} ${item.hidden || dimmed ? 'opacity-70' : ''}`}>
      <div className={`relative flex h-28 items-center justify-center rounded-lg bg-gradient-to-b ${style.window}`}>
        <img src={avatarImageUrl(item.imagePath, 'thumb')} alt="" loading="lazy" decoding="async" className="max-h-24 max-w-[80%] object-contain" />
        {item.isNew && <span className="absolute left-2 top-2 rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white">Nueva</span>}
        {item.hidden && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-gray-900/85 px-2 py-0.5 text-xs font-semibold text-white">
            <EyeOff size={12} aria-hidden="true" />
            Oculta
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-bold text-gray-900 dark:text-white" title={item.name}>{item.name}</p>
      <p className="mt-0.5 flex flex-wrap gap-1 text-xs">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-800 dark:bg-gray-700 dark:text-gray-100">{BODY_LABEL[item.gender]}</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${style.chip}`}>{PRENDA_RARITY[item.rarity]}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-800 dark:bg-gray-700 dark:text-gray-100">{SLOT_NAMES[item.slot]}</span>
      </p>
      <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
        <strong>{gold(item.price)}</strong>
        {item.customPrice !== null && <span className="text-gray-700 dark:text-gray-300"> · precio tuyo</span>}
      </p>

      {editing ? (
        <form
          className="mt-2 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid) return;
            onItem(item, { price: parsed });
            setEditing(false);
          }}
        >
          <label htmlFor={inputId} className="block text-sm font-semibold text-gray-900 dark:text-white">Precio en esta clase</label>
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={0}
            max={100000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!valid || busy} className="inline-flex min-h-[40px] items-center rounded-lg bg-primary-600 px-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60">Guardar</button>
            {item.customPrice !== null && (
              <button type="button" disabled={busy} onClick={() => { onItem(item, { price: null }); setEditing(false); }} className={smallButton}>
                Usar el calculado
              </button>
            )}
            <button type="button" onClick={() => setEditing(false)} className={smallButton}>Cancelar</button>
          </div>
        </form>
      ) : (
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <button type="button" disabled={busy} onClick={() => onItem(item, { hidden: !item.hidden })} aria-pressed={item.hidden} className={smallButton}>
            {item.hidden ? 'Mostrar' : 'Ocultar'}
          </button>
          <button type="button" onClick={() => { setDraft(String(item.price)); setEditing(true); }} className={smallButton}>
            Cambiar precio
          </button>
        </div>
      )}
    </li>
  );
};

export default AvatarShopManager;
