import type { ThemeConfig } from './storyApi';

// Efecto animado de cada tema (la línea de la cabecera y su adorno). Lista cerrada, la misma del servidor
// (story.service EFFECT_TYPES): los dibujos viven en el cliente y del tema solo llega la clave.

export const THEME_EFFECTS = [
  'brillo', 'aurora', 'luces', 'escarcha', 'ola', 'enredadera', 'sol', 'luna', 'cometa', 'brasas', 'codigo', 'fiesta',
] as const;
export type ThemeEffect = typeof THEME_EFFECTS[number];

export const EFFECT_LABELS: Record<ThemeEffect, string> = {
  brillo: 'Destello', aurora: 'Aurora', luces: 'Luces', escarcha: 'Escarcha', ola: 'Ola', enredadera: 'Enredadera',
  sol: 'Sol', luna: 'Luna', cometa: 'Cometa', brasas: 'Brasas', codigo: 'Código', fiesta: 'Fiesta',
};

// Temas guardados antes de los efectos (o sin uno válido): el que va con su partícula, como hace el servidor
// cuando la IA no elige uno de la lista.
const BY_PARTICLE: Record<string, ThemeEffect> = {
  snow: 'escarcha', bubbles: 'ola', stars: 'cometa', fireflies: 'enredadera', leaves: 'enredadera', petals: 'sol',
  embers: 'brasas', lava: 'brasas', confetti: 'fiesta', computing: 'codigo', math: 'codigo',
};

const isEffect = (value: unknown): value is ThemeEffect => typeof value === 'string' && (THEME_EFFECTS as readonly string[]).includes(value);

export const themeEffectOf = (theme: ThemeConfig | null | undefined): ThemeEffect => {
  if (isEffect(theme?.effect)) return theme.effect;
  const particle = theme?.particles?.type;
  // Solo claves propias: un tema viejo con «constructor» no debe traer algo del prototipo.
  return particle && Object.hasOwn(BY_PARTICLE, particle) ? BY_PARTICLE[particle] : 'brillo';
};
