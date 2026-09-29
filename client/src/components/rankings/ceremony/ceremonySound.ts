// Sonidos de la gala generados con Web Audio (sin archivos): tic, redoble, golpe de platillo y fanfarria.
// El AudioContext se crea en el primer gesto del profesor (botón "Comenzar").

const MUTE_KEY = 'rankings-ceremony-muted';

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

export interface CeremonySound {
  unlock: () => void;
  setMuted: (muted: boolean) => void;
  tick: () => void;
  whoosh: () => void;
  drumroll: (seconds: number) => void;
  hit: () => void;
  fanfare: () => void;
  stopAll: () => void;
  close: () => void;
}

export const createCeremonySound = (initiallyMuted: boolean): CeremonySound => {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let muted = initiallyMuted;
  const live = new Set<AudioScheduledSourceNode>();

  const audio = () => {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.8;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  };

  const track = (node: AudioScheduledSourceNode) => {
    live.add(node);
    node.onended = () => live.delete(node);
  };

  const tone = (freq: number, at: number, dur: number, type: OscillatorType, peak: number, filterHz?: number) => {
    const c = audio();
    if (!c || !master || muted) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let out: AudioNode = gain;
    if (filterHz) {
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterHz;
      gain.connect(filter);
      out = filter;
    }
    osc.connect(gain);
    out.connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
    track(osc);
  };

  const burst = (at: number, dur: number, peak: number, type: BiquadFilterType, hz: number) => {
    const c = audio();
    if (!c || !master || !noise || muted) return;
    const src = c.createBufferSource();
    src.buffer = noise;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = hz;
    const gain = c.createGain();
    gain.gain.setValueAtTime(peak, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(at, Math.random() * 0.5, dur + 0.05);
    track(src);
  };

  return {
    unlock: () => {
      audio();
    },
    setMuted: (value) => {
      muted = value;
      if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.8, ctx.currentTime, 0.02);
      if (value) live.forEach((n) => { try { n.stop(); } catch { /* ya detenido */ } });
    },
    tick: () => {
      const c = audio();
      if (c) tone(1046, c.currentTime, 0.08, 'triangle', 0.18);
    },
    whoosh: () => {
      const c = audio();
      if (c) burst(c.currentTime, 0.35, 0.25, 'bandpass', 1200);
    },
    // Redoble de caja: golpes de ruido cada vez más seguidos y fuertes.
    drumroll: (seconds) => {
      const c = audio();
      if (!c) return;
      const start = c.currentTime;
      let t = 0;
      while (t < seconds) {
        const progress = t / seconds;
        burst(start + t, 0.06, 0.12 + progress * 0.35, 'bandpass', 1900);
        t += 0.055 - progress * 0.02;
      }
    },
    // Golpe final: bombo grave + platillo que se apaga.
    hit: () => {
      const c = audio();
      if (!c) return;
      const at = c.currentTime;
      tone(70, at, 0.5, 'sine', 0.9);
      burst(at, 1.4, 0.45, 'highpass', 5000);
    },
    // Fanfarria de metales: arpegio Do-Mi-Sol-Do y acorde sostenido.
    fanfare: () => {
      const c = audio();
      if (!c) return;
      const at = c.currentTime + 0.05;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, at + i * 0.14, 0.32, 'sawtooth', 0.16, 2400));
      [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, at + 0.62, 1.5, 'sawtooth', 0.12, 2000));
      tone(130.81, at + 0.62, 1.5, 'triangle', 0.25);
    },
    stopAll: () => {
      live.forEach((n) => { try { n.stop(); } catch { /* ya detenido */ } });
      live.clear();
    },
    close: () => {
      live.clear();
      if (ctx) void ctx.close();
      ctx = null;
    },
  };
};
