import { Router } from 'express';
import { avatarController } from '../controllers/avatar.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ==================== ITEMS GLOBALES (ADMIN/TEACHER) ====================

// Obtener todos los items de avatar (el catálogo lo crea el admin en /admin/avatar-items)
router.get('/items', avatarController.getAllItems);

// ==================== TIENDA DE CLASE ====================

// Obtener items de la tienda de una clase
router.get('/classroom/:classroomId/shop', avatarController.getClassroomShopItems);

// Añadir item a la tienda de una clase (solo docente)
router.post('/classroom/:classroomId/shop', authorize('TEACHER'), avatarController.addToClassroomShop);

// Remover item de la tienda de una clase (solo docente)
router.delete('/classroom/:classroomId/shop/:avatarItemId', authorize('TEACHER'), avatarController.removeFromClassroomShop);

// Remover item de la tienda por ID del shop item (solo docente)
router.delete('/classroom-shop/:shopItemId', authorize('TEACHER'), avatarController.removeShopItemById);

// Actualizar precio de un item en la tienda (solo docente)
router.patch('/classroom-shop/:shopItemId', authorize('TEACHER'), avatarController.updateShopItemPrice);

// ==================== COMPRAS DE ESTUDIANTES ====================

// Comprar un item
router.post('/purchase', authorize('STUDENT'), avatarController.purchaseItem);

// Obtener compras de un estudiante
router.get('/student/:studentProfileId/purchases', avatarController.getStudentPurchases);

// ==================== EQUIPAR ITEMS ====================

// Equipar un item
router.post('/equip', authorize('STUDENT'), avatarController.equipItem);

// Desequipar un item
router.post('/unequip', authorize('STUDENT'), avatarController.unequipItem);

// Obtener items equipados de un estudiante
router.get('/student/:studentProfileId/equipped', avatarController.getEquippedItems);

// Items equipados de varios alumnos en una sola petición (listas de mini-avatares)
router.post('/equipped/batch', avatarController.getEquippedItemsBatch);

// Obtener datos completos del avatar de un estudiante
router.get('/student/:studentProfileId/avatar', avatarController.getStudentAvatarData);

export default router;
