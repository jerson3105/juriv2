import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Users } from 'lucide-react';
import { verificationApi, type FamilyRequest } from '../../lib/verificationApi';
import { useAuthStore } from '../../store/authStore';
import { primaryButton, cancelButton } from './homeHelpers';
import { errorMessage } from '../auth/authHelpers';

const familyRequestsKey = ['family-requests'] as const;

/**
 * Familias que piden ver el progreso de un alumno: el docente confirma que son su familia antes
 * de que vean nada (antes el vínculo se activaba solo con el código).
 */
export const FamilyRequestsPanel = () => {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const { data: requests = [] } = useQuery({ queryKey: familyRequestsKey, queryFn: verificationApi.getFamilyRequests, enabled: role === 'TEACHER' });

  const review = useMutation({
    mutationFn: ({ request, approved }: { request: FamilyRequest; approved: boolean }) =>
      approved ? verificationApi.approveFamily(request.linkId) : verificationApi.rejectFamily(request.linkId),
    onSuccess: (_, { request, approved }) => {
      void queryClient.invalidateQueries({ queryKey: familyRequestsKey });
      toast.success(approved ? `${request.parentFirstName} ya puede ver el progreso` : 'Solicitud rechazada');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo revisar la solicitud')),
  });

  if (requests.length === 0) return null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800" aria-labelledby="family-requests-title">
      <h2 id="family-requests-title" className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
        <Users size={18} aria-hidden="true" /> Familias por aprobar ({requests.length})
      </h2>
      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">Confirma que son la familia de tu estudiante antes de que vean su progreso.</p>
      <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
        {requests.map((request) => {
          const student = request.studentName || request.studentCharacterName || 'tu estudiante';
          const busy = review.isPending && review.variables?.request.linkId === request.linkId;
          return (
            <li key={request.linkId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-gray-900 dark:text-white">{request.parentFirstName} {request.parentLastName}</p>
                <p className="break-all text-gray-700 dark:text-gray-300">{request.parentEmail}</p>
                <p className="text-gray-800 dark:text-gray-100">Quiere ver a <strong>{student}</strong> · {request.classroomName}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => review.mutate({ request, approved: false })} disabled={busy} className={cancelButton}>Rechazar</button>
                <button type="button" onClick={() => review.mutate({ request, approved: true })} disabled={busy} className={primaryButton}>Aprobar</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
