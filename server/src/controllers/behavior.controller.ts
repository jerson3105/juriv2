import type { Request, Response } from 'express';
import { behaviorService } from '../services/behavior.service.js';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

const createBehaviorSchema = z.object({
  classroomId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  pointType: z.enum(['XP', 'HP', 'GP']),
  pointValue: z.number().int().min(0),
  xpValue: z.number().int().min(0).optional(),
  hpValue: z.number().int().min(0).optional(),
  gpValue: z.number().int().min(0).optional(),
  isPositive: z.boolean(),
  icon: z.string().max(50).optional(),
  competencyId: z.string().optional(),
});

const updateBehaviorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
  pointType: z.enum(['XP', 'HP', 'GP']).optional(),
  pointValue: z.number().int().min(0).optional(),
  xpValue: z.number().int().min(0).optional(),
  hpValue: z.number().int().min(0).optional(),
  gpValue: z.number().int().min(0).optional(),
  isPositive: z.boolean().optional(),
  icon: z.string().max(50).optional(),
  competencyId: z.string().nullable().optional(),
});

const applyBehaviorSchema = z.object({
  behaviorId: z.string().uuid(),
  studentIds: z.array(z.string().uuid()).min(1),
});

export class BehaviorController {
  // Crear comportamiento
  async create(req: Request, res: Response) {
    try {
      const data = createBehaviorSchema.parse(req.body);
      const behavior = await behaviorService.create(data);

      res.status(201).json({
        success: true,
        message: 'Comportamiento creado',
        data: behavior,
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
        message: 'Error al crear comportamiento',
      });
    }
  }

  // Obtener comportamientos de una clase
  async getByClassroom(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const behaviors = await behaviorService.getByClassroom(classroomId);

      res.json({
        success: true,
        data: behaviors,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener comportamientos',
      });
    }
  }

  // Obtener comportamientos positivos
  async getPositive(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const behaviors = await behaviorService.getPositive(classroomId);

      res.json({
        success: true,
        data: behaviors,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener comportamientos',
      });
    }
  }

  // Obtener comportamientos negativos
  async getNegative(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const behaviors = await behaviorService.getNegative(classroomId);

      res.json({
        success: true,
        data: behaviors,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener comportamientos',
      });
    }
  }

  // Actualizar comportamiento
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = updateBehaviorSchema.parse(req.body);
      const behavior = await behaviorService.update(id, data);

      res.json({
        success: true,
        message: 'Comportamiento actualizado',
        data: behavior,
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
        message: 'Error al actualizar comportamiento',
      });
    }
  }

  // Eliminar comportamiento
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await behaviorService.delete(id);

      res.json({
        success: true,
        message: 'Comportamiento eliminado',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al eliminar comportamiento',
      });
    }
  }

  // Aplicar comportamiento a estudiantes
  async apply(req: Request, res: Response) {
    try {
      const data = applyBehaviorSchema.parse(req.body);
      const result = await behaviorService.applyToStudents({
        ...data,
        teacherId: req.user!.id,
      });

      res.json({
        success: true,
        message: `${result.behavior.name} aplicado a ${result.studentsAffected} estudiante(s)`,
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
        message: 'Error al aplicar comportamiento',
      });
    }
  }

  // Generar comportamientos con IA
  async generateWithAI(req: Request, res: Response) {
    try {
      const { description, level, count, includePositive, includeNegative, pointMode, competencies } = req.body;

      if (!description || !level) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere descripción y nivel educativo',
        });
      }

      // Configurar qué tipos de puntos usar según pointMode
      let pointsInstruction = '';
      switch (pointMode) {
        case 'XP_ONLY':
          pointsInstruction = 'Solo usa XP (experiencia). hpValue y gpValue siempre en 0.';
          break;
        case 'HP_ONLY':
          pointsInstruction = 'Solo usa HP (vida/salud). xpValue y gpValue siempre en 0.';
          break;
        case 'GP_ONLY':
          pointsInstruction = 'Solo usa GP (oro/monedas). xpValue y hpValue siempre en 0.';
          break;
        case 'COMBINED':
        default:
          pointsInstruction = 'Usa combinación de XP, HP y GP según corresponda. XP para logros académicos, HP para comportamiento/salud, GP para recompensas económicas.';
          break;
      }

      // Configurar competencias si existen
      let competenciesInstruction = '';
      let competencyJsonField = '';
      if (competencies && competencies.length > 0) {
        const competencyList = competencies.map((c: { id: string; name: string }) => `- ID: "${c.id}" → ${c.name}`).join('\n');
        competenciesInstruction = `
COMPETENCIAS DISPONIBLES:
${competencyList}

IMPORTANTE: Asigna a cada comportamiento la competencia más apropiada usando su ID exacto.
Si un comportamiento no encaja claramente con ninguna competencia, usa null.`;
        competencyJsonField = ',\n    "competencyId": "id-de-la-competencia-o-null"';
      }

      // Construir el prompt
      const prompt = `Eres un experto en gamificación educativa. Genera ${count || 10} comportamientos para una clase de nivel ${level}.

CONTEXTO DEL PROFESOR:
"${description}"

CONFIGURACIÓN DE PUNTOS:
${pointsInstruction}
${competenciesInstruction}

${includePositive !== false ? '✓ Incluir comportamientos POSITIVOS (para dar puntos cuando el estudiante hace algo bien)' : ''}
${includeNegative !== false ? '✓ Incluir comportamientos NEGATIVOS (para quitar puntos cuando el estudiante tiene mal comportamiento)' : ''}

Responde ÚNICAMENTE con un array JSON válido, sin explicaciones ni markdown:

[
  {
    "name": "Nombre corto y claro (máx 40 caracteres)",
    "description": "Descripción breve del comportamiento",
    "isPositive": true,
    "xpValue": 10,
    "hpValue": 0,
    "gpValue": 5,
    "icon": "⭐"${competencyJsonField}
  }
]

REGLAS IMPORTANTES:
1. Para POSITIVOS:
   - XP: 5-30 puntos (logros académicos, participación)
   - GP: 0-15 puntos (recompensa económica opcional)
   - HP: generalmente 0 (o 5-10 si es recuperación de vida)

2. Para NEGATIVOS:
   - HP: 5-25 puntos (daño por mal comportamiento)
   - XP: 0 (no se quita experiencia)
   - GP: 0-10 (multa económica opcional)

3. Iconos disponibles: ⭐🎯📚✅🏆💪🧠❤️💔⚡🔥❌😴📵🤝👏💡🎨🔬📝✋🙋

4. Nombres concisos y claros en español
5. Apropiados para nivel ${level}
6. Basados en el contexto que describió el profesor
${competencies && competencies.length > 0 ? '7. Asigna competencyId usando los IDs exactos proporcionados (o null si no aplica)' : ''}

Genera comportamientos variados y útiles:`;

      // Inicializar cliente de Gemini
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: 'API Key de Gemini no configurada',
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

      // Parsear el JSON de la respuesta
      let behaviors = [];
      try {
        // Limpiar el texto de posibles marcadores de código
        let cleanText = responseText.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        behaviors = JSON.parse(cleanText);
      } catch (parseError) {
        console.error('Error parsing AI response:', responseText);
        return res.status(500).json({
          success: false,
          message: 'Error al procesar la respuesta de la IA',
        });
      }

      res.json({
        success: true,
        data: {
          behaviors,
          prompt,
        },
      });

    } catch (error: any) {
      console.error('Error generating behaviors with AI:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al generar comportamientos con IA',
      });
    }
  }
}

export const behaviorController = new BehaviorController();
