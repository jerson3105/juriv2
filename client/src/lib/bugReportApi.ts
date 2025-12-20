import { api } from './api';

export type BugReportCategory = 'UI' | 'FUNCTIONALITY' | 'PERFORMANCE' | 'DATA' | 'OTHER';
export type BugReportPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BugReportStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface BugReport {
  id: string;
  title: string;
  description: string;
  category: BugReportCategory;
  priority: BugReportPriority;
  status: BugReportStatus;
  currentUrl?: string;
  browserInfo?: string;
  screenshotUrl?: string;
  adminNotes?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface BugReportStats {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  criticalPending: number;
}

export interface CreateBugReportData {
  title: string;
  description: string;
  category?: BugReportCategory;
  priority?: BugReportPriority;
  currentUrl?: string;
  browserInfo?: string;
  screenshotUrl?: string;
}

export const bugReportApi = {
  // Crear nuevo reporte (profesores)
  async createReport(data: CreateBugReportData): Promise<BugReport> {
    const response = await api.post('/bug-reports', data);
    return response.data.data;
  },

  // Obtener mis reportes (profesores)
  async getMyReports(): Promise<BugReport[]> {
    const response = await api.get('/bug-reports/my-reports');
    return response.data.data;
  },

  // Obtener todos los reportes (admin)
  async getAllReports(filters?: {
    status?: BugReportStatus;
    priority?: BugReportPriority;
    category?: BugReportCategory;
    page?: number;
    limit?: number;
  }): Promise<{ reports: BugReport[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/bug-reports?${params.toString()}`);
    return {
      reports: response.data.data,
      pagination: response.data.pagination,
    };
  },

  // Obtener reporte por ID (admin)
  async getReportById(reportId: string): Promise<BugReport> {
    const response = await api.get(`/bug-reports/${reportId}`);
    return response.data.data;
  },

  // Obtener estadísticas (admin)
  async getStats(): Promise<BugReportStats> {
    const response = await api.get('/bug-reports/stats');
    return response.data.data;
  },

  // Actualizar estado (admin)
  async updateStatus(reportId: string, status: BugReportStatus): Promise<BugReport> {
    const response = await api.patch(`/bug-reports/${reportId}/status`, { status });
    return response.data.data;
  },

  // Actualizar notas (admin)
  async updateNotes(reportId: string, notes: string): Promise<BugReport> {
    const response = await api.patch(`/bug-reports/${reportId}/notes`, { notes });
    return response.data.data;
  },

  // Utilidad: obtener info del navegador
  getBrowserInfo(): string {
    const ua = navigator.userAgent;
    const browserInfo = {
      userAgent: ua,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    };
    return JSON.stringify(browserInfo);
  },
};

// Constantes para UI
export const CATEGORY_LABELS: Record<BugReportCategory, string> = {
  UI: 'Interfaz de Usuario',
  FUNCTIONALITY: 'Funcionalidad',
  PERFORMANCE: 'Rendimiento',
  DATA: 'Datos',
  OTHER: 'Otro',
};

export const PRIORITY_LABELS: Record<BugReportPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const STATUS_LABELS: Record<BugReportStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En Progreso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
};

export const PRIORITY_COLORS: Record<BugReportPriority, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export const STATUS_COLORS: Record<BugReportStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-700',
};
