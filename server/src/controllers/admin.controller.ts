import { Request, Response } from 'express';
import { db } from '../db/index.js';
import {
  users, classrooms, studentProfiles,
  questionBanks, questions, timedActivities, expeditions
} from '../db/schema.js';
import { eq, desc, count, sql, inArray } from 'drizzle-orm';
import { teacherVerificationService } from '../services/teacherVerification.service.js';
import { adminUsersService } from '../services/adminUsers.service.js';
import { adminOverviewService } from '../services/adminOverview.service.js';
import { adminClassroomsService } from '../services/adminClassrooms.service.js';
import { AppError } from '../utils/errors.js';
import { passwordSchema } from '../utils/passwordPolicy.js';
import { z } from 'zod';

const userListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
const createTeacherSchema = z.object({
  email: z.string().trim().toLowerCase().email('Escribe un correo válido').max(255),
  firstName: z.string().trim().min(1, 'Escribe el nombre').max(100),
  lastName: z.string().trim().min(1, 'Escribe el apellido').max(100),
  password: passwordSchema,
}).strict();
const userIdSchema = z.string().uuid();
const roleChangeSchema = z.object({
  role: z.enum(['ADMIN', 'TEACHER', 'STUDENT']),
  // Solo para dar el rol de administrador: la contraseña de quien lo da.
  currentPassword: z.string().min(1).max(200).optional(),
}).strict();
const userStatusSchema = z.object({ isActive: z.boolean() }).strict();

export const adminController = {
  // ==================== INICIO ====================
  async getOverview(_req: Request, res: Response) {
    try {
      res.json({ success: true, data: await adminOverviewService.get() });
    } catch (error) {
      console.error('Error getting admin overview:', error);
      res.status(500).json({ success: false, message: 'Error al obtener el resumen' });
    }
  },

  // ==================== GESTIÓN DE USUARIOS ====================
  async getUsers(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await adminUsersService.list(userListSchema.parse(req.query)) });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Filtros inválidos' });
      console.error('Error getting users:', error);
      res.status(500).json({ success: false, message: 'Error al obtener usuarios' });
    }
  },

  async createTeacher(req: Request, res: Response) {
    try {
      const data = await adminUsersService.createTeacher(req.user!.id, createTeacherSchema.parse(req.body));
      res.status(201).json({ success: true, data, message: 'Docente creado' });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0]?.message ?? 'Datos inválidos' });
      if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
      console.error('Error creating teacher:', error);
      res.status(500).json({ success: false, message: 'Error al crear el docente' });
    }
  },

  async updateUserRole(req: Request, res: Response) {
    try {
      const userId = userIdSchema.parse(req.params.userId);
      const { role, currentPassword } = roleChangeSchema.parse(req.body);
      const data = await adminUsersService.changeRole(req.user!.id, userId, role, currentPassword);
      res.json({ success: true, data, message: 'Rol actualizado' });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Datos inválidos' });
      if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
      console.error('Error updating user role:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar rol' });
    }
  },

  async updateUserStatus(req: Request, res: Response) {
    try {
      const userId = userIdSchema.parse(req.params.userId);
      const { isActive } = userStatusSchema.parse(req.body);
      const data = await adminUsersService.setActive(req.user!.id, userId, isActive);
      res.json({ success: true, data, message: isActive ? 'Cuenta reactivada' : 'Cuenta desactivada' });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Datos inválidos' });
      if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
      console.error('Error updating user status:', error);
      res.status(500).json({ success: false, message: 'Error al cambiar el estado de la cuenta' });
    }
  },

  // ==================== Verificación de docentes ====================

  async listTeacherVerifications(req: Request, res: Response) {
    try {
      const filter = req.query.status === 'UNVERIFIED' ? 'UNVERIFIED' : 'PENDING';
      res.json({ success: true, data: await teacherVerificationService.listForAdmin(filter) });
    } catch (error) {
      console.error('Error listing teacher verifications:', error);
      res.status(500).json({ success: false, message: 'Error al obtener docentes por verificar' });
    }
  },

  async reviewTeacherVerification(req: Request, res: Response) {
    try {
      const body = z.object({ approved: z.boolean(), reason: z.string().max(480).optional() }).parse(req.body);
      if (body.approved) await teacherVerificationService.approve(req.params.userId);
      else await teacherVerificationService.reject(req.params.userId, body.reason);
      res.json({ success: true, message: body.approved ? 'Docente verificado' : 'Solicitud rechazada' });
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Datos inválidos' });
      console.error('Error reviewing teacher verification:', error);
      res.status(500).json({ success: false, message: 'Error al revisar la verificación' });
    }
  },

  async listVerifiedDomains(_req: Request, res: Response) {
    try {
      res.json({ success: true, data: await teacherVerificationService.listDomains() });
    } catch (error) {
      console.error('Error listing domains:', error);
      res.status(500).json({ success: false, message: 'Error al obtener dominios' });
    }
  },

  async previewVerifiedDomain(req: Request, res: Response) {
    try {
      const { domain } = z.object({ domain: z.string().trim().min(3).max(255) }).parse(req.query);
      res.json({ success: true, data: await teacherVerificationService.previewDomain(domain) });
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Escribe un dominio' });
      console.error('Error previewing domain:', error);
      res.status(500).json({ success: false, message: 'Error al revisar el dominio' });
    }
  },

  async addVerifiedDomain(req: Request, res: Response) {
    try {
      const body = z.object({ domain: z.string().min(3).max(255), note: z.string().max(255).optional(), schoolId: z.string().uuid().nullable().optional() }).parse(req.body);
      const result = await teacherVerificationService.addDomain(req.user!.id, body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Datos inválidos' });
      console.error('Error adding domain:', error);
      res.status(500).json({ success: false, message: 'Error al agregar el dominio' });
    }
  },

  async removeVerifiedDomain(req: Request, res: Response) {
    try {
      await teacherVerificationService.removeDomain(req.params.domainId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing domain:', error);
      res.status(500).json({ success: false, message: 'Error al quitar el dominio' });
    }
  },

  // ==================== GESTIÓN DE CLASES ====================
  async getClassrooms(_req: Request, res: Response) {
    try {
      res.json({ success: true, data: await adminClassroomsService.list() });
    } catch (error) {
      console.error('Error getting classrooms:', error);
      res.status(500).json({ success: false, message: 'Error al obtener clases' });
    }
  },

  async getClassroomDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Obtener información básica de la clase
      const [classroom] = await db
        .select({
          id: classrooms.id,
          name: classrooms.name,
          code: classrooms.code,
          isActive: classrooms.isActive,
          createdAt: classrooms.createdAt,
          updatedAt: classrooms.updatedAt,
          teacher: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            createdAt: users.createdAt,
          },
        })
        .from(classrooms)
        .innerJoin(users, eq(classrooms.teacherId, users.id))
        .where(eq(classrooms.id, id));

      if (!classroom) {
        return res.status(404).json({ success: false, message: 'Clase no encontrada' });
      }

      // Contar clases del profesor
      const [teacherClassrooms] = await db
        .select({ count: count() })
        .from(classrooms)
        .where(eq(classrooms.teacherId, classroom.teacher.id));

      // Estadísticas de estudiantes
      const [studentStats] = await db
        .select({
          total: count(),
          active: sql<number>`SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END)`,
          inactive: sql<number>`SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END)`,
        })
        .from(studentProfiles)
        .where(eq(studentProfiles.classroomId, id));

      // Contar bancos de preguntas
      const [questionBanksCount] = await db
        .select({ count: count() })
        .from(questionBanks)
        .where(eq(questionBanks.classroomId, id));

      // Contar actividades por tipo
      const [timedActivitiesCount] = await db
        .select({ count: count() })
        .from(timedActivities)
        .where(eq(timedActivities.classroomId, id));

      const [expeditionsCount] = await db
        .select({ count: count() })
        .from(expeditions)
        .where(eq(expeditions.classroomId, id));

      // Actividades completadas
      const [timedCompleted] = await db
        .select({ count: count() })
        .from(timedActivities)
        .where(sql`${timedActivities.classroomId} = ${id} AND ${timedActivities.status} = 'COMPLETED'`);

      const [expeditionsCompleted] = await db
        .select({ count: count() })
        .from(expeditions)
        .where(sql`${expeditions.classroomId} = ${id} AND ${expeditions.status} = 'ARCHIVED'`);

      const totalActivities = timedActivitiesCount.count + expeditionsCount.count;
      const completedActivities = timedCompleted.count + expeditionsCompleted.count;

      // Última actividad (más reciente entre todas las tablas)
      const lastTimedActivity = await db
        .select({ updatedAt: timedActivities.updatedAt })
        .from(timedActivities)
        .where(eq(timedActivities.classroomId, id))
        .orderBy(desc(timedActivities.updatedAt))
        .limit(1);

      const lastExpedition = await db
        .select({ updatedAt: expeditions.updatedAt })
        .from(expeditions)
        .where(eq(expeditions.classroomId, id))
        .orderBy(desc(expeditions.updatedAt))
        .limit(1);

      // Los puntos son la señal real de uso: una clase que solo usa comportamientos también está activa.
      const points = await adminClassroomsService.activity(id);
      const allLastActivities = [
        lastTimedActivity[0]?.updatedAt,
        lastExpedition[0]?.updatedAt,
        points.lastPointAt,
      ].filter(Boolean) as (Date | string)[];

      const lastActivity = allLastActivities.length > 0
        ? new Date(Math.max(...allLastActivities.map(d => new Date(d).getTime())))
        : null;

      // Obtener lista de estudiantes
      const studentsList = await db
        .select({
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
          displayName: studentProfiles.displayName,
          level: studentProfiles.level,
          xp: studentProfiles.xp,
          gp: studentProfiles.gp,
          hp: studentProfiles.hp,
          avatarGender: studentProfiles.avatarGender,
          isActive: studentProfiles.isActive,
          createdAt: studentProfiles.createdAt,
        })
        .from(studentProfiles)
        .where(eq(studentProfiles.classroomId, id))
        .orderBy(desc(studentProfiles.level));

      // Obtener lista de actividades
      const timedActivitiesList = await db
        .select({
          id: timedActivities.id,
          name: timedActivities.name,
          mode: timedActivities.mode,
          status: timedActivities.status,
          createdAt: timedActivities.createdAt,
        })
        .from(timedActivities)
        .where(eq(timedActivities.classroomId, id))
        .orderBy(desc(timedActivities.createdAt));

      const expeditionsList = await db
        .select({
          id: expeditions.id,
          name: expeditions.name,
          status: expeditions.status,
          createdAt: expeditions.createdAt,
        })
        .from(expeditions)
        .where(eq(expeditions.classroomId, id))
        .orderBy(desc(expeditions.createdAt));

      // Obtener lista de bancos de preguntas con conteo de preguntas
      const questionBanksList = await db
        .select({
          id: questionBanks.id,
          name: questionBanks.name,
          description: questionBanks.description,
          createdAt: questionBanks.createdAt,
        })
        .from(questionBanks)
        .where(eq(questionBanks.classroomId, id))
        .orderBy(desc(questionBanks.createdAt));

      // Contar preguntas por banco
      const questionBanksWithCount = await Promise.all(
        questionBanksList.map(async (bank) => {
          const [countResult] = await db
            .select({ count: count() })
            .from(questions)
            .where(eq(questions.bankId, bank.id));
          return {
            ...bank,
            questionCount: countResult.count,
          };
        })
      );

      res.json({
        success: true,
        data: {
          classroom,
          teacherClassroomsCount: teacherClassrooms.count,
          stats: {
            students: {
              total: studentStats.total,
              active: Number(studentStats.active) || 0,
              inactive: Number(studentStats.inactive) || 0,
            },
            questionBanks: questionBanksCount.count,
            activities: {
              total: totalActivities,
              byType: {
                timer: timedActivitiesCount.count,
                expedition: expeditionsCount.count,
              },
              completed: completedActivities,
            },
            lastActivity,
            points: { thisWeek: points.pointsThisWeek, studentsThisWeek: points.studentsThisWeek },
          },
          students: studentsList,
          activities: {
            timed: timedActivitiesList,
            expeditions: expeditionsList,
          },
          questionBanks: questionBanksWithCount,
        },
      });
    } catch (error) {
      console.error('Error getting classroom details:', error);
      res.status(500).json({ success: false, message: 'Error al obtener detalles de la clase' });
    }
  },
};
