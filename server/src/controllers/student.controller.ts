import type { Request, Response } from 'express';
import { studentService } from '../services/student.service.js';
import { pdfService } from '../services/pdf.service.js';
import { db } from '../db/index.js';
import { classrooms, studentProfiles } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { config_app } from '../config/env.js';

const joinClassSchema = z.object({
  code: z.string().min(6, 'El código debe tener al menos 6 caracteres').max(8, 'El código no puede tener más de 8 caracteres'),
  characterName: z.string().min(2, 'Nombre muy corto').max(50, 'Nombre muy largo'),
  characterClass: z.enum(['GUARDIAN', 'ARCANE', 'EXPLORER', 'ALCHEMIST']),
  avatarGender: z.enum(['MALE', 'FEMALE']).optional(),
});

const updatePointsSchema = z.object({
  pointType: z.enum(['XP', 'HP', 'GP']),
  amount: z.number().int(),
  reason: z.string().min(1).max(255),
});

const updateProfileSchema = z.object({
  characterName: z.string().min(2).max(50).optional(),
  avatarUrl: z.string().url().optional(),
});

export class StudentController {
  // Unirse a una clase
  async joinClass(req: Request, res: Response) {
    try {
      const data = joinClassSchema.parse(req.body);
      
      const result = await studentService.joinClass({
        userId: req.user!.id,
        ...data,
      });

      res.status(201).json({
        success: true,
        message: `¡Te has unido a ${result.classroom.name}!`,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al unirse a la clase',
      });
    }
  }

  // Obtener mis clases como estudiante
  async getMyClasses(req: Request, res: Response) {
    try {
      const classes = await studentService.getMyClasses(req.user!.id);
      
      res.json({
        success: true,
        data: classes,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener las clases',
      });
    }
  }

  // Obtener mi perfil en una clase
  async getMyProfile(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const profile = await studentService.getProfile(req.user!.id, classroomId);

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'No estás inscrito en esta clase',
        });
      }

      res.json({
        success: true,
        data: profile,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener el perfil',
      });
    }
  }

  // Obtener estudiante por ID (para profesores)
  async getStudent(req: Request, res: Response) {
    try {
      const { studentId } = req.params;
      const student = await studentService.getStudentById(studentId);

      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Estudiante no encontrado',
        });
      }

      res.json({
        success: true,
        data: student,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener el estudiante',
      });
    }
  }

  // Modificar puntos de un estudiante (profesor)
  async updatePoints(req: Request, res: Response) {
    try {
      const { studentId } = req.params;
      const data = updatePointsSchema.parse(req.body);

      const student = await studentService.updatePoints({
        studentId,
        teacherId: req.user!.id,
        ...data,
      });

      const action = data.amount >= 0 ? 'agregado' : 'quitado';
      const absAmount = Math.abs(data.amount);

      res.json({
        success: true,
        message: `Se ha ${action} ${absAmount} ${data.pointType}`,
        data: student,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }
      if (error instanceof Error) {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al modificar puntos',
      });
    }
  }

  // Obtener historial de puntos
  async getPointHistory(req: Request, res: Response) {
    try {
      const { studentId } = req.params;
      const history = await studentService.getPointHistory(studentId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener historial',
      });
    }
  }

  // Obtener estadísticas detalladas del estudiante
  async getStudentStats(req: Request, res: Response) {
    try {
      const { studentId } = req.params;
      const stats = await studentService.getStudentStats(studentId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error getting student stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
      });
    }
  }

  // Actualizar perfil del estudiante
  async updateProfile(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const data = updateProfileSchema.parse(req.body);

      const profile = await studentService.updateProfile(
        req.user!.id,
        classroomId,
        data
      );

      res.json({
        success: true,
        message: 'Perfil actualizado',
        data: profile,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al actualizar perfil',
      });
    }
  }

  // Crear estudiante demo para onboarding
  async createDemoStudent(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      
      const demoStudent = await studentService.createDemoStudent(
        classroomId,
        req.user!.id
      );

      res.status(201).json({
        success: true,
        message: 'Estudiante demo creado',
        data: demoStudent,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al crear estudiante demo',
      });
    }
  }

  // Eliminar estudiante demo
  async deleteDemoStudent(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      
      const result = await studentService.deleteDemoStudent(
        classroomId,
        req.user!.id
      );

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al eliminar estudiante demo',
      });
    }
  }

  // Verificar si existe estudiante demo
  async hasDemoStudent(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      
      const hasDemo = await studentService.hasDemoStudent(classroomId);

      res.json({
        success: true,
        data: { hasDemo },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al verificar estudiante demo',
      });
    }
  }

  // ==================== ESTUDIANTES PLACEHOLDER ====================

  // Crear estudiante placeholder (profesor)
  async createPlaceholderStudent(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { displayName, characterClass, avatarGender } = req.body;

      if (!displayName || displayName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'El nombre debe tener al menos 2 caracteres',
        });
      }

      const result = await studentService.createPlaceholderStudent({
        classroomId,
        displayName: displayName.trim(),
        characterClass: characterClass || 'GUARDIAN',
        avatarGender,
        teacherId: req.user!.id,
      });

      res.status(201).json({
        success: true,
        message: 'Estudiante creado exitosamente',
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al crear estudiante',
      });
    }
  }

  // Crear múltiples estudiantes placeholder
  async createBulkPlaceholderStudents(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { students } = req.body;

      if (!Array.isArray(students) || students.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Debes proporcionar una lista de estudiantes',
        });
      }

      if (students.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Máximo 50 estudiantes a la vez',
        });
      }

      const results = await studentService.createBulkPlaceholderStudents({
        classroomId,
        students,
        teacherId: req.user!.id,
      });

      res.status(201).json({
        success: true,
        message: `${results.length} estudiantes creados`,
        data: results,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al crear estudiantes',
      });
    }
  }

  // Vincular cuenta con código
  async linkAccount(req: Request, res: Response) {
    try {
      const { linkCode, characterName, avatarGender } = req.body;

      if (!linkCode || linkCode.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Código de vinculación inválido',
        });
      }

      const result = await studentService.linkStudentAccount({
        userId: req.user!.id,
        linkCode,
        characterName,
        avatarGender,
      });

      res.json({
        success: true,
        message: `¡Te has vinculado a ${result.classroom.name}!`,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al vincular cuenta',
      });
    }
  }

  // Obtener estudiantes placeholder de una clase
  async getPlaceholderStudents(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;

      const students = await studentService.getPlaceholderStudents(
        classroomId,
        req.user!.id
      );

      res.json({
        success: true,
        data: students,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al obtener estudiantes',
      });
    }
  }

  // Regenerar código de vinculación
  async regenerateLinkCode(req: Request, res: Response) {
    try {
      const { studentId } = req.params;

      const result = await studentService.regenerateLinkCode(
        studentId,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Código regenerado',
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al regenerar código',
      });
    }
  }

  // Generar PDF con tarjetas de vinculación
  async generateLinkCardsPDF(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { studentIds } = req.body; // Array opcional de IDs específicos

      // Verificar acceso
      const classroom = await db.query.classrooms.findFirst({
        where: eq(classrooms.id, classroomId),
      });

      if (!classroom || classroom.teacherId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a esta clase',
        });
      }

      // Obtener estudiantes placeholder
      let students;
      if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
        // Estudiantes específicos
        students = await db
          .select()
          .from(studentProfiles)
          .where(and(
            eq(studentProfiles.classroomId, classroomId),
            sql`${studentProfiles.id} IN (${sql.join(studentIds.map(id => sql`${id}`), sql`, `)})`,
            sql`${studentProfiles.linkCode} IS NOT NULL`
          ));
      } else {
        // Todos los placeholder
        students = await db
          .select()
          .from(studentProfiles)
          .where(and(
            eq(studentProfiles.classroomId, classroomId),
            eq(studentProfiles.isActive, true),
            sql`${studentProfiles.linkCode} IS NOT NULL`
          ));
      }

      if (students.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No hay estudiantes sin vincular en esta clase',
        });
      }

      const appUrl = config_app.clientUrl || 'https://juried.app';

      const studentCards = students.map(s => ({
        displayName: s.displayName || s.characterName || 'Estudiante',
        linkCode: s.linkCode!,
        characterClass: s.characterClass,
        classroomName: classroom.name,
        classroomCode: classroom.code,
      }));

      const pdfBuffer = await pdfService.generateStudentCards(studentCards, appUrl);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="tarjetas-vinculacion-${classroom.code}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Error al generar PDF',
      });
    }
  }

  // Generar PDF de una sola tarjeta
  async generateSingleCardPDF(req: Request, res: Response) {
    try {
      const { studentId } = req.params;

      const student = await db.query.studentProfiles.findFirst({
        where: eq(studentProfiles.id, studentId),
      });

      if (!student || !student.linkCode) {
        return res.status(404).json({
          success: false,
          message: 'Estudiante no encontrado o ya vinculado',
        });
      }

      // Verificar acceso
      const classroom = await db.query.classrooms.findFirst({
        where: eq(classrooms.id, student.classroomId),
      });

      if (!classroom || classroom.teacherId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este estudiante',
        });
      }

      const appUrl = config_app.clientUrl || 'https://juried.app';

      const pdfBuffer = await pdfService.generateSingleCard({
        displayName: student.displayName || student.characterName || 'Estudiante',
        linkCode: student.linkCode,
        characterClass: student.characterClass,
        classroomName: classroom.name,
        classroomCode: classroom.code,
      }, appUrl);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="tarjeta-${student.displayName || 'estudiante'}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Error al generar PDF',
      });
    }
  }

  // Completar configuración inicial para estudiantes B2B
  async completeInitialSetup(req: Request, res: Response) {
    try {
      const { studentId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
      }

      // Verificar que el estudiante pertenece al usuario
      const profile = await db.query.studentProfiles.findFirst({
        where: and(
          eq(studentProfiles.id, studentId),
          eq(studentProfiles.userId, userId)
        ),
      });

      if (!profile) {
        return res.status(404).json({ success: false, message: 'Perfil no encontrado' });
      }

      const schema = z.object({
        characterName: z.string().min(2, 'Nombre muy corto').max(50, 'Nombre muy largo'),
        avatarGender: z.enum(['MALE', 'FEMALE']),
      });

      const data = schema.parse(req.body);

      const updatedProfile = await studentService.completeInitialSetup(studentId, data);

      res.json({
        success: true,
        message: '¡Configuración completada!',
        data: updatedProfile,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }
      console.error('Error completing initial setup:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error al completar configuración',
      });
    }
  }
}

export const studentController = new StudentController();
