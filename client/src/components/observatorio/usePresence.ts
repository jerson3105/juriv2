import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi, type AttendanceRecord } from '../../lib/attendanceApi';
import type { Student } from '../../lib/classroomApi';

export const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Ajustes del docente sobre la lista del día (id → presente). Duran la sesión del navegador.
const overridesKey = (classroomId: string, day: string) => `juried:obs-presence:${classroomId}:${day}`;
const readOverrides = (key: string): Record<string, boolean> => {
  try {
    return JSON.parse(sessionStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
};
const writeOverrides = (key: string, value: Record<string, boolean>) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento: el ajuste vale mientras la pantalla siga abierta.
  }
};

/**
 * Presentes de hoy: la asistencia si ya se pasó lista; si no, una lista rápida con todos
 * presentes que el docente desmarca. Comparte caché con la Lista y las Herramientas.
 */
export const useTodayPresence = (classroomId: string, students: Pick<Student, 'id'>[]) => {
  const today = localToday();
  const key = overridesKey(classroomId, today);
  const { data: attendance = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-today', classroomId, today],
    queryFn: () => attendanceApi.getAttendanceByDate(classroomId, today),
    enabled: !!classroomId,
  });
  const [overrides, setOverrides] = useState<Record<string, boolean>>(() => readOverrides(key));
  const fromAttendance = attendance.length > 0;

  const attended = useMemo(
    () => new Set(attendance.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').map((r) => r.studentProfileId)),
    [attendance],
  );
  const presentIds = useMemo(
    () => new Set(students.filter((s) => overrides[s.id] ?? (fromAttendance ? attended.has(s.id) : true)).map((s) => s.id)),
    [students, overrides, fromAttendance, attended],
  );

  // Se guarda al cambiar (no en el toque): dos toques seguidos no se pisan.
  useEffect(() => {
    writeOverrides(key, overrides);
  }, [key, overrides]);

  const toggle = useCallback((id: string) => {
    setOverrides((prev) => ({ ...prev, [id]: !(prev[id] ?? (fromAttendance ? attended.has(id) : true)) }));
  }, [fromAttendance, attended]);

  const setAll = useCallback((present: boolean) => {
    setOverrides(Object.fromEntries(students.map((s) => [s.id, present])));
  }, [students]);

  return { presentIds, fromAttendance, isLoading, toggle, setAll };
};
