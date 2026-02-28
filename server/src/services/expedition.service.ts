import { db } from '../db/index.js';
import { emitUnreadCount } from '../utils/notificationEmitter.js';
import { 
  expeditions, 
  expeditionPins, 
  expeditionConnections,
  expeditionStudentProgress,
  expeditionPinProgress,
  expeditionSubmissions,
  studentProfiles,
  pointLogs,
  notifications,
  classrooms,
  activityCompetencies,
  type ExpeditionStatus,
  type ExpeditionPinType,
  type ExpeditionProgressStatus,
} from '../db/schema.js';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { clanService } from './clan.service.js';
import { storyService } from './story.service.js';

// ==================== EXPEDITION CRUD ====================

export class ExpeditionService {

  private calculateLevel(totalXp: number, xpPerLevel: number): number {
    const level = Math.floor((1 + Math.sqrt(1 + (8 * totalXp) / xpPerLevel)) / 2);
    return Math.max(1, level);
  }

  private parseJsonArray(value: unknown): string[] | null {
    if (value == null) return null;
    if (Array.isArray(value)) return value as string[];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  async getClassroomIdByExpedition(expeditionId: string): Promise<string | null> {
    const [row] = await db.select({ classroomId: expeditions.classroomId })
      .from(expeditions)
      .where(eq(expeditions.id, expeditionId));

    return row?.classroomId ?? null;
  }

  async getClassroomIdByPin(pinId: string): Promise<string | null> {
    const [row] = await db.select({ classroomId: expeditions.classroomId })
      .from(expeditionPins)
      .innerJoin(expeditions, eq(expeditionPins.expeditionId, expeditions.id))
      .where(eq(expeditionPins.id, pinId));

    return row?.classroomId ?? null;
  }

  async getClassroomIdByConnection(connectionId: string): Promise<string | null> {
    const [row] = await db.select({ classroomId: expeditions.classroomId })
      .from(expeditionConnections)
      .innerJoin(expeditions, eq(expeditionConnections.expeditionId, expeditions.id))
      .where(eq(expeditionConnections.id, connectionId));

    return row?.classroomId ?? null;
  }

  async getClassroomIdByStudentProfile(studentProfileId: string): Promise<string | null> {
    const [row] = await db.select({ classroomId: studentProfiles.classroomId })
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));

    return row?.classroomId ?? null;
  }

  async verifyTeacherOwnsClassroom(teacherId: string, classroomId: string): Promise<boolean> {
    const [classroom] = await db.select({ id: classrooms.id })
      .from(classrooms)
      .where(and(
        eq(classrooms.id, classroomId),
        eq(classrooms.teacherId, teacherId)
      ));

    return !!classroom;
  }

  async verifyStudentBelongsToUser(studentProfileId: string, userId: string): Promise<boolean> {
    const [student] = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.id, studentProfileId),
        eq(studentProfiles.userId, userId),
        eq(studentProfiles.isActive, true)
      ));

    return !!student;
  }

  async verifyStudentUserInClassroom(userId: string, classroomId: string): Promise<boolean> {
    const [student] = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.userId, userId),
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true)
      ));

    return !!student;
  }

  async getStudentProfileInClassroomByUser(userId: string, classroomId: string): Promise<string | null> {
    const [student] = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.userId, userId),
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true)
      ));

    return student?.id ?? null;
  }

  async getExpeditionIdByPin(pinId: string): Promise<string | null> {
    const [row] = await db.select({ expeditionId: expeditionPins.expeditionId })
      .from(expeditionPins)
      .where(eq(expeditionPins.id, pinId));

    return row?.expeditionId ?? null;
  }
  
  // Crear una nueva expedición
  async create(data: {
    classroomId: string;
    name: string;
    description?: string;
    mapImageUrl: string;
    competencyIds?: string[];
  }) {
    const now = new Date();
    const id = uuidv4();

    await db.transaction(async (tx) => {
      await tx.insert(expeditions).values({
        id,
        classroomId: data.classroomId,
        name: data.name,
        description: data.description || null,
        mapImageUrl: data.mapImageUrl,
        status: 'DRAFT',
        autoProgress: false,
        createdAt: now,
        updatedAt: now,
      });

      // Guardar competencias asociadas si existen
      if (data.competencyIds && data.competencyIds.length > 0) {
        const competencyIds = [...new Set(data.competencyIds.filter(Boolean))];
        if (competencyIds.length > 0) {
          const competencyValues = competencyIds.map(competencyId => ({
            id: uuidv4(),
            activityType: 'EXPEDITION' as const,
            activityId: id,
            competencyId,
            weight: 100,
            createdAt: now,
          }));
          await tx.insert(activityCompetencies).values(competencyValues);
        }
      }
    });
    
    return this.getById(id);
  }
  
  // Obtener expedición por ID con pines y conexiones
  async getById(id: string) {
    // Consulta separada para evitar LATERAL JOIN (no soportado en MariaDB)
    const expeditionResults = await db.select()
      .from(expeditions)
      .where(eq(expeditions.id, id));
    
    const expedition = expeditionResults[0];
    if (!expedition) return null;
    
    // Obtener pines por separado
    const pinsRaw = await db.select()
      .from(expeditionPins)
      .where(eq(expeditionPins.expeditionId, id))
      .orderBy(asc(expeditionPins.orderIndex));
    
    // Parsear campos JSON que pueden venir como string
    const pins = pinsRaw.map(pin => ({
      ...pin,
      storyFiles: this.parseJsonArray(pin.storyFiles),
      taskFiles: this.parseJsonArray(pin.taskFiles),
    }));
    
    // Obtener conexiones por separado
    const connections = await db.select()
      .from(expeditionConnections)
      .where(eq(expeditionConnections.expeditionId, id));
    
    return {
      ...expedition,
      pins,
      connections,
    };
  }
  
  // Obtener expediciones de un classroom
  async getByClassroom(classroomId: string, status?: ExpeditionStatus) {
    const conditions = [eq(expeditions.classroomId, classroomId)];
    if (status) {
      conditions.push(eq(expeditions.status, status));
    }
    
    // Consulta separada para evitar LATERAL JOIN
    const expeditionList = await db.select()
      .from(expeditions)
      .where(and(...conditions))
      .orderBy(desc(expeditions.createdAt));

    if (expeditionList.length === 0) {
      return [];
    }

    const expeditionIds = expeditionList.map((exp) => exp.id);
    const allPins = await db.select()
      .from(expeditionPins)
      .where(inArray(expeditionPins.expeditionId, expeditionIds))
      .orderBy(asc(expeditionPins.orderIndex));

    const pinsByExpedition = new Map<string, typeof allPins>();
    allPins.forEach((pin) => {
      const list = pinsByExpedition.get(pin.expeditionId) || [];
      list.push({
        ...pin,
        storyFiles: this.parseJsonArray(pin.storyFiles),
        taskFiles: this.parseJsonArray(pin.taskFiles),
      } as any);
      pinsByExpedition.set(pin.expeditionId, list);
    });

    const result = expeditionList.map((exp) => ({
      ...exp,
      pins: pinsByExpedition.get(exp.id) || [],
    }));
    
    return result;
  }
  
  // Actualizar expedición
  async update(id: string, data: {
    name?: string;
    description?: string;
    mapImageUrl?: string;
    autoProgress?: boolean;
  }) {
    await db.update(expeditions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(expeditions.id, id));
    
    return this.getById(id);
  }
  
  // Publicar expedición
  async publish(id: string) {
    const now = new Date();
    
    await db.update(expeditions)
      .set({
        status: 'PUBLISHED',
        publishedAt: now,
        updatedAt: now,
      })
      .where(eq(expeditions.id, id));
    
    // Inicializar progreso para todos los estudiantes del classroom
    const expedition = await this.getById(id);
    if (expedition) {
      await this.initializeStudentProgress(expedition);
    }
    
    return this.getById(id);
  }
  
  // Archivar expedición
  async archive(id: string) {
    await db.update(expeditions)
      .set({
        status: 'ARCHIVED',
        updatedAt: new Date(),
      })
      .where(eq(expeditions.id, id));
    
    return this.getById(id);
  }
  
  // Eliminar expedición (solo si está en DRAFT)
  async delete(id: string) {
    await db.transaction(async (tx) => {
      // Eliminar en orden: submissions -> pin_progress -> student_progress -> connections -> pins -> competencias -> expedition
      await tx.delete(expeditionSubmissions).where(eq(expeditionSubmissions.expeditionId, id));
      await tx.delete(expeditionPinProgress).where(eq(expeditionPinProgress.expeditionId, id));
      await tx.delete(expeditionStudentProgress).where(eq(expeditionStudentProgress.expeditionId, id));
      await tx.delete(expeditionConnections).where(eq(expeditionConnections.expeditionId, id));
      await tx.delete(expeditionPins).where(eq(expeditionPins.expeditionId, id));
      await tx.delete(activityCompetencies).where(and(
        eq(activityCompetencies.activityType, 'EXPEDITION'),
        eq(activityCompetencies.activityId, id)
      ));
      await tx.delete(expeditions).where(eq(expeditions.id, id));
    });
  }
  
  // ==================== PIN CRUD ====================
  
  // Crear pin
  async createPin(data: {
    expeditionId: string;
    pinType: ExpeditionPinType;
    positionX: number;
    positionY: number;
    name: string;
    storyContent?: string;
    storyFiles?: string[];
    taskName?: string;
    taskContent?: string;
    taskFiles?: string[];
    requiresSubmission?: boolean;
    dueDate?: Date;
    rewardXp?: number;
    rewardGp?: number;
    earlySubmissionEnabled?: boolean;
    earlySubmissionDate?: Date;
    earlyBonusXp?: number;
    earlyBonusGp?: number;
    autoProgress?: boolean;
  }) {
    const now = new Date();
    const id = uuidv4();

    const [expedition] = await db.select({ id: expeditions.id })
      .from(expeditions)
      .where(eq(expeditions.id, data.expeditionId));

    if (!expedition) {
      throw new Error('Expedición no encontrada');
    }
    
    // Obtener el siguiente orderIndex
    const existingPins = await db.select()
      .from(expeditionPins)
      .where(eq(expeditionPins.expeditionId, data.expeditionId));
    const orderIndex = existingPins.length;
    
    await db.insert(expeditionPins).values({
      id,
      expeditionId: data.expeditionId,
      pinType: data.pinType,
      positionX: data.positionX,
      positionY: data.positionY,
      name: data.name,
      storyContent: data.storyContent || null,
      storyFiles: data.storyFiles || null,
      taskName: data.taskName || null,
      taskContent: data.taskContent || null,
      taskFiles: data.taskFiles || null,
      requiresSubmission: data.requiresSubmission || false,
      dueDate: data.dueDate || null,
      rewardXp: data.rewardXp || 0,
      rewardGp: data.rewardGp || 0,
      earlySubmissionEnabled: data.earlySubmissionEnabled || false,
      earlySubmissionDate: data.earlySubmissionDate || null,
      earlyBonusXp: data.earlyBonusXp || 0,
      earlyBonusGp: data.earlyBonusGp || 0,
      autoProgress: data.autoProgress ?? null,
      orderIndex,
      createdAt: now,
      updatedAt: now,
    });
    
    return this.getPinById(id);
  }
  
  // Obtener pin por ID
  async getPinById(id: string) {
    const results = await db.select()
      .from(expeditionPins)
      .where(eq(expeditionPins.id, id));
    
    const pin = results[0];
    if (!pin) return null;
    
    // Parsear campos JSON que pueden venir como string
    return {
      ...pin,
      storyFiles: this.parseJsonArray(pin.storyFiles),
      taskFiles: this.parseJsonArray(pin.taskFiles),
    };
  }
  
  // Actualizar pin
  async updatePin(id: string, data: {
    positionX?: number;
    positionY?: number;
    name?: string;
    storyContent?: string;
    storyFiles?: string[];
    taskName?: string;
    taskContent?: string;
    taskFiles?: string[];
    requiresSubmission?: boolean;
    dueDate?: Date | null;
    rewardXp?: number;
    rewardGp?: number;
    earlySubmissionEnabled?: boolean;
    earlySubmissionDate?: Date | null;
    earlyBonusXp?: number;
    earlyBonusGp?: number;
    autoProgress?: boolean | null;
  }) {
    await db.update(expeditionPins)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(expeditionPins.id, id));
    
    return this.getPinById(id);
  }
  
  // Eliminar pin
  async deletePin(id: string) {
    await db.transaction(async (tx) => {
      // Eliminar conexiones relacionadas
      await tx.delete(expeditionConnections)
        .where(eq(expeditionConnections.fromPinId, id));
      await tx.delete(expeditionConnections)
        .where(eq(expeditionConnections.toPinId, id));

      // Eliminar progreso y submissions
      await tx.delete(expeditionSubmissions)
        .where(eq(expeditionSubmissions.pinId, id));
      await tx.delete(expeditionPinProgress)
        .where(eq(expeditionPinProgress.pinId, id));

      // Eliminar el pin
      await tx.delete(expeditionPins)
        .where(eq(expeditionPins.id, id));
    });
  }
  
  // ==================== CONNECTIONS ====================
  
  // Crear conexión entre pines
  async createConnection(data: {
    expeditionId: string;
    fromPinId: string;
    toPinId: string;
    onSuccess?: boolean | null;
  }) {
    const [fromPin] = await db.select({ expeditionId: expeditionPins.expeditionId })
      .from(expeditionPins)
      .where(eq(expeditionPins.id, data.fromPinId));

    const [toPin] = await db.select({ expeditionId: expeditionPins.expeditionId })
      .from(expeditionPins)
      .where(eq(expeditionPins.id, data.toPinId));

    if (!fromPin || !toPin || fromPin.expeditionId !== data.expeditionId || toPin.expeditionId !== data.expeditionId) {
      throw new Error('Los pines seleccionados no pertenecen a la expedición');
    }

    const id = uuidv4();
    
    await db.insert(expeditionConnections).values({
      id,
      expeditionId: data.expeditionId,
      fromPinId: data.fromPinId,
      toPinId: data.toPinId,
      onSuccess: data.onSuccess ?? null,
      createdAt: new Date(),
    });
    
    return this.getConnectionById(id);
  }
  
  // Obtener conexión por ID
  async getConnectionById(id: string) {
    const results = await db.select()
      .from(expeditionConnections)
      .where(eq(expeditionConnections.id, id));
    return results[0] || null;
  }
  
  // Actualizar conexión
  async updateConnection(id: string, data: { onSuccess?: boolean | null }) {
    await db.update(expeditionConnections)
      .set(data)
      .where(eq(expeditionConnections.id, id));
    
    return this.getConnectionById(id);
  }
  
  // Eliminar conexión
  async deleteConnection(id: string) {
    await db.delete(expeditionConnections)
      .where(eq(expeditionConnections.id, id));
  }
  
  // ==================== STUDENT PROGRESS ====================
  
  // Inicializar progreso de estudiantes cuando se publica la expedición
  async initializeStudentProgress(expedition: any) {
    const students = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.classroomId, expedition.classroomId),
        eq(studentProfiles.isActive, true)
      ));

    if (!students.length || !Array.isArray(expedition.pins) || expedition.pins.length === 0) {
      return;
    }

    const introPin = expedition.pins.find((p: any) => p.pinType === 'INTRO');
    const now = new Date();
    const studentIds = students.map((student) => student.id);

    const existingProgressRows = await db.select({
      studentProfileId: expeditionStudentProgress.studentProfileId,
    })
      .from(expeditionStudentProgress)
      .where(and(
        eq(expeditionStudentProgress.expeditionId, expedition.id),
        inArray(expeditionStudentProgress.studentProfileId, studentIds)
      ));

    const existingStudentSet = new Set(existingProgressRows.map((row) => row.studentProfileId));
    const targetStudents = students.filter((student) => !existingStudentSet.has(student.id));

    if (!targetStudents.length) {
      return;
    }

    await db.transaction(async (tx) => {
      const progressRows = targetStudents.map((student) => ({
        id: uuidv4(),
        expeditionId: expedition.id,
        studentProfileId: student.id,
        isCompleted: false,
        currentPinId: introPin?.id || null,
        startedAt: now,
        updatedAt: now,
      }));

      await tx.insert(expeditionStudentProgress).values(progressRows);

      const pinProgressRows = targetStudents.flatMap((student) => {
        return expedition.pins.map((pin: any) => {
          const isIntro = pin.pinType === 'INTRO';
          return {
            id: uuidv4(),
            expeditionId: expedition.id,
            pinId: pin.id,
            studentProfileId: student.id,
            status: isIntro ? 'UNLOCKED' as ExpeditionProgressStatus : 'LOCKED' as ExpeditionProgressStatus,
            unlockedAt: isIntro ? now : null,
            createdAt: now,
            updatedAt: now,
          };
        });
      });

      if (pinProgressRows.length > 0) {
        await tx.insert(expeditionPinProgress).values(pinProgressRows);
      }
    });
  }
  
  // Obtener progreso de un estudiante en una expedición
  async getStudentProgress(expeditionId: string, studentProfileId: string) {
    const progressResults = await db.select()
      .from(expeditionStudentProgress)
      .where(and(
        eq(expeditionStudentProgress.expeditionId, expeditionId),
        eq(expeditionStudentProgress.studentProfileId, studentProfileId)
      ));
    
    const progress = progressResults[0];
    if (!progress) return null;
    
    const pinProgress = await db.select()
      .from(expeditionPinProgress)
      .where(and(
        eq(expeditionPinProgress.expeditionId, expeditionId),
        eq(expeditionPinProgress.studentProfileId, studentProfileId)
      ));
    
    const rawSubmissions = await db.select()
      .from(expeditionSubmissions)
      .where(and(
        eq(expeditionSubmissions.expeditionId, expeditionId),
        eq(expeditionSubmissions.studentProfileId, studentProfileId)
      ));

    const submissions = rawSubmissions.map((submission) => ({
      ...submission,
      files: this.parseJsonArray(submission.files) || [],
    }));
    
    return {
      ...progress,
      pinProgress,
      submissions,
    };
  }
  
  // Obtener progreso de todos los estudiantes en un pin
  async getPinStudentProgress(pinId: string) {
    const rows = await db.select({
      progress: expeditionPinProgress,
      student: studentProfiles,
    })
      .from(expeditionPinProgress)
      .leftJoin(studentProfiles, eq(expeditionPinProgress.studentProfileId, studentProfiles.id))
      .where(eq(expeditionPinProgress.pinId, pinId));

    return rows.map(({ progress, student }) => ({
      ...progress,
      student: student || null,
    }));
  }
  
  // Decisión del profesor sobre un estudiante en un pin
  async setTeacherDecision(pinId: string, studentProfileId: string, passed: boolean) {
    const existing = await this.getPinProgressByStudent(pinId, studentProfileId);
    if (!existing) {
      throw new Error('Progreso no encontrado');
    }

    if (passed && (existing.status === 'PASSED' || existing.status === 'COMPLETED')) {
      return existing;
    }

    if (!passed && existing.status === 'FAILED') {
      return existing;
    }

    const now = new Date();
    
    // Actualizar decisión
    await db.update(expeditionPinProgress)
      .set({
        teacherDecision: passed,
        teacherDecisionAt: now,
        status: passed ? 'PASSED' : 'FAILED',
        completedAt: now,
        updatedAt: now,
      })
      .where(and(
        eq(expeditionPinProgress.pinId, pinId),
        eq(expeditionPinProgress.studentProfileId, studentProfileId)
      ));
    
    // Si aprobó, otorgar recompensas
    if (passed) {
      await this.grantPinRewards(pinId, studentProfileId);
    }
    
    // Desbloquear siguiente pin según la decisión
    await this.unlockNextPin(pinId, studentProfileId, passed);
    
    return this.getPinProgressByStudent(pinId, studentProfileId);
  }
  
  // Otorgar recompensas de un pin al estudiante
  async grantPinRewards(pinId: string, studentProfileId: string) {
    const pin = await this.getPinById(pinId);
    if (!pin || (pin.rewardXp === 0 && pin.rewardGp === 0)) return;

    const expedition = await this.getById(pin.expeditionId);
    if (!expedition) return;

    const reason = `Expedición "${expedition?.name || 'Desconocida'}" - Pin: ${pin.name}`;

    const now = new Date();
    let awardedXp = 0;
    let shouldTriggerXpSideEffects = false;

    await db.transaction(async (tx) => {
      const [student] = await tx.select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentProfileId));

      if (!student) return;

      // Evitar duplicar recompensas para el mismo pin/estudiante
      const [existingRewardLog] = await tx.select({ id: pointLogs.id })
        .from(pointLogs)
        .where(and(
          eq(pointLogs.studentId, studentProfileId),
          eq(pointLogs.action, 'ADD'),
          eq(pointLogs.reason, reason),
          inArray(pointLogs.pointType, ['XP', 'GP'])
        ));

      if (existingRewardLog) {
        return;
      }

      const [classroom] = await tx.select({ xpPerLevel: classrooms.xpPerLevel })
        .from(classrooms)
        .where(eq(classrooms.id, student.classroomId));

      const newXp = student.xp + pin.rewardXp;
      const newGp = student.gp + pin.rewardGp;
      const xpPerLevel = classroom?.xpPerLevel || 100;
      const newLevel = pin.rewardXp > 0 ? this.calculateLevel(newXp, xpPerLevel) : student.level;
      const leveledUp = newLevel > student.level;

      await tx.update(studentProfiles)
        .set({
          xp: newXp,
          gp: newGp,
          level: newLevel,
          updatedAt: now,
        })
        .where(eq(studentProfiles.id, studentProfileId));

      if (pin.rewardXp > 0) {
        await tx.insert(pointLogs).values({
          id: uuidv4(),
          studentId: studentProfileId,
          pointType: 'XP',
          action: 'ADD',
          amount: pin.rewardXp,
          reason,
          createdAt: now,
        });
      }

      if (pin.rewardGp > 0) {
        await tx.insert(pointLogs).values({
          id: uuidv4(),
          studentId: studentProfileId,
          pointType: 'GP',
          action: 'ADD',
          amount: pin.rewardGp,
          reason,
          createdAt: now,
        });
      }

      if (student.userId) {
        const rewardText = [
          pin.rewardXp > 0 ? `+${pin.rewardXp} XP` : '',
          pin.rewardGp > 0 ? `+${pin.rewardGp} 💰` : '',
        ].filter(Boolean).join(' ');

        await tx.insert(notifications).values({
          id: uuidv4(),
          userId: student.userId,
          classroomId: student.classroomId,
          type: 'POINTS',
          title: '🗺️ ¡Objetivo completado!',
          message: `Has recibido ${rewardText} por completar "${pin.name}"`,
          isRead: false,
          createdAt: now,
        });

        if (leveledUp) {
          await tx.insert(notifications).values({
            id: uuidv4(),
            userId: student.userId,
            classroomId: student.classroomId,
            type: 'LEVEL_UP',
            title: '🎉 ¡Subiste de nivel!',
            message: `¡Felicidades! Has alcanzado el nivel ${newLevel}`,
            isRead: false,
            createdAt: now,
          });
        }
      }

      awardedXp = pin.rewardXp;
      shouldTriggerXpSideEffects = pin.rewardXp > 0;
    });

    // Emit after tx commit — look up userId since student is scoped inside tx
    if (shouldTriggerXpSideEffects || awardedXp > 0) {
      const [sp] = await db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
      if (sp?.userId) await emitUnreadCount(sp.userId);
    }

    if (shouldTriggerXpSideEffects && awardedXp > 0) {
      try {
        await clanService.contributeXpToClan(studentProfileId, awardedXp, reason);
      } catch {
        // Silently fail
      }

      try {
        await storyService.onXpAwarded(expedition.classroomId, studentProfileId, awardedXp);
      } catch {
        // Silently fail
      }
    }
  }
  
  // Obtener progreso de un estudiante en un pin específico
  async getPinProgressByStudent(pinId: string, studentProfileId: string) {
    const results = await db.select()
      .from(expeditionPinProgress)
      .where(and(
        eq(expeditionPinProgress.pinId, pinId),
        eq(expeditionPinProgress.studentProfileId, studentProfileId)
      ));
    return results[0] || null;
  }
  
  // Desbloquear siguiente pin basado en conexiones
  async unlockNextPin(fromPinId: string, studentProfileId: string, passed: boolean) {
    // Buscar conexión correspondiente
    const connections = await db.select()
      .from(expeditionConnections)
      .where(eq(expeditionConnections.fromPinId, fromPinId));
    
    // Encontrar la conexión correcta según si pasó o no
    let nextConnection = connections.find(c => c.onSuccess === passed);
    
    // Si no hay conexión específica, buscar conexión lineal (null)
    if (!nextConnection) {
      nextConnection = connections.find(c => c.onSuccess === null);
    }
    
    if (nextConnection) {
      const now = new Date();
      
      // Desbloquear el siguiente pin
      await db.update(expeditionPinProgress)
        .set({
          status: 'UNLOCKED',
          unlockedAt: now,
          updatedAt: now,
        })
        .where(and(
          eq(expeditionPinProgress.pinId, nextConnection.toPinId),
          eq(expeditionPinProgress.studentProfileId, studentProfileId)
        ));
      
      // Actualizar pin actual del estudiante
      const pinProgress = await this.getPinProgressByStudent(fromPinId, studentProfileId);
      if (pinProgress) {
        await db.update(expeditionStudentProgress)
          .set({
            currentPinId: nextConnection.toPinId,
            updatedAt: now,
          })
          .where(and(
            eq(expeditionStudentProgress.expeditionId, pinProgress.expeditionId),
            eq(expeditionStudentProgress.studentProfileId, studentProfileId)
          ));
      }
      
      // Verificar si el siguiente pin es FINAL
      const nextPin = await this.getPinById(nextConnection.toPinId);
      if (nextPin?.pinType === 'FINAL') {
        // Marcar expedición como completada
        await db.update(expeditionStudentProgress)
          .set({
            isCompleted: true,
            completedAt: now,
            updatedAt: now,
          })
          .where(and(
            eq(expeditionStudentProgress.expeditionId, nextPin.expeditionId),
            eq(expeditionStudentProgress.studentProfileId, studentProfileId)
          ));
      }
    }
  }
  
  // ==================== SUBMISSIONS ====================
  
  // Crear entrega de tarea
  async createSubmission(data: {
    expeditionId: string;
    pinId: string;
    studentProfileId: string;
    files: string[];
    comment?: string;
  }) {
    const now = new Date();
    const id = uuidv4();
    
    // Verificar si es entrega temprana
    const pin = await this.getPinById(data.pinId);
    if (!pin) {
      throw new Error('Pin no encontrado');
    }

    if (pin.expeditionId !== data.expeditionId) {
      throw new Error('El pin no pertenece a esta expedición');
    }

    const pinProgress = await this.getPinProgressByStudent(data.pinId, data.studentProfileId);
    if (!pinProgress) {
      throw new Error('No tienes progreso para este pin');
    }

    if (pinProgress.status === 'LOCKED') {
      throw new Error('El pin está bloqueado');
    }

    if (pinProgress.status === 'PASSED' || pinProgress.status === 'COMPLETED') {
      throw new Error('Este pin ya fue completado');
    }

    const isEarly = pin?.earlySubmissionEnabled && 
                    pin.earlySubmissionDate && 
                    now < new Date(pin.earlySubmissionDate);

    await db.transaction(async (tx) => {
      await tx.insert(expeditionSubmissions).values({
        id,
        expeditionId: data.expeditionId,
        pinId: data.pinId,
        studentProfileId: data.studentProfileId,
        files: data.files,
        comment: data.comment || null,
        isEarlySubmission: isEarly || false,
        submittedAt: now,
      });

      // Actualizar estado del pin a IN_PROGRESS
      await tx.update(expeditionPinProgress)
        .set({
          status: 'IN_PROGRESS',
          updatedAt: now,
        })
        .where(and(
          eq(expeditionPinProgress.pinId, data.pinId),
          eq(expeditionPinProgress.studentProfileId, data.studentProfileId)
        ));
    });
    
    // Si autoProgress está habilitado, aprobar automáticamente
    const expedition = await this.getById(data.expeditionId);
    const shouldAutoProgress = pin?.autoProgress ?? expedition?.autoProgress;
    
    if (shouldAutoProgress) {
      await this.setTeacherDecision(data.pinId, data.studentProfileId, true);
    }
    
    return this.getSubmissionById(id);
  }
  
  // Obtener entrega por ID
  async getSubmissionById(id: string) {
    const results = await db.select()
      .from(expeditionSubmissions)
      .where(eq(expeditionSubmissions.id, id));

    const submission = results[0];
    if (!submission) return null;

    return {
      ...submission,
      files: this.parseJsonArray(submission.files) || [],
    };
  }
  
  // Obtener entregas de un pin
  async getSubmissionsByPin(pinId: string) {
    const rows = await db.select({
      submission: expeditionSubmissions,
      student: studentProfiles,
    })
      .from(expeditionSubmissions)
      .leftJoin(studentProfiles, eq(expeditionSubmissions.studentProfileId, studentProfiles.id))
      .where(eq(expeditionSubmissions.pinId, pinId));

    return rows.map(({ submission, student }) => ({
      ...submission,
      files: this.parseJsonArray(submission.files) || [],
      student: student || null,
    }));
  }

  // Completar un pin (para INTRO y OBJECTIVE sin entrega requerida)
  async completePin(pinId: string, studentProfileId: string) {
    const pin = await this.getPinById(pinId);
    if (!pin) throw new Error('Pin no encontrado');

    const progress = await this.getPinProgressByStudent(pinId, studentProfileId);
    if (!progress) throw new Error('Progreso no encontrado');

    // Verificar que el pin esté desbloqueado
    if (progress.status === 'LOCKED') {
      throw new Error('El pin está bloqueado');
    }

    // Verificar que no esté ya completado
    if (progress.status === 'PASSED' || progress.status === 'COMPLETED') {
      return progress;
    }

    // Para pines INTRO o FINAL, o OBJECTIVE sin entrega requerida, completar directamente
    if (pin.pinType === 'INTRO' || pin.pinType === 'FINAL' || !pin.requiresSubmission) {
      // Marcar como completado/aprobado
      await this.setTeacherDecision(pinId, studentProfileId, true);
      return this.getPinProgressByStudent(pinId, studentProfileId);
    }

    // Para OBJECTIVE con entrega requerida, solo marcar como en progreso
    const now = new Date();
    await db.update(expeditionPinProgress)
      .set({
        status: 'IN_PROGRESS',
        updatedAt: now,
      })
      .where(and(
        eq(expeditionPinProgress.pinId, pinId),
        eq(expeditionPinProgress.studentProfileId, studentProfileId)
      ));

    return this.getPinProgressByStudent(pinId, studentProfileId);
  }

  // Obtener estadísticas de expediciones para un classroom
  async getClassroomStats(classroomId: string) {
    // Obtener todas las expediciones del classroom
    const expeditionsList = await db.select()
      .from(expeditions)
      .where(eq(expeditions.classroomId, classroomId));

    // Obtener conteo de estudiantes en el classroom
    const studentsResult = await db.select({ count: sql<number>`count(*)` })
      .from(studentProfiles)
      .where(eq(studentProfiles.classroomId, classroomId));
    const totalStudents = Number(studentsResult[0]?.count || 0);

    if (expeditionsList.length === 0) {
      return {
        summary: {
          totalExpeditions: 0,
          published: 0,
          draft: 0,
          archived: 0,
          totalStudents,
          totalStarted: 0,
          totalCompleted: 0,
          totalPendingReviews: 0,
          overallCompletionRate: 0,
        },
        expeditions: [],
      };
    }

    const expeditionIds = expeditionsList.map((exp) => exp.id);

    const allProgressRows = await db.select()
      .from(expeditionStudentProgress)
      .where(inArray(expeditionStudentProgress.expeditionId, expeditionIds));

    const allPins = await db.select({
      expeditionId: expeditionPins.expeditionId,
      rewardXp: expeditionPins.rewardXp,
      rewardGp: expeditionPins.rewardGp,
    })
      .from(expeditionPins)
      .where(inArray(expeditionPins.expeditionId, expeditionIds));

    const pendingReviewRows = await db.select({
      expeditionId: expeditionPinProgress.expeditionId,
      count: sql<number>`count(*)`,
    })
      .from(expeditionPinProgress)
      .where(and(
        inArray(expeditionPinProgress.expeditionId, expeditionIds),
        eq(expeditionPinProgress.status, 'IN_PROGRESS')
      ))
      .groupBy(expeditionPinProgress.expeditionId);

    const progressByExpedition = new Map<string, typeof allProgressRows>();
    allProgressRows.forEach((row) => {
      const list = progressByExpedition.get(row.expeditionId) || [];
      list.push(row);
      progressByExpedition.set(row.expeditionId, list);
    });

    const pinsByExpedition = new Map<string, typeof allPins>();
    allPins.forEach((pin) => {
      const list = pinsByExpedition.get(pin.expeditionId) || [];
      list.push(pin);
      pinsByExpedition.set(pin.expeditionId, list);
    });

    const pendingByExpedition = new Map<string, number>();
    pendingReviewRows.forEach((row) => {
      pendingByExpedition.set(row.expeditionId, Number(row.count || 0));
    });

    const expeditionStats = expeditionsList.map((exp) => {
      const progressList = progressByExpedition.get(exp.id) || [];
      const pinsList = pinsByExpedition.get(exp.id) || [];

      const completedCount = progressList.filter((p) => p.isCompleted).length;
      const startedCount = progressList.length;
      const inProgressCount = startedCount - completedCount;

      const totalXp = pinsList.reduce((sum, pin) => sum + (pin.rewardXp || 0), 0);
      const totalGp = pinsList.reduce((sum, pin) => sum + (pin.rewardGp || 0), 0);

      const lastActivity = progressList.length > 0
        ? progressList.reduce((latest, p) =>
            new Date(p.updatedAt) > new Date(latest.updatedAt) ? p : latest
          ).updatedAt
        : null;

      return {
        expeditionId: exp.id,
        name: exp.name,
        status: exp.status,
        mapImageUrl: exp.mapImageUrl,
        autoProgress: exp.autoProgress,
        publishedAt: exp.publishedAt,
        createdAt: exp.createdAt,
        pinsCount: pinsList.length,
        totalStudents,
        startedCount,
        completedCount,
        inProgressCount,
        completionRate: totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0,
        totalXp,
        totalGp,
        pendingReviews: pendingByExpedition.get(exp.id) || 0,
        lastActivity,
      };
    });

    // Estadísticas generales
    const published = expeditionsList.filter(e => e.status === 'PUBLISHED').length;
    const draft = expeditionsList.filter(e => e.status === 'DRAFT').length;
    const archived = expeditionsList.filter(e => e.status === 'ARCHIVED').length;

    const totalCompleted = expeditionStats.reduce((sum, e) => sum + e.completedCount, 0);
    const totalStarted = expeditionStats.reduce((sum, e) => sum + e.startedCount, 0);
    const totalPendingReviews = expeditionStats.reduce((sum, e) => sum + e.pendingReviews, 0);

    return {
      summary: {
        totalExpeditions: expeditionsList.length,
        published,
        draft,
        archived,
        totalStudents,
        totalStarted,
        totalCompleted,
        totalPendingReviews,
        overallCompletionRate: totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0,
      },
      expeditions: expeditionStats,
    };
  }
}

export const expeditionService = new ExpeditionService();
