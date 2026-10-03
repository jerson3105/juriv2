// El sobre de figuritas: papel dorado con bordes en zigzag (un clip-path fijo, nunca animado).

const TEETH = 10;
const zigzag = (depth: number) => {
  const top = Array.from({ length: TEETH * 2 + 1 }, (_, i) => `${(i * 100) / (TEETH * 2)}% ${i % 2 === 0 ? depth : 0}%`);
  const bottom = Array.from({ length: TEETH * 2 + 1 }, (_, i) => `${100 - (i * 100) / (TEETH * 2)}% ${i % 2 === 0 ? 100 - depth : 100}%`);
  return `polygon(${[...top, ...bottom].join(', ')})`;
};
const SMALL_EDGE = zigzag(8);
const LARGE_EDGE = zigzag(3);
const paperClass = 'bg-gradient-to-br from-amber-200 via-yellow-50 to-amber-300 text-amber-950';

/** Sobre chico para el botón del kiosco. */
export const EnvelopeIcon = ({ gift = false }: { gift?: boolean }) => (
  <span className={`flex h-12 w-9 flex-shrink-0 items-center justify-center shadow-sm ${paperClass}`} style={{ clipPath: SMALL_EDGE }} aria-hidden="true">
    <span className="text-base leading-none">{gift ? '🎁' : '📖'}</span>
  </span>
);

interface EnvelopeProps {
  title: string;
  subtitle: string;
  gift?: boolean;
  /** La tira de arriba sale volando al abrir. */
  tearing?: boolean;
}

/** Sobre grande de la mesa (paso 1 de abrir). */
export const Envelope = ({ title, subtitle, gift = false, tearing = false }: EnvelopeProps) => (
  <div className="relative mx-auto h-56 w-40" aria-hidden="true">
    <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 pt-6 text-center shadow-lg ${paperClass}`} style={{ clipPath: LARGE_EDGE }}>
      <span className="text-4xl leading-none">{gift ? '🎁' : '📖'}</span>
      <span className="line-clamp-2 text-sm font-black uppercase tracking-wide">{title}</span>
      <span className="text-xs font-bold">{subtitle}</span>
    </div>
    {/* La tira para rasgar: una franja con línea punteada. */}
    <div className={`absolute inset-x-0 top-0 h-7 border-b-2 border-dashed border-amber-700/50 ${paperClass} ${tearing ? 'cc-tear' : ''}`} style={{ clipPath: LARGE_EDGE }} />
  </div>
);
