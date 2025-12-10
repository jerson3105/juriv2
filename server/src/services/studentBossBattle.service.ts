import { db } from '../db/index.js';
import {
  studentBossBattles,
  studentBossBattleParticipants,
  studentBossBattleAttempts,
  questionBanks,
  questions,
  studentProfiles,
  type StudentBossBattle,
  type StudentBossBattleParticipant,
  type StudentBossBattleAttempt,
  type Question,
} from '../db/schema.js';
import { eq, and, desc, sql, inArray, lte, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { clanService } from './clan.service.js';
import { missionService } from './mission.service.js';

// DTOs
interface CreateBattleDto {
  bossName: string;
  bossImageUrl?: string;
  bossMaxHp: number;
  questionBankId: string;
  questionsPerAttempt?: number;
  damagePerCorrect?: number;
  damageToStudentOnWrong?: number;
  maxAttempts?: number;
  xpPerCorrectAnswer?: number;
  gpPerCorrectAnswer?: number;
  bonusXpOnVictory?: number;
  bonusGpOnVictory?: number;
  startDate?: Date | null;
  endDate?: Date | null;
  startImmediately?: boolean;
}

interface UpdateBattleDto extends Partial<CreateBattleDto> {
  status?: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'VICTORY' | 'DEFEAT';
}

interface AnswerQuestionDto {
  battleId: string;
  studentProfileId: string;
  questionId: string;
  answer: any; // La respuesta del estudiante
}

interface QuestionAnswered {
  questionId: string;
  isCorrect: boolean;
  answeredAt: string;
}

class StudentBossBattleService {
  // ==================== CRUD para profesor ====================

  async create(classroomId: string, data: CreateBattleDto): Promise<StudentBossBattle> {
    const id = uuidv4();
    const now = new Date();

    // Determinar estado inicial
    let status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' = 'DRAFT';
    if (data.startImmediately) {
      status = 'ACTIVE';
    } else if (data.startDate) {
      const startDate = new Date(data.startDate);
      if (startDate <= now) {
        status = 'ACTIVE';
      } else {
        status = 'SCHEDULED';
      }
    }

    await db.insert(studentBossBattles).values({
      id,
      classroomId,
      bossName: data.bossName,
      bossImageUrl: data.bossImageUrl || null,
      bossMaxHp: data.bossMaxHp,
      bossCurrentHp: data.bossMaxHp, // Inicia con HP completo
      questionBankId: data.questionBankId,
      questionsPerAttempt: data.questionsPerAttempt || 5,
      damagePerCorrect: data.damagePerCorrect || 10,
      damageToStudentOnWrong: data.damageToStudentOnWrong || 5,
      maxAttempts: data.maxAttempts || 1,
      xpPerCorrectAnswer: data.xpPerCorrectAnswer || 10,
      gpPerCorrectAnswer: data.gpPerCorrectAnswer || 5,
      bonusXpOnVictory: data.bonusXpOnVictory || 50,
      bonusGpOnVictory: data.bonusGpOnVictory || 25,
      status,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      createdAt: now,
      updatedAt: now,
    });

    return this.getById(id) as Promise<StudentBossBattle>;
  }

  async getByClassroom(classroomId: string): Promise<StudentBossBattle[]> {
    try {
      const battles = await db
        .select()
        .from(studentBossBattles)
        .where(eq(studentBossBattles.classroomId, classroomId))
        .orderBy(desc(studentBossBattles.createdAt));

      if (battles.length === 0) {
        return [];
      }

      // Enriquecer con datos adicionales
      const enrichedBattles = await Promise.all(
        battles.map(async (battle) => {
          try {
            const participants = await db
              .select()
              .from(studentBossBattleParticipants)
              .where(eq(studentBossBattleParticipants.battleId, battle.id));

            let questionBankInfo = null;
            if (battle.questionBankId) {
              const [questionBank] = await db
                .select({ id: questionBanks.id, name: questionBanks.name })
                .from(questionBanks)
                .where(eq(questionBanks.id, battle.questionBankId))
                .limit(1);
              questionBankInfo = questionBank || null;
            }

            return {
              ...battle,
              participantCount: participants.length,
              activeBattlers: participants.filter((p: any) => p.isCurrentlyBattling).length,
              questionBank: questionBankInfo,
            };
          } catch (err) {
            console.error('[StudentBossBattle] Error enriching battle:', battle.id, err);
            return {
              ...battle,
              participantCount: 0,
              activeBattlers: 0,
              questionBank: null,
            };
          }
        })
      );

      return enrichedBattles as any;
    } catch (error) {
      console.error('[StudentBossBattle] Error in getByClassroom:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<StudentBossBattle | null> {
    const [battle] = await db
      .select()
      .from(studentBossBattles)
      .where(eq(studentBossBattles.id, id));

    if (!battle) return null;

    // Obtener participantes con info de estudiante
    const participants = await db
      .select({
        participant: studentBossBattleParticipants,
        student: {
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
          displayName: studentProfiles.displayName,
          avatarUrl: studentProfiles.avatarUrl,
          characterClass: studentProfiles.characterClass,
          level: studentProfiles.level,
        },
      })
      .from(studentBossBattleParticipants)
      .leftJoin(studentProfiles, eq(studentBossBattleParticipants.studentProfileId, studentProfiles.id))
      .where(eq(studentBossBattleParticipants.battleId, id))
      .orderBy(desc(studentBossBattleParticipants.totalDamageDealt));

    const [questionBank] = await db
      .select()
      .from(questionBanks)
      .where(eq(questionBanks.id, battle.questionBankId))
      .limit(1);

    return {
      ...battle,
      participants: participants.map(p => ({
        ...p.participant,
        student: p.student,
      })),
      questionBank: questionBank ? { id: questionBank.id, name: questionBank.name } : null,
    } as any;
  }

  async update(id: string, data: UpdateBattleDto): Promise<StudentBossBattle | null> {
    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    if (data.startDate) {
      updateData.startDate = new Date(data.startDate);
    }
    if (data.endDate) {
      updateData.endDate = new Date(data.endDate);
    }

    await db
      .update(studentBossBattles)
      .set(updateData)
      .where(eq(studentBossBattles.id, id));

    return this.getById(id);
  }

  async delete(id: string): Promise<void> {
    // Eliminar intentos
    const participants = await db
      .select({ id: studentBossBattleParticipants.id })
      .from(studentBossBattleParticipants)
      .where(eq(studentBossBattleParticipants.battleId, id));

    if (participants.length > 0) {
      await db
        .delete(studentBossBattleAttempts)
        .where(inArray(studentBossBattleAttempts.participantId, participants.map(p => p.id)));
    }

    // Eliminar participantes
    await db.delete(studentBossBattleParticipants).where(eq(studentBossBattleParticipants.battleId, id));

    // Eliminar batalla
    await db.delete(studentBossBattles).where(eq(studentBossBattles.id, id));
  }

  async activate(id: string): Promise<StudentBossBattle | null> {
    await db
      .update(studentBossBattles)
      .set({ status: 'ACTIVE', updatedAt: new Date() })
      .where(eq(studentBossBattles.id, id));

    return this.getById(id);
  }

  // ==================== Lógica para estudiantes ====================

  // Obtener batallas disponibles para un estudiante
  async getAvailableForStudent(classroomId: string, studentProfileId: string): Promise<any[]> {
    const now = new Date();

    // Batallas activas o programadas que ya iniciaron
    const battles = await db
      .select()
      .from(studentBossBattles)
      .where(
        and(
          eq(studentBossBattles.classroomId, classroomId),
          or(
            eq(studentBossBattles.status, 'ACTIVE'),
            eq(studentBossBattles.status, 'VICTORY') // Pueden ver las completadas
          )
        )
      )
      .orderBy(desc(studentBossBattles.createdAt));

    // Filtrar por fechas y agregar info del estudiante
    const availableBattles = await Promise.all(
      battles.map(async (battle) => {
        // Verificar fechas
        if (battle.startDate && new Date(battle.startDate) > now) return null;
        if (battle.endDate && new Date(battle.endDate) < now) return null;

        // Obtener participación del estudiante
        const [participation] = await db
          .select()
          .from(studentBossBattleParticipants)
          .where(
            and(
              eq(studentBossBattleParticipants.battleId, battle.id),
              eq(studentBossBattleParticipants.studentProfileId, studentProfileId)
            )
          );

        // Contar batalladores activos
        const activeBattlers = await db
          .select({ count: sql<number>`count(*)` })
          .from(studentBossBattleParticipants)
          .where(
            and(
              eq(studentBossBattleParticipants.battleId, battle.id),
              eq(studentBossBattleParticipants.isCurrentlyBattling, true)
            )
          );

        const canParticipate = !participation || participation.attemptsUsed < battle.maxAttempts;
        const hasParticipated = !!participation;

        return {
          ...battle,
          participation,
          canParticipate: canParticipate && battle.status === 'ACTIVE',
          hasParticipated,
          attemptsRemaining: participation 
            ? battle.maxAttempts - participation.attemptsUsed 
            : battle.maxAttempts,
          activeBattlers: Number(activeBattlers[0]?.count || 0),
          hpPercentage: Math.round((battle.bossCurrentHp / battle.bossMaxHp) * 100),
        };
      })
    );

    return availableBattles.filter(b => b !== null);
  }

  // Iniciar un intento de batalla
  async startAttempt(battleId: string, studentProfileId: string): Promise<{
    attemptId: string;
    questions: any[];
    bossCurrentHp: number;
    bossMaxHp: number;
  }> {
    const [battle] = await db
      .select()
      .from(studentBossBattles)
      .where(eq(studentBossBattles.id, battleId));

    if (!battle) throw new Error('Batalla no encontrada');
    if (battle.status !== 'ACTIVE') throw new Error('La batalla no está activa');

    // Verificar/crear participante
    let [participant] = await db
      .select()
      .from(studentBossBattleParticipants)
      .where(
        and(
          eq(studentBossBattleParticipants.battleId, battleId),
          eq(studentBossBattleParticipants.studentProfileId, studentProfileId)
        )
      );

    if (!participant) {
      const participantId = uuidv4();
      await db.insert(studentBossBattleParticipants).values({
        id: participantId,
        battleId,
        studentProfileId,
        createdAt: new Date(),
      });
      [participant] = await db
        .select()
        .from(studentBossBattleParticipants)
        .where(eq(studentBossBattleParticipants.id, participantId));
    }

    // Verificar intentos
    if (participant.attemptsUsed >= battle.maxAttempts) {
      throw new Error('Ya usaste todos tus intentos');
    }

    // Verificar HP del estudiante
    const [student] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));

    if (!student || student.hp <= 0) {
      throw new Error('No tienes suficiente HP para batallar');
    }

    // Obtener preguntas aleatorias del banco
    const allQuestions = await db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.bankId, battle.questionBankId),
          eq(questions.isActive, true)
        )
      );

    if (allQuestions.length < battle.questionsPerAttempt) {
      throw new Error('No hay suficientes preguntas en el banco');
    }

    // Mezclar y tomar las necesarias
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, battle.questionsPerAttempt);

    // Crear intento
    const attemptId = uuidv4();
    await db.insert(studentBossBattleAttempts).values({
      id: attemptId,
      participantId: participant.id,
      questionsAnswered: [],
      startedAt: new Date(),
    });

    // Marcar como batallando
    await db
      .update(studentBossBattleParticipants)
      .set({
        isCurrentlyBattling: true,
        lastBattleAt: new Date(),
        attemptsUsed: participant.attemptsUsed + 1,
      })
      .where(eq(studentBossBattleParticipants.id, participant.id));

    // Helper para parsear JSON (maneja doble escape)
    const parseJson = (value: any): any => {
      if (!value) return null;
      if (Array.isArray(value)) return value;
      if (typeof value === 'object') return value;
      if (typeof value === 'string') {
        try {
          let parsed = JSON.parse(value);
          // Si sigue siendo string, parsear de nuevo (doble escape)
          if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
          }
          return parsed;
        } catch {
          // Intentar limpiar escapes y parsear
          try {
            const cleaned = value.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            return JSON.parse(cleaned);
          } catch {
            return null;
          }
        }
      }
      return null;
    };

    // Preparar preguntas (sin revelar respuestas correctas)
    const questionsForStudent = selectedQuestions.map(q => {
      const parsedOptions = parseJson(q.options);
      const parsedPairs = parseJson(q.pairs);
      
      // Para opciones, quitar isCorrect para no revelar la respuesta
      let safeOptions = null;
      if (parsedOptions && Array.isArray(parsedOptions)) {
        safeOptions = parsedOptions.map((opt: any) => ({
          text: typeof opt === 'string' ? opt : opt.text || opt.label || String(opt)
        }));
      }

      // Para matching, solo enviar el lado izquierdo
      let safePairs = null;
      if (parsedPairs && Array.isArray(parsedPairs)) {
        safePairs = parsedPairs.map((p: any) => ({
          left: typeof p === 'string' ? p : p.left || p.term || ''
        }));
      }

      return {
        id: q.id,
        type: q.type,
        questionText: q.questionText,
        imageUrl: q.imageUrl,
        options: safeOptions,
        pairs: safePairs,
        timeLimitSeconds: q.timeLimitSeconds,
        points: q.points,
      };
    });

    return {
      attemptId,
      questions: questionsForStudent,
      bossCurrentHp: battle.bossCurrentHp,
      bossMaxHp: battle.bossMaxHp,
    };
  }

  // Responder una pregunta
  async answerQuestion(data: AnswerQuestionDto): Promise<{
    isCorrect: boolean;
    correctAnswer: any;
    explanation: string | null;
    damageDealt: number;
    damageReceived: number;
    bossCurrentHp: number;
    xpEarned: number;
    gpEarned: number;
    battleEnded: boolean;
    victory: boolean;
  }> {
    const [battle] = await db
      .select()
      .from(studentBossBattles)
      .where(eq(studentBossBattles.id, data.battleId));

    if (!battle) throw new Error('Batalla no encontrada');
    if (battle.status !== 'ACTIVE') throw new Error('La batalla ya terminó');

    // Obtener la pregunta
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, data.questionId));

    if (!question) throw new Error('Pregunta no encontrada');

    // Verificar respuesta
    const isCorrect = this.checkAnswer(question, data.answer);

    // Calcular daño y recompensas
    let damageDealt = 0;
    let damageReceived = 0;
    let xpEarned = 0;
    let gpEarned = 0;

    if (isCorrect) {
      damageDealt = battle.damagePerCorrect;
      xpEarned = battle.xpPerCorrectAnswer;
      gpEarned = battle.gpPerCorrectAnswer;
    } else {
      damageReceived = battle.damageToStudentOnWrong;
    }

    // Actualizar HP del boss
    const newBossHp = Math.max(0, battle.bossCurrentHp - damageDealt);
    await db
      .update(studentBossBattles)
      .set({ bossCurrentHp: newBossHp, updatedAt: new Date() })
      .where(eq(studentBossBattles.id, data.battleId));

    // Actualizar participante
    const [participant] = await db
      .select()
      .from(studentBossBattleParticipants)
      .where(
        and(
          eq(studentBossBattleParticipants.battleId, data.battleId),
          eq(studentBossBattleParticipants.studentProfileId, data.studentProfileId)
        )
      );

    if (participant) {
      await db
        .update(studentBossBattleParticipants)
        .set({
          totalDamageDealt: participant.totalDamageDealt + damageDealt,
          totalCorrectAnswers: participant.totalCorrectAnswers + (isCorrect ? 1 : 0),
          totalWrongAnswers: participant.totalWrongAnswers + (isCorrect ? 0 : 1),
          xpEarned: participant.xpEarned + xpEarned,
          gpEarned: participant.gpEarned + gpEarned,
        })
        .where(eq(studentBossBattleParticipants.id, participant.id));

      // Actualizar intento actual
      const [currentAttempt] = await db
        .select()
        .from(studentBossBattleAttempts)
        .where(
          and(
            eq(studentBossBattleAttempts.participantId, participant.id),
            sql`${studentBossBattleAttempts.completedAt} IS NULL`
          )
        )
        .orderBy(desc(studentBossBattleAttempts.startedAt))
        .limit(1);

      if (currentAttempt) {
        // Parsear questionsAnswered si viene como string
        let answeredQuestions: QuestionAnswered[] = [];
        if (currentAttempt.questionsAnswered) {
          if (Array.isArray(currentAttempt.questionsAnswered)) {
            answeredQuestions = currentAttempt.questionsAnswered;
          } else if (typeof currentAttempt.questionsAnswered === 'string') {
            try {
              answeredQuestions = JSON.parse(currentAttempt.questionsAnswered);
            } catch {
              answeredQuestions = [];
            }
          }
        }
        
        answeredQuestions.push({
          questionId: data.questionId,
          isCorrect,
          answeredAt: new Date().toISOString(),
        });

        await db
          .update(studentBossBattleAttempts)
          .set({
            questionsAnswered: answeredQuestions,
            damageDealt: (currentAttempt.damageDealt || 0) + damageDealt,
            correctAnswers: (currentAttempt.correctAnswers || 0) + (isCorrect ? 1 : 0),
            wrongAnswers: (currentAttempt.wrongAnswers || 0) + (isCorrect ? 0 : 1),
            hpLost: (currentAttempt.hpLost || 0) + damageReceived,
          })
          .where(eq(studentBossBattleAttempts.id, currentAttempt.id));
      }
    }

    // Aplicar puntos al estudiante
    if (xpEarned > 0 || gpEarned > 0 || damageReceived > 0) {
      const [student] = await db
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, data.studentProfileId));

      if (student) {
        await db
          .update(studentProfiles)
          .set({
            xp: student.xp + xpEarned,
            gp: student.gp + gpEarned,
            hp: Math.max(0, student.hp - damageReceived),
          })
          .where(eq(studentProfiles.id, data.studentProfileId));

        // Contribuir XP al clan
        if (xpEarned > 0) {
          try {
            await clanService.contributeXpToClan(data.studentProfileId, xpEarned, `Boss Battle: ${battle.bossName}`);
          } catch (e) {
            // Ignorar si no está en un clan
          }
        }
      }
    }

    // Verificar si el boss murió
    let battleEnded = false;
    let victory = false;

    if (newBossHp <= 0) {
      battleEnded = true;
      victory = true;
      await this.endBattle(data.battleId, 'VICTORY');
    }

    return {
      isCorrect,
      correctAnswer: this.getCorrectAnswer(question),
      explanation: question.explanation,
      damageDealt,
      damageReceived,
      bossCurrentHp: newBossHp,
      xpEarned,
      gpEarned,
      battleEnded,
      victory,
    };
  }

  // Finalizar intento del estudiante
  async finishAttempt(battleId: string, studentProfileId: string): Promise<{
    summary: any;
    bonusAwarded: boolean;
  }> {
    const [participant] = await db
      .select()
      .from(studentBossBattleParticipants)
      .where(
        and(
          eq(studentBossBattleParticipants.battleId, battleId),
          eq(studentBossBattleParticipants.studentProfileId, studentProfileId)
        )
      );

    if (!participant) throw new Error('No eres participante de esta batalla');

    // Marcar como no batallando
    await db
      .update(studentBossBattleParticipants)
      .set({ isCurrentlyBattling: false })
      .where(eq(studentBossBattleParticipants.id, participant.id));

    // Completar intento actual
    const [currentAttempt] = await db
      .select()
      .from(studentBossBattleAttempts)
      .where(
        and(
          eq(studentBossBattleAttempts.participantId, participant.id),
          sql`${studentBossBattleAttempts.completedAt} IS NULL`
        )
      )
      .orderBy(desc(studentBossBattleAttempts.startedAt))
      .limit(1);

    if (currentAttempt) {
      await db
        .update(studentBossBattleAttempts)
        .set({ completedAt: new Date() })
        .where(eq(studentBossBattleAttempts.id, currentAttempt.id));
    }

    // Tracking de misiones - batalla completada
    try {
      await missionService.updateMissionProgress(studentProfileId, 'COMPLETE_BATTLE', 1);
      // También trackear XP y GP ganados
      if (participant.xpEarned > 0) {
        await missionService.updateMissionProgress(studentProfileId, 'EARN_XP', participant.xpEarned);
      }
      if (participant.gpEarned > 0) {
        await missionService.updateMissionProgress(studentProfileId, 'EARN_GP', participant.gpEarned);
      }
    } catch (error) {
      console.error('Error updating mission progress:', error);
    }

    return {
      summary: {
        totalDamageDealt: participant.totalDamageDealt,
        totalCorrectAnswers: participant.totalCorrectAnswers,
        totalWrongAnswers: participant.totalWrongAnswers,
        xpEarned: participant.xpEarned,
        gpEarned: participant.gpEarned,
        attemptsUsed: participant.attemptsUsed,
      },
      bonusAwarded: false,
    };
  }

  // Obtener estado actual de la batalla (para polling)
  async getBattleStatus(battleId: string): Promise<{
    bossCurrentHp: number;
    bossMaxHp: number;
    status: string;
    activeBattlers: any[];
  }> {
    const [battle] = await db
      .select()
      .from(studentBossBattles)
      .where(eq(studentBossBattles.id, battleId));

    if (!battle) throw new Error('Batalla no encontrada');

    // Obtener batalladores activos
    const activeBattlers = await db
      .select({
        id: studentBossBattleParticipants.id,
        totalDamageDealt: studentBossBattleParticipants.totalDamageDealt,
        student: {
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
          avatarUrl: studentProfiles.avatarUrl,
          characterClass: studentProfiles.characterClass,
        },
      })
      .from(studentBossBattleParticipants)
      .leftJoin(studentProfiles, eq(studentBossBattleParticipants.studentProfileId, studentProfiles.id))
      .where(
        and(
          eq(studentBossBattleParticipants.battleId, battleId),
          eq(studentBossBattleParticipants.isCurrentlyBattling, true)
        )
      );

    return {
      bossCurrentHp: battle.bossCurrentHp,
      bossMaxHp: battle.bossMaxHp,
      status: battle.status,
      activeBattlers: activeBattlers.map(b => ({
        ...b.student,
        totalDamageDealt: b.totalDamageDealt,
      })),
    };
  }

  // ==================== Helpers ====================

  private checkAnswer(question: any, answer: any): boolean {
    // Helper para parsear JSON
    const parseJson = (value: any): any => {
      if (!value) return null;
      if (Array.isArray(value)) return value;
      if (typeof value === 'object') return value;
      if (typeof value === 'string') {
        try {
          let parsed = JSON.parse(value);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          return parsed;
        } catch {
          try {
            const cleaned = value.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            return JSON.parse(cleaned);
          } catch {
            return null;
          }
        }
      }
      return null;
    };

    switch (question.type) {
      case 'TRUE_FALSE':
        const correctAnswer = parseJson(question.correctAnswer);
        return answer === correctAnswer;

      case 'SINGLE_CHOICE':
        const options = parseJson(question.options) as { text: string; isCorrect: boolean }[];
        if (!options || !Array.isArray(options)) return false;
        const correctOption = options.find(o => o.isCorrect);
        return answer === correctOption?.text;

      case 'MULTIPLE_CHOICE':
        const mcOptions = parseJson(question.options) as { text: string; isCorrect: boolean }[];
        if (!mcOptions || !Array.isArray(mcOptions)) return false;
        const correctAnswers = mcOptions.filter(o => o.isCorrect).map(o => o.text) || [];
        const studentAnswers = Array.isArray(answer) ? answer : [answer];
        return (
          correctAnswers.length === studentAnswers.length &&
          correctAnswers.every(a => studentAnswers.includes(a))
        );

      case 'MATCHING':
        const pairs = parseJson(question.pairs) as { left: string; right: string }[];
        if (!pairs || !Array.isArray(pairs) || !Array.isArray(answer)) return false;
        return pairs.every(pair => {
          const studentPair = answer.find((a: any) => a.left === pair.left);
          return studentPair && studentPair.right === pair.right;
        });

      default:
        return false;
    }
  }

  private getCorrectAnswer(question: any): any {
    // Helper para parsear JSON
    const parseJson = (value: any): any => {
      if (!value) return null;
      if (Array.isArray(value)) return value;
      if (typeof value === 'object') return value;
      if (typeof value === 'string') {
        try {
          let parsed = JSON.parse(value);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          return parsed;
        } catch {
          try {
            const cleaned = value.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            return JSON.parse(cleaned);
          } catch {
            return null;
          }
        }
      }
      return null;
    };

    switch (question.type) {
      case 'TRUE_FALSE':
        return parseJson(question.correctAnswer);

      case 'SINGLE_CHOICE':
        const options = parseJson(question.options) as { text: string; isCorrect: boolean }[];
        return options?.find(o => o.isCorrect)?.text;

      case 'MULTIPLE_CHOICE':
        const mcOptions = parseJson(question.options) as { text: string; isCorrect: boolean }[];
        return mcOptions?.filter(o => o.isCorrect).map(o => o.text);

      case 'MATCHING':
        return parseJson(question.pairs);

      default:
        return null;
    }
  }

  private async endBattle(battleId: string, status: 'VICTORY' | 'DEFEAT'): Promise<void> {
    const [battle] = await db
      .select()
      .from(studentBossBattles)
      .where(eq(studentBossBattles.id, battleId));

    if (!battle) return;

    await db
      .update(studentBossBattles)
      .set({
        status,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(studentBossBattles.id, battleId));

    // Si es victoria, dar bonus a todos los participantes
    if (status === 'VICTORY') {
      const participants = await db
        .select()
        .from(studentBossBattleParticipants)
        .where(eq(studentBossBattleParticipants.battleId, battleId));

      for (const participant of participants) {
        // Actualizar estudiante con bonus
        const [student] = await db
          .select()
          .from(studentProfiles)
          .where(eq(studentProfiles.id, participant.studentProfileId));

        if (student) {
          await db
            .update(studentProfiles)
            .set({
              xp: student.xp + battle.bonusXpOnVictory,
              gp: student.gp + battle.bonusGpOnVictory,
              bossKills: student.bossKills + 1,
            })
            .where(eq(studentProfiles.id, participant.studentProfileId));

          // Contribuir bonus XP al clan
          try {
            await clanService.contributeXpToClan(
              participant.studentProfileId,
              battle.bonusXpOnVictory,
              `Victoria Boss Battle: ${battle.bossName}`
            );
          } catch (e) {
            // Ignorar si no está en un clan
          }
        }

        // Marcar como no batallando
        await db
          .update(studentBossBattleParticipants)
          .set({ isCurrentlyBattling: false })
          .where(eq(studentBossBattleParticipants.id, participant.id));
      }
    }
  }

  // Verificar y actualizar batallas programadas
  async checkScheduledBattles(): Promise<void> {
    const now = new Date();

    // Activar batallas programadas que ya deben iniciar
    await db
      .update(studentBossBattles)
      .set({ status: 'ACTIVE', updatedAt: now })
      .where(
        and(
          eq(studentBossBattles.status, 'SCHEDULED'),
          lte(studentBossBattles.startDate, now)
        )
      );

    // Finalizar batallas que ya pasaron su fecha límite
    const expiredBattles = await db
      .select()
      .from(studentBossBattles)
      .where(
        and(
          eq(studentBossBattles.status, 'ACTIVE'),
          lte(studentBossBattles.endDate, now)
        )
      );

    for (const battle of expiredBattles) {
      const status = battle.bossCurrentHp <= 0 ? 'VICTORY' : 'DEFEAT';
      await this.endBattle(battle.id, status);
    }
  }
}

export const studentBossBattleService = new StudentBossBattleService();
