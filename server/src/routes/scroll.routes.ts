import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createScroll,
  getApprovedScrolls,
  getPendingScrolls,
  approveScroll,
  rejectScroll,
  toggleReaction,
  deleteScroll,
  getStudentScrolls,
  getScrollStats,
  toggleScrollsOpen,
  updateScrollsConfig,
} from '../controllers/scroll.controller.js';

const router = Router();

// ==================== RUTAS PÚBLICAS (requieren autenticación) ====================

// Obtener pergaminos aprobados del mural
router.get('/classroom/:classroomId', authenticate, getApprovedScrolls);

// Crear un nuevo pergamino (estudiante)
router.post('/classroom/:classroomId', authenticate, createScroll);

// Agregar/quitar reacción a un pergamino
router.post('/:scrollId/reaction', authenticate, toggleReaction);

// Obtener pergaminos enviados por un estudiante
router.get('/student/:studentProfileId', authenticate, getStudentScrolls);

// ==================== RUTAS DEL PROFESOR ====================

// Obtener pergaminos pendientes de moderación
router.get('/classroom/:classroomId/pending', authenticate, authorize('TEACHER', 'ADMIN'), getPendingScrolls);

// Aprobar un pergamino
router.post('/:scrollId/approve', authenticate, authorize('TEACHER', 'ADMIN'), approveScroll);

// Rechazar un pergamino
router.post('/:scrollId/reject', authenticate, authorize('TEACHER', 'ADMIN'), rejectScroll);

// Eliminar un pergamino
router.delete('/:scrollId', authenticate, authorize('TEACHER', 'ADMIN'), deleteScroll);

// Obtener estadísticas del mural
router.get('/classroom/:classroomId/stats', authenticate, authorize('TEACHER', 'ADMIN'), getScrollStats);

// Abrir/cerrar el mural
router.post('/classroom/:classroomId/toggle', authenticate, authorize('TEACHER', 'ADMIN'), toggleScrollsOpen);

// Actualizar configuración del mural
router.put('/classroom/:classroomId/config', authenticate, authorize('TEACHER', 'ADMIN'), updateScrollsConfig);

export default router;
