import { Request, Response } from 'express';
import { eventsService } from '../services/events.service.js';

class EventsController {
  /**
   * Obtener eventos de una clase
   */
  async getClassroomEvents(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const events = await eventsService.getClassroomEvents(classroomId);

      res.json({
        success: true,
        data: events,
      });
    } catch (error) {
      console.error('Error getting events:', error);
      res.status(500).json({ message: 'Error al obtener eventos' });
    }
  }

  /**
   * Obtener eventos predefinidos del sistema
   */
  async getSystemEvents(req: Request, res: Response) {
    try {
      const events = eventsService.getSystemEvents();

      res.json({
        success: true,
        data: events,
      });
    } catch (error) {
      console.error('Error getting system events:', error);
      res.status(500).json({ message: 'Error al obtener eventos del sistema' });
    }
  }

  /**
   * Crear evento personalizado
   */
  async createEvent(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const eventData = req.body;

      const event = await eventsService.createEvent({
        ...eventData,
        classroomId,
      });

      res.status(201).json({
        success: true,
        data: event,
      });
    } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({ message: 'Error al crear evento' });
    }
  }

  /**
   * Activar/disparar un evento
   */
  async triggerEvent(req: Request, res: Response) {
    try {
      const { classroomId, eventId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'No autorizado' });
      }

      const result = await eventsService.triggerEvent(eventId, classroomId, userId);

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error triggering event:', error);
      res.status(500).json({ message: 'Error al activar evento' });
    }
  }

  /**
   * Activar evento del sistema
   */
  async triggerSystemEvent(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { eventIndex } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'No autorizado' });
      }

      if (eventIndex === undefined || eventIndex === null) {
        return res.status(400).json({ message: 'eventIndex es requerido' });
      }

      const result = await eventsService.triggerSystemEvent(
        eventIndex,
        classroomId,
        userId
      );

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error triggering system event:', error);
      console.error('Error details:', error?.message, error?.stack);
      res.status(500).json({ message: 'Error al activar evento del sistema' });
    }
  }

  /**
   * Obtener historial de eventos
   */
  async getEventLogs(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;

      const logs = await eventsService.getEventLogs(classroomId, limit);

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      console.error('Error getting event logs:', error);
      res.status(500).json({ message: 'Error al obtener historial de eventos' });
    }
  }

  /**
   * Obtener eventos personalizados de una clase
   */
  async getCustomEvents(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const events = await eventsService.getCustomEvents(classroomId);

      res.json({
        success: true,
        data: events,
      });
    } catch (error) {
      console.error('Error getting custom events:', error);
      res.status(500).json({ message: 'Error al obtener eventos personalizados' });
    }
  }

  /**
   * Obtener un evento por ID
   */
  async getEventById(req: Request, res: Response) {
    try {
      const { eventId } = req.params;
      const event = await eventsService.getEventById(eventId);

      if (!event) {
        return res.status(404).json({ message: 'Evento no encontrado' });
      }

      res.json({
        success: true,
        data: event,
      });
    } catch (error) {
      console.error('Error getting event:', error);
      res.status(500).json({ message: 'Error al obtener evento' });
    }
  }

  /**
   * Actualizar evento personalizado
   */
  async updateEvent(req: Request, res: Response) {
    try {
      const { classroomId, eventId } = req.params;
      const updateData = req.body;

      const result = await eventsService.updateEvent(eventId, classroomId, updateData);

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json({
        success: true,
        data: result.event,
      });
    } catch (error) {
      console.error('Error updating event:', error);
      res.status(500).json({ message: 'Error al actualizar evento' });
    }
  }

  /**
   * Eliminar evento personalizado
   */
  async deleteEvent(req: Request, res: Response) {
    try {
      const { classroomId, eventId } = req.params;

      const result = await eventsService.deleteEvent(eventId, classroomId);

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({ message: 'Error al eliminar evento' });
    }
  }

  /**
   * Girar ruleta de eventos
   */
  async spinRoulette(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'No autorizado' });
      }

      const result = await eventsService.spinEventRoulette(classroomId, userId);

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error spinning roulette:', error);
      res.status(500).json({ message: 'Error al girar ruleta' });
    }
  }

  /**
   * Iniciar un desafío (selecciona estudiantes sin aplicar efectos)
   */
  async startChallenge(req: Request, res: Response) {
    try {
      const { classroomId, eventId } = req.params;

      const result = await eventsService.startChallenge(eventId, classroomId);

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json({
        success: true,
        data: result.challengeData,
      });
    } catch (error) {
      console.error('Error starting challenge:', error);
      res.status(500).json({ message: 'Error al iniciar desafío' });
    }
  }

  /**
   * Resolver un desafío (aplicar efectos según resultado)
   */
  async resolveChallenge(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const userId = (req as any).user?.id;
      const { studentIds, effects, completed, eventName } = req.body;

      if (!studentIds || !effects || completed === undefined) {
        return res.status(400).json({ message: 'Datos incompletos' });
      }

      const result = await eventsService.resolveChallenge(
        classroomId,
        userId,
        studentIds,
        effects,
        completed,
        eventName
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error resolving challenge:', error);
      res.status(500).json({ message: 'Error al resolver desafío' });
    }
  }
}

export const eventsController = new EventsController();
