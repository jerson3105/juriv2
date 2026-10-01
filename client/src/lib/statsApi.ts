import api from './api';
import type { PerformanceBucket } from './gradeApi';

export type StatsPeriod = 'week' | 'bimester' | 'month' | 'all';
export type AttentionKind = 'LOW_HP' | 'INACTIVE' | 'ABSENCES' | 'NEGATIVE' | 'GRADE_C';

export interface CompetencyDistribution {
  id: string;
  code: string;
  title: string;
  counts: Record<PerformanceBucket, number>;
  missing: number;
}

export interface ClassStatsOverview {
  period: { kind: StatsPeriod; label: string; from: string; to: string };
  studentCount: number;
  attention: Array<{
    studentProfileId: string;
    studentName: string;
    characterName: string | null;
    reasons: Array<{ kind: AttentionKind; label: string }>;
  }>;
  climate: {
    bucket: 'day' | 'week';
    series: Array<{ date: string; positive: number; negative: number }>;
    current: { positive: number; negative: number };
    previous: { positive: number; negative: number } | null;
    topPositive: Array<{ name: string; icon: string | null; events: number }>;
    topNegative: Array<{ name: string; icon: string | null; events: number }>;
  };
  badges: { studentsWithBadge: number; awardedInPeriod: number };
  gamification: {
    levels: Array<{ level: number; total: number }>;
    classes: Array<{ key: string; total: number }>;
    gpTotal: number;
    shopPrices: { min: number; median: number; max: number; items: number } | null;
    withoutRecognition: number;
  };
  grades: { period: string; competencies: CompetencyDistribution[] } | null;
}

export const statsApi = {
  getOverview: async (classroomId: string, period: StatsPeriod): Promise<ClassStatsOverview> => {
    const response = await api.get(`/stats/classroom/${classroomId}/overview`, {
      params: { period, tz: new Date().getTimezoneOffset() },
    });
    return response.data.data;
  },
};
