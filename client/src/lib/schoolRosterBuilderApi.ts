import api from './api';
import type { SchoolLevel } from './schoolYearApi';

/** Consola escolar: armar el padrón desde las clases (mapear, revisar uniones, confirmar). */

export interface NameSplit {
  lastNames: string[];
  firstNames: string[];
}

export interface BuilderClass {
  id: string;
  name: string;
  teacher: string | null;
  area: string | null;
  students: number;
  linked: number;
  /** Sección ya enlazada (de un armado anterior). */
  current: string | null;
  suggestion: string | null;
}

export interface BuilderProfile {
  id: string;
  displayName: string;
  classroomId: string;
  classroomName: string;
  teacher: string | null;
  xp: number;
}

export interface BuilderGroup {
  key: string;
  kind: 'SAFE' | 'PROBABLE' | 'REVIEW';
  sectionId: string;
  sectionLabel: string;
  why: string;
  profiles: BuilderProfile[];
  anchor?: { studentId: string; name: string };
  name: NameSplit;
  parts?: Array<{ profileIds: string[]; anchorStudentId?: string }>;
  people?: Array<{ anchorProfileIds: string[]; anchorStudentId?: string; name: NameSplit }>;
  loose?: string[];
}

export type NameStrings = { lastNames: string; firstNames: string };
export type BuilderDecision =
  | { kind: 'SAFE'; name?: NameStrings }
  | { kind: 'PROBABLE'; action: 'merge' | 'split'; name?: NameStrings }
  | { kind: 'REVIEW'; assignments: Record<string, number | 'new'>; names?: Record<string, NameStrings> };

export type Mapping = Record<string, { sectionId: string | null }>;

export interface BuilderOverview {
  sections: Array<{ id: string; level: SchoolLevel; grade: number; name: string }>;
  classes: BuilderClass[];
  draft: { mapping: Mapping; decisions: Record<string, BuilderDecision>; updatedAt: string | null };
}

export interface BuilderProposal {
  groups: BuilderGroup[];
  counts: { safe: number; probable: number; review: number; profiles: number; skipped: number };
  decisions: Record<string, BuilderDecision>;
}

export const rosterBuilderKeys = {
  overview: (schoolId: string, yearId: string) => ['roster-builder', schoolId, yearId, 'overview'] as const,
  proposal: (schoolId: string, yearId: string) => ['roster-builder', schoolId, yearId, 'proposal'] as const,
};

const base = (schoolId: string, yearId: string) => `/schools/${schoolId}/years/${yearId}/roster-builder`;

export const rosterBuilderApi = {
  overview: async (schoolId: string, yearId: string): Promise<BuilderOverview> => (await api.get(base(schoolId, yearId))).data.data,
  saveMapping: async (schoolId: string, yearId: string, mapping: Mapping): Promise<void> => {
    await api.put(`${base(schoolId, yearId)}/mapping`, { mapping });
  },
  proposal: async (schoolId: string, yearId: string): Promise<BuilderProposal> => (await api.get(`${base(schoolId, yearId)}/proposal`)).data.data,
  saveDecisions: async (schoolId: string, yearId: string, decisions: Record<string, BuilderDecision>): Promise<void> => {
    await api.put(`${base(schoolId, yearId)}/decisions`, { decisions });
  },
  confirm: async (schoolId: string, yearId: string): Promise<{ created: number; linked: number; message: string }> => {
    const response = await api.post(`${base(schoolId, yearId)}/confirm`);
    return { ...response.data.data, message: response.data.message };
  },
};
