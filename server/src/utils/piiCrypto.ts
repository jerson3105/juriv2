import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { config_app } from '../config/env.js';

/**
 * Datos personales sensibles (DNI y otros documentos): se guardan cifrados con AES-256-GCM y se buscan por un índice
 * ciego HMAC-SHA256, nunca en claro. Las dos llaves son distintas y viven solo en el .env del servidor: un volcado de
 * la base o un respaldo no revela documentos.
 */

const FORMAT = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Faltan las llaves, o el dato cifrado no es válido (alterado, de otra fila o campo, o de otra llave). */
export class PiiCryptoError extends Error {}

const keys = () => {
  const { encKey, indexKey } = config_app.pii;
  if (!encKey || !indexKey) {
    throw new PiiCryptoError('Faltan las llaves de datos personales (PII_ENC_KEY y PII_INDEX_KEY) en el .env del servidor');
  }
  return { encKey, indexKey };
};

/** true si el servidor puede guardar documentos. */
export const piiReady = (): boolean => Boolean(config_app.pii.encKey && config_app.pii.indexKey);

/**
 * Cifra un valor. `context` lo ata a su lugar (por ejemplo `school_student:<id>:document`): copiado a otra fila u
 * otro campo, ya no se descifra.
 */
export const encryptPii = (plain: string, context: string): string => {
  if (!plain) throw new PiiCryptoError('No hay nada que cifrar');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keys().encKey, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(context, 'utf8'));
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [FORMAT, iv.toString('base64url'), data.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
};

export const decryptPii = (sealed: string, context: string): string => {
  const parts = sealed.split('.');
  const [format, ivText = '', dataText = '', tagText = ''] = parts;
  const iv = Buffer.from(ivText, 'base64url');
  const tag = Buffer.from(tagText, 'base64url');
  if (parts.length !== 4 || format !== FORMAT || iv.length !== IV_BYTES || tag.length !== TAG_BYTES || !dataText) {
    throw new PiiCryptoError('Dato cifrado con formato desconocido');
  }
  const { encKey } = keys();
  try {
    const decipher = createDecipheriv('aes-256-gcm', encKey, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new PiiCryptoError('No se pudo descifrar el dato (alterado, de otro lugar o de otra llave)');
  }
};

/**
 * Índice ciego: busca y exige unicidad sin descifrar. `scope` separa usos y escuelas (por ejemplo
 * `document:<schoolId>`): el mismo documento en dos escuelas da índices distintos y una base filtrada no permite
 * cruzarlos.
 */
export const blindIndex = (normalized: string, scope: string): string => {
  if (!normalized) throw new PiiCryptoError('No hay nada que indexar');
  return createHmac('sha256', keys().indexKey).update(scope).update('\u0000').update(normalized).digest('hex');
};
