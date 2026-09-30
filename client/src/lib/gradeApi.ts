import api from './api';

export type PerformanceBucket = 'AD' | 'A' | 'B' | 'C';

export interface ActivityScore {
  type: string;
  id: string;
  name: string;
  score: number;
  weight: number;
}

export interface GradeAverageSummary {
  score: number;
  label: string;
  bucket: PerformanceBucket;
  evaluatedCompetencies: number;
}

export interface CompetencyIndicatorBreakdown {
  id: string;
  name: string;
  description: string | null;
  score: number | null;
  gradeLabel: string | null;
  bucket: PerformanceBucket | null;
  observations: number;
  positiveObservations: number;
  negativeObservations: number;
  positivePoints: number;
  negativePoints: number;
  evidenceWeight: number;
  hasEvidence: boolean;
}

export interface StudentGrade {
  id: string;
  competencyId: string;
  competencyName: string;
  score: number;
  gradeLabel: string;
  bucket: PerformanceBucket;
  activitiesCount: number;
  calculationDetails?: {
    activities: ActivityScore[];
    totalWeight: number;
    rawScore: number;
    evaluationScore?: number | null;
    evidenceScore?: number | null;
    evaluationWeight?: number;
  } | null;
  indicatorBreakdownStatus: 'AVAILABLE' | 'HISTORICAL_NO_BREAKDOWN' | 'NOT_CONFIGURED';
  indicatorStartPeriod: string | null;
  indicatorBreakdown: CompetencyIndicatorBreakdown[];
  isManualOverride: boolean;
  manualScore?: number | null;
  manualLabel?: string | null;
  /** Nota que calcula el sistema aunque haya ajuste manual. */
  calculatedScore?: number | null;
  calculatedLabel?: string | null;
  /** Hay ajuste manual y la calculada ya no coincide. */
  calculatedChanged?: boolean;
  /** Comentario visible para el alumno. */
  manualNote?: string | null;
  /** Nota privada (solo docente). */
  privateNote?: string | null;
  /** Conclusión descriptiva (libreta / SIAGIE). */
  conclusion?: string | null;
  calculatedAt: string;
}

export type GradeScaleType = 'PERU_LETTERS' | 'PERU_VIGESIMAL' | 'CENTESIMAL' | 'USA_LETTERS' | 'CUSTOM';

export type GradeScaleOptions =
  | { kind: 'letters'; values: Array<{ label: string; minPercent: number }> }
  | { kind: 'number'; min: number; max: number; step: number };

export interface GradebookCompetencyColumn {
  id: string;
  code: string;
  name: string | null;
  shortName: string | null;
  weight: number;
  isCustom: boolean;
  indicatorCount: number;
  /** Destrezas de la competencia (columnas desplegables del libro). */
  indicators: Array<{ id: string; code: string; name: string; weight: number }>;
}

export interface StudentGradebookResponse {
  studentProfileId: string;
  studentName: string;
  period: string;
  gradeScaleType: 'PERU_LETTERS' | 'PERU_VIGESIMAL' | 'CENTESIMAL' | 'USA_LETTERS' | 'CUSTOM' | null;
  average: GradeAverageSummary;
  grades: StudentGrade[];
}

export interface ClassroomGrade extends StudentGrade {
  studentProfileId: string;
  studentName: string;
}

export interface ClassroomGradeStudent {
  studentProfileId: string;
  studentName: string;
  characterName?: string | null;
  average: GradeAverageSummary;
  grades: ClassroomGrade[];
}

export interface ClassroomGradebookResponse {
  classroomId: string;
  period: string;
  gradeScaleType: GradeScaleType | null;
  scale: GradeScaleOptions;
  competencies: GradebookCompetencyColumn[];
  isClosed: boolean;
  evaluationWeight: number;
  lastCalculatedAt: string | null;
  students: ClassroomGradeStudent[];
  summary: {
    studentCount: number;
    evaluatedStudentCount: number;
    averageScore: number;
    distribution: Record<PerformanceBucket, number>;
  };
}

export interface CalculateResult {
  success: boolean;
  studentProfileId?: string;
  classroomId?: string;
  studentsProcessed?: number;
  grades: Array<{
    competencyId: string;
    competencyName: string;
    score: number;
    gradeLabel: string;
    activitiesCount: number;
  }>;
}

// Tipos para gestión de bimestres
export interface BimesterInfo {
  period: string;
  label: string;
  isCurrent: boolean;
  isClosed: boolean;
  isFuture?: boolean;
  closedAt?: string;
  /** Rango efectivo (ISO); end null = abierto sin fecha fija. */
  start?: string | null;
  end?: string | null;
  datesConfigured?: boolean;
}

export const EVALUATION_KINDS = ['EXAM', 'TASK', 'PROJECT', 'ORAL', 'PRACTICE', 'OTHER'] as const;
export type EvaluationKind = typeof EVALUATION_KINDS[number];

export interface GradeEvaluationSummary {
  id: string;
  title: string;
  kind: EvaluationKind;
  competencyId: string;
  competencyName: string | null;
  competencyShortName: string | null;
  indicatorId: string | null;
  indicatorName: string | null;
  evaluatedOn: string | null;
  weight: number;
  scored: number;
  average: number | null;
}

export interface GradeEvaluationDetail {
  id: string;
  classroomId: string;
  period: string;
  title: string;
  kind: EvaluationKind;
  competencyId: string;
  competencyName: string | null;
  competencyShortName: string | null;
  indicatorId: string | null;
  evaluatedOn: string | null;
  weight: number;
  isClosed: boolean;
  students: Array<{
    studentProfileId: string;
    studentName: string;
    characterName: string | null;
    label: string | null;
    score: number | null;
    note: string | null;
  }>;
}

export interface EvaluationInput {
  competencyId: string;
  indicatorId?: string | null;
  title: string;
  kind: EvaluationKind;
  evaluatedOn?: string | null;
  weight?: number;
}

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

export interface ConclusionProposal {
  gradeId: string;
  studentProfileId: string;
  studentName: string;
  gradeLabel: string;
  current: string | null;
  proposal: string;
}

export interface CopyConfigResult {
  targets: Array<{ classroomId: string; classroomName: string; ok: boolean; message: string; addedCompetencies: number; createdCustomCompetencies: number; createdIndicators: number }>;
}

// Descarga de un archivo recibido como blob.
const saveBlob = (data: BlobPart, type: string, filename: string) => {
  const url = window.URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export interface BimesterStatus {
  currentBimester: string;
  closedBimesters: Array<{
    period: string;
    closedAt: string;
    closedBy: string;
  }>;
  selectedYear: number;
  availableYears: number[];
  allBimesters: BimesterInfo[];
}

export const gradeApi = {
  // Comentario para el alumno, nota privada y conclusión
  updateGradeNotes: async (gradeId: string, notes: { manualNote?: string | null; privateNote?: string | null; conclusion?: string | null }) => {
    const response = await api.patch(`/grades/${gradeId}/notes`, notes);
    return response.data as { success: boolean };
  },

  // Escala, escala personalizada, peso de evaluaciones y peso por competencia
  updateGradeSettings: async (classroomId: string, settings: {
    gradeScaleType?: GradeScaleType;
    customRanges?: Array<{ label: string; minPercent: number }>;
    evaluationWeight?: number;
    competencyWeights?: Array<{ competencyId: string; weight: number }>;
  }) => {
    const response = await api.put(`/grades/settings/${classroomId}`, settings);
    return response.data as { success: boolean };
  },

  setBimesterDates: async (classroomId: string, period: string, start: string, end: string) => {
    const response = await api.put(`/grades/bimesters/${classroomId}/dates`, { period, start, end });
    return response.data as { success: boolean };
  },

  // Evaluaciones propias
  listEvaluations: async (classroomId: string, period = 'CURRENT'): Promise<{ period: string; evaluations: GradeEvaluationSummary[] }> => {
    const response = await api.get(`/grades/evaluations/${classroomId}`, { params: { period } });
    return response.data.data;
  },
  createEvaluation: async (classroomId: string, data: EvaluationInput & { period?: string }): Promise<GradeEvaluationDetail> => {
    const response = await api.post(`/grades/evaluations/${classroomId}`, data);
    return response.data.data;
  },
  getEvaluation: async (evaluationId: string): Promise<GradeEvaluationDetail> => {
    const response = await api.get(`/grades/evaluations/item/${evaluationId}`);
    return response.data.data;
  },
  updateEvaluation: async (evaluationId: string, data: Partial<EvaluationInput>): Promise<GradeEvaluationDetail> => {
    const response = await api.patch(`/grades/evaluations/item/${evaluationId}`, data);
    return response.data.data;
  },
  deleteEvaluation: async (evaluationId: string) => {
    await api.delete(`/grades/evaluations/item/${evaluationId}`);
  },
  saveEvaluationScores: async (evaluationId: string, scores: Array<{ studentProfileId: string; value: string | null; note?: string | null }>): Promise<GradeEvaluationDetail> => {
    const response = await api.put(`/grades/evaluations/item/${evaluationId}/scores`, { scores });
    return response.data.data;
  },
  downloadEvaluationTemplate: async (evaluationId: string, title: string) => {
    const response = await api.get(`/grades/evaluations/item/${evaluationId}/template`, { responseType: 'blob' });
    const safe = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'evaluacion';
    saveBlob(response.data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `notas-${safe}.xlsx`);
  },
  previewImport: async (evaluationId: string, input: { fileBase64?: string; text?: string }): Promise<{ rows: ImportPreviewRow[]; ready: number }> => {
    const response = await api.post(`/grades/evaluations/item/${evaluationId}/import-preview`, input);
    return response.data.data;
  },

  // Conclusiones descriptivas
  proposeConclusions: async (classroomId: string, competencyId: string, period = 'CURRENT', studentProfileIds?: string[]): Promise<{ competencyId: string; proposals: ConclusionProposal[] }> => {
    const response = await api.post(`/grades/conclusions/${classroomId}/propose`, { competencyId, period, studentProfileIds });
    return response.data.data;
  },
  saveConclusions: async (classroomId: string, items: Array<{ gradeId: string; conclusion: string | null }>) => {
    const response = await api.put(`/grades/conclusions/${classroomId}`, { items });
    return response.data.data as { saved: number };
  },

  // Copiar configuración a otras clases
  copyConfig: async (classroomId: string, data: { targetClassroomIds: string[]; scale: boolean; dates: boolean }): Promise<CopyConfigResult> => {
    const response = await api.post(`/grades/copy-config/${classroomId}`, data);
    return response.data.data;
  },

  // Obtener calificaciones de un estudiante
  getStudentGrades: async (studentProfileId: string, period: string = 'CURRENT'): Promise<StudentGradebookResponse> => {
    const response = await api.get(`/grades/student/${studentProfileId}`, {
      params: { period },
    });
    return response.data;
  },

  // Obtener calificaciones de toda una clase
  getClassroomGrades: async (classroomId: string, period: string = 'CURRENT'): Promise<ClassroomGradebookResponse> => {
    const response = await api.get(`/grades/classroom/${classroomId}`, {
      params: { period },
    });
    return response.data;
  },

  // Calcular calificaciones de un estudiante
  calculateStudentGrades: async (studentProfileId: string, classroomId: string, period: string = 'CURRENT'): Promise<CalculateResult> => {
    const response = await api.post(`/grades/calculate/student/${studentProfileId}`, {
      classroomId,
      period,
    });
    return response.data;
  },

  // Recalcular calificaciones de toda una clase
  recalculateClassroomGrades: async (classroomId: string, period: string = 'CURRENT'): Promise<CalculateResult> => {
    const response = await api.post(`/grades/calculate/classroom/${classroomId}`, {
      period,
    });
    return response.data;
  },

  // Establecer calificación manual
  setManualGrade: async (gradeId: string, value: string, manualNote?: string | null): Promise<{ success: boolean; score: number; label: string }> => {
    const response = await api.put(`/grades/${gradeId}/manual`, {
      value,
      ...(manualNote !== undefined ? { manualNote } : {}),
    });
    return response.data;
  },

  // Eliminar calificación manual
  clearManualGrade: async (gradeId: string): Promise<{ success: boolean }> => {
    const response = await api.delete(`/grades/${gradeId}/manual`);
    return response.data;
  },

  // Exportar libro de calificaciones en PDF
  exportPDF: async (classroomId: string, period: string = 'CURRENT'): Promise<void> => {
    const response = await api.get(`/grades/export/pdf/${classroomId}`, {
      params: { period },
      responseType: 'blob',
    });
    
    // Crear link de descarga
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `libro-calificaciones-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Exportar libro de calificaciones en Excel (formato SIAGIE)
  exportExcel: async (classroomId: string, period: string = 'CURRENT'): Promise<void> => {
    const response = await api.get(`/grades/export/excel/${classroomId}`, {
      params: { period },
      responseType: 'blob',
    });
    
    // Crear link de descarga
    const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `calificaciones-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // ═══════════════════════════════════════════════════════════
  // GESTIÓN DE BIMESTRES
  // ═══════════════════════════════════════════════════════════

  // Obtener estado de bimestres
  getBimesterStatus: async (classroomId: string, year?: number): Promise<BimesterStatus> => {
    const response = await api.get(`/grades/bimesters/${classroomId}`, {
      params: year ? { year } : undefined,
    });
    return response.data;
  },

  // Establecer bimestre actual
  setCurrentBimester: async (classroomId: string, period: string): Promise<{ success: boolean; currentBimester: string }> => {
    const response = await api.put(`/grades/bimesters/${classroomId}/current`, { period });
    return response.data;
  },

  // Cerrar bimestre
  closeBimester: async (classroomId: string, period: string): Promise<{ success: boolean; closedPeriod: string; newCurrentBimester: string }> => {
    const response = await api.post(`/grades/bimesters/${classroomId}/close`, { period });
    return response.data;
  },

  // Reabrir bimestre
  reopenBimester: async (classroomId: string, period: string): Promise<{ success: boolean; reopenedPeriod: string }> => {
    const response = await api.post(`/grades/bimesters/${classroomId}/reopen`, { period });
    return response.data;
  },
};
