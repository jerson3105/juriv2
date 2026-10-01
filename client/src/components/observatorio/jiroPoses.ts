import { useEffect, useRef, useState } from 'react';

// Poses de Jiro con el arte actual (copias optimizadas en /assets/jiro).
export type JiroPose =
  | 'dormido' | 'despertando' | 'confundido' | 'sobresaltado'
  | 'celebrando' | 'senalando' | 'emocionado' | 'nervioso';

export const JIRO_POSES: Record<JiroPose, string> = {
  dormido: '/assets/jiro/dormido.webp',
  despertando: '/assets/jiro/despertando.webp',
  confundido: '/assets/jiro/confundido.webp',
  sobresaltado: '/assets/jiro/sobresaltado.webp',
  celebrando: '/assets/jiro/celebrando.webp',
  senalando: '/assets/jiro/senalando.webp',
  emocionado: '/assets/jiro/emocionado.webp',
  nervioso: '/assets/jiro/nervioso.webp',
};

let preloaded = false;
/** Precarga las poses una vez: cambiar de pose no parpadea. */
export const preloadJiro = () => {
  if (preloaded || typeof Image === 'undefined') return;
  preloaded = true;
  Object.values(JIRO_POSES).forEach((src) => {
    const img = new Image();
    img.src = src;
  });
};

/**
 * Histéresis: la pose pedida debe sostenerse `settleMs` y la mostrada dura al menos `holdMs`.
 * Así Jiro no salta entre poses cuando la señal (p. ej. el ruido del aula) oscila.
 */
export const useStablePose = (pose: JiroPose, settleMs = 350, holdMs = 1200) => {
  const [shown, setShown] = useState(pose);
  const shownAt = useRef(0);
  useEffect(() => {
    if (pose === shown) return;
    const wait = Math.max(settleMs, holdMs - (Date.now() - shownAt.current));
    const id = window.setTimeout(() => {
      shownAt.current = Date.now();
      setShown(pose);
    }, wait);
    return () => window.clearTimeout(id);
  }, [pose, shown, settleMs, holdMs]);
  return shown;
};
