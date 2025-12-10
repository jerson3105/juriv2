import { Request, Response } from 'express';
import { missionService } from '../services/mission.service.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Configurar multer para archivos de misiones (máximo 5MB)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'missions');
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

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Permitir documentos comunes
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/zip',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido'));
  }
};

export const uploadMissionFile = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
}).single('file');

// ==================== CRUD DE MISIONES ====================

export const createMission = async (req: Request, res: Response) => {
  try {
    const { classroomId } = req.params;
    const data = req.body;

    const mission = await missionService.createMission(classroomId, data);
    res.status(201).json(mission);
  } catch (error: any) {
    console.error('Error creating mission:', error);
    res.status(500).json({ error: error.message || 'Error al crear la misión' });
  }
};

export const updateMission = async (req: Request, res: Response) => {
  try {
    const { missionId } = req.params;
    const data = req.body;

    const mission = await missionService.updateMission(missionId, data);
    res.json(mission);
  } catch (error: any) {
    console.error('Error updating mission:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar la misión' });
  }
};

export const deleteMission = async (req: Request, res: Response) => {
  try {
    const { missionId } = req.params;
    await missionService.deleteMission(missionId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting mission:', error);
    res.status(500).json({ error: error.message || 'Error al eliminar la misión' });
  }
};

export const getMission = async (req: Request, res: Response) => {
  try {
    const { missionId } = req.params;
    const mission = await missionService.getMission(missionId);
    
    if (!mission) {
      return res.status(404).json({ error: 'Misión no encontrada' });
    }
    
    res.json(mission);
  } catch (error: any) {
    console.error('Error getting mission:', error);
    res.status(500).json({ error: error.message || 'Error al obtener la misión' });
  }
};

export const getClassroomMissions = async (req: Request, res: Response) => {
  try {
    const { classroomId } = req.params;
    const { type } = req.query;

    const missions = await missionService.getClassroomMissions(
      classroomId, 
      type as any
    );
    res.json(missions);
  } catch (error: any) {
    console.error('Error getting classroom missions:', error);
    res.status(500).json({ error: error.message || 'Error al obtener las misiones' });
  }
};

// ==================== ASIGNACIÓN ====================

export const assignMission = async (req: Request, res: Response) => {
  try {
    const { missionId, studentProfileIds, expiresAt } = req.body;

    const assignments = await missionService.assignMission({
      missionId,
      studentProfileIds,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.status(201).json(assignments);
  } catch (error: any) {
    console.error('Error assigning mission:', error);
    res.status(500).json({ error: error.message || 'Error al asignar la misión' });
  }
};

export const assignMissionToAll = async (req: Request, res: Response) => {
  try {
    const { classroomId, missionId } = req.params;
    const { expiresAt } = req.body;

    const count = await missionService.assignMissionToAll(
      classroomId,
      missionId,
      expiresAt ? new Date(expiresAt) : undefined
    );

    res.json({ assigned: count });
  } catch (error: any) {
    console.error('Error assigning mission to all:', error);
    res.status(500).json({ error: error.message || 'Error al asignar la misión' });
  }
};

export const getAssignedStudents = async (req: Request, res: Response) => {
  try {
    const { missionId } = req.params;
    const studentIds = await missionService.getAssignedStudentIds(missionId);
    res.json({ studentIds });
  } catch (error: any) {
    console.error('Error getting assigned students:', error);
    res.status(500).json({ error: error.message || 'Error al obtener estudiantes asignados' });
  }
};

export const getMissionAssignments = async (req: Request, res: Response) => {
  try {
    const { missionId } = req.params;
    const assignments = await missionService.getMissionAssignments(missionId);
    res.json(assignments);
  } catch (error: any) {
    console.error('Error getting mission assignments:', error);
    res.status(500).json({ error: error.message || 'Error al obtener asignaciones' });
  }
};

// ==================== MISIONES DEL ESTUDIANTE ====================

export const getStudentMissions = async (req: Request, res: Response) => {
  try {
    const { studentProfileId } = req.params;
    const { status } = req.query;

    const missions = await missionService.getStudentMissions(
      studentProfileId,
      status as any
    );
    res.json(missions);
  } catch (error: any) {
    console.error('Error getting student missions:', error);
    res.status(500).json({ error: error.message || 'Error al obtener las misiones' });
  }
};

export const getMyMissions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { classroomId } = req.params;

    // Obtener el perfil del estudiante en esta clase
    const { db } = await import('../db/index.js');
    const { studentProfiles } = await import('../db/schema.js');
    const { eq, and } = await import('drizzle-orm');

    const [profile] = await db.select().from(studentProfiles)
      .where(and(
        eq(studentProfiles.userId, userId),
        eq(studentProfiles.classroomId, classroomId)
      ));

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Obtener todas las misiones del estudiante (activas, completadas y reclamadas)
    const activeMissions = await missionService.getStudentMissions(profile.id, 'ACTIVE');
    const completedMissions = await missionService.getStudentMissions(profile.id, 'COMPLETED');
    const claimedMissions = await missionService.getStudentMissions(profile.id, 'CLAIMED');
    
    res.json([...activeMissions, ...completedMissions, ...claimedMissions]);
  } catch (error: any) {
    console.error('Error getting my missions:', error);
    res.status(500).json({ error: error.message || 'Error al obtener las misiones' });
  }
};

// ==================== PROGRESO Y RECOMPENSAS ====================

export const claimMissionReward = async (req: Request, res: Response) => {
  try {
    const { studentMissionId } = req.params;

    const rewards = await missionService.claimMissionReward(studentMissionId);
    res.json(rewards);
  } catch (error: any) {
    console.error('Error claiming mission reward:', error);
    res.status(400).json({ error: error.message || 'Error al reclamar la recompensa' });
  }
};

// ==================== RACHAS ====================

export const getStudentStreak = async (req: Request, res: Response) => {
  try {
    const { studentProfileId, classroomId } = req.params;

    const streak = await missionService.getStudentStreak(studentProfileId, classroomId);
    const milestones = missionService.getStreakMilestones();

    res.json({
      streak: streak || { currentStreak: 0, longestStreak: 0, claimedMilestones: [] },
      milestones,
    });
  } catch (error: any) {
    console.error('Error getting student streak:', error);
    res.status(500).json({ error: error.message || 'Error al obtener la racha' });
  }
};

export const getMyStreak = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { classroomId } = req.params;

    // Obtener el perfil del estudiante
    const { db } = await import('../db/index.js');
    const { studentProfiles } = await import('../db/schema.js');
    const { eq, and } = await import('drizzle-orm');

    const [profile] = await db.select().from(studentProfiles)
      .where(and(
        eq(studentProfiles.userId, userId),
        eq(studentProfiles.classroomId, classroomId)
      ));

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const streak = await missionService.getStudentStreak(profile.id, classroomId);
    const milestones = missionService.getStreakMilestones();

    res.json({
      streak: streak || { currentStreak: 0, longestStreak: 0, claimedMilestones: [] },
      milestones,
    });
  } catch (error: any) {
    console.error('Error getting my streak:', error);
    res.status(500).json({ error: error.message || 'Error al obtener la racha' });
  }
};

export const claimStreakReward = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { classroomId } = req.params;
    const { milestone } = req.body;

    // Obtener el perfil del estudiante
    const { db } = await import('../db/index.js');
    const { studentProfiles } = await import('../db/schema.js');
    const { eq, and } = await import('drizzle-orm');

    const [profile] = await db.select().from(studentProfiles)
      .where(and(
        eq(studentProfiles.userId, userId),
        eq(studentProfiles.classroomId, classroomId)
      ));

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const rewards = await missionService.claimStreakReward(profile.id, classroomId, milestone);
    res.json(rewards);
  } catch (error: any) {
    console.error('Error claiming streak reward:', error);
    res.status(400).json({ error: error.message || 'Error al reclamar la recompensa' });
  }
};

// ==================== ESTADÍSTICAS ====================

export const getMissionStats = async (req: Request, res: Response) => {
  try {
    const { classroomId } = req.params;

    const stats = await missionService.getMissionStats(classroomId);
    res.json(stats);
  } catch (error: any) {
    console.error('Error getting mission stats:', error);
    res.status(500).json({ error: error.message || 'Error al obtener estadísticas' });
  }
};

// ==================== UPLOAD DE ARCHIVOS ====================

export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const fileUrl = `/uploads/missions/${req.file.filename}`;
    
    res.json({
      url: fileUrl,
      name: req.file.originalname,
      size: req.file.size,
    });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message || 'Error al subir el archivo' });
  }
};
