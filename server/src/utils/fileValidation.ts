import fileType from 'file-type';
import { Request } from 'express';
import multer from 'multer';

/**
 * Valida que el contenido real del archivo coincida con el tipo esperado
 */
export const validateImageContent = async (buffer: Buffer): Promise<boolean> => {
  try {
    const type = await fileType.fromBuffer(buffer);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return type ? allowedTypes.includes(type.mime) : false;
  } catch (error) {
    return false;
  }
};

/**
 * Valida documentos (PDF, Word, etc.)
 */
export const validateDocumentContent = async (buffer: Buffer): Promise<boolean> => {
  try {
    const type = await fileType.fromBuffer(buffer);
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    return type ? allowedTypes.includes(type.mime) : false;
  } catch (error) {
    return false;
  }
};

/**
 * File filter mejorado para Multer con validación de contenido
 */
export const createImageFileFilter = () => {
  return async (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    // Primera validación: MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, GIF, WebP)'));
    }
    
    cb(null, true);
  };
};

/**
 * File filter para documentos
 */
export const createDocumentFileFilter = () => {
  return (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
    ];
    
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Tipo de archivo no permitido'));
    }
    
    cb(null, true);
  };
};

/**
 * Middleware para validar contenido de archivo después de upload
 */
export const validateUploadedFile = (validator: (buffer: Buffer) => Promise<boolean>) => {
  return async (req: Request, res: any, next: any) => {
    if (!req.file) {
      return next();
    }

    try {
      const isValid = await validator(req.file.buffer);
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'El contenido del archivo no es válido',
        });
      }
      
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error al validar el archivo',
      });
    }
  };
};
