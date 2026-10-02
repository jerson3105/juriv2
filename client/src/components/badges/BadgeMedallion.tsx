import { useState } from 'react';
import { Lock } from 'lucide-react';
import { badgeImageUrl, type Badge } from '../../lib/badgeApi';
import { RARITY_STYLE } from './badgeHelpers';

type MedallionBadge = Pick<Badge, 'icon' | 'customImage' | 'rarity' | 'name'>;

interface BadgeMedallionProps {
  badge: MedallionBadge;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  locked?: boolean;
  /** Por ganar: apagada pero reconocible (sin candado: el candado dice «no puedes»). */
  dimmed?: boolean;
  /** Secreta sin descubrir: un «?» en lugar del ícono. */
  mystery?: boolean;
  // Brillos y giros continuos; en listas largas se puede dejar solo el brillo al pasar el ratón.
  animated?: boolean;
}

const SIZES = {
  sm: { box: 'h-12 w-12', icon: 'text-2xl', ring: 'inset-[-3px]', lock: 18 },
  md: { box: 'h-20 w-20', icon: 'text-4xl', ring: 'inset-[-4px]', lock: 26 },
  lg: { box: 'h-24 w-24', icon: 'text-5xl', ring: 'inset-[-5px]', lock: 30 },
  xl: { box: 'h-32 w-32', icon: 'text-6xl', ring: 'inset-[-6px]', lock: 40 },
};

const MUTED_DISC = 'bg-gradient-to-br from-gray-100 via-gray-200 to-gray-400 dark:from-gray-500 dark:via-gray-600 dark:to-gray-800';

// Medallón de insignia: disco con el color de la rareza, aro giratorio (rara en adelante),
// destello que la cruza y resplandor dorado en las legendarias.
export const BadgeMedallion = ({ badge, size = 'md', locked = false, dimmed = false, mystery = false, animated = true }: BadgeMedallionProps) => {
  const style = RARITY_STYLE[badge.rarity];
  const dims = SIZES[size];
  const isLegendary = badge.rarity === 'LEGENDARY';
  // Imagen propia que no carga (borrada o sin servidor): se muestra el ícono, nunca una imagen rota.
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const showImage = !!badge.customImage && failedImage !== badge.customImage;
  const lit = !locked && !dimmed && !mystery;

  return (
    <span className={`relative inline-flex flex-shrink-0 ${dims.box}`} aria-hidden="true">
      {style.ring && lit && (
        <span
          className={`absolute ${dims.ring} rounded-full ${animated ? (isLegendary ? 'badge-ring-spin-fast' : 'badge-ring-spin') : ''}`}
          style={{ background: style.ring }}
        />
      )}
      <span
        className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-full shadow-lg ring-2 ring-white/70 dark:ring-black/30 ${
          locked ? 'bg-gray-300 dark:bg-gray-600' : lit ? style.disc : MUTED_DISC
        } ${style.glow && animated && lit ? 'badge-glow' : ''} ${style.shine && animated && lit ? 'badge-shine-auto' : ''}`}
      >
        {/* Brillo superior para dar volumen */}
        <span className="pointer-events-none absolute inset-x-2 top-1 h-1/3 rounded-full bg-white/35 blur-[2px]" />
        {locked ? (
          <Lock size={dims.lock} className="relative text-gray-600 dark:text-gray-300" />
        ) : mystery ? (
          <span className={`relative font-black leading-none text-gray-700 dark:text-gray-100 ${dims.icon}`}>?</span>
        ) : showImage ? (
          <img
            src={badgeImageUrl(badge.customImage!)}
            alt=""
            onError={() => setFailedImage(badge.customImage)}
            className={`relative h-full w-full object-cover ${dimmed ? 'opacity-80 grayscale' : ''}`}
          />
        ) : (
          <span className={`relative leading-none drop-shadow-md ${dims.icon} ${dimmed ? 'opacity-80 grayscale' : ''}`}>{badge.icon}</span>
        )}
        {lit && <span className="badge-shine-band pointer-events-none" />}
      </span>
      {isLegendary && animated && lit && (
        <>
          <span className="badge-twinkle absolute -right-1 -top-1 text-sm text-amber-300 drop-shadow">✦</span>
          <span className="badge-twinkle absolute -bottom-1 -left-1 text-xs text-yellow-200 drop-shadow [animation-delay:1.2s]">✦</span>
        </>
      )}
    </span>
  );
};
