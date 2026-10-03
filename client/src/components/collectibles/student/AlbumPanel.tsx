import { Coins, Lock, Moon } from 'lucide-react';
import type { StudentAlbumView, StudentCollectiblesView } from '../../../lib/collectibleApi';
import { cardLink, cardText, cardTitle, homeCard, rowButton } from '../../student/home/studentHomeHelpers';
import { gold, savingsTrack, statusLine, statusTone } from '../../student/shop/shopStudentHelpers';
import { EnvelopeIcon } from './Envelope';
import { completedDate, kioskStateOf, percentOf, rewardsText, spendableOf } from './stickerHelpers';

interface AlbumPanelProps {
  view: StudentCollectiblesView;
  album: StudentAlbumView;
  onOpen: (mode: 'pack' | 'welcome') => void;
  onShowLists: () => void;
  onWhatCanCome: () => void;
  onOpenBox: () => void;
}

const progressFill = 'h-full rounded-full bg-primary-600 dark:bg-primary-300';
const goldPill = 'inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-amber-50 px-2.5 text-sm font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100';
const packButton = 'flex min-h-[64px] w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600';
// Toldo del kiosco: rayas ámbar propias (la Tienda usa el azul).
const awning = 'h-3 rounded-t-2xl bg-[repeating-linear-gradient(90deg,#b45309_0_16px,#fff7ed_16px_32px)] dark:bg-[repeating-linear-gradient(90deg,#d97706_0_16px,#1f2937_16px_32px)]';

/** «Tu álbum»: cuánto llevas, qué te falta y el premio. */
const AlbumProgress = ({ view, album, onShowLists }: Pick<AlbumPanelProps, 'view' | 'album' | 'onShowLists'>) => {
  const rewards = rewardsText(album);
  return (
    <section className={homeCard} aria-labelledby="album-progress-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="album-progress-title" className={cardTitle}>Tu álbum</h2>
        {!view.young && <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{percentOf(album)} %</span>}
      </div>
      <p className={`${cardText} mt-0.5`}>{album.owned} de {album.totalCards} pegadas</p>
      <div className={`${savingsTrack} mt-2`} role="progressbar" aria-label="Figuritas pegadas" aria-valuemin={0} aria-valuemax={album.totalCards} aria-valuenow={album.owned}>
        <div className={progressFill} style={{ width: `${percentOf(album)}%` }} />
      </div>
      {album.completedAt ? (
        <p className="mt-3 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          ¡Completo desde el {completedDate(album.completedAt)}!{rewards ? ` Ganaste ${rewards}.` : ''}
        </p>
      ) : (
        <>
          {!view.young && (
            <div className="mt-1 flex flex-wrap gap-x-3">
              <button type="button" onClick={onShowLists} className={cardLink}>
                {album.missing === 1 ? 'Te falta 1' : `Te faltan ${album.missing}`}
              </button>
              {album.duplicates > 0 && (
                <button type="button" onClick={onShowLists} className={cardLink}>
                  {album.duplicates === 1 ? '1 repetida' : `${album.duplicates} repetidas`}
                </button>
              )}
            </div>
          )}
          {rewards && <p className={`${cardText} mt-1`}>Al completarlo ganas {rewards}.</p>}
        </>
      )}
    </section>
  );
};

/** El kiosco: el sobre de bienvenida y el del día, con las reglas de la Tienda a la vista. */
const Kiosk = ({ view, album, onOpen, onWhatCanCome }: Omit<AlbumPanelProps, 'onShowLists' | 'onOpenBox'>) => {
  const state = kioskStateOf(view, album);
  const spendable = spendableOf(view);
  const young = view.young;

  return (
    <section aria-labelledby="kiosk-title" className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className={awning} aria-hidden="true" />
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="kiosk-title" className={cardTitle}>Sobres</h2>
          <span className={goldPill}>
            <Coins size={16} className="text-amber-700 dark:text-amber-300" aria-hidden="true" />
            {gold(view.profile.gold)}
          </span>
        </div>
        {view.profile.pendingGold > 0 && state.kind === 'ready' && (
          <p className={`${cardText} mt-1`}>{gold(view.profile.pendingGold)} esperan a tu profe; para sobres tienes {gold(spendable)}.</p>
        )}

        {state.kind === 'archived' && <p className={`${cardText} mt-3`}>Ya no se venden sobres de este álbum. Tus figuritas siguen aquí.</p>}
        {state.kind === 'complete' && <p className={`${cardText} mt-3`}>Ya lo completaste: este álbum no tiene más sobres.</p>}
        {state.kind === 'closed' && (
          <div className={`${statusLine} ${statusTone.neutral}`}>
            <Lock size={16} aria-hidden="true" />
            La tienda está cerrada. Tu oro se guarda y puedes mirar tu álbum.
          </div>
        )}
        {state.kind === 'resting' && (
          <div className={`${statusLine} ${statusTone.resting}`}>
            <Moon size={16} aria-hidden="true" />
            En pausa mientras descansas.
          </div>
        )}

        {state.kind === 'ready' && (
          <div className="mt-3 space-y-2.5">
            {state.welcome && album.welcome && (
              <button
                type="button"
                onClick={() => onOpen('welcome')}
                className={`${packButton} border-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-400 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50`}
              >
                <EnvelopeIcon gift />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-gray-900 dark:text-white">Sobre de bienvenida</span>
                  <span className="block text-sm text-gray-700 dark:text-gray-300">{album.welcome.cards} figuritas nuevas</span>
                </span>
                <span className="rounded-full bg-emerald-700 px-2.5 py-0.5 text-sm font-bold text-white">Gratis</span>
              </button>
            )}
            {album.pack && state.pack === 'buy' && (
              <button
                type="button"
                onClick={() => onOpen('pack')}
                className={`${packButton} border-amber-700 bg-amber-50 hover:bg-amber-100 dark:border-amber-400 dark:bg-amber-900/30 dark:hover:bg-amber-900/50`}
              >
                <EnvelopeIcon />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-gray-900 dark:text-white">{young ? 'Abrir un sobre' : 'Sobre del día'}</span>
                  <span className="block text-sm text-gray-700 dark:text-gray-300">{album.pack.cards === 1 ? '1 figurita' : `${album.pack.cards} figuritas`}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-sm font-black text-amber-950">
                  <Coins size={14} aria-hidden="true" />
                  {album.pack.price}
                  <span className="sr-only"> de oro</span>
                </span>
              </button>
            )}
            {album.pack && state.pack === 'missing' && (
              <div>
                <div className={`${statusLine} ${statusTone.neutral} !mt-0`}>
                  <EnvelopeIcon />
                  <span>
                    {young ? 'Sobre' : `Sobre de ${album.pack.cards}`}: {gold(album.pack.price)} · te faltan {gold(album.pack.price - spendable)}
                  </span>
                </div>
                <p className={`${cardText} mt-1.5`}>Ganas oro cuando participas y cumples en clase.</p>
              </div>
            )}
            {album.pack && state.pack === 'limit' && (
              <div className={`${statusLine} ${statusTone.waiting} !mt-0`}>
                {view.daily.limit === 1 ? 'Ya abriste tu sobre de hoy. Mañana puedes abrir otro.' : `Ya abriste tus ${view.daily.limit} sobres de hoy. Mañana puedes abrir más.`}
              </div>
            )}
            {album.pack && state.pack !== 'limit' && view.daily.limit > 1 && (
              <p className={cardText}>{view.daily.left === 1 ? 'Hoy te queda 1 sobre.' : `Hoy te quedan ${view.daily.left} sobres.`}</p>
            )}
            {!young && (
              <button type="button" onClick={onWhatCanCome} className={cardLink}>¿Qué puede salir?</button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

/** La caja de la clase (si está abierta): cuántas de la caja te faltan y cuántas repetidas puedes donar. */
const BoxCard = ({ album, onOpenBox }: Pick<AlbumPanelProps, 'album' | 'onOpenBox'>) => {
  if (!album.box) return null;
  const useful = album.cards.filter((card) => !card.owned && card.inBox > 0).length;
  const donatable = album.cards.reduce((sum, card) => sum + card.donatable, 0);
  return (
    <section className={homeCard} aria-labelledby="box-title">
      <h2 id="box-title" className={`${cardTitle} flex items-center gap-2`}><span aria-hidden="true">📦</span>Caja de la clase</h2>
      <p className={`${cardText} mt-0.5`}>Dona tus repetidas y toma las que te faltan. Nadie ve quién dona.</p>
      <ul className="mt-2 space-y-0.5 text-sm text-gray-800 dark:text-gray-100">
        <li>{useful === 0 ? 'Ninguna de la caja te falta por ahora.' : useful === 1 ? 'Hay 1 que te falta.' : `Hay ${useful} que te faltan.`}</li>
        <li>{donatable === 0 ? 'No tienes repetidas para donar.' : donatable === 1 ? 'Puedes donar 1 repetida.' : `Puedes donar ${donatable} repetidas.`}</li>
      </ul>
      <button type="button" onClick={onOpenBox} className={`${rowButton} mt-3`}>Abrir la caja</button>
    </section>
  );
};

/** El panel al lado del libro (debajo en pantallas chicas): «Tu álbum», el kiosco y la caja de la clase. */
export const AlbumPanel = (props: AlbumPanelProps) => (
  <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-1">
    <AlbumProgress view={props.view} album={props.album} onShowLists={props.onShowLists} />
    <Kiosk view={props.view} album={props.album} onOpen={props.onOpen} onWhatCanCome={props.onWhatCanCome} />
    <BoxCard album={props.album} onOpenBox={props.onOpenBox} />
  </div>
);
