import { Router } from 'express';
import { collectibleController } from '../controllers/collectible.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { aiGuard } from '../middleware/security.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createUploadFilter, safeUploadFilename, verifyUploadedFile, IMAGE_MIMES } from '../utils/fileValidation.js';

const router = Router();

// Imágenes de cromos y portadas: UPLOAD_DIR/collectibles, servidas por /api/uploads/collectibles (index.ts).
const collectibleImagesDir = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), 'collectibles');
if (!fs.existsSync(collectibleImagesDir)) {
  fs.mkdirSync(collectibleImagesDir, { recursive: true });
}
const uploadCollectibleImage = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, collectibleImagesDir),
    filename: safeUploadFilename,
  }),
  fileFilter: createUploadFilter(IMAGE_MIMES, 'Solo se permiten imágenes (PNG, JPG, GIF, WEBP)'),
  limits: { fileSize: 2 * 1024 * 1024 },
}).single('image');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Subir imagen de cromo o portada (profesor)
router.post('/upload-image', authorize('TEACHER'), (req, res, next) => {
  uploadCollectibleImage(req, res, (error: unknown) => {
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
  res.json({ imageUrl: `/api/uploads/collectibles/${req.file.filename}` });
});

// Cuántos estudiantes tienen cada cromo de un álbum (profesor)
router.get('/albums/:albumId/card-owners', authorize('TEACHER'), collectibleController.getCardOwners);

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

// Listar álbumes importables desde otras clases del profesor
router.get(
  '/classroom/:classroomId/importable-albums',
  authorize('TEACHER'),
  collectibleController.getImportableAlbums
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

// Copiar álbum a otras clases del profesor
router.post(
  '/albums/:albumId/clone',
  authorize('TEACHER'),
  collectibleController.cloneAlbum
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

// Mover cromos entre álbumes de la misma clase
router.post(
  '/albums/:albumId/cards/move',
  authorize('TEACHER'),
  collectibleController.moveCards
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
  ...aiGuard,
  collectibleController.generateAlbumWithAI
);

// Generar carta individual con IA
router.post(
  '/generate-card',
  authorize('TEACHER'),
  ...aiGuard,
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
