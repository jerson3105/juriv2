import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { badgeService, type CreateBadgeDto } from '../services/badge.service.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Configurar directorio de uploads para insignias
const BADGES_DIR = path.join(process.cwd(), 'public', 'badges');
if (!fs.existsSync(BADGES_DIR)) {
  fs.mkdirSync(BADGES_DIR, { recursive: true });
}

// Configurar multer para subida de imágenes de insignias
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, BADGES_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `badge-${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (PNG, JPG, GIF, WEBP)'));
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max
  }
});

// ═══════════════════════════════════════════════════════════
// Rutas de Insignias (Profesor)
// ═══════════════════════════════════════════════════════════

// Estadísticas de insignias de una clase (DEBE IR ANTES de /classroom/:classroomId)
router.get('/classroom/:classroomId/stats', authenticate, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const stats = await badgeService.getClassroomBadgeStats(classroomId);
    res.json(stats);
  } catch (error: any) {
    console.error('Error getting badge stats:', error);
    res.status(500).json({ message: error.message });
  }
});

// Obtener insignias de una clase (sistema + personalizadas)
router.get('/classroom/:classroomId', authenticate, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const badges = await badgeService.getClassroomBadges(classroomId);
    res.json(badges);
  } catch (error: any) {
    console.error('Error getting classroom badges:', error);
    res.status(500).json({ message: error.message });
  }
});

// Subir imagen de insignia
router.post('/upload-image', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se proporcionó imagen' });
    }
    
    const imageUrl = `/badges/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (error: any) {
    console.error('Error uploading badge image:', error);
    res.status(500).json({ message: error.message });
  }
});

// Crear insignia personalizada
router.post('/classroom/:classroomId', authenticate, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = (req as any).user.id;
    
    const data: CreateBadgeDto = {
      classroomId,
      name: req.body.name,
      description: req.body.description,
      icon: req.body.icon,
      customImage: req.body.customImage,
      category: req.body.category,
      rarity: req.body.rarity,
      assignmentMode: req.body.assignmentMode,
      unlockCondition: req.body.unlockCondition,
      rewardXp: req.body.rewardXp,
      rewardGp: req.body.rewardGp,
      isSecret: req.body.isSecret,
      competencyId: req.body.competencyId,
    };
    
    const badge = await badgeService.createBadge(data, userId);
    res.status(201).json(badge);
  } catch (error: any) {
    console.error('Error creating badge:', error);
    res.status(500).json({ message: error.message });
  }
});

// Actualizar insignia
router.put('/:badgeId', authenticate, async (req, res) => {
  try {
    const { badgeId } = req.params;
    await badgeService.updateBadge(badgeId, req.body);
    res.json({ message: 'Insignia actualizada' });
  } catch (error: any) {
    console.error('Error updating badge:', error);
    res.status(500).json({ message: error.message });
  }
});

// Eliminar insignia
router.delete('/:badgeId', authenticate, async (req, res) => {
  try {
    const { badgeId } = req.params;
    await badgeService.deleteBadge(badgeId);
    res.json({ message: 'Insignia eliminada' });
  } catch (error: any) {
    console.error('Error deleting badge:', error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// Rutas de Insignias de Estudiantes
// ═══════════════════════════════════════════════════════════

// Obtener insignias de un estudiante
router.get('/student/:studentProfileId', authenticate, async (req, res) => {
  try {
    const { studentProfileId } = req.params;
    const badges = await badgeService.getStudentBadges(studentProfileId);
    res.json(badges);
  } catch (error: any) {
    console.error('Error getting student badges:', error);
    res.status(500).json({ message: error.message });
  }
});

// Obtener insignias mostradas en perfil
router.get('/student/:studentProfileId/displayed', authenticate, async (req, res) => {
  try {
    const { studentProfileId } = req.params;
    const badges = await badgeService.getDisplayedBadges(studentProfileId);
    res.json(badges);
  } catch (error: any) {
    console.error('Error getting displayed badges:', error);
    res.status(500).json({ message: error.message });
  }
});

// Actualizar insignias mostradas
router.put('/student/:studentProfileId/displayed', authenticate, async (req, res) => {
  try {
    const { studentProfileId } = req.params;
    const { badgeIds } = req.body;
    await badgeService.setDisplayedBadges(studentProfileId, badgeIds);
    res.json({ message: 'Insignias actualizadas' });
  } catch (error: any) {
    console.error('Error setting displayed badges:', error);
    res.status(500).json({ message: error.message });
  }
});

// Obtener progreso hacia insignias
router.get('/student/:studentProfileId/progress/:classroomId', authenticate, async (req, res) => {
  try {
    const { studentProfileId, classroomId } = req.params;
    const progress = await badgeService.getStudentProgress(studentProfileId, classroomId);
    res.json(progress);
  } catch (error: any) {
    console.error('Error getting badge progress:', error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// Otorgar/Revocar Insignias
// ═══════════════════════════════════════════════════════════

// Otorgar insignia manualmente (profesor)
router.post('/award', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { studentProfileId, badgeId, reason } = req.body;
    
    const awarded = await badgeService.awardBadgeManually(
      studentProfileId,
      badgeId,
      userId,
      reason
    );
    
    res.status(201).json(awarded);
  } catch (error: any) {
    console.error('Error awarding badge:', error);
    res.status(400).json({ message: error.message });
  }
});

// Revocar insignia (profesor)
router.delete('/revoke/:studentProfileId/:badgeId', authenticate, async (req, res) => {
  try {
    const { studentProfileId, badgeId } = req.params;
    await badgeService.revokeBadge(studentProfileId, badgeId);
    res.json({ message: 'Insignia revocada' });
  } catch (error: any) {
    console.error('Error revoking badge:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
