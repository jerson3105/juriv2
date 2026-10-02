import { useQuery } from '@tanstack/react-query';
import { avatarApi, type AvatarGender } from '../../lib/avatarApi';
import { AvatarRenderer } from './AvatarRenderer';

interface StudentAvatarMiniProps {
  studentProfileId: string;
  gender: AvatarGender;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** low: capas pequeñas aunque se dibuje con un tamaño grande escalado (p. ej. la Lista). */
  detail?: 'low' | 'high';
}

export const StudentAvatarMini = ({
  studentProfileId,
  gender,
  size = 'xs',
  className = '',
  detail,
}: StudentAvatarMiniProps) => {
  const { data: equippedItems = [] } = useQuery({
    queryKey: ['avatar-equipped', studentProfileId],
    queryFn: () => avatarApi.getEquippedItems(studentProfileId),
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  // Formatear items para el renderer
  const equippedForRenderer = equippedItems.map((item) => ({
    slot: item.slot,
    imagePath: item.avatarItem.imagePath,
    layerOrder: item.avatarItem.layerOrder ?? 0,
  }));

  return (
    <div className={`overflow-hidden ${className}`}>
      <AvatarRenderer
        gender={gender}
        size={size}
        equippedItems={equippedForRenderer}
        detail={detail}
      />
    </div>
  );
};
