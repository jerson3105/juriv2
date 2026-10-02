import { useMemo, type SyntheticEvent } from 'react';
import { avatarImageUrl, type AvatarImageVariant } from '../../lib/avatarApi';

// Orden de las capas (de abajo hacia arriba)
// Valores negativos = detrás del personaje base (zIndex 10)
// Valores positivos = delante del personaje base
const LAYER_ORDER: Record<string, number> = {
  BACKGROUND: -10, // Fondo (lo más atrás de todo)
  FLAG: -2,     // Bandera (muy atrás)
  BACK: -1,     // Accesorios de espalda (detrás del personaje)
  SHOES: 1,     // Zapatos
  BOTTOM: 2,    // Parte inferior
  TOP: 3,       // Parte superior
  LEFT_HAND: 4, // Mano izquierda
  RIGHT_HAND: 5,// Mano derecha
  EYES: 6,      // Ojos
  HEAD: 7,      // Cabeza
  HAIR: 8,      // Pelo (encima de todo)
};

// zIndex base del personaje
const BASE_Z_INDEX = 10;

export type AvatarSlot = 'HEAD' | 'HAIR' | 'EYES' | 'TOP' | 'BOTTOM' | 'LEFT_HAND' | 'RIGHT_HAND' | 'SHOES' | 'BACK' | 'FLAG' | 'BACKGROUND';
export type AvatarGender = 'MALE' | 'FEMALE';

export interface EquippedItem {
  slot: AvatarSlot;
  imagePath: string;
  layerOrder?: number;
}

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';

interface AvatarRendererProps {
  gender: AvatarGender;
  equippedItems?: EquippedItem[];
  size?: AvatarSize;
  className?: string;
  showBase?: boolean;
  /** Nombre accesible del personaje: el lector lo lee como una imagen, no capa por capa. Sin nombre, es decorativo. */
  label?: string;
  /** Resolución de las capas: low para miniaturas (aunque se dibujen con un tamaño grande escalado). */
  detail?: 'low' | 'high';
}

// Proporción original: 255x444 (ratio ~1:1.74)
const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-[58px] h-[100px]',  // Mini avatar para listas (escalado)
  sm: 'w-16 h-[112px]',      // 64x112
  md: 'w-32 h-[224px]',      // 128x224
  lg: 'w-48 h-[336px]',      // 192x336
  xl: 'w-[255px] h-[444px]', // Tamaño exacto 255x444
  hero: 'w-32 h-[224px] xl:w-48 xl:h-[336px]', // Inicio del alumno: md y, en pantallas anchas, lg
};

// Una capa que no carga se oculta (mejor sin esa prenda que con el ícono de imagen rota).
const hideBroken = (event: SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.style.visibility = 'hidden';
};

export const AvatarRenderer = ({
  gender,
  equippedItems = [],
  size = 'md',
  className = '',
  showBase = true,
  label,
  detail,
}: AvatarRendererProps) => {
  const variant: AvatarImageVariant = (detail ?? (size === 'xs' || size === 'sm' ? 'low' : 'high')) === 'low' ? 'sm' : 'md';
  const src = (path: string) => avatarImageUrl(path, variant);
  // Las miniaturas de las listas cargan al acercarse a la pantalla; el personaje grande, de inmediato.
  const layer = { alt: '', loading: variant === 'sm' ? 'lazy' as const : 'eager' as const, decoding: 'async' as const, draggable: false, onError: hideBroken };

  // Ordenar items por capa
  const sortedItems = useMemo(() => {
    return [...equippedItems].sort((a, b) => {
      const orderA = a.layerOrder ?? LAYER_ORDER[a.slot] ?? 0;
      const orderB = b.layerOrder ?? LAYER_ORDER[b.slot] ?? 0;
      return orderA - orderB;
    });
  }, [equippedItems]);

  const basePath = `/avatars/base/${gender.toLowerCase()}.png`;

  return (
    <div
      className={`relative ${SIZE_CLASSES[size]} ${className}`}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {/* Fondo (BACKGROUND) - cubre todo el área, detrás de todo */}
      {sortedItems
        .filter(item => item.slot === 'BACKGROUND')
        .map((item, index) => (
          <div
            key={`bg-${index}`}
            className="absolute inset-0 w-full h-full overflow-hidden"
            style={{ zIndex: 1 }}
          >
            <img {...layer} src={src(item.imagePath)} className="w-full h-full object-cover" />
          </div>
        ))}

      {/* Capas de ropa/accesorios que van DETRÁS del personaje (excepto BACKGROUND) */}
      {sortedItems
        .filter(item => item.slot !== 'BACKGROUND' && (item.layerOrder ?? LAYER_ORDER[item.slot] ?? 0) < 0)
        .map((item, index) => (
          <img
            {...layer}
            key={`back-${item.slot}-${index}`}
            src={src(item.imagePath)}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ zIndex: BASE_Z_INDEX + (item.layerOrder ?? LAYER_ORDER[item.slot] ?? 0) }}
          />
        ))}

      {/* Personaje base */}
      {showBase && (
        <img
          {...layer}
          src={src(basePath)}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ zIndex: BASE_Z_INDEX }}
        />
      )}

      {/* Capas de ropa/accesorios que van DELANTE del personaje */}
      {sortedItems
        .filter(item => item.slot !== 'BACKGROUND' && (item.layerOrder ?? LAYER_ORDER[item.slot] ?? 0) >= 0)
        .map((item, index) => (
          <img
            {...layer}
            key={`front-${item.slot}-${index}`}
            src={src(item.imagePath)}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ zIndex: BASE_Z_INDEX + (item.layerOrder ?? LAYER_ORDER[item.slot] ?? 0) }}
          />
        ))}
    </div>
  );
};

// Componente de preview para la tienda
interface AvatarPreviewProps {
  gender: AvatarGender;
  currentItems: EquippedItem[];
  previewItem?: EquippedItem;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const AvatarPreview = ({
  gender,
  currentItems,
  previewItem,
  size = 'lg',
  className = '',
}: AvatarPreviewProps) => {
  // Si hay item de preview, reemplazar el del mismo slot
  const itemsWithPreview = useMemo(() => {
    if (!previewItem) return currentItems;

    const filtered = currentItems.filter(item => item.slot !== previewItem.slot);
    return [...filtered, previewItem];
  }, [currentItems, previewItem]);

  return (
    <div className={`relative ${className}`}>
      <AvatarRenderer
        gender={gender}
        equippedItems={itemsWithPreview}
        size={size}
      />

      {/* Indicador de preview */}
      {previewItem && (
        <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
          Preview
        </div>
      )}
    </div>
  );
};

export default AvatarRenderer;
