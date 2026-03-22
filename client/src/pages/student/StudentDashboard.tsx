import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { 
  Sparkles, 
  Heart, 
  Coins, 
  ShoppingBag,
  Plus,
  Users,
  ArrowLeft,
  Zap,
  Shirt,
  Medal,
  ChevronRight,
  Target,
  ClipboardList,
  Calendar,
  MapPin,
  Swords,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { AvatarRenderer } from '../../components/avatar/AvatarRenderer';
import { AvatarShop } from '../../components/avatar/AvatarShop';
import { useAuthStore } from '../../store/authStore';
import { useStudentStore } from '../../store/studentStore';
import { studentApi } from '../../lib/studentApi';
import { useCharacterClasses } from '../../hooks/useCharacterClasses';
import { characterClassApi } from '../../lib/characterClassApi';
import { avatarApi } from '../../lib/avatarApi';
import { shopApi } from '../../lib/shopApi';
import { StudentShopPage } from './StudentShopPage';
import { StudentProgressView } from '../../components/student/StudentProgressView';
import { ClanRankingView } from '../../components/student/ClanRankingView';
import { badgeApi, type Badge, RARITY_COLORS, RARITY_LABELS } from '../../lib/badgeApi';
import { BadgeUnlockModal } from '../../components/badges/BadgeUnlockModal';
import { LevelUpAnimation } from '../../components/effects/LevelUpAnimation';
import { LoginStreakWidget } from '../../components/student/LoginStreakWidget';
import { storyApi, type StoryScene } from '../../lib/storyApi';
import { SceneCinematic } from '../../components/story/SceneCinematic';
import { classNoteApi, type ClassNote } from '../../lib/classNoteApi';
import { jiroExpeditionApi } from '../../lib/jiroExpeditionApi';
import { clanApi, CLAN_EMBLEMS } from '../../lib/clanApi';

export const StudentDashboard = () => {
  const { user } = useAuthStore();
  const { selectedClassIndex } = useStudentStore();
  const navigate = useNavigate();
  const { storyTheme, isThemeDark } = useOutletContext<{ storyTheme?: any; isThemeDark?: boolean; hasStoryTheme?: boolean }>();
  const hasTheme = !!storyTheme;
  const [activeView, setActiveView] = useState<'dashboard' | 'shop' | 'avatar-shop' | 'badges' | 'progress' | 'clan-ranking'>('dashboard');
  
  // Estado para animación de subida de nivel
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(1);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
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

  // Progreso hacia insignias bloqueadas
  const { data: badgeProgress = [] } = useQuery({
    queryKey: ['badge-progress', currentProfile?.id, currentProfile?.classroomId],
    queryFn: () => badgeApi.getStudentProgress(currentProfile!.id, currentProfile!.classroomId),
    enabled: !!currentProfile?.id && !!currentProfile?.classroomId,
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

  // Expediciones Jiro disponibles
  const { data: jiroExpeditions = [] } = useQuery({
    queryKey: ['jiro-available', currentProfile?.id],
    queryFn: () => jiroExpeditionApi.getAvailable(currentProfile!.id),
    enabled: !!currentProfile?.id,
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/80 backdrop-blur-lg border border-white/50 rounded-2xl p-12 text-center max-w-md shadow-xl"
        >
          <Users className="w-16 h-16 mx-auto text-indigo-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            ¡Bienvenido, {user?.firstName}!
          </h2>
          <p className="text-gray-600 mb-6">
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

  // Obtener compañeros de clase para regalos (simplificado - se cargará en StudentShopPage)
  const classmates: Array<{ id: string; characterName: string | null; characterClass: string }> = [];

  // Vista de progreso/estadísticas
  if (activeView === 'progress') {
    return (
      <StudentProgressView
        studentId={currentProfile.id}
        onBack={() => setActiveView('dashboard')}
      />
    );
  }

  // Vista de ranking de clanes
  if (activeView === 'clan-ranking') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8">
        <ClanRankingView
          classroomId={currentProfile.classroomId}
          myClanId={currentProfile.teamId || undefined}
          onBack={() => setActiveView('dashboard')}
        />
      </div>
    );
  }

  // Vista de insignias
  if (activeView === 'badges') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-orange-50 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8">
        <div className="absolute top-20 right-10 w-64 h-64 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        
        <div className="relative z-10 space-y-6">
          {/* Botón volver */}
          <button
            onClick={() => setActiveView('dashboard')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Volver al dashboard</span>
          </button>

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center ring-4 ring-amber-200">
              <Medal className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Mis Insignias</h1>
              <p className="text-sm text-gray-500">
                {studentBadges.length} insignia{studentBadges.length !== 1 ? 's' : ''} desbloqueada{studentBadges.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Insignias desbloqueadas */}
          {studentBadges.length > 0 && (
            <>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Desbloqueadas
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {studentBadges.map((sb: any) => {
                  const badge = sb.badge as Badge;
                  const colors = RARITY_COLORS[badge.rarity];
                  return (
                    <motion.div
                      key={sb.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05 }}
                      className={`bg-white rounded-xl p-4 shadow-lg border-2 ${colors.border} relative`}
                    >
                      {/* Contador si tiene más de una */}
                      {sb.count > 1 && (
                        <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                          x{sb.count}
                        </div>
                      )}
                      <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-br ${colors.gradient} shadow-lg mb-3`}>
                        {badge.customImage ? (
                          <img 
                            src={`http://localhost:3001${badge.customImage}`}
                            alt={badge.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-3xl">{badge.icon}</span>
                        )}
                      </div>
                      <h4 className="font-bold text-gray-800 text-center text-sm">{badge.name}</h4>
                      <p className={`text-xs text-center font-medium mt-1 ${colors.text}`}>
                        {RARITY_LABELS[badge.rarity]}
                      </p>
                      <p className="text-xs text-gray-500 text-center mt-2 line-clamp-2">
                        {badge.description}
                      </p>
                      <p className="text-xs text-gray-400 text-center mt-2">
                        {new Date(sb.unlockedAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}

          {/* Insignias bloqueadas con progreso */}
          {badgeProgress.length > 0 && (
            <>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mt-6">
                <Target className="w-5 h-5 text-gray-400" />
                Por desbloquear
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {badgeProgress.map((progress: any) => {
                  const badge = progress.badge as Badge;
                  return (
                    <motion.div
                      key={badge.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-gray-100 rounded-xl p-4 shadow-lg border-2 border-gray-300 relative overflow-hidden"
                    >
                      {/* Overlay oscuro */}
                      <div className="absolute inset-0 bg-gray-900/10 pointer-events-none" />
                      
                      <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-400 to-gray-500 shadow-lg mb-3 grayscale">
                        {badge.customImage ? (
                          <img 
                            src={`http://localhost:3001${badge.customImage}`}
                            alt={badge.name}
                            className="w-full h-full object-cover opacity-50"
                          />
                        ) : (
                          <span className="text-3xl opacity-50">{badge.icon}</span>
                        )}
                      </div>
                      <h4 className="font-bold text-gray-600 text-center text-sm">{badge.name}</h4>
                      <p className="text-xs text-center font-medium mt-1 text-gray-500">
                        {RARITY_LABELS[badge.rarity]}
                      </p>
                      
                      {/* Barra de progreso */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{progress.currentValue}/{progress.targetValue}</span>
                          <span>{progress.percentage}%</span>
                        </div>
                        <div className="h-2 bg-gray-300 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress.percentage}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}

          {/* Estado vacío */}
          {studentBadges.length === 0 && badgeProgress.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center shadow-lg">
              <Medal className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Aún no tienes insignias</h3>
              <p className="text-gray-500">
                ¡Sigue participando en clase para desbloquear logros!
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista de tienda de items
  if (activeView === 'shop') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8">
        <div className="absolute top-20 right-10 w-64 h-64 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        
        <div className="relative z-10 space-y-6">
          {/* Botón volver */}
          <button
            onClick={() => setActiveView('dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Volver al dashboard</span>
          </button>

          <StudentShopPage
            studentProfile={{
              id: currentProfile.id,
              classroomId: currentProfile.classroomId,
              gp: currentProfile.gp,
              characterName: currentProfile.characterName,
            }}
            classmates={classmates}
          />
        </div>
      </div>
    );
  }

  // Vista de tienda de avatares
  if (activeView === 'avatar-shop') {
    return (
      <div className="-m-4 md:-m-6 lg:-m-8">
        <AvatarShop
          studentProfile={{
            id: currentProfile.id,
            classroomId: currentProfile.classroomId,
            gp: currentProfile.gp,
            avatarGender: currentProfile.avatarGender || 'MALE',
          }}
          onClose={() => setActiveView('dashboard')}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 ${hasTheme ? '' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
      {/* Animación de subida de nivel */}
      <LevelUpAnimation
        show={showLevelUp}
        newLevel={newLevel}
        onComplete={() => setShowLevelUp(false)}
      />

      {/* Decorative elements */}
      {!hasTheme && (
        <>
          <div className="absolute top-20 right-10 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
          <div className="absolute top-40 left-10 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }} />
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
            <div className={`backdrop-blur-lg rounded-2xl p-6 shadow-lg sticky top-4 ${hasTheme && isThemeDark ? 'bg-white/10 border border-white/10 shadow-black/20' : hasTheme ? 'bg-white/70 border border-white/40 shadow-black/5' : 'bg-white/80 shadow-blue-500/10 border border-white/50'}`}>
              {/* Avatar grande */}
              <motion.div 
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="flex justify-center mb-4"
              >
                <div className={`rounded-2xl p-3 shadow-lg ${hasTheme && isThemeDark ? 'bg-white/10' : 'bg-gradient-to-br from-indigo-100 to-purple-100'}`}>
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
                  <p className={`text-sm ${hasTheme && isThemeDark ? 'text-white/60' : 'text-gray-500'}`}>
                    {characterInfo?.name || 'Sin clase'} • Nivel {currentProfile.level}
                  </p>
                </div>
              </div>

              {/* Barra de XP */}
              <div className="mt-4">
                <div className={`flex justify-between text-xs mb-1 ${hasTheme && isThemeDark ? 'text-white/60' : 'text-gray-500'}`}>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" />
                    Nivel {currentProfile.level}
                  </span>
                  <span>{xpInLevel} / {xpNeeded} XP</span>
                </div>
                <div className={`h-2.5 rounded-full overflow-hidden ${hasTheme && isThemeDark ? 'bg-white/15' : 'bg-gray-100'}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(xpProgress, 100)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                  />
                </div>
                <p className={`text-xs mt-1 ${hasTheme && isThemeDark ? 'text-white/40' : 'text-gray-400'}`}>
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
              {classNotes.filter(n => !n.isCompleted).length > 0 && (
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur rounded-lg px-3 py-1.5">
                  <ClipboardList className="w-4 h-4 text-white" />
                  <span className="text-white font-bold text-sm">{classNotes.filter(n => !n.isCompleted).length}</span>
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
          <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${hasTheme && isThemeDark ? 'text-white/50' : 'text-gray-400'}`}>
            Tu progreso
          </h3>

          {/* Stats Grid - 3 cards (XP ya está en la barra inferior) */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* HP Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              whileHover={{ scale: 1.05, y: -4 }}
              className="relative bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-4 shadow-lg shadow-rose-500/30 overflow-hidden group cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                    <Heart className="w-5 h-5 text-white" />
                  </div>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-4xl"
                  >
                    ❤️
                  </motion.div>
                </div>
                <p className="text-3xl font-bold text-white">{currentProfile.hp}</p>
                <p className="text-sm font-medium text-white/80">Vida</p>
              </div>
            </motion.div>

            {/* GP Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              whileHover={{ scale: 1.05, y: -4 }}
              className="relative bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 shadow-lg shadow-amber-500/30 overflow-hidden group cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                    <Coins className="w-5 h-5 text-white" />
                  </div>
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-4xl"
                  >
                    🪙
                  </motion.div>
                </div>
                <p className="text-3xl font-bold text-white">{currentProfile.gp.toLocaleString()}</p>
                <p className="text-sm font-medium text-white/80">Oro</p>
              </div>
            </motion.div>

            {/* Class Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              whileHover={{ scale: 1.05, y: -4 }}
              onClick={canChooseClass ? () => setShowClassPicker(true) : undefined}
              className={`relative rounded-2xl p-4 shadow-lg overflow-hidden group cursor-pointer ${
                !characterInfo ? 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-400/30'
                : characterInfo.color === 'blue' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30'
                : characterInfo.color === 'violet' ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/30'
                : characterInfo.color === 'green' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
                : 'bg-gradient-to-br from-orange-500 to-amber-600 shadow-orange-500/30'
              }`}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-lg">
                    {characterInfo?.icon || '👤'}
                  </div>
                  <span className="text-4xl">{characterInfo?.icon || '❓'}</span>
                </div>
                <p className="text-xl font-bold text-white">{characterInfo?.name || 'Sin clase'}</p>
                <p className="text-sm font-medium text-white/80">
                  {!characterInfo && canChooseClass ? 'Toca para elegir' : `Nv. ${currentProfile.level}`}
                </p>
              </div>
            </motion.div>
          </div>

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
            <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${hasTheme && isThemeDark ? 'text-white/50' : 'text-gray-400'}`}>
              Mi Clan
            </h3>
            <div
              onClick={() => navigate('/my-clan')}
              className={`rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${hasTheme && isThemeDark ? 'bg-white/10 border border-white/10 hover:bg-white/15' : 'bg-white/80 backdrop-blur border border-white/50 shadow-sm hover:shadow-lg'}`}
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
                    <h4 className={`font-bold text-base ${hasTheme && isThemeDark ? 'text-white' : 'text-gray-800'}`}>
                      {myClanInfo.clan.name}
                    </h4>
                    {myClanInfo.clan.rank && (
                      <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        #{myClanInfo.clan.rank}
                      </span>
                    )}
                  </div>
                  {myClanInfo.clan.motto && (
                    <p className={`text-xs italic mt-0.5 ${hasTheme && isThemeDark ? 'text-white/50' : 'text-gray-400'}`}>
                      "{myClanInfo.clan.motto}"
                    </p>
                  )}
                  <div className={`flex items-center gap-4 mt-1.5 text-xs ${hasTheme && isThemeDark ? 'text-white/60' : 'text-gray-500'}`}>
                    <span className="flex items-center gap-1">⚡ {myClanInfo.clan.totalXp.toLocaleString()} XP</span>
                    <span className="flex items-center gap-1">🏆 {myClanInfo.clan.wins}V - {myClanInfo.clan.losses}D</span>
                    <span className="flex items-center gap-1">👥 {myClanInfo.members.length} miembros</span>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 flex-shrink-0 ${hasTheme && isThemeDark ? 'text-white/30' : 'text-gray-300'}`} />
              </div>
            </div>
          </div>
        )}

        {/* ===== ACTIVIDADES PENDIENTES ===== */}
        {(() => {
          const pendingNotes = classNotes.filter(n => !n.isCompleted);
          const activeExpeditions = jiroExpeditions.filter(
            (e: any) => e.studentProgress?.status === 'IN_PROGRESS' || (e.status === 'OPEN' && !e.studentProgress)
          );
          const hasPendingActivities = pendingNotes.length > 0 || activeExpeditions.length > 0;

          if (!hasPendingActivities) return null;

          const CATEGORY_CONFIG: Record<string, { icon: string; color: string }> = {
            task: { icon: '📝', color: 'text-blue-500' },
            review: { icon: '🔍', color: 'text-amber-500' },
            material: { icon: '📚', color: 'text-emerald-500' },
            other: { icon: '📌', color: 'text-gray-500' },
          };

          return (
            <div>
              <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${hasTheme && isThemeDark ? 'text-white/50' : 'text-gray-400'}`}>
                Actividades pendientes
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Notas de clase pendientes */}
                {pendingNotes.length > 0 && (
                  <div className={`rounded-xl p-4 ${hasTheme && isThemeDark ? 'bg-white/10 border border-white/10' : 'bg-white/80 backdrop-blur border border-white/50 shadow-sm'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <ClipboardList className={`w-4 h-4 ${hasTheme && isThemeDark ? 'text-blue-400' : 'text-blue-500'}`} />
                      <span className={`text-sm font-semibold ${hasTheme && isThemeDark ? 'text-white' : 'text-gray-700'}`}>Notas de clase</span>
                      <span className="ml-auto bg-blue-100 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
                        {pendingNotes.length}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-52 overflow-y-auto">
                      {pendingNotes.slice(0, 5).map((note: ClassNote) => {
                        const catConfig = CATEGORY_CONFIG[note.category] || CATEGORY_CONFIG.other;
                        const isExpanded = expandedNoteId === note.id;
                        return (
                          <div
                            key={note.id}
                            onClick={() => setExpandedNoteId(isExpanded ? null : note.id)}
                            className={`flex items-start gap-2 text-sm cursor-pointer rounded-lg p-2 -mx-2 transition-colors ${hasTheme && isThemeDark ? 'text-white/80 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            <span className="mt-0.5 flex-shrink-0">{catConfig.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className={isExpanded ? 'whitespace-pre-wrap' : 'truncate'}>{note.content}</p>
                              {note.dueDate && (
                                <p className={`text-xs flex items-center gap-1 mt-0.5 ${hasTheme && isThemeDark ? 'text-white/40' : 'text-gray-400'}`}>
                                  <Calendar className="w-3 h-3" />
                                  {new Date(note.dueDate).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {pendingNotes.length > 5 && (
                        <p className={`text-xs ${hasTheme && isThemeDark ? 'text-white/40' : 'text-gray-400'}`}>
                          +{pendingNotes.length - 5} más
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Expediciones Jiro activas */}
                {activeExpeditions.length > 0 && (
                  <div className={`rounded-xl p-4 ${hasTheme && isThemeDark ? 'bg-white/10 border border-white/10' : 'bg-white/80 backdrop-blur border border-white/50 shadow-sm'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className={`w-4 h-4 ${hasTheme && isThemeDark ? 'text-orange-400' : 'text-orange-500'}`} />
                      <span className={`text-sm font-semibold ${hasTheme && isThemeDark ? 'text-white' : 'text-gray-700'}`}>Expediciones de Jiro</span>
                      <span className="ml-auto bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
                        {activeExpeditions.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {activeExpeditions.slice(0, 4).map((exp: any) => (
                        <div
                          key={exp.id}
                          onClick={() => navigate(`/jiro-expedition/${exp.id}`)}
                          className={`flex items-center gap-2 text-sm cursor-pointer rounded-lg p-2 -mx-2 transition-colors ${hasTheme && isThemeDark ? 'text-white/80 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                          <span className="text-lg">{(() => { const icon = exp.questionBank?.icon; if (!icon) return '🗺️'; const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u; return emojiRegex.test(icon) ? icon : '📘'; })()}</span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{exp.name}</p>
                            <p className={`text-xs ${hasTheme && isThemeDark ? 'text-white/40' : 'text-gray-400'}`}>
                              {exp.studentProgress?.status === 'IN_PROGRESS'
                                ? `${exp.studentProgress.completedStations}/${exp.totalStations || '?'} estaciones`
                                : 'Sin empezar'}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-40" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ===== EXPLORAR ===== */}
        <div>
          <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${hasTheme && isThemeDark ? 'text-white/50' : 'text-gray-400'}`}>
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
                onClick={() => setActiveView('shop')}
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
                onClick={() => setActiveView('badges')}
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
                onClick={() => setActiveView('avatar-shop')}
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
