import { create } from 'zustand';

/*
 * La clase abierta se recuerda por id de perfil, nunca por posición (era un índice en memoria: al
 * recargar volvía a la primera). En sessionStorage vale para esta pestaña; en localStorage, como «la
 * última que usó» este alumno en este equipo. Las claves son por alumno y empiezan con «juried»:
 * cerrar sesión las borra (sessionCleanup) y el siguiente en la PC compartida no hereda nada.
 */
const classKey = (userId: string) => `juried-class:${userId}`;

export const readRememberedProfileId = (userId: string | undefined): string | null => {
  if (!userId) return null;
  try {
    return sessionStorage.getItem(classKey(userId)) ?? localStorage.getItem(classKey(userId));
  } catch {
    return null;
  }
};

const writeRememberedProfileId = (userId: string, profileId: string | null) => {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      if (profileId) storage.setItem(classKey(userId), profileId);
      else storage.removeItem(classKey(userId));
    } catch {
      // Sin almacenamiento: dura hasta recargar.
    }
  }
};

interface StudentState {
  /** Clase elegida en esta pestaña (id de perfil). null: se resuelve con la recordada o la primera. */
  selectedProfileId: string | null;
  selectProfile: (userId: string | undefined, profileId: string) => void;
  /** La clase recordada ya no está en la lista (la archivaron o lo quitaron): se olvida. */
  forgetProfile: (userId: string | undefined) => void;
  /**
   * Código de la clase a abrir en cuanto lleguen "mis clases" (el alumno entró con PIN por esa
   * clase). Manda sobre la recordada; MainLayout la vuelve la elegida y lo borra.
   */
  pendingClassCode: string | null;
  setPendingClassCode: (code: string | null) => void;
  /**
   * Ya terminó lo que ocurre al entrar (historia, premio de racha y celebración): el inicio puede
   * dar "Lo nuevo" por visto. Lo mantiene StudentEntryEffects.
   */
  entrySettled: boolean;
  setEntrySettled: (settled: boolean) => void;
}

export const useStudentStore = create<StudentState>((set) => ({
  selectedProfileId: null,
  selectProfile: (userId, profileId) => {
    if (userId) writeRememberedProfileId(userId, profileId);
    set({ selectedProfileId: profileId });
  },
  forgetProfile: (userId) => {
    if (userId) writeRememberedProfileId(userId, null);
    set({ selectedProfileId: null });
  },
  pendingClassCode: null,
  setPendingClassCode: (code) => set({ pendingClassCode: code }),
  entrySettled: false,
  setEntrySettled: (settled) => set({ entrySettled: settled }),
}));
