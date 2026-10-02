import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock3, Gift } from 'lucide-react';
import { GIFT_PHRASES, shopApi, type GiftPhraseKey, type StudentShopItem, type StudentShopOwned, type StudentShopView } from '../../../lib/shopApi';
import { useCharacterClasses } from '../../../hooks/useCharacterClasses';
import { HomeModal } from '../../home/HomeModal';
import { cancelButton, errorMessage, inputClass, labelClass, primaryButton } from '../../home/homeHelpers';
import { ShopItemTile } from '../../shop/ShopItemTile';
import { cardText, rowButton } from '../home/studentHomeHelpers';
import { KindChip, RarityChip } from './ShopBits';
import { gold } from './shopStudentHelpers';

const summaryBox = 'rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-900/40';
const summaryRow = 'flex items-baseline justify-between gap-3 py-1 tabular-nums';
const summaryLabel = 'text-gray-700 dark:text-gray-300';
const summaryValue = 'font-bold text-gray-900 dark:text-white';
const alertClass = 'rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-100';
const choiceRow = 'flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border-2 px-3 text-sm transition-colors';
const choiceOn = 'border-primary-600 bg-primary-50 dark:border-primary-300 dark:bg-primary-900/30';
const choiceOff = 'border-gray-200 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500';

const ItemHeader = ({ item }: { item: Pick<StudentShopItem, 'name' | 'icon' | 'imageUrl' | 'category' | 'rarity' | 'description'> }) => (
  <div className="flex gap-3">
    <ShopItemTile icon={item.icon} imageUrl={item.imageUrl} category={item.category} rarity={item.rarity} size="lg" />
    <div className="min-w-0">
      <p className="break-words text-base font-bold text-gray-900 dark:text-white">{item.name}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <RarityChip rarity={item.rarity} />
        <KindChip category={item.category} />
      </div>
      {item.description && <p className={`${cardText} mt-2`}>{item.description}</p>}
    </div>
  </div>
);

export interface PurchaseDone {
  item: StudentShopItem;
  kind: 'self' | 'gift';
  /** Con aprobación: queda esperando a su profe y aún no se cobra. */
  pending: boolean;
  toName: string | null;
  goldLeft: number;
}

interface PurchaseModalProps {
  profileId: string;
  classroomId: string;
  item: StudentShopItem;
  view: StudentShopView;
  spendable: number;
  /** Regalar: no para pequeños ni si ya regaló hoy. */
  canGift: boolean;
  onClose: () => void;
  onDone: (done: PurchaseDone) => void;
}

/** Comprar para sí o regalar a un compañero: lo que tiene, lo que cuesta y lo que le quedará. */
export const PurchaseModal = ({ profileId, classroomId, item, view, spendable, canGift, onClose, onDone }: PurchaseModalProps) => {
  const [mode, setMode] = useState<'self' | 'gift'>('self');
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [phrase, setPhrase] = useState<GiftPhraseKey | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const { classMap } = useCharacterClasses(classroomId);

  const classmates = useQuery({
    queryKey: ['shop-classmates', profileId],
    queryFn: () => shopApi.getClassmates(profileId),
    enabled: mode === 'gift',
    staleTime: 5 * 60_000,
  });
  const list = classmates.data ?? [];
  const term = search.trim().toLocaleLowerCase('es');
  const shown = term ? list.filter((mate) => mate.name.toLocaleLowerCase('es').includes(term)) : list;
  const recipient = list.find((mate) => mate.id === recipientId) ?? null;
  const left = spendable - item.price;
  const pending = view.shop.requiresApproval;

  const submit = async () => {
    if (sending || (mode === 'gift' && !recipient)) return;
    setSending(true);
    setError(null);
    try {
      const result = mode === 'self'
        ? await shopApi.purchase(profileId, item.id)
        : await shopApi.gift(profileId, recipient!.id, item.id, { phrase, anonymous });
      onDone({ item, kind: mode, pending: !!result.requiresApproval, toName: recipient?.name ?? null, goldLeft: Math.max(0, view.gold - (result.requiresApproval ? 0 : item.price)) });
    } catch (err) {
      setError(errorMessage(err, mode === 'self' ? 'No se pudo hacer la compra. Inténtalo otra vez.' : 'No se pudo enviar el regalo. Inténtalo otra vez.'));
      setSending(false);
    }
  };

  const footer = (
    <>
      <button type="button" onClick={onClose} className={cancelButton} data-autofocus>Cancelar</button>
      <button type="button" onClick={() => void submit()} disabled={sending || (mode === 'gift' && !recipient)} className={primaryButton}>
        {sending ? (mode === 'self' ? 'Comprando…' : 'Enviando…') : `${mode === 'self' ? 'Comprar' : 'Regalar'} por ${gold(item.price)}`}
      </button>
    </>
  );

  return (
    <HomeModal title={mode === 'self' ? `¿Comprar «${item.name}»?` : `Regalar «${item.name}»`} onClose={onClose} footer={footer}>
      <ItemHeader item={item} />

      {canGift && (
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800" role="group" aria-label="¿Para quién?">
          {(['self', 'gift'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => { setMode(value); setError(null); }}
              className={`min-h-[44px] rounded-xl px-3 text-sm font-bold transition-colors ${
                mode === value ? 'bg-primary-600 text-white dark:bg-primary-300 dark:text-gray-900' : 'text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700'
              }`}
            >
              {value === 'self' ? 'Para mí' : 'Para un compañero'}
            </button>
          ))}
        </div>
      )}

      {mode === 'gift' && (
        <fieldset className="space-y-2">
          <legend className={labelClass}>¿Para quién?</legend>
          {classmates.isLoading ? (
            <p role="status" className={cardText}>Cargando a tus compañeros…</p>
          ) : classmates.isError ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2">
              <p className={cardText}>No pudimos cargar a tus compañeros.</p>
              <button type="button" onClick={() => void classmates.refetch()} className={rowButton}>Reintentar</button>
            </div>
          ) : list.length === 0 ? (
            <p className={cardText}>Aún no hay compañeros a quienes regalar.</p>
          ) : (
            <>
              {list.length > 12 && (
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Busca a un compañero"
                  aria-label="Buscar compañero"
                  className={inputClass}
                />
              )}
              <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                {shown.map((mate) => {
                  const role = classMap[mate.characterClassId ?? ''] || classMap[mate.characterClass];
                  return (
                    <label key={mate.id} className={`${choiceRow} ${recipientId === mate.id ? choiceOn : choiceOff}`}>
                      <input
                        type="radio"
                        name="gift-recipient"
                        value={mate.id}
                        checked={recipientId === mate.id}
                        onChange={() => setRecipientId(mate.id)}
                        className="h-4 w-4 accent-primary-600"
                      />
                      {role?.icon && <span className="text-lg" aria-hidden="true">{role.icon}</span>}
                      <span className="font-semibold text-gray-900 dark:text-white">{mate.name}</span>
                    </label>
                  );
                })}
                {shown.length === 0 && <p className={cardText}>Nadie se llama así en tu clase.</p>}
              </div>
            </>
          )}
        </fieldset>
      )}

      {mode === 'gift' && list.length > 0 && (
        <>
          <fieldset className="space-y-1.5">
            <legend className={labelClass}>Mensaje <span className="font-normal text-gray-600 dark:text-gray-300">(opcional)</span></legend>
            {(Object.keys(GIFT_PHRASES) as GiftPhraseKey[]).map((key) => (
              <label key={key} className={`${choiceRow} ${phrase === key ? choiceOn : choiceOff}`}>
                <input
                  type="radio"
                  name="gift-phrase"
                  value={key}
                  checked={phrase === key}
                  onChange={() => setPhrase(key)}
                  className="h-4 w-4 accent-primary-600"
                />
                <span className="text-gray-900 dark:text-white">«{GIFT_PHRASES[key]}»</span>
              </label>
            ))}
            {phrase && (
              <button type="button" onClick={() => setPhrase(null)} className={rowButton}>Sin mensaje</button>
            )}
          </fieldset>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-gray-900 dark:text-white">
            <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} className="h-4 w-4 accent-primary-600" />
            No decir que es de mí
          </label>
        </>
      )}

      <dl className={summaryBox}>
        <div className={summaryRow}><dt className={summaryLabel}>Tu oro</dt><dd className={summaryValue}>{gold(view.gold)}</dd></div>
        {view.pendingGold > 0 && (
          <div className={summaryRow}><dt className={summaryLabel}>Esperan a tu profe</dt><dd className={summaryValue}>{gold(view.pendingGold)}</dd></div>
        )}
        <div className={summaryRow}><dt className={summaryLabel}>Cuesta</dt><dd className={summaryValue}>{gold(item.price)}</dd></div>
        <div className={`${summaryRow} mt-1 border-t border-gray-200 pt-2 dark:border-gray-700`}>
          <dt className={summaryLabel}>{pending ? 'Te quedarán al aprobarse' : 'Te quedarán'}</dt>
          <dd className={summaryValue}>{gold(left)}</dd>
        </div>
      </dl>

      {pending && (
        <p className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
          <Clock3 size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          Tu profe aprueba cada {mode === 'self' ? 'compra' : 'regalo'}: el oro se descuenta cuando lo apruebe.
        </p>
      )}
      {mode === 'gift' && (
        <p className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
          <Gift size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          Puedes hacer un regalo por día. Le llegará un aviso a tu compañero.
        </p>
      )}
      {error && <p role="alert" className={alertClass}>{error}</p>}
    </HomeModal>
  );
};

/** «¡Es tuyo!»: un festejo pequeño (el premio hace «pop» una vez) y qué hacer después. */
export const PurchaseDoneModal = ({ done, onClose, onShowMine }: { done: PurchaseDone; onClose: () => void; onShowMine: () => void }) => {
  const { item, kind, pending, toName, goldLeft } = done;
  const title = pending ? '¡Pedido enviado!' : kind === 'gift' ? '¡Regalo enviado!' : '¡Es tuyo!';
  const text = pending
    ? kind === 'gift'
      ? `Tu profe revisará tu regalo${toName ? ` para ${toName}` : ''}. El oro se descuenta cuando lo apruebe.`
      : 'Tu profe revisará tu compra. El oro se descuenta cuando la apruebe.'
    : kind === 'gift'
      ? `Le regalaste «${item.name}»${toName ? ` a ${toName}` : ''}. Te quedan ${gold(goldLeft)}.`
      : `Te quedan ${gold(goldLeft)}. ${item.category === 'CONSUMABLE' ? 'Cuando quieras usarlo, búscalo en «Mis premios».' : 'Ya está en «Mis premios».'}`;
  const footer = (
    <>
      <button type="button" onClick={onClose} className={cancelButton} data-autofocus>Seguir mirando</button>
      {kind === 'self' && !pending && <button type="button" onClick={onShowMine} className={primaryButton}>Ver mis premios</button>}
    </>
  );
  return (
    <HomeModal title={title} onClose={onClose} footer={footer}>
      <div className="flex flex-col items-center text-center">
        <span className="relative flex">
          <span className="celebrate-ring absolute inset-0 rounded-2xl border-2 border-amber-500" aria-hidden="true" />
          <ShopItemTile icon={item.icon} imageUrl={item.imageUrl} category={item.category} rarity={item.rarity} size="lg" pop />
        </span>
        <p className="mt-3 break-words text-lg font-bold text-gray-900 dark:text-white">{item.name}</p>
        <p className={`${cardText} mt-1 max-w-sm`}>{text}</p>
      </div>
    </HomeModal>
  );
};

interface UseModalProps {
  profileId: string;
  prize: StudentShopOwned;
  onClose: () => void;
  onDone: () => void;
}

/** Pedir usar un premio de un solo uso: su profe lo aprueba en clase; si hoy no se puede, lo sigue teniendo. */
export const UsePrizeModal = ({ profileId, prize, onClose, onDone }: UseModalProps) => {
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const after = prize.available - 1;

  const submit = async () => {
    if (sending || !prize.usePurchaseId) return;
    setSending(true);
    setError(null);
    try {
      await shopApi.useItem(profileId, prize.usePurchaseId);
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'No se pudo enviar tu pedido. Inténtalo otra vez.'));
      setSending(false);
    }
  };

  const footer = (
    <>
      <button type="button" onClick={onClose} className={cancelButton} data-autofocus>Ahora no</button>
      <button type="button" onClick={() => void submit()} disabled={sending} className={primaryButton}>
        {sending ? 'Enviando…' : 'Pedir a mi profe'}
      </button>
    </>
  );

  return (
    <HomeModal title={`¿Usar «${prize.name}»?`} onClose={onClose} footer={footer}>
      <div className="flex items-center gap-3">
        <ShopItemTile icon={prize.icon} imageUrl={prize.imageUrl} category={prize.category} rarity={prize.rarity} size="lg" />
        <p className="text-sm text-gray-900 dark:text-white">
          {prize.available === 1 ? 'Te queda 1.' : `Te quedan ${prize.available}.`} {after === 0 ? 'Al usarlo ya no te quedará.' : `Al usarlo te ${after === 1 ? 'quedará 1' : `quedarán ${after}`}.`}
        </p>
      </div>
      <p className={cardText}>Tu profe verá tu pedido y lo aprobará en clase. Si hoy no se puede, lo sigues teniendo para otra ocasión.</p>
      {error && <p role="alert" className={alertClass}>{error}</p>}
    </HomeModal>
  );
};
