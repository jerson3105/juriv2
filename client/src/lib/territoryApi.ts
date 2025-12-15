import api from './api';

// ==================== TIPOS ====================

export interface TerritoryMap {
  id: string;
  classroomId: string;
  name: string;
  description: string | null;
  backgroundImage: string | null;
  gridCols: number;
  gridRows: number;
  baseConquestPoints: number;
  baseDefensePoints: number;
  bonusStreakPoints: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  territories?: Territory[];
}

export interface Territory {
  id: string;
  mapId: string;
  name: string;
  description: string | null;
  gridX: number;
  gridY: number;
  icon: string;
  color: string;
  pointMultiplier: number;
  isStrategic: boolean;
  adjacentTerritories: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TerritoryGame {
  id: string;
  classroomId: string;
  mapId: string;
  name: string;
  questionBankIds: string[];
  participatingClanIds: string[];
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'FINISHED';
  maxRounds: number | null;
  currentRound: number;
  timePerQuestion: number;
  totalChallenges: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  map?: TerritoryMap;
  states?: TerritoryGameState[];
  clanScores?: TerritoryGameClanScore[];
  clans?: ClanInfo[];
}

export interface TerritoryGameState {
  id: string;
  gameId: string;
  territoryId: string;
  status: 'NEUTRAL' | 'OWNED' | 'CONTESTED';
  ownerClanId: string | null;
  conqueredAt: string | null;
  timesContested: number;
  timesChanged: number;
  lastChallengerId: string | null;
  lastChallengeAt: string | null;
  updatedAt: string;
}

export interface TerritoryGameClanScore {
  id: string;
  gameId: string;
  clanId: string;
  totalPoints: number;
  territoriesOwned: number;
  territoriesConquered: number;
  territoriesLost: number;
  successfulDefenses: number;
  failedDefenses: number;
  currentStreak: number;
  bestStreak: number;
  updatedAt: string;
}

export interface ClanInfo {
  id: string;
  name: string;
  color: string;
  emblem: string;
}

export interface TerritoryWithState extends Territory {
  status: 'NEUTRAL' | 'OWNED' | 'CONTESTED';
  ownerClan: ClanInfo | null;
}

export interface GameState {
  game: {
    id: string;
    name: string;
    status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'FINISHED';
    currentRound: number;
    maxRounds: number | null;
    totalChallenges: number;
    timePerQuestion: number;
    startedAt: string | null;
  };
  map: {
    id: string;
    name: string;
    gridCols: number;
    gridRows: number;
    backgroundImage: string | null;
  };
  territories: TerritoryWithState[];
  ranking: Array<TerritoryGameClanScore & { clan: ClanInfo | null }>;
  clans: ClanInfo[];
  questionStats?: {
    current: number;
    uniqueUsed: number;
    total: number;
  };
  pendingChallenge?: ChallengeData | null;
}

export interface ChallengeQuestion {
  id: string;
  text: string;
  type: 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'MATCHING';
  options: any;
  imageUrl: string | null;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

export interface ChallengeData {
  challengeId: string;
  question: ChallengeQuestion;
  territory: Territory;
  challengerClan: ClanInfo;
  defenderClan?: ClanInfo;
}

export interface ChallengeHistory {
  id: string;
  challengeType: 'CONQUEST' | 'DEFENSE';
  result: 'PENDING' | 'CORRECT' | 'INCORRECT';
  pointsAwarded: number;
  xpToStudent: number;
  xpToClan: number;
  timeSpent: number | null;
  startedAt: string;
  answeredAt: string | null;
  territoryName: string;
  territoryIcon: string;
  challengerClanName: string;
  challengerClanColor: string;
}

export interface GameResults {
  game: TerritoryGame;
  ranking: Array<{
    clanId: string;
    totalPoints: number;
    territoriesOwned: number;
    territoriesConquered: number;
    territoriesLost: number;
    successfulDefenses: number;
    failedDefenses: number;
    bestStreak: number;
    clanName: string;
    clanColor: string;
    clanEmblem: string;
  }>;
  winner: {
    clanId: string;
    clanName: string;
    clanColor: string;
    clanEmblem: string;
    totalPoints: number;
  } | null;
}

// ==================== DATOS DE CREACIÓN ====================

export interface CreateMapData {
  name: string;
  description?: string;
  backgroundImage?: string;
  gridCols?: number;
  gridRows?: number;
  baseConquestPoints?: number;
  baseDefensePoints?: number;
  bonusStreakPoints?: number;
}

export interface CreateTerritoryData {
  name: string;
  description?: string;
  gridX: number;
  gridY: number;
  icon?: string;
  color?: string;
  pointMultiplier?: number;
  isStrategic?: boolean;
}

export interface CreateGameData {
  mapId: string;
  name: string;
  questionBankIds: string[];
  participatingClanIds: string[];
  maxRounds?: number;
  timePerQuestion?: number;
}

// ==================== API FUNCTIONS ====================

// Mapas
export const createMap = async (classroomId: string, data: CreateMapData): Promise<TerritoryMap> => {
  const response = await api.post(`/territory/classrooms/${classroomId}/maps`, data);
  return response.data;
};

export const getClassroomMaps = async (classroomId: string): Promise<TerritoryMap[]> => {
  const response = await api.get(`/territory/classrooms/${classroomId}/maps`);
  return response.data;
};

export const getMap = async (mapId: string): Promise<TerritoryMap> => {
  const response = await api.get(`/territory/maps/${mapId}`);
  return response.data;
};

export const updateMap = async (mapId: string, data: Partial<CreateMapData>): Promise<TerritoryMap> => {
  const response = await api.put(`/territory/maps/${mapId}`, data);
  return response.data;
};

export const deleteMap = async (mapId: string): Promise<void> => {
  await api.delete(`/territory/maps/${mapId}`);
};

// Territorios
export const createTerritory = async (mapId: string, data: CreateTerritoryData): Promise<Territory> => {
  const response = await api.post(`/territory/maps/${mapId}/territories`, data);
  return response.data;
};

export const createTerritoriesBatch = async (mapId: string, territories: CreateTerritoryData[]): Promise<{ createdIds: string[] }> => {
  const response = await api.post(`/territory/maps/${mapId}/territories/batch`, { territories });
  return response.data;
};

export const updateTerritory = async (territoryId: string, data: Partial<CreateTerritoryData>): Promise<Territory> => {
  const response = await api.put(`/territory/territories/${territoryId}`, data);
  return response.data;
};

export const deleteTerritory = async (territoryId: string): Promise<void> => {
  await api.delete(`/territory/territories/${territoryId}`);
};

// Juegos
export const createGame = async (classroomId: string, data: CreateGameData): Promise<TerritoryGame> => {
  const response = await api.post(`/territory/classrooms/${classroomId}/games`, data);
  return response.data;
};

export const getClassroomGames = async (classroomId: string): Promise<TerritoryGame[]> => {
  const response = await api.get(`/territory/classrooms/${classroomId}/games`);
  return response.data;
};

export const getActiveGame = async (classroomId: string): Promise<TerritoryGame | null> => {
  const response = await api.get(`/territory/classrooms/${classroomId}/games/active`);
  return response.data;
};

export const getGame = async (gameId: string): Promise<TerritoryGame> => {
  const response = await api.get(`/territory/games/${gameId}`);
  return response.data;
};

export const getGameState = async (gameId: string): Promise<GameState> => {
  const response = await api.get(`/territory/games/${gameId}/state`);
  return response.data;
};

export const startGame = async (gameId: string): Promise<TerritoryGame> => {
  const response = await api.post(`/territory/games/${gameId}/start`);
  return response.data;
};

export const pauseGame = async (gameId: string): Promise<TerritoryGame> => {
  const response = await api.post(`/territory/games/${gameId}/pause`);
  return response.data;
};

export const resumeGame = async (gameId: string): Promise<TerritoryGame> => {
  const response = await api.post(`/territory/games/${gameId}/resume`);
  return response.data;
};

export const finishGame = async (gameId: string): Promise<GameResults> => {
  const response = await api.post(`/territory/games/${gameId}/finish`);
  return response.data;
};

export const getGameResults = async (gameId: string): Promise<GameResults> => {
  const response = await api.get(`/territory/games/${gameId}/results`);
  return response.data;
};

// Desafíos
export const initiateConquest = async (
  gameId: string,
  territoryId: string,
  challengerClanId: string
): Promise<ChallengeData> => {
  const response = await api.post(`/territory/games/${gameId}/conquest`, {
    territoryId,
    challengerClanId,
  });
  return response.data;
};

export const initiateDefenseChallenge = async (
  gameId: string,
  territoryId: string,
  challengerClanId: string
): Promise<ChallengeData> => {
  const response = await api.post(`/territory/games/${gameId}/challenge`, {
    territoryId,
    challengerClanId,
  });
  return response.data;
};

export const resolveChallenge = async (
  challengeId: string,
  isCorrect: boolean,
  respondentStudentId?: string,
  timeSpent?: number
): Promise<TerritoryGame> => {
  const response = await api.post(`/territory/challenges/${challengeId}/resolve`, {
    isCorrect,
    respondentStudentId,
    timeSpent,
  });
  return response.data;
};

export const getChallengeHistory = async (gameId: string): Promise<ChallengeHistory[]> => {
  const response = await api.get(`/territory/games/${gameId}/challenges`);
  return response.data;
};

// Exportar todo como objeto para conveniencia
export const territoryApi = {
  // Mapas
  createMap,
  getClassroomMaps,
  getMap,
  updateMap,
  deleteMap,
  // Territorios
  createTerritory,
  createTerritoriesBatch,
  updateTerritory,
  deleteTerritory,
  // Juegos
  createGame,
  getClassroomGames,
  getActiveGame,
  getGame,
  getGameState,
  startGame,
  pauseGame,
  resumeGame,
  finishGame,
  getGameResults,
  // Desafíos
  initiateConquest,
  initiateDefenseChallenge,
  resolveChallenge,
  getChallengeHistory,
};

export default territoryApi;
