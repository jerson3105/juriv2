/**
 * Sistema de caché en memoria simple
 * Puede ser reemplazado por Redis en producción
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Limpiar entradas expiradas cada minuto
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Obtener valor del caché
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  /**
   * Guardar valor en caché
   * @param ttlSeconds Tiempo de vida en segundos (default: 60)
   */
  set<T>(key: string, value: T, ttlSeconds = 60): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000),
    });
  }

  /**
   * Eliminar valor del caché
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Eliminar valores que coincidan con un patrón
   */
  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpiar todo el caché
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Limpiar entradas expiradas
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Obtener o establecer valor (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds = 60
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Detener el intervalo de limpieza
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Obtener estadísticas del caché
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton
export const cache = new MemoryCache();

// Claves de caché comunes
export const CACHE_KEYS = {
  user: (userId: string) => `user:${userId}`,
  classroom: (classroomId: string) => `classroom:${classroomId}`,
  classroomStudents: (classroomId: string) => `classroom:${classroomId}:students`,
  studentProfile: (studentId: string) => `student:${studentId}`,
  behaviors: (classroomId: string) => `behaviors:${classroomId}`,
  shopItems: (classroomId: string) => `shop:${classroomId}`,
};

// TTL comunes en segundos
export const CACHE_TTL = {
  SHORT: 30,      // 30 segundos
  MEDIUM: 120,    // 2 minutos
  LONG: 300,      // 5 minutos
  VERY_LONG: 600, // 10 minutos
};
