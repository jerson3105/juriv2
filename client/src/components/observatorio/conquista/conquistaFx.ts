import type { Options } from 'canvas-confetti';

// Confeti de estrellas para Conquista (carga diferida, como las celebraciones). zIndex 185: encima del
// escenario (z-180). Con «reducir movimiento» canvas-confetti no dibuja nada.

const STAR_COLORS = ['#fef3c7', '#fde68a', '#fcd34d', '#fbbf24'];

const fire = (options: Options) => {
  void import('canvas-confetti').then(({ default: confetti }) => confetti({
    zIndex: 185,
    disableForReducedMotion: true,
    shapes: ['star'],
    colors: STAR_COLORS,
    ...options,
  }));
};

/** Lluvia de estrellas: cae desde arriba en tres puntos (≤ 75 partículas). */
export const starRain = () => {
  [0.2, 0.5, 0.8].forEach((x, i) => window.setTimeout(() => fire({
    particleCount: 25,
    angle: 270,
    spread: 80,
    startVelocity: 14,
    gravity: 0.75,
    ticks: 280,
    scalar: 1.4,
    drift: (x - 0.5) * 0.6,
    origin: { x, y: -0.05 },
  }), i * 170));
};

/** Estallido breve de estrellas desde el centro del escenario (una región conquistada). */
export const starBurst = () => fire({
  particleCount: 40,
  spread: 100,
  startVelocity: 30,
  ticks: 140,
  scalar: 1.1,
  origin: { x: window.innerWidth >= 768 ? 0.61 : 0.5, y: 0.45 },
});
