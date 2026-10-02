import { db } from '../db/index.js';
import {
  avatarItems,
  studentAvatarPurchases,
  studentEquippedItems,
  studentProfiles,
  AvatarGender,
  AvatarSlot
} from '../db/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Prendas puestas, prendas iniciales y lecturas del avatar. La tienda (catálogo por clase, precios,
// compra, equipar y cambio de cuerpo) vive en avatarCatalog.service.
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

  // ==================== ITEMS GLOBALES (los crea el admin en /admin/avatar-items) ====================

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

  // ==================== COMPRAS ====================

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

  // ==================== EQUIPAR ITEMS ====================

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

    // Quitar y, si hay prenda inicial para la ranura, volver a ella (en una transacción).
    await db.transaction(async (tx) => {
      await tx
        .delete(studentEquippedItems)
        .where(and(
          eq(studentEquippedItems.studentProfileId, studentProfileId),
          eq(studentEquippedItems.slot, slot)
        ));
      if (defaultItem.length > 0) {
        await tx.insert(studentEquippedItems).values({
          id: uuidv4(),
          studentProfileId,
          avatarItemId: defaultItem[0].id,
          slot,
          equippedAt: new Date(),
        });
      }
    });

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

  /**
   * Items equipados de varios alumnos en una consulta (mismo formato que getEquippedItems).
   * Todos los ids pedidos aparecen en el resultado; sin items → lista vacía.
   */
  async getEquippedItemsForStudents(studentProfileIds: string[]) {
    const result: Record<string, Awaited<ReturnType<typeof this.getEquippedItems>>> = {};
    for (const id of studentProfileIds) result[id] = [];
    if (studentProfileIds.length === 0) return result;

    const rows = await db
      .select({
        studentProfileId: studentEquippedItems.studentProfileId,
        id: studentEquippedItems.id,
        slot: studentEquippedItems.slot,
        equippedAt: studentEquippedItems.equippedAt,
        avatarItem: avatarItems,
      })
      .from(studentEquippedItems)
      .innerJoin(avatarItems, eq(studentEquippedItems.avatarItemId, avatarItems.id))
      .where(inArray(studentEquippedItems.studentProfileId, studentProfileIds));

    for (const { studentProfileId, ...item } of rows) {
      result[studentProfileId]?.push(item);
    }
    return result;
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

  // Asignar items por defecto a un estudiante
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
