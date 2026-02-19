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
} from '../db/schema.js';
import { eq, and, asc, desc, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

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
      }).from(storyChapters).where(eq(storyChapters.storyId, story.id));

      return {
        ...story,
        chapterCount: chapters.length,
        activeChapters: chapters.filter(c => c.status === 'ACTIVE').length,
        completedChapters: chapters.filter(c => c.status === 'COMPLETED').length,
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
    const updateData: any = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.themeConfig !== undefined) updateData.themeConfig = data.themeConfig;

    await db.update(stories).set(updateData).where(eq(stories.id, storyId));
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
    let isFirst = false;

    await db.transaction(async (tx) => {
      // Get next order index inside transaction to avoid race conditions
      const existing = await tx.select({ orderIndex: storyChapters.orderIndex })
        .from(storyChapters)
        .where(eq(storyChapters.storyId, storyId))
        .orderBy(desc(storyChapters.orderIndex))
        .limit(1);

      const nextOrder = existing.length > 0 ? existing[0].orderIndex + 1 : 0;

      // First chapter is automatically ACTIVE
      isFirst = nextOrder === 0;

      await tx.insert(storyChapters).values({
        id,
        storyId,
        title: data.title,
        description: data.description || null,
        orderIndex: nextOrder,
        status: isFirst ? 'ACTIVE' : 'LOCKED',
        completionType: data.completionType,
        completionConfig: data.completionConfig || null,
        currentProgress: '0',
        themeOverride: data.themeOverride || null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // If the chapter is ACTIVE and has XP_GOAL, calculate initial progress from existing XP
    if (isFirst && data.completionType === 'XP_GOAL') {
      await this.updateChapterProgress(id);
    }

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
    const updateData: any = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.completionType !== undefined) updateData.completionType = data.completionType;
    if (data.completionConfig !== undefined) updateData.completionConfig = data.completionConfig;
    if (data.themeOverride !== undefined) updateData.themeOverride = data.themeOverride;

    await db.update(storyChapters).set(updateData).where(eq(storyChapters.id, chapterId));
    return this.getChapter(chapterId);
  }

  async deleteChapter(chapterId: string) {
    await db.transaction(async (tx) => {
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
    });
  }

  async completeChapter(chapterId: string) {
    const now = new Date();

    await db.transaction(async (tx) => {
      const [chapter] = await tx.select({
        id: storyChapters.id,
        storyId: storyChapters.storyId,
        orderIndex: storyChapters.orderIndex,
      })
        .from(storyChapters)
        .where(eq(storyChapters.id, chapterId));

      if (!chapter) {
        throw new Error('Capítulo no encontrado');
      }

      // Mark as completed
      await tx.update(storyChapters)
        .set({ status: 'COMPLETED', completedAt: now, updatedAt: now })
        .where(eq(storyChapters.id, chapterId));

      // Unlock next chapter
      const [nextChapter] = await tx.select({ id: storyChapters.id })
        .from(storyChapters)
        .where(and(
          eq(storyChapters.storyId, chapter.storyId),
          eq(storyChapters.orderIndex, chapter.orderIndex + 1)
        ));

      if (nextChapter) {
        await tx.update(storyChapters)
          .set({ status: 'ACTIVE', updatedAt: now })
          .where(eq(storyChapters.id, nextChapter.id));
      }
    });

    return this.getChapter(chapterId);
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
    mediaType?: string;
    mediaUrl?: string;
    backgroundColor?: string;
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

    // Get all scene IDs for this story
    const allSceneIds: string[] = [];
    for (const chapter of activeStory.chapters) {
      for (const scene of chapter.scenes) {
        allSceneIds.push(scene.id);
      }
    }

    // Get viewed scenes for this student
    const viewedScenes = allSceneIds.length > 0
      ? await db.select({ sceneId: studentSceneViews.sceneId })
          .from(studentSceneViews)
          .where(eq(studentSceneViews.studentProfileId, studentProfileId))
      : [];

    const viewedSceneIds = new Set(viewedScenes.map(v => v.sceneId));

    // Find auto-trigger scenes from ACTIVE chapters:
    // - INTRO: auto-play if unseen
    // - MILESTONE: auto-play if unseen AND progress >= triggerConfig.percentage
    // - OUTRO: auto-play if unseen AND chapter is COMPLETED
    const unseenScenes: any[] = [];
    for (const chapter of activeStory.chapters) {
      if (chapter.status === 'LOCKED') continue;
      const progress = parseFloat(chapter.currentProgress as any) || 0;
      const config = typeof chapter.completionConfig === 'string'
        ? (() => { try { return JSON.parse(chapter.completionConfig); } catch { return null; } })()
        : chapter.completionConfig;
      const target = config?.targetXp || 0;
      const progressPercent = target > 0 ? (progress / target) * 100 : 0;

      for (const scene of chapter.scenes) {
        if (viewedSceneIds.has(scene.id)) continue;

        if (scene.type === 'INTRO' && chapter.status === 'ACTIVE') {
          unseenScenes.push(scene);
        } else if (scene.type === 'MILESTONE' && chapter.status === 'ACTIVE') {
          const tc = typeof scene.triggerConfig === 'string'
            ? (() => { try { return JSON.parse(scene.triggerConfig); } catch { return null; } })()
            : scene.triggerConfig;
          const threshold = tc?.percentage || 0;
          if (threshold > 0 && progressPercent >= threshold) {
            unseenScenes.push(scene);
          }
        } else if (scene.type === 'OUTRO' && chapter.status === 'COMPLETED') {
          unseenScenes.push(scene);
        }
        // DESARROLLO scenes are NOT auto-triggered — student views them manually
      }
    }

    // Build chapter progress info (no spoilers for locked chapters)
    // Include scene summaries for non-locked chapters so student can see DESARROLLO scenes
    const chaptersInfo = activeStory.chapters.map((chapter: any) => {
      if (chapter.status === 'LOCKED') {
        return {
          id: chapter.id,
          title: chapter.title,
          description: null,
          orderIndex: chapter.orderIndex,
          status: chapter.status,
          completionType: chapter.completionType,
          completionConfig: null,
          currentProgress: 0,
          completedAt: chapter.completedAt,
          scenesCount: 0,
          scenes: [],
        };
      }
      return {
        id: chapter.id,
        title: chapter.title,
        description: chapter.description,
        orderIndex: chapter.orderIndex,
        status: chapter.status,
        completionType: chapter.completionType,
        completionConfig: chapter.completionConfig,
        currentProgress: parseFloat(chapter.currentProgress),
        completedAt: chapter.completedAt,
        scenesCount: chapter.scenes.length,
        scenes: chapter.scenes.map((s: any) => ({
          id: s.id,
          type: s.type,
          orderIndex: s.orderIndex,
          hasMedia: !!(s.mediaType && s.mediaUrl),
          dialogueCount: s.dialogues?.length || 0,
          viewed: viewedSceneIds.has(s.id),
          triggerConfig: s.triggerConfig,
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
    // Check if already viewed
    const existing = await db.select()
      .from(studentSceneViews)
      .where(and(
        eq(studentSceneViews.studentProfileId, studentProfileId),
        eq(studentSceneViews.sceneId, sceneId)
      ));

    if (existing.length > 0) return;

    await db.insert(studentSceneViews).values({
      id: uuidv4(),
      studentProfileId,
      sceneId,
      viewedAt: new Date(),
    });
  }

  async markSceneViewedForUser(userId: string, sceneId: string) {
    const [sceneClassroom] = await db.select({
      classroomId: stories.classroomId,
    })
      .from(storyScenes)
      .innerJoin(storyChapters, eq(storyScenes.chapterId, storyChapters.id))
      .innerJoin(stories, eq(storyChapters.storyId, stories.id))
      .where(eq(storyScenes.id, sceneId))
      .limit(1);

    if (!sceneClassroom) {
      throw new Error('Escena no encontrada');
    }

    const profile = await this.getActiveStudentProfileInClassroom(sceneClassroom.classroomId, userId);
    if (!profile) {
      throw new Error('No autorizado para marcar esta escena');
    }

    await this.markSceneViewed(profile.id, sceneId);
  }

  async getSceneForViewing(sceneId: string) {
    return this.getScene(sceneId);
  }

  async getSceneForViewingForUser(sceneId: string, userId: string) {
    const [sceneClassroom] = await db.select({
      classroomId: stories.classroomId,
    })
      .from(storyScenes)
      .innerJoin(storyChapters, eq(storyScenes.chapterId, storyChapters.id))
      .innerJoin(stories, eq(storyChapters.storyId, stories.id))
      .where(eq(storyScenes.id, sceneId))
      .limit(1);

    if (!sceneClassroom) {
      throw new Error('Escena no encontrada');
    }

    const profile = await this.getActiveStudentProfileInClassroom(sceneClassroom.classroomId, userId);
    if (!profile) {
      throw new Error('No autorizado para ver esta escena');
    }

    return this.getSceneForViewing(sceneId);
  }

  async getChapterScenesForStudent(chapterId: string) {
    const chapter = await db.query.storyChapters.findFirst({
      where: eq(storyChapters.id, chapterId),
    });
    if (!chapter || chapter.status === 'LOCKED') return [];

    const scenes = await db.select().from(storyScenes)
      .where(eq(storyScenes.chapterId, chapterId))
      .orderBy(asc(storyScenes.orderIndex));

    if (scenes.length === 0) {
      return [];
    }

    const sceneIds = scenes.map((scene) => scene.id);
    const dialogueRows = await db.select().from(sceneDialogues)
      .where(inArray(sceneDialogues.sceneId, sceneIds))
      .orderBy(asc(sceneDialogues.sceneId), asc(sceneDialogues.orderIndex));

    const dialoguesByScene = new Map<string, typeof dialogueRows>();
    for (const dialogue of dialogueRows) {
      const rows = dialoguesByScene.get(dialogue.sceneId);
      if (rows) {
        rows.push(dialogue);
      } else {
        dialoguesByScene.set(dialogue.sceneId, [dialogue]);
      }
    }

    return scenes.map((scene) => ({
      ...scene,
      dialogues: dialoguesByScene.get(scene.id) ?? [],
    }));
  }

  async getChapterScenesForStudentUser(chapterId: string, userId: string) {
    const [chapterClassroom] = await db.select({
      classroomId: stories.classroomId,
    })
      .from(storyChapters)
      .innerJoin(stories, eq(storyChapters.storyId, stories.id))
      .where(eq(storyChapters.id, chapterId))
      .limit(1);

    if (!chapterClassroom) {
      throw new Error('Capítulo no encontrado');
    }

    const profile = await this.getActiveStudentProfileInClassroom(chapterClassroom.classroomId, userId);
    if (!profile) {
      throw new Error('No autorizado para ver escenas de este capítulo');
    }

    return this.getChapterScenesForStudent(chapterId);
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

    // Update chapter progress
    await this.updateChapterProgress(chapterId);
  }

  async updateChapterProgress(chapterId: string) {
    const [chapter] = await db.select()
      .from(storyChapters)
      .where(eq(storyChapters.id, chapterId));

    if (!chapter || chapter.status !== 'ACTIVE') return;

    if (chapter.completionType === 'DONATION') {
      // Sum all donations
      const [result] = await db.select({
        total: sql<string>`COALESCE(SUM(${storyDonations.xpAmount}), 0)`,
      }).from(storyDonations).where(eq(storyDonations.chapterId, chapterId));

      const totalDonated = parseFloat(result.total) || 0;
      const target = (chapter.completionConfig as any)?.targetXp || 0;

      await db.update(storyChapters)
        .set({ currentProgress: totalDonated.toFixed(2), updatedAt: new Date() })
        .where(eq(storyChapters.id, chapterId));

      // Auto-complete if target reached
      if (target > 0 && totalDonated >= target) {
        await this.completeChapter(chapterId);
      }
    } else if (chapter.completionType === 'XP_GOAL') {
      // Sum total XP of all students in the classroom
      const [story] = await db.select({ classroomId: stories.classroomId })
        .from(stories).where(eq(stories.id, chapter.storyId));

      if (story) {
        const [result] = await db.select({
          total: sql<string>`COALESCE(SUM(${studentProfiles.xp}), 0)`,
        }).from(studentProfiles).where(and(
          eq(studentProfiles.classroomId, story.classroomId),
          eq(studentProfiles.isActive, true)
        ));

        const totalXp = parseFloat(result.total) || 0;
        const target = (chapter.completionConfig as any)?.targetXp || 0;

        await db.update(storyChapters)
          .set({ currentProgress: totalXp.toFixed(2), updatedAt: new Date() })
          .where(eq(storyChapters.id, chapterId));

        if (target > 0 && totalXp >= target) {
          await this.completeChapter(chapterId);
        }
      }
    }
    // BIMESTER type is handled externally when bimester closes
  }

  // Called when a bimester is closed - completes BIMESTER-type active chapters
  async onBimesterClosed(classroomId: string) {
    const activeStory = await this.getActiveStory(classroomId);
    if (!activeStory) return;

    for (const chapter of activeStory.chapters) {
      if (chapter.status === 'ACTIVE' && chapter.completionType === 'BIMESTER') {
        await this.completeChapter(chapter.id);
      }
    }
  }

  // Get top XP contributors for XP_GOAL chapters (students with most XP in classroom)
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
    const [chapter] = await db.select()
      .from(storyChapters)
      .where(eq(storyChapters.id, chapterId));

    if (!chapter) throw new Error('Capítulo no encontrado');

    const [story] = await db.select({ classroomId: stories.classroomId })
      .from(stories)
      .where(eq(stories.id, chapter.storyId));

    if (!story) throw new Error('Historia no encontrada');

    if (chapter.completionType === 'XP_GOAL') {
      return {
        type: 'XP_GOAL',
        leaderboard: await this.getTopXpContributors(story.classroomId, 5),
      };
    } else if (chapter.completionType === 'DONATION') {
      return {
        type: 'DONATION',
        leaderboard: await this.getTopDonors(chapterId, 5),
      };
    }

    return { type: chapter.completionType, leaderboard: [] };
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
    const [classroom] = await db.select({ id: classrooms.id })
      .from(classrooms)
      .where(and(
        eq(classrooms.id, classroomId),
        eq(classrooms.teacherId, teacherId)
      ));

    return !!classroom;
  }

  async verifyStudentBelongsToClassroom(userId: string, classroomId: string): Promise<boolean> {
    const profile = await this.getActiveStudentProfileInClassroom(classroomId, userId);
    return !!profile;
  }

  // Called when XP is awarded to process donations for DONATION-type chapters
  async onXpAwarded(classroomId: string, studentProfileId: string, xpAmount: number) {
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
          const donation = (xpAmount * percent) / 100;
          await this.addDonation(chapter.id, studentProfileId, donation);
        }
      } else if (chapter.completionType === 'XP_GOAL') {
        await this.updateChapterProgress(chapter.id);
      }
    }
  }
}

export const storyService = new StoryService();
