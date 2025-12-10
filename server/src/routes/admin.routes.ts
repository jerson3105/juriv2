import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { adminController } from '../controllers/admin.controller.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta base al directorio de avatars
const AVATARS_DIR = path.resolve(__dirname, '..', '..', '..', 'client', 'public', 'avatars');
const TEMP_DIR = path.resolve(__dirname, '..', '..', 'temp');

// Crear directorio temporal si no existe
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Mapeo de slots a carpetas (exportar para usar en controlador)
export const SLOT_FOLDERS: Record<string, string> = {
  HEAD: 'Cabeza',
  HAIR: 'Pelo',
  EYES: 'Ojos',
  TOP: 'Superior',
  BOTTOM: 'Inferior',
  LEFT_HAND: 'Mano izquierda',
  RIGHT_HAND: 'Mano derecha',
  SHOES: 'Zapatos',
  BACK: 'Espalda',
  FLAG: 'Bandera',
};

export { AVATARS_DIR };

// Configurar multer para subida temporal
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PNG o GIF'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max (GIFs pueden ser más grandes)
  }
});

// Todas las rutas requieren autenticación y rol ADMIN
router.use(authenticate);
router.use(authorize('ADMIN'));

// ==================== DASHBOARD ====================
router.get('/stats', adminController.getStats);

// ==================== GESTIÓN DE USUARIOS ====================
router.get('/users', adminController.getUsers);
router.post('/users/teacher', adminController.createTeacher);
router.patch('/users/:userId/role', adminController.updateUserRole);

// ==================== GESTIÓN DE ITEMS DE AVATAR ====================
router.get('/avatar-items', adminController.getAvatarItems);
router.post('/avatar-items', upload.single('image'), adminController.createAvatarItem);
router.patch('/avatar-items/:itemId', adminController.updateAvatarItem);
router.delete('/avatar-items/:itemId', adminController.deleteAvatarItem);

// ==================== GESTIÓN DE CLASES ====================
router.get('/classrooms', adminController.getClassrooms);

// ==================== GESTIÓN DE ESCUELAS ====================
router.get('/schools', adminController.getSchools);

export default router;
