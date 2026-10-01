import { createContext, useContext } from 'react';
import type { StageSound } from './observatorioSound';

export const StageContext = createContext<{ sound: StageSound; muted: boolean } | null>(null);

/** Sonido del escenario para las actividades (respeta el silencio con M). */
export const useStage = () => {
  const value = useContext(StageContext);
  if (!value) throw new Error('useStage debe usarse dentro de EscenarioObservatorio');
  return value;
};
