import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus,
  Users,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StudentGlobalNotesCalendarCard } from '../../components/student/StudentGlobalNotesCalendarCard';
import { useStudentOverviewData } from '../../hooks/useStudentOverviewData';

type StoryOutletContext = {
  storyTheme?: unknown;
  isThemeDark?: boolean;
};

export const StudentOverviewPage = () => {
  const navigate = useNavigate();
  const { storyTheme, isThemeDark } = useOutletContext<StoryOutletContext>();
  const hasTheme = !!storyTheme;
  const { myClasses, isLoading, classroomNotes } = useStudentOverviewData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-[360px] rounded-3xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-52 rounded-3xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (myClasses.length === 0) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="max-w-xl text-center space-y-5">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-500/20">
            <Users className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Aún no estás en ninguna clase</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Cuando te unas a una clase, aquí verás un resumen general con tus notas, nivel y progreso.
            </p>
          </div>
          <div className="flex justify-center">
            <Button leftIcon={<Plus size={18} />} onClick={() => navigate('/join-class')}>
              Unirme a una clase
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 ${hasTheme ? '' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-gray-950'}`}>
      {!hasTheme && (
        <>
          <div className="absolute top-20 right-10 h-64 w-64 rounded-full bg-sky-200 opacity-20 blur-3xl dark:bg-sky-950 dark:opacity-30" />
          <div className="absolute left-10 top-44 h-64 w-64 rounded-full bg-violet-200 opacity-20 blur-3xl dark:bg-violet-950 dark:opacity-30" />
        </>
      )}

      <div className="relative z-10 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl border p-5 shadow-lg md:p-6 ${hasTheme && isThemeDark ? 'border-white/10 bg-white/10 shadow-black/20' : hasTheme ? 'border-white/40 bg-white/70 shadow-black/5' : 'border-white/60 bg-white/80 shadow-sky-500/10 dark:border-gray-800 dark:bg-gray-900/80 dark:shadow-black/20'}`}
        >
          <div className="flex items-start gap-4">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${hasTheme && isThemeDark ? 'bg-white/10 text-white' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'}`}>
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${hasTheme && isThemeDark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                Bienvenido(a)
              </h1>
              <p className={`mt-2 max-w-2xl text-sm ${hasTheme && isThemeDark ? 'text-white/65' : 'text-slate-500 dark:text-gray-400'}`}>
                Aquí verás en un solo calendario las tareas, revisiones, materiales y recordatorios pendientes de todas tus clases.
              </p>
            </div>
          </div>
        </motion.div>

        <StudentGlobalNotesCalendarCard
          classroomNotes={classroomNotes}
          hasTheme={hasTheme}
          isThemeDark={isThemeDark}
        />
      </div>
    </div>
  );
};