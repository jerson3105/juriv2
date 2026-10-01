import api from './api';
import type { ActivitySession } from './activityApi';

// Correo Estelar (Observatorio de Jiro): estrella secreta, cartas moderadas y privadas.
export type CorreoMode = 'papel' | 'dispositivo';
export type LetterStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CorreoPair {
  writerId: string;
  recipientId: string;
}

export interface CorreoState {
  prompt: string;
  mode: CorreoMode;
  pairs: CorreoPair[];
  delivered: string[];
  announced: string[];
}

export interface CorreoLetter {
  id: string;
  writerId: string;
  recipientId: string;
  message: string;
  status: LetterStatus;
  createdAt: string;
}

export interface MyCorreo {
  current: {
    sessionId: string;
    prompt: string;
    recipientName: string;
    sent: { status: LetterStatus; message: string } | null;
  } | null;
  received: { id: string; message: string; createdAt: string }[];
}

export const correoKeys = {
  letters: (sessionId: string) => ['correo-letters', sessionId] as const,
  mine: (profileId: string) => ['correo-mine', profileId] as const,
};

export const correoApi = {
  /** El servidor arma las parejas (nadie se escribe a sí mismo y todos reciben una carta). */
  create: async (classroomId: string, data: { studentIds: string[]; prompt: string; mode: CorreoMode }): Promise<ActivitySession<CorreoState>> => {
    const response = await api.post(`/correo/classroom/${classroomId}`, data);
    return response.data.data;
  },

  letters: async (sessionId: string): Promise<CorreoLetter[]> => {
    const response = await api.get(`/correo/sessions/${sessionId}/letters`);
    return response.data.data;
  },

  moderate: async (letterId: string, status: LetterStatus): Promise<void> => {
    await api.put(`/correo/letters/${letterId}`, { status });
  },

  mine: async (profileId: string): Promise<MyCorreo> => {
    const response = await api.get(`/correo/me/${profileId}`);
    return response.data.data;
  },

  send: async (profileId: string, message: string): Promise<void> => {
    await api.post(`/correo/me/${profileId}/letter`, { message });
  },
};
