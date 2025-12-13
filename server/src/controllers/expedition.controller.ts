import { Request, Response } from 'express';
import { expeditionService } from '../services/expedition.service.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Configurar multer para archivos de expediciones (máximo 5MB)
const expeditionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'expeditions');
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

    const fileUrl = `/uploads/expeditions/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename });
  } catch (error) {
    console.error('Error uploading expedition file:', error);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
};

// ==================== EXPEDITION CRUD ====================

export const createExpedition = async (req: Request, res: Response) => {
  try {
    const { classroomId, name, description, mapImageUrl } = req.body;
    
    if (!classroomId || !name || !mapImageUrl) {
      return res.status(400).json({ error: 'classroomId, name y mapImageUrl son requeridos' });
    }
    
    const expedition = await expeditionService.create({
      classroomId,
      name,
      description,
      mapImageUrl,
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
    
    const expeditions = await expeditionService.getByClassroom(
      classroomId,
      status as any
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
    const progress = await expeditionService.getStudentProgress(expeditionId, studentProfileId);
    
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
    
    if (!studentProfileId || !files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'studentProfileId y files son requeridos' });
    }
    
    const submission = await expeditionService.createSubmission({
      expeditionId,
      pinId,
      studentProfileId,
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
    
    // Obtener expediciones publicadas
    const expeditions = await expeditionService.getByClassroom(classroomId, 'PUBLISHED');
    
    // Agregar progreso del estudiante a cada expedición
    const expeditionsWithProgress = await Promise.all(
      expeditions.map(async (expedition) => {
        const progress = await expeditionService.getStudentProgress(expedition.id, studentProfileId);
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
    
    const expedition = await expeditionService.getById(expeditionId);
    if (!expedition) {
      return res.status(404).json({ error: 'Expedición no encontrada' });
    }
    
    const progress = await expeditionService.getStudentProgress(expeditionId, studentProfileId);
    
    res.json({
      ...expedition,
      studentProgress: progress,
    });
  } catch (error) {
    console.error('Error getting student expedition detail:', error);
    res.status(500).json({ error: 'Error al obtener detalle de expedición' });
  }
};

// Completar un pin (estudiante avanza al siguiente)
export const completePin = async (req: Request, res: Response) => {
  try {
    const { pinId } = req.params;
    const { studentProfileId } = req.body;
    
    if (!studentProfileId) {
      return res.status(400).json({ error: 'studentProfileId es requerido' });
    }
    
    const progress = await expeditionService.completePin(pinId, studentProfileId);
    res.json(progress);
  } catch (error: any) {
    console.error('Error completing pin:', error);
    res.status(500).json({ error: error.message || 'Error al completar pin' });
  }
};
