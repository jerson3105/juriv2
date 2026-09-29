import { Router } from 'express';
import { shopController } from '../controllers/shop.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { aiGuard } from '../middleware/security.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createUploadFilter, safeUploadFilename, verifyUploadedFile, IMAGE_MIMES } from '../utils/fileValidation.js';

const router = Router();

// Imágenes de artículos: fuera de la web pública, servidas por /api/uploads/shop-items (index.ts).
const shopImagesDir = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), 'shop-items');
if (!fs.existsSync(shopImagesDir)) {
  fs.mkdirSync(shopImagesDir, { recursive: true });
}
const uploadItemImage = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, shopImagesDir),
    filename: safeUploadFilename,
  }),
  fileFilter: createUploadFilter(IMAGE_MIMES, 'Solo se permiten imágenes (PNG, JPG, GIF, WEBP)'),
  limits: { fileSize: 2 * 1024 * 1024 },
}).single('image');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Subir imagen de artículo (solo profesor)
router.post('/upload-image', authorize('TEACHER'), (req, res, next) => {
  uploadItemImage(req, res, (error: unknown) => {
    if (error) {
      const message = (error as { code?: string }).code === 'LIMIT_FILE_SIZE'
        ? 'La imagen debe pesar menos de 2 MB'
        : (error as Error).message || 'No se pudo subir la imagen';
      return res.status(400).json({ message });
    }
    next();
  });
}, verifyUploadedFile, (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No se proporcionó imagen' });
  res.json({ imageUrl: `/api/uploads/shop-items/${req.file.filename}` });
});

// Dar un artículo a varios estudiantes y deshacer una entrega (profesor)
router.post('/teacher/give-bulk', authorize('TEACHER'), (req, res) => shopController.giveBulk(req, res));
router.delete('/teacher/purchases/:purchaseId', authorize('TEACHER'), (req, res) => shopController.undoGive(req, res));

// Inventario de la clase (profesor)
router.get('/classroom/:classroomId/inventory', authorize('TEACHER'), (req, res) => shopController.getInventory(req, res));

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
router.get('/classroom/:classroomId/items', authorize('TEACHER', 'STUDENT'), (req, res) => 
  shopController.getClassroomItems(req, res)
);

// ==================== RUTAS DE COMPRAS ====================

// Compra por estudiante
router.post('/student/:studentId/purchase', authorize('STUDENT'), (req, res) => 
  shopController.purchaseItem(req, res)
);

// Regalar item a otro estudiante
router.post('/student/:studentId/gift', authorize('STUDENT'), (req, res) => 
  shopController.giftItem(req, res)
);

// Compra por profesor para un estudiante
router.post('/teacher/purchase', authorize('TEACHER'), (req, res) => 
  shopController.teacherPurchase(req, res)
);

// ==================== RUTAS DE HISTORIAL ====================

// Historial de compras del estudiante
router.get('/student/:studentId/purchases', authorize('STUDENT'), (req, res) => 
  shopController.getStudentPurchases(req, res)
);

// Regalos recibidos
router.get('/student/:studentId/gifts/received', authorize('STUDENT'), (req, res) => 
  shopController.getGiftsReceived(req, res)
);

// Regalos enviados
router.get('/student/:studentId/gifts/sent', authorize('STUDENT'), (req, res) => 
  shopController.getGiftsSent(req, res)
);

// ==================== RUTAS DE USO DE ITEMS ====================

// Usar un item (estudiante)
router.post('/student/:studentId/use/:purchaseId', authorize('STUDENT'), (req, res) => 
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

// ==================== GENERACIÓN CON IA ====================

// Generar items con IA (solo profesor)
router.post('/generate-ai', authorize('TEACHER'), ...aiGuard, (req, res) => 
  shopController.generateWithAI(req, res)
);

export default router;
