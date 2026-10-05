import api from './api';
import type { SchoolLevel } from './schoolYearApi';

/** Consola escolar: promoción y cierre del año (solo la administración). */

export type FinalSituation = 'PROMOTED' | 'REPEATS' | 'RECOVERY' | 'LEAVES' | 'GRADUATED';
export type SituationCounts = Record<FinalSituation | 'missing', number>;

export interface PromotionSection {
  id: string;
  label: string;
  grade: number;
  students: number;
  destination: { kind: 'SECTION' | 'GRADUATE' | 'NONE'; sectionId: string | null; label: string | null; explicit: boolean };
  counts: SituationCounts;
}

export interface PromotionTarget {
  id: string;
  level: SchoolLevel;
  grade: number;
  label: string;
}

export interface PromotionOverview {
  year: { id: string; name: string; status: 'ACTIVE' | 'CLOSED' };
  target: { id: string; name: string } | null;
  periods: { total: number; locked: number };
  closable: boolean;
  counts: SituationCounts;
  noSection: number;
  levels: Array<{ level: SchoolLevel; sections: PromotionSection[] }>;
  targets: PromotionTarget[];
  /** Ya cerrado: quienes esperan el resultado de su recuperación. */
  recovery: Array<{ studentId: string; name: string; from: string | null; target: string | null; targetLabel: string | null }>;
}

export interface PromotionStudent {
  studentId: string;
  name: string;
  situation: FinalSituation;
  /** Marcado a mano (si no, es lo de su sección). */
  explicit: boolean;
  target: string | null;
  targetLabel: string | null;
}

export interface CloseResult {
  year: string;
  target: string;
  counts: SituationCounts;
  archived: number;
}

export const promotionKeys = {
  all: (schoolId: string, yearId: string) => ['school-promotion', schoolId, yearId] as const,
  overview: (schoolId: string, yearId: string) => ['school-promotion', schoolId, yearId, 'overview'] as const,
  section: (schoolId: string, yearId: string, sectionId: string) => ['school-promotion', schoolId, yearId, 'section', sectionId] as const,
};

const base = (schoolId: string, yearId: string) => `/schools/${schoolId}/years/${yearId}`;

export const promotionApi = {
  overview: async (schoolId: string, yearId: string): Promise<PromotionOverview> =>
    (await api.get(`${base(schoolId, yearId)}/promotion`)).data.data,
  /** sectionId «sin-seccion»: los matriculados sin sección. */
  sectionStudents: async (schoolId: string, yearId: string, sectionId: string): Promise<PromotionStudent[]> =>
    (await api.get(`${base(schoolId, yearId)}/promotion/sections/${sectionId}/students`)).data.data,
  /** target: una sección del año siguiente, «GRADUATE» (egresan) o null (volver al automático). */
  setSection: async (schoolId: string, yearId: string, sectionId: string, target: string | 'GRADUATE' | null): Promise<void> => {
    await api.put(`${base(schoolId, yearId)}/promotion/sections/${sectionId}`, { target });
  },
  /** situation null: la de su sección. */
  setStudent: async (schoolId: string, yearId: string, studentId: string, situation: FinalSituation | null, targetSectionId?: string | null): Promise<PromotionStudent> =>
    (await api.put(`${base(schoolId, yearId)}/promotion/students/${studentId}`, { situation, ...(targetSectionId !== undefined ? { targetSectionId } : {}) })).data.data,
  close: async (schoolId: string, yearId: string): Promise<{ data: CloseResult; message: string }> => {
    const response = await api.post(`${base(schoolId, yearId)}/close`);
    return { data: response.data.data, message: response.data.message };
  },
};
