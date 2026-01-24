import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { 
  shopItems, 
  purchases, 
  studentProfiles, 
  classrooms,
  itemUsages,
  notifications,
  type ShopItem,
  type ItemRarity,
  type PurchaseType,
  type ItemUsageStatus,
} from '../db/schema.js';

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
    effectType?: string;
    effectValue?: number;
    stock?: number;
  }): Promise<ShopItem> {
    const now = new Date();
    const id = uuidv4();

    // Usar icono predeterminado si no se proporciona
    const icon = data.icon || DEFAULT_IMAGES[data.category]?.[data.rarity] || '📦';

    await db.insert(shopItems).values({
      id,
      classroomId: data.classroomId,
      name: data.name,
      description: data.description || null,
      category: data.category,
      rarity: data.rarity,
      price: data.price,
      imageUrl: data.imageUrl || null,
      icon,
      effectType: data.effectType || null,
      effectValue: data.effectValue || null,
      stock: data.stock || null,
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
      description: string;
      category: 'AVATAR' | 'ACCESSORY' | 'CONSUMABLE' | 'SPECIAL';
      rarity: ItemRarity;
      price: number;
      imageUrl: string;
      icon: string;
      effectType: string;
      effectValue: number;
      stock: number;
      isActive: boolean;
    }>
  ): Promise<ShopItem> {
    await db
      .update(shopItems)
      .set({
        ...data,
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
  }): Promise<{ success: boolean; message: string; purchase?: any; requiresApproval?: boolean }> {
    const quantity = data.quantity || 1;

    // Obtener el estudiante y su clase para verificar configuración
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

    // Verificar si la tienda está habilitada
    if (!classroom.shopEnabled) {
      return { success: false, message: 'La tienda no está habilitada para esta clase' };
    }

    // Verificar límite de compras diarias
    if (classroom.dailyPurchaseLimit !== null && data.purchaseType === 'SELF') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayPurchases = await db
        .select()
        .from(purchases)
        .where(and(
          eq(purchases.studentId, data.studentId),
          eq(purchases.purchaseType, 'SELF'),
          gte(purchases.purchasedAt, today)
        ));

      if (todayPurchases.length >= classroom.dailyPurchaseLimit) {
        return { success: false, message: `Has alcanzado el límite de ${classroom.dailyPurchaseLimit} compras diarias` };
      }
    }

    // Obtener item
    const item = await this.getItemById(data.itemId);
    if (!item) {
      return { success: false, message: 'Item no encontrado' };
    }

    if (!item.isActive) {
      return { success: false, message: 'Item no disponible' };
    }

    // Verificar stock
    if (item.stock !== null && item.stock < quantity) {
      return { success: false, message: 'Stock insuficiente' };
    }

    const totalPrice = item.price * quantity;
    
    // Determinar si requiere aprobación
    const requiresApproval = classroom.requirePurchaseApproval && data.purchaseType === 'SELF';
    const purchaseStatus = requiresApproval ? 'PENDING' : 'APPROVED';

    // Determinar quién paga
    let payerId: string | null = null;
    
    if (data.purchaseType === 'SELF') {
      payerId = data.studentId;
    } else if (data.purchaseType === 'GIFT') {
      payerId = data.buyerId || null;
    }
    // TEACHER: payerId queda null, el profesor paga desde su sistema

    // Si hay un pagador estudiante, verificar GP (solo descontar si no requiere aprobación)
    if (payerId) {
      const [payer] = await db
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, payerId));

      if (!payer) {
        return { success: false, message: 'Comprador no encontrado' };
      }

      if (payer.gp < totalPrice) {
        return { success: false, message: `GP insuficiente. Necesitas ${totalPrice} GP, tienes ${payer.gp} GP` };
      }

      // Solo descontar GP si no requiere aprobación
      if (!requiresApproval) {
        await db
          .update(studentProfiles)
          .set({ 
            gp: payer.gp - totalPrice,
            updatedAt: new Date()
          })
          .where(eq(studentProfiles.id, payerId));
      }
    }

    // Reducir stock si aplica (solo si no requiere aprobación)
    if (item.stock !== null && !requiresApproval) {
      await db
        .update(shopItems)
        .set({ 
          stock: item.stock - quantity,
          updatedAt: new Date()
        })
        .where(eq(shopItems.id, data.itemId));
    }

    let purchaseId: string;

    // Para compras propias (SELF) aprobadas, buscar si ya existe una compra del mismo item
    if (data.purchaseType === 'SELF' && !requiresApproval) {
      const [existingPurchase] = await db
        .select()
        .from(purchases)
        .where(and(
          eq(purchases.studentId, data.studentId),
          eq(purchases.itemId, data.itemId),
          eq(purchases.purchaseType, 'SELF'),
          eq(purchases.status, 'APPROVED')
        ));

      if (existingPurchase) {
        // Actualizar cantidad existente
        await db
          .update(purchases)
          .set({ 
            quantity: existingPurchase.quantity + quantity,
            totalPrice: existingPurchase.totalPrice + totalPrice,
          })
          .where(eq(purchases.id, existingPurchase.id));
        
        purchaseId = existingPurchase.id;
      } else {
        // Crear nuevo registro
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
          purchasedAt: new Date(),
        });
      }
    } else {
      // Para regalos, compras de profesor, o compras pendientes
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
        purchasedAt: new Date(),
      });
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

    let message = '¡Compra realizada exitosamente!';
    if (data.purchaseType === 'GIFT') {
      message = '¡Regalo enviado exitosamente!';
    } else if (requiresApproval) {
      message = 'Compra enviada para aprobación del profesor';
    }

    return { 
      success: true, 
      message,
      purchase,
      requiresApproval,
    };
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
    return db
      .select({
        id: purchases.id,
        quantity: purchases.quantity,
        totalPrice: purchases.totalPrice,
        purchasedAt: purchases.purchasedAt,
        student: {
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
        },
        item: {
          id: shopItems.id,
          name: shopItems.name,
          icon: shopItems.icon,
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

    // Verificar GP del estudiante
    if (student.gp < purchase.totalPrice) {
      return { success: false, message: 'El estudiante ya no tiene suficiente GP' };
    }

    // Obtener item para verificar stock
    const item = await this.getItemById(purchase.itemId);
    if (item && item.stock !== null && item.stock < purchase.quantity) {
      return { success: false, message: 'Stock insuficiente' };
    }

    // Descontar GP
    await db
      .update(studentProfiles)
      .set({ 
        gp: student.gp - purchase.totalPrice,
        updatedAt: new Date()
      })
      .where(eq(studentProfiles.id, student.id));

    // Reducir stock si aplica
    if (item && item.stock !== null) {
      await db
        .update(shopItems)
        .set({ 
          stock: item.stock - purchase.quantity,
          updatedAt: new Date()
        })
        .where(eq(shopItems.id, purchase.itemId));
    }

    // Aprobar compra
    await db
      .update(purchases)
      .set({ status: 'APPROVED' })
      .where(eq(purchases.id, purchaseId));

    // Notificar al estudiante (solo si tiene cuenta vinculada)
    if (student.userId) {
      await db.insert(notifications).values({
        id: uuidv4(),
        userId: student.userId,
        type: 'PURCHASE_APPROVED',
        title: '¡Compra aprobada!',
        message: `Tu compra de ${item?.name || 'item'} ha sido aprobada`,
        isRead: false,
        createdAt: new Date(),
      });
    }

    return { success: true, message: 'Compra aprobada exitosamente' };
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

    // Rechazar compra
    await db
      .update(purchases)
      .set({ status: 'REJECTED' })
      .where(eq(purchases.id, purchaseId));

    // Obtener item para el mensaje
    const item = await this.getItemById(purchase.itemId);

    // Notificar al estudiante (solo si tiene cuenta vinculada)
    if (student.userId) {
      await db.insert(notifications).values({
        id: uuidv4(),
        userId: student.userId,
        type: 'PURCHASE_REJECTED',
        title: 'Compra rechazada',
        message: reason 
          ? `Tu compra de ${item?.name || 'item'} fue rechazada: ${reason}`
          : `Tu compra de ${item?.name || 'item'} fue rechazada`,
        isRead: false,
        createdAt: new Date(),
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
      .where(eq(purchases.buyerId, studentId))
      .orderBy(desc(purchases.purchasedAt));
  }

  // ==================== VALIDACIONES ====================

  async verifyTeacherOwnsClassroom(teacherId: string, classroomId: string): Promise<boolean> {
    const [classroom] = await db
      .select()
      .from(classrooms)
      .where(and(
        eq(classrooms.id, classroomId),
        eq(classrooms.teacherId, teacherId)
      ));
    return !!classroom;
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

      // Verificar que quedan items por usar
      const remaining = purchase.quantity - (purchase.usedQuantity || 0);
      if (remaining <= 0) {
        return { success: false, message: 'Ya usaste todos los items de esta compra' };
      }

      // Obtener el item para verificar que es consumible
      const item = await this.getItemById(purchase.itemId);
      if (!item) {
        return { success: false, message: 'Item no encontrado' };
      }

      if (item.category !== 'CONSUMABLE') {
        return { success: false, message: 'Solo los items consumibles pueden ser usados' };
      }

      // Obtener el estudiante para saber el classroomId
      const [student] = await db
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentId));

      if (!student) {
        return { success: false, message: 'Estudiante no encontrado' };
      }

      // Crear registro de uso primero
      const usageId = uuidv4();
      const now = new Date();
      
      await db.insert(itemUsages).values({
        id: usageId,
        purchaseId,
        studentId,
        itemId: purchase.itemId,
        classroomId: student.classroomId,
        status: 'PENDING',
        usedAt: now,
      });

      // Incrementar usedQuantity
      await db
        .update(purchases)
        .set({ usedQuantity: (purchase.usedQuantity || 0) + 1 })
        .where(eq(purchases.id, purchaseId));

      // Obtener el profesor de la clase
      const [classroom] = await db
        .select()
        .from(classrooms)
        .where(eq(classrooms.id, student.classroomId));

      if (classroom) {
        // Crear notificación para el profesor
        try {
          await db.insert(notifications).values({
            id: uuidv4(),
            userId: classroom.teacherId,
            classroomId: student.classroomId,
            type: 'ITEM_USED',
            title: '🧪 Item usado',
            message: `${student.characterName || 'Un estudiante'} ha usado "${item.name}"${item.description ? `: ${item.description}` : ''}`,
            data: {
              usageId,
              studentId,
              studentName: student.characterName,
              itemId: item.id,
              itemName: item.name,
              itemIcon: item.icon,
              itemDescription: item.description,
            },
            isRead: false,
            createdAt: now,
          });
        } catch (notifError) {
          console.error('Error creating notification:', notifError);
          // No fallar si la notificación falla
        }
      }

      return { 
        success: true, 
        message: `Has usado "${item.name}". El profesor será notificado.`,
        usage: {
          id: usageId,
          itemName: item.name,
          remaining: remaining - 1,
        }
      };
    } catch (error) {
      console.error('Error in useItem:', error);
      return { success: false, message: 'Error al usar el item' };
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

    await db
      .update(itemUsages)
      .set({
        status,
        reviewedAt: new Date(),
        reviewedBy: teacherId,
      })
      .where(eq(itemUsages.id, usageId));

    return { 
      success: true, 
      message: status === 'APPROVED' ? 'Uso aprobado' : 'Uso rechazado' 
    };
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
  }

  async markAllNotificationsRead(userId: string) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async getUnreadCount(userId: string, classroomId?: string): Promise<number> {
    const conditions = [
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ];
    
    if (classroomId) {
      conditions.push(eq(notifications.classroomId, classroomId));
    }
    
    const result = await db
      .select()
      .from(notifications)
      .where(and(...conditions));
    return result.length;
  }
}

export const shopService = new ShopService();
