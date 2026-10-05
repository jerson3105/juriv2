import type { Request, Response } from 'express';
import { z } from 'zod';
import { schoolAssignmentService, type ClassroomChoice } from '../services/schoolAssignment.service.js';
import { schoolPlanService } from '../services/schoolPlan.service.js';
import { schoolWorkshopService } from '../services/schoolWorkshop.service.js';
import { SCHOOL_LEVELS } from '../services/schoolYear.service.js';
import { isSchoolManagerRole, requireSchoolRole, SCHOOL_MANAGER_ROLES, SCHOOL_MEMBER_ROLES } from '../utils/access.js';
import { auditRequest } from '../utils/audit.js';
import { AppError } from '../utils/errors.js';

const idSchema = z.string().uuid();
// Las áreas del CNEB tienen ids fijos (area-pe-mat…), no UUID.
const areaIdSchema = z.string().regex(/^[a-z0-9-]{3,36}$/, 'Área inválida');
const levelSchema = z.enum(SCHOOL_LEVELS);

const classroomChoiceSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('create') }).strict(),
  z.object({ mode: z.literal('link'), classroomId: idSchema }).strict(),
  z.object({ mode: z.literal('none') }).strict(),
], { errorMap: () => ({ message: 'Elige qué clase usar' }) });

const planSchema = z.object({
  areas: z.array(z.object({ areaId: areaIdSchema, grades: z.array(z.number().int().min(1).max(6)).min(1).max(6) }).strict()).min(1).max(20),
}).strict();
const createSchema = z.object({ sectionId: idSchema, areaId: areaIdSchema, teacherUserId: idSchema, classroom: classroomChoiceSchema }).strict();
const updateSchema = z.object({ teacherUserId: idSchema.optional(), classroom: classroomChoiceSchema.optional() }).strict()
  .refine((value) => Object.keys(value).length > 0, 'No hay nada que cambiar');
const setClassroomSchema = z.object({ classroom: classroomChoiceSchema }).strict();
const workshopFields = {
  name: z.string().max(120),
  level: levelSchema,
  areaId: areaIdSchema,
  teacherUserId: idSchema,
  mode: z.enum(['SECTION', 'CHOSEN'], { errorMap: () => ({ message: 'Elige quiénes lo llevan' }) }),
  sectionIds: z.array(idSchema).max(60),
  studentIds: z.array(idSchema).max(600),
  weight: z.number().int(),
};
const workshopCreateSchema = z.object({
  ...workshopFields, sectionIds: workshopFields.sectionIds.default([]), studentIds: workshopFields.studentIds.default([]), classroom: classroomChoiceSchema,
}).strict();
const workshopUpdateSchema = z.object({
  name: workshopFields.name.optional(), level: workshopFields.level.optional(), areaId: workshopFields.areaId.optional(),
  teacherUserId: workshopFields.teacherUserId.optional(), mode: workshopFields.mode.optional(), sectionIds: workshopFields.sectionIds.optional(),
  studentIds: workshopFields.studentIds.optional(), weight: workshopFields.weight.optional(), classroom: classroomChoiceSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'No hay nada que cambiar');

const workshopIdOf = (req: Request, res: Response) => {
  const id = idSchema.safeParse(req.params.workshopId);
  if (!id.success) res.status(404).json({ success: false, message: 'Taller no encontrado' });
  return id.success ? id.data : null;
};

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return res.status(400).json({ success: false, message: !issue || issue.code === 'unrecognized_keys' ? 'Datos inválidos' : issue.message });
  }
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

const yearOf = (req: Request, res: Response) => {
  const yearId = idSchema.safeParse(req.params.yearId);
  if (!yearId.success) res.status(404).json({ success: false, message: 'Año escolar no encontrado' });
  return yearId.success ? yearId.data : null;
};

/** Escuela y año, con la administración verificada (sin atajo para el ADMIN de la plataforma). */
const managerScope = async (req: Request, res: Response) => {
  const { schoolId } = req.params;
  if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return null;
  const yearId = yearOf(req, res);
  return yearId ? { schoolId, yearId } : null;
};

/** Cualquier miembro verificado (Mis asignaciones, mi tutoría); dice si además es de la administración. */
const memberScope = async (req: Request, res: Response) => {
  const { schoolId } = req.params;
  const role = await requireSchoolRole(req, res, schoolId, SCHOOL_MEMBER_ROLES);
  if (!role) return null;
  return { schoolId, manager: isSchoolManagerRole(role) };
};

const assignmentIdOf = (req: Request, res: Response) => {
  const id = idSchema.safeParse(req.params.assignmentId);
  if (!id.success) res.status(404).json({ success: false, message: 'Asignación no encontrada' });
  return id.success ? id.data : null;
};

const syncSummary = (sync: { created: number; linked: number }) => {
  const n = sync.created + sync.linked;
  return n > 0 ? ` · ${n} ${n === 1 ? 'estudiante entró' : 'estudiantes entraron'} a la clase` : '';
};

const choiceLabel = (choice?: ClassroomChoice) => choice?.mode ?? 'keep';

export const schoolAssignmentController = {
  // GET /schools/:schoolId/years/:yearId/plan — plan de estudios por nivel
  async getPlan(req: Request, res: Response) {
    try {
      const s = await managerScope(req, res);
      if (!s) return;
      res.json({ success: true, data: await schoolPlanService.get(s.schoolId, s.yearId) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener el plan de estudios');
    }
  },

  // PUT /schools/:schoolId/years/:yearId/plan/:level — guarda el plan de un nivel
  async savePlan(req: Request, res: Response) {
    try {
      const s = await managerScope(req, res);
      if (!s) return;
      const level = levelSchema.parse(req.params.level);
      const { areas } = planSchema.parse(req.body);
      const data = await schoolPlanService.save(s.schoolId, s.yearId, level, areas);
      await auditRequest(req, { action: 'school.plan_updated', schoolId: s.schoolId, target: { type: 'school_year', id: s.yearId }, metadata: { level, areas: areas.length } });
      res.json({ success: true, data, message: 'Plan de estudios guardado' });
    } catch (error) {
      return sendError(res, error, 'Error al guardar el plan de estudios');
    }
  },

  // GET /schools/:schoolId/years/:yearId/assignments?level= — matriz sección × área
  async matrix(req: Request, res: Response) {
    try {
      const s = await managerScope(req, res);
      if (!s) return;
      const level = req.query.level ? levelSchema.parse(req.query.level) : undefined;
      res.json({ success: true, data: await schoolAssignmentService.matrix(s.schoolId, s.yearId, level) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener las asignaciones');
    }
  },

  // GET /schools/:schoolId/teachers/:teacherId/classrooms — clases de un docente en la escuela (para vincular)
  async teacherClassrooms(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const teacherId = idSchema.parse(req.params.teacherId);
      res.json({ success: true, data: await schoolAssignmentService.teacherClassrooms(schoolId, teacherId) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener las clases del docente');
    }
  },

  // POST /schools/:schoolId/years/:yearId/assignments — asignar (y crear o vincular la clase)
  async create(req: Request, res: Response) {
    try {
      const s = await managerScope(req, res);
      if (!s) return;
      const input = createSchema.parse(req.body);
      const data = await schoolAssignmentService.create(s.schoolId, s.yearId, input, req.user!.id);
      await auditRequest(req, {
        action: 'school.assignment_created',
        schoolId: s.schoolId,
        target: { type: 'school_assignment', id: data.id },
        metadata: { classroom: input.classroom.mode, enrolled: data.sync.created + data.sync.linked },
      });
      res.status(201).json({ success: true, data, message: `Asignación guardada${syncSummary(data.sync)}` });
    } catch (error) {
      return sendError(res, error, 'Error al guardar la asignación');
    }
  },

  // PATCH /schools/:schoolId/assignments/:assignmentId — cambiar docente o clase
  async update(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const assignmentId = assignmentIdOf(req, res);
      if (!assignmentId) return;
      const patch = updateSchema.parse(req.body);
      const data = await schoolAssignmentService.update(schoolId, assignmentId, patch);
      await auditRequest(req, {
        action: 'school.assignment_updated',
        schoolId,
        target: { type: 'school_assignment', id: assignmentId },
        metadata: { teacherChanged: data.teacherChanged, classroom: choiceLabel(patch.classroom), enrolled: data.sync.created + data.sync.linked },
      });
      res.json({ success: true, data, message: `Asignación guardada${syncSummary(data.sync)}` });
    } catch (error) {
      return sendError(res, error, 'Error al guardar la asignación');
    }
  },

  // DELETE /schools/:schoolId/assignments/:assignmentId — quitar (la clase sigue con su docente)
  async remove(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const assignmentId = assignmentIdOf(req, res);
      if (!assignmentId) return;
      await schoolAssignmentService.remove(schoolId, assignmentId);
      await auditRequest(req, { action: 'school.assignment_removed', schoolId, target: { type: 'school_assignment', id: assignmentId } });
      res.json({ success: true, message: 'Asignación quitada: la clase sigue con su docente' });
    } catch (error) {
      return sendError(res, error, 'Error al quitar la asignación');
    }
  },

  // POST /schools/:schoolId/assignments/:assignmentId/sync — completar la matrícula automática
  async sync(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      const role = await requireSchoolRole(req, res, schoolId, SCHOOL_MEMBER_ROLES);
      if (!role) return;
      const assignmentId = assignmentIdOf(req, res);
      if (!assignmentId) return;
      if (!isSchoolManagerRole(role)) {
        // El docente sincroniza solo su propia asignación.
        const load = await schoolAssignmentService.ownerOf(schoolId, assignmentId);
        if (load !== req.user!.id) return res.status(403).json({ success: false, message: 'Esta asignación no es tuya' });
      }
      const data = await schoolAssignmentService.sync(schoolId, assignmentId);
      const n = data.created + data.linked;
      res.json({ success: true, data, message: n > 0 ? `${n} ${n === 1 ? 'estudiante entró' : 'estudiantes entraron'} a la clase` : 'La clase ya estaba al día' });
    } catch (error) {
      return sendError(res, error, 'Error al sincronizar la clase');
    }
  },

  // GET /schools/:schoolId/years/:yearId/assignments/from-classes — propuesta desde las clases
  async fromClassesPreview(req: Request, res: Response) {
    try {
      const s = await managerScope(req, res);
      if (!s) return;
      res.json({ success: true, data: await schoolAssignmentService.fromClassesPreview(s.schoolId, s.yearId) });
    } catch (error) {
      return sendError(res, error, 'Error al revisar las clases');
    }
  },

  // POST /schools/:schoolId/years/:yearId/assignments/from-classes — asignar todas las propuestas
  async fromClassesConfirm(req: Request, res: Response) {
    try {
      const s = await managerScope(req, res);
      if (!s) return;
      const data = await schoolAssignmentService.fromClassesConfirm(s.schoolId, s.yearId, req.user!.id);
      await auditRequest(req, {
        action: 'school.assignments_from_classes',
        schoolId: s.schoolId,
        target: { type: 'school_year', id: s.yearId },
        metadata: { assigned: data.assigned, enrolled: data.sync.created + data.sync.linked },
      });
      res.json({ success: true, data, message: `${data.assigned} ${data.assigned === 1 ? 'asignación lista' : 'asignaciones listas'}${syncSummary(data.sync).replace(' a la clase', ' a sus clases')}` });
    } catch (error) {
      return sendError(res, error, 'Error al asignar desde las clases');
    }
  },

  // GET /schools/:schoolId/years/:yearId/my-load — Mis asignaciones y mi tutoría
  async myLoad(req: Request, res: Response) {
    try {
      const s = await memberScope(req, res);
      if (!s) return;
      const yearId = yearOf(req, res);
      if (!yearId) return;
      const [load, workshops] = await Promise.all([
        schoolAssignmentService.myLoad(s.schoolId, yearId, req.user!.id),
        schoolWorkshopService.mine(s.schoolId, yearId, req.user!.id),
      ]);
      res.json({ success: true, data: { ...load, workshops } });
    } catch (error) {
      return sendError(res, error, 'Error al obtener tus asignaciones');
    }
  },

  // PUT /schools/:schoolId/assignments/:assignmentId/classroom — su docente (o la administración) le pone clase
  async setClassroom(req: Request, res: Response) {
    try {
      const s = await memberScope(req, res);
      if (!s) return;
      const assignmentId = assignmentIdOf(req, res);
      if (!assignmentId) return;
      const { classroom } = setClassroomSchema.parse(req.body);
      const data = await schoolAssignmentService.setClassroom(s.schoolId, assignmentId, classroom, { id: req.user!.id, manager: s.manager });
      await auditRequest(req, {
        action: 'school.assignment_updated',
        schoolId: s.schoolId,
        target: { type: 'school_assignment', id: assignmentId },
        metadata: { teacherChanged: false, classroom: classroom.mode, enrolled: data.sync.created + data.sync.linked, byTeacher: !s.manager },
      });
      res.json({ success: true, data, message: `${classroom.mode === 'create' ? 'Clase creada' : classroom.mode === 'link' ? 'Clase vinculada' : 'Clase desvinculada'}${syncSummary(data.sync)}` });
    } catch (error) {
      return sendError(res, error, 'Error al guardar la clase');
    }
  },

  // GET /schools/:schoolId/years/:yearId/sections/:sectionId/tutoring — la sección de mi tutoría
  async tutoringSection(req: Request, res: Response) {
    try {
      const s = await memberScope(req, res);
      if (!s) return;
      const yearId = yearOf(req, res);
      if (!yearId) return;
      const sectionId = idSchema.parse(req.params.sectionId);
      res.set('Cache-Control', 'no-store');
      res.json({ success: true, data: await schoolAssignmentService.tutoringSection(s.schoolId, yearId, sectionId, { id: req.user!.id, manager: s.manager }) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener la sección');
    }
  },
  // GET /schools/:schoolId/years/:yearId/workshops?level= — talleres del año
  async listWorkshops(req: Request, res: Response) {
    try {
      const s = await managerScope(req, res);
      if (!s) return;
      const level = req.query.level ? levelSchema.parse(req.query.level) : undefined;
      res.json({ success: true, data: await schoolWorkshopService.list(s.schoolId, s.yearId, level) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener los talleres');
    }
  },

  // GET /schools/:schoolId/workshops/:workshopId — un taller con sus inscritos
  async getWorkshop(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const workshopId = workshopIdOf(req, res);
      if (!workshopId) return;
      res.set('Cache-Control', 'no-store');
      res.json({ success: true, data: await schoolWorkshopService.get(schoolId, workshopId) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener el taller');
    }
  },

  // POST /schools/:schoolId/years/:yearId/workshops — crear un taller (y su clase)
  async createWorkshop(req: Request, res: Response) {
    try {
      const s = await managerScope(req, res);
      if (!s) return;
      const input = workshopCreateSchema.parse(req.body);
      const data = await schoolWorkshopService.create(s.schoolId, s.yearId, input, req.user!.id);
      await auditRequest(req, {
        action: 'school.workshop_created',
        schoolId: s.schoolId,
        target: { type: 'school_workshop', id: data.id },
        metadata: { mode: input.mode, weight: input.weight, classroom: input.classroom.mode, enrolled: data.sync.created + data.sync.linked },
      });
      res.status(201).json({ success: true, data, message: `Taller guardado${syncSummary(data.sync)}` });
    } catch (error) {
      return sendError(res, error, 'Error al guardar el taller');
    }
  },

  // PATCH /schools/:schoolId/workshops/:workshopId — cambiar el taller
  async updateWorkshop(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const workshopId = workshopIdOf(req, res);
      if (!workshopId) return;
      const patch = workshopUpdateSchema.parse(req.body);
      const data = await schoolWorkshopService.update(schoolId, workshopId, patch, req.user!.id);
      await auditRequest(req, {
        action: 'school.workshop_updated',
        schoolId,
        target: { type: 'school_workshop', id: workshopId },
        metadata: { teacherChanged: data.teacherChanged, classroom: choiceLabel(patch.classroom), enrolled: data.sync.created + data.sync.linked },
      });
      res.json({ success: true, data, message: `Taller guardado${syncSummary(data.sync)}` });
    } catch (error) {
      return sendError(res, error, 'Error al guardar el taller');
    }
  },

  // DELETE /schools/:schoolId/workshops/:workshopId — quitar (la clase sigue con su docente)
  async removeWorkshop(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const workshopId = workshopIdOf(req, res);
      if (!workshopId) return;
      await schoolWorkshopService.remove(schoolId, workshopId);
      await auditRequest(req, { action: 'school.workshop_removed', schoolId, target: { type: 'school_workshop', id: workshopId } });
      res.json({ success: true, message: 'Taller quitado: la clase sigue con su docente' });
    } catch (error) {
      return sendError(res, error, 'Error al quitar el taller');
    }
  },

  // POST /schools/:schoolId/workshops/:workshopId/sync — completar la matrícula automática del taller
  async syncWorkshop(req: Request, res: Response) {
    try {
      const s = await memberScope(req, res);
      if (!s) return;
      const workshopId = workshopIdOf(req, res);
      if (!workshopId) return;
      const data = await schoolWorkshopService.sync(s.schoolId, workshopId, { id: req.user!.id, manager: s.manager });
      const n = data.created + data.linked;
      res.json({ success: true, data, message: n > 0 ? `${n} ${n === 1 ? 'estudiante entró' : 'estudiantes entraron'} a la clase` : 'La clase ya estaba al día' });
    } catch (error) {
      return sendError(res, error, 'Error al sincronizar el taller');
    }
  },

  // PUT /schools/:schoolId/workshops/:workshopId/classroom — su docente (o la administración) le pone clase
  async setWorkshopClassroom(req: Request, res: Response) {
    try {
      const s = await memberScope(req, res);
      if (!s) return;
      const workshopId = workshopIdOf(req, res);
      if (!workshopId) return;
      const { classroom } = setClassroomSchema.parse(req.body);
      const data = await schoolWorkshopService.setClassroom(s.schoolId, workshopId, classroom, { id: req.user!.id, manager: s.manager });
      await auditRequest(req, {
        action: 'school.workshop_updated',
        schoolId: s.schoolId,
        target: { type: 'school_workshop', id: workshopId },
        metadata: { teacherChanged: false, classroom: classroom.mode, enrolled: data.sync.created + data.sync.linked, byTeacher: !s.manager },
      });
      res.json({ success: true, data, message: `${classroom.mode === 'create' ? 'Clase creada' : classroom.mode === 'link' ? 'Clase vinculada' : 'Clase desvinculada'}${syncSummary(data.sync)}` });
    } catch (error) {
      return sendError(res, error, 'Error al guardar la clase del taller');
    }
  },
};
