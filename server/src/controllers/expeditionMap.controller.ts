import { Request, Response } from 'express';
import { expeditionMapService } from '../services/expeditionMap.service.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Configuración de multer para subir imágenes de mapas
const baseUploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const uploadsDir = path.join(baseUploadDir, 'maps');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

import { createUploadFilter, safeUploadFilename, verifyUploadedFile, IMAGE_MIMES } from '../utils/fileValidation.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: safeUploadFilename,
});

const fileFilter = createUploadFilter(IMAGE_MIMES, 'Solo se permiten imágenes (JPEG, PNG, GIF, WEBP)');

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

// Solo imágenes subidas aquí (las antiguas, sin /api): una URL externa la cargaban los navegadores de los
// alumnos (su dueño veía sus IP y podía cambiarla) y se rompía si el enlace moría.
const OWN_MAP_IMAGE = /^\/(api\/)?uploads\/maps\/[\w-]+\.(png|jpe?g|webp|gif)$/i;
const imageField = z.string().trim().regex(OWN_MAP_IMAGE, 'Sube la imagen del mapa: no se aceptan enlaces externos');
const mapSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre al mapa').max(255),
  description: z.string().trim().max(2000).nullable().optional(),
  imageUrl: imageField,
  thumbnailUrl: imageField.nullable().optional(),
  category: z.string().trim().min(1).max(100).optional(),
}).strict();
const mapUpdateSchema = mapSchema.partial().extend({ isActive: z.boolean().optional() }).strict();
const invalid = (res: Response, error: z.ZodError) => res.status(400).json({ error: error.issues[0]?.message ?? 'Datos inválidos' });

// Crear un nuevo mapa
export const createMap = async (req: Request, res: Response) => {
  try {
    const data = mapSchema.parse(req.body);
    const map = await expeditionMapService.create({ ...data, description: data.description ?? undefined, thumbnailUrl: data.thumbnailUrl ?? undefined });
    res.status(201).json(map);
  } catch (error) {
    if (error instanceof z.ZodError) return invalid(res, error);
    console.error('Error creating map:', error);
    res.status(500).json({ error: 'Error al crear mapa' });
  }
};

// Actualizar un mapa
export const updateMap = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = mapUpdateSchema.parse(req.body);
    const map = await expeditionMapService.update(id, { ...data, description: data.description ?? undefined, thumbnailUrl: data.thumbnailUrl ?? undefined });
    if (!map) return res.status(404).json({ error: 'Mapa no encontrado' });
    res.json(map);
  } catch (error) {
    if (error instanceof z.ZodError) return invalid(res, error);
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
    
    const imageUrl = `/api/uploads/maps/${req.file.filename}`;
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
