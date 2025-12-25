import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createTournament,
  updateTournament,
  deleteTournament,
  getTournament,
  getTournamentsByClassroom,
  addParticipant,
  addMultipleParticipants,
  removeParticipant,
  shuffleParticipants,
  generateBracket,
  getMatch,
  startMatch,
  submitAnswer,
  nextQuestion,
  completeMatch,
} from '../controllers/tournament.controller.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ==================== TORNEOS ====================

// Obtener torneos de una clase
router.get('/classroom/:classroomId', authorize('TEACHER', 'ADMIN'), getTournamentsByClassroom);

// Crear torneo
router.post('/classroom/:classroomId', authorize('TEACHER', 'ADMIN'), createTournament);

// Obtener torneo específico
router.get('/:tournamentId', getTournament);

// Actualizar torneo
router.put('/:tournamentId', authorize('TEACHER', 'ADMIN'), updateTournament);

// Eliminar torneo
router.delete('/:tournamentId', authorize('TEACHER', 'ADMIN'), deleteTournament);

// ==================== PARTICIPANTES ====================

// Agregar participante
router.post('/:tournamentId/participants', authorize('TEACHER', 'ADMIN'), addParticipant);

// Agregar múltiples participantes
router.post('/:tournamentId/participants/bulk', authorize('TEACHER', 'ADMIN'), addMultipleParticipants);

// Eliminar participante
router.delete('/participants/:participantId', authorize('TEACHER', 'ADMIN'), removeParticipant);

// Mezclar participantes (shuffle)
router.post('/:tournamentId/shuffle', authorize('TEACHER', 'ADMIN'), shuffleParticipants);

// ==================== BRACKET ====================

// Generar bracket
router.post('/:tournamentId/bracket', authorize('TEACHER', 'ADMIN'), generateBracket);

// ==================== MATCHES ====================

// Obtener match
router.get('/matches/:matchId', getMatch);

// Iniciar match
router.post('/matches/:matchId/start', authorize('TEACHER', 'ADMIN'), startMatch);

// Enviar respuesta
router.post('/matches/:matchId/answer', authorize('TEACHER', 'ADMIN'), submitAnswer);

// Siguiente pregunta
router.post('/matches/:matchId/next', authorize('TEACHER', 'ADMIN'), nextQuestion);

// Completar match
router.post('/matches/:matchId/complete', authorize('TEACHER', 'ADMIN'), completeMatch);

export default router;
