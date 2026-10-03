import { create } from 'zustand';

/**
 * Avisos para lectores de pantalla («Ahora estás en «5to A»»). La región viva vive en MainLayout, que no se
 * desmonta al cambiar de clase (el Inicio sí: tiene key por perfil).
 */
export const useAnnouncer = create<{ message: string; announce: (message: string) => void }>((set) => ({
  message: '',
  announce: (message) => {
    // Vaciar primero: el mismo texto dos veces seguidas también se anuncia.
    set({ message: '' });
    window.setTimeout(() => set({ message }), 60);
  },
}));
