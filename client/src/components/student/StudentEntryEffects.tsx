import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { studentApi } from '../../lib/studentApi';
import { shopApi } from '../../lib/shopApi';
import { storyApi } from '../../lib/storyApi';
import { StoryPlayer } from '../story/StoryPlayer';
import { buildAutoplayItems } from '../story/storyPlayerHelpers';
import { STORY_UPDATED_EVENT, type StoryUpdateEvent } from '../../hooks/useStoryLive';
import type { StoryAccent } from '../../lib/storyTheme';
import { useCelebrationStore } from '../../store/celebrationStore';
import { useStudentStore } from '../../store/studentStore';
import { LoginStreakWidget } from './LoginStreakWidget';

type MyClass = Awaited<ReturnType<typeof studentApi.getMyClasses>>[number];
type NewBadge = Awaited<ReturnType<typeof studentApi.getCelebrations>>['badges'][number];

// Por qué la ganó, en la misma voz que «Mis insignias».
const badgeReason = (badge: NewBadge): string | null => {
  const reason = badge.reason?.trim() ?? '';
  if (reason.startsWith('Historia:')) return `Por la historia «${reason.replace(/^Historia:\s*/, '') || 'de tu clase'}»`;
  if (!badge.fromTeacher && reason.startsWith('Álbum completado:')) {
    return `Por completar el álbum «${reason.replace(/^Álbum completado:\s*/, '') || 'de cromos'}»`;
  }
  if (badge.fromTeacher) return reason ? `Te la dio tu profe: «${reason}»` : 'Te la dio tu profe';
  return badge.description?.trim() || null;
};

/**
 * Lo que le pasa al alumno al entrar, en cualquier pantalla de su clase: primero las escenas nuevas
 * de la historia, después una celebración (subidas de nivel e insignias) y el registro del día de
 * racha. Antes solo ocurría si abría "Mi Clase". Se monta con key = perfil: al cambiar de clase empieza de cero.
 */
export const StudentEntryEffects = ({ profile, storyAccent }: { profile: MyClass; storyAccent: StoryAccent | null }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ===== Historia: escenas nuevas, una vez al entrar (hasta que el alumno cierra) =====
  const [storyDismissed, setStoryDismissed] = useState(false);
  const { data: storyData, isPending: storyLoading } = useQuery({
    queryKey: ['student-story', profile.classroomId, profile.id],
    queryFn: () => storyApi.getStudentStoryData(profile.classroomId),
  });

  // Final revelado en vivo: vuelve a reproducir lo nuevo aunque ya se hubiera cerrado la historia.
  useEffect(() => {
    const onUpdate = (event: Event) => {
      const kind = (event as CustomEvent<StoryUpdateEvent>).detail?.kind;
      if (kind === 'revealed' || kind === 'decided') setStoryDismissed(false);
    };
    window.addEventListener(STORY_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(STORY_UPDATED_EVENT, onUpdate);
  }, []);

  const storyItems = useMemo(
    () => (storyData && !storyDismissed ? buildAutoplayItems(storyData) : []),
    [storyData, storyDismissed],
  );
  // La historia va primero: mientras carga no se muestra nada más (si no, la racha o la celebración
  // salían debajo del reproductor, con su sonido y confeti escondidos).
  const storyFirst = storyLoading || storyItems.length > 0;

  // ===== Celebraciones desde la última visita (subidas de nivel e insignias) =====
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => shopApi.getNotifications(),
  });
  const { data: pendingCelebration, isError: celebrationsFailed } = useQuery({
    queryKey: ['student-celebrations', profile.id],
    queryFn: () => studentApi.getCelebrations(profile.id),
    staleTime: 60_000,
  });
  const celebrate = useCelebrationStore((s) => s.celebrate);
  const celebrationOpen = useCelebrationStore((s) => s.current !== null);
  const setEntrySettled = useStudentStore((s) => s.setEntrySettled);
  const shownUntil = useRef<string | null>(null);
  // Orden al entrar, una cosa a la vez: historia → premio del día de racha → celebración.
  const [streakSettled, setStreakSettled] = useState(false);

  // Si llega una notificación de nivel o insignia, se vuelven a pedir las celebraciones.
  const unreadRewards = notifications
    .filter((n: { type: string; isRead: boolean }) => !n.isRead && (n.type === 'LEVEL_UP' || n.type === 'BADGE'))
    .map((n: { id: string }) => n.id)
    .join(',');
  useEffect(() => {
    if (!unreadRewards) return;
    // El servidor corta un segundo atrás (ver celebration.service): se espera un poco para incluirla.
    const timer = setTimeout(() => queryClient.invalidateQueries({ queryKey: ['student-celebrations', profile.id] }), 2500);
    return () => clearTimeout(timer);
  }, [unreadRewards, profile.id, queryClient]);

  // Una sola celebración personal, después de la historia; se marca como vista al mostrarse.
  useEffect(() => {
    if (!pendingCelebration || storyFirst || !streakSettled) return;
    if (shownUntil.current === pendingCelebration.until) return;
    shownUntil.current = pendingCelebration.until;
    const { fromLevel, toLevel, badges: newBadges, until } = pendingCelebration;
    const hasLevels = fromLevel !== null && toLevel !== null;
    if (!hasLevels && newBadges.length === 0) return;
    // El sistema de niveles de la clase: el nivel N empieza en xpPerLevel·N(N−1)/2.
    const step = (profile.classroom as { xpPerLevel?: number } | undefined)?.xpPerLevel || 100;
    const progress = hasLevels
      ? ((profile.xp - (step * toLevel * (toLevel - 1)) / 2) / (step * toLevel)) * 100
      : undefined;
    celebrate({
      audience: 'personal',
      levelUps: hasLevels ? [{ key: profile.id, name: '', from: fromLevel, to: toLevel }] : [],
      badges: newBadges.map((b) => ({
        key: b.id, name: b.name, icon: b.icon, customImage: b.customImage, rarity: b.rarity, recipients: [], reason: badgeReason(b),
      })),
      progress: progress === undefined ? undefined : Math.max(0, Math.min(100, progress)),
      action: newBadges.length > 0 ? { label: 'Ver mis insignias', run: () => navigate('/my-badges') } : undefined,
    });
    void studentApi.markCelebrationsSeen(profile.id, until).catch(() => undefined);
  }, [pendingCelebration, profile, storyFirst, streakSettled, celebrate, navigate]);

  // Nada abierto ni por abrir. Va después del efecto anterior: si en este mismo paso se lanzó la
  // celebración, el estado del store ya la tiene.
  useEffect(() => {
    const celebrationsChecked = pendingCelebration !== undefined || celebrationsFailed;
    setEntrySettled(!storyFirst && streakSettled && celebrationsChecked && !useCelebrationStore.getState().current);
  }, [storyFirst, streakSettled, pendingCelebration, celebrationsFailed, celebrationOpen, setEntrySettled]);
  useEffect(() => () => setEntrySettled(false), [setEntrySettled]);

  return (
    <>
      {/* Día de racha: se registra al entrar a cualquier pantalla (si la clase la tiene activa); el premio se muestra después de la historia. */}
      <LoginStreakWidget
        classroomId={profile.classroomId}
        variant="recorder"
        paused={storyFirst}
        onSettledChange={setStreakSettled}
      />

      {/* Novela visual: escenas nuevas de la historia (portada al empezar capítulo, cierre al terminarlo) */}
      <AnimatePresence>
        {storyItems.length > 0 && (
          <StoryPlayer
            items={storyItems}
            accent={storyAccent}
            label={storyData?.title ? `Historia: ${storyData.title}` : 'Historia de la clase'}
            onSceneSeen={(sceneId) => { void storyApi.markSceneViewed(sceneId).catch(() => undefined); }}
            onVote={async (sceneId, optionId) => (await storyApi.voteDecision(sceneId, optionId)).myVote}
            onClose={() => {
              setStoryDismissed(true);
              queryClient.invalidateQueries({ queryKey: ['student-story'] });
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};
