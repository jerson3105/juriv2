import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useStudentStore } from '../../store/studentStore';
import { studentApi } from '../../lib/studentApi';
import { attendanceApi } from '../../lib/attendanceApi';
import { classNoteApi } from '../../lib/classNoteApi';
import { jiroExpeditionApi } from '../../lib/jiroExpeditionApi';
import { accentGradient, type StoryAccent } from '../../lib/storyTheme';
import { HomeEmptyState } from '../../components/student/home/HomeEmptyState';
import { cardText, homeCard, localDateKey, rowButton } from '../../components/student/home/studentHomeHelpers';
import { MonthGrid } from '../../components/student/calendar/MonthGrid';
import { UpcomingCard } from '../../components/student/calendar/UpcomingCard';
import { AttendanceSummaryCard } from '../../components/student/calendar/AttendanceSummaryCard';
import { DayDetailModal } from '../../components/student/calendar/DayDetailModal';
import { buildCalendar, upcomingItems } from '../../components/student/calendar/calendarHelpers';

type MyClass = Awaited<ReturnType<typeof studentApi.getMyClasses>>[number];

const backLink = 'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white';

const Skeleton = () => (
  <div role="status" aria-label="Cargando tu calendario" className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
    <div className="h-48 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
    <div className="h-96 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
  </div>
);

const ErrorCard = ({ text, onRetry }: { text: string; onRetry: () => void }) => (
  <section className={`${homeCard} flex flex-wrap items-center justify-between gap-3`} role="alert">
    <p className={cardText}>{text}</p>
    <button type="button" onClick={onRetry} className={rowButton}>Reintentar</button>
  </section>
);

/**
 * "Mi calendario" (antes "Mi Asistencia"): lo próximo con su texto completo, la asistencia del alumno
 * (solo si tiene registros, sin porcentaje ni rachas) y el mes con el detalle de cada día.
 */
const CalendarContent = ({ profile, storyAccent }: { profile: MyClass; storyAccent: StoryAccent | null }) => {
  const { id, classroomId } = profile;
  const today = localDateKey();
  const [view, setView] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const [selected, setSelected] = useState<string | null>(null);

  const notesQuery = useQuery({ queryKey: ['class-notes', classroomId], queryFn: () => classNoteApi.list(classroomId) });
  const attendanceQuery = useQuery({ queryKey: ['my-attendance', classroomId], queryFn: () => attendanceApi.getMyAttendance(classroomId) });
  const jiroQuery = useQuery({ queryKey: ['jiro-available-expeditions', id], queryFn: () => jiroExpeditionApi.getAvailable(id) });

  const notes = useMemo(() => notesQuery.data ?? [], [notesQuery.data]);
  const jiro = useMemo(() => jiroQuery.data ?? [], [jiroQuery.data]);
  const history = useMemo(() => attendanceQuery.data?.history ?? [], [attendanceQuery.data]);
  const days = useMemo(() => buildCalendar(history, notes, jiro, today), [history, notes, jiro, today]);
  const upcoming = useMemo(() => upcomingItems(notes, jiro, today), [notes, jiro, today]);
  const hasAttendance = (attendanceQuery.data?.stats.total ?? 0) > 0;
  const loading = notesQuery.isLoading || attendanceQuery.isLoading || jiroQuery.isLoading;
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
      <div>
        <Link to="/my-class" className={backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          Volver al inicio
        </Link>
        <header className="mt-2 flex items-center gap-3">
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm"
            style={{ background: storyAccent ? accentGradient(storyAccent) : 'linear-gradient(135deg, #4338ca, #6d28d9)' }}
            aria-hidden="true"
          >
            📅
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">Mi calendario</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {profile.classroom?.name} · avisos de tu profe{hasAttendance ? ' y tu asistencia' : ''}
            </p>
          </div>
        </header>
      </div>

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
  const selectedClassIndex = useStudentStore((s) => s.selectedClassIndex);
  const { storyAccent } = useOutletContext<{ storyAccent?: StoryAccent | null }>();
  const { data: myClasses, isLoading } = useQuery({ queryKey: ['my-classes'], queryFn: studentApi.getMyClasses });
  const profile = myClasses?.[selectedClassIndex];

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
