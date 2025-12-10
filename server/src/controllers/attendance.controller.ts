import { Request, Response } from 'express';
import { attendanceService } from '../services/attendance.service.js';
import { db } from '../db/index.js';
import { studentProfiles } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export const attendanceController = {
  // Registrar asistencia individual
  async recordAttendance(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { studentProfileId, date, status, notes, xpAwarded } = req.body;

      const result = await attendanceService.recordAttendance(
        classroomId,
        studentProfileId,
        new Date(date),
        status,
        notes,
        xpAwarded
      );

      res.json({
        success: true,
        message: 'Asistencia registrada',
        data: result,
      });
    } catch (error) {
      console.error('Error recording attendance:', error);
      res.status(500).json({ success: false, message: 'Error al registrar asistencia' });
    }
  },

  // Registrar asistencia masiva
  async recordBulkAttendance(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { date, attendanceData, xpForPresent } = req.body;

      const results = await attendanceService.recordBulkAttendance(
        classroomId,
        new Date(date),
        attendanceData,
        xpForPresent
      );

      res.json({
        success: true,
        message: `Asistencia registrada para ${results.length} estudiantes`,
        data: results,
      });
    } catch (error) {
      console.error('Error recording bulk attendance:', error);
      res.status(500).json({ success: false, message: 'Error al registrar asistencia' });
    }
  },

  // Obtener asistencia por fecha
  async getAttendanceByDate(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { date } = req.query;

      const attendance = await attendanceService.getAttendanceByDate(
        classroomId,
        new Date(date as string)
      );

      res.json({
        success: true,
        data: attendance,
      });
    } catch (error) {
      console.error('Error getting attendance:', error);
      res.status(500).json({ success: false, message: 'Error al obtener asistencia' });
    }
  },

  // Obtener historial de asistencia de un estudiante
  async getStudentHistory(req: Request, res: Response) {
    try {
      const { studentProfileId } = req.params;
      const { limit } = req.query;

      const history = await attendanceService.getStudentAttendanceHistory(
        studentProfileId,
        limit ? parseInt(limit as string) : 30
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('Error getting student history:', error);
      res.status(500).json({ success: false, message: 'Error al obtener historial' });
    }
  },

  // Obtener estadísticas de asistencia de un estudiante
  async getStudentStats(req: Request, res: Response) {
    try {
      const { studentProfileId } = req.params;

      const stats = await attendanceService.getStudentAttendanceStats(studentProfileId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error getting student stats:', error);
      res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
    }
  },

  // Obtener estadísticas de asistencia de una clase
  async getClassroomStats(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { startDate, endDate } = req.query;

      const stats = await attendanceService.getClassroomAttendanceStats(
        classroomId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error getting classroom stats:', error);
      res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
    }
  },

  // Obtener asistencia por rango de fechas
  async getAttendanceByRange(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'Se requieren startDate y endDate' 
        });
      }

      const attendance = await attendanceService.getAttendanceByDateRange(
        classroomId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        data: attendance,
      });
    } catch (error) {
      console.error('Error getting attendance range:', error);
      res.status(500).json({ success: false, message: 'Error al obtener asistencia' });
    }
  },

  // Obtener mi asistencia (para estudiantes)
  async getMyAttendance(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { classroomId } = req.params;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'No autenticado' });
      }

      // Obtener el perfil del estudiante en esta clase
      const [profile] = await db
        .select()
        .from(studentProfiles)
        .where(and(
          eq(studentProfiles.userId, userId),
          eq(studentProfiles.classroomId, classroomId)
        ));

      if (!profile) {
        return res.status(404).json({ success: false, message: 'Perfil no encontrado' });
      }

      // Obtener estadísticas
      const stats = await attendanceService.getStudentAttendanceStats(profile.id);
      
      // Obtener historial completo
      const history = await attendanceService.getStudentAttendanceHistory(profile.id, 365);

      // Calcular racha actual de asistencia
      let currentStreak = 0;
      let bestStreak = 0;
      let tempStreak = 0;
      
      // Ordenar por fecha descendente
      const sortedHistory = [...history].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      for (const record of sortedHistory) {
        if (record.status === 'PRESENT') {
          tempStreak++;
          if (tempStreak > bestStreak) bestStreak = tempStreak;
        } else {
          if (currentStreak === 0) currentStreak = tempStreak;
          tempStreak = 0;
        }
      }
      if (currentStreak === 0) currentStreak = tempStreak;
      if (tempStreak > bestStreak) bestStreak = tempStreak;

      res.json({
        success: true,
        data: {
          stats: {
            ...stats,
            currentStreak,
            bestStreak,
          },
          history,
        },
      });
    } catch (error) {
      console.error('Error getting my attendance:', error);
      res.status(500).json({ success: false, message: 'Error al obtener asistencia' });
    }
  },
};
