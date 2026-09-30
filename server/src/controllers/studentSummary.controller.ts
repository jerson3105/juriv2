import type { Request, Response } from 'express';
import { z } from 'zod';
import { studentSummaryService } from '../services/studentSummary.service.js';
import { requireClassroomTeacher } from '../utils/access.js';

const summaryQuerySchema = z.object({
  period: z.enum(['bimester', 'all']).default('bimester'),
  // Desfase del navegador (Date#getTimezoneOffset): agrupa la actividad por el día local del profesor.
  tz: z.coerce.number().int().min(-840).max(840).default(0),
});

class StudentSummaryController {
  // GET /classrooms/:id/students/:studentId/summary?period=bimester|all&tz=300
  async getSummary(req: Request, res: Response) {
    try {
      const { id: classroomId, studentId } = req.params;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;

      const parsed = summaryQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Periodo inválido' });
      }
      if (!(await studentSummaryService.studentInClassroom(classroomId, studentId))) {
        return res.status(404).json({ success: false, message: 'Estudiante no encontrado en esta clase' });
      }

      const data = await studentSummaryService.getSummary(classroomId, studentId, parsed.data.period, parsed.data.tz);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting student summary:', error);
      res.status(500).json({ success: false, message: 'Error al obtener el resumen del estudiante' });
    }
  }
}

export const studentSummaryController = new StudentSummaryController();
