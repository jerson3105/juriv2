import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { classNotes, classrooms } from '../db/schema.js';

const VALID_CATEGORIES = ['task', 'review', 'material', 'other'] as const;
type NoteCategory = typeof VALID_CATEGORIES[number];

class ClassNoteService {

  async create(classroomId: string, teacherId: string, content: string, category: string, dueDate?: string | null) {
    const trimmed = content.trim();
    if (!trimmed) throw new Error('El contenido no puede estar vacío');

    const [classroom] = await db.select({ id: classrooms.id, teacherId: classrooms.teacherId })
      .from(classrooms)
      .where(eq(classrooms.id, classroomId));

    if (!classroom) throw new Error('Aula no encontrada');
    if (classroom.teacherId !== teacherId) throw new Error('No tienes permiso en esta aula');

    const validCategory: NoteCategory = VALID_CATEGORIES.includes(category as NoteCategory)
      ? (category as NoteCategory)
      : 'other';

    const id = uuidv4();
    const now = new Date();

    await db.insert(classNotes).values({
      id,
      classroomId,
      teacherId,
      content: trimmed,
      category: validCategory,
      isCompleted: false,
      dueDate: dueDate ? new Date(dueDate + 'T12:00:00') : null,
      createdAt: now,
      completedAt: null,
    });

    return { id, classroomId, teacherId, content: trimmed, category: validCategory, isCompleted: false, dueDate: dueDate || null, createdAt: now, completedAt: null };
  }

  async list(classroomId: string) {
    const results = await db.select()
      .from(classNotes)
      .where(eq(classNotes.classroomId, classroomId))
      .orderBy(asc(classNotes.isCompleted), desc(classNotes.createdAt));

    return results;
  }

  async toggleComplete(noteId: string, teacherId: string) {
    const [note] = await db.select()
      .from(classNotes)
      .where(eq(classNotes.id, noteId));

    if (!note) throw new Error('Nota no encontrada');

    // Verify teacher owns the classroom
    const [classroom] = await db.select({ teacherId: classrooms.teacherId })
      .from(classrooms)
      .where(eq(classrooms.id, note.classroomId));

    if (!classroom || classroom.teacherId !== teacherId) throw new Error('No tienes permiso');

    const newCompleted = !note.isCompleted;

    await db.update(classNotes)
      .set({
        isCompleted: newCompleted,
        completedAt: newCompleted ? new Date() : null,
      })
      .where(eq(classNotes.id, noteId));

    return { ...note, isCompleted: newCompleted, completedAt: newCompleted ? new Date() : null };
  }

  async remove(noteId: string, teacherId: string) {
    const [note] = await db.select()
      .from(classNotes)
      .where(eq(classNotes.id, noteId));

    if (!note) throw new Error('Nota no encontrada');

    const [classroom] = await db.select({ teacherId: classrooms.teacherId })
      .from(classrooms)
      .where(eq(classrooms.id, note.classroomId));

    if (!classroom || classroom.teacherId !== teacherId) throw new Error('No tienes permiso');

    await db.delete(classNotes).where(eq(classNotes.id, noteId));
    return { success: true };
  }

  async getPendingCount(classroomId: string) {
    const [result] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(classNotes)
      .where(and(eq(classNotes.classroomId, classroomId), eq(classNotes.isCompleted, false)));

    return result?.count || 0;
  }
}

export const classNoteService = new ClassNoteService();
