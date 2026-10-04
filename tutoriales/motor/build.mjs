// Arma un tutorial en UN solo archivo HTML liviano (las imágenes van dentro; la tipografía, de Google, tiene respaldo).
// Uso (desde la raíz del repo): node tutoriales/motor/build.mjs comportamientos
//   lee  tutoriales/<nombre>/escenas.html  (estilos + escenario + guion con Motor.*)
//   y escribe client/public/tutoriales/<nombre>.html, que Apache sirve como archivo estático
//   (la plataforma lo abre en un modal desde la página correspondiente).
// Imágenes: <img src="asset:ruta?h=200"> con la ruta relativa a client/public. Cada una se pasa a WebP con sharp
// (redimensionada a la altura h si se indica) y va UNA sola vez en el archivo, aunque se use en varias escenas.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repo = resolve(root, '..');
const publicDir = join(repo, 'client', 'public');
const sharp = createRequire(join(repo, 'server', 'package.json'))('sharp');
const name = process.argv[2];
if (!name) throw new Error('Falta el nombre del tutorial (carpeta dentro de tutoriales/)');

const source = readFileSync(join(root, name, 'escenas.html'), 'utf8');
const title = (source.match(/<!--\s*titulo:\s*(.+?)\s*-->/) ?? [])[1] ?? 'Tutorial';

// 1) Imágenes: una entrada por ruta + altura, en WebP (o el original si pesara menos).
const assets = new Map();
let originalBytes = 0;
let finalBytes = 0;
for (const [, path, height] of source.matchAll(/asset:([\w./-]+)(?:\?h=(\d+))?/g)) {
  const id = `${path}?h=${height ?? ''}`;
  if (assets.has(id)) continue;
  const input = readFileSync(join(publicDir, path));
  let pipeline = sharp(input);
  if (height) pipeline = pipeline.resize({ height: Number(height), withoutEnlargement: true });
  const webp = await pipeline.webp({ quality: 82, alphaQuality: 90, effort: 4 }).toBuffer();
  const useOriginal = !height && path.endsWith('.webp') && input.length <= webp.length;
  const bytes = useOriginal ? input : webp;
  originalBytes += input.length;
  finalBytes += bytes.length;
  assets.set(id, { key: `a${assets.size + 1}`, uri: `data:image/webp;base64,${bytes.toString('base64')}` });
}
const keyOf = (path, height) => assets.get(`${path}?h=${height ?? ''}`).key;

// 2) <img src="asset:..."> → data-asset="aN"; un script pone cada src desde un solo mapa. En los guiones,
//    'asset:ruta' (comillas simples) pasa a ASSETS.aN: la imagen tampoco se repite.
const html = source
  .replace(/src="asset:([\w./-]+)(?:\?h=(\d+))?"/g, (_, path, height) => `data-asset="${keyOf(path, height)}"`)
  .replace(/'asset:([\w./-]+)(?:\?h=(\d+))?'/g, (_, path, height) => `ASSETS.${keyOf(path, height)}`)
  .replace(/asset:([\w./-]+)(?:\?h=(\d+))?/g, (_, path, height) => assets.get(`${path}?h=${height ?? ''}`).uri);
const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
const stage = html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
const assetMap = `const ASSETS = {${[...assets.values()].map((a) => `${a.key}:'${a.uri}'`).join(',')}};
for (const img of document.querySelectorAll('img[data-asset]')) img.src = ASSETS[img.dataset.asset];`;

// Base común opcional (cielo, marco de la plataforma, cursor, subtítulos, consejos…): solo si la escena la pide.
const usesBase = /<!--\s*base:\s*comun\s*-->/.test(source);
const css = readFileSync(join(here, 'player.css'), 'utf8') + (usesBase ? `\n${readFileSync(join(here, 'comun.css'), 'utf8')}` : '');
const js = readFileSync(join(here, 'player.js'), 'utf8') + (usesBase ? `\n${readFileSync(join(here, 'guion.js'), 'utf8')}` : '');
const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4.5" height="14" rx="1.2"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.2"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
};

const page = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} · Tutorial de Juried</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
<style>
${css}
${styles}
</style>
</head>
<body>
<div id="shell">
  <div id="viewport">
    <div id="stage" aria-label="${title}: animación del tutorial">
${stage}
    </div>
    <button id="big-play" type="button">${ICON.play}<span>Ver tutorial</span></button>
  </div>
  <div id="controls">
    <button id="play" type="button" aria-label="Reproducir" data-playing="false"><span class="i-play">${ICON.play}</span><span class="i-pause">${ICON.pause}</span></button>
    <div id="bar"><input id="range" type="range" min="0" step="0.01" value="0" aria-label="Posición del tutorial"></div>
    <div id="meta"><span id="time">0:00</span><span id="chapter"></span></div>
    <button id="mute" type="button" aria-label="Silenciar" data-muted="false"><span class="i-sound">${ICON.sound}</span><span class="i-muted">${ICON.muted}</span></button>
    <button id="full" type="button" aria-label="Pantalla completa">${ICON.full}</button>
  </div>
</div>
<script>
${assetMap}
</script>
<script>
${js}
</script>
<script>
${scripts}
</script>
</body>
</html>
`;
const outDir = join(publicDir, 'tutoriales');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${name}.html`);
writeFileSync(out, page);
console.log(`${out}: ${(statSync(out).size / 1024).toFixed(0)} KB · ${assets.size} imágenes (${(originalBytes / 1024).toFixed(0)} KB → ${(finalBytes / 1024).toFixed(0)} KB)`);
