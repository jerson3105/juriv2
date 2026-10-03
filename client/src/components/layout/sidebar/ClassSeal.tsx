import { accentGradient, type StoryAccent } from '../../../lib/storyTheme';
import { seedOf } from '../../student/home/studentHomeHelpers';

// Sin tema: un degradado propio de cada clase (el blanco da ≥ 4,7:1 en los seis), así dos clases sin
// tema nunca se ven iguales.
const PALETTE: [string, string][] = [
  ['#2563eb', '#4f46e5'],
  ['#047857', '#0f766e'],
  ['#7c3aed', '#a21caf'],
  ['#b45309', '#c2410c'],
  ['#e11d48', '#be185d'],
  ['#0e7490', '#0369a1'],
];

/** «5to A - Ciencias» → «5A»; «Prueba escuela 1C» → «PE» (como las tarjetas del profe). */
const classInitials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();

const SIZES = {
  32: 'h-8 w-8 text-xs',
  36: 'h-9 w-9 text-sm',
  40: 'h-10 w-10 text-sm',
} as const;

interface ClassSealProps {
  classroomId: string;
  name: string;
  /** Con tema: su emoji sobre los colores del tema. */
  accent: StoryAccent | null;
  size?: keyof typeof SIZES;
}

/** El emblema de una clase: identifica la clase (nunca el rol del personaje). Decorativo: el nombre va al lado. */
export const ClassSeal = ({ classroomId, name, accent, size = 36 }: ClassSealProps) => {
  const [from, to] = PALETTE[seedOf(classroomId) % PALETTE.length];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-xl font-black text-white shadow-sm ring-1 ring-white/20 ${SIZES[size]}`}
      style={{ background: accent ? accentGradient(accent) : `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {accent ? <span className={size >= 40 ? 'text-xl' : 'text-lg'}>{accent.emoji}</span> : classInitials(name)}
    </span>
  );
};

/** Destello de cuatro puntas: «estás aquí» (no una ★, que se lee como favorito o puntaje). */
export const Sparkle = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
    <path d="M8 0.6C8.55 5.1 10.9 7.45 15.4 8C10.9 8.55 8.55 10.9 8 15.4C7.45 10.9 5.1 8.55 0.6 8C5.1 7.45 7.45 5.1 8 0.6Z" />
  </svg>
);
