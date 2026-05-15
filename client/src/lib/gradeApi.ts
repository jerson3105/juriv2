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
  };
  indicatorBreakdownStatus: 'AVAILABLE' | 'HISTORICAL_NO_BREAKDOWN' | 'NOT_CONFIGURED';
  indicatorStartPeriod: string | null;
  indicatorBreakdown: CompetencyIndicatorBreakdown[];
  isManualOverride: boolean;
  manualScore?: number | null;
  manualNote?: string | null;
  calculatedAt: string;
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
  average: GradeAverageSummary;
  grades: ClassroomGrade[];
}

export interface ClassroomGradebookResponse {
  classroomId: string;
  period: string;
  gradeScaleType: 'PERU_LETTERS' | 'PERU_VIGESIMAL' | 'CENTESIMAL' | 'USA_LETTERS' | 'CUSTOM' | null;
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
  closedAt?: string;
}

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
  setManualGrade: async (gradeId: string, manualScore: number, manualNote?: string): Promise<{ success: boolean }> => {
    const response = await api.put(`/grades/${gradeId}/manual`, {
      manualScore,
      manualNote,
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
