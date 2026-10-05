import { v4 as uuid } from 'uuid';
import { eq, and, or, inArray, gte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clanService } from './clan.service.js';
import { storyService } from './story.service.js';
import { emitUnreadCount } from '../utils/notificationEmitter.js';
import { 
  badges, 
  studentBadges, 
  studentProfiles,
  behaviors,
  pointLogs,
  notifications,
  classrooms,
  users,
  type Badge,
  type StudentBadge,
  type BadgeCategory,
  type BadgeRarity,
  type BadgeAssignment,
} from '../db/schema.js';
import { addXpGp } from '../utils/points.js';
import { dependsOnXp, parseBadgeCondition } from '../utils/badgeConditions.js';

// Tipos para condiciones
export interface BadgeCondition {
  type: string;
  value?: number;
  count?: number;
  behaviorId?: string;
  category?: 'positive' | 'negative';
  period?: string;
  conditions?: BadgeCondition[];
  operator?: 'AND' | 'OR';
}

export interface BadgeEvent {
  type: 'POINTS_ADDED' | 'LEVEL_UP' | 'PURCHASE_MADE' | 'BEHAVIOR_APPLIED' | 'LOGIN';
  data: {
    studentProfileId: string;
    classroomId: string;
    totalXp?: number;
    level?: number;
    behaviorId?: string;
    behaviorType?: 'positive' | 'negative';
    totalPurchases?: number;
  };
}

export interface CreateBadgeDto {
  classroomId: string;
  name: string;
  description: string;
  icon: string;
  customImage?: string | null;
  category?: BadgeCategory;
  rarity?: BadgeRarity;
  assignmentMode: BadgeAssignment;
  unlockCondition?: BadgeCondition | null;
  rewardXp?: number;
  rewardGp?: number;
  isSecret?: boolean;
  competencyId?: string;
}

class BadgeService {
  private getBadgeAwardLimit(badge: Pick<Badge, 'maxAwards'>): number | null {
    if (badge.maxAwards == null) return null;
    return badge.maxAwards > 0 ? badge.maxAwards : null;
  }

  private canAwardBadge(badge: Pick<Badge, 'maxAwards'>, currentCount: number): boolean {
    const limit = this.getBadgeAwardLimit(badge);
    if (limit == null) return true;
    return currentCount < limit;
  }

  // Manual: las insignias de la clase son acumulables (×2, ×3…); las del sistema respetan su límite.
  private canAwardManually(badge: Pick<Badge, 'maxAwards' | 'scope'>, currentCount: number): boolean {
    return badge.scope === 'CLASSROOM' ? true : this.canAwardBadge(badge, currentCount);
  }

  // Automática: una sola vez salvo que el límite diga otra cosa; si no, se volvería a otorgar
  // en cada evento mientras la condición siga cumpliéndose.
  private canAwardAutomatically(badge: Pick<Badge, 'maxAwards'>, currentCount: number): boolean {
    return currentCount < (this.getBadgeAwardLimit(badge) ?? 1);
  }
  
  // ═══════════════════════════════════════════════════════════
  // CRUD de Insignias
  // ═══════════════════════════════════════════════════════════
  
  async createBadge(data: CreateBadgeDto, teacherId: string): Promise<Badge> {
    const now = new Date();
    const newBadge = {
      id: uuid(),
      scope: 'CLASSROOM' as const,
      classroomId: data.classroomId,
      createdBy: teacherId,
      name: data.name,
      description: data.description,
      icon: data.icon,
      customImage: data.customImage || null,
      category: data.category || 'CUSTOM' as const,
      rarity: data.rarity || 'COMMON' as const,
      assignmentMode: data.assignmentMode,
      unlockCondition: data.unlockCondition || null,
      rewardXp: data.rewardXp || 0,
      rewardGp: data.rewardGp || 0,
      maxAwards: 1,
      competencyId: data.competencyId || null,
      isSecret: data.isSecret || false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    
    await db.insert(badges).values(newBadge);
    return newBadge as Badge;
  }
  
  async updateBadge(badgeId: string, data: Partial<CreateBadgeDto>): Promise<void> {
    await db.update(badges)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(badges.id, badgeId));
  }
  
  // Archivar: deja de mostrarse y de otorgarse, pero los alumnos conservan lo que ganaron.
  async archiveBadge(badgeId: string): Promise<void> {
    await db.update(badges)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(badges.id, badgeId));
  }

  async restoreBadge(badgeId: string): Promise<void> {
    await db.update(badges)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(badges.id, badgeId));
  }

  // Veces que cada alumno de la clase tiene cada insignia, con el último otorgamiento
  // (su id sirve para revertirlo desde Ganadores).
  async getClassroomAwardCounts(classroomId: string): Promise<{
    studentProfileId: string;
    badgeId: string;
    count: number;
    lastStudentBadgeId: string;
    lastAwardedAt: Date;
  }[]> {
    const rows = await db.select({
      id: studentBadges.id,
      studentProfileId: studentBadges.studentProfileId,
      badgeId: studentBadges.badgeId,
      unlockedAt: studentBadges.unlockedAt,
    })
      .from(studentBadges)
      .innerJoin(studentProfiles, eq(studentBadges.studentProfileId, studentProfiles.id))
      .where(and(eq(studentProfiles.classroomId, classroomId), eq(studentProfiles.isActive, true)));

    const grouped = new Map<string, { studentProfileId: string; badgeId: string; count: number; lastStudentBadgeId: string; lastAwardedAt: Date }>();
    for (const row of rows) {
      const key = `${row.studentProfileId}:${row.badgeId}`;
      const unlockedAt = new Date(row.unlockedAt);
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, { studentProfileId: row.studentProfileId, badgeId: row.badgeId, count: 1, lastStudentBadgeId: row.id, lastAwardedAt: unlockedAt });
      } else {
        current.count++;
        if (unlockedAt > current.lastAwardedAt) {
          current.lastAwardedAt = unlockedAt;
          current.lastStudentBadgeId = row.id;
        }
      }
    }
    return Array.from(grouped.values());
  }
  
  async getXpPerLevel(classroomId: string): Promise<number> {
    const [classroom] = await db.select({ xpPerLevel: classrooms.xpPerLevel }).from(classrooms).where(eq(classrooms.id, classroomId));
    return classroom?.xpPerLevel || 100;
  }

  /** Motivos que el profe ya usó con esta insignia (los más recientes, sin repetir): sus motivos rápidos. */
  async getRecentReasons(badgeId: string, limit = 4): Promise<string[]> {
    const rows = await db.select({ reason: studentBadges.awardReason })
      .from(studentBadges)
      .where(and(eq(studentBadges.badgeId, badgeId), sql`${studentBadges.awardedBy} IS NOT NULL`, sql`TRIM(COALESCE(${studentBadges.awardReason}, '')) <> ''`))
      .orderBy(sql`${studentBadges.unlockedAt} DESC`)
      .limit(50);
    const seen = new Set<string>();
    const reasons: string[] = [];
    for (const row of rows) {
      const reason = (row.reason ?? '').trim();
      // Los de la historia los pone el sistema, no el profe.
      if (!reason || reason.startsWith('Historia:') || seen.has(reason.toLocaleLowerCase('es'))) continue;
      seen.add(reason.toLocaleLowerCase('es'));
      reasons.push(reason);
      if (reasons.length >= limit) break;
    }
    return reasons;
  }

  async getBadgeById(badgeId: string): Promise<Badge | null> {
    const result = await db.select().from(badges).where(eq(badges.id, badgeId));
    return result[0] || null;
  }
  
  async getClassroomBadges(classroomId: string): Promise<Badge[]> {
    // Retorna insignias del sistema + insignias de la clase
    try {
      const result = await db.select().from(badges).where(
        and(
          eq(badges.isActive, true),
          or(
            eq(badges.scope, 'SYSTEM'),
            eq(badges.classroomId, classroomId)
          )
        )
      );
      return result;
    } catch (error) {
      console.error('Error getting classroom badges:', error);
      // Si falla, intentar solo las de la clase
      return await db.select().from(badges).where(
        and(
          eq(badges.isActive, true),
          eq(badges.classroomId, classroomId)
        )
      );
    }
  }
  
  async getSystemBadges(): Promise<Badge[]> {
    return await db.select().from(badges).where(
      and(
        eq(badges.scope, 'SYSTEM'),
        eq(badges.isActive, true)
      )
    );
  }
  
  async getClassroomBadgeStats(classroomId: string): Promise<{
    totalBadges: number;
    totalAwarded: number;
    studentsWithBadges: number;
    totalStudents: number;
    mostAwardedBadge: { name: string; icon: string; count: number } | null;
    recentAwards: { studentName: string; badgeName: string; badgeIcon: string; awardedAt: Date }[];
    badgeDistribution: { name: string; icon: string; count: number }[];
  }> {
    // Obtener todas las insignias de la clase
    const classroomBadges = await this.getClassroomBadges(classroomId);
    
    // Obtener estudiantes de la clase
    const students = await db.select().from(studentProfiles).where(and(eq(studentProfiles.classroomId, classroomId), eq(studentProfiles.isActive, true)));
    
    if (students.length === 0) {
      return {
        totalBadges: classroomBadges.length,
        totalAwarded: 0,
        studentsWithBadges: 0,
        totalStudents: 0,
        mostAwardedBadge: null,
        recentAwards: [],
        badgeDistribution: [],
      };
    }
    
    const studentIds = students.map(s => s.id);
    const studentMap = new Map(students.map(s => [s.id, s]));
    
    // Obtener insignias otorgadas
    const allStudentBadges = await db.select()
      .from(studentBadges)
      .where(inArray(studentBadges.studentProfileId, studentIds));
    
    if (allStudentBadges.length === 0) {
      return {
        totalBadges: classroomBadges.length,
        totalAwarded: 0,
        studentsWithBadges: 0,
        totalStudents: students.length,
        mostAwardedBadge: null,
        recentAwards: [],
        badgeDistribution: [],
      };
    }
    
    // Obtener info de las insignias
    const badgeIdsList = [...new Set(allStudentBadges.map(sb => sb.badgeId))];
    const badgesList = await db.select().from(badges).where(inArray(badges.id, badgeIdsList));
    const badgeMap = new Map(badgesList.map(b => [b.id, b]));
    
    // Contar insignias por tipo
    const badgeCounts = new Map<string, { name: string; icon: string; count: number }>();
    for (const sb of allStudentBadges) {
      const badge = badgeMap.get(sb.badgeId);
      if (!badge) continue;
      const existing = badgeCounts.get(sb.badgeId);
      if (existing) {
        existing.count++;
      } else {
        badgeCounts.set(sb.badgeId, { 
          name: badge.name, 
          icon: badge.customImage || badge.icon, 
          count: 1 
        });
      }
    }
    
    // Estudiantes únicos con insignias
    const studentsWithBadgesSet = new Set(allStudentBadges.map(sb => sb.studentProfileId));
    
    // Insignia más otorgada
    let mostAwarded: { name: string; icon: string; count: number } | null = null;
    for (const badge of badgeCounts.values()) {
      if (!mostAwarded || badge.count > mostAwarded.count) {
        mostAwarded = badge;
      }
    }
    
    // Últimas 5 insignias otorgadas
    const sortedByDate = [...allStudentBadges].sort((a, b) => 
      new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime()
    );
    const recentAwards = sortedByDate.slice(0, 5).map(sb => {
      const badge = badgeMap.get(sb.badgeId);
      const student = studentMap.get(sb.studentProfileId);
      return {
        studentName: student?.characterName || 'Estudiante',
        badgeName: badge?.name || 'Insignia',
        badgeIcon: badge?.customImage || badge?.icon || '🏅',
        awardedAt: sb.unlockedAt,
      };
    });
    
    return {
      totalBadges: classroomBadges.length,
      totalAwarded: allStudentBadges.length,
      studentsWithBadges: studentsWithBadgesSet.size,
      totalStudents: students.length,
      mostAwardedBadge: mostAwarded,
      recentAwards,
      badgeDistribution: Array.from(badgeCounts.values()).sort((a, b) => b.count - a.count),
    };
  }

  async getClassroomAwardsBreakdown(
    classroomId: string,
    filters?: {
      search?: string;
      rarity?: BadgeRarity;
      assignmentMode?: BadgeAssignment;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{
    summary: {
      totalAwards: number;
      totalStudentsInClassroom: number;
      totalStudentsWithAwards: number;
      totalBadgesAwarded: number;
      mostAwardedBadge: { id: string; name: string; icon: string | null; count: number } | null;
    };
    recentAwards: Array<{
      studentProfileId: string;
      studentName: string;
      badgeId: string;
      badgeName: string;
      badgeIcon: string | null;
      awardedAt: Date;
      awardReason: string | null;
    }>;
    byBadge: Array<{
      badgeId: string;
      badgeName: string;
      badgeIcon: string | null;
      rarity: BadgeRarity;
      assignmentMode: BadgeAssignment;
      totalAwards: number;
      uniqueStudents: number;
      lastAwardedAt: Date;
      winners: Array<{
        studentProfileId: string;
        studentName: string;
        characterName: string | null;
        realName: string | null;
        realLastName: string | null;
        level: number;
        avatarGender: string;
        awardCount: number;
        lastAwardedAt: Date;
        lastAwardReason: string | null;
      }>;
    }>;
    byStudent: Array<{
      studentProfileId: string;
      studentName: string;
      characterName: string | null;
      realName: string | null;
      realLastName: string | null;
      level: number;
      avatarGender: string;
      totalAwards: number;
      uniqueBadges: number;
      lastAwardedAt: Date;
      badges: Array<{
        badgeId: string;
        badgeName: string;
        badgeIcon: string | null;
        rarity: BadgeRarity;
        assignmentMode: BadgeAssignment;
        awardCount: number;
        lastAwardedAt: Date;
      }>;
    }>;
  }> {
    const students = await db
      .select({
        id: studentProfiles.id,
        characterName: studentProfiles.characterName,
        realName: users.firstName,
        realLastName: users.lastName,
        level: studentProfiles.level,
        avatarGender: studentProfiles.avatarGender,
      })
      .from(studentProfiles)
      .leftJoin(users, eq(studentProfiles.userId, users.id))
      .where(and(eq(studentProfiles.classroomId, classroomId), eq(studentProfiles.isActive, true)));

    if (students.length === 0) {
      return {
        summary: {
          totalAwards: 0,
          totalStudentsInClassroom: 0,
          totalStudentsWithAwards: 0,
          totalBadgesAwarded: 0,
          mostAwardedBadge: null,
        },
        recentAwards: [],
        byBadge: [],
        byStudent: [],
      };
    }

    const studentIds = students.map((student) => student.id);

    const studentNameById = new Map<string, {
      characterName: string | null;
      realName: string | null;
      realLastName: string | null;
      level: number;
      avatarGender: string;
    }>();

    for (const student of students) {
      studentNameById.set(student.id, {
        characterName: student.characterName,
        realName: student.realName,
        realLastName: student.realLastName,
        level: student.level,
        avatarGender: student.avatarGender,
      });
    }

    const awardsRaw = await db
      .select({
        studentProfileId: studentBadges.studentProfileId,
        awardedAt: studentBadges.unlockedAt,
        awardReason: studentBadges.awardReason,
        badgeId: badges.id,
        badgeName: badges.name,
        badgeIcon: badges.customImage,
        badgeEmoji: badges.icon,
        rarity: badges.rarity,
        assignmentMode: badges.assignmentMode,
      })
      .from(studentBadges)
      .innerJoin(badges, eq(studentBadges.badgeId, badges.id))
      .where(inArray(studentBadges.studentProfileId, studentIds));

    const normalize = (value: string | null | undefined) => (value || '').trim().toLowerCase();
    const search = normalize(filters?.search);

    const awards = awardsRaw.filter((award) => {
      if (filters?.rarity && award.rarity !== filters.rarity) return false;
      if (filters?.assignmentMode && award.assignmentMode !== filters.assignmentMode) return false;
      if (filters?.startDate && new Date(award.awardedAt) < filters.startDate) return false;
      if (filters?.endDate && new Date(award.awardedAt) > filters.endDate) return false;

      if (!search) return true;

      const student = studentNameById.get(award.studentProfileId);
      const characterName = normalize(student?.characterName);
      const realName = normalize(student?.realName);
      const realLastName = normalize(student?.realLastName);
      const fullName = normalize(`${student?.realName || ''} ${student?.realLastName || ''}`);
      const badgeName = normalize(award.badgeName);

      return (
        badgeName.includes(search) ||
        characterName.includes(search) ||
        realName.includes(search) ||
        realLastName.includes(search) ||
        fullName.includes(search)
      );
    });

    if (awards.length === 0) {
      return {
        summary: {
          totalAwards: 0,
          totalStudentsInClassroom: students.length,
          totalStudentsWithAwards: 0,
          totalBadgesAwarded: 0,
          mostAwardedBadge: null,
        },
        recentAwards: [],
        byBadge: [],
        byStudent: [],
      };
    }

    const getStudentDisplayName = (student: {
      characterName: string | null;
      realName: string | null;
      realLastName: string | null;
    }) => {
      if (student.characterName) return student.characterName;
      const fullName = `${student.realName || ''} ${student.realLastName || ''}`.trim();
      return fullName || 'Estudiante';
    };

    const byBadgeMap = new Map<string, {
      badgeId: string;
      badgeName: string;
      badgeIcon: string | null;
      rarity: BadgeRarity;
      assignmentMode: BadgeAssignment;
      totalAwards: number;
      uniqueStudentsSet: Set<string>;
      lastAwardedAt: Date;
      winnersMap: Map<string, {
        studentProfileId: string;
        studentName: string;
        characterName: string | null;
        realName: string | null;
        realLastName: string | null;
        level: number;
        avatarGender: string;
        awardCount: number;
        lastAwardedAt: Date;
        lastAwardReason: string | null;
      }>;
    }>();

    const byStudentMap = new Map<string, {
      studentProfileId: string;
      studentName: string;
      characterName: string | null;
      realName: string | null;
      realLastName: string | null;
      level: number;
      avatarGender: string;
      totalAwards: number;
      uniqueBadgesSet: Set<string>;
      lastAwardedAt: Date;
      badgesMap: Map<string, {
        badgeId: string;
        badgeName: string;
        badgeIcon: string | null;
        rarity: BadgeRarity;
        assignmentMode: BadgeAssignment;
        awardCount: number;
        lastAwardedAt: Date;
      }>;
    }>();

    for (const award of awards) {
      const studentInfo = studentNameById.get(award.studentProfileId);
      if (!studentInfo) continue;

      const awardedAt = new Date(award.awardedAt);
      const badgeIcon = award.badgeIcon || award.badgeEmoji || null;
      const studentName = getStudentDisplayName(studentInfo);

      const badgeEntry = byBadgeMap.get(award.badgeId);
      if (!badgeEntry) {
        byBadgeMap.set(award.badgeId, {
          badgeId: award.badgeId,
          badgeName: award.badgeName,
          badgeIcon,
          rarity: award.rarity,
          assignmentMode: award.assignmentMode,
          totalAwards: 1,
          uniqueStudentsSet: new Set([award.studentProfileId]),
          lastAwardedAt: awardedAt,
          winnersMap: new Map([
            [
              award.studentProfileId,
              {
                studentProfileId: award.studentProfileId,
                studentName,
                characterName: studentInfo.characterName,
                realName: studentInfo.realName,
                realLastName: studentInfo.realLastName,
                level: studentInfo.level,
                avatarGender: studentInfo.avatarGender,
                awardCount: 1,
                lastAwardedAt: awardedAt,
                lastAwardReason: award.awardReason || null,
              },
            ],
          ]),
        });
      } else {
        badgeEntry.totalAwards += 1;
        badgeEntry.uniqueStudentsSet.add(award.studentProfileId);
        if (awardedAt > badgeEntry.lastAwardedAt) {
          badgeEntry.lastAwardedAt = awardedAt;
        }

        const winner = badgeEntry.winnersMap.get(award.studentProfileId);
        if (!winner) {
          badgeEntry.winnersMap.set(award.studentProfileId, {
            studentProfileId: award.studentProfileId,
            studentName,
            characterName: studentInfo.characterName,
            realName: studentInfo.realName,
            realLastName: studentInfo.realLastName,
            level: studentInfo.level,
            avatarGender: studentInfo.avatarGender,
            awardCount: 1,
            lastAwardedAt: awardedAt,
            lastAwardReason: award.awardReason || null,
          });
        } else {
          winner.awardCount += 1;
          if (awardedAt > winner.lastAwardedAt) {
            winner.lastAwardedAt = awardedAt;
            winner.lastAwardReason = award.awardReason || null;
          }
        }
      }

      const studentEntry = byStudentMap.get(award.studentProfileId);
      if (!studentEntry) {
        byStudentMap.set(award.studentProfileId, {
          studentProfileId: award.studentProfileId,
          studentName,
          characterName: studentInfo.characterName,
          realName: studentInfo.realName,
          realLastName: studentInfo.realLastName,
          level: studentInfo.level,
          avatarGender: studentInfo.avatarGender,
          totalAwards: 1,
          uniqueBadgesSet: new Set([award.badgeId]),
          lastAwardedAt: awardedAt,
          badgesMap: new Map([
            [
              award.badgeId,
              {
                badgeId: award.badgeId,
                badgeName: award.badgeName,
                badgeIcon,
                rarity: award.rarity,
                assignmentMode: award.assignmentMode,
                awardCount: 1,
                lastAwardedAt: awardedAt,
              },
            ],
          ]),
        });
      } else {
        studentEntry.totalAwards += 1;
        studentEntry.uniqueBadgesSet.add(award.badgeId);
        if (awardedAt > studentEntry.lastAwardedAt) {
          studentEntry.lastAwardedAt = awardedAt;
        }

        const studentBadge = studentEntry.badgesMap.get(award.badgeId);
        if (!studentBadge) {
          studentEntry.badgesMap.set(award.badgeId, {
            badgeId: award.badgeId,
            badgeName: award.badgeName,
            badgeIcon,
            rarity: award.rarity,
            assignmentMode: award.assignmentMode,
            awardCount: 1,
            lastAwardedAt: awardedAt,
          });
        } else {
          studentBadge.awardCount += 1;
          if (awardedAt > studentBadge.lastAwardedAt) {
            studentBadge.lastAwardedAt = awardedAt;
          }
        }
      }
    }

    const byBadge = Array.from(byBadgeMap.values())
      .map((entry) => ({
        badgeId: entry.badgeId,
        badgeName: entry.badgeName,
        badgeIcon: entry.badgeIcon,
        rarity: entry.rarity,
        assignmentMode: entry.assignmentMode,
        totalAwards: entry.totalAwards,
        uniqueStudents: entry.uniqueStudentsSet.size,
        lastAwardedAt: entry.lastAwardedAt,
        winners: Array.from(entry.winnersMap.values()).sort((a, b) => {
          if (b.awardCount !== a.awardCount) return b.awardCount - a.awardCount;
          return new Date(b.lastAwardedAt).getTime() - new Date(a.lastAwardedAt).getTime();
        }),
      }))
      .sort((a, b) => {
        if (b.totalAwards !== a.totalAwards) return b.totalAwards - a.totalAwards;
        return new Date(b.lastAwardedAt).getTime() - new Date(a.lastAwardedAt).getTime();
      });

    const byStudent = Array.from(byStudentMap.values())
      .map((entry) => ({
        studentProfileId: entry.studentProfileId,
        studentName: entry.studentName,
        characterName: entry.characterName,
        realName: entry.realName,
        realLastName: entry.realLastName,
        level: entry.level,
        avatarGender: entry.avatarGender,
        totalAwards: entry.totalAwards,
        uniqueBadges: entry.uniqueBadgesSet.size,
        lastAwardedAt: entry.lastAwardedAt,
        badges: Array.from(entry.badgesMap.values()).sort((a, b) => {
          if (b.awardCount !== a.awardCount) return b.awardCount - a.awardCount;
          return new Date(b.lastAwardedAt).getTime() - new Date(a.lastAwardedAt).getTime();
        }),
      }))
      .sort((a, b) => {
        if (b.totalAwards !== a.totalAwards) return b.totalAwards - a.totalAwards;
        return new Date(b.lastAwardedAt).getTime() - new Date(a.lastAwardedAt).getTime();
      });

    const recentAwards = awards
      .slice()
      .sort((a, b) => new Date(b.awardedAt).getTime() - new Date(a.awardedAt).getTime())
      .slice(0, 10)
      .map((award) => {
        const student = studentNameById.get(award.studentProfileId)!;
        return {
          studentProfileId: award.studentProfileId,
          studentName: getStudentDisplayName(student),
          badgeId: award.badgeId,
          badgeName: award.badgeName,
          badgeIcon: award.badgeIcon || award.badgeEmoji || null,
          awardedAt: new Date(award.awardedAt),
          awardReason: award.awardReason || null,
        };
      });

    return {
      summary: {
        totalAwards: awards.length,
        totalStudentsInClassroom: students.length,
        totalStudentsWithAwards: new Set(awards.map((award) => award.studentProfileId)).size,
        totalBadgesAwarded: new Set(awards.map((award) => award.badgeId)).size,
        mostAwardedBadge: byBadge.length > 0
          ? {
              id: byBadge[0].badgeId,
              name: byBadge[0].badgeName,
              icon: byBadge[0].badgeIcon,
              count: byBadge[0].totalAwards,
            }
          : null,
      },
      recentAwards,
      byBadge,
      byStudent,
    };
  }
  
  // ═══════════════════════════════════════════════════════════
  // Insignias de Estudiantes
  // ═══════════════════════════════════════════════════════════
  
  async getStudentBadges(studentProfileId: string): Promise<(StudentBadge & { badge: Badge; count: number })[]> {
    const results = await db.select({
      studentBadge: studentBadges,
      badge: badges,
    })
    .from(studentBadges)
    .innerJoin(badges, eq(studentBadges.badgeId, badges.id))
    .where(eq(studentBadges.studentProfileId, studentProfileId));
    
    // Agrupar por badgeId y contar
    const grouped = new Map<string, { studentBadge: typeof results[0]['studentBadge']; badge: typeof results[0]['badge']; count: number }>();
    
    for (const r of results) {
      const existing = grouped.get(r.badge.id);
      if (existing) {
        existing.count++;
        // Mantener la fecha más reciente
        if (new Date(r.studentBadge.unlockedAt) > new Date(existing.studentBadge.unlockedAt)) {
          existing.studentBadge = r.studentBadge;
        }
      } else {
        grouped.set(r.badge.id, { studentBadge: r.studentBadge, badge: r.badge, count: 1 });
      }
    }
    
    return Array.from(grouped.values()).map(g => ({
      ...g.studentBadge,
      badge: g.badge,
      count: g.count,
    }));
  }
  
  /**
   * Conteo de insignias (misma regla que getStudentBadges: filas de student_badges con insignia
   * existente) para varios alumnos en una sola consulta: alumno → (insignia → veces).
   */
  async getBadgeCountsForStudents(studentProfileIds: string[]): Promise<Map<string, Map<string, number>>> {
    const counts = new Map<string, Map<string, number>>();
    if (studentProfileIds.length === 0) return counts;
    const rows = await db.select({
      studentProfileId: studentBadges.studentProfileId,
      badgeId: studentBadges.badgeId,
      total: sql<number>`COUNT(*)`,
    })
      .from(studentBadges)
      .innerJoin(badges, eq(studentBadges.badgeId, badges.id))
      .where(inArray(studentBadges.studentProfileId, studentProfileIds))
      .groupBy(studentBadges.studentProfileId, studentBadges.badgeId);
    for (const row of rows) {
      if (!counts.has(row.studentProfileId)) counts.set(row.studentProfileId, new Map());
      counts.get(row.studentProfileId)!.set(row.badgeId, Number(row.total));
    }
    return counts;
  }

  async getStudentBadge(studentProfileId: string, badgeId: string): Promise<StudentBadge | null> {
    const result = await db.select().from(studentBadges).where(
      and(
        eq(studentBadges.studentProfileId, studentProfileId),
        eq(studentBadges.badgeId, badgeId)
      )
    );
    return result[0] || null;
  }
  
  async countStudentBadge(studentProfileId: string, badgeId: string): Promise<number> {
    const result = await db.select().from(studentBadges).where(
      and(
        eq(studentBadges.studentProfileId, studentProfileId),
        eq(studentBadges.badgeId, badgeId)
      )
    );
    return result.length;
  }
  
  async getDisplayedBadges(studentProfileId: string): Promise<(StudentBadge & { badge: Badge })[]> {
    const results = await db.select({
      studentBadge: studentBadges,
      badge: badges,
    })
    .from(studentBadges)
    .innerJoin(badges, eq(studentBadges.badgeId, badges.id))
    .where(
      and(
        eq(studentBadges.studentProfileId, studentProfileId),
        eq(studentBadges.isDisplayed, true)
      )
    );
    
    return results.map(r => ({
      ...r.studentBadge,
      badge: r.badge,
    }));
  }
  
  async setDisplayedBadges(studentProfileId: string, badgeIds: string[]): Promise<void> {
    // Quitar display de todas
    await db.update(studentBadges)
      .set({ isDisplayed: false })
      .where(eq(studentBadges.studentProfileId, studentProfileId));
    
    // Marcar las seleccionadas (máximo 3)
    if (badgeIds.length > 0) {
      const idsToDisplay = badgeIds.slice(0, 3);
      await db.update(studentBadges)
        .set({ isDisplayed: true })
        .where(
          and(
            eq(studentBadges.studentProfileId, studentProfileId),
            inArray(studentBadges.badgeId, idsToDisplay)
          )
        );
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // Otorgar Insignias
  // ═══════════════════════════════════════════════════════════
  
  async awardBadgeManually(
    studentProfileId: string, 
    badgeId: string, 
    teacherId: string,
    reason?: string,
    classroomId?: string
  ): Promise<StudentBadge> {
    const badge = await this.getBadgeById(badgeId);
    // Solo insignias activas del sistema o de la misma clase del alumno.
    if (!badge || !badge.isActive || (classroomId && badge.scope !== 'SYSTEM' && badge.classroomId !== classroomId)) {
      throw new Error('Insignia no encontrada');
    }

    // Verificar que permite asignación manual
    if (badge.assignmentMode === 'AUTOMATIC') {
      throw new Error('Esta insignia solo se puede obtener automáticamente');
    }

    // Las insignias manuales de la clase son acumulables - contar cuántas tiene
    const existingCount = await this.countStudentBadge(studentProfileId, badgeId);
    if (!this.canAwardManually(badge, existingCount)) {
      throw new Error('Se alcanzó el límite de otorgamientos de esta insignia');
    }

    // Otorgar
    const newStudentBadge = {
      id: uuid(),
      studentProfileId,
      badgeId,
      unlockedAt: new Date(),
      awardedBy: teacherId,
      awardReason: reason || null,
      isDisplayed: false,
    };

    const notifiedUserIds: string[] = [];

    await db.transaction(async (tx) => {
      await tx.insert(studentBadges).values(newStudentBadge);

      if (badge.rewardXp > 0 || badge.rewardGp > 0) {
        await this.giveReward(
          studentProfileId,
          badge.rewardXp,
          badge.rewardGp,
          `Insignia: ${badge.name}`,
          tx,
          notifiedUserIds,
          newStudentBadge.unlockedAt
        );
      }

      const [student] = await tx.select().from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
      if (student?.userId) {
        const newCount = existingCount + 1;
        const countText = newCount > 1 ? ` (×${newCount})` : '';
        // El modal del profe promete que el motivo «lo verá el estudiante»: va en el aviso.
        await tx.insert(notifications).values({
          id: uuid(),
          userId: student.userId,
          type: 'BADGE',
          title: '🏅 ¡Nueva insignia!',
          message: `Tu profe te dio la insignia «${badge.name}»${countText}${reason ? `: «${reason}»` : ''}`,
          isRead: false,
          createdAt: new Date(),
        });
        notifiedUserIds.push(student.userId);
      }
    });

    // Emit after tx commit
    for (const uid of [...new Set(notifiedUserIds)]) {
      await emitUnreadCount(uid);
    }

    if (badge.rewardXp > 0) {
      const [student] = await db
        .select({ id: studentProfiles.id, classroomId: studentProfiles.classroomId })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentProfileId));

      if (!student) {
        return newStudentBadge as StudentBadge;
      }

      const reasonText = `Insignia: ${badge.name}`;
      try {
        await clanService.contributeXpToClan(
          student.id,
          badge.rewardXp,
          reasonText
        );
      } catch {
        // Silently fail
      }

      try {
        await storyService.onXpAwarded(
          student.classroomId,
          student.id,
          badge.rewardXp
        );
      } catch {
        // Silently fail
      }

      // El XP de la recompensa puede completar una insignia de XP o de nivel.
      await this.checkXpBadges([student.id]);
    }

    return newStudentBadge as StudentBadge;
  }

  // Otorga a varios alumnos de la misma clase; cada uno en su propia transacción para que un
  // fallo no deje a los demás sin su insignia. Devuelve qué se otorgó (con id para deshacer) y qué no.
  async awardBadgeToStudents(
    studentProfileIds: string[],
    badgeId: string,
    teacherId: string,
    classroomId: string,
    reason?: string
  ): Promise<{
    awarded: { studentProfileId: string; studentBadgeId: string }[];
    failed: { studentProfileId: string; message: string }[];
  }> {
    const awarded: { studentProfileId: string; studentBadgeId: string }[] = [];
    const failed: { studentProfileId: string; message: string }[] = [];
    for (const studentProfileId of studentProfileIds) {
      try {
        const studentBadge = await this.awardBadgeManually(studentProfileId, badgeId, teacherId, reason, classroomId);
        awarded.push({ studentProfileId, studentBadgeId: studentBadge.id });
      } catch (error) {
        failed.push({ studentProfileId, message: error instanceof Error ? error.message : 'No se pudo otorgar' });
      }
    }
    return { awarded, failed };
  }

  /** @param reason de dónde salió (p. ej. «Álbum completado: X»), para que el alumno sepa por qué la tiene. */
  async awardBadgeAutomatic(studentProfileId: string, badgeId: string, reason?: string): Promise<StudentBadge> {
    const badge = await this.getBadgeById(badgeId);
    if (!badge) {
      throw new Error('Insignia no encontrada');
    }
    
    let existingCount = await this.countStudentBadge(studentProfileId, badgeId);
    if (!this.canAwardAutomatically(badge, existingCount)) {
      throw new Error('El estudiante ya alcanzó el límite de esta insignia');
    }

    const newStudentBadge = {
      id: uuid(),
      studentProfileId,
      badgeId,
      unlockedAt: new Date(),
      awardedBy: null,
      awardReason: reason || null,
      isDisplayed: false,
    };

    const notifiedUserIds: string[] = [];

    await db.transaction(async (tx) => {
      // Bloquea al alumno y vuelve a contar: dos eventos simultáneos no otorgan la insignia dos veces.
      await tx.select({ id: studentProfiles.id }).from(studentProfiles)
        .where(eq(studentProfiles.id, studentProfileId)).for('update');
      const [{ total }] = await tx.select({ total: sql<number>`COUNT(*)` }).from(studentBadges).where(and(
        eq(studentBadges.studentProfileId, studentProfileId),
        eq(studentBadges.badgeId, badgeId),
      ));
      existingCount = Number(total);
      if (!this.canAwardAutomatically(badge, existingCount)) {
        throw new Error('El estudiante ya alcanzó el límite de esta insignia');
      }

      await tx.insert(studentBadges).values(newStudentBadge);

      if (badge.rewardXp > 0 || badge.rewardGp > 0) {
        await this.giveReward(
          studentProfileId,
          badge.rewardXp,
          badge.rewardGp,
          `Insignia: ${badge.name}`,
          tx,
          notifiedUserIds,
          newStudentBadge.unlockedAt
        );
      }

      const [student] = await tx.select().from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
      if (!student) {
        return;
      }

      if (student.userId) {
        const newCount = existingCount + 1;
        const countText = newCount > 1 ? ` (×${newCount})` : '';
        await tx.insert(notifications).values({
          id: uuid(),
          userId: student.userId,
          type: 'BADGE',
          title: '🏅 ¡Nueva insignia!',
          message: `Ganaste la insignia «${badge.name}»${countText}${reason ? `: «${reason}»` : ''}`,
          isRead: false,
          createdAt: new Date(),
        });
        notifiedUserIds.push(student.userId);
      }

      const [classroom] = await tx
        .select({ id: classrooms.id, teacherId: classrooms.teacherId })
        .from(classrooms)
        .where(eq(classrooms.id, student.classroomId));

      if (classroom) {
        await tx.insert(notifications).values({
          id: uuid(),
          userId: classroom.teacherId,
          classroomId: classroom.id,
          type: 'BADGE',
          title: '🏅 ¡Insignia ganada!',
          message: `${student.characterName || 'Un estudiante'} ganó la insignia «${badge.name}»`,
          isRead: false,
          createdAt: new Date(),
        });
        notifiedUserIds.push(classroom.teacherId);
      }
    });

    // Emit after tx commit
    for (const uid of [...new Set(notifiedUserIds)]) {
      await emitUnreadCount(uid);
    }

    if (badge.rewardXp > 0) {
      const [student] = await db
        .select({ id: studentProfiles.id, classroomId: studentProfiles.classroomId })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentProfileId));

      if (!student) {
        return newStudentBadge as StudentBadge;
      }

      const reasonText = `Insignia: ${badge.name}`;
      try {
        await clanService.contributeXpToClan(
          student.id,
          badge.rewardXp,
          reasonText
        );
      } catch {
        // Silently fail
      }

      try {
        await storyService.onXpAwarded(
          student.classroomId,
          student.id,
          badge.rewardXp
        );
      } catch {
        // Silently fail
      }

      // El XP de la recompensa puede completar otra insignia de XP o de nivel (cada una se gana una vez).
      await this.checkXpBadges([student.id]);
    }

    return newStudentBadge as StudentBadge;
  }

  /**
   * Revocar = deshacer el último otorgamiento de esa insignia, con su recompensa (como «Deshacer»).
   * Antes borraba todas las copias y dejaba el XP y el oro.
   */
  async revokeBadge(studentProfileId: string, badgeId: string, teacherId: string): Promise<void> {
    const [latest] = await db.select({ id: studentBadges.id })
      .from(studentBadges)
      .where(and(eq(studentBadges.studentProfileId, studentProfileId), eq(studentBadges.badgeId, badgeId)))
      .orderBy(sql`${studentBadges.unlockedAt} DESC`)
      .limit(1);
    if (!latest) throw new Error('El estudiante no tiene esta insignia');
    const { historyService } = await import('./history.service.js');
    await historyService.revertBadge(latest.id, teacherId);
  }

  /**
   * Insignias de XP o de nivel tras sumar XP por una vía que no pasa por comportamientos (asistencia,
   * racha, historia, expediciones, eventos, cronometradas, recompensa de otra insignia). Solo evalúa
   * esas condiciones y nunca lanza: se llama después de confirmar el cambio.
   */
  async checkXpBadges(studentProfileIds: string[]): Promise<void> {
    try {
      const ids = [...new Set(studentProfileIds)].filter(Boolean);
      if (ids.length === 0) return;
      const profiles = await db.select({ id: studentProfiles.id, classroomId: studentProfiles.classroomId })
        .from(studentProfiles)
        .where(inArray(studentProfiles.id, ids));
      const classroomIds = [...new Set(profiles.map((profile) => profile.classroomId))];
      if (classroomIds.length === 0) return;
      const candidates = await db.select().from(badges).where(and(
        eq(badges.isActive, true),
        inArray(badges.assignmentMode, ['AUTOMATIC', 'BOTH']),
        or(eq(badges.scope, 'SYSTEM'), inArray(badges.classroomId, classroomIds)),
      ));
      const xpBadges = candidates.filter((badge) => dependsOnXp(parseBadgeCondition(badge.unlockCondition)));
      if (xpBadges.length === 0) return;
      const counts = await this.getBadgeCountsForStudents(profiles.map((profile) => profile.id));
      for (const profile of profiles) {
        const classBadges = xpBadges.filter((badge) => badge.scope === 'SYSTEM' || badge.classroomId === profile.classroomId);
        if (classBadges.length === 0) continue;
        await this.checkAndAwardBadges(
          { type: 'POINTS_ADDED', data: { studentProfileId: profile.id, classroomId: profile.classroomId } },
          classBadges,
          counts.get(profile.id) ?? new Map(),
        );
      }
    } catch (error) {
      console.error('Error revisando insignias de XP o nivel:', error);
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // Verificación Automática
  // ═══════════════════════════════════════════════════════════
  
  /**
   * @param preloadedClassroomBadges insignias de la clase ya cargadas (para evaluar varios alumnos
   *        de la misma clase sin repetir la consulta).
   * @param preloadedBadgeCounts conteo de insignias del alumno ya calculado (getBadgeCountsForStudents).
   */
  async checkAndAwardBadges(
    event: BadgeEvent,
    preloadedClassroomBadges?: Badge[],
    preloadedBadgeCounts?: Map<string, number>
  ): Promise<Badge[]> {
    const { studentProfileId, classroomId } = event.data;
    const unlockedBadges: Badge[] = [];
    
    // Obtener insignias automáticas no desbloqueadas
    const allBadges = preloadedClassroomBadges ?? await this.getClassroomBadges(classroomId);
    
    const badgeCountMap = preloadedBadgeCounts ?? new Map(
      (await this.getStudentBadges(studentProfileId)).map((studentBadge) => [studentBadge.badgeId, studentBadge.count])
    );
    
    const pendingBadges = allBadges.filter(b => 
      (b.assignmentMode === 'AUTOMATIC' || b.assignmentMode === 'BOTH') &&
      b.unlockCondition !== null &&
      this.canAwardAutomatically(b, badgeCountMap.get(b.id) || 0)
    );
    
    
    for (const badge of pendingBadges) {
      try {
        const conditionMet = await this.checkCondition(studentProfileId, badge, event);
        
        if (conditionMet) {
          await this.awardBadgeAutomatic(studentProfileId, badge.id);
          unlockedBadges.push(badge);
        }
      } catch (error) {
        // Si ya tiene la insignia, continuar
        console.error(`Error checking badge ${badge.id}:`, error);
      }
    }
    
    return unlockedBadges;
  }
  
  private async checkCondition(
    studentProfileId: string, 
    badge: Badge, 
    event: BadgeEvent
  ): Promise<boolean> {
    let condition = badge.unlockCondition as BadgeCondition | string | null;
    if (!condition) return false;
    
    // Si la condición es string, parsearla como JSON
    if (typeof condition === 'string') {
      try {
        condition = JSON.parse(condition) as BadgeCondition;
      } catch (e) {
        console.error('Error parsing badge condition:', e);
        return false;
      }
    }
    
    switch (condition.type) {
      case 'XP_TOTAL':
        // Obtener XP actual del estudiante
        const studentXp = await db.select().from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
        const currentXp = studentXp[0]?.xp || 0;
        return currentXp >= (condition.value || 0);
        
      case 'LEVEL':
        // Obtener nivel actual del estudiante
        const studentLevel = await db.select().from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
        const currentLevel = studentLevel[0]?.level || 1;
        return currentLevel >= (condition.value || 0);
        
      case 'BEHAVIOR_COUNT':
        if (!condition.behaviorId) return false;
        // Contar solo desde que se creó la insignia
        const badgeCreatedAt = badge.createdAt ? new Date(badge.createdAt) : undefined;
        const behaviorCount = await this.countBehaviorApplications(
          studentProfileId, 
          condition.behaviorId,
          badgeCreatedAt
        );
        return behaviorCount >= (condition.count || 0);
        
      case 'BEHAVIOR_CATEGORY':
        if (condition.category === 'negative') return false;
        const catBadgeCreatedAt = badge.createdAt ? new Date(badge.createdAt) : undefined;
        const categoryCount = await this.countBehaviorsByCategory(
          studentProfileId,
          condition.category || 'positive',
          catBadgeCreatedAt
        );
        return categoryCount >= (condition.count || 0);
        
      case 'ANY_BEHAVIOR':
        const anyBadgeCreatedAt = badge.createdAt ? new Date(badge.createdAt) : undefined;
        const totalBehaviors = await this.countAllBehaviors(studentProfileId, anyBadgeCreatedAt);
        return totalBehaviors >= (condition.count || 0);
        
      case 'PURCHASES':
        return (event.data.totalPurchases || 0) >= (condition.value || 0);
        
      case 'COMPOUND':
        if (!condition.conditions) return false;
        for (const subCondition of condition.conditions) {
          const subBadge = { ...badge, unlockCondition: subCondition };
          if (!await this.checkCondition(studentProfileId, subBadge, event)) {
            return false;
          }
        }
        return true;
        
      default:
        return false;
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Veces que el alumno recibió comportamientos POSITIVOS (todos o uno concreto) desde una fecha.
   * Un comportamiento aplicado deja varios registros (XP, energía, oro) en el mismo segundo: cuenta una vez.
   * Nunca insignias por lo negativo: un comportamiento negativo no suma.
   */
  private async countPositiveBehaviors(studentProfileId: string, sinceDate?: Date, behaviorId?: string): Promise<number> {
    const rows = await db.select({ behaviorId: pointLogs.behaviorId, createdAt: pointLogs.createdAt })
      .from(pointLogs)
      .innerJoin(behaviors, eq(behaviors.id, pointLogs.behaviorId))
      .where(and(
        eq(pointLogs.studentId, studentProfileId),
        eq(pointLogs.isReverted, false),
        eq(behaviors.isPositive, true),
        ...(behaviorId ? [eq(pointLogs.behaviorId, behaviorId)] : []),
        ...(sinceDate ? [gte(pointLogs.createdAt, sinceDate)] : []),
      ));
    return new Set(rows.map((row) => `${row.behaviorId}-${new Date(row.createdAt).toISOString().slice(0, 19)}`)).size;
  }

  private async countBehaviorApplications(studentProfileId: string, behaviorId: string, sinceDate?: Date): Promise<number> {
    return this.countPositiveBehaviors(studentProfileId, sinceDate, behaviorId);
  }

  private async countBehaviorsByCategory(studentProfileId: string, category: 'positive' | 'negative', sinceDate?: Date): Promise<number> {
    return category === 'positive' ? this.countPositiveBehaviors(studentProfileId, sinceDate) : 0;
  }

  // «Cualquier comportamiento» cuenta solo los positivos (antes sumaba también los negativos).
  private async countAllBehaviors(studentProfileId: string, sinceDate?: Date): Promise<number> {
    return this.countPositiveBehaviors(studentProfileId, sinceDate);
  }
  
  private async giveReward(
    studentProfileId: string,
    xp: number,
    gp: number,
    reason: string,
    tx: any = db,
    notifiedUserIds: string[] = [],
    // Mismo instante que el student_badge: así la reversión encuentra exactamente estos registros.
    createdAt: Date = new Date()
  ): Promise<void> {
    if (xp === 0 && gp === 0) return;

    const [current] = await tx.select().from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
    if (!current) return;

    const [classroom] = await tx
      .select({ xpPerLevel: classrooms.xpPerLevel })
      .from(classrooms)
      .where(eq(classrooms.id, current.classroomId));

    const xpPerLevel = classroom?.xpPerLevel || 100;
    const now = createdAt;

    // Suma atómica: no pisa otras escrituras simultáneas sobre el alumno.
    const updated = await addXpGp(tx, studentProfileId, { xp, gp }, xpPerLevel, 'BADGE');
    if (!updated) return;
    const newLevel = updated.level;
    const leveledUp = updated.level > updated.previousLevel;

    const logsBatch: typeof pointLogs.$inferInsert[] = [];
    if (xp > 0) {
      logsBatch.push({
        id: uuid(),
        studentId: studentProfileId,
        pointType: 'XP',
        action: 'ADD',
        amount: xp,
        reason,
        createdAt: now,
      });
    }
    if (gp > 0) {
      logsBatch.push({
        id: uuid(),
        studentId: studentProfileId,
        pointType: 'GP',
        action: 'ADD',
        amount: gp,
        reason,
        createdAt: now,
      });
    }

    if (logsBatch.length > 0) {
      await tx.insert(pointLogs).values(logsBatch);
    }

    if (leveledUp && current.userId) {
      await tx.insert(notifications).values({
        id: uuid(),
        userId: current.userId,
        classroomId: current.classroomId,
        type: 'LEVEL_UP',
        title: '🎉 ¡Subiste de nivel!',
        message: `¡Felicidades! Has alcanzado el nivel ${newLevel}`,
        isRead: false,
        createdAt: now,
      });
      notifiedUserIds.push(current.userId);
    }

    return;
  }
}

export const badgeService = new BadgeService();
