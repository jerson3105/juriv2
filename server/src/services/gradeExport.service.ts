// @ts-ignore - PDFKit types issue with ESM
import PDFDocument from 'pdfkit';
import { db } from '../db/index.js';
import { 
  studentGrades, 
  studentProfiles, 
  classrooms,
  curriculumCompetencies,
  users
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

interface StudentGradeData {
  studentId: string;
  displayName: string;
  grades: {
    competencyId: string;
    competencyName: string;
    score: number;
    gradeLabel: string;
  }[];
  average: number;
  averageLabel: string;
}

interface GradeStats {
  AD: number;
  A: number;
  B: number;
  C: number;
  total: number;
}

class GradeExportService {
  async generateGradebookPDF(classroomId: string, period: string = 'CURRENT'): Promise<Buffer> {
    const classroom = await db.select()
      .from(classrooms)
      .where(eq(classrooms.id, classroomId))
      .then(rows => rows[0]);

    if (!classroom) {
      throw new Error('Clase no encontrada');
    }

    const studentsData = await this.getStudentsWithGrades(classroomId, period);
    const competencies = await this.getClassroomCompetencies(classroomId);
    const stats = this.calculateStats(studentsData);

    return this.createPDF(classroom, studentsData, competencies, stats, period);
  }

  private async getStudentsWithGrades(classroomId: string, period: string): Promise<StudentGradeData[]> {
    const students = await db.select({
      id: studentProfiles.id,
      characterName: studentProfiles.characterName,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(studentProfiles)
    .leftJoin(users, eq(studentProfiles.userId, users.id))
    .where(eq(studentProfiles.classroomId, classroomId));

    const grades = await db.select({
      studentProfileId: studentGrades.studentProfileId,
      competencyId: studentGrades.competencyId,
      competencyName: curriculumCompetencies.name,
      score: studentGrades.score,
      gradeLabel: studentGrades.gradeLabel,
    })
    .from(studentGrades)
    .leftJoin(curriculumCompetencies, eq(studentGrades.competencyId, curriculumCompetencies.id))
    .where(and(
      eq(studentGrades.classroomId, classroomId),
      eq(studentGrades.period, period)
    ));

    return students.map(student => {
      const studentGradesList = grades.filter(g => g.studentProfileId === student.id);
      const scores = studentGradesList.map(g => parseFloat(String(g.score)) || 0);
      const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      // Priorizar: nombre real > characterName > "Estudiante"
      const realName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
      const displayName = realName || student.characterName || 'Estudiante';

      return {
        studentId: student.id,
        displayName,
        grades: studentGradesList.map(g => ({
          competencyId: g.competencyId,
          competencyName: g.competencyName || 'Competencia',
          score: parseFloat(String(g.score)) || 0,
          gradeLabel: g.gradeLabel || 'C',
        })),
        average,
        averageLabel: this.scoreToLabel(average),
      };
    }).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  private async getClassroomCompetencies(classroomId: string): Promise<{ id: string; name: string }[]> {
    const grades = await db.selectDistinct({
      competencyId: studentGrades.competencyId,
      competencyName: curriculumCompetencies.name,
    })
    .from(studentGrades)
    .leftJoin(curriculumCompetencies, eq(studentGrades.competencyId, curriculumCompetencies.id))
    .where(eq(studentGrades.classroomId, classroomId));

    return grades.map(g => ({
      id: g.competencyId,
      name: g.competencyName || 'Competencia',
    }));
  }

  private calculateStats(students: StudentGradeData[]): { 
    byCompetency: Map<string, GradeStats>;
    overall: GradeStats;
    studentCount: number;
  } {
    const byCompetency = new Map<string, GradeStats>();
    const overall: GradeStats = { AD: 0, A: 0, B: 0, C: 0, total: 0 };

    for (const student of students) {
      for (const grade of student.grades) {
        if (!byCompetency.has(grade.competencyId)) {
          byCompetency.set(grade.competencyId, { AD: 0, A: 0, B: 0, C: 0, total: 0 });
        }
        const compStats = byCompetency.get(grade.competencyId)!;
        compStats[grade.gradeLabel as keyof GradeStats]++;
        compStats.total++;
      }
      overall[student.averageLabel as keyof GradeStats]++;
      overall.total++;
    }

    return { byCompetency, overall, studentCount: students.length };
  }

  private scoreToLabel(score: number): string {
    if (score >= 85) return 'AD';
    if (score >= 65) return 'A';
    if (score >= 50) return 'B';
    return 'C';
  }

  private createPDF(
    classroom: any,
    students: StudentGradeData[],
    competencies: { id: string; name: string }[],
    stats: { byCompetency: Map<string, GradeStats>; overall: GradeStats; studentCount: number },
    period: string
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // PDF en orientación VERTICAL (portrait)
      const doc = new PDFDocument({ 
        size: 'A4', 
        layout: 'portrait',
        margins: { top: 50, bottom: 50, left: 40, right: 40 }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 80;
      const pageHeight = doc.page.height;

      // ═══════════════════════════════════════════════════════════
      // PÁGINA 1: PORTADA Y TABLA DE CALIFICACIONES
      // ═══════════════════════════════════════════════════════════

      // Header con fondo
      doc.rect(0, 0, doc.page.width, 120).fill('#4F46E5');
      
      doc.fillColor('white').fontSize(24).font('Helvetica-Bold')
        .text('LIBRO DE CALIFICACIONES', 40, 35, { align: 'center' });
      
      doc.fontSize(16).font('Helvetica')
        .text(classroom.name, 40, 70, { align: 'center' });
      
      doc.fontSize(11)
        .text(`Período: ${period === 'CURRENT' ? 'Actual' : period}`, 40, 95, { align: 'center' });

      // Info adicional
      doc.fillColor('#6B7280').fontSize(9).font('Helvetica')
        .text(`Fecha de generación: ${new Date().toLocaleDateString('es-PE', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        })}`, 40, 135, { align: 'center' });

      doc.moveDown(2);

      // Resumen rápido
      doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold')
        .text('Resumen General', 40, 165);
      
      doc.fontSize(10).font('Helvetica').fillColor('#374151');
      doc.text(`Total de estudiantes: ${students.length}`, 40, 185);
      doc.text(`Competencias evaluadas: ${competencies.length}`, 40, 200);

      // Mini estadísticas en boxes
      const boxY = 225;
      const boxWidth = (pageWidth - 30) / 4;
      const labels = ['AD', 'A', 'B', 'C'];
      const bgColors = ['#DCFCE7', '#DBEAFE', '#FEF3C7', '#FEE2E2'];
      const textColors = ['#166534', '#1D4ED8', '#B45309', '#DC2626'];
      const descriptions = ['Destacado', 'Logrado', 'En proceso', 'En inicio'];

      labels.forEach((label, i) => {
        const x = 40 + (i * (boxWidth + 10));
        const count = stats.overall[label as keyof GradeStats] || 0;
        const pct = stats.overall.total > 0 ? ((count / stats.overall.total) * 100).toFixed(0) : '0';

        doc.rect(x, boxY, boxWidth, 55).fill(bgColors[i]);
        doc.fillColor(textColors[i]).font('Helvetica-Bold').fontSize(18)
          .text(label, x, boxY + 8, { width: boxWidth, align: 'center' });
        doc.fontSize(11).font('Helvetica')
          .text(`${count} (${pct}%)`, x, boxY + 30, { width: boxWidth, align: 'center' });
        doc.fontSize(7).fillColor('#6B7280')
          .text(descriptions[i], x, boxY + 44, { width: boxWidth, align: 'center' });
      });

      // ═══════════════════════════════════════════════════════════
      // TABLA DE CALIFICACIONES
      // ═══════════════════════════════════════════════════════════

      let tableY = 300;
      const rowHeight = 22;
      const numColWidth = 25;
      const nameColWidth = 150;
      const gradeColWidth = competencies.length > 0 ? Math.min(60, (pageWidth - numColWidth - nameColWidth - 50) / competencies.length) : 60;
      const avgColWidth = 45;

      // Encabezado de tabla
      doc.rect(40, tableY, pageWidth, 28).fill('#1F2937');
      doc.fillColor('white').fontSize(8).font('Helvetica-Bold');

      let x = 45;
      doc.text('N°', x, tableY + 10, { width: numColWidth - 5 });
      x += numColWidth;
      doc.text('Estudiante', x, tableY + 10, { width: nameColWidth - 5 });
      x += nameColWidth;

      competencies.forEach(comp => {
        const abbrev = comp.name.length > 8 ? comp.name.substring(0, 7) + '…' : comp.name;
        doc.text(abbrev, x, tableY + 10, { width: gradeColWidth - 2, align: 'center' });
        x += gradeColWidth;
      });

      doc.text('PROM', x, tableY + 10, { width: avgColWidth, align: 'center' });

      tableY += 28;

      // Filas de estudiantes
      students.forEach((student, idx) => {
        // Nueva página si es necesario
        if (tableY > pageHeight - 80) {
          doc.addPage();
          tableY = 50;
          
          // Repetir encabezado en nueva página
          doc.rect(40, tableY, pageWidth, 28).fill('#1F2937');
          doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
          x = 45;
          doc.text('N°', x, tableY + 10, { width: numColWidth - 5 });
          x += numColWidth;
          doc.text('Estudiante', x, tableY + 10, { width: nameColWidth - 5 });
          x += nameColWidth;
          competencies.forEach(comp => {
            const abbrev = comp.name.length > 8 ? comp.name.substring(0, 7) + '…' : comp.name;
            doc.text(abbrev, x, tableY + 10, { width: gradeColWidth - 2, align: 'center' });
            x += gradeColWidth;
          });
          doc.text('PROM', x, tableY + 10, { width: avgColWidth, align: 'center' });
          tableY += 28;
        }

        // Fondo alternado
        if (idx % 2 === 0) {
          doc.rect(40, tableY, pageWidth, rowHeight).fill('#F9FAFB');
        } else {
          doc.rect(40, tableY, pageWidth, rowHeight).fill('#FFFFFF');
        }

        // Contenido de la fila
        x = 45;
        doc.fillColor('#374151').fontSize(8).font('Helvetica');
        doc.text(String(idx + 1), x, tableY + 7, { width: numColWidth - 5 });
        x += numColWidth;
        
        // Nombre del estudiante (truncado si es muy largo)
        const displayName = student.displayName.length > 22 
          ? student.displayName.substring(0, 20) + '…' 
          : student.displayName;
        doc.font('Helvetica-Bold').text(displayName, x, tableY + 7, { width: nameColWidth - 5 });
        x += nameColWidth;

        // Calificaciones por competencia
        competencies.forEach(comp => {
          const grade = student.grades.find(g => g.competencyId === comp.id);
          const label = grade?.gradeLabel || '-';
          
          doc.fillColor(this.getLabelColor(label)).font('Helvetica-Bold').fontSize(9)
            .text(label, x, tableY + 6, { width: gradeColWidth - 2, align: 'center' });
          x += gradeColWidth;
        });

        // Promedio
        doc.fillColor(this.getLabelColor(student.averageLabel)).font('Helvetica-Bold').fontSize(10)
          .text(student.averageLabel, x, tableY + 6, { width: avgColWidth, align: 'center' });

        tableY += rowHeight;
      });

      // Línea final de tabla
      doc.moveTo(40, tableY).lineTo(40 + pageWidth, tableY).stroke('#E5E7EB');

      // ═══════════════════════════════════════════════════════════
      // PÁGINA 2: ESTADÍSTICOS DETALLADOS
      // ═══════════════════════════════════════════════════════════

      doc.addPage();

      // Header
      doc.rect(0, 0, doc.page.width, 80).fill('#4F46E5');
      doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
        .text('RESUMEN ESTADÍSTICO', 40, 30, { align: 'center' });
      doc.fontSize(12).font('Helvetica')
        .text(classroom.name, 40, 55, { align: 'center' });

      let y = 110;

      // Sección: Distribución por Competencia
      doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold')
        .text('Distribución por Competencia', 40, y);
      y += 30;

      competencies.forEach(comp => {
        if (y > pageHeight - 120) {
          doc.addPage();
          y = 50;
        }

        const compStats = stats.byCompetency.get(comp.id);
        if (!compStats) return;

        // Nombre de competencia
        doc.fillColor('#4F46E5').fontSize(10).font('Helvetica-Bold')
          .text(comp.name, 40, y);
        y += 18;

        // Barra de progreso visual
        const barWidth = pageWidth - 100;
        const barHeight = 20;
        const barX = 50;

        // Fondo de barra
        doc.rect(barX, y, barWidth, barHeight).fill('#E5E7EB');

        // Segmentos de la barra
        let segmentX = barX;
        const segmentColors = ['#166534', '#1D4ED8', '#B45309', '#DC2626'];
        
        labels.forEach((label, i) => {
          const count = compStats[label as keyof GradeStats] || 0;
          if (count > 0 && compStats.total > 0) {
            const segmentWidth = (count / compStats.total) * barWidth;
            doc.rect(segmentX, y, segmentWidth, barHeight).fill(segmentColors[i]);
            
            // Texto dentro del segmento si es suficientemente ancho
            if (segmentWidth > 25) {
              doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
                .text(`${label}`, segmentX + 2, y + 6, { width: segmentWidth - 4, align: 'center' });
            }
            segmentX += segmentWidth;
          }
        });

        y += barHeight + 5;

        // Detalle numérico
        doc.fillColor('#6B7280').fontSize(8).font('Helvetica');
        const detailText = labels.map((label, i) => {
          const count = compStats[label as keyof GradeStats] || 0;
          const pct = compStats.total > 0 ? ((count / compStats.total) * 100).toFixed(0) : '0';
          return `${label}: ${count} (${pct}%)`;
        }).join('  •  ');
        doc.text(detailText, 50, y);

        y += 25;
      });

      // ═══════════════════════════════════════════════════════════
      // LEYENDA Y PIE DE PÁGINA
      // ═══════════════════════════════════════════════════════════

      if (y > pageHeight - 150) {
        doc.addPage();
        y = 50;
      }

      y += 20;
      doc.rect(40, y, pageWidth, 100).fill('#F3F4F6');
      y += 15;

      doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold')
        .text('Escala de Calificación (Perú - CNEB)', 55, y);
      y += 20;

      doc.fontSize(9).font('Helvetica');
      const legendItems = [
        { label: 'AD', color: '#166534', desc: 'Logro Destacado (85-100%): El estudiante evidencia un nivel superior a lo esperado' },
        { label: 'A', color: '#1D4ED8', desc: 'Logro Esperado (65-84%): El estudiante evidencia el nivel esperado' },
        { label: 'B', color: '#B45309', desc: 'En Proceso (50-64%): El estudiante está en camino de lograr los aprendizajes' },
        { label: 'C', color: '#DC2626', desc: 'En Inicio (0-49%): El estudiante muestra un progreso mínimo' },
      ];

      legendItems.forEach(item => {
        doc.rect(55, y, 20, 12).fill(item.color);
        doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
          .text(item.label, 55, y + 2, { width: 20, align: 'center' });
        doc.fillColor('#374151').fontSize(8).font('Helvetica')
          .text(item.desc, 80, y + 2);
        y += 16;
      });

      // Footer
      doc.fillColor('#9CA3AF').fontSize(8).font('Helvetica')
        .text(`Documento generado automáticamente por Juried - ${new Date().toLocaleString('es-PE')}`, 
          40, pageHeight - 30, { align: 'center' });

      doc.end();
    });
  }

  private getLabelColor(label: string): string {
    switch (label) {
      case 'AD': return '#166534';
      case 'A': return '#1D4ED8';
      case 'B': return '#B45309';
      case 'C': return '#DC2626';
      default: return '#6B7280';
    }
  }
}

export const gradeExportService = new GradeExportService();
