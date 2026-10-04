import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Check, Heart, Plus, Share2, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Classroom } from '../../lib/classroomApi';
import { behaviorApi, type Behavior, type GeneratedBehavior } from '../../lib/behaviorApi';
import { useBehaviorUsage } from '../../hooks/useBehaviorUsage';
import { BehaviorRow } from '../../components/behaviors/BehaviorRow';
import { BehaviorFormModal, type BehaviorFormData, type BehaviorFormTarget } from '../../components/behaviors/BehaviorFormModal';
import { AIBehaviorModal } from '../../components/behaviors/AIBehaviorModal';
import { ExportBehaviorsModal } from '../../components/behaviors/ExportBehaviorsModal';
import { TutorialButton } from '../../components/tutorials/TutorialButton';
import { readSort, saveSort, sortBehaviors, type BehaviorSort } from '../../components/behaviors/behaviorHelpers';
import { SwitchRow } from '../../components/settings/settingsUi';
import { useClassroomSettingsSave } from '../../components/settings/settingsHooks';

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const secondaryButton =
  'inline-flex min-h-[44px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 transition-colors hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';
const primaryButton =
  'inline-flex min-h-[44px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white shadow-md shadow-primary-600/25 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 disabled:shadow-none dark:disabled:bg-gray-700 dark:disabled:text-gray-300';

const toBehaviorData = (b: GeneratedBehavior, classroomId: string) => ({
  classroomId,
  name: b.name,
  description: b.description,
  pointType: b.xpValue > 0 ? 'XP' as const : b.hpValue > 0 ? 'HP' as const : 'GP' as const,
  pointValue: Math.max(b.xpValue, b.hpValue, b.gpValue),
  xpValue: b.xpValue,
  hpValue: b.hpValue,
  gpValue: b.gpValue,
  isPositive: b.isPositive,
  icon: b.icon,
  competencyId: b.competencyId || undefined,
});

export const BehaviorsPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom }>();
  const queryClient = useQueryClient();
  const behaviorsKey = ['behaviors', classroom.id];
  const [formTarget, setFormTarget] = useState<BehaviorFormTarget | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<BehaviorSort>(readSort);
  const { usageById } = useBehaviorUsage(classroom.id);
  const { save: saveSetting } = useClassroomSettingsSave(classroom);
  const showNegatives = classroom.allowNegativePoints !== false;

  const { data: behaviors = [], isLoading } = useQuery({
    queryKey: behaviorsKey,
    queryFn: () => behaviorApi.getByClassroom(classroom.id),
  });

  const refreshBehaviors = () => queryClient.invalidateQueries({ queryKey: behaviorsKey });

  const positives = useMemo(() => sortBehaviors(behaviors.filter((b) => b.isPositive), sort, usageById), [behaviors, sort, usageById]);
  const negatives = useMemo(() => sortBehaviors(behaviors.filter((b) => !b.isPositive), sort, usageById), [behaviors, sort, usageById]);

  const saveMutation = useMutation({
    // Al editar, "" borra la descripción y null quita la competencia; al crear, los vacíos se omiten.
    mutationFn: ({ data, id }: { data: BehaviorFormData; id?: string }) =>
      id
        ? behaviorApi.update(id, { ...data, description: data.description ?? '' })
        : behaviorApi.create({
            ...data,
            classroomId: classroom.id,
            competencyId: data.competencyId ?? undefined,
            competencyIndicatorId: data.competencyIndicatorId ?? undefined,
          }),
  });

  const handleSave = async (data: BehaviorFormData, another: boolean) => {
    const id = formTarget?.kind === 'edit' ? formTarget.behavior.id : undefined;
    try {
      await saveMutation.mutateAsync({ data, id });
      refreshBehaviors();
      toast.success(id ? `Guardado: ${data.name}` : `Creado: ${data.name}`);
      if (!another) setFormTarget(null);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar el comportamiento'));
      return false;
    }
  };

  const restore = async (behavior: Behavior) => {
    try {
      await behaviorApi.restore(behavior.id);
      toast.success(`Restaurado: ${behavior.name}`);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo restaurar'));
    } finally {
      refreshBehaviors();
    }
  };

  // Se quita de la lista al instante; "Deshacer" lo reactiva en el servidor.
  const handleDelete = async (behavior: Behavior) => {
    await queryClient.cancelQueries({ queryKey: behaviorsKey });
    const previous = queryClient.getQueryData<Behavior[]>(behaviorsKey);
    queryClient.setQueryData<Behavior[]>(behaviorsKey, (current = []) => current.filter((b) => b.id !== behavior.id));
    try {
      await behaviorApi.delete(behavior.id);
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            <span>Eliminado: {behavior.name}</span>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                void restore(behavior);
              }}
              className="shrink-0 min-h-[36px] rounded-lg border border-white/40 px-3 text-sm font-semibold text-white hover:bg-white/15"
            >
              Deshacer
            </button>
          </span>
        ),
        { duration: 8000 },
      );
    } catch (error) {
      queryClient.setQueryData(behaviorsKey, previous);
      toast.error(errorMessage(error, 'No se pudo eliminar'));
    } finally {
      refreshBehaviors();
    }
  };

  // Importación en lote con un único aviso de resultado.
  const handleImport = async (generated: GeneratedBehavior[]) => {
    const outcomes = await Promise.allSettled(generated.map((b) => behaviorApi.create(toBehaviorData(b, classroom.id))));
    const created = outcomes.filter((o) => o.status === 'fulfilled').length;
    const failed = generated.length - created;
    refreshBehaviors();
    if (created === 0) {
      toast.error('No se pudo importar ningún comportamiento');
      return;
    }
    if (failed === 0) toast.success(`Se importaron ${created} comportamiento${created !== 1 ? 's' : ''}`);
    else toast.error(`Se importaron ${created} de ${generated.length}; ${failed} fallaron`);
    setShowAIModal(false);
  };

  const changeSort = (next: BehaviorSort) => {
    setSort(next);
    saveSort(next);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (list: Behavior[]) => {
    const allSelected = list.every((b) => selectedIds.has(b.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      list.forEach((b) => (allSelected ? next.delete(b.id) : next.add(b.id)));
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-2xl bg-white/60 dark:bg-gray-800/60" />
        ))}
      </div>
    );
  }

  const columns = [
    {
      key: 'positive',
      title: 'Para dar puntos',
      list: positives,
      icon: Sparkles,
      header: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40',
      badge: 'bg-emerald-600',
      titleClass: 'text-emerald-900 dark:text-emerald-100',
      empty: 'Premia con un clic acciones como "Participación" o "Tarea completa".',
      isPositive: true,
    },
    {
      key: 'negative',
      title: 'Para quitar puntos',
      list: negatives,
      icon: Heart,
      header: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
      badge: 'bg-red-600',
      titleClass: 'text-red-900 dark:text-red-100',
      empty: 'Descuenta puntos por acciones como "Interrumpe la clase" o "Tarea incompleta".',
      isPositive: false,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-600 text-white shadow-lg shadow-primary-600/30" aria-hidden="true">
            <Sparkles size={22} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Comportamientos</h1>
              <TutorialButton id="comportamientos" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Acciones rápidas para dar o quitar puntos en clase</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectionMode ? (
            <>
              <button type="button" onClick={exitSelectionMode} className={secondaryButton}>
                <X size={16} aria-hidden="true" />
                Cancelar
              </button>
              <button type="button" onClick={() => setShowExportModal(true)} disabled={selectedIds.size === 0} className={primaryButton}>
                <Share2 size={16} aria-hidden="true" />
                Exportar ({selectedIds.size})
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setSelectionMode(true)} disabled={behaviors.length === 0} className={secondaryButton}>
                <Share2 size={16} aria-hidden="true" />
                Exportar
              </button>
              <button type="button" onClick={() => setShowAIModal(true)} className={secondaryButton}>
                <Sparkles size={16} className="text-primary-600 dark:text-primary-300" aria-hidden="true" />
                Generar con IA
              </button>
              <button type="button" onClick={() => setFormTarget({ kind: 'create', isPositive: true })} className={primaryButton}>
                <Plus size={16} aria-hidden="true" />
                Nuevo
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {selectionMode ? (
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100" role="status">
            Toca los comportamientos que quieres copiar a otras clases.
          </p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200" id="behaviors-sort-label">Ordenar</span>
          <div className="flex rounded-xl border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800" role="group" aria-labelledby="behaviors-sort-label">
            {([['usage', 'Más usados'], ['name', 'Nombre']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => changeSort(value)}
                aria-pressed={sort === value}
                className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold transition-colors ${
                  sort === value ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {columns.map((column) => {
          const allSelected = column.list.length > 0 && column.list.every((b) => selectedIds.has(b.id));
          return (
            <section key={column.key} aria-labelledby={`behaviors-${column.key}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-white/70 dark:border-gray-700 dark:bg-gray-900/40">
              <div className={`flex items-center justify-between gap-2 border-b px-4 py-3 ${column.header}`}>
                <h2 id={`behaviors-${column.key}`} className={`flex items-center gap-2 font-bold ${column.titleClass}`}>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${column.badge}`} aria-hidden="true">
                    <column.icon size={16} />
                  </span>
                  {column.title}
                  <span className="text-sm font-semibold">({column.list.length})</span>
                </h2>
                {selectionMode ? (
                  column.list.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleAll(column.list)}
                      aria-pressed={allSelected}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-gray-800 hover:bg-white/70 dark:text-gray-100 dark:hover:bg-white/10"
                    >
                      <span className={`flex h-4 w-4 items-center justify-center rounded border-2 ${allSelected ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-500'}`} aria-hidden="true">
                        {allSelected && <Check size={11} />}
                      </span>
                      Todos
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => setFormTarget({ kind: 'create', isPositive: column.isPositive })}
                    aria-label={`Nuevo comportamiento ${column.title.toLowerCase()}`}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-gray-800 hover:bg-white/70 dark:text-gray-100 dark:hover:bg-white/10"
                  >
                    <Plus size={16} aria-hidden="true" />
                    Añadir
                  </button>
                )}
              </div>
              {!column.isPositive && !selectionMode && (
                <div className="border-b border-gray-200 px-4 dark:border-gray-700">
                  <SwitchRow
                    title="Usarlos al dar puntos"
                    description={showNegatives ? 'Aparecen en la Lista, el perfil del alumno y la barra rápida.' : 'Ocultos al dar puntos. Siguen guardados aquí.'}
                    checked={showNegatives}
                    onChange={(v) => saveSetting({ allowNegativePoints: v }, v ? 'Los negativos vuelven a aparecer al dar puntos' : 'Los negativos ya no aparecen al dar puntos', true)}
                  />
                </div>
              )}
              {column.list.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="mx-auto max-w-sm text-sm text-gray-700 dark:text-gray-300">{column.empty}</p>
                  <button
                    type="button"
                    onClick={() => setFormTarget({ kind: 'create', isPositive: column.isPositive })}
                    className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-primary-600 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50 dark:border-primary-400 dark:text-primary-200 dark:hover:bg-primary-900/30"
                  >
                    <Plus size={16} aria-hidden="true" />
                    Crear el primero
                  </button>
                  {/* Clase nueva (sin comportamientos): el momento en que el tutorial más ayuda. */}
                  {column.isPositive && behaviors.length === 0 && <TutorialButton id="comportamientos" variant="link" />}
                </div>
              ) : (
                <ul className="space-y-2 p-3">
                  {column.list.map((behavior) => (
                    <BehaviorRow
                      key={behavior.id}
                      behavior={behavior}
                      usage={usageById[behavior.id]}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(behavior.id)}
                      onToggleSelect={() => toggleSelection(behavior.id)}
                      onEdit={() => setFormTarget({ kind: 'edit', behavior })}
                      onDuplicate={() => setFormTarget({ kind: 'create', isPositive: behavior.isPositive, template: behavior })}
                      onDelete={() => void handleDelete(behavior)}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <AnimatePresence>
        {formTarget && (
          <BehaviorFormModal
            key={formTarget.kind === 'edit' ? `edit-${formTarget.behavior.id}` : `create-${formTarget.template?.id ?? formTarget.isPositive}`}
            target={formTarget}
            classroom={classroom}
            isSaving={saveMutation.isPending}
            onClose={() => setFormTarget(null)}
            onSubmit={handleSave}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAIModal && (
          <AIBehaviorModal key="ai" classroom={classroom} onClose={() => setShowAIModal(false)} onImport={handleImport} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExportModal && (
          <ExportBehaviorsModal
            key="export"
            classroom={classroom}
            behaviors={behaviors}
            selectedIds={selectedIds}
            onClose={() => setShowExportModal(false)}
            onExported={() => {
              setShowExportModal(false);
              exitSelectionMode();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
