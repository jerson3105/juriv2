import { useOutletContext, useParams } from 'react-router-dom';
import type { Classroom } from '../../lib/classroomApi';
import { ExpeditionList } from '../../components/expeditions/teacher/ExpeditionList';
import { ExpeditionEditor } from '../../components/expeditions/teacher/ExpeditionEditor';

/** Expediciones del docente con URL propia: /classroom/:id/expeditions y /classroom/:id/expeditions/:expeditionId. */
export const ExpeditionsPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom }>();
  const { expeditionId } = useParams<{ expeditionId?: string }>();
  const xpPerLevel = (classroom as Classroom & { xpPerLevel?: number }).xpPerLevel || 100;
  return expeditionId
    ? <ExpeditionEditor key={expeditionId} classroomId={classroom.id} expeditionId={expeditionId} xpPerLevel={xpPerLevel} />
    : <ExpeditionList classroomId={classroom.id} classroomName={classroom.name} />;
};
