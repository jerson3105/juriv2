import { Request, Response } from 'express';
import { clanService, CLAN_EMBLEMS, CLAN_COLORS } from '../services/clan.service.js';
import { z } from 'zod';

const createClanSchema = z.object({
  name: z.string().min(2).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  emblem: z.string().optional(),
  motto: z.string().max(255).optional(),
  maxMembers: z.number().min(2).max(50).optional(),
});

const updateClanSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  emblem: z.string().optional(),
  motto: z.string().max(255).optional(),
  maxMembers: z.number().min(2).max(50).optional(),
  isActive: z.boolean().optional(),
});

const assignStudentSchema = z.object({
  studentId: z.string().uuid(),
});

const historyLimitSchema = z.coerce.number().int().min(1).max(200).default(50);

const handleControllerError = (res: Response, error: unknown, fallbackMessage: string) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Datos inválidos',
      errors: error.errors,
    });
  }

  if (error instanceof Error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
};

const ensureTeacherClassroomAccess = async (
  req: Request,
  res: Response,
  classroomId: string
): Promise<boolean> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ success: false, message: 'No autorizado' });
    return false;
  }

  if (user.role === 'ADMIN') {
    return true;
  }

  if (user.role !== 'TEACHER') {
    res.status(403).json({ success: false, message: 'No tienes permisos para esta acción' });
    return false;
  }

  const isOwner = await clanService.verifyTeacherOwnsClassroom(user.id, classroomId);
  if (!isOwner) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta clase' });
    return false;
  }

  return true;
};

const ensureClassroomReadAccess = async (
  req: Request,
  res: Response,
  classroomId: string
): Promise<boolean> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ success: false, message: 'No autorizado' });
    return false;
  }

  if (user.role === 'ADMIN') {
    return true;
  }

  if (user.role === 'TEACHER') {
    const isOwner = await clanService.verifyTeacherOwnsClassroom(user.id, classroomId);
    if (!isOwner) {
      res.status(403).json({ success: false, message: 'No tienes acceso a esta clase' });
      return false;
    }

    return true;
  }

  if (user.role === 'STUDENT') {
    const isMember = await clanService.verifyStudentUserInClassroom(user.id, classroomId);
    if (!isMember) {
      res.status(403).json({ success: false, message: 'No tienes acceso a esta clase' });
      return false;
    }

    return true;
  }

  res.status(403).json({ success: false, message: 'No tienes permisos para esta acción' });
  return false;
};

const ensureTeacherClanAccess = async (
  req: Request,
  res: Response,
  clanId: string
): Promise<boolean> => {
  const classroomId = await clanService.getClassroomIdByClan(clanId);
  if (!classroomId) {
    res.status(404).json({ success: false, message: 'Clan no encontrado' });
    return false;
  }

  return ensureTeacherClassroomAccess(req, res, classroomId);
};

const ensureClanReadAccess = async (
  req: Request,
  res: Response,
  clanId: string
): Promise<boolean> => {
  const classroomId = await clanService.getClassroomIdByClan(clanId);
  if (!classroomId) {
    res.status(404).json({ success: false, message: 'Clan no encontrado' });
    return false;
  }

  return ensureClassroomReadAccess(req, res, classroomId);
};

const ensureTeacherStudentAccess = async (
  req: Request,
  res: Response,
  studentProfileId: string
): Promise<boolean> => {
  const classroomId = await clanService.getClassroomIdByStudentProfile(studentProfileId);
  if (!classroomId) {
    res.status(404).json({ success: false, message: 'Estudiante no encontrado' });
    return false;
  }

  return ensureTeacherClassroomAccess(req, res, classroomId);
};

const ensureStudentOwnsProfile = async (
  req: Request,
  res: Response,
  studentProfileId: string
): Promise<boolean> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ success: false, message: 'No autorizado' });
    return false;
  }

  if (user.role !== 'STUDENT') {
    res.status(403).json({ success: false, message: 'No tienes permisos para esta acción' });
    return false;
  }

  const isOwner = await clanService.verifyStudentBelongsToUser(studentProfileId, user.id);
  if (!isOwner) {
    res.status(403).json({ success: false, message: 'No tienes permiso para este perfil de estudiante' });
    return false;
  }

  return true;
};

class ClanController {
  // Obtener opciones disponibles (emblemas y colores)
  async getOptions(_req: Request, res: Response) {
    res.json({
      success: true,
      data: {
        emblems: CLAN_EMBLEMS,
        colors: CLAN_COLORS,
      },
    });
  }

  // Obtener todos los clanes de una clase
  async getClassroomClans(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;

      const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!hasAccess) return;

      const clans = await clanService.getClassroomClans(classroomId);

      res.json({
        success: true,
        data: clans,
      });
    } catch (error) {
      return handleControllerError(res, error, 'Error al obtener clanes');
    }
  }

  // Obtener un clan específico
  async getClan(req: Request, res: Response) {
    try {
      const { clanId } = req.params;

      const hasAccess = await ensureClanReadAccess(req, res, clanId);
      if (!hasAccess) return;

      const clan = await clanService.getClanById(clanId);

      if (!clan) {
        return res.status(404).json({
          success: false,
          message: 'Clan no encontrado',
        });
      }

      res.json({
        success: true,
        data: clan,
      });
    } catch (error) {
      return handleControllerError(res, error, 'Error al obtener clan');
    }
  }

  // Crear un nuevo clan
  async createClan(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const data = createClanSchema.parse(req.body);

      const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!hasAccess) return;

      const clan = await clanService.createClan({
        classroomId,
        ...data,
      });

      res.status(201).json({
        success: true,
        message: 'Clan creado exitosamente',
        data: clan,
      });
    } catch (error) {
      return handleControllerError(res, error, 'Error al crear clan');
    }
  }

  // Actualizar un clan
  async updateClan(req: Request, res: Response) {
    try {
      const { clanId } = req.params;
      const data = updateClanSchema.parse(req.body);

      const hasAccess = await ensureTeacherClanAccess(req, res, clanId);
      if (!hasAccess) return;

      const clan = await clanService.updateClan(clanId, data);

      res.json({
        success: true,
        message: 'Clan actualizado',
        data: clan,
      });
    } catch (error) {
      return handleControllerError(res, error, 'Error al actualizar clan');
    }
  }

  // Eliminar un clan
  async deleteClan(req: Request, res: Response) {
    try {
      const { clanId } = req.params;

      const hasAccess = await ensureTeacherClanAccess(req, res, clanId);
      if (!hasAccess) return;

      await clanService.deleteClan(clanId);

      res.json({
        success: true,
        message: 'Clan eliminado',
      });
    } catch (error) {
      return handleControllerError(res, error, 'Error al eliminar clan');
    }
  }

  // Asignar estudiante a un clan
  async assignStudent(req: Request, res: Response) {
    try {
      const { clanId } = req.params;
      const { studentId } = assignStudentSchema.parse(req.body);

      const hasClanAccess = await ensureTeacherClanAccess(req, res, clanId);
      if (!hasClanAccess) return;

      const hasStudentAccess = await ensureTeacherStudentAccess(req, res, studentId);
      if (!hasStudentAccess) return;

      const clan = await clanService.assignStudentToClan(studentId, clanId);

      res.json({
        success: true,
        message: 'Estudiante asignado al clan',
        data: clan,
      });
    } catch (error) {
      return handleControllerError(res, error, 'Error al asignar estudiante');
    }
  }

  // Quitar estudiante de un clan
  async removeStudent(req: Request, res: Response) {
    try {
      const { studentId } = req.params;

      const hasAccess = await ensureTeacherStudentAccess(req, res, studentId);
      if (!hasAccess) return;

      await clanService.removeStudentFromClan(studentId);

      res.json({
        success: true,
        message: 'Estudiante removido del clan',
      });
    } catch (error) {
      return handleControllerError(res, error, 'Error al remover estudiante');
    }
  }

  // Asignar estudiantes aleatoriamente
  async assignRandomly(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;

      const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!hasAccess) return;

      const result = await clanService.assignStudentsRandomly(classroomId);

      res.json({
        success: true,
        message: `${result.assigned} estudiantes asignados a ${result.clans} clanes`,
        data: result,
      });
    } catch (error) {
      return handleControllerError(res, error, 'Error al asignar estudiantes');
    }
  }

  // Obtener ranking de clanes
  async getRanking(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;

      const hasAccess = await ensureClassroomReadAccess(req, res, classroomId);
      if (!hasAccess) return;

      const ranking = await clanService.getClanRanking(classroomId);

      res.json({
        success: true,
        data: ranking,
      });
    } catch (error) {
      return handleControllerError(res, error, 'Error al obtener ranking');
    }
  }

  // Obtener historial de un clan
  async getClanHistory(req: Request, res: Response) {
    try {
      const { clanId } = req.params;

      const hasAccess = await ensureClanReadAccess(req, res, clanId);
      if (!hasAccess) return;

      const limit = historyLimitSchema.parse(req.query.limit ?? 50);
      const history = await clanService.getClanHistory(clanId, limit);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      return handleControllerError(res, error, 'Error al obtener historial');
    }
  }

  // Obtener información del clan de un estudiante
  async getStudentClanInfo(req: Request, res: Response) {
    try {
      const { studentId } = req.params;

      const hasAccess = await ensureStudentOwnsProfile(req, res, studentId);
      if (!hasAccess) return;

      const info = await clanService.getStudentClanInfo(studentId);

      res.json({
        success: true,
        data: info,
      });
    } catch (error) {
      return handleControllerError(res, error, 'Error al obtener información del clan');
    }
  }
}

export const clanController = new ClanController();
