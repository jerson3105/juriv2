/**
 * Texto de la sala de familias: se guarda limpio para que nadie pueda disfrazar un mensaje.
 * - NFC: la misma letra se guarda siempre igual.
 * - Fuera: caracteres de control (salvo salto de línea y tabulación), los que invierten la dirección
 *   del texto (U+202A–U+202E, U+2066–U+2069) y los invisibles de ancho cero.
 * - Como mucho dos líneas vacías seguidas; sin espacios al principio ni al final.
 */
export const MESSAGE_MAX_LENGTH = 2000;

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const BIDI = /[‪-‮⁦-⁩‎‏؜]/g;
const ZERO_WIDTH = /[​-‍⁠﻿­]/g;

export const cleanMessageText = (raw: string): string =>
  raw
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL, '')
    .replace(BIDI, '')
    .replace(ZERO_WIDTH, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
