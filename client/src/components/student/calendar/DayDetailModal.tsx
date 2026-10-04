import { HomeModal } from '../../home/HomeModal';
import { cancelButton } from '../../home/homeHelpers';
import { TodoRow } from '../home/TodoRow';
import { expeditionAction, expeditionStep } from '../home/nextGoal';
import { NOTE_CATEGORY, longDayLabel } from '../home/studentHomeHelpers';
import { ATTENDANCE, relativeDay, type CalendarDay } from './calendarHelpers';

const noop = () => undefined;

/** Detalle de un día: asistencia, avisos completos y cierres de expediciones. */
export const DayDetailModal = ({ day, today, onClose }: { day: CalendarDay; today: string; onClose: () => void }) => {
  const status = day.attendance ? ATTENDANCE[day.attendance.status] : null;
  const StatusIcon = status?.icon;
  const past = day.key < today;

  return (
    <HomeModal
      title={longDayLabel(day.key)}
      subtitle={relativeDay(day.key, today)}
      onClose={onClose}
      footer={<button type="button" onClick={onClose} className={cancelButton} data-autofocus>Cerrar</button>}
    >
      {status && StatusIcon && (
        <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${status.chip}`}>
          <StatusIcon size={16} strokeWidth={2.5} aria-hidden="true" />
          {status.phrase}
          {day.attendance!.xpAwarded > 0 && ` · +${day.attendance!.xpAwarded} XP`}
        </p>
      )}
      {(day.notes.length > 0 || day.expeditions.length > 0) && (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {day.expeditions.map((expedition) => (
            <TodoRow
              key={expedition.id}
              chipless
              onOpen={noop}
              item={{ key: expedition.id, chip: '', today: false, label: 'Vence en la expedición', text: `«${expedition.name}» · ${expeditionStep(expedition)}`, action: expeditionAction(expedition) }}
            />
          ))}
          {day.notes.map((note) => (
            <TodoRow
              key={note.id}
              chipless
              done={past}
              onOpen={noop}
              item={{ key: note.id, chip: '', today: false, label: NOTE_CATEGORY[note.category], text: note.content }}
            />
          ))}
        </ul>
      )}
    </HomeModal>
  );
};
