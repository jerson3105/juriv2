import { useCallback, useEffect, useMemo, useState } from 'react';

// Sonidos suaves del Observatorio con Web Audio (sin archivos): campanita, estrella, logro y tic.
// El AudioContext se crea en el primer gesto del profesor; la tecla M silencia (se recuerda).

const MUTE_KEY = 'observatorio-muted';

export const readMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

export const saveMuted = (muted: boolean) => {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Sin almacenamiento (modo privado): el silencio dura solo esta sesión.
  }
};

export interface StageSound {
  unlock: () => void;
  setMuted: (muted: boolean) => void;
  /** Toque corto y agudo (selección, turno). */
  tick: () => void;
  /** Una estrella que se enciende; `step` sube el tono en una racha. */
  star: (step?: number) => void;
  /** Acorde breve de logro. */
  success: () => void;
  /** Dos notas descendentes, sin dramatismo (fallo o pausa). */
  soft: () => void;
  close: () => void;
}

// Escala pentatónica: cualquier secuencia de estrellas suena bien.
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

export const createStageSound = (initiallyMuted: boolean): StageSound => {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = initiallyMuted;

  const audio = () => {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  };

  const tone = (freq: number, delay: number, dur: number, peak: number, type: OscillatorType = 'sine') => {
    const c = audio();
    if (!c || !master || muted) return;
    const at = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  };

  return {
    unlock: () => {
      audio();
    },
    setMuted: (value) => {
      muted = value;
      if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.5, ctx.currentTime, 0.02);
    },
    tick: () => tone(1046.5, 0, 0.07, 0.12, 'triangle'),
    star: (step = 0) => {
      const freq = PENTATONIC[Math.max(0, step) % PENTATONIC.length];
      tone(freq, 0, 0.5, 0.2);
      tone(freq * 2, 0.02, 0.35, 0.05);
    },
    success: () => {
      [523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.09, 0.45, 0.16));
      tone(1046.5, 0.3, 0.9, 0.14);
    },
    soft: () => {
      tone(392, 0, 0.25, 0.1, 'triangle');
      tone(329.63, 0.16, 0.35, 0.08, 'triangle');
    },
    close: () => {
      if (ctx) void ctx.close();
      ctx = null;
    },
  };
};

export interface StageSoundState {
  sound: StageSound;
  muted: boolean;
  toggleMute: () => void;
}

/** Sonido del escenario con el silencio recordado (M). La actividad lo crea y lo pasa al escenario. */
export const useStageSound = (): StageSoundState => {
  const [muted, setMuted] = useState(readMuted);
  const sound = useMemo(() => createStageSound(readMuted()), []);
  useEffect(() => () => sound.close(), [sound]);
  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    sound.setMuted(next);
    saveMuted(next);
  }, [muted, sound]);
  return { sound, muted, toggleMute };
};
