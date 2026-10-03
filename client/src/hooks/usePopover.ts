import { useCallback, useRef, useState } from 'react';

/** Estado de un menú flotante (`Popover`) y su botón; `close(true)` devuelve el foco al botón. */
export const usePopover = <T extends HTMLElement = HTMLButtonElement>() => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<T>(null);
  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) anchorRef.current?.focus();
  }, []);
  const toggle = useCallback(() => setOpen((value) => !value), []);
  return { open, anchorRef, close, toggle };
};
