// Orden de las capas del personaje (de abajo hacia arriba). Negativo: detrás del personaje base
// (zIndex 10); positivo: delante. Lo usan AvatarRenderer y el espejo animado de «Mi personaje».
export const LAYER_ORDER: Record<string, number> = {
  BACKGROUND: -10, // Fondo (lo más atrás de todo)
  FLAG: -2,     // Bandera (muy atrás)
  BACK: -1,     // Accesorios de espalda (detrás del personaje)
  SHOES: 1,     // Zapatos
  BOTTOM: 2,    // Parte inferior
  TOP: 3,       // Parte superior
  LEFT_HAND: 4, // Mano izquierda
  RIGHT_HAND: 5,// Mano derecha
  EYES: 6,      // Ojos
  HEAD: 7,      // Cabeza
  HAIR: 8,      // Pelo (encima de todo)
};

/** zIndex del personaje base. */
export const BASE_Z_INDEX = 10;

/** Orden de una capa: el propio de la prenda o el de su ranura. */
export const layerOrderOf = (item: { slot: string; layerOrder?: number }) => item.layerOrder ?? LAYER_ORDER[item.slot] ?? 0;
