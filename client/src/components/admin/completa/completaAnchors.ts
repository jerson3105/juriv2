import type { AvatarGender, AvatarSlot } from '../../../lib/avatarApi';

/** Lienzo de toda capa del avatar. */
export const CANVAS_W = 395;
export const CANVAS_H = 959;
export const CANVAS_RATIO = CANVAS_W / CANVAS_H;

/**
 * Anclas medidas sobre client/public/avatars/base/{male,female}.png (perfil por filas, 2026-10-03).
 * La Chica está unos 9–10 px más abajo y más a la derecha, con hombros ~11 % más angostos. Los dos
 * cuerpos miran un poco a la derecha: el centro del torso no es el de la cabeza.
 */
export const BODY_ANCHORS: Record<AvatarGender, {
  torsoCenterX: number;
  neckY: number;
  waistY: number;
  crotchY: number;
  soleY: number;
}> = {
  MALE: { torsoCenterX: 212, neckY: 177, waistY: 420, crotchY: 647, soleY: 944 },
  FEMALE: { torsoCenterX: 222, neckY: 186, waistY: 410, crotchY: 656, soleY: 954 },
};

/**
 * Dónde va una prenda «suelta» (foto de producto, no dibujada sobre la plantilla): caja en el lienzo,
 * cómo se escala (por ancho o para caber) y cómo se alinea. Sale de las medianas de las capas existentes
 * por ranura y cuerpo; las ranuras sin prendas (Sombreros) usan la cabeza medida.
 */
export interface SlotBox {
  x: number;
  y: number;
  w: number;
  h: number;
  /** width = el ancho manda (poleras, pantalones, zapatos, pelo); contain = cabe entera en la caja. */
  scaleBy: 'width' | 'contain';
  align: 'top' | 'bottom' | 'center';
}

const MALE_BOXES: Record<Exclude<AvatarSlot, 'BACKGROUND'>, SlotBox> = {
  TOP: { x: 83, y: 172, w: 262, h: 283, scaleBy: 'width', align: 'top' },
  BOTTOM: { x: 117, y: 421, w: 201, h: 252, scaleBy: 'width', align: 'top' },
  SHOES: { x: 91, y: 837, w: 227, h: 117, scaleBy: 'width', align: 'bottom' },
  HAIR: { x: 169, y: 11, w: 137, h: 178, scaleBy: 'width', align: 'top' },
  HEAD: { x: 165, y: 0, w: 150, h: 95, scaleBy: 'width', align: 'bottom' },
  EYES: { x: 227, y: 88, w: 65, h: 33, scaleBy: 'width', align: 'center' },
  // La mano izquierda del personaje queda a la DERECHA de la imagen.
  LEFT_HAND: { x: 294, y: 410, w: 120, h: 200, scaleBy: 'contain', align: 'center' },
  RIGHT_HAND: { x: 46, y: 423, w: 120, h: 200, scaleBy: 'contain', align: 'center' },
  BACK: { x: 46, y: 140, w: 311, h: 420, scaleBy: 'contain', align: 'center' },
  FLAG: { x: 0, y: 0, w: 395, h: 600, scaleBy: 'contain', align: 'top' },
};

const FEMALE_BOXES: Record<Exclude<AvatarSlot, 'BACKGROUND'>, SlotBox> = {
  TOP: { x: 109, y: 183, w: 228, h: 278, scaleBy: 'width', align: 'top' },
  BOTTOM: { x: 124, y: 414, w: 205, h: 408, scaleBy: 'width', align: 'top' },
  SHOES: { x: 94, y: 850, w: 212, h: 109, scaleBy: 'width', align: 'bottom' },
  HAIR: { x: 157, y: 10, w: 189, h: 283, scaleBy: 'width', align: 'top' },
  HEAD: { x: 173, y: 9, w: 150, h: 95, scaleBy: 'width', align: 'bottom' },
  EYES: { x: 229, y: 97, w: 74, h: 31, scaleBy: 'width', align: 'center' },
  LEFT_HAND: { x: 300, y: 420, w: 120, h: 200, scaleBy: 'contain', align: 'center' },
  RIGHT_HAND: { x: 52, y: 430, w: 120, h: 200, scaleBy: 'contain', align: 'center' },
  BACK: { x: 56, y: 150, w: 311, h: 420, scaleBy: 'contain', align: 'center' },
  FLAG: { x: 0, y: 9, w: 395, h: 600, scaleBy: 'contain', align: 'top' },
};

export const slotBox = (gender: AvatarGender, slot: Exclude<AvatarSlot, 'BACKGROUND'>): SlotBox =>
  (gender === 'MALE' ? MALE_BOXES : FEMALE_BOXES)[slot];

/**
 * Filas donde la ropa base negra del cuerpo NO debería verse con esta prenda puesta (Parte de arriba:
 * del cuello a la cintura; Parte de abajo: de la cintura a medio muslo). Es lo que el dueño vio como
 * «se ve solo superpuesto».
 */
export const coverRows = (gender: AvatarGender, slot: AvatarSlot): [number, number] | null => {
  const a = BODY_ANCHORS[gender];
  if (slot === 'TOP') return [a.neckY + 22, a.waistY - 8];
  if (slot === 'BOTTOM') return [a.waistY + 6, a.crotchY - 10];
  return null;
};
