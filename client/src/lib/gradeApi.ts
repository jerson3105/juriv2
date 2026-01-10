import api from './api';

export interface ActivityScore {
  type: string;
  id: string;
  name: string;
  score: number;
  weight: number;
}

export interface StudentGrade {
  id: string;
  competencyId: string;
  competencyName: string;
  score: string;
  gradeLabel: string;
  activitiesCount: number;
  calculationDetails?: {
    activities: ActivityScore[];
    totalWeight: number;
    rawScore: number;
  };
  isManualOverride: boolean;
  manualScore?: string;
  manualNote?: string;
  calculatedAt: string;
}

export interface ClassroomGrade {
  id: string;
  studentProfileId: string;
  studentName: string;
  competencyId: string;
  competencyName: string;
  score: number;
  gradeLabel: string;
  activitiesCount: number;
  calculationDetails?: {
    activities: ActivityScore[];
    totalWeight: number;
    rawScore: number;
  };
  isManualOverride: boolean;
  manualScore?: number;
  notes?: string;
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

export const gradeApi = {
  // Obtener calificaciones de un estudiante
  getStudentGrades: async (studentProfileId: string, period: string = 'CURRENT'): Promise<StudentGrade[]> => {
    const response = await api.get(`/grades/student/${studentProfileId}`, {
      params: { period },
    });
    return response.data;
  },

  // Obtener calificaciones de toda una clase
  getClassroomGrades: async (classroomId: string, period: string = 'CURRENT'): Promise<ClassroomGrade[]> => {
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
};
