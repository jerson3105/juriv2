import { db } from '../db/index.js';
import { teams, clanLogs, studentProfiles, classrooms, users } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
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

export class ClanService {
  // Crear un nuevo clan
  async createClan(data: CreateClanData) {
    const id = uuidv4();
    const now = new Date();

    await db.insert(teams).values({
      id,
      classroomId: data.classroomId,
      name: data.name,
      color: data.color || CLAN_COLORS[Math.floor(Math.random() * CLAN_COLORS.length)],
      emblem: data.emblem || CLAN_EMBLEMS[Math.floor(Math.random() * CLAN_EMBLEMS.length)],
      motto: data.motto || null,
      maxMembers: data.maxMembers || 10,
      totalXp: 0,
      totalGp: 0,
      wins: 0,
      losses: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
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

    // Obtener miembros de cada clan
    const clansWithMembers = await Promise.all(
      clans.map(async (clan) => {
        const members = await db
          .select({
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
          .where(and(
            eq(studentProfiles.teamId, clan.id),
            eq(studentProfiles.isActive, true)
          ));

        return {
          ...clan,
          members,
          memberCount: members.length,
        };
      })
    );

    return clansWithMembers;
  }

  // Actualizar clan
  async updateClan(clanId: string, data: UpdateClanData) {
    await db
      .update(teams)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, clanId));

    return this.getClanById(clanId);
  }

  // Eliminar clan (soft delete)
  async deleteClan(clanId: string) {
    // Primero quitar a todos los miembros
    await db
      .update(studentProfiles)
      .set({ teamId: null, updatedAt: new Date() })
      .where(eq(studentProfiles.teamId, clanId));

    // Desactivar el clan
    await db
      .update(teams)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(teams.id, clanId));
  }

  // Asignar estudiante a un clan
  async assignStudentToClan(studentId: string, clanId: string) {
    const student = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
    });

    if (!student) {
      throw new Error('Estudiante no encontrado');
    }

    const clan = await this.getClanById(clanId);
    if (!clan) {
      throw new Error('Clan no encontrado');
    }

    // Verificar que el clan tiene espacio
    const memberCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(studentProfiles)
      .where(eq(studentProfiles.teamId, clanId));

    if (memberCount[0].count >= clan.maxMembers) {
      throw new Error('El clan está lleno');
    }

    // Si el estudiante ya estaba en otro clan, registrar salida
    if (student.teamId && student.teamId !== clanId) {
      await this.logClanAction(student.teamId, studentId, 'MEMBER_LEFT', 0, 0, 'Cambió de clan');
    }

    // Asignar al nuevo clan
    await db
      .update(studentProfiles)
      .set({ teamId: clanId, updatedAt: new Date() })
      .where(eq(studentProfiles.id, studentId));

    // Registrar entrada al clan
    await this.logClanAction(clanId, studentId, 'MEMBER_JOINED', 0, 0, 'Se unió al clan');

    return this.getClanById(clanId);
  }

  // Quitar estudiante de un clan
  async removeStudentFromClan(studentId: string) {
    const student = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
    });

    if (!student || !student.teamId) {
      return;
    }

    // Registrar salida
    await this.logClanAction(student.teamId, studentId, 'MEMBER_LEFT', 0, 0, 'Fue removido del clan');

    // Quitar del clan
    await db
      .update(studentProfiles)
      .set({ teamId: null, updatedAt: new Date() })
      .where(eq(studentProfiles.id, studentId));
  }

  // Contribuir XP al clan (llamado cuando un estudiante gana XP)
  async contributeXpToClan(studentId: string, xpAmount: number, reason: string) {
    const student = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
    });

    if (!student || !student.teamId) {
      return null;
    }

    // Obtener configuración de la clase
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, student.classroomId),
    });

    if (!classroom?.clansEnabled) {
      return null;
    }

    // Calcular XP a contribuir según porcentaje configurado
    // Usar Math.max(1, ...) para garantizar al menos 1 XP si hay contribución
    const rawClanXp = xpAmount * (classroom.clanXpPercentage / 100);
    const clanXp = rawClanXp >= 0.5 ? Math.max(1, Math.round(rawClanXp)) : 0;

    if (clanXp <= 0) {
      return null;
    }

    // Actualizar XP del clan
    await db
      .update(teams)
      .set({
        totalXp: sql`${teams.totalXp} + ${clanXp}`,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, student.teamId));

    // Registrar contribución
    await this.logClanAction(student.teamId, studentId, 'XP_CONTRIBUTED', clanXp, 0, reason);

    return { clanId: student.teamId, xpContributed: clanXp };
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
    await db.insert(clanLogs).values({
      id: uuidv4(),
      clanId,
      studentId,
      action,
      xpAmount,
      gpAmount,
      reason,
      createdAt: new Date(),
    });
  }

  // Obtener historial de un clan
  async getClanHistory(clanId: string, limit = 50) {
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
      .limit(limit);

    return logs;
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
    // Obtener clanes activos con conteo de miembros
    const clans = await db
      .select()
      .from(teams)
      .where(and(eq(teams.classroomId, classroomId), eq(teams.isActive, true)));

    if (clans.length === 0) {
      throw new Error('No hay clanes creados');
    }

    // Obtener conteo de miembros por clan
    const memberCounts = await db
      .select({
        teamId: studentProfiles.teamId,
        count: sql<number>`count(*)`,
      })
      .from(studentProfiles)
      .where(sql`${studentProfiles.teamId} IS NOT NULL`)
      .groupBy(studentProfiles.teamId);

    const countMap = new Map(memberCounts.map(m => [m.teamId, Number(m.count)]));

    // Crear lista de clanes con espacio disponible
    const clansWithSpace = clans
      .map(clan => ({
        ...clan,
        currentMembers: countMap.get(clan.id) || 0,
        availableSpace: clan.maxMembers - (countMap.get(clan.id) || 0),
      }))
      .filter(clan => clan.availableSpace > 0);

    if (clansWithSpace.length === 0) {
      throw new Error('Todos los clanes están llenos');
    }

    // Obtener estudiantes sin clan
    const studentsWithoutClan = await db
      .select()
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true),
        sql`${studentProfiles.teamId} IS NULL`
      ));

    if (studentsWithoutClan.length === 0) {
      return { assigned: 0, clans: clans.length };
    }

    // Mezclar estudiantes aleatoriamente
    const shuffled = studentsWithoutClan.sort(() => Math.random() - 0.5);

    // Asignar equitativamente solo a clanes con espacio
    let assigned = 0;
    let clanIndex = 0;

    for (const student of shuffled) {
      // Buscar el siguiente clan con espacio disponible
      let attempts = 0;
      while (attempts < clansWithSpace.length) {
        const clan = clansWithSpace[clanIndex % clansWithSpace.length];
        
        if (clan.availableSpace > 0) {
          // Asignar directamente sin verificar de nuevo (ya sabemos que hay espacio)
          await db
            .update(studentProfiles)
            .set({ teamId: clan.id, updatedAt: new Date() })
            .where(eq(studentProfiles.id, student.id));
          
          await this.logClanAction(clan.id, student.id, 'MEMBER_JOINED', 0, 0, 'Asignado aleatoriamente');
          
          clan.availableSpace--;
          clan.currentMembers++;
          assigned++;
          clanIndex++;
          break;
        }
        
        clanIndex++;
        attempts++;
      }

      // Si todos los clanes están llenos, salir
      if (clansWithSpace.every(c => c.availableSpace <= 0)) {
        break;
      }
    }

    return { assigned, clans: clans.length };
  }

  // Obtener estadísticas del clan de un estudiante
  async getStudentClanInfo(studentId: string) {
    const student = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
    });

    if (!student?.teamId) {
      return null;
    }

    const clan = await this.getClanById(student.teamId);
    if (!clan) {
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
      .where(eq(studentProfiles.teamId, clan.id));

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
