import { db } from '../db/index.js';
import {
  stories,
  storyChapters,
  storyScenes,
  sceneDialogues,
  studentSceneViews,
  storyDonations,
  classrooms,
  studentProfiles,
  pointLogs,
} from '../db/schema.js';
import { eq, and, asc, desc, sql, inArray, gte, lte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { teacherOwnsClassroom } from '../utils/access.js';
import { affectedRows } from '../utils/points.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// Tipos de partícula que el cliente sabe dibujar (la IA y el profesor solo pueden elegir entre estos).
export const PARTICLE_TYPES = [
  'stars', 'snow', 'petals', 'sparkles', 'bubbles', 'fireflies', 'smoke', 'embers', 'ash', 'dust',
  'lava', 'hearts', 'confetti', 'rain', 'leaves', 'swords', 'math', 'computing', 'science', 'religion',
] as const;

type SceneLike = { type: string; triggerConfig: unknown };
type ChapterLike = {
  status: string;
  completionConfig: unknown;
  currentProgress: string | number;
  goalReachedAt: Date | string | null;
};

const parseJson = <T>(raw: unknown): T | null => {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
  return raw as T;
};

const chapterPercent = (chapter: ChapterLike): number => {
  const target = parseJson<{ targetXp?: number }>(chapter.completionConfig)?.targetXp || 0;
  const progress = parseFloat(String(chapter.currentProgress)) || 0;
  return target > 0 ? (progress / target) * 100 : 0;
};

/**
 * Qué escenas puede ver un alumno (sin spoilers):
 * capítulo en curso → intro y desarrollo; los hitos al llegar a su % (o al alcanzar la meta);
 * el cierre solo cuando el profesor revela el final. Capítulo completado → todo.
 */
export const isSceneUnlocked = (scene: SceneLike, chapter: ChapterLike): boolean => {
  if (chapter.status === 'COMPLETED') return true;
  if (chapter.status !== 'ACTIVE') return false;
  if (scene.type === 'INTRO' || scene.type === 'DESARROLLO') return true;
  if (scene.type === 'MILESTONE') {
    if (chapter.goalReachedAt) return true;
    const threshold = parseJson<{ percentage?: number }>(scene.triggerConfig)?.percentage || 0;
    return threshold > 0 && chapterPercent(chapter) >= threshold;
  }
  return false;
};

const STATUS_RANK: Record<string, number> = { COMPLETED: 0, ACTIVE: 1, LOCKED: 2 };

// ==================== THEME PRESETS ====================

export const THEME_PRESETS = {
  spring: {
    name: 'Primavera',
    colors: { primary: '#4CAF50', secondary: '#81C784', accent: '#FFD54F', background: '#E8F5E9', sidebar: '#2E7D32' },
    particles: { type: 'petals', color: '#F48FB1', speed: 'slow', density: 'low' },
    decorations: [{ type: 'corner', position: 'top-right', asset: 'sun' }],
    banner: { emoji: '🌸', title: 'Primavera' },
  },
  halloween: {
    name: 'Halloween',
    colors: { primary: '#FF6F00', secondary: '#FFB74D', accent: '#7C4DFF', background: '#1A1A2E', sidebar: '#0D0D1A' },
    particles: { type: 'sparkles', color: '#FF6F00', speed: 'slow', density: 'low' },
    decorations: [{ type: 'corner', position: 'top-right', asset: 'moon' }],
    banner: { emoji: '🎃', title: 'Halloween' },
  },
  christmas: {
    name: 'Navidad',
    colors: { primary: '#C62828', secondary: '#EF5350', accent: '#FFD54F', background: '#FFEBEE', sidebar: '#B71C1C' },
    particles: { type: 'snow', color: '#FFFFFF', speed: 'slow', density: 'medium' },
    decorations: [{ type: 'corner', position: 'top-right', asset: 'snowflakes' }],
    banner: { emoji: '🎄', title: 'Navidad' },
  },
  ocean: {
    name: 'Océano',
    colors: { primary: '#0277BD', secondary: '#4FC3F7', accent: '#00E5FF', background: '#E1F5FE', sidebar: '#01579B' },
    particles: { type: 'bubbles', color: '#4FC3F7', speed: 'slow', density: 'low' },
    decorations: [{ type: 'corner', position: 'top-right', asset: 'waves' }],
    banner: { emoji: '🌊', title: 'Océano' },
  },
  space: {
    name: 'Espacio',
    colors: { primary: '#311B92', secondary: '#7C4DFF', accent: '#FFD54F', background: '#0D0D2B', sidebar: '#1A0A3E' },
    particles: { type: 'stars', color: '#FFFFFF', speed: 'slow', density: 'medium' },
    decorations: [{ type: 'corner', position: 'top-right', asset: 'moon' }],
    banner: { emoji: '🚀', title: 'Espacio' },
  },
  forest: {
    name: 'Bosque Encantado',
    colors: { primary: '#1B5E20', secondary: '#66BB6A', accent: '#FFEE58', background: '#E8F5E9', sidebar: '#0D3B0F' },
    particles: { type: 'fireflies', color: '#FFEE58', speed: 'slow', density: 'low' },
    decorations: [{ type: 'border', position: 'sidebar', asset: 'vines' }, { type: 'corner', position: 'top-right', asset: 'trees' }],
    banner: { emoji: '🌲', title: 'Bosque Encantado' },
  },
} as const;

export type ThemePresetKey = keyof typeof THEME_PRESETS;

// ==================== SERVICE ====================

class StoryService {

  // XP total actual de la clase (alumnos activos): base de la meta relativa de XP_GOAL.
  private async classXpTotal(exec: Executor, classroomId: string): Promise<number> {
    const [row] = await exec.select({
      total: sql<string>`COALESCE(SUM(${studentProfiles.xp}), 0)`,
    }).from(studentProfiles).where(and(
      eq(studentProfiles.classroomId, classroomId),
      eq(studentProfiles.isActive, true)
    ));
    return parseFloat(row?.total ?? '0') || 0;
  }

  /** Pone un capítulo en curso: el reloj y la meta relativa empiezan ahora. */
  private async startChapter(
    exec: Executor,
    chapter: { id: string; completionType: string },
    classroomId: string,
    now: Date
  ) {
    const baseline = chapter.completionType === 'XP_GOAL' ? await this.classXpTotal(exec, classroomId) : null;
    await exec.update(storyChapters)
      .set({
        status: 'ACTIVE',
        activatedAt: now,
        progressBaseline: baseline === null ? null : baseline.toFixed(2),
        currentProgress: '0',
        goalReachedAt: null,
        updatedAt: now,
      })
      .where(eq(storyChapters.id, chapter.id));
  }

  /** Siguiente capítulo bloqueado por orden (no exige índices consecutivos). */
  private async nextLockedChapter(exec: Executor, storyId: string) {
    const [next] = await exec.select({ id: storyChapters.id, completionType: storyChapters.completionType })
      .from(storyChapters)
      .where(and(eq(storyChapters.storyId, storyId), eq(storyChapters.status, 'LOCKED')))
      .orderBy(asc(storyChapters.orderIndex))
      .limit(1);
    return next ?? null;
  }

  // ---- THEME MANAGEMENT (independent of stories) ----

  async getClassroomTheme(classroomId: string) {
    const [classroom] = await db.select({
      themeConfig: classrooms.themeConfig,
      themeSource: classrooms.themeSource,
    }).from(classrooms).where(eq(classrooms.id, classroomId));

    if (!classroom) return null;

    // If source is STORY, check for active story theme
    if (classroom.themeSource === 'STORY') {
      const activeStory = await this.getActiveStory(classroomId);
      if (activeStory?.themeConfig) {
        // Check for active chapter theme override
        const activeChapter = activeStory.chapters?.find((c: any) => c.status === 'ACTIVE');
        if (activeChapter?.themeOverride) {
          return { themeConfig: activeChapter.themeOverride, themeSource: 'STORY' };
        }
        return { themeConfig: activeStory.themeConfig, themeSource: 'STORY' };
      }
    }

    return { themeConfig: classroom.themeConfig, themeSource: classroom.themeSource };
  }

  async updateClassroomTheme(classroomId: string, themeConfig: any, themeSource: string) {
    await db.update(classrooms)
      .set({ themeConfig, themeSource, updatedAt: new Date() })
      .where(eq(classrooms.id, classroomId));
  }

  async applyPreset(classroomId: string, presetKey: string) {
    const preset = THEME_PRESETS[presetKey as ThemePresetKey];
    if (!preset) throw new Error('Preset no encontrado');

    const { name, ...themeConfig } = preset;
    await this.updateClassroomTheme(classroomId, themeConfig, 'PRESET');
    return themeConfig;
  }

  async resetTheme(classroomId: string) {
    await this.updateClassroomTheme(classroomId, null, 'DEFAULT');
  }

  // ---- STORIES CRUD ----

  async getClassroomStories(classroomId: string) {
    const result = await db.select()
      .from(stories)
      .where(eq(stories.classroomId, classroomId))
      .orderBy(desc(stories.createdAt));

    // For each story, get chapter count
    const storiesWithCounts = await Promise.all(result.map(async (story) => {
      const chapters = await db.select({
        id: storyChapters.id,
        status: storyChapters.status,
        goalReachedAt: storyChapters.goalReachedAt,
      }).from(storyChapters).where(eq(storyChapters.storyId, story.id));

      return {
        ...story,
        chapterCount: chapters.length,
        activeChapters: chapters.filter(c => c.status === 'ACTIVE').length,
        completedChapters: chapters.filter(c => c.status === 'COMPLETED').length,
        readyToReveal: chapters.filter(c => c.status === 'ACTIVE' && c.goalReachedAt).length,
      };
    }));

    return storiesWithCounts;
  }

  async getStory(storyId: string) {
    const [story] = await db.select()
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!story) throw new Error('Historia no encontrada');

    const chapters = await db.select()
      .from(storyChapters)
      .where(eq(storyChapters.storyId, storyId))
      .orderBy(asc(storyChapters.orderIndex));

    // For each chapter, get scenes with dialogues
    const chaptersWithScenes = await Promise.all(chapters.map(async (chapter) => {
      const scenes = await db.select()
        .from(storyScenes)
        .where(eq(storyScenes.chapterId, chapter.id))
        .orderBy(asc(storyScenes.orderIndex));

      const scenesWithDialogues = await Promise.all(scenes.map(async (scene) => {
        const dialogues = await db.select()
          .from(sceneDialogues)
          .where(eq(sceneDialogues.sceneId, scene.id))
          .orderBy(asc(sceneDialogues.orderIndex));

        return { ...scene, dialogues };
      }));

      return { ...chapter, scenes: scenesWithDialogues };
    }));

    return { ...story, chapters: chaptersWithScenes };
  }

  async getActiveStory(classroomId: string) {
    const [story] = await db.select()
      .from(stories)
      .where(and(
        eq(stories.classroomId, classroomId),
        eq(stories.isActive, true)
      ));

    if (!story) return null;
    return this.getStory(story.id);
  }

  async createStory(classroomId: string, data: { title: string; description?: string; themeConfig?: any }) {
    const id = uuidv4();
    const now = new Date();

    await db.insert(stories).values({
      id,
      classroomId,
      title: data.title,
      description: data.description || null,
      themeConfig: data.themeConfig || null,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    });

    return this.getStory(id);
  }

  async updateStory(storyId: string, data: { title?: string; description?: string; themeConfig?: any }) {
    const now = new Date();
    const updateData: any = { updatedAt: now };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.themeConfig !== undefined) updateData.themeConfig = data.themeConfig;

    await db.transaction(async (tx) => {
      const [story] = await tx.select({ classroomId: stories.classroomId, isActive: stories.isActive })
        .from(stories).where(eq(stories.id, storyId));
      if (!story) throw new NotFoundError('Historia no encontrada');

      await tx.update(stories).set(updateData).where(eq(stories.id, storyId));

      // Historia en curso con el tema aplicado a la clase: el cambio de tema se ve al instante.
      if (story.isActive && data.themeConfig !== undefined) {
        await tx.update(classrooms)
          .set(data.themeConfig
            ? { themeConfig: data.themeConfig, themeSource: 'STORY', updatedAt: now }
            : { themeConfig: null, themeSource: 'DEFAULT', updatedAt: now })
          .where(and(eq(classrooms.id, story.classroomId), eq(classrooms.themeSource, 'STORY')));
      }
    });
    return this.getStory(storyId);
  }

  async activateStory(storyId: string, classroomId: string) {
    const now = new Date();

    await db.transaction(async (tx) => {
      const [storyToActivate] = await tx.select({
        id: stories.id,
        themeConfig: stories.themeConfig,
      })
        .from(stories)
        .where(and(
          eq(stories.id, storyId),
          eq(stories.classroomId, classroomId)
        ));

      if (!storyToActivate) {
        throw new Error('Historia no encontrada en esta clase');
      }

      // Deactivate all stories in this classroom
      await tx.update(stories)
        .set({ isActive: false, updatedAt: now })
        .where(eq(stories.classroomId, classroomId));

      // Activate selected story
      await tx.update(stories)
        .set({ isActive: true, updatedAt: now })
        .where(eq(stories.id, storyId));

      // Un capítulo que aún no avanzó empieza a contar ahora (no hereda el XP ganado antes de activar la historia).
      const [current] = await tx.select({
        id: storyChapters.id,
        completionType: storyChapters.completionType,
        currentProgress: storyChapters.currentProgress,
        goalReachedAt: storyChapters.goalReachedAt,
      })
        .from(storyChapters)
        .where(and(eq(storyChapters.storyId, storyId), eq(storyChapters.status, 'ACTIVE')))
        .limit(1);
      if (current && !current.goalReachedAt && (parseFloat(current.currentProgress) || 0) === 0) {
        await this.startChapter(tx, current, classroomId, now);
      }

      // If story has a theme, apply it to classroom
      if (storyToActivate.themeConfig) {
        await tx.update(classrooms)
          .set({
            themeConfig: storyToActivate.themeConfig,
            themeSource: 'STORY',
            updatedAt: now,
          })
          .where(eq(classrooms.id, classroomId));
      }
    });

    return this.getStory(storyId);
  }

  async deactivateStory(storyId: string, classroomId: string) {
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.update(stories)
        .set({ isActive: false, updatedAt: now })
        .where(and(
          eq(stories.id, storyId),
          eq(stories.classroomId, classroomId)
        ));

      // Reset theme if it was from story
      const [classroom] = await tx.select({ themeSource: classrooms.themeSource })
        .from(classrooms)
        .where(eq(classrooms.id, classroomId));

      if (classroom?.themeSource === 'STORY') {
        await tx.update(classrooms)
          .set({ themeConfig: null, themeSource: 'DEFAULT', updatedAt: now })
          .where(eq(classrooms.id, classroomId));
      }
    });
  }

  async deleteStory(storyId: string) {
    const now = new Date();

    await db.transaction(async (tx) => {
      const [story] = await tx.select({
        id: stories.id,
        classroomId: stories.classroomId,
        isActive: stories.isActive,
      })
        .from(stories)
        .where(eq(stories.id, storyId));

      if (!story) {
        throw new Error('Historia no encontrada');
      }

      const chapters = await tx.select({ id: storyChapters.id })
        .from(storyChapters)
        .where(eq(storyChapters.storyId, storyId));

      const chapterIds = chapters.map((chapter) => chapter.id);

      if (chapterIds.length > 0) {
        const scenes = await tx.select({ id: storyScenes.id })
          .from(storyScenes)
          .where(inArray(storyScenes.chapterId, chapterIds));

        const sceneIds = scenes.map((scene) => scene.id);

        if (sceneIds.length > 0) {
          await tx.delete(sceneDialogues).where(inArray(sceneDialogues.sceneId, sceneIds));
          await tx.delete(studentSceneViews).where(inArray(studentSceneViews.sceneId, sceneIds));
          await tx.delete(storyScenes).where(inArray(storyScenes.id, sceneIds));
        }

        await tx.delete(storyDonations).where(inArray(storyDonations.chapterId, chapterIds));
        await tx.delete(storyChapters).where(inArray(storyChapters.id, chapterIds));
      }

      await tx.delete(stories).where(eq(stories.id, storyId));

      if (story.isActive) {
        const [classroom] = await tx.select({ themeSource: classrooms.themeSource })
          .from(classrooms)
          .where(eq(classrooms.id, story.classroomId));

        if (classroom?.themeSource === 'STORY') {
          await tx.update(classrooms)
            .set({ themeConfig: null, themeSource: 'DEFAULT', updatedAt: now })
            .where(eq(classrooms.id, story.classroomId));
        }
      }
    });
  }

  // ---- CHAPTERS CRUD ----

  async createChapter(storyId: string, data: {
    title: string;
    description?: string;
    completionType: string;
    completionConfig?: any;
    themeOverride?: any;
  }) {
    const id = uuidv4();
    const now = new Date();

    await db.transaction(async (tx) => {
      const [story] = await tx.select({ classroomId: stories.classroomId })
        .from(stories).where(eq(stories.id, storyId));
      if (!story) throw new NotFoundError('Historia no encontrada');

      // Orden y estados dentro de la transacción para evitar carreras.
      const existing = await tx.select({ orderIndex: storyChapters.orderIndex, status: storyChapters.status })
        .from(storyChapters)
        .where(eq(storyChapters.storyId, storyId));

      const nextOrder = existing.reduce((max, c) => Math.max(max, c.orderIndex + 1), 0);
      // Arranca en curso si no hay nada en curso ni pendiente (primer capítulo o continuación de una historia terminada).
      const startsNow = !existing.some((c) => c.status === 'ACTIVE' || c.status === 'LOCKED');

      await tx.insert(storyChapters).values({
        id,
        storyId,
        title: data.title,
        description: data.description || null,
        orderIndex: nextOrder,
        status: 'LOCKED',
        completionType: data.completionType,
        completionConfig: data.completionConfig || null,
        currentProgress: '0',
        themeOverride: data.themeOverride || null,
        createdAt: now,
        updatedAt: now,
      });

      if (startsNow) {
        await this.startChapter(tx, { id, completionType: data.completionType }, story.classroomId, now);
      }
    });

    return this.getChapter(id);
  }

  async getChapter(chapterId: string) {
    const [chapter] = await db.select()
      .from(storyChapters)
      .where(eq(storyChapters.id, chapterId));

    if (!chapter) throw new Error('Capítulo no encontrado');

    const scenes = await db.select()
      .from(storyScenes)
      .where(eq(storyScenes.chapterId, chapterId))
      .orderBy(asc(storyScenes.orderIndex));

    const scenesWithDialogues = await Promise.all(scenes.map(async (scene) => {
      const dialogues = await db.select()
        .from(sceneDialogues)
        .where(eq(sceneDialogues.sceneId, scene.id))
        .orderBy(asc(sceneDialogues.orderIndex));

      return { ...scene, dialogues };
    }));

    return { ...chapter, scenes: scenesWithDialogues };
  }

  async updateChapter(chapterId: string, data: {
    title?: string;
    description?: string;
    completionType?: string;
    completionConfig?: any;
    themeOverride?: any;
  }) {
    const now = new Date();
    await db.transaction(async (tx) => {
      const [chapter] = await tx.select({
        id: storyChapters.id,
        status: storyChapters.status,
        completionType: storyChapters.completionType,
        classroomId: stories.classroomId,
      })
        .from(storyChapters)
        .innerJoin(stories, eq(storyChapters.storyId, stories.id))
        .where(eq(storyChapters.id, chapterId));
      if (!chapter) throw new NotFoundError('Capítulo no encontrado');
      if (chapter.status === 'COMPLETED' && (data.completionType !== undefined || data.completionConfig !== undefined)) {
        throw new ConflictError('Un capítulo completado no puede cambiar su condición de cierre');
      }

      const updateData: Partial<typeof storyChapters.$inferInsert> = { updatedAt: now };
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.completionType !== undefined) updateData.completionType = data.completionType;
      if (data.completionConfig !== undefined) updateData.completionConfig = data.completionConfig;
      if (data.themeOverride !== undefined) updateData.themeOverride = data.themeOverride;

      // Un capítulo en curso que pasa a Meta XP empieza a contar desde ahora.
      const switchesToXpGoal = chapter.status === 'ACTIVE'
        && data.completionType === 'XP_GOAL'
        && chapter.completionType !== 'XP_GOAL';
      if (switchesToXpGoal) {
        updateData.progressBaseline = (await this.classXpTotal(tx, chapter.classroomId)).toFixed(2);
        updateData.currentProgress = '0';
        updateData.goalReachedAt = null;
      }

      await tx.update(storyChapters).set(updateData).where(eq(storyChapters.id, chapterId));
    });

    // La meta o el tipo pudieron cambiar: recalcula el avance del capítulo en curso.
    await this.updateChapterProgress(chapterId);
    return this.getChapter(chapterId);
  }

  async deleteChapter(chapterId: string) {
    const now = new Date();
    await db.transaction(async (tx) => {
      const [chapter] = await tx.select({
        id: storyChapters.id,
        storyId: storyChapters.storyId,
        status: storyChapters.status,
        classroomId: stories.classroomId,
      })
        .from(storyChapters)
        .innerJoin(stories, eq(storyChapters.storyId, stories.id))
        .where(eq(storyChapters.id, chapterId));
      if (!chapter) throw new NotFoundError('Capítulo no encontrado');

      const scenes = await tx.select({ id: storyScenes.id })
        .from(storyScenes)
        .where(eq(storyScenes.chapterId, chapterId));

      const sceneIds = scenes.map((scene) => scene.id);

      if (sceneIds.length > 0) {
        await tx.delete(sceneDialogues).where(inArray(sceneDialogues.sceneId, sceneIds));
        await tx.delete(studentSceneViews).where(inArray(studentSceneViews.sceneId, sceneIds));
        await tx.delete(storyScenes).where(inArray(storyScenes.id, sceneIds));
      }

      await tx.delete(storyDonations).where(eq(storyDonations.chapterId, chapterId));
      await tx.delete(storyChapters).where(eq(storyChapters.id, chapterId));

      // Si se borra el capítulo en curso, la historia sigue con el siguiente (antes quedaba atascada).
      if (chapter.status === 'ACTIVE') {
        const next = await this.nextLockedChapter(tx, chapter.storyId);
        if (next) await this.startChapter(tx, next, chapter.classroomId, now);
      }
    });
  }

  /**
   * Revela el final: completa el capítulo en curso y abre el siguiente por orden.
   * Solo desde ACTIVE y con actualización condicional, así un doble clic no salta dos capítulos.
   */
  async completeChapter(chapterId: string) {
    const now = new Date();

    await db.transaction(async (tx) => {
      const [chapter] = await tx.select({
        id: storyChapters.id,
        storyId: storyChapters.storyId,
        status: storyChapters.status,
        classroomId: stories.classroomId,
      })
        .from(storyChapters)
        .innerJoin(stories, eq(storyChapters.storyId, stories.id))
        .where(eq(storyChapters.id, chapterId));

      if (!chapter) throw new NotFoundError('Capítulo no encontrado');
      if (chapter.status !== 'ACTIVE') throw new ConflictError('Este capítulo no está en curso');

      const result = await tx.update(storyChapters)
        .set({ status: 'COMPLETED', completedAt: now, goalReachedAt: sql`COALESCE(${storyChapters.goalReachedAt}, ${sql.param(now, storyChapters.goalReachedAt)})`, updatedAt: now })
        .where(and(eq(storyChapters.id, chapterId), eq(storyChapters.status, 'ACTIVE')));
      if (affectedRows(result) === 0) throw new ConflictError('Este capítulo ya fue revelado');

      const next = await this.nextLockedChapter(tx, chapter.storyId);
      if (next) await this.startChapter(tx, next, chapter.classroomId, now);
    });

    return this.getChapter(chapterId);
  }

  /**
   * Reordena los capítulos. Los completados quedan primero, luego el que está en curso y
   * después los bloqueados: solo el futuro de la historia se puede reordenar.
   */
  async reorderChapters(storyId: string, orderedIds: string[]) {
    await db.transaction(async (tx) => {
      const chapters = await tx.select({ id: storyChapters.id, status: storyChapters.status })
        .from(storyChapters)
        .where(eq(storyChapters.storyId, storyId));

      const byId = new Map(chapters.map((c) => [c.id, c]));
      const unique = new Set(orderedIds);
      if (unique.size !== orderedIds.length || orderedIds.length !== chapters.length || orderedIds.some((id) => !byId.has(id))) {
        throw new ValidationError('La lista de capítulos no coincide con la historia');
      }

      let lastRank = 0;
      for (const id of orderedIds) {
        const rank = STATUS_RANK[byId.get(id)!.status] ?? 2;
        if (rank < lastRank) throw new ValidationError('Solo se pueden reordenar los capítulos que aún no empiezan');
        lastRank = rank;
      }

      const now = new Date();
      for (const [index, id] of orderedIds.entries()) {
        await tx.update(storyChapters)
          .set({ orderIndex: index, updatedAt: now })
          .where(eq(storyChapters.id, id));
      }
    });

    return this.getStory(storyId);
  }

  // ---- SCENES CRUD ----

  async createScene(chapterId: string, data: {
    type: string;
    mediaType?: string;
    mediaUrl?: string;
    backgroundColor?: string;
    triggerConfig?: any;
    dialogues?: Array<{ text: string; speaker?: string; emotion?: string }>;
  }) {
    const sceneId = uuidv4();
    const now = new Date();

    await db.transaction(async (tx) => {
      // Get next order index inside transaction to avoid race conditions
      const existing = await tx.select({ orderIndex: storyScenes.orderIndex })
        .from(storyScenes)
        .where(eq(storyScenes.chapterId, chapterId))
        .orderBy(desc(storyScenes.orderIndex))
        .limit(1);

      const nextOrder = existing.length > 0 ? existing[0].orderIndex + 1 : 0;

      await tx.insert(storyScenes).values({
        id: sceneId,
        chapterId,
        orderIndex: nextOrder,
        type: data.type,
        mediaType: data.mediaType || null,
        mediaUrl: data.mediaUrl || null,
        backgroundColor: data.backgroundColor || null,
        triggerConfig: data.triggerConfig || null,
        createdAt: now,
      });

      // Create dialogues if provided
      if (data.dialogues && data.dialogues.length > 0) {
        await tx.insert(sceneDialogues).values(
          data.dialogues.map((dialogue, index) => ({
            id: uuidv4(),
            sceneId,
            orderIndex: index,
            text: dialogue.text,
            speaker: dialogue.speaker || null,
            emotion: dialogue.emotion || 'neutral',
          }))
        );
      }
    });

    return this.getScene(sceneId);
  }

  async getScene(sceneId: string) {
    const [scene] = await db.select()
      .from(storyScenes)
      .where(eq(storyScenes.id, sceneId));

    if (!scene) throw new Error('Escena no encontrada');

    const dialogues = await db.select()
      .from(sceneDialogues)
      .where(eq(sceneDialogues.sceneId, sceneId))
      .orderBy(asc(sceneDialogues.orderIndex));

    return { ...scene, dialogues };
  }

  async updateScene(sceneId: string, data: {
    type?: string;
    mediaType?: string | null;
    mediaUrl?: string | null;
    backgroundColor?: string | null;
    triggerConfig?: any;
  }) {
    const updateData: any = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.mediaType !== undefined) updateData.mediaType = data.mediaType;
    if (data.mediaUrl !== undefined) updateData.mediaUrl = data.mediaUrl;
    if (data.backgroundColor !== undefined) updateData.backgroundColor = data.backgroundColor;
    if (data.triggerConfig !== undefined) updateData.triggerConfig = data.triggerConfig;

    await db.update(storyScenes).set(updateData).where(eq(storyScenes.id, sceneId));
    return this.getScene(sceneId);
  }

  async deleteScene(sceneId: string) {
    await db.transaction(async (tx) => {
      await tx.delete(sceneDialogues).where(eq(sceneDialogues.sceneId, sceneId));
      await tx.delete(studentSceneViews).where(eq(studentSceneViews.sceneId, sceneId));
      await tx.delete(storyScenes).where(eq(storyScenes.id, sceneId));
    });
  }

  // ---- DIALOGUES CRUD ----

  async setDialogues(sceneId: string, dialogues: Array<{ text: string; speaker?: string; emotion?: string }>) {
    await db.transaction(async (tx) => {
      // Delete existing dialogues
      await tx.delete(sceneDialogues).where(eq(sceneDialogues.sceneId, sceneId));

      // Insert new ones
      if (dialogues.length > 0) {
        await tx.insert(sceneDialogues).values(
          dialogues.map((dialogue, index) => ({
            id: uuidv4(),
            sceneId,
            orderIndex: index,
            text: dialogue.text,
            speaker: dialogue.speaker || null,
            emotion: dialogue.emotion || 'neutral',
          }))
        );
      }
    });

    return this.getScene(sceneId);
  }

  // ---- STUDENT EXPERIENCE ----

  private async getActiveStudentProfileInClassroom(classroomId: string, userId: string) {
    return db.query.studentProfiles.findFirst({
      where: and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.userId, userId),
        eq(studentProfiles.isActive, true)
      ),
      columns: { id: true },
    });
  }

  async getStudentStoryDataForUser(classroomId: string, userId: string) {
    const profile = await this.getActiveStudentProfileInClassroom(classroomId, userId);
    if (!profile) {
      throw new Error('No autorizado para acceder a esta historia');
    }

    return this.getStudentStoryData(classroomId, profile.id);
  }

  async getStudentStoryData(classroomId: string, studentProfileId: string) {
    const [profile] = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.id, studentProfileId),
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true)
      ))
      .limit(1);

    if (!profile) {
      throw new Error('Perfil de estudiante no válido para esta clase');
    }

    const activeStory = await this.getActiveStory(classroomId);
    if (!activeStory) return null;

    const viewedScenes = await db.select({ sceneId: studentSceneViews.sceneId })
      .from(studentSceneViews)
      .where(eq(studentSceneViews.studentProfileId, studentProfileId));
    const viewedSceneIds = new Set(viewedScenes.map(v => v.sceneId));

    // Escenas que se reproducen solas: las desbloqueadas que el alumno aún no vio, salvo el desarrollo
    // (ese se abre a mano). Ya vienen en orden de capítulo y de escena.
    const unseenScenes: any[] = [];
    for (const chapter of activeStory.chapters) {
      for (const scene of chapter.scenes) {
        if (scene.type === 'DESARROLLO' || viewedSceneIds.has(scene.id)) continue;
        if (isSceneUnlocked(scene, chapter)) unseenScenes.push(scene);
      }
    }

    // Capítulos para el alumno: de los bloqueados solo el título; de los demás, solo las escenas desbloqueadas.
    const chaptersInfo = activeStory.chapters.map((chapter: any, index: number) => {
      const base = {
        id: chapter.id,
        title: chapter.title,
        orderIndex: chapter.orderIndex,
        position: index + 1,
        status: chapter.status,
        completionType: chapter.completionType,
        completedAt: chapter.completedAt,
      };
      if (chapter.status === 'LOCKED') {
        return {
          ...base,
          description: null,
          completionConfig: null,
          currentProgress: 0,
          goalReached: false,
          activatedAt: null,
          scenesCount: 0,
          lockedScenes: 0,
          scenes: [],
        };
      }
      const unlocked = chapter.scenes.filter((s: any) => isSceneUnlocked(s, chapter));
      return {
        ...base,
        description: chapter.description,
        completionConfig: parseJson(chapter.completionConfig),
        currentProgress: parseFloat(chapter.currentProgress) || 0,
        goalReached: !!chapter.goalReachedAt,
        activatedAt: chapter.activatedAt,
        scenesCount: unlocked.length,
        lockedScenes: chapter.scenes.length - unlocked.length,
        scenes: unlocked.map((s: any) => ({
          id: s.id,
          type: s.type,
          orderIndex: s.orderIndex,
          hasMedia: !!(s.mediaType && s.mediaUrl),
          dialogueCount: s.dialogues?.length || 0,
          viewed: viewedSceneIds.has(s.id),
          triggerConfig: parseJson(s.triggerConfig),
        })),
      };
    });

    return {
      id: activeStory.id,
      title: activeStory.title,
      description: activeStory.description,
      themeConfig: activeStory.themeConfig,
      chapters: chaptersInfo,
      unseenScenes,
    };
  }

  async markSceneViewed(studentProfileId: string, sceneId: string) {
    // Idempotente: la clave única (alumno, escena) evita duplicados aunque lleguen dos peticiones a la vez.
    await db.insert(studentSceneViews).values({
      id: uuidv4(),
      studentProfileId,
      sceneId,
      viewedAt: new Date(),
    }).onDuplicateKeyUpdate({ set: { sceneId } });
  }

  /** Escena + capítulo + historia, para decidir si un alumno puede verla. */
  private async getSceneAccess(sceneId: string) {
    const [row] = await db.select({
      type: storyScenes.type,
      triggerConfig: storyScenes.triggerConfig,
      status: storyChapters.status,
      completionConfig: storyChapters.completionConfig,
      currentProgress: storyChapters.currentProgress,
      goalReachedAt: storyChapters.goalReachedAt,
      classroomId: stories.classroomId,
      storyActive: stories.isActive,
    })
      .from(storyScenes)
      .innerJoin(storyChapters, eq(storyScenes.chapterId, storyChapters.id))
      .innerJoin(stories, eq(storyChapters.storyId, stories.id))
      .where(eq(storyScenes.id, sceneId))
      .limit(1);
    return row ?? null;
  }

  /** Perfil del alumno si puede ver la escena; si no existe o aún es secreta, "no encontrada". */
  private async requireVisibleScene(sceneId: string, userId: string) {
    const access = await this.getSceneAccess(sceneId);
    if (!access) throw new NotFoundError('Escena no encontrada');

    const profile = await this.getActiveStudentProfileInClassroom(access.classroomId, userId);
    if (!profile) throw new Error('No autorizado para ver esta escena');

    if (!access.storyActive || !isSceneUnlocked(access, access)) throw new NotFoundError('Escena no encontrada');
    return profile;
  }

  async markSceneViewedForUser(userId: string, sceneId: string) {
    const profile = await this.requireVisibleScene(sceneId, userId);
    await this.markSceneViewed(profile.id, sceneId);
  }

  async getSceneForViewing(sceneId: string) {
    return this.getScene(sceneId);
  }

  async getSceneForViewingForUser(sceneId: string, userId: string) {
    await this.requireVisibleScene(sceneId, userId);
    return this.getSceneForViewing(sceneId);
  }

  async getChapterScenesForStudentUser(chapterId: string, userId: string) {
    const [chapter] = await db.select({
      status: storyChapters.status,
      completionConfig: storyChapters.completionConfig,
      currentProgress: storyChapters.currentProgress,
      goalReachedAt: storyChapters.goalReachedAt,
      classroomId: stories.classroomId,
      storyActive: stories.isActive,
    })
      .from(storyChapters)
      .innerJoin(stories, eq(storyChapters.storyId, stories.id))
      .where(eq(storyChapters.id, chapterId))
      .limit(1);

    if (!chapter) throw new NotFoundError('Capítulo no encontrado');

    const profile = await this.getActiveStudentProfileInClassroom(chapter.classroomId, userId);
    if (!profile) {
      throw new Error('No autorizado para ver escenas de este capítulo');
    }
    if (!chapter.storyActive || chapter.status === 'LOCKED') return [];

    const scenes = (await db.select().from(storyScenes)
      .where(eq(storyScenes.chapterId, chapterId))
      .orderBy(asc(storyScenes.orderIndex)))
      .filter((scene) => isSceneUnlocked(scene, chapter));

    if (scenes.length === 0) return [];

    const dialogueRows = await db.select().from(sceneDialogues)
      .where(inArray(sceneDialogues.sceneId, scenes.map((scene) => scene.id)))
      .orderBy(asc(sceneDialogues.sceneId), asc(sceneDialogues.orderIndex));

    const dialoguesByScene = new Map<string, typeof dialogueRows>();
    for (const dialogue of dialogueRows) {
      const rows = dialoguesByScene.get(dialogue.sceneId);
      if (rows) rows.push(dialogue);
      else dialoguesByScene.set(dialogue.sceneId, [dialogue]);
    }

    return scenes.map((scene) => ({
      ...scene,
      dialogues: dialoguesByScene.get(scene.id) ?? [],
    }));
  }

  // ---- CHAPTER PROGRESS ----

  async addDonation(chapterId: string, studentProfileId: string, xpAmount: number) {
    if (xpAmount <= 0) return;

    await db.insert(storyDonations).values({
      id: uuidv4(),
      chapterId,
      studentProfileId,
      xpAmount: xpAmount.toFixed(2),
      createdAt: new Date(),
    });

    await this.updateChapterProgress(chapterId);
  }

  /**
   * Recalcula el avance del capítulo en curso. Al llegar a la meta queda "listo para revelar":
   * ya no se completa solo; el profesor revela el final en clase (completeChapter).
   */
  async updateChapterProgress(chapterId: string) {
    const [chapter] = await db.select({
      id: storyChapters.id,
      status: storyChapters.status,
      completionType: storyChapters.completionType,
      completionConfig: storyChapters.completionConfig,
      progressBaseline: storyChapters.progressBaseline,
      classroomId: stories.classroomId,
    })
      .from(storyChapters)
      .innerJoin(stories, eq(storyChapters.storyId, stories.id))
      .where(eq(storyChapters.id, chapterId));

    if (!chapter || chapter.status !== 'ACTIVE') return;

    let progress: number;
    if (chapter.completionType === 'DONATION') {
      const [result] = await db.select({
        total: sql<string>`COALESCE(SUM(${storyDonations.xpAmount}), 0)`,
      }).from(storyDonations).where(eq(storyDonations.chapterId, chapterId));
      progress = parseFloat(result.total) || 0;
    } else if (chapter.completionType === 'XP_GOAL') {
      // Meta relativa: XP ganado desde que empezó el capítulo (sin base = capítulo antiguo, cuenta desde 0).
      const baseline = parseFloat(chapter.progressBaseline ?? '0') || 0;
      progress = Math.max(0, (await this.classXpTotal(db, chapter.classroomId)) - baseline);
    } else {
      return; // BIMESTER: lo marca el cierre de bimestre
    }

    const target = parseJson<{ targetXp?: number }>(chapter.completionConfig)?.targetXp || 0;
    const now = new Date();
    await db.update(storyChapters)
      .set({
        currentProgress: progress.toFixed(2),
        updatedAt: now,
        ...(target > 0 && progress >= target
          ? { goalReachedAt: sql`COALESCE(${storyChapters.goalReachedAt}, ${sql.param(now, storyChapters.goalReachedAt)})` }
          : {}),
      })
      .where(and(eq(storyChapters.id, chapterId), eq(storyChapters.status, 'ACTIVE')));
  }

  // Al cerrar el bimestre, el capítulo por bimestre en curso queda listo para revelar.
  async onBimesterClosed(classroomId: string) {
    const [activeStory] = await db.select({ id: stories.id })
      .from(stories)
      .where(and(eq(stories.classroomId, classroomId), eq(stories.isActive, true)));
    if (!activeStory) return;

    const now = new Date();
    await db.update(storyChapters)
      .set({ goalReachedAt: sql`COALESCE(${storyChapters.goalReachedAt}, ${sql.param(now, storyChapters.goalReachedAt)})`, updatedAt: now })
      .where(and(
        eq(storyChapters.storyId, activeStory.id),
        eq(storyChapters.status, 'ACTIVE'),
        eq(storyChapters.completionType, 'BIMESTER')
      ));
  }

  // Alumnos con más XP de la clase (capítulos antiguos sin fecha de inicio).
  async getTopXpContributors(classroomId: string, limit: number = 5) {
    const topStudents = await db.select({
      id: studentProfiles.id,
      displayName: studentProfiles.displayName,
      characterClass: studentProfiles.characterClass,
      xp: studentProfiles.xp,
      level: studentProfiles.level,
    })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true),
        eq(studentProfiles.isDemo, false)
      ))
      .orderBy(desc(studentProfiles.xp))
      .limit(limit);

    return topStudents.map((s, i) => ({
      rank: i + 1,
      studentId: s.id,
      displayName: s.displayName,
      characterClass: s.characterClass,
      xp: s.xp,
      level: s.level,
    }));
  }

  // Quienes más XP ganaron mientras el capítulo estuvo en curso (XP neto no revertido).
  async getChapterXpHeroes(classroomId: string, from: Date, to: Date | null, limit: number = 5) {
    const xpNet = sql<string>`COALESCE(SUM(CASE WHEN ${pointLogs.pointType} = 'XP' THEN IF(${pointLogs.action} = 'ADD', ${pointLogs.amount}, -${pointLogs.amount}) ELSE 0 END), 0)`;
    const rows = await db.select({
      id: studentProfiles.id,
      displayName: studentProfiles.displayName,
      characterClass: studentProfiles.characterClass,
      level: studentProfiles.level,
      xp: xpNet,
    })
      .from(pointLogs)
      .innerJoin(studentProfiles, eq(pointLogs.studentId, studentProfiles.id))
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true),
        eq(studentProfiles.isDemo, false),
        eq(pointLogs.isReverted, false),
        gte(pointLogs.createdAt, from),
        ...(to ? [lte(pointLogs.createdAt, to)] : [])
      ))
      .groupBy(studentProfiles.id)
      .orderBy(desc(xpNet))
      .limit(limit);

    return rows
      .map((s) => ({ ...s, xp: Number(s.xp) }))
      .filter((s) => s.xp > 0)
      .map((s, i) => ({
        rank: i + 1,
        studentId: s.id,
        displayName: s.displayName,
        characterClass: s.characterClass,
        xp: s.xp,
        level: s.level,
      }));
  }

  // Get top donors for DONATION chapters
  async getTopDonors(chapterId: string, limit: number = 5) {
    const topDonors = await db.select({
      studentId: storyDonations.studentProfileId,
      totalDonated: sql<string>`SUM(${storyDonations.xpAmount})`,
    })
      .from(storyDonations)
      .where(eq(storyDonations.chapterId, chapterId))
      .groupBy(storyDonations.studentProfileId)
      .orderBy(desc(sql`SUM(${storyDonations.xpAmount})`))
      .limit(limit);

    // Get student details
    const studentIds = topDonors.map(d => d.studentId);
    if (studentIds.length === 0) return [];

    const students = await db.select({
      id: studentProfiles.id,
      displayName: studentProfiles.displayName,
      characterClass: studentProfiles.characterClass,
      level: studentProfiles.level,
    })
      .from(studentProfiles)
      .where(inArray(studentProfiles.id, studentIds));

    const studentMap = new Map(students.map(s => [s.id, s]));

    return topDonors.map((d, i) => {
      const student = studentMap.get(d.studentId);
      return {
        rank: i + 1,
        studentId: d.studentId,
        displayName: student?.displayName || 'Estudiante',
        characterClass: student?.characterClass || 'GUARDIAN',
        level: student?.level || 1,
        donated: parseFloat(d.totalDonated) || 0,
      };
    });
  }

  // Get chapter leaderboard data based on completion type
  async getChapterLeaderboard(chapterId: string) {
    const [chapter] = await db.select({
      id: storyChapters.id,
      completionType: storyChapters.completionType,
      activatedAt: storyChapters.activatedAt,
      completedAt: storyChapters.completedAt,
      classroomId: stories.classroomId,
    })
      .from(storyChapters)
      .innerJoin(stories, eq(storyChapters.storyId, stories.id))
      .where(eq(storyChapters.id, chapterId));

    if (!chapter) throw new NotFoundError('Capítulo no encontrado');

    if (chapter.completionType === 'DONATION') {
      return { type: 'DONATION', leaderboard: await this.getTopDonors(chapterId, 5) };
    }
    if (chapter.completionType === 'XP_GOAL') {
      return {
        type: 'XP_GOAL',
        leaderboard: chapter.activatedAt
          ? await this.getChapterXpHeroes(chapter.classroomId, chapter.activatedAt, chapter.completedAt, 5)
          : await this.getTopXpContributors(chapter.classroomId, 5),
      };
    }
    return { type: chapter.completionType, leaderboard: [] };
  }

  /**
   * Resumen para el cierre celebrado: duración, lo logrado y los héroes del capítulo.
   * Los alumnos solo lo ven de capítulos completados (el profesor, siempre: vista previa del cierre).
   */
  async getChapterRecap(chapterId: string, forStudent: boolean) {
    const [chapter] = await db.select({
      id: storyChapters.id,
      storyId: storyChapters.storyId,
      title: storyChapters.title,
      status: storyChapters.status,
      completionType: storyChapters.completionType,
      completionConfig: storyChapters.completionConfig,
      currentProgress: storyChapters.currentProgress,
      activatedAt: storyChapters.activatedAt,
      completedAt: storyChapters.completedAt,
      classroomId: stories.classroomId,
      storyTitle: stories.title,
    })
      .from(storyChapters)
      .innerJoin(stories, eq(storyChapters.storyId, stories.id))
      .where(eq(storyChapters.id, chapterId));

    if (!chapter || (forStudent && chapter.status !== 'COMPLETED')) throw new NotFoundError('Capítulo no encontrado');

    const siblings = await db.select({ id: storyChapters.id, title: storyChapters.title, status: storyChapters.status })
      .from(storyChapters)
      .where(eq(storyChapters.storyId, chapter.storyId))
      .orderBy(asc(storyChapters.orderIndex));
    const position = siblings.findIndex((c) => c.id === chapter.id) + 1;
    // El siguiente capítulo solo se nombra cuando ya empezó (no adelanta la trama).
    const next = siblings[position];

    const end = chapter.completedAt ?? new Date();
    const days = chapter.activatedAt
      ? Math.max(1, Math.ceil((end.getTime() - chapter.activatedAt.getTime()) / 86_400_000))
      : null;

    const heroes = chapter.completionType === 'DONATION'
      ? await this.getTopDonors(chapter.id, 3)
      : chapter.activatedAt
        ? await this.getChapterXpHeroes(chapter.classroomId, chapter.activatedAt, chapter.completedAt, 3)
        : await this.getTopXpContributors(chapter.classroomId, 3);

    return {
      chapterId: chapter.id,
      title: chapter.title,
      storyTitle: chapter.storyTitle,
      position,
      totalChapters: siblings.length,
      completionType: chapter.completionType,
      target: parseJson<{ targetXp?: number }>(chapter.completionConfig)?.targetXp || 0,
      progress: parseFloat(chapter.currentProgress) || 0,
      days,
      completedAt: chapter.completedAt,
      heroes,
      nextChapterTitle: next && next.status !== 'LOCKED' ? next.title : null,
      isLast: position === siblings.length,
    };
  }

  async getClassroomIdByStory(storyId: string): Promise<string | null> {
    const [story] = await db.select({ classroomId: stories.classroomId })
      .from(stories)
      .where(eq(stories.id, storyId));

    return story?.classroomId ?? null;
  }

  async getClassroomIdByChapter(chapterId: string): Promise<string | null> {
    const [row] = await db.select({ classroomId: stories.classroomId })
      .from(storyChapters)
      .innerJoin(stories, eq(storyChapters.storyId, stories.id))
      .where(eq(storyChapters.id, chapterId));

    return row?.classroomId ?? null;
  }

  async getClassroomIdByScene(sceneId: string): Promise<string | null> {
    const [row] = await db.select({ classroomId: stories.classroomId })
      .from(storyScenes)
      .innerJoin(storyChapters, eq(storyScenes.chapterId, storyChapters.id))
      .innerJoin(stories, eq(storyChapters.storyId, stories.id))
      .where(eq(storyScenes.id, sceneId));

    return row?.classroomId ?? null;
  }

  async verifyTeacherOwnsClassroom(teacherId: string, classroomId: string): Promise<boolean> {
    return teacherOwnsClassroom(teacherId, classroomId);
  }

  async verifyStudentBelongsToClassroom(userId: string, classroomId: string): Promise<boolean> {
    const profile = await this.getActiveStudentProfileInClassroom(classroomId, userId);
    return !!profile;
  }

  // Called when XP is awarded to process donations for DONATION-type chapters
  async onXpAwarded(classroomId: string, studentProfileId: string, xpAmount: number) {
    return this.onXpAwardedBatch(classroomId, [{ studentProfileId, xpAmount }]);
  }

  /**
   * Procesa varias concesiones de XP de la misma clase consultando la historia y sus capítulos
   * una sola vez. Donaciones por alumno; el progreso de XP_GOAL (un SUM) se recalcula una vez.
   */
  async onXpAwardedBatch(classroomId: string, awards: { studentProfileId: string; xpAmount: number }[]) {
    if (awards.length === 0) return;
    const [activeStoryRow] = await db.select()
      .from(stories)
      .where(and(
        eq(stories.classroomId, classroomId),
        eq(stories.isActive, true)
      ));

    if (!activeStoryRow) return;

    // Find active chapter with DONATION type
    const activeChapters = await db.select()
      .from(storyChapters)
      .where(and(
        eq(storyChapters.storyId, activeStoryRow.id),
        eq(storyChapters.status, 'ACTIVE')
      ));

    for (const chapter of activeChapters) {
      if (chapter.completionType === 'DONATION') {
        const config = chapter.completionConfig as any;
        const percent = config?.donationPercent || 0;
        if (percent > 0) {
          for (const { studentProfileId, xpAmount } of awards) {
            const donation = (xpAmount * percent) / 100;
            await this.addDonation(chapter.id, studentProfileId, donation);
          }
        }
      } else if (chapter.completionType === 'XP_GOAL') {
        // Recalcula el progreso desde los totales (idempotente): basta una vez por lote.
        await this.updateChapterProgress(chapter.id);
      }
    }
  }
}

export const storyService = new StoryService();
