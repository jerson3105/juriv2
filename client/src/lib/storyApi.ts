import api from './api';

// ==================== TYPES ====================

export interface ThemeConfig {
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    sidebar?: string;
  };
  particles?: {
    type?: string;
    color?: string;
    speed?: string;
    density?: string;
  };
  decorations?: Array<{
    type: string;
    position: string;
    asset: string;
  }>;
  banner?: {
    emoji?: string;
    title?: string;
  };
  /** Efecto animado de la cabecera (clave de lib/themeEffects). */
  effect?: string;
}

export interface ThemePreset {
  key: string;
  name: string;
  colors: ThemeConfig['colors'];
  particles: ThemeConfig['particles'];
  decorations: ThemeConfig['decorations'];
  banner: ThemeConfig['banner'];
  effect?: string;
}

export type SceneKind = 'INTRO' | 'DESARROLLO' | 'MILESTONE' | 'OUTRO' | 'DECISION';

export interface DecisionLine { speaker?: string; text: string; emotion?: string }

// Decisión completa (profesor).
export interface StoryDecision {
  question: string;
  options: { id: string; label: string; outcome: DecisionLine[] }[];
  status: 'OPEN' | 'CLOSED';
  winnerOptionId?: string | null;
  closedAt?: string | null;
}

// Decisión vista por el alumno: sin desenlaces hasta que se cierra la votación.
export interface StudentDecision {
  question: string;
  status: 'OPEN' | 'CLOSED';
  options: { id: string; label: string }[];
  winnerOptionId: string | null;
  outcome: DecisionLine[];
  myVote: string | null;
}

export interface DecisionResults {
  question: string;
  status: 'OPEN' | 'CLOSED';
  winnerOptionId: string | null;
  options: { id: string; label: string; votes: number }[];
  total: number;
  eligible: number;
}

export interface DecisionInput {
  question: string;
  options: { id?: string; label: string; outcome: DecisionLine[] }[];
}

export interface StoryDraftScene {
  type: SceneKind;
  triggerPercent?: number;
  dialogues: DecisionLine[];
  decision?: { question: string; options: { label: string; outcome: DecisionLine[] }[] };
}

export interface StoryDraft {
  chapter?: { title: string; description: string; targetXp?: number };
  scenes: StoryDraftScene[];
}

export interface SceneDialogue {
  id: string;
  sceneId: string;
  orderIndex: number;
  text: string;
  speaker: string | null;
  emotion: string;
}

export interface StoryScene {
  id: string;
  chapterId: string;
  orderIndex: number;
  type: SceneKind;
  mediaType: 'VIDEO' | 'IMAGE' | null;
  mediaUrl: string | null;
  backgroundColor: string | null;
  triggerConfig: { percentage?: number } | null;
  createdAt: string;
  dialogues: SceneDialogue[];
  // Profesor: decisión completa (con desenlaces) y votos por opción. Alumno: decisión saneada.
  decision?: StoryDecision | StudentDecision | string | null;
  votes?: Record<string, number>;
}

// Recompensa al revelar el capítulo (la reciben quienes aportaron XP durante el capítulo).
export interface StoryRewardConfig {
  badgeId?: string | null;
  xp?: number;
  gp?: number;
  cardId?: string | null;
  clanPrize?: { mode: 'NONE' | 'MENTION' | 'GP'; gp?: number };
}

export interface StoryRewardResult {
  participants: number;
  badge?: { id: string; name: string; icon: string; awarded: number };
  xp?: number;
  gp?: number;
  card?: { id: string; name: string; granted: number };
  winningClan?: { id: string; name: string; emblem: string; xp: number; prizeGp: number; members: number } | null;
  errors?: string[];
}

export interface StoryRewardPreview {
  badge: { name: string; icon: string } | null;
  xp: number;
  gp: number;
  card: { name: string } | null;
  clanPrize: { mode: 'NONE' | 'MENTION' | 'GP'; gp?: number };
}

export interface ChapterFactions {
  participants: number;
  clans: { id: string; name: string; emblem: string; color: string; xp: number }[];
}

export interface StoryChapter {
  id: string;
  storyId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  status: 'LOCKED' | 'ACTIVE' | 'COMPLETED';
  completionType: 'BIMESTER' | 'XP_GOAL' | 'DONATION';
  completionConfig: {
    targetXp?: number;
    donationPercent?: number;
  } | null;
  rewardConfig: StoryRewardConfig | string | null;
  rewardResult: StoryRewardResult | string | null;
  currentProgress: string;
  progressBaseline: string | null;
  activatedAt: string | null;
  // Meta alcanzada: el capítulo sigue en curso hasta que el profesor revela el final.
  goalReachedAt: string | null;
  themeOverride: ThemeConfig | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  scenes: StoryScene[];
}

export interface Story {
  id: string;
  classroomId: string;
  title: string;
  description: string | null;
  aiBible?: string | null;
  isActive: boolean;
  themeConfig: ThemeConfig | null;
  createdAt: string;
  updatedAt: string;
  chapters: StoryChapter[];
}

export interface StoryListItem extends Story {
  chapterCount: number;
  activeChapters: number;
  completedChapters: number;
  readyToReveal: number;
}

export interface StudentSceneSummary {
  id: string;
  type: SceneKind;
  decisionStatus?: 'OPEN' | 'CLOSED' | null;
  orderIndex: number;
  hasMedia: boolean;
  dialogueCount: number;
  viewed: boolean;
  triggerConfig: { percentage?: number } | null;
}

// Capítulo visto por el alumno: solo las escenas desbloqueadas (sin spoilers)
export interface StudentChapterInfo {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  position: number;
  status: 'LOCKED' | 'ACTIVE' | 'COMPLETED';
  completionType: 'BIMESTER' | 'XP_GOAL' | 'DONATION';
  completionConfig: { targetXp?: number; donationPercent?: number } | null;
  currentProgress: number;
  goalReached: boolean;
  activatedAt: string | null;
  completedAt: string | null;
  scenesCount: number;
  lockedScenes: number;
  scenes: StudentSceneSummary[];
}

export interface StudentStoryData {
  id: string;
  title: string;
  description: string | null;
  themeConfig: ThemeConfig | null;
  chapters: StudentChapterInfo[];
  unseenScenes: StoryScene[];
  rewardPreview: StoryRewardPreview | null;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  displayName: string;
  characterClass: string;
  level: number;
  xp?: number;
  donated?: number;
}

export interface ChapterRecap {
  chapterId: string;
  title: string;
  storyTitle: string;
  position: number;
  totalChapters: number;
  completionType: 'BIMESTER' | 'XP_GOAL' | 'DONATION';
  target: number;
  progress: number;
  days: number | null;
  completedAt: string | null;
  heroes: LeaderboardEntry[];
  nextChapterTitle: string | null;
  isLast: boolean;
  rewardResult: StoryRewardResult | null;
}

export interface ChapterLeaderboard {
  type: 'XP_GOAL' | 'DONATION' | 'BIMESTER';
  leaderboard: LeaderboardEntry[];
}

// ==================== API ====================

export const storyApi = {
  // ---- Theme ----
  getPresets: async (): Promise<ThemePreset[]> => {
    const res = await api.get('/stories/presets');
    return res.data.data;
  },

  getClassroomTheme: async (classroomId: string): Promise<{ themeConfig: ThemeConfig | null; themeSource: string | null }> => {
    const res = await api.get(`/stories/classroom/${classroomId}/theme`);
    return res.data.data;
  },

  updateClassroomTheme: async (classroomId: string, themeConfig: ThemeConfig | null, themeSource?: string): Promise<void> => {
    await api.put(`/stories/classroom/${classroomId}/theme`, { themeConfig, themeSource });
  },

  applyPreset: async (classroomId: string, presetKey: string): Promise<ThemeConfig> => {
    const res = await api.post(`/stories/classroom/${classroomId}/theme/preset`, { presetKey });
    return res.data.data;
  },

  resetTheme: async (classroomId: string): Promise<void> => {
    await api.delete(`/stories/classroom/${classroomId}/theme`);
  },

  generateAIThemePreview: async (description: string): Promise<{ name: string; themeConfig: ThemeConfig }> => {
    const res = await api.post('/stories/theme/generate-ai-preview', { description });
    return res.data.data;
  },

  generateAITheme: async (classroomId: string, description: string): Promise<{ name: string; themeConfig: ThemeConfig }> => {
    const res = await api.post(`/stories/classroom/${classroomId}/theme/generate-ai`, { description });
    return res.data.data;
  },

  // ---- Stories ----
  getClassroomStories: async (classroomId: string): Promise<StoryListItem[]> => {
    const res = await api.get(`/stories/classroom/${classroomId}`);
    return res.data.data;
  },

  getStory: async (storyId: string): Promise<Story> => {
    const res = await api.get(`/stories/${storyId}`);
    return res.data.data;
  },

  createStory: async (classroomId: string, data: { title: string; description?: string; aiBible?: string; themeConfig?: ThemeConfig }): Promise<Story> => {
    const res = await api.post(`/stories/classroom/${classroomId}`, data);
    return res.data.data;
  },

  updateStory: async (storyId: string, data: { title?: string; description?: string; aiBible?: string; themeConfig?: ThemeConfig | null }): Promise<Story> => {
    const res = await api.put(`/stories/${storyId}`, data);
    return res.data.data;
  },

  deleteStory: async (storyId: string): Promise<void> => {
    await api.delete(`/stories/${storyId}`);
  },

  activateStory: async (storyId: string, classroomId: string): Promise<Story> => {
    const res = await api.post(`/stories/${storyId}/activate`, { classroomId });
    return res.data.data;
  },

  deactivateStory: async (storyId: string, classroomId: string): Promise<void> => {
    await api.post(`/stories/${storyId}/deactivate`, { classroomId });
  },

  // ---- Chapters ----
  createChapter: async (storyId: string, data: {
    title: string;
    description?: string;
    completionType: string;
    completionConfig?: { targetXp?: number; donationPercent?: number };
    themeOverride?: ThemeConfig;
    rewardConfig?: StoryRewardConfig | null;
  }): Promise<StoryChapter> => {
    const res = await api.post(`/stories/${storyId}/chapters`, data);
    return res.data.data;
  },

  updateChapter: async (chapterId: string, data: {
    title?: string;
    description?: string;
    completionType?: string;
    completionConfig?: { targetXp?: number; donationPercent?: number };
    themeOverride?: ThemeConfig;
    rewardConfig?: StoryRewardConfig | null;
  }): Promise<StoryChapter> => {
    const res = await api.put(`/stories/chapters/${chapterId}`, data);
    return res.data.data;
  },

  deleteChapter: async (chapterId: string): Promise<void> => {
    await api.delete(`/stories/chapters/${chapterId}`);
  },

  // Revela el final: completa el capítulo en curso y abre el siguiente.
  completeChapter: async (chapterId: string): Promise<StoryChapter> => {
    const res = await api.post(`/stories/chapters/${chapterId}/complete`);
    return res.data.data;
  },

  reorderChapters: async (storyId: string, chapterIds: string[]): Promise<Story> => {
    const res = await api.put(`/stories/${storyId}/chapters/order`, { chapterIds });
    return res.data.data;
  },

  getChapterFactions: async (chapterId: string): Promise<ChapterFactions> => {
    const res = await api.get(`/stories/chapters/${chapterId}/factions`);
    return res.data.data;
  },

  getChapterRecap: async (chapterId: string): Promise<ChapterRecap> => {
    const res = await api.get(`/stories/chapters/${chapterId}/recap`);
    return res.data.data;
  },

  // ---- Scenes ----
  createScene: async (chapterId: string, data: {
    type: string;
    mediaType?: string;
    mediaUrl?: string;
    backgroundColor?: string;
    triggerConfig?: { percentage?: number } | null;
    dialogues?: Array<{ text: string; speaker?: string; emotion?: string }>;
    decision?: DecisionInput | null;
  }): Promise<StoryScene> => {
    const res = await api.post(`/stories/chapters/${chapterId}/scenes`, data);
    return res.data.data;
  },

  updateScene: async (sceneId: string, data: {
    type?: string;
    mediaType?: string | null;
    mediaUrl?: string | null;
    backgroundColor?: string | null;
    triggerConfig?: { percentage?: number } | null;
    decision?: DecisionInput | null;
  }): Promise<StoryScene> => {
    const res = await api.put(`/stories/scenes/${sceneId}`, data);
    return res.data.data;
  },

  deleteScene: async (sceneId: string): Promise<void> => {
    await api.delete(`/stories/scenes/${sceneId}`);
  },

  setDialogues: async (sceneId: string, dialogues: Array<{ text: string; speaker?: string; emotion?: string }>): Promise<StoryScene> => {
    const res = await api.put(`/stories/scenes/${sceneId}/dialogues`, { dialogues });
    return res.data.data;
  },

  // ---- Decisiones ----
  voteDecision: async (sceneId: string, optionId: string): Promise<StudentDecision> => {
    const res = await api.post(`/stories/scenes/${sceneId}/vote`, { optionId });
    return res.data.data;
  },

  getDecisionResults: async (sceneId: string): Promise<DecisionResults> => {
    const res = await api.get(`/stories/scenes/${sceneId}/results`);
    return res.data.data;
  },

  closeDecision: async (sceneId: string, winnerOptionId?: string | null): Promise<DecisionResults> => {
    const res = await api.post(`/stories/scenes/${sceneId}/close-vote`, { winnerOptionId });
    return res.data.data;
  },

  // ---- IA coautora (solo propone: nada se guarda hasta aceptar) ----
  getAiDraft: async (storyId: string, data: { kind: 'chapter' | 'scenes'; chapterId?: string; idea?: string }): Promise<StoryDraft> => {
    const res = await api.post(`/stories/${storyId}/ai/draft`, data);
    return res.data.data;
  },

  // ---- Student ----
  getStudentStoryData: async (classroomId: string): Promise<StudentStoryData | null> => {
    const res = await api.get(`/stories/classroom/${classroomId}/student/me`);
    return res.data.data;
  },

  getChapterScenesForStudent: async (chapterId: string): Promise<StoryScene[]> => {
    const res = await api.get(`/stories/chapters/${chapterId}/scenes/student`);
    return res.data.data;
  },

  getChapterLeaderboard: async (chapterId: string): Promise<ChapterLeaderboard> => {
    const res = await api.get(`/stories/chapters/${chapterId}/leaderboard`);
    return res.data.data;
  },

  getSceneForViewing: async (sceneId: string): Promise<StoryScene> => {
    const res = await api.get(`/stories/scenes/${sceneId}/view`);
    return res.data.data;
  },

  markSceneViewed: async (sceneId: string): Promise<void> => {
    await api.post(`/stories/scenes/${sceneId}/viewed`);
  },

  // ---- AI Generation ----
  generateAIImagePrompt: async (data: { description: string; sceneType?: string; storyContext?: string }): Promise<{ imagePrompt: string }> => {
    const res = await api.post('/stories/scenes/generate-ai', { ...data, mode: 'image_prompt' });
    return res.data.data;
  },

  generateAIDialogues: async (data: { description: string; sceneType?: string; storyContext?: string }): Promise<{ dialogues: Array<{ speaker: string; text: string; emotion: string }> }> => {
    const res = await api.post('/stories/scenes/generate-ai', { ...data, mode: 'dialogues' });
    return res.data.data;
  },

  generateAIFullScene: async (data: { description: string; sceneType?: string; storyContext?: string }): Promise<{ imagePrompt: string; dialogues: Array<{ speaker: string; text: string; emotion: string }> }> => {
    const res = await api.post('/stories/scenes/generate-ai', { ...data, mode: 'full_scene' });
    return res.data.data;
  },
};

export default storyApi;
