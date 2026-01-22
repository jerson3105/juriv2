import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Zap,
  Coins,
  Shield,
  Crown,
  TrendingUp,
  Users,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react';
import { clanApi, CLAN_EMBLEMS } from '../../lib/clanApi';
import { classroomApi } from '../../lib/classroomApi';
import { CHARACTER_CLASSES } from '../../lib/studentApi';
import confetti from 'canvas-confetti';

type RankingType = 'xp' | 'gp' | 'clans';

interface Student {
  id: string;
  characterName: string | null;
  characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
  level: number;
  xp: number;
  hp: number;
  gp: number;
  isActive?: boolean;
  user?: {
    firstName: string;
    lastName: string;
  };
}

const RANKING_TABS = [
  { id: 'xp' as RankingType, label: 'XP Total', icon: Zap, color: 'from-violet-500 to-purple-600', bgColor: 'bg-violet-500' },
  { id: 'gp' as RankingType, label: 'Oro', icon: Coins, color: 'from-amber-500 to-yellow-500', bgColor: 'bg-amber-500' },
  { id: 'clans' as RankingType, label: 'Clanes', icon: Shield, color: 'from-teal-500 to-cyan-500', bgColor: 'bg-teal-500' },
];

const PODIUM_COLORS = [
  { bg: 'from-amber-400 to-yellow-500', shadow: 'shadow-amber-500/50', text: 'text-amber-900', medal: '🥇' },
  { bg: 'from-gray-300 to-gray-400', shadow: 'shadow-gray-400/50', text: 'text-gray-700', medal: '🥈' },
  { bg: 'from-orange-400 to-amber-500', shadow: 'shadow-orange-500/50', text: 'text-orange-900', medal: '🥉' },
];

const JIRO_RANKING_IMAGES: Record<RankingType, string> = {
  xp: '/assets/mascot/jiro-ranking-xp.png',
  gp: '/assets/mascot/jiro-ranking-oro.png',
  clans: '/assets/mascot/jiro-ranking-clanes.png',
};

export const RankingsPage = () => {
  const { classroom } = useOutletContext<{ classroom: any }>();
  const [activeTab, setActiveTab] = useState<RankingType>('xp');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [, setShowConfetti] = useState(false);

  // Obtener estudiantes con datos frescos (no del cache del classroom)
  const { data: freshClassroom } = useQuery({
    queryKey: ['classroom-rankings', classroom?.id],
    queryFn: () => classroomApi.getById(classroom.id),
    enabled: !!classroom?.id,
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });
  
  const students: Student[] = freshClassroom?.students || classroom?.students || [];

  // Obtener clanes
  const { data: clans = [] } = useQuery({
    queryKey: ['clans', classroom?.id],
    queryFn: () => clanApi.getClassroomClans(classroom.id),
    enabled: !!classroom?.id && classroom.clansEnabled,
  });

  // Ordenar estudiantes según el tipo de ranking
  const getSortedStudents = () => {
    const sorted = [...students].filter(s => s.isActive !== false);
    switch (activeTab) {
      case 'xp':
        return sorted.sort((a, b) => b.xp - a.xp);
      case 'gp':
        return sorted.sort((a, b) => b.gp - a.gp);
      default:
        return sorted;
    }
  };

  // Ordenar clanes por XP
  const getSortedClans = () => {
    return [...clans].sort((a, b) => b.totalXp - a.totalXp);
  };

  const sortedStudents = getSortedStudents();
  const sortedClans = getSortedClans();
  const top3Students = sortedStudents.slice(0, 3);
  const top3Clans = sortedClans.slice(0, 3);
  const restStudents = sortedStudents.slice(3);
  const restClans = sortedClans.slice(3);

  // Función para lanzar confetti
  const launchConfetti = () => {
    setShowConfetti(true);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#fbbf24', '#a855f7', '#22c55e', '#3b82f6', '#ef4444'],
    });
    setTimeout(() => setShowConfetti(false), 3000);
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getValue = (student: Student) => {
    switch (activeTab) {
      case 'xp': return student.xp;
      case 'gp': return student.gp;
      default: return 0;
    }
  };

  const getUnit = () => {
    switch (activeTab) {
      case 'xp': return 'XP';
      case 'gp': return 'Oro';
      default: return '';
    }
  };

  const currentTab = RANKING_TABS.find(t => t.id === activeTab)!;

  return (
    <div className={`space-y-6 ${isFullscreen ? 'p-8 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 min-h-screen' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 bg-gradient-to-br ${currentTab.color} rounded-xl flex items-center justify-center text-white shadow-lg`}>
            <Trophy size={24} />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${isFullscreen ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
              Rankings de la Clase
            </h1>
            <p className={`text-sm ${isFullscreen ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
              {students.length} estudiantes • {clans.length} clanes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={launchConfetti}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-medium hover:from-pink-600 hover:to-rose-600 transition-colors shadow-lg"
          >
            <Sparkles size={18} />
            ¡Celebrar!
          </button>
          <button
            onClick={toggleFullscreen}
            className={`p-2 rounded-xl transition-colors ${
              isFullscreen 
                ? 'bg-white/10 text-white hover:bg-white/20' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-2 p-1 rounded-xl ${isFullscreen ? 'bg-white/10' : 'bg-gray-100 dark:bg-gray-800'}`}>
        {RANKING_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const isDisabled = tab.id === 'clans' && !classroom?.clansEnabled;
          
          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && setActiveTab(tab.id)}
              disabled={isDisabled}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all
                ${isActive 
                  ? `bg-gradient-to-r ${tab.color} text-white shadow-lg` 
                  : isFullscreen
                    ? 'text-gray-300 hover:bg-white/10'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700'
                }
                ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <tab.icon size={18} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenido del ranking */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'clans' ? (
            // Ranking de Clanes
            <div className="space-y-6">
              {/* Podio de Clanes */}
              {top3Clans.length > 0 && (
                <div className="relative flex items-end justify-center gap-4 py-8">
                  <motion.img
                    key={activeTab}
                    src={JIRO_RANKING_IMAGES[activeTab]}
                    alt="Jiro"
                    className="hidden md:block absolute bottom-0 left-0 w-56 h-auto pointer-events-none select-none"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                  />
                  {/* 2do lugar */}
                  {top3Clans[1] && (
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex flex-col items-center"
                    >
                      <div 
                        className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-2 shadow-xl"
                        style={{ backgroundColor: top3Clans[1].color }}
                      >
                        {CLAN_EMBLEMS[top3Clans[1].emblem] || '🛡️'}
                      </div>
                      <p className={`font-bold text-center ${isFullscreen ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                        {top3Clans[1].name}
                      </p>
                      <p className={`text-sm ${isFullscreen ? 'text-gray-300' : 'text-gray-500'}`}>
                        {top3Clans[1].totalXp.toLocaleString()} XP
                      </p>
                      <div className={`mt-2 w-24 h-24 bg-gradient-to-t ${PODIUM_COLORS[1].bg} rounded-t-xl flex items-center justify-center shadow-lg ${PODIUM_COLORS[1].shadow}`}>
                        <span className="text-4xl">{PODIUM_COLORS[1].medal}</span>
                      </div>
                    </motion.div>
                  )}

                  {/* 1er lugar */}
                  {top3Clans[0] && (
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex flex-col items-center"
                    >
                      <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Crown className="w-8 h-8 text-amber-400 mb-2" />
                      </motion.div>
                      <div 
                        className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl mb-2 shadow-2xl ring-4 ring-amber-400/50"
                        style={{ backgroundColor: top3Clans[0].color }}
                      >
                        {CLAN_EMBLEMS[top3Clans[0].emblem] || '🛡️'}
                      </div>
                      <p className={`font-bold text-lg text-center ${isFullscreen ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                        {top3Clans[0].name}
                      </p>
                      <p className={`text-sm ${isFullscreen ? 'text-amber-300' : 'text-amber-600'} font-semibold`}>
                        {top3Clans[0].totalXp.toLocaleString()} XP
                      </p>
                      <div className={`mt-2 w-28 h-32 bg-gradient-to-t ${PODIUM_COLORS[0].bg} rounded-t-xl flex items-center justify-center shadow-xl ${PODIUM_COLORS[0].shadow}`}>
                        <span className="text-5xl">{PODIUM_COLORS[0].medal}</span>
                      </div>
                    </motion.div>
                  )}

                  {/* 3er lugar */}
                  {top3Clans[2] && (
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="flex flex-col items-center"
                    >
                      <div 
                        className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-2 shadow-xl"
                        style={{ backgroundColor: top3Clans[2].color }}
                      >
                        {CLAN_EMBLEMS[top3Clans[2].emblem] || '🛡️'}
                      </div>
                      <p className={`font-bold text-center ${isFullscreen ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                        {top3Clans[2].name}
                      </p>
                      <p className={`text-sm ${isFullscreen ? 'text-gray-300' : 'text-gray-500'}`}>
                        {top3Clans[2].totalXp.toLocaleString()} XP
                      </p>
                      <div className={`mt-2 w-24 h-20 bg-gradient-to-t ${PODIUM_COLORS[2].bg} rounded-t-xl flex items-center justify-center shadow-lg ${PODIUM_COLORS[2].shadow}`}>
                        <span className="text-4xl">{PODIUM_COLORS[2].medal}</span>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Resto de clanes */}
              {restClans.length > 0 && (
                <div className={`rounded-xl overflow-hidden ${isFullscreen ? 'bg-white/10' : 'bg-white dark:bg-gray-800'} shadow-lg`}>
                  {restClans.map((clan, index) => (
                    <motion.div
                      key={clan.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className={`flex items-center gap-4 p-4 ${
                        index !== restClans.length - 1 
                          ? isFullscreen ? 'border-b border-white/10' : 'border-b border-gray-100 dark:border-gray-700' 
                          : ''
                      }`}
                    >
                      <span className={`w-8 text-center font-bold ${isFullscreen ? 'text-gray-400' : 'text-gray-400'}`}>
                        #{index + 4}
                      </span>
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: clan.color }}
                      >
                        {CLAN_EMBLEMS[clan.emblem] || '🛡️'}
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold ${isFullscreen ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                          {clan.name}
                        </p>
                        <p className={`text-xs ${isFullscreen ? 'text-gray-400' : 'text-gray-500'}`}>
                          {clan.members?.length || 0} miembros
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${isFullscreen ? 'text-violet-400' : 'text-violet-600 dark:text-violet-400'}`}>
                          {clan.totalXp.toLocaleString()}
                        </p>
                        <p className={`text-xs ${isFullscreen ? 'text-gray-400' : 'text-gray-500'}`}>XP</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Ranking de Estudiantes
            <div className="space-y-6">
              {/* Podio */}
              {top3Students.length > 0 && (
                <div className="relative flex items-end justify-center gap-4 py-8">
                  <motion.img
                    key={activeTab}
                    src={JIRO_RANKING_IMAGES[activeTab]}
                    alt="Jiro"
                    className="hidden md:block absolute bottom-0 left-0 w-56 h-auto pointer-events-none select-none"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                  />
                  {/* 2do lugar */}
                  {top3Students[1] && (
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex flex-col items-center"
                    >
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${currentTab.color} flex items-center justify-center text-2xl mb-2 shadow-xl`}>
                        {CHARACTER_CLASSES[top3Students[1].characterClass]?.icon || '🧙'}
                      </div>
                      <p className={`font-bold text-center ${isFullscreen ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                        {top3Students[1].characterName || top3Students[1].user?.firstName}
                      </p>
                      <p className={`text-sm ${isFullscreen ? 'text-gray-300' : 'text-gray-500'}`}>
                        {getValue(top3Students[1]).toLocaleString()} {getUnit()}
                      </p>
                      <div className={`mt-2 w-24 h-24 bg-gradient-to-t ${PODIUM_COLORS[1].bg} rounded-t-xl flex items-center justify-center shadow-lg ${PODIUM_COLORS[1].shadow}`}>
                        <span className="text-4xl">{PODIUM_COLORS[1].medal}</span>
                      </div>
                    </motion.div>
                  )}

                  {/* 1er lugar */}
                  {top3Students[0] && (
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex flex-col items-center"
                    >
                      <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Crown className="w-8 h-8 text-amber-400 mb-2" />
                      </motion.div>
                      <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${currentTab.color} flex items-center justify-center text-3xl mb-2 shadow-2xl ring-4 ring-amber-400/50`}>
                        {CHARACTER_CLASSES[top3Students[0].characterClass]?.icon || '🧙'}
                      </div>
                      <p className={`font-bold text-lg text-center ${isFullscreen ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                        {top3Students[0].characterName || top3Students[0].user?.firstName}
                      </p>
                      <p className={`text-sm ${isFullscreen ? 'text-amber-300' : 'text-amber-600'} font-semibold`}>
                        {getValue(top3Students[0]).toLocaleString()} {getUnit()}
                      </p>
                      <div className={`mt-2 w-28 h-32 bg-gradient-to-t ${PODIUM_COLORS[0].bg} rounded-t-xl flex items-center justify-center shadow-xl ${PODIUM_COLORS[0].shadow}`}>
                        <span className="text-5xl">{PODIUM_COLORS[0].medal}</span>
                      </div>
                    </motion.div>
                  )}

                  {/* 3er lugar */}
                  {top3Students[2] && (
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="flex flex-col items-center"
                    >
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${currentTab.color} flex items-center justify-center text-2xl mb-2 shadow-xl`}>
                        {CHARACTER_CLASSES[top3Students[2].characterClass]?.icon || '🧙'}
                      </div>
                      <p className={`font-bold text-center ${isFullscreen ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                        {top3Students[2].characterName || top3Students[2].user?.firstName}
                      </p>
                      <p className={`text-sm ${isFullscreen ? 'text-gray-300' : 'text-gray-500'}`}>
                        {getValue(top3Students[2]).toLocaleString()} {getUnit()}
                      </p>
                      <div className={`mt-2 w-24 h-20 bg-gradient-to-t ${PODIUM_COLORS[2].bg} rounded-t-xl flex items-center justify-center shadow-lg ${PODIUM_COLORS[2].shadow}`}>
                        <span className="text-4xl">{PODIUM_COLORS[2].medal}</span>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Resto de estudiantes */}
              {restStudents.length > 0 && (
                <div className={`rounded-xl overflow-hidden ${isFullscreen ? 'bg-white/10' : 'bg-white dark:bg-gray-800'} shadow-lg`}>
                  {restStudents.map((student, index) => {
                    const classInfo = CHARACTER_CLASSES[student.characterClass];
                    return (
                      <motion.div
                        key={student.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * index }}
                        className={`flex items-center gap-4 p-4 ${
                          index !== restStudents.length - 1 
                            ? isFullscreen ? 'border-b border-white/10' : 'border-b border-gray-100 dark:border-gray-700' 
                            : ''
                        }`}
                      >
                        <span className={`w-8 text-center font-bold ${isFullscreen ? 'text-gray-400' : 'text-gray-400'}`}>
                          #{index + 4}
                        </span>
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${currentTab.color} flex items-center justify-center text-lg`}>
                          {classInfo?.icon || '🧙'}
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold ${isFullscreen ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                            {student.characterName || student.user?.firstName}
                          </p>
                          <p className={`text-xs ${isFullscreen ? 'text-gray-400' : 'text-gray-500'}`}>
                            {classInfo?.name} • Nivel {student.level}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${isFullscreen ? 'text-violet-400' : 'text-violet-600 dark:text-violet-400'}`}>
                            {getValue(student).toLocaleString()}
                          </p>
                          <p className={`text-xs ${isFullscreen ? 'text-gray-400' : 'text-gray-500'}`}>{getUnit()}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Stats rápidos */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`rounded-xl p-4 ${isFullscreen ? 'bg-white/10' : 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className={`w-5 h-5 ${isFullscreen ? 'text-violet-400' : 'text-violet-500'}`} />
                    <span className={`text-sm font-medium ${isFullscreen ? 'text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>XP Total Clase</span>
                  </div>
                  <p className={`text-2xl font-bold ${isFullscreen ? 'text-white' : 'text-violet-600 dark:text-violet-400'}`}>
                    {students.reduce((sum, s) => sum + s.xp, 0).toLocaleString()}
                  </p>
                </div>
                <div className={`rounded-xl p-4 ${isFullscreen ? 'bg-white/10' : 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Coins className={`w-5 h-5 ${isFullscreen ? 'text-amber-400' : 'text-amber-500'}`} />
                    <span className={`text-sm font-medium ${isFullscreen ? 'text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>Oro Total</span>
                  </div>
                  <p className={`text-2xl font-bold ${isFullscreen ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`}>
                    {students.reduce((sum, s) => sum + s.gp, 0).toLocaleString()}
                  </p>
                </div>
                <div className={`rounded-xl p-4 ${isFullscreen ? 'bg-white/10' : 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className={`w-5 h-5 ${isFullscreen ? 'text-emerald-400' : 'text-emerald-500'}`} />
                    <span className={`text-sm font-medium ${isFullscreen ? 'text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>Nivel Promedio</span>
                  </div>
                  <p className={`text-2xl font-bold ${isFullscreen ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {students.length > 0 ? (students.reduce((sum, s) => sum + s.level, 0) / students.length).toFixed(1) : 0}
                  </p>
                </div>
                <div className={`rounded-xl p-4 ${isFullscreen ? 'bg-white/10' : 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className={`w-5 h-5 ${isFullscreen ? 'text-blue-400' : 'text-blue-500'}`} />
                    <span className={`text-sm font-medium ${isFullscreen ? 'text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>Estudiantes</span>
                  </div>
                  <p className={`text-2xl font-bold ${isFullscreen ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`}>
                    {students.length}
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
