import { useEffect, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { useCurrentStudentProfile } from '../../hooks/useCurrentStudentProfile';
import { studentApi, type ProgressPeriod, type StudentProgress } from '../../lib/studentApi';
import type { StoryAccent } from '../../lib/storyTheme';
import { isInitialLevel } from '../../components/energy/energyHelpers';
import { ErrorCard, StudentPageHeader } from '../../components/student/StudentPageHeader';
import { HomeEmptyState } from '../../components/student/home/HomeEmptyState';
import { EnergyModal } from '../../components/student/home/HomeModals';
import { cardText, homeCard, rowButton } from '../../components/student/home/studentHomeHelpers';
import { LevelPathCard } from '../../components/student/progress/LevelPathCard';
import { XpChartCard } from '../../components/student/progress/XpChartCard';
import { EnergyCard, PeriodToggle, StrengthsCard } from '../../components/student/progress/ProgressSideCards';
import { HistoryCard } from '../../components/student/progress/HistoryCard';

type MyClass = Awaited<ReturnType<typeof studentApi.getMyClasses>>[number];
// my-classes trae la configuración completa de la clase; aquí se usa solo esto.
type ProgressClassroom = MyClass['classroom'] & { xpPerLevel?: number; maxHp?: number; gradeLevel?: string | null };

const grid = 'grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:items-start';

const Skeleton = () => (
  <div role="status" aria-label="Cargando tu progreso" className={grid}>
    <div className="h-56 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
    <div className="h-56 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
  </div>
);

/** Nada se movió en el periodo (pero sí en el año): no se dibujan tarjetas en cero. */
const isQuiet = ({ totals, behaviors, series }: StudentProgress) =>
  totals.xpGained + totals.gpGained + totals.gpSpent + totals.hpLost + totals.hpRecovered === 0
  && behaviors.positiveTimes + behaviors.negativeTimes === 0
  && series.points.every((point) => point.xp === 0);

/**
 * «Mi progreso»: cómo va creciendo el alumno en esta clase (nivel, XP por semana, en qué destaca, su
 * energía) y todo su historial. No repite el inicio (hoy y la próxima meta) ni las notas ni la asistencia.
 */
const ProgressContent = ({ profile, storyAccent }: { profile: MyClass; storyAccent: StoryAccent | null }) => {
  const classroom = profile.classroom as ProgressClassroom;
  const [period, setPeriod] = useState<ProgressPeriod>('bimester');
  const [energyOpen, setEnergyOpen] = useState(false);
  const location = useLocation();

  const query = useQuery({
    queryKey: ['my-progress', profile.id, period],
    queryFn: () => studentApi.getMyProgress(profile.id, period),
    placeholderData: keepPreviousData, // al cambiar de periodo se queda lo anterior hasta que llega lo nuevo
  });
  const data = query.data;

  // «Ver todo en Mi progreso» del inicio llega con #historial: baja al historial cuando ya está en pantalla.
  const ready = query.isSuccess;
  useEffect(() => {
    if (location.hash === '#historial' && ready) document.getElementById('historial')?.scrollIntoView({ block: 'start' });
  }, [location.hash, ready]);

  const path = (
    <LevelPathCard xp={profile.xp} level={profile.level} xpPerLevel={classroom.xpPerLevel ?? 100} badges={data?.badges ?? null} />
  );

  return (
    <div className="space-y-5">
      <StudentPageHeader title="Mi progreso" subtitle={`${classroom.name} · cómo vas creciendo`} emoji="📈" storyAccent={storyAccent} />

      {/* El botón marca la elección al instante; los datos anteriores quedan hasta que llegan los nuevos. */}
      {data?.period.canSplit && data.hasAny && <PeriodToggle value={period} onChange={setPeriod} />}

      {query.isLoading ? (
        <Skeleton />
      ) : query.isError || !data ? (
        <ErrorCard text="No pudimos cargar tu progreso." onRetry={() => void query.refetch()} />
      ) : !data.hasAny ? (
        <div className={grid}>
          {path}
          <HomeEmptyState
            emojis={['🌱', '⚡', '🏅']}
            title="Tu progreso empieza en tu próxima clase"
            text="Cuando tu profe te dé XP, aquí verás cómo creces semana a semana y en qué destacas."
            primary={{ to: '/my-avatar', label: 'Personaliza tu personaje' }}
            secondary={{ to: '/my-class', label: 'Volver al inicio' }}
          />
        </div>
      ) : data.period.kind === 'bimester' && isQuiet(data) ? (
        <div className={grid}>
          {path}
          <section className={`${homeCard} flex flex-wrap items-center justify-between gap-3`}>
            <p className={cardText}>Este bimestre aún no tienes movimientos.</p>
            <button type="button" onClick={() => setPeriod('all')} className={rowButton}>Ver todo el año</button>
          </section>
        </div>
      ) : (
        <>
          <div className={grid}>
            <div className="space-y-5">
              {path}
              <XpChartCard data={data} />
            </div>
            <div className="space-y-5">
              <StrengthsCard data={data} />
              <EnergyCard data={data} hp={profile.hp} maxHp={classroom.maxHp ?? 100} onExplain={() => setEnergyOpen(true)} />
            </div>
          </div>
          <HistoryCard profileId={profile.id} period={data.period.kind} />
        </>
      )}

      <AnimatePresence>
        {energyOpen && <EnergyModal initial={isInitialLevel(classroom.gradeLevel)} onClose={() => setEnergyOpen(false)} />}
      </AnimatePresence>
    </div>
  );
};

export const StudentProgressPage = () => {
  const { storyAccent } = useOutletContext<{ storyAccent?: StoryAccent | null }>();
  const { profile, isLoading } = useCurrentStudentProfile();

  if (isLoading) return <Skeleton />;
  if (!profile) return <ErrorCard text="No pudimos abrir tu clase." onRetry={() => window.location.reload()} />;
  return <ProgressContent key={profile.id} profile={profile} storyAccent={storyAccent ?? null} />;
};
