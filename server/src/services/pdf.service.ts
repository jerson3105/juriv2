import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

interface StudentCard {
  displayName: string;
  linkCode: string;
  characterClass: string;
  classroomName: string;
  classroomCode: string;
}

const CLASS_COLORS: Record<string, string> = {
  GUARDIAN: '#3b82f6',
  ARCANE: '#8b5cf6',
  EXPLORER: '#22c55e',
  ALCHEMIST: '#f97316',
};

const CLASS_NAMES: Record<string, string> = {
  GUARDIAN: 'Guardián',
  ARCANE: 'Arcano',
  EXPLORER: 'Explorador',
  ALCHEMIST: 'Alquimista',
};

// Símbolos ASCII para las clases (PDFKit no soporta emojis)
const CLASS_SYMBOLS: Record<string, string> = {
  GUARDIAN: '[G]',
  ARCANE: '[A]',
  EXPLORER: '[E]',
  ALCHEMIST: '[Q]',
};

/** Enlace de la puerta del alumno con el código de su clase (el QR solo abre la puerta: el PIN se pide igual). */
const joinUrl = (appUrl: string, classroomCode: string) => `${appUrl.replace(/\/+$/, '')}/unirse/${classroomCode}`;
const shortHost = (appUrl: string) => appUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
const qrFor = (url: string, width = 360) => QRCode.toBuffer(url, { errorCorrectionLevel: 'M', margin: 1, width, color: { dark: '#0f172a', light: '#ffffff' } });

/** Enlace y QR (SVG) de la puerta de la clase, para proyectarlo en el aula. */
export const classJoinUrl = joinUrl;
export const classJoinQrSvg = (appUrl: string, classroomCode: string) =>
  QRCode.toString(joinUrl(appUrl, classroomCode), { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0f172a', light: '#ffffff' } });

export class PDFService {
  // Generar PDF con tarjetas de vinculación para estudiantes
  async generateStudentCards(
    students: StudentCard[],
    appUrl: string
  ): Promise<Buffer> {
    const qrByClass = new Map<string, Buffer>();
    for (const code of new Set(students.map((st) => st.classroomCode))) {
      qrByClass.set(code, await qrFor(joinUrl(appUrl, code)));
    }
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        margin: 40,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 80; // margins
      const cardWidth = (pageWidth - 20) / 2; // 2 columns with gap
      const cardHeight = 220;
      const cardsPerPage = 6; // 2 columns x 3 rows

      students.forEach((student, index) => {
        // Nueva página cada 6 tarjetas
        if (index > 0 && index % cardsPerPage === 0) {
          doc.addPage();
        }

        const positionOnPage = index % cardsPerPage;
        const col = positionOnPage % 2;
        const row = Math.floor(positionOnPage / 2);

        const x = 40 + col * (cardWidth + 20);
        const y = 40 + row * (cardHeight + 15);

        this.drawStudentCard(doc, student, x, y, cardWidth, cardHeight, appUrl, qrByClass.get(student.classroomCode)!);
      });

      doc.end();
    });
  }

  private drawStudentCard(
    doc: PDFKit.PDFDocument,
    student: StudentCard,
    x: number,
    y: number,
    width: number,
    height: number,
    appUrl: string,
    qr: Buffer
  ) {
    const classColor = CLASS_COLORS[student.characterClass] || '#3b82f6';
    const className = CLASS_NAMES[student.characterClass] || student.characterClass;
    const classSymbol = CLASS_SYMBOLS[student.characterClass] || '';

    // Fondo de la tarjeta con borde redondeado
    doc
      .roundedRect(x, y, width, height, 10)
      .fillAndStroke('#f8fafc', '#e2e8f0');

    // Header con color de clase
    doc
      .roundedRect(x, y, width, 50, 10)
      .fill(classColor);
    
    // Cubrir esquinas inferiores del header
    doc
      .rect(x, y + 40, width, 10)
      .fill(classColor);

    // Logo/Título
    doc
      .fontSize(16)
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .text('JURIED', x + 15, y + 10, { width: width - 30 });

    doc
      .fontSize(9)
      .fillColor('#ffffff')
      .font('Helvetica')
      .text('Gamificación Educativa', x + 15, y + 28, { width: width - 30 });

    // Símbolo de clase en el header (opcional)
    if (classSymbol) {
      doc
        .fontSize(14)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text(classSymbol, x + width - 45, y + 18);
    }

    // Nombre del estudiante
    doc
      .fontSize(14)
      .fillColor('#1e293b')
      .font('Helvetica-Bold')
      .text(student.displayName, x + 12, y + 58, { width: width - 24, align: 'center', height: 18, ellipsis: true });

    doc
      .moveTo(x + 12, y + 80)
      .lineTo(x + width - 12, y + 80)
      .strokeColor('#e2e8f0')
      .stroke();

    // Códigos a la izquierda, QR de la clase a la derecha
    const qrSize = 74;
    const textWidth = width - qrSize - 34;
    doc.fontSize(8).fillColor('#475569').font('Helvetica')
      .text('Primera vez, tu código:', x + 12, y + 88, { width: textWidth });
    doc.fontSize(20).fillColor(classColor).font('Helvetica-Bold')
      .text(student.linkCode, x + 12, y + 99, { width: textWidth, characterSpacing: 3 });
    doc.fontSize(8).fillColor('#475569').font('Helvetica')
      .text('Código de tu clase:', x + 12, y + 126, { width: textWidth });
    doc.fontSize(12).fillColor('#1e293b').font('Helvetica-Bold')
      .text(student.classroomCode, x + 12, y + 137, { width: textWidth, characterSpacing: 2 });
    doc.image(qr, x + width - qrSize - 12, y + 86, { width: qrSize, height: qrSize });

    // Pasos
    const steps = [
      `1. Entra a ${shortHost(appUrl)}/unirse o escanea el QR`,
      '2. Primera vez: escribe tu código y crea un PIN de 4 números',
      '3. Después: código de tu clase, tu nombre y tu PIN',
    ];
    steps.forEach((step, i) => {
      doc.fontSize(7).fillColor('#334155').font('Helvetica')
        .text(step, x + 12, y + 166 + (i * 10), { width: width - 24 });
    });

    doc
      .fontSize(7)
      .fillColor('#64748b')
      .text(`Clase: ${student.classroomName} · No compartas tu PIN`, x + 12, y + height - 14, {
        width: width - 24,
        align: 'center'
      });
  }

  // Generar PDF de una sola tarjeta (más grande)
  async generateSingleCard(
    student: StudentCard,
    appUrl: string
  ): Promise<Buffer> {
    const qr = await qrFor(joinUrl(appUrl, student.classroomCode));
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A5',
        layout: 'landscape',
        margin: 30,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const classColor = CLASS_COLORS[student.characterClass] || '#3b82f6';
      const className = CLASS_NAMES[student.characterClass] || student.characterClass;
      const classSymbol = CLASS_SYMBOLS[student.characterClass] || '';

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;

      // Fondo
      doc.rect(0, 0, pageWidth, pageHeight).fill('#f8fafc');

      // Header con color
      doc.rect(0, 0, pageWidth, 80).fill(classColor);

      // Logo
      doc
        .fontSize(28)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text('JURIED', 30, 20);

      doc
        .fontSize(12)
        .fillColor('#ffffff')
        .font('Helvetica')
        .text('Plataforma de Gamificación Educativa', 30, 50);

      // Símbolo de clase
      if (classSymbol) {
        doc
          .fontSize(20)
          .fillColor('#ffffff')
          .font('Helvetica-Bold')
          .text(classSymbol, pageWidth - 60, 30);
      }

      // Contenido principal
      const contentY = 100;

      // Nombre del estudiante
      doc
        .fontSize(24)
        .fillColor('#1e293b')
        .font('Helvetica-Bold')
        .text(`¡Bienvenido/a, ${student.displayName}!`, 30, contentY, {
          width: pageWidth - 60,
          align: 'center'
        });

      // Clase de personaje
      doc
        .fontSize(12)
        .fillColor('#64748b')
        .font('Helvetica')
        .text(`Tu clase de personaje: ${className}`, 30, contentY + 32, {
          width: pageWidth - 60,
          align: 'center'
        });

      // Códigos a la izquierda, QR de la clase a la derecha
      const qrSize = 120;
      const qrX = pageWidth - qrSize - 50;
      const colWidth = qrX - 80;
      doc.fontSize(11).fillColor('#475569').font('Helvetica')
        .text('Primera vez, tu código personal:', 50, contentY + 62, { width: colWidth });
      doc
        .roundedRect(50, contentY + 80, 200, 46, 8)
        .lineWidth(2)
        .strokeColor(classColor)
        .stroke();
      doc.fontSize(28).fillColor(classColor).font('Helvetica-Bold')
        .text(student.linkCode, 50, contentY + 89, { width: 200, align: 'center', characterSpacing: 5 });
      doc.fontSize(11).fillColor('#475569').font('Helvetica')
        .text('Código de tu clase:', 50, contentY + 138, { width: colWidth });
      doc.fontSize(18).fillColor('#1e293b').font('Helvetica-Bold')
        .text(student.classroomCode, 50, contentY + 153, { width: colWidth, characterSpacing: 3 });
      doc.image(qr, qrX, contentY + 62, { width: qrSize, height: qrSize });
      doc.fontSize(9).fillColor('#475569').font('Helvetica')
        .text('Escanéalo para abrir tu clase', qrX - 10, contentY + 62 + qrSize + 4, { width: qrSize + 20, align: 'center' });

      // Instrucciones
      const instructions = [
        `1. Entra a ${shortHost(appUrl)}/unirse o escanea el QR`,
        '2. Primera vez: escribe tu código personal, confirma que eres tú y crea un PIN de 4 números',
        '3. Las siguientes veces: código de tu clase, elige tu nombre y escribe tu PIN',
        '4. No le digas tu PIN a nadie. Si lo olvidas, tu profe te da una tarjeta nueva',
      ];
      instructions.forEach((instruction, i) => {
        doc
          .fontSize(10)
          .fillColor('#334155')
          .font('Helvetica')
          .text(instruction, 50, contentY + 198 + (i * 15), {
            width: pageWidth - 100,
          });
      });

      // Footer
      doc
        .fontSize(9)
        .fillColor('#94a3b8')
        .text(`Clase: ${student.classroomName}`, 30, pageHeight - 48, {
          width: pageWidth - 60,
          align: 'center'
        });

      doc.end();
    });
  }

  /**
   * Póster de la clase para pegar en el aula: QR grande a /unirse/<código>, el código y los pasos.
   * El QR solo abre la puerta de la clase: cada alumno entra con su PIN (o su cuenta).
   */
  async generateClassPoster(classroom: { name: string; code: string }, appUrl: string): Promise<Buffer> {
    const qr = await qrFor(joinUrl(appUrl, classroom.code), 900);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width;
      const H = doc.page.height;
      const indigo = '#1e1b4b';
      const accent = '#4f46e5';

      // Franja nocturna superior
      doc.rect(0, 0, W, 150).fill(indigo);
      doc.fontSize(12).fillColor('#c7d2fe').font('Helvetica-Bold')
        .text('JURIED', 0, 34, { width: W, align: 'center', characterSpacing: 4 });
      doc.fontSize(34).fillColor('#ffffff').font('Helvetica-Bold')
        .text('Únete a tu clase', 0, 56, { width: W, align: 'center' });
      doc.fontSize(16).fillColor('#e0e7ff').font('Helvetica')
        .text(classroom.name, 50, 104, { width: W - 100, align: 'center', height: 22, ellipsis: true });

      // QR grande
      const qrSize = 300;
      const qrX = (W - qrSize) / 2;
      const qrY = 182;
      doc.roundedRect(qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 16).lineWidth(3).strokeColor(accent).stroke();
      doc.image(qr, qrX, qrY, { width: qrSize, height: qrSize });

      // Código y dirección
      doc.fontSize(12).fillColor('#475569').font('Helvetica')
        .text('Código de la clase', 0, qrY + qrSize + 34, { width: W, align: 'center' });
      doc.fontSize(40).fillColor('#0f172a').font('Helvetica-Bold')
        .text(classroom.code, 0, qrY + qrSize + 52, { width: W, align: 'center', characterSpacing: 8 });
      doc.fontSize(14).fillColor(accent).font('Helvetica-Bold')
        .text(`${shortHost(appUrl)}/unirse`, 0, qrY + qrSize + 102, { width: W, align: 'center' });

      // Pasos
      const steps = [
        'Escanea el QR con la cámara (o entra a la página y escribe el código).',
        'Toca tu nombre en la lista.',
        'Escribe tu PIN. ¿Es tu primera vez? Usa la tarjeta que te dio tu profe.',
      ];
      const boxY = qrY + qrSize + 136;
      doc.roundedRect(70, boxY, W - 140, 104, 12).fill('#eef2ff');
      steps.forEach((step, i) => {
        const y = boxY + 16 + i * 28;
        doc.circle(98, y + 7, 10).fill(accent);
        doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold').text(String(i + 1), 88, y + 1, { width: 20, align: 'center' });
        doc.fontSize(12).fillColor('#1e293b').font('Helvetica').text(step, 118, y, { width: W - 210 });
      });

      doc.fontSize(10).fillColor('#64748b').font('Helvetica')
        .text('El QR solo abre la clase: cada alumno entra con su propio PIN. No compartas tu PIN.', 40, H - 46, { width: W - 80, align: 'center', lineBreak: false });

      doc.end();
    });
  }

  /**
   * Tarjetas de acceso de un colegio (6 por hoja): su tarjeta de un solo uso con su QR, el código del colegio y los pasos.
   * Solo van quienes aún no tienen PIN: con la tarjeta lo crean; después entran con el código del colegio, DNI y PIN.
   */
  async generateSchoolAccessCards(
    school: { name: string; studentCode: string },
    cards: Array<{ name: string; section: string; code: string }>,
    appUrl: string,
  ): Promise<Buffer> {
    const qrs = await Promise.all(cards.map((card) => qrFor(joinUrl(appUrl, card.code))));
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const blue = '#2563eb';
      const width = (doc.page.width - 80 - 20) / 2;
      const height = 220;
      cards.forEach((card, index) => {
        if (index > 0 && index % 6 === 0) doc.addPage();
        const slot = index % 6;
        const x = 40 + (slot % 2) * (width + 20);
        const y = 40 + Math.floor(slot / 2) * (height + 15);

        doc.roundedRect(x, y, width, height, 10).fillAndStroke('#f8fafc', '#e2e8f0');
        doc.roundedRect(x, y, width, 46, 10).fill(blue);
        doc.rect(x, y + 36, width, 10).fill(blue);
        doc.fontSize(13).fillColor('#ffffff').font('Helvetica-Bold').text('JURIED', x + 14, y + 9, { width: width - 28 });
        doc.fontSize(9).fillColor('#dbeafe').font('Helvetica')
          .text(school.name, x + 14, y + 26, { width: width - 28, height: 12, ellipsis: true });

        doc.fontSize(13).fillColor('#1e293b').font('Helvetica-Bold')
          .text(card.name, x + 12, y + 54, { width: width - 24, align: 'center', height: 17, ellipsis: true });
        doc.fontSize(8).fillColor('#475569').font('Helvetica')
          .text(card.section, x + 12, y + 71, { width: width - 24, align: 'center' });
        doc.moveTo(x + 12, y + 84).lineTo(x + width - 12, y + 84).strokeColor('#e2e8f0').stroke();

        const qrSize = 74;
        const textWidth = width - qrSize - 34;
        doc.fontSize(8).fillColor('#475569').font('Helvetica').text('Primera vez, tu tarjeta:', x + 12, y + 92, { width: textWidth });
        doc.fontSize(20).fillColor(blue).font('Helvetica-Bold').text(card.code, x + 12, y + 103, { width: textWidth, characterSpacing: 3 });
        doc.fontSize(8).fillColor('#475569').font('Helvetica').text('Código del colegio:', x + 12, y + 130, { width: textWidth });
        doc.fontSize(12).fillColor('#1e293b').font('Helvetica-Bold').text(school.studentCode, x + 12, y + 141, { width: textWidth, characterSpacing: 2 });
        doc.image(qrs[index], x + width - qrSize - 12, y + 90, { width: qrSize, height: qrSize });

        [
          `1. Entra a ${shortHost(appUrl)}/unirse o escanea el QR`,
          '2. Primera vez: escribe tu tarjeta y crea un PIN de 4 números',
          '3. Después: código del colegio, tu DNI y tu PIN',
        ].forEach((step, i) => {
          doc.fontSize(7).fillColor('#334155').font('Helvetica').text(step, x + 12, y + 168 + i * 10, { width: width - 24 });
        });
        doc.fontSize(7).fillColor('#64748b')
          .text('Tarjeta de un solo uso · No compartas tu PIN', x + 12, y + height - 14, { width: width - 24, align: 'center' });
      });
      doc.end();
    });
  }

  /** Póster del colegio: QR grande a /unirse/<código del colegio>, el código y los pasos (DNI y PIN). */
  async generateSchoolPoster(school: { name: string; studentCode: string }, appUrl: string): Promise<Buffer> {
    const qr = await qrFor(joinUrl(appUrl, school.studentCode), 900);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width;
      const H = doc.page.height;
      const indigo = '#1e1b4b';
      const accent = '#4f46e5';
      doc.rect(0, 0, W, 150).fill(indigo);
      doc.fontSize(12).fillColor('#c7d2fe').font('Helvetica-Bold').text('JURIED', 0, 34, { width: W, align: 'center', characterSpacing: 4 });
      doc.fontSize(34).fillColor('#ffffff').font('Helvetica-Bold').text('Entra a Juried', 0, 56, { width: W, align: 'center' });
      doc.fontSize(16).fillColor('#e0e7ff').font('Helvetica').text(school.name, 50, 104, { width: W - 100, align: 'center', height: 22, ellipsis: true });

      const qrSize = 300;
      const qrX = (W - qrSize) / 2;
      const qrY = 182;
      doc.roundedRect(qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 16).lineWidth(3).strokeColor(accent).stroke();
      doc.image(qr, qrX, qrY, { width: qrSize, height: qrSize });

      doc.fontSize(12).fillColor('#475569').font('Helvetica').text('Código del colegio', 0, qrY + qrSize + 34, { width: W, align: 'center' });
      doc.fontSize(40).fillColor('#0f172a').font('Helvetica-Bold').text(school.studentCode, 0, qrY + qrSize + 52, { width: W, align: 'center', characterSpacing: 8 });
      doc.fontSize(14).fillColor(accent).font('Helvetica-Bold').text(`${shortHost(appUrl)}/unirse`, 0, qrY + qrSize + 102, { width: W, align: 'center' });

      const steps = [
        'Escanea el QR con la cámara (o entra a la página y escribe el código).',
        'Escribe tu DNI.',
        'Escribe tu PIN. ¿Es tu primera vez? Usa la tarjeta que te dio tu tutor.',
      ];
      const boxY = qrY + qrSize + 136;
      doc.roundedRect(70, boxY, W - 140, 104, 12).fill('#eef2ff');
      steps.forEach((step, i) => {
        const y = boxY + 16 + i * 28;
        doc.circle(98, y + 7, 10).fill(accent);
        doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold').text(String(i + 1), 88, y + 1, { width: 20, align: 'center' });
        doc.fontSize(12).fillColor('#1e293b').font('Helvetica').text(step, 118, y, { width: W - 210 });
      });
      doc.fontSize(10).fillColor('#64748b').font('Helvetica')
        .text('El QR solo abre la puerta del colegio: cada estudiante entra con su DNI y su propio PIN.', 40, H - 46, { width: W - 80, align: 'center', lineBreak: false });
      doc.end();
    });
  }

  // Generar PDF de reporte de asistencia general (formato planilla escolar)
  async generateAttendanceReport(
    classroomName: string,
    students: Array<{
      id: string;
      name: string;
      attendance: Record<string, string>;
      present: number;
      absent: number;
      late: number;
      rate: number;
    }>,
    dates: string[]
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 25,
        layout: 'landscape',
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 25;
      const contentWidth = pageWidth - margin * 2;

      // Configuración de columnas
      const nameColWidth = 140;
      const dateColWidth = 22;
      const summaryColWidth = 30;
      const maxDatesPerPage = Math.floor((contentWidth - nameColWidth - summaryColWidth * 4 - 10) / dateColWidth);
      
      // Dividir fechas en páginas si hay muchas
      const datesToShow = dates.slice(0, Math.min(dates.length, maxDatesPerPage));

      // ========== HEADER ==========
      doc.rect(0, 0, pageWidth, 50).fill('#1e3a5f');

      doc
        .fontSize(18)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text('CONTROL DE ASISTENCIA', margin, 12, { width: contentWidth, align: 'center' });

      doc
        .fontSize(11)
        .fillColor('#94a3b8')
        .font('Helvetica')
        .text(classroomName, margin, 32, { width: contentWidth, align: 'center' });

      // ========== INFORMACIÓN ==========
      const infoY = 60;

      // Cuadro izquierdo - Información
      doc.roundedRect(margin, infoY, 280, 55, 3).stroke('#e2e8f0');
      
      doc.fontSize(8).fillColor('#64748b').font('Helvetica').text('CLASE:', margin + 10, infoY + 8);
      doc.fontSize(10).fillColor('#1e293b').font('Helvetica-Bold').text(classroomName, margin + 50, infoY + 7);
      
      doc.fontSize(8).fillColor('#64748b').font('Helvetica').text('PERÍODO:', margin + 10, infoY + 22);
      const periodText = dates.length > 0 
        ? `${this.formatDateShort(dates[0])} al ${this.formatDateShort(dates[dates.length - 1])}`
        : 'Sin registros';
      doc.fontSize(9).fillColor('#1e293b').font('Helvetica').text(periodText, margin + 55, infoY + 21);

      doc.fontSize(8).fillColor('#64748b').font('Helvetica').text('GENERADO:', margin + 10, infoY + 36);
      doc.fontSize(9).fillColor('#1e293b').font('Helvetica').text(
        new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }), 
        margin + 60, infoY + 35
      );

      // Cuadro derecho - Leyenda
      const legendBoxX = pageWidth - margin - 200;
      doc.roundedRect(legendBoxX, infoY, 200, 55, 3).stroke('#e2e8f0');
      
      doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold').text('LEYENDA', legendBoxX + 10, infoY + 6);
      
      // Símbolos de leyenda
      const symbols = [
        { symbol: 'A', label: 'Asistencia', color: '#16a34a', bgColor: '#dcfce7' },
        { symbol: 'F', label: 'Falta', color: '#dc2626', bgColor: '#fef2f2' },
        { symbol: 'T', label: 'Tardanza', color: '#d97706', bgColor: '#fef3c7' },
      ];

      symbols.forEach((s, i) => {
        const symX = legendBoxX + 10 + i * 65;
        const symY = infoY + 25;
        
        doc.roundedRect(symX, symY, 18, 18, 2).fill(s.bgColor);
        doc.fontSize(10).fillColor(s.color).font('Helvetica-Bold').text(s.symbol, symX + 5, symY + 4);
        doc.fontSize(7).fillColor('#64748b').font('Helvetica').text(s.label, symX + 2, symY + 20);
      });

      // ========== TABLA PRINCIPAL ==========
      const tableY = infoY + 65;
      const rowHeight = 18;
      const headerHeight = 35;

      // Calcular anchos
      const totalDateWidth = datesToShow.length * dateColWidth;
      const tableWidth = nameColWidth + totalDateWidth + summaryColWidth * 4 + 10;

      // Header de tabla - fila 1 (fechas agrupadas)
      let currentX = margin;
      
      // Celda de nombre (header)
      doc.rect(currentX, tableY, nameColWidth, headerHeight).fill('#1e3a5f');
      doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold')
        .text('N°', currentX + 5, tableY + 5, { width: 20 })
        .text('APELLIDOS Y NOMBRES', currentX + 25, tableY + 12, { width: nameColWidth - 30 });
      currentX += nameColWidth;

      // Celdas de fechas
      datesToShow.forEach((date) => {
        doc.rect(currentX, tableY, dateColWidth, headerHeight).fill('#2563eb').stroke('#1e40af');
        
        // Parsear fecha manualmente para evitar problemas de zona horaria
        const [year, month, day] = date.split('-').map(Number);
        const dayNum = day.toString();
        // Crear fecha con hora del mediodía para evitar problemas de zona horaria
        const d = new Date(year, month - 1, day, 12, 0, 0);
        const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' }).charAt(0).toUpperCase();
        
        doc.fontSize(7).fillColor('#ffffff').font('Helvetica-Bold')
          .text(dayNum, currentX, tableY + 8, { width: dateColWidth, align: 'center' });
        doc.fontSize(6).fillColor('#bfdbfe').font('Helvetica')
          .text(dayName, currentX, tableY + 20, { width: dateColWidth, align: 'center' });
        
        currentX += dateColWidth;
      });

      // Celdas de resumen
      const summaryHeaders = [
        { label: 'ASIST', color: '#16a34a', bg: '#dcfce7' },
        { label: 'FALT', color: '#dc2626', bg: '#fef2f2' },
        { label: 'TARD', color: '#d97706', bg: '#fef3c7' },
        { label: '%', color: '#1e40af', bg: '#dbeafe' },
      ];

      summaryHeaders.forEach((h) => {
        doc.rect(currentX, tableY, summaryColWidth, headerHeight).fill(h.bg).stroke('#e2e8f0');
        doc.fontSize(6).fillColor(h.color).font('Helvetica-Bold')
          .text(h.label, currentX, tableY + 14, { width: summaryColWidth, align: 'center' });
        currentX += summaryColWidth;
      });

      // Filas de estudiantes
      let rowY = tableY + headerHeight;
      const maxRowsPerPage = Math.floor((pageHeight - tableY - headerHeight - 50) / rowHeight);

      students.forEach((student, index) => {
        if (index > 0 && index % maxRowsPerPage === 0) {
          doc.addPage();
          
          // Header en nueva página
          doc.rect(0, 0, pageWidth, 30).fill('#1e3a5f');
          doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold')
            .text(`CONTROL DE ASISTENCIA - ${classroomName} (continuación)`, margin, 8, { width: contentWidth, align: 'center' });
          
          rowY = 45;
          
          // Repetir header de tabla
          currentX = margin;
          doc.rect(currentX, rowY, nameColWidth, headerHeight).fill('#1e3a5f');
          doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold')
            .text('N°', currentX + 5, rowY + 5, { width: 20 })
            .text('APELLIDOS Y NOMBRES', currentX + 25, rowY + 12, { width: nameColWidth - 30 });
          currentX += nameColWidth;

          datesToShow.forEach((date) => {
            doc.rect(currentX, rowY, dateColWidth, headerHeight).fill('#2563eb').stroke('#1e40af');
            // Parsear fecha manualmente para evitar problemas de zona horaria
            const [year, month, day] = date.split('-').map(Number);
            const d = new Date(year, month - 1, day, 12, 0, 0);
            doc.fontSize(7).fillColor('#ffffff').font('Helvetica-Bold')
              .text(day.toString(), currentX, rowY + 8, { width: dateColWidth, align: 'center' });
            doc.fontSize(6).fillColor('#bfdbfe').font('Helvetica')
              .text(d.toLocaleDateString('es-ES', { weekday: 'short' }).charAt(0).toUpperCase(), currentX, rowY + 20, { width: dateColWidth, align: 'center' });
            currentX += dateColWidth;
          });

          summaryHeaders.forEach((h) => {
            doc.rect(currentX, rowY, summaryColWidth, headerHeight).fill(h.bg).stroke('#e2e8f0');
            doc.fontSize(6).fillColor(h.color).font('Helvetica-Bold')
              .text(h.label, currentX, rowY + 14, { width: summaryColWidth, align: 'center' });
            currentX += summaryColWidth;
          });

          rowY += headerHeight;
        }

        // Alternar color de fondo
        const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        
        currentX = margin;

        // Número y nombre
        doc.rect(currentX, rowY, nameColWidth, rowHeight).fill(bgColor).stroke('#e2e8f0');
        doc.fontSize(7).fillColor('#94a3b8').font('Helvetica')
          .text((index + 1).toString(), currentX + 5, rowY + 5, { width: 18 });
        doc.fontSize(8).fillColor('#1e293b').font('Helvetica')
          .text(student.name.substring(0, 22), currentX + 22, rowY + 5, { width: nameColWidth - 27 });
        currentX += nameColWidth;

        // Celdas de asistencia por fecha
        datesToShow.forEach((date) => {
          const status = student.attendance[date];
          let symbol = '';
          let symbolColor = '#94a3b8';
          let cellBg = bgColor;

          if (status === 'PRESENT') {
            symbol = 'A';
            symbolColor = '#16a34a';
            cellBg = '#f0fdf4';
          } else if (status === 'ABSENT') {
            symbol = 'F';
            symbolColor = '#dc2626';
            cellBg = '#fef2f2';
          } else if (status === 'LATE') {
            symbol = 'T';
            symbolColor = '#d97706';
            cellBg = '#fef3c7';
          } else if (status === 'EXCUSED') {
            symbol = 'J';
            symbolColor = '#2563eb';
            cellBg = '#eff6ff';
          }

          doc.rect(currentX, rowY, dateColWidth, rowHeight).fill(cellBg).stroke('#e2e8f0');
          if (symbol) {
            doc.fontSize(9).fillColor(symbolColor).font('Helvetica-Bold')
              .text(symbol, currentX, rowY + 4, { width: dateColWidth, align: 'center' });
          }
          currentX += dateColWidth;
        });

        // Celdas de resumen
        // Asistencias
        doc.rect(currentX, rowY, summaryColWidth, rowHeight).fill('#f0fdf4').stroke('#e2e8f0');
        doc.fontSize(8).fillColor('#16a34a').font('Helvetica-Bold')
          .text(student.present.toString(), currentX, rowY + 5, { width: summaryColWidth, align: 'center' });
        currentX += summaryColWidth;

        // Faltas
        doc.rect(currentX, rowY, summaryColWidth, rowHeight).fill('#fef2f2').stroke('#e2e8f0');
        doc.fontSize(8).fillColor('#dc2626').font('Helvetica-Bold')
          .text(student.absent.toString(), currentX, rowY + 5, { width: summaryColWidth, align: 'center' });
        currentX += summaryColWidth;

        // Tardanzas
        doc.rect(currentX, rowY, summaryColWidth, rowHeight).fill('#fef3c7').stroke('#e2e8f0');
        doc.fontSize(8).fillColor('#d97706').font('Helvetica-Bold')
          .text(student.late.toString(), currentX, rowY + 5, { width: summaryColWidth, align: 'center' });
        currentX += summaryColWidth;

        // Porcentaje
        const rateColor = student.rate >= 80 ? '#16a34a' : student.rate >= 60 ? '#d97706' : '#dc2626';
        doc.rect(currentX, rowY, summaryColWidth, rowHeight).fill('#f8fafc').stroke('#e2e8f0');
        doc.fontSize(7).fillColor(rateColor).font('Helvetica-Bold')
          .text(`${student.rate}%`, currentX, rowY + 5, { width: summaryColWidth, align: 'center' });

        rowY += rowHeight;
      });

      // Línea final
      doc.rect(margin, rowY, tableWidth, 2).fill('#1e3a5f');

      // ========== FOOTER ==========
      doc.fontSize(7).fillColor('#94a3b8').font('Helvetica')
        .text('Documento generado por JURIED - Sistema de Gestión Educativa', margin, pageHeight - 25, {
          width: contentWidth,
          align: 'center'
        });

      doc.end();
    });
  }

  // Formatear fecha corta
  private formatDateShort(dateStr: string): string {
    // Parsear fecha manualmente para evitar problemas de zona horaria
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day, 12, 0, 0);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Generar PDF de asistencia individual de un estudiante
  async generateStudentAttendanceReport(
    studentName: string,
    classroomName: string,
    stats: {
      total: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
      rate: number;
      currentStreak?: number;
      bestStreak?: number;
    },
    history: Array<{
      date: string;
      status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
      xpAwarded?: number;
    }>
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        margin: 40,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;

      // Header
      doc.rect(0, 0, pageWidth, 90).fill('#4f46e5');

      doc
        .fontSize(20)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text('REPORTE DE ASISTENCIA', 40, 20);

      doc
        .fontSize(16)
        .fillColor('#ffffff')
        .font('Helvetica')
        .text(studentName, 40, 45);

      doc
        .fontSize(11)
        .fillColor('#e0e7ff')
        .text(`Clase: ${classroomName}`, 40, 68);

      doc
        .fontSize(10)
        .fillColor('#ffffff')
        .text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - 180, 25);

      // Estadísticas del estudiante
      const statsY = 110;
      const statBoxWidth = (pageWidth - 100) / 4;

      const statBoxes = [
        { label: 'Tasa de Asistencia', value: `${stats.rate}%`, color: stats.rate >= 80 ? '#22c55e' : stats.rate >= 60 ? '#f59e0b' : '#ef4444' },
        { label: 'Días Presentes', value: stats.present.toString(), color: '#22c55e' },
        { label: 'Días Ausentes', value: stats.absent.toString(), color: '#ef4444' },
        { label: 'Tardanzas', value: stats.late.toString(), color: '#f59e0b' },
      ];

      statBoxes.forEach((stat, i) => {
        const x = 40 + i * (statBoxWidth + 7);
        doc.roundedRect(x, statsY, statBoxWidth, 60, 8).fill('#f8fafc').stroke('#e2e8f0');
        
        doc
          .fontSize(24)
          .fillColor(stat.color)
          .font('Helvetica-Bold')
          .text(stat.value, x, statsY + 12, { width: statBoxWidth, align: 'center' });
        
        doc
          .fontSize(9)
          .fillColor('#64748b')
          .font('Helvetica')
          .text(stat.label, x, statsY + 42, { width: statBoxWidth, align: 'center' });
      });

      // Resumen adicional
      const summaryY = 185;
      doc.roundedRect(40, summaryY, pageWidth - 80, 45, 5).fill('#f0fdf4').stroke('#bbf7d0');

      doc
        .fontSize(10)
        .fillColor('#166534')
        .font('Helvetica-Bold')
        .text('Resumen:', 55, summaryY + 10);

      doc
        .fontSize(9)
        .fillColor('#166534')
        .font('Helvetica')
        .text(`Total de días registrados: ${stats.total}  |  Justificados: ${stats.excused}`, 55, summaryY + 25);

      if (stats.currentStreak !== undefined) {
        doc.text(`  |  Racha actual: ${stats.currentStreak} días  |  Mejor racha: ${stats.bestStreak || 0} días`, 280, summaryY + 25);
      }

      // Historial de asistencia
      const tableY = 250;
      doc
        .fontSize(12)
        .fillColor('#1e293b')
        .font('Helvetica-Bold')
        .text('Historial de Asistencia', 40, tableY - 20);

      const colWidths = [150, 120, 100, 100];
      const headers = ['Fecha', 'Estado', 'XP Ganado', 'Observación'];
      
      // Header de tabla
      let currentX = 40;
      doc.rect(40, tableY, pageWidth - 80, 25).fill('#4f46e5');
      
      headers.forEach((header, i) => {
        doc
          .fontSize(10)
          .fillColor('#ffffff')
          .font('Helvetica-Bold')
          .text(header, currentX + 5, tableY + 8, { width: colWidths[i] - 10, align: i === 0 ? 'left' : 'center' });
        currentX += colWidths[i];
      });

      // Filas de historial
      let rowY = tableY + 25;
      const rowHeight = 22;
      const maxRowsPerPage = Math.floor((pageHeight - tableY - 80) / rowHeight);

      const statusLabels: Record<string, { label: string; color: string }> = {
        PRESENT: { label: 'Presente', color: '#22c55e' },
        ABSENT: { label: 'Ausente', color: '#ef4444' },
        LATE: { label: 'Tardanza', color: '#f59e0b' },
        EXCUSED: { label: 'Justificado', color: '#3b82f6' },
      };

      history.slice(0, 50).forEach((record, index) => {
        if (index > 0 && index % maxRowsPerPage === 0) {
          doc.addPage();
          rowY = 40;
          
          // Repetir header
          currentX = 40;
          doc.rect(40, rowY, pageWidth - 80, 25).fill('#4f46e5');
          headers.forEach((header, i) => {
            doc
              .fontSize(10)
              .fillColor('#ffffff')
              .font('Helvetica-Bold')
              .text(header, currentX + 5, rowY + 8, { width: colWidths[i] - 10, align: i === 0 ? 'left' : 'center' });
            currentX += colWidths[i];
          });
          rowY += 25;
        }

        const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(40, rowY, pageWidth - 80, rowHeight).fill(bgColor);

        currentX = 40;
        const statusInfo = statusLabels[record.status] || { label: record.status, color: '#64748b' };
        
        // Fecha
        const dateFormatted = new Date(record.date).toLocaleDateString('es-ES', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        doc
          .fontSize(9)
          .fillColor('#1e293b')
          .font('Helvetica')
          .text(dateFormatted, currentX + 5, rowY + 6, { width: colWidths[0] - 10 });
        currentX += colWidths[0];

        // Estado
        doc
          .fillColor(statusInfo.color)
          .font('Helvetica-Bold')
          .text(statusInfo.label, currentX, rowY + 6, { width: colWidths[1], align: 'center' });
        currentX += colWidths[1];

        // XP
        doc
          .fillColor('#8b5cf6')
          .font('Helvetica')
          .text(record.xpAwarded ? `+${record.xpAwarded} XP` : '-', currentX, rowY + 6, { width: colWidths[2], align: 'center' });
        currentX += colWidths[2];

        // Observación (vacío por ahora)
        doc
          .fillColor('#94a3b8')
          .text('-', currentX, rowY + 6, { width: colWidths[3], align: 'center' });

        rowY += rowHeight;
      });

      // Footer
      doc
        .fontSize(8)
        .fillColor('#94a3b8')
        .font('Helvetica')
        .text('Generado por JURIED - Plataforma de Gamificación Educativa', 40, pageHeight - 30, {
          width: pageWidth - 80,
          align: 'center'
        });

      doc.end();
    });
  }
}

export const pdfService = new PDFService();
