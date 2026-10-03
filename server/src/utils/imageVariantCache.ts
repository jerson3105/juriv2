import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Response } from 'express';

// Variantes de imágenes (WebP del tamaño que se muestran) generadas una vez al pedirlas y guardadas en disco.
// La clave incluye tamaño y fecha del original: si el archivo cambia, se genera otra.

/**
 * Devuelve la función que entrega el archivo de una variante: si ya existe en `cacheDir/<variante>/` lo
 * reutiliza; si no, lo genera con `render` (a un temporal que luego se renombra). Dos pedidos de la misma
 * variante a la vez esperan la misma generación.
 */
export const createVariantCache = <V extends string>(
  cacheDir: string,
  render: (source: string, variant: V, target: string) => Promise<void>,
) => {
  const pending = new Map<string, Promise<string>>();
  return async (source: string, variant: V): Promise<string> => {
    const stat = await fs.promises.stat(source);
    const key = crypto.createHash('sha1').update(`${source}|${stat.size}|${stat.mtimeMs}`).digest('hex');
    const target = path.join(cacheDir, variant, `${key}.webp`);
    if (fs.existsSync(target)) return target;
    const inflight = pending.get(target);
    if (inflight) return inflight;
    const job = (async () => {
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
      await render(source, variant, temporary);
      await fs.promises.rename(temporary, target);
      return target;
    })().finally(() => pending.delete(target));
    pending.set(target, job);
    return job;
  };
};

/** Envía una variante ya generada (pública: la piden etiquetas <img> sin token). */
export const sendVariant = (res: Response, file: string) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.type('image/webp');
  res.sendFile(file, { maxAge: '7d' });
};

/** Archivo dentro de `root` a partir de la parte final de su ruta pública; null si intenta salir de la carpeta. */
export const fileInside = (root: string, relative: string) => {
  if (!relative || relative.includes('..') || relative.includes('\\')) return null;
  const base = path.resolve(root);
  const full = path.resolve(base, relative);
  return full.startsWith(base + path.sep) ? full : null;
};
