import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { behaviorApi, type Behavior } from '../../lib/behaviorApi';
import { attendanceApi, type AttendanceRecord } from '../../lib/attendanceApi';
import { classNoteApi } from '../../lib/classNoteApi';
import { useTimer } from '../../contexts/TimerContext';
import { useApplyWithUndo } from '../../hooks/useApplyWithUndo';
import { getDisplayName, type StudentData } from './utilities/helpers';
import { ToolSelector, type ToolId } from './utilities/ToolSelector';
import { RandomPicker } from './utilities/RandomPicker';
import { GroupCreator } from './utilities/GroupCreator';
import { ScreenMessage } from './utilities/ScreenMessage';
import { ClassNotes } from './utilities/ClassNotes';
import { HeroShowcase } from './utilities/HeroShowcase';

interface ClassroomUtilitiesProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentData[];
  showCharacterName?: boolean;
  classroomId: string;
  xpPerLevel?: number;
  allowNegativePoints?: boolean;
}

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Herramientas de clase (se abren desde la cabecera del aula en cualquier página).
// Cerrar una herramienta vuelve a la clase, no al selector.
export const ClassroomUtilities = ({
  isOpen,
  onClose,
  students,
  showCharacterName = true,
  classroomId,
  xpPerLevel = 100,
  allowNegativePoints = true,
}: ClassroomUtilitiesProps) => {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const { openFloatingTimer, openFloatingStopwatch } = useTimer();
  const pointsTools = useApplyWithUndo(classroomId);
  const today = localToday();

  const { data: pendingNotesCount = 0 } = useQuery({
    queryKey: ['class-notes-count', classroomId],
    queryFn: () => classNoteApi.pendingCount(classroomId),
    enabled: !!classroomId,
  });

  // Mismas claves que la Lista: comparten caché.
  const { data: behaviors = [] } = useQuery({
    queryKey: ['behaviors', classroomId],
    queryFn: () => behaviorApi.getByClassroom(classroomId),
    enabled: isOpen && !!classroomId,
  });
  const { data: todayAttendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-today', classroomId, today],
    queryFn: () => attendanceApi.getAttendanceByDate(classroomId, today),
    enabled: isOpen && !!classroomId,
  });

  // null = aún no se pasó lista hoy (entonces no se ofrece "solo presentes").
  const presentIds = useMemo(() => {
    if (todayAttendance.length === 0) return null;
    return new Set(todayAttendance.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').map((r) => r.studentProfileId));
  }, [todayAttendance]);

  const featuredBehaviors: Behavior[] = useMemo(() => {
    const positives = behaviors.filter((b) => b.isPositive);
    const negatives = behaviors.filter((b) => !b.isPositive);
    return [
      ...pointsTools.mostUsed(positives, 4),
      ...(allowNegativePoints ? pointsTools.mostUsed(negatives, 2) : []),
    ];
  }, [behaviors, allowNegativePoints, pointsTools]);

  const closeAll = () => {
    setActiveTool(null);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <AnimatePresence>
        {!activeTool && (
          <ToolSelector
            key="tool-selector"
            onSelect={setActiveTool}
            onClose={closeAll}
            pendingNotesCount={pendingNotesCount}
            onStartTimer={(minutes) => {
              openFloatingTimer(minutes, true);
              closeAll();
            }}
            onOpenTimer={() => {
              openFloatingTimer(5, false);
              closeAll();
            }}
            onOpenStopwatch={() => {
              openFloatingStopwatch();
              closeAll();
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {activeTool === 'random' && (
          <RandomPicker
            key="random"
            students={students}
            presentIds={presentIds}
            showCharacterName={showCharacterName}
            classroomId={classroomId}
            behaviors={featuredBehaviors}
            isApplying={pointsTools.isApplying}
            onApply={async (behavior, student) =>
              (await pointsTools.apply(behavior, [student.id], getDisplayName(student, showCharacterName))) !== null}
            onApplyGroup={async (behavior, members, label) =>
              (await pointsTools.apply(behavior, members.map((m) => m.id), label)) !== null}
            onClose={closeAll}
          />
        )}
        {activeTool === 'groups' && (
          <GroupCreator
            key="groups"
            students={students}
            presentIds={presentIds}
            showCharacterName={showCharacterName}
            classroomId={classroomId}
            behaviors={featuredBehaviors}
            isApplying={pointsTools.isApplying}
            onApplyGroup={async (behavior, members, label) =>
              (await pointsTools.apply(behavior, members.map((m) => m.id), label)) !== null}
            onClose={closeAll}
          />
        )}
        {activeTool === 'message' && <ScreenMessage key="message" classroomId={classroomId} onClose={closeAll} />}
        {activeTool === 'notes' && <ClassNotes key="notes" classroomId={classroomId} onClose={closeAll} />}
        {activeTool === 'showcase' && (
          <HeroShowcase
            key="showcase"
            students={students}
            showCharacterName={showCharacterName}
            classroomId={classroomId}
            xpPerLevel={xpPerLevel}
            onClose={closeAll}
          />
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
};
