import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema.js';
import { PERF_TRACE, perfQueryLogger } from '../utils/perfTrace.js';

// Pool de conexiones MySQL
let pool: mysql.Pool | null = null;

export const getPool = () => {
  if (!pool) {
    const isProduction = process.env.NODE_ENV === 'production';
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'juried_db',
      waitForConnections: true,
      connectionLimit: isProduction ? 50 : 10, // Más conexiones en producción
      maxIdle: isProduction ? 10 : 5,
      idleTimeout: 60000, // 60 segundos
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: 'local', // Usar zona horaria local para fechas
    });
  }
  return pool;
};

// Instancia de Drizzle
export const db = drizzle(getPool(), {
  schema,
  mode: 'default',
  // Solo para medir en local (PERF_TRACE=1): cuenta consultas por petición.
  ...(PERF_TRACE ? { logger: perfQueryLogger } : {}),
});

// Función para conectar a la base de datos
export const connectDatabase = async (): Promise<void> => {
  try {
    const connection = await getPool().getConnection();
    console.log('✅ Conectado a la base de datos MySQL');
    connection.release();
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos:', error);
    process.exit(1);
  }
};

// Función para desconectar
export const disconnectDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('🔌 Desconectado de la base de datos');
  }
};

// Exportar schema
export * from './schema.js';
