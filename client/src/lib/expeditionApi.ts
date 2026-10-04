import { api } from './api';
import type { GradeScaleOptions, GradeScaleType } from './gradeApi';

// Expedición unificada (2026-10-03): paradas en lista (relato, reto del banco, evidencia y en clase) sobre una
// constelación de Jiro o un mapa de la biblioteca. El alumno sale siempre de la sesión: nunca va en la URL.

export type ExpeditionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ExpeditionScenario = 'CONSTELLATION' | 'MAP';
export type StopKind = 'STORY' | 'CHALLENGE' | 'EVIDENCE' | 'CLASS';
export type StopState = 'LOCKED' | 'AVAILABLE' | 'STARTED' | 'WAITING' | 'NEEDS_WORK' | 'DONE';
export type ReviewMode = 'ADVANCE' | 'WAIT';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'NEEDS_WORK';
/** Actividad del Observatorio con la que se juega una parada «en clase». */
export type ClassActivity = 'ESTRELLAS' | 'CONQUISTA' | 'ERROR';
/** «¿Cómo me fue?» al llegar a la meta. */
export type Reflection = 'GREEN' | 'YELLOW' | 'RED';
export interface ReflectionAnswer { value: Reflection; note: string | null }

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
  /** Insignias que elige el docente: al llegar a la meta y por perseverancia. */
  finishBadgeId: string | null;
  perseveranceBadgeId: string | null;
  /** Por clanes: XP para el clan cuando llega a la meta. */
  clanXp: number;
  /** Meta de la clase (null = sin meta). */
  goalPercent: number | null;
  goalDueAt: string | null;
  goalXp: number;
  goalReachedAt: string | null;
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
  /** Nota: solo reto y evidencia, con una competencia de la clase y un peso de 1 a 30. */
  competencyId: string | null;
  gradeWeight: number;
  classActivity: ClassActivity | null;
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
  reflection: ReflectionAnswer | null;
  states: {
    stopId: string; state: StopState; review: ReviewStatus | null; firstScore: number | null; goldStar: boolean;
    /** Lograda en clase (proyectada o con el Observatorio). */
    inClass: boolean;
    /** Nivel elegido al aprobar la evidencia (AD, A, 17…). */
    gradeLabel: string | null;
  }[];
}

/** Capa de clanes: una parada cuenta para el clan cuando la logra más de la mitad de sus miembros. */
export interface ClanProgress {
  id: string;
  name: string;
  color: string;
  emblem: string;
  members: number;
  countedStopIds: string[];
  finished: boolean;
}

/** Meta de la clase: si el % llega a la meta (antes de la fecha), XP para quienes llegaron. */
export interface ClassGoal {
  percent: number;
  dueAt: string | null;
  xp: number;
  reachedAt: string | null;
  finished: number;
  total: number;
}

export interface ExpeditionBoard {
  /** here: cuántos tienen esa parada como siguiente · done: cuántos la lograron. */
  stops: { id: string; sortOrder: number; kind: StopKind; title: string; here: number; done: number }[];
  students: BoardStudent[];
  groupMode: 'INDIVIDUAL' | 'CLAN';
  clans: ClanProgress[];
  goal: ClassGoal | null;
}

export interface ReviewItem {
  progressId: string;
  stopId: string;
  stopTitle: string;
  stopNumber: number;
  reviewMode: ReviewMode;
  rewardXp: number;
  rewardGold: number;
  /** La parada cuenta para la nota: al aprobar se puede elegir el nivel. */
  competency: { id: string; name: string } | null;
  review: ReviewStatus;
  feedback: string | null;
  reviewedAt: string | null;
  student: { id: string; name: string; characterName: string | null };
  evidence: { id: string; files: string[]; note: string | null; submittedAt: string } | null;
}

export interface ReviewQueue {
  expeditionId: string;
  stopCount: number;
  /** Escala de notas de la clase (para el nivel al aprobar). */
  scale: GradeScaleOptions;
  scaleType: GradeScaleType | null;
  pending: ReviewItem[];
  needsWork: ReviewItem[];
}

export interface ReviewDecision {
  progressId: string;
  decision: 'APPROVE' | 'NEEDS_WORK';
  feedback?: string | null;
  /** La entrega que vio el docente: si el alumno la cambió, el servidor salta la decisión. */
  evidenceId?: string | null;
  /** Nivel en la escala de la clase (solo si la parada cuenta para la nota). */
  level?: string | null;
}

export interface ReviewResult { approved: number; needsWork: number; skipped: number; changed: number }

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
  competencyId?: string | null;
  gradeWeight?: number;
  classActivity?: ClassActivity | null;
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
  finishBadgeId?: string | null;
  perseveranceBadgeId?: string | null;
  groupMode?: 'INDIVIDUAL' | 'CLAN';
  clanXp?: number;
  goalPercent?: number | null;
  goalDueAt?: string | null;
  goalXp?: number;
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
  /** La hizo con la clase (proyectada o con el Observatorio). */
  doneInClass: boolean;
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
  /** «¿Cómo me fue?» (al llegar a la meta). */
  reflection: ReflectionAnswer | null;
  groupMode: 'INDIVIDUAL' | 'CLAN';
  /** Su clan (modo por clanes y si tiene clan). */
  clan: Omit<ClanProgress, 'id'> | null;
  /** La meta de la clase y si ya cobró su premio. */
  goal: (ClassGoal & { rewarded: boolean }) | null;
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
  /** Lo jugaron juntos en clase: logrado, sin % propio. */
  doneInClass: boolean;
  /** El reto aún no tiene preguntas (el docente las está eligiendo): el alumno espera. */
  preparing: boolean;
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
  review: async (expeditionId: string, decisions: ReviewDecision[]): Promise<ReviewResult> =>
    (await api.post(`/expeditions/${expeditionId}/review`, { decisions })).data.data,
  /** Presentes en una parada hecha en clase (cualquier tipo): quien ya la tenía se salta. */
  markClass: async (stopId: string, studentProfileIds: string[]): Promise<{ marked: number; skipped: number; stopTitle: string }> =>
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
  reflect: async (expeditionId: string, input: { value: Reflection; note: string | null }): Promise<StudentExpedition> =>
    (await api.post(`/expeditions/${expeditionId}/reflection`, input)).data.data,
};
