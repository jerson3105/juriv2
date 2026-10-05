import { useEffect, useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Copy, X } from 'lucide-react';
import { schoolApi, type AdminSchoolCreated, type AdminSchoolInput } from '../../lib/schoolApi';
import { adminOverviewKey } from '../../lib/adminApi';
import { errorMessage } from '../auth/authHelpers';
import { primaryButton } from './adminStyles';
import { schoolFormStyles } from './schoolFormStyles';

const { input, label, hint } = schoolFormStyles;

/**
 * Crear un colegio desde el panel: queda verificado, con su responsable (si su correo ya es de un docente, se suma; si
 * no, su cuenta nace con una clave temporal que se ve una sola vez) y, si lo tiene, el dominio de su correo
 * institucional ligado al colegio (con él su administración crea las cuentas de sus docentes).
 */
export const CreateSchoolDialog = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient();
  const ids = { title: useId(), scope: useId() };
  const [form, setForm] = useState({
    name: '', modularCode: '', region: '', city: '', address: '',
    ownerEmail: '', ownerFirstNames: '', ownerLastNames: '',
    domain: '', scope: 'TEACHERS_ONLY' as 'TEACHERS_ONLY' | 'SHARED',
  });
  const [result, setResult] = useState<AdminSchoolCreated | null>(null);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const create = useMutation({
    mutationFn: () => {
      const body: AdminSchoolInput = {
        name: form.name.trim(),
        modularCode: form.modularCode.trim() || null,
        region: form.region.trim() || null,
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        owner: {
          email: form.ownerEmail.trim(),
          ...(form.ownerFirstNames.trim() ? { firstNames: form.ownerFirstNames.trim() } : {}),
          ...(form.ownerLastNames.trim() ? { lastNames: form.ownerLastNames.trim() } : {}),
        },
        domain: form.domain.trim() ? { domain: form.domain.trim(), scope: form.scope } : null,
      };
      return schoolApi.adminCreateSchool(body);
    },
    onSuccess: (data) => {
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: ['admin-schools'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-verified-domains'] });
      void queryClient.invalidateQueries({ queryKey: adminOverviewKey });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo crear el colegio')),
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

  return (
    <div data-pg="" className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={ids.title} className="pg-surface flex max-h-[90vh] w-full max-w-2xl flex-col shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--pg-line)] px-5 py-4">
          <div>
            <h2 id={ids.title} className="text-lg font-bold">{result ? 'Colegio creado' : 'Crear un colegio'}</h2>
            <p className="pg-fg2 text-sm">{result ? result.name : 'Queda verificado, con su responsable y el dominio de su correo institucional.'}</p>
          </div>
          <button type="button" onClick={onClose} className="pg-icon-btn" aria-label="Cerrar"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>

        {result ? (
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            {result.owner.created && result.owner.temporaryPassword ? (
              <div className="space-y-2">
                <p className="text-sm">Creamos la cuenta del responsable (<b>{result.owner.email}</b>). Su clave temporal:</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-lg bg-[var(--pg-hover)] px-3 py-2 font-mono text-lg tracking-wider">{result.owner.temporaryPassword}</code>
                  <button type="button" className="pg-btn" onClick={() => void copy(result.owner.temporaryPassword!)}><Copy className="h-4 w-4" aria-hidden="true" />Copiar</button>
                </div>
                <p className="text-sm"><b>Se muestra una sola vez.</b> Entrégasela en persona: entra con su correo y esta clave y la cambia en Configuración.</p>
              </div>
            ) : (
              <p className="text-sm"><b>{result.owner.email}</b> ya tenía cuenta de docente: ahora es el responsable del colegio (y su cuenta quedó verificada).</p>
            )}
            {result.domain && (
              <p className="text-sm">
                Dominio <b>@{result.domain.domain}</b> ligado al colegio: con él su administración crea las cuentas de sus docentes.
                {result.domain.verified > 0 && ` ${result.domain.verified === 1 ? 'Un docente que esperaba quedó verificado' : `${result.domain.verified} docentes que esperaban quedaron verificados`}.`}
              </p>
            )}
            {result.domainError && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-100" role="status">
                El dominio no se agregó: {result.domainError}. Agrégalo desde «Docentes por verificar» → Dominios, eligiendo este colegio.
              </p>
            )}
            <div className="flex justify-end">
              <button type="button" className={primaryButton} onClick={onClose}>Listo</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <fieldset className="space-y-3">
                <legend className="text-sm font-bold">El colegio</legend>
                <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
                  <label className={label}>
                    Nombre
                    <input className={input} value={form.name} onChange={set('name')} maxLength={255} required autoComplete="off" autoFocus />
                  </label>
                  <label className={label}>
                    Código modular <span className="pg-fg2 font-normal">(opcional)</span>
                    <input className={input} value={form.modularCode} onChange={set('modularCode')} maxLength={10} inputMode="numeric" placeholder="7 números" autoComplete="off" />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>
                    Región
                    <input className={input} value={form.region} onChange={set('region')} maxLength={100} placeholder="Ej.: Puno" autoComplete="off" />
                  </label>
                  <label className={label}>
                    Ciudad o distrito
                    <input className={input} value={form.city} onChange={set('city')} maxLength={100} placeholder="Ej.: Juliaca" autoComplete="off" />
                  </label>
                </div>
                <label className={label}>
                  Dirección <span className="pg-fg2 font-normal">(opcional)</span>
                  <input className={input} value={form.address} onChange={set('address')} maxLength={300} autoComplete="off" />
                </label>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-bold">Responsable</legend>
                <label className={label}>
                  Correo
                  <input type="email" className={input} value={form.ownerEmail} onChange={set('ownerEmail')} maxLength={255} required autoComplete="off" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>
                    Nombres
                    <input className={input} value={form.ownerFirstNames} onChange={set('ownerFirstNames')} maxLength={100} autoComplete="off" />
                  </label>
                  <label className={label}>
                    Apellidos
                    <input className={input} value={form.ownerLastNames} onChange={set('ownerLastNames')} maxLength={100} autoComplete="off" />
                  </label>
                </div>
                <p className={hint}>Si su correo ya es de una cuenta de docente, se suma como responsable (los nombres no hacen falta). Si no, creamos su cuenta con una clave temporal.</p>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-bold">Correo institucional <span className="pg-fg2 font-normal">(opcional)</span></legend>
                <label className={label}>
                  Dominio
                  <input className={input} value={form.domain} onChange={set('domain')} maxLength={255} placeholder="colegio.edu.pe" autoComplete="off" />
                </label>
                {form.domain.trim() && (
                  <div role="radiogroup" aria-labelledby={ids.scope} className="space-y-1">
                    <p id={ids.scope} className="text-sm font-medium">¿Quiénes usan ese dominio?</p>
                    {([
                      ['TEACHERS_ONLY', 'Solo los docentes', 'Quien entra con Google con ese correo queda verificado como docente.'],
                      ['SHARED', 'Docentes y estudiantes', 'No verifica a nadie por sí solo (un estudiante no puede pasar por docente).'],
                    ] as const).map(([value, title, text]) => (
                      <label key={value} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-[var(--pg-hover)]">
                        <input type="radio" name="scope" value={value} checked={form.scope === value} onChange={() => setForm((f) => ({ ...f, scope: value }))} className="mt-1 h-4 w-4" />
                        <span className="text-sm"><b>{title}</b><span className="pg-fg2 block text-xs">{text}</span></span>
                      </label>
                    ))}
                  </div>
                )}
                <p className={hint}>Con el dominio, la administración del colegio crea las cuentas de sus docentes desde su consola.</p>
              </fieldset>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--pg-line)] px-5 py-3">
              <button type="button" className="pg-btn" onClick={onClose}>Cancelar</button>
              <button type="submit" className={primaryButton} disabled={create.isPending || !form.name.trim() || !form.ownerEmail.trim()}>
                {create.isPending ? 'Creando…' : 'Crear colegio'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
