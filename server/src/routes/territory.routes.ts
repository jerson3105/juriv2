import { Router } from 'express';
import { territoryController } from '../controllers/territory.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ==================== MAPAS ====================

// Crear mapa (solo profesores)
router.post(
  '/classrooms/:classroomId/maps',
  authorize('TEACHER'),
  territoryController.createMap.bind(territoryController)
);

// Obtener mapas de una clase
router.get(
  '/classrooms/:classroomId/maps',
  territoryController.getClassroomMaps.bind(territoryController)
);

// Obtener un mapa específico
router.get(
  '/maps/:mapId',
  territoryController.getMap.bind(territoryController)
);

// Actualizar mapa (solo profesores)
router.put(
  '/maps/:mapId',
  authorize('TEACHER'),
  territoryController.updateMap.bind(territoryController)
);

// Eliminar mapa (solo profesores)
router.delete(
  '/maps/:mapId',
  authorize('TEACHER'),
  territoryController.deleteMap.bind(territoryController)
);

// ==================== TERRITORIOS ====================

// Crear territorio en un mapa (solo profesores)
router.post(
  '/maps/:mapId/territories',
  authorize('TEACHER'),
  territoryController.createTerritory.bind(territoryController)
);

// Crear múltiples territorios (solo profesores)
router.post(
  '/maps/:mapId/territories/batch',
  authorize('TEACHER'),
  territoryController.createTerritoriesBatch.bind(territoryController)
);

// Actualizar territorio (solo profesores)
router.put(
  '/territories/:territoryId',
  authorize('TEACHER'),
  territoryController.updateTerritory.bind(territoryController)
);

// Eliminar territorio (solo profesores)
router.delete(
  '/territories/:territoryId',
  authorize('TEACHER'),
  territoryController.deleteTerritory.bind(territoryController)
);

// ==================== JUEGOS/SESIONES ====================

// Crear juego (solo profesores)
router.post(
  '/classrooms/:classroomId/games',
  authorize('TEACHER'),
  territoryController.createGame.bind(territoryController)
);

// Obtener juegos de una clase
router.get(
  '/classrooms/:classroomId/games',
  territoryController.getClassroomGames.bind(territoryController)
);

// Obtener juego activo de una clase
router.get(
  '/classrooms/:classroomId/games/active',
  territoryController.getActiveGame.bind(territoryController)
);

// Obtener un juego específico
router.get(
  '/games/:gameId',
  territoryController.getGame.bind(territoryController)
);

// Obtener estado del juego (para vista en tiempo real)
router.get(
  '/games/:gameId/state',
  territoryController.getGameState.bind(territoryController)
);

// Iniciar juego (solo profesores)
router.post(
  '/games/:gameId/start',
  authorize('TEACHER'),
  territoryController.startGame.bind(territoryController)
);

// Pausar juego (solo profesores)
router.post(
  '/games/:gameId/pause',
  authorize('TEACHER'),
  territoryController.pauseGame.bind(territoryController)
);

// Reanudar juego (solo profesores)
router.post(
  '/games/:gameId/resume',
  authorize('TEACHER'),
  territoryController.resumeGame.bind(territoryController)
);

// Finalizar juego (solo profesores)
router.post(
  '/games/:gameId/finish',
  authorize('TEACHER'),
  territoryController.finishGame.bind(territoryController)
);

// Obtener resultados del juego
router.get(
  '/games/:gameId/results',
  territoryController.getGameResults.bind(territoryController)
);

// ==================== DESAFÍOS/CONQUISTAS ====================

// Iniciar conquista de territorio neutral (solo profesores)
router.post(
  '/games/:gameId/conquest',
  authorize('TEACHER'),
  territoryController.initiateConquest.bind(territoryController)
);

// Iniciar desafío de territorio ocupado (solo profesores)
router.post(
  '/games/:gameId/challenge',
  authorize('TEACHER'),
  territoryController.initiateDefenseChallenge.bind(territoryController)
);

// Resolver desafío (solo profesores)
router.post(
  '/challenges/:challengeId/resolve',
  authorize('TEACHER'),
  territoryController.resolveChallenge.bind(territoryController)
);

// Obtener historial de desafíos
router.get(
  '/games/:gameId/challenges',
  territoryController.getChallengeHistory.bind(territoryController)
);

export default router;
