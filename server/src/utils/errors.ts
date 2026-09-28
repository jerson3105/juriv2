/**
 * Clases de error personalizadas para manejo consistente de errores
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado') {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado') {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Error interno del servidor') {
    super(500, message, false);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(500, message, false);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Demasiadas solicitudes') {
    super(429, message);
  }
}

/**
 * Mensaje apto para una respuesta 500. En producción no expone el detalle interno
 * (los errores de BD incluyen la consulta SQL y sus parámetros); en desarrollo sí.
 */
export const publicErrorMessage = (error: unknown, fallback = 'Error interno del servidor'): string => {
  if (process.env.NODE_ENV === 'production') return fallback;
  return error instanceof Error && error.message ? error.message : fallback;
};
