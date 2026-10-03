import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import fileType from 'file-type';
import { v4 as uuidv4 } from 'uuid';
import { ValidationError } from './errors.js';
import { AVATAR_UPLOAD_DIR, AVATAR_UPLOAD_PATH, resolveAvatarSource } from './avatarImages.js';

/** Lienzo de toda capa del avatar. «Completa» (el editor del panel) entrega siempre este tamaño. */
export const AVATAR_W = 395;
export const AVATAR_H = 959;
/** 395×959 RGBA sin comprimir son 1,5 MB: un PNG válido nunca pasa de esto. */
export const MAX_AVATAR_LAYER_BYTES = 2 * 1024 * 1024;

const PIXELS = AVATAR_W * AVATAR_H;
const decode = (buffer: Buffer) => sharp(buffer, { limitInputPixels: PIXELS, failOn: 'error', animated: false });

export const sha256 = (data: Buffer) => crypto.createHash('sha256').update(data).digest('hex');

/**
 * Revisa el PNG final de una capa y lo guarda recodificado (sin metadatos: ni EXIF ni el texto que deja la
 * IA) con un nombre nuevo. Nunca sobrescribe: el original se sirve como inmutable y sus variantes se
 * guardan por ruta. Las prendas deben traer transparencia real; los fondos cubren el recuadro.
 */
export const storeAvatarLayer = async (buffer: Buffer, slot: string): Promise<{ imagePath: string; imageHash: string }> => {
  const detected = await fileType.fromBuffer(buffer);
  if (detected?.mime !== 'image/png') throw new ValidationError('La imagen debe ser un PNG.');

  let meta: sharp.Metadata;
  try {
    meta = await decode(buffer).metadata();
  } catch {
    throw new ValidationError(`La imagen debe medir ${AVATAR_W}×${AVATAR_H} px.`);
  }
  if (meta.width !== AVATAR_W || meta.height !== AVATAR_H) {
    throw new ValidationError(`La imagen debe medir ${AVATAR_W}×${AVATAR_H} px (llegó de ${meta.width}×${meta.height}).`);
  }
  if ((meta.pages ?? 1) > 1) throw new ValidationError('La imagen no puede ser animada.');

  const { data } = await decode(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (slot !== 'BACKGROUND') {
    let visible = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 16) visible += 1;
    const coverage = visible / PIXELS;
    if (coverage > 0.9) throw new ValidationError('La prenda no tiene fondo transparente: quítale el fondo antes de guardarla.');
    if (coverage < 0.001) throw new ValidationError('La imagen está casi vacía.');
  }

  const png = await sharp(data, { raw: { width: AVATAR_W, height: AVATAR_H, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  const file = `${uuidv4()}.png`;
  await fs.promises.mkdir(AVATAR_UPLOAD_DIR, { recursive: true });
  // Temporal en la misma carpeta y renombrado atómico (nunca entre discos distintos).
  const tmp = path.join(AVATAR_UPLOAD_DIR, `.${file}.tmp`);
  await fs.promises.writeFile(tmp, png);
  await fs.promises.rename(tmp, path.join(AVATAR_UPLOAD_DIR, file));
  return { imagePath: `${AVATAR_UPLOAD_PATH}${file}`, imageHash: sha256(png) };
};

/** Huella del archivo de una capa (las sembradas en client/public no la tienen guardada). */
export const hashAvatarFile = async (imagePath: string): Promise<string | null> => {
  const file = resolveAvatarSource(imagePath);
  if (!file) return null;
  try {
    return sha256(await fs.promises.readFile(file));
  } catch {
    return null;
  }
};

/** Borra una capa subida desde el panel (nunca las del repo). Quien llama comprueba que nadie más la use. */
export const removeUploadedLayer = async (imagePath: string): Promise<void> => {
  if (!imagePath.startsWith(AVATAR_UPLOAD_PATH)) return;
  const file = resolveAvatarSource(imagePath);
  if (!file) return;
  await fs.promises.unlink(file).catch(() => undefined);
};
