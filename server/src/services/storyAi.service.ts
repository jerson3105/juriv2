import { createGenAI } from '../utils/aiClient.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import type { StoryDecision } from '../db/schema.js';
import { storyService } from './story.service.js';

const SCENE_TYPES = ['INTRO', 'DESARROLLO', 'MILESTONE', 'DECISION', 'OUTRO'] as const;
const EMOTIONS = ['neutral', 'excited', 'sad', 'angry', 'happy', 'mysterious'] as const;
const MAX_CONTEXT = 9000;

type Dialogue = { speaker?: string; text: string; emotion: string };
export interface DraftScene {
  type: typeof SCENE_TYPES[number];
  triggerPercent?: number;
  dialogues: Dialogue[];
  decision?: { question: string; options: { label: string; outcome: Dialogue[] }[] };
}
export interface StoryDraft {
  chapter?: { title: string; description: string; targetXp?: number };
  scenes: DraftScene[];
}

const parseJson = <T>(raw: unknown): T | null => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
  return raw as T;
};

const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const cleanDialogues = (raw: unknown, max = 8): Dialogue[] =>
  (Array.isArray(raw) ? raw : [])
    .map((d) => ({
      speaker: clip(d?.speaker, 100) || undefined,
      text: clip(d?.text, 600),
      emotion: EMOTIONS.includes(d?.emotion) ? d.emotion : 'neutral',
    }))
    .filter((d) => d.text)
    .slice(0, max);

// La IA solo propone: se valida y recorta todo antes de devolverlo al profesor.
const cleanDraft = (raw: any, withChapter: boolean): StoryDraft => {
  const scenes: DraftScene[] = (Array.isArray(raw?.scenes) ? raw.scenes : []).slice(0, 6).map((sc: any) => {
    const type = SCENE_TYPES.includes(sc?.type) ? sc.type : 'DESARROLLO';
    const scene: DraftScene = { type, dialogues: cleanDialogues(sc?.dialogues) };
    if (type === 'MILESTONE') scene.triggerPercent = Math.min(99, Math.max(1, Math.round(Number(sc?.triggerPercent) || 50)));
    if (type === 'DECISION') {
      const options = (Array.isArray(sc?.decision?.options) ? sc.decision.options : []).slice(0, 3)
        .map((o: any) => ({ label: clip(o?.label, 120), outcome: cleanDialogues(o?.outcome, 5) }))
        .filter((o: { label: string }) => o.label);
      if (options.length < 2) return { type: 'DESARROLLO', dialogues: scene.dialogues };
      scene.decision = { question: clip(sc?.decision?.question, 300) || '¿Qué debería hacer el grupo?', options };
    }
    return scene;
  }).filter((sc: DraftScene) => sc.dialogues.length > 0 || sc.decision);

  const draft: StoryDraft = { scenes };
  if (withChapter) {
    draft.chapter = {
      title: clip(raw?.chapter?.title, 120) || 'Nuevo capítulo',
      description: clip(raw?.chapter?.description, 500),
      targetXp: Math.min(100000, Math.max(0, Math.round(Number(raw?.chapter?.targetXp) || 0))) || undefined,
    };
  }
  return draft;
};

class StoryAiService {
  /** Memoria de la IA: biblia del profesor + resumen de lo que ya pasó (incluidas las decisiones de la clase). */
  async buildMemory(storyId: string) {
    const story = await storyService.getStory(storyId).catch(() => null);
    if (!story) throw new NotFoundError('Historia no encontrada');
    const lines: string[] = [];
    story.chapters.forEach((chapter: any, i: number) => {
      lines.push(`Capítulo ${i + 1} (${chapter.status === 'COMPLETED' ? 'completado' : chapter.status === 'ACTIVE' ? 'en curso' : 'por venir'}): ${chapter.title}${chapter.description ? ` — ${chapter.description}` : ''}`);
      for (const scene of chapter.scenes) {
        const said = (scene.dialogues ?? []).slice(0, 3).map((d: any) => `${d.speaker ? `${d.speaker}: ` : ''}${d.text}`).join(' / ');
        const decision = parseJson<StoryDecision>(scene.decision);
        if (decision) {
          const winner = decision.options.find((o) => o.id === decision.winnerOptionId);
          lines.push(`  · Decisión: ${decision.question} → ${winner ? `la clase eligió «${winner.label}»` : 'votación abierta'}`);
        } else if (said) {
          lines.push(`  · ${scene.type}: ${said.slice(0, 280)}`);
        }
      }
    });
    let summary = lines.join('\n');
    if (summary.length > MAX_CONTEXT) summary = `…\n${summary.slice(-MAX_CONTEXT)}`; // lo más reciente pesa más
    return { story, summary };
  }

  /**
   * Borrador de la IA coautora: un capítulo nuevo (con escenas) o escenas para un capítulo existente.
   * No guarda nada: el profesor lo revisa y edita antes de aceptarlo.
   */
  async draft(storyId: string, input: { kind: 'chapter' | 'scenes'; chapterId?: string; idea?: string }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new ValidationError('La IA no está configurada');
    const { story, summary } = await this.buildMemory(storyId);
    const target = input.kind === 'scenes' ? story.chapters.find((c: any) => c.id === input.chapterId) : null;
    if (input.kind === 'scenes' && !target) throw new NotFoundError('Capítulo no encontrado');

    const task = input.kind === 'chapter'
      ? 'Propón el SIGUIENTE capítulo de la historia: título, una frase de portada, una meta de XP sugerida para la clase y entre 3 y 5 escenas (una INTRO, desarrollo, opcionalmente un MILESTONE con su porcentaje y una DECISION con 2 o 3 opciones, y un OUTRO).'
      : `Propón entre 1 y 3 escenas nuevas para el capítulo «${target?.title ?? ""}» que continúen lo ya ocurrido (puede incluir una DECISION con 2 o 3 opciones).`;

    const prompt = `Eres coautor de una historia educativa gamificada para una clase de estudiantes. Escribe en español, con tono apto para escolares, coherente con la biblia y con lo que ya ocurrió (respeta las decisiones que tomó la clase).

TÍTULO: ${story.title}
PREMISA: ${story.description || '(sin premisa)'}
BIBLIA (personajes, tono, reglas): ${story.aiBible || '(el profesor no escribió una biblia: mantén coherencia con lo ya ocurrido)'}

LO QUE YA PASÓ:
${summary || '(la historia aún no tiene capítulos)'}

TAREA: ${task}
${input.idea ? `IDEA DEL PROFESOR: "${input.idea}"` : ''}

Emociones válidas: neutral, excited, sad, angry, happy, mysterious. Diálogos breves (máx. 2 frases cada uno), entre 2 y 6 por escena.
Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{
  ${input.kind === 'chapter' ? '"chapter": { "title": "...", "description": "...", "targetXp": 1500 },' : ''}
  "scenes": [
    { "type": "INTRO", "dialogues": [{ "speaker": "Narrador", "text": "...", "emotion": "neutral" }] },
    { "type": "MILESTONE", "triggerPercent": 50, "dialogues": [ ... ] },
    { "type": "DECISION", "dialogues": [ ... ], "decision": { "question": "...", "options": [ { "label": "...", "outcome": [ { "speaker": "...", "text": "...", "emotion": "..." } ] } ] } }
  ]
}`;

    const ai = createGenAI(apiKey);
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash-lite', contents: prompt });
    let text = (response.text || '').trim();
    if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new ValidationError('La IA no devolvió un borrador válido. Intenta de nuevo.');
    }
    const draft = cleanDraft(raw, input.kind === 'chapter');
    if (draft.scenes.length === 0) throw new ValidationError('La IA no propuso escenas. Prueba con otra idea.');
    // La meta es balance del juego (ritmo de XP de la clase): se repite la del último capítulo con meta; la IA solo sugiere si no hay.
    const lastTarget = [...story.chapters].reverse()
      .map((c: any) => parseJson<{ targetXp?: number }>(c.completionConfig)?.targetXp)
      .find((xp): xp is number => typeof xp === 'number' && xp > 0);
    if (draft.chapter && lastTarget) draft.chapter.targetXp = lastTarget;
    return draft;
  }
}

export const storyAiService = new StoryAiService();
