import api from './api';
import type { SchoolLevel } from './schoolYearApi';

/**
 * Consola escolar: libretas («Informe de progreso del aprendizaje del estudiante», formato del MINEDU). Los datos de su
 * cabecera (DRE, UGEL, director(a), códigos modulares y logo), la libreta de una sección para revisarla y su PDF.
 */

export type PeriodCode = 'B1' | 'B2' | 'B3' | 'B4';

export interface ReportSettings {
  name: string;
  /** El código modular del colegio (el de su verificación); cada nivel puede tener el suyo. */
  modularCode: string | null;
  logoUrl: string | null;
  dre: string | null;
  ugel: string | null;
  directorName: string | null;
  codes: Record<SchoolLevel, string | null>;
}

export interface ReportSettingsInput {
  dre: string | null;
  ugel: string | null;
  directorName: string | null;
  codes: Record<SchoolLevel, string | null>;
}

export interface ReportPeriod {
  code: PeriodCode;
  number: number;
  startsOn: string;
  locked: boolean;
  started: boolean;
  included: boolean;
}

export interface ReportCompetency { id: string; name: string; grades: Array<string | null>; final: string | null }
export interface ReportArea { id: string; name: string; workshops: string[]; competencies: ReportCompetency[] }

export interface StudentReport {
  student: {
    id: string;
    firstNames: string;
    lastNames: string;
    siagieCode: string | null;
    hasDocument: boolean;
    status: 'ACTIVE' | 'WITHDRAWN';
    withdrawnOn: string | null;
  };
  areas: ReportArea[];
  conclusions: Array<Array<{ area: string; competency: string; text: string }>>;
  attendance: Array<{ absentJustified: number; absentUnjustified: number; lateJustified: number; lateUnjustified: number } | null>;
  /** En los bimestres que entran: competencias sin nota y conclusiones obligatorias que faltan. */
  missing: { grades: number; conclusions: number };
}

export interface SectionReport {
  school: { id: string; name: string; logoUrl: string | null; dre: string | null; ugel: string | null; modularCode: string | null; directorName: string | null };
  year: { id: string; name: string; status: 'PLANNING' | 'ACTIVE' | 'CLOSED' };
  section: { id: string; label: string; level: SchoolLevel; levelName: string; grade: number; gradeLabel: string; name: string; tutor: string | null };
  scale: 'LITERAL' | 'VIGESIMAL';
  periods: ReportPeriod[];
  upTo: PeriodCode;
  /** El bimestre elegido aún está abierto: sus notas pueden cambiar. */
  preview: boolean;
  showFinal: boolean;
  /** El servidor puede leer los documentos: sin las llaves, el DNI no sale en la libreta. */
  documentsReadable: boolean;
  students: StudentReport[];
}

export const schoolReportKeys = {
  settings: (schoolId: string) => ['school-report-settings', schoolId] as const,
  section: (schoolId: string, yearId: string, sectionId: string, period: PeriodCode | null) => ['school-report-section', schoolId, yearId, sectionId, period] as const,
};

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');
/** El logo del colegio (lo sirve el servidor). */
export const schoolLogoUrl = (path: string | null | undefined) => (!path ? '' : /^https?:\/\//.test(path) ? path : `${API_ORIGIN}${path}`);

const year = (schoolId: string, yearId: string) => `/schools/${schoolId}/years/${yearId}`;
const slug = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'libreta';

// Una descarga que falla trae su mensaje JSON dentro de un Blob: se lee para mostrarlo.
const blobError = async (error: unknown) => {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    const message = await data.text().then((text) => (JSON.parse(text) as { message?: string }).message).catch(() => undefined);
    if (message) return new Error(message);
  }
  return error;
};

const fetchPdf = async (schoolId: string, yearId: string, sectionId: string, period: PeriodCode, studentId?: string) => {
  try {
    const response = await api.get(`${year(schoolId, yearId)}/report-cards/sections/${sectionId}/pdf`, {
      params: { period, ...(studentId ? { studentId } : {}) },
      responseType: 'blob',
    });
    return new Blob([response.data], { type: 'application/pdf' });
  } catch (error) {
    throw await blobError(error);
  }
};

export const schoolReportApi = {
  settings: async (schoolId: string): Promise<ReportSettings> =>
    (await api.get(`/schools/${schoolId}/report-settings`)).data.data,
  saveSettings: async (schoolId: string, input: ReportSettingsInput): Promise<ReportSettings> =>
    (await api.put(`/schools/${schoolId}/report-settings`, input)).data.data,
  uploadLogo: async (schoolId: string, file: File): Promise<{ logoUrl: string }> => {
    const form = new FormData();
    form.append('logo', file);
    return (await api.post(`/schools/${schoolId}/logo`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data;
  },
  removeLogo: async (schoolId: string): Promise<{ logoUrl: null }> =>
    (await api.delete(`/schools/${schoolId}/logo`)).data.data,
  section: async (schoolId: string, yearId: string, sectionId: string, period: PeriodCode | null): Promise<SectionReport> =>
    (await api.get(`${year(schoolId, yearId)}/report-cards/sections/${sectionId}`, { params: period ? { period } : {} })).data.data,

  /** Descarga el PDF de la sección (o de un estudiante). */
  download: async (schoolId: string, yearId: string, sectionId: string, period: PeriodCode, name: string, studentId?: string) => {
    const blob = await fetchPdf(schoolId, yearId, sectionId, period, studentId);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `libreta-${slug(name)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  /** Abre el PDF de un estudiante en otra pestaña (la vista previa es el mismo PDF que se imprime). */
  open: async (schoolId: string, yearId: string, sectionId: string, period: PeriodCode, studentId: string) => {
    // La pestaña se abre antes de esperar al servidor: si no, el navegador la bloquea como ventana emergente.
    const tab = window.open('', '_blank');
    try {
      const blob = await fetchPdf(schoolId, yearId, sectionId, period, studentId);
      const url = window.URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      tab?.close();
      throw error;
    }
  },
};
