import { db } from '../db/index.js';
import { teams, clanLogs, studentProfiles, classrooms, users } from '../db/schema.js';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Emblemas disponibles para clanes
export const CLAN_EMBLEMS = [
  'shield', 'sword', 'crown', 'dragon', 'phoenix', 'wolf', 'eagle', 'lion',
  'star', 'flame', 'lightning', 'moon', 'sun', 'tree', 'mountain', 'wave'
];

// Colores predefinidos para clanes
export const CLAN_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

interface CreateClanData {
  classroomId: string;
  name: string;
  color?: string;
  emblem?: string;
  motto?: string;
  maxMembers?: number;
}

interface UpdateClanData {
  name?: string;
  color?: string;
  emblem?: string;
  motto?: string;
  maxMembers?: number;
  isActive?: boolean;
}

interface ClanLogPayload {
  clanId: string;
  studentId: string | null;
  action: string;
  xpAmount: number;
  gpAmount: number;
  reason: string;
}

export class ClanService {
  private isValidHexColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }

  private normalizeClanName(name: string): string {
    return name.trim();
  }

  private shuffleArray<T>(values: T[]): T[] {
    const shuffled = [...values];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async getClassroomIdByClan(clanId: string): Promise<string | null> {
    const [row] = await db
      .select({ classroomId: teams.classroomId })
      .from(teams)
      .where(eq(teams.id, clanId));

    return row?.classroomId ?? null;
  }

  async getClassroomIdByStudentProfile(studentProfileId: string): Promise<string | null> {
    const [row] = await db
      .select({ classroomId: studentProfiles.classroomId })
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));

    return row?.classroomId ?? null;
  }

  async verifyTeacherOwnsClassroom(teacherId: string, classroomId: string): Promise<boolean> {
    const [classroom] = await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(
        and(
          eq(classrooms.id, classroomId),
          eq(classrooms.teacherId, teacherId)
        )
      );

    return !!classroom;
  }

  async verifyStudentBelongsToUser(studentProfileId: string, userId: string): Promise<boolean> {
    const [student] = await db
      .select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(
        and(
          eq(studentProfiles.id, studentProfileId),
          eq(studentProfiles.userId, userId),
          eq(studentProfiles.isActive, true)
        )
      );

    return !!student;
  }

  async verifyStudentUserInClassroom(userId: string, classroomId: string): Promise<boolean> {
    const [student] = await db
      .select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(
        and(
          eq(studentProfiles.userId, userId),
          eq(studentProfiles.classroomId, classroomId),
          eq(studentProfiles.isActive, true)
        )
      );

    return !!student;
  }

  async getStudentProfileInClassroomByUser(userId: string, classroomId: string): Promise<string | null> {
    const [student] = await db
      .select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(
        and(
          eq(studentProfiles.userId, userId),
          eq(studentProfiles.classroomId, classroomId),
          eq(studentProfiles.isActive, true)
        )
      );

    return student?.id ?? null;
  }

  // Crear un nuevo clan
  async createClan(data: CreateClanData) {
    const id = uuidv4();
    const now = new Date();

    const normalizedName = this.normalizeClanName(data.name);
    if (!normalizedName) {
      throw new Error('El nombre del clan es requerido');
    }

    const color = data.color || CLAN_COLORS[Math.floor(Math.random() * CLAN_COLORS.length)];
    if (!this.isValidHexColor(color)) {
      throw new Error('Color de clan inválido');
    }

    const emblem = data.emblem || CLAN_EMBLEMS[Math.floor(Math.random() * CLAN_EMBLEMS.length)];
    if (!CLAN_EMBLEMS.includes(emblem)) {
      throw new Error('Emblema de clan inválido');
    }

    const maxMembers = data.maxMembers || 10;
    if (maxMembers < 2 || maxMembers > 50) {
      throw new Error('El tamaño del clan debe estar entre 2 y 50 miembros');
    }

    await db.transaction(async (tx) => {
      const [classroom] = await tx
        .select({ id: classrooms.id, clansEnabled: classrooms.clansEnabled })
        .from(classrooms)
        .where(eq(classrooms.id, data.classroomId));

      if (!classroom) {
        throw new Error('Clase no encontrada');
      }

      if (!classroom.clansEnabled) {
        throw new Error('Los clanes no están habilitados en esta clase');
      }

      const [existingClan] = await tx
        .select({ id: teams.id })
        .from(teams)
        .where(
          and(
            eq(teams.classroomId, data.classroomId),
            eq(teams.isActive, true),
            sql`LOWER(${teams.name}) = ${normalizedName.toLowerCase()}`
          )
        );

      if (existingClan) {
        throw new Error('Ya existe un clan activo con ese nombre');
      }

      await tx.insert(teams).values({
        id,
        classroomId: data.classroomId,
        name: normalizedName,
        color,
        emblem,
        motto: data.motto || null,
        maxMembers,
        totalXp: 0,
        totalGp: 0,
        wins: 0,
        losses: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    return this.getClanById(id);
  }

  // Obtener clan por ID
  async getClanById(clanId: string) {
    const clan = await db.query.teams.findFirst({
      where: eq(teams.id, clanId),
    });
    return clan;
  }

  // Obtener todos los clanes de una clase
  async getClassroomClans(classroomId: string) {
    const clans = await db
      .select({
        id: teams.id,
        name: teams.name,
        color: teams.color,
        emblem: teams.emblem,
        motto: teams.motto,
        totalXp: teams.totalXp,
        totalGp: teams.totalGp,
        wins: teams.wins,
        losses: teams.losses,
        maxMembers: teams.maxMembers,
        isActive: teams.isActive,
        createdAt: teams.createdAt,
      })
      .from(teams)
      .where(and(eq(teams.classroomId, classroomId), eq(teams.isActive, true)))
      .orderBy(desc(teams.totalXp));

    if (clans.length === 0) {
      return [];
    }

    const clanIds = clans.map((clan) => clan.id);
    const membersRows = await db
      .select({
        teamId: studentProfiles.teamId,
        id: studentProfiles.id,
        characterName: studentProfiles.characterName,
        level: studentProfiles.level,
        xp: studentProfiles.xp,
        avatarGender: studentProfiles.avatarGender,
        characterClass: studentProfiles.characterClass,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(studentProfiles)
      .leftJoin(users, eq(studentProfiles.userId, users.id))
      .where(
        and(
          inArray(studentProfiles.teamId, clanIds),
          eq(studentProfiles.isActive, true)
        )
      );

    const membersByClan = new Map<string, Array<{
      id: string;
      characterName: string | null;
      level: number;
      xp: number;
      avatarGender: 'MALE' | 'FEMALE';
      characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
      firstName: string | null;
      lastName: string | null;
    }>>();

    for (const row of membersRows) {
      if (!row.teamId) continue;

      const list = membersByClan.get(row.teamId) || [];
      list.push({
        id: row.id,
        characterName: row.characterName,
        level: row.level,
        xp: row.xp,
        avatarGender: row.avatarGender,
        characterClass: row.characterClass,
        firstName: row.firstName,
        lastName: row.lastName,
      });
      membersByClan.set(row.teamId, list);
    }

    return clans.map((clan) => {
      const members = membersByClan.get(clan.id) || [];

      return {
        ...clan,
        members,
        memberCount: members.length,
      };
    });
  }

  // Actualizar clan
  async updateClan(clanId: string, data: UpdateClanData) {
    const now = new Date();
    const updateData: Record<string, unknown> = { updatedAt: now };

    if (typeof data.name !== 'undefined') {
      const normalizedName = this.normalizeClanName(data.name);
      if (!normalizedName) {
        throw new Error('El nombre del clan es requerido');
      }
      updateData.name = normalizedName;
    }

    if (typeof data.color !== 'undefined') {
      if (!this.isValidHexColor(data.color)) {
        throw new Error('Color de clan inválido');
      }
      updateData.color = data.color;
    }

    if (typeof data.emblem !== 'undefined') {
      if (!CLAN_EMBLEMS.includes(data.emblem)) {
        throw new Error('Emblema de clan inválido');
      }
      updateData.emblem = data.emblem;
    }

    if (typeof data.motto !== 'undefined') {
      updateData.motto = data.motto || null;
    }

    if (typeof data.maxMembers !== 'undefined') {
      if (data.maxMembers < 2 || data.maxMembers > 50) {
        throw new Error('El tamaño del clan debe estar entre 2 y 50 miembros');
      }
      updateData.maxMembers = data.maxMembers;
    }

    if (typeof data.isActive !== 'undefined') {
      updateData.isActive = data.isActive;
    }

    await db.transaction(async (tx) => {
      const [clan] = await tx
        .select()
        .from(teams)
        .where(eq(teams.id, clanId));

      if (!clan) {
        throw new Error('Clan no encontrado');
      }

      if (typeof updateData.name === 'string') {
        const [existingClan] = await tx
          .select({ id: teams.id })
          .from(teams)
          .where(
            and(
              eq(teams.classroomId, clan.classroomId),
              eq(teams.isActive, true),
              sql`LOWER(${teams.name}) = ${String(updateData.name).toLowerCase()}`
            )
          );

        if (existingClan && existingClan.id !== clanId) {
          throw new Error('Ya existe un clan activo con ese nombre');
        }
      }

      if (typeof updateData.maxMembers === 'number') {
        const [memberCount] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(studentProfiles)
          .where(
            and(
              eq(studentProfiles.teamId, clanId),
              eq(studentProfiles.isActive, true)
            )
          );

        if (Number(memberCount?.count || 0) > updateData.maxMembers) {
          throw new Error('No se puede reducir el tamaño del clan por debajo de sus miembros actuales');
        }
      }

      await tx
        .update(teams)
        .set(updateData)
        .where(eq(teams.id, clanId));
    });

    return this.getClanById(clanId);
  }

  // Eliminar clan (soft delete)
  async deleteClan(clanId: string) {
    const now = new Date();

    await db.transaction(async (tx) => {
      const [clan] = await tx
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.id, clanId), eq(teams.isActive, true)));

      if (!clan) {
        throw new Error('Clan no encontrado');
      }

      const members = await tx
        .select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(eq(studentProfiles.teamId, clanId));

      if (members.length > 0) {
        await tx
          .update(studentProfiles)
          .set({ teamId: null, updatedAt: now })
          .where(eq(studentProfiles.teamId, clanId));

        await tx.insert(clanLogs).values(
          members.map((member) => ({
            id: uuidv4(),
            clanId,
            studentId: member.id,
            action: 'MEMBER_LEFT',
            xpAmount: 0,
            gpAmount: 0,
            reason: 'Clan desactivado',
            createdAt: now,
          }))
        );
      }

      await tx
        .update(teams)
        .set({ isActive: false, updatedAt: now })
        .where(eq(teams.id, clanId));
    });
  }

  // Asignar estudiante a un clan
  async assignStudentToClan(studentId: string, clanId: string) {
    const now = new Date();

    await db.transaction(async (tx) => {
      const [student] = await tx
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentId));

      if (!student || !student.isActive) {
        throw new Error('Estudiante no encontrado');
      }

      const [clan] = await tx
        .select()
        .from(teams)
        .where(and(eq(teams.id, clanId), eq(teams.isActive, true)));

      if (!clan) {
        throw new Error('Clan no encontrado');
      }

      if (student.classroomId !== clan.classroomId) {
        throw new Error('El estudiante y el clan no pertenecen a la misma clase');
      }

      if (student.teamId === clanId) {
        return;
      }

      const [memberCount] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(studentProfiles)
        .where(
          and(
            eq(studentProfiles.teamId, clanId),
            eq(studentProfiles.isActive, true)
          )
        );

      if (Number(memberCount?.count || 0) >= clan.maxMembers) {
        throw new Error('El clan está lleno');
      }

      if (student.teamId) {
        await tx.insert(clanLogs).values({
          id: uuidv4(),
          clanId: student.teamId,
          studentId,
          action: 'MEMBER_LEFT',
          xpAmount: 0,
          gpAmount: 0,
          reason: 'Cambió de clan',
          createdAt: now,
        });
      }

      await tx
        .update(studentProfiles)
        .set({ teamId: clanId, updatedAt: now })
        .where(eq(studentProfiles.id, studentId));

      await tx.insert(clanLogs).values({
        id: uuidv4(),
        clanId,
        studentId,
        action: 'MEMBER_JOINED',
        xpAmount: 0,
        gpAmount: 0,
        reason: 'Se unió al clan',
        createdAt: now,
      });
    });

    return this.getClanById(clanId);
  }

  // Quitar estudiante de un clan
  async removeStudentFromClan(studentId: string) {
    const now = new Date();

    await db.transaction(async (tx) => {
      const [student] = await tx
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentId));

      if (!student || !student.teamId) {
        return;
      }

      await tx.insert(clanLogs).values({
        id: uuidv4(),
        clanId: student.teamId,
        studentId,
        action: 'MEMBER_LEFT',
        xpAmount: 0,
        gpAmount: 0,
        reason: 'Fue removido del clan',
        createdAt: now,
      });

      await tx
        .update(studentProfiles)
        .set({ teamId: null, updatedAt: now })
        .where(eq(studentProfiles.id, studentId));
    });
  }

  // Contribuir XP al clan (llamado cuando un estudiante gana XP)
  async contributeXpToClan(studentId: string, xpAmount: number, reason: string) {
    if (xpAmount <= 0) {
      return null;
    }

    return db.transaction(async (tx) => {
      const [student] = await tx
        .select({ id: studentProfiles.id, teamId: studentProfiles.teamId, classroomId: studentProfiles.classroomId })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentId));

      if (!student?.teamId) {
        return null;
      }

      const [classroom] = await tx
        .select({ clansEnabled: classrooms.clansEnabled, clanXpPercentage: classrooms.clanXpPercentage })
        .from(classrooms)
        .where(eq(classrooms.id, student.classroomId));

      if (!classroom?.clansEnabled) {
        return null;
      }

      const [clan] = await tx
        .select({ id: teams.id })
        .from(teams)
        .where(
          and(
            eq(teams.id, student.teamId),
            eq(teams.classroomId, student.classroomId),
            eq(teams.isActive, true)
          )
        );

      if (!clan) {
        return null;
      }

      const rawClanXp = xpAmount * (classroom.clanXpPercentage / 100);
      const clanXp = rawClanXp >= 0.5 ? Math.max(1, Math.round(rawClanXp)) : 0;

      if (clanXp <= 0) {
        return null;
      }

      await tx
        .update(teams)
        .set({
          totalXp: sql`${teams.totalXp} + ${clanXp}`,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, student.teamId));

      await tx.insert(clanLogs).values({
        id: uuidv4(),
        clanId: student.teamId,
        studentId,
        action: 'XP_CONTRIBUTED',
        xpAmount: clanXp,
        gpAmount: 0,
        reason,
        createdAt: new Date(),
      });

      return { clanId: student.teamId, xpContributed: clanXp };
    });
  }

  // Registrar acción en el historial del clan
  async logClanAction(
    clanId: string,
    studentId: string | null,
    action: string,
    xpAmount: number,
    gpAmount: number,
    reason: string
  ) {
    const payload: ClanLogPayload = {
      clanId,
      studentId,
      action,
      xpAmount,
      gpAmount,
      reason,
    };

    await db.insert(clanLogs).values({
      id: uuidv4(),
      clanId: payload.clanId,
      studentId: payload.studentId,
      action: payload.action,
      xpAmount: payload.xpAmount,
      gpAmount: payload.gpAmount,
      reason: payload.reason,
      createdAt: new Date(),
    });
  }

  // Obtener historial de un clan
  async getClanHistory(clanId: string, limit = 50) {
    const safeLimit = Number.isFinite(limit)
      ? Math.min(200, Math.max(1, Math.floor(limit)))
      : 50;

    const logs = await db
      .select({
        id: clanLogs.id,
        action: clanLogs.action,
        xpAmount: clanLogs.xpAmount,
        gpAmount: clanLogs.gpAmount,
        reason: clanLogs.reason,
        createdAt: clanLogs.createdAt,
        studentId: clanLogs.studentId,
        studentName: studentProfiles.characterName,
      })
      .from(clanLogs)
      .leftJoin(studentProfiles, eq(clanLogs.studentId, studentProfiles.id))
      .where(eq(clanLogs.clanId, clanId))
      .orderBy(desc(clanLogs.createdAt))
      .limit(safeLimit);

    return logs;
  }

  // Top contributors across all clans in a classroom
  async getClassroomTopContributors(classroomId: string, limit = 20) {
    const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));

    // Get all clan IDs for this classroom
    const classroomClans = await db.select({ id: teams.id }).from(teams)
      .where(and(eq(teams.classroomId, classroomId), eq(teams.isActive, true)));

    if (classroomClans.length === 0) return [];

    const clanIds = classroomClans.map(c => c.id);

    const contributors = await db
      .select({
        studentId: clanLogs.studentId,
        studentName: studentProfiles.characterName,
        firstName: users.firstName,
        lastName: users.lastName,
        level: studentProfiles.level,
        totalContributed: sql<number>`COALESCE(SUM(${clanLogs.xpAmount}), 0)`,
        contributions: sql<number>`COUNT(*)`,
        clanId: sql<string>`MAX(${clanLogs.clanId})`,
        clanName: sql<string>`MAX(${teams.name})`,
        clanColor: sql<string>`MAX(${teams.color})`,
        clanEmblem: sql<string>`MAX(${teams.emblem})`,
      })
      .from(clanLogs)
      .innerJoin(studentProfiles, eq(clanLogs.studentId, studentProfiles.id))
      .leftJoin(users, eq(studentProfiles.userId, users.id))
      .innerJoin(teams, eq(clanLogs.clanId, teams.id))
      .where(and(
        inArray(clanLogs.clanId, clanIds),
        inArray(clanLogs.action, ['XP_CONTRIBUTED', 'GP_CONTRIBUTED']),
      ))
      .groupBy(clanLogs.studentId, studentProfiles.characterName, studentProfiles.level, users.firstName, users.lastName)
      .orderBy(desc(sql`COALESCE(SUM(${clanLogs.xpAmount}), 0)`))
      .limit(safeLimit);

    return contributors;
  }

  // Contribution feed across all clans in a classroom
  async getClassroomClanFeed(classroomId: string, limit = 15, cursor?: string) {
    const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));

    const classroomClans = await db.select({ id: teams.id }).from(teams)
      .where(and(eq(teams.classroomId, classroomId), eq(teams.isActive, true)));

    if (classroomClans.length === 0) return { items: [], nextCursor: null };

    const clanIds = classroomClans.map(c => c.id);

    const conditions = [inArray(clanLogs.clanId, clanIds)];
    if (cursor) {
      conditions.push(sql`${clanLogs.createdAt} < ${cursor}`);
    }

    const items = await db
      .select({
        id: clanLogs.id,
        action: clanLogs.action,
        xpAmount: clanLogs.xpAmount,
        reason: clanLogs.reason,
        createdAt: clanLogs.createdAt,
        studentId: clanLogs.studentId,
        studentName: studentProfiles.characterName,
        firstName: users.firstName,
        lastName: users.lastName,
        clanName: teams.name,
        clanColor: teams.color,
        clanEmblem: teams.emblem,
      })
      .from(clanLogs)
      .innerJoin(teams, eq(clanLogs.clanId, teams.id))
      .leftJoin(studentProfiles, eq(clanLogs.studentId, studentProfiles.id))
      .leftJoin(users, eq(studentProfiles.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(clanLogs.createdAt))
      .limit(safeLimit + 1);

    const hasMore = items.length > safeLimit;
    const page = hasMore ? items.slice(0, safeLimit) : items;
    const nextCursor = hasMore && page.length > 0
      ? (page[page.length - 1].createdAt as Date).toISOString()
      : null;

    return { items: page, nextCursor };
  }

  // Obtener ranking de clanes de una clase
  async getClanRanking(classroomId: string) {
    const clans = await db
      .select({
        id: teams.id,
        name: teams.name,
        color: teams.color,
        emblem: teams.emblem,
        totalXp: teams.totalXp,
        wins: teams.wins,
        losses: teams.losses,
      })
      .from(teams)
      .where(and(eq(teams.classroomId, classroomId), eq(teams.isActive, true)))
      .orderBy(desc(teams.totalXp));

    return clans.map((clan, index) => ({
      ...clan,
      rank: index + 1,
    }));
  }

  // Asignar estudiantes aleatoriamente a clanes
  async assignStudentsRandomly(classroomId: string) {
    const now = new Date();

    return db.transaction(async (tx) => {
      const [classroom] = await tx
        .select({ id: classrooms.id, clansEnabled: classrooms.clansEnabled })
        .from(classrooms)
        .where(eq(classrooms.id, classroomId));

      if (!classroom) {
        throw new Error('Clase no encontrada');
      }

      if (!classroom.clansEnabled) {
        throw new Error('Los clanes no están habilitados en esta clase');
      }

      const clans = await tx
        .select()
        .from(teams)
        .where(and(eq(teams.classroomId, classroomId), eq(teams.isActive, true)));

      if (clans.length === 0) {
        throw new Error('No hay clanes creados');
      }

      const clanIds = clans.map((clan) => clan.id);
      const memberCounts = clanIds.length > 0
        ? await tx
            .select({
              teamId: studentProfiles.teamId,
              count: sql<number>`count(*)`,
            })
            .from(studentProfiles)
            .where(
              and(
                inArray(studentProfiles.teamId, clanIds),
                eq(studentProfiles.classroomId, classroomId),
                eq(studentProfiles.isActive, true)
              )
            )
            .groupBy(studentProfiles.teamId)
        : [];

      const countMap = new Map(memberCounts.map((m) => [m.teamId, Number(m.count)]));
      const clansWithSpace = clans
        .map((clan) => ({
          ...clan,
          currentMembers: countMap.get(clan.id) || 0,
          availableSpace: clan.maxMembers - (countMap.get(clan.id) || 0),
        }))
        .filter((clan) => clan.availableSpace > 0);

      if (clansWithSpace.length === 0) {
        throw new Error('Todos los clanes están llenos');
      }

      const studentsWithoutClan = await tx
        .select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(
          and(
            eq(studentProfiles.classroomId, classroomId),
            eq(studentProfiles.isActive, true),
            sql`${studentProfiles.teamId} IS NULL`
          )
        );

      if (studentsWithoutClan.length === 0) {
        return { assigned: 0, clans: clans.length };
      }

      const shuffled = this.shuffleArray(studentsWithoutClan);
      let assigned = 0;
      let clanIndex = 0;
      const logsToInsert: Array<{
        id: string;
        clanId: string;
        studentId: string;
        action: string;
        xpAmount: number;
        gpAmount: number;
        reason: string;
        createdAt: Date;
      }> = [];

      for (const student of shuffled) {
        let attempts = 0;
        while (attempts < clansWithSpace.length) {
          const clan = clansWithSpace[clanIndex % clansWithSpace.length];

          if (clan.availableSpace > 0) {
            await tx
              .update(studentProfiles)
              .set({ teamId: clan.id, updatedAt: now })
              .where(eq(studentProfiles.id, student.id));

            logsToInsert.push({
              id: uuidv4(),
              clanId: clan.id,
              studentId: student.id,
              action: 'MEMBER_JOINED',
              xpAmount: 0,
              gpAmount: 0,
              reason: 'Asignado aleatoriamente',
              createdAt: now,
            });

            clan.availableSpace--;
            clan.currentMembers++;
            assigned++;
            clanIndex++;
            break;
          }

          clanIndex++;
          attempts++;
        }

        if (clansWithSpace.every((c) => c.availableSpace <= 0)) {
          break;
        }
      }

      if (logsToInsert.length > 0) {
        await tx.insert(clanLogs).values(logsToInsert);
      }

      return { assigned, clans: clans.length };
    });
  }

  // Obtener estadísticas del clan de un estudiante
  async getStudentClanInfo(studentId: string) {
    const student = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
    });

    if (!student?.teamId || !student.isActive) {
      return null;
    }

    const clan = await this.getClanById(student.teamId);
    if (!clan || !clan.isActive) {
      return null;
    }

    // Obtener miembros
    const members = await db
      .select({
        id: studentProfiles.id,
        characterName: studentProfiles.characterName,
        level: studentProfiles.level,
        xp: studentProfiles.xp,
        characterClass: studentProfiles.characterClass,
      })
      .from(studentProfiles)
      .where(
        and(
          eq(studentProfiles.teamId, clan.id),
          eq(studentProfiles.isActive, true)
        )
      );

    // Obtener contribución del estudiante
    const contributions = await db
      .select({
        totalXp: sql<number>`COALESCE(SUM(${clanLogs.xpAmount}), 0)`,
      })
      .from(clanLogs)
      .where(and(
        eq(clanLogs.clanId, clan.id),
        eq(clanLogs.studentId, studentId),
        eq(clanLogs.action, 'XP_CONTRIBUTED')
      ));

    // Obtener ranking del clan
    const ranking = await this.getClanRanking(student.classroomId);
    const clanRank = ranking.find(r => r.id === clan.id)?.rank || 0;

    return {
      clan: {
        id: clan.id,
        name: clan.name,
        color: clan.color,
        emblem: clan.emblem,
        motto: clan.motto,
        totalXp: clan.totalXp,
        wins: clan.wins,
        losses: clan.losses,
        rank: clanRank,
      },
      members,
      myContribution: contributions[0]?.totalXp || 0,
    };
  }
}

export const clanService = new ClanService();
