import type { MySchool } from '../../lib/schoolApi';

export const mySchoolsKey = ['my-schools'] as const;
export const schoolDetailKey = (id: string) => ['school-detail', id] as const;
export const schoolTeachersKey = (id: string) => ['school-teachers', id] as const;
export const pendingRequestsKey = (id: string) => ['pending-requests', id] as const;
export const schoolBehaviorsKey = (id: string) => ['school-behaviors', id] as const;
export const schoolBadgesKey = (id: string) => ['school-badges', id] as const;

// Ver la escuela: miembro verificado o el responsable que la registró y espera verificación.
export const canViewSchool = (s: MySchool) => s.memberStatus === 'VERIFIED' || (s.memberRole === 'OWNER' && s.memberStatus === 'PENDING_ADMIN');
// Gestionarla (consola, reportes, solicitudes, biblioteca, invitar, retirar): responsable o administración, verificados.
export const canManageSchool = (s: MySchool) => (s.memberRole === 'OWNER' || s.memberRole === 'ADMIN') && s.memberStatus === 'VERIFIED';

// Fecha local YYYY-MM-DD (no UTC: por la noche toISOString daría el día siguiente).
export const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type PeriodPreset = 'month' | 'quarter' | 'year' | 'custom';

export const PERIOD_PRESETS: { id: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
  { id: 'month', label: 'Este mes' },
  { id: 'quarter', label: 'Últimos 3 meses' },
  { id: 'year', label: 'Este año' },
];

export const presetRange = (preset: Exclude<PeriodPreset, 'custom'>, now = new Date()) => {
  const end = localDay(now);
  if (preset === 'month') return { start: localDay(new Date(now.getFullYear(), now.getMonth(), 1)), end };
  if (preset === 'year') return { start: localDay(new Date(now.getFullYear(), 0, 1)), end };
  const from = new Date(now);
  from.setMonth(from.getMonth() - 3);
  return { start: localDay(from), end };
};

export const formatDay = (day: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(`${day}T00:00:00`).toLocaleDateString('es', opts);

// CSV para Excel en español: separador ";" y BOM para que respete tildes.
export const downloadCsv = (filename: string, rows: (string | number | null | undefined)[][]) => {
  const escape = (v: string | number | null | undefined) => {
    const text = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = '﻿' + rows.map((r) => r.map(escape).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const slug = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const inviteLink = (code: string) => `${window.location.origin}/schools?invite=${code}`;

// Clases sin actividad en este número de días aparecen en "Por atender".
export const IDLE_DAYS = 14;

export const isIdle = (lastActivityAt: string | null, studentCount: number, now = Date.now()) =>
  studentCount > 0 && (!lastActivityAt || now - new Date(lastActivityAt).getTime() > IDLE_DAYS * 86400000);

export const MEMBER_STATUS_LABEL: Record<MySchool['memberStatus'], string> = {
  VERIFIED: 'Verificado',
  PENDING_ADMIN: 'Pendiente de verificación',
  PENDING_OWNER: 'Esperando aprobación',
  REJECTED: 'Rechazado',
};
