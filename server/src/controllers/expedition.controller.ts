import { Request, Response } from 'express';
import { z } from 'zod';
import { expeditionService } from '../services/expedition.service.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  createUploadFilter,
  safeUploadFilename,
  verifyUploadedFile,
  IMAGE_MIMES,
  PDF_MIMES,
} from '../utils/fileValidation.js';
import { publicErrorMessage } from '../utils/errors.js';
import { requireClassroomTeacher } from '../utils/access.js';

// Acceso de profesor a la clase: ver utils/access.ts (requireClassroomTeacher).
const ensureTeacherClassroomAccess = requireClassroomTeacher;

// Lecturas: solo el docente de la clase, sus alumnos o el admin. Antes cualquier otro rol (una familia
// recién registrada) pasaba sin control y leía expediciones y progreso de cualquier clase.
const denyOtherRoles = (res: Response) => res.status(403).json({ error: 'No tienes permisos para esta acción' });

// ── Validación de paradas, decisiones y entregas ──
// Recompensa por parada: sin negativos (restaban XP sin dejar registro) y con tope.
const MAX_PIN_REWARD = 500;
// Archivo propio subido a /api/uploads/expeditions, o enlace https (incluye Genially: el cliente solo lo
// incrusta si el dominio es genial.ly). Nada de javascript:, data: ni http:.
const OWN_UPLOAD = /^\/api\/uploads\/expeditions\/[\w.-]+$/;
const nullAsMissing = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((value) => (value === null ? undefined : value), schema.optional());
const resourceSchema = z.string().trim().max(500, 'El enlace es muy largo')
  .refine((value) => OWN_UPLOAD.test(value) || /^https:\/\/[^\s<>"']+$/i.test(value), 'Recurso no válido: usa un archivo subido o un enlace https');
const rewardSchema = z.coerce.number({ invalid_type_error: 'La recompensa debe ser un número' })
  .int('La recompensa debe ser un número entero')
  .min(0, 'La recompensa no puede ser negativa')
  .max(MAX_PIN_REWARD, `La recompensa no puede pasar de ${MAX_PIN_REWARD}`);
const positionSchema = z.coerce.number({ invalid_type_error: 'Posición no válida' }).min(0, 'Posición no válida').max(100, 'Posición no válida').transform(Math.round);
// '' o null = sin fecha; una fecha inválida también queda sin fecha (como antes).
const dateSchema = z.union([z.string(), z.null()]).optional().transform((value) => {
  if (value === undefined) return undefined;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
});
// Lista blanca de campos: el resto del body se descarta. Antes se copiaba entero y podía pisar
// expeditionId (crear o mover paradas a expediciones de otra clase).
const pinFieldsSchema = z.object({
  pinType: z.enum(['INTRO', 'OBJECTIVE', 'FINAL'], { errorMap: () => ({ message: 'Tipo de parada no válido' }) }),
  name: z.string({ required_error: 'La parada necesita un nombre' }).trim().min(1, 'La parada necesita un nombre').max(255, 'El nombre es muy largo'),
  positionX: positionSchema,
  positionY: positionSchema,
  storyContent: nullAsMissing(z.string().max(20000, 'La historia es muy larga')),
  storyFiles: nullAsMissing(z.array(resourceSchema).max(5, 'Máximo 5 recursos')),
  taskName: nullAsMissing(z.string().max(255, 'El nombre de la tarea es muy largo')),
  taskContent: nullAsMissing(z.string().max(20000, 'La tarea es muy larga')),
  taskFiles: nullAsMissing(z.array(resourceSchema).max(5, 'Máximo 5 recursos')),
  requiresSubmission: nullAsMissing(z.boolean()),
  dueDate: dateSchema,
  rewardXp: nullAsMissing(rewardSchema),
  rewardGp: nullAsMissing(rewardSchema),
  earlySubmissionEnabled: nullAsMissing(z.boolean()),
  earlySubmissionDate: dateSchema,
  earlyBonusXp: nullAsMissing(rewardSchema),
  earlyBonusGp: nullAsMissing(rewardSchema),
  autoProgress: z.boolean().nullable().optional(),
});
const decisionSchema = z.object({
  studentProfileId: z.string().uuid('Alumno no válido'),
  passed: z.boolean({ required_error: 'Falta la decisión', invalid_type_error: 'La decisión debe ser sí o no' }),
});
const decisionsSchema = z.array(decisionSchema).min(1, 'No hay decisiones').max(300, 'Demasiadas decisiones a la vez');
// Las entregas solo pueden apuntar a archivos subidos con /expeditions/upload.
const submissionSchema = z.object({
  studentProfileId: z.string().optional(),
  files: z.array(z.string().regex(OWN_UPLOAD, 'Archivo no válido: súbelo desde la expedición'))
    .min(1, 'Sube al menos un archivo').max(5, 'Máximo 5 archivos'),
  comment: z.string().max(2000, 'El comentario es muy largo').nullable().optional(),
});
const firstIssue = (error: z.ZodError, fallback: string) => error.issues[0]?.message ?? fallback;

const ensureTeacherExpeditionAccess = async (
  req: Request,
  res: Response,
  expeditionId: string
): Promise<boolean> => {
  const classroomId = await expeditionService.getClassroomIdByExpedition(expeditionId);
  if (!classroomId) {
    res.status(404).json({ error: 'Expedición no encontrada' });
    return false;
  }

  return ensureTeacherClassroomAccess(req, res, classroomId);
};

const ensureTeacherPinAccess = async (
  req: Request,
  res: Response,
  pinId: string
): Promise<boolean> => {
  const classroomId = await expeditionService.getClassroomIdByPin(pinId);
  if (!classroomId) {
    res.status(404).json({ error: 'Pin no encontrado' });
    return false;
  }

  return ensureTeacherClassroomAccess(req, res, classroomId);
};

const ensureTeacherConnectionAccess = async (
  req: Request,
  res: Response,
  connectionId: string
): Promise<boolean> => {
  const classroomId = await expeditionService.getClassroomIdByConnection(connectionId);
  if (!classroomId) {
    res.status(404).json({ error: 'Conexión no encontrada' });
    return false;
  }

  return ensureTeacherClassroomAccess(req, res, classroomId);
};

const resolveStudentProfileInClassroom = async (
  req: Request,
  res: Response,
  classroomId: string,
  requestedStudentProfileId?: string
): Promise<string | null> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: 'No autorizado' });
    return null;
  }

  if (user.role !== 'STUDENT') {
    res.status(403).json({ error: 'Solo los estudiantes pueden realizar esta acción' });
    return null;
  }

  const studentProfileId = await expeditionService.getStudentProfileInClassroomByUser(user.id, classroomId);
  if (!studentProfileId) {
    res.status(403).json({ error: 'No tienes acceso a esta clase' });
    return null;
  }

  if (requestedStudentProfileId && requestedStudentProfileId !== studentProfileId) {
    res.status(403).json({ error: 'No tienes permiso para usar ese perfil de estudiante' });
    return null;
  }

  return studentProfileId;
};

const ensureStudentProfileReadAccess = async (
  req: Request,
  res: Response,
  studentProfileId: string,
  classroomId?: string
): Promise<boolean> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }

  if (user.role === 'ADMIN') {
    return true;
  }

  if (user.role === 'STUDENT') {
    const isOwner = await expeditionService.verifyStudentBelongsToUser(studentProfileId, user.id);
    if (!isOwner) {
      res.status(403).json({ error: 'No tienes permiso para este perfil de estudiante' });
      return false;
    }

    if (classroomId) {
      const studentClassroomId = await expeditionService.getClassroomIdByStudentProfile(studentProfileId);
      if (!studentClassroomId || studentClassroomId !== classroomId) {
        res.status(403).json({ error: 'No tienes acceso a esta clase' });
        return false;
      }
    }

    return true;
  }

  if (user.role === 'TEACHER') {
    const targetClassroomId = classroomId || await expeditionService.getClassroomIdByStudentProfile(studentProfileId);
    if (!targetClassroomId) {
      res.status(404).json({ error: 'Perfil de estudiante no encontrado' });
      return false;
    }

    const isOwner = await expeditionService.verifyTeacherOwnsClassroom(user.id, targetClassroomId);
    if (!isOwner) {
      res.status(403).json({ error: 'No tienes acceso a este perfil de estudiante' });
      return false;
    }

    return true;
  }

  res.status(403).json({ error: 'No tienes permisos para esta acción' });
  return false;
};

// Configurar multer para archivos de expediciones (máximo 5MB)
const baseUploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const expeditionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(baseUploadDir, 'expeditions');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: safeUploadFilename,
});

// Solo imágenes y PDFs; la extensión sale del MIME y el contenido se verifica tras guardar.
const expeditionFileFilter = createUploadFilter(
  [...PDF_MIMES, ...IMAGE_MIMES],
  'Solo se permiten imágenes (JPG, PNG, GIF, WebP) y PDFs'
);

export const uploadExpeditionFile = [
  multer({
    storage: expeditionStorage,
    fileFilter: expeditionFileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB máximo
    },
  }).single('file'),
  verifyUploadedFile,
];

// Controlador para manejar la subida de archivo
export const handleExpeditionUpload = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const fileUrl = `/api/uploads/expeditions/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename });
  } catch (error) {
    console.error('Error uploading expedition file:', error);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
};

// ==================== EXPEDITION CRUD ====================

export const createExpedition = async (req: Request, res: Response) => {
  try {
    const { classroomId, name, description, mapImageUrl, competencyIds, competencyIndicatorIds } = req.body;
    
    if (!classroomId || !name || !mapImageUrl) {
      return res.status(400).json({ error: 'classroomId, name y mapImageUrl son requeridos' });
    }

    const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
    if (!hasAccess) return;
    
    const expedition = await expeditionService.create({
      classroomId,
      name,
      description,
      mapImageUrl,
      competencyIds: Array.isArray(competencyIds) ? competencyIds : undefined,
      competencyIndicatorIds: Array.isArray(competencyIndicatorIds) ? competencyIndicatorIds : undefined,
    });
    
    res.status(201).json(expedition);
  } catch (error) {
    console.error('Error creating expedition:', error);
    res.status(500).json({ error: 'Error al crear expedición' });
  }
};

export const getExpedition = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const classroomId = await expeditionService.getClassroomIdByExpedition(id);
    if (!classroomId) {
      return res.status(404).json({ error: 'Expedición no encontrada' });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    if (user.role === 'TEACHER') {
      const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!hasAccess) return;
    } else if (user.role === 'STUDENT') {
      const hasAccess = await expeditionService.verifyStudentUserInClassroom(user.id, classroomId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'No tienes acceso a esta expedición' });
      }
    } else if (user.role !== 'ADMIN') {
      return denyOtherRoles(res);
    }

    const expedition = await expeditionService.getById(id);

    // Un borrador es del docente: el alumno no lo ve hasta que se publica.
    if (!expedition || (user.role === 'STUDENT' && expedition.status === 'DRAFT')) {
      return res.status(404).json({ error: 'Expedición no encontrada' });
    }

    res.json(expedition);
  } catch (error) {
    console.error('Error getting expedition:', error);
    res.status(500).json({ error: 'Error al obtener expedición' });
  }
};

export const getClassroomExpeditions = async (req: Request, res: Response) => {
  try {
    const { classroomId } = req.params;
    const { status } = req.query;

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    let resolvedStatus = status as any;

    if (user.role === 'TEACHER') {
      const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!hasAccess) return;
    } else if (user.role === 'STUDENT') {
      const hasAccess = await expeditionService.verifyStudentUserInClassroom(user.id, classroomId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'No tienes acceso a esta clase' });
      }
      resolvedStatus = 'PUBLISHED';
    } else if (user.role !== 'ADMIN') {
      return denyOtherRoles(res);
    }
    
    const expeditions = await expeditionService.getByClassroom(
      classroomId,
      resolvedStatus
    );
    
    res.json(expeditions);
  } catch (error) {
    console.error('Error getting classroom expeditions:', error);
    res.status(500).json({ error: 'Error al obtener expediciones' });
  }
};

export const updateExpedition = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, mapImageUrl, autoProgress } = req.body;

    const hasAccess = await ensureTeacherExpeditionAccess(req, res, id);
    if (!hasAccess) return;
    
    const expedition = await expeditionService.update(id, {
      name,
      description,
      mapImageUrl,
      autoProgress,
    });
    
    res.json(expedition);
  } catch (error) {
    console.error('Error updating expedition:', error);
    res.status(500).json({ error: 'Error al actualizar expedición' });
  }
};

export const publishExpedition = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const hasAccess = await ensureTeacherExpeditionAccess(req, res, id);
    if (!hasAccess) return;

    const expedition = await expeditionService.publish(id);
    res.json(expedition);
  } catch (error) {
    console.error('Error publishing expedition:', error);
    res.status(500).json({ error: 'Error al publicar expedición' });
  }
};

export const archiveExpedition = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const hasAccess = await ensureTeacherExpeditionAccess(req, res, id);
    if (!hasAccess) return;

    const expedition = await expeditionService.archive(id);
    res.json(expedition);
  } catch (error) {
    console.error('Error archiving expedition:', error);
    res.status(500).json({ error: 'Error al archivar expedición' });
  }
};

export const deleteExpedition = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const hasAccess = await ensureTeacherExpeditionAccess(req, res, id);
    if (!hasAccess) return;
    
    // Verificar que esté en DRAFT
    const expedition = await expeditionService.getById(id);
    if (!expedition) {
      return res.status(404).json({ error: 'Expedición no encontrada' });
    }
    if (expedition.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Solo se pueden eliminar expediciones en borrador' });
    }
    
    await expeditionService.delete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting expedition:', error);
    res.status(500).json({ error: 'Error al eliminar expedición' });
  }
};

// ==================== PIN CRUD ====================

export const createPin = async (req: Request, res: Response) => {
  try {
    const { expeditionId } = req.params;
    const pinData = req.body;

    const hasAccess = await ensureTeacherExpeditionAccess(req, res, expeditionId);
    if (!hasAccess) return;

    const parsed = pinFieldsSchema.safeParse(pinData);
    if (!parsed.success) {
      return res.status(400).json({ error: firstIssue(parsed.error, 'Datos de la parada no válidos') });
    }
    const data = parsed.data;

    // expeditionId sale de la ruta (ya autorizada), nunca del body.
    const pin = await expeditionService.createPin({
      ...data,
      dueDate: data.dueDate ?? undefined,
      earlySubmissionDate: data.earlySubmissionDate ?? undefined,
      autoProgress: data.autoProgress ?? undefined,
      expeditionId,
    });
    
    res.status(201).json(pin);
  } catch (error) {
    console.error('Error creating pin:', error);
    res.status(500).json({ error: 'Error al crear pin' });
  }
};

export const getPin = async (req: Request, res: Response) => {
  try {
    const { pinId } = req.params;

    const classroomId = await expeditionService.getClassroomIdByPin(pinId);
    if (!classroomId) {
      return res.status(404).json({ error: 'Pin no encontrado' });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    if (user.role === 'TEACHER') {
      const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!hasAccess) return;
    } else if (user.role === 'STUDENT') {
      const hasAccess = await expeditionService.verifyStudentUserInClassroom(user.id, classroomId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'No tienes acceso a este pin' });
      }
    } else if (user.role !== 'ADMIN') {
      return denyOtherRoles(res);
    }

    const pin = await expeditionService.getPinById(pinId);

    // Las paradas de un borrador tampoco se muestran al alumno.
    if (!pin || (user.role === 'STUDENT' && await expeditionService.getStatusById(pin.expeditionId) === 'DRAFT')) {
      return res.status(404).json({ error: 'Pin no encontrado' });
    }
    
    res.json(pin);
  } catch (error) {
    console.error('Error getting pin:', error);
    res.status(500).json({ error: 'Error al obtener pin' });
  }
};

export const updatePin = async (req: Request, res: Response) => {
  try {
    const { pinId } = req.params;
    const pinData = req.body;

    const hasAccess = await ensureTeacherPinAccess(req, res, pinId);
    if (!hasAccess) return;

    // Solo los campos de la lista blanca: expeditionId, id o fechas del sistema ya no se pueden pisar.
    const parsed = pinFieldsSchema.partial().safeParse(pinData);
    if (!parsed.success) {
      return res.status(400).json({ error: firstIssue(parsed.error, 'Datos de la parada no válidos') });
    }

    const pin = await expeditionService.updatePin(pinId, parsed.data);
    res.json(pin);
  } catch (error) {
    console.error('Error updating pin:', error);
    res.status(500).json({ error: 'Error al actualizar pin' });
  }
};

export const deletePin = async (req: Request, res: Response) => {
  try {
    const { pinId } = req.params;

    const hasAccess = await ensureTeacherPinAccess(req, res, pinId);
    if (!hasAccess) return;

    await expeditionService.deletePin(pinId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting pin:', error);
    res.status(500).json({ error: 'Error al eliminar pin' });
  }
};

// ==================== CONNECTIONS ====================

export const createConnection = async (req: Request, res: Response) => {
  try {
    const { expeditionId } = req.params;
    const { fromPinId, toPinId, onSuccess } = req.body;

    const hasAccess = await ensureTeacherExpeditionAccess(req, res, expeditionId);
    if (!hasAccess) return;
    
    if (!fromPinId || !toPinId) {
      return res.status(400).json({ error: 'fromPinId y toPinId son requeridos' });
    }
    
    const connection = await expeditionService.createConnection({
      expeditionId,
      fromPinId,
      toPinId,
      onSuccess,
    });
    
    res.status(201).json(connection);
  } catch (error) {
    console.error('Error creating connection:', error);
    res.status(500).json({ error: 'Error al crear conexión' });
  }
};

export const updateConnection = async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { onSuccess } = req.body;

    const hasAccess = await ensureTeacherConnectionAccess(req, res, connectionId);
    if (!hasAccess) return;
    
    const connection = await expeditionService.updateConnection(connectionId, { onSuccess });
    res.json(connection);
  } catch (error) {
    console.error('Error updating connection:', error);
    res.status(500).json({ error: 'Error al actualizar conexión' });
  }
};

export const deleteConnection = async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;

    const hasAccess = await ensureTeacherConnectionAccess(req, res, connectionId);
    if (!hasAccess) return;

    await expeditionService.deleteConnection(connectionId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting connection:', error);
    res.status(500).json({ error: 'Error al eliminar conexión' });
  }
};

// ==================== STUDENT PROGRESS ====================

export const getStudentProgress = async (req: Request, res: Response) => {
  try {
    const { expeditionId, studentProfileId } = req.params;
    const classroomId = await expeditionService.getClassroomIdByExpedition(expeditionId);
    if (!classroomId) {
      return res.status(404).json({ error: 'Expedición no encontrada' });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    let resolvedStudentProfileId = studentProfileId;

    if (user.role === 'STUDENT') {
      const ownStudentProfileId = await resolveStudentProfileInClassroom(req, res, classroomId, studentProfileId);
      if (!ownStudentProfileId) return;
      resolvedStudentProfileId = ownStudentProfileId;
    } else if (user.role === 'TEACHER') {
      const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!hasAccess) return;

      const canReadTarget = await ensureStudentProfileReadAccess(req, res, studentProfileId, classroomId);
      if (!canReadTarget) return;
    } else if (user.role !== 'ADMIN') {
      return denyOtherRoles(res);
    }

    const progress = await expeditionService.getStudentProgress(expeditionId, resolvedStudentProfileId);

    if (!progress) {
      return res.status(404).json({ error: 'Progreso no encontrado' });
    }
    
    res.json(progress);
  } catch (error) {
    console.error('Error getting student progress:', error);
    res.status(500).json({ error: 'Error al obtener progreso' });
  }
};

export const getPinProgress = async (req: Request, res: Response) => {
  try {
    const { pinId } = req.params;

    const hasAccess = await ensureTeacherPinAccess(req, res, pinId);
    if (!hasAccess) return;

    const progress = await expeditionService.getPinStudentProgress(pinId);
    res.json(progress);
  } catch (error) {
    console.error('Error getting pin progress:', error);
    res.status(500).json({ error: 'Error al obtener progreso del pin' });
  }
};

export const setTeacherDecision = async (req: Request, res: Response) => {
  try {
    const { pinId } = req.params;

    const hasAccess = await ensureTeacherPinAccess(req, res, pinId);
    if (!hasAccess) return;

    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: firstIssue(parsed.error, 'Decisión no válida') });
    }

    const progress = await expeditionService.setTeacherDecision(pinId, parsed.data.studentProfileId, parsed.data.passed);
    res.json(progress);
  } catch (error) {
    console.error('Error setting teacher decision:', error);
    res.status(500).json({ error: 'Error al establecer decisión' });
  }
};

export const setTeacherDecisionBulk = async (req: Request, res: Response) => {
  try {
    const { pinId } = req.params;

    const hasAccess = await ensureTeacherPinAccess(req, res, pinId);
    if (!hasAccess) return;

    // Array de { studentProfileId, passed }, con tope (antes sin límite ni forma: un `passed` ausente marcaba FAILED).
    const parsed = decisionsSchema.safeParse(req.body?.decisions);
    if (!parsed.success) {
      return res.status(400).json({ error: firstIssue(parsed.error, 'Decisiones no válidas') });
    }

    const results = [];
    for (const decision of parsed.data) {
      const progress = await expeditionService.setTeacherDecision(
        pinId,
        decision.studentProfileId,
        decision.passed
      );
      results.push(progress);
    }
    
    res.json(results);
  } catch (error) {
    console.error('Error setting bulk teacher decisions:', error);
    res.status(500).json({ error: 'Error al establecer decisiones' });
  }
};

// ==================== SUBMISSIONS ====================

export const createSubmission = async (req: Request, res: Response) => {
  try {
    const { expeditionId, pinId } = req.params;
    const parsed = submissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: firstIssue(parsed.error, 'Entrega no válida') });
    }
    const { studentProfileId, files } = parsed.data;
    const comment = parsed.data.comment ?? undefined;

    const classroomId = await expeditionService.getClassroomIdByPin(pinId);
    if (!classroomId) {
      return res.status(404).json({ error: 'Pin no encontrado' });
    }

    const pinExpeditionId = await expeditionService.getExpeditionIdByPin(pinId);
    if (!pinExpeditionId || pinExpeditionId !== expeditionId) {
      return res.status(400).json({ error: 'El pin no pertenece a esta expedición' });
    }

    const resolvedStudentProfileId = await resolveStudentProfileInClassroom(req, res, classroomId, studentProfileId);
    if (!resolvedStudentProfileId) return;

    const canReadProfile = await ensureStudentProfileReadAccess(req, res, resolvedStudentProfileId, classroomId);
    if (!canReadProfile) return;

    const canReadProgress = await expeditionService.verifyStudentUserInClassroom(req.user!.id, classroomId);
    if (!canReadProgress) {
      return res.status(403).json({ error: 'No tienes acceso a esta clase' });
    }
    
    const submission = await expeditionService.createSubmission({
      expeditionId,
      pinId,
      studentProfileId: resolvedStudentProfileId,
      files,
      comment,
    });
    
    res.status(201).json(submission);
  } catch (error) {
    console.error('Error creating submission:', error);
    res.status(500).json({ error: 'Error al crear entrega' });
  }
};

export const getPinSubmissions = async (req: Request, res: Response) => {
  try {
    const { pinId } = req.params;

    const hasAccess = await ensureTeacherPinAccess(req, res, pinId);
    if (!hasAccess) return;

    const submissions = await expeditionService.getSubmissionsByPin(pinId);
    res.json(submissions);
  } catch (error) {
    console.error('Error getting pin submissions:', error);
    res.status(500).json({ error: 'Error al obtener entregas' });
  }
};

// ==================== STUDENT VIEW ====================

export const getStudentExpeditions = async (req: Request, res: Response) => {
  try {
    const { classroomId, studentProfileId } = req.params;

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    let resolvedStudentProfileId = studentProfileId;

    if (user.role === 'STUDENT') {
      const ownStudentProfileId = await resolveStudentProfileInClassroom(req, res, classroomId, studentProfileId);
      if (!ownStudentProfileId) return;
      resolvedStudentProfileId = ownStudentProfileId;
    } else if (user.role === 'TEACHER') {
      const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!hasAccess) return;

      const canReadTarget = await ensureStudentProfileReadAccess(req, res, studentProfileId, classroomId);
      if (!canReadTarget) return;
    } else if (user.role !== 'ADMIN') {
      return denyOtherRoles(res);
    }

    // Obtener expediciones publicadas
    const expeditions = await expeditionService.getByClassroom(classroomId, 'PUBLISHED');
    
    // Agregar progreso del estudiante a cada expedición
    const expeditionsWithProgress = await Promise.all(
      expeditions.map(async (expedition) => {
        const progress = await expeditionService.getStudentProgress(expedition.id, resolvedStudentProfileId);
        return {
          ...expedition,
          studentProgress: progress,
        };
      })
    );
    
    res.json(expeditionsWithProgress);
  } catch (error) {
    console.error('Error getting student expeditions:', error);
    res.status(500).json({ error: 'Error al obtener expediciones del estudiante' });
  }
};

export const getStudentExpeditionDetail = async (req: Request, res: Response) => {
  try {
    const { expeditionId, studentProfileId } = req.params;

    const classroomId = await expeditionService.getClassroomIdByExpedition(expeditionId);
    if (!classroomId) {
      return res.status(404).json({ error: 'Expedición no encontrada' });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    let resolvedStudentProfileId = studentProfileId;

    if (user.role === 'STUDENT') {
      const ownStudentProfileId = await resolveStudentProfileInClassroom(req, res, classroomId, studentProfileId);
      if (!ownStudentProfileId) return;
      resolvedStudentProfileId = ownStudentProfileId;
    } else if (user.role === 'TEACHER') {
      const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
      if (!hasAccess) return;

      const canReadTarget = await ensureStudentProfileReadAccess(req, res, studentProfileId, classroomId);
      if (!canReadTarget) return;
    } else if (user.role !== 'ADMIN') {
      return denyOtherRoles(res);
    }

    const expedition = await expeditionService.getById(expeditionId);
    if (!expedition || (user.role === 'STUDENT' && expedition.status === 'DRAFT')) {
      return res.status(404).json({ error: 'Expedición no encontrada' });
    }
    
    const progress = await expeditionService.getStudentProgress(expeditionId, resolvedStudentProfileId);
    
    res.json({
      ...expedition,
      studentProgress: progress,
    });
  } catch (error) {
    console.error('Error getting student expedition detail:', error);
    res.status(500).json({ error: 'Error al obtener detalle de expedición' });
  }
};

// Obtener estadísticas de expediciones para un classroom
export const getClassroomStats = async (req: Request, res: Response) => {
  try {
    const { classroomId } = req.params;

    const hasAccess = await ensureTeacherClassroomAccess(req, res, classroomId);
    if (!hasAccess) return;

    const stats = await expeditionService.getClassroomStats(classroomId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting classroom stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

// Completar un pin (estudiante avanza al siguiente)
export const completePin = async (req: Request, res: Response) => {
  try {
    const { pinId } = req.params;
    const { studentProfileId } = req.body;

    const classroomId = await expeditionService.getClassroomIdByPin(pinId);
    if (!classroomId) {
      return res.status(404).json({ error: 'Pin no encontrado' });
    }

    const resolvedStudentProfileId = await resolveStudentProfileInClassroom(req, res, classroomId, studentProfileId);
    if (!resolvedStudentProfileId) return;
    
    const progress = await expeditionService.completePin(pinId, resolvedStudentProfileId);
    res.json(progress);
  } catch (error: any) {
    console.error('Error completing pin:', error);
    res.status(500).json({ error: publicErrorMessage(error) || 'Error al completar pin' });
  }
};
