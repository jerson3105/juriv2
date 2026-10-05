import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Archive, ChevronLeft, Lightbulb, PenLine, Plus, School, Search, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { classroomApi, type Classroom, type ClassroomOverview } from '../../lib/classroomApi';
import { schoolApi, type MySchool } from '../../lib/schoolApi';
import { ClassCard } from '../../components/home/ClassCard';
import { TodayPanel } from '../../components/home/TodayPanel';
import { FamilyRequestsPanel } from '../../components/home/FamilyRequestsPanel';
import { TeacherVerificationBanner } from '../../components/auth/TeacherVerificationBanner';
import { ActionMenu } from '../../components/home/ActionMenu';
import { CreateClassModal, NewClassChooser } from '../../components/home/CreateClassModal';
import { AssignSchoolModal, CloneClassModal, DeleteClassModal, ProjectCodeModal } from '../../components/home/ClassModals';
import {
  JIRO_TIPS, attachableSchools, byRecentActivity, classroomsKey, errorMessage, localToday, overviewKey,
} from '../../components/home/homeHelpers';

// El asistente de Jiro es grande: se descarga solo cuando el profesor lo abre.
const AIClassroomWizard = lazy(() => import('../../components/classroom/AIClassroomWizard').then((m) => ({ default: m.AIClassroomWizard })));

type Modal =
  | { type: 'chooser' }
  | { type: 'create' }
  | { type: 'assign' }
  | { type: 'clone'; classroom: Classroom }
  | { type: 'delete'; classroom: Classroom }
  | { type: 'project'; classroom: Classroom }
  | null;

const secondaryButton = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';

// Resalta la palabra clave del consejo de Jiro.
const TipText = ({ text, highlight }: { text: string; highlight: string }) => {
  const [before, after] = text.split(highlight);
  if (after === undefined) return <>{text}</>;
  return <>{before}<strong className="text-primary-700 dark:text-primary-300">{highlight}</strong>{after}</>;
};

// Estado de la escuela del profesor, visible en la cabecera.
const SchoolStatus = ({ schools, isLoading }: { schools: MySchool[]; isLoading: boolean }) => {
  if (isLoading) return null;
  const visible = schools.filter((s) => s.memberStatus !== 'REJECTED');
  const chip = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold';
  if (visible.length === 0) {
    return (
      <p className="flex flex-wrap items-center gap-2">
        <span className={`${chip} border-gray-300 bg-white text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100`}>
          <School size={14} aria-hidden="true" />
          Sin escuela
        </span>
        <Link to="/schools" className="text-xs font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300">Unirme a mi escuela</Link>
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Tus escuelas">
      {visible.map((s) => {
        const pending = s.memberStatus !== 'VERIFIED';
        return (
          <li key={s.id}>
            <Link to={`/escuela/${s.id}`} className={`${chip} ${pending ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/50 dark:bg-amber-900/30 dark:text-amber-100' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'}`}>
              <School size={14} aria-hidden="true" />
              {s.name}
              {s.memberRole === 'OWNER' && !pending && ' · Responsable'}
              {s.memberRole === 'ADMIN' && !pending && ' · Administración'}
              {pending && ' · pendiente de aprobación'}
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

// Inicio del profesor: lo de hoy arriba y todas sus clases, agrupadas por escuela.
export const TeacherHome = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [viewChoice, setView] = useState<'active' | 'archived'>('active');
  const [search, setSearch] = useState('');
  const [tip] = useState(() => JIRO_TIPS[Math.floor(Math.random() * JIRO_TIPS.length)]);
  const [today] = useState(localToday);

  const { data: classrooms = [], isLoading, isError, refetch } = useQuery({ queryKey: classroomsKey, queryFn: classroomApi.getMyClassrooms });
  const { data: schools = [], isLoading: loadingSchools } = useQuery({ queryKey: ['my-schools'], queryFn: schoolApi.getMySchools });
  const { data: overviewList = [] } = useQuery({
    queryKey: overviewKey(today.date),
    queryFn: () => classroomApi.getOverview(today.since, today.date),
    enabled: classrooms.length > 0,
    refetchInterval: 60000,
  });

  const overview = useMemo(() => new Map<string, ClassroomOverview>(overviewList.map((o) => [o.id, o])), [overviewList]);
  const active = useMemo(() => classrooms.filter((c) => c.isActive !== false).sort(byRecentActivity(overview)), [classrooms, overview]);
  const archived = useMemo(() => classrooms.filter((c) => c.isActive === false).sort(byRecentActivity(overview)), [classrooms, overview]);
  const canAttach = attachableSchools(schools);
  const schoolName = useMemo(() => new Map(schools.map((s) => [s.id, s.name])), [schools]);

  // Sin archivadas no hay nada que ver ahí: vuelve a Activas (p. ej. tras borrar la última).
  const view = archived.length === 0 ? 'active' : viewChoice;
  const list = view === 'active' ? active : archived;
  const term = search.trim().toLocaleLowerCase('es');
  const visible = term ? list.filter((c) => c.name.toLocaleLowerCase('es').includes(term)) : list;

  // Secciones: primero cada escuela y al final "Sin escuela".
  const sections = useMemo(() => {
    const groups = new Map<string, Classroom[]>();
    visible.forEach((c) => {
      const key = c.schoolId ?? '';
      groups.set(key, [...(groups.get(key) ?? []), c]);
    });
    return [...groups.entries()]
      .map(([key, items]) => ({ key, title: key ? `🏫 ${schoolName.get(key) ?? 'Escuela'}` : 'Sin escuela', items }))
      .sort((a, b) => (a.key === '' ? 1 : b.key === '' ? -1 : a.title.localeCompare(b.title, 'es')));
  }, [visible, schoolName]);

  const setArchivedInCache = (id: string, isActive: boolean) =>
    queryClient.setQueryData<Classroom[]>(classroomsKey, (current = []) => current.map((c) => (c.id === id ? { ...c, isActive } : c)));

  const restore = async (classroom: Classroom) => {
    setArchivedInCache(classroom.id, true);
    try {
      await classroomApi.restore(classroom.id);
      toast.success(`Restaurada: ${classroom.name}`);
    } catch (error) {
      setArchivedInCache(classroom.id, false);
      toast.error(errorMessage(error, 'No se pudo restaurar la clase'));
    } finally {
      queryClient.invalidateQueries({ queryKey: classroomsKey });
    }
  };

  // Se archiva al instante, con Deshacer; el borrado definitivo solo existe dentro de Archivadas.
  const archive = async (classroom: Classroom) => {
    setArchivedInCache(classroom.id, false);
    try {
      await classroomApi.archive(classroom.id);
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            <span>Archivada: {classroom.name}</span>
            <button
              type="button"
              onClick={() => { toast.dismiss(t.id); void restore(classroom); }}
              className="min-h-[36px] shrink-0 rounded-lg border border-white/40 px-3 text-sm font-semibold text-white hover:bg-white/15"
            >
              Deshacer
            </button>
          </span>
        ),
        { duration: 8000 },
      );
    } catch (error) {
      setArchivedInCache(classroom.id, true);
      toast.error(errorMessage(error, 'No se pudo archivar la clase'));
    } finally {
      queryClient.invalidateQueries({ queryKey: classroomsKey });
    }
  };

  const openNewClass = () => setModal({ type: 'chooser' });
  const closeModal = () => setModal(null);

  if (showWizard) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/logo-solo.png" alt="" className="h-11 w-11 rounded-xl object-contain" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Crear clase con Jiro <span className="font-semibold text-gray-700 dark:text-gray-300">(Beta)</span></h1>
              <p className="text-sm text-gray-700 dark:text-gray-300">Diseña tu clase guiado por Jiro y revísala antes de crearla.</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowWizard(false)} className={secondaryButton}>
            <ChevronLeft size={16} aria-hidden="true" />
            Volver al inicio
          </button>
        </div>
        <Suspense fallback={<p className="py-10 text-center text-sm text-gray-700 dark:text-gray-300" role="status">Preparando a Jiro...</p>}>
          <AIClassroomWizard isOpen onClose={() => setShowWizard(false)} onSuccess={(id) => navigate(`/classroom/${id}`)} />
        </Suspense>
      </div>
    );
  }

  const moreItems = [
    ...(canAttach.length > 0 ? [{ label: 'Asignar clases a una escuela', icon: School, onClick: () => setModal({ type: 'assign' }) }] : []),
    { label: 'Mi escuela', icon: School, onClick: () => navigate('/schools') },
  ];

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">¡Hola, {user?.firstName}!</h1>
            <p className="text-sm text-gray-700 first-letter:uppercase dark:text-gray-300">
              {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <SchoolStatus schools={schools} isLoading={loadingSchools} />
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <ActionMenu variant="button" label="Más opciones" items={moreItems} />
          <button type="button" onClick={openNewClass} className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white shadow-md shadow-primary-600/25 hover:bg-primary-700 sm:flex-none">
            <Plus size={18} aria-hidden="true" />
            Nueva clase
          </button>
        </div>
      </header>

      <TeacherVerificationBanner />
      <FamilyRequestsPanel />

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Cargando tus clases">
          <div className="h-44 animate-pulse rounded-3xl bg-gray-200 dark:bg-gray-800" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />)}
          </div>
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/40 dark:bg-red-900/20" role="alert">
          <p className="font-semibold text-red-900 dark:text-red-100">No se pudieron cargar tus clases.</p>
          <button type="button" onClick={() => void refetch()} className={`${secondaryButton} mt-3`}>Reintentar</button>
        </div>
      ) : classrooms.length === 0 ? (
        <section className="flex flex-col items-center gap-6 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-6 py-10 text-center text-white md:flex-row md:text-left">
          <img src="/assets/jiro/inicio/primera-clase.webp" alt="" className="h-32 w-32 flex-shrink-0 object-contain drop-shadow-xl" />
          <div className="space-y-3">
            <h2 className="text-2xl font-black">Crea tu primera clase</h2>
            <p className="max-w-xl text-indigo-100">Tus estudiantes se unen con un código y empiezan a ganar XP, oro e insignias desde el primer día.</p>
            <div className="flex flex-wrap justify-center gap-2 md:justify-start">
              <button type="button" onClick={() => setShowWizard(true)} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-slate-900 hover:bg-indigo-50">
                <Sparkles size={16} aria-hidden="true" />
                Crear con Jiro
              </button>
              <button type="button" onClick={() => setModal({ type: 'create' })} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/20">
                <PenLine size={16} aria-hidden="true" />
                Crear a mano
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          {active[0] && <TodayPanel continueWith={active[0]} overview={overview} activeClassrooms={active} />}

          {/* Tus clases */}
          <section aria-labelledby="classes-title" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="classes-title" className="text-lg font-bold text-gray-900 dark:text-white">Tus clases</h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {list.length > 4 && (
                  <label className="relative block">
                    <span className="sr-only">Buscar clase</span>
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" aria-hidden="true" />
                    <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar clase" className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-9 text-sm text-gray-900 outline-none placeholder:text-gray-600 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-300 sm:w-60" />
                    {search && (
                      <button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda" className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
                        <X size={16} aria-hidden="true" />
                      </button>
                    )}
                  </label>
                )}
                {archived.length > 0 && (
                  <div role="group" aria-label="Mostrar" className="flex rounded-xl border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800">
                    {([['active', `Activas (${active.length})`], ['archived', `Archivadas (${archived.length})`]] as const).map(([value, label]) => (
                      <button key={value} type="button" aria-pressed={view === value} onClick={() => { setView(value); setSearch(''); }} className={`min-h-[40px] flex-1 rounded-lg px-3 text-sm font-semibold sm:flex-none ${view === value ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {view === 'archived' && (
              <p className="flex items-start gap-2 rounded-xl bg-gray-100 p-3 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                <Archive size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                Las clases archivadas no aparecen en tu inicio. Puedes restaurarlas o eliminarlas definitivamente.
              </p>
            )}

            {visible.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-800 dark:border-gray-600 dark:text-gray-200">
                {term ? `Ninguna clase coincide con "${search.trim()}".` : view === 'archived' ? 'No tienes clases archivadas.' : 'Todas tus clases están archivadas.'}
              </p>
            ) : (
              sections.map((section) => (
                <div key={section.key || 'personal'} className="space-y-3">
                  <h3 className="flex items-baseline gap-2 text-sm font-bold text-gray-800 dark:text-gray-100">
                    {section.title}
                    <span className="font-medium text-gray-700 dark:text-gray-300">· {section.items.length} {section.items.length === 1 ? 'clase' : 'clases'}</span>
                  </h3>
                  <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {section.items.map((classroom, index) => (
                      <ClassCard
                        key={classroom.id}
                        classroom={classroom}
                        overview={overview.get(classroom.id)}
                        index={index}
                        onDuplicate={(c) => setModal({ type: 'clone', classroom: c })}
                        onArchive={archive}
                        onRestore={restore}
                        onDelete={(c) => setModal({ type: 'delete', classroom: c })}
                        onProject={(c) => setModal({ type: 'project', classroom: c })}
                      />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>

          {/* Consejo de Jiro (uno por visita, sin rotación automática) */}
          <aside className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <img src="/assets/jiro/inicio/consejo.webp" alt="" className="h-14 w-14 flex-shrink-0 object-contain" />
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                <Lightbulb size={14} aria-hidden="true" />
                Consejo de Jiro
              </p>
              <p className="text-sm text-gray-900 dark:text-gray-100"><TipText text={tip.text} highlight={tip.highlight} /></p>
            </div>
          </aside>
        </>
      )}

      <AnimatePresence>
        {modal?.type === 'chooser' && (
          <NewClassChooser
            key="chooser"
            onClose={closeModal}
            onJiro={() => { closeModal(); setShowWizard(true); }}
            onManual={() => setModal({ type: 'create' })}
          />
        )}
        {modal?.type === 'create' && (
          <CreateClassModal key="create" schools={canAttach} onClose={closeModal} onCreated={(c) => { closeModal(); navigate(`/classroom/${c.id}`); }} />
        )}
        {modal?.type === 'clone' && (
          <CloneClassModal key="clone" classroom={modal.classroom} schools={canAttach} onClose={closeModal} onCloned={closeModal} />
        )}
        {modal?.type === 'delete' && (
          <DeleteClassModal key="delete" classroom={modal.classroom} onClose={closeModal} onDeleted={closeModal} />
        )}
        {modal?.type === 'assign' && (
          <AssignSchoolModal key="assign" classrooms={classrooms} schools={canAttach} onClose={closeModal} />
        )}
        {modal?.type === 'project' && (
          <ProjectCodeModal key="project" classroom={modal.classroom} onClose={closeModal} />
        )}
      </AnimatePresence>
    </div>
  );
};

