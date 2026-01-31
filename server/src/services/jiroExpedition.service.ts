import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
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

// ==================== SERVICIO ====================

export const jiroExpeditionService = {
  // ==================== EXPEDICIONES (PROFESOR) ====================

  async createExpedition(data: CreateExpeditionData): Promise<JiroExpedition> {
    const now = new Date();
    const id = uuidv4();

    await db.insert(jiroExpeditions).values({
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
      const competencyValues = data.competencyIds.map(competencyId => ({
        id: uuidv4(),
        expeditionId: id,
        competencyId,
        createdAt: now,
      }));
      await db.insert(jiroExpeditionCompetencies).values(competencyValues);
    }

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

    // Obtener conteo de estaciones de entrega y estudiantes
    const expeditionIds = expeditions.map(e => e.expedition.id);
    
    const results = await Promise.all(
      expeditions.map(async ({ expedition, questionBank }) => {
        const [deliveryStations] = await db
          .select({ count: sql<number>`count(*)` })
          .from(jiroDeliveryStations)
          .where(eq(jiroDeliveryStations.expeditionId, expedition.id));

        const [studentCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(jiroStudentExpeditions)
          .where(eq(jiroStudentExpeditions.expeditionId, expedition.id));

        const [questionCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(questions)
          .where(eq(questions.bankId, expedition.questionBankId));

        return {
          ...expedition,
          questionBank,
          deliveryStationsCount: Number(deliveryStations?.count || 0),
          studentsStarted: Number(studentCount?.count || 0),
          totalQuestions: Number(questionCount?.count || 0),
        };
      })
    );

    return results;
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
    const updateData: any = {
      updatedAt: new Date(),
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

    await db
      .update(jiroExpeditions)
      .set(updateData)
      .where(eq(jiroExpeditions.id, expeditionId));

    return this.getExpeditionById(expeditionId);
  },

  async deleteExpedition(expeditionId: string) {
    // Eliminar en orden por dependencias
    const studentExpeditions = await db
      .select({ id: jiroStudentExpeditions.id })
      .from(jiroStudentExpeditions)
      .where(eq(jiroStudentExpeditions.expeditionId, expeditionId));

    for (const se of studentExpeditions) {
      await db.delete(jiroQuestionAnswers).where(eq(jiroQuestionAnswers.studentExpeditionId, se.id));
      await db.delete(jiroDeliveries).where(eq(jiroDeliveries.studentExpeditionId, se.id));
    }

    await db.delete(jiroStudentExpeditions).where(eq(jiroStudentExpeditions.expeditionId, expeditionId));
    await db.delete(jiroDeliveryStations).where(eq(jiroDeliveryStations.expeditionId, expeditionId));
    await db.delete(jiroExpeditions).where(eq(jiroExpeditions.id, expeditionId));
  },

  // ==================== ESTACIONES DE ENTREGA ====================

  async createDeliveryStation(data: CreateDeliveryStationData): Promise<JiroDeliveryStation> {
    const now = new Date();
    const id = uuidv4();

    await db.insert(jiroDeliveryStations).values({
      id,
      expeditionId: data.expeditionId,
      name: data.name,
      description: data.description || null,
      instructions: data.instructions || null,
      orderIndex: data.orderIndex ?? 0,
      allowedFileTypes: data.allowedFileTypes || ['PDF', 'IMAGE'],
      maxFileSizeMb: data.maxFileSizeMb ?? 10,
      createdAt: now,
      updatedAt: now,
    });

    // Actualizar requiresReview en la expedición
    await db
      .update(jiroExpeditions)
      .set({ requiresReview: true, updatedAt: now })
      .where(eq(jiroExpeditions.id, data.expeditionId));

    const [station] = await db
      .select()
      .from(jiroDeliveryStations)
      .where(eq(jiroDeliveryStations.id, id));

    return station;
  },

  async updateDeliveryStation(stationId: string, data: Partial<CreateDeliveryStationData>) {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.instructions !== undefined) updateData.instructions = data.instructions;
    if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex;
    if (data.allowedFileTypes !== undefined) updateData.allowedFileTypes = data.allowedFileTypes;
    if (data.maxFileSizeMb !== undefined) updateData.maxFileSizeMb = data.maxFileSizeMb;

    await db
      .update(jiroDeliveryStations)
      .set(updateData)
      .where(eq(jiroDeliveryStations.id, stationId));

    const [station] = await db
      .select()
      .from(jiroDeliveryStations)
      .where(eq(jiroDeliveryStations.id, stationId));

    return station;
  },

  async deleteDeliveryStation(stationId: string) {
    // Obtener expeditionId antes de eliminar
    const [station] = await db
      .select()
      .from(jiroDeliveryStations)
      .where(eq(jiroDeliveryStations.id, stationId));

    if (!station) return;

    // Eliminar entregas asociadas
    await db.delete(jiroDeliveries).where(eq(jiroDeliveries.deliveryStationId, stationId));
    await db.delete(jiroDeliveryStations).where(eq(jiroDeliveryStations.id, stationId));

    // Verificar si quedan estaciones de entrega
    const [remaining] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jiroDeliveryStations)
      .where(eq(jiroDeliveryStations.expeditionId, station.expeditionId));

    if (Number(remaining?.count || 0) === 0) {
      await db
        .update(jiroExpeditions)
        .set({ requiresReview: false, updatedAt: new Date() })
        .where(eq(jiroExpeditions.id, station.expeditionId));
    }
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
      // Parsear completedStations de forma segura (puede venir como string corrupto)
      const parseCompletedStations = (cs: any): number => {
        if (!cs) return 0;
        if (Array.isArray(cs)) return cs.length;
        if (typeof cs === 'string') {
          try {
            const parsed = JSON.parse(cs);
            return Array.isArray(parsed) ? parsed.length : 0;
          } catch {
            return 0;
          }
        }
        return 0;
      };

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
        completedStations: parseCompletedStations(se?.completedStations),
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
        station: jiroDeliveryStations,
        studentExpedition: jiroStudentExpeditions,
      })
      .from(jiroDeliveries)
      .innerJoin(jiroDeliveryStations, eq(jiroDeliveries.deliveryStationId, jiroDeliveryStations.id))
      .innerJoin(jiroStudentExpeditions, eq(jiroDeliveries.studentExpeditionId, jiroStudentExpeditions.id))
      .where(
        and(
          eq(jiroDeliveryStations.expeditionId, expeditionId),
          eq(jiroDeliveries.status, 'PENDING')
        )
      )
      .orderBy(jiroDeliveries.submittedAt);

    // Obtener info de estudiantes
    const results = await Promise.all(
      deliveries.map(async ({ delivery, station, studentExpedition }) => {
        const [student] = await db
          .select({
            id: studentProfiles.id,
            characterName: studentProfiles.characterName,
            displayName: studentProfiles.displayName,
            user: {
              firstName: users.firstName,
              lastName: users.lastName,
            },
          })
          .from(studentProfiles)
          .leftJoin(users, eq(studentProfiles.userId, users.id))
          .where(eq(studentProfiles.id, studentExpedition.studentProfileId));

        return {
          ...delivery,
          station: {
            id: station.id,
            name: station.name,
          },
          student: {
            id: student.id,
            name: student.characterName || student.displayName ||
                  (student.user ? `${student.user.firstName} ${student.user.lastName}` : 'Sin nombre'),
          },
        };
      })
    );

    return results;
  },

  async reviewDelivery(data: ReviewDeliveryData) {
    const now = new Date();

    await db
      .update(jiroDeliveries)
      .set({
        status: data.status,
        feedback: data.feedback || null,
        reviewedAt: now,
      })
      .where(eq(jiroDeliveries.id, data.deliveryId));

    // Obtener la entrega para verificar si el estudiante completó todo
    const [delivery] = await db
      .select()
      .from(jiroDeliveries)
      .where(eq(jiroDeliveries.id, data.deliveryId));

    if (delivery) {
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

    // Obtener progreso del estudiante en cada expedición
    const results = await Promise.all(
      expeditions.map(async ({ expedition, questionBank }) => {
        const [studentExpedition] = await db
          .select()
          .from(jiroStudentExpeditions)
          .where(
            and(
              eq(jiroStudentExpeditions.expeditionId, expedition.id),
              eq(jiroStudentExpeditions.studentProfileId, studentProfileId)
            )
          );

        const [questionCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(questions)
          .where(eq(questions.bankId, expedition.questionBankId));

        const [deliveryCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(jiroDeliveryStations)
          .where(eq(jiroDeliveryStations.expeditionId, expedition.id));

        const totalStations = Number(questionCount?.count || 0) + Number(deliveryCount?.count || 0);

        // Parsear completedStations de forma segura
        const parseCompletedStations = (cs: any): number => {
          if (!cs) return 0;
          if (Array.isArray(cs)) return cs.length;
          if (typeof cs === 'string') {
            try {
              const parsed = JSON.parse(cs);
              return Array.isArray(parsed) ? parsed.length : 0;
            } catch {
              return 0;
            }
          }
          return 0;
        };

        return {
          ...expedition,
          questionBank,
          totalStations,
          studentProgress: studentExpedition ? {
            status: studentExpedition.status,
            completedStations: parseCompletedStations(studentExpedition.completedStations),
            currentEnergy: this.calculateCurrentEnergy(studentExpedition, expedition),
          } : null,
        };
      })
    );

    return results;
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
          options: q.options,
          pairs: q.pairs,
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
        station: ds,
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
        completedStations: studentExpedition.completedStations,
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
    const [studentExpedition] = await db
      .select()
      .from(jiroStudentExpeditions)
      .where(eq(jiroStudentExpeditions.id, data.studentExpeditionId));

    if (!studentExpedition) throw new Error('Progreso no encontrado');
    if (studentExpedition.status !== 'IN_PROGRESS') {
      throw new Error('La expedición no está en progreso');
    }

    const [expedition] = await db
      .select()
      .from(jiroExpeditions)
      .where(eq(jiroExpeditions.id, studentExpedition.expeditionId));

    // Verificar tiempo en modo EXAM
    if (expedition.mode === 'EXAM' && expedition.endsAt) {
      if (new Date() > new Date(expedition.endsAt)) {
        throw new Error('El tiempo ha terminado');
      }
    }

    // Calcular energía actual
    const currentEnergy = this.calculateCurrentEnergy(studentExpedition, expedition);
    if (currentEnergy <= 0) {
      throw new Error('No tienes energía suficiente');
    }

    // Verificar si ya respondió esta pregunta
    const [existingAnswer] = await db
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

    // Obtener la pregunta y verificar respuesta
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, data.questionId));

    if (!question) throw new Error('Pregunta no encontrada');

    const isCorrect = this.checkAnswer(question, data.answer);
    const now = new Date();

    // Guardar respuesta
    await db.insert(jiroQuestionAnswers).values({
      id: uuidv4(),
      studentExpeditionId: data.studentExpeditionId,
      questionId: data.questionId,
      answer: data.answer,
      isCorrect,
      energyLost: isCorrect ? 0 : 1,
      answeredAt: now,
    });

    // Actualizar progreso del estudiante
    // completedStations guarda TODAS las preguntas respondidas (correctas e incorrectas)
    // Parsear completedStations si viene como string (puede estar corrupto)
    let existingStations: string[] = [];
    if (studentExpedition.completedStations) {
      if (Array.isArray(studentExpedition.completedStations)) {
        existingStations = studentExpedition.completedStations;
      } else if (typeof studentExpedition.completedStations === 'string') {
        try {
          const parsed = JSON.parse(studentExpedition.completedStations);
          existingStations = Array.isArray(parsed) ? parsed : [];
        } catch {
          existingStations = [];
        }
      }
    }
    const completedStations = [...existingStations];
    if (!completedStations.includes(data.questionId)) {
      completedStations.push(data.questionId);
    }

    const newEnergy = isCorrect ? currentEnergy : currentEnergy - 1;

    await db
      .update(jiroStudentExpeditions)
      .set({
        currentEnergy: newEnergy,
        lastEnergyRegenAt: isCorrect ? studentExpedition.lastEnergyRegenAt : now,
        correctAnswers: isCorrect ? studentExpedition.correctAnswers + 1 : studentExpedition.correctAnswers,
        wrongAnswers: isCorrect ? studentExpedition.wrongAnswers : studentExpedition.wrongAnswers + 1,
        completedStations,
        updatedAt: now,
      })
      .where(eq(jiroStudentExpeditions.id, data.studentExpeditionId));

    // Verificar si completó la expedición
    await this.checkAndCompleteExpedition(data.studentExpeditionId);

    return {
      isCorrect,
      correctAnswer: isCorrect ? null : this.getCorrectAnswer(question),
      explanation: question.explanation,
      currentEnergy: newEnergy,
    };
  },

  async submitDelivery(data: SubmitDeliveryData) {
    const [studentExpedition] = await db
      .select()
      .from(jiroStudentExpeditions)
      .where(eq(jiroStudentExpeditions.id, data.studentExpeditionId));

    if (!studentExpedition) throw new Error('Progreso no encontrado');
    if (studentExpedition.status !== 'IN_PROGRESS') {
      throw new Error('La expedición no está en progreso');
    }

    // Verificar si ya subió a esta estación
    const [existing] = await db
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
    const id = uuidv4();

    await db.insert(jiroDeliveries).values({
      id,
      studentExpeditionId: data.studentExpeditionId,
      deliveryStationId: data.deliveryStationId,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileType: data.fileType,
      fileSizeBytes: data.fileSizeBytes,
      status: 'PENDING',
      submittedAt: now,
    });

    // Actualizar estaciones completadas (entregas siempre avanzan)
    // Parsear completedStations si viene como string
    let existingStations: string[] = [];
    if (studentExpedition.completedStations) {
      if (Array.isArray(studentExpedition.completedStations)) {
        existingStations = studentExpedition.completedStations;
      } else if (typeof studentExpedition.completedStations === 'string') {
        try {
          const parsed = JSON.parse(studentExpedition.completedStations);
          existingStations = Array.isArray(parsed) ? parsed : [];
        } catch {
          existingStations = [];
        }
      }
    }
    const completedStations = [...existingStations];
    if (!completedStations.includes(data.deliveryStationId)) {
      completedStations.push(data.deliveryStationId);
    }

    await db
      .update(jiroStudentExpeditions)
      .set({
        completedStations,
        updatedAt: now,
      })
      .where(eq(jiroStudentExpeditions.id, data.studentExpeditionId));

    // Verificar si completó la expedición
    await this.checkAndCompleteExpedition(data.studentExpeditionId);

    return { success: true };
  },

  async buyEnergy(expeditionId: string, studentProfileId: string) {
    const [expedition] = await db
      .select()
      .from(jiroExpeditions)
      .where(eq(jiroExpeditions.id, expeditionId));

    if (!expedition) throw new Error('Expedición no encontrada');

    const [studentExpedition] = await db
      .select()
      .from(jiroStudentExpeditions)
      .where(
        and(
          eq(jiroStudentExpeditions.expeditionId, expeditionId),
          eq(jiroStudentExpeditions.studentProfileId, studentProfileId)
        )
      );

    if (!studentExpedition) throw new Error('No has iniciado esta expedición');

    // Verificar GP del estudiante
    const [student] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));

    if (!student) throw new Error('Estudiante no encontrado');
    if (student.gp < expedition.energyPurchasePrice) {
      throw new Error('No tienes suficiente GP');
    }

    const now = new Date();

    // Descontar GP
    await db
      .update(studentProfiles)
      .set({
        gp: student.gp - expedition.energyPurchasePrice,
        updatedAt: now,
      })
      .where(eq(studentProfiles.id, studentProfileId));

    // Agregar energía
    const currentEnergy = this.calculateCurrentEnergy(studentExpedition, expedition);
    await db
      .update(jiroStudentExpeditions)
      .set({
        currentEnergy: currentEnergy + 1,
        updatedAt: now,
      })
      .where(eq(jiroStudentExpeditions.id, studentExpedition.id));

    return {
      newEnergy: currentEnergy + 1,
      gpSpent: expedition.energyPurchasePrice,
      remainingGp: student.gp - expedition.energyPurchasePrice,
    };
  },

  // ==================== HELPERS ====================

  calculateCurrentEnergy(studentExpedition: JiroStudentExpedition, expedition: JiroExpedition): number {
    // En modo EXAM no hay regeneración
    if (expedition.mode === 'EXAM') {
      return studentExpedition.currentEnergy;
    }

    // Modo ASYNC: calcular regeneración
    if (!studentExpedition.lastEnergyRegenAt) {
      return studentExpedition.currentEnergy;
    }

    const lastRegen = new Date(studentExpedition.lastEnergyRegenAt);
    const now = new Date();
    const minutesPassed = (now.getTime() - lastRegen.getTime()) / 60000;
    const regenCycles = Math.floor(minutesPassed / expedition.energyRegenMinutes);

    if (regenCycles > 0) {
      const newEnergy = Math.min(
        expedition.initialEnergy,
        studentExpedition.currentEnergy + regenCycles
      );

      // Actualizar en BD si regeneró
      db.update(jiroStudentExpeditions)
        .set({
          currentEnergy: newEnergy,
          lastEnergyRegenAt: now,
        })
        .where(eq(jiroStudentExpeditions.id, studentExpedition.id))
        .then(() => {});

      return newEnergy;
    }

    return studentExpedition.currentEnergy;
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
    const [studentExpedition] = await db
      .select()
      .from(jiroStudentExpeditions)
      .where(eq(jiroStudentExpeditions.id, studentExpeditionId));

    if (!studentExpedition || studentExpedition.status === 'COMPLETED') return;

    const [expedition] = await db
      .select()
      .from(jiroExpeditions)
      .where(eq(jiroExpeditions.id, studentExpedition.expeditionId));

    // Contar estaciones totales
    const [questionCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .where(eq(questions.bankId, expedition.questionBankId));

    const [deliveryCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jiroDeliveryStations)
      .where(eq(jiroDeliveryStations.expeditionId, expedition.id));

    const totalStations = Number(questionCount?.count || 0) + Number(deliveryCount?.count || 0);
    
    // Contar respuestas reales en la BD, no usar completedStations que puede estar corrupto
    const [answerCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jiroQuestionAnswers)
      .where(eq(jiroQuestionAnswers.studentExpeditionId, studentExpeditionId));
    
    const completedCount = Number(answerCount?.count || 0);

    // Si no completó todas las estaciones, no hacer nada
    if (completedCount < totalStations) return;

    // Si hay entregas, verificar si todas están revisadas
    if (expedition.requiresReview) {
      const pendingDeliveries = await db
        .select()
        .from(jiroDeliveries)
        .where(
          and(
            eq(jiroDeliveries.studentExpeditionId, studentExpeditionId),
            eq(jiroDeliveries.status, 'PENDING')
          )
        );

      if (pendingDeliveries.length > 0) {
        // Marcar como pendiente de revisión
        await db
          .update(jiroStudentExpeditions)
          .set({ status: 'PENDING_REVIEW', updatedAt: new Date() })
          .where(eq(jiroStudentExpeditions.id, studentExpeditionId));
        return;
      }
    }

    // Calcular recompensas
    const earnedXp = studentExpedition.correctAnswers * expedition.rewardXpPerCorrect;
    const earnedGp = studentExpedition.correctAnswers * expedition.rewardGpPerCorrect;
    const finalScore = totalStations > 0
      ? (studentExpedition.correctAnswers / Number(questionCount?.count || 1)) * 100
      : 0;

    const now = new Date();

    // Actualizar progreso del estudiante
    await db
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

    // Dar recompensas al estudiante
    const [student] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentExpedition.studentProfileId));

    if (student) {
      await db
        .update(studentProfiles)
        .set({
          xp: student.xp + earnedXp,
          gp: student.gp + earnedGp,
          updatedAt: now,
        })
        .where(eq(studentProfiles.id, student.id));

      // Registrar en pointLogs para historial
      if (earnedXp > 0) {
        await db.insert(pointLogs).values({
          id: uuidv4(),
          studentId: student.id,
          pointType: 'XP',
          action: 'ADD',
          amount: earnedXp,
          reason: `Expedición completada: ${expedition.name}`,
          createdAt: now,
        });
      }
      if (earnedGp > 0) {
        await db.insert(pointLogs).values({
          id: uuidv4(),
          studentId: student.id,
          pointType: 'GP',
          action: 'ADD',
          amount: earnedGp,
          reason: `Expedición completada: ${expedition.name}`,
          createdAt: now,
        });
      }
    }
  },

  async forceCompleteByTimeout(expeditionId: string, studentProfileId: string): Promise<{ success: boolean; message: string }> {
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
      return { success: false, message: 'Expedición no encontrada' };
    }

    if (studentExpedition.status === 'COMPLETED') {
      return { success: true, message: 'Ya completada' };
    }

    const [expedition] = await db
      .select()
      .from(jiroExpeditions)
      .where(eq(jiroExpeditions.id, expeditionId));

    if (!expedition || expedition.mode !== 'EXAM') {
      return { success: false, message: 'Solo aplica para modo examen' };
    }

    const now = new Date();

    // Calcular puntuación final basada en respuestas correctas
    const correctAnswers = studentExpedition.correctAnswers || 0;
    
    // Obtener total de estaciones (preguntas del banco + entregas)
    let questionCountNum = 0;
    if (expedition.questionBankId) {
      const [questionCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(questions)
        .where(eq(questions.bankId, expedition.questionBankId));
      questionCountNum = Number(questionCount?.count || 0);
    }
    
    const [deliveryCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jiroDeliveryStations)
      .where(eq(jiroDeliveryStations.expeditionId, expeditionId));
    
    const totalStations = questionCountNum + Number(deliveryCount?.count || 0);
    
    // Calcular puntuación: (correctas / total) * 100
    const finalScore = totalStations > 0 ? (correctAnswers / totalStations) * 100 : 0;
    
    // Calcular recompensas ganadas hasta el momento
    const earnedXp = correctAnswers * expedition.rewardXpPerCorrect;
    const earnedGp = correctAnswers * expedition.rewardGpPerCorrect;

    // Marcar como completado por timeout
    await db
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

    // Dar recompensas al estudiante
    const [student] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));

    if (student) {
      await db
        .update(studentProfiles)
        .set({
          xp: student.xp + earnedXp,
          gp: student.gp + earnedGp,
          updatedAt: now,
        })
        .where(eq(studentProfiles.id, student.id));

      // Registrar en pointLogs para historial
      if (earnedXp > 0) {
        await db.insert(pointLogs).values({
          id: uuidv4(),
          studentId: student.id,
          pointType: 'XP',
          action: 'ADD',
          amount: earnedXp,
          reason: `Expedición completada: ${expedition.name}`,
          createdAt: now,
        });
      }
      if (earnedGp > 0) {
        await db.insert(pointLogs).values({
          id: uuidv4(),
          studentId: student.id,
          pointType: 'GP',
          action: 'ADD',
          amount: earnedGp,
          reason: `Expedición completada: ${expedition.name}`,
          createdAt: now,
        });
      }
    }

    return { 
      success: true, 
      message: 'Examen finalizado por tiempo',
      finalScore: finalScore.toFixed(2),
      earnedXp,
      earnedGp,
    } as any;
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
