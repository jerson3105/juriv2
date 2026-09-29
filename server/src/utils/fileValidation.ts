import fs from 'fs';
import path from 'path';
import express from 'express';
import fileType from 'file-type';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Subidas de archivos: validación y servido seguro.
 *
 * Reglas:
 *  - La extensión guardada sale del MIME permitido, nunca de `originalname`
 *    (evita `.php`, `.html`, `.svg`... con un Content-Type falso).
 *  - Tras guardar, se verifica el contenido real (magic bytes); si no coincide,
 *    el archivo se borra y se responde 400.
 *  - Al servir, solo se entregan extensiones permitidas, con `nosniff`, una CSP
 *    `sandbox` y descarga forzada para lo que no es imagen.
 */

export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
export const PDF_MIMES = ['application/pdf'] as const;
export const OFFICE_MIMES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

/** Tipos que puede detectar `file-type` para cada MIME declarado. */
const ACCEPTED_DETECTION: Record<string, string[]> = {
  'image/jpeg': ['image/jpeg'],
  'image/png': ['image/png'],
  'image/gif': ['image/gif'],
  'image/webp': ['image/webp'],
  'application/pdf': ['application/pdf'],
  // Office antiguo (.doc/.xls) es un contenedor CFB.
  'application/msword': ['application/x-cfb'],
  'application/vnd.ms-excel': ['application/x-cfb'],
  // Office moderno es un ZIP; file-type suele reconocer el subtipo.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
  ],
};

const SERVABLE_EXTENSIONS = new Set(Object.values(MIME_EXTENSION));
const INLINE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

/** Filtro de multer: solo acepta los MIME indicados (y que tengan extensión conocida). */
export const createUploadFilter = (allowedMimes: readonly string[], errorMessage = 'Tipo de archivo no permitido') =>
  (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowedMimes.includes(file.mimetype) && MIME_EXTENSION[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(errorMessage));
    }
  };

/** Nombre de archivo seguro: `<uuid><extensión del MIME>`. */
export const safeUploadFilename = (
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, filename: string) => void
) => {
  const ext = MIME_EXTENSION[file.mimetype];
  if (!ext) return cb(new Error('Tipo de archivo no permitido'), '');
  cb(null, `${uuidv4()}${ext}`);
};

const removeQuietly = (filePath?: string) => {
  if (filePath) fs.promises.unlink(filePath).catch(() => undefined);
};

/**
 * Middleware posterior a multer: comprueba que el contenido real coincide con el
 * MIME declarado. Funciona con disco (`file.path`) y memoria (`file.buffer`).
 */
export const verifyUploadedFile: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const file = req.file;
  if (!file) return next();
  try {
    const detected = file.path
      ? await fileType.fromFile(file.path)
      : await fileType.fromBuffer(file.buffer);
    const accepted = ACCEPTED_DETECTION[file.mimetype] ?? [];
    if (!detected || !accepted.includes(detected.mime)) {
      removeQuietly(file.path);
      res.status(400).json({ success: false, message: 'El contenido del archivo no coincide con su tipo' });
      return;
    }
    next();
  } catch {
    removeQuietly(file.path);
    res.status(400).json({ success: false, message: 'No se pudo validar el archivo' });
  }
};

/**
 * Sirve una carpeta de archivos subidos de forma segura. Una extensión no permitida nunca
 * llega a `express.static` (aunque el archivo exista en disco): la petición sigue su curso
 * con `next()`. No se responde 404 aquí porque algunos prefijos se comparten con la API
 * (p. ej. `/api/badges` sirve imágenes y también es la ruta de la API de insignias).
 */
export const serveUploads = (dir: string): RequestHandler[] => {
  const serveStatic = express.static(dir, {
    dotfiles: 'deny',
    index: false,
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
      res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
      if (!INLINE_EXTENSIONS.has(ext)) {
        res.setHeader('Content-Disposition', 'attachment');
      }
    },
  });

  return [
    (req, res, next) => {
      const ext = path.extname(req.path).toLowerCase();
      if (!SERVABLE_EXTENSIONS.has(ext) && ext !== '.jpeg') {
        next();
        return;
      }
      serveStatic(req, res, next);
    },
  ];
};
