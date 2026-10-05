import { useEffect, useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Copy, X } from 'lucide-react';
import { schoolApi, type AdminOwnerChanged, type AdminSchoolWithMembers, type PreviousOwner } from '../../lib/schoolApi';
import { verificationApi, type DomainScope } from '../../lib/verificationApi';
import { adminOverviewKey } from '../../lib/adminApi';
import { errorMessage } from '../auth/authHelpers';
import { primaryButton } from './adminStyles';
import { schoolFormStyles as f } from './schoolFormStyles';

const section = 'space-y-3 border-b border-[var(--pg-line)] pb-5 last:border-b-0 last:pb-0';
const SCOPES: ReadonlyArray<readonly [DomainScope, string, string]> = [
  ['TEACHERS_ONLY', 'Solo los docentes', 'Quien entra con Google con ese correo queda verificado como docente.'],
  ['SHARED', 'Docentes y estudiantes', 'No verifica a nadie por sí solo (un estudiante no puede pasar por docente).'],
];
const SCOPE_LABEL: Record<DomainScope, string> = { TEACHERS_ONLY: 'solo docentes', SHARED: 'docentes y estudiantes' };
const PREVIOUS: ReadonlyArray<readonly [PreviousOwner, string, string]> = [
  ['ADMIN', 'Queda en la administración', 'Sigue gestionando el colegio; el nuevo responsable puede quitarlo después.'],
  ['TEACHER', 'Queda como docente', 'Sigue en el colegio con sus clases, sin gestionar la consola.'],
  ['REMOVE', 'Sale del colegio', 'Deja de ser miembro: sus clases vuelven a ser personales y pierde sus asignaciones, talleres y tutorías.'],
];
const OUTCOME: Record<PreviousOwner, string> = {
  ADMIN: 'quedó en la administración',
  TEACHER: 'quedó como docente',
  REMOVE: 'salió del colegio',
};
const fullName = (m: { firstName: string; lastName: string }) => `${m.firstName} ${m.lastName}`.trim();

/**
 * Editar un colegio desde el panel: sus datos, el dominio de su correo institucional (con él su administración crea
 * las cuentas de sus docentes) y su responsable (el anterior queda en la administración, como docente o sale). Cada
 * parte se guarda por separado.
 */
export const EditSchoolDialog = ({ school, onClose }: { school: AdminSchoolWithMembers; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const titleId = useId();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-schools'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-verified-domains'] });
    void queryClient.invalidateQueries({ queryKey: adminOverviewKey });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div data-pg="" className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="pg-surface flex max-h-[90vh] w-full max-w-2xl flex-col shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--pg-line)] px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold">Editar colegio</h2>
            <p className="pg-fg2 text-sm">{school.name}</p>
          </div>
          <button type="button" onClick={onClose} className="pg-icon-btn" aria-label="Cerrar"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <div className="space-y-5 overflow-y-auto px-5 py-4">
          <DataSection school={school} onSaved={refresh} />
          <DomainSection school={school} onChanged={refresh} />
          <OwnerSection school={school} onChanged={refresh} />
        </div>
        <div className="flex justify-end border-t border-[var(--pg-line)] px-5 py-3">
          <button type="button" className={primaryButton} onClick={onClose}>Listo</button>
        </div>
      </div>
    </div>
  );
};

const DataSection = ({ school, onSaved }: { school: AdminSchoolWithMembers; onSaved: () => void }) => {
  const saved = { name: school.name, modularCode: school.modularCode ?? '', region: school.province ?? '', city: school.city ?? '', address: school.address ?? '' };
  const [form, setForm] = useState(saved);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: e.target.value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const save = useMutation({
    mutationFn: () => schoolApi.adminUpdateSchool(school.id, {
      name: form.name.trim(),
      modularCode: form.modularCode.trim() || null,
      region: form.region.trim() || null,
      city: form.city.trim() || null,
      address: form.address.trim() || null,
    }),
    onSuccess: (message) => {
      toast.success(message);
      onSaved();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudieron guardar los datos')),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dirty && form.name.trim()) save.mutate();
  };
  return (
    <form onSubmit={submit} className={section}>
      <h3 className="text-sm font-bold">El colegio</h3>
      <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
        <label className={f.label}>
          Nombre
          <input className={f.input} value={form.name} onChange={set('name')} maxLength={255} required autoComplete="off" />
        </label>
        <label className={f.label}>
          Código modular <span className="pg-fg2 font-normal">(opcional)</span>
          <input className={f.input} value={form.modularCode} onChange={set('modularCode')} maxLength={10} inputMode="numeric" placeholder="7 números" autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={f.label}>
          Región
          <input className={f.input} value={form.region} onChange={set('region')} maxLength={100} placeholder="Ej.: Puno" autoComplete="off" />
        </label>
        <label className={f.label}>
          Ciudad o distrito
          <input className={f.input} value={form.city} onChange={set('city')} maxLength={100} placeholder="Ej.: Juliaca" autoComplete="off" />
        </label>
      </div>
      <label className={f.label}>
        Dirección <span className="pg-fg2 font-normal">(opcional)</span>
        <input className={f.input} value={form.address} onChange={set('address')} maxLength={300} autoComplete="off" />
      </label>
      <div className="flex justify-end gap-2">
        {dirty && <button type="button" className="pg-btn" onClick={() => setForm(saved)}>Descartar</button>}
        <button type="submit" className={primaryButton} disabled={!dirty || !form.name.trim() || save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar datos'}</button>
      </div>
    </form>
  );
};

const DomainSection = ({ school, onChanged }: { school: AdminSchoolWithMembers; onChanged: () => void }) => {
  const scopeId = useId();
  const [domain, setDomain] = useState('');
  const [scope, setScope] = useState<DomainScope>('TEACHERS_ONLY');
  const [removing, setRemoving] = useState<{ id: string; domain: string } | null>(null);
  const add = useMutation({
    mutationFn: () => verificationApi.addDomain(domain.trim(), scope, undefined, school.id),
    onSuccess: (result) => {
      toast.success(result.verified > 0
        ? `Dominio ligado al colegio: ${result.verified === 1 ? 'un docente que esperaba quedó verificado' : `${result.verified} docentes que esperaban quedaron verificados`}`
        : 'Dominio ligado al colegio');
      setDomain('');
      onChanged();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo agregar el dominio')),
  });
  const remove = useMutation({
    mutationFn: (id: string) => verificationApi.removeDomain(id),
    onSuccess: () => {
      toast.success('Dominio quitado');
      setRemoving(null);
      onChanged();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo quitar el dominio')),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (domain.trim()) add.mutate();
  };
  return (
    <div className={section}>
      <h3 className="text-sm font-bold">Correo institucional</h3>
      {school.domains.length === 0 ? (
        <p className="pg-fg2 text-sm">Aún sin dominio: sin él, su administración no puede crear las cuentas de sus docentes.</p>
      ) : (
        <ul className="divide-y divide-[var(--pg-line)] rounded-lg border border-[var(--pg-line)]">
          {school.domains.map((d) => (
            <li key={d.id} className="px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-sm"><b>@{d.domain}</b> <span className="pg-fg2">· {SCOPE_LABEL[d.scope]}</span></span>
                {removing?.id !== d.id && <button type="button" className="pg-btn" onClick={() => setRemoving({ id: d.id, domain: d.domain })}>Quitar</button>}
              </div>
              {removing?.id === d.id && (
                <div className="mt-2 space-y-2 rounded-lg bg-[var(--pg-hover)] p-3 text-sm" role="group" aria-label={`Quitar @${d.domain}`}>
                  <p>¿Quitar <b>@{d.domain}</b>? Deja de verificar a quien entra con ese correo y la administración del colegio ya no crea cuentas con él. Los docentes que ya están verificados siguen así.</p>
                  <div className="flex justify-end gap-2">
                    <button type="button" className="pg-btn" onClick={() => setRemoving(null)}>Cancelar</button>
                    <button type="button" className={primaryButton} disabled={remove.isPending} onClick={() => remove.mutate(d.id)}>{remove.isPending ? 'Quitando…' : 'Quitar dominio'}</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="space-y-2">
        <label className={f.label}>
          {school.domains.length === 0 ? 'Dominio' : 'Agregar otro dominio'}
          <input className={f.input} value={domain} onChange={(e) => setDomain(e.target.value)} maxLength={255} placeholder="colegio.edu.pe" autoComplete="off" />
        </label>
        {domain.trim() && (
          <div role="radiogroup" aria-labelledby={scopeId} className="space-y-1">
            <p id={scopeId} className="text-sm font-medium">¿Quiénes usan ese dominio?</p>
            {SCOPES.map(([value, title, text]) => (
              <label key={value} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-[var(--pg-hover)]">
                <input type="radio" name={`scope-${school.id}`} value={value} checked={scope === value} onChange={() => setScope(value)} className="mt-1 h-4 w-4" />
                <span className="text-sm"><b>{title}</b><span className="pg-fg2 block text-xs">{text}</span></span>
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <button type="submit" className={primaryButton} disabled={!domain.trim() || add.isPending}>{add.isPending ? 'Agregando…' : 'Agregar dominio'}</button>
        </div>
      </form>
    </div>
  );
};

const OwnerSection = ({ school, onChanged }: { school: AdminSchoolWithMembers; onChanged: () => void }) => {
  const ids = { list: useId(), previous: useId() };
  const owner = school.members.find((m) => m.role === 'OWNER');
  const others = school.members.filter((m) => m.role !== 'OWNER' && m.status === 'VERIFIED');
  const empty = { email: '', firstNames: '', lastNames: '', previous: 'ADMIN' as PreviousOwner };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [result, setResult] = useState<AdminOwnerChanged | null>(null);
  const known = school.members.some((m) => m.email.toLowerCase() === form.email.trim().toLowerCase());
  const change = useMutation({
    mutationFn: () => schoolApi.adminChangeSchoolOwner(school.id, {
      email: form.email.trim(),
      ...(form.firstNames.trim() ? { firstNames: form.firstNames.trim() } : {}),
      ...(form.lastNames.trim() ? { lastNames: form.lastNames.trim() } : {}),
      previous: form.previous,
    }),
    onSuccess: (data) => {
      setResult(data);
      setOpen(false);
      setForm(empty);
      onChanged();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo cambiar el responsable')),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.email.trim()) change.mutate();
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Clave copiada');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  return (
    <div className={section}>
      <h3 className="text-sm font-bold">Responsable</h3>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm">
          {owner ? <><b>{fullName(owner)}</b> <span className="pg-fg2">· {owner.email}</span></> : <span className="pg-fg2">El colegio no tiene responsable.</span>}
        </p>
        {!open && <button type="button" className="pg-btn" onClick={() => { setOpen(true); setResult(null); }}>Cambiar responsable</button>}
      </div>

      {result && (
        <div className="space-y-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-900/20 dark:text-emerald-100" role="status">
          {result.owner.created && result.owner.temporaryPassword ? (
            <>
              <p>Creamos la cuenta de <b>{result.owner.email}</b>, nuevo responsable. Su clave temporal:</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-lg bg-[var(--pg-surface)] px-3 py-2 font-mono text-lg tracking-wider">{result.owner.temporaryPassword}</code>
                <button type="button" className="pg-btn" onClick={() => void copy(result.owner.temporaryPassword!)}><Copy className="h-4 w-4" aria-hidden="true" />Copiar</button>
              </div>
              <p><b>Se muestra una sola vez.</b> Entrégasela en persona: entra con su correo y esta clave y la cambia en Configuración.</p>
            </>
          ) : (
            <p><b>{result.owner.name || result.owner.email}</b> es ahora el responsable del colegio.</p>
          )}
          {result.previous.map((p) => (
            <p key={p.userId}>
              {p.name} {OUTCOME[p.outcome]}
              {p.outcome === 'REMOVE' && result.unassignedClassrooms > 0 ? ` (${result.unassignedClassrooms === 1 ? 'su clase quedó como personal' : `sus ${result.unassignedClassrooms} clases quedaron como personales`})` : ''}.
            </p>
          ))}
        </div>
      )}

      {open && (
        <form onSubmit={submit} className="space-y-3 rounded-lg border border-[var(--pg-line)] p-3">
          <label className={f.label}>
            Correo del nuevo responsable
            <input type="email" list={ids.list} className={f.input} value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} maxLength={255} required autoComplete="off" />
            <datalist id={ids.list}>
              {others.map((m) => <option key={m.id} value={m.email}>{fullName(m)}</option>)}
            </datalist>
          </label>
          {!known && form.email.trim() && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={f.label}>
                  Nombres
                  <input className={f.input} value={form.firstNames} onChange={(e) => setForm((c) => ({ ...c, firstNames: e.target.value }))} maxLength={100} autoComplete="off" />
                </label>
                <label className={f.label}>
                  Apellidos
                  <input className={f.input} value={form.lastNames} onChange={(e) => setForm((c) => ({ ...c, lastNames: e.target.value }))} maxLength={100} autoComplete="off" />
                </label>
              </div>
              <p className={f.hint}>Si su correo ya es de una cuenta de docente, se suma al colegio como responsable (los nombres no hacen falta). Si no, creamos su cuenta con una clave temporal.</p>
            </>
          )}
          {owner && (
            <div role="radiogroup" aria-labelledby={ids.previous} className="space-y-1">
              <p id={ids.previous} className="text-sm font-medium">¿Qué pasa con {fullName(owner)}?</p>
              {PREVIOUS.map(([value, title, text]) => (
                <label key={value} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-[var(--pg-hover)]">
                  <input type="radio" name={`previous-${school.id}`} value={value} checked={form.previous === value} onChange={() => setForm((c) => ({ ...c, previous: value }))} className="mt-1 h-4 w-4" />
                  <span className="text-sm"><b>{title}</b><span className="pg-fg2 block text-xs">{text}</span></span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="pg-btn" onClick={() => { setOpen(false); setForm(empty); }}>Cancelar</button>
            <button type="submit" className={primaryButton} disabled={!form.email.trim() || change.isPending}>{change.isPending ? 'Cambiando…' : 'Cambiar responsable'}</button>
          </div>
        </form>
      )}
    </div>
  );
};
