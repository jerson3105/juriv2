import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { collectibleService } from '../services/collectible.service.js';
import { collectibleStudentService } from '../services/collectibleStudent.service.js';
import type { CardRarity } from '../db/schema.js';
import { AppError } from '../utils/errors.js';
import { DEFAULT_TZ_OFFSET } from '../utils/shopRules.js';
import {
  requireClassroomTeacher,
  requireResourceTeacher,
  requireStudentProfileReadAccess,
  classroomIdOfAlbum,
  classroomIdOfCard,
  classroomIdOfStudentProfile,
  badgeScopeAndClassroom,
  pickFields,
} from '../utils/access.js';

// Campos que el profesor puede fijar en álbumes y cartas (classroomId/albumId salen de la ruta). El precio de los
// sobres sale del oro semanal de la clase (solo se elige el nivel) y el premio no lleva XP (coleccionables v2).
const ALBUM_FIELDS = [
  'name', 'description', 'coverImage', 'theme', 'imageStyle', 'priceLevel',
  'rewardHp', 'rewardGp', 'rewardBadgeId', 'allowTrades',
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
const reward = z.number().int().min(0, 'La recompensa no puede ser negativa').max(1000, 'La recompensa es demasiado alta');
const albumSchema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre').max(100, 'El nombre es demasiado largo'),
  description: z.string().trim().max(500).nullable().optional(),
  coverImage: imageRef.nullable().optional(),
  theme: z.string().trim().max(255).nullable().optional(),
  imageStyle: z.enum(['CARTOON', 'REALISTIC', 'PIXEL_ART', 'ANIME', 'WATERCOLOR', 'MINIMALIST']).optional(),
  priceLevel: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
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

// Alumno: el desfase horario del navegador (getTimezoneOffset) para contar los sobres de «hoy».
const tzSchema = z.coerce.number().int().min(-840).max(840).default(DEFAULT_TZ_OFFSET);
const viewQuerySchema = z.object({ tz: tzSchema });
const openSchema = z.object({ tz: tzSchema });
const pricingQuerySchema = z.object({ cards: z.coerce.number().int().min(0).max(1000).default(0) });
const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Datos inválidos' });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

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
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      const albums = await collectibleService.getAlbumsByClassroom(classroomId, { pricing: true });
      res.json(albums);
    } catch (error) {
      next(error);
    }
  },

  // GET /collectibles/classroom/:classroomId/pricing?cards=N: los tres niveles de precio con el oro de la clase.
  async getPricingPreview(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      const { cards } = pricingQuerySchema.parse(req.query);
      res.json({ success: true, data: await collectibleService.getPricingPreview(classroomId, cards) });
    } catch (error) {
      fail(res, error, 'No se pudieron calcular los precios');
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
      if (!(await requireResourceTeacher(req, res, classroomIdOfAlbum, albumId, 'Álbum no encontrado'))) return;
      const album = await collectibleService.getAlbumWithPricing(albumId);

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
        error.message === 'Selecciona al menos una figurita' ||
        error.message === 'Selecciona un álbum destino' ||
        error.message === 'Selecciona otro álbum destino' ||
        error.message === 'Solo puedes mover figuritas entre álbumes de la misma clase' ||
        error.message === 'Hay figuritas inválidas para mover' ||
        error.message === 'No puedes mover figuritas porque uno de los álbumes ya tiene progreso de estudiantes'
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
          message: `${result.owners} ${result.owners === 1 ? 'estudiante ya tiene' : 'estudiantes ya tienen'} esta figurita: no se puede borrar, pero sí editar`,
          owners: result.owners,
        });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  // ==================== COLECCIONABLES (ALUMNO) ====================

  // GET /collectibles/student/:studentProfileId/view?tz= (solo el dueño del perfil; otro perfil → 404)
  async getStudentView(req: Request, res: Response) {
    try {
      const { tz } = viewQuerySchema.parse(req.query);
      const data = await collectibleStudentService.getView(req.params.studentProfileId, req.user!.id, tz);
      res.json({ success: true, data });
    } catch (error) {
      fail(res, error, 'No se pudo cargar tu álbum');
    }
  },

  // POST /collectibles/student/:studentProfileId/albums/:albumId/open { tz }
  async openPack(req: Request, res: Response) {
    try {
      const { tz } = openSchema.parse(req.body ?? {});
      const data = await collectibleStudentService.openPack(req.params.studentProfileId, req.user!.id, req.params.albumId, tz);
      res.json({ success: true, data });
    } catch (error) {
      fail(res, error, 'No se pudo abrir el sobre');
    }
  },

  // POST /collectibles/student/:studentProfileId/albums/:albumId/welcome
  async openWelcome(req: Request, res: Response) {
    try {
      const data = await collectibleStudentService.openWelcome(req.params.studentProfileId, req.user!.id, req.params.albumId);
      res.json({ success: true, data });
    } catch (error) {
      fail(res, error, 'No se pudo abrir tu sobre de bienvenida');
    }
  },

  // ==================== COLECCIÓN DE UN ESTUDIANTE (PROFESOR) ====================

  async getStudentCollection(req: Request, res: Response, next: NextFunction) {
    try {
      const { albumId, studentProfileId } = req.params;
      if (!(await requireStudentProfileReadAccess(req, res, studentProfileId))) return;
      const [albumClassroomId, studentClassroomId] = await Promise.all([
        classroomIdOfAlbum(albumId),
        classroomIdOfStudentProfile(studentProfileId),
      ]);
      if (!albumClassroomId || albumClassroomId !== studentClassroomId) {
        return res.status(404).json({ message: 'Álbum no encontrado' });
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

  // Cuántos estudiantes tienen cada figurita de un álbum (profesor)
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
};
