import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Copy, UserPlus } from 'lucide-react';
import api from '../../lib/api';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, errorMessage, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { schoolDetailKey, schoolTeachersKey } from './schoolHelpers';

const card = 'rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800';
type Created = { email: string; created: true; temporaryPassword: string } | { email: string; created: false };

const domainsKey = (schoolId: string) => ['school-teacher-domains', schoolId] as const;

/**
 * Crear la cuenta de un docente que aún no usa Juried, con su correo del colegio (dominio verificado). Si ya tenía
 * cuenta, entra directo al colegio. La clave temporal se muestra una sola vez.
 */
export const CreateTeacherAccount = ({ schoolId }: { schoolId: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <section className={`${card} flex flex-wrap items-center gap-3`} aria-labelledby="create-teacher-title">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200" aria-hidden="true">
        <UserPlus size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 id="create-teacher-title" className="font-bold text-gray-900 dark:text-white">Crea la cuenta de un docente</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300">Para quien aún no usa Juried: con su correo del colegio, la cuenta nace verificada y dentro del colegio.</p>
      </div>
      <button type="button" className={`${primaryButton} min-h-[40px]`} onClick={() => setOpen(true)}>Crear cuenta</button>
      <AnimatePresence>{open && <CreateTeacherModal schoolId={schoolId} onClose={() => setOpen(false)} />}</AnimatePresence>
    </section>
  );
};

const CreateTeacherModal = ({ schoolId, onClose }: { schoolId: string; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<Created | null>(null);
  const domains = useQuery({ queryKey: domainsKey(schoolId), queryFn: async (): Promise<string[]> => (await api.get(`/schools/${schoolId}/teacher-accounts/domains`)).data.data });
  const create = useMutation({
    mutationFn: async (): Promise<Created> => (await api.post(`/schools/${schoolId}/teacher-accounts`, { firstName, lastName, email })).data.data,
    onSuccess: (data) => {
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: schoolTeachersKey(schoolId) });
      void queryClient.invalidateQueries({ queryKey: schoolDetailKey(schoolId) });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo crear la cuenta')),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Clave copiada');
    } catch {
      toast.error('No se pudo copiar');
    }
  };
  const list = domains.data ?? [];

  if (result) {
    return (
      <HomeModal title={result.created ? 'Cuenta creada' : 'Ya tenía cuenta'} subtitle={result.email} onClose={onClose} footer={<button type="button" className={primaryButton} onClick={onClose}>Listo</button>}>
        {result.created ? (
          <>
            <p className="text-sm text-gray-800 dark:text-gray-200">Ya es parte del colegio. Su clave temporal:</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-xl bg-gray-100 px-3 py-2 font-mono text-lg tracking-wider text-gray-900 dark:bg-gray-900/60 dark:text-white">{result.temporaryPassword}</code>
              <button type="button" className={`${primaryButton} min-h-[40px]`} onClick={() => void copy(result.temporaryPassword)}><Copy size={16} aria-hidden="true" />Copiar</button>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <b>Se muestra una sola vez.</b> Dásela en persona: entra con su correo y esta clave (o con Google, con ese mismo correo) y la cambia en Configuración.
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-800 dark:text-gray-200">Ese correo ya tenía una cuenta de docente: ahora es parte del colegio y entra como siempre.</p>
        )}
      </HomeModal>
    );
  }

  return (
    <HomeModal
      title="Crear la cuenta de un docente"
      subtitle={list.length ? `Con su correo del colegio (${list.map((d) => `@${d}`).join(' o ')})` : undefined}
      onClose={onClose}
      footer={list.length ? (
        <>
          <button type="button" className={cancelButton} onClick={onClose}>Cancelar</button>
          <button type="submit" form="create-teacher-form" className={primaryButton} disabled={create.isPending || !firstName.trim() || !lastName.trim() || !email.trim()}>
            {create.isPending ? 'Creando…' : 'Crear cuenta'}
          </button>
        </>
      ) : <button type="button" className={cancelButton} onClick={onClose}>Cerrar</button>}
    >
      {domains.isLoading ? (
        <p className="text-sm text-gray-700 dark:text-gray-300" role="status">Revisando los dominios del colegio…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-gray-800 dark:text-gray-200">
          Tu colegio aún no tiene un dominio verificado (por ejemplo, @colegio.edu.pe). Pídeselo al equipo de Juried o invita con el enlace o el código.
        </p>
      ) : (
        <form id="create-teacher-form" onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Nombres
              <input className={`${inputClass} mt-1`} value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={100} autoComplete="off" required />
            </label>
            <label className={labelClass}>
              Apellidos
              <input className={`${inputClass} mt-1`} value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={100} autoComplete="off" required />
            </label>
          </div>
          <label className={labelClass}>
            Correo del colegio
            <input type="email" className={`${inputClass} mt-1`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`nombre@${list[0]}`} maxLength={255} autoComplete="off" required />
          </label>
          <p className="text-xs text-gray-600 dark:text-gray-300">Si ese correo ya tiene cuenta de docente, solo se suma al colegio.</p>
        </form>
      )}
    </HomeModal>
  );
};
