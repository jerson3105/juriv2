import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { activityApi, activityKeys, type ActivitySession, type ActivityType } from '../../lib/activityApi';

const SAVE_DELAY_MS = 1500;

/**
 * Partida de una actividad del Observatorio: la crea, autoguarda el estado (agrupado cada 1,5 s y
 * al salir) para reanudar otro día, y la termina con su resumen para la Bitácora. Con `expeditionStopId`
 * se juega desde una parada «en clase»: su recompensa marca la parada (sin pagarla dos veces).
 */
export const useActivitySession = <S, R = Record<string, unknown>>(
  classroomId: string,
  type: ActivityType,
  resume?: ActivitySession<S, R> | null,
  expeditionStopId?: string | null,
) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<ActivitySession<S, R> | null>(resume ?? null);
  const sessionRef = useRef(session);
  const pending = useRef<S | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const refreshOverview = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: activityKeys.overview(classroomId) }),
    [queryClient, classroomId],
  );

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const current = sessionRef.current;
    const state = pending.current;
    if (!current || current.status !== 'ACTIVE' || state === null) return;
    pending.current = null;
    try {
      await activityApi.saveState(current.id, state);
    } catch {
      // Sin conexión: se reintenta con el próximo guardado (si no llegó uno más nuevo).
      if (pending.current === null) pending.current = state;
    }
  }, []);

  const start = useCallback(async (state: S, title?: string | null) => {
    const created = await activityApi.create<S>(classroomId, type, { title: title ?? null, state, expeditionStopId: expeditionStopId ?? null });
    const typed = created as ActivitySession<S, R>;
    sessionRef.current = typed;
    setSession(typed);
    refreshOverview();
    return typed;
  }, [classroomId, type, expeditionStopId, refreshOverview]);

  const save = useCallback((state: S) => {
    pending.current = state;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
  }, [flush]);

  const finish = useCallback(async (result: R, state?: S) => {
    window.clearTimeout(timer.current);
    pending.current = null;
    const current = sessionRef.current;
    if (!current) return null;
    const finished = await activityApi.finish<S, R>(current.id, result, state);
    sessionRef.current = finished;
    setSession(finished);
    refreshOverview();
    return finished;
  }, [refreshOverview]);

  const abandon = useCallback(async () => {
    window.clearTimeout(timer.current);
    pending.current = null;
    const current = sessionRef.current;
    if (current?.status === 'ACTIVE') await activityApi.abandon(current.id).catch(() => {});
    refreshOverview();
  }, [refreshOverview]);

  // Al salir (o cerrar la pestaña) no se pierde el último cambio.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      void flush().then(refreshOverview);
    };
  }, [flush, refreshOverview]);

  return { session, setSession, start, save, flush, finish, abandon };
};
