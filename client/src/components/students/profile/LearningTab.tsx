import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import { gradeApi, type PerformanceBucket } from '../../../lib/gradeApi';
import { attendanceApi, type AttendanceStatus } from '../../../lib/attendanceApi';
import type { StudentSummary } from '../../../lib/studentApi';
import { formatAttendanceDate } from './profileHelpers';

interface LearningTabProps {
  classroomId: string;
  studentId: string;
  useCompetencies: boolean;
  summary?: StudentSummary;
}

// Colores de desempeño con contraste AA en claro y oscuro.
const BUCKET_STYLE: Record<PerformanceBucket, string> = {
  AD: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
  A: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100',
  B: 'bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100',
  C: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
};
const STATUS: Record<AttendanceStatus, { label: string; style: string }> = {
  PRESENT: { label: 'Presente', style: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100' },
  LATE: { label: 'Tardanza', style: 'bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100' },
  ABSENT: { label: 'Falta', style: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100' },
  EXCUSED: { label: 'Justificada', style: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100' },
};

export const LearningTab = ({ classroomId, studentId, useCompetencies, summary }: LearningTabProps) => {
  const grades = useQuery({
    queryKey: ['student-grades', studentId, 'CURRENT'],
    queryFn: () => gradeApi.getStudentGrades(studentId, 'CURRENT'),
    enabled: useCompetencies,
  });
  const attendance = useQuery({
    queryKey: ['student-attendance', studentId],
    queryFn: () => attendanceApi.getStudentHistory(studentId, 15),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="grades-title" className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="grades-title" className="text-base font-bold text-gray-900 dark:text-white">Notas por competencia</h2>
          {useCompetencies && (
            <Link to={`/classroom/${classroomId}/gradebook`} className="inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-primary-700 hover:underline dark:text-primary-300">
              Libreta <ChevronRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
        {!useCompetencies ? (
          <p className="text-sm text-gray-700 dark:text-gray-300">Esta clase no evalúa por competencias.</p>
        ) : grades.isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" aria-label="Cargando notas" />
        ) : grades.isError || !grades.data ? (
          <p className="text-sm text-gray-700 dark:text-gray-300">No se pudieron cargar las notas.</p>
        ) : grades.data.grades.length === 0 ? (
          <p className="text-sm text-gray-700 dark:text-gray-300">Aún no hay notas calculadas en este bimestre.</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
              <span className={`rounded-lg px-3 py-1 text-lg font-black ${BUCKET_STYLE[grades.data.average.bucket]}`}>{grades.data.average.label}</span>
              <span className="text-sm text-gray-800 dark:text-gray-100">Promedio de {grades.data.average.evaluatedCompetencies} competencia{grades.data.average.evaluatedCompetencies === 1 ? '' : 's'}</span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {grades.data.grades.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 text-sm text-gray-900 dark:text-white">
                    <span className="block truncate font-semibold">{g.competencyName}</span>
                    <span className="block text-xs text-gray-700 dark:text-gray-300">{g.activitiesCount} actividad{g.activitiesCount === 1 ? '' : 'es'}{g.isManualOverride ? ' · ajustada a mano' : ''}</span>
                  </span>
                  <span className={`flex-shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold ${BUCKET_STYLE[g.bucket]}`}>{g.gradeLabel}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="attendance-title" className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 id="attendance-title" className="mb-3 text-base font-bold text-gray-900 dark:text-white">Asistencia</h2>
        {summary && summary.attendance.total > 0 && (
          <dl className="mb-3 grid grid-cols-4 gap-2 text-center">
            {([['Presente', summary.attendance.present], ['Tarde', summary.attendance.late], ['Faltas', summary.attendance.absent], ['Justif.', summary.attendance.excused]] as const).map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-2 dark:bg-gray-900/40">
                <dt className="text-xs text-gray-700 dark:text-gray-300">{label}</dt>
                <dd className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {attendance.isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" aria-label="Cargando asistencia" />
        ) : (attendance.data ?? []).length === 0 ? (
          <p className="text-sm text-gray-700 dark:text-gray-300">Aún no hay pase de lista para este alumno.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">Últimos registros</p>
            <ul className="flex flex-wrap gap-2">
              {(attendance.data ?? []).map((r) => (
                <li key={r.id} className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${STATUS[r.status].style}`}>
                  <span className="capitalize">{formatAttendanceDate(r.date)}</span> · {STATUS[r.status].label}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
};
