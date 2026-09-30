import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Lock, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { gradeApi, type ClassroomGradebookResponse, type GradebookCompetencyColumn, type StudentGrade } from '../../lib/gradeApi';
import { inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import {
  BUCKET_LABEL, BUCKET_STYLE, competencyTitle, errorMessage, hasGrade, percentToLabel, periodLabel, secondaryButton, SOURCE_LABEL,
} from './gradebookHelpers';
import { ScaleValuePicker } from './ScaleValuePicker';
import { SidePanel } from './SidePanel';

interface GradeDetailPanelProps {
  book: ClassroomGradebookResponse;
  studentName: string;
  competency: GradebookCompetencyColumn;
  grade: StudentGrade;
  onClose: () => void;
}

// Detalle de una nota: cambiarla con la escala, volver a la calculada, comentarios y de dónde sale.
export const GradeDetailPanel = ({ book, studentName, competency, grade, onClose }: GradeDetailPanelProps) => {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<string | null>(grade.isManualOverride ? grade.gradeLabel : null);
  const [notes, setNotes] = useState({ manualNote: grade.manualNote ?? '', privateNote: grade.privateNote ?? '', conclusion: grade.conclusion ?? '' });
  const [busy, setBusy] = useState<null | 'grade' | 'clear' | 'notes'>(null);
  useEffect(() => {
    setNotes({ manualNote: grade.manualNote ?? '', privateNote: grade.privateNote ?? '', conclusion: grade.conclusion ?? '' });
  }, [grade.manualNote, grade.privateNote, grade.conclusion]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['classroom-grades', book.classroomId] });
  const run = async (kind: 'grade' | 'clear' | 'notes', action: () => Promise<unknown>, done: string) => {
    setBusy(kind);
    try {
      await action();
      await refresh();
      toast.success(done);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar'));
    } finally {
      setBusy(null);
    }
  };

  const graded = hasGrade(grade);
  const details = grade.calculationDetails;
  const sources = details?.activities ?? [];
  const notesChanged = notes.manualNote !== (grade.manualNote ?? '') || notes.privateNote !== (grade.privateNote ?? '') || notes.conclusion !== (grade.conclusion ?? '');
  const labelOf = (percent: number) => percentToLabel(percent, book.scale, book.gradeScaleType);

  return (
    <SidePanel
      title={studentName}
      subtitle={`${competency.code} · ${competencyTitle(competency)} · ${periodLabel(book.period)}`}
      onClose={onClose}
    >
      {/* Nota actual */}
      <section aria-labelledby="grade-now" className="flex items-center gap-4">
        <span className={`flex h-16 min-w-[4rem] items-center justify-center rounded-2xl px-3 text-3xl font-black ${graded ? BUCKET_STYLE[grade.bucket] : 'border-2 border-dashed border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300'}`}>
          {graded ? grade.gradeLabel : '—'}
        </span>
        <div className="min-w-0">
          <h3 id="grade-now" className="text-base font-bold text-gray-900 dark:text-white">
            {graded ? BUCKET_LABEL[grade.bucket] : 'Sin nota todavía'}
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {grade.isManualOverride
              ? `Ajustada a mano${grade.calculatedLabel && grade.activitiesCount > 0 ? ` · la calculada es ${grade.calculatedLabel}` : ''}`
              : graded ? 'Calculada con la evidencia del bimestre' : 'Aún no hay evidencias ni evaluaciones. Puedes ponerla tú.'}
          </p>
        </div>
      </section>

      {grade.calculatedChanged && !book.isClosed && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-900/30 dark:text-amber-100">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>Desde tu ajuste llegó nueva evidencia: la nota calculada ahora es <strong>{grade.calculatedLabel}</strong>. Puedes mantener tu nota o volver a la calculada.</span>
        </div>
      )}

      {/* Cambiar la nota */}
      {book.isClosed ? (
        <p className="flex items-center gap-2 rounded-xl bg-gray-100 p-3 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-100">
          <Lock size={16} aria-hidden="true" /> El bimestre está cerrado: la nota no se puede cambiar. Los comentarios y la conclusión sí.
        </p>
      ) : (
        <section aria-labelledby="grade-edit" className="space-y-3">
          <h3 id="grade-edit" className={labelClass}>Poner la nota</h3>
          <ScaleValuePicker scale={book.scale} scaleType={book.gradeScaleType} value={value} onChange={(v) => setValue(v || null)} label="Nota del alumno" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryButton} disabled={!value || busy !== null || (grade.isManualOverride && value === grade.gradeLabel)}
              onClick={() => value && run('grade', () => gradeApi.setManualGrade(grade.id, value), `Nota ${value} guardada`)}>
              {busy === 'grade' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Guardar nota
            </button>
            {grade.isManualOverride && (
              <button type="button" className={secondaryButton} disabled={busy !== null}
                onClick={() => run('clear', async () => { await gradeApi.clearManualGrade(grade.id); setValue(null); }, 'Volvió a la nota calculada')}>
                {busy === 'clear' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />} Volver a la calculada
              </button>
            )}
          </div>
        </section>
      )}

      {/* Comentarios */}
      <section aria-labelledby="grade-notes" className="space-y-3">
        <h3 id="grade-notes" className="sr-only">Comentarios</h3>
        <div>
          <label htmlFor="note-student" className={labelClass}>Comentario para el alumno</label>
          <p className="text-sm text-gray-700 dark:text-gray-300">Lo verá el alumno (y su familia) junto a la nota.</p>
          <textarea id="note-student" rows={2} maxLength={1000} value={notes.manualNote} onChange={(e) => setNotes((n) => ({ ...n, manualNote: e.target.value }))} className={`${inputClass} mt-1`} />
        </div>
        <div>
          <label htmlFor="note-private" className={labelClass}>Nota privada</label>
          <p className="text-sm text-gray-700 dark:text-gray-300">Solo la ves tú.</p>
          <textarea id="note-private" rows={2} maxLength={1000} value={notes.privateNote} onChange={(e) => setNotes((n) => ({ ...n, privateNote: e.target.value }))} className={`${inputClass} mt-1`} />
        </div>
        <div>
          <label htmlFor="note-conclusion" className={labelClass}>Conclusión descriptiva</label>
          <p className="text-sm text-gray-700 dark:text-gray-300">Va en la libreta y en el Excel SIAGIE.</p>
          <textarea id="note-conclusion" rows={3} maxLength={2000} value={notes.conclusion} onChange={(e) => setNotes((n) => ({ ...n, conclusion: e.target.value }))} className={`${inputClass} mt-1`} />
        </div>
        <button type="button" className={secondaryButton} disabled={!notesChanged || busy !== null}
          onClick={() => run('notes', () => gradeApi.updateGradeNotes(grade.id, {
            manualNote: notes.manualNote || null, privateNote: notes.privateNote || null, conclusion: notes.conclusion || null,
          }), 'Comentarios guardados')}>
          {busy === 'notes' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Guardar comentarios
        </button>
      </section>

      {/* De dónde sale */}
      <section aria-labelledby="grade-sources" className="space-y-2">
        <h3 id="grade-sources" className="text-base font-bold text-gray-900 dark:text-white">¿De dónde sale esta nota?</h3>
        {sources.length === 0 ? (
          <p className="text-sm text-gray-700 dark:text-gray-300">Todavía no hay evaluaciones ni evidencias de esta competencia en el bimestre.</p>
        ) : (
          <>
            {details?.evaluationScore != null && details?.evidenceScore != null && (
              <p className="text-sm text-gray-800 dark:text-gray-100">
                Evaluaciones <strong>{labelOf(details.evaluationScore)}</strong> ({details.evaluationWeight} %) y evidencia de clase <strong>{labelOf(details.evidenceScore)}</strong> ({100 - (details.evaluationWeight ?? 100)} %).
              </p>
            )}
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
              {sources.map((source) => (
                <li key={`${source.type}-${source.id}`} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">{SOURCE_LABEL[source.type] ?? 'Evidencia'}</span>
                    <span className="block text-sm text-gray-700 dark:text-gray-300">{source.name}</span>
                  </span>
                  <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{labelOf(source.score)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {grade.indicatorBreakdownStatus === 'AVAILABLE' && grade.indicatorBreakdown.length > 0 && (
          <>
            <h4 className="pt-2 text-sm font-bold text-gray-900 dark:text-white">Por destreza</h4>
            <ul className="space-y-1.5">
              {grade.indicatorBreakdown.map((skill) => (
                <li key={skill.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-900 dark:text-white">{skill.name}</span>
                  {skill.hasEvidence && skill.bucket && skill.gradeLabel ? (
                    <span className={`rounded-lg px-2 py-0.5 font-bold ${BUCKET_STYLE[skill.bucket]}`}>{skill.gradeLabel}</span>
                  ) : (
                    <span className="text-gray-700 dark:text-gray-300">Sin evidencia</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </SidePanel>
  );
};
