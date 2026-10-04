import { blindIndex } from './piiCrypto.js';

/**
 * Documentos de identidad de estudiantes (Perú): DNI, carné de extranjería, PTP/CPP y pasaporte. Se guardan cifrados
 * (piiCrypto), se buscan por índice ciego y en pantalla se muestran enmascarados. El DNI es el usuario del alumno,
 * nunca su secreto: el secreto es el PIN.
 */
export const DOCUMENT_TYPES = ['DNI', 'CE', 'PTP', 'PASAPORTE'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

const PATTERNS: Record<DocumentType, RegExp> = {
  DNI: /^\d{8}$/,
  // Carné de extranjería, PTP/CPP y pasaporte: formatos que cambian con los años; se aceptan con holgura.
  CE: /^[A-Z0-9]{6,12}$/,
  PTP: /^[A-Z0-9]{6,12}$/,
  PASAPORTE: /^[A-Z0-9]{6,12}$/,
};

/** Sin espacios, puntos ni guiones, y en mayúsculas (los dígitos de ancho completo pasan a normales). */
export const normalizeDocument = (raw: string): string => raw.normalize('NFKC').replace(/[\s.-]/g, '').toUpperCase();

/** El número normalizado si es válido para su tipo; null si no. */
export const parseDocument = (type: DocumentType, raw: string): string | null => {
  const value = normalizeDocument(raw);
  return PATTERNS[type].test(value) ? value : null;
};

/**
 * Índice ciego del número dentro de una escuela: unicidad y entrada con DNI + PIN sin guardar el número. No incluye
 * el tipo: el alumno escribe solo el número, y un mismo número con dos tipos en una escuela no ocurre en la práctica.
 */
export const documentIndex = (schoolId: string, normalized: string): string => blindIndex(normalized, `document:${schoolId}`);

/** Para mostrar: solo los 3 últimos (•••••678). */
export const maskDocument = (normalized: string): string =>
  normalized.length <= 3 ? '•'.repeat(normalized.length) : `${'•'.repeat(Math.min(normalized.length - 3, 5))}${normalized.slice(-3)}`;
