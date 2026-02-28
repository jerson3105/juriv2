import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { emitUnreadCount } from '../utils/notificationEmitter.js';
import {
  jiroExpeditions,
  jiroDeliveryStations,
  jiroStudentExpeditions,
  jiroQuestionAnswers,
  jiroDeliveries,
  jiroExpeditionCompetencies,
  questionBanks,
  questions,
  studentProfiles,
  classrooms,
  users,
  pointLogs,
  notifications,
  type JiroExpedition,
  type NewJiroExpedition,
  type JiroDeliveryStation,
  type JiroStudentExpedition,
  type JiroQuestionAnswer,
  type JiroDelivery,
  type JiroExpeditionStatus,
  type JiroStudentStatus,
  type JiroDeliveryStatus,
} from '../db/schema.js';
import { clanService } from './clan.service.js';
import { storyService } from './story.service.js';

// ==================== TIPOS ====================

interface CreateExpeditionData {
  classroomId: string;
  questionBankId: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  mode: 'ASYNC' | 'EXAM';
  timeLimitMinutes?: number;
  initialEnergy?: number;
  energyRegenMinutes?: number;
  energyPurchasePrice?: number;
  rewardXpPerCorrect?: number;
  rewardGpPerCorrect?: number;
  gradeWeight?: number;
  competencyId?: string;
  competencyIds?: string[];
}

interface CreateDeliveryStationData {
  expeditionId: string;
  name: string;
  description?: string;
  instructions?: string;
  orderIndex?: number;
  allowedFileTypes?: string[];
  maxFileSizeMb?: number;
}

interface AnswerQuestionData {
  studentExpeditionId: string;
  questionId: string;
  answer: any;
}

interface SubmitDeliveryData {
  studentExpeditionId: string;
  deliveryStationId: string;
  fileUrl: string;
  fileName: string;
  fileType: 'PDF' | 'IMAGE' | 'WORD' | 'EXCEL';
  fileSizeBytes: number;
}

interface ReviewDeliveryData {
  deliveryId: string;
  status: 'APPROVED' | 'REJECTED';
  feedback?: string;
  reviewerId: string;
}

interface XpSideEffectPayload {
  studentProfileId: string;
  classroomId: string;
  awardedXp: number;
  reason: string;
}

// ==================== SERVICIO ====================

export const jiroExpeditionService = {
  parseJsonArray(value: unknown): any[] | null {
    if (value == null) return null;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object') return Object.values(parsed);
      } catch {
        return null;
      }
    }

    if (value && typeof value === 'object') {
      return Object.values(value as Record<string, unknown>);
    }

    return null;
  },

  parseCompletedStations(value: unknown): string[] {
    const parsed = this.parseJsonArray(value);
    if (!parsed) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
  },

  calculateLevel(totalXp: number, xpPerLevel: number): number {
    const level = Math.floor((1 + Math.sqrt(1 + (8 * totalXp) / xpPerLevel)) / 2);
    return Math.max(1, level);
  },

  getCurrentEnergySnapshot(
    studentExpedition: JiroStudentExpedition,
    expedition: JiroExpedition,
    referenceDate: Date = new Date()
  ): { currentEnergy: number; lastEnergyRegenAt: Date | null } {
    if (expedition.mode === 'EXAM') {
      return {
        currentEnergy: studentExpedition.currentEnergy,
        lastEnergyRegenAt: studentExpedition.lastEnergyRegenAt
          ? new Date(studentExpedition.lastEnergyRegenAt)
          : null,
      };
    }

    if (!studentExpedition.lastEnergyRegenAt) {
      return {
        currentEnergy: studentExpedition.currentEnergy,
        lastEnergyRegenAt: null,
      };
    }

    if (expedition.energyRegenMinutes <= 0) {
      return {
        currentEnergy: studentExpedition.currentEnergy,
        lastEnergyRegenAt: new Date(studentExpedition.lastEnergyRegenAt),
      };
    }

    const lastRegenAt = new Date(studentExpedition.lastEnergyRegenAt);
    const minutesPassed = (referenceDate.getTime() - lastRegenAt.getTime()) / 60000;
    const regenCycles = Math.max(0, Math.floor(minutesPassed / expedition.energyRegenMinutes));

    if (regenCycles <= 0) {
      return {
        currentEnergy: studentExpedition.currentEnergy,
        lastEnergyRegenAt: lastRegenAt,
      };
    }

    const newEnergy = Math.min(
      expedition.initialEnergy,
      studentExpedition.currentEnergy + regenCycles
    );

    const nextRegenAt = new Date(
      lastRegenAt.getTime() + regenCycles * expedition.energyRegenMinutes * 60000
    );

    return {
      currentEnergy: newEnergy,
      lastEnergyRegenAt: nextRegenAt,
    };
  },

  async getClassroomIdByExpedition(expeditionId: string): Promise<string | null> {
    const [row] = await db.select({ classroomId: jiroExpeditions.classroomId })
      .from(jiroExpeditions)
      .where(eq(jiroExpeditions.id, expeditionId));

    return row?.classroomId ?? null;
  },

  async getClassroomIdByDeliveryStation(stationId: string): Promise<string | null> {
    const [row] = await db.select({ classroomId: jiroExpeditions.classroomId })
      .from(jiroDeliveryStations)
      .innerJoin(jiroExpeditions, eq(jiroDeliveryStations.expeditionId, jiroExpeditions.id))
      .where(eq(jiroDeliveryStations.id, stationId));

    return row?.classroomId ?? null;
  },

  async getClassroomIdByDelivery(deliveryId: string): Promise<string | null> {
    const [row] = await db.select({ classroomId: jiroExpeditions.classroomId })
      .from(jiroDeliveries)
      .innerJoin(jiroStudentExpeditions, eq(jiroDeliveries.studentExpeditionId, jiroStudentExpeditions.id))
      .innerJoin(jiroExpeditions, eq(jiroStudentExpeditions.expeditionId, jiroExpeditions.id))
      .where(eq(jiroDeliveries.id, deliveryId));

    return row?.classroomId ?? null;
  },

  async getClassroomIdByStudentProfile(studentProfileId: string): Promise<string | null> {
    const [row] = await db.select({ classroomId: studentProfiles.classroomId })
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));

    return row?.classroomId ?? null;
  },

  async getStudentProfileInClassroomByUser(userId: string, classroomId: string): Promise<string | null> {
    const [student] = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.userId, userId),
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true)
      ));

    return student?.id ?? null;
  },

  async verifyTeacherOwnsClassroom(teacherId: string, classroomId: string): Promise<boolean> {
    const [classroom] = await db.select({ id: classrooms.id })
      .from(classrooms)
      .where(and(
        eq(classrooms.id, classroomId),
        eq(classrooms.teacherId, teacherId)
      ));

    return !!classroom;
  },

  async verifyStudentBelongsToUser(studentProfileId: string, userId: string): Promise<boolean> {
    const [student] = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.id, studentProfileId),
        eq(studentProfiles.userId, userId),
        eq(studentProfiles.isActive, true)
      ));

    return !!student;
  },

  async verifyStudentUserInClassroom(userId: string, classroomId: string): Promise<boolean> {
    const [student] = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.userId, userId),
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true)
      ));

    return !!student;
  },

  async getExpeditionIdByDeliveryStation(stationId: string): Promise<string | null> {
    const [station] = await db.select({ expeditionId: jiroDeliveryStations.expeditionId })
      .from(jiroDeliveryStations)
      .where(eq(jiroDeliveryStations.id, stationId));

    return station?.expeditionId ?? null;
  },

  async getStudentProfileIdByStudentExpedition(studentExpeditionId: string): Promise<string | null> {
    const [row] = await db.select({ studentProfileId: jiroStudentExpeditions.studentProfileId })
      .from(jiroStudentExpeditions)
      .where(eq(jiroStudentExpeditions.id, studentExpeditionId));

    return row?.studentProfileId ?? null;
  },

  // ==================== EXPEDICIONES (PROFESOR) ====================

  async createExpedition(data: CreateExpeditionData): Promise<JiroExpedition> {
    const now = new Date();
    const id = uuidv4();

    await db.transaction(async (tx) => {
      await tx.insert(jiroExpeditions).values({
        id,
        classroomId: data.classroomId,
        questionBankId: data.questionBankId,
        name: data.name,
        description: data.description || null,
        coverImageUrl: data.coverImageUrl || null,
        mode: data.mode,
        status: 'DRAFT',
        timeLimitMinutes: data.timeLimitMinutes || null,
        initialEnergy: data.initialEnergy ?? 5,
        energyRegenMinutes: data.energyRegenMinutes ?? 30,
        energyPurchasePrice: data.energyPurchasePrice ?? 5,
        rewardXpPerCorrect: data.rewardXpPerCorrect ?? 10,
        rewardGpPerCorrect: data.rewardGpPerCorrect ?? 2,
        gradeWeight: data.gradeWeight ? String(data.gradeWeight) : null,
        competencyId: data.competencyId || null,
        requiresReview: false,
        createdAt: now,
        updatedAt: now,
      });

      // Guardar competencias asociadas
      if (data.competencyIds && data.competencyIds.length > 0) {
        const competencyIds = [...new Set(data.competencyIds.filter(Boolean))];
        if (competencyIds.length > 0) {
          const competencyValues = competencyIds.map((competencyId) => ({
            id: uuidv4(),
            expeditionId: id,
            competencyId,
            createdAt: now,
          }));
          await tx.insert(jiroExpeditionCompetencies).values(competencyValues);
        }
      }
    });

    const [expedition] = await db
      .select()
      .from(jiroExpeditions)
      .where(eq(jiroExpeditions.id, id));

    return expedition;
  },

  async getExpeditionsByClassroom(classroomId: string) {
    const expeditions = await db
      .select({
        expedition: jiroExpeditions,
        questionBank: {
          id: questionBanks.id,
          name: questionBanks.name,
          color: questionBanks.color,
          icon: questionBanks.icon,
        },
      })
      .from(jiroExpeditions)
      .leftJoin(questionBanks, eq(jiroExpeditions.questionBankId, questionBanks.id))
      .where(eq(jiroExpeditions.classroomId, classroomId))
      .orderBy(desc(jiroExpeditions.createdAt));

    if (expeditions.length === 0) {
      return [];
    }

    const expeditionIds = expeditions.map((e) => e.expedition.id);
    const bankIds = [...new Set(expeditions.map((e) => e.expedition.questionBankId))];

    const deliveryCounts = await db
      .select({
        expeditionId: jiroDeliveryStations.expeditionId,
        count: sql<number>`count(*)`,
      })
      .from(jiroDeliveryStations)
      .where(inArray(jiroDeliveryStations.expeditionId, expeditionIds))
      .groupBy(jiroDeliveryStations.expeditionId);

    const studentCounts = await db
      .select({
        expeditionId: jiroStudentExpeditions.expeditionId,
        count: sql<number>`count(*)`,
      })
      .from(jiroStudentExpeditions)
      .where(inArray(jiroStudentExpeditions.expeditionId, expeditionIds))
      .groupBy(jiroStudentExpeditions.expeditionId);

    const questionCounts = bankIds.length > 0
      ? await db
          .select({
            bankId: questions.bankId,
            count: sql<number>`count(*)`,
          })
          .from(questions)
          .where(inArray(questions.bankId, bankIds))
          .groupBy(questions.bankId)
      : [];

    const deliveryCountMap = new Map(deliveryCounts.map((row) => [row.expeditionId, Number(row.count || 0)]));
    const studentCountMap = new Map(studentCounts.map((row) => [row.expeditionId, Number(row.count || 0)]));
    const questionCountMap = new Map(questionCounts.map((row) => [row.bankId, Number(row.count || 0)]));

    return expeditions.map(({ expedition, questionBank }) => ({
      ...expedition,
      questionBank,
      deliveryStationsCount: deliveryCountMap.get(expedition.id) || 0,
      studentsStarted: studentCountMap.get(expedition.id) || 0,
      totalQuestions: questionCountMap.get(expedition.questionBankId) || 0,
    }));
  },

  async getExpeditionById(expeditionId: string) {
    const [expedition] = await db
      .select()
      .from(jiroExpeditions)
      .where(eq(jiroExpeditions.id, expeditionId));

    if (!expedition) return null;

    // Obtener banco de preguntas con sus preguntas
    const [questionBank] = await db
      .select()
      .from(questionBanks)
      .where(eq(questionBanks.id, expedition.questionBankId));

    const rawQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.bankId, expedition.questionBankId))
      .orderBy(questions.createdAt);

    const bankQuestions = rawQuestions.map((question) => ({
      ...question,
      options: this.parseJsonArray(question.options),
      pairs: this.parseJsonArray(question.pairs),
    }));

    // Obtener estaciones de entrega
    const rawDeliveryStations = await db
      .select()
      .from(jiroDeliveryStations)
      .where(eq(jiroDeliveryStations.expeditionId, expeditionId))
      .orderBy(jiroDeliveryStations.orderIndex);

    const deliveryStations = rawDeliveryStations.map((station) => ({
      ...station,
      allowedFileTypes: this.parseJsonArray(station.allowedFileTypes) || ['PDF', 'IMAGE'],
    }));

    return {
      ...expedition,
      questionBank: {
        ...questionBank,
        questions: bankQuestions,
      },
      deliveryStations,
    };
  },

  async updateExpedition(expeditionId: string, data: Partial<CreateExpeditionData>) {
    const now = new Date();
    const updateData: any = {
      updatedAt: now,
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl;
    if (data.mode !== undefined) updateData.mode = data.mode;
    if (data.timeLimitMinutes !== undefined) updateData.timeLimitMinutes = data.timeLimitMinutes;
    if (data.initialEnergy !== undefined) updateData.initialEnergy = data.initialEnergy;
    if (data.energyRegenMinutes !== undefined) updateData.energyRegenMinutes = data.energyRegenMinutes;
    if (data.energyPurchasePrice !== undefined) updateData.energyPurchasePrice = data.energyPurchasePrice;
    if (data.rewardXpPerCorrect !== undefined) updateData.rewardXpPerCorrect = data.rewardXpPerCorrect;
    if (data.rewardGpPerCorrect !== undefined) updateData.rewardGpPerCorrect = data.rewardGpPerCorrect;
    if (data.gradeWeight !== undefined) updateData.gradeWeight = data.gradeWeight ? String(data.gradeWeight) : null;
    if (data.competencyId !== undefined) updateData.competencyId = data.competencyId;
    if (data.questionBankId !== undefined) updateData.questionBankId = data.questionBankId;

    await db.transaction(async (tx) => {
      await tx
        .update(jiroExpeditions)
        .set(updateData)
        .where(eq(jiroExpeditions.id, expeditionId));

      if (Array.isArray(data.competencyIds)) {
        await tx.delete(jiroExpeditionCompetencies)
          .where(eq(jiroExpeditionCompetencies.expeditionId, expeditionId));

        const competencyIds = [...new Set(data.competencyIds.filter(Boolean))];
        if (competencyIds.length > 0) {
          await tx.insert(jiroExpeditionCompetencies).values(
            competencyIds.map((competencyId) => ({
              id: uuidv4(),
              expeditionId,
              competencyId,
              createdAt: now,
            }))
          );
        }
      }
    });

    return this.getExpeditionById(expeditionId);
  },

  async deleteExpedition(expeditionId: string) {
    await db.transaction(async (tx) => {
      // Eliminar en orden por dependencias
      const studentExpeditions = await tx
        .select({ id: jiroStudentExpeditions.id })
        .from(jiroStudentExpeditions)
        .where(eq(jiroStudentExpeditions.expeditionId, expeditionId));

      const studentExpeditionIds = studentExpeditions.map((se) => se.id);
      if (studentExpeditionIds.length > 0) {
        await tx.delete(jiroQuestionAnswers)
          .where(inArray(jiroQuestionAnswers.studentExpeditionId, studentExpeditionIds));
        await tx.delete(jiroDeliveries)
          .where(inArray(jiroDeliveries.studentExpeditionId, studentExpeditionIds));
      }

      await tx.delete(jiroStudentExpeditions)
        .where(eq(jiroStudentExpeditions.expeditionId, expeditionId));
      await tx.delete(jiroDeliveryStations)
        .where(eq(jiroDeliveryStations.expeditionId, expeditionId));
      await tx.delete(jiroExpeditionCompetencies)
        .where(eq(jiroExpeditionCompetencies.expeditionId, expeditionId));
      await tx.delete(jiroExpeditions)
        .where(eq(jiroExpeditions.id, expeditionId));
    });
  },

  // ==================== ESTACIONES DE ENTREGA ====================

  async createDeliveryStation(data: CreateDeliveryStationData): Promise<JiroDeliveryStation> {
    const now = new Date();
    const id = uuidv4();

    await db.transaction(async (tx) => {
      const [expedition] = await tx.select({ id: jiroExpeditions.id })
        .from(jiroExpeditions)
        .where(eq(jiroExpeditions.id, data.expeditionId));

      if (!expedition) {
        throw new Error('Expedición no encontrada');
      }

      const existingOrderRows = await tx.select({ orderIndex: jiroDeliveryStations.orderIndex })
        .from(jiroDeliveryStations)
        .where(eq(jiroDeliveryStations.expeditionId, data.expeditionId));

      const nextOrderIndex = existingOrderRows.length > 0
        ? Math.max(...existingOrderRows.map((row) => row.orderIndex)) + 1
        : 0;

      const allowedFileTypes = Array.isArray(data.allowedFileTypes) && data.allowedFileTypes.length > 0
        ? [...new Set(data.allowedFileTypes)]
        : ['PDF', 'IMAGE'];

      await tx.insert(jiroDeliveryStations).values({
        id,
        expeditionId: data.expeditionId,
        name: data.name,
        description: data.description || null,
        instructions: data.instructions || null,
        orderIndex: data.orderIndex ?? nextOrderIndex,
        allowedFileTypes,
        maxFileSizeMb: data.maxFileSizeMb ?? 10,
        createdAt: now,
        updatedAt: now,
      });

      // Actualizar requiresReview en la expedición
      await tx
        .update(jiroExpeditions)
        .set({ requiresReview: true, updatedAt: now })
        .where(eq(jiroExpeditions.id, data.expeditionId));
    });

    const [station] = await db.select()
      .from(jiroDeliveryStations)
      .where(eq(jiroDeliveryStations.id, id));

    if (!station) {
      throw new Error('No se pudo crear la estación de entrega');
    }

    return {
      ...station,
      allowedFileTypes: this.parseJsonArray(station.allowedFileTypes) || ['PDF', 'IMAGE'],
    };
  },

  async updateDeliveryStation(stationId: string, data: Partial<CreateDeliveryStationData>) {
    const now = new Date();
    const updateData: any = {
      updatedAt: now,
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.instructions !== undefined) updateData.instructions = data.instructions;
    if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex;
    if (data.allowedFileTypes !== undefined) {
      updateData.allowedFileTypes = Array.isArray(data.allowedFileTypes)
        ? [...new Set(data.allowedFileTypes.filter(Boolean))]
        : ['PDF', 'IMAGE'];
    }
    if (data.maxFileSizeMb !== undefined) updateData.maxFileSizeMb = data.maxFileSizeMb;

    await db.transaction(async (tx) => {
      await tx
        .update(jiroDeliveryStations)
        .set(updateData)
        .where(eq(jiroDeliveryStations.id, stationId));
    });

    const [station] = await db
      .select()
      .from(jiroDeliveryStations)
      .where(eq(jiroDeliveryStations.id, stationId));

    if (!station) return null;

    return {
      ...station,
      allowedFileTypes: this.parseJsonArray(station.allowedFileTypes) || ['PDF', 'IMAGE'],
    };
  },

  async deleteDeliveryStation(stationId: string) {
    const now = new Date();
    await db.transaction(async (tx) => {
      // Obtener expeditionId antes de eliminar
      const [station] = await tx
        .select()
        .from(jiroDeliveryStations)
        .where(eq(jiroDeliveryStations.id, stationId));

      if (!station) return;

      // Eliminar entregas asociadas
      await tx.delete(jiroDeliveries)
        .where(eq(jiroDeliveries.deliveryStationId, stationId));
      await tx.delete(jiroDeliveryStations)
        .where(eq(jiroDeliveryStations.id, stationId));

      // Verificar si quedan estaciones de entrega
      const [remaining] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(jiroDeliveryStations)
        .where(eq(jiroDeliveryStations.expeditionId, station.expeditionId));

      if (Number(remaining?.count || 0) === 0) {
        await tx
          .update(jiroExpeditions)
          .set({ requiresReview: false, updatedAt: now })
          .where(eq(jiroExpeditions.id, station.expeditionId));
      }
    });
  },

  // ==================== CONTROL DE EXPEDICIÓN ====================

  async openExpedition(expeditionId: string) {
    const [expedition] = await db
      .select()
      .from(jiroExpeditions)
      .where(eq(jiroExpeditions.id, expeditionId));

    if (!expedition) throw new Error('Expedición no encontrada');

    const now = new Date();
    const updateData: any = {
      status: expedition.mode === 'EXAM' ? 'IN_PROGRESS' : 'OPEN',
      updatedAt: now,
    };

    // En modo EXAM, calcular tiempo de finalización
    if (expedition.mode === 'EXAM' && expedition.timeLimitMinutes) {
      updateData.startedAt = now;
      updateData.endsAt = new Date(now.getTime() + expedition.timeLimitMinutes * 60 * 1000);
    }

    await db
      .update(jiroExpeditions)
      .set(updateData)
      .where(eq(jiroExpeditions.id, expeditionId));

    return this.getExpeditionById(expeditionId);
  },

  async closeExpedition(expeditionId: string) {
    await db
      .update(jiroExpeditions)
      .set({ status: 'CLOSED', updatedAt: new Date() })
      .where(eq(jiroExpeditions.id, expeditionId));

    return this.getExpeditionById(expeditionId);
  },

  // ==================== PROGRESO DE CLASE (PROFESOR) ====================

  async getClassProgress(expeditionId: string) {
    const [expedition] = await db
      .select()
      .from(jiroExpeditions)
      .where(eq(jiroExpeditions.id, expeditionId));

    if (!expedition) throw new Error('Expedición no encontrada');

    // Obtener todos los estudiantes de la clase
    const classStudents = await db
      .select({
        id: studentProfiles.id,
        characterName: studentProfiles.characterName,
        displayName: studentProfiles.displayName,
        level: studentProfiles.level,
        xp: studentProfiles.xp,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(studentProfiles)
      .leftJoin(users, eq(studentProfiles.userId, users.id))
      .where(
        and(
          eq(studentProfiles.classroomId, expedition.classroomId),
          eq(studentProfiles.isActive, true)
        )
      );

    // Obtener progreso de cada estudiante
    const studentExpeditions = await db
      .select()
      .from(jiroStudentExpeditions)
      .where(eq(jiroStudentExpeditions.expeditionId, expeditionId));

    const seMap = new Map(studentExpeditions.map(se => [se.studentProfileId, se]));

    // Contar total de estaciones
    const [questionCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .where(eq(questions.bankId, expedition.questionBankId));

    const [deliveryCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jiroDeliveryStations)
      .where(eq(jiroDeliveryStations.expeditionId, expeditionId));

    const totalStations = Number(questionCount?.count || 0) + Number(deliveryCount?.count || 0);

    const progress = classStudents.map(student => {
      const se = seMap.get(student.id);

      return {
        student: {
          id: student.id,
          name: student.characterName || student.displayName || 
                (student.user ? `${student.user.firstName} ${student.user.lastName}` : 'Sin nombre'),
          level: student.level,
        },
        status: se?.status || 'NOT_STARTED',
        correctAnswers: se?.correctAnswers || 0,
        wrongAnswers: se?.wrongAnswers || 0,
        completedStations: this.parseCompletedStations(se?.completedStations).length,
        totalStations,
        currentEnergy: se?.currentEnergy ?? expedition.initialEnergy,
        finalScore: se?.finalScore,
        startedAt: se?.startedAt,
        completedAt: se?.completedAt,
      };
    });

    return {
      expedition,
      totalStations,
      progress,
    };
  },

  // ==================== REVISIÓN DE ENTREGAS ====================

  async getPendingDeliveries(expeditionId: string) {
    const deliveries = await db
      .select({
        delivery: jiroDeliveries,
        station: {
          id: jiroDeliveryStations.id,
          name: jiroDeliveryStations.name,
        },
        student: {
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
          displayName: studentProfiles.displayName,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(jiroDeliveries)
      .innerJoin(jiroDeliveryStations, eq(jiroDeliveries.deliveryStationId, jiroDeliveryStations.id))
      .innerJoin(jiroStudentExpeditions, eq(jiroDeliveries.studentExpeditionId, jiroStudentExpeditions.id))
      .innerJoin(studentProfiles, eq(jiroStudentExpeditions.studentProfileId, studentProfiles.id))
      .leftJoin(users, eq(studentProfiles.userId, users.id))
      .where(
        and(
          eq(jiroDeliveryStations.expeditionId, expeditionId),
          eq(jiroDeliveries.status, 'PENDING')
        )
      )
      .orderBy(jiroDeliveries.submittedAt);

    return deliveries.map(({ delivery, station, student }) => ({
      ...delivery,
      station,
      student: {
        id: student.id,
        name: student.characterName || student.displayName ||
              ((student.firstName || student.lastName)
                ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
                : 'Sin nombre'),
      },
    }));
  },

  async reviewDelivery(data: ReviewDeliveryData) {
    const now = new Date();
    const delivery = await db.transaction(async (tx): Promise<JiroDelivery | null> => {
      await tx
        .update(jiroDeliveries)
        .set({
          status: data.status,
          feedback: data.feedback || null,
          reviewedAt: now,
        })
        .where(eq(jiroDeliveries.id, data.deliveryId));

      const [updatedDelivery] = await tx
        .select()
        .from(jiroDeliveries)
        .where(eq(jiroDeliveries.id, data.deliveryId));

      return updatedDelivery ?? null;
    });

    if (delivery?.studentExpeditionId) {
      await this.checkAndCompleteExpedition(delivery.studentExpeditionId, data.reviewerId);
    }

    return delivery;
  },

  // ==================== ESTUDIANTE ====================

  async getAvailableExpeditions(studentProfileId: string) {
    // Obtener classroomId del estudiante
    const [student] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));

    if (!student) throw new Error('Estudiante no encontrado');

    // Obtener expediciones abiertas o en progreso
    const expeditions = await db
      .select({
        expedition: jiroExpeditions,
        questionBank: {
          id: questionBanks.id,
          name: questionBanks.name,
          color: questionBanks.color,
          icon: questionBanks.icon,
        },
      })
      .from(jiroExpeditions)
      .leftJoin(questionBanks, eq(jiroExpeditions.questionBankId, questionBanks.id))
      .where(
        and(
          eq(jiroExpeditions.classroomId, student.classroomId),
          sql`${jiroExpeditions.status} IN ('OPEN', 'IN_PROGRESS')`
        )
      )
      .orderBy(desc(jiroExpeditions.createdAt));

    if (expeditions.length === 0) {
      return [];
    }

    const expeditionIds = expeditions.map(({ expedition }) => expedition.id);
    const bankIds = [...new Set(expeditions.map(({ expedition }) => expedition.questionBankId))];

    const studentExpeditions = await db
      .select()
      .from(jiroStudentExpeditions)
      .where(and(
        inArray(jiroStudentExpeditions.expeditionId, expeditionIds),
        eq(jiroStudentExpeditions.studentProfileId, studentProfileId)
      ));

    const questionCounts = bankIds.length > 0
      ? await db
          .select({
            bankId: questions.bankId,
            count: sql<number>`count(*)`,
          })
          .from(questions)
          .where(inArray(questions.bankId, bankIds))
          .groupBy(questions.bankId)
      : [];

    const deliveryCounts = await db
      .select({
        expeditionId: jiroDeliveryStations.expeditionId,
        count: sql<number>`count(*)`,
      })
      .from(jiroDeliveryStations)
      .where(inArray(jiroDeliveryStations.expeditionId, expeditionIds))
      .groupBy(jiroDeliveryStations.expeditionId);

    const studentExpeditionMap = new Map(
      studentExpeditions.map((se) => [se.expeditionId, se])
    );
    const questionCountMap = new Map(
      questionCounts.map((row) => [row.bankId, Number(row.count || 0)])
    );
    const deliveryCountMap = new Map(
      deliveryCounts.map((row) => [row.expeditionId, Number(row.count || 0)])
    );

    return expeditions.map(({ expedition, questionBank }) => {
      const studentExpedition = studentExpeditionMap.get(expedition.id);
      const totalStations =
        (questionCountMap.get(expedition.questionBankId) || 0) +
        (deliveryCountMap.get(expedition.id) || 0);

      return {
        ...expedition,
        questionBank,
        totalStations,
        studentProgress: studentExpedition
          ? {
              status: studentExpedition.status,
              completedStations: this.parseCompletedStations(studentExpedition.completedStations).length,
              currentEnergy: this.calculateCurrentEnergy(studentExpedition, expedition),
            }
          : null,
      };
    });
  },

  async getStudentExpeditionProgress(expeditionId: string, studentProfileId: string) {
    const [expedition] = await db
      .select()
      .from(jiroExpeditions)
      .where(eq(jiroExpeditions.id, expeditionId));

    if (!expedition) throw new Error('Expedición no encontrada');

    // Obtener o crear progreso del estudiante
    let [studentExpedition] = await db
      .select()
      .from(jiroStudentExpeditions)
      .where(
        and(
          eq(jiroStudentExpeditions.expeditionId, expeditionId),
          eq(jiroStudentExpeditions.studentProfileId, studentProfileId)
        )
      );

    // Obtener preguntas del banco
    const bankQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.bankId, expedition.questionBankId))
      .orderBy(questions.createdAt);

    // Obtener estaciones de entrega
    const deliveryStations = await db
      .select()
      .from(jiroDeliveryStations)
      .where(eq(jiroDeliveryStations.expeditionId, expeditionId))
      .orderBy(jiroDeliveryStations.orderIndex);

    // Obtener respuestas del estudiante
    const answers = studentExpedition
      ? await db
          .select()
          .from(jiroQuestionAnswers)
          .where(eq(jiroQuestionAnswers.studentExpeditionId, studentExpedition.id))
      : [];

    // Obtener entregas del estudiante
    const deliveries = studentExpedition
      ? await db
          .select()
          .from(jiroDeliveries)
          .where(eq(jiroDeliveries.studentExpeditionId, studentExpedition.id))
      : [];

    const answersMap = new Map(answers.map(a => [a.questionId, a]));
    const deliveriesMap = new Map(deliveries.map(d => [d.deliveryStationId, d]));

    // Calcular energía actual
    const currentEnergy = studentExpedition
      ? this.calculateCurrentEnergy(studentExpedition, expedition)
      : expedition.initialEnergy;

    // Construir estaciones con estado
    const questionStations = bankQuestions.map((q, index) => {
      const answer = answersMap.get(q.id);
      return {
        type: 'QUESTION' as const,
        id: q.id,
        orderIndex: index,
        question: {
          id: q.id,
          type: q.type,
          questionText: q.questionText,
          imageUrl: q.imageUrl,
          options: this.parseJsonArray(q.options),
          pairs: this.parseJsonArray(q.pairs),
          timeLimitSeconds: q.timeLimitSeconds,
        },
        status: answer
          ? (answer.isCorrect ? 'CORRECT' : 'INCORRECT')
          : 'PENDING',
        answeredAt: answer?.answeredAt,
      };
    });

    const deliveryStationsWithStatus = deliveryStations.map((ds, index) => {
      const delivery = deliveriesMap.get(ds.id);
      return {
        type: 'DELIVERY' as const,
        id: ds.id,
        orderIndex: bankQuestions.length + index,
        station: {
          ...ds,
          allowedFileTypes: this.parseJsonArray(ds.allowedFileTypes) || ['PDF', 'IMAGE'],
        },
        status: delivery
          ? delivery.status
          : 'PENDING',
        delivery: delivery || null,
      };
    });

    // Tiempo restante para modo EXAM
    let timeRemaining: number | null = null;
    if (expedition.mode === 'EXAM' && expedition.endsAt) {
      const now = new Date();
      const endsAt = new Date(expedition.endsAt);
      timeRemaining = Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 1000));
    }

    return {
      expedition: {
        id: expedition.id,
        name: expedition.name,
        description: expedition.description,
        coverImageUrl: expedition.coverImageUrl,
        mode: expedition.mode,
        status: expedition.status,
        initialEnergy: expedition.initialEnergy,
        energyRegenMinutes: expedition.energyRegenMinutes,
        energyPurchasePrice: expedition.energyPurchasePrice,
        rewardXpPerCorrect: expedition.rewardXpPerCorrect,
        rewardGpPerCorrect: expedition.rewardGpPerCorrect,
        timeRemaining,
      },
      studentProgress: studentExpedition ? {
        id: studentExpedition.id,
        status: studentExpedition.status,
        currentEnergy,
        correctAnswers: studentExpedition.correctAnswers,
        wrongAnswers: studentExpedition.wrongAnswers,
        completedStations: this.parseCompletedStations(studentExpedition.completedStations),
        earnedXp: studentExpedition.earnedXp,
        earnedGp: studentExpedition.earnedGp,
        finalScore: studentExpedition.finalScore,
      } : null,
      stations: [...questionStations, ...deliveryStationsWithStatus],
      totalStations: questionStations.length + deliveryStationsWithStatus.length,
    };
  },

  async startExpedition(expeditionId: string, studentProfileId: string) {
    const [expedition] = await db
      .select()
      .from(jiroExpeditions)
      .where(eq(jiroExpeditions.id, expeditionId));

    if (!expedition) throw new Error('Expedición no encontrada');
    if (expedition.status !== 'OPEN' && expedition.status !== 'IN_PROGRESS') {
      throw new Error('La expedición no está disponible');
    }

    // Verificar si ya existe
    const [existing] = await db
      .select()
      .from(jiroStudentExpeditions)
      .where(
        and(
          eq(jiroStudentExpeditions.expeditionId, expeditionId),
          eq(jiroStudentExpeditions.studentProfileId, studentProfileId)
        )
      );

    if (existing) {
      return this.getStudentExpeditionProgress(expeditionId, studentProfileId);
    }

    const now = new Date();
    const id = uuidv4();

    await db.insert(jiroStudentExpeditions).values({
      id,
      expeditionId,
      studentProfileId,
      status: 'IN_PROGRESS',
      currentEnergy: expedition.initialEnergy,
      lastEnergyRegenAt: now,
      correctAnswers: 0,
      wrongAnswers: 0,
      completedStations: [],
      earnedXp: 0,
      earnedGp: 0,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return this.getStudentExpeditionProgress(expeditionId, studentProfileId);
  },

  async answerQuestion(data: AnswerQuestionData) {
    let result: {
      isCorrect: boolean;
      correctAnswer: any;
      explanation: string | null;
      currentEnergy: number;
    } | null = null;

    await db.transaction(async (tx) => {
      const [studentExpedition] = await tx
        .select()
        .from(jiroStudentExpeditions)
        .where(eq(jiroStudentExpeditions.id, data.studentExpeditionId));

      if (!studentExpedition) throw new Error('Progreso no encontrado');
      if (studentExpedition.status !== 'IN_PROGRESS') {
        throw new Error('La expedición no está en progreso');
      }

      const [expedition] = await tx
        .select()
        .from(jiroExpeditions)
        .where(eq(jiroExpeditions.id, studentExpedition.expeditionId));

      if (!expedition) throw new Error('Expedición no encontrada');

      const now = new Date();

      // Verificar tiempo en modo EXAM
      if (expedition.mode === 'EXAM' && expedition.endsAt && now > new Date(expedition.endsAt)) {
        throw new Error('El tiempo ha terminado');
      }

      const energySnapshot = this.getCurrentEnergySnapshot(studentExpedition, expedition, now);
      const currentEnergy = energySnapshot.currentEnergy;
      if (currentEnergy <= 0) {
        throw new Error('No tienes energía suficiente');
      }

      // Verificar si ya respondió esta pregunta
      const [existingAnswer] = await tx
        .select()
        .from(jiroQuestionAnswers)
        .where(
          and(
            eq(jiroQuestionAnswers.studentExpeditionId, data.studentExpeditionId),
            eq(jiroQuestionAnswers.questionId, data.questionId)
          )
        );

      if (existingAnswer) {
        throw new Error('Ya respondiste esta pregunta');
      }

      // Obtener la pregunta, validar pertenencia a banco y verificar respuesta
      const [question] = await tx
        .select()
        .from(questions)
        .where(and(
          eq(questions.id, data.questionId),
          eq(questions.bankId, expedition.questionBankId)
        ));

      if (!question) throw new Error('Pregunta no encontrada en esta expedición');

      const isCorrect = this.checkAnswer(question, data.answer);

      await tx.insert(jiroQuestionAnswers).values({
        id: uuidv4(),
        studentExpeditionId: data.studentExpeditionId,
        questionId: data.questionId,
        answer: data.answer,
        isCorrect,
        energyLost: isCorrect ? 0 : 1,
        answeredAt: now,
      });

      const completedStations = this.parseCompletedStations(studentExpedition.completedStations);
      if (!completedStations.includes(data.questionId)) {
        completedStations.push(data.questionId);
      }

      const newEnergy = isCorrect ? currentEnergy : currentEnergy - 1;
      const nextLastEnergyRegenAt = expedition.mode === 'ASYNC'
        ? (isCorrect ? energySnapshot.lastEnergyRegenAt : now)
        : studentExpedition.lastEnergyRegenAt;

      await tx
        .update(jiroStudentExpeditions)
        .set({
          currentEnergy: newEnergy,
          lastEnergyRegenAt: nextLastEnergyRegenAt,
          correctAnswers: isCorrect ? studentExpedition.correctAnswers + 1 : studentExpedition.correctAnswers,
          wrongAnswers: isCorrect ? studentExpedition.wrongAnswers : studentExpedition.wrongAnswers + 1,
          completedStations,
          updatedAt: now,
        })
        .where(eq(jiroStudentExpeditions.id, data.studentExpeditionId));

      result = {
        isCorrect,
        correctAnswer: isCorrect ? null : this.getCorrectAnswer(question),
        explanation: question.explanation,
        currentEnergy: newEnergy,
      };
    });

    await this.checkAndCompleteExpedition(data.studentExpeditionId);

    if (!result) {
      throw new Error('No se pudo registrar la respuesta');
    }

    return result;
  },

  async submitDelivery(data: SubmitDeliveryData) {
    await db.transaction(async (tx) => {
      const [studentExpedition] = await tx
        .select()
        .from(jiroStudentExpeditions)
        .where(eq(jiroStudentExpeditions.id, data.studentExpeditionId));

      if (!studentExpedition) throw new Error('Progreso no encontrado');
      if (studentExpedition.status !== 'IN_PROGRESS') {
        throw new Error('La expedición no está en progreso');
      }

      const [station] = await tx
        .select()
        .from(jiroDeliveryStations)
        .where(and(
          eq(jiroDeliveryStations.id, data.deliveryStationId),
          eq(jiroDeliveryStations.expeditionId, studentExpedition.expeditionId)
        ));

      if (!station) {
        throw new Error('Estación de entrega no encontrada para esta expedición');
      }

      const allowedFileTypes = this.parseJsonArray(station.allowedFileTypes) || ['PDF', 'IMAGE'];
      if (!allowedFileTypes.includes(data.fileType)) {
        throw new Error('Tipo de archivo no permitido para esta estación');
      }

      // Verificar si ya subió a esta estación
      const [existing] = await tx
        .select()
        .from(jiroDeliveries)
        .where(
          and(
            eq(jiroDeliveries.studentExpeditionId, data.studentExpeditionId),
            eq(jiroDeliveries.deliveryStationId, data.deliveryStationId)
          )
        );

      if (existing) {
        throw new Error('Ya subiste un archivo a esta estación');
      }

      const now = new Date();

      await tx.insert(jiroDeliveries).values({
        id: uuidv4(),
        studentExpeditionId: data.studentExpeditionId,
        deliveryStationId: data.deliveryStationId,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSizeBytes: data.fileSizeBytes,
        status: 'PENDING',
        submittedAt: now,
      });

      const completedStations = this.parseCompletedStations(studentExpedition.completedStations);
      if (!completedStations.includes(data.deliveryStationId)) {
        completedStations.push(data.deliveryStationId);
      }

      await tx
        .update(jiroStudentExpeditions)
        .set({
          completedStations,
          updatedAt: now,
        })
        .where(eq(jiroStudentExpeditions.id, data.studentExpeditionId));
    });

    await this.checkAndCompleteExpedition(data.studentExpeditionId);

    return { success: true };
  },

  async buyEnergy(expeditionId: string, studentProfileId: string) {
    let result: { newEnergy: number; gpSpent: number; remainingGp: number } | null = null;

    await db.transaction(async (tx) => {
      const [expedition] = await tx
        .select()
        .from(jiroExpeditions)
        .where(eq(jiroExpeditions.id, expeditionId));

      if (!expedition) throw new Error('Expedición no encontrada');

      const [studentExpedition] = await tx
        .select()
        .from(jiroStudentExpeditions)
        .where(
          and(
            eq(jiroStudentExpeditions.expeditionId, expeditionId),
            eq(jiroStudentExpeditions.studentProfileId, studentProfileId)
          )
        );

      if (!studentExpedition) throw new Error('No has iniciado esta expedición');
      if (studentExpedition.status !== 'IN_PROGRESS') {
        throw new Error('La expedición no está en progreso');
      }

      const [student] = await tx
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentProfileId));

      if (!student) throw new Error('Estudiante no encontrado');
      if (student.gp < expedition.energyPurchasePrice) {
        throw new Error('No tienes suficiente GP');
      }

      const now = new Date();
      const energySnapshot = this.getCurrentEnergySnapshot(studentExpedition, expedition, now);
      const newEnergy = energySnapshot.currentEnergy + 1;
      const remainingGp = student.gp - expedition.energyPurchasePrice;

      await tx
        .update(studentProfiles)
        .set({
          gp: remainingGp,
          updatedAt: now,
        })
        .where(eq(studentProfiles.id, studentProfileId));

      await tx
        .update(jiroStudentExpeditions)
        .set({
          currentEnergy: newEnergy,
          lastEnergyRegenAt: expedition.mode === 'ASYNC'
            ? (energySnapshot.lastEnergyRegenAt || now)
            : studentExpedition.lastEnergyRegenAt,
          updatedAt: now,
        })
        .where(eq(jiroStudentExpeditions.id, studentExpedition.id));

      await tx.insert(pointLogs).values({
        id: uuidv4(),
        studentId: studentProfileId,
        pointType: 'GP',
        action: 'REMOVE',
        amount: expedition.energyPurchasePrice,
        reason: `Compra de energía - Expedición: ${expedition.name}`,
        createdAt: now,
      });

      result = {
        newEnergy,
        gpSpent: expedition.energyPurchasePrice,
        remainingGp,
      };
    });

    if (!result) {
      throw new Error('No se pudo completar la compra de energía');
    }

    return result;
  },

  // ==================== HELPERS ====================

  calculateCurrentEnergy(studentExpedition: JiroStudentExpedition, expedition: JiroExpedition): number {
    return this.getCurrentEnergySnapshot(studentExpedition, expedition).currentEnergy;
  },

  checkAnswer(question: any, answer: any): boolean {
    // Parsear options y pairs si vienen como string JSON o convertir objeto a array
    const parseJsonToArray = (field: any): any[] | null => {
      if (!field) return null;
      let parsed = field;
      // Parsear mientras sea string (puede estar doblemente serializado)
      while (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { break; }
      }
      // Si es un objeto con índices numéricos, convertir a array
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.values(parsed);
      }
      return Array.isArray(parsed) ? parsed : null;
    };
    
    const options = parseJsonToArray(question.options);
    const pairs = parseJsonToArray(question.pairs);
    
    switch (question.type) {
      case 'TRUE_FALSE':
        // Normalizar correctAnswer a booleano
        let correctAnswer = question.correctAnswer;
        // Parsear mientras sea string (puede estar doblemente serializado)
        while (typeof correctAnswer === 'string') {
          const lower = correctAnswer.toLowerCase();
          if (lower === 'true') {
            correctAnswer = true;
            break;
          } else if (lower === 'false') {
            correctAnswer = false;
            break;
          }
          try {
            correctAnswer = JSON.parse(correctAnswer);
          } catch {
            break;
          }
        }
        // Asegurar que sea booleano
        const correctBool = correctAnswer === true;
        
        // answer del frontend viene como booleano
        const answerBool = answer === true || answer === 'true';
        return answerBool === correctBool;

      case 'SINGLE_CHOICE':
        const correctOption = options?.findIndex((o: any) => o.isCorrect === true);
        return answer === correctOption;

      case 'MULTIPLE_CHOICE':
        const correctIndices = options
          ?.map((o: any, i: number) => o.isCorrect ? i : -1)
          .filter((i: number) => i !== -1) || [];
        const answerArray = Array.isArray(answer) ? answer.sort() : [];
        return JSON.stringify(answerArray) === JSON.stringify(correctIndices.sort());

      case 'MATCHING':
        if (!pairs || !Array.isArray(answer)) return false;
        return pairs.every((pair: any, index: number) => {
          return answer[index] === index;
        });

      default:
        return false;
    }
  },

  getCorrectAnswer(question: any): any {
    // Parsear options y pairs si vienen como string JSON o convertir objeto a array
    const parseJsonToArray = (field: any): any[] | null => {
      if (!field) return null;
      let parsed = field;
      // Parsear mientras sea string (puede estar doblemente serializado)
      while (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { break; }
      }
      // Si es un objeto con índices numéricos, convertir a array
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.values(parsed);
      }
      return Array.isArray(parsed) ? parsed : null;
    };
    
    const options = parseJsonToArray(question.options);
    const pairs = parseJsonToArray(question.pairs);
    
    switch (question.type) {
      case 'TRUE_FALSE':
        // Normalizar a booleano
        let ca = question.correctAnswer;
        if (typeof ca === 'string') {
          ca = ca === 'true' || ca === 'TRUE';
        }
        return ca;

      case 'SINGLE_CHOICE':
        return options?.findIndex((o: any) => o.isCorrect === true);

      case 'MULTIPLE_CHOICE':
        return options
          ?.map((o: any, i: number) => o.isCorrect ? i : -1)
          .filter((i: number) => i !== -1);

      case 'MATCHING':
        return pairs?.map((_: any, i: number) => i);

      default:
        return null;
    }
  },

  async checkAndCompleteExpedition(studentExpeditionId: string, reviewerId?: string) {
    const now = new Date();
    const xpSideEffects = await db.transaction(async (tx): Promise<XpSideEffectPayload | null> => {
      const [studentExpedition] = await tx
        .select()
        .from(jiroStudentExpeditions)
        .where(eq(jiroStudentExpeditions.id, studentExpeditionId));

      if (!studentExpedition || studentExpedition.status === 'COMPLETED') return null;

      const [expedition] = await tx
        .select()
        .from(jiroExpeditions)
        .where(eq(jiroExpeditions.id, studentExpedition.expeditionId));

      if (!expedition) return null;

      const [questionCount] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(questions)
        .where(eq(questions.bankId, expedition.questionBankId));

      const [deliveryCount] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(jiroDeliveryStations)
        .where(eq(jiroDeliveryStations.expeditionId, expedition.id));

      const [answerCount] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(jiroQuestionAnswers)
        .where(eq(jiroQuestionAnswers.studentExpeditionId, studentExpeditionId));

      const [submittedDeliveryCount] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(jiroDeliveries)
        .where(eq(jiroDeliveries.studentExpeditionId, studentExpeditionId));

      const totalStations = Number(questionCount?.count || 0) + Number(deliveryCount?.count || 0);
      const completedCount = Number(answerCount?.count || 0) + Number(submittedDeliveryCount?.count || 0);

      if (completedCount < totalStations) return null;

      if (expedition.requiresReview) {
        const [pendingDeliveryCount] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(jiroDeliveries)
          .where(
            and(
              eq(jiroDeliveries.studentExpeditionId, studentExpeditionId),
              eq(jiroDeliveries.status, 'PENDING')
            )
          );

        if (Number(pendingDeliveryCount?.count || 0) > 0) {
          await tx
            .update(jiroStudentExpeditions)
            .set({ status: 'PENDING_REVIEW', updatedAt: now })
            .where(eq(jiroStudentExpeditions.id, studentExpeditionId));
          return null;
        }
      }

      const totalQuestions = Number(questionCount?.count || 0);
      const earnedXp = studentExpedition.correctAnswers * expedition.rewardXpPerCorrect;
      const earnedGp = studentExpedition.correctAnswers * expedition.rewardGpPerCorrect;
      const finalScore = totalQuestions > 0
        ? (studentExpedition.correctAnswers / totalQuestions) * 100
        : 0;

      await tx
        .update(jiroStudentExpeditions)
        .set({
          status: 'COMPLETED',
          earnedXp,
          earnedGp,
          finalScore: String(finalScore.toFixed(2)),
          completedAt: now,
          reviewedAt: reviewerId ? now : null,
          reviewedBy: reviewerId || null,
          updatedAt: now,
        })
        .where(eq(jiroStudentExpeditions.id, studentExpeditionId));

      const [student] = await tx
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentExpedition.studentProfileId));

      if (!student) return null;

      const [classroom] = await tx
        .select({ xpPerLevel: classrooms.xpPerLevel })
        .from(classrooms)
        .where(eq(classrooms.id, student.classroomId));

      const newXp = student.xp + earnedXp;
      const newGp = student.gp + earnedGp;
      const xpPerLevel = classroom?.xpPerLevel || 100;
      const newLevel = earnedXp > 0 ? this.calculateLevel(newXp, xpPerLevel) : student.level;
      const leveledUp = newLevel > student.level;

      await tx
        .update(studentProfiles)
        .set({
          xp: newXp,
          gp: newGp,
          level: newLevel,
          updatedAt: now,
        })
        .where(eq(studentProfiles.id, student.id));

      const reason = `Expedición Jiro completada: ${expedition.name}`;

      if (earnedXp > 0) {
        await tx.insert(pointLogs).values({
          id: uuidv4(),
          studentId: student.id,
          pointType: 'XP',
          action: 'ADD',
          amount: earnedXp,
          reason,
          createdAt: now,
        });
      }

      if (earnedGp > 0) {
        await tx.insert(pointLogs).values({
          id: uuidv4(),
          studentId: student.id,
          pointType: 'GP',
          action: 'ADD',
          amount: earnedGp,
          reason,
          createdAt: now,
        });
      }

      if (student.userId) {
        const rewardText = [
          earnedXp > 0 ? `+${earnedXp} XP` : '',
          earnedGp > 0 ? `+${earnedGp} GP` : '',
        ].filter(Boolean).join(' ');

        if (rewardText) {
          await tx.insert(notifications).values({
            id: uuidv4(),
            userId: student.userId,
            classroomId: expedition.classroomId,
            type: 'POINTS',
            title: '🚀 ¡Expedición completada!',
            message: `Has recibido ${rewardText} por completar "${expedition.name}"`,
            isRead: false,
            createdAt: now,
          });
        }

        if (leveledUp) {
          await tx.insert(notifications).values({
            id: uuidv4(),
            userId: student.userId,
            classroomId: expedition.classroomId,
            type: 'LEVEL_UP',
            title: '🎉 ¡Subiste de nivel!',
            message: `¡Felicidades! Has alcanzado el nivel ${newLevel}`,
            isRead: false,
            createdAt: now,
          });
        }
      }

      if (earnedXp > 0) {
        return {
          studentProfileId: student.id,
          classroomId: expedition.classroomId,
          awardedXp: earnedXp,
          reason,
        };
      }

      return null;
    });

    // Emit after tx commit — get userId from the xpSideEffects or look up
    if (xpSideEffects) {
      const [sp] = await db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.id, xpSideEffects.studentProfileId));
      if (sp?.userId) await emitUnreadCount(sp.userId);
    }

    if (xpSideEffects) {
      try {
        await clanService.contributeXpToClan(
          xpSideEffects.studentProfileId,
          xpSideEffects.awardedXp,
          xpSideEffects.reason
        );
      } catch {
        // Silently fail
      }

      try {
        await storyService.onXpAwarded(
          xpSideEffects.classroomId,
          xpSideEffects.studentProfileId,
          xpSideEffects.awardedXp
        );
      } catch {
        // Silently fail
      }
    }
  },

  async forceCompleteByTimeout(expeditionId: string, studentProfileId: string): Promise<{
    success: boolean;
    message: string;
    finalScore?: string;
    earnedXp?: number;
    earnedGp?: number;
  }> {
    const now = new Date();
    const { result, xpSideEffects } = await db.transaction(async (tx): Promise<{
      result: {
        success: boolean;
        message: string;
        finalScore?: string;
        earnedXp?: number;
        earnedGp?: number;
      };
      xpSideEffects: XpSideEffectPayload | null;
    }> => {
      const [studentExpedition] = await tx
        .select()
        .from(jiroStudentExpeditions)
        .where(
          and(
            eq(jiroStudentExpeditions.expeditionId, expeditionId),
            eq(jiroStudentExpeditions.studentProfileId, studentProfileId)
          )
        );

      if (!studentExpedition) {
        return {
          result: { success: false, message: 'Expedición no encontrada' },
          xpSideEffects: null,
        };
      }

      if (studentExpedition.status === 'COMPLETED') {
        return {
          result: { success: true, message: 'Ya completada' },
          xpSideEffects: null,
        };
      }

      const [expedition] = await tx
        .select()
        .from(jiroExpeditions)
        .where(eq(jiroExpeditions.id, expeditionId));

      if (!expedition || expedition.mode !== 'EXAM') {
        return {
          result: { success: false, message: 'Solo aplica para modo examen' },
          xpSideEffects: null,
        };
      }

      if (!expedition.endsAt || now < new Date(expedition.endsAt)) {
        return {
          result: { success: false, message: 'El examen aún no ha terminado' },
          xpSideEffects: null,
        };
      }

      const [questionCount] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(questions)
        .where(eq(questions.bankId, expedition.questionBankId));

      const [deliveryCount] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(jiroDeliveryStations)
        .where(eq(jiroDeliveryStations.expeditionId, expeditionId));

      const totalStations = Number(questionCount?.count || 0) + Number(deliveryCount?.count || 0);
      const correctAnswers = studentExpedition.correctAnswers || 0;
      const finalScore = totalStations > 0 ? (correctAnswers / totalStations) * 100 : 0;
      const earnedXp = correctAnswers * expedition.rewardXpPerCorrect;
      const earnedGp = correctAnswers * expedition.rewardGpPerCorrect;
      let transactionSideEffects: XpSideEffectPayload | null = null;

      await tx
        .update(jiroStudentExpeditions)
        .set({
          status: 'COMPLETED',
          earnedXp,
          earnedGp,
          finalScore: String(finalScore.toFixed(2)),
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(jiroStudentExpeditions.id, studentExpedition.id));

      const [student] = await tx
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentProfileId));

      if (student) {
        const [classroom] = await tx
          .select({ xpPerLevel: classrooms.xpPerLevel })
          .from(classrooms)
          .where(eq(classrooms.id, student.classroomId));

        const newXp = student.xp + earnedXp;
        const newGp = student.gp + earnedGp;
        const xpPerLevel = classroom?.xpPerLevel || 100;
        const newLevel = earnedXp > 0 ? this.calculateLevel(newXp, xpPerLevel) : student.level;
        const leveledUp = newLevel > student.level;

        await tx
          .update(studentProfiles)
          .set({
            xp: newXp,
            gp: newGp,
            level: newLevel,
            updatedAt: now,
          })
          .where(eq(studentProfiles.id, student.id));

        const reason = `Expedición Jiro finalizada por tiempo: ${expedition.name}`;

        if (earnedXp > 0) {
          await tx.insert(pointLogs).values({
            id: uuidv4(),
            studentId: student.id,
            pointType: 'XP',
            action: 'ADD',
            amount: earnedXp,
            reason,
            createdAt: now,
          });
        }

        if (earnedGp > 0) {
          await tx.insert(pointLogs).values({
            id: uuidv4(),
            studentId: student.id,
            pointType: 'GP',
            action: 'ADD',
            amount: earnedGp,
            reason,
            createdAt: now,
          });
        }

        if (student.userId) {
          const rewardText = [
            earnedXp > 0 ? `+${earnedXp} XP` : '',
            earnedGp > 0 ? `+${earnedGp} GP` : '',
          ].filter(Boolean).join(' ');

          if (rewardText) {
            await tx.insert(notifications).values({
              id: uuidv4(),
              userId: student.userId,
              classroomId: expedition.classroomId,
              type: 'POINTS',
              title: '⏱️ Examen finalizado',
              message: `Has recibido ${rewardText} al finalizar "${expedition.name}" por tiempo`,
              isRead: false,
              createdAt: now,
            });
          }

          if (leveledUp) {
            await tx.insert(notifications).values({
              id: uuidv4(),
              userId: student.userId,
              classroomId: expedition.classroomId,
              type: 'LEVEL_UP',
              title: '🎉 ¡Subiste de nivel!',
              message: `¡Felicidades! Has alcanzado el nivel ${newLevel}`,
              isRead: false,
              createdAt: now,
            });
          }
        }

        if (earnedXp > 0) {
          transactionSideEffects = {
            studentProfileId: student.id,
            classroomId: expedition.classroomId,
            awardedXp: earnedXp,
            reason,
          };
        }
      }

      return {
        result: {
          success: true,
          message: 'Examen finalizado por tiempo',
          finalScore: finalScore.toFixed(2),
          earnedXp,
          earnedGp,
        },
        xpSideEffects: transactionSideEffects,
      };
    });

    // Emit after tx commit
    if (xpSideEffects) {
      const [sp] = await db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.id, xpSideEffects.studentProfileId));
      if (sp?.userId) await emitUnreadCount(sp.userId);
    }

    if (xpSideEffects) {
      try {
        await clanService.contributeXpToClan(
          xpSideEffects.studentProfileId,
          xpSideEffects.awardedXp,
          xpSideEffects.reason
        );
      } catch {
        // Silently fail
      }

      try {
        await storyService.onXpAwarded(
          xpSideEffects.classroomId,
          xpSideEffects.studentProfileId,
          xpSideEffects.awardedXp
        );
      } catch {
        // Silently fail
      }
    }

    return result;
  },

  // Obtener respuestas de un estudiante para una expedición (para profesor)
  async getStudentAnswers(expeditionId: string, studentProfileId: string) {
    // Primero obtener el studentExpedition
    const [studentExpedition] = await db
      .select({ id: jiroStudentExpeditions.id })
      .from(jiroStudentExpeditions)
      .where(
        and(
          eq(jiroStudentExpeditions.expeditionId, expeditionId),
          eq(jiroStudentExpeditions.studentProfileId, studentProfileId)
        )
      );

    if (!studentExpedition) {
      return [];
    }

    // Obtener las respuestas del estudiante
    const answers = await db
      .select()
      .from(jiroQuestionAnswers)
      .where(eq(jiroQuestionAnswers.studentExpeditionId, studentExpedition.id))
      .orderBy(jiroQuestionAnswers.answeredAt);

    if (answers.length === 0) {
      return [];
    }

    // Obtener los detalles de las preguntas
    const questionIds = answers.map(a => a.questionId);

    const questionsData = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        type: questions.type,
        correctAnswer: questions.correctAnswer,
        options: questions.options,
        pairs: questions.pairs,
        explanation: questions.explanation,
      })
      .from(questions)
      .where(inArray(questions.id, questionIds));

    const questionsMap = new Map(questionsData.map(q => [q.id, q]));

    // Helper para parsear JSON
    const parseJson = (field: any): any => {
      if (!field) return null;
      let parsed = field;
      while (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { break; }
      }
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.values(parsed);
      }
      return parsed;
    };

    // Helper para formatear respuesta a texto legible
    const formatAnswerText = (answer: any, question: any): string => {
      if (answer === null || answer === undefined) return '-';
      const options = parseJson(question?.options);
      const pairs = parseJson(question?.pairs);
      
      switch (question?.type) {
        case 'TRUE_FALSE':
          const val = answer === true || answer === 'true';
          return val ? 'Verdadero' : 'Falso';
        case 'SINGLE_CHOICE':
          if (typeof answer === 'number' && options && options[answer]) {
            return options[answer].text || `Opción ${answer + 1}`;
          }
          return String(answer);
        case 'MULTIPLE_CHOICE':
          if (Array.isArray(answer) && options) {
            return answer.map(i => options[i]?.text || `Opción ${i + 1}`).join(', ');
          }
          return String(answer);
        case 'MATCHING':
          if (Array.isArray(answer) && pairs) {
            return pairs.map((p: any, i: number) => 
              `${p.left} → ${pairs[answer[i]]?.right || '?'}`
            ).join(', ');
          }
          return String(answer);
        default:
          return String(answer);
      }
    };

    // Helper para obtener respuesta correcta formateada
    const getCorrectAnswerText = (question: any): string => {
      const options = parseJson(question?.options);
      const pairs = parseJson(question?.pairs);
      
      switch (question?.type) {
        case 'TRUE_FALSE':
          let ca = question.correctAnswer;
          if (typeof ca === 'string') ca = ca === 'true' || ca === 'TRUE';
          return ca ? 'Verdadero' : 'Falso';
        case 'SINGLE_CHOICE':
          const correctIdx = options?.findIndex((o: any) => o.isCorrect === true);
          if (correctIdx >= 0 && options[correctIdx]) {
            return options[correctIdx].text || `Opción ${correctIdx + 1}`;
          }
          return '-';
        case 'MULTIPLE_CHOICE':
          const correctOpts = options?.filter((o: any) => o.isCorrect === true) || [];
          return correctOpts.map((o: any) => o.text).join(', ') || '-';
        case 'MATCHING':
          if (pairs) {
            return pairs.map((p: any) => `${p.left} → ${p.right}`).join(', ');
          }
          return '-';
        default:
          return '-';
      }
    };

    return answers.map(a => {
      const question = questionsMap.get(a.questionId);
      return {
        id: a.id,
        questionText: question?.questionText || 'Pregunta no encontrada',
        questionType: question?.type || 'UNKNOWN',
        givenAnswer: formatAnswerText(a.answer, question),
        correctAnswer: getCorrectAnswerText(question),
        isCorrect: a.isCorrect,
        explanation: question?.explanation || null,
        answeredAt: a.answeredAt?.toISOString() || null,
      };
    });
  },

  // Obtener entregas de un estudiante en una expedición
  async getStudentDeliveries(expeditionId: string, studentProfileId: string) {
    // Obtener la expedición del estudiante
    const [studentExpedition] = await db
      .select()
      .from(jiroStudentExpeditions)
      .where(
        and(
          eq(jiroStudentExpeditions.expeditionId, expeditionId),
          eq(jiroStudentExpeditions.studentProfileId, studentProfileId)
        )
      );

    if (!studentExpedition) {
      return [];
    }

    // Obtener las entregas con info de la estación
    const deliveriesData = await db
      .select({
        delivery: jiroDeliveries,
        station: jiroDeliveryStations,
      })
      .from(jiroDeliveries)
      .innerJoin(jiroDeliveryStations, eq(jiroDeliveries.deliveryStationId, jiroDeliveryStations.id))
      .where(eq(jiroDeliveries.studentExpeditionId, studentExpedition.id))
      .orderBy(jiroDeliveries.submittedAt);

    return deliveriesData.map(({ delivery, station }) => ({
      id: delivery.id,
      stationName: station.name,
      stationDescription: station.description,
      fileName: delivery.fileName,
      fileUrl: delivery.fileUrl,
      fileType: delivery.fileType,
      fileSizeBytes: delivery.fileSizeBytes,
      status: delivery.status,
      feedback: delivery.feedback,
      submittedAt: delivery.submittedAt?.toISOString() || null,
      reviewedAt: delivery.reviewedAt?.toISOString() || null,
    }));
  },
};
