import { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Trophy, Plus, Users, Swords, Play, Clock, Medal, Crown, CheckCircle, Star,
  ChevronRight, ChevronLeft, Trash2, Shuffle, X, Check, Target, Award, UserPlus, LayoutGrid,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  tournamentApi,
  type Tournament, type TournamentWithDetails, type TournamentParticipant,
  type TournamentMatch, type MatchWithDetails, type TournamentType,
  type TournamentParticipantType, type CreateTournamentData,
  TOURNAMENT_TYPE_LABELS, TOURNAMENT_STATUS_LABELS,
  PARTICIPANT_TYPE_LABELS, BRACKET_SIZES, TOURNAMENT_ICONS,
} from '../../lib/tournamentApi';
import { questionBankApi, type QuestionBank } from '../../lib/questionBankApi';
import { classroomApi } from '../../lib/classroomApi';
import { clanApi } from '../../lib/clanApi';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StudentAvatarMini } from '../avatar/StudentAvatarMini';
import type { AvatarGender } from '../../lib/avatarApi';

// Avatar component for tournaments - uses dynamic avatar system when studentId and gender are available
const ParticipantAvatar = ({ 
  name, 
  avatarUrl, 
  color, 
  size = 60,
  studentId,
  avatarGender 
}: { 
  name?: string | null; 
  avatarUrl?: string | null; 
  color?: string | null; 
  size?: number;
  studentId?: string | null;
  avatarGender?: AvatarGender | null;
}) => {
  // Si tenemos studentId y gender, usar el sistema de avatares dinámico
  if (studentId && avatarGender) {
    // Mapear tamaño del contenedor a tamaño del avatar
    // El avatar tiene ratio 1:1.74, así que necesitamos uno más grande y recortarlo
    const sizeMap: Record<number, 'xs' | 'sm' | 'md' | 'lg' | 'xl'> = {
      20: 'xs',
      24: 'xs',
      28: 'xs',
      36: 'xs',
      40: 'sm',
      44: 'sm',
      60: 'sm',
      64: 'md',
      80: 'md',
      100: 'md',
      112: 'lg',
      128: 'lg',
    };
    const avatarSize = sizeMap[size] || (size <= 30 ? 'xs' : size <= 50 ? 'sm' : size <= 70 ? 'md' : size <= 90 ? 'lg' : 'xl');
    return (
      <div 
        style={{ width: size, height: size }} 
        className="rounded-xl overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 relative"
      >
        {/* Contenedor que posiciona el avatar para mostrar cara/torso (movido a la izquierda) */}
        <div className="absolute z-0" style={{ top: '-5%', left: '-40%' }}>
          <StudentAvatarMini 
            studentProfileId={studentId} 
            gender={avatarGender} 
            size={avatarSize}
          />
        </div>
      </div>
    );
  }
  
  // Fallback: si hay avatarUrl, mostrar imagen
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name || ''} className="rounded-xl object-cover" style={{ width: size, height: size }} />;
  }
  
  // Fallback final: mostrar inicial
  const initial = (name || '?').charAt(0).toUpperCase();
  const bgColor = color || '#6366f1';
  return (
    <div className="rounded-xl flex items-center justify-center text-white font-bold" 
      style={{ width: size, height: size, backgroundColor: bgColor, fontSize: size * 0.4 }}>
      {initial}
    </div>
  );
};

// Tournament Victory Animation Component with canvas-confetti
const TournamentVictoryAnimation = ({ 
  winner, 
  second, 
  third,
  participants 
}: { 
  winner: TournamentParticipant;
  second?: TournamentParticipant | null;
  third?: TournamentParticipant | null;
  participants?: TournamentParticipant[];
}) => {
  // Disparar confetti al montar el componente
  useEffect(() => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#f59e0b', '#fbbf24', '#f97316', '#ef4444', '#ec4899', '#8b5cf6']
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#f59e0b', '#fbbf24', '#f97316', '#ef4444', '#ec4899', '#8b5cf6']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    
    // Confetti inicial grande
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#fbbf24', '#f97316', '#ef4444', '#ec4899', '#8b5cf6']
    });
    
    frame();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/20 dark:via-yellow-900/20 dark:to-orange-900/20 rounded-2xl p-8 border-2 border-amber-300 shadow-xl"
    >
      <div className="relative z-10">
        <motion.h2 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center text-2xl md:text-3xl font-black text-amber-700 dark:text-amber-400 mb-6"
        >
          🏆 ¡Torneo Finalizado! 🏆
        </motion.h2>
        
        {/* Podio */}
        <div className="flex items-end justify-center gap-4 md:gap-8">
          {/* 2do Lugar */}
          {second && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center"
            >
              <div className="relative inline-block mb-2">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl ring-4 ring-gray-300 overflow-hidden shadow-lg">
                  <ParticipantAvatar 
                    name={second.student?.displayName || second.clan?.name} 
                    avatarUrl={second.student?.avatarUrl} 
                    studentId={second.student?.id}
                    avatarGender={second.student?.avatarGender}
                    color={second.clan?.color} 
                    size={80} 
                  />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white font-bold shadow-lg">2</div>
              </div>
              <p className="font-bold text-gray-700 dark:text-gray-300 text-sm">{second.student?.displayName?.split(' ')[0] || second.clan?.name}</p>
              <div className="w-16 md:w-20 h-16 bg-gradient-to-t from-gray-400 to-gray-300 rounded-t-lg mt-2 flex items-center justify-center">
                <span className="text-white font-bold text-lg">🥈</span>
              </div>
            </motion.div>
          )}
          
          {/* 1er Lugar - Campeón */}
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="relative inline-block mb-2"
            >
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl ring-4 ring-amber-400 overflow-hidden shadow-xl shadow-amber-500/30">
                  <ParticipantAvatar 
                    name={winner.student?.displayName || winner.clan?.name} 
                    avatarUrl={winner.student?.avatarUrl}
                    studentId={winner.student?.id}
                    avatarGender={winner.student?.avatarGender}
                    color={winner.clan?.color} 
                    size={128} 
                  />
                </div>
              </motion.div>
              <motion.div 
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.5, type: 'spring' }}
                className="absolute -top-4 -right-4 w-12 h-12 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center shadow-lg"
              >
                <Crown size={24} className="text-white" />
              </motion.div>
            </motion.div>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="font-black text-xl text-amber-700 dark:text-amber-400"
            >
              {winner.student?.displayName?.split(' ')[0] || winner.clan?.name}
            </motion.p>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-amber-600 dark:text-amber-500 font-semibold"
            >
              🎉 ¡CAMPEÓN! 🎉
            </motion.p>
            <div className="w-20 md:w-28 h-24 bg-gradient-to-t from-amber-500 to-amber-400 rounded-t-lg mt-2 flex items-center justify-center">
              <span className="text-white font-bold text-2xl">🥇</span>
            </div>
          </motion.div>
          
          {/* 3er Lugar */}
          {third && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center"
            >
              <div className="relative inline-block mb-2">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl ring-4 ring-orange-300 overflow-hidden shadow-lg">
                  <ParticipantAvatar 
                    name={third.student?.displayName || third.clan?.name} 
                    avatarUrl={third.student?.avatarUrl}
                    studentId={third.student?.id}
                    avatarGender={third.student?.avatarGender}
                    color={third.clan?.color} 
                    size={64} 
                  />
                </div>
                <div className="absolute -top-2 -right-2 w-7 h-7 bg-orange-400 rounded-full flex items-center justify-center text-white font-bold shadow-lg text-sm">3</div>
              </div>
              <p className="font-bold text-gray-700 dark:text-gray-300 text-sm">{third.student?.displayName?.split(' ')[0] || third.clan?.name}</p>
              <div className="w-14 md:w-16 h-12 bg-gradient-to-t from-orange-400 to-orange-300 rounded-t-lg mt-2 flex items-center justify-center">
                <span className="text-white font-bold">🥉</span>
              </div>
            </motion.div>
          )}
        </div>
        
        {/* Lista de todos los participantes */}
        {participants && participants.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="mt-8 pt-6 border-t border-amber-200 dark:border-amber-800"
          >
            <h4 className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4">Todos los participantes</h4>
            <div className="flex flex-wrap justify-center gap-3">
              {participants.sort((a, b) => (a.finalPosition || 99) - (b.finalPosition || 99)).map((p, i) => (
                <motion.div 
                  key={p.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.2 + i * 0.1 }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                    p.finalPosition === 1 ? 'bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-400' :
                    p.finalPosition === 2 ? 'bg-gray-100 dark:bg-gray-800 ring-2 ring-gray-400' :
                    p.finalPosition === 3 ? 'bg-orange-100 dark:bg-orange-900/30 ring-2 ring-orange-400' :
                    'bg-white dark:bg-gray-800'
                  }`}
                >
                  <ParticipantAvatar 
                    name={p.student?.displayName || p.clan?.name} 
                    avatarUrl={p.student?.avatarUrl}
                    studentId={p.student?.id}
                    avatarGender={p.student?.avatarGender}
                    color={p.clan?.color} 
                    size={28} 
                  />
                  <span className="text-sm font-medium">{p.student?.displayName?.split(' ')[0] || p.clan?.name}</span>
                  {p.finalPosition && p.finalPosition <= 3 && (
                    <span className="text-xs">{p.finalPosition === 1 ? '🥇' : p.finalPosition === 2 ? '🥈' : '🥉'}</span>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// League View Component (Round-Robin)
const LeagueView = ({ 
  tournament, 
  onBack, 
  onMatchClick 
}: { 
  tournament: TournamentWithDetails;
  onBack: () => void;
  onMatchClick: (m: TournamentMatch) => void;
}) => {
  const [selectedRound, setSelectedRound] = useState<number | 'all'>('all');
  
  // Calcular tabla de posiciones
  const standings = useMemo(() => {
    if (!tournament.participants) return [];
    
    return tournament.participants.map(p => {
      // Contar partidos jugados, ganados, empatados, perdidos
      const matches = tournament.matches?.filter(m => 
        m.status === 'COMPLETED' && 
        (m.participant1Id === p.id || m.participant2Id === p.id)
      ) || [];
      
      let wins = 0, draws = 0, losses = 0, pointsFor = 0, pointsAgainst = 0;
      
      matches.forEach(m => {
        const isP1 = m.participant1Id === p.id;
        const myScore = isP1 ? m.participant1Score : m.participant2Score;
        const oppScore = isP1 ? m.participant2Score : m.participant1Score;
        
        pointsFor += myScore;
        pointsAgainst += oppScore;
        
        if (m.winnerId === p.id) wins++;
        else if (m.winnerId === null && m.status === 'COMPLETED') draws++;
        else losses++;
      });
      
      // Puntos: 3 por victoria, 1 por empate, 0 por derrota
      const points = wins * 3 + draws;
      
      return {
        participant: p,
        played: matches.length,
        wins,
        draws,
        losses,
        pointsFor,
        pointsAgainst,
        goalDiff: pointsFor - pointsAgainst,
        points
      };
    }).sort((a, b) => {
      // Ordenar por puntos, luego por diferencia de puntos, luego por puntos a favor
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      return b.pointsFor - a.pointsFor;
    });
  }, [tournament.participants, tournament.matches]);

  // Agrupar matches por ronda
  const matchesByRound: Record<number, TournamentMatch[]> = {};
  tournament.matches?.forEach(m => {
    if (!matchesByRound[m.round]) matchesByRound[m.round] = [];
    matchesByRound[m.round].push(m);
  });
  const rounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

  const getP = (id: string | null) => id ? tournament.participants?.find(p => p.id === id) : null;
  
  const filteredMatches = selectedRound === 'all' 
    ? tournament.matches || []
    : matchesByRound[selectedRound] || [];

  const completedMatches = tournament.matches?.filter(m => m.status === 'COMPLETED').length || 0;
  const totalMatches = tournament.matches?.length || 0;
  const progress = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;

  // Verificar si el torneo está finalizado
  const isTournamentFinished = tournament.status === 'FINISHED';
  const winner = standings[0]?.participant;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-6 space-y-6">
      {/* Victoria Animation */}
      {isTournamentFinished && winner && (
        <TournamentVictoryAnimation 
          winner={winner} 
          second={standings[1]?.participant} 
          third={standings[2]?.participant}
          participants={tournament.participants}
        />
      )}

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <button onClick={onBack} 
            className="p-3 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl shadow-lg transition-all hover:scale-105">
            <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
              <Trophy size={28} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-800 dark:text-white">Liga</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{tournament.name}</p>
            </div>
          </div>
        </div>
        
        {/* Progress */}
        <div className="hidden md:flex items-center gap-4 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {completedMatches} / {totalMatches} partidos
          </div>
          <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-emerald-500 to-green-500"
            />
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tabla de Posiciones */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="bg-gradient-to-r from-emerald-500 to-green-500 p-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Medal size={20} />
              Tabla de Posiciones
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300">#</th>
                  <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300">Participante</th>
                  <th className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">PJ</th>
                  <th className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">G</th>
                  <th className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">E</th>
                  <th className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">P</th>
                  <th className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">DIF</th>
                  <th className="px-3 py-2 text-center font-bold text-gray-800 dark:text-white">PTS</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.participant.id} className={`border-t border-gray-100 dark:border-gray-700 ${
                    i === 0 ? 'bg-amber-50 dark:bg-amber-900/20' :
                    i === 1 ? 'bg-gray-50 dark:bg-gray-800/50' :
                    i === 2 ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                  }`}>
                    <td className="px-3 py-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-amber-400 text-white' :
                        i === 1 ? 'bg-gray-400 text-white' :
                        i === 2 ? 'bg-orange-400 text-white' :
                        'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <ParticipantAvatar 
                          name={s.participant.student?.displayName || s.participant.clan?.name}
                          avatarUrl={s.participant.student?.avatarUrl}
                          studentId={s.participant.student?.id}
                          avatarGender={s.participant.student?.avatarGender}
                          color={s.participant.clan?.color}
                          size={28}
                        />
                        <span className="font-medium text-gray-800 dark:text-white truncate max-w-[100px]">
                          {s.participant.student?.displayName?.split(' ')[0] || s.participant.clan?.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{s.played}</td>
                    <td className="px-3 py-2 text-center text-green-600">{s.wins}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{s.draws}</td>
                    <td className="px-3 py-2 text-center text-red-500">{s.losses}</td>
                    <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">
                      <span className={s.goalDiff > 0 ? 'text-green-600' : s.goalDiff < 0 ? 'text-red-500' : ''}>
                        {s.goalDiff > 0 ? '+' : ''}{s.goalDiff}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-gray-800 dark:text-white">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Partidos */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* Filtro de jornadas */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedRound('all')}
              className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                selectedRound === 'all'
                  ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Todos
            </button>
            {rounds.map(r => (
              <button
                key={r}
                onClick={() => setSelectedRound(r)}
                className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                  selectedRound === r
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Jornada {r}
              </button>
            ))}
          </div>

          {/* Lista de partidos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMatches.map((m, i) => {
              const p1 = getP(m.participant1Id);
              const p2 = getP(m.participant2Id);
              const isCompleted = m.status === 'COMPLETED';
              const isInProgress = m.status === 'IN_PROGRESS';
              
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => onMatchClick(m)}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-all hover:scale-[1.02] ${
                    isInProgress ? 'ring-2 ring-amber-400' : ''
                  }`}
                >
                  {/* Header del match */}
                  <div className={`px-4 py-2 text-xs font-medium ${
                    isCompleted ? 'bg-green-500 text-white' :
                    isInProgress ? 'bg-amber-500 text-white' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    Jornada {m.round} • Partido {m.matchNumber}
                    {isInProgress && <span className="ml-2 animate-pulse">⚡ En curso</span>}
                  </div>
                  
                  {/* Participantes */}
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      {/* P1 */}
                      <div className="flex items-center gap-3 flex-1">
                        <ParticipantAvatar 
                          name={p1?.student?.displayName || p1?.clan?.name}
                          avatarUrl={p1?.student?.avatarUrl}
                          studentId={p1?.student?.id}
                          avatarGender={p1?.student?.avatarGender}
                          color={p1?.clan?.color}
                          size={40}
                        />
                        <span className={`font-medium truncate ${
                          isCompleted && m.winnerId === m.participant1Id ? 'text-green-600 font-bold' : 'text-gray-800 dark:text-white'
                        }`}>
                          {p1?.student?.displayName?.split(' ')[0] || p1?.clan?.name || 'TBD'}
                        </span>
                      </div>
                      
                      {/* Score */}
                      <div className="flex items-center gap-2 px-4">
                        <span className={`text-2xl font-black ${
                          isCompleted && m.winnerId === m.participant1Id ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {m.participant1Score}
                        </span>
                        <span className="text-gray-400">-</span>
                        <span className={`text-2xl font-black ${
                          isCompleted && m.winnerId === m.participant2Id ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {m.participant2Score}
                        </span>
                      </div>
                      
                      {/* P2 */}
                      <div className="flex items-center gap-3 flex-1 justify-end">
                        <span className={`font-medium truncate ${
                          isCompleted && m.winnerId === m.participant2Id ? 'text-green-600 font-bold' : 'text-gray-800 dark:text-white'
                        }`}>
                          {p2?.student?.displayName?.split(' ')[0] || p2?.clan?.name || 'TBD'}
                        </span>
                        <ParticipantAvatar 
                          name={p2?.student?.displayName || p2?.clan?.name}
                          avatarUrl={p2?.student?.avatarUrl}
                          studentId={p2?.student?.id}
                          avatarGender={p2?.student?.avatarGender}
                          color={p2?.clan?.color}
                          size={40}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// Tournament Card Component
const TournamentCard = ({ tournament, index, onClick, getStatusColor }: { 
  tournament: Tournament; 
  index: number; 
  onClick: () => void;
  getStatusColor: (s: string) => string;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02, y: -4 }}
      onClick={onClick}
      className="relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all cursor-pointer group"
    >
      {/* Gradient header */}
      <div className={`h-2 ${
        tournament.status === 'ACTIVE' ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
        tournament.status === 'READY' ? 'bg-gradient-to-r from-blue-400 to-indigo-500' :
        tournament.status === 'FINISHED' ? 'bg-gradient-to-r from-purple-400 to-pink-500' :
        'bg-gradient-to-r from-gray-300 to-gray-400'
      }`} />
      
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-4xl">{tournament.icon}</div>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white text-lg">{tournament.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(tournament.status)}`}>
                {TOURNAMENT_STATUS_LABELS[tournament.status]}
              </span>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400 group-hover:text-amber-500 transition-colors" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
            <Users size={18} className="mx-auto text-indigo-500 mb-1" />
            <p className="text-lg font-bold text-gray-800 dark:text-white">{tournament.maxParticipants}</p>
            <p className="text-xs text-gray-500">Jugadores</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
            <Target size={18} className="mx-auto text-emerald-500 mb-1" />
            <p className="text-lg font-bold text-gray-800 dark:text-white">{tournament.questionsPerMatch}</p>
            <p className="text-xs text-gray-500">Preguntas</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
            <Swords size={18} className="mx-auto text-amber-500 mb-1" />
            <p className="text-lg font-bold text-gray-800 dark:text-white">{TOURNAMENT_TYPE_LABELS[tournament.type].split(' ')[0]}</p>
            <p className="text-xs text-gray-500">Tipo</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            {tournament.participantType === 'INDIVIDUAL' ? <Users size={12} /> : <Crown size={12} />}
            {PARTICIPANT_TYPE_LABELS[tournament.participantType]}
          </span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock size={12} /> {tournament.timePerQuestion}s/pregunta
          </span>
        </div>
      </div>
    </motion.div>
  );
};

interface TournamentsActivityProps {
  classroom: any;
  onBack: () => void;
}

type ViewMode = 'list' | 'detail' | 'bracket' | 'match';

export const TournamentsActivity = ({ classroom, onBack }: TournamentsActivityProps) => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTournament, setSelectedTournament] = useState<TournamentWithDetails | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithDetails | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddParticipantsModal, setShowAddParticipantsModal] = useState(false);

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments', classroom.id],
    queryFn: () => tournamentApi.getTournaments(classroom.id),
  });

  const { data: questionBanks = [] } = useQuery({
    queryKey: ['questionBanks', classroom.id],
    queryFn: () => questionBankApi.getBanks(classroom.id),
  });

  const { data: classroomData } = useQuery({
    queryKey: ['classroom', classroom.id],
    queryFn: () => classroomApi.getById(classroom.id),
  });
  const students = classroomData?.students || [];

  const { data: clans = [] } = useQuery({
    queryKey: ['clans', classroom.id],
    queryFn: () => clanApi.getClassroomClans(classroom.id),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTournamentData) => tournamentApi.createTournament(classroom.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments', classroom.id] });
      toast.success('Torneo creado');
      setShowCreateModal(false);
    },
    onError: () => toast.error('Error al crear'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tournamentApi.deleteTournament(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments', classroom.id] });
      toast.success('Torneo eliminado');
      setSelectedTournament(null);
      setViewMode('list');
    },
  });

  const generateBracketMutation = useMutation({
    mutationFn: (id: string) => tournamentApi.generateBracket(id),
    onSuccess: () => {
      toast.success('Bracket generado');
      refreshTournament();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const shuffleMutation = useMutation({
    mutationFn: (id: string) => tournamentApi.shuffleParticipants(id),
    onSuccess: () => { toast.success('Mezclados'); refreshTournament(); },
  });

  const addParticipantsMutation = useMutation({
    mutationFn: ({ tournamentId, participantIds, isIndividual }: any) =>
      tournamentApi.addMultipleParticipants(tournamentId, participantIds, isIndividual),
    onSuccess: () => {
      toast.success('Agregados');
      setShowAddParticipantsModal(false);
      refreshTournament();
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (id: string) => tournamentApi.removeParticipant(id),
    onSuccess: () => { toast.success('Eliminado'); refreshTournament(); },
  });

  const refreshTournament = async () => {
    if (selectedTournament) {
      const updated = await tournamentApi.getTournament(selectedTournament.id);
      setSelectedTournament(updated);
    }
  };

  const handleSelectTournament = async (t: Tournament) => {
    const details = await tournamentApi.getTournament(t.id);
    setSelectedTournament(details);
    setViewMode('detail');
  };

  const getStatusColor = (s: string) => {
    const c: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      READY: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      PAUSED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      FINISHED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    };
    return c[s] || c.DRAFT;
  };

  // List View
  if (viewMode === 'list') {
    return (
      <div className="space-y-5">
        {/* Header épico */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
              <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
              <Trophy size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">Torneos</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Competencias épicas de eliminación</p>
            </div>
          </div>
          <Button onClick={() => setShowCreateModal(true)} 
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            leftIcon={<Plus size={16} />}>
            Nuevo Torneo
          </Button>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <Card className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-2xl flex items-center justify-center">
              <Trophy className="w-10 h-10 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">No hay torneos creados</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-md mx-auto">
              Crea tu primer torneo para que tus estudiantes compitan en emocionantes brackets eliminatorios
            </p>
            <Button onClick={() => setShowCreateModal(true)} 
              className="bg-gradient-to-r from-amber-500 to-orange-500"
              leftIcon={<Plus size={16} />}>
              Crear primer Torneo
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Torneos Activos */}
            {tournaments.filter(t => t.status === 'ACTIVE').length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white">En Curso</h2>
                  <span className="text-sm text-gray-500">({tournaments.filter(t => t.status === 'ACTIVE').length})</span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {tournaments.filter(t => t.status === 'ACTIVE').map((t, index) => (
                    <TournamentCard key={t.id} tournament={t} index={index} onClick={() => handleSelectTournament(t)} getStatusColor={getStatusColor} />
                  ))}
                </div>
              </div>
            )}

            {/* Torneos Listos */}
            {tournaments.filter(t => t.status === 'READY').length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white">Listos para Iniciar</h2>
                  <span className="text-sm text-gray-500">({tournaments.filter(t => t.status === 'READY').length})</span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {tournaments.filter(t => t.status === 'READY').map((t, index) => (
                    <TournamentCard key={t.id} tournament={t} index={index} onClick={() => handleSelectTournament(t)} getStatusColor={getStatusColor} />
                  ))}
                </div>
              </div>
            )}

            {/* Borradores */}
            {tournaments.filter(t => t.status === 'DRAFT').length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-gray-400 rounded-full" />
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white">En Preparación</h2>
                  <span className="text-sm text-gray-500">({tournaments.filter(t => t.status === 'DRAFT').length})</span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {tournaments.filter(t => t.status === 'DRAFT').map((t, index) => (
                    <TournamentCard key={t.id} tournament={t} index={index} onClick={() => handleSelectTournament(t)} getStatusColor={getStatusColor} />
                  ))}
                </div>
              </div>
            )}

            {/* Finalizados */}
            {tournaments.filter(t => t.status === 'FINISHED').length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-purple-500 rounded-full" />
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white">Finalizados</h2>
                  <span className="text-sm text-gray-500">({tournaments.filter(t => t.status === 'FINISHED').length})</span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {tournaments.filter(t => t.status === 'FINISHED').map((t, index) => (
                    <TournamentCard key={t.id} tournament={t} index={index} onClick={() => handleSelectTournament(t)} getStatusColor={getStatusColor} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <CreateTournamentModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}
          onSubmit={(d: CreateTournamentData) => createMutation.mutate(d)} questionBanks={questionBanks} isLoading={createMutation.isPending} />
      </div>
    );
  }

  // Detail View
  if (viewMode === 'detail' && selectedTournament) {
    const pCount = selectedTournament.participants?.length || 0;
    const canGen = pCount >= 2 && selectedTournament.status === 'DRAFT';
    const isReady = selectedTournament.status === 'READY' || selectedTournament.status === 'ACTIVE';

    return (
      <div className="space-y-5">
        {/* Header con gradiente */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedTournament(null); setViewMode('list'); }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
              <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
            <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-3xl shadow-lg shadow-amber-500/30">
              {selectedTournament.icon}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">{selectedTournament.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(selectedTournament.status)}`}>
                {TOURNAMENT_STATUS_LABELS[selectedTournament.status]}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isReady && (
              <Button variant="secondary" onClick={() => setViewMode('bracket')} 
                className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 hover:from-indigo-600 hover:to-purple-600">
                <LayoutGrid size={18} className="mr-1" />Ver Bracket
              </Button>
            )}
            <Button variant="secondary" onClick={() => deleteMutation.mutate(selectedTournament.id)} 
              className="!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-900/20">
              <Trash2 size={18} />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mb-3">
              <Users className="text-indigo-500" size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{pCount}/{selectedTournament.maxParticipants}</p>
            <p className="text-sm text-gray-500">Participantes</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-3">
              <Target className="text-emerald-500" size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{selectedTournament.questionsPerMatch}</p>
            <p className="text-sm text-gray-500">Preguntas/Match</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center mb-3">
              <Clock className="text-amber-500" size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{selectedTournament.timePerQuestion}s</p>
            <p className="text-sm text-gray-500">Por pregunta</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-3">
              <Trophy className="text-purple-500" size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{selectedTournament.totalRounds}</p>
            <p className="text-sm text-gray-500">Rondas</p>
          </motion.div>
        </div>

        {/* Recompensas */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Award size={20} className="text-amber-500" />Recompensas del Torneo
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="relative text-center p-4 bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/20 rounded-2xl border-2 border-amber-200 dark:border-amber-700">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Crown className="text-amber-500" size={28} />
              </div>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">1°</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">+{selectedTournament.rewardXpFirst} XP</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">+{selectedTournament.rewardGpFirst} GP</p>
            </div>
            <div className="relative text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-600/30 rounded-2xl border-2 border-gray-200 dark:border-gray-600">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Medal className="text-gray-400" size={28} />
              </div>
              <p className="text-3xl font-bold text-gray-500 dark:text-gray-300 mt-2">2°</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">+{selectedTournament.rewardXpSecond} XP</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">+{selectedTournament.rewardGpSecond} GP</p>
            </div>
            <div className="relative text-center p-4 bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/20 rounded-2xl border-2 border-orange-200 dark:border-orange-700">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Medal className="text-orange-400" size={28} />
              </div>
              <p className="text-3xl font-bold text-orange-500 dark:text-orange-400 mt-2">3°</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">+{selectedTournament.rewardXpThird} XP</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">+{selectedTournament.rewardGpThird} GP</p>
            </div>
          </div>
        </motion.div>

        {/* Participantes */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Users size={20} className="text-indigo-500" />Participantes ({pCount})
            </h3>
            {selectedTournament.status === 'DRAFT' && (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => shuffleMutation.mutate(selectedTournament.id)} disabled={pCount < 2}
                  className="hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                  <Shuffle size={16} className="mr-1" />Mezclar
                </Button>
                <Button size="sm" onClick={() => setShowAddParticipantsModal(true)}
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600">
                  <UserPlus size={16} className="mr-1" />Agregar
                </Button>
              </div>
            )}
          </div>
          {pCount === 0 ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                <Users size={32} className="text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 mb-4">No hay participantes aún</p>
              <Button size="sm" onClick={() => setShowAddParticipantsModal(true)}
                className="bg-gradient-to-r from-indigo-500 to-purple-500">
                <UserPlus size={16} className="mr-1" />Agregar Participantes
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {selectedTournament.participants?.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  className={`group relative p-4 rounded-2xl border-2 transition-all ${
                    p.isEliminated ? 'opacity-50 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800' 
                    : p.finalPosition === 1 ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/20 shadow-lg shadow-amber-200/50' 
                    : p.finalPosition === 2 ? 'border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50'
                    : p.finalPosition === 3 ? 'border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/30'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 hover:shadow-md'
                  }`}>
                  {/* Seed badge */}
                  <div className="absolute -top-2 -left-2 w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                    {p.seed}
                  </div>
                  {/* Position badge */}
                  {p.finalPosition && (
                    <div className="absolute -top-2 -right-2">
                      {p.finalPosition === 1 && <div className="w-7 h-7 bg-amber-400 rounded-full flex items-center justify-center shadow-lg"><Crown size={16} className="text-white" /></div>}
                      {p.finalPosition === 2 && <div className="w-7 h-7 bg-gray-400 rounded-full flex items-center justify-center shadow-lg"><Medal size={16} className="text-white" /></div>}
                      {p.finalPosition === 3 && <div className="w-7 h-7 bg-orange-400 rounded-full flex items-center justify-center shadow-lg"><Medal size={16} className="text-white" /></div>}
                    </div>
                  )}
                  {/* Avatar */}
                  <div className="flex justify-center mb-3">
                    {p.student ? (
                      <div className="relative">
                        <ParticipantAvatar name={p.student.displayName} avatarUrl={p.student.avatarUrl} size={64} />
                        {p.student.characterClass && (
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center text-xs shadow border border-gray-200 dark:border-gray-600">
                            {p.student.characterClass === 'GUARDIAN' ? '🛡️' : p.student.characterClass === 'ARCANE' ? '🔮' : p.student.characterClass === 'EXPLORER' ? '🧭' : '⚗️'}
                          </div>
                        )}
                      </div>
                    ) : p.clan ? (
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg" 
                        style={{ backgroundColor: p.clan.color || '#6366f1' }}>
                        {p.clan.name.charAt(0)}
                      </div>
                    ) : null}
                  </div>
                  {/* Name & Level */}
                  <div className="text-center">
                    <div className="font-semibold text-sm text-gray-800 dark:text-white truncate">
                      {p.student?.displayName || p.clan?.name || 'Participante'}
                    </div>
                    {p.student && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">Nv.{p.student.level}</div>
                    )}
                  </div>
                  {/* Stats */}
                  {(p.matchesWon > 0 || p.matchesLost > 0) && (
                    <div className="mt-2 flex justify-center gap-2 text-xs">
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">{p.matchesWon}W</span>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">{p.matchesLost}L</span>
                    </div>
                  )}
                  {/* Remove button */}
                  {selectedTournament.status === 'DRAFT' && (
                    <button onClick={(e) => { e.stopPropagation(); removeParticipantMutation.mutate(p.id); }}
                      className="absolute top-1 right-1 p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors opacity-0 group-hover:opacity-100">
                      <X size={14} className="text-red-500" />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Generate Bracket Button */}
        {selectedTournament.status === 'DRAFT' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            className="flex justify-center">
            <Button size="lg" onClick={() => generateBracketMutation.mutate(selectedTournament.id)} 
              disabled={!canGen || generateBracketMutation.isPending}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30 px-8">
              {generateBracketMutation.isPending ? (
                <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />Generando...</>
              ) : (
                <><Swords size={20} className="mr-2" />Generar Bracket ({pCount} participantes)</>
              )}
            </Button>
          </motion.div>
        )}

        <AddParticipantsModal isOpen={showAddParticipantsModal} onClose={() => setShowAddParticipantsModal(false)}
          onSubmit={(ids: string[]) => addParticipantsMutation.mutate({ tournamentId: selectedTournament.id, participantIds: ids, isIndividual: selectedTournament.participantType === 'INDIVIDUAL' })}
          tournament={selectedTournament} students={students} clans={clans} isLoading={addParticipantsMutation.isPending} />
      </div>
    );
  }

  // Bracket View
  // League View (Round-Robin)
  if (viewMode === 'bracket' && selectedTournament?.matches && selectedTournament.type === 'LEAGUE') {
    return (
      <LeagueView 
        tournament={selectedTournament}
        onBack={() => setViewMode('detail')}
        onMatchClick={async (m: TournamentMatch) => {
          if (m.status === 'BYE') return;
          const details = await tournamentApi.getMatch(m.id);
          setSelectedMatch(details);
          setViewMode('match');
        }}
      />
    );
  }

  // Bracket View (Elimination)
  if (viewMode === 'bracket' && selectedTournament?.matches) {
    const byRound: Record<number, TournamentMatch[]> = {};
    selectedTournament.matches.forEach((m) => { if (!byRound[m.round]) byRound[m.round] = []; byRound[m.round].push(m); });
    const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
    const getP = (id: string | null) => id ? selectedTournament.participants?.find((p) => p.id === id) : null;
    const getRoundName = (r: number) => {
      const fromEnd = selectedTournament.totalRounds - r + 1;
      return fromEnd === 1 ? 'Final' : fromEnd === 2 ? 'Semifinales' : fromEnd === 3 ? 'Cuartos' : `Ronda ${r}`;
    };

    const handleMatchClick = async (m: TournamentMatch) => {
      if (m.status === 'BYE') return;
      const details = await tournamentApi.getMatch(m.id);
      setSelectedMatch(details);
      setViewMode('match');
    };
    
    // Obtener ganador del torneo (finalPosition === 1)
    const winner = selectedTournament.participants?.find(p => p.finalPosition === 1);
    const second = selectedTournament.participants?.find(p => p.finalPosition === 2);
    const third = selectedTournament.participants?.find(p => p.finalPosition === 3);
    const isTournamentFinished = selectedTournament.status === 'FINISHED';

    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 p-6 space-y-6">
        {/* Animación de Victoria cuando el torneo finaliza */}
        {isTournamentFinished && winner && (
          <TournamentVictoryAnimation 
            winner={winner} 
            second={second} 
            third={third} 
            participants={selectedTournament.participants}
          />
        )}
        
        {/* Header gamificado */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <button onClick={() => setViewMode('detail')} 
              className="p-3 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl shadow-lg transition-all hover:scale-105">
              <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Swords size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white">Bracket</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Ronda {selectedTournament.currentRound} de {selectedTournament.totalRounds}</p>
              </div>
            </div>
          </div>
          
          {/* Indicador de progreso */}
          <div className="hidden md:flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-lg">
            {rounds.map((r, i) => (
              <div key={r} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  r < selectedTournament.currentRound ? 'bg-green-500 text-white' :
                  r === selectedTournament.currentRound ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white animate-pulse' :
                  'bg-gray-200 dark:bg-gray-700 text-gray-500'
                }`}>
                  {r < selectedTournament.currentRound ? <Check size={16} /> : r}
                </div>
                {i < rounds.length - 1 && (
                  <div className={`w-6 h-1 rounded ${r < selectedTournament.currentRound ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Bracket con diseño gamificado */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="overflow-x-auto pb-4"
        >
          <div className="flex gap-6 md:gap-10 min-w-max p-4">
            {rounds.map((r, roundIdx) => (
              <motion.div 
                key={r} 
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: roundIdx * 0.1 }}
                className="flex flex-col"
              >
                {/* Round header */}
                <div className={`text-center mb-4 px-6 py-2 rounded-xl font-bold ${
                  r === selectedTournament.totalRounds 
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30' 
                    : r === selectedTournament.currentRound
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/30'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 shadow-md'
                }`}>
                  {getRoundName(r)}
                </div>
                
                {/* Matches */}
                <div className="flex flex-col gap-6 justify-around flex-1">
                  {byRound[r].map((m, matchIdx) => {
                    const p1 = getP(m.participant1Id), p2 = getP(m.participant2Id);
                    const isActive = m.status === 'IN_PROGRESS';
                    const isCompleted = m.status === 'COMPLETED';
                    const isBye = m.status === 'BYE';
                    const isReady = m.status === 'PENDING' && m.participant1Id && m.participant2Id;
                    
                    return (
                      <motion.div 
                        key={m.id} 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: roundIdx * 0.1 + matchIdx * 0.05 }}
                        whileHover={{ scale: 1.03, y: -4 }}
                        onClick={() => handleMatchClick(m)}
                        className={`relative w-72 rounded-2xl overflow-hidden cursor-pointer transition-all shadow-lg ${
                          isActive ? 'ring-2 ring-amber-400 shadow-amber-500/30' :
                          isCompleted ? 'ring-2 ring-green-400 shadow-green-500/20' :
                          isReady ? 'ring-2 ring-indigo-400 shadow-indigo-500/20 hover:shadow-indigo-500/40' :
                          'shadow-gray-200 dark:shadow-gray-900 hover:shadow-xl'
                        }`}
                      >
                        {/* Glow effect for active matches */}
                        {isActive && (
                          <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-orange-400/20 animate-pulse" />
                        )}
                        
                        {/* Participant 1 */}
                        <div className={`relative p-4 flex items-center gap-3 transition-all ${
                          m.winnerId === m.participant1Id 
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20' 
                            : 'bg-white dark:bg-gray-800'
                        }`}>
                          <div className="relative">
                            {p1?.student ? (
                              <ParticipantAvatar name={p1.student.displayName} avatarUrl={p1.student.avatarUrl} studentId={p1.student.id} avatarGender={p1.student.avatarGender} size={44} />
                            ) : p1?.clan ? (
                              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md" 
                                style={{ backgroundColor: p1.clan.color || '#6366f1' }}>
                                {p1.clan.name.charAt(0)}
                              </div>
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                <Users size={20} className="text-gray-400" />
                              </div>
                            )}
                            {m.winnerId === m.participant1Id && (
                              <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-lg"
                              >
                                <Crown size={12} className="text-white" />
                              </motion.div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-800 dark:text-white truncate">
                              {p1?.student?.displayName || p1?.clan?.name || 'TBD'}
                            </div>
                          </div>
                          <div className={`text-xl font-black ${m.winnerId === m.participant1Id ? 'text-green-600' : 'text-gray-400'}`}>
                            {m.participant1Score}
                          </div>
                        </div>
                        
                        {/* VS Divider */}
                        <div className="relative h-0">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800">
                            <span className="text-white font-black text-[10px]">VS</span>
                          </div>
                          <div className="absolute inset-x-0 top-1/2 h-px bg-gray-200 dark:bg-gray-700" />
                        </div>
                        
                        {/* Participant 2 */}
                        <div className={`relative p-4 flex items-center gap-3 transition-all ${
                          m.winnerId === m.participant2Id 
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20' 
                            : 'bg-white dark:bg-gray-800'
                        }`}>
                          <div className="relative">
                            {p2?.student ? (
                              <ParticipantAvatar name={p2.student.displayName} avatarUrl={p2.student.avatarUrl} studentId={p2.student.id} avatarGender={p2.student.avatarGender} size={44} />
                            ) : p2?.clan ? (
                              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md" 
                                style={{ backgroundColor: p2.clan.color || '#6366f1' }}>
                                {p2.clan.name.charAt(0)}
                              </div>
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                {isBye ? <span className="text-xs font-bold text-gray-400">BYE</span> : <Users size={20} className="text-gray-400" />}
                              </div>
                            )}
                            {m.winnerId === m.participant2Id && (
                              <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-lg"
                              >
                                <Crown size={12} className="text-white" />
                              </motion.div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-800 dark:text-white truncate">
                              {p2?.student?.displayName || p2?.clan?.name || (isBye ? 'BYE' : 'TBD')}
                            </div>
                          </div>
                          <div className={`text-xl font-black ${m.winnerId === m.participant2Id ? 'text-green-600' : 'text-gray-400'}`}>
                            {m.participant2Score}
                          </div>
                        </div>
                        
                        {/* Status footer */}
                        <div className={`px-4 py-2 text-center text-xs font-bold uppercase tracking-wide ${
                          isCompleted ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' :
                          isActive ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white animate-pulse' :
                          isReady ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white' :
                          isBye ? 'bg-gray-200 dark:bg-gray-700 text-gray-500' :
                          'bg-gray-100 dark:bg-gray-800 text-gray-500'
                        }`}>
                          {isCompleted ? '✓ Completado' : isActive ? '⚔️ En Curso' : isReady ? '▶ Listo para jugar' : isBye ? 'Pase automático' : 'Esperando...'}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
        
        {/* Botón volver al detalle */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center"
        >
          <Button variant="secondary" onClick={() => setViewMode('detail')} className="shadow-lg">
            <ChevronLeft size={18} className="mr-2" /> Volver al detalle del torneo
          </Button>
        </motion.div>
      </div>
    );
  }

  // Match View
  if (viewMode === 'match' && selectedMatch && selectedTournament) {
    const p1 = selectedMatch.participant1, p2 = selectedMatch.participant2;
    const p1AvatarUrl = p1?.student?.avatarUrl;
    const p2AvatarUrl = p2?.student?.avatarUrl;
    
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setSelectedMatch(null); setViewMode('bracket'); }} 
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Swords size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">{selectedMatch.bracketPosition || `Match ${selectedMatch.matchNumber}`}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ronda {selectedMatch.round}</p>
          </div>
        </div>

        {/* Match Controls con VS Card integrado */}
        <MatchControls 
          match={selectedMatch} 
          tournament={selectedTournament}
          p1AvatarUrl={p1AvatarUrl}
          p2AvatarUrl={p2AvatarUrl}
          onMatchUpdate={async () => { const u = await tournamentApi.getMatch(selectedMatch.id); setSelectedMatch(u); refreshTournament(); }}
          onMatchComplete={() => { setSelectedMatch(null); setViewMode('bracket'); refreshTournament(); }} 
        />
      </div>
    );
  }

  return null;
};

// Sub-components will be in separate file or below
const CreateTournamentModal = ({ isOpen, onClose, onSubmit, questionBanks, isLoading }: any) => {
  const [form, setForm] = useState<CreateTournamentData>({ name: '', type: 'BRACKET', participantType: 'INDIVIDUAL', questionBankIds: [], maxParticipants: 8, timePerQuestion: 30, questionsPerMatch: 3, pointsPerCorrect: 100, bonusTimePoints: 10, rewardXpFirst: 100, rewardXpSecond: 50, rewardXpThird: 25, rewardGpFirst: 50, rewardGpSecond: 25, rewardGpThird: 10, rewardXpParticipation: 10, icon: '🏆' });
  useEffect(() => { if (isOpen) setForm({ name: '', type: 'BRACKET', participantType: 'INDIVIDUAL', questionBankIds: [], maxParticipants: 8, timePerQuestion: 30, questionsPerMatch: 3, pointsPerCorrect: 100, bonusTimePoints: 10, rewardXpFirst: 100, rewardXpSecond: 50, rewardXpThird: 25, rewardGpFirst: 50, rewardGpSecond: 25, rewardGpThird: 10, rewardXpParticipation: 10, icon: '🏆' }); }, [isOpen]);
  const toggle = (id: string) => setForm(p => ({ ...p, questionBankIds: p.questionBankIds.includes(id) ? p.questionBankIds.filter(x => x !== id) : [...p.questionBankIds, id] }));
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!form.name.trim() || form.questionBankIds.length === 0) { toast.error('Completa nombre y bancos'); return; } onSubmit(form); };
  if (!isOpen) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold flex items-center gap-2"><Trophy className="text-amber-500" />Nuevo Torneo</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button></div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-[auto_1fr] gap-4">
            <div><label className="block text-sm font-medium mb-2">Icono</label>
              <div className="grid grid-cols-4 gap-2">{TOURNAMENT_ICONS.slice(0, 8).map(i => (
                <button key={i} type="button" onClick={() => setForm(p => ({ ...p, icon: i }))}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center ${form.icon === i ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'bg-gray-100 hover:bg-gray-200'}`}>{i}</button>
              ))}</div></div>
            <div><label className="block text-sm font-medium mb-2">Nombre *</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Torneo de Matemáticas"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" required /></div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-2">Tipo</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as TournamentType }))}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                {Object.entries(TOURNAMENT_TYPE_LABELS).filter(([v]) => v !== 'QUICKFIRE').map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className="block text-sm font-medium mb-2">Participantes</label>
              <select value={form.participantType} onChange={e => setForm(p => ({ ...p, participantType: e.target.value as TournamentParticipantType }))}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                {Object.entries(PARTICIPANT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-2">Máx. participantes</label>
              <select value={form.maxParticipants} onChange={e => setForm(p => ({ ...p, maxParticipants: Number(e.target.value) }))}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                {BRACKET_SIZES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="block text-sm font-medium mb-2">Preguntas/match</label>
              <input type="number" min={1} max={10} value={form.questionsPerMatch} onChange={e => setForm(p => ({ ...p, questionsPerMatch: Number(e.target.value) }))}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" /></div>
          </div>
          <div><label className="block text-sm font-medium mb-2">Bancos de preguntas *</label>
            {questionBanks.length === 0 ? <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">No hay bancos</div> : (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                {questionBanks.map((b: QuestionBank) => (
                  <button key={b.id} type="button" onClick={() => toggle(b.id)}
                    className={`p-3 rounded-lg text-left ${form.questionBankIds.includes(b.id) ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'bg-white dark:bg-gray-800 hover:bg-gray-100'}`}>
                    <div className="font-medium text-sm">{b.name}</div><div className="text-xs text-gray-500">{b.questionCount || 0} preguntas</div></button>
                ))}</div>
            )}</div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Creando...' : 'Crear Torneo'}</Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

const AddParticipantsModal = ({ isOpen, onClose, onSubmit, tournament, students, clans, isLoading }: any) => {
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => { if (isOpen) setSelected([]); }, [isOpen]);
  const isIndividual = tournament?.participantType === 'INDIVIDUAL';
  // Filtrar estudiantes activos y no demo
  const activeStudents = students.filter((s: any) => s.isActive !== false && s.isDemo !== true);
  const items = isIndividual ? activeStudents : clans;
  const existingIds = tournament?.participants?.map((p: any) => isIndividual ? p.studentProfileId : p.clanId) || [];
  const available = items.filter((i: any) => !existingIds.includes(i.id));
  const toggle = (id: string) => {
    console.log('Toggle student ID:', id, 'Name:', items.find((i: any) => i.id === id)?.characterName);
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };
  const selectAll = () => setSelected(available.map((i: any) => i.id));
  
  // Debug: Log students when modal opens
  useEffect(() => {
    if (isOpen && isIndividual) {
      console.log('=== AddParticipantsModal Debug ===');
      console.log('Tournament classroomId:', tournament?.classroomId);
      console.log('Students received:', students.length);
      students.forEach((s: any) => console.log(`  - ${s.id}: ${s.characterName || s.realName}`));
    }
  }, [isOpen, students, tournament, isIndividual]);
  
  if (!isOpen) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">Agregar {isIndividual ? 'Estudiantes' : 'Clanes'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button></div>
        {available.length === 0 ? <div className="text-center py-8 text-gray-500">No hay {isIndividual ? 'estudiantes' : 'clanes'} disponibles</div> : (
          <>
            <div className="flex justify-between mb-3">
              <span className="text-sm text-gray-500">{selected.length} seleccionados</span>
              <button onClick={selectAll} className="text-sm text-indigo-600 hover:text-indigo-700">Seleccionar todos</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {available.map((item: any) => {
                // Para estudiantes: usar characterName o realName + realLastName
                const studentName = isIndividual 
                  ? (item.characterName || `${item.realName || ''} ${item.realLastName || ''}`.trim() || 'Sin nombre')
                  : item.name;
                return (
                  <button key={item.id} onClick={() => toggle(item.id)}
                    className={`w-full p-3 rounded-lg flex items-center gap-3 ${selected.includes(item.id) ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'bg-gray-50 hover:bg-gray-100'}`}>
                    {isIndividual ? <ParticipantAvatar name={studentName} avatarUrl={item.avatarUrl} size={40} />
                      : <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: item.color || '#6366f1' }}>{item.name?.charAt(0)}</div>}
                    <div className="flex-1 text-left"><div className="font-medium">{studentName}</div>
                      {isIndividual && <div className="text-xs text-gray-500">Nv.{item.level}</div>}</div>
                    {selected.includes(item.id) && <Check size={20} className="text-indigo-600" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSubmit(selected)} disabled={selected.length === 0 || isLoading}>{isLoading ? 'Agregando...' : `Agregar (${selected.length})`}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const MatchControls = ({ match, onMatchUpdate, onMatchComplete, p1AvatarUrl, p2AvatarUrl }: any) => {
  // Estado local para el sistema de turnos
  const [currentTurn, setCurrentTurn] = useState<1 | 2 | null>(null);
  const [p1Answer, setP1Answer] = useState<number | null>(null);
  const [p2Answer, setP2Answer] = useState<number | null>(null);
  const [p1MultiAnswers, setP1MultiAnswers] = useState<number[]>([]);
  const [p2MultiAnswers, setP2MultiAnswers] = useState<number[]>([]);
  const [, setP1MatchingAnswers] = useState<{ left: string; right: string }[]>([]);
  const [, setP2MatchingAnswers] = useState<{ left: string; right: string }[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [resultAwarded, setResultAwarded] = useState(false);
  const [, setQuestionKey] = useState(0);
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [timerActive, setTimerActive] = useState(false);
  
  // Datos de participantes para el VS Card
  const p1 = match.participant1;
  const p2 = match.participant2;

  // Mutations
  const startMutation = useMutation({ 
    mutationFn: () => tournamentApi.startMatch(match.id), 
    onSuccess: () => {
      // Al iniciar, elegir al azar quién responde primero
      setCurrentTurn(Math.random() < 0.5 ? 1 : 2);
      onMatchUpdate();
    },
    onError: () => toast.error('Error al iniciar') 
  });

  const submitMutation = useMutation({ 
    mutationFn: ({ participantId, answerIndex }: { participantId: string; answerIndex: number }) => 
      tournamentApi.submitAnswer(match.id, participantId, String(answerIndex), 0),
    onSuccess: () => onMatchUpdate(),
    onError: () => toast.error('Error al guardar') 
  });

  const resetQuestionState = () => {
    setCurrentTurn(Math.random() < 0.5 ? 1 : 2);
    setP1Answer(null);
    setP2Answer(null);
    setP1MultiAnswers([]);
    setP2MultiAnswers([]);
    setP1MatchingAnswers([]);
    setP2MatchingAnswers([]);
    setShowResult(false);
    setResultAwarded(false);
    setQuestionKey(k => k + 1);
  };

  const nextMutation = useMutation({ 
    mutationFn: () => tournamentApi.nextQuestion(match.id), 
    onSuccess: (r: any) => { 
      // Resetear estado para la siguiente pregunta
      resetQuestionState();
      if (r.completed) completeMutation.mutate(); 
      else onMatchUpdate(); 
    } 
  });

  const completeMutation = useMutation({ 
    mutationFn: () => tournamentApi.completeMatch(match.id), 
    onSuccess: () => { toast.success('Match completado'); onMatchComplete(); } 
  });

  // Reset state cuando cambia la pregunta (por currentQuestionIndex)
  const [lastQuestionIndex, setLastQuestionIndex] = useState<number | null>(null);
  useEffect(() => {
    const currentIdx = match.currentQuestionIndex;
    if (currentIdx !== undefined && currentIdx !== lastQuestionIndex) {
      setLastQuestionIndex(currentIdx);
      // Solo resetear si no es la primera carga
      if (lastQuestionIndex !== null) {
        resetQuestionState();
      } else if (currentTurn === null) {
        setCurrentTurn(Math.random() < 0.5 ? 1 : 2);
      }
    }
  }, [match.currentQuestionIndex]);

  // Timer effect - iniciar cuando hay pregunta activa
  useEffect(() => {
    if (match.status === 'IN_PROGRESS' && match.currentQuestion && !showResult) {
      const questionTime = match.currentQuestion.timeLimitSeconds || 30;
      setTimeLeft(questionTime);
      setTimerActive(true);
    } else {
      setTimerActive(false);
    }
  }, [match.currentQuestionIndex, match.status, showResult]);

  // Countdown effect
  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  // Helpers para parsear datos de la pregunta
  const getOptions = (): any[] => {
    const opts = match.currentQuestion?.options;
    if (!opts) return [];
    if (Array.isArray(opts)) return opts;
    if (typeof opts === 'string') {
      try { return JSON.parse(opts); } catch { return []; }
    }
    return [];
  };

  const getCorrectIndex = (): number => {
    const opts = getOptions();
    // Buscar la opción con isCorrect: true
    const idx = opts.findIndex((o: any) => o.isCorrect === true);
    if (idx !== -1) return idx;
    
    // Si no hay isCorrect, intentar con correctAnswer
    const correctAnswer = match.currentQuestion?.correctAnswer;
    if (correctAnswer === true || correctAnswer === 'true') return 0;
    if (correctAnswer === false || correctAnswer === 'false') return 1;
    if (typeof correctAnswer === 'number') return correctAnswer;
    
    return 0;
  };

  const getCorrectIndices = (): number[] => {
    const opts = getOptions();
    const indices: number[] = [];
    opts.forEach((o: any, i: number) => {
      // Verificar isCorrect como boolean o string
      if (o.isCorrect === true || o.isCorrect === 'true') indices.push(i);
    });
    console.log('getCorrectIndices:', indices, 'from options:', opts);
    return indices.length > 0 ? indices : [0];
  };

  const getPairs = (): { left: string; right: string }[] => {
    const q = match.currentQuestion;
    if (!q) return [];
    // Intentar obtener pairs del campo pairs o de options
    let pairs = q.pairs;
    if (typeof pairs === 'string') {
      try { pairs = JSON.parse(pairs); } catch { pairs = []; }
    }
    if (Array.isArray(pairs) && pairs.length > 0) return pairs;
    return [];
  };

  // Función para marcar respuesta de un participante (SINGLE_CHOICE / TRUE_FALSE)
  const handleSelectAnswer = (participantNum: 1 | 2, answerIndex: number) => {
    if (participantNum === 1) {
      setP1Answer(answerIndex);
      // Pasar turno al otro si aún no ha respondido
      if (p2Answer === null) setCurrentTurn(2);
    } else {
      setP2Answer(answerIndex);
      if (p1Answer === null) setCurrentTurn(1);
    }
  };

  // Función para marcar respuesta MULTIPLE_CHOICE (toggle)
  const handleToggleMultiAnswer = (participantNum: 1 | 2, answerIndex: number) => {
    if (participantNum === 1) {
      setP1MultiAnswers(prev => 
        prev.includes(answerIndex) 
          ? prev.filter(i => i !== answerIndex) 
          : [...prev, answerIndex]
      );
    } else {
      setP2MultiAnswers(prev => 
        prev.includes(answerIndex) 
          ? prev.filter(i => i !== answerIndex) 
          : [...prev, answerIndex]
      );
    }
  };

  // Confirmar respuesta MULTIPLE_CHOICE y pasar turno
  const handleConfirmMultiAnswer = (participantNum: 1 | 2) => {
    if (participantNum === 1) {
      setP1Answer(0); // Marcar como respondido
      if (p2Answer === null) setCurrentTurn(2);
    } else {
      setP2Answer(0);
      if (p1Answer === null) setCurrentTurn(1);
    }
  };

  // Función para revelar resultado y otorgar puntos
  const handleRevealResult = async () => {
    setShowResult(true);
    
    const qType = match.currentQuestion?.questionType;
    const correctIdx = getCorrectIndex();
    const correctIndices = getCorrectIndices();
    
    let p1Correct = false;
    let p2Correct = false;

    if (qType === 'MULTIPLE_CHOICE') {
      // Para MULTIPLE_CHOICE, verificar si seleccionó todas las correctas
      const p1Set = new Set(p1MultiAnswers);
      const p2Set = new Set(p2MultiAnswers);
      const correctSet = new Set(correctIndices);
      p1Correct = correctIndices.length > 0 && 
        correctIndices.every(i => p1Set.has(i)) && 
        p1MultiAnswers.every(i => correctSet.has(i));
      p2Correct = correctIndices.length > 0 && 
        correctIndices.every(i => p2Set.has(i)) && 
        p2MultiAnswers.every(i => correctSet.has(i));
    } else {
      p1Correct = p1Answer === correctIdx;
      p2Correct = p2Answer === correctIdx;
    }

    // Guardar respuestas en el backend
    if (!resultAwarded) {
      if (p1Correct) {
        await submitMutation.mutateAsync({ 
          participantId: match.participant1Id, 
          answerIndex: qType === 'MULTIPLE_CHOICE' ? p1MultiAnswers[0] || 0 : p1Answer!
        });
      }
      if (p2Correct) {
        await submitMutation.mutateAsync({ 
          participantId: match.participant2Id, 
          answerIndex: qType === 'MULTIPLE_CHOICE' ? p2MultiAnswers[0] || 0 : p2Answer!
        });
      }
      setResultAwarded(true);
      onMatchUpdate();
    }
  };

  // Obtener datos de participantes
  const p1Name = match.participant1?.student?.displayName || match.participant1?.clan?.name || 'Participante 1';
  const p2Name = match.participant2?.student?.displayName || match.participant2?.clan?.name || 'Participante 2';
  const p1Avatar = p1AvatarUrl || match.participant1?.student?.avatarUrl;
  const p2Avatar = p2AvatarUrl || match.participant2?.student?.avatarUrl;
  const p1Color = match.participant1?.clan?.color || '#6366f1';
  const p2Color = match.participant2?.clan?.color || '#8b5cf6';
  const p1StudentId = match.participant1?.student?.id;
  const p2StudentId = match.participant2?.student?.id;
  const p1AvatarGender = match.participant1?.student?.avatarGender;
  const p2AvatarGender = match.participant2?.student?.avatarGender;
  
  // Función para renderizar el VS Card con animaciones de resultado
  const renderVSCard = (p1Correct?: boolean, p2Correct?: boolean) => {
    const isShowingResult = p1Correct !== undefined && p2Correct !== undefined;
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-6 shadow-lg border ${
          isShowingResult 
            ? 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-gray-200 dark:border-gray-700' 
            : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
        }`}
      >
        {isShowingResult && (
          <motion.h4 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-lg font-bold text-gray-800 dark:text-white mb-4"
          >
            🎯 Resultado de la Ronda
          </motion.h4>
        )}
        
        <div className="flex items-center justify-center gap-6 md:gap-10">
          {/* Player 1 */}
          <motion.div 
            initial={{ x: -50, opacity: 0 }} 
            animate={{ 
              x: 0, 
              opacity: 1,
              scale: isShowingResult && p1Correct ? [1, 1.05, 1] : 1
            }}
            transition={{ 
              delay: 0.2,
              scale: { delay: 0.5, duration: 0.5, repeat: p1Correct ? 2 : 0 }
            }}
            className={`text-center flex-1 p-4 rounded-2xl transition-all ${
              isShowingResult 
                ? p1Correct 
                  ? 'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/30 border-2 border-green-400' 
                  : 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/20 border-2 border-red-300'
                : ''
            }`}
          >
            <div className="relative inline-block">
              <motion.div
                animate={isShowingResult && p1Correct ? { 
                  rotate: [0, -5, 5, -5, 0],
                  y: [0, -5, 0]
                } : isShowingResult && !p1Correct ? {
                  y: [0, 3, 0]
                } : {}}
                transition={{ 
                  duration: p1Correct ? 0.5 : 1,
                  repeat: p1Correct ? 3 : 0,
                  delay: 0.5
                }}
              >
                {p1Avatar ? (
                  <img 
                    src={p1Avatar} 
                    alt={p1Name} 
                    className={`w-24 h-24 md:w-28 md:h-28 object-cover rounded-2xl ring-4 ${
                      isShowingResult 
                        ? p1Correct ? 'ring-green-400' : 'ring-red-300'
                        : 'ring-indigo-200 dark:ring-indigo-800'
                    } shadow-lg`}
                  />
                ) : (
                  <div className={`w-24 h-24 md:w-28 md:h-28 rounded-2xl ring-4 ${
                    isShowingResult 
                      ? p1Correct ? 'ring-green-400' : 'ring-red-300'
                      : 'ring-indigo-200 dark:ring-indigo-800'
                  } overflow-hidden shadow-lg`}>
                    <ParticipantAvatar name={p1Name} avatarUrl={p1Avatar} color={p1Color} studentId={p1StudentId} avatarGender={p1AvatarGender} size={112} />
                  </div>
                )}
              </motion.div>
              {/* Badge de resultado */}
              {isShowingResult && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: p1Correct ? [0, 360] : 0 }}
                  transition={{ delay: 0.8, type: 'spring' }}
                  className={`absolute -top-2 -right-2 w-8 h-8 ${p1Correct ? 'bg-green-500' : 'bg-red-500'} rounded-full flex items-center justify-center shadow-lg`}
                >
                  {p1Correct ? <Check size={18} className="text-white" /> : <X size={18} className="text-white" />}
                </motion.div>
              )}
              {/* Badge de clase */}
              {!isShowingResult && p1?.student?.characterClass && (
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center text-lg shadow-lg border-2 border-indigo-200">
                  {p1.student.characterClass === 'GUARDIAN' ? '🛡️' : p1.student.characterClass === 'ARCANE' ? '🔮' : p1.student.characterClass === 'EXPLORER' ? '🧭' : '⚗️'}
                </div>
              )}
            </div>
            <div className="mt-3">
              <div className="font-bold text-lg text-gray-800 dark:text-white">{p1Name.split(' ')[0]}</div>
              {p1?.student && <div className="text-sm text-gray-500">Nv.{p1.student.level}</div>}
            </div>
            {isShowingResult ? (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className={`text-sm font-semibold mt-2 ${p1Correct ? 'text-green-600' : 'text-red-500'}`}
              >
                {p1Correct ? '🎉 ¡Correcto! (+1)' : '😔 Incorrecto'}
              </motion.p>
            ) : (
              <div className="mt-2">
                <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                  {match.participant1Score}
                </span>
              </div>
            )}
          </motion.div>

          {/* VS */}
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            transition={{ delay: 0.3, type: 'spring' }}
            className="flex flex-col items-center"
          >
            <div className={`w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 ${isShowingResult ? '' : 'rotate-12'}`}>
              <span className={`text-white font-black text-lg md:text-xl ${isShowingResult ? '' : '-rotate-12'}`}>VS</span>
            </div>
            {!isShowingResult && match.status === 'IN_PROGRESS' && match.currentQuestion && (
              <div className="mt-3 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
                Pregunta {(match.currentQuestionIndex || 0) + 1}/{match.questionIds?.length || 0}
              </div>
            )}
          </motion.div>

          {/* Player 2 */}
          <motion.div 
            initial={{ x: 50, opacity: 0 }} 
            animate={{ 
              x: 0, 
              opacity: 1,
              scale: isShowingResult && p2Correct ? [1, 1.05, 1] : 1
            }}
            transition={{ 
              delay: 0.2,
              scale: { delay: 0.5, duration: 0.5, repeat: p2Correct ? 2 : 0 }
            }}
            className={`text-center flex-1 p-4 rounded-2xl transition-all ${
              isShowingResult 
                ? p2Correct 
                  ? 'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/30 border-2 border-green-400' 
                  : 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/20 border-2 border-red-300'
                : ''
            }`}
          >
            <div className="relative inline-block">
              <motion.div
                animate={isShowingResult && p2Correct ? { 
                  rotate: [0, -5, 5, -5, 0],
                  y: [0, -5, 0]
                } : isShowingResult && !p2Correct ? {
                  y: [0, 3, 0]
                } : {}}
                transition={{ 
                  duration: p2Correct ? 0.5 : 1,
                  repeat: p2Correct ? 3 : 0,
                  delay: 0.5
                }}
              >
                {p2Avatar ? (
                  <img 
                    src={p2Avatar} 
                    alt={p2Name} 
                    className={`w-24 h-24 md:w-28 md:h-28 object-cover rounded-2xl ring-4 ${
                      isShowingResult 
                        ? p2Correct ? 'ring-green-400' : 'ring-red-300'
                        : 'ring-purple-200 dark:ring-purple-800'
                    } shadow-lg`}
                  />
                ) : (
                  <div className={`w-24 h-24 md:w-28 md:h-28 rounded-2xl ring-4 ${
                    isShowingResult 
                      ? p2Correct ? 'ring-green-400' : 'ring-red-300'
                      : 'ring-purple-200 dark:ring-purple-800'
                  } overflow-hidden shadow-lg`}>
                    <ParticipantAvatar name={p2Name} avatarUrl={p2Avatar} color={p2Color} studentId={p2StudentId} avatarGender={p2AvatarGender} size={112} />
                  </div>
                )}
              </motion.div>
              {/* Badge de resultado */}
              {isShowingResult && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: p2Correct ? [0, 360] : 0 }}
                  transition={{ delay: 0.8, type: 'spring' }}
                  className={`absolute -top-2 -right-2 w-8 h-8 ${p2Correct ? 'bg-green-500' : 'bg-red-500'} rounded-full flex items-center justify-center shadow-lg`}
                >
                  {p2Correct ? <Check size={18} className="text-white" /> : <X size={18} className="text-white" />}
                </motion.div>
              )}
              {/* Badge de clase */}
              {!isShowingResult && p2?.student?.characterClass && (
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center text-lg shadow-lg border-2 border-purple-200">
                  {p2.student.characterClass === 'GUARDIAN' ? '🛡️' : p2.student.characterClass === 'ARCANE' ? '🔮' : p2.student.characterClass === 'EXPLORER' ? '🧭' : '⚗️'}
                </div>
              )}
            </div>
            <div className="mt-3">
              <div className="font-bold text-lg text-gray-800 dark:text-white">{p2Name.split(' ')[0]}</div>
              {p2?.student && <div className="text-sm text-gray-500">Nv.{p2.student.level}</div>}
            </div>
            {isShowingResult ? (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className={`text-sm font-semibold mt-2 ${p2Correct ? 'text-green-600' : 'text-red-500'}`}
              >
                {p2Correct ? '🎉 ¡Correcto! (+1)' : '😔 Incorrecto'}
              </motion.p>
            ) : (
              <div className="mt-2">
                <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  {match.participant2Score}
                </span>
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    );
  };

  // RENDER: Estado PENDING - Con animación épica pre-match
  if (match.status === 'PENDING') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-900/20 dark:via-purple-900/20 dark:to-pink-900/20 rounded-2xl p-8"
      >
        {/* Partículas de fondo animadas */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-indigo-400/30 rounded-full"
              initial={{ 
                x: Math.random() * 100 + '%', 
                y: Math.random() * 100 + '%',
                scale: 0
              }}
              animate={{ 
                y: [null, '-100%'],
                scale: [0, 1, 0],
                opacity: [0, 1, 0]
              }}
              transition={{ 
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: i * 0.5
              }}
            />
          ))}
        </div>

        {/* Contenido principal */}
        <div className="relative z-10">
          <motion.h3 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center text-xl font-bold text-gray-800 dark:text-white mb-6"
          >
            ⚔️ ¡Prepárense para el Combate! ⚔️
          </motion.h3>

          {/* Avatares enfrentándose */}
          <div className="flex items-center justify-center gap-8 mb-8">
            {/* Participante 1 */}
            <motion.div 
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
              className="text-center"
            >
              <motion.div
                animate={{ 
                  x: [0, 10, 0],
                  rotate: [0, 5, 0]
                }}
                transition={{ 
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="relative"
              >
                <div className="w-20 h-20 rounded-full ring-4 ring-indigo-400 ring-offset-2 overflow-hidden shadow-lg shadow-indigo-500/30">
                  <ParticipantAvatar name={p1Name} avatarUrl={p1Avatar} color={p1Color} studentId={p1StudentId} avatarGender={p1AvatarGender} size={80} />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg"
                >
                  🥊
                </motion.div>
              </motion.div>
              <p className="mt-3 font-bold text-gray-800 dark:text-white">{p1Name.split(' ')[0]}</p>
            </motion.div>

            {/* VS animado */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/40"
              >
                <span className="text-white font-black text-xl">VS</span>
              </motion.div>
            </motion.div>

            {/* Participante 2 */}
            <motion.div 
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
              className="text-center"
            >
              <motion.div
                animate={{ 
                  x: [0, -10, 0],
                  rotate: [0, -5, 0]
                }}
                transition={{ 
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="relative"
              >
                <div className="w-20 h-20 rounded-full ring-4 ring-purple-400 ring-offset-2 overflow-hidden shadow-lg shadow-purple-500/30">
                  <ParticipantAvatar name={p2Name} avatarUrl={p2Avatar} color={p2Color} studentId={p2StudentId} avatarGender={p2AvatarGender} size={80} />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
                  className="absolute -bottom-1 -left-1 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg"
                >
                  🥊
                </motion.div>
              </motion.div>
              <p className="mt-3 font-bold text-gray-800 dark:text-white">{p2Name.split(' ')[0]}</p>
            </motion.div>
          </div>

          {/* Botón de inicio */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex justify-center"
          >
            <motion.button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending || !match.participant1Id || !match.participant2Id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-green-500/30 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {startMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                  Iniciando...
                </>
              ) : (
                <>
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    <Play size={24} />
                  </motion.div>
                  ¡Iniciar Combate!
                </>
              )}
            </motion.button>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // RENDER: Estado IN_PROGRESS
  if (match.status === 'IN_PROGRESS') {
    if (!match.currentQuestion) {
      return (
        <Card className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-500">Cargando pregunta...</p>
          <Button className="mt-4" onClick={onMatchUpdate}>Recargar</Button>
        </Card>
      );
    }

    const options = getOptions();
    const qType = match.currentQuestion.questionType;
    const correctIdx = getCorrectIndex();
    const correctIndices = getCorrectIndices();
    const pairs = getPairs();
    const bothAnswered = p1Answer !== null && p2Answer !== null;

    // Determinar quién está respondiendo actualmente
    const waitingFor = currentTurn === 1 
      ? (p1Answer === null ? p1Name : p2Name)
      : (p2Answer === null ? p2Name : p1Name);
    
    // Calcular si las respuestas son correctas (para el VS Card)
    // Para MULTIPLE_CHOICE: debe seleccionar TODAS las correctas y NINGUNA incorrecta
    const checkMultipleChoiceCorrect = (selectedAnswers: number[]) => {
      if (selectedAnswers.length !== correctIndices.length) return false;
      return correctIndices.every(idx => selectedAnswers.includes(idx)) && 
             selectedAnswers.every(idx => correctIndices.includes(idx));
    };
    
    const p1IsCorrect = showResult 
      ? (qType === 'MULTIPLE_CHOICE' 
          ? checkMultipleChoiceCorrect(p1MultiAnswers) 
          : p1Answer === correctIdx) 
      : undefined;
    const p2IsCorrect = showResult 
      ? (qType === 'MULTIPLE_CHOICE' 
          ? checkMultipleChoiceCorrect(p2MultiAnswers) 
          : p2Answer === correctIdx) 
      : undefined;

    return (
      <div className="space-y-5">
        {/* VS Card con resultado integrado */}
        {renderVSCard(p1IsCorrect, p2IsCorrect)}
        
        <Card className="p-6 space-y-6">
          {/* Header de la pregunta con Timer */}
          <div className="text-center relative">
            {/* Timer */}
            {timerActive && !showResult && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`absolute -top-2 -right-2 w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${
                  timeLeft <= 5 
                    ? 'bg-gradient-to-br from-red-500 to-red-600 animate-pulse' 
                    : timeLeft <= 10 
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500' 
                      : 'bg-gradient-to-br from-indigo-500 to-purple-500'
                }`}
              >
                <div className="text-center">
                  <Clock size={14} className="text-white/80 mx-auto mb-0.5" />
                  <span className="text-white font-black text-lg">{timeLeft}</span>
                </div>
              </motion.div>
            )}
            {/* Tiempo agotado */}
            {timeLeft === 0 && !showResult && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 w-16 h-16 rounded-full flex items-center justify-center shadow-lg bg-gradient-to-br from-red-600 to-red-700"
              >
                <span className="text-white font-bold text-xs">⏰ FIN</span>
              </motion.div>
            )}
            <div className="text-sm text-gray-500 mb-2">
              Pregunta {(match.currentQuestionIndex || 0) + 1} de {match.questionIds?.length || '?'}
            </div>
            <h3 className="text-xl font-bold mb-4">{match.currentQuestion.question}</h3>
            {match.currentQuestion.imageUrl && (
              <img src={match.currentQuestion.imageUrl} alt="" className="max-h-48 mx-auto rounded-lg mb-4" />
            )}
          </div>

          {/* Indicador de turno */}
          {!bothAnswered && !showResult && (
            <div className="text-center py-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
              <p className="text-indigo-700 dark:text-indigo-300 font-medium">
                🎯 Turno de: <span className="font-bold">{waitingFor}</span>
              </p>
            </div>
          )}

        {/* MATCHING: Dos paneles separados */}
        {qType === 'MATCHING' && pairs.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Panel Participante 1 */}
            <div className={`p-4 rounded-xl border-2 ${currentTurn === 1 && p1Answer === null ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200'}`}>
              <h4 className="font-bold text-center mb-3">{p1Name}</h4>
              <MatchingPanel 
                pairs={pairs} 
                disabled={p1Answer !== null || (currentTurn !== 1 && p1Answer === null)}
                onComplete={(answers) => { setP1MatchingAnswers(answers); setP1Answer(0); if (p2Answer === null) setCurrentTurn(2); }}
                showResult={showResult}
              />
              {p1Answer !== null && !showResult && <div className="text-center mt-2 text-green-600">✓ Respondido</div>}
            </div>
            {/* Panel Participante 2 */}
            <div className={`p-4 rounded-xl border-2 ${currentTurn === 2 && p2Answer === null ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200'}`}>
              <h4 className="font-bold text-center mb-3">{p2Name}</h4>
              <MatchingPanel 
                pairs={pairs} 
                disabled={p2Answer !== null || (currentTurn !== 2 && p2Answer === null)}
                onComplete={(answers) => { setP2MatchingAnswers(answers); setP2Answer(0); if (p1Answer === null) setCurrentTurn(1); }}
                showResult={showResult}
              />
              {p2Answer !== null && !showResult && <div className="text-center mt-2 text-green-600">✓ Respondido</div>}
            </div>
          </div>
        ) : qType === 'MULTIPLE_CHOICE' ? (
          /* MULTIPLE_CHOICE: Permite seleccionar múltiples opciones */
          <div className="space-y-4">
            <div className="text-center text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 py-2 rounded-lg">
              ⚠️ Selección múltiple: Selecciona todas las respuestas correctas
            </div>
            
            {/* Panel de cada participante */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Panel P1 */}
              <div className={`p-4 rounded-xl border-2 ${currentTurn === 1 && p1Answer === null ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200'}`}>
                <h4 className="font-bold text-center mb-3">{p1Name}</h4>
                <div className="space-y-2">
                  {options.map((opt: any, i: number) => {
                    const optText = typeof opt === 'object' ? (opt.text || opt.label || String(opt)) : String(opt);
                    const isSelected = p1MultiAnswers.includes(i);
                    const isCorrectOpt = correctIndices.includes(i);
                    return (
                      <button
                        key={i}
                        onClick={() => handleToggleMultiAnswer(1, i)}
                        disabled={p1Answer !== null || currentTurn !== 1}
                        className={`w-full p-3 rounded-lg text-left transition-all ${
                          showResult
                            ? isCorrectOpt
                              ? 'bg-green-100 border-green-500 border-2'
                              : isSelected
                                ? 'bg-red-100 border-red-300 border-2'
                                : 'bg-gray-100'
                            : isSelected
                              ? 'bg-indigo-500 text-white'
                              : p1Answer !== null
                                ? 'bg-gray-100 text-gray-400'
                                : currentTurn === 1
                                  ? 'bg-gray-100 hover:bg-indigo-100'
                                  : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {String.fromCharCode(65 + i)}. {optText}
                        {isSelected && !showResult && ' ✓'}
                        {showResult && isCorrectOpt && ' ✓'}
                      </button>
                    );
                  })}
                </div>
                {p1Answer === null && currentTurn === 1 && p1MultiAnswers.length > 0 && (
                  <button
                    onClick={() => handleConfirmMultiAnswer(1)}
                    className="w-full mt-3 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                  >
                    Confirmar ({p1MultiAnswers.length} seleccionadas)
                  </button>
                )}
                {p1Answer !== null && !showResult && <div className="text-center mt-2 text-green-600">✓ Respondido</div>}
              </div>

              {/* Panel P2 */}
              <div className={`p-4 rounded-xl border-2 ${currentTurn === 2 && p2Answer === null ? 'border-purple-500 bg-purple-50/50' : 'border-gray-200'}`}>
                <h4 className="font-bold text-center mb-3">{p2Name}</h4>
                <div className="space-y-2">
                  {options.map((opt: any, i: number) => {
                    const optText = typeof opt === 'object' ? (opt.text || opt.label || String(opt)) : String(opt);
                    const isSelected = p2MultiAnswers.includes(i);
                    const isCorrectOpt = correctIndices.includes(i);
                    return (
                      <button
                        key={i}
                        onClick={() => handleToggleMultiAnswer(2, i)}
                        disabled={p2Answer !== null || currentTurn !== 2}
                        className={`w-full p-3 rounded-lg text-left transition-all ${
                          showResult
                            ? isCorrectOpt
                              ? 'bg-green-100 border-green-500 border-2'
                              : isSelected
                                ? 'bg-red-100 border-red-300 border-2'
                                : 'bg-gray-100'
                            : isSelected
                              ? 'bg-purple-500 text-white'
                              : p2Answer !== null
                                ? 'bg-gray-100 text-gray-400'
                                : currentTurn === 2
                                  ? 'bg-gray-100 hover:bg-purple-100'
                                  : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {String.fromCharCode(65 + i)}. {optText}
                        {isSelected && !showResult && ' ✓'}
                        {showResult && isCorrectOpt && ' ✓'}
                      </button>
                    );
                  })}
                </div>
                {p2Answer === null && currentTurn === 2 && p2MultiAnswers.length > 0 && (
                  <button
                    onClick={() => handleConfirmMultiAnswer(2)}
                    className="w-full mt-3 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                  >
                    Confirmar ({p2MultiAnswers.length} seleccionadas)
                  </button>
                )}
                {p2Answer !== null && !showResult && <div className="text-center mt-2 text-green-600">✓ Respondido</div>}
              </div>
            </div>
          </div>
        ) : (
          /* TRUE_FALSE y SINGLE_CHOICE */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {(qType === 'TRUE_FALSE' ? [{ text: 'Verdadero' }, { text: 'Falso' }] : options).map((opt: any, i: number) => {
                const optText = typeof opt === 'object' ? (opt.text || opt.label || String(opt)) : String(opt);
                const isCorrectOpt = i === correctIdx;
                const p1Selected = p1Answer === i;
                const p2Selected = p2Answer === i;

                return (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`p-4 rounded-2xl border-2 transition-all ${
                      showResult && isCorrectOpt 
                        ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20' 
                        : showResult && (p1Selected || p2Selected) && !isCorrectOpt
                          ? 'border-red-300 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/10'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="font-semibold mb-4 text-gray-800 dark:text-white">
                      {String.fromCharCode(65 + i)}. {optText}
                      {showResult && isCorrectOpt && <span className="ml-2 text-green-600 font-bold">✓ Correcta</span>}
                    </div>
                    
                    {/* Botones con avatares */}
                    <div className="flex gap-3">
                      {/* Botón P1 */}
                      <motion.button
                        onClick={() => handleSelectAnswer(1, i)}
                        disabled={p1Answer !== null || (currentTurn !== 1 && p1Answer === null)}
                        whileHover={currentTurn === 1 && p1Answer === null ? { scale: 1.05 } : {}}
                        whileTap={currentTurn === 1 && p1Answer === null ? { scale: 0.95 } : {}}
                        className={`flex-1 py-2 px-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                          p1Selected
                            ? showResult 
                              ? (isCorrectOpt ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-red-500 text-white shadow-lg shadow-red-500/30')
                              : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                            : p1Answer !== null
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                              : currentTurn === 1
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 ring-2 ring-indigo-300 ring-offset-2'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <ParticipantAvatar name={p1Name} avatarUrl={p1Avatar} color={p1Color} size={24} />
                        <span className="truncate">{p1Name.split(' ')[0]}</span>
                        {p1Selected && <Check size={16} />}
                      </motion.button>
                      
                      {/* Botón P2 */}
                      <motion.button
                        onClick={() => handleSelectAnswer(2, i)}
                        disabled={p2Answer !== null || (currentTurn !== 2 && p2Answer === null)}
                        whileHover={currentTurn === 2 && p2Answer === null ? { scale: 1.05 } : {}}
                        whileTap={currentTurn === 2 && p2Answer === null ? { scale: 0.95 } : {}}
                        className={`flex-1 py-2 px-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                          p2Selected
                            ? showResult 
                              ? (isCorrectOpt ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-red-500 text-white shadow-lg shadow-red-500/30')
                              : 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                            : p2Answer !== null
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                              : currentTurn === 2
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 ring-2 ring-purple-300 ring-offset-2'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <ParticipantAvatar name={p2Name} avatarUrl={p2Avatar} color={p2Color} size={24} />
                        <span className="truncate">{p2Name.split(' ')[0]}</span>
                        {p2Selected && <Check size={16} />}
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Estado de respuestas */}
            {(p1Answer !== null || p2Answer !== null) && !showResult && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center gap-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl"
              >
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${p1Answer !== null ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                  <ParticipantAvatar name={p1Name} avatarUrl={p1Avatar} color={p1Color} size={20} />
                  {p1Answer !== null ? <><Check size={16} /> Opción {String.fromCharCode(65 + p1Answer)}</> : 'Esperando...'}
                </div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${p2Answer !== null ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                  <ParticipantAvatar name={p2Name} avatarUrl={p2Avatar} color={p2Color} size={20} />
                  {p2Answer !== null ? <><Check size={16} /> Opción {String.fromCharCode(65 + p2Answer)}</> : 'Esperando...'}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex justify-center gap-3 pt-4">
          {bothAnswered && !showResult && (
            <Button onClick={handleRevealResult} className="bg-amber-500 hover:bg-amber-600">
              <Star size={18} className="mr-2" /> Revelar Respuesta
            </Button>
          )}
          {showResult && (
            <Button variant="secondary" onClick={() => nextMutation.mutate()} disabled={nextMutation.isPending}>
              {nextMutation.isPending ? 'Cargando...' : 'Siguiente Pregunta →'}
            </Button>
          )}
          <Button variant="secondary" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
            Finalizar Match
          </Button>
        </div>
        </Card>
      </div>
    );
  }

  // RENDER: Estado COMPLETED
  if (match.status === 'COMPLETED') {
    return (
      <div className="text-center py-8">
        <CheckCircle size={48} className="mx-auto text-green-500 mb-2" />
        <p className="text-lg font-medium">Match Completado</p>
      </div>
    );
  }

  return null;
};

// Componente para preguntas tipo MATCHING
const MatchingPanel = ({ pairs, disabled, onComplete, showResult }: {
  pairs: { left: string; right: string }[];
  disabled: boolean;
  onComplete: (answers: { left: string; right: string }[]) => void;
  showResult: boolean;
}) => {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matches, setMatches] = useState<{ left: string; right: string }[]>([]);
  const [shuffledRight, setShuffledRight] = useState<string[]>([]);

  useEffect(() => {
    // Mezclar las opciones de la derecha
    const rights = pairs.map(p => p.right).sort(() => Math.random() - 0.5);
    setShuffledRight(rights);
  }, [pairs]);

  const handleLeftClick = (left: string) => {
    if (disabled || matches.some(m => m.left === left)) return;
    setSelectedLeft(left);
  };

  const handleRightClick = (right: string) => {
    if (disabled || !selectedLeft || matches.some(m => m.right === right)) return;
    const newMatches = [...matches, { left: selectedLeft, right }];
    setMatches(newMatches);
    setSelectedLeft(null);
    
    if (newMatches.length === pairs.length) {
      onComplete(newMatches);
    }
  };

  const isCorrectMatch = (left: string, right: string) => {
    return pairs.some(p => p.left === left && p.right === right);
  };

  return (
    <div className="flex gap-4">
      {/* Columna izquierda */}
      <div className="flex-1 space-y-2">
        {pairs.map((p, i) => {
          const isMatched = matches.some(m => m.left === p.left);
          const matchedRight = matches.find(m => m.left === p.left)?.right;
          return (
            <button
              key={i}
              onClick={() => handleLeftClick(p.left)}
              disabled={disabled || isMatched}
              className={`w-full p-2 rounded-lg text-sm text-left transition-all ${
                selectedLeft === p.left
                  ? 'bg-indigo-500 text-white'
                  : isMatched
                    ? showResult && isCorrectMatch(p.left, matchedRight!)
                      ? 'bg-green-100 text-green-700'
                      : showResult
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-200 text-gray-600'
                    : disabled
                      ? 'bg-gray-100 text-gray-400'
                      : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {p.left}
            </button>
          );
        })}
      </div>
      
      {/* Columna derecha */}
      <div className="flex-1 space-y-2">
        {shuffledRight.map((right, i) => {
          const isMatched = matches.some(m => m.right === right);
          return (
            <button
              key={i}
              onClick={() => handleRightClick(right)}
              disabled={disabled || isMatched || !selectedLeft}
              className={`w-full p-2 rounded-lg text-sm text-left transition-all ${
                isMatched
                  ? 'bg-gray-200 text-gray-600'
                  : selectedLeft && !disabled
                    ? 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {right}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TournamentsActivity;
