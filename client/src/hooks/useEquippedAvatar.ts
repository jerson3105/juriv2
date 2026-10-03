import { useQuery } from '@tanstack/react-query';
import { avatarApi } from '../lib/avatarApi';

export const equippedAvatarKey = (studentProfileId: string) => ['avatar-equipped', studentProfileId] as const;

/** Lo que lleva puesto el personaje de un alumno (caché de 5 minutos, compartida por quien lo dibuje). */
export const useEquippedAvatar = (studentProfileId: string) =>
  useQuery({
    queryKey: equippedAvatarKey(studentProfileId),
    queryFn: () => avatarApi.getEquippedItems(studentProfileId),
    staleTime: 5 * 60 * 1000,
  });
