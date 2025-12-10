import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Heart, 
  Coins, 
  TrendingUp, 
  Swords,
  ShoppingBag,
  Plus,
  Users,
  ArrowLeft,
  Zap,
  Shirt,
  Medal,
  ChevronRight,
  Target,
  BarChart3
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { AvatarRenderer } from '../../components/avatar/AvatarRenderer';
import { AvatarShop } from '../../components/avatar/AvatarShop';
import { useAuthStore } from '../../store/authStore';
import { useStudentStore } from '../../store/studentStore';
import { studentApi, CHARACTER_CLASSES } from '../../lib/studentApi';
import { avatarApi } from '../../lib/avatarApi';
import { shopApi } from '../../lib/shopApi';
import { StudentShopPage } from './StudentShopPage';
import { StudentBattleView } from '../../components/student/StudentBattleView';
import { StudentProgressView } from '../../components/student/StudentProgressView';
import { ClanRankingView } from '../../components/student/ClanRankingView';
import { battleApi } from '../../lib/battleApi';
import { badgeApi, type Badge, RARITY_COLORS, RARITY_LABELS } from '../../lib/badgeApi';
import { BadgeUnlockModal } from '../../components/badges/BadgeUnlockModal';
import { LevelUpAnimation } from '../../components/effects/LevelUpAnimation';
import { LoginStreakWidget } from '../../components/student/LoginStreakWidget';
import { InitialSetupModal } from '../../components/student/InitialSetupModal';

export const StudentDashboard = () => {
  const { user } = useAuthStore();
  const { selectedClassIndex } = useStudentStore();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<'dashboard' | 'shop' | 'avatar-shop' | 'battle' | 'badges' | 'progress' | 'clan-ranking'>('dashboard');
  const [activeBattleId, setActiveBattleId] = useState<string | null>(null);
  
  // Estado para animación de subida de nivel
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(1);
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
  
  // Batallas activas para este estudiante (sistema antiguo)
  const { data: activeBattles = [] } = useQuery({
    queryKey: ['active-battles', currentProfile?.id],
    queryFn: () => battleApi.getActiveBattlesForStudent(currentProfile!.id),
    enabled: !!currentProfile?.id,
    staleTime: 60000, // Considerar datos frescos por 1 minuto
  });

  // Student Boss Battles disponibles (nuevo sistema)
  const { data: studentBossBattles = [] } = useQuery({
    queryKey: ['student-boss-battles-available', currentProfile?.classroomId, currentProfile?.id],
    queryFn: () => import('../../lib/studentBossBattleApi').then(m => 
      m.studentBossBattleApi.getAvailableForStudent(currentProfile!.classroomId, currentProfile!.id)
    ),
    enabled: !!currentProfile?.classroomId && !!currentProfile?.id,
    staleTime: 30000,
  });

  // Filtrar solo batallas activas donde puede participar
  const availableStudentBattles = studentBossBattles.filter(
    (b: any) => b.status === 'ACTIVE' && b.canParticipate
  );

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

  // Formatear items equipados para el renderer
  const equippedForRenderer = equippedItems.map((item: any) => ({
    slot: item.slot,
    imagePath: item.avatarItem.imagePath,
    layerOrder: item.avatarItem.layerOrder,
  }));

  const characterInfo = currentProfile 
    ? CHARACTER_CLASSES[currentProfile.characterClass]
    : null;

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

  // Vista de batalla
  if (activeView === 'battle' && activeBattleId) {
    return (
      <StudentBattleView
        bossId={activeBattleId}
        studentId={currentProfile.id}
        onBack={() => {
          setActiveView('dashboard');
          setActiveBattleId(null);
        }}
      />
    );
  }

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8">
      {/* Animación de subida de nivel */}
      <LevelUpAnimation
        show={showLevelUp}
        newLevel={newLevel}
        onComplete={() => setShowLevelUp(false)}
      />

      {/* Decorative elements */}
      <div className="absolute top-20 right-10 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
      <div className="absolute top-40 left-10 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative z-10">
        {/* Layout de 2 columnas */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Columna izquierda - Avatar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:w-[300px] flex-shrink-0"
          >
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg shadow-blue-500/10 border border-white/50 sticky top-4">
              {/* Avatar grande 255x444 */}
              <motion.div 
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="flex justify-center mb-4"
              >
                <div className="bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl p-3 shadow-lg">
                  <AvatarRenderer
                    gender={currentProfile.avatarGender || 'MALE'}
                    size="xl"
                    equippedItems={equippedForRenderer}
                  />
                </div>
              </motion.div>

              {/* Nombre y clase */}
              <div className="text-center mb-4">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {currentProfile.characterName || user?.firstName}
                </h1>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-lg">{characterInfo?.icon}</span>
                  <p className="text-gray-500 text-sm">
                    {characterInfo?.name} • Nivel {currentProfile.level}
                  </p>
                </div>
              </div>

              {/* Barra de XP */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" />
                    Nivel {currentProfile.level}
                  </span>
                  <span>{xpInLevel} / {xpNeeded} XP</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(xpProgress, 100)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Columna derecha - Stats y acciones */}
          <div className="flex-1 space-y-5">
            {/* Header con nombre de clase */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-4 shadow-lg shadow-purple-500/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                    <span className="text-2xl">📚</span>
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg">
                      {currentProfile.classroom?.name || 'Mi Clase'}
                    </h2>
                    <p className="text-white/70 text-sm">
                      ¡Bienvenido, {currentProfile.characterName || user?.firstName}!
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-xs">Código</p>
                  <p className="text-white font-mono font-bold text-lg tracking-wider">
                    {currentProfile.classroom?.code}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Stats Grid - Diseño mejorado */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* XP Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                whileHover={{ scale: 1.05, y: -4 }}
                className="relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 shadow-lg shadow-emerald-500/30 overflow-hidden group cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-4xl"
                    >
                      ⚡
                    </motion.div>
                  </div>
                  <p className="text-3xl font-bold text-white">{currentProfile.xp.toLocaleString()}</p>
                  <p className="text-sm font-medium text-white/80">Experiencia</p>
                </div>
              </motion.div>

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

              {/* Level Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileHover={{ scale: 1.05, y: -4 }}
                className="relative bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-4 shadow-lg shadow-violet-500/30 overflow-hidden group cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="text-4xl"
                    >
                      ⭐
                    </motion.div>
                  </div>
                  <p className="text-3xl font-bold text-white">{currentProfile.level}</p>
                  <p className="text-sm font-medium text-white/80">Nivel</p>
                  {/* Mini barra de progreso */}
                  <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(xpProgress, 100)}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full bg-white rounded-full"
                    />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Racha de Login - Full width */}
            {currentProfile?.classroomId && (
              <LoginStreakWidget classroomId={currentProfile.classroomId} />
            )}

            {/* Acciones rápidas */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Boss Battles - Nuevo sistema */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-gradient-to-br from-red-500 to-orange-500 rounded-xl p-4 text-white shadow-lg"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Swords className="w-5 h-5" />
                  <h3 className="font-bold text-sm">Boss Battles</h3>
                  {(availableStudentBattles.length > 0 || activeBattles.length > 0) && (
                    <span className="ml-auto bg-yellow-400 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                      {availableStudentBattles.length + activeBattles.length} ACTIVA{(availableStudentBattles.length + activeBattles.length) > 1 ? 'S' : ''}
                    </span>
                  )}
                </div>
                {availableStudentBattles.length > 0 ? (
                  <div className="space-y-2">
                    {availableStudentBattles.slice(0, 2).map((battle: any) => (
                      <button
                        key={battle.id}
                        onClick={() => navigate(`/student-battle/${currentProfile?.classroomId}/${battle.id}`)}
                        className="w-full bg-white/20 hover:bg-white/30 rounded-lg p-2 text-left transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">💀</span>
                          <div className="flex-1">
                            <p className="font-bold text-xs">{battle.bossName}</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-white rounded-full" 
                                  style={{ width: `${battle.hpPercentage}%` }} 
                                />
                              </div>
                              <span className="text-xs text-red-200">{battle.hpPercentage}%</span>
                            </div>
                          </div>
                          <Swords className="w-4 h-4 animate-pulse" />
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={() => navigate(`/student-battle/${currentProfile?.classroomId}`)}
                      className="w-full py-1.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg text-xs font-medium transition-colors"
                    >
                      Ver todas →
                    </button>
                  </div>
                ) : activeBattles.length > 0 ? (
                  <div className="space-y-2">
                    {activeBattles.slice(0, 2).map((battle) => (
                      <button
                        key={battle.id}
                        onClick={() => {
                          setActiveBattleId(battle.id);
                          setActiveView('battle');
                        }}
                        className="w-full bg-white/20 hover:bg-white/30 rounded-lg p-2 text-left transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🐉</span>
                          <div className="flex-1">
                            <p className="font-bold text-xs">{battle.bossName}</p>
                            <p className="text-xs text-red-200">{battle.currentHp}/{battle.bossHp} HP</p>
                          </div>
                          <Swords className="w-4 h-4 animate-pulse" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <p className="text-red-100 mb-3 text-xs">No hay batallas activas</p>
                    <button 
                      onClick={() => navigate(`/student-battle/${currentProfile?.classroomId}`)}
                      className="w-full py-2 bg-white/20 hover:bg-white/30 text-white/80 rounded-lg text-xs font-medium transition-colors"
                    >
                      Ver batallas
                    </button>
                  </>
                )}
              </motion.div>

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

              {/* Tienda de Avatares */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
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

              {/* Mis Insignias */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
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

              {/* Mi Progreso */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl p-4 text-white shadow-lg"
              >
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-5 h-5" />
                  <h3 className="font-bold text-sm">Mi Progreso</h3>
                </div>
                <p className="text-emerald-100 mb-3 text-xs">Estadísticas y retroalimentación</p>
                <button 
                  onClick={() => setActiveView('progress')}
                  className="w-full py-2 bg-white text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1"
                >
                  Ver progreso
                  <ChevronRight size={14} />
                </button>
              </motion.div>

              {/* Misiones */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl p-4 text-white shadow-lg"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5" />
                  <h3 className="font-bold text-sm">Misiones</h3>
                </div>
                <p className="text-indigo-100 mb-3 text-xs">Completa objetivos y gana recompensas</p>
                <button 
                  onClick={() => navigate(`/missions/${currentProfile?.classroomId}`)}
                  className="w-full py-2 bg-white text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1"
                >
                  Ver misiones
                  <ChevronRight size={14} />
                </button>
              </motion.div>

              {/* Unirse a otra clase */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
                className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white shadow-lg"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Plus className="w-5 h-5" />
                  <h3 className="font-bold text-sm">Unirse a otra clase</h3>
                </div>
                <p className="text-indigo-100 mb-3 text-xs">¿Tienes otro código de clase?</p>
                <button 
                  onClick={() => navigate('/join-class')}
                  className="w-full py-2 bg-white text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors"
                >
                  Unirme
                </button>
              </motion.div>

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

      {/* Modal de configuración inicial para estudiantes B2B */}
      {currentProfile && currentProfile.needsSetup && currentProfile.classroom?.schoolId && (
        <InitialSetupModal
          isOpen={true}
          studentId={currentProfile.id}
          displayName={currentProfile.displayName}
          onComplete={() => {
            // El modal se cerrará automáticamente cuando needsSetup sea false
          }}
        />
      )}

    </div>
  );
};
