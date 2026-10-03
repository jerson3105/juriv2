import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { familyRoomApi, familyRoomKeys, type RoomKind, type RoomMessage, type RoomPage } from '../lib/familyRoomApi';
import { useSocket, useSocketConnected } from './useSocket';

type RoomData = InfiniteData<RoomPage, string | null>;

/** Agrega un mensaje a la página más nueva, o lo actualiza si ya estaba (llega por la respuesta y por el socket). */
const upsertMessage = (data: RoomData | undefined, message: RoomMessage): RoomData | undefined => {
  if (!data || data.pages.length === 0) return data;
  let found = false;
  const pages = data.pages.map((page) => ({
    ...page,
    messages: page.messages.map((current) => {
      if (current.id !== message.id) return current;
      found = true;
      return { ...current, ...message, seen: message.seen ?? current.seen };
    }),
  }));
  if (!found) pages[0] = { ...pages[0], messages: [...pages[0].messages, message] };
  return { ...data, pages };
};

const markDeleted = (data: RoomData | undefined, messageId: string): RoomData | undefined => data && {
  ...data,
  pages: data.pages.map((page) => ({
    ...page,
    messages: page.messages.map((m) => (m.id === messageId ? { ...m, isDeleted: true, message: null } : m)),
  })),
};

const setOpenFlag = (data: RoomData | undefined, isOpen: boolean): RoomData | undefined => data && {
  ...data,
  pages: data.pages.map((page, index) => (index === 0 ? { ...page, isOpen } : page)),
};

const byTime = (a: RoomMessage, b: RoomMessage) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

const useDocumentVisible = () => {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
};

/**
 * Sala de familias en vivo (docente o familia). Se une a la sala al montar y en cada reconexión (al
 * reconectar se pierden las salas), reconcilia con el servidor tras un corte y solo recarga por intervalo
 * mientras el socket está caído. `reading`: la sala está a la vista → marca como leído lo que llega.
 */
export function useFamilyRoom(classroomId: string | undefined, { role, reading }: { role: 'TEACHER' | 'PARENT'; reading: boolean }) {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const connected = useSocketConnected();
  const visible = useDocumentVisible();
  const key = familyRoomKeys.room(classroomId ?? '');

  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => familyRoomApi.page(classroomId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!classroomId,
    refetchInterval: connected ? false : 30_000,
  });

  const messages = useMemo(() => {
    const unique = new Map((query.data?.pages ?? []).flatMap((page) => page.messages).map((m) => [m.id, m]));
    return [...unique.values()].sort(byTime);
  }, [query.data]);
  const isOpen = query.data?.pages[0]?.isOpen ?? false;

  useEffect(() => {
    if (!socket || !classroomId) return;
    const roomKey = familyRoomKeys.room(classroomId);
    let readTimer: number | undefined;

    const join = () => socket.emit('join-chat', classroomId);
    const onConnect = () => {
      join();
      // Tras un corte pudo perderse algo: reconciliar con el servidor.
      if (queryClient.getQueryData(roomKey)) void queryClient.invalidateQueries({ queryKey: roomKey });
    };
    const onMessage = (event: { classroomId: string; message: RoomMessage }) => {
      if (event?.classroomId !== classroomId) return;
      queryClient.setQueryData<RoomData>(roomKey, (data) => upsertMessage(data, event.message));
    };
    const onDeleted = (event: { classroomId: string; messageId: string }) => {
      if (event?.classroomId !== classroomId) return;
      queryClient.setQueryData<RoomData>(roomKey, (data) => markDeleted(data, event.messageId));
    };
    const onSettings = (event: { classroomId: string; isOpen: boolean }) => {
      if (event?.classroomId !== classroomId) return;
      queryClient.setQueryData<RoomData>(roomKey, (data) => setOpenFlag(data, event.isOpen));
    };
    // Solo le llega al docente. Si varias familias leen casi a la vez, un solo refresco del «visto».
    const onRead = (event: { classroomId: string }) => {
      if (event?.classroomId !== classroomId) return;
      window.clearTimeout(readTimer);
      readTimer = window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: roomKey });
        void queryClient.invalidateQueries({ queryKey: ['family-room-readers', classroomId] });
      }, 1500);
    };

    if (socket.connected) join();
    socket.on('connect', onConnect);
    socket.on('room:message', onMessage);
    socket.on('room:message_deleted', onDeleted);
    socket.on('room:settings', onSettings);
    socket.on('room:read', onRead);
    return () => {
      window.clearTimeout(readTimer);
      socket.off('connect', onConnect);
      socket.off('room:message', onMessage);
      socket.off('room:message_deleted', onDeleted);
      socket.off('room:settings', onSettings);
      socket.off('room:read', onRead);
      // El docente está en la sala solo mientras la mira; a la familia la une el servidor y se queda.
      if (role === 'TEACHER') socket.emit('leave-chat', classroomId);
    };
  }, [socket, classroomId, queryClient, role]);

  // Leído: con la sala a la vista y la pestaña del navegador activa, al cargar y cuando llega algo nuevo.
  const latestId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!classroomId || !reading || !visible || !query.isSuccess) return;
    const timer = window.setTimeout(() => {
      familyRoomApi.markRead(classroomId)
        .then(() => queryClient.invalidateQueries({ queryKey: ['family-room-unread', classroomId] }))
        .catch(() => {});
    }, 800);
    return () => window.clearTimeout(timer);
  }, [classroomId, reading, visible, latestId, query.isSuccess, queryClient]);

  const post = useMutation({
    mutationFn: ({ kind, text }: { kind: RoomKind; text: string }) => familyRoomApi.post(classroomId!, kind, text),
    onSuccess: (message) => queryClient.setQueryData<RoomData>(key, (data) => upsertMessage(data, message)),
  });
  const remove = useMutation({
    mutationFn: (messageId: string) => familyRoomApi.remove(classroomId!, messageId),
    onSuccess: (_, messageId) => queryClient.setQueryData<RoomData>(key, (data) => markDeleted(data, messageId)),
  });
  const setOpen = useMutation({
    mutationFn: (next: boolean) => familyRoomApi.setOpen(classroomId!, next),
    onSuccess: (result) => queryClient.setQueryData<RoomData>(key, (data) => setOpenFlag(data, result.isOpen)),
  });

  return {
    query,
    messages,
    isOpen,
    connected,
    post,
    remove,
    setOpen,
    loadOlder: () => query.fetchNextPage(),
    hasOlder: !!query.hasNextPage,
    loadingOlder: query.isFetchingNextPage,
  };
}
