import { create } from 'zustand';

// "Proyectando" (en «Modo clase», en todas las páginas del aula): oculta lo privado (energía, negativos,
// asistencia, quién falta reconocer, códigos) y calma el movimiento. Preferencia de este navegador.
const KEY = 'juried-projecting';

const read = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

interface ProjectorState {
  projecting: boolean;
  setProjecting: (value: boolean) => void;
}

export const useProjectorStore = create<ProjectorState>((set) => ({
  projecting: read(),
  setProjecting: (value) => {
    try {
      localStorage.setItem(KEY, value ? '1' : '0');
    } catch {
      // Sin almacenamiento: dura hasta recargar.
    }
    set({ projecting: value });
  },
}));
