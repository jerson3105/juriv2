import { db } from '../db/index.js';
import { loginStreaks, studentProfiles, classrooms, notifications, shopItems, purchases } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { clanService } from './clan.service.js';

// Configuración por defecto para login streak
const DEFAULT_LOGIN_STREAK_CONFIG = {
  dailyXp: 5,
  milestones: [
    { day: 3, xp: 10, gp: 0, randomItem: false },
    { day: 7, xp: 25, gp: 10, randomItem: false },
    { day: 14, xp: 50, gp: 25, randomItem: false },
    { day: 30, xp: 100, gp: 50, randomItem: true },
    { day: 60, xp: 200, gp: 100, randomItem: true },
  ],
  resetOnMiss: true,
  graceDays: 0,
};

// Helper para parsear loginStreakConfig (puede venir como string de MySQL)
function parseLoginStreakConfig(config: any): typeof DEFAULT_LOGIN_STREAK_CONFIG {
  if (!config) return DEFAULT_LOGIN_STREAK_CONFIG;
  if (typeof config === 'string') {
    try {
      return JSON.parse(config);
    } catch (e) {
      console.error('Error parsing loginStreakConfig:', e);
      return DEFAULT_LOGIN_STREAK_CONFIG;
    }
  }
  return config;
}

// Helper para parsear claimedMilestones (puede venir como string de MySQL)
function parseClaimedMilestones(milestones: any): number[] {
  if (!milestones) return [];
  if (typeof milestones === 'string') {
    try {
      return JSON.parse(milestones);
    } catch (e) {
      console.error('Error parsing claimedMilestones:', e);
      return [];
    }
  }
  return milestones;
}

interface LoginStreakResult {
  streak: {
    currentStreak: number;
    longestStreak: number;
    totalLogins: number;
    lastLoginDate: Date | null;
    claimedMilestones: number[];
  };
  rewards: {
    dailyXp: number;
    milestoneReached: number | null;
    milestoneXp: number;
    milestoneGp: number;
    randomItem: any | null;
  } | null;
  isNewLogin: boolean;
  nextMilestone: {
    day: number;
    xp: number;
    gp: number;
    daysRemaining: number;
  } | null;
}

export const loginStreakService = {
  // Registrar login y calcular recompensas
  async recordLogin(studentProfileId: string, classroomId: string): Promise<LoginStreakResult> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Obtener configuración de la clase
    const [classroom] = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.id, classroomId));

    if (!classroom || !classroom.loginStreakEnabled) {
      throw new Error('Login streak no está habilitado para esta clase');
    }

    const config = parseLoginStreakConfig(classroom.loginStreakConfig);

    // Obtener o crear registro de streak
    let [streakRecord] = await db
      .select()
      .from(loginStreaks)
      .where(and(
        eq(loginStreaks.studentProfileId, studentProfileId),
        eq(loginStreaks.classroomId, classroomId)
      ));

    if (!streakRecord) {
      // Crear nuevo registro
      const id = uuidv4();
      await db.insert(loginStreaks).values({
        id,
        studentProfileId,
        classroomId,
        currentStreak: 0,
        longestStreak: 0,
        lastLoginDate: null,
        totalLogins: 0,
        claimedMilestones: [],
        graceDaysUsed: 0,
        createdAt: now,
        updatedAt: now,
      });

      [streakRecord] = await db
        .select()
        .from(loginStreaks)
        .where(eq(loginStreaks.id, id));
    }

    // Verificar si ya se registró login hoy
    const lastLogin = streakRecord.lastLoginDate ? new Date(streakRecord.lastLoginDate) : null;
    const lastLoginDay = lastLogin 
      ? new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate())
      : null;

    if (lastLoginDay && lastLoginDay.getTime() === today.getTime()) {
      // Ya se registró hoy, solo devolver estado actual
      return {
        streak: {
          currentStreak: streakRecord.currentStreak,
          longestStreak: streakRecord.longestStreak,
          totalLogins: streakRecord.totalLogins,
          lastLoginDate: streakRecord.lastLoginDate,
          claimedMilestones: parseClaimedMilestones(streakRecord.claimedMilestones),
        },
        rewards: null,
        isNewLogin: false,
        nextMilestone: this.getNextMilestone(streakRecord.currentStreak, parseClaimedMilestones(streakRecord.claimedMilestones), config),
      };
    }

    // Calcular si la racha continúa o se reinicia
    let newStreak = 1;
    let graceDaysUsed = streakRecord.graceDaysUsed;

    if (lastLoginDay) {
      const daysDiff = Math.floor((today.getTime() - lastLoginDay.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1) {
        // Día consecutivo, continúa la racha
        newStreak = streakRecord.currentStreak + 1;
        graceDaysUsed = 0; // Resetear días de gracia usados
      } else if (daysDiff > 1 && config.graceDays > 0) {
        // Verificar si puede usar días de gracia
        const missedDays = daysDiff - 1;
        const availableGraceDays = config.graceDays - graceDaysUsed;

        if (missedDays <= availableGraceDays) {
          // Usar días de gracia
          newStreak = streakRecord.currentStreak + 1;
          graceDaysUsed += missedDays;
        } else if (config.resetOnMiss) {
          // Reiniciar racha
          newStreak = 1;
          graceDaysUsed = 0;
        }
      } else if (daysDiff > 1 && config.resetOnMiss) {
        // Reiniciar racha
        newStreak = 1;
        graceDaysUsed = 0;
      }
    }

    const newLongestStreak = Math.max(streakRecord.longestStreak, newStreak);
    const newTotalLogins = streakRecord.totalLogins + 1;

    // Actualizar registro
    await db
      .update(loginStreaks)
      .set({
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastLoginDate: now,
        totalLogins: newTotalLogins,
        graceDaysUsed,
        updatedAt: now,
      })
      .where(eq(loginStreaks.id, streakRecord.id));

    // Calcular recompensas
    let rewards: LoginStreakResult['rewards'] = {
      dailyXp: config.dailyXp || 0,
      milestoneReached: null,
      milestoneXp: 0,
      milestoneGp: 0,
      randomItem: null,
    };

    // Otorgar XP diario
    if (config.dailyXp > 0) {
      await db
        .update(studentProfiles)
        .set({
          xp: sql`${studentProfiles.xp} + ${config.dailyXp}`,
        })
        .where(eq(studentProfiles.id, studentProfileId));
      
      // Contribuir XP al clan si aplica
      await clanService.contributeXpToClan(studentProfileId, config.dailyXp, 'Racha de login diaria');
    }

    // Verificar si alcanzó un milestone
    const claimedMilestones = parseClaimedMilestones(streakRecord.claimedMilestones);
    const milestone = config.milestones.find(
      m => m.day === newStreak && !claimedMilestones.includes(m.day)
    );

    if (milestone) {
      rewards.milestoneReached = milestone.day;
      rewards.milestoneXp = milestone.xp;
      rewards.milestoneGp = milestone.gp;

      // Otorgar recompensas del milestone
      await db
        .update(studentProfiles)
        .set({
          xp: sql`${studentProfiles.xp} + ${milestone.xp}`,
          gp: sql`${studentProfiles.gp} + ${milestone.gp}`,
        })
        .where(eq(studentProfiles.id, studentProfileId));
      
      // Contribuir XP del milestone al clan si aplica
      if (milestone.xp > 0) {
        await clanService.contributeXpToClan(studentProfileId, milestone.xp, `Milestone de racha: ${milestone.day} días`);
      }

      // Item aleatorio si aplica
      if (milestone.randomItem) {
        const randomItem = await this.grantRandomItem(studentProfileId, classroomId);
        rewards.randomItem = randomItem;
      }

      // Marcar milestone como reclamado
      const updatedMilestones = [...claimedMilestones, milestone.day];
      await db
        .update(loginStreaks)
        .set({
          claimedMilestones: updatedMilestones,
        })
        .where(eq(loginStreaks.id, streakRecord.id));

      // Crear notificación
      const [profile] = await db
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentProfileId));

      if (profile?.userId) {
        await db.insert(notifications).values({
          id: uuidv4(),
          userId: profile.userId,
          type: 'BADGE',
          title: `🔥 ¡Racha de ${milestone.day} días!`,
          message: `Has mantenido tu racha por ${milestone.day} días. Recompensa: +${milestone.xp} XP${milestone.gp > 0 ? `, +${milestone.gp} GP` : ''}${milestone.randomItem ? ' + Item sorpresa' : ''}`,
          isRead: false,
          createdAt: now,
        });
      }
    }

    return {
      streak: {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        totalLogins: newTotalLogins,
        lastLoginDate: now,
        claimedMilestones: milestone 
          ? [...claimedMilestones, milestone.day]
          : claimedMilestones,
      },
      rewards,
      isNewLogin: true,
      nextMilestone: this.getNextMilestone(
        newStreak, 
        milestone ? [...claimedMilestones, milestone.day] : claimedMilestones,
        config
      ),
    };
  },

  // Obtener estado actual de la racha
  async getStreakStatus(studentProfileId: string, classroomId: string) {
    // Obtener configuración de la clase
    const [classroom] = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.id, classroomId));

    if (!classroom) {
      throw new Error('Clase no encontrada');
    }

    if (!classroom.loginStreakEnabled) {
      return { enabled: false };
    }

    const config = parseLoginStreakConfig(classroom.loginStreakConfig);

    // Obtener registro de streak
    const [streakRecord] = await db
      .select()
      .from(loginStreaks)
      .where(and(
        eq(loginStreaks.studentProfileId, studentProfileId),
        eq(loginStreaks.classroomId, classroomId)
      ));

    if (!streakRecord) {
      return {
        enabled: true,
        streak: {
          currentStreak: 0,
          longestStreak: 0,
          totalLogins: 0,
          lastLoginDate: null,
          claimedMilestones: [],
        },
        config: {
          milestones: config.milestones,
          dailyXp: config.dailyXp,
        },
        nextMilestone: this.getNextMilestone(0, [], config),
        canClaimToday: true,
      };
    }

    // Verificar si ya reclamó hoy
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastLogin = streakRecord.lastLoginDate ? new Date(streakRecord.lastLoginDate) : null;
    const lastLoginDay = lastLogin 
      ? new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate())
      : null;
    const canClaimToday = !lastLoginDay || lastLoginDay.getTime() !== today.getTime();

    // Verificar si la racha se perdió
    let currentStreak = streakRecord.currentStreak;
    if (lastLoginDay && canClaimToday) {
      const daysDiff = Math.floor((today.getTime() - lastLoginDay.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 1 + config.graceDays && config.resetOnMiss) {
        currentStreak = 0; // La racha se perdió
      }
    }

    return {
      enabled: true,
      streak: {
        currentStreak,
        longestStreak: streakRecord.longestStreak,
        totalLogins: streakRecord.totalLogins,
        lastLoginDate: streakRecord.lastLoginDate,
        claimedMilestones: parseClaimedMilestones(streakRecord.claimedMilestones),
      },
      config: {
        milestones: config.milestones,
        dailyXp: config.dailyXp,
      },
      nextMilestone: this.getNextMilestone(currentStreak, parseClaimedMilestones(streakRecord.claimedMilestones), config),
      canClaimToday,
    };
  },

  // Obtener siguiente milestone
  getNextMilestone(
    currentStreak: number, 
    claimedMilestones: number[], 
    config: typeof DEFAULT_LOGIN_STREAK_CONFIG
  ) {
    const nextMilestone = config.milestones
      .filter(m => m.day > currentStreak)
      .sort((a, b) => a.day - b.day)[0];

    if (!nextMilestone) return null;

    return {
      day: nextMilestone.day,
      xp: nextMilestone.xp,
      gp: nextMilestone.gp,
      randomItem: nextMilestone.randomItem,
      daysRemaining: nextMilestone.day - currentStreak,
    };
  },

  // Otorgar item aleatorio de la tienda
  async grantRandomItem(studentProfileId: string, classroomId: string) {
    // Obtener items disponibles en la tienda de la clase
    const items = await db
      .select()
      .from(shopItems)
      .where(and(
        eq(shopItems.classroomId, classroomId),
        eq(shopItems.isActive, true)
      ));

    if (items.length === 0) return null;

    // Seleccionar item aleatorio (preferir items más baratos/comunes)
    const affordableItems = items.filter(i => i.price <= 100);
    const itemPool = affordableItems.length > 0 ? affordableItems : items;
    const randomItem = itemPool[Math.floor(Math.random() * itemPool.length)];

    // Verificar si ya tiene una compra de este item para acumular
    const [existingPurchase] = await db
      .select()
      .from(purchases)
      .where(and(
        eq(purchases.studentId, studentProfileId),
        eq(purchases.itemId, randomItem.id),
        eq(purchases.purchaseType, 'REWARD'),
        eq(purchases.status, 'APPROVED')
      ));

    if (existingPurchase) {
      // Incrementar cantidad existente
      await db
        .update(purchases)
        .set({ 
          quantity: sql`${purchases.quantity} + 1`,
        })
        .where(eq(purchases.id, existingPurchase.id));
    } else {
      // Crear nuevo registro de compra como recompensa
      await db.insert(purchases).values({
        id: uuidv4(),
        studentId: studentProfileId,
        itemId: randomItem.id,
        quantity: 1,
        totalPrice: 0, // Gratis por recompensa
        purchaseType: 'REWARD',
        status: 'APPROVED',
        buyerId: null,
        giftMessage: 'Recompensa por racha de login',
        purchasedAt: new Date(),
      });
    }

    return {
      id: randomItem.id,
      name: randomItem.name,
      description: randomItem.description,
      imageUrl: randomItem.imageUrl,
    };
  },
};
