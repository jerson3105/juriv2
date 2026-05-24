import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { 
  ShoppingBag,
  Plus,
  Users,
  Zap,
  Shirt,
  Medal,
  ChevronRight,
  ClipboardList,
  Swords,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { AvatarRenderer } from '../../components/avatar/AvatarRenderer';
import { StudentAttendanceCalendarCard } from '../../components/student/StudentAttendanceCalendarCard';
import { useAuthStore } from '../../store/authStore';
import { useStudentStore } from '../../store/studentStore';
import { studentApi } from '../../lib/studentApi';
import { useCharacterClasses } from '../../hooks/useCharacterClasses';
import { characterClassApi } from '../../lib/characterClassApi';
import { avatarApi } from '../../lib/avatarApi';
import { shopApi } from '../../lib/shopApi';
import { badgeApi, type Badge } from '../../lib/badgeApi';
import { BadgeUnlockModal } from '../../components/badges/BadgeUnlockModal';
import { LevelUpAnimation } from '../../components/effects/LevelUpAnimation';
import { LoginStreakWidget } from '../../components/student/LoginStreakWidget';
import { storyApi, type StoryScene } from '../../lib/storyApi';
import { SceneCinematic } from '../../components/story/SceneCinematic';
import { classNoteApi } from '../../lib/classNoteApi';
import { clanApi, CLAN_EMBLEMS } from '../../lib/clanApi';

export const StudentDashboard = () => {
  const { user } = useAuthStore();
  const { selectedClassIndex } = useStudentStore();
  const navigate = useNavigate();
  const { storyTheme, isThemeDark } = useOutletContext<{ storyTheme?: any; isThemeDark?: boolean; hasStoryTheme?: boolean }>();
  const hasTheme = !!storyTheme;
  
  // Estado para animación de subida de nivel
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(1);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const queryClient = useQueryClient();
  

  const { data: myClasses, isLoading } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });

  // Consultar notificaciones de LEVEL_UP no leídas
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => shopApi.getNotifications(),
  });

  // Clase actualmente seleccionada (sincronizada con el sidebar)
  const currentProfile = myClasses?.[selectedClassIndex];
  const { classMap, classes: characterClasses } = useCharacterClasses(currentProfile?.classroomId);
  

  // Items equipados del avatar
  const { data: equippedItems = [] } = useQuery({
    queryKey: ['avatar-equipped', currentProfile?.id],
    queryFn: () => avatarApi.getEquippedItems(currentProfile!.id),
    enabled: !!currentProfile?.id,
  });

  // Insignias del estudiante
  const { data: studentBadges = [] } = useQuery({
    queryKey: ['student-badges', currentProfile?.id],
    queryFn: () => badgeApi.getStudentBadges(currentProfile!.id),
    enabled: !!currentProfile?.id,
  });

  // Estado para animación de insignia desbloqueada
  const [unlockedBadge, setUnlockedBadge] = useState<Badge | null>(null);

  // Cinematic auto-trigger state
  const [cinematicScene, setCinematicScene] = useState<StoryScene | null>(null);
  const [cinematicQueue, setCinematicQueue] = useState<StoryScene[]>([]);
  const cinematicTriggered = useRef(false);

  // Fetch student story data for auto-cinematic
  const { data: storyData } = useQuery({
    queryKey: ['student-story', currentProfile?.classroomId, currentProfile?.id],
    queryFn: () => storyApi.getStudentStoryData(currentProfile!.classroomId),
    enabled: !!currentProfile?.classroomId && !!currentProfile?.id,
  });

  // Notas de clase pendientes (para sección "Actividades pendientes")
  const { data: classNotes = [] } = useQuery({
    queryKey: ['class-notes', currentProfile?.classroomId],
    queryFn: () => classNoteApi.list(currentProfile!.classroomId),
    enabled: !!currentProfile?.classroomId,
  });

  // Info del clan del estudiante
  const { data: myClanInfo } = useQuery({
    queryKey: ['my-clan-info', currentProfile?.id],
    queryFn: () => clanApi.getStudentClanInfo(currentProfile!.id),
    enabled: !!currentProfile?.id,
  });

  // Auto-trigger cinematic for unseen scenes (only once per session)
  useEffect(() => {
    if (cinematicTriggered.current) return;
    if (!storyData?.unseenScenes?.length) return;
    if (!currentProfile) return;

    cinematicTriggered.current = true;
    const scenes = storyData.unseenScenes;
    setCinematicScene(scenes[0]);
    setCinematicQueue(scenes.slice(1));
  }, [storyData, currentProfile]);

  // Formatear items equipados para el renderer
  const equippedForRenderer = equippedItems.map((item: any) => ({
    slot: item.slot,
    imagePath: item.avatarItem.imagePath,
    layerOrder: item.avatarItem.layerOrder,
  }));

  const characterInfo = currentProfile 
    ? (classMap[currentProfile.characterClassId!] || classMap[currentProfile.characterClass])
    : null;

  const canChooseClass = currentProfile?.classroom?.classAssignmentMode === 'STUDENT_CHOICE';

  const chooseClassMutation = useMutation({
    mutationFn: (characterClassId: string) =>
      characterClassApi.studentChoose(currentProfile!.classroomId, characterClassId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-classes'] });
      setShowClassPicker(false);
    },
  });

  // Detectar notificaciones de LEVEL_UP no leídas y mostrar animación
  useEffect(() => {
    const levelUpNotification = notifications.find(
      (n: any) => n.type === 'LEVEL_UP' && !n.isRead
    );
    
    if (levelUpNotification && currentProfile) {
      // Extraer nivel del mensaje (ej: "Has alcanzado el nivel 3")
      const levelMatch = levelUpNotification.message.match(/nivel (\d+)/);
      if (levelMatch) {
        setNewLevel(parseInt(levelMatch[1]));
        setShowLevelUp(true);
        // Marcar como leída
        shopApi.markNotificationRead(levelUpNotification.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        });
      }
    }
  }, [notifications, currentProfile, queryClient]);

  // Detectar notificaciones de BADGE no leídas y mostrar animación
  useEffect(() => {
    const badgeNotification = notifications.find(
      (n: any) => n.type === 'BADGE' && !n.isRead
    );
    
    if (badgeNotification && currentProfile && studentBadges.length > 0) {
      // Buscar la insignia más reciente
      const latestBadge = studentBadges
        .sort((a: any, b: any) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())[0];
      
      if (latestBadge?.badge) {
        setUnlockedBadge(latestBadge.badge);
        // Marcar como leída
        shopApi.markNotificationRead(badgeNotification.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['student-badges'] });
        });
      }
    }
  }, [notifications, currentProfile, studentBadges, queryClient]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-gray-950 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <div className="h-40 bg-white dark:bg-gray-800 rounded-2xl animate-pulse shadow-lg" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-white dark:bg-gray-800 rounded-xl animate-pulse shadow-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Si no tiene clases, mostrar opción de unirse
  if (!myClasses || myClasses.length === 0 || !currentProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-gray-950 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-lg border border-white/50 dark:border-gray-800 rounded-2xl p-12 text-center max-w-md shadow-xl dark:shadow-black/20"
        >
          <Users className="w-16 h-16 mx-auto text-indigo-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            ¡Bienvenido, {user?.firstName}!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Aún no estás inscrito en ninguna clase. Pide el código a tu profesor para comenzar tu aventura.
          </p>
          <Button 
            size="lg" 
            leftIcon={<Plus size={20} />}
            onClick={() => navigate('/join-class')}
          >
            Unirme a una clase
          </Button>
        </motion.div>
      </div>
    );
  }

  // Calcular XP para el siguiente nivel (sistema progresivo)
  // Nivel N requiere N * xpPerLevel para subir al siguiente
  // XP total para nivel N = xpPerLevel * N * (N-1) / 2
  const xpPerLevel = (currentProfile.classroom as any)?.xpPerLevel || 100;
  const level = currentProfile.level;
  const xpForCurrentLevel = (xpPerLevel * level * (level - 1)) / 2;
  const xpForNextLevel = (xpPerLevel * (level + 1) * level) / 2;
  const xpInLevel = currentProfile.xp - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel; // = level * xpPerLevel
  const xpProgress = (xpInLevel / xpNeeded) * 100;
  const xpRemaining = Math.max(xpNeeded - xpInLevel, 0);
  const studentDisplayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
    || currentProfile.displayName
    || currentProfile.characterName
    || 'Estudiante';
  const studentClassLabel = characterInfo?.name || 'Sin clase';
  const currentStudentRank = currentProfile.classroomRank ?? null;
  const totalClassroomStudents = currentProfile.classroomStudentCount ?? 0;
  const pendingClassNotesCount = classNotes.filter((note) => !note.isCompleted).length;

  return (
    <div className={`min-h-screen -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 ${hasTheme ? '' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-gray-950'}`}>
      {/* Animación de subida de nivel */}
      <LevelUpAnimation
        show={showLevelUp}
        newLevel={newLevel}
        onComplete={() => setShowLevelUp(false)}
      />

      {/* Decorative elements */}
      {!hasTheme && (
        <>
          <div className="absolute top-20 right-10 w-64 h-64 bg-blue-200 dark:bg-blue-950 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-30 animate-pulse" />
          <div className="absolute top-40 left-10 w-64 h-64 bg-purple-200 dark:bg-violet-950 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-30 animate-pulse" style={{ animationDelay: '1s' }} />
        </>
      )}

      <div className="relative z-10">
        {/* Layout de 2 columnas: Avatar + Contenido */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Columna izquierda - Avatar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:w-[280px] flex-shrink-0"
          >
            <div className={`backdrop-blur-lg rounded-2xl p-6 shadow-lg sticky top-4 ${hasTheme && isThemeDark ? 'bg-white/10 border border-white/10 shadow-black/20' : hasTheme ? 'bg-white/70 border border-white/40 shadow-black/5' : 'bg-white/80 shadow-blue-500/10 border border-white/50 dark:bg-gray-900/85 dark:border-gray-800 dark:shadow-black/20'}`}>
              {/* Avatar grande */}
              <motion.div 
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="flex justify-center mb-4"
              >
                <div className={`rounded-2xl p-3 shadow-lg ${hasTheme && isThemeDark ? 'bg-white/10' : 'bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-slate-800 dark:to-slate-700'}`}>
                  <AvatarRenderer
                    gender={currentProfile.avatarGender || 'MALE'}
                    size="xl"
                    equippedItems={equippedForRenderer}
                  />
                </div>
              </motion.div>

              {/* Nombre y clase */}
              <div className="text-center mb-4">
                <h1 className={`text-2xl font-bold ${hasTheme && isThemeDark ? 'text-white' : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent'}`}
                  style={hasTheme && isThemeDark ? undefined : hasTheme ? { color: storyTheme.colors?.primary } : undefined}
                >
                  {currentProfile.characterName || user?.firstName}
                </h1>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-lg">{characterInfo?.icon || '👤'}</span>
                  <p className={`text-sm ${hasTheme && isThemeDark ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>
                    {characterInfo?.name || 'Sin clase'} • Nivel {currentProfile.level}
                  </p>
                </div>
              </div>

              {/* Barra de XP */}
              <div className="mt-4">
                <div className={`flex justify-between text-xs mb-1 ${hasTheme && isThemeDark ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" />
                    Nivel {currentProfile.level}
                  </span>
                  <span>{xpInLevel} / {xpNeeded} XP</span>
                </div>
                <div className={`h-2.5 rounded-full overflow-hidden ${hasTheme && isThemeDark ? 'bg-white/15' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(xpProgress, 100)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                  />
                </div>
                <p className={`text-xs mt-1 ${hasTheme && isThemeDark ? 'text-white/40' : 'text-gray-400 dark:text-gray-500'}`}>
                  Faltan <span className="font-semibold">{(xpNeeded - xpInLevel).toLocaleString()}</span> XP
                </p>
              </div>
            </div>
          </motion.div>

          {/* Columna derecha - Contenido */}
          <div className="flex-1 space-y-5">
        {/* ===== BANNER COMPACTO ===== */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-4 shadow-lg ${hasTheme ? 'shadow-black/20' : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 shadow-purple-500/20'}`}
          style={hasTheme ? { background: `linear-gradient(135deg, ${storyTheme.colors?.primary || '#6366f1'}, ${storyTheme.colors?.secondary || '#9333ea'})` } : undefined}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <span className="text-xl">📚</span>
              </div>
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">
                  {currentProfile.classroom?.name || 'Mi Clase'}
                </h2>
                <p className="text-white/70 text-sm">
                  ¡Bienvenido, {currentProfile.characterName || user?.firstName}!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Contador de notas pendientes */}
              {pendingClassNotesCount > 0 && (
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur rounded-lg px-3 py-1.5">
                  <ClipboardList className="w-4 h-4 text-white" />
                  <span className="text-white font-bold text-sm">{pendingClassNotesCount}</span>
                  <span className="text-white/70 text-xs hidden sm:inline">pendientes</span>
                </div>
              )}
              <div className="text-right">
                <p className="text-white/60 text-xs">Código</p>
                <p className="text-white font-mono font-bold text-lg tracking-wider">
                  {currentProfile.classroom?.code}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ===== RACHA DE LOGIN ===== */}
        {currentProfile?.classroomId && (
          <LoginStreakWidget classroomId={currentProfile.classroomId} />
        )}

        {/* ===== TU PROGRESO ===== */}
        <div>
          <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${hasTheme && isThemeDark ? 'text-white/50' : 'text-gray-400 dark:text-gray-500'}`}>
            Tu progreso
          </h3>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`relative overflow-hidden rounded-[28px] border p-5 md:p-6 shadow-lg ${
              hasTheme && isThemeDark
                ? 'bg-white/10 border-white/10 shadow-black/20'
                : hasTheme
                  ? 'bg-white/70 border-white/40 shadow-black/5'
                  : 'bg-gradient-to-r from-sky-200 via-sky-100 to-cyan-100 border-white/70 shadow-sky-500/10 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 dark:border-gray-800 dark:shadow-black/20'
            }`}
          >
            <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/25 blur-xl" />
            <div className="absolute -bottom-14 left-16 h-28 w-28 rounded-full bg-white/20 blur-2xl" />

            <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
              <div className="min-w-0 lg:w-[230px]">
                <h4 className={`truncate text-lg md:text-xl font-bold leading-tight ${hasTheme && isThemeDark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {studentDisplayName}
                </h4>
                <p className={`mt-1 truncate text-sm font-medium ${hasTheme && isThemeDark ? 'text-white/65' : 'text-slate-500 dark:text-gray-400'}`}>
                  @{studentClassLabel}
                </p>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-semibold ${hasTheme && isThemeDark ? 'text-white' : 'text-slate-800 dark:text-gray-100'}`}>
                      Nivel {currentProfile.level}
                    </span>
                    {canChooseClass && (
                      <button
                        type="button"
                        onClick={() => setShowClassPicker(true)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          hasTheme && isThemeDark
                            ? 'bg-white/10 text-white/80 hover:bg-white/15'
                            : 'bg-white/70 text-sky-700 hover:bg-white dark:bg-gray-800 dark:text-sky-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        {characterInfo ? 'Cambiar clase' : 'Elegir clase'}
                      </button>
                    )}
                  </div>
                  <span className={`text-sm font-medium ${hasTheme && isThemeDark ? 'text-white/75' : 'text-slate-600 dark:text-gray-300'}`}>
                    {xpInLevel.toLocaleString()}/{xpNeeded.toLocaleString()} XP
                  </span>
                </div>

                <div className={`h-3 overflow-hidden rounded-full ${hasTheme && isThemeDark ? 'bg-white/15' : 'bg-white/70 dark:bg-gray-800/80'}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(xpProgress, 100)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-500"
                  />
                </div>

                <p className={`mt-2 text-xs ${hasTheme && isThemeDark ? 'text-white/55' : 'text-slate-500 dark:text-gray-400'}`}>
                  Faltan <span className="font-semibold">{xpRemaining.toLocaleString()}</span> XP para el siguiente nivel
                </p>
              </div>

              <div className="shrink-0 lg:w-[120px] lg:text-right">
                <p className={`text-sm ${hasTheme && isThemeDark ? 'text-white/55' : 'text-slate-500 dark:text-gray-400'}`}>
                  Mi ranking
                </p>
                <div className="mt-1 flex items-end gap-1 lg:justify-end">
                  <span className={`text-4xl font-bold leading-none ${hasTheme && isThemeDark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {currentStudentRank ?? '-'}
                  </span>
                  <span className={`pb-1 text-sm font-semibold ${hasTheme && isThemeDark ? 'text-white/65' : 'text-slate-500 dark:text-gray-400'}`}>
                    /{totalClassroomStudents || '-'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Modal de selección de clase */}
          <AnimatePresence>
            {showClassPicker && canChooseClass && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={() => setShowClassPicker(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center">
                      <Swords className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 dark:text-white">Elige tu clase</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Selecciona la clase de tu personaje</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {characterClasses.filter(c => c.isActive).map(cc => (
                      <button
                        key={cc.id}
                        onClick={() => chooseClassMutation.mutate(cc.id)}
                        disabled={chooseClassMutation.isPending}
                        className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] ${
                          currentProfile.characterClassId === cc.id
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                        }`}
                      >
                        <span className="text-3xl block mb-2">{cc.icon}</span>
                        <p className="font-semibold text-gray-800 dark:text-white">{cc.name}</p>
                        {cc.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{cc.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowClassPicker(false)}
                    className="mt-4 w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ===== MI CLAN ===== */}
        {myClanInfo && myClanInfo.clan && (
          <div>
            <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${hasTheme && isThemeDark ? 'text-white/50' : 'text-gray-400 dark:text-gray-500'}`}>
              Mi Clan
            </h3>
            <div
              onClick={() => navigate('/my-clan')}
              className={`rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${hasTheme && isThemeDark ? 'bg-white/10 border border-white/10 hover:bg-white/15' : 'bg-white/80 backdrop-blur border border-white/50 shadow-sm hover:shadow-lg dark:bg-gray-900/85 dark:border-gray-800 dark:shadow-black/20 dark:hover:bg-gray-900'}`}
            >
              <div className="flex items-center gap-4">
                {/* Emblema grande */}
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shadow-inner flex-shrink-0"
                  style={{ backgroundColor: myClanInfo.clan.color + '25', borderColor: myClanInfo.clan.color + '50', borderWidth: 2 }}
                >
                  {CLAN_EMBLEMS[myClanInfo.clan.emblem] || '🛡️'}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-bold text-base ${hasTheme && isThemeDark ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                      {myClanInfo.clan.name}
                    </h4>
                    {myClanInfo.clan.rank && (
                      <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        #{myClanInfo.clan.rank}
                      </span>
                    )}
                  </div>
                  {myClanInfo.clan.motto && (
                    <p className={`text-xs italic mt-0.5 ${hasTheme && isThemeDark ? 'text-white/50' : 'text-gray-400 dark:text-gray-500'}`}>
                      "{myClanInfo.clan.motto}"
                    </p>
                  )}
                  <div className={`flex items-center gap-4 mt-1.5 text-xs ${hasTheme && isThemeDark ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>
                    <span className="flex items-center gap-1">⚡ {myClanInfo.clan.totalXp.toLocaleString()} XP</span>
                    <span className="flex items-center gap-1">🏆 {myClanInfo.clan.wins}V - {myClanInfo.clan.losses}D</span>
                    <span className="flex items-center gap-1">👥 {myClanInfo.members.length} miembros</span>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 flex-shrink-0 ${hasTheme && isThemeDark ? 'text-white/30' : 'text-gray-300 dark:text-gray-600'}`} />
              </div>
            </div>
          </div>
        )}

        {currentProfile?.classroomId && (
          <StudentAttendanceCalendarCard
            classroomId={currentProfile.classroomId}
            title="Calendario de clase"
            hasTheme={hasTheme}
            isThemeDark={isThemeDark}
            showAttendance={false}
          />
        )}

        {/* ===== EXPLORAR ===== */}
        <div>
          <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${hasTheme && isThemeDark ? 'text-white/50' : 'text-gray-400 dark:text-gray-500'}`}>
            Explorar
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Tienda de Items */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-4 text-white shadow-lg"
            >
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="w-5 h-5" />
                <h3 className="font-bold text-sm">Tienda de Items</h3>
              </div>
              <p className="text-amber-100 mb-3 text-xs">Compra items especiales</p>
              <button 
                onClick={() => navigate('/my-shop')}
                className="w-full py-2 bg-white text-amber-600 rounded-lg text-xs font-bold hover:bg-amber-50 transition-colors"
              >
                Ver items
              </button>
            </motion.div>

            {/* Mis Insignias */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-4 text-white shadow-lg"
            >
              <div className="flex items-center gap-2 mb-3">
                <Medal className="w-5 h-5" />
                <h3 className="font-bold text-sm">Mis Insignias</h3>
                {studentBadges.length > 0 && (
                  <span className="ml-auto bg-white/20 text-xs font-bold px-2 py-0.5 rounded-full">
                    {studentBadges.length}
                  </span>
                )}
              </div>
              <p className="text-amber-100 mb-3 text-xs">
                {studentBadges.length > 0 
                  ? `${studentBadges.length} logro${studentBadges.length !== 1 ? 's' : ''} desbloqueado${studentBadges.length !== 1 ? 's' : ''}`
                  : 'Desbloquea logros en clase'}
              </p>
              <button 
                onClick={() => navigate('/my-badges')}
                className="w-full py-2 bg-white text-amber-600 rounded-lg text-xs font-bold hover:bg-amber-50 transition-colors flex items-center justify-center gap-1"
              >
                Ver insignias
                <ChevronRight size={14} />
              </button>
            </motion.div>

            {/* Personalizar Avatar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-4 text-white shadow-lg"
            >
              <div className="flex items-center gap-2 mb-3">
                <Shirt className="w-5 h-5" />
                <h3 className="font-bold text-sm">Personalizar Avatar</h3>
              </div>
              <p className="text-purple-100 mb-3 text-xs">Viste a tu personaje</p>
              <button 
                onClick={() => navigate('/my-avatar')}
                className="w-full py-2 bg-white text-purple-600 rounded-lg text-xs font-bold hover:bg-purple-50 transition-colors"
              >
                Ver atuendos
              </button>
            </motion.div>
          </div>
        </div>
          </div>
        </div>
      </div>

      {/* Modal de insignia desbloqueada */}
      <BadgeUnlockModal
        badge={unlockedBadge}
        isOpen={!!unlockedBadge}
        onClose={() => setUnlockedBadge(null)}
      />

      {/* Auto-cinematic for unseen story scenes */}
      <AnimatePresence>
        {cinematicScene && (
          <SceneCinematic
            key={cinematicScene.id}
            scene={cinematicScene}
            onComplete={() => {
              // Mark scene as viewed
              storyApi.markSceneViewed(cinematicScene.id);
              // Play next in queue or close
              if (cinematicQueue.length > 0) {
                const [next, ...rest] = cinematicQueue;
                setCinematicScene(next);
                setCinematicQueue(rest);
              } else {
                setCinematicScene(null);
                setCinematicQueue([]);
              }
            }}
            onClose={() => {
              // Mark current as viewed even if skipped
              if (cinematicScene) {
                storyApi.markSceneViewed(cinematicScene.id);
              }
              setCinematicScene(null);
              setCinematicQueue([]);
            }}
          />
        )}
      </AnimatePresence>

    </div>
  );
};
