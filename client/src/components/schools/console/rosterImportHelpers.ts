import type { FixValueField, ImportBatch, ImportField, ImportRow, ImportRowStatus } from '../../../lib/schoolRosterImportApi';

/** Qué dato es cada columna (paso «Columnas»), en el orden en que se ofrecen. */
export const FIELD_OPTIONS: { id: ImportField; label: string }[] = [
  { id: 'juriedCode', label: 'Código Juried' },
  { id: 'fullName', label: 'Apellidos y nombres (juntos)' },
  { id: 'lastNames', label: 'Apellidos' },
  { id: 'lastName1', label: 'Apellido paterno' },
  { id: 'lastName2', label: 'Apellido materno' },
  { id: 'firstNames', label: 'Nombres' },
  { id: 'documentType', label: 'Tipo de documento' },
  { id: 'documentNumber', label: 'Número de documento (DNI)' },
  { id: 'birthDate', label: 'Fecha de nacimiento' },
  { id: 'email', label: 'Correo institucional' },
  { id: 'siagieCode', label: 'Código SIAGIE' },
  { id: 'level', label: 'Nivel' },
  { id: 'grade', label: 'Grado' },
  { id: 'section', label: 'Sección' },
  { id: 'gradeSection', label: 'Grado y sección (juntos)' },
];

export const FIX_FIELD_LABEL: Record<FixValueField, string> = {
  lastNames: 'Apellidos', firstNames: 'Nombres', documentType: 'Tipo de documento', documentNumber: 'Número de documento',
  birthDate: 'Fecha de nacimiento', email: 'Correo institucional', siagieCode: 'Código SIAGIE',
};

export const SOURCE_LABEL: Record<ImportBatch['source'], string> = {
  JURIED: 'se reconoció la plantilla de Juried',
  SIAGIE: 'se reconoció la nómina del SIAGIE',
  OTHER: 'revisa qué dato es cada columna',
};

const CHANGE_LABEL: Record<ImportRow['changes'][number], string> = {
  document: 'DNI', birthDate: 'fecha de nacimiento', email: 'correo', siagieCode: 'código SIAGIE', section: 'sección', enrollment: 'matrícula del año',
};

/** Errores primero, luego avisos, omitidas y listas; dentro, por fila. */
const STATUS_ORDER: Record<ImportRowStatus, number> = { ERROR: 0, WARNING: 1, SKIPPED: 2, READY: 3 };
export const byAttention = (a: ImportRow, b: ImportRow) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.line - b.line;

/** Qué hará la fila cuando no tiene errores ni avisos. */
export const rowOutcome = (row: ImportRow) => {
  if (row.status === 'SKIPPED') return 'Omitida: no se importa.';
  if (row.action === 'CREATE') return 'Estudiante nuevo en el padrón.';
  if (row.action === 'UPDATE') {
    const what = row.changes.map((c) => CHANGE_LABEL[c]);
    const list = what.length > 1 ? `${what.slice(0, -1).join(', ')} y ${what[what.length - 1]}` : what[0];
    return `Completa ${list} de un estudiante del padrón.`;
  }
  return 'Ya está en el padrón: sin cambios.';
};

/** Filas que se importarán (las listas y las que tienen solo avisos). */
export const importable = (counts: { ready: number; warning: number }) => counts.ready + counts.warning;
