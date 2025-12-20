import { Request, Response } from 'express';
import { attendanceService } from '../services/attendance.service.js';
import { pdfService } from '../services/pdf.service.js';
import { db } from '../db/index.js';
import { studentProfiles, classrooms } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

// Parsear fecha string YYYY-MM-DD a Date en UTC medianoche
// Esto garantiza consistencia independiente de la zona horaria del servidor
const parseLocalDate = (dateStr: string): Date => {
  // Crear fecha UTC directamente para evitar problemas de zona horaria del servidor
  return new Date(`${dateStr}T12:00:00.000Z`);
};

export const attendanceController = {
  // Registrar asistencia individual
  async recordAttendance(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { studentProfileId, date, status, notes, xpAwarded } = req.body;

      const result = await attendanceService.recordAttendance(
        classroomId,
        studentProfileId,
        parseLocalDate(date),
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
        parseLocalDate(date),
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
        parseLocalDate(date as string)
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

  // Generar PDF de reporte de asistencia general
  async downloadAttendanceReportPDF(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { startDate, endDate } = req.query;

      // Obtener información de la clase
      const [classroom] = await db
        .select()
        .from(classrooms)
        .where(eq(classrooms.id, classroomId));

      if (!classroom) {
        return res.status(404).json({ success: false, message: 'Clase no encontrada' });
      }

      // Obtener todos los estudiantes de la clase
      const students = await db
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.classroomId, classroomId));

      // Obtener todos los registros de asistencia
      const allRecords = await attendanceService.getAttendanceByDateRange(
        classroomId,
        new Date('2020-01-01'),
        new Date()
      );

      // Función para obtener fecha en formato YYYY-MM-DD
      // La fecha se guarda en UTC, así que usamos UTC para leerla
      const getDateString = (date: Date): string => {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Obtener fechas únicas ordenadas
      const uniqueDatesSet = new Set<string>();
      allRecords.forEach(r => {
        uniqueDatesSet.add(getDateString(r.date));
      });
      const uniqueDates = Array.from(uniqueDatesSet).sort();

      // Crear mapa de asistencia por estudiante y fecha
      const attendanceMap: Record<string, Record<string, string>> = {};
      allRecords.forEach(r => {
        const dateKey = getDateString(r.date);
        if (!attendanceMap[r.studentProfileId]) {
          attendanceMap[r.studentProfileId] = {};
        }
        attendanceMap[r.studentProfileId][dateKey] = r.status;
      });

      // Preparar datos de estudiantes con asistencia por fecha
      const studentData = students.map(student => {
        const attendance: Record<string, string> = attendanceMap[student.id] || {};
        let present = 0, absent = 0, late = 0;
        
        uniqueDates.forEach(date => {
          const status = attendance[date];
          if (status === 'PRESENT') present++;
          else if (status === 'ABSENT') absent++;
          else if (status === 'LATE') late++;
        });

        const total = present + absent + late;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;

        return {
          id: student.id,
          name: student.characterName || student.displayName || 'Sin nombre',
          attendance,
          present,
          absent,
          late,
          rate,
        };
      });

      // Ordenar por nombre
      studentData.sort((a, b) => a.name.localeCompare(b.name));

      // Generar PDF
      const pdfBuffer = await pdfService.generateAttendanceReport(
        classroom.name,
        studentData,
        uniqueDates
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=control-asistencia-${classroom.name}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating attendance report PDF:', error);
      res.status(500).json({ success: false, message: 'Error al generar reporte PDF' });
    }
  },

  // Generar PDF de asistencia de un estudiante específico
  async downloadStudentAttendanceReportPDF(req: Request, res: Response) {
    try {
      const { studentProfileId } = req.params;

      // Obtener información del estudiante
      const [student] = await db
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentProfileId));

      if (!student) {
        return res.status(404).json({ success: false, message: 'Estudiante no encontrado' });
      }

      // Obtener información de la clase
      const [classroom] = await db
        .select()
        .from(classrooms)
        .where(eq(classrooms.id, student.classroomId));

      // Obtener estadísticas del estudiante
      const stats = await attendanceService.getStudentAttendanceStats(studentProfileId);

      // Obtener historial completo
      const history = await attendanceService.getStudentAttendanceHistory(studentProfileId, 365);

      // Calcular rachas
      let currentStreak = 0;
      let bestStreak = 0;
      let tempStreak = 0;
      
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

      const studentName = student.characterName || student.displayName || 'Estudiante';

      // Generar PDF
      const pdfBuffer = await pdfService.generateStudentAttendanceReport(
        studentName,
        classroom?.name || 'Clase',
        {
          total: stats.total,
          present: stats.present,
          absent: stats.absent,
          late: stats.late,
          excused: stats.excused,
          rate: stats.attendanceRate,
          currentStreak,
          bestStreak,
        },
        history.map(h => ({
          date: h.date.toISOString(),
          status: h.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
          xpAwarded: h.xpAwarded || 0,
        }))
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=asistencia-${studentName}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating student attendance report PDF:', error);
      res.status(500).json({ success: false, message: 'Error al generar reporte PDF' });
    }
  },
};
