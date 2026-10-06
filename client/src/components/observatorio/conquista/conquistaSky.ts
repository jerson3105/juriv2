import { safeHex } from '../../../lib/storyTheme';
import { CONSTELLATIONS, constellationById, type Constellation } from '../descanso/constellations';
import { REGION_CONSTELLATIONS, regionTotal, type Region } from './conquistaLogic';

// Cielo de cada región: su constelación real (una estrella por acierto, en su orden) y, si la meta pide
// más estrellas que la constelación, estrellas de relleno alrededor. La Niebla son nubes que se retiran
// a medida que la región se aclara. Todo sale de semillas fijas: el mismo cielo al reanudar la partida.

export interface SkyStar {
  x: number;
  y: number;
  r: number;
}

export interface RegionSkyShape {
  constellation: Constellation;
  /** Primero las de la constelación (en su orden) y después las de relleno. */
  stars: SkyStar[];
}

export interface FogBlob {
  /** Posición y tamaño en % del recuadro. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Orden en que se retira (0 = la primera). */
  order: number;
  /** Hacia dónde sale al retirarse (% de su propio tamaño). */
  dx: number;
  dy: number;
  /** Nube de abajo: resplandor cálido, como en la portada. */
  warm: boolean;
}

/** Generador con semilla (mulberry32): reparto estable entre renders y al reanudar. */
const seeded = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Índice de la región (r0…r5): fija su constelación y su niebla. */
export const regionIndex = (region: Pick<Region, 'id'>) => Number(region.id.replace(/\D/g, '')) || 0;

export const regionConstellation = (index: number): Constellation =>
  constellationById(REGION_CONSTELLATIONS[index % REGION_CONSTELLATIONS.length]) ?? CONSTELLATIONS[0];

const skyCache = new Map<string, RegionSkyShape>();

export const regionSky = (index: number, goal: number): RegionSkyShape => {
  const key = `${index}:${goal}`;
  const cached = skyCache.get(key);
  if (cached) return cached;
  const constellation = regionConstellation(index);
  const stars: SkyStar[] = constellation.stars.map((s) => ({ x: s.x, y: s.y, r: s.r ?? 2 }));
  const rand = seeded(index * 7919 + goal * 104729 + 17);
  for (let tries = 0; stars.length < goal && tries < 400; tries += 1) {
    const x = 8 + rand() * 84;
    const y = 6 + rand() * 58;
    if (stars.every((s) => Math.hypot(s.x - x, s.y - y) >= 9)) stars.push({ x, y, r: 1.2 + rand() * 0.5 });
  }
  const shape = { constellation, stars };
  skyCache.set(key, shape);
  return shape;
};

/** Estrellas encendidas: una por estrella de la región; al despejarse, la constelación se completa. */
export const litCount = (region: Region, slots: number) => (region.cleared ? slots : Math.min(regionTotal(region), slots));

const blobCache = new Map<string, FogBlob[]>();

export const fogBlobs = (index: number, goal: number): FogBlob[] => {
  const n = Math.min(10, Math.max(5, goal));
  const key = `${index}:${n}`;
  const cached = blobCache.get(key);
  if (cached) return cached;
  const rand = seeded(index * 31337 + n * 7 + 3);
  const cols = Math.ceil(Math.sqrt(n * 1.8));
  const rows = Math.ceil(n / cols);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const blobs = Array.from({ length: n }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const width = (100 / cols) * (1.9 + rand() * 0.5);
    const height = (100 / rows) * (1.5 + rand() * 0.4);
    const cx = ((col + 0.5) / cols) * 100 + (rand() - 0.5) * (40 / cols);
    const cy = ((row + 0.5) / rows) * 100 + (rand() - 0.5) * (30 / rows);
    return {
      left: cx - width / 2,
      top: cy - height / 2,
      width,
      height,
      order: order[i],
      dx: (cx < 50 ? -1 : 1) * (55 + rand() * 30),
      dy: (rand() - 0.5) * 30,
      warm: row === rows - 1,
    };
  });
  blobCache.set(key, blobs);
  return blobs;
};

const progressOf = (region: Region) => Math.min(1, regionTotal(region) / region.goal);

/** Nubes que siguen en el cielo: menos con cada acierto, ninguna al despejarse. */
export const visibleBlobCount = (region: Region, blobs: number) => (region.cleared ? 0 : Math.round(blobs * (1 - progressOf(region))));

/** Velo general de la Niebla (opacidad): denso al empezar, se aclara con cada estrella. */
export const veilOpacity = (region: Region) => (region.cleared ? 0 : 0.1 + 0.4 * (1 - progressOf(region)));

/** Color del equipo para un degradado: solo #RRGGBB (los clanes vienen de la base de datos). */
export const teamHex = (color: unknown) => safeHex(color, '#6366f1');
