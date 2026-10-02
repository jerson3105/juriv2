import { Router } from 'express';
import { avatarController } from '../controllers/avatar.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ==================== ITEMS GLOBALES ====================

// Obtener todos los items de avatar (el catálogo lo crea el admin en /admin/avatar-items)
router.get('/items', avatarController.getAllItems);

// ==================== TIENDA DE CLASE ====================

// Lo que ve un alumno en la tienda de avatar de una clase (catálogo automático, precios de la clase)
router.get('/classroom/:classroomId/shop', avatarController.getClassroomShopItems);

// Docente: catálogo de la clase y sus excepciones (aplicables a varias de sus clases con applyTo)
router.get('/classroom/:classroomId/catalog', authorize('TEACHER'), avatarController.getTeacherCatalog);
router.put('/classroom/:classroomId/settings', authorize('TEACHER'), avatarController.updateSettings);
router.put('/classroom/:classroomId/collections/:collectionId', authorize('TEACHER'), avatarController.setCollection);
router.put('/classroom/:classroomId/items/:avatarItemId', authorize('TEACHER'), avatarController.setItem);

// ==================== ALUMNO ====================

// «Mi avatar» en una carga (solo el dueño)
router.get('/student/:studentProfileId/view', authorize('STUDENT'), avatarController.getStudentView);

// Comprar un item (y, si se pide, ponérselo)
router.post('/purchase', authorize('STUDENT'), avatarController.purchaseItem);

// La prenda de regalo (una común, una vez por perfil)
router.post('/gift', authorize('STUDENT'), avatarController.claimGift);

// Meta de ahorro con una prenda (la única meta del alumno: reemplaza a la de premios)
router.put('/student/:studentProfileId/goal', authorize('STUDENT'), avatarController.setGoal);

// Obtener compras de un estudiante
router.get('/student/:studentProfileId/purchases', avatarController.getStudentPurchases);

// Cambiar de cuerpo (el alumno dueño o el docente de su clase)
router.put('/student/:studentProfileId/body', authorize('STUDENT', 'TEACHER'), avatarController.setBody);

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
