import { Request, Response } from 'express';
import { territoryService } from '../services/territory.service.js';

export class TerritoryController {
  // ==================== MAPAS ====================

  async createMap(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const data = req.body;

      const map = await territoryService.createMap({
        classroomId,
        ...data,
      });

      res.status(201).json(map);
    } catch (error: any) {
      console.error('Error creating territory map:', error);
      res.status(500).json({ error: error.message || 'Error al crear el mapa' });
    }
  }

  async getClassroomMaps(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const maps = await territoryService.getClassroomMaps(classroomId);
      res.json(maps);
    } catch (error: any) {
      console.error('Error getting classroom maps:', error);
      res.status(500).json({ error: error.message || 'Error al obtener mapas' });
    }
  }

  async getMap(req: Request, res: Response) {
    try {
      const { mapId } = req.params;
      const map = await territoryService.getMapById(mapId);

      if (!map) {
        return res.status(404).json({ error: 'Mapa no encontrado' });
      }

      res.json(map);
    } catch (error: any) {
      console.error('Error getting map:', error);
      res.status(500).json({ error: error.message || 'Error al obtener el mapa' });
    }
  }

  async updateMap(req: Request, res: Response) {
    try {
      const { mapId } = req.params;
      const data = req.body;

      const map = await territoryService.updateMap(mapId, data);
      res.json(map);
    } catch (error: any) {
      console.error('Error updating map:', error);
      res.status(500).json({ error: error.message || 'Error al actualizar el mapa' });
    }
  }

  async deleteMap(req: Request, res: Response) {
    try {
      const { mapId } = req.params;
      await territoryService.deleteMap(mapId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting map:', error);
      res.status(500).json({ error: error.message || 'Error al eliminar el mapa' });
    }
  }

  // ==================== TERRITORIOS ====================

  async createTerritory(req: Request, res: Response) {
    try {
      const { mapId } = req.params;
      const data = req.body;

      const territory = await territoryService.createTerritory({
        mapId,
        ...data,
      });

      res.status(201).json(territory);
    } catch (error: any) {
      console.error('Error creating territory:', error);
      res.status(500).json({ error: error.message || 'Error al crear el territorio' });
    }
  }

  async createTerritoriesBatch(req: Request, res: Response) {
    try {
      const { mapId } = req.params;
      const { territories } = req.body;

      const createdIds = await territoryService.createTerritoriesForMap(mapId, territories);
      res.status(201).json({ createdIds });
    } catch (error: any) {
      console.error('Error creating territories batch:', error);
      res.status(500).json({ error: error.message || 'Error al crear territorios' });
    }
  }

  async updateTerritory(req: Request, res: Response) {
    try {
      const { territoryId } = req.params;
      const data = req.body;

      const territory = await territoryService.updateTerritory(territoryId, data);
      res.json(territory);
    } catch (error: any) {
      console.error('Error updating territory:', error);
      res.status(500).json({ error: error.message || 'Error al actualizar el territorio' });
    }
  }

  async deleteTerritory(req: Request, res: Response) {
    try {
      const { territoryId } = req.params;
      await territoryService.deleteTerritory(territoryId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting territory:', error);
      res.status(500).json({ error: error.message || 'Error al eliminar el territorio' });
    }
  }

  // ==================== JUEGOS/SESIONES ====================

  async createGame(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const data = req.body;

      const game = await territoryService.createGame({
        classroomId,
        ...data,
      });

      res.status(201).json(game);
    } catch (error: any) {
      console.error('Error creating game:', error);
      res.status(500).json({ error: error.message || 'Error al crear el juego' });
    }
  }

  async getClassroomGames(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const games = await territoryService.getClassroomGames(classroomId);
      res.json(games);
    } catch (error: any) {
      console.error('Error getting classroom games:', error);
      res.status(500).json({ error: error.message || 'Error al obtener juegos' });
    }
  }

  async getGame(req: Request, res: Response) {
    try {
      const { gameId } = req.params;
      const game = await territoryService.getGameById(gameId);

      if (!game) {
        return res.status(404).json({ error: 'Juego no encontrado' });
      }

      res.json(game);
    } catch (error: any) {
      console.error('Error getting game:', error);
      res.status(500).json({ error: error.message || 'Error al obtener el juego' });
    }
  }

  async getActiveGame(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const game = await territoryService.getActiveGame(classroomId);
      res.json(game);
    } catch (error: any) {
      console.error('Error getting active game:', error);
      res.status(500).json({ error: error.message || 'Error al obtener juego activo' });
    }
  }

  async getGameState(req: Request, res: Response) {
    try {
      const { gameId } = req.params;
      const state = await territoryService.getGameState(gameId);

      if (!state) {
        return res.status(404).json({ error: 'Juego no encontrado' });
      }

      res.json(state);
    } catch (error: any) {
      console.error('Error getting game state:', error);
      res.status(500).json({ error: error.message || 'Error al obtener estado del juego' });
    }
  }

  async startGame(req: Request, res: Response) {
    try {
      const { gameId } = req.params;
      const game = await territoryService.startGame(gameId);
      res.json(game);
    } catch (error: any) {
      console.error('Error starting game:', error);
      res.status(500).json({ error: error.message || 'Error al iniciar el juego' });
    }
  }

  async pauseGame(req: Request, res: Response) {
    try {
      const { gameId } = req.params;
      const game = await territoryService.pauseGame(gameId);
      res.json(game);
    } catch (error: any) {
      console.error('Error pausing game:', error);
      res.status(500).json({ error: error.message || 'Error al pausar el juego' });
    }
  }

  async resumeGame(req: Request, res: Response) {
    try {
      const { gameId } = req.params;
      const game = await territoryService.resumeGame(gameId);
      res.json(game);
    } catch (error: any) {
      console.error('Error resuming game:', error);
      res.status(500).json({ error: error.message || 'Error al reanudar el juego' });
    }
  }

  async finishGame(req: Request, res: Response) {
    try {
      const { gameId } = req.params;
      const results = await territoryService.finishGame(gameId);
      res.json(results);
    } catch (error: any) {
      console.error('Error finishing game:', error);
      res.status(500).json({ error: error.message || 'Error al finalizar el juego' });
    }
  }

  async getGameResults(req: Request, res: Response) {
    try {
      const { gameId } = req.params;
      const results = await territoryService.getGameResults(gameId);

      if (!results) {
        return res.status(404).json({ error: 'Juego no encontrado' });
      }

      res.json(results);
    } catch (error: any) {
      console.error('Error getting game results:', error);
      res.status(500).json({ error: error.message || 'Error al obtener resultados' });
    }
  }

  // ==================== DESAFÍOS/CONQUISTAS ====================

  async initiateConquest(req: Request, res: Response) {
    try {
      const { gameId } = req.params;
      const { territoryId, challengerClanId } = req.body;

      const challenge = await territoryService.initiateConquest(
        gameId,
        territoryId,
        challengerClanId
      );

      res.status(201).json(challenge);
    } catch (error: any) {
      console.error('Error initiating conquest:', error);
      res.status(400).json({ error: error.message || 'Error al iniciar conquista' });
    }
  }

  async initiateDefenseChallenge(req: Request, res: Response) {
    try {
      const { gameId } = req.params;
      const { territoryId, challengerClanId } = req.body;

      const challenge = await territoryService.initiateDefenseChallenge(
        gameId,
        territoryId,
        challengerClanId
      );

      res.status(201).json(challenge);
    } catch (error: any) {
      console.error('Error initiating defense challenge:', error);
      res.status(400).json({ error: error.message || 'Error al iniciar desafío' });
    }
  }

  async resolveChallenge(req: Request, res: Response) {
    try {
      const { challengeId } = req.params;
      const { isCorrect, respondentStudentId, timeSpent } = req.body;

      const game = await territoryService.resolveChallenge({
        challengeId,
        isCorrect,
        respondentStudentId,
        timeSpent,
      });

      res.json(game);
    } catch (error: any) {
      console.error('Error resolving challenge:', error);
      res.status(400).json({ error: error.message || 'Error al resolver desafío' });
    }
  }

  async getChallengeHistory(req: Request, res: Response) {
    try {
      const { gameId } = req.params;
      const history = await territoryService.getChallengeHistory(gameId);
      res.json(history);
    } catch (error: any) {
      console.error('Error getting challenge history:', error);
      res.status(500).json({ error: error.message || 'Error al obtener historial' });
    }
  }
}

export const territoryController = new TerritoryController();
