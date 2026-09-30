import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { studentGrades } from '../db/schema.js';
import { createGenAI } from '../utils/aiClient.js';
import { ValidationError } from '../utils/errors.js';
import { gradeService } from './grade.service.js';

const MAX_STUDENTS_PER_CALL = 40;

/**
 * Conclusiones descriptivas (libreta / SIAGIE): la IA propone una por alumno a partir de su evidencia
 * real (nota, fuentes y destrezas) y el docente las revisa y guarda. Nunca se guardan solas.
 */
class GradeConclusionService {
  async propose(classroomId: string, competencyId: string, period: string, studentProfileIds?: string[]) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new ValidationError('La IA no está configurada');

    const book = await gradeService.getClassroomGrades(classroomId, period);
    const competency = book.competencies.find((c) => c.id === competencyId);
    if (!competency) throw new ValidationError('La competencia no está activa en esta clase');

    const candidates = book.students
      .map((student) => ({ student, grade: student.grades.find((g) => g.competencyId === competencyId) }))
      .filter(({ student, grade }) => grade && (grade.activitiesCount > 0 || grade.isManualOverride)
        && (!studentProfileIds || studentProfileIds.includes(student.studentProfileId)))
      .slice(0, MAX_STUDENTS_PER_CALL);
    if (candidates.length === 0) throw new ValidationError('No hay alumnos con nota en esta competencia');

    // Evidencia resumida (sin nombres: la IA solo ve un código por alumno).
    const lines = candidates.map(({ grade }, index) => {
      const g = grade!;
      const sources = (g.calculationDetails?.activities ?? []).slice(0, 5).map((a) => `${a.name} (${Math.round(a.score)}%)`).join('; ');
      const skills = g.indicatorBreakdown.filter((i) => i.hasEvidence).map((i) => `${i.name}: ${i.gradeLabel}`).join('; ');
      return `A${index + 1} | nota ${g.gradeLabel} | ${skills ? `destrezas: ${skills} | ` : ''}evidencias: ${sources || 'ajuste del docente'}`;
    });

    const prompt = `Eres docente en Perú y redactas conclusiones descriptivas para la libreta (SIAGIE) de la competencia "${competency.name}".
Escala de la clase: ${book.gradeScaleType ?? 'porcentaje'}. Para cada alumno escribe UNA conclusión de 1 o 2 oraciones (máx. 45 palabras):
- en tercera persona, sin nombres, tono constructivo y profesional;
- describe lo que logra según su evidencia y, si su nota no es la máxima, qué necesita reforzar;
- usa la evidencia dada, no inventes actividades.

ALUMNOS:
${lines.join('\n')}

Responde SOLO con JSON válido: [{"code":"A1","text":"..."}]`;

    const ai = createGenAI(apiKey);
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash-lite', contents: prompt });
    let text = (response.text || '').trim();
    if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ValidationError('La IA no devolvió conclusiones válidas. Intenta de nuevo.');
    }
    const byCode = new Map((Array.isArray(parsed) ? parsed : [])
      .filter((item) => typeof item?.code === 'string' && typeof item?.text === 'string')
      .map((item) => [item.code.trim().toUpperCase(), item.text.trim().slice(0, 600)]));

    return {
      competencyId,
      proposals: candidates.map(({ student, grade }, index) => ({
        gradeId: grade!.id,
        studentProfileId: student.studentProfileId,
        studentName: student.studentName,
        gradeLabel: grade!.gradeLabel,
        current: grade!.conclusion,
        proposal: byCode.get(`A${index + 1}`) ?? '',
      })),
    };
  }

  /** Guarda varias conclusiones (todas deben ser notas de esta clase). */
  async saveMany(classroomId: string, items: Array<{ gradeId: string; conclusion: string | null }>) {
    const ids = [...new Set(items.map((i) => i.gradeId))];
    const rows = await db.select({ id: studentGrades.id }).from(studentGrades)
      .where(and(inArray(studentGrades.id, ids), eq(studentGrades.classroomId, classroomId)));
    if (rows.length !== ids.length) throw new ValidationError('Hay notas que no son de esta clase');
    const now = new Date();
    await db.transaction(async (tx) => {
      for (const item of items) {
        await tx.update(studentGrades).set({ conclusion: item.conclusion?.trim() || null, updatedAt: now }).where(eq(studentGrades.id, item.gradeId));
      }
    });
    return { saved: items.length };
  }
}

export const gradeConclusionService = new GradeConclusionService();
