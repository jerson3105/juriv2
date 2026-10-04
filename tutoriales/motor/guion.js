/*
 * Guion: utilidades compartidas para escribir escenas (usa window.Motor; lo incluye build.mjs con
 * <!-- base: comun -->). Arma las piezas que se repiten entre tutoriales y deja las animaciones estándar:
 *   const G = Guion.init();
 *   G.cielo(); G.portada({...}); G.burbuja(...); const app = G.app({...}); G.caption(...); G.consejos({...});
 *   G.final({...}); G.arrancar(fin);
 * Todo es determinista: las mismas llamadas dan el mismo video.
 */
(() => {
  const GRUPOS = {
    'Estudiantes': { ic: '👥', items: ['Lista', 'Clanes', 'Asistencia'] },
    'Gamificación': { ic: '🎮', items: ['Comportamientos', 'Insignias', 'Tienda', 'Coleccionables', 'Rankings', 'Historia de clase'] },
    'Aprendizaje': { ic: '🎓', items: [] },
    'Comunicación': { ic: '💬', items: [] },
  };

  const init = () => {
    const M = window.Motor;
    const stage = document.getElementById('stage');
    stage.classList.add('loading');
    const $ = (s) => (typeof s === 'string' ? document.querySelector(s) : s);
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    /** Crea un elemento (opcionalmente con id) dentro de parent (por defecto, el escenario). */
    const el = (tag, cls = '', html = '', parent = stage, id = '') => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (id) e.id = id;
      if (html) e.innerHTML = html;
      $(parent).appendChild(e);
      return e;
    };

    // ---------- Medidas y animaciones básicas ----------
    /** Centro de un elemento en coordenadas del escenario (sin transformaciones). */
    const center = (selector, dx = 0, dy = 0) => {
      let node = $(selector);
      let x = node.offsetWidth / 2 + dx;
      let y = node.offsetHeight / 2 + dy;
      while (node && node !== stage) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent; }
      return { x, y };
    };
    /** Resaltado dorado sobre un elemento. Devuelve el resaltado (oculto hasta que se anime). */
    const glow = (selector, t0, t1, pad = 6, pulse = false) => {
      const target = $(selector);
      const c = center(target);
      const g = el('div', 'glow');
      g.style.cssText = `left:${c.x - target.offsetWidth / 2 - pad}px;top:${c.y - target.offsetHeight / 2 - pad}px;width:${target.offsetWidth + pad * 2}px;height:${target.offsetHeight + pad * 2}px`;
      const frames = [[0, { o: 0 }], [t0, { o: 0 }], [t0 + 0.25, { o: 1 }]];
      if (pulse) frames.push([t0 + 1.1, { o: 0.45 }], [t0 + 2, { o: 1 }]);
      frames.push([t1, { o: 1 }], [t1 + 0.25, { o: 0 }]);
      M.key(g, frames, 'out');
      return g;
    };
    /** Aparece en t0 (y se va en t1 si se indica). */
    const appear = (selector, t0, t1 = null, fade = 0.2) => {
      const frames = [[0, { o: 0 }], [t0, { o: 0 }], [t0 + fade, { o: 1 }]];
      if (t1 !== null) frames.push([t1, { o: 1 }], [t1 + fade, { o: 0 }]);
      M.key(selector, frames, 'out');
    };
    /** Entra con un rebote (escala) en t0 y se va en t1. */
    const pop = (selector, t0, t1 = null, { from = { s: 0.92, y: 20 }, ease = 'back' } = {}) => {
      const frames = [[0, { o: 0, ...from }], [t0, { o: 0, ...from }], [t0 + 0.4, { o: 1, s: 1, y: 0, x: 0, ease }]];
      if (t1 !== null) frames.push([t1, { o: 1 }], [t1 + 0.3, { o: 0, s: 0.97, ease: 'in' }]);
      M.key(selector, frames);
    };
    /** Clic: onda dorada en el punto p y su sonido. */
    const ripple = (t, p) => {
      const r = el('div', 'ripple');
      r.style.left = `${p.x}px`;
      r.style.top = `${p.y}px`;
      M.key(r, [[0, { o: 0 }], [t, { o: 0, s: 0.3 }], [t + 0.02, { o: 0.9, s: 0.35 }], [t + 0.5, { o: 0, s: 1.4, ease: 'out' }]]);
      M.cue(t, 'click');
    };
    /** Texto que se escribe con su tecleo. */
    const typing = (selector, t0, t1, text) => {
      M.type(selector, t0, t1, text);
      for (let t = t0; t < t1; t += 0.085) M.cue(t, 'type');
    };
    /** Subtítulo de paso: número (o ícono) + texto, entre t0 y t1. */
    const caption = (t0, t1, badge, html, kind = '') => {
      const c = el('div', 'cap', `<span class="n ${kind}">${badge}</span><span>${html}</span>`, '#caps');
      M.key(c, [[0, { o: 0, y: 30 }], [t0, { o: 0, y: 30 }], [t0 + 0.35, { o: 1, y: 0, ease: 'out' }], [t1 - 0.3, { o: 1, y: 0 }], [t1, { o: 0, y: -10, ease: 'in' }]]);
    };
    /** Una regla de cuadros del cursor: [[t, punto, {o}?], ...]. */
    const cursor = (frames) => {
      M.key('#cursor', frames.map(([t, p, extra = {}]) => [t, { x: p.x, y: p.y, ...extra, ease: 'inOut' }]));
    };

    // ---------- Fondo ----------
    /** Cielo nocturno con estrellas que titilan y una constelación (visible entre los tramos indicados). */
    const cielo = (constelacion = []) => {
      const sky = el('div', '', '', stage, 'sky');
      stage.insertBefore(sky, stage.firstChild);
      sky.insertAdjacentHTML('beforeend', `<svg id="constellation" viewBox="0 0 600 320" aria-hidden="true">
        <line x1="40" y1="250" x2="150" y2="170"/><line x1="150" y1="170" x2="260" y2="200"/><line x1="260" y1="200" x2="360" y2="90"/>
        <line x1="360" y1="90" x2="470" y2="130"/><line x1="470" y1="130" x2="560" y2="40"/>
        <circle cx="40" cy="250" r="6"/><circle cx="150" cy="170" r="7"/><circle cx="260" cy="200" r="5"/><circle cx="360" cy="90" r="8"/><circle cx="470" cy="130" r="5"/><circle cx="560" cy="40" r="7"/></svg>`);
      const stars = [];
      for (let i = 0; i < 150; i++) {
        const size = rand() < 0.12 ? 4 : rand() < 0.5 ? 3 : 2;
        const s = el('div', 'star', '', sky);
        s.style.cssText = `left:${rand() * 1920}px;top:${rand() * 1080}px;width:${size}px;height:${size}px`;
        stars.push({ el: s, base: 0.35 + rand() * 0.5, speed: 0.6 + rand() * 1.8, phase: rand() * 6.3 });
      }
      M.every((t) => { for (const s of stars) s.el.style.opacity = (s.base + 0.35 * Math.sin(t * s.speed + s.phase)).toFixed(2); });
      const frames = [[0, { o: 0 }]];
      for (const [a, b] of constelacion) frames.push([a, { o: 0 }], [a + 2, { o: 0.8 }], [b - 2, { o: 0.8 }], [b, { o: 0 }]);
      M.key('#constellation', frames);
    };
    /** Puntitos de estrellas dentro de una caja nocturna (banda lateral, tarjeta de avatar…). */
    const puntos = (container, n, w, h) => {
      const box = $(container);
      box.classList.add('night-dots');
      for (let i = 0; i < n; i++) el('i', 'dot', '', box).style.cssText = `left:${rand() * w}px;top:${rand() * h}px`;
    };
    /** Confeti determinista dentro de container desde t0. */
    const confeti = (container, t0, dur = 4) => {
      const colors = ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fb7185'];
      const pieces = [];
      for (let i = 0; i < 70; i++) {
        const c = el('div', 'confetti', '', container);
        c.style.left = `${rand() * 1920}px`;
        c.style.background = colors[i % colors.length];
        pieces.push({ el: c, delay: rand() * 1.2, speed: 380 + rand() * 420, spin: (rand() - 0.5) * 900, drift: (rand() - 0.5) * 220 });
      }
      M.every((t) => {
        for (const c of pieces) {
          const k = t - t0 - c.delay;
          if (k < 0 || k > dur) { c.el.style.opacity = '0'; continue; }
          c.el.style.opacity = '1';
          c.el.style.transform = `translate(${(c.drift * Math.sin(k * 2)).toFixed(1)}px, ${(-60 + k * c.speed).toFixed(1)}px) rotate(${(k * c.spin).toFixed(1)}deg)`;
        }
      });
    };

    // ---------- Escenas estándar ----------
    /** Portada (0 → fin): logo, «Tutorial para docentes», título, subtítulo, chips y Jiro. */
    const portada = ({ titulo, sub, chips = [], jiro, logo, fin = 6.5 }) => {
      const L = el('img', 'cover-logo', '', stage, 'cv-logo'); L.src = logo; L.alt = 'Juried';
      el('div', 'cover-eyebrow', 'Tutorial para docentes', stage, 'cv-eyebrow');
      el('div', 'cover-title', titulo, stage, 'cv-title');
      el('div', 'cover-sub', sub, stage, 'cv-sub');
      el('div', 'cover-chips', chips.map((c) => `<span>${c}</span>`).join(''), stage, 'cv-chips');
      const J = el('img', 'cover-jiro', '', stage, 'cv-jiro'); J.src = jiro; J.alt = '';
      M.show('#cv-logo', 0.2, fin - 0.2, { from: { y: -20 } });
      M.show('#cv-eyebrow', 0.5, fin - 0.2);
      M.key('#cv-title', [[0.8, { o: 0, s: 0.9, y: 30 }], [1.4, { o: 1, s: 1, y: 0, ease: 'pop' }], [fin - 0.5, { o: 1 }], [fin - 0.1, { o: 0, y: -20, ease: 'in' }]]);
      M.show('#cv-sub', 1.5, fin - 0.2);
      M.show('#cv-chips', 2.0, fin - 0.2);
      M.key('#cv-jiro', [[1.0, { o: 0, x: 260 }], [1.8, { o: 1, x: 0, ease: 'back' }], [3.4, { y: -14 }], [4.8, { y: 0 }], [fin - 0.5, { o: 1, x: 0 }], [fin, { o: 0, x: 200, ease: 'in' }]]);
      M.cue(0.3, 'whoosh'); M.cue(1.2, 'pop'); M.cue(1.6, 'chime');
    };
    /** Jiro que explica (entra desde la izquierda). */
    const guia = (id, src, t0, t1) => {
      const J = el('img', 'guide-jiro', '', stage, id); J.src = src; J.alt = '';
      M.key(`#${id}`, [[0, { o: 0, x: -240 }], [t0, { o: 0, x: -240 }], [t0 + 0.7, { o: 1, x: 0, ease: 'back' }], [t1 - 0.6, { o: 1, x: 0 }], [t1, { o: 0, x: -200, ease: 'in' }]]);
      M.cue(t0, 'whoosh');
    };
    /** Globo de Jiro con texto que se escribe. */
    const burbuja = (id, t0, t1, texto) => {
      el('div', 'bubble', `<span id="${id}-t"></span>`, stage, id);
      M.key(`#${id}`, [[0, { o: 0, s: 0.92, y: 20 }], [t0, { o: 0, s: 0.92, y: 20 }], [t0 + 0.4, { o: 1, s: 1, y: 0, ease: 'back' }], [t1 - 0.3, { o: 1 }], [t1, { o: 0 }]]);
      const dur = Math.min(3.2, Math.max(1.6, texto.length * 0.038));
      typing(`#${id}-t`, t0 + 0.5, t0 + 0.5 + dur, texto);
      M.cue(t0 + 0.1, 'pop');
    };
    /** Marco de la plataforma con barra lateral (un menú por cada {id, abierto, activo}). */
    const app = ({ id = 'app', logo, navs }) => {
      const frame = el('div', 'appframe', '', stage, id);
      el('div', 'browser', '<i style="background:#f87171"></i><i style="background:#fbbf24"></i><i style="background:#34d399"></i><div class="url">plataformajuried.com</div>', frame);
      const side = el('div', 'sidebar', '', frame);
      const band = el('div', 'band', `<img src="${logo}" alt=""><div class="classchip"><b>3B</b><div>3.° B · Ciencia<small>CÓDIGO W69HBRAN</small></div></div>`, side, `${id}-band`);
      puntos(band, 26, 280, 112);
      for (const n of navs) {
        const nav = el('div', 'nav', '', side, n.id);
        for (const [grupo, info] of Object.entries(GRUPOS)) {
          const open = grupo === n.abierto;
          el('div', 'item', `<span class="ic">${info.ic}</span>${grupo}<span class="chev">${open ? '▴' : '▾'}</span>`, nav);
          if (!open) continue;
          for (const item of info.items) el('div', `item sub${item === n.activo ? ' active' : ''}`, item, nav, item === n.activo ? `${n.id}-on` : '');
        }
      }
      el('div', 'header', '<div class="cls">🎓</div><div class="who"><b>3.° B · Ciencia</b><small>6 estudiantes</small></div><div class="tools"><span>🖥 Modo clase ▾</span><span>🔧 Herramientas</span><span>🔔</span><span class="av">DP</span></div>', frame);
      el('div', 'content', '', frame, `${id}-content`);
      return frame;
    };
    /** Consejos (t0 → t1): título, tres consejos y Jiro. */
    const consejos = ({ t0, t1, items, jiro }) => {
      el('div', 'tips-title', '3 consejos <span>para empezar</span>', stage, 'tp-title');
      items.forEach(([b, small], i) => el('div', 'tip', `<div class="ck">✓</div><div><b>${b}</b><small>${small}</small></div>`, stage, `tp-${i}`).style.top = `${270 + i * 200}px`);
      const J = el('img', 'tips-jiro', '', stage, 'tp-jiro'); J.src = jiro; J.alt = '';
      M.cue(t0, 'whoosh');
      M.show('#tp-title', t0 + 0.3, t1 - 0.4);
      items.forEach((_, i) => {
        const t = t0 + 1 + i * 2;
        M.key(`#tp-${i}`, [[0, { o: 0, x: -60 }], [t, { o: 0, x: -60 }], [t + 0.5, { o: 1, x: 0, ease: 'back' }], [t1 - 0.6, { o: 1, x: 0 }], [t1 - 0.1, { o: 0, x: -40, ease: 'in' }]]);
        M.cue(t, 'pop');
      });
      M.key('#tp-jiro', [[0, { o: 0, x: 200 }], [t0 + 0.6, { o: 0, x: 200 }], [t0 + 1.3, { o: 1, x: 0, ease: 'back' }], [t1 - 0.6, { o: 1, x: 0 }], [t1 - 0.1, { o: 0, x: 160, ease: 'in' }]]);
    };
    /** Cierre (t0 → fin): Jiro, mensaje, ruta en la plataforma, logo y dirección. */
    const final = ({ t0, fin, titulo, ruta, jiro, logo }) => {
      el('div', 'endcard', `<div class="box"><img class="jiro" src="${jiro}" alt=""><h2>${titulo}</h2><p>${ruta}</p><div class="brand"><img src="${logo}" alt="Juried"><span>plataformajuried.com</span></div></div>`, stage, 'end');
      M.key('#end', [[0, { o: 0 }], [t0, { o: 0, s: 0.94 }], [t0 + 0.7, { o: 1, s: 1, ease: 'out' }], [fin - 0.7, { o: 1 }], [fin, { o: 0 }]]);
      M.cue(t0 + 0.2, 'chime');
    };

    /** Cursor, capa de subtítulos y arranque cuando la tipografía está lista (máx. 1,5 s). */
    const capas = () => {
      el('div', 'capwrap', '', stage, 'caps');
      stage.insertAdjacentHTML('beforeend', '<svg id="cursor" class="abs" viewBox="0 0 44 54" aria-hidden="true"><path d="M3 2 L3 40 L13 31 L20 48 L28 44 L21 28 L35 28 Z" fill="#fff" stroke="#111827" stroke-width="3" stroke-linejoin="round"/></svg>');
    };
    const arrancar = (fin) => {
      // Imágenes creadas por el guion con src="asset:…" (build.mjs las dejó como data-asset).
      if (typeof ASSETS !== 'undefined') for (const img of document.querySelectorAll('img[data-asset]')) img.src = ASSETS[img.dataset.asset];
      const go = () => { if (stage.dataset.ready) return; stage.dataset.ready = '1'; stage.classList.remove('loading'); M.start({ length: fin }); };
      if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))]).then(go);
      else go();
    };

    return { ...M, $, el, rand, center, glow, appear, pop, ripple, typing, caption, cursor, cielo, puntos, confeti, portada, guia, burbuja, app, consejos, final, capas, arrancar, stage };
  };

  window.Guion = { init };
})();
