import { eq, and, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { classroomCharacterClasses, classrooms, studentProfiles } from '../db/schema.js';

const DEFAULT_CLASSES = [
  { key: 'GUARDIAN', name: 'Guardián', description: 'Protector del equipo, resistente y leal', icon: '🛡️', color: 'blue', sortOrder: 0 },
  { key: 'ARCANE', name: 'Arcano', description: 'Maestro del conocimiento y la magia', icon: '🔮', color: 'violet', sortOrder: 1 },
  { key: 'EXPLORER', name: 'Explorador', description: 'Aventurero ágil y curioso', icon: '🧭', color: 'green', sortOrder: 2 },
  { key: 'ALCHEMIST', name: 'Alquimista', description: 'Creador de pociones y artefactos', icon: '⚗️', color: 'orange', sortOrder: 3 },
];

export class CharacterClassService {
  async seedDefaults(classroomId: string) {
    const existing = await db.query.classroomCharacterClasses.findFirst({
      where: eq(classroomCharacterClasses.classroomId, classroomId),
    });
    if (existing) return;

    const now = new Date();
    await db.insert(classroomCharacterClasses).values(
      DEFAULT_CLASSES.map((c) => ({
        id: uuidv4(),
        classroomId,
        ...c,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  async list(classroomId: string) {
    return db.query.classroomCharacterClasses.findMany({
      where: eq(classroomCharacterClasses.classroomId, classroomId),
      orderBy: [asc(classroomCharacterClasses.sortOrder)],
    });
  }

  async listActive(classroomId: string) {
    return db.query.classroomCharacterClasses.findMany({
      where: and(
        eq(classroomCharacterClasses.classroomId, classroomId),
        eq(classroomCharacterClasses.isActive, true),
      ),
      orderBy: [asc(classroomCharacterClasses.sortOrder)],
    });
  }

  async create(classroomId: string, data: { name: string; key: string; description?: string; icon: string; color: string }) {
    const maxOrder = await db
      .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
      .from(classroomCharacterClasses)
      .where(eq(classroomCharacterClasses.classroomId, classroomId));

    const id = uuidv4();
    const now = new Date();
    await db.insert(classroomCharacterClasses).values({
      id,
      classroomId,
      name: data.name,
      key: data.key.toUpperCase().replace(/\s+/g, '_'),
      description: data.description || null,
      icon: data.icon,
      color: data.color,
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return this.getById(id);
  }

  async getById(id: string) {
    return db.query.classroomCharacterClasses.findFirst({
      where: eq(classroomCharacterClasses.id, id),
    });
  }

  async update(id: string, data: { name?: string; description?: string; icon?: string; color?: string; isActive?: boolean; sortOrder?: number }) {
    await db.update(classroomCharacterClasses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(classroomCharacterClasses.id, id));

    return this.getById(id);
  }

  async remove(id: string, classroomId: string) {
    // Unassign all students that have this class before deleting
    await db.update(studentProfiles)
      .set({
        characterClassId: null,
        characterClass: null as any,
        updatedAt: new Date(),
      })
      .where(eq(studentProfiles.characterClassId, id));

    await db.delete(classroomCharacterClasses)
      .where(and(
        eq(classroomCharacterClasses.id, id),
        eq(classroomCharacterClasses.classroomId, classroomId),
      ));
  }

  async reorder(classroomId: string, orderedIds: string[]) {
    const now = new Date();
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(classroomCharacterClasses)
        .set({ sortOrder: i, updatedAt: now })
        .where(and(
          eq(classroomCharacterClasses.id, orderedIds[i]),
          eq(classroomCharacterClasses.classroomId, classroomId),
        ));
    }
  }

  async assignToStudent(studentId: string, characterClassId: string | null) {
    const VALID_ENUM_KEYS = ['GUARDIAN', 'ARCANE', 'EXPLORER', 'ALCHEMIST'];
    if (!characterClassId) {
      await db.update(studentProfiles)
        .set({
          characterClassId: null,
          characterClass: null as any,
          updatedAt: new Date(),
        })
        .where(eq(studentProfiles.id, studentId));
      return;
    }

    const charClass = await this.getById(characterClassId);
    if (!charClass) throw new Error('Clase de personaje no encontrada');

    const updateData: any = {
      characterClassId,
      updatedAt: new Date(),
    };
    if (VALID_ENUM_KEYS.includes(charClass.key)) {
      updateData.characterClass = charClass.key;
    }

    await db.update(studentProfiles)
      .set(updateData)
      .where(eq(studentProfiles.id, studentId));
  }

  async bulkAssignToStudents(studentIds: string[], characterClassId: string | null) {
    const VALID_ENUM_KEYS = ['GUARDIAN', 'ARCANE', 'EXPLORER', 'ALCHEMIST'];
    if (!characterClassId) {
      const now = new Date();
      for (const studentId of studentIds) {
        await db.update(studentProfiles)
          .set({ characterClassId: null, characterClass: null as any, updatedAt: now })
          .where(eq(studentProfiles.id, studentId));
      }
      return;
    }

    const charClass = await this.getById(characterClassId);
    if (!charClass) throw new Error('Clase de personaje no encontrada');

    const updateData: any = {
      characterClassId,
      updatedAt: new Date(),
    };
    if (VALID_ENUM_KEYS.includes(charClass.key)) {
      updateData.characterClass = charClass.key;
    }

    for (const studentId of studentIds) {
      await db.update(studentProfiles)
        .set(updateData)
        .where(eq(studentProfiles.id, studentId));
    }
  }

  async getStudentCount(characterClassId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(studentProfiles)
      .where(eq(studentProfiles.characterClassId, characterClassId));
    return result[0]?.count ?? 0;
  }

  async getClassAssignmentMode(classroomId: string): Promise<string> {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, classroomId),
      columns: { classAssignmentMode: true },
    });
    return classroom?.classAssignmentMode ?? 'STUDENT_CHOICE';
  }
}

export const characterClassService = new CharacterClassService();
