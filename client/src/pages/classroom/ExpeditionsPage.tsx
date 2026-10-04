import { useOutletContext, useParams } from 'react-router-dom';
import type { Classroom, Student } from '../../lib/classroomApi';
import { ExpeditionList } from '../../components/expeditions/teacher/ExpeditionList';
import { ExpeditionEditor } from '../../components/expeditions/teacher/ExpeditionEditor';

/** Expediciones del docente con URL propia: /classroom/:id/expeditions y /classroom/:id/expeditions/:expeditionId. */
export const ExpeditionsPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom & { students?: Student[]; xpPerLevel?: number } }>();
  const { expeditionId } = useParams<{ expeditionId?: string }>();
  return expeditionId
    ? <ExpeditionEditor key={expeditionId} classroom={classroom} expeditionId={expeditionId} />
    : <ExpeditionList classroomId={classroom.id} classroomName={classroom.name} />;
};
