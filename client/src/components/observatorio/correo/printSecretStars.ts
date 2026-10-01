import type { CorreoState } from '../../../lib/correoApi';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Tarjetas para imprimir (modo papel): una por alumno, con su estrella secreta y la consigna.
 * Se abre una ventana aparte solo con las tarjetas y se lanza la impresión.
 */
export const printSecretStars = (state: CorreoState, nameOf: (id: string) => string, classroomName: string) => {
  const slips = state.pairs.map((pair) => `
    <section class="slip">
      <p class="who">${escapeHtml(nameOf(pair.writerId))}</p>
      <p class="label">Tu estrella secreta es</p>
      <p class="star">✨ ${escapeHtml(nameOf(pair.recipientId))} ✨</p>
      <p class="prompt">${escapeHtml(state.prompt)}</p>
      <p class="secret">¡Es un secreto! Escríbele y entrega tu carta a tu profe.</p>
    </section>`).join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Correo Estelar · ${escapeHtml(classroomName)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 12mm; font-family: system-ui, sans-serif; color: #111827; }
      h1 { font-size: 16pt; margin: 0 0 8mm; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
      .slip { border: 1.5px dashed #6b7280; border-radius: 4mm; padding: 6mm; break-inside: avoid; }
      .who { font-size: 13pt; font-weight: 800; margin: 0; }
      .label { font-size: 10pt; margin: 3mm 0 0; color: #374151; }
      .star { font-size: 16pt; font-weight: 800; margin: 1mm 0 3mm; }
      .prompt { font-size: 11pt; margin: 0; font-style: italic; }
      .secret { font-size: 9pt; margin: 3mm 0 0; color: #374151; }
    </style></head><body>
    <h1>💌 Correo Estelar · ${escapeHtml(classroomName)}</h1>
    <div class="grid">${slips}</div>
    <script>window.onload = function () { window.print(); };</script>
  </body></html>`;
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
};
