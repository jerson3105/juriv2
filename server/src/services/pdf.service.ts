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
}

export const pdfService = new PDFService();
