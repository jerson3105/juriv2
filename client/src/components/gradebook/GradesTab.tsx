import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Layers, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { gradeApi, type ClassroomGradebookResponse, type GradebookCompetencyColumn, type PerformanceBucket, type StudentGrade } from '../../lib/gradeApi';
import { inputClass } from '../home/homeHelpers';
import { BUCKET_LABEL, BUCKET_STYLE, card, chip, competencyTitle, errorMessage, hasGrade } from './gradebookHelpers';
import { GradeChip, SkillChip } from './GradeChip';
import { ScaleValuePicker } from './ScaleValuePicker';

export interface CellRef {
  studentProfileId: string;
  competencyId: string;
}

interface GradesTabProps {
  book: ClassroomGradebookResponse;
  onOpenDetail: (cell: CellRef) => void;
}

type QuickEdit = CellRef & { anchor: DOMRect; grade: StudentGrade; studentName: string; competency: GradebookCompetencyColumn };

// Edición rápida: elegir un valor de la escala guarda al momento; "Ver detalle" abre el panel completo.
const QuickEditPopover = ({ edit, book, onClose, onDetail }: { edit: QuickEdit; book: ClassroomGradebookResponse; onClose: () => void; onDetail: () => void }) => {
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [numeric, setNumeric] = useState<string | null>(null);
  // Se mide ya pintado y se coloca bajo la celda (o encima si no cabe), dentro de la pantalla.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { offsetWidth: width, offsetHeight: height } = el;
    const below = edit.anchor.bottom + 6;
    el.style.top = `${below + height > window.innerHeight ? Math.max(8, edit.anchor.top - height - 6) : below}px`;
    el.style.left = `${Math.min(Math.max(8, edit.anchor.left + edit.anchor.width / 2 - width / 2), window.innerWidth - width - 8)}px`;
  }, [edit.anchor]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    const onDown = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    const onScroll = () => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onScroll);
    document.querySelector('main')?.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onScroll);
      document.querySelector('main')?.removeEventListener('scroll', onScroll);
    };
  }, [onClose]);

  const save = async (value: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await gradeApi.setManualGrade(edit.grade.id, value);
      await queryClient.invalidateQueries({ queryKey: ['classroom-grades', book.classroomId] });
      toast.success(`${edit.studentName} · ${edit.competency.code}: ${value}`);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar la nota'));
      setSaving(false);
    }
  };

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Nota de ${edit.studentName} en ${competencyTitle(edit.competency)}`}
      style={{ top: edit.anchor.bottom + 6, left: edit.anchor.left }}
      className="fixed z-[55] w-max max-w-[calc(100vw-16px)] space-y-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-600 dark:bg-gray-800"
    >
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{edit.studentName} · {edit.competency.code}</p>
      <div className="flex items-center gap-2">
        <ScaleValuePicker
          scale={book.scale}
          scaleType={book.gradeScaleType}
          value={book.scale.kind === 'letters' ? (edit.grade.isManualOverride ? edit.grade.gradeLabel : null) : numeric}
          onChange={(value) => (book.scale.kind === 'letters' ? save(value) : setNumeric(value || null))}
          label="Nota"
          size="sm"
          autoFocus
          disabled={saving}
        />
        {book.scale.kind === 'number' && (
          <button type="button" disabled={!numeric || saving} onClick={() => numeric && save(numeric)}
            className="min-h-[40px] rounded-xl bg-primary-600 px-3 text-sm font-bold text-white hover:bg-primary-700 disabled:bg-gray-300 disabled:text-gray-600">
            Guardar
          </button>
        )}
        {saving && <Loader2 size={18} className="animate-spin text-primary-700" aria-label="Guardando" />}
      </div>
      <button type="button" onClick={onDetail} className="min-h-[40px] text-sm font-semibold text-primary-800 underline-offset-2 hover:underline dark:text-primary-200">
        Ver detalle, comentarios y de dónde sale
      </button>
    </div>,
    document.body,
  );
};

export const GradesTab = ({ book, onOpenDetail }: GradesTabProps) => {
  const [search, setSearch] = useState('');
  const [mobilePick, setMobileCompetency] = useState(book.competencies[0]?.id ?? '');
  const [quick, setQuick] = useState<QuickEdit | null>(null);
  const gridRef = useRef<HTMLTableElement>(null);

  // Si la competencia elegida ya no está (se quitó), se usa la primera.
  const mobileCompetency = book.competencies.some((c) => c.id === mobilePick) ? mobilePick : book.competencies[0]?.id ?? '';

  const students = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? book.students.filter((s) => s.studentName.toLowerCase().includes(term) || s.characterName?.toLowerCase().includes(term))
      : book.students;
  }, [book.students, search]);

  // Resumen por celda: cuántas notas en cada nivel, sin nota y ajustadas.
  const summary = useMemo(() => {
    const counts: Record<PerformanceBucket, number> = { AD: 0, A: 0, B: 0, C: 0 };
    let missing = 0;
    let manual = 0;
    for (const student of book.students) {
      for (const competency of book.competencies) {
        const grade = student.grades.find((g) => g.competencyId === competency.id);
        if (hasGrade(grade) && grade) counts[grade.bucket] += 1;
        else missing += 1;
        if (grade?.isManualOverride) manual += 1;
      }
    }
    return { counts, missing, manual };
  }, [book]);

  const gradeOf = (studentProfileId: string, competencyId: string) =>
    book.students.find((s) => s.studentProfileId === studentProfileId)?.grades.find((g) => g.competencyId === competencyId);

  const openQuick = (event: React.MouseEvent<HTMLButtonElement>, studentProfileId: string, competency: GradebookCompetencyColumn, studentName: string) => {
    const grade = gradeOf(studentProfileId, competency.id);
    if (!grade) {
      toast('La nota se está preparando: vuelve a intentarlo en un momento.');
      return;
    }
    if (book.isClosed) {
      onOpenDetail({ studentProfileId, competencyId: competency.id });
      return;
    }
    setQuick({ studentProfileId, competencyId: competency.id, anchor: event.currentTarget.getBoundingClientRect(), grade, studentName, competency });
  };

  // Flechas entre celdas (la tabla es una cuadrícula de botones).
  const onGridKey = (event: React.KeyboardEvent<HTMLTableElement>) => {
    const target = event.target as HTMLElement;
    const row = Number(target.dataset.row);
    const col = Number(target.dataset.col);
    if (Number.isNaN(row) || Number.isNaN(col)) return;
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const move = moves[event.key];
    if (!move) return;
    const next = gridRef.current?.querySelector<HTMLButtonElement>(`[data-row="${row + move[0]}"][data-col="${col + move[1]}"]`);
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  const mobileColumn = book.competencies.find((c) => c.id === mobileCompetency);

  // Destrezas desplegadas por competencia (subcolumnas grises junto a su competencia).
  const [openSkills, setOpenSkills] = useState<Set<string>>(new Set());
  const withSkills = book.competencies.filter((c) => c.indicators.length > 0);
  const allOpen = withSkills.length > 0 && withSkills.every((c) => openSkills.has(c.id));
  const toggleSkills = (competencyId: string) => setOpenSkills((prev) => {
    const next = new Set(prev);
    if (next.has(competencyId)) next.delete(competencyId);
    else next.add(competencyId);
    return next;
  });
  const columns: Array<
    | { kind: 'competency'; competency: GradebookCompetencyColumn }
    | { kind: 'skill'; competency: GradebookCompetencyColumn; skill: GradebookCompetencyColumn['indicators'][number] }
  > = book.competencies.flatMap((competency) => [
    { kind: 'competency' as const, competency },
    ...(openSkills.has(competency.id) ? competency.indicators.map((skill) => ({ kind: 'skill' as const, competency, skill })) : []),
  ]);

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <section aria-labelledby="grades-summary" className={card}>
        <h2 id="grades-summary" className="sr-only">Resumen de notas</h2>
        <dl className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {(['AD', 'A', 'B', 'C'] as PerformanceBucket[]).map((bucket) => (
            <div key={bucket}>
              <dt className="text-sm text-gray-700 dark:text-gray-300">{BUCKET_LABEL[bucket]}</dt>
              <dd className="mt-0.5"><span className={`inline-block rounded-lg px-2 text-xl font-black tabular-nums ${BUCKET_STYLE[bucket]}`}>{summary.counts[bucket]}</span></dd>
            </div>
          ))}
          <div>
            <dt className="text-sm text-gray-700 dark:text-gray-300">Sin nota</dt>
            <dd className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{summary.missing}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-700 dark:text-gray-300">Ajustadas a mano</dt>
            <dd className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{summary.manual}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="grades-table-title" className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="grades-table-title" className="text-base font-bold text-gray-900 dark:text-white">Notas por competencia</h2>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {withSkills.length > 0 && (
            <button type="button" aria-pressed={allOpen}
              onClick={() => setOpenSkills(allOpen ? new Set() : new Set(withSkills.map((c) => c.id)))}
              className={`hidden min-h-[44px] items-center gap-2 rounded-xl border px-3 text-sm font-semibold md:inline-flex ${allOpen ? 'border-primary-600 bg-primary-50 text-primary-900 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-100' : 'border-gray-300 text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700'}`}>
              <Layers size={16} aria-hidden="true" /> {allOpen ? 'Ocultar destrezas' : 'Ver destrezas'}
            </button>
          )}
          <div className="relative w-full sm:w-72">
            <label htmlFor="grades-search" className="sr-only">Buscar alumno</label>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" aria-hidden="true" />
            <input id="grades-search" type="search" placeholder="Buscar alumno" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} pl-9`} />
          </div>
          </div>
        </div>
        <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
          {book.isClosed
            ? 'Bimestre cerrado: toca una nota para ver su detalle o escribir su conclusión.'
            : <>Toca una nota para cambiarla.<span className="hidden md:inline"> Las flechas del teclado te mueven entre celdas.</span></>}
        </p>

        {students.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-800 dark:text-gray-100">{search ? 'Ningún alumno coincide con la búsqueda.' : 'La clase aún no tiene alumnos.'}</p>
        ) : (
          <>
            {/* Escritorio: tabla alumno × competencia */}
            <div className="hidden max-h-[70vh] overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 md:block">
              <table ref={gridRef} onKeyDown={onGridKey} className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 top-0 z-20 min-w-[200px] border-b border-gray-200 bg-gray-50 px-3 py-2 text-left font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white">Alumno</th>
                    {columns.map((column) => column.kind === 'competency' ? (
                      <th key={column.competency.id} scope="col" title={column.competency.name ?? undefined} className="sticky top-0 z-10 min-w-[120px] border-b border-l border-gray-200 bg-primary-50 px-2 py-2 text-center align-bottom font-semibold text-primary-950 dark:border-gray-700 dark:bg-primary-950 dark:text-primary-50">
                        <span className="block text-xs font-bold">{column.competency.code}</span>
                        <span className="line-clamp-2 text-sm">{competencyTitle(column.competency)}</span>
                        <span className="sr-only">{column.competency.name}</span>
                        {column.competency.indicators.length > 0 && (
                          <button type="button" onClick={() => toggleSkills(column.competency.id)} aria-expanded={openSkills.has(column.competency.id)}
                            aria-label={`${openSkills.has(column.competency.id) ? 'Ocultar' : 'Ver'} destrezas de ${competencyTitle(column.competency)}`}
                            className="mt-1 inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary-900 hover:bg-primary-100 dark:text-primary-100 dark:hover:bg-primary-900">
                            {column.competency.indicators.length} {column.competency.indicators.length === 1 ? 'destreza' : 'destrezas'}
                            <ChevronRight size={14} className={`transition-transform ${openSkills.has(column.competency.id) ? 'rotate-180' : ''}`} aria-hidden="true" />
                          </button>
                        )}
                      </th>
                    ) : (
                      <th key={column.skill.id} scope="col" title={column.skill.name} className="sticky top-0 z-10 min-w-[104px] max-w-[140px] border-b border-gray-200 bg-gray-100 px-2 py-2 text-center align-bottom font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-700 dark:text-white">
                        <span className="block text-xs font-bold text-gray-700 dark:text-gray-200">{column.skill.code}</span>
                        <span className="line-clamp-2 text-sm">{column.skill.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, rowIndex) => (
                    <tr key={student.studentProfileId} className="group">
                      <th scope="row" className="sticky left-0 z-[5] border-b border-gray-100 bg-white px-3 py-1.5 text-left font-normal group-hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:group-hover:bg-gray-700/60">
                        <span className="block font-semibold text-gray-900 dark:text-white">{student.studentName}</span>
                        {student.characterName && student.characterName !== student.studentName && (
                          <span className="block text-sm text-gray-700 dark:text-gray-300">{student.characterName}</span>
                        )}
                      </th>
                      {columns.map((column, colIndex) => {
                        const grade = student.grades.find((g) => g.competencyId === column.competency.id);
                        if (column.kind === 'competency') {
                          return (
                            <td key={column.competency.id} className="border-b border-l border-gray-100 px-2 py-1.5 text-center group-hover:bg-gray-50 dark:border-gray-700 dark:group-hover:bg-gray-700/60">
                              <GradeChip
                                grade={grade}
                                context={`${student.studentName}, ${competencyTitle(column.competency)}`}
                                data-row={rowIndex}
                                data-col={colIndex}
                                onClick={(event) => openQuick(event, student.studentProfileId, column.competency, student.studentName)}
                              />
                            </td>
                          );
                        }
                        return (
                          <td key={column.skill.id} className="border-b border-gray-100 bg-gray-50/60 px-2 py-1.5 text-center group-hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/30 dark:group-hover:bg-gray-700/60">
                            <SkillChip
                              skill={grade?.indicatorBreakdown.find((i) => i.id === column.skill.id)}
                              historical={grade?.indicatorBreakdownStatus === 'HISTORICAL_NO_BREAKDOWN'}
                              context={`${student.studentName}, ${column.skill.name}`}
                              data-row={rowIndex}
                              data-col={colIndex}
                              onClick={() => onOpenDetail({ studentProfileId: student.studentProfileId, competencyId: column.competency.id })}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Móvil: una competencia a la vez */}
            <div className="space-y-3 md:hidden">
              <div role="radiogroup" aria-label="Competencia" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {book.competencies.map((competency) => (
                  <button key={competency.id} type="button" role="radio" aria-checked={mobileCompetency === competency.id}
                    onClick={() => setMobileCompetency(competency.id)} className={chip(mobileCompetency === competency.id)}>
                    {competency.code} · {competencyTitle(competency)}
                  </button>
                ))}
              </div>
              {mobileColumn && mobileColumn.indicators.length > 0 && (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Destrezas: {mobileColumn.indicators.map((skill) => `${skill.code} ${skill.name}`).join(' · ')}
                </p>
              )}
              {mobileColumn && (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {students.map((student) => {
                    const grade = student.grades.find((g) => g.competencyId === mobileColumn.id);
                    return (
                    <li key={student.studentProfileId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-gray-900 dark:text-white">{student.studentName}</span>
                        {student.characterName && student.characterName !== student.studentName && (
                          <span className="block truncate text-sm text-gray-700 dark:text-gray-300">{student.characterName}</span>
                        )}
                      </span>
                      <GradeChip
                        grade={student.grades.find((g) => g.competencyId === mobileColumn.id)}
                        context={`${student.studentName}, ${competencyTitle(mobileColumn)}`}
                        onClick={(event) => openQuick(event, student.studentProfileId, mobileColumn, student.studentName)}
                      />
                      <button type="button" onClick={() => onOpenDetail({ studentProfileId: student.studentProfileId, competencyId: mobileColumn.id })}
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                        aria-label={`Detalle de ${student.studentName}`}>
                        <SlidersHorizontal size={18} aria-hidden="true" />
                      </button>
                      {mobileColumn.indicators.length > 0 && (
                        <span className="flex w-full flex-wrap gap-1.5 pl-1">
                          {mobileColumn.indicators.map((skill) => (
                            <span key={skill.id} className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                              {skill.code}
                              <SkillChip
                                skill={grade?.indicatorBreakdown.find((i) => i.id === skill.id)}
                                historical={grade?.indicatorBreakdownStatus === 'HISTORICAL_NO_BREAKDOWN'}
                                context={`${student.studentName}, ${skill.name}`}
                                onClick={() => onOpenDetail({ studentProfileId: student.studentProfileId, competencyId: mobileColumn.id })}
                              />
                            </span>
                          ))}
                        </span>
                      )}
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </section>

      {quick && (
        <QuickEditPopover
          edit={quick}
          book={book}
          onClose={() => setQuick(null)}
          onDetail={() => { const cell = { studentProfileId: quick.studentProfileId, competencyId: quick.competencyId }; setQuick(null); onOpenDetail(cell); }}
        />
      )}
    </div>
  );
};
