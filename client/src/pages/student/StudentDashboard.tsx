import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { 
  ShoppingBag,
  Plus,
  Users,
  Zap,
  Shirt,
  Medal,
  ChevronRight,
  ClipboardList,
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
import { badgeApi } from '../../lib/badgeApi';
import { RestingBanner } from '../../components/energy/RestingBanner';
import { StudentCorreoCard } from '../../components/observatorio/correo/StudentCorreoCard';
import { LoginStreakWidget } from '../../components/student/LoginStreakWidget';
import { accentGradient, type StoryAccent } from '../../lib/storyTheme';
import { classNoteApi } from '../../lib/classNoteApi';
import { clanApi, CLAN_EMBLEMS } from '../../lib/clanApi';
import { HomeModal } from '../../components/home/HomeModal';
import { cancelButton } from '../../components/home/homeHelpers';
import { levelProgress } from '../../components/students/profile/profileHelpers';

export const StudentDashboard = () => {
  const { user, logout } = useAuthStore();
  const { selectedClassIndex } = useStudentStore();
  const navigate = useNavigate();
  const { storyTheme, isThemeDark, storyAccent } = useOutletContext<{ storyTheme?: any; isThemeDark?: boolean; hasStoryTheme?: boolean; storyAccent?: StoryAccent | null }>();
  const hasTheme = !!storyTheme;
  
  const [showClassPicker, setShowClassPicker] = useState(false);
  const queryClient = useQueryClient();
  

  const { data: myClasses, isLoading } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
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

  // La historia, las celebraciones y la racha ocurren al entrar en cualquier pantalla: StudentEntryEffects.

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
          <Users className="w-16 h-16 mx-auto text-indigo-500 mb-4" aria-hidden="true" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            ¡Hola, {user?.firstName}!
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Aún no estás en ninguna clase. Pídele el código a tu profe para empezar tu aventura.
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

  // Progreso con el sistema de niveles de la clase (nivel N pide N × xpPorNivel), el mismo que ve el docente.
  const xpPerLevel = (currentProfile.classroom as { xpPerLevel?: number } | undefined)?.xpPerLevel || 100;
  const { inLevel: xpInLevel, needed: xpNeeded, percent: xpProgress } = levelProgress(currentProfile.xp, currentProfile.level, xpPerLevel);
  const xpRemaining = Math.max(xpNeeded - xpInLevel, 0);
  const studentDisplayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
    || currentProfile.displayName
    || currentProfile.characterName
    || 'Estudiante';
  const studentClassLabel = characterInfo?.name || 'Sin personaje';
  const pendingClassNotesCount = classNotes.filter((note) => !note.isCompleted).length;
  const sectionTitle = `text-sm font-semibold uppercase tracking-wider mb-3 ${hasTheme && isThemeDark ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`;

  return (
    <div className={`relative min-h-screen -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 ${hasTheme ? '' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-gray-950'}`}>
      {/* Decorative elements */}
      {!hasTheme && (
        <div aria-hidden="true">
          <div className="absolute top-20 right-10 w-64 h-64 bg-blue-200 dark:bg-blue-950 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-30 motion-safe:animate-pulse" />
          <div className="absolute top-40 left-10 w-64 h-64 bg-purple-200 dark:bg-violet-950 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-30 motion-safe:animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
      )}

      <div className="relative z-10">
        {currentProfile.hp <= 0 && <RestingBanner profileId={currentProfile.id} />}
        <StudentCorreoCard profileId={currentProfile.id} />
        {/* Layout de 2 columnas: Avatar + Contenido */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Columna izquierda - Avatar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:w-[280px] flex-shrink-0"
          >
            <div className={`backdrop-blur-lg rounded-2xl p-6 shadow-lg lg:sticky lg:top-20 ${hasTheme && isThemeDark ? 'bg-white/10 border border-white/10 shadow-black/20' : hasTheme ? 'bg-white/70 border border-white/40 shadow-black/5' : 'bg-white/80 shadow-blue-500/10 border border-white/50 dark:bg-gray-900/85 dark:border-gray-800 dark:shadow-black/20'}`}>
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
                <h1 className={`text-2xl font-bold ${hasTheme && isThemeDark ? 'text-white' : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-blue-300 dark:via-indigo-300 dark:to-purple-300'}`}
                  style={hasTheme && isThemeDark ? undefined : hasTheme ? { color: storyTheme.colors?.primary } : undefined}
                >
                  {currentProfile.characterName || user?.firstName}
                </h1>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-lg" aria-hidden="true">{characterInfo?.icon || '👤'}</span>
                  <p className={`text-sm ${hasTheme && isThemeDark ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>
                    {studentClassLabel} • Nivel {currentProfile.level}
                  </p>
                </div>
              </div>

              {/* Barra de XP (XP en azul, como en la vista del docente) */}
              <div className="mt-4">
                <div className={`flex justify-between text-xs mb-1 ${hasTheme && isThemeDark ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                    Nivel {currentProfile.level}
                  </span>
                  <span>{xpInLevel} / {xpNeeded} XP</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`Nivel ${currentProfile.level}`}
                  aria-valuemin={0}
                  aria-valuemax={xpNeeded}
                  aria-valuenow={xpInLevel}
                  className={`h-2.5 rounded-full overflow-hidden ${hasTheme && isThemeDark ? 'bg-white/15' : 'bg-gray-100 dark:bg-gray-800'}`}
                >
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: xpProgress / 100 }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full w-full origin-left bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                  />
                </div>
                <p className={`text-xs mt-1 ${hasTheme && isThemeDark ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>
                  Faltan <span className="font-semibold">{xpRemaining.toLocaleString()}</span> XP
                </p>
              </div>
            </div>
          </motion.div>

          {/* Columna derecha - Contenido */}
          <div className="min-w-0 flex-1 space-y-5">
        {/* ===== BANNER COMPACTO ===== */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-4 shadow-lg ${storyAccent ? 'shadow-black/20' : 'bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 shadow-purple-500/20'}`}
          style={storyAccent ? { background: accentGradient(storyAccent) } : undefined}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="w-10 h-10 shrink-0 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <span className="text-xl" aria-hidden="true">{storyAccent?.emoji ?? '📚'}</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-white font-bold text-lg leading-tight">
                  {currentProfile.classroom?.name || 'Mi Clase'}
                </h2>
                <div className="flex flex-wrap items-center gap-x-2 text-sm text-white">
                  <span>¡Hola, {user?.firstName || currentProfile.characterName}!</span>
                  {/* Computadoras compartidas: si no es su cuenta, sale de inmediato */}
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="-ml-1 inline-flex min-h-[44px] items-center rounded-lg px-1 font-semibold text-white underline underline-offset-2 hover:bg-white/15"
                  >
                    ¿No eres {user?.firstName || 'tú'}? Salir
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Contador de notas pendientes */}
              {pendingClassNotesCount > 0 && (
                <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur rounded-lg px-3 py-1.5 text-white">
                  <ClipboardList className="w-4 h-4" aria-hidden="true" />
                  <span className="font-bold text-sm">{pendingClassNotesCount}</span>
                  <span className="text-xs">{pendingClassNotesCount === 1 ? 'pendiente' : 'pendientes'}</span>
                </div>
              )}
              <div className="text-right">
                <p className="text-white text-xs">Código de la clase</p>
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
          <h3 className={sectionTitle}>
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
            <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/25 blur-xl" aria-hidden="true" />
            <div className="absolute -bottom-14 left-16 h-28 w-28 rounded-full bg-white/20 blur-2xl" aria-hidden="true" />

            {/* Sin ranking: el alumno ve su propio progreso, no un puesto frente a sus compañeros. */}
            <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
              <div className="min-w-0 lg:w-[230px]">
                <h4 className={`truncate text-lg md:text-xl font-bold leading-tight ${hasTheme && isThemeDark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {studentDisplayName}
                </h4>
                <p className={`mt-1 truncate text-sm font-medium ${hasTheme && isThemeDark ? 'text-white/80' : 'text-slate-700 dark:text-gray-300'}`}>
                  {characterInfo?.icon ? `${characterInfo.icon} ` : ''}{studentClassLabel}
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
                        className={`inline-flex min-h-[44px] items-center rounded-full px-3 text-xs font-semibold transition-colors ${
                          hasTheme && isThemeDark
                            ? 'bg-white/10 text-white hover:bg-white/15'
                            : 'bg-white/80 text-sky-800 hover:bg-white dark:bg-gray-800 dark:text-sky-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {characterInfo ? 'Cambiar personaje' : 'Elegir personaje'}
                      </button>
                    )}
                  </div>
                  <span className={`text-sm font-medium ${hasTheme && isThemeDark ? 'text-white/85' : 'text-slate-700 dark:text-gray-300'}`}>
                    {xpInLevel.toLocaleString()}/{xpNeeded.toLocaleString()} XP
                  </span>
                </div>

                <div
                  role="progressbar"
                  aria-label={`Nivel ${currentProfile.level}`}
                  aria-valuemin={0}
                  aria-valuemax={xpNeeded}
                  aria-valuenow={xpInLevel}
                  className={`h-3 overflow-hidden rounded-full ${hasTheme && isThemeDark ? 'bg-white/15' : 'bg-white/70 dark:bg-gray-800/80'}`}
                >
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: xpProgress / 100 }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full w-full origin-left rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"
                  />
                </div>

                <p className={`mt-2 text-xs ${hasTheme && isThemeDark ? 'text-white/80' : 'text-slate-700 dark:text-gray-300'}`}>
                  Faltan <span className="font-semibold">{xpRemaining.toLocaleString()}</span> XP para el siguiente nivel
                </p>
              </div>
            </div>
          </motion.div>

          {/* Elegir el tipo de personaje (Guardián, Arcano…), si la clase lo permite */}
          {showClassPicker && canChooseClass && (
            <HomeModal
              title="Elige tu personaje"
              subtitle="Cada tipo de personaje tiene su estilo"
              onClose={() => setShowClassPicker(false)}
              footer={<button type="button" onClick={() => setShowClassPicker(false)} className={cancelButton}>Cancelar</button>}
            >
              <div className="grid grid-cols-2 gap-3">
                {characterClasses.filter((c) => c.isActive).map((cc) => (
                  <button
                    key={cc.id}
                    type="button"
                    onClick={() => chooseClassMutation.mutate(cc.id)}
                    disabled={chooseClassMutation.isPending}
                    aria-pressed={currentProfile.characterClassId === cc.id}
                    className={`p-4 rounded-xl border-2 text-left transition-colors ${
                      currentProfile.characterClassId === cc.id
                        ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/30'
                        : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500'
                    }`}
                  >
                    <span className="text-3xl block mb-2" aria-hidden="true">{cc.icon}</span>
                    <p className="font-semibold text-gray-900 dark:text-white">{cc.name}</p>
                    {cc.description && (
                      <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 line-clamp-2">{cc.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </HomeModal>
          )}
        </div>

        {/* ===== MI CLAN ===== */}
        {myClanInfo && myClanInfo.clan && (
          <div>
            <h3 className={sectionTitle}>
              Mi Clan
            </h3>
            <Link
              to="/my-clan"
              className={`block rounded-xl p-4 transition-all hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${hasTheme && isThemeDark ? 'bg-white/10 border border-white/10 hover:bg-white/15' : 'bg-white/80 backdrop-blur border border-white/50 shadow-sm hover:shadow-lg dark:bg-gray-900/85 dark:border-gray-800 dark:shadow-black/20 dark:hover:bg-gray-900'}`}
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
                    <p className={`text-xs italic mt-0.5 ${hasTheme && isThemeDark ? 'text-white/80' : 'text-gray-600 dark:text-gray-300'}`}>
                      "{myClanInfo.clan.motto}"
                    </p>
                  )}
                  <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs ${hasTheme && isThemeDark ? 'text-white/85' : 'text-gray-700 dark:text-gray-300'}`}>
                    <span className="flex items-center gap-1"><span aria-hidden="true">⚡</span> {myClanInfo.clan.totalXp.toLocaleString()} XP</span>
                    <span className="flex items-center gap-1"><span aria-hidden="true">🏆</span> {myClanInfo.clan.wins} ganadas · {myClanInfo.clan.losses} perdidas</span>
                    <span className="flex items-center gap-1"><span aria-hidden="true">👥</span> {myClanInfo.members.length} {myClanInfo.members.length === 1 ? 'miembro' : 'miembros'}</span>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 flex-shrink-0 ${hasTheme && isThemeDark ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`} aria-hidden="true" />
              </div>
            </Link>
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
          <h3 className={sectionTitle}>
            Explorar
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Tienda de ítems */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-orange-700 to-amber-800 rounded-xl p-4 text-white shadow-lg"
            >
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="w-5 h-5" aria-hidden="true" />
                <h3 className="font-bold text-sm">Tienda de ítems</h3>
              </div>
              <p className="text-white mb-3 text-xs">Usa tu oro en premios de la clase</p>
              <button
                type="button"
                onClick={() => navigate('/my-shop')}
                className="w-full min-h-[44px] bg-white text-amber-900 rounded-lg text-sm font-bold hover:bg-amber-50 transition-colors"
              >
                Ver la tienda
              </button>
            </motion.div>

            {/* Mis insignias */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl p-4 text-white shadow-lg"
            >
              <div className="flex items-center gap-2 mb-3">
                <Medal className="w-5 h-5" aria-hidden="true" />
                <h3 className="font-bold text-sm">Mis insignias</h3>
                {studentBadges.length > 0 && (
                  <span className="ml-auto bg-black/25 text-xs font-bold px-2 py-0.5 rounded-full">
                    {studentBadges.length}
                  </span>
                )}
              </div>
              <p className="text-white mb-3 text-xs">
                {studentBadges.length > 0
                  ? `${studentBadges.length} ${studentBadges.length === 1 ? 'insignia ganada' : 'insignias ganadas'}`
                  : 'Gana insignias en clase'}
              </p>
              <button
                type="button"
                onClick={() => navigate('/my-badges')}
                className="w-full min-h-[44px] bg-white text-indigo-800 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1"
              >
                Ver insignias
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </motion.div>

            {/* Personalizar avatar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-fuchsia-700 to-purple-700 rounded-xl p-4 text-white shadow-lg"
            >
              <div className="flex items-center gap-2 mb-3">
                <Shirt className="w-5 h-5" aria-hidden="true" />
                <h3 className="font-bold text-sm">Personalizar avatar</h3>
              </div>
              <p className="text-white mb-3 text-xs">Viste a tu personaje</p>
              <button
                type="button"
                onClick={() => navigate('/my-avatar')}
                className="w-full min-h-[44px] bg-white text-purple-800 rounded-lg text-sm font-bold hover:bg-purple-50 transition-colors"
              >
                Ver atuendos
              </button>
            </motion.div>
          </div>
        </div>
          </div>
        </div>
      </div>

    </div>
  );
};
