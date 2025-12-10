import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  bossBattles,
  battleQuestions,
  battleParticipants,
  battleAnswers,
  battleResults,
  studentProfiles,
  notifications,
  type BattleStatus,
  type QuestionType,
} from '../db/schema.js';
import { clanService } from './clan.service.js';

class BattleService {
  // ==================== BOSS CRUD ====================

  async createBoss(data: {
    classroomId: string;
    name: string;
    description?: string;
    bossName: string;
    bossHp: number;
    bossImageUrl?: string;
    xpReward?: number;
    gpReward?: number;
  }) {
    const id = uuidv4();
    const now = new Date();

    await db.insert(bossBattles).values({
      id,
      classroomId: data.classroomId,
      name: data.name,
      description: data.description || null,
      bossName: data.bossName,
      bossHp: data.bossHp,
      currentHp: data.bossHp,
      bossImageUrl: data.bossImageUrl || null,
      xpReward: data.xpReward || 50,
      gpReward: data.gpReward || 20,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    });

    return this.getBossById(id);
  }

  async getBossById(id: string) {
    const [boss] = await db
      .select()
      .from(bossBattles)
      .where(eq(bossBattles.id, id));
    return boss;
  }

  async getBossesByClassroom(classroomId: string) {
    return db
      .select()
      .from(bossBattles)
      .where(eq(bossBattles.classroomId, classroomId))
      .orderBy(desc(bossBattles.createdAt));
  }

  // Obtener batallas activas donde el estudiante es participante
  async getActiveBattlesForStudent(studentId: string) {
    const participations = await db
      .select({
        battleId: battleParticipants.battleId,
      })
      .from(battleParticipants)
      .where(eq(battleParticipants.studentId, studentId));

    if (participations.length === 0) return [];

    const battleIds = participations.map(p => p.battleId);
    
    const battles = await db
      .select()
      .from(bossBattles)
      .where(and(
        eq(bossBattles.status, 'ACTIVE'),
      ));

    // Filtrar solo las batallas donde el estudiante participa
    return battles.filter(b => battleIds.includes(b.id));
  }

  async updateBoss(id: string, data: {
    name?: string;
    description?: string;
    bossName?: string;
    bossHp?: number;
    bossImageUrl?: string;
    xpReward?: number;
    gpReward?: number;
  }) {
    const updateData: any = { updatedAt: new Date() };
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.bossName !== undefined) updateData.bossName = data.bossName;
    if (data.bossHp !== undefined) {
      updateData.bossHp = data.bossHp;
      updateData.currentHp = data.bossHp;
    }
    if (data.bossImageUrl !== undefined) updateData.bossImageUrl = data.bossImageUrl;
    if (data.xpReward !== undefined) updateData.xpReward = data.xpReward;
    if (data.gpReward !== undefined) updateData.gpReward = data.gpReward;

    await db.update(bossBattles).set(updateData).where(eq(bossBattles.id, id));
    return this.getBossById(id);
  }

  async deleteBoss(id: string) {
    // Eliminar respuestas, participantes, preguntas y resultados primero
    await db.delete(battleAnswers).where(eq(battleAnswers.battleId, id));
    await db.delete(battleParticipants).where(eq(battleParticipants.battleId, id));
    await db.delete(battleResults).where(eq(battleResults.battleId, id));
    await db.delete(battleQuestions).where(eq(battleQuestions.battleId, id));
    await db.delete(bossBattles).where(eq(bossBattles.id, id));
  }

  // ==================== PREGUNTAS ====================

  async addQuestion(data: {
    battleId: string;
    questionType?: QuestionType;
    battleQuestionType?: 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'MATCHING';
    question: string;
    imageUrl?: string;
    options?: string[];
    correctIndex?: number;
    correctIndices?: number[];
    pairs?: { left: string; right: string }[];
    damage?: number;
    hpPenalty?: number;
    timeLimit?: number;
  }) {
    const id = uuidv4();
    
    // Obtener el orden máximo actual
    const questions = await db
      .select({ orderIndex: battleQuestions.orderIndex })
      .from(battleQuestions)
      .where(eq(battleQuestions.battleId, data.battleId))
      .orderBy(desc(battleQuestions.orderIndex))
      .limit(1);
    
    const nextOrder = questions.length > 0 ? questions[0].orderIndex + 1 : 0;

    await db.insert(battleQuestions).values({
      id,
      battleId: data.battleId,
      questionType: data.questionType || 'TEXT',
      battleQuestionType: data.battleQuestionType || 'SINGLE_CHOICE',
      question: data.question,
      imageUrl: data.imageUrl || null,
      options: data.options || null,
      correctIndex: data.correctIndex ?? 0,
      correctIndices: data.correctIndices || null,
      pairs: data.pairs || null,
      damage: data.damage || 10,
      hpPenalty: data.hpPenalty || 10,
      timeLimit: data.timeLimit || 30,
      orderIndex: nextOrder,
      createdAt: new Date(),
    });

    return this.getQuestionById(id);
  }

  async getQuestionById(id: string) {
    const [question] = await db
      .select()
      .from(battleQuestions)
      .where(eq(battleQuestions.id, id));
    return question;
  }

  async getQuestionsByBattle(battleId: string) {
    return db
      .select()
      .from(battleQuestions)
      .where(eq(battleQuestions.battleId, battleId))
      .orderBy(asc(battleQuestions.orderIndex));
  }

  async updateQuestion(id: string, data: {
    questionType?: QuestionType;
    battleQuestionType?: 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'MATCHING';
    question?: string;
    imageUrl?: string;
    options?: string[];
    correctIndex?: number;
    correctIndices?: number[];
    pairs?: { left: string; right: string }[];
    damage?: number;
    hpPenalty?: number;
    timeLimit?: number;
  }) {
    const updateData: any = {};
    
    if (data.questionType !== undefined) updateData.questionType = data.questionType;
    if (data.battleQuestionType !== undefined) updateData.battleQuestionType = data.battleQuestionType;
    if (data.question !== undefined) updateData.question = data.question;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.options !== undefined) updateData.options = data.options;
    if (data.correctIndex !== undefined) updateData.correctIndex = data.correctIndex;
    if (data.correctIndices !== undefined) updateData.correctIndices = data.correctIndices;
    if (data.pairs !== undefined) updateData.pairs = data.pairs;
    if (data.damage !== undefined) updateData.damage = data.damage;
    if (data.hpPenalty !== undefined) updateData.hpPenalty = data.hpPenalty;
    if (data.timeLimit !== undefined) updateData.timeLimit = data.timeLimit;

    await db.update(battleQuestions).set(updateData).where(eq(battleQuestions.id, id));
    return this.getQuestionById(id);
  }

  async deleteQuestion(id: string) {
    await db.delete(battleAnswers).where(eq(battleAnswers.questionId, id));
    await db.delete(battleQuestions).where(eq(battleQuestions.id, id));
  }

  async reorderQuestions(battleId: string, questionIds: string[]) {
    for (let i = 0; i < questionIds.length; i++) {
      await db
        .update(battleQuestions)
        .set({ orderIndex: i })
        .where(eq(battleQuestions.id, questionIds[i]));
    }
  }

  // ==================== BATALLA EN VIVO ====================

  async startBattle(battleId: string, studentIds: string[]) {
    const boss = await this.getBossById(battleId);
    if (!boss) throw new Error('Boss no encontrado');
    if (boss.status !== 'DRAFT') throw new Error('La batalla ya fue iniciada');

    const now = new Date();

    // Actualizar estado del boss
    await db.update(bossBattles).set({
      status: 'ACTIVE',
      currentHp: boss.bossHp,
      startedAt: now,
      updatedAt: now,
    }).where(eq(bossBattles.id, battleId));

    // Agregar participantes
    for (const studentId of studentIds) {
      await db.insert(battleParticipants).values({
        id: uuidv4(),
        battleId,
        studentId,
        joinedAt: now,
        totalDamage: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
      });

      // Notificar al estudiante
      const [student] = await db
        .select({ userId: studentProfiles.userId })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentId));

      if (student) {
        await db.insert(notifications).values({
          id: uuidv4(),
          userId: student.userId,
          classroomId: boss.classroomId,
          type: 'BATTLE_STARTED',
          title: '⚔️ ¡Batalla iniciada!',
          message: `La batalla contra ${boss.bossName} ha comenzado`,
          data: JSON.stringify({ battleId }),
          isRead: false,
          createdAt: now,
        });
      }
    }

    return this.getBattleState(battleId);
  }

  async getBattleState(battleId: string) {
    const boss = await this.getBossById(battleId);
    if (!boss) return null;

    const questions = await this.getQuestionsByBattle(battleId);
    const participants = await db
      .select({
        id: battleParticipants.id,
        studentId: battleParticipants.studentId,
        totalDamage: battleParticipants.totalDamage,
        correctAnswers: battleParticipants.correctAnswers,
        wrongAnswers: battleParticipants.wrongAnswers,
        characterName: studentProfiles.characterName,
        avatarUrl: studentProfiles.avatarUrl,
      })
      .from(battleParticipants)
      .innerJoin(studentProfiles, eq(battleParticipants.studentId, studentProfiles.id))
      .where(eq(battleParticipants.battleId, battleId));

    return {
      ...boss,
      questions: questions.map(q => ({
        ...q,
        options: q.options as string[],
      })),
      participants,
      hpPercentage: Math.round((boss.currentHp / boss.bossHp) * 100),
    };
  }

  async submitAnswer(data: {
    battleId: string;
    questionId: string;
    studentId: string;
    selectedIndex: number;
    timeSpent: number;
  }) {
    const boss = await this.getBossById(data.battleId);
    if (!boss || boss.status !== 'ACTIVE') {
      return { success: false, message: 'Batalla no activa' };
    }

    // Obtener participante
    const [participant] = await db
      .select()
      .from(battleParticipants)
      .where(and(
        eq(battleParticipants.battleId, data.battleId),
        eq(battleParticipants.studentId, data.studentId)
      ));

    if (!participant) {
      return { success: false, message: 'No eres participante de esta batalla' };
    }

    // Verificar si ya respondió esta pregunta
    const [existingAnswer] = await db
      .select()
      .from(battleAnswers)
      .where(and(
        eq(battleAnswers.questionId, data.questionId),
        eq(battleAnswers.participantId, participant.id)
      ));

    if (existingAnswer) {
      return { success: false, message: 'Ya respondiste esta pregunta' };
    }

    // Obtener pregunta
    const question = await this.getQuestionById(data.questionId);
    if (!question) {
      return { success: false, message: 'Pregunta no encontrada' };
    }

    const isCorrect = data.selectedIndex === question.correctIndex;
    const damage = isCorrect ? question.damage : 0;

    // Registrar respuesta
    await db.insert(battleAnswers).values({
      id: uuidv4(),
      battleId: data.battleId,
      questionId: data.questionId,
      participantId: participant.id,
      selectedIndex: data.selectedIndex,
      isCorrect,
      timeSpent: data.timeSpent,
      answeredAt: new Date(),
    });

    // Actualizar estadísticas del participante
    await db.update(battleParticipants).set({
      totalDamage: participant.totalDamage + damage,
      correctAnswers: participant.correctAnswers + (isCorrect ? 1 : 0),
      wrongAnswers: participant.wrongAnswers + (isCorrect ? 0 : 1),
    }).where(eq(battleParticipants.id, participant.id));

    // Actualizar HP del boss si es correcto
    if (isCorrect) {
      const newHp = Math.max(0, boss.currentHp - damage);
      await db.update(bossBattles).set({
        currentHp: newHp,
        updatedAt: new Date(),
      }).where(eq(bossBattles.id, data.battleId));

      // Verificar si el boss fue derrotado
      if (newHp <= 0) {
        await this.endBattle(data.battleId, 'VICTORY');
      }
    }

    return {
      success: true,
      isCorrect,
      damage,
      correctIndex: question.correctIndex,
    };
  }

  // Aplicar daño manualmente (modo presencial del profesor)
  async applyManualDamage(
    battleId: string, 
    damage: number, 
    studentIds: string[],
    wrongStudentIds?: string[],
    hpDamage?: number
  ) {
    const boss = await this.getBossById(battleId);
    if (!boss || boss.status !== 'ACTIVE') {
      throw new Error('Batalla no activa');
    }

    const newHp = Math.max(0, boss.currentHp - damage);
    const now = new Date();

    // Actualizar HP del boss
    await db.update(bossBattles).set({
      currentHp: newHp,
      updatedAt: now,
    }).where(eq(bossBattles.id, battleId));

    // Actualizar stats de los estudiantes que acertaron
    if (studentIds.length > 0) {
      const damagePerStudent = Math.floor(damage / studentIds.length);
      
      for (const studentId of studentIds) {
        await db.update(battleParticipants).set({
          totalDamage: sql`total_damage + ${damagePerStudent}`,
          correctAnswers: sql`correct_answers + 1`,
        }).where(and(
          eq(battleParticipants.battleId, battleId),
          eq(battleParticipants.studentId, studentId)
        ));
      }
    }

    // Aplicar daño HP a estudiantes que fallaron
    if (wrongStudentIds && wrongStudentIds.length > 0 && hpDamage && hpDamage > 0) {
      for (const studentId of wrongStudentIds) {
        // Actualizar respuestas incorrectas del participante
        await db.update(battleParticipants).set({
          wrongAnswers: sql`wrong_answers + 1`,
        }).where(and(
          eq(battleParticipants.battleId, battleId),
          eq(battleParticipants.studentId, studentId)
        ));

        // Reducir HP del perfil del estudiante
        await db.update(studentProfiles).set({
          hp: sql`GREATEST(0, hp - ${hpDamage})`,
          updatedAt: now,
        }).where(eq(studentProfiles.id, studentId));
      }
    }

    // Si el boss fue derrotado, terminar la batalla
    if (newHp <= 0) {
      await this.endBattle(battleId, 'VICTORY');
    }

    return { newHp, defeated: newHp <= 0 };
  }

  async endBattle(battleId: string, status: 'VICTORY' | 'DEFEAT' | 'COMPLETED') {
    const boss = await this.getBossById(battleId);
    if (!boss) return;

    const now = new Date();

    // Actualizar estado
    await db.update(bossBattles).set({
      status,
      endedAt: now,
      updatedAt: now,
    }).where(eq(bossBattles.id, battleId));

    // Obtener participantes
    const participants = await db
      .select()
      .from(battleParticipants)
      .where(eq(battleParticipants.battleId, battleId));

    // Calcular recompensas
    const totalDamage = participants.reduce((sum, p) => sum + p.totalDamage, 0);
    const isVictory = status === 'VICTORY';

    for (const participant of participants) {
      // Calcular proporción de daño
      const damageRatio = totalDamage > 0 ? participant.totalDamage / totalDamage : 1 / participants.length;
      
      // Recompensas base (más si ganaron)
      const xpEarned = isVictory 
        ? Math.round(boss.xpReward * (0.5 + damageRatio * 0.5))
        : Math.round(boss.xpReward * 0.2);
      const gpEarned = isVictory
        ? Math.round(boss.gpReward * (0.5 + damageRatio * 0.5))
        : 0;

      // Guardar resultado
      await db.insert(battleResults).values({
        id: uuidv4(),
        battleId,
        studentId: participant.studentId,
        score: participant.correctAnswers * 100,
        damageDealt: participant.totalDamage,
        xpEarned,
        gpEarned,
        completedAt: now,
      });

      // Actualizar puntos del estudiante
      const [student] = await db
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, participant.studentId));

      if (student) {
        // Actualizar puntos y victorias
        const updateData: any = {
          xp: student.xp + xpEarned,
          gp: student.gp + gpEarned,
        };
        
        // Incrementar victorias si ganaron
        if (isVictory) {
          updateData.bossKills = (student.bossKills || 0) + 1;
        }
        
        await db.update(studentProfiles).set(updateData)
          .where(eq(studentProfiles.id, participant.studentId));

        // Contribuir XP al clan si el estudiante pertenece a uno
        if (xpEarned > 0) {
          await clanService.contributeXpToClan(
            participant.studentId, 
            xpEarned, 
            `Boss Battle: ${boss.bossName}`
          );
        }

        // Notificar resultado
        await db.insert(notifications).values({
          id: uuidv4(),
          userId: student.userId,
          classroomId: boss.classroomId,
          type: 'BATTLE_STARTED',
          title: isVictory ? '🏆 ¡Victoria!' : '💀 Derrota',
          message: isVictory 
            ? `Derrotaste a ${boss.bossName}. Ganaste ${xpEarned} XP y ${gpEarned} GP`
            : `${boss.bossName} escapó. Ganaste ${xpEarned} XP de consolación`,
          data: JSON.stringify({ battleId, xpEarned, gpEarned }),
          isRead: false,
          createdAt: now,
        });
      }
    }

    return this.getBattleState(battleId);
  }

  async getBattleResults(battleId: string) {
    const results = await db
      .select({
        id: battleResults.id,
        studentId: battleResults.studentId,
        score: battleResults.score,
        damageDealt: battleResults.damageDealt,
        xpEarned: battleResults.xpEarned,
        gpEarned: battleResults.gpEarned,
        characterName: studentProfiles.characterName,
        avatarUrl: studentProfiles.avatarUrl,
      })
      .from(battleResults)
      .innerJoin(studentProfiles, eq(battleResults.studentId, studentProfiles.id))
      .where(eq(battleResults.battleId, battleId))
      .orderBy(desc(battleResults.damageDealt));

    return results;
  }

  // ==================== UTILIDADES ====================

  async duplicateBoss(bossId: string) {
    const boss = await this.getBossById(bossId);
    if (!boss) throw new Error('Boss no encontrado');

    const questions = await this.getQuestionsByBattle(bossId);

    // Crear nuevo boss
    const newBoss = await this.createBoss({
      classroomId: boss.classroomId,
      name: `${boss.name} (copia)`,
      description: boss.description || undefined,
      bossName: boss.bossName,
      bossHp: boss.bossHp,
      bossImageUrl: boss.bossImageUrl || undefined,
      xpReward: boss.xpReward,
      gpReward: boss.gpReward,
    });

    // Copiar preguntas
    for (const q of questions) {
      // Parsear campos JSON que pueden venir como string
      let options = q.options;
      if (typeof options === 'string') {
        try {
          options = JSON.parse(options);
          // Doble parse si es necesario
          while (typeof options === 'string') {
            options = JSON.parse(options);
          }
        } catch { options = []; }
      }

      let correctIndices = q.correctIndices;
      if (typeof correctIndices === 'string') {
        try {
          correctIndices = JSON.parse(correctIndices);
          while (typeof correctIndices === 'string') {
            correctIndices = JSON.parse(correctIndices);
          }
        } catch { correctIndices = null; }
      }

      let pairs = q.pairs;
      if (typeof pairs === 'string') {
        try {
          pairs = JSON.parse(pairs);
          while (typeof pairs === 'string') {
            pairs = JSON.parse(pairs);
          }
        } catch { pairs = null; }
      }

      await this.addQuestion({
        battleId: newBoss!.id,
        questionType: q.questionType as QuestionType,
        battleQuestionType: q.battleQuestionType as any || 'SINGLE_CHOICE',
        question: q.question,
        imageUrl: q.imageUrl || undefined,
        options: options as string[] || [],
        correctIndex: q.correctIndex ?? 0,
        correctIndices: correctIndices as number[] || undefined,
        pairs: pairs as any || undefined,
        damage: q.damage,
        hpPenalty: q.hpPenalty || 0,
        timeLimit: q.timeLimit,
      });
    }

    return newBoss;
  }
}

export const battleService = new BattleService();
