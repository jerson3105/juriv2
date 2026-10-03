import type { AvatarGender } from '../../lib/avatarApi';
import { useEquippedAvatar } from '../../hooks/useEquippedAvatar';
import { AvatarRenderer } from './AvatarRenderer';

interface StudentAvatarMiniProps {
  studentProfileId: string;
  gender: AvatarGender;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** low: capas pequeñas aunque se dibuje con un tamaño grande escalado (p. ej. la Lista). */
  detail?: 'low' | 'high';
  /** Sin el fondo equipado: lo pinta quien contiene al personaje (el escenario de la ficha). */
  hideBackground?: boolean;
}

export const StudentAvatarMini = ({
  studentProfileId,
  gender,
  size = 'xs',
  className = '',
  detail,
  hideBackground = false,
}: StudentAvatarMiniProps) => {
  const { data: equippedItems = [] } = useEquippedAvatar(studentProfileId);

  // Formatear items para el renderer
  const equippedForRenderer = equippedItems
    .filter((item) => !hideBackground || item.slot !== 'BACKGROUND')
    .map((item) => ({
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
