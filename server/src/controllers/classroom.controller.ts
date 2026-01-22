import type { Request, Response } from 'express';
import { classroomService } from '../services/classroom.service.js';
import { db } from '../db/index.js';
import { curriculumAreas, curriculumCompetencies } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

const createClassroomSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(1000).optional(),
  gradeLevel: z.string().max(20).optional(),
  useCompetencies: z.boolean().optional().default(false),
  curriculumAreaId: z.string().max(36).optional().nullable(),
  gradeScaleType: z.enum(['PERU_LETTERS', 'PERU_VIGESIMAL', 'CENTESIMAL', 'USA_LETTERS', 'CUSTOM']).optional().nullable(),
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
});

const joinClassroomSchema = z.object({
  code: z.string().length(6),
  characterName: z.string().min(2).max(100),
  characterClass: z.enum(['GUARDIAN', 'ARCANE', 'EXPLORER', 'ALCHEMIST']),
});

export class ClassroomController {
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
      // Si es una clase de escuela (B2B), verificar permisos de escuela
      if (classroom.schoolId) {
        const { schoolService } = await import('../services/school.service.js');
        const member = await schoolService.getMemberByUserId(classroom.schoolId, userId);
        if (!member) {
          return res.status(403).json({
            success: false,
            message: 'No tienes acceso a esta clase',
          });
        }
        // Si es profesor (no admin), verificar que sea el profesor asignado
        const isAdmin = member.role === 'OWNER' || member.role === 'ADMIN';
        if (!isAdmin && classroom.teacherId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes acceso a esta clase',
          });
        }
      } else {
        // Clase B2C: solo el profesor dueño puede acceder
        if (classroom.teacherId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes acceso a esta clase',
          });
        }
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
      const classroom = await classroomService.update(id, req.user!.id, data);

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
      
      // Obtener áreas
      const areas = await db
        .select()
        .from(curriculumAreas)
        .where(eq(curriculumAreas.countryCode, countryCode))
        .orderBy(curriculumAreas.displayOrder);

      // Obtener competencias para cada área
      const areasWithCompetencies = await Promise.all(
        areas.map(async (area) => {
          const competencies = await db
            .select()
            .from(curriculumCompetencies)
            .where(eq(curriculumCompetencies.areaId, area.id))
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
        model: 'gemini-2.0-flash',
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
      const { name, description, copyBehaviors, copyBadges, copyShopItems, copyQuestionBanks } = req.body;

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
