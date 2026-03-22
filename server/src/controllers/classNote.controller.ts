import { Request, Response } from 'express';
import { classNoteService } from '../services/classNote.service.js';

class ClassNoteController {

  async create(req: Request, res: Response) {
    try {
      const classroomId = req.params.id;
      const teacherId = req.user!.id;
      const { content, category, dueDate } = req.body;

      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ message: 'El contenido es requerido' });
      }

      const note = await classNoteService.create(classroomId, teacherId, content, category || 'other', dueDate);
      res.status(201).json(note);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al crear nota';
      const status = msg.includes('no encontrada') || msg.includes('permiso') ? 403 : 500;
      res.status(status).json({ message: msg });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const classroomId = req.params.id;
      const notes = await classNoteService.list(classroomId);
      res.json(notes);
    } catch (error) {
      console.error('Error getting class notes:', error);
      res.status(500).json({ message: 'Error al obtener notas' });
    }
  }

  async toggleComplete(req: Request, res: Response) {
    try {
      const noteId = req.params.noteId;
      const teacherId = req.user!.id;
      const note = await classNoteService.toggleComplete(noteId, teacherId);
      res.json(note);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al actualizar nota';
      const status = msg.includes('no encontrada') || msg.includes('permiso') ? 403 : 500;
      res.status(status).json({ message: msg });
    }
  }

  async remove(req: Request, res: Response) {
    try {
      const noteId = req.params.noteId;
      const teacherId = req.user!.id;
      const result = await classNoteService.remove(noteId, teacherId);
      res.json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al eliminar nota';
      const status = msg.includes('no encontrada') || msg.includes('permiso') ? 403 : 500;
      res.status(status).json({ message: msg });
    }
  }

  async pendingCount(req: Request, res: Response) {
    try {
      const classroomId = req.params.id;
      const count = await classNoteService.getPendingCount(classroomId);
      res.json({ count });
    } catch (error) {
      console.error('Error getting pending count:', error);
      res.status(500).json({ message: 'Error al obtener conteo' });
    }
  }
}

export const classNoteController = new ClassNoteController();
