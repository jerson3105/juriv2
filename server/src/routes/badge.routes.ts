import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { badgeService, type CreateBadgeDto } from '../services/badge.service.js';
import {
  requireClassroomTeacher,
  requireClassroomMember,
  requireTeacherRole,
  requireStudentProfileOwner,
  requireStudentProfileReadAccess,
  badgeScopeAndClassroom,
  classroomIdOfStudentProfile,
  pickFields,
} from '../utils/access.js';
import { behaviorService } from '../services/behavior.service.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createGenAI } from '../utils/aiClient.js';
import { createUploadFilter, safeUploadFilename, verifyUploadedFile, IMAGE_MIMES } from '../utils/fileValidation.js';
import { AppError, publicErrorMessage } from '../utils/errors.js';
import { studentBadgesService } from '../services/studentBadges.service.js';
import { aiGuard } from '../middleware/security.js';
import { NEGATIVE_BADGE_MESSAGE, conditionBehaviorIds, isNegativeCondition, parseBadgeCondition } from '../utils/badgeConditions.js';
import { z } from 'zod';

const router = Router();

// ═══════════════════════════════════════════════════════════
// Validación
// ═══════════════════════════════════════════════════════════

const count = z.number().int().min(1).max(10000);
const simpleConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('BEHAVIOR_COUNT'), behaviorId: z.string().uuid(), count }),
  z.object({ type: z.literal('BEHAVIOR_CATEGORY'), category: z.enum(['positive', 'negative']), count }),
  z.object({ type: z.literal('ANY_BEHAVIOR'), count }),
  z.object({ type: z.literal('XP_TOTAL'), value: z.number().int().min(1).max(10_000_000) }),
  z.object({ type: z.literal('LEVEL'), value: z.number().int().min(1).max(1000) }),
  z.object({ type: z.literal('PURCHASES'), value: z.number().int().min(1).max(10000) }),
]);
const conditionSchema = z.union([
  simpleConditionSchema,
  z.object({ type: z.literal('COMPOUND'), operator: z.enum(['AND', 'OR']).optional(), conditions: z.array(simpleConditionSchema).min(1).max(5) }),
]);

const rewardMessage = 'La recompensa debe estar entre 0 y 1000';
const badgeFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre').max(100, 'El nombre es demasiado largo'),
  description: z.string().trim().max(255).default(''),
  icon: z.string().min(1).max(50),
  // Solo imágenes subidas por /upload-image (evita URLs arbitrarias).
  customImage: z.string().regex(/^\/badges\/[\w.-]+$/, 'Imagen no válida').nullable().optional(),
  category: z.enum(['PROGRESS', 'PARTICIPATION', 'SOCIAL', 'SHOP', 'SPECIAL', 'SECRET', 'CUSTOM']).optional(),
  rarity: z.enum(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']).optional(),
  assignmentMode: z.enum(['AUTOMATIC', 'MANUAL', 'BOTH']),
  unlockCondition: conditionSchema.nullable().optional(),
  rewardXp: z.number().int().min(0, rewardMessage).max(1000, rewardMessage).optional(),
  rewardGp: z.number().int().min(0, rewardMessage).max(1000, rewardMessage).optional(),
  isSecret: z.boolean().optional(),
  competencyId: z.string().max(36).nullable().optional(),
});

// Una insignia automática sin condición nunca se otorgaría: se rechaza.
const requireConditionWhenAutomatic = (data: { assignmentMode?: string; unlockCondition?: unknown }) =>
  data.assignmentMode === undefined || data.assignmentMode === 'MANUAL' || !!data.unlockCondition;
const conditionMessage = { message: 'Una insignia automática necesita una condición completa', path: ['unlockCondition'] };

const createBadgeSchema = badgeFieldsSchema.refine(requireConditionWhenAutomatic, conditionMessage);
const updateBadgeSchema = badgeFieldsSchema.partial().refine(requireConditionWhenAutomatic, conditionMessage);

const awardBulkSchema = z.object({
  badgeId: z.string().uuid(),
  studentProfileIds: z.array(z.string().uuid()).min(1).max(200),
  reason: z.string().trim().max(255).optional(),
});

const sendValidationError = (res: any, error: z.ZodError) =>
  res.status(400).json({ message: error.issues[0]?.message || 'Datos inválidos', errors: error.issues });

// Los comportamientos citados en la condición deben ser de la misma clase y positivos: nunca insignias
// por lo negativo (la conducta se maneja con la energía). Devuelve el problema o null.
const conditionProblem = async (condition: unknown, classroomId: string): Promise<string | null> => {
  const parsed = parseBadgeCondition(condition);
  if (!parsed) return null;
  if (isNegativeCondition(parsed)) return NEGATIVE_BADGE_MESSAGE;
  for (const id of conditionBehaviorIds(parsed)) {
    const behavior = await behaviorService.getById(id);
    if (!behavior || behavior.classroomId !== classroomId) return 'El comportamiento de la condición no pertenece a esta clase';
    if (!behavior.isPositive) return NEGATIVE_BADGE_MESSAGE;
  }
  return null;
};

// Configurar directorio de uploads para insignias
const BADGES_DIR = path.join(process.cwd(), 'public', 'badges');
if (!fs.existsSync(BADGES_DIR)) {
  fs.mkdirSync(BADGES_DIR, { recursive: true });
}

// Configurar multer para subida de imágenes de insignias
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, BADGES_DIR);
  },
  filename: safeUploadFilename,
});

const upload = multer({
  storage,
  fileFilter: createUploadFilter(IMAGE_MIMES, 'Solo se permiten imágenes (PNG, JPG, GIF, WEBP)'),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max
  }
});

// ═══════════════════════════════════════════════════════════
// Rutas de Insignias (Profesor)
// ═══════════════════════════════════════════════════════════

// Estadísticas de insignias de una clase (DEBE IR ANTES de /classroom/:classroomId)
router.get('/classroom/:classroomId/stats', authenticate, async (req, res) => {
  try {
    const { classroomId } = req.params;
    if (!(await requireClassroomTeacher(req, res, classroomId))) return;
    const stats = await badgeService.getClassroomBadgeStats(classroomId);
    res.json(stats);
  } catch (error: any) {
    console.error('Error getting badge stats:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

// Desglose de ganadores y otorgamientos de insignias
router.get('/classroom/:classroomId/awards-breakdown', authenticate, async (req, res) => {
  try {
    const { classroomId } = req.params;
    if (!(await requireClassroomTeacher(req, res, classroomId))) return;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const rarity = typeof req.query.rarity === 'string' ? req.query.rarity : undefined;
    const assignmentMode = typeof req.query.assignmentMode === 'string' ? req.query.assignmentMode : undefined;
    const startDate = typeof req.query.startDate === 'string' ? new Date(req.query.startDate) : undefined;
    const endDate = typeof req.query.endDate === 'string' ? new Date(req.query.endDate) : undefined;

    const parsedRarity = rarity && ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'].includes(rarity)
      ? rarity as 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
      : undefined;
    const parsedAssignmentMode = assignmentMode && ['MANUAL', 'AUTOMATIC', 'BOTH'].includes(assignmentMode)
      ? assignmentMode as 'MANUAL' | 'AUTOMATIC' | 'BOTH'
      : undefined;

    const breakdown = await badgeService.getClassroomAwardsBreakdown(classroomId, {
      search,
      rarity: parsedRarity,
      assignmentMode: parsedAssignmentMode,
      startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : undefined,
      endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : undefined,
    });

    res.json(breakdown);
  } catch (error: any) {
    console.error('Error getting awards breakdown:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

// Cuántas veces tiene cada alumno cada insignia (para "ya la tiene" y "N alumnos")
router.get('/classroom/:classroomId/award-counts', authenticate, async (req, res) => {
  try {
    const { classroomId } = req.params;
    if (!(await requireClassroomTeacher(req, res, classroomId))) return;
    res.json(await badgeService.getClassroomAwardCounts(classroomId));
  } catch (error: any) {
    console.error('Error getting award counts:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

// Obtener insignias de una clase (sistema + personalizadas)
router.get('/classroom/:classroomId', authenticate, async (req, res) => {
  try {
    const { classroomId } = req.params;
    if (!(await requireClassroomMember(req, res, classroomId))) return;
    const badges = await badgeService.getClassroomBadges(classroomId);
    // Un alumno (o su familia) no ve las secretas: las descubre al ganarlas.
    const role = req.user?.role;
    res.json(role === 'TEACHER' || role === 'ADMIN' ? badges : badges.filter((badge) => !badge.isSecret));
  } catch (error: any) {
    console.error('Error getting classroom badges:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

// Subir imagen de insignia
router.post('/upload-image', authenticate, upload.single('image'), verifyUploadedFile, async (req, res) => {
  try {
    if (!requireTeacherRole(req, res)) return;
    if (!req.file) {
      return res.status(400).json({ message: 'No se proporcionó imagen' });
    }
    
    const imageUrl = `/badges/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (error: any) {
    console.error('Error uploading badge image:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

// ═══════════════════════════════════════════════════════════
// Generación con IA
// ═══════════════════════════════════════════════════════════

router.post('/generate-ai', authenticate, ...aiGuard, async (req, res) => {
  try {
    if (!requireTeacherRole(req, res)) return;
    const { description, level, count = 8, assignmentMode = 'MANUAL', rarities = ['COMMON', 'RARE', 'EPIC'], includeSecret = false, classroomId, competencies } = req.body;

    if (!description || !level) {
      return res.status(400).json({ message: 'Se requiere descripción y nivel educativo' });
    }
    // La clase indicada debe ser del profesor: sus comportamientos van al prompt y a la respuesta.
    if (classroomId && !(await requireClassroomTeacher(req, res, String(classroomId)))) return;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'API key de Gemini no configurada' });
    }

    const ai = createGenAI(apiKey);

    // Obtener comportamientos del aula si se proporciona classroomId
    let behaviorsContext = '';
    let behaviorsForConditions = '';
    
    if (classroomId && (assignmentMode === 'AUTOMATIC' || assignmentMode === 'BOTH')) {
      const behaviors = await behaviorService.getByClassroom(classroomId);
      
      // Solo los positivos: nunca insignias por lo negativo (la conducta se maneja con la energía).
      const positiveBehaviors = behaviors.filter(b => b.isPositive);
      if (positiveBehaviors.length > 0) {
        behaviorsContext = `
COMPORTAMIENTOS POSITIVOS DISPONIBLES EN EL AULA:
${positiveBehaviors.map(b => `"${b.name}" (id: ${b.id})`).join(', ')}`;

        behaviorsForConditions = `
   Para BEHAVIOR_COUNT usar (solo con los comportamientos positivos de la lista):
   { "type": "BEHAVIOR_COUNT", "behaviorId": "id-del-comportamiento", "count": número }

   Para BEHAVIOR_CATEGORY usar:
   { "type": "BEHAVIOR_CATEGORY", "category": "positive", "count": número }`;
      }
    }

    // Recompensas en proporción al XP por nivel de la clase (con 100 XP por nivel: 10-20 / 25-40 / 50-75 / 100-150).
    const xpPerLevel = classroomId ? await badgeService.getXpPerLevel(String(classroomId)) : 100;
    const xpRange = (from: number, to: number) => `${Math.max(1, Math.round(xpPerLevel * from))}-${Math.max(1, Math.round(xpPerLevel * to))}`;

    // Configurar competencias si existen
    let competenciesInstruction = '';
    let competencyJsonField = '';
    if (competencies && competencies.length > 0) {
      const competencyList = competencies.map((c: { id: string; name: string }) => `- ID: "${c.id}" → ${c.name}`).join('\n');
      competenciesInstruction = `
COMPETENCIAS DISPONIBLES:
${competencyList}

IMPORTANTE: Asigna a cada insignia la competencia más apropiada usando su ID exacto.
Si una insignia no encaja claramente con ninguna competencia, usa null.`;
      competencyJsonField = ',\n    "competencyId": "id-de-la-competencia-o-null"';
    }

    const raritiesStr = rarities.join(', ');
    const assignmentModeDesc = assignmentMode === 'MANUAL' 
      ? 'MANUAL (el profesor otorga manualmente)' 
      : assignmentMode === 'AUTOMATIC' 
        ? 'AUTOMATIC (se desbloquea automáticamente al cumplir condición)' 
        : 'BOTH (ambos modos)';

    const prompt = `Eres un experto en gamificación educativa. Genera ${count} insignias para una clase de nivel ${level}.

CONTEXTO DEL PROFESOR:
"${description}"
${behaviorsContext}
${competenciesInstruction}

CONFIGURACIÓN:
- Modo de asignación: ${assignmentModeDesc}
- Rarezas a incluir: ${raritiesStr}
- ${includeSecret ? 'Incluir algunas insignias secretas (isSecret: true)' : 'No incluir insignias secretas'}

Responde SOLO con un array JSON válido, sin texto adicional ni bloques de código:

[
  {
    "name": "Nombre corto y atractivo (máx 25 chars)",
    "description": "Cuándo se gana, dicho al estudiante en tuteo (máx 80 chars). Ej.: Cuando explicas a un compañero cómo lo resolviste",
    "icon": "emoji",
    "rarity": "COMMON|RARE|EPIC|LEGENDARY",
    "assignmentMode": "${assignmentMode}",
    "unlockCondition": null,
    "rewardXp": número,
    "rewardGp": número,
    "isSecret": boolean${competencyJsonField}
  }
]

REGLAS IMPORTANTES:
1. Iconos permitidos: 🏆⭐🎖️🥇🥈🥉💎👑🎯🔥💪📚✨🌟🎓🏅🦁🐉🎨🔬🎪🎭🚀🌈💡🎵🎮🏰
2. Distribución de rarezas según ${raritiesStr}:
   - COMMON: logros básicos, rewardXp: ${xpRange(0.1, 0.2)}, rewardGp: 5-10
   - RARE: logros moderados, rewardXp: ${xpRange(0.25, 0.4)}, rewardGp: 15-25
   - EPIC: logros difíciles, rewardXp: ${xpRange(0.5, 0.75)}, rewardGp: 30-45
   - LEGENDARY: logros excepcionales, rewardXp: ${xpRange(1, 1.5)}, rewardGp: 50-75
3. Si assignmentMode es AUTOMATIC o BOTH, incluir unlockCondition con una de estas estructuras:
   { "type": "XP_TOTAL", "value": número }
   { "type": "LEVEL", "value": número }
   { "type": "ANY_BEHAVIOR", "count": número }${behaviorsForConditions}
4. Nombres creativos, motivadores y apropiados para el nivel educativo
5. La descripción dice CUÁNDO se gana (el criterio que el estudiante puede cumplir), no un elogio genérico
6. Balancear la cantidad entre las rarezas seleccionadas
7. Si hay comportamientos disponibles, PRIORIZA usar BEHAVIOR_COUNT con los IDs reales para las condiciones automáticas
8. PROHIBIDO: insignias por comportamientos negativos o por portarse mal. Las insignias reconocen logros.
${competencies && competencies.length > 0 ? '9. Liga competencyId (ID exacto) solo si la insignia reconoce un logro de esa competencia; si no, null' : ''}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
    });

    const text = response.text?.trim() || '';
    
    // Limpiar respuesta
    let jsonText = text;
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    let badges;
    try {
      badges = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Error parsing AI response:', jsonText);
      return res.status(500).json({ message: 'Error al procesar respuesta de IA' });
    }

    if (!Array.isArray(badges)) {
      return res.status(500).json({ message: 'Respuesta de IA inválida' });
    }
    // Por si la IA no hizo caso: una condición negativa se descarta (la insignia queda manual).
    badges = badges.map((badge: { assignmentMode?: string; unlockCondition?: unknown }) => (
      isNegativeCondition(parseBadgeCondition(badge?.unlockCondition))
        ? { ...badge, assignmentMode: 'MANUAL', unlockCondition: null }
        : badge
    ));

    res.json({
      success: true,
      data: {
        badges,
        prompt,
      },
    });
  } catch (error: any) {
    console.error('Error generating badges with AI:', error);
    res.status(500).json({ message: publicErrorMessage(error) || 'Error al generar insignias' });
  }
});

// Crear insignia personalizada
router.post('/classroom/:classroomId', authenticate, async (req, res) => {
  try {
    const { classroomId } = req.params;
    if (!(await requireClassroomTeacher(req, res, classroomId))) return;
    const userId = (req as any).user.id;

    const parsed = createBadgeSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(res, parsed.error);
    const body = parsed.data;
    const unlockCondition = body.assignmentMode === 'MANUAL' ? null : body.unlockCondition ?? null;
    const problem = await conditionProblem(unlockCondition, classroomId);
    if (problem) return res.status(400).json({ message: problem });

    const data: CreateBadgeDto = {
      classroomId,
      name: body.name,
      description: body.description,
      icon: body.icon,
      customImage: body.customImage ?? undefined,
      category: body.category,
      rarity: body.rarity,
      assignmentMode: body.assignmentMode,
      unlockCondition: unlockCondition as CreateBadgeDto['unlockCondition'],
      rewardXp: body.rewardXp,
      rewardGp: body.rewardGp,
      isSecret: body.isSecret,
      competencyId: body.competencyId ?? undefined,
    };

    const badge = await badgeService.createBadge(data, userId);
    res.status(201).json(badge);
  } catch (error: any) {
    console.error('Error creating badge:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

// Campos que un profesor puede modificar de su insignia (evita mass assignment
// sobre scope/classroomId/createdBy y otras columnas internas).
const BADGE_UPDATABLE_FIELDS = [
  'name', 'description', 'icon', 'customImage', 'category', 'rarity',
  'assignmentMode', 'unlockCondition', 'rewardXp', 'rewardGp', 'isSecret', 'competencyId',
] as const;

const pickBadgeFields = (body: Record<string, unknown>): Partial<CreateBadgeDto> =>
  pickFields(body, BADGE_UPDATABLE_FIELDS) as Partial<CreateBadgeDto>;

// Verifica que el usuario puede modificar/borrar la insignia indicada.
// SYSTEM: solo ADMIN. CLASSROOM: profesor dueño de la clase (o ADMIN).
const ensureBadgeMutable = async (req: any, res: any, badgeId: string): Promise<boolean> => {
  const info = await badgeScopeAndClassroom(badgeId);
  if (!info) {
    res.status(404).json({ message: 'Insignia no encontrada' });
    return false;
  }
  if (info.scope === 'SYSTEM') {
    if (req.user?.role === 'ADMIN') return true;
    res.status(403).json({ message: 'No puedes modificar insignias del sistema' });
    return false;
  }
  if (!info.classroomId) {
    res.status(403).json({ message: 'Insignia sin clase asociada' });
    return false;
  }
  return requireClassroomTeacher(req, res, info.classroomId);
};

// Actualizar insignia
router.put('/:badgeId', authenticate, async (req, res) => {
  try {
    const { badgeId } = req.params;
    if (!(await ensureBadgeMutable(req, res, badgeId))) return;
    const parsed = updateBadgeSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(res, parsed.error);
    const changes = pickBadgeFields(parsed.data as Record<string, unknown>);
    if (parsed.data.assignmentMode === 'MANUAL') changes.unlockCondition = null as unknown as CreateBadgeDto['unlockCondition'];
    const info = await badgeScopeAndClassroom(badgeId);
    const problem = info?.classroomId ? await conditionProblem(changes.unlockCondition, info.classroomId) : null;
    if (problem) return res.status(400).json({ message: problem });
    await badgeService.updateBadge(badgeId, changes);
    res.json({ message: 'Insignia actualizada' });
  } catch (error: any) {
    console.error('Error updating badge:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

// Motivos que el profe ya usó con esta insignia (sus motivos rápidos al otorgarla)
router.get('/:badgeId/recent-reasons', authenticate, async (req, res) => {
  try {
    const info = await badgeScopeAndClassroom(req.params.badgeId);
    if (!info?.classroomId) return res.status(404).json({ message: 'Insignia no encontrada' });
    if (!(await requireClassroomTeacher(req, res, info.classroomId))) return;
    res.json({ success: true, data: await badgeService.getRecentReasons(req.params.badgeId) });
  } catch (error: any) {
    console.error('Error getting recent badge reasons:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

// Archivar insignia (deja de otorgarse; los alumnos conservan las que ganaron)
router.delete('/:badgeId', authenticate, async (req, res) => {
  try {
    const { badgeId } = req.params;
    if (!(await ensureBadgeMutable(req, res, badgeId))) return;
    await badgeService.archiveBadge(badgeId);
    res.json({ message: 'Insignia archivada' });
  } catch (error: any) {
    console.error('Error archiving badge:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

// Restaurar insignia archivada ("Deshacer")
router.post('/:badgeId/restore', authenticate, async (req, res) => {
  try {
    const { badgeId } = req.params;
    if (!(await ensureBadgeMutable(req, res, badgeId))) return;
    await badgeService.restoreBadge(badgeId);
    res.json({ message: 'Insignia restaurada' });
  } catch (error: any) {
    console.error('Error restoring badge:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

// ═══════════════════════════════════════════════════════════
// Rutas de Insignias de Estudiantes
// ═══════════════════════════════════════════════════════════

// Obtener insignias de un estudiante
router.get('/student/:studentProfileId', authenticate, async (req, res) => {
  try {
    const { studentProfileId } = req.params;
    if (!(await requireStudentProfileReadAccess(req, res, studentProfileId))) return;
    const badges = await badgeService.getStudentBadges(studentProfileId);
    res.json(badges);
  } catch (error: any) {
    console.error('Error getting student badges:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

// Obtener insignias mostradas en perfil
router.get('/student/:studentProfileId/displayed', authenticate, async (req, res) => {
  try {
    const { studentProfileId } = req.params;
    if (!(await requireStudentProfileReadAccess(req, res, studentProfileId))) return;
    const badges = await badgeService.getDisplayedBadges(studentProfileId);
    res.json(badges);
  } catch (error: any) {
    console.error('Error getting displayed badges:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

// Actualizar insignias mostradas
router.put('/student/:studentProfileId/displayed', authenticate, async (req, res) => {
  try {
    const { studentProfileId } = req.params;
    if (!(await requireStudentProfileOwner(req, res, studentProfileId))) return;
    const { badgeIds } = req.body;
    await badgeService.setDisplayedBadges(studentProfileId, badgeIds);
    res.json({ message: 'Insignias actualizadas' });
  } catch (error: any) {
    console.error('Error setting displayed badges:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

// Progreso hacia las automáticas (ficha del alumno del profe): mismo cálculo honesto que «Mis insignias»
router.get('/student/:studentProfileId/progress/:classroomId', authenticate, async (req, res) => {
  try {
    const { studentProfileId, classroomId } = req.params;
    if (!(await requireStudentProfileReadAccess(req, res, studentProfileId))) return;
    // La clase debe ser la del perfil: si no, se listarían las insignias de otra clase.
    if ((await classroomIdOfStudentProfile(studentProfileId)) !== classroomId) {
      return res.status(404).json({ message: 'Estudiante no encontrado en esta clase' });
    }
    res.json(await studentBadgesService.getStaffProgress(studentProfileId));
  } catch (error: any) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
    console.error('Error getting badge progress:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

// «Mis insignias» del alumno: lo ganado, lo que puede ganar y cómo, y cuántas secretas hay (solo el dueño; otro perfil → 404)
router.get('/student/:studentProfileId/view', authenticate, async (req, res) => {
  try {
    const data = await studentBadgesService.getView(req.params.studentProfileId, req.user!.id);
    res.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error('Error getting student badge view:', error);
    res.status(500).json({ success: false, message: 'No se pudieron cargar tus insignias' });
  }
});

// ═══════════════════════════════════════════════════════════
// Otorgar/Revocar Insignias
// ═══════════════════════════════════════════════════════════

// Otorgar insignia manualmente (profesor)
router.post('/award', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { studentProfileId, badgeId, reason } = req.body;

    const awardClassroomId = await classroomIdOfStudentProfile(studentProfileId);
    if (!awardClassroomId) return res.status(404).json({ message: 'Estudiante no encontrado' });
    if (!(await requireClassroomTeacher(req, res, awardClassroomId))) return;

    const awarded = await badgeService.awardBadgeManually(
      studentProfileId,
      badgeId,
      userId,
      typeof reason === 'string' ? reason.slice(0, 255) : undefined,
      awardClassroomId
    );

    res.status(201).json(awarded);
  } catch (error: any) {
    console.error('Error awarding badge:', error);
    res.status(400).json({ message: error.message });
  }
});

// Otorgar una insignia a varios alumnos de una clase (profesor)
router.post('/award-bulk', authenticate, async (req, res) => {
  try {
    const parsed = awardBulkSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(res, parsed.error);
    const { badgeId, studentProfileIds, reason } = parsed.data;

    // Todos los alumnos deben ser de una misma clase del profesor.
    const classroomIds = new Set<string>();
    for (const id of new Set(studentProfileIds)) {
      const classroomId = await classroomIdOfStudentProfile(id);
      if (!classroomId) return res.status(404).json({ message: 'Estudiante no encontrado' });
      classroomIds.add(classroomId);
    }
    if (classroomIds.size !== 1) return res.status(400).json({ message: 'Los estudiantes deben ser de una misma clase' });
    const [classroomId] = [...classroomIds];
    if (!(await requireClassroomTeacher(req, res, classroomId))) return;

    const result = await badgeService.awardBadgeToStudents(
      [...new Set(studentProfileIds)],
      badgeId,
      (req as any).user.id,
      classroomId,
      reason || undefined,
    );
    res.status(result.awarded.length > 0 ? 201 : 400).json(result);
  } catch (error: any) {
    console.error('Error awarding badge in bulk:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

// Revocar insignia (profesor)
router.delete('/revoke/:studentProfileId/:badgeId', authenticate, async (req, res) => {
  try {
    const { studentProfileId, badgeId } = req.params;
    const revokeClassroomId = await classroomIdOfStudentProfile(studentProfileId);
    if (!revokeClassroomId) return res.status(404).json({ message: 'Estudiante no encontrado' });
    if (!(await requireClassroomTeacher(req, res, revokeClassroomId))) return;
    await badgeService.revokeBadge(studentProfileId, badgeId, req.user!.id);
    res.json({ message: 'Insignia revocada' });
  } catch (error: any) {
    console.error('Error revoking badge:', error);
    res.status(500).json({ message: publicErrorMessage(error) });
  }
});

export default router;
