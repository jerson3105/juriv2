import { create } from 'zustand';

interface StudentState {
  selectedClassIndex: number;
  setSelectedClassIndex: (index: number) => void;
  /**
   * Código de la clase a abrir en cuanto lleguen "mis clases" (el alumno entró con PIN por esa
   * clase). MainLayout lo convierte en índice y lo borra.
   */
  pendingClassCode: string | null;
  setPendingClassCode: (code: string | null) => void;
}

export const useStudentStore = create<StudentState>((set) => ({
  selectedClassIndex: 0,
  setSelectedClassIndex: (index) => set({ selectedClassIndex: index }),
  pendingClassCode: null,
  setPendingClassCode: (code) => set({ pendingClassCode: code }),
}));
