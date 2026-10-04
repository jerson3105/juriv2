import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Check, Compass, Loader2, MoreVertical, Plus } from 'lucide-react';
import { HomeModal } from '../../home/HomeModal';
import { Popover } from '../../ui/Popover';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { primaryButton } from '../../home/homeHelpers';
import { secondaryButton } from '../../gradebook/gradebookHelpers';
import { errorMessage } from '../../auth/authHelpers';
import { expeditionMapApi } from '../../../lib/expeditionMapApi';
import { assetUrl, expeditionApi, expeditionKeys, type ExpeditionScenario, type TeacherExpeditionSummary } from '../../../lib/expeditionApi';
import { ExpeditionThumb } from '../ExpeditionStage';
import { plural } from '../expeditionHelpers';

type Filter = 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'PUBLISHED', label: 'Activas' },
  { id: 'DRAFT', label: 'Borradores' },
  { id: 'ARCHIVED', label: 'Cerradas' },
];
const STATUS_CHIP: Record<Filter, { label: string; className: string }> = {
  PUBLISHED: { label: 'Publicada', className: 'bg-blue-50 text-blue-900 dark:bg-blue-900/40 dark:text-blue-50' },
  DRAFT: { label: 'Borrador', className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100' },
  ARCHIVED: { label: 'Cerrada', className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100' },
};

export const CreateExpeditionModal = ({ classroomId, onClose }: { classroomId: string; onClose: () => void }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scenario, setScenario] = useState<ExpeditionScenario>('CONSTELLATION');
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const maps = useQuery({ queryKey: ['expedition-maps-active'], queryFn: expeditionMapApi.getActive, enabled: scenario === 'MAP' });

  const create = useMutation({
    mutationFn: () => expeditionApi.create({
      classroomId, name: name.trim(), description: description.trim() || null, scenario, mapImageUrl: scenario === 'MAP' ? mapUrl : null,
    }),
    onSuccess: (expedition) => {
      void queryClient.invalidateQueries({ queryKey: expeditionKeys.list(classroomId) });
      navigate(`/classroom/${classroomId}/expeditions/${expedition.id}`);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo crear la expedición')),
  });
  const ready = name.trim().length > 0 && (scenario === 'CONSTELLATION' || !!mapUrl);

  return (
    <HomeModal title="Nueva expedición" subtitle="Después agregas las paradas: relatos, retos, evidencias y actividades en clase." onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>Cancelar</button>
          <button type="button" disabled={!ready || create.isPending} onClick={() => create.mutate()} className={primaryButton}>
            {create.isPending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            Crear y agregar paradas
          </button>
        </>
      )}>
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Nombre</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} data-autofocus placeholder="Ej.: El viaje de la gota de agua"
            className="mt-1 min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Lo que cuenta Jiro al empezar <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span></span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={2}
            placeholder="Ej.: Una gota se escapó del mar. ¿La ayudan a volver?"
            className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
        </label>
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900 dark:text-gray-100">Escenario</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {([
              ['CONSTELLATION', 'Constelación de Jiro', 'Cada parada es una estrella que se enciende. Recomendado.'],
              ['MAP', 'Mapa de la biblioteca', 'Una aventura temática: ubicas cada parada en el mapa.'],
            ] as const).map(([id, label, hint]) => (
              <button key={id} type="button" aria-pressed={scenario === id} onClick={() => setScenario(id)}
                className={`rounded-xl border p-3 text-left ${scenario === id ? 'border-blue-600 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30' : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700/50'}`}>
                <span className="block font-bold text-gray-900 dark:text-white">{label}</span>
                <span className="block text-sm text-gray-700 dark:text-gray-300">{hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
        {scenario === 'MAP' && (
          maps.isLoading ? <p className="text-sm text-gray-700 dark:text-gray-300">Cargando mapas…</p>
            : (maps.data ?? []).length === 0 ? <p className="text-sm text-gray-800 dark:text-gray-200">Aún no hay mapas en la biblioteca. Usa la constelación.</p>
              : (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(maps.data ?? []).map((map) => (
                    <li key={map.id}>
                      <button type="button" aria-pressed={mapUrl === map.imageUrl} onClick={() => setMapUrl(map.imageUrl)}
                        className={`relative block w-full overflow-hidden rounded-xl border-2 text-left ${mapUrl === map.imageUrl ? 'border-blue-600 dark:border-blue-400' : 'border-transparent'}`}>
                        <img src={assetUrl(map.thumbnailUrl || map.imageUrl)} alt="" className="aspect-video w-full object-cover" loading="lazy" />
                        <span className="block truncate px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{map.name}</span>
                        {mapUrl === map.imageUrl && (
                          <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-blue-700 px-2 py-0.5 text-xs font-bold text-white">
                            <Check size={12} aria-hidden="true" /> Elegido
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )
        )}
      </div>
    </HomeModal>
  );
};

const CardMenu = ({ expedition, classroomId }: { expedition: TeacherExpeditionSummary; classroomId: string }) => {
  const queryClient = useQueryClient();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'close' | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: expeditionKeys.list(classroomId) });
  const action = useMutation({
    mutationFn: async (kind: 'delete' | 'close' | 'reopen') => {
      if (kind === 'delete') await expeditionApi.remove(expedition.id);
      else if (kind === 'close') await expeditionApi.close(expedition.id);
      else await expeditionApi.reopen(expedition.id);
    },
    onSuccess: (_data, kind) => {
      toast.success(kind === 'delete' ? 'Borrador eliminado' : kind === 'close' ? 'Expedición cerrada' : 'Expedición abierta de nuevo');
      setConfirm(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo completar la acción')),
  });
  return (
    <>
      <button ref={anchor} type="button" onClick={() => setOpen((value) => !value)} className="pg-icon-btn" aria-label={`Más acciones de «${expedition.name}»`} aria-expanded={open}>
        <MoreVertical size={18} aria-hidden="true" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} label="Acciones">
        {expedition.status === 'PUBLISHED' && <button type="button" role="menuitem" className="pg-menu-item" onClick={() => { setOpen(false); setConfirm('close'); }}>Cerrar expedición</button>}
        {expedition.status === 'ARCHIVED' && <button type="button" role="menuitem" className="pg-menu-item" onClick={() => { setOpen(false); action.mutate('reopen'); }}>Abrir de nuevo</button>}
        {expedition.status === 'DRAFT' && <button type="button" role="menuitem" className="pg-menu-item text-[var(--pg-alert)]" onClick={() => { setOpen(false); setConfirm('delete'); }}>Eliminar borrador</button>}
      </Popover>
      <ConfirmModal
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && action.mutate(confirm)}
        isLoading={action.isPending}
        variant={confirm === 'delete' ? 'danger' : 'warning'}
        title={confirm === 'delete' ? '¿Eliminar este borrador?' : '¿Cerrar la expedición?'}
        message={confirm === 'delete'
          ? `«${expedition.name}» y sus paradas se borran.`
          : `Los alumnos la verán como terminada y ya no podrán avanzar. Puedes abrirla de nuevo cuando quieras.`}
        confirmText={confirm === 'delete' ? 'Eliminar' : 'Cerrar'}
      />
    </>
  );
};

const ExpeditionCard = ({ expedition, classroomId, onOpen }: { expedition: TeacherExpeditionSummary; classroomId: string; onOpen: () => void }) => {
  const status = STATUS_CHIP[expedition.status];
  return (
    <li className="pg-surface flex flex-col overflow-hidden">
      <button type="button" onClick={onOpen} className="obs-sky block aspect-[10/5] w-full overflow-hidden" aria-label={`Abrir «${expedition.name}»`}>
        <ExpeditionThumb scenario={expedition.scenario} constellationId={expedition.constellationId} mapImageUrl={expedition.mapImageUrl}
          stopsCount={expedition.stopsCount} doneCount={expedition.status === 'DRAFT' ? 0 : expedition.stopsCount} finished={false} />
      </button>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold pg-fg">{expedition.name}</h3>
            <p className="text-sm pg-fg2">
              {plural(expedition.stopsCount, 'parada', 'paradas')}
              {expedition.status !== 'DRAFT' && ` · ${expedition.startedCount} de ${expedition.studentsCount} en camino · ${plural(expedition.finishedCount, 'llegó', 'llegaron')}`}
            </p>
          </div>
          <CardMenu expedition={expedition} classroomId={classroomId} />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
          {expedition.pendingReviews > 0 && <span className="pg-gold px-2.5 py-1 text-xs font-bold">{expedition.pendingReviews} por revisar</span>}
          <button type="button" onClick={onOpen} className="pg-btn ml-auto">
            {expedition.status === 'DRAFT' ? 'Seguir editando' : expedition.pendingReviews > 0 ? `Revisar (${expedition.pendingReviews})` : 'Abrir'}
          </button>
        </div>
      </div>
    </li>
  );
};

/** Lista del docente: activas, borradores y cerradas. */
export const ExpeditionList = ({ classroomId, classroomName }: { classroomId: string; classroomName?: string }) => {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter | null>(null);
  const query = useQuery({ queryKey: expeditionKeys.list(classroomId), queryFn: () => expeditionApi.list(classroomId) });
  const all = query.data ?? [];
  const counts = { PUBLISHED: 0, DRAFT: 0, ARCHIVED: 0 } as Record<Filter, number>;
  all.forEach((e) => { counts[e.status] += 1; });
  // Por defecto, la primera sección que tenga algo (activas → borradores → cerradas).
  const active = filter ?? FILTERS.find((f) => counts[f.id] > 0)?.id ?? 'PUBLISHED';
  const visible = all.filter((e) => e.status === active);
  const open = (expedition: TeacherExpeditionSummary) =>
    navigate(`/classroom/${classroomId}/expeditions/${expedition.id}${expedition.pendingReviews > 0 && expedition.status !== 'DRAFT' ? '?tab=review' : ''}`);

  return (
    <div data-pg="" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="obs-sky flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-amber-200" aria-hidden="true">
            <Compass size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold pg-fg">Expediciones</h1>
            <p className="text-sm pg-fg2">Viajes por paradas{classroomName ? ` para ${classroomName}` : ''}: relatos de Jiro, retos del banco, evidencias y actividades en clase</p>
          </div>
        </div>
        {all.length > 0 && (
          <button type="button" onClick={() => setCreating(true)} className={primaryButton}>
            <Plus size={16} aria-hidden="true" /> Nueva expedición
          </button>
        )}
      </div>

      {query.isLoading ? (
        <p className="flex items-center justify-center gap-2 py-12 text-sm pg-fg2" role="status"><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Cargando expediciones…</p>
      ) : query.isError ? (
        <div className="pg-surface p-6 text-center">
          <p className="text-sm pg-fg">No se pudieron cargar las expediciones.</p>
          <button type="button" onClick={() => void query.refetch()} className={`${secondaryButton} mt-3`}>Reintentar</button>
        </div>
      ) : all.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
          <div className="mx-auto flex w-fit gap-3" aria-hidden="true">
            <span className="text-4xl">🗺️</span><span className="text-5xl">⭐</span><span className="text-4xl">🧭</span>
          </div>
          <h2 className="mt-4 text-lg font-bold pg-fg">Aún no hay expediciones</h2>
          <p className="mx-auto mt-1 max-w-md text-sm pg-fg2">
            Una expedición es una secuencia con forma de viaje: Jiro cuenta, tus alumnos practican con retos de tu banco, entregan evidencias y la cierran en clase. Cada parada lograda enciende una estrella.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => setCreating(true)} className={primaryButton}><Plus size={16} aria-hidden="true" /> Crear expedición</button>
            <button type="button" onClick={() => navigate(`/classroom/${classroomId}/question-banks`)} className={secondaryButton}>Ver mis preguntas</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar expediciones">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" aria-pressed={active === f.id} onClick={() => setFilter(f.id)} className="pg-chip">
                {f.label} <span className="tabular-nums">{counts[f.id]}</span>
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm pg-fg2">No hay expediciones en esta sección.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((expedition) => <ExpeditionCard key={expedition.id} expedition={expedition} classroomId={classroomId} onOpen={() => open(expedition)} />)}
            </ul>
          )}
        </>
      )}

      <AnimatePresence>{creating && <CreateExpeditionModal classroomId={classroomId} onClose={() => setCreating(false)} />}</AnimatePresence>
    </div>
  );
};
