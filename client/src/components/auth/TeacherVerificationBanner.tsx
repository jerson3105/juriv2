import { useId, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Clock, ShieldAlert } from 'lucide-react';
import { verificationApi } from '../../lib/verificationApi';
import { useAuthStore } from '../../store/authStore';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { secondaryButton } from '../gradebook/gradebookHelpers';
import { StudentSwitchPanel } from './StudentSwitch';
import { useStudentSwitch } from './useStudentSwitch';
import { errorMessage } from './authHelpers';

const teacherStatusKey = ['teacher-status'] as const;

/**
 * Docente sin verificar: su clase funciona con la lista, pero los alumnos no entran con su
 * cuenta ni se vinculan familias hasta verificarse (por su escuela, su correo institucional o
 * revisión del equipo de Juried).
 */
export const TeacherVerificationBanner = () => {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const ids = useId();
  const [requesting, setRequesting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [note, setNote] = useState('');
  const { data: status } = useQuery({ queryKey: teacherStatusKey, queryFn: verificationApi.getMyStatus, enabled: role === 'TEACHER', staleTime: 60_000 });
  const { data: canSwitch } = useStudentSwitch(status?.status === 'UNVERIFIED');

  const request = useMutation({
    mutationFn: () => verificationApi.requestReview(note.trim()),
    onSuccess: (data) => {
      queryClient.setQueryData(teacherStatusKey, data);
      setRequesting(false);
      toast.success('Solicitud enviada. Te avisaremos aquí.');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo enviar la solicitud')),
  });

  if (!status || status.status === 'VERIFIED') return null;

  if (status.status === 'PENDING') {
    return (
      <section className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-50" role="status">
        <Clock size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-bold">Estamos revisando tu cuenta de docente</p>
          <p className="mt-0.5">Mientras tanto, tu clase funciona con la lista de alumnos. Cuando te verifiquemos, tus estudiantes podrán entrar con su cuenta y las familias vincularse.</p>
        </div>
      </section>
    );
  }

  const rejected = status.note?.startsWith('Rechazado:');
  return (
    <>
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-50" aria-labelledby={`${ids}-title`}>
        <div className="flex items-start gap-3">
          <ShieldAlert size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id={`${ids}-title`} className="font-bold">Tu cuenta de docente está sin verificar</h2>
            <p className="mt-0.5">
              Tu clase ya funciona con la lista de alumnos. Para que tus estudiantes entren con su propia cuenta y las familias se vinculen, verifica tu cuenta.
              Si tu colegio usa Juried, pide al responsable su enlace de invitación.
            </p>
            {rejected && <p className="mt-2 font-semibold">{status.note}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setRequesting(true)} className={primaryButton}>Pedir verificación</button>
              {canSwitch?.eligible && (
                <button type="button" onClick={() => setSwitching(true)} className={secondaryButton}>¿Eres estudiante?</button>
              )}
            </div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {requesting && (
          <HomeModal
            title="Pedir verificación"
            subtitle="Lo revisa el equipo de Juried"
            onClose={() => setRequesting(false)}
            footer={(
              <>
                <button type="button" onClick={() => setRequesting(false)} className={cancelButton}>Cancelar</button>
                <button type="button" onClick={() => request.mutate()} disabled={request.isPending || note.trim().length < 10} className={primaryButton}>
                  {request.isPending ? 'Enviando…' : 'Enviar'}
                </button>
              </>
            )}
          >
            <label htmlFor={`${ids}-note`} className={labelClass}>¿En qué colegio trabajas y qué cursos das?</label>
            <textarea
              id={`${ids}-note`}
              data-autofocus
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="Ej.: Colegio San José, Lima. Docente de Ciencias de 5.º y 6.º de primaria."
              className={`${inputClass} mt-1`}
            />
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">Si tienes correo del colegio, menciónalo: podemos verificar a todos los docentes de tu colegio de una vez.</p>
          </HomeModal>
        )}
        {switching && (
          <HomeModal title="Cambiar a cuenta de estudiante" onClose={() => setSwitching(false)}>
            <StudentSwitchPanel onCancel={() => setSwitching(false)} />
          </HomeModal>
        )}
      </AnimatePresence>
    </>
  );
};
