import { Check } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import type { ThemeConfig } from '../../lib/storyApi';
import { accentGradient, deriveStoryAccent } from '../../lib/storyTheme';
import { EFFECT_LABELS } from '../../lib/themeEffects';
import { ThemeHeaderLine, ThemeOrnament } from '../story/ThemeEffects';

interface ThemeSwatchProps {
  theme: ThemeConfig | null;
  name: string;
  selected: boolean;
  onSelect: () => void;
}

// Botón de tema: miniatura con la barra lateral y el acento tal como se verán (tonos ya ajustados a AA).
export const ThemeSwatch = ({ theme, name, selected, onSelect }: ThemeSwatchProps) => {
  const accent = deriveStoryAccent(theme);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative flex min-h-[44px] flex-col overflow-hidden rounded-xl border-2 text-left transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 ${
        selected ? 'border-primary-600 dark:border-primary-400' : 'border-gray-200 dark:border-gray-600'
      }`}
    >
      <span className="flex h-14 w-full" aria-hidden="true">
        {accent ? (
          <>
            <span className="flex w-1/3 flex-col gap-1 p-1.5" style={{ backgroundColor: accent.sidebar }}>
              <span className="h-1.5 w-full rounded-full" style={{ background: accentGradient(accent, 90) }} />
              <span className="h-1.5 w-3/4 rounded-full bg-white/40" />
              <span className="h-1.5 w-2/3 rounded-full bg-white/40" />
            </span>
            <span className="relative flex flex-1 items-center justify-center bg-slate-100 text-2xl dark:bg-gray-900">
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: accentGradient(accent, 90) }} />
              {accent.emoji}
              {/* Su adorno, quieto: siete miniaturas animadas a la vez distraerían. */}
              <ThemeOrnament accent={accent} level="off" className="absolute bottom-0.5 right-0.5 h-6 w-6" />
            </span>
          </>
        ) : (
          <span className="flex flex-1 items-center justify-center bg-gray-100 text-2xl dark:bg-gray-700">🚫</span>
        )}
      </span>
      <span className="flex items-center justify-between gap-1 bg-white px-2 py-1.5 dark:bg-gray-800">
        <span className="truncate text-xs font-semibold text-gray-800 dark:text-gray-100">{name}</span>
        {selected && <Check size={14} className="flex-shrink-0 text-primary-700 dark:text-primary-300" aria-hidden="true" />}
      </span>
    </button>
  );
};

// Vista previa más grande: barra lateral, cabecera con el filo del acento y una tarjeta neutra con chip.
export const ThemePreview = ({ theme, title }: { theme: ThemeConfig | null; title: string }) => {
  const accent = deriveStoryAccent(theme);
  const reduceMotion = useReducedMotion();
  if (!accent) {
    return (
      <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-gray-300 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">
        Sin tema: la clase conserva los colores de Juried.
      </div>
    );
  }
  return (
    <div className="flex h-36 overflow-hidden rounded-xl border border-gray-200 shadow-sm dark:border-gray-700" aria-label={`Vista previa del tema ${title}`} role="img">
      <div className="flex w-1/4 flex-col gap-1.5 p-2" style={{ backgroundColor: accent.sidebar }}>
        <span className="rounded-md px-1.5 py-1 text-xs font-semibold text-white" style={{ background: accentGradient(accent, 90) }}>Estudiantes</span>
        <span className="px-1.5 text-xs text-white/85">Historia</span>
        <span className="px-1.5 text-xs text-white/85">Tienda</span>
      </div>
      <div className="flex flex-1 flex-col bg-slate-50 dark:bg-gray-900" style={{ ['--story-ink-light' as string]: accent.inkLight, ['--story-ink-dark' as string]: accent.inkDark, ['--story-rgb' as string]: accent.rgb }}>
        <div className="relative flex h-9 items-center gap-2 bg-white px-2 dark:bg-gray-800">
          <span className="flex h-6 w-6 items-center justify-center rounded-md text-sm" style={{ background: accentGradient(accent) }}>{accent.emoji}</span>
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-gray-900 dark:text-white">{title}</span>
          {/* El efecto del tema tal como se verá en la cabecera (con movimiento, salvo «reducir movimiento»). */}
          <span className="shrink-0 text-xs font-semibold text-gray-700 dark:text-gray-300">{EFFECT_LABELS[accent.effect]}</span>
          <ThemeOrnament accent={accent} level={reduceMotion ? 'off' : 'full'} className="h-7 w-7" />
          <ThemeHeaderLine accent={accent} level={reduceMotion ? 'off' : 'full'} />
        </div>
        <div className="m-2 flex-1 rounded-lg bg-white p-2 dark:bg-gray-800">
          <span className="story-chip inline-block rounded-full px-2 py-0.5 text-xs font-semibold">Capítulo 1</span>
          <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">El contenido conserva sus colores legibles.</p>
        </div>
      </div>
    </div>
  );
};
