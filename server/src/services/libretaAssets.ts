import fs from 'node:fs';
import path from 'node:path';

/** Imágenes de la cabecera de la libreta: el logo del colegio (subido) y el escudo del MINEDU (si el colegio lo pasó). */

const uploadsDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
export const SCHOOL_LOGO_DIR = path.join(uploadsDir, 'school-logos');
export const LOGO_URL_PREFIX = '/api/uploads/school-logos/';
// Sin la imagen, la libreta lleva el texto «República del Perú · Ministerio de Educación».
const MINEDU_IMAGE = path.join(process.cwd(), 'assets', 'libreta', 'minedu.png');

/** El archivo del logo en el disco (solo los que guardó la subida: nunca una ruta que venga de afuera). */
export const logoPath = (logoUrl: string | null) =>
  (logoUrl?.startsWith(LOGO_URL_PREFIX) ? path.join(SCHOOL_LOGO_DIR, path.basename(logoUrl)) : null);

export const readIfExists = async (file: string | null) => {
  if (!file) return null;
  try { return await fs.promises.readFile(file); } catch { return null; }
};

let mineduImage: Promise<Buffer | null> | null = null;
const minedu = () => (mineduImage ??= readIfExists(MINEDU_IMAGE));

/** Las imágenes para el PDF de una libreta del colegio. */
export const libretaImages = async (logoUrl: string | null) => {
  const [logo, mineduBuffer] = await Promise.all([readIfExists(logoPath(logoUrl)), minedu()]);
  return { logo, minedu: mineduBuffer };
};
