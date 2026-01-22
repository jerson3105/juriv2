import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { GoogleGenAI } from '@google/genai';
import {
  createMission,
  updateMission,
  deleteMission,
  getMission,
  getClassroomMissions,
  assignMission,
  assignMissionToAll,
  getAssignedStudents,
  getMissionAssignments,
  getStudentMissions,
  getMyMissions,
  claimMissionReward,
  updateMissionProgressManually,
  getStudentStreak,
  getMyStreak,
  claimStreakReward,
  getMissionStats,
  uploadFile,
  uploadMissionFile,
} from '../controllers/mission.controller.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ==================== CRUD DE MISIONES (Profesor) ====================

// Obtener misiones de una clase
router.get('/classroom/:classroomId', getClassroomMissions);

// Crear misión
router.post('/classroom/:classroomId', createMission);

// Obtener una misión específica
router.get('/:missionId', getMission);

// Actualizar misión
router.put('/:missionId', updateMission);

// Eliminar misión
router.delete('/:missionId', deleteMission);

// ==================== ASIGNACIÓN (Profesor) ====================

// Asignar misión a estudiantes específicos
router.post('/assign', assignMission);

// Asignar misión a todos los estudiantes de una clase
router.post('/classroom/:classroomId/assign/:missionId', assignMissionToAll);

// Obtener estudiantes asignados a una misión (solo IDs)
router.get('/assigned/:missionId', getAssignedStudents);

// Obtener detalles de asignaciones de una misión (con progreso y estado)
router.get('/assignments/:missionId', getMissionAssignments);

// ==================== MISIONES DEL ESTUDIANTE ====================

// Obtener mis misiones (estudiante autenticado)
router.get('/my/:classroomId', getMyMissions);

// Obtener misiones de un estudiante específico (profesor)
router.get('/student/:studentProfileId', getStudentMissions);

// Reclamar recompensa de misión completada
router.post('/claim/:studentMissionId', claimMissionReward);

// Actualizar progreso manualmente (para misiones CUSTOM)
router.put('/progress/:studentMissionId', updateMissionProgressManually);

// ==================== RACHAS ====================

// Obtener mi racha (estudiante autenticado)
router.get('/streak/my/:classroomId', getMyStreak);

// Obtener racha de un estudiante (profesor)
router.get('/streak/:studentProfileId/:classroomId', getStudentStreak);

// Reclamar recompensa de racha
router.post('/streak/claim/:classroomId', claimStreakReward);

// ==================== ESTADÍSTICAS ====================

// Obtener estadísticas de misiones de una clase
router.get('/stats/:classroomId', getMissionStats);

// ==================== UPLOAD ====================

// Subir archivo adjunto (máximo 5MB)
router.post('/upload', uploadMissionFile, uploadFile);

// ==================== GENERACIÓN CON IA ====================

router.post('/generate-ai', authenticate, async (req, res) => {
  try {
    const { 
      description, 
      level, 
      count = 6, 
      types = ['DAILY', 'WEEKLY', 'SPECIAL'],
      categories = ['PARTICIPATION', 'PROGRESS', 'CUSTOM']
    } = req.body;

    if (!description || !level) {
      return res.status(400).json({ message: 'Se requiere descripción y nivel educativo' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'API key de Gemini no configurada' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const typesStr = types.join(', ');
    const categoriesStr = categories.join(', ');

    const prompt = `Eres un experto en gamificación educativa. Genera ${count} misiones para una clase de nivel ${level}.

CONTEXTO DEL PROFESOR:
"${description}"

CONFIGURACIÓN:
- Tipos de misión: ${typesStr}
- Categorías: ${categoriesStr}

Responde SOLO con un array JSON válido, sin texto adicional ni bloques de código:

[
  {
    "name": "Nombre motivador de la misión (máx 30 chars)",
    "description": "Descripción clara del objetivo (máx 100 chars)",
    "icon": "emoji",
    "type": "DAILY|WEEKLY|SPECIAL",
    "category": "PARTICIPATION|PROGRESS|SOCIAL|CUSTOM",
    "objectiveType": "CUSTOM",
    "objectiveTarget": número,
    "rewardXp": número,
    "rewardGp": número,
    "isRepeatable": boolean
  }
]

REGLAS IMPORTANTES:
1. Iconos permitidos: 🎯⚔️📚🏆⭐💎🔥🌟🎮🎲🎁💰🛒👥🤝📈🏅🎖️🌈✨💪🧠📝🎓🚀🎨🔬🎪🎭
2. Distribución de tipos según ${typesStr}:
   - DAILY: misiones cortas para un día, rewardXp: 10-25, rewardGp: 5-15
   - WEEKLY: misiones de una semana, rewardXp: 30-60, rewardGp: 20-35
   - SPECIAL: misiones únicas/eventos, rewardXp: 50-100, rewardGp: 30-50
3. Categorías disponibles: ${categoriesStr}
   - PARTICIPATION: asistencia, participar en clase
   - PROGRESS: mejorar notas, subir de nivel, ganar XP
   - SOCIAL: ayudar compañeros, trabajo en equipo
   - CUSTOM: personalizado según contexto del profesor
4. objectiveTarget: número que representa la meta (ej: 3 tareas, 5 participaciones)
5. isRepeatable: true para misiones diarias/semanales que se pueden repetir
6. Nombres creativos y motivadores apropiados para el nivel educativo
7. Descripciones claras que expliquen qué debe hacer el estudiante
8. Balancear la cantidad entre los tipos seleccionados`;

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

    const missions = JSON.parse(jsonText);

    res.json({
      success: true,
      data: {
        missions,
        prompt,
      },
    });
  } catch (error: any) {
    console.error('Error generating missions with AI:', error);
    res.status(500).json({ 
      message: error.message || 'Error al generar misiones con IA' 
    });
  }
});

export default router;
