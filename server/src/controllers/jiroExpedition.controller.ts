import { Request, Response, NextFunction } from 'express';
import { jiroExpeditionService } from '../services/jiroExpedition.service.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Configurar multer para archivos de Jiro Expeditions (máximo 10MB)
const baseUploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const jiroStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(baseUploadDir, 'jiro-deliveries');
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

const jiroFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo PDF, imágenes, Word y Excel.'));
  }
};

export const uploadJiroFile = multer({
  storage: jiroStorage,
  fileFilter: jiroFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  },
}).single('file');

export const handleJiroUpload = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se recibió ningún archivo' });
    }

    const fileUrl = `/api/uploads/jiro-deliveries/${req.file.filename}`;
    res.json({ 
      success: true, 
      data: { 
        url: fileUrl, 
        filename: req.file.filename 
      } 
    });
  } catch (error) {
    console.error('Error uploading jiro file:', error);
    res.status(500).json({ success: false, message: 'Error al subir archivo' });
  }
};

export const jiroExpeditionController = {
  // ==================== EXPEDICIONES (PROFESOR) ====================

  async createExpedition(req: Request, res: Response, next: NextFunction) {
    try {
      const { classroomId } = req.params;
      const data = req.body;

      const expedition = await jiroExpeditionService.createExpedition({
        classroomId,
        ...data,
      });

      res.status(201).json({
        success: true,
        data: expedition,
      });
    } catch (error) {
      next(error);
    }
  },

  async getExpeditionsByClassroom(req: Request, res: Response, next: NextFunction) {
    try {
      const { classroomId } = req.params;
      const expeditions = await jiroExpeditionService.getExpeditionsByClassroom(classroomId);

      res.json({
        success: true,
        data: expeditions,
      });
    } catch (error) {
      next(error);
    }
  },

  async getExpeditionById(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId } = req.params;
      const expedition = await jiroExpeditionService.getExpeditionById(expeditionId);

      if (!expedition) {
        return res.status(404).json({
          success: false,
          message: 'Expedición no encontrada',
        });
      }

      res.json({
        success: true,
        data: expedition,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateExpedition(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId } = req.params;
      const data = req.body;

      const expedition = await jiroExpeditionService.updateExpedition(expeditionId, data);

      res.json({
        success: true,
        data: expedition,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteExpedition(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId } = req.params;
      await jiroExpeditionService.deleteExpedition(expeditionId);

      res.json({
        success: true,
        message: 'Expedición eliminada',
      });
    } catch (error) {
      next(error);
    }
  },

  // ==================== ESTACIONES DE ENTREGA ====================

  async createDeliveryStation(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId } = req.params;
      const data = req.body;

      const station = await jiroExpeditionService.createDeliveryStation({
        expeditionId,
        ...data,
      });

      res.status(201).json({
        success: true,
        data: station,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateDeliveryStation(req: Request, res: Response, next: NextFunction) {
    try {
      const { stationId } = req.params;
      const data = req.body;

      const station = await jiroExpeditionService.updateDeliveryStation(stationId, data);

      res.json({
        success: true,
        data: station,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteDeliveryStation(req: Request, res: Response, next: NextFunction) {
    try {
      const { stationId } = req.params;
      await jiroExpeditionService.deleteDeliveryStation(stationId);

      res.json({
        success: true,
        message: 'Estación eliminada',
      });
    } catch (error) {
      next(error);
    }
  },

  // ==================== CONTROL DE EXPEDICIÓN ====================

  async openExpedition(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId } = req.params;
      const expedition = await jiroExpeditionService.openExpedition(expeditionId);

      res.json({
        success: true,
        data: expedition,
      });
    } catch (error) {
      next(error);
    }
  },

  async closeExpedition(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId } = req.params;
      const expedition = await jiroExpeditionService.closeExpedition(expeditionId);

      res.json({
        success: true,
        data: expedition,
      });
    } catch (error) {
      next(error);
    }
  },

  // ==================== PROGRESO DE CLASE ====================

  async getClassProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId } = req.params;
      const progress = await jiroExpeditionService.getClassProgress(expeditionId);

      res.json({
        success: true,
        data: progress,
      });
    } catch (error) {
      next(error);
    }
  },

  // ==================== REVISIÓN DE ENTREGAS ====================

  async getPendingDeliveries(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId } = req.params;
      const deliveries = await jiroExpeditionService.getPendingDeliveries(expeditionId);

      res.json({
        success: true,
        data: deliveries,
      });
    } catch (error) {
      next(error);
    }
  },

  async reviewDelivery(req: Request, res: Response, next: NextFunction) {
    try {
      const { deliveryId } = req.params;
      const { status, feedback } = req.body;
      const reviewerId = (req as any).user.id;

      const delivery = await jiroExpeditionService.reviewDelivery({
        deliveryId,
        status,
        feedback,
        reviewerId,
      });

      res.json({
        success: true,
        data: delivery,
      });
    } catch (error) {
      next(error);
    }
  },

  // ==================== ESTUDIANTE ====================

  async getAvailableExpeditions(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentProfileId } = req.params;

      if (!studentProfileId) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere studentProfileId',
        });
      }

      const expeditions = await jiroExpeditionService.getAvailableExpeditions(studentProfileId);

      res.json({
        success: true,
        data: expeditions,
      });
    } catch (error) {
      next(error);
    }
  },

  async getStudentProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId, studentProfileId } = req.params;

      if (!studentProfileId) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere studentProfileId',
        });
      }

      const progress = await jiroExpeditionService.getStudentExpeditionProgress(
        expeditionId,
        studentProfileId
      );

      res.json({
        success: true,
        data: progress,
      });
    } catch (error) {
      next(error);
    }
  },

  async startExpedition(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId, studentProfileId } = req.params;

      if (!studentProfileId) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere studentProfileId',
        });
      }

      const progress = await jiroExpeditionService.startExpedition(
        expeditionId,
        studentProfileId
      );

      res.json({
        success: true,
        data: progress,
      });
    } catch (error) {
      next(error);
    }
  },

  async answerQuestion(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId, studentProfileId } = req.params;
      const { questionId, answer } = req.body;

      if (!studentProfileId) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere studentProfileId',
        });
      }

      // Obtener studentExpeditionId
      const progress = await jiroExpeditionService.getStudentExpeditionProgress(
        expeditionId,
        studentProfileId
      );

      if (!progress.studentProgress) {
        return res.status(400).json({
          success: false,
          message: 'No has iniciado esta expedición',
        });
      }

      const result = await jiroExpeditionService.answerQuestion({
        studentExpeditionId: progress.studentProgress.id,
        questionId,
        answer,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async submitDelivery(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId, studentProfileId } = req.params;
      const { deliveryStationId, fileUrl, fileName, fileType, fileSizeBytes } = req.body;

      if (!studentProfileId) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere studentProfileId',
        });
      }

      // Obtener studentExpeditionId
      const progress = await jiroExpeditionService.getStudentExpeditionProgress(
        expeditionId,
        studentProfileId
      );

      if (!progress.studentProgress) {
        return res.status(400).json({
          success: false,
          message: 'No has iniciado esta expedición',
        });
      }

      const result = await jiroExpeditionService.submitDelivery({
        studentExpeditionId: progress.studentProgress.id,
        deliveryStationId,
        fileUrl,
        fileName,
        fileType,
        fileSizeBytes,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async buyEnergy(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId, studentProfileId } = req.params;

      if (!studentProfileId) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere studentProfileId',
        });
      }

      const result = await jiroExpeditionService.buyEnergy(expeditionId, studentProfileId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async getEnergyStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId, studentProfileId } = req.params;

      if (!studentProfileId) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere studentProfileId',
        });
      }

      const progress = await jiroExpeditionService.getStudentExpeditionProgress(
        expeditionId,
        studentProfileId
      );

      res.json({
        success: true,
        data: {
          currentEnergy: progress.studentProgress?.currentEnergy ?? progress.expedition.initialEnergy,
          maxEnergy: progress.expedition.initialEnergy,
          energyPurchasePrice: progress.expedition.energyPurchasePrice,
          energyRegenMinutes: progress.expedition.energyRegenMinutes,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async forceCompleteByTimeout(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId, studentProfileId } = req.params;

      if (!studentProfileId) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere studentProfileId',
        });
      }

      const result = await jiroExpeditionService.forceCompleteByTimeout(
        expeditionId,
        studentProfileId
      );

      res.json({
        success: result.success,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // Obtener respuestas de un estudiante (para profesor)
  async getStudentAnswers(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId, studentProfileId } = req.params;

      const answers = await jiroExpeditionService.getStudentAnswers(
        expeditionId,
        studentProfileId
      );

      res.json({
        success: true,
        data: answers,
      });
    } catch (error) {
      next(error);
    }
  },

  // Obtener entregas de un estudiante (para profesor)
  async getStudentDeliveries(req: Request, res: Response, next: NextFunction) {
    try {
      const { expeditionId, studentProfileId } = req.params;

      const deliveries = await jiroExpeditionService.getStudentDeliveries(
        expeditionId,
        studentProfileId
      );

      res.json({
        success: true,
        data: deliveries,
      });
    } catch (error) {
      next(error);
    }
  },
};
