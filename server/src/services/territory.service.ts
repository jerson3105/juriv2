import { db } from '../db/index.js';
import {
  territoryMaps,
  territories,
  territoryGames,
  territoryGameStates,
  territoryGameClanScores,
  territoryChallenges,
  teams,
  studentProfiles,
  questions,
  questionBanks,
  classrooms,
  clanLogs,
} from '../db/schema.js';
import { eq, and, desc, asc, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// ==================== TIPOS ====================

interface CreateMapData {
  classroomId: string;
  name: string;
  description?: string;
  backgroundImage?: string;
  gridCols?: number;
  gridRows?: number;
  baseConquestPoints?: number;
  baseDefensePoints?: number;
  bonusStreakPoints?: number;
}

interface CreateTerritoryData {
  mapId: string;
  name: string;
  description?: string;
  gridX: number;
  gridY: number;
  icon?: string;
  color?: string;
  pointMultiplier?: number;
  isStrategic?: boolean;
}

interface CreateGameData {
  classroomId: string;
  mapId: string;
  name: string;
  questionBankIds: string[];
  participatingClanIds: string[];
  maxRounds?: number;
  timePerQuestion?: number;
}

interface ChallengeResult {
  challengeId: string;
  isCorrect: boolean;
  respondentStudentId?: string;
  timeSpent?: number;
}

// ==================== SERVICIO ====================

export class TerritoryService {
  // ==================== MAPAS ====================

  async createMap(data: CreateMapData) {
    const id = uuidv4();
    const now = new Date();

    await db.insert(territoryMaps).values({
      id,
      classroomId: data.classroomId,
      name: data.name,
      description: data.description || null,
      backgroundImage: data.backgroundImage || null,
      gridCols: data.gridCols || 4,
      gridRows: data.gridRows || 3,
      baseConquestPoints: data.baseConquestPoints || 100,
      baseDefensePoints: data.baseDefensePoints || 50,
      bonusStreakPoints: data.bonusStreakPoints || 25,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return this.getMapById(id);
  }

  async getMapById(mapId: string) {
    const [map] = await db
      .select()
      .from(territoryMaps)
      .where(eq(territoryMaps.id, mapId))
      .limit(1);

    if (!map) return null;

    const mapTerritories = await db
      .select()
      .from(territories)
      .where(eq(territories.mapId, mapId))
      .orderBy(asc(territories.gridY), asc(territories.gridX));

    return { ...map, territories: mapTerritories };
  }

  async getClassroomMaps(classroomId: string) {
    const maps = await db
      .select()
      .from(territoryMaps)
      .where(and(eq(territoryMaps.classroomId, classroomId), eq(territoryMaps.isActive, true)))
      .orderBy(desc(territoryMaps.createdAt));

    // Obtener territorios de cada mapa
    const mapsWithTerritories = await Promise.all(
      maps.map(async (map) => {
        const mapTerritories = await db
          .select()
          .from(territories)
          .where(eq(territories.mapId, map.id))
          .orderBy(asc(territories.gridY), asc(territories.gridX));
        return { ...map, territories: mapTerritories };
      })
    );

    return mapsWithTerritories;
  }

  async updateMap(mapId: string, data: Partial<CreateMapData>) {
    await db
      .update(territoryMaps)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(territoryMaps.id, mapId));

    return this.getMapById(mapId);
  }

  async deleteMap(mapId: string) {
    // Soft delete
    await db
      .update(territoryMaps)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(territoryMaps.id, mapId));
  }

  // ==================== TERRITORIOS ====================

  async createTerritory(data: CreateTerritoryData) {
    const id = uuidv4();
    const now = new Date();

    await db.insert(territories).values({
      id,
      mapId: data.mapId,
      name: data.name,
      description: data.description || null,
      gridX: data.gridX,
      gridY: data.gridY,
      icon: data.icon || '🏰',
      color: data.color || '#6366f1',
      pointMultiplier: data.pointMultiplier || 100,
      isStrategic: data.isStrategic || false,
      adjacentTerritories: [],
      createdAt: now,
      updatedAt: now,
    });

    return this.getTerritoryById(id);
  }

  async getTerritoryById(territoryId: string) {
    const territory = await db.query.territories.findFirst({
      where: eq(territories.id, territoryId),
    });
    return territory;
  }

  async updateTerritory(territoryId: string, data: Partial<CreateTerritoryData>) {
    await db
      .update(territories)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(territories.id, territoryId));

    return this.getTerritoryById(territoryId);
  }

  async deleteTerritory(territoryId: string) {
    await db.delete(territories).where(eq(territories.id, territoryId));
  }

  async createTerritoriesForMap(mapId: string, territoriesData: CreateTerritoryData[]) {
    const now = new Date();
    const createdTerritories = [];

    for (const data of territoriesData) {
      const id = uuidv4();
      await db.insert(territories).values({
        id,
        mapId,
        name: data.name,
        description: data.description || null,
        gridX: data.gridX,
        gridY: data.gridY,
        icon: data.icon || '🏰',
        color: data.color || '#6366f1',
        pointMultiplier: data.pointMultiplier || 100,
        isStrategic: data.isStrategic || false,
        adjacentTerritories: [],
        createdAt: now,
        updatedAt: now,
      });
      createdTerritories.push(id);
    }

    return createdTerritories;
  }

  // ==================== JUEGOS/SESIONES ====================

  async createGame(data: CreateGameData) {
    const id = uuidv4();
    const now = new Date();

    // Crear el juego
    await db.insert(territoryGames).values({
      id,
      classroomId: data.classroomId,
      mapId: data.mapId,
      name: data.name,
      questionBankIds: data.questionBankIds,
      participatingClanIds: data.participatingClanIds,
      status: 'DRAFT',
      maxRounds: data.maxRounds || null,
      currentRound: 0,
      timePerQuestion: data.timePerQuestion || 30,
      totalChallenges: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Obtener territorios del mapa
    const mapTerritories = await db
      .select()
      .from(territories)
      .where(eq(territories.mapId, data.mapId));

    // Crear estados iniciales para cada territorio (todos neutrales)
    for (const territory of mapTerritories) {
      await db.insert(territoryGameStates).values({
        id: uuidv4(),
        gameId: id,
        territoryId: territory.id,
        status: 'NEUTRAL',
        ownerClanId: null,
        timesContested: 0,
        timesChanged: 0,
        updatedAt: now,
      });
    }

    // Crear puntajes iniciales para cada clan participante
    for (const clanId of data.participatingClanIds) {
      await db.insert(territoryGameClanScores).values({
        id: uuidv4(),
        gameId: id,
        clanId,
        totalPoints: 0,
        territoriesOwned: 0,
        territoriesConquered: 0,
        territoriesLost: 0,
        successfulDefenses: 0,
        failedDefenses: 0,
        currentStreak: 0,
        bestStreak: 0,
        updatedAt: now,
      });
    }

    return this.getGameById(id);
  }

  async getGameById(gameId: string) {
    const [game] = await db
      .select()
      .from(territoryGames)
      .where(eq(territoryGames.id, gameId))
      .limit(1);

    if (!game) return null;

    // Obtener mapa con territorios
    const map = await this.getMapById(game.mapId);

    // Obtener estados de territorios
    const states = await db
      .select()
      .from(territoryGameStates)
      .where(eq(territoryGameStates.gameId, gameId));

    // Obtener puntuaciones de clanes
    const clanScores = await db
      .select()
      .from(territoryGameClanScores)
      .where(eq(territoryGameClanScores.gameId, gameId));

    // Obtener información de clanes participantes
    // participatingClanIds puede venir como string JSON de la BD
    const clanIds = typeof game.participatingClanIds === 'string' 
      ? JSON.parse(game.participatingClanIds) 
      : game.participatingClanIds;
    
    const clans = clanIds.length > 0 
      ? await db.select().from(teams).where(inArray(teams.id, clanIds))
      : [];

    return { ...game, map, states, clanScores, clans };
  }

  async getClassroomGames(classroomId: string) {
    const games = await db
      .select()
      .from(territoryGames)
      .where(eq(territoryGames.classroomId, classroomId))
      .orderBy(desc(territoryGames.createdAt));

    return games;
  }

  async getActiveGame(classroomId: string) {
    const [game] = await db
      .select()
      .from(territoryGames)
      .where(and(
        eq(territoryGames.classroomId, classroomId),
        eq(territoryGames.status, 'ACTIVE')
      ))
      .limit(1);

    if (!game) return null;

    // Usar getGameById para obtener todos los datos
    return this.getGameById(game.id);
  }

  async startGame(gameId: string) {
    const now = new Date();
    await db
      .update(territoryGames)
      .set({
        status: 'ACTIVE',
        startedAt: now,
        updatedAt: now,
      })
      .where(eq(territoryGames.id, gameId));

    return this.getGameById(gameId);
  }

  async pauseGame(gameId: string) {
    await db
      .update(territoryGames)
      .set({
        status: 'PAUSED',
        updatedAt: new Date(),
      })
      .where(eq(territoryGames.id, gameId));

    return this.getGameById(gameId);
  }

  async resumeGame(gameId: string) {
    await db
      .update(territoryGames)
      .set({
        status: 'ACTIVE',
        updatedAt: new Date(),
      })
      .where(eq(territoryGames.id, gameId));

    return this.getGameById(gameId);
  }

  async finishGame(gameId: string) {
    const now = new Date();
    await db
      .update(territoryGames)
      .set({
        status: 'FINISHED',
        finishedAt: now,
        updatedAt: now,
      })
      .where(eq(territoryGames.id, gameId));

    // Obtener resultados finales
    return this.getGameResults(gameId);
  }

  async getGameResults(gameId: string) {
    const game = await this.getGameById(gameId);
    if (!game) return null;

    // Obtener puntajes ordenados
    const scores = await db
      .select({
        clanId: territoryGameClanScores.clanId,
        totalPoints: territoryGameClanScores.totalPoints,
        territoriesOwned: territoryGameClanScores.territoriesOwned,
        territoriesConquered: territoryGameClanScores.territoriesConquered,
        territoriesLost: territoryGameClanScores.territoriesLost,
        successfulDefenses: territoryGameClanScores.successfulDefenses,
        failedDefenses: territoryGameClanScores.failedDefenses,
        bestStreak: territoryGameClanScores.bestStreak,
        clanName: teams.name,
        clanColor: teams.color,
        clanEmblem: teams.emblem,
      })
      .from(territoryGameClanScores)
      .innerJoin(teams, eq(territoryGameClanScores.clanId, teams.id))
      .where(eq(territoryGameClanScores.gameId, gameId))
      .orderBy(desc(territoryGameClanScores.totalPoints));

    return {
      game,
      ranking: scores,
      winner: scores[0] || null,
    };
  }

  // ==================== DESAFÍOS/CONQUISTAS ====================

  async getRandomQuestion(questionBankIds: string[], excludeQuestionIds: string[] = []) {
    // Obtener una pregunta aleatoria de los bancos especificados
    let query = db
      .select()
      .from(questions)
      .where(inArray(questions.bankId, questionBankIds));

    const allQuestions = await query;
    
    // Filtrar preguntas ya usadas
    const availableQuestions = allQuestions.filter(q => !excludeQuestionIds.includes(q.id));
    
    if (availableQuestions.length === 0) {
      // Si no hay preguntas disponibles, reutilizar todas
      if (allQuestions.length === 0) return null;
      return allQuestions[Math.floor(Math.random() * allQuestions.length)];
    }

    return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
  }

  async initiateConquest(gameId: string, territoryId: string, challengerClanId: string) {
    const game = await this.getGameById(gameId);
    if (!game) throw new Error('Juego no encontrado');
    if (game.status !== 'ACTIVE') throw new Error('El juego no está activo');

    // Verificar estado del territorio
    const territoryState = game.states.find(s => s.territoryId === territoryId);
    if (!territoryState) throw new Error('Territorio no encontrado en este juego');
    if (territoryState.status !== 'NEUTRAL') throw new Error('El territorio no está neutral');

    // Obtener preguntas ya usadas en este juego
    const usedQuestions = await db
      .select({ questionId: territoryChallenges.questionId })
      .from(territoryChallenges)
      .where(eq(territoryChallenges.gameId, gameId));
    const usedQuestionIds = usedQuestions.map(q => q.questionId);

    // Obtener pregunta aleatoria
    const bankIds = typeof game.questionBankIds === 'string' 
      ? JSON.parse(game.questionBankIds) 
      : game.questionBankIds;
    const question = await this.getRandomQuestion(bankIds, usedQuestionIds);
    if (!question) throw new Error('No hay preguntas disponibles');

    const now = new Date();
    const challengeId = uuidv4();

    // Crear el desafío
    await db.insert(territoryChallenges).values({
      id: challengeId,
      gameId,
      territoryId,
      questionId: question.id,
      challengeType: 'CONQUEST',
      challengerClanId,
      defenderClanId: null,
      result: 'PENDING',
      pointsAwarded: 0,
      xpToStudent: 0,
      xpToClan: 0,
      startedAt: now,
      createdAt: now,
    });

    // Marcar territorio como contested
    await db
      .update(territoryGameStates)
      .set({
        status: 'CONTESTED',
        lastChallengerId: challengerClanId,
        lastChallengeAt: now,
        updatedAt: now,
      })
      .where(eq(territoryGameStates.id, territoryState.id));

    return {
      challengeId,
      question: {
        id: question.id,
        text: question.questionText,
        type: question.type,
        options: question.options,
        correctAnswer: question.correctAnswer,
        pairs: question.pairs,
        imageUrl: question.imageUrl,
        difficulty: question.difficulty,
      },
      territory: await this.getTerritoryById(territoryId),
      challengerClan: game.clans.find(c => c.id === challengerClanId),
    };
  }

  async initiateDefenseChallenge(
    gameId: string,
    territoryId: string,
    challengerClanId: string
  ) {
    const game = await this.getGameById(gameId);
    if (!game) throw new Error('Juego no encontrado');
    if (game.status !== 'ACTIVE') throw new Error('El juego no está activo');

    // Verificar estado del territorio
    const territoryState = game.states.find(s => s.territoryId === territoryId);
    if (!territoryState) throw new Error('Territorio no encontrado en este juego');
    if (territoryState.status !== 'OWNED') throw new Error('El territorio no está conquistado');
    if (!territoryState.ownerClanId) throw new Error('El territorio no tiene dueño');
    if (territoryState.ownerClanId === challengerClanId) {
      throw new Error('No puedes retar tu propio territorio');
    }

    // Obtener preguntas ya usadas
    const usedQuestions = await db
      .select({ questionId: territoryChallenges.questionId })
      .from(territoryChallenges)
      .where(eq(territoryChallenges.gameId, gameId));
    const usedQuestionIds = usedQuestions.map(q => q.questionId);

    // Obtener pregunta aleatoria
    const bankIds = typeof game.questionBankIds === 'string' 
      ? JSON.parse(game.questionBankIds) 
      : game.questionBankIds;
    const question = await this.getRandomQuestion(bankIds, usedQuestionIds);
    if (!question) throw new Error('No hay preguntas disponibles');

    const now = new Date();
    const challengeId = uuidv4();

    // Crear el desafío de defensa
    await db.insert(territoryChallenges).values({
      id: challengeId,
      gameId,
      territoryId,
      questionId: question.id,
      challengeType: 'DEFENSE',
      challengerClanId,
      defenderClanId: territoryState.ownerClanId,
      result: 'PENDING',
      pointsAwarded: 0,
      xpToStudent: 0,
      xpToClan: 0,
      startedAt: now,
      createdAt: now,
    });

    // Marcar territorio como contested
    await db
      .update(territoryGameStates)
      .set({
        status: 'CONTESTED',
        timesContested: sql`${territoryGameStates.timesContested} + 1`,
        lastChallengerId: challengerClanId,
        lastChallengeAt: now,
        updatedAt: now,
      })
      .where(eq(territoryGameStates.id, territoryState.id));

    return {
      challengeId,
      question: {
        id: question.id,
        text: question.questionText,
        type: question.type,
        options: question.options,
        correctAnswer: question.correctAnswer,
        pairs: question.pairs,
        imageUrl: question.imageUrl,
        difficulty: question.difficulty,
      },
      territory: await this.getTerritoryById(territoryId),
      challengerClan: game.clans.find(c => c.id === challengerClanId),
      defenderClan: game.clans.find(c => c.id === territoryState.ownerClanId),
    };
  }

  async resolveChallenge(data: ChallengeResult) {
    const challenge = await db.query.territoryChallenges.findFirst({
      where: eq(territoryChallenges.id, data.challengeId),
    });
    if (!challenge) throw new Error('Desafío no encontrado');
    if (challenge.result !== 'PENDING') throw new Error('El desafío ya fue resuelto');

    const game = await this.getGameById(challenge.gameId);
    if (!game) throw new Error('Juego no encontrado');
    if (!game.map) throw new Error('Mapa no encontrado');

    const map = game.map;
    const territoryState = game.states.find(s => s.territoryId === challenge.territoryId);
    if (!territoryState) throw new Error('Estado del territorio no encontrado');

    const territory = map.territories.find(t => t.id === challenge.territoryId);
    if (!territory) throw new Error('Territorio no encontrado');

    const now = new Date();
    const result = data.isCorrect ? 'CORRECT' : 'INCORRECT';

    // Calcular puntos base
    const basePoints = challenge.challengeType === 'CONQUEST'
      ? map.baseConquestPoints
      : map.baseDefensePoints;
    
    // Aplicar multiplicador del territorio
    const multiplier = territory.pointMultiplier / 100;
    let pointsAwarded = Math.round(basePoints * multiplier);

    // Obtener configuración del classroom para el porcentaje de XP al clan
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, game.classroomId),
    });
    const clanXpPercentage = classroom?.clanXpPercentage || 50;

    // Calcular XP para estudiante y clan
    let xpToStudent = 0;
    let xpToClan = 0;

    if (data.isCorrect) {
      xpToStudent = pointsAwarded;
      xpToClan = Math.round(pointsAwarded * (clanXpPercentage / 100));
    }

    // Actualizar el desafío
    await db
      .update(territoryChallenges)
      .set({
        result,
        respondentStudentId: data.respondentStudentId || null,
        timeSpent: data.timeSpent || null,
        pointsAwarded,
        xpToStudent,
        xpToClan,
        answeredAt: now,
      })
      .where(eq(territoryChallenges.id, data.challengeId));

    // Procesar resultado según tipo de desafío
    if (challenge.challengeType === 'CONQUEST') {
      await this.processConquestResult(
        challenge,
        territoryState,
        data.isCorrect,
        pointsAwarded,
        xpToClan,
        now
      );
    } else {
      await this.processDefenseResult(
        challenge,
        territoryState,
        data.isCorrect,
        pointsAwarded,
        xpToClan,
        now
      );
    }

    // Dar XP al estudiante si respondió correctamente
    if (data.isCorrect && data.respondentStudentId) {
      await this.awardStudentXp(data.respondentStudentId, xpToStudent, challenge.gameId);
    }

    // Incrementar contador de rondas
    await db
      .update(territoryGames)
      .set({
        currentRound: sql`${territoryGames.currentRound} + 1`,
        totalChallenges: sql`${territoryGames.totalChallenges} + 1`,
        updatedAt: now,
      })
      .where(eq(territoryGames.id, challenge.gameId));

    // Verificar si se alcanzó el límite de rondas
    const updatedGame = await this.getGameById(challenge.gameId);
    if (updatedGame?.maxRounds && updatedGame.currentRound >= updatedGame.maxRounds) {
      await this.finishGame(challenge.gameId);
    }

    return this.getGameById(challenge.gameId);
  }

  private async processConquestResult(
    challenge: any,
    territoryState: any,
    isCorrect: boolean,
    points: number,
    xpToClan: number,
    now: Date
  ) {
    if (isCorrect) {
      // Conquistar territorio
      await db
        .update(territoryGameStates)
        .set({
          status: 'OWNED',
          ownerClanId: challenge.challengerClanId,
          conqueredAt: now,
          timesChanged: sql`${territoryGameStates.timesChanged} + 1`,
          updatedAt: now,
        })
        .where(eq(territoryGameStates.id, territoryState.id));

      // Actualizar puntaje del clan conquistador
      await db
        .update(territoryGameClanScores)
        .set({
          totalPoints: sql`${territoryGameClanScores.totalPoints} + ${points}`,
          territoriesOwned: sql`${territoryGameClanScores.territoriesOwned} + 1`,
          territoriesConquered: sql`${territoryGameClanScores.territoriesConquered} + 1`,
          currentStreak: sql`${territoryGameClanScores.currentStreak} + 1`,
          bestStreak: sql`GREATEST(${territoryGameClanScores.bestStreak}, ${territoryGameClanScores.currentStreak} + 1)`,
          updatedAt: now,
        })
        .where(
          and(
            eq(territoryGameClanScores.gameId, challenge.gameId),
            eq(territoryGameClanScores.clanId, challenge.challengerClanId)
          )
        );

      // Dar XP al clan
      await this.awardClanXp(challenge.challengerClanId, xpToClan, 'TERRITORY_CONQUERED');
    } else {
      // Territorio vuelve a neutral
      await db
        .update(territoryGameStates)
        .set({
          status: 'NEUTRAL',
          updatedAt: now,
        })
        .where(eq(territoryGameStates.id, territoryState.id));

      // Resetear racha del clan
      await db
        .update(territoryGameClanScores)
        .set({
          currentStreak: 0,
          updatedAt: now,
        })
        .where(
          and(
            eq(territoryGameClanScores.gameId, challenge.gameId),
            eq(territoryGameClanScores.clanId, challenge.challengerClanId)
          )
        );
    }
  }

  private async processDefenseResult(
    challenge: any,
    territoryState: any,
    isCorrect: boolean,
    points: number,
    xpToClan: number,
    now: Date
  ) {
    if (isCorrect) {
      // El retador gana - cambia de dueño
      await db
        .update(territoryGameStates)
        .set({
          status: 'OWNED',
          ownerClanId: challenge.challengerClanId,
          conqueredAt: now,
          timesChanged: sql`${territoryGameStates.timesChanged} + 1`,
          updatedAt: now,
        })
        .where(eq(territoryGameStates.id, territoryState.id));

      // Actualizar puntaje del clan retador (ganador)
      await db
        .update(territoryGameClanScores)
        .set({
          totalPoints: sql`${territoryGameClanScores.totalPoints} + ${points}`,
          territoriesOwned: sql`${territoryGameClanScores.territoriesOwned} + 1`,
          territoriesConquered: sql`${territoryGameClanScores.territoriesConquered} + 1`,
          currentStreak: sql`${territoryGameClanScores.currentStreak} + 1`,
          bestStreak: sql`GREATEST(${territoryGameClanScores.bestStreak}, ${territoryGameClanScores.currentStreak} + 1)`,
          updatedAt: now,
        })
        .where(
          and(
            eq(territoryGameClanScores.gameId, challenge.gameId),
            eq(territoryGameClanScores.clanId, challenge.challengerClanId)
          )
        );

      // Actualizar puntaje del clan defensor (perdedor)
      await db
        .update(territoryGameClanScores)
        .set({
          territoriesOwned: sql`${territoryGameClanScores.territoriesOwned} - 1`,
          territoriesLost: sql`${territoryGameClanScores.territoriesLost} + 1`,
          failedDefenses: sql`${territoryGameClanScores.failedDefenses} + 1`,
          currentStreak: 0,
          updatedAt: now,
        })
        .where(
          and(
            eq(territoryGameClanScores.gameId, challenge.gameId),
            eq(territoryGameClanScores.clanId, challenge.defenderClanId)
          )
        );

      // Dar XP al clan ganador
      await this.awardClanXp(challenge.challengerClanId, xpToClan, 'TERRITORY_CONQUERED');
    } else {
      // El defensor mantiene el territorio
      await db
        .update(territoryGameStates)
        .set({
          status: 'OWNED',
          updatedAt: now,
        })
        .where(eq(territoryGameStates.id, territoryState.id));

      // Actualizar puntaje del clan defensor (ganador)
      await db
        .update(territoryGameClanScores)
        .set({
          totalPoints: sql`${territoryGameClanScores.totalPoints} + ${points}`,
          successfulDefenses: sql`${territoryGameClanScores.successfulDefenses} + 1`,
          currentStreak: sql`${territoryGameClanScores.currentStreak} + 1`,
          bestStreak: sql`GREATEST(${territoryGameClanScores.bestStreak}, ${territoryGameClanScores.currentStreak} + 1)`,
          updatedAt: now,
        })
        .where(
          and(
            eq(territoryGameClanScores.gameId, challenge.gameId),
            eq(territoryGameClanScores.clanId, challenge.defenderClanId)
          )
        );

      // Resetear racha del retador
      await db
        .update(territoryGameClanScores)
        .set({
          currentStreak: 0,
          updatedAt: now,
        })
        .where(
          and(
            eq(territoryGameClanScores.gameId, challenge.gameId),
            eq(territoryGameClanScores.clanId, challenge.challengerClanId)
          )
        );

      // Dar XP al clan defensor
      await this.awardClanXp(challenge.defenderClanId!, xpToClan, 'TERRITORY_DEFENDED');
    }
  }

  private async awardStudentXp(studentId: string, xp: number, gameId: string) {
    if (xp <= 0) return;

    await db
      .update(studentProfiles)
      .set({
        xp: sql`${studentProfiles.xp} + ${xp}`,
        updatedAt: new Date(),
      })
      .where(eq(studentProfiles.id, studentId));
  }

  private async awardClanXp(clanId: string, xp: number, action: string) {
    if (xp <= 0) return;

    const now = new Date();

    // Actualizar XP del clan
    await db
      .update(teams)
      .set({
        totalXp: sql`${teams.totalXp} + ${xp}`,
        updatedAt: now,
      })
      .where(eq(teams.id, clanId));

    // Registrar en el log del clan
    await db.insert(clanLogs).values({
      id: uuidv4(),
      clanId,
      action,
      xpAmount: xp,
      gpAmount: 0,
      reason: `Conquista de Territorios: ${action}`,
      createdAt: now,
    });
  }

  // ==================== UTILIDADES ====================

  async getGameState(gameId: string) {
    const game = await this.getGameById(gameId);
    if (!game) return null;
    if (!game.map) return null;

    // Asegurar que territories sea un array
    const mapTerritories = Array.isArray(game.map.territories) ? game.map.territories : [];

    // Construir estado del mapa con territorios y sus dueños
    const mapState = mapTerritories.map(territory => {
      const state = game.states.find(s => s.territoryId === territory.id);
      const ownerClan = state?.ownerClanId
        ? game.clans.find(c => c.id === state.ownerClanId)
        : null;

      return {
        ...territory,
        status: state?.status || 'NEUTRAL',
        ownerClan: ownerClan ? {
          id: ownerClan.id,
          name: ownerClan.name,
          color: ownerClan.color,
          emblem: ownerClan.emblem,
        } : null,
      };
    });

    // Ordenar puntajes
    const ranking = game.clanScores
      .map(score => {
        const clan = game.clans.find(c => c.id === score.clanId);
        return {
          ...score,
          clan: clan ? {
            id: clan.id,
            name: clan.name,
            color: clan.color,
            emblem: clan.emblem,
          } : null,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);

    // Obtener estadísticas de preguntas
    const bankIds = typeof game.questionBankIds === 'string' 
      ? JSON.parse(game.questionBankIds) 
      : game.questionBankIds;
    
    // Total de preguntas disponibles
    const totalQuestionsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .where(inArray(questions.bankId, bankIds));
    const totalQuestions = Number(totalQuestionsResult[0]?.count || 0);
    
    // Preguntas únicas usadas en este juego (para saber cuántas quedan disponibles)
    const uniqueUsedQuestionsResult = await db
      .select({ count: sql<number>`count(DISTINCT ${territoryChallenges.questionId})` })
      .from(territoryChallenges)
      .where(eq(territoryChallenges.gameId, gameId));
    const uniqueUsedQuestions = Number(uniqueUsedQuestionsResult[0]?.count || 0);
    
    // Total de desafíos (para mostrar el número de pregunta actual)
    const totalChallengesResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(territoryChallenges)
      .where(eq(territoryChallenges.gameId, gameId));
    const totalChallengesCount = Number(totalChallengesResult[0]?.count || 0);

    // Obtener desafío pendiente (PENDING)
    const pendingChallengeResult = await db
      .select()
      .from(territoryChallenges)
      .where(and(
        eq(territoryChallenges.gameId, gameId),
        eq(territoryChallenges.result, 'PENDING')
      ))
      .limit(1);
    
    let pendingChallenge = null;
    if (pendingChallengeResult.length > 0) {
      const challenge = pendingChallengeResult[0];
      const question = await db.select().from(questions).where(eq(questions.id, challenge.questionId)).limit(1);
      const territory = mapTerritories.find(t => t.id === challenge.territoryId);
      const challengerClan = game.clans.find(c => c.id === challenge.challengerClanId);
      const defenderClan = challenge.defenderClanId ? game.clans.find(c => c.id === challenge.defenderClanId) : null;
      
      if (question[0] && territory && challengerClan) {
        // Helper para parsear JSON (maneja doble serialización y strings)
        const parseJsonField = (value: any): any => {
          if (value === null || value === undefined) return null;
          // Si ya es un objeto o array, devolverlo
          if (typeof value === 'object') return value;
          // Si es boolean o number, devolverlo
          if (typeof value === 'boolean' || typeof value === 'number') return value;
          // Si es string, intentar parsear
          if (typeof value === 'string') {
            // Manejar strings "true"/"false" directamente
            if (value === 'true') return true;
            if (value === 'false') return false;
            try {
              let parsed = JSON.parse(value);
              // Si sigue siendo string, intentar parsear de nuevo
              while (typeof parsed === 'string') {
                if (parsed === 'true') return true;
                if (parsed === 'false') return false;
                parsed = JSON.parse(parsed);
              }
              return parsed;
            } catch {
              return value;
            }
          }
          return value;
        };

        // Parsear campos JSON de la pregunta
        const parsedQuestion = {
          ...question[0],
          options: parseJsonField(question[0].options),
          correctAnswer: parseJsonField(question[0].correctAnswer),
          pairs: parseJsonField(question[0].pairs),
        };

        pendingChallenge = {
          challengeId: challenge.id,
          challengeType: challenge.challengeType,
          territory: {
            id: territory.id,
            name: territory.name,
            icon: territory.icon,
          },
          challengerClan: {
            id: challengerClan.id,
            name: challengerClan.name,
            color: challengerClan.color,
            emblem: challengerClan.emblem,
          },
          defenderClan: defenderClan ? {
            id: defenderClan.id,
            name: defenderClan.name,
            color: defenderClan.color,
            emblem: defenderClan.emblem,
          } : null,
          question: parsedQuestion,
        };
      }
    }

    return {
      game: {
        id: game.id,
        name: game.name,
        status: game.status,
        currentRound: game.currentRound,
        maxRounds: game.maxRounds,
        totalChallenges: game.totalChallenges,
        timePerQuestion: game.timePerQuestion,
        startedAt: game.startedAt,
      },
      map: {
        id: game.map.id,
        name: game.map.name,
        gridCols: game.map.gridCols,
        gridRows: game.map.gridRows,
        backgroundImage: game.map.backgroundImage,
      },
      territories: mapState,
      ranking,
      clans: game.clans.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color,
        emblem: c.emblem,
      })),
      questionStats: {
        current: totalChallengesCount,
        uniqueUsed: uniqueUsedQuestions,
        total: totalQuestions,
      },
      pendingChallenge,
    };
  }

  async getChallengeHistory(gameId: string) {
    const challenges = await db
      .select({
        id: territoryChallenges.id,
        challengeType: territoryChallenges.challengeType,
        result: territoryChallenges.result,
        pointsAwarded: territoryChallenges.pointsAwarded,
        xpToStudent: territoryChallenges.xpToStudent,
        xpToClan: territoryChallenges.xpToClan,
        timeSpent: territoryChallenges.timeSpent,
        startedAt: territoryChallenges.startedAt,
        answeredAt: territoryChallenges.answeredAt,
        territoryName: territories.name,
        territoryIcon: territories.icon,
        challengerClanName: teams.name,
        challengerClanColor: teams.color,
      })
      .from(territoryChallenges)
      .innerJoin(territories, eq(territoryChallenges.territoryId, territories.id))
      .innerJoin(teams, eq(territoryChallenges.challengerClanId, teams.id))
      .where(eq(territoryChallenges.gameId, gameId))
      .orderBy(desc(territoryChallenges.createdAt));

    return challenges;
  }
}

export const territoryService = new TerritoryService();
