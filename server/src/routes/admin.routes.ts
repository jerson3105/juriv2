import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { adminController } from '../controllers/admin.controller.js';
import { adminAvatarItemsController as avatarItems, uploadAvatarLayer } from '../controllers/adminAvatarItems.controller.js';

const router = Router();

// Todas las rutas requieren autenticación y rol ADMIN
router.use(authenticate);
router.use(authorize('ADMIN'));

// ==================== INICIO ====================
// Pendientes y cifras del panel (también los contadores del menú).
router.get('/overview', adminController.getOverview);

// ==================== GESTIÓN DE USUARIOS ====================
router.get('/users', adminController.getUsers);
router.post('/users/teacher', adminController.createTeacher);
router.patch('/users/:userId/role', adminController.updateUserRole);
router.patch('/users/:userId/status', adminController.updateUserStatus);

// Verificación de docentes y dominios institucionales
router.get('/teacher-verifications', adminController.listTeacherVerifications);
router.post('/teacher-verifications/:userId', adminController.reviewTeacherVerification);
router.get('/verified-domains', adminController.listVerifiedDomains);
router.get('/verified-domains/preview', adminController.previewVerifiedDomain);
router.post('/verified-domains', adminController.addVerifiedDomain);
router.delete('/verified-domains/:domainId', adminController.removeVerifiedDomain);
router.patch('/verified-domains/:domainId', adminController.setVerifiedDomainSchool);

// Colegios creados por el equipo de Juried (ya verificados, con su responsable y su dominio)
router.post('/schools', adminController.createSchool);

// ==================== PRENDAS DEL AVATAR ====================
// Cada prenda nace como borrador con la imagen ya preparada en «Completa» (PNG 395×959) y llega a las
// clases al publicarla. Retirar = deja de venderse (quien la tiene la conserva).
router.get('/avatar-items', avatarItems.list);
router.post('/avatar-items', uploadAvatarLayer, avatarItems.create);
router.get('/avatar-items/:itemId', avatarItems.get);
router.patch('/avatar-items/:itemId', avatarItems.update);
router.post('/avatar-items/:itemId/image', uploadAvatarLayer, avatarItems.replaceImage);
router.post('/avatar-items/:itemId/publish', avatarItems.publish);
router.post('/avatar-items/:itemId/retire', avatarItems.retire);
router.post('/avatar-items/:itemId/restore', avatarItems.restore);
router.put('/avatar-items/:itemId/pair', avatarItems.pair);
router.delete('/avatar-items/:itemId/pair', avatarItems.unpair);

// ==================== GESTIÓN DE CLASES ====================
router.get('/classrooms', adminController.getClassrooms);
router.get('/classrooms/:id/details', adminController.getClassroomDetails);

export default router;
