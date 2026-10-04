import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../hooks/useSocket';

/**
 * En vivo: el alumno se entera al instante cuando su profe aprueba o pide mejorar (expedition:changed), y el
 * docente ve llegar las evidencias (expedition:review). Solo se invalidan las claves de expediciones.
 */
export const useExpeditionLive = (role: 'student' | 'teacher') => {
  const socket = useSocket();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!socket) return;
    const event = role === 'student' ? 'expedition:changed' : 'expedition:review';
    const onChange = (payload?: { expeditionId?: string }) => {
      const id = payload?.expeditionId;
      if (role === 'student') {
        void queryClient.invalidateQueries({ queryKey: ['my-expeditions'] });
        void queryClient.invalidateQueries({ queryKey: id ? ['expedition-play', id] : ['expedition-play'] });
        // Una aprobación o la parada en clase pagan XP y oro.
        void queryClient.invalidateQueries({ queryKey: ['my-classes'] });
      } else {
        void queryClient.invalidateQueries({ queryKey: ['expeditions'] });
        if (id) {
          void queryClient.invalidateQueries({ queryKey: ['expedition-review', id] });
          void queryClient.invalidateQueries({ queryKey: ['expedition', id] });
          void queryClient.invalidateQueries({ queryKey: ['expedition-board', id] });
        }
      }
    };
    socket.on(event, onChange);
    return () => {
      socket.off(event, onChange);
    };
  }, [socket, role, queryClient]);
};
