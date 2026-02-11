import { db } from '../db/index.js';
import { schools, schoolMembers, schoolVerifications, classrooms, users, schoolBehaviors, behaviors, schoolBadges, badges, curriculumAreas, pointLogs, attendanceRecords, studentProfiles, studentGrades } from '../db/schema.js';
import { eq, and, like, count, sql, desc, ne, inArray, gte, lte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface CreateSchoolData {
  name: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  googlePlaceId?: string;
  latitude?: string;
  longitude?: string;
}

interface CreateVerificationData {
  schoolId: string;
  position: string;
  documentUrls?: string[];
  details?: string;
}

export class SchoolService {
  // Buscar escuelas existentes en Juried
  async search(query: string) {
    const results = await db
      .select({
        id: schools.id,
        name: schools.name,
        address: schools.address,
        city: schools.city,
        province: schools.province,
        country: schools.country,
        logoUrl: schools.logoUrl,
        isVerified: schools.isVerified,
        memberCount: count(schoolMembers.id),
      })
      .from(schools)
      .leftJoin(schoolMembers, and(
        eq(schoolMembers.schoolId, schools.id),
        ne(schoolMembers.status, 'REJECTED')
      ))
      .where(and(
        like(schools.name, `%${query}%`),
        eq(schools.isActive, true),
        eq(schools.isVerified, true)
      ))
      .groupBy(schools.id)
      .limit(20);

    return results.map(r => ({ ...r, memberCount: Number(r.memberCount) }));
  }

  // Obtener escuela por ID
  async getById(id: string) {
    const [school] = await db
      .select()
      .from(schools)
      .where(eq(schools.id, id));
    return school || null;
  }

  // Obtener escuela por googlePlaceId
  async getByGooglePlaceId(placeId: string) {
    const [school] = await db
      .select()
      .from(schools)
      .where(eq(schools.googlePlaceId, placeId));
    return school || null;
  }

  // Crear escuela nueva
  async create(userId: string, data: CreateSchoolData) {
    const id = uuidv4();
    const now = new Date();

    await db.insert(schools).values({
      id,
      name: data.name,
      address: data.address || null,
      city: data.city || null,
      province: data.province || null,
      country: data.country || 'Perú',
      googlePlaceId: data.googlePlaceId || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      isVerified: false,
      isActive: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    // Crear membership como OWNER con estado PENDING_ADMIN
    const memberId = uuidv4();
    await db.insert(schoolMembers).values({
      id: memberId,
      schoolId: id,
      userId,
      role: 'OWNER',
      status: 'PENDING_ADMIN',
      createdAt: now,
      updatedAt: now,
    });

    return this.getById(id);
  }

  // Solicitar unirse a una escuela existente
  async requestJoin(userId: string, schoolId: string) {
    const existing = await this.getMembership(schoolId, userId);
    if (existing) {
      throw new Error('Ya tienes una solicitud o membresía en esta escuela');
    }

    const id = uuidv4();
    const now = new Date();

    await db.insert(schoolMembers).values({
      id,
      schoolId,
      userId,
      role: 'TEACHER',
      status: 'PENDING_OWNER',
      createdAt: now,
      updatedAt: now,
    });

    return { id, schoolId, status: 'PENDING_OWNER' };
  }

  // Obtener membresía de un usuario en una escuela
  async getMembership(schoolId: string, userId: string) {
    const [member] = await db
      .select()
      .from(schoolMembers)
      .where(and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.userId, userId)
      ));
    return member || null;
  }

  // Obtener escuelas del profesor (con su estado)
  async getMySchools(userId: string) {
    const results = await db
      .select({
        id: schools.id,
        name: schools.name,
        address: schools.address,
        city: schools.city,
        province: schools.province,
        country: schools.country,
        logoUrl: schools.logoUrl,
        isVerified: schools.isVerified,
        memberId: schoolMembers.id,
        memberRole: schoolMembers.role,
        memberStatus: schoolMembers.status,
        rejectionReason: schoolMembers.rejectionReason,
        memberCount: sql<number>`(SELECT COUNT(*) FROM school_members WHERE school_id = ${schools.id} AND school_member_status != 'REJECTED')`,
        classroomCount: sql<number>`(SELECT COUNT(*) FROM classrooms WHERE school_id = ${schools.id})`,
        pendingRequestCount: sql<number>`(SELECT COUNT(*) FROM school_members WHERE school_id = ${schools.id} AND school_member_status = 'PENDING_OWNER')`,
      })
      .from(schoolMembers)
      .innerJoin(schools, eq(schoolMembers.schoolId, schools.id))
      .where(eq(schoolMembers.userId, userId))
      .orderBy(desc(schoolMembers.createdAt));

    return results.map(r => ({
      ...r,
      memberCount: Number(r.memberCount),
      classroomCount: Number(r.classroomCount),
      pendingRequestCount: Number(r.pendingRequestCount),
    }));
  }

  // Obtener detalle de escuela con miembros
  async getSchoolDetail(schoolId: string) {
    const school = await this.getById(schoolId);
    if (!school) return null;

    const members = await db
      .select({
        id: schoolMembers.id,
        userId: schoolMembers.userId,
        role: schoolMembers.role,
        status: schoolMembers.status,
        joinedAt: schoolMembers.joinedAt,
        createdAt: schoolMembers.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(schoolMembers)
      .innerJoin(users, eq(schoolMembers.userId, users.id))
      .where(eq(schoolMembers.schoolId, schoolId))
      .orderBy(schoolMembers.role, schoolMembers.createdAt);

    const schoolClassrooms = await db
      .select({
        id: classrooms.id,
        name: classrooms.name,
        code: classrooms.code,
        gradeLevel: classrooms.gradeLevel,
        curriculumAreaId: classrooms.curriculumAreaId,
        curriculumAreaName: curriculumAreas.name,
        studentCount: sql<number>`(SELECT COUNT(*) FROM student_profiles WHERE classroom_id = ${classrooms.id})`,
      })
      .from(classrooms)
      .leftJoin(curriculumAreas, eq(classrooms.curriculumAreaId, curriculumAreas.id))
      .where(eq(classrooms.schoolId, schoolId));

    return { ...school, members, classrooms: schoolClassrooms };
  }

  // Aceptar/rechazar solicitud de unión (por el OWNER)
  async reviewJoinRequest(memberId: string, approved: boolean, reason?: string) {
    const now = new Date();

    await db.update(schoolMembers)
      .set({
        status: approved ? 'VERIFIED' : 'REJECTED',
        rejectionReason: approved ? null : (reason || null),
        joinedAt: approved ? now : null,
        updatedAt: now,
      })
      .where(eq(schoolMembers.id, memberId));
  }

  // Obtener solicitudes pendientes para el owner de una escuela
  async getPendingRequests(schoolId: string) {
    return db
      .select({
        id: schoolMembers.id,
        userId: schoolMembers.userId,
        status: schoolMembers.status,
        createdAt: schoolMembers.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(schoolMembers)
      .innerJoin(users, eq(schoolMembers.userId, users.id))
      .where(and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.status, 'PENDING_OWNER')
      ))
      .orderBy(schoolMembers.createdAt);
  }

  // Cancelar solicitud de unión
  async cancelJoinRequest(memberId: string, userId: string) {
    const [member] = await db
      .select()
      .from(schoolMembers)
      .where(and(
        eq(schoolMembers.id, memberId),
        eq(schoolMembers.userId, userId)
      ));

    if (!member) throw new Error('Solicitud no encontrada');
    if (member.status === 'VERIFIED') throw new Error('No puedes cancelar una membresía verificada desde aquí');

    await db.delete(schoolMembers).where(eq(schoolMembers.id, memberId));
  }

  // Asignar clase a escuela (auto-habilita competencias)
  async assignClassroom(classroomId: string, schoolId: string) {
    const now = new Date();
    await db.update(classrooms)
      .set({ schoolId, useCompetencies: true, updatedAt: now })
      .where(eq(classrooms.id, classroomId));
  }

  // Desasignar clase de escuela
  async unassignClassroom(classroomId: string) {
    const now = new Date();
    await db.update(classrooms)
      .set({ schoolId: null, updatedAt: now })
      .where(eq(classrooms.id, classroomId));
  }

  // Obtener profesores de la escuela con sus clases
  async getSchoolTeachers(schoolId: string) {
    // Obtener miembros verificados (no rechazados ni pendientes)
    const members = await db
      .select({
        id: schoolMembers.id,
        userId: schoolMembers.userId,
        role: schoolMembers.role,
        status: schoolMembers.status,
        joinedAt: schoolMembers.joinedAt,
        createdAt: schoolMembers.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(schoolMembers)
      .innerJoin(users, eq(schoolMembers.userId, users.id))
      .where(and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.status, 'VERIFIED')
      ))
      .orderBy(schoolMembers.role, users.firstName);

    // Obtener todas las clases de la escuela con teacherId
    const schoolClassrooms = await db
      .select({
        id: classrooms.id,
        name: classrooms.name,
        code: classrooms.code,
        gradeLevel: classrooms.gradeLevel,
        teacherId: classrooms.teacherId,
        useCompetencies: classrooms.useCompetencies,
        curriculumAreaId: classrooms.curriculumAreaId,
        curriculumAreaName: curriculumAreas.name,
        studentCount: sql<number>`(SELECT COUNT(*) FROM student_profiles WHERE classroom_id = ${classrooms.id})`,
        createdAt: classrooms.createdAt,
      })
      .from(classrooms)
      .leftJoin(curriculumAreas, eq(classrooms.curriculumAreaId, curriculumAreas.id))
      .where(eq(classrooms.schoolId, schoolId));

    // Agrupar clases por profesor
    const teacherClassrooms: Record<string, typeof schoolClassrooms> = {};
    schoolClassrooms.forEach((c) => {
      if (!teacherClassrooms[c.teacherId]) {
        teacherClassrooms[c.teacherId] = [];
      }
      teacherClassrooms[c.teacherId].push(c);
    });

    return members.map((member) => ({
      ...member,
      classrooms: teacherClassrooms[member.userId] || [],
    }));
  }

  // ==================== VERIFICACIONES ====================

  // Crear solicitud de verificación
  async createVerification(userId: string, data: CreateVerificationData) {
    const id = uuidv4();
    const now = new Date();

    await db.insert(schoolVerifications).values({
      id,
      schoolId: data.schoolId,
      userId,
      position: data.position,
      documentUrls: data.documentUrls || [],
      details: data.details || null,
      status: 'PENDING',
      createdAt: now,
    });

    return { id, status: 'PENDING' };
  }

  // Obtener verificación pendiente de un usuario para una escuela
  async getPendingVerification(schoolId: string, userId: string) {
    const [verification] = await db
      .select()
      .from(schoolVerifications)
      .where(and(
        eq(schoolVerifications.schoolId, schoolId),
        eq(schoolVerifications.userId, userId),
        eq(schoolVerifications.status, 'PENDING')
      ));
    return verification || null;
  }

  // ==================== ADMIN ====================

  // Obtener todas las verificaciones pendientes (para admin)
  async getAllPendingVerifications() {
    return db
      .select({
        id: schoolVerifications.id,
        schoolId: schoolVerifications.schoolId,
        userId: schoolVerifications.userId,
        position: schoolVerifications.position,
        documentUrls: schoolVerifications.documentUrls,
        details: schoolVerifications.details,
        status: schoolVerifications.status,
        createdAt: schoolVerifications.createdAt,
        schoolName: schools.name,
        schoolAddress: schools.address,
        schoolCity: schools.city,
        schoolCountry: schools.country,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(schoolVerifications)
      .innerJoin(schools, eq(schoolVerifications.schoolId, schools.id))
      .innerJoin(users, eq(schoolVerifications.userId, users.id))
      .where(eq(schoolVerifications.status, 'PENDING'))
      .orderBy(schoolVerifications.createdAt);
  }

  // Revisar verificación (admin)
  async reviewVerification(verificationId: string, adminId: string, approved: boolean, note?: string) {
    const now = new Date();

    // Obtener la verificación
    const [verification] = await db
      .select()
      .from(schoolVerifications)
      .where(eq(schoolVerifications.id, verificationId));

    if (!verification) throw new Error('Verificación no encontrada');

    // Actualizar verificación
    await db.update(schoolVerifications)
      .set({
        status: approved ? 'APPROVED' : 'REJECTED',
        reviewedBy: adminId,
        reviewNote: note || null,
        reviewedAt: now,
      })
      .where(eq(schoolVerifications.id, verificationId));

    if (approved) {
      // Marcar escuela como verificada
      await db.update(schools)
        .set({ isVerified: true, updatedAt: now })
        .where(eq(schools.id, verification.schoolId));

      // Aprobar al miembro
      await db.update(schoolMembers)
        .set({
          status: 'VERIFIED',
          joinedAt: now,
          updatedAt: now,
        })
        .where(and(
          eq(schoolMembers.schoolId, verification.schoolId),
          eq(schoolMembers.userId, verification.userId)
        ));
    } else {
      // Rechazar al miembro
      await db.update(schoolMembers)
        .set({
          status: 'REJECTED',
          rejectionReason: note || 'Verificación rechazada',
          updatedAt: now,
        })
        .where(and(
          eq(schoolMembers.schoolId, verification.schoolId),
          eq(schoolMembers.userId, verification.userId)
        ));
    }
  }

  // Obtener todas las escuelas con miembros (admin)
  async getAllSchoolsWithMembers() {
    const allSchools = await db
      .select({
        id: schools.id,
        name: schools.name,
        address: schools.address,
        city: schools.city,
        province: schools.province,
        country: schools.country,
        isVerified: schools.isVerified,
        isActive: schools.isActive,
        createdAt: schools.createdAt,
      })
      .from(schools)
      .orderBy(desc(schools.createdAt));

    const results = [];
    for (const school of allSchools) {
      const members = await db
        .select({
          id: schoolMembers.id,
          userId: schoolMembers.userId,
          role: schoolMembers.role,
          status: schoolMembers.status,
          joinedAt: schoolMembers.joinedAt,
          createdAt: schoolMembers.createdAt,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(schoolMembers)
        .innerJoin(users, eq(schoolMembers.userId, users.id))
        .where(and(
          eq(schoolMembers.schoolId, school.id),
          ne(schoolMembers.status, 'REJECTED')
        ))
        .orderBy(schoolMembers.role, schoolMembers.createdAt);

      results.push({ ...school, members });
    }

    return results;
  }

  // Obtener todas las escuelas (admin)
  async getAllSchools() {
    const results = await db
      .select({
        id: schools.id,
        name: schools.name,
        address: schools.address,
        city: schools.city,
        province: schools.province,
        country: schools.country,
        isVerified: schools.isVerified,
        isActive: schools.isActive,
        createdAt: schools.createdAt,
        memberCount: sql<number>`(SELECT COUNT(*) FROM school_members WHERE school_id = ${schools.id} AND school_member_status != 'REJECTED')`,
        pendingCount: sql<number>`(SELECT COUNT(*) FROM school_verifications WHERE school_id = ${schools.id} AND school_verification_status = 'PENDING')`,
      })
      .from(schools)
      .orderBy(desc(schools.createdAt));

    return results.map(r => ({
      ...r,
      memberCount: Number(r.memberCount),
      pendingCount: Number(r.pendingCount),
    }));
  }
  // ==================== COMPORTAMIENTOS DE ESCUELA ====================

  // Crear comportamiento de escuela (solo OWNER)
  async createSchoolBehavior(schoolId: string, userId: string, data: {
    name: string;
    description?: string;
    pointType: 'XP' | 'HP' | 'GP';
    pointValue: number;
    xpValue?: number;
    hpValue?: number;
    gpValue?: number;
    icon?: string;
  }) {
    const id = uuidv4();
    const now = new Date();

    const xpValue = data.xpValue ?? (data.pointType === 'XP' ? data.pointValue : 0);
    const hpValue = data.hpValue ?? (data.pointType === 'HP' ? data.pointValue : 0);
    const gpValue = data.gpValue ?? (data.pointType === 'GP' ? data.pointValue : 0);

    await db.insert(schoolBehaviors).values({
      id,
      schoolId,
      name: data.name,
      description: data.description || null,
      pointType: data.pointType,
      pointValue: data.pointValue,
      xpValue,
      hpValue,
      gpValue,
      icon: data.icon || null,
      isActive: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    return this.getSchoolBehaviorById(id);
  }

  // Obtener comportamiento por ID
  async getSchoolBehaviorById(id: string) {
    const [behavior] = await db
      .select()
      .from(schoolBehaviors)
      .where(eq(schoolBehaviors.id, id));
    return behavior || null;
  }

  // Obtener todos los comportamientos de una escuela
  async getSchoolBehaviors(schoolId: string) {
    return db
      .select()
      .from(schoolBehaviors)
      .where(and(
        eq(schoolBehaviors.schoolId, schoolId),
        eq(schoolBehaviors.isActive, true)
      ))
      .orderBy(schoolBehaviors.createdAt);
  }

  // Actualizar comportamiento de escuela
  async updateSchoolBehavior(id: string, data: {
    name?: string;
    description?: string | null;
    pointType?: 'XP' | 'HP' | 'GP';
    pointValue?: number;
    xpValue?: number;
    hpValue?: number;
    gpValue?: number;
    icon?: string | null;
  }) {
    const now = new Date();
    await db.update(schoolBehaviors)
      .set({ ...data, updatedAt: now })
      .where(eq(schoolBehaviors.id, id));
    return this.getSchoolBehaviorById(id);
  }

  // Eliminar (soft delete) comportamiento de escuela
  async deleteSchoolBehavior(id: string) {
    const now = new Date();
    await db.update(schoolBehaviors)
      .set({ isActive: false, updatedAt: now })
      .where(eq(schoolBehaviors.id, id));
  }

  // Importar comportamientos de escuela a clases del profesor
  async importBehaviorsToClassrooms(
    schoolBehaviorIds: string[],
    classroomIds: string[],
    userId: string
  ) {
    // Obtener los comportamientos de escuela seleccionados
    const schoolBehaviorList = await db
      .select()
      .from(schoolBehaviors)
      .where(and(
        inArray(schoolBehaviors.id, schoolBehaviorIds),
        eq(schoolBehaviors.isActive, true)
      ));

    if (schoolBehaviorList.length === 0) {
      throw new Error('No se encontraron comportamientos válidos');
    }

    // Verificar que las clases pertenecen al profesor
    const teacherClassrooms = await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(and(
        inArray(classrooms.id, classroomIds),
        eq(classrooms.teacherId, userId)
      ));

    if (teacherClassrooms.length === 0) {
      throw new Error('No se encontraron clases válidas');
    }

    const validClassroomIds = teacherClassrooms.map(c => c.id);
    const now = new Date();
    let imported = 0;

    // Crear comportamientos en cada clase
    for (const cls of validClassroomIds) {
      for (const sb of schoolBehaviorList) {
        const id = uuidv4();
        await db.insert(behaviors).values({
          id,
          classroomId: cls,
          name: sb.name,
          description: sb.description,
          pointType: sb.pointType,
          pointValue: sb.pointValue,
          xpValue: sb.xpValue,
          hpValue: sb.hpValue,
          gpValue: sb.gpValue,
          isPositive: true, // School behaviors son siempre positivos
          icon: sb.icon,
          isActive: true,
          competencyId: null,
          schoolBehaviorId: sb.id,
          createdAt: now,
        });
        imported++;
      }
    }

    return { imported, classrooms: validClassroomIds.length, behaviors: schoolBehaviorList.length };
  }

  // ==================== INSIGNIAS DE ESCUELA ====================

  // Crear insignia de escuela (solo OWNER)
  async createSchoolBadge(schoolId: string, userId: string, data: {
    name: string;
    description: string;
    icon: string;
    customImage?: string;
    category?: 'PROGRESS' | 'PARTICIPATION' | 'SOCIAL' | 'SHOP' | 'SPECIAL' | 'SECRET' | 'CUSTOM';
    rarity?: 'RARE' | 'EPIC' | 'LEGENDARY';
    assignmentMode?: 'MANUAL';
    unlockCondition?: any;
    rewardXp?: number;
    rewardGp?: number;
    isSecret?: boolean;
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
      category: data.category || 'CUSTOM',
      rarity: data.rarity || 'RARE',
      assignmentMode: 'MANUAL',
      unlockCondition: data.unlockCondition || null,
      rewardXp: data.rewardXp || 0,
      rewardGp: data.rewardGp || 0,
      isSecret: data.isSecret || false,
      isActive: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    return this.getSchoolBadgeById(id);
  }

  // Obtener insignia por ID
  async getSchoolBadgeById(id: string) {
    const [badge] = await db
      .select()
      .from(schoolBadges)
      .where(eq(schoolBadges.id, id));
    return badge || null;
  }

  // Obtener todas las insignias de una escuela
  async getSchoolBadges(schoolId: string) {
    return db
      .select()
      .from(schoolBadges)
      .where(and(
        eq(schoolBadges.schoolId, schoolId),
        eq(schoolBadges.isActive, true)
      ))
      .orderBy(schoolBadges.createdAt);
  }

  // Actualizar insignia de escuela
  async updateSchoolBadge(id: string, data: {
    name?: string;
    description?: string;
    icon?: string;
    customImage?: string | null;
    category?: 'PROGRESS' | 'PARTICIPATION' | 'SOCIAL' | 'SHOP' | 'SPECIAL' | 'SECRET' | 'CUSTOM';
    rarity?: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    assignmentMode?: 'AUTOMATIC' | 'MANUAL' | 'BOTH';
    unlockCondition?: any;
    rewardXp?: number;
    rewardGp?: number;
    isSecret?: boolean;
  }) {
    const now = new Date();
    await db.update(schoolBadges)
      .set({ ...data, updatedAt: now })
      .where(eq(schoolBadges.id, id));
    return this.getSchoolBadgeById(id);
  }

  // Eliminar (soft delete) insignia de escuela
  async deleteSchoolBadge(id: string) {
    const now = new Date();
    await db.update(schoolBadges)
      .set({ isActive: false, updatedAt: now })
      .where(eq(schoolBadges.id, id));
  }

  // Importar insignias de escuela a clases del profesor
  async importBadgesToClassrooms(
    schoolBadgeIds: string[],
    classroomIds: string[],
    userId: string
  ) {
    // Obtener las insignias de escuela seleccionadas
    const schoolBadgeList = await db
      .select()
      .from(schoolBadges)
      .where(and(
        inArray(schoolBadges.id, schoolBadgeIds),
        eq(schoolBadges.isActive, true)
      ));

    if (schoolBadgeList.length === 0) {
      throw new Error('No se encontraron insignias válidas');
    }

    // Verificar que las clases pertenecen al profesor
    const teacherClassrooms = await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(and(
        inArray(classrooms.id, classroomIds),
        eq(classrooms.teacherId, userId)
      ));

    if (teacherClassrooms.length === 0) {
      throw new Error('No se encontraron clases válidas');
    }

    const validClassroomIds = teacherClassrooms.map(c => c.id);
    const now = new Date();
    let imported = 0;

    // Crear insignias en cada clase
    for (const cls of validClassroomIds) {
      for (const sb of schoolBadgeList) {
        const id = uuidv4();
        await db.insert(badges).values({
          id,
          scope: 'CLASSROOM' as const,
          classroomId: cls,
          createdBy: userId,
          name: sb.name,
          description: sb.description,
          icon: sb.icon,
          customImage: sb.customImage,
          category: sb.category as any,
          rarity: sb.rarity as any,
          assignmentMode: sb.assignmentMode as any,
          unlockCondition: sb.unlockCondition,
          rewardXp: sb.rewardXp,
          rewardGp: sb.rewardGp,
          maxAwards: 1,
          competencyId: null,
          schoolBadgeId: sb.id,
          isSecret: sb.isSecret,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        imported++;
      }
    }

    return { imported, classrooms: validClassroomIds.length, badges: schoolBadgeList.length };
  }

  // ==================== REPORTES DE ESCUELA ====================

  // Helper: obtener IDs de clases de la escuela
  private async getSchoolClassroomIds(schoolId: string): Promise<string[]> {
    const cls = await db.select({ id: classrooms.id })
      .from(classrooms)
      .where(eq(classrooms.schoolId, schoolId));
    return cls.map(c => c.id);
  }

  // Helper: obtener IDs de estudiantes de la escuela
  private async getSchoolStudentIds(classroomIds: string[]): Promise<string[]> {
    if (classroomIds.length === 0) return [];
    const students = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(inArray(studentProfiles.classroomId, classroomIds));
    return students.map(s => s.id);
  }

  // 1. Resumen general
  async getReportSummary(schoolId: string, startDate: Date, endDate: Date) {
    const classroomIds = await this.getSchoolClassroomIds(schoolId);
    if (classroomIds.length === 0) {
      return { totalStudents: 0, totalClasses: 0, avgXp: 0, avgHp: 0, avgGp: 0, totalPositivePoints: 0, totalNegativePoints: 0, attendanceRate: 0 };
    }

    // Total estudiantes y promedios
    const studentStats = await db.select({
      total: count(),
      avgXp: sql<number>`COALESCE(AVG(${studentProfiles.xp}), 0)`,
      avgHp: sql<number>`COALESCE(AVG(${studentProfiles.hp}), 0)`,
      avgGp: sql<number>`COALESCE(AVG(${studentProfiles.gp}), 0)`,
    }).from(studentProfiles)
      .where(inArray(studentProfiles.classroomId, classroomIds));

    const studentIds = await this.getSchoolStudentIds(classroomIds);

    // Puntos positivos (solo XP) y negativos (todos los tipos) en el período
    let totalPositive = 0;
    let totalNegative = 0;
    if (studentIds.length > 0) {
      const [posStats] = await db.select({
        total: sql<number>`COALESCE(SUM(ABS(${pointLogs.amount})), 0)`,
      }).from(pointLogs)
        .where(and(
          inArray(pointLogs.studentId, studentIds),
          eq(pointLogs.pointType, 'XP'),
          eq(pointLogs.action, 'ADD'),
          gte(pointLogs.createdAt, startDate),
          lte(pointLogs.createdAt, endDate),
        ));
      totalPositive = Number(posStats?.total || 0);

      const [negStats] = await db.select({
        total: sql<number>`COALESCE(SUM(ABS(${pointLogs.amount})), 0)`,
      }).from(pointLogs)
        .where(and(
          inArray(pointLogs.studentId, studentIds),
          eq(pointLogs.action, 'REMOVE'),
          gte(pointLogs.createdAt, startDate),
          lte(pointLogs.createdAt, endDate),
        ));
      totalNegative = Number(negStats?.total || 0);
    }

    // Tasa de asistencia en el período
    let attendanceRate = 0;
    const attendanceStats = await db.select({
      total: count(),
      present: sql<number>`SUM(CASE WHEN ${attendanceRecords.status} = 'PRESENT' THEN 1 ELSE 0 END)`,
    }).from(attendanceRecords)
      .where(and(
        inArray(attendanceRecords.classroomId, classroomIds),
        gte(attendanceRecords.date, startDate),
        lte(attendanceRecords.date, endDate),
      ));

    if (attendanceStats[0] && Number(attendanceStats[0].total) > 0) {
      attendanceRate = Math.round((Number(attendanceStats[0].present) / Number(attendanceStats[0].total)) * 100);
    }

    return {
      totalStudents: Number(studentStats[0]?.total || 0),
      totalClasses: classroomIds.length,
      avgXp: Math.round(Number(studentStats[0]?.avgXp || 0)),
      avgHp: Math.round(Number(studentStats[0]?.avgHp || 0)),
      avgGp: Math.round(Number(studentStats[0]?.avgGp || 0)),
      totalPositivePoints: totalPositive,
      totalNegativePoints: totalNegative,
      attendanceRate,
    };
  }

  // 2. Tendencias de comportamiento por día
  async getBehaviorTrends(schoolId: string, startDate: Date, endDate: Date, classroomId?: string) {
    const classroomIds = classroomId ? [classroomId] : await this.getSchoolClassroomIds(schoolId);
    if (classroomIds.length === 0) return [];

    const studentIds = await this.getSchoolStudentIds(classroomIds);
    if (studentIds.length === 0) return [];

    // Tendencias positivas (solo XP)
    const posTrends = await db.select({
      date: sql<string>`DATE(${pointLogs.createdAt})`,
      total: sql<number>`COALESCE(SUM(ABS(${pointLogs.amount})), 0)`,
      logCount: count(),
    }).from(pointLogs)
      .where(and(
        inArray(pointLogs.studentId, studentIds),
        eq(pointLogs.pointType, 'XP'),
        eq(pointLogs.action, 'ADD'),
        gte(pointLogs.createdAt, startDate),
        lte(pointLogs.createdAt, endDate),
      ))
      .groupBy(sql`DATE(${pointLogs.createdAt})`)
      .orderBy(sql`DATE(${pointLogs.createdAt})`);

    // Tendencias negativas (todos los tipos)
    const negTrends = await db.select({
      date: sql<string>`DATE(${pointLogs.createdAt})`,
      total: sql<number>`COALESCE(SUM(ABS(${pointLogs.amount})), 0)`,
      logCount: count(),
    }).from(pointLogs)
      .where(and(
        inArray(pointLogs.studentId, studentIds),
        eq(pointLogs.action, 'REMOVE'),
        gte(pointLogs.createdAt, startDate),
        lte(pointLogs.createdAt, endDate),
      ))
      .groupBy(sql`DATE(${pointLogs.createdAt})`)
      .orderBy(sql`DATE(${pointLogs.createdAt})`);

    // Agrupar por fecha
    const grouped: Record<string, { date: string; positive: number; negative: number; positiveCount: number; negativeCount: number }> = {};
    for (const t of posTrends) {
      const d = String(t.date);
      if (!grouped[d]) grouped[d] = { date: d, positive: 0, negative: 0, positiveCount: 0, negativeCount: 0 };
      grouped[d].positive = Number(t.total);
      grouped[d].positiveCount = Number(t.logCount);
    }
    for (const t of negTrends) {
      const d = String(t.date);
      if (!grouped[d]) grouped[d] = { date: d, positive: 0, negative: 0, positiveCount: 0, negativeCount: 0 };
      grouped[d].negative = Number(t.total);
      grouped[d].negativeCount = Number(t.logCount);
    }

    return Object.values(grouped);
  }

  // 3. Ranking de clases
  async getClassRanking(schoolId: string, startDate: Date, endDate: Date) {

    const schoolClassrooms = await db.select({
      id: classrooms.id,
      name: classrooms.name,
      gradeLevel: classrooms.gradeLevel,
      curriculumAreaId: classrooms.curriculumAreaId,
      curriculumAreaName: curriculumAreas.name,
    }).from(classrooms)
      .leftJoin(curriculumAreas, eq(classrooms.curriculumAreaId, curriculumAreas.id))
      .where(eq(classrooms.schoolId, schoolId));

    if (schoolClassrooms.length === 0) return [];

    const results = [];

    for (const cls of schoolClassrooms) {
      // Estudiantes de esta clase
      const students = await db.select({
        id: studentProfiles.id,
        xp: studentProfiles.xp,
        hp: studentProfiles.hp,
        gp: studentProfiles.gp,
      }).from(studentProfiles)
        .where(eq(studentProfiles.classroomId, cls.id));

      const studentIds = students.map(s => s.id);
      const studentCount = students.length;
      const avgXp = studentCount > 0 ? Math.round(students.reduce((sum, s) => sum + (s.xp || 0), 0) / studentCount) : 0;

      // Puntos positivos (solo XP) y negativos (todos los tipos)
      let positive = 0;
      let negative = 0;
      if (studentIds.length > 0) {
        const [posStats] = await db.select({
          total: sql<number>`COALESCE(SUM(ABS(${pointLogs.amount})), 0)`,
        }).from(pointLogs)
          .where(and(
            inArray(pointLogs.studentId, studentIds),
            eq(pointLogs.pointType, 'XP'),
            eq(pointLogs.action, 'ADD'),
            gte(pointLogs.createdAt, startDate),
            lte(pointLogs.createdAt, endDate),
          ));
        positive = Number(posStats?.total || 0);

        const [negStats] = await db.select({
          total: sql<number>`COALESCE(SUM(ABS(${pointLogs.amount})), 0)`,
        }).from(pointLogs)
          .where(and(
            inArray(pointLogs.studentId, studentIds),
            eq(pointLogs.action, 'REMOVE'),
            gte(pointLogs.createdAt, startDate),
            lte(pointLogs.createdAt, endDate),
          ));
        negative = Number(negStats?.total || 0);
      }

      // Asistencia
      const attendanceStats = await db.select({
        total: count(),
        present: sql<number>`SUM(CASE WHEN ${attendanceRecords.status} = 'PRESENT' THEN 1 ELSE 0 END)`,
      }).from(attendanceRecords)
        .where(and(
          eq(attendanceRecords.classroomId, cls.id),
          gte(attendanceRecords.date, startDate),
          lte(attendanceRecords.date, endDate),
        ));

      const attTotal = Number(attendanceStats[0]?.total || 0);
      const attPresent = Number(attendanceStats[0]?.present || 0);
      const attendanceRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0;

      results.push({
        classroomId: cls.id,
        name: cls.name,
        gradeLevel: cls.gradeLevel,
        curriculumAreaName: cls.curriculumAreaName,
        studentCount,
        avgXp,
        positivePoints: positive,
        negativePoints: negative,
        attendanceRate,
      });
    }

    // Ordenar por puntos positivos desc
    results.sort((a, b) => b.positivePoints - a.positivePoints);

    return results;
  }

  // 4. Comportamientos más usados
  async getTopBehaviors(schoolId: string, startDate: Date, endDate: Date) {
    const classroomIds = await this.getSchoolClassroomIds(schoolId);
    if (classroomIds.length === 0) return { positive: [], negative: [] };

    const studentIds = await this.getSchoolStudentIds(classroomIds);
    if (studentIds.length === 0) return { positive: [], negative: [] };

    const topBehaviors = await db.select({
      behaviorId: pointLogs.behaviorId,
      behaviorName: behaviors.name,
      behaviorIcon: behaviors.icon,
      isPositive: behaviors.isPositive,
      usageCount: count(),
      totalPoints: sql<number>`COALESCE(SUM(ABS(${pointLogs.amount})), 0)`,
    }).from(pointLogs)
      .innerJoin(behaviors, eq(pointLogs.behaviorId, behaviors.id))
      .where(and(
        inArray(pointLogs.studentId, studentIds),
        gte(pointLogs.createdAt, startDate),
        lte(pointLogs.createdAt, endDate),
      ))
      .groupBy(pointLogs.behaviorId, behaviors.name, behaviors.icon, behaviors.isPositive)
      .orderBy(desc(count()));

    const positive = topBehaviors
      .filter(b => b.isPositive)
      .slice(0, 10)
      .map(b => ({
        id: b.behaviorId,
        name: b.behaviorName,
        icon: b.behaviorIcon,
        usageCount: Number(b.usageCount),
        totalPoints: Number(b.totalPoints),
      }));

    const negative = topBehaviors
      .filter(b => !b.isPositive)
      .slice(0, 10)
      .map(b => ({
        id: b.behaviorId,
        name: b.behaviorName,
        icon: b.behaviorIcon,
        usageCount: Number(b.usageCount),
        totalPoints: Number(b.totalPoints),
      }));

    return { positive, negative };
  }

  // 5. Estudiantes que necesitan atención
  async getStudentsAtRisk(schoolId: string, startDate: Date, endDate: Date) {

    const schoolClassrooms = await db.select({
      id: classrooms.id,
      name: classrooms.name,
      maxHp: classrooms.maxHp,
    }).from(classrooms)
      .where(eq(classrooms.schoolId, schoolId));

    if (schoolClassrooms.length === 0) return [];

    const classroomIds = schoolClassrooms.map(c => c.id);
    const classroomMap = new Map(schoolClassrooms.map(c => [c.id, c]));

    // Estudiantes con HP bajo (< 30% del máximo) o con muchos puntos negativos
    const students = await db.select({
      id: studentProfiles.id,
      characterName: studentProfiles.characterName,
      classroomId: studentProfiles.classroomId,
      xp: studentProfiles.xp,
      hp: studentProfiles.hp,
      gp: studentProfiles.gp,
      level: studentProfiles.level,
      firstName: users.firstName,
      lastName: users.lastName,
    }).from(studentProfiles)
      .leftJoin(users, eq(studentProfiles.userId, users.id))
      .where(inArray(studentProfiles.classroomId, classroomIds));

    const atRisk = [];

    for (const student of students) {
      const cls = classroomMap.get(student.classroomId);
      const maxHp = cls?.maxHp || 100;
      const hpPercentage = Math.round(((student.hp || 0) / maxHp) * 100);

      // Puntos negativos en el período (todos los tipos)
      const negPoints = await db.select({
        total: sql<number>`COALESCE(SUM(ABS(${pointLogs.amount})), 0)`,
        logCount: count(),
      }).from(pointLogs)
        .where(and(
          eq(pointLogs.studentId, student.id),
          eq(pointLogs.action, 'REMOVE'),
          gte(pointLogs.createdAt, startDate),
          lte(pointLogs.createdAt, endDate),
        ));

      const negativeTotal = Number(negPoints[0]?.total || 0);
      const negativeCount = Number(negPoints[0]?.logCount || 0);

      // Asistencia del estudiante
      const attStats = await db.select({
        total: count(),
        absent: sql<number>`SUM(CASE WHEN ${attendanceRecords.status} = 'ABSENT' THEN 1 ELSE 0 END)`,
      }).from(attendanceRecords)
        .where(and(
          eq(attendanceRecords.studentProfileId, student.id),
          gte(attendanceRecords.date, startDate),
          lte(attendanceRecords.date, endDate),
        ));

      const attTotal = Number(attStats[0]?.total || 0);
      const absentCount = Number(attStats[0]?.absent || 0);
      const attendanceRate = attTotal > 0 ? Math.round(((attTotal - absentCount) / attTotal) * 100) : 100;

      // Criterios de riesgo
      const risks: string[] = [];
      if (hpPercentage < 30) risks.push('HP_LOW');
      if (negativeCount >= 5) risks.push('NEGATIVE_BEHAVIOR');
      if (attendanceRate < 70) risks.push('LOW_ATTENDANCE');

      if (risks.length > 0) {
        const realName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
        atRisk.push({
          studentId: student.id,
          displayName: realName || student.characterName || 'Estudiante',
          classroomId: student.classroomId,
          classroomName: cls?.name || '',
          hp: student.hp || 0,
          hpPercentage,
          xp: student.xp || 0,
          level: student.level || 1,
          negativePoints: negativeTotal,
          negativeCount,
          attendanceRate,
          risks,
        });
      }
    }

    // Ordenar por cantidad de riesgos (más riesgos primero)
    atRisk.sort((a, b) => b.risks.length - a.risks.length || a.hpPercentage - b.hpPercentage);

    return atRisk;
  }

  // 6. Reporte de asistencia por clase
  async getAttendanceReport(schoolId: string, startDate: Date, endDate: Date) {

    const schoolClassrooms = await db.select({
      id: classrooms.id,
      name: classrooms.name,
    }).from(classrooms)
      .where(eq(classrooms.schoolId, schoolId));

    if (schoolClassrooms.length === 0) return { byClass: [], weekly: [] };

    const classroomIds = schoolClassrooms.map(c => c.id);

    // Asistencia por clase
    const byClass = [];
    for (const cls of schoolClassrooms) {
      const stats = await db.select({
        total: count(),
        present: sql<number>`SUM(CASE WHEN ${attendanceRecords.status} = 'PRESENT' THEN 1 ELSE 0 END)`,
        absent: sql<number>`SUM(CASE WHEN ${attendanceRecords.status} = 'ABSENT' THEN 1 ELSE 0 END)`,
        late: sql<number>`SUM(CASE WHEN ${attendanceRecords.status} = 'LATE' THEN 1 ELSE 0 END)`,
        excused: sql<number>`SUM(CASE WHEN ${attendanceRecords.status} = 'EXCUSED' THEN 1 ELSE 0 END)`,
      }).from(attendanceRecords)
        .where(and(
          eq(attendanceRecords.classroomId, cls.id),
          gte(attendanceRecords.date, startDate),
          lte(attendanceRecords.date, endDate),
        ));

      const total = Number(stats[0]?.total || 0);
      byClass.push({
        classroomId: cls.id,
        name: cls.name,
        total,
        present: Number(stats[0]?.present || 0),
        absent: Number(stats[0]?.absent || 0),
        late: Number(stats[0]?.late || 0),
        excused: Number(stats[0]?.excused || 0),
        rate: total > 0 ? Math.round((Number(stats[0]?.present || 0) / total) * 100) : 0,
      });
    }

    // Tendencia semanal (agrupado por semana)
    const weekly = await db.select({
      week: sql<string>`DATE_FORMAT(${attendanceRecords.date}, '%x-W%v')`,
      weekStart: sql<string>`DATE(DATE_SUB(${attendanceRecords.date}, INTERVAL WEEKDAY(${attendanceRecords.date}) DAY))`,
      total: count(),
      present: sql<number>`SUM(CASE WHEN ${attendanceRecords.status} = 'PRESENT' THEN 1 ELSE 0 END)`,
    }).from(attendanceRecords)
      .where(and(
        inArray(attendanceRecords.classroomId, classroomIds),
        gte(attendanceRecords.date, startDate),
        lte(attendanceRecords.date, endDate),
      ))
      .groupBy(sql`DATE_FORMAT(${attendanceRecords.date}, '%x-W%v')`, sql`DATE(DATE_SUB(${attendanceRecords.date}, INTERVAL WEEKDAY(${attendanceRecords.date}) DAY))`)
      .orderBy(sql`DATE_FORMAT(${attendanceRecords.date}, '%x-W%v')`);

    const weeklyData = weekly.map(w => ({
      week: String(w.week),
      weekStart: String(w.weekStart),
      total: Number(w.total),
      present: Number(w.present),
      rate: Number(w.total) > 0 ? Math.round((Number(w.present) / Number(w.total)) * 100) : 0,
    }));

    return { byClass, weekly: weeklyData };
  }
}

export const schoolService = new SchoolService();
