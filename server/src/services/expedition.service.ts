import { db } from '../db/index.js';
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
  teams,
  clanLogs,
  classrooms,
  type ExpeditionStatus,
  type ExpeditionPinType,
  type ExpeditionProgressStatus,
} from '../db/schema.js';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// ==================== EXPEDITION CRUD ====================

export class ExpeditionService {
  
  // Crear una nueva expedición
  async create(data: {
    classroomId: string;
    name: string;
    description?: string;
    mapImageUrl: string;
  }) {
    const now = new Date();
    const id = uuidv4();
    
    await db.insert(expeditions).values({
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
    const pins = await db.select()
      .from(expeditionPins)
      .where(eq(expeditionPins.expeditionId, id))
      .orderBy(asc(expeditionPins.orderIndex));
    
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
    
    // Obtener pines para cada expedición
    const result = await Promise.all(
      expeditionList.map(async (exp) => {
        const pins = await db.select()
          .from(expeditionPins)
          .where(eq(expeditionPins.expeditionId, exp.id))
          .orderBy(asc(expeditionPins.orderIndex));
        return { ...exp, pins };
      })
    );
    
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
    // Eliminar en orden: submissions -> pin_progress -> student_progress -> connections -> pins -> expedition
    await db.delete(expeditionSubmissions).where(eq(expeditionSubmissions.expeditionId, id));
    await db.delete(expeditionPinProgress).where(eq(expeditionPinProgress.expeditionId, id));
    await db.delete(expeditionStudentProgress).where(eq(expeditionStudentProgress.expeditionId, id));
    await db.delete(expeditionConnections).where(eq(expeditionConnections.expeditionId, id));
    await db.delete(expeditionPins).where(eq(expeditionPins.expeditionId, id));
    await db.delete(expeditions).where(eq(expeditions.id, id));
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
    return results[0] || null;
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
    // Eliminar conexiones relacionadas
    await db.delete(expeditionConnections)
      .where(eq(expeditionConnections.fromPinId, id));
    await db.delete(expeditionConnections)
      .where(eq(expeditionConnections.toPinId, id));
    
    // Eliminar progreso y submissions
    await db.delete(expeditionSubmissions)
      .where(eq(expeditionSubmissions.pinId, id));
    await db.delete(expeditionPinProgress)
      .where(eq(expeditionPinProgress.pinId, id));
    
    // Eliminar el pin
    await db.delete(expeditionPins)
      .where(eq(expeditionPins.id, id));
  }
  
  // ==================== CONNECTIONS ====================
  
  // Crear conexión entre pines
  async createConnection(data: {
    expeditionId: string;
    fromPinId: string;
    toPinId: string;
    onSuccess?: boolean | null;
  }) {
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
    const students = await db.select()
      .from(studentProfiles)
      .where(eq(studentProfiles.classroomId, expedition.classroomId));
    
    const introPin = expedition.pins.find((p: any) => p.pinType === 'INTRO');
    const now = new Date();
    
    for (const student of students) {
      // Crear progreso general
      const progressId = uuidv4();
      await db.insert(expeditionStudentProgress).values({
        id: progressId,
        expeditionId: expedition.id,
        studentProfileId: student.id,
        isCompleted: false,
        currentPinId: introPin?.id || null,
        startedAt: now,
        updatedAt: now,
      });
      
      // Crear progreso por pin
      for (const pin of expedition.pins) {
        const pinProgressId = uuidv4();
        const isIntro = pin.pinType === 'INTRO';
        
        await db.insert(expeditionPinProgress).values({
          id: pinProgressId,
          expeditionId: expedition.id,
          pinId: pin.id,
          studentProfileId: student.id,
          status: isIntro ? 'UNLOCKED' : 'LOCKED',
          unlockedAt: isIntro ? now : null,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
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
    
    const submissions = await db.select()
      .from(expeditionSubmissions)
      .where(and(
        eq(expeditionSubmissions.expeditionId, expeditionId),
        eq(expeditionSubmissions.studentProfileId, studentProfileId)
      ));
    
    return {
      ...progress,
      pinProgress,
      submissions,
    };
  }
  
  // Obtener progreso de todos los estudiantes en un pin
  async getPinStudentProgress(pinId: string) {
    // Consulta separada para evitar LATERAL JOIN
    const progressList = await db.select()
      .from(expeditionPinProgress)
      .where(eq(expeditionPinProgress.pinId, pinId));
    
    // Obtener estudiantes para cada progreso
    const result = await Promise.all(
      progressList.map(async (prog) => {
        const studentResults = await db.select()
          .from(studentProfiles)
          .where(eq(studentProfiles.id, prog.studentProfileId));
        return { ...prog, student: studentResults[0] || null };
      })
    );
    
    return result;
  }
  
  // Decisión del profesor sobre un estudiante en un pin
  async setTeacherDecision(pinId: string, studentProfileId: string, passed: boolean) {
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
    const now = new Date();
    
    // Obtener el pin y sus recompensas
    const pin = await this.getPinById(pinId);
    if (!pin || (pin.rewardXp === 0 && pin.rewardGp === 0)) return;
    
    // Obtener el estudiante
    const [student] = await db.select().from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));
    if (!student) return;
    
    // Obtener la expedición para el nombre
    const expedition = await this.getById(pin.expeditionId);
    const reason = `Expedición "${expedition?.name || 'Desconocida'}" - Pin: ${pin.name}`;
    
    // Calcular XP para el clan (si aplica)
    let xpForStudent = pin.rewardXp;
    let xpForClan = 0;
    
    // Verificar si el estudiante tiene clan y si el aula tiene clanes habilitados
    if (student.teamId) {
      // Obtener configuración del aula
      const [classroom] = await db.select().from(classrooms)
        .where(eq(classrooms.id, student.classroomId));
      
      if (classroom?.clansEnabled && classroom.clanXpPercentage > 0) {
        // Calcular porcentaje para el clan
        xpForClan = Math.floor(pin.rewardXp * (classroom.clanXpPercentage / 100));
        xpForStudent = pin.rewardXp - xpForClan;
        
        // Actualizar XP del clan
        await db.update(teams)
          .set({
            totalXp: sql`${teams.totalXp} + ${xpForClan}`,
            updatedAt: now,
          })
          .where(eq(teams.id, student.teamId));
        
        // Registrar en clanLogs
        await db.insert(clanLogs).values({
          id: uuidv4(),
          clanId: student.teamId,
          studentId: studentProfileId,
          action: 'XP_CONTRIBUTED',
          xpAmount: xpForClan,
          gpAmount: 0,
          reason,
          createdAt: now,
        });
      }
    }
    
    // Actualizar puntos del estudiante
    await db.update(studentProfiles)
      .set({
        xp: student.xp + xpForStudent,
        gp: student.gp + pin.rewardGp,
        updatedAt: now,
      })
      .where(eq(studentProfiles.id, studentProfileId));
    
    // Registrar en pointLogs
    if (xpForStudent > 0) {
      await db.insert(pointLogs).values({
        id: uuidv4(),
        studentId: studentProfileId,
        pointType: 'XP',
        action: 'ADD',
        amount: xpForStudent,
        reason,
        createdAt: now,
      });
    }
    if (pin.rewardGp > 0) {
      await db.insert(pointLogs).values({
        id: uuidv4(),
        studentId: studentProfileId,
        pointType: 'GP',
        action: 'ADD',
        amount: pin.rewardGp,
        reason,
        createdAt: now,
      });
    }
    
    // Crear notificación
    if (student.userId) {
      const rewardText = [
        xpForStudent > 0 ? `+${xpForStudent} XP` : '',
        pin.rewardGp > 0 ? `+${pin.rewardGp} 💰` : '',
        xpForClan > 0 ? `(+${xpForClan} XP al clan)` : '',
      ].filter(Boolean).join(' ');
      
      await db.insert(notifications).values({
        id: uuidv4(),
        userId: student.userId,
        type: 'POINTS',
        title: '🗺️ ¡Objetivo completado!',
        message: `Has recibido ${rewardText} por completar "${pin.name}"`,
        isRead: false,
        createdAt: now,
      });
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
    const isEarly = pin?.earlySubmissionEnabled && 
                    pin.earlySubmissionDate && 
                    now < new Date(pin.earlySubmissionDate);
    
    await db.insert(expeditionSubmissions).values({
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
    await db.update(expeditionPinProgress)
      .set({
        status: 'IN_PROGRESS',
        updatedAt: now,
      })
      .where(and(
        eq(expeditionPinProgress.pinId, data.pinId),
        eq(expeditionPinProgress.studentProfileId, data.studentProfileId)
      ));
    
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
    return results[0] || null;
  }
  
  // Obtener entregas de un pin
  async getSubmissionsByPin(pinId: string) {
    // Consulta separada para evitar LATERAL JOIN
    const submissionsList = await db.select()
      .from(expeditionSubmissions)
      .where(eq(expeditionSubmissions.pinId, pinId));
    
    // Obtener estudiantes para cada entrega
    const result = await Promise.all(
      submissionsList.map(async (sub) => {
        const studentResults = await db.select()
          .from(studentProfiles)
          .where(eq(studentProfiles.id, sub.studentProfileId));
        return { ...sub, student: studentResults[0] || null };
      })
    );
    
    return result;
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
}

export const expeditionService = new ExpeditionService();
