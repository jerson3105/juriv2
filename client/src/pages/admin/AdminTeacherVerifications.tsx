import { useId, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Globe, ShieldCheck, Trash2 } from 'lucide-react';
import { verificationApi, type TeacherToVerify } from '../../lib/verificationApi';
import { useAuthStore } from '../../store/authStore';
import { cancelButton, inputClass, labelClass, primaryButton } from '../../components/home/homeHelpers';
import { card } from '../../components/gradebook/gradebookHelpers';
import { errorMessage } from '../../components/auth/authHelpers';

type Tab = 'PENDING' | 'UNVERIFIED' | 'DOMAINS';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** Docentes que piden verificación (o siguen sin verificar) y dominios institucionales. */
export default function AdminTeacherVerifications() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const ids = useId();
  const [tab, setTab] = useState<Tab>('PENDING');
  const [domain, setDomain] = useState('');
  const [domainNote, setDomainNote] = useState('');

  const teachers = useQuery({
    queryKey: ['admin-teacher-verifications', tab],
    queryFn: () => verificationApi.listTeachers(tab === 'UNVERIFIED' ? 'UNVERIFIED' : 'PENDING'),
    enabled: tab !== 'DOMAINS',
  });
  const domains = useQuery({ queryKey: ['admin-verified-domains'], queryFn: verificationApi.listDomains, enabled: tab === 'DOMAINS' });

  const review = useMutation({
    mutationFn: ({ teacher, approved }: { teacher: TeacherToVerify; approved: boolean }) => {
      const reason = approved ? undefined : window.prompt(`Motivo del rechazo para ${teacher.firstName} (lo verá en su aviso):`) ?? undefined;
      return verificationApi.reviewTeacher(teacher.id, approved, reason);
    },
    onSuccess: (_, { teacher, approved }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-teacher-verifications'] });
      toast.success(approved ? `${teacher.firstName} quedó verificado` : 'Solicitud rechazada');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo revisar')),
  });

  const addDomain = useMutation({
    mutationFn: () => verificationApi.addDomain(domain.trim(), domainNote.trim() || undefined),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-verified-domains'] });
      setDomain('');
      setDomainNote('');
      toast.success(data.verified > 0 ? `Dominio agregado. ${data.verified} docente(s) quedaron verificados.` : 'Dominio agregado');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo agregar el dominio')),
  });
  const removeDomain = useMutation({
    mutationFn: (id: string) => verificationApi.removeDomain(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-verified-domains'] }),
    onError: (error) => toast.error(errorMessage(error, 'No se pudo quitar el dominio')),
  });

  if (user?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      aria-pressed={tab === value}
      className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${tab === value ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-700 hover:text-gray-900 dark:text-gray-300'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-900 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/admin" aria-label="Volver al panel" className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-700 hover:bg-white dark:text-gray-200 dark:hover:bg-gray-800">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white" aria-hidden="true"><ShieldCheck size={22} /></span>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Docentes por verificar</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">Sin verificar: usan su clase con la lista, pero no reciben alumnos con cuenta ni familias.</p>
          </div>
        </div>

        <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800" role="group" aria-label="Qué ver">
          {tabButton('PENDING', 'Piden verificación')}
          {tabButton('UNVERIFIED', 'Sin verificar')}
          {tabButton('DOMAINS', 'Dominios del colegio')}
        </div>

        {tab !== 'DOMAINS' && (
          teachers.isLoading ? (
            <p className="py-8 text-center text-sm text-gray-700 dark:text-gray-300" role="status">Cargando…</p>
          ) : (teachers.data ?? []).length === 0 ? (
            <p className={`${card} text-center text-sm text-gray-700 dark:text-gray-300`}>{tab === 'PENDING' ? 'No hay solicitudes pendientes.' : 'No hay docentes sin verificar.'}</p>
          ) : (
            <ul className="space-y-3">
              {(teachers.data ?? []).map((teacher) => (
                <li key={teacher.id} className={card}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <p className="text-base font-bold text-gray-900 dark:text-white">{teacher.firstName} {teacher.lastName}</p>
                      <p className="break-all text-gray-700 dark:text-gray-300">{teacher.email} · {teacher.provider === 'GOOGLE' ? 'Google' : 'Correo'}</p>
                      <p className="mt-1 text-gray-800 dark:text-gray-100">
                        {teacher.classes} {teacher.classes === 1 ? 'clase' : 'clases'} · {teacher.students} {teacher.students === 1 ? 'alumno' : 'alumnos'} en lista · alta {fmt(teacher.createdAt)} · último ingreso {fmt(teacher.lastLoginAt)}
                      </p>
                      {teacher.note && <p className="mt-2 rounded-lg bg-gray-50 p-2 text-gray-900 dark:bg-gray-900/40 dark:text-gray-100">{teacher.note}</p>}
                    </div>
                    <div className="flex gap-2">
                      {tab === 'PENDING' && (
                        <button type="button" onClick={() => review.mutate({ teacher, approved: false })} disabled={review.isPending} className={cancelButton}>Rechazar</button>
                      )}
                      <button type="button" onClick={() => review.mutate({ teacher, approved: true })} disabled={review.isPending} className={primaryButton}>Verificar</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === 'DOMAINS' && (
          <div className="space-y-4">
            <form
              className={`${card} grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end`}
              onSubmit={(e) => { e.preventDefault(); if (domain.trim()) addDomain.mutate(); }}
            >
              <div>
                <label htmlFor={`${ids}-domain`} className={labelClass}>Dominio del colegio</label>
                <input id={`${ids}-domain`} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="colegio.edu.pe" className={`${inputClass} mt-1`} />
              </div>
              <div>
                <label htmlFor={`${ids}-note`} className={labelClass}>Nota (opcional)</label>
                <input id={`${ids}-note`} value={domainNote} onChange={(e) => setDomainNote(e.target.value)} placeholder="Nombre del colegio" className={`${inputClass} mt-1`} />
              </div>
              <button type="submit" disabled={addDomain.isPending || !domain.trim()} className={primaryButton}>Agregar</button>
              <p className="text-xs text-gray-700 dark:text-gray-300 sm:col-span-3">
                Los docentes con un correo de este dominio quedan verificados (también los que ya esperaban). No uses dominios que los alumnos compartan con los docentes.
              </p>
            </form>
            {(domains.data ?? []).length === 0 ? (
              <p className={`${card} text-center text-sm text-gray-700 dark:text-gray-300`}>Aún no hay dominios.</p>
            ) : (
              <ul className={`${card} divide-y divide-gray-200 p-0 dark:divide-gray-700`}>
                {(domains.data ?? []).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-gray-900 dark:text-white">
                      <Globe size={16} className="shrink-0 text-gray-600 dark:text-gray-300" aria-hidden="true" />
                      <span className="font-semibold">{d.domain}</span>
                      {d.note && <span className="truncate text-gray-700 dark:text-gray-300">· {d.note}</span>}
                    </span>
                    <button type="button" onClick={() => removeDomain.mutate(d.id)} aria-label={`Quitar ${d.domain}`} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-700 dark:text-gray-200 dark:hover:bg-red-500/10">
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
