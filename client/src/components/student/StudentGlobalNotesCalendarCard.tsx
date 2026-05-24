import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  MoreHorizontal,
  Package,
  X,
} from 'lucide-react';
import { type ClassNote } from '../../lib/classNoteApi';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const NOTE_CATEGORY_CONFIG = {
  task: { label: 'Tarea', icon: FileCheck, color: 'text-blue-500', badgeColor: 'bg-blue-500' },
  review: { label: 'Revisar', icon: BookOpen, color: 'text-amber-500', badgeColor: 'bg-amber-500' },
  material: { label: 'Material', icon: Package, color: 'text-purple-500', badgeColor: 'bg-purple-500' },
  other: { label: 'Otro', icon: MoreHorizontal, color: 'text-gray-500', badgeColor: 'bg-gray-500' },
} as const;

type ClassroomNotesSummary = {
  classroomId: string;
  classroomName: string;
  notes: ClassNote[];
};

type CalendarNoteEntry = {
  classroomId: string;
  classroomName: string;
  note: ClassNote;
};

type StudentGlobalNotesCalendarCardProps = {
  classroomNotes: ClassroomNotesSummary[];
  title?: string;
  hasTheme?: boolean;
  isThemeDark?: boolean;
  className?: string;
};

export const StudentGlobalNotesCalendarCard = ({
  classroomNotes,
  title = 'Calendario principal',
  hasTheme = false,
  isThemeDark = false,
  className = '',
}: StudentGlobalNotesCalendarCardProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedNotesDay, setSelectedNotesDay] = useState<{ date: Date; entries: CalendarNoteEntry[] } | null>(null);

  const notesByDate = useMemo(() => {
    const map = new Map<string, CalendarNoteEntry[]>();

    classroomNotes.forEach((classroom) => {
      classroom.notes
        .filter((note) => !note.isCompleted && note.dueDate)
        .forEach((note) => {
          const dateKey = new Date(note.dueDate as string).toISOString().split('T')[0];
          const dayEntries = map.get(dateKey) ?? [];
          dayEntries.push({
            classroomId: classroom.classroomId,
            classroomName: classroom.classroomName,
            note,
          });
          map.set(dateKey, dayEntries);
        });
    });

    return map;
  }, [classroomNotes]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: (Date | null)[] = [];

    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    for (let dayNumber = 1; dayNumber <= lastDay.getDate(); dayNumber++) {
      days.push(new Date(year, month, dayNumber));
    }

    return days;
  }, [currentMonth]);

  const navigateMonth = (delta: number) => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const formatFullDate = (date: Date) =>
    date.toLocaleDateString('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const buildDayTitle = (entries: CalendarNoteEntry[]) =>
    entries
      .map(({ classroomName, note }) => {
        const categoryLabel = NOTE_CATEGORY_CONFIG[note.category as keyof typeof NOTE_CATEGORY_CONFIG]?.label || 'Otro';
        return `${classroomName} — ${categoryLabel}: ${note.content}`;
      })
      .join(' | ') || undefined;

  const cardClasses = hasTheme
    ? isThemeDark
      ? 'bg-white/10 border border-white/10 shadow-black/20'
      : 'bg-white/70 border border-white/40 shadow-black/5'
    : 'bg-white dark:bg-gray-800 shadow-lg';

  const titleClasses = hasTheme && isThemeDark ? 'text-white' : 'text-gray-800 dark:text-white';
  const labelClasses = hasTheme && isThemeDark ? 'text-white/55' : 'text-gray-500 dark:text-gray-400';
  const defaultCellClasses = hasTheme
    ? isThemeDark
      ? 'bg-white/5 border border-white/5 text-white/70'
      : 'bg-white/50 border border-white/30 text-slate-700'
    : 'bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400';

  return (
    <div className={`rounded-xl sm:rounded-2xl p-3 sm:p-5 ${cardClasses} ${className}`.trim()}>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className={`text-base sm:text-lg font-bold flex items-center gap-1.5 sm:gap-2 ${titleClasses}`}>
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
          {title}
        </h2>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => navigateMonth(-1)}
            className={`p-1 sm:p-1.5 rounded-lg transition-colors ${hasTheme && isThemeDark ? 'hover:bg-white/10' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <ChevronLeft className={`w-4 h-4 sm:w-5 sm:h-5 ${labelClasses}`} />
          </button>
          <span className={`text-xs sm:text-sm font-medium min-w-[100px] sm:min-w-[120px] text-center ${hasTheme && isThemeDark ? 'text-white/85' : 'text-gray-700 dark:text-gray-300'}`}>
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>
          <button
            type="button"
            onClick={() => navigateMonth(1)}
            className={`p-1 sm:p-1.5 rounded-lg transition-colors ${hasTheme && isThemeDark ? 'hover:bg-white/10' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 ${labelClasses}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
        {DAYS.map((day) => (
          <div key={day} className={`text-center text-[10px] sm:text-xs font-medium py-1 sm:py-2 ${labelClasses}`}>
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {calendarDays.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dateKey = day.toISOString().split('T')[0];
          const dayEntries = notesByDate.get(dateKey) ?? [];
          const visibleEntries = dayEntries.slice(0, 2);
          const extraEntriesCount = Math.max(dayEntries.length - visibleEntries.length, 0);
          const isToday = new Date().toDateString() === day.toDateString();

          const dayContent = (
            <>
              <div className="flex items-start justify-between gap-1">
                <span className="text-[11px] sm:text-sm font-semibold leading-none">
                  {day.getDate()}
                </span>
                {dayEntries.length > 0 && (
                  <span className={`hidden sm:inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${hasTheme && isThemeDark ? 'bg-white/10 text-white/85' : 'bg-indigo-100 text-indigo-600'}`}>
                    {dayEntries.length}
                  </span>
                )}
              </div>

              {visibleEntries.length > 0 && (
                <div className="mt-auto flex flex-col gap-1">
                  {visibleEntries.map(({ note }, entryIndex) => {
                    const categoryConfig = NOTE_CATEGORY_CONFIG[note.category as keyof typeof NOTE_CATEGORY_CONFIG] || NOTE_CATEGORY_CONFIG.other;
                    const NoteIcon = categoryConfig.icon;

                    return (
                      <span
                        key={`${note.id}-${entryIndex}`}
                        className={`inline-flex h-5 w-full items-center justify-center rounded-md shadow-sm ${categoryConfig.badgeColor}`}
                      >
                        <NoteIcon className="h-3 w-3 text-white" />
                      </span>
                    );
                  })}
                  {extraEntriesCount > 0 && (
                    <span className="inline-flex h-5 w-full items-center justify-center rounded-md bg-slate-700 px-1 text-[9px] font-bold text-white shadow-sm">
                      +{extraEntriesCount}
                    </span>
                  )}
                </div>
              )}
            </>
          );

          if (dayEntries.length > 0) {
            return (
              <button
                key={dateKey}
                type="button"
                title={buildDayTitle(dayEntries)}
                onClick={() => setSelectedNotesDay({ date: day, entries: dayEntries })}
                className={`aspect-square rounded-md sm:rounded-lg p-1 sm:p-1.5 relative flex flex-col overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  isToday ? 'ring-2 ring-indigo-500' : ''
                } ${defaultCellClasses}`}
              >
                {dayContent}
              </button>
            );
          }

          return (
            <div
              key={dateKey}
              className={`aspect-square rounded-md sm:rounded-lg p-1 sm:p-1.5 relative flex flex-col overflow-hidden ${
                isToday ? 'ring-2 ring-indigo-500' : ''
              } ${defaultCellClasses}`}
            >
              {dayContent}
            </div>
          );
        })}
      </div>

      <div className={`mt-3 sm:mt-4 pt-3 sm:pt-4 border-t ${hasTheme && isThemeDark ? 'border-white/10' : 'border-gray-100 dark:border-gray-700'} space-y-3`}>
        <div className="flex flex-wrap gap-3 sm:gap-4">
          {Object.entries(NOTE_CATEGORY_CONFIG).map(([category, config]) => {
            const NoteIcon = config.icon;

            return (
              <div key={category} className="flex items-center gap-1.5">
                <NoteIcon className={`w-3.5 h-3.5 ${config.color}`} />
                <span className={`text-[10px] sm:text-xs ${labelClasses}`}>{config.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedNotesDay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setSelectedNotesDay(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18 }}
              onClick={(event) => event.stopPropagation()}
              className={`w-full max-w-2xl rounded-2xl border p-5 shadow-2xl max-h-[85vh] overflow-y-auto ${
                hasTheme && isThemeDark
                  ? 'border-white/10 bg-slate-900 text-white'
                  : 'border-white/60 bg-white text-slate-900'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${hasTheme && isThemeDark ? 'text-white/45' : 'text-slate-400'}`}>
                    Notas del día
                  </p>
                  <h3 className="mt-1 text-lg font-bold capitalize">
                    {formatFullDate(selectedNotesDay.date)}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNotesDay(null)}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${hasTheme && isThemeDark ? 'bg-white/10 text-white/80 hover:bg-white/15' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 space-y-6">
                {Array.from(
                  selectedNotesDay.entries.reduce((map, entry) => {
                    const classroomEntries = map.get(entry.classroomId) ?? { classroomName: entry.classroomName, notes: [] as ClassNote[] };
                    classroomEntries.notes.push(entry.note);
                    map.set(entry.classroomId, classroomEntries);
                    return map;
                  }, new Map<string, { classroomName: string; notes: ClassNote[] }>())
                ).map(([classroomId, classroom]) => (
                  <section key={classroomId}>
                    <h4 className="text-xl font-semibold text-sky-600 dark:text-sky-400">
                      {classroom.classroomName}
                    </h4>
                    <div className="mt-3 space-y-3">
                      {classroom.notes.map((note) => {
                        const categoryConfig = NOTE_CATEGORY_CONFIG[note.category as keyof typeof NOTE_CATEGORY_CONFIG] || NOTE_CATEGORY_CONFIG.other;
                        const NoteIcon = categoryConfig.icon;

                        return (
                          <div
                            key={note.id}
                            className={`rounded-2xl border p-4 ${hasTheme && isThemeDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${categoryConfig.badgeColor}`}>
                                <NoteIcon className="h-5 w-5 text-white" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-semibold">{categoryConfig.label}</span>
                                <p className={`mt-2 text-sm leading-relaxed ${hasTheme && isThemeDark ? 'text-white/80' : 'text-slate-600'}`}>
                                  {note.content}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};