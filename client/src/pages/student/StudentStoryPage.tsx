import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { BookOpen, CheckCircle2, Film, Lock, MessageSquare, PartyPopper, Play, Sparkles, Trophy } from 'lucide-react';
import { useCurrentStudentProfile } from '../../hooks/useCurrentStudentProfile';
import { storyApi, type StoryRewardPreview, type StudentChapterInfo, type StudentSceneSummary } from '../../lib/storyApi';
import { STORY_UPDATED_EVENT, type StoryUpdateEvent } from '../../hooks/useStoryLive';
import { FactionStandings } from '../../components/storytelling/ChapterRewards';
import { accentGradient, type StoryAccent } from '../../lib/storyTheme';
import { useStoryParticles } from '../../hooks/useStoryParticles';
import { StoryPlayer } from '../../components/story/StoryPlayer';
import { buildAutoplayItems, coverItem, recapItem, sceneItem, type PlayerItem } from '../../components/story/storyPlayerHelpers';

const HERO_FALLBACK = 'linear-gradient(135deg, #4338ca, #6d28d9)';
const SCENE_LABEL: Record<StudentSceneSummary['type'], string> = {
  INTRO: 'Introducción',
  DESARROLLO: 'Desarrollo',
  MILESTONE: 'Hito',
  OUTRO: 'Final',
  DECISION: 'Decisión',
};
const MEDALS = ['🥇', '🥈', '🥉', '4.º', '5.º'];

interface PlayerState {
  items: PlayerItem[];
  label: string;
}

export const StudentStoryPage = () => {
  const { storyAccent } = useOutletContext<{ storyAccent?: StoryAccent | null }>();
  const queryClient = useQueryClient();
  const [particles, setParticles] = useStoryParticles('student');
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [autoplayDismissed, setAutoplayDismissed] = useState(false);
  const [loadingChapter, setLoadingChapter] = useState<string | null>(null);

  const { profile: currentProfile } = useCurrentStudentProfile();

  const { data: story, isLoading } = useQuery({
    queryKey: ['student-story', currentProfile?.classroomId, currentProfile?.id],
    queryFn: () => storyApi.getStudentStoryData(currentProfile!.classroomId),
    enabled: !!currentProfile?.classroomId && !!currentProfile?.id,
  });

  const accent = storyAccent ?? null;

  // Final revelado en vivo por el profe: se vuelve a reproducir lo nuevo (cierre y resumen).
  useEffect(() => {
    const onUpdate = (event: Event) => {
      const kind = (event as CustomEvent<StoryUpdateEvent>).detail?.kind;
      if (kind === 'revealed' || kind === 'decided') setAutoplayDismissed(false);
    };
    window.addEventListener(STORY_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(STORY_UPDATED_EVENT, onUpdate);
  }, []);
  const autoplay = useMemo(() => (story && !autoplayDismissed ? buildAutoplayItems(story) : []), [story, autoplayDismissed]);
  const shown = player ?? (autoplay.length > 0 ? { items: autoplay, label: `Historia: ${story?.title ?? ''}` } : null);

  const closePlayer = () => {
    setPlayer(null);
    setAutoplayDismissed(true);
    queryClient.invalidateQueries({ queryKey: ['student-story'] });
  };

  const markSeen = (sceneId: string) => {
    void storyApi.markSceneViewed(sceneId).catch(() => undefined);
  };

  // Voto en una decisión: se guarda en el servidor y se refleja en la lista.
  const vote = async (sceneId: string, optionId: string) => {
    const decision = await storyApi.voteDecision(sceneId, optionId);
    queryClient.invalidateQueries({ queryKey: ['student-story'] });
    return decision.myVote;
  };

  // Repetición individual: una escena o el capítulo entero (portada, escenas desbloqueadas y, si terminó, el cierre).
  const playScene = async (sceneId: string) => {
    try {
      const scene = await storyApi.getSceneForViewing(sceneId);
      setPlayer({ items: [sceneItem(scene)], label: 'Escena de la historia' });
    } catch {
      // Si la escena dejó de estar disponible, la lista se refresca.
      queryClient.invalidateQueries({ queryKey: ['student-story'] });
    }
  };

  const playChapter = async (chapter: StudentChapterInfo) => {
    setLoadingChapter(chapter.id);
    try {
      const scenes = await storyApi.getChapterScenesForStudent(chapter.id);
      setPlayer({
        items: [
          coverItem(chapter, chapter.position, story?.title),
          ...scenes.map((scene) => sceneItem(scene, chapter.position)),
          ...(chapter.status === 'COMPLETED' ? [recapItem(chapter.id)] : []),
        ],
        label: `Capítulo ${chapter.position}: ${chapter.title}`,
      });
    } finally {
      setLoadingChapter(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><span className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" aria-label="Cargando historia" /></div>;
  }

  if (!story) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 p-10 text-center dark:border-gray-700 dark:bg-gray-800/70">
          <BookOpen className="mx-auto h-12 w-12 text-primary-700 dark:text-primary-300" aria-hidden="true" />
          <h1 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">Aún no hay una historia en curso</h1>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Cuando tu profe empiece una aventura, la verás aquí.</p>
        </div>
      </div>
    );
  }

  const completed = story.chapters.filter((c) => c.status === 'COMPLETED').length;
  const active = story.chapters.find((c) => c.status === 'ACTIVE') ?? null;
  const total = story.chapters.length;

  return (
    <div className="w-full space-y-6 px-4 py-6">
      {/* Portada de la historia */}
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-clip rounded-2xl p-6 text-white shadow-xl" style={{ background: accent ? accentGradient(accent) : HERO_FALLBACK }}>
        <span className="pointer-events-none absolute -right-4 -top-8 select-none text-[8rem] leading-none opacity-15" aria-hidden="true">{accent?.emoji ?? '📖'}</span>
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-widest text-white">Historia de la clase</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">{story.title}</h1>
          {story.description && <p className="mt-1 max-w-2xl text-white">{story.description}</p>}
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed} aria-label="Capítulos completados">
              <motion.div initial={{ width: 0 }} animate={{ width: `${total ? (completed / total) * 100 : 0}%` }} transition={{ duration: 1, delay: 0.2 }} className="h-full rounded-full bg-white" />
            </div>
            <span className="text-sm font-semibold">{completed}/{total} capítulos</span>
          </div>
          <label className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-black/25 px-3 text-sm font-semibold">
            <input type="checkbox" role="switch" checked={particles} onChange={(e) => setParticles(e.target.checked)} className="h-4 w-4 accent-white" />
            Partículas del tema
          </label>
        </div>
      </motion.header>

      {/* Capítulo en curso */}
      {active && (
        <ActiveChapterCard chapter={active} accent={accent} reward={story.rewardPreview} loading={loadingChapter === active.id} onPlay={() => playChapter(active)} />
      )}

      {/* Línea de tiempo */}
      <section aria-labelledby="chapters-title">
        <h2 id="chapters-title" className="mb-3 text-lg font-bold text-gray-900 dark:text-white">Capítulos</h2>
        <ol className="relative space-y-4">
          <span className="absolute bottom-6 left-5 top-6 w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
          {story.chapters.map((chapter, index) => (
            <ChapterNode
              key={chapter.id}
              chapter={chapter}
              index={index}
              accent={accent}
              loading={loadingChapter === chapter.id}
              onPlayChapter={() => playChapter(chapter)}
              onPlayScene={playScene}
            />
          ))}
        </ol>
      </section>

      <AnimatePresence>
        {shown && (
          <StoryPlayer key={shown.label} items={shown.items} accent={accent} label={shown.label} onSceneSeen={markSeen} onVote={vote} onClose={closePlayer} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------- Capítulo en curso ----------

const ActiveChapterCard = ({ chapter, accent, reward, loading, onPlay }: { chapter: StudentChapterInfo; accent: StoryAccent | null; reward: StoryRewardPreview | null; loading: boolean; onPlay: () => void }) => {
  const gifts = reward ? [
    reward.badge ? `${reward.badge.icon} ${reward.badge.name}` : null,
    reward.xp ? `+${reward.xp} XP` : null,
    reward.gp ? `+${reward.gp} de oro` : null,
    reward.card ? `🃏 ${reward.card.name}` : null,
  ].filter(Boolean) : [];
  const target = chapter.completionConfig?.targetXp ?? 0;
  const percent = target > 0 ? Math.min(100, (chapter.currentProgress / target) * 100) : 0;
  const { data: board } = useQuery({
    queryKey: ['chapter-leaderboard', chapter.id],
    queryFn: () => storyApi.getChapterLeaderboard(chapter.id),
    enabled: chapter.completionType !== 'BIMESTER',
    staleTime: 60_000,
  });

  return (
    <section aria-labelledby="active-chapter" className={`rounded-2xl border-2 bg-white p-5 shadow-md dark:bg-gray-800 ${chapter.goalReached ? 'story-ready-glow border-amber-400' : 'border-primary-200 dark:border-primary-800'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">Capítulo {chapter.position} · en curso</p>
          <h2 id="active-chapter" className="text-xl font-black text-gray-900 dark:text-white">{chapter.title}</h2>
          {chapter.description && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{chapter.description}</p>}
        </div>
        {chapter.scenesCount > 0 && (
          <button type="button" onClick={onPlay} disabled={loading} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-60" style={{ background: accent ? accentGradient(accent) : HERO_FALLBACK }}>
            <Play size={16} aria-hidden="true" /> Ver el capítulo
          </button>
        )}
      </div>

      {chapter.goalReached ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-4 dark:bg-amber-900/25">
          <PartyPopper size={28} className="flex-shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
          <div>
            <p className="font-bold text-amber-950 dark:text-amber-50">¡Lo lograron!</p>
            <p className="text-sm text-amber-900 dark:text-amber-100">Tu profe revelará el final del capítulo en clase. ¡Atentos!</p>
          </div>
        </div>
      ) : target > 0 ? (
        <div className="mt-4">
          <div className="h-4 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-label="Avance de la clase">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(percent, 2)}%` }} transition={{ duration: 1.1, ease: 'easeOut' }} className="relative h-full overflow-hidden rounded-full" style={{ background: accent ? accentGradient(accent, 90) : HERO_FALLBACK }}>
              <span className="story-shine absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent" aria-hidden="true" />
            </motion.div>
          </div>
          <p className="mt-2 text-sm text-gray-800 dark:text-gray-100">
            <strong>{Math.round(chapter.currentProgress).toLocaleString('es')}</strong> de {target.toLocaleString('es')} XP · {Math.round(percent)} %
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {chapter.completionType === 'DONATION'
              ? `Cada vez que ganas XP, el ${chapter.completionConfig?.donationPercent ?? 10} % se suma a la meta (sin perderlo).`
              : 'Cuenta el XP que gana toda la clase desde que empezó el capítulo.'}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">Este capítulo termina al cerrar el bimestre. ¡Sigue participando!</p>
      )}

      {gifts.length > 0 && (
        <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-900/25">
          <p className="text-sm font-bold text-violet-950 dark:text-violet-50">🎁 Al revelar el final, quienes aporten XP ganan:</p>
          <p className="mt-1 text-sm text-violet-900 dark:text-violet-100">{gifts.join(' · ')}</p>
          {reward?.clanPrize.mode === 'GP' && (
            <p className="mt-1 text-sm text-violet-900 dark:text-violet-100">Y el clan que más aporte: +{reward.clanPrize.gp ?? 0} de oro para cada miembro.</p>
          )}
        </div>
      )}

      <div className="mt-4"><FactionStandings chapterId={chapter.id} /></div>

      {board && board.leaderboard.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white"><Trophy size={16} className="text-amber-600 dark:text-amber-300" aria-hidden="true" /> Héroes del capítulo</p>
          <ol className="mt-2 flex flex-wrap gap-2">
            {board.leaderboard.map((hero, i) => (
              <li key={hero.studentId} className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-900 dark:bg-gray-700 dark:text-white">
                <span aria-hidden="true">{MEDALS[i] ?? `${i + 1}.º`}</span>
                <span className="font-semibold">{hero.displayName}</span>
                <span className="text-gray-700 dark:text-gray-300">{Math.round(hero.xp ?? hero.donated ?? 0)} XP</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
};

// ---------- Capítulo en la línea de tiempo ----------

const ChapterNode = ({ chapter, index, accent, loading, onPlayChapter, onPlayScene }: {
  chapter: StudentChapterInfo;
  index: number;
  accent: StoryAccent | null;
  loading: boolean;
  onPlayChapter: () => void;
  onPlayScene: (sceneId: string) => void;
}) => {
  const locked = chapter.status === 'LOCKED';
  const done = chapter.status === 'COMPLETED';
  const node = done
    ? <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white"><CheckCircle2 size={20} aria-hidden="true" /></span>
    : locked
      ? <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"><Lock size={16} aria-hidden="true" /></span>
      : <span className="flex h-10 w-10 items-center justify-center rounded-full font-black text-white shadow-lg" style={{ background: accent ? accentGradient(accent) : HERO_FALLBACK }}>{chapter.position}</span>;

  return (
    <motion.li initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(index, 6) * 0.05 }} className="relative pl-14">
      <span className="absolute left-0 top-3">{node}</span>
      <div className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-gray-800 ${locked ? 'border-dashed border-gray-300 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700'}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Capítulo {chapter.position} · {done ? 'Completado' : locked ? 'Próximamente' : 'En curso'}
            </p>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">{chapter.title}</h3>
            {done && chapter.completedAt && (
              <p className="text-sm text-gray-700 dark:text-gray-300">Terminado el {new Date(chapter.completedAt).toLocaleDateString('es')}</p>
            )}
          </div>
          {!locked && chapter.scenesCount > 0 && (
            <button type="button" onClick={onPlayChapter} disabled={loading} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700">
              <Play size={16} aria-hidden="true" /> {done ? 'Volver a ver' : 'Ver todo'}
            </button>
          )}
        </div>

        {!locked && chapter.scenes.length > 0 && (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label={`Escenas de «${chapter.title}»`}>
            {chapter.scenes.map((scene) => (
              <li key={scene.id}>
                <button type="button" onClick={() => onPlayScene(scene.id)} className="flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:bg-gray-700">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-100">
                    {scene.type === 'MILESTONE' ? <Sparkles size={16} aria-hidden="true" /> : scene.hasMedia ? <Film size={16} aria-hidden="true" /> : <MessageSquare size={16} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">{SCENE_LABEL[scene.type]}</span>
                    <span className="block text-xs text-gray-700 dark:text-gray-300">{scene.dialogueCount} {scene.dialogueCount === 1 ? 'diálogo' : 'diálogos'}</span>
                  </span>
                  {scene.decisionStatus === 'OPEN' && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">Vota</span>}
                  {scene.decisionStatus === 'CLOSED' && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-900 dark:bg-gray-700 dark:text-gray-100">Decidido</span>}
                  {!scene.viewed && <span className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-bold text-amber-950">Nueva</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!locked && chapter.lockedScenes > 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <Lock size={14} aria-hidden="true" /> {chapter.lockedScenes} {chapter.lockedScenes === 1 ? 'escena secreta' : 'escenas secretas'} por descubrir
          </p>
        )}
      </div>
    </motion.li>
  );
};

export default StudentStoryPage;
