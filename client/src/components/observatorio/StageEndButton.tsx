import { useEffect, useState } from 'react';
import { Square } from 'lucide-react';
import { stageControlClass } from './EscenarioObservatorio';

/** "Terminar" de la barra del docente: pide un segundo toque (3 s) para no cerrar por error. */
export const StageEndButton = ({ onEnd, label = 'Terminar' }: { onEnd: () => void; label?: string }) => {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(id);
  }, [armed]);
  return (
    <button
      type="button"
      onClick={() => (armed ? onEnd() : setArmed(true))}
      className={`${stageControlClass} ${armed ? 'bg-rose-500/30 ring-2 ring-rose-300' : ''}`}
      aria-live="polite"
    >
      <Square size={18} aria-hidden="true" />
      {armed ? '¿Terminar? Toca otra vez' : label}
    </button>
  );
};
