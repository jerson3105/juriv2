import { useCallback, useEffect, useState } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Share2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import { behaviorApi, type Behavior } from '../../lib/behaviorApi';

interface ExportBehaviorsModalProps {
  classroom: Classroom;
  behaviors: Behavior[];
  selectedIds: Set<string>;
  onClose: () => void;
  onExported: () => void;
}

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

// Copia los comportamientos seleccionados a otras clases del docente.
export const ExportBehaviorsModal = ({ classroom, behaviors, selectedIds, onClose, onExported }: ExportBehaviorsModalProps) => {
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const isPresent = useIsPresent();

  const { data: myClassrooms = [], isLoading } = useQuery({
    queryKey: ['my-classrooms'],
    queryFn: () => classroomApi.getMyClassrooms(),
  });
  const otherClassrooms = myClassrooms.filter((c) => c.id !== classroom.id);
  const hasCompetencyBehaviors = behaviors.some((b) => selectedIds.has(b.id) && b.competencyId);

  const exportMutation = useMutation({
    mutationFn: () => behaviorApi.exportBehaviors({ behaviorIds: Array.from(selectedIds), targetClassroomIds: Array.from(selectedTargets) }),
    onSuccess: (result) => {
      toast.success(`${result.exported} comportamiento(s) exportado(s) a ${result.targetClassrooms} clase(s)`);
      onExported();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo exportar')),
  });

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isPresent) onClose();
  }, [isPresent, onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const toggleTarget = (id: string) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-behaviors-title"
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div>
            <h2 id="export-behaviors-title" className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
              <Share2 className="text-primary-600 dark:text-primary-400" size={20} aria-hidden="true" />
              Exportar comportamientos
            </h2>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
              {selectedIds.size} comportamiento{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Elige las clases de destino</p>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-gray-600 dark:text-gray-300">Cargando clases...</p>
          ) : otherClassrooms.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-600 dark:text-gray-300">No tienes otras clases disponibles.</p>
          ) : (
            <div className="space-y-2">
              {otherClassrooms.map((target) => {
                const sameArea = !!classroom.curriculumAreaId && classroom.curriculumAreaId === target.curriculumAreaId;
                const checked = selectedTargets.has(target.id);
                return (
                  <label
                    key={target.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                      checked
                        ? 'border-primary-400 bg-primary-50 dark:border-primary-600 dark:bg-primary-900/30'
                        : 'border-gray-200 bg-gray-50 hover:border-primary-300 dark:border-gray-600 dark:bg-gray-700/50 dark:hover:border-primary-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTarget(target.id)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-400 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{target.name}</span>
                      <span className="mt-0.5 block text-xs text-gray-600 dark:text-gray-300">
                        {!target.curriculumAreaId ? 'Sin área curricular' : sameArea ? 'Misma área curricular' : 'Área diferente'}
                      </span>
                      {hasCompetencyBehaviors && !sameArea && (
                        <span className="mt-1 flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300">
                          <AlertTriangle size={12} className="flex-shrink-0" aria-hidden="true" />
                          Las competencias no se copiarán a esta clase
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {selectedTargets.size === 0 ? 'Elige al menos una clase' : `${selectedTargets.size} clase${selectedTargets.size !== 1 ? 's' : ''}`}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => exportMutation.mutate()}
              disabled={selectedTargets.size === 0 || exportMutation.isPending}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300"
            >
              <Share2 size={16} aria-hidden="true" />
              {exportMutation.isPending ? 'Exportando...' : 'Exportar'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
