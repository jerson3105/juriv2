import { Request, Response } from 'express';
import { avatarService } from '../services/avatar.service.js';
import { avatarCatalogService } from '../services/avatarCatalog.service.js';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import {
  requireStudentProfileOwner,
  requireStudentProfileReadAccess,
  requireClassroomTeacher,
  requireClassroomMember,
  requireResourceMember,
  requireStudentsMember,
  classroomIdOfStudentProfile,
} from '../utils/access.js';

const MAX_AVATAR_PRICE = 100000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const slotSchema = z.enum(['HEAD', 'HAIR', 'EYES', 'TOP', 'BOTTOM', 'LEFT_HAND', 'RIGHT_HAND', 'SHOES', 'BACK', 'FLAG', 'BACKGROUND']);
const idSchema = z.string().regex(UUID, 'Identificador inválido');
const applyToSchema = z.array(idSchema).max(50).optional();

const purchaseSchema = z.object({
  studentProfileId: idSchema,
  avatarItemId: idSchema,
  classroomId: idSchema.optional(),
  equip: z.boolean().optional(),
});
const giftSchema = z.object({ studentProfileId: idSchema, avatarItemId: idSchema, equip: z.boolean().optional() });
const goalSchema = z.object({ avatarItemId: idSchema.nullable() });
const bodySchema = z.object({ gender: z.enum(['MALE', 'FEMALE'], { errorMap: () => ({ message: 'Elige chico o chica' }) }) });
const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  priceLevel: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  refreshPrices: z.boolean().optional(),
  applyTo: applyToSchema,
});
const collectionSchema = z.object({ hidden: z.boolean(), applyTo: applyToSchema });
const itemSchema = z.object({
  hidden: z.boolean().optional(),
  price: z.number().int('El precio debe ser un número entero').min(0, 'El precio no puede ser negativo').max(MAX_AVATAR_PRICE, 'El precio es demasiado alto').nullable().optional(),
  applyTo: applyToSchema,
});

// Errores con mensaje para la persona (AppError, Zod) o 500 genérico.
const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Datos inválidos' });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

// La clase de la ruta y las de «Aplicar a mis otras clases»: todas del docente.
const teacherClassrooms = async (req: Request, res: Response, applyTo?: string[]) => {
  const { classroomId } = req.params;
  if (!(await requireClassroomTeacher(req, res, classroomId))) return null;
  if (req.user!.role === 'ADMIN' || !applyTo?.length) return [classroomId];
  return avatarCatalogService.assertTeacherClassrooms(req.user!.id, [classroomId, ...applyTo]);
};

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

  // Lo que ve un alumno en la tienda de avatar de la clase (catálogo automático con precios de la clase).
  async getClassroomShopItems(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await requireClassroomMember(req, res, classroomId))) return;
      const gender = req.query.gender === 'MALE' || req.query.gender === 'FEMALE' ? req.query.gender : undefined;
      res.json({ success: true, data: await avatarCatalogService.getClassroomShopItems(classroomId, gender) });
    } catch (error) {
      fail(res, error, 'Error al obtener la tienda de avatar');
    }
  },

  // ==================== DOCENTE: CATÁLOGO DE LA CLASE ====================

  async getTeacherCatalog(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      res.json({ success: true, data: await avatarCatalogService.getTeacherCatalog(classroomId, req.user!.id) });
    } catch (error) {
      fail(res, error, 'No se pudo cargar la tienda de avatar');
    }
  },

  async updateSettings(req: Request, res: Response) {
    try {
      const data = settingsSchema.parse(req.body);
      const ids = await teacherClassrooms(req, res, data.applyTo);
      if (!ids) return;
      await avatarCatalogService.updateSettings(ids, data);
      res.json({ success: true, data: { classroomIds: ids } });
    } catch (error) {
      fail(res, error, 'No se pudo guardar la tienda de avatar');
    }
  },

  async setCollection(req: Request, res: Response) {
    try {
      const data = collectionSchema.parse(req.body);
      const collectionId = idSchema.parse(req.params.collectionId);
      const ids = await teacherClassrooms(req, res, data.applyTo);
      if (!ids) return;
      await avatarCatalogService.setCollectionHidden(ids, collectionId, data.hidden);
      res.json({ success: true, data: { classroomIds: ids } });
    } catch (error) {
      fail(res, error, 'No se pudo cambiar la colección');
    }
  },

  async setItem(req: Request, res: Response) {
    try {
      const data = itemSchema.parse(req.body);
      const avatarItemId = idSchema.parse(req.params.avatarItemId);
      if (data.hidden === undefined && data.price === undefined) {
        return res.status(400).json({ success: false, message: 'Indica si se oculta o su precio' });
      }
      const ids = await teacherClassrooms(req, res, data.applyTo);
      if (!ids) return;
      await avatarCatalogService.setItemException(ids, avatarItemId, { hidden: data.hidden, price: data.price });
      res.json({ success: true, data: { classroomIds: ids } });
    } catch (error) {
      fail(res, error, 'No se pudo cambiar la prenda');
    }
  },

  // ==================== ALUMNO ====================

  // «Mi avatar»: solo el dueño del perfil (otro perfil → 404).
  async getStudentView(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await avatarCatalogService.getStudentView(req.params.studentProfileId, req.user!.id) });
    } catch (error) {
      fail(res, error, 'No se pudo cargar tu avatar');
    }
  },

  async purchaseItem(req: Request, res: Response) {
    try {
      const data = purchaseSchema.parse(req.body);
      if (!(await requireStudentProfileOwner(req, res, data.studentProfileId))) return;
      const result = await avatarCatalogService.purchase(data.studentProfileId, data.avatarItemId, { classroomId: data.classroomId, equip: data.equip });
      res.json({ success: true, message: '¡Comprada!', data: result });
    } catch (error) {
      fail(res, error, 'No se pudo comprar la prenda');
    }
  },

  // La prenda de regalo: una común, gratis, una vez por perfil.
  async claimGift(req: Request, res: Response) {
    try {
      const data = giftSchema.parse(req.body);
      if (!(await requireStudentProfileOwner(req, res, data.studentProfileId))) return;
      const result = await avatarCatalogService.claimGift(data.studentProfileId, data.avatarItemId, { equip: data.equip });
      res.json({ success: true, message: '¡Es tuya!', data: result });
    } catch (error) {
      fail(res, error, 'No se pudo elegir tu regalo');
    }
  },

  // Meta de ahorro con una prenda (la única meta: reemplaza a la de premios); null la quita.
  async setGoal(req: Request, res: Response) {
    try {
      const studentProfileId = idSchema.parse(req.params.studentProfileId);
      const { avatarItemId } = goalSchema.parse(req.body);
      if (!(await requireStudentProfileOwner(req, res, studentProfileId))) return;
      res.json({ success: true, data: await avatarCatalogService.setGoal(studentProfileId, avatarItemId) });
    } catch (error) {
      fail(res, error, 'No se pudo guardar tu meta');
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
      const studentProfileId = idSchema.parse(req.body?.studentProfileId);
      const avatarItemId = idSchema.parse(req.body?.avatarItemId);
      if (!(await requireStudentProfileOwner(req, res, studentProfileId))) return;
      res.json({ success: true, message: 'Prenda puesta', data: await avatarCatalogService.equip(studentProfileId, avatarItemId) });
    } catch (error) {
      fail(res, error, 'No se pudo poner la prenda');
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

  // Cambiar de cuerpo: el alumno dueño (salvo de inicial a 2.º) o el docente de su clase (también para perfiles sin cuenta).
  async setBody(req: Request, res: Response) {
    try {
      const studentProfileId = idSchema.parse(req.params.studentProfileId);
      const { gender } = bodySchema.parse(req.body);
      const byStudent = req.user!.role === 'STUDENT';
      if (req.user!.role === 'TEACHER') {
        const classroomId = await classroomIdOfStudentProfile(studentProfileId);
        if (!classroomId) return res.status(404).json({ success: false, message: 'Estudiante no encontrado' });
        if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      } else if (!(await requireStudentProfileOwner(req, res, studentProfileId))) {
        return;
      }
      res.json({ success: true, data: await avatarCatalogService.setBody(studentProfileId, gender, { byStudent }) });
    } catch (error) {
      fail(res, error, 'No se pudo cambiar el cuerpo del avatar');
    }
  },

  // Items equipados de varios alumnos en una petición (las listas renderizan un mini-avatar por
  // alumno; antes era una petición por alumno).
  async getEquippedItemsBatch(req: Request, res: Response) {
    try {
      const ids = req.body?.studentProfileIds;
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
