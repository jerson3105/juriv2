import { ChevronLeft, ChevronRight, Compass, Pin } from 'lucide-react';
import { cardText, cardTitle, homeCard, longDayLabel, rowButton } from '../home/studentHomeHelpers';
import { ATTENDANCE, MONTHS, dayAriaLabel, monthCells, monthPrefix, type CalendarDay } from './calendarHelpers';
import type { AttendanceStatus } from '../../../lib/attendanceApi';

const WEEKDAYS = [['D', 'Dom'], ['L', 'Lun'], ['M', 'Mar'], ['M', 'Mié'], ['J', 'Jue'], ['V', 'Vie'], ['S', 'Sáb']];
const arrow = 'flex h-11 w-11 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700';

interface MonthGridProps {
  year: number;
  month: number;
  today: string;
  days: Map<string, CalendarDay>;
  onSelect: (key: string) => void;
  onMove: (delta: number) => void;
  onToday: () => void;
  /** Ir al mes de una fecha (desde "Tu próxima fecha es…"). */
  onGoTo: (key: string) => void;
}

/** El mes: cada día con algo lleva su tinte y su ícono, y se toca para ver el detalle. */
export const MonthGrid = ({ year, month, today, days, onSelect, onMove, onToday, onGoTo }: MonthGridProps) => {
  const prefix = monthPrefix(year, month);
  const inMonth = [...days.values()].filter((day) => day.key.startsWith(prefix));
  const isCurrent = today.startsWith(prefix);
  const statuses = new Set(inMonth.flatMap((day) => (day.attendance ? [day.attendance.status] : [])));
  const hasNotes = inMonth.some((day) => day.notes.length > 0);
  const hasExpeditions = inMonth.some((day) => day.expeditions.length > 0);
  const nextKey = inMonth.length === 0
    ? [...days.keys()].filter((key) => key >= today && !key.startsWith(prefix)).sort()[0] ?? null
    : null;
  const monthName = MONTHS[month];

  return (
    // En el celular, menos relleno y espacio: así cada día mide al menos 44 px de ancho a 375 px.
    <section aria-labelledby="month-title" className={`${homeCard} max-sm:px-2`}>
      <div className="flex items-center justify-between gap-2 max-sm:pl-2">
        <h2 id="month-title" aria-live="polite" className={cardTitle}>{monthName} {year}</h2>
        <div className="flex items-center gap-1">
          {!isCurrent && <button type="button" onClick={onToday} className={rowButton}>Hoy</button>}
          <button type="button" onClick={() => onMove(-1)} aria-label="Mes anterior" className={arrow}><ChevronLeft size={20} aria-hidden="true" /></button>
          <button type="button" onClick={() => onMove(1)} aria-label="Mes siguiente" className={arrow}><ChevronRight size={20} aria-hidden="true" /></button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-0.5 sm:gap-1" aria-hidden="true">
        {WEEKDAYS.map(([short, long], i) => (
          <div key={i} className="py-1 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{long}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {monthCells(year, month).map((key, index) => {
          if (!key) return <div key={`empty-${index}`} aria-hidden="true" />;
          const day = days.get(key);
          const weekend = index % 7 === 0 || index % 7 === 6;
          const status = day?.attendance ? ATTENDANCE[day.attendance.status] : null;
          const isToday = key === today;
          const base = `relative flex min-h-[44px] flex-col rounded-lg p-1 text-left sm:min-h-[56px] sm:p-1.5 ${
            status ? status.cell : weekend ? 'bg-gray-100 text-gray-900 dark:bg-gray-900/60 dark:text-gray-100' : 'bg-gray-50 text-gray-900 dark:bg-gray-700/60 dark:text-gray-100'
          } ${isToday ? 'ring-2 ring-primary-600 dark:ring-primary-300' : ''}`;
          const number = <span className="text-xs font-semibold leading-none sm:text-sm">{Number(key.slice(8))}</span>;

          if (!day) {
            return <div key={key} className={base} aria-hidden="true">{number}</div>;
          }
          const StatusIcon = status?.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-haspopup="dialog"
              aria-label={dayAriaLabel(day)}
              aria-current={isToday ? 'date' : undefined}
              className={`${base} hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:hover:brightness-110`}
            >
              <span className="flex w-full items-start justify-between gap-0.5">
                {number}
                <span className="flex items-center gap-0.5">
                  {day.expeditions.length > 0 && <Compass size={14} className="text-violet-700 dark:text-violet-300" aria-hidden="true" />}
                  {day.notes.length > 0 && <Pin size={14} className="text-indigo-700 dark:text-indigo-300" aria-hidden="true" />}
                  {day.notes.length > 1 && <span className="hidden text-xs font-bold sm:inline">{day.notes.length}</span>}
                </span>
              </span>
              {StatusIcon && <StatusIcon size={16} strokeWidth={2.5} className={`mt-auto ${status.iconColor}`} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {inMonth.length > 0 ? (
        <div className="mt-3 border-t border-gray-200 pt-3 max-sm:px-2 dark:border-gray-700">
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Qué significa cada marca">
            {(Object.keys(ATTENDANCE) as AttendanceStatus[]).filter((s) => statuses.has(s)).map((s) => {
              const Icon = ATTENDANCE[s].icon;
              return (
                <li key={s} className="flex items-center gap-1.5 text-xs text-gray-800 dark:text-gray-100">
                  <span className={`flex h-5 w-5 items-center justify-center rounded ${ATTENDANCE[s].cell}`}><Icon size={12} strokeWidth={2.5} className={ATTENDANCE[s].iconColor} aria-hidden="true" /></span>
                  {ATTENDANCE[s].label}
                </li>
              );
            })}
            {hasNotes && <li className="flex items-center gap-1.5 text-xs text-gray-800 dark:text-gray-100"><Pin size={14} className="text-indigo-700 dark:text-indigo-300" aria-hidden="true" />Aviso de tu profe</li>}
            {hasExpeditions && <li className="flex items-center gap-1.5 text-xs text-gray-800 dark:text-gray-100"><Compass size={14} className="text-violet-700 dark:text-violet-300" aria-hidden="true" />Entrega de expedición</li>}
          </ul>
          <p className={`mt-2 ${cardText}`}>Toca un día para ver el detalle.</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-gray-200 pt-3 max-sm:px-2 dark:border-gray-700">
          <p className={cardText}>
            Nada en {monthName.toLowerCase()}.
            {nextKey && ` Tu próxima fecha es el ${longDayLabel(nextKey).toLowerCase()}.`}
          </p>
          {nextKey && (
            <button type="button" onClick={() => onGoTo(nextKey)} className={rowButton}>
              Ir a {MONTHS[Number(nextKey.slice(5, 7)) - 1].toLowerCase()}
            </button>
          )}
        </div>
      )}
    </section>
  );
};
