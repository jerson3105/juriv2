import type { SchoolLevel } from '../../../lib/schoolYearApi';
import type { SchoolSection, SectionItem } from '../../../lib/schoolSectionApi';

/** Grados de cada nivel (EBR): Inicial por edad, Primaria 1.°–6.°, Secundaria 1.°–5.° (igual que el servidor). */
export const LEVEL_GRADES: Record<SchoolLevel, number[]> = {
  INICIAL: [3, 4, 5],
  PRIMARIA: [1, 2, 3, 4, 5, 6],
  SECUNDARIA: [1, 2, 3, 4, 5],
};

/** «1.°» o «3 años». */
export const gradeLabel = (level: SchoolLevel, grade: number) => (level === 'INICIAL' ? `${grade} años` : `${grade}.°`);

/** «1.° de primaria» o «3 años». */
export const gradeHeading = (level: SchoolLevel, grade: number) =>
  level === 'INICIAL' ? `${grade} años` : `${grade}.° de ${level === 'PRIMARIA' ? 'primaria' : 'secundaria'}`;

/** «4.° Rojo» */
export const sectionName = (section: { level: SchoolLevel; grade: number; name: string }) => `${gradeLabel(section.level, section.grade)} ${section.name}`;

export type NameStyle = 'LETTERS' | 'COLORS' | 'COUNTRIES' | 'CUSTOM';
export const NAME_STYLES: { id: NameStyle; label: string }[] = [
  { id: 'LETTERS', label: 'Letras' },
  { id: 'COLORS', label: 'Colores' },
  { id: 'COUNTRIES', label: 'Países' },
  { id: 'CUSTOM', label: 'Escribir' },
];

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const COLORS = ['Rojo', 'Azul', 'Verde', 'Amarillo', 'Naranja', 'Morado', 'Celeste', 'Rosado', 'Blanco', 'Turquesa'];
const COUNTRIES = ['Perú', 'Brasil', 'Chile', 'Argentina', 'Colombia', 'México', 'Ecuador', 'Bolivia', 'Uruguay', 'Paraguay'];
const LISTS: Record<Exclude<NameStyle, 'CUSTOM'>, string[]> = { LETTERS, COLORS, COUNTRIES };

/** Máximo de secciones por grado en la creación en bloque. */
export const MAX_PER_GRADE = 10;

/** Como compara la base: sin mayúsculas ni tildes. */
export const comparable = (name: string) => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Nombre como lo guarda el servidor: sin espacios repetidos. */
export const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim();

/** Los nombres de un estilo (o los escritos, separados por comas o saltos de línea, sin repetir). */
export const namesFor = (style: NameStyle, count: number, custom: string): string[] => {
  if (style !== 'CUSTOM') return LISTS[style].slice(0, count);
  const seen = new Set<string>();
  return custom.split(/[,\n]/).map(cleanName).filter((name) => {
    if (!name || name.length > 40 || seen.has(comparable(name))) return false;
    seen.add(comparable(name));
    return true;
  });
};

/** La vista previa: cada grado × nombre, marcando las que ya existen (se omiten). */
export const planSections = (level: SchoolLevel, grades: number[], names: string[], existing: SchoolSection[]) =>
  grades.flatMap((grade) => names.map((name): SectionItem & { exists: boolean } => ({
    level,
    grade,
    name,
    exists: existing.some((s) => s.level === level && s.grade === grade && comparable(s.name) === comparable(name)),
  })));

/** Siguiente nombre para «+ Sección»: sigue el estilo de las que ya hay en el grado (letras por defecto). */
export const nextName = (taken: string[]): string | null => {
  const used = new Set(taken.map(comparable));
  const style = (Object.values(LISTS)).find((list) => taken.length > 0 && taken.every((name) => list.some((n) => comparable(n) === comparable(name)))) ?? LETTERS;
  return style.find((name) => !used.has(comparable(name))) ?? null;
};

/** Orden natural de los nombres dentro de un grado (A, B… o como estén escritos). */
export const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' });
