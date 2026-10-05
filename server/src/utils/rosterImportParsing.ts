import type ExcelJS from 'exceljs';
import type { DocumentType } from './personalDocument.js';
import { comparableText } from './textClean.js';

/**
 * Lectura de padrones en Excel (plantilla de Juried o nómina del SIAGIE): texto de cada celda, columnas reconocidas
 * por sus encabezados, fechas, grado y sección, y tipo de documento. Funciones puras: se prueban sin base de datos.
 */

export const IMPORT_FIELDS = [
  'juriedCode', 'fullName', 'lastNames', 'lastName1', 'lastName2', 'firstNames', 'documentType', 'documentNumber',
  'birthDate', 'email', 'siagieCode', 'level', 'grade', 'section', 'gradeSection',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

// Encabezados frecuentes (sin tildes, minúsculas, sin signos) para cada campo.
const SYNONYMS: Record<ImportField, string[]> = {
  juriedCode: ['codigo juried', 'codigo de juried', 'id juried', 'codigo juried no borrar'],
  fullName: ['apellidos y nombres', 'nombres y apellidos', 'estudiante', 'alumno', 'alumna', 'nombre completo', 'apellidos nombres'],
  lastNames: ['apellidos', 'apellido'],
  lastName1: ['apellido paterno', 'ap paterno', 'paterno', 'primer apellido'],
  lastName2: ['apellido materno', 'ap materno', 'materno', 'segundo apellido'],
  firstNames: ['nombres', 'nombre', 'nombre s'],
  documentType: ['tipo de documento', 'tipo documento', 'tipo doc', 'tipo de doc'],
  documentNumber: ['dni', 'numero de documento', 'nro de documento', 'nro documento', 'n documento', 'num documento', 'documento', 'numero de dni', 'n de documento', 'doc'],
  birthDate: ['fecha de nacimiento', 'fecha nacimiento', 'f nacimiento', 'nacimiento', 'fec nac', 'fecha nac'],
  email: ['correo institucional', 'correo', 'email', 'e mail', 'correo electronico'],
  siagieCode: ['codigo siagie', 'codigo del estudiante', 'cod estudiante', 'codigo estudiante', 'codigo modular estudiante'],
  level: ['nivel', 'nivel educativo'],
  grade: ['grado', 'ano', 'grado ano'],
  section: ['seccion', 'aula seccion'],
  gradeSection: ['grado y seccion', 'aula', 'grado seccion', 'salon'],
};

const headerKey = (header: string) => comparableText(header).replace(/[^a-z0-9]+/g, ' ').trim();

// «DNI» es encabezado y también el valor de la columna «Tipo de documento»: no delata una fila de encabezados.
const HEADER_WORDS = new Set(Object.values(SYNONYMS).flat().filter((key) => key !== 'dni'));

/** Un encabezado conocido («Apellidos», «Paterno»…), salvo «DNI», que también es un valor. */
export const isHeaderText = (cell: string) => !!cell && HEADER_WORDS.has(headerKey(cell));

/** Una fila de encabezados (repetida en reportes por páginas, o la segunda de un encabezado doble): dos o más celdas. */
export const isHeaderRow = (cells: string[]) => cells.filter(isHeaderText).length >= 2;

/** Qué campo es cada columna, por su encabezado (cada campo se usa una sola vez; null = no se usa). */
export const detectMapping = (headers: string[]): Array<ImportField | null> => {
  const used = new Set<ImportField>();
  return headers.map((header) => {
    const key = headerKey(header);
    if (!key) return null;
    const field = IMPORT_FIELDS.find((f) => !used.has(f) && SYNONYMS[f].includes(key));
    if (field) used.add(field);
    return field ?? null;
  });
};

/** De dónde viene el archivo, para el subtítulo del asistente. */
export const detectSource = (headers: string[]): 'JURIED' | 'SIAGIE' | 'OTHER' => {
  const keys = new Set(headers.map(headerKey));
  if ([...keys].some((k) => SYNONYMS.juriedCode.includes(k))) return 'JURIED';
  if (keys.has('codigo del estudiante') || (keys.has('apellido paterno') && keys.has('apellido materno'))) return 'SIAGIE';
  return 'OTHER';
};

const isoOf = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
};

/** Texto de una celda. `numeric`: era un número (al DNI pudo faltarle el 0 inicial). Las fórmulas valen por su resultado. */
export const cellText = (value: ExcelJS.CellValue): { text: string; numeric: boolean } => {
  if (value === null || value === undefined) return { text: '', numeric: false };
  if (value instanceof Date) {
    const iso = isoOf(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
    return { text: iso ?? '', numeric: false };
  }
  if (typeof value === 'number') return { text: String(value), numeric: true };
  if (typeof value === 'boolean') return { text: value ? 'sí' : 'no', numeric: false };
  if (typeof value === 'object') {
    if ('result' in value) return cellText((value as { result?: ExcelJS.CellValue }).result ?? null);
    if ('richText' in value) return { text: value.richText.map((r) => r.text).join(''), numeric: false };
    if ('text' in value && typeof value.text === 'string') return { text: value.text, numeric: false };
    if ('error' in value) return { text: '', numeric: false };
  }
  return { text: String(value), numeric: false };
};

/** Fecha en AAAA-MM-DD desde «14/03/2012», «14-03-2012», «2012-03-14» o un número de serie de Excel. */
export const parseDate = (text: string): string | null => {
  const value = text.trim();
  if (!value) return null;
  let m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return isoOf(Number(m[1]), Number(m[2]), Number(m[3]));
  m = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return isoOf(Number(m[3]), Number(m[2]), Number(m[1]));
  if (/^\d{5}$/.test(value)) {
    // Serie de Excel (días desde 1899-12-30).
    const date = new Date(Date.UTC(1899, 11, 30) + Number(value) * 86_400_000);
    return date.toISOString().slice(0, 10);
  }
  return null;
};

const ORDINALS: Record<string, number> = { primero: 1, primer: 1, segundo: 2, tercero: 3, tercer: 3, cuarto: 4, quinto: 5, sexto: 6 };

/** El nivel si el texto lo menciona («Primaria», «sec.», «Inicial», «4 años»). */
export const parseLevel = (text: string): 'INICIAL' | 'PRIMARIA' | 'SECUNDARIA' | null => {
  const key = comparableText(text);
  if (/\b(sec|secundaria)\b/.test(key)) return 'SECUNDARIA';
  if (/\b(prim|primaria)\b/.test(key)) return 'PRIMARIA';
  if (/\b(inicial|anos)\b/.test(key)) return 'INICIAL';
  return null;
};

/** La sección tal como se escribió (con mayúsculas y tildes): las últimas palabras del texto que coinciden. */
export const sectionLabelFrom = (original: string, section: string) => {
  const words = original.replace(/[°º]/g, ' ').trim().split(/\s+/);
  const wanted = section.split(' ');
  const tail = words.slice(-wanted.length);
  const same = tail.length === wanted.length && tail.every((w, i) => comparableText(w).replace(/[^a-z0-9]/g, '') === wanted[i].replace(/[^a-z0-9]/g, ''));
  const label = same ? tail.join(' ') : section;
  return label.length <= 2 ? label.toUpperCase() : label;
};

/**
 * Grado y sección escritos de muchas formas: «3ro B», «3° B», «3B», «3.° B», «Tercero B», «4 años Girasoles».
 * Devuelve el grado (si lo hay), el texto de la sección (para comparar) y el nivel si se menciona.
 */
export const parseGradeSection = (text: string): { level: 'INICIAL' | 'PRIMARIA' | 'SECUNDARIA' | null; grade: number | null; section: string | null } => {
  let rest = comparableText(text).replace(/[°º.]/g, ' ').replace(/\s+/g, ' ').trim();
  const level = parseLevel(rest);
  rest = rest.replace(/\b(de\s+)?(secundaria|primaria|inicial|sec|prim|grado|ano)\b/g, ' ').replace(/\s+/g, ' ').trim();
  let grade: number | null = null;
  const numeric = rest.match(/^([1-6])\s*(?:ro|do|to|er|vo|mo|no)?(?:\s+|(?=[a-z]))(.*)$/) ?? rest.match(/^([1-6])(.*)$/);
  if (numeric) {
    grade = Number(numeric[1]);
    rest = numeric[2].trim();
  } else {
    const word = Object.keys(ORDINALS).find((w) => rest.startsWith(`${w} `) || rest === w);
    if (word) {
      grade = ORDINALS[word];
      rest = rest.slice(word.length).trim();
    }
  }
  rest = rest.replace(/^(anos|seccion)\s*/, '').trim();
  return { level, grade, section: rest || null };
};

/** Tipo de documento por su texto (DNI si no se dice). */
export const parseDocumentType = (text: string): DocumentType | null => {
  const key = comparableText(text).replace(/[^a-z]/g, '');
  if (!key) return 'DNI';
  if (key === 'dni' || key.startsWith('documentonacional') || key === 'libretaelectoral') return 'DNI';
  if (key === 'ce' || key.startsWith('carne') || key.includes('extranjeria')) return 'CE';
  if (key.startsWith('pasaporte') || key === 'pas') return 'PASAPORTE';
  if (key === 'ptp' || key === 'cpp' || key.includes('permiso')) return 'PTP';
  return null;
};

/** Un documento exportado enmascarado (•••••678) no cambia nada al volver a subirlo. */
export const isMaskedDocument = (text: string) => /[•*]/.test(text);

/** Fecha de nacimiento creíble para un estudiante: entre 2 y 30 años (como el alta manual). */
export const isPlausibleBirthDate = (iso: string, now = Date.now()) => {
  const years = (now - Date.parse(`${iso}T00:00:00Z`)) / (365.25 * 86_400_000);
  return years >= 2 && years <= 30;
};
