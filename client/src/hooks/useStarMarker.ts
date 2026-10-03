import { useLayoutEffect, useRef } from 'react';

/**
 * Posición vertical de un ítem dentro de su lista, por layout (sin transform). No basta offsetTop: mientras
 * una fila anima (la cascada al abrir un grupo), la fila pasa a ser el offsetParent y offsetTop vale 0.
 */
const offsetWithin = (element: HTMLElement, container: HTMLElement) => {
  let top = 0;
  let node: HTMLElement | null = element;
  while (node && node !== container) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return node === container ? top : element.getBoundingClientRect().top - container.getBoundingClientRect().top;
};

/**
 * El destello «estás aquí» de una lista-constelación (`.sb-list` con `.sb-marker`): se desliza hasta el ítem
 * activo (`[attr="id"]`), aparece con un «pop» la primera vez y se oculta si no hay activo. `layoutKey`
 * cambia cuando cambian las filas (cantidad u orden). Lo usan el sidebar y la lista de la ficha de alumnos.
 */
export const useStarMarker = (activeId: string | null, attr: string, layoutKey: string | number, scrollIntoView: boolean) => {
  const listRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const lastY = useRef<number | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const marker = markerRef.current;
    if (!list || !marker) return;
    const target = activeId ? list.querySelector<HTMLElement>(`[${attr}="${CSS.escape(activeId)}"]`) : null;
    if (!target) {
      marker.classList.remove('sb-marker-pop');
      marker.style.opacity = '0';
      lastY.current = null;
      return;
    }
    const y = offsetWithin(target, list) + target.offsetHeight / 2;
    if (lastY.current === null) {
      marker.style.transition = 'none';
      marker.style.transform = `translateY(${y}px)`;
      void marker.offsetHeight;
      marker.style.transition = '';
      marker.classList.remove('sb-marker-pop');
      void marker.offsetWidth;
      marker.classList.add('sb-marker-pop');
    } else {
      marker.style.transform = `translateY(${y}px)`;
    }
    marker.style.opacity = '1';
    lastY.current = y;
    if (scrollIntoView) target.scrollIntoView({ block: 'nearest' });
  }, [activeId, attr, layoutKey, scrollIntoView]);

  return { listRef, markerRef };
};
