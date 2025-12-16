import { db } from '../db/index.js';
import { 
  avatarItems, 
  classroomAvatarItems, 
  studentAvatarPurchases, 
  studentEquippedItems,
  studentProfiles,
  AvatarGender,
  AvatarSlot 
} from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface CreateAvatarItemData {
  name: string;
  description?: string;
  gender: AvatarGender;
  slot: AvatarSlot;
  imagePath: string;
  layerOrder: number;
  basePrice: number;
  rarity?: 'COMMON' | 'RARE' | 'LEGENDARY';
}

interface AddToClassroomShopData {
  classroomId: string;
  avatarItemId: string;
  price: number;
}

class AvatarService {
  // ==================== ITEMS POR DEFECTO ====================

  // Equipar items por defecto cuando se crea un perfil de estudiante
  async equipDefaultItems(studentProfileId: string, gender: AvatarGender) {
    // Obtener todos los items por defecto para el género
    const defaultItems = await db
      .select()
      .from(avatarItems)
      .where(and(
        eq(avatarItems.gender, gender),
        eq(avatarItems.isDefault, true),
        eq(avatarItems.isActive, true)
      ));

    if (defaultItems.length === 0) return;

    const now = new Date();

    // Equipar cada item por defecto, uno por slot (evitar duplicados)
    const equippedSlots = new Set<string>();
    for (const item of defaultItems) {
      // Solo equipar un item por slot
      if (equippedSlots.has(item.slot)) continue;
      
      try {
        await db.insert(studentEquippedItems).values({
          id: uuidv4(),
          studentProfileId,
          avatarItemId: item.id,
          slot: item.slot,
          equippedAt: now,
        });
        equippedSlots.add(item.slot);
      } catch (error) {
        // Si falla por duplicado, continuar con el siguiente item
        console.error(`Error equipando item ${item.id} en slot ${item.slot}:`, error);
      }
    }
  }

  // ==================== ITEMS GLOBALES (ADMIN) ====================

  async createAvatarItem(data: CreateAvatarItemData) {
    const id = uuidv4();
    const now = new Date();

    await db.insert(avatarItems).values({
      id,
      name: data.name,
      description: data.description || null,
      gender: data.gender,
      slot: data.slot,
      imagePath: data.imagePath,
      layerOrder: data.layerOrder,
      basePrice: data.basePrice,
      rarity: data.rarity || 'COMMON',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return this.getAvatarItemById(id);
  }

  async getAvatarItemById(id: string) {
    const [item] = await db
      .select()
      .from(avatarItems)
      .where(eq(avatarItems.id, id));
    return item;
  }

  async getAllAvatarItems(gender?: AvatarGender) {
    // Excluir items por defecto (no deben aparecer en la tienda)
    if (gender) {
      return db
        .select()
        .from(avatarItems)
        .where(and(
          eq(avatarItems.isActive, true), 
          eq(avatarItems.gender, gender),
          eq(avatarItems.isDefault, false)
        ))
        .orderBy(avatarItems.slot, avatarItems.name);
    }
    return db
      .select()
      .from(avatarItems)
      .where(and(
        eq(avatarItems.isActive, true),
        eq(avatarItems.isDefault, false)
      ))
      .orderBy(avatarItems.slot, avatarItems.name);
  }

  async getAvatarItemsBySlot(slot: AvatarSlot, gender?: AvatarGender) {
    if (gender) {
      return db
        .select()
        .from(avatarItems)
        .where(and(
          eq(avatarItems.isActive, true),
          eq(avatarItems.slot, slot),
          eq(avatarItems.gender, gender)
        ))
        .orderBy(avatarItems.name);
    }
    return db
      .select()
      .from(avatarItems)
      .where(and(eq(avatarItems.isActive, true), eq(avatarItems.slot, slot)))
      .orderBy(avatarItems.name);
  }

  // ==================== TIENDA DE CLASE (DOCENTE) ====================

  async addItemToClassroomShop(data: AddToClassroomShopData) {
    const id = uuidv4();
    const now = new Date();

    await db.insert(classroomAvatarItems).values({
      id,
      classroomId: data.classroomId,
      avatarItemId: data.avatarItemId,
      price: data.price,
      isAvailable: true,
      createdAt: now,
    });

    return this.getClassroomShopItem(data.classroomId, data.avatarItemId);
  }

  async getClassroomShopItem(classroomId: string, avatarItemId: string) {
    const [item] = await db
      .select({
        id: classroomAvatarItems.id,
        classroomId: classroomAvatarItems.classroomId,
        avatarItemId: classroomAvatarItems.avatarItemId,
        price: classroomAvatarItems.price,
        isAvailable: classroomAvatarItems.isAvailable,
        createdAt: classroomAvatarItems.createdAt,
        avatarItem: avatarItems,
      })
      .from(classroomAvatarItems)
      .innerJoin(avatarItems, eq(classroomAvatarItems.avatarItemId, avatarItems.id))
      .where(and(
        eq(classroomAvatarItems.classroomId, classroomId),
        eq(classroomAvatarItems.avatarItemId, avatarItemId)
      ));
    return item;
  }

  async getClassroomShopItems(classroomId: string, gender?: AvatarGender) {
    // Excluir items por defecto de la tienda
    const query = db
      .select({
        id: classroomAvatarItems.id,
        classroomId: classroomAvatarItems.classroomId,
        avatarItemId: classroomAvatarItems.avatarItemId,
        price: classroomAvatarItems.price,
        isAvailable: classroomAvatarItems.isAvailable,
        createdAt: classroomAvatarItems.createdAt,
        avatarItem: avatarItems,
      })
      .from(classroomAvatarItems)
      .innerJoin(avatarItems, eq(classroomAvatarItems.avatarItemId, avatarItems.id))
      .where(and(
        eq(classroomAvatarItems.classroomId, classroomId),
        eq(classroomAvatarItems.isAvailable, true),
        eq(avatarItems.isDefault, false),
        gender ? eq(avatarItems.gender, gender) : undefined
      ));

    return query;
  }

  async removeItemFromClassroomShop(classroomId: string, avatarItemId: string) {
    await db
      .update(classroomAvatarItems)
      .set({ isAvailable: false })
      .where(and(
        eq(classroomAvatarItems.classroomId, classroomId),
        eq(classroomAvatarItems.avatarItemId, avatarItemId)
      ));
  }

  async updateClassroomItemPrice(classroomId: string, avatarItemId: string, price: number) {
    await db
      .update(classroomAvatarItems)
      .set({ price })
      .where(and(
        eq(classroomAvatarItems.classroomId, classroomId),
        eq(classroomAvatarItems.avatarItemId, avatarItemId)
      ));
  }

  async removeShopItemById(shopItemId: string) {
    await db
      .delete(classroomAvatarItems)
      .where(eq(classroomAvatarItems.id, shopItemId));
  }

  async updateShopItemPrice(shopItemId: string, price: number) {
    await db
      .update(classroomAvatarItems)
      .set({ price })
      .where(eq(classroomAvatarItems.id, shopItemId));

    // Retornar el item actualizado
    const [item] = await db
      .select({
        id: classroomAvatarItems.id,
        classroomId: classroomAvatarItems.classroomId,
        avatarItemId: classroomAvatarItems.avatarItemId,
        price: classroomAvatarItems.price,
        isAvailable: classroomAvatarItems.isAvailable,
        createdAt: classroomAvatarItems.createdAt,
        avatarItem: avatarItems,
      })
      .from(classroomAvatarItems)
      .innerJoin(avatarItems, eq(classroomAvatarItems.avatarItemId, avatarItems.id))
      .where(eq(classroomAvatarItems.id, shopItemId));

    return item;
  }

  // ==================== COMPRAS DE ESTUDIANTES ====================

  async purchaseAvatarItem(studentProfileId: string, classroomId: string, avatarItemId: string) {
    // Verificar que el item está en la tienda de la clase
    const shopItem = await this.getClassroomShopItem(classroomId, avatarItemId);
    if (!shopItem || !shopItem.isAvailable) {
      throw new Error('Item no disponible en esta tienda');
    }

    // Verificar que el estudiante tiene suficiente GP
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));

    if (!profile) {
      throw new Error('Perfil de estudiante no encontrado');
    }

    if (profile.gp < shopItem.price) {
      throw new Error('No tienes suficiente oro');
    }

    // Verificar que no lo haya comprado ya
    const [existing] = await db
      .select()
      .from(studentAvatarPurchases)
      .where(and(
        eq(studentAvatarPurchases.studentProfileId, studentProfileId),
        eq(studentAvatarPurchases.avatarItemId, avatarItemId)
      ));

    if (existing) {
      throw new Error('Ya tienes este item');
    }

    // Descontar GP
    await db
      .update(studentProfiles)
      .set({ 
        gp: profile.gp - shopItem.price,
        updatedAt: new Date()
      })
      .where(eq(studentProfiles.id, studentProfileId));

    // Registrar compra
    const purchaseId = uuidv4();
    await db.insert(studentAvatarPurchases).values({
      id: purchaseId,
      studentProfileId,
      avatarItemId,
      classroomId,
      pricePaid: shopItem.price,
      purchasedAt: new Date(),
    });

    return {
      purchaseId,
      item: shopItem.avatarItem,
      pricePaid: shopItem.price,
      newBalance: profile.gp - shopItem.price,
    };
  }

  async getStudentPurchases(studentProfileId: string) {
    // Excluir items por defecto del inventario
    return db
      .select({
        id: studentAvatarPurchases.id,
        avatarItemId: studentAvatarPurchases.avatarItemId,
        pricePaid: studentAvatarPurchases.pricePaid,
        purchasedAt: studentAvatarPurchases.purchasedAt,
        avatarItem: avatarItems,
      })
      .from(studentAvatarPurchases)
      .innerJoin(avatarItems, eq(studentAvatarPurchases.avatarItemId, avatarItems.id))
      .where(and(
        eq(studentAvatarPurchases.studentProfileId, studentProfileId),
        eq(avatarItems.isDefault, false)
      ))
      .orderBy(desc(studentAvatarPurchases.purchasedAt));
  }

  async hasStudentPurchasedItem(studentProfileId: string, avatarItemId: string) {
    const [purchase] = await db
      .select()
      .from(studentAvatarPurchases)
      .where(and(
        eq(studentAvatarPurchases.studentProfileId, studentProfileId),
        eq(studentAvatarPurchases.avatarItemId, avatarItemId)
      ));
    return !!purchase;
  }

  // ==================== EQUIPAR ITEMS ====================

  async equipItem(studentProfileId: string, avatarItemId: string) {
    // Verificar que el estudiante tiene el item
    const hasPurchased = await this.hasStudentPurchasedItem(studentProfileId, avatarItemId);
    if (!hasPurchased) {
      throw new Error('No tienes este item');
    }

    // Obtener info del item
    const item = await this.getAvatarItemById(avatarItemId);
    if (!item) {
      throw new Error('Item no encontrado');
    }

    // Desequipar item anterior del mismo slot (si existe)
    await db
      .delete(studentEquippedItems)
      .where(and(
        eq(studentEquippedItems.studentProfileId, studentProfileId),
        eq(studentEquippedItems.slot, item.slot)
      ));

    // Equipar nuevo item
    const id = uuidv4();
    await db.insert(studentEquippedItems).values({
      id,
      studentProfileId,
      avatarItemId,
      slot: item.slot,
      equippedAt: new Date(),
    });

    return this.getEquippedItems(studentProfileId);
  }

  async unequipItem(studentProfileId: string, slot: AvatarSlot) {
    // Verificar si el item equipado es un item por defecto
    const equippedItem = await db
      .select({
        avatarItem: avatarItems,
      })
      .from(studentEquippedItems)
      .innerJoin(avatarItems, eq(studentEquippedItems.avatarItemId, avatarItems.id))
      .where(and(
        eq(studentEquippedItems.studentProfileId, studentProfileId),
        eq(studentEquippedItems.slot, slot)
      ))
      .limit(1);

    if (equippedItem.length > 0 && equippedItem[0].avatarItem.isDefault) {
      throw new Error('No puedes desequipar items por defecto. Solo puedes reemplazarlos por otros items.');
    }

    // Obtener el género del estudiante para buscar el item default correcto
    const profile = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentProfileId),
    });

    if (!profile) {
      throw new Error('Perfil no encontrado');
    }

    // Eliminar item actual
    await db
      .delete(studentEquippedItems)
      .where(and(
        eq(studentEquippedItems.studentProfileId, studentProfileId),
        eq(studentEquippedItems.slot, slot)
      ));

    // Buscar item default para este slot y género
    const defaultItem = await db
      .select()
      .from(avatarItems)
      .where(and(
        eq(avatarItems.slot, slot),
        eq(avatarItems.gender, profile.avatarGender as AvatarGender),
        eq(avatarItems.isDefault, true),
        eq(avatarItems.isActive, true)
      ))
      .limit(1);

    // Si existe un item default, equiparlo automáticamente
    if (defaultItem.length > 0) {
      await db.insert(studentEquippedItems).values({
        id: uuidv4(),
        studentProfileId,
        avatarItemId: defaultItem[0].id,
        slot,
        equippedAt: new Date(),
      });
    }

    return this.getEquippedItems(studentProfileId);
  }

  async getEquippedItems(studentProfileId: string) {
    return db
      .select({
        id: studentEquippedItems.id,
        slot: studentEquippedItems.slot,
        equippedAt: studentEquippedItems.equippedAt,
        avatarItem: avatarItems,
      })
      .from(studentEquippedItems)
      .innerJoin(avatarItems, eq(studentEquippedItems.avatarItemId, avatarItems.id))
      .where(eq(studentEquippedItems.studentProfileId, studentProfileId));
  }

  // ==================== UTILIDADES ====================

  async getStudentAvatarData(studentProfileId: string) {
    // Obtener perfil del estudiante
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));

    if (!profile) {
      throw new Error('Perfil no encontrado');
    }

    // Obtener items equipados
    const equippedItems = await this.getEquippedItems(studentProfileId);

    return {
      gender: profile.avatarGender as AvatarGender,
      equippedItems: equippedItems.map((item: any) => ({
        slot: item.slot,
        imagePath: item.avatarItem.imagePath,
        layerOrder: item.avatarItem.layerOrder,
      })),
    };
  }

  // Asignar items por defecto a un estudiante (para configuración inicial B2B)
  async assignDefaultItems(studentProfileId: string, gender: AvatarGender) {
    try {
      // Primero eliminar items equipados existentes (por si acaso)
      await db.delete(studentEquippedItems)
        .where(eq(studentEquippedItems.studentProfileId, studentProfileId));

      // Equipar items por defecto
      await this.equipDefaultItems(studentProfileId, gender);
    } catch (error) {
      console.error('Error asignando items por defecto:', error);
      // No lanzar el error para no interrumpir el flujo de vinculación
      // El estudiante podrá equipar items manualmente después
    }
  }
}

export const avatarService = new AvatarService();
