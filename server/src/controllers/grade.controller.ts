import { Request, Response } from 'express';
import { gradeService } from '../services/grade.service.js';
import { gradeExportService } from '../services/gradeExport.service.js';

export class GradeController {
  
  /**
   * Obtiene las calificaciones de un estudiante
   * GET /api/grades/student/:studentProfileId
   */
  async getStudentGrades(req: Request, res: Response) {
    try {
      const { studentProfileId } = req.params;
      const { period = 'CURRENT' } = req.query;

      const grades = await gradeService.getStudentGrades(
        studentProfileId,
        period as string
      );

      res.json(grades);
    } catch (error: any) {
      console.error('Error getting student grades:', error);
      res.status(500).json({ error: error.message || 'Error al obtener calificaciones' });
    }
  }

  /**
   * Obtiene las calificaciones de toda una clase
   * GET /api/grades/classroom/:classroomId
   */
  async getClassroomGrades(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { period = 'CURRENT' } = req.query;

      const grades = await gradeService.getClassroomGrades(
        classroomId,
        period as string
      );

      res.json(grades);
    } catch (error: any) {
      console.error('Error getting classroom grades:', error);
      res.status(500).json({ error: error.message || 'Error al obtener calificaciones' });
    }
  }

  /**
   * Calcula las calificaciones de un estudiante específico
   * POST /api/grades/calculate/student/:studentProfileId
   */
  async calculateStudentGrades(req: Request, res: Response) {
    try {
      const { studentProfileId } = req.params;
      const { classroomId, period = 'CURRENT' } = req.body;

      if (!classroomId) {
        return res.status(400).json({ error: 'classroomId es requerido' });
      }

      const results = await gradeService.calculateStudentGrades(
        classroomId,
        studentProfileId,
        period
      );

      res.json({
        success: true,
        studentProfileId,
        grades: results,
      });
    } catch (error: any) {
      console.error('Error calculating student grades:', error);
      res.status(500).json({ error: error.message || 'Error al calcular calificaciones' });
    }
  }

  /**
   * Recalcula las calificaciones de toda una clase
   * POST /api/grades/calculate/classroom/:classroomId
   */
  async recalculateClassroomGrades(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { period = 'CURRENT' } = req.body;

      const results = await gradeService.recalculateClassroomGrades(
        classroomId,
        period
      );

      res.json({
        success: true,
        classroomId,
        studentsProcessed: results.length,
        results,
      });
    } catch (error: any) {
      console.error('Error recalculating classroom grades:', error);
      res.status(500).json({ error: error.message || 'Error al recalcular calificaciones' });
    }
  }

  /**
   * Establece una calificación manual (override del profesor)
   * PUT /api/grades/:gradeId/manual
   */
  async setManualGrade(req: Request, res: Response) {
    try {
      const { gradeId } = req.params;
      const { manualScore, manualNote } = req.body;

      if (manualScore === undefined || manualScore < 0 || manualScore > 100) {
        return res.status(400).json({ error: 'manualScore debe estar entre 0 y 100' });
      }

      const result = await gradeService.setManualGrade(
        gradeId,
        manualScore,
        manualNote
      );

      res.json(result);
    } catch (error: any) {
      console.error('Error setting manual grade:', error);
      res.status(500).json({ error: error.message || 'Error al establecer calificación manual' });
    }
  }

  /**
   * Elimina la calificación manual y restaura el cálculo automático
   * DELETE /api/grades/:gradeId/manual
   */
  async clearManualGrade(req: Request, res: Response) {
    try {
      const { gradeId } = req.params;

      const result = await gradeService.clearManualGrade(gradeId);

      res.json(result);
    } catch (error: any) {
      console.error('Error clearing manual grade:', error);
      res.status(500).json({ error: error.message || 'Error al restaurar calificación automática' });
    }
  }

  /**
   * Exporta el libro de calificaciones en PDF
   * GET /api/grades/export/pdf/:classroomId
   */
  async exportPDF(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { period = 'CURRENT' } = req.query;

      const pdfBuffer = await gradeExportService.generateGradebookPDF(
        classroomId,
        period as string
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=libro-calificaciones-${classroomId}.pdf`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      res.status(500).json({ error: error.message || 'Error al exportar PDF' });
    }
  }
}

export const gradeController = new GradeController();
