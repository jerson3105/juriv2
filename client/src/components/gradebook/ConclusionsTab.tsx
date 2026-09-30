import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { gradeApi, type ClassroomGradebookResponse } from '../../lib/gradeApi';
import { inputClass, primaryButton } from '../home/homeHelpers';
import { BUCKET_STYLE, card, chip, competencyTitle, errorMessage, hasGrade, secondaryButton } from './gradebookHelpers';

// Conclusiones descriptivas por competencia (libreta y SIAGIE): la IA propone, el docente decide.
export const ConclusionsTab = ({ book }: { book: ClassroomGradebookResponse }) => {
  const queryClient = useQueryClient();
  const [competencyId, setCompetencyId] = useState(book.competencies[0]?.id ?? '');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [proposed, setProposed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<null | 'ai' | 'save'>(null);
  const [onlyMissing, setOnlyMissing] = useState(false);

  useEffect(() => { setDraft({}); setProposed(new Set()); }, [competencyId, book.period]);

  const rows = useMemo(() => book.students
    .map((student) => ({ student, grade: student.grades.find((g) => g.competencyId === competencyId) }))
    .filter(({ grade }) => hasGrade(grade)), [book.students, competencyId]);
  const visible = onlyMissing ? rows.filter(({ grade }) => !grade?.conclusion) : rows;
  const valueOf = (gradeId: string, fallback: string | null | undefined) => (gradeId in draft ? draft[gradeId] : fallback ?? '');
  const changed = rows.filter(({ grade }) => grade && grade.id in draft && draft[grade.id] !== (grade.conclusion ?? ''));

  const propose = async () => {
    const targets = rows.filter(({ grade }) => !valueOf(grade!.id, grade!.conclusion).trim());
    if (targets.length === 0) {
      toast('Todos los alumnos ya tienen conclusión en esta competencia.');
      return;
    }
    setBusy('ai');
    try {
      const { proposals } = await gradeApi.proposeConclusions(book.classroomId, competencyId, book.period, targets.map(({ student }) => student.studentProfileId));
      const next = { ...draft };
      const marks = new Set(proposed);
      for (const p of proposals) {
        if (p.proposal) {
          next[p.gradeId] = p.proposal;
          marks.add(p.gradeId);
        }
      }
      setDraft(next);
      setProposed(marks);
      toast.success(`La IA propuso ${proposals.filter((p) => p.proposal).length} conclusiones: revísalas antes de guardar`);
    } catch (error) {
      toast.error(errorMessage(error, 'La IA no pudo proponer conclusiones'));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (changed.length === 0) return;
    setBusy('save');
    try {
      await gradeApi.saveConclusions(book.classroomId, changed.map(({ grade }) => ({ gradeId: grade!.id, conclusion: draft[grade!.id].trim() || null })));
      await queryClient.invalidateQueries({ queryKey: ['classroom-grades', book.classroomId] });
      setDraft({});
      setProposed(new Set());
      toast.success(`${changed.length} ${changed.length === 1 ? 'conclusión guardada' : 'conclusiones guardadas'}`);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron guardar'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="conclusions-title" className={card}>
      <div className="mb-3">
        <h2 id="conclusions-title" className="text-base font-bold text-gray-900 dark:text-white">Conclusiones descriptivas</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">Van en la libreta y en el Excel SIAGIE. La IA puede proponerlas a partir de la evidencia de cada alumno; tú las revisas y guardas.</p>
      </div>
      <div role="radiogroup" aria-label="Competencia" className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {book.competencies.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={competencyId === c.id} onClick={() => setCompetencyId(c.id)} className={chip(competencyId === c.id)}>
            {c.code} · {competencyTitle(c)}
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="h-5 w-5 accent-primary-600" />
          Solo los que no tienen conclusión
        </label>
        <button type="button" onClick={propose} disabled={busy !== null || rows.length === 0} className={secondaryButton}>
          {busy === 'ai' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />} Proponer con IA
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-800 dark:text-gray-100">Aún no hay notas en esta competencia.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {visible.map(({ student, grade }) => (
            <li key={student.studentProfileId} className="space-y-1.5 py-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-lg px-2 py-0.5 text-sm font-black ${BUCKET_STYLE[grade!.bucket]}`}>{grade!.gradeLabel}</span>
                <label htmlFor={`concl-${grade!.id}`} className="font-semibold text-gray-900 dark:text-white">{student.studentName}</label>
                {proposed.has(grade!.id) && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-900 dark:bg-violet-900/40 dark:text-violet-100">Propuesta de la IA</span>}
              </div>
              <textarea id={`concl-${grade!.id}`} rows={2} maxLength={2000} value={valueOf(grade!.id, grade!.conclusion)}
                onChange={(e) => setDraft((d) => ({ ...d, [grade!.id]: e.target.value }))} className={inputClass} placeholder="Escribe la conclusión o pídela a la IA" />
            </li>
          ))}
        </ul>
      )}

      {changed.length > 0 && (
        <div className="sticky bottom-3 z-10 mt-3 flex justify-end">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/95 p-2 pl-4 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
            <span className="text-sm text-gray-800 dark:text-gray-100">{changed.length} sin guardar</span>
            <button type="button" onClick={save} disabled={changed.length === 0 || busy !== null} className={primaryButton}>
              {busy === 'save' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Guardar conclusiones
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
