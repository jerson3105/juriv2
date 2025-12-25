import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Map,
  ArrowLeft,
  Play,
  Pause,
  Square,
  Trophy,
  Swords,
  Crown,
  Users,
  Target,
  Plus,
  ChevronRight,
  Check,
  X,
  Clock,
  Zap,
  Flag,
  Star,
  AlertCircle,
  RefreshCw,
  Settings,
  Grid,
  Save,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  territoryApi,
  type TerritoryGame,
  type ChallengeData,
  type TerritoryWithState,
} from '../../lib/territoryApi';
import { clanApi, type ClanWithMembers } from '../../lib/clanApi';
import { questionBankApi, type QuestionBank, parseQuestionData } from '../../lib/questionBankApi';
import toast from 'react-hot-toast';

interface TerritoryConquestActivityProps {
  classroom: any;
  onBack: () => void;
}

type ViewMode = 'list' | 'setup' | 'game' | 'results' | 'map-editor' | 'maps';

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

// Tipo para pares de matching
interface MatchingPair {
  left: string;
  right: string;
}

// Componente para preguntas de unión interactivas
const MatchingQuestion = ({ 
  pairs, 
  shuffledPairs, 
  showAnswer 
}: { 
  pairs: MatchingPair[]; 
  shuffledPairs: MatchingPair[]; 
  showAnswer: boolean;
}) => {
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [connections, setConnections] = useState<globalThis.Map<number, number>>(new globalThis.Map());
  
  const handleLeftClick = (index: number) => {
    if (showAnswer) return;
    setSelectedLeft(selectedLeft === index ? null : index);
  };
  
  const handleRightClick = (rightIndex: number) => {
    if (showAnswer || selectedLeft === null) return;
    const newConnections = new globalThis.Map(connections);
    newConnections.set(selectedLeft, rightIndex);
    setConnections(newConnections);
    setSelectedLeft(null);
  };
  
  const removeConnection = (leftIndex: number) => {
    if (showAnswer) return;
    const newConnections = new globalThis.Map(connections);
    newConnections.delete(leftIndex);
    setConnections(newConnections);
  };
  
  const getCorrectRightIndex = (leftIndex: number) => {
    const leftItem = pairs[leftIndex];
    return shuffledPairs.findIndex(s => s.right === leftItem.right);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Columna izquierda */}
        <div className="space-y-2">
          {pairs.map((p, i) => {
            const isSelected = selectedLeft === i;
            const hasConnection = connections.has(i);
            const connectedTo = connections.get(i);
            
            return (
              <motion.div
                key={i}
                whileHover={!showAnswer ? { scale: 1.02 } : {}}
                whileTap={!showAnswer ? { scale: 0.98 } : {}}
                onClick={() => hasConnection ? removeConnection(i) : handleLeftClick(i)}
                className={`p-3 rounded-xl flex items-center gap-2 cursor-pointer transition-all ${
                  showAnswer 
                    ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-400'
                    : isSelected 
                      ? 'bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-400 ring-2 ring-purple-400/50' 
                      : hasConnection
                        ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 border-2 border-transparent hover:border-purple-400/50'
                }`}
              >
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-xs font-bold shadow">
                  {i + 1}
                </span>
                <span className="text-gray-800 dark:text-white text-sm flex-1">{p.left}</span>
                {hasConnection && !showAnswer && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-green-600 dark:text-green-400 text-xs font-bold"
                  >
                    → {String.fromCharCode(97 + connectedTo!)}
                  </motion.span>
                )}
                {showAnswer && (
                  <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">
                    → {String.fromCharCode(97 + getCorrectRightIndex(i))}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
        
        {/* Columna derecha */}
        <div className="space-y-2">
          {shuffledPairs.map((p, i) => {
            const isConnectedFrom = Array.from(connections.entries()).find(([_, v]) => v === i);
            
            return (
              <motion.div
                key={i}
                whileHover={!showAnswer && selectedLeft !== null ? { scale: 1.02 } : {}}
                whileTap={!showAnswer && selectedLeft !== null ? { scale: 0.98 } : {}}
                onClick={() => handleRightClick(i)}
                className={`p-3 rounded-xl flex items-center gap-2 transition-all ${
                  showAnswer
                    ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-400'
                    : selectedLeft !== null
                      ? 'bg-gray-100 dark:bg-gray-800 border-2 border-transparent hover:border-orange-400 cursor-pointer'
                      : isConnectedFrom
                        ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 border-2 border-transparent'
                }`}
              >
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center text-xs font-bold shadow">
                  {String.fromCharCode(97 + i)}
                </span>
                <span className="text-gray-800 dark:text-white text-sm flex-1">{p.right}</span>
                {isConnectedFrom && !showAnswer && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-green-600 dark:text-green-400 text-xs font-bold"
                  >
                    ← {isConnectedFrom[0] + 1}
                  </motion.span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
      
      {/* Instrucciones */}
      {!showAnswer && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          {selectedLeft !== null ? (
            <p className="text-purple-600 dark:text-purple-400 text-sm animate-pulse">
              👆 Ahora selecciona la opción correcta de la derecha
            </p>
          ) : connections.size < pairs.length ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              👈 Selecciona un elemento de la izquierda para unir
            </p>
          ) : (
            <p className="text-green-600 dark:text-green-400 text-sm font-medium">
              ✓ Todas las conexiones realizadas
            </p>
          )}
        </motion.div>
      )}
      
      {/* Mostrar respuesta del estudiante y respuestas correctas */}
      {showAnswer && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {/* Respuesta del estudiante */}
          {connections.size > 0 && (
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl border border-blue-400">
              <p className="text-blue-700 dark:text-blue-400 text-sm font-bold text-center mb-2">📝 Respuesta del estudiante:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {pairs.map((_p, i) => {
                  const studentAnswer = connections.get(i);
                  const correctAnswer = getCorrectRightIndex(i);
                  const isCorrect = studentAnswer === correctAnswer;
                  return (
                    <span 
                      key={i} 
                      className={`text-xs px-2 py-1 rounded shadow-sm ${
                        studentAnswer !== undefined
                          ? isCorrect 
                            ? 'bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300'
                            : 'bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-300'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                      }`}
                    >
                      {i + 1} → {studentAnswer !== undefined ? String.fromCharCode(97 + studentAnswer) : '?'}
                      {studentAnswer !== undefined && (isCorrect ? ' ✓' : ' ✗')}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Respuestas correctas */}
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl border border-green-400">
            <p className="text-green-700 dark:text-green-400 text-sm font-bold text-center mb-2">✓ Respuestas correctas:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {pairs.map((_p, i) => (
                <span key={i} className="text-gray-700 dark:text-gray-300 text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm">
                  {i + 1} → {String.fromCharCode(97 + getCorrectRightIndex(i))}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export const TerritoryConquestActivity = ({ classroom, onBack }: TerritoryConquestActivityProps) => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedGame, setSelectedGame] = useState<TerritoryGame | null>(null);
  const [currentChallenge, setCurrentChallenge] = useState<ChallengeData | null>(null);
  const [selectedClan, setSelectedClan] = useState<string | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [shuffledMatchingPairs, setShuffledMatchingPairs] = useState<MatchingPair[]>([]);
  const [timer, setTimer] = useState<number>(0);
  const [timerActive, setTimerActive] = useState(false);
  
  // Animation states
  const [showVsAnimation, setShowVsAnimation] = useState(false);
  const [showResultAnimation, setShowResultAnimation] = useState<'victory' | 'defeat' | null>(null);
  const [vsData, setVsData] = useState<{ challenger: any; defender: any; territory: any } | null>(null);
  const [processedChallengeId, setProcessedChallengeId] = useState<string | null>(null);

  // Setup state
  const [setupStep, setSetupStep] = useState<'map' | 'clans' | 'banks' | 'config'>('map');
  const [newGame, setNewGame] = useState({
    name: '',
    mapId: '',
    participatingClanIds: [] as string[],
    questionBankIds: [] as string[],
    maxRounds: null as number | null,
    timePerQuestion: 30,
  });

  // Map editor state
  const [editingMap, setEditingMap] = useState<{
    id?: string;
    name: string;
    description: string;
    gridCols: number;
    gridRows: number;
    baseConquestPoints: number;
    baseDefensePoints: number;
    bonusStreakPoints: number;
    territories: Array<{
      id?: string;
      name: string;
      gridX: number;
      gridY: number;
      icon: string;
      color: string;
      pointMultiplier: number;
      isStrategic: boolean;
    }>;
  } | null>(null);

  // Queries
  const { data: games = [], isLoading: loadingGames } = useQuery({
    queryKey: ['territory-games', classroom.id],
    queryFn: () => territoryApi.getClassroomGames(classroom.id),
  });

  const { data: maps = [], isLoading: loadingMaps } = useQuery({
    queryKey: ['territory-maps', classroom.id],
    queryFn: () => territoryApi.getClassroomMaps(classroom.id),
  });

  const { data: clans = [], isLoading: loadingClans } = useQuery({
    queryKey: ['clans', classroom.id],
    queryFn: () => clanApi.getClassroomClans(classroom.id),
  });

  const { data: questionBanks = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['question-banks', classroom.id],
    queryFn: () => questionBankApi.getBanks(classroom.id),
  });

  const { data: gameState, refetch: refetchGameState } = useQuery({
    queryKey: ['territory-game-state', selectedGame?.id],
    queryFn: () => selectedGame ? territoryApi.getGameState(selectedGame.id) : null,
    enabled: !!selectedGame && (viewMode === 'game' || viewMode === 'results'),
    refetchInterval: viewMode === 'game' ? 5000 : false,
  });

  // Timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer(t => {
          if (t <= 1) {
            setTimerActive(false);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timer]);

  // Cargar desafío pendiente cuando se carga el gameState
  useEffect(() => {
    const pending = gameState?.pendingChallenge;
    if (pending && !currentChallenge && viewMode === 'game' && pending.challengeId !== processedChallengeId) {
      setCurrentChallenge(pending);
      // Shuffle matching pairs if it's a matching question
      const parsedQ = parseQuestionData(pending.question as any);
      if (parsedQ.type === 'MATCHING' && Array.isArray(parsedQ.pairs)) {
        setShuffledMatchingPairs([...parsedQ.pairs].sort(() => Math.random() - 0.5));
      }
      setTimer(selectedGame?.timePerQuestion || 30);
      setTimerActive(true);
    }
  }, [gameState?.pendingChallenge, currentChallenge, viewMode, selectedGame?.timePerQuestion, processedChallengeId]);

  // Mutations
  const createGameMutation = useMutation({
    mutationFn: (data: typeof newGame) => territoryApi.createGame(classroom.id, {
      name: data.name,
      mapId: data.mapId,
      questionBankIds: data.questionBankIds,
      participatingClanIds: data.participatingClanIds,
      maxRounds: data.maxRounds || undefined,
      timePerQuestion: data.timePerQuestion,
    }),
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ['territory-games', classroom.id] });
      setSelectedGame(game);
      setViewMode('game');
      toast.success('Juego creado exitosamente');
    },
    onError: () => toast.error('Error al crear el juego'),
  });

  const startGameMutation = useMutation({
    mutationFn: (gameId: string) => territoryApi.startGame(gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territory-games', classroom.id] });
      refetchGameState();
      toast.success('¡Juego iniciado!');
    },
    onError: () => toast.error('Error al iniciar el juego'),
  });

  const pauseGameMutation = useMutation({
    mutationFn: (gameId: string) => territoryApi.pauseGame(gameId),
    onSuccess: () => {
      refetchGameState();
      toast.success('Juego pausado');
    },
  });

  const resumeGameMutation = useMutation({
    mutationFn: (gameId: string) => territoryApi.resumeGame(gameId),
    onSuccess: () => {
      refetchGameState();
      toast.success('Juego reanudado');
    },
  });

  const finishGameMutation = useMutation({
    mutationFn: (gameId: string) => territoryApi.finishGame(gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territory-games', classroom.id] });
      setViewMode('results');
      toast.success('¡Juego finalizado!');
    },
    onError: () => toast.error('Error al finalizar el juego'),
  });

  const conquestMutation = useMutation({
    mutationFn: ({ gameId, territoryId, clanId }: { gameId: string; territoryId: string; clanId: string }) =>
      territoryApi.initiateConquest(gameId, territoryId, clanId),
    onSuccess: (challenge) => {
      // Show VS animation first
      const territory = gameState?.territories.find(t => t.id === challenge.territory.id);
      const challenger = gameState?.clans.find(c => c.id === challenge.challengerClan.id);
      setVsData({
        challenger: challenger || challenge.challengerClan,
        defender: null,
        territory: territory || challenge.territory,
      });
      setShowVsAnimation(true);
      
      // After VS animation, show question
      setTimeout(() => {
        setShowVsAnimation(false);
        setCurrentChallenge(challenge);
        setShowAnswer(false);
        setSelectedAnswer(null);
        setSelectedAnswers([]);
        // Shuffle matching pairs if it's a matching question
        const parsedQ = parseQuestionData(challenge.question as any);
        if (parsedQ.type === 'MATCHING' && Array.isArray(parsedQ.pairs)) {
          setShuffledMatchingPairs([...parsedQ.pairs].sort(() => Math.random() - 0.5));
        }
        setTimer(selectedGame?.timePerQuestion || 30);
        setTimerActive(true);
      }, 2500);
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Error al iniciar conquista'),
  });

  const challengeMutation = useMutation({
    mutationFn: ({ gameId, territoryId, clanId }: { gameId: string; territoryId: string; clanId: string }) =>
      territoryApi.initiateDefenseChallenge(gameId, territoryId, clanId),
    onSuccess: (challenge) => {
      // Show VS animation first
      const territory = gameState?.territories.find(t => t.id === challenge.territory.id);
      const challenger = gameState?.clans.find(c => c.id === challenge.challengerClan.id);
      const defender = challenge.defenderClan ? gameState?.clans.find(c => c.id === challenge.defenderClan?.id) : null;
      setVsData({
        challenger: challenger || challenge.challengerClan,
        defender: defender || challenge.defenderClan,
        territory: territory || challenge.territory,
      });
      setShowVsAnimation(true);
      
      // After VS animation, show question
      setTimeout(() => {
        setShowVsAnimation(false);
        setCurrentChallenge(challenge);
        setShowAnswer(false);
        setSelectedAnswer(null);
        setSelectedAnswers([]);
        // Shuffle matching pairs if it's a matching question
        const parsedQ = parseQuestionData(challenge.question as any);
        if (parsedQ.type === 'MATCHING' && Array.isArray(parsedQ.pairs)) {
          setShuffledMatchingPairs([...parsedQ.pairs].sort(() => Math.random() - 0.5));
        }
        setTimer(selectedGame?.timePerQuestion || 30);
        setTimerActive(true);
      }, 2500);
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Error al iniciar desafío'),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ challengeId, isCorrect }: { challengeId: string; isCorrect: boolean }) =>
      territoryApi.resolveChallenge(challengeId, isCorrect, undefined, selectedGame?.timePerQuestion ? selectedGame.timePerQuestion - timer : undefined),
    onSuccess: (_, variables) => {
      // Marcar el desafío como procesado para evitar que se vuelva a cargar
      if (currentChallenge) {
        setProcessedChallengeId(currentChallenge.challengeId);
      }
      setCurrentChallenge(null);
      setTimerActive(false);
      
      // Show victory/defeat animation
      setShowResultAnimation(variables.isCorrect ? 'victory' : 'defeat');
      
      // Fire confetti on victory
      if (variables.isCorrect) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#22c55e', '#3b82f6', '#9333ea']
        });
      }
      
      // Clear after animation
      setTimeout(() => {
        setShowResultAnimation(null);
        setSelectedTerritory(null);
        setSelectedClan(null);
        refetchGameState();
      }, 2000);
    },
    onError: () => toast.error('Error al resolver desafío'),
  });

  // Map mutations
  const createMapMutation = useMutation({
    mutationFn: async (mapData: typeof editingMap) => {
      if (!mapData) throw new Error('No map data');
      const map = await territoryApi.createMap(classroom.id, {
        name: mapData.name,
        description: mapData.description || undefined,
        gridCols: mapData.gridCols,
        gridRows: mapData.gridRows,
        baseConquestPoints: mapData.baseConquestPoints,
        baseDefensePoints: mapData.baseDefensePoints,
        bonusStreakPoints: mapData.bonusStreakPoints,
      });
      // Create territories
      if (mapData.territories.length > 0) {
        await territoryApi.createTerritoriesBatch(map.id, mapData.territories.map(t => ({
          name: t.name,
          gridX: t.gridX,
          gridY: t.gridY,
          icon: t.icon,
          color: t.color,
          pointMultiplier: t.pointMultiplier,
          isStrategic: t.isStrategic,
        })));
      }
      return map;
    },
    onSuccess: (newMap) => {
      queryClient.invalidateQueries({ queryKey: ['territory-maps', classroom.id] });
      // Volver al wizard de setup y seleccionar el mapa recién creado
      setNewGame(prev => ({ ...prev, mapId: newMap.id }));
      setViewMode('setup');
      setEditingMap(null);
      toast.success('¡Mapa creado exitosamente! Ya puedes usarlo en una nueva partida.');
    },
    onError: () => toast.error('Error al crear el mapa'),
  });

  // Handlers
  const handleStartSetup = () => {
    setViewMode('setup');
    setSetupStep('map');
    setNewGame({
      name: '',
      mapId: '',
      participatingClanIds: [],
      questionBankIds: [],
      maxRounds: null,
      timePerQuestion: 30,
    });
  };

  const handleSelectGame = (game: TerritoryGame) => {
    setSelectedGame(game);
    if (game.status === 'FINISHED') {
      setViewMode('results');
    } else {
      setViewMode('game');
    }
  };

  const handleTerritoryClick = (territory: TerritoryWithState) => {
    if (!gameState || gameState.game.status !== 'ACTIVE') return;
    if (territory.status === 'CONTESTED') return;
    
    setSelectedTerritory(territory.id);
    setSelectedClan(null);
  };

  const handleClanSelect = (clanId: string) => {
    setSelectedClan(clanId);
  };

  const handleInitiateAction = () => {
    if (!selectedGame || !selectedTerritory || !selectedClan) return;

    const territory = gameState?.territories.find(t => t.id === selectedTerritory);
    if (!territory) return;

    if (territory.status === 'NEUTRAL') {
      conquestMutation.mutate({
        gameId: selectedGame.id,
        territoryId: selectedTerritory,
        clanId: selectedClan,
      });
    } else if (territory.status === 'OWNED' && territory.ownerClan?.id !== selectedClan) {
      challengeMutation.mutate({
        gameId: selectedGame.id,
        territoryId: selectedTerritory,
        clanId: selectedClan,
      });
    }
  };

  const handleResolve = (isCorrect: boolean) => {
    if (!currentChallenge) return;
    resolveMutation.mutate({
      challengeId: currentChallenge.challengeId,
      isCorrect,
    });
  };

  const handleCreateNewMap = () => {
    setEditingMap({
      name: '',
      description: '',
      gridCols: 4,
      gridRows: 3,
      baseConquestPoints: 100,
      baseDefensePoints: 50,
      bonusStreakPoints: 25,
      territories: [],
    });
    setViewMode('map-editor');
  };

  const handleGenerateTerritories = () => {
    if (!editingMap) return;
    const territories = [];
    const icons = ['🏰', '⛰️', '🌲', '🏛️', '🗼', '🏔️', '🌋', '🏝️', '🗿', '⚔️', '🛡️', '👑'];
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#22c55e', '#14b8a6', '#3b82f6'];
    
    for (let y = 0; y < editingMap.gridRows; y++) {
      for (let x = 0; x < editingMap.gridCols; x++) {
        const idx = y * editingMap.gridCols + x;
        territories.push({
          name: `Territorio ${idx + 1}`,
          gridX: x,
          gridY: y,
          icon: icons[idx % icons.length],
          color: colors[idx % colors.length],
          pointMultiplier: 100,
          isStrategic: false,
        });
      }
    }
    setEditingMap({ ...editingMap, territories });
  };

  const handleSaveMap = () => {
    if (!editingMap || !editingMap.name) {
      toast.error('El mapa necesita un nombre');
      return;
    }
    if (editingMap.territories.length === 0) {
      toast.error('El mapa necesita al menos un territorio');
      return;
    }
    createMapMutation.mutate(editingMap);
  };

  // Render functions
  const renderGamesList = () => (
    <div className="space-y-6">
      {loadingGames ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : games.length === 0 ? (
        <Card className="p-12 text-center">
          <Map className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No hay partidas creadas
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Crea una nueva partida para comenzar a jugar con tus clanes
          </p>
          <Button onClick={handleStartSetup}>Crear Primera Partida</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Partidas activas */}
          {games.filter(g => g.status === 'ACTIVE' || g.status === 'PAUSED').length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-500" /> Partidas Activas
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {games.filter(g => g.status === 'ACTIVE' || g.status === 'PAUSED').map((game) => {
                  const clanIds = typeof game.participatingClanIds === 'string' 
                    ? JSON.parse(game.participatingClanIds) 
                    : game.participatingClanIds;
                  const clanCount = Array.isArray(clanIds) ? clanIds.length : 0;
                  
                  return (
                    <motion.div
                      key={game.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <Card
                        className="p-5 cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-green-500"
                        onClick={() => handleSelectGame(game)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-2xl">
                              ⚔️
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{game.name}</h3>
                              <p className="text-sm text-gray-500">
                                Ronda {game.currentRound}{game.maxRounds ? ` de ${game.maxRounds}` : ''}
                              </p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                            game.status === 'ACTIVE' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {game.status === 'ACTIVE' ? '🟢 En Juego' : '⏸️ Pausado'}
                          </span>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <span className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-500" />
                            <span className="font-medium">{clanCount}</span> clanes
                          </span>
                          <span className="flex items-center gap-2">
                            <Swords className="w-4 h-4 text-orange-500" />
                            <span className="font-medium">{game.totalChallenges}</span> desafíos
                          </span>
                          <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span className="font-medium">{game.timePerQuestion}s</span> por pregunta
                          </span>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Borradores */}
          {games.filter(g => g.status === 'DRAFT').length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                <Flag className="w-4 h-4 text-blue-500" /> Borradores
              </h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {games.filter(g => g.status === 'DRAFT').map((game) => {
                  const clanIds = typeof game.participatingClanIds === 'string' 
                    ? JSON.parse(game.participatingClanIds) 
                    : game.participatingClanIds;
                  const clanCount = Array.isArray(clanIds) ? clanIds.length : 0;
                  
                  return (
                    <Card
                      key={game.id}
                      className="p-4 cursor-pointer hover:shadow-md transition-all border-l-4 border-l-blue-400"
                      onClick={() => handleSelectGame(game)}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xl">
                          📝
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{game.name}</h3>
                          <p className="text-xs text-gray-500">{clanCount} clanes configurados</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Finalizadas */}
          {games.filter(g => g.status === 'FINISHED').length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" /> Partidas Finalizadas
              </h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {games.filter(g => g.status === 'FINISHED').map((game) => {
                  const clanIds = typeof game.participatingClanIds === 'string' 
                    ? JSON.parse(game.participatingClanIds) 
                    : game.participatingClanIds;
                  const clanCount = Array.isArray(clanIds) ? clanIds.length : 0;
                  
                  return (
                    <Card
                      key={game.id}
                      className="p-4 cursor-pointer hover:shadow-md transition-all opacity-80 hover:opacity-100"
                      onClick={() => handleSelectGame(game)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl">
                            🏆
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">{game.name}</h3>
                            <p className="text-xs text-gray-500">
                              {game.currentRound} rondas • {clanCount} clanes • {game.totalChallenges} desafíos
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">
                          {game.finishedAt ? new Date(game.finishedAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderSetup = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setViewMode('list')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nueva Partida</h2>
          <p className="text-sm text-gray-500">Configura los parámetros del juego</p>
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center justify-center gap-2">
        {['map', 'clans', 'banks', 'config'].map((step, idx) => (
          <div key={step} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              setupStep === step ? 'bg-indigo-600 text-white' :
              ['map', 'clans', 'banks', 'config'].indexOf(setupStep) > idx ? 'bg-green-500 text-white' :
              'bg-gray-200 dark:bg-gray-700 text-gray-500'
            }`}>
              {['map', 'clans', 'banks', 'config'].indexOf(setupStep) > idx ? <Check className="w-4 h-4" /> : idx + 1}
            </div>
            {idx < 3 && <div className="w-12 h-0.5 bg-gray-200 dark:bg-gray-700" />}
          </div>
        ))}
      </div>

      <Card className="p-6">
        {setupStep === 'map' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Selecciona un Mapa</h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  handleCreateNewMap();
                  setViewMode('map-editor');
                }}
                className="gap-1"
              >
                <Plus className="w-4 h-4" /> Crear Mapa
              </Button>
            </div>
            {loadingMaps ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : maps.length === 0 ? (
              <div className="text-center py-8">
                <Map className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500">No hay mapas disponibles</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    handleCreateNewMap();
                    setViewMode('map-editor');
                  }}
                  className="mt-3 gap-1"
                >
                  <Plus className="w-4 h-4" /> Crear tu primer mapa
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {maps.map((map) => (
                  <div
                    key={map.id}
                    onClick={() => setNewGame({ ...newGame, mapId: map.id })}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      newGame.mapId === map.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Map className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">{map.name}</h4>
                        <p className="text-sm text-gray-500">
                          {map.gridCols}x{map.gridRows} • {map.territories?.length || 0} territorios
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button
                onClick={() => setSetupStep('clans')}
                disabled={!newGame.mapId}
              >
                Siguiente <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {setupStep === 'clans' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Selecciona los Clanes Participantes</h3>
            <p className="text-sm text-gray-500">Mínimo 2 clanes para jugar</p>
            {loadingClans ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : clans.length < 2 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500">Necesitas al menos 2 clanes</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {clans.map((clan: ClanWithMembers) => (
                  <div
                    key={clan.id}
                    onClick={() => {
                      const ids = newGame.participatingClanIds.includes(clan.id)
                        ? newGame.participatingClanIds.filter(id => id !== clan.id)
                        : [...newGame.participatingClanIds, clan.id];
                      setNewGame({ ...newGame, participatingClanIds: ids });
                    }}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      newGame.participatingClanIds.includes(clan.id)
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                        style={{ backgroundColor: clan.color + '20', color: clan.color }}
                      >
                        {EMBLEM_ICONS[clan.emblem] || '🛡️'}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">{clan.name}</h4>
                        <p className="text-sm text-gray-500">{clan.memberCount} miembros</p>
                      </div>
                      {newGame.participatingClanIds.includes(clan.id) && (
                        <Check className="w-5 h-5 text-indigo-500 ml-auto" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setSetupStep('map')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Atrás
              </Button>
              <Button
                onClick={() => setSetupStep('banks')}
                disabled={newGame.participatingClanIds.length < 2}
              >
                Siguiente <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {setupStep === 'banks' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Selecciona Bancos de Preguntas</h3>
            <p className="text-sm text-gray-500">Las preguntas se seleccionarán aleatoriamente de estos bancos</p>
            {loadingBanks ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : questionBanks.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500">No hay bancos de preguntas</p>
                <p className="text-sm text-gray-400">Crea bancos de preguntas primero</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {questionBanks.map((bank: QuestionBank) => (
                  <div
                    key={bank.id}
                    onClick={() => {
                      const ids = newGame.questionBankIds.includes(bank.id)
                        ? newGame.questionBankIds.filter(id => id !== bank.id)
                        : [...newGame.questionBankIds, bank.id];
                      setNewGame({ ...newGame, questionBankIds: ids });
                    }}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      newGame.questionBankIds.includes(bank.id)
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">{bank.name}</h4>
                        <p className="text-sm text-gray-500">{bank.questionCount} preguntas</p>
                      </div>
                      {newGame.questionBankIds.includes(bank.id) && (
                        <Check className="w-5 h-5 text-indigo-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setSetupStep('clans')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Atrás
              </Button>
              <Button
                onClick={() => setSetupStep('config')}
                disabled={newGame.questionBankIds.length === 0}
              >
                Siguiente <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {setupStep === 'config' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Configuración Final</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre de la Partida
              </label>
              <input
                type="text"
                value={newGame.name}
                onChange={(e) => setNewGame({ ...newGame, name: e.target.value })}
                placeholder="Ej: Batalla por el Reino"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Límite de Rondas (opcional)
                </label>
                <input
                  type="number"
                  value={newGame.maxRounds || ''}
                  onChange={(e) => setNewGame({ ...newGame, maxRounds: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Sin límite"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tiempo por Pregunta (segundos)
                </label>
                <input
                  type="number"
                  value={newGame.timePerQuestion}
                  onChange={(e) => setNewGame({ ...newGame, timePerQuestion: parseInt(e.target.value) || 30 })}
                  min="10"
                  max="120"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setSetupStep('banks')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Atrás
              </Button>
              <Button
                onClick={() => createGameMutation.mutate(newGame)}
                disabled={!newGame.name || createGameMutation.isPending}
              >
                {createGameMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Crear Partida
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  const renderGame = () => {
    if (!gameState) {
      return (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      );
    }

    const selectedTerritoryData = selectedTerritory
      ? gameState.territories.find(t => t.id === selectedTerritory)
      : null;

    return (
      <div className="space-y-4">
        {/* Header Gamificado */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-5 shadow-xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => { setViewMode('list'); setSelectedGame(null); }} className="text-white hover:bg-white/20">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="text-4xl"
              >
                ⚔️
              </motion.div>
              <div>
                <h2 className="text-2xl font-black text-white">{gameState.game.name}</h2>
                <div className="flex items-center gap-3 text-white/80 text-sm flex-wrap">
                  <span className="flex items-center gap-1">
                    <Flag className="w-4 h-4" />
                    Ronda {gameState.game.currentRound}{gameState.game.maxRounds ? ` / ${gameState.game.maxRounds}` : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Swords className="w-4 h-4" />
                    {gameState.game.totalChallenges} desafíos
                  </span>
                  {gameState.questionStats && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full">
                      📝 {gameState.questionStats.uniqueUsed}/{gameState.questionStats.total} preguntas usadas
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    gameState.game.status === 'ACTIVE' ? 'bg-green-500 text-white animate-pulse' :
                    gameState.game.status === 'PAUSED' ? 'bg-yellow-500 text-black' :
                    'bg-gray-500 text-white'
                  }`}>
                    {gameState.game.status === 'ACTIVE' ? '🔴 EN VIVO' : 
                     gameState.game.status === 'PAUSED' ? '⏸️ PAUSADO' : '📝 BORRADOR'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {gameState.game.status === 'DRAFT' && (
                <Button onClick={() => startGameMutation.mutate(selectedGame!.id)} className="gap-2 bg-green-500 hover:bg-green-600 text-white">
                  <Play className="w-4 h-4" /> ¡Iniciar Batalla!
                </Button>
              )}
              {gameState.game.status === 'ACTIVE' && (
                <Button variant="secondary" onClick={() => pauseGameMutation.mutate(selectedGame!.id)} className="gap-2">
                  <Pause className="w-4 h-4" /> Pausar
                </Button>
              )}
              {gameState.game.status === 'PAUSED' && (
                <Button onClick={() => resumeGameMutation.mutate(selectedGame!.id)} className="gap-2 bg-green-500 hover:bg-green-600 text-white">
                  <Play className="w-4 h-4" /> Reanudar
                </Button>
              )}
              {(gameState.game.status === 'ACTIVE' || gameState.game.status === 'PAUSED') && (
                <Button variant="danger" onClick={() => finishGameMutation.mutate(selectedGame!.id)} className="gap-2">
                  <Square className="w-4 h-4" /> Finalizar
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-4">
          {/* Mapa de territorios */}
          <div className="lg:col-span-3">
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Map className="w-5 h-5" /> {gameState.map.name}
              </h3>
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${gameState.map.gridCols}, minmax(0, 1fr))`,
                }}
              >
                {(Array.isArray(gameState.territories) ? gameState.territories : [])
                  .sort((a, b) => a.gridY - b.gridY || a.gridX - b.gridX)
                  .map((territory, idx) => (
                    <motion.div
                      key={territory.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      whileHover={{ scale: 1.05, zIndex: 10 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTerritoryClick(territory)}
                      className={`relative rounded-xl cursor-pointer transition-all overflow-hidden group ${
                        selectedTerritory === territory.id
                          ? 'ring-4 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900 shadow-xl'
                          : 'shadow-md hover:shadow-lg'
                      } ${
                        territory.status === 'CONTESTED'
                          ? 'animate-pulse ring-2 ring-orange-400'
                          : ''
                      }`}
                      style={{
                        background: territory.ownerClan
                          ? `linear-gradient(135deg, ${territory.ownerClan.color}40 0%, ${territory.ownerClan.color}20 100%)`
                          : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                      }}
                    >
                      {/* Barra superior con color del clan */}
                      <div 
                        className="h-1.5 w-full"
                        style={{ 
                          backgroundColor: territory.ownerClan?.color || '#d1d5db',
                        }}
                      />
                      
                      <div className="p-3">
                        {/* Icono y badges */}
                        <div className="flex items-start justify-between mb-2">
                          <motion.div 
                            className="text-3xl"
                            whileHover={{ rotate: [0, -10, 10, 0] }}
                            transition={{ duration: 0.5 }}
                          >
                            {territory.icon}
                          </motion.div>
                          <div className="flex flex-col gap-1">
                            {territory.isStrategic && (
                              <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="bg-yellow-400 rounded-full p-1"
                              >
                                <Star className="w-3 h-3 text-yellow-800" />
                              </motion.div>
                            )}
                            {territory.status === 'NEUTRAL' && (
                              <div className="bg-gray-200 dark:bg-gray-600 rounded-full p-1">
                                <Flag className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                              </div>
                            )}
                            {territory.status === 'CONTESTED' && (
                              <motion.div
                                animate={{ rotate: [0, 15, -15, 0] }}
                                transition={{ repeat: Infinity, duration: 0.5 }}
                                className="bg-orange-400 rounded-full p-1"
                              >
                                <Swords className="w-3 h-3 text-orange-800" />
                              </motion.div>
                            )}
                          </div>
                        </div>
                        
                        {/* Nombre del territorio */}
                        <div className="font-bold text-sm text-gray-900 dark:text-white truncate mb-1">
                          {territory.name}
                        </div>
                        
                        {/* Clan dueño */}
                        {territory.ownerClan ? (
                          <div 
                            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
                            style={{ 
                              backgroundColor: territory.ownerClan.color + '30',
                              color: territory.ownerClan.color,
                            }}
                          >
                            <span className="text-sm">{EMBLEM_ICONS[territory.ownerClan.emblem] || '🛡️'}</span>
                            <span className="truncate font-bold">{territory.ownerClan.name}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                            <span>🏴</span>
                            <span>Sin conquistar</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Efecto de hover */}
                      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all pointer-events-none" />
                    </motion.div>
                  ))}
              </div>
            </Card>
          </div>

          {/* Panel lateral */}
          <div className="space-y-4">
            {/* Ranking Gamificado */}
            <Card className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-200 dark:border-yellow-800">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <motion.span
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-2xl"
                >
                  🏆
                </motion.span>
                <span>Ranking de Clanes</span>
              </h3>
              <div className="space-y-2">
                {gameState.ranking.map((score, idx) => (
                  <motion.div
                    key={score.clanId}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      idx === 0 ? 'bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/40 dark:to-amber-900/40 border-2 border-yellow-300 dark:border-yellow-700 shadow-md' :
                      idx === 1 ? 'bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-800 dark:to-slate-800 border border-gray-300 dark:border-gray-600' :
                      idx === 2 ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 border border-orange-200 dark:border-orange-800' :
                      'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-black ${
                      idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                      idx === 1 ? 'bg-gray-300 text-gray-700' :
                      idx === 2 ? 'bg-orange-300 text-orange-800' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </div>
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-md"
                      style={{ backgroundColor: score.clan?.color || '#6366f1' }}
                    >
                      {EMBLEM_ICONS[score.clan?.emblem || 'shield']}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 dark:text-white truncate">
                        {score.clan?.name}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span>🗺️ {score.territoriesOwned} territorios</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <motion.div 
                        className="text-lg font-black text-indigo-600 dark:text-indigo-400"
                        animate={idx === 0 ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 2 }}
                      >
                        {score.totalPoints}
                      </motion.div>
                      <div className="text-xs text-gray-500">puntos</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>

            {/* Acción de territorio - Gamificada */}
            {selectedTerritoryData && gameState.game.status === 'ACTIVE' && !currentChallenge && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <Card className={`p-4 border-2 ${
                  selectedTerritoryData.status === 'NEUTRAL' 
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-300 dark:border-green-700'
                    : 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-300 dark:border-red-700'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{selectedTerritoryData.icon}</span>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">
                        {selectedTerritoryData.status === 'NEUTRAL' ? '🎯 Conquistar' : '⚔️ Desafiar'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{selectedTerritoryData.name}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">
                    {selectedTerritoryData.status === 'NEUTRAL'
                      ? '¿Qué clan intentará conquistar este territorio?'
                      : `Territorio de ${selectedTerritoryData.ownerClan?.name}. ¿Quién lo desafiará?`}
                  </p>
                  <div className="space-y-2 mb-4">
                    {gameState.clans
                      .filter(c => selectedTerritoryData.status === 'NEUTRAL' || c.id !== selectedTerritoryData.ownerClan?.id)
                      .map((clan) => (
                        <motion.div
                          key={clan.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleClanSelect(clan.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                            selectedClan === clan.id
                              ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500 shadow-md'
                              : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm"
                            style={{ backgroundColor: clan.color }}
                          >
                            {EMBLEM_ICONS[clan.emblem]}
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white">{clan.name}</span>
                          {selectedClan === clan.id && (
                            <Check className="w-5 h-5 text-indigo-600 ml-auto" />
                          )}
                        </motion.div>
                      ))}
                  </div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={handleInitiateAction}
                      disabled={!selectedClan}
                      className={`w-full gap-2 text-lg py-3 ${
                        selectedTerritoryData.status === 'NEUTRAL'
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                          : 'bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700'
                      }`}
                    >
                      {selectedTerritoryData.status === 'NEUTRAL' ? (
                        <>
                          <Target className="w-5 h-5" /> ¡Iniciar Conquista!
                        </>
                      ) : (
                        <>
                          <Swords className="w-5 h-5" /> ¡Iniciar Desafío!
                        </>
                      )}
                    </Button>
                  </motion.div>
                </Card>
              </motion.div>
            )}
          </div>
        </div>

        {/* Modal de pregunta - Gamificado */}
        <AnimatePresence>
          {currentChallenge && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gradient-to-br from-indigo-900/90 via-purple-900/90 to-pink-900/90 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border-4 border-indigo-500/30"
              >
                {/* Header épico */}
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-4 rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg border-2 border-white/30"
                        style={{ backgroundColor: currentChallenge.challengerClan.color }}
                      >
                        {EMBLEM_ICONS[currentChallenge.challengerClan.emblem]}
                      </motion.div>
                      <div>
                        <div className="font-black text-white text-lg">
                          {currentChallenge.challengerClan.name}
                        </div>
                        <div className="text-white/80 text-sm flex items-center gap-2">
                          {currentChallenge.defenderClan ? (
                            <>
                              <Swords className="w-4 h-4" />
                              vs {currentChallenge.defenderClan.name}
                            </>
                          ) : (
                            <>
                              <Target className="w-4 h-4" />
                              Conquista
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Timer épico */}
                    <motion.div 
                      animate={timer <= 10 ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 0.5 }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-xl font-black ${
                        timer <= 10 
                          ? 'bg-red-500 text-white animate-pulse' 
                          : timer <= 20 
                          ? 'bg-yellow-400 text-yellow-900' 
                          : 'bg-white/20 text-white'
                      }`}
                    >
                      <Clock className="w-5 h-5" />
                      <span>{timer}s</span>
                    </motion.div>
                  </div>
                </div>

                <div className="p-6">
                  {/* Territorio en juego */}
                  <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="flex items-center gap-3 mb-5 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl border border-indigo-200 dark:border-indigo-700"
                  >
                    <span className="text-3xl">{currentChallenge.territory.icon}</span>
                    <div>
                      <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">🎯 Territorio en juego</div>
                      <div className="font-bold text-gray-900 dark:text-white">{currentChallenge.territory.name}</div>
                    </div>
                  </motion.div>

                  {/* Pregunta */}
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="mb-6"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                        currentChallenge.question.difficulty === 'EASY' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        currentChallenge.question.difficulty === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {currentChallenge.question.difficulty === 'EASY' ? '⭐ Fácil' :
                         currentChallenge.question.difficulty === 'MEDIUM' ? '⭐⭐ Media' : '⭐⭐⭐ Difícil'}
                      </span>
                      {gameState?.questionStats && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          📝 Desafío #{gameState.questionStats.current} ({gameState.questionStats.uniqueUsed}/{gameState.questionStats.total} preguntas únicas)
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 leading-relaxed">
                      {currentChallenge.question.text}
                    </h3>

                    {currentChallenge.question.imageUrl && (
                      <img
                        src={currentChallenge.question.imageUrl}
                        alt="Imagen de la pregunta"
                        className="max-h-48 mx-auto rounded-lg mb-4"
                      />
                    )}

                    {/* Opciones */}
                    {(() => {
                      const parsedQuestion = parseQuestionData(currentChallenge.question as any);
                      const questionType = parsedQuestion.type;
                      const options = parsedQuestion.options;
                      const pairs = parsedQuestion.pairs;
                      
                      // Obtener correctAnswer
                      const rawQuestion = currentChallenge.question as any;
                      let correctAnswer: any = rawQuestion.correctAnswer;
                      
                      // Helper para parsear correctAnswer de forma robusta
                      const parseCorrectAnswer = (val: any): any => {
                        if (val === null || val === undefined) return null;
                        if (typeof val === 'boolean') return val;
                        if (typeof val === 'number') return val === 1;
                        if (typeof val === 'string') {
                          // Caso: "true" o "false" directo
                          if (val.toLowerCase() === 'true') return true;
                          if (val.toLowerCase() === 'false') return false;
                          // Caso: JSON string (puede estar doblemente serializado)
                          try {
                            let parsed = JSON.parse(val);
                            return parseCorrectAnswer(parsed); // Recursivo para doble serialización
                          } catch {
                            return val;
                          }
                        }
                        return val;
                      };
                      
                      correctAnswer = parseCorrectAnswer(correctAnswer);

                      // MULTIPLE_CHOICE (permite seleccionar múltiples)
                      if (questionType === 'MULTIPLE_CHOICE' && Array.isArray(options) && options.length > 0) {
                        const correctCount = options.filter((o: any) => o.isCorrect).length;
                        const handleMultipleSelect = (idx: number) => {
                          if (showAnswer) return;
                          setSelectedAnswers(prev => {
                            if (prev.includes(idx)) {
                              return prev.filter(i => i !== idx);
                            } else {
                              return [...prev, idx];
                            }
                          });
                        };
                        
                        return (
                          <div className="space-y-2">
                            <p className="text-sm text-gray-500 mb-2">
                              Selecciona {correctCount} respuesta{correctCount > 1 ? 's' : ''} correcta{correctCount > 1 ? 's' : ''}
                            </p>
                            {options.map((option: any, idx: number) => {
                              const isSelected = selectedAnswers.includes(idx);
                              return (
                                <button
                                  key={idx}
                                  onClick={() => handleMultipleSelect(idx)}
                                  disabled={showAnswer}
                                  className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-2 ${
                                    showAnswer && option.isCorrect
                                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                      : showAnswer && isSelected && !option.isCorrect
                                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                      : isSelected
                                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                      : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                    isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                                  }`}>
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                                  <span className="flex-1">{option.text}</span>
                                  {showAnswer && option.isCorrect && (
                                    <Check className="w-4 h-4 text-green-500" />
                                  )}
                                  {showAnswer && isSelected && !option.isCorrect && (
                                    <X className="w-4 h-4 text-red-500" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        );
                      }

                      // SINGLE_CHOICE (solo una respuesta)
                      if (questionType === 'SINGLE_CHOICE' && Array.isArray(options) && options.length > 0) {
                        return (
                          <div className="space-y-2">
                            {options.map((option: any, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => !showAnswer && setSelectedAnswer(idx)}
                                disabled={showAnswer}
                                className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-2 ${
                                  showAnswer && option.isCorrect
                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                    : showAnswer && selectedAnswer === idx && !option.isCorrect
                                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                    : selectedAnswer === idx
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                    : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                  selectedAnswer === idx ? 'border-indigo-500' : 'border-gray-300'
                                }`}>
                                  {selectedAnswer === idx && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                                </div>
                                <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                                <span className="flex-1">{option.text}</span>
                                {showAnswer && option.isCorrect && (
                                  <Check className="w-4 h-4 text-green-500" />
                                )}
                                {showAnswer && selectedAnswer === idx && !option.isCorrect && (
                                  <X className="w-4 h-4 text-red-500" />
                                )}
                              </button>
                            ))}
                          </div>
                        );
                      }

                      // TRUE_FALSE
                      if (questionType === 'TRUE_FALSE') {
                        // Determinar si la respuesta correcta es TRUE
                        // correctAnswer puede ser: true, "true", '"true"', 1, etc.
                        let isCorrectTrue = false;
                        if (correctAnswer === true) {
                          isCorrectTrue = true;
                        } else if (correctAnswer === 1) {
                          isCorrectTrue = true;
                        } else if (typeof correctAnswer === 'string') {
                          // Limpiar comillas y espacios
                          const cleaned = correctAnswer.replace(/"/g, '').trim().toLowerCase();
                          isCorrectTrue = cleaned === 'true';
                        }
                        return (
                          <div className="flex gap-4 justify-center">
                            <button
                              onClick={() => !showAnswer && setSelectedAnswer(1)}
                              disabled={showAnswer}
                              className={`px-6 py-3 rounded-lg border transition-all ${
                                showAnswer && isCorrectTrue
                                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                  : showAnswer && selectedAnswer === 1 && !isCorrectTrue
                                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                  : selectedAnswer === 1
                                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300'
                              }`}
                            >
                              Verdadero
                              {showAnswer && isCorrectTrue && <Check className="w-4 h-4 text-green-500 inline ml-2" />}
                            </button>
                            <button
                              onClick={() => !showAnswer && setSelectedAnswer(0)}
                              disabled={showAnswer}
                              className={`px-6 py-3 rounded-lg border transition-all ${
                                showAnswer && !isCorrectTrue
                                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                  : showAnswer && selectedAnswer === 0 && isCorrectTrue
                                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                  : selectedAnswer === 0
                                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300'
                              }`}
                            >
                              Falso
                              {showAnswer && !isCorrectTrue && <Check className="w-4 h-4 text-green-500 inline ml-2" />}
                            </button>
                          </div>
                        );
                      }

                      // MATCHING - componente interactivo
                      if (questionType === 'MATCHING') {
                        if (Array.isArray(pairs) && pairs.length > 0) {
                          return (
                            <MatchingQuestion 
                              pairs={pairs} 
                              shuffledPairs={shuffledMatchingPairs.length > 0 ? shuffledMatchingPairs : pairs} 
                              showAnswer={showAnswer} 
                            />
                          );
                        }
                        return null;
                      }

                      return null;
                    })()}
                  </motion.div>

                  {/* Botón mostrar respuesta */}
                  {!showAnswer && (
                    <Button
                      variant="secondary"
                      onClick={() => { setShowAnswer(true); setTimerActive(false); }}
                      className="w-full mb-4"
                    >
                      Mostrar Respuesta Correcta
                    </Button>
                  )}

                  {/* Botones de resolución - solo visibles después de mostrar respuesta */}
                  {showAnswer && (
                    <div className="flex gap-3">
                      <Button
                        variant="danger"
                        onClick={() => handleResolve(false)}
                        disabled={resolveMutation.isPending}
                        className="flex-1 gap-2"
                      >
                        <X className="w-4 h-4" /> Incorrecto
                      </Button>
                      <Button
                        onClick={() => handleResolve(true)}
                        disabled={resolveMutation.isPending}
                        className="flex-1 gap-2"
                      >
                        <Check className="w-4 h-4" /> Correcto
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* VS Animation */}
          {showVsAnimation && vsData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center z-50"
            >
              <div className="text-center">
                {/* Territory being contested */}
                <motion.div
                  initial={{ y: -50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mb-8"
                >
                  <div className="text-6xl mb-2">{vsData.territory?.icon || '🏰'}</div>
                  <div className="text-white text-xl font-bold">{vsData.territory?.name}</div>
                  <div className="text-purple-300 text-sm">
                    {vsData.defender ? '¡Batalla por el territorio!' : '¡Conquista!'}
                  </div>
                </motion.div>

                <div className="flex items-center justify-center gap-8">
                  {/* Challenger */}
                  <motion.div
                    initial={{ x: -200, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 100, delay: 0.3 }}
                    className="text-center"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mx-auto mb-3 shadow-2xl"
                      style={{ backgroundColor: vsData.challenger?.color || '#6366f1' }}
                    >
                      {EMBLEM_ICONS[vsData.challenger?.emblem] || '⚔️'}
                    </motion.div>
                    <div className="text-white font-bold text-xl">{vsData.challenger?.name}</div>
                    <div className="text-yellow-400 text-sm">⚔️ Atacante</div>
                  </motion.div>

                  {/* VS */}
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.6 }}
                    className="relative"
                  >
                    <motion.div
                      animate={{ 
                        scale: [1, 1.2, 1],
                        textShadow: [
                          '0 0 20px #fff',
                          '0 0 60px #ff0',
                          '0 0 20px #fff'
                        ]
                      }}
                      transition={{ repeat: Infinity, duration: 0.8 }}
                      className="text-6xl font-black text-yellow-400"
                      style={{ textShadow: '0 0 30px rgba(255,215,0,0.8)' }}
                    >
                      VS
                    </motion.div>
                  </motion.div>

                  {/* Defender or Territory */}
                  <motion.div
                    initial={{ x: 200, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 100, delay: 0.3 }}
                    className="text-center"
                  >
                    {vsData.defender ? (
                      <>
                        <motion.div
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5, delay: 0.5 }}
                          className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mx-auto mb-3 shadow-2xl"
                          style={{ backgroundColor: vsData.defender?.color || '#ef4444' }}
                        >
                          {EMBLEM_ICONS[vsData.defender?.emblem] || '🛡️'}
                        </motion.div>
                        <div className="text-white font-bold text-xl">{vsData.defender?.name}</div>
                        <div className="text-blue-400 text-sm">🛡️ Defensor</div>
                      </>
                    ) : (
                      <>
                        <motion.div
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5, delay: 0.5 }}
                          className="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center text-5xl mx-auto mb-3 shadow-2xl"
                        >
                          🏴
                        </motion.div>
                        <div className="text-white font-bold text-xl">Territorio Neutral</div>
                        <div className="text-gray-400 text-sm">Sin defensor</div>
                      </>
                    )}
                  </motion.div>
                </div>

                {/* Loading indicator */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5 }}
                  className="mt-12"
                >
                  <div className="text-white text-lg mb-2">Preparando pregunta...</div>
                  <div className="flex justify-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ y: [0, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.2 }}
                        className="w-3 h-3 bg-yellow-400 rounded-full"
                      />
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Victory/Defeat Animation */}
          {showResultAnimation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`fixed inset-0 flex items-center justify-center z-50 ${
                showResultAnimation === 'victory' 
                  ? 'bg-gradient-to-br from-green-900 via-emerald-800 to-teal-900' 
                  : 'bg-gradient-to-br from-red-900 via-rose-800 to-pink-900'
              }`}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="text-center"
              >
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: showResultAnimation === 'victory' ? [0, 10, -10, 0] : [0, -5, 5, 0]
                  }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-9xl mb-6"
                >
                  {showResultAnimation === 'victory' ? '🏆' : '💔'}
                </motion.div>
                
                <motion.h2
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className={`text-5xl font-black mb-4 ${
                    showResultAnimation === 'victory' ? 'text-yellow-400' : 'text-red-400'
                  }`}
                  style={{ textShadow: '0 0 30px rgba(255,255,255,0.5)' }}
                >
                  {showResultAnimation === 'victory' ? '¡VICTORIA!' : '¡DERROTA!'}
                </motion.h2>
                
                <motion.p
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-white text-xl"
                >
                  {showResultAnimation === 'victory' 
                    ? '¡El territorio ha sido conquistado!' 
                    : 'El territorio permanece sin cambios'}
                </motion.p>

                {showResultAnimation === 'victory' && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.7, type: 'spring' }}
                    className="mt-6 flex justify-center gap-2"
                  >
                    {['⭐', '✨', '🌟', '✨', '⭐'].map((star, i) => (
                      <motion.span
                        key={i}
                        animate={{ y: [0, -10, 0], opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1, delay: i * 0.1 }}
                        className="text-3xl"
                      >
                        {star}
                      </motion.span>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Confetti effect para resultados
  useEffect(() => {
    if (gameState && viewMode === 'results') {
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#9333ea', '#3b82f6']
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#9333ea', '#3b82f6']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [gameState, viewMode]);

  const getMedalEmoji = (position: number) => {
    switch (position) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return `#${position + 1}`;
    }
  };

  const renderResults = () => {
    if (!selectedGame) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => { setViewMode('list'); setSelectedGame(null); }}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">🏆 Resultados: {selectedGame.name}</h2>
            <p className="text-sm text-gray-500">Partida finalizada</p>
          </div>
        </div>

        {!gameState ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            {/* Podio del ganador */}
            {gameState.ranking.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="p-8 bg-gradient-to-br from-yellow-100 via-amber-50 to-orange-100 dark:from-yellow-900/30 dark:via-amber-900/20 dark:to-orange-900/30 border-2 border-yellow-300 dark:border-yellow-700 overflow-hidden relative">
                  {/* Decoración de fondo */}
                  <div className="absolute top-0 left-0 w-full h-full opacity-10">
                    <div className="absolute top-4 left-4 text-6xl">⚔️</div>
                    <div className="absolute top-4 right-4 text-6xl">🏰</div>
                    <div className="absolute bottom-4 left-1/4 text-4xl">🛡️</div>
                    <div className="absolute bottom-4 right-1/4 text-4xl">👑</div>
                  </div>

                  <div className="relative z-10 text-center">
                    <motion.div
                      initial={{ y: -20 }}
                      animate={{ y: 0 }}
                      transition={{ type: "spring", bounce: 0.5 }}
                    >
                      <Crown className="w-16 h-16 mx-auto text-yellow-500 mb-2" />
                    </motion.div>
                    <p className="text-lg text-yellow-700 dark:text-yellow-400 font-bold uppercase tracking-wider">
                      ¡Clan Conquistador!
                    </p>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3, type: "spring" }}
                      className="flex items-center justify-center gap-4 mt-4"
                    >
                      <div
                        className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-lg"
                        style={{ 
                          backgroundColor: gameState.ranking[0].clan?.color || '#6366f1',
                          boxShadow: `0 0 30px ${gameState.ranking[0].clan?.color || '#6366f1'}50`
                        }}
                      >
                        {EMBLEM_ICONS[gameState.ranking[0].clan?.emblem || 'shield']}
                      </div>
                    </motion.div>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-4">
                      {gameState.ranking[0].clan?.name}
                    </h3>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className="text-5xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                        {gameState.ranking[0].totalPoints}
                      </span>
                      <span className="text-xl text-yellow-600 dark:text-yellow-400">puntos</span>
                    </div>
                    <div className="flex justify-center gap-6 mt-4 text-sm">
                      <div className="bg-white/50 dark:bg-gray-800/50 px-4 py-2 rounded-full">
                        <span className="font-bold text-green-600">{gameState.ranking[0].territoriesOwned}</span>
                        <span className="text-gray-600 dark:text-gray-400 ml-1">territorios</span>
                      </div>
                      <div className="bg-white/50 dark:bg-gray-800/50 px-4 py-2 rounded-full">
                        <span className="font-bold text-blue-600">{gameState.ranking[0].territoriesConquered}</span>
                        <span className="text-gray-600 dark:text-gray-400 ml-1">conquistas</span>
                      </div>
                      <div className="bg-white/50 dark:bg-gray-800/50 px-4 py-2 rounded-full">
                        <span className="font-bold text-purple-600">{gameState.ranking[0].successfulDefenses}</span>
                        <span className="text-gray-600 dark:text-gray-400 ml-1">defensas</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Ranking completo */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" /> Ranking Final
              </h3>
              <div className="space-y-3">
                {gameState.ranking.map((score, idx) => (
                  <motion.div
                    key={score.clanId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-all hover:scale-[1.01] ${
                      idx === 0 ? 'bg-gradient-to-r from-yellow-100 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/20 border-2 border-yellow-300 dark:border-yellow-700' :
                      idx === 1 ? 'bg-gradient-to-r from-gray-100 to-slate-50 dark:from-gray-800 dark:to-slate-800 border border-gray-300 dark:border-gray-600' :
                      idx === 2 ? 'bg-gradient-to-r from-orange-100 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/10 border border-orange-300 dark:border-orange-700' :
                      'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <span className="text-3xl">{getMedalEmoji(idx)}</span>
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-md"
                      style={{ backgroundColor: score.clan?.color + '30' }}
                    >
                      {EMBLEM_ICONS[score.clan?.emblem || 'shield']}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-lg text-gray-900 dark:text-white">{score.clan?.name}</div>
                      <div className="text-sm text-gray-500 flex flex-wrap gap-3 mt-1">
                        <span className="flex items-center gap-1">
                          <Map className="w-3 h-3" /> {score.territoriesOwned} territorios
                        </span>
                        <span className="flex items-center gap-1">
                          <Swords className="w-3 h-3" /> {score.territoriesConquered} conquistas
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3" /> {score.successfulDefenses} defensas
                        </span>
                        {score.bestStreak > 0 && (
                          <span className="flex items-center gap-1 text-orange-500">
                            <Zap className="w-3 h-3" /> {score.bestStreak} racha
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        idx === 0 ? 'text-yellow-600' :
                        idx === 1 ? 'text-gray-600' :
                        idx === 2 ? 'text-orange-600' :
                        'text-indigo-600'
                      }`}>
                        {score.totalPoints}
                      </div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider">puntos</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>

            {/* Estadísticas de la partida */}
            <div className="grid gap-4 md:grid-cols-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="p-5 text-center bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800">
                  <div className="w-14 h-14 mx-auto rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-3">
                    <Swords className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                    {gameState.game.totalChallenges}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Desafíos Totales</div>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="p-5 text-center bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
                  <div className="w-14 h-14 mx-auto rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center mb-3">
                    <Target className="w-7 h-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {gameState.game.currentRound}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Rondas Jugadas</div>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="p-5 text-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800">
                  <div className="w-14 h-14 mx-auto rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center mb-3">
                    <Zap className="w-7 h-7 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {Math.max(...gameState.ranking.map(r => r.bestStreak), 0)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Mejor Racha</div>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="p-5 text-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
                  <div className="w-14 h-14 mx-auto rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mb-3">
                    <Users className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {gameState.clans.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Clanes Participantes</div>
                </Card>
              </motion.div>
            </div>

            {/* Botón volver */}
            <div className="flex justify-center pt-4">
              <Button 
                onClick={() => { setViewMode('list'); setSelectedGame(null); }}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a la Lista
              </Button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderMapEditor = () => {
    if (!editingMap) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => { setViewMode('list'); setEditingMap(null); }}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {editingMap.id ? 'Editar Mapa' : 'Crear Nuevo Mapa'}
            </h2>
            <p className="text-sm text-gray-500">Configura el mapa y sus territorios</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Configuración del mapa */}
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="w-5 h-5" /> Configuración del Mapa
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre del Mapa *
              </label>
              <input
                type="text"
                value={editingMap.name}
                onChange={(e) => setEditingMap({ ...editingMap, name: e.target.value })}
                placeholder="Ej: Reino de las Matemáticas"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descripción (opcional)
              </label>
              <textarea
                value={editingMap.description}
                onChange={(e) => setEditingMap({ ...editingMap, description: e.target.value })}
                placeholder="Descripción del mapa..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Columnas
                </label>
                <input
                  type="number"
                  value={editingMap.gridCols}
                  onChange={(e) => {
                    const newCols = Math.min(8, Math.max(1, parseInt(e.target.value) || 1));
                    const newRows = editingMap.gridRows;
                    const icons = ['🏰', '⛰️', '🌲', '🏛️', '🗼', '🏔️', '🌋', '🏝️', '🗿', '⚔️', '🛡️', '👑'];
                    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#22c55e', '#14b8a6', '#3b82f6'];
                    const territories = [];
                    for (let y = 0; y < newRows; y++) {
                      for (let x = 0; x < newCols; x++) {
                        const idx = y * newCols + x;
                        territories.push({
                          name: `Territorio ${idx + 1}`,
                          gridX: x, gridY: y,
                          icon: icons[idx % icons.length],
                          color: colors[idx % colors.length],
                          pointMultiplier: 100, isStrategic: false,
                        });
                      }
                    }
                    setEditingMap({ ...editingMap, gridCols: newCols, territories });
                  }}
                  min="1"
                  max="8"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Filas
                </label>
                <input
                  type="number"
                  value={editingMap.gridRows}
                  onChange={(e) => {
                    const newRows = Math.min(6, Math.max(1, parseInt(e.target.value) || 1));
                    const newCols = editingMap.gridCols;
                    const icons = ['🏰', '⛰️', '🌲', '🏛️', '🗼', '🏔️', '🌋', '🏝️', '🗿', '⚔️', '🛡️', '👑'];
                    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#22c55e', '#14b8a6', '#3b82f6'];
                    const territories = [];
                    for (let y = 0; y < newRows; y++) {
                      for (let x = 0; x < newCols; x++) {
                        const idx = y * newCols + x;
                        territories.push({
                          name: `Territorio ${idx + 1}`,
                          gridX: x, gridY: y,
                          icon: icons[idx % icons.length],
                          color: colors[idx % colors.length],
                          pointMultiplier: 100, isStrategic: false,
                        });
                      }
                    }
                    setEditingMap({ ...editingMap, gridRows: newRows, territories });
                  }}
                  min="1"
                  max="6"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  XP Conquista
                </label>
                <input
                  type="number"
                  value={editingMap.baseConquestPoints}
                  onChange={(e) => setEditingMap({ ...editingMap, baseConquestPoints: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  XP Defensa
                </label>
                <input
                  type="number"
                  value={editingMap.baseDefensePoints}
                  onChange={(e) => setEditingMap({ ...editingMap, baseDefensePoints: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bonus Racha
                </label>
                <input
                  type="number"
                  value={editingMap.bonusStreakPoints}
                  onChange={(e) => setEditingMap({ ...editingMap, bonusStreakPoints: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <Button onClick={handleGenerateTerritories} variant="secondary" className="w-full gap-2">
              <Grid className="w-4 h-4" />
              Generar {editingMap.gridCols * editingMap.gridRows} Territorios
            </Button>
          </Card>

          {/* Vista previa del mapa */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Map className="w-5 h-5" /> Vista Previa ({editingMap.territories.length} territorios)
            </h3>

            {editingMap.territories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Grid className="w-12 h-12 mb-2" />
                <p>Genera los territorios para ver la vista previa</p>
              </div>
            ) : (
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${editingMap.gridCols}, minmax(0, 1fr))`,
                }}
              >
                {editingMap.territories
                  .sort((a, b) => a.gridY - b.gridY || a.gridX - b.gridX)
                  .map((territory, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-center"
                      style={{ borderLeft: `4px solid ${territory.color}` }}
                    >
                      <div className="text-xl">{territory.icon}</div>
                      <input
                        type="text"
                        value={territory.name}
                        onChange={(e) => {
                          const newTerritories = [...editingMap.territories];
                          newTerritories[idx] = { ...territory, name: e.target.value };
                          setEditingMap({ ...editingMap, territories: newTerritories });
                        }}
                        className="w-full text-xs text-center bg-transparent border-none focus:outline-none text-gray-700 dark:text-gray-300"
                      />
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => { setViewMode('list'); setEditingMap(null); }}>
            Cancelar
          </Button>
          <Button
            onClick={handleSaveMap}
            disabled={!editingMap.name || editingMap.territories.length === 0 || createMapMutation.isPending}
            className="gap-2"
          >
            {createMapMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Guardar Mapa
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header con botón de volver - estilo como Actividades de Tiempo */}
      {viewMode === 'list' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl shadow-lg"
            >
              ⚔️
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conquista de Territorios</h1>
              <p className="text-gray-500 dark:text-gray-400">Batalla entre clanes por el control del mapa</p>
            </div>
          </div>
          <Button onClick={handleStartSetup} className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva Partida
          </Button>
        </div>
      )}

      {viewMode === 'list' && renderGamesList()}
      {viewMode === 'setup' && renderSetup()}
      {viewMode === 'game' && renderGame()}
      {viewMode === 'results' && renderResults()}
      {viewMode === 'map-editor' && renderMapEditor()}
    </div>
  );
};

export default TerritoryConquestActivity;
