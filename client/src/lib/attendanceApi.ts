import { api } from './api';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface AttendanceRecord {
  id: string;
  studentProfileId: string;
  status: AttendanceStatus;
  notes?: string;
  xpAwarded: number;
  date: string;
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
  totalXpEarned?: number;
  daysRecorded?: number;
}

export interface BulkAttendanceData {
  studentProfileId: string;
  status: AttendanceStatus;
  notes?: string;
}

export const attendanceApi = {
  // Registrar asistencia individual
  async recordAttendance(
    classroomId: string,
    studentProfileId: string,
    date: string,
    status: AttendanceStatus,
    notes?: string,
    xpAwarded: number = 0
  ): Promise<AttendanceRecord> {
    const response = await api.post(`/attendance/classroom/${classroomId}`, {
      studentProfileId,
      date,
      status,
      notes,
      xpAwarded,
    });
    return response.data.data;
  },

  // Registrar asistencia masiva
  async recordBulkAttendance(
    classroomId: string,
    date: string,
    attendanceData: BulkAttendanceData[],
    xpForPresent: number = 5
  ): Promise<AttendanceRecord[]> {
    const response = await api.post(`/attendance/classroom/${classroomId}/bulk`, {
      date,
      attendanceData,
      xpForPresent,
    });
    return response.data.data;
  },

  // Obtener asistencia por fecha
  async getAttendanceByDate(classroomId: string, date: string): Promise<AttendanceRecord[]> {
    const response = await api.get(`/attendance/classroom/${classroomId}?date=${date}`);
    return response.data.data;
  },

  // Obtener estadísticas de la clase
  async getClassroomStats(
    classroomId: string,
    startDate?: string,
    endDate?: string
  ): Promise<AttendanceStats> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await api.get(`/attendance/classroom/${classroomId}/stats?${params.toString()}`);
    return response.data.data;
  },

  // Obtener historial de un estudiante
  async getStudentHistory(studentProfileId: string, limit?: number): Promise<AttendanceRecord[]> {
    const params = limit ? `?limit=${limit}` : '';
    const response = await api.get(`/attendance/student/${studentProfileId}/history${params}`);
    return response.data.data;
  },

  // Obtener estadísticas de un estudiante
  async getStudentStats(studentProfileId: string): Promise<AttendanceStats> {
    const response = await api.get(`/attendance/student/${studentProfileId}/stats`);
    return response.data.data;
  },
};
