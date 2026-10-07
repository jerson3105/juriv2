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
  /** Ráfaga de aire (ruido filtrado): viento, paso de escena. */
  whoosh: () => void;
  /** Campanilla brillante: aparece una carta. */
  chime: () => void;
  /** Arpegio que sube y acorde largo: una región conquistada o el cielo despejado. */
  conquer: () => void;
  /** Caja de música: la primera frase de «Estrellita, ¿dónde estás?» (dominio público), para la bienvenida. */
  lullaby: () => void;
  /** Marimba alegre con palmas (Do Mi Sol Mi La Sol Mi Sol y acorde), para la bienvenida de las actividades con movimiento. */
  marimba: () => void;
  /** De misterio a aventura: viento y nota grave (la Niebla), redoble, arpegio de metales y acorde (Conquista). */
  aventura: () => void;
  close: () => void;
}

// Escala pentatónica: cualquier secuencia de estrellas suena bien.
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

export const createStageSound = (initiallyMuted: boolean): StageSound => {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
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

  // Ruido blanco filtrado (una vez por contexto): la ráfaga sube y baja de volumen.
  const air = (delay: number, dur: number, peak: number, hz: number) => {
    const c = audio();
    if (!c || !master || muted) return;
    if (!noise) {
      noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    const at = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = noise;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(hz * 0.6, at);
    filter.frequency.exponentialRampToValueAtTime(hz * 1.4, at + dur);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + dur * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(at, 0, dur + 0.05);
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
    whoosh: () => air(0, 0.55, 0.22, 900),
    chime: () => {
      [1318.51, 1567.98, 2093].forEach((f, i) => tone(f, i * 0.07, 0.5, 0.07, 'triangle'));
      tone(2637, 0.21, 0.7, 0.03);
    },
    conquer: () => {
      [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => tone(f, i * 0.08, 0.5, 0.13));
      [523.25, 783.99, 1046.5].forEach((f) => tone(f, 0.42, 1.3, 0.09));
      tone(261.63, 0.42, 1.3, 0.1, 'triangle');
    },
    lullaby: () => {
      // Do Do Sol Sol La La Sol: campanitas (fundamental larga + octava breve).
      [523.25, 523.25, 783.99, 783.99, 880, 880, 783.99].forEach((f, i) => {
        const at = 0.35 + i * 0.5;
        tone(f, at, i === 6 ? 2 : 1.3, 0.09);
        tone(f * 2, at, 0.5, 0.025);
      });
    },
    marimba: () => {
      // Golpe corto (fundamental) + parcial brillante (×4), como una tecla de madera; palmas en el contratiempo.
      const strike = (f: number, at: number, dur = 0.4) => {
        tone(f, at, dur, 0.12);
        tone(f * 4, at, 0.07, 0.02);
      };
      [523.25, 659.25, 783.99, 659.25, 880, 783.99, 659.25, 783.99].forEach((f, i) => strike(f, 0.3 + i * 0.25));
      [0.55, 1.05, 1.55, 2.05].forEach((at) => air(at, 0.1, 0.12, 1800));
      [523.25, 659.25, 783.99, 1046.5].forEach((f) => strike(f, 2.4, 1.2));
    },
    aventura: () => {
      air(0, 1.6, 0.1, 500);
      tone(220, 0.05, 1.5, 0.06);
      tone(330, 0.05, 1.5, 0.02, 'triangle');
      // Tambor: golpe grave y corto con un poco de parche.
      [1.3, 1.42, 1.54, 1.66, 1.78].forEach((at) => {
        tone(110, at, 0.22, 0.14);
        air(at, 0.07, 0.05, 260);
      });
      // Metales: triángulo con un poco de sierra para el brillo.
      const brass = (f: number, at: number, dur: number, peak: number) => {
        tone(f, at, dur, peak, 'triangle');
        tone(f, at, dur * 0.8, peak * 0.12, 'sawtooth');
      };
      [392, 523.25, 659.25, 783.99].forEach((f, i) => brass(f, 1.95 + i * 0.15, 0.3, 0.1));
      [523.25, 659.25, 783.99, 1046.5].forEach((f) => brass(f, 2.55, 1.8, 0.06));
      tone(110, 2.55, 0.3, 0.16);
    },
    close: () => {
      if (ctx) void ctx.close();
      ctx = null;
      noise = null;
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
