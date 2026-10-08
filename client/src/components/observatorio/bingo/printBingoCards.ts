import type { BingoCards } from '../../../lib/bingoApi';
import { FIGURES, FREE } from './bingoLogic';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Hoja A4 en blanco y negro con 4 cartones (corte punteado): número grande para verificar, espacio para el nombre y
 * la casilla libre de Jiro en el 3×3. Se abre una ventana aparte solo con los cartones y se lanza la impresión.
 * `which`: solo los de papel (los alumnos con cuenta lo ven en su pantalla) o todos (respaldo si falla el wifi).
 */
export const printBingoCards = (data: BingoCards, answerText: Map<string, string>, title: string, which: 'paper' | 'all') => {
  const chosen = data.cards.filter((c) => which === 'all' || !c.screen);
  if (chosen.length === 0) return false;
  const size = data.size;
  const figures = FIGURES.map((f) => f.name).join(' → ');
  // La ventana de impresión es about:blank: la imagen va con la dirección completa del sitio.
  const jiro = `${window.location.origin}/assets/jiro/jiro-linea.png`;
  const card = (c: BingoCards['cards'][number]) => `
    <section class="card">
      <header>
        <div><p class="brand">★ Bingo Estelar</p><p class="sub">${escapeHtml(title)} · Juego ${data.game}</p></div>
        <p class="num">Nº ${c.number}</p>
      </header>
      <p class="name">Nombre: ______________________</p>
      <div class="grid s${size}">
        ${c.cells.map((key) => (key === FREE
          ? `<div class="cell free"><img src="${jiro}" alt="Jiro"><span class="libre">LIBRE</span></div>`
          : `<div class="cell"><span>${escapeHtml(answerText.get(key) ?? '')}</span></div>`)).join('')}
      </div>
      <p class="foot">Figuras: ${escapeHtml(figures)}. Marca con lápiz o con fichas.</p>
    </section>`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Bingo Estelar · ${escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      @page { size: A4 portrait; margin: 10mm; }
      body { margin: 0; font-family: system-ui, 'Segoe UI', Arial, sans-serif; color: #000; }
      .sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
      .card { height: 138mm; padding: 5mm; border: 1.2pt dashed #000; break-inside: avoid; display: flex; flex-direction: column; gap: 2mm; }
      header { display: flex; justify-content: space-between; align-items: flex-start; gap: 3mm; }
      .brand { margin: 0; font-size: 13pt; font-weight: 800; }
      .sub { margin: 1mm 0 0; font-size: 9pt; }
      .num { margin: 0; font-size: 22pt; font-weight: 900; white-space: nowrap; }
      .name { margin: 0; font-size: 10pt; }
      .grid { flex: 1; display: grid; border: 1.5pt solid #000; }
      .grid.s3 { grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); }
      .grid.s4 { grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 1fr); }
      .cell { border: 1pt solid #000; display: flex; align-items: center; justify-content: center; text-align: center; padding: 1.5mm; overflow-wrap: anywhere; hyphens: auto; font-weight: 800; line-height: 1.1; }
      .s3 .cell { font-size: 15pt; }
      .s4 .cell { font-size: 11.5pt; }
      .free { flex-direction: column; gap: 1mm; }
      .free img { width: 78%; max-height: 72%; object-fit: contain; }
      .free .libre { font-size: 7pt; letter-spacing: .08em; }
      .foot { margin: 0; font-size: 7.5pt; }
    </style></head><body>
    <div class="sheet">${chosen.map(card).join('')}</div>
    <script>window.onload = function () { window.print(); };</script>
  </body></html>`;
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
};
