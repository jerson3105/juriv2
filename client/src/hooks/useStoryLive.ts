import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../lib/socket';

export interface StoryUpdateEvent {
  classroomId: string;
  chapterId: string;
  kind: 'goal' | 'revealed';
}

// Evento de ventana para que las páginas reaccionen (p. ej. reproducir el final recién revelado).
export const STORY_UPDATED_EVENT = 'juried:story-updated';

/**
 * Historia en vivo: el layout se une a la sala de la clase y, cuando el profesor revela un final o
 * la clase alcanza la meta, refresca las consultas de historia y avisa a la página abierta.
 * Úsese una sola vez por clase (en el layout): al desmontarse sale de la sala.
 */
export const useStoryLive = (classroomId: string | null | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!classroomId) return;
    let socket = getSocket();
    let attached = false;

    const join = () => socket?.emit('join-classroom', classroomId);
    const onUpdate = (event: StoryUpdateEvent) => {
      if (event?.classroomId !== classroomId) return;
      queryClient.invalidateQueries({ queryKey: ['stories', classroomId] });
      queryClient.invalidateQueries({ queryKey: ['story-detail'] });
      queryClient.invalidateQueries({ queryKey: ['student-story'] });
      queryClient.invalidateQueries({ queryKey: ['chapter-factions', event.chapterId] });
      queryClient.invalidateQueries({ queryKey: ['story-recap', event.chapterId] });
      window.dispatchEvent(new CustomEvent<StoryUpdateEvent>(STORY_UPDATED_EVENT, { detail: event }));
    };

    // El socket lo abre NotificationContext al iniciar sesión: si aún no existe, se reintenta.
    const attach = () => {
      socket = getSocket();
      if (!socket) return false;
      socket.on('connect', join);
      socket.on('story:updated', onUpdate);
      if (socket.connected) join();
      attached = true;
      return true;
    };
    const timer = attach() ? undefined : window.setInterval(() => { if (attach()) window.clearInterval(timer); }, 1500);

    return () => {
      if (timer) window.clearInterval(timer);
      if (!attached || !socket) return;
      socket.off('connect', join);
      socket.off('story:updated', onUpdate);
      socket.emit('leave-classroom', classroomId);
    };
  }, [classroomId, queryClient]);
};
