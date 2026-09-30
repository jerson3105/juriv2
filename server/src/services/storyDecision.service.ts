import { and, count, eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { stories, storyChapters, storyScenes, storyVotes, studentProfiles, studentSceneViews, type StoryDecision } from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { getIO } from '../utils/notificationEmitter.js';
import { affectedRows } from '../utils/points.js';
import { decisionForStudent, storyService } from './story.service.js';

const parseDecision = (raw: unknown): StoryDecision | null => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as StoryDecision; } catch { return null; }
  }
  return raw as StoryDecision;
};

class StoryDecisionService {
  private async loadScene(sceneId: string) {
    const [row] = await db.select({
      id: storyScenes.id,
      type: storyScenes.type,
      decision: storyScenes.decision,
      chapterStatus: storyChapters.status,
      classroomId: stories.classroomId,
      storyActive: stories.isActive,
    })
      .from(storyScenes)
      .innerJoin(storyChapters, eq(storyScenes.chapterId, storyChapters.id))
      .innerJoin(stories, eq(storyChapters.storyId, stories.id))
      .where(eq(storyScenes.id, sceneId));
    if (!row || row.type !== 'DECISION') throw new NotFoundError('Decisión no encontrada');
    const decision = parseDecision(row.decision);
    if (!decision) throw new NotFoundError('Decisión no encontrada');
    return { ...row, decision };
  }

  /** El alumno vota (o cambia su voto) mientras la votación está abierta y el capítulo en curso. */
  async vote(userId: string, sceneId: string, optionId: string) {
    const profile = await storyService.requireVisibleSceneForUser(sceneId, userId);
    const scene = await this.loadScene(sceneId);
    if (scene.decision.status !== 'OPEN' || scene.chapterStatus !== 'ACTIVE') {
      throw new ConflictError('La votación ya está cerrada');
    }
    if (!scene.decision.options.some((o) => o.id === optionId)) throw new ValidationError('Opción no válida');

    const now = new Date();
    await db.insert(storyVotes)
      .values({ id: uuidv4(), sceneId, optionId, studentProfileId: profile.id, createdAt: now, updatedAt: now })
      .onDuplicateKeyUpdate({ set: { optionId, updatedAt: now } });
    return decisionForStudent(scene.decision, optionId);
  }

  /** Resultados para el profesor: votos por opción, total y alumnos que pueden votar. */
  async results(sceneId: string) {
    const scene = await this.loadScene(sceneId);
    const counts = (await storyService.voteCounts([sceneId])).get(sceneId) ?? {};
    const [eligible] = await db.select({ total: count() }).from(studentProfiles).where(and(
      eq(studentProfiles.classroomId, scene.classroomId),
      eq(studentProfiles.isActive, true),
      eq(studentProfiles.isDemo, false),
    ));
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    return {
      question: scene.decision.question,
      status: scene.decision.status,
      winnerOptionId: scene.decision.winnerOptionId ?? null,
      options: scene.decision.options.map((o) => ({ id: o.id, label: o.label, votes: counts[o.id] ?? 0 })),
      total,
      eligible: Number(eligible?.total ?? 0),
    };
  }

  /**
   * Cierra la votación: gana la opción más votada. Con empate (o sin votos) el profesor elige
   * entre las empatadas. Los alumnos vuelven a ver la escena, ahora con el desenlace.
   */
  async close(sceneId: string, winnerOptionId?: string | null) {
    const results = await this.results(sceneId);
    if (results.status === 'CLOSED') throw new ConflictError('La votación ya estaba cerrada');
    const top = Math.max(0, ...results.options.map((o) => o.votes));
    const leaders = results.options.filter((o) => o.votes === top).map((o) => o.id);
    let winner = leaders.length === 1 ? leaders[0] : null;
    if (!winner) {
      if (!winnerOptionId || !leaders.includes(winnerOptionId)) {
        throw new ConflictError(top === 0 ? 'Nadie votó: elige tú la opción ganadora' : 'Hay empate: elige la opción ganadora');
      }
      winner = winnerOptionId;
    }

    const scene = await this.loadScene(sceneId);
    const closed: StoryDecision = { ...scene.decision, status: 'CLOSED', winnerOptionId: winner, closedAt: new Date().toISOString() };
    // Cierre condicional: con dos cierres simultáneos solo uno gana (sin doble aviso ni otra repetición).
    const updated = await db.transaction(async (tx) => {
      const result = await tx.update(storyScenes).set({ decision: closed })
        .where(and(eq(storyScenes.id, sceneId), sql`JSON_UNQUOTE(JSON_EXTRACT(${storyScenes.decision}, '$.status')) = 'OPEN'`));
      if (affectedRows(result) === 0) return false;
      // Se vuelve a mostrar a todos: esta vez con el desenlace elegido por la clase.
      await tx.delete(studentSceneViews).where(eq(studentSceneViews.sceneId, sceneId));
      return true;
    });
    if (!updated) throw new ConflictError('La votación ya estaba cerrada');

    try {
      getIO()?.to(`classroom:${scene.classroomId}`).emit('story:updated', { classroomId: scene.classroomId, chapterId: null, sceneId, kind: 'decided' });
    } catch (error) {
      console.error('No se pudo avisar la decisión:', error);
    }
    return this.results(sceneId);
  }
}

export const storyDecisionService = new StoryDecisionService();
