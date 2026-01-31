import { Router } from 'express';
import { jiroExpeditionController, uploadJiroFile, handleJiroUpload } from '../controllers/jiroExpedition.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Aplicar autenticación a todas las rutas
router.use(authenticate);

// ==================== UPLOAD DE ARCHIVOS ====================
router.post('/upload', uploadJiroFile, handleJiroUpload);

// ==================== RUTAS DE PROFESOR ====================

// Crear expedición
router.post(
  '/classroom/:classroomId',
  authorize('TEACHER'),
  jiroExpeditionController.createExpedition
);

// Listar expediciones de una clase
router.get(
  '/classroom/:classroomId',
  authorize('TEACHER'),
  jiroExpeditionController.getExpeditionsByClassroom
);

// Obtener expedición por ID (profesor)
router.get(
  '/:expeditionId',
  authorize('TEACHER'),
  jiroExpeditionController.getExpeditionById
);

// Actualizar expedición
router.put(
  '/:expeditionId',
  authorize('TEACHER'),
  jiroExpeditionController.updateExpedition
);

// Eliminar expedición
router.delete(
  '/:expeditionId',
  authorize('TEACHER'),
  jiroExpeditionController.deleteExpedition
);

// ==================== ESTACIONES DE ENTREGA ====================

// Crear estación de entrega
router.post(
  '/:expeditionId/delivery-stations',
  authorize('TEACHER'),
  jiroExpeditionController.createDeliveryStation
);

// Actualizar estación de entrega
router.put(
  '/delivery-stations/:stationId',
  authorize('TEACHER'),
  jiroExpeditionController.updateDeliveryStation
);

// Eliminar estación de entrega
router.delete(
  '/delivery-stations/:stationId',
  authorize('TEACHER'),
  jiroExpeditionController.deleteDeliveryStation
);

// ==================== CONTROL DE EXPEDICIÓN ====================

// Abrir expedición
router.post(
  '/:expeditionId/open',
  authorize('TEACHER'),
  jiroExpeditionController.openExpedition
);

// Cerrar expedición
router.post(
  '/:expeditionId/close',
  authorize('TEACHER'),
  jiroExpeditionController.closeExpedition
);

// ==================== PROGRESO Y REVISIÓN ====================

// Ver progreso de la clase
router.get(
  '/:expeditionId/class-progress',
  authorize('TEACHER'),
  jiroExpeditionController.getClassProgress
);

// Ver entregas pendientes
router.get(
  '/:expeditionId/pending-deliveries',
  authorize('TEACHER'),
  jiroExpeditionController.getPendingDeliveries
);

// Revisar entrega
router.post(
  '/deliveries/:deliveryId/review',
  authorize('TEACHER'),
  jiroExpeditionController.reviewDelivery
);

// Ver respuestas de un estudiante
router.get(
  '/:expeditionId/answers/:studentProfileId',
  authorize('TEACHER'),
  jiroExpeditionController.getStudentAnswers
);

// Ver entregas de un estudiante
router.get(
  '/:expeditionId/deliveries/:studentProfileId',
  authorize('TEACHER'),
  jiroExpeditionController.getStudentDeliveries
);

// ==================== RUTAS DE ESTUDIANTE ====================

// Listar expediciones disponibles
router.get(
  '/student/:studentProfileId/available',
  authorize('STUDENT'),
  jiroExpeditionController.getAvailableExpeditions
);

// Ver mi progreso en una expedición
router.get(
  '/:expeditionId/progress/:studentProfileId',
  authorize('STUDENT'),
  jiroExpeditionController.getStudentProgress
);

// Iniciar expedición
router.post(
  '/:expeditionId/start/:studentProfileId',
  authorize('STUDENT'),
  jiroExpeditionController.startExpedition
);

// Responder pregunta
router.post(
  '/:expeditionId/answer/:studentProfileId',
  authorize('STUDENT'),
  jiroExpeditionController.answerQuestion
);

// Subir entrega
router.post(
  '/:expeditionId/submit-delivery/:studentProfileId',
  authorize('STUDENT'),
  jiroExpeditionController.submitDelivery
);

// Comprar energía
router.post(
  '/:expeditionId/buy-energy/:studentProfileId',
  authorize('STUDENT'),
  jiroExpeditionController.buyEnergy
);

// Ver estado de energía
router.get(
  '/:expeditionId/energy-status/:studentProfileId',
  authorize('STUDENT'),
  jiroExpeditionController.getEnergyStatus
);

// Finalizar examen por timeout
router.post(
  '/:expeditionId/timeout/:studentProfileId',
  authorize('STUDENT'),
  jiroExpeditionController.forceCompleteByTimeout
);

// Obtener respuestas de un estudiante (para profesor)
router.get(
  '/:expeditionId/answers/:studentProfileId',
  authorize('TEACHER'),
  jiroExpeditionController.getStudentAnswers
);

export default router;
