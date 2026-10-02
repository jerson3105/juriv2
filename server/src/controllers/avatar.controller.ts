import { Request, Response } from 'express';
import { avatarService } from '../services/avatar.service.js';
import { z } from 'zod';
import {
  requireStudentProfileOwner,
  requireStudentProfileReadAccess,
  requireClassroomTeacher,
  requireClassroomMember,
  requireResourceMember,
  requireStudentsMember,
  classroomIdOfShopItem,
  classroomIdOfStudentProfile,
} from '../utils/access.js';

const MAX_AVATAR_PRICE = 100000;

const addToShopSchema = z.object({
  avatarItemId: z.string().uuid(),
  price: z.number().int().min(0).max(MAX_AVATAR_PRICE),
});

const slotSchema = z.enum(['HEAD', 'HAIR', 'EYES', 'TOP', 'BOTTOM', 'LEFT_HAND', 'RIGHT_HAND', 'SHOES', 'BACK', 'FLAG', 'BACKGROUND']);

export const avatarController = {
  // ==================== ITEMS GLOBALES ====================

  async getAllItems(req: Request, res: Response) {
    try {
      const gender = req.query.gender as 'MALE' | 'FEMALE' | undefined;
      const items = await avatarService.getAllAvatarItems(gender);

      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      console.error('Error getting avatar items:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener items de avatar',
      });
    }
  },

  // ==================== TIENDA DE CLASE ====================

  async addToClassroomShop(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      const data = addToShopSchema.parse(req.body);

      const item = await avatarService.addItemToClassroomShop({
        classroomId,
        avatarItemId: data.avatarItemId,
        price: data.price,
      });

      res.status(201).json({
        success: true,
        message: 'Item añadido a la tienda',
        data: item,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }
      console.error('Error adding item to classroom shop:', error);
      res.status(500).json({
        success: false,
        message: 'Error al añadir item a la tienda',
      });
    }
  },

  async getClassroomShopItems(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await requireClassroomMember(req, res, classroomId))) return;
      const gender = req.query.gender as 'MALE' | 'FEMALE' | undefined;

      const items = await avatarService.getClassroomShopItems(classroomId, gender);

      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      console.error('Error getting classroom shop items:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener items de la tienda',
      });
    }
  },

  async removeFromClassroomShop(req: Request, res: Response) {
    try {
      const { classroomId, avatarItemId } = req.params;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;

      await avatarService.removeItemFromClassroomShop(classroomId, avatarItemId);

      res.json({
        success: true,
        message: 'Item removido de la tienda',
      });
    } catch (error) {
      console.error('Error removing item from classroom shop:', error);
      res.status(500).json({
        success: false,
        message: 'Error al remover item de la tienda',
      });
    }
  },

  async removeShopItemById(req: Request, res: Response) {
    try {
      const { shopItemId } = req.params;
      const classroomId = await classroomIdOfShopItem(shopItemId);
      if (!classroomId) return res.status(404).json({ success: false, message: 'Ítem no encontrado' });
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;

      await avatarService.removeShopItemById(shopItemId);

      res.json({
        success: true,
        message: 'Item removido de la tienda',
      });
    } catch (error) {
      console.error('Error removing shop item:', error);
      res.status(500).json({
        success: false,
        message: 'Error al remover item de la tienda',
      });
    }
  },

  async updateShopItemPrice(req: Request, res: Response) {
    try {
      const { shopItemId } = req.params;
      const { price } = req.body;
      const priceClassroomId = await classroomIdOfShopItem(shopItemId);
      if (!priceClassroomId) return res.status(404).json({ success: false, message: 'Ítem no encontrado' });
      if (!(await requireClassroomTeacher(req, res, priceClassroomId))) return;

      if (typeof price !== 'number' || !Number.isInteger(price) || price < 0 || price > MAX_AVATAR_PRICE) {
        return res.status(400).json({
          success: false,
          message: 'Precio inválido',
        });
      }

      const item = await avatarService.updateShopItemPrice(shopItemId, price);

      res.json({
        success: true,
        message: 'Precio actualizado',
        data: item,
      });
    } catch (error) {
      console.error('Error updating shop item price:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar precio',
      });
    }
  },

  // ==================== COMPRAS DE ESTUDIANTES ====================

  async purchaseItem(req: Request, res: Response) {
    try {
      const { studentProfileId, classroomId, avatarItemId } = req.body;
      if (!(await requireStudentProfileOwner(req, res, studentProfileId))) return;

      const result = await avatarService.purchaseAvatarItem(
        studentProfileId,
        classroomId,
        avatarItemId
      );

      res.json({
        success: true,
        message: '¡Item comprado!',
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      console.error('Error purchasing avatar item:', error);
      res.status(500).json({
        success: false,
        message: 'Error al comprar item',
      });
    }
  },

  async getStudentPurchases(req: Request, res: Response) {
    try {
      const { studentProfileId } = req.params;

      if (!(await requireStudentProfileReadAccess(req, res, studentProfileId))) return;
      const purchases = await avatarService.getStudentPurchases(studentProfileId);

      res.json({
        success: true,
        data: purchases,
      });
    } catch (error) {
      console.error('Error getting student purchases:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener compras',
      });
    }
  },

  // ==================== EQUIPAR ITEMS ====================

  async equipItem(req: Request, res: Response) {
    try {
      const { studentProfileId, avatarItemId } = req.body;
      if (!(await requireStudentProfileOwner(req, res, studentProfileId))) return;

      const equippedItems = await avatarService.equipItem(studentProfileId, avatarItemId);

      res.json({
        success: true,
        message: 'Item equipado',
        data: equippedItems,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      console.error('Error equipping item:', error);
      res.status(500).json({
        success: false,
        message: 'Error al equipar item',
      });
    }
  },

  async unequipItem(req: Request, res: Response) {
    try {
      const { studentProfileId } = req.body;
      if (!(await requireStudentProfileOwner(req, res, studentProfileId))) return;
      const slot = slotSchema.safeParse(req.body?.slot);
      if (!slot.success) return res.status(400).json({ success: false, message: 'Ranura inválida' });

      const equippedItems = await avatarService.unequipItem(studentProfileId, slot.data);

      res.json({
        success: true,
        message: 'Item desequipado',
        data: equippedItems,
      });
    } catch (error) {
      // «No puedes desequipar items por defecto…» es un mensaje para el alumno, no un fallo.
      if (error instanceof Error && error.message.startsWith('No puedes')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error('Error unequipping item:', error);
      res.status(500).json({
        success: false,
        message: 'Error al desequipar item',
      });
    }
  },

  // Items equipados de varios alumnos en una petición (las listas renderizan un mini-avatar por
  // alumno; antes era una petición por alumno).
  async getEquippedItemsBatch(req: Request, res: Response) {
    try {
      const ids = req.body?.studentProfileIds;
      const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || ids.some((id) => typeof id !== 'string' || !UUID.test(id))) {
        return res.status(400).json({ success: false, message: 'studentProfileIds debe ser una lista de 1 a 100 ids' });
      }
      const uniqueIds = [...new Set(ids as string[])];
      if (!(await requireStudentsMember(req, res, uniqueIds))) return;
      const items = await avatarService.getEquippedItemsForStudents(uniqueIds);
      res.json({ success: true, data: items });
    } catch (error) {
      console.error('Error getting equipped items batch:', error);
      res.status(500).json({ success: false, message: 'Error al obtener items equipados' });
    }
  },

  async getEquippedItems(req: Request, res: Response) {
    try {
      const { studentProfileId } = req.params;

      if (!(await requireResourceMember(req, res, classroomIdOfStudentProfile, studentProfileId, 'Estudiante no encontrado'))) return;
      const items = await avatarService.getEquippedItems(studentProfileId);

      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      console.error('Error getting equipped items:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener items equipados',
      });
    }
  },

  async getStudentAvatarData(req: Request, res: Response) {
    try {
      const { studentProfileId } = req.params;

      if (!(await requireResourceMember(req, res, classroomIdOfStudentProfile, studentProfileId, 'Estudiante no encontrado'))) return;
      const avatarData = await avatarService.getStudentAvatarData(studentProfileId);

      res.json({
        success: true,
        data: avatarData,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      console.error('Error getting student avatar data:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener datos del avatar',
      });
    }
  },
};
