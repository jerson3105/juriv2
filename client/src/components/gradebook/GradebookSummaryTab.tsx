import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { gradeApi, type ClassroomGradebookResponse, type PerformanceBucket } from '../../lib/gradeApi';
import { CompetencyDistribution, type DistributionRow } from './CompetencyDistribution';
import { card, competencyTitle, evaluationsKey, hasGrade } from './gradebookHelpers';

type TabTarget = 'notas' | 'evaluaciones' | 'conclusiones';

// Resumen del bimestre: lo que falta para cerrarlo y cómo va cada competencia y destreza.
export const GradebookSummaryTab = ({ book, onGoTo }: { book: ClassroomGradebookResponse; onGoTo: (tab: TabTarget) => void }) => {
  const { data: evaluations } = useQuery({
    queryKey: evaluationsKey(book.classroomId, book.period),
    queryFn: () => gradeApi.listEvaluations(book.classroomId, book.period),
  });

  const checks = useMemo(() => {
    let missing = 0;
    let pendingConclusions = 0;
    let changed = 0;
    for (const student of book.students) {
      for (const competency of book.competencies) {
        const grade = student.grades.find((g) => g.competencyId === competency.id);
        if (!hasGrade(grade)) { missing += 1; continue; }
        // La libreta pide conclusión descriptiva para "en proceso" y "en inicio".
        if ((grade!.bucket === 'B' || grade!.bucket === 'C') && !grade!.conclusion) pendingConclusions += 1;
        if (grade!.calculatedChanged) changed += 1;
      }
    }
    const incomplete = (evaluations?.evaluations ?? []).filter((e) => e.scored < book.students.length);
    return { missing, pendingConclusions, changed, incomplete };
  }, [book, evaluations]);

  const rows = useMemo<DistributionRow[]>(() => book.competencies.flatMap((competency) => {
    const counts: Record<PerformanceBucket, number> = { AD: 0, A: 0, B: 0, C: 0 };
    let graded = 0;
    for (const student of book.students) {
      const grade = student.grades.find((g) => g.competencyId === competency.id);
      if (hasGrade(grade)) { counts[grade!.bucket] += 1; graded += 1; }
    }
    const skillRows = competency.indicators.map((skill) => {
      const skillCounts: Record<PerformanceBucket, number> = { AD: 0, A: 0, B: 0, C: 0 };
      let skillGraded = 0;
      for (const student of book.students) {
        const item = student.grades.find((g) => g.competencyId === competency.id)?.indicatorBreakdown.find((i) => i.id === skill.id);
        if (item?.hasEvidence && item.bucket) { skillCounts[item.bucket] += 1; skillGraded += 1; }
      }
      return { id: skill.id, code: skill.code, title: skill.name, counts: skillCounts, missing: book.students.length - skillGraded, nested: true };
    });
    return [{ id: competency.id, code: competency.code, title: competencyTitle(competency), counts, missing: book.students.length - graded }, ...skillRows];
  }), [book]);

  const items: Array<{ done: boolean; title: string; detail: string; tab: TabTarget; action: string }> = [
    {
      done: checks.missing === 0,
      title: checks.missing === 0 ? 'Todos tienen nota en todas las competencias' : `${checks.missing} notas sin evidencia`,
      detail: checks.missing === 0 ? '' : 'Pon la nota a mano o registra una evaluación.',
      tab: 'notas',
      action: 'Ver notas',
    },
    {
      done: checks.incomplete.length === 0,
      title: checks.incomplete.length === 0 ? 'Evaluaciones completas' : `${checks.incomplete.length} ${checks.incomplete.length === 1 ? 'evaluación incompleta' : 'evaluaciones incompletas'}`,
      detail: checks.incomplete.slice(0, 3).map((e) => `${e.title} (${e.scored}/${book.students.length})`).join(' · '),
      tab: 'evaluaciones',
      action: 'Ver evaluaciones',
    },
    {
      done: checks.pendingConclusions === 0,
      title: checks.pendingConclusions === 0 ? 'Conclusiones al día' : `${checks.pendingConclusions} conclusiones pendientes`,
      detail: checks.pendingConclusions === 0 ? '' : 'La libreta las pide para «en proceso» y «en inicio».',
      tab: 'conclusiones',
      action: 'Escribir conclusiones',
    },
    {
      done: checks.changed === 0,
      title: checks.changed === 0 ? 'Tus ajustes coinciden con lo calculado' : `${checks.changed} ajustes con nueva evidencia`,
      detail: checks.changed === 0 ? '' : 'La nota calculada cambió desde que la ajustaste (punto ámbar en la tabla).',
      tab: 'notas',
      action: 'Revisar',
    },
  ];

  return (
    <div className="space-y-4">
      <section aria-labelledby="closing-title" className={card}>
        <h2 id="closing-title" className="text-base font-bold text-gray-900 dark:text-white">{book.isClosed ? 'Bimestre cerrado' : 'Antes de cerrar el bimestre'}</h2>
        <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-700">
          {items.map((item) => (
            <li key={item.title} className="flex flex-wrap items-center gap-3 py-2.5">
              {item.done
                ? <CheckCircle2 size={20} className="flex-shrink-0 text-emerald-700 dark:text-emerald-300" aria-label="Listo" />
                : <AlertTriangle size={20} className="flex-shrink-0 text-amber-700 dark:text-amber-300" aria-label="Pendiente" />}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">{item.title}</span>
                {item.detail && <span className="block text-sm text-gray-700 dark:text-gray-300">{item.detail}</span>}
              </span>
              {!item.done && (
                <button type="button" onClick={() => onGoTo(item.tab)}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-xl px-3 text-sm font-semibold text-primary-800 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-900/30">
                  {item.action} <ChevronRight size={16} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="distribution-title" className={card}>
        <h2 id="distribution-title" className="mb-2 text-base font-bold text-gray-900 dark:text-white">Cómo va cada competencia</h2>
        <CompetencyDistribution rows={rows} caption={`${book.students.length} alumnos. Las destrezas muestran la nota que sale de sus comportamientos.`} />
      </section>
    </div>
  );
};
