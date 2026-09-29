import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

// Cuenta animada hasta `value` (desde el valor anterior). Sin animación si el sistema pide reducir movimiento.
export const useCountUp = (value: number, duration = 900, delay = 0) => {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const fromRef = useRef(reduce ? value : 0);

  useEffect(() => {
    const from = fromRef.current;
    if (reduce || from === value) {
      fromRef.current = value;
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    let frame = 0;
    let startedAt: number | null = null;
    const tick = (now: number) => {
      if (startedAt === null) startedAt = now + delay;
      const t = Math.min(1, Math.max(0, (now - startedAt) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (value - from) * eased);
      fromRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, delay, reduce]);

  return shown;
};
