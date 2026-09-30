import type { StoryScene, StudentStoryData } from '../../lib/storyApi';

// Una secuencia de la novela visual: portada del capítulo, escenas y cierre celebrado.
export type PlayerItem =
  | { kind: 'cover'; key: string; position: number; title: string; description?: string | null; storyTitle?: string }
  | { kind: 'scene'; key: string; scene: StoryScene; chapterPosition?: number }
  | { kind: 'recap'; key: string; chapterId: string };

export const coverItem = (chapter: { id: string; title: string; description?: string | null }, position: number, storyTitle?: string): PlayerItem => ({
  kind: 'cover',
  key: `cover-${chapter.id}`,
  position,
  title: chapter.title,
  description: chapter.description,
  storyTitle,
});

export const sceneItem = (scene: StoryScene, chapterPosition?: number): PlayerItem => ({
  kind: 'scene',
  key: `scene-${scene.id}`,
  scene,
  chapterPosition,
});

export const recapItem = (chapterId: string): PlayerItem => ({ kind: 'recap', key: `recap-${chapterId}`, chapterId });

/**
 * Reproducción automática del alumno: escenas nuevas en orden. Si un capítulo empieza (su intro es
 * la primera escena que ve), va precedido de su portada; si termina (hay cierre nuevo), le sigue el resumen.
 */
export const buildAutoplayItems = (data: StudentStoryData): PlayerItem[] => {
  const items: PlayerItem[] = [];
  for (const chapter of data.chapters) {
    const unseen = data.unseenScenes.filter((scene) => scene.chapterId === chapter.id);
    if (unseen.length === 0) continue;
    const firstVisit = chapter.scenes.every((scene) => !scene.viewed);
    if (firstVisit && unseen.some((scene) => scene.type === 'INTRO')) {
      items.push(coverItem(chapter, chapter.position, data.title));
    }
    unseen.forEach((scene) => items.push(sceneItem(scene, chapter.position)));
    if (chapter.status === 'COMPLETED' && unseen.some((scene) => scene.type === 'OUTRO')) {
      items.push(recapItem(chapter.id));
    }
  }
  return items;
};

// Extrae el id de YouTube de las URL habituales (o de un id suelto).
export const youTubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.trim().match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Emociones: color de la placa del personaje (texto blanco ≥ 4.5:1) y nombre para lectores de pantalla.
export const EMOTIONS: Record<string, { label: string; emoji: string; color: string }> = {
  neutral: { label: 'Neutral', emoji: '😐', color: '#374151' },
  excited: { label: 'Emocionado', emoji: '🤩', color: '#b45309' },
  happy: { label: 'Feliz', emoji: '😊', color: '#047857' },
  sad: { label: 'Triste', emoji: '😢', color: '#4338ca' },
  angry: { label: 'Enojado', emoji: '😠', color: '#b91c1c' },
  mysterious: { label: 'Misterioso', emoji: '🔮', color: '#6d28d9' },
};

export const emotionOf = (emotion: string | null | undefined) => EMOTIONS[emotion ?? 'neutral'] ?? EMOTIONS.neutral;

// ---------- Decisiones ----------

export interface PlayableDecision {
  question: string;
  status: 'OPEN' | 'CLOSED';
  options: { id: string; label: string }[];
  winnerOptionId: string | null;
  outcome: { speaker?: string | null; text: string; emotion?: string }[];
  myVote: string | null;
}

type RawOption = { id: string; label: string; outcome?: { speaker?: string; text: string; emotion?: string }[] };
type RawDecision = {
  question: string;
  status: 'OPEN' | 'CLOSED';
  options: RawOption[];
  winnerOptionId?: string | null;
  outcome?: { speaker?: string; text: string; emotion?: string }[];
  myVote?: string | null;
};

/** Decisión reproducible: la completa del profesor o la saneada del alumno (sin desenlaces si está abierta). */
export const playableDecision = (raw: unknown): PlayableDecision | null => {
  let decision: RawDecision | null = null;
  if (typeof raw === 'string') {
    try { decision = JSON.parse(raw) as RawDecision; } catch { decision = null; }
  } else if (raw && typeof raw === 'object') {
    decision = raw as RawDecision;
  }
  if (!decision?.options?.length) return null;
  const winner = decision.options.find((o) => o.id === decision!.winnerOptionId);
  return {
    question: decision.question,
    status: decision.status,
    options: decision.options.map((o) => ({ id: o.id, label: o.label })),
    winnerOptionId: decision.winnerOptionId ?? null,
    outcome: decision.status === 'CLOSED' ? decision.outcome ?? winner?.outcome ?? [] : [],
    myVote: decision.myVote ?? null,
  };
};
