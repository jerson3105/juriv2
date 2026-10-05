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

/** Qué se copia del año de origen al preparar el siguiente. */
export interface YearCopyOptions {
  yearId: string;
  sections: boolean;
  tutors: boolean;
  plan: boolean;
  assignments: boolean;
  workshops: boolean;
  coordinators: boolean;
}

export interface YearCopySummary {
  sections: number;
  tutors: number;
  planLevels: number;
  assignments: number;
  workshops: number;
  coordinators: number;
  /** Lo que no se copió porque esa persona ya no está en el equipo. */
  notInTeam: number;
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
  /** El primer año nace activo; el siguiente, en preparación (y puede copiar la estructura de otro). */
  create: async (schoolId: string, data: SchoolYearInput & { name: string; copyFrom?: YearCopyOptions }): Promise<SchoolYearDetail & { copied: YearCopySummary | null }> => {
    const response = await api.post(`/schools/${schoolId}/years`, data);
    return response.data.data;
  },
  /** El año en preparación empieza (el anterior ya cerró). Devuelve el mensaje para el aviso. */
  start: async (schoolId: string, yearId: string): Promise<string> =>
    (await api.post(`/schools/${schoolId}/years/${yearId}/start`)).data.message,
  /** Una tanda del llenado de sus clases (se repite mientras queden). */
  fill: async (schoolId: string, yearId: string): Promise<{ classes: number; entered: number; remaining: number }> =>
    (await api.post(`/schools/${schoolId}/years/${yearId}/fill`)).data.data,
  /** Descarta el año en preparación. */
  remove: async (schoolId: string, yearId: string): Promise<string> =>
    (await api.delete(`/schools/${schoolId}/years/${yearId}`)).data.message,
  update: async (schoolId: string, yearId: string, data: SchoolYearInput): Promise<SchoolYearDetail> => {
    const response = await api.put(`/schools/${schoolId}/years/${yearId}`, data);
    return response.data.data;
  },
  /** Cierra o reabre un bimestre en todas las clases del colegio. Devuelve el mensaje para el aviso. */
  closePeriod: async (schoolId: string, yearId: string, code: string): Promise<string> =>
    (await api.post(`/schools/${schoolId}/years/${yearId}/periods/${code}/close`)).data.message,
  /** Reabre un bimestre (cerrado, en revisión o publicado; este pide el motivo de la corrección). */
  reopenPeriod: async (schoolId: string, yearId: string, code: string, reason?: string): Promise<string> =>
    (await api.post(`/schools/${schoolId}/years/${yearId}/periods/${code}/reopen`, reason ? { reason } : undefined)).data.message,
  /** «En revisión»: aviso de cierre a los docentes del año (el bimestre sigue abierto). */
  startReview: async (schoolId: string, yearId: string, code: string): Promise<string> =>
    (await api.post(`/schools/${schoolId}/years/${yearId}/periods/${code}/review`)).data.message,
};
