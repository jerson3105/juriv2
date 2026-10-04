import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Eye, Loader2, MonitorPlay, MoreVertical, Plus, Rocket, Settings2 } from 'lucide-react';
import { SidePanel } from '../../gradebook/SidePanel';
import { HomeModal } from '../../home/HomeModal';
import { Popover } from '../../ui/Popover';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { primaryButton } from '../../home/homeHelpers';
import { secondaryButton } from '../../gradebook/gradebookHelpers';
import { errorMessage } from '../../auth/authHelpers';
import { useProjectorStore } from '../../../store/projectorStore';
import { useIsDesktop } from '../../layout/sidebar/useSidebarState';
import { useClassroomCompetencies } from '../../../hooks/useClassroomCompetencies';
import type { Classroom, Student } from '../../../lib/classroomApi';
import {
  expeditionApi, expeditionKeys,
  type ExpeditionBoard, type StopKind, type StudentExpedition, type TeacherExpedition,
} from '../../../lib/expeditionApi';
import { ExpeditionStage } from '../ExpeditionStage';
import { KIND_INFO, KIND_ORDER, MAX_STOPS, plural, publishIssues } from '../expeditionHelpers';
import { StudentExpeditionView } from '../student/StudentExpeditionView';
import { useExpeditionLive } from '../useExpeditionLive';
import { StopPanel } from './StopPanel';
import { ExpeditionSettingsPanel } from './ExpeditionSettingsPanel';
import { settingsPanelKey, stopPanelKey } from './panelKeys';
import { ClassMarkPanel, ProgressBoard } from './ProgressBoard';
import { ReviewQueue } from './ReviewQueue';
import { ExpeditionProjection } from './ExpeditionProjection';
import { useUndoable } from './useUndoable';

type Tab = 'stops' | 'progress' | 'review';
type Side = { kind: 'stop'; id: string } | { kind: 'settings' } | null;

const STATUS_LABEL = { DRAFT: 'Borrador', PUBLISHED: 'Publicada', ARCHIVED: 'Cerrada' } as const;

/** Lo que verá el alumno al empezar: la primera parada abierta y el resto bloqueadas. */
const previewOf = (expedition: TeacherExpedition): StudentExpedition => ({
  id: expedition.id,
  classroomId: expedition.classroomId,
  name: expedition.name,
  description: expedition.description,
  scenario: expedition.scenario,
  constellationId: expedition.constellationId,
  mapImageUrl: expedition.mapImageUrl,
  status: 'PUBLISHED',
  finishXp: expedition.finishXp,
  finishGold: expedition.finishGold,
  closingText: null,
  finishedAt: null,
  finished: false,
  reflection: null,
  groupMode: expedition.groupMode,
  clan: null,
  goal: null,
  currentStopId: expedition.stops[0]?.id ?? null,
  stops: expedition.stops.map((stop, index) => ({
    id: stop.id, sortOrder: stop.sortOrder, kind: stop.kind, title: stop.title, story: stop.story, goal: stop.goal,
    successCriteria: stop.successCriteria, mission: stop.mission, resources: stop.resources, dueAt: stop.dueAt,
    rewardXp: stop.rewardXp, rewardGold: stop.rewardGold, passPercent: stop.passPercent, reviewMode: stop.reviewMode,
    questionCount: stop.questionIds.length, mapX: stop.mapX, mapY: stop.mapY,
    state: index === 0 ? 'AVAILABLE' : 'LOCKED', review: null, feedback: null, firstScore: null, finalScore: null, goldStar: false,
    doneInClass: false, evidence: null,
  })),
});

const Checklist = ({ expedition, issues }: { expedition: TeacherExpedition; issues: string[] }) => (
  <div className="space-y-2">
    <h2 className="font-bold pg-fg">{expedition.status === 'DRAFT' ? 'Antes de publicar' : 'Revisión de la ruta'}</h2>
    {issues.length === 0 ? (
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300"><CheckCircle2 size={18} aria-hidden="true" /> Lista: tiene inicio, todas las paradas completas y una meta.</p>
    ) : (
      <ul className="space-y-1.5">
        {issues.map((issue) => (
          <li key={issue} className="flex items-start gap-2 text-sm pg-fg"><AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />{issue}</li>
        ))}
      </ul>
    )}
    <p className="text-sm pg-fg2">Toca una parada para editarla, o los ajustes para el nombre, el escenario y el premio de la meta.</p>
  </div>
);

export const ExpeditionEditor = ({ classroom, expeditionId }: { classroom: Classroom & { students?: Student[]; xpPerLevel?: number }; expeditionId: string }) => {
  const classroomId = classroom.id;
  const xpPerLevel = classroom.xpPerLevel || 100;
  const queryClient = useQueryClient();
  // Competencias de la clase: solo si la clase las usa (sin eso, las paradas no ofrecen la nota).
  const { competencies: classroomCompetencies } = useClassroomCompetencies(classroomId, !!classroom.useCompetencies && !!classroom.curriculumAreaId);
  const competencies = classroomCompetencies.filter((c) => c.isActive).map((c) => ({ id: c.id, name: c.shortName || c.name }));
  const [classMode, setClassMode] = useState(false);
  const [params, setParams] = useSearchParams();
  const tab = (['stops', 'progress', 'review'] as const).find((t) => t === params.get('tab')) ?? 'stops';
  const setTab = (next: Tab) => setParams((current) => {
    const copy = new URLSearchParams(current);
    if (next === 'stops') copy.delete('tab'); else copy.set('tab', next);
    return copy;
  }, { replace: true });
  const projecting = useProjectorStore((s) => s.projecting);
  const desktop = useIsDesktop();
  const undoable = useUndoable();
  useExpeditionLive('teacher');

  const query = useQuery({ queryKey: expeditionKeys.detail(expeditionId), queryFn: () => expeditionApi.get(expeditionId) });
  const expedition = query.data;
  const live = !!expedition && expedition.status !== 'DRAFT';
  const review = useQuery({ queryKey: expeditionKeys.review(expeditionId), queryFn: () => expeditionApi.reviewQueue(expeditionId), enabled: live });
  const [side, setSide] = useState<Side>(null);
  const [placing, setPlacing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [confirm, setConfirm] = useState<'publish' | 'close' | null>(null);
  const [marking, setMarking] = useState<{ stopId: string; board: ExpeditionBoard } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchor = useRef<HTMLButtonElement>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: expeditionKeys.detail(expeditionId) });
    void queryClient.invalidateQueries({ queryKey: expeditionKeys.list(classroomId) });
  };
  const addStop = useMutation({
    mutationFn: (kind: StopKind) => expeditionApi.addStop(expeditionId, kind),
    onSuccess: (stop) => {
      refresh();
      setSide({ kind: 'stop', id: stop.id });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo agregar la parada')),
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => expeditionApi.reorder(expeditionId, ids),
    onSuccess: (data) => queryClient.setQueryData(expeditionKeys.detail(expeditionId), data),
    onError: (error) => toast.error(errorMessage(error, 'No se pudo ordenar')),
  });
  const placeStop = useMutation({
    mutationFn: (input: { stopId: string; x: number; y: number }) => expeditionApi.updateStop(input.stopId, { mapX: input.x, mapY: input.y }),
    onSuccess: () => { setPlacing(false); refresh(); },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo ubicar la parada')),
  });
  const statusAction = useMutation({
    mutationFn: (action: 'publish' | 'close' | 'reopen') =>
      action === 'publish' ? expeditionApi.publish(expeditionId) : action === 'close' ? expeditionApi.close(expeditionId) : expeditionApi.reopen(expeditionId),
    onSuccess: (data, action) => {
      queryClient.setQueryData(expeditionKeys.detail(expeditionId), data);
      void queryClient.invalidateQueries({ queryKey: expeditionKeys.list(classroomId) });
      setConfirm(null);
      toast.success(action === 'publish' ? '¡Publicada! Tus alumnos ya la ven' : action === 'close' ? 'Expedición cerrada' : 'Expedición abierta de nuevo');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo completar la acción')),
  });

  const markClass = (studentIds: string[], stopId: string, stopTitle: string) => undoable({
    message: `${plural(studentIds.length, 'alumno marcado', 'alumnos marcados')} en «${stopTitle}»`,
    errorText: 'No se pudo marcar la parada',
    action: () => expeditionApi.markClass(stopId, studentIds),
    onDone: () => {
      void queryClient.invalidateQueries({ queryKey: expeditionKeys.board(expeditionId) });
      refresh();
    },
  });
  const openMarking = async (stopId: string) => {
    try {
      const board = await queryClient.fetchQuery({ queryKey: expeditionKeys.board(expeditionId), queryFn: () => expeditionApi.board(expeditionId) });
      setMarking({ stopId, board });
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo cargar la lista de alumnos'));
    }
  };

  const back = (
    <Link to={`/classroom/${classroomId}/expeditions`} className="inline-flex min-h-[44px] items-center gap-1.5 pr-2 text-sm font-semibold pg-fg hover:underline">
      <ArrowLeft size={16} aria-hidden="true" /> Expediciones
    </Link>
  );

  if (query.isLoading) return <p className="flex items-center justify-center gap-2 py-16 text-sm pg-fg2" role="status"><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Cargando la expedición…</p>;
  if (query.isError || !expedition) {
    return (
      <div data-pg="" className="space-y-3">
        {back}
        <div className="pg-surface p-6 text-center">
          <p className="text-sm pg-fg">{errorMessage(query.error, 'No se pudo cargar la expedición')}</p>
          <button type="button" onClick={() => void query.refetch()} className={`${secondaryButton} mt-3`}>Reintentar</button>
        </div>
      </div>
    );
  }

  const issues = publishIssues(expedition);
  const stops = expedition.stops;
  const selectedIndex = side?.kind === 'stop' ? stops.findIndex((s) => s.id === side.id) : -1;
  const selected = selectedIndex >= 0 ? stops[selectedIndex] : null;
  const pending = review.data?.pending.length ?? 0;
  const issueStops = new Set(stops.filter((_, index) => issues.some((issue) => issue.startsWith(`Parada ${index + 1} `))).map((s) => s.id));
  const move = (index: number, delta: number) => {
    const ids = stops.map((s) => s.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  };

  const sideContent = selected ? (
    <StopPanel key={stopPanelKey(selected)} expedition={expedition} stop={selected} index={selectedIndex} xpPerLevel={xpPerLevel} competencies={competencies}
      placing={placing} onPlace={setPlacing} onMarkClass={() => void openMarking(selected.id)} onDeleted={() => setSide(null)} />
  ) : side?.kind === 'settings' ? (
    <ExpeditionSettingsPanel key={settingsPanelKey(expedition)} expedition={expedition} xpPerLevel={xpPerLevel} clansEnabled={!!classroom.clansEnabled} />
  ) : null;
  const sideTitle = selected ? `Parada ${selectedIndex + 1} · ${KIND_INFO[selected.kind].label}` : 'Ajustes de la expedición';

  return (
    <div data-pg="" className="space-y-4">
      <div className="space-y-2">
        {back}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold pg-fg">{expedition.name}</h1>
            <p className="text-sm pg-fg2">
              <span className="font-semibold">{STATUS_LABEL[expedition.status]}</span> · {plural(stops.length, 'parada', 'paradas')}
              {expedition.scenario === 'MAP' ? ' · mapa' : ' · constelación'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {expedition.status === 'PUBLISHED' && stops.length > 0 && (
              <button type="button" onClick={() => setClassMode(true)} className={secondaryButton}><MonitorPlay size={16} aria-hidden="true" /> Proyectar</button>
            )}
            <button type="button" onClick={() => setPreviewing(true)} disabled={stops.length === 0} className={secondaryButton}><Eye size={16} aria-hidden="true" /> Vista alumno</button>
            {expedition.status === 'DRAFT' && (
              <button type="button" onClick={() => setConfirm('publish')} disabled={issues.length > 0 || statusAction.isPending} className={primaryButton}
                aria-describedby={issues.length ? 'publish-why' : undefined}>
                <Rocket size={16} aria-hidden="true" /> Publicar
              </button>
            )}
            {expedition.status !== 'DRAFT' && (
              <>
                <button ref={menuAnchor} type="button" onClick={() => setMenuOpen((v) => !v)} className="pg-icon-btn" aria-label="Más acciones" aria-expanded={menuOpen}>
                  <MoreVertical size={18} aria-hidden="true" />
                </button>
                <Popover open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={menuAnchor} label="Acciones de la expedición">
                  {expedition.status === 'PUBLISHED'
                    ? <button type="button" role="menuitem" className="pg-menu-item" onClick={() => { setMenuOpen(false); setConfirm('close'); }}>Cerrar expedición</button>
                    : <button type="button" role="menuitem" className="pg-menu-item" onClick={() => { setMenuOpen(false); statusAction.mutate('reopen'); }}>Abrir de nuevo</button>}
                </Popover>
              </>
            )}
          </div>
        </div>
        {expedition.status === 'DRAFT' && issues.length > 0 && <p id="publish-why" className="text-sm pg-fg2">Para publicar: {issues[0]}{issues.length > 1 ? ` (y ${issues.length - 1} más)` : ''}.</p>}
      </div>

      {live && (
        <div className="pg-seg" role="group" aria-label="Sección">
          <button type="button" aria-pressed={tab === 'stops'} onClick={() => setTab('stops')} className="pg-seg-item">Paradas</button>
          <button type="button" aria-pressed={tab === 'progress'} onClick={() => setTab('progress')} className="pg-seg-item">Progreso</button>
          <button type="button" aria-pressed={tab === 'review'} onClick={() => setTab('review')} className="pg-seg-item">
            Por revisar {pending > 0 && <span className="pg-gold px-2 text-xs font-bold">{pending}</span>}
          </button>
        </div>
      )}

      {live && tab === 'progress' && <ProgressBoard expeditionId={expeditionId} projecting={projecting} onMarkClass={(stopId, board) => setMarking({ stopId, board })} />}
      {live && tab === 'review' && <ReviewQueue expeditionId={expeditionId} projecting={projecting} undoable={undoable} />}

      {(!live || tab === 'stops') && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
          <div className="space-y-3">
            <ExpeditionStage
              scenario={expedition.scenario}
              constellationId={expedition.constellationId}
              mapImageUrl={expedition.mapImageUrl}
              stops={stops.map((stop) => ({ id: stop.id, kind: stop.kind, title: stop.title, state: 'DONE', mapX: stop.mapX, mapY: stop.mapY }))}
              variant="plan"
              selectedId={selected?.id ?? null}
              onSelect={(id) => setSide({ kind: 'stop', id })}
              placingId={placing && selected ? selected.id : null}
              onPlace={(x, y) => selected && placeStop.mutate({ stopId: selected.id, x, y })}
              label={`${expedition.name}: ${stops.length} paradas`}
            />

            <section aria-label="Paradas" className="pg-surface">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--pg-line)] px-3 py-2">
                <h2 className="font-bold pg-fg">Paradas <span className="font-normal pg-fg2">({stops.length} de {MAX_STOPS})</span></h2>
                <button type="button" onClick={() => setSide({ kind: 'settings' })} aria-pressed={side?.kind === 'settings'} className="pg-btn"><Settings2 size={16} aria-hidden="true" /> Ajustes</button>
              </div>
              {stops.length === 0 ? (
                <p className="px-3 py-4 text-sm pg-fg2">Agrega la primera parada. Una buena expedición tiene de 4 a 6: un relato, un par de retos, una evidencia y una parada en clase.</p>
              ) : (
                <ol>
                  {stops.map((stop, index) => (
                    <li key={stop.id} className="pg-row flex items-center gap-1 border-b pr-1 last:border-b-0" data-selected={stop.id === selected?.id}>
                      <button type="button" onClick={() => setSide({ kind: 'stop', id: stop.id })} className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-300 text-sm font-extrabold text-amber-950">{index + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 truncate font-semibold pg-fg">
                            {stop.title}
                            {issueStops.has(stop.id) && <AlertTriangle size={15} className="flex-shrink-0 text-amber-700 dark:text-amber-300" aria-label="Le falta algo" />}
                          </span>
                          <span className="block text-sm pg-fg2">
                            <span aria-hidden="true">{KIND_INFO[stop.kind].emoji}</span> {KIND_INFO[stop.kind].label}
                            {live && stop.stats.done > 0 && ` · ${plural(stop.stats.done, 'la logró', 'la lograron')}`}
                            {live && stop.stats.pending > 0 && ` · ${stop.stats.pending} por revisar`}
                          </span>
                        </span>
                      </button>
                      <button type="button" onClick={() => move(index, -1)} disabled={index === 0 || reorder.isPending} className="pg-icon-btn" aria-label={`Subir «${stop.title}»`}><ArrowUp size={16} aria-hidden="true" /></button>
                      <button type="button" onClick={() => move(index, 1)} disabled={index === stops.length - 1 || reorder.isPending} className="pg-icon-btn" aria-label={`Bajar «${stop.title}»`}><ArrowDown size={16} aria-hidden="true" /></button>
                    </li>
                  ))}
                </ol>
              )}
              {stops.length < MAX_STOPS && (
                <div className="border-t border-[var(--pg-line)] p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold pg-fg"><Plus size={16} aria-hidden="true" /> Agregar parada</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {KIND_ORDER.map((kind) => (
                      <button key={kind} type="button" disabled={addStop.isPending} onClick={() => addStop.mutate(kind)}
                        className="flex items-start gap-2 rounded-xl border border-[var(--pg-control)] p-2.5 text-left hover:bg-[var(--pg-hover)] disabled:opacity-60">
                        <span className="text-xl leading-none" aria-hidden="true">{KIND_INFO[kind].emoji}</span>
                        <span className="min-w-0">
                          <span className="block font-semibold pg-fg">{KIND_INFO[kind].label}</span>
                          <span className="block text-xs pg-fg2">{KIND_INFO[kind].hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
            {!desktop && !sideContent && <div className="pg-surface p-3"><Checklist expedition={expedition} issues={issues} /></div>}
          </div>

          {desktop && (
            <aside aria-label={sideContent ? sideTitle : 'Antes de publicar'} className="pg-surface sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto p-4">
              {sideContent ? (
                <>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="font-bold pg-fg">{sideTitle}</h2>
                    <button type="button" onClick={() => { setSide(null); setPlacing(false); }} className="pg-btn pg-btn-ghost">Cerrar</button>
                  </div>
                  {sideContent}
                </>
              ) : (
                <Checklist expedition={expedition} issues={issues} />
              )}
            </aside>
          )}
        </div>
      )}

      {!desktop && sideContent && !placing && (
        <SidePanel title={sideTitle} onClose={() => setSide(null)} wide><div data-pg="">{sideContent}</div></SidePanel>
      )}
      {!desktop && placing && selected && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-2 border-t border-[var(--pg-line)] bg-[var(--pg-surface)] px-4 py-3">
          <p className="text-sm font-semibold pg-fg">Toca el mapa donde va «{selected.title}»</p>
          <button type="button" onClick={() => setPlacing(false)} className="pg-btn">Cancelar</button>
        </div>
      )}

      {marking && <ClassMarkPanel board={marking.board} stopId={marking.stopId} onClose={() => setMarking(null)} onConfirm={markClass} />}

      {classMode && expedition.status === 'PUBLISHED' && (
        <ExpeditionProjection classroom={classroom} expedition={expedition} onExit={() => setClassMode(false)} />
      )}

      <AnimatePresence>
        {previewing && (
          <HomeModal title="Vista alumno" subtitle="Así la verá al empezar: la primera parada abierta" onClose={() => setPreviewing(false)} size="lg">
            <div data-pg=""><StudentExpeditionView expedition={previewOf(expedition)} preview /></div>
          </HomeModal>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && statusAction.mutate(confirm)}
        isLoading={statusAction.isPending}
        variant={confirm === 'publish' ? 'info' : 'warning'}
        title={confirm === 'publish' ? '¿Publicar la expedición?' : '¿Cerrar la expedición?'}
        message={confirm === 'publish'
          ? 'Tus alumnos la verán en su inicio y en Expediciones. Después puedes editar textos y recompensas, y agregar paradas: quien entre tarde empieza desde la primera.'
          : 'Los alumnos la verán como terminada y ya no podrán avanzar. Puedes abrirla de nuevo cuando quieras.'}
        confirmText={confirm === 'publish' ? 'Publicar' : 'Cerrar'}
      />
    </div>
  );
};
