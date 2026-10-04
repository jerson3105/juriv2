import type { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createUploadFilter, safeUploadFilename, verifyUploadedFile, IMAGE_MIMES, PDF_MIMES } from '../utils/fileValidation.js';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { questionBanksOwnedBy, requireClassroomTeacher, studentsBelongToClassroom } from '../utils/access.js';
import { cleanMessageText } from '../utils/messageText.js';
import { EXPEDITION_STOP_KINDS } from '../db/schema.js';
import {
  CLASS_ACTIVITIES, MAX_GRADE_WEIGHT, MAX_QUESTIONS, MAX_REWARD, MAX_STOPS, REFLECTIONS, expeditionService,
} from '../services/expedition.service.js';

// ── Validación (lista blanca: lo que no está en el esquema se rechaza) ──

const idSchema = z.string({ invalid_type_error: 'Identificador no válido' }).uuid('Identificador no válido');
const OWN_UPLOAD = /^\/api\/uploads\/expeditions\/[\w.-]+$/;
const HTTPS = /^https:\/\/[^\s<>"']+$/i;

/** Texto libre limpio (sin caracteres de control ni invisibles); vacío = null. */
const cleanText = (max: number, message: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? cleanMessageText(value) || null : value),
    z.string({ invalid_type_error: message }).max(max, message).nullable(),
  );
const title = (max: number, empty: string, long: string) =>
  z.preprocess((value) => (typeof value === 'string' ? cleanMessageText(value) : value), z.string({ invalid_type_error: empty }).min(1, empty).max(max, long));
const reward = z.number({ invalid_type_error: 'La recompensa debe ser un número' })
  .int('La recompensa debe ser un número entero').min(0, 'La recompensa no puede ser negativa').max(MAX_REWARD, `La recompensa no puede pasar de ${MAX_REWARD}`);
const position = z.number({ invalid_type_error: 'Posición no válida' }).min(0, 'Posición no válida').max(100, 'Posición no válida')
  .transform((value) => Math.round(value * 100) / 100);
const resource = z.object({
  kind: z.enum(['FILE', 'LINK'], { errorMap: () => ({ message: 'Recurso no válido' }) }),
  url: z.string({ invalid_type_error: 'Recurso no válido' }).trim().max(500, 'El enlace es muy largo'),
  name: z.preprocess((value) => (typeof value === 'string' ? cleanMessageText(value).slice(0, 120) || null : value ?? null), z.string().nullable()),
}).strict('Recurso no válido')
  .refine((r) => (r.kind === 'FILE' ? OWN_UPLOAD.test(r.url) : HTTPS.test(r.url)), 'Recurso no válido: usa un archivo subido o un enlace https');
const dueDate = z.union([z.string(), z.null()], { invalid_type_error: 'Fecha no válida' }).transform((value, ctx) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fecha no válida' });
    return z.NEVER;
  }
  return date;
});

const createSchema = z.object({
  classroomId: idSchema,
  name: title(120, 'Ponle un nombre a la expedición', 'El nombre es muy largo (máximo 120)'),
  description: cleanText(1000, 'La presentación es muy larga (máximo 1000)').optional(),
  scenario: z.enum(['CONSTELLATION', 'MAP'], { errorMap: () => ({ message: 'Escenario no válido' }) }).optional(),
  constellationId: z.string().max(40).nullable().optional(),
  mapImageUrl: z.string().max(500, 'Mapa no válido').nullable().optional(),
}).strict('Datos no válidos');

const updateSchema = z.object({
  name: title(120, 'Ponle un nombre a la expedición', 'El nombre es muy largo (máximo 120)').optional(),
  description: cleanText(1000, 'La presentación es muy larga (máximo 1000)').optional(),
  closingText: cleanText(1000, 'El mensaje final es muy largo (máximo 1000)').optional(),
  finishXp: reward.optional(),
  finishGold: reward.optional(),
  scenario: z.enum(['CONSTELLATION', 'MAP'], { errorMap: () => ({ message: 'Escenario no válido' }) }).optional(),
  constellationId: z.string().max(40, 'Constelación no válida').optional(),
  mapImageUrl: z.string().max(500, 'Mapa no válido').nullable().optional(),
  finishBadgeId: idSchema.nullable().optional(),
  perseveranceBadgeId: idSchema.nullable().optional(),
}).strict('Datos no válidos');

const stopKind = z.enum(EXPEDITION_STOP_KINDS, { errorMap: () => ({ message: 'Tipo de parada no válido' }) });
const addStopSchema = z.object({ kind: stopKind }).strict('Datos no válidos');
const updateStopSchema = z.object({
  kind: stopKind.optional(),
  title: title(120, 'La parada necesita un título', 'El título es muy largo (máximo 120)').optional(),
  story: cleanText(4000, 'El relato es muy largo (máximo 4000)').optional(),
  goal: cleanText(200, '«Lo que vas a lograr» es muy largo (máximo 200)').optional(),
  successCriteria: cleanText(200, '«Cómo sabrás que lo lograste» es muy largo (máximo 200)').optional(),
  mission: cleanText(4000, 'La misión es muy larga (máximo 4000)').optional(),
  resources: z.array(resource).max(5, 'Máximo 5 recursos por parada').optional(),
  bankId: idSchema.nullable().optional(),
  questionIds: z.array(idSchema).max(MAX_QUESTIONS, `Un reto tiene hasta ${MAX_QUESTIONS} preguntas`).optional(),
  passPercent: z.number({ invalid_type_error: 'Porcentaje no válido' }).int('Porcentaje no válido').min(50, 'El mínimo para superar va de 50 a 100 %').max(100, 'El mínimo para superar va de 50 a 100 %').optional(),
  reviewMode: z.enum(['ADVANCE', 'WAIT'], { errorMap: () => ({ message: 'Modo de revisión no válido' }) }).optional(),
  dueAt: dueDate.optional(),
  rewardXp: reward.optional(),
  rewardGold: reward.optional(),
  mapX: position.optional(),
  mapY: position.optional(),
  // Las competencias oficiales usan códigos (comp-pe-…), las propias un UUID: se valida contra la clase.
  competencyId: z.string({ invalid_type_error: 'Competencia no válida' }).trim().min(1, 'Competencia no válida').max(36, 'Competencia no válida').nullable().optional(),
  gradeWeight: z.number({ invalid_type_error: 'El peso debe ser un número' }).int('El peso debe ser un número entero')
    .min(1, `El peso va de 1 a ${MAX_GRADE_WEIGHT}`).max(MAX_GRADE_WEIGHT, `El peso va de 1 a ${MAX_GRADE_WEIGHT}`).optional(),
  classActivity: z.enum(CLASS_ACTIVITIES, { errorMap: () => ({ message: 'Actividad no válida' }) }).nullable().optional(),
}).strict('Datos no válidos');

const reorderSchema = z.object({
  stopIds: z.array(idSchema).min(1, 'No hay paradas').max(MAX_STOPS, `Una expedición tiene hasta ${MAX_STOPS} paradas`),
}).strict('Datos no válidos');

const reviewSchema = z.object({
  decisions: z.array(z.object({
    progressId: idSchema,
    decision: z.enum(['APPROVE', 'NEEDS_WORK'], { errorMap: () => ({ message: 'Decisión no válida' }) }),
    feedback: cleanText(500, 'El comentario es muy largo (máximo 500)').optional(),
    // La entrega que vio el docente: si el alumno la cambió mientras tanto, esa decisión se salta.
    evidenceId: idSchema.nullable().optional(),
    // Nivel en la escala de la clase al aprobar (AD, 17, 85…); solo cuenta si la parada tiene competencia.
    level: z.preprocess((value) => (typeof value === 'string' ? value.trim() || null : value), z.string().max(10, 'Nivel no válido').nullable()).optional(),
  }).strict('Datos no válidos').refine((d) => d.decision !== 'NEEDS_WORK' || !!d.feedback, 'Escribe qué debe mejorar'))
    .min(1, 'No hay decisiones').max(300, 'Demasiadas decisiones a la vez'),
}).strict('Datos no válidos');

const classSchema = z.object({
  studentProfileIds: z.array(idSchema).min(1, 'Elige al menos un alumno').max(300, 'Demasiados alumnos a la vez'),
}).strict('Datos no válidos');

const answerSchema = z.object({
  questionId: idSchema,
  answer: z.union([z.boolean(), z.number().int(), z.array(z.number().int()).max(20)], { errorMap: () => ({ message: 'Respuesta no válida' }) }),
}).strict('Datos no válidos');

const reflectionSchema = z.object({
  value: z.enum(REFLECTIONS, { errorMap: () => ({ message: 'Elige cómo te fue' }) }),
  note: cleanText(200, 'Escribe algo más corto (máximo 200)').optional(),
}).strict('Datos no válidos');

const evidenceSchema = z.object({
  files: z.array(z.string().regex(OWN_UPLOAD, 'Archivo no válido: súbelo desde la expedición')).max(5, 'Máximo 5 archivos').default([]),
  note: cleanText(2000, 'El texto es muy largo (máximo 2000)').optional(),
}).strict('Datos no válidos').refine((e) => e.files.length > 0 || !!e.note, 'Sube un archivo o escribe tu respuesta');

// Los 500 nunca devuelven el error crudo (podía traer SQL): solo el mensaje genérico.
const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0]?.message ?? 'Datos no válidos' });
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

// ── Acceso ──

/** Docente dueño de la clase de la expedición (o admin). */
const teacherOfExpedition = async (req: Request, res: Response, expeditionId: string) => {
  const classroomId = await expeditionService.getClassroomIdOf(expeditionId);
  if (!classroomId) throw new NotFoundError('Expedición no encontrada');
  return (await requireClassroomTeacher(req, res, classroomId)) ? classroomId : null;
};

const teacherOfStop = async (req: Request, res: Response, stopId: string) => {
  const context = await expeditionService.getStopContext(stopId);
  if (!context) throw new NotFoundError('Parada no encontrada');
  return (await requireClassroomTeacher(req, res, context.expedition.classroomId)) ? context : null;
};

/** El alumno sale SIEMPRE de la sesión: su perfil activo en la clase de la expedición. */
const studentIn = async (req: Request, classroomId: string) => {
  if (req.user?.role !== 'STUDENT') throw new ForbiddenError('Solo los alumnos pueden hacer esto');
  const profileId = await expeditionService.studentProfileFor(req.user.id, classroomId);
  if (!profileId) throw new ForbiddenError('No eres parte de esta clase');
  return profileId;
};

const studentOfStop = async (req: Request, stopId: string) => {
  const context = await expeditionService.getStopContext(stopId);
  if (!context) throw new NotFoundError('Parada no encontrada');
  return studentIn(req, context.expedition.classroomId);
};

// ── Subidas (recursos del docente y evidencias del alumno; máximo 5 MB) ──

const baseUploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const expeditionStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(baseUploadDir, 'expeditions');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: safeUploadFilename,
});

export const uploadExpeditionFile = [
  multer({
    storage: expeditionStorage,
    // Solo imágenes y PDFs; la extensión sale del MIME y el contenido se verifica tras guardar.
    fileFilter: createUploadFilter([...PDF_MIMES, ...IMAGE_MIMES], 'Solo se permiten imágenes (JPG, PNG, GIF, WebP) y PDFs'),
    limits: { fileSize: 5 * 1024 * 1024 },
  }).single('file'),
  verifyUploadedFile,
];

export const expeditionController = {
  async upload(req: Request, res: Response) {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió ningún archivo' });
    const name = cleanMessageText(req.file.originalname ?? '').slice(0, 120) || null;
    res.status(201).json({ success: true, data: { url: `/api/uploads/expeditions/${req.file.filename}`, name } });
  },

  // ==================== Docente ====================

  /** GET /expeditions/classroom/:classroomId */
  async list(req: Request, res: Response) {
    try {
      const classroomId = idSchema.parse(req.params.classroomId);
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      res.json({ success: true, data: await expeditionService.listForTeacher(classroomId) });
    } catch (error) {
      fail(res, error, 'Error al cargar las expediciones');
    }
  },

  /** POST /expeditions */
  async create(req: Request, res: Response) {
    try {
      const input = createSchema.parse(req.body);
      if (!(await requireClassroomTeacher(req, res, input.classroomId))) return;
      const data = await expeditionService.create(input.classroomId, {
        name: input.name,
        description: input.description ?? null,
        scenario: input.scenario,
        constellationId: input.constellationId ?? null,
        mapImageUrl: input.mapImageUrl ?? null,
      });
      res.status(201).json({ success: true, data, message: 'Expedición creada' });
    } catch (error) {
      fail(res, error, 'Error al crear la expedición');
    }
  },

  /** GET /expeditions/:id (docente) */
  async get(req: Request, res: Response) {
    try {
      const id = idSchema.parse(req.params.id);
      if (!(await teacherOfExpedition(req, res, id))) return;
      res.json({ success: true, data: await expeditionService.getForTeacher(id) });
    } catch (error) {
      fail(res, error, 'Error al cargar la expedición');
    }
  },

  /** PATCH /expeditions/:id */
  async update(req: Request, res: Response) {
    try {
      const id = idSchema.parse(req.params.id);
      const patch = updateSchema.parse(req.body);
      if (!(await teacherOfExpedition(req, res, id))) return;
      res.json({ success: true, data: await expeditionService.update(id, patch), message: 'Cambios guardados' });
    } catch (error) {
      fail(res, error, 'Error al guardar la expedición');
    }
  },

  /** POST /expeditions/:id/publish */
  async publish(req: Request, res: Response) {
    try {
      const id = idSchema.parse(req.params.id);
      if (!(await teacherOfExpedition(req, res, id))) return;
      res.json({ success: true, data: await expeditionService.publish(id), message: 'Expedición publicada' });
    } catch (error) {
      fail(res, error, 'Error al publicar la expedición');
    }
  },

  /** POST /expeditions/:id/close · /reopen */
  async close(req: Request, res: Response) {
    try {
      const id = idSchema.parse(req.params.id);
      if (!(await teacherOfExpedition(req, res, id))) return;
      res.json({ success: true, data: await expeditionService.setClosed(id, true), message: 'Expedición cerrada' });
    } catch (error) {
      fail(res, error, 'Error al cerrar la expedición');
    }
  },

  async reopen(req: Request, res: Response) {
    try {
      const id = idSchema.parse(req.params.id);
      if (!(await teacherOfExpedition(req, res, id))) return;
      res.json({ success: true, data: await expeditionService.setClosed(id, false), message: 'Expedición abierta de nuevo' });
    } catch (error) {
      fail(res, error, 'Error al abrir la expedición');
    }
  },

  /** DELETE /expeditions/:id (solo borradores) */
  async remove(req: Request, res: Response) {
    try {
      const id = idSchema.parse(req.params.id);
      if (!(await teacherOfExpedition(req, res, id))) return;
      await expeditionService.remove(id);
      res.json({ success: true, message: 'Borrador eliminado' });
    } catch (error) {
      fail(res, error, 'Error al eliminar la expedición');
    }
  },

  /** POST /expeditions/:id/stops { kind } */
  async addStop(req: Request, res: Response) {
    try {
      const id = idSchema.parse(req.params.id);
      const { kind } = addStopSchema.parse(req.body);
      if (!(await teacherOfExpedition(req, res, id))) return;
      res.status(201).json({ success: true, data: await expeditionService.addStop(id, kind) });
    } catch (error) {
      fail(res, error, 'Error al agregar la parada');
    }
  },

  /** PATCH /expeditions/stops/:stopId */
  async updateStop(req: Request, res: Response) {
    try {
      const stopId = idSchema.parse(req.params.stopId);
      const patch = updateStopSchema.parse(req.body);
      if (!(await teacherOfStop(req, res, stopId))) return;
      // El banco debe ser de una clase del mismo docente (se pueden reutilizar entre sus clases).
      if (patch.bankId && !(await questionBanksOwnedBy(req.user!, [patch.bankId]))) throw new ForbiddenError('Ese banco de preguntas no es tuyo');
      res.json({ success: true, data: await expeditionService.updateStop(stopId, patch), message: 'Parada guardada' });
    } catch (error) {
      fail(res, error, 'Error al guardar la parada');
    }
  },

  /** DELETE /expeditions/stops/:stopId */
  async deleteStop(req: Request, res: Response) {
    try {
      const stopId = idSchema.parse(req.params.stopId);
      if (!(await teacherOfStop(req, res, stopId))) return;
      res.json({ success: true, data: await expeditionService.deleteStop(stopId), message: 'Parada eliminada' });
    } catch (error) {
      fail(res, error, 'Error al eliminar la parada');
    }
  },

  /** PUT /expeditions/:id/stops/order { stopIds } */
  async reorder(req: Request, res: Response) {
    try {
      const id = idSchema.parse(req.params.id);
      const { stopIds } = reorderSchema.parse(req.body);
      if (!(await teacherOfExpedition(req, res, id))) return;
      res.json({ success: true, data: await expeditionService.reorderStops(id, stopIds) });
    } catch (error) {
      fail(res, error, 'Error al ordenar las paradas');
    }
  },

  /** GET /expeditions/:id/board */
  async board(req: Request, res: Response) {
    try {
      const id = idSchema.parse(req.params.id);
      if (!(await teacherOfExpedition(req, res, id))) return;
      res.json({ success: true, data: await expeditionService.board(id) });
    } catch (error) {
      fail(res, error, 'Error al cargar el progreso');
    }
  },

  /** GET /expeditions/:id/review */
  async reviewQueue(req: Request, res: Response) {
    try {
      const id = idSchema.parse(req.params.id);
      if (!(await teacherOfExpedition(req, res, id))) return;
      res.json({ success: true, data: await expeditionService.reviewQueue(id) });
    } catch (error) {
      fail(res, error, 'Error al cargar las evidencias');
    }
  },

  /** POST /expeditions/:id/review { decisions } */
  async review(req: Request, res: Response) {
    try {
      const id = idSchema.parse(req.params.id);
      const { decisions } = reviewSchema.parse(req.body);
      if (!(await teacherOfExpedition(req, res, id))) return;
      const data = await expeditionService.review(id, req.user!.id, decisions.map((d) => ({ ...d, feedback: d.feedback ?? null })));
      res.json({ success: true, data });
    } catch (error) {
      fail(res, error, 'Error al guardar la revisión');
    }
  },

  /** POST /expeditions/stops/:stopId/class { studentProfileIds }: presentes en una parada hecha en clase (cualquier tipo). */
  async markClass(req: Request, res: Response) {
    try {
      const stopId = idSchema.parse(req.params.stopId);
      const { studentProfileIds } = classSchema.parse(req.body);
      const context = await teacherOfStop(req, res, stopId);
      if (!context) return;
      if (!(await studentsBelongToClassroom(studentProfileIds, context.expedition.classroomId))) throw new ValidationError('Hay alumnos que no son de esta clase');
      res.json({ success: true, data: await expeditionService.markPresent(stopId, req.user!.id, studentProfileIds) });
    } catch (error) {
      fail(res, error, 'Error al marcar la parada');
    }
  },

  // ==================== Alumno ====================

  /** GET /expeditions/mine/:classroomId */
  async mine(req: Request, res: Response) {
    try {
      const classroomId = idSchema.parse(req.params.classroomId);
      const profileId = await studentIn(req, classroomId);
      res.json({ success: true, data: await expeditionService.listForStudent(classroomId, profileId) });
    } catch (error) {
      fail(res, error, 'Error al cargar tus expediciones');
    }
  },

  /** GET /expeditions/:id/play */
  async play(req: Request, res: Response) {
    try {
      const id = idSchema.parse(req.params.id);
      const classroomId = await expeditionService.getClassroomIdOf(id);
      if (!classroomId) throw new NotFoundError('Expedición no encontrada');
      const profileId = await studentIn(req, classroomId);
      res.json({ success: true, data: await expeditionService.getForStudent(id, profileId) });
    } catch (error) {
      fail(res, error, 'Error al cargar la expedición');
    }
  },

  /** POST /expeditions/stops/:stopId/continue (relato) */
  async continueStory(req: Request, res: Response) {
    try {
      const stopId = idSchema.parse(req.params.stopId);
      const profileId = await studentOfStop(req, stopId);
      res.json({ success: true, data: await expeditionService.continueStory(stopId, profileId) });
    } catch (error) {
      fail(res, error, 'Error al avanzar');
    }
  },

  /** GET /expeditions/stops/:stopId/challenge */
  async challenge(req: Request, res: Response) {
    try {
      const stopId = idSchema.parse(req.params.stopId);
      const profileId = await studentOfStop(req, stopId);
      res.json({ success: true, data: await expeditionService.getChallenge(stopId, profileId) });
    } catch (error) {
      fail(res, error, 'Error al cargar el reto');
    }
  },

  /** POST /expeditions/stops/:stopId/answer { questionId, answer } */
  async answer(req: Request, res: Response) {
    try {
      const stopId = idSchema.parse(req.params.stopId);
      const input = answerSchema.parse(req.body);
      const profileId = await studentOfStop(req, stopId);
      res.json({ success: true, data: await expeditionService.answer(stopId, profileId, input.questionId, input.answer) });
    } catch (error) {
      fail(res, error, 'Error al guardar la respuesta');
    }
  },

  /** POST /expeditions/:id/reflection { value, note }: «¿Cómo me fue?» al llegar a la meta. */
  async reflect(req: Request, res: Response) {
    try {
      const id = idSchema.parse(req.params.id);
      const input = reflectionSchema.parse(req.body);
      const classroomId = await expeditionService.getClassroomIdOf(id);
      if (!classroomId) throw new NotFoundError('Expedición no encontrada');
      const profileId = await studentIn(req, classroomId);
      res.json({ success: true, data: await expeditionService.reflect(id, profileId, input.value, input.note ?? null), message: 'Respuesta guardada' });
    } catch (error) {
      fail(res, error, 'Error al guardar tu respuesta');
    }
  },

  /** POST /expeditions/stops/:stopId/evidence { files, note } */
  async evidence(req: Request, res: Response) {
    try {
      const stopId = idSchema.parse(req.params.stopId);
      const input = evidenceSchema.parse(req.body);
      const profileId = await studentOfStop(req, stopId);
      const data = await expeditionService.submitEvidence(stopId, profileId, { files: input.files, note: input.note ?? null });
      res.status(201).json({ success: true, data, message: 'Evidencia entregada' });
    } catch (error) {
      fail(res, error, 'Error al entregar la evidencia');
    }
  },
};
