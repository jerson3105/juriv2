import { Request, Response } from 'express';
import { z } from 'zod';
import { characterClassService } from '../services/characterClass.service.js';

const createSchema = z.object({
  name: z.string().min(1).max(50),
  key: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  icon: z.string().min(1).max(20),
  color: z.string().min(1).max(20),
});

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  icon: z.string().min(1).max(20).optional(),
  color: z.string().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string()),
});

const assignSchema = z.object({
  studentId: z.string(),
  characterClassId: z.string().nullable(),
});

const bulkAssignSchema = z.object({
  studentIds: z.array(z.string()).min(1),
  characterClassId: z.string().nullable(),
});

class CharacterClassController {
  async list(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const classes = await characterClassService.list(classroomId);
      res.json({ success: true, data: classes });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al obtener clases' });
    }
  }

  async listActive(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const classes = await characterClassService.listActive(classroomId);
      res.json({ success: true, data: classes });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al obtener clases activas' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const data = createSchema.parse(req.body);
      const newClass = await characterClassService.create(classroomId, data);
      res.status(201).json({ success: true, data: newClass });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      if (error instanceof Error && error.message.includes('Duplicate')) {
        return res.status(409).json({ success: false, message: 'Ya existe una clase con esa clave en este aula' });
      }
      res.status(500).json({ success: false, message: 'Error al crear clase' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = updateSchema.parse(req.body);
      const updated = await characterClassService.update(id, data);
      res.json({ success: true, data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      res.status(500).json({ success: false, message: 'Error al actualizar clase' });
    }
  }

  async remove(req: Request, res: Response) {
    try {
      const { classroomId, id } = req.params;
      await characterClassService.remove(id, classroomId);
      res.json({ success: true, message: 'Clase eliminada' });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: 'Error al eliminar clase' });
    }
  }

  async reorder(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { orderedIds } = reorderSchema.parse(req.body);
      await characterClassService.reorder(classroomId, orderedIds);
      res.json({ success: true, message: 'Orden actualizado' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al reordenar' });
    }
  }

  async assign(req: Request, res: Response) {
    try {
      const data = assignSchema.parse(req.body);
      await characterClassService.assignToStudent(data.studentId, data.characterClassId);
      res.json({ success: true, message: 'Clase asignada' });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: 'Error al asignar clase' });
    }
  }

  async bulkAssign(req: Request, res: Response) {
    try {
      const data = bulkAssignSchema.parse(req.body);
      await characterClassService.bulkAssignToStudents(data.studentIds, data.characterClassId);
      res.json({ success: true, message: `Clase asignada a ${data.studentIds.length} estudiante(s)` });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: 'Error al asignar clase' });
    }
  }

  async seedDefaults(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      await characterClassService.seedDefaults(classroomId);
      const classes = await characterClassService.list(classroomId);
      res.json({ success: true, data: classes });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al crear clases por defecto' });
    }
  }
  async studentChoose(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { characterClassId } = z.object({ characterClassId: z.string() }).parse(req.body);
      const userId = req.user!.id;

      // Verify student belongs to this classroom
      const { db } = await import('../db/index.js');
      const { studentProfiles, classrooms } = await import('../db/schema.js');
      const { eq, and } = await import('drizzle-orm');

      const profile = await db.query.studentProfiles.findFirst({
        where: and(eq(studentProfiles.userId, userId), eq(studentProfiles.classroomId, classroomId)),
      });
      if (!profile) {
        return res.status(403).json({ success: false, message: 'No perteneces a esta clase' });
      }

      // Check classroom allows student choice
      const classroom = await db.query.classrooms.findFirst({
        where: eq(classrooms.id, classroomId),
        columns: { classAssignmentMode: true },
      });
      if (!classroom || classroom.classAssignmentMode !== 'STUDENT_CHOICE') {
        return res.status(403).json({ success: false, message: 'El profesor asigna las clases en esta aula' });
      }

      await characterClassService.assignToStudent(profile.id, characterClassId);
      res.json({ success: true, message: 'Clase elegida correctamente' });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: 'Error al elegir clase' });
    }
  }

  async listByCode(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const { db } = await import('../db/index.js');
      const { classrooms } = await import('../db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const classroom = await db.query.classrooms.findFirst({
        where: eq(classrooms.code, code.toUpperCase()),
        columns: { id: true, classAssignmentMode: true },
      });
      if (!classroom) {
        return res.status(404).json({ success: false, message: 'Código no encontrado' });
      }
      
      const classes = await characterClassService.listActive(classroom.id);
      res.json({ 
        success: true, 
        data: { 
          classroomId: classroom.id, 
          assignmentMode: classroom.classAssignmentMode,
          classes,
        } 
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al buscar clases' });
    }
  }
}

export const characterClassController = new CharacterClassController();
