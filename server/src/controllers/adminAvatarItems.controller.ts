import type { Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { AppError, ValidationError } from '../utils/errors.js';
import { MAX_AVATAR_LAYER_BYTES } from '../utils/avatarUpload.js';
import { adminAvatarItemsService } from '../services/adminAvatarItems.service.js';

const SLOTS = ['HEAD', 'HAIR', 'EYES', 'TOP', 'BOTTOM', 'LEFT_HAND', 'RIGHT_HAND', 'SHOES', 'BACK', 'FLAG', 'BACKGROUND'] as const;
const RARITIES = ['COMMON', 'RARE', 'LEGENDARY'] as const;

const idSchema = z.string().uuid();
const nameSchema = z.string().trim().min(1, 'Ponle un nombre').max(100, 'El nombre es muy largo');
const descriptionSchema = z.string().trim().max(500, 'La descripción es muy larga');

// Los campos llegan como texto en el multipart.
const createSchema = z.object({
  name: nameSchema,
  description: descriptionSchema.optional(),
  gender: z.enum(['MALE', 'FEMALE']),
  slot: z.enum(SLOTS),
  rarity: z.enum(RARITIES),
  pairWith: idSchema.optional(),
}).strict();

const updateSchema = z.object({
  name: nameSchema.optional(),
  description: descriptionSchema.nullable().optional(),
  rarity: z.enum(RARITIES).optional(),
  isDefault: z.boolean().optional(),
  slot: z.enum(SLOTS).optional(),
}).strict();

const pairSchema = z.object({ otherItemId: idSchema }).strict();
const withPairSchema = z.object({ withPair: z.boolean().optional() }).strict();

/** La capa final de «Completa»: un solo PNG en memoria (se revisa y recodifica antes de tocar el disco). */
const layerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_LAYER_BYTES, files: 1, fields: 12, fieldSize: 10_000, parts: 14 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/png') cb(null, true);
    else cb(new ValidationError('La imagen debe ser un PNG.'));
  },
});

export const uploadAvatarLayer: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  layerUpload.single('image')(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const tooBig = error.code === 'LIMIT_FILE_SIZE';
      res.status(tooBig ? 413 : 400).json({ success: false, message: tooBig ? 'La imagen pesa más de 2 MB.' : 'No se pudo leer la imagen.' });
      return;
    }
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    next(error);
  });
};

const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ success: false, message: error.issues[0]?.message ?? 'Datos inválidos' });
  }
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

const requireImage = (req: Request): Buffer => {
  if (!req.file?.buffer) throw new ValidationError('Falta la imagen de la prenda.');
  return req.file.buffer;
};

export const adminAvatarItemsController = {
  async list(_req: Request, res: Response) {
    try {
      res.json({ success: true, data: await adminAvatarItemsService.list() });
    } catch (error) {
      fail(res, error, 'Error al obtener las prendas');
    }
  },

  async get(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await adminAvatarItemsService.get(idSchema.parse(req.params.itemId)) });
    } catch (error) {
      fail(res, error, 'Error al obtener la prenda');
    }
  },

  async create(req: Request, res: Response) {
    try {
      const input = createSchema.parse(req.body);
      const data = await adminAvatarItemsService.create(req.user!.id, input, requireImage(req));
      res.status(201).json({ success: true, data, message: 'Borrador guardado' });
    } catch (error) {
      fail(res, error, 'Error al guardar la prenda');
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data = await adminAvatarItemsService.update(req.user!.id, idSchema.parse(req.params.itemId), updateSchema.parse(req.body));
      res.json({ success: true, data, message: 'Prenda actualizada' });
    } catch (error) {
      fail(res, error, 'Error al actualizar la prenda');
    }
  },

  async replaceImage(req: Request, res: Response) {
    try {
      const data = await adminAvatarItemsService.replaceImage(req.user!.id, idSchema.parse(req.params.itemId), requireImage(req));
      res.json({ success: true, data, message: 'Imagen cambiada' });
    } catch (error) {
      fail(res, error, 'Error al cambiar la imagen');
    }
  },

  async publish(req: Request, res: Response) {
    try {
      const data = await adminAvatarItemsService.publish(req.user!.id, idSchema.parse(req.params.itemId));
      res.json({ success: true, data, message: 'Prenda publicada' });
    } catch (error) {
      fail(res, error, 'Error al publicar la prenda');
    }
  },

  async retire(req: Request, res: Response) {
    try {
      const { withPair } = withPairSchema.parse(req.body ?? {});
      const data = await adminAvatarItemsService.retire(req.user!.id, idSchema.parse(req.params.itemId), withPair ?? false);
      res.json({ success: true, data, message: 'Prenda retirada' });
    } catch (error) {
      fail(res, error, 'Error al retirar la prenda');
    }
  },

  async restore(req: Request, res: Response) {
    try {
      const { withPair } = withPairSchema.parse(req.body ?? {});
      const data = await adminAvatarItemsService.restore(req.user!.id, idSchema.parse(req.params.itemId), withPair ?? false);
      res.json({ success: true, data, message: 'Prenda reactivada' });
    } catch (error) {
      fail(res, error, 'Error al reactivar la prenda');
    }
  },

  async pair(req: Request, res: Response) {
    try {
      const { otherItemId } = pairSchema.parse(req.body);
      const data = await adminAvatarItemsService.pair(req.user!.id, idSchema.parse(req.params.itemId), otherItemId);
      res.json({ success: true, data, message: 'Versiones vinculadas' });
    } catch (error) {
      fail(res, error, 'Error al vincular las versiones');
    }
  },

  async unpair(req: Request, res: Response) {
    try {
      const data = await adminAvatarItemsService.unpair(req.user!.id, idSchema.parse(req.params.itemId));
      res.json({ success: true, data, message: 'Versiones separadas' });
    } catch (error) {
      fail(res, error, 'Error al separar las versiones');
    }
  },
};
