import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import sharp from 'sharp';
import { createVariantCache, fileInside, sendVariant } from './imageVariantCache.js';

// Figuritas y portadas en WebP del tamaño que se muestran (los profes suben fotos de hasta 2 MB):
//   sm → el álbum, la mesa y las listas (cartas de hasta ~160 px).
//   md → el detalle de una figurita, las cartas grandes y las portadas.
// Un GIF animado sigue animado (WebP animado, más liviano).
const VARIANTS = {
  sm: (image: sharp.Sharp) => image.resize({ width: 320, withoutEnlargement: true }).webp({ quality: 80 }),
  md: (image: sharp.Sharp) => image.resize({ width: 640, withoutEnlargement: true }).webp({ quality: 82 }),
} as const;
export type CollectibleVariant = keyof typeof VARIANTS;

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const COLLECTIBLE_UPLOAD_DIR = path.join(UPLOAD_DIR, 'collectibles');
const COLLECTIBLE_UPLOAD_PATH = '/api/uploads/collectibles/';
const CACHE_DIR = path.join(UPLOAD_DIR, 'collectible-cache');
const UPLOADED = /^\/api\/uploads\/collectibles\/[\w.-]+\.(png|jpe?g|gif|webp)$/i;

/** Archivo de una imagen subida de figurita o portada; null si no es una de ellas (las externas no se tocan). */
export const resolveCollectibleSource = (src: string) =>
  UPLOADED.test(src) ? fileInside(COLLECTIBLE_UPLOAD_DIR, src.slice(COLLECTIBLE_UPLOAD_PATH.length)) : null;

const collectibleVariantFile = createVariantCache<CollectibleVariant>(CACHE_DIR, async (source, variant, target) => {
  await VARIANTS[variant](sharp(source, { animated: true })).toFile(target);
});

/** GET /api/collectible-img/:variant?src=<ruta de la imagen subida> — pública (la piden etiquetas <img>, sin token). */
export const serveCollectibleImage = async (req: Request, res: Response) => {
  const variant = req.params.variant as CollectibleVariant;
  if (!Object.prototype.hasOwnProperty.call(VARIANTS, variant)) {
    res.status(400).json({ success: false, message: 'Variante inválida' });
    return;
  }
  const source = resolveCollectibleSource(typeof req.query.src === 'string' ? req.query.src : '');
  if (!source) {
    res.status(400).json({ success: false, message: 'Imagen inválida' });
    return;
  }
  if (!fs.existsSync(source)) {
    res.status(404).json({ success: false, message: 'Imagen no encontrada' });
    return;
  }
  try {
    sendVariant(res, await collectibleVariantFile(source, variant));
  } catch (error) {
    console.error('Error preparando una imagen de figurita:', error);
    res.status(500).json({ success: false, message: 'No se pudo preparar la imagen' });
  }
};
