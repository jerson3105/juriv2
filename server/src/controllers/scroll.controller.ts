import { Request, Response } from 'express';
import { scrollService } from '../services/scroll.service.js';
import type { ScrollCategory, ScrollRecipientType } from '../db/schema.js';

const ensureTeacherClassroomAccess = async (
  req: Request,
  res: Response,
  classroomId: string
): Promise<boolean> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }

  if (user.role === 'ADMIN') {
    return true;
  }

  if (user.role !== 'TEACHER') {
    res.status(403).json({ error: 'No tienes permisos para esta acción' });
    return false;
  }

  const isOwner = await scrollService.verifyTeacherOwnsClassroom(user.id, classroomId);
  if (!isOwner) {
    res.status(403).json({ error: 'No tienes acceso a esta clase' });
    return false;
  }

  return true;
};

const ensureScrollTeacherAccess = async (
  req: Request,
  res: Response,
  scrollId: string
): Promise<boolean> => {
  const classroomId = await scrollService.getClassroomIdByScroll(scrollId);
  if (!classroomId) {
    res.status(404).json({ error: 'Pergamino no encontrado' });
    return false;
  }

  return ensureTeacherClassroomAccess(req, res, classroomId);
};

const resolveStudentProfileInClassroom = async (
  req: Request,
  res: Response,
  classroomId: string,
  requestedStudentProfileId?: string
): Promise<string | null> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: 'No autorizado' });
    return null;
  }

  if (user.role !== 'STUDENT') {
    res.status(403).json({ error: 'Solo los estudiantes pueden realizar esta acción' });
    return null;
  }

  const resolvedStudentProfileId = await scrollService.getStudentProfileInClassroomByUser(user.id, classroomId);

  if (!resolvedStudentProfileId) {
    res.status(403).json({ error: 'No tienes acceso a esta clase' });
    return null;
  }

  if (requestedStudentProfileId && requestedStudentProfileId !== resolvedStudentProfileId) {
    res.status(403).json({ error: 'No tienes permiso para usar ese perfil de estudiante' });
    return null;
  }

  return resolvedStudentProfileId;
};

const ensureStudentProfileReadAccess = async (
  req: Request,
  res: Response,
  studentProfileId: string
): Promise<boolean> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }

  if (user.role === 'ADMIN') {
    return true;
  }

  if (user.role === 'STUDENT') {
    const isOwner = await scrollService.verifyStudentBelongsToUser(studentProfileId, user.id);
    if (!isOwner) {
      res.status(403).json({ error: 'No tienes permiso para este perfil de estudiante' });
      return false;
    }

    return true;
  }

  if (user.role === 'TEACHER') {
    const classroomId = await scrollService.getClassroomIdByStudentProfile(studentProfileId);
    if (!classroomId) {
      res.status(404).json({ error: 'Perfil de estudiante no encontrado' });
      return false;
    }

    const isOwner = await scrollService.verifyTeacherOwnsClassroom(user.id, classroomId);
    if (!isOwner) {
      res.status(403).json({ error: 'No tienes acceso a este perfil de estudiante' });
      return false;
    }

    return true;
  }

  res.status(403).json({ error: 'No tienes permisos para esta acción' });
  return false;
};

// Crear un nuevo pergamino (estudiante)
export const createScroll = async (req: Request, res: Response) => {
  try {
    const { classroomId } = req.params;
    const { 
      authorId, 
      message, 
      imageUrl, 
      category, 
      recipientType, 
      recipientIds 
    } = req.body;

    const studentProfileId = await resolveStudentProfileInClassroom(req, res, classroomId, authorId);
    if (!studentProfileId) return;

    if (!message || !category || !recipientType) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos: message, category, recipientType' 
      });
    }

    const scroll = await scrollService.createScroll({
      classroomId,
      authorId: studentProfileId,
      message,
      imageUrl,
      category: category as ScrollCategory,
      recipientType: recipientType as ScrollRecipientType,
      recipientIds: Array.isArray(recipientIds) ? recipientIds : undefined,
    });

    res.status(201).json(scroll);
  } catch (error: any) {
    console.error('Error creating scroll:', error);
    res.status(400).json({ error: error.message || 'Error al crear el pergamino' });
  }
};

// Obtener pergaminos aprobados del mural (público)
export const getApprovedScrolls = async (req: Request, res: Response) => {
  try {
    const { classroomId } = req.params;
    const { category, startDate, endDate } = req.query;

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    let currentStudentId: string | undefined;

    if (user.role === 'STUDENT') {
      const studentProfileId = await resolveStudentProfileInClassroom(req, res, classroomId);
      if (!studentProfileId) return;
      currentStudentId = studentProfileId;
    } else if (user.role === 'TEACHER') {
      const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!hasAccess) return;
    }

    const filters: any = {};
    if (category) filters.category = category as ScrollCategory;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const scrolls = await scrollService.getApprovedScrolls(
      classroomId,
      currentStudentId,
      filters
    );

    res.json(scrolls);
  } catch (error: any) {
    console.error('Error getting approved scrolls:', error);
    res.status(500).json({ error: 'Error al obtener los pergaminos' });
  }
};

// Obtener pergaminos pendientes (profesor)
export const getPendingScrolls = async (req: Request, res: Response) => {
  try {
    const { classroomId } = req.params;

    const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
    if (!hasAccess) return;
    
    const scrolls = await scrollService.getPendingScrolls(classroomId);
    res.json(scrolls);
  } catch (error: any) {
    console.error('Error getting pending scrolls:', error);
    res.status(500).json({ error: 'Error al obtener los pergaminos pendientes' });
  }
};

// Aprobar pergamino (profesor)
export const approveScroll = async (req: Request, res: Response) => {
  try {
    const { scrollId } = req.params;

    const hasAccess = await ensureScrollTeacherAccess(req, res, scrollId);
    if (!hasAccess) return;

    const reviewerId = req.user!.id;

    const scroll = await scrollService.approveScroll(scrollId, reviewerId);
    res.json(scroll);
  } catch (error: any) {
    console.error('Error approving scroll:', error);
    res.status(500).json({ error: 'Error al aprobar el pergamino' });
  }
};

// Rechazar pergamino (profesor)
export const rejectScroll = async (req: Request, res: Response) => {
  try {
    const { scrollId } = req.params;
    const { reason } = req.body;

    const hasAccess = await ensureScrollTeacherAccess(req, res, scrollId);
    if (!hasAccess) return;

    const reviewerId = req.user!.id;

    if (!reason) {
      return res.status(400).json({ error: 'Debes indicar una razón para rechazar el pergamino' });
    }

    const scroll = await scrollService.rejectScroll(scrollId, reviewerId, reason);
    res.json(scroll);
  } catch (error: any) {
    console.error('Error rejecting scroll:', error);
    res.status(500).json({ error: 'Error al rechazar el pergamino' });
  }
};

// Agregar/quitar reacción (estudiante)
export const toggleReaction = async (req: Request, res: Response) => {
  try {
    const { scrollId } = req.params;
    const { studentProfileId, reactionType } = req.body;

    if (!reactionType) {
      return res.status(400).json({ error: 'Falta el campo reactionType' });
    }

    const classroomId = await scrollService.getClassroomIdByScroll(scrollId);
    if (!classroomId) {
      return res.status(404).json({ error: 'Pergamino no encontrado' });
    }

    const resolvedStudentProfileId = await resolveStudentProfileInClassroom(
      req,
      res,
      classroomId,
      studentProfileId
    );
    if (!resolvedStudentProfileId) return;

    await scrollService.addReaction(scrollId, resolvedStudentProfileId, reactionType);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error toggling reaction:', error);
    res.status(400).json({ error: error.message || 'Error al procesar la reacción' });
  }
};

// Eliminar pergamino
export const deleteScroll = async (req: Request, res: Response) => {
  try {
    const { scrollId } = req.params;

    const hasAccess = await ensureScrollTeacherAccess(req, res, scrollId);
    if (!hasAccess) return;

    await scrollService.deleteScroll(scrollId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting scroll:', error);
    res.status(500).json({ error: 'Error al eliminar el pergamino' });
  }
};

// Obtener pergaminos del estudiante (enviados por él)
export const getStudentScrolls = async (req: Request, res: Response) => {
  try {
    const { studentProfileId } = req.params;

    const hasAccess = await ensureStudentProfileReadAccess(req, res, studentProfileId);
    if (!hasAccess) return;

    const scrolls = await scrollService.getStudentScrolls(studentProfileId);
    res.json(scrolls);
  } catch (error: any) {
    console.error('Error getting student scrolls:', error);
    res.status(500).json({ error: 'Error al obtener los pergaminos del estudiante' });
  }
};

// Obtener estadísticas del mural (profesor)
export const getScrollStats = async (req: Request, res: Response) => {
  try {
    const { classroomId } = req.params;

    const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
    if (!hasAccess) return;

    const stats = await scrollService.getScrollStats(classroomId);
    res.json(stats);
  } catch (error: any) {
    console.error('Error getting scroll stats:', error);
    res.status(500).json({ error: 'Error al obtener las estadísticas' });
  }
};

// Abrir/cerrar el mural (profesor)
export const toggleScrollsOpen = async (req: Request, res: Response) => {
  try {
    const { classroomId } = req.params;
    const { isOpen } = req.body;

    const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
    if (!hasAccess) return;

    if (typeof isOpen !== 'boolean') {
      return res.status(400).json({ error: 'El campo isOpen debe ser un booleano' });
    }

    await scrollService.toggleScrollsOpen(classroomId, isOpen);
    res.json({ success: true, isOpen });
  } catch (error: any) {
    console.error('Error toggling scrolls open:', error);
    res.status(500).json({ error: 'Error al cambiar el estado del mural' });
  }
};

// Actualizar configuración del mural (profesor)
export const updateScrollsConfig = async (req: Request, res: Response) => {
  try {
    const { classroomId } = req.params;
    const { enabled, maxPerDay, requireApproval } = req.body;

    const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
    if (!hasAccess) return;

    await scrollService.updateScrollsConfig(classroomId, {
      enabled,
      maxPerDay,
      requireApproval,
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating scrolls config:', error);
    res.status(500).json({ error: 'Error al actualizar la configuración' });
  }
};
