import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, Volume2, VolumeX, X } from 'lucide-react';
import { useCelebrationStore } from '../../store/celebrationStore';
import { Jiro } from './Jiro';
import type { JiroPose } from './jiroPoses';
import { useStageSound, type StageSoundState } from './observatorioSound';
import { StageContext } from './stageContext';

// Unas pocas estrellas que titilan (solo opacidad/escala; con menos movimiento quedan fijas).
const TWINKLES = [
  [8, 12], [22, 34], [37, 9], [52, 22], [66, 7], [79, 28], [91, 15], [15, 70], [47, 84], [86, 66],
] as const;

export const StageSky = () => (
  <div className="obs-sky pointer-events-none absolute inset-0" aria-hidden="true">
    {TWINKLES.map(([x, y], i) => (
      <span
        key={i}
        className="obs-twinkle absolute h-1.5 w-1.5 rounded-full bg-amber-100"
        style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i % 5) * 0.6}s` }}
      />
    ))}
  </div>
);

export const stageControlClass =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-40';
export const stagePrimaryClass =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-black text-amber-950 hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50';

interface EscenarioProps {
  /** Nombre de la actividad (barra del docente y lectores de pantalla). */
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** Jiro en escena: centrado (Descanso) o en la esquina (el resto). */
  jiro?: { pose: JiroPose; line?: string | null; placement?: 'center' | 'corner' } | null;
  /** Acción principal: botón de la barra y Espacio/Enter. */
  primary?: { label: string; onClick: () => void; disabled?: boolean } | null;
  /** Flechas ← / → (además de Re Pág / Av Pág). */
  onPrev?: () => void;
  onNext?: () => void;
  /** Teclas propias de la actividad (V/F, números…). Devuelve true si la usó. */
  onKey?: (event: KeyboardEvent) => boolean;
  /** Estado breve en la barra ("Ronda 3 de 10"). */
  status?: ReactNode;
  /** Controles propios de la actividad en la barra del docente. */
  barExtra?: ReactNode;
  /** Sonido de la actividad (si no se pasa, el escenario crea el suyo). */
  soundState?: StageSoundState;
}

/**
 * Escenario proyectado del Observatorio: pantalla completa, cielo nocturno, Jiro y la barra del
 * docente (sólida, sin desenfoque). Teclado: Espacio/Enter acción, ←/→, Esc salir, M sonido,
 * F pantalla completa. La pantalla completa es del documento: las celebraciones se ven encima.
 */
export const EscenarioObservatorio = ({
  label, onClose, children, jiro, primary, onPrev, onNext, onKey, status, barExtra, soundState,
}: EscenarioProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const ownSound = useStageSound();
  const { sound, muted, toggleMute } = soundState ?? ownSound;
  const [isFullscreen, setIsFullscreen] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  const enteredFullscreen = useRef(false);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().then(() => { enteredFullscreen.current = true; }).catch(() => {});
    }
  }, []);

  // Teclado con referencias frescas (un solo listener).
  const keys = useRef({ onClose, primary, onPrev, onNext, onKey, toggleMute, toggleFullscreen });
  useLayoutEffect(() => {
    keys.current = { onClose, primary, onPrev, onNext, onKey, toggleMute, toggleFullscreen };
  });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      const onControl = !!target?.closest?.('button, a, [role="button"]');
      const k = keys.current;
      if (e.key === 'Escape') { e.preventDefault(); k.onClose(); return; }
      if (typing) return;
      if (k.onKey?.(e)) { e.preventDefault(); return; }
      if ((e.key === ' ' || e.key === 'Enter') && !onControl && k.primary && !k.primary.disabled) { e.preventDefault(); k.primary.onClick(); }
      else if ((e.key === 'ArrowRight' || e.key === 'PageDown') && k.onNext) { e.preventDefault(); k.onNext(); }
      else if ((e.key === 'ArrowLeft' || e.key === 'PageUp') && k.onPrev) { e.preventDefault(); k.onPrev(); }
      else if (e.key === 'm' || e.key === 'M') k.toggleMute();
      else if (e.key === 'f' || e.key === 'F') k.toggleFullscreen();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Pantalla completa (se pide al abrir: viene de un clic del docente), scroll bloqueado,
  // foco en el escenario y celebraciones por encima. Al salir, todo vuelve como estaba.
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    rootRef.current?.focus();
    useCelebrationStore.getState().setRaised(true);
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => { enteredFullscreen.current = true; }).catch(() => { /* el navegador lo impide: sigue en ventana */ });
    }
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('fullscreenchange', onChange);
      useCelebrationStore.getState().setRaised(false);
      if (enteredFullscreen.current && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  const context = useMemo(() => ({ sound, muted }), [sound, muted]);
  const placement = jiro?.placement ?? 'corner';

  return createPortal(
    <StageContext.Provider value={context}>
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="fixed inset-0 z-[180] flex flex-col overflow-hidden bg-[#0b1026] text-white outline-none"
        onPointerDown={() => sound.unlock()}
      >
        <StageSky />

        <div className={`relative z-10 flex min-h-0 flex-1 overflow-y-auto ${placement === 'corner' && jiro ? 'md:pl-[22vw]' : ''}`}>
          {/* my-auto (no justify-center): si el contenido es más alto que la pantalla, el inicio sigue visible. */}
          <div className="flex min-h-full w-full flex-col items-center px-4 py-6 sm:px-10">
            <div className="my-auto flex w-full flex-col items-center">
              {jiro && placement === 'center' && (
                <Jiro pose={jiro.pose} line={jiro.line} variant="stage" sizeClassName="h-[20vh] sm:h-[24vh]" className="mb-2 items-center" />
              )}
              {children}
            </div>
          </div>
        </div>

        {jiro && placement === 'corner' && (
          <div className="pointer-events-none absolute bottom-16 left-3 z-10 hidden w-[calc(22vw-1.5rem)] md:block">
            <Jiro
              pose={jiro.pose}
              line={jiro.line}
              variant="stage"
              sizeClassName="h-[26vh] max-h-[320px]"
              balloonTextClassName="text-[clamp(18px,2.8vh,34px)] leading-tight"
              balloonWidthClassName="max-w-full"
            />
          </div>
        )}

        <nav aria-label={`Controles de ${label}`} className="relative z-30 flex items-center gap-1 border-t border-white/10 bg-[#070b1c] px-2 py-1.5 sm:gap-2 sm:px-4">
          <button type="button" onClick={onClose} className={stageControlClass} aria-label={`Salir de ${label}`} title="Salir (Esc)">
            <X size={20} aria-hidden="true" />
            <span className="hidden sm:inline">Salir</span>
          </button>
          <span className="hidden truncate px-2 text-sm font-bold text-indigo-100 lg:inline">{label}</span>
          {status && <span className="truncate px-2 text-sm font-semibold text-indigo-100">{status}</span>}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {barExtra}
            <button type="button" onClick={toggleMute} className={stageControlClass} aria-label={muted ? 'Activar sonido' : 'Silenciar'} aria-pressed={muted} title="Sonido (M)">
              {muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
            </button>
            <button type="button" onClick={toggleFullscreen} className={stageControlClass} aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} title="Pantalla completa (F)">
              {isFullscreen ? <Minimize2 size={20} aria-hidden="true" /> : <Maximize2 size={20} aria-hidden="true" />}
            </button>
            {primary && (
              <button type="button" onClick={primary.onClick} disabled={primary.disabled} className={stagePrimaryClass}>
                {primary.label}
                <span className="hidden text-xs font-bold opacity-70 sm:inline">(Espacio)</span>
              </button>
            )}
          </div>
        </nav>
      </div>
    </StageContext.Provider>,
    document.body,
  );
};
