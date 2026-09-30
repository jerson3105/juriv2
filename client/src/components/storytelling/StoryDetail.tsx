import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, ChevronDown, Edit2, Eye, Image as ImageIcon, Lock, MonitorPlay,
  Pause, Play, Plus, Sparkles, Trash2, Video, PartyPopper, Vote, Wand2,
} from 'lucide-react';
import type { Story, StoryChapter, StoryScene } from '../../lib/storyApi';
import { accentGradient, type StoryAccent } from '../../lib/storyTheme';
import { ActionMenu } from '../home/ActionMenu';
import {
  COMPLETION_TYPES, SCENE_TYPES, STATUS_LABEL, chapterProgress, plural, sceneSnippet, sceneTrigger,
} from './storyEditorHelpers';
import { ChapterRewardChips, FactionStandings } from './ChapterRewards';
import { playableDecision } from '../story/storyPlayerHelpers';

export interface StoryDetailActions {
  onBack: () => void;
  onEditStory: () => void;
  onDeleteStory: () => void;
  onAiCoauthor: () => void;
  onToggleActive: () => void;
  onAddChapter: () => void;
  onEditChapter: (chapter: StoryChapter) => void;
  onDeleteChapter: (chapter: StoryChapter) => void;
  onMoveChapter: (chapter: StoryChapter, delta: -1 | 1) => void;
  onReveal: (chapter: StoryChapter) => void;
  onPresentChapter: (chapter: StoryChapter) => void;
  onAddScene: (chapter: StoryChapter) => void;
  onEditScene: (chapter: StoryChapter, scene: StoryScene) => void;
  onDeleteScene: (chapter: StoryChapter, scene: StoryScene) => void;
  onDecisionResults: (scene: StoryScene) => void;
  onPreviewScene: (chapter: StoryChapter, scene: StoryScene) => void;
}

interface StoryDetailProps extends StoryDetailActions {
  story: Story;
  accent: StoryAccent | null;
  toggling: boolean;
  moving: boolean;
}

const HERO_FALLBACK = 'linear-gradient(135deg, #4338ca, #6d28d9)';

export const StoryDetail = (props: StoryDetailProps) => {
  const { story, accent, toggling, onBack, onEditStory, onDeleteStory, onAiCoauthor, onToggleActive, onAddChapter, onReveal, onPresentChapter } = props;
  const chapters = story.chapters;
  const active = chapters.find((c) => c.status === 'ACTIVE') ?? null;
  const completed = chapters.filter((c) => c.status === 'COMPLETED').length;
  const [open, setOpen] = useState<Set<string>>(() => new Set(active ? [active.id] : chapters.slice(0, 1).map((c) => c.id)));

  const toggle = (id: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <section aria-labelledby="story-detail-title" className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800 lg:hidden">
        <ArrowLeft size={16} aria-hidden="true" /> Historias
      </button>

      {/* Portada de la historia */}
      <motion.div
        key={story.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-clip rounded-2xl p-5 text-white shadow-lg sm:p-6"
        style={{ background: accent ? accentGradient(accent) : HERO_FALLBACK }}
      >
        <span className="pointer-events-none absolute -right-6 -top-10 select-none text-[9rem] leading-none opacity-15" aria-hidden="true">{accent?.emoji ?? '📖'}</span>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 basis-72">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${story.isActive ? 'bg-white text-gray-900' : 'bg-black/30 text-white'}`}>
                {story.isActive ? <><span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" aria-hidden="true" /> En curso para la clase</> : 'Borrador: los alumnos aún no la ven'}
              </span>
              <span className="text-sm text-white">{plural(chapters.length, 'capítulo', 'capítulos')} · {completed} completado{completed === 1 ? '' : 's'}</span>
            </div>
            <h2 id="story-detail-title" className="mt-2 text-2xl font-black leading-tight sm:text-3xl">{story.title}</h2>
            {story.description && <p className="mt-1 max-w-2xl text-sm text-white sm:text-base">{story.description}</p>}
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            <button type="button" onClick={onToggleActive} disabled={toggling} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-gray-900 hover:bg-gray-100 disabled:opacity-60">
              {story.isActive ? <><Pause size={16} aria-hidden="true" /> Pausar</> : <><Play size={16} aria-hidden="true" /> Activar</>}
            </button>
            {active && active.scenes.length > 0 && (
              <button type="button" onClick={() => onPresentChapter(active)} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-black/30 px-4 text-sm font-bold text-white hover:bg-black/40">
                <MonitorPlay size={16} aria-hidden="true" /> Presentar
              </button>
            )}
            <button type="button" onClick={onAiCoauthor} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-black/30 px-4 text-sm font-bold text-white hover:bg-black/40">
              <Wand2 size={16} aria-hidden="true" /> Coautor IA
            </button>
            <button type="button" onClick={onEditStory} className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/30 text-white hover:bg-black/40" aria-label="Editar historia">
              <Edit2 size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={onDeleteStory} className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/30 text-white hover:bg-black/40" aria-label="Eliminar historia">
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Final listo para revelar */}
      {story.isActive && active?.goalReachedAt && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="story-ready-glow flex flex-col gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-500 dark:bg-amber-900/25 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <PartyPopper size={28} className="flex-shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            <div>
              <p className="font-bold text-amber-950 dark:text-amber-50">¡La clase completó «{active.title}»!</p>
              <p className="text-sm text-amber-900 dark:text-amber-100">El final sigue en secreto hasta que lo reveles. Ideal para el proyector.</p>
            </div>
          </div>
          <button type="button" onClick={() => onReveal(active)} className="inline-flex min-h-[44px] flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-bold text-amber-950 hover:bg-amber-300">
            <Sparkles size={16} aria-hidden="true" /> Revelar el final
          </button>
        </motion.div>
      )}

      {/* Línea de tiempo */}
      {chapters.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600">
          <p className="text-lg font-bold text-gray-900 dark:text-white">Tu historia aún no tiene capítulos</p>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Cada capítulo es una etapa de la aventura con su meta y sus escenas.</p>
          <button type="button" onClick={onAddChapter} className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700">
            <Plus size={16} aria-hidden="true" /> Crear el primer capítulo
          </button>
        </div>
      ) : (
        <ol className="relative space-y-4" aria-label="Capítulos">
          <span className="absolute bottom-6 left-5 top-6 w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
          {chapters.map((chapter, index) => (
            <ChapterItem
              key={chapter.id}
              {...props}
              chapter={chapter}
              position={index + 1}
              canMoveUp={chapter.status === 'LOCKED' && chapters[index - 1]?.status === 'LOCKED'}
              canMoveDown={chapter.status === 'LOCKED' && chapters[index + 1]?.status === 'LOCKED'}
              isOpen={open.has(chapter.id)}
              onToggle={() => toggle(chapter.id)}
            />
          ))}
        </ol>
      )}

      {chapters.length > 0 && (
        <button type="button" onClick={onAddChapter} className="ml-12 inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 text-sm font-semibold text-gray-800 hover:border-primary-500 hover:text-primary-700 dark:border-gray-600 dark:text-gray-100 dark:hover:text-primary-300">
          <Plus size={16} aria-hidden="true" /> Añadir capítulo
        </button>
      )}
    </section>
  );
};

// ---------- Capítulo ----------

interface ChapterItemProps extends StoryDetailProps {
  chapter: StoryChapter;
  position: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

const ChapterItem = ({
  chapter, position, canMoveUp, canMoveDown, isOpen, onToggle, accent, story, moving,
  onEditChapter, onDeleteChapter, onMoveChapter, onReveal, onPresentChapter, onAddScene, onEditScene, onDeleteScene, onPreviewScene, onDecisionResults,
}: ChapterItemProps) => {
  const isActive = chapter.status === 'ACTIVE';
  const isDone = chapter.status === 'COMPLETED';
  const progress = chapterProgress(chapter);
  const completion = COMPLETION_TYPES[chapter.completionType];
  const panelId = `chapter-panel-${chapter.id}`;

  const node = isDone
    ? <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white"><CheckCircle2 size={20} aria-hidden="true" /></span>
    : isActive
      ? (
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full font-black text-white shadow-lg" style={{ background: accent ? accentGradient(accent) : HERO_FALLBACK }}>
          <span className="absolute inset-0 rounded-full ring-4 ring-primary-200 motion-safe:animate-pulse dark:ring-primary-900" aria-hidden="true" />
          <span className="relative">{position}</span>
        </span>
      )
      : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"><Lock size={16} aria-hidden="true" /></span>;

  const menu = [
    { label: 'Editar capítulo', icon: Edit2, onClick: () => onEditChapter(chapter) },
    ...(canMoveUp ? [{ label: 'Mover antes', icon: ArrowUp, onClick: () => onMoveChapter(chapter, -1) }] : []),
    ...(canMoveDown ? [{ label: 'Mover después', icon: ArrowDown, onClick: () => onMoveChapter(chapter, 1) }] : []),
    { label: 'Eliminar capítulo', icon: Trash2, danger: true, onClick: () => onDeleteChapter(chapter) },
  ];

  return (
    <motion.li initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(position, 6) * 0.04 }} className="relative pl-14">
      <span className="absolute left-0 top-3">{node}</span>
      <div className={`rounded-2xl border bg-white shadow-sm dark:bg-gray-800 ${isActive ? 'border-primary-300 dark:border-primary-700' : 'border-gray-200 dark:border-gray-700'}`}>
        <div className="flex items-start gap-2 p-3 sm:p-4">
          <button type="button" onClick={onToggle} aria-expanded={isOpen} aria-controls={panelId} className="flex min-h-[44px] min-w-0 flex-1 items-start gap-2 rounded-xl text-left">
            <ChevronDown size={18} className={`mt-1 flex-shrink-0 text-gray-700 transition-transform dark:text-gray-200 ${isOpen ? '' : '-rotate-90'}`} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Capítulo {position}</span>
              <span className="block truncate text-base font-bold text-gray-900 dark:text-white">{chapter.title}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isDone ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : isActive ? (chapter.goalReachedAt ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100' : 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-100') : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`}>
                  {isActive && chapter.goalReachedAt ? 'Listo para revelar' : STATUS_LABEL[chapter.status]}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-800 dark:bg-gray-700 dark:text-gray-100">
                  <span aria-hidden="true">{completion.emoji}</span> {completion.label}{progress.target ? ` · ${progress.target.toLocaleString('es')} XP` : ''}
                </span>
                <span className="text-xs text-gray-700 dark:text-gray-300">{plural(chapter.scenes.length, 'escena', 'escenas')}</span>
              </span>
            </span>
          </button>
          <ActionMenu items={menu} label={`Más acciones de «${chapter.title}»`} />
        </div>

        {isActive && progress.target > 0 && (
          <div className="px-4 pb-3">
            <div className="relative h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.percent)} aria-label={`Avance de «${chapter.title}»`}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(progress.percent, 2)}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} className="relative h-full overflow-hidden rounded-full" style={{ background: accent ? accentGradient(accent, 90) : HERO_FALLBACK }}>
                <span className="story-shine absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent" aria-hidden="true" />
              </motion.div>
            </div>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {Math.round(progress.value).toLocaleString('es')} de {progress.target.toLocaleString('es')} XP {chapter.completionType === 'DONATION' ? 'donados' : 'desde que empezó'} · {Math.round(progress.percent)} %
            </p>
          </div>
        )}
        {isActive && chapter.completionType === 'BIMESTER' && !chapter.goalReachedAt && (
          <p className="px-4 pb-3 text-sm text-gray-700 dark:text-gray-300">Quedará listo para revelar al cerrar el bimestre (o cuando tú decidas).</p>
        )}

        {isOpen && (
          <div id={panelId} className="space-y-3 border-t border-gray-100 p-3 dark:border-gray-700 sm:p-4">
            {chapter.description && <p className="text-sm italic text-gray-700 dark:text-gray-300">«{chapter.description}»</p>}
            <ChapterRewardChips chapter={chapter} />
            {isActive && <FactionStandings chapterId={chapter.id} />}

            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label={`Escenas de «${chapter.title}»`}>
              {chapter.scenes.map((scene) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  secret={scene.type === 'OUTRO' && !isDone}
                  onVotes={scene.type === 'DECISION' ? () => onDecisionResults(scene) : undefined}
                  onPreview={() => onPreviewScene(chapter, scene)}
                  onEdit={() => onEditScene(chapter, scene)}
                  onDelete={() => onDeleteScene(chapter, scene)}
                />
              ))}
              <li>
                <button type="button" onClick={() => onAddScene(chapter)} className="flex h-full min-h-[88px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 text-sm font-semibold text-gray-800 hover:border-primary-500 hover:text-primary-700 dark:border-gray-600 dark:text-gray-100 dark:hover:text-primary-300">
                  <Plus size={16} aria-hidden="true" /> Añadir escena
                </button>
              </li>
            </ul>

            <div className="flex flex-wrap gap-2">
              {(isActive || isDone) && chapter.scenes.length > 0 && (
                <button type="button" onClick={() => onPresentChapter(chapter)} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700">
                  <MonitorPlay size={16} aria-hidden="true" /> {isDone ? 'Volver a presentar' : 'Presentar en el proyector'}
                </button>
              )}
              {isActive && story.isActive && (
                <button type="button" onClick={() => onReveal(chapter)} className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-bold ${chapter.goalReachedAt ? 'bg-amber-400 text-amber-950 hover:bg-amber-300' : 'border border-gray-300 text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700'}`}>
                  <Sparkles size={16} aria-hidden="true" /> {chapter.goalReachedAt ? 'Revelar el final' : 'Revelar el final ahora'}
                </button>
              )}
              {chapter.status === 'LOCKED' && (canMoveUp || canMoveDown) && (
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => onMoveChapter(chapter, -1)} disabled={!canMoveUp || moving} className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-300 text-gray-800 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700" aria-label={`Mover «${chapter.title}» antes`}>
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => onMoveChapter(chapter, 1)} disabled={!canMoveDown || moving} className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-300 text-gray-800 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700" aria-label={`Mover «${chapter.title}» después`}>
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.li>
  );
};

// ---------- Escena (guion gráfico) ----------

const SceneCard = ({ scene, secret, onVotes, onPreview, onEdit, onDelete }: {
  scene: StoryScene;
  secret: boolean;
  onVotes?: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const meta = SCENE_TYPES[scene.type];
  const trigger = sceneTrigger(scene);
  const lines = scene.dialogues?.length ?? 0;
  const decision = scene.type === 'DECISION' ? playableDecision(scene.decision) : null;
  const totalVotes = Object.values(scene.votes ?? {}).reduce((sum, n) => sum + n, 0);
  const winner = decision?.options.find((o) => o.id === decision.winnerOptionId);
  return (
    <li className="flex flex-col rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40">
      <button type="button" onClick={onPreview} className="flex min-h-[88px] flex-1 flex-col gap-1.5 rounded-t-xl p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={`Ver escena: ${meta.label}`}>
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${meta.chip}`}><span aria-hidden="true">{meta.emoji}</span> {meta.label}{trigger ? ` · ${trigger} %` : ''}</span>
          {secret && <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs font-semibold text-white dark:bg-gray-200 dark:text-gray-900">Secreta</span>}
          {decision && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${decision.status === 'OPEN' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100' : 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'}`}>
              {decision.status === 'OPEN' ? `Votación abierta · ${plural(totalVotes, 'voto', 'votos')}` : `Ganó «${winner?.label ?? ''}»`}
            </span>
          )}
        </span>
        <span className="line-clamp-2 text-sm text-gray-800 dark:text-gray-100">{sceneSnippet(scene)}</span>
        <span className="mt-auto flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          {plural(lines, 'línea', 'líneas')}
          {scene.mediaType === 'IMAGE' && <span className="inline-flex items-center gap-1"><ImageIcon size={12} aria-hidden="true" /> Imagen</span>}
          {scene.mediaType === 'VIDEO' && <span className="inline-flex items-center gap-1"><Video size={12} aria-hidden="true" /> Video</span>}
          <Eye size={12} className="ml-auto" aria-hidden="true" />
        </span>
      </button>
      <div className="flex justify-end gap-1 border-t border-gray-200 p-1 dark:border-gray-700">
        {onVotes && (
          <button type="button" onClick={onVotes} className="mr-auto inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/30">
            <Vote size={16} aria-hidden="true" /> Votos
          </button>
        )}
        <button type="button" onClick={onEdit} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700" aria-label={`Editar escena: ${meta.label}`}>
          <Edit2 size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={onDelete} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30" aria-label={`Eliminar escena: ${meta.label}`}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
};
