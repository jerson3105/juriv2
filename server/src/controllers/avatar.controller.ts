import { Request, Response } from 'express';
import { avatarService } from '../services/avatar.service.js';
import { z } from 'zod';

const createAvatarItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE']),
  slot: z.enum(['HEAD', 'HAIR', 'EYES', 'TOP', 'BOTTOM', 'LEFT_HAND', 'RIGHT_HAND', 'SHOES', 'BACK', 'FLAG']),
  imagePath: z.string().min(1),
  layerOrder: z.number().int(),
  basePrice: z.number().int().min(0),
  rarity: z.enum(['COMMON', 'RARE', 'LEGENDARY']).optional(),
});

const addToShopSchema = z.object({
  avatarItemId: z.string().uuid(),
  price: z.number().int().min(0),
});

export const avatarController = {
  // ==================== ITEMS GLOBALES ====================

  async createItem(req: Request, res: Response) {
    try {
      const data = createAvatarItemSchema.parse(req.body);
      const item = await avatarService.createAvatarItem(data);

      res.status(201).json({
        success: true,
        message: 'Item de avatar creado',
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
      console.error('Error creating avatar item:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear item de avatar',
      });
    }
  },

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

  async getItemsBySlot(req: Request, res: Response) {
    try {
      const { slot } = req.params;
      const gender = req.query.gender as 'MALE' | 'FEMALE' | undefined;
      
      const validSlots = ['HEAD', 'FACE', 'TOP', 'BOTTOM', 'LEFT_HAND', 'RIGHT_HAND', 'SHOES', 'BACK', 'PETS'];
      if (!validSlots.includes(slot)) {
        return res.status(400).json({
          success: false,
          message: 'Slot inválido',
        });
      }

      const items = await avatarService.getAvatarItemsBySlot(slot as any, gender);

      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      console.error('Error getting avatar items by slot:', error);
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

      if (typeof price !== 'number' || price < 0) {
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
      const { studentProfileId, slot } = req.body;

      const equippedItems = await avatarService.unequipItem(studentProfileId, slot);

      res.json({
        success: true,
        message: 'Item desequipado',
        data: equippedItems,
      });
    } catch (error) {
      console.error('Error unequipping item:', error);
      res.status(500).json({
        success: false,
        message: 'Error al desequipar item',
      });
    }
  },

  async getEquippedItems(req: Request, res: Response) {
    try {
      const { studentProfileId } = req.params;

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
