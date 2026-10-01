import { Link } from 'react-router-dom';
import { Medal, ScrollText, Shirt, ShoppingBag, type LucideIcon } from 'lucide-react';
import { plural } from './studentHomeHelpers';

interface Tile {
  key: string;
  icon: LucideIcon;
  tint: string;
  title: string;
  state: string;
  to: string;
}

interface AccessTilesProps {
  shop: { visible: boolean; paused: boolean; prices: number[]; gold: number };
  badges: { visible: boolean; count: number; near: string | null };
  /** La clase tiene ropa para el personaje (el rol se cambia desde el bloque del personaje). */
  avatar: boolean;
  scrolls: boolean;
}

const tileClass = 'flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left transition-colors hover:border-primary-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-500';

/** Accesos con su estado real; solo aparecen los que tienen contenido. */
export const AccessTiles = ({ shop, badges, avatar, scrolls }: AccessTilesProps) => {
  const tiles: Tile[] = [];

  if (shop.visible) {
    const affordable = shop.prices.filter((price) => price <= shop.gold).length;
    tiles.push({
      key: 'shop', icon: ShoppingBag, tint: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200', title: 'Tienda', to: '/my-shop',
      state: shop.paused
        ? 'En pausa mientras descansas'
        : affordable > 0
          ? `Te alcanza para ${plural(affordable, 'premio', 'premios')}`
          : `El más barato cuesta ${Math.min(...shop.prices).toLocaleString('es')} de oro`,
    });
  }
  if (badges.visible) {
    tiles.push({
      key: 'badges', icon: Medal, tint: 'bg-violet-50 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200', title: 'Insignias', to: '/my-badges',
      state: badges.near ? `Te falta poco para «${badges.near}»` : badges.count > 0 ? `Tienes ${badges.count}` : 'Aún no tienes',
    });
  }
  if (avatar) {
    tiles.push({ key: 'avatar', icon: Shirt, tint: 'bg-fuchsia-50 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200', title: 'Mi personaje', state: 'Viste a tu personaje', to: '/my-avatar' });
  }
  if (scrolls) {
    tiles.push({ key: 'scrolls', icon: ScrollText, tint: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200', title: 'Pergaminos', state: 'Escribe a un compañero', to: '/scrolls' });
  }

  if (tiles.length === 0) return null;

  return (
    <section aria-labelledby="explore-title">
      <h2 id="explore-title" className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">Explorar</h2>
      <ul className="grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.key}>
            <Link to={tile.to} className={tileClass}>
              <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${tile.tint}`} aria-hidden="true">
                <tile.icon size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-900 dark:text-white">{tile.title}</span>
                <span className="block text-sm text-gray-700 dark:text-gray-300">{tile.state}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
