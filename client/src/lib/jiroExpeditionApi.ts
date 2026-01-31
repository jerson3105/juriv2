import api from './api';

// ==================== TIPOS ====================

export type JiroExpeditionMode = 'ASYNC' | 'EXAM';
export type JiroExpeditionStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
export type JiroStudentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'COMPLETED';
export type JiroDeliveryFileType = 'PDF' | 'IMAGE' | 'WORD' | 'EXCEL';
export type JiroDeliveryStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface JiroExpedition {
  id: string;
  classroomId: string;
  questionBankId: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  mode: JiroExpeditionMode;
  status: JiroExpeditionStatus;
  timeLimitMinutes: number | null;
  initialEnergy: number;
  energyRegenMinutes: number;
  energyPurchasePrice: number;
  rewardXpPerCorrect: number;
  rewardGpPerCorrect: number;
  gradeWeight: string | null;
  competencyId: string | null;
  requiresReview: boolean;
  startedAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JiroExpeditionWithDetails extends JiroExpedition {
  questionBank: {
    id: string;
    name: string;
    color: string;
    icon: string;
  } | null;
  deliveryStationsCount: number;
  studentsStarted: number;
  totalQuestions: number;
}

export interface JiroDeliveryStation {
  id: string;
  expeditionId: string;
  name: string;
  description: string | null;
  instructions: string | null;
  orderIndex: number;
  allowedFileTypes: string[];
  maxFileSizeMb: number;
  createdAt: string;
  updatedAt: string;
}

export interface JiroQuestion {
  id: string;
  type: 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'MATCHING';
  questionText: string;
  imageUrl: string | null;
  options: Array<{ text: string; isCorrect: boolean }> | null;
  pairs: Array<{ left: string; right: string }> | null;
  timeLimitSeconds: number | null;
}

export interface JiroQuestionBank {
  id: string;
  name: string;
  color: string;
  icon: string;
  questions: JiroQuestion[];
}

export interface JiroExpeditionFull extends JiroExpedition {
  questionBank: JiroQuestionBank;
  deliveryStations: JiroDeliveryStation[];
}

export interface JiroStudentProgress {
  id: string;
  status: JiroStudentStatus;
  currentEnergy: number;
  correctAnswers: number;
  wrongAnswers: number;
  completedStations: string[];
  earnedXp: number;
  earnedGp: number;
  finalScore: string | null;
}

export interface JiroStation {
  type: 'QUESTION' | 'DELIVERY';
  id: string;
  orderIndex: number;
  question?: JiroQuestion;
  station?: JiroDeliveryStation;
  status: 'PENDING' | 'CORRECT' | 'INCORRECT' | 'APPROVED' | 'REJECTED';
  answeredAt?: string;
  delivery?: JiroDelivery | null;
}

export interface JiroDelivery {
  id: string;
  studentExpeditionId: string;
  deliveryStationId: string;
  fileUrl: string;
  fileName: string;
  fileType: JiroDeliveryFileType;
  fileSizeBytes: number;
  status: JiroDeliveryStatus;
  feedback: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface JiroStudentExpeditionProgress {
  expedition: {
    id: string;
    name: string;
    description: string | null;
    coverImageUrl: string | null;
    mode: JiroExpeditionMode;
    status: JiroExpeditionStatus;
    initialEnergy: number;
    energyRegenMinutes: number;
    energyPurchasePrice: number;
    rewardXpPerCorrect: number;
    rewardGpPerCorrect: number;
    timeRemaining: number | null;
  };
  studentProgress: JiroStudentProgress | null;
  stations: JiroStation[];
  totalStations: number;
}

export interface JiroClassProgress {
  expedition: JiroExpedition;
  totalStations: number;
  progress: Array<{
    student: {
      id: string;
      name: string;
      level: number;
    };
    status: JiroStudentStatus;
    correctAnswers: number;
    wrongAnswers: number;
    completedStations: number;
    totalStations: number;
    currentEnergy: number;
    finalScore: string | null;
    startedAt: string | null;
    completedAt: string | null;
  }>;
}

export interface JiroPendingDelivery extends JiroDelivery {
  station: {
    id: string;
    name: string;
  };
  student: {
    id: string;
    name: string;
  };
}

export interface JiroAnswerResult {
  isCorrect: boolean;
  correctAnswer: any;
  explanation: string | null;
  currentEnergy: number;
}

export interface JiroEnergyStatus {
  currentEnergy: number;
  maxEnergy: number;
  energyPurchasePrice: number;
  energyRegenMinutes: number;
}

export interface JiroBuyEnergyResult {
  newEnergy: number;
  gpSpent: number;
  remainingGp: number;
}

export interface CreateExpeditionData {
  questionBankId: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  mode: JiroExpeditionMode;
  timeLimitMinutes?: number;
  initialEnergy?: number;
  energyRegenMinutes?: number;
  energyPurchasePrice?: number;
  rewardXpPerCorrect?: number;
  rewardGpPerCorrect?: number;
  gradeWeight?: number;
  competencyId?: string;
  competencyIds?: string[];
}

export interface CreateDeliveryStationData {
  name: string;
  description?: string;
  instructions?: string;
  orderIndex?: number;
  allowedFileTypes?: string[];
  maxFileSizeMb?: number;
}

export interface SubmitDeliveryData {
  deliveryStationId: string;
  fileUrl: string;
  fileName: string;
  fileType: JiroDeliveryFileType;
  fileSizeBytes: number;
}

// ==================== API ====================

export const jiroExpeditionApi = {
  // ==================== PROFESOR ====================

  // Crear expedición
  create: async (classroomId: string, data: CreateExpeditionData): Promise<JiroExpedition> => {
    const response = await api.post(`/jiro-expeditions/classroom/${classroomId}`, data);
    return response.data.data;
  },

  // Listar expediciones de una clase
  getByClassroom: async (classroomId: string): Promise<JiroExpeditionWithDetails[]> => {
    const response = await api.get(`/jiro-expeditions/classroom/${classroomId}`);
    return response.data.data;
  },

  // Obtener expedición por ID
  getById: async (expeditionId: string): Promise<JiroExpeditionFull> => {
    const response = await api.get(`/jiro-expeditions/${expeditionId}`);
    return response.data.data;
  },

  // Actualizar expedición
  update: async (expeditionId: string, data: Partial<CreateExpeditionData>): Promise<JiroExpeditionFull> => {
    const response = await api.put(`/jiro-expeditions/${expeditionId}`, data);
    return response.data.data;
  },

  // Eliminar expedición
  delete: async (expeditionId: string): Promise<void> => {
    await api.delete(`/jiro-expeditions/${expeditionId}`);
  },

  // ==================== ESTACIONES DE ENTREGA ====================

  // Crear estación de entrega
  createDeliveryStation: async (expeditionId: string, data: CreateDeliveryStationData): Promise<JiroDeliveryStation> => {
    const response = await api.post(`/jiro-expeditions/${expeditionId}/delivery-stations`, data);
    return response.data.data;
  },

  // Actualizar estación de entrega
  updateDeliveryStation: async (stationId: string, data: Partial<CreateDeliveryStationData>): Promise<JiroDeliveryStation> => {
    const response = await api.put(`/jiro-expeditions/delivery-stations/${stationId}`, data);
    return response.data.data;
  },

  // Eliminar estación de entrega
  deleteDeliveryStation: async (stationId: string): Promise<void> => {
    await api.delete(`/jiro-expeditions/delivery-stations/${stationId}`);
  },

  // ==================== CONTROL ====================

  // Abrir expedición
  open: async (expeditionId: string): Promise<JiroExpeditionFull> => {
    const response = await api.post(`/jiro-expeditions/${expeditionId}/open`);
    return response.data.data;
  },

  // Cerrar expedición
  close: async (expeditionId: string): Promise<JiroExpeditionFull> => {
    const response = await api.post(`/jiro-expeditions/${expeditionId}/close`);
    return response.data.data;
  },

  // ==================== PROGRESO Y REVISIÓN ====================

  // Ver progreso de la clase
  getClassProgress: async (expeditionId: string): Promise<JiroClassProgress> => {
    const response = await api.get(`/jiro-expeditions/${expeditionId}/class-progress`);
    return response.data.data;
  },

  // Ver entregas pendientes
  getPendingDeliveries: async (expeditionId: string): Promise<JiroPendingDelivery[]> => {
    const response = await api.get(`/jiro-expeditions/${expeditionId}/pending-deliveries`);
    return response.data.data;
  },

  // Revisar entrega
  reviewDelivery: async (deliveryId: string, status: 'APPROVED' | 'REJECTED', feedback?: string): Promise<JiroDelivery> => {
    const response = await api.post(`/jiro-expeditions/deliveries/${deliveryId}/review`, {
      status,
      feedback,
    });
    return response.data.data;
  },

  // ==================== ESTUDIANTE ====================

  // Listar expediciones disponibles
  getAvailable: async (studentProfileId: string): Promise<Array<JiroExpedition & {
    questionBank: { id: string; name: string; color: string; icon: string } | null;
    totalStations: number;
    studentProgress: {
      status: JiroStudentStatus;
      completedStations: number;
      currentEnergy: number;
    } | null;
  }>> => {
    const response = await api.get(`/jiro-expeditions/student/${studentProfileId}/available`);
    return response.data.data;
  },

  // Ver mi progreso en una expedición
  getMyProgress: async (expeditionId: string, studentProfileId: string): Promise<JiroStudentExpeditionProgress> => {
    const response = await api.get(`/jiro-expeditions/${expeditionId}/progress/${studentProfileId}`);
    return response.data.data;
  },

  // Iniciar expedición
  start: async (expeditionId: string, studentProfileId: string): Promise<JiroStudentExpeditionProgress> => {
    const response = await api.post(`/jiro-expeditions/${expeditionId}/start/${studentProfileId}`);
    return response.data.data;
  },

  // Responder pregunta
  answer: async (expeditionId: string, studentProfileId: string, questionId: string, answer: any): Promise<JiroAnswerResult> => {
    const response = await api.post(`/jiro-expeditions/${expeditionId}/answer/${studentProfileId}`, {
      questionId,
      answer,
    });
    return response.data.data;
  },

  // Subir entrega
  submitDelivery: async (expeditionId: string, studentProfileId: string, data: SubmitDeliveryData): Promise<{ success: boolean }> => {
    const response = await api.post(`/jiro-expeditions/${expeditionId}/submit-delivery/${studentProfileId}`, data);
    return response.data.data;
  },

  // Comprar energía
  buyEnergy: async (expeditionId: string, studentProfileId: string): Promise<JiroBuyEnergyResult> => {
    const response = await api.post(`/jiro-expeditions/${expeditionId}/buy-energy/${studentProfileId}`);
    return response.data.data;
  },

  // Ver estado de energía
  getEnergyStatus: async (expeditionId: string, studentProfileId: string): Promise<JiroEnergyStatus> => {
    const response = await api.get(`/jiro-expeditions/${expeditionId}/energy-status/${studentProfileId}`);
    return response.data.data;
  },

  // Finalizar examen por timeout
  forceCompleteByTimeout: async (expeditionId: string, studentProfileId: string): Promise<{
    success: boolean;
    message: string;
    finalScore?: string;
    earnedXp?: number;
    earnedGp?: number;
  }> => {
    const response = await api.post(`/jiro-expeditions/${expeditionId}/timeout/${studentProfileId}`);
    return response.data.data;
  },

  // Obtener respuestas de un estudiante (para profesor)
  getStudentAnswers: async (expeditionId: string, studentProfileId: string): Promise<{
    id: string;
    questionText: string;
    questionType: string;
    givenAnswer: any;
    correctAnswer: any;
    isCorrect: boolean;
    explanation: string | null;
    answeredAt: string;
  }[]> => {
    const response = await api.get(`/jiro-expeditions/${expeditionId}/answers/${studentProfileId}`);
    return response.data.data;
  },

  // Obtener entregas de un estudiante (para profesor)
  getStudentDeliveries: async (expeditionId: string, studentProfileId: string): Promise<{
    id: string;
    stationName: string;
    stationDescription: string | null;
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSizeBytes: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    feedback: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
  }[]> => {
    const response = await api.get(`/jiro-expeditions/${expeditionId}/deliveries/${studentProfileId}`);
    return response.data.data;
  },

  // Subir archivo de entrega
  uploadDeliveryFile: async (file: File): Promise<{ url: string; filename: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/jiro-expeditions/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },
};

export default jiroExpeditionApi;
