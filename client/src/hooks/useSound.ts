import { useCallback, useRef } from 'react';

// Lazy-init a single shared AudioContext (resumes on first user gesture)
let _ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

/** Play a single tone. Returns the oscillator so it can be stopped externally. */
function tone(
  ctx: AudioContext,
  freq: number,
  type: OscillatorType,
  start: number,
  duration: number,
  volume = 0.15,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

// ─── Sound definitions ──────────────────────────────────────────────

/** Positive points: bright ascending "ding-ding" */
function playPointsGain() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Two quick ascending tones — cheerful RPG reward feel
  tone(ctx, 880, 'sine', t, 0.12, 0.18);         // A5
  tone(ctx, 1108.73, 'sine', t + 0.1, 0.18, 0.15); // C#6
  tone(ctx, 1318.51, 'sine', t + 0.2, 0.25, 0.12); // E6
  // Soft shimmer overtone
  tone(ctx, 2637, 'sine', t + 0.2, 0.3, 0.04);
}

/** Negative points: descending low tone */
function playPointsLoss() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  tone(ctx, 440, 'triangle', t, 0.15, 0.14);
  tone(ctx, 330, 'triangle', t + 0.12, 0.2, 0.12);
  tone(ctx, 220, 'triangle', t + 0.24, 0.35, 0.10);
}

/** Level up: triumphant fanfare arpeggio (C major → high C) */
function playLevelUp() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Rising arpeggio: C5 → E5 → G5 → C6
  tone(ctx, 523.25, 'sine', t, 0.15, 0.16);          // C5
  tone(ctx, 659.25, 'sine', t + 0.12, 0.15, 0.16);   // E5
  tone(ctx, 783.99, 'sine', t + 0.24, 0.15, 0.16);   // G5
  tone(ctx, 1046.50, 'sine', t + 0.36, 0.35, 0.18);  // C6 (hold longer)
  // Bright shimmer chord at the end
  tone(ctx, 1318.51, 'sine', t + 0.36, 0.4, 0.06);   // E6 subtle
  tone(ctx, 1567.98, 'sine', t + 0.36, 0.4, 0.04);   // G6 very subtle
  // Sub bass thump for impact
  tone(ctx, 130.81, 'sine', t + 0.36, 0.2, 0.12);    // C3
}

/** Badge awarded: magical chime with sparkle (G major) */
function playBadge() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Sparkling chime: G5 → B5 → D6 → G6
  tone(ctx, 783.99, 'sine', t, 0.12, 0.14);           // G5
  tone(ctx, 987.77, 'sine', t + 0.08, 0.12, 0.14);   // B5
  tone(ctx, 1174.66, 'sine', t + 0.16, 0.12, 0.14);  // D6
  tone(ctx, 1567.98, 'sine', t + 0.24, 0.4, 0.16);   // G6 (hold)
  // Shimmer overtones
  tone(ctx, 2349.32, 'sine', t + 0.24, 0.35, 0.04);  // D7 sparkle
  tone(ctx, 3135.96, 'sine', t + 0.28, 0.3, 0.03);   // G7 sparkle
  // Warm base
  tone(ctx, 196.00, 'sine', t + 0.24, 0.25, 0.08);   // G3
}

// ─── Public hook ─────────────────────────────────────────────────────

const SOUNDS = {
  pointsGain: playPointsGain,
  pointsLoss: playPointsLoss,
  levelUp: playLevelUp,
  badge: playBadge,
} as const;

export type SoundName = keyof typeof SOUNDS;

/**
 * Lightweight hook that exposes a `play(soundName)` function.
 * Uses the Web Audio API — no external audio files needed.
 * Sounds are short synthesized tones that respect browser autoplay rules.
 */
export function useSound() {
  // Guard against rapid repeated calls of the SAME sound (debounce 80ms per sound)
  const lastPlay = useRef<Record<string, number>>({});

  const play = useCallback((name: SoundName) => {
    const now = performance.now();
    if (now - (lastPlay.current[name] || 0) < 80) return;
    lastPlay.current[name] = now;
    try {
      SOUNDS[name]();
    } catch {
      // AudioContext not available — silent fallback
    }
  }, []);

  return { play };
}
