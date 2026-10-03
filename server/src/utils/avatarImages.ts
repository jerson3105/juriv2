import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import sharp from 'sharp';
import { createVariantCache, fileInside, sendVariant } from './imageVariantCache.js';

// Capas del avatar en WebP, del tamaño que se muestran: se generan una vez al pedirlas y quedan en disco.
//   sm    → listas, podio y miniaturas del personaje (alto 320).
//   md    → el personaje grande (tamaño original).
//   thumb → la prenda sola, recortada a su contenido (tarjetas de la tienda).
// El avatar es estático: de un GIF se usa el primer cuadro.
const VARIANTS = {
  sm: (image: sharp.Sharp) => image.resize({ height: 320, withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }),
  md: (image: sharp.Sharp) => image.webp({ quality: 88, alphaQuality: 95 }),
  thumb: (image: sharp.Sharp) => image.resize({ width: 192, height: 192, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85, alphaQuality: 90 }),
} as const;
export type AvatarVariant = keyof typeof VARIANTS;

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
/** Prendas que sube el admin (fuera del repo: sobreviven a los despliegues y se ven al instante). */
export const AVATAR_UPLOAD_DIR = path.join(UPLOAD_DIR, 'avatar-items');
export const AVATAR_UPLOAD_PATH = '/api/uploads/avatar-items/';
const CACHE_DIR = path.join(UPLOAD_DIR, 'avatar-cache');
// Capas del sitio (base y prendas antiguas en client/public/avatars).
const PUBLIC_DIR = process.env.AVATAR_PUBLIC_DIR || path.resolve(process.cwd(), '..', 'client', 'public');

const LEGACY = /^\/avatars\/[\w\- ./]+\.(png|gif|webp)$/i;
const UPLOADED = /^\/api\/uploads\/avatar-items\/[\w.-]+\.(png|gif|webp)$/i;

/** Archivo de una capa del avatar a partir de su ruta guardada; null si no es una capa válida. */
export const resolveAvatarSource = (src: string): string | null => {
  if (!src) return null;
  if (LEGACY.test(src)) return fileInside(path.resolve(PUBLIC_DIR, 'avatars'), src.slice('/avatars/'.length));
  if (UPLOADED.test(src)) return fileInside(AVATAR_UPLOAD_DIR, src.slice(AVATAR_UPLOAD_PATH.length));
  return null;
};

const render = async (source: string, variant: AvatarVariant, target: string) => {
  try {
    // La prenda recortada a su contenido (sin el lienzo transparente del personaje).
    const base = variant === 'thumb' ? sharp(source, { animated: false }).trim() : sharp(source, { animated: false });
    await VARIANTS[variant](base).toFile(target);
  } catch (error) {
    if (variant !== 'thumb') throw error;
    // Una imagen vacía no se puede recortar: va completa.
    await VARIANTS.thumb(sharp(source, { animated: false })).toFile(target);
  }
};

export const avatarVariantFile = createVariantCache<AvatarVariant>(CACHE_DIR, render);

/** GET /api/avatar-img/:variant?src=<ruta de la capa> — pública (la piden etiquetas <img>, sin token). */
export const serveAvatarImage = async (req: Request, res: Response) => {
  const variant = req.params.variant as AvatarVariant;
  if (!Object.prototype.hasOwnProperty.call(VARIANTS, variant)) {
    res.status(400).json({ success: false, message: 'Variante inválida' });
    return;
  }
  const source = resolveAvatarSource(typeof req.query.src === 'string' ? req.query.src : '');
  if (!source) {
    res.status(400).json({ success: false, message: 'Imagen inválida' });
    return;
  }
  if (!fs.existsSync(source)) {
    res.status(404).json({ success: false, message: 'Imagen no encontrada' });
    return;
  }
  try {
    sendVariant(res, await avatarVariantFile(source, variant));
  } catch (error) {
    console.error('Error preparando una capa del avatar:', error);
    res.status(500).json({ success: false, message: 'No se pudo preparar la imagen' });
  }
};

/** Proporción del personaje (395×959): las prendas deben coincidir para quedar alineadas. */
export const AVATAR_RATIO = 395 / 959;
export const avatarImageRatio = async (file: string) => {
  const meta = await sharp(file, { animated: false }).metadata();
  return meta.width && meta.height ? meta.width / meta.height : 0;
};
