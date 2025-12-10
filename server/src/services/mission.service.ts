import { eq, and, desc, gte, lte, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { 
  missions, 
  studentMissions, 
  studentStreaks,
  studentProfiles,
  pointLogs,
  notifications,
  type Mission,
  type StudentMission,
  type StudentStreak,
  type MissionType,
  type MissionCategory,
  type MissionStatus
} from '../db/schema.js';

// Milestones de racha y sus recompensas
const STREAK_MILESTONES = [
  { days: 3, xp: 10, gp: 0 },
  { days: 7, xp: 25, gp: 10 },
  { days: 14, xp: 50, gp: 25 },
  { days: 30, xp: 100, gp: 50 },
  { days: 60, xp: 200, gp: 100 },
];

export interface CreateMissionDto {
  name: string;
  description: string;
  icon?: string;
  type: MissionType;
  category: MissionCategory;
  objectiveType: string;
  objectiveTarget: number;
  objectiveConfig?: any;
  rewardXp?: number;
  rewardGp?: number;
  rewardHp?: number;
  attachmentUrl?: string;
  attachmentName?: string;
  isRepeatable?: boolean;
  maxCompletions?: number;
  autoAssign?: boolean; // Auto-asignar a todos los estudiantes
  autoExpire?: boolean; // Calcular expiración automática según tipo
}

export interface UpdateMissionDto extends Partial<CreateMissionDto> {
  isActive?: boolean;
}

export interface AssignMissionDto {
  missionId: string;
  studentProfileIds: string[];
  expiresAt?: Date;
}

export interface MissionWithProgress extends Mission {
  studentMission?: StudentMission;
}

class MissionService {
  // ==================== CRUD DE MISIONES ====================

  // Calcular fecha de expiración según el tipo de misión
  private calculateExpirationDate(type: MissionType): Date {
    const now = new Date();
    
    switch (type) {
      case 'DAILY':
        // Expira en 24 horas exactas desde ahora
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      case 'WEEKLY':
        // Expira en 7 días exactos desde ahora
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      case 'SPECIAL':
      default:
        // Expira en 30 días desde ahora
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  async createMission(classroomId: string, data: CreateMissionDto): Promise<Mission & { assignedCount?: number }> {
    const id = uuidv4();
    const now = new Date();

    await db.insert(missions).values({
      id,
      classroomId,
      name: data.name,
      description: data.description,
      icon: data.icon || '🎯',
      type: data.type,
      category: data.category,
      objectiveType: data.objectiveType,
      objectiveTarget: data.objectiveTarget,
      objectiveConfig: data.objectiveConfig,
      rewardXp: data.rewardXp || 0,
      rewardGp: data.rewardGp || 0,
      rewardHp: data.rewardHp || 0,
      attachmentUrl: data.attachmentUrl,
      attachmentName: data.attachmentName,
      isRepeatable: data.isRepeatable ?? true,
      maxCompletions: data.maxCompletions,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const [mission] = await db.select().from(missions).where(eq(missions.id, id));

    // Auto-asignar a todos los estudiantes si está habilitado
    let assignedCount = 0;
    if (data.autoAssign) {
      const expiresAt = data.autoExpire ? this.calculateExpirationDate(data.type) : undefined;
      assignedCount = await this.assignMissionToAll(classroomId, id, expiresAt);
    }

    return { ...mission, assignedCount };
  }

  async updateMission(missionId: string, data: UpdateMissionDto): Promise<Mission> {
    await db.update(missions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(missions.id, missionId));

    const [mission] = await db.select().from(missions).where(eq(missions.id, missionId));
    return mission;
  }

  async deleteMission(missionId: string): Promise<void> {
    // Eliminar asignaciones primero
    await db.delete(studentMissions).where(eq(studentMissions.missionId, missionId));
    // Eliminar misión
    await db.delete(missions).where(eq(missions.id, missionId));
  }

  async getMission(missionId: string): Promise<Mission | null> {
    const [mission] = await db.select().from(missions).where(eq(missions.id, missionId));
    return mission || null;
  }

  async getClassroomMissions(classroomId: string, type?: MissionType): Promise<Mission[]> {
    let query = db.select().from(missions)
      .where(eq(missions.classroomId, classroomId))
      .orderBy(desc(missions.createdAt));

    if (type) {
      query = db.select().from(missions)
        .where(and(
          eq(missions.classroomId, classroomId),
          eq(missions.type, type)
        ))
        .orderBy(desc(missions.createdAt));
    }

    return await query;
  }

  // ==================== ASIGNACIÓN DE MISIONES ====================

  async assignMission(data: AssignMissionDto): Promise<StudentMission[]> {
    const mission = await this.getMission(data.missionId);
    if (!mission) throw new Error('Misión no encontrada');

    const now = new Date();
    const results: StudentMission[] = [];

    for (const studentProfileId of data.studentProfileIds) {
      // Verificar si ya tiene esta misión activa
      const [existing] = await db.select().from(studentMissions)
        .where(and(
          eq(studentMissions.studentProfileId, studentProfileId),
          eq(studentMissions.missionId, data.missionId),
          eq(studentMissions.status, 'ACTIVE')
        ));

      if (existing) continue; // Ya tiene la misión activa

      const id = uuidv4();
      await db.insert(studentMissions).values({
        id,
        studentProfileId,
        missionId: data.missionId,
        status: 'ACTIVE',
        currentProgress: 0,
        targetProgress: mission.objectiveTarget,
        assignedAt: now,
        expiresAt: data.expiresAt || null,
      });

      const [studentMission] = await db.select().from(studentMissions).where(eq(studentMissions.id, id));
      results.push(studentMission);
    }

    return results;
  }

  async assignMissionToAll(classroomId: string, missionId: string, expiresAt?: Date): Promise<number> {
    // Obtener todos los estudiantes activos de la clase
    const students = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true)
      ));

    const studentIds = students.map((s: { id: string }) => s.id);
    await this.assignMission({
      missionId,
      studentProfileIds: studentIds,
      expiresAt,
    });

    return studentIds.length;
  }

  // Obtener IDs de estudiantes que tienen asignada una misión (activa o completada)
  async getAssignedStudentIds(missionId: string): Promise<string[]> {
    const results = await db.select({ studentProfileId: studentMissions.studentProfileId })
      .from(studentMissions)
      .where(eq(studentMissions.missionId, missionId));
    
    return results.map(r => r.studentProfileId);
  }

  // Obtener detalles de asignaciones de una misión (para el profesor)
  async getMissionAssignments(missionId: string): Promise<{
    studentProfileId: string;
    studentName: string;
    status: MissionStatus;
    currentProgress: number;
    targetProgress: number;
    completedAt: Date | null;
    claimedAt: Date | null;
  }[]> {
    const results = await db.select({
      studentMission: studentMissions,
      student: studentProfiles,
    })
      .from(studentMissions)
      .innerJoin(studentProfiles, eq(studentMissions.studentProfileId, studentProfiles.id))
      .where(eq(studentMissions.missionId, missionId))
      .orderBy(desc(studentMissions.completedAt));

    return results.map(r => ({
      studentProfileId: r.student.id,
      studentName: r.student.characterName || 'Estudiante',
      status: r.studentMission.status as MissionStatus,
      currentProgress: r.studentMission.currentProgress,
      targetProgress: r.studentMission.targetProgress,
      completedAt: r.studentMission.completedAt,
      claimedAt: r.studentMission.claimedAt,
    }));
  }

  // ==================== MISIONES DEL ESTUDIANTE ====================

  async getStudentMissions(studentProfileId: string, status?: MissionStatus): Promise<(StudentMission & { mission: Mission })[]> {
    let conditions = [eq(studentMissions.studentProfileId, studentProfileId)];
    
    if (status) {
      conditions.push(eq(studentMissions.status, status));
    }

    const results = await db.select({
      studentMission: studentMissions,
      mission: missions,
    })
      .from(studentMissions)
      .innerJoin(missions, eq(studentMissions.missionId, missions.id))
      .where(and(...conditions))
      .orderBy(desc(studentMissions.assignedAt));

    return results.map((r: any) => ({
      ...r.studentMission,
      mission: r.mission,
    }));
  }

  async getStudentActiveMissions(studentProfileId: string): Promise<(StudentMission & { mission: Mission })[]> {
    return this.getStudentMissions(studentProfileId, 'ACTIVE');
  }

  // ==================== PROGRESO DE MISIONES ====================

  async updateMissionProgress(
    studentProfileId: string, 
    objectiveType: string, 
    amount: number = 1,
    config?: any
  ): Promise<StudentMission[]> {
    // Obtener misiones activas del estudiante que coincidan con el tipo de objetivo
    const activeMissions = await db.select({
      studentMission: studentMissions,
      mission: missions,
    })
      .from(studentMissions)
      .innerJoin(missions, eq(studentMissions.missionId, missions.id))
      .where(and(
        eq(studentMissions.studentProfileId, studentProfileId),
        eq(studentMissions.status, 'ACTIVE'),
        eq(missions.objectiveType, objectiveType)
      ));

    const updatedMissions: StudentMission[] = [];

    for (const { studentMission, mission } of activeMissions) {
      // Verificar config adicional si existe
      if (mission.objectiveConfig && config) {
        const missionConfig = mission.objectiveConfig as any;
        // Por ejemplo, si la misión requiere un behaviorId específico
        if (missionConfig.behaviorId && config.behaviorId !== missionConfig.behaviorId) {
          continue;
        }
      }

      const newProgress = Math.min(
        studentMission.currentProgress + amount,
        studentMission.targetProgress
      );

      const isCompleted = newProgress >= studentMission.targetProgress;

      await db.update(studentMissions)
        .set({
          currentProgress: newProgress,
          status: isCompleted ? 'COMPLETED' : 'ACTIVE',
          completedAt: isCompleted ? new Date() : null,
        })
        .where(eq(studentMissions.id, studentMission.id));

      const [updated] = await db.select().from(studentMissions).where(eq(studentMissions.id, studentMission.id));
      updatedMissions.push(updated);

      // Si se completó, actualizar racha y notificar
      if (isCompleted) {
        await this.updateStreak(studentProfileId, mission.classroomId);
        
        // Crear notificación para el estudiante
        const [profile] = await db.select().from(studentProfiles)
          .where(eq(studentProfiles.id, studentProfileId));
        
        if (profile?.userId) {
          await db.insert(notifications).values({
            id: uuidv4(),
            userId: profile.userId,
            type: 'MISSION_COMPLETED',
            title: '🎯 ¡Misión completada!',
            message: `Has completado la misión "${mission.name}". ¡Reclama tu recompensa!`,
            isRead: false,
            createdAt: new Date(),
          });
        }
      }
    }

    return updatedMissions;
  }

  // ==================== RECLAMAR RECOMPENSAS ====================

  async claimMissionReward(studentMissionId: string): Promise<{ xp: number; gp: number; hp: number }> {
    const [studentMission] = await db.select({
      studentMission: studentMissions,
      mission: missions,
    })
      .from(studentMissions)
      .innerJoin(missions, eq(studentMissions.missionId, missions.id))
      .where(eq(studentMissions.id, studentMissionId));

    if (!studentMission) {
      throw new Error('Misión no encontrada');
    }

    if (studentMission.studentMission.status !== 'COMPLETED') {
      throw new Error('La misión no está completada');
    }

    const { mission } = studentMission;

    // Marcar como reclamada
    await db.update(studentMissions)
      .set({
        status: 'CLAIMED',
        claimedAt: new Date(),
      })
      .where(eq(studentMissions.id, studentMissionId));

    // Otorgar recompensas
    const rewards = {
      xp: mission.rewardXp,
      gp: mission.rewardGp,
      hp: mission.rewardHp,
    };

    // Actualizar puntos del estudiante
    if (rewards.xp > 0 || rewards.gp > 0 || rewards.hp > 0) {
      const [student] = await db.select().from(studentProfiles)
        .where(eq(studentProfiles.id, studentMission.studentMission.studentProfileId));

      if (student) {
        await db.update(studentProfiles)
          .set({
            xp: student.xp + rewards.xp,
            gp: student.gp + rewards.gp,
            hp: Math.min(student.hp + rewards.hp, 100), // Asumiendo maxHp = 100
            updatedAt: new Date(),
          })
          .where(eq(studentProfiles.id, student.id));

        // Registrar en pointLogs
        if (rewards.xp > 0) {
          await db.insert(pointLogs).values({
            id: uuidv4(),
            studentId: student.id,
            pointType: 'XP',
            action: 'ADD',
            amount: rewards.xp,
            reason: `Misión completada: ${mission.name}`,
            createdAt: new Date(),
          });
        }
        if (rewards.gp > 0) {
          await db.insert(pointLogs).values({
            id: uuidv4(),
            studentId: student.id,
            pointType: 'GP',
            action: 'ADD',
            amount: rewards.gp,
            reason: `Misión completada: ${mission.name}`,
            createdAt: new Date(),
          });
        }

        // Crear notificación de recompensa reclamada
        if (student.userId) {
          const rewardText = [
            rewards.xp > 0 ? `+${rewards.xp} XP` : '',
            rewards.gp > 0 ? `+${rewards.gp} 💰` : '',
            rewards.hp > 0 ? `+${rewards.hp} ❤️` : '',
          ].filter(Boolean).join(' ');

          await db.insert(notifications).values({
            id: uuidv4(),
            userId: student.userId,
            type: 'POINTS',
            title: '🎁 ¡Recompensa reclamada!',
            message: `Has recibido ${rewardText} por completar "${mission.name}"`,
            isRead: false,
            createdAt: new Date(),
          });
        }
      }
    }

    return rewards;
  }

  // ==================== SISTEMA DE RACHAS ====================

  async getStudentStreak(studentProfileId: string, classroomId: string): Promise<StudentStreak | null> {
    const [streak] = await db.select().from(studentStreaks)
      .where(and(
        eq(studentStreaks.studentProfileId, studentProfileId),
        eq(studentStreaks.classroomId, classroomId)
      ));
    return streak || null;
  }

  async updateStreak(studentProfileId: string, classroomId: string): Promise<StudentStreak> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let streak = await this.getStudentStreak(studentProfileId, classroomId);

    if (!streak) {
      // Crear nuevo registro de racha
      const id = uuidv4();
      await db.insert(studentStreaks).values({
        id,
        studentProfileId,
        classroomId,
        currentStreak: 1,
        longestStreak: 1,
        lastCompletedAt: now,
        streakStartedAt: now,
        claimedMilestones: [],
        createdAt: now,
        updatedAt: now,
      });
      const [newStreak] = await db.select().from(studentStreaks).where(eq(studentStreaks.id, id));
      return newStreak;
    }

    // Verificar si ya completó hoy
    if (streak.lastCompletedAt) {
      const lastCompleted = new Date(streak.lastCompletedAt);
      const lastCompletedDay = new Date(lastCompleted.getFullYear(), lastCompleted.getMonth(), lastCompleted.getDate());
      
      if (lastCompletedDay.getTime() === today.getTime()) {
        // Ya completó hoy, no hacer nada
        return streak;
      }

      // Verificar si fue ayer (continúa racha) o antes (racha rota)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastCompletedDay.getTime() === yesterday.getTime()) {
        // Continúa la racha
        const newStreak = streak.currentStreak + 1;
        await db.update(studentStreaks)
          .set({
            currentStreak: newStreak,
            longestStreak: Math.max(streak.longestStreak, newStreak),
            lastCompletedAt: now,
            updatedAt: now,
          })
          .where(eq(studentStreaks.id, streak.id));
      } else {
        // Racha rota, empezar de nuevo
        await db.update(studentStreaks)
          .set({
            currentStreak: 1,
            lastCompletedAt: now,
            streakStartedAt: now,
            updatedAt: now,
          })
          .where(eq(studentStreaks.id, streak.id));
      }
    } else {
      // Primera vez
      await db.update(studentStreaks)
        .set({
          currentStreak: 1,
          longestStreak: Math.max(streak.longestStreak, 1),
          lastCompletedAt: now,
          streakStartedAt: now,
          updatedAt: now,
        })
        .where(eq(studentStreaks.id, streak.id));
    }

    const [updatedStreak] = await db.select().from(studentStreaks).where(eq(studentStreaks.id, streak.id));
    return updatedStreak;
  }

  async claimStreakReward(studentProfileId: string, classroomId: string, milestone: number): Promise<{ xp: number; gp: number }> {
    const streak = await this.getStudentStreak(studentProfileId, classroomId);
    if (!streak) {
      throw new Error('No tienes racha en esta clase');
    }

    if (streak.currentStreak < milestone) {
      throw new Error(`Necesitas ${milestone} días de racha para reclamar esta recompensa`);
    }

    const claimedMilestones = (streak.claimedMilestones as number[]) || [];
    if (claimedMilestones.includes(milestone)) {
      throw new Error('Ya reclamaste esta recompensa');
    }

    const milestoneReward = STREAK_MILESTONES.find(m => m.days === milestone);
    if (!milestoneReward) {
      throw new Error('Milestone no válido');
    }

    // Marcar como reclamado
    claimedMilestones.push(milestone);
    await db.update(studentStreaks)
      .set({
        claimedMilestones,
        updatedAt: new Date(),
      })
      .where(eq(studentStreaks.id, streak.id));

    // Otorgar recompensas
    const [student] = await db.select().from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));

    if (student) {
      await db.update(studentProfiles)
        .set({
          xp: student.xp + milestoneReward.xp,
          gp: student.gp + milestoneReward.gp,
          updatedAt: new Date(),
        })
        .where(eq(studentProfiles.id, student.id));

      // Registrar en pointLogs
      if (milestoneReward.xp > 0) {
        await db.insert(pointLogs).values({
          id: uuidv4(),
          studentId: student.id,
          pointType: 'XP',
          action: 'ADD',
          amount: milestoneReward.xp,
          reason: `Racha de ${milestone} días`,
          createdAt: new Date(),
        });
      }
    }

    return { xp: milestoneReward.xp, gp: milestoneReward.gp };
  }

  getStreakMilestones() {
    return STREAK_MILESTONES;
  }

  // ==================== ESTADÍSTICAS ====================

  async getMissionStats(classroomId: string): Promise<{
    totalMissions: number;
    activeMissions: number;
    totalAssigned: number;
    totalCompleted: number;
    completionRate: number;
    topStudents: { studentId: string; name: string; completed: number }[];
  }> {
    // Total de misiones
    const allMissions = await db.select().from(missions)
      .where(eq(missions.classroomId, classroomId));
    
    const activeMissions = allMissions.filter((m: Mission) => m.isActive);

    // Estadísticas de asignaciones
    const missionIds = allMissions.map((m: Mission) => m.id);
    
    if (missionIds.length === 0) {
      return {
        totalMissions: 0,
        activeMissions: 0,
        totalAssigned: 0,
        totalCompleted: 0,
        completionRate: 0,
        topStudents: [],
      };
    }

    const assignments = await db.select().from(studentMissions)
      .where(inArray(studentMissions.missionId, missionIds));

    const completed = assignments.filter((a: StudentMission) => a.status === 'COMPLETED' || a.status === 'CLAIMED');

    // Top estudiantes
    const studentCompletions: Record<string, number> = {};
    for (const assignment of completed) {
      studentCompletions[assignment.studentProfileId] = (studentCompletions[assignment.studentProfileId] || 0) + 1;
    }

    const topStudentIds = Object.entries(studentCompletions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    const topStudentsData = topStudentIds.length > 0 
      ? await db.select().from(studentProfiles).where(inArray(studentProfiles.id, topStudentIds))
      : [];

    const topStudents = topStudentIds.map(id => {
      const student = topStudentsData.find((s: any) => s.id === id);
      return {
        studentId: id,
        name: student?.characterName || student?.displayName || 'Estudiante',
        completed: studentCompletions[id],
      };
    });

    return {
      totalMissions: allMissions.length,
      activeMissions: activeMissions.length,
      totalAssigned: assignments.length,
      totalCompleted: completed.length,
      completionRate: assignments.length > 0 ? Math.round((completed.length / assignments.length) * 100) : 0,
      topStudents,
    };
  }

  // ==================== EXPIRACIÓN DE MISIONES ====================

  async expireOldMissions(): Promise<number> {
    const now = new Date();
    
    const result = await db.update(studentMissions)
      .set({ status: 'EXPIRED' })
      .where(and(
        eq(studentMissions.status, 'ACTIVE'),
        lte(studentMissions.expiresAt, now)
      ));

    return 0; // Drizzle no retorna count fácilmente
  }
}

export const missionService = new MissionService();
