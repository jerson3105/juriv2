import { Request, Response } from 'express';
import { schoolService } from '../services/school.service.js';
import { schoolManagementService, SchoolManagementError } from '../services/schoolManagement.service.js';
import { BADGE_IMAGE_PATTERN } from '../utils/badgeConditions.js';
import { z } from 'zod';
import {
  requireSchoolOwner,
  requireSchoolOwnerByMember,
  requireClassroomTeacher,
  schoolIdOfClassroom,
  teacherOwnsClassroom,
  requireSchoolClassroomMember,
  requireSchoolViewer,
  verifiedSchoolRole,
} from '../utils/access.js';

const createSchoolSchema = z.object({
  name: z.string().min(2).max(255),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  googlePlaceId: z.string().max(255).optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

const createVerificationSchema = z.object({
  schoolId: z.string().uuid(),
  position: z.string().min(2).max(100),
  documentUrls: z.array(z.string()).optional(),
  details: z.string().max(2000).optional(),
});

const reviewJoinSchema = z.object({
  approved: z.boolean(),
  reason: z.string().max(500).optional(),
});

const reviewVerificationSchema = z.object({
  approved: z.boolean(),
  note: z.string().max(500).optional(),
});

const createSchoolBehaviorSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  pointType: z.enum(['XP', 'HP', 'GP']),
  pointValue: z.number().int().min(1),
  xpValue: z.number().int().min(0).optional(),
  hpValue: z.number().int().min(0).optional(),
  gpValue: z.number().int().min(0).optional(),
  icon: z.string().max(50).optional(),
});

const updateSchoolBehaviorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional().nullable(),
  pointType: z.enum(['XP', 'HP', 'GP']).optional(),
  pointValue: z.number().int().min(1).optional(),
  xpValue: z.number().int().min(0).optional(),
  hpValue: z.number().int().min(0).optional(),
  gpValue: z.number().int().min(0).optional(),
  icon: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(), // Deshacer un eliminado
});

const importBehaviorsSchema = z.object({
  behaviorIds: z.array(z.string().max(36)).min(1),
  classroomIds: z.array(z.string().max(36)).min(1),
});

const createSchoolBadgeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(255),
  icon: z.string().min(1).max(50),
  // Solo imágenes subidas a la plataforma: una URL externa se cargaría en el navegador de cada alumno.
  customImage: z.string().regex(BADGE_IMAGE_PATTERN, 'Imagen no válida').optional(),
  category: z.enum(['PROGRESS', 'PARTICIPATION', 'SOCIAL', 'SHOP', 'SPECIAL', 'SECRET', 'CUSTOM']).optional(),
  rarity: z.enum(['RARE', 'EPIC', 'LEGENDARY']).optional(),
  assignmentMode: z.enum(['MANUAL']).optional(),
  unlockCondition: z.any().optional(),
  rewardXp: z.number().int().min(0).optional(),
  rewardGp: z.number().int().min(0).optional(),
  isSecret: z.boolean().optional(),
});

const updateSchoolBadgeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(255).optional(),
  icon: z.string().min(1).max(50).optional(),
  customImage: z.string().regex(BADGE_IMAGE_PATTERN, 'Imagen no válida').optional().nullable(),
  category: z.enum(['PROGRESS', 'PARTICIPATION', 'SOCIAL', 'SHOP', 'SPECIAL', 'SECRET', 'CUSTOM']).optional(),
  rarity: z.enum(['RARE', 'EPIC', 'LEGENDARY']).optional(),
  unlockCondition: z.any().optional(),
  rewardXp: z.number().int().min(0).optional(),
  rewardGp: z.number().int().min(0).optional(),
  isSecret: z.boolean().optional(),
  isActive: z.boolean().optional(), // Deshacer un eliminado
});

const importBadgesSchema = z.object({
  badgeIds: z.array(z.string().max(36)).min(1),
  classroomIds: z.array(z.string().max(36)).min(1),
});

// Periodo de un reporte: fechas YYYY-MM-DD en la hora del servidor (la misma con la que se guardan los registros).
// Sin fechas: del 1 de enero a hoy. Devuelve null si el formato o el orden son inválidos.
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const parseDay = (value: unknown, endOfDay: boolean): Date | null => {
  const m = typeof value === 'string' ? DAY_RE.exec(value) : null;
  if (!m) return null;
  const d = endOfDay
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999)
    : new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Rechaza fechas imposibles (2026-02-31 se convertiría en marzo).
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
};
const parseReportRange = (sd: unknown, ed: unknown) => {
  const now = new Date();
  const startDate = sd === undefined ? new Date(now.getFullYear(), 0, 1) : parseDay(sd, false);
  const endDate = ed === undefined ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999) : parseDay(ed, true);
  if (!startDate || !endDate || startDate > endDate) return null;
  return { startDate, endDate };
};

class SchoolController {
  // Buscar escuelas existentes en Juried
  async search(req: Request, res: Response) {
    try {
      const query = (req.query.q as string) || '';
      if (query.length < 2) {
        return res.json({ success: true, data: [] });
      }
      const results = await schoolService.search(query);
      res.json({ success: true, data: results });
    } catch (error) {
      console.error('Error searching schools:', error);
      res.status(500).json({ success: false, message: 'Error al buscar escuelas' });
    }
  }

  // Crear escuela nueva
  async create(req: Request, res: Response) {
    try {
      const data = createSchoolSchema.parse(req.body);
      const userId = (req as any).user.id;

      // Si viene de Google Maps, verificar que no exista ya
      if (data.googlePlaceId) {
        const existing = await schoolService.getByGooglePlaceId(data.googlePlaceId);
        if (existing) {
          return res.status(400).json({
            success: false,
            message: 'Esta escuela ya está registrada en Juried',
            data: { existingSchoolId: existing.id },
          });
        }
      }

      const school = await schoolService.create(userId, data);
      res.status(201).json({ success: true, data: school });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error creating school:', error);
      res.status(500).json({ success: false, message: 'Error al crear escuela' });
    }
  }

  // Solicitar unirse a una escuela
  async requestJoin(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const userId = (req as any).user.id;

      const school = await schoolService.getById(schoolId);
      if (!school) {
        return res.status(404).json({ success: false, message: 'Escuela no encontrada' });
      }

      const result = await schoolService.requestJoin(userId, schoolId);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      if (error.message?.includes('Ya tienes')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error('Error requesting join:', error);
      res.status(500).json({ success: false, message: 'Error al solicitar unirse' });
    }
  }

  // Obtener mis escuelas
  async getMySchools(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const results = await schoolService.getMySchools(userId);
      res.json({ success: true, data: results });
    } catch (error) {
      console.error('Error getting my schools:', error);
      res.status(500).json({ success: false, message: 'Error al obtener escuelas' });
    }
  }

  // Obtener detalle de escuela
  async getDetail(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const userId = (req as any).user.id;

      if (!(await requireSchoolViewer(req, res, schoolId))) return;

      const detail = await schoolService.getSchoolDetail(schoolId);
      if (!detail) return res.status(404).json({ success: false, message: 'Escuela no encontrada' });
      const isOwner = req.user!.role === 'ADMIN' || (await verifiedSchoolRole(req.user!.id, schoolId)) === 'OWNER';
      const classroomsWithActivity = await schoolManagementService.getSchoolClassrooms(schoolId);
      // Solo el responsable ve el código de invitación y los miembros no verificados.
      res.json({
        success: true,
        data: {
          ...detail,
          inviteCode: isOwner ? detail.inviteCode : null,
          inviteExpiresAt: isOwner ? detail.inviteExpiresAt : null,
          members: isOwner ? detail.members : detail.members.filter((m) => m.status === 'VERIFIED'),
          classrooms: classroomsWithActivity,
        },
      });
    } catch (error) {
      console.error('Error getting school detail:', error);
      res.status(500).json({ success: false, message: 'Error al obtener detalle de escuela' });
    }
  }

  // Obtener profesores de la escuela con sus clases
  async getSchoolTeachers(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const userId = (req as any).user.id;

      if (!(await requireSchoolViewer(req, res, schoolId))) return;

      const teachers = await schoolService.getSchoolTeachers(schoolId);
      res.json({ success: true, data: teachers });
    } catch (error) {
      console.error('Error getting school teachers:', error);
      res.status(500).json({ success: false, message: 'Error al obtener profesores' });
    }
  }

  // Obtener solicitudes pendientes (owner)
  async getPendingRequests(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const userId = (req as any).user.id;

      if (!(await requireSchoolOwner(req, res, schoolId))) return;

      const requests = await schoolService.getPendingRequests(schoolId);
      res.json({ success: true, data: requests });
    } catch (error) {
      console.error('Error getting pending requests:', error);
      res.status(500).json({ success: false, message: 'Error al obtener solicitudes' });
    }
  }

  // Revisar solicitud de unión (owner)
  async reviewJoinRequest(req: Request, res: Response) {
    try {
      const { memberId } = req.params;
      const data = reviewJoinSchema.parse(req.body);

      if (!(await requireSchoolOwnerByMember(req, res, memberId))) return;

      await schoolManagementService.reviewPendingRequest(memberId, data.approved, data.reason);
      res.json({ success: true, message: data.approved ? 'Solicitud aceptada' : 'Solicitud rechazada' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos' });
      }
      if (error instanceof SchoolManagementError) {
        return res.status(error.status).json({ success: false, message: error.message });
      }
      console.error('Error reviewing join request:', error);
      res.status(500).json({ success: false, message: 'Error al revisar solicitud' });
    }
  }

  // Cancelar solicitud de unión
  async cancelJoinRequest(req: Request, res: Response) {
    try {
      const { memberId } = req.params;
      const userId = (req as any).user.id;
      await schoolService.cancelJoinRequest(memberId, userId);
      res.json({ success: true, message: 'Solicitud cancelada' });
    } catch (error: any) {
      if (error.message?.includes('no encontrada') || error.message?.includes('Solo puedes')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error('Error canceling join request:', error);
      res.status(500).json({ success: false, message: 'Error al cancelar solicitud' });
    }
  }

  // Asignar clase a escuela
  async assignClassroom(req: Request, res: Response) {
    try {
      const { schoolId, classroomId } = req.params;
      // Debe pertenecer a la escuela (dueño o profesor verificado) y ser dueño de la clase que asigna.
      if (!(await requireSchoolClassroomMember(req, res, schoolId))) return;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      await schoolService.assignClassroom(classroomId, schoolId);
      res.json({ success: true, message: 'Clase asignada a la escuela' });
    } catch (error) {
      console.error('Error assigning classroom:', error);
      res.status(500).json({ success: false, message: 'Error al asignar clase' });
    }
  }

  // Desasignar clase de escuela
  async unassignClassroom(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      // Puede desasignar el profesor dueño de la clase o el OWNER de su escuela.
      const schoolId = await schoolIdOfClassroom(classroomId);
      const user = req.user!;
      const isClassTeacher = user.role === 'ADMIN' || await teacherOwnsClassroom(user.id, classroomId);
      if (!isClassTeacher) {
        if (!schoolId) {
          return res.status(404).json({ success: false, message: 'La clase no está asignada a ninguna escuela' });
        }
        if (!(await requireSchoolOwner(req, res, schoolId))) return;
      }
      await schoolService.unassignClassroom(classroomId);
      res.json({ success: true, message: 'Clase desasignada de la escuela' });
    } catch (error) {
      console.error('Error unassigning classroom:', error);
      res.status(500).json({ success: false, message: 'Error al desasignar clase' });
    }
  }

  // ==================== VERIFICACIONES ====================

  // Enviar verificación
  async createVerification(req: Request, res: Response) {
    try {
      const data = createVerificationSchema.parse(req.body);
      const userId = (req as any).user.id;

      // Verificar que no tenga una pendiente
      const existing = await schoolService.getPendingVerification(data.schoolId, userId);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Ya tienes una verificación pendiente' });
      }

      const result = await schoolService.createVerification(userId, data);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error creating verification:', error);
      res.status(500).json({ success: false, message: 'Error al enviar verificación' });
    }
  }

  // ==================== ADMIN ====================

  // Obtener verificaciones pendientes (admin)
  async getAdminPendingVerifications(req: Request, res: Response) {
    try {
      const verifications = await schoolService.getAllPendingVerifications();
      res.json({ success: true, data: verifications });
    } catch (error) {
      console.error('Error getting pending verifications:', error);
      res.status(500).json({ success: false, message: 'Error al obtener verificaciones' });
    }
  }

  // Revisar verificación (admin)
  async reviewVerification(req: Request, res: Response) {
    try {
      const { verificationId } = req.params;
      const data = reviewVerificationSchema.parse(req.body);
      const adminId = (req as any).user.id;

      await schoolService.reviewVerification(verificationId, adminId, data.approved, data.note);
      res.json({ success: true, message: data.approved ? 'Verificación aprobada' : 'Verificación rechazada' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos' });
      }
      console.error('Error reviewing verification:', error);
      res.status(500).json({ success: false, message: 'Error al revisar verificación' });
    }
  }

  // Obtener todas las escuelas (admin)
  async getAllSchools(req: Request, res: Response) {
    try {
      const results = await schoolService.getAllSchools();
      res.json({ success: true, data: results });
    } catch (error) {
      console.error('Error getting all schools:', error);
      res.status(500).json({ success: false, message: 'Error al obtener escuelas' });
    }
  }

  // Obtener todas las escuelas con miembros (admin)
  async getAllSchoolsWithMembers(req: Request, res: Response) {
    try {
      const results = await schoolService.getAllSchoolsWithMembers();
      res.json({ success: true, data: results });
    } catch (error) {
      console.error('Error getting schools with members:', error);
      res.status(500).json({ success: false, message: 'Error al obtener escuelas' });
    }
  }
  // ==================== COMPORTAMIENTOS DE ESCUELA ====================

  // Obtener comportamientos de escuela
  async getSchoolBehaviors(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const userId = (req as any).user.id;

      if (!(await requireSchoolViewer(req, res, schoolId))) return;

      const behaviors = await schoolService.getSchoolBehaviors(schoolId);
      res.json({ success: true, data: behaviors });
    } catch (error) {
      console.error('Error getting school behaviors:', error);
      res.status(500).json({ success: false, message: 'Error al obtener comportamientos' });
    }
  }

  // Crear comportamiento de escuela (solo OWNER)
  async createSchoolBehavior(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const userId = (req as any).user.id;

      if (!(await requireSchoolOwner(req, res, schoolId))) return;

      const data = createSchoolBehaviorSchema.parse(req.body);
      const behavior = await schoolService.createSchoolBehavior(schoolId, userId, data);
      res.status(201).json({ success: true, data: behavior });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error creating school behavior:', error);
      res.status(500).json({ success: false, message: 'Error al crear comportamiento' });
    }
  }

  // Actualizar comportamiento de escuela (solo OWNER)
  async updateSchoolBehavior(req: Request, res: Response) {
    try {
      const { behaviorId } = req.params;
      const userId = (req as any).user.id;

      const behavior = await schoolService.getSchoolBehaviorById(behaviorId);
      if (!behavior) {
        return res.status(404).json({ success: false, message: 'Comportamiento no encontrado' });
      }

      if (!(await requireSchoolOwner(req, res, behavior.schoolId))) return;

      const data = updateSchoolBehaviorSchema.parse(req.body);
      const updated = await schoolService.updateSchoolBehavior(behaviorId, data);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos' });
      }
      console.error('Error updating school behavior:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar comportamiento' });
    }
  }

  // Eliminar comportamiento de escuela (solo OWNER)
  async deleteSchoolBehavior(req: Request, res: Response) {
    try {
      const { behaviorId } = req.params;
      const userId = (req as any).user.id;

      const behavior = await schoolService.getSchoolBehaviorById(behaviorId);
      if (!behavior) {
        return res.status(404).json({ success: false, message: 'Comportamiento no encontrado' });
      }

      if (!(await requireSchoolOwner(req, res, behavior.schoolId))) return;

      await schoolService.deleteSchoolBehavior(behaviorId);
      res.json({ success: true, message: 'Comportamiento eliminado' });
    } catch (error) {
      console.error('Error deleting school behavior:', error);
      res.status(500).json({ success: false, message: 'Error al eliminar comportamiento' });
    }
  }

  // Importar comportamientos de escuela a clases del profesor
  async importBehaviors(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const userId = (req as any).user.id;

      if (!(await requireSchoolViewer(req, res, schoolId))) return;

      const data = importBehaviorsSchema.parse(req.body);
      const result = await schoolService.importBehaviorsToClassrooms(data.behaviorIds, data.classroomIds, userId);
      res.json({ success: true, data: result, message: `Se importaron ${result.imported} comportamientos` });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos' });
      }
      if (error.message) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error('Error importing behaviors:', error);
      res.status(500).json({ success: false, message: 'Error al importar comportamientos' });
    }
  }

  // ==================== INSIGNIAS DE ESCUELA ====================

  // Obtener insignias de escuela
  async getSchoolBadges(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const userId = (req as any).user.id;

      if (!(await requireSchoolViewer(req, res, schoolId))) return;

      const badges = await schoolService.getSchoolBadges(schoolId);
      res.json({ success: true, data: badges });
    } catch (error) {
      console.error('Error getting school badges:', error);
      res.status(500).json({ success: false, message: 'Error al obtener insignias' });
    }
  }

  // Crear insignia de escuela (solo OWNER)
  async createSchoolBadge(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const userId = (req as any).user.id;

      if (!(await requireSchoolOwner(req, res, schoolId))) return;

      const data = createSchoolBadgeSchema.parse(req.body);
      const badge = await schoolService.createSchoolBadge(schoolId, userId, data);
      res.status(201).json({ success: true, data: badge });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error creating school badge:', error);
      res.status(500).json({ success: false, message: 'Error al crear insignia' });
    }
  }

  // Actualizar insignia de escuela (solo OWNER)
  async updateSchoolBadge(req: Request, res: Response) {
    try {
      const { badgeId } = req.params;
      const userId = (req as any).user.id;

      const badge = await schoolService.getSchoolBadgeById(badgeId);
      if (!badge) {
        return res.status(404).json({ success: false, message: 'Insignia no encontrada' });
      }

      if (!(await requireSchoolOwner(req, res, badge.schoolId))) return;

      const data = updateSchoolBadgeSchema.parse(req.body);
      const updated = await schoolService.updateSchoolBadge(badgeId, data);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos' });
      }
      console.error('Error updating school badge:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar insignia' });
    }
  }

  // Eliminar insignia de escuela (solo OWNER)
  async deleteSchoolBadge(req: Request, res: Response) {
    try {
      const { badgeId } = req.params;
      const userId = (req as any).user.id;

      const badge = await schoolService.getSchoolBadgeById(badgeId);
      if (!badge) {
        return res.status(404).json({ success: false, message: 'Insignia no encontrada' });
      }

      if (!(await requireSchoolOwner(req, res, badge.schoolId))) return;

      await schoolService.deleteSchoolBadge(badgeId);
      res.json({ success: true, message: 'Insignia eliminada' });
    } catch (error) {
      console.error('Error deleting school badge:', error);
      res.status(500).json({ success: false, message: 'Error al eliminar insignia' });
    }
  }

  // Importar insignias de escuela a clases del profesor
  async importBadges(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const userId = (req as any).user.id;

      if (!(await requireSchoolViewer(req, res, schoolId))) return;

      const data = importBadgesSchema.parse(req.body);
      const result = await schoolService.importBadgesToClassrooms(data.badgeIds, data.classroomIds, userId);
      res.json({ success: true, data: result, message: `Se importaron ${result.imported} insignias` });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos' });
      }
      if (error.message) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error('Error importing badges:', error);
      res.status(500).json({ success: false, message: 'Error al importar insignias' });
    }
  }
  // ==================== REPORTES ====================

  async getReportSummary(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const { startDate: sd, endDate: ed } = req.query;

      if (!(await requireSchoolOwner(req, res, schoolId))) return;

      const range = parseReportRange(sd, ed);
      if (!range) return res.status(400).json({ success: false, message: 'Periodo inválido' });
      const { startDate, endDate } = range;
      const data = await schoolService.getReportSummary(schoolId, startDate, endDate);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting report summary:', error);
      res.status(500).json({ success: false, message: 'Error al obtener resumen' });
    }
  }

  async getBehaviorTrends(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const { startDate: sd, endDate: ed, classroomId } = req.query;

      if (!(await requireSchoolOwner(req, res, schoolId))) return;

      const range = parseReportRange(sd, ed);
      if (!range) return res.status(400).json({ success: false, message: 'Periodo inválido' });
      const { startDate, endDate } = range;
      // Si se filtra por clase, debe pertenecer a esta escuela (evita leer clases de otras escuelas).
      if (classroomId !== undefined && (typeof classroomId !== 'string' || (await schoolIdOfClassroom(classroomId)) !== schoolId)) {
        return res.status(404).json({ success: false, message: 'Clase no encontrada en esta escuela' });
      }
      const data = await schoolService.getBehaviorTrends(schoolId, startDate, endDate, classroomId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting behavior trends:', error);
      res.status(500).json({ success: false, message: 'Error al obtener tendencias' });
    }
  }

  async getClassRanking(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const { startDate: sd, endDate: ed } = req.query;

      if (!(await requireSchoolOwner(req, res, schoolId))) return;

      const range = parseReportRange(sd, ed);
      if (!range) return res.status(400).json({ success: false, message: 'Periodo inválido' });
      const { startDate, endDate } = range;
      const data = await schoolService.getClassRanking(schoolId, startDate, endDate);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting class ranking:', error);
      res.status(500).json({ success: false, message: 'Error al obtener ranking' });
    }
  }

  async getTopBehaviors(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const { startDate: sd, endDate: ed } = req.query;

      if (!(await requireSchoolOwner(req, res, schoolId))) return;

      const range = parseReportRange(sd, ed);
      if (!range) return res.status(400).json({ success: false, message: 'Periodo inválido' });
      const { startDate, endDate } = range;
      const data = await schoolService.getTopBehaviors(schoolId, startDate, endDate);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting top behaviors:', error);
      res.status(500).json({ success: false, message: 'Error al obtener comportamientos' });
    }
  }

  async getStudentsAtRisk(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const { startDate: sd, endDate: ed } = req.query;

      if (!(await requireSchoolOwner(req, res, schoolId))) return;

      const range = parseReportRange(sd, ed);
      if (!range) return res.status(400).json({ success: false, message: 'Periodo inválido' });
      const { startDate, endDate } = range;
      const data = await schoolService.getStudentsAtRisk(schoolId, startDate, endDate);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting students at risk:', error);
      res.status(500).json({ success: false, message: 'Error al obtener estudiantes en riesgo' });
    }
  }

  async getAttendanceReport(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const { startDate: sd, endDate: ed } = req.query;

      if (!(await requireSchoolOwner(req, res, schoolId))) return;

      const range = parseReportRange(sd, ed);
      if (!range) return res.status(400).json({ success: false, message: 'Periodo inválido' });
      const { startDate, endDate } = range;
      const data = await schoolService.getAttendanceReport(schoolId, startDate, endDate);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting attendance report:', error);
      res.status(500).json({ success: false, message: 'Error al obtener reporte de asistencia' });
    }
  }
}

export const schoolController = new SchoolController();

// ==================== GESTIÓN DEL RESPONSABLE ====================

const sendManagementError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof SchoolManagementError) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

const INVITE_CODE_RE = /^[A-Z0-9]{6,16}$/;

export const schoolManagementController = {
  // DELETE /schools/:schoolId/members/:memberId — retirar profesor (sus clases vuelven a ser personales)
  async removeTeacher(req: Request, res: Response) {
    try {
      const { schoolId, memberId } = req.params;
      if (!(await requireSchoolOwner(req, res, schoolId))) return;
      const result = await schoolManagementService.removeTeacher(schoolId, memberId);
      res.json({ success: true, data: result, message: 'Profesor retirado de la escuela' });
    } catch (error) {
      return sendManagementError(res, error, 'Error al retirar al profesor');
    }
  },

  // GET /schools/:schoolId/classrooms/:classroomId/report — reporte de una clase de la escuela
  async classroomReport(req: Request, res: Response) {
    try {
      const { schoolId, classroomId } = req.params;
      if (!(await requireSchoolOwner(req, res, schoolId))) return;
      const data = await schoolManagementService.getClassroomReport(schoolId, classroomId);
      res.json({ success: true, data });
    } catch (error) {
      return sendManagementError(res, error, 'Error al obtener el reporte de la clase');
    }
  },

  // POST /schools/:schoolId/invite — genera o renueva el código (invalida el anterior)
  async regenerateInvite(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolOwner(req, res, schoolId))) return;
      const inviteCode = await schoolManagementService.regenerateInviteCode(schoolId);
      res.json({ success: true, data: { inviteCode } });
    } catch (error) {
      return sendManagementError(res, error, 'Error al generar la invitación');
    }
  },

  // DELETE /schools/:schoolId/invite — desactiva el enlace
  async disableInvite(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolOwner(req, res, schoolId))) return;
      await schoolManagementService.disableInviteCode(schoolId);
      res.json({ success: true, message: 'Invitación desactivada' });
    } catch (error) {
      return sendManagementError(res, error, 'Error al desactivar la invitación');
    }
  },

  // GET /schools/invite/:code — a qué escuela lleva el enlace
  async previewInvite(req: Request, res: Response) {
    try {
      const code = String(req.params.code || '').toUpperCase();
      if (!INVITE_CODE_RE.test(code)) return res.status(404).json({ success: false, message: 'Enlace no válido' });
      const school = await schoolManagementService.findByInviteCode(code);
      if (!school) return res.status(404).json({ success: false, message: 'El enlace de invitación no es válido o fue desactivado' });
      const membership = await schoolService.getMembership(school.id, req.user!.id);
      res.json({ success: true, data: { school, memberStatus: membership?.status ?? null } });
    } catch (error) {
      return sendManagementError(res, error, 'Error al leer la invitación');
    }
  },

  // POST /schools/invite/:code/join — unirse con el enlace
  async joinByInvite(req: Request, res: Response) {
    try {
      const code = String(req.params.code || '').toUpperCase();
      if (!INVITE_CODE_RE.test(code)) return res.status(404).json({ success: false, message: 'Enlace no válido' });
      const result = await schoolManagementService.joinByInvite(req.user!.id, code);
      res.json({ success: true, data: result, message: result.alreadyMember ? 'Ya eras parte de esta escuela' : 'Te uniste a la escuela' });
    } catch (error) {
      return sendManagementError(res, error, 'Error al unirse con la invitación');
    }
  },
};

