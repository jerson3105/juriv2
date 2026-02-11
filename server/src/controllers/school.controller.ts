import { Request, Response } from 'express';
import { schoolService } from '../services/school.service.js';
import { z } from 'zod';

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
});

const importBehaviorsSchema = z.object({
  behaviorIds: z.array(z.string().max(36)).min(1),
  classroomIds: z.array(z.string().max(36)).min(1),
});

const createSchoolBadgeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(255),
  icon: z.string().min(1).max(50),
  customImage: z.string().max(500).optional(),
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
  customImage: z.string().max(500).optional().nullable(),
  category: z.enum(['PROGRESS', 'PARTICIPATION', 'SOCIAL', 'SHOP', 'SPECIAL', 'SECRET', 'CUSTOM']).optional(),
  rarity: z.enum(['RARE', 'EPIC', 'LEGENDARY']).optional(),
  unlockCondition: z.any().optional(),
  rewardXp: z.number().int().min(0).optional(),
  rewardGp: z.number().int().min(0).optional(),
  isSecret: z.boolean().optional(),
});

const importBadgesSchema = z.object({
  badgeIds: z.array(z.string().max(36)).min(1),
  classroomIds: z.array(z.string().max(36)).min(1),
});

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

      // Verificar que el usuario es miembro verificado
      const membership = await schoolService.getMembership(schoolId, userId);
      if (!membership || membership.status !== 'VERIFIED') {
        return res.status(403).json({ success: false, message: 'No tienes acceso a esta escuela' });
      }

      const detail = await schoolService.getSchoolDetail(schoolId);
      res.json({ success: true, data: detail });
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

      const membership = await schoolService.getMembership(schoolId, userId);
      if (!membership || (membership.status !== 'VERIFIED' && !(membership.role === 'OWNER' && membership.status === 'PENDING_ADMIN'))) {
        return res.status(403).json({ success: false, message: 'No tienes acceso a esta escuela' });
      }

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

      // Verificar que es OWNER
      const membership = await schoolService.getMembership(schoolId, userId);
      if (!membership || membership.role !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Solo el responsable puede ver solicitudes' });
      }

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

      await schoolService.reviewJoinRequest(memberId, data.approved, data.reason);
      res.json({ success: true, message: data.approved ? 'Solicitud aceptada' : 'Solicitud rechazada' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Datos inválidos' });
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

      const membership = await schoolService.getMembership(schoolId, userId);
      if (!membership || (membership.status !== 'VERIFIED' && !(membership.role === 'OWNER' && membership.status === 'PENDING_ADMIN'))) {
        return res.status(403).json({ success: false, message: 'No tienes acceso a esta escuela' });
      }

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

      const membership = await schoolService.getMembership(schoolId, userId);
      if (!membership || membership.role !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Solo el responsable puede crear comportamientos' });
      }

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

      const membership = await schoolService.getMembership(behavior.schoolId, userId);
      if (!membership || membership.role !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Solo el responsable puede editar comportamientos' });
      }

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

      const membership = await schoolService.getMembership(behavior.schoolId, userId);
      if (!membership || membership.role !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Solo el responsable puede eliminar comportamientos' });
      }

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

      const membership = await schoolService.getMembership(schoolId, userId);
      if (!membership || membership.status !== 'VERIFIED') {
        return res.status(403).json({ success: false, message: 'No tienes acceso a esta escuela' });
      }

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

      const membership = await schoolService.getMembership(schoolId, userId);
      if (!membership || (membership.status !== 'VERIFIED' && !(membership.role === 'OWNER' && membership.status === 'PENDING_ADMIN'))) {
        return res.status(403).json({ success: false, message: 'No tienes acceso a esta escuela' });
      }

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

      const membership = await schoolService.getMembership(schoolId, userId);
      if (!membership || membership.role !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Solo el responsable puede crear insignias' });
      }

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

      const membership = await schoolService.getMembership(badge.schoolId, userId);
      if (!membership || membership.role !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Solo el responsable puede editar insignias' });
      }

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

      const membership = await schoolService.getMembership(badge.schoolId, userId);
      if (!membership || membership.role !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Solo el responsable puede eliminar insignias' });
      }

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

      const membership = await schoolService.getMembership(schoolId, userId);
      if (!membership || membership.status !== 'VERIFIED') {
        return res.status(403).json({ success: false, message: 'No tienes acceso a esta escuela' });
      }

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

      // Verificar que es OWNER
      const membership = await schoolService.getMembership(schoolId, req.user!.id);
      if (!membership || membership.role !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Solo el profesor responsable puede ver reportes' });
      }

      const startDate = sd ? new Date(sd as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = ed ? new Date(ed as string) : new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
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

      const membership = await schoolService.getMembership(schoolId, req.user!.id);
      if (!membership || membership.role !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Solo el profesor responsable puede ver reportes' });
      }

      const startDate = sd ? new Date(sd as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = ed ? new Date(ed as string) : new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      const data = await schoolService.getBehaviorTrends(schoolId, startDate, endDate, classroomId as string | undefined);
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

      const membership = await schoolService.getMembership(schoolId, req.user!.id);
      if (!membership || membership.role !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Solo el profesor responsable puede ver reportes' });
      }

      const startDate = sd ? new Date(sd as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = ed ? new Date(ed as string) : new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
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

      const membership = await schoolService.getMembership(schoolId, req.user!.id);
      if (!membership || membership.role !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Solo el profesor responsable puede ver reportes' });
      }

      const startDate = sd ? new Date(sd as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = ed ? new Date(ed as string) : new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
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

      const membership = await schoolService.getMembership(schoolId, req.user!.id);
      if (!membership || membership.role !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Solo el profesor responsable puede ver reportes' });
      }

      const startDate = sd ? new Date(sd as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = ed ? new Date(ed as string) : new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
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

      const membership = await schoolService.getMembership(schoolId, req.user!.id);
      if (!membership || membership.role !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Solo el profesor responsable puede ver reportes' });
      }

      const startDate = sd ? new Date(sd as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = ed ? new Date(ed as string) : new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      const data = await schoolService.getAttendanceReport(schoolId, startDate, endDate);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting attendance report:', error);
      res.status(500).json({ success: false, message: 'Error al obtener reporte de asistencia' });
    }
  }
}

export const schoolController = new SchoolController();
