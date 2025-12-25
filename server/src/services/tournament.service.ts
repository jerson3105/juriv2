import { eq, and, desc, asc, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  tournaments,
  tournamentParticipants,
  tournamentMatches,
  tournamentAnswers,
  studentProfiles,
  teams,
  questions,
  questionBanks,
  pointLogs,
  notifications,
  type Tournament,
  type TournamentParticipant,
  type TournamentMatch,
  type TournamentAnswer,
  type TournamentType,
  type TournamentStatus,
  type TournamentParticipantType,
  type TournamentMatchStatus,
} from '../db/schema.js';

// ==================== INTERFACES ====================

export interface CreateTournamentDto {
  name: string;
  description?: string;
  icon?: string;
  type: TournamentType;
  participantType: TournamentParticipantType;
  questionBankIds: string[];
  maxParticipants?: number;
  timePerQuestion?: number;
  questionsPerMatch?: number;
  pointsPerCorrect?: number;
  bonusTimePoints?: number;
  rewardXpFirst?: number;
  rewardXpSecond?: number;
  rewardXpThird?: number;
  rewardGpFirst?: number;
  rewardGpSecond?: number;
  rewardGpThird?: number;
  rewardXpParticipation?: number;
}

export interface UpdateTournamentDto extends Partial<CreateTournamentDto> {
  status?: TournamentStatus;
}

export interface TournamentWithDetails extends Tournament {
  participants?: (TournamentParticipant & {
    student?: {
      id: string;
      displayName: string | null;
      avatarUrl: string | null;
      characterClass: string | null;
      level: number;
      xp: number;
    } | null;
    clan?: {
      id: string;
      name: string;
      color: string | null;
          } | null;
  })[];
  matches?: TournamentMatch[];
  questionBanks?: { id: string; name: string; questionCount: number }[];
}

export interface MatchWithDetails extends TournamentMatch {
  participant1?: TournamentParticipant & {
    student?: {
      id: string;
      displayName: string | null;
      avatarUrl: string | null;
      characterClass: string | null;
      level: number;
    } | null;
    clan?: {
      id: string;
      name: string;
      color: string | null;
          } | null;
  };
  participant2?: TournamentParticipant & {
    student?: {
      id: string;
      displayName: string | null;
      avatarUrl: string | null;
      characterClass: string | null;
      level: number;
    } | null;
    clan?: {
      id: string;
      name: string;
      color: string | null;
          } | null;
  };
  currentQuestion?: {
    id: string;
    question: string;
    questionType: string;
    options: any;
    correctAnswer: string;
    imageUrl?: string | null;
  } | null;
  answers?: TournamentAnswer[];
}

// ==================== SERVICE ====================

class TournamentService {
  // ==================== CRUD TORNEOS ====================

  async createTournament(classroomId: string, data: CreateTournamentDto): Promise<Tournament> {
    const id = uuidv4();
    const now = new Date();

    // Calcular número de rondas basado en maxParticipants
    const maxParticipants = data.maxParticipants || 16;
    const totalRounds = Math.ceil(Math.log2(maxParticipants));

    await db.insert(tournaments).values({
      id,
      classroomId,
      name: data.name,
      description: data.description,
      icon: data.icon || '🏆',
      type: data.type,
      participantType: data.participantType,
      questionBankIds: data.questionBankIds,
      maxParticipants,
      timePerQuestion: data.timePerQuestion || 30,
      questionsPerMatch: data.questionsPerMatch || 3,
      pointsPerCorrect: data.pointsPerCorrect || 100,
      bonusTimePoints: data.bonusTimePoints || 10,
      rewardXpFirst: data.rewardXpFirst || 100,
      rewardXpSecond: data.rewardXpSecond || 50,
      rewardXpThird: data.rewardXpThird || 25,
      rewardGpFirst: data.rewardGpFirst || 50,
      rewardGpSecond: data.rewardGpSecond || 25,
      rewardGpThird: data.rewardGpThird || 10,
      rewardXpParticipation: data.rewardXpParticipation || 10,
      status: 'DRAFT',
      totalRounds,
      createdAt: now,
      updatedAt: now,
    });

    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    return tournament;
  }

  async updateTournament(tournamentId: string, data: UpdateTournamentDto): Promise<Tournament> {
    const updateData: any = { ...data, updatedAt: new Date() };

    // Recalcular rondas si cambia maxParticipants
    if (data.maxParticipants) {
      updateData.totalRounds = Math.ceil(Math.log2(data.maxParticipants));
    }

    await db.update(tournaments)
      .set(updateData)
      .where(eq(tournaments.id, tournamentId));

    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
    return tournament;
  }

  async deleteTournament(tournamentId: string): Promise<void> {
    // Eliminar en orden: answers -> matches -> participants -> tournament
    const matchIds = await db.select({ id: tournamentMatches.id })
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, tournamentId));

    if (matchIds.length > 0) {
      await db.delete(tournamentAnswers)
        .where(inArray(tournamentAnswers.matchId, matchIds.map(m => m.id)));
    }

    await db.delete(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournamentId));
    await db.delete(tournamentParticipants).where(eq(tournamentParticipants.tournamentId, tournamentId));
    await db.delete(tournaments).where(eq(tournaments.id, tournamentId));
  }

  async getTournament(tournamentId: string): Promise<TournamentWithDetails | null> {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
    if (!tournament) return null;

    // Obtener participantes con datos del estudiante/clan
    const participantsData = await db.select({
      participant: tournamentParticipants,
      student: {
        id: studentProfiles.id,
        displayName: studentProfiles.characterName, // Usar characterName como displayName
        avatarUrl: studentProfiles.avatarUrl,
        avatarGender: studentProfiles.avatarGender,
        characterClass: studentProfiles.characterClass,
        level: studentProfiles.level,
        xp: studentProfiles.xp,
      },
      clan: {
        id: teams.id,
        name: teams.name,
        color: teams.color,
      },
    })
      .from(tournamentParticipants)
      .leftJoin(studentProfiles, eq(tournamentParticipants.studentProfileId, studentProfiles.id))
      .leftJoin(teams, eq(tournamentParticipants.clanId, teams.id))
      .where(eq(tournamentParticipants.tournamentId, tournamentId))
      .orderBy(asc(tournamentParticipants.seed));

    // Obtener matches
    const matchesData = await db.select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, tournamentId))
      .orderBy(asc(tournamentMatches.round), asc(tournamentMatches.matchNumber));

    // Obtener info de bancos de preguntas
    // El campo JSON puede venir como string o como array dependiendo del driver
    let bankIds: string[] = [];
    if (tournament.questionBankIds) {
      bankIds = typeof tournament.questionBankIds === 'string' 
        ? JSON.parse(tournament.questionBankIds) 
        : tournament.questionBankIds;
    }
    let banksData: { id: string; name: string; questionCount: number }[] = [];
    if (bankIds.length > 0) {
      const banks = await db.select({
        id: questionBanks.id,
        name: questionBanks.name,
      })
        .from(questionBanks)
        .where(inArray(questionBanks.id, bankIds));

      // Contar preguntas por banco
      for (const bank of banks) {
        const [countResult] = await db.select({ count: sql<number>`count(*)` })
          .from(questions)
          .where(eq(questions.bankId, bank.id));
        banksData.push({
          ...bank,
          questionCount: Number(countResult?.count || 0),
        });
      }
    }

    return {
      ...tournament,
      participants: participantsData.map(p => ({
        ...p.participant,
        student: p.student?.id ? p.student : null,
        clan: p.clan?.id ? p.clan : null,
      })),
      matches: matchesData,
      questionBanks: banksData,
    };
  }

  async getTournamentsByClassroom(classroomId: string): Promise<Tournament[]> {
    return db.select()
      .from(tournaments)
      .where(eq(tournaments.classroomId, classroomId))
      .orderBy(desc(tournaments.createdAt));
  }

  // ==================== PARTICIPANTES ====================

  async addParticipant(
    tournamentId: string,
    participantId: string,
    isIndividual: boolean
  ): Promise<TournamentParticipant> {
    // Verificar límite de participantes
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) throw new Error('Torneo no encontrado');
    
    // Verificar que el participante pertenezca al mismo classroom del torneo
    if (isIndividual) {
      const [student] = await db.select({ classroomId: studentProfiles.classroomId, isActive: studentProfiles.isActive, isDemo: studentProfiles.isDemo })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, participantId));
      
      if (!student) throw new Error('Estudiante no encontrado');
      if (student.classroomId !== tournament.classroomId) {
        throw new Error('El estudiante no pertenece a esta clase');
      }
      if (student.isActive === false) {
        throw new Error('El estudiante no está activo');
      }
      if (student.isDemo === true) {
        throw new Error('No se pueden agregar estudiantes demo');
      }
    } else {
      const [clan] = await db.select({ classroomId: teams.classroomId })
        .from(teams)
        .where(eq(teams.id, participantId));
      
      if (!clan) throw new Error('Clan no encontrado');
      if (clan.classroomId !== tournament.classroomId) {
        throw new Error('El clan no pertenece a esta clase');
      }
    }
    
    const currentParticipants = await db.select({ count: sql<number>`COUNT(*)` })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournamentId));
    
    const currentCount = currentParticipants[0]?.count || 0;
    if (currentCount >= tournament.maxParticipants) {
      throw new Error(`El torneo ya tiene el máximo de participantes (${tournament.maxParticipants})`);
    }

    const id = uuidv4();
    const now = new Date();

    // Obtener el siguiente seed
    const [maxSeed] = await db.select({ max: sql<number>`COALESCE(MAX(seed), 0)` })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournamentId));

    const seed = (maxSeed?.max || 0) + 1;

    await db.insert(tournamentParticipants).values({
      id,
      tournamentId,
      studentProfileId: isIndividual ? participantId : null,
      clanId: isIndividual ? null : participantId,
      seed,
      joinedAt: now,
      updatedAt: now,
    });

    const [participant] = await db.select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.id, id));

    return participant;
  }

  async removeParticipant(participantId: string): Promise<void> {
    await db.delete(tournamentParticipants).where(eq(tournamentParticipants.id, participantId));
  }

  async addMultipleParticipants(
    tournamentId: string,
    participantIds: string[],
    isIndividual: boolean
  ): Promise<TournamentParticipant[]> {
    // Verificar límite de participantes
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) throw new Error('Torneo no encontrado');
    
    // Validar que todos los participantes pertenezcan al mismo classroom del torneo
    console.log('=== addMultipleParticipants DEBUG ===');
    console.log('Tournament ID:', tournamentId);
    console.log('Tournament classroomId:', tournament.classroomId);
    console.log('Participant IDs received:', participantIds);
    console.log('isIndividual:', isIndividual);
    
    const validIds: string[] = [];
    for (const participantId of participantIds) {
      console.log(`Processing participant: ${participantId}`);
      if (isIndividual) {
        const [student] = await db.select({ 
          classroomId: studentProfiles.classroomId, 
          isActive: studentProfiles.isActive, 
          isDemo: studentProfiles.isDemo,
          displayName: studentProfiles.displayName 
        })
          .from(studentProfiles)
          .where(eq(studentProfiles.id, participantId));
        
        console.log(`Student found:`, student);
        
        if (!student) {
          console.warn(`Estudiante ${participantId} no encontrado, omitiendo`);
          continue;
        }
        if (student.classroomId !== tournament.classroomId) {
          console.warn(`Estudiante ${participantId} (${student.displayName}) no pertenece a la clase del torneo (${student.classroomId} vs ${tournament.classroomId}), omitiendo`);
          continue;
        }
        if (student.isActive === false) {
          console.warn(`Estudiante ${participantId} no está activo, omitiendo`);
          continue;
        }
        if (student.isDemo === true) {
          console.warn(`Estudiante ${participantId} es demo, omitiendo`);
          continue;
        }
        validIds.push(participantId);
      } else {
        const [clan] = await db.select({ classroomId: teams.classroomId })
          .from(teams)
          .where(eq(teams.id, participantId));
        
        if (!clan) {
          console.warn(`Clan ${participantId} no encontrado, omitiendo`);
          continue;
        }
        if (clan.classroomId !== tournament.classroomId) {
          console.warn(`Clan ${participantId} no pertenece a la clase del torneo, omitiendo`);
          continue;
        }
        validIds.push(participantId);
      }
    }
    
    if (validIds.length === 0) {
      throw new Error('Ninguno de los participantes seleccionados es válido para este torneo');
    }
    
    const currentParticipants = await db.select({ count: sql<number>`COUNT(*)` })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournamentId));
    
    const currentCount = Number(currentParticipants[0]?.count || 0);
    const availableSlots = tournament.maxParticipants - currentCount;
    
    if (availableSlots <= 0) {
      throw new Error(`El torneo ya tiene el máximo de participantes (${tournament.maxParticipants})`);
    }
    
    // Limitar la cantidad a añadir según los slots disponibles
    const idsToAdd = validIds.slice(0, availableSlots);
    if (idsToAdd.length < validIds.length) {
      console.log(`Solo se añadirán ${idsToAdd.length} de ${validIds.length} participantes por límite del torneo`);
    }

    const now = new Date();
    const participants: TournamentParticipant[] = [];

    // Obtener el siguiente seed
    const [maxSeed] = await db.select({ max: sql<number>`COALESCE(MAX(seed), 0)` })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournamentId));

    let seed = (maxSeed?.max || 0);

    for (const participantId of idsToAdd) {
      seed++;
      const id = uuidv4();

      await db.insert(tournamentParticipants).values({
        id,
        tournamentId,
        studentProfileId: isIndividual ? participantId : null,
        clanId: isIndividual ? null : participantId,
        seed,
        joinedAt: now,
        updatedAt: now,
      });

      const [participant] = await db.select()
        .from(tournamentParticipants)
        .where(eq(tournamentParticipants.id, id));

      participants.push(participant);
    }

    return participants;
  }

  // ==================== BRACKET GENERATION ====================

  async generateBracket(tournamentId: string): Promise<TournamentMatch[]> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) throw new Error('Torneo no encontrado');
    if (!tournament.participants || tournament.participants.length < 2) {
      throw new Error('Se necesitan al menos 2 participantes');
    }

    // Eliminar matches existentes
    await db.delete(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournamentId));

    // Generar según el tipo de torneo
    if (tournament.type === 'LEAGUE') {
      return this.generateLeagueMatches(tournamentId, tournament);
    }

    // BRACKET (eliminación) - lógica existente
    const participants = tournament.participants;
    const numParticipants = participants.length;
    
    // Calcular el tamaño del bracket (potencia de 2 más cercana hacia arriba)
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(numParticipants)));
    const numByes = bracketSize - numParticipants;
    const totalRounds = Math.ceil(Math.log2(bracketSize));

    // Mezclar participantes aleatoriamente para el seeding
    const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);

    // Crear matches de la primera ronda
    const now = new Date();
    const matches: TournamentMatch[] = [];
    const matchesInFirstRound = bracketSize / 2;

    // Distribuir BYEs de manera uniforme
    let byesAssigned = 0;
    let participantIndex = 0;

    for (let i = 0; i < matchesInFirstRound; i++) {
      const matchId = uuidv4();
      const matchNumber = i + 1;
      
      // Determinar participantes para este match
      let p1Id: string | null = null;
      let p2Id: string | null = null;
      let status: TournamentMatchStatus = 'PENDING';
      let winnerId: string | null = null;

      // Asignar primer participante
      if (participantIndex < shuffledParticipants.length) {
        p1Id = shuffledParticipants[participantIndex].id;
        participantIndex++;
      }

      // Asignar segundo participante o BYE
      if (byesAssigned < numByes && (i % Math.ceil(matchesInFirstRound / numByes) === 0 || participantIndex >= shuffledParticipants.length)) {
        // Este match es un BYE
        p2Id = null;
        status = 'BYE';
        winnerId = p1Id; // El participante 1 avanza automáticamente
        byesAssigned++;
      } else if (participantIndex < shuffledParticipants.length) {
        p2Id = shuffledParticipants[participantIndex].id;
        participantIndex++;
      }

      await db.insert(tournamentMatches).values({
        id: matchId,
        tournamentId,
        round: 1,
        matchNumber,
        bracketPosition: `R1M${matchNumber}`,
        participant1Id: p1Id,
        participant2Id: p2Id,
        status,
        winnerId,
        createdAt: now,
        updatedAt: now,
      });

      const [match] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, matchId));
      matches.push(match);
    }

    // Crear matches para las siguientes rondas (vacíos por ahora)
    for (let round = 2; round <= totalRounds; round++) {
      const matchesInRound = bracketSize / Math.pow(2, round);
      const roundName = this.getRoundName(round, totalRounds);

      for (let i = 0; i < matchesInRound; i++) {
        const matchId = uuidv4();
        const matchNumber = i + 1;

        await db.insert(tournamentMatches).values({
          id: matchId,
          tournamentId,
          round,
          matchNumber,
          bracketPosition: `${roundName}${matchNumber}`,
          participant1Id: null,
          participant2Id: null,
          status: 'PENDING',
          createdAt: now,
          updatedAt: now,
        });

        const [match] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, matchId));
        matches.push(match);
      }
    }

    // Actualizar estado del torneo
    await db.update(tournaments)
      .set({ 
        status: 'READY', 
        totalRounds,
        currentRound: 1,
        updatedAt: now 
      })
      .where(eq(tournaments.id, tournamentId));

    // Propagar ganadores de BYEs a la siguiente ronda
    await this.propagateByes(tournamentId);

    return matches;
  }

  private getRoundName(round: number, totalRounds: number): string {
    const roundsFromEnd = totalRounds - round + 1;
    switch (roundsFromEnd) {
      case 1: return 'FINAL';
      case 2: return 'SF';
      case 3: return 'QF';
      default: return `R${round}M`;
    }
  }

  // ==================== LEAGUE (ROUND-ROBIN) GENERATION ====================

  private async generateLeagueMatches(tournamentId: string, tournament: any): Promise<TournamentMatch[]> {
    const participants = tournament.participants;
    const numParticipants = participants.length;
    const now = new Date();
    const matches: TournamentMatch[] = [];

    // Generar todos los enfrentamientos posibles (round-robin)
    // Cada participante juega contra todos los demás una vez
    let matchNumber = 0;
    
    // Calcular número de jornadas (rondas)
    // Con n participantes: n-1 jornadas si n es par, n jornadas si n es impar
    const numRounds = numParticipants % 2 === 0 ? numParticipants - 1 : numParticipants;
    
    // Algoritmo de round-robin (circle method)
    // Si hay número impar de participantes, agregamos un "fantasma" para BYEs
    const participantIds = participants.map((p: any) => p.id);
    if (numParticipants % 2 !== 0) {
      participantIds.push(null); // Participante fantasma para BYE
    }
    
    const n = participantIds.length;
    const half = n / 2;
    
    for (let round = 1; round <= n - 1; round++) {
      // Generar matches para esta ronda
      for (let i = 0; i < half; i++) {
        const home = participantIds[i];
        const away = participantIds[n - 1 - i];
        
        // Si alguno es null, es un BYE (no crear match)
        if (home === null || away === null) continue;
        
        matchNumber++;
        const matchId = uuidv4();
        
        await db.insert(tournamentMatches).values({
          id: matchId,
          tournamentId,
          round,
          matchNumber,
          bracketPosition: `J${round}M${matchNumber}`, // Jornada X Match Y
          participant1Id: home,
          participant2Id: away,
          status: 'PENDING',
          createdAt: now,
          updatedAt: now,
        });
        
        const [match] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, matchId));
        matches.push(match);
      }
      
      // Rotar participantes (el primero se queda fijo)
      const fixed = participantIds[0];
      const rotating = participantIds.slice(1);
      rotating.unshift(rotating.pop()!);
      participantIds.splice(0, participantIds.length, fixed, ...rotating);
    }
    
    // Actualizar estado del torneo
    await db.update(tournaments)
      .set({ 
        status: 'READY', 
        totalRounds: numRounds,
        currentRound: 1,
        updatedAt: now 
      })
      .where(eq(tournaments.id, tournamentId));

    return matches;
  }

  private async propagateByes(tournamentId: string): Promise<void> {
    // Obtener matches de la primera ronda que son BYE
    const byeMatches = await db.select()
      .from(tournamentMatches)
      .where(and(
        eq(tournamentMatches.tournamentId, tournamentId),
        eq(tournamentMatches.round, 1),
        eq(tournamentMatches.status, 'BYE')
      ));

    for (const byeMatch of byeMatches) {
      if (byeMatch.winnerId) {
        await this.advanceWinner(byeMatch.id, byeMatch.winnerId);
      }
    }
  }

  // ==================== MATCH MANAGEMENT ====================

  async getMatch(matchId: string): Promise<MatchWithDetails | null> {
    const [match] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, matchId));
    if (!match) return null;

    // Obtener participantes con detalles
    let participant1 = null;
    let participant2 = null;

    if (match.participant1Id) {
      const [p1Data] = await db.select({
        participant: tournamentParticipants,
        student: {
          id: studentProfiles.id,
          displayName: studentProfiles.characterName, // Usar characterName
          avatarUrl: studentProfiles.avatarUrl,
          avatarGender: studentProfiles.avatarGender,
          characterClass: studentProfiles.characterClass,
          level: studentProfiles.level,
        },
        clan: {
          id: teams.id,
          name: teams.name,
          color: teams.color,
        },
      })
        .from(tournamentParticipants)
        .leftJoin(studentProfiles, eq(tournamentParticipants.studentProfileId, studentProfiles.id))
        .leftJoin(teams, eq(tournamentParticipants.clanId, teams.id))
        .where(eq(tournamentParticipants.id, match.participant1Id));

      if (p1Data) {
        participant1 = {
          ...p1Data.participant,
          student: p1Data.student?.id ? p1Data.student : null,
          clan: p1Data.clan?.id ? p1Data.clan : null,
        };
      }
    }

    if (match.participant2Id) {
      const [p2Data] = await db.select({
        participant: tournamentParticipants,
        student: {
          id: studentProfiles.id,
          displayName: studentProfiles.characterName, // Usar characterName
          avatarUrl: studentProfiles.avatarUrl,
          avatarGender: studentProfiles.avatarGender,
          characterClass: studentProfiles.characterClass,
          level: studentProfiles.level,
        },
        clan: {
          id: teams.id,
          name: teams.name,
          color: teams.color,
        },
      })
        .from(tournamentParticipants)
        .leftJoin(studentProfiles, eq(tournamentParticipants.studentProfileId, studentProfiles.id))
        .leftJoin(teams, eq(tournamentParticipants.clanId, teams.id))
        .where(eq(tournamentParticipants.id, match.participant2Id));

      if (p2Data) {
        participant2 = {
          ...p2Data.participant,
          student: p2Data.student?.id ? p2Data.student : null,
          clan: p2Data.clan?.id ? p2Data.clan : null,
        };
      }
    }

    // Obtener pregunta actual si hay
    // El campo JSON puede venir como string o como array
    let questionIds: string[] = [];
    if (match.questionIds) {
      questionIds = typeof match.questionIds === 'string'
        ? JSON.parse(match.questionIds)
        : match.questionIds;
    }
    let currentQuestion = null;
    if (questionIds.length > 0 && match.currentQuestionIndex < questionIds.length) {
      const questionId = questionIds[match.currentQuestionIndex];
      const [q] = await db.select().from(questions).where(eq(questions.id, questionId));
      if (q) {
        // Parsear options si viene como string JSON
        let parsedOptions = q.options;
        if (typeof q.options === 'string') {
          try {
            parsedOptions = JSON.parse(q.options);
          } catch {
            parsedOptions = [];
          }
        }
        
        // Parsear correctAnswer si viene como string JSON
        let parsedCorrectAnswer = q.correctAnswer;
        if (typeof q.correctAnswer === 'string') {
          try {
            parsedCorrectAnswer = JSON.parse(q.correctAnswer);
          } catch {
            // Mantener como string si no es JSON válido
          }
        }

        currentQuestion = {
          id: q.id,
          question: q.questionText,
          questionType: q.type,
          options: parsedOptions,
          correctAnswer: parsedCorrectAnswer,
          imageUrl: q.imageUrl,
        };
      }
    }

    // Obtener respuestas del match
    const answers = await db.select()
      .from(tournamentAnswers)
      .where(eq(tournamentAnswers.matchId, matchId));

    return {
      ...match,
      participant1: participant1 || undefined,
      participant2: participant2 || undefined,
      currentQuestion: currentQuestion as any,
      answers,
    };
  }

  async startMatch(matchId: string): Promise<MatchWithDetails> {
    const match = await this.getMatch(matchId);
    if (!match) throw new Error('Match no encontrado');
    if (match.status !== 'PENDING') throw new Error('El match ya fue iniciado o completado');

    // Obtener el torneo para saber cuántas preguntas usar
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, match.tournamentId));
    if (!tournament) throw new Error('Torneo no encontrado');

    // Seleccionar preguntas aleatorias de los bancos
    // El campo JSON puede venir como string o como array
    const bankIds = typeof tournament.questionBankIds === 'string'
      ? JSON.parse(tournament.questionBankIds)
      : tournament.questionBankIds;
    const questionIds = await this.selectRandomQuestions(
      bankIds,
      tournament.questionsPerMatch
    );

    await db.update(tournamentMatches)
      .set({
        status: 'IN_PROGRESS',
        questionIds,
        currentQuestionIndex: 0,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tournamentMatches.id, matchId));

    // Actualizar estado del torneo si es necesario
    await db.update(tournaments)
      .set({ status: 'ACTIVE', updatedAt: new Date() })
      .where(eq(tournaments.id, match.tournamentId));

    return this.getMatch(matchId) as Promise<MatchWithDetails>;
  }

  private async selectRandomQuestions(bankIds: string[], count: number): Promise<string[]> {
    // Parsear bankIds si viene como string
    let parsedBankIds = bankIds;
    if (typeof bankIds === 'string') {
      try { parsedBankIds = JSON.parse(bankIds); } catch { parsedBankIds = []; }
    }
    
    if (!Array.isArray(parsedBankIds) || parsedBankIds.length === 0) {
      console.log('selectRandomQuestions: No hay bancos de preguntas válidos');
      return [];
    }

    // Obtener todas las preguntas de los bancos
    const allQuestions = await db.select({ id: questions.id })
      .from(questions)
      .where(inArray(questions.bankId, parsedBankIds));

    console.log(`selectRandomQuestions: Encontradas ${allQuestions.length} preguntas, seleccionando ${count}`);

    // Mezclar y seleccionar
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count).map(q => q.id);
    console.log(`selectRandomQuestions: Seleccionadas ${selected.length} preguntas`);
    return selected;
  }

  async submitAnswer(
    matchId: string,
    participantId: string,
    answer: string,
    timeSpent: number
  ): Promise<{ isCorrect: boolean; pointsEarned: number; answer: TournamentAnswer }> {
    const match = await this.getMatch(matchId);
    if (!match) throw new Error('Match no encontrado');
    if (match.status !== 'IN_PROGRESS') throw new Error('El match no está en progreso');
    if (!match.currentQuestion) throw new Error('No hay pregunta actual');

    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, match.tournamentId));
    if (!tournament) throw new Error('Torneo no encontrado');

    // Verificar si la respuesta es correcta
    const isCorrect = this.checkAnswer(match.currentQuestion, answer);

    // Calcular puntos
    let pointsEarned = 0;
    if (isCorrect) {
      pointsEarned = tournament.pointsPerCorrect;
      // Bonus por tiempo (si respondió en menos de la mitad del tiempo)
      if (timeSpent < tournament.timePerQuestion / 2) {
        pointsEarned += tournament.bonusTimePoints;
      }
    }

    // Guardar respuesta
    const answerId = uuidv4();
    await db.insert(tournamentAnswers).values({
      id: answerId,
      matchId,
      participantId,
      questionId: match.currentQuestion.id,
      answer,
      isCorrect,
      pointsEarned,
      timeSpent,
      answeredAt: new Date(),
    });

    // Actualizar puntuación del participante en el match
    const isParticipant1 = match.participant1Id === participantId;
    if (isParticipant1) {
      await db.update(tournamentMatches)
        .set({
          participant1Score: match.participant1Score + pointsEarned,
          updatedAt: new Date(),
        })
        .where(eq(tournamentMatches.id, matchId));
    } else {
      await db.update(tournamentMatches)
        .set({
          participant2Score: match.participant2Score + pointsEarned,
          updatedAt: new Date(),
        })
        .where(eq(tournamentMatches.id, matchId));
    }

    // Actualizar estadísticas del participante
    await db.update(tournamentParticipants)
      .set({
        totalPoints: sql`total_points + ${pointsEarned}`,
        questionsCorrect: isCorrect ? sql`questions_correct + 1` : sql`questions_correct`,
        questionsTotal: sql`questions_total + 1`,
        updatedAt: new Date(),
      })
      .where(eq(tournamentParticipants.id, participantId));

    const [savedAnswer] = await db.select().from(tournamentAnswers).where(eq(tournamentAnswers.id, answerId));

    return { isCorrect, pointsEarned, answer: savedAnswer };
  }

  private checkAnswer(question: any, answer: string): boolean {
    // El frontend ahora envía el índice de la respuesta seleccionada
    const answerIndex = parseInt(answer, 10);
    
    // Parsear opciones
    let options = question.options;
    if (typeof options === 'string') {
      try { options = JSON.parse(options); } catch { options = []; }
    }

    switch (question.questionType) {
      case 'TRUE_FALSE': {
        // Para TRUE_FALSE, el índice 0 = Verdadero, 1 = Falso
        let correctAnswer = question.correctAnswer;
        if (typeof correctAnswer === 'string') {
          try { correctAnswer = JSON.parse(correctAnswer); } catch { }
        }
        const correctIsTrue = correctAnswer === true || correctAnswer === 'true';
        return (answerIndex === 0) === correctIsTrue;
      }
      
      case 'SINGLE_CHOICE': {
        // Buscar la opción con isCorrect: true
        if (Array.isArray(options)) {
          const correctIdx = options.findIndex((o: any) => o.isCorrect === true);
          return answerIndex === correctIdx;
        }
        return false;
      }
      
      case 'MULTIPLE_CHOICE': {
        // Para múltiple choice, verificar si el índice seleccionado es una de las correctas
        if (Array.isArray(options)) {
          const opt = options[answerIndex];
          return opt?.isCorrect === true;
        }
        return false;
      }
      
      case 'MATCHING': {
        // Para matching, el frontend enviará un JSON con los pares
        try {
          const givenPairs = JSON.parse(answer);
          let correctPairs = question.pairs;
          if (typeof correctPairs === 'string') {
            correctPairs = JSON.parse(correctPairs);
          }
          // Verificar que todos los pares coincidan
          if (!Array.isArray(givenPairs) || !Array.isArray(correctPairs)) return false;
          let correctCount = 0;
          for (const given of givenPairs) {
            if (correctPairs.some((c: any) => c.left === given.left && c.right === given.right)) {
              correctCount++;
            }
          }
          return correctCount === correctPairs.length;
        } catch {
          return false;
        }
      }
      
      default:
        return false;
    }
  }

  async nextQuestion(matchId: string): Promise<{ match: MatchWithDetails | null; completed: boolean }> {
    const match = await this.getMatch(matchId);
    if (!match) throw new Error('Match no encontrado');
    
    // Parsear questionIds si viene como string
    let questionIds = match.questionIds;
    if (typeof questionIds === 'string') {
      try { questionIds = JSON.parse(questionIds); } catch { questionIds = []; }
    }
    if (!questionIds || !Array.isArray(questionIds)) throw new Error('No hay preguntas en el match');

    const nextIndex = match.currentQuestionIndex + 1;

    if (nextIndex >= questionIds.length) {
      // No hay más preguntas, indicar que debe completarse
      return { match: null, completed: true };
    }

    await db.update(tournamentMatches)
      .set({
        currentQuestionIndex: nextIndex,
        updatedAt: new Date(),
      })
      .where(eq(tournamentMatches.id, matchId));

    const updatedMatch = await this.getMatch(matchId);
    return { match: updatedMatch, completed: false };
  }

  async completeMatch(matchId: string): Promise<MatchWithDetails> {
    const match = await this.getMatch(matchId);
    if (!match) throw new Error('Match no encontrado');

    // Determinar ganador por puntuación
    let winnerId: string | null = null;
    if (match.participant1Score > match.participant2Score) {
      winnerId = match.participant1Id;
    } else if (match.participant2Score > match.participant1Score) {
      winnerId = match.participant2Id;
    } else {
      // Empate: gana el que respondió más rápido en promedio
      // Por simplicidad, elegimos al participante 1
      winnerId = match.participant1Id;
    }

    await db.update(tournamentMatches)
      .set({
        status: 'COMPLETED',
        winnerId,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tournamentMatches.id, matchId));

    // Actualizar estadísticas de participantes
    if (winnerId) {
      const loserId = winnerId === match.participant1Id ? match.participant2Id : match.participant1Id;

      await db.update(tournamentParticipants)
        .set({
          matchesWon: sql`matches_won + 1`,
          updatedAt: new Date(),
        })
        .where(eq(tournamentParticipants.id, winnerId));

      if (loserId) {
        await db.update(tournamentParticipants)
          .set({
            matchesLost: sql`matches_lost + 1`,
            isEliminated: true,
            eliminatedInRound: match.round,
            updatedAt: new Date(),
          })
          .where(eq(tournamentParticipants.id, loserId));
      }
    }

    // Avanzar ganador a la siguiente ronda
    if (winnerId) {
      await this.advanceWinner(matchId, winnerId);
    }

    // Verificar si el torneo terminó
    await this.checkTournamentCompletion(match.tournamentId);

    return this.getMatch(matchId) as Promise<MatchWithDetails>;
  }

  private async advanceWinner(matchId: string, winnerId: string): Promise<void> {
    const [match] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, matchId));
    if (!match) return;

    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, match.tournamentId));
    if (!tournament) return;

    // Si es la final, no hay siguiente ronda
    if (match.round >= tournament.totalRounds) return;

    // Encontrar el match de la siguiente ronda
    const nextRound = match.round + 1;
    const nextMatchNumber = Math.ceil(match.matchNumber / 2);

    const [nextMatch] = await db.select()
      .from(tournamentMatches)
      .where(and(
        eq(tournamentMatches.tournamentId, match.tournamentId),
        eq(tournamentMatches.round, nextRound),
        eq(tournamentMatches.matchNumber, nextMatchNumber)
      ));

    if (nextMatch) {
      // Determinar si va como participante 1 o 2
      const isOddMatch = match.matchNumber % 2 === 1;
      const updateField = isOddMatch ? 'participant1Id' : 'participant2Id';

      await db.update(tournamentMatches)
        .set({
          [updateField]: winnerId,
          updatedAt: new Date(),
        })
        .where(eq(tournamentMatches.id, nextMatch.id));
    }
  }

  private async checkTournamentCompletion(tournamentId: string): Promise<void> {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
    if (!tournament) return;

    // Buscar la final
    const [finalMatch] = await db.select()
      .from(tournamentMatches)
      .where(and(
        eq(tournamentMatches.tournamentId, tournamentId),
        eq(tournamentMatches.round, tournament.totalRounds)
      ));

    if (finalMatch && finalMatch.status === 'COMPLETED' && finalMatch.winnerId) {
      // El torneo terminó
      const firstPlaceId = finalMatch.winnerId;
      const secondPlaceId = finalMatch.winnerId === finalMatch.participant1Id 
        ? finalMatch.participant2Id 
        : finalMatch.participant1Id;

      // Buscar tercer lugar (perdedor de semifinales con más puntos)
      const semiFinals = await db.select()
        .from(tournamentMatches)
        .where(and(
          eq(tournamentMatches.tournamentId, tournamentId),
          eq(tournamentMatches.round, tournament.totalRounds - 1),
          eq(tournamentMatches.status, 'COMPLETED')
        ));

      let thirdPlaceId: string | null = null;
      let maxPoints = -1;
      for (const sf of semiFinals) {
        const loserId = sf.winnerId === sf.participant1Id ? sf.participant2Id : sf.participant1Id;
        if (loserId) {
          const [loser] = await db.select().from(tournamentParticipants).where(eq(tournamentParticipants.id, loserId));
          if (loser && loser.totalPoints > maxPoints) {
            maxPoints = loser.totalPoints;
            thirdPlaceId = loserId;
          }
        }
      }

      // Actualizar posiciones finales
      if (firstPlaceId) {
        await db.update(tournamentParticipants)
          .set({ finalPosition: 1, updatedAt: new Date() })
          .where(eq(tournamentParticipants.id, firstPlaceId));
      }
      if (secondPlaceId) {
        await db.update(tournamentParticipants)
          .set({ finalPosition: 2, updatedAt: new Date() })
          .where(eq(tournamentParticipants.id, secondPlaceId));
      }
      if (thirdPlaceId) {
        await db.update(tournamentParticipants)
          .set({ finalPosition: 3, updatedAt: new Date() })
          .where(eq(tournamentParticipants.id, thirdPlaceId));
      }

      // Actualizar torneo
      await db.update(tournaments)
        .set({
          status: 'FINISHED',
          firstPlaceId,
          secondPlaceId,
          thirdPlaceId,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tournaments.id, tournamentId));

      // Otorgar recompensas
      await this.grantRewards(tournamentId);
    }
  }

  private async grantRewards(tournamentId: string): Promise<void> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament || !tournament.participants) return;

    const now = new Date();

    for (const participant of tournament.participants) {
      let xpReward = tournament.rewardXpParticipation;
      let gpReward = 0;
      let notificationTitle = '🏆 Torneo finalizado';
      let notificationMessage = `Participaste en el torneo "${tournament.name}"`;

      if (participant.finalPosition === 1) {
        xpReward = tournament.rewardXpFirst;
        gpReward = tournament.rewardGpFirst;
        notificationTitle = '🥇 ¡Campeón del Torneo!';
        notificationMessage = `¡Ganaste el torneo "${tournament.name}"! +${xpReward} XP, +${gpReward} GP`;
      } else if (participant.finalPosition === 2) {
        xpReward = tournament.rewardXpSecond;
        gpReward = tournament.rewardGpSecond;
        notificationTitle = '🥈 ¡Segundo lugar!';
        notificationMessage = `Obtuviste el segundo lugar en "${tournament.name}". +${xpReward} XP, +${gpReward} GP`;
      } else if (participant.finalPosition === 3) {
        xpReward = tournament.rewardXpThird;
        gpReward = tournament.rewardGpThird;
        notificationTitle = '🥉 ¡Tercer lugar!';
        notificationMessage = `Obtuviste el tercer lugar en "${tournament.name}". +${xpReward} XP, +${gpReward} GP`;
      }

      // Solo dar recompensas a participantes individuales (no clanes por ahora)
      if (participant.studentProfileId && participant.student) {
        // Actualizar XP y GP del estudiante
        await db.update(studentProfiles)
          .set({
            xp: sql`xp + ${xpReward}`,
            gp: sql`gp + ${gpReward}`,
            updatedAt: now,
          })
          .where(eq(studentProfiles.id, participant.studentProfileId));

        // Registrar en pointLogs
        if (xpReward > 0) {
          await db.insert(pointLogs).values({
            id: uuidv4(),
            studentId: participant.studentProfileId,
            pointType: 'XP',
            action: 'ADD',
            amount: xpReward,
            reason: `Torneo: ${tournament.name} - Posición ${participant.finalPosition || 'Participación'}`,
            createdAt: now,
          });
        }
        if (gpReward > 0) {
          await db.insert(pointLogs).values({
            id: uuidv4(),
            studentId: participant.studentProfileId,
            pointType: 'GP',
            action: 'ADD',
            amount: gpReward,
            reason: `Torneo: ${tournament.name} - Posición ${participant.finalPosition || 'Participación'}`,
            createdAt: now,
          });
        }

        // Crear notificación
        const [studentProfile] = await db.select().from(studentProfiles)
          .where(eq(studentProfiles.id, participant.studentProfileId));
        
        if (studentProfile?.userId) {
          await db.insert(notifications).values({
            id: uuidv4(),
            userId: studentProfile.userId,
            type: 'POINTS',
            title: notificationTitle,
            message: notificationMessage,
            isRead: false,
            createdAt: now,
          });
        }
      }
    }
  }

  // ==================== UTILITIES ====================

  async shuffleParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
    const participants = await db.select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournamentId));

    // Mezclar aleatoriamente
    const shuffled = participants.sort(() => Math.random() - 0.5);

    // Actualizar seeds
    for (let i = 0; i < shuffled.length; i++) {
      await db.update(tournamentParticipants)
        .set({ seed: i + 1, updatedAt: new Date() })
        .where(eq(tournamentParticipants.id, shuffled[i].id));
    }

    return db.select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournamentId))
      .orderBy(asc(tournamentParticipants.seed));
  }
}

export const tournamentService = new TournamentService();
