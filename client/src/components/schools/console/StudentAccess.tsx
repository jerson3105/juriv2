import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FileDown, KeyRound } from 'lucide-react';
import { errorMessage } from '../../auth/authHelpers';
import { schoolAccessApi, type StudentAccessInfo } from '../../../lib/schoolAccessApi';

interface AccessActionsProps {
  schoolId: string;
  yearId: string;
  studentId: string;
  name: string;
  access: StudentAccessInfo;
}

/**
 * Con PIN: «Restablecer PIN» (se borra, se cierran sus sesiones y recibe una tarjeta nueva). Sin PIN: su tarjeta de un
 * solo uso en PDF. Lo usan la ficha (administración) y «Mi tutoría» (su tutor).
 */
export const AccessActions = ({ schoolId, yearId, studentId, name, access }: AccessActionsProps) => {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // La ficha, «Mi tutoría» y el resumen de acceso cuentan con este estado.
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['school-roster', schoolId, yearId] });
    void queryClient.invalidateQueries({ queryKey: ['school-assignments', schoolId, yearId] });
    void queryClient.invalidateQueries({ queryKey: ['school-access', schoolId, yearId] });
  };
  const reset = useMutation({
    mutationFn: () => schoolAccessApi.resetPin(schoolId, yearId, studentId),
    onSuccess: (data) => {
      setConfirming(false);
      toast.success(data.hadPin ? 'PIN restablecido: imprime su tarjeta nueva' : 'Tarjeta nueva lista');
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo restablecer el PIN')),
  });
  const card = async () => {
    setDownloading(true);
    try {
      await schoolAccessApi.downloadStudentCard(schoolId, yearId, studentId, name);
      refresh();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo descargar su tarjeta'));
    } finally {
      setDownloading(false);
    }
  };

  if (access.state !== 'pin') {
    return (
      <button type="button" className="pg-btn pg-focus" disabled={downloading} onClick={() => void card()}>
        <FileDown size={16} aria-hidden="true" />{downloading ? 'Generando…' : access.hasCard ? 'Imprimir su tarjeta' : 'Tarjeta de acceso'}
      </button>
    );
  }
  if (!confirming) {
    return <button type="button" className="pg-btn pg-focus" onClick={() => setConfirming(true)}><KeyRound size={16} aria-hidden="true" />Restablecer PIN</button>;
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
      Se borra su PIN, se cierran sus sesiones y recibe una tarjeta nueva.
      <button type="button" className="pg-btn pg-focus" disabled={reset.isPending} onClick={() => reset.mutate()}>{reset.isPending ? 'Restableciendo…' : 'Restablecer'}</button>
      <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setConfirming(false)}>No</button>
    </span>
  );
};
