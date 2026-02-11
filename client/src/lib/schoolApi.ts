import api from './api';

export interface School {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string;
  googlePlaceId: string | null;
  latitude: string | null;
  longitude: string | null;
  logoUrl: string | null;
  isVerified: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolSearchResult {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string;
  logoUrl: string | null;
  isVerified: boolean;
  memberCount: number;
}

export interface MySchool {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string;
  logoUrl: string | null;
  isVerified: boolean;
  memberId: string;
  memberRole: 'OWNER' | 'TEACHER';
  memberStatus: 'PENDING_ADMIN' | 'PENDING_OWNER' | 'VERIFIED' | 'REJECTED';
  rejectionReason: string | null;
  memberCount: number;
  classroomCount: number;
  pendingRequestCount: number;
}

export interface SchoolMember {
  id: string;
  userId: string;
  role: 'OWNER' | 'TEACHER';
  status: 'PENDING_ADMIN' | 'PENDING_OWNER' | 'VERIFIED' | 'REJECTED';
  joinedAt: string | null;
  createdAt: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface SchoolClassroom {
  id: string;
  name: string;
  code: string;
  gradeLevel: string | null;
  curriculumAreaId: string | null;
  curriculumAreaName: string | null;
  studentCount: number;
}

export interface SchoolDetail extends School {
  members: SchoolMember[];
  classrooms: SchoolClassroom[];
}

export interface PendingVerification {
  id: string;
  schoolId: string;
  userId: string;
  position: string;
  documentUrls: string[];
  details: string | null;
  status: string;
  createdAt: string;
  schoolName: string;
  schoolAddress: string | null;
  schoolCity: string | null;
  schoolCountry: string;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
}

export interface AdminSchoolWithMembers {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  members: SchoolMember[];
}

export interface SchoolTeacherClassroom {
  id: string;
  name: string;
  code: string;
  gradeLevel: string | null;
  teacherId: string;
  useCompetencies: boolean;
  curriculumAreaId: string | null;
  studentCount: number;
  createdAt: string;
}

export interface SchoolTeacher {
  id: string;
  userId: string;
  role: 'OWNER' | 'TEACHER';
  status: string;
  joinedAt: string | null;
  createdAt: string;
  firstName: string;
  lastName: string;
  email: string;
  classrooms: SchoolTeacherClassroom[];
}

export interface SchoolBehavior {
  id: string;
  schoolId: string;
  name: string;
  description: string | null;
  pointType: 'XP' | 'HP' | 'GP';
  pointValue: number;
  xpValue: number;
  hpValue: number;
  gpValue: number;
  icon: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSchoolBehaviorData {
  name: string;
  description?: string;
  pointType: 'XP' | 'HP' | 'GP';
  pointValue: number;
  xpValue?: number;
  hpValue?: number;
  gpValue?: number;
  icon?: string;
}

export interface SchoolBadge {
  id: string;
  schoolId: string;
  name: string;
  description: string;
  icon: string;
  customImage: string | null;
  category: 'PROGRESS' | 'PARTICIPATION' | 'SOCIAL' | 'SHOP' | 'SPECIAL' | 'SECRET' | 'CUSTOM';
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  assignmentMode: 'AUTOMATIC' | 'MANUAL' | 'BOTH';
  unlockCondition: any;
  rewardXp: number;
  rewardGp: number;
  isSecret: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSchoolBadgeData {
  name: string;
  description: string;
  icon: string;
  customImage?: string;
  category?: SchoolBadge['category'];
  rarity?: SchoolBadge['rarity'];
  assignmentMode: SchoolBadge['assignmentMode'];
  unlockCondition?: any;
  rewardXp?: number;
  rewardGp?: number;
  isSecret?: boolean;
}

export interface CreateSchoolData {
  name: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  googlePlaceId?: string;
  latitude?: string;
  longitude?: string;
}

export interface CreateVerificationData {
  schoolId: string;
  position: string;
  documentUrls?: string[];
  details?: string;
}

// ==================== REPORTES ====================

export interface ReportSummary {
  totalStudents: number;
  totalClasses: number;
  avgXp: number;
  avgHp: number;
  avgGp: number;
  totalPositivePoints: number;
  totalNegativePoints: number;
  attendanceRate: number;
}

export interface BehaviorTrendPoint {
  date: string;
  positive: number;
  negative: number;
  positiveCount: number;
  negativeCount: number;
}

export interface ClassRankingItem {
  classroomId: string;
  name: string;
  gradeLevel: string | null;
  curriculumAreaName: string | null;
  studentCount: number;
  avgXp: number;
  positivePoints: number;
  negativePoints: number;
  attendanceRate: number;
}

export interface TopBehaviorItem {
  id: string;
  name: string;
  icon: string | null;
  usageCount: number;
  totalPoints: number;
}

export interface TopBehaviorsData {
  positive: TopBehaviorItem[];
  negative: TopBehaviorItem[];
}

export interface StudentAtRisk {
  studentId: string;
  displayName: string;
  classroomId: string;
  classroomName: string;
  hp: number;
  hpPercentage: number;
  xp: number;
  level: number;
  negativePoints: number;
  negativeCount: number;
  attendanceRate: number;
  risks: string[];
}

export interface AttendanceByClass {
  classroomId: string;
  name: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
}

export interface AttendanceWeekly {
  week: string;
  weekStart: string;
  total: number;
  present: number;
  rate: number;
}

export interface AttendanceReport {
  byClass: AttendanceByClass[];
  weekly: AttendanceWeekly[];
}

export const schoolApi = {
  // Buscar escuelas existentes
  search: async (query: string): Promise<SchoolSearchResult[]> => {
    const response = await api.get(`/schools/search?q=${encodeURIComponent(query)}`);
    return response.data.data;
  },

  // Mis escuelas
  getMySchools: async (): Promise<MySchool[]> => {
    const response = await api.get('/schools/my-schools');
    return response.data.data;
  },

  // Crear escuela
  create: async (data: CreateSchoolData): Promise<School> => {
    const response = await api.post('/schools', data);
    return response.data.data;
  },

  // Solicitar unirse
  requestJoin: async (schoolId: string): Promise<{ id: string; status: string }> => {
    const response = await api.post(`/schools/${schoolId}/join`);
    return response.data.data;
  },

  // Detalle de escuela
  getDetail: async (schoolId: string): Promise<SchoolDetail> => {
    const response = await api.get(`/schools/${schoolId}`);
    return response.data.data;
  },

  // Solicitudes pendientes (owner)
  getPendingRequests: async (schoolId: string): Promise<SchoolMember[]> => {
    const response = await api.get(`/schools/${schoolId}/pending-requests`);
    return response.data.data;
  },

  // Revisar solicitud de unión
  reviewJoinRequest: async (memberId: string, approved: boolean, reason?: string): Promise<void> => {
    await api.patch(`/schools/members/${memberId}/review`, { approved, reason });
  },

  // Cancelar solicitud de unión
  cancelJoinRequest: async (memberId: string): Promise<void> => {
    await api.delete(`/schools/members/${memberId}/cancel`);
  },

  // Profesores de la escuela con sus clases
  getSchoolTeachers: async (schoolId: string): Promise<SchoolTeacher[]> => {
    const response = await api.get(`/schools/${schoolId}/teachers`);
    return response.data.data;
  },

  // ==================== COMPORTAMIENTOS DE ESCUELA ====================

  // Obtener comportamientos de escuela
  getSchoolBehaviors: async (schoolId: string): Promise<SchoolBehavior[]> => {
    const response = await api.get(`/schools/${schoolId}/behaviors`);
    return response.data.data;
  },

  // Crear comportamiento de escuela
  createSchoolBehavior: async (schoolId: string, data: CreateSchoolBehaviorData): Promise<SchoolBehavior> => {
    const response = await api.post(`/schools/${schoolId}/behaviors`, data);
    return response.data.data;
  },

  // Actualizar comportamiento de escuela
  updateSchoolBehavior: async (behaviorId: string, data: Partial<CreateSchoolBehaviorData>): Promise<SchoolBehavior> => {
    const response = await api.patch(`/schools/behaviors/${behaviorId}`, data);
    return response.data.data;
  },

  // Eliminar comportamiento de escuela
  deleteSchoolBehavior: async (behaviorId: string): Promise<void> => {
    await api.delete(`/schools/behaviors/${behaviorId}`);
  },

  // Importar comportamientos a clases
  importBehaviors: async (schoolId: string, behaviorIds: string[], classroomIds: string[]): Promise<{ imported: number; classrooms: number; behaviors: number }> => {
    const response = await api.post(`/schools/${schoolId}/behaviors/import`, { behaviorIds, classroomIds });
    return response.data.data;
  },

  // ==================== INSIGNIAS DE ESCUELA ====================

  // Obtener insignias de escuela
  getSchoolBadges: async (schoolId: string): Promise<SchoolBadge[]> => {
    const response = await api.get(`/schools/${schoolId}/badges`);
    return response.data.data;
  },

  // Crear insignia de escuela
  createSchoolBadge: async (schoolId: string, data: CreateSchoolBadgeData): Promise<SchoolBadge> => {
    const response = await api.post(`/schools/${schoolId}/badges`, data);
    return response.data.data;
  },

  // Actualizar insignia de escuela
  updateSchoolBadge: async (badgeId: string, data: Partial<CreateSchoolBadgeData>): Promise<SchoolBadge> => {
    const response = await api.patch(`/schools/badges/${badgeId}`, data);
    return response.data.data;
  },

  // Eliminar insignia de escuela
  deleteSchoolBadge: async (badgeId: string): Promise<void> => {
    await api.delete(`/schools/badges/${badgeId}`);
  },

  // Importar insignias a clases
  importBadges: async (schoolId: string, badgeIds: string[], classroomIds: string[]): Promise<{ imported: number; classrooms: number; badges: number }> => {
    const response = await api.post(`/schools/${schoolId}/badges/import`, { badgeIds, classroomIds });
    return response.data.data;
  },

  // Asignar clase a escuela
  assignClassroom: async (schoolId: string, classroomId: string): Promise<void> => {
    await api.post(`/schools/${schoolId}/classrooms/${classroomId}`);
  },

  // Desasignar clase
  unassignClassroom: async (classroomId: string): Promise<void> => {
    await api.delete(`/schools/classrooms/${classroomId}`);
  },

  // Enviar verificación
  createVerification: async (data: CreateVerificationData): Promise<{ id: string; status: string }> => {
    const response = await api.post('/schools/verifications', data);
    return response.data.data;
  },

  // ==================== ADMIN ====================

  // Verificaciones pendientes
  getAdminPendingVerifications: async (): Promise<PendingVerification[]> => {
    const response = await api.get('/schools/admin/verifications');
    return response.data.data;
  },

  // Revisar verificación
  reviewVerification: async (verificationId: string, approved: boolean, note?: string): Promise<void> => {
    await api.patch(`/schools/admin/verifications/${verificationId}`, { approved, note });
  },

  // Todas las escuelas
  getAllSchools: async (): Promise<any[]> => {
    const response = await api.get('/schools/admin/all');
    return response.data.data;
  },

  // Todas las escuelas con miembros (admin)
  getAllSchoolsWithMembers: async (): Promise<AdminSchoolWithMembers[]> => {
    const response = await api.get('/schools/admin/schools-with-members');
    return response.data.data;
  },

  // ==================== REPORTES ====================

  getReportSummary: async (schoolId: string, startDate: string, endDate: string): Promise<ReportSummary> => {
    const response = await api.get(`/schools/${schoolId}/reports/summary`, { params: { startDate, endDate } });
    return response.data.data;
  },

  getBehaviorTrends: async (schoolId: string, startDate: string, endDate: string, classroomId?: string): Promise<BehaviorTrendPoint[]> => {
    const response = await api.get(`/schools/${schoolId}/reports/behavior-trends`, { params: { startDate, endDate, classroomId } });
    return response.data.data;
  },

  getClassRanking: async (schoolId: string, startDate: string, endDate: string): Promise<ClassRankingItem[]> => {
    const response = await api.get(`/schools/${schoolId}/reports/class-ranking`, { params: { startDate, endDate } });
    return response.data.data;
  },

  getTopBehaviors: async (schoolId: string, startDate: string, endDate: string): Promise<TopBehaviorsData> => {
    const response = await api.get(`/schools/${schoolId}/reports/top-behaviors`, { params: { startDate, endDate } });
    return response.data.data;
  },

  getStudentsAtRisk: async (schoolId: string, startDate: string, endDate: string): Promise<StudentAtRisk[]> => {
    const response = await api.get(`/schools/${schoolId}/reports/students-at-risk`, { params: { startDate, endDate } });
    return response.data.data;
  },

  getAttendanceReport: async (schoolId: string, startDate: string, endDate: string): Promise<AttendanceReport> => {
    const response = await api.get(`/schools/${schoolId}/reports/attendance`, { params: { startDate, endDate } });
    return response.data.data;
  },
};
