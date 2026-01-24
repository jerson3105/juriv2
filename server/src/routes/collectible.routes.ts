import { Router } from 'express';
import { collectibleController } from '../controllers/collectible.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ==================== ÁLBUMES (PROFESOR) ====================

// Crear álbum
router.post(
  '/classroom/:classroomId/albums',
  authorize('TEACHER'),
  collectibleController.createAlbum
);

// Listar álbumes de una clase
router.get(
  '/classroom/:classroomId/albums',
  authorize('TEACHER', 'STUDENT'),
  collectibleController.getAlbums
);

// Obtener álbum con cartas
router.get(
  '/albums/:albumId',
  authorize('TEACHER', 'STUDENT'),
  collectibleController.getAlbumById
);

// Actualizar álbum
router.put(
  '/albums/:albumId',
  authorize('TEACHER'),
  collectibleController.updateAlbum
);

// Eliminar álbum
router.delete(
  '/albums/:albumId',
  authorize('TEACHER'),
  collectibleController.deleteAlbum
);

// ==================== CARTAS (PROFESOR) ====================

// Crear carta individual
router.post(
  '/albums/:albumId/cards',
  authorize('TEACHER'),
  collectibleController.createCard
);

// Crear múltiples cartas
router.post(
  '/albums/:albumId/cards/batch',
  authorize('TEACHER'),
  collectibleController.createManyCards
);

// Actualizar carta
router.put(
  '/cards/:cardId',
  authorize('TEACHER'),
  collectibleController.updateCard
);

// Eliminar carta
router.delete(
  '/cards/:cardId',
  authorize('TEACHER'),
  collectibleController.deleteCard
);

// ==================== COMPRAS (ESTUDIANTE) ====================

// Comprar sobre
router.post(
  '/albums/:albumId/purchase',
  authorize('STUDENT'),
  collectibleController.purchasePack
);

// ==================== COLECCIÓN (ESTUDIANTE) ====================

// Ver mi colección de un álbum
router.get(
  '/albums/:albumId/my-collection',
  authorize('STUDENT'),
  collectibleController.getStudentCollection
);

// Ver colección de un estudiante específico (profesor)
router.get(
  '/albums/:albumId/student/:studentProfileId/collection',
  authorize('TEACHER'),
  collectibleController.getStudentCollection
);

// ==================== PROGRESO DE CLASE (PROFESOR) ====================

// Ver progreso de todos los estudiantes en un álbum
router.get(
  '/classroom/:classroomId/albums/:albumId/progress',
  authorize('TEACHER'),
  collectibleController.getClassroomProgress
);

// ==================== GENERACIÓN CON IA ====================

// Generar álbum completo con IA
router.post(
  '/classroom/:classroomId/generate-album',
  authorize('TEACHER'),
  collectibleController.generateAlbumWithAI
);

// Generar carta individual con IA
router.post(
  '/generate-card',
  authorize('TEACHER'),
  collectibleController.generateCardWithAI
);

// ==================== PROGRESO DE ESTUDIANTE (TODOS LOS ÁLBUMES) ====================

// Ver progreso del estudiante en todos los álbumes de una clase
router.get(
  '/classroom/:classroomId/my-progress',
  authorize('STUDENT'),
  collectibleController.getStudentAlbumsProgress
);

export default router;
