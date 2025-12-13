import { Request, Response } from 'express';
import { expeditionMapService } from '../services/expeditionMap.service.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Configuración de multer para subir imágenes de mapas
const uploadsDir = path.join(process.cwd(), 'uploads', 'maps');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (JPEG, PNG, GIF, WEBP)'));
  }
};

export const uploadMapImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo para mapas
  },
}).single('image');

// Obtener todos los mapas (admin)
export const getAllMaps = async (req: Request, res: Response) => {
  try {
    const maps = await expeditionMapService.getAll();
    res.json(maps);
  } catch (error) {
    console.error('Error getting maps:', error);
    res.status(500).json({ error: 'Error al obtener mapas' });
  }
};

// Obtener mapas activos (profesores)
export const getActiveMaps = async (req: Request, res: Response) => {
  try {
    const maps = await expeditionMapService.getActive();
    res.json(maps);
  } catch (error) {
    console.error('Error getting active maps:', error);
    res.status(500).json({ error: 'Error al obtener mapas' });
  }
};

// Obtener un mapa por ID
export const getMapById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const map = await expeditionMapService.getById(id);
    if (!map) {
      return res.status(404).json({ error: 'Mapa no encontrado' });
    }
    res.json(map);
  } catch (error) {
    console.error('Error getting map:', error);
    res.status(500).json({ error: 'Error al obtener mapa' });
  }
};

// Crear un nuevo mapa
export const createMap = async (req: Request, res: Response) => {
  try {
    const { name, description, imageUrl, thumbnailUrl, category } = req.body;
    
    if (!name || !imageUrl) {
      return res.status(400).json({ error: 'Nombre e imagen son requeridos' });
    }
    
    const map = await expeditionMapService.create({
      name,
      description,
      imageUrl,
      thumbnailUrl,
      category,
    });
    
    res.status(201).json(map);
  } catch (error) {
    console.error('Error creating map:', error);
    res.status(500).json({ error: 'Error al crear mapa' });
  }
};

// Actualizar un mapa
export const updateMap = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, imageUrl, thumbnailUrl, category, isActive } = req.body;
    
    const map = await expeditionMapService.update(id, {
      name,
      description,
      imageUrl,
      thumbnailUrl,
      category,
      isActive,
    });
    
    res.json(map);
  } catch (error) {
    console.error('Error updating map:', error);
    res.status(500).json({ error: 'Error al actualizar mapa' });
  }
};

// Eliminar un mapa
export const deleteMap = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await expeditionMapService.delete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting map:', error);
    res.status(500).json({ error: 'Error al eliminar mapa' });
  }
};

// Subir imagen de mapa
export const uploadImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }
    
    const imageUrl = `/uploads/maps/${req.file.filename}`;
    res.json({ url: imageUrl });
  } catch (error) {
    console.error('Error uploading map image:', error);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
};

// Obtener categorías
export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await expeditionMapService.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};
