import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { collectibleService } from '../services/collectible.service.js';
import { db } from '../db/index.js';
import { studentProfiles, collectibleAlbums } from '../db/schema.js';
import type { CardRarity, PackType, ImageStyle } from '../db/schema.js';
import {
  requireClassroomTeacher,
  requireClassroomMember,
  requireResourceTeacher,
  requireResourceMember,
  requireStudentProfileReadAccess,
  classroomIdOfAlbum,
  classroomIdOfCard,
  classroomIdOfStudentProfile,
  badgeScopeAndClassroom,
  pickFields,
} from '../utils/access.js';

// Campos que el profesor puede fijar en álbumes y cartas (classroomId/albumId salen de la ruta).
const ALBUM_FIELDS = [
  'name', 'description', 'coverImage', 'theme', 'imageStyle',
  'singlePackPrice', 'fivePackPrice', 'tenPackPrice',
  'rewardXp', 'rewardHp', 'rewardGp', 'rewardBadgeId', 'allowTrades',
] as const;
const ALBUM_UPDATE_FIELDS = [...ALBUM_FIELDS, 'isActive'] as const;
// La insignia de premio debe ser del sistema o de la misma clase del álbum.
const isValidRewardBadge = async (rewardBadgeId: unknown, classroomId: string): Promise<boolean> => {
  if (rewardBadgeId === undefined || rewardBadgeId === null || rewardBadgeId === '') return true;
  if (typeof rewardBadgeId !== 'string') return false;
  const badge = await badgeScopeAndClassroom(rewardBadgeId);
  return !!badge && (badge.scope === 'SYSTEM' || badge.classroomId === classroomId);
};

const CARD_FIELDS = ['name', 'description', 'imageUrl', 'icon', 'rarity', 'slotNumber'] as const;

// Imágenes solo subidas a la plataforma (POST /collectibles/upload-image): nada de URLs externas.
const imageRef = z.string().regex(/^\/api\/uploads\/collectibles\/[\w.-]+$/, 'Imagen no válida');
const gp = z.number().int().min(0, 'El precio no puede ser negativo').max(100000, 'El precio es demasiado alto');
const reward = z.number().int().min(0, 'La recompensa no puede ser negativa').max(1000, 'La recompensa es demasiado alta');
const albumSchema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre').max(100, 'El nombre es demasiado largo'),
  description: z.string().trim().max(500).nullable().optional(),
  coverImage: imageRef.nullable().optional(),
  theme: z.string().trim().max(255).nullable().optional(),
  imageStyle: z.enum(['CARTOON', 'REALISTIC', 'PIXEL_ART', 'ANIME', 'WATERCOLOR', 'MINIMALIST']).optional(),
  singlePackPrice: gp.optional(),
  fivePackPrice: gp.optional(),
  tenPackPrice: gp.optional(),
  rewardXp: reward.optional(),
  rewardHp: reward.optional(),
  rewardGp: reward.optional(),
  rewardBadgeId: z.string().uuid().nullable().optional(),
  allowTrades: z.boolean().optional(),
});
const albumUpdateSchema = albumSchema.partial().extend({ isActive: z.boolean().optional() });
const cardSchema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre').max(100, 'El nombre es demasiado largo'),
  description: z.string().trim().max(300).nullable().optional(),
  imageUrl: imageRef.nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  rarity: z.enum(['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']).optional(),
  slotNumber: z.number().int().min(1).max(1000).optional(),
});
const cardBatchSchema = z.object({ cards: z.array(cardSchema.omit({ slotNumber: true })).min(1).max(60) });
const invalid = (res: Response, error: z.ZodError) =>
  res.status(400).json({ message: error.errors[0]?.message || 'Datos inválidos', errors: error.errors });

export const collectibleController = {
  // ==================== ÁLBUMES ====================

  async createAlbum(req: Request, res: Response, next: NextFunction) {
    try {
      const { classroomId } = req.params;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      const parsed = albumSchema.safeParse(req.body);
      if (!parsed.success) return invalid(res, parsed.error);
      const data = pickFields(parsed.data as Record<string, unknown>, ALBUM_FIELDS);
      if (!(await isValidRewardBadge(data.rewardBadgeId, classroomId))) {
        return res.status(400).json({ message: 'La insignia de premio no pertenece a esta clase' });
      }

      const album = await collectibleService.createAlbum({
        ...(data as any),
        classroomId,
      });

      res.status(201).json(album);
    } catch (error) {
      next(error);
    }
  },

  async getAlbums(req: Request, res: Response, next: NextFunction) {
    try {
      const { classroomId } = req.params;
      if (!(await requireClassroomMember(req, res, classroomId))) return;
      const albums = await collectibleService.getAlbumsByClassroom(classroomId);
      res.json(albums);
    } catch (error) {
      next(error);
    }
  },

  async getImportableAlbums(req: Request, res: Response, next: NextFunction) {
    try {
      const { classroomId } = req.params;
      const teacherId = req.user?.id;

      if (!teacherId) {
        return res.status(401).json({ message: 'No autenticado' });
      }

      const importableAlbums = await collectibleService.getImportableAlbumsForTeacher(teacherId, classroomId);
      res.json(importableAlbums);
    } catch (error: any) {
      if (error.message === 'Aula no encontrada') {
        return res.status(404).json({ message: error.message });
      }

      next(error);
    }
  },

  async getAlbumById(req: Request, res: Response, next: NextFunction) {
    try {
      const { albumId } = req.params;
      if (!(await requireResourceMember(req, res, classroomIdOfAlbum, albumId, 'Álbum no encontrado'))) return;
      const album = await collectibleService.getAlbumById(albumId);

      if (!album) {
        return res.status(404).json({ message: 'Álbum no encontrado' });
      }

      res.json(album);
    } catch (error) {
      next(error);
    }
  },

  async updateAlbum(req: Request, res: Response, next: NextFunction) {
    try {
      const { albumId } = req.params;
      if (!(await requireResourceTeacher(req, res, classroomIdOfAlbum, albumId, 'Álbum no encontrado'))) return;
      const parsed = albumUpdateSchema.safeParse(req.body);
      if (!parsed.success) return invalid(res, parsed.error);
      const data = pickFields(parsed.data as Record<string, unknown>, ALBUM_UPDATE_FIELDS);
      if (!(await isValidRewardBadge(data.rewardBadgeId, (await classroomIdOfAlbum(albumId))!))) {
        return res.status(400).json({ message: 'La insignia de premio no pertenece a esta clase' });
      }

      const album = await collectibleService.updateAlbum(albumId, data as any);
      res.json(album);
    } catch (error) {
      next(error);
    }
  },

  async deleteAlbum(req: Request, res: Response, next: NextFunction) {
    try {
      const { albumId } = req.params;
      if (!(await requireResourceTeacher(req, res, classroomIdOfAlbum, albumId, 'Álbum no encontrado'))) return;
      await collectibleService.deleteAlbum(albumId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async cloneAlbum(req: Request, res: Response, next: NextFunction) {
    try {
      const { albumId } = req.params;
      const { targetClassroomIds } = req.body;
      const teacherId = req.user?.id;

      if (!teacherId) {
        return res.status(401).json({ message: 'No autenticado' });
      }

      const result = await collectibleService.cloneAlbumToClassrooms(
        teacherId,
        albumId,
        Array.isArray(targetClassroomIds) ? targetClassroomIds : []
      );

      res.status(201).json(result);
    } catch (error: any) {
      if (error.message === 'Álbum no encontrado' || error.message === 'Aula no encontrada') {
        return res.status(404).json({ message: error.message });
      }

      if (error.message === 'No tienes acceso a este álbum') {
        return res.status(403).json({ message: error.message });
      }

      if (
        error.message === 'Selecciona al menos una clase destino' ||
        error.message === 'Selecciona otra clase destino' ||
        error.message === 'Hay clases destino no válidas'
      ) {
        return res.status(400).json({ message: error.message });
      }

      next(error);
    }
  },

  // ==================== CARTAS ====================

  async createCard(req: Request, res: Response, next: NextFunction) {
    try {
      const { albumId } = req.params;
      if (!(await requireResourceTeacher(req, res, classroomIdOfAlbum, albumId, 'Álbum no encontrado'))) return;
      const parsed = cardSchema.safeParse(req.body);
      if (!parsed.success) return invalid(res, parsed.error);
      const data = pickFields(parsed.data as Record<string, unknown>, CARD_FIELDS);

      const card = await collectibleService.createCard({
        ...(data as any),
        albumId,
      });

      res.status(201).json(card);
    } catch (error) {
      next(error);
    }
  },

  async createManyCards(req: Request, res: Response, next: NextFunction) {
    try {
      const { albumId } = req.params;
      if (!(await requireResourceTeacher(req, res, classroomIdOfAlbum, albumId, 'Álbum no encontrado'))) return;
      const parsed = cardBatchSchema.safeParse(req.body);
      if (!parsed.success) return invalid(res, parsed.error);

      const createdCards = await collectibleService.createManyCards(
        albumId,
        parsed.data.cards.map((card) => ({ ...card, description: card.description ?? undefined, imageUrl: card.imageUrl ?? undefined, icon: card.icon ?? undefined })),
      );
      res.status(201).json(createdCards);
    } catch (error) {
      next(error);
    }
  },

  async updateCard(req: Request, res: Response, next: NextFunction) {
    try {
      const { cardId } = req.params;
      if (!(await requireResourceTeacher(req, res, classroomIdOfCard, cardId, 'Carta no encontrada'))) return;
      const parsed = cardSchema.partial().safeParse(req.body);
      if (!parsed.success) return invalid(res, parsed.error);
      const data = pickFields(parsed.data as Record<string, unknown>, CARD_FIELDS);

      const card = await collectibleService.updateCard(cardId, data as any);
      res.json(card);
    } catch (error) {
      next(error);
    }
  },

  async moveCards(req: Request, res: Response, next: NextFunction) {
    try {
      const { albumId } = req.params;
      const { targetAlbumId, cardIds } = req.body;
      const teacherId = req.user?.id;

      if (!teacherId) {
        return res.status(401).json({ message: 'No autenticado' });
      }

      const result = await collectibleService.moveCardsBetweenAlbums(
        teacherId,
        albumId,
        typeof targetAlbumId === 'string' ? targetAlbumId : '',
        Array.isArray(cardIds) ? cardIds : []
      );

      res.json(result);
    } catch (error: any) {
      if (error.message === 'Álbum no encontrado') {
        return res.status(404).json({ message: error.message });
      }

      if (error.message === 'No tienes acceso a este álbum') {
        return res.status(403).json({ message: error.message });
      }

      if (
        error.message === 'Selecciona al menos un cromo' ||
        error.message === 'Selecciona un álbum destino' ||
        error.message === 'Selecciona otro álbum destino' ||
        error.message === 'Solo puedes mover cromos entre álbumes de la misma clase' ||
        error.message === 'Hay cromos inválidos para mover' ||
        error.message === 'No puedes mover cromos porque uno de los álbumes ya tiene progreso de estudiantes'
      ) {
        return res.status(400).json({ message: error.message });
      }

      next(error);
    }
  },

  async deleteCard(req: Request, res: Response, next: NextFunction) {
    try {
      const { cardId } = req.params;
      if (!(await requireResourceTeacher(req, res, classroomIdOfCard, cardId, 'Carta no encontrada'))) return;
      const result = await collectibleService.deleteCard(cardId);
      if (!result.deleted && result.owners > 0) {
        return res.status(409).json({
          message: `${result.owners} ${result.owners === 1 ? 'estudiante ya tiene' : 'estudiantes ya tienen'} este cromo: no se puede borrar, pero sí editar`,
          owners: result.owners,
        });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  // ==================== COMPRAS (ESTUDIANTE) ====================

  async purchasePack(req: Request, res: Response, next: NextFunction) {
    try {
      const { albumId } = req.params;
      const { packType } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'No autenticado' });
      }

      // Obtener el álbum para saber a qué classroom pertenece
      const [album] = await db
        .select({ classroomId: collectibleAlbums.classroomId })
        .from(collectibleAlbums)
        .where(eq(collectibleAlbums.id, albumId));

      if (!album) {
        return res.status(404).json({ message: 'Álbum no encontrado' });
      }

      // Buscar el perfil del estudiante en esa clase
      const [studentProfile] = await db
        .select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(
          and(
            eq(studentProfiles.userId, userId),
            eq(studentProfiles.classroomId, album.classroomId)
          )
        );

      if (!studentProfile) {
        return res.status(400).json({ message: 'No tienes un perfil en esta clase' });
      }

      const studentProfileId = studentProfile.id;

      const result = await collectibleService.purchasePack(
        studentProfileId,
        albumId,
        packType as PackType
      );

      res.json(result);
    } catch (error: any) {
      if (error.message === 'No tienes suficiente oro' || 
          error.message === 'Álbum no disponible' ||
          error.message === 'La tienda está cerrada' ||
          error.message?.includes('necesita al menos')) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  },

  // ==================== COLECCIÓN DEL ESTUDIANTE ====================

  async getStudentCollection(req: Request, res: Response, next: NextFunction) {
    try {
      const { albumId, studentProfileId: paramStudentProfileId } = req.params;
      const userId = req.user?.id;
      
      let studentProfileId = paramStudentProfileId;

      if (paramStudentProfileId) {
        if (!(await requireStudentProfileReadAccess(req, res, paramStudentProfileId))) return;
        const [albumClassroomId, studentClassroomId] = await Promise.all([
          classroomIdOfAlbum(albumId),
          classroomIdOfStudentProfile(paramStudentProfileId),
        ]);
        if (!albumClassroomId || albumClassroomId !== studentClassroomId) {
          return res.status(404).json({ message: 'Álbum no encontrado' });
        }
      }

      // Si no viene por params, buscar el perfil del usuario logueado
      if (!studentProfileId && userId) {
        const [album] = await db
          .select({ classroomId: collectibleAlbums.classroomId })
          .from(collectibleAlbums)
          .where(eq(collectibleAlbums.id, albumId));

        if (album) {
          const [studentProfile] = await db
            .select({ id: studentProfiles.id })
            .from(studentProfiles)
            .where(
              and(
                eq(studentProfiles.userId, userId),
                eq(studentProfiles.classroomId, album.classroomId)
              )
            );
          studentProfileId = studentProfile?.id;
        }
      }

      if (!studentProfileId) {
        return res.status(400).json({ message: 'Se requiere perfil de estudiante' });
      }

      const collection = await collectibleService.getStudentCollection(studentProfileId, albumId);

      if (!collection) {
        return res.status(404).json({ message: 'Álbum no encontrado' });
      }

      res.json(collection);
    } catch (error) {
      next(error);
    }
  },

  // ==================== PROGRESO DE CLASE (PROFESOR) ====================

  async getClassroomProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const { classroomId, albumId } = req.params;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      if ((await classroomIdOfAlbum(albumId)) !== classroomId) {
        return res.status(404).json({ message: 'Álbum no encontrado' });
      }
      const progress = await collectibleService.getClassroomProgress(classroomId, albumId);

      if (!progress) {
        return res.status(404).json({ message: 'Álbum no encontrado' });
      }

      res.json(progress);
    } catch (error) {
      next(error);
    }
  },

  // Cuántos estudiantes tienen cada cromo de un álbum (profesor)
  async getCardOwners(req: Request, res: Response, next: NextFunction) {
    try {
      const { albumId } = req.params;
      if (!(await requireResourceTeacher(req, res, classroomIdOfAlbum, albumId, 'Álbum no encontrado'))) return;
      res.json(await collectibleService.getCardOwnerCounts(albumId));
    } catch (error) {
      next(error);
    }
  },

  // ==================== GENERACIÓN CON IA ====================

  async generateAlbumWithAI(req: Request, res: Response, next: NextFunction) {
    try {
      const { classroomId } = req.params;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      const { theme, cardCount, imageStyle, rarityDistribution } = req.body;
      if (typeof theme !== 'string' || !theme.trim() || theme.length > 1000) {
        return res.status(400).json({ message: 'Describe el tema del álbum' });
      }

      const generated = await collectibleService.generateAlbumWithAI({
        classroomId,
        theme,
        cardCount: Math.min(40, Math.max(3, Number(cardCount) || 10)),
        imageStyle: imageStyle || 'CARTOON',
        rarityDistribution: rarityDistribution || 'auto',
      });

      res.json(generated);
    } catch (error: any) {
      if (error.message === 'GEMINI_API_KEY no configurada') {
        return res.status(503).json({ message: 'Servicio de IA no disponible' });
      }
      next(error);
    }
  },

  async generateCardWithAI(req: Request, res: Response, next: NextFunction) {
    try {
      const { prompt, rarity } = req.body;

      const card = await collectibleService.generateCardWithAI(
        prompt,
        (rarity || 'COMMON') as CardRarity
      );

      res.json(card);
    } catch (error: any) {
      if (error.message === 'GEMINI_API_KEY no configurada') {
        return res.status(503).json({ message: 'Servicio de IA no disponible' });
      }
      next(error);
    }
  },

  // ==================== PROGRESO DE ESTUDIANTE (TODOS LOS ÁLBUMES) ====================

  async getStudentAlbumsProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const { classroomId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'No autenticado' });
      }

      // Buscar el perfil del estudiante en esa clase
      const [studentProfile] = await db
        .select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(
          and(
            eq(studentProfiles.userId, userId),
            eq(studentProfiles.classroomId, classroomId)
          )
        );

      if (!studentProfile) {
        return res.status(400).json({ message: 'No tienes un perfil en esta clase' });
      }

      const progress = await collectibleService.getStudentAlbumsProgress(studentProfile.id, classroomId);
      res.json(progress);
    } catch (error) {
      next(error);
    }
  },
};
