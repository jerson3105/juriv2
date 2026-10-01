import type { MyAttendanceData } from '../../../lib/attendanceApi';
import { cardText, cardTitle, homeCard, longDayLabel, plural } from '../home/studentHomeHelpers';
import { ATTENDANCE } from './calendarHelpers';

/**
 * "Tu asistencia" (solo si el alumno tiene registros): días en que asistió (a tiempo o tarde) y el
 * desglose. Sin porcentaje ni rachas: con pocos días informan poco y la tardanza no es una falta.
 */
export const AttendanceSummaryCard = ({ data }: { data: MyAttendanceData }) => {
  const { stats, history } = data;
  const attended = stats.present + stats.late;
  const first = history.length ? history[history.length - 1].day : null;
  const chips = [
    { status: 'PRESENT' as const, count: stats.present, text: `${stats.present} a tiempo` },
    { status: 'LATE' as const, count: stats.late, text: stats.late === 1 ? '1 vez tarde' : `${stats.late} veces tarde` },
    { status: 'ABSENT' as const, count: stats.absent, text: plural(stats.absent, 'falta', 'faltas') },
    { status: 'EXCUSED' as const, count: stats.excused, text: plural(stats.excused, 'justificada', 'justificadas') },
  ].filter((chip) => chip.count > 0);

  return (
    <section aria-labelledby="attendance-title" className={homeCard}>
      <h2 id="attendance-title" className={cardTitle}>Tu asistencia</h2>
      {first && <p className={cardText}>Desde el {longDayLabel(first).toLowerCase()}</p>}
      <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">
        Asististe {attended} de {plural(stats.total, 'día', 'días')}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2" aria-label="Detalle">
        {chips.map(({ status, text }) => {
          const style = ATTENDANCE[status];
          const Icon = style.icon;
          return (
            <li key={status} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${style.chip}`}>
              <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
              {text}
            </li>
          );
        })}
      </ul>
      {stats.totalXpEarned > 0 && (
        <p className={`mt-3 ${cardText}`}><span aria-hidden="true">⚡ </span>Ganaste {stats.totalXpEarned.toLocaleString('es')} XP por asistir.</p>
      )}
      {stats.late > 0 && stats.totalXpEarned > 0 && <p className={cardText}>Llegar tarde no suma XP.</p>}
    </section>
  );
};
