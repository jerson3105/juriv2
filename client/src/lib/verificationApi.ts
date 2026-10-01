import api from './api';

export type TeacherStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED';

export interface TeacherStatusInfo {
  status: TeacherStatus;
  via: 'LEGACY' | 'ADMIN' | 'SCHOOL' | 'DOMAIN' | null;
  note: string | null;
  requestedAt: string | null;
}

export interface TeacherToVerify {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  provider: 'LOCAL' | 'GOOGLE';
  status: TeacherStatus;
  note: string | null;
  requestedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  classes: number;
  students: number;
}

export interface VerifiedDomain {
  id: string;
  domain: string;
  note: string | null;
  schoolId: string | null;
  schoolName: string | null;
  createdAt: string;
}

export interface FamilyRequest {
  linkId: string;
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  relationship: string;
  studentName: string | null;
  studentCharacterName: string | null;
  classroomId: string;
  classroomName: string;
  createdAt: string;
}

export interface PendingChildLink {
  linkId: string;
  studentName: string | null;
  classroomName: string;
  createdAt: string;
}

export const verificationApi = {
  // Docente
  getMyStatus: async (): Promise<TeacherStatusInfo> => (await api.get('/auth/teacher-status')).data.data,
  requestReview: async (note: string): Promise<TeacherStatusInfo> =>
    (await api.post('/auth/teacher-status/request', { note })).data.data,

  // Docente: familias que esperan aprobación
  getFamilyRequests: async (): Promise<FamilyRequest[]> => (await api.get('/parent/pending-approvals')).data.data,
  approveFamily: async (linkId: string) => api.post(`/parent/links/${linkId}/approve`),
  rejectFamily: async (linkId: string) => api.post(`/parent/links/${linkId}/reject`),

  // Familia: sus solicitudes pendientes
  getMyPendingLinks: async (): Promise<PendingChildLink[]> => (await api.get('/parent/pending-links')).data.data,

  // Admin
  listTeachers: async (status: 'PENDING' | 'UNVERIFIED'): Promise<TeacherToVerify[]> =>
    (await api.get('/admin/teacher-verifications', { params: { status } })).data.data,
  reviewTeacher: async (userId: string, approved: boolean, reason?: string) =>
    api.post(`/admin/teacher-verifications/${userId}`, { approved, ...(reason ? { reason } : {}) }),
  listDomains: async (): Promise<VerifiedDomain[]> => (await api.get('/admin/verified-domains')).data.data,
  addDomain: async (domain: string, note?: string): Promise<{ verified: number }> =>
    (await api.post('/admin/verified-domains', { domain, ...(note ? { note } : {}) })).data.data,
  removeDomain: async (id: string) => api.delete(`/admin/verified-domains/${id}`),
};
