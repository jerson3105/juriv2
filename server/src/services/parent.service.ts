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
  studentMissions,
  missions,
  timedActivityResults,
  timedActivities,
  studentBadges,
  badges,
  curriculumCompetencies,
} from '../db/schema.js';
import { eq, and, desc, gte, lte, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

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
  
  // Obtener lista de hijos vinculados
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
    
    const children: ChildSummary[] = [];
    
    for (const link of links) {
      // Obtener nombre del profesor
      const [teacher] = await db.select({
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(users).where(eq(users.id, link.teacherId));
      
      // Obtener nombre del estudiante desde su cuenta (si tiene)
      let studentAccountName: string | null = null;
      if (link.studentUserId) {
        const [studentUser] = await db.select({
          firstName: users.firstName,
          lastName: users.lastName,
        }).from(users).where(eq(users.id, link.studentUserId));
        if (studentUser) {
          studentAccountName = `${studentUser.firstName} ${studentUser.lastName}`;
        }
      }
      
      // Obtener promedio de calificaciones del período actual (si existen)
      const currentPeriod = link.currentBimester || 'CURRENT';
      const gradesRaw = await db.select({
        score: studentGrades.score,
      })
      .from(studentGrades)
      .where(and(
        eq(studentGrades.studentProfileId, link.studentProfileId),
        eq(studentGrades.period, currentPeriod)
      ));
      
      let averageScore: number | null = null;
      let averageGrade: string | null = null;
      let alertCount = 0;
      
      if (gradesRaw.length > 0) {
        // Convertir scores de string a number
        const scores = gradesRaw.map(g => parseFloat(g.score) || 0);
        averageScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        averageGrade = this.scoreToGradeLabel(averageScore);
        alertCount = scores.filter(s => s < 60).length;
      }
      
      // Obtener última actividad
      const [lastActivity] = await db.select({
        createdAt: pointLogs.createdAt,
      })
      .from(pointLogs)
      .where(eq(pointLogs.studentId, link.studentProfileId))
      .orderBy(desc(pointLogs.createdAt))
      .limit(1);
      
      // Prioridad: nombre de cuenta > displayName > characterName
      const studentName = studentAccountName || link.studentDisplayName || link.studentCharacterName || 'Estudiante';
      
      children.push({
        studentProfileId: link.studentProfileId,
        studentName,
        classroomId: link.classroomId,
        classroomName: link.classroomName,
        teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Profesor',
        gradeLevel: link.gradeLevel,
        averageGrade,
        averageScore: averageScore ? Math.round(averageScore) : null,
        lastActivityDate: lastActivity?.createdAt || null,
        alertCount,
        linkStatus: link.linkStatus,
      });
    }
    
    return children;
  }
  
  // Obtener detalle de un hijo
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
    
    // Obtener classroom y profesor
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
    
    let teacherName = 'Profesor';
    if (classroom.teacherId) {
      const [teacher] = await db.select({
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(users).where(eq(users.id, classroom.teacherId));
      if (teacher) {
        teacherName = `${teacher.firstName} ${teacher.lastName}`;
      }
    }
    
    // Obtener nombre del estudiante desde su cuenta (si tiene)
    let studentAccountName: string | null = null;
    if (student.userId) {
      const [studentUser] = await db.select({
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(users).where(eq(users.id, student.userId));
      if (studentUser) {
        studentAccountName = `${studentUser.firstName} ${studentUser.lastName}`;
      }
    }
    
    // Obtener calificaciones con nombre real de competencias
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
      eq(studentGrades.period, classroom.currentBimester || 'CURRENT')
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
    
    // Generar alertas
    const alerts = grades
      .filter(g => g.score < 60)
      .map(g => ({
        type: 'LOW_GRADE',
        message: `Nota por debajo del promedio esperado`,
        date: new Date(),
      }));
    
    // Prioridad: nombre de cuenta > displayName > characterName
    const studentName = studentAccountName || student.displayName || student.characterName || 'Estudiante';
    
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
      currentBimester: classroom.currentBimester || '2025-B1',
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
    
    // Organizar por competencia y bimestre
    const gradesByCompetency: Record<string, {
      name: string;
      grades: Record<string, { score: number; label: string }>;
    }> = {};
    
    for (const grade of allGrades) {
      if (!gradesByCompetency[grade.competencyId]) {
        gradesByCompetency[grade.competencyId] = {
          name: grade.competencyName || 'Competencia',
          grades: {},
        };
      }
      gradesByCompetency[grade.competencyId].grades[grade.period] = {
        score: parseFloat(grade.score) || 0,
        label: grade.gradeLabel || '',
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
    
    // Comportamientos (puntos) - limitado
    const behaviorLogs = await db.select({
      behaviorName: behaviors.name,
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
    .limit(queryLimit);
    
    for (const log of behaviorLogs) {
      if (log.behaviorName && log.createdAt) {
        activity.push({
          type: 'BEHAVIOR',
          description: log.action === 'ADD' 
            ? `Recibió reconocimiento: "${log.behaviorName}"`
            : `Observación: "${log.behaviorName}"`,
          date: log.createdAt,
          isPositive: log.action === 'ADD',
          details: `${log.action === 'ADD' ? '+' : '-'}${log.amount} ${log.pointType}`,
        });
      }
    }
    
    // Misiones completadas - limitado
    const completedMissions = await db.select({
      missionName: missions.name,
      status: studentMissions.status,
      completedAt: studentMissions.completedAt,
    })
    .from(studentMissions)
    .leftJoin(missions, eq(studentMissions.missionId, missions.id))
    .where(and(
      eq(studentMissions.studentProfileId, studentProfileId),
      eq(studentMissions.status, 'COMPLETED'),
      gte(studentMissions.completedAt, startDate),
      lte(studentMissions.completedAt, end)
    ))
    .limit(queryLimit);
    
    for (const mission of completedMissions) {
      if (mission.completedAt) {
        activity.push({
          type: 'MISSION',
          description: `Completó objetivo: "${mission.missionName}"`,
          date: mission.completedAt,
          isPositive: true,
        });
      }
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

  // Generar informe IA del estudiante
  async generateAIReport(parentProfileId: string, studentProfileId: string): Promise<AIStudentReport> {
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

    // Obtener datos del estudiante
    const childDetail = await this.getChildDetail(parentProfileId, studentProfileId);
    if (!childDetail) {
      throw new Error('No se encontró información del estudiante');
    }

    // Obtener actividades del bimestre
    const bimesterStart = new Date();
    bimesterStart.setDate(bimesterStart.getDate() - 75);
    const activities = await this.getRecentActivity(studentProfileId, bimesterStart, 100);

    // Obtener classroom para saber si usa competencias
    const [student] = await db.select().from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
    const [classroom] = await db.select().from(classrooms).where(eq(classrooms.id, student.classroomId));
    const usesCompetencies = classroom?.useCompetencies || false;

    // Calcular estadísticas
    const positiveActions = activities.filter(a => a.isPositive).length;
    const negativeActions = activities.filter(a => !a.isPositive).length;
    const totalXP = activities
      .filter(a => a.details?.includes('XP'))
      .reduce((sum, a) => {
        const match = a.details?.match(/([+-]?\d+)\s*XP/);
        return sum + (match ? parseInt(match[1]) : 0);
      }, 0);

    // Preparar contexto para la IA
    const contextData = {
      studentName: childDetail.studentProfile.displayName,
      classroomName: childDetail.classroom.name,
      level: childDetail.studentProfile.level,
      usesCompetencies,
      grades: usesCompetencies ? childDetail.grades : [],
      averageScore: usesCompetencies && childDetail.grades.length > 0
        ? childDetail.grades.reduce((sum, g) => sum + g.score, 0) / childDetail.grades.length
        : null,
      activities: activities.slice(0, 30), // Últimas 30 actividades para el contexto
      stats: {
        positiveActions,
        negativeActions,
        totalXP,
        totalActivities: activities.length,
        badges: activities.filter(a => a.type === 'BADGE').length,
        missionsCompleted: activities.filter(a => a.type === 'MISSION').length,
      }
    };

    // Generar informe con IA
    const report = await this.callAIForReport(contextData);

    return {
      studentName: childDetail.studentProfile.displayName || childDetail.studentProfile.characterName || 'Estudiante',
      classroomName: childDetail.classroom.name,
      generatedAt: new Date(),
      usesCompetencies,
      summary: report.summary,
      strengths: report.strengths,
      areasToImprove: report.areasToImprove,
      recommendations: report.recommendations,
      predictions: report.predictions,
      parentTips: report.parentTips,
      stats: contextData.stats,
    };
  }

  private async callAIForReport(contextData: any): Promise<{
    summary: string;
    strengths: string[];
    areasToImprove: string[];
    recommendations: string[];
    predictions: string;
    parentTips: string[];
  }> {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return this.generateFallbackReport(contextData);
      }

      const ai = new GoogleGenAI({ apiKey });

      const gradeInfo = contextData.usesCompetencies && contextData.averageScore !== null
        ? `\nCalificaciones: ${contextData.grades.map((g: any) => `${g.competencyName}: ${g.gradeLabel} (${g.score}%)`).join(', ')}\nPromedio: ${contextData.averageScore.toFixed(1)}%`
        : '\nEsta clase no utiliza sistema de calificaciones por competencias.';

      const prompt = `Eres un asistente educativo experto. Analiza el desempeño del estudiante y genera un informe para sus padres.

DATOS DEL ESTUDIANTE:
- Nombre: ${contextData.studentName}
- Clase: ${contextData.classroomName}
- Nivel en el juego: ${contextData.level}
${gradeInfo}

ESTADÍSTICAS DEL BIMESTRE:
- Acciones positivas (reconocimientos): ${contextData.stats.positiveActions}
- Observaciones (áreas de mejora): ${contextData.stats.negativeActions}
- XP total ganado: ${contextData.stats.totalXP}
- Insignias obtenidas: ${contextData.stats.badges}
- Misiones completadas: ${contextData.stats.missionsCompleted}
- Total de actividades: ${contextData.stats.totalActivities}

ACTIVIDADES RECIENTES:
${contextData.activities.slice(0, 15).map((a: any) => `- ${a.description}${a.details ? ` (${a.details})` : ''}`).join('\n')}

INSTRUCCIONES:
${contextData.usesCompetencies 
  ? 'Considera las calificaciones del estudiante para dar recomendaciones específicas de mejora académica.'
  : 'Enfócate en el comportamiento, participación y actitud del estudiante sin mencionar notas académicas.'}

Responde en formato JSON con esta estructura exacta (en español):
{
  "summary": "Resumen breve del desempeño general (2-3 oraciones)",
  "strengths": ["Fortaleza 1", "Fortaleza 2", "Fortaleza 3"],
  "areasToImprove": ["Área de mejora 1", "Área de mejora 2"],
  "recommendations": ["Recomendación específica 1", "Recomendación 2", "Recomendación 3"],
  "predictions": "Predicción positiva sobre el potencial del estudiante",
  "parentTips": ["Tip para padres 1", "Tip para padres 2", "Tip para padres 3"]
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
          strengths: parsed.strengths || [],
          areasToImprove: parsed.areasToImprove || [],
          recommendations: parsed.recommendations || [],
          predictions: parsed.predictions || '',
          parentTips: parsed.parentTips || [],
        };
      }
      
      return this.generateFallbackReport(contextData);
    } catch (error) {
      console.error('Error al generar informe IA:', error);
      return this.generateFallbackReport(contextData);
    }
  }

  private generateFallbackReport(contextData: any) {
    const isPositive = contextData.stats.positiveActions > contextData.stats.negativeActions;
    const hasGrades = contextData.usesCompetencies && contextData.averageScore !== null;
    
    let summary = `${contextData.studentName} muestra un desempeño ${isPositive ? 'positivo' : 'con oportunidades de mejora'} en ${contextData.classroomName}.`;
    if (hasGrades) {
      summary += ` Su promedio actual es ${contextData.averageScore.toFixed(0)}%.`;
    }

    return {
      summary,
      strengths: [
        contextData.stats.positiveActions > 0 ? 'Recibe reconocimientos de su profesor' : 'Participa en las actividades de clase',
        contextData.stats.missionsCompleted > 0 ? 'Completa misiones y objetivos' : 'Asiste regularmente a clases',
        `Ha alcanzado el nivel ${contextData.level} en la plataforma`,
      ],
      areasToImprove: contextData.stats.negativeActions > 0 
        ? ['Atención en algunas áreas de comportamiento', 'Constancia en las actividades'] 
        : ['Mantener el buen desempeño', 'Seguir participando activamente'],
      recommendations: [
        'Establecer una rutina de estudio diaria',
        'Celebrar los logros y reconocimientos obtenidos',
        'Mantener comunicación con el profesor',
      ],
      predictions: isPositive 
        ? 'Con su actitud actual, el estudiante tiene un gran potencial para seguir mejorando.'
        : 'Con apoyo constante, el estudiante puede mejorar significativamente su desempeño.',
      parentTips: [
        'Revise regularmente el progreso de su hijo en la plataforma',
        'Pregunte sobre las actividades y misiones completadas',
        'Celebre los logros, por pequeños que sean',
      ],
    };
  }
}

// Interfaz para el informe IA
interface AIStudentReport {
  studentName: string;
  classroomName: string;
  generatedAt: Date;
  usesCompetencies: boolean;
  summary: string;
  strengths: string[];
  areasToImprove: string[];
  recommendations: string[];
  predictions: string;
  parentTips: string[];
  stats: {
    positiveActions: number;
    negativeActions: number;
    totalXP: number;
    totalActivities: number;
    badges: number;
    missionsCompleted: number;
  };
}

export const parentService = new ParentService();
