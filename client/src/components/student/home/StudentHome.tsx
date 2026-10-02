import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useStudentStore } from '../../../store/studentStore';
import { studentApi } from '../../../lib/studentApi';
import { avatarApi } from '../../../lib/avatarApi';
import { badgeApi } from '../../../lib/badgeApi';
import { classNoteApi } from '../../../lib/classNoteApi';
import { clanApi } from '../../../lib/clanApi';
import { correoApi, correoKeys } from '../../../lib/correoApi';
import { expeditionApi } from '../../../lib/expeditionApi';
import { jiroExpeditionApi } from '../../../lib/jiroExpeditionApi';
import { recoveryApi } from '../../../lib/recoveryApi';
import { shopApi } from '../../../lib/shopApi';
import { accentGradient, type StoryAccent } from '../../../lib/storyTheme';
import { useCharacterClasses } from '../../../hooks/useCharacterClasses';
import { isInitialLevel, isYoungLevel } from '../../energy/energyHelpers';
import { levelProgress } from '../../students/profile/profileHelpers';
import type { EquippedItem } from '../../avatar/AvatarRenderer';
import { useStreakStatus } from '../loginStreak';
import { StudentHero } from './StudentHero';
import { WhatsNewCard } from './WhatsNewCard';
import { TodoCard } from './TodoCard';
import { FirstStepsCard } from './FirstStepsCard';
import { ClanCard } from './ClanCard';
import { AccessTiles } from './AccessTiles';
import { CorreoModal, EnergyModal, RolePickerModal, StreakModal } from './HomeModals';
import { nextGoal, todoItems, type HomeInput } from './nextGoal';
import type { HomeModalKind } from './HomeActionButton';
import { homeCard, localDateKey } from './studentHomeHelpers';
import { myBadgesKey, progressText } from '../badges/badgeStudentHelpers';

type MyClass = Awaited<ReturnType<typeof studentApi.getMyClasses>>[number];
// my-classes trae la configuración de la clase completa; aquí se usa solo esto.
type HomeClassroom = MyClass['classroom'] & {
  xpPerLevel?: number;
  maxHp?: number;
  gradeLevel?: string | null;
  shopEnabled?: boolean;
  classAssignmentMode?: string;
};

interface StudentHomeProps {
  profile: MyClass;
  firstName: string;
  storyAccent: StoryAccent | null;
}

/**
 * Inicio de la clase del alumno: saludo, su personaje con "Tu próxima meta", lo nuevo desde su
 * última visita, lo que tiene para hacer, su clan y los accesos con contenido.
 */
export const StudentHome = ({ profile, firstName, storyAccent }: StudentHomeProps) => {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const entrySettled = useStudentStore((s) => s.entrySettled);
  const [modal, setModal] = useState<HomeModalKind | 'streak' | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const { id, classroomId } = profile;
  const classroom = profile.classroom as HomeClassroom;
  const today = localDateKey();
  const resting = profile.hp <= 0;
  const initial = isInitialLevel(classroom.gradeLevel);

  const { classMap, classes: roles } = useCharacterClasses(classroomId);
  const roleInfo = classMap[profile.characterClassId ?? ''] || classMap[profile.characterClass];
  const canChooseRole = classroom.classAssignmentMode === 'STUDENT_CHOICE';

  const { data: equipped = [] } = useQuery({ queryKey: ['avatar-equipped', id], queryFn: () => avatarApi.getEquippedItems(id) });
  // Foto de "Lo nuevo" para toda la sesión: al marcarla como vista no se vacía mientras el alumno la mira.
  const { data: news } = useQuery({ queryKey: ['student-news', id], queryFn: () => studentApi.getNews(id), staleTime: Infinity, gcTime: Infinity });
  const { data: notes = [] } = useQuery({ queryKey: ['class-notes', classroomId], queryFn: () => classNoteApi.list(classroomId) });
  const { data: energy } = useQuery({ queryKey: ['my-energy', id], queryFn: () => recoveryApi.mine(id), enabled: resting, staleTime: 30_000 });
  const { data: correo } = useQuery({ queryKey: correoKeys.mine(id), queryFn: () => correoApi.mine(id), staleTime: 30_000 });
  const { data: jiro = [] } = useQuery({ queryKey: ['jiro-available-expeditions', id], queryFn: () => jiroExpeditionApi.getAvailable(id) });
  const { data: classic = [] } = useQuery({ queryKey: ['student-expeditions', classroomId, id], queryFn: () => expeditionApi.getStudentExpeditions(classroomId, id) });
  // La misma vista que «Mis insignias»: mismo criterio de «te falta poco» y mismo conteo.
  const { data: badgeView } = useQuery({
    queryKey: myBadgesKey(id),
    queryFn: () => badgeApi.getStudentView(id),
    enabled: (profile.badgeSummary?.available ?? 0) > 0 || (profile.badgeSummary?.owned ?? 0) > 0,
  });
  const { data: shopItems = [] } = useQuery({ queryKey: ['shop-items', classroomId], queryFn: () => shopApi.getItems(classroomId), enabled: !!classroom.shopEnabled });
  const { data: avatarShop = [] } = useQuery({
    queryKey: ['avatar-shop', classroomId, profile.avatarGender],
    queryFn: () => avatarApi.getClassroomShopItems(classroomId, profile.avatarGender),
  });
  const { data: clan } = useQuery({ queryKey: ['my-clan-info', id], queryFn: () => clanApi.getStudentClanInfo(id), enabled: !!classroom.clansEnabled });
  const { data: streak } = useStreakStatus(classroomId);

  const xpPerLevel = classroom.xpPerLevel || 100;
  const progress = levelProgress(profile.xp, profile.level, xpPerLevel);
  const remaining = Math.max(progress.needed - progress.inLevel, 0);
  const prizes = shopItems.filter((item) => item.isActive !== false && (item.stock === null || item.stock > 0));
  const avatarItems = avatarShop.filter((item) => item.isAvailable).length;
  const current = correo?.current;
  const correoItem = current && (!current.sent || current.sent.status === 'REJECTED')
    ? { prompt: current.prompt, rejected: current.sent?.status === 'REJECTED' }
    : null;
  const letters = (correo?.received ?? []).filter((letter) => !news?.since || letter.createdAt > news.since).length;
  const roleName = roleInfo?.name ?? 'Sin rol';

  // Cálculo barato: se rehace en cada render (sin memo que pueda quedar desfasado).
  const input: HomeInput = {
    today,
    resting,
    initial,
    mission: energy?.mission?.text ?? null,
    notes,
    jiro,
    classic,
    correo: correoItem,
    role: {
      needsChoice: canChooseRole && !profile.characterClassId,
      current: roleName,
      others: roles.filter((role) => role.isActive && role.name !== roleName).map((role) => role.name),
    },
    badgeNear: badgeView?.near ? { id: badgeView.near.id, name: badgeView.near.name, progress: progressText(badgeView.near.progress) } : null,
    shop: { enabled: !!classroom.shopEnabled && !resting, items: prizes, goalItemId: profile.shopGoalItemId ?? null },
    gold: profile.gp,
    level: { level: profile.level, remaining },
  };
  const goal = nextGoal(input);
  const todo = todoItems(input, goal.key);

  // Al cerrarse lo que se abre al entrar, el foco vuelve al saludo (si no está en otro sitio).
  const wasSettled = useRef(entrySettled);
  useEffect(() => {
    if (entrySettled && !wasSettled.current && (!document.activeElement || document.activeElement === document.body)) {
      titleRef.current?.focus({ preventScroll: true });
    }
    wasSettled.current = entrySettled;
  }, [entrySettled]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const date = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const equippedForRenderer: EquippedItem[] = equipped.map((item) => ({ slot: item.slot, imagePath: item.avatarItem.imagePath, layerOrder: item.avatarItem.layerOrder }));

  return (
    <div className="space-y-5">
      {/* Saludo */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm"
            style={{ background: storyAccent ? accentGradient(storyAccent) : 'linear-gradient(135deg, #4338ca, #6d28d9)' }}
            aria-hidden="true"
          >
            {storyAccent?.emoji ?? '📚'}
          </span>
          <div className="min-w-0">
            <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-black text-gray-900 outline-none dark:text-white sm:text-3xl">¡Hola, {firstName}!</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {classroom.name} · {date.charAt(0).toUpperCase() + date.slice(1)}
            </p>
          </div>
        </div>
        {/* Computadoras compartidas: si no es su cuenta, sale de inmediato */}
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
        >
          <LogOut size={16} aria-hidden="true" />
          ¿No eres {firstName}? Salir
        </button>
      </header>

      <StudentHero
        classroomId={classroomId}
        gender={profile.avatarGender || 'MALE'}
        equipped={equippedForRenderer}
        role={{ name: roleName, icon: roleInfo?.icon ?? null }}
        level={profile.level}
        xp={{ inLevel: progress.inLevel, needed: progress.needed, percent: progress.percent, remaining }}
        hp={profile.hp}
        maxHp={classroom.maxHp || 100}
        gold={profile.gp}
        young={isYoungLevel(classroom.gradeLevel)}
        streak={streak}
        goal={goal}
        glow={storyAccent?.primary ?? '#6366f1'}
        storyTitle={storyAccent?.title ?? null}
        canDress={avatarItems > 0}
        canChangeRole={canChooseRole && roles.length > 1 && !!profile.characterClassId}
        onOpen={setModal}
      />

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="space-y-5">
          <FirstStepsCard
            role={canChooseRole && !profile.characterClassId && goal.key !== 'role'}
            dress={avatarItems > 0 && equipped.length === 0}
            firstXp={news ? !news.everEarned : false}
            onOpen={setModal}
          />
          {news ? (
            <WhatsNewCard profileId={id} news={news} resting={resting} letters={letters} onOpen={setModal} />
          ) : (
            <div className={`${homeCard} h-40 motion-safe:animate-pulse`} aria-hidden="true" />
          )}
        </div>
        <div className="space-y-5">
          <TodoCard
            items={todo}
            hasNotes={notes.some((note) => note.dueDate)}
            goalIsTask={goal.key.startsWith('note:')}
            hasBadges={(profile.badgeSummary?.available ?? 0) > 0 || (profile.badgeSummary?.owned ?? 0) > 0}
            onOpen={setModal}
          />
          {clan?.clan && <ClanCard info={clan} />}
        </div>
      </div>

      <AccessTiles
        shop={{
          // Igual que el menú: hay qué comprar o algo tuyo que ver o usar.
          visible: (!!classroom.shopEnabled && prizes.length > 0) || (profile.shopSummary?.owned ?? 0) > 0,
          enabled: !!classroom.shopEnabled,
          paused: resting && !initial,
          prices: prizes.map((item) => item.price),
          gold: profile.gp,
          owned: profile.shopSummary?.owned ?? 0,
        }}
        badges={{
          // Igual que el menú: la clase tiene insignias que se pueden ganar o el alumno tiene alguna.
          visible: (profile.badgeSummary?.available ?? 0) > 0 || (profile.badgeSummary?.owned ?? 0) > 0,
          count: badgeView?.earned.length ?? profile.badgeSummary?.owned ?? 0,
          toEarn: badgeView?.toEarn.length ?? 0,
          near: badgeView?.near?.name ?? null,
        }}
        avatar={avatarItems > 0}
        scrolls={!!classroom.scrollsEnabled && !!classroom.scrollsOpen}
      />

      <AnimatePresence>
        {modal === 'role' && (
          <RolePickerModal classroomId={classroomId} currentId={profile.characterClassId ?? null} roles={roles} onClose={() => setModal(null)} />
        )}
        {modal === 'correo' && <CorreoModal profileId={id} onClose={() => setModal(null)} />}
        {modal === 'energy' && <EnergyModal initial={initial} onClose={() => setModal(null)} />}
        {modal === 'streak' && <StreakModal classroomId={classroomId} onClose={() => setModal(null)} />}
      </AnimatePresence>
    </div>
  );
};
