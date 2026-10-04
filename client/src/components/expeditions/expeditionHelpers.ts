import { BookOpen, Camera, CircleHelp, School, type LucideIcon } from 'lucide-react';
import { CONSTELLATIONS, constellationById, type Constellation } from '../observatorio/descanso/constellations';
import type { ExpeditionResource, StopKind, StopState, TeacherExpedition } from '../../lib/expeditionApi';

export const MAX_STOPS = 10;
export const MAX_QUESTIONS = 20;
export const MAX_REWARD = 500;

export const KIND_INFO: Record<StopKind, { label: string; emoji: string; icon: LucideIcon; hint: string; action: string }> = {
  STORY: { label: 'Relato', emoji: '📖', icon: BookOpen, hint: 'Jiro cuenta algo; el alumno lo lee y sigue.', action: 'Lee el relato' },
  CHALLENGE: { label: 'Reto', emoji: '❓', icon: CircleHelp, hint: 'Preguntas de tu banco, con explicación al instante y un reintento.', action: 'Haz el reto' },
  EVIDENCE: { label: 'Evidencia', emoji: '📤', icon: Camera, hint: 'Una foto, un archivo o un texto corto que tú revisas.', action: 'Entrega tu evidencia' },
  CLASS: { label: 'En clase', emoji: '🏫', icon: School, hint: 'Algo que hacen juntos en el aula; tú marcas a los presentes.', action: 'En clase con tu profe' },
};

export const KIND_ORDER: StopKind[] = ['STORY', 'CHALLENGE', 'EVIDENCE', 'CLASS'];

/** Lo que ve el alumno de cada estado (siempre con texto, nunca solo color). */
export const STATE_INFO: Record<StopState, { label: string; tone: 'locked' | 'open' | 'wait' | 'fix' | 'done' }> = {
  LOCKED: { label: 'Bloqueada', tone: 'locked' },
  AVAILABLE: { label: 'Tu turno', tone: 'open' },
  STARTED: { label: 'En curso', tone: 'open' },
  WAITING: { label: 'Esperando a tu profe', tone: 'wait' },
  NEEDS_WORK: { label: 'Tu profe te pide mejorar', tone: 'fix' },
  DONE: { label: 'Lograda', tone: 'done' },
};

export const rewardLabel = (xp: number, gold: number) =>
  [xp > 0 ? `+${xp} XP` : '', gold > 0 ? `+${gold} de oro` : ''].filter(Boolean).join(' · ') || 'Sin recompensa';

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const dateFormat = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const dueLabel = (iso: string | null) => (iso ? `Vence el ${dateFormat.format(new Date(iso))}` : null);
export const isOverdue = (iso: string | null) => !!iso && new Date(iso).getTime() < Date.now();

/** ISO ↔ valor de <input type="datetime-local"> (hora local). */
export const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
export const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

// ── Constelaciones ──

/** Las que alcanzan para N paradas (de menor a mayor). */
export const constellationsFor = (count: number) =>
  [...CONSTELLATIONS].filter((c) => c.stars.length >= Math.max(1, count)).sort((a, b) => a.stars.length - b.stars.length);

/** La constelación de la expedición; si no alcanza (paradas recién agregadas), la más chica en la que caben. */
export const stageConstellation = (id: string | null, count: number): Constellation =>
  (() => {
    const chosen = constellationById(id);
    if (chosen && chosen.stars.length >= count) return chosen;
    return constellationsFor(count)[0] ?? CONSTELLATIONS[CONSTELLATIONS.length - 1];
  })();

// ── Recursos ──

const GENIALLY = /^https:\/\/(?:[a-z0-9-]+\.)*genial\.ly\//i;
export const resourceLabel = (resource: ExpeditionResource) =>
  resource.name || (resource.kind === 'FILE' ? 'Archivo' : GENIALLY.test(resource.url) ? 'Genially' : resource.url.replace(/^https:\/\//, '').slice(0, 40));
export const isImageFile = (url: string) => /\.(png|jpe?g|gif|webp)$/i.test(url);

// ── Antes de publicar (mismas reglas que el servidor) ──

export const publishIssues = (expedition: TeacherExpedition): string[] => {
  const issues: string[] = [];
  if (expedition.stops.length === 0) issues.push('Agrega al menos una parada');
  if (expedition.stops.length > MAX_STOPS) issues.push(`Una expedición tiene hasta ${MAX_STOPS} paradas`);
  if (expedition.scenario === 'MAP' && !expedition.mapImageUrl) issues.push('Elige un mapa de la biblioteca');
  expedition.stops.forEach((stop, index) => {
    const label = `Parada ${index + 1} («${stop.title}»)`;
    if (stop.kind === 'STORY' && !stop.story?.trim() && stop.resources.length === 0) issues.push(`${label}: escribe el relato`);
    if (stop.kind === 'CHALLENGE' && (!stop.bankId || stop.questionIds.length === 0)) issues.push(`${label}: elige las preguntas`);
    if (stop.kind === 'EVIDENCE' && !stop.mission?.trim()) issues.push(`${label}: di qué deben entregar`);
    if (stop.kind === 'CLASS' && !stop.mission?.trim()) issues.push(`${label}: di qué harán en clase`);
  });
  return issues;
};

// ── Fotos del celular: se achican antes de subir (el límite es 5 MB) ──

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const compressImage = async (file: File): Promise<File> => {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= 1.2 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
};
