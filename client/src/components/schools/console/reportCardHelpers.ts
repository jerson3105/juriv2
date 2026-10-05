import type { PeriodStatus, ReportPeriod, StudentReport } from '../../../lib/schoolReportApi';

/** Textos de las libretas que comparten la administración («Libretas») y el tutor («Mi tutoría»). */

const STATUS_LABEL: Record<PeriodStatus, string> = { OPEN: 'En curso', REVIEW: 'En revisión', LOCKED: 'Cerrado', PUBLISHED: 'Publicado' };

/** «Aún no», «En curso», «En revisión», «Cerrado» o «Publicado». */
export const periodState = (period: Pick<ReportPeriod, 'started' | 'status'>) =>
  (period.started || period.status !== 'OPEN' ? STATUS_LABEL[period.status] : 'Aún no');

export const formatDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

export const reportName = (student: StudentReport['student']) => `${student.lastNames.toLocaleUpperCase('es')}, ${student.firstNames}`;
