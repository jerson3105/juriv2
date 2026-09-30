import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { classroomApi } from '../../lib/classroomApi';
import type { GradeScaleType } from '../../lib/gradeApi';
import { inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { card, errorMessage, SCALE_LABEL } from './gradebookHelpers';

const SETUP_SCALES: Exclude<GradeScaleType, 'CUSTOM'>[] = ['PERU_LETTERS', 'PERU_VIGESIMAL', 'CENTESIMAL', 'USA_LETTERS'];

// Primer uso: elegir área curricular y escala. Activa las competencias y trae las del área.
export const GradebookSetup = ({ classroomId, enabled, onDone }: { classroomId: string; enabled: boolean; onDone: () => void }) => {
  const queryClient = useQueryClient();
  const { data: areas = [], isLoading } = useQuery({ queryKey: ['curriculum-areas'], queryFn: () => classroomApi.getCurriculumAreas('PE') });
  const [areaId, setAreaId] = useState('');
  const [scale, setScale] = useState<Exclude<GradeScaleType, 'CUSTOM'>>('PERU_LETTERS');
  const [saving, setSaving] = useState(false);
  const area = areas.find((a) => a.id === areaId);

  const save = async () => {
    if (!areaId || saving) return;
    setSaving(true);
    try {
      await classroomApi.update(classroomId, { useCompetencies: true, curriculumAreaId: areaId, gradeScaleType: scale });
      await classroomApi.syncCompetencies(classroomId);
      await queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
      toast.success('Listo: ya puedes poner notas');
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar la configuración'));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
          <BookOpenCheck size={22} aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Calificaciones</h1>
          <p className="text-sm text-gray-700 dark:text-gray-300">{enabled ? 'Dos datos y empiezas.' : 'Activa las calificaciones por competencias para esta clase.'}</p>
        </div>
      </div>
      <section aria-labelledby="setup-title" className={`${card} space-y-4`}>
        <h2 id="setup-title" className="text-base font-bold text-gray-900 dark:text-white">¿Qué área enseñas y cómo calificas?</h2>
        <div>
          <label htmlFor="setup-area" className={labelClass}>Área curricular</label>
          <select id="setup-area" value={areaId} onChange={(e) => setAreaId(e.target.value)} disabled={isLoading} className={`${inputClass} mt-1`}>
            <option value="">Elige un área</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.competencies.length} {a.competencies.length === 1 ? 'competencia' : 'competencias'})</option>
            ))}
          </select>
          {area && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-gray-800 dark:text-gray-100">
              {area.competencies.map((c) => <li key={c.id}>{c.name}</li>)}
            </ul>
          )}
        </div>
        <fieldset>
          <legend className={labelClass}>Escala de notas</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {SETUP_SCALES.map((s) => (
              <label key={s} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border-2 p-3 text-sm font-semibold ${scale === s ? 'border-primary-600 bg-primary-50 text-primary-900 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-100' : 'border-gray-200 text-gray-900 dark:border-gray-700 dark:text-white'}`}>
                <input type="radio" name="setup-scale" checked={scale === s} onChange={() => setScale(s)} className="accent-primary-600" />
                {SCALE_LABEL[s]}
              </label>
            ))}
          </div>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Podrás cambiarla o crear una personalizada en la pestaña Competencias.</p>
        </fieldset>
        <button type="button" onClick={save} disabled={!areaId || saving} className={primaryButton}>
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Empezar
        </button>
      </section>
    </div>
  );
};
