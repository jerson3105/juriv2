import type { CSSProperties } from 'react';
import type { ThemeConfig } from './storyApi';
import { themeEffectOf, type ThemeEffect } from './themeEffects';

// Tema de historia "solo en acentos": las superficies siguen el modo claro/oscuro de la app y el tema
// pinta la barra lateral, la cabecera, los chips y los banners con tonos derivados que cumplen AA.

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

type RGB = [number, number, number];

const toRgb = (hex: string): RGB | null => {
  const m = HEX.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
};

const toHex = ([r, g, b]: RGB) =>
  `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB;

const luminance = ([r, g, b]: RGB) => {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

export const contrastRatio = (a: string, b: string) => {
  const ra = toRgb(a);
  const rb = toRgb(b);
  if (!ra || !rb) return 1;
  const [hi, lo] = [luminance(ra), luminance(rb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];

// Acerca un color al negro (o al blanco) lo justo para alcanzar el contraste pedido frente a `against`.
const ensureContrast = (color: RGB, against: string, ratio: number, toward: 'dark' | 'light'): string => {
  const target = toward === 'dark' ? BLACK : WHITE;
  for (let t = 0; t <= 1.0001; t += 0.04) {
    const candidate = toHex(mix(color, target, t));
    if (contrastRatio(candidate, against) >= ratio) return candidate;
  }
  return toHex(target);
};

// Superficies de referencia (Tailwind): tarjeta clara y oscura, con el tinte del chip encima.
const SURFACE_LIGHT = '#ffffff';
const SURFACE_DARK = '#1f2937';

export interface StoryAccent {
  primary: string; // fondo con texto blanco (≥ 4.5:1)
  secondary: string; // segundo tono del degradado, también con texto blanco
  sidebar: string; // barra lateral oscura: texto blanco ≥ 7:1 (así el blanco al 80 % sigue en AA)
  inkLight: string; // texto de acento sobre superficie clara teñida
  inkDark: string; // texto de acento sobre superficie oscura teñida
  rgb: string; // "r, g, b" del color original, para tintes y brillos
  emoji: string;
  title: string | null;
  particles: ThemeConfig['particles'] | null;
  /** Efecto animado de la cabecera (siempre uno: los temas sin efecto toman el de su partícula). */
  effect: ThemeEffect;
}

export const parseThemeConfig = (raw: unknown): ThemeConfig | null => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as ThemeConfig; } catch { return null; }
  }
  return raw as ThemeConfig;
};

/** Deriva los acentos accesibles de un tema; null si el tema no tiene un color principal válido. */
export const deriveStoryAccent = (raw: unknown): StoryAccent | null => {
  const theme = parseThemeConfig(raw);
  const base = toRgb(theme?.colors?.primary ?? '');
  if (!theme || !base) return null;
  const second = toRgb(theme.colors?.secondary ?? '') ?? base;
  const side = toRgb(theme.colors?.sidebar ?? '') ?? mix(base, BLACK, 0.55);

  const tintLight = toHex(mix(toRgb(SURFACE_LIGHT)!, base, 0.14));
  const tintDark = toHex(mix(toRgb(SURFACE_DARK)!, base, 0.22));

  return {
    primary: ensureContrast(base, '#ffffff', 4.6, 'dark'),
    secondary: ensureContrast(second, '#ffffff', 4.6, 'dark'),
    sidebar: ensureContrast(side, '#ffffff', 7.2, 'dark'),
    inkLight: ensureContrast(base, tintLight, 4.6, 'dark'),
    inkDark: ensureContrast(base, tintDark, 4.6, 'light'),
    rgb: base.join(', '),
    emoji: theme.banner?.emoji || '📖',
    title: theme.banner?.title || null,
    particles: theme.particles?.type ? theme.particles : null,
    effect: themeEffectOf(theme),
  };
};

/** Variables CSS para `.story-ink`, `.story-chip` y los brillos del fondo (ver index.css). */
export const storyAccentVars = (accent: StoryAccent | null): CSSProperties | undefined =>
  accent
    ? ({
        '--story-primary': accent.primary,
        '--story-secondary': accent.secondary,
        '--story-ink-light': accent.inkLight,
        '--story-ink-dark': accent.inkDark,
        '--story-rgb': accent.rgb,
      } as CSSProperties)
    : undefined;

export const accentGradient = (accent: StoryAccent, angle = 135) =>
  `linear-gradient(${angle}deg, ${accent.primary}, ${accent.secondary})`;

/**
 * Color de un clan sin texto blanco encima: franja y emblema en su color, un tinte suave de fondo y la tinta
 * derivada para el texto (≥ 4.5:1 sobre el tinte, en claro y en oscuro). Variables para `.pg-clan-*`.
 */
const clanCache = new Map<string, CSSProperties>();

export const clanVars = (color: string | null | undefined): CSSProperties => {
  const key = color ?? '';
  const cached = clanCache.get(key);
  if (cached) return cached;
  const base = toRgb(key) ?? toRgb('#6b7280')!;
  const tintLight = toHex(mix(toRgb(SURFACE_LIGHT)!, base, 0.14));
  const tintDark = toHex(mix(toRgb(SURFACE_DARK)!, base, 0.22));
  const vars = {
    '--clan': toHex(base),
    '--clan-tint': tintLight,
    '--clan-tint-dark': tintDark,
    '--clan-ink': ensureContrast(base, tintLight, 4.6, 'dark'),
    '--clan-ink-dark': ensureContrast(base, tintDark, 4.6, 'light'),
  } as CSSProperties;
  clanCache.set(key, vars);
  return vars;
};

// Solo #RRGGBB, lo mismo que exige el servidor al guardar. Los temas guardados antes de esa validación pueden traer
// cualquier texto, y dentro de una cadena CSS (`${color}18`, un degradado) ese texto podría añadir un url(…).
const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** El color si es un hex #RRGGBB; si no, el respaldo. Pásale todo color del tema antes de meterlo en una cadena CSS. */
export const safeHex = <T extends string | null>(color: unknown, fallback: T): string | T =>
  typeof color === 'string' && HEX6.test(color) ? color : fallback;

/** Un hex con transparencia («rgba(…)»); gris si no es válido. */
export const withAlpha = (color: string, alpha: number) => `rgba(${(toRgb(color) ?? [107, 114, 128]).join(', ')}, ${alpha})`;

/** Mezcla dos colores hex (t = cuánto del segundo); el primero si alguno no es válido. */
export const mixHex = (a: string, b: string, t: number) => {
  const ra = toRgb(a);
  const rb = toRgb(b);
  return ra && rb ? toHex(mix(ra, rb, t)) : a;
};
