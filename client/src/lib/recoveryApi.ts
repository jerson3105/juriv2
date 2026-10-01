import api from './api';

export interface RecoveryMission {
  id: string;
  text: string;
  status: 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

export interface RestingOverview {
  templates: string[];
  students: { studentId: string; restingSince: string | null; mission: RecoveryMission | null }[];
}

export interface MyEnergy {
  resting: boolean;
  restingSince: string | null;
  hp: number;
  maxHp: number;
  initial: boolean;
  mission: RecoveryMission | null;
}

// Energía (HP) en 0 → "Descansando": misiones de recuperación que valida el profesor.
export const recoveryApi = {
  listResting: async (classroomId: string): Promise<RestingOverview> => {
    const response = await api.get(`/recovery/classroom/${classroomId}`);
    return response.data.data;
  },

  /** Asigna una misión (y con `complete`, la valida en el mismo paso). */
  assign: async (classroomId: string, studentId: string, text: string, complete = false): Promise<{ id: string; status: string }> => {
    const response = await api.post(`/recovery/classroom/${classroomId}/students/${studentId}`, { text, complete });
    return response.data.data;
  },

  complete: async (missionId: string): Promise<void> => {
    await api.post(`/recovery/missions/${missionId}/complete`);
  },

  /** El alumno: su energía y su misión pendiente. */
  mine: async (profileId: string): Promise<MyEnergy> => {
    const response = await api.get(`/recovery/me/${profileId}`);
    return response.data.data;
  },
};
