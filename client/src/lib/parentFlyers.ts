import { parentApi } from './parentApi';
import { escapeHtml } from './safeHtml';

type FlyerData = Awaited<ReturnType<typeof parentApi.generateBulkParentLinkCodes>>;

// El QR lo genera el servidor (SVG propio, sin datos del usuario): solo se acepta si es un <svg>.
const safeQr = (svg: string) => (/^\s*<svg[\s>]/.test(svg) && !/<script|on\w+=/i.test(svg) ? svg : '');
const shortLink = (url: string) => url.replace(/^https?:\/\//, '');

// Folletos imprimibles (4 por hoja A4): cada familia escanea el QR (o escribe el enlace) de su hijo o hija.
const flyersHtml = (data: FlyerData) => {
  const pages: string[] = [];
  for (let i = 0; i < data.students.length; i += 4) {
    const batch = data.students.slice(i, i + 4);
    const flyers = batch.map((s) => `
      <div class="flyer">
        <div class="flyer-logo">Juried</div>
        <div class="flyer-class">${escapeHtml(data.classroomName)}</div>
        <div class="flyer-student">Para la familia de ${escapeHtml(s.name)}</div>
        <div class="flyer-qr">${safeQr(s.qrSvg)}</div>
        <div class="flyer-instructions">
          <ol>
            <li>Escanee el código QR con la cámara del celular (o entre a <strong>${escapeHtml(shortLink(s.joinUrl))}</strong>).</li>
            <li>Cree su cuenta de familia o entre con la suya.</li>
            <li>El docente confirma que es su familia y verá los avisos de la clase y el progreso de su hijo/a.</li>
          </ol>
        </div>
        <div class="flyer-label">Código para la familia</div>
        <div class="flyer-code">${escapeHtml(s.parentLinkCode)}</div>
        <div class="flyer-note">Es solo para su familia: no lo comparta en grupos.</div>
      </div>`).join('');
    const empty = Array(4 - batch.length).fill('<div class="flyer" style="border-color:transparent;"></div>').join('');
    pages.push(`<div class="page"><div class="grid">${flyers}${empty}</div></div>`);
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Folletos para familias - ${escapeHtml(data.classroomName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #f8fafc; }
    .page { page-break-after: always; padding: 10mm; }
    .page:last-child { page-break-after: auto; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; height: calc(297mm - 20mm); }
    .flyer { border: 2px dashed #cbd5e1; border-radius: 12px; padding: 6mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: white; }
    .flyer-logo { font-size: 28px; font-weight: 700; color: #6366f1; margin-bottom: 4mm; }
    .flyer-class { font-size: 11px; color: #475569; margin-bottom: 3mm; background: #f1f5f9; padding: 3px 10px; border-radius: 20px; }
    .flyer-student { font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 2mm; }
    .flyer-label { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1mm; margin-top: 3mm; }
    .flyer-code { font-size: 26px; font-weight: 700; letter-spacing: 3px; color: #6366f1; background: #eef2ff; padding: 4mm 8mm; border-radius: 10px; margin: 3mm 0; font-family: monospace; }
    .flyer-instructions { font-size: 9px; color: #64748b; line-height: 1.5; margin-top: 4mm; max-width: 90%; }
    .flyer-instructions ol { padding-left: 14px; text-align: left; }
    .flyer-qr { width: 38mm; height: 38mm; margin-top: 2mm; }
    .flyer-qr svg { width: 100%; height: 100%; }
    .flyer-note { font-size: 9px; color: #475569; margin-top: 1mm; }
    @media print {
      body { background: white; }
      .no-print { display: none !important; }
      .page { padding: 8mm; }
      .flyer { border: 1.5px dashed #94a3b8; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background:#6366f1;color:white;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;">
    <div><strong>${escapeHtml(data.classroomName)}</strong> — ${data.students.length} folletos</div>
    <button onclick="window.print()" style="background:white;color:#6366f1;border:none;padding:8px 20px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;">Imprimir folletos</button>
  </div>
${pages.join('')}
</body>
</html>`;
};

/** Abre los folletos en una pestaña nueva. Devuelve cuántos se generaron o el motivo del fallo. */
export const openParentFlyers = async (classroomId: string): Promise<{ count: number } | { error: string }> => {
  // La pestaña se abre antes de esperar al servidor para que el navegador no la bloquee.
  const printWindow = window.open('', '_blank');
  if (!printWindow) return { error: 'Permite las ventanas emergentes para ver los folletos' };
  try {
    const data = await parentApi.generateBulkParentLinkCodes(classroomId);
    if (data.students.length === 0) {
      printWindow.close();
      return { error: 'No hay alumnos activos en la clase' };
    }
    printWindow.document.write(flyersHtml(data));
    printWindow.document.close();
    return { count: data.students.length };
  } catch {
    printWindow.close();
    return { error: 'No se pudieron generar los folletos' };
  }
};
