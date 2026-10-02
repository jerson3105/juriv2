import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  avatarCollections,
  avatarItems,
  classroomAvatarCollections,
  classroomAvatarItems,
  classrooms,
  pointLogs,
  studentAvatarPurchases,
  studentEquippedItems,
  studentProfiles,
  type AvatarGender,
  type AvatarSlot,
  type ItemRarity,
} from '../db/schema.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { getShopEconomy } from '../utils/shopEconomy.js';
import { spendGp } from '../utils/points.js';
import { isInitialLevel } from '../utils/energy.js';
import { AVATAR_PURCHASE_PREFIX } from '../utils/pointReasons.js';
import { avatarService } from './avatar.service.js';

// Catálogo de avatar v2. El admin publica prendas (en colecciones, con su par para el otro cuerpo);
// cada clase las recibe solas con precios según su oro semanal; el docente solo marca excepciones
// (ocultar una colección o una prenda, o ponerle precio propio) y puede aplicarlas a varias clases.

export type AvatarPriceLevel = 'LOW' | 'NORMAL' | 'HIGH';

/** Semanas de oro por rareza: común 1, rara 3, legendaria 6. */
export const AVATAR_WEEKS: Record<ItemRarity, number> = { COMMON: 1, RARE: 3, LEGENDARY: 6 };
/** Nivel de precios de la clase: más barata (la mitad), normal o más cara (el doble). */
export const AVATAR_LEVEL_FACTOR: Record<AvatarPriceLevel, number> = { LOW: 0.5, NORMAL: 1, HIGH: 2 };
/** Una prenda es «Nueva» sus primeros 14 días. */
const NEW_DAYS = 14;
const RESTING_SHOP_MESSAGE = 'Estás descansando: completa tu misión de recuperación para volver a usar la tienda.';

// Precios redondos: hasta 20 de uno en uno, hasta 100 de cinco en cinco, después de diez en diez.
const niceRound = (value: number) => {
  if (value < 20) return Math.max(1, Math.round(value));
  if (value < 100) return Math.round(value / 5) * 5;
  return Math.round(value / 10) * 10;
};

export const avatarPrice = (base: number, level: AvatarPriceLevel, rarity: ItemRarity) =>
  niceRound(base * AVATAR_WEEKS[rarity] * AVATAR_LEVEL_FACTOR[level]);

type CatalogItem = typeof avatarItems.$inferSelect;
type Collection = typeof avatarCollections.$inferSelect;
type ClassroomRow = Awaited<ReturnType<typeof loadClassroom>>;

const loadClassroom = async (classroomId: string) => {
  const [classroom] = await db
    .select({
      id: classrooms.id,
      name: classrooms.name,
      teacherId: classrooms.teacherId,
      gradeLevel: classrooms.gradeLevel,
      shopEnabled: classrooms.shopEnabled,
      avatarShopEnabled: classrooms.avatarShopEnabled,
      avatarPriceLevel: classrooms.avatarPriceLevel,
      avatarPriceBase: classrooms.avatarPriceBase,
      avatarPricesAt: classrooms.avatarPricesAt,
    })
    .from(classrooms)
    .where(eq(classrooms.id, classroomId));
  return classroom ?? null;
};

const loadCatalog = async () => {
  const [items, collections] = await Promise.all([
    db.select().from(avatarItems).where(eq(avatarItems.isActive, true)),
    db.select().from(avatarCollections),
  ]);
  return { items, collections, collectionById: new Map(collections.map((collection) => [collection.id, collection])) };
};
type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

const loadExceptions = async (classroomId: string) => {
  const [itemRows, collectionRows] = await Promise.all([
    db.select().from(classroomAvatarItems).where(eq(classroomAvatarItems.classroomId, classroomId)),
    db.select().from(classroomAvatarCollections).where(eq(classroomAvatarCollections.classroomId, classroomId)),
  ]);
  return {
    itemById: new Map(itemRows.map((row) => [row.avatarItemId, row])),
    hiddenCollections: new Set(collectionRows.filter((row) => row.isHidden).map((row) => row.collectionId)),
  };
};
type Exceptions = Awaited<ReturnType<typeof loadExceptions>>;

/** La base de precios es el oro semanal de la clase la primera vez; después queda fija hasta que el docente la actualiza. */
const ensurePriceBase = async (classroom: NonNullable<ClassroomRow>): Promise<number> => {
  if (classroom.avatarPriceBase) return classroom.avatarPriceBase;
  const economy = await getShopEconomy(classroom.id);
  const base = Math.max(1, Math.round(economy.effectiveWeekly));
  await db.update(classrooms)
    .set({ avatarPriceBase: base, avatarPricesAt: new Date() })
    .where(and(eq(classrooms.id, classroom.id), isNull(classrooms.avatarPriceBase)));
  const [fresh] = await db.select({ base: classrooms.avatarPriceBase }).from(classrooms).where(eq(classrooms.id, classroom.id));
  return fresh?.base ?? base;
};

interface Entry {
  item: CatalogItem;
  collection: Collection | null;
  price: number;
  customPrice: number | null;
  hidden: boolean;
  collectionHidden: boolean;
}

// Cada prenda comprable del catálogo con su precio en la clase y si la clase la oculta.
const buildEntries = (catalog: Catalog, exceptions: Exceptions, base: number, level: AvatarPriceLevel): Entry[] => catalog.items
  .filter((item) => !item.isDefault)
  .map((item) => {
    const collection = item.collectionId ? catalog.collectionById.get(item.collectionId) ?? null : null;
    const row = exceptions.itemById.get(item.id);
    const customPrice = row?.price ?? null;
    return {
      item,
      collection,
      price: customPrice ?? avatarPrice(base, level, item.rarity),
      customPrice,
      hidden: row ? !row.isAvailable : false,
      collectionHidden: !!collection && (!collection.isActive || exceptions.hiddenCollections.has(collection.id)),
    };
  });

const isVisible = (entry: Entry) => !entry.hidden && !entry.collectionHidden;
const isNew = (item: CatalogItem) => Date.now() - new Date(item.createdAt).getTime() < NEW_DAYS * 86_400_000;

/** Lo que el alumno puede ponerse en su cuerpo actual: lo comprado y su par en este cuerpo (las iniciales aparte). */
const ownedFor = async (profileId: string, gender: AvatarGender) => {
  const bought = await db
    .select({ itemId: studentAvatarPurchases.avatarItemId, pairKey: avatarItems.pairKey })
    .from(studentAvatarPurchases)
    .innerJoin(avatarItems, eq(avatarItems.id, studentAvatarPurchases.avatarItemId))
    .where(eq(studentAvatarPurchases.studentProfileId, profileId));
  const pairKeys = [...new Set(bought.map((row) => row.pairKey).filter((key): key is string => !!key))];
  const counterparts = pairKeys.length
    ? await db.select({ id: avatarItems.id }).from(avatarItems).where(and(inArray(avatarItems.pairKey, pairKeys), eq(avatarItems.gender, gender)))
    : [];
  return new Set([...bought.map((row) => row.itemId), ...counterparts.map((row) => row.id)]);
};

const loadProfile = async (profileId: string) => {
  const [profile] = await db
    .select({
      id: studentProfiles.id,
      userId: studentProfiles.userId,
      classroomId: studentProfiles.classroomId,
      gender: studentProfiles.avatarGender,
      gp: studentProfiles.gp,
      hp: studentProfiles.hp,
    })
    .from(studentProfiles)
    .where(eq(studentProfiles.id, profileId));
  return profile ?? null;
};

const shopState = (classroom: NonNullable<ClassroomRow>, hp: number) => {
  if (!classroom.shopEnabled) return { open: false, reason: 'SHOP_CLOSED' as const };
  if (!classroom.avatarShopEnabled) return { open: false, reason: 'AVATAR_OFF' as const };
  if (hp <= 0 && !isInitialLevel(classroom.gradeLevel)) return { open: false, reason: 'RESTING' as const };
  return { open: true, reason: null };
};

const replaceSlot = async (exec: Pick<typeof db, 'delete' | 'insert'>, profileId: string, itemId: string, slot: AvatarSlot) => {
  await exec.delete(studentEquippedItems).where(and(eq(studentEquippedItems.studentProfileId, profileId), eq(studentEquippedItems.slot, slot)));
  await exec.insert(studentEquippedItems).values({ id: uuidv4(), studentProfileId: profileId, avatarItemId: itemId, slot, equippedAt: new Date() });
};

class AvatarCatalogService {
  // ==================== ALUMNO ====================

  /** «Mi avatar» en una carga: lo puesto, lo que tiene (con las iniciales), la tienda de su clase y si puede comprar. */
  async getStudentView(profileId: string, userId: string) {
    const profile = await loadProfile(profileId);
    if (!profile || profile.userId !== userId) throw new NotFoundError('Perfil no encontrado');
    const classroom = await loadClassroom(profile.classroomId);
    if (!classroom) throw new NotFoundError('Clase no encontrada');
    const gender = profile.gender as AvatarGender;

    const [catalog, exceptions, base, owned, equippedRows] = await Promise.all([
      loadCatalog(),
      loadExceptions(classroom.id),
      ensurePriceBase(classroom),
      ownedFor(profile.id, gender),
      avatarService.getEquippedItems(profile.id),
    ]);
    const entries = buildEntries(catalog, exceptions, base, classroom.avatarPriceLevel).filter((entry) => entry.item.gender === gender);
    const shop = shopState(classroom, profile.hp);
    const inCatalog = new Set(entries.map((entry) => entry.item.id));
    // Lo comprado que el admin retiró del catálogo se conserva en el armario.
    const retiredIds = [...owned].filter((id) => !inCatalog.has(id));
    const retired = retiredIds.length
      ? await db.select().from(avatarItems).where(and(inArray(avatarItems.id, retiredIds), eq(avatarItems.gender, gender)))
      : [];

    const itemView = (item: CatalogItem, entry: Entry | null) => ({
      id: item.id,
      name: item.name,
      slot: item.slot,
      rarity: item.rarity,
      imagePath: item.imagePath,
      layerOrder: item.layerOrder,
      collection: entry?.collection ? { id: entry.collection.id, name: entry.collection.name } : null,
      inShop: !!entry && isVisible(entry) && !item.isDefault,
      price: entry && isVisible(entry) ? entry.price : null,
      owned: item.isDefault || owned.has(item.id),
      isDefault: item.isDefault,
      isNew: isNew(item),
    });

    const shopItems = entries.filter((entry) => isVisible(entry) || owned.has(entry.item.id)).map((entry) => itemView(entry.item, entry));
    const defaults = catalog.items.filter((item) => item.isDefault && item.gender === gender).map((item) => itemView(item, null));

    return {
      profile: { id: profile.id, gender, gold: profile.gp },
      classroomName: classroom.name,
      gradeLevel: classroom.gradeLevel,
      shop,
      items: [...defaults, ...shopItems, ...retired.map((item) => itemView(item, null))],
      equipped: equippedRows.map((row) => ({
        slot: row.slot,
        itemId: row.avatarItem.id,
        name: row.avatarItem.name,
        imagePath: row.avatarItem.imagePath,
        layerOrder: row.avatarItem.layerOrder,
        isDefault: row.avatarItem.isDefault,
      })),
    };
  }

  /** Comprar (y, si se pide, ponérsela): reglas de la tienda de su clase, precio de la clase y registro del gasto. */
  async purchase(profileId: string, itemId: string, options: { classroomId?: string; equip?: boolean } = {}) {
    const profile = await loadProfile(profileId);
    if (!profile) throw new NotFoundError('Perfil no encontrado');
    if (options.classroomId && options.classroomId !== profile.classroomId) {
      throw new ValidationError('Solo puedes comprar en la tienda de tu clase');
    }
    const classroom = await loadClassroom(profile.classroomId);
    if (!classroom) throw new NotFoundError('Clase no encontrada');
    const shop = shopState(classroom, profile.hp);
    if (!shop.open) {
      throw new ValidationError(
        shop.reason === 'SHOP_CLOSED' ? 'Tu profe cerró la tienda por ahora'
          : shop.reason === 'AVATAR_OFF' ? 'Tu profe desactivó la tienda de avatar'
            : RESTING_SHOP_MESSAGE,
      );
    }

    const [item] = await db.select().from(avatarItems).where(eq(avatarItems.id, itemId));
    if (!item || !item.isActive || item.isDefault) throw new ValidationError('Esta prenda no está en la tienda');
    if (item.gender !== profile.gender) throw new ValidationError('Esta prenda es para el otro cuerpo');

    const [catalog, exceptions, base, owned] = await Promise.all([
      loadCatalog(),
      loadExceptions(classroom.id),
      ensurePriceBase(classroom),
      ownedFor(profile.id, profile.gender as AvatarGender),
    ]);
    const entry = buildEntries(catalog, exceptions, base, classroom.avatarPriceLevel).find((candidate) => candidate.item.id === item.id);
    if (!entry || !isVisible(entry)) throw new ValidationError('Esta prenda no está en la tienda');
    if (owned.has(item.id)) throw new ConflictError('Ya tienes esta prenda');

    const price = entry.price;
    const now = new Date();
    try {
      await db.transaction(async (tx) => {
        // Cobro atómico: con compras simultáneas el oro no se gasta dos veces.
        if (!(await spendGp(tx, profile.id, price))) {
          throw new ValidationError(`No te alcanza: «${item.name}» cuesta ${price} de oro.`);
        }
        await tx.insert(studentAvatarPurchases).values({
          id: uuidv4(),
          studentProfileId: profile.id,
          avatarItemId: item.id,
          classroomId: profile.classroomId,
          pricePaid: price,
          purchasedAt: now,
        });
        // El gasto queda en el registro: «Mi progreso» lo muestra como gasto propio.
        if (price > 0) {
          await tx.insert(pointLogs).values({
            id: uuidv4(),
            studentId: profile.id,
            pointType: 'GP',
            action: 'REMOVE',
            amount: price,
            reason: `${AVATAR_PURCHASE_PREFIX}${item.name}`,
            createdAt: now,
          });
        }
        if (options.equip) await replaceSlot(tx, profile.id, item.id, item.slot);
      });
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY' || error?.cause?.code === 'ER_DUP_ENTRY') throw new ConflictError('Ya tienes esta prenda');
      throw error;
    }

    const [after] = await db.select({ gp: studentProfiles.gp }).from(studentProfiles).where(eq(studentProfiles.id, profile.id));
    return { item: { id: item.id, name: item.name, slot: item.slot }, pricePaid: price, newBalance: after?.gp ?? profile.gp - price, equipped: !!options.equip };
  }

  /** Ponerse una prenda propia (comprada, su par o una inicial) del cuerpo actual. Siempre se puede, aunque la tienda esté cerrada. */
  async equip(profileId: string, itemId: string) {
    const profile = await loadProfile(profileId);
    if (!profile) throw new NotFoundError('Perfil no encontrado');
    const [item] = await db.select().from(avatarItems).where(eq(avatarItems.id, itemId));
    if (!item) throw new NotFoundError('Prenda no encontrada');
    if (item.gender !== profile.gender) throw new ValidationError('Esta prenda es para el otro cuerpo');
    if (!item.isDefault) {
      const owned = await ownedFor(profile.id, profile.gender as AvatarGender);
      if (!owned.has(item.id)) throw new ValidationError('Aún no tienes esta prenda');
    }
    await db.transaction(async (tx) => replaceSlot(tx, profile.id, item.id, item.slot));
    return avatarService.getEquippedItems(profile.id);
  }

  /**
   * Cambiar de cuerpo (el alumno o su docente). Cada prenda puesta pasa a su par en el otro cuerpo si lo
   * tiene; si no, vuelve la inicial de esa ranura. Lo comprado sin par se conserva para cuando regrese.
   */
  async setBody(profileId: string, gender: AvatarGender) {
    const profile = await loadProfile(profileId);
    if (!profile) throw new NotFoundError('Perfil no encontrado');
    if (profile.gender === gender) return avatarService.getEquippedItems(profile.id);

    const [equipped, owned, defaults] = await Promise.all([
      db.select({ slot: studentEquippedItems.slot, pairKey: avatarItems.pairKey })
        .from(studentEquippedItems)
        .innerJoin(avatarItems, eq(avatarItems.id, studentEquippedItems.avatarItemId))
        .where(eq(studentEquippedItems.studentProfileId, profile.id)),
      ownedFor(profile.id, gender),
      db.select().from(avatarItems).where(and(eq(avatarItems.gender, gender), eq(avatarItems.isDefault, true), eq(avatarItems.isActive, true))),
    ]);
    const pairKeys = [...new Set(equipped.map((row) => row.pairKey).filter((key): key is string => !!key))];
    const counterparts = pairKeys.length
      ? await db.select().from(avatarItems).where(and(inArray(avatarItems.pairKey, pairKeys), eq(avatarItems.gender, gender), eq(avatarItems.isActive, true)))
      : [];

    const next = new Map<AvatarSlot, string>();
    for (const item of defaults) if (!next.has(item.slot)) next.set(item.slot, item.id);
    for (const row of equipped) {
      const counterpart = counterparts.find((item) => item.pairKey === row.pairKey && item.slot === row.slot);
      if (counterpart && (counterpart.isDefault || owned.has(counterpart.id))) next.set(row.slot, counterpart.id);
    }

    await db.transaction(async (tx) => {
      await tx.update(studentProfiles).set({ avatarGender: gender, updatedAt: new Date() }).where(eq(studentProfiles.id, profile.id));
      await tx.delete(studentEquippedItems).where(eq(studentEquippedItems.studentProfileId, profile.id));
      const now = new Date();
      const rows = [...next].map(([slot, avatarItemId]) => ({ id: uuidv4(), studentProfileId: profile.id, avatarItemId, slot, equippedAt: now }));
      if (rows.length) await tx.insert(studentEquippedItems).values(rows);
    });
    return avatarService.getEquippedItems(profile.id);
  }

  /** Lo que ve un alumno en la tienda de su clase, con la forma de antes (lo usa el inicio). */
  async getClassroomShopItems(classroomId: string, gender?: AvatarGender) {
    const classroom = await loadClassroom(classroomId);
    if (!classroom || !classroom.avatarShopEnabled) return [];
    const [catalog, exceptions, base] = await Promise.all([loadCatalog(), loadExceptions(classroomId), ensurePriceBase(classroom)]);
    return buildEntries(catalog, exceptions, base, classroom.avatarPriceLevel)
      .filter((entry) => isVisible(entry) && (!gender || entry.item.gender === gender))
      .map((entry) => ({
        id: entry.item.id,
        classroomId,
        avatarItemId: entry.item.id,
        price: entry.price,
        isAvailable: true,
        createdAt: entry.item.createdAt,
        avatarItem: entry.item,
      }));
  }

  // ==================== DOCENTE ====================

  /** Clases del docente para «Aplicar a mis otras clases»; todas deben ser suyas. */
  async assertTeacherClassrooms(teacherId: string, classroomIds: string[]) {
    const ids = [...new Set(classroomIds)];
    const rows = await db.select({ id: classrooms.id }).from(classrooms).where(and(inArray(classrooms.id, ids), eq(classrooms.teacherId, teacherId)));
    if (rows.length !== ids.length) throw new ForbiddenError('No tienes acceso a una de esas clases');
    return ids;
  }

  /** El catálogo de la clase para el docente: colecciones con sus prendas (ambos cuerpos), precios y excepciones. */
  async getTeacherCatalog(classroomId: string, teacherId: string) {
    const classroom = await loadClassroom(classroomId);
    if (!classroom) throw new NotFoundError('Clase no encontrada');
    const [catalog, exceptions, base, economy, others] = await Promise.all([
      loadCatalog(),
      loadExceptions(classroomId),
      ensurePriceBase(classroom),
      getShopEconomy(classroomId),
      db.select({ id: classrooms.id, name: classrooms.name })
        .from(classrooms)
        .where(and(eq(classrooms.teacherId, teacherId), eq(classrooms.isActive, true), ne(classrooms.id, classroomId)))
        .orderBy(classrooms.name),
    ]);
    const level = classroom.avatarPriceLevel;
    const entries = buildEntries(catalog, exceptions, base, level);
    const itemView = (entry: Entry) => ({
      id: entry.item.id,
      name: entry.item.name,
      slot: entry.item.slot,
      gender: entry.item.gender,
      rarity: entry.item.rarity,
      imagePath: entry.item.imagePath,
      pairKey: entry.item.pairKey,
      price: entry.price,
      customPrice: entry.customPrice,
      hidden: entry.hidden,
      isNew: isNew(entry.item),
    });
    const collections = catalog.collections
      .filter((collection) => collection.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))
      .map((collection) => ({
        id: collection.id,
        name: collection.name,
        description: collection.description,
        hidden: exceptions.hiddenCollections.has(collection.id),
        items: entries.filter((entry) => entry.item.collectionId === collection.id).map(itemView),
      }))
      .filter((collection) => collection.items.length > 0);
    // Prendas sin colección (no debería haber: el admin las sube a «Básicos»).
    const loose = entries.filter((entry) => !entry.collection).map(itemView);
    if (loose.length) collections.push({ id: '', name: 'Otras prendas', description: null, hidden: false, items: loose });

    return {
      classroomId,
      settings: {
        enabled: classroom.avatarShopEnabled,
        priceLevel: level,
        priceBase: base,
        pricesAt: classroom.avatarPricesAt,
        shopEnabled: classroom.shopEnabled,
      },
      economy: {
        weeklyGold: economy.weeklyGold,
        effectiveWeekly: economy.effectiveWeekly,
        activeStudents: economy.activeStudents,
        behaviorsGiveGold: economy.behaviorsGiveGold,
      },
      prices: {
        COMMON: avatarPrice(base, level, 'COMMON'),
        RARE: avatarPrice(base, level, 'RARE'),
        LEGENDARY: avatarPrice(base, level, 'LEGENDARY'),
      },
      collections,
      otherClassrooms: others,
    };
  }

  /** Activar/desactivar, nivel de precios y «actualizar con el oro actual» en una o varias clases del docente. */
  async updateSettings(classroomIds: string[], patch: { enabled?: boolean; priceLevel?: AvatarPriceLevel; refreshPrices?: boolean }) {
    for (const classroomId of classroomIds) {
      const set: Partial<typeof classrooms.$inferInsert> = {};
      if (patch.enabled !== undefined) set.avatarShopEnabled = patch.enabled;
      if (patch.priceLevel) set.avatarPriceLevel = patch.priceLevel;
      if (patch.refreshPrices) {
        const economy = await getShopEconomy(classroomId);
        set.avatarPriceBase = Math.max(1, Math.round(economy.effectiveWeekly));
        set.avatarPricesAt = new Date();
      }
      if (Object.keys(set).length) await db.update(classrooms).set(set).where(eq(classrooms.id, classroomId));
    }
  }

  async setCollectionHidden(classroomIds: string[], collectionId: string, hidden: boolean) {
    const [collection] = await db.select({ id: avatarCollections.id }).from(avatarCollections).where(eq(avatarCollections.id, collectionId));
    if (!collection) throw new NotFoundError('Colección no encontrada');
    for (const classroomId of classroomIds) {
      if (hidden) {
        await db.insert(classroomAvatarCollections)
          .values({ id: uuidv4(), classroomId, collectionId, isHidden: true, createdAt: new Date() })
          .onDuplicateKeyUpdate({ set: { isHidden: true } });
      } else {
        await db.delete(classroomAvatarCollections).where(and(eq(classroomAvatarCollections.classroomId, classroomId), eq(classroomAvatarCollections.collectionId, collectionId)));
      }
    }
  }

  /** Ocultar una prenda o ponerle precio propio (null = volver al calculado). Sin excepción, la fila se borra. */
  async setItemException(classroomIds: string[], itemId: string, patch: { hidden?: boolean; price?: number | null }) {
    const [item] = await db.select({ id: avatarItems.id, isDefault: avatarItems.isDefault }).from(avatarItems).where(eq(avatarItems.id, itemId));
    if (!item || item.isDefault) throw new NotFoundError('Prenda no encontrada');
    for (const classroomId of classroomIds) {
      const [row] = await db.select().from(classroomAvatarItems)
        .where(and(eq(classroomAvatarItems.classroomId, classroomId), eq(classroomAvatarItems.avatarItemId, itemId)));
      const isAvailable = patch.hidden !== undefined ? !patch.hidden : row?.isAvailable ?? true;
      const price = patch.price !== undefined ? patch.price : row?.price ?? null;
      if (isAvailable && price === null) {
        if (row) await db.delete(classroomAvatarItems).where(eq(classroomAvatarItems.id, row.id));
      } else if (row) {
        await db.update(classroomAvatarItems).set({ isAvailable, price }).where(eq(classroomAvatarItems.id, row.id));
      } else {
        await db.insert(classroomAvatarItems).values({ id: uuidv4(), classroomId, avatarItemId: itemId, price, isAvailable, createdAt: new Date() });
      }
    }
  }

  // ==================== CLASES NUEVAS, COPIAS Y BORRADO ====================

  /** Copia la configuración de una clase a otra: activada y nivel; con `exceptions`, también lo oculto (sin precios propios). */
  async copySettings(sourceClassroomId: string, targetClassroomId: string, options: { exceptions: boolean }) {
    const source = await loadClassroom(sourceClassroomId);
    if (!source) return;
    await db.update(classrooms)
      .set({ avatarShopEnabled: source.avatarShopEnabled, avatarPriceLevel: source.avatarPriceLevel })
      .where(eq(classrooms.id, targetClassroomId));
    if (!options.exceptions) return;
    const [hiddenCollections, hiddenItems] = await Promise.all([
      db.select({ collectionId: classroomAvatarCollections.collectionId }).from(classroomAvatarCollections)
        .where(and(eq(classroomAvatarCollections.classroomId, sourceClassroomId), eq(classroomAvatarCollections.isHidden, true))),
      db.select({ avatarItemId: classroomAvatarItems.avatarItemId }).from(classroomAvatarItems)
        .where(and(eq(classroomAvatarItems.classroomId, sourceClassroomId), eq(classroomAvatarItems.isAvailable, false))),
    ]);
    const now = new Date();
    if (hiddenCollections.length) {
      await db.insert(classroomAvatarCollections)
        .values(hiddenCollections.map((row) => ({ id: uuidv4(), classroomId: targetClassroomId, collectionId: row.collectionId, isHidden: true, createdAt: now })))
        .onDuplicateKeyUpdate({ set: { isHidden: true } });
    }
    if (hiddenItems.length) {
      await db.insert(classroomAvatarItems)
        .values(hiddenItems.map((row) => ({ id: uuidv4(), classroomId: targetClassroomId, avatarItemId: row.avatarItemId, price: null, isAvailable: false, createdAt: now })))
        .onDuplicateKeyUpdate({ set: { isAvailable: false } });
    }
  }

  /** Una clase nueva hereda la configuración de la clase más reciente del mismo docente. */
  async inheritFromTeacher(classroomId: string, teacherId: string) {
    const [source] = await db.select({ id: classrooms.id }).from(classrooms)
      .where(and(eq(classrooms.teacherId, teacherId), eq(classrooms.isActive, true), ne(classrooms.id, classroomId)))
      .orderBy(desc(classrooms.createdAt))
      .limit(1);
    if (source) await this.copySettings(source.id, classroomId, { exceptions: true });
  }
}

export const avatarCatalogService = new AvatarCatalogService();
