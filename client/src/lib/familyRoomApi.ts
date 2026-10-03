import { api } from './api';

// Sala de familias de una clase: avisos del docente y conversación con las familias en un solo hilo.

export type RoomKind = 'MESSAGE' | 'ANNOUNCEMENT';
export type Relationship = 'FATHER' | 'MOTHER' | 'TUTOR' | 'GUARDIAN';

export interface RoomMessage {
  id: string;
  kind: RoomKind;
  senderId: string;
  senderRole: 'TEACHER' | 'PARENT';
  /** Docente: nombre completo. Familia: «Marta P.» (sin apellido ni el nombre de su hijo). */
  senderName: string;
  message: string | null;
  isDeleted: boolean;
  createdAt: string;
  /** Solo para el docente y solo en avisos. */
  seen?: { seen: number; total: number };
}

export interface RoomPage {
  messages: RoomMessage[];
  nextCursor: string | null;
  isOpen: boolean;
}

export interface RoomFamily {
  userId: string;
  name: string;
  relationship: Relationship;
  students: string[];
}

export interface RoomFamiliesStudent {
  studentId: string;
  studentName: string;
  code: string | null;
  families: { linkId: string; userId: string; name: string; relationship: Relationship }[];
}

export interface RoomFamilyRequest {
  linkId: string;
  parentName: string;
  parentEmail: string | null;
  relationship: Relationship;
  studentId: string;
  studentName: string;
  createdAt: string;
}

export interface RoomFamilies {
  students: RoomFamiliesStudent[];
  pending: RoomFamilyRequest[];
  totals: { students: number; withFamily: number; families: number; pending: number };
}

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  MOTHER: 'madre',
  FATHER: 'padre',
  TUTOR: 'tutor/a',
  GUARDIAN: 'tutor/a legal',
};

export const MESSAGE_MAX_LENGTH = 2000;

export const familyRoomKeys = {
  room: (classroomId: string) => ['family-room', classroomId] as const,
  families: (classroomId: string) => ['family-room-families', classroomId] as const,
  readers: (classroomId: string, messageId: string) => ['family-room-readers', classroomId, messageId] as const,
};

export const familyRoomApi = {
  page: async (classroomId: string, before: string | null, limit?: number): Promise<RoomPage> =>
    (await api.get(`/classrooms/${classroomId}/room`, { params: { ...(before ? { before } : {}), ...(limit ? { limit } : {}) } })).data.data,
  post: async (classroomId: string, kind: RoomKind, message: string): Promise<RoomMessage> =>
    (await api.post(`/classrooms/${classroomId}/room/messages`, { kind, message })).data.data,
  remove: async (classroomId: string, messageId: string): Promise<void> => {
    await api.delete(`/classrooms/${classroomId}/room/messages/${messageId}`);
  },
  readers: async (classroomId: string, messageId: string): Promise<{ seen: RoomFamily[]; missing: RoomFamily[] }> =>
    (await api.get(`/classrooms/${classroomId}/room/messages/${messageId}/readers`)).data.data,
  setOpen: async (classroomId: string, isOpen: boolean): Promise<{ isOpen: boolean }> =>
    (await api.patch(`/classrooms/${classroomId}/room/settings`, { isOpen })).data.data,
  markRead: async (classroomId: string): Promise<void> => {
    await api.post(`/classrooms/${classroomId}/room/read`);
  },
  unread: async (classroomId: string): Promise<number> =>
    (await api.get(`/classrooms/${classroomId}/room/unread`)).data.data.count,
  families: async (classroomId: string): Promise<RoomFamilies> =>
    (await api.get(`/classrooms/${classroomId}/room/families`)).data.data,
  revokeFamily: async (classroomId: string, linkId: string): Promise<void> => {
    await api.delete(`/classrooms/${classroomId}/room/families/${linkId}`);
  },
};
