import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, X } from 'lucide-react';
import { bingoApi, bingoKeys } from '../../../lib/bingoApi';
import { FIGURES, FREE } from './bingoLogic';

const marksKey = (sessionId: string, game: number, card: number) => `bingo-marks-${sessionId}-${game}-${card}`;
const readMarks = (key: string): number[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
};

/**
 * El cartón del Bingo Estelar en la pantalla del alumno (a pantalla completa). Marca como en papel: tocar una
 * casilla la marca y otra vez la desmarca. Las marcas quedan en su dispositivo (si cambia el juego, empieza limpio).
 * El ¡Bingo! se canta en voz alta con el número del cartón: el docente lo verifica.
 */
export const StudentBingoCard = ({ profileId, onClose }: { profileId: string; onClose: () => void }) => {
  const { data, refetch, isFetching } = useQuery({ queryKey: bingoKeys.mine(profileId), queryFn: () => bingoApi.mine(profileId), staleTime: 15_000 });
  const current = data?.current ?? null;
  const key = current ? marksKey(current.sessionId, current.game, current.card) : null;
  // Las marcas son de este cartón y este juego: si cambia el juego (otra partida), se leen las de la nueva clave.
  const [stored, setStored] = useState<{ key: string | null; marks: number[] }>({ key: null, marks: [] });
  const marks = stored.key === key ? stored.marks : key ? readMarks(key) : [];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const toggle = (index: number) => {
    if (!key) return;
    if (!marks.includes(index)) navigator.vibrate?.(10);
    // Cada toque parte de lo último guardado (dos toques seguidos no se pisan).
    setStored((prev) => {
      const base = prev.key === key ? prev.marks : readMarks(key);
      const next = base.includes(index) ? base.filter((i) => i !== index) : [...base, index];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Sin almacenamiento: las marcas duran mientras el cartón está abierto.
      }
      return { key, marks: next };
    });
  };

  return createPortal(
    <div className="obs-sky fixed inset-0 z-[150] flex flex-col overflow-y-auto bg-[#0b1026] text-white" role="dialog" aria-modal="true" aria-label="Mi cartón del Bingo Estelar">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-amber-200">Bingo Estelar{current ? ` · Juego ${current.game}` : ''}</p>
            {current && <p className="truncate text-base font-semibold text-indigo-100">{current.title}</p>}
          </div>
          <button type="button" onClick={onClose} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white/10 px-3 text-sm font-bold ring-1 ring-white/25 hover:bg-white/20" aria-label="Cerrar mi cartón">
            <X size={18} aria-hidden="true" /> Cerrar
          </button>
        </div>

        {current ? (
          <>
            <p className="text-center text-[clamp(32px,9vw,56px)] font-black leading-none text-amber-200">Cartón Nº {current.card}</p>
            <div className={`grid gap-2 ${current.size === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {current.cells.map((cell, i) => {
                if (cell.key === FREE) {
                  return (
                    <div key={i} className="flex aspect-square flex-col items-center justify-center rounded-2xl bg-amber-300 text-amber-950" aria-label="Jiro, casilla libre">
                      <span className="text-3xl" aria-hidden="true">★</span>
                      <span className="text-xs font-black tracking-wide">JIRO</span>
                    </div>
                  );
                }
                const on = marks.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggle(i)}
                    aria-pressed={on}
                    className={`relative flex aspect-square min-h-[56px] items-center justify-center rounded-2xl p-1.5 text-center font-black leading-tight [hyphens:auto] [overflow-wrap:break-word] focus:outline-none focus-visible:ring-4 focus-visible:ring-white ${current.size === 3 ? 'text-[clamp(15px,4.8vw,26px)]' : 'text-[clamp(13px,3.9vw,22px)]'} ${on
                      ? 'border-[3px] border-white bg-amber-300 text-amber-950'
                      : 'border-2 border-dashed border-white/40 bg-white/5 text-white'}`}
                  >
                    {cell.text}
                    {on && <span className="bg-lit absolute right-1 top-0.5 text-base" aria-hidden="true">★</span>}
                  </button>
                );
              })}
            </div>
            <p className="rounded-2xl bg-white/10 px-4 py-3 text-center text-base font-semibold text-indigo-50">
              Marca la respuesta cuando tu profe la revele. ¿Completaste la figura? Levanta la mano y di: <strong className="text-amber-200">«¡Bingo! Cartón {current.card}»</strong>.
            </p>
            <p className="text-center text-sm text-indigo-100">Figuras: {FIGURES.map((f) => f.name).join(' → ')}</p>
          </>
        ) : (
          <div className="my-auto rounded-2xl bg-white/10 p-6 text-center">
            <p className="text-lg font-bold">{data ? 'Ahora no tienes un cartón en pantalla.' : 'Buscando tu cartón…'}</p>
            {data && <p className="mt-1 text-sm text-indigo-100">Si tu profe ya repartió los cartones, actualiza o pídele uno de papel.</p>}
          </div>
        )}

        <button type="button" onClick={() => void refetch()} disabled={isFetching} className="mx-auto inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-indigo-100 hover:bg-white/10 disabled:opacity-60">
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} aria-hidden="true" /> Actualizar
        </button>
      </div>
    </div>,
    document.body,
  );
};
