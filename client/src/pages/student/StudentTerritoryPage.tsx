import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Map,
  Trophy,
  Swords,
  Shield,
  Target,
  Flag,
  Star,
  Zap,
  Clock,
  TrendingUp,
  Crown,
  Sparkles,
  History,
  ChevronRight,
  Calendar,
  ArrowLeft,
} from 'lucide-react';
import { territoryApi } from '../../lib/territoryApi';
import type { GameResults, TerritoryGame } from '../../lib/territoryApi';
import { studentApi } from '../../lib/studentApi';
import { useStudentStore } from '../../store/studentStore';

// Iconos de emblemas de clanes
const EMBLEM_ICONS: Record<string, string> = {
  shield: '🛡️',
  sword: '⚔️',
  crown: '👑',
  dragon: '🐉',
  phoenix: '🔥',
  wolf: '🐺',
  eagle: '🦅',
  lion: '🦁',
  star: '⭐',
  flame: '🔥',
  lightning: '⚡',
  moon: '🌙',
  sun: '☀️',
  tree: '🌳',
  mountain: '⛰️',
  wave: '🌊',
};

// Medallas para posiciones
const POSITION_MEDALS = ['🥇', '🥈', '🥉'];

// Componente de resultados de partida
const GameResultsView = ({ 
  results, 
  myClanId,
  onBack 
}: { 
  results: GameResults; 
  myClanId?: string | null;
  onBack?: () => void;
}) => {
  const winner = results.winner;
  const isMyTeamWinner = winner?.clanId === myClanId;
  const myRanking = results.ranking.find(r => r.clanId === myClanId);
  const myPosition = results.ranking.findIndex(r => r.clanId === myClanId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 relative overflow-hidden">
      {/* Efectos de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-yellow-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto space-y-6">
        {/* Botón volver */}
        {onBack && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={onBack}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Volver al historial</span>
          </motion.button>
        )}

        {/* Header de resultados */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-6xl mb-4"
          >
            🏆
          </motion.div>
          <h1 className="text-4xl font-black text-white mb-2">
            ¡Batalla Finalizada!
          </h1>
          <p className="text-purple-300 text-lg">{results.game.name}</p>
        </motion.div>

        {/* Ganador */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className={`relative overflow-hidden rounded-3xl p-8 text-center ${
              isMyTeamWinner 
                ? 'bg-gradient-to-r from-yellow-500/30 to-amber-500/30 border-2 border-yellow-400/50' 
                : 'bg-white/10 border border-white/20'
            }`}
          >
            {isMyTeamWinner && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-transparent"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            )}
            <div className="relative">
              <p className="text-white/60 uppercase tracking-wider text-sm mb-3">Clan Ganador</p>
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="w-24 h-24 mx-auto rounded-2xl flex items-center justify-center text-5xl shadow-2xl mb-4"
                style={{ 
                  backgroundColor: winner.clanColor,
                  boxShadow: `0 20px 40px ${winner.clanColor}50`
                }}
              >
                {EMBLEM_ICONS[winner.clanEmblem] || '🛡️'}
              </motion.div>
              <h2 className="text-3xl font-black text-white mb-2">
                {winner.clanName}
                {isMyTeamWinner && <span className="ml-2">👑</span>}
              </h2>
              <p className="text-2xl font-bold text-yellow-400">{winner.totalPoints} puntos</p>
              {isMyTeamWinner && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-4 text-lg text-yellow-300 font-medium"
                >
                  🎉 ¡Felicidades! ¡Tu clan ha ganado!
                </motion.p>
              )}
            </div>
          </motion.div>
        )}

        {/* Mi resultado (si no gané) */}
        {myRanking && !isMyTeamWinner && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/10"
          >
            <h3 className="text-white/60 uppercase tracking-wider text-sm mb-4">Tu resultado</h3>
            <div className="flex items-center gap-4">
              <div className="text-4xl">
                {POSITION_MEDALS[myPosition] || `#${myPosition + 1}`}
              </div>
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                style={{ backgroundColor: myRanking.clanColor }}
              >
                {EMBLEM_ICONS[myRanking.clanEmblem] || '🛡️'}
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-bold text-white">{myRanking.clanName}</h4>
                <p className="text-white/60">{myRanking.totalPoints} puntos</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Ranking completo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/10"
        >
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" /> Ranking Final
          </h3>
          <div className="space-y-3">
            {results.ranking.map((clan, idx) => {
              const isMyTeam = clan.clanId === myClanId;
              return (
                <motion.div
                  key={clan.clanId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + idx * 0.1 }}
                  className={`flex items-center gap-4 p-4 rounded-2xl ${
                    isMyTeam
                      ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 ring-1 ring-yellow-400/50'
                      : 'bg-white/5'
                  }`}
                >
                  <div className="text-3xl w-12 text-center">
                    {POSITION_MEDALS[idx] || `${idx + 1}`}
                  </div>
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg"
                    style={{ backgroundColor: clan.clanColor }}
                  >
                    {EMBLEM_ICONS[clan.clanEmblem] || '🛡️'}
                  </div>
                  <div className="flex-1">
                    <div className={`font-bold ${isMyTeam ? 'text-yellow-300' : 'text-white'}`}>
                      {clan.clanName}
                      {isMyTeam && <span className="ml-2 text-xs">(Tu clan)</span>}
                    </div>
                    <div className="text-sm text-white/50">
                      {clan.territoriesOwned} territorios • {clan.territoriesConquered} conquistas
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-black ${isMyTeam ? 'text-yellow-300' : 'text-white'}`}>
                      {clan.totalPoints}
                    </div>
                    <div className="text-xs text-white/50">puntos</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Estadísticas detalladas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 text-center border border-white/10">
            <Swords className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{results.game.totalChallenges}</div>
            <div className="text-xs text-white/50">Desafíos totales</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 text-center border border-white/10">
            <Target className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{results.game.currentRound}</div>
            <div className="text-xs text-white/50">Rondas jugadas</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 text-center border border-white/10">
            <Shield className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">
              {myRanking?.successfulDefenses || 0}
            </div>
            <div className="text-xs text-white/50">Tus defensas</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 text-center border border-white/10">
            <Zap className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">
              {myRanking?.bestStreak || 0}
            </div>
            <div className="text-xs text-white/50">Tu mejor racha</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// Componente de historial de partidas
const GamesHistoryView = ({ 
  games, 
  onSelectGame 
}: { 
  games: TerritoryGame[];
  onSelectGame: (gameId: string) => void;
}) => {
  const finishedGames = games.filter(g => g.status === 'FINISHED');

  if (finishedGames.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 -m-4 md:-m-6 lg:-m-8 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/20 max-w-md"
        >
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
            <Map className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            No hay partidas
          </h2>
          <p className="text-purple-200">
            Tu profesor aún no ha iniciado ninguna partida de Conquista de Territorios.
            <br />
            <span className="text-purple-300 font-medium">¡Vuelve más tarde!</span>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 relative overflow-hidden">
      {/* Efectos de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30">
            <History className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">
            Historial de Batallas
          </h1>
          <p className="text-purple-300">
            Consulta los resultados de partidas anteriores
          </p>
        </motion.div>

        {/* Lista de partidas */}
        <div className="space-y-4">
          {finishedGames.map((game, idx) => (
            <motion.button
              key={game.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => onSelectGame(game.id)}
              className="w-full bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/10 hover:bg-white/15 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center text-2xl shadow-lg">
                  🏆
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white group-hover:text-yellow-300 transition-colors">
                    {game.name}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-white/50">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {game.finishedAt ? new Date(game.finishedAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      }) : 'Sin fecha'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      {game.currentRound} rondas
                    </span>
                    <span className="flex items-center gap-1">
                      <Swords className="w-4 h-4" />
                      {game.totalChallenges} desafíos
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-white/30 group-hover:text-white/60 transition-colors" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const StudentTerritoryPage = () => {
  const { selectedClassIndex } = useStudentStore();
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  // Obtener clases del estudiante
  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });

  const studentProfile = myClasses?.[selectedClassIndex];
  const classroom = studentProfile?.classroom;

  // Query para obtener el juego activo
  const { data: activeGame, isLoading } = useQuery({
    queryKey: ['territory-active-game', classroom?.id],
    queryFn: () => classroom ? territoryApi.getActiveGame(classroom.id) : null,
    enabled: !!classroom?.id,
  });

  // Query para obtener todas las partidas (para historial)
  const { data: allGames } = useQuery({
    queryKey: ['territory-games', classroom?.id],
    queryFn: () => classroom ? territoryApi.getClassroomGames(classroom.id) : [],
    enabled: !!classroom?.id && !activeGame,
  });

  // Query para obtener el estado del juego activo
  const { data: gameState } = useQuery({
    queryKey: ['territory-game-state', activeGame?.id],
    queryFn: () => activeGame ? territoryApi.getGameState(activeGame.id) : null,
    enabled: !!activeGame?.id,
    refetchInterval: activeGame?.status === 'ACTIVE' ? 5000 : false,
  });

  // Query para obtener resultados de partida finalizada o seleccionada
  const gameIdForResults = activeGame?.status === 'FINISHED' ? activeGame.id : selectedGameId;
  const { data: gameResults } = useQuery({
    queryKey: ['territory-game-results', gameIdForResults],
    queryFn: () => gameIdForResults ? territoryApi.getGameResults(gameIdForResults) : null,
    enabled: !!gameIdForResults,
  });

  // Encontrar el clan del estudiante
  const myClan = gameState?.clans.find(c => c.id === studentProfile?.teamId);
  const myClanScore = gameState?.ranking.find(r => r.clanId === studentProfile?.teamId);
  const myTerritoriesCount = gameState?.territories.filter(t => t.ownerClan?.id === studentProfile?.teamId).length || 0;
  const myPosition = gameState?.ranking.findIndex(r => r.clanId === studentProfile?.teamId) ?? -1;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 -m-4 md:-m-6 lg:-m-8 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // Si hay una partida seleccionada del historial y tenemos resultados
  if (selectedGameId && gameResults) {
    return (
      <GameResultsView 
        results={gameResults} 
        myClanId={studentProfile?.teamId}
        onBack={() => setSelectedGameId(null)}
      />
    );
  }

  // Si la partida activa está finalizada, mostrar resultados
  if (activeGame?.status === 'FINISHED' && gameResults) {
    return (
      <GameResultsView 
        results={gameResults} 
        myClanId={studentProfile?.teamId}
      />
    );
  }

  // Si no hay partida activa, mostrar historial
  if (!activeGame || !gameState) {
    return (
      <GamesHistoryView 
        games={allGames || []}
        onSelectGame={setSelectedGameId}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 relative overflow-hidden">
      {/* Efectos de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        {/* Header épico */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Crown className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight">
                  {gameState.game.name}
                </h1>
                <p className="text-purple-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Ronda {gameState.game.currentRound}
                  {gameState.game.maxRounds ? ` de ${gameState.game.maxRounds}` : ''}
                </p>
              </div>
            </div>
          </div>
          
          <motion.div
            animate={gameState.game.status === 'ACTIVE' ? { scale: [1, 1.05, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
            className={`px-6 py-3 rounded-2xl text-sm font-bold shadow-lg ${
              gameState.game.status === 'ACTIVE'
                ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-green-500/30'
                : gameState.game.status === 'PAUSED'
                ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-yellow-500/30'
                : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
            }`}
          >
            {gameState.game.status === 'ACTIVE' ? '⚔️ BATALLA EN CURSO' :
             gameState.game.status === 'PAUSED' ? '⏸️ PAUSADO' : '🏆 FINALIZADO'}
          </motion.div>
        </motion.div>

        {/* Banner de mi clan */}
        {myClan && myClanScore && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-3xl"
            style={{
              background: `linear-gradient(135deg, ${myClan.color}40, ${myClan.color}20)`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
            <div className="relative p-6 flex flex-col md:flex-row md:items-center gap-6">
              {/* Emblema del clan */}
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 4 }}
                className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl shadow-2xl"
                style={{ 
                  backgroundColor: myClan.color,
                  boxShadow: `0 20px 40px ${myClan.color}50`
                }}
              >
                {EMBLEM_ICONS[myClan.emblem] || '🛡️'}
              </motion.div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-black text-white">{myClan.name}</h2>
                  {myPosition === 0 && (
                    <span className="text-2xl">👑</span>
                  )}
                </div>
                <p className="text-white/70 font-medium">Tu clan de batalla</p>
              </div>
              
              {/* Stats del clan */}
              <div className="grid grid-cols-3 gap-6">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="text-center bg-white/10 backdrop-blur-sm rounded-2xl p-4"
                >
                  <div className="text-3xl font-black text-white mb-1">
                    {myClanScore.totalPoints}
                  </div>
                  <div className="text-xs text-white/60 uppercase tracking-wider font-bold">Puntos</div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="text-center bg-white/10 backdrop-blur-sm rounded-2xl p-4"
                >
                  <div className="text-3xl font-black text-white mb-1">
                    {myTerritoriesCount}
                  </div>
                  <div className="text-xs text-white/60 uppercase tracking-wider font-bold">Territorios</div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="text-center bg-white/10 backdrop-blur-sm rounded-2xl p-4"
                >
                  <div className="text-3xl font-black text-white mb-1">
                    {POSITION_MEDALS[myPosition] || `#${myPosition + 1}`}
                  </div>
                  <div className="text-xs text-white/60 uppercase tracking-wider font-bold">Posición</div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Mapa de territorios */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/10"
            >
              <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-lg">
                <Map className="w-5 h-5 text-purple-400" />
                {gameState.map.name}
              </h3>
              
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${gameState.map.gridCols}, minmax(0, 1fr))`,
                }}
              >
                {gameState.territories
                  .sort((a, b) => a.gridY - b.gridY || a.gridX - b.gridX)
                  .map((territory, idx) => {
                    const isMyTerritory = territory.ownerClan?.id === studentProfile?.teamId;
                    return (
                      <motion.div
                        key={territory.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        whileHover={{ scale: 1.05, zIndex: 10 }}
                        className={`relative p-4 rounded-2xl transition-all cursor-pointer ${
                          isMyTerritory ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-transparent' : ''
                        } ${
                          territory.status === 'CONTESTED' ? 'animate-pulse' : ''
                        }`}
                        style={{
                          backgroundColor: territory.ownerClan
                            ? territory.ownerClan.color + '40'
                            : 'rgba(255,255,255,0.1)',
                          borderLeft: territory.ownerClan
                            ? `4px solid ${territory.ownerClan.color}`
                            : '4px solid rgba(255,255,255,0.2)',
                        }}
                      >
                        <div className="text-3xl mb-2">{territory.icon}</div>
                        <div className="text-sm font-bold text-white truncate">
                          {territory.name}
                        </div>
                        {territory.ownerClan ? (
                          <div className="text-xs text-white/70 flex items-center gap-1 mt-1">
                            <span>{EMBLEM_ICONS[territory.ownerClan.emblem] || '🛡️'}</span>
                            <span className="truncate">{territory.ownerClan.name}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-white/50 mt-1 flex items-center gap-1">
                            <Flag className="w-3 h-3" /> Neutral
                          </div>
                        )}
                        
                        {/* Indicadores */}
                        {territory.isStrategic && (
                          <motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="absolute top-2 right-2"
                          >
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          </motion.div>
                        )}
                        {territory.status === 'CONTESTED' && (
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 0.5 }}
                            className="absolute top-2 right-2"
                          >
                            <Swords className="w-5 h-5 text-red-400" />
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
              </div>

              {/* Leyenda */}
              <div className="mt-6 pt-4 border-t border-white/10">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-white/20 rounded"></div>
                    <span className="text-white/60">Neutral</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-red-400" />
                    <span className="text-white/60">En disputa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-white/60">Estratégico (+puntos)</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Panel lateral */}
          <div className="space-y-6">
            {/* Ranking */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/10"
            >
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" /> Ranking de Clanes
              </h3>
              <div className="space-y-3">
                {gameState.ranking.map((score, idx) => {
                  const isMyTeam = score.clanId === studentProfile?.teamId;
                  return (
                    <motion.div
                      key={score.clanId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      whileHover={{ scale: 1.02 }}
                      className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                        isMyTeam
                          ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 ring-1 ring-yellow-400/50'
                          : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-2xl w-8 text-center">
                        {POSITION_MEDALS[idx] || `${idx + 1}`}
                      </div>
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg"
                        style={{ backgroundColor: score.clan?.color }}
                      >
                        {EMBLEM_ICONS[score.clan?.emblem || 'shield']}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold truncate ${
                          isMyTeam ? 'text-yellow-300' : 'text-white'
                        }`}>
                          {score.clan?.name}
                          {isMyTeam && <span className="ml-1 text-xs">(Tú)</span>}
                        </div>
                        <div className="text-xs text-white/50">
                          {score.territoriesOwned} territorios
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-black ${
                          isMyTeam ? 'text-yellow-300' : 'text-white'
                        }`}>
                          {score.totalPoints}
                        </div>
                        <div className="text-xs text-white/50">pts</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Estadísticas */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/10"
            >
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" /> Estadísticas
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-white/60 flex items-center gap-2">
                    <Swords className="w-4 h-4 text-red-400" /> Desafíos totales
                  </span>
                  <span className="font-bold text-white text-lg">
                    {gameState.game.totalChallenges}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60 flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-400" /> Ronda actual
                  </span>
                  <span className="font-bold text-white text-lg">
                    {gameState.game.currentRound}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-400" /> Tiempo/pregunta
                  </span>
                  <span className="font-bold text-white text-lg">
                    {gameState.game.timePerQuestion}s
                  </span>
                </div>
                
                {myClanScore && (
                  <>
                    <div className="border-t border-white/10 pt-4 mt-4">
                      <p className="text-xs text-white/40 uppercase tracking-wider font-bold mb-3">Tu clan</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-400" /> Defensas exitosas
                      </span>
                      <span className="font-bold text-green-400 text-lg">
                        {myClanScore.successfulDefenses}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" /> Mejor racha
                      </span>
                      <span className="font-bold text-yellow-400 text-lg">
                        {myClanScore.bestStreak}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </motion.div>

            {/* Alerta de pausa */}
            {gameState.game.status === 'PAUSED' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 backdrop-blur-xl rounded-3xl p-6 border border-yellow-500/30"
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-12 h-12 bg-yellow-500/30 rounded-2xl flex items-center justify-center"
                  >
                    <Clock className="w-6 h-6 text-yellow-400" />
                  </motion.div>
                  <div>
                    <h4 className="font-bold text-yellow-300">Juego Pausado</h4>
                    <p className="text-sm text-yellow-200/70">
                      El profesor ha pausado la partida
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentTerritoryPage;
