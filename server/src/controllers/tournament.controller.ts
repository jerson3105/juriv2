import { Request, Response } from 'express';
import { tournamentService } from '../services/tournament.service.js';

// ==================== CRUD TORNEOS ====================

export const createTournament = async (req: Request, res: Response) => {
  try {
    const { classroomId } = req.params;
    const data = req.body;

    const tournament = await tournamentService.createTournament(classroomId, data);
    res.status(201).json(tournament);
  } catch (error: any) {
    console.error('Error creating tournament:', error);
    res.status(500).json({ error: error.message || 'Error al crear el torneo' });
  }
};

export const updateTournament = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const data = req.body;

    const tournament = await tournamentService.updateTournament(tournamentId, data);
    res.json(tournament);
  } catch (error: any) {
    console.error('Error updating tournament:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar el torneo' });
  }
};

export const deleteTournament = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    await tournamentService.deleteTournament(tournamentId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting tournament:', error);
    res.status(500).json({ error: error.message || 'Error al eliminar el torneo' });
  }
};

export const getTournament = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Torneo no encontrado' });
    }
    res.json(tournament);
  } catch (error: any) {
    console.error('Error getting tournament:', error);
    res.status(500).json({ error: error.message || 'Error al obtener el torneo' });
  }
};

export const getTournamentsByClassroom = async (req: Request, res: Response) => {
  try {
    const { classroomId } = req.params;

    const tournaments = await tournamentService.getTournamentsByClassroom(classroomId);
    res.json(tournaments);
  } catch (error: any) {
    console.error('Error getting tournaments:', error);
    res.status(500).json({ error: error.message || 'Error al obtener los torneos' });
  }
};

// ==================== PARTICIPANTES ====================

export const addParticipant = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { participantId, isIndividual } = req.body;

    const participant = await tournamentService.addParticipant(
      tournamentId,
      participantId,
      isIndividual !== false
    );
    res.status(201).json(participant);
  } catch (error: any) {
    console.error('Error adding participant:', error);
    res.status(500).json({ error: error.message || 'Error al agregar participante' });
  }
};

export const addMultipleParticipants = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { participantIds, isIndividual } = req.body;

    const participants = await tournamentService.addMultipleParticipants(
      tournamentId,
      participantIds,
      isIndividual !== false
    );
    res.status(201).json(participants);
  } catch (error: any) {
    console.error('Error adding participants:', error);
    res.status(500).json({ error: error.message || 'Error al agregar participantes' });
  }
};

export const removeParticipant = async (req: Request, res: Response) => {
  try {
    const { participantId } = req.params;

    await tournamentService.removeParticipant(participantId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing participant:', error);
    res.status(500).json({ error: error.message || 'Error al eliminar participante' });
  }
};

export const shuffleParticipants = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    const participants = await tournamentService.shuffleParticipants(tournamentId);
    res.json(participants);
  } catch (error: any) {
    console.error('Error shuffling participants:', error);
    res.status(500).json({ error: error.message || 'Error al mezclar participantes' });
  }
};

// ==================== BRACKET ====================

export const generateBracket = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    const matches = await tournamentService.generateBracket(tournamentId);
    res.json(matches);
  } catch (error: any) {
    console.error('Error generating bracket:', error);
    res.status(500).json({ error: error.message || 'Error al generar el bracket' });
  }
};

// ==================== MATCHES ====================

export const getMatch = async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;

    const match = await tournamentService.getMatch(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match no encontrado' });
    }
    res.json(match);
  } catch (error: any) {
    console.error('Error getting match:', error);
    res.status(500).json({ error: error.message || 'Error al obtener el match' });
  }
};

export const startMatch = async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;

    const match = await tournamentService.startMatch(matchId);
    res.json(match);
  } catch (error: any) {
    console.error('Error starting match:', error);
    res.status(500).json({ error: error.message || 'Error al iniciar el match' });
  }
};

export const submitAnswer = async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;
    const { participantId, answer, timeSpent } = req.body;

    const result = await tournamentService.submitAnswer(
      matchId,
      participantId,
      answer,
      timeSpent || 0
    );
    res.json(result);
  } catch (error: any) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: error.message || 'Error al enviar respuesta' });
  }
};

export const nextQuestion = async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;

    const result = await tournamentService.nextQuestion(matchId);
    if (result.completed) {
      // No hay más preguntas, el match debe completarse
      return res.json({ completed: true, message: 'No hay más preguntas' });
    }
    res.json({ ...result.match, completed: false });
  } catch (error: any) {
    console.error('Error getting next question:', error);
    res.status(500).json({ error: error.message || 'Error al obtener siguiente pregunta' });
  }
};

export const completeMatch = async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;

    const match = await tournamentService.completeMatch(matchId);
    res.json(match);
  } catch (error: any) {
    console.error('Error completing match:', error);
    res.status(500).json({ error: error.message || 'Error al completar el match' });
  }
};
