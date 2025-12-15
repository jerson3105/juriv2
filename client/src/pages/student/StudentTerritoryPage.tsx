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
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { territoryApi } from '../../lib/territoryApi';
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

export const StudentTerritoryPage = () => {
  const { selectedClassIndex } = useStudentStore();

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

  // Query para obtener el estado del juego
  const { data: gameState } = useQuery({
    queryKey: ['territory-game-state', activeGame?.id],
    queryFn: () => activeGame ? territoryApi.getGameState(activeGame.id) : null,
    enabled: !!activeGame?.id,
    refetchInterval: 5000, // Actualizar cada 5 segundos
  });

  // Encontrar el clan del estudiante
  const myClan = gameState?.clans.find(c => c.id === studentProfile?.teamId);
  const myClanScore = gameState?.ranking.find(r => r.clanId === studentProfile?.teamId);
  const myTerritoriesCount = gameState?.territories.filter(t => t.ownerClan?.id === studentProfile?.teamId).length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!activeGame || !gameState) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="p-12 text-center">
          <Map className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            No hay partida activa
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Tu profesor aún no ha iniciado una partida de Conquista de Territorios.
            <br />
            ¡Vuelve más tarde!
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Map className="w-7 h-7 text-indigo-500" />
            {gameState.game.name}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Ronda {gameState.game.currentRound}
            {gameState.game.maxRounds ? ` de ${gameState.game.maxRounds}` : ''}
          </p>
        </div>
        <div className={`px-4 py-2 rounded-full text-sm font-medium ${
          gameState.game.status === 'ACTIVE'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : gameState.game.status === 'PAUSED'
            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
        }`}>
          {gameState.game.status === 'ACTIVE' ? '🎮 En Juego' :
           gameState.game.status === 'PAUSED' ? '⏸️ Pausado' : '✅ Finalizado'}
        </div>
      </div>

      {/* Mi clan info */}
      {myClan && myClanScore && (
        <Card className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl shrink-0"
              style={{ backgroundColor: myClan.color + '30' }}
            >
              {EMBLEM_ICONS[myClan.emblem] || '🛡️'}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{myClan.name}</h2>
              <p className="text-sm text-gray-500">Tu clan</p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {myClanScore.totalPoints}
                </div>
                <div className="text-xs text-gray-500">Puntos</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {myTerritoriesCount}
                </div>
                <div className="text-xs text-gray-500">Territorios</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  #{gameState.ranking.findIndex(r => r.clanId === myClan.id) + 1}
                </div>
                <div className="text-xs text-gray-500">Posición</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Mapa de territorios */}
        <div className="lg:col-span-2">
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Map className="w-5 h-5" /> Mapa: {gameState.map.name}
            </h3>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${gameState.map.gridCols}, minmax(0, 1fr))`,
              }}
            >
              {gameState.territories
                .sort((a, b) => a.gridY - b.gridY || a.gridX - b.gridX)
                .map((territory) => {
                  const isMyTerritory = territory.ownerClan?.id === studentProfile?.teamId;
                  return (
                    <motion.div
                      key={territory.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`relative p-3 rounded-lg transition-all ${
                        isMyTerritory ? 'ring-2 ring-indigo-500' : ''
                      } ${
                        territory.status === 'CONTESTED' ? 'animate-pulse' : ''
                      }`}
                      style={{
                        backgroundColor: territory.ownerClan
                          ? territory.ownerClan.color + '30'
                          : 'rgb(229 231 235)',
                        borderLeft: territory.ownerClan
                          ? `4px solid ${territory.ownerClan.color}`
                          : '4px solid transparent',
                      }}
                    >
                      <div className="text-2xl mb-1">{territory.icon}</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {territory.name}
                      </div>
                      {territory.ownerClan ? (
                        <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-1">
                          <span>{EMBLEM_ICONS[territory.ownerClan.emblem] || '🛡️'}</span>
                          <span className="truncate">{territory.ownerClan.name}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Flag className="w-3 h-3" /> Neutral
                        </div>
                      )}
                      {territory.isStrategic && (
                        <div className="absolute top-1 right-1">
                          <Star className="w-3 h-3 text-yellow-500" />
                        </div>
                      )}
                      {territory.status === 'CONTESTED' && (
                        <div className="absolute top-1 right-1">
                          <Swords className="w-4 h-4 text-red-500" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
            </div>

            {/* Leyenda */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-200 rounded"></div>
                  <span className="text-gray-500">Neutral</span>
                </div>
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-red-500" />
                  <span className="text-gray-500">En disputa</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-gray-500">Estratégico</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Panel lateral */}
        <div className="space-y-4">
          {/* Ranking */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" /> Ranking
            </h3>
            <div className="space-y-2">
              {gameState.ranking.map((score, idx) => {
                const isMyTeam = score.clanId === studentProfile?.teamId;
                return (
                  <motion.div
                    key={score.clanId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      isMyTeam
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-1 ring-indigo-500'
                        : 'bg-gray-50 dark:bg-gray-800'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                      idx === 1 ? 'bg-gray-200 text-gray-700' :
                      idx === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {idx + 1}
                    </span>
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-sm"
                      style={{ backgroundColor: score.clan?.color + '20' }}
                    >
                      {EMBLEM_ICONS[score.clan?.emblem || 'shield']}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${
                        isMyTeam ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'
                      }`}>
                        {score.clan?.name}
                        {isMyTeam && <span className="ml-1 text-xs">(Tú)</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {score.territoriesOwned} territorios
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${
                        isMyTeam ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {score.totalPoints}
                      </div>
                      <div className="text-xs text-gray-500">pts</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Card>

          {/* Estadísticas del juego */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" /> Estadísticas
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Swords className="w-4 h-4" /> Desafíos totales
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {gameState.game.totalChallenges}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Target className="w-4 h-4" /> Ronda actual
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {gameState.game.currentRound}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Tiempo por pregunta
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {gameState.game.timePerQuestion}s
                </span>
              </div>
              {myClanScore && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                    <p className="text-xs text-gray-500 mb-2">Tu clan:</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Defensas exitosas
                    </span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {myClanScore.successfulDefenses}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 flex items-center gap-2">
                      <Zap className="w-4 h-4" /> Mejor racha
                    </span>
                    <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                      {myClanScore.bestStreak}
                    </span>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Info del juego */}
          {gameState.game.status === 'PAUSED' && (
            <Card className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Juego Pausado</h4>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    El profesor ha pausado la partida
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentTerritoryPage;
