/**
 * Utilidades para los pocos sitios donde el HTML/URLs no pasan por el escapado de React.
 */

/** Escapa texto para interpolarlo en una plantilla HTML (p. ej. ventanas de impresión). */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Devuelve la URL solo si es http(s) o una ruta relativa del propio sitio; si no, '#'.
 * React 18 todavía renderiza `href="javascript:..."`.
 */
export const safeUrl = (value: unknown): string => {
  if (typeof value !== 'string') return '#';
  const url = value.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  return '#';
};
