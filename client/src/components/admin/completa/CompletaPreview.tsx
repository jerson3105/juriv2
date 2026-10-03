import { useEffect, useRef, useState } from 'react';
import { avatarImageUrl, type AvatarGender, type AvatarSlot } from '../../../lib/avatarApi';
import type { AdminAvatarItem } from '../../../lib/adminAvatarItemsApi';
import { BASE_Z_INDEX, LAYER_ORDER } from '../../avatar/avatarLayers';
import { CANVAS_H, CANVAS_W } from './completaAnchors';

interface CompletaPreviewProps {
  /** Canvas de 395×959 con la capa final (se copia a cada vista). */
  layer: HTMLCanvasElement | null;
  /** Cambia cada vez que la capa se vuelve a dibujar. */
  version: string;
  thumb: HTMLCanvasElement | null;
  gender: AvatarGender;
  slot: AvatarSlot;
  /** Prendas iniciales publicadas de este cuerpo (la vista «Vestida»). */
  defaults: AdminAvatarItem[];
}

/** Copia la capa en un canvas propio (cada vista tiene el suyo). */
const LayerCopy = ({ layer, version, className, style }: { layer: HTMLCanvasElement | null; version: string; className: string; style?: React.CSSProperties }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !layer) return undefined;
    // El editor (padre) dibuja la capa en su propio efecto, que corre después de los de los hijos.
    const frame = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.drawImage(layer, 0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [layer, version]);
  return <canvas ref={ref} width={CANVAS_W} height={CANVAS_H} className={className} style={style} aria-hidden="true" />;
};

/** Así se verá: sola sobre el cuerpo y vestida con las iniciales, en claro o de noche, y la tarjeta. */
export const CompletaPreview = ({ layer, version, thumb, gender, slot, defaults }: CompletaPreviewProps) => {
  const [dressed, setDressed] = useState(true);
  const [night, setNight] = useState(false);
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const order = LAYER_ORDER[slot] ?? 0;
  const base = avatarImageUrl(`/avatars/base/${gender === 'MALE' ? 'male' : 'female'}.png`, 'md');
  const others = dressed ? defaults.filter((item) => item.gender === gender && item.slot !== slot && item.slot !== 'BACKGROUND') : [];

  useEffect(() => {
    const canvas = thumbRef.current;
    if (!canvas || !thumb) return undefined;
    const frame = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 192, 192);
      ctx.drawImage(thumb, 0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [thumb, version]);

  return (
    <section aria-labelledby="preview-title" className="pg-surface space-y-3 p-4">
      <h2 id="preview-title" className="text-sm font-bold">Así se verá</h2>
      <div className="flex flex-wrap gap-2">
        <div className="pg-seg" role="group" aria-label="Vista">
          <button type="button" className="pg-seg-item" aria-pressed={!dressed} onClick={() => setDressed(false)}>Sola</button>
          <button type="button" className="pg-seg-item" aria-pressed={dressed} onClick={() => setDressed(true)}>Vestida</button>
        </div>
        <div className="pg-seg" role="group" aria-label="Fondo">
          <button type="button" className="pg-seg-item" aria-pressed={!night} onClick={() => setNight(false)}>Claro</button>
          <button type="button" className="pg-seg-item" aria-pressed={night} onClick={() => setNight(true)}>Noche</button>
        </div>
      </div>
      <div className={`relative mx-auto aspect-[395/959] w-full max-w-[14rem] overflow-hidden rounded-xl ${night ? 'obs-sky' : 'bg-[#eceff6]'}`}>
        {slot === 'BACKGROUND' ? (
          <LayerCopy layer={layer} version={version} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            {others.map((item) => (
              <img
                key={item.id}
                src={avatarImageUrl(item.imagePath, 'md')}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
                style={{ zIndex: BASE_Z_INDEX + (LAYER_ORDER[item.slot] ?? 0) }}
              />
            ))}
            <img src={base} alt="" className="absolute inset-0 h-full w-full object-contain" style={{ zIndex: BASE_Z_INDEX }} />
            <LayerCopy layer={layer} version={version} className="absolute inset-0 h-full w-full" style={{ zIndex: BASE_Z_INDEX + order }} />
          </>
        )}
        {slot === 'BACKGROUND' && <img src={base} alt="" className="absolute inset-0 z-[11] h-full w-full object-contain" />}
      </div>
      <div>
        <p className="pg-fg2 text-xs">En la tarjeta de la tienda y del clóset:</p>
        <div className="mt-1 flex justify-center rounded-xl border border-[var(--pg-line)] bg-gradient-to-b from-slate-50 to-slate-200 p-3 dark:from-slate-700 dark:to-slate-800">
          <canvas ref={thumbRef} width={192} height={192} className="h-24 w-24" aria-label="Miniatura de la prenda" role="img" />
        </div>
      </div>
    </section>
  );
};
