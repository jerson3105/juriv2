import api from './api';
import type { SchoolLevel } from './schoolYearApi';

/** Consola escolar: importar el padrón desde Excel (plantilla de Juried o nómina del SIAGIE). */

export const IMPORT_FIELDS = [
  'juriedCode', 'fullName', 'lastNames', 'lastName1', 'lastName2', 'firstNames', 'documentType', 'documentNumber',
  'birthDate', 'email', 'siagieCode', 'level', 'grade', 'section', 'gradeSection',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type FixValueField = 'lastNames' | 'firstNames' | 'documentType' | 'documentNumber' | 'birthDate' | 'email' | 'siagieCode';
export type ImportRowStatus = 'READY' | 'WARNING' | 'ERROR' | 'SKIPPED';

export interface ImportIssue {
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

export interface ImportRow {
  line: number;
  status: ImportRowStatus;
  action: 'CREATE' | 'UPDATE' | 'NONE';
  name: string;
  fileNames: { lastNames: string; firstNames: string };
  /** Enmascarado (•••••678). */
  document: string | null;
  birthDate: string | null;
  section: { id: string; label: string } | null;
  sectionText: string | null;
  match: { studentId: string; name: string; by: 'CODE' | 'DOCUMENT' | 'NAME'; section: string | null } | null;
  changes: Array<'document' | 'birthDate' | 'email' | 'siagieCode' | 'section' | 'enrollment'>;
  issues: ImportIssue[];
  fix: { skip: boolean; newPerson: boolean; sectionId: string | null | 'auto'; corrected: FixValueField[] } | null;
}

export interface ImportCounts {
  total: number;
  ready: number;
  warning: number;
  error: number;
  skipped: number;
  create: number;
  update: number;
  unchanged: number;
}

export interface ImportBatch {
  id: string;
  status: 'REVIEW' | 'CONFIRMED' | 'UNDONE';
  source: 'JURIED' | 'SIAGIE' | 'OTHER';
  rowCount: number;
  revision: number;
  createdAt: string;
  expiresAt: string;
  confirmedAt: string | null;
  undoneAt: string | null;
  created: number;
  updated: number;
  review: null | {
    fileName: string;
    headers: string[];
    mapping: Array<ImportField | null>;
    /** Primeras filas, con los números largos enmascarados. */
    samples: string[][];
    notes: string[];
    levels: SchoolLevel[];
    sections: Array<{ id: string; level: SchoolLevel; grade: number; name: string; label: string }>;
    counts: ImportCounts;
    rows: ImportRow[];
  };
}

export interface ImportCurrent {
  pending: { id: string; rowCount: number; createdAt: string; expiresAt: string } | null;
  last: {
    id: string;
    confirmedAt: string;
    created: number;
    updated: number;
    undoableUntil: string;
    canUndo: boolean;
    blockedReason: string | null;
  } | null;
}

export interface RowFixPatch {
  skip?: boolean;
  newPerson?: boolean;
  sectionId?: string | null | 'auto';
  values?: Partial<Record<FixValueField, string | null>>;
}

export const rosterImportKeys = {
  all: (schoolId: string, yearId: string) => ['roster-import', schoolId, yearId] as const,
  current: (schoolId: string, yearId: string) => ['roster-import', schoolId, yearId, 'current'] as const,
  batch: (schoolId: string, yearId: string, batchId: string) => ['roster-import', schoolId, yearId, 'batch', batchId] as const,
};

const base = (schoolId: string, yearId: string) => `/schools/${schoolId}/years/${yearId}/roster-import`;
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const saveBlob = (data: BlobPart, filename: string) => {
  const url = window.URL.createObjectURL(new Blob([data], { type: XLSX }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Una descarga que falla trae su mensaje JSON dentro de un Blob: se lee para mostrarlo.
const withBlobMessage = async (download: () => Promise<void>) => {
  try {
    await download();
  } catch (error) {
    const data = (error as { response?: { data?: unknown } })?.response?.data;
    if (data instanceof Blob) {
      const message = await data.text().then((text) => (JSON.parse(text) as { message?: string }).message).catch(() => undefined);
      if (message) throw new Error(message);
    }
    throw error;
  }
};

export const rosterImportApi = {
  current: async (schoolId: string, yearId: string): Promise<ImportCurrent> => (await api.get(`${base(schoolId, yearId)}/current`)).data.data,
  get: async (schoolId: string, yearId: string, batchId: string): Promise<ImportBatch> => (await api.get(`${base(schoolId, yearId)}/${batchId}`)).data.data,
  upload: async (schoolId: string, yearId: string, file: File): Promise<ImportBatch> => {
    const form = new FormData();
    form.append('file', file, file.name);
    // La instancia manda JSON por defecto: con FormData hay que pedir multipart (axios pone el boundary).
    return (await api.post(base(schoolId, yearId), form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data;
  },
  saveMapping: async (schoolId: string, yearId: string, batchId: string, mapping: Array<ImportField | null>): Promise<ImportBatch> =>
    (await api.put(`${base(schoolId, yearId)}/${batchId}/mapping`, { mapping })).data.data,
  fixRow: async (schoolId: string, yearId: string, batchId: string, line: number, patch: RowFixPatch): Promise<ImportBatch> =>
    (await api.patch(`${base(schoolId, yearId)}/${batchId}/rows/${line}`, patch)).data.data,
  confirm: async (schoolId: string, yearId: string, batchId: string, revision: number): Promise<{ created: number; updated: number; errors: number; skipped: number; message: string }> => {
    const response = await api.post(`${base(schoolId, yearId)}/${batchId}/confirm`, { revision });
    return { ...response.data.data, message: response.data.message };
  },
  undo: async (schoolId: string, yearId: string, batchId: string): Promise<{ removed: number; restored: number; message: string }> => {
    const response = await api.post(`${base(schoolId, yearId)}/${batchId}/undo`);
    return { ...response.data.data, message: response.data.message };
  },
  discard: async (schoolId: string, yearId: string, batchId: string): Promise<void> => {
    await api.delete(`${base(schoolId, yearId)}/${batchId}`);
  },
  downloadTemplate: (schoolId: string, yearId: string, yearName: string) => withBlobMessage(async () => {
    const response = await api.get(`${base(schoolId, yearId)}/template`, { responseType: 'blob' });
    saveBlob(response.data, `padron-${yearName.replace(/[^0-9A-Za-z-]+/g, '-') || 'anio'}.xlsx`);
  }),
  downloadErrors: (schoolId: string, yearId: string, batchId: string) => withBlobMessage(async () => {
    const response = await api.get(`${base(schoolId, yearId)}/${batchId}/errors`, { responseType: 'blob' });
    saveBlob(response.data, 'filas-con-error.xlsx');
  }),
};
