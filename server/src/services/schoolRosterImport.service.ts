import ExcelJS from 'exceljs';
import { and, asc, desc, eq, gt, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  schoolEnrollmentEvents, schoolEnrollments, schoolImportBatches, schoolSections, schoolStudents, schoolYearLevels, schoolYears, studentProfiles,
} from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError, isDuplicateEntry } from '../utils/errors.js';
import { affectedRows } from '../utils/points.js';
import { decryptPii, encryptPii, piiReady } from '../utils/piiCrypto.js';
import { documentIndex, maskDocument, normalizeDocument, parseDocument, type DocumentType } from '../utils/personalDocument.js';
import { matchWords, sameWord, splitPersonName, tidyName } from '../utils/personNames.js';
import {
  cellText, detectMapping, detectSource, isHeaderRow, isHeaderText, isMaskedDocument, isPlausibleBirthDate, parseDate, parseDocumentType, parseGradeSection, parseLevel,
  sectionLabelFrom, type ImportField,
} from '../utils/rosterImportParsing.js';
import { cleanText, comparableText } from '../utils/textClean.js';
import { assertSafeXlsx } from '../utils/xlsxSafety.js';
import { prepareDocument } from './schoolRoster.service.js';
import { schoolAutoEnrollService } from './schoolAutoEnroll.service.js';
import { LEVEL_GRADES, sectionDisplayName } from './schoolSection.service.js';
import type { SchoolLevel } from './schoolYear.service.js';

/**
 * Importar el padrón desde Excel (la plantilla de Juried o la nómina del SIAGIE). Cada fila se empareja con el padrón:
 * primero por Código Juried, luego por documento (índice ciego), luego por nombre dentro de su sección; sin coincidencia,
 * es un estudiante nuevo. Confirmar solo completa datos vacíos y da sección a quien no tiene (cambiarla es un traslado).
 * Las filas del archivo se guardan cifradas 24 horas y la importación se puede deshacer en ese plazo.
 */

const MAX_ROWS = 3000;
const MAX_COLUMNS = 40;
const MAX_CELL = 200;
const MAX_STORED_CHARS = 6_000_000;
const HEADER_SCAN_ROWS = 15;
const TTL_MS = 24 * 60 * 60 * 1000;
const XLSX_LIMITS = { maxEntries: 200, maxUncompressedBytes: 15 * 1024 * 1024 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;
const emailSchema = z.string().email().max(255);
const IDENTITY_FIELDS: ImportField[] = ['juriedCode', 'fullName', 'lastNames', 'lastName1', 'firstNames', 'documentNumber'];
const LEVEL_NAME: Record<SchoolLevel, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' };
const DOCUMENT_LABEL: Record<DocumentType, string> = { DNI: 'DNI', CE: 'CE', PTP: 'PTP', PASAPORTE: 'Pasaporte' };

interface StoredRow {
  line: number;
  cells: string[];
  /** Columnas que eran números en Excel (al DNI pudo faltarle el 0 inicial). */
  num?: number[];
}
interface StoredFile {
  fileName: string;
  headers: string[];
  rows: StoredRow[];
}

export const FIX_VALUE_FIELDS = ['lastNames', 'firstNames', 'documentType', 'documentNumber', 'birthDate', 'email', 'siagieCode'] as const;
export type FixValueField = (typeof FIX_VALUE_FIELDS)[number];
/** Corrección de una fila: omitirla, «No es esta persona», elegir su sección o corregir un valor del archivo. */
export interface RowFix {
  skip?: boolean;
  newPerson?: boolean;
  sectionId?: string | null;
  values?: Partial<Record<FixValueField, string>>;
}
export interface RowFixPatch {
  skip?: boolean;
  newPerson?: boolean;
  /** 'auto': vuelve a la sección que dice el archivo. */
  sectionId?: string | null | 'auto';
  /** null: vuelve al valor del archivo. */
  values?: Partial<Record<FixValueField, string | null>>;
}
type Fixes = Record<string, RowFix>;

export interface Issue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  /** Qué valor edita «Corregir». */
  field?: FixValueField;
  /** El valor del archivo (nunca un documento). */
  value?: string;
  duplicateOf?: number;
  createSection?: { level: SchoolLevel; grade: number; name: string; label: string };
}
export type ChangeField = 'document' | 'birthDate' | 'email' | 'siagieCode' | 'section' | 'enrollment';
type RowStatus = 'READY' | 'WARNING' | 'ERROR' | 'SKIPPED';

interface ImportResult {
  createdStudentIds: string[];
  updates: Array<{ studentId: string; fields: string[]; enrollment: 'created' | 'assigned' | null }>;
}

const rowsContext = (batchId: string) => `school_import:${batchId}:rows`;
const fixesContext = (batchId: string) => `school_import:${batchId}:fixes`;
const parseJson = <T>(raw: unknown): T => (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
const nameKey = (lastNames: string, firstNames: string) => matchWords(`${lastNames} ${firstNames}`).sort().join(' ');
const chunks = <T>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

// ==================== LECTURA DEL ARCHIVO ====================

const rowTexts = (row: ExcelJS.Row, width: number) => {
  const cells: string[] = [];
  const num: number[] = [];
  for (let c = 1; c <= width; c++) {
    const { text, numeric } = cellText(row.getCell(c).value);
    cells.push(text.replace(/\s+/g, ' ').trim().slice(0, MAX_CELL));
    if (numeric) num.push(c - 1);
  }
  return { cells, num };
};

/** Encabezados y filas de una hoja; null si no tiene encabezados reconocibles. */
const readSheet = (sheet: ExcelJS.Worksheet) => {
  const width = Math.min(sheet.columnCount, MAX_COLUMNS);
  if (!width) return null;
  // El encabezado: entre las primeras filas, la que más columnas reconoce (la nómina del SIAGIE trae títulos arriba).
  let best = { row: 0, score: 0 };
  for (let r = 1; r <= Math.min(sheet.rowCount, HEADER_SCAN_ROWS); r++) {
    const mapping = detectMapping(rowTexts(sheet.getRow(r), width).cells);
    const score = mapping.filter(Boolean).length;
    if (score >= 2 && score > best.score && mapping.some((f) => f && IDENTITY_FIELDS.includes(f))) best = { row: r, score };
  }
  if (!best.row) return null;
  let headers = rowTexts(sheet.getRow(best.row), width).cells;
  let dataStart = best.row + 1;
  // Encabezado en dos filas («Apellidos» sobre «Paterno | Materno»): manda el de abajo donde dice algo reconocible.
  // Una fila de datos nunca trae dos encabezados (el «DNI» de «Tipo de documento» no cuenta).
  const below = rowTexts(sheet.getRow(best.row + 1), width).cells;
  const looksLikeData = below.some((text) => /\d{5,}/.test(text) || /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(text));
  if (isHeaderRow(below) && !looksLikeData) {
    headers = headers.map((header, i) => (isHeaderText(below[i]) ? below[i] : header || below[i]));
    dataStart++;
  }
  let used = headers.length;
  while (used > 0 && !headers[used - 1]) used--;
  headers = headers.slice(0, used);

  const rows: StoredRow[] = [];
  let tooMany = false;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < dataStart || tooMany) return;
    const { cells, num } = rowTexts(row, used);
    if (!cells.some(Boolean)) return;
    if (rows.length >= MAX_ROWS) {
      tooMany = true;
      return;
    }
    rows.push(num.length ? { line: rowNumber, cells, num } : { line: rowNumber, cells });
  });
  if (tooMany) throw new ValidationError(`El archivo tiene más de ${MAX_ROWS} filas: divídelo en partes`);
  return { headers, rows, mapping: detectMapping(headers) };
};

const readWorkbook = async (buffer: Buffer) => {
  // El formato antiguo (.xls) empieza con la firma de los documentos OLE.
  if (buffer.length >= 4 && buffer.readUInt32BE(0) === 0xd0cf11e0) {
    throw new ValidationError('Es un Excel antiguo (.xls): ábrelo y guárdalo como «Libro de Excel (.xlsx)»');
  }
  assertSafeXlsx(buffer, XLSX_LIMITS);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ValidationError('No se pudo leer el archivo: ábrelo en Excel y guárdalo de nuevo como .xlsx');
  }
  for (const sheet of workbook.worksheets) {
    if (sheet.state && sheet.state !== 'visible') continue;
    const found = readSheet(sheet);
    if (found) return found;
  }
  throw new ValidationError('No encontré los encabezados (por ejemplo «Apellidos», «Nombres», «DNI»). Usa la plantilla de Juried o la nómina del SIAGIE');
};

// ==================== DATOS DEL COLEGIO ====================

const loadYear = async (schoolId: string, yearId: string, forWrite: boolean) => {
  const [year] = await db.select({ id: schoolYears.id, name: schoolYears.name, status: schoolYears.status }).from(schoolYears)
    .where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)));
  if (!year) throw new NotFoundError('Año escolar no encontrado');
  if (forWrite && year.status === 'CLOSED') throw new ConflictError('Este año escolar ya cerró: solo se puede consultar');
  return year;
};

const loadContext = async (schoolId: string, yearId: string) => {
  const sections = await db.select({ id: schoolSections.id, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name })
    .from(schoolSections).where(and(eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId)))
    .orderBy(asc(schoolSections.level), asc(schoolSections.grade), asc(schoolSections.name));
  const levels = (await db.select({ level: schoolYearLevels.level }).from(schoolYearLevels).where(eq(schoolYearLevels.yearId, yearId)))
    .map((l) => l.level);
  const students = await db.select({
    id: schoolStudents.id,
    firstNames: schoolStudents.firstNames,
    lastNames: schoolStudents.lastNames,
    documentIndex: schoolStudents.documentIndex,
    documentHint: schoolStudents.documentHint,
    birthDate: schoolStudents.birthDate,
    email: schoolStudents.institutionalEmail,
    siagieCode: schoolStudents.siagieCode,
    status: schoolStudents.status,
    enrollmentId: schoolEnrollments.id,
    sectionId: schoolEnrollments.sectionId,
  }).from(schoolStudents)
    .leftJoin(schoolEnrollments, and(eq(schoolEnrollments.studentId, schoolStudents.id), eq(schoolEnrollments.yearId, yearId)))
    .where(eq(schoolStudents.schoolId, schoolId));
  return { sections, levels, students };
};
type Context = Awaited<ReturnType<typeof loadContext>>;
type StudentRow = Context['students'][number];

// ==================== EVALUACIÓN DE LAS FILAS ====================

interface PlannedRow {
  line: number;
  status: RowStatus;
  action: 'CREATE' | 'UPDATE' | 'NONE';
  names: { lastNames: string; firstNames: string };
  document: { type: DocumentType; normalized: string; index: string } | null;
  documentMasked: boolean;
  birthDate: string | null;
  email: string | null;
  siagieCode: string | null;
  sectionId: string | null;
  sectionText: string | null;
  match: { student: StudentRow; by: 'CODE' | 'DOCUMENT' | 'NAME' } | null;
  changes: ChangeField[];
  issues: Issue[];
  fix: RowFix | null;
}

/** Qué pasaría con cada fila si se confirmara ahora (con las correcciones guardadas). */
const evaluate = (schoolId: string, file: StoredFile, mapping: Array<ImportField | null>, fixes: Fixes, ctx: Context): PlannedRow[] => {
  const label = new Map(ctx.sections.map((s) => [s.id, sectionDisplayName(s.level, s.grade, s.name)]));
  const byId = new Map(ctx.students.map((s) => [s.id, s]));
  const byIndex = new Map(ctx.students.filter((s) => s.documentIndex).map((s) => [s.documentIndex!, s]));
  const byName = new Map<string, StudentRow[]>();
  for (const student of ctx.students) {
    if (student.status !== 'ACTIVE') continue;
    const key = nameKey(student.lastNames, student.firstNames);
    if (key) byName.set(key, [...(byName.get(key) ?? []), student]);
  }
  const column = new Map<ImportField, number>();
  mapping.forEach((field, i) => { if (field) column.set(field, i); });
  const defaultLevel = ctx.levels.length === 1 ? ctx.levels[0] : null;

  /** La sección de la fila: la elegida al corregir, o la que dice el archivo si existe una sola así. */
  const resolveSection = (cell: (field: ImportField) => string, fix: RowFix | null): {
    sectionId: string | null; text: string | null; problem: Issue | null; chosen: boolean;
  } => {
    if (fix && fix.sectionId !== undefined && (fix.sectionId === null || label.has(fix.sectionId))) {
      return { sectionId: fix.sectionId, text: null, problem: null, chosen: true };
    }
    let level = parseLevel(cell('level'));
    let grade: number | null = null;
    let name: string | null = null;
    let original = '';
    const combined = cell('gradeSection');
    if (combined) {
      const parsed = parseGradeSection(combined);
      level = level ?? parsed.level;
      grade = parsed.grade;
      name = parsed.section;
      original = combined;
    } else {
      const gradeText = cell('grade');
      const sectionText = cell('section');
      if (gradeText) {
        const parsed = parseGradeSection(gradeText);
        level = level ?? parsed.level;
        grade = parsed.grade;
        if (!sectionText && parsed.section) {
          name = parsed.section;
          original = gradeText;
        }
      }
      if (sectionText) {
        if (gradeText) {
          name = comparableText(cleanText(sectionText));
        } else {
          const parsed = parseGradeSection(sectionText);
          level = level ?? parsed.level;
          grade = parsed.grade;
          name = parsed.section;
        }
        original = sectionText;
      }
    }
    if (grade === null && !name) return { sectionId: null, text: null, problem: null, chosen: false };
    const text = cleanText([cell('gradeSection') || cell('grade'), cell('gradeSection') ? '' : cell('section')].filter(Boolean).join(' '));
    level = level ?? defaultLevel;
    const candidates = ctx.sections.filter((s) =>
      (!level || s.level === level) && (grade === null || s.grade === grade) && (name === null || comparableText(s.name) === name));
    if (candidates.length === 1) return { sectionId: candidates[0].id, text, problem: null, chosen: false };
    if (candidates.length > 1) {
      const options = candidates.slice(0, 3).map((c) => `${label.get(c.id)}${ctx.levels.length > 1 ? ` (${LEVEL_NAME[c.level]})` : ''}`);
      return { sectionId: null, text, chosen: false, problem: { code: 'section_ambiguous', severity: 'error', message: `«${text}» puede ser ${options.join(' o ')}: elige la sección` } };
    }
    if (level && grade !== null && name && LEVEL_GRADES[level].includes(grade)) {
      const sectionName = sectionLabelFrom(original, name);
      const sectionLabel = sectionDisplayName(level, grade, sectionName);
      return {
        sectionId: null, text, chosen: false,
        problem: {
          code: 'section_unknown', severity: 'error',
          message: `No existe ${sectionLabel}${ctx.levels.length > 1 ? ` en ${LEVEL_NAME[level]}` : ''}`,
          createSection: { level, grade, name: sectionName, label: sectionLabel },
        },
      };
    }
    return { sectionId: null, text, chosen: false, problem: { code: 'section_unknown', severity: 'error', message: `No encuentro la sección «${text}»: elígela` } };
  };

  const planRow = (row: StoredRow): PlannedRow => {
    const fix = fixes[String(row.line)] ?? null;
    if (isHeaderRow(row.cells)) {
      return {
        line: row.line, status: 'READY', action: 'NONE', names: { lastNames: '', firstNames: '' }, document: null, documentMasked: false,
        birthDate: null, email: null, siagieCode: null, sectionId: null, sectionText: null, match: null, changes: [], fix,
        issues: [{ code: 'header_row', severity: 'error', message: 'Es una fila de encabezados: no se importa' }],
      };
    }
    const cell = (field: ImportField) => {
      const i = column.get(field);
      return i === undefined ? '' : row.cells[i] ?? '';
    };
    const value = (field: FixValueField, fromFile: string) => fix?.values?.[field] ?? fromFile;
    const issues: Issue[] = [];
    const error = (code: string, message: string, extra: Partial<Issue> = {}) => { issues.push({ code, severity: 'error', message, ...extra }); };
    const warning = (code: string, message: string, extra: Partial<Issue> = {}) => { issues.push({ code, severity: 'warning', message, ...extra }); };

    // Nombre: columnas separadas, o «Apellidos y nombres» en una sola (con coma no hay duda).
    let lastNames = cell('lastNames') || [cell('lastName1'), cell('lastName2')].filter(Boolean).join(' ');
    let firstNames = cell('firstNames');
    let guessed = false;
    if (!lastNames && !firstNames && cell('fullName')) {
      const split = splitPersonName(cell('fullName'));
      lastNames = split.lastNames.join(' ');
      firstNames = split.firstNames.join(' ');
      guessed = !cell('fullName').includes(',');
    }
    if (fix?.values?.lastNames !== undefined || fix?.values?.firstNames !== undefined) guessed = false;
    lastNames = tidyName(cleanText(value('lastNames', lastNames)));
    firstNames = tidyName(cleanText(value('firstNames', firstNames)));

    // Documento (los enmascarados de la plantilla no cambian nada).
    let document: PlannedRow['document'] = null;
    let documentMasked = false;
    const documentText = value('documentNumber', cell('documentNumber'));
    if (documentText && isMaskedDocument(documentText)) {
      documentMasked = true;
    } else if (documentText) {
      const typeText = value('documentType', cell('documentType'));
      const type = parseDocumentType(typeText);
      if (!type) {
        error('document_type', 'No reconozco el tipo de documento: usa DNI, CE, PTP o Pasaporte', { field: 'documentType', value: typeText });
      } else {
        let number = normalizeDocument(documentText);
        const docColumn = column.get('documentNumber');
        const wasNumber = fix?.values?.documentNumber === undefined && docColumn !== undefined && !!row.num?.includes(docColumn);
        if (type === 'DNI' && wasNumber && /^\d{5,7}$/.test(number)) {
          number = number.padStart(8, '0');
          warning('document_padded', 'Excel borró los ceros del inicio del DNI: se completaron');
        }
        const normalized = parseDocument(type, number);
        if (normalized) document = { type, normalized, index: documentIndex(schoolId, normalized) };
        else error('document_invalid', type === 'DNI' ? 'El DNI debe tener 8 números' : 'Revisa el número del documento', { field: 'documentNumber' });
      }
    }

    const section = resolveSection(cell, fix);

    // Emparejar: Código Juried → documento → nombre (primero dentro de su sección).
    let match: PlannedRow['match'] = null;
    const code = cell('juriedCode').trim().toLowerCase();
    if (code) {
      const student = UUID_RE.test(code) ? byId.get(code) : undefined;
      if (student) match = { student, by: 'CODE' };
      else error('code_unknown', 'Este Código Juried no es de tu colegio: no lo cambies ni lo copies de otro archivo');
    }
    const owner = document ? byIndex.get(document.index) : undefined;
    if (owner && match && owner.id !== match.student.id) {
      error('code_document_mismatch', `El documento es de ${owner.lastNames}, ${owner.firstNames}, no de este Código Juried`, { field: 'documentNumber' });
    } else if (owner && !match && !code) {
      match = { student: owner, by: 'DOCUMENT' };
    }
    const key = nameKey(lastNames, firstNames);
    let nameElsewhere: StudentRow | null = null;
    if (!match && !code && key && !fix?.newPerson) {
      const candidates = byName.get(key) ?? [];
      const inSection = section.sectionId ? candidates.filter((c) => c.sectionId === section.sectionId) : [];
      if (inSection.length === 1) {
        match = { student: inSection[0], by: 'NAME' };
      } else if (inSection.length > 1) {
        error('name_ambiguous', `Hay ${inSection.length} estudiantes con este nombre en ${label.get(section.sectionId!)}: agrega su DNI o su Código Juried`);
      } else if (candidates.length === 1) {
        match = { student: candidates[0], by: 'NAME' };
        nameElsewhere = candidates[0];
      } else if (candidates.length > 1) {
        error('name_ambiguous', `Hay ${candidates.length} estudiantes con este nombre en el colegio: agrega su DNI o su Código Juried`);
      }
    }
    const student = match?.student ?? null;
    if (student && match) {
      const padron = `${student.lastNames}, ${student.firstNames}`;
      if (student.status !== 'ACTIVE') error('withdrawn', `${padron} figura como retirado del colegio: la importación no lo cambia`);
      if (match.by === 'NAME' && document && student.documentIndex && student.documentIndex !== document.index) {
        error('document_conflict', `Coincide por nombre con ${padron}, pero su documento es otro. Si es otra persona, elige «No es esta persona»`);
      } else if (nameElsewhere) {
        const where = nameElsewhere.sectionId ? `de ${label.get(nameElsewhere.sectionId) ?? 'otra sección'}` : 'que aún no tiene sección';
        warning('name_elsewhere', `Coincide por nombre con ${padron}, ${where}. Si no es la misma persona, elige «No es esta persona»`);
      }
      // Un código o documento de otra persona (filas desordenadas, un dígito mal): el nombre no se parece en nada.
      if (match.by !== 'NAME' && key) {
        const theirs = matchWords(`${student.lastNames} ${student.firstNames}`);
        const alike = matchWords(`${lastNames} ${firstNames}`).some((word) => theirs.some((other) => sameWord(word, other, true)));
        if (!alike) {
          error('name_mismatch', match.by === 'DOCUMENT'
            ? `El documento es de ${padron}, pero el nombre del archivo es otro: revisa el documento`
            : `Este Código Juried es de ${padron}, pero el nombre del archivo es otro: ¿se desordenaron las filas?`,
          match.by === 'DOCUMENT' ? { field: 'documentNumber' } : {});
        }
      }
    }

    // Datos que se completan (o avisos si no se entienden o si ya hay otro).
    const birthText = value('birthDate', cell('birthDate'));
    const birthParsed = birthText ? parseDate(birthText) : null;
    const birthDate = birthParsed && isPlausibleBirthDate(birthParsed) ? birthParsed : null;
    const emailText = value('email', cell('email')).trim().toLowerCase();
    const email = emailText && emailSchema.safeParse(emailText).success ? emailText : null;
    const siagieText = value('siagieCode', cell('siagieCode')).trim().toUpperCase();
    const siagieCode = /^[0-9A-Z]{4,20}$/.test(siagieText) ? siagieText : null;

    const changes: ChangeField[] = [];
    const fill = (field: 'birthDate' | 'email' | 'siagieCode', next: string | null, current: string | null, raw: string, problem: string, other: string) => {
      if (current) {
        if (next && next !== current) warning(`${field}_other`, other);
        return;
      }
      if (next) changes.push(field);
      else if (raw) warning(`${field}_invalid`, `${problem}: no se carga`, { field, value: raw });
    };
    const fillAll = (s: StudentRow | null) => {
      fill('birthDate', birthDate, s?.birthDate ?? null, birthText,
        birthParsed ? 'La fecha de nacimiento no es creíble para un estudiante' : 'No entiendo la fecha de nacimiento (usa día/mes/año)',
        'Su fecha de nacimiento registrada es otra: no se cambia');
      fill('email', email, s?.email ?? null, emailText, 'El correo no es válido', 'Su correo registrado es otro: no se cambia');
      fill('siagieCode', siagieCode, s?.siagieCode ?? null, siagieText, 'El código SIAGIE tiene de 4 a 20 letras o números', 'Su código SIAGIE registrado es otro: no se cambia');
    };

    let action: PlannedRow['action'] = 'NONE';
    if (student) {
      if (document && !owner) {
        if (!student.documentIndex) changes.push('document');
        else if (match?.by === 'CODE') warning('document_other', 'Ya tiene otro documento registrado: no se cambia desde la importación');
      }
      fillAll(student);
      if (!student.enrollmentId) changes.push('enrollment');
      if (!student.sectionId) {
        if (section.sectionId && student.enrollmentId) changes.push('section');
        if (section.problem) issues.push({ ...section.problem, severity: 'warning', message: `${section.problem.message}: no se le asigna sección` });
      } else if (section.sectionId && section.sectionId !== student.sectionId) {
        warning('section_other', `Está en ${label.get(student.sectionId) ?? 'otra sección'} y el archivo dice ${label.get(section.sectionId)}: para cambiarlo usa «Trasladar»`);
      }
      action = changes.length ? 'UPDATE' : 'NONE';
    } else if (!code) {
      if (!lastNames || !firstNames) error('name_missing', lastNames || firstNames ? 'Faltan los apellidos o los nombres' : 'Falta el nombre', { field: 'lastNames' });
      else if (!NAME_RE.test(lastNames) || !NAME_RE.test(firstNames)) error('name_invalid', 'El nombre tiene números o signos: corrígelo', { field: 'lastNames' });
      else if (lastNames.length > 100 || firstNames.length > 100) error('name_invalid', 'El nombre es demasiado largo', { field: 'lastNames' });
      else if (guessed) warning('name_order', 'Revisa qué parte son apellidos y qué parte nombres', { field: 'lastNames' });
      if (document) changes.push('document');
      fillAll(null);
      if (section.problem) issues.push(section.problem);
      else if (section.sectionId) changes.push('section');
      else if (!section.chosen) warning('section_missing', 'Sin sección: entra al padrón sin sección');
      action = 'CREATE';
    }

    return {
      line: row.line, status: 'READY', action, names: { lastNames, firstNames }, document, documentMasked, birthDate, email, siagieCode,
      sectionId: section.sectionId, sectionText: section.text, match, changes, issues, fix,
    };
  };

  // Solo las filas con algo en las columnas que se usan (títulos o pies de página en otras columnas no cuentan).
  const planned = file.rows.filter((row) => mapping.some((field, i) => field && row.cells[i])).map(planRow);

  // Repetidos en el archivo: vale la primera fila que se importaría; las demás no se importan (o avisan).
  const firstStudent = new Map<string, number>();
  const firstDocument = new Map<string, number>();
  const firstName = new Map<string, number>();
  for (const row of planned) {
    if (row.fix?.skip || row.issues.some((i) => i.severity === 'error')) continue;
    const sameStudent = row.match ? firstStudent.get(row.match.student.id) : undefined;
    const appliesDocument = row.document && (row.action === 'CREATE' || row.changes.includes('document'));
    const sameDocument = appliesDocument ? firstDocument.get(row.document!.index) : undefined;
    if (sameStudent !== undefined) {
      row.issues.push({ code: 'duplicate_row', severity: 'error', message: `Es el mismo estudiante de la fila ${sameStudent}`, duplicateOf: sameStudent });
      continue;
    }
    if (sameDocument !== undefined) {
      row.issues.push({ code: 'duplicate_row', severity: 'error', message: `Repite el documento de la fila ${sameDocument}`, duplicateOf: sameDocument });
      continue;
    }
    if (row.match) firstStudent.set(row.match.student.id, row.line);
    if (appliesDocument) firstDocument.set(row.document!.index, row.line);
    if (row.action === 'CREATE' && !row.document) {
      const key = `${nameKey(row.names.lastNames, row.names.firstNames)}|${row.sectionId ?? ''}`;
      const seen = firstName.get(key);
      if (seen !== undefined) row.issues.push({ code: 'same_name_row', severity: 'warning', message: `Mismo nombre que la fila ${seen}: ¿está repetido?`, duplicateOf: seen });
      else firstName.set(key, row.line);
    }
  }
  for (const row of planned) {
    row.status = row.fix?.skip ? 'SKIPPED'
      : row.issues.some((i) => i.severity === 'error') ? 'ERROR'
        : row.issues.length ? 'WARNING' : 'READY';
  }
  return planned;
};

const summarize = (rows: PlannedRow[]) => {
  const importable = rows.filter((r) => r.status === 'READY' || r.status === 'WARNING');
  return {
    total: rows.length,
    ready: rows.filter((r) => r.status === 'READY').length,
    warning: rows.filter((r) => r.status === 'WARNING').length,
    error: rows.filter((r) => r.status === 'ERROR').length,
    skipped: rows.filter((r) => r.status === 'SKIPPED').length,
    create: importable.filter((r) => r.action === 'CREATE').length,
    update: importable.filter((r) => r.action === 'UPDATE').length,
    unchanged: importable.filter((r) => r.action === 'NONE').length,
  };
};

/** Avisos del paso «Columnas»: qué no se podrá hacer con las columnas elegidas. */
const mappingNotes = (mapping: Array<ImportField | null>) => {
  const has = (field: ImportField) => mapping.includes(field);
  const notes: string[] = [];
  if (!has('fullName') && !(has('firstNames') && (has('lastNames') || has('lastName1')))) {
    notes.push('Sin apellidos y nombres solo se completan datos de estudiantes que ya están en el padrón');
  }
  if (!has('juriedCode') && !has('documentNumber')) notes.push('Sin DNI ni Código Juried, cada fila se busca por su nombre');
  if (!has('gradeSection') && !has('grade') && !has('section')) notes.push('Sin grado ni sección, los estudiantes nuevos entran sin sección');
  return notes;
};

/** Para el paso «Columnas»: los números largos (documentos, códigos) se ven enmascarados. */
const maskLong = (text: string) => text.replace(/[A-Za-z0-9]{6,}/g, (m) => (/\d/.test(m) ? maskDocument(m.toUpperCase()) : m));

// ==================== LOTES ====================

type Batch = typeof schoolImportBatches.$inferSelect;

const loadBatch = async (schoolId: string, yearId: string, batchId: string) => {
  const [batch] = await db.select().from(schoolImportBatches)
    .where(and(eq(schoolImportBatches.id, batchId), eq(schoolImportBatches.schoolId, schoolId), eq(schoolImportBatches.yearId, yearId)));
  if (!batch) throw new NotFoundError('Esa importación ya no está');
  return batch;
};

const expired = (batch: Pick<Batch, 'expiresAt'>) => new Date(batch.expiresAt).getTime() < Date.now();

const openFile = (batch: Batch): StoredFile => {
  if (!batch.rowsEncrypted || expired(batch)) throw new NotFoundError('Esta importación venció (duran 24 horas): sube el archivo otra vez');
  return JSON.parse(decryptPii(batch.rowsEncrypted, rowsContext(batch.id))) as StoredFile;
};

const openFixes = (batch: Batch): Fixes => (batch.fixesEncrypted ? JSON.parse(decryptPii(batch.fixesEncrypted, fixesContext(batch.id))) as Fixes : {});

const assertReview = (batch: Batch) => {
  if (batch.status !== 'REVIEW') throw new ConflictError('Esta importación ya se confirmó o se deshizo');
  if (!batch.rowsEncrypted || expired(batch)) throw new NotFoundError('Esta importación venció (duran 24 horas): sube el archivo otra vez');
};

const evaluateBatch = async (schoolId: string, yearId: string, batch: Batch) => {
  const file = openFile(batch);
  const mapping = parseJson<Array<ImportField | null>>(batch.mapping);
  const ctx = await loadContext(schoolId, yearId);
  return { file, mapping, ctx, rows: evaluate(schoolId, file, mapping, openFixes(batch), ctx) };
};

/** Se puede deshacer durante 24 horas si nadie tocó después a esos estudiantes. */
const UNDO_MS = 24 * 60 * 60 * 1000;

/** Estudiantes cuya sección puso la importación: los nuevos y los que recibieron sección o matrícula. */
const sectionedStudents = (result: ImportResult | null) => [
  ...(result?.createdStudentIds ?? []),
  ...(result?.updates ?? []).filter((u) => u.enrollment).map((u) => u.studentId),
];

/**
 * Por qué ya no se puede deshacer una importación (o null si se puede): pasaron 24 horas, o alguno de sus estudiantes
 * tuvo después movimientos, cambios de datos, una cuenta, clases vinculadas a mano o actividad en los perfiles que la
 * matrícula automática les creó.
 */
const undoBlocker = async (
  executor: Pick<typeof db, 'select' | 'selectDistinct'>,
  batch: { confirmedAt: Date | null; result: unknown },
): Promise<string | null> => {
  if (!batch.confirmedAt) return 'esta importación no se confirmó';
  const confirmedAt = new Date(batch.confirmedAt);
  if (Date.now() > confirmedAt.getTime() + UNDO_MS) return 'ya pasaron 24 horas desde la importación';
  const result = parseJson<ImportResult | null>(batch.result);
  const created = result?.createdStudentIds ?? [];
  const ids = [...created, ...(result?.updates ?? []).map((u) => u.studentId)];
  if (!ids.length) return null;
  const auto = await schoolAutoEnrollService.inspect(executor, sectionedStudents(result), confirmedAt);
  if (auto.used > 0) return `ya hay actividad en ${auto.used} ${auto.used === 1 ? 'perfil' : 'perfiles'} que la matrícula automática creó en sus clases`;
  const autoProfiles = new Set(auto.all);
  const touched = new Set<string>();
  // Los movimientos de la importación llevan su misma hora exacta: cualquiera posterior es de otra acción.
  const later = await executor.selectDistinct({ id: schoolEnrollmentEvents.studentId }).from(schoolEnrollmentEvents)
    .where(and(inArray(schoolEnrollmentEvents.studentId, ids), gt(schoolEnrollmentEvents.createdAt, confirmedAt)));
  later.forEach((r) => touched.add(r.id));
  // updated_at se guarda en segundos: un segundo de margen.
  const after = new Date(confirmedAt.getTime() + 1000);
  const edited = await executor.select({ id: schoolStudents.id }).from(schoolStudents)
    .where(and(inArray(schoolStudents.id, ids), gt(schoolStudents.updatedAt, after)));
  edited.forEach((r) => touched.add(r.id));
  if (created.length) {
    // Perfiles ligados a mano (armado): la matrícula automática se deshace sola si no se usaron.
    const linked = await executor.select({ id: studentProfiles.id, studentId: studentProfiles.schoolStudentId }).from(studentProfiles)
      .where(inArray(studentProfiles.schoolStudentId, created));
    linked.forEach((r) => { if (r.studentId && !autoProfiles.has(r.id)) touched.add(r.studentId); });
    const withAccount = await executor.select({ id: schoolStudents.id }).from(schoolStudents)
      .where(and(inArray(schoolStudents.id, created), isNotNull(schoolStudents.userId)));
    withAccount.forEach((r) => touched.add(r.id));
  }
  if (!touched.size) return null;
  return `ya hubo cambios en ${touched.size} ${touched.size === 1 ? 'estudiante' : 'estudiantes'} de esa importación`;
};

const batchSummary = (batch: Pick<Batch, 'id' | 'status' | 'source' | 'rowCount' | 'revision' | 'createdAt' | 'expiresAt' | 'confirmedAt' | 'undoneAt' | 'createdCount' | 'updatedCount'>) => ({
  id: batch.id,
  status: batch.status,
  source: batch.source,
  rowCount: batch.rowCount,
  revision: batch.revision,
  createdAt: batch.createdAt,
  expiresAt: batch.expiresAt,
  confirmedAt: batch.confirmedAt,
  undoneAt: batch.undoneAt,
  created: batch.createdCount,
  updated: batch.updatedCount,
});

export const schoolRosterImportService = {
  /** Plantilla con el padrón del año (documentos enmascarados) para completar datos o agregar estudiantes. */
  async template(schoolId: string, yearId: string) {
    const year = await loadYear(schoolId, yearId, false);
    const rows = await db.select({
      id: schoolStudents.id,
      lastNames: schoolStudents.lastNames,
      firstNames: schoolStudents.firstNames,
      documentType: schoolStudents.documentType,
      documentHint: schoolStudents.documentHint,
      birthDate: schoolStudents.birthDate,
      email: schoolStudents.institutionalEmail,
      siagieCode: schoolStudents.siagieCode,
      level: schoolSections.level,
      grade: schoolSections.grade,
      section: schoolSections.name,
    }).from(schoolEnrollments)
      .innerJoin(schoolStudents, eq(schoolStudents.id, schoolEnrollments.studentId))
      .leftJoin(schoolSections, eq(schoolSections.id, schoolEnrollments.sectionId))
      .where(and(eq(schoolEnrollments.schoolId, schoolId), eq(schoolEnrollments.yearId, yearId), eq(schoolStudents.status, 'ACTIVE')))
      .orderBy(sql`${schoolSections.level} IS NULL`, asc(schoolSections.level), asc(schoolSections.grade), asc(schoolSections.name),
        asc(schoolStudents.lastNames), asc(schoolStudents.firstNames));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Juried';
    const sheet = workbook.addWorksheet('Padrón', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { header: 'Código Juried (no borrar)', key: 'id', width: 38 },
      { header: 'Apellidos', key: 'lastNames', width: 28 },
      { header: 'Nombres', key: 'firstNames', width: 24 },
      { header: 'Tipo de documento', key: 'documentType', width: 18 },
      { header: 'Número de documento', key: 'document', width: 20, style: { numFmt: '@' } },
      { header: 'Fecha de nacimiento', key: 'birthDate', width: 18, style: { numFmt: 'dd/mm/yyyy' } },
      { header: 'Correo institucional', key: 'email', width: 32 },
      { header: 'Código SIAGIE', key: 'siagieCode', width: 18, style: { numFmt: '@' } },
      { header: 'Nivel', key: 'level', width: 12 },
      { header: 'Grado', key: 'grade', width: 8 },
      { header: 'Sección', key: 'section', width: 14 },
    ];
    const header = sheet.getRow(1);
    header.font = { bold: true };
    header.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }; });
    for (const row of rows) {
      sheet.addRow({
        id: row.id,
        lastNames: row.lastNames,
        firstNames: row.firstNames,
        documentType: row.documentType ? DOCUMENT_LABEL[row.documentType] : '',
        document: row.documentHint ? `•••••${row.documentHint}` : '',
        birthDate: row.birthDate ? new Date(`${row.birthDate}T00:00:00Z`) : '',
        email: row.email ?? '',
        siagieCode: row.siagieCode ?? '',
        level: row.level ? LEVEL_NAME[row.level] : '',
        grade: row.grade ?? '',
        section: row.section ?? '',
      });
    }
    sheet.getColumn('id').font = { color: { argb: 'FF6B7280' } };
    header.getCell(1).font = { bold: true };
    // Listas para el tipo de documento y el nivel (también en filas vacías para agregar estudiantes).
    for (let r = 2; r <= rows.length + 300; r++) {
      sheet.getCell(r, 4).dataValidation = { type: 'list', allowBlank: true, formulae: ['"DNI,CE,PTP,Pasaporte"'] };
      sheet.getCell(r, 9).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Inicial,Primaria,Secundaria"'] };
    }

    const help = workbook.addWorksheet('Cómo llenarla');
    help.getColumn(1).width = 110;
    [
      'Cómo llenar la plantilla del padrón',
      '1. No borres ni cambies la columna «Código Juried»: así se reconoce a cada estudiante que ya está en el padrón.',
      '2. Para agregar estudiantes nuevos, escribe filas nuevas al final y deja vacío su Código Juried.',
      '3. El DNI tiene 8 números. Si Excel borra el 0 del inicio, Juried lo completa al importar.',
      '4. Los documentos que ves como •••••678 ya están registrados: déjalos así.',
      '5. La fecha de nacimiento va en día/mes/año (por ejemplo 14/03/2012).',
      '6. Importar completa los datos vacíos y da sección a quien aún no tiene. No cambia nombres, documentos ya',
      '   registrados ni secciones: eso se hace en la ficha del estudiante o con «Trasladar».',
      '7. No ordenes solo una columna: Excel desordenaría las filas. Si ordenas, selecciona toda la tabla.',
    ].forEach((text, i) => { help.addRow([text]).font = i === 0 ? { bold: true, size: 13 } : {}; });

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const safeYear = year.name.replace(/[^0-9A-Za-z-]+/g, '-').replace(/^-|-$/g, '') || 'anio';
    return { buffer, filename: `padron-${safeYear}.xlsx`, students: rows.length };
  },

  /** Sube un archivo: queda en revisión 24 horas (cifrado). Reemplaza a otra importación del año aún en revisión. */
  async upload(schoolId: string, yearId: string, actorId: string, input: { buffer: Buffer; name: string }) {
    await loadYear(schoolId, yearId, true);
    if (!piiReady()) throw new ConflictError('El servidor aún no tiene las llaves para guardar datos personales. Avísale al equipo de Juried.');
    const parsed = await readWorkbook(input.buffer);
    if (!parsed.rows.length) throw new ValidationError('No encontré filas con estudiantes debajo de los encabezados');
    const stored: StoredFile = { fileName: cleanText(input.name).slice(0, 120) || 'archivo.xlsx', headers: parsed.headers, rows: parsed.rows };
    const json = JSON.stringify(stored);
    if (json.length > MAX_STORED_CHARS) throw new ValidationError('El archivo tiene demasiado texto: deja solo las columnas del padrón');
    const id = uuidv4();
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.delete(schoolImportBatches).where(and(
        eq(schoolImportBatches.schoolId, schoolId), eq(schoolImportBatches.yearId, yearId), eq(schoolImportBatches.status, 'REVIEW'),
      ));
      await tx.insert(schoolImportBatches).values({
        id, schoolId, yearId, actorUserId: actorId, status: 'REVIEW', source: detectSource(parsed.headers), rowCount: parsed.rows.length,
        mapping: parsed.mapping, rowsEncrypted: encryptPii(json, rowsContext(id)), createdAt: now, updatedAt: now,
        expiresAt: new Date(now.getTime() + TTL_MS),
      });
    });
    return this.get(schoolId, yearId, id);
  },

  /** La importación en revisión del año (para continuarla) y la última confirmada (para deshacerla). */
  async current(schoolId: string, yearId: string) {
    await loadYear(schoolId, yearId, false);
    const [pending] = await db.select({
      id: schoolImportBatches.id, rowCount: schoolImportBatches.rowCount, createdAt: schoolImportBatches.createdAt, expiresAt: schoolImportBatches.expiresAt,
    }).from(schoolImportBatches)
      .where(and(
        eq(schoolImportBatches.schoolId, schoolId), eq(schoolImportBatches.yearId, yearId), eq(schoolImportBatches.status, 'REVIEW'),
        gt(schoolImportBatches.expiresAt, new Date()),
      ))
      .orderBy(desc(schoolImportBatches.createdAt)).limit(1);
    const [last] = await db.select({
      id: schoolImportBatches.id,
      confirmedAt: schoolImportBatches.confirmedAt,
      created: schoolImportBatches.createdCount,
      updated: schoolImportBatches.updatedCount,
      result: schoolImportBatches.result,
    }).from(schoolImportBatches)
      .where(and(eq(schoolImportBatches.schoolId, schoolId), eq(schoolImportBatches.yearId, yearId), eq(schoolImportBatches.status, 'CONFIRMED')))
      .orderBy(desc(schoolImportBatches.confirmedAt)).limit(1);
    let lastImport = null;
    if (last?.confirmedAt) {
      const blockedReason = await undoBlocker(db, last);
      lastImport = {
        id: last.id,
        confirmedAt: last.confirmedAt,
        created: last.created,
        updated: last.updated,
        undoableUntil: new Date(new Date(last.confirmedAt).getTime() + UNDO_MS),
        canUndo: !blockedReason,
        blockedReason,
      };
    }
    return { pending: pending ?? null, last: lastImport };
  },

  /** Una importación: columnas, filas evaluadas (documentos enmascarados) y conteos. */
  async get(schoolId: string, yearId: string, batchId: string) {
    await loadYear(schoolId, yearId, false);
    const batch = await loadBatch(schoolId, yearId, batchId);
    if (batch.status !== 'REVIEW') return { ...batchSummary(batch), review: null };
    const { file, mapping, ctx, rows } = await evaluateBatch(schoolId, yearId, batch);
    const label = new Map(ctx.sections.map((s) => [s.id, sectionDisplayName(s.level, s.grade, s.name)]));
    return {
      ...batchSummary(batch),
      review: {
        fileName: file.fileName,
        headers: file.headers,
        mapping,
        samples: file.rows.slice(0, 3).map((r) => r.cells.map(maskLong)),
        notes: mappingNotes(mapping),
        levels: ctx.levels,
        sections: ctx.sections.map((s) => ({ ...s, label: label.get(s.id)! })),
        counts: summarize(rows),
        rows: rows.map((row) => ({
          line: row.line,
          status: row.status,
          action: row.action,
          name: row.match
            ? `${row.match.student.lastNames}, ${row.match.student.firstNames}`
            : [row.names.lastNames, row.names.firstNames].filter(Boolean).join(', '),
          fileNames: row.names,
          document: row.document
            ? maskDocument(row.document.normalized)
            : row.documentMasked && row.match?.student.documentHint ? `•••••${row.match.student.documentHint}` : null,
          birthDate: row.birthDate,
          section: row.sectionId ? { id: row.sectionId, label: label.get(row.sectionId) ?? '' } : null,
          sectionText: row.sectionText,
          match: row.match
            ? {
              studentId: row.match.student.id,
              name: `${row.match.student.lastNames}, ${row.match.student.firstNames}`,
              by: row.match.by,
              section: row.match.student.sectionId ? label.get(row.match.student.sectionId) ?? null : null,
            }
            : null,
          changes: row.changes,
          issues: row.issues,
          fix: row.fix
            ? {
              skip: !!row.fix.skip,
              newPerson: !!row.fix.newPerson,
              sectionId: row.fix.sectionId === undefined ? 'auto' : row.fix.sectionId,
              corrected: Object.keys(row.fix.values ?? {}),
            }
            : null,
        })),
      },
    };
  },

  /** Paso «Columnas»: qué campo es cada columna. */
  async saveMapping(schoolId: string, yearId: string, batchId: string, mapping: Array<ImportField | null>) {
    await loadYear(schoolId, yearId, true);
    const batch = await loadBatch(schoolId, yearId, batchId);
    assertReview(batch);
    if (mapping.length !== parseJson<unknown[]>(batch.mapping).length) throw new ValidationError('Las columnas no coinciden con el archivo');
    await db.update(schoolImportBatches)
      .set({ mapping, revision: sql`${schoolImportBatches.revision} + 1`, updatedAt: new Date() })
      .where(and(eq(schoolImportBatches.id, batch.id), eq(schoolImportBatches.status, 'REVIEW')));
    return this.get(schoolId, yearId, batchId);
  },

  /** Corrige una fila (omitir, «No es esta persona», sección, valores). Bloquea el lote: dos sesiones no se pisan. */
  async fixRow(schoolId: string, yearId: string, batchId: string, line: number, patch: RowFixPatch) {
    await loadYear(schoolId, yearId, true);
    await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(schoolImportBatches)
        .where(and(eq(schoolImportBatches.id, batchId), eq(schoolImportBatches.schoolId, schoolId), eq(schoolImportBatches.yearId, yearId)))
        .for('update');
      if (!batch) throw new NotFoundError('Esa importación ya no está');
      assertReview(batch);
      if (!openFile(batch).rows.some((r) => r.line === line)) throw new NotFoundError('Esa fila no está en el archivo');
      if (typeof patch.sectionId === 'string' && patch.sectionId !== 'auto') {
        const [section] = await tx.select({ id: schoolSections.id }).from(schoolSections).where(and(
          eq(schoolSections.id, patch.sectionId), eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId),
        ));
        if (!section) throw new ValidationError('Esa sección no es de este año escolar');
      }
      const fixes = openFixes(batch);
      const next: RowFix = { ...(fixes[String(line)] ?? {}) };
      if (patch.skip !== undefined) {
        if (patch.skip) next.skip = true;
        else delete next.skip;
      }
      if (patch.newPerson !== undefined) {
        if (patch.newPerson) next.newPerson = true;
        else delete next.newPerson;
      }
      if (patch.sectionId !== undefined) {
        if (patch.sectionId === 'auto') delete next.sectionId;
        else next.sectionId = patch.sectionId;
      }
      if (patch.values) {
        const values = { ...(next.values ?? {}) };
        for (const field of FIX_VALUE_FIELDS) {
          const v = patch.values[field];
          if (v === null) delete values[field];
          else if (v !== undefined) values[field] = v;
        }
        if (Object.keys(values).length) next.values = values;
        else delete next.values;
      }
      if (Object.keys(next).length) fixes[String(line)] = next;
      else delete fixes[String(line)];
      await tx.update(schoolImportBatches).set({
        fixesEncrypted: Object.keys(fixes).length ? encryptPii(JSON.stringify(fixes), fixesContext(batch.id)) : null,
        revision: batch.revision + 1,
        updatedAt: new Date(),
      }).where(eq(schoolImportBatches.id, batch.id));
    });
    return this.get(schoolId, yearId, batchId);
  },

  /**
   * Confirma: crea los estudiantes nuevos (con su matrícula) y completa los datos vacíos de los que ya estaban, todo en
   * una transacción. `revision` es la que se revisó: si el lote cambió entretanto, se pide revisar otra vez.
   */
  async confirm(schoolId: string, yearId: string, batchId: string, actorId: string, revision: number) {
    await loadYear(schoolId, yearId, true);
    if (!piiReady()) throw new ConflictError('El servidor aún no tiene las llaves para guardar datos personales. Avísale al equipo de Juried.');
    const batch = await loadBatch(schoolId, yearId, batchId);
    assertReview(batch);
    const { rows } = await evaluateBatch(schoolId, yearId, batch);
    const importable = rows.filter((r) => (r.status === 'READY' || r.status === 'WARNING') && r.action !== 'NONE');
    if (!importable.length) throw new ValidationError('No hay cambios para importar: corrige las filas con error o sube otro archivo');

    const now = new Date();
    const importId = batch.id;
    const createdStudentIds: string[] = [];
    const updates: ImportResult['updates'] = [];
    try {
      await db.transaction(async (tx) => {
        const [lock] = await tx.select({ status: schoolImportBatches.status, revision: schoolImportBatches.revision, expiresAt: schoolImportBatches.expiresAt })
          .from(schoolImportBatches).where(eq(schoolImportBatches.id, batch.id)).for('update');
        if (!lock || lock.status !== 'REVIEW') throw new ConflictError('Esta importación ya se confirmó desde otra sesión: recarga la página');
        if (expired(lock)) throw new NotFoundError('Esta importación venció (duran 24 horas): sube el archivo otra vez');
        if (lock.revision !== revision) throw new ConflictError('La importación cambió mientras la revisabas: revisa las filas otra vez');

        const students: Array<typeof schoolStudents.$inferInsert> = [];
        const enrollments: Array<typeof schoolEnrollments.$inferInsert> = [];
        const events: Array<typeof schoolEnrollmentEvents.$inferInsert> = [];
        const event = (studentId: string, type: 'ENROLLED' | 'DATA_UPDATED' | 'SECTION_CHANGED', extra: Partial<typeof schoolEnrollmentEvents.$inferInsert>) =>
          events.push({ id: uuidv4(), schoolId, studentId, yearId, type, actorUserId: actorId, createdAt: now, ...extra });

        for (const row of importable.filter((r) => r.action === 'CREATE')) {
          const id = uuidv4();
          students.push({
            id, schoolId, ...row.names,
            ...(row.document ? prepareDocument(schoolId, id, { type: row.document.type, number: row.document.normalized }) : {}),
            birthDate: row.birthDate, institutionalEmail: row.email, siagieCode: row.siagieCode,
            createdBy: actorId, createdAt: now, updatedAt: now,
          });
          enrollments.push({ id: uuidv4(), schoolId, yearId, studentId: id, sectionId: row.sectionId, createdAt: now, updatedAt: now });
          event(id, 'ENROLLED', { toSectionId: row.sectionId, metadata: { importId } });
          createdStudentIds.push(id);
        }

        // Los que ya estaban: solo lo que sigue vacío (bloqueados: otra sesión pudo completarlo entretanto).
        for (const row of importable.filter((r) => r.action === 'UPDATE')) {
          const studentId = row.match!.student.id;
          const [current] = await tx.select({
            documentIndex: schoolStudents.documentIndex, birthDate: schoolStudents.birthDate, email: schoolStudents.institutionalEmail,
            siagieCode: schoolStudents.siagieCode, status: schoolStudents.status,
          }).from(schoolStudents).where(and(eq(schoolStudents.id, studentId), eq(schoolStudents.schoolId, schoolId))).for('update');
          if (!current || current.status !== 'ACTIVE') continue;
          const values: Partial<typeof schoolStudents.$inferInsert> = {};
          const fields: string[] = [];
          if (row.changes.includes('document') && row.document && !current.documentIndex) {
            Object.assign(values, prepareDocument(schoolId, studentId, { type: row.document.type, number: row.document.normalized }));
            fields.push('document');
          }
          if (row.changes.includes('birthDate') && !current.birthDate) { values.birthDate = row.birthDate; fields.push('birthDate'); }
          if (row.changes.includes('email') && !current.email) { values.institutionalEmail = row.email; fields.push('email'); }
          if (row.changes.includes('siagieCode') && !current.siagieCode) { values.siagieCode = row.siagieCode; fields.push('siagieCode'); }
          let enrollment: 'created' | 'assigned' | null = null;
          if (row.changes.includes('enrollment') || row.changes.includes('section')) {
            const [existing] = await tx.select({ id: schoolEnrollments.id, sectionId: schoolEnrollments.sectionId }).from(schoolEnrollments)
              .where(and(eq(schoolEnrollments.studentId, studentId), eq(schoolEnrollments.yearId, yearId))).for('update');
            if (!existing) {
              enrollments.push({ id: uuidv4(), schoolId, yearId, studentId, sectionId: row.sectionId, createdAt: now, updatedAt: now });
              event(studentId, 'ENROLLED', { toSectionId: row.sectionId, metadata: { importId } });
              enrollment = 'created';
            } else if (!existing.sectionId && row.sectionId) {
              await tx.update(schoolEnrollments).set({ sectionId: row.sectionId, updatedAt: now }).where(eq(schoolEnrollments.id, existing.id));
              event(studentId, 'SECTION_CHANGED', { toSectionId: row.sectionId, metadata: { assigned: true, importId } });
              enrollment = 'assigned';
            }
          }
          if (fields.length) {
            await tx.update(schoolStudents).set({ ...values, updatedAt: now }).where(eq(schoolStudents.id, studentId));
            event(studentId, 'DATA_UPDATED', { metadata: { fields: fields.join(','), importId } });
          }
          if (fields.length || enrollment) updates.push({ studentId, fields, enrollment });
        }

        for (const part of chunks(students, 200)) await tx.insert(schoolStudents).values(part);
        for (const part of chunks(enrollments, 200)) await tx.insert(schoolEnrollments).values(part);
        for (const part of chunks(events, 200)) await tx.insert(schoolEnrollmentEvents).values(part);
        await tx.update(schoolImportBatches).set({
          status: 'CONFIRMED', confirmedAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + TTL_MS),
          createdCount: createdStudentIds.length, updatedCount: updates.length, result: { createdStudentIds, updates },
        }).where(eq(schoolImportBatches.id, batch.id));
      });
    } catch (error) {
      if (isDuplicateEntry(error)) throw new ConflictError('Un documento o una matrícula del archivo se registró mientras revisabas: revisa las filas otra vez');
      throw error;
    }
    const counts = summarize(rows);
    // Matrícula automática: los nuevos y los que recibieron sección entran a las clases vinculadas de su sección.
    const auto = await schoolAutoEnrollService.syncStudents(schoolId, yearId, sectionedStudents({ createdStudentIds, updates }));
    return {
      created: createdStudentIds.length, updated: updates.length, errors: counts.error, skipped: counts.skipped,
      autoEnrolled: auto.created + auto.linked,
    };
  },

  /**
   * Deshace la última importación del año (24 horas, sin estudiantes tocados después): borra los estudiantes que creó y
   * vacía lo que completó en los demás (documento, datos, sección o matrícula).
   */
  async undo(schoolId: string, yearId: string, batchId: string) {
    await loadYear(schoolId, yearId, true);
    const now = new Date();
    return db.transaction(async (tx) => {
      const [batch] = await tx.select({
        id: schoolImportBatches.id, status: schoolImportBatches.status, confirmedAt: schoolImportBatches.confirmedAt, result: schoolImportBatches.result,
      }).from(schoolImportBatches)
        .where(and(eq(schoolImportBatches.id, batchId), eq(schoolImportBatches.schoolId, schoolId), eq(schoolImportBatches.yearId, yearId)))
        .for('update');
      if (!batch || batch.status !== 'CONFIRMED' || !batch.confirmedAt) throw new NotFoundError('Esa importación ya no se puede deshacer');
      const [newer] = await tx.select({ id: schoolImportBatches.id }).from(schoolImportBatches).where(and(
        eq(schoolImportBatches.schoolId, schoolId), eq(schoolImportBatches.yearId, yearId), eq(schoolImportBatches.status, 'CONFIRMED'),
        ne(schoolImportBatches.id, batch.id), gt(schoolImportBatches.confirmedAt, batch.confirmedAt),
      )).limit(1);
      if (newer) throw new ConflictError('Solo se puede deshacer la última importación');
      const blockedReason = await undoBlocker(tx, batch);
      if (blockedReason) throw new ConflictError(`No se puede deshacer: ${blockedReason}`);

      const result = parseJson<ImportResult>(batch.result);
      // Primero los perfiles que la matrícula automática creó o ligó por esta importación (ninguno se usó).
      await schoolAutoEnrollService.revert(tx, await schoolAutoEnrollService.inspect(tx, sectionedStudents(result), new Date(batch.confirmedAt)));
      const created = result.createdStudentIds;
      for (const part of chunks(created, 500)) {
        await tx.delete(schoolEnrollmentEvents).where(and(inArray(schoolEnrollmentEvents.studentId, part), eq(schoolEnrollmentEvents.schoolId, schoolId)));
        await tx.delete(schoolEnrollments).where(and(inArray(schoolEnrollments.studentId, part), eq(schoolEnrollments.schoolId, schoolId)));
        await tx.delete(schoolStudents).where(and(inArray(schoolStudents.id, part), eq(schoolStudents.schoolId, schoolId)));
      }
      for (const update of result.updates) {
        const values: Partial<typeof schoolStudents.$inferInsert> = {};
        if (update.fields.includes('document')) Object.assign(values, { documentType: null, documentEncrypted: null, documentIndex: null, documentHint: null });
        if (update.fields.includes('birthDate')) values.birthDate = null;
        if (update.fields.includes('email')) values.institutionalEmail = null;
        if (update.fields.includes('siagieCode')) values.siagieCode = null;
        if (Object.keys(values).length) {
          await tx.update(schoolStudents).set({ ...values, updatedAt: now })
            .where(and(eq(schoolStudents.id, update.studentId), eq(schoolStudents.schoolId, schoolId)));
        }
        const enrollmentOf = and(eq(schoolEnrollments.studentId, update.studentId), eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.schoolId, schoolId));
        if (update.enrollment === 'created') await tx.delete(schoolEnrollments).where(enrollmentOf);
        else if (update.enrollment === 'assigned') await tx.update(schoolEnrollments).set({ sectionId: null, updatedAt: now }).where(enrollmentOf);
      }
      // Los movimientos que dejó la importación en los estudiantes que ya estaban.
      for (const part of chunks(result.updates.map((u) => u.studentId), 500)) {
        await tx.delete(schoolEnrollmentEvents).where(and(
          inArray(schoolEnrollmentEvents.studentId, part), eq(schoolEnrollmentEvents.schoolId, schoolId),
          sql`JSON_UNQUOTE(JSON_EXTRACT(${schoolEnrollmentEvents.metadata}, '$.importId')) = ${batch.id}`,
        ));
      }
      await tx.update(schoolImportBatches)
        .set({ status: 'UNDONE', undoneAt: now, updatedAt: now, rowsEncrypted: null, fixesEncrypted: null })
        .where(eq(schoolImportBatches.id, batch.id));
      return { removed: created.length, restored: result.updates.length };
    });
  },

  /** Las filas con error, con sus columnas originales y «Qué corregir», para arreglarlas y volver a subirlas. */
  async errorRows(schoolId: string, yearId: string, batchId: string) {
    await loadYear(schoolId, yearId, false);
    const batch = await loadBatch(schoolId, yearId, batchId);
    const { file, mapping, rows } = await evaluateBatch(schoolId, yearId, batch);
    const failed = rows.filter((r) => r.status === 'ERROR');
    if (!failed.length) throw new NotFoundError('No hay filas con error');
    const byLine = new Map(file.rows.map((r) => [r.line, r]));
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Juried';
    const sheet = workbook.addWorksheet('Filas con error', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [...file.headers.map((h, i) => ({ header: h || `Columna ${i + 1}`, width: 20 })), { header: 'Qué corregir', width: 60 }];
    const textColumns = ['documentNumber', 'siagieCode', 'juriedCode'] as const;
    textColumns.forEach((field) => {
      const i = mapping.indexOf(field);
      if (i >= 0) sheet.getColumn(i + 1).numFmt = '@';
    });
    sheet.getRow(1).font = { bold: true };
    for (const row of failed) {
      const cells = byLine.get(row.line)?.cells ?? [];
      sheet.addRow([...file.headers.map((_, i) => cells[i] ?? ''), row.issues.filter((i) => i.severity === 'error').map((i) => i.message).join(' · ')]);
    }
    return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), filename: 'filas-con-error.xlsx', rows: failed.length };
  },

  /** Descarta una importación en revisión. */
  async discard(schoolId: string, yearId: string, batchId: string) {
    await loadYear(schoolId, yearId, true);
    const result = await db.delete(schoolImportBatches).where(and(
      eq(schoolImportBatches.id, batchId), eq(schoolImportBatches.schoolId, schoolId), eq(schoolImportBatches.yearId, yearId),
      eq(schoolImportBatches.status, 'REVIEW'),
    ));
    if (!affectedRows(result)) throw new NotFoundError('Esa importación ya no está');
  },

  /** Borra lo vencido: las importaciones sin confirmar y las filas cifradas de las confirmadas. */
  async purgeExpired() {
    const now = new Date();
    const removed = await db.delete(schoolImportBatches)
      .where(and(eq(schoolImportBatches.status, 'REVIEW'), lt(schoolImportBatches.expiresAt, now)));
    const cleared = await db.update(schoolImportBatches).set({ rowsEncrypted: null, fixesEncrypted: null })
      .where(and(ne(schoolImportBatches.status, 'REVIEW'), lt(schoolImportBatches.expiresAt, now), isNotNull(schoolImportBatches.rowsEncrypted)));
    return affectedRows(removed) + affectedRows(cleared);
  },
};
