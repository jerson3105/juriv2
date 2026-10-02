import { and, asc, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { classrooms, itemUsages, purchases, shopItems, studentProfiles, users } from '../db/schema.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { isInitialLevel } from '../utils/energy.js';
import { GIFTS_PER_DAY, classmateName, localDayStart } from '../utils/shopRules.js';
import { shopService } from './shop.service.js';

type Origin = 'SELF' | 'GIFT' | 'TEACHER' | 'REWARD' | 'REDEEM';

/**
 * Tienda del alumno: todo lo que necesita su vista en una carga, con las reglas resueltas en el
 * servidor (qué puede hacer hoy y por qué no). Solo el dueño del perfil; otro perfil → 404.
 */
class StudentShopService {
  private async ownProfile(profileId: string, userId: string) {
    const [row] = await db
      .select({
        id: studentProfiles.id,
        userId: studentProfiles.userId,
        classroomId: studentProfiles.classroomId,
        gp: studentProfiles.gp,
        hp: studentProfiles.hp,
        goalItemId: studentProfiles.shopGoalItemId,
        shopEnabled: classrooms.shopEnabled,
        requiresApproval: classrooms.requirePurchaseApproval,
        dailyLimit: classrooms.dailyPurchaseLimit,
        gradeLevel: classrooms.gradeLevel,
        showCharacterName: classrooms.showCharacterName,
      })
      .from(studentProfiles)
      .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
      .where(eq(studentProfiles.id, profileId));
    if (!row || row.userId !== userId) throw new NotFoundError('Perfil no encontrado');
    return row;
  }

  async getView(profileId: string, userId: string, tz: number) {
    const profile = await this.ownProfile(profileId, userId);
    const itemFields = {
      id: shopItems.id,
      name: shopItems.name,
      description: shopItems.description,
      icon: shopItems.icon,
      imageUrl: shopItems.imageUrl,
      rarity: shopItems.rarity,
      category: shopItems.category,
      price: shopItems.price,
      stock: shopItems.stock,
      isActive: shopItems.isActive,
    };

    const [catalog, received, giftsPaidPending, usages, [today]] = await Promise.all([
      db.select(itemFields).from(shopItems)
        .where(and(eq(shopItems.classroomId, profile.classroomId), eq(shopItems.isActive, true)))
        .orderBy(asc(shopItems.price), asc(shopItems.name)),
      db.select({
        id: purchases.id,
        itemId: purchases.itemId,
        quantity: purchases.quantity,
        usedQuantity: purchases.usedQuantity,
        totalPrice: purchases.totalPrice,
        purchaseType: purchases.purchaseType,
        status: purchases.status,
        buyerId: purchases.buyerId,
        giftMessage: purchases.giftMessage,
        giftAnonymous: purchases.giftAnonymous,
        purchasedAt: purchases.purchasedAt,
      }).from(purchases)
        .where(and(eq(purchases.studentId, profileId), ne(purchases.status, 'REJECTED')))
        .orderBy(asc(purchases.purchasedAt)),
      db.select({
        id: purchases.id,
        itemId: purchases.itemId,
        studentId: purchases.studentId,
        totalPrice: purchases.totalPrice,
        purchasedAt: purchases.purchasedAt,
      }).from(purchases)
        .where(and(eq(purchases.buyerId, profileId), eq(purchases.purchaseType, 'GIFT'), eq(purchases.status, 'PENDING'))),
      db.select({
        id: itemUsages.id,
        purchaseId: itemUsages.purchaseId,
        itemId: itemUsages.itemId,
        status: itemUsages.status,
        usedAt: itemUsages.usedAt,
      }).from(itemUsages)
        .where(eq(itemUsages.studentId, profileId))
        .orderBy(desc(itemUsages.usedAt))
        .limit(300),
      db.select({
        bought: sql<string>`COUNT(*)`,
        gifts: sql<string>`COALESCE(SUM(${purchases.purchaseType} = 'GIFT'), 0)`,
      }).from(purchases)
        .where(and(
          eq(purchases.buyerId, profileId),
          inArray(purchases.purchaseType, ['SELF', 'GIFT']),
          ne(purchases.status, 'REJECTED'),
          gte(purchases.purchasedAt, localDayStart(tz)),
        )),
    ]);

    // Premios que tiene o pidió aunque ya no estén a la venta (se quitaron de la tienda).
    const known = new Map(catalog.map((item) => [item.id, item]));
    const missing = [...new Set([...received, ...giftsPaidPending].map((row) => row.itemId))].filter((id) => !known.has(id));
    if (missing.length > 0) {
      for (const item of await db.select(itemFields).from(shopItems).where(inArray(shopItems.id, missing))) known.set(item.id, item);
    }
    const names = await shopService.namesOf(
      [...received.map((row) => row.buyerId ?? ''), ...giftsPaidPending.map((row) => row.studentId)],
      profile.showCharacterName,
    );
    const itemRef = (itemId: string) => {
      const item = known.get(itemId);
      return item
        ? { itemId, name: item.name, icon: item.icon, imageUrl: item.imageUrl, rarity: item.rarity, category: item.category }
        : { itemId, name: 'Premio', icon: '🎁', imageUrl: null, rarity: 'COMMON' as const, category: 'CONSUMABLE' as const };
    };

    // Esperando a tu profe: compras y regalos por aprobar, y usos pedidos.
    const pendingSelf = received.filter((row) => row.status === 'PENDING' && row.purchaseType === 'SELF');
    const waiting = [
      ...pendingSelf.map((row) => ({ kind: 'purchase' as const, id: row.id, ...itemRef(row.itemId), price: row.totalPrice, at: row.purchasedAt.toISOString(), toName: null })),
      ...giftsPaidPending.map((row) => ({ kind: 'gift' as const, id: row.id, ...itemRef(row.itemId), price: row.totalPrice, at: row.purchasedAt.toISOString(), toName: names.get(row.studentId) ?? null })),
      ...usages.filter((use) => use.status === 'PENDING').map((use) => ({ kind: 'use' as const, id: use.id, ...itemRef(use.itemId), price: 0, at: use.usedAt.toISOString(), toName: null })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    const pendingGold = pendingSelf.reduce((sum, row) => sum + row.totalPrice, 0)
      + giftsPaidPending.reduce((sum, row) => sum + row.totalPrice, 0);

    // Mis premios: una fila por premio con lo que le queda, de dónde salió y sus usos.
    const byItem = new Map<string, typeof received>();
    for (const row of received) {
      if (row.status !== 'APPROVED') continue;
      byItem.set(row.itemId, [...(byItem.get(row.itemId) ?? []), row]);
    }
    const mine = [...byItem.entries()].map(([itemId, rows]) => {
      const ref = itemRef(itemId);
      const consumable = ref.category === 'CONSUMABLE';
      const itemUses = usages.filter((use) => use.itemId === itemId);
      const origins: { kind: Origin; from: string | null }[] = [];
      for (const row of rows) {
        const from = row.purchaseType === 'GIFT'
          ? (row.giftAnonymous ? 'Un compañero o compañera' : names.get(row.buyerId ?? '') ?? null)
          : null;
        if (!origins.some((origin) => origin.kind === row.purchaseType && origin.from === from)) origins.push({ kind: row.purchaseType as Origin, from });
      }
      const usable = rows.find((row) => row.quantity - (row.usedQuantity || 0) > 0);
      const lastGift = [...rows].reverse().find((row) => row.purchaseType === 'GIFT' && row.giftMessage);
      return {
        ...ref,
        consumable,
        available: consumable ? rows.reduce((sum, row) => sum + Math.max(0, row.quantity - (row.usedQuantity || 0)), 0) : rows.reduce((sum, row) => sum + row.quantity, 0),
        waitingUses: itemUses.filter((use) => use.status === 'PENDING').length,
        lastUsedAt: itemUses.find((use) => use.status === 'APPROVED')?.usedAt.toISOString() ?? null,
        usePurchaseId: consumable && usable ? usable.id : null,
        origins,
        giftMessage: lastGift?.giftMessage ?? null,
        lastAt: rows[rows.length - 1].purchasedAt.toISOString(),
      };
    }).sort((a, b) => Number(b.available > 0) - Number(a.available > 0) || b.lastAt.localeCompare(a.lastAt));

    return {
      shop: {
        enabled: profile.shopEnabled,
        requiresApproval: profile.requiresApproval,
        dailyLimit: profile.dailyLimit || null,
        boughtToday: Number(today?.bought ?? 0),
        giftsToday: Number(today?.gifts ?? 0),
        giftsPerDay: GIFTS_PER_DAY,
        paused: profile.hp <= 0 && !isInitialLevel(profile.gradeLevel),
        initial: isInitialLevel(profile.gradeLevel),
        gradeLevel: profile.gradeLevel,
      },
      gold: profile.gp,
      pendingGold,
      goalItemId: profile.goalItemId,
      items: catalog.map(({ isActive: _active, ...item }) => item),
      waiting,
      mine,
    };
  }

  /** El alumno elige (o quita) su meta: un premio activo de su clase. */
  async setGoal(profileId: string, userId: string, itemId: string | null) {
    const profile = await this.ownProfile(profileId, userId);
    if (itemId) {
      const [item] = await db.select({ classroomId: shopItems.classroomId, isActive: shopItems.isActive }).from(shopItems).where(eq(shopItems.id, itemId));
      if (!item || !item.isActive || item.classroomId !== profile.classroomId) throw new ValidationError('Ese premio no está en tu tienda');
    }
    await db.update(studentProfiles).set({ shopGoalItemId: itemId, updatedAt: new Date() }).where(eq(studentProfiles.id, profileId));
    return { goalItemId: itemId };
  }

  /**
   * Compañeros a quienes puede regalar: de su clase, activos, sin demo y sin él. Solo nombre y rol:
   * nada de oro, XP, nivel ni energía (sin comparaciones).
   */
  async getClassmates(profileId: string, userId: string) {
    const profile = await this.ownProfile(profileId, userId);
    const rows = await db
      .select({
        id: studentProfiles.id,
        characterName: studentProfiles.characterName,
        displayName: studentProfiles.displayName,
        characterClass: studentProfiles.characterClass,
        characterClassId: studentProfiles.characterClassId,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(studentProfiles)
      .leftJoin(users, eq(users.id, studentProfiles.userId))
      .where(and(
        eq(studentProfiles.classroomId, profile.classroomId),
        eq(studentProfiles.isActive, true),
        eq(studentProfiles.isDemo, false),
        ne(studentProfiles.id, profileId),
      ));
    return rows
      .map((row) => ({
        id: row.id,
        name: classmateName(row, row.firstName || row.lastName ? row : null, profile.showCharacterName),
        characterClass: row.characterClass,
        characterClassId: row.characterClassId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
}

export const studentShopService = new StudentShopService();
