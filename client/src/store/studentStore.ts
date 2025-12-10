import { create } from 'zustand';

interface StudentState {
  selectedClassIndex: number;
  setSelectedClassIndex: (index: number) => void;
}

export const useStudentStore = create<StudentState>((set) => ({
  selectedClassIndex: 0,
  setSelectedClassIndex: (index) => set({ selectedClassIndex: index }),
}));
