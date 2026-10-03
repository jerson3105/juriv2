import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentApi } from '../lib/studentApi';
import { useAuthStore } from '../store/authStore';
import { readRememberedProfileId, useStudentStore } from '../store/studentStore';

export type MyClass = Awaited<ReturnType<typeof studentApi.getMyClasses>>[number];

export type ProfileSource = 'pending' | 'selected' | 'remembered' | 'default';

type Resolution = { profile: MyClass | undefined; source: ProfileSource | null; stale: boolean };

/**
 * Qué clase está abierta, en orden: la del código con que entró por PIN → la elegida en esta pestaña →
 * la última que usó → la primera de la lista (el servidor la ordena alfabéticamente). `stale`: había una
 * recordada que ya no está en la lista.
 */
export const resolveCurrentProfile = (
  classes: MyClass[] | undefined,
  { pendingClassCode, selectedProfileId, rememberedProfileId }: {
    pendingClassCode: string | null;
    selectedProfileId: string | null;
    rememberedProfileId: string | null;
  },
): Resolution => {
  if (!classes) return { profile: undefined, source: null, stale: false };
  const byId = (id: string | null) => (id ? classes.find((profile) => profile.id === id) : undefined);
  const pending = pendingClassCode ? classes.find((profile) => profile.classroom?.code === pendingClassCode) : undefined;
  const selected = byId(selectedProfileId);
  const remembered = byId(rememberedProfileId);
  const stale = (!!selectedProfileId && !selected) || (!!rememberedProfileId && !remembered);
  if (pending) return { profile: pending, source: 'pending', stale: false };
  if (selected) return { profile: selected, source: 'selected', stale };
  if (remembered) return { profile: remembered, source: 'remembered', stale };
  return { profile: classes[0], source: classes.length ? 'default' : null, stale };
};

/** La clase abierta del alumno y cómo cambiarla. Comparte la caché ['my-classes'] (sin pedidos extra). */
export const useCurrentStudentProfile = () => {
  const userId = useAuthStore((state) => state.user?.id);
  const isStudent = useAuthStore((state) => state.user?.role === 'STUDENT');
  const query = useQuery({ queryKey: ['my-classes'], queryFn: studentApi.getMyClasses, enabled: isStudent });
  const selectedProfileId = useStudentStore((state) => state.selectedProfileId);
  const pendingClassCode = useStudentStore((state) => state.pendingClassCode);
  const storeSelect = useStudentStore((state) => state.selectProfile);

  const rememberedProfileId = useMemo(
    () => readRememberedProfileId(userId),
    // Se vuelve a leer al elegir otra clase (en esta pestaña o al volver a ella).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, selectedProfileId],
  );
  const { profile, source, stale } = useMemo(
    () => resolveCurrentProfile(query.data, { pendingClassCode, selectedProfileId, rememberedProfileId }),
    [query.data, pendingClassCode, selectedProfileId, rememberedProfileId],
  );
  const selectProfile = useCallback((profileId: string) => storeSelect(userId, profileId), [storeSelect, userId]);

  return {
    myClasses: query.data,
    profile,
    source,
    stale,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    selectProfile,
  };
};
