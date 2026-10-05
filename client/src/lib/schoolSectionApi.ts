import api from './api';
import type { SchoolLevel } from './schoolYearApi';

/** Consola escolar: grados y secciones del año, con turno y tutoría. */

export type SchoolShift = 'MORNING' | 'AFTERNOON';

export interface SchoolSection {
  id: string;
  level: SchoolLevel;
  grade: number;
  name: string;
  shift: SchoolShift;
  tutor: { userId: string; firstName: string; lastName: string } | null;
  /** Estudiantes activos de la sección (mujeres y hombres; el resto, sin registrar). */
  students?: { total: number; women: number; men: number };
}

export interface SectionItem {
  level: SchoolLevel;
  grade: number;
  name: string;
}

export const schoolSectionKeys = {
  list: (schoolId: string, yearId: string) => ['school-sections', schoolId, yearId] as const,
};

export const schoolSectionApi = {
  list: async (schoolId: string, yearId: string): Promise<SchoolSection[]> => {
    const response = await api.get(`/schools/${schoolId}/years/${yearId}/sections`);
    return response.data.data;
  },
  createMany: async (schoolId: string, yearId: string, items: SectionItem[]): Promise<{ created: SchoolSection[]; skipped: SectionItem[]; message: string }> => {
    const response = await api.post(`/schools/${schoolId}/years/${yearId}/sections`, { items });
    return { ...response.data.data, message: response.data.message };
  },
  update: async (schoolId: string, sectionId: string, patch: { name?: string; shift?: SchoolShift; tutorUserId?: string | null }): Promise<SchoolSection> => {
    const response = await api.patch(`/schools/${schoolId}/sections/${sectionId}`, patch);
    return response.data.data;
  },
  remove: async (schoolId: string, sectionId: string): Promise<string> => {
    const response = await api.delete(`/schools/${schoolId}/sections/${sectionId}`);
    return response.data.message;
  },
};
