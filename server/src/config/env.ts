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
};
