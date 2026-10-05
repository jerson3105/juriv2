import type { DocumentType, RevealReason, StudentDetail } from '../../../lib/schoolRosterApi';
import { localDay } from '../schoolHelpers';

export const DOCUMENT_TYPES: { id: DocumentType; label: string }[] = [
  { id: 'DNI', label: 'DNI' },
  { id: 'CE', label: 'Carné de extranjería' },
  { id: 'PTP', label: 'PTP / CPP' },
  { id: 'PASAPORTE', label: 'Pasaporte' },
];

export const REVEAL_REASONS: { id: RevealReason; label: string }[] = [
  { id: 'SIAGIE', label: 'Trámite en el SIAGIE' },
  { id: 'IDENTITY', label: 'Verificar su identidad' },
  { id: 'CORRECTION', label: 'Corregir un dato' },
  { id: 'FAMILY', label: 'Pedido de la familia' },
  { id: 'OTHER', label: 'Otro motivo' },
];

/** Segundos que el documento queda a la vista tras «Mostrar». */
export const REVEAL_SECONDS = 30;

/** «•••••678» (o nada si no hay documento). */
export const maskedDocument = (hint: string | null) => (hint ? `•••••${hint}` : null);

/** Edad cumplida a hoy (fecha AAAA-MM-DD, sin zona horaria). */
export const ageOf = (birthDate: string | null, today = localDay()) => {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
};

/** «14/03/2012» */
export const formatBirthDate = (birthDate: string) => birthDate.split('-').reverse().join('/');

/** «Alanoca Quispe, Luz Clara» */
export const rosterName = (s: { firstNames: string; lastNames: string }) => `${s.lastNames}, ${s.firstNames}`;

/** Iniciales para el círculo: primer nombre y primer apellido. */
export const initialsOf = (s: { firstNames: string; lastNames: string }) =>
  `${s.firstNames.trim()[0] ?? ''}${s.lastNames.trim()[0] ?? ''}`.toUpperCase();

const FIELD_LABEL: Record<string, string> = {
  firstNames: 'nombres', lastNames: 'apellidos', document: 'documento', birthDate: 'fecha de nacimiento',
  email: 'correo', siagieCode: 'código SIAGIE',
};

/** Título y detalle de un movimiento de la ficha. */
export const describeEvent = (event: StudentDetail['events'][number]) => {
  const meta = event.metadata ?? {};
  switch (event.type) {
    case 'ENROLLED':
      return { title: event.to ? `Alta en el padrón, en ${event.to}` : 'Alta en el padrón', detail: meta.manual ? 'Agregado a mano' : meta.importId ? 'Importado desde Excel' : null };
    case 'BUILT_FROM_CLASSES':
      return { title: 'Alta en el padrón desde las clases', detail: typeof meta.profiles === 'number' ? `Se unieron ${meta.profiles} ${meta.profiles === 1 ? 'perfil' : 'perfiles'}` : null };
    case 'DATA_UPDATED': {
      const fields = String(meta.fields ?? '').split(',').filter(Boolean).map((f) => FIELD_LABEL[f] ?? f);
      const changed = fields.length ? `Cambió: ${fields.join(', ')}` : null;
      return { title: 'Datos actualizados', detail: meta.importId ? [changed, 'desde Excel'].filter(Boolean).join(' · ') : changed };
    }
    case 'SECTION_CHANGED':
      return { title: event.from ? `Cambio de ${event.from} a ${event.to ?? 'sin sección'}` : `Sección asignada: ${event.to ?? '—'}`, detail: meta.importId ? 'Desde una importación de Excel' : null };
    case 'WITHDRAWN':
      return { title: 'Retiro', detail: null };
    case 'REINSTATED':
      return { title: 'Reincorporación', detail: null };
    default:
      return { title: 'Movimiento', detail: null };
  }
};

const dateTime = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const formatWhen = (iso: string) => dateTime.format(new Date(iso)).replace('.', '');

const time = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' });

/** «hoy a las 16:05», «mañana a las 16:05» o «12 oct a las 16:05» (hasta cuándo se puede deshacer). */
export const whenLabel = (iso: string) => {
  const date = new Date(iso);
  const at = time.format(date);
  if (localDay(date) === localDay()) return `hoy a las ${at}`;
  if (localDay(date) === localDay(new Date(Date.now() + 86_400_000))) return `mañana a las ${at}`;
  return `${day.format(date).replace('.', '')} a las ${at}`;
};
