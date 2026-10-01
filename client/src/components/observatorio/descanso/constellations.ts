// Constelaciones reales para el Descanso de Jiro. Coordenadas aproximadas en un lienzo de 100 × 70;
// las estrellas se encienden en el orden del arreglo y cada línea aparece cuando sus dos extremos
// ya brillan. `small` = 5 estrellas (modo corto de inicial).

export interface Constellation {
  id: string;
  name: string;
  /** Dato breve que Jiro cuenta al completarla. */
  fact: string;
  stars: { x: number; y: number; r?: number }[];
  lines: [number, number][];
  small?: boolean;
}

export const CONSTELLATIONS: Constellation[] = [
  {
    id: 'cruz-del-sur',
    name: 'Cruz del Sur',
    fact: 'Desde el Perú se ve todo el año y ayuda a encontrar el sur.',
    small: true,
    stars: [{ x: 50, y: 8, r: 2.2 }, { x: 52, y: 62, r: 2.8 }, { x: 30, y: 32, r: 2.4 }, { x: 70, y: 28, r: 1.8 }, { x: 62, y: 44, r: 1.4 }],
    lines: [[0, 1], [2, 3]],
  },
  {
    id: 'casiopea',
    name: 'Casiopea',
    fact: 'Sus cinco estrellas forman una W en el cielo del norte.',
    small: true,
    stars: [{ x: 12, y: 28, r: 2 }, { x: 30, y: 50, r: 2.2 }, { x: 48, y: 34, r: 2.4 }, { x: 66, y: 54, r: 2 }, { x: 86, y: 26, r: 2 }],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    id: 'lira',
    name: 'Lira',
    fact: 'Vega, su estrella más brillante, fue la estrella polar hace 12 000 años.',
    small: true,
    stars: [{ x: 50, y: 8, r: 3 }, { x: 40, y: 32, r: 1.8 }, { x: 60, y: 34, r: 1.8 }, { x: 38, y: 60, r: 1.8 }, { x: 58, y: 62, r: 1.8 }],
    lines: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4]],
  },
  {
    id: 'osa-mayor',
    name: 'Osa Mayor',
    fact: 'Sus siete estrellas forman "el Carro", que señala hacia la estrella polar.',
    stars: [{ x: 80, y: 16, r: 2.4 }, { x: 82, y: 32, r: 2.2 }, { x: 62, y: 38, r: 2 }, { x: 58, y: 24, r: 1.6 }, { x: 44, y: 22, r: 2.2 }, { x: 30, y: 26, r: 2.2 }, { x: 14, y: 38, r: 2.2 }],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
  },
  {
    id: 'cisne',
    name: 'Cisne',
    fact: 'También la llaman la Cruz del Norte: un cisne que vuela por la Vía Láctea.',
    stars: [{ x: 50, y: 6, r: 2.8 }, { x: 50, y: 34, r: 2.2 }, { x: 18, y: 28, r: 1.8 }, { x: 82, y: 42, r: 1.8 }, { x: 50, y: 50, r: 1.6 }, { x: 50, y: 66, r: 2 }],
    lines: [[0, 1], [2, 1], [1, 3], [1, 4], [4, 5]],
  },
  {
    id: 'orion',
    name: 'Orión',
    fact: 'Las tres estrellas de su cinturón son las "Tres Marías".',
    stars: [
      { x: 32, y: 16, r: 2.8 }, { x: 66, y: 20, r: 2.2 }, { x: 48, y: 6, r: 1.4 }, { x: 42, y: 42, r: 1.8 },
      { x: 50, y: 40, r: 1.8 }, { x: 58, y: 38, r: 1.8 }, { x: 36, y: 64, r: 2 }, { x: 70, y: 62, r: 2.8 },
    ],
    lines: [[2, 0], [2, 1], [0, 3], [1, 5], [3, 4], [4, 5], [3, 6], [5, 7]],
  },
  {
    id: 'leo',
    name: 'Leo',
    fact: 'Su estrella Régulo marca el corazón del león.',
    stars: [
      { x: 64, y: 58, r: 2.6 }, { x: 64, y: 44, r: 1.8 }, { x: 70, y: 32, r: 2 }, { x: 80, y: 26, r: 1.6 },
      { x: 76, y: 14, r: 1.6 }, { x: 52, y: 34, r: 1.8 }, { x: 30, y: 36, r: 1.8 }, { x: 14, y: 48, r: 2.2 }, { x: 32, y: 52, r: 1.6 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [6, 7], [7, 8], [8, 0]],
  },
  {
    id: 'escorpio',
    name: 'Escorpio',
    fact: 'Antares, su corazón rojo, es tan grande que cabrían millones de soles.',
    stars: [
      { x: 18, y: 8, r: 1.6 }, { x: 26, y: 16, r: 1.8 }, { x: 20, y: 28, r: 1.6 }, { x: 38, y: 30, r: 2.8 }, { x: 44, y: 40, r: 1.6 },
      { x: 48, y: 52, r: 1.6 }, { x: 56, y: 60, r: 1.6 }, { x: 68, y: 64, r: 1.8 }, { x: 80, y: 58, r: 1.8 }, { x: 84, y: 46, r: 2 },
    ],
    lines: [[0, 1], [2, 1], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]],
  },
];

export const constellationById = (id: string | null | undefined) => CONSTELLATIONS.find((c) => c.id === id) ?? null;
