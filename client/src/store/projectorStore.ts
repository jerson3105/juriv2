import { create } from 'zustand';

// "Proyectando": la Lista oculta la energía (HP) y quién descansa. Preferencia de este navegador.
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
