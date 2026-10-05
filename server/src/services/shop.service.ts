import { eq, and, desc, gte, inArray, ne, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { badgeService } from './badge.service.js';
import { countsInBell, createNotification, createNotifications, emitUnreadCount, type NotificationEntry } from '../utils/notificationEmitter.js';
import {
  shopItems,
  purchases,
  studentProfiles,
  classrooms,
  itemUsages,
  pointLogs,
  notifications,
  users,
  type ShopItem,
  type ItemRarity,
  type PurchaseType,
  type ItemUsageStatus,
} from '../db/schema.js';
import { ARCHIVED_CLASSROOM_MESSAGE, classroomIsArchived, studentInClassroom, teacherOwnsClassroom, userOwnsStudentProfile } from '../utils/access.js';
import { spendGp, affectedRows, applyPointDeltas } from '../utils/points.js';
import { isInitialLevel } from '../utils/energy.js';
import { getShopEconomy, rarityForPrice } from '../utils/shopEconomy.js';
import { DEFAULT_TZ_OFFSET, GIFTS_PER_DAY, classmateName, localDayStart } from '../utils/shopRules.js';

const RESTING_SHOP_MESSAGE = 'Estás descansando: completa tu misión de recuperación para volver a usar la tienda.';
const restingTeacherMessage = (name: string, what: 'compra' | 'uso') =>
  `${name} está descansando: podrás aprobar su ${what} cuando vuelva (cuando complete su misión).`;

/** Rechazo de negocio dentro de una transacción de compra (se devuelve como success:false). */
class PurchaseRejected extends Error {}

// Imágenes predeterminadas por categoría y rareza
const DEFAULT_IMAGES: Record<string, Record<string, string>> = {
  AVATAR: {
    COMMON: '🎭',
    RARE: '👑',
    LEGENDARY: '🌟',
  },
  ACCESSORY: {
    COMMON: '🎀',
    RARE: '💎',
    LEGENDARY: '⚡',
  },
  CONSUMABLE: {
    COMMON: '🧪',
    RARE: '✨',
    LEGENDARY: '🔮',
  },
  SPECIAL: {
    COMMON: '📦',
    RARE: '🎁',
    LEGENDARY: '🏆',
  },
};

export class ShopService {
  private async checkPurchaseBadges(studentProfileId: string, classroomId: string): Promise<void> {
    try {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(purchases)
        .where(and(
          eq(purchases.buyerId, studentProfileId),
          eq(purchases.status, 'APPROVED')
        ));

      await badgeService.checkAndAwardBadges({
        type: 'PURCHASE_MADE',
        data: {
          studentProfileId,
          classroomId,
          totalPurchases: Number(countResult?.count || 0),
        },
      });
    } catch (error) {
      // Silently fail - do not break purchase flow because of badge checks
    }
  }

  // ==================== ITEMS ====================

  async createItem(data: {
    classroomId: string;
    name: string;
    description?: string;
    category: 'AVATAR' | 'ACCESSORY' | 'CONSUMABLE' | 'SPECIAL';
    rarity: ItemRarity;
    price: number;
    imageUrl?: string;
    icon?: string;
    effectType?: string | null;
    effectValue?: number | null;
    stock?: number;
  }): Promise<ShopItem> {
    const now = new Date();
    const id = uuidv4();
    // La rareza sale del precio frente a lo que gana la clase por semana (común 1–2, raro 3–5, legendario más).
    const { effectiveWeekly } = await getShopEconomy(data.classroomId);
    const rarity = rarityForPrice(data.price, effectiveWeekly);

    // Usar icono predeterminado si no se proporciona
    const icon = data.icon || DEFAULT_IMAGES[data.category]?.[rarity] || '📦';

    await db.insert(shopItems).values({
      id,
      classroomId: data.classroomId,
      name: data.name,
      description: data.description || null,
      category: data.category,
      rarity,
      price: data.price,
      imageUrl: data.imageUrl || null,
      icon,
      effectType: data.effectType || null,
      effectValue: data.effectValue || null,
      // 0 es "agotado", no "ilimitado".
      stock: data.stock ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const [item] = await db
      .select()
      .from(shopItems)
      .where(eq(shopItems.id, id));

    return item;
  }

  async updateItem(
    itemId: string,
    data: Partial<{
      name: string;
      description: string | null;
      category: 'AVATAR' | 'ACCESSORY' | 'CONSUMABLE' | 'SPECIAL';
      rarity: ItemRarity;
      price: number;
      imageUrl: string | null;
      icon: string;
      effectType: string | null;
      effectValue: number | null;
      stock: number | null;
      isActive: boolean;
    }>
  ): Promise<ShopItem> {
    // La rareza no se elige: si cambia el precio, se recalcula con el ingreso semanal de la clase.
    const { rarity: _ignored, ...rest } = data;
    let rarity: ItemRarity | undefined;
    if (data.price !== undefined) {
      const [current] = await db.select({ classroomId: shopItems.classroomId }).from(shopItems).where(eq(shopItems.id, itemId));
      if (current) rarity = rarityForPrice(data.price, (await getShopEconomy(current.classroomId)).effectiveWeekly);
    }
    await db
      .update(shopItems)
      .set({
        ...rest,
        ...(rarity ? { rarity } : {}),
        updatedAt: new Date(),
      })
      .where(eq(shopItems.id, itemId));

    const [item] = await db
      .select()
      .from(shopItems)
      .where(eq(shopItems.id, itemId));

    return item;
  }

  async deleteItem(itemId: string): Promise<void> {
    await db
      .update(shopItems)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(shopItems.id, itemId));
  }

  async getItemsByClassroom(classroomId: string): Promise<ShopItem[]> {
    return db
      .select()
      .from(shopItems)
      .where(and(
        eq(shopItems.classroomId, classroomId),
        eq(shopItems.isActive, true)
      ))
      .orderBy(shopItems.rarity, shopItems.price);
  }

  async getItemById(itemId: string): Promise<ShopItem | null> {
    const [item] = await db
      .select()
      .from(shopItems)
      .where(eq(shopItems.id, itemId));
    return item || null;
  }

  // ==================== COMPRAS ====================

  async purchaseItem(data: {
    studentId: string;
    itemId: string;
    quantity?: number;
    purchaseType: PurchaseType;
    buyerId?: string; // ID del estudiante que paga (para regalos)
    giftMessage?: string;
    giftAnonymous?: boolean;
    tz?: number; // getTimezoneOffset() del alumno: el límite diario cuenta desde su medianoche
  }): Promise<{ success: boolean; message: string; purchase?: any; requiresApproval?: boolean }> {
    const quantity = data.quantity || 1;
    const isStudentPurchase = data.purchaseType === 'SELF' || data.purchaseType === 'GIFT';

    // Quien recibe y su clase (la configuración de la tienda es la de su clase)
    const [student] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.id, data.studentId));

    if (!student) {
      return { success: false, message: 'Estudiante no encontrado' };
    }

    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, student.classroomId),
    });

    if (!classroom) {
      return { success: false, message: 'Clase no encontrada' };
    }

    // Tienda cerrada: el profesor sí puede dar premios.
    if (!classroom.shopEnabled && data.purchaseType !== 'TEACHER') {
      return { success: false, message: 'Tu profe cerró la tienda por ahora' };
    }

    const item = await this.getItemById(data.itemId);
    if (!item || !item.isActive) {
      return { success: false, message: 'Este premio ya no está en la tienda' };
    }
    // Solo premios de la clase de quien recibe (con perfiles en dos clases se podía gastar el oro de una en la otra).
    if (item.classroomId !== student.classroomId) {
      return { success: false, message: 'Este premio no es de tu clase' };
    }

    // Quién paga: el alumno al comprar, quien regala al regalar; el profesor no cobra a nadie.
    const payerId = data.purchaseType === 'SELF' ? data.studentId : data.purchaseType === 'GIFT' ? (data.buyerId || null) : null;
    if (data.purchaseType === 'GIFT') {
      if (!payerId || payerId === data.studentId) return { success: false, message: 'No puedes regalarte un premio a ti' };
      if (!student.isActive || student.isDemo) return { success: false, message: 'No puedes regalarle a ese compañero' };
    }

    let payer: typeof studentProfiles.$inferSelect | null = null;
    if (payerId) {
      const [payerProfile] = payerId === student.id
        ? [student]
        : await db.select().from(studentProfiles).where(eq(studentProfiles.id, payerId));
      if (!payerProfile) {
        return { success: false, message: 'Comprador no encontrado' };
      }
      if (payerProfile.classroomId !== item.classroomId) {
        return { success: false, message: 'Solo puedes comprar en la tienda de tu clase' };
      }
      payer = payerProfile;
      // Con 0 de energía la tienda está en pausa para quien paga (en Inicial no hay pausa).
      if (payer.hp <= 0 && !isInitialLevel(classroom.gradeLevel)) return { success: false, message: RESTING_SHOP_MESSAGE };
    }

    // Límite diario y regalos por día: lo que pagó hoy (día local), sin contar lo no aprobado.
    if (payerId && isStudentPurchase) {
      const [today] = await db
        .select({
          bought: sql<string>`COUNT(*)`,
          gifts: sql<string>`COALESCE(SUM(${purchases.purchaseType} = 'GIFT'), 0)`,
        })
        .from(purchases)
        .where(and(
          eq(purchases.buyerId, payerId),
          inArray(purchases.purchaseType, ['SELF', 'GIFT']),
          ne(purchases.status, 'REJECTED'),
          gte(purchases.purchasedAt, localDayStart(data.tz ?? DEFAULT_TZ_OFFSET)),
        ));
      // 0 o vacío = sin límite (datos antiguos podían guardar 0).
      if (classroom.dailyPurchaseLimit && Number(today?.bought ?? 0) >= classroom.dailyPurchaseLimit) {
        return {
          success: false,
          message: classroom.dailyPurchaseLimit === 1
            ? 'Ya compraste hoy. Mañana puedes comprar otra vez.'
            : `Hoy ya hiciste las ${classroom.dailyPurchaseLimit} compras que permite tu profe.`,
        };
      }
      if (data.purchaseType === 'GIFT' && Number(today?.gifts ?? 0) >= GIFTS_PER_DAY) {
        return { success: false, message: 'Hoy ya hiciste un regalo. Mañana puedes regalar otra vez.' };
      }
    }

    if (item.stock !== null && item.stock < quantity) {
      return { success: false, message: 'Este premio se agotó' };
    }

    const totalPrice = item.price * quantity;

    // Con aprobación del profesor (compras y regalos) se registra el pedido y se cobra al aprobar.
    const requiresApproval = classroom.requirePurchaseApproval && isStudentPurchase;
    const purchaseStatus = requiresApproval ? 'PENDING' : 'APPROVED';

    if (payer) {
      // No se reserva el oro, pero no se puede pedir más del que alcanza contando lo que ya espera.
      const pendingGold = requiresApproval ? await this.pendingGoldOf(payer.id) : 0;
      if (payer.gp - pendingGold < totalPrice) {
        return {
          success: false,
          message: pendingGold > 0
            ? `No te alcanza: tienes ${payer.gp} de oro y ${pendingGold} ya esperan a tu profe.`
            : `No te alcanza: tienes ${payer.gp} de oro y «${item.name}» cuesta ${totalPrice}.`,
        };
      }
    }

    const names = await this.namesOf([data.studentId, ...(payerId ? [payerId] : [])], classroom.showCharacterName);
    const recipientName = names.get(data.studentId) ?? 'tu compañero';
    const payerName = payerId ? names.get(payerId) ?? 'Un estudiante' : null;

    let purchaseId = '';
    const now = new Date();

    // Si requiere aprobación, solo registrar el pedido (sin tocar oro ni stock)
    if (requiresApproval) {
      purchaseId = uuidv4();
      await db.insert(purchases).values({
        id: purchaseId,
        studentId: data.studentId,
        itemId: data.itemId,
        quantity,
        totalPrice,
        purchaseType: data.purchaseType,
        status: purchaseStatus,
        buyerId: payerId,
        giftMessage: data.giftMessage || null,
        giftAnonymous: data.purchaseType === 'GIFT' && !!data.giftAnonymous,
        purchasedAt: now,
      });

      // Aviso al profesor: si no, solo se entera entrando a la tienda.
      try {
        await createNotification({
          userId: classroom.teacherId,
          classroomId: classroom.id,
          type: 'ANNOUNCEMENT',
          title: data.purchaseType === 'GIFT' ? '🎁 Regalo por aprobar' : '🛒 Compra por aprobar',
          message: data.purchaseType === 'GIFT'
            ? `${payerName} quiere regalarle "${item.name}" a ${recipientName} (${totalPrice} de oro)`
            : `${payerName} quiere comprar "${item.name}" (${totalPrice} de oro)`,
          data: { purchaseId, studentId: data.studentId, itemId: item.id, kind: 'PURCHASE_PENDING' },
        });
      } catch (notifError) {
        console.error('Error creating purchase notification:', notifError);
      }
    } else {
      try {
      await db.transaction(async (tx) => {
        if (payerId && payer) {
          // Cobro atómico: con compras simultáneas no se puede gastar el mismo oro dos veces.
          if (!(await spendGp(tx, payerId, totalPrice))) {
            throw new PurchaseRejected(`No te alcanza: «${item.name}» cuesta ${totalPrice} de oro.`);
          }

          if (totalPrice > 0) {
            const reason = data.purchaseType === 'GIFT'
              ? `Regalo en tienda: ${item.name}`
              : `Compra en tienda: ${item.name}`;

            await tx.insert(pointLogs).values({
              id: uuidv4(),
              studentId: payerId,
              pointType: 'GP',
              action: 'REMOVE',
              amount: totalPrice,
              reason,
              createdAt: now,
            });
          }
        }

        if (item.stock !== null) {
          // Descuento atómico de stock: evita vender más unidades de las que hay.
          const stockResult = await tx
            .update(shopItems)
            .set({
              stock: sql`${shopItems.stock} - ${quantity}`,
              updatedAt: now,
            })
            .where(and(eq(shopItems.id, data.itemId), gte(shopItems.stock, quantity)));
          if (affectedRows(stockResult) !== 1) {
            throw new PurchaseRejected('Este premio se agotó');
          }
        }

        // Una fila por compra (antes la recompra se sumaba a la fila vieja y el límite diario no la veía).
        purchaseId = uuidv4();
        await tx.insert(purchases).values({
          id: purchaseId,
          studentId: data.studentId,
          itemId: data.itemId,
          quantity,
          totalPrice,
          purchaseType: data.purchaseType,
          status: purchaseStatus,
          buyerId: payerId,
          giftMessage: data.giftMessage || null,
          giftAnonymous: data.purchaseType === 'GIFT' && !!data.giftAnonymous,
          purchasedAt: now,
        });
      });
      } catch (error) {
        if (error instanceof PurchaseRejected) {
          return { success: false, message: error.message };
        }
        throw error;
      }
    }

    if (!purchaseId) {
      return { success: false, message: 'No se pudo registrar la compra' };
    }

    // Obtener compra con detalles
    const [purchase] = await db
      .select({
        id: purchases.id,
        quantity: purchases.quantity,
        totalPrice: purchases.totalPrice,
        purchaseType: purchases.purchaseType,
        giftMessage: purchases.giftMessage,
        purchasedAt: purchases.purchasedAt,
        item: {
          id: shopItems.id,
          name: shopItems.name,
          icon: shopItems.icon,
          rarity: shopItems.rarity,
        },
      })
      .from(purchases)
      .innerJoin(shopItems, eq(purchases.itemId, shopItems.id))
      .where(eq(purchases.id, purchaseId));

    const message = data.purchaseType === 'GIFT'
      ? (requiresApproval ? 'Listo: tu profe revisará tu regalo.' : `¡Le regalaste «${item.name}» a ${recipientName}!`)
      : data.purchaseType === 'TEACHER'
        ? `Entregado: ${item.name}`
        : (requiresApproval ? 'Listo: tu profe revisará tu compra.' : `¡Listo! «${item.name}» ya es tuyo.`);

    // Quien recibe un premio se entera (regalo de un compañero o entrega del profe).
    if (!requiresApproval && (data.purchaseType === 'GIFT' || data.purchaseType === 'TEACHER')) {
      await this.notifyReceived({
        recipientUserId: student.userId,
        classroomId: classroom.id,
        itemName: item.name,
        purchaseId,
        fromName: data.purchaseType === 'TEACHER' ? null : (data.giftAnonymous ? 'Un compañero o compañera' : payerName),
        giftMessage: data.giftMessage ?? null,
      });
    }

    if (!requiresApproval && payerId) {
      await this.checkPurchaseBadges(payerId, item.classroomId);
    }

    return {
      success: true,
      message,
      purchase,
      requiresApproval,
    };
  }

  /** Oro de pedidos que el alumno pagará cuando el profesor los apruebe. */
  private async pendingGoldOf(payerId: string): Promise<number> {
    const [row] = await db
      .select({ total: sql<string>`COALESCE(SUM(${purchases.totalPrice}), 0)` })
      .from(purchases)
      .where(and(eq(purchases.buyerId, payerId), eq(purchases.status, 'PENDING')));
    return Number(row?.total ?? 0);
  }

  /** Nombres con los que los alumnos se ven entre sí (personaje o nombre real, según la clase). */
  async namesOf(profileIds: string[], showCharacterName: boolean): Promise<Map<string, string>> {
    const ids = [...new Set(profileIds)].filter(Boolean);
    if (ids.length === 0) return new Map();
    const rows = await db
      .select({
        id: studentProfiles.id,
        characterName: studentProfiles.characterName,
        displayName: studentProfiles.displayName,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(studentProfiles)
      .leftJoin(users, eq(users.id, studentProfiles.userId))
      .where(inArray(studentProfiles.id, ids));
    return new Map(rows.map((row) => [row.id, classmateName(row, row.firstName || row.lastName ? row : null, showCharacterName)]));
  }

  /** Aviso a quien recibe un premio (sin cuenta vinculada no hay a quién avisar). */
  private async notifyReceived(input: {
    recipientUserId: string | null;
    classroomId: string;
    itemName: string;
    purchaseId: string;
    fromName: string | null;
    giftMessage: string | null;
  }) {
    if (!input.recipientUserId) return;
    try {
      await createNotification({
        userId: input.recipientUserId,
        classroomId: input.classroomId,
        type: 'GIFT_RECEIVED',
        title: input.fromName ? '🎁 Te regalaron un premio' : '🎁 Tu profe te dio un premio',
        message: input.fromName
          ? `${input.fromName} te regaló "${input.itemName}".${input.giftMessage ? ` «${input.giftMessage}»` : ''} Está en Mis premios.`
          : `"${input.itemName}" ya está en Mis premios.`,
        data: { purchaseId: input.purchaseId, kind: input.fromName ? 'GIFT' : 'TEACHER' },
      });
    } catch (error) {
      console.error('Error notifying received prize:', error);
    }
  }

  // Compra por profesor (no descuenta GP de nadie)
  async teacherPurchaseForStudent(data: {
    studentId: string;
    itemId: string;
    quantity?: number;
  }): Promise<{ success: boolean; message: string; purchase?: any }> {
    return this.purchaseItem({
      studentId: data.studentId,
      itemId: data.itemId,
      quantity: data.quantity,
      purchaseType: 'TEACHER',
    });
  }

  // ==================== APROBACIÓN DE COMPRAS ====================

  async getPendingPurchases(classroomId: string) {
    const rows = await db
      .select({
        id: purchases.id,
        quantity: purchases.quantity,
        totalPrice: purchases.totalPrice,
        purchasedAt: purchases.purchasedAt,
        purchaseType: purchases.purchaseType,
        buyerId: purchases.buyerId,
        student: {
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
          gp: studentProfiles.gp,
          hp: studentProfiles.hp,
        },
        item: {
          id: shopItems.id,
          name: shopItems.name,
          icon: shopItems.icon,
          imageUrl: shopItems.imageUrl,
          rarity: shopItems.rarity,
          price: shopItems.price,
        },
      })
      .from(purchases)
      .innerJoin(studentProfiles, eq(purchases.studentId, studentProfiles.id))
      .innerJoin(shopItems, eq(purchases.itemId, shopItems.id))
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(purchases.status, 'PENDING')
      ))
      .orderBy(desc(purchases.purchasedAt));

    // En un regalo paga quien regala: su oro y su descanso son los que cuentan al aprobar.
    const buyerIds = [...new Set(rows.filter((row) => row.purchaseType === 'GIFT' && row.buyerId).map((row) => row.buyerId as string))];
    const buyers = buyerIds.length > 0
      ? await db
        .select({ id: studentProfiles.id, characterName: studentProfiles.characterName, gp: studentProfiles.gp, hp: studentProfiles.hp })
        .from(studentProfiles)
        .where(inArray(studentProfiles.id, buyerIds))
      : [];
    const buyerById = new Map(buyers.map((buyer) => [buyer.id, buyer]));
    return rows.map(({ buyerId, ...row }) => ({
      ...row,
      buyer: row.purchaseType === 'GIFT' && buyerId ? buyerById.get(buyerId) ?? null : null,
    }));
  }

  async approvePurchase(purchaseId: string, teacherId: string): Promise<{ success: boolean; message: string }> {
    // Obtener la compra
    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.id, purchaseId));

    if (!purchase) {
      return { success: false, message: 'Compra no encontrada' };
    }

    if (purchase.status !== 'PENDING') {
      return { success: false, message: 'Esta compra ya fue procesada' };
    }

    // Obtener estudiante y clase
    const [student] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.id, purchase.studentId));

    if (!student) {
      return { success: false, message: 'Estudiante no encontrado' };
    }

    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, student.classroomId),
    });

    if (!classroom || classroom.teacherId !== teacherId) {
      return { success: false, message: 'No tienes permiso para aprobar esta compra' };
    }
    if (!classroom.isActive) return { success: false, message: ARCHIVED_CLASSROOM_MESSAGE };

    // Paga quien compró o quien regaló (antes se cobraba siempre a quien recibe).
    const isGift = purchase.purchaseType === 'GIFT';
    const payerId = purchase.buyerId || purchase.studentId;
    const [payer] = payerId === student.id
      ? [student]
      : await db.select().from(studentProfiles).where(eq(studentProfiles.id, payerId));
    if (!payer) {
      return { success: false, message: 'Estudiante no encontrado' };
    }
    const names = await this.namesOf([student.id, payer.id], classroom.showCharacterName);
    const payerName = names.get(payer.id) ?? 'El estudiante';

    // La tienda está en pausa mientras descansa: el pedido espera a que vuelva (en Inicial no hay pausa).
    if (payer.hp <= 0 && !isInitialLevel(classroom.gradeLevel)) {
      return { success: false, message: restingTeacherMessage(payerName, 'compra') };
    }

    if (payer.gp < purchase.totalPrice) {
      return { success: false, message: `${payerName} ya no tiene suficiente oro` };
    }

    // Obtener item para verificar stock
    const item = await this.getItemById(purchase.itemId);
    if (item && item.stock !== null && item.stock < purchase.quantity) {
      return { success: false, message: 'Ya no quedan unidades de este artículo' };
    }

    const now = new Date();
    const purchaseLabel = item?.name || 'tu premio';

    try {
    await db.transaction(async (tx) => {
      // Reclamar la compra primero: solo una aprobación simultánea puede pasar de PENDING a APPROVED.
      const claim = await tx
        .update(purchases)
        .set({ status: 'APPROVED' })
        .where(and(eq(purchases.id, purchaseId), eq(purchases.status, 'PENDING')));
      if (affectedRows(claim) !== 1) {
        throw new PurchaseRejected('Esta compra ya fue procesada');
      }

      if (!(await spendGp(tx, payer.id, purchase.totalPrice))) {
        throw new PurchaseRejected(`${payerName} ya no tiene suficiente oro`);
      }

      if (purchase.totalPrice > 0) {
        await tx.insert(pointLogs).values({
          id: uuidv4(),
          studentId: payer.id,
          pointType: 'GP',
          action: 'REMOVE',
          amount: purchase.totalPrice,
          reason: isGift ? `Regalo en tienda: ${purchaseLabel}` : `Compra aprobada en tienda: ${purchaseLabel}`,
          createdAt: now,
        });
      }

      if (item && item.stock !== null) {
        const stockResult = await tx
          .update(shopItems)
          .set({
            stock: sql`${shopItems.stock} - ${purchase.quantity}`,
            updatedAt: now,
          })
          .where(and(eq(shopItems.id, purchase.itemId), gte(shopItems.stock, purchase.quantity)));
        if (affectedRows(stockResult) !== 1) {
          throw new PurchaseRejected('Ya no quedan unidades de este artículo');
        }
      }

      if (payer.userId) {
        await tx.insert(notifications).values({
          id: uuidv4(),
          userId: payer.userId,
          classroomId: classroom.id,
          type: 'PURCHASE_APPROVED',
          title: isGift ? 'Tu profe aprobó tu regalo' : 'Tu profe aprobó tu compra',
          message: isGift
            ? `"${purchaseLabel}" ya es de ${names.get(student.id) ?? 'tu compañero'}. Se descontaron ${purchase.totalPrice} de oro.`
            : `"${purchaseLabel}" ya es tuyo. Se descontaron ${purchase.totalPrice} de oro.`,
          isRead: false,
          createdAt: now,
        });
      }
    });
    } catch (error) {
      if (error instanceof PurchaseRejected) {
        return { success: false, message: error.message };
      }
      throw error;
    }

    // Emit after tx commit
    if (payer.userId) {
      await emitUnreadCount(payer.userId);
    }
    if (isGift) {
      await this.notifyReceived({
        recipientUserId: student.userId,
        classroomId: classroom.id,
        itemName: purchaseLabel,
        purchaseId,
        fromName: purchase.giftAnonymous ? 'Un compañero o compañera' : payerName,
        giftMessage: purchase.giftMessage,
      });
    }

    await this.checkPurchaseBadges(payer.id, student.classroomId);

    return { success: true, message: 'Compra aprobada' };
  }

  async rejectPurchase(purchaseId: string, teacherId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    // Obtener la compra
    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.id, purchaseId));

    if (!purchase) {
      return { success: false, message: 'Compra no encontrada' };
    }

    if (purchase.status !== 'PENDING') {
      return { success: false, message: 'Esta compra ya fue procesada' };
    }

    // Obtener estudiante y clase
    const [student] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.id, purchase.studentId));

    if (!student) {
      return { success: false, message: 'Estudiante no encontrado' };
    }

    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, student.classroomId),
    });

    if (!classroom || classroom.teacherId !== teacherId) {
      return { success: false, message: 'No tienes permiso para rechazar esta compra' };
    }
    if (!classroom.isActive) return { success: false, message: ARCHIVED_CLASSROOM_MESSAGE };

    // Rechazar compra solo si sigue pendiente (no pisar una aprobación simultánea ya cobrada)
    const rejectResult = await db
      .update(purchases)
      .set({ status: 'REJECTED' })
      .where(and(eq(purchases.id, purchaseId), eq(purchases.status, 'PENDING')));
    if (affectedRows(rejectResult) !== 1) {
      return { success: false, message: 'Esta compra ya fue procesada' };
    }

    // Obtener item para el mensaje
    const item = await this.getItemById(purchase.itemId);

    // Avisar a quien pidió (el que compró o el que regaló); el pedido no cobró nada.
    const isGift = purchase.purchaseType === 'GIFT';
    const payerId = purchase.buyerId || purchase.studentId;
    const [payer] = payerId === student.id
      ? [student]
      : await db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.id, payerId));
    if (payer?.userId) {
      const what = isGift ? `tu regalo "${item?.name || 'premio'}"` : `tu compra de "${item?.name || 'premio'}"`;
      await createNotification({
        userId: payer.userId,
        classroomId: classroom.id,
        type: 'PURCHASE_REJECTED',
        title: isGift ? 'Tu profe no aprobó tu regalo' : 'Tu profe no aprobó tu compra',
        message: `${what.charAt(0).toUpperCase()}${what.slice(1)}: no se descontó tu oro.${reason ? ` ${reason}` : ''}`,
      });
    }

    return { success: true, message: 'Compra rechazada' };
  }

  // ==================== HISTORIAL ====================

  async getStudentPurchases(studentId: string) {
    return db
      .select({
        id: purchases.id,
        quantity: purchases.quantity,
        usedQuantity: purchases.usedQuantity,
        totalPrice: purchases.totalPrice,
        purchaseType: purchases.purchaseType,
        status: purchases.status,
        giftMessage: purchases.giftMessage,
        purchasedAt: purchases.purchasedAt,
        item: {
          id: shopItems.id,
          name: shopItems.name,
          description: shopItems.description,
          icon: shopItems.icon,
          imageUrl: shopItems.imageUrl,
          rarity: shopItems.rarity,
          category: shopItems.category,
        },
      })
      .from(purchases)
      .innerJoin(shopItems, eq(purchases.itemId, shopItems.id))
      .where(eq(purchases.studentId, studentId))
      .orderBy(desc(purchases.purchasedAt));
  }

  async getGiftsReceived(studentId: string) {
    return db
      .select({
        id: purchases.id,
        quantity: purchases.quantity,
        giftMessage: purchases.giftMessage,
        purchasedAt: purchases.purchasedAt,
        item: {
          id: shopItems.id,
          name: shopItems.name,
          icon: shopItems.icon,
          rarity: shopItems.rarity,
        },
        from: {
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
        },
      })
      .from(purchases)
      .innerJoin(shopItems, eq(purchases.itemId, shopItems.id))
      .leftJoin(studentProfiles, eq(purchases.buyerId, studentProfiles.id))
      .where(and(
        eq(purchases.studentId, studentId),
        eq(purchases.purchaseType, 'GIFT')
      ))
      .orderBy(desc(purchases.purchasedAt));
  }

  async getGiftsSent(studentId: string) {
    return db
      .select({
        id: purchases.id,
        quantity: purchases.quantity,
        totalPrice: purchases.totalPrice,
        giftMessage: purchases.giftMessage,
        purchasedAt: purchases.purchasedAt,
        item: {
          id: shopItems.id,
          name: shopItems.name,
          icon: shopItems.icon,
          rarity: shopItems.rarity,
        },
        to: {
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
        },
      })
      .from(purchases)
      .innerJoin(shopItems, eq(purchases.itemId, shopItems.id))
      .innerJoin(studentProfiles, eq(purchases.studentId, studentProfiles.id))
      // Las compras propias también guardan buyerId: solo los regalos son "enviados".
      .where(and(eq(purchases.buyerId, studentId), eq(purchases.purchaseType, 'GIFT')))
      .orderBy(desc(purchases.purchasedAt));
  }

  // ==================== VALIDACIONES ====================

  async verifyTeacherOwnsClassroom(teacherId: string, classroomId: string): Promise<boolean> {
    return teacherOwnsClassroom(teacherId, classroomId);
  }

  async verifyStudentInClassroom(studentId: string, classroomId: string): Promise<boolean> {
    const [student] = await db
      .select()
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.id, studentId),
        eq(studentProfiles.classroomId, classroomId)
      ));
    return !!student;
  }

  async verifyStudentBelongsToUser(studentId: string, userId: string): Promise<boolean> {
    return userOwnsStudentProfile(userId, studentId);
  }

  async verifyStudentUserInClassroom(userId: string, classroomId: string): Promise<boolean> {
    return studentInClassroom(userId, classroomId);
  }

  // ==================== USO DE ITEMS ====================

  async useItem(purchaseId: string, studentId: string): Promise<{ success: boolean; message: string; usage?: any }> {
    try {
      // Obtener la compra
      const [purchase] = await db
        .select()
        .from(purchases)
        .where(and(
          eq(purchases.id, purchaseId),
          eq(purchases.studentId, studentId)
        ));

      if (!purchase) {
        return { success: false, message: 'Compra no encontrada' };
      }

      // Solo se usa lo que ya es tuyo: un pedido pendiente o rechazado no se pagó.
      if (purchase.status !== 'APPROVED') {
        return { success: false, message: purchase.status === 'PENDING' ? 'Tu profe todavía no aprueba esta compra' : 'Esta compra no fue aprobada' };
      }

      // Verificar que quedan items por usar
      const remaining = purchase.quantity - (purchase.usedQuantity || 0);
      if (remaining <= 0) {
        return { success: false, message: 'Ya usaste todos los de esta compra' };
      }

      // Obtener el item para verificar que es consumible
      const item = await this.getItemById(purchase.itemId);
      if (!item) {
        return { success: false, message: 'Este premio ya no existe' };
      }

      if (item.category !== 'CONSUMABLE') {
        return { success: false, message: 'Este premio es tuyo para siempre: no se gasta al usarlo' };
      }

      // Obtener el estudiante para saber el classroomId
      const [student] = await db
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentId));

      if (!student) {
        return { success: false, message: 'Estudiante no encontrado' };
      }

      if (student.hp <= 0) {
        const [cls] = await db.select({ gradeLevel: classrooms.gradeLevel }).from(classrooms).where(eq(classrooms.id, student.classroomId));
        if (!isInitialLevel(cls?.gradeLevel)) return { success: false, message: RESTING_SHOP_MESSAGE };
      }

      // Crear registro de uso primero
      const usageId = uuidv4();
      const now = new Date();
      
      try {
        await db.transaction(async (tx) => {
          // Consumir una unidad de forma atómica: con usos simultáneos no se puede
          // canjear más unidades de las compradas.
          const consumed = await tx
            .update(purchases)
            .set({ usedQuantity: sql`COALESCE(${purchases.usedQuantity}, 0) + 1` })
            .where(and(
              eq(purchases.id, purchaseId),
              sql`COALESCE(${purchases.usedQuantity}, 0) < ${purchases.quantity}`
            ));
          if (affectedRows(consumed) !== 1) {
            throw new PurchaseRejected('Ya usaste todos los items de esta compra');
          }

          await tx.insert(itemUsages).values({
            id: usageId,
            purchaseId,
            studentId,
            itemId: purchase.itemId,
            classroomId: student.classroomId,
            status: 'PENDING',
            usedAt: now,
          });
        });
      } catch (error) {
        if (error instanceof PurchaseRejected) {
          return { success: false, message: error.message };
        }
        throw error;
      }

      // Obtener el profesor de la clase
      const [classroom] = await db
        .select()
        .from(classrooms)
        .where(eq(classrooms.id, student.classroomId));

      if (classroom) {
        // Crear notificación para el profesor
        try {
          await createNotification({
            userId: classroom.teacherId,
            classroomId: student.classroomId,
            type: 'ITEM_USED',
            title: '🎟️ Pidió usar un premio',
            message: `${(await this.namesOf([studentId], classroom.showCharacterName)).get(studentId) ?? 'Un estudiante'} quiere usar "${item.name}"${item.description ? `: ${item.description}` : ''}`,
            data: {
              usageId,
              studentId,
              studentName: student.characterName,
              itemId: item.id,
              itemName: item.name,
              itemIcon: item.icon,
              itemDescription: item.description,
            },
          });
        } catch (notifError) {
          console.error('Error creating notification:', notifError);
          // No fallar si la notificación falla
        }
      }

      return { 
        success: true, 
        message: 'Listo: tu profe verá tu pedido.',
        usage: {
          id: usageId,
          itemName: item.name,
          remaining: remaining - 1,
        }
      };
    } catch (error) {
      console.error('Error in useItem:', error);
      return { success: false, message: 'No se pudo pedir el uso' };
    }
  }

  async getItemUsagesPending(classroomId: string) {
    return db
      .select({
        id: itemUsages.id,
        status: itemUsages.status,
        usedAt: itemUsages.usedAt,
        student: {
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
          characterClass: studentProfiles.characterClass,
          // Descansando: el uso espera a que vuelva (se ve en la bandeja del profesor).
          hp: studentProfiles.hp,
        },
        item: {
          id: shopItems.id,
          name: shopItems.name,
          icon: shopItems.icon,
          imageUrl: shopItems.imageUrl,
          rarity: shopItems.rarity,
        },
      })
      .from(itemUsages)
      .innerJoin(studentProfiles, eq(itemUsages.studentId, studentProfiles.id))
      .innerJoin(shopItems, eq(itemUsages.itemId, shopItems.id))
      .where(and(
        eq(itemUsages.classroomId, classroomId),
        eq(itemUsages.status, 'PENDING')
      ))
      .orderBy(desc(itemUsages.usedAt));
  }

  async reviewItemUsage(usageId: string, teacherId: string, status: 'APPROVED' | 'REJECTED'): Promise<{ success: boolean; message: string }> {
    const [usage] = await db
      .select()
      .from(itemUsages)
      .where(eq(itemUsages.id, usageId));

    if (!usage) {
      return { success: false, message: 'Uso no encontrado' };
    }

    if (usage.status !== 'PENDING') {
      return { success: false, message: 'Este uso ya fue revisado' };
    }

    // Mientras descansa la tienda está en pausa: aprobar espera a que vuelva (rechazar sí se puede).
    if (status === 'APPROVED') {
      const [owner] = await db.select({ hp: studentProfiles.hp }).from(studentProfiles).where(eq(studentProfiles.id, usage.studentId));
      const [cls] = await db.select({ gradeLevel: classrooms.gradeLevel, showCharacterName: classrooms.showCharacterName })
        .from(classrooms).where(eq(classrooms.id, usage.classroomId));
      if (owner && owner.hp <= 0 && !isInitialLevel(cls?.gradeLevel)) {
        const name = (await this.namesOf([usage.studentId], cls?.showCharacterName ?? true)).get(usage.studentId) ?? 'El estudiante';
        return { success: false, message: restingTeacherMessage(name, 'uso') };
      }
    }

    let healed = 0;
    try {
      await db.transaction(async (tx) => {
        // Solo una revisión puede pasar de PENDING (evita doble aprobación/rechazo simultáneo).
        const claim = await tx
          .update(itemUsages)
          .set({ status, reviewedAt: new Date(), reviewedBy: teacherId })
          .where(and(eq(itemUsages.id, usageId), eq(itemUsages.status, 'PENDING')));
        if (affectedRows(claim) !== 1) {
          throw new PurchaseRejected('Este uso ya fue revisado');
        }

        if (status === 'APPROVED') {
          const item = await this.getItemById(usage.itemId);
          if (item?.effectType === 'HEAL_HP' && (item.effectValue ?? 0) > 0) {
            const [cls] = await tx.select({ maxHp: classrooms.maxHp }).from(classrooms).where(eq(classrooms.id, usage.classroomId));
            const [before] = await tx.select({ hp: studentProfiles.hp }).from(studentProfiles).where(eq(studentProfiles.id, usage.studentId)).for('update');
            const updated = await applyPointDeltas(tx, usage.studentId, { hp: item.effectValue! }, { hpMax: cls?.maxHp ?? 100 });
            healed = Math.max(0, (updated?.hp ?? 0) - (before?.hp ?? 0));
            if (healed > 0) {
              await tx.insert(pointLogs).values({
                id: uuidv4(),
                studentId: usage.studentId,
                pointType: 'HP',
                action: 'ADD',
                amount: healed,
                reason: `Poción: ${item.name}`,
                givenBy: teacherId,
                createdAt: new Date(),
              });
            }
          }
        }

        // Rechazado: la unidad se descontó al pedir el uso; se le devuelve al estudiante.
        if (status === 'REJECTED') {
          await tx
            .update(purchases)
            .set({ usedQuantity: sql`GREATEST(COALESCE(${purchases.usedQuantity}, 0) - 1, 0)` })
            .where(eq(purchases.id, usage.purchaseId));
        }
      });
    } catch (error) {
      if (error instanceof PurchaseRejected) {
        return { success: false, message: error.message };
      }
      throw error;
    }

    // Avisar al estudiante del resultado
    try {
      const [student] = await db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.id, usage.studentId));
      const item = await this.getItemById(usage.itemId);
      if (student?.userId) {
        await createNotification({
          userId: student.userId,
          classroomId: usage.classroomId,
          type: status === 'APPROVED' ? 'PURCHASE_APPROVED' : 'PURCHASE_REJECTED',
          title: status === 'APPROVED' ? '✅ Tu profe aprobó tu premio' : 'Hoy no se pudo usar',
          message: status === 'APPROVED'
            ? `"${item?.name ?? 'Tu premio'}": ¡disfrútalo!`
            : `Tu profe dice que hoy no se puede usar "${item?.name ?? 'tu premio'}". Lo sigues teniendo para otra ocasión.`,
        });
      }
    } catch (notifError) {
      console.error('Error notifying usage review:', notifError);
    }

    return {
      success: true,
      message: status === 'APPROVED' ? (healed > 0 ? `Uso aprobado: +${healed} de energía` : 'Uso aprobado') : 'Uso rechazado: se le devolvió el artículo'
    };
  }

  // ==================== PROFESOR: DAR, DESHACER E INVENTARIO ====================

  // Da un artículo a varios estudiantes (gratis); cada uno queda en su propia compra para poder deshacerla.
  async giveToStudents(itemId: string, studentIds: string[], quantity = 1): Promise<{
    given: { studentId: string; purchaseId: string }[];
    failed: { studentId: string; message: string }[];
  }> {
    const given: { studentId: string; purchaseId: string }[] = [];
    const failed: { studentId: string; message: string }[] = [];
    for (const studentId of studentIds) {
      try {
        const result = await this.teacherPurchaseForStudent({ studentId, itemId, quantity });
        if (result.success && result.purchase?.id) given.push({ studentId, purchaseId: result.purchase.id });
        else failed.push({ studentId, message: result.message });
      } catch {
        failed.push({ studentId, message: 'No se pudo dar el artículo' });
      }
    }
    return { given, failed };
  }

  // Deshace un artículo dado por el profesor mientras no se haya usado (devuelve el stock).
  async undoTeacherGift(purchaseId: string, teacherId: string): Promise<{ success: boolean; message: string }> {
    try {
      await db.transaction(async (tx) => {
        const [purchase] = await tx.select().from(purchases).where(eq(purchases.id, purchaseId)).for('update');
        if (!purchase || purchase.purchaseType !== 'TEACHER') throw new PurchaseRejected('Entrega no encontrada');
        const [student] = await tx.select({ classroomId: studentProfiles.classroomId }).from(studentProfiles).where(eq(studentProfiles.id, purchase.studentId));
        if (!student || !(await teacherOwnsClassroom(teacherId, student.classroomId))) throw new PurchaseRejected('Entrega no encontrada');
        if (await classroomIsArchived(student.classroomId)) throw new PurchaseRejected(ARCHIVED_CLASSROOM_MESSAGE);
        if ((purchase.usedQuantity || 0) > 0) throw new PurchaseRejected('El estudiante ya usó este artículo');

        await tx.delete(purchases).where(eq(purchases.id, purchaseId));
        await tx
          .update(shopItems)
          .set({ stock: sql`${shopItems.stock} + ${purchase.quantity}`, updatedAt: new Date() })
          .where(and(eq(shopItems.id, purchase.itemId), sql`${shopItems.stock} IS NOT NULL`));
      });
    } catch (error) {
      if (error instanceof PurchaseRejected) return { success: false, message: error.message };
      throw error;
    }
    return { success: true, message: 'Entrega deshecha' };
  }

  /**
   * Canje con el oro del alumno (clases sin cuentas de alumno, pequeños): el profesor lo hace en clase.
   * Cobra al alumno, descuenta stock y, si es de un solo uso y se usa ahora, deja el uso aprobado.
   * El registro de oro lleva el id de la compra para poder marcarlo revertido al deshacer.
   */
  async redeemForStudents(itemId: string, studentIds: string[], useNow: boolean, teacherId: string): Promise<{
    redeemed: { studentId: string; purchaseId: string }[];
    failed: { studentId: string; message: string }[];
  }> {
    const redeemed: { studentId: string; purchaseId: string }[] = [];
    const failed: { studentId: string; message: string }[] = [];
    const item = await this.getItemById(itemId);
    if (!item || !item.isActive) {
      return { redeemed, failed: studentIds.map((studentId) => ({ studentId, message: 'Artículo no encontrado' })) };
    }
    const [classroom] = await db.select({ id: classrooms.id, gradeLevel: classrooms.gradeLevel })
      .from(classrooms).where(eq(classrooms.id, item.classroomId));
    const consumeNow = useNow && item.category === 'CONSUMABLE';
    const toNotify: NotificationEntry[] = [];

    for (const studentId of studentIds) {
      try {
        const [student] = await db.select().from(studentProfiles).where(eq(studentProfiles.id, studentId));
        if (!student || student.classroomId !== item.classroomId) {
          failed.push({ studentId, message: 'No es de esta clase' });
          continue;
        }
        // La tienda está en pausa mientras descansa (en Inicial no).
        if (student.hp <= 0 && !isInitialLevel(classroom?.gradeLevel)) {
          failed.push({ studentId, message: 'está descansando' });
          continue;
        }
        const purchaseId = uuidv4();
        const now = new Date();
        await db.transaction(async (tx) => {
          if (!(await spendGp(tx, studentId, item.price))) throw new PurchaseRejected('no le alcanza el oro');
          if (item.stock !== null) {
            const stockResult = await tx
              .update(shopItems)
              .set({ stock: sql`${shopItems.stock} - 1`, updatedAt: now })
              .where(and(eq(shopItems.id, item.id), gte(shopItems.stock, 1)));
            if (affectedRows(stockResult) !== 1) throw new PurchaseRejected('se agotó');
          }
          await tx.insert(purchases).values({
            id: purchaseId,
            studentId,
            itemId: item.id,
            quantity: 1,
            usedQuantity: consumeNow ? 1 : 0,
            totalPrice: item.price,
            purchaseType: 'REDEEM',
            status: 'APPROVED',
            buyerId: studentId,
            purchasedAt: now,
          });
          if (item.price > 0) {
            await tx.insert(pointLogs).values({
              id: purchaseId,
              studentId,
              pointType: 'GP',
              action: 'REMOVE',
              amount: item.price,
              reason: `Canje con tu profe: ${item.name}`,
              givenBy: teacherId,
              createdAt: now,
            });
          }
          if (consumeNow) {
            await tx.insert(itemUsages).values({
              id: uuidv4(),
              purchaseId,
              studentId,
              itemId: item.id,
              classroomId: item.classroomId,
              status: 'APPROVED',
              usedAt: now,
              reviewedAt: now,
              reviewedBy: teacherId,
            });
          }
        });
        redeemed.push({ studentId, purchaseId });
        if (student.userId) {
          toNotify.push({
            userId: student.userId,
            classroomId: item.classroomId,
            type: 'PURCHASE_APPROVED',
            title: '🛍️ Canjeaste un premio',
            message: `Canjeaste "${item.name}" con tu profe por ${item.price} de oro.`,
            data: { purchaseId, kind: 'REDEEM' },
          });
        }
      } catch (error) {
        failed.push({ studentId, message: error instanceof PurchaseRejected ? error.message : 'no se pudo canjear' });
      }
    }

    if (toNotify.length > 0) {
      try {
        await createNotifications(toNotify);
      } catch (error) {
        console.error('Error notifying redemptions:', error);
      }
    }
    return { redeemed, failed };
  }

  /** Deshace un canje del profesor (error al elegir): devuelve el oro y el stock, si el alumno no pidió usarlo después. */
  async undoRedeem(purchaseId: string, teacherId: string): Promise<{ success: boolean; message: string }> {
    try {
      await db.transaction(async (tx) => {
        const [purchase] = await tx.select().from(purchases).where(eq(purchases.id, purchaseId)).for('update');
        if (!purchase || purchase.purchaseType !== 'REDEEM') throw new PurchaseRejected('Canje no encontrado');
        const [student] = await tx.select({ classroomId: studentProfiles.classroomId }).from(studentProfiles).where(eq(studentProfiles.id, purchase.studentId));
        if (!student || !(await teacherOwnsClassroom(teacherId, student.classroomId))) throw new PurchaseRejected('Canje no encontrado');
        if (await classroomIsArchived(student.classroomId)) throw new PurchaseRejected(ARCHIVED_CLASSROOM_MESSAGE);
        // Solo el uso creado al canjear (mismo instante) se deshace; si el alumno pidió usarlo después, ya no.
        const laterUses = await tx.select({ id: itemUsages.id }).from(itemUsages)
          .where(and(eq(itemUsages.purchaseId, purchaseId), ne(itemUsages.usedAt, purchase.purchasedAt)));
        if (laterUses.length > 0) throw new PurchaseRejected('El estudiante ya pidió usarlo');

        await tx.delete(itemUsages).where(eq(itemUsages.purchaseId, purchaseId));
        await tx.delete(purchases).where(eq(purchases.id, purchaseId));
        if (purchase.totalPrice > 0) {
          await applyPointDeltas(tx, purchase.studentId, { gp: purchase.totalPrice });
          await tx.update(pointLogs).set({ isReverted: true }).where(eq(pointLogs.id, purchaseId));
        }
        await tx
          .update(shopItems)
          .set({ stock: sql`${shopItems.stock} + ${purchase.quantity}`, updatedAt: new Date() })
          .where(and(eq(shopItems.id, purchase.itemId), sql`${shopItems.stock} IS NOT NULL`));
      });
    } catch (error) {
      if (error instanceof PurchaseRejected) return { success: false, message: error.message };
      throw error;
    }
    return { success: true, message: 'Canje deshecho' };
  }

  /** Cuántos alumnos tienen cada premio como meta (para que el profesor sepa qué ofrecer). Las metas de prenda no cuentan. */
  async getGoalCounts(classroomId: string) {
    const rows = await db
      .select({ itemId: studentProfiles.shopGoalItemId, count: sql<string>`COUNT(*)` })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true),
        sql`${studentProfiles.shopGoalItemId} IS NOT NULL`,
        sql`(${studentProfiles.shopGoalKind} IS NULL OR ${studentProfiles.shopGoalKind} = 'ITEM')`,
      ))
      .groupBy(studentProfiles.shopGoalItemId);
    return rows.map((row) => ({ itemId: row.itemId as string, count: Number(row.count) }));
  }

  // Quién tiene qué (compras aprobadas) y el historial reciente de usos de la clase.
  async getClassroomInventory(classroomId: string) {
    const owned = await db
      .select({
        purchaseId: purchases.id,
        quantity: purchases.quantity,
        usedQuantity: purchases.usedQuantity,
        purchaseType: purchases.purchaseType,
        purchasedAt: purchases.purchasedAt,
        student: {
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
        },
        item: {
          id: shopItems.id,
          name: shopItems.name,
          icon: shopItems.icon,
          imageUrl: shopItems.imageUrl,
          rarity: shopItems.rarity,
          category: shopItems.category,
        },
      })
      .from(purchases)
      .innerJoin(studentProfiles, eq(purchases.studentId, studentProfiles.id))
      .innerJoin(shopItems, eq(purchases.itemId, shopItems.id))
      .where(and(eq(studentProfiles.classroomId, classroomId), eq(purchases.status, 'APPROVED')))
      .orderBy(desc(purchases.purchasedAt));

    const usages = await db
      .select({
        id: itemUsages.id,
        status: itemUsages.status,
        usedAt: itemUsages.usedAt,
        reviewedAt: itemUsages.reviewedAt,
        student: {
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
        },
        item: {
          id: shopItems.id,
          name: shopItems.name,
          icon: shopItems.icon,
          imageUrl: shopItems.imageUrl,
          rarity: shopItems.rarity,
        },
      })
      .from(itemUsages)
      .innerJoin(studentProfiles, eq(itemUsages.studentId, studentProfiles.id))
      .innerJoin(shopItems, eq(itemUsages.itemId, shopItems.id))
      .where(eq(itemUsages.classroomId, classroomId))
      .orderBy(desc(itemUsages.usedAt))
      .limit(100);

    return { owned, usages };
  }

  // ==================== NOTIFICACIONES ====================

  async getNotifications(userId: string, options?: { unreadOnly?: boolean; limit?: number; offset?: number; classroomId?: string }) {
    const conditions = [eq(notifications.userId, userId)];
    if (options?.unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }
    // Filtrar por classroomId si se proporciona
    if (options?.classroomId) {
      conditions.push(eq(notifications.classroomId, options.classroomId));
    }

    const limit = Math.min(options?.limit || 50, 100); // Max 100
    const offset = options?.offset || 0;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(notifications)
        .where(and(...conditions)),
    ]);

    return {
      data,
      total: Number(countResult[0]?.count || 0),
      limit,
      offset,
    };
  }

  async markNotificationRead(notificationId: string, userId: string) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));
    await emitUnreadCount(userId);
  }

  async markAllNotificationsRead(userId: string) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
    await emitUnreadCount(userId);
  }

  async getUnreadCount(userId: string, classroomId?: string): Promise<number> {
    const conditions = [
      eq(notifications.userId, userId),
      eq(notifications.isRead, false),
      countsInBell,
    ];

    if (classroomId) {
      conditions.push(eq(notifications.classroomId, classroomId));
    }
    
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notifications)
      .where(and(...conditions));
    return result?.count ?? 0;
  }
}

export const shopService = new ShopService();
