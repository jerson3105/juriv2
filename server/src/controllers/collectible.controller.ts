import { Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { collectibleService } from '../services/collectible.service.js';
import { db } from '../db/index.js';
import { studentProfiles, collectibleAlbums } from '../db/schema.js';
import type { CardRarity, PackType, ImageStyle } from '../db/schema.js';

export const collectibleController = {
  // ==================== ÁLBUMES ====================

  async createAlbum(req: Request, res: Response, next: NextFunction) {
    try {
      const { classroomId } = req.params;
      const data = req.body;

      const album = await collectibleService.createAlbum({
        classroomId,
        ...data,
      });

      res.status(201).json(album);
    } catch (error) {
      next(error);
    }
  },

  async getAlbums(req: Request, res: Response, next: NextFunction) {
    try {
      const { classroomId } = req.params;
      const albums = await collectibleService.getAlbumsByClassroom(classroomId);
      res.json(albums);
    } catch (error) {
      next(error);
    }
  },

  async getAlbumById(req: Request, res: Response, next: NextFunction) {
    try {
      const { albumId } = req.params;
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
      const data = req.body;

      const album = await collectibleService.updateAlbum(albumId, data);
      res.json(album);
    } catch (error) {
      next(error);
    }
  },

  async deleteAlbum(req: Request, res: Response, next: NextFunction) {
    try {
      const { albumId } = req.params;
      await collectibleService.deleteAlbum(albumId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  // ==================== CARTAS ====================

  async createCard(req: Request, res: Response, next: NextFunction) {
    try {
      const { albumId } = req.params;
      const data = req.body;

      const card = await collectibleService.createCard({
        albumId,
        ...data,
      });

      res.status(201).json(card);
    } catch (error) {
      next(error);
    }
  },

  async createManyCards(req: Request, res: Response, next: NextFunction) {
    try {
      const { albumId } = req.params;
      const { cards } = req.body;

      const createdCards = await collectibleService.createManyCards(albumId, cards);
      res.status(201).json(createdCards);
    } catch (error) {
      next(error);
    }
  },

  async updateCard(req: Request, res: Response, next: NextFunction) {
    try {
      const { cardId } = req.params;
      const data = req.body;

      const card = await collectibleService.updateCard(cardId, data);
      res.json(card);
    } catch (error) {
      next(error);
    }
  },

  async deleteCard(req: Request, res: Response, next: NextFunction) {
    try {
      const { cardId } = req.params;
      await collectibleService.deleteCard(cardId);
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
      const progress = await collectibleService.getClassroomProgress(classroomId, albumId);

      if (!progress) {
        return res.status(404).json({ message: 'Álbum no encontrado' });
      }

      res.json(progress);
    } catch (error) {
      next(error);
    }
  },

  // ==================== GENERACIÓN CON IA ====================

  async generateAlbumWithAI(req: Request, res: Response, next: NextFunction) {
    try {
      const { classroomId } = req.params;
      const { theme, cardCount, imageStyle, rarityDistribution } = req.body;

      const generated = await collectibleService.generateAlbumWithAI({
        classroomId,
        theme,
        cardCount: cardCount || 10,
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
