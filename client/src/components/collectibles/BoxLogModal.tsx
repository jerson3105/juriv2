import { useQuery } from '@tanstack/react-query';
import { collectibleApi, type CollectibleAlbum } from '../../lib/collectibleApi';
import { HomeModal } from '../home/HomeModal';
import { boxLogKey } from './collectibleHelpers';

const closeButton = 'inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700';
const when = (iso: string) => new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** La caja de la clase para el profe: cuántas hay y quién donó o tomó cada una (los estudiantes no lo ven). */
export const BoxLogModal = ({ album, onClose }: { album: CollectibleAlbum; onClose: () => void }) => {
  const query = useQuery({ queryKey: boxLogKey(album.id), queryFn: () => collectibleApi.getBoxLog(album.id) });
  const log = query.data;
  const stats = log ? [['En la caja', log.inBox], ['Donadas', log.donated], ['Tomadas', log.taken]] as const : [];
  return (
    <HomeModal
      title="Caja de la clase"
      subtitle={album.name}
      size="lg"
      onClose={onClose}
      footer={<button type="button" onClick={onClose} className={closeButton}>Cerrar</button>}
    >
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Tus estudiantes donan sus repetidas y quien la necesita la toma (hasta 3 al día). Ellos no ven quién dona; tú sí.
      </p>
      {!album.allowTrades && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
          Está apagada: tus estudiantes no la ven. Puedes encenderla en «Configurar álbum».
        </p>
      )}
      {query.isLoading && <p className="text-sm text-gray-700 dark:text-gray-300">Cargando la caja…</p>}
      {query.isError && <p className="text-sm text-red-700 dark:text-red-300" role="alert">No pudimos cargar la caja.</p>}
      {log && (
        <>
          <dl className="grid grid-cols-3 gap-2">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-900/40">
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">{label}</dt>
                <dd className="text-lg font-black text-gray-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>
          {log.items.length === 0 ? (
            <p className="text-sm text-gray-700 dark:text-gray-300">Todavía nadie donó figuritas.</p>
          ) : (
            <ul className="divide-y divide-gray-200 text-sm dark:divide-gray-700">
              {log.items.map((item) => (
                <li key={item.id} className="py-2">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {item.card.slotNumber} · {item.card.name}
                  </p>
                  <p className="text-gray-700 dark:text-gray-300">
                    Donó {item.donor} · {when(item.donatedAt)}
                    {' — '}
                    {item.taker && item.takenAt ? `la tomó ${item.taker} · ${when(item.takenAt)}` : 'sigue en la caja'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </HomeModal>
  );
};
