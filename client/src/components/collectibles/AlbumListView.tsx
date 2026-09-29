import { useState } from 'react';
import { motion } from 'framer-motion';
import { Album, BookOpen, Download, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { collectibleImageUrl, type CollectibleAlbum } from '../../lib/collectibleApi';

interface AlbumListViewProps {
  albums: CollectibleAlbum[];
  onOpen: (album: CollectibleAlbum) => void;
  onBrowse: (album: CollectibleAlbum) => void;
  onCreate: () => void;
  onCreateWithAI: () => void;
  onImport: () => void;
  onRestore: (album: CollectibleAlbum) => void;
}

const secondaryButton = 'inline-flex min-h-[44px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 transition-colors hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';

// Portada del álbum: imagen subida o tapa de cuero con el nombre.
const Cover = ({ album }: { album: CollectibleAlbum }) => (
  <div className="relative h-36 overflow-hidden rounded-t-2xl bg-gradient-to-br from-amber-700 via-orange-800 to-red-900">
    {album.coverImage ? (
      <img src={collectibleImageUrl(album.coverImage)} alt="" className="absolute inset-0 h-full w-full object-cover" />
    ) : (
      <>
        <div className="absolute inset-3 rounded-lg border-2 border-dashed border-amber-200/50" aria-hidden="true" />
        <span className="absolute right-4 top-3 text-4xl opacity-90" aria-hidden="true">📖</span>
      </>
    )}
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pb-3 pt-8">
      <h3 className="truncate text-lg font-black text-white" title={album.name}>{album.name}</h3>
    </div>
    <span className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-bold ${album.isActive ? 'bg-green-700 text-white' : 'bg-gray-900/85 text-white'}`}>
      {album.isActive ? 'A la venta' : 'Archivado'}
    </span>
  </div>
);

export const AlbumListView = ({ albums, onOpen, onBrowse, onCreate, onCreateWithAI, onImport, onRestore }: AlbumListViewProps) => {
  const [showArchived, setShowArchived] = useState(false);
  const active = albums.filter((a) => a.isActive);
  const archived = albums.filter((a) => !a.isActive);
  const visible = showArchived ? archived : active;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-700 text-white shadow-lg shadow-amber-600/30" aria-hidden="true">
            <Album size={22} />
          </span>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Coleccionables</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">Álbumes de cromos que tus estudiantes completan abriendo sobres</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onImport} className={secondaryButton}>
            <Download size={16} className="text-primary-600 dark:text-primary-300" aria-hidden="true" />
            Importar
          </button>
          <button type="button" onClick={onCreateWithAI} className={secondaryButton}>
            <Sparkles size={16} className="text-primary-600 dark:text-primary-300" aria-hidden="true" />
            Crear con IA
          </button>
          <button type="button" onClick={onCreate} className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white shadow-md shadow-primary-600/25 hover:bg-primary-700 sm:flex-none">
            <Plus size={16} aria-hidden="true" />
            Nuevo álbum
          </button>
        </div>
      </div>

      {archived.length > 0 && (
        <div className="flex w-fit rounded-xl border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800" role="group" aria-label="Mostrar álbumes">
          {([[false, `A la venta (${active.length})`], [true, `Archivados (${archived.length})`]] as const).map(([value, label]) => (
            <button key={label} type="button" onClick={() => setShowArchived(value)} aria-pressed={showArchived === value} className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold ${showArchived === value ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {albums.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
          <p className="text-5xl" aria-hidden="true">📖</p>
          <h2 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">Crea tu primer álbum</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">Tus estudiantes compran sobres con su oro, pegan los cromos y ganan un premio al completarlo.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={onCreateWithAI} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700">
              <Sparkles size={16} aria-hidden="true" />
              Crear con IA
            </button>
            <button type="button" onClick={onCreate} className={secondaryButton}>
              <Plus size={16} aria-hidden="true" />
              Crear a mano
            </button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">No hay álbumes aquí.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((album, index) => (
            <motion.li
              key={album.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 9) * 0.03 }}
              whileHover={{ y: -3 }}
              className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
            >
              <Cover album={album} />
              <div className="flex flex-1 flex-col gap-3 p-4">
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-800 dark:text-gray-200">
                  <span><strong>{album.totalCards || 0}</strong> cromos</span>
                  <span>Sobre <strong>{album.singlePackPrice} GP</strong></span>
                  <span>
                    {album.rewardXp > 0 || album.rewardGp > 0
                      ? <>Premio <strong>{[album.rewardXp > 0 && `+${album.rewardXp} XP`, album.rewardGp > 0 && `+${album.rewardGp} GP`].filter(Boolean).join(' ')}</strong></>
                      : <em className="text-gray-700 dark:text-gray-300">Sin premio</em>}
                  </span>
                </p>
                {album.description && <p className="line-clamp-2 text-sm text-gray-700 dark:text-gray-300">{album.description}</p>}
                <div className="mt-auto flex gap-2">
                  {album.isActive ? (
                    <>
                      <button type="button" onClick={() => onOpen(album)} className="min-h-[40px] flex-1 rounded-xl bg-primary-600 px-3 text-sm font-bold text-white hover:bg-primary-700">
                        Abrir
                      </button>
                      <button type="button" onClick={() => onBrowse(album)} disabled={!album.totalCards} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700">
                        <BookOpen size={16} aria-hidden="true" />
                        Hojear
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => onOpen(album)} className="min-h-[40px] flex-1 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700">
                        Ver
                      </button>
                      <button type="button" onClick={() => onRestore(album)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-primary-600 px-3 text-sm font-bold text-white hover:bg-primary-700">
                        <RotateCcw size={16} aria-hidden="true" />
                        Volver a vender
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
};
