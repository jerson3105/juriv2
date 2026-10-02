import { useState } from 'react';
import { Gift, Target } from 'lucide-react';
import type { AvatarGender, StudentAvatarItem, StudentAvatarView } from '../../../lib/avatarApi';
import { HomeModal } from '../../home/HomeModal';
import { cancelButton, errorMessage, primaryButton } from '../../home/homeHelpers';
import { cardText } from '../../student/home/studentHomeHelpers';
import { AvatarRenderer, type EquippedItem } from '../AvatarRenderer';
import { BODY_LABEL, PRENDA_RARITY, gold } from '../avatarHelpers';
import { spendableOf } from './closetHelpers';

const errorBox = 'rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-100';
const noteRow = 'flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300';
const bigButton = 'min-h-[56px] px-6 text-base';

// El personaje con la prenda puesta, en la noche del espejo.
const Look = ({ gender, look, large = false }: { gender: AvatarGender; look: EquippedItem[]; large?: boolean }) => (
  <div className={`obs-sky flex flex-shrink-0 justify-center rounded-2xl ${large ? 'px-6 py-3' : 'p-2'}`}>
    <AvatarRenderer gender={gender} equippedItems={look} size={large ? 'md' : 'sm'} label="Así te verías" />
  </div>
);

/** Qué pasa con su meta si compra: la cumple o le faltará más. Sin juicio. */
const goalImpact = (view: StudentAvatarView, item: StudentAvatarItem) => {
  const goal = view.goal;
  if (!goal) return null;
  if (goal.kind === 'AVATAR' && goal.itemId === item.id) return '¡Es tu meta! La cumples con esta compra.';
  const target = goal.kind === 'ITEM'
    ? { name: goal.name, price: goal.price }
    : view.items.find((entry) => entry.id === goal.itemId && entry.price !== null && !entry.owned);
  if (!target || target.price === null) return null;
  const missing = target.price - (spendableOf(view) - (item.price ?? 0));
  return missing > 0 ? `Para tu meta «${target.name}» te faltarán ${gold(missing)}.` : null;
};

interface OwnModalProps {
  view: StudentAvatarView;
  item: StudentAvatarItem;
  look: EquippedItem[];
  /** Con equip: ponérsela al comprarla (o al elegirla de regalo). */
  onConfirm: (equip: boolean) => Promise<void>;
  onClose: () => void;
}

const useConfirm = (onConfirm: (equip: boolean) => Promise<void>, onClose: () => void, fallback: string) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async (equip: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(equip);
      onClose();
    } catch (failure) {
      setError(errorMessage(failure, fallback));
      setBusy(false);
    }
  };
  return { busy, error, confirm };
};

/** Comprar una prenda: cuánto tiene, cuánto cuesta y cuánto le queda; «Ponérmela ahora» ya marcado. */
export const BuyModal = ({ view, item, look, onConfirm, onClose }: OwnModalProps) => {
  const [equip, setEquip] = useState(true);
  const { busy, error, confirm } = useConfirm(onConfirm, onClose, 'No se pudo comprar. Inténtalo otra vez.');
  const spendable = spendableOf(view);
  const price = item.price ?? 0;
  const impact = goalImpact(view, item);

  if (view.young) {
    return (
      <HomeModal
        title="¿La compras?"
        onClose={onClose}
        footer={(
          <>
            <button type="button" onClick={onClose} className={`${cancelButton} ${bigButton}`}>No</button>
            <button type="button" onClick={() => void confirm(true)} disabled={busy} data-autofocus className={`${primaryButton} ${bigButton}`}>
              {busy ? 'Comprando…' : 'Sí, la compro'}
            </button>
          </>
        )}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Look gender={view.profile.gender} look={look} large />
          <p className="break-words text-xl font-black text-gray-900 dark:text-white">{item.name}</p>
          <p className="text-lg text-gray-800 dark:text-gray-100">Cuesta {gold(price)}. Te quedan {gold(spendable - price)}.</p>
        </div>
        {error && <p role="alert" className={errorBox}>{error}</p>}
      </HomeModal>
    );
  }

  return (
    <HomeModal
      title={`Comprar «${item.name}»`}
      subtitle={`Prenda ${PRENDA_RARITY[item.rarity].toLowerCase()}`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
          <button type="button" onClick={() => void confirm(equip)} disabled={busy} data-autofocus className={primaryButton}>
            {busy ? 'Comprando…' : `Comprar por ${gold(price)}`}
          </button>
        </>
      )}
    >
      <div className="flex items-center gap-4">
        <Look gender={view.profile.gender} look={look} />
        <dl className="grid flex-1 grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm text-gray-800 dark:text-gray-100">
          <dt>{view.profile.pendingGold > 0 ? 'Tu oro para gastar' : 'Tu oro'}</dt>
          <dd className="text-right tabular-nums">{gold(spendable)}</dd>
          <dt>Cuesta</dt>
          <dd className="text-right tabular-nums">{gold(price)}</dd>
          <dt className="border-t border-gray-200 pt-1.5 font-bold text-gray-900 dark:border-gray-700 dark:text-white">Te quedarán</dt>
          <dd className="border-t border-gray-200 pt-1.5 text-right font-bold tabular-nums text-gray-900 dark:border-gray-700 dark:text-white">{gold(spendable - price)}</dd>
        </dl>
      </div>
      {impact && <p className={noteRow}><Target size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{impact}</p>}
      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
        <input type="checkbox" checked={equip} onChange={(event) => setEquip(event.target.checked)} className="h-5 w-5 accent-primary-600" />
        Ponérmela ahora
      </label>
      <p className={cardText}>Es tuya para siempre en esta clase.</p>
      {error && <p role="alert" className={errorBox}>{error}</p>}
    </HomeModal>
  );
};

/** Elegir la prenda de regalo (una común, gratis, una sola vez). */
export const GiftModal = ({ view, item, look, onConfirm, onClose }: OwnModalProps) => {
  const [equip, setEquip] = useState(true);
  const { busy, error, confirm } = useConfirm(onConfirm, onClose, 'No se pudo elegir tu regalo. Inténtalo otra vez.');

  return (
    <HomeModal
      title={view.young ? '¿Es tu regalo?' : 'Tu prenda de regalo'}
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className={`${cancelButton} ${view.young ? bigButton : ''}`}>{view.young ? 'No' : 'Cancelar'}</button>
          <button type="button" onClick={() => void confirm(view.young || equip)} disabled={busy} data-autofocus className={`${primaryButton} ${view.young ? bigButton : ''}`}>
            <Gift size={18} aria-hidden="true" />
            {busy ? 'Guardando…' : 'Sí, es mi regalo'}
          </button>
        </>
      )}
    >
      <div className={view.young ? 'flex flex-col items-center gap-3 text-center' : 'flex items-center gap-4'}>
        <Look gender={view.profile.gender} look={look} large={view.young} />
        <div className="min-w-0">
          <p className={`break-words font-black text-gray-900 dark:text-white ${view.young ? 'text-xl' : 'text-lg'}`}>«{item.name}»</p>
          <p className={`${cardText} mt-1`}>{view.young ? 'Es gratis. Solo hay un regalo.' : 'Es gratis. Solo puedes elegir un regalo: después, la ropa se compra con oro.'}</p>
        </div>
      </div>
      {!view.young && (
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
          <input type="checkbox" checked={equip} onChange={(event) => setEquip(event.target.checked)} className="h-5 w-5 accent-primary-600" />
          Ponérmela ahora
        </label>
      )}
      {error && <p role="alert" className={errorBox}>{error}</p>}
    </HomeModal>
  );
};

interface BodyModalProps {
  current: AvatarGender;
  onConfirm: (gender: AvatarGender) => void;
  onClose: () => void;
}

/** Elegir el cuerpo del personaje (libre, gratis y reversible; nunca «¿eres…?»). */
export const BodyModal = ({ current, onConfirm, onClose }: BodyModalProps) => {
  const [choice, setChoice] = useState<AvatarGender>(current);
  return (
    <HomeModal
      title="Elige el cuerpo de tu personaje"
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
          <button type="button" onClick={() => { onConfirm(choice); onClose(); }} disabled={choice === current} className={primaryButton}>Cambiar</button>
        </>
      )}
    >
      <div role="radiogroup" aria-label="Cuerpo del personaje" className="grid grid-cols-2 gap-3">
        {(['MALE', 'FEMALE'] as const).map((gender) => (
          <label
            key={gender}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 p-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-500 ${
              choice === gender ? 'border-primary-600 bg-primary-50 dark:border-primary-300 dark:bg-primary-900/30' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40'
            }`}
          >
            <input
              type="radio"
              name="avatar-body"
              value={gender}
              checked={choice === gender}
              onChange={() => setChoice(gender)}
              aria-label={`${BODY_LABEL[gender]}${gender === current ? ' (ahora)' : ''}`}
              className="sr-only"
            />
            <span className="obs-sky rounded-xl px-3 py-2"><AvatarRenderer gender={gender} size="md" /></span>
            <span className="text-base font-bold text-gray-900 dark:text-white">{BODY_LABEL[gender]}</span>
            {gender === current && <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Ahora</span>}
          </label>
        ))}
      </div>
      <p className={cardText}>Lo que compraste no se pierde: lo que existe para el otro cuerpo pasa contigo y lo demás te espera aquí por si vuelves.</p>
    </HomeModal>
  );
};
