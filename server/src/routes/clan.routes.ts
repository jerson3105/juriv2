import { Router } from 'express';
import { clanController } from '../controllers/clan.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener opciones (emblemas y colores)
router.get('/options', clanController.getOptions.bind(clanController));

// Rutas para profesores - gestión de clanes
router.get('/classroom/:classroomId', authorize('TEACHER'), clanController.getClassroomClans.bind(clanController));
router.post('/classroom/:classroomId', authorize('TEACHER'), clanController.createClan.bind(clanController));
router.post('/classroom/:classroomId/assign-random', authorize('TEACHER'), clanController.assignRandomly.bind(clanController));
router.get('/classroom/:classroomId/ranking', clanController.getRanking.bind(clanController));

// Rutas para un clan específico
router.get('/:clanId', clanController.getClan.bind(clanController));
router.put('/:clanId', authorize('TEACHER'), clanController.updateClan.bind(clanController));
router.delete('/:clanId', authorize('TEACHER'), clanController.deleteClan.bind(clanController));
router.get('/:clanId/history', clanController.getClanHistory.bind(clanController));

// Gestión de miembros
router.post('/:clanId/members', authorize('TEACHER'), clanController.assignStudent.bind(clanController));
router.delete('/members/:studentId', authorize('TEACHER'), clanController.removeStudent.bind(clanController));

// Para estudiantes - obtener info de su clan
router.get('/student/:studentId/info', clanController.getStudentClanInfo.bind(clanController));

export default router;
