import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ClipboardCheck, Clock, Gift, Loader2, Moon, Play, Users } from 'lucide-react';
import { activityApi, activityKeys, type ActivitySession } from '../../lib/activityApi';
import type { Classroom, Student } from '../../lib/classroomApi';
import ExpeditionTypeModal from '../../components/modals/ExpeditionTypeModal';
import { Jiro } from '../../components/observatorio/Jiro';
import { JIRO_POSES, preloadJiro } from '../../components/observatorio/jiroPoses';
import { CATALOG, entryForSession, lastPlayedLabel, recommend, type CatalogEntry, type ObservatorioActivityId } from '../../components/observatorio/catalog';
import { useTodayPresence } from '../../components/observatorio/usePresence';

// Cada actividad se descarga solo al abrirla.
const ScrollsActivity = lazy(() => import('../../components/activities/ScrollsActivity').then((m) => ({ default: m.ScrollsActivity })));
const TerritoryConquestActivity = lazy(() => import('../../components/activities/TerritoryConquestActivity').then((m) => ({ default: m.TerritoryConquestActivity })));
const ExpeditionsActivity = lazy(() => import('../../components/activities/ExpeditionsActivity').then((m) => ({ default: m.ExpeditionsActivity })));
const DescansoActivity = lazy(() => import('../../components/observatorio/descanso/DescansoActivity').then((m) => ({ default: m.DescansoActivity })));
const EstrellasActivity = lazy(() => import('../../components/observatorio/estrellas/EstrellasActivity').then((m) => ({ default: m.EstrellasActivity })));
const JiroExpeditionsActivity = lazy(() => import('../../components/activities/JiroExpeditionsActivity').then((m) => ({ default: m.JiroExpeditionsActivity })));

type ClassroomWithStudents = Classroom & { students?: Student[] };
type Selected = ObservatorioActivityId | 'expeditions' | 'jiro-expeditions';

const Loading = () => (
  <div className="flex min-h-[50vh] items-center justify-center" role="status">
    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
    <span className="sr-only">Cargando actividad…</span>
  </div>
);

// Tarjeta del catálogo: blanca, con un recuadro nocturno y la pose de Jiro.
const ActivityCard = ({ entry, lastPlayedAt, onOpen }: { entry: CatalogEntry; lastPlayedAt?: string | null; onOpen: () => void }) => (
  <button
    type="button"
    onClick={onOpen}
    className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-gray-700 dark:bg-gray-800 dark:focus-visible:outline-indigo-300"
  >
    <span className="obs-sky relative flex h-36 items-end justify-center overflow-hidden" aria-hidden="true">
      <img src={JIRO_POSES[entry.pose]} alt="" loading="lazy" className="h-32 select-none object-contain transition-transform duration-200 group-hover:-translate-y-1" />
    </span>
    <span className="flex flex-1 flex-col p-4">
      <span className="text-lg font-bold text-gray-900 dark:text-white">{entry.name}</span>
      <span className="mt-1 text-sm text-gray-600 dark:text-gray-300">{entry.description}</span>
      <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-sm text-gray-600 dark:text-gray-300">
        <span className="inline-flex items-center gap-1"><Clock size={14} aria-hidden="true" /> {entry.duration}</span>
        {entry.requirements.map((r) => (
          <span key={r.label} className="inline-flex items-center gap-1"><span aria-hidden="true">{r.icon}</span> {r.label}</span>
        ))}
        {entry.sessionType && <span className="font-semibold text-indigo-700 dark:text-indigo-300">{lastPlayedLabel(lastPlayedAt)}</span>}
      </span>
    </span>
  </button>
);

const Chip = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-white/10 px-3 text-sm font-semibold text-indigo-50">{children}</span>
);

export const ObservatorioPage = () => {
  const { classroom } = useOutletContext<{ classroom: ClassroomWithStudents }>();
  const students = classroom?.students ?? [];
  const [selected, setSelected] = useState<{ id: Selected; resume?: ActivitySession | null } | null>(null);
  const [showExpeditionModal, setShowExpeditionModal] = useState(false);
  const presence = useTodayPresence(classroom.id, students);
  useEffect(preloadJiro, []);

  const { data: overview } = useQuery({
    queryKey: activityKeys.overview(classroom.id),
    queryFn: () => activityApi.overview(classroom.id),
    enabled: !!classroom.id,
  });

  const restingCount = students.filter((s) => s.hp <= 0).length;
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(`juried:obs-reward-dismissed:${classroom.id}`);
    } catch {
      return null;
    }
  });
  const unrewarded = overview?.unrewarded && overview.unrewarded.id !== dismissed ? overview.unrewarded : null;
  const unrewardedEntry = unrewarded ? entryForSession(unrewarded.activityType) : null;
  const suggestion = recommend(overview, restingCount);
  const lastByType = new Map((overview?.lastByType ?? []).map((r) => [r.activityType, r.lastPlayedAt]));

  const [resuming, setResuming] = useState(false);
  const open = async (id: ObservatorioActivityId, resume?: ActivitySession | null) => {
    if (id === 'expediciones') return setShowExpeditionModal(true);
    if (!resume) return setSelected({ id });
    // La portada lista las partidas sin su estado: se trae completa para reanudarla.
    setResuming(true);
    try {
      setSelected({ id, resume: await activityApi.get(resume.id) });
    } catch {
      toast.error('No se pudo cargar la partida');
    } finally {
      setResuming(false);
    }
  };
  const back = () => setSelected(null);

  if (selected) {
    return (
      <Suspense fallback={<Loading />}>
        {selected.id === 'descanso' && <DescansoActivity classroom={classroom} resume={selected.resume} onExit={back} />}
        {selected.id === 'estrellas' && <EstrellasActivity classroom={classroom} resume={selected.resume} onExit={back} />}
        {selected.id === 'conquista' && <TerritoryConquestActivity classroom={{ ...classroom, curriculumAreaId: classroom.curriculumAreaId ?? undefined }} onBack={back} />}
        {selected.id === 'pergaminos' && <ScrollsActivity classroom={classroom} onBack={back} />}
        {selected.id === 'expeditions' && <ExpeditionsActivity classroom={classroom} onBack={back} />}
        {selected.id === 'jiro-expeditions' && <JiroExpeditionsActivity classroom={classroom} onBack={back} />}
      </Suspense>
    );
  }

  return (
    <div className="space-y-6">
      {/* Jiro anfitrión: propone con datos reales de la clase */}
      <section aria-labelledby="observatorio-title" className="relative overflow-hidden rounded-3xl bg-[#0b1026] px-5 py-6 text-white sm:px-8">
        <div className="obs-sky pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <h1 id="observatorio-title" className="text-3xl font-black sm:text-4xl">Observatorio de Jiro</h1>
            <p className="mt-1 text-base text-indigo-100">Actividades para jugar en clase, proyectadas y con Jiro de guía.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip><Users size={16} aria-hidden="true" /> {students.length} alumnos</Chip>
              <Chip>
                <ClipboardCheck size={16} aria-hidden="true" />
                {presence.isLoading ? 'Asistencia…' : presence.fromAttendance ? `${presence.presentIds.size} presentes hoy` : 'Hoy no se pasó lista'}
              </Chip>
              {restingCount > 0 && <Chip><Moon size={16} aria-hidden="true" /> {restingCount} descansando</Chip>}
            </div>
            {suggestion.entry && (
              <button
                type="button"
                onClick={() => void open(suggestion.entry!.id, suggestion.resume)}
                disabled={resuming}
                className="mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-amber-300 px-5 text-base font-black text-amber-950 hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                <Play size={18} aria-hidden="true" />
                {suggestion.resume ? `Continuar ${suggestion.entry.name}` : `Jugar ${suggestion.entry.name}`}
              </button>
            )}
          </div>
          <Jiro
            pose={suggestion.resume ? 'senalando' : restingCount >= 3 ? 'dormido' : 'emocionado'}
            line={suggestion.line}
            variant="stage"
            balloonSide="right"
            sizeClassName="h-36 sm:h-44"
            balloonTextClassName="text-lg sm:text-xl"
            className="md:max-w-[52%]"
          />
        </div>
      </section>

      {unrewarded && unrewardedEntry && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-400/40 dark:bg-amber-400/10" role="status">
          <Gift size={20} className="text-amber-700 dark:text-amber-300" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm font-semibold text-amber-900 dark:text-amber-100">
            Falta entregar la recompensa de {unrewardedEntry.name} ({lastPlayedLabel(unrewarded.finishedAt).toLowerCase()}).
          </p>
          <button
            type="button"
            onClick={() => void open(unrewardedEntry.id, unrewarded)}
            disabled={resuming}
            className="min-h-[44px] rounded-xl bg-amber-500 px-4 text-sm font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60"
          >
            Abrir Bitácora
          </button>
          <button
            type="button"
            onClick={() => {
              setDismissed(unrewarded.id);
              try {
                sessionStorage.setItem(`juried:obs-reward-dismissed:${classroom.id}`, unrewarded.id);
              } catch {
                // Sin almacenamiento: el aviso vuelve al recargar.
              }
            }}
            className="min-h-[44px] rounded-xl px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-400/20"
          >
            Ahora no
          </button>
        </div>
      )}

      <section aria-labelledby="observatorio-catalog">
        <h2 id="observatorio-catalog" className="mb-3 text-lg font-bold text-gray-900 dark:text-white">Actividades</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG.map((entry) => (
            <ActivityCard
              key={entry.id}
              entry={entry}
              lastPlayedAt={entry.sessionType ? lastByType.get(entry.sessionType) : undefined}
              onOpen={() => void open(entry.id)}
            />
          ))}
        </div>
      </section>

      <ExpeditionTypeModal
        isOpen={showExpeditionModal}
        onClose={() => setShowExpeditionModal(false)}
        onSelectOption={(id) => setSelected({ id: id as Selected })}
      />
    </div>
  );
};
