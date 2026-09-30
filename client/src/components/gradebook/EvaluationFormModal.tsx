import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { classroomApi } from '../../lib/classroomApi';
import { EVALUATION_KINDS, gradeApi, type EvaluationKind, type GradeEvaluationDetail, type GradebookCompetencyColumn } from '../../lib/gradeApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { competencyTitle, errorMessage, KIND_LABEL, toDateInput } from './gradebookHelpers';

interface EvaluationFormModalProps {
  classroomId: string;
  period: string;
  competencies: GradebookCompetencyColumn[];
  evaluation?: GradeEvaluationDetail | null;
  defaultCompetencyId?: string;
  onClose: () => void;
  onSaved: (evaluation: GradeEvaluationDetail) => void;
}

const WEIGHTS = [
  { value: 1, label: 'Normal' },
  { value: 2, label: 'Doble' },
  { value: 3, label: 'Triple' },
];

// Crear o editar una evaluación (examen, tarea…): a qué competencia y destreza aporta y cuánto pesa.
export const EvaluationFormModal = ({ classroomId, period, competencies, evaluation, defaultCompetencyId, onClose, onSaved }: EvaluationFormModalProps) => {
  const [form, setForm] = useState({
    title: evaluation?.title ?? '',
    kind: (evaluation?.kind ?? 'EXAM') as EvaluationKind,
    competencyId: evaluation?.competencyId ?? defaultCompetencyId ?? competencies[0]?.id ?? '',
    indicatorId: evaluation?.indicatorId ?? '',
    evaluatedOn: evaluation?.evaluatedOn ?? toDateInput(new Date().toISOString()),
    weight: evaluation?.weight ?? 1,
  });
  const [saving, setSaving] = useState(false);

  const { data: classroomCompetencies = [] } = useQuery({
    queryKey: ['classroom-competencies', classroomId],
    queryFn: () => classroomApi.getCompetencies(classroomId),
  });
  const indicators = classroomCompetencies.find((c) => c.id === form.competencyId)?.indicators ?? [];

  const save = async () => {
    if (!form.title.trim() || !form.competencyId || saving) return;
    setSaving(true);
    const data = {
      title: form.title.trim(),
      kind: form.kind,
      competencyId: form.competencyId,
      indicatorId: form.indicatorId || null,
      evaluatedOn: form.evaluatedOn || null,
      weight: form.weight,
    };
    try {
      const saved = evaluation
        ? await gradeApi.updateEvaluation(evaluation.id, data)
        : await gradeApi.createEvaluation(classroomId, { ...data, period });
      toast.success(evaluation ? 'Evaluación actualizada' : 'Evaluación creada: ya puedes poner las notas');
      onSaved(saved);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar la evaluación'));
      setSaving(false);
    }
  };

  return (
    <HomeModal
      title={evaluation ? 'Editar evaluación' : 'Nueva evaluación'}
      subtitle="Un examen, tarea o proyecto con nota para cada alumno."
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
        <button type="button" onClick={save} disabled={!form.title.trim() || !form.competencyId || saving} className={primaryButton}>
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} {evaluation ? 'Guardar' : 'Crear y poner notas'}
        </button>
      </>}
    >
      <div>
        <label htmlFor="eval-title" className={labelClass}>Nombre</label>
        <input id="eval-title" data-autofocus value={form.title} maxLength={150} placeholder="Ej.: Examen de la unidad 2"
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={`${inputClass} mt-1`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="eval-kind" className={labelClass}>Tipo</label>
          <select id="eval-kind" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as EvaluationKind }))} className={`${inputClass} mt-1`}>
            {EVALUATION_KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="eval-date" className={labelClass}>Fecha</label>
          <input id="eval-date" type="date" value={form.evaluatedOn} onChange={(e) => setForm((f) => ({ ...f, evaluatedOn: e.target.value }))} className={`${inputClass} mt-1`} />
        </div>
      </div>
      <div>
        <label htmlFor="eval-competency" className={labelClass}>Competencia que evalúa</label>
        <select id="eval-competency" value={form.competencyId} onChange={(e) => setForm((f) => ({ ...f, competencyId: e.target.value, indicatorId: '' }))} className={`${inputClass} mt-1`}>
          {competencies.map((c) => <option key={c.id} value={c.id}>{c.code} · {competencyTitle(c)}</option>)}
        </select>
      </div>
      {indicators.length > 0 && (
        <div>
          <label htmlFor="eval-indicator" className={labelClass}>Destreza (opcional)</label>
          <select id="eval-indicator" value={form.indicatorId} onChange={(e) => setForm((f) => ({ ...f, indicatorId: e.target.value }))} className={`${inputClass} mt-1`}>
            <option value="">Toda la competencia</option>
            {indicators.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
      )}
      <fieldset>
        <legend className={labelClass}>¿Cuánto pesa frente a las otras evaluaciones?</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {WEIGHTS.map((w) => (
            <label key={w.value} className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold ${form.weight === w.value ? 'border-primary-600 bg-primary-50 text-primary-900 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-100' : 'border-gray-200 text-gray-800 dark:border-gray-600 dark:text-gray-100'}`}>
              <input type="radio" name="eval-weight" value={w.value} checked={form.weight === w.value} onChange={() => setForm((f) => ({ ...f, weight: w.value }))} className="accent-primary-600" />
              {w.label}
            </label>
          ))}
        </div>
      </fieldset>
    </HomeModal>
  );
};
