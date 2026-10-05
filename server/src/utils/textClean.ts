// Caracteres de control e invisibles (incluye los de dirección del texto): no deben quedar en nombres guardados.
const INVISIBLE = new RegExp('[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069\\ufeff]', 'g');

/** Texto limpio para nombres: NFC, sin invisibles ni espacios repetidos. */
export const cleanText = (raw: string) => raw.normalize('NFC').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();

/** Como compara la base (intercalación sin mayúsculas ni tildes). */
export const comparableText = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Escapa %, _ y \ para usar un texto del usuario dentro de LIKE. */
export const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);
