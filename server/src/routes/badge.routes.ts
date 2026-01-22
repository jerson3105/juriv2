import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { badgeService, type CreateBadgeDto } from '../services/badge.service.js';
import { behaviorService } from '../services/behavior.service.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from '@google/genai';

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

// ═══════════════════════════════════════════════════════════
// Generación con IA
// ═══════════════════════════════════════════════════════════

router.post('/generate-ai', authenticate, async (req, res) => {
  try {
    const { description, level, count = 8, assignmentMode = 'MANUAL', rarities = ['COMMON', 'RARE', 'EPIC'], includeSecret = false, classroomId, competencies } = req.body;

    if (!description || !level) {
      return res.status(400).json({ message: 'Se requiere descripción y nivel educativo' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'API key de Gemini no configurada' });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Obtener comportamientos del aula si se proporciona classroomId
    let behaviorsContext = '';
    let behaviorsForConditions = '';
    
    if (classroomId && (assignmentMode === 'AUTOMATIC' || assignmentMode === 'BOTH')) {
      const behaviors = await behaviorService.getByClassroom(classroomId);
      
      if (behaviors.length > 0) {
        const positiveBehaviors = behaviors.filter(b => b.isPositive);
        const negativeBehaviors = behaviors.filter(b => !b.isPositive);
        
        behaviorsContext = `
COMPORTAMIENTOS DISPONIBLES EN EL AULA:
Positivos: ${positiveBehaviors.map(b => `"${b.name}" (id: ${b.id})`).join(', ') || 'Ninguno'}
Negativos: ${negativeBehaviors.map(b => `"${b.name}" (id: ${b.id})`).join(', ') || 'Ninguno'}`;

        behaviorsForConditions = `
   Para BEHAVIOR_COUNT usar:
   { "type": "BEHAVIOR_COUNT", "behaviorId": "id-del-comportamiento", "count": número }
   
   Para BEHAVIOR_CATEGORY usar:
   { "type": "BEHAVIOR_CATEGORY", "category": "positive"|"negative", "count": número }`;
      }
    }

    // Configurar competencias si existen
    let competenciesInstruction = '';
    let competencyJsonField = '';
    if (competencies && competencies.length > 0) {
      const competencyList = competencies.map((c: { id: string; name: string }) => `- ID: "${c.id}" → ${c.name}`).join('\n');
      competenciesInstruction = `
COMPETENCIAS DISPONIBLES:
${competencyList}

IMPORTANTE: Asigna a cada insignia la competencia más apropiada usando su ID exacto.
Si una insignia no encaja claramente con ninguna competencia, usa null.`;
      competencyJsonField = ',\n    "competencyId": "id-de-la-competencia-o-null"';
    }

    const raritiesStr = rarities.join(', ');
    const assignmentModeDesc = assignmentMode === 'MANUAL' 
      ? 'MANUAL (el profesor otorga manualmente)' 
      : assignmentMode === 'AUTOMATIC' 
        ? 'AUTOMATIC (se desbloquea automáticamente al cumplir condición)' 
        : 'BOTH (ambos modos)';

    const prompt = `Eres un experto en gamificación educativa. Genera ${count} insignias para una clase de nivel ${level}.

CONTEXTO DEL PROFESOR:
"${description}"
${behaviorsContext}
${competenciesInstruction}

CONFIGURACIÓN:
- Modo de asignación: ${assignmentModeDesc}
- Rarezas a incluir: ${raritiesStr}
- ${includeSecret ? 'Incluir algunas insignias secretas (isSecret: true)' : 'No incluir insignias secretas'}

Responde SOLO con un array JSON válido, sin texto adicional ni bloques de código:

[
  {
    "name": "Nombre corto y atractivo (máx 25 chars)",
    "description": "Descripción del logro que reconoce (máx 80 chars)",
    "icon": "emoji",
    "rarity": "COMMON|RARE|EPIC|LEGENDARY",
    "assignmentMode": "${assignmentMode}",
    "unlockCondition": null,
    "rewardXp": número,
    "rewardGp": número,
    "isSecret": boolean${competencyJsonField}
  }
]

REGLAS IMPORTANTES:
1. Iconos permitidos: 🏆⭐🎖️🥇🥈🥉💎👑🎯🔥💪📚✨🌟🎓🏅🦁🐉🎨🔬🎪🎭🚀🌈💡🎵🎮🏰
2. Distribución de rarezas según ${raritiesStr}:
   - COMMON: logros básicos, rewardXp: 10-20, rewardGp: 5-10
   - RARE: logros moderados, rewardXp: 25-40, rewardGp: 15-25
   - EPIC: logros difíciles, rewardXp: 50-75, rewardGp: 30-45
   - LEGENDARY: logros excepcionales, rewardXp: 100-150, rewardGp: 50-75
3. Si assignmentMode es AUTOMATIC o BOTH, incluir unlockCondition con una de estas estructuras:
   { "type": "XP_TOTAL", "value": número }
   { "type": "LEVEL", "value": número }
   { "type": "ANY_BEHAVIOR", "count": número }${behaviorsForConditions}
4. Nombres creativos, motivadores y apropiados para el nivel educativo
5. Descripciones claras de qué logro reconoce cada insignia
6. Balancear la cantidad entre las rarezas seleccionadas
7. Si hay comportamientos disponibles, PRIORIZA usar BEHAVIOR_COUNT con los IDs reales para las condiciones automáticas
${competencies && competencies.length > 0 ? '8. Asigna competencyId usando los IDs exactos proporcionados (o null si no aplica)' : ''}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text?.trim() || '';
    
    // Limpiar respuesta
    let jsonText = text;
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    let badges;
    try {
      badges = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Error parsing AI response:', jsonText);
      return res.status(500).json({ message: 'Error al procesar respuesta de IA' });
    }

    if (!Array.isArray(badges)) {
      return res.status(500).json({ message: 'Respuesta de IA inválida' });
    }

    res.json({
      success: true,
      data: {
        badges,
        prompt,
      },
    });
  } catch (error: any) {
    console.error('Error generating badges with AI:', error);
    res.status(500).json({ message: error.message || 'Error al generar insignias' });
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
