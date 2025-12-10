import { db } from '../db/index.js';
import { 
  schools, 
  schoolMembers, 
  schoolBehaviors, 
  schoolBadges,
  schoolGrades,
  schoolSections,
  schoolStudents,
  classrooms,
  studentProfiles,
  users
} from '../db/schema.js';
import { eq, and, desc, count, inArray, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

type SchoolMemberRole = 'OWNER' | 'ADMIN' | 'TEACHER';

interface CreateSchoolData {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  ownerId: string; // Usuario que crea la escuela
}

interface UpdateSchoolData {
  name?: string;
  description?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  maxTeachers?: number;
  maxStudentsPerClass?: number;
  isActive?: boolean;
}

interface CreateMemberData {
  schoolId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: SchoolMemberRole;
  password?: string; // Si no se provee, se genera uno temporal
  canCreateClasses?: boolean;
  canManageStudents?: boolean;
}

interface CreateClassroomData {
  schoolId: string;
  name: string;
  description?: string;
  teacherId: string;
  gradeLevel?: string;
}

interface CreateStudentData {
  schoolId: string;
  classroomId: string;
  displayName: string;
  characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
  avatarGender?: 'MALE' | 'FEMALE';
}

class SchoolService {
  // ==================== CRUD ESCUELAS ====================

  async create(data: CreateSchoolData) {
    const id = uuidv4();
    const now = new Date();

    // Verificar que el slug sea único
    const existingSchool = await db.query.schools.findFirst({
      where: eq(schools.slug, data.slug),
    });

    if (existingSchool) {
      throw new Error('El identificador de escuela ya está en uso');
    }

    // Crear la escuela
    await db.insert(schools).values({
      id,
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      logoUrl: data.logoUrl || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      createdAt: now,
      updatedAt: now,
    });

    // Agregar al creador como OWNER
    await db.insert(schoolMembers).values({
      id: uuidv4(),
      schoolId: id,
      userId: data.ownerId,
      role: 'OWNER',
      canCreateClasses: true,
      canManageStudents: true,
      isActive: true,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return this.getById(id);
  }

  async getById(id: string) {
    return db.query.schools.findFirst({
      where: eq(schools.id, id),
    });
  }

  async getBySlug(slug: string) {
    return db.query.schools.findFirst({
      where: eq(schools.slug, slug),
    });
  }

  async update(id: string, data: UpdateSchoolData) {
    await db.update(schools)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, id));

    return this.getById(id);
  }

  async delete(id: string) {
    // Soft delete - desactivar escuela
    await db.update(schools)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schools.id, id));
  }

  // ==================== MIEMBROS ====================

  async getMembers(schoolId: string) {
    const members = await db
      .select({
        id: schoolMembers.id,
        role: schoolMembers.role,
        canCreateClasses: schoolMembers.canCreateClasses,
        canManageStudents: schoolMembers.canManageStudents,
        isActive: schoolMembers.isActive,
        joinedAt: schoolMembers.joinedAt,
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      })
      .from(schoolMembers)
      .innerJoin(users, eq(schoolMembers.userId, users.id))
      .where(eq(schoolMembers.schoolId, schoolId))
      .orderBy(desc(schoolMembers.joinedAt));

    return members;
  }

  async getMemberByUserId(schoolId: string, userId: string) {
    return db.query.schoolMembers.findFirst({
      where: and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.userId, userId)
      ),
    });
  }

  async addMember(data: CreateMemberData) {
    const now = new Date();
    const normalizedEmail = data.email.toLowerCase().trim();

    // Verificar si el usuario ya existe
    let user = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (user) {
      // Verificar si ya es miembro de esta escuela
      const existingMember = await this.getMemberByUserId(data.schoolId, user.id);
      if (existingMember) {
        throw new Error('Este usuario ya es miembro de la escuela');
      }
    } else {
      // Crear nuevo usuario
      const userId = uuidv4();
      const tempPassword = data.password || this.generateTempPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      await db.insert(users).values({
        id: userId,
        email: normalizedEmail,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'TEACHER', // Los miembros de escuela son profesores
        provider: 'LOCAL',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      // TODO: Enviar email con credenciales temporales
    }

    if (!user) {
      throw new Error('Error al crear el usuario');
    }

    // Agregar como miembro
    const memberId = uuidv4();
    await db.insert(schoolMembers).values({
      id: memberId,
      schoolId: data.schoolId,
      userId: user.id,
      role: data.role,
      canCreateClasses: data.canCreateClasses ?? false,
      canManageStudents: data.canManageStudents ?? true,
      isActive: true,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return this.getMemberByUserId(data.schoolId, user.id);
  }

  async updateMember(memberId: string, data: {
    role?: SchoolMemberRole;
    canCreateClasses?: boolean;
    canManageStudents?: boolean;
    isActive?: boolean;
  }) {
    await db.update(schoolMembers)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schoolMembers.id, memberId));
  }

  async removeMember(memberId: string) {
    // No permitir eliminar al OWNER
    const member = await db.query.schoolMembers.findFirst({
      where: eq(schoolMembers.id, memberId),
    });

    if (member?.role === 'OWNER') {
      throw new Error('No se puede eliminar al propietario de la escuela');
    }

    await db.delete(schoolMembers).where(eq(schoolMembers.id, memberId));
  }

  // ==================== CLASES ====================

  async getClassrooms(schoolId: string, userId?: string, isAdmin?: boolean) {
    // Si es admin, obtener todas las clases. Si es profesor, solo las suyas.
    let classroomsList;
    if (isAdmin) {
      classroomsList = await db.query.classrooms.findMany({
        where: and(
          eq(classrooms.schoolId, schoolId),
          eq(classrooms.isActive, true)
        ),
        orderBy: [desc(classrooms.createdAt)],
      });
    } else if (userId) {
      classroomsList = await db.query.classrooms.findMany({
        where: and(
          eq(classrooms.schoolId, schoolId),
          eq(classrooms.teacherId, userId),
          eq(classrooms.isActive, true)
        ),
        orderBy: [desc(classrooms.createdAt)],
      });
    } else {
      return [];
    }

    if (classroomsList.length === 0) return [];

    // Obtener conteo de estudiantes
    const classroomIds = classroomsList.map(c => c.id);
    const studentCounts = await db
      .select({
        classroomId: studentProfiles.classroomId,
        count: count(),
      })
      .from(studentProfiles)
      .where(and(
        inArray(studentProfiles.classroomId, classroomIds),
        eq(studentProfiles.isActive, true)
      ))
      .groupBy(studentProfiles.classroomId);

    const countMap = new Map(studentCounts.map(sc => [sc.classroomId, Number(sc.count)]));

    // Obtener info de profesores
    const teacherIds = [...new Set(classroomsList.map(c => c.teacherId))];
    const teachers = await db.query.users.findMany({
      where: inArray(users.id, teacherIds),
    });
    const teacherMap = new Map(teachers.map(t => [t.id, t]));

    return classroomsList.map(c => ({
      ...c,
      studentCount: countMap.get(c.id) || 0,
      teacher: teacherMap.get(c.teacherId),
    }));
  }

  async createClassroom(data: CreateClassroomData) {
    const id = uuidv4();
    const now = new Date();
    const code = this.generateClassCode();

    // Verificar que el profesor sea miembro de la escuela
    const member = await this.getMemberByUserId(data.schoolId, data.teacherId);
    if (!member) {
      throw new Error('El profesor no es miembro de esta escuela');
    }

    await db.insert(classrooms).values({
      id,
      name: data.name,
      description: data.description || null,
      code,
      teacherId: data.teacherId,
      schoolId: data.schoolId,
      gradeLevel: data.gradeLevel || null,
      showCharacterName: false, // Para clases de escuela, mostrar nombre real por defecto
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return db.query.classrooms.findFirst({
      where: eq(classrooms.id, id),
    });
  }

  async assignTeacherToClassroom(classroomId: string, teacherId: string) {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, classroomId),
    });

    if (!classroom || !classroom.schoolId) {
      throw new Error('Clase no encontrada o no pertenece a una escuela');
    }

    // Verificar que el profesor sea miembro de la escuela
    const member = await this.getMemberByUserId(classroom.schoolId, teacherId);
    if (!member) {
      throw new Error('El profesor no es miembro de esta escuela');
    }

    await db.update(classrooms)
      .set({ teacherId, updatedAt: new Date() })
      .where(eq(classrooms.id, classroomId));
  }

  async updateSchoolClassroom(classroomId: string, schoolId: string, data: {
    name?: string;
    description?: string;
    teacherId?: string;
    gradeLevel?: string | null;
  }) {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, classroomId),
    });

    if (!classroom) {
      throw new Error('Clase no encontrada');
    }

    if (classroom.schoolId !== schoolId) {
      throw new Error('La clase no pertenece a esta escuela');
    }

    // Si se cambia el profesor, verificar que sea miembro de la escuela
    if (data.teacherId) {
      const member = await this.getMemberByUserId(schoolId, data.teacherId);
      if (!member) {
        throw new Error('El profesor no es miembro de esta escuela');
      }
    }

    await db.update(classrooms)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.teacherId && { teacherId: data.teacherId }),
        ...(data.gradeLevel !== undefined && { gradeLevel: data.gradeLevel }),
        updatedAt: new Date(),
      })
      .where(eq(classrooms.id, classroomId));

    // Obtener la clase actualizada
    const updatedClassroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, classroomId),
    });

    if (!updatedClassroom) return null;

    // Obtener el profesor por separado
    const teacher = updatedClassroom.teacherId 
      ? await db.query.users.findFirst({
          where: eq(users.id, updatedClassroom.teacherId),
          columns: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        })
      : null;

    return {
      ...updatedClassroom,
      teacher,
    };
  }

  async deleteSchoolClassroom(classroomId: string, schoolId: string) {
    const classroom = await db.query.classrooms.findFirst({
      where: and(
        eq(classrooms.id, classroomId),
        eq(classrooms.schoolId, schoolId)
      ),
    });

    if (!classroom) {
      throw new Error('Clase no encontrada o no pertenece a esta escuela');
    }

    // Verificar si hay estudiantes inscritos
    const students = await db.query.studentProfiles.findMany({
      where: and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true)
      ),
    });

    if (students.length > 0) {
      throw new Error(`No se puede eliminar la clase porque tiene ${students.length} estudiantes inscritos. Primero desinscribe a los estudiantes.`);
    }

    // Eliminar la clase (soft delete - marcar como inactiva)
    await db.update(classrooms)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(classrooms.id, classroomId));
  }

  // ==================== ESTUDIANTES ====================

  async createStudent(data: CreateStudentData) {
    const id = uuidv4();
    const now = new Date();

    // Verificar que la clase pertenezca a la escuela
    const classroom = await db.query.classrooms.findFirst({
      where: and(
        eq(classrooms.id, data.classroomId),
        eq(classrooms.schoolId, data.schoolId)
      ),
    });

    if (!classroom) {
      throw new Error('La clase no pertenece a esta escuela');
    }

    // Generar código de vinculación
    const linkCode = this.generateLinkCode();

    await db.insert(studentProfiles).values({
      id,
      classroomId: data.classroomId,
      displayName: data.displayName,
      characterClass: data.characterClass,
      avatarGender: data.avatarGender || 'MALE',
      linkCode,
      xp: classroom.defaultXp || 0,
      hp: classroom.defaultHp || 100,
      gp: classroom.defaultGp || 0,
      level: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, id),
    });
  }

  async bulkCreateStudents(schoolId: string, classroomId: string, students: Array<{
    displayName: string;
    characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
    avatarGender?: 'MALE' | 'FEMALE';
  }>) {
    const results = [];
    for (const student of students) {
      const created = await this.createStudent({
        schoolId,
        classroomId,
        ...student,
      });
      results.push(created);
    }
    return results;
  }

  async getStudents(schoolId: string) {
    // Obtener todas las clases de la escuela
    const schoolClassrooms = await db.query.classrooms.findMany({
      where: eq(classrooms.schoolId, schoolId),
    });

    if (schoolClassrooms.length === 0) {
      return [];
    }

    const classroomIds = schoolClassrooms.map(c => c.id);
    const classroomMap = new Map(schoolClassrooms.map(c => [c.id, c]));

    // Obtener todos los estudiantes de esas clases
    const students = await db.query.studentProfiles.findMany({
      where: inArray(studentProfiles.classroomId, classroomIds),
      orderBy: [desc(studentProfiles.createdAt)],
    });

    return students.map(s => ({
      ...s,
      classroom: classroomMap.get(s.classroomId),
    }));
  }

  async assignStudentToClassroom(schoolId: string, studentId: string, newClassroomId: string) {
    // Verificar que la nueva clase pertenezca a la escuela
    const classroom = await db.query.classrooms.findFirst({
      where: and(
        eq(classrooms.id, newClassroomId),
        eq(classrooms.schoolId, schoolId)
      ),
    });

    if (!classroom) {
      throw new Error('La clase no pertenece a esta escuela');
    }

    // Verificar que el estudiante pertenezca a una clase de esta escuela
    const student = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
    });

    if (!student) {
      throw new Error('Estudiante no encontrado');
    }

    const currentClassroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, student.classroomId),
    });

    if (!currentClassroom || currentClassroom.schoolId !== schoolId) {
      throw new Error('El estudiante no pertenece a esta escuela');
    }

    // Actualizar la clase del estudiante
    await db.update(studentProfiles)
      .set({ classroomId: newClassroomId, updatedAt: new Date() })
      .where(eq(studentProfiles.id, studentId));

    return db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
    });
  }

  async updateStudent(schoolId: string, studentId: string, data: {
    displayName?: string;
    characterClass?: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
    avatarGender?: 'MALE' | 'FEMALE';
    isActive?: boolean;
  }) {
    // Verificar que el estudiante pertenezca a una clase de esta escuela
    const student = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
    });

    if (!student) {
      throw new Error('Estudiante no encontrado');
    }

    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, student.classroomId),
    });

    if (!classroom || classroom.schoolId !== schoolId) {
      throw new Error('El estudiante no pertenece a esta escuela');
    }

    await db.update(studentProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(studentProfiles.id, studentId));

    return db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
    });
  }

  async deleteStudent(schoolId: string, studentId: string) {
    // Verificar que el estudiante pertenezca a una clase de esta escuela
    const student = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
    });

    if (!student) {
      throw new Error('Estudiante no encontrado');
    }

    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, student.classroomId),
    });

    if (!classroom || classroom.schoolId !== schoolId) {
      throw new Error('El estudiante no pertenece a esta escuela');
    }

    // Soft delete - desactivar estudiante
    await db.update(studentProfiles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(studentProfiles.id, studentId));
  }

  // ==================== COMPORTAMIENTOS GLOBALES ====================

  async getBehaviors(schoolId: string) {
    return db.query.schoolBehaviors.findMany({
      where: and(
        eq(schoolBehaviors.schoolId, schoolId),
        eq(schoolBehaviors.isActive, true)
      ),
    });
  }

  async createBehavior(schoolId: string, data: {
    name: string;
    description?: string;
    icon?: string;
    isPositive: boolean;
    xpValue: number;
    hpValue: number;
    gpValue: number;
  }) {
    const id = uuidv4();
    const now = new Date();

    await db.insert(schoolBehaviors).values({
      id,
      schoolId,
      name: data.name,
      description: data.description || null,
      icon: data.icon || '⭐',
      isPositive: data.isPositive,
      xpValue: data.xpValue,
      hpValue: data.hpValue,
      gpValue: data.gpValue,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return db.query.schoolBehaviors.findFirst({
      where: eq(schoolBehaviors.id, id),
    });
  }

  async updateBehavior(behaviorId: string, data: {
    name?: string;
    description?: string;
    icon?: string;
    isPositive?: boolean;
    xpValue?: number;
    hpValue?: number;
    gpValue?: number;
    isActive?: boolean;
  }) {
    await db.update(schoolBehaviors)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schoolBehaviors.id, behaviorId));
  }

  async deleteBehavior(behaviorId: string) {
    await db.update(schoolBehaviors)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schoolBehaviors.id, behaviorId));
  }

  // ==================== INSIGNIAS GLOBALES ====================

  async getBadges(schoolId: string) {
    return db.query.schoolBadges.findMany({
      where: and(
        eq(schoolBadges.schoolId, schoolId),
        eq(schoolBadges.isActive, true)
      ),
    });
  }

  async createBadge(schoolId: string, data: {
    name: string;
    description: string;
    icon: string;
    customImage?: string;
    category: 'PROGRESS' | 'PARTICIPATION' | 'SOCIAL' | 'SPECIAL' | 'CUSTOM';
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    xpReward?: number;
    gpReward?: number;
  }) {
    const id = uuidv4();
    const now = new Date();

    await db.insert(schoolBadges).values({
      id,
      schoolId,
      name: data.name,
      description: data.description,
      icon: data.icon,
      customImage: data.customImage || null,
      category: data.category,
      rarity: data.rarity,
      xpReward: data.xpReward || 0,
      gpReward: data.gpReward || 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return db.query.schoolBadges.findFirst({
      where: eq(schoolBadges.id, id),
    });
  }

  async updateBadge(badgeId: string, data: {
    name?: string;
    description?: string;
    icon?: string;
    customImage?: string;
    category?: 'PROGRESS' | 'PARTICIPATION' | 'SOCIAL' | 'SPECIAL' | 'CUSTOM';
    rarity?: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    xpReward?: number;
    gpReward?: number;
    isActive?: boolean;
  }) {
    await db.update(schoolBadges)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schoolBadges.id, badgeId));
  }

  async deleteBadge(badgeId: string) {
    await db.update(schoolBadges)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schoolBadges.id, badgeId));
  }

  // ==================== ESTADÍSTICAS ====================

  async getStats(schoolId: string) {
    // Contar miembros
    const [memberCount] = await db
      .select({ count: count() })
      .from(schoolMembers)
      .where(and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.isActive, true)
      ));

    // Contar clases
    const [classCount] = await db
      .select({ count: count() })
      .from(classrooms)
      .where(and(
        eq(classrooms.schoolId, schoolId),
        eq(classrooms.isActive, true)
      ));

    // Contar estudiantes
    const schoolClassrooms = await db.query.classrooms.findMany({
      where: eq(classrooms.schoolId, schoolId),
    });
    
    let studentCount = 0;
    if (schoolClassrooms.length > 0) {
      const classroomIds = schoolClassrooms.map(c => c.id);
      const [result] = await db
        .select({ count: count() })
        .from(studentProfiles)
        .where(inArray(studentProfiles.classroomId, classroomIds));
      studentCount = Number(result?.count || 0);
    }

    return {
      members: Number(memberCount?.count || 0),
      classrooms: Number(classCount?.count || 0),
      students: studentCount,
    };
  }

  // ==================== PERMISOS ====================

  async getUserSchools(userId: string) {
    const memberships = await db
      .select({
        schoolId: schoolMembers.schoolId,
        role: schoolMembers.role,
        canCreateClasses: schoolMembers.canCreateClasses,
        canManageStudents: schoolMembers.canManageStudents,
        schoolName: schools.name,
        schoolSlug: schools.slug,
        schoolLogo: schools.logoUrl,
        isActive: schools.isActive,
      })
      .from(schoolMembers)
      .innerJoin(schools, eq(schoolMembers.schoolId, schools.id))
      .where(and(
        eq(schoolMembers.userId, userId),
        eq(schoolMembers.isActive, true),
        eq(schools.isActive, true)
      ));

    return memberships;
  }

  async isSchoolAdmin(schoolId: string, userId: string): Promise<boolean> {
    const member = await this.getMemberByUserId(schoolId, userId);
    return member?.role === 'OWNER' || member?.role === 'ADMIN';
  }

  async canManageClassroom(schoolId: string, userId: string): Promise<boolean> {
    const member = await this.getMemberByUserId(schoolId, userId);
    if (!member) return false;
    return member.role === 'OWNER' || member.role === 'ADMIN' || member.canCreateClasses;
  }

  // ==================== GRADOS ====================

  async getGrades(schoolId: string) {
    const grades = await db.query.schoolGrades.findMany({
      where: and(
        eq(schoolGrades.schoolId, schoolId),
        eq(schoolGrades.isActive, true)
      ),
      orderBy: [asc(schoolGrades.level)],
    });

    // Obtener secciones para cada grado
    const gradeIds = grades.map(g => g.id);
    if (gradeIds.length === 0) return [];

    const sections = await db.query.schoolSections.findMany({
      where: and(
        inArray(schoolSections.gradeId, gradeIds),
        eq(schoolSections.isActive, true)
      ),
      orderBy: [asc(schoolSections.name)],
    });

    // Contar estudiantes por sección
    const sectionIds = sections.map(s => s.id);
    const studentCounts = sectionIds.length > 0 
      ? await db.select({
          sectionId: schoolStudents.sectionId,
          count: count(),
        })
        .from(schoolStudents)
        .where(and(
          inArray(schoolStudents.sectionId, sectionIds),
          eq(schoolStudents.isActive, true)
        ))
        .groupBy(schoolStudents.sectionId)
      : [];

    const countMap = new Map(studentCounts.map(sc => [sc.sectionId, Number(sc.count)]));

    // Agrupar secciones por grado
    const sectionsByGrade = new Map<string, typeof sections>();
    for (const section of sections) {
      const existing = sectionsByGrade.get(section.gradeId) || [];
      existing.push({ ...section, studentCount: countMap.get(section.id) || 0 } as any);
      sectionsByGrade.set(section.gradeId, existing);
    }

    return grades.map(g => ({
      ...g,
      sections: sectionsByGrade.get(g.id) || [],
    }));
  }

  async createGrade(schoolId: string, data: { name: string; level: number }) {
    const id = uuidv4();
    const now = new Date();

    await db.insert(schoolGrades).values({
      id,
      schoolId,
      name: data.name,
      level: data.level,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return db.query.schoolGrades.findFirst({
      where: eq(schoolGrades.id, id),
    });
  }

  async updateGrade(gradeId: string, data: { name?: string; level?: number }) {
    await db.update(schoolGrades)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schoolGrades.id, gradeId));

    return db.query.schoolGrades.findFirst({
      where: eq(schoolGrades.id, gradeId),
    });
  }

  async deleteGrade(gradeId: string) {
    // Verificar que no tenga secciones con estudiantes
    const sections = await db.query.schoolSections.findMany({
      where: eq(schoolSections.gradeId, gradeId),
    });

    if (sections.length > 0) {
      const sectionIds = sections.map(s => s.id);
      const students = await db.query.schoolStudents.findFirst({
        where: and(
          inArray(schoolStudents.sectionId, sectionIds),
          eq(schoolStudents.isActive, true)
        ),
      });

      if (students) {
        throw new Error('No se puede eliminar un grado con estudiantes activos');
      }
    }

    // Soft delete
    await db.update(schoolGrades)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schoolGrades.id, gradeId));
  }

  // ==================== SECCIONES ====================

  async createSection(gradeId: string, data: { name: string }) {
    const id = uuidv4();
    const now = new Date();

    await db.insert(schoolSections).values({
      id,
      gradeId,
      name: data.name,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return db.query.schoolSections.findFirst({
      where: eq(schoolSections.id, id),
    });
  }

  async updateSection(sectionId: string, data: { name?: string }) {
    await db.update(schoolSections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schoolSections.id, sectionId));

    return db.query.schoolSections.findFirst({
      where: eq(schoolSections.id, sectionId),
    });
  }

  async deleteSection(sectionId: string) {
    // Verificar que no tenga estudiantes
    const students = await db.query.schoolStudents.findFirst({
      where: and(
        eq(schoolStudents.sectionId, sectionId),
        eq(schoolStudents.isActive, true)
      ),
    });

    if (students) {
      throw new Error('No se puede eliminar una sección con estudiantes activos');
    }

    await db.update(schoolSections)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schoolSections.id, sectionId));
  }

  // ==================== ESTUDIANTES DE ESCUELA (NUEVO) ====================

  async getSchoolStudents(schoolId: string, sectionId?: string) {
    const conditions = [
      eq(schoolStudents.schoolId, schoolId),
      eq(schoolStudents.isActive, true),
    ];

    if (sectionId) {
      conditions.push(eq(schoolStudents.sectionId, sectionId));
    }

    const students = await db.query.schoolStudents.findMany({
      where: and(...conditions),
      orderBy: [asc(schoolStudents.lastName), asc(schoolStudents.firstName)],
    });

    // Obtener info de secciones y grados
    const sectionIds = [...new Set(students.map(s => s.sectionId))];
    if (sectionIds.length === 0) return [];

    const sections = await db.query.schoolSections.findMany({
      where: inArray(schoolSections.id, sectionIds),
    });

    const gradeIds = [...new Set(sections.map(s => s.gradeId))];
    const grades = await db.query.schoolGrades.findMany({
      where: inArray(schoolGrades.id, gradeIds),
    });

    const sectionMap = new Map(sections.map(s => [s.id, s]));
    const gradeMap = new Map(grades.map(g => [g.id, g]));

    // Contar inscripciones a clases por estudiante
    const studentIds = students.map(s => s.id);
    const enrollmentCounts = await db.select({
      schoolStudentId: studentProfiles.schoolStudentId,
      count: count(),
    })
    .from(studentProfiles)
    .where(and(
      inArray(studentProfiles.schoolStudentId, studentIds),
      eq(studentProfiles.isActive, true)
    ))
    .groupBy(studentProfiles.schoolStudentId);

    const enrollmentMap = new Map(enrollmentCounts.map(e => [e.schoolStudentId, Number(e.count)]));

    return students.map(s => {
      const section = sectionMap.get(s.sectionId);
      const grade = section ? gradeMap.get(section.gradeId) : null;
      return {
        ...s,
        section,
        grade,
        enrolledClasses: enrollmentMap.get(s.id) || 0,
      };
    });
  }

  async createSchoolStudent(schoolId: string, data: {
    sectionId: string;
    firstName: string;
    lastName: string;
    email: string;
    studentCode?: string;
    dni?: string;
  }) {
    const id = uuidv4();
    const now = new Date();
    const normalizedEmail = data.email.toLowerCase().trim();
    
    // Generar contraseña temporal
    const tempPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Verificar que la sección pertenezca a la escuela
    const section = await db.query.schoolSections.findFirst({
      where: eq(schoolSections.id, data.sectionId),
    });

    if (!section) {
      throw new Error('Sección no encontrada');
    }

    const grade = await db.query.schoolGrades.findFirst({
      where: eq(schoolGrades.id, section.gradeId),
    });

    if (!grade || grade.schoolId !== schoolId) {
      throw new Error('La sección no pertenece a esta escuela');
    }

    // Verificar que el email no exista en la escuela
    const existingStudent = await db.query.schoolStudents.findFirst({
      where: and(
        eq(schoolStudents.schoolId, schoolId),
        eq(schoolStudents.email, normalizedEmail)
      ),
    });

    if (existingStudent) {
      throw new Error('Ya existe un estudiante con este email en la escuela');
    }

    // Crear usuario en la tabla users
    const userId = uuidv4();
    await db.insert(users).values({
      id: userId,
      email: normalizedEmail,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role: 'STUDENT',
      provider: 'LOCAL',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Crear estudiante de escuela
    await db.insert(schoolStudents).values({
      id,
      schoolId,
      sectionId: data.sectionId,
      userId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: normalizedEmail,
      dni: data.dni || null,
      tempPassword, // Guardar contraseña sin hashear para exportar
      studentCode: data.studentCode || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return db.query.schoolStudents.findFirst({
      where: eq(schoolStudents.id, id),
    });
  }

  async bulkCreateSchoolStudents(schoolId: string, sectionId: string, students: Array<{
    firstName: string;
    lastName: string;
    email: string;
    studentCode?: string;
    dni?: string;
  }>) {
    const results = [];
    const errors = [];

    for (const student of students) {
      try {
        const created = await this.createSchoolStudent(schoolId, {
          sectionId,
          ...student,
        });
        results.push(created);
      } catch (error: any) {
        errors.push({ student, error: error.message });
      }
    }

    return { created: results, errors };
  }

  async updateSchoolStudent(studentId: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    studentCode?: string;
    sectionId?: string;
    dni?: string;
  }) {
    const student = await db.query.schoolStudents.findFirst({
      where: eq(schoolStudents.id, studentId),
    });

    if (!student) {
      throw new Error('Estudiante no encontrado');
    }

    const updateData: any = { updatedAt: new Date() };
    
    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.studentCode !== undefined) updateData.studentCode = data.studentCode;
    if (data.dni !== undefined) updateData.dni = data.dni;
    if (data.sectionId) updateData.sectionId = data.sectionId;
    
    if (data.email) {
      const normalizedEmail = data.email.toLowerCase().trim();
      // Verificar que no exista otro estudiante con ese email
      const existing = await db.query.schoolStudents.findFirst({
        where: and(
          eq(schoolStudents.schoolId, student.schoolId),
          eq(schoolStudents.email, normalizedEmail)
        ),
      });
      if (existing && existing.id !== studentId) {
        throw new Error('Ya existe un estudiante con este email');
      }
      updateData.email = normalizedEmail;

      // Actualizar también en users
      if (student.userId) {
        await db.update(users)
          .set({ email: normalizedEmail, updatedAt: new Date() })
          .where(eq(users.id, student.userId));
      }
    }

    await db.update(schoolStudents)
      .set(updateData)
      .where(eq(schoolStudents.id, studentId));

    // Actualizar nombre en users si cambió
    if ((data.firstName || data.lastName) && student.userId) {
      const userUpdate: any = { updatedAt: new Date() };
      if (data.firstName) userUpdate.firstName = data.firstName;
      if (data.lastName) userUpdate.lastName = data.lastName;
      await db.update(users)
        .set(userUpdate)
        .where(eq(users.id, student.userId));
    }

    return db.query.schoolStudents.findFirst({
      where: eq(schoolStudents.id, studentId),
    });
  }

  async deleteSchoolStudent(studentId: string) {
    const student = await db.query.schoolStudents.findFirst({
      where: eq(schoolStudents.id, studentId),
    });

    if (!student) {
      throw new Error('Estudiante no encontrado');
    }

    // Desactivar estudiante
    await db.update(schoolStudents)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schoolStudents.id, studentId));

    // Desactivar usuario
    if (student.userId) {
      await db.update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(users.id, student.userId));
    }

    // Desactivar perfiles de estudiante
    await db.update(studentProfiles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(studentProfiles.schoolStudentId, studentId));
  }

  async resetStudentPassword(studentId: string) {
    const student = await db.query.schoolStudents.findFirst({
      where: eq(schoolStudents.id, studentId),
    });

    if (!student || !student.userId) {
      throw new Error('Estudiante no encontrado');
    }

    const newPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, student.userId));

    await db.update(schoolStudents)
      .set({ tempPassword: newPassword, updatedAt: new Date() })
      .where(eq(schoolStudents.id, studentId));

    return { tempPassword: newPassword };
  }

  async enrollStudentInClass(schoolStudentId: string, classroomId: string, characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST' = 'GUARDIAN') {
    const student = await db.query.schoolStudents.findFirst({
      where: eq(schoolStudents.id, schoolStudentId),
    });

    if (!student) {
      throw new Error('Estudiante no encontrado');
    }

    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, classroomId),
    });

    if (!classroom || classroom.schoolId !== student.schoolId) {
      throw new Error('La clase no pertenece a esta escuela');
    }

    // Verificar si ya está inscrito
    const existing = await db.query.studentProfiles.findFirst({
      where: and(
        eq(studentProfiles.schoolStudentId, schoolStudentId),
        eq(studentProfiles.classroomId, classroomId)
      ),
    });

    if (existing) {
      if (existing.isActive) {
        throw new Error('El estudiante ya está inscrito en esta clase');
      }
      // Reactivar inscripción
      await db.update(studentProfiles)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(studentProfiles.id, existing.id));
      return existing;
    }

    // Crear perfil de estudiante
    const profileId = uuidv4();
    const now = new Date();
    const linkCode = this.generateLinkCode();

    await db.insert(studentProfiles).values({
      id: profileId,
      schoolStudentId,
      userId: student.userId,
      classroomId,
      characterClass,
      avatarGender: 'MALE',
      displayName: `${student.firstName} ${student.lastName}`,
      linkCode,
      xp: classroom.defaultXp || 0,
      hp: classroom.defaultHp || 100,
      gp: classroom.defaultGp || 0,
      level: 1,
      isActive: true,
      needsSetup: true, // El estudiante B2B necesita configurar su avatar y nombre de personaje
      createdAt: now,
      updatedAt: now,
    });

    return db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, profileId),
    });
  }

  async unenrollStudentFromClass(schoolStudentId: string, classroomId: string) {
    const profile = await db.query.studentProfiles.findFirst({
      where: and(
        eq(studentProfiles.schoolStudentId, schoolStudentId),
        eq(studentProfiles.classroomId, classroomId)
      ),
    });

    if (!profile) {
      throw new Error('El estudiante no está inscrito en esta clase');
    }

    await db.update(studentProfiles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(studentProfiles.id, profile.id));
  }

  async getStudentEnrollments(schoolStudentId: string) {
    const profiles = await db.query.studentProfiles.findMany({
      where: and(
        eq(studentProfiles.schoolStudentId, schoolStudentId),
        eq(studentProfiles.isActive, true)
      ),
    });

    const classroomIds = profiles.map(p => p.classroomId);
    if (classroomIds.length === 0) return [];

    const classroomsList = await db.query.classrooms.findMany({
      where: inArray(classrooms.id, classroomIds),
    });

    const classroomMap = new Map(classroomsList.map(c => [c.id, c]));

    return profiles.map(p => ({
      ...p,
      classroom: classroomMap.get(p.classroomId),
    }));
  }

  async bulkEnrollStudentsInClass(schoolId: string, classroomId: string, studentIds: string[]) {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, classroomId),
    });

    if (!classroom || classroom.schoolId !== schoolId) {
      throw new Error('La clase no pertenece a esta escuela');
    }

    const results = [];
    const errors = [];

    for (const studentId of studentIds) {
      try {
        const result = await this.enrollStudentInClass(studentId, classroomId);
        results.push({ studentId, success: true, profile: result });
      } catch (error: any) {
        errors.push({ studentId, error: error.message });
      }
    }

    return { enrolled: results.length, errors };
  }

  async bulkUnenrollStudentsFromClass(schoolId: string, classroomId: string, studentIds: string[]) {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, classroomId),
    });

    if (!classroom || classroom.schoolId !== schoolId) {
      throw new Error('La clase no pertenece a esta escuela');
    }

    const results = [];
    const errors = [];

    for (const studentId of studentIds) {
      try {
        await this.unenrollStudentFromClass(studentId, classroomId);
        results.push({ studentId, success: true });
      } catch (error: any) {
        errors.push({ studentId, error: error.message });
      }
    }

    return { unenrolled: results.length, errors };
  }

  async exportStudentsWithCredentials(schoolId: string, sectionId?: string) {
    const students = await this.getSchoolStudents(schoolId, sectionId);
    
    return students.map(s => ({
      dni: s.dni || '',
      nombre: s.firstName,
      apellido: s.lastName,
      email: s.email,
      contraseña: s.tempPassword || '(contraseña cambiada)',
      codigo: s.studentCode || '',
      grado: (s as any).grade?.name || '',
      seccion: (s as any).section?.name || '',
    }));
  }

  // ==================== HELPERS ====================

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  private generateClassCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private generateLinkCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}

export const schoolService = new SchoolService();
