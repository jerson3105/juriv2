import api from './api';

/** Consola escolar: año escolar, periodos y niveles. Fechas como texto AAAA-MM-DD (sin zona horaria). */

export type SchoolLevel = 'INICIAL' | 'PRIMARIA' | 'SECUNDARIA';
export type PeriodType = 'BIMESTER' | 'TRIMESTER';
export type GradeScale = 'LITERAL' | 'VIGESIMAL';
export type SchoolYearStatus = 'PLANNING' | 'ACTIVE' | 'CLOSED';

export interface SchoolYearSummary {
  id: string;
  name: string;
  status: SchoolYearStatus;
  periodType: PeriodType;
  startsOn: string;
  endsOn: string;
}

export interface SchoolPeriod {
  id: string;
  code: string;
  startsOn: string;
  endsOn: string;
  status: 'OPEN' | 'REVIEW' | 'LOCKED' | 'PUBLISHED';
  /** LOCKED: la administración lo cerró en todas las clases (Calificaciones). */
  lockedAt: string | null;
  /** Ya empezó (fecha de Lima): se puede cerrar. */
  started: boolean;
}

export interface SchoolYearDetail extends SchoolYearSummary {
  periods: SchoolPeriod[];
  levels: Array<{ level: SchoolLevel; gradeScale: GradeScale }>;
}

export interface SchoolYearInput {
  startsOn: string;
  endsOn: string;
  periodType: PeriodType;
  periods: Array<{ code: string; startsOn: string; endsOn: string }>;
  levels: Array<{ level: SchoolLevel; gradeScale: GradeScale }>;
}

export const schoolYearKeys = {
  list: (schoolId: string) => ['school-years', schoolId] as const,
  detail: (schoolId: string, yearId: string) => ['school-year', schoolId, yearId] as const,
};

export const schoolYearApi = {
  list: async (schoolId: string): Promise<SchoolYearSummary[]> => {
    const response = await api.get(`/schools/${schoolId}/years`);
    return response.data.data;
  },
  get: async (schoolId: string, yearId: string): Promise<SchoolYearDetail> => {
    const response = await api.get(`/schools/${schoolId}/years/${yearId}`);
    return response.data.data;
  },
  create: async (schoolId: string, data: SchoolYearInput & { name: string }): Promise<SchoolYearDetail> => {
    const response = await api.post(`/schools/${schoolId}/years`, data);
    return response.data.data;
  },
  update: async (schoolId: string, yearId: string, data: SchoolYearInput): Promise<SchoolYearDetail> => {
    const response = await api.put(`/schools/${schoolId}/years/${yearId}`, data);
    return response.data.data;
  },
  /** Cierra o reabre un bimestre en todas las clases del colegio. Devuelve el mensaje para el aviso. */
  closePeriod: async (schoolId: string, yearId: string, code: string): Promise<string> =>
    (await api.post(`/schools/${schoolId}/years/${yearId}/periods/${code}/close`)).data.message,
  reopenPeriod: async (schoolId: string, yearId: string, code: string): Promise<string> =>
    (await api.post(`/schools/${schoolId}/years/${yearId}/periods/${code}/reopen`)).data.message,
};
