import api from './api';

export interface StudentMatch {
  name: string;
  status: 'FOUND' | 'MULTIPLE' | 'NOT_FOUND';
  matches?: { id: string; fullName: string }[];
  selectedId?: string;
  selectedName?: string;
}

export interface BehaviorMatch {
  id: string;
  name: string;
  isPositive: boolean;
  xpValue: number;
  hpValue: number;
  gpValue: number;
  icon: string;
  confidence: number;
}

export interface BadgeMatch {
  id: string;
  name: string;
  icon: string;
  confidence: number;
}

export interface AIInterpretation {
  actions: Array<'APPLY_BEHAVIOR' | 'AWARD_BADGE'>;
  behavior?: BehaviorMatch;
  badge?: BadgeMatch;
  students: StudentMatch[];
  clarificationNeeded?: string;
}

export interface AIAssistantResponse {
  success: boolean;
  interpretation: AIInterpretation;
}

export interface ExecuteActionResponse {
  success: boolean;
  message: string;
  results?: any;
}

export const aiAssistantApi = {
  processCommand: async (classroomId: string, command: string): Promise<AIAssistantResponse> => {
    const response = await api.post(`/classrooms/${classroomId}/ai-assistant`, { command });
    return response.data;
  },

  executeAction: async (
    classroomId: string,
    action: 'APPLY_BEHAVIOR' | 'AWARD_BADGE',
    targetId: string,
    studentIds: string[]
  ): Promise<ExecuteActionResponse> => {
    const response = await api.post(`/classrooms/${classroomId}/ai-assistant/execute`, {
      action,
      targetId,
      studentIds,
    });
    return response.data;
  },
};
