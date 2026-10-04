/**
 * Un recurso se incrusta como Genially solo si es una URL https de genial.ly (view.genial.ly, app.genial.ly…).
 * Antes bastaba con que el texto contuviera «genially» para abrir cualquier sitio en un iframe a pantalla completa.
 */
export const isGeniallyEmbed = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'genial.ly' || url.hostname.endsWith('.genial.ly'));
  } catch {
    return false;
  }
};

/** Permisos del iframe: lo que Genially necesita, sin navegar la página de Juried ni abrir formularios arriba. */
export const GENIALLY_SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation';
