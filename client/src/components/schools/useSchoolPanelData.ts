import { useQuery } from '@tanstack/react-query';
import { schoolApi, type MySchool } from '../../lib/schoolApi';
import { pendingRequestsKey, schoolDetailKey, schoolTeachersKey } from './schoolHelpers';

/** Detalle, profesores y solicitudes de la escuela (las mismas claves en toda la consola: una sola carga). */
export const useSchoolPanelData = (school: MySchool, manage: boolean) => {
  const detail = useQuery({ queryKey: schoolDetailKey(school.id), queryFn: () => schoolApi.getDetail(school.id) });
  const teachers = useQuery({ queryKey: schoolTeachersKey(school.id), queryFn: () => schoolApi.getSchoolTeachers(school.id) });
  const requests = useQuery({ queryKey: pendingRequestsKey(school.id), queryFn: () => schoolApi.getPendingRequests(school.id), enabled: manage });
  return {
    detail: detail.data,
    classrooms: detail.data?.classrooms ?? [],
    teachers: teachers.data ?? [],
    requests: requests.data ?? [],
    loadingDetail: detail.isLoading,
    loadingTeachers: teachers.isLoading,
  };
};
