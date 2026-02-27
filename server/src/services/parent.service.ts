import { db } from '../db/index.js';
import { 
  users, 
  parentProfiles, 
  parentStudentLinks, 
  studentProfiles,
  classrooms,
  studentGrades,
  pointLogs,
  behaviors,
  timedActivityResults,
  timedActivities,
  studentBadges,
  badges,
  curriculumCompetencies,
  attendanceRecords,
  purchases,
  shopItems,
  loginStreaks,
  teams,
  parentAiReports,
} from '../db/schema.js';
import { eq, and, desc, gte, lte, inArray, sql, count, sum } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { gradeService } from './grade.service.js';

interface ChildSummary {
  studentProfileId: string;
  studentName: string;
  classroomId: string;
  classroomName: string;
  teacherName: string;
  gradeLevel: string | null;
  averageGrade: string | null;
  averageScore: number | null;
  lastActivityDate: Date | null;
  alertCount: number;
  linkStatus: string;
}

interface ChildDetail {
  studentProfile: {
    id: string;
    displayName: string | null;
    characterName: string | null;
    level: number;
    createdAt: Date;
  };
  classroom: {
    id: string;
    name: string;
    teacherName: string;
    gradeLevel: string | null;
  };
  currentBimester: string;
  grades: Array<{
    competencyId: string;
    competencyName: string;
    score: number;
    gradeLabel: string;
  }>;
  recentActivity: Array<{
    type: string;
    description: string;
    date: Date;
    isPositive: boolean;
  }>;
  alerts: Array<{
    type: string;
    message: string;
    date: Date;
  }>;
}

interface ActivityLogItem {
  type: 'BEHAVIOR' | 'MISSION' | 'ACTIVITY' | 'BADGE';
  description: string;
  date: Date;
  isPositive: boolean;
  details?: string;
}

class ParentService {
  // ==================== IDOR VERIFICATION ====================

  async verifyTeacherOwnsStudent(teacherId: string, studentProfileId: string): Promise<boolean> {
    const [row] = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .innerJoin(classrooms, eq(studentProfiles.classroomId, classrooms.id))
      .where(and(
        eq(studentProfiles.id, studentProfileId),
        eq(classrooms.teacherId, teacherId)
      ))
      .limit(1);
    return !!row;
  }

  async verifyTeacherOwnsClassroom(teacherId: string, classroomId: string): Promise<boolean> {
    const [row] = await db.select({ id: classrooms.id })
      .from(classrooms)
      .where(and(
        eq(classrooms.id, classroomId),
        eq(classrooms.teacherId, teacherId)
      ))
      .limit(1);
    return !!row;
  }

  // ==================== REGISTRATION ====================

  // Registrar un nuevo padre
  async registerParent(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    relationship: 'FATHER' | 'MOTHER' | 'TUTOR' | 'GUARDIAN';
  }) {
    const now = new Date();
    const userId = uuidv4();
    const parentProfileId = uuidv4();
    
    // Verificar si el email ya existe
    const existingUser = await db.select().from(users).where(eq(users.email, data.email));
    if (existingUser.length > 0) {
      throw new Error('El correo electrónico ya está registrado');
    }
    
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    // Crear usuario
    await db.insert(users).values({
      id: userId,
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role: 'PARENT',
      provider: 'LOCAL',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    
    // Crear perfil de padre
    await db.insert(parentProfiles).values({
      id: parentProfileId,
      userId: userId,
      phone: data.phone || null,
      relationship: data.relationship,
      notifyByEmail: true,
      notifyWeeklySummary: true,
      notifyAlerts: true,
      createdAt: now,
      updatedAt: now,
    });
    
    return {
      userId,
      parentProfileId,
      email: data.email,
    };
  }
  
  // Obtener perfil de padre por userId
  async getParentProfile(userId: string) {
    const [profile] = await db.select()
      .from(parentProfiles)
      .where(eq(parentProfiles.userId, userId));
    
    return profile || null;
  }
  
  // Vincular hijo con código
  async linkChild(parentProfileId: string, linkCode: string) {
    const now = new Date();
    
    // Buscar estudiante por código de padre
    const [student] = await db.select()
      .from(studentProfiles)
      .where(eq(studentProfiles.parentLinkCode, linkCode));
    
    if (!student) {
      throw new Error('Código de vinculación inválido');
    }
    
    // Verificar si ya existe un vínculo
    const existingLink = await db.select()
      .from(parentStudentLinks)
      .where(and(
        eq(parentStudentLinks.parentProfileId, parentProfileId),
        eq(parentStudentLinks.studentProfileId, student.id)
      ));
    
    if (existingLink.length > 0) {
      if (existingLink[0].status === 'ACTIVE') {
        throw new Error('Este estudiante ya está vinculado a tu cuenta');
      }
      // Reactivar vínculo revocado
      await db.update(parentStudentLinks)
        .set({ 
          status: 'ACTIVE', 
          linkedAt: now,
          updatedAt: now 
        })
        .where(eq(parentStudentLinks.id, existingLink[0].id));
      
      return { linked: true, studentId: student.id };
    }
    
    // Crear nuevo vínculo
    const linkId = uuidv4();
    await db.insert(parentStudentLinks).values({
      id: linkId,
      parentProfileId,
      studentProfileId: student.id,
      status: 'ACTIVE',
      linkCode,
      linkedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    
    return { linked: true, studentId: student.id, linkId };
  }
  
  // Obtener lista de hijos vinculados (batched — no N+1)
  async getChildren(parentProfileId: string): Promise<ChildSummary[]> {
    const links = await db.select({
      linkId: parentStudentLinks.id,
      linkStatus: parentStudentLinks.status,
      studentProfileId: parentStudentLinks.studentProfileId,
      studentUserId: studentProfiles.userId,
      studentDisplayName: studentProfiles.displayName,
      studentCharacterName: studentProfiles.characterName,
      classroomId: studentProfiles.classroomId,
      classroomName: classrooms.name,
      gradeLevel: classrooms.gradeLevel,
      teacherId: classrooms.teacherId,
      currentBimester: classrooms.currentBimester,
    })
    .from(parentStudentLinks)
    .innerJoin(studentProfiles, eq(parentStudentLinks.studentProfileId, studentProfiles.id))
    .innerJoin(classrooms, eq(studentProfiles.classroomId, classrooms.id))
    .where(and(
      eq(parentStudentLinks.parentProfileId, parentProfileId),
      eq(parentStudentLinks.status, 'ACTIVE')
    ));

    if (links.length === 0) return [];

    // Batch: collect all user IDs we need (teachers + student accounts)
    const userIdsNeeded = new Set<string>();
    for (const link of links) {
      userIdsNeeded.add(link.teacherId);
      if (link.studentUserId) userIdsNeeded.add(link.studentUserId);
    }

    const userRows = userIdsNeeded.size > 0
      ? await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(inArray(users.id, [...userIdsNeeded]))
      : [];
    const userMap = new Map(userRows.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

    // Batch: get all grades for all student profiles in their current periods
    const studentIds = links.map(l => l.studentProfileId);
    const allGrades = await db.select({
      studentProfileId: studentGrades.studentProfileId,
      period: studentGrades.period,
      score: studentGrades.score,
    })
    .from(studentGrades)
    .where(inArray(studentGrades.studentProfileId, studentIds));

    // Batch: get last activity date per student (single aggregated query)
    const lastActivityRows = await db.select({
      studentId: pointLogs.studentId,
      lastDate: sql<Date>`MAX(${pointLogs.createdAt})`.as('lastDate'),
    })
    .from(pointLogs)
    .where(inArray(pointLogs.studentId, studentIds))
    .groupBy(pointLogs.studentId);
    const lastActivityMap = new Map(lastActivityRows.map(r => [r.studentId, r.lastDate]));

    // Build results from batched data
    return links.map(link => {
      const currentPeriod = link.currentBimester || 'CURRENT';
      const studentGradeRows = allGrades.filter(
        g => g.studentProfileId === link.studentProfileId && g.period === currentPeriod
      );

      let averageScore: number | null = null;
      let averageGrade: string | null = null;
      let alertCount = 0;

      if (studentGradeRows.length > 0) {
        const scores = studentGradeRows.map(g => parseFloat(g.score) || 0);
        averageScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        averageGrade = this.scoreToGradeLabel(averageScore);
        alertCount = scores.filter(s => s < 60).length;
      }

      const studentAccountName = link.studentUserId ? (userMap.get(link.studentUserId) || null) : null;
      const studentName = studentAccountName || link.studentDisplayName || link.studentCharacterName || 'Estudiante';

      return {
        studentProfileId: link.studentProfileId,
        studentName,
        classroomId: link.classroomId,
        classroomName: link.classroomName,
        teacherName: userMap.get(link.teacherId) || 'Profesor',
        gradeLevel: link.gradeLevel,
        averageGrade,
        averageScore: averageScore ? Math.round(averageScore) : null,
        lastActivityDate: lastActivityMap.get(link.studentProfileId) || null,
        alertCount,
        linkStatus: link.linkStatus,
      };
    });
  }
  
  // Obtener detalle de un hijo (batched — no N+1)
  async getChildDetail(parentProfileId: string, studentProfileId: string): Promise<ChildDetail | null> {
    // Verificar que el padre tiene acceso a este estudiante
    const [link] = await db.select()
      .from(parentStudentLinks)
      .where(and(
        eq(parentStudentLinks.parentProfileId, parentProfileId),
        eq(parentStudentLinks.studentProfileId, studentProfileId),
        eq(parentStudentLinks.status, 'ACTIVE')
      ));
    
    if (!link) {
      return null;
    }
    
    // Obtener perfil del estudiante
    const [student] = await db.select()
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));
    
    if (!student) {
      return null;
    }
    
    // Obtener classroom
    const [classroom] = await db.select({
      id: classrooms.id,
      name: classrooms.name,
      gradeLevel: classrooms.gradeLevel,
      teacherId: classrooms.teacherId,
      currentBimester: classrooms.currentBimester,
    })
    .from(classrooms)
    .where(eq(classrooms.id, student.classroomId));
    
    if (!classroom) {
      return null;
    }
    
    // Batch: fetch teacher + student account names in one query
    const userIdsToFetch: string[] = [];
    if (classroom.teacherId) userIdsToFetch.push(classroom.teacherId);
    if (student.userId) userIdsToFetch.push(student.userId);

    const userMap = new Map<string, string>();
    if (userIdsToFetch.length > 0) {
      const userRows = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(inArray(users.id, userIdsToFetch));
      for (const u of userRows) {
        userMap.set(u.id, `${u.firstName} ${u.lastName}`);
      }
    }

    const teacherName = (classroom.teacherId && userMap.get(classroom.teacherId)) || 'Profesor';
    const studentAccountName = student.userId ? (userMap.get(student.userId) || null) : null;
    
    // Obtener calificaciones con nombre real de competencias
    const currentPeriod = classroom.currentBimester || 'CURRENT';
    const gradesRaw = await db.select({
      competencyId: studentGrades.competencyId,
      score: studentGrades.score,
      gradeLabel: studentGrades.gradeLabel,
      competencyName: curriculumCompetencies.name,
    })
    .from(studentGrades)
    .leftJoin(curriculumCompetencies, eq(studentGrades.competencyId, curriculumCompetencies.id))
    .where(and(
      eq(studentGrades.studentProfileId, studentProfileId),
      eq(studentGrades.period, currentPeriod)
    ));
    
    // Convertir scores de string a number y calcular gradeLabel del score (para consistencia)
    const grades = gradesRaw.map(g => {
      const numericScore = parseFloat(g.score) || 0;
      return {
        competencyId: g.competencyId,
        competencyName: g.competencyName || 'Competencia',
        score: numericScore,
        gradeLabel: this.scoreToGradeLabel(numericScore),
      };
    });
    
    // Obtener actividad reciente del bimestre (~75 días)
    const bimesterStart = new Date();
    bimesterStart.setDate(bimesterStart.getDate() - 75);
    
    const recentActivity = await this.getRecentActivity(studentProfileId, bimesterStart, 20);
    
    // Generar alertas (incluir nombre de competencia)
    const alerts = grades
      .filter(g => g.score < 60)
      .map(g => ({
        type: 'LOW_GRADE',
        message: `${g.competencyName}: nota por debajo del promedio esperado (${g.gradeLabel})`,
        date: new Date(),
      }));
    
    // Prioridad: nombre de cuenta > displayName > characterName
    const studentName = studentAccountName || student.displayName || student.characterName || 'Estudiante';
    
    // Dynamic fallback period based on current year
    const fallbackPeriod = `${new Date().getFullYear()}-B1`;
    
    return {
      studentProfile: {
        id: student.id,
        displayName: studentName,
        characterName: student.characterName,
        level: student.level,
        createdAt: student.createdAt,
      },
      classroom: {
        id: classroom.id,
        name: classroom.name,
        teacherName,
        gradeLevel: classroom.gradeLevel,
      },
      currentBimester: classroom.currentBimester || fallbackPeriod,
      grades,
      recentActivity,
      alerts,
    };
  }
  
  // Obtener calificaciones por bimestre
  async getChildGrades(parentProfileId: string, studentProfileId: string, period?: string) {
    // Verificar acceso
    const [link] = await db.select()
      .from(parentStudentLinks)
      .where(and(
        eq(parentStudentLinks.parentProfileId, parentProfileId),
        eq(parentStudentLinks.studentProfileId, studentProfileId),
        eq(parentStudentLinks.status, 'ACTIVE')
      ));
    
    if (!link) {
      throw new Error('No tienes acceso a este estudiante');
    }
    
    // Obtener estudiante y classroom
    const [student] = await db.select()
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));
    
    if (!student) {
      throw new Error('Estudiante no encontrado');
    }
    
    const [classroom] = await db.select()
      .from(classrooms)
      .where(eq(classrooms.id, student.classroomId));
    
    if (!classroom) {
      throw new Error('Clase no encontrada');
    }
    
    const targetPeriod = period || classroom.currentBimester || 'CURRENT';
    
    // Obtener calificaciones con nombre de competencia
    const allGrades = await db.select({
      competencyId: studentGrades.competencyId,
      competencyName: curriculumCompetencies.name,
      period: studentGrades.period,
      score: studentGrades.score,
      gradeLabel: studentGrades.gradeLabel,
    })
    .from(studentGrades)
    .leftJoin(curriculumCompetencies, eq(studentGrades.competencyId, curriculumCompetencies.id))
    .where(eq(studentGrades.studentProfileId, studentProfileId));
    
    // Obtener actividades en vivo del período actual usando el grade service (parallelized)
    let liveActivities: Record<string, Array<{ type: string; name: string; score: number; weight: number }>> = {};
    try {
      const dateRange = await gradeService.getBimesterDateRange(student.classroomId, targetPeriod);
      const uniqueCompetencyIds = [...new Set(allGrades.map(g => g.competencyId))];

      const results = await Promise.all(
        uniqueCompetencyIds.map(async (compId) => {
          const scores = await gradeService.getStudentActivityScores(studentProfileId, compId, student.classroomId, dateRange);
          return { compId, activities: scores.map(s => ({ type: s.type, name: s.name, score: s.score, weight: s.weight })) };
        })
      );
      for (const r of results) {
        liveActivities[r.compId] = r.activities;
      }
    } catch {
      // Si falla, continuamos sin actividades
    }

    // Organizar por competencia y bimestre
    const gradesByCompetency: Record<string, {
      name: string;
      grades: Record<string, { score: number; label: string; activities?: Array<{ type: string; name: string; score: number; weight: number }> }>;
    }> = {};
    
    for (const grade of allGrades) {
      if (!gradesByCompetency[grade.competencyId]) {
        gradesByCompetency[grade.competencyId] = {
          name: grade.competencyName || 'Competencia',
          grades: {},
        };
      }
      const isCurrentPeriod = grade.period === targetPeriod;
      gradesByCompetency[grade.competencyId].grades[grade.period] = {
        score: parseFloat(grade.score) || 0,
        label: grade.gradeLabel || '',
        activities: isCurrentPeriod ? (liveActivities[grade.competencyId] || []) : [],
      };
    }
    
    return {
      studentName: student.displayName || student.characterName || 'Estudiante',
      classroomName: classroom.name,
      currentPeriod: targetPeriod,
      competencies: Object.entries(gradesByCompetency).map(([id, data]) => ({
        id,
        name: data.name,
        grades: data.grades,
      })),
    };
  }
  
  // Obtener historial de actividad
  async getChildActivity(
    parentProfileId: string, 
    studentProfileId: string, 
    startDate?: Date,
    endDate?: Date
  ): Promise<ActivityLogItem[]> {
    // Verificar acceso
    const [link] = await db.select()
      .from(parentStudentLinks)
      .where(and(
        eq(parentStudentLinks.parentProfileId, parentProfileId),
        eq(parentStudentLinks.studentProfileId, studentProfileId),
        eq(parentStudentLinks.status, 'ACTIVE')
      ));
    
    if (!link) {
      throw new Error('No tienes acceso a este estudiante');
    }
    
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();
    
    return this.getRecentActivity(studentProfileId, start, 50, end);
  }
  
  // Helper: Obtener actividad reciente con paginación
  private async getRecentActivity(
    studentProfileId: string, 
    startDate: Date,
    limit: number = 50,
    endDate?: Date
  ): Promise<ActivityLogItem[]> {
    const end = endDate || new Date();
    const activity: ActivityLogItem[] = [];
    const queryLimit = Math.min(limit, 30); // Límite por tipo de actividad
    
    // Comportamientos (puntos) - limitado, agrupando combinados
    const behaviorLogs = await db.select({
      behaviorId: pointLogs.behaviorId,
      behaviorName: behaviors.name,
      behaviorDescription: behaviors.description,
      action: pointLogs.action,
      amount: pointLogs.amount,
      pointType: pointLogs.pointType,
      createdAt: pointLogs.createdAt,
    })
    .from(pointLogs)
    .leftJoin(behaviors, eq(pointLogs.behaviorId, behaviors.id))
    .where(and(
      eq(pointLogs.studentId, studentProfileId),
      gte(pointLogs.createdAt, startDate),
      lte(pointLogs.createdAt, end)
    ))
    .orderBy(desc(pointLogs.createdAt))
    .limit(queryLimit * 3);
    
    // Agrupar pointLogs combinados (mismo behaviorId + createdAt)
    const groupedBehaviors = new Map<string, { behaviorName: string; behaviorDescription: string | null; action: string; createdAt: Date; points: string[] }>();
    for (const log of behaviorLogs) {
      if (!log.behaviorName || !log.createdAt || !log.behaviorId) continue;
      const key = `${log.behaviorId}_${new Date(log.createdAt).getTime()}`;
      if (!groupedBehaviors.has(key)) {
        groupedBehaviors.set(key, {
          behaviorName: log.behaviorName,
          behaviorDescription: log.behaviorDescription,
          action: log.action,
          createdAt: log.createdAt,
          points: [],
        });
      }
      groupedBehaviors.get(key)!.points.push(`${log.action === 'ADD' ? '+' : '-'}${log.amount} ${log.pointType}`);
    }

    for (const group of groupedBehaviors.values()) {
      const descLine = group.behaviorDescription
        ? `${group.behaviorDescription}`
        : undefined;
      activity.push({
        type: 'BEHAVIOR',
        description: group.action === 'ADD'
          ? `Recibió reconocimiento: "${group.behaviorName}"`
          : `Observación: "${group.behaviorName}"`,
        date: group.createdAt,
        isPositive: group.action === 'ADD',
        details: [descLine, group.points.join(', ')].filter(Boolean).join(' · '),
      });
    }
    
    // Actividades cronometradas - limitado
    const timedResults = await db.select({
      activityName: timedActivities.name,
      pointsAwarded: timedActivityResults.pointsAwarded,
      createdAt: timedActivityResults.createdAt,
    })
    .from(timedActivityResults)
    .leftJoin(timedActivities, eq(timedActivityResults.activityId, timedActivities.id))
    .where(and(
      eq(timedActivityResults.studentProfileId, studentProfileId),
      gte(timedActivityResults.createdAt, startDate),
      lte(timedActivityResults.createdAt, end)
    ))
    .limit(queryLimit);
    
    for (const result of timedResults) {
      if (result.createdAt) {
        activity.push({
          type: 'ACTIVITY',
          description: `Participó en: "${result.activityName}"`,
          date: result.createdAt,
          isPositive: true,
          details: result.pointsAwarded ? `Puntos: ${result.pointsAwarded}` : undefined,
        });
      }
    }
    
    // Insignias obtenidas - limitado
    const earnedBadges = await db.select({
      badgeName: badges.name,
      unlockedAt: studentBadges.unlockedAt,
    })
    .from(studentBadges)
    .leftJoin(badges, eq(studentBadges.badgeId, badges.id))
    .where(and(
      eq(studentBadges.studentProfileId, studentProfileId),
      gte(studentBadges.unlockedAt, startDate),
      lte(studentBadges.unlockedAt, end)
    ))
    .limit(queryLimit);
    
    for (const badge of earnedBadges) {
      if (badge.unlockedAt) {
        activity.push({
          type: 'BADGE',
          description: `Obtuvo reconocimiento: "${badge.badgeName}"`,
          date: badge.unlockedAt,
          isPositive: true,
        });
      }
    }
    
    // Filtrar, ordenar y aplicar límite final
    return activity
      .filter(a => a.date != null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }
  
  // ==================== REPORTE COMPLETO PARA PADRES ====================

  async getChildReport(parentProfileId: string, studentProfileId: string) {
    // Verificar acceso
    const [link] = await db.select()
      .from(parentStudentLinks)
      .where(and(
        eq(parentStudentLinks.parentProfileId, parentProfileId),
        eq(parentStudentLinks.studentProfileId, studentProfileId),
        eq(parentStudentLinks.status, 'ACTIVE')
      ));
    if (!link) throw new Error('Sin acceso a este estudiante');

    // Obtener perfil del estudiante
    const [student] = await db.select()
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));
    if (!student) throw new Error('Estudiante no encontrado');

    // Obtener classroom + teacher
    const [classroom] = await db.select({
      id: classrooms.id,
      name: classrooms.name,
      gradeLevel: classrooms.gradeLevel,
      teacherId: classrooms.teacherId,
      currentBimester: classrooms.currentBimester,
      defaultHp: classrooms.defaultHp,
      maxHp: classrooms.maxHp,
    }).from(classrooms).where(eq(classrooms.id, student.classroomId));
    if (!classroom) throw new Error('Clase no encontrada');

    // Teacher name
    let teacherName = 'Profesor';
    if (classroom.teacherId) {
      const [teacher] = await db.select({ firstName: users.firstName, lastName: users.lastName })
        .from(users).where(eq(users.id, classroom.teacherId));
      if (teacher) teacherName = `${teacher.firstName} ${teacher.lastName}`;
    }

    // Student display name
    let studentAccountName: string | null = null;
    if (student.userId) {
      const [u] = await db.select({ firstName: users.firstName, lastName: users.lastName })
        .from(users).where(eq(users.id, student.userId));
      if (u) studentAccountName = `${u.firstName} ${u.lastName}`;
    }
    const studentName = studentAccountName || student.displayName || student.characterName || 'Estudiante';

    // Date ranges
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ==================== PARALLEL QUERIES ====================
    const [
      allBehaviorLogs,
      badgesList,
      attendanceRows,
      purchaseRows,
      loginStreakRow,
      timedResults,
      teamRow,
      gradesRaw,
    ] = await Promise.all([
      // 1. All behavior logs (pointLogs) for this student
      db.select({
        behaviorId: pointLogs.behaviorId,
        behaviorName: behaviors.name,
        behaviorDescription: behaviors.description,
        behaviorIcon: behaviors.icon,
        isPositive: behaviors.isPositive,
        action: pointLogs.action,
        amount: pointLogs.amount,
        pointType: pointLogs.pointType,
        xpAmount: pointLogs.xpAmount,
        gpAmount: pointLogs.gpAmount,
        createdAt: pointLogs.createdAt,
      })
      .from(pointLogs)
      .leftJoin(behaviors, eq(pointLogs.behaviorId, behaviors.id))
      .where(eq(pointLogs.studentId, studentProfileId))
      .orderBy(desc(pointLogs.createdAt)),

      // 2. All badges earned
      db.select({
        badgeName: badges.name,
        badgeDescription: badges.description,
        badgeIcon: badges.icon,
        badgeRarity: badges.rarity,
        badgeCategory: badges.category,
        rewardXp: badges.rewardXp,
        rewardGp: badges.rewardGp,
        unlockedAt: studentBadges.unlockedAt,
        awardReason: studentBadges.awardReason,
      })
      .from(studentBadges)
      .leftJoin(badges, eq(studentBadges.badgeId, badges.id))
      .where(eq(studentBadges.studentProfileId, studentProfileId))
      .orderBy(desc(studentBadges.unlockedAt)),

      // 3. Attendance records
      db.select({
        date: attendanceRecords.date,
        status: attendanceRecords.status,
        xpAwarded: attendanceRecords.xpAwarded,
      })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.studentProfileId, studentProfileId))
      .orderBy(desc(attendanceRecords.date)),

      // 4. Purchases
      db.select({
        itemName: shopItems.name,
        itemCategory: shopItems.category,
        totalPrice: purchases.totalPrice,
        purchaseType: purchases.purchaseType,
        purchasedAt: purchases.purchasedAt,
      })
      .from(purchases)
      .leftJoin(shopItems, eq(purchases.itemId, shopItems.id))
      .where(eq(purchases.studentId, studentProfileId))
      .orderBy(desc(purchases.purchasedAt)),

      // 5. Login streak
      db.select()
        .from(loginStreaks)
        .where(and(
          eq(loginStreaks.studentProfileId, studentProfileId),
          eq(loginStreaks.classroomId, student.classroomId)
        ))
        .limit(1),

      // 6. Timed activity results
      db.select({
        activityName: timedActivities.name,
        pointsAwarded: timedActivityResults.pointsAwarded,
        elapsedSeconds: timedActivityResults.elapsedSeconds,
        wasExploded: timedActivityResults.wasExploded,
        createdAt: timedActivityResults.createdAt,
      })
      .from(timedActivityResults)
      .leftJoin(timedActivities, eq(timedActivityResults.activityId, timedActivities.id))
      .where(eq(timedActivityResults.studentProfileId, studentProfileId))
      .orderBy(desc(timedActivityResults.createdAt)),

      // 7. Team/clan info
      student.teamId
        ? db.select({ name: teams.name, totalXp: teams.totalXp, wins: teams.wins, losses: teams.losses })
            .from(teams).where(eq(teams.id, student.teamId)).limit(1)
        : Promise.resolve([]),

      // 8. Current grades
      db.select({
        competencyId: studentGrades.competencyId,
        score: studentGrades.score,
        gradeLabel: studentGrades.gradeLabel,
        competencyName: curriculumCompetencies.name,
      })
      .from(studentGrades)
      .leftJoin(curriculumCompetencies, eq(studentGrades.competencyId, curriculumCompetencies.id))
      .where(and(
        eq(studentGrades.studentProfileId, studentProfileId),
        eq(studentGrades.period, classroom.currentBimester || 'CURRENT')
      )),
    ]);

    // ==================== PROCESS BEHAVIORS ====================
    // Separate into positive and negative
    const positiveLogs = allBehaviorLogs.filter(l => l.action === 'ADD');
    const negativeLogs = allBehaviorLogs.filter(l => l.action === 'REMOVE');
    const recentPositive = positiveLogs.filter(l => l.createdAt && l.createdAt >= thirtyDaysAgo);
    const recentNegative = negativeLogs.filter(l => l.createdAt && l.createdAt >= thirtyDaysAgo);

    // Top positive behaviors (grouped by name)
    const positiveBehaviorMap = new Map<string, { name: string; description: string | null; icon: string | null; count: number; totalXp: number }>();
    for (const log of positiveLogs) {
      const key = log.behaviorName || 'Otro';
      const existing = positiveBehaviorMap.get(key);
      if (existing) {
        existing.count++;
        existing.totalXp += (log.xpAmount || log.amount || 0);
      } else {
        positiveBehaviorMap.set(key, {
          name: key,
          description: log.behaviorDescription,
          icon: log.behaviorIcon,
          count: 1,
          totalXp: log.xpAmount || log.amount || 0,
        });
      }
    }
    const topPositiveBehaviors = [...positiveBehaviorMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top negative behaviors
    const negativeBehaviorMap = new Map<string, { name: string; description: string | null; icon: string | null; count: number }>();
    for (const log of negativeLogs) {
      const key = log.behaviorName || 'Otro';
      const existing = negativeBehaviorMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        negativeBehaviorMap.set(key, {
          name: key,
          description: log.behaviorDescription,
          icon: log.behaviorIcon,
          count: 1,
        });
      }
    }
    const topNegativeBehaviors = [...negativeBehaviorMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Weekly activity pattern (last 30 days)
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    for (const log of allBehaviorLogs) {
      if (log.createdAt && log.createdAt >= thirtyDaysAgo) {
        dayOfWeekCounts[new Date(log.createdAt).getDay()]++;
      }
    }
    const dayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const weeklyPattern = dayLabels.map((label, i) => ({ day: label, count: dayOfWeekCounts[i] }));

    // XP earned over time (last 4 weeks, grouped by week)
    const xpByWeek: { weekLabel: string; xp: number }[] = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(now.getTime() - (w + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      let weekXp = 0;
      for (const log of positiveLogs) {
        if (log.createdAt && log.createdAt >= weekStart && log.createdAt < weekEnd) {
          weekXp += (log.xpAmount || log.amount || 0);
        }
      }
      const weekLabel = `Sem ${4 - w}`;
      xpByWeek.push({ weekLabel, xp: weekXp });
    }

    // ==================== PROCESS BADGES ====================
    const badgesSummary = badgesList.map(b => ({
      name: b.badgeName || 'Insignia',
      description: b.badgeDescription || '',
      icon: b.badgeIcon || '🏅',
      rarity: b.badgeRarity || 'COMMON',
      category: b.badgeCategory || 'SPECIAL',
      unlockedAt: b.unlockedAt,
      reason: b.awardReason,
    }));

    // ==================== PROCESS ATTENDANCE ====================
    const totalAttendance = attendanceRows.length;
    const presentCount = attendanceRows.filter(a => a.status === 'PRESENT').length;
    const absentCount = attendanceRows.filter(a => a.status === 'ABSENT').length;
    const lateCount = attendanceRows.filter(a => a.status === 'LATE').length;
    const excusedCount = attendanceRows.filter(a => a.status === 'EXCUSED').length;
    const attendanceRate = totalAttendance > 0 ? Math.round((presentCount + lateCount) / totalAttendance * 100) : null;

    // Recent attendance (last 30 days)
    const recentAttendance = attendanceRows
      .filter(a => a.date && a.date >= thirtyDaysAgo)
      .map(a => ({ date: a.date, status: a.status }));

    // ==================== PROCESS PURCHASES ====================
    const totalSpent = purchaseRows.reduce((sum, p) => sum + (p.totalPrice || 0), 0);
    const purchaseCount = purchaseRows.length;
    const recentPurchases = purchaseRows
      .filter(p => p.purchasedAt && p.purchasedAt >= thirtyDaysAgo)
      .map(p => ({
        itemName: p.itemName || 'Artículo',
        category: p.itemCategory,
        price: p.totalPrice,
        date: p.purchasedAt,
      }));

    // ==================== PROCESS LOGIN STREAK ====================
    const streak = loginStreakRow[0] || null;

    // ==================== PROCESS TIMED ACTIVITIES ====================
    const timedSummary = {
      total: timedResults.length,
      totalPoints: timedResults.reduce((s, r) => s + (r.pointsAwarded || 0), 0),
      exploded: timedResults.filter(r => r.wasExploded).length,
      recent: timedResults
        .filter(r => r.createdAt && r.createdAt >= thirtyDaysAgo)
        .map(r => ({
          name: r.activityName || 'Actividad',
          points: r.pointsAwarded || 0,
          seconds: r.elapsedSeconds,
          date: r.createdAt,
        })),
    };

    // ==================== PROCESS GRADES ====================
    const grades = gradesRaw.map(g => {
      const numericScore = parseFloat(g.score) || 0;
      return {
        competencyName: g.competencyName || 'Competencia',
        score: numericScore,
        gradeLabel: this.scoreToGradeLabel(numericScore),
      };
    });
    const averageScore = grades.length > 0
      ? Math.round(grades.reduce((s, g) => s + g.score, 0) / grades.length)
      : null;

    // ==================== TEAM/CLAN ====================
    const clan = teamRow[0] ? {
      name: teamRow[0].name,
      totalXp: teamRow[0].totalXp,
      wins: teamRow[0].wins,
      losses: teamRow[0].losses,
    } : null;

    // ==================== BUILD RESPONSE ====================
    return {
      studentName,
      classroomName: classroom.name,
      teacherName,
      gradeLevel: classroom.gradeLevel,
      currentBimester: classroom.currentBimester || 'CURRENT',
      generatedAt: now.toISOString(),

      // Perfil del estudiante
      profile: {
        level: student.level,
        xp: student.xp,
        hp: student.hp,
        maxHp: classroom.maxHp || 100,
        gp: student.gp,
        characterClass: student.characterClass,
      },

      // Resumen de comportamientos
      behaviors: {
        totalPositive: positiveLogs.length,
        totalNegative: negativeLogs.length,
        recentPositive: recentPositive.length,
        recentNegative: recentNegative.length,
        topPositive: topPositiveBehaviors,
        topNegative: topNegativeBehaviors,
        weeklyPattern,
        xpByWeek,
      },

      // Insignias
      badges: {
        total: badgesSummary.length,
        list: badgesSummary,
      },

      // Asistencia
      attendance: {
        total: totalAttendance,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        excused: excusedCount,
        rate: attendanceRate,
        recent: recentAttendance,
      },

      // Calificaciones
      grades: {
        list: grades,
        average: averageScore,
        averageLabel: averageScore !== null ? this.scoreToGradeLabel(averageScore) : null,
      },

      // Tienda
      shop: {
        totalSpent,
        purchaseCount,
        currentGp: student.gp,
        recentPurchases,
      },

      // Racha de login
      loginStreak: streak ? {
        current: streak.currentStreak,
        longest: streak.longestStreak,
        totalLogins: streak.totalLogins,
        lastLogin: streak.lastLoginDate,
      } : null,

      // Actividades cronometradas
      timedActivities: timedSummary,

      // Clan
      clan,
    };
  }

  // Desvincular hijo
  async unlinkChild(parentProfileId: string, studentProfileId: string) {
    const now = new Date();
    
    const [link] = await db.select()
      .from(parentStudentLinks)
      .where(and(
        eq(parentStudentLinks.parentProfileId, parentProfileId),
        eq(parentStudentLinks.studentProfileId, studentProfileId)
      ));
    
    if (!link) {
      throw new Error('Vínculo no encontrado');
    }
    
    await db.update(parentStudentLinks)
      .set({ 
        status: 'REVOKED',
        updatedAt: now,
      })
      .where(eq(parentStudentLinks.id, link.id));
    
    return { unlinked: true };
  }
  
  // Generar códigos de vinculación para TODOS los estudiantes de una clase (bulk)
  async generateBulkParentLinkCodes(classroomId: string): Promise<{
    students: { id: string; name: string; parentLinkCode: string }[];
    classroomName: string;
    classroomCode: string;
  }> {
    const now = new Date();

    // Obtener info de la clase
    const [cls] = await db.select({
      name: classrooms.name,
      code: classrooms.code,
    }).from(classrooms).where(eq(classrooms.id, classroomId));

    if (!cls) throw new Error('Clase no encontrada');

    // Obtener todos los estudiantes activos
    const students = await db.select({
      id: studentProfiles.id,
      characterName: studentProfiles.characterName,
      displayName: studentProfiles.displayName,
      parentLinkCode: studentProfiles.parentLinkCode,
    })
    .from(studentProfiles)
    .where(and(
      eq(studentProfiles.classroomId, classroomId),
      eq(studentProfiles.isActive, true),
      eq(studentProfiles.isDemo, false),
    ));

    const result: { id: string; name: string; parentLinkCode: string }[] = [];

    for (const student of students) {
      let code = student.parentLinkCode;
      // Solo generar código si no tiene uno
      if (!code) {
        code = this.generateCode();
        await db.update(studentProfiles)
          .set({ parentLinkCode: code, updatedAt: now })
          .where(eq(studentProfiles.id, student.id));
      }
      result.push({
        id: student.id,
        name: student.displayName || student.characterName || 'Sin nombre',
        parentLinkCode: code,
      });
    }

    // Ordenar alfabéticamente
    result.sort((a, b) => a.name.localeCompare(b.name));

    return {
      students: result,
      classroomName: cls.name,
      classroomCode: cls.code,
    };
  }

  // Generar código de vinculación para padre (llamado por profesor)
  async generateParentLinkCode(studentProfileId: string): Promise<string> {
    const code = this.generateCode();
    const now = new Date();
    
    await db.update(studentProfiles)
      .set({ 
        parentLinkCode: code,
        updatedAt: now,
      })
      .where(eq(studentProfiles.id, studentProfileId));
    
    return code;
  }
  
  // Helper: Generar código aleatorio
  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
  
  // Helper: Convertir score a etiqueta de nota
  // Rangos: AD (90-100), A (70-89), B (50-69), C (0-49)
  private scoreToGradeLabel(score: number): string {
    if (score >= 90) return 'AD';
    if (score >= 70) return 'A';
    if (score >= 50) return 'B';
    return 'C';
  }
  
  // Actualizar preferencias del padre
  async updatePreferences(parentProfileId: string, preferences: {
    phone?: string;
    relationship?: 'FATHER' | 'MOTHER' | 'TUTOR' | 'GUARDIAN';
    notifyByEmail?: boolean;
    notifyWeeklySummary?: boolean;
    notifyAlerts?: boolean;
  }) {
    const now = new Date();
    
    await db.update(parentProfiles)
      .set({
        ...preferences,
        updatedAt: now,
      })
      .where(eq(parentProfiles.id, parentProfileId));
    
    return { updated: true };
  }

  // ==================== INFORME INTELIGENTE (IA) ====================

  // Obtener informe IA (con cache de 24h)
  async getAIReport(parentProfileId: string, studentProfileId: string, forceRegenerate = false): Promise<AIStudentReport> {
    // Verificar acceso
    const [link] = await db.select()
      .from(parentStudentLinks)
      .where(and(
        eq(parentStudentLinks.parentProfileId, parentProfileId),
        eq(parentStudentLinks.studentProfileId, studentProfileId),
        eq(parentStudentLinks.status, 'ACTIVE')
      ));
    
    if (!link) {
      throw new Error('No tienes acceso a este estudiante');
    }

    const now = new Date();

    // Buscar cache válido (no expirado)
    if (!forceRegenerate) {
      const [cached] = await db.select()
        .from(parentAiReports)
        .where(and(
          eq(parentAiReports.parentProfileId, parentProfileId),
          eq(parentAiReports.studentProfileId, studentProfileId),
          gte(parentAiReports.expiresAt, now)
        ))
        .orderBy(desc(parentAiReports.generatedAt))
        .limit(1);

      if (cached) {
        const reportData = typeof cached.reportJson === 'string' 
          ? JSON.parse(cached.reportJson) 
          : cached.reportJson;
        return {
          ...(reportData as Omit<AIStudentReport, 'generatedAt' | 'expiresAt' | 'cached'>),
          generatedAt: cached.generatedAt,
          expiresAt: cached.expiresAt,
          cached: true,
        };
      }
    }

    // Obtener datos completos del reporte
    const reportData = await this.getChildReport(parentProfileId, studentProfileId);

    // Obtener info de classroom
    const [student] = await db.select().from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
    const [classroom] = await db.select().from(classrooms).where(eq(classrooms.id, student.classroomId));
    const usesCompetencies = classroom?.useCompetencies || false;

    // Generar informe con IA
    const aiResult = await this.callAIForReport(reportData, usesCompetencies);

    const generatedAt = new Date();
    const expiresAt = new Date(generatedAt.getTime() + 24 * 60 * 60 * 1000); // +24h

    const reportToCache: Omit<AIStudentReport, 'generatedAt' | 'expiresAt' | 'cached'> = {
      studentName: reportData.studentName,
      classroomName: reportData.classroomName,
      summary: aiResult.summary,
      behaviorAnalysis: aiResult.behaviorAnalysis,
      strengths: aiResult.strengths,
      areasToImprove: aiResult.areasToImprove,
      recommendations: aiResult.recommendations,
      predictions: aiResult.predictions,
      parentTips: aiResult.parentTips,
      weeklyHighlights: aiResult.weeklyHighlights,
      stats: {
        positiveActions: reportData.behaviors.totalPositive,
        negativeActions: reportData.behaviors.totalNegative,
        totalXP: reportData.behaviors.xpByWeek.reduce((s: number, w: any) => s + w.xp, 0),
        badges: reportData.badges.total,
        attendanceRate: reportData.attendance.rate ?? 0,
        averageGrade: reportData.grades.averageLabel,
        loginStreak: reportData.loginStreak?.current || 0,
      },
    };

    // Guardar en cache (upsert: eliminar anteriores y crear nuevo)
    await db.delete(parentAiReports)
      .where(and(
        eq(parentAiReports.parentProfileId, parentProfileId),
        eq(parentAiReports.studentProfileId, studentProfileId),
      ));

    await db.insert(parentAiReports).values({
      id: uuidv4(),
      parentProfileId,
      studentProfileId,
      reportJson: reportToCache,
      generatedAt,
      expiresAt,
    });

    return {
      ...reportToCache,
      generatedAt,
      expiresAt,
      cached: false,
    };
  }

  // Generar informe IA del estudiante (legacy, redirige al nuevo)
  async generateAIReport(parentProfileId: string, studentProfileId: string): Promise<AIStudentReport> {
    return this.getAIReport(parentProfileId, studentProfileId, true);
  }

  private async callAIForReport(reportData: any, usesCompetencies: boolean): Promise<{
    summary: string;
    behaviorAnalysis: string;
    strengths: string[];
    areasToImprove: string[];
    recommendations: string[];
    predictions: string;
    parentTips: string[];
    weeklyHighlights: string[];
  }> {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return this.generateFallbackReport(reportData, usesCompetencies);
      }

      const ai = new GoogleGenAI({ apiKey });

      // Construir contexto rico
      const gradeInfo = usesCompetencies && reportData.grades.list.length > 0
        ? `\nCALIFICACIONES POR COMPETENCIA:\n${reportData.grades.list.map((g: any) => `- ${g.competencyName}: ${g.gradeLabel} (${g.score}%)`).join('\n')}\nPromedio general: ${reportData.grades.average !== null ? reportData.grades.average.toFixed(1) + '%' : 'Sin datos'}`
        : '\nEsta clase no utiliza sistema de calificaciones por competencias.';

      const topPositive = reportData.behaviors.topPositive.slice(0, 3)
        .map((b: any) => `- ${b.name}: ${b.count} veces (positivo)${b.description ? ' — ' + b.description : ''}`)
        .join('\n');
      const topNegative = reportData.behaviors.topNegative.slice(0, 3)
        .map((b: any) => `- ${b.name}: ${b.count} veces (negativo)${b.description ? ' — ' + b.description : ''}`)
        .join('\n');
      const topBehaviors = [topPositive, topNegative].filter(Boolean).join('\n');

      const weeklyPattern = reportData.behaviors.weeklyPattern
        .map((d: any) => `${d.day}: ${d.count} registros`)
        .join(', ');


      const prompt = `Eres un asesor educativo experto que genera informes para padres de familia. Tu público son padres que NO son expertos en educación. Usa lenguaje sencillo, cálido y motivador. Todo en español.

DATOS COMPLETOS DEL ESTUDIANTE (últimos 7 días de análisis):

PERFIL:
- Nombre: ${reportData.studentName}
- Clase: ${reportData.classroomName}
- Nivel: ${reportData.profile.level} | XP: ${reportData.profile.xp} | HP: ${reportData.profile.hp}/${reportData.profile.maxHp} | Monedas: ${reportData.profile.gp}
- Clase de personaje: ${reportData.profile.characterClass || 'No asignada'}

COMPORTAMIENTO (últimos 30 días):
- Reconocimientos positivos: ${reportData.behaviors.totalPositive}
- Observaciones negativas: ${reportData.behaviors.totalNegative}
- Comportamientos más frecuentes:
${topBehaviors || '- Sin datos suficientes'}
- Patrón semanal de actividad: ${weeklyPattern}

TENDENCIA DE XP (últimas 4 semanas):
${reportData.behaviors.xpByWeek.map((w: any) => `Semana ${w.week}: ${w.xp} XP`).join(', ')}
${gradeInfo}

ASISTENCIA:
- Total de registros: ${reportData.attendance.total}
- Presente: ${reportData.attendance.present} | Ausente: ${reportData.attendance.absent} | Tarde: ${reportData.attendance.late} | Justificado: ${reportData.attendance.excused}
- Tasa de asistencia: ${reportData.attendance.rate}%

INSIGNIAS OBTENIDAS: ${reportData.badges.total} insignias
${reportData.badges.list.slice(0, 5).map((b: any) => `- ${b.name} (${b.rarity}): ${b.reason || 'Sin descripción'}`).join('\n') || '- Ninguna aún'}

RACHA DE INICIO DE SESIÓN: ${reportData.loginStreak ? `Actual: ${reportData.loginStreak.current} días, Mejor: ${reportData.loginStreak.longest} días` : 'Sin datos'}

ACTIVIDADES CRONOMETRADAS: ${reportData.timedActivities ? `${reportData.timedActivities.totalParticipations} participaciones, ${reportData.timedActivities.totalPoints} puntos` : 'Sin datos'}

TIENDA: ${reportData.shop.purchaseCount} compras realizadas, ${reportData.shop.totalSpent} monedas gastadas, ${reportData.shop.currentGp} monedas actuales

CLAN: ${reportData.clan ? `${reportData.clan.name} — XP: ${reportData.clan.totalXp}, Victorias: ${reportData.clan.wins}` : 'No pertenece a un clan'}

INSTRUCCIONES:
1. Genera un informe completo, empático y útil para el padre.
2. Sé específico: usa los datos reales, no generalices.
3. Si hay pocos datos, indícalo amablemente y da recomendaciones generales.
4. Las recomendaciones deben ser ACCIONABLES: cosas que el padre pueda hacer en casa.
5. El tono debe ser positivo pero honesto.
6. Los "weeklyHighlights" son 3-4 datos destacados de la semana en formato corto.

Responde SOLO con JSON válido (sin markdown, sin backticks), con esta estructura exacta:
{
  "summary": "Resumen general del desempeño en 3-4 oraciones. Menciona lo más relevante.",
  "behaviorAnalysis": "Análisis del comportamiento en 2-3 oraciones. Menciona patrones y tendencias.",
  "strengths": ["Fortaleza específica 1", "Fortaleza 2", "Fortaleza 3"],
  "areasToImprove": ["Área de mejora 1", "Área de mejora 2"],
  "recommendations": ["Recomendación accionable 1", "Recomendación 2", "Recomendación 3", "Recomendación 4"],
  "predictions": "Proyección positiva y realista basada en los datos actuales (2 oraciones)",
  "parentTips": ["Tip práctico para el padre 1", "Tip 2", "Tip 3"],
  "weeklyHighlights": ["Dato destacado 1", "Dato destacado 2", "Dato destacado 3"]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });

      const text = response.text?.trim() || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || 'Análisis en progreso.',
          behaviorAnalysis: parsed.behaviorAnalysis || '',
          strengths: parsed.strengths || [],
          areasToImprove: parsed.areasToImprove || [],
          recommendations: parsed.recommendations || [],
          predictions: parsed.predictions || '',
          parentTips: parsed.parentTips || [],
          weeklyHighlights: parsed.weeklyHighlights || [],
        };
      }
      
      return this.generateFallbackReport(reportData, usesCompetencies);
    } catch (error) {
      console.error('Error al generar informe IA:', error);
      return this.generateFallbackReport(reportData, usesCompetencies);
    }
  }

  private generateFallbackReport(reportData: any, usesCompetencies: boolean) {
    const isPositive = reportData.behaviors.totalPositive > reportData.behaviors.totalNegative;
    
    let summary = `${reportData.studentName} muestra un desempeño ${isPositive ? 'positivo' : 'con oportunidades de mejora'} en ${reportData.classroomName}.`;
    if (usesCompetencies && reportData.grades.average !== null) {
      summary += ` Su promedio actual es ${reportData.grades.average.toFixed(0)}%.`;
    }
    summary += ` Ha recibido ${reportData.behaviors.totalPositive} reconocimientos positivos.`;

    return {
      summary,
      behaviorAnalysis: isPositive 
        ? `El comportamiento general es bueno, con ${reportData.behaviors.totalPositive} reconocimientos positivos frente a ${reportData.behaviors.totalNegative} observaciones.`
        : `Se han registrado ${reportData.behaviors.totalNegative} observaciones que requieren atención, junto con ${reportData.behaviors.totalPositive} reconocimientos positivos.`,
      strengths: [
        reportData.behaviors.totalPositive > 0 ? 'Recibe reconocimientos de su profesor' : 'Participa en las actividades de clase',
        (reportData.attendance.rate ?? 0) >= 80 ? `Buena asistencia (${reportData.attendance.rate}%)` : 'Asiste a clases',
        `Ha alcanzado el nivel ${reportData.profile.level} en la plataforma`,
      ],
      areasToImprove: reportData.behaviors.totalNegative > 0 
        ? ['Atención en algunas áreas de comportamiento', 'Constancia en las actividades'] 
        : ['Mantener el buen desempeño', 'Seguir participando activamente'],
      recommendations: [
        'Establecer una rutina de estudio diaria',
        'Celebrar los logros y reconocimientos obtenidos',
        'Mantener comunicación con el profesor',
        'Revisar juntos el progreso en la plataforma',
      ],
      predictions: isPositive 
        ? 'Con su actitud actual, el estudiante tiene un gran potencial para seguir mejorando.'
        : 'Con apoyo constante, el estudiante puede mejorar significativamente su desempeño.',
      parentTips: [
        'Revise regularmente el progreso de su hijo en la plataforma',
        'Pregunte sobre las actividades y misiones completadas',
        'Celebre los logros, por pequeños que sean',
      ],
      weeklyHighlights: [
        `${reportData.behaviors.totalPositive + reportData.behaviors.totalNegative} actividades registradas`,
        `${reportData.badges.total} insignias obtenidas`,
        `Asistencia del ${reportData.attendance.rate}%`,
      ],
    };
  }
}

// Interfaz para el informe IA
interface AIStudentReport {
  studentName: string;
  classroomName: string;
  generatedAt: Date;
  expiresAt: Date;
  cached: boolean;
  summary: string;
  behaviorAnalysis: string;
  strengths: string[];
  areasToImprove: string[];
  recommendations: string[];
  predictions: string;
  parentTips: string[];
  weeklyHighlights: string[];
  stats: {
    positiveActions: number;
    negativeActions: number;
    totalXP: number;
    badges: number;
    attendanceRate: number;
    averageGrade: string | null;
    loginStreak: number;
  };
}

export const parentService = new ParentService();
