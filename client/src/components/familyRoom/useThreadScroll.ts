import { useEffect, useRef } from 'react';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Lleva al final el contenedor que desplaza la página: así el cuadro fijo de abajo no tapa lo último. */
const scrollToEnd = (from: HTMLElement | null, smooth: boolean) => {
  let node = from?.parentElement ?? null;
  while (node && !/(auto|scroll)/.test(getComputedStyle(node).overflowY)) node = node.parentElement;
  const target = node ?? document.scrollingElement;
  target?.scrollTo({ top: target.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
};

/**
 * El hilo de la sala se lee de abajo hacia arriba: al entrar baja al final, y cuando llega algo nuevo
 * lo sigue solo si ya se estaba mirando el final (no salta si se lee algo de arriba).
 * `ready`: el hilo ya está dibujado. `resetKey`: al cambiar (pestaña, clase) vuelve a bajar al final.
 */
export function useThreadScroll(latestId: string | undefined, { active, ready, resetKey }: { active: boolean; ready: boolean; resetKey: unknown }) {
  const endRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const nearEnd = useRef(true);
  const firstScroll = useRef(true);

  useEffect(() => {
    const end = endRef.current;
    const thread = threadRef.current;
    if (!end || !thread) return;
    const observer = new IntersectionObserver(([entry]) => { nearEnd.current = entry.isIntersecting; }, { rootMargin: '0px 0px 200px 0px' });
    observer.observe(end);
    // El hilo crece después del primer dibujo (letras, nombres): si se miraba el final, seguirlo.
    const growth = new ResizeObserver(() => { if (nearEnd.current) scrollToEnd(end, false); });
    growth.observe(thread);
    return () => {
      observer.disconnect();
      growth.disconnect();
    };
  }, [active, ready]);

  // Antes que el efecto de abajo: al cambiar de pestaña o de clase se baja de nuevo al final.
  useEffect(() => { firstScroll.current = true; }, [resetKey]);

  useEffect(() => {
    if (!latestId || !active) return;
    if (firstScroll.current || nearEnd.current) {
      scrollToEnd(endRef.current, !firstScroll.current && !reducedMotion());
      firstScroll.current = false;
    }
  }, [latestId, active]);

  /** Tras publicar: lo propio siempre se muestra. */
  const followEnd = () => { nearEnd.current = true; };

  return { endRef, threadRef, followEnd };
}
