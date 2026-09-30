import ExcelJS from 'exceljs';
import { ValidationError } from '../utils/errors.js';
import { scaleOptions, scaleValueToScore } from '../utils/gradeScale.js';
import { gradeEvaluationService } from './gradeEvaluation.service.js';
import { gradeService } from './grade.service.js';

export type ImportRowStatus = 'OK' | 'EMPTY' | 'UNKNOWN_STUDENT' | 'INVALID_VALUE' | 'DUPLICATE';

export interface ImportPreviewRow {
  line: number;
  name: string;
  value: string;
  note: string | null;
  studentProfileId: string | null;
  studentName: string | null;
  label: string | null;
  status: ImportRowStatus;
  message: string | null;
}

const MAX_FILE_BYTES = 70 * 1024;
const ID_HEADER = 'id (no borrar)';

// Nombres comparables: sin tildes, minúsculas, y el orden de las palabras no importa ("Pérez Ana" = "Ana Perez").
const normalizeName = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ\s]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');

const cellText = (value: ExcelJS.CellValue): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return String(value.result ?? '');
    if ('richText' in value) return value.richText.map((r) => r.text).join('');
  }
  return String(value);
};

/**
 * Importar notas a una evaluación: plantilla Excel con los alumnos (y su id oculto) y vista previa de
 * un Excel/CSV o de lo pegado desde una hoja de cálculo. No guarda: el docente confirma después.
 */
class GradeImportService {
  async template(evaluationId: string): Promise<{ buffer: Buffer; filename: string }> {
    const evaluation = await gradeEvaluationService.get(evaluationId);
    const { gradeScaleType, parsedScaleConfig } = await gradeService.getScaleSettings(evaluation.classroomId);
    const scale = scaleOptions(gradeScaleType, parsedScaleConfig);
    const hint = scale.kind === 'letters' ? scale.values.map((v) => v.label).join(', ') : `${scale.min} a ${scale.max}`;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Juried';
    const sheet = workbook.addWorksheet('Notas', { views: [{ state: 'frozen', ySplit: 3 }] });
    sheet.columns = [{ width: 6 }, { width: 38 }, { width: 10 }, { width: 40 }, { width: 38, hidden: true }];
    sheet.addRow([`${evaluation.title} · ${evaluation.competencyShortName || evaluation.competencyName || ''}`]).font = { bold: true, size: 13 };
    sheet.addRow([`Escribe la nota de cada alumno (${hint}). Deja vacío si no tiene nota. No cambies el orden de las columnas.`]).font = { italic: true, color: { argb: 'FF374151' } };
    const header = sheet.addRow(['N.°', 'Alumno', 'Nota', 'Comentario (opcional)', ID_HEADER]);
    header.font = { bold: true };
    header.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }; });

    evaluation.students.forEach((student, index) => {
      const row = sheet.addRow([index + 1, student.studentName, student.label ?? '', student.note ?? '', student.studentProfileId]);
      const gradeCell = row.getCell(3);
      gradeCell.alignment = { horizontal: 'center' };
      gradeCell.dataValidation = scale.kind === 'letters'
        ? { type: 'list', allowBlank: true, formulae: [`"${scale.values.map((v) => v.label).join(',')}"`], showErrorMessage: true, errorTitle: 'Nota inválida', error: `Usa: ${hint}` }
        : { type: 'decimal', operator: 'between', allowBlank: true, formulae: [scale.min, scale.max], showErrorMessage: true, errorTitle: 'Nota inválida', error: `Usa un número de ${hint}` };
    });

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const safeTitle = evaluation.title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'evaluacion';
    return { buffer, filename: `notas-${safeTitle}.xlsx` };
  }

  private async readXlsx(base64: string) {
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > MAX_FILE_BYTES) throw new ValidationError('El archivo es muy grande: usa la plantilla de la evaluación');
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new ValidationError('No se pudo leer el archivo: usa un Excel (.xlsx) o pega las notas');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new ValidationError('El archivo no tiene hojas');

    // Encabezado: la fila que tenga "Alumno" y "Nota".
    let headerRow = 0;
    const columns = { name: 0, value: 0, note: 0, id: 0 };
    sheet.eachRow((row, rowNumber) => {
      if (headerRow) return;
      // row.values es disperso (índice 0 vacío): Array.from rellena los huecos.
      const texts = Array.from(row.values as ExcelJS.CellValue[], (v) => cellText(v).trim().toLowerCase());
      const nameCol = texts.findIndex((t) => t === 'alumno' || t === 'estudiante' || t === 'nombre' || t === 'nombres');
      const valueCol = texts.findIndex((t) => t === 'nota' || t === 'calificación' || t === 'calificacion');
      if (nameCol > 0 && valueCol > 0) {
        headerRow = rowNumber;
        columns.name = nameCol;
        columns.value = valueCol;
        columns.note = texts.findIndex((t) => t.startsWith('comentario'));
        columns.id = texts.findIndex((t) => t === ID_HEADER);
      }
    });
    if (!headerRow) throw new ValidationError('No encontré las columnas "Alumno" y "Nota". Usa la plantilla de la evaluación');

    const rows: Array<{ line: number; name: string; value: string; note: string; id: string }> = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRow) return;
      const get = (col: number) => (col > 0 ? cellText(row.getCell(col).value).trim() : '');
      const name = get(columns.name);
      if (!name && !get(columns.id)) return;
      rows.push({ line: rowNumber, name, value: get(columns.value), note: get(columns.note), id: get(columns.id) });
    });
    return rows;
  }

  // Pegado desde una hoja de cálculo o CSV: columnas nombre, nota y (opcional) comentario.
  private readText(text: string) {
    if (text.length > MAX_FILE_BYTES) throw new ValidationError('Hay demasiado texto para una evaluación');
    const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
    const delimiter = lines.some((l) => l.includes('\t')) ? '\t' : lines.some((l) => l.includes(';')) ? ';' : ',';
    return lines
      .map((line, index) => {
        const [name = '', value = '', ...rest] = line.split(delimiter).map((part) => part.trim().replace(/^"|"$/g, ''));
        return { line: index + 1, name, value, note: rest.join(' ').trim(), id: '' };
      })
      .filter((row, index) => !(index === 0 && /^(alumno|estudiante|nombre|nombres)$/i.test(row.name)));
  }

  async preview(evaluationId: string, input: { fileBase64?: string; text?: string }): Promise<{ rows: ImportPreviewRow[]; ready: number }> {
    const evaluation = await gradeEvaluationService.get(evaluationId);
    const { gradeScaleType, parsedScaleConfig } = await gradeService.getScaleSettings(evaluation.classroomId);
    const raw = input.fileBase64 ? await this.readXlsx(input.fileBase64) : this.readText(input.text ?? '');
    if (raw.length === 0) throw new ValidationError('No encontré notas para importar');

    const byId = new Map(evaluation.students.map((s) => [s.studentProfileId, s]));
    const byName = new Map<string, typeof evaluation.students[number] | null>();
    for (const student of evaluation.students) {
      for (const candidate of [student.studentName, student.characterName].filter(Boolean) as string[]) {
        const key = normalizeName(candidate);
        // Nombre repetido en la clase: no se adivina.
        byName.set(key, byName.has(key) && byName.get(key)?.studentProfileId !== student.studentProfileId ? null : student);
      }
    }

    const seen = new Set<string>();
    const rows: ImportPreviewRow[] = raw.map((row) => {
      const student = (row.id && byId.get(row.id)) || byName.get(normalizeName(row.name)) || null;
      const base = { line: row.line, name: row.name, value: row.value, note: row.note || null, studentProfileId: student?.studentProfileId ?? null, studentName: student?.studentName ?? null, label: null };
      if (!student) return { ...base, status: 'UNKNOWN_STUDENT' as const, message: 'No encontré a este alumno en la clase' };
      if (seen.has(student.studentProfileId)) return { ...base, status: 'DUPLICATE' as const, message: 'El alumno aparece más de una vez' };
      seen.add(student.studentProfileId);
      if (!row.value) return { ...base, status: 'EMPTY' as const, message: 'Sin nota (no se cambia)' };
      try {
        const { label } = scaleValueToScore(row.value, gradeScaleType, parsedScaleConfig);
        return { ...base, label, status: 'OK' as const, message: null };
      } catch (error) {
        return { ...base, status: 'INVALID_VALUE' as const, message: (error as Error).message.replace('Valor invalido', 'Nota inválida') };
      }
    });
    return { rows, ready: rows.filter((r) => r.status === 'OK').length };
  }
}

export const gradeImportService = new GradeImportService();
