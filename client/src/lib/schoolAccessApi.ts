import api from './api';
import type { SchoolLevel } from './schoolYearApi';

/**
 * Consola escolar: acceso de los estudiantes con DNI y PIN. El código del colegio (y su póster con QR), las tarjetas de
 * un solo uso para quien aún no tiene PIN y «Restablecer PIN» (administración o tutor de su sección).
 */

/** 'pin': entra con su PIN · 'account': con correo o Google, aún sin PIN · 'none': aún sin cuenta (necesita tarjeta). */
export type AccessState = 'pin' | 'account' | 'none';

export interface StudentAccessInfo {
  state: AccessState;
  lastLoginAt: string | null;
  /** Tiene una tarjeta sin usar. */
  hasCard: boolean;
}

export interface AccessCounts {
  students: number;
  pin: number;
  account: number;
  none: number;
  withoutDocument: number;
  cards: number;
}

export interface AccessOverview {
  school: { name: string; studentCode: string | null };
  /** El servidor tiene las llaves para leer los DNI: sin ellas la puerta del colegio no funciona. */
  piiReady: boolean;
  totals: AccessCounts;
  sections: Array<AccessCounts & { id: string; level: SchoolLevel; grade: number; name: string; label: string }>;
}

export const schoolAccessKeys = {
  overview: (schoolId: string, yearId: string) => ['school-access', schoolId, yearId] as const,
};

const year = (schoolId: string, yearId: string) => `/schools/${schoolId}/years/${yearId}`;
const slug = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'tarjetas';

const savePdf = (data: BlobPart, filename: string) => {
  const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Una descarga que falla trae su mensaje JSON dentro de un Blob: se lee para mostrarlo.
const withBlobMessage = async (download: () => Promise<void>) => {
  try {
    await download();
  } catch (error) {
    const data = (error as { response?: { data?: unknown } })?.response?.data;
    if (data instanceof Blob) {
      const message = await data.text().then((text) => (JSON.parse(text) as { message?: string }).message).catch(() => undefined);
      if (message) throw new Error(message);
    }
    throw error;
  }
};

export const schoolAccessApi = {
  overview: async (schoolId: string, yearId: string): Promise<AccessOverview> =>
    (await api.get(`${year(schoolId, yearId)}/access`)).data.data,
  /** Activa el acceso con DNI o cambia el código (los pósters anteriores dejan de servir). */
  setCode: async (schoolId: string): Promise<{ studentCode: string }> =>
    (await api.post(`/schools/${schoolId}/access/code`)).data.data,
  downloadPoster: (schoolId: string, code: string) => withBlobMessage(async () => {
    const response = await api.get(`/schools/${schoolId}/access/poster`, { responseType: 'blob' });
    savePdf(response.data, `poster-colegio-${code}.pdf`);
  }),
  /** Tarjetas de una sección (solo para quienes aún no tienen PIN). */
  downloadSectionCards: (schoolId: string, yearId: string, sectionId: string, label: string) => withBlobMessage(async () => {
    const response = await api.post(`${year(schoolId, yearId)}/sections/${sectionId}/access-cards`, undefined, { responseType: 'blob' });
    savePdf(response.data, `tarjetas-${slug(label)}.pdf`);
  }),
  downloadStudentCard: (schoolId: string, yearId: string, studentId: string, name: string) => withBlobMessage(async () => {
    const response = await api.post(`${year(schoolId, yearId)}/students/${studentId}/access-card`, undefined, { responseType: 'blob' });
    savePdf(response.data, `tarjeta-${slug(name)}.pdf`);
  }),
  /** Borra su PIN, cierra sus sesiones y le deja una tarjeta nueva (se imprime aparte). */
  resetPin: async (schoolId: string, yearId: string, studentId: string): Promise<{ hadPin: boolean }> =>
    (await api.post(`${year(schoolId, yearId)}/students/${studentId}/access/reset`)).data.data,
};

/** «Entra con su PIN», «Con su correo o Google», «Aún sin acceso» (+ si tiene tarjeta por usar). */
export const accessLabel = (access: StudentAccessInfo) => {
  if (access.state === 'pin') return 'Entra con su PIN';
  if (access.state === 'account') return access.hasCard ? 'Tarjeta lista: aún no crea su PIN' : 'Entra con su correo o Google';
  return access.hasCard ? 'Tarjeta lista: aún no la usa' : 'Aún sin acceso: necesita su tarjeta';
};
