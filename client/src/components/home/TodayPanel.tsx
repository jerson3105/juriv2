import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ClipboardCheck, ShoppingBag, Trophy, Zap } from 'lucide-react';
import type { Classroom, ClassroomOverview } from '../../lib/classroomApi';
import { classTheme, pendingOf, relativeTime } from './homeHelpers';

interface TodayPanelProps {
  continueWith: Classroom;
  overview: Map<string, ClassroomOverview>;
  activeClassrooms: Classroom[];
}

const quickLink = 'inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20';

// Franja de hoy: "Continuar con…" la clase más reciente y el resumen de todas tus clases.
export const TodayPanel = ({ continueWith, overview, activeClassrooms }: TodayPanelProps) => {
  const reduce = useReducedMotion();
  const theme = classTheme(continueWith);
  const o = overview.get(continueWith.id);
  const pending = pendingOf(o);
  const students = continueWith.studentCount ?? 0;
  const last = relativeTime(o?.lastActivityAt ?? null);

  const withStudents = activeClassrooms.filter((c) => (c.studentCount ?? 0) > 0);
  const xpToday = activeClassrooms.reduce((sum, c) => sum + Math.max(0, overview.get(c.id)?.xpToday ?? 0), 0);
  const pendingTotal = activeClassrooms.reduce((sum, c) => sum + pendingOf(overview.get(c.id)), 0);
  const pendingClasses = activeClassrooms.filter((c) => pendingOf(overview.get(c.id)) > 0).length;
  const attendanceDone = withStudents.filter((c) => (overview.get(c.id)?.attendanceToday ?? 0) > 0).length;

  const tiles = [
    { icon: Zap, label: 'XP repartido hoy', value: `+${xpToday.toLocaleString('es')}`, hint: xpToday > 0 ? 'entre todas tus clases' : 'aún sin puntos hoy' },
    { icon: ShoppingBag, label: 'Por atender', value: String(pendingTotal), hint: pendingTotal > 0 ? `en ${pendingClasses} ${pendingClasses === 1 ? 'clase' : 'clases'}` : 'todo al día' },
    { icon: ClipboardCheck, label: 'Asistencia de hoy', value: `${attendanceDone} de ${withStudents.length}`, hint: withStudents.length === 0 ? 'sin estudiantes aún' : attendanceDone === withStudents.length ? 'todas tomadas' : 'clases con lista tomada' },
  ];

  return (
    <section aria-labelledby="today-title" className="grid gap-4 lg:grid-cols-3">
      <motion.article
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-xl lg:col-span-2 sm:p-6"
      >
        <span className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-40 blur-3xl" style={{ background: theme.primary }} aria-hidden="true" />
        <p id="today-title" className="relative text-sm font-bold uppercase tracking-wide text-indigo-200">Continuar con</p>
        <div className="relative mt-2 flex items-center gap-4">
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-3xl shadow-lg ring-2 ring-white/20" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }} aria-hidden="true">
            {theme.emoji ?? '🎓'}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-black sm:text-3xl" title={continueWith.name}>{continueWith.name}</h2>
            <p className="text-sm text-indigo-100">
              {students} {students === 1 ? 'estudiante' : 'estudiantes'} · {last ? `última actividad ${last}` : 'sin actividad reciente'}
              {o && o.xpToday > 0 && ` · +${o.xpToday.toLocaleString('es')} XP hoy`}
            </p>
          </div>
        </div>
        <div className="relative mt-auto flex flex-wrap gap-2 pt-5">
          <Link to={`/classroom/${continueWith.id}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-slate-900 shadow hover:bg-indigo-50">
            Entrar a la clase
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          {students > 0 && o && o.attendanceToday === 0 && (
            <Link to={`/classroom/${continueWith.id}/attendance`} className={quickLink}>
              <ClipboardCheck size={16} aria-hidden="true" />
              Pasar lista
            </Link>
          )}
          {pending > 0 && (
            <Link to={`/classroom/${continueWith.id}/shop`} className={quickLink}>
              <ShoppingBag size={16} aria-hidden="true" />
              Atender {pending}
            </Link>
          )}
          <Link to={`/classroom/${continueWith.id}/rankings`} className={quickLink}>
            <Trophy size={16} aria-hidden="true" />
            Rankings
          </Link>
        </div>
      </motion.article>

      <ul className="grid gap-3 min-[480px]:grid-cols-3 lg:grid-cols-1" aria-label="Resumen de hoy">
        {tiles.map((tile, i) => (
          <motion.li
            key={tile.label}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 * (i + 1) }}
            className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
          >
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200" aria-hidden="true">
              <tile.icon size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">{tile.label}</p>
              <p className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{tile.value}</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">{tile.hint}</p>
            </div>
          </motion.li>
        ))}
      </ul>
    </section>
  );
};
