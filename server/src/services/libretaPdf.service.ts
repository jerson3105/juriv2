import PDFDocument from 'pdfkit';
import type { ReportArea, SectionReport, StudentReport } from './schoolReport.service.js';

/**
 * PDF de la libreta («Informe de progreso del aprendizaje del estudiante») como el formato que usa el colegio: A4 horizontal
 * en dos mitades. A la izquierda la cabecera (escudo del MINEDU, título, datos y el logo del colegio) y las áreas; lo que no
 * cabe sigue en la mitad derecha, y después las conclusiones de cada periodo, la asistencia y las firmas. Una página (o más,
 * si hace falta) por estudiante; toda la sección en un archivo.
 */

type Doc = InstanceType<typeof PDFDocument>;

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN = 22;
const GAP = 24;
const COL_W = (PAGE_W - 2 * MARGIN - GAP) / 2;
const COL_X = [MARGIN, MARGIN + COL_W + GAP] as const;
const BOTTOM = PAGE_H - MARGIN;
const GREY = '#d9d9d9';
const LINE = '#374151';
const TEXT = '#111827';
const MUTED = '#4b5563';

// Columnas de la tabla de áreas.
const AREA_W = 74;
const PERIOD_W = 19;
const FINAL_W = 34;
const HEAD_H = 26;

type CellOptions = {
  fill?: string;
  bold?: boolean;
  italic?: boolean;
  size?: number;
  align?: 'left' | 'center';
  valign?: 'top' | 'middle';
  color?: string;
  /** Margen lateral del texto (las notas usan uno chico para que «AD» quepa). */
  pad?: number;
};

const fontOf = (o: CellOptions) => (o.bold ? 'Helvetica-Bold' : o.italic ? 'Helvetica-Oblique' : 'Helvetica');

const textHeight = (doc: Doc, text: string, width: number, o: CellOptions) => {
  doc.font(fontOf(o)).fontSize(o.size ?? 7);
  return doc.heightOfString(text, { width, align: o.align ?? 'left', lineGap: 0 });
};

/** Una celda con borde: fondo opcional y texto centrado en vertical (o arriba). */
const cell = (doc: Doc, x: number, y: number, w: number, h: number, text: string, o: CellOptions = {}) => {
  if (o.fill) doc.rect(x, y, w, h).fill(o.fill);
  doc.rect(x, y, w, h).lineWidth(0.6).strokeColor(LINE).stroke();
  if (!text) return;
  const pad = o.pad ?? 3;
  const width = w - pad * 2;
  const height = textHeight(doc, text, width, o);
  const top = o.valign === 'top' ? y + 2.5 : y + Math.max(1.5, (h - height) / 2);
  doc.font(fontOf(o)).fontSize(o.size ?? 7).fillColor(o.color ?? TEXT)
    .text(text, x + pad, top, { width, align: o.align ?? 'left', lineGap: 0, height: Math.max(1, y + h - top - 1), ellipsis: true });
};

const formatDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
const studentName = (s: StudentReport['student']) => `${s.lastNames.toLocaleUpperCase('es')}, ${s.firstNames}`;

/** Cursor de la página: columna izquierda o derecha y la altura donde sigue. */
class Flow {
  col = 0;
  y = MARGIN;
  constructor(private doc: Doc, private onPage: () => void) {}

  get x() { return COL_X[this.col]; }

  /** Pasa a la siguiente columna (o página) si no cabe un bloque de esta altura. */
  ensure(height: number) {
    if (this.y + height <= BOTTOM) return false;
    this.next();
    return true;
  }

  next() {
    if (this.col === 0) {
      this.col = 1;
    } else {
      this.doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
      this.onPage();
      this.col = 0;
    }
    this.y = MARGIN;
  }
}

const drawHeader = (doc: Doc, report: SectionReport, student: StudentReport, images: { logo: Buffer | null; minedu: Buffer | null }) => {
  const x = COL_X[0];
  const box = 54;
  // Izquierda: el escudo (con «República del Perú») y debajo «Ministerio de Educación», como en el formato; sin la imagen, el texto.
  if (images.minedu) {
    try { doc.image(images.minedu, x, MARGIN, { fit: [box, box - 12], align: 'center', valign: 'center' }); } catch { /* imagen dañada: sin escudo */ }
    doc.font('Helvetica-Bold').fontSize(4.8).fillColor(TEXT)
      .text('MINISTERIO DE\nEDUCACIÓN', x, MARGIN + box - 10, { width: box, align: 'center', lineGap: 0 });
  } else {
    doc.font('Helvetica-Bold').fontSize(5.6).fillColor(TEXT)
      .text('REPÚBLICA DEL PERÚ\n\nMINISTERIO DE EDUCACIÓN', x, MARGIN + 14, { width: box, align: 'center', lineGap: 0 });
  }
  // Derecha: el logo del colegio.
  if (images.logo) {
    try { doc.image(images.logo, x + COL_W - box, MARGIN, { fit: [box, box], align: 'center', valign: 'center' }); } catch { /* logo dañado: sin logo */ }
  }

  const gx = x + box + 6;
  const gw = COL_W - 2 * (box + 6);
  const title = `INFORME DE PROGRESO DEL APRENDIZAJE DEL ESTUDIANTE – ${report.year.name}`;
  doc.font('Helvetica-Bold').fontSize(7.6).fillColor(TEXT).text(title, gx, MARGIN, { width: gw, align: 'center', lineGap: 0 });
  let y = MARGIN + textHeight(doc, title, gw, { bold: true, size: 7.6, align: 'center' }) + 4;

  // El código del estudiante (SIAGIE) tiene 14 dígitos: su columna es la más ancha.
  const l1 = gw * 0.30;
  const v1 = gw * 0.27;
  const l2 = gw * 0.19;
  const v2 = gw - l1 - v1 - l2;
  const label: CellOptions = { fill: GREY, bold: true, size: 6.2, align: 'center' };
  const value: CellOptions = { size: 7, align: 'center' };
  const pair = (a: string, av: string, b: string, bv: string) => {
    const h = Math.max(11, textHeight(doc, a, l1 - 6, label) + 4, textHeight(doc, b, l2 - 6, label) + 4, textHeight(doc, av, v1 - 6, value) + 4, textHeight(doc, bv, v2 - 6, value) + 4);
    cell(doc, gx, y, l1, h, a, label);
    cell(doc, gx + l1, y, v1, h, av, value);
    cell(doc, gx + l1 + v1, y, l2, h, b, label);
    cell(doc, gx + l1 + v1 + l2, y, v2, h, bv, value);
    y += h;
  };
  const single = (a: string, av: string) => {
    const h = Math.max(12, textHeight(doc, av, gw - l1 - 6, value) + 4, textHeight(doc, a, l1 - 6, label) + 4);
    cell(doc, gx, y, l1, h, a, label);
    cell(doc, gx + l1, y, gw - l1, h, av, value);
    y += h;
  };
  const s = student.student;
  pair('DRE', report.school.dre ?? '', 'UGEL', report.school.ugel ?? '');
  pair('NIVEL', report.section.levelName, 'CÓDIGO MODULAR', report.school.modularCode ?? '');
  single('INSTITUCIÓN EDUCATIVA', report.school.name);
  pair('GRADO', report.section.gradeLabel, 'SECCIÓN', report.section.name);
  single('APELLIDOS Y NOMBRES', `${studentName(s)}${s.withdrawnOn ? ` (retiro: ${formatDay(s.withdrawnOn)})` : ''}`);
  pair('CÓDIGO DEL ESTUDIANTE', s.siagieCode ?? '', 'DNI', s.document ?? '');
  return Math.max(y, MARGIN + box) + 8;
};

const tableHeader = (doc: Doc, flow: Flow, report: SectionReport) => {
  const x = flow.x;
  const n = report.periods.length;
  const compW = COL_W - AREA_W - n * PERIOD_W - FINAL_W;
  const head: CellOptions = { fill: GREY, bold: true, size: 6, align: 'center' };
  const y = flow.y;
  const top = HEAD_H - 10;
  cell(doc, x, y, AREA_W, HEAD_H, 'ÁREA CURRICULAR', head);
  cell(doc, x + AREA_W, y, compW, HEAD_H, 'COMPETENCIAS', head);
  cell(doc, x + AREA_W + compW, y, n * PERIOD_W, top, 'CALIFICATIVO POR PERIODO', { ...head, size: 5.3, pad: 1 });
  report.periods.forEach((p, i) => cell(doc, x + AREA_W + compW + i * PERIOD_W, y + top, PERIOD_W, 10, String(p.number), { ...head, pad: 1 }));
  cell(doc, x + AREA_W + compW + n * PERIOD_W, y, FINAL_W, HEAD_H, 'NIVEL DE LOGRO FINAL', { ...head, size: 5.3, pad: 1 });
  flow.y += HEAD_H;
};

const areaBlock = (doc: Doc, report: SectionReport, area: ReportArea) => {
  const n = report.periods.length;
  const compW = COL_W - AREA_W - n * PERIOD_W - FINAL_W;
  const rows = area.competencies.map((c) => Math.max(12, textHeight(doc, c.name, compW - 6, { size: 6.6 }) + 4));
  const areaText = area.name;
  const note = area.workshops.length ? `Incluye: ${area.workshops.join(', ')}` : '';
  const needed = textHeight(doc, areaText, AREA_W - 6, { bold: true, size: 6.8, align: 'center' })
    + (note ? textHeight(doc, note, AREA_W - 6, { italic: true, size: 5.6, align: 'center' }) + 2 : 0) + 6;
  const total = rows.reduce((a, b) => a + b, 0);
  if (total < needed && rows.length) rows[rows.length - 1] += needed - total;
  return { rows, height: Math.max(total, needed), note, compW };
};

const drawArea = (doc: Doc, flow: Flow, report: SectionReport, area: ReportArea) => {
  const block = areaBlock(doc, report, area);
  if (flow.ensure(block.height)) tableHeader(doc, flow, report);
  const x = flow.x;
  const y = flow.y;
  // Celda del área (con los talleres que incluye).
  doc.rect(x, y, AREA_W, block.height).lineWidth(0.6).strokeColor(LINE).stroke();
  const nameH = textHeight(doc, area.name, AREA_W - 6, { bold: true, size: 6.8, align: 'center' });
  const noteH = block.note ? textHeight(doc, block.note, AREA_W - 6, { italic: true, size: 5.6, align: 'center' }) + 2 : 0;
  const top = y + Math.max(2, (block.height - nameH - noteH) / 2);
  doc.font('Helvetica-Bold').fontSize(6.8).fillColor(TEXT).text(area.name, x + 3, top, { width: AREA_W - 6, align: 'center', lineGap: 0 });
  if (block.note) {
    doc.font('Helvetica-Oblique').fontSize(5.6).fillColor(MUTED).text(block.note, x + 3, top + nameH + 2, { width: AREA_W - 6, align: 'center', lineGap: 0 });
  }
  let rowY = y;
  area.competencies.forEach((competency, i) => {
    const h = block.rows[i];
    cell(doc, x + AREA_W, rowY, block.compW, h, competency.name, { size: 6.6 });
    competency.grades.forEach((grade, p) => {
      cell(doc, x + AREA_W + block.compW + p * PERIOD_W, rowY, PERIOD_W, h, grade ?? '', { bold: true, size: 7.2, align: 'center', pad: 1 });
    });
    cell(doc, x + AREA_W + block.compW + report.periods.length * PERIOD_W, rowY, FINAL_W, h, report.showFinal ? competency.final ?? '' : '', { bold: true, size: 7.2, align: 'center', pad: 1 });
    rowY += h;
  });
  flow.y += block.height;
};

const drawConclusions = (doc: Doc, flow: Flow, report: SectionReport, student: StudentReport) => {
  const periodW = 40;
  const textW = COL_W - periodW;
  const head: CellOptions = { fill: GREY, bold: true, size: 7, align: 'center' };
  const title = () => {
    cell(doc, flow.x, flow.y, periodW, 14, 'Periodo', head);
    cell(doc, flow.x + periodW, flow.y, textW, 14, 'Conclusión descriptiva por periodo', head);
    flow.y += 14;
  };
  flow.y += 10;
  const rows = report.periods.map((period, i) => {
    const text = student.conclusions[i].map((c) => `${c.area} – ${c.competency}: ${c.text}`).join('\n');
    return { label: String(period.number), text, height: Math.max(15, text ? textHeight(doc, text, textW - 6, { size: 6.4 }) + 6 : 15) };
  });
  // La tabla va entera en una columna si cabe en una (como en el formato); si no, el título viaja con la primera fila.
  const total = 14 + rows.reduce((sum, row) => sum + row.height, 0);
  flow.ensure(total <= BOTTOM - MARGIN ? total : 14 + rows[0].height);
  title();
  for (const row of rows) {
    const height = Math.min(row.height, BOTTOM - MARGIN - 14);
    if (flow.ensure(height)) title();
    cell(doc, flow.x, flow.y, periodW, height, row.label, { size: 8, align: 'center' });
    cell(doc, flow.x + periodW, flow.y, textW, height, row.text, { size: 6.4, valign: 'top' });
    flow.y += height;
  }
};

const drawAttendance = (doc: Doc, flow: Flow, report: SectionReport, student: StudentReport) => {
  const n = report.periods.length;
  const height = 16 + 13 + 12 + n * 13;
  flow.y += 10;
  flow.ensure(height);
  const x = flow.x;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT).text('Resumen de asistencia del estudiante', x, flow.y, { width: COL_W, align: 'center' });
  flow.y += 16;
  const pw = 56;
  const cw = (COL_W - pw) / 4;
  const head: CellOptions = { fill: GREY, bold: true, size: 6.6, align: 'center' };
  cell(doc, x, flow.y, pw, 25, 'Periodo', head);
  cell(doc, x + pw, flow.y, cw * 2, 13, 'Inasistencias', head);
  cell(doc, x + pw + cw * 2, flow.y, cw * 2, 13, 'Tardanzas', head);
  ['Justificadas', 'Injustificadas', 'Justificadas', 'Injustificadas'].forEach((t, i) => cell(doc, x + pw + cw * i, flow.y + 13, cw, 12, t, head));
  flow.y += 25;
  report.periods.forEach((period, i) => {
    const a = student.attendance[i];
    const values = a ? [a.absentJustified, a.absentUnjustified, a.lateJustified, a.lateUnjustified].map(String) : ['', '', '', ''];
    cell(doc, x, flow.y, pw, 13, String(period.number), { size: 7.5, align: 'center' });
    values.forEach((v, j) => cell(doc, x + pw + cw * j, flow.y, cw, 13, v, { size: 7.5, align: 'center' }));
    flow.y += 13;
  });
};

const drawSignatures = (doc: Doc, flow: Flow, report: SectionReport) => {
  const height = 46;
  flow.y += 14;
  flow.ensure(height);
  // Abajo de la columna, como en el formato (si hay espacio).
  const y = Math.max(flow.y + 22, BOTTOM - 30);
  const half = COL_W / 2;
  const sign = (cx: number, caption: string, name: string | null) => {
    doc.moveTo(cx - 70, y).lineTo(cx + 70, y).lineWidth(0.6).strokeColor(LINE).stroke();
    doc.font('Helvetica').fontSize(6.6).fillColor(TEXT).text(caption, cx - 90, y + 3, { width: 180, align: 'center' });
    if (name) doc.font('Helvetica-Bold').fontSize(6.6).fillColor(MUTED).text(name, cx - 90, y + 12, { width: 180, align: 'center' });
  };
  sign(flow.x + half / 2, 'Firma y sello del Docente o Tutor(a)', report.section.tutor);
  sign(flow.x + half + half / 2, 'Firma y sello del Director(a)', report.school.directorName);
  flow.y = y + 24;
};

const footer = (doc: Doc, report: SectionReport) => {
  if (!report.preview) return;
  const period = report.periods.find((p) => p.code === report.upTo);
  doc.font('Helvetica-Oblique').fontSize(6).fillColor(MUTED)
    .text(`Vista previa: el bimestre ${period?.number ?? ''} aún está abierto y sus notas pueden cambiar.`, MARGIN, PAGE_H - 13, { width: PAGE_W - 2 * MARGIN, align: 'center', lineBreak: false });
};

export const libretaPdfService = {
  async render(report: SectionReport, images: { logo: Buffer | null; minedu: Buffer | null }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc: Doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, autoFirstPage: false, info: { Title: `Libretas ${report.section.label} ${report.year.name}` } });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      for (const student of report.students) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
        footer(doc, report);
        const flow = new Flow(doc, () => footer(doc, report));
        flow.y = drawHeader(doc, report, student, images);
        tableHeader(doc, flow, report);
        for (const area of student.areas) if (area.competencies.length) drawArea(doc, flow, report, area);
        drawConclusions(doc, flow, report, student);
        drawAttendance(doc, flow, report, student);
        drawSignatures(doc, flow, report);
      }
      if (report.students.length === 0) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
        doc.font('Helvetica').fontSize(10).fillColor(TEXT).text('Esta sección no tiene estudiantes.', MARGIN, MARGIN);
      }
      doc.end();
    });
  },
};
