import { api } from './api';

// Expedición unificada (2026-10-03): paradas en lista (relato, reto del banco, evidencia y en clase) sobre una
// constelación de Jiro o un mapa de la biblioteca. El alumno sale siempre de la sesión: nunca va en la URL.

export type ExpeditionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ExpeditionScenario = 'CONSTELLATION' | 'MAP';
export type StopKind = 'STORY' | 'CHALLENGE' | 'EVIDENCE' | 'CLASS';
export type StopState = 'LOCKED' | 'AVAILABLE' | 'STARTED' | 'WAITING' | 'NEEDS_WORK' | 'DONE';
export type ReviewMode = 'ADVANCE' | 'WAIT';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'NEEDS_WORK';

export interface ExpeditionResource {
  kind: 'FILE' | 'LINK';
  url: string;
  name: string | null;
}

interface ExpeditionBase {
  id: string;
  classroomId: string;
  name: string;
  description: string | null;
  scenario: ExpeditionScenario;
  constellationId: string | null;
  mapImageUrl: string | null;
  groupMode: 'INDIVIDUAL' | 'CLAN';
  closingText: string | null;
  finishXp: number;
  finishGold: number;
  status: ExpeditionStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StopStats {
  started: number;
  waiting: number;
  pending: number;
  needsWork: number;
  done: number;
}

export interface TeacherStop {
  id: string;
  sortOrder: number;
  kind: StopKind;
  title: string;
  story: string | null;
  goal: string | null;
  successCriteria: string | null;
  mission: string | null;
  resources: ExpeditionResource[];
  bankId: string | null;
  questionIds: string[];
  passPercent: number;
  reviewMode: ReviewMode;
  dueAt: string | null;
  rewardXp: number;
  rewardGold: number;
  mapX: number | null;
  mapY: number | null;
  stats: StopStats;
}

export interface TeacherExpedition extends ExpeditionBase {
  stops: TeacherStop[];
}

export interface TeacherExpeditionSummary extends ExpeditionBase {
  stopsCount: number;
  studentsCount: number;
  startedCount: number;
  finishedCount: number;
  pendingReviews: number;
}

export interface BoardStudent {
  id: string;
  name: string;
  characterName: string | null;
  hasAccount: boolean;
  doneCount: number;
  finished: boolean;
  current: { stopId: string; state: StopState } | null;
  states: { stopId: string; state: StopState; review: ReviewStatus | null; firstScore: number | null; goldStar: boolean }[];
}

export interface ExpeditionBoard {
  stops: { id: string; sortOrder: number; kind: StopKind; title: string; here: number }[];
  students: BoardStudent[];
}

export interface ReviewItem {
  progressId: string;
  stopId: string;
  stopTitle: string;
  stopNumber: number;
  reviewMode: ReviewMode;
  rewardXp: number;
  rewardGold: number;
  review: ReviewStatus;
  feedback: string | null;
  reviewedAt: string | null;
  student: { id: string; name: string; characterName: string | null };
  evidence: { files: string[]; note: string | null; submittedAt: string } | null;
}

export interface ReviewQueue {
  expeditionId: string;
  stopCount: number;
  pending: ReviewItem[];
  needsWork: ReviewItem[];
}

export interface ReviewDecision {
  progressId: string;
  decision: 'APPROVE' | 'NEEDS_WORK';
  feedback?: string | null;
}

export interface StopPatch {
  kind?: StopKind;
  title?: string;
  story?: string | null;
  goal?: string | null;
  successCriteria?: string | null;
  mission?: string | null;
  resources?: ExpeditionResource[];
  bankId?: string | null;
  questionIds?: string[];
  passPercent?: number;
  reviewMode?: ReviewMode;
  dueAt?: string | null;
  rewardXp?: number;
  rewardGold?: number;
  mapX?: number;
  mapY?: number;
}

export interface ExpeditionPatch {
  name?: string;
  description?: string | null;
  closingText?: string | null;
  finishXp?: number;
  finishGold?: number;
  scenario?: ExpeditionScenario;
  constellationId?: string;
  mapImageUrl?: string | null;
}

// ── Alumno ──

export interface StudentEvidence {
  files: string[];
  note: string | null;
  submittedAt: string;
}

export interface StudentStop {
  id: string;
  sortOrder: number;
  kind: StopKind;
  title: string;
  /** null mientras la parada está bloqueada: el contenido se ve al llegar. */
  story: string | null;
  goal: string | null;
  successCriteria: string | null;
  mission: string | null;
  resources: ExpeditionResource[];
  dueAt: string | null;
  rewardXp: number;
  rewardGold: number;
  passPercent: number;
  reviewMode: ReviewMode;
  questionCount: number;
  mapX: number | null;
  mapY: number | null;
  state: StopState;
  review: ReviewStatus | null;
  feedback: string | null;
  firstScore: number | null;
  finalScore: number | null;
  goldStar: boolean;
  evidence: StudentEvidence | null;
}

export interface StudentExpedition {
  id: string;
  classroomId: string;
  name: string;
  description: string | null;
  scenario: ExpeditionScenario;
  constellationId: string | null;
  mapImageUrl: string | null;
  status: ExpeditionStatus;
  finishXp: number;
  finishGold: number;
  closingText: string | null;
  finishedAt: string | null;
  finished: boolean;
  currentStopId: string | null;
  stops: StudentStop[];
}

export interface StudentExpeditionSummary {
  id: string;
  name: string;
  description: string | null;
  scenario: ExpeditionScenario;
  constellationId: string | null;
  mapImageUrl: string | null;
  status: ExpeditionStatus;
  publishedAt: string | null;
  stopsCount: number;
  doneCount: number;
  finished: boolean;
  current: { id: string; title: string; kind: StopKind; state: StopState; dueAt: string | null } | null;
  /** Una evidencia que su profe le pidió mejorar (aunque ya haya seguido avanzando). */
  needsWork: { id: string; title: string } | null;
  /** ¿Puede hacer algo ahora? (no cuenta lo que espera al docente ni las paradas en clase). */
  actionable: boolean;
}

export type QuestionType = 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'MATCHING';
export type ChallengeAnswer = boolean | number | number[];

export interface ChallengeQuestion {
  id: string;
  type: QuestionType;
  text: string;
  imageUrl: string | null;
  options?: { key: number; text: string }[];
  left?: { key: number; text: string }[];
  right?: { key: number; text: string }[];
}

export interface ChallengeState {
  status: 'STARTED' | 'WAITING' | 'DONE';
  attempt: number;
  passPercent: number;
  firstScore: number | null;
  finalScore: number | null;
  goldStar: boolean;
  questions: ChallengeQuestion[];
  /** Las preguntas de la vuelta actual (1 = todas; 2 = las falladas). */
  round: string[];
  answers: { questionId: string; attempt: number; isCorrect: boolean; explanation: string | null; correctAnswer: ChallengeAnswer | null }[];
}

export interface AnswerResult {
  isCorrect: boolean;
  explanation: string | null;
  /** Solo en el reintento: en la primera vuelta se muestra la explicación. */
  correctAnswer: ChallengeAnswer | null;
  roundComplete: boolean;
  attempt: number;
  score: number | null;
  passed: boolean;
  done: boolean;
  goldStar: boolean;
  retry: string[];
}

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');

/** URL de un archivo propio (/api/uploads/...) o externa. */
export const assetUrl = (url: string | null | undefined) => (!url ? '' : /^https?:\/\//.test(url) ? url : `${API_ORIGIN}${url}`);

export const expeditionKeys = {
  list: (classroomId: string) => ['expeditions', classroomId] as const,
  detail: (expeditionId: string) => ['expedition', expeditionId] as const,
  board: (expeditionId: string) => ['expedition-board', expeditionId] as const,
  review: (expeditionId: string) => ['expedition-review', expeditionId] as const,
  mine: (classroomId: string) => ['my-expeditions', classroomId] as const,
  play: (expeditionId: string) => ['expedition-play', expeditionId] as const,
  challenge: (stopId: string) => ['expedition-challenge', stopId] as const,
};

export const expeditionApi = {
  // Docente
  list: async (classroomId: string): Promise<TeacherExpeditionSummary[]> =>
    (await api.get(`/expeditions/classroom/${classroomId}`)).data.data,
  create: async (input: { classroomId: string; name: string; description?: string | null; scenario?: ExpeditionScenario; mapImageUrl?: string | null }): Promise<TeacherExpedition> =>
    (await api.post('/expeditions', input)).data.data,
  get: async (expeditionId: string): Promise<TeacherExpedition> =>
    (await api.get(`/expeditions/${expeditionId}`)).data.data,
  update: async (expeditionId: string, patch: ExpeditionPatch): Promise<TeacherExpedition> =>
    (await api.patch(`/expeditions/${expeditionId}`, patch)).data.data,
  publish: async (expeditionId: string): Promise<TeacherExpedition> =>
    (await api.post(`/expeditions/${expeditionId}/publish`)).data.data,
  close: async (expeditionId: string): Promise<TeacherExpedition> =>
    (await api.post(`/expeditions/${expeditionId}/close`)).data.data,
  reopen: async (expeditionId: string): Promise<TeacherExpedition> =>
    (await api.post(`/expeditions/${expeditionId}/reopen`)).data.data,
  remove: async (expeditionId: string): Promise<void> => {
    await api.delete(`/expeditions/${expeditionId}`);
  },
  addStop: async (expeditionId: string, kind: StopKind): Promise<TeacherStop> =>
    (await api.post(`/expeditions/${expeditionId}/stops`, { kind })).data.data,
  updateStop: async (stopId: string, patch: StopPatch): Promise<TeacherStop> =>
    (await api.patch(`/expeditions/stops/${stopId}`, patch)).data.data,
  deleteStop: async (stopId: string): Promise<void> => {
    await api.delete(`/expeditions/stops/${stopId}`);
  },
  reorder: async (expeditionId: string, stopIds: string[]): Promise<TeacherExpedition> =>
    (await api.put(`/expeditions/${expeditionId}/stops/order`, { stopIds })).data.data,
  board: async (expeditionId: string): Promise<ExpeditionBoard> =>
    (await api.get(`/expeditions/${expeditionId}/board`)).data.data,
  reviewQueue: async (expeditionId: string): Promise<ReviewQueue> =>
    (await api.get(`/expeditions/${expeditionId}/review`)).data.data,
  review: async (expeditionId: string, decisions: ReviewDecision[]): Promise<{ approved: number; needsWork: number; skipped: number }> =>
    (await api.post(`/expeditions/${expeditionId}/review`, { decisions })).data.data,
  markClass: async (stopId: string, studentProfileIds: string[]): Promise<{ marked: number; skipped: number }> =>
    (await api.post(`/expeditions/stops/${stopId}/class`, { studentProfileIds })).data.data,
  /** Recurso del docente o evidencia del alumno (imagen o PDF, máximo 5 MB). */
  upload: async (file: File): Promise<{ url: string; name: string | null }> => {
    const form = new FormData();
    form.append('file', file);
    return (await api.post('/expeditions/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data;
  },

  // Alumno
  mine: async (classroomId: string): Promise<StudentExpeditionSummary[]> =>
    (await api.get(`/expeditions/mine/${classroomId}`)).data.data,
  play: async (expeditionId: string): Promise<StudentExpedition> =>
    (await api.get(`/expeditions/${expeditionId}/play`)).data.data,
  continueStory: async (stopId: string): Promise<StudentExpedition> =>
    (await api.post(`/expeditions/stops/${stopId}/continue`)).data.data,
  challenge: async (stopId: string): Promise<ChallengeState> =>
    (await api.get(`/expeditions/stops/${stopId}/challenge`)).data.data,
  answer: async (stopId: string, questionId: string, answer: ChallengeAnswer): Promise<AnswerResult> =>
    (await api.post(`/expeditions/stops/${stopId}/answer`, { questionId, answer })).data.data,
  submitEvidence: async (stopId: string, input: { files: string[]; note: string | null }): Promise<StudentExpedition> =>
    (await api.post(`/expeditions/stops/${stopId}/evidence`, input)).data.data,
};
