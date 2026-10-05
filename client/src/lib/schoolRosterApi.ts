import api from './api';
import type { StudentAccessInfo } from './schoolAccessApi';
import type { SchoolLevel } from './schoolYearApi';
import type { StudentSex } from './studentSex';

/** Consola escolar: padrón de estudiantes del año, ficha y documento (siempre enmascarado salvo «Mostrar»). */

export type DocumentType = 'DNI' | 'CE' | 'PTP' | 'PASAPORTE';
export type RosterFilter = 'all' | 'no_section' | 'incomplete' | 'withdrawn';
export type RevealReason = 'SIAGIE' | 'IDENTITY' | 'CORRECTION' | 'FAMILY' | 'OTHER';
export type TransferReason = 'FAMILY' | 'COEXISTENCE' | 'ACADEMIC' | 'SCHEDULE' | 'BALANCE' | 'OTHER';
export type WithdrawalReason = 'SCHOOL_CHANGE' | 'MOVING' | 'ECONOMIC' | 'HEALTH' | 'OTHER';

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
  sex: StudentSex | null;
  status: 'ACTIVE' | 'WITHDRAWN' | 'GRADUATED';
  /** Solo en un año cerrado: su situación final. */
  finalSituation?: 'PROMOTED' | 'REPEATS' | 'RECOVERY' | 'LEAVES' | 'GRADUATED' | null;
  section: RosterSection | null;
  classes: number;
}

export interface RosterPage {
  items: RosterStudent[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<RosterFilter, number>;
  /** Mujeres, hombres y sin registrar de lo que se mira (nivel, grado o sección), antes de buscar o filtrar por sexo. */
  sexCounts: { women: number; men: number; unknown: number };
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
    sex: StudentSex | null;
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
  /** Cómo entra (DNI y PIN, correo o Google, o aún sin acceso) y si tiene una tarjeta por usar. */
  access: StudentAccessInfo;
}

/** Traslado, retiro o reincorporación. La nota es interna: solo la ve la administración. */
export interface StudentMove {
  id: string;
  kind: 'TRANSFER' | 'WITHDRAWAL' | 'REINSTATEMENT';
  from: string | null;
  to: string | null;
  reason: string;
  note: string | null;
  effectiveDate: string;
  createdAt: string;
  undone: boolean;
  actor: string | null;
}

export interface StudentMoves {
  history: StudentMove[];
  /** Su último movimiento, si es un traslado: si aún se puede deshacer y, si no, por qué. */
  undo: { moveId: string; canUndo: boolean; blocked: string | null } | null;
}

/** «Qué cambia» al trasladar: clases, progreso convertido por área y lo que se mantiene. */
export interface TransferPreview {
  student: { id: string; name: string };
  from: { id: string; label: string };
  to: { id: string; label: string; tutor: string | null; students: number };
  classes: { leaving: number; entering: number };
  areas: Array<{
    areaId: string;
    areaName: string;
    from: { classroomName: string; level: number; xp: number; gp: number };
    to: { classroomName: string; level: number; xp: number; gp: number; same: boolean } | null;
  }>;
  /** Áreas sin clase en la sección nueva: su progreso espera a que se cree. */
  waiting: string[];
  workshops: { leaving: string[]; entering: string[] };
  badges: number;
  families: number;
}

export interface StudentInput {
  firstNames: string;
  lastNames: string;
  document?: { type: DocumentType; number: string } | null;
  birthDate?: string | null;
  email?: string | null;
  siagieCode?: string | null;
  sex?: StudentSex | null;
  sectionId?: string | null;
}

export interface RosterQuery {
  filter: RosterFilter;
  /** NONE = sin registrar. */
  sex?: StudentSex | 'NONE';
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
  moves: (schoolId: string, yearId: string, studentId: string) => ['school-roster', schoolId, yearId, 'moves', studentId] as const,
  transferPreview: (schoolId: string, yearId: string, studentId: string, sectionId: string) => ['school-roster', schoolId, yearId, 'transfer-preview', studentId, sectionId] as const,
};

export const schoolRosterApi = {
  list: async (schoolId: string, yearId: string, query: RosterQuery): Promise<RosterPage> => {
    const params = new URLSearchParams({ filter: query.filter, page: String(query.page) });
    if (query.level) params.set('level', query.level);
    if (query.grade) params.set('grade', String(query.grade));
    if (query.sectionId) params.set('sectionId', query.sectionId);
    if (query.q) params.set('q', query.q);
    if (query.sex) params.set('sex', query.sex);
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
  moves: async (schoolId: string, yearId: string, studentId: string): Promise<StudentMoves> => {
    const response = await api.get(`/schools/${schoolId}/years/${yearId}/students/${studentId}/moves`);
    return response.data.data;
  },
  transferPreview: async (schoolId: string, yearId: string, studentId: string, sectionId: string): Promise<TransferPreview> => {
    const response = await api.get(`/schools/${schoolId}/years/${yearId}/students/${studentId}/transfer-preview?sectionId=${encodeURIComponent(sectionId)}`);
    return response.data.data;
  },
  transfer: async (schoolId: string, yearId: string, studentId: string, input: { sectionId: string; effectiveDate: string; reason: TransferReason; note: string | null }): Promise<StudentDetail> => {
    const response = await api.post(`/schools/${schoolId}/years/${yearId}/students/${studentId}/transfer`, input);
    return response.data.data;
  },
  undoTransfer: async (schoolId: string, yearId: string, studentId: string, moveId: string): Promise<StudentDetail> => {
    const response = await api.post(`/schools/${schoolId}/years/${yearId}/students/${studentId}/transfer/undo`, { moveId });
    return response.data.data;
  },
  withdraw: async (schoolId: string, yearId: string, studentId: string, input: { effectiveDate: string; reason: WithdrawalReason; note: string | null }): Promise<StudentDetail> => {
    const response = await api.post(`/schools/${schoolId}/years/${yearId}/students/${studentId}/withdraw`, input);
    return response.data.data;
  },
  reinstate: async (schoolId: string, yearId: string, studentId: string, input: { sectionId: string | null; effectiveDate: string; note: string | null }): Promise<StudentDetail> => {
    const response = await api.post(`/schools/${schoolId}/years/${yearId}/students/${studentId}/reinstate`, input);
    return response.data.data;
  },
  /** Devuelve el número en claro: no se guarda en la caché de consultas. */
  revealDocument: async (schoolId: string, studentId: string, reason: RevealReason): Promise<{ type: DocumentType; document: string }> => {
    const response = await api.post(`/schools/${schoolId}/students/${studentId}/document/reveal`, { reason });
    return response.data.data;
  },
};
