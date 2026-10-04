/*
 * Motor de los tutoriales animados de Juried (un archivo HTML por tutorial, sin dependencias).
 *
 * - Escenario fijo de 1920×1080 que se escala a la ventana.
 * - Línea de tiempo determinista: renderAt(t) deja la escena exactamente como debe verse en el segundo t
 *   (sirve para reproducir, adelantar y, si algún día se exporta a MP4, para capturar cuadro por cuadro).
 * - Pistas: key() (opacidad, posición, escala, giro, ancho), type() (texto que se escribe), count() (números),
 *   cue() (sonidos suaves sintetizados con WebAudio, solo al reproducir).
 * - Reproductor: botón grande de inicio, barra con capítulos, tiempo, sonido, pantalla completa y teclado
 *   (espacio, ← →, M, F).
 */
(() => {
  const W = 1920;
  const H = 1080;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const EASE = {
    linear: (k) => k,
    in: (k) => k * k * k,
    out: (k) => 1 - Math.pow(1 - k, 3),
    inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    back: (k) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
    pop: (k) => { const c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  };
  const DEFAULTS = { o: 1, x: 0, y: 0, s: 1, r: 0 };
  const $ = (selector) => {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) throw new Error(`No existe ${selector}`);
    return el;
  };

  const tracks = [];
  const typers = [];
  const counters = [];
  const cues = [];
  const chapters = [];
  const hooks = [];
  let duration = 60;

  /** key(el, [[t, {o, x, y, s, r, w}], ...], ease): los valores que faltan se arrastran del cuadro anterior. */
  const key = (selector, frames, ease = 'inOut') => {
    const el = $(selector);
    const resolved = [];
    let carry = { ...DEFAULTS };
    for (const [t, props] of frames) {
      carry = { ...carry, ...props };
      resolved.push({ t, ...carry, ease: props.ease ?? ease });
    }
    tracks.push({ el, frames: resolved, usesWidth: resolved.some((f) => f.w !== undefined) });
  };
  /** Aparece (y se va) con un fundido y un leve desplazamiento. */
  const show = (selector, t0, t1, { from = { y: 24 }, to = { y: -12 }, fade = 0.45, ease = 'out' } = {}) => {
    const frames = [[t0, { o: 0, ...from }], [t0 + fade, { o: 1, x: 0, y: 0, s: 1, r: 0, ease }]];
    if (t1 !== null && t1 !== undefined) frames.push([t1 - fade, { o: 1 }], [t1, { o: 0, ...to, ease: 'in' }]);
    key(selector, frames, ease);
  };
  /** Texto que se escribe letra por letra entre t0 y t1. */
  const type = (selector, t0, t1, text) => typers.push({ el: $(selector), t0, t1, text });
  /** Número que cuenta de «from» a «to» entre t0 y t1. */
  const count = (selector, t0, t1, from, to, format = (v) => String(Math.round(v))) => counters.push({ el: $(selector), t0, t1, from, to, format });
  /** Sonido suave en el segundo t (pop, chime, whoosh, click, coin, levelup, type). */
  const cue = (t, sound) => cues.push({ t, sound });
  /** Capítulo en la barra de progreso. */
  const chapter = (t, title) => chapters.push({ t, title });
  /** Función propia que corre en cada cuadro con el segundo t (p. ej. estrellas que titilan). */
  const every = (fn) => hooks.push(fn);

  const applyTrack = (track, t) => {
    const { frames, el } = track;
    let state;
    if (t <= frames[0].t) state = frames[0];
    else if (t >= frames[frames.length - 1].t) state = frames[frames.length - 1];
    else {
      let i = 0;
      while (i < frames.length - 1 && frames[i + 1].t <= t) i++;
      const a = frames[i];
      const b = frames[i + 1];
      const k = (EASE[b.ease] ?? EASE.inOut)(clamp01((t - a.t) / (b.t - a.t)));
      state = { o: lerp(a.o, b.o, k), x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), s: lerp(a.s, b.s, k), r: lerp(a.r, b.r, k) };
      if (track.usesWidth) state.w = lerp(a.w ?? 0, b.w ?? 0, k);
    }
    el.style.opacity = state.o.toFixed(3);
    el.style.visibility = state.o <= 0.001 ? 'hidden' : 'visible';
    el.style.transform = `translate(${state.x.toFixed(1)}px, ${state.y.toFixed(1)}px) scale(${state.s.toFixed(4)}) rotate(${state.r.toFixed(2)}deg)`;
    if (track.usesWidth && state.w !== undefined) el.style.width = `${state.w.toFixed(2)}%`;
  };

  const renderAt = (t) => {
    for (const track of tracks) applyTrack(track, t);
    for (const typer of typers) {
      const k = clamp01((t - typer.t0) / (typer.t1 - typer.t0));
      typer.el.textContent = typer.text.slice(0, Math.round(k * typer.text.length));
      typer.el.dataset.typing = k > 0 && k < 1 ? 'true' : 'false';
    }
    for (const counter of counters) {
      const k = EASE.out(clamp01((t - counter.t0) / (counter.t1 - counter.t0)));
      counter.el.textContent = counter.format(lerp(counter.from, counter.to, k));
    }
    for (const fn of hooks) fn(t);
  };

  // ==================== Sonidos (WebAudio, sin archivos) ====================
  let audio = null;
  let muted = false;
  const ensureAudio = () => {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audio = new Ctx();
    }
    if (audio.state === 'suspended') void audio.resume();
    return audio;
  };
  const tone = (ctx, { freq, to, start = 0, length = 0.15, type = 'sine', volume = 0.12 }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + start;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + length);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + length + 0.02);
  };
  const noise = (ctx, { length = 0.3, from = 300, to = 2400, volume = 0.05 }) => {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    const t0 = ctx.currentTime;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(to, t0 + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + length * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
  };
  const SOUNDS = {
    pop: (ctx) => tone(ctx, { freq: 520, to: 880, length: 0.09, volume: 0.1 }),
    click: (ctx) => tone(ctx, { freq: 1800, to: 1200, length: 0.03, type: 'triangle', volume: 0.05 }),
    type: (ctx) => tone(ctx, { freq: 2400, to: 2000, length: 0.018, type: 'triangle', volume: 0.025 }),
    whoosh: (ctx) => noise(ctx, { length: 0.35 }),
    chime: (ctx) => { tone(ctx, { freq: 880, length: 0.5, volume: 0.07 }); tone(ctx, { freq: 1318.5, start: 0.08, length: 0.6, volume: 0.06 }); },
    coin: (ctx) => { tone(ctx, { freq: 987.8, length: 0.08, type: 'triangle', volume: 0.07 }); tone(ctx, { freq: 1318.5, start: 0.07, length: 0.3, type: 'triangle', volume: 0.07 }); },
    levelup: (ctx) => [523.3, 659.3, 784, 1046.5].forEach((freq, i) => tone(ctx, { freq, start: i * 0.09, length: 0.25, type: 'triangle', volume: 0.06 })),
    soft: (ctx) => tone(ctx, { freq: 392, to: 330, length: 0.25, volume: 0.06 }),
  };
  const play = (sound) => {
    if (muted) return;
    const ctx = ensureAudio();
    if (ctx && SOUNDS[sound]) SOUNDS[sound](ctx);
  };

  // ==================== Reproductor ====================
  const start = ({ length }) => {
    duration = length;
    cues.sort((a, b) => a.t - b.t);
    chapters.sort((a, b) => a.t - b.t);
    const stage = $('#stage');
    const viewport = $('#viewport');
    const bar = $('#bar');
    const range = $('#range');
    const time = $('#time');
    const playButton = $('#play');
    const bigPlay = $('#big-play');
    const muteButton = $('#mute');
    const fullButton = $('#full');
    const chapterLabel = $('#chapter');
    range.max = String(duration);

    for (const chapterInfo of chapters) {
      const tick = document.createElement('button');
      tick.type = 'button';
      tick.className = 'tick';
      tick.style.left = `${(chapterInfo.t / duration) * 100}%`;
      tick.title = chapterInfo.title;
      tick.setAttribute('aria-label', `Ir a: ${chapterInfo.title}`);
      tick.addEventListener('click', () => seek(chapterInfo.t));
      bar.appendChild(tick);
    }

    const fit = () => {
      const scale = Math.min(viewport.clientWidth / W, viewport.clientHeight / H);
      stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };
    new ResizeObserver(fit).observe(viewport);
    fit();

    let t = 0;
    let playing = false;
    let last = 0;
    const format = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const ui = () => {
      range.value = String(t);
      range.style.setProperty('--progress', `${(t / duration) * 100}%`);
      time.textContent = `${format(t)} / ${format(duration)}`;
      playButton.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
      playButton.dataset.playing = String(playing);
      const current = [...chapters].reverse().find((c) => c.t <= t + 0.01);
      chapterLabel.textContent = current ? current.title : '';
      bigPlay.hidden = playing || (t > 0 && t < duration);
      bigPlay.querySelector('span').textContent = t >= duration ? 'Ver de nuevo' : 'Ver tutorial';
    };
    const seek = (to) => {
      t = Math.max(0, Math.min(duration, to));
      renderAt(t);
      ui();
    };
    const toggle = () => {
      if (!playing && t >= duration) t = 0;
      playing = !playing;
      if (playing) ensureAudio();
      last = performance.now();
      ui();
    };
    const loop = (now) => {
      if (playing) {
        const previous = t;
        t = Math.min(duration, t + (now - last) / 1000);
        for (const c of cues) if (c.t > previous && c.t <= t) play(c.sound);
        if (t >= duration) playing = false;
        renderAt(t);
        ui();
      }
      last = now;
      requestAnimationFrame(loop);
    };

    playButton.addEventListener('click', toggle);
    bigPlay.addEventListener('click', toggle);
    range.addEventListener('input', () => seek(Number(range.value)));
    muteButton.addEventListener('click', () => {
      muted = !muted;
      muteButton.dataset.muted = String(muted);
      muteButton.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar');
    });
    fullButton.addEventListener('click', () => {
      const shell = $('#shell');
      if (document.fullscreenElement) void document.exitFullscreen();
      else void shell.requestFullscreen?.();
    });
    window.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement && event.target.type !== 'range') return;
      // Dentro de la plataforma (iframe): Esc cierra el modal que lo contiene.
      if (event.key === 'Escape' && window.parent !== window && !document.fullscreenElement) {
        window.parent.postMessage({ type: 'juried-tutorial:close' }, window.location.origin);
        return;
      }
      if (event.code === 'Space') { event.preventDefault(); toggle(); }
      else if (event.key === 'ArrowRight') seek(t + 5);
      else if (event.key === 'ArrowLeft') seek(t - 5);
      else if (event.key.toLowerCase() === 'm') muteButton.click();
      else if (event.key.toLowerCase() === 'f') fullButton.click();
    });

    // Para revisar o exportar: window.tutorial.renderAt(t) deja la escena del segundo t.
    window.tutorial = { renderAt: (s) => { renderAt(s); }, duration, seek };
    seek(0);
    requestAnimationFrame(loop);
  };

  window.Motor = { key, show, type, count, cue, chapter, every, start, renderAt };
})();
