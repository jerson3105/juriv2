import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getAllMaps,
  getActiveMaps,
  getMapById,
  createMap,
  updateMap,
  deleteMap,
  uploadImage,
  uploadMapImage,
  getCategories,
} from '../controllers/expeditionMap.controller.js';

const router = Router();

// Rutas públicas para profesores (mapas activos)
router.get('/active', authenticate, getActiveMaps);
router.get('/categories', authenticate, getCategories);

// Rutas de administrador
router.get('/', authenticate, authorize('ADMIN'), getAllMaps);
router.get('/:id', authenticate, authorize('ADMIN'), getMapById);
router.post('/', authenticate, authorize('ADMIN'), createMap);
router.put('/:id', authenticate, authorize('ADMIN'), updateMap);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteMap);
router.post('/upload', authenticate, authorize('ADMIN'), uploadMapImage, uploadImage);

export default router;
