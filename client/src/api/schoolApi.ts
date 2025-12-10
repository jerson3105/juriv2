import api from '../lib/api';

// ==================== TIPOS ====================

export interface School {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  maxTeachers: number;
  maxStudentsPerClass: number;
  createdAt: string;
  updatedAt: string;
  stats?: {
    members: number;
    classrooms: number;
    students: number;
  };
  userRole?: 'OWNER' | 'ADMIN' | 'TEACHER';
  canCreateClasses?: boolean;
  canManageStudents?: boolean;
}

export interface SchoolMember {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'TEACHER';
  canCreateClasses: boolean;
  canManageStudents: boolean;
  isActive: boolean;
  joinedAt: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

export interface SchoolClassroom {
  id: string;
  name: string;
  description?: string;
  code: string;
  teacherId: string;
  schoolId: string;
  gradeLevel?: string;
  isActive: boolean;
  studentCount: number;
  teacher?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
  };
  createdAt: string;
}

export interface SchoolBehavior {
  id: string;
  schoolId: string;
  name: string;
  description?: string;
  icon: string;
  isPositive: boolean;
  xpValue: number;
  hpValue: number;
  gpValue: number;
  isActive: boolean;
  createdAt: string;
}

export interface SchoolBadge {
  id: string;
  schoolId: string;
  name: string;
  description: string;
  icon: string;
  customImage?: string;
  category: 'PROGRESS' | 'PARTICIPATION' | 'SOCIAL' | 'SPECIAL' | 'CUSTOM';
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  xpReward: number;
  gpReward: number;
  isActive: boolean;
  createdAt: string;
}

export interface UserSchool {
  schoolId: string;
  role: 'OWNER' | 'ADMIN' | 'TEACHER';
  canCreateClasses: boolean;
  canManageStudents: boolean;
  schoolName: string;
  schoolSlug: string;
  schoolLogo?: string;
  isActive: boolean;
}

// ==================== ESCUELAS ====================

export const getMySchools = async (): Promise<UserSchool[]> => {
  const response = await api.get('/schools/my-schools');
  return response.data;
};

export const createSchool = async (data: {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<School> => {
  const response = await api.post('/schools', data);
  return response.data;
};

export const getSchool = async (id: string): Promise<School> => {
  const response = await api.get(`/schools/${id}`);
  return response.data;
};

export const updateSchool = async (id: string, data: Partial<{
  name: string;
  description: string;
  logoUrl: string;
  email: string;
  phone: string;
  address: string;
  maxTeachers: number;
  maxStudentsPerClass: number;
  isActive: boolean;
}>): Promise<School> => {
  const response = await api.put(`/schools/${id}`, data);
  return response.data;
};

export const deleteSchool = async (id: string): Promise<void> => {
  await api.delete(`/schools/${id}`);
};

// ==================== MIEMBROS ====================

export const getSchoolMembers = async (schoolId: string): Promise<SchoolMember[]> => {
  const response = await api.get(`/schools/${schoolId}/members`);
  return response.data;
};

export const addSchoolMember = async (schoolId: string, data: {
  email: string;
  firstName: string;
  lastName: string;
  role?: 'ADMIN' | 'TEACHER';
  password?: string;
  canCreateClasses?: boolean;
  canManageStudents?: boolean;
}): Promise<SchoolMember> => {
  const response = await api.post(`/schools/${schoolId}/members`, data);
  return response.data;
};

export const updateSchoolMember = async (schoolId: string, memberId: string, data: {
  role?: 'ADMIN' | 'TEACHER';
  canCreateClasses?: boolean;
  canManageStudents?: boolean;
  isActive?: boolean;
}): Promise<void> => {
  await api.put(`/schools/${schoolId}/members/${memberId}`, data);
};

export const removeSchoolMember = async (schoolId: string, memberId: string): Promise<void> => {
  await api.delete(`/schools/${schoolId}/members/${memberId}`);
};

// ==================== CLASES ====================

export const getSchoolClassrooms = async (schoolId: string): Promise<SchoolClassroom[]> => {
  const response = await api.get(`/schools/${schoolId}/classrooms`);
  return response.data;
};

export const createSchoolClassroom = async (schoolId: string, data: {
  name: string;
  description?: string;
  teacherId: string;
  gradeLevel?: string;
}): Promise<SchoolClassroom> => {
  const response = await api.post(`/schools/${schoolId}/classrooms`, data);
  return response.data;
};

export const assignTeacherToClassroom = async (
  schoolId: string, 
  classroomId: string, 
  teacherId: string
): Promise<void> => {
  await api.put(`/schools/${schoolId}/classrooms/${classroomId}/teacher`, { teacherId });
};

export const updateSchoolClassroom = async (
  schoolId: string,
  classroomId: string,
  data: {
    name?: string;
    description?: string;
    teacherId?: string;
    gradeLevel?: string | null;
  }
): Promise<SchoolClassroom> => {
  const response = await api.put(`/schools/${schoolId}/classrooms/${classroomId}`, data);
  return response.data;
};

export const deleteSchoolClassroom = async (
  schoolId: string,
  classroomId: string
): Promise<void> => {
  await api.delete(`/schools/${schoolId}/classrooms/${classroomId}`);
};

// ==================== ESTUDIANTES ====================

export interface SchoolStudent {
  id: string;
  classroomId: string;
  displayName: string;
  characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
  avatarGender: 'MALE' | 'FEMALE';
  xp: number;
  hp: number;
  gp: number;
  level: number;
  linkCode?: string;
  isActive: boolean;
  createdAt: string;
  classroom?: {
    id: string;
    name: string;
  };
}

export const getSchoolStudents = async (schoolId: string): Promise<SchoolStudent[]> => {
  const response = await api.get(`/schools/${schoolId}/students`);
  return response.data;
};

export const createSchoolStudent = async (schoolId: string, data: {
  classroomId: string;
  displayName: string;
  characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
  avatarGender?: 'MALE' | 'FEMALE';
}): Promise<SchoolStudent> => {
  const response = await api.post(`/schools/${schoolId}/students`, data);
  return response.data;
};

export const bulkCreateSchoolStudents = async (schoolId: string, data: {
  classroomId: string;
  students: Array<{
    displayName: string;
    characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
    avatarGender?: 'MALE' | 'FEMALE';
  }>;
}): Promise<SchoolStudent[]> => {
  const response = await api.post(`/schools/${schoolId}/students/bulk`, data);
  return response.data;
};

export const updateSchoolStudent = async (
  schoolId: string,
  studentId: string,
  data: Partial<{
    displayName: string;
    characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
    avatarGender: 'MALE' | 'FEMALE';
    isActive: boolean;
  }>
): Promise<SchoolStudent> => {
  const response = await api.put(`/schools/${schoolId}/students/${studentId}`, data);
  return response.data;
};

export const assignStudentToClassroom = async (
  schoolId: string,
  studentId: string,
  classroomId: string
): Promise<SchoolStudent> => {
  const response = await api.put(`/schools/${schoolId}/students/${studentId}/assign`, { classroomId });
  return response.data;
};

export const deleteSchoolStudent = async (schoolId: string, studentId: string): Promise<void> => {
  await api.delete(`/schools/${schoolId}/students/${studentId}`);
};

// ==================== COMPORTAMIENTOS ====================

export const getSchoolBehaviors = async (schoolId: string): Promise<SchoolBehavior[]> => {
  const response = await api.get(`/schools/${schoolId}/behaviors`);
  return response.data;
};

export const createSchoolBehavior = async (schoolId: string, data: {
  name: string;
  description?: string;
  icon?: string;
  isPositive: boolean;
  xpValue: number;
  hpValue: number;
  gpValue: number;
}): Promise<SchoolBehavior> => {
  const response = await api.post(`/schools/${schoolId}/behaviors`, data);
  return response.data;
};

export const updateSchoolBehavior = async (
  schoolId: string, 
  behaviorId: string, 
  data: Partial<{
    name: string;
    description: string;
    icon: string;
    isPositive: boolean;
    xpValue: number;
    hpValue: number;
    gpValue: number;
    isActive: boolean;
  }>
): Promise<void> => {
  await api.put(`/schools/${schoolId}/behaviors/${behaviorId}`, data);
};

export const deleteSchoolBehavior = async (schoolId: string, behaviorId: string): Promise<void> => {
  await api.delete(`/schools/${schoolId}/behaviors/${behaviorId}`);
};

// ==================== INSIGNIAS ====================

export const getSchoolBadges = async (schoolId: string): Promise<SchoolBadge[]> => {
  const response = await api.get(`/schools/${schoolId}/badges`);
  return response.data;
};

export const createSchoolBadge = async (schoolId: string, data: {
  name: string;
  description: string;
  icon: string;
  customImage?: string;
  category: 'PROGRESS' | 'PARTICIPATION' | 'SOCIAL' | 'SPECIAL' | 'CUSTOM';
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  xpReward?: number;
  gpReward?: number;
}): Promise<SchoolBadge> => {
  const response = await api.post(`/schools/${schoolId}/badges`, data);
  return response.data;
};

export const updateSchoolBadge = async (
  schoolId: string, 
  badgeId: string, 
  data: Partial<{
    name: string;
    description: string;
    icon: string;
    customImage: string;
    category: 'PROGRESS' | 'PARTICIPATION' | 'SOCIAL' | 'SPECIAL' | 'CUSTOM';
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    xpReward: number;
    gpReward: number;
    isActive: boolean;
  }>
): Promise<void> => {
  await api.put(`/schools/${schoolId}/badges/${badgeId}`, data);
};

export const deleteSchoolBadge = async (schoolId: string, badgeId: string): Promise<void> => {
  await api.delete(`/schools/${schoolId}/badges/${badgeId}`);
};

// ==================== GRADOS Y SECCIONES ====================

export interface SchoolSection {
  id: string;
  gradeId: string;
  name: string;
  isActive: boolean;
  studentCount?: number;
}

export interface SchoolGrade {
  id: string;
  schoolId: string;
  name: string;
  level: number;
  isActive: boolean;
  sections: SchoolSection[];
}

export const getSchoolGrades = async (schoolId: string): Promise<SchoolGrade[]> => {
  const response = await api.get(`/schools/${schoolId}/grades`);
  return response.data;
};

export const createSchoolGrade = async (schoolId: string, data: {
  name: string;
  level: number;
}): Promise<SchoolGrade> => {
  const response = await api.post(`/schools/${schoolId}/grades`, data);
  return response.data;
};

export const updateSchoolGrade = async (
  schoolId: string,
  gradeId: string,
  data: Partial<{ name: string; level: number }>
): Promise<SchoolGrade> => {
  const response = await api.put(`/schools/${schoolId}/grades/${gradeId}`, data);
  return response.data;
};

export const deleteSchoolGrade = async (schoolId: string, gradeId: string): Promise<void> => {
  await api.delete(`/schools/${schoolId}/grades/${gradeId}`);
};

export const createSchoolSection = async (
  schoolId: string,
  gradeId: string,
  data: { name: string }
): Promise<SchoolSection> => {
  const response = await api.post(`/schools/${schoolId}/grades/${gradeId}/sections`, data);
  return response.data;
};

export const updateSchoolSection = async (
  schoolId: string,
  sectionId: string,
  data: { name: string }
): Promise<SchoolSection> => {
  const response = await api.put(`/schools/${schoolId}/sections/${sectionId}`, data);
  return response.data;
};

export const deleteSchoolSection = async (schoolId: string, sectionId: string): Promise<void> => {
  await api.delete(`/schools/${schoolId}/sections/${sectionId}`);
};

// ==================== ESTUDIANTES DE ESCUELA (NUEVO) ====================

export interface SchoolStudentNew {
  id: string;
  schoolId: string;
  sectionId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  dni?: string;
  tempPassword?: string;
  studentCode?: string;
  isActive: boolean;
  createdAt: string;
  section?: SchoolSection;
  grade?: SchoolGrade;
  enrolledClasses?: number;
}

export interface StudentEnrollment {
  id: string;
  schoolStudentId: string;
  classroomId: string;
  characterClass: string;
  xp: number;
  hp: number;
  gp: number;
  level: number;
  classroom?: {
    id: string;
    name: string;
  };
}

export const getSchoolStudentsNew = async (
  schoolId: string,
  sectionId?: string
): Promise<SchoolStudentNew[]> => {
  const params = sectionId ? `?sectionId=${sectionId}` : '';
  const response = await api.get(`/schools/${schoolId}/school-students${params}`);
  return response.data;
};

export const createSchoolStudentNew = async (schoolId: string, data: {
  sectionId: string;
  firstName: string;
  lastName: string;
  email: string;
  studentCode?: string;
  dni?: string;
}): Promise<SchoolStudentNew> => {
  const response = await api.post(`/schools/${schoolId}/school-students`, data);
  return response.data;
};

export const bulkCreateSchoolStudentsNew = async (schoolId: string, data: {
  sectionId: string;
  students: Array<{
    firstName: string;
    lastName: string;
    email: string;
    studentCode?: string;
    dni?: string;
  }>;
}): Promise<{ created: SchoolStudentNew[]; errors: Array<{ student: any; error: string }> }> => {
  const response = await api.post(`/schools/${schoolId}/school-students/bulk`, data);
  return response.data;
};

export const updateSchoolStudentNew = async (
  schoolId: string,
  studentId: string,
  data: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    studentCode: string;
    sectionId: string;
    dni: string;
  }>
): Promise<SchoolStudentNew> => {
  const response = await api.put(`/schools/${schoolId}/school-students/${studentId}`, data);
  return response.data;
};

export const deleteSchoolStudentNew = async (schoolId: string, studentId: string): Promise<void> => {
  await api.delete(`/schools/${schoolId}/school-students/${studentId}`);
};

export const resetStudentPassword = async (
  schoolId: string,
  studentId: string
): Promise<{ tempPassword: string }> => {
  const response = await api.post(`/schools/${schoolId}/school-students/${studentId}/reset-password`);
  return response.data;
};

export const getStudentEnrollments = async (
  schoolId: string,
  studentId: string
): Promise<StudentEnrollment[]> => {
  const response = await api.get(`/schools/${schoolId}/school-students/${studentId}/enrollments`);
  return response.data;
};

export const enrollStudentInClass = async (
  schoolId: string,
  studentId: string,
  classroomId: string,
  characterClass?: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST'
): Promise<StudentEnrollment> => {
  const response = await api.post(`/schools/${schoolId}/school-students/${studentId}/enroll`, {
    classroomId,
    characterClass,
  });
  return response.data;
};

export const unenrollStudentFromClass = async (
  schoolId: string,
  studentId: string,
  classroomId: string
): Promise<void> => {
  await api.delete(`/schools/${schoolId}/school-students/${studentId}/enroll/${classroomId}`);
};

export const bulkEnrollStudents = async (
  schoolId: string,
  classroomId: string,
  studentIds: string[]
): Promise<{ enrolled: number; errors: Array<{ studentId: string; error: string }> }> => {
  const response = await api.post(`/schools/${schoolId}/school-students/bulk-enroll`, {
    classroomId,
    studentIds,
  });
  return response.data;
};

export const bulkUnenrollStudents = async (
  schoolId: string,
  classroomId: string,
  studentIds: string[]
): Promise<{ unenrolled: number; errors: Array<{ studentId: string; error: string }> }> => {
  const response = await api.post(`/schools/${schoolId}/school-students/bulk-unenroll`, {
    classroomId,
    studentIds,
  });
  return response.data;
};

export const exportSchoolStudents = async (
  schoolId: string,
  sectionId?: string
): Promise<Array<{
  dni: string;
  nombre: string;
  apellido: string;
  email: string;
  contraseña: string;
  codigo: string;
  grado: string;
  seccion: string;
}>> => {
  const params = sectionId ? `?sectionId=${sectionId}` : '';
  const response = await api.get(`/schools/${schoolId}/school-students/export${params}`);
  return response.data;
};
