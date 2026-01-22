import { GoogleGenAI } from '@google/genai';
import { db } from '../db/index.js';
import { studentProfiles, users, behaviors, badges } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { behaviorService } from './behavior.service.js';

export interface StudentMatch {
  name: string;
  status: 'FOUND' | 'MULTIPLE' | 'NOT_FOUND';
  matches?: { id: string; fullName: string }[];
  selectedId?: string;
  selectedName?: string;
}

export interface BehaviorMatch {
  id: string;
  name: string;
  isPositive: boolean;
  xpValue: number;
  hpValue: number;
  gpValue: number;
  icon: string;
  confidence: number;
}

export interface BadgeMatch {
  id: string;
  name: string;
  icon: string;
  confidence: number;
}

export interface AIInterpretation {
  actions: Array<'APPLY_BEHAVIOR' | 'AWARD_BADGE'>;
  behavior?: BehaviorMatch;
  badge?: BadgeMatch;
  students: StudentMatch[];
  clarificationNeeded?: string;
  rawResponse?: string;
}

export interface AIAssistantRequest {
  classroomId: string;
  command: string;
}

export interface AIAssistantResponse {
  success: boolean;
  interpretation: AIInterpretation;
}

class AIAssistantService {
  private ai: GoogleGenAI | null = null;

  private getAI(): GoogleGenAI {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY no configurada');
      }
      this.ai = new GoogleGenAI({ apiKey });
    }
    return this.ai;
  }

  async getClassroomStudents(classroomId: string) {
    // Obtener estudiantes con cuenta (tienen userId)
    const studentsWithAccount = await db
      .select({
        id: studentProfiles.id,
        displayName: studentProfiles.displayName,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(studentProfiles)
      .innerJoin(users, eq(studentProfiles.userId, users.id))
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true)
      ));

    // Obtener estudiantes placeholder (sin userId, solo displayName)
    const placeholderStudents = await db
      .select({
        id: studentProfiles.id,
        displayName: studentProfiles.displayName,
      })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true),
        isNull(studentProfiles.userId)
      ));

    const result = [
      ...studentsWithAccount.map(s => ({
        id: s.id,
        fullName: `${s.firstName} ${s.lastName}`.trim(),
        firstName: s.firstName || '',
        lastName: s.lastName || '',
      })),
      ...placeholderStudents.map(s => ({
        id: s.id,
        fullName: s.displayName || 'Sin nombre',
        firstName: s.displayName || '',
        lastName: '',
      })),
    ];

    return result;
  }

  async getClassroomBehaviors(classroomId: string) {
    const behaviorsList = await behaviorService.getByClassroom(classroomId);
    return behaviorsList.map(b => ({
      id: b.id,
      name: b.name,
      isPositive: b.isPositive,
      xpValue: b.xpValue,
      hpValue: b.hpValue,
      gpValue: b.gpValue,
      icon: b.icon,
    }));
  }

  async getClassroomBadges(classroomId: string) {
    const badgesList = await db
      .select()
      .from(badges)
      .where(and(
        eq(badges.classroomId, classroomId),
        eq(badges.isActive, true)
      ));

    return badgesList.map(b => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
    }));
  }

  async processCommand(request: AIAssistantRequest): Promise<AIAssistantResponse> {
    const { classroomId, command } = request;

    const students = await this.getClassroomStudents(classroomId);
    const behaviorsList = await this.getClassroomBehaviors(classroomId);
    const badgesList = await this.getClassroomBadges(classroomId);

    if (students.length === 0) {
      return {
        success: false,
        interpretation: {
          actions: [],
          students: [],
          clarificationNeeded: 'No hay estudiantes en esta clase.',
        },
      };
    }

    if (behaviorsList.length === 0 && badgesList.length === 0) {
      return {
        success: false,
        interpretation: {
          actions: [],
          students: [],
          clarificationNeeded: 'No hay comportamientos ni insignias configurados en esta clase.',
        },
      };
    }

    const ai = this.getAI();

    const studentsContext = students
      .map(s => `- "${s.fullName}" (id: ${s.id}, nombre: ${s.firstName}, apellido: ${s.lastName})`)
      .join('\n');

    const behaviorsContext = behaviorsList
      .map(b => `- "${b.name}" (id: ${b.id}, ${b.isPositive ? 'positivo' : 'negativo'}, XP: ${b.xpValue}, HP: ${b.hpValue}, GP: ${b.gpValue}, icono: ${b.icon})`)
      .join('\n');

    const badgesContext = badgesList
      .map(b => `- "${b.name}" (id: ${b.id}, icono: ${b.icon})`)
      .join('\n');

    const prompt = `Eres un asistente de aula inteligente. Tu tarea es interpretar comandos en lenguaje natural del profesor y extraer información estructurada.

ESTUDIANTES DEL AULA:
${studentsContext}

COMPORTAMIENTOS DISPONIBLES:
${behaviorsContext || 'Ninguno configurado'}

INSIGNIAS DISPONIBLES:
${badgesContext || 'Ninguna configurada'}

COMANDO DEL PROFESOR:
"${command}"

INSTRUCCIONES:
1. Identifica los nombres de estudiantes mencionados (pueden ser solo nombres de pila, apellidos, o ambos)
2. Determina si el profesor quiere aplicar un COMPORTAMIENTO, dar una INSIGNIA, o AMBOS
3. Encuentra el comportamiento Y/O insignia más similar a lo que describe el profesor
4. Para cada nombre mencionado, busca coincidencias en la lista de estudiantes
5. Si el comando menciona AMBAS cosas (ej: "participaron y dales insignia"), incluye ambos en actions

REGLAS DE BÚSQUEDA DE ESTUDIANTES:
- Si el profesor dice "Kevin", busca estudiantes cuyo nombre O apellido contenga "Kevin"
- Si hay UNA sola coincidencia, status = "FOUND"
- Si hay MÚLTIPLES coincidencias, status = "MULTIPLE" y lista todas las opciones
- Si NO hay coincidencia, status = "NOT_FOUND"

Responde ÚNICAMENTE con un JSON válido (sin bloques de código):
{
  "actions": ["APPLY_BEHAVIOR", "AWARD_BADGE"],
  "behavior": {
    "id": "id del comportamiento más cercano",
    "name": "nombre del comportamiento",
    "confidence": 0.0 a 1.0
  },
  "badge": {
    "id": "id de la insignia",
    "name": "nombre de la insignia", 
    "confidence": 0.0 a 1.0
  },
  "students": [
    {
      "mentionedName": "nombre que dijo el profesor",
      "status": "FOUND" | "MULTIPLE" | "NOT_FOUND",
      "matches": [
        { "id": "student_profile_id", "fullName": "Nombre Completo" }
      ]
    }
  ],
  "clarificationNeeded": "mensaje si no se entiende algo (opcional)"
}

NOTAS:
- "actions" es un ARRAY que puede contener una o ambas acciones
- Si la acción es dar puntos o algo positivo/negativo, incluye "APPLY_BEHAVIOR" en actions
- Si menciona insignia, medalla, o premio especial, incluye "AWARD_BADGE" en actions
- Si el comando pide AMBAS cosas, incluye ambas en el array: ["APPLY_BEHAVIOR", "AWARD_BADGE"]
- "behavior" se incluye si "APPLY_BEHAVIOR" está en actions
- "badge" se incluye si "AWARD_BADGE" está en actions
- confidence indica qué tan seguro estás de la coincidencia (1.0 = exacto, 0.5 = similar)`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });

      const text = response.text?.trim() || '';
      
      // Limpiar respuesta de posibles bloques de código
      let jsonText = text;
      if (text.startsWith('```')) {
        jsonText = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }

      const parsed = JSON.parse(jsonText);

      // Normalizar actions (puede venir como array o string legacy)
      let actions: Array<'APPLY_BEHAVIOR' | 'AWARD_BADGE'> = [];
      if (Array.isArray(parsed.actions)) {
        actions = parsed.actions.filter((a: string) => a === 'APPLY_BEHAVIOR' || a === 'AWARD_BADGE');
      } else if (parsed.action && parsed.action !== 'UNKNOWN') {
        actions = [parsed.action];
      }

      // Procesar la respuesta
      const interpretation: AIInterpretation = {
        actions,
        students: [],
        clarificationNeeded: parsed.clarificationNeeded,
        rawResponse: jsonText,
      };

      // Procesar comportamiento si existe
      if (parsed.behavior && actions.includes('APPLY_BEHAVIOR')) {
        const behaviorData = behaviorsList.find(b => b.id === parsed.behavior.id);
        if (behaviorData) {
          interpretation.behavior = {
            id: behaviorData.id,
            name: behaviorData.name,
            isPositive: behaviorData.isPositive,
            xpValue: behaviorData.xpValue,
            hpValue: behaviorData.hpValue,
            gpValue: behaviorData.gpValue,
            icon: behaviorData.icon || '⭐',
            confidence: parsed.behavior.confidence || 0.8,
          };
        }
      }

      // Procesar insignia si existe
      if (parsed.badge && actions.includes('AWARD_BADGE')) {
        const badgeData = badgesList.find(b => b.id === parsed.badge.id);
        if (badgeData) {
          interpretation.badge = {
            id: badgeData.id,
            name: badgeData.name,
            icon: badgeData.icon || '🏅',
            confidence: parsed.badge.confidence || 0.8,
          };
        }
      }

      // Procesar estudiantes
      if (parsed.students && Array.isArray(parsed.students)) {
        interpretation.students = parsed.students.map((s: any) => {
          const studentMatch: StudentMatch = {
            name: s.mentionedName || s.name,
            status: s.status || 'NOT_FOUND',
          };

          if (s.status === 'FOUND' && s.matches && s.matches.length === 1) {
            studentMatch.selectedId = s.matches[0].id;
            studentMatch.selectedName = s.matches[0].fullName;
          } else if (s.status === 'MULTIPLE' && s.matches) {
            studentMatch.matches = s.matches.map((m: any) => ({
              id: m.id,
              fullName: m.fullName,
            }));
          }

          return studentMatch;
        });
      }

      return {
        success: true,
        interpretation,
      };

    } catch (error: any) {
      console.error('Error processing AI command:', error);
      return {
        success: false,
        interpretation: {
          actions: [],
          students: [],
          clarificationNeeded: 'No pude entender el comando. Intenta ser más específico.',
        },
      };
    }
  }

  async executeAction(
    classroomId: string,
    action: 'APPLY_BEHAVIOR' | 'AWARD_BADGE',
    targetId: string,
    studentIds: string[],
    teacherId: string
  ): Promise<{ success: boolean; message: string; results?: any }> {
    try {
      if (action === 'APPLY_BEHAVIOR') {
        const result = await behaviorService.applyToStudents({ 
          behaviorId: targetId, 
          studentIds,
          teacherId
        });
        return {
          success: true,
          message: `Comportamiento aplicado a ${result.studentsAffected} estudiante(s)`,
          results: result,
        };
      } else if (action === 'AWARD_BADGE') {
        // Importar badgeService dinámicamente para evitar dependencias circulares
        const { badgeService } = await import('./badge.service.js');
        
        const results = [];
        for (const studentId of studentIds) {
          try {
            await badgeService.awardBadgeManually(studentId, targetId, teacherId);
            results.push({ studentId, success: true });
          } catch (e: any) {
            results.push({ studentId, success: false, error: e.message });
          }
        }
        
        const successCount = results.filter(r => r.success).length;
        return {
          success: successCount > 0,
          message: `Insignia otorgada a ${successCount} de ${studentIds.length} estudiante(s)`,
          results,
        };
      }

      return { success: false, message: 'Acción no válida' };
    } catch (error: any) {
      console.error('Error executing action:', error);
      return { success: false, message: error.message };
    }
  }
}

export const aiAssistantService = new AIAssistantService();
