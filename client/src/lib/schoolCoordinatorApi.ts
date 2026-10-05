import api from './api';
import type { PerformanceBucket } from './gradeApi';
import type { SchoolLevel } from './schoolYearApi';

/**
 * Coordinadores de área: la administración nombra uno por área y nivel en el año; cada coordinador ve el panel de sus
 * áreas (participación, asistencia y avance de notas de cada clase y taller, sin datos de cada estudiante).
 */

export interface CoordinatorArea {
  areaId: string;
  name: string;
  shortName: string | null;
  /** Secciones con esa área asignada y talleres del área en el nivel. */
  sections: number;
  workshops: number;
  coordinator: { userId: string; name: string; initials: string; inTeam: boolean } | null;
}

export interface CoordinatorList {
  levels: Array<{ level: SchoolLevel; areas: CoordinatorArea[] }>;
  team: Array<{ userId: string; name: string; initials: string }>;
}

export interface MyCoordination {
  id: string;
  level: SchoolLevel;
  area: { id: string; name: string; shortName: string | null };
}

export interface CompetencyProgress {
  id: string;
  code: string;
  name: string | null;
  shortName: string | null;
  graded: number;
  distribution: Record<PerformanceBucket, number>;
  average: { score: number; label: string; bucket: PerformanceBucket } | null;
}

export interface CoordinationClass {
  kind: 'SECTION' | 'WORKSHOP';
  id: string;
  label: string;
  /** Taller: sus secciones o «Inscritos». */
  detail: string | null;
  teacher: { userId: string; name: string };
  classroom: { id: string; name: string; archived: boolean; usesGrades: boolean } | null;
  students: number;
  gamification: {
    lastActivityAt: string | null;
    xp30: number;
    xp7: number;
    positive30: number;
    negative30: number;
    badges30: number;
    top: Array<{ name: string; icon: string | null; count: number }>;
    /** Lo de la Biblioteca del área que la clase ya usa. */
    imported: { behaviors: number; badges: number };
  } | null;
  attendance: { rate: number; records: number; late: number; absent: number; days: number } | null;
  grades: {
    period: string;
    isClosed: boolean;
    scaleKind: 'letters' | 'number';
    students: number;
    competencies: CompetencyProgress[];
  } | null;
}

export interface CoordinationPanel {
  year: { id: string; name: string };
  coordinations: Array<MyCoordination & { library: { behaviors: number; badges: number }; classes: CoordinationClass[] }>;
}

export const coordinatorKeys = {
  all: (schoolId: string, yearId: string) => ['school-coordinators', schoolId, yearId] as const,
  list: (schoolId: string, yearId: string) => ['school-coordinators', schoolId, yearId, 'list'] as const,
  mine: (schoolId: string, yearId: string) => ['school-coordinators', schoolId, yearId, 'mine'] as const,
  panel: (schoolId: string, yearId: string) => ['school-coordinators', schoolId, yearId, 'panel'] as const,
};

const year = (schoolId: string, yearId: string) => `/schools/${schoolId}/years/${yearId}`;

export const coordinatorApi = {
  list: async (schoolId: string, yearId: string): Promise<CoordinatorList> => (await api.get(`${year(schoolId, yearId)}/coordinators`)).data.data,
  set: async (schoolId: string, yearId: string, input: { level: SchoolLevel; areaId: string; userId: string | null }): Promise<string> =>
    (await api.put(`${year(schoolId, yearId)}/coordinators`, input)).data.message,
  mine: async (schoolId: string, yearId: string): Promise<MyCoordination[]> => (await api.get(`${year(schoolId, yearId)}/coordinators/mine`)).data.data,
  panel: async (schoolId: string, yearId: string): Promise<CoordinationPanel> => (await api.get(`${year(schoolId, yearId)}/coordination`)).data.data,
};
