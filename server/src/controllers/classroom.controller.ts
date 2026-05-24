import type { Request, Response } from 'express';
import { classroomService } from '../services/classroom.service.js';
import { onboardingService, ALL_FEATURES, type Feature } from '../services/onboarding.service.js';
import { db } from '../db/index.js';
import { curriculumAreas, curriculumCompetencies, studentProfiles } from '../db/schema.js';
import { eq, and, or, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

const AI_CLASSROOM_SUBJECTS = [
  'matematicas',
  'comunicacion',
  'ciencias',
  'historia',
  'ingles',
  'arte',
  'educacion_fisica',
  'tecnologia',
  '',
] as const;

const AI_CLASSROOM_GRADE_LEVELS = [
  'inicial',
  'primaria_baja',
  'primaria_alta',
  'secundaria_baja',
  'secundaria_alta',
  'preparatoria',
  'universidad',
  '',
] as const;

const AI_CLASSROOM_EDUCATION_LEVELS = ['', 'PRIMARIA', 'SECUNDARIA'] as const;
const AI_CLASSROOM_GRADE_SCALE_TYPES = ['PERU_LETTERS', 'PERU_VIGESIMAL', 'CENTESIMAL', 'USA_LETTERS', 'CUSTOM'] as const;
const AI_CLASSROOM_POINT_MODES = ['COMBINED', 'XP_ONLY', 'HP_ONLY', 'GP_ONLY'] as const;
const AI_CLASSROOM_BADGE_ASSIGNMENT_MODES = ['MANUAL', 'AUTOMATIC', 'BOTH'] as const;
const AI_CLASSROOM_QUESTION_TYPES = ['TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'MATCHING'] as const;

type AIWizardModuleAction = 'AUTO_CREATE' | 'ENABLE_ON_CREATE' | 'READY_AFTER_CREATE' | 'LOCKED';

type AIWizardModuleDefinition = {
  title: string;
  shortDescription: string;
  actionType: Exclude<AIWizardModuleAction, 'LOCKED'>;
  configurable: boolean;
  autoCreateSupported: boolean;
  defaultRecommended: boolean;
  fallbackReason: string;
};

const AI_WIZARD_MODULES: Record<Feature, AIWizardModuleDefinition> = {
  students: {
    title: 'Estudiantes',
    shortDescription: 'La base del aula para registrar, invitar y organizar a tus estudiantes.',
    actionType: 'READY_AFTER_CREATE',
    configurable: false,
    autoCreateSupported: false,
    defaultRecommended: true,
    fallbackReason: 'Es la base para empezar a usar Juried con tu grupo desde el primer día.',
  },
  behaviors: {
    title: 'Comportamientos',
    shortDescription: 'Acciones positivas y correctivas que Jiro puede preparar por ti.',
    actionType: 'AUTO_CREATE',
    configurable: true,
    autoCreateSupported: true,
    defaultRecommended: true,
    fallbackReason: 'Ayuda a traducir tus reglas y objetivos en acciones claras dentro del aula.',
  },
  rankings: {
    title: 'Rankings',
    shortDescription: 'Visualiza el progreso y la participación de forma inmediata.',
    actionType: 'READY_AFTER_CREATE',
    configurable: false,
    autoCreateSupported: false,
    defaultRecommended: true,
    fallbackReason: 'Te permite mostrar avances y reforzar motivación sin configuración extra.',
  },
  grades: {
    title: 'Calificaciones',
    shortDescription: 'Sistema por competencias para evaluar con más claridad y seguimiento.',
    actionType: 'ENABLE_ON_CREATE',
    configurable: false,
    autoCreateSupported: false,
    defaultRecommended: true,
    fallbackReason: 'Encaja bien cuando quieres seguir evidencias y avances de aprendizaje.',
  },
  settings: {
    title: 'Configuración',
    shortDescription: 'Ajustes iniciales del aula para adaptar Juried a tu estilo docente.',
    actionType: 'READY_AFTER_CREATE',
    configurable: false,
    autoCreateSupported: false,
    defaultRecommended: true,
    fallbackReason: 'Te deja un punto de partida ordenado para personalizar el aula luego.',
  },
  badges: {
    title: 'Insignias',
    shortDescription: 'Reconocimientos que Jiro puede dejar listos según tus metas.',
    actionType: 'AUTO_CREATE',
    configurable: true,
    autoCreateSupported: true,
    defaultRecommended: true,
    fallbackReason: 'Sirve para reconocer logros visibles y sostener motivación en el tiempo.',
  },
  shop: {
    title: 'Tienda',
    shortDescription: 'Recompensas y privilegios para convertir puntos en decisiones significativas.',
    actionType: 'AUTO_CREATE',
    configurable: true,
    autoCreateSupported: true,
    defaultRecommended: true,
    fallbackReason: 'Hace tangible la progresión del aula con recompensas alineadas a tus normas.',
  },
  clans: {
    title: 'Clanes',
    shortDescription: 'Trabajo en equipo y colaboración con identidad compartida.',
    actionType: 'ENABLE_ON_CREATE',
    configurable: true,
    autoCreateSupported: false,
    defaultRecommended: false,
    fallbackReason: 'Conviene cuando tu clase necesita colaboración, apoyo entre pares o retos grupales.',
  },
  attendance: {
    title: 'Asistencia',
    shortDescription: 'Seguimiento diario para mantener ritmo, orden y evidencia.',
    actionType: 'READY_AFTER_CREATE',
    configurable: false,
    autoCreateSupported: false,
    defaultRecommended: false,
    fallbackReason: 'Te ayuda a sostener hábitos y detectar ausencias desde el inicio.',
  },
  collectibles: {
    title: 'Coleccionables',
    shortDescription: 'Progresión visual para reforzar constancia y curiosidad.',
    actionType: 'READY_AFTER_CREATE',
    configurable: false,
    autoCreateSupported: false,
    defaultRecommended: false,
    fallbackReason: 'Agrega una capa de progreso visual que sostiene el interés a mediano plazo.',
  },
  storytelling: {
    title: 'Historia de clase',
    shortDescription: 'Narrativa para que el aula tenga una identidad más memorable.',
    actionType: 'READY_AFTER_CREATE',
    configurable: false,
    autoCreateSupported: false,
    defaultRecommended: false,
    fallbackReason: 'Te permite envolver objetivos del curso en una narrativa más atractiva.',
  },
  expedition: {
    title: 'Expediciones',
    shortDescription: 'Recorridos, misiones y mapas para experiencias más inmersivas.',
    actionType: 'READY_AFTER_CREATE',
    configurable: false,
    autoCreateSupported: false,
    defaultRecommended: false,
    fallbackReason: 'Es útil cuando quieres convertir el contenido en una secuencia exploratoria.',
  },
  question_bank: {
    title: 'Banco de preguntas',
    shortDescription: 'Preguntas listas para evaluación, repaso y actividades.',
    actionType: 'AUTO_CREATE',
    configurable: true,
    autoCreateSupported: true,
    defaultRecommended: true,
    fallbackReason: 'Te da material inmediato para evaluar o dinamizar la clase sin empezar de cero.',
  },
  activities: {
    title: 'Actividades',
    shortDescription: 'Dinámicas interactivas para mover la energía de la clase.',
    actionType: 'READY_AFTER_CREATE',
    configurable: false,
    autoCreateSupported: false,
    defaultRecommended: true,
    fallbackReason: 'Funciona bien para variar ritmo, participación y energía del grupo.',
  },
};

const generateAIClassroomBlueprintSchema = z.object({
  prompt: z.string().min(10).max(2500),
});

const asCleanString = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  return value.trim().replace(/\s+/g, ' ').slice(0, 400);
};

const asParagraph = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  return value.trim().replace(/\s+/g, ' ').slice(0, 1000);
};

const asBoolean = (value: unknown, fallback: boolean) => {
  return typeof value === 'boolean' ? value : fallback;
};

const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const pickEnumValue = <T extends readonly string[]>(value: unknown, options: T, fallback: T[number]) => {
  return typeof value === 'string' && options.includes(value as T[number])
    ? value as T[number]
    : fallback;
};

const normalizeQuestionTypes = (value: unknown) => {
  if (!Array.isArray(value)) {
    return ['TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE'];
  }

  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item === 'string' && AI_CLASSROOM_QUESTION_TYPES.includes(item as typeof AI_CLASSROOM_QUESTION_TYPES[number])) {
      unique.add(item);
    }
  }

  return unique.size > 0 ? Array.from(unique) : ['TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE'];
};

const normalizeRecommendedFeatures = (value: unknown) => {
  if (!Array.isArray(value)) return [] as Feature[];

  const recommended = new Set<Feature>();
  for (const item of value) {
    if (typeof item === 'string' && ALL_FEATURES.includes(item as Feature)) {
      recommended.add(item as Feature);
    }
  }

  return Array.from(recommended);
};

const normalizeFeatureReasons = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return {} as Partial<Record<Feature, string>>;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([featureKey]) => ALL_FEATURES.includes(featureKey as Feature))
    .map(([featureKey, reason]) => [featureKey as Feature, asParagraph(reason)]);

  return Object.fromEntries(entries) as Partial<Record<Feature, string>>;
};

const buildAIWizardModules = (
  unlockedFeatures: string[],
  recommendedFeatures: Feature[],
  featureReasons: Partial<Record<Feature, string>>,
) => {
  return ALL_FEATURES.map((featureKey) => {
    const meta = AI_WIZARD_MODULES[featureKey];
    const available = unlockedFeatures.includes(featureKey);
    return {
      featureKey,
      title: meta.title,
      shortDescription: meta.shortDescription,
      state: available ? 'AVAILABLE' : 'LOCKED',
      actionType: available ? meta.actionType : 'LOCKED',
      configurable: available ? meta.configurable : false,
      autoCreateSupported: available ? meta.autoCreateSupported : false,
      recommended: recommendedFeatures.includes(featureKey) || meta.defaultRecommended,
      reason: featureReasons[featureKey] || meta.fallbackReason,
    };
  });
};

const createClassroomSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(1000).optional(),
  gradeLevel: z.string().max(20).optional(),
  useCompetencies: z.boolean().optional().default(false),
  curriculumAreaId: z.string().max(36).optional().nullable(),
  gradeScaleType: z.enum(['PERU_LETTERS', 'PERU_VIGESIMAL', 'CENTESIMAL', 'USA_LETTERS', 'CUSTOM']).optional().nullable(),
  schoolId: z.string().max(36).optional().nullable(),
});

const updateClassroomSchema = z.object({
  // General
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
  gradeLevel: z.string().max(20).optional().nullable(),
  isActive: z.boolean().optional(),
  
  // Puntos
  defaultXp: z.number().int().min(0).optional(),
  defaultHp: z.number().int().min(0).optional(),
  defaultGp: z.number().int().min(0).optional(),
  maxHp: z.number().int().min(1).optional(),
  xpPerLevel: z.number().int().min(1).optional(),
  allowNegativeHp: z.boolean().optional(),
  
  // Comportamientos
  allowNegativePoints: z.boolean().optional(),
  showReasonToStudent: z.boolean().optional(),
  notifyOnPoints: z.boolean().optional(),
  
  // Tienda
  shopEnabled: z.boolean().optional(),
  requirePurchaseApproval: z.boolean().optional(),
  dailyPurchaseLimit: z.number().int().min(0).optional().nullable(),
  
  // Clases de personaje
  classAssignmentMode: z.enum(['STUDENT_CHOICE', 'TEACHER_ASSIGNS']).optional(),
  
  // Visualización
  showCharacterName: z.boolean().optional(),
  
  // Clanes
  clansEnabled: z.boolean().optional(),
  clanXpPercentage: z.number().int().min(0).max(100).optional(),
  clanBattlesEnabled: z.boolean().optional(),
  clanGpRewardEnabled: z.boolean().optional(),
  
  // Racha de login
  loginStreakEnabled: z.boolean().optional(),
  loginStreakConfig: z.object({
    dailyXp: z.number().int().min(0).default(5),
    milestones: z.array(z.object({
      day: z.number().int().min(1),
      xp: z.number().int().min(0),
      gp: z.number().int().min(0),
      randomItem: z.boolean(),
    })).default([]),
    resetOnMiss: z.boolean().default(true),
    graceDays: z.number().int().min(0).max(7).default(0),
  }).optional().nullable(),
  
  // Competencias
  useCompetencies: z.boolean().optional(),
  curriculumAreaId: z.string().max(36).optional().nullable(),
  gradeScaleType: z.string().max(20).optional().nullable(),
});

const addClassroomCompetenciesSchema = z.object({
  competencyIds: z.array(z.string().max(36)).min(1).max(50),
});

const createCustomClassroomCompetencySchema = z.object({
  name: z.string().min(2).max(255),
  shortName: z.string().max(100).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
});

const updateCustomClassroomCompetencySchema = z.object({
  name: z.string().min(2).max(255).optional(),
  shortName: z.string().max(100).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar',
});

const createCompetencyIndicatorSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(1000).optional().nullable(),
});

const updateCompetencyIndicatorSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar',
});

const transferCompetencyIndicatorsSchema = z.object({
  mode: z.enum(['IMPORT', 'EXPORT']),
  sourceClassroomId: z.string().max(36).optional(),
  targetClassroomIds: z.array(z.string().max(36)).max(50).optional(),
  competencyIds: z.array(z.string().max(36)).max(100).optional(),
  copyMissingCustomCompetencies: z.boolean().optional().default(true),
}).superRefine((data, ctx) => {
  if (data.mode === 'IMPORT' && !data.sourceClassroomId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceClassroomId'],
      message: 'Debes seleccionar una clase de origen',
    });
  }

  if (data.mode === 'EXPORT' && (!data.targetClassroomIds || data.targetClassroomIds.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetClassroomIds'],
      message: 'Debes seleccionar al menos una clase destino',
    });
  }
});

const joinClassroomSchema = z.object({
  code: z.string().length(6),
  characterName: z.string().min(2).max(100),
  characterClass: z.enum(['GUARDIAN', 'ARCANE', 'EXPLORER', 'ALCHEMIST']),
});

export class ClassroomController {
  async generateAIClassroomBlueprint(req: Request, res: Response) {
    try {
      const { prompt } = generateAIClassroomBlueprintSchema.parse(req.body);

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: 'API Key de Gemini no configurada',
        });
      }

      let onboardingRecord = await onboardingService.get(req.user!.id);
      if (!onboardingRecord) {
        const created = await onboardingService.create(req.user!.id);
        onboardingRecord = { ...created, level: 'Principiante' };
      }

      const unlockedFeatures = onboardingRecord.isExperienced
        ? [...ALL_FEATURES]
        : [...(onboardingRecord.unlockedFeatures || [])];
      const lockedFeatures = onboardingService.getLockedFeatures(unlockedFeatures);

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: `Eres Jiro, la mascota y guía pedagógica de Juried. Tu trabajo es acompañar a un profesor a crear su clase con una propuesta inicial clara, accionable y cálida.

CONTEXTO DEL PROFESOR:
${prompt}

FEATURES DISPONIBLES HOY EN SU CUENTA:
${unlockedFeatures.join(', ') || 'ninguna'}

FEATURES BLOQUEADAS TEMPORALMENTE:
${lockedFeatures.join(', ') || 'ninguna'}

Necesito que devuelvas SOLO un JSON válido con esta forma exacta:
{
  "introMessage": "mensaje breve de Jiro en primera persona, 1-2 frases",
  "classroom": {
    "name": "nombre sugerido para la clase",
    "description": "descripción breve y concreta",
    "subject": "uno de: matematicas, comunicacion, ciencias, historia, ingles, arte, educacion_fisica, tecnologia, o cadena vacía",
    "gradeLevel": "uno de: inicial, primaria_baja, primaria_alta, secundaria_baja, secundaria_alta, preparatoria, universidad, o cadena vacía",
    "educationLevel": "uno de: PRIMARIA, SECUNDARIA, o cadena vacía",
    "useCompetencies": true,
    "curriculumAreaName": "nombre sugerido de área curricular o cadena vacía",
    "gradeScaleType": "uno de: PERU_LETTERS, PERU_VIGESIMAL, CENTESIMAL, USA_LETTERS, CUSTOM",
    "objective": "frase corta con el principal objetivo pedagógico"
  },
  "settings": {
    "allowNegativePoints": true,
    "showReasonToStudent": true,
    "notifyOnPoints": true,
    "classAssignmentMode": "STUDENT_CHOICE o TEACHER_ASSIGNS",
    "showCharacterName": true,
    "requirePurchaseApproval": false
  },
  "generationPlan": {
    "behaviors": {
      "description": "qué debería evaluar el profesor",
      "count": 10,
      "pointMode": "COMBINED",
      "includePositive": true,
      "includeNegative": true
    },
    "badges": {
      "description": "qué logros reconocer",
      "count": 8,
      "assignmentMode": "MANUAL"
    },
    "shop": {
      "description": "qué recompensas o privilegios incluir",
      "count": 8
    },
    "questions": {
      "questionBankName": "nombre del banco",
      "description": "temas clave a evaluar",
      "count": 12,
      "questionTypes": ["TRUE_FALSE", "SINGLE_CHOICE"]
    }
  },
  "recommendedFeatures": ["students", "behaviors", "rankings"],
  "featureReasons": {
    "students": "una razón breve",
    "behaviors": "una razón breve",
    "rankings": "una razón breve",
    "grades": "una razón breve",
    "settings": "una razón breve",
    "badges": "una razón breve",
    "shop": "una razón breve",
    "clans": "una razón breve",
    "attendance": "una razón breve",
    "collectibles": "una razón breve",
    "storytelling": "una razón breve",
    "expedition": "una razón breve",
    "question_bank": "una razón breve",
    "activities": "una razón breve"
  }
}

REGLAS:
- Escribe todo en español.
- No incluyas markdown, comentarios ni texto fuera del JSON.
- introMessage debe sonar a acompañamiento de Jiro, no a un sistema genérico.
- recommendedFeatures debe usar SOLO keys válidas de Juried.
- Si el contexto no alcanza para inferir subject o gradeLevel, devuelve cadena vacía.
- useCompetencies solo debe ser true si realmente aporta al caso.
- gradeScaleType debe ser PERU_LETTERS cuando useCompetencies sea true y no exista una razón clara para otra escala.
- behaviors.count entre 6 y 18.
- badges.count entre 4 y 12.
- shop.count entre 4 y 12.
- questions.count entre 8 y 20.
- pointMode solo puede ser COMBINED, XP_ONLY, HP_ONLY o GP_ONLY.
- assignmentMode solo puede ser MANUAL, AUTOMATIC o BOTH.
- questionTypes solo puede incluir TRUE_FALSE, SINGLE_CHOICE, MULTIPLE_CHOICE, MATCHING.
- Cada featureReason debe tener máximo 18 palabras y explicar el valor pedagógico o práctico de esa feature.`,
      });

      const responseText = response.text || '';
      if (!responseText.trim()) {
        return res.status(500).json({
          success: false,
          message: 'La IA no generó una propuesta de clase',
        });
      }

      let parsed: any;
      try {
        let cleanText = responseText.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        parsed = JSON.parse(cleanText);
      } catch (parseError) {
        console.error('Error parsing AI classroom blueprint:', responseText);
        return res.status(500).json({
          success: false,
          message: 'Error al procesar la propuesta de Jiro',
        });
      }

      const recommendedFeatures = normalizeRecommendedFeatures(parsed?.recommendedFeatures);
      const featureReasons = normalizeFeatureReasons(parsed?.featureReasons);

      const blueprint = {
        introMessage: asParagraph(parsed?.introMessage, 'Cuéntame un poco más de tu clase y yo me encargo de proponerte un buen punto de partida.'),
        classroom: {
          name: asCleanString(parsed?.classroom?.name, 'Nueva clase con Jiro'),
          description: asParagraph(parsed?.classroom?.description),
          subject: pickEnumValue(parsed?.classroom?.subject, AI_CLASSROOM_SUBJECTS, ''),
          gradeLevel: pickEnumValue(parsed?.classroom?.gradeLevel, AI_CLASSROOM_GRADE_LEVELS, ''),
          educationLevel: pickEnumValue(parsed?.classroom?.educationLevel, AI_CLASSROOM_EDUCATION_LEVELS, ''),
          useCompetencies: asBoolean(parsed?.classroom?.useCompetencies, false),
          curriculumAreaName: asCleanString(parsed?.classroom?.curriculumAreaName),
          gradeScaleType: pickEnumValue(parsed?.classroom?.gradeScaleType, AI_CLASSROOM_GRADE_SCALE_TYPES, 'PERU_LETTERS'),
          objective: asParagraph(parsed?.classroom?.objective, 'Organizar una experiencia de clase clara, motivadora y útil desde el inicio.'),
        },
        settings: {
          allowNegativePoints: asBoolean(parsed?.settings?.allowNegativePoints, true),
          showReasonToStudent: asBoolean(parsed?.settings?.showReasonToStudent, true),
          notifyOnPoints: asBoolean(parsed?.settings?.notifyOnPoints, true),
          classAssignmentMode: pickEnumValue(parsed?.settings?.classAssignmentMode, ['STUDENT_CHOICE', 'TEACHER_ASSIGNS'] as const, 'STUDENT_CHOICE'),
          showCharacterName: asBoolean(parsed?.settings?.showCharacterName, true),
          requirePurchaseApproval: asBoolean(parsed?.settings?.requirePurchaseApproval, false),
        },
        generationPlan: {
          behaviors: {
            description: asParagraph(parsed?.generationPlan?.behaviors?.description, 'Participación, responsabilidad, convivencia y hábitos de aprendizaje.'),
            count: clampNumber(parsed?.generationPlan?.behaviors?.count, 6, 18, 10),
            pointMode: pickEnumValue(parsed?.generationPlan?.behaviors?.pointMode, AI_CLASSROOM_POINT_MODES, 'COMBINED'),
            includePositive: asBoolean(parsed?.generationPlan?.behaviors?.includePositive, true),
            includeNegative: asBoolean(parsed?.generationPlan?.behaviors?.includeNegative, true),
          },
          badges: {
            description: asParagraph(parsed?.generationPlan?.badges?.description, 'Constancia, colaboración, progreso y logros visibles para el grupo.'),
            count: clampNumber(parsed?.generationPlan?.badges?.count, 4, 12, 8),
            assignmentMode: pickEnumValue(parsed?.generationPlan?.badges?.assignmentMode, AI_CLASSROOM_BADGE_ASSIGNMENT_MODES, 'MANUAL'),
          },
          shop: {
            description: asParagraph(parsed?.generationPlan?.shop?.description, 'Privilegios y recompensas que tengan sentido para el ritmo de esta clase.'),
            count: clampNumber(parsed?.generationPlan?.shop?.count, 4, 12, 8),
          },
          questions: {
            questionBankName: asCleanString(parsed?.generationPlan?.questions?.questionBankName, 'Banco inicial de la clase'),
            description: asParagraph(parsed?.generationPlan?.questions?.description, 'Repaso diagnóstico y preguntas base alineadas al foco del curso.'),
            count: clampNumber(parsed?.generationPlan?.questions?.count, 8, 20, 12),
            questionTypes: normalizeQuestionTypes(parsed?.generationPlan?.questions?.questionTypes),
          },
        },
        modules: buildAIWizardModules(unlockedFeatures, recommendedFeatures, featureReasons),
        unlockedFeatures,
        lockedFeatures,
        onboarding: {
          isExperienced: onboardingRecord.isExperienced,
          level: onboardingRecord.level,
        },
      };

      res.json({
        success: true,
        data: blueprint,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }

      console.error('Error generating AI classroom blueprint:', error);
      res.status(500).json({
        success: false,
        message: 'Error al generar la propuesta de clase con IA',
      });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const data = createClassroomSchema.parse(req.body);
      const classroom = await classroomService.create({
        ...data,
        teacherId: req.user!.id,
      });

      res.status(201).json({
        success: true,
        message: 'Clase creada exitosamente',
        data: classroom,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al crear la clase',
      });
    }
  }

  async getMyClassrooms(req: Request, res: Response) {
    try {
      const classrooms = await classroomService.getByTeacher(req.user!.id);
      res.json({
        success: true,
        data: classrooms,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener las clases',
      });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const classroom = await classroomService.getById(id);
      
      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: 'Clase no encontrada',
        });
      }

      // Verificar que el usuario tenga acceso a esta clase
      if (classroom.teacherId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a esta clase',
        });
      }

      const students = await classroomService.getStudents(id);

      res.json({
        success: true,
        data: { ...classroom, students },
      });
    } catch (error) {
      console.error('Error getting classroom:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener la clase',
      });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = updateClassroomSchema.parse(req.body);
      const classroom = await classroomService.update(id, req.user!.id, data as any);

      res.json({
        success: true,
        message: 'Clase actualizada',
        data: classroom,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }
      if (error instanceof Error && error.message === 'No autorizado') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para editar esta clase',
        });
      }
      console.error('Error updating classroom:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar la clase',
      });
    }
  }

  async syncCompetencies(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const classroom = await classroomService.getById(id);
      
      if (!classroom || classroom.teacherId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para esta clase',
        });
      }

      if (!classroom.useCompetencies || !classroom.curriculumAreaId) {
        return res.status(400).json({
          success: false,
          message: 'La clase no tiene competencias habilitadas o no tiene área curricular',
        });
      }

      const result = await classroomService.syncClassroomCompetencies(id, classroom.curriculumAreaId);

      res.json({
        success: true,
        message: `Competencias sincronizadas: ${result?.created || 0} creadas de ${result?.total || 0}`,
        data: result,
      });
    } catch (error) {
      console.error('Error syncing competencies:', error);
      res.status(500).json({
        success: false,
        message: 'Error al sincronizar competencias',
      });
    }
  }

  async getCompetencies(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const classroom = await classroomService.getById(id);

      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: 'Clase no encontrada',
        });
      }

      if (req.user!.role === 'TEACHER' && classroom.teacherId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para esta clase',
        });
      }

      if (req.user!.role === 'STUDENT') {
        const [profile] = await db
          .select({ id: studentProfiles.id })
          .from(studentProfiles)
          .where(and(
            eq(studentProfiles.userId, req.user!.id),
            eq(studentProfiles.classroomId, id),
            eq(studentProfiles.isActive, true),
          ));

        if (!profile) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permiso para esta clase',
          });
        }
      }

      const competencies = await classroomService.getEnabledCompetencies(id);

      res.json({
        success: true,
        data: competencies,
      });
    } catch (error) {
      console.error('Error getting classroom competencies:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener competencias del aula',
      });
    }
  }

  async addCompetencies(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = addClassroomCompetenciesSchema.parse(req.body);
      const classroom = await classroomService.getById(id);

      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: 'Clase no encontrada',
        });
      }

      if (classroom.teacherId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para esta clase',
        });
      }

      const result = await classroomService.addCompetencies(id, data.competencyIds);

      res.json({
        success: true,
        message: result.created > 0
          ? `${result.created} competencia(s) agregada(s) al aula`
          : 'No se agregaron competencias nuevas',
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }

      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      console.error('Error adding classroom competencies:', error);
      res.status(500).json({
        success: false,
        message: 'Error al agregar competencias al aula',
      });
    }
  }

  async removeCompetency(req: Request, res: Response) {
    try {
      const { id, competencyId } = req.params;
      const classroom = await classroomService.getById(id);

      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: 'Clase no encontrada',
        });
      }

      if (classroom.teacherId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para esta clase',
        });
      }

      await classroomService.removeCompetency(id, competencyId, req.user!.id);

      res.json({
        success: true,
        message: 'Competencia adicional retirada del aula',
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      console.error('Error removing classroom competency:', error);
      res.status(500).json({
        success: false,
        message: 'Error al retirar competencia del aula',
      });
    }
  }

  async createCustomCompetency(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = createCustomClassroomCompetencySchema.parse(req.body);
      const classroom = await classroomService.getById(id);

      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: 'Clase no encontrada',
        });
      }

      if (classroom.teacherId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para esta clase',
        });
      }

      const competency = await classroomService.createCustomCompetency(id, req.user!.id, data);

      res.status(201).json({
        success: true,
        message: 'Competencia personalizada creada',
        data: competency,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }

      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      console.error('Error creating custom classroom competency:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear competencia personalizada',
      });
    }
  }

  async updateCustomCompetency(req: Request, res: Response) {
    try {
      const { id, competencyId } = req.params;
      const data = updateCustomClassroomCompetencySchema.parse(req.body);
      const classroom = await classroomService.getById(id);

      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: 'Clase no encontrada',
        });
      }

      if (classroom.teacherId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para esta clase',
        });
      }

      const competency = await classroomService.updateCustomCompetency(id, competencyId, req.user!.id, data);

      res.json({
        success: true,
        message: 'Competencia personalizada actualizada',
        data: competency,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }

      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      console.error('Error updating custom classroom competency:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar competencia personalizada',
      });
    }
  }

  async deleteCustomCompetency(req: Request, res: Response) {
    try {
      const { id, competencyId } = req.params;
      const classroom = await classroomService.getById(id);

      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: 'Clase no encontrada',
        });
      }

      if (classroom.teacherId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para esta clase',
        });
      }

      await classroomService.deleteCustomCompetency(id, competencyId, req.user!.id);

      res.json({
        success: true,
        message: 'Competencia personalizada eliminada',
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      console.error('Error deleting custom classroom competency:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar competencia personalizada',
      });
    }
  }

  async createCompetencyIndicator(req: Request, res: Response) {
    try {
      const { id, competencyId } = req.params;
      const data = createCompetencyIndicatorSchema.parse(req.body);
      const classroom = await classroomService.getById(id);

      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: 'Clase no encontrada',
        });
      }

      if (classroom.teacherId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para esta clase',
        });
      }

      const indicator = await classroomService.createCompetencyIndicator(id, competencyId, req.user!.id, data);

      res.status(201).json({
        success: true,
        message: 'Destreza creada',
        data: indicator,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }

      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      console.error('Error creating competency indicator:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear destreza',
      });
    }
  }

  async updateCompetencyIndicator(req: Request, res: Response) {
    try {
      const { id, competencyId, indicatorId } = req.params;
      const data = updateCompetencyIndicatorSchema.parse(req.body);
      const classroom = await classroomService.getById(id);

      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: 'Clase no encontrada',
        });
      }

      if (classroom.teacherId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para esta clase',
        });
      }

      const indicator = await classroomService.updateCompetencyIndicator(id, competencyId, indicatorId, req.user!.id, data);

      res.json({
        success: true,
        message: 'Destreza actualizada',
        data: indicator,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }

      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      console.error('Error updating competency indicator:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar destreza',
      });
    }
  }

  async deleteCompetencyIndicator(req: Request, res: Response) {
    try {
      const { id, competencyId, indicatorId } = req.params;
      const classroom = await classroomService.getById(id);

      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: 'Clase no encontrada',
        });
      }

      if (classroom.teacherId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para esta clase',
        });
      }

      await classroomService.deleteCompetencyIndicator(id, competencyId, indicatorId, req.user!.id);

      res.json({
        success: true,
        message: 'Destreza eliminada',
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      console.error('Error deleting competency indicator:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar destreza',
      });
    }
  }

  async transferCompetencyIndicators(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = transferCompetencyIndicatorsSchema.parse(req.body);
      const classroom = await classroomService.getById(id);

      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: 'Clase no encontrada',
        });
      }

      if (classroom.teacherId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para esta clase',
        });
      }

      const result = await classroomService.transferCompetencyIndicators(id, req.user!.id, data);

      res.json({
        success: true,
        message: data.mode === 'IMPORT' ? 'Destrezas importadas' : 'Destrezas exportadas',
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }

      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      console.error('Error transferring competency indicators:', error);
      res.status(500).json({
        success: false,
        message: 'Error al transferir destrezas',
      });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await classroomService.delete(id, req.user!.id);

      res.json({
        success: true,
        message: 'Clase eliminada',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'No autorizado') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para eliminar esta clase',
        });
      }
      console.error('Error deleting classroom:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar la clase',
      });
    }
  }

  async resetAllPoints(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await classroomService.resetAllPoints(id, req.user!.id);

      res.json({
        success: true,
        message: 'Puntos de todos los estudiantes reseteados',
        data: result,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'No autorizado') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para esta acción',
        });
      }
      console.error('Error resetting points:', error);
      res.status(500).json({
        success: false,
        message: 'Error al resetear puntos',
      });
    }
  }

  async resetClassroomSelective(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const options = req.body || {};
      const result = await classroomService.resetClassroomSelective(id, req.user!.id, options);

      res.json({
        success: true,
        message: 'Clase reseteada correctamente',
        data: result,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'No autorizado') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para esta acción',
        });
      }
      console.error('Error resetting classroom:', error);
      res.status(500).json({
        success: false,
        message: 'Error al resetear la clase',
      });
    }
  }

  async join(req: Request, res: Response) {
    try {
      const data = joinClassroomSchema.parse(req.body);
      const result = await classroomService.joinByCode(
        data.code,
        req.user!.id,
        data.characterName,
        data.characterClass
      );

      res.status(201).json({
        success: true,
        message: `Te has unido a ${result.classroom.name}`,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al unirse a la clase',
      });
    }
  }

  async getCurriculumAreas(req: Request, res: Response) {
    try {
      const countryCode = (req.query.country as string) || 'PE';
      const level = req.query.level as string | undefined; // 'PRIMARIA' | 'SECUNDARIA'
      
      // Construir condiciones de filtro
      const conditions = [eq(curriculumAreas.countryCode, countryCode)];
      if (level === 'PRIMARIA' || level === 'SECUNDARIA') {
        conditions.push(
          or(
            isNull(curriculumAreas.educationLevel),
            eq(curriculumAreas.educationLevel, level)
          )!
        );
      }

      // Obtener áreas
      const areas = await db
        .select()
        .from(curriculumAreas)
        .where(and(...conditions))
        .orderBy(curriculumAreas.displayOrder);

      // Obtener competencias para cada área
      const areasWithCompetencies = await Promise.all(
        areas.map(async (area) => {
          const competencies = await db
            .select()
            .from(curriculumCompetencies)
            .where(and(
              eq(curriculumCompetencies.areaId, area.id),
              eq(curriculumCompetencies.isActive, true),
              eq(curriculumCompetencies.sourceType, 'OFFICIAL'),
            ))
            .orderBy(curriculumCompetencies.displayOrder);
          return {
            ...area,
            competencies,
          };
        })
      );

      res.json({
        success: true,
        data: areasWithCompetencies,
      });
    } catch (error) {
      console.error('Error getting curriculum areas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener áreas curriculares',
      });
    }
  }

  async generateAIContent(req: Request, res: Response) {
    try {
      const { 
        section, context, description, count,
        pointMode, includePositive, includeNegative,
        assignmentMode, types, questionTypes,
        competencies, behaviors 
      } = req.body;

      if (!section || !context) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere sección y contexto',
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: 'API Key de Gemini no configurada',
        });
      }

      let prompt = '';
      const itemCount = count || 10;

      const includePos = includePositive !== false;
      const includeNeg = includeNegative !== false;
      const behaviorMix = includePos && includeNeg ? 'una mezcla de comportamientos POSITIVOS y NEGATIVOS' : includePos ? 'SOLO comportamientos POSITIVOS' : 'SOLO comportamientos NEGATIVOS';
      const pointModeDesc = pointMode === 'COMBINED' ? 'Usa combinaciones de XP, HP y GP según corresponda' : pointMode === 'XP_ONLY' ? 'Usa SOLO XP (xpValue), deja hpValue y gpValue en 0' : pointMode === 'HP_ONLY' ? 'Usa SOLO HP (hpValue), deja xpValue y gpValue en 0' : 'Usa SOLO GP (gpValue), deja xpValue y hpValue en 0';

      // Preparar contexto de competencias si existen
      const competenciesContext = competencies && competencies.length > 0
        ? `\n\nCOMPETENCIAS CURRICULARES DISPONIBLES:\n${competencies.map((c: any, i: number) => `${i + 1}. "${c.name}" (ID: ${c.id})`).join('\n')}\n\nIMPORTANTE: Cada comportamiento DEBE estar ligado a una de estas competencias usando el campo "competencyId".`
        : '';

      // Preparar contexto de comportamientos para insignias
      const behaviorsContext = behaviors && behaviors.length > 0
        ? `\n\nCOMPORTAMIENTOS DISPONIBLES EN LA CLASE:\n${behaviors.map((b: string, i: number) => `${i + 1}. "${b}"`).join('\n')}\n\nIMPORTANTE: Las condiciones de activación (triggerCondition) DEBEN referenciar estos comportamientos específicos.`
        : '';

      switch (section) {
        case 'behaviors':
          const hasCompetencies = competencies && competencies.length > 0;
          const firstCompetencyId = hasCompetencies ? competencies[0].id : '';
          const competencyField = hasCompetencies
            ? `\n    "competencyId": "${firstCompetencyId}",`
            : '';
          const competencyRule = hasCompetencies
            ? `\n6. OBLIGATORIO: Usa el campo "competencyId" con el ID EXACTO de una competencia de la lista (ej: "${firstCompetencyId}"). NO inventes IDs.`
            : '';
          
          prompt = `Eres un experto en gamificación educativa. Genera ${itemCount} comportamientos para una clase.

CONTEXTO:
${context}

DESCRIPCIÓN ADICIONAL DEL PROFESOR:
${description || 'Genera comportamientos variados apropiados para esta clase'}
${competenciesContext}

Genera ${behaviorMix}.
${pointModeDesc}

Responde ÚNICAMENTE con un array JSON válido:
[
  {
    "name": "Nombre corto (máx 40 caracteres)",
    "description": "Descripción breve",
    "isPositive": true,
    "xpValue": 10,
    "hpValue": 0,
    "gpValue": 5,
    "icon": "⭐"${competencyField}
  }
]

REGLAS:
1. Positivos: XP 5-30, GP 0-15, HP generalmente 0
2. Negativos: HP 5-25 (daño a la vida), XP 0, GP 0-10 (multa opcional)
3. Iconos: ⭐🎯📚✅🏆💪🧠❤️💔⚡🔥❌😴📵🤝👏💡🎨🔬📝✋🙋
4. Nombres en español, apropiados al nivel
5. isPositive=true para premiar, isPositive=false para penalizar${competencyRule}`;
          break;

        case 'badges':
          const badgeMode = assignmentMode || 'MANUAL';
          const badgeModeDesc = badgeMode === 'MANUAL' ? 'MANUAL (el profesor las asigna manualmente)' : badgeMode === 'AUTOMATIC' ? 'AUTOMATIC (se asignan automáticamente al cumplir condiciones basadas en comportamientos)' : 'BOTH (pueden ser manuales o automáticas)';
          
          // Contexto de competencias para insignias
          const badgeHasCompetencies = competencies && competencies.length > 0;
          const badgeFirstCompetencyId = badgeHasCompetencies ? competencies[0].id : '';
          
          const badgeCompetenciesContext = badgeHasCompetencies
            ? `\n\nCOMPETENCIAS CURRICULARES DISPONIBLES:\n${competencies.map((c: any, i: number) => `${i + 1}. "${c.name}" (ID: ${c.id})`).join('\n')}\n\nIMPORTANTE: Cada insignia DEBE estar ligada a una de estas competencias usando el campo "competencyId" con el ID EXACTO.`
            : '';
          
          const competencyBadgeField = badgeHasCompetencies
            ? `\n    "competencyId": "${badgeFirstCompetencyId}",`
            : '';
          
          const competencyBadgeRule = badgeHasCompetencies
            ? `\n7. OBLIGATORIO: Usa el campo "competencyId" con el ID EXACTO de una competencia de la lista (ej: "${badgeFirstCompetencyId}"). NO inventes IDs.`
            : '';

          // Para modo AUTOMATIC, forzar uso exclusivo de comportamientos existentes
          const hasBehaviors = behaviors && behaviors.length > 0;
          const behaviorsList = hasBehaviors ? behaviors.map((b: string) => `"${b}"`).join(', ') : '';
          
          const automaticModeWarning = (badgeMode === 'AUTOMATIC' || badgeMode === 'BOTH') && hasBehaviors
            ? `\n\n⚠️ CRÍTICO PARA MODO AUTOMÁTICO:
Las insignias automáticas se desbloquean cuando el estudiante ACUMULA un comportamiento específico.
SOLO puedes usar estos comportamientos EXACTOS en triggerCondition: ${behaviorsList}

Formato OBLIGATORIO de triggerCondition: "Obtener X veces '[NOMBRE EXACTO DEL COMPORTAMIENTO]'"
Ejemplos CORRECTOS:
- "Obtener 5 veces '${behaviors[0]}'"
- "Obtener 3 veces '${behaviors[Math.min(1, behaviors.length - 1)]}'"

PROHIBIDO inventar condiciones como "Entregar tareas", "Completar proyectos", etc.
Si no hay comportamiento apropiado, usa uno de los disponibles de todas formas.`
            : '';
          
          prompt = `Eres un experto en gamificación educativa. Genera ${itemCount} insignias para una clase.

CONTEXTO:
${context}

DESCRIPCIÓN ADICIONAL:
${description || 'Genera insignias variadas para reconocer diferentes logros'}
${behaviorsContext}${badgeCompetenciesContext}${automaticModeWarning}

MODO DE ASIGNACIÓN: ${badgeModeDesc}

Responde ÚNICAMENTE con un array JSON válido:
[
  {
    "name": "Nombre de la insignia",
    "description": "Qué logro reconoce",
    "icon": "🏆",
    "rarity": "COMMON",
    "assignmentMode": "${badgeMode}",
    "triggerCondition": "Obtener X veces '[NOMBRE EXACTO DE COMPORTAMIENTO DE LA LISTA]'",${competencyBadgeField}
    "rewardXp": 50,
    "rewardGp": 20
  }
]

REGLAS:
1. Rarezas: COMMON (50%), RARE (30%), EPIC (15%), LEGENDARY (5%)
2. Recompensas según rareza:
   - COMMON: XP 20-50, GP 10-20 (requiere 3-5 veces el comportamiento)
   - RARE: XP 50-100, GP 20-50 (requiere 5-8 veces)
   - EPIC: XP 100-200, GP 50-100 (requiere 8-12 veces)
   - LEGENDARY: XP 200-500, GP 100-200 (requiere 15+ veces)
3. Iconos: 🏆⭐🎖️💎👑🎯🔥💪📚✨🎓🚀🌟💡🎨🔬🏅🥇🥈🥉
4. Nombres creativos en español relacionados con el comportamiento
5. SIEMPRE incluir "assignmentMode": "${badgeMode}" en cada insignia
6. Para AUTOMATIC/BOTH: triggerCondition DEBE usar EXACTAMENTE un nombre de comportamiento de la lista proporcionada. NO INVENTES condiciones.${competencyBadgeRule}`;
          break;

        case 'missions':
          const missionTypesArr = types && types.length > 0 ? types : ['DAILY', 'WEEKLY', 'SPECIAL'];
          const missionTypesStr = missionTypesArr.join(', ');
          prompt = `Eres un experto en gamificación educativa. Genera ${itemCount} misiones para una clase.

CONTEXTO:
${context}

DESCRIPCIÓN ADICIONAL:
${description || 'Genera misiones variadas con diferentes objetivos'}

TIPOS DE MISIÓN A GENERAR: ${missionTypesStr}

Responde ÚNICAMENTE con un array JSON válido:
[
  {
    "name": "Título de la misión",
    "description": "Descripción del objetivo",
    "xpReward": 100,
    "gpReward": 50,
    "type": "DAILY",
    "category": "ACADEMIC",
    "objectiveType": "CUSTOM",
    "icon": "🎯"
  }
]

REGLAS:
1. Tipos permitidos: ${missionTypesStr}
   - DAILY: misiones para completar en un día
   - WEEKLY: misiones para completar en una semana
   - SPECIAL: misiones especiales o de proyecto
2. Categorías: ACADEMIC (tareas), PARTICIPATION, BEHAVIOR, SOCIAL, CUSTOM
3. objectiveType: COMPLETE_BEHAVIORS, EARN_XP, EARN_GP, REACH_LEVEL, COLLECT_BADGES, CUSTOM
4. Recompensas: XP 50-300, GP 20-100
5. Títulos creativos y motivadores en español
6. Iconos: 🎯📅📆⭐🏆💪📚✨🎓🚀🌟💡🎨🔬🏅`;
          break;

        case 'shop':
          prompt = `Eres un experto en gamificación educativa. Genera ${itemCount} artículos de tienda para una clase.

CONTEXTO:
${context}

DESCRIPCIÓN ADICIONAL:
${description || 'Genera artículos variados: privilegios, recompensas y poderes especiales'}

Responde ÚNICAMENTE con un array JSON válido:
[
  {
    "name": "Nombre del artículo",
    "description": "Qué obtiene el estudiante",
    "icon": "🎁",
    "category": "CONSUMABLE",
    "rarity": "COMMON",
    "price": 50
  }
]

REGLAS:
1. Categorías: CONSUMABLE (uso único), SPECIAL (poderes especiales)
2. Rarezas: COMMON, RARE, LEGENDARY
3. Precios según rareza:
   - COMMON: 20-80 GP
   - RARE: 80-200 GP
   - LEGENDARY: 200-500 GP
4. Tipos de artículos:
   - Privilegios: elegir asiento, tiempo extra, entregar tarde
   - Recompensas: stickers, certificados, tiempo libre
   - Poderes: escudo HP, bonus XP, duplicar puntos
5. Iconos: 🎁⭐💎🏆🎭👑🔮⚡🌟💺⏰🛡️🎵📱🎮🍬✨💫🎪`;
          break;

        case 'questions':
          const qTypes = questionTypes && questionTypes.length > 0 ? questionTypes : ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'];
          const qTypesStr = qTypes.join(', ');
          prompt = `Eres un experto educativo. Genera un banco de preguntas para una clase.

CONTEXTO:
${context}

TEMAS A EVALUAR:
${description || 'Genera preguntas generales apropiadas para la asignatura y nivel'}

TIPOS DE PREGUNTA A GENERAR: ${qTypesStr}

Responde ÚNICAMENTE con un objeto JSON válido:
{
  "name": "Banco de Preguntas - [Tema]",
  "description": "Descripción del banco",
  "questions": [
    {
      "questionText": "¿Texto de la pregunta?",
      "type": "SINGLE_CHOICE",
      "options": [{"text": "Opción A", "isCorrect": true}, {"text": "Opción B", "isCorrect": false}],
      "points": 10,
      "difficulty": "MEDIUM",
      "explanation": "Explicación educativa de por qué la respuesta correcta es correcta"
    }
  ]
}

REGLAS:
1. Genera ${itemCount} preguntas variadas
2. TIPOS PERMITIDOS: ${qTypesStr}
   - TRUE_FALSE: pregunta de verdadero/falso con 2 opciones
   - SINGLE_CHOICE: una sola respuesta correcta (4 opciones)
   - MULTIPLE_CHOICE: múltiples respuestas correctas (4 opciones)
   - MATCHING: pares para relacionar (4-6 pares)
3. Para MATCHING: options = [{"text": "A", "isCorrect": false, "matchWith": "1"}, {"text": "1", "isCorrect": true, "matchWith": "A"}]
4. Dificultades: EASY (30%), MEDIUM (50%), HARD (20%)
5. Puntos: EASY 5-10, MEDIUM 10-20, HARD 20-30
6. Distribuir proporcionalmente entre los tipos solicitados
7. Usa "questionText" (no "question") para el texto
8. En options usa objetos con "text" e "isCorrect"
9. IMPORTANTE: Incluye siempre "explanation" con una explicación educativa clara de la respuesta correcta`;
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Sección no válida',
          });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: prompt,
      });

      const responseText = response.text || '';

      if (!responseText.trim()) {
        return res.status(500).json({
          success: false,
          message: 'La IA no generó contenido',
        });
      }

      let parsedData;
      try {
        let cleanText = responseText.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        parsedData = JSON.parse(cleanText);
      } catch (parseError) {
        console.error('Error parsing AI response:', responseText);
        return res.status(500).json({
          success: false,
          message: 'Error al procesar la respuesta de la IA',
        });
      }

      res.json({
        success: true,
        data: section === 'questions' ? parsedData : { items: parsedData },
      });

    } catch (error: any) {
      console.error('Error generating AI content:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al generar contenido con IA',
      });
    }
  }

  // Obtener cantidades de elementos clonables
  async getCloneableCounts(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user) {
        return res.status(401).json({ success: false, message: 'No autenticado' });
      }

      const { classroomId } = req.params;
      const counts = await classroomService.getCloneableCounts(classroomId);

      res.json({
        success: true,
        data: counts,
      });
    } catch (error: any) {
      console.error('Error getting cloneable counts:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener conteos',
      });
    }
  }

  // Clonar aula
  async cloneClassroom(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user) {
        return res.status(401).json({ success: false, message: 'No autenticado' });
      }

      const { classroomId } = req.params;
      const { name, description, copyBehaviors, copyBadges, copyShopItems, copyQuestionBanks, schoolId } = req.body;

      if (!name || name.trim().length < 2) {
        return res.status(400).json({ 
          success: false, 
          message: 'El nombre del aula es requerido (mínimo 2 caracteres)' 
        });
      }

      const result = await classroomService.cloneClassroom(classroomId, user.id, {
        name: name.trim(),
        description: description?.trim(),
        copyBehaviors: copyBehaviors ?? true,
        copyBadges: copyBadges ?? true,
        copyShopItems: copyShopItems ?? true,
        copyQuestionBanks: copyQuestionBanks ?? true,
        schoolId: schoolId || null,
      });

      res.json({
        success: true,
        data: result,
        message: 'Aula clonada exitosamente',
      });
    } catch (error: any) {
      console.error('Error cloning classroom:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al clonar el aula',
      });
    }
  }
}

export const classroomController = new ClassroomController();
