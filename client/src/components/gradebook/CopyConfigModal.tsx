import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { classroomApi } from '../../lib/classroomApi';
import { gradeApi, type CopyConfigResult } from '../../lib/gradeApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, labelClass, primaryButton } from '../home/homeHelpers';
import { errorMessage } from './gradebookHelpers';

// Copiar competencias, destrezas, escala y fechas a otras clases del docente (nunca notas).
export const CopyConfigModal = ({ classroomId, onClose }: { classroomId: string; onClose: () => void }) => {
  const { data: classrooms = [], isLoading } = useQuery({ queryKey: ['classrooms'], queryFn: classroomApi.getMyClassrooms });
  const others = classrooms.filter((c) => c.id !== classroomId);
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [scale, setScale] = useState(true);
  const [dates, setDates] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CopyConfigResult | null>(null);

  const toggle = (id: string) => setTargets((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const copy = async () => {
    setBusy(true);
    try {
      setResult(await gradeApi.copyConfig(classroomId, { targetClassroomIds: [...targets], scale, dates }));
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo copiar la configuración'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <HomeModal
      title="Copiar configuración a otras clases"
      subtitle="Competencias, destrezas y, si quieres, la escala y las fechas. Las notas no se copian."
      size="lg"
      onClose={onClose}
      footer={result ? <button type="button" onClick={onClose} className={primaryButton}>Listo</button> : <>
        <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
        <button type="button" onClick={copy} disabled={targets.size === 0 || busy} className={primaryButton}>
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Copiar a {targets.size} {targets.size === 1 ? 'clase' : 'clases'}
        </button>
      </>}
    >
      {result ? (
        <ul className="space-y-2">
          {result.targets.map((t) => (
            <li key={t.classroomId} className="flex items-start gap-2 text-sm">
              {t.ok
                ? <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                : <XCircle size={18} className="mt-0.5 flex-shrink-0 text-red-700 dark:text-red-300" aria-hidden="true" />}
              <span>
                <span className="font-semibold text-gray-900 dark:text-white">{t.classroomName}</span>
                <span className="block text-gray-700 dark:text-gray-300">
                  {t.ok ? `${t.addedCompetencies + t.createdCustomCompetencies} competencias nuevas · ${t.createdIndicators} destrezas nuevas` : t.message}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-primary-700" aria-label="Cargando clases" />
      ) : others.length === 0 ? (
        <p className="text-sm text-gray-800 dark:text-gray-100">No tienes otras clases activas.</p>
      ) : (
        <>
          <fieldset>
            <legend className={labelClass}>Clases destino</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {others.map((c) => (
                <label key={c.id} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border-2 p-3 ${targets.has(c.id) ? 'border-primary-600 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700'}`}>
                  <input type="checkbox" checked={targets.has(c.id)} onChange={() => toggle(c.id)} className="h-5 w-5 accent-primary-600" />
                  <span>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">{c.name}</span>
                    {(!c.useCompetencies || !c.curriculumAreaId) && <span className="block text-sm text-gray-700 dark:text-gray-300">Aún sin área curricular</span>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className={labelClass}>También copiar</legend>
            <label className="flex min-h-[44px] items-center gap-3 text-sm text-gray-900 dark:text-white">
              <input type="checkbox" checked={scale} onChange={(e) => setScale(e.target.checked)} className="h-5 w-5 accent-primary-600" />
              Escala de notas y peso de las evaluaciones
            </label>
            <label className="flex min-h-[44px] items-center gap-3 text-sm text-gray-900 dark:text-white">
              <input type="checkbox" checked={dates} onChange={(e) => setDates(e.target.checked)} className="h-5 w-5 accent-primary-600" />
              Fechas de los bimestres (solo los que no estén cerrados allá)
            </label>
          </fieldset>
        </>
      )}
    </HomeModal>
  );
};
