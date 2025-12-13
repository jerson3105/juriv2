import { useOutletContext } from 'react-router-dom';
import { ExpeditionsActivity } from '../../components/activities/ExpeditionsActivity';

interface ClassroomContext {
  classroom: any;
  refetch: () => void;
}

export const ExpeditionsPage = () => {
  const { classroom } = useOutletContext<ClassroomContext>();

  return (
    <ExpeditionsActivity 
      classroom={classroom}
      onBack={() => window.history.back()}
    />
  );
};
