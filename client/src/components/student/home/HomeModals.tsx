import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { HomeModal } from '../../home/HomeModal';
import { cancelButton } from '../../home/homeHelpers';
import { characterClassApi } from '../../../lib/characterClassApi';
import { StudentCorreoCard } from '../../observatorio/correo/StudentCorreoCard';
import { LoginStreakWidget } from '../LoginStreakWidget';

const closeFooter = (onClose: () => void, label = 'Cerrar') => (
  <button type="button" onClick={onClose} className={cancelButton}>{label}</button>
);

interface RoleOption { id: string; name: string; icon: string; description?: string | null; isActive: boolean }

/** Elegir el rol del personaje (Guardián, Arcano…), si la clase lo deja elegir. */
export const RolePickerModal = ({ classroomId, currentId, roles, onClose }: { classroomId: string; currentId: string | null; roles: RoleOption[]; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const choose = useMutation({
    mutationFn: (roleId: string) => characterClassApi.studentChoose(classroomId, roleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-classes'] });
      onClose();
    },
    onError: () => toast.error('No se pudo cambiar tu rol'),
  });
  return (
    <HomeModal title="Elige tu rol" subtitle="Cada rol tiene su estilo. Puedes cambiarlo después." onClose={onClose} footer={closeFooter(onClose, 'Cancelar')}>
      <div className="grid grid-cols-2 gap-3">
        {roles.filter((role) => role.isActive).map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => choose.mutate(role.id)}
            disabled={choose.isPending}
            aria-pressed={currentId === role.id}
            className={`rounded-xl border-2 p-4 text-left transition-colors ${
              currentId === role.id
                ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/30'
                : 'border-gray-300 hover:border-indigo-400 dark:border-gray-600 dark:hover:border-indigo-500'
            }`}
          >
            <span className="mb-2 block text-3xl" aria-hidden="true">{role.icon}</span>
            <span className="block font-semibold text-gray-900 dark:text-white">{role.name}</span>
            {role.description && <span className="mt-1 line-clamp-2 block text-xs text-gray-700 dark:text-gray-300">{role.description}</span>}
          </button>
        ))}
      </div>
    </HomeModal>
  );
};

export const CorreoModal = ({ profileId, onClose }: { profileId: string; onClose: () => void }) => (
  <HomeModal title="💌 Correo Estelar" subtitle="Una carta amable para un compañero de tu clase" onClose={onClose} footer={closeFooter(onClose)}>
    <StudentCorreoCard profileId={profileId} embedded />
  </HomeModal>
);

/** Qué es la energía: convivencia, no notas. Inicial recupera al momento y sin pausa de tienda. */
export const EnergyModal = ({ initial, onClose }: { initial: boolean; onClose: () => void }) => (
  <HomeModal title="❤️ ¿Qué es la energía?" onClose={onClose} footer={closeFooter(onClose, 'Entendido')}>
    <div className="space-y-2 text-sm text-gray-800 dark:text-gray-100">
      <p>Tu energía muestra cómo va la convivencia en clase. <strong>No cambia tus notas.</strong></p>
      <p>Baja cuando algo no sale bien en clase.</p>
      {initial ? (
        <p>Si llega a 0, descansas un ratito y tu profe te ayuda a volver.</p>
      ) : (
        <>
          <p>Si llega a 0, descansas: la tienda se pausa, pero sigues ganando XP.</p>
          <p>Para volver, cumples una misión con tu profe y regresas con la mitad de tu energía.</p>
        </>
      )}
    </div>
  </HomeModal>
);

export const StreakModal = ({ classroomId, onClose }: { classroomId: string; onClose: () => void }) => (
  <HomeModal title="🔥 Días seguidos" subtitle="Entra a tu clase cada día para sumar y ganar regalos" size="lg" onClose={onClose} footer={closeFooter(onClose)}>
    <LoginStreakWidget classroomId={classroomId} variant="card" />
  </HomeModal>
);
