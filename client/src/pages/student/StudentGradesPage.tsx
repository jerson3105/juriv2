import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { useStudentStore } from '../../store/studentStore';
import { studentApi } from '../../lib/studentApi';
import { gradeApi } from '../../lib/gradeApi';
import type { StoryAccent } from '../../lib/storyTheme';
import { ErrorCard, StudentPageHeader } from '../../components/student/StudentPageHeader';
import { HomeEmptyState } from '../../components/student/home/HomeEmptyState';
import { cardText, cardTitle, homeCard } from '../../components/student/home/studentHomeHelpers';
import { CompetencyCard } from '../../components/student/grades/CompetencyCard';
import { GradeDetailModal } from '../../components/student/grades/GradeDetailModal';
import { AdvanceCard, BimesterTabs, PeriodNotice, ScaleLegendCard } from '../../components/student/grades/GradesSideCards';
import { advanceTip } from '../../components/student/grades/gradesHelpers';

type MyClass = Awaited<ReturnType<typeof studentApi.getMyClasses>>[number];

const Skeleton = () => (
  <div role="status" aria-label="Cargando tus calificaciones" className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
    <div className="h-56 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
    <div className="h-56 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
  </div>
);

/**
 * "Mis calificaciones": cómo va el alumno en cada competencia de esta clase, si esas notas ya son
 * finales y qué puede hacer para avanzar. Sin promedios, porcentajes ni puntos de juego.
 */
const GradesContent = ({ profile, storyAccent }: { profile: MyClass; storyAccent: StoryAccent | null }) => {
  const { id, classroomId } = profile;
  const [period, setPeriod] = useState('CURRENT');
  const [detailId, setDetailId] = useState<string | null>(null);

  const bimestersQuery = useQuery({ queryKey: ['bimester-status', classroomId], queryFn: () => gradeApi.getBimesterStatus(classroomId) });
  const viewQuery = useQuery({ queryKey: ['my-grades-view', id, period], queryFn: () => gradeApi.getMyGradesView(id, period) });

  const view = viewQuery.data;
  const bimesters = bimestersQuery.data?.allBimesters ?? [];
  const currentPeriod = bimestersQuery.data?.currentBimester ?? null;
  const selected = view?.period ?? (period === 'CURRENT' ? currentPeriod ?? '' : period);
  const graded = view?.competencies.filter((competency) => competency.level) ?? [];
  const ungraded = view?.competencies.filter((competency) => !competency.level) ?? [];
  const tip = view ? advanceTip(view, currentPeriod) : null;
  const detail = detailId ? view?.competencies.find((competency) => competency.id === detailId) : undefined;
  const selectedNumber = Number(selected.split('-B')[1] ?? 0);
  const previous = selectedNumber > 1 ? `${selected.split('-B')[0]}-B${selectedNumber - 1}` : null;

  return (
    <div className="space-y-5">
      <StudentPageHeader
        title="Mis calificaciones"
        subtitle={`${profile.classroom?.name} · cómo vas en cada competencia`}
        emoji="🎓"
        storyAccent={storyAccent}
      />

      {bimesters.length > 0 && <BimesterTabs bimesters={bimesters} selected={selected} onSelect={setPeriod} />}

      {viewQuery.isLoading ? (
        <Skeleton />
      ) : viewQuery.isError || !view ? (
        <ErrorCard text="No pudimos cargar tus calificaciones." onRetry={() => void viewQuery.refetch()} />
      ) : (
        <>
          <PeriodNotice isClosed={view.isClosed} period={view.period} />

          {graded.length === 0 ? (
            <HomeEmptyState
              emojis={['📝', '🌱', '✨']}
              title={`Aún no hay notas en el Bimestre ${selectedNumber}`}
              text="Cuando tu profe registre lo que haces en clase, aquí verás cómo vas en cada competencia."
              primary={previous ? { label: `Ver Bimestre ${selectedNumber - 1}`, onClick: () => setPeriod(previous) } : { to: '/my-class', label: 'Volver al inicio' }}
              secondary={{ to: '/my-progress', label: 'Ver mi progreso' }}
            />
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:items-start">
              <div className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">Tus competencias</h2>
                {graded.map((competency) => (
                  <CompetencyCard key={competency.id} competency={competency} onOpen={() => setDetailId(competency.id)} />
                ))}
                {ungraded.length > 0 && (
                  <section aria-labelledby="ungraded-title" className={homeCard}>
                    <h2 id="ungraded-title" className={cardTitle}>Aún sin nota</h2>
                    <p className={cardText}>Tu profe todavía no registra evidencias en {ungraded.length === 1 ? 'esta competencia' : 'estas competencias'}:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-900 dark:text-white">
                      {ungraded.map((competency) => <li key={competency.id} className="break-words">{competency.name}</li>)}
                    </ul>
                  </section>
                )}
              </div>
              <div className="space-y-4">
                {tip && <AdvanceCard tip={tip} onOpen={setDetailId} onPeriod={setPeriod} />}
                <ScaleLegendCard scaleKind={view.scaleKind} />
              </div>
            </div>
          )}

          <p className={cardText}>
            Para tu familia: estas son las notas que lleva tu profe en Juried. El informe oficial lo entrega tu colegio.
          </p>
        </>
      )}

      <AnimatePresence>
        {detail && view && <GradeDetailModal competency={detail} isClosed={view.isClosed} onClose={() => setDetailId(null)} />}
      </AnimatePresence>
    </div>
  );
};

export const StudentGradesPage = () => {
  const selectedClassIndex = useStudentStore((s) => s.selectedClassIndex);
  const { storyAccent } = useOutletContext<{ storyAccent?: StoryAccent | null }>();
  const { data: myClasses, isLoading } = useQuery({ queryKey: ['my-classes'], queryFn: studentApi.getMyClasses });
  const profile = myClasses?.[selectedClassIndex];

  if (isLoading) return <Skeleton />;
  if (!profile) {
    return <ErrorCard text="No pudimos abrir tu clase." onRetry={() => window.location.reload()} />;
  }
  if (!profile.classroom?.useCompetencies) {
    return (
      <div className="space-y-5">
        <StudentPageHeader title="Mis calificaciones" subtitle={profile.classroom?.name ?? ''} emoji="🎓" storyAccent={storyAccent ?? null} />
        <HomeEmptyState
          emojis={['📘', '🔍', '🏫']}
          title="Esta clase no muestra calificaciones"
          text={`En ${profile.classroom?.name ?? 'esta clase'}, tu profe no usa las calificaciones de Juried.`}
          primary={{ to: '/my-class', label: 'Volver al inicio' }}
          secondary={{ to: '/my-progress', label: 'Ver mi progreso' }}
        />
      </div>
    );
  }
  return <GradesContent key={profile.id} profile={profile} storyAccent={storyAccent ?? null} />;
};
