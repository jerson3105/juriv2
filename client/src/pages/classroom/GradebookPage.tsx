import { useEffect, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BookOpenCheck, CalendarRange, ChevronDown, Download, FileSpreadsheet, FileText, Loader2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Classroom } from '../../lib/classroomApi';
import { gradeApi } from '../../lib/gradeApi';
import { BimesterModal } from '../../components/gradebook/BimesterModal';
import { CompetenciesTab } from '../../components/gradebook/CompetenciesTab';
import { ConclusionsTab } from '../../components/gradebook/ConclusionsTab';
import { EvaluationsTab } from '../../components/gradebook/EvaluationsTab';
import { GradebookSetup } from '../../components/gradebook/GradebookSetup';
import { GradeDetailPanel } from '../../components/gradebook/GradeDetailPanel';
import { GradesTab, type CellRef } from '../../components/gradebook/GradesTab';
import { GradebookSummaryTab } from '../../components/gradebook/GradebookSummaryTab';
import {
  bimesterKey, card, chip, errorMessage, gradebookKey, periodLabel, relativeTime, secondaryButton, tabButton,
} from '../../components/gradebook/gradebookHelpers';

const TABS = [
  { id: 'notas', label: 'Notas' },
  { id: 'resumen', label: 'Resumen' },
  { id: 'evaluaciones', label: 'Evaluaciones' },
  { id: 'conclusiones', label: 'Conclusiones' },
  { id: 'competencias', label: 'Competencias' },
] as const;
type TabId = typeof TABS[number]['id'];

// Exportar: Excel con formato SIAGIE o PDF del bimestre.
const ExportMenu = ({ classroomId, period }: { classroomId: string; period: string }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | 'excel' | 'pdf'>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);
  const run = async (kind: 'excel' | 'pdf') => {
    setBusy(kind);
    setOpen(false);
    try {
      if (kind === 'excel') await gradeApi.exportExcel(classroomId, period);
      else await gradeApi.exportPDF(classroomId, period);
      toast.success(kind === 'excel' ? 'Excel SIAGIE descargado' : 'PDF descargado');
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo exportar'));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" className={secondaryButton}>
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />} Exportar
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-800">
          <button type="button" role="menuitem" onClick={() => run('excel')} className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700">
            <FileSpreadsheet size={16} aria-hidden="true" /> Excel para SIAGIE
          </button>
          <button type="button" role="menuitem" onClick={() => run('pdf')} className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700">
            <FileText size={16} aria-hidden="true" /> PDF del bimestre
          </button>
        </div>
      )}
    </div>
  );
};

export const GradebookPage = () => {
  const { classroom, refetch } = useOutletContext<{ classroom: Classroom; refetch: () => void }>();
  const [params, setParams] = useSearchParams();
  const tab: TabId = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') as TabId : 'notas';
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [detail, setDetail] = useState<CellRef | null>(null);
  const [showBimesters, setShowBimesters] = useState(false);
  const ready = !!classroom.useCompetencies && !!classroom.curriculumAreaId;

  const year = new Date().getFullYear();
  const { data: status } = useQuery({
    queryKey: [...bimesterKey(classroom.id), year],
    queryFn: () => gradeApi.getBimesterStatus(classroom.id, year),
    enabled: ready,
  });
  const period = selectedPeriod ?? status?.currentBimester ?? null;

  const { data: book, isLoading, isError, isFetching } = useQuery({
    queryKey: gradebookKey(classroom.id, period ?? 'CURRENT'),
    queryFn: () => gradeApi.getClassroomGrades(classroom.id, period ?? 'CURRENT'),
    enabled: ready && !!status,
    placeholderData: keepPreviousData,
  });

  if (!ready) return <GradebookSetup classroomId={classroom.id} enabled={!!classroom.useCompetencies} onDone={refetch} />;

  const setTab = (id: TabId) => setParams((p) => { p.set('tab', id); return p; }, { replace: true });
  const detailStudent = detail && book?.students.find((s) => s.studentProfileId === detail.studentProfileId);
  const detailCompetency = detail && book?.competencies.find((c) => c.id === detail.competencyId);
  const detailGrade = detailStudent?.grades.find((g) => g.competencyId === detail?.competencyId);
  const updated = relativeTime(book?.lastCalculatedAt);

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
            <BookOpenCheck size={22} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Calificaciones</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {book ? `${periodLabel(book.period)} · ${book.students.length} alumnos` : 'Cargando…'}
              {book && !book.isClosed && updated && ` · actualizado ${updated}`}
              {isFetching && !isLoading && ' · actualizando…'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {book && <ExportMenu classroomId={classroom.id} period={book.period} />}
        </div>
      </div>

      {/* Bimestres */}
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div role="radiogroup" aria-label="Bimestre" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {(status?.allBimesters ?? []).map((b) => (
            <button key={b.period} type="button" role="radio" aria-checked={period === b.period} disabled={b.isFuture && !b.isClosed}
              onClick={() => setSelectedPeriod(b.period)}
              className={`${chip(period === b.period)} inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50`}>
              {b.label}
              {b.isClosed && <Lock size={14} aria-label="cerrado" />}
              {b.isCurrent && <span className="sr-only">(en curso)</span>}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowBimesters(true)} className={secondaryButton}>
          <CalendarRange size={16} aria-hidden="true" /> Bimestres
        </button>
      </div>

      {book?.isClosed && (
        <p className="flex items-center gap-2 rounded-2xl bg-gray-100 p-3 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100">
          <Lock size={16} aria-hidden="true" /> Este bimestre está cerrado: las notas no cambian. Puedes escribir conclusiones y exportar. Para corregir notas, reábrelo en «Bimestres».
        </p>
      )}

      {/* Pestañas */}
      <div role="tablist" aria-label="Secciones de calificaciones" className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)} className={tabButton(tab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {isLoading || !book ? (
          isError ? (
            <p className={`${card} text-sm text-gray-800 dark:text-gray-100`}>No se pudieron cargar las notas. Recarga la página.</p>
          ) : (
            <div className={`${card} flex justify-center py-10`}><Loader2 className="h-7 w-7 animate-spin text-primary-700" aria-label="Cargando notas" /></div>
          )
        ) : book.competencies.length === 0 && tab !== 'competencias' ? (
          <div className={`${card} py-8 text-center`}>
            <p className="text-sm text-gray-800 dark:text-gray-100">La clase aún no tiene competencias.</p>
            <button type="button" onClick={() => setTab('competencias')} className={`${secondaryButton} mt-3`}>Configurar competencias</button>
          </div>
        ) : tab === 'notas' ? (
          <GradesTab book={book} onOpenDetail={setDetail} />
        ) : tab === 'resumen' ? (
          <GradebookSummaryTab book={book} onGoTo={setTab} />
        ) : tab === 'evaluaciones' ? (
          <EvaluationsTab book={book} />
        ) : tab === 'conclusiones' ? (
          <ConclusionsTab book={book} />
        ) : (
          <CompetenciesTab book={book} classroom={classroom} />
        )}
      </div>

      {detail && book && detailStudent && detailCompetency && detailGrade && (
        <GradeDetailPanel book={book} studentName={detailStudent.studentName} competency={detailCompetency} grade={detailGrade} onClose={() => setDetail(null)} />
      )}
      {showBimesters && <BimesterModal classroomId={classroom.id} onClose={() => setShowBimesters(false)} />}
    </div>
  );
};
