import api from './api';
import type { SchoolLevel } from './schoolYearApi';

/** Consola escolar: padrón de estudiantes del año, ficha y documento (siempre enmascarado salvo «Mostrar»). */

export type DocumentType = 'DNI' | 'CE' | 'PTP' | 'PASAPORTE';
export type RosterFilter = 'all' | 'no_section' | 'incomplete' | 'withdrawn';
export type RevealReason = 'SIAGIE' | 'IDENTITY' | 'CORRECTION' | 'FAMILY' | 'OTHER';

export interface RosterSection {
  id: string;
  level: SchoolLevel;
  grade: number;
  name: string;
}

export interface RosterStudent {
  id: string;
  firstNames: string;
  lastNames: string;
  documentType: DocumentType | null;
  documentHint: string | null;
  hasDocument: boolean;
  birthDate: string | null;
  email: string | null;
  status: 'ACTIVE' | 'WITHDRAWN';
  section: RosterSection | null;
  classes: number;
}

export interface RosterPage {
  items: RosterStudent[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<RosterFilter, number>;
  /** El servidor tiene las llaves para guardar documentos. */
  piiReady: boolean;
}

export interface StudentDetail {
  student: {
    id: string;
    firstNames: string;
    lastNames: string;
    documentType: DocumentType | null;
    documentHint: string | null;
    hasDocument: boolean;
    birthDate: string | null;
    email: string | null;
    siagieCode: string | null;
    status: 'ACTIVE' | 'WITHDRAWN';
    hasAccount: boolean;
  };
  enrollment: { status: 'ACTIVE' | 'WITHDRAWN'; section: RosterSection | null; tutor: string | null } | null;
  events: Array<{
    id: string;
    type: 'ENROLLED' | 'BUILT_FROM_CLASSES' | 'DATA_UPDATED' | 'SECTION_CHANGED' | 'WITHDRAWN' | 'REINSTATED';
    from: string | null;
    to: string | null;
    metadata: Record<string, string | number | boolean | null> | null;
    createdAt: string;
    actor: string | null;
  }>;
  classes: Array<{ profileId: string; classroomId: string; classroomName: string; isActive: boolean; xp: number; level: number; teacher: string | null }>;
  years: Array<{ yearId: string; name: string; status: 'ACTIVE' | 'WITHDRAWN'; hasSection: boolean }>;
}

export interface StudentInput {
  firstNames: string;
  lastNames: string;
  document?: { type: DocumentType; number: string } | null;
  birthDate?: string | null;
  email?: string | null;
  siagieCode?: string | null;
  sectionId?: string | null;
}

export interface RosterQuery {
  filter: RosterFilter;
  level?: SchoolLevel;
  grade?: number;
  sectionId?: string;
  q?: string;
  page: number;
}

export const schoolRosterKeys = {
  all: (schoolId: string, yearId: string) => ['school-roster', schoolId, yearId] as const,
  list: (schoolId: string, yearId: string, query: RosterQuery) => ['school-roster', schoolId, yearId, 'list', query] as const,
  detail: (schoolId: string, yearId: string, studentId: string) => ['school-roster', schoolId, yearId, 'detail', studentId] as const,
};

export const schoolRosterApi = {
  list: async (schoolId: string, yearId: string, query: RosterQuery): Promise<RosterPage> => {
    const params = new URLSearchParams({ filter: query.filter, page: String(query.page) });
    if (query.level) params.set('level', query.level);
    if (query.grade) params.set('grade', String(query.grade));
    if (query.sectionId) params.set('sectionId', query.sectionId);
    if (query.q) params.set('q', query.q);
    const response = await api.get(`/schools/${schoolId}/years/${yearId}/students?${params.toString()}`);
    return response.data.data;
  },
  get: async (schoolId: string, yearId: string, studentId: string): Promise<StudentDetail> => {
    const response = await api.get(`/schools/${schoolId}/years/${yearId}/students/${studentId}`);
    return response.data.data;
  },
  create: async (schoolId: string, yearId: string, input: StudentInput): Promise<StudentDetail> => {
    const response = await api.post(`/schools/${schoolId}/years/${yearId}/students`, input);
    return response.data.data;
  },
  update: async (schoolId: string, yearId: string, studentId: string, patch: Partial<StudentInput>): Promise<StudentDetail> => {
    const response = await api.patch(`/schools/${schoolId}/years/${yearId}/students/${studentId}`, patch);
    return response.data.data;
  },
  /** Devuelve el número en claro: no se guarda en la caché de consultas. */
  revealDocument: async (schoolId: string, studentId: string, reason: RevealReason): Promise<{ type: DocumentType; document: string }> => {
    const response = await api.post(`/schools/${schoolId}/students/${studentId}/document/reveal`, { reason });
    return response.data.data;
  },
};
