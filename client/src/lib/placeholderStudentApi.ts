import { api } from './api';

export interface PlaceholderStudent {
  id: string;
  displayName: string;
  linkCode: string;
  characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
  avatarGender?: 'MALE' | 'FEMALE';
  xp?: number;
  hp?: number;
  gp?: number;
  level?: number;
}

export interface CreatePlaceholderStudentData {
  displayName: string;
  characterClass?: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
  avatarGender?: 'MALE' | 'FEMALE';
}

export const placeholderStudentApi = {
  // Crear un estudiante placeholder
  create: async (classroomId: string, data: CreatePlaceholderStudentData) => {
    const response = await api.post(`/students/placeholder/${classroomId}`, data);
    return response.data;
  },

  // Crear múltiples estudiantes placeholder
  createBulk: async (classroomId: string, students: Array<{ displayName: string; characterClass?: string }>) => {
    const response = await api.post(`/students/placeholder/${classroomId}/bulk`, { students });
    return response.data;
  },

  // Obtener estudiantes placeholder de una clase
  getAll: async (classroomId: string): Promise<PlaceholderStudent[]> => {
    const response = await api.get(`/students/placeholder/${classroomId}`);
    return response.data.data;
  },

  // Regenerar código de vinculación
  regenerateCode: async (studentId: string) => {
    const response = await api.post(`/students/placeholder/${studentId}/regenerate-code`);
    return response.data;
  },

  // Descargar PDF con todas las tarjetas
  downloadAllCardsPDF: async (classroomId: string) => {
    const response = await api.post(
      `/students/placeholder/${classroomId}/pdf`,
      {},
      { responseType: 'blob' }
    );
    
    // Crear blob y descargar
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tarjetas-vinculacion.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Descargar PDF de estudiantes específicos
  downloadSelectedCardsPDF: async (classroomId: string, studentIds: string[]) => {
    const response = await api.post(
      `/students/placeholder/${classroomId}/pdf`,
      { studentIds },
      { responseType: 'blob' }
    );
    
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tarjetas-vinculacion.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Descargar PDF de una sola tarjeta
  downloadSingleCardPDF: async (studentId: string, studentName: string) => {
    const response = await api.get(
      `/students/placeholder/${studentId}/pdf/single`,
      { responseType: 'blob' }
    );
    
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tarjeta-${studentName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Vincular cuenta (para estudiantes)
  linkAccount: async (data: {
    linkCode: string;
    characterName?: string;
    avatarGender?: 'MALE' | 'FEMALE';
  }) => {
    const response = await api.post('/students/link-account', data);
    return response.data;
  },
};
