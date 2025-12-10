import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
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

export default router;
