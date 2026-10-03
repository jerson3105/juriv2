import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CLAN_EMBLEMS } from '../../lib/clanApi';
import { AnimatePresence } from 'framer-motion';
import { BookOpen, Loader2, Palette, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { storyApi, type Story, type StoryChapter, type StoryScene, type ThemeConfig } from '../../lib/storyApi';
import type { Classroom } from '../../lib/classroomApi';
import { deriveStoryAccent, accentGradient, type StoryAccent } from '../../lib/storyTheme';
import { StoryPlayer } from '../../components/story/StoryPlayer';
import { coverItem, recapItem, sceneItem, type PlayerItem } from '../../components/story/storyPlayerHelpers';
import { StoryListPanel } from '../../components/storytelling/StoryListPanel';
import { StoryDetail } from '../../components/storytelling/StoryDetail';
import { ChapterFormModal, StoryFormModal } from '../../components/storytelling/StoryForms';
import { SceneEditorModal, type SceneDraft } from '../../components/storytelling/SceneEditorModal';
import { StoryConfirmModal } from '../../components/storytelling/StoryConfirmModal';
import { ThemePanel } from '../../components/storytelling/ThemePanel';
import { DecisionResultsModal } from '../../components/storytelling/DecisionResultsModal';
import { AiCoauthorModal } from '../../components/storytelling/AiCoauthorModal';
import { showUndoToast } from '../../components/storytelling/undoToast';
import { chapterProgress, chapterReward, classroomKey, errorMessage, plural, storiesKey, storyDetailKey } from '../../components/storytelling/storyEditorHelpers';

type Modal =
  | { kind: 'story-form'; story?: Story }
  | { kind: 'story-delete'; story: Story }
  | { kind: 'chapter-form'; chapter?: StoryChapter; position: number }
  | { kind: 'chapter-delete'; chapter: StoryChapter; position: number }
  | { kind: 'scene-form'; chapter: StoryChapter; scene?: StoryScene }
  | { kind: 'scene-delete'; chapter: StoryChapter; scene: StoryScene }
  | { kind: 'reveal'; chapter: StoryChapter; position: number }
  | { kind: 'theme' }
  | { kind: 'decision'; sceneId: string }
  | { kind: 'ai' };

interface PlayerState {
  items: PlayerItem[];
  projector: boolean;
  label: string;
}

export const StorytellingPage = () => {
  const { classroom, storyAccent } = useOutletContext<{ classroom: Classroom; storyAccent: StoryAccent | null }>();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false);
  const [modal, setModal] = useState<Modal | null>(null);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: stories = [], isLoading } = useQuery({
    queryKey: storiesKey(classroom.id),
    queryFn: () => storyApi.getClassroomStories(classroom.id),
  });
  const { data: presets = [] } = useQuery({
    queryKey: ['theme-presets'],
    queryFn: () => storyApi.getPresets(),
    staleTime: Infinity,
  });

  // La historia en curso primero; si no, la más reciente.
  const ordered = useMemo(() => [...stories].sort((a, b) => Number(b.isActive) - Number(a.isActive)), [stories]);
  const selected = ordered.find((s) => s.id === selectedId) ?? ordered[0] ?? null;

  const { data: story } = useQuery({
    queryKey: storyDetailKey(selected?.id ?? ''),
    queryFn: () => storyApi.getStory(selected!.id),
    enabled: !!selected,
  });
  const detail = story && story.id === selected?.id ? story : null;
  // Portada: el tema propio de la historia. Reproductor: ese tema o, si no tiene, el del aula (lo que ven los alumnos).
  const storyOwnAccent = useMemo(() => deriveStoryAccent(detail?.themeConfig), [detail?.themeConfig]);
  const accent = storyOwnAccent ?? storyAccent;
  const activeStory = ordered.find((s) => s.isActive) ?? null;

  const refresh = (storyId?: string) => Promise.all([
    queryClient.invalidateQueries({ queryKey: storiesKey(classroom.id) }),
    storyId ? queryClient.invalidateQueries({ queryKey: storyDetailKey(storyId) }) : null,
  ]);
  const refreshClassroom = () => queryClient.invalidateQueries({ queryKey: classroomKey(classroom.id) });

  // Ejecuta una acción con su estado de carga y un mensaje de error legible.
  const run = async (key: string, action: () => Promise<void>, failure: string) => {
    if (busy) return;
    setBusy(key);
    try {
      await action();
    } catch (e) {
      toast.error(errorMessage(e, failure));
    } finally {
      setBusy(null);
    }
  };

  // ---------- Historias ----------

  const saveStory = (data: { title: string; description?: string; themeConfig?: ThemeConfig | null }) => {
    const editing = modal?.kind === 'story-form' ? modal.story : undefined;
    return run('story-form', async () => {
      if (editing) {
        await storyApi.updateStory(editing.id, { ...data, description: data.description ?? '' });
        await refresh(editing.id);
        if (editing.isActive) await refreshClassroom();
        toast.success('Historia actualizada');
      } else {
        const created = await storyApi.createStory(classroom.id, { ...data, themeConfig: data.themeConfig ?? undefined });
        await refresh();
        setSelectedId(created.id);
        setShowDetailOnMobile(true);
        toast.success('Historia creada: añade su primer capítulo');
      }
      setModal(null);
    }, 'No se pudo guardar la historia');
  };

  const deleteStory = (target: Story) => run('story-delete', async () => {
    await storyApi.deleteStory(target.id);
    setModal(null);
    setSelectedId(null);
    setShowDetailOnMobile(false);
    await refresh();
    if (target.isActive) await refreshClassroom();
    toast.success(`Historia «${target.title}» eliminada`);
  }, 'No se pudo eliminar la historia');

  const toggleActive = (target: Story) => run('toggle', async () => {
    const previousActive = ordered.find((s) => s.isActive && s.id !== target.id) ?? null;
    const previousTheme = classroom.themeConfig as ThemeConfig | null;
    const previousSource = classroom.themeSource || 'DEFAULT';
    const after = async () => { await refresh(target.id); await refreshClassroom(); };

    if (target.isActive) {
      await storyApi.deactivateStory(target.id, classroom.id);
      await after();
      showUndoToast(`«${target.title}» en pausa: los alumnos ya no la ven`, () => storyApi.activateStory(target.id, classroom.id), () => void after());
    } else {
      await storyApi.activateStory(target.id, classroom.id);
      await after();
      showUndoToast(`«${target.title}» activada para la clase`, async () => {
        if (previousActive) {
          await storyApi.activateStory(previousActive.id, classroom.id);
        } else {
          await storyApi.deactivateStory(target.id, classroom.id);
          if (previousTheme) await storyApi.updateClassroomTheme(classroom.id, previousTheme, previousSource);
        }
      }, () => void after());
    }
  }, 'No se pudo cambiar el estado de la historia');

  // ---------- Capítulos ----------

  const saveChapter = (data: Parameters<typeof storyApi.updateChapter>[1] & { title: string }) => {
    if (!detail || modal?.kind !== 'chapter-form') return;
    const editing = modal.chapter;
    return run('chapter-form', async () => {
      if (editing) await storyApi.updateChapter(editing.id, data);
      else await storyApi.createChapter(detail.id, { ...data, completionType: data.completionType ?? 'XP_GOAL' });
      await refresh(detail.id);
      setModal(null);
      toast.success(editing ? 'Capítulo actualizado' : 'Capítulo creado');
    }, 'No se pudo guardar el capítulo');
  };

  const deleteChapter = (chapter: StoryChapter) => detail && run('chapter-delete', async () => {
    await storyApi.deleteChapter(chapter.id);
    await refresh(detail.id);
    setModal(null);
    toast.success(`Capítulo «${chapter.title}» eliminado`);
  }, 'No se pudo eliminar el capítulo');

  const moveChapter = (chapter: StoryChapter, delta: -1 | 1) => detail && run('move', async () => {
    const ids = detail.chapters.map((c) => c.id);
    const from = ids.indexOf(chapter.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    await storyApi.reorderChapters(detail.id, ids);
    await refresh(detail.id);
  }, 'No se pudo mover el capítulo');

  const presentChapter = (chapter: StoryChapter) => {
    if (!detail) return;
    const position = detail.chapters.findIndex((c) => c.id === chapter.id) + 1;
    const done = chapter.status === 'COMPLETED';
    const scenes = chapter.scenes.filter((s) => done || s.type !== 'OUTRO');
    setPlayer({
      items: [coverItem(chapter, position, detail.title), ...scenes.map((s) => sceneItem(s, position)), ...(done ? [recapItem(chapter.id)] : [])],
      projector: true,
      label: `Presentación del capítulo ${position}`,
    });
  };

  const reveal = (chapter: StoryChapter, present: boolean) => detail && run('reveal', async () => {
    const position = detail.chapters.findIndex((c) => c.id === chapter.id) + 1;
    await storyApi.completeChapter(chapter.id);
    queryClient.removeQueries({ queryKey: ['story-recap', chapter.id] });
    await refresh(detail.id);
    setModal(null);
    if (present) {
      const outro = chapter.scenes.filter((s) => s.type === 'OUTRO');
      setPlayer({ items: [...outro.map((s) => sceneItem(s, position)), recapItem(chapter.id)], projector: true, label: `Final del capítulo ${position}` });
    } else {
      toast.success(`Final de «${chapter.title}» revelado`);
    }
  }, 'No se pudo revelar el final');

  // ---------- Escenas ----------

  const saveScene = (draft: SceneDraft) => {
    if (!detail || modal?.kind !== 'scene-form') return;
    const { chapter, scene } = modal;
    return run('scene-form', async () => {
      if (scene) {
        await storyApi.updateScene(scene.id, {
          type: draft.type,
          mediaType: draft.mediaType,
          mediaUrl: draft.mediaUrl,
          triggerConfig: draft.triggerConfig,
          // Decisión: se envía si lo es; si dejó de serlo, se borra.
          decision: draft.type === 'DECISION' ? draft.decision : scene.type === 'DECISION' ? null : undefined,
        });
        await storyApi.setDialogues(scene.id, draft.dialogues);
      } else {
        await storyApi.createScene(chapter.id, {
          type: draft.type,
          mediaType: draft.mediaType ?? undefined,
          mediaUrl: draft.mediaUrl ?? undefined,
          triggerConfig: draft.triggerConfig ?? undefined,
          dialogues: draft.dialogues,
          decision: draft.decision ?? undefined,
        });
      }
      await refresh(detail.id);
      setModal(null);
      toast.success(scene ? 'Escena guardada' : 'Escena creada');
    }, 'No se pudo guardar la escena');
  };

  const deleteScene = (scene: StoryScene) => detail && run('scene-delete', async () => {
    await storyApi.deleteScene(scene.id);
    await refresh(detail.id);
    setModal(null);
    toast.success('Escena eliminada');
  }, 'No se pudo eliminar la escena');

  const nextChapterOf = (chapter: StoryChapter) => {
    if (!detail) return null;
    return detail.chapters.find((c) => c.status === 'LOCKED' && c.id !== chapter.id) ?? null;
  };

  // ---------- Vista ----------

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-md" style={{ background: storyAccent ? accentGradient(storyAccent) : 'linear-gradient(135deg, #4338ca, #6d28d9)' }} aria-hidden="true">
            <BookOpen size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Historia de clase</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">Una aventura por capítulos: la clase avanza con su XP y tú revelas cada final.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setModal({ kind: 'theme' })} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
            <Palette size={16} aria-hidden="true" /> Tema del aula
          </button>
          <button type="button" onClick={() => setModal({ kind: 'story-form' })} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white hover:bg-primary-700">
            <Plus size={16} aria-hidden="true" /> Nueva historia
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary-600" aria-label="Cargando historias" /></div>
      ) : ordered.length === 0 ? (
        <EmptyState onCreate={() => setModal({ kind: 'story-form' })} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className={showDetailOnMobile ? 'hidden lg:block' : ''}>
            <StoryListPanel
              stories={ordered}
              selectedId={selected?.id ?? null}
              onSelect={(id) => { setSelectedId(id); setShowDetailOnMobile(true); }}
              onCreate={() => setModal({ kind: 'story-form' })}
            />
          </div>
          <div className={showDetailOnMobile ? '' : 'hidden lg:block'}>
            {detail ? (
              <StoryDetail
                key={detail.id}
                story={detail}
                accent={storyOwnAccent}
                toggling={busy === 'toggle'}
                moving={busy === 'move'}
                onBack={() => setShowDetailOnMobile(false)}
                onEditStory={() => setModal({ kind: 'story-form', story: detail })}
                onDeleteStory={() => setModal({ kind: 'story-delete', story: detail })}
                onAiCoauthor={() => setModal({ kind: 'ai' })}
                onToggleActive={() => toggleActive(detail)}
                onAddChapter={() => setModal({ kind: 'chapter-form', position: detail.chapters.length + 1 })}
                onEditChapter={(chapter) => setModal({ kind: 'chapter-form', chapter, position: detail.chapters.indexOf(chapter) + 1 })}
                onDeleteChapter={(chapter) => setModal({ kind: 'chapter-delete', chapter, position: detail.chapters.indexOf(chapter) + 1 })}
                onMoveChapter={moveChapter}
                onReveal={(chapter) => setModal({ kind: 'reveal', chapter, position: detail.chapters.indexOf(chapter) + 1 })}
                onPresentChapter={presentChapter}
                onAddScene={(chapter) => setModal({ kind: 'scene-form', chapter })}
                onEditScene={(chapter, scene) => setModal({ kind: 'scene-form', chapter, scene })}
                onDeleteScene={(chapter, scene) => setModal({ kind: 'scene-delete', chapter, scene })}
                onPreviewScene={(_, scene) => setPlayer({ items: [sceneItem(scene)], projector: false, label: 'Vista previa de la escena' })}
                onDecisionResults={(scene) => setModal({ kind: 'decision', sceneId: scene.id })}
              />
            ) : (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary-600" aria-label="Cargando historia" /></div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {modal?.kind === 'story-form' && (
          <StoryFormModal key="story-form" story={modal.story} presets={presets} saving={busy === 'story-form'} onSubmit={saveStory} onClose={() => setModal(null)} />
        )}
        {modal?.kind === 'story-delete' && (
          <StoryConfirmModal key="story-delete" title="Eliminar historia" confirmLabel="Eliminar para siempre" typeToConfirm={modal.story.title} busy={busy === 'story-delete'} onConfirm={() => deleteStory(modal.story)} onClose={() => setModal(null)}>
            <p>Se borran sus {plural(modal.story.chapters.length, 'capítulo', 'capítulos')}, escenas y lo que los alumnos ya vieron. No se puede deshacer.</p>
            {modal.story.isActive && <p className="font-semibold">Está en curso: la clase volverá a su tema normal.</p>}
          </StoryConfirmModal>
        )}
        {modal?.kind === 'chapter-form' && (
          <ChapterFormModal key="chapter-form" chapter={modal.chapter} position={modal.position} classroomId={classroom.id} clansEnabled={!!classroom.clansEnabled} saving={busy === 'chapter-form'} onSubmit={saveChapter} onClose={() => setModal(null)} />
        )}
        {modal?.kind === 'chapter-delete' && (
          <StoryConfirmModal key="chapter-delete" title={`Eliminar el capítulo ${modal.position}`} confirmLabel="Eliminar capítulo" busy={busy === 'chapter-delete'} onConfirm={() => deleteChapter(modal.chapter)} onClose={() => setModal(null)}>
            <p>«{modal.chapter.title}» y sus {plural(modal.chapter.scenes.length, 'escena', 'escenas')} se borran. No se puede deshacer.</p>
            {modal.chapter.status === 'ACTIVE' && <p className="font-semibold">Está en curso: el siguiente capítulo empezará en su lugar.</p>}
          </StoryConfirmModal>
        )}
        {modal?.kind === 'scene-form' && detail && (
          <SceneEditorModal key="scene-form" scene={modal.scene} chapterTitle={modal.chapter.title} storyContext={`${detail.title}${detail.description ? `: ${detail.description}` : ''}`} accent={accent} saving={busy === 'scene-form'} onSave={saveScene} onClose={() => setModal(null)} />
        )}
        {modal?.kind === 'scene-delete' && (
          <StoryConfirmModal key="scene-delete" title="Eliminar escena" confirmLabel="Eliminar escena" busy={busy === 'scene-delete'} onConfirm={() => deleteScene(modal.scene)} onClose={() => setModal(null)}>
            <p>La escena de «{modal.chapter.title}» y sus diálogos se borran. No se puede deshacer.</p>
          </StoryConfirmModal>
        )}
        {modal?.kind === 'reveal' && (
          <RevealModal
            key="reveal"
            chapter={modal.chapter}
            position={modal.position}
            next={nextChapterOf(modal.chapter)}
            busy={busy === 'reveal'}
            onPresent={() => reveal(modal.chapter, true)}
            onRevealOnly={() => reveal(modal.chapter, false)}
            onClose={() => setModal(null)}
          />
        )}
        {modal?.kind === 'ai' && detail && (
          <AiCoauthorModal key="ai" story={detail} onClose={() => setModal(null)} onApplied={() => refresh(detail.id)} />
        )}
        {modal?.kind === 'decision' && detail && (
          <DecisionResultsModal key="decision" sceneId={modal.sceneId} storyId={detail.id} onClose={() => setModal(null)} />
        )}
        {modal?.kind === 'theme' && (
          <ThemePanel key="theme" classroom={classroom} presets={presets} activeStoryTitle={activeStory?.title ?? null} onClose={() => setModal(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {player && (
          <StoryPlayer key={player.label} items={player.items} accent={accent} projector={player.projector} liveVotes={player.projector} label={player.label} onClose={() => setPlayer(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------- Revelar el final ----------

const RevealModal = ({ chapter, position, next, busy, onPresent, onRevealOnly, onClose }: {
  chapter: StoryChapter;
  position: number;
  next: StoryChapter | null;
  busy: boolean;
  onPresent: () => void;
  onRevealOnly: () => void;
  onClose: () => void;
}) => {
  const progress = chapterProgress(chapter);
  const outros = chapter.scenes.filter((s) => s.type === 'OUTRO').length;
  const reward = chapterReward(chapter);
  const { data: factions } = useQuery({
    queryKey: ['chapter-factions', chapter.id],
    queryFn: () => storyApi.getChapterFactions(chapter.id),
  });
  const leader = factions?.clans.find((c) => c.xp > 0);
  const gifts = [
    reward?.badgeId ? 'una insignia' : null,
    reward?.xp ? `${reward.xp} XP` : null,
    reward?.gp ? `${reward.gp} de oro` : null,
    reward?.cardId ? 'una figurita' : null,
  ].filter(Boolean);
  return (
    <StoryConfirmModal
      title={`Revelar el final del capítulo ${position}`}
      confirmLabel="Revelar y presentar"
      tone="primary"
      busy={busy}
      secondary={{ label: 'Solo revelar', onClick: onRevealOnly }}
      onConfirm={onPresent}
      onClose={onClose}
    >
      <p>«{chapter.title}» termina ahora: los alumnos podrán ver {outros > 0 ? plural(outros, 'escena de cierre', 'escenas de cierre') : 'el resumen del capítulo'} y {next ? <>empezará «{next.title}»</> : 'la historia llegará a su final'}.</p>
      {!chapter.goalReachedAt && progress.target > 0 && (
        <p className="font-semibold text-amber-900 dark:text-amber-200">La meta aún no se alcanzó ({Math.round(progress.percent)} %). Puedes revelarlo igualmente.</p>
      )}
      {gifts.length > 0 && (
        <p>
          Recompensa: {gifts.length > 1 ? `${gifts.slice(0, -1).join(', ')} y ${gifts[gifts.length - 1]}` : gifts[0]} para {factions ? plural(factions.participants, 'alumno que aportó', 'alumnos que aportaron') : 'quienes aportaron'} XP en el capítulo.
        </p>
      )}
      {leader && reward?.clanPrize?.mode !== 'NONE' && (
        <p>
          Clan que más aportó: <strong>{CLAN_EMBLEMS[leader.emblem] || '🛡️'} {leader.name}</strong> ({leader.xp} XP)
          {reward?.clanPrize?.mode === 'GP' ? ` — cada miembro recibe ${reward.clanPrize.gp ?? 0} de oro.` : '.'}
        </p>
      )}
      {outros === 0 && <p>Consejo: añade una escena de cierre para que el final tenga su momento.</p>}
      <p>«Revelar y presentar» lo muestra en pantalla completa para el proyector. No se puede deshacer.</p>
    </StoryConfirmModal>
  );
};

// ---------- Sin historias ----------

const STEPS = [
  { emoji: '📖', title: 'Crea la historia', text: 'Una premisa y, si quieres, un tema que tiñe el aula.' },
  { emoji: '🎯', title: 'Divide en capítulos', text: 'Cada uno con su meta: XP de la clase, donaciones o el bimestre.' },
  { emoji: '🎬', title: 'Escribe las escenas', text: 'Intro, hitos y un final secreto que revelas en el proyector.' },
];

const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-10">
    <p className="text-5xl" aria-hidden="true">🗺️</p>
    <h2 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">Convierte el año en una aventura</h2>
    <p className="mx-auto mt-1 max-w-lg text-sm text-gray-700 dark:text-gray-300">Tu clase avanza la historia con el XP que gana. Tú decides cuándo se revela cada final.</p>
    <ol className="mx-auto mt-6 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
      {STEPS.map((step, i) => (
        <li key={step.title} className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
          <p className="text-2xl" aria-hidden="true">{step.emoji}</p>
          <p className="mt-1 font-bold text-gray-900 dark:text-white">{i + 1}. {step.title}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{step.text}</p>
        </li>
      ))}
    </ol>
    <button type="button" onClick={onCreate} className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-primary-600 px-6 text-sm font-bold text-white hover:bg-primary-700">
      <Plus size={16} aria-hidden="true" /> Crear la primera historia
    </button>
  </div>
);

export default StorytellingPage;
