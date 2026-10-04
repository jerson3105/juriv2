import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determinar si estamos en producción
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Datos que nunca deben quedar en los logs: contraseñas, PIN, tokens y documentos de identidad. Se tapan por nombre
// de campo, en objetos y también dentro de textos con JSON (console.error con objetos serializados).
const SENSITIVE_FIELDS = 'password|currentPassword|newPassword|pin|currentPin|newPin|pinHash|token|accessToken|refreshToken|dni|document|documentNumber|birthDate';
const SENSITIVE_KEY = new RegExp(`^(${SENSITIVE_FIELDS})$`, 'i');
const SENSITIVE_JSON = new RegExp(`"(${SENSITIVE_FIELDS})"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|-?\\d+)`, 'gi');
const REDACTED = '[redactado]';

const redactValue = (value: unknown, depth: number): unknown => {
  if (typeof value === 'string') return value.replace(SENSITIVE_JSON, `"$1":"${REDACTED}"`);
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1));
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? REDACTED : redactValue(item, depth + 1)])
  );
};

export const redactSensitive = winston.format((info) => {
  for (const key of Object.keys(info)) {
    info[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(info[key], 1);
  }
  return info;
});

// Formato de logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  redactSensitive(),
  winston.format.json()
);

// Formato para consola (más legible)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  redactSensitive(),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Configurar transportes
const transports: winston.transport[] = [];

// Logs de error (siempre activos)
transports.push(
  new DailyRotateFile({
    filename: path.join(__dirname, '../../logs/error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat,
  })
);

// Logs combinados (siempre activos)
transports.push(
  new DailyRotateFile({
    filename: path.join(__dirname, '../../logs/combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '7d',
    format: logFormat,
  })
);

// Console solo en desarrollo
if (isDevelopment) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Crear logger
export const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: logFormat,
  transports,
  exitOnError: false,
});

// Función para reemplazar console.log/error/warn
export const replaceConsole = () => {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args: any[]) => {
    logger.info(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
  };

  console.error = (...args: any[]) => {
    logger.error(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
  };

  console.warn = (...args: any[]) => {
    logger.warn(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
  };

  // Mantener referencias originales para debugging si es necesario
  (console as any)._originalLog = originalLog;
  (console as any)._originalError = originalError;
  (console as any)._originalWarn = originalWarn;
};

// Stream para Morgan (HTTP logging)
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Helper para logging estructurado
export const logRequest = (req: any, message: string, meta?: any) => {
  logger.info(message, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.user?.id,
    ...meta,
  });
};

export const logError = (error: Error, context?: any) => {
  logger.error(error.message, {
    stack: error.stack,
    ...context,
  });
};
