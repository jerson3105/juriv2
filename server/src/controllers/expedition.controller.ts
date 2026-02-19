import { Request, Response } from 'express';
import { expeditionService } from '../services/expedition.service.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const ensureTeacherClassroomAccess = async (
  req: Request,
  res: Response,
  classroomId: string
): Promise<boolean> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }

  if (user.role === 'ADMIN') {
    return true;
  }

  if (user.role !== 'TEACHER') {
    res.status(403).json({ error: 'No tienes permisos para esta acción' });
    return false;
  }

  const isOwner = await expeditionService.verifyTeacherOwnsClassroom(user.id, classroomId);
  if (!isOwner) {
    res.status(403).json({ error: 'No tienes acceso a esta clase' });
    return false;
  }

  return true;
};

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
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const expeditionFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Solo permitir imágenes y PDFs
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WebP) y PDFs'));
  }
};

export const uploadExpeditionFile = multer({
  storage: expeditionStorage,
  fileFilter: expeditionFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
}).single('file');

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
    const { classroomId, name, description, mapImageUrl, competencyIds } = req.body;
    
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
    }

    const expedition = await expeditionService.getById(id);
    
    if (!expedition) {
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
    
    if (!pinData.pinType || !pinData.name || pinData.positionX === undefined || pinData.positionY === undefined) {
      return res.status(400).json({ error: 'pinType, name, positionX y positionY son requeridos' });
    }
    
    // Convertir fechas de string a Date si existen y son válidas
    if (pinData.dueDate && pinData.dueDate !== '') {
      const date = new Date(pinData.dueDate);
      pinData.dueDate = isNaN(date.getTime()) ? null : date;
    } else {
      pinData.dueDate = null;
    }
    if (pinData.earlySubmissionDate && pinData.earlySubmissionDate !== '') {
      const date = new Date(pinData.earlySubmissionDate);
      pinData.earlySubmissionDate = isNaN(date.getTime()) ? null : date;
    } else {
      pinData.earlySubmissionDate = null;
    }
    
    const pin = await expeditionService.createPin({
      expeditionId,
      ...pinData,
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
    }

    const pin = await expeditionService.getPinById(pinId);
    
    if (!pin) {
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
    
    // Convertir fechas de string a Date si existen y son válidas
    if (pinData.dueDate && pinData.dueDate !== '') {
      const date = new Date(pinData.dueDate);
      pinData.dueDate = isNaN(date.getTime()) ? null : date;
    } else if (pinData.dueDate === '') {
      pinData.dueDate = null;
    }
    if (pinData.earlySubmissionDate && pinData.earlySubmissionDate !== '') {
      const date = new Date(pinData.earlySubmissionDate);
      pinData.earlySubmissionDate = isNaN(date.getTime()) ? null : date;
    } else if (pinData.earlySubmissionDate === '') {
      pinData.earlySubmissionDate = null;
    }
    
    const pin = await expeditionService.updatePin(pinId, pinData);
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
    const { studentProfileId, passed } = req.body;

    const hasAccess = await ensureTeacherPinAccess(req, res, pinId);
    if (!hasAccess) return;
    
    if (!studentProfileId || passed === undefined) {
      return res.status(400).json({ error: 'studentProfileId y passed son requeridos' });
    }
    
    const progress = await expeditionService.setTeacherDecision(pinId, studentProfileId, passed);
    res.json(progress);
  } catch (error) {
    console.error('Error setting teacher decision:', error);
    res.status(500).json({ error: 'Error al establecer decisión' });
  }
};

export const setTeacherDecisionBulk = async (req: Request, res: Response) => {
  try {
    const { pinId } = req.params;
    const { decisions } = req.body; // Array de { studentProfileId, passed }

    const hasAccess = await ensureTeacherPinAccess(req, res, pinId);
    if (!hasAccess) return;
    
    if (!decisions || !Array.isArray(decisions)) {
      return res.status(400).json({ error: 'decisions debe ser un array' });
    }
    
    const results = [];
    for (const decision of decisions) {
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
    const { studentProfileId, files, comment } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'files es requerido y debe ser un array no vacío' });
    }

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
    }
    
    const expedition = await expeditionService.getById(expeditionId);
    if (!expedition) {
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
    res.status(500).json({ error: error.message || 'Error al completar pin' });
  }
};
