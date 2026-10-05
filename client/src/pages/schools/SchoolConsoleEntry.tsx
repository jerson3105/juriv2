import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { schoolApi } from '../../lib/schoolApi';
import { canViewSchool, mySchoolsKey } from '../../components/schools/schoolHelpers';

/**
 * «Mi Escuela»: con una sola escuela disponible, directo a su consola; sin escuela o con varias, a la lista (unirse,
 * crear, elegir).
 */
export const SchoolConsoleEntry = () => {
  const { data: schools, isLoading, isError } = useQuery({ queryKey: mySchoolsKey, queryFn: schoolApi.getMySchools });
  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando tu escuela">
        <div className="h-16 animate-pulse rounded-2xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" />
        <div className="h-40 animate-pulse rounded-2xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" />
      </div>
    );
  }
  const viewable = (schools ?? []).filter(canViewSchool);
  if (!isError && viewable.length === 1 && schools?.length === 1) return <Navigate to={`/escuela/${viewable[0].id}`} replace />;
  return <Navigate to="/schools" replace />;
};
