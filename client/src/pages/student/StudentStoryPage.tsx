import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import {
  BookOpen,
  Lock,
  CheckCircle2,
  Sparkles,
  Clock,
  Target,
  Heart,
  Play,
  Eye,
  ChevronDown,
  ChevronRight,
  Film,
  MessageSquare,
  Crown,
  Medal,
  Users,
  Zap,
  Gift,
} from 'lucide-react';
import { useStudentStore } from '../../store/studentStore';
import { studentApi } from '../../lib/studentApi';
import { storyApi, type StudentChapterInfo, type StudentSceneSummary, type StoryScene } from '../../lib/storyApi';
import { SceneCinematic } from '../../components/story/SceneCinematic';

const CHARACTER_CLASS_ICONS: Record<string, string> = {
  GUARDIAN: '🛡️',
  ARCANE: '🔮',
  EXPLORER: '🧭',
  ALCHEMIST: '⚗️',
};

export const StudentStoryPage = () => {
  const { selectedClassIndex } = useStudentStore();
  const { storyTheme, isThemeDark, hasStoryTheme } = useOutletContext<{
    storyTheme?: any;
    isThemeDark?: boolean;
    hasStoryTheme?: boolean;
  }>();

  const queryClient = useQueryClient();
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [cinematicScene, setCinematicScene] = useState<StoryScene | null>(null);
  const [cinematicQueue, setCinematicQueue] = useState<StoryScene[]>([]);

  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });

  const currentProfile = myClasses?.[selectedClassIndex];

  const { data: storyData, isLoading } = useQuery({
    queryKey: ['student-story', currentProfile?.classroomId, currentProfile?.id],
    queryFn: () => storyApi.getStudentStoryData(currentProfile!.classroomId),
    enabled: !!currentProfile?.classroomId && !!currentProfile?.id,
  });

  const markViewedMutation = useMutation({
    mutationFn: ({ sceneId }: { sceneId: string }) =>
      storyApi.markSceneViewed(sceneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-story'] });
    },
  });

  // Auto-play unseen scenes (INTRO, MILESTONE when progress >= threshold, OUTRO when chapter completed)
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  useEffect(() => {
    if (storyData && storyData.unseenScenes.length > 0 && !cinematicScene && !hasAutoPlayed) {
      // Sort by chapter order and scene order to play in sequence
      const sortedScenes = [...storyData.unseenScenes].sort((a, b) => {
        const chapterA = storyData.chapters.find(c => c.id === a.chapterId);
        const chapterB = storyData.chapters.find(c => c.id === b.chapterId);
        if (!chapterA || !chapterB) return 0;
        if (chapterA.orderIndex !== chapterB.orderIndex) return chapterA.orderIndex - chapterB.orderIndex;
        return a.orderIndex - b.orderIndex;
      });

      // Load full scene data and start cinematic
      const loadAndPlay = async () => {
        try {
          const firstScene = await storyApi.getSceneForViewing(sortedScenes[0].id);
          if (firstScene) {
            // Load remaining scenes
            const remainingScenes = await Promise.all(
              sortedScenes.slice(1).map(s => storyApi.getSceneForViewing(s.id))
            );
            setCinematicScene(firstScene);
            setCinematicQueue(remainingScenes.filter(Boolean) as StoryScene[]);
            setHasAutoPlayed(true);
          }
        } catch {
          // silently fail
        }
      };
      loadAndPlay();
    }
  }, [storyData, cinematicScene, hasAutoPlayed]);

  // Reset auto-play flag when story data changes (e.g., new milestone reached)
  useEffect(() => {
    if (storyData?.unseenScenes.length === 0) {
      setHasAutoPlayed(false);
    }
  }, [storyData?.unseenScenes.length]);

  // Play all scenes of a chapter sequentially
  const handlePlayChapterScenes = async (chapterId: string) => {
    if (!storyData) return;
    const chapter = storyData.chapters.find(c => c.id === chapterId);
    if (!chapter || chapter.status === 'LOCKED') return;

    try {
      const scenes = await storyApi.getChapterScenesForStudent(chapterId);
      if (scenes.length > 0) {
        setCinematicScene(scenes[0]);
        setCinematicQueue(scenes.slice(1));
      }
    } catch {
      // silently fail
    }
  };

  // Play a single scene (for DESARROLLO scenes)
  const handlePlaySingleScene = async (sceneId: string) => {
    try {
      const scene = await storyApi.getSceneForViewing(sceneId);
      if (scene) {
        setCinematicScene(scene);
        setCinematicQueue([]);
      }
    } catch {
      // silently fail
    }
  };

  const handleCinematicComplete = () => {
    if (cinematicScene) {
      markViewedMutation.mutate({ sceneId: cinematicScene.id });
    }

    if (cinematicQueue.length > 0) {
      const [next, ...rest] = cinematicQueue;
      setCinematicScene(next);
      setCinematicQueue(rest);
    } else {
      setCinematicScene(null);
      setCinematicQueue([]);
    }
  };

  // Theme helpers
  const isDark = hasStoryTheme ? !!isThemeDark : false;
  const primaryColor = storyTheme?.colors?.primary || '#6366f1';
  const secondaryColor = storyTheme?.colors?.secondary || '#9333ea';

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (!storyData) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-center p-10 rounded-2xl border-2 border-dashed ${
            isDark
              ? 'border-white/20 bg-white/5'
              : 'border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50'
          }`}
        >
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
            No hay historia activa
          </h2>
          <p className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>
            Tu clase aún no tiene una historia en curso. ¡Pronto podría comenzar una aventura!
          </p>
        </motion.div>
      </div>
    );
  }

  const completedCount = storyData.chapters.filter(c => c.status === 'COMPLETED').length;
  const totalCount = storyData.chapters.length;

  return (
    <div className="w-full px-4 py-6 space-y-6">
      {/* Story Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl shadow-xl"
        style={{
          background: hasStoryTheme
            ? `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
            : 'linear-gradient(135deg, #6366f1, #9333ea)',
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-white/5 rounded-full" />

        <div className="relative p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-2xl shadow-lg">
              {storyData.themeConfig?.banner?.emoji || '📖'}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                {storyData.title}
              </h1>
              {storyData.description && (
                <p className="text-white/70 text-sm mt-0.5 line-clamp-2">{storyData.description}</p>
              )}
            </div>
          </div>

          {/* Overall progress */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                className="h-full bg-white/80 rounded-full"
              />
            </div>
            <span className="text-white/80 text-xs font-medium whitespace-nowrap">
              {completedCount}/{totalCount} capítulos
            </span>
          </div>
        </div>
      </motion.div>

      {/* Chapters Timeline */}
      <div className="relative">
        {storyData.chapters.map((chapter, index) => (
          <ChapterNode
            key={chapter.id}
            chapter={chapter}
            index={index}
            isLast={index === storyData.chapters.length - 1}
            isExpanded={expandedChapter === chapter.id}
            onToggle={() => setExpandedChapter(expandedChapter === chapter.id ? null : chapter.id)}
            onPlayScenes={() => handlePlayChapterScenes(chapter.id)}
            onPlaySingleScene={handlePlaySingleScene}
            hasUnseenScenes={storyData.unseenScenes.some(s => s.chapterId === chapter.id)}
            isDark={isDark}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
          />
        ))}
      </div>

      {/* Cinematic overlay */}
      <AnimatePresence>
        {cinematicScene && (
          <SceneCinematic
            key={cinematicScene.id}
            scene={cinematicScene}
            onComplete={handleCinematicComplete}
            onClose={() => {
              setCinematicScene(null);
              setCinematicQueue([]);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ==================== CHAPTER NODE ====================

interface ChapterNodeProps {
  chapter: StudentChapterInfo;
  index: number;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onPlayScenes: () => void;
  onPlaySingleScene: (sceneId: string) => void;
  hasUnseenScenes: boolean;
  isDark: boolean;
  primaryColor: string;
  secondaryColor: string;
}

const ChapterNode = ({
  chapter,
  index,
  isLast,
  isExpanded,
  onToggle,
  onPlayScenes,
  onPlaySingleScene,
  hasUnseenScenes,
  isDark,
  primaryColor,
  secondaryColor,
}: ChapterNodeProps) => {
  const isLocked = chapter.status === 'LOCKED';
  const isActive = chapter.status === 'ACTIVE';
  const isCompleted = chapter.status === 'COMPLETED';

  // Parse completion config
  const config = (() => {
    const raw = chapter.completionConfig;
    if (!raw) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return raw;
  })();

  const target = config?.targetXp || 0;
  const progress = chapter.currentProgress || 0;
  const progressPercent = target > 0 ? Math.min((progress / target) * 100, 100) : 0;

  const completionLabel =
    chapter.completionType === 'BIMESTER' ? 'Bimestre' :
    chapter.completionType === 'XP_GOAL' ? 'Meta XP' : 'Donación';

  const completionIcon =
    chapter.completionType === 'BIMESTER' ? <Clock size={12} /> :
    chapter.completionType === 'XP_GOAL' ? <Target size={12} /> : <Heart size={12} />;

  // Node icon
  const nodeIcon = isCompleted
    ? <CheckCircle2 size={20} className="text-white" />
    : isActive
    ? <Sparkles size={20} className="text-white" />
    : <Lock size={16} className="text-gray-400" />;

  const nodeColor = isCompleted
    ? 'bg-gradient-to-br from-emerald-400 to-green-500 shadow-emerald-500/40'
    : isActive
    ? `shadow-lg`
    : 'bg-gray-200 dark:bg-gray-700';

  return (
    <div className="flex gap-4">
      {/* Timeline line + node */}
      <div className="flex flex-col items-center flex-shrink-0">
        {/* Node circle */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: index * 0.1 }}
          className={`w-10 h-10 rounded-full flex items-center justify-center ${nodeColor} ${
            isActive ? 'ring-4 ring-offset-2' : ''
          }`}
          style={
            isActive
              ? {
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  boxShadow: `0 0 20px ${primaryColor}50`,
                }
              : undefined
          }
        >
          {isActive && hasUnseenScenes && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500" />
            </span>
          )}
          {nodeIcon}
        </motion.div>

        {/* Connecting line */}
        {!isLast && (
          <div
            className={`w-0.5 flex-1 min-h-[24px] ${
              isCompleted
                ? 'bg-gradient-to-b from-emerald-400 to-emerald-300'
                : isActive
                ? `bg-gradient-to-b from-gray-300 dark:from-gray-600 to-gray-200 dark:to-gray-700`
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
            style={
              isActive
                ? { background: `linear-gradient(to bottom, ${primaryColor}80, ${primaryColor}20)` }
                : undefined
            }
          />
        )}
      </div>

      {/* Chapter content */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 + 0.05 }}
        className={`flex-1 mb-6 ${isLast ? '' : ''}`}
      >
        <div
          onClick={!isLocked ? onToggle : undefined}
          className={`rounded-xl border transition-all ${
            isLocked
              ? isDark
                ? 'bg-white/5 border-white/10 opacity-60'
                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60'
              : isActive
              ? isDark
                ? 'bg-white/10 border-white/20 hover:bg-white/15 cursor-pointer'
                : 'bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-800 shadow-md hover:shadow-lg cursor-pointer'
              : isDark
              ? 'bg-white/5 border-white/15 hover:bg-white/10 cursor-pointer'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md cursor-pointer'
          }`}
        >
          {/* Chapter header */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  isCompleted
                    ? 'text-emerald-500'
                    : isActive
                    ? 'text-purple-600 dark:text-purple-400'
                    : isDark ? 'text-white/40' : 'text-gray-400'
                }`}>
                  Cap. {index + 1}
                </span>
                {!isLocked && (
                  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    isDark
                      ? 'bg-white/10 text-white/60'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {completionIcon} {completionLabel}
                  </span>
                )}
                {isCompleted && chapter.completedAt && (
                  <span className={`text-[10px] ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                    ✓ {new Date(chapter.completedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              {!isLocked && (
                <div className="flex items-center gap-1">
                  {chapter.scenesCount > 0 && (
                    <span className={`text-[10px] ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                      {chapter.scenesCount} escena{chapter.scenesCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronDown size={16} className={isDark ? 'text-white/40' : 'text-gray-400'} />
                  ) : (
                    <ChevronRight size={16} className={isDark ? 'text-white/40' : 'text-gray-400'} />
                  )}
                </div>
              )}
            </div>

            <h3 className={`text-base font-semibold mt-1 ${
              isLocked
                ? isDark ? 'text-white/40' : 'text-gray-400'
                : isDark ? 'text-white' : 'text-gray-900 dark:text-white'
            }`}>
              {chapter.title}
            </h3>

            {/* PROMINENT PROGRESS BAR - only for active/completed with target */}
            {!isLocked && target > 0 && (
              <div className={`mt-3 p-4 rounded-xl ${
                isDark
                  ? 'bg-black/20 border border-white/10'
                  : isActive
                  ? 'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-100 dark:border-purple-800'
                  : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600'
              }`}>
                {/* Header with icon and explanation */}
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isActive
                      ? isDark ? 'bg-white/10' : 'bg-purple-100 dark:bg-purple-900/30'
                      : 'bg-emerald-100 dark:bg-emerald-900/30'
                  }`}>
                    {chapter.completionType === 'XP_GOAL' ? (
                      <Zap size={20} className={isActive ? (isDark ? 'text-white/80' : 'text-purple-500') : 'text-emerald-500'} />
                    ) : (
                      <Gift size={20} className={isActive ? (isDark ? 'text-white/80' : 'text-purple-500') : 'text-emerald-500'} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${
                        isActive
                          ? isDark ? 'text-white' : 'text-purple-700 dark:text-purple-300'
                          : isDark ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {chapter.completionType === 'XP_GOAL' ? '⚡ Meta de XP Colectiva' : '💝 Donación de XP'}
                      </span>
                      <span className={`text-lg font-bold ${
                        isActive
                          ? isDark ? 'text-white' : 'text-purple-700 dark:text-purple-300'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {progressPercent.toFixed(1)}%
                      </span>
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-relaxed ${isDark ? 'text-white/50' : 'text-gray-500 dark:text-gray-400'}`}>
                      {chapter.completionType === 'XP_GOAL'
                        ? 'El capítulo se completa cuando la suma del XP de todos los estudiantes alcance la meta.'
                        : `Cada vez que ganas XP, un ${config?.donationPercent || 10}% se dona automáticamente. ¡Sigue ganando XP para completar el capítulo!`}
                    </p>
                  </div>
                </div>

                {/* Big progress bar */}
                <div className={`h-5 rounded-full overflow-hidden ${
                  isDark ? 'bg-white/10' : 'bg-gray-200 dark:bg-gray-600'
                }`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(progressPercent, 1)}%` }}
                    transition={{ duration: 1.2, delay: 0.2, ease: 'easeOut' }}
                    className="h-full rounded-full relative"
                    style={{
                      background: isCompleted
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
                    }}
                  >
                    {/* Shine effect */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      />
                    )}
                  </motion.div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600 dark:text-gray-400'}`}>
                    {Math.round(progress).toLocaleString()} XP {chapter.completionType === 'DONATION' && 'donados'}
                  </span>
                  <span className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600 dark:text-gray-400'}`}>
                    Meta: {target.toLocaleString()} XP
                  </span>
                </div>

                {/* Remaining XP hint */}
                {isActive && progress < target && (
                  <div className={`mt-2 pt-2 border-t ${isDark ? 'border-white/10' : 'border-gray-200 dark:border-gray-600'}`}>
                    <p className={`text-[11px] text-center ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                      Faltan <span className="font-bold">{Math.round(target - progress).toLocaleString()} XP</span> para completar el capítulo
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Bimester type - no numeric progress */}
            {!isLocked && chapter.completionType === 'BIMESTER' && isActive && (
              <div className={`mt-3 p-4 rounded-xl ${
                isDark
                  ? 'bg-black/20 border border-white/10'
                  : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isDark ? 'bg-white/10' : 'bg-amber-100 dark:bg-amber-900/30'
                  }`}>
                    <Clock size={20} className={isDark ? 'text-white/70' : 'text-amber-500'} />
                  </div>
                  <div>
                    <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-amber-700 dark:text-amber-300'}`}>
                      📅 Completado por Bimestre
                    </span>
                    <p className={`text-[11px] mt-0.5 leading-relaxed ${isDark ? 'text-white/50' : 'text-amber-600/80 dark:text-amber-400/80'}`}>
                      Este capítulo se completará automáticamente cuando el profesor cierre el bimestre actual.
                      ¡Sigue participando en clase mientras tanto!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Expanded content */}
          <AnimatePresence>
            {isExpanded && !isLocked && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className={`px-4 pb-4 pt-0 space-y-4 ${
                  isDark ? 'border-t border-white/10' : 'border-t border-gray-100 dark:border-gray-700'
                }`}>
                  {chapter.description && (
                    <p className={`text-sm mt-3 ${isDark ? 'text-white/60' : 'text-gray-600 dark:text-gray-400'}`}>
                      {chapter.description}
                    </p>
                  )}

                  {/* Leaderboard for XP_GOAL and DONATION */}
                  {isActive && (chapter.completionType === 'XP_GOAL' || chapter.completionType === 'DONATION') && (
                    <ChapterLeaderboardPanel
                      chapterId={chapter.id}
                      completionType={chapter.completionType}
                      isDark={isDark}
                      primaryColor={primaryColor}
                    />
                  )}

                  {/* All scenes - shown individually */}
                  {chapter.scenes && chapter.scenes.length > 0 && (
                    <div className="space-y-2">
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                        Escenas del capítulo
                      </span>
                      {chapter.scenes.map((scene: StudentSceneSummary) => {
                        // MILESTONE scenes are locked until viewed (unlocked by reaching the milestone)
                        const isMilestoneLocked = scene.type === 'MILESTONE' && !scene.viewed;
                        const sceneTypeLabel = scene.type === 'MILESTONE' ? 'Hito' : scene.type === 'INTRO' ? 'Intro' : scene.type === 'OUTRO' ? 'Final' : '';

                        return (
                          <button
                            key={scene.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isMilestoneLocked) {
                                onPlaySingleScene(scene.id);
                              }
                            }}
                            disabled={isMilestoneLocked}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                              isMilestoneLocked
                                ? isDark
                                  ? 'bg-white/5 border border-white/5 opacity-60 cursor-not-allowed'
                                  : 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed'
                                : isDark
                                ? 'bg-white/5 hover:bg-white/10 border border-white/10'
                                : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-600'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isMilestoneLocked
                                ? 'bg-gray-300 dark:bg-gray-600'
                                : scene.viewed
                                ? isDark ? 'bg-white/10' : 'bg-gray-200 dark:bg-gray-600'
                                : scene.type === 'MILESTONE'
                                ? 'bg-gradient-to-br from-yellow-400 to-amber-500'
                                : 'bg-gradient-to-br from-purple-500 to-indigo-500'
                            }`}>
                              {isMilestoneLocked ? (
                                <Lock size={14} className="text-gray-500 dark:text-gray-400" />
                              ) : scene.type === 'MILESTONE' ? (
                                <Sparkles size={14} className={scene.viewed ? (isDark ? 'text-white/50' : 'text-gray-400') : 'text-white'} />
                              ) : scene.hasMedia ? (
                                <Film size={14} className={scene.viewed ? (isDark ? 'text-white/50' : 'text-gray-400') : 'text-white'} />
                              ) : (
                                <MessageSquare size={14} className={scene.viewed ? (isDark ? 'text-white/50' : 'text-gray-400') : 'text-white'} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${
                                  isMilestoneLocked
                                    ? isDark ? 'text-white/40' : 'text-gray-400'
                                    : isDark ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                  Escena {scene.orderIndex + 1}
                                </span>
                                {sceneTypeLabel && (
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                    scene.type === 'MILESTONE'
                                      ? isMilestoneLocked
                                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                  }`}>
                                    {isMilestoneLocked ? '🔒 ' : ''}{sceneTypeLabel}
                                  </span>
                                )}
                                {!scene.viewed && !isMilestoneLocked && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-yellow-500 text-white animate-pulse">
                                    NUEVA
                                  </span>
                                )}
                              </div>
                              <span className={`text-[11px] ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                                {isMilestoneLocked
                                  ? 'Se desbloquea al alcanzar el hito'
                                  : `${scene.dialogueCount} diálogo${scene.dialogueCount !== 1 ? 's' : ''}${scene.hasMedia ? ' · Con media' : ''}`
                                }
                              </span>
                            </div>
                            {isMilestoneLocked ? (
                              <Lock size={14} className={isDark ? 'text-white/20' : 'text-gray-300'} />
                            ) : (
                              <Play size={14} className={isDark ? 'text-white/40' : 'text-gray-400'} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Replay all cinematic button */}
                  {chapter.scenesCount > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayScenes();
                      }}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        hasUnseenScenes
                          ? 'text-white shadow-lg hover:shadow-xl'
                          : isDark
                          ? 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                      style={
                        hasUnseenScenes
                          ? {
                              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                              boxShadow: `0 4px 15px ${primaryColor}40`,
                            }
                          : undefined
                      }
                    >
                      {hasUnseenScenes ? (
                        <>
                          <Play size={16} />
                          Ver cinemática
                        </>
                      ) : (
                        <>
                          <Eye size={16} />
                          Revivir toda la cinemática
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

// ==================== CHAPTER LEADERBOARD PANEL ====================

interface ChapterLeaderboardPanelProps {
  chapterId: string;
  completionType: 'XP_GOAL' | 'DONATION';
  isDark: boolean;
  primaryColor: string;
}

const ChapterLeaderboardPanel = ({ chapterId, completionType, isDark, primaryColor }: ChapterLeaderboardPanelProps) => {
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ['chapter-leaderboard', chapterId],
    queryFn: () => storyApi.getChapterLeaderboard(chapterId),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={14} className="text-yellow-400" />;
    if (rank === 2) return <Medal size={14} className="text-gray-300" />;
    if (rank === 3) return <Medal size={14} className="text-amber-600" />;
    return <span className="text-[10px] font-bold text-gray-400">#{rank}</span>;
  };

  const getRankBg = (rank: number, isDark: boolean) => {
    if (rank === 1) return isDark ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200';
    if (rank === 2) return isDark ? 'bg-gray-400/10 border-gray-400/20' : 'bg-gray-50 border-gray-200';
    if (rank === 3) return isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200';
    return isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100';
  };

  if (isLoading) {
    return (
      <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-100'}`}>
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600" />
          <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded" />
        </div>
      </div>
    );
  }

  if (!leaderboardData || leaderboardData.leaderboard.length === 0) {
    return (
      <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-100'}`}>
        <Users size={20} className={`mx-auto mb-2 ${isDark ? 'text-white/30' : 'text-gray-300'}`} />
        <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
          {completionType === 'DONATION' ? 'Aún no hay donaciones' : 'Aún no hay datos'}
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl overflow-hidden ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 border border-purple-100 dark:border-purple-800'}`}
    >
      {/* Header */}
      <div className={`px-4 py-3 flex items-center gap-2 ${isDark ? 'bg-white/5' : 'bg-white/50 dark:bg-gray-800/50'}`}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${primaryColor}40, ${primaryColor}20)` }}
        >
          {completionType === 'XP_GOAL' ? (
            <Zap size={16} style={{ color: primaryColor }} />
          ) : (
            <Gift size={16} style={{ color: primaryColor }} />
          )}
        </div>
        <div>
          <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
            {completionType === 'XP_GOAL' ? '🏆 Top XP de la Clase' : '💝 Top Donadores'}
          </h4>
          <p className={`text-[10px] ${isDark ? 'text-white/50' : 'text-gray-500 dark:text-gray-400'}`}>
            {completionType === 'XP_GOAL'
              ? 'Los estudiantes con más XP acumulado'
              : 'Los que más han donado para completar el capítulo'}
          </p>
        </div>
      </div>

      {/* Leaderboard entries */}
      <div className="p-2 space-y-1.5">
        {leaderboardData.leaderboard.map((entry, idx) => (
          <motion.div
            key={entry.studentId}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all hover:scale-[1.01] ${getRankBg(entry.rank, isDark)}`}
          >
            {/* Rank */}
            <div className="w-6 h-6 flex items-center justify-center">
              {getRankIcon(entry.rank)}
            </div>

            {/* Avatar / Class icon */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
              isDark ? 'bg-white/10' : 'bg-white dark:bg-gray-700 shadow-sm'
            }`}>
              {CHARACTER_CLASS_ICONS[entry.characterClass] || '🎮'}
            </div>

            {/* Name & Level */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                {entry.displayName}
              </p>
              <p className={`text-[10px] ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                Nivel {entry.level}
              </p>
            </div>

            {/* XP or Donated amount */}
            <div className="text-right">
              <p className={`text-sm font-bold ${
                entry.rank === 1
                  ? 'text-yellow-500'
                  : isDark ? 'text-white' : 'text-gray-800 dark:text-white'
              }`}>
                {completionType === 'XP_GOAL'
                  ? `${(entry.xp || 0).toLocaleString()} XP`
                  : `${Math.round(entry.donated || 0).toLocaleString()} XP`}
              </p>
              {completionType === 'DONATION' && (
                <p className={`text-[9px] ${isDark ? 'text-white/30' : 'text-gray-400'}`}>donado</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer hint */}
      <div className={`px-4 py-2 text-center ${isDark ? 'bg-white/5' : 'bg-white/30 dark:bg-gray-800/30'}`}>
        <p className={`text-[10px] ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
          {completionType === 'XP_GOAL'
            ? '¡Gana más XP para subir en el ranking!'
            : '¡Cada XP que ganas aporta a la meta!'}
        </p>
      </div>
    </motion.div>
  );
};

export default StudentStoryPage;
