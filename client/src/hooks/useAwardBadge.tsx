import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { badgeApi, type Badge, type BulkAwardResult } from '../lib/badgeApi';
import { historyApi } from '../lib/historyApi';
import { badgeAwardCountsKey } from '../components/badges/badgeHelpers';

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

// Otorga una insignia a varios alumnos con un solo aviso: cuántos la recibieron, quiénes no y por qué,
// y "Deshacer" (revierte cada otorgamiento con su XP/GP de recompensa).
export const useAwardBadge = (classroomId: string) => {
  const queryClient = useQueryClient();
  const [isAwarding, setIsAwarding] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: badgeAwardCountsKey(classroomId) });
    queryClient.invalidateQueries({ queryKey: ['badge-awards-breakdown', classroomId] });
    queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
    queryClient.invalidateQueries({ queryKey: ['history-today', classroomId] });
  };

  const undo = async (badge: Badge, result: BulkAwardResult) => {
    const toastId = toast.loading('Deshaciendo...');
    const outcomes = await Promise.allSettled(result.awarded.map((a) => historyApi.revertEntry('BADGE', a.studentBadgeId)));
    const failed = outcomes.filter((o) => o.status === 'rejected').length;
    refresh();
    if (failed === 0) toast.success(`Deshecho: ${badge.name}`, { id: toastId });
    else toast.error(`No se pudo deshacer en ${failed} de ${result.awarded.length} estudiante(s)`, { id: toastId });
  };

  // `names` resuelve el nombre visible de cada alumno para el resumen.
  const award = async (badge: Badge, studentIds: string[], names: (id: string) => string, reason?: string) => {
    if (studentIds.length === 0 || isAwarding) return null;
    setIsAwarding(true);
    try {
      const result = await badgeApi.awardBulk(badge.id, studentIds, reason);
      refresh();
      const count = result.awarded.length;
      if (count === 0) {
        toast.error(result.failed[0]?.message || 'No se pudo otorgar la insignia');
        return result;
      }
      const who = count === 1 ? names(result.awarded[0].studentProfileId) : `${count} estudiantes`;
      const skipped = result.failed.length > 0 ? ` · ${result.failed.length} no la recibieron` : '';
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            <span>{badge.icon} {badge.name} para {who}{skipped}</span>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                void undo(badge, result);
              }}
              className="shrink-0 min-h-[36px] rounded-lg border border-white/40 px-3 text-sm font-semibold text-white hover:bg-white/15"
            >
              Deshacer
            </button>
          </span>
        ),
        { duration: 8000 },
      );
      return result;
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo otorgar la insignia'));
      return null;
    } finally {
      setIsAwarding(false);
    }
  };

  return { award, isAwarding };
};
