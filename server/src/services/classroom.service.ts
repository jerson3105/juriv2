import { db } from '../db/index.js';
import { 
  classrooms, 
  studentProfiles, 
  users, 
  teams,
  pointLogs,
  behaviors,
  powers,
  powerUsages,
  bossBattles,
  battleParticipants,
  battleAnswers,
  battleResults,
  shopItems,
  purchases,
  itemUsages,
  badges,
  studentBadges,
  badgeProgress,
  studentAvatarPurchases,
  studentEquippedItems,
  attendanceRecords,
  questionBanks,
  questions,
  timedActivities,
  timedActivityResults,
  studentBossBattles,
  studentBossBattleParticipants,
  studentBossBattleAttempts,
  clanLogs
} from '../db/schema.js';
import { eq, and, desc, inArray, sql, count } from 'drizzle-orm';
import { generateClassCode } from '../utils/helpers.js';
import { v4 as uuidv4 } from 'uuid';
import { avatarService } from './avatar.service.js';

type AvatarGender = 'MALE' | 'FEMALE';

interface CreateClassroomData {
  name: string;
  description?: string;
  teacherId: string;
  gradeLevel?: string;
}

interface UpdateClassroomData {
  name?: string;
  description?: string | null;
  bannerUrl?: string | null;
  gradeLevel?: string | null;
  isActive?: boolean;
  defaultXp?: number;
  defaultHp?: number;
  defaultGp?: number;
  maxHp?: number;
  xpPerLevel?: number;
  allowNegativeHp?: boolean;
  allowNegativePoints?: boolean;
  showReasonToStudent?: boolean;
  notifyOnPoints?: boolean;
  shopEnabled?: boolean;
  requirePurchaseApproval?: boolean;
  dailyPurchaseLimit?: number | null;
  showCharacterName?: boolean;
  // Clanes
  clansEnabled?: boolean;
  clanXpPercentage?: number;
  clanBattlesEnabled?: boolean;
  clanGpRewardEnabled?: boolean;
  // Racha de login
  loginStreakEnabled?: boolean;
  loginStreakConfig?: {
    dailyXp: number;
    milestones: Array<{
      day: number;
      xp: number;
      gp: number;
      randomItem: boolean;
    }>;
    resetOnMiss: boolean;
    graceDays: number;
  } | null;
}

export class ClassroomService {
  async create(data: CreateClassroomData) {
    const id = uuidv4();
    const code = generateClassCode();
    const now = new Date();
    
    await db.insert(classrooms).values({
      id,
      name: data.name,
      description: data.description || null,
      teacherId: data.teacherId,
      gradeLevel: data.gradeLevel || null,
      code,
      createdAt: now,
      updatedAt: now,
    });

    return db.query.classrooms.findFirst({
      where: eq(classrooms.id, id),
    });
  }

  async getByTeacher(teacherId: string) {
    // Obtener clases con conteo de estudiantes en una sola query (evita N+1)
    const results = await db.query.classrooms.findMany({
      where: eq(classrooms.teacherId, teacherId),
      orderBy: [desc(classrooms.createdAt)],
    });

    if (results.length === 0) return [];

    // Obtener conteo de estudiantes por clase en una sola query
    const classroomIds = results.map(c => c.id);
    const studentCounts = await db
      .select({
        classroomId: studentProfiles.classroomId,
        count: count(),
      })
      .from(studentProfiles)
      .where(inArray(studentProfiles.classroomId, classroomIds))
      .groupBy(studentProfiles.classroomId);

    // Crear mapa de conteos
    const countMap = new Map(studentCounts.map(sc => [sc.classroomId, Number(sc.count)]));

    return results.map((c) => {
      // Parsear JSON si viene como string (bug de MySQL/Drizzle)
      let loginStreakConfig = c.loginStreakConfig;
      if (loginStreakConfig && typeof loginStreakConfig === 'string') {
        try {
          loginStreakConfig = JSON.parse(loginStreakConfig);
        } catch (e) {
          // Silenciar error de parsing
        }
      }
      
      return { ...c, loginStreakConfig, studentCount: countMap.get(c.id) || 0 };
    });
  }

  async getById(classroomId: string) {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, classroomId),
    });
    
    if (classroom && classroom.loginStreakConfig) {
      // Parsear JSON si viene como string (bug de MySQL/Drizzle)
      if (typeof classroom.loginStreakConfig === 'string') {
        try {
          (classroom as any).loginStreakConfig = JSON.parse(classroom.loginStreakConfig);
        } catch (e) {
          console.error('Error parsing loginStreakConfig:', e);
        }
      }
    }
    
    return classroom;
  }

  async getStudents(classroomId: string) {
    return db.select({
      id: studentProfiles.id,
      characterName: studentProfiles.characterName,
      avatarUrl: studentProfiles.avatarUrl,
      characterClass: studentProfiles.characterClass,
      avatarGender: studentProfiles.avatarGender,
      level: studentProfiles.level,
      xp: studentProfiles.xp,
      hp: studentProfiles.hp,
      gp: studentProfiles.gp,
      bossKills: studentProfiles.bossKills,
      teamId: studentProfiles.teamId,
      isActive: studentProfiles.isActive,
      isDemo: studentProfiles.isDemo,
      // Datos del usuario real
      realName: users.firstName,
      realLastName: users.lastName,
      // Datos del clan
      clanName: teams.name,
      clanColor: teams.color,
      clanEmblem: teams.emblem,
    }).from(studentProfiles)
      .leftJoin(users, eq(studentProfiles.userId, users.id))
      .leftJoin(teams, eq(studentProfiles.teamId, teams.id))
      .where(eq(studentProfiles.classroomId, classroomId));
  }

  async update(classroomId: string, teacherId: string, data: UpdateClassroomData) {
    const classroom = await this.getById(classroomId);
    if (!classroom || classroom.teacherId !== teacherId) {
      throw new Error('No autorizado');
    }

    await db.update(classrooms)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(classrooms.id, classroomId));

    return this.getById(classroomId);
  }

  async delete(classroomId: string, teacherId: string) {
    const classroom = await this.getById(classroomId);
    if (!classroom || classroom.teacherId !== teacherId) {
      throw new Error('No autorizado');
    }

    // Obtener IDs de estudiantes de esta clase
    const students = await db.query.studentProfiles.findMany({
      where: eq(studentProfiles.classroomId, classroomId),
      columns: { id: true }
    });
    const studentIds = students.map(s => s.id);

    // Obtener IDs de equipos/clanes de esta clase
    const classTeams = await db.query.teams.findMany({
      where: eq(teams.classroomId, classroomId),
      columns: { id: true }
    });
    const teamIds = classTeams.map(t => t.id);

    // Obtener IDs de boss battles de esta clase
    const battles = await db.query.bossBattles.findMany({
      where: eq(bossBattles.classroomId, classroomId),
      columns: { id: true }
    });
    const battleIds = battles.map(b => b.id);

    // Obtener IDs de student boss battles de esta clase
    const studentBattles = await db.query.studentBossBattles.findMany({
      where: eq(studentBossBattles.classroomId, classroomId),
      columns: { id: true }
    });
    const studentBattleIds = studentBattles.map(b => b.id);

    // Obtener IDs de timed activities de esta clase
    const activities = await db.query.timedActivities.findMany({
      where: eq(timedActivities.classroomId, classroomId),
      columns: { id: true }
    });
    const activityIds = activities.map(a => a.id);

    // Obtener IDs de badges de esta clase
    const classBadges = await db.query.badges.findMany({
      where: eq(badges.classroomId, classroomId),
      columns: { id: true }
    });
    const badgeIds = classBadges.map(b => b.id);

    // Obtener IDs de question banks de esta clase
    const qBanks = await db.query.questionBanks.findMany({
      where: eq(questionBanks.classroomId, classroomId),
      columns: { id: true }
    });
    const qBankIds = qBanks.map(q => q.id);

    // Obtener IDs de shop items de esta clase
    const items = await db.query.shopItems.findMany({
      where: eq(shopItems.classroomId, classroomId),
      columns: { id: true }
    });
    const itemIds = items.map(i => i.id);

    // Obtener IDs de powers de esta clase
    const classPowers = await db.query.powers.findMany({
      where: eq(powers.classroomId, classroomId),
      columns: { id: true }
    });
    const powerIds = classPowers.map(p => p.id);

    // Eliminar en orden correcto (dependencias primero)
    
    // 1. Eliminar datos relacionados con estudiantes
    if (studentIds.length > 0) {
      await db.delete(pointLogs).where(inArray(pointLogs.studentId, studentIds));
      await db.delete(studentAvatarPurchases).where(inArray(studentAvatarPurchases.studentProfileId, studentIds));
      await db.delete(studentEquippedItems).where(inArray(studentEquippedItems.studentProfileId, studentIds));
      await db.delete(attendanceRecords).where(eq(attendanceRecords.classroomId, classroomId));
    }

    // 2. Eliminar datos de badges
    if (badgeIds.length > 0) {
      await db.delete(badgeProgress).where(inArray(badgeProgress.badgeId, badgeIds));
      await db.delete(studentBadges).where(inArray(studentBadges.badgeId, badgeIds));
      await db.delete(badges).where(inArray(badges.id, badgeIds));
    }

    // 3. Eliminar datos de boss battles clásicas
    if (battleIds.length > 0) {
      // Obtener participantes
      const participants = await db.query.battleParticipants.findMany({
        where: inArray(battleParticipants.battleId, battleIds),
        columns: { id: true }
      });
      const participantIds = participants.map(p => p.id);
      
      if (participantIds.length > 0) {
        await db.delete(battleAnswers).where(inArray(battleAnswers.participantId, participantIds));
      }
      await db.delete(battleParticipants).where(inArray(battleParticipants.battleId, battleIds));
      await db.delete(battleResults).where(inArray(battleResults.battleId, battleIds));
      await db.delete(bossBattles).where(inArray(bossBattles.id, battleIds));
    }

    // 4. Eliminar datos de student boss battles
    if (studentBattleIds.length > 0) {
      // Obtener participantes
      const sbParticipants = await db.query.studentBossBattleParticipants.findMany({
        where: inArray(studentBossBattleParticipants.battleId, studentBattleIds),
        columns: { id: true }
      });
      const sbParticipantIds = sbParticipants.map(p => p.id);
      
      if (sbParticipantIds.length > 0) {
        await db.delete(studentBossBattleAttempts).where(inArray(studentBossBattleAttempts.participantId, sbParticipantIds));
      }
      await db.delete(studentBossBattleParticipants).where(inArray(studentBossBattleParticipants.battleId, studentBattleIds));
      await db.delete(studentBossBattles).where(inArray(studentBossBattles.id, studentBattleIds));
    }

    // 5. Eliminar datos de timed activities
    if (activityIds.length > 0) {
      await db.delete(timedActivityResults).where(inArray(timedActivityResults.activityId, activityIds));
      await db.delete(timedActivities).where(inArray(timedActivities.id, activityIds));
    }

    // 6. Eliminar datos de tienda
    if (itemIds.length > 0) {
      // Obtener purchases
      const itemPurchases = await db.query.purchases.findMany({
        where: inArray(purchases.itemId, itemIds),
        columns: { id: true }
      });
      const purchaseIds = itemPurchases.map(p => p.id);
      
      if (purchaseIds.length > 0) {
        await db.delete(itemUsages).where(inArray(itemUsages.purchaseId, purchaseIds));
      }
      await db.delete(purchases).where(inArray(purchases.itemId, itemIds));
      await db.delete(shopItems).where(inArray(shopItems.id, itemIds));
    }

    // 7. Eliminar datos de poderes
    if (powerIds.length > 0) {
      await db.delete(powerUsages).where(inArray(powerUsages.powerId, powerIds));
      await db.delete(powers).where(inArray(powers.id, powerIds));
    }

    // 8. Eliminar banco de preguntas
    if (qBankIds.length > 0) {
      await db.delete(questions).where(inArray(questions.bankId, qBankIds));
      await db.delete(questionBanks).where(inArray(questionBanks.id, qBankIds));
    }

    // 9. Eliminar datos de clanes/equipos
    if (teamIds.length > 0) {
      await db.delete(clanLogs).where(inArray(clanLogs.clanId, teamIds));
      await db.delete(teams).where(inArray(teams.id, teamIds));
    }

    // 10. Eliminar comportamientos
    await db.delete(behaviors).where(eq(behaviors.classroomId, classroomId));

    // 11. Eliminar perfiles de estudiantes
    if (studentIds.length > 0) {
      await db.delete(studentProfiles).where(inArray(studentProfiles.id, studentIds));
    }

    // 12. Finalmente eliminar la clase
    await db.delete(classrooms).where(eq(classrooms.id, classroomId));
    
    return { success: true };
  }

  async joinByCode(code: string, userId: string, characterName: string, characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST', avatarGender: AvatarGender = 'MALE') {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.code, code.toUpperCase()),
    });

    if (!classroom) throw new Error('Código de clase inválido');
    if (!classroom.isActive) throw new Error('Esta clase no está activa');

    const existing = await db.query.studentProfiles.findFirst({
      where: and(
        eq(studentProfiles.classroomId, classroom.id),
        eq(studentProfiles.userId, userId)
      ),
    });

    if (existing) throw new Error('Ya estás inscrito en esta clase');

    const id = uuidv4();
    const now = new Date();

    await db.insert(studentProfiles).values({
      id,
      userId,
      classroomId: classroom.id,
      characterName,
      characterClass,
      avatarGender,
      hp: classroom.defaultHp,
      xp: classroom.defaultXp,
      gp: classroom.defaultGp,
      createdAt: now,
      updatedAt: now,
    });

    // Equipar items de avatar por defecto
    await avatarService.equipDefaultItems(id, avatarGender);

    return { classroom, profileId: id };
  }

  // Resetear puntos de todos los estudiantes
  async resetAllPoints(classroomId: string, teacherId: string) {
    const classroom = await this.getById(classroomId);
    if (!classroom || classroom.teacherId !== teacherId) {
      throw new Error('No autorizado');
    }

    const now = new Date();
    
    // Resetear XP, HP y GP a los valores por defecto de la clase
    await db.update(studentProfiles).set({
      xp: classroom.defaultXp,
      hp: classroom.defaultHp,
      gp: classroom.defaultGp,
      level: 1,
      updatedAt: now,
    }).where(eq(studentProfiles.classroomId, classroomId));

    return { success: true, message: 'Puntos reseteados' };
  }
}

export const classroomService = new ClassroomService();
