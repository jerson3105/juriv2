import type { AvatarGender, AvatarSlot } from '../../../lib/avatarApi';
import { BODY_ANCHORS, CANVAS_H, CANVAS_RATIO, CANVAS_W, coverRows, slotBox } from './completaAnchors';

// Motor de «Completa»: todo en el navegador, sobre píxeles. La prenda es la imagen fuente + una máscara
// (qué píxeles quedan) + una transformación (escala, ensanche, posición) hacia el lienzo 395×959. Así
// mover o escalar nunca degrada lo borrado, y «Restaurar» siempre vuelve a la fuente.

/** Detalle de trabajo: el doble del alto del lienzo basta para reducir limpio. */
const MAX_WORK_SIDE = 1918;
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 40_000_000;

export interface SourceImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  /** Alfa original (255 en un JPG). «Restaurar» vuelve a esto. */
  alpha: Uint8Array;
  hadAlpha: boolean;
  /** Medida del archivo original (para mostrarla). */
  originalWidth: number;
  originalHeight: number;
}

export type BackgroundKind = 'transparent' | 'checker' | 'solid' | 'complex';

export interface Transform {
  scale: number;
  /** Ensanche horizontal desde el centro del torso (1 = igual). */
  widen: number;
  dx: number;
  dy: number;
}

export type FitMode = 'frame' | 'loose' | 'cover';

const sat = (r: number, g: number, b: number) => Math.max(r, g, b) - Math.min(r, g, b);
const lum = (r: number, g: number, b: number) => (r + g + b) / 3;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

export class SourceError extends Error {}

export const loadSource = async (blob: Blob): Promise<SourceImage> => {
  if (blob.size > MAX_SOURCE_BYTES) throw new SourceError('La imagen pesa más de 15 MB.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new SourceError('No se pudo leer la imagen. Usa un JPG, PNG o WebP.');
  }
  if (bitmap.width * bitmap.height > MAX_SOURCE_PIXELS) {
    bitmap.close();
    throw new SourceError('La imagen es demasiado grande (más de 40 megapíxeles).');
  }
  const factor = Math.min(1, MAX_WORK_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * factor));
  const height = Math.max(1, Math.round(bitmap.height * factor));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  const original = { originalWidth: bitmap.width, originalHeight: bitmap.height };
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, width, height);
  const alpha = new Uint8Array(width * height);
  let hadAlpha = false;
  for (let i = 0, p = 3; i < alpha.length; i += 1, p += 4) {
    alpha[i] = data[p];
    if (data[p] < 250) hadAlpha = true;
  }
  return { width, height, data, alpha, hadAlpha, ...original };
};

// ==================== Fondo ====================

const borderRing = (w: number, h: number): number[] => {
  const ring: number[] = [];
  for (let x = 0; x < w; x += 1) ring.push(x, w + x, (h - 1) * w + x, (h - 2) * w + x);
  for (let y = 2; y < h - 2; y += 1) ring.push(y * w, y * w + 1, y * w + w - 1, y * w + w - 2);
  return ring;
};

/** Mira el borde de la imagen: ¿transparencia real, cuadriculado dibujado (la IA), color liso o escena? */
export const detectBackground = (src: SourceImage): { kind: BackgroundKind; color: [number, number, number] | null } => {
  const { width: w, height: h, data, alpha } = src;
  const ring = borderRing(w, h);
  let transparent = 0;
  for (const i of ring) if (alpha[i] < 20) transparent += 1;
  if (src.hadAlpha && transparent / ring.length > 0.6) return { kind: 'transparent', color: null };

  let lightGray = 0;
  let bright = 0;
  let mid = 0;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (const i of ring) {
    const p = i * 4;
    const r = data[p]; const g = data[p + 1]; const b = data[p + 2];
    rs.push(r); gs.push(g); bs.push(b);
    if (sat(r, g, b) <= 30 && lum(r, g, b) >= 150) {
      lightGray += 1;
      if (lum(r, g, b) >= 232) bright += 1; else mid += 1;
    }
  }
  const n = ring.length;
  // Cuadriculado: casi todo el borde es claro y gris, en dos tonos.
  if (lightGray / n >= 0.85 && bright / n >= 0.12 && mid / n >= 0.12) return { kind: 'checker', color: null };
  const color: [number, number, number] = [median(rs), median(gs), median(bs)];
  let near = 0;
  for (const i of ring) {
    const p = i * 4;
    if (Math.hypot(data[p] - color[0], data[p + 1] - color[1], data[p + 2] - color[2]) <= 40) near += 1;
  }
  if (near / n >= 0.85) return { kind: 'solid', color };
  return { kind: 'complex', color: null };
};

/** ¿Este píxel es fondo? Tolerancia 0–100 (30 = la de los scripts de referencia). */
const backgroundTest = (src: SourceImage, kind: BackgroundKind, color: [number, number, number] | null, tolerance: number, loose = false) => {
  const { data } = src;
  if (kind === 'checker') {
    const satMax = (18 + tolerance * 0.4) + (loose ? 15 : 0);
    const lumMin = (200 - tolerance) - (loose ? 30 : 0);
    return (i: number) => {
      const p = i * 4;
      const r = data[p]; const g = data[p + 1]; const b = data[p + 2];
      return sat(r, g, b) <= satMax && lum(r, g, b) >= lumMin;
    };
  }
  if (kind === 'solid' && color) {
    const max = tolerance * 1.3 * (loose ? 1.6 : 1);
    return (i: number) => {
      const p = i * 4;
      return Math.hypot(data[p] - color[0], data[p + 1] - color[1], data[p + 2] - color[2]) <= max;
    };
  }
  return () => false;
};

const floodFromBorder = (w: number, h: number, test: (i: number) => boolean): Uint8Array => {
  const bg = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const push = (i: number) => {
    if (bg[i] || !test(i)) return;
    bg[i] = 1;
    queue[tail++] = i;
  };
  for (let x = 0; x < w; x += 1) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y += 1) { push(y * w); push(y * w + w - 1); }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  return bg;
};

export interface BackgroundResult {
  mask: Uint8Array;
  /** Parte de la imagen que se quitó (0–1). */
  removed: number;
  /** Zonas encerradas con aspecto de cuadriculado (entre brazo y cuerpo, la abertura del cuello…). */
  holes: Int32Array[];
}

/**
 * Quita el fondo con un relleno desde los bordes: se detiene en el contorno negro del cómic, así los
 * blancos del diseño se conservan. Después limpia el halo del antialias y busca huecos encerrados.
 */
export const removeBackground = (src: SourceImage, kind: BackgroundKind, color: [number, number, number] | null, tolerance: number): BackgroundResult => {
  const { width: w, height: h } = src;
  const total = w * h;
  if (kind === 'transparent' || kind === 'complex') {
    const mask = kind === 'transparent' ? Uint8Array.from(src.alpha) : new Uint8Array(total).fill(255);
    let removed = 0;
    for (let i = 0; i < total; i += 1) if (mask[i] < 20) removed += 1;
    return { mask, removed: removed / total, holes: [] };
  }
  const test = backgroundTest(src, kind, color, tolerance);
  const bg = floodFromBorder(w, h, test);

  // Halo: lo claro y gris pegado al fondo también es fondo (mezcla del borde con el cuadriculado).
  const halo = backgroundTest(src, kind, color, tolerance, true);
  for (let pass = 0; pass < 2; pass += 1) {
    const add: number[] = [];
    for (let i = 0; i < total; i += 1) {
      if (bg[i]) continue;
      const x = i % w;
      const touches = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (i >= w && bg[i - w]) || (i < total - w && bg[i + w]);
      if (touches && halo(i)) add.push(i);
    }
    add.forEach((i) => { bg[i] = 1; });
  }

  const mask = new Uint8Array(total);
  let removed = 0;
  for (let i = 0; i < total; i += 1) {
    if (bg[i]) removed += 1;
    else mask[i] = src.alpha[i];
  }
  return { mask, removed: removed / total, holes: kind === 'checker' ? findCheckerHoles(src, bg, test) : [] };
};

/** Tono del cuadriculado: 1 = claro, 0 = gris. */
const toneAt = (data: Uint8ClampedArray, i: number) => (lum(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) >= 232 ? 1 : 0);

/** Largo de las rachas de un mismo tono en una línea del borde (el lado de cada cuadro) y dónde empieza la primera. */
const runsOf = (tones: number[]) => {
  const runs: number[] = [];
  let first = -1;
  let start = 0;
  for (let k = 1; k <= tones.length; k += 1) {
    if (k === tones.length || tones[k] !== tones[k - 1]) {
      if (start > 0 && k < tones.length) runs.push(k - start);
      if (first < 0 && k < tones.length) first = k;
      start = k;
    }
  }
  return { size: runs.length >= 3 ? median(runs) : 0, first };
};

/**
 * La grilla del cuadriculado dibujado, medida en el borde superior e izquierdo: lado del cuadro y fase.
 * Sirve para reconocer el cuadriculado que quedó encerrado sin confundirlo con blancos y grises del diseño.
 */
const checkerGrid = (src: SourceImage) => {
  const { width: w, height: h, data } = src;
  const row = Array.from({ length: w }, (_, x) => toneAt(data, x));
  const col = Array.from({ length: h }, (_, y) => toneAt(data, y * w));
  const across = runsOf(row);
  const down = runsOf(col);
  const size = across.size || down.size;
  if (size < 4 || (across.size && down.size && Math.abs(across.size - down.size) > 2)) return null;
  const ox = across.first >= 0 ? across.first % size : 0;
  const oy = down.first >= 0 ? down.first % size : 0;
  const cell = (x: number, y: number) => (Math.floor((x - ox + size * 4) / size) + Math.floor((y - oy + size * 4) / size)) & 1;
  // Tono del cuadro (0,0) de la grilla: el que más se repite en el borde con esa paridad.
  let agree = 0;
  for (let x = 0; x < w; x += 1) if (row[x] === cell(x, 0)) agree += 1;
  const flip = agree < w / 2 ? 1 : 0;
  return { size, ox, oy, expected: (x: number, y: number) => cell(x, y) ^ flip };
};

/** Zonas de fondo que el relleno no alcanzó porque la prenda las encierra, con la grilla del cuadriculado. */
const findCheckerHoles = (src: SourceImage, bg: Uint8Array, test: (i: number) => boolean): Int32Array[] => {
  const grid = checkerGrid(src);
  if (!grid) return [];
  const { width: w, height: h, data } = src;
  const total = w * h;
  const seen = new Uint8Array(total);
  const minArea = Math.max(60, Math.round(total * 0.0004));
  const holes: Int32Array[] = [];
  const stack = new Int32Array(total);
  for (let start = 0; start < total; start += 1) {
    if (seen[start] || bg[start] || !test(start)) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    const group: number[] = [];
    let judged = 0;
    let matches = 0;
    while (top > 0) {
      const i = stack[--top];
      group.push(i);
      const x = i % w;
      const y = (i - x) / w;
      // Lejos de las líneas de la grilla (el JPG las difumina), el tono debe ser el que toca.
      const gx = (x - grid.ox + grid.size * 4) % grid.size;
      const gy = (y - grid.oy + grid.size * 4) % grid.size;
      if (gx > 1 && gx < grid.size - 2 && gy > 1 && gy < grid.size - 2) {
        judged += 1;
        if (toneAt(data, i) === grid.expected(x, y)) matches += 1;
      }
      const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < total - w ? i + w : -1];
      for (const j of next) {
        if (j >= 0 && !seen[j] && !bg[j] && test(j)) { seen[j] = 1; stack[top++] = j; }
      }
    }
    if (group.length >= minArea && judged >= 30 && matches / judged >= 0.85) holes.push(Int32Array.from(group));
  }
  return holes;
};

export const clearPixels = (mask: Uint8Array, pixels: Int32Array[]) => {
  for (const group of pixels) for (const i of group) mask[i] = 0;
};

/** Grupos de píxeles visibles (8 vecinos). */
const components = (mask: Uint8Array, w: number, h: number): Int32Array[] => {
  const total = w * h;
  const seen = new Uint8Array(total);
  const stack = new Int32Array(total);
  const groups: Int32Array[] = [];
  for (let start = 0; start < total; start += 1) {
    if (seen[start] || mask[start] <= 20) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    const group: number[] = [];
    while (top > 0) {
      const i = stack[--top];
      group.push(i);
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (!seen[j] && mask[j] > 20) { seen[j] = 1; stack[top++] = j; }
        }
      }
    }
    groups.push(Int32Array.from(group));
  }
  return groups;
};

/** Quita los restos sueltos (grupos diminutos) y cuenta las piezas grandes separadas. */
export const cleanIslands = (mask: Uint8Array, w: number, h: number): { removed: number; pieces: number } => {
  const groups = components(mask, w, h);
  const minArea = Math.max(20, Math.round(w * h * 0.00004));
  let removed = 0;
  let largest = 0;
  for (const group of groups) largest = Math.max(largest, group.length);
  let pieces = 0;
  for (const group of groups) {
    if (group.length < minArea) {
      for (const i of group) mask[i] = 0;
      removed += group.length;
    } else if (group.length >= largest * 0.15) {
      pieces += 1;
    }
  }
  return { removed, pieces };
};

export const maskBounds = (mask: Uint8Array, w: number, h: number) => {
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  for (let y = 0; y < h; y += 1) {
    const row = y * w;
    for (let x = 0; x < w; x += 1) {
      if (mask[row + x] > 20) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
};

// ==================== Ajuste al cuerpo ====================

export const pivotX = (gender: AvatarGender) => BODY_ANCHORS[gender].torsoCenterX;

/**
 * Ajuste automático. Si la imagen tiene la proporción del lienzo, la IA la dibujó sobre la plantilla:
 * basta con llevarla a 395×959. Si no, es una prenda suelta: se encaja en la zona de su ranura.
 * Los fondos cubren el recuadro.
 */
export const autoFit = (src: SourceImage, mask: Uint8Array, slot: AvatarSlot, gender: AvatarGender): { mode: FitMode; transform: Transform } => {
  if (slot === 'BACKGROUND') {
    const scale = Math.max(CANVAS_W / src.width, CANVAS_H / src.height);
    return { mode: 'cover', transform: { scale, widen: 1, dx: (CANVAS_W - src.width * scale) / 2, dy: (CANVAS_H - src.height * scale) / 2 } };
  }
  const ratio = src.width / src.height;
  const bounds = maskBounds(mask, src.width, src.height);
  if (Math.abs(ratio - CANVAS_RATIO) / CANVAS_RATIO <= 0.03 || !bounds) {
    const scale = CANVAS_H / src.height;
    return { mode: 'frame', transform: { scale, widen: 1, dx: (CANVAS_W - src.width * scale) / 2, dy: 0 } };
  }
  const box = slotBox(gender, slot);
  const bw = bounds.x1 - bounds.x0 + 1;
  const bh = bounds.y1 - bounds.y0 + 1;
  const scale = box.scaleBy === 'width' ? box.w / bw : Math.min(box.w / bw, box.h / bh);
  const dx = box.x + (box.w - bw * scale) / 2 - bounds.x0 * scale;
  const dy = box.align === 'top'
    ? box.y - bounds.y0 * scale
    : box.align === 'bottom'
      ? box.y + box.h - (bounds.y1 + 1) * scale
      : box.y + (box.h - bh * scale) / 2 - bounds.y0 * scale;
  return { mode: 'loose', transform: { scale, widen: 1, dx, dy } };
};

/** Matriz fuente → lienzo (para drawImage) y su inversa (para el pincel y la varita). */
export const toCanvasMatrix = (t: Transform, pivot: number) => ({
  a: t.scale * t.widen,
  d: t.scale,
  e: pivot + (t.dx - pivot) * t.widen,
  f: t.dy,
});

export const canvasToSource = (x: number, y: number, t: Transform, pivot: number) => {
  const m = toCanvasMatrix(t, pivot);
  return { x: (x - m.e) / m.a, y: (y - m.f) / m.d, rx: 1 / m.a, ry: 1 / m.d };
};

// ==================== Dibujo ====================

/** Fuente con la máscara aplicada, en un canvas del tamaño de la fuente. */
export const paintMasked = (canvas: HTMLCanvasElement, src: SourceImage, mask: Uint8Array) => {
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(src.width, src.height);
  image.data.set(src.data);
  for (let i = 0, p = 3; i < mask.length; i += 1, p += 4) image.data[p] = Math.min(src.alpha[i], mask[i]);
  ctx.putImageData(image, 0, 0);
};

/** La capa final de 395×959 (lo que se sube). */
export const renderLayer = (target: HTMLCanvasElement, masked: HTMLCanvasElement, t: Transform, pivot: number) => {
  target.width = CANVAS_W;
  target.height = CANVAS_H;
  const ctx = target.getContext('2d', { willReadFrequently: true })!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const m = toCanvasMatrix(t, pivot);
  ctx.setTransform(m.a, 0, 0, m.d, m.e, m.f);
  ctx.drawImage(masked, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
};

// ==================== Retoques ====================

/** Borrador (0) o restaurar (vuelve a la fuente) en una elipse de la fuente. */
export const paintBrush = (mask: Uint8Array, src: SourceImage, cx: number, cy: number, rx: number, ry: number, mode: 'erase' | 'restore') => {
  const { width: w, height: h } = src;
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(w - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(h - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y += 1) {
    const ny = (y - cy) / ry;
    for (let x = x0; x <= x1; x += 1) {
      const nx = (x - cx) / rx;
      if (nx * nx + ny * ny > 1) continue;
      const i = y * w + x;
      mask[i] = mode === 'erase' ? 0 : src.alpha[i];
    }
  }
};

/** Varita: quita la zona del mismo color que el píxel tocado (por ejemplo, el forro que se ve por el cuello). */
export const magicErase = (mask: Uint8Array, src: SourceImage, sx: number, sy: number, tolerance: number): number => {
  const { width: w, height: h, data } = src;
  const x = Math.round(sx);
  const y = Math.round(sy);
  if (x < 0 || y < 0 || x >= w || y >= h) return 0;
  const start = y * w + x;
  if (mask[start] <= 20) return 0;
  const p0 = start * 4;
  const target = [data[p0], data[p0 + 1], data[p0 + 2]];
  const total = w * h;
  const seen = new Uint8Array(total);
  const stack = new Int32Array(total);
  let top = 0;
  stack[top++] = start;
  seen[start] = 1;
  let count = 0;
  while (top > 0) {
    const i = stack[--top];
    mask[i] = 0;
    count += 1;
    const xi = i % w;
    const next = [xi > 0 ? i - 1 : -1, xi < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < total - w ? i + w : -1];
    for (const j of next) {
      if (j < 0 || seen[j] || mask[j] <= 20) continue;
      seen[j] = 1;
      const p = j * 4;
      if (Math.hypot(data[p] - target[0], data[p + 1] - target[1], data[p + 2] - target[2]) <= tolerance) stack[top++] = j;
    }
  }
  return count;
};

// ==================== Comprobaciones ====================

/** Ropa base negra del cuerpo (relleno, no el contorno): oscuro con todo su entorno de 5×5 oscuro. */
export const baseClothesMask = (base: ImageData): Uint8Array => {
  const { width: w, height: h, data } = base;
  const dark = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < dark.length; i += 1, p += 4) {
    if (data[p + 3] > 200 && lum(data[p], data[p + 1], data[p + 2]) < 60) dark[i] = 1;
  }
  const fill = new Uint8Array(w * h);
  for (let y = 2; y < h - 2; y += 1) {
    for (let x = 2; x < w - 2; x += 1) {
      const i = y * w + x;
      if (!dark[i]) continue;
      let all = true;
      for (let dy = -2; dy <= 2 && all; dy += 1) for (let dx = -2; dx <= 2 && all; dx += 1) if (!dark[i + dy * w + dx]) all = false;
      if (all) fill[i] = 1;
    }
  }
  return fill;
};

export type CheckLevel = 'ok' | 'warn';
export type CheckFix = 'fit' | 'show-base';
export interface QualityCheck {
  id: string;
  level: CheckLevel;
  text: string;
  fix?: CheckFix;
}

export interface CheckInput {
  out: ImageData;
  slot: AvatarSlot;
  gender: AvatarGender;
  kind: BackgroundKind;
  removed: number;
  holes: number;
  pieces: number;
  islandsRemoved: number;
  baseFill: Uint8Array | null;
}

/** Píxeles de la ropa base que siguen a la vista (para el aviso y para marcarlos en rojo). */
export const visibleBase = (out: ImageData, baseFill: Uint8Array, gender: AvatarGender, slot: AvatarSlot): Uint8Array | null => {
  const rows = coverRows(gender, slot);
  if (!rows) return null;
  const visible = new Uint8Array(CANVAS_W * CANVAS_H);
  for (let y = rows[0]; y <= rows[1]; y += 1) {
    for (let x = 0; x < CANVAS_W; x += 1) {
      const i = y * CANVAS_W + x;
      if (baseFill[i] && out.data[i * 4 + 3] < 128) visible[i] = 1;
    }
  }
  return visible;
};

export const runChecks = (input: CheckInput): QualityCheck[] => {
  const { out, slot, kind } = input;
  const checks: QualityCheck[] = [];
  const data = out.data;

  // Fondo.
  if (slot !== 'BACKGROUND') {
    if (kind === 'complex') {
      checks.push({ id: 'bg', level: 'warn', text: 'No reconocí el fondo: quítalo con la varita y el borrador, o sube la prenda sobre un fondo liso.' });
    } else if (input.removed < 0.08 && kind !== 'transparent') {
      checks.push({ id: 'bg', level: 'warn', text: 'Casi no se quitó fondo: revisa la tolerancia.' });
    } else {
      checks.push({ id: 'bg', level: 'ok', text: kind === 'transparent' ? 'La imagen ya traía transparencia.' : `Fondo quitado (${Math.round(input.removed * 100)} % de la imagen).` });
    }
    if (input.holes > 0) {
      checks.push({ id: 'holes', level: 'ok', text: `También quité el cuadriculado encerrado en ${input.holes === 1 ? '1 zona' : `${input.holes} zonas`} (entre brazo y cuerpo, el cuello…).` });
    }
  }

  // Restos del cuadriculado en el borde de la prenda.
  if (kind === 'checker') {
    let leftovers = 0;
    for (let y = 1; y < CANVAS_H - 1; y += 1) {
      for (let x = 1; x < CANVAS_W - 1; x += 1) {
        const p = (y * CANVAS_W + x) * 4;
        if (data[p + 3] < 200) continue;
        if (sat(data[p], data[p + 1], data[p + 2]) > 30 || lum(data[p], data[p + 1], data[p + 2]) < 185) continue;
        const near = data[p - 4 + 3] < 20 || data[p + 4 + 3] < 20 || data[p - CANVAS_W * 4 + 3] < 20 || data[p + CANVAS_W * 4 + 3] < 20;
        if (near) leftovers += 1;
      }
    }
    if (leftovers > 120) checks.push({ id: 'halo', level: 'warn', text: 'Queda un borde claro alrededor de la prenda: sube un poco la tolerancia o límpialo con el borrador.' });
  }

  if (input.pieces > 1 && slot !== 'BACKGROUND' && slot !== 'SHOES' && slot !== 'EYES') {
    checks.push({ id: 'pieces', level: 'warn', text: `Hay ${input.pieces} piezas grandes separadas: ¿la IA dibujó dos prendas? Borra la que sobra.` });
  }

  // Bordes del lienzo: una prenda que los toca suele venir cortada.
  if (slot !== 'BACKGROUND') {
    const edges: string[] = [];
    const alphaAt = (x: number, y: number) => data[(y * CANVAS_W + x) * 4 + 3];
    let left = false; let right = false; let top = false; let bottom = false;
    for (let y = 0; y < CANVAS_H; y += 1) { if (alphaAt(0, y) > 40) left = true; if (alphaAt(CANVAS_W - 1, y) > 40) right = true; }
    for (let x = 0; x < CANVAS_W; x += 1) { if (alphaAt(x, 0) > 40) top = true; if (alphaAt(x, CANVAS_H - 1) > 40) bottom = true; }
    if (left) edges.push('izquierdo');
    if (right) edges.push('derecho');
    if (top) edges.push('de arriba');
    if (bottom && slot !== 'SHOES' && slot !== 'BOTTOM') edges.push('de abajo');
    checks.push(edges.length
      ? { id: 'edges', level: 'warn', text: `Toca el borde ${edges.join(' y ')}: puede estar cortada.`, fix: 'fit' }
      : { id: 'edges', level: 'ok', text: 'Entra completa en el lienzo.' });
  }

  // Ropa base negra a la vista.
  if (input.baseFill && (slot === 'TOP' || slot === 'BOTTOM')) {
    const visible = visibleBase(out, input.baseFill, input.gender, slot);
    let n = 0;
    if (visible) for (let i = 0; i < visible.length; i += 1) n += visible[i];
    checks.push(n > 150
      ? { id: 'base', level: 'warn', text: `Se ve la ropa base negra (${n} px): la prenda no tapa todo el ${slot === 'TOP' ? 'torso o los brazos' : 'short'}.`, fix: 'show-base' }
      : { id: 'base', level: 'ok', text: 'Tapa la ropa base del cuerpo.' });
  }

  if (input.islandsRemoved > 0) checks.push({ id: 'islands', level: 'ok', text: `Se quitaron ${input.islandsRemoved} píxeles sueltos.` });
  return checks;
};

/** Miniatura como la de la tarjeta (la prenda recortada a su contenido, en 192 px). */
export const renderThumb = (target: HTMLCanvasElement, layer: HTMLCanvasElement) => {
  const ctx = layer.getContext('2d', { willReadFrequently: true })!;
  const { data } = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
  const alpha = new Uint8Array(CANVAS_W * CANVAS_H);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = data[i * 4 + 3];
  const bounds = maskBounds(alpha, CANVAS_W, CANVAS_H);
  target.width = 192;
  target.height = 192;
  const out = target.getContext('2d')!;
  out.clearRect(0, 0, 192, 192);
  if (!bounds) return;
  const bw = bounds.x1 - bounds.x0 + 1;
  const bh = bounds.y1 - bounds.y0 + 1;
  const scale = Math.min(192 / bw, 192 / bh, 1);
  out.imageSmoothingQuality = 'high';
  out.drawImage(layer, bounds.x0, bounds.y0, bw, bh, (192 - bw * scale) / 2, (192 - bh * scale) / 2, bw * scale, bh * scale);
};
