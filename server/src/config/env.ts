import { config } from 'dotenv';
import { z } from 'zod';

// Cargar variables de entorno
config();

// Schema de validación para variables de entorno
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  
  // Base de Datos MySQL
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().default('3306'),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('juried_db'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),
  
  // Frontend
  CLIENT_URL: z.string().default('http://localhost:5173'),

  // IA (Gemini)
  GEMINI_API_KEY: z.string().optional(),

  // Datos personales (DNI y otros documentos): llave de cifrado AES-256-GCM y llave del índice ciego HMAC-SHA256.
  // 32 bytes en base64 cada una y distintas entre sí. Viven solo aquí (no en la base ni en sus respaldos): si se
  // pierden, los documentos guardados no se pueden leer. Genéralas con scripts/generate-secrets.js.
  PII_ENC_KEY: z.string().optional(),
  PII_INDEX_KEY: z.string().optional(),

  // true: ninguna cuenta de administración entra sin la verificación en dos pasos (se activa en el servidor con
  // npm run admin:totp). Encenderlo después de activarla, o la administración queda sin acceso.
  ADMIN_TOTP_REQUIRED: z.enum(['true', 'false']).default('false'),
});

// Valores de ejemplo publicados en el repositorio (.env.example, docs): nunca válidos en producción
const PLACEHOLDER_SECRET = /^(tu_|your_|cambia|change|<)|cambiar_en_produccion/i;

const findWeakSecrets = (data: z.infer<typeof envSchema>): Record<string, string[]> => {
  const issues: Record<string, string[]> = {};
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    if (PLACEHOLDER_SECRET.test(data[key])) {
      issues[key] = ['Usa un valor de ejemplo; genera uno con scripts/generate-secrets.js'];
    }
  }
  if (data.JWT_SECRET === data.JWT_REFRESH_SECRET) {
    issues.JWT_REFRESH_SECRET = [...(issues.JWT_REFRESH_SECRET ?? []), 'Debe ser distinto de JWT_SECRET'];
  }
  return issues;
};

/** Llave de 32 bytes en base64 canónico; null si falta o no lo es. */
const decodeKey = (value: string | undefined): Buffer | null => {
  if (!value) return null;
  const key = Buffer.from(value.trim(), 'base64');
  return key.length === 32 && key.toString('base64') === value.trim() ? key : null;
};

// Sin documentos guardados todavía, las llaves pueden faltar (el cifrado se niega a funcionar sin ellas);
// si están, deben ser válidas.
const findPiiKeyIssues = (data: z.infer<typeof envSchema>): Record<string, string[]> => {
  const issues: Record<string, string[]> = {};
  if (!data.PII_ENC_KEY && !data.PII_INDEX_KEY) return issues;
  for (const key of ['PII_ENC_KEY', 'PII_INDEX_KEY'] as const) {
    if (!data[key]) issues[key] = ['Falta: las dos llaves van juntas'];
    else if (!decodeKey(data[key])) issues[key] = ['Debe ser de 32 bytes en base64; genérala con scripts/generate-secrets.js'];
  }
  if (data.PII_ENC_KEY && data.PII_ENC_KEY === data.PII_INDEX_KEY) {
    issues.PII_INDEX_KEY = [...(issues.PII_INDEX_KEY ?? []), 'Debe ser distinta de PII_ENC_KEY'];
  }
  return issues;
};

// Validar y exportar configuración
const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Variables de entorno inválidas:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  const weakSecrets = findWeakSecrets(parsed.data);
  if (Object.keys(weakSecrets).length > 0) {
    if (parsed.data.NODE_ENV === 'production') {
      console.error('❌ Secretos JWT inseguros en producción:');
      console.error(weakSecrets);
      process.exit(1);
    }
    console.warn('⚠️ Secretos JWT inseguros (bloquearían el arranque en producción):', weakSecrets);
  }

  const piiKeyIssues = findPiiKeyIssues(parsed.data);
  if (Object.keys(piiKeyIssues).length > 0) {
    if (parsed.data.NODE_ENV === 'production') {
      console.error('❌ Llaves de datos personales inválidas:');
      console.error(piiKeyIssues);
      process.exit(1);
    }
    console.warn('⚠️ Llaves de datos personales inválidas (bloquearían el arranque en producción):', piiKeyIssues);
  }

  return parsed.data;
};

export const env = parseEnv();

// Configuración derivada
export const config_app = {
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  port: parseInt(env.PORT, 10),
  
  db: {
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT, 10),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    name: env.DB_NAME,
  },
  
  jwt: {
    secret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: env.GOOGLE_CALLBACK_URL,
  },
  
  clientUrl: env.CLIENT_URL,

  adminTotpRequired: env.ADMIN_TOTP_REQUIRED === 'true',

  // null si faltan o no son válidas: el cifrado de documentos (utils/piiCrypto) no funciona sin las dos.
  pii: {
    encKey: decodeKey(env.PII_ENC_KEY),
    indexKey: decodeKey(env.PII_INDEX_KEY),
  },
};
