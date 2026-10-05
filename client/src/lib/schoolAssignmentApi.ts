import api from './api';
import type { StudentAccessInfo } from './schoolAccessApi';
import type { SchoolLevel } from './schoolYearApi';

/** Consola escolar: plan de estudios, asignaciones (sección × área → docente y clase), Mis asignaciones y mi tutoría. */

export interface PlanArea {
  areaId: string;
  name: string;
  shortName: string | null;
  grades: number[];
}

export interface PlanLevel {
  level: SchoolLevel;
  grades: number[];
  /** false: el plan del CNEB por defecto (aún no se guardó uno propio). */
  custom: boolean;
  areas: PlanArea[];
  available: Array<{ areaId: string; name: string; shortName: string | null }>;
}

export interface MatrixCounts {
  required: number;
  assigned: number;
  withoutClass: number;
  /** Estudiantes de la sección que aún no tienen perfil en la clase vinculada. */
  missing: number;
}

export interface MatrixSection {
  id: string;
  grade: number;
  name: string;
  label: string;
  tutor: { userId: string; name: string; initials: string } | null;
  students: number;
}

export interface MatrixAssignment {
  id: string;
  sectionId: string;
  areaId: string;
  teacherUserId: string;
  classroom: { id: string; name: string; archived: boolean; students: number; missing: number } | null;
}

export interface MatrixTeacher {
  userId: string;
  name: string;
  initials: string;
  role: 'OWNER' | 'ADMIN' | 'TEACHER';
  assignments: number;
  workshops: number;
  tutorOf: string[];
}

export interface AssignmentMatrix {
  levels: SchoolLevel[];
  level: SchoolLevel | null;
  plan: PlanArea[];
  sections: MatrixSection[];
  assignments: MatrixAssignment[];
  teachers: MatrixTeacher[];
  counts: MatrixCounts;
  /** Los mismos conteos para todos los niveles del año. */
  overall: MatrixCounts;
}

export type ClassroomChoice = { mode: 'create' } | { mode: 'link'; classroomId: string } | { mode: 'none' };

export interface TeacherClassroom {
  id: string;
  name: string;
  sectionId: string | null;
  areaId: string | null;
  linked: boolean;
  students: number;
}

export interface SyncResult {
  created: number;
  linked: number;
  withAccount: number;
}

export interface FromClassesPreview {
  proposals: Array<{
    classroomId: string; className: string; sectionId: string; sectionLabel: string; areaId: string; areaName: string;
    teacherUserId: string; teacherName: string; kind: 'create' | 'link';
  }>;
  skipped: Array<{ classroomId: string; className: string; sectionLabel: string; areaName: string; reason: 'two_classes' | 'out_of_plan' | 'not_member' | 'taken' }>;
  already: number;
}

export interface MyLoadAssignment {
  id: string;
  area: { id: string; name: string; shortName: string | null };
  section: { id: string; label: string; level: SchoolLevel; grade: number };
  students: number;
  classroom: { id: string; name: string; archived: boolean; students: number } | null;
  missing: number;
  arrivedToday: number;
  leftToday: number;
}

export type WorkshopMode = 'SECTION' | 'CHOSEN';

export interface Workshop {
  id: string;
  name: string;
  level: SchoolLevel;
  area: { id: string; name: string; shortName: string | null };
  teacherUserId: string;
  teacherName: string;
  mode: WorkshopMode;
  /** % de la nota del área (el resto, la clase del área). */
  weight: number;
  sections: Array<{ id: string; label: string }>;
  participants: number;
  classroom: { id: string; name: string; archived: boolean; missing: number } | null;
}

export interface WorkshopDetail extends Workshop {
  students: Array<{ id: string; firstNames: string; lastNames: string; section: string | null }>;
}

export interface WorkshopInput {
  name: string;
  level: SchoolLevel;
  areaId: string;
  teacherUserId: string;
  mode: WorkshopMode;
  sectionIds: string[];
  studentIds: string[];
  weight: number;
  classroom: ClassroomChoice;
}

export interface MyLoad {
  assignments: MyLoadAssignment[];
  workshops: Workshop[];
  tutoring: Array<{
    section: { id: string; label: string };
    students: number;
    incomplete: number;
    arrivals: Array<{ name: string; from: string | null; at: string }>;
    coverage: { required: number; assigned: number; missingAreas: string[] };
  }>;
  myClasses: TeacherClassroom[];
}

export interface TutoringSection {
  section: { id: string; label: string; tutor: string | null };
  students: Array<{ id: string; firstNames: string; lastNames: string; hasDocument: boolean; birthDate: string | null; classes: number; access: StudentAccessInfo }>;
}

export const assignmentKeys = {
  all: (schoolId: string, yearId: string) => ['school-assignments', schoolId, yearId] as const,
  plan: (schoolId: string, yearId: string) => ['school-assignments', schoolId, yearId, 'plan'] as const,
  matrix: (schoolId: string, yearId: string, level: SchoolLevel | null) => ['school-assignments', schoolId, yearId, 'matrix', level] as const,
  fromClasses: (schoolId: string, yearId: string) => ['school-assignments', schoolId, yearId, 'from-classes'] as const,
  teacherClasses: (schoolId: string, teacherId: string) => ['school-assignments', schoolId, 'teacher-classes', teacherId] as const,
  myLoad: (schoolId: string, yearId: string) => ['school-assignments', schoolId, yearId, 'my-load'] as const,
  tutoring: (schoolId: string, yearId: string, sectionId: string) => ['school-assignments', schoolId, yearId, 'tutoring', sectionId] as const,
  workshops: (schoolId: string, yearId: string, level: SchoolLevel | null) => ['school-assignments', schoolId, yearId, 'workshops', level] as const,
  workshop: (schoolId: string, yearId: string, workshopId: string) => ['school-assignments', schoolId, yearId, 'workshop', workshopId] as const,
};

const year = (schoolId: string, yearId: string) => `/schools/${schoolId}/years/${yearId}`;

export const assignmentApi = {
  getPlan: async (schoolId: string, yearId: string): Promise<{ levels: PlanLevel[] }> => (await api.get(`${year(schoolId, yearId)}/plan`)).data.data,
  savePlan: async (schoolId: string, yearId: string, level: SchoolLevel, areas: Array<{ areaId: string; grades: number[] }>): Promise<{ levels: PlanLevel[] }> =>
    (await api.put(`${year(schoolId, yearId)}/plan/${level}`, { areas })).data.data,
  matrix: async (schoolId: string, yearId: string, level?: SchoolLevel | null): Promise<AssignmentMatrix> =>
    (await api.get(`${year(schoolId, yearId)}/assignments`, { params: level ? { level } : {} })).data.data,
  teacherClassrooms: async (schoolId: string, teacherId: string): Promise<TeacherClassroom[]> =>
    (await api.get(`/schools/${schoolId}/teachers/${teacherId}/classrooms`)).data.data,
  create: async (schoolId: string, yearId: string, input: { sectionId: string; areaId: string; teacherUserId: string; classroom: ClassroomChoice }): Promise<{ id: string; sync: SyncResult; message: string }> => {
    const response = await api.post(`${year(schoolId, yearId)}/assignments`, input);
    return { ...response.data.data, message: response.data.message };
  },
  update: async (schoolId: string, assignmentId: string, patch: { teacherUserId?: string; classroom?: ClassroomChoice }): Promise<{ sync: SyncResult; message: string }> => {
    const response = await api.patch(`/schools/${schoolId}/assignments/${assignmentId}`, patch);
    return { ...response.data.data, message: response.data.message };
  },
  remove: async (schoolId: string, assignmentId: string): Promise<string> => (await api.delete(`/schools/${schoolId}/assignments/${assignmentId}`)).data.message,
  sync: async (schoolId: string, assignmentId: string): Promise<{ sync: SyncResult; message: string }> => {
    const response = await api.post(`/schools/${schoolId}/assignments/${assignmentId}/sync`);
    return { sync: response.data.data, message: response.data.message };
  },
  fromClassesPreview: async (schoolId: string, yearId: string): Promise<FromClassesPreview> => (await api.get(`${year(schoolId, yearId)}/assignments/from-classes`)).data.data,
  fromClassesConfirm: async (schoolId: string, yearId: string): Promise<{ assigned: number; sync: SyncResult; message: string }> => {
    const response = await api.post(`${year(schoolId, yearId)}/assignments/from-classes`);
    return { ...response.data.data, message: response.data.message };
  },
  myLoad: async (schoolId: string, yearId: string): Promise<MyLoad> => (await api.get(`${year(schoolId, yearId)}/my-load`)).data.data,
  setClassroom: async (schoolId: string, assignmentId: string, classroom: ClassroomChoice): Promise<{ sync: SyncResult; message: string }> => {
    const response = await api.put(`/schools/${schoolId}/assignments/${assignmentId}/classroom`, { classroom });
    return { ...response.data.data, message: response.data.message };
  },
  tutoring: async (schoolId: string, yearId: string, sectionId: string): Promise<TutoringSection> =>
    (await api.get(`${year(schoolId, yearId)}/sections/${sectionId}/tutoring`)).data.data,
  workshops: async (schoolId: string, yearId: string, level?: SchoolLevel | null): Promise<Workshop[]> =>
    (await api.get(`${year(schoolId, yearId)}/workshops`, { params: level ? { level } : {} })).data.data,
  workshop: async (schoolId: string, workshopId: string): Promise<WorkshopDetail> => (await api.get(`/schools/${schoolId}/workshops/${workshopId}`)).data.data,
  createWorkshop: async (schoolId: string, yearId: string, input: WorkshopInput): Promise<{ id: string; sync: SyncResult; message: string }> => {
    const response = await api.post(`${year(schoolId, yearId)}/workshops`, input);
    return { ...response.data.data, message: response.data.message };
  },
  updateWorkshop: async (schoolId: string, workshopId: string, patch: Partial<WorkshopInput>): Promise<{ sync: SyncResult; message: string }> => {
    const response = await api.patch(`/schools/${schoolId}/workshops/${workshopId}`, patch);
    return { ...response.data.data, message: response.data.message };
  },
  removeWorkshop: async (schoolId: string, workshopId: string): Promise<string> => (await api.delete(`/schools/${schoolId}/workshops/${workshopId}`)).data.message,
  syncWorkshop: async (schoolId: string, workshopId: string): Promise<{ sync: SyncResult; message: string }> => {
    const response = await api.post(`/schools/${schoolId}/workshops/${workshopId}/sync`);
    return { sync: response.data.data, message: response.data.message };
  },
  setWorkshopClassroom: async (schoolId: string, workshopId: string, classroom: ClassroomChoice): Promise<{ sync: SyncResult; message: string }> => {
    const response = await api.put(`/schools/${schoolId}/workshops/${workshopId}/classroom`, { classroom });
    return { ...response.data.data, message: response.data.message };
  },
};
