import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  // Escuelas
  createSchool,
  getSchool,
  updateSchool,
  getMySchools,
  // Miembros
  getMembers,
  addMember,
  updateMember,
  removeMember,
  // Clases
  getSchoolClassrooms,
  createSchoolClassroom,
  updateSchoolClassroom,
  deleteSchoolClassroom,
  assignTeacher,
  // Estudiantes (legacy)
  createSchoolStudent,
  bulkCreateStudents,
  getSchoolStudents,
  assignStudentToClassroom,
  updateSchoolStudent,
  deleteSchoolStudent,
  // Comportamientos
  getSchoolBehaviors,
  createSchoolBehavior,
  updateSchoolBehavior,
  deleteSchoolBehavior,
  // Insignias
  getSchoolBadges,
  createSchoolBadge,
  updateSchoolBadge,
  deleteSchoolBadge,
  // Grados
  getGrades,
  createGrade,
  updateGrade,
  deleteGrade,
  // Secciones
  createSection,
  updateSection,
  deleteSection,
  // Estudiantes de escuela (nuevo)
  getSchoolStudentsNew,
  createSchoolStudentNew,
  bulkCreateSchoolStudentsNew,
  updateSchoolStudentNew,
  deleteSchoolStudentNew,
  resetStudentPassword,
  enrollStudent,
  unenrollStudent,
  getStudentEnrollments,
  exportStudents,
  bulkEnrollStudents,
  bulkUnenrollStudents,
} from '../controllers/school.controller.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ==================== ESCUELAS ====================
router.get('/my-schools', getMySchools);
router.post('/', createSchool);
router.get('/:id', getSchool);
router.put('/:id', updateSchool);

// ==================== MIEMBROS ====================
router.get('/:schoolId/members', getMembers);
router.post('/:schoolId/members', addMember);
router.put('/:schoolId/members/:memberId', updateMember);
router.delete('/:schoolId/members/:memberId', removeMember);

// ==================== CLASES ====================
router.get('/:schoolId/classrooms', getSchoolClassrooms);
router.post('/:schoolId/classrooms', createSchoolClassroom);
router.put('/:schoolId/classrooms/:classroomId', updateSchoolClassroom);
router.delete('/:schoolId/classrooms/:classroomId', deleteSchoolClassroom);
router.put('/:schoolId/classrooms/:classroomId/teacher', assignTeacher);

// ==================== ESTUDIANTES ====================
router.get('/:schoolId/students', getSchoolStudents);
router.post('/:schoolId/students', createSchoolStudent);
router.post('/:schoolId/students/bulk', bulkCreateStudents);
router.put('/:schoolId/students/:studentId', updateSchoolStudent);
router.put('/:schoolId/students/:studentId/assign', assignStudentToClassroom);
router.delete('/:schoolId/students/:studentId', deleteSchoolStudent);

// ==================== COMPORTAMIENTOS ====================
router.get('/:schoolId/behaviors', getSchoolBehaviors);
router.post('/:schoolId/behaviors', createSchoolBehavior);
router.put('/:schoolId/behaviors/:behaviorId', updateSchoolBehavior);
router.delete('/:schoolId/behaviors/:behaviorId', deleteSchoolBehavior);

// ==================== INSIGNIAS ====================
router.get('/:schoolId/badges', getSchoolBadges);
router.post('/:schoolId/badges', createSchoolBadge);
router.put('/:schoolId/badges/:badgeId', updateSchoolBadge);
router.delete('/:schoolId/badges/:badgeId', deleteSchoolBadge);

// ==================== GRADOS ====================
router.get('/:schoolId/grades', getGrades);
router.post('/:schoolId/grades', createGrade);
router.put('/:schoolId/grades/:gradeId', updateGrade);
router.delete('/:schoolId/grades/:gradeId', deleteGrade);

// ==================== SECCIONES ====================
router.post('/:schoolId/grades/:gradeId/sections', createSection);
router.put('/:schoolId/sections/:sectionId', updateSection);
router.delete('/:schoolId/sections/:sectionId', deleteSection);

// ==================== ESTUDIANTES DE ESCUELA (NUEVO) ====================
router.get('/:schoolId/school-students', getSchoolStudentsNew);
router.post('/:schoolId/school-students', createSchoolStudentNew);
router.post('/:schoolId/school-students/bulk', bulkCreateSchoolStudentsNew);
router.get('/:schoolId/school-students/export', exportStudents);
router.post('/:schoolId/school-students/bulk-enroll', bulkEnrollStudents);
router.post('/:schoolId/school-students/bulk-unenroll', bulkUnenrollStudents);
router.put('/:schoolId/school-students/:studentId', updateSchoolStudentNew);
router.delete('/:schoolId/school-students/:studentId', deleteSchoolStudentNew);
router.post('/:schoolId/school-students/:studentId/reset-password', resetStudentPassword);
router.get('/:schoolId/school-students/:studentId/enrollments', getStudentEnrollments);
router.post('/:schoolId/school-students/:studentId/enroll', enrollStudent);
router.delete('/:schoolId/school-students/:studentId/enroll/:classroomId', unenrollStudent);

export default router;
