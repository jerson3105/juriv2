import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { useCurrentStudentProfile } from '../../hooks/useCurrentStudentProfile';
import { studentApi } from '../../lib/studentApi';
import { attendanceApi } from '../../lib/attendanceApi';
import { classNoteApi } from '../../lib/classNoteApi';
import { expeditionApi, expeditionKeys } from '../../lib/expeditionApi';
import type { StoryAccent } from '../../lib/storyTheme';
import { ErrorCard, StudentPageHeader } from '../../components/student/StudentPageHeader';
import { HomeEmptyState } from '../../components/student/home/HomeEmptyState';
import { cardText, homeCard, localDateKey, rowButton } from '../../components/student/home/studentHomeHelpers';
import { MonthGrid } from '../../components/student/calendar/MonthGrid';
import { UpcomingCard } from '../../components/student/calendar/UpcomingCard';
import { AttendanceSummaryCard } from '../../components/student/calendar/AttendanceSummaryCard';
import { DayDetailModal } from '../../components/student/calendar/DayDetailModal';
import { buildCalendar, upcomingItems } from '../../components/student/calendar/calendarHelpers';

type MyClass = Awaited<ReturnType<typeof studentApi.getMyClasses>>[number];

const Skeleton = () => (
  <div role="status" aria-label="Cargando tu calendario" className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
    <div className="h-48 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
    <div className="h-96 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
  </div>
);

/**
 * "Mi calendario" (antes "Mi Asistencia"): lo próximo con su texto completo, la asistencia del alumno
 * (solo si tiene registros, sin porcentaje ni rachas) y el mes con el detalle de cada día.
 */
const CalendarContent = ({ profile, storyAccent }: { profile: MyClass; storyAccent: StoryAccent | null }) => {
  const { classroomId } = profile;
  const today = localDateKey();
  const [view, setView] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const [selected, setSelected] = useState<string | null>(null);

  const notesQuery = useQuery({ queryKey: ['class-notes', classroomId], queryFn: () => classNoteApi.list(classroomId) });
  const attendanceQuery = useQuery({ queryKey: ['my-attendance', classroomId], queryFn: () => attendanceApi.getMyAttendance(classroomId) });
  const expeditionsQuery = useQuery({ queryKey: expeditionKeys.mine(classroomId), queryFn: () => expeditionApi.mine(classroomId) });

  const notes = useMemo(() => notesQuery.data ?? [], [notesQuery.data]);
  const expeditions = useMemo(() => expeditionsQuery.data ?? [], [expeditionsQuery.data]);
  const history = useMemo(() => attendanceQuery.data?.history ?? [], [attendanceQuery.data]);
  const days = useMemo(() => buildCalendar(history, notes, expeditions, today), [history, notes, expeditions, today]);
  const upcoming = useMemo(() => upcomingItems(notes, expeditions, today), [notes, expeditions, today]);
  const hasAttendance = (attendanceQuery.data?.stats.total ?? 0) > 0;
  const loading = notesQuery.isLoading || attendanceQuery.isLoading || expeditionsQuery.isLoading;
  const failed = notesQuery.isError || attendanceQuery.isError;
  const nothing = !loading && !failed && days.size === 0;

  const move = (delta: number) => setView(({ year, month }) => {
    const date = new Date(year, month + delta, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const goTo = (key: string) => setView({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) - 1 });
  const selectedDay = selected ? days.get(selected) : undefined;

  return (
    <div className="space-y-5">
      <StudentPageHeader
        title="Mi calendario"
        subtitle={`${profile.classroom?.name} · avisos de tu profe${hasAttendance ? ' y tu asistencia' : ''}`}
        emoji="📅"
        storyAccent={storyAccent}
      />

      {loading ? (
        <Skeleton />
      ) : nothing ? (
        <HomeEmptyState
          emojis={['📅', '📌', '✅']}
          title="Tu calendario está libre"
          text="Cuando tu profe deje una tarea o un aviso con fecha, lo verás aquí."
          primary={{ to: '/my-class', label: 'Volver al inicio' }}
          secondary={{ to: '/my-progress', label: 'Ver mi progreso' }}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:items-start">
          <div className="space-y-5">
            {notesQuery.isError
              ? <ErrorCard text="No pudimos cargar los avisos." onRetry={() => void notesQuery.refetch()} />
              : <UpcomingCard items={upcoming} />}
            {attendanceQuery.isError
              ? <ErrorCard text="No pudimos cargar tu asistencia." onRetry={() => void attendanceQuery.refetch()} />
              : hasAttendance && attendanceQuery.data && <AttendanceSummaryCard data={attendanceQuery.data} />}
          </div>
          <MonthGrid
            year={view.year}
            month={view.month}
            today={today}
            days={days}
            onSelect={setSelected}
            onMove={move}
            onToday={() => setView({ year: new Date().getFullYear(), month: new Date().getMonth() })}
            onGoTo={goTo}
          />
        </div>
      )}

      <AnimatePresence>
        {selectedDay && <DayDetailModal day={selectedDay} today={today} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
};

export const StudentCalendarPage = () => {
  const { storyAccent } = useOutletContext<{ storyAccent?: StoryAccent | null }>();
  const { profile, isLoading } = useCurrentStudentProfile();

  if (isLoading) return <Skeleton />;
  if (!profile) {
    return (
      <section className={`${homeCard} mx-auto max-w-md text-center`}>
        <p className={cardText}>No pudimos abrir tu clase.</p>
        <Link to="/my-class" className={`${rowButton} mt-3`}>Volver al inicio</Link>
      </section>
    );
  }
  return <CalendarContent key={profile.id} profile={profile} storyAccent={storyAccent ?? null} />;
};
