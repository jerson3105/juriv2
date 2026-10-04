import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { expeditionUploadLimiter } from '../middleware/security.js';
import * as expeditionController from '../controllers/expedition.controller.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Las lecturas son del docente de la clase, de sus alumnos o del admin; cada controlador revisa además la
// clase. Antes solo pedían sesión: una familia recién registrada leía expediciones y progreso de cualquiera.
const readers = authorize('TEACHER', 'STUDENT', 'ADMIN');

// ==================== EXPEDITION CRUD (TEACHER) ====================

// Crear expedición
router.post('/', authorize('TEACHER'), expeditionController.createExpedition);

// Obtener expedición por ID
router.get('/:id', readers, expeditionController.getExpedition);

// Obtener expediciones de un classroom
router.get('/classroom/:classroomId', readers, expeditionController.getClassroomExpeditions);

// Obtener estadísticas de expediciones de un classroom
router.get('/classroom/:classroomId/stats', authorize('TEACHER'), expeditionController.getClassroomStats);

// Actualizar expedición
router.put('/:id', authorize('TEACHER'), expeditionController.updateExpedition);

// Publicar expedición
router.post('/:id/publish', authorize('TEACHER'), expeditionController.publishExpedition);

// Archivar expedición
router.post('/:id/archive', authorize('TEACHER'), expeditionController.archiveExpedition);

// Eliminar expedición
router.delete('/:id', authorize('TEACHER'), expeditionController.deleteExpedition);

// ==================== PINS ====================

// Crear pin
router.post('/:expeditionId/pins', authorize('TEACHER'), expeditionController.createPin);

// Obtener pin
router.get('/pins/:pinId', readers, expeditionController.getPin);

// Actualizar pin
router.put('/pins/:pinId', authorize('TEACHER'), expeditionController.updatePin);

// Eliminar pin
router.delete('/pins/:pinId', authorize('TEACHER'), expeditionController.deletePin);

// ==================== CONNECTIONS ====================

// Crear conexión
router.post('/:expeditionId/connections', authorize('TEACHER'), expeditionController.createConnection);

// Actualizar conexión
router.put('/connections/:connectionId', authorize('TEACHER'), expeditionController.updateConnection);

// Eliminar conexión
router.delete('/connections/:connectionId', authorize('TEACHER'), expeditionController.deleteConnection);

// ==================== PROGRESS (TEACHER) ====================

// Obtener progreso de todos los estudiantes en un pin
router.get('/pins/:pinId/progress', authorize('TEACHER'), expeditionController.getPinProgress);

// Establecer decisión del profesor para un estudiante
router.post('/pins/:pinId/decision', authorize('TEACHER'), expeditionController.setTeacherDecision);

// Establecer decisiones en bulk
router.post('/pins/:pinId/decisions', authorize('TEACHER'), expeditionController.setTeacherDecisionBulk);

// Obtener entregas de un pin
router.get('/pins/:pinId/submissions', authorize('TEACHER'), expeditionController.getPinSubmissions);

// ==================== STUDENT ROUTES ====================

// Obtener expediciones del estudiante en un classroom
router.get('/student/:classroomId/:studentProfileId', readers, expeditionController.getStudentExpeditions);

// Obtener detalle de expedición para estudiante
router.get('/student/:expeditionId/detail/:studentProfileId', readers, expeditionController.getStudentExpeditionDetail);

// Obtener progreso del estudiante
router.get('/:expeditionId/progress/:studentProfileId', readers, expeditionController.getStudentProgress);

// Crear entrega de tarea
router.post('/:expeditionId/pins/:pinId/submit', authorize('STUDENT'), expeditionController.createSubmission);

// Completar un pin (estudiante avanza al siguiente)
router.post('/pins/:pinId/complete', authorize('STUDENT'), expeditionController.completePin);

// ==================== UPLOAD ====================

// Subir archivo (recurso del docente o entrega del alumno; máximo 5MB)
router.post('/upload', authorize('TEACHER', 'STUDENT'), expeditionUploadLimiter, expeditionController.uploadExpeditionFile, expeditionController.handleExpeditionUpload);

export default router;
