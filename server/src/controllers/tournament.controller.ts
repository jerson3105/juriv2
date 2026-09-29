import { Request, Response } from 'express';
import { tournamentService } from '../services/tournament.service.js';
import { publicErrorMessage } from '../utils/errors.js';
import { requireClassroomTeacher, pickFields, questionBanksOwnedBy } from '../utils/access.js';

// Configuración editable de un torneo. classroomId sale de la ruta y no se puede mover;
// bracket, rondas y ganadores solo los cambian las acciones de juego.
const TOURNAMENT_FIELDS = [
  'name', 'description', 'icon', 'type', 'participantType', 'questionBankIds',
  'maxParticipants', 'timePerQuestion', 'questionsPerMatch', 'pointsPerCorrect', 'bonusTimePoints',
  'rewardXpFirst', 'rewardXpSecond', 'rewardXpThird', 'rewardGpFirst', 'rewardGpSecond',
  'rewardGpThird', 'rewardXpParticipation', 'competencyIds',
] as const;
// Bancos opcionales: se validan solo si se indican (lista vacía o ausente = sin bancos).
const banksAllowed = async (user: { id: string; role: string }, banks: unknown) =>
  banks === undefined || (Array.isArray(banks) && banks.length === 0) || questionBanksOwnedBy(user, banks);

const TOURNAMENT_STATUSES = ['DRAFT', 'READY', 'ACTIVE', 'PAUSED', 'FINISHED'];

// Acceso de profesor a la clase: ver utils/access.ts (requireClassroomTeacher).
const ensureTeacherClassroomAccess = requireClassroomTeacher;

const ensureTournamentAccess = async (
  req: Request,
  res: Response,
  tournamentId: string
): Promise<boolean> => {
  const classroomId = await tournamentService.getClassroomIdByTournament(tournamentId);
  if (!classroomId) {
    res.status(404).json({ error: 'Torneo no encontrado' });
    return false;
  }

  return ensureTeacherClassroomAccess(req, res, classroomId);
};

const ensureMatchAccess = async (
  req: Request,
  res: Response,
  matchId: string
): Promise<boolean> => {
  const classroomId = await tournamentService.getClassroomIdByMatch(matchId);
  if (!classroomId) {
    res.status(404).json({ error: 'Match no encontrado' });
    return false;
  }

  return ensureTeacherClassroomAccess(req, res, classroomId);
};

const ensureParticipantAccess = async (
  req: Request,
  res: Response,
  participantId: string
): Promise<boolean> => {
  const classroomId = await tournamentService.getClassroomIdByParticipant(participantId);
  if (!classroomId) {
    res.status(404).json({ error: 'Participante no encontrado' });
    return false;
  }

  return ensureTeacherClassroomAccess(req, res, classroomId);
};

// ==================== CRUD TORNEOS ====================

export const createTournament = async (req: Request, res: Response) => {
  try {
    const { classroomId } = req.params;
    const data = req.body;

    const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
    if (!hasAccess) return;

    const fields = pickFields(data, TOURNAMENT_FIELDS);
    if (!(await banksAllowed(req.user!, fields.questionBankIds))) {
      return res.status(403).json({ error: 'Los bancos de preguntas no pertenecen a tus clases' });
    }
    const tournament = await tournamentService.createTournament(classroomId, fields as any);
    res.status(201).json(tournament);
  } catch (error: any) {
    console.error('Error creating tournament:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al crear el torneo' });
  }
};

export const updateTournament = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const data = req.body;

    const hasAccess = await ensureTournamentAccess(req, res, tournamentId);
    if (!hasAccess) return;

    const fields: Record<string, unknown> = pickFields(data, TOURNAMENT_FIELDS);
    if (data?.status !== undefined) {
      if (!TOURNAMENT_STATUSES.includes(data.status)) {
        return res.status(400).json({ error: 'Estado de torneo inválido' });
      }
      fields.status = data.status;
    }
    if (!(await banksAllowed(req.user!, fields.questionBankIds))) {
      return res.status(403).json({ error: 'Los bancos de preguntas no pertenecen a tus clases' });
    }
    const tournament = await tournamentService.updateTournament(tournamentId, fields as any);
    res.json(tournament);
  } catch (error: any) {
    console.error('Error updating tournament:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al actualizar el torneo' });
  }
};

export const deleteTournament = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    const hasAccess = await ensureTournamentAccess(req, res, tournamentId);
    if (!hasAccess) return;

    await tournamentService.deleteTournament(tournamentId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting tournament:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al eliminar el torneo' });
  }
};

export const getTournament = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    const hasAccess = await ensureTournamentAccess(req, res, tournamentId);
    if (!hasAccess) return;

    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Torneo no encontrado' });
    }
    res.json(tournament);
  } catch (error: any) {
    console.error('Error getting tournament:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al obtener el torneo' });
  }
};

export const getTournamentsByClassroom = async (req: Request, res: Response) => {
  try {
    const { classroomId } = req.params;

    const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
    if (!hasAccess) return;

    const tournaments = await tournamentService.getTournamentsByClassroom(classroomId);
    res.json(tournaments);
  } catch (error: any) {
    console.error('Error getting tournaments:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al obtener los torneos' });
  }
};

// ==================== PARTICIPANTES ====================

export const addParticipant = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { participantId, isIndividual } = req.body;

    const hasAccess = await ensureTournamentAccess(req, res, tournamentId);
    if (!hasAccess) return;

    const participant = await tournamentService.addParticipant(
      tournamentId,
      participantId,
      isIndividual !== false
    );
    res.status(201).json(participant);
  } catch (error: any) {
    console.error('Error adding participant:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al agregar participante' });
  }
};

export const addMultipleParticipants = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { participantIds, isIndividual } = req.body;

    const hasAccess = await ensureTournamentAccess(req, res, tournamentId);
    if (!hasAccess) return;

    const participants = await tournamentService.addMultipleParticipants(
      tournamentId,
      participantIds,
      isIndividual !== false
    );
    res.status(201).json(participants);
  } catch (error: any) {
    console.error('Error adding participants:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al agregar participantes' });
  }
};

export const removeParticipant = async (req: Request, res: Response) => {
  try {
    const { participantId } = req.params;

    const hasAccess = await ensureParticipantAccess(req, res, participantId);
    if (!hasAccess) return;

    await tournamentService.removeParticipant(participantId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing participant:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al eliminar participante' });
  }
};

export const shuffleParticipants = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    const hasAccess = await ensureTournamentAccess(req, res, tournamentId);
    if (!hasAccess) return;

    const participants = await tournamentService.shuffleParticipants(tournamentId);
    res.json(participants);
  } catch (error: any) {
    console.error('Error shuffling participants:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al mezclar participantes' });
  }
};

// ==================== BRACKET ====================

export const generateBracket = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    const hasAccess = await ensureTournamentAccess(req, res, tournamentId);
    if (!hasAccess) return;

    const matches = await tournamentService.generateBracket(tournamentId);
    res.json(matches);
  } catch (error: any) {
    console.error('Error generating bracket:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al generar el bracket' });
  }
};

// ==================== MATCHES ====================

export const getMatch = async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;

    const hasAccess = await ensureMatchAccess(req, res, matchId);
    if (!hasAccess) return;

    const match = await tournamentService.getMatch(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match no encontrado' });
    }
    res.json(match);
  } catch (error: any) {
    console.error('Error getting match:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al obtener el match' });
  }
};

export const startMatch = async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;

    const hasAccess = await ensureMatchAccess(req, res, matchId);
    if (!hasAccess) return;

    const match = await tournamentService.startMatch(matchId);
    res.json(match);
  } catch (error: any) {
    console.error('Error starting match:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al iniciar el match' });
  }
};

export const submitAnswer = async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;
    const { participantId, answer, timeSpent } = req.body;

    const hasAccess = await ensureMatchAccess(req, res, matchId);
    if (!hasAccess) return;

    const result = await tournamentService.submitAnswer(
      matchId,
      participantId,
      answer,
      timeSpent || 0
    );
    res.json(result);
  } catch (error: any) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al enviar respuesta' });
  }
};

export const nextQuestion = async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;

    const hasAccess = await ensureMatchAccess(req, res, matchId);
    if (!hasAccess) return;

    const result = await tournamentService.nextQuestion(matchId);
    if (result.completed) {
      // No hay más preguntas, el match debe completarse
      return res.json({ completed: true, message: 'No hay más preguntas' });
    }
    res.json({ ...result.match, completed: false });
  } catch (error: any) {
    console.error('Error getting next question:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al obtener siguiente pregunta' });
  }
};

export const completeMatch = async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;

    const hasAccess = await ensureMatchAccess(req, res, matchId);
    if (!hasAccess) return;

    const match = await tournamentService.completeMatch(matchId);
    res.json(match);
  } catch (error: any) {
    console.error('Error completing match:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al completar el match' });
  }
};
