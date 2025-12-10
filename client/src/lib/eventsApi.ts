import api from './api';

export interface EventEffect {
  type: 'XP' | 'HP' | 'GP';
  action: 'ADD' | 'REMOVE';
  value: number;
}

export interface RandomEvent {
  id: string;
  classroomId: string | null;
  name: string;
  description: string;
  category: 'BONUS' | 'CHALLENGE' | 'ROULETTE' | 'SPECIAL';
  targetType: 'ALL' | 'RANDOM_ONE' | 'RANDOM_SOME' | 'TOP' | 'BOTTOM';
  targetCount: number | null;
  effects: EventEffect[];
  icon: string;
  color: string;
  probability: number;
  // Programación
  scheduledAt: string | null;
  repeatType: 'NONE' | 'DAILY' | 'WEEKLY';
  repeatDays: number[] | null;
  repeatTime: string | null;
  // Duración
  durationType: 'INSTANT' | 'TIMED' | 'SESSION';
  durationMinutes: number;
  expiresAt: string | null;
  // Estado
  isGlobal: boolean;
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface SystemEvent {
  name: string;
  description: string;
  category: 'BONUS' | 'CHALLENGE' | 'ROULETTE' | 'SPECIAL';
  targetType: 'ALL' | 'RANDOM_ONE' | 'RANDOM_SOME' | 'TOP' | 'BOTTOM';
  targetCount?: number;
  effects: EventEffect[];
  icon: string;
  color: string;
}

export interface TriggerResult {
  success: boolean;
  message: string;
  affectedStudents?: {
    id: string;
    name: string;
    changes?: EventEffect[];
  }[];
  // Datos del evento
  event?: {
    name: string;
    description: string;
    icon: string;
    effects: EventEffect[];
  };
  // Para desafíos desde ruleta
  isChallenge?: boolean;
  challengeData?: ChallengeData;
}

export interface EventLog {
  id: string;
  eventId: string;
  triggeredAt: string;
  affectedStudents: string[];
  appliedEffects: EventEffect[];
  eventName: string;
  eventIcon: string;
  eventColor: string;
}

export interface CreateEventData {
  name: string;
  description: string;
  category: 'BONUS' | 'CHALLENGE' | 'ROULETTE' | 'SPECIAL';
  targetType: 'ALL' | 'RANDOM_ONE' | 'RANDOM_SOME' | 'TOP' | 'BOTTOM';
  targetCount?: number;
  effects: EventEffect[];
  icon?: string;
  color?: string;
  probability?: number;
  // Programación
  scheduledAt?: string;
  repeatType?: 'NONE' | 'DAILY' | 'WEEKLY';
  repeatDays?: number[];
  repeatTime?: string;
  // Duración
  durationType?: 'INSTANT' | 'TIMED' | 'SESSION';
  durationMinutes?: number;
}

export interface UpdateEventData extends Partial<CreateEventData> {
  isActive?: boolean;
}

export interface ChallengeData {
  eventId: string;
  eventName: string;
  eventIcon: string;
  eventColor: string;
  effects: EventEffect[];
  selectedStudents: { id: string; name: string }[];
}

export const eventsApi = {
  // Obtener eventos del sistema
  getSystemEvents: async (): Promise<SystemEvent[]> => {
    const response = await api.get('/events/system');
    return response.data.data;
  },

  // Obtener eventos de una clase
  getClassroomEvents: async (classroomId: string): Promise<RandomEvent[]> => {
    const response = await api.get(`/events/classroom/${classroomId}`);
    return response.data.data;
  },

  // Obtener historial de eventos
  getEventLogs: async (classroomId: string, limit?: number): Promise<EventLog[]> => {
    const params = limit ? `?limit=${limit}` : '';
    const response = await api.get(`/events/classroom/${classroomId}/logs${params}`);
    return response.data.data;
  },

  // Crear evento personalizado
  createEvent: async (classroomId: string, data: CreateEventData): Promise<RandomEvent> => {
    const response = await api.post(`/events/classroom/${classroomId}`, data);
    return response.data.data;
  },

  // Activar evento del sistema
  triggerSystemEvent: async (classroomId: string, eventIndex: number): Promise<TriggerResult> => {
    const response = await api.post(`/events/classroom/${classroomId}/trigger-system`, {
      eventIndex,
    });
    return response.data.data;
  },

  // Activar evento específico
  triggerEvent: async (classroomId: string, eventId: string): Promise<TriggerResult> => {
    const response = await api.post(`/events/classroom/${classroomId}/trigger/${eventId}`);
    return response.data.data;
  },

  // Obtener eventos personalizados de una clase
  getCustomEvents: async (classroomId: string): Promise<RandomEvent[]> => {
    const response = await api.get(`/events/classroom/${classroomId}/custom`);
    return response.data.data;
  },

  // Obtener un evento por ID
  getEventById: async (eventId: string): Promise<RandomEvent> => {
    const response = await api.get(`/events/${eventId}`);
    return response.data.data;
  },

  // Actualizar evento personalizado
  updateEvent: async (classroomId: string, eventId: string, data: UpdateEventData): Promise<RandomEvent> => {
    const response = await api.put(`/events/classroom/${classroomId}/${eventId}`, data);
    return response.data.data;
  },

  // Eliminar evento personalizado
  deleteEvent: async (classroomId: string, eventId: string): Promise<void> => {
    await api.delete(`/events/classroom/${classroomId}/${eventId}`);
  },

  // Girar ruleta de eventos
  spinRoulette: async (classroomId: string): Promise<TriggerResult> => {
    const response = await api.post(`/events/classroom/${classroomId}/spin-roulette`);
    return response.data.data;
  },

  // Iniciar desafío (selecciona estudiantes sin aplicar efectos)
  startChallenge: async (classroomId: string, eventId: string): Promise<ChallengeData> => {
    const response = await api.post(`/events/classroom/${classroomId}/challenge/${eventId}/start`);
    return response.data.data;
  },

  // Resolver desafío (aplicar efectos según resultado)
  resolveChallenge: async (
    classroomId: string,
    data: {
      studentIds: string[];
      effects: EventEffect[];
      completed: boolean;
      eventName: string;
    }
  ): Promise<TriggerResult> => {
    const response = await api.post(`/events/classroom/${classroomId}/challenge/resolve`, data);
    return response.data.data;
  },
};
