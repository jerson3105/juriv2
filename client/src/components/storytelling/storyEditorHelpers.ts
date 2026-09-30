import type { StoryChapter, StoryScene } from '../../lib/storyApi';

export const storiesKey = (classroomId: string) => ['stories', classroomId] as const;
export const storyDetailKey = (storyId: string) => ['story-detail', storyId] as const;
export const classroomKey = (classroomId: string) => ['classroom', classroomId] as const;

export type SceneType = StoryScene['type'];
export type CompletionType = StoryChapter['completionType'];

export const SCENE_TYPES: Record<SceneType, { label: string; emoji: string; hint: string; chip: string }> = {
  INTRO: { label: 'Introducción', emoji: '🎬', hint: 'Se reproduce sola cuando el capítulo empieza.', chip: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  DESARROLLO: { label: 'Desarrollo', emoji: '📖', hint: 'El alumno la abre cuando quiere desde Mi Historia.', chip: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' },
  MILESTONE: { label: 'Hito', emoji: '⭐', hint: 'Se desbloquea al llegar a un porcentaje de la meta.', chip: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' },
  OUTRO: { label: 'Cierre', emoji: '🏁', hint: 'Secreto hasta que reveles el final del capítulo.', chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
};

export const SCENE_ORDER: SceneType[] = ['INTRO', 'DESARROLLO', 'MILESTONE', 'OUTRO'];

export const COMPLETION_TYPES: Record<CompletionType, { label: string; emoji: string; hint: string }> = {
  XP_GOAL: { label: 'Meta de XP', emoji: '🎯', hint: 'La clase suma el XP que gana desde que empieza el capítulo. Al llegar a la meta queda listo para que reveles el final.' },
  DONATION: { label: 'Donación', emoji: '💝', hint: 'Cada alumno dona un porcentaje del XP que gana (sin perderlo). Al llegar a la meta queda listo para revelar.' },
  BIMESTER: { label: 'Bimestre', emoji: '📅', hint: 'Queda listo para revelar cuando cierras el bimestre.' },
};

export const STATUS_LABEL: Record<StoryChapter['status'], string> = {
  COMPLETED: 'Completado',
  ACTIVE: 'En curso',
  LOCKED: 'Por venir',
};

const parse = <T>(raw: unknown): T | null => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
  return raw as T;
};

export const chapterConfig = (chapter: StoryChapter) =>
  parse<{ targetXp?: number; donationPercent?: number }>(chapter.completionConfig) ?? {};

export const chapterProgress = (chapter: StoryChapter) => {
  const target = chapterConfig(chapter).targetXp ?? 0;
  const value = parseFloat(chapter.currentProgress) || 0;
  return { target, value, percent: target > 0 ? Math.min(100, (value / target) * 100) : 0 };
};

export const sceneTrigger = (scene: StoryScene) => parse<{ percentage?: number }>(scene.triggerConfig)?.percentage ?? null;

export const sceneSnippet = (scene: StoryScene) => {
  const first = scene.dialogues?.find((d) => d.text.trim());
  if (!first) return 'Sin diálogos';
  return `${first.speaker ? `${first.speaker}: ` : ''}${first.text}`;
};

export const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
