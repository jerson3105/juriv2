import { useCallback, useEffect, useState } from 'react';

// Preferencia por dispositivo: el profesor las tiene apagadas por defecto (proyecta y trabaja),
// el alumno encendidas (suaves). El interruptor avisa al layout con un evento.
type Scope = 'teacher' | 'student';

const EVENT = 'juried:story-particles';
const key = (scope: Scope) => `juried:story-particles:${scope}`;

const read = (scope: Scope) => {
  try {
    const value = localStorage.getItem(key(scope));
    if (value === null) return scope === 'student';
    return value === '1';
  } catch {
    return scope === 'student';
  }
};

export const useStoryParticles = (scope: Scope) => {
  const [enabled, setEnabled] = useState(() => read(scope));

  useEffect(() => {
    const sync = () => setEnabled(read(scope));
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [scope]);

  const update = useCallback((next: boolean) => {
    try {
      localStorage.setItem(key(scope), next ? '1' : '0');
    } catch {
      // Sin almacenamiento: la preferencia dura hasta recargar.
    }
    setEnabled(next);
    window.dispatchEvent(new Event(EVENT));
  }, [scope]);

  return [enabled, update] as const;
};
