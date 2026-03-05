import { Request, Response } from 'express';
import { chatService } from '../services/chat.service.js';

class ChatController {

  /** GET /classrooms/:id/chat — get messages (paginated backwards) */
  async getMessages(req: Request, res: Response) {
    try {
      const classroomId = req.params.id;
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const before = req.query.before as string | undefined;

      const messages = await chatService.getMessages(classroomId, limit, before);
      res.json({ success: true, data: messages });
    } catch (error) {
      console.error('Error getting chat messages:', error);
      res.status(500).json({ success: false, message: 'Error al obtener mensajes' });
    }
  }

  /** POST /classrooms/:id/chat — send a message */
  async sendMessage(req: Request, res: Response) {
    try {
      const classroomId = req.params.id;
      const senderId = req.user!.id;
      const senderRole = req.user!.role === 'TEACHER' ? 'TEACHER' : 'PARENT';
      const { message } = req.body;

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, message: 'El mensaje es requerido' });
      }

      const result = await chatService.sendMessage(
        classroomId,
        senderId,
        senderRole as 'TEACHER' | 'PARENT',
        message
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al enviar mensaje';
      const status = msg.includes('cerrado') || msg.includes('acceso') ? 403 : 500;
      res.status(status).json({ success: false, message: msg });
    }
  }

  /** DELETE /classrooms/:id/chat/:messageId — soft delete a message (teacher only) */
  async deleteMessage(req: Request, res: Response) {
    try {
      const { messageId } = req.params;
      const deletedBy = req.user!.id;

      const result = await chatService.deleteMessage(messageId, deletedBy);
      res.json({ success: true, data: result });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al eliminar mensaje';
      res.status(msg.includes('no encontrado') ? 404 : 500).json({ success: false, message: msg });
    }
  }

  /** GET /classrooms/:id/chat/settings — get chat open/closed status */
  async getSettings(req: Request, res: Response) {
    try {
      const classroomId = req.params.id;
      const settings = await chatService.getSettings(classroomId);
      res.json({ success: true, data: settings });
    } catch (error) {
      console.error('Error getting chat settings:', error);
      res.status(500).json({ success: false, message: 'Error al obtener configuración del chat' });
    }
  }

  /** PATCH /classrooms/:id/chat/settings — open or close the chat (teacher only) */
  async updateSettings(req: Request, res: Response) {
    try {
      const classroomId = req.params.id;
      const userId = req.user!.id;
      const { isOpen } = req.body;

      if (typeof isOpen !== 'boolean') {
        return res.status(400).json({ success: false, message: 'isOpen debe ser un booleano' });
      }

      const settings = await chatService.updateSettings(classroomId, isOpen, userId);
      res.json({ success: true, data: settings });
    } catch (error) {
      console.error('Error updating chat settings:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar configuración del chat' });
    }
  }
}

export const chatController = new ChatController();
