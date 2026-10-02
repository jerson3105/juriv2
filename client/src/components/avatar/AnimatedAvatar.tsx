import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { avatarImageUrl } from '../../lib/avatarApi';
import type { AvatarGender, AvatarSlot } from './AvatarRenderer';
import { BASE_Z_INDEX, layerOrderOf } from './avatarLayers';
import { SPARKLE_Y } from './closet/closetHelpers';

export interface AnimatedLayer {
  /** Identifica la prenda: si cambia, la capa entra de nuevo. */
  id: string;
  slot: AvatarSlot;
  imagePath: string;
  layerOrder?: number;
}

interface AnimatedAvatarProps {
  gender: AvatarGender;
  layers: AnimatedLayer[];
  /** Tamaño (clases de ancho y alto con la proporción del dibujo). */
  className: string;
  label: string;
  /** Sin animación (movimiento reducido): el cambio es directo. */
  animate: boolean;
}

interface Ghost extends AnimatedLayer { ghostKey: string }
interface Sparkle { key: string; y: number }

const hideBroken = (event: SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.style.visibility = 'hidden';
};
const layer = { alt: '', decoding: 'async' as const, draggable: false, onError: hideBroken };
const src = (path: string) => avatarImageUrl(path, 'md');
const RISE = [-18, -6, 8, 20];

/**
 * El personaje del espejo de «Mi personaje». Al cambiar una prenda, solo esa capa «cae en su lugar»
 * (baja 12 px y se asienta en 260 ms) mientras la anterior se desvanece, y sale un destello en su ranura.
 * Solo CSS (transform y opacity), interrumpible: un cambio nuevo reemplaza al anterior.
 */
export const AnimatedAvatar = ({ gender, layers, className, label, animate }: AnimatedAvatarProps) => {
  const previous = useRef<Map<AvatarSlot, AnimatedLayer> | null>(null);
  const timers = useRef<number[]>([]);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  // Prendas que entraron después de abrir: caen en su lugar. Lo que ya estaba al abrir no se anima.
  // Se marcan en el efecto de layout, que corre antes de pintar: el primer cuadro ya tiene la animación.
  const [entered, setEntered] = useState<ReadonlySet<string>>(() => new Set());

  useLayoutEffect(() => {
    const current = new Map(layers.map((item) => [item.slot, item]));
    const before = previous.current;
    previous.current = current;
    if (!before || !animate) return;
    const changed = [...new Set([...before.keys(), ...current.keys()])].filter((slot) => before.get(slot)?.id !== current.get(slot)?.id);
    if (changed.length === 0) return;
    const arriving = changed.flatMap((slot) => current.get(slot)?.id ?? []);
    if (arriving.length) setEntered((set) => (arriving.every((id) => set.has(id)) ? set : new Set([...set, ...arriving])));
    const stamp = `${Date.now()}`;
    // La capa anterior se queda mientras se desvanece: la ranura nunca queda vacía un instante.
    const gone = changed.flatMap((slot) => {
      const old = before.get(slot);
      return old ? [{ ...old, ghostKey: `${old.id}-${stamp}` }] : [];
    });
    if (gone.length) {
      setGhosts((list) => [...list.filter((ghost) => !changed.includes(ghost.slot)), ...gone]);
      timers.current.push(window.setTimeout(() => setGhosts((list) => list.filter((ghost) => !gone.some((item) => item.ghostKey === ghost.ghostKey))), 300));
    }
    // Destello en la ranura (si cambian muchas a la vez, como al cambiar de cuerpo, lo tapa la cortina).
    const fresh = changed.length <= 2
      ? changed.filter((slot) => SPARKLE_Y[slot] !== undefined).map((slot) => ({ key: `${slot}-${stamp}`, y: SPARKLE_Y[slot]! }))
      : [];
    if (fresh.length) {
      setSparkles((list) => [...list, ...fresh]);
      timers.current.push(window.setTimeout(() => setSparkles((list) => list.filter((sparkle) => !fresh.includes(sparkle))), 950));
    }
  }, [layers, animate]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const sorted = [...layers].sort((a, b) => layerOrderOf(a) - layerOrderOf(b));
  const zIndex = (item: AnimatedLayer) => BASE_Z_INDEX + layerOrderOf(item);
  const entering = (item: AnimatedLayer) => animate && entered.has(item.id);
  const isBackground = (item: AnimatedLayer) => item.slot === 'BACKGROUND';

  return (
    <div className={`relative ${className}`} role="img" aria-label={label}>
      {/* Fondos: solo se funden */}
      {ghosts.filter(isBackground).map((ghost) => (
        <div key={ghost.ghostKey} className="closet-out absolute inset-0 overflow-hidden" style={{ zIndex: 1 }}>
          <img {...layer} src={src(ghost.imagePath)} className="h-full w-full object-cover" />
        </div>
      ))}
      {sorted.filter(isBackground).map((item) => (
        <div key={item.id} className={`absolute inset-0 overflow-hidden ${entering(item) ? 'closet-fade' : ''}`} style={{ zIndex: 1 }}>
          <img {...layer} src={src(item.imagePath)} className="h-full w-full object-cover" />
        </div>
      ))}

      {/* La anterior debajo de la nueva (mismo zIndex: manda el orden) */}
      {ghosts.filter((ghost) => !isBackground(ghost)).map((ghost) => (
        <img {...layer} key={ghost.ghostKey} src={src(ghost.imagePath)} className="closet-out absolute inset-0 h-full w-full object-contain" style={{ zIndex: zIndex(ghost) }} />
      ))}
      <img {...layer} src={src(`/avatars/base/${gender.toLowerCase()}.png`)} className="absolute inset-0 h-full w-full object-contain" style={{ zIndex: BASE_Z_INDEX }} />
      {sorted.filter((item) => !isBackground(item)).map((item) => (
        <img
          {...layer}
          key={item.id}
          src={src(item.imagePath)}
          className={`absolute inset-0 h-full w-full object-contain ${entering(item) ? 'closet-drop' : ''}`}
          style={{ zIndex: zIndex(item) }}
        />
      ))}

      {sparkles.map((sparkle) => (
        <span key={sparkle.key} className="pointer-events-none absolute left-1/2" style={{ top: `${sparkle.y}%`, zIndex: 40 }} aria-hidden="true">
          <span className="celebrate-ring absolute -left-6 -top-6 h-12 w-12 rounded-full border-2 border-amber-300" />
          {RISE.map((dx, index) => (
            <span
              key={dx}
              className="celebrate-rise absolute -top-2 text-sm leading-none text-amber-300"
              style={{ left: `${dx / 2 - 4}px`, animationDelay: `${index * 40}ms`, '--dx': `${dx}px` } as CSSProperties}
            >
              ✦
            </span>
          ))}
        </span>
      ))}
    </div>
  );
};
