import { Request, Response } from 'express';
import { storyService, THEME_PRESETS } from '../services/story.service.js';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

// ==================== VALIDATION SCHEMAS ====================

const themeConfigSchema = z.object({
  colors: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
    background: z.string().optional(),
    sidebar: z.string().optional(),
  }).optional(),
  particles: z.object({
    type: z.string().optional(),
    color: z.string().optional(),
    speed: z.enum(['slow', 'medium', 'fast']).optional(),
    density: z.enum(['low', 'medium', 'high']).optional(),
  }).optional(),
  decorations: z.array(z.object({
    type: z.string(),
    position: z.string(),
    asset: z.string(),
  })).max(3).optional(),
  banner: z.object({
    emoji: z.string().optional(),
    title: z.string().max(100).optional(),
  }).optional(),
}).optional();

const createStorySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  themeConfig: themeConfigSchema,
});

const updateStorySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  themeConfig: themeConfigSchema,
});

const createChapterSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  completionType: z.enum(['BIMESTER', 'XP_GOAL', 'DONATION']),
  completionConfig: z.object({
    targetXp: z.number().min(1).optional(),
    donationPercent: z.number().min(1).max(100).optional(),
  }).optional(),
  themeOverride: themeConfigSchema,
});

const updateChapterSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  completionType: z.enum(['BIMESTER', 'XP_GOAL', 'DONATION']).optional(),
  completionConfig: z.object({
    targetXp: z.number().min(1).optional(),
    donationPercent: z.number().min(1).max(100).optional(),
  }).optional(),
  themeOverride: themeConfigSchema,
});

const createSceneSchema = z.object({
  type: z.enum(['INTRO', 'DESARROLLO', 'OUTRO', 'MILESTONE']),
  mediaType: z.enum(['VIDEO', 'IMAGE']).optional(),
  mediaUrl: z.string().max(500).optional(),
  backgroundColor: z.string().max(7).optional(),
  triggerConfig: z.object({
    percentage: z.number().min(1).max(100),
  }).optional(),
  dialogues: z.array(z.object({
    text: z.string().min(1).max(2000),
    speaker: z.string().max(100).optional(),
    emotion: z.enum(['neutral', 'excited', 'sad', 'angry', 'happy', 'mysterious']).optional(),
  })).optional(),
});

const updateSceneSchema = z.object({
  type: z.enum(['INTRO', 'DESARROLLO', 'OUTRO', 'MILESTONE']).optional(),
  mediaType: z.enum(['VIDEO', 'IMAGE']).nullable().optional(),
  mediaUrl: z.string().max(500).nullable().optional(),
  backgroundColor: z.string().max(7).nullable().optional(),
  triggerConfig: z.object({
    percentage: z.number().min(1).max(100),
  }).nullable().optional(),
});

const setDialoguesSchema = z.object({
  dialogues: z.array(z.object({
    text: z.string().min(1).max(2000),
    speaker: z.string().max(100).optional(),
    emotion: z.enum(['neutral', 'excited', 'sad', 'angry', 'happy', 'mysterious']).optional(),
  })),
});

const ensureTeacherClassroomAccess = async (
  req: Request,
  res: Response,
  classroomId: string
): Promise<string | null> => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ success: false, message: 'No autorizado' });
    return null;
  }

  const isOwner = await storyService.verifyTeacherOwnsClassroom(userId, classroomId);
  if (!isOwner) {
    res.status(403).json({ success: false, message: 'No tienes permiso para esta clase' });
    return null;
  }

  return userId;
};

const ensureTeacherStoryAccess = async (
  req: Request,
  res: Response,
  storyId: string
): Promise<{ userId: string; classroomId: string } | null> => {
  const classroomId = await storyService.getClassroomIdByStory(storyId);
  if (!classroomId) {
    res.status(404).json({ success: false, message: 'Historia no encontrada' });
    return null;
  }

  const userId = await ensureTeacherClassroomAccess(req, res, classroomId);
  if (!userId) return null;

  return { userId, classroomId };
};

const ensureTeacherChapterAccess = async (
  req: Request,
  res: Response,
  chapterId: string
): Promise<{ userId: string; classroomId: string } | null> => {
  const classroomId = await storyService.getClassroomIdByChapter(chapterId);
  if (!classroomId) {
    res.status(404).json({ success: false, message: 'Capítulo no encontrado' });
    return null;
  }

  const userId = await ensureTeacherClassroomAccess(req, res, classroomId);
  if (!userId) return null;

  return { userId, classroomId };
};

const ensureTeacherSceneAccess = async (
  req: Request,
  res: Response,
  sceneId: string
): Promise<{ userId: string; classroomId: string } | null> => {
  const classroomId = await storyService.getClassroomIdByScene(sceneId);
  if (!classroomId) {
    res.status(404).json({ success: false, message: 'Escena no encontrada' });
    return null;
  }

  const userId = await ensureTeacherClassroomAccess(req, res, classroomId);
  if (!userId) return null;

  return { userId, classroomId };
};

// ==================== CONTROLLER ====================

class StoryController {

  // ---- THEME ENDPOINTS ----

  async getThemePresets(_req: Request, res: Response) {
    const presets = Object.entries(THEME_PRESETS).map(([key, value]) => ({
      key,
      name: value.name,
      colors: value.colors,
      particles: value.particles,
      decorations: value.decorations,
      banner: value.banner,
    }));

    res.json({ success: true, data: presets });
  }

  async getClassroomTheme(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const theme = await storyService.getClassroomTheme(classroomId);
      res.json({ success: true, data: theme });
    } catch (error: any) {
      console.error('Error getting classroom theme:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al obtener tema' });
    }
  }

  async updateClassroomTheme(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const userId = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!userId) return;

      const parsed = z.object({
        themeConfig: themeConfigSchema,
        themeSource: z.enum(['DEFAULT', 'PRESET', 'AI', 'STORY']).optional(),
      }).parse(req.body);

      await storyService.updateClassroomTheme(
        classroomId,
        parsed.themeConfig || null,
        parsed.themeSource || 'AI'
      );

      res.json({ success: true, message: 'Tema actualizado' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error updating theme:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al actualizar tema' });
    }
  }

  async applyPreset(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const userId = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!userId) return;

      const { presetKey } = req.body;

      if (!presetKey || typeof presetKey !== 'string') {
        return res.status(400).json({ success: false, message: 'presetKey es requerido' });
      }

      const themeConfig = await storyService.applyPreset(classroomId, presetKey);
      res.json({ success: true, data: themeConfig });
    } catch (error: any) {
      console.error('Error applying preset:', error);
      res.status(400).json({ success: false, message: error.message || 'Error al aplicar preset' });
    }
  }

  async resetTheme(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const userId = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!userId) return;

      await storyService.resetTheme(classroomId);
      res.json({ success: true, message: 'Tema reseteado' });
    } catch (error: any) {
      console.error('Error resetting theme:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al resetear tema' });
    }
  }

  // ---- STORIES ENDPOINTS ----

  async getClassroomStories(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const userId = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!userId) return;

      const data = await storyService.getClassroomStories(classroomId);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Error getting stories:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al obtener historias' });
    }
  }

  async getStory(req: Request, res: Response) {
    try {
      const { storyId } = req.params;
      const access = await ensureTeacherStoryAccess(req, res, storyId);
      if (!access) return;

      const data = await storyService.getStory(storyId);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Error getting story:', error);
      res.status(404).json({ success: false, message: error.message || 'Historia no encontrada' });
    }
  }

  async createStory(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const userId = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!userId) return;

      const parsed = createStorySchema.parse(req.body);
      const data = await storyService.createStory(classroomId, parsed);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error creating story:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al crear historia' });
    }
  }

  async updateStory(req: Request, res: Response) {
    try {
      const { storyId } = req.params;
      const access = await ensureTeacherStoryAccess(req, res, storyId);
      if (!access) return;

      const parsed = updateStorySchema.parse(req.body);
      const data = await storyService.updateStory(storyId, parsed);
      res.json({ success: true, data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error updating story:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al actualizar historia' });
    }
  }

  async activateStory(req: Request, res: Response) {
    try {
      const { storyId } = req.params;
      const access = await ensureTeacherStoryAccess(req, res, storyId);
      if (!access) return;

      const data = await storyService.activateStory(storyId, access.classroomId);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Error activating story:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al activar historia' });
    }
  }

  async deactivateStory(req: Request, res: Response) {
    try {
      const { storyId } = req.params;
      const access = await ensureTeacherStoryAccess(req, res, storyId);
      if (!access) return;

      await storyService.deactivateStory(storyId, access.classroomId);
      res.json({ success: true, message: 'Historia desactivada' });
    } catch (error: any) {
      console.error('Error deactivating story:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al desactivar historia' });
    }
  }

  async deleteStory(req: Request, res: Response) {
    try {
      const { storyId } = req.params;
      const access = await ensureTeacherStoryAccess(req, res, storyId);
      if (!access) return;

      await storyService.deleteStory(storyId);
      res.json({ success: true, message: 'Historia eliminada' });
    } catch (error: any) {
      console.error('Error deleting story:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al eliminar historia' });
    }
  }

  // ---- CHAPTERS ENDPOINTS ----

  async createChapter(req: Request, res: Response) {
    try {
      const { storyId } = req.params;
      const access = await ensureTeacherStoryAccess(req, res, storyId);
      if (!access) return;

      const parsed = createChapterSchema.parse(req.body);
      const data = await storyService.createChapter(storyId, parsed);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error creating chapter:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al crear capítulo' });
    }
  }

  async updateChapter(req: Request, res: Response) {
    try {
      const { chapterId } = req.params;
      const access = await ensureTeacherChapterAccess(req, res, chapterId);
      if (!access) return;

      const parsed = updateChapterSchema.parse(req.body);
      const data = await storyService.updateChapter(chapterId, parsed);
      res.json({ success: true, data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error updating chapter:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al actualizar capítulo' });
    }
  }

  async deleteChapter(req: Request, res: Response) {
    try {
      const { chapterId } = req.params;
      const access = await ensureTeacherChapterAccess(req, res, chapterId);
      if (!access) return;

      await storyService.deleteChapter(chapterId);
      res.json({ success: true, message: 'Capítulo eliminado' });
    } catch (error: any) {
      console.error('Error deleting chapter:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al eliminar capítulo' });
    }
  }

  async completeChapter(req: Request, res: Response) {
    try {
      const { chapterId } = req.params;
      const access = await ensureTeacherChapterAccess(req, res, chapterId);
      if (!access) return;

      const data = await storyService.completeChapter(chapterId);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Error completing chapter:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al completar capítulo' });
    }
  }

  // ---- SCENES ENDPOINTS ----

  async createScene(req: Request, res: Response) {
    try {
      const { chapterId } = req.params;
      const access = await ensureTeacherChapterAccess(req, res, chapterId);
      if (!access) return;

      const parsed = createSceneSchema.parse(req.body);
      const data = await storyService.createScene(chapterId, parsed);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error creating scene:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al crear escena' });
    }
  }

  async updateScene(req: Request, res: Response) {
    try {
      const { sceneId } = req.params;
      const access = await ensureTeacherSceneAccess(req, res, sceneId);
      if (!access) return;

      const parsed = updateSceneSchema.parse(req.body);
      const data = await storyService.updateScene(sceneId, {
        type: parsed.type,
        mediaType: parsed.mediaType ?? undefined,
        mediaUrl: parsed.mediaUrl ?? undefined,
        backgroundColor: parsed.backgroundColor ?? undefined,
        triggerConfig: parsed.triggerConfig ?? undefined,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error updating scene:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al actualizar escena' });
    }
  }

  async deleteScene(req: Request, res: Response) {
    try {
      const { sceneId } = req.params;
      const access = await ensureTeacherSceneAccess(req, res, sceneId);
      if (!access) return;

      await storyService.deleteScene(sceneId);
      res.json({ success: true, message: 'Escena eliminada' });
    } catch (error: any) {
      console.error('Error deleting scene:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al eliminar escena' });
    }
  }

  async setDialogues(req: Request, res: Response) {
    try {
      const { sceneId } = req.params;
      const access = await ensureTeacherSceneAccess(req, res, sceneId);
      if (!access) return;

      const parsed = setDialoguesSchema.parse(req.body);
      const data = await storyService.setDialogues(sceneId, parsed.dialogues);
      res.json({ success: true, data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error setting dialogues:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al actualizar diálogos' });
    }
  }

  // ---- STUDENT ENDPOINTS ----

  async getStudentStoryData(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
      }

      const data = await storyService.getStudentStoryDataForUser(classroomId, userId);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Error getting student story data:', error);
      if (error.message?.includes('No autorizado')) {
        return res.status(403).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: error.message || 'Error al obtener datos de historia' });
    }
  }

  async markSceneViewed(req: Request, res: Response) {
    try {
      const { sceneId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
      }

      await storyService.markSceneViewedForUser(userId, sceneId);
      res.json({ success: true, message: 'Escena marcada como vista' });
    } catch (error: any) {
      console.error('Error marking scene viewed:', error);
      if (error.message?.includes('No autorizado')) {
        return res.status(403).json({ success: false, message: error.message });
      }
      if (error.message?.includes('no encontrada')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: error.message || 'Error al marcar escena' });
    }
  }

  async getSceneForViewing(req: Request, res: Response) {
    try {
      const { sceneId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
      }

      const data = await storyService.getSceneForViewingForUser(sceneId, userId);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Error getting scene:', error);
      if (error.message?.includes('No autorizado')) {
        return res.status(403).json({ success: false, message: error.message });
      }
      res.status(404).json({ success: false, message: error.message || 'Escena no encontrada' });
    }
  }

  async getChapterScenesForStudent(req: Request, res: Response) {
    try {
      const { chapterId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
      }

      const data = await storyService.getChapterScenesForStudentUser(chapterId, userId);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Error getting chapter scenes:', error);
      if (error.message?.includes('No autorizado')) {
        return res.status(403).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: error.message || 'Error al obtener escenas' });
    }
  }

  async getChapterLeaderboard(req: Request, res: Response) {
    try {
      const { chapterId } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
      }

      const classroomId = await storyService.getClassroomIdByChapter(chapterId);
      if (!classroomId) {
        return res.status(404).json({ success: false, message: 'Capítulo no encontrado' });
      }

      if (user.role === 'TEACHER') {
        const isOwner = await storyService.verifyTeacherOwnsClassroom(user.id, classroomId);
        if (!isOwner) {
          return res.status(403).json({ success: false, message: 'No tienes permiso para esta clase' });
        }
      } else if (user.role === 'STUDENT') {
        const belongsToClassroom = await storyService.verifyStudentBelongsToClassroom(user.id, classroomId);
        if (!belongsToClassroom) {
          return res.status(403).json({ success: false, message: 'No autorizado para ver este leaderboard' });
        }
      } else {
        return res.status(403).json({ success: false, message: 'No tienes permisos para esta acción' });
      }

      const data = await storyService.getChapterLeaderboard(chapterId);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Error getting chapter leaderboard:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al obtener leaderboard' });
    }
  }

  async generateAIScene(req: Request, res: Response) {
    try {
      const { description, sceneType, storyContext, mode } = req.body;

      if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Se requiere una descripción de la escena' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ success: false, message: 'API Key de Gemini no configurada' });
      }

      const ai = new GoogleGenAI({ apiKey });

      if (mode === 'image_prompt') {
        // Generate an image generation prompt for external platforms (Midjourney, DALL-E, etc.)
        const prompt = `Eres un experto en crear prompts para generadores de imágenes con IA (Midjourney, DALL-E, Stable Diffusion).

El profesor quiere una imagen para una escena de storytelling educativo.

TIPO DE ESCENA: ${sceneType || 'INTRO'}
CONTEXTO DE LA HISTORIA: ${storyContext ? `"${storyContext}"` : 'Historia educativa gamificada'}
DESCRIPCIÓN DE LA ESCENA: "${description.trim()}"

Genera UN prompt en inglés optimizado para generadores de imágenes. El prompt debe:
1. Ser descriptivo y visual (colores, iluminación, estilo artístico)
2. Ser apropiado para un contexto educativo infantil/juvenil
3. Incluir estilo artístico (ej: "digital art, fantasy illustration, vibrant colors")
4. Tener entre 50-120 palabras
5. NO incluir texto, letras ni palabras dentro de la imagen

Responde ÚNICAMENTE con el prompt en inglés, sin explicaciones ni comillas.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
        });

        const imagePrompt = (response.text || '').trim();
        if (!imagePrompt) {
          return res.status(500).json({ success: false, message: 'La IA no generó contenido' });
        }

        return res.json({ success: true, data: { imagePrompt } });

      } else if (mode === 'dialogues') {
        // Generate dialogues for the scene
        const prompt = `Eres un escritor creativo para una plataforma educativa gamificada. Debes escribir diálogos para una escena de storytelling.

TIPO DE ESCENA: ${sceneType || 'INTRO'}
CONTEXTO DE LA HISTORIA: ${storyContext ? `"${storyContext}"` : 'Historia educativa gamificada'}
DESCRIPCIÓN DE LA ESCENA: "${description.trim()}"

Genera entre 2 y 4 diálogos narrativos para esta escena. Los diálogos deben:
1. Ser apropiados para estudiantes de secundaria/preparatoria
2. Ser emocionantes, narrativos y enganchar al estudiante
3. Tener un narrador o personajes con nombres creativos
4. Usar ÚNICAMENTE una de estas emociones: "neutral", "excited", "sad", "angry", "happy", "mysterious"

IMPORTANTE: El campo "emotion" SOLO puede tener uno de estos 6 valores exactos: neutral, excited, sad, angry, happy, mysterious. NO uses otras emociones.

Responde ÚNICAMENTE con un JSON válido, sin texto adicional:
[
  { "speaker": "Narrador", "text": "...", "emotion": "neutral" },
  { "speaker": "Personaje", "text": "...", "emotion": "excited" }
]`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
        });

        const responseText = (response.text || '').trim();
        if (!responseText) {
          return res.status(500).json({ success: false, message: 'La IA no generó contenido' });
        }

        let dialogues;
        try {
          let clean = responseText;
          if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
          dialogues = JSON.parse(clean);
        } catch {
          return res.status(500).json({ success: false, message: 'Error al procesar la respuesta de la IA' });
        }

        // Sanitize emotions to only allowed values
        const allowedEmotions = ['neutral', 'excited', 'sad', 'angry', 'happy', 'mysterious'];
        if (Array.isArray(dialogues)) {
          dialogues = dialogues.map((d: any) => ({
            ...d,
            emotion: allowedEmotions.includes(d.emotion) ? d.emotion : 'neutral'
          }));
        }

        return res.json({ success: true, data: { dialogues } });

      } else if (mode === 'full_scene') {
        // Generate both image prompt and dialogues
        const prompt = `Eres un escritor creativo y diseñador visual para una plataforma educativa gamificada.

TIPO DE ESCENA: ${sceneType || 'INTRO'}
CONTEXTO DE LA HISTORIA: ${storyContext ? `"${storyContext}"` : 'Historia educativa gamificada'}
DESCRIPCIÓN DE LA ESCENA: "${description.trim()}"

Genera una escena completa con:
1. Un prompt de imagen en inglés para generadores de IA (Midjourney/DALL-E), 50-120 palabras, estilo artístico, sin texto en la imagen
2. Entre 2 y 6 diálogos narrativos en español para estudiantes
3. Usa ÚNICAMENTE una de estas emociones para cada diálogo: "neutral", "excited", "sad", "angry", "happy", "mysterious"

IMPORTANTE: El campo "emotion" SOLO puede tener uno de estos 6 valores exactos: neutral, excited, sad, angry, happy, mysterious. NO uses otras emociones.

Responde ÚNICAMENTE con un JSON válido:
{
  "imagePrompt": "...",
  "dialogues": [
    { "speaker": "Narrador", "text": "...", "emotion": "neutral" }
  ]
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
        });

        const responseText = (response.text || '').trim();
        if (!responseText) {
          return res.status(500).json({ success: false, message: 'La IA no generó contenido' });
        }

        let result;
        try {
          let clean = responseText;
          if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
          result = JSON.parse(clean);
        } catch {
          return res.status(500).json({ success: false, message: 'Error al procesar la respuesta de la IA' });
        }

        // Sanitize emotions to only allowed values
        const allowedEmotions = ['neutral', 'excited', 'sad', 'angry', 'happy', 'mysterious'];
        if (result.dialogues && Array.isArray(result.dialogues)) {
          result.dialogues = result.dialogues.map((d: any) => ({
            ...d,
            emotion: allowedEmotions.includes(d.emotion) ? d.emotion : 'neutral'
          }));
        }

        return res.json({ success: true, data: result });
      }

      return res.status(400).json({ success: false, message: 'Modo no válido. Use: image_prompt, dialogues, full_scene' });

    } catch (error: any) {
      console.error('Error generating AI scene:', error);
      res.status(500).json({ success: false, message: 'Error al generar contenido con IA' });
    }
  }

  async generateAITheme(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const userId = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!userId) return;

      const { description } = req.body;

      if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Se requiere una descripción del tema' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ success: false, message: 'API Key de Gemini no configurada' });
      }

      const prompt = `Eres un diseñador de temas visuales para una plataforma educativa gamificada. El profesor quiere un tema visual personalizado para su aula.

DESCRIPCIÓN DEL PROFESOR:
"${description.trim()}"

Genera un tema visual completo basado en la descripción. El tema debe ser visualmente atractivo y coherente.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni bloques de código:

{
  "name": "Nombre corto del tema (máx 20 caracteres)",
  "colors": {
    "primary": "#hexcolor (color principal, vibrante)",
    "secondary": "#hexcolor (color secundario, complementario)",
    "accent": "#hexcolor (color de acento, para detalles)",
    "background": "#hexcolor (fondo del contenido, claro u oscuro según el tema)",
    "sidebar": "#hexcolor (fondo del sidebar, oscuro)"
  },
  "particles": {
    "type": "uno de los tipos válidos (ver lista abajo)",
    "color": "#hexcolor (color de las partículas, coherente con el tema)",
    "speed": "slow|medium|fast",
    "density": "low|medium|high"
  },
  "banner": {
    "emoji": "un emoji representativo del tema",
    "title": "Título del tema"
  }
}

TIPOS DE PARTÍCULAS VÁLIDOS (elige el más coherente con el tema):
- "stars" → estrellas brillantes (espacio, noche, magia)
- "snow" → copos de nieve (invierno, navidad, hielo)
- "petals" → pétalos de flores (primavera, jardín, romance)
- "sparkles" → destellos mágicos (fantasía, hadas, celebración)
- "bubbles" → burbujas que suben (océano, agua, submarino)
- "fireflies" → luciérnagas brillantes (bosque, noche, naturaleza)
- "smoke" → humo difuso que sube (volcán, fuego, misterio, niebla)
- "embers" → brasas incandescentes que suben (volcán, forja, dragones, fuego)
- "ash" → ceniza que cae lentamente (volcán, apocalipsis, otoño oscuro)
- "dust" → polvo flotante (desierto, ruinas, antigüedad, western)
- "lava" → gotas de lava brillante que suben (volcán, infierno, magma)
- "hearts" → corazones flotantes (amor, San Valentín, amistad)
- "confetti" → confeti colorido que cae (fiesta, celebración, carnaval)
- "rain" → lluvia que cae (tormenta, selva, melancolía)
- "leaves" → hojas que caen (otoño, bosque, naturaleza)
- "swords" → espadas que caen girando (medieval, caballeros, batallas, RPG)
- "math" → símbolos matemáticos cayendo: +, −, ×, ÷, π, √, ∑, ∞ (matemáticas, números, álgebra, geometría)
- "computing" → código binario y símbolos: 0, 1, {}, </> (informática, programación, robótica, tecnología)
- "science" → átomos con órbitas de electrones (ciencias, química, física, biología, laboratorio)
- "religion" → cruces que caen suavemente (religión, fe, espiritualidad, iglesia)

REGLAS:
1. Los colores deben ser armónicos y visualmente atractivos
2. Si el tema es oscuro/nocturno, background debe ser oscuro (#0D0D2B, #1A1A2E, etc.) y sidebar más oscuro
3. Si el tema es claro/diurno, background debe ser claro (#E8F5E9, #FFF3E0, etc.) y sidebar oscuro
4. El sidebar SIEMPRE debe ser oscuro para buena legibilidad
5. El emoji debe representar bien la temática
6. IMPORTANTE: Elige el tipo de partícula que MEJOR represente la descripción del profesor. Si menciona humo, usa "smoke". Si menciona ceniza, usa "ash". Si menciona fuego/volcán, usa "embers" o "lava".
7. El color de las partículas debe ser coherente (humo=gris, brasas=naranja/rojo, nieve=blanco, etc.)
8. Nombre en español`;

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });

      const responseText = response.text || '';

      if (!responseText.trim()) {
        return res.status(500).json({ success: false, message: 'La IA no generó contenido' });
      }

      let parsedData;
      try {
        let cleanText = responseText.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        parsedData = JSON.parse(cleanText);
      } catch (parseError) {
        console.error('Error parsing AI theme response:', responseText);
        return res.status(500).json({ success: false, message: 'Error al procesar la respuesta de la IA' });
      }

      // Build themeConfig from AI response
      const themeConfig = {
        colors: parsedData.colors,
        particles: parsedData.particles,
        decorations: [] as any[],
        banner: parsedData.banner,
      };

      // Apply the theme to the classroom
      await storyService.updateClassroomTheme(classroomId, themeConfig, 'AI');

      res.json({
        success: true,
        data: {
          name: parsedData.name,
          themeConfig,
        },
      });

    } catch (error: any) {
      console.error('Error generating AI theme:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al generar tema con IA' });
    }
  }
}

export const storyController = new StoryController();
