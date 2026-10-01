import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { primaryButton, cancelButton } from '../home/homeHelpers';

const IDLE_MS = 60 * 60 * 1000; // 60 min sin actividad
const WARNING_MS = 60 * 1000; // aviso el último minuto
const KEY = 'juried-last-activity'; // compartido entre pestañas
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

const readLast = () => {
  try {
    return Number(localStorage.getItem(KEY)) || Date.now();
  } catch {
    return Date.now();
  }
};
const writeLast = (value: number) => {
  try {
    localStorage.setItem(KEY, String(value));
  } catch {
    // Sin almacenamiento: cuenta solo esta pestaña.
  }
};

/**
 * Alumnos en computadoras compartidas del colegio: tras 60 minutos sin tocar nada se cierra la
 * sesión, con un aviso el último minuto ("Sigo aquí"). La actividad se comparte entre pestañas.
 */
export const StudentIdleGuard = () => {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const active = isAuthenticated && user?.role === 'STUDENT';
  const [remaining, setRemaining] = useState<number | null>(null);
  const lastWrite = useRef(0);
  const loggingOut = useRef(false);

  useEffect(() => {
    if (!active) return;
    writeLast(Date.now());
    const onActivity = () => {
      const now = Date.now();
      // Una escritura cada 15 s basta (no en cada movimiento).
      if (now - lastWrite.current > 15_000) {
        lastWrite.current = now;
        writeLast(now);
      }
    };
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const timer = setInterval(() => {
      const idle = Date.now() - readLast();
      if (idle >= IDLE_MS) {
        if (!loggingOut.current) {
          loggingOut.current = true;
          void logout();
        }
      } else if (idle >= IDLE_MS - WARNING_MS) {
        setRemaining(Math.ceil((IDLE_MS - idle) / 1000));
      } else {
        setRemaining(null);
      }
    }, 1_000);
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(timer);
    };
  }, [active, logout]);

  if (!active || remaining === null) return null;

  const stay = () => {
    lastWrite.current = Date.now();
    writeLast(Date.now());
    setRemaining(null);
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-text" className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-gray-800">
        <Clock size={32} className="mx-auto text-primary-600 dark:text-primary-300" aria-hidden="true" />
        <h2 id="idle-title" className="mt-3 text-lg font-bold text-gray-900 dark:text-white">¿Sigues ahí?</h2>
        <p id="idle-text" className="mt-1 text-sm text-gray-700 dark:text-gray-300">
          Cerraremos tu sesión en <strong>{remaining} s</strong> para cuidar tu cuenta.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={() => void logout()} className={cancelButton}>Salir</button>
          <button type="button" onClick={stay} autoFocus className={primaryButton}>Sigo aquí</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
