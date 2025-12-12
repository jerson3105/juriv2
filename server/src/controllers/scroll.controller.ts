import { Request, Response } from 'express';
import { scrollService } from '../services/scroll.service.js';
import type { ScrollCategory, ScrollRecipientType } from '../db/schema.js';

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

    if (!authorId || !message || !category || !recipientType) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos: authorId, message, category, recipientType' 
      });
    }

    const scroll = await scrollService.createScroll({
      classroomId,
      authorId,
      message,
      imageUrl,
      category: category as ScrollCategory,
      recipientType: recipientType as ScrollRecipientType,
      recipientIds,
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
    const { category, startDate, endDate, studentProfileId } = req.query;

    const filters: any = {};
    if (category) filters.category = category as ScrollCategory;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const scrolls = await scrollService.getApprovedScrolls(
      classroomId,
      studentProfileId as string | undefined,
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

    if (!studentProfileId || !reactionType) {
      return res.status(400).json({ error: 'Faltan campos: studentProfileId, reactionType' });
    }

    await scrollService.addReaction(scrollId, studentProfileId, reactionType);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error toggling reaction:', error);
    res.status(500).json({ error: 'Error al procesar la reacción' });
  }
};

// Eliminar pergamino
export const deleteScroll = async (req: Request, res: Response) => {
  try {
    const { scrollId } = req.params;

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
