import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { ClipboardCheck, Clock, Gift, Loader2, Moon, Play, PlayCircle, Users } from 'lucide-react';
import { TutorialModal, type TutorialId } from '../../components/tutorials/TutorialModal';
import { activityApi, activityKeys, type ActivitySession } from '../../lib/activityApi';
import type { Classroom, Student } from '../../lib/classroomApi';
import { expeditionApi, expeditionKeys } from '../../lib/expeditionApi';
import { Jiro } from '../../components/observatorio/Jiro';
import { JIRO_POSES, preloadJiro } from '../../components/observatorio/jiroPoses';
import { CATALOG, entryForSession, lastPlayedLabel, recommend, type CatalogEntry, type ObservatorioActivityId } from '../../components/observatorio/catalog';
import { useTodayPresence } from '../../components/observatorio/usePresence';

// Cada actividad se descarga solo al abrirla.
const ScrollsActivity = lazy(() => import('../../components/activities/ScrollsActivity').then((m) => ({ default: m.ScrollsActivity })));
const ConquistaActivity = lazy(() => import('../../components/observatorio/conquista/ConquistaActivity').then((m) => ({ default: m.ConquistaActivity })));
const DescansoActivity = lazy(() => import('../../components/observatorio/descanso/DescansoActivity').then((m) => ({ default: m.DescansoActivity })));
const EstrellasActivity = lazy(() => import('../../components/observatorio/estrellas/EstrellasActivity').then((m) => ({ default: m.EstrellasActivity })));
const ErrorActivity = lazy(() => import('../../components/observatorio/error/ErrorActivity').then((m) => ({ default: m.ErrorActivity })));
const CorreoActivity = lazy(() => import('../../components/observatorio/correo/CorreoActivity').then((m) => ({ default: m.CorreoActivity })));
const BingoActivity = lazy(() => import('../../components/observatorio/bingo/BingoActivity').then((m) => ({ default: m.BingoActivity })));

type ClassroomWithStudents = Classroom & { students?: Student[] };
type Selected = ObservatorioActivityId;

const Loading = () => (
  <div className="flex min-h-[50vh] items-center justify-center" role="status">
    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
    <span className="sr-only">Cargando actividad…</span>
  </div>
);

// Tarjeta del catálogo: blanca, con la portada 4:3 de la actividad (o la pose de Jiro sobre el cielo si aún no tiene).
// Si la actividad tiene tutorial para estudiantes, un botón aparte sobre la portada (no dentro del botón de la tarjeta).
const ActivityCard = ({ entry, lastPlayedAt, badge, onOpen, onTutorial }: {
  entry: CatalogEntry; lastPlayedAt?: string | null; badge?: string | null; onOpen: () => void; onTutorial?: () => void;
}) => (
  <div className="relative flex">
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-gray-700 dark:bg-gray-800 dark:focus-visible:outline-indigo-300"
    >
      <span className="obs-sky relative flex aspect-[4/3] items-end justify-center overflow-hidden" aria-hidden="true">
        {entry.cover ? (
          <img src={entry.cover} alt="" loading="lazy" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <img src={JIRO_POSES[entry.pose]} alt="" loading="lazy" className="h-[85%] select-none object-contain transition-transform duration-200 group-hover:-translate-y-1" />
        )}
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
          {badge && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">{badge}</span>}
        </span>
      </span>
    </button>
    {entry.tutorial && onTutorial && (
      <button
        type="button"
        onClick={onTutorial}
        aria-label={`Ver el tutorial de ${entry.name} (1 minuto)`}
        className="absolute right-2 top-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-[#0b1026]/85 px-3 text-xs font-bold text-white ring-1 ring-white/30 hover:bg-[#1e2a5a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
      >
        <PlayCircle size={15} aria-hidden="true" /> Tutorial · 1 min
      </button>
    )}
  </div>
);

const Chip = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-white/10 px-3 text-sm font-semibold text-indigo-50">{children}</span>
);

const BANK_ACTIVITIES = ['estrellas', 'conquista', 'error'];

export const ObservatorioPage = () => {
  const { classroom } = useOutletContext<{ classroom: ClassroomWithStudents }>();
  const students = classroom?.students ?? [];
  const [searchParams, setSearchParams] = useSearchParams();
  // "Usar en clase" desde el Banco de preguntas: ?actividad=estrellas&banco=<id> abre la actividad con ese banco.
  const [selected, setSelected] = useState<{ id: Selected; resume?: ActivitySession | null; bankId?: string | null } | null>(() => {
    const activity = searchParams.get('actividad');
    return activity && BANK_ACTIVITIES.includes(activity) ? { id: activity as Selected, bankId: searchParams.get('banco') } : null;
  });
  useEffect(() => {
    if (!searchParams.has('actividad') && !searchParams.has('banco')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('actividad');
    next.delete('banco');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const navigate = useNavigate();
  // Expediciones: evidencias por revisar en la tarjeta del catálogo.
  const { data: expeditionList } = useQuery({ queryKey: expeditionKeys.list(classroom.id), queryFn: () => expeditionApi.list(classroom.id), enabled: !!classroom.id });
  const pendingReviews = (expeditionList ?? []).reduce((sum, expedition) => sum + expedition.pendingReviews, 0);
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
  // Tutorial para estudiantes abierto desde una tarjeta (vista previa del docente; se puede proyectar en grande).
  const [tutorial, setTutorial] = useState<TutorialId | null>(null);
  const open = async (id: ObservatorioActivityId, resume?: ActivitySession | null) => {
    if (id === 'expediciones') return navigate(`/classroom/${classroom.id}/expeditions`);
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
        {selected.id === 'estrellas' && <EstrellasActivity classroom={classroom} resume={selected.resume} initialBankId={selected.bankId} onExit={back} />}
        {selected.id === 'conquista' && <ConquistaActivity classroom={classroom} resume={selected.resume} initialBankId={selected.bankId} onExit={back} />}
        {selected.id === 'error' && <ErrorActivity classroom={classroom} resume={selected.resume} initialBankId={selected.bankId} onExit={back} />}
        {selected.id === 'correo' && <CorreoActivity classroom={classroom} resume={selected.resume} onExit={back} />}
        {selected.id === 'bingo' && <BingoActivity classroom={classroom} resume={selected.resume} onExit={back} />}
        {selected.id === 'pergaminos' && <ScrollsActivity classroom={classroom} onBack={back} />}
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
          {CATALOG.filter((entry) => !entry.onlyWithScrolls || classroom.scrollsEnabled).map((entry) => (
            <ActivityCard
              key={entry.id}
              entry={entry}
              lastPlayedAt={entry.sessionType ? lastByType.get(entry.sessionType) : undefined}
              badge={entry.id === 'expediciones' && pendingReviews > 0 ? `${pendingReviews} por revisar` : null}
              onOpen={() => void open(entry.id)}
              onTutorial={entry.tutorial ? () => setTutorial(entry.tutorial ?? null) : undefined}
            />
          ))}
        </div>
      </section>
      <AnimatePresence>
        {tutorial && <TutorialModal key={tutorial} id={tutorial} onClose={() => setTutorial(null)} />}
      </AnimatePresence>
    </div>
  );
};
