import { queryClient } from './queryClient';

// Preferencias del dispositivo que no son de la persona: sobreviven al cierre de sesión.
const KEEP = new Set(['juried-theme', 'auth-storage']);
const isUserKey = (key: string) =>
  !KEEP.has(key) && (key.startsWith('juried') || key.startsWith('question-banks'));

/**
 * Deja el navegador limpio al cerrar sesión. En las computadoras compartidas del colegio, el
 * siguiente alumno veía por un instante las clases y el XP del anterior (caché de React Query),
 * el socket seguía abierto y quedaban borradores y elecciones del docente.
 */
export const clearSessionData = async (): Promise<void> => {
  // Primero lo síncrono: si después viene una recarga, ya quedó limpio.
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      Object.keys(storage).filter(isUserKey).forEach((key) => storage.removeItem(key));
    } catch {
      // Almacenamiento bloqueado: nada que limpiar.
    }
  }
  queryClient.clear();
  try {
    // Import dinámico: socket.ts importa el store de auth.
    const { disconnectSocket } = await import('./socket');
    disconnectSocket();
  } catch {
    // Sin socket que cerrar.
  }
};
