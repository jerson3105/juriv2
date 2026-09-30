import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { behaviorApi, type ApplyResult, type Behavior } from '../lib/behaviorApi';
import { historyApi } from '../lib/historyApi';
import { formatBehaviorRewards } from '../lib/behaviorPoints';
import { behaviorUsageKey, useBehaviorUsage } from './useBehaviorUsage';
import { useSound } from './useSound';

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

// Aplica un comportamiento a uno o varios alumnos fuera de la Lista (herramientas del aula) con el
// mismo contrato que la Lista: aviso con "Deshacer" (revierte el registro de cada alumno), sonido y
// registro de uso para "los más usados".
export const useApplyWithUndo = (classroomId: string) => {
  const queryClient = useQueryClient();
  const usage = useBehaviorUsage(classroomId);
  const { play } = useSound();
  const [isApplying, setIsApplying] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
    queryClient.invalidateQueries({ queryKey: ['history-today', classroomId] });
    // Perfil del alumno: resumen y registro.
    queryClient.invalidateQueries({ queryKey: ['student-summary', classroomId] });
    queryClient.invalidateQueries({ queryKey: ['student-activity', classroomId] });
  };

  const undo = async (result: ApplyResult) => {
    const ids = result.results.map((r) => r.pointLogEntryId).filter((id): id is string => Boolean(id));
    if (ids.length === 0) {
      toast.error('No se pudo identificar lo aplicado para deshacerlo');
      return;
    }
    const toastId = toast.loading('Deshaciendo...');
    const outcomes = await Promise.allSettled(ids.map((id) => historyApi.revertEntry('POINTS', id)));
    const failed = outcomes.filter((o) => o.status === 'rejected').length;
    refresh();
    queryClient.invalidateQueries({ queryKey: behaviorUsageKey(classroomId) });
    if (failed === 0) toast.success(`Deshecho: ${result.behavior.name}`, { id: toastId });
    else toast.error(`No se pudo deshacer en ${failed} de ${ids.length} estudiante(s)`, { id: toastId });
  };

  // multiplier: fracción del puntaje (1 = completo, 0.5 = la mitad…), como en la Lista.
  const apply = async (behavior: Behavior, studentIds: string[], who: string, multiplier?: number) => {
    if (studentIds.length === 0 || isApplying) return null;
    setIsApplying(true);
    try {
      const result = await behaviorApi.apply({ behaviorId: behavior.id, studentIds, ...(multiplier !== undefined && multiplier !== 1 ? { multiplier } : {}) });
      usage.recordUse(behavior.id);
      play(behavior.isPositive ? 'pointsGain' : 'pointsLoss');
      refresh();
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            <span>{who}: {formatBehaviorRewards(behavior)} — {behavior.name}</span>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                void undo(result);
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
      toast.error(errorMessage(error, 'No se pudieron aplicar los puntos'));
      return null;
    } finally {
      setIsApplying(false);
    }
  };

  return { apply, isApplying, mostUsed: usage.mostUsed };
};
