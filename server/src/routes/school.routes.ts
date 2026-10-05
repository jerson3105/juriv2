import { Router } from 'express';
import { schoolController, schoolManagementController } from '../controllers/school.controller.js';
import { schoolYearController } from '../controllers/schoolYear.controller.js';
import { schoolSectionController } from '../controllers/schoolSection.controller.js';
import { schoolRosterController } from '../controllers/schoolRoster.controller.js';
import { schoolRosterBuilderController } from '../controllers/schoolRosterBuilder.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ==================== RUTAS DE PROFESOR ====================

// Buscar escuelas existentes
router.get('/search', authorize('TEACHER'), schoolController.search.bind(schoolController));

// Invitación por enlace (antes de /:schoolId)
router.get('/invite/:code', authorize('TEACHER'), schoolManagementController.previewInvite);
router.post('/invite/:code/join', authorize('TEACHER'), schoolManagementController.joinByInvite);

// Mis escuelas
router.get('/my-schools', authorize('TEACHER'), schoolController.getMySchools.bind(schoolController));

// Crear escuela
router.post('/', authorize('TEACHER'), schoolController.create.bind(schoolController));

// Solicitar unirse a escuela
router.post('/:schoolId/join', authorize('TEACHER'), schoolController.requestJoin.bind(schoolController));

// Detalle de escuela
router.get('/:schoolId', authorize('TEACHER'), schoolController.getDetail.bind(schoolController));

// Profesores de la escuela con sus clases
router.get('/:schoolId/teachers', authorize('TEACHER'), schoolController.getSchoolTeachers.bind(schoolController));

// Solicitudes pendientes (owner)
router.get('/:schoolId/pending-requests', authorize('TEACHER'), schoolController.getPendingRequests.bind(schoolController));

// Revisar solicitud de unión (owner)
router.patch('/members/:memberId/review', authorize('TEACHER'), schoolController.reviewJoinRequest.bind(schoolController));

// Cancelar solicitud de unión (profesor)
router.delete('/members/:memberId/cancel', authorize('TEACHER'), schoolController.cancelJoinRequest.bind(schoolController));

// Gestión del responsable
router.delete('/:schoolId/members/:memberId', authorize('TEACHER', 'ADMIN'), schoolManagementController.removeTeacher);
router.get('/:schoolId/classrooms/:classroomId/report', authorize('TEACHER', 'ADMIN'), schoolManagementController.classroomReport);
router.post('/:schoolId/invite', authorize('TEACHER', 'ADMIN'), schoolManagementController.regenerateInvite);
router.delete('/:schoolId/invite', authorize('TEACHER', 'ADMIN'), schoolManagementController.disableInvite);

// ==================== CONSOLA ESCOLAR ====================
// Cada controlador exige el rol en la escuela (requireSchoolRole): sin atajo para el ADMIN de la plataforma.

// Año escolar, periodos y niveles
router.get('/:schoolId/years', authorize('TEACHER'), schoolYearController.list);
router.post('/:schoolId/years', authorize('TEACHER'), schoolYearController.create);
router.get('/:schoolId/years/:yearId', authorize('TEACHER'), schoolYearController.get);
router.put('/:schoolId/years/:yearId', authorize('TEACHER'), schoolYearController.update);

// Grados y secciones
router.get('/:schoolId/years/:yearId/sections', authorize('TEACHER'), schoolSectionController.list);
router.post('/:schoolId/years/:yearId/sections', authorize('TEACHER'), schoolSectionController.createMany);
router.patch('/:schoolId/sections/:sectionId', authorize('TEACHER'), schoolSectionController.update);
router.delete('/:schoolId/sections/:sectionId', authorize('TEACHER'), schoolSectionController.remove);

// Padrón: estudiantes del año, ficha y documento
router.get('/:schoolId/years/:yearId/students', authorize('TEACHER'), schoolRosterController.list);
router.post('/:schoolId/years/:yearId/students', authorize('TEACHER'), schoolRosterController.create);
router.get('/:schoolId/years/:yearId/students/:studentId', authorize('TEACHER'), schoolRosterController.get);
router.patch('/:schoolId/years/:yearId/students/:studentId', authorize('TEACHER'), schoolRosterController.update);
router.post('/:schoolId/students/:studentId/document/reveal', authorize('TEACHER'), schoolRosterController.revealDocument);

// Armar el padrón desde las clases
router.get('/:schoolId/years/:yearId/roster-builder', authorize('TEACHER'), schoolRosterBuilderController.overview);
router.put('/:schoolId/years/:yearId/roster-builder/mapping', authorize('TEACHER'), schoolRosterBuilderController.saveMapping);
router.get('/:schoolId/years/:yearId/roster-builder/proposal', authorize('TEACHER'), schoolRosterBuilderController.proposal);
router.put('/:schoolId/years/:yearId/roster-builder/decisions', authorize('TEACHER'), schoolRosterBuilderController.saveDecisions);
router.post('/:schoolId/years/:yearId/roster-builder/confirm', authorize('TEACHER'), schoolRosterBuilderController.confirm);

// Asignar/desasignar clase
router.post('/:schoolId/classrooms/:classroomId', authorize('TEACHER'), schoolController.assignClassroom.bind(schoolController));
router.delete('/classrooms/:classroomId', authorize('TEACHER'), schoolController.unassignClassroom.bind(schoolController));

// ==================== COMPORTAMIENTOS DE ESCUELA ====================

// Comportamientos de escuela
router.get('/:schoolId/behaviors', authorize('TEACHER'), schoolController.getSchoolBehaviors.bind(schoolController));
router.post('/:schoolId/behaviors', authorize('TEACHER'), schoolController.createSchoolBehavior.bind(schoolController));
router.post('/:schoolId/behaviors/import', authorize('TEACHER'), schoolController.importBehaviors.bind(schoolController));
router.patch('/behaviors/:behaviorId', authorize('TEACHER'), schoolController.updateSchoolBehavior.bind(schoolController));
router.delete('/behaviors/:behaviorId', authorize('TEACHER'), schoolController.deleteSchoolBehavior.bind(schoolController));

// ==================== INSIGNIAS DE ESCUELA ====================

// Insignias de escuela
router.get('/:schoolId/badges', authorize('TEACHER'), schoolController.getSchoolBadges.bind(schoolController));
router.post('/:schoolId/badges', authorize('TEACHER'), schoolController.createSchoolBadge.bind(schoolController));
router.post('/:schoolId/badges/import', authorize('TEACHER'), schoolController.importBadges.bind(schoolController));
router.patch('/badges/:badgeId', authorize('TEACHER'), schoolController.updateSchoolBadge.bind(schoolController));
router.delete('/badges/:badgeId', authorize('TEACHER'), schoolController.deleteSchoolBadge.bind(schoolController));

// ==================== REPORTES DE ESCUELA ====================

router.get('/:schoolId/reports/summary', authorize('TEACHER'), schoolController.getReportSummary.bind(schoolController));
router.get('/:schoolId/reports/behavior-trends', authorize('TEACHER'), schoolController.getBehaviorTrends.bind(schoolController));
router.get('/:schoolId/reports/class-ranking', authorize('TEACHER'), schoolController.getClassRanking.bind(schoolController));
router.get('/:schoolId/reports/top-behaviors', authorize('TEACHER'), schoolController.getTopBehaviors.bind(schoolController));
router.get('/:schoolId/reports/students-at-risk', authorize('TEACHER'), schoolController.getStudentsAtRisk.bind(schoolController));
router.get('/:schoolId/reports/attendance', authorize('TEACHER'), schoolController.getAttendanceReport.bind(schoolController));

// Enviar verificación
router.post('/verifications', authorize('TEACHER'), schoolController.createVerification.bind(schoolController));

// ==================== RUTAS DE ADMIN ====================

// Verificaciones pendientes
router.get('/admin/verifications', authorize('ADMIN'), schoolController.getAdminPendingVerifications.bind(schoolController));

// Revisar verificación
router.patch('/admin/verifications/:verificationId', authorize('ADMIN'), schoolController.reviewVerification.bind(schoolController));

// Todas las escuelas
router.get('/admin/all', authorize('ADMIN'), schoolController.getAllSchools.bind(schoolController));

// Todas las escuelas con miembros
router.get('/admin/schools-with-members', authorize('ADMIN'), schoolController.getAllSchoolsWithMembers.bind(schoolController));

export default router;
