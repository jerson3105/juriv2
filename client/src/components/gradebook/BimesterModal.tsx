import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, Loader2, Lock, LockOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { gradeApi, type BimesterInfo } from '../../lib/gradeApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, inputClass, primaryButton } from '../home/homeHelpers';
import { errorMessage, fromDateInput, secondaryButton, toDateInput } from './gradebookHelpers';

interface BimesterModalProps {
  classroomId: string;
  onClose: () => void;
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : null);

// Bimestres: fechas (la evidencia de cada bimestre se toma de ese rango), cerrar y reabrir.
export const BimesterModal = ({ classroomId, onClose }: BimesterModalProps) => {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const { data: status, isLoading } = useQuery({
    queryKey: ['bimester-status', classroomId, year],
    queryFn: () => gradeApi.getBimesterStatus(classroomId, year),
  });
  const [editing, setEditing] = useState<{ period: string; start: string; end: string } | null>(null);
  const [confirmClose, setConfirmClose] = useState<BimesterInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['bimester-status', classroomId] }),
    queryClient.invalidateQueries({ queryKey: ['classroom-grades', classroomId] }),
    queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] }),
  ]);
  const run = async (key: string, action: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await action();
      await refresh();
      toast.success(done);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo completar'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (confirmClose) {
    return (
      <HomeModal title={`¿Cerrar el ${confirmClose.label}?`} onClose={() => setConfirmClose(null)}
        footer={<>
          <button type="button" onClick={() => setConfirmClose(null)} className={cancelButton}>Cancelar</button>
          <button type="button" className={primaryButton} disabled={busy !== null}
            onClick={async () => { if (await run('close', () => gradeApi.closeBimester(classroomId, confirmClose.period), `${confirmClose.label} cerrado`)) setConfirmClose(null); }}>
            {busy === 'close' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />} Cerrar bimestre
          </button>
        </>}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-100">
          <li>Las notas se actualizan por última vez con toda la evidencia y quedan congeladas.</li>
          <li>Sus fechas quedan fijas{confirmClose.datesConfigured ? '' : ' (hasta hoy)'}: la evidencia nueva va al bimestre siguiente.</li>
          <li>Podrás seguir escribiendo conclusiones y comentarios, y exportar.</li>
          <li>Si necesitas corregir algo, puedes reabrirlo.</li>
        </ul>
      </HomeModal>
    );
  }

  return (
    <HomeModal title="Bimestres" subtitle="Fechas, cierre y reapertura" size="lg" onClose={onClose}>
      {status && status.availableYears.length > 1 && (
        <div>
          <label htmlFor="bim-year" className="text-sm font-semibold text-gray-800 dark:text-gray-100">Año</label>
          <select id="bim-year" value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${inputClass} mt-1 w-32`}>
            {status.availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}
      {isLoading || !status ? (
        <Loader2 className="h-6 w-6 animate-spin text-primary-700" aria-label="Cargando bimestres" />
      ) : (
        <ul className="space-y-3">
          {status.allBimesters.map((b) => {
            const isEditing = editing?.period === b.period;
            return (
              <li key={b.period} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-gray-900 dark:text-white">{b.label}</span>
                  {b.isCurrent && <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-900 dark:bg-primary-900/50 dark:text-primary-100">En curso</span>}
                  {b.isClosed && <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-900 dark:bg-gray-700 dark:text-gray-100"><Lock size={12} aria-hidden="true" /> Cerrado</span>}
                  {b.isFuture && !b.isClosed && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-800 dark:bg-gray-700 dark:text-gray-100">Próximo</span>}
                </div>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {b.start ? `Del ${fmt(b.start)} ${b.end ? `al ${fmt(new Date(new Date(b.end).getTime() - 1).toISOString())}` : 'hasta hoy'}` : 'Sin fechas todavía'}
                  {!b.datesConfigured && b.start && !b.isClosed ? ' (hasta que lo cierres)' : ''}
                </p>
                {isEditing && editing ? (
                  <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={async (e) => {
                    e.preventDefault();
                    const end = new Date(fromDateInput(editing.end));
                    end.setDate(end.getDate() + 1); // el último día se incluye completo
                    if (await run(`d-${b.period}`, () => gradeApi.setBimesterDates(classroomId, b.period, fromDateInput(editing.start), end.toISOString()), 'Fechas guardadas')) setEditing(null);
                  }}>
                    <div>
                      <label htmlFor={`start-${b.period}`} className="text-sm font-semibold text-gray-800 dark:text-gray-100">Inicio</label>
                      <input id={`start-${b.period}`} type="date" required value={editing.start} onChange={(e) => setEditing({ ...editing, start: e.target.value })} className={`${inputClass} mt-1`} />
                    </div>
                    <div>
                      <label htmlFor={`end-${b.period}`} className="text-sm font-semibold text-gray-800 dark:text-gray-100">Último día</label>
                      <input id={`end-${b.period}`} type="date" required min={editing.start} value={editing.end} onChange={(e) => setEditing({ ...editing, end: e.target.value })} className={`${inputClass} mt-1`} />
                    </div>
                    <button type="submit" className={primaryButton} disabled={!editing.start || !editing.end || editing.end < editing.start || busy !== null}>Guardar fechas</button>
                    <button type="button" className={cancelButton} onClick={() => setEditing(null)}>Cancelar</button>
                  </form>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!b.isClosed && (
                      <button type="button" className={secondaryButton} onClick={() => setEditing({
                        period: b.period,
                        start: toDateInput(b.start) || toDateInput(new Date().toISOString()),
                        end: b.end ? toDateInput(new Date(new Date(b.end).getTime() - 1).toISOString()) : '',
                      })}>
                        <CalendarRange size={16} aria-hidden="true" /> {b.datesConfigured ? 'Cambiar fechas' : 'Poner fechas'}
                      </button>
                    )}
                    {!b.isClosed && !b.isFuture && (
                      <button type="button" className={secondaryButton} onClick={() => setConfirmClose(b)}>
                        <Lock size={16} aria-hidden="true" /> Cerrar
                      </button>
                    )}
                    {b.isClosed && (
                      <button type="button" className={secondaryButton} disabled={busy !== null}
                        onClick={() => run(`o-${b.period}`, () => gradeApi.reopenBimester(classroomId, b.period), `${b.label} reabierto`)}>
                        <LockOpen size={16} aria-hidden="true" /> Reabrir
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </HomeModal>
  );
};
