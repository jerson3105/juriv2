import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError, ValidationError } from '../utils/errors.js';
import { requireClassroomTeacher, requireClassroomTeacherOrParent } from '../utils/access.js';
import { cleanMessageText, MESSAGE_MAX_LENGTH } from '../utils/messageText.js';
import { decodeRoomCursor, familyRoomService, type RoomViewer } from '../services/familyRoom.service.js';

const idSchema = z.string().uuid('Identificador no válido');
const listSchema = z.object({
  before: z.string({ invalid_type_error: 'Página no válida' }).max(80, 'Página no válida').optional(),
  limit: z.coerce.number({ invalid_type_error: 'Cantidad no válida' }).int('Cantidad no válida')
    .min(1, 'Cantidad no válida').max(100, 'Cantidad no válida').optional(),
});
const postSchema = z.object({
  kind: z.enum(['MESSAGE', 'ANNOUNCEMENT'], { errorMap: () => ({ message: 'Tipo de mensaje no válido' }) }).optional(),
  // Tope del texto crudo; el límite real se mide después de limpiarlo.
  message: z.string({ required_error: 'Escribe un mensaje', invalid_type_error: 'Escribe un mensaje' })
    .max(MESSAGE_MAX_LENGTH * 2, `El mensaje no puede pasar de ${MESSAGE_MAX_LENGTH} caracteres`),
}).strict('Datos no válidos');
const settingsSchema = z.object({
  isOpen: z.boolean({ required_error: 'Indica si las familias pueden escribir', invalid_type_error: 'Indica si las familias pueden escribir' }),
}).strict('Datos no válidos');

// Los 500 nunca devuelven el error crudo (podía traer SQL): solo el mensaje genérico.
const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ success: false, message: error.issues[0]?.message ?? 'Datos inválidos' });
  }
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

// El rol sale de la sesión, nunca del cuerpo (las rutas solo admiten TEACHER y PARENT).
const viewerOf = (req: Request): RoomViewer => ({ id: req.user!.id, role: req.user!.role === 'TEACHER' ? 'TEACHER' : 'PARENT' });

export const familyRoomController = {
  /** GET /classrooms/:id/room?before&limit */
  async list(req: Request, res: Response) {
    try {
      const classroomId = idSchema.parse(req.params.id);
      if (!(await requireClassroomTeacherOrParent(req, res, classroomId))) return;
      const query = listSchema.parse(req.query);
      const before = query.before ? decodeRoomCursor(query.before) : undefined;
      if (before === null) throw new ValidationError('Página no válida');
      const data = await familyRoomService.listMessages(classroomId, viewerOf(req), { before, limit: query.limit ?? 50 });
      res.json({ success: true, data });
    } catch (error) {
      fail(res, error, 'Error al cargar la sala');
    }
  },

  /** POST /classrooms/:id/room/messages { kind?, message } */
  async post(req: Request, res: Response) {
    try {
      const classroomId = idSchema.parse(req.params.id);
      if (!(await requireClassroomTeacherOrParent(req, res, classroomId))) return;
      const input = postSchema.parse(req.body);
      const text = cleanMessageText(input.message);
      if (!text) throw new ValidationError('Escribe un mensaje');
      if (text.length > MESSAGE_MAX_LENGTH) throw new ValidationError(`El mensaje no puede pasar de ${MESSAGE_MAX_LENGTH} caracteres`);
      const data = await familyRoomService.postMessage(classroomId, viewerOf(req), input.kind ?? 'MESSAGE', text);
      res.status(201).json({ success: true, data });
    } catch (error) {
      fail(res, error, 'Error al publicar en la sala');
    }
  },

  /** DELETE /classrooms/:id/room/messages/:messageId — «Borrar para todos» (docente) */
  async remove(req: Request, res: Response) {
    try {
      const classroomId = idSchema.parse(req.params.id);
      const messageId = idSchema.parse(req.params.messageId);
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      const data = await familyRoomService.deleteMessage(classroomId, messageId, req.user!.id);
      res.json({ success: true, data, message: 'Borrado para todos' });
    } catch (error) {
      fail(res, error, 'Error al borrar el mensaje');
    }
  },

  /** GET /classrooms/:id/room/messages/:messageId/readers — quién vio el aviso y quién falta (docente) */
  async readers(req: Request, res: Response) {
    try {
      const classroomId = idSchema.parse(req.params.id);
      const messageId = idSchema.parse(req.params.messageId);
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      res.json({ success: true, data: await familyRoomService.getReaders(classroomId, messageId) });
    } catch (error) {
      fail(res, error, 'Error al cargar quién vio el aviso');
    }
  },

  /** PATCH /classrooms/:id/room/settings { isOpen } — «Las familias pueden escribir» (docente) */
  async updateSettings(req: Request, res: Response) {
    try {
      const classroomId = idSchema.parse(req.params.id);
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      const { isOpen } = settingsSchema.parse(req.body);
      res.json({ success: true, data: await familyRoomService.setOpen(classroomId, isOpen, req.user!.id) });
    } catch (error) {
      fail(res, error, 'Error al cambiar la sala');
    }
  },

  /** POST /classrooms/:id/room/read — leí hasta ahora */
  async markRead(req: Request, res: Response) {
    try {
      const classroomId = idSchema.parse(req.params.id);
      if (!(await requireClassroomTeacherOrParent(req, res, classroomId))) return;
      await familyRoomService.markRead(classroomId, viewerOf(req));
      res.json({ success: true });
    } catch (error) {
      fail(res, error, 'Error al marcar como leído');
    }
  },

  /** GET /classrooms/:id/room/unread */
  async unread(req: Request, res: Response) {
    try {
      const classroomId = idSchema.parse(req.params.id);
      if (!(await requireClassroomTeacherOrParent(req, res, classroomId))) return;
      res.json({ success: true, data: { count: await familyRoomService.unreadCount(classroomId, viewerOf(req)) } });
    } catch (error) {
      fail(res, error, 'Error al contar los mensajes sin leer');
    }
  },

  /** GET /classrooms/:id/room/families — alumnos, códigos, familias y solicitudes (docente) */
  async families(req: Request, res: Response) {
    try {
      const classroomId = idSchema.parse(req.params.id);
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      res.json({ success: true, data: await familyRoomService.getFamilies(classroomId) });
    } catch (error) {
      fail(res, error, 'Error al cargar las familias');
    }
  },

  /** DELETE /classrooms/:id/room/families/:linkId — quitar una familia vinculada (docente) */
  async revokeFamily(req: Request, res: Response) {
    try {
      const classroomId = idSchema.parse(req.params.id);
      const linkId = idSchema.parse(req.params.linkId);
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      const data = await familyRoomService.revokeFamily(classroomId, linkId);
      res.json({ success: true, data, message: 'Familia desvinculada' });
    } catch (error) {
      fail(res, error, 'Error al quitar la familia');
    }
  },
};
