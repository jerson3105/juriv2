import { Request, Response } from 'express';
import { schoolService } from '../services/school.service.js';

// ==================== ESCUELAS ====================

export const createSchool = async (req: Request, res: Response) => {
  try {
    const { name, slug, description, logoUrl, email, phone, address, ownerId } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Solo administradores de Juried pueden crear escuelas
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo los administradores pueden crear escuelas' });
    }

    if (!name || !slug) {
      return res.status(400).json({ error: 'Nombre e identificador son requeridos' });
    }

    // Validar formato del slug
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ 
        error: 'El identificador solo puede contener letras minúsculas, números y guiones' 
      });
    }

    const school = await schoolService.create({
      name,
      slug,
      description,
      logoUrl,
      email,
      phone,
      address,
      ownerId: ownerId || userId, // Admin puede especificar quién será el owner
    });

    res.status(201).json(school);
  } catch (error: any) {
    console.error('Error creating school:', error);
    res.status(400).json({ error: error.message || 'Error al crear la escuela' });
  }
};

export const getSchool = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const school = await schoolService.getById(id);
    if (!school) {
      return res.status(404).json({ error: 'Escuela no encontrada' });
    }

    // Verificar que el usuario sea miembro
    const member = await schoolService.getMemberByUserId(id, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const stats = await schoolService.getStats(id);

    res.json({ 
      ...school, 
      stats, 
      userRole: member.role,
      canCreateClasses: member.canCreateClasses,
      canManageStudents: member.canManageStudents,
    });
  } catch (error: any) {
    console.error('Error getting school:', error);
    res.status(500).json({ error: 'Error al obtener la escuela' });
  }
};

export const updateSchool = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const data = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos de admin
    const isAdmin = await schoolService.isSchoolAdmin(id, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para editar esta escuela' });
    }

    const school = await schoolService.update(id, data);
    res.json(school);
  } catch (error: any) {
    console.error('Error updating school:', error);
    res.status(400).json({ error: error.message || 'Error al actualizar la escuela' });
  }
};

export const getMySchools = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const schools = await schoolService.getUserSchools(userId);
    res.json(schools);
  } catch (error: any) {
    console.error('Error getting user schools:', error);
    res.status(500).json({ error: 'Error al obtener las escuelas' });
  }
};

// ==================== MIEMBROS ====================

export const getMembers = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar que sea miembro
    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const members = await schoolService.getMembers(schoolId);
    res.json(members);
  } catch (error: any) {
    console.error('Error getting members:', error);
    res.status(500).json({ error: 'Error al obtener los miembros' });
  }
};

export const addMember = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?.id;
    const { email, firstName, lastName, role, password, canCreateClasses, canManageStudents } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos de admin
    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para agregar miembros' });
    }

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, nombre y apellido son requeridos' });
    }

    // No permitir crear OWNER
    if (role === 'OWNER') {
      return res.status(400).json({ error: 'No se puede asignar el rol de propietario' });
    }

    const member = await schoolService.addMember({
      schoolId,
      email,
      firstName,
      lastName,
      role: role || 'TEACHER',
      password,
      canCreateClasses,
      canManageStudents,
    });

    res.status(201).json(member);
  } catch (error: any) {
    console.error('Error adding member:', error);
    res.status(400).json({ error: error.message || 'Error al agregar miembro' });
  }
};

export const updateMember = async (req: Request, res: Response) => {
  try {
    const { schoolId, memberId } = req.params;
    const userId = req.user?.id;
    const data = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos de admin
    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para editar miembros' });
    }

    // No permitir cambiar a OWNER
    if (data.role === 'OWNER') {
      return res.status(400).json({ error: 'No se puede asignar el rol de propietario' });
    }

    await schoolService.updateMember(memberId, data);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating member:', error);
    res.status(400).json({ error: error.message || 'Error al actualizar miembro' });
  }
};

export const removeMember = async (req: Request, res: Response) => {
  try {
    const { schoolId, memberId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos de admin
    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar miembros' });
    }

    await schoolService.removeMember(memberId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing member:', error);
    res.status(400).json({ error: error.message || 'Error al eliminar miembro' });
  }
};

// ==================== CLASES ====================

export const getSchoolClassrooms = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar que sea miembro
    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    // Solo admins y owners ven todas las clases, profesores solo las suyas
    const isAdmin = member.role === 'OWNER' || member.role === 'ADMIN';
    const classrooms = await schoolService.getClassrooms(schoolId, userId, isAdmin);
    res.json(classrooms);
  } catch (error: any) {
    console.error('Error getting classrooms:', error);
    res.status(500).json({ error: 'Error al obtener las clases' });
  }
};

export const createSchoolClassroom = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?.id;
    const { name, description, teacherId, gradeLevel } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos
    const canManage = await schoolService.canManageClassroom(schoolId, userId);
    if (!canManage) {
      return res.status(403).json({ error: 'No tienes permisos para crear clases' });
    }

    if (!name || !teacherId) {
      return res.status(400).json({ error: 'Nombre y profesor son requeridos' });
    }

    const classroom = await schoolService.createClassroom({
      schoolId,
      name,
      description,
      teacherId,
      gradeLevel,
    });

    res.status(201).json(classroom);
  } catch (error: any) {
    console.error('Error creating classroom:', error);
    res.status(400).json({ error: error.message || 'Error al crear la clase' });
  }
};

export const assignTeacher = async (req: Request, res: Response) => {
  try {
    const { schoolId, classroomId } = req.params;
    const userId = req.user?.id;
    const { teacherId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos de admin
    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para asignar profesores' });
    }

    await schoolService.assignTeacherToClassroom(classroomId, teacherId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error assigning teacher:', error);
    res.status(400).json({ error: error.message || 'Error al asignar profesor' });
  }
};

export const updateSchoolClassroom = async (req: Request, res: Response) => {
  try {
    const { schoolId, classroomId } = req.params;
    const userId = req.user?.id;
    const { name, description, teacherId, gradeLevel } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos
    const canManage = await schoolService.canManageClassroom(schoolId, userId);
    if (!canManage) {
      return res.status(403).json({ error: 'No tienes permisos para editar clases' });
    }

    const classroom = await schoolService.updateSchoolClassroom(classroomId, schoolId, {
      name,
      description,
      teacherId,
      gradeLevel,
    });

    res.json(classroom);
  } catch (error: any) {
    console.error('Error updating classroom:', error);
    res.status(400).json({ error: error.message || 'Error al actualizar la clase' });
  }
};

export const deleteSchoolClassroom = async (req: Request, res: Response) => {
  try {
    const { schoolId, classroomId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos de admin
    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar clases' });
    }

    await schoolService.deleteSchoolClassroom(classroomId, schoolId);
    res.json({ success: true, message: 'Clase eliminada correctamente' });
  } catch (error: any) {
    console.error('Error deleting classroom:', error);
    res.status(400).json({ error: error.message || 'Error al eliminar la clase' });
  }
};

// ==================== ESTUDIANTES ====================

export const createSchoolStudent = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?.id;
    const { classroomId, displayName, characterClass, avatarGender } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos
    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member || !member.canManageStudents) {
      return res.status(403).json({ error: 'No tienes permisos para crear estudiantes' });
    }

    if (!classroomId || !displayName || !characterClass) {
      return res.status(400).json({ error: 'Clase, nombre y clase de personaje son requeridos' });
    }

    const student = await schoolService.createStudent({
      schoolId,
      classroomId,
      displayName,
      characterClass,
      avatarGender,
    });

    res.status(201).json(student);
  } catch (error: any) {
    console.error('Error creating student:', error);
    res.status(400).json({ error: error.message || 'Error al crear estudiante' });
  }
};

export const bulkCreateStudents = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?.id;
    const { classroomId, students } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos
    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member || !member.canManageStudents) {
      return res.status(403).json({ error: 'No tienes permisos para crear estudiantes' });
    }

    if (!classroomId || !students || !Array.isArray(students)) {
      return res.status(400).json({ error: 'Clase y lista de estudiantes son requeridos' });
    }

    const created = await schoolService.bulkCreateStudents(schoolId, classroomId, students);
    res.status(201).json(created);
  } catch (error: any) {
    console.error('Error bulk creating students:', error);
    res.status(400).json({ error: error.message || 'Error al crear estudiantes' });
  }
};

export const getSchoolStudents = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar que sea miembro
    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const students = await schoolService.getStudents(schoolId);
    res.json(students);
  } catch (error: any) {
    console.error('Error getting students:', error);
    res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
};

export const assignStudentToClassroom = async (req: Request, res: Response) => {
  try {
    const { schoolId, studentId } = req.params;
    const userId = req.user?.id;
    const { classroomId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos (admin o canManageStudents)
    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const isAdmin = member.role === 'OWNER' || member.role === 'ADMIN';
    if (!isAdmin && !member.canManageStudents) {
      return res.status(403).json({ error: 'No tienes permisos para gestionar estudiantes' });
    }

    if (!classroomId) {
      return res.status(400).json({ error: 'ID de clase es requerido' });
    }

    const student = await schoolService.assignStudentToClassroom(schoolId, studentId, classroomId);
    res.json(student);
  } catch (error: any) {
    console.error('Error assigning student:', error);
    res.status(400).json({ error: error.message || 'Error al asignar estudiante' });
  }
};

export const updateSchoolStudent = async (req: Request, res: Response) => {
  try {
    const { schoolId, studentId } = req.params;
    const userId = req.user?.id;
    const data = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos
    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const isAdmin = member.role === 'OWNER' || member.role === 'ADMIN';
    if (!isAdmin && !member.canManageStudents) {
      return res.status(403).json({ error: 'No tienes permisos para gestionar estudiantes' });
    }

    const student = await schoolService.updateStudent(schoolId, studentId, data);
    res.json(student);
  } catch (error: any) {
    console.error('Error updating student:', error);
    res.status(400).json({ error: error.message || 'Error al actualizar estudiante' });
  }
};

export const deleteSchoolStudent = async (req: Request, res: Response) => {
  try {
    const { schoolId, studentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos de admin
    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar estudiantes' });
    }

    await schoolService.deleteStudent(schoolId, studentId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting student:', error);
    res.status(400).json({ error: error.message || 'Error al eliminar estudiante' });
  }
};

// ==================== COMPORTAMIENTOS ====================

export const getSchoolBehaviors = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar que sea miembro
    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const behaviors = await schoolService.getBehaviors(schoolId);
    res.json(behaviors);
  } catch (error: any) {
    console.error('Error getting behaviors:', error);
    res.status(500).json({ error: 'Error al obtener comportamientos' });
  }
};

export const createSchoolBehavior = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?.id;
    const data = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos de admin
    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para crear comportamientos' });
    }

    const behavior = await schoolService.createBehavior(schoolId, data);
    res.status(201).json(behavior);
  } catch (error: any) {
    console.error('Error creating behavior:', error);
    res.status(400).json({ error: error.message || 'Error al crear comportamiento' });
  }
};

export const updateSchoolBehavior = async (req: Request, res: Response) => {
  try {
    const { schoolId, behaviorId } = req.params;
    const userId = req.user?.id;
    const data = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos de admin
    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para editar comportamientos' });
    }

    await schoolService.updateBehavior(behaviorId, data);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating behavior:', error);
    res.status(400).json({ error: error.message || 'Error al actualizar comportamiento' });
  }
};

export const deleteSchoolBehavior = async (req: Request, res: Response) => {
  try {
    const { schoolId, behaviorId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos de admin
    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar comportamientos' });
    }

    await schoolService.deleteBehavior(behaviorId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting behavior:', error);
    res.status(400).json({ error: error.message || 'Error al eliminar comportamiento' });
  }
};

// ==================== INSIGNIAS ====================

export const getSchoolBadges = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar que sea miembro
    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const badges = await schoolService.getBadges(schoolId);
    res.json(badges);
  } catch (error: any) {
    console.error('Error getting badges:', error);
    res.status(500).json({ error: 'Error al obtener insignias' });
  }
};

export const createSchoolBadge = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?.id;
    const data = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos de admin
    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para crear insignias' });
    }

    const badge = await schoolService.createBadge(schoolId, data);
    res.status(201).json(badge);
  } catch (error: any) {
    console.error('Error creating badge:', error);
    res.status(400).json({ error: error.message || 'Error al crear insignia' });
  }
};

export const updateSchoolBadge = async (req: Request, res: Response) => {
  try {
    const { schoolId, badgeId } = req.params;
    const userId = req.user?.id;
    const data = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos de admin
    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para editar insignias' });
    }

    await schoolService.updateBadge(badgeId, data);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating badge:', error);
    res.status(400).json({ error: error.message || 'Error al actualizar insignia' });
  }
};

export const deleteSchoolBadge = async (req: Request, res: Response) => {
  try {
    const { schoolId, badgeId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar permisos de admin
    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar insignias' });
    }

    await schoolService.deleteBadge(badgeId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting badge:', error);
    res.status(400).json({ error: error.message || 'Error al eliminar insignia' });
  }
};

// ==================== GRADOS ====================

export const getGrades = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const grades = await schoolService.getGrades(schoolId);
    res.json(grades);
  } catch (error: any) {
    console.error('Error getting grades:', error);
    res.status(500).json({ error: 'Error al obtener grados' });
  }
};

export const createGrade = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?.id;
    const { name, level } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para crear grados' });
    }

    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const grade = await schoolService.createGrade(schoolId, { name, level: level || 1 });
    res.status(201).json(grade);
  } catch (error: any) {
    console.error('Error creating grade:', error);
    res.status(400).json({ error: error.message || 'Error al crear grado' });
  }
};

export const updateGrade = async (req: Request, res: Response) => {
  try {
    const { schoolId, gradeId } = req.params;
    const userId = req.user?.id;
    const data = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para actualizar grados' });
    }

    const grade = await schoolService.updateGrade(gradeId, data);
    res.json(grade);
  } catch (error: any) {
    console.error('Error updating grade:', error);
    res.status(400).json({ error: error.message || 'Error al actualizar grado' });
  }
};

export const deleteGrade = async (req: Request, res: Response) => {
  try {
    const { schoolId, gradeId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar grados' });
    }

    await schoolService.deleteGrade(gradeId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting grade:', error);
    res.status(400).json({ error: error.message || 'Error al eliminar grado' });
  }
};

// ==================== SECCIONES ====================

export const createSection = async (req: Request, res: Response) => {
  try {
    const { schoolId, gradeId } = req.params;
    const userId = req.user?.id;
    const { name } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para crear secciones' });
    }

    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const section = await schoolService.createSection(gradeId, { name });
    res.status(201).json(section);
  } catch (error: any) {
    console.error('Error creating section:', error);
    res.status(400).json({ error: error.message || 'Error al crear sección' });
  }
};

export const updateSection = async (req: Request, res: Response) => {
  try {
    const { schoolId, sectionId } = req.params;
    const userId = req.user?.id;
    const data = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para actualizar secciones' });
    }

    const section = await schoolService.updateSection(sectionId, data);
    res.json(section);
  } catch (error: any) {
    console.error('Error updating section:', error);
    res.status(400).json({ error: error.message || 'Error al actualizar sección' });
  }
};

export const deleteSection = async (req: Request, res: Response) => {
  try {
    const { schoolId, sectionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar secciones' });
    }

    await schoolService.deleteSection(sectionId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting section:', error);
    res.status(400).json({ error: error.message || 'Error al eliminar sección' });
  }
};

// ==================== ESTUDIANTES DE ESCUELA (NUEVO) ====================

export const getSchoolStudentsNew = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const { sectionId } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const students = await schoolService.getSchoolStudents(schoolId, sectionId as string);
    res.json(students);
  } catch (error: any) {
    console.error('Error getting school students:', error);
    res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
};

export const createSchoolStudentNew = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?.id;
    const data = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const isAdmin = member.role === 'OWNER' || member.role === 'ADMIN';
    if (!isAdmin && !member.canManageStudents) {
      return res.status(403).json({ error: 'No tienes permisos para crear estudiantes' });
    }

    if (!data.sectionId || !data.firstName || !data.lastName || !data.email) {
      return res.status(400).json({ error: 'Sección, nombre, apellido y email son requeridos' });
    }

    const student = await schoolService.createSchoolStudent(schoolId, data);
    res.status(201).json(student);
  } catch (error: any) {
    console.error('Error creating school student:', error);
    res.status(400).json({ error: error.message || 'Error al crear estudiante' });
  }
};

export const bulkCreateSchoolStudentsNew = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const userId = req.user?.id;
    const { sectionId, students } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const isAdmin = member.role === 'OWNER' || member.role === 'ADMIN';
    if (!isAdmin && !member.canManageStudents) {
      return res.status(403).json({ error: 'No tienes permisos para crear estudiantes' });
    }

    if (!sectionId || !students || !Array.isArray(students)) {
      return res.status(400).json({ error: 'Sección y lista de estudiantes son requeridos' });
    }

    const result = await schoolService.bulkCreateSchoolStudents(schoolId, sectionId, students);
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error bulk creating school students:', error);
    res.status(400).json({ error: error.message || 'Error al crear estudiantes' });
  }
};

export const updateSchoolStudentNew = async (req: Request, res: Response) => {
  try {
    const { schoolId, studentId } = req.params;
    const userId = req.user?.id;
    const data = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const isAdmin = member.role === 'OWNER' || member.role === 'ADMIN';
    if (!isAdmin && !member.canManageStudents) {
      return res.status(403).json({ error: 'No tienes permisos para actualizar estudiantes' });
    }

    const student = await schoolService.updateSchoolStudent(studentId, data);
    res.json(student);
  } catch (error: any) {
    console.error('Error updating school student:', error);
    res.status(400).json({ error: error.message || 'Error al actualizar estudiante' });
  }
};

export const deleteSchoolStudentNew = async (req: Request, res: Response) => {
  try {
    const { schoolId, studentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar estudiantes' });
    }

    await schoolService.deleteSchoolStudent(studentId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting school student:', error);
    res.status(400).json({ error: error.message || 'Error al eliminar estudiante' });
  }
};

export const resetStudentPassword = async (req: Request, res: Response) => {
  try {
    const { schoolId, studentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const isAdmin = member.role === 'OWNER' || member.role === 'ADMIN';
    if (!isAdmin && !member.canManageStudents) {
      return res.status(403).json({ error: 'No tienes permisos para resetear contraseñas' });
    }

    const result = await schoolService.resetStudentPassword(studentId);
    res.json(result);
  } catch (error: any) {
    console.error('Error resetting student password:', error);
    res.status(400).json({ error: error.message || 'Error al resetear contraseña' });
  }
};

export const enrollStudent = async (req: Request, res: Response) => {
  try {
    const { schoolId, studentId } = req.params;
    const userId = req.user?.id;
    const { classroomId, characterClass } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const isAdmin = member.role === 'OWNER' || member.role === 'ADMIN';
    if (!isAdmin && !member.canManageStudents) {
      return res.status(403).json({ error: 'No tienes permisos para inscribir estudiantes' });
    }

    if (!classroomId) {
      return res.status(400).json({ error: 'ID de clase es requerido' });
    }

    const profile = await schoolService.enrollStudentInClass(studentId, classroomId, characterClass);
    res.status(201).json(profile);
  } catch (error: any) {
    console.error('Error enrolling student:', error);
    res.status(400).json({ error: error.message || 'Error al inscribir estudiante' });
  }
};

export const unenrollStudent = async (req: Request, res: Response) => {
  try {
    const { schoolId, studentId, classroomId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const isAdmin = member.role === 'OWNER' || member.role === 'ADMIN';
    if (!isAdmin && !member.canManageStudents) {
      return res.status(403).json({ error: 'No tienes permisos para desinscribir estudiantes' });
    }

    await schoolService.unenrollStudentFromClass(studentId, classroomId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error unenrolling student:', error);
    res.status(400).json({ error: error.message || 'Error al desinscribir estudiante' });
  }
};

export const getStudentEnrollments = async (req: Request, res: Response) => {
  try {
    const { schoolId, studentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const enrollments = await schoolService.getStudentEnrollments(studentId);
    res.json(enrollments);
  } catch (error: any) {
    console.error('Error getting student enrollments:', error);
    res.status(500).json({ error: 'Error al obtener inscripciones' });
  }
};

export const exportStudents = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const { sectionId } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const isAdmin = await schoolService.isSchoolAdmin(schoolId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para exportar estudiantes' });
    }

    const data = await schoolService.exportStudentsWithCredentials(schoolId, sectionId as string);
    res.json(data);
  } catch (error: any) {
    console.error('Error exporting students:', error);
    res.status(500).json({ error: 'Error al exportar estudiantes' });
  }
};

export const bulkEnrollStudents = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const { classroomId, studentIds } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const isAdmin = member.role === 'OWNER' || member.role === 'ADMIN';
    if (!isAdmin && !member.canManageStudents) {
      return res.status(403).json({ error: 'No tienes permisos para inscribir estudiantes' });
    }

    if (!classroomId || !studentIds || !Array.isArray(studentIds)) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    const result = await schoolService.bulkEnrollStudentsInClass(schoolId, classroomId, studentIds);
    res.json(result);
  } catch (error: any) {
    console.error('Error bulk enrolling students:', error);
    res.status(400).json({ error: error.message || 'Error al inscribir estudiantes' });
  }
};

export const bulkUnenrollStudents = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const { classroomId, studentIds } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const member = await schoolService.getMemberByUserId(schoolId, userId);
    if (!member) {
      return res.status(403).json({ error: 'No tienes acceso a esta escuela' });
    }

    const isAdmin = member.role === 'OWNER' || member.role === 'ADMIN';
    if (!isAdmin && !member.canManageStudents) {
      return res.status(403).json({ error: 'No tienes permisos para desinscribir estudiantes' });
    }

    if (!classroomId || !studentIds || !Array.isArray(studentIds)) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    const result = await schoolService.bulkUnenrollStudentsFromClass(schoolId, classroomId, studentIds);
    res.json(result);
  } catch (error: any) {
    console.error('Error bulk unenrolling students:', error);
    res.status(400).json({ error: error.message || 'Error al desinscribir estudiantes' });
  }
};
