import { useEffect, useRef, useState } from 'react';
import { collectibleApi, collectibleImageUrl, type OpenPackResult, type StickerView, type StudentAlbumView, type StudentCollectiblesView } from '../../../lib/collectibleApi';
import { HomeModal } from '../../home/HomeModal';
import { nightLink, nightPrimary } from '../../student/home/studentHomeHelpers';
import { gold } from '../../student/shop/shopStudentHelpers';
import { prefersReducedMotion } from '../../avatar/closet/closetHelpers';
import { CollectibleCardBack, CollectibleCardView } from '../CollectibleCardView';
import { CARD_RARITY_STYLE } from '../collectibleHelpers';
import { Envelope } from './Envelope';

interface OpenPackModalProps {
  profileId: string;
  view: StudentCollectiblesView;
  album: StudentAlbumView;
  mode: 'pack' | 'welcome';
  /** El servidor ya pegó las figuritas: la página refresca el álbum y el oro. */
  onOpened: (result: OpenPackResult) => void;
  onClose: (result: OpenPackResult | null) => void;
}

type Phase = 'confirm' | 'opening' | 'tearing' | 'reveal';

const TEAR_MS = 260;
const DEAL_STAGGER_MS = 35;
const FLIP_OUT_MS = 130;
const FLIP_IN_MS = 170;
const FLIP_ALL_STAGGER_MS = 70;
const PRELOAD_MAX_MS = 300;

const wait = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });
// Precarga y decodifica el dibujo mientras se rasga el sobre (como mucho 300 ms por figurita).
const preload = (url: string) => {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  return Promise.race([image.decode().catch(() => undefined), wait(PRELOAD_MAX_MS)]);
};
const serverMessage = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

/** Lo que se anuncia al voltear una figurita. */
const newsOf = (card: StickerView, young: boolean) => {
  if (young) return card.isNew ? `¡Es nueva! Va en el número ${card.slotNumber}.` : `¡Otra vez la ${card.slotNumber}!`;
  const rarity = CARD_RARITY_STYLE[card.rarity].label.toLowerCase();
  return card.isNew ? `${card.name}, ${rarity}, ¡nueva!` : `${card.name}: repetida, tienes ${card.count}.`;
};

const summaryOf = (cards: StickerView[], album: StudentAlbumView, completed: boolean) => {
  const fresh = cards.filter((card) => card.isNew).length;
  const repeated = cards.length - fresh;
  const owned = Math.min(album.totalCards, album.owned + fresh);
  const first = fresh === 0
    ? 'Esta vez todas eran repetidas.'
    : repeated === 0
      ? (fresh === 1 ? 'Te salió 1 nueva.' : `Te salieron ${fresh} nuevas.`)
      : `Te salieron ${cards.length}: ${fresh === 1 ? '1 nueva' : `${fresh} nuevas`} y ${repeated === 1 ? '1 repetida' : `${repeated} repetidas`}.`;
  if (completed) return `${first} ¡Completaste tu álbum!`;
  return `${first} Tu álbum ${fresh === 0 ? 'sigue en' : 'va en'} ${owned} de ${album.totalCards}.`;
};

// La mesa: paso 1, el sobre con lo que tienes, lo que cuesta y lo que te quedará (pagar es abrir); paso 2,
// las figuritas boca abajo y el alumno las voltea (o «Voltear todas»). Todo en 2D y sin bucles; nada anticipa
// la rareza antes de voltear y al final solo está «Ver en mi álbum» (nunca «Abrir otro»).
export const OpenPackModal = ({ profileId, view, album, mode, onOpened, onClose }: OpenPackModalProps) => {
  const young = view.young;
  const [phase, setPhase] = useState<Phase>('confirm');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OpenPackResult | null>(null);
  const [faceUp, setFaceUp] = useState<Set<number>>(() => new Set());
  const [turning, setTurning] = useState<Record<number, 'out' | 'in'>>({});
  const [announce, setAnnounce] = useState('');
  const [youngIndex, setYoungIndex] = useState(0);
  const started = useRef(new Set<number>());
  const timers = useRef<number[]>([]);
  const firstDownRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  const price = mode === 'welcome' ? 0 : album.pack?.price ?? 0;
  const count = mode === 'welcome' ? album.welcome?.cards ?? 0 : album.pack?.cards ?? 0;
  const cards = result?.cards ?? [];
  const allUp = cards.length > 0 && faceUp.size === cards.length;
  const busy = phase === 'opening' || phase === 'tearing';

  const open = async () => {
    setPhase('opening');
    setError(null);
    try {
      const data = mode === 'welcome' ? await collectibleApi.openWelcome(profileId, album.id) : await collectibleApi.openPack(profileId, album.id);
      onOpened(data);
      setResult(data);
      setPhase('tearing');
      const images = data.cards.filter((card) => card.imageUrl).map((card) => preload(collectibleImageUrl(card.imageUrl!)));
      await Promise.all([...images, wait(prefersReducedMotion() ? 0 : TEAR_MS)]);
      setPhase('reveal');
    } catch (err) {
      const message = serverMessage(err);
      setError(message ? `${message}` : 'No se pudo abrir el sobre. No se gastó tu oro.');
      setPhase('confirm');
    }
  };

  const flip = (index: number, silent = false) => {
    if (started.current.has(index) || !result) return;
    started.current.add(index);
    const card = result.cards[index];
    const show = () => {
      setFaceUp((prev) => new Set(prev).add(index));
      if (!silent) setAnnounce(newsOf(card, young));
    };
    if (prefersReducedMotion()) {
      show();
      return;
    }
    setTurning((prev) => ({ ...prev, [index]: 'out' }));
    later(() => {
      show();
      setTurning((prev) => ({ ...prev, [index]: 'in' }));
    }, FLIP_OUT_MS);
    later(() => setTurning((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    }), FLIP_OUT_MS + FLIP_IN_MS);
  };

  const flipAll = () => {
    cards.forEach((_, index) => later(() => flip(index, true), index * FLIP_ALL_STAGGER_MS));
  };

  // Foco: la primera boca abajo al repartir (y en los pequeños, la de cada turno); «Ver en mi álbum» al final.
  useEffect(() => {
    if (phase === 'reveal') firstDownRef.current?.focus();
  }, [phase, youngIndex]);
  useEffect(() => {
    if (allUp && (!young || youngIndex === cards.length - 1)) doneRef.current?.focus();
  }, [allUp, young, youngIndex, cards.length]);
  // La figurita volteada deja de ser botón: el foco pasa a la siguiente boca abajo (en los pequeños, a «Siguiente»).
  useEffect(() => {
    if (phase !== 'reveal' || faceUp.size === 0 || faceUp.size === cards.length) return;
    if (young) nextRef.current?.focus();
    else firstDownRef.current?.focus();
  }, [faceUp, phase, young, cards.length]);

  const close = () => {
    if (!busy) onClose(result);
  };

  const flipWrapper = (index: number) => (turning[index] === 'out' ? 'cc-flip-out' : turning[index] === 'in' ? 'cc-flip-in' : '');
  const faceDownButton = (index: number, isFirst: boolean) => (
    <button
      type="button"
      ref={isFirst ? firstDownRef : undefined}
      onClick={() => flip(index)}
      aria-label={young ? 'Tu figurita, boca abajo: tócala para verla' : `Figurita ${index + 1} de ${cards.length}, boca abajo: tócala para voltearla`}
      className="block w-full rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
    >
      <CollectibleCardBack />
    </button>
  );

  const title = phase === 'reveal'
    ? (young ? '¡Tu sobre!' : 'Toca cada figurita')
    : mode === 'welcome' ? 'Sobre de bienvenida' : count === 1 ? 'Sobre de 1 figurita' : `Sobre de ${count} figuritas`;

  const footer = phase === 'reveal'
    ? ((!young || (allUp && youngIndex === cards.length - 1)) && (
      <button type="button" ref={doneRef} onClick={close} className={nightPrimary}>{young ? 'Ver mi álbum' : 'Ver en mi álbum'}</button>
    ))
    : (
      <>
        <button type="button" onClick={close} disabled={busy} className={nightLink}>Cancelar</button>
        <button type="button" data-autofocus onClick={() => void open()} disabled={busy} className={`${nightPrimary} disabled:cursor-wait disabled:opacity-80`}>
          {busy ? 'Abriendo…' : mode === 'welcome' ? 'Abrir mi sobre' : `Abrir por ${gold(price)}`}
        </button>
      </>
    );

  const firstDown = cards.findIndex((_, index) => !faceUp.has(index) && !turning[index]);

  return (
    <HomeModal title={title} subtitle={album.name} onClose={close} footer={footer || undefined} size="lg" tone="night">
      {phase !== 'reveal' ? (
        <div className="space-y-4 rounded-xl bg-[radial-gradient(closest-side,rgba(254,243,199,0.12),transparent)] py-2 text-center">
          <Envelope
            title={album.name}
            subtitle={count === 1 ? '1 figurita' : `${count} figuritas`}
            gift={mode === 'welcome'}
            tearing={phase === 'tearing'}
          />
          {mode === 'welcome' ? (
            <p className="text-sm text-stone-200">Un regalo para empezar tu álbum: {count === 1 ? '1 figurita nueva' : `${count} figuritas nuevas`}, gratis.</p>
          ) : young ? (
            <p className="text-base font-semibold text-stone-100">Cuesta {gold(price)}. Te quedarán {gold(view.profile.gold - price)}.</p>
          ) : (
            <>
              <p className="text-sm text-stone-200">
                Tu oro <strong className="text-white">{view.profile.gold}</strong> · Cuesta <strong className="text-white">{price}</strong> · Te quedarán <strong className="text-white">{view.profile.gold - price}</strong>
              </p>
              <p className="text-sm text-stone-300">Salen de las que te faltan; 1 de cada 5, en promedio, es repetida.</p>
            </>
          )}
          {error && <p role="alert" className="mx-auto max-w-md rounded-xl bg-red-950 px-3 py-2 text-sm font-semibold text-red-100">{error}</p>}
        </div>
      ) : young ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-stone-300">Figurita {youngIndex + 1} de {cards.length}</p>
          <div key={youngIndex} className="cc-deal w-44 sm:w-52">
            <div className={flipWrapper(youngIndex)}>
              {faceUp.has(youngIndex)
                ? <CollectibleCardView card={cards[youngIndex]} size="md" shiny={cards[youngIndex].shiny} glyph holo="static" />
                : faceDownButton(youngIndex, true)}
            </div>
          </div>
          {faceUp.has(youngIndex) && <p className="celebrate-pop text-xl font-black text-white">{newsOf(cards[youngIndex], true)}</p>}
          <p className="sr-only" role="status" aria-live="polite">{announce}</p>
          {faceUp.has(youngIndex) && youngIndex < cards.length - 1 && (
            <button type="button" ref={nextRef} onClick={() => setYoungIndex((index) => index + 1)} className={`${nightPrimary} min-h-[56px] px-8 text-base`}>Siguiente</button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex min-h-[44px] items-center justify-between gap-2">
            <p className="text-sm text-stone-300">{allUp ? '¡Listo!' : `Te salieron ${cards.length === 1 ? '1 figurita' : `${cards.length} figuritas`}.`}</p>
            {!allUp && cards.length > 1 && <button type="button" onClick={flipAll} className={nightLink}>Voltear todas</button>}
          </div>
          <ul className="mx-auto grid max-w-xl grid-cols-3 gap-3 sm:grid-cols-5">
            {cards.map((card, index) => (
              <li key={`${card.id}-${index}`} className="cc-deal" style={{ animationDelay: `${index * DEAL_STAGGER_MS}ms` }}>
                <div className={flipWrapper(index)}>
                  {faceUp.has(index)
                    ? <CollectibleCardView card={card} size="sm" shiny={card.shiny} count={card.count} glyph holo="static" />
                    : faceDownButton(index, index === firstDown)}
                </div>
                {faceUp.has(index) && (
                  <p className="mt-1.5 text-center">
                    {card.isNew
                      ? <span className="celebrate-pop rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white">Nueva</span>
                      : <span className="inline-block rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-stone-100">Repetida · tienes {card.count}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p role="status" aria-live="polite" className="min-h-[1.5rem] text-center text-sm font-semibold text-white">
            {allUp ? summaryOf(cards, album, !!result?.completed) : announce}
          </p>
        </div>
      )}
    </HomeModal>
  );
};
