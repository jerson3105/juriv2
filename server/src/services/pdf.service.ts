import PDFDocument from 'pdfkit';

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

export class PDFService {
  // Generar PDF con tarjetas de vinculación para estudiantes
  async generateStudentCards(
    students: StudentCard[],
    appUrl: string
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

        this.drawStudentCard(doc, student, x, y, cardWidth, cardHeight, appUrl);
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
    appUrl: string
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
      .text(student.displayName, x + 15, y + 60, { 
        width: width - 30,
        align: 'center'
      });

    // Clase del personaje
    doc
      .fontSize(10)
      .fillColor('#64748b')
      .font('Helvetica')
      .text(`Clase: ${className}`, x + 15, y + 80, { 
        width: width - 30,
        align: 'center'
      });

    // Línea separadora
    doc
      .moveTo(x + 20, y + 100)
      .lineTo(x + width - 20, y + 100)
      .strokeColor('#e2e8f0')
      .stroke();

    // Código de vinculación
    doc
      .fontSize(9)
      .fillColor('#64748b')
      .font('Helvetica')
      .text('Tu código de vinculación:', x + 15, y + 110, { 
        width: width - 30,
        align: 'center'
      });

    // Código grande
    doc
      .fontSize(24)
      .fillColor(classColor)
      .font('Helvetica-Bold')
      .text(student.linkCode, x + 15, y + 125, { 
        width: width - 30,
        align: 'center',
        characterSpacing: 4
      });

    // Instrucciones
    doc
      .fontSize(8)
      .fillColor('#64748b')
      .font('Helvetica')
      .text('Pasos para vincular tu cuenta:', x + 15, y + 160, { 
        width: width - 30 
      });

    const steps = [
      `1. Ve a ${appUrl}`,
      '2. Crea tu cuenta o inicia sesión',
      '3. Ingresa el código de arriba',
    ];

    steps.forEach((step, i) => {
      doc
        .fontSize(7)
        .fillColor('#475569')
        .text(step, x + 15, y + 172 + (i * 10), { width: width - 30 });
    });

    // Clase y código de aula
    doc
      .fontSize(7)
      .fillColor('#94a3b8')
      .text(`Clase: ${student.classroomName}`, x + 15, y + height - 18, { 
        width: width - 30,
        align: 'center'
      });
  }

  // Generar PDF de una sola tarjeta (más grande)
  async generateSingleCard(
    student: StudentCard,
    appUrl: string
  ): Promise<Buffer> {
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

      // Clase
      doc
        .fontSize(14)
        .fillColor('#64748b')
        .font('Helvetica')
        .text(`Tu clase de personaje: ${className}`, 30, contentY + 35, {
          width: pageWidth - 60,
          align: 'center'
        });

      // Código de vinculación
      doc
        .fontSize(12)
        .fillColor('#475569')
        .text('Tu código personal de vinculación es:', 30, contentY + 70, {
          width: pageWidth - 60,
          align: 'center'
        });

      // Código grande con fondo
      const codeBoxWidth = 200;
      const codeBoxX = (pageWidth - codeBoxWidth) / 2;
      doc
        .roundedRect(codeBoxX, contentY + 90, codeBoxWidth, 50, 8)
        .fill('#ffffff')
        .strokeColor(classColor)
        .lineWidth(2)
        .stroke();

      doc
        .fontSize(32)
        .fillColor(classColor)
        .font('Helvetica-Bold')
        .text(student.linkCode, 30, contentY + 100, {
          width: pageWidth - 60,
          align: 'center',
          characterSpacing: 6
        });

      // Instrucciones
      doc
        .fontSize(11)
        .fillColor('#1e293b')
        .font('Helvetica-Bold')
        .text('¿Cómo vincular tu cuenta?', 30, contentY + 160, {
          width: pageWidth - 60,
          align: 'center'
        });

      const instructions = [
        `1. Ingresa a ${appUrl} desde tu navegador`,
        '2. Crea una cuenta nueva con tu correo o inicia sesión si ya tienes una',
        '3. Selecciona "Vincular con código" e ingresa el código de arriba',
        '4. ¡Listo! Tu progreso en clase estará vinculado a tu cuenta'
      ];

      instructions.forEach((instruction, i) => {
        doc
          .fontSize(10)
          .fillColor('#475569')
          .font('Helvetica')
          .text(instruction, 50, contentY + 180 + (i * 16), {
            width: pageWidth - 100,
          });
      });

      // Footer
      doc
        .fontSize(9)
        .fillColor('#94a3b8')
        .text(`Clase: ${student.classroomName}`, 30, pageHeight - 40, {
          width: pageWidth - 60,
          align: 'center'
        });

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
        
        const d = new Date(date);
        const dayNum = d.getDate().toString();
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
            const d = new Date(date);
            doc.fontSize(7).fillColor('#ffffff').font('Helvetica-Bold')
              .text(d.getDate().toString(), currentX, rowY + 8, { width: dateColWidth, align: 'center' });
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
    const d = new Date(dateStr);
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
