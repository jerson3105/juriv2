import fs from 'fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';

/**
 * Traza de rendimiento para medir en local (desactivada por defecto).
 *
 * Con PERF_TRACE=1 registra, por petición: método, ruta, estado, ms y número de consultas SQL
 * (vía el logger de Drizzle). Con PERF_TRACE_FILE escribe JSON por líneas en ese archivo.
 * Sirve para detectar N+1 y comparar una optimización con la versión anterior.
 */
export const PERF_TRACE = process.env.PERF_TRACE === '1';

interface PerfContext {
  queries: number;
  sample: string[];
}

const storage = new AsyncLocalStorage<PerfContext>();
const traceFile = process.env.PERF_TRACE_FILE;
const sampleLimit = Number(process.env.PERF_TRACE_SAMPLE ?? 50);

/** Logger para Drizzle: cuenta las consultas de la petición en curso. */
export const perfQueryLogger = {
  logQuery(query: string): void {
    const ctx = storage.getStore();
    if (!ctx) return;
    ctx.queries++;
    if (ctx.sample.length < sampleLimit) ctx.sample.push(query.replace(/\s+/g, ' ').slice(0, 140));
  },
};

export const perfMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const ctx: PerfContext = { queries: 0, sample: [] };
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const entry = {
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ms: Math.round(Number(process.hrtime.bigint() - start) / 1e5) / 10,
      queries: ctx.queries,
      bytes: Number(res.getHeader('content-length') ?? 0),
      sample: ctx.sample,
    };
    const line = JSON.stringify(entry);
    if (traceFile) fs.appendFile(traceFile, line + '\n', () => undefined);
    else console.log('[perf]', line);
  });
  storage.run(ctx, next);
};
