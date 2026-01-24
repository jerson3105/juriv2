import { useOutletContext, useNavigate } from 'react-router-dom';
import { type Classroom } from '../../lib/classroomApi';
import { CollectiblesActivity } from '../../components/activities/CollectiblesActivity';

export const CollectiblesPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom }>();
  const navigate = useNavigate();

  return (
    <CollectiblesActivity 
      classroom={classroom} 
      onBack={() => navigate(`/classroom/${classroom.id}`)} 
    />
  );
};
