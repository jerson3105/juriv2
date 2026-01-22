import { Request, Response } from 'express';
import { z } from 'zod';
import { shopService } from '../services/shop.service.js';
import { GoogleGenAI } from '@google/genai';

// Schemas de validación
const createItemSchema = z.object({
  classroomId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.enum(['AVATAR', 'ACCESSORY', 'CONSUMABLE', 'SPECIAL']),
  rarity: z.enum(['COMMON', 'RARE', 'LEGENDARY']),
  price: z.number().int().min(0),
  imageUrl: z.string().url().optional(),
  icon: z.string().optional(),
  effectType: z.string().optional(),
  effectValue: z.number().int().optional(),
  stock: z.number().int().min(0).optional(),
});

const updateItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  category: z.enum(['AVATAR', 'ACCESSORY', 'CONSUMABLE', 'SPECIAL']).optional(),
  rarity: z.enum(['COMMON', 'RARE', 'LEGENDARY']).optional(),
  price: z.number().int().min(0).optional(),
  imageUrl: z.string().url().optional(),
  icon: z.string().optional(),
  effectType: z.string().optional(),
  effectValue: z.number().int().optional(),
  stock: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const purchaseSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
});

const giftSchema = z.object({
  itemId: z.string().uuid(),
  recipientId: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
  message: z.string().max(500).optional(),
});

const teacherPurchaseSchema = z.object({
  itemId: z.string().uuid(),
  studentId: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
});

export class ShopController {
  // ==================== ITEMS (PROFESOR) ====================

  async createItem(req: Request, res: Response) {
    try {
      const data = createItemSchema.parse(req.body);
      const teacherId = req.user!.id;

      // Verificar que el profesor es dueño del aula
      const isOwner = await shopService.verifyTeacherOwnsClassroom(teacherId, data.classroomId);
      if (!isOwner) {
        return res.status(403).json({ message: 'No tienes permiso para esta clase' });
      }

      const item = await shopService.createItem(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error creating item:', error);
      res.status(500).json({ message: 'Error al crear el artículo' });
    }
  }

  async updateItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = updateItemSchema.parse(req.body);
      const teacherId = req.user!.id;

      // Obtener item para verificar permisos
      const existingItem = await shopService.getItemById(id);
      if (!existingItem) {
        return res.status(404).json({ message: 'Artículo no encontrado' });
      }

      const isOwner = await shopService.verifyTeacherOwnsClassroom(teacherId, existingItem.classroomId);
      if (!isOwner) {
        return res.status(403).json({ message: 'No tienes permiso para esta clase' });
      }

      const item = await shopService.updateItem(id, data);
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error updating item:', error);
      res.status(500).json({ message: 'Error al actualizar el artículo' });
    }
  }

  async deleteItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const teacherId = req.user!.id;

      const existingItem = await shopService.getItemById(id);
      if (!existingItem) {
        return res.status(404).json({ message: 'Artículo no encontrado' });
      }

      const isOwner = await shopService.verifyTeacherOwnsClassroom(teacherId, existingItem.classroomId);
      if (!isOwner) {
        return res.status(403).json({ message: 'No tienes permiso para esta clase' });
      }

      await shopService.deleteItem(id);
      res.json({ message: 'Artículo eliminado' });
    } catch (error) {
      console.error('Error deleting item:', error);
      res.status(500).json({ message: 'Error al eliminar el artículo' });
    }
  }

  async getClassroomItems(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const items = await shopService.getItemsByClassroom(classroomId);
      res.json(items);
    } catch (error) {
      console.error('Error getting items:', error);
      res.status(500).json({ message: 'Error al obtener artículos' });
    }
  }

  // ==================== COMPRAS (ESTUDIANTE) ====================

  async purchaseItem(req: Request, res: Response) {
    try {
      const data = purchaseSchema.parse(req.body);
      const studentId = req.params.studentId;

      // Verificar que el estudiante es el usuario actual
      // (esto se debería validar con el perfil del estudiante)

      const result = await shopService.purchaseItem({
        studentId,
        itemId: data.itemId,
        quantity: data.quantity,
        purchaseType: 'SELF',
      });

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error purchasing item:', error);
      res.status(500).json({ message: 'Error al realizar la compra' });
    }
  }

  async giftItem(req: Request, res: Response) {
    try {
      const data = giftSchema.parse(req.body);
      const buyerId = req.params.studentId;

      // Verificar que el destinatario está en la misma clase
      const item = await shopService.getItemById(data.itemId);
      if (!item) {
        return res.status(404).json({ message: 'Artículo no encontrado' });
      }

      const recipientInClass = await shopService.verifyStudentInClassroom(
        data.recipientId, 
        item.classroomId
      );
      if (!recipientInClass) {
        return res.status(400).json({ message: 'El destinatario no está en esta clase' });
      }

      const result = await shopService.purchaseItem({
        studentId: data.recipientId,
        itemId: data.itemId,
        quantity: data.quantity,
        purchaseType: 'GIFT',
        buyerId,
        giftMessage: data.message,
      });

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error gifting item:', error);
      res.status(500).json({ message: 'Error al enviar el regalo' });
    }
  }

  // ==================== COMPRA POR PROFESOR ====================

  async teacherPurchase(req: Request, res: Response) {
    try {
      const data = teacherPurchaseSchema.parse(req.body);
      const teacherId = req.user!.id;

      // Verificar que el profesor es dueño del aula del item
      const item = await shopService.getItemById(data.itemId);
      if (!item) {
        return res.status(404).json({ message: 'Artículo no encontrado' });
      }

      const isOwner = await shopService.verifyTeacherOwnsClassroom(teacherId, item.classroomId);
      if (!isOwner) {
        return res.status(403).json({ message: 'No tienes permiso para esta clase' });
      }

      // Verificar que el estudiante está en la clase
      const studentInClass = await shopService.verifyStudentInClassroom(data.studentId, item.classroomId);
      if (!studentInClass) {
        return res.status(400).json({ message: 'El estudiante no está en esta clase' });
      }

      const result = await shopService.teacherPurchaseForStudent({
        studentId: data.studentId,
        itemId: data.itemId,
        quantity: data.quantity,
      });

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error teacher purchase:', error);
      res.status(500).json({ message: 'Error al realizar la compra' });
    }
  }

  // ==================== HISTORIAL ====================

  async getStudentPurchases(req: Request, res: Response) {
    try {
      const { studentId } = req.params;
      const purchases = await shopService.getStudentPurchases(studentId);
      res.json(purchases);
    } catch (error) {
      console.error('Error getting purchases:', error);
      res.status(500).json({ message: 'Error al obtener historial' });
    }
  }

  async getGiftsReceived(req: Request, res: Response) {
    try {
      const { studentId } = req.params;
      const gifts = await shopService.getGiftsReceived(studentId);
      res.json(gifts);
    } catch (error) {
      console.error('Error getting gifts:', error);
      res.status(500).json({ message: 'Error al obtener regalos' });
    }
  }

  async getGiftsSent(req: Request, res: Response) {
    try {
      const { studentId } = req.params;
      const gifts = await shopService.getGiftsSent(studentId);
      res.json(gifts);
    } catch (error) {
      console.error('Error getting sent gifts:', error);
      res.status(500).json({ message: 'Error al obtener regalos enviados' });
    }
  }

  // ==================== USO DE ITEMS ====================

  async useItem(req: Request, res: Response) {
    try {
      const { studentId, purchaseId } = req.params;
      
      const result = await shopService.useItem(purchaseId, studentId);
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json(result);
    } catch (error) {
      console.error('Error using item:', error);
      res.status(500).json({ message: 'Error al usar el item' });
    }
  }

  async getPendingUsages(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const teacherId = req.user!.id;

      // Verificar que el profesor es dueño del aula
      const isOwner = await shopService.verifyTeacherOwnsClassroom(teacherId, classroomId);
      if (!isOwner) {
        return res.status(403).json({ message: 'No tienes permiso para esta clase' });
      }

      const usages = await shopService.getItemUsagesPending(classroomId);
      res.json(usages);
    } catch (error) {
      console.error('Error getting pending usages:', error);
      res.status(500).json({ message: 'Error al obtener usos pendientes' });
    }
  }

  async reviewUsage(req: Request, res: Response) {
    try {
      const { usageId } = req.params;
      const { status } = req.body;
      const teacherId = req.user!.id;

      if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ message: 'Estado inválido' });
      }

      const result = await shopService.reviewItemUsage(usageId, teacherId, status);
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json(result);
    } catch (error) {
      console.error('Error reviewing usage:', error);
      res.status(500).json({ message: 'Error al revisar el uso' });
    }
  }

  // ==================== NOTIFICACIONES ====================

  async getNotifications(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const unreadOnly = req.query.unread === 'true';
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const classroomId = req.query.classroomId as string | undefined;
      
      const result = await shopService.getNotifications(userId, { unreadOnly, limit, offset, classroomId });
      res.json(result);
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({ message: 'Error al obtener notificaciones' });
    }
  }

  async markNotificationRead(req: Request, res: Response) {
    try {
      const { notificationId } = req.params;
      const userId = req.user!.id;
      
      await shopService.markNotificationRead(notificationId, userId);
      res.json({ message: 'Notificación marcada como leída' });
    } catch (error) {
      console.error('Error marking notification:', error);
      res.status(500).json({ message: 'Error al marcar notificación' });
    }
  }

  async markAllRead(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      
      await shopService.markAllNotificationsRead(userId);
      res.json({ message: 'Todas las notificaciones marcadas como leídas' });
    } catch (error) {
      console.error('Error marking all notifications:', error);
      res.status(500).json({ message: 'Error al marcar notificaciones' });
    }
  }

  async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      
      const count = await shopService.getUnreadCount(userId);
      res.json({ count });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({ message: 'Error al obtener conteo' });
    }
  }

  // ==================== APROBACIÓN DE COMPRAS ====================

  async getPendingPurchases(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const purchases = await shopService.getPendingPurchases(classroomId);
      res.json(purchases);
    } catch (error) {
      console.error('Error getting pending purchases:', error);
      res.status(500).json({ message: 'Error al obtener compras pendientes' });
    }
  }

  async approvePurchase(req: Request, res: Response) {
    try {
      const { purchaseId } = req.params;
      const teacherId = req.user!.id;
      
      const result = await shopService.approvePurchase(purchaseId, teacherId);
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      res.json({ message: result.message });
    } catch (error) {
      console.error('Error approving purchase:', error);
      res.status(500).json({ message: 'Error al aprobar compra' });
    }
  }

  async rejectPurchase(req: Request, res: Response) {
    try {
      const { purchaseId } = req.params;
      const teacherId = req.user!.id;
      const { reason } = req.body;
      
      const result = await shopService.rejectPurchase(purchaseId, teacherId, reason);
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      res.json({ message: result.message });
    } catch (error) {
      console.error('Error rejecting purchase:', error);
      res.status(500).json({ message: 'Error al rechazar compra' });
    }
  }

  // ==================== GENERACIÓN CON IA ====================

  async generateWithAI(req: Request, res: Response) {
    try {
      const { description, level, count, itemType } = req.body;

      if (!description || !level) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere descripción y nivel educativo',
        });
      }

      // Instrucciones según el tipo de item
      let typeInstruction = '';
      switch (itemType) {
        case 'PRIVILEGES':
          typeInstruction = 'Genera PRIVILEGIOS que los estudiantes puedan canjear (elegir asiento, tiempo extra, entregar tarde, etc.)';
          break;
        case 'REWARDS':
          typeInstruction = 'Genera RECOMPENSAS físicas o experiencias (dulces, stickers, ser ayudante, etc.)';
          break;
        case 'POWERS':
          typeInstruction = 'Genera PODERES especiales del juego (escudo anti-HP, duplicar XP, revivir, etc.)';
          break;
        default:
          typeInstruction = 'Genera una mezcla variada de privilegios, recompensas y poderes';
          break;
      }

      const prompt = `Eres un experto en gamificación educativa. Genera ${count || 8} artículos para la tienda de una clase gamificada de nivel ${level}.

CONTEXTO DEL PROFESOR:
"${description}"

TIPO DE ITEMS A GENERAR:
${typeInstruction}

Responde ÚNICAMENTE con un array JSON válido, sin explicaciones ni markdown:

[
  {
    "name": "Nombre corto y atractivo (máx 30 caracteres)",
    "description": "Descripción breve de qué hace o qué es",
    "category": "CONSUMABLE",
    "rarity": "COMMON",
    "price": 25,
    "icon": "🎁"
  }
]

REGLAS IMPORTANTES:
1. CATEGORÍAS:
   - CONSUMABLE: Se usa una vez y desaparece (privilegios, experiencias)
   - SPECIAL: Items únicos o muy especiales

2. RAREZAS y PRECIOS sugeridos:
   - COMMON: 10-30 GP (fáciles de conseguir)
   - RARE: 50-100 GP (requieren más esfuerzo)
   - LEGENDARY: 150-300 GP (muy difíciles, muy valiosos)

3. Iconos disponibles: 🎁⭐💎🏆🎭👑🔮⚡🌟💫🎪🎨🧪💊🗡️🛡️💺⏰📝🎵📱🍬🎮✨🌈🔥❄️

4. Nombres creativos pero claros en español
5. Apropiados para nivel ${level}
6. Útiles y motivadores para estudiantes
7. Realistas de implementar por el profesor

Genera items variados y atractivos:`;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: 'API Key de Gemini no configurada',
        });
      }

      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });

      const responseText = response.text || '';

      if (!responseText.trim()) {
        return res.status(500).json({
          success: false,
          message: 'La IA no generó contenido',
        });
      }

      let items = [];
      try {
        let cleanText = responseText.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        items = JSON.parse(cleanText);
      } catch (parseError) {
        console.error('Error parsing AI response:', responseText);
        return res.status(500).json({
          success: false,
          message: 'Error al procesar la respuesta de la IA',
        });
      }

      res.json({
        success: true,
        data: {
          items,
          prompt,
        },
      });

    } catch (error: any) {
      console.error('Error generating shop items with AI:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al generar items con IA',
      });
    }
  }
}

export const shopController = new ShopController();
