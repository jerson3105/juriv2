import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, FileUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { gradeApi, type ClassroomGradebookResponse, type GradeEvaluationDetail } from '../../lib/gradeApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, inputClass, primaryButton } from '../home/homeHelpers';
import { EvaluationFormModal } from './EvaluationFormModal';
import { ImportScoresModal } from './ImportScoresModal';
import { ScaleValuePicker } from './ScaleValuePicker';
import {
  BUCKET_STYLE, bucketOfLabel, card, competencyTitle, errorMessage, evaluationKey, evaluationsKey, KIND_LABEL, percentToLabel, secondaryButton,
} from './gradebookHelpers';

interface EvaluationsTabProps {
  book: ClassroomGradebookResponse;
}

type Draft = Record<string, { value: string | null; note: string }>;

// Planilla de una evaluación: una fila por alumno con la escala de la clase.
const EvaluationSheet = ({ book, evaluationId, onBack }: { book: ClassroomGradebookResponse; evaluationId: string; onBack: () => void }) => {
  const queryClient = useQueryClient();
  const { data: evaluation, isLoading } = useQuery({ queryKey: evaluationKey(evaluationId), queryFn: () => gradeApi.getEvaluation(evaluationId) });
  const [draft, setDraft] = useState<Draft>({});
  const [showNotes, setShowNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<null | 'edit' | 'import' | 'delete'>(null);
  const [search, setSearch] = useState('');

  useEffect(() => { setDraft({}); }, [evaluation?.id]);

  const changed = useMemo(() => {
    if (!evaluation) return [];
    return evaluation.students.filter((s) => {
      const d = draft[s.studentProfileId];
      return d && ((d.value ?? null) !== (s.label ?? null) || d.note !== (s.note ?? ''));
    });
  }, [draft, evaluation]);

  if (isLoading || !evaluation) {
    return <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-primary-700" aria-label="Cargando evaluación" /></div>;
  }

  const readOnly = evaluation.isClosed;
  const valueOf = (id: string, fallback: string | null) => (draft[id] ? draft[id].value : fallback);
  const noteOf = (id: string, fallback: string | null) => (draft[id] ? draft[id].note : fallback ?? '');
  const setCell = (id: string, patch: Partial<{ value: string | null; note: string }>, current: { label: string | null; note: string | null }) =>
    setDraft((d) => ({ ...d, [id]: { value: d[id]?.value ?? current.label, note: d[id]?.note ?? current.note ?? '', ...patch } }));
  const term = search.trim().toLowerCase();
  const students = term ? evaluation.students.filter((s) => s.studentName.toLowerCase().includes(term)) : evaluation.students;
  const scored = evaluation.students.filter((s) => valueOf(s.studentProfileId, s.label)).length;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: evaluationKey(evaluationId) }),
      queryClient.invalidateQueries({ queryKey: ['grade-evaluations', book.classroomId] }),
      queryClient.invalidateQueries({ queryKey: ['classroom-grades', book.classroomId] }),
    ]);
  };

  const save = async () => {
    if (changed.length === 0 || saving) return;
    setSaving(true);
    try {
      await gradeApi.saveEvaluationScores(evaluation.id, changed.map((s) => ({
        studentProfileId: s.studentProfileId,
        value: draft[s.studentProfileId].value,
        note: draft[s.studentProfileId].note || null,
      })));
      setDraft({});
      await refresh();
      toast.success(`${changed.length} ${changed.length === 1 ? 'nota guardada' : 'notas guardadas'}; las notas de la competencia se actualizaron`);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron guardar las notas'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await gradeApi.deleteEvaluation(evaluation.id);
      await queryClient.invalidateQueries({ queryKey: ['grade-evaluations', book.classroomId] });
      await queryClient.invalidateQueries({ queryKey: ['classroom-grades', book.classroomId] });
      toast.success('Evaluación eliminada');
      onBack();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo eliminar'));
    }
  };

  const competency = book.competencies.find((c) => c.id === evaluation.competencyId);

  return (
    <section aria-labelledby="sheet-title" className="space-y-4">
      <div className={card}>
        <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700">
          <ArrowLeft size={16} aria-hidden="true" /> Evaluaciones
        </button>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="sheet-title" className="text-xl font-bold text-gray-900 dark:text-white">{evaluation.title}</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {KIND_LABEL[evaluation.kind]} · {competency ? `${competency.code} ${competencyTitle(competency)}` : evaluation.competencyName}
              {evaluation.evaluatedOn && ` · ${new Date(`${evaluation.evaluatedOn}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' })}`}
              {evaluation.weight > 1 && ` · pesa ×${evaluation.weight}`} · {scored} de {evaluation.students.length} con nota
            </p>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setModal('import')} className={secondaryButton}><FileUp size={16} aria-hidden="true" /> Importar</button>
              <button type="button" onClick={() => setModal('edit')} className={secondaryButton}><Pencil size={16} aria-hidden="true" /> Editar</button>
              <button type="button" onClick={() => setModal('delete')} aria-label="Eliminar evaluación" className="flex h-11 w-11 items-center justify-center rounded-xl text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30">
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="w-full sm:w-64">
            <label htmlFor="sheet-search" className="sr-only">Buscar alumno</label>
            <input id="sheet-search" type="search" placeholder="Buscar alumno" value={search} onChange={(e) => setSearch(e.target.value)} className={inputClass} />
          </div>
          <label className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <input type="checkbox" checked={showNotes} onChange={(e) => setShowNotes(e.target.checked)} className="h-5 w-5 accent-primary-600" />
            Comentarios por alumno
          </label>
        </div>
        {readOnly && <p className="mb-3 text-sm text-gray-800 dark:text-gray-100">El bimestre está cerrado: esta evaluación es de solo lectura.</p>}
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {students.map((student) => {
            const value = valueOf(student.studentProfileId, student.label);
            const dirty = changed.some((c) => c.studentProfileId === student.studentProfileId);
            return (
              <li key={student.studentProfileId} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-[10rem] flex-1">
                  <span className="block font-semibold text-gray-900 dark:text-white">{student.studentName}</span>
                  {dirty && <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">Sin guardar</span>}
                </span>
                {readOnly ? (
                  value
                    ? <span className={`rounded-xl px-3 py-1.5 text-base font-black ${BUCKET_STYLE[bucketOfLabel(value, book.scale, book.gradeScaleType)]}`}>{value}</span>
                    : <span className="text-sm text-gray-700 dark:text-gray-300">Sin nota</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <ScaleValuePicker scale={book.scale} scaleType={book.gradeScaleType} value={value} size="sm"
                      label={`Nota de ${student.studentName}`}
                      onChange={(v) => setCell(student.studentProfileId, { value: v || null }, student)} />
                    {value && (
                      <button type="button" onClick={() => setCell(student.studentProfileId, { value: null }, student)}
                        className="min-h-[40px] rounded-xl px-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                        aria-label={`Quitar la nota de ${student.studentName}`}>
                        Quitar
                      </button>
                    )}
                  </div>
                )}
                {showNotes && (
                  <div className="w-full">
                    <label htmlFor={`note-${student.studentProfileId}`} className="sr-only">Comentario para {student.studentName}</label>
                    <input id={`note-${student.studentProfileId}`} value={noteOf(student.studentProfileId, student.note)} maxLength={500} disabled={readOnly}
                      placeholder="Comentario (opcional)" onChange={(e) => setCell(student.studentProfileId, { note: e.target.value }, student)} className={inputClass} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {!readOnly && changed.length > 0 && (
        <div className="sticky bottom-3 z-10 flex justify-end">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/95 p-2 pl-4 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
            <span className="text-sm text-gray-800 dark:text-gray-100">{changed.length} {changed.length === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}</span>
            <button type="button" onClick={save} disabled={changed.length === 0 || saving} className={primaryButton}>
              {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Guardar notas
            </button>
          </div>
        </div>
      )}

      {modal === 'edit' && (
        <EvaluationFormModal classroomId={book.classroomId} period={book.period} competencies={book.competencies} evaluation={evaluation}
          onClose={() => setModal(null)} onSaved={async () => { setModal(null); await refresh(); }} />
      )}
      {modal === 'import' && (
        <ImportScoresModal evaluation={evaluation} onClose={() => setModal(null)} onImported={async () => { setModal(null); setDraft({}); await refresh(); }} />
      )}
      {modal === 'delete' && (
        <HomeModal title="¿Eliminar la evaluación?" subtitle={evaluation.title} onClose={() => setModal(null)}
          footer={<>
            <button type="button" onClick={() => setModal(null)} className={cancelButton}>Cancelar</button>
            <button type="button" onClick={remove} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800">
              <Trash2 size={16} aria-hidden="true" /> Eliminar
            </button>
          </>}>
          <p className="text-sm text-gray-800 dark:text-gray-100">Se borran sus {scored} notas y la nota de la competencia se vuelve a calcular sin ella.</p>
        </HomeModal>
      )}
    </section>
  );
};

export const EvaluationsTab = ({ book }: EvaluationsTabProps) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: evaluationsKey(book.classroomId, book.period),
    queryFn: () => gradeApi.listEvaluations(book.classroomId, book.period),
  });

  if (openId) return <EvaluationSheet book={book} evaluationId={openId} onBack={() => setOpenId(null)} />;

  const evaluations = data?.evaluations ?? [];
  const total = book.students.length;

  return (
    <section aria-labelledby="evals-title" className={card}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="evals-title" className="text-base font-bold text-gray-900 dark:text-white">Evaluaciones del bimestre</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Exámenes, tareas y proyectos con nota directa. Cuentan {book.evaluationWeight === 100 ? 'por completo' : `un ${book.evaluationWeight} %`} en la nota de su competencia{book.evaluationWeight < 100 ? '; el resto sale de la evidencia de clase' : ''}.
          </p>
        </div>
        {!book.isClosed && (
          <button type="button" onClick={() => setCreating(true)} className={primaryButton}><Plus size={16} aria-hidden="true" /> Nueva evaluación</button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary-700" aria-label="Cargando evaluaciones" /></div>
      ) : evaluations.length === 0 ? (
        <div className="py-8 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-gray-600 dark:text-gray-300" aria-hidden="true" />
          <p className="mt-2 text-sm text-gray-800 dark:text-gray-100">Aún no hay evaluaciones en este bimestre.</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">Crea una para poner notas de un examen o tarea, o impórtalas desde Excel.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {evaluations.map((evaluation) => {
            const competency = book.competencies.find((c) => c.id === evaluation.competencyId);
            const avg = evaluation.average === null ? null : percentToLabel(evaluation.average, book.scale, book.gradeScaleType);
            return (
              <li key={evaluation.id}>
                <button type="button" onClick={() => setOpenId(evaluation.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-gray-900 dark:text-white">{evaluation.title}</span>
                    <span className="block text-sm text-gray-700 dark:text-gray-300">
                      {KIND_LABEL[evaluation.kind]} · {competency ? `${competency.code} ${competencyTitle(competency)}` : evaluation.competencyShortName ?? evaluation.competencyName}
                      {evaluation.indicatorName && ` · ${evaluation.indicatorName}`}
                      {evaluation.evaluatedOn && ` · ${new Date(`${evaluation.evaluatedOn}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' })}`}
                    </span>
                  </span>
                  <span className="text-right text-sm">
                    <span className="block font-semibold text-gray-900 dark:text-white">{evaluation.scored}/{total}</span>
                    <span className="block text-gray-700 dark:text-gray-300">con nota</span>
                  </span>
                  {avg && <span className={`rounded-xl px-2.5 py-1 text-sm font-black ${BUCKET_STYLE[bucketOfLabel(avg, book.scale, book.gradeScaleType)]}`} aria-label={`Promedio ${avg}`}>{avg}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <EvaluationFormModal classroomId={book.classroomId} period={book.period} competencies={book.competencies}
          onClose={() => setCreating(false)} onSaved={(saved: GradeEvaluationDetail) => { setCreating(false); setOpenId(saved.id); }} />
      )}
    </section>
  );
};
