import { Router } from 'express';
import { shopController } from '../controllers/shop.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ==================== RUTAS DE ITEMS (PROFESOR) ====================

// Crear item (solo profesor)
router.post('/items', authorize('TEACHER'), (req, res) => 
  shopController.createItem(req, res)
);

// Actualizar item (solo profesor)
router.put('/items/:id', authorize('TEACHER'), (req, res) => 
  shopController.updateItem(req, res)
);

// Eliminar item (solo profesor)
router.delete('/items/:id', authorize('TEACHER'), (req, res) => 
  shopController.deleteItem(req, res)
);

// Obtener items de una clase (profesor y estudiante)
router.get('/classroom/:classroomId/items', (req, res) => 
  shopController.getClassroomItems(req, res)
);

// ==================== RUTAS DE COMPRAS ====================

// Compra por estudiante
router.post('/student/:studentId/purchase', (req, res) => 
  shopController.purchaseItem(req, res)
);

// Regalar item a otro estudiante
router.post('/student/:studentId/gift', (req, res) => 
  shopController.giftItem(req, res)
);

// Compra por profesor para un estudiante
router.post('/teacher/purchase', authorize('TEACHER'), (req, res) => 
  shopController.teacherPurchase(req, res)
);

// ==================== RUTAS DE HISTORIAL ====================

// Historial de compras del estudiante
router.get('/student/:studentId/purchases', (req, res) => 
  shopController.getStudentPurchases(req, res)
);

// Regalos recibidos
router.get('/student/:studentId/gifts/received', (req, res) => 
  shopController.getGiftsReceived(req, res)
);

// Regalos enviados
router.get('/student/:studentId/gifts/sent', (req, res) => 
  shopController.getGiftsSent(req, res)
);

// ==================== RUTAS DE USO DE ITEMS ====================

// Usar un item (estudiante)
router.post('/student/:studentId/use/:purchaseId', (req, res) => 
  shopController.useItem(req, res)
);

// Obtener usos pendientes de una clase (profesor)
router.get('/classroom/:classroomId/usages/pending', authorize('TEACHER'), (req, res) => 
  shopController.getPendingUsages(req, res)
);

// Aprobar/rechazar uso de item (profesor)
router.put('/usages/:usageId/review', authorize('TEACHER'), (req, res) => 
  shopController.reviewUsage(req, res)
);

// ==================== RUTAS DE APROBACIÓN DE COMPRAS ====================

// Obtener compras pendientes de una clase (profesor)
router.get('/classroom/:classroomId/purchases/pending', authorize('TEACHER'), (req, res) => 
  shopController.getPendingPurchases(req, res)
);

// Aprobar compra (profesor)
router.put('/purchases/:purchaseId/approve', authorize('TEACHER'), (req, res) => 
  shopController.approvePurchase(req, res)
);

// Rechazar compra (profesor)
router.put('/purchases/:purchaseId/reject', authorize('TEACHER'), (req, res) => 
  shopController.rejectPurchase(req, res)
);

// ==================== RUTAS DE NOTIFICACIONES ====================

// Obtener notificaciones
router.get('/notifications', (req, res) => 
  shopController.getNotifications(req, res)
);

// Obtener conteo de no leídas
router.get('/notifications/unread-count', (req, res) => 
  shopController.getUnreadCount(req, res)
);

// Marcar notificación como leída
router.put('/notifications/:notificationId/read', (req, res) => 
  shopController.markNotificationRead(req, res)
);

// Marcar todas como leídas
router.put('/notifications/read-all', (req, res) => 
  shopController.markAllRead(req, res)
);

export default router;
