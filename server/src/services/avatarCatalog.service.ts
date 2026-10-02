import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  avatarCollections,
  avatarItems,
  classroomAvatarCollections,
  classroomAvatarItems,
  classrooms,
  pointLogs,
  purchases,
  shopItems,
  studentAvatarPurchases,
  studentEquippedItems,
  studentProfiles,
  type AvatarGender,
  type AvatarSlot,
  type ItemRarity,
} from '../db/schema.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { getShopEconomy } from '../utils/shopEconomy.js';
import { affectedRows, spendGp } from '../utils/points.js';
import { isInitialLevel, isYoungLevel } from '../utils/energy.js';
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
export const niceRound = (value: number) => {
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

/** Días de actividad que necesita una clase para fijar sus precios (antes siguen su economía). */
const MATURE_DAYS = 21;
const weeklyCache = new Map<string, { at: number; value: { base: number; mature: boolean } }>();

/**
 * Oro semanal para los precios: el W de la tienda, corregido en clases con menos de 4 semanas de
 * historia (W reparte 28 días; con una semana de actividad saldría cuatro veces menor).
 */
const avatarWeekly = async (classroomId: string) => {
  const [economy, [first]] = await Promise.all([
    getShopEconomy(classroomId),
    db.select({ at: sql<string | null>`MIN(${pointLogs.createdAt})` })
      .from(pointLogs)
      .innerJoin(studentProfiles, eq(studentProfiles.id, pointLogs.studentId))
      .where(eq(studentProfiles.classroomId, classroomId)),
  ]);
  const days = first?.at ? (Date.now() - new Date(first.at).getTime()) / 86_400_000 : 0;
  const window = Math.min(28, Math.max(7, days));
  const weekly = economy.weeklyGold > 0 ? economy.weeklyGold * (28 / window) : economy.effectiveWeekly;
  return { base: Math.max(1, Math.round(weekly)), mature: economy.activeStudents > 0 && days >= MATURE_DAYS };
};

/**
 * La base de precios: fija desde que la clase tiene datos de verdad (3 semanas de actividad) hasta que
 * el docente la actualiza; antes sigue la economía de la clase (calculada como mucho cada 10 minutos).
 */
const ensurePriceBase = async (classroom: NonNullable<ClassroomRow>): Promise<number> => {
  if (classroom.avatarPriceBase) return classroom.avatarPriceBase;
  const cached = weeklyCache.get(classroom.id);
  const current = cached && Date.now() - cached.at < 600_000 ? cached.value : await avatarWeekly(classroom.id);
  if (!current.mature) {
    weeklyCache.set(classroom.id, { at: Date.now(), value: current });
    return current.base;
  }
  weeklyCache.delete(classroom.id);
  await db.update(classrooms)
    .set({ avatarPriceBase: current.base, avatarPricesAt: new Date() })
    .where(and(eq(classrooms.id, classroom.id), isNull(classrooms.avatarPriceBase)));
  const [fresh] = await db.select({ base: classrooms.avatarPriceBase }).from(classrooms).where(eq(classrooms.id, classroom.id));
  return fresh?.base ?? current.base;
};

/** Oro que ya espera a su profe (pedidos de la tienda por aprobar): no se puede gastar en ropa. */
export const pendingGoldOf = async (profileId: string) => {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${purchases.totalPrice}), 0)` })
    .from(purchases)
    .where(and(eq(purchases.buyerId, profileId), eq(purchases.status, 'PENDING')));
  return Number(row?.total ?? 0);
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
      goalItemId: studentProfiles.shopGoalItemId,
      goalKind: studentProfiles.shopGoalKind,
      giftAt: studentProfiles.avatarGiftAt,
    })
    .from(studentProfiles)
    .where(eq(studentProfiles.id, profileId));
  return profile ?? null;
};
type Profile = NonNullable<Awaited<ReturnType<typeof loadProfile>>>;

const shopState = (classroom: NonNullable<ClassroomRow>, hp: number) => {
  if (!classroom.shopEnabled) return { open: false, reason: 'SHOP_CLOSED' as const };
  if (!classroom.avatarShopEnabled) return { open: false, reason: 'AVATAR_OFF' as const };
  if (hp <= 0 && !isInitialLevel(classroom.gradeLevel)) return { open: false, reason: 'RESTING' as const };
  return { open: true, reason: null };
};

const assertShopOpen = (classroom: NonNullable<ClassroomRow>, hp: number) => {
  const shop = shopState(classroom, hp);
  if (shop.open) return;
  throw new ValidationError(
    shop.reason === 'SHOP_CLOSED' ? 'Tu profe cerró la tienda por ahora'
      : shop.reason === 'AVATAR_OFF' ? 'Tu profe desactivó la tienda de avatar'
        : RESTING_SHOP_MESSAGE,
  );
};

/** Una prenda con su entrada en la tienda de la clase (null si no se vende ahí) y si ya es del alumno. */
const lookupItem = async (profile: Profile, classroom: NonNullable<ClassroomRow>, itemId: string) => {
  const [item] = await db.select().from(avatarItems).where(eq(avatarItems.id, itemId));
  if (!item) return null;
  const [catalog, exceptions, base, owned] = await Promise.all([
    loadCatalog(),
    loadExceptions(classroom.id),
    ensurePriceBase(classroom),
    ownedFor(profile.id, profile.gender as AvatarGender),
  ]);
  const entry = buildEntries(catalog, exceptions, base, classroom.avatarPriceLevel).find((candidate) => candidate.item.id === item.id);
  return { item, entry: entry && isVisible(entry) ? entry : null, owned: owned.has(item.id) };
};

/** La prenda que el alumno puede comprar (o elegir de regalo o como meta): de su cuerpo, a la venta en su clase y aún no suya. */
const sellableEntry = async (profile: Profile, classroom: NonNullable<ClassroomRow>, itemId: string) => {
  const found = await lookupItem(profile, classroom, itemId);
  if (!found || !found.item.isActive || found.item.isDefault) throw new ValidationError('Esta prenda no está en la tienda');
  if (found.item.gender !== profile.gender) throw new ValidationError('Esta prenda es para el otro cuerpo');
  if (!found.entry) throw new ValidationError('Esta prenda no está en la tienda');
  if (found.owned) throw new ConflictError('Ya tienes esta prenda');
  return found.entry;
};

const replaceSlot = async (exec: Pick<typeof db, 'delete' | 'insert'>, profileId: string, itemId: string, slot: AvatarSlot) => {
  await exec.delete(studentEquippedItems).where(and(eq(studentEquippedItems.studentProfileId, profileId), eq(studentEquippedItems.slot, slot)));
  await exec.insert(studentEquippedItems).values({ id: uuidv4(), studentProfileId: profileId, avatarItemId: itemId, slot, equippedAt: new Date() });
};

/** Si la prenda era su meta de ahorro, ya la cumplió: la meta se libera. Devuelve si lo era. */
const clearReachedGoal = async (exec: Pick<typeof db, 'update'>, profileId: string, itemId: string) => affectedRows(
  await exec.update(studentProfiles)
    .set({ shopGoalItemId: null, shopGoalKind: null })
    .where(and(eq(studentProfiles.id, profileId), eq(studentProfiles.shopGoalKind, 'AVATAR'), eq(studentProfiles.shopGoalItemId, itemId))),
) === 1;

class AvatarCatalogService {
  // ==================== ALUMNO ====================

  /** «Mi avatar» en una carga: lo puesto, lo que tiene (con las iniciales), la tienda de su clase y si puede comprar. */
  async getStudentView(profileId: string, userId: string) {
    const profile = await loadProfile(profileId);
    if (!profile || profile.userId !== userId) throw new NotFoundError('Perfil no encontrado');
    const classroom = await loadClassroom(profile.classroomId);
    if (!classroom) throw new NotFoundError('Clase no encontrada');
    const gender = profile.gender as AvatarGender;
    const young = isYoungLevel(classroom.gradeLevel);
    const prizeGoalId = profile.goalItemId && profile.goalKind !== 'AVATAR' ? profile.goalItemId : null;

    const [catalog, exceptions, base, owned, equippedRows, pendingGold, [prizeGoal]] = await Promise.all([
      loadCatalog(),
      loadExceptions(classroom.id),
      ensurePriceBase(classroom),
      ownedFor(profile.id, gender),
      avatarService.getEquippedItems(profile.id),
      pendingGoldOf(profile.id),
      prizeGoalId
        ? db.select({ name: shopItems.name, price: shopItems.price, isActive: shopItems.isActive, classroomId: shopItems.classroomId }).from(shopItems).where(eq(shopItems.id, prizeGoalId))
        : Promise.resolve([]),
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

    const forSale = entries.filter((entry) => isVisible(entry) || owned.has(entry.item.id)).map((entry) => itemView(entry.item, entry));
    const defaults = catalog.items.filter((item) => item.isDefault && item.gender === gender).map((item) => itemView(item, null));

    // Una sola meta de ahorro: una prenda (está en items) o un premio de la tienda (al elegir una prenda se reemplaza).
    const goal = profile.goalItemId && profile.goalKind === 'AVATAR'
      ? { kind: 'AVATAR' as const, itemId: profile.goalItemId }
      : prizeGoal && prizeGoal.isActive && prizeGoal.classroomId === classroom.id
        ? { kind: 'ITEM' as const, itemId: prizeGoalId!, name: prizeGoal.name, price: prizeGoal.price }
        : null;

    return {
      // pendingGold: lo que espera a su profe en la tienda de premios (no se puede gastar en ropa).
      profile: { id: profile.id, gender, gold: profile.gp, pendingGold },
      classroomName: classroom.name,
      gradeLevel: classroom.gradeLevel,
      // Inicial a 2.º: vista sencilla, y el cuerpo lo cambia su profe.
      young,
      canChangeBody: !young,
      shop,
      // Una prenda común gratis, una vez (se elige con la tienda abierta).
      giftAvailable: !profile.giftAt,
      goal,
      items: [...defaults, ...forSale, ...retired.map((item) => itemView(item, null))],
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
    assertShopOpen(classroom, profile.hp);
    const { item, price } = await sellableEntry(profile, classroom, itemId);

    // Como en la tienda de premios: el oro que espera a su profe no se puede gastar.
    const pendingGold = await pendingGoldOf(profile.id);
    if (profile.gp - pendingGold < price) {
      throw new ValidationError(pendingGold > 0
        ? `No te alcanza: tienes ${profile.gp} de oro y ${pendingGold} ya esperan a tu profe.`
        : `No te alcanza: «${item.name}» cuesta ${price} de oro.`);
    }
    const now = new Date();
    let goalReached = false;
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
        goalReached = await clearReachedGoal(tx, profile.id, item.id);
      });
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY' || error?.cause?.code === 'ER_DUP_ENTRY') throw new ConflictError('Ya tienes esta prenda');
      throw error;
    }

    const [after] = await db.select({ gp: studentProfiles.gp }).from(studentProfiles).where(eq(studentProfiles.id, profile.id));
    return {
      item: { id: item.id, name: item.name, slot: item.slot },
      pricePaid: price,
      newBalance: after?.gp ?? profile.gp - price,
      equipped: !!options.equip,
      goalReached,
      gift: false,
    };
  }

  /**
   * La prenda de regalo: una común de la tienda de su clase, gratis y una sola vez por perfil. La marca es
   * una escritura condicional: dos pestañas a la vez no se llevan dos regalos.
   */
  async claimGift(profileId: string, itemId: string, options: { equip?: boolean } = {}) {
    const profile = await loadProfile(profileId);
    if (!profile) throw new NotFoundError('Perfil no encontrado');
    if (profile.giftAt) throw new ConflictError('Ya elegiste tu prenda de regalo');
    const classroom = await loadClassroom(profile.classroomId);
    if (!classroom) throw new NotFoundError('Clase no encontrada');
    assertShopOpen(classroom, profile.hp);
    const { item } = await sellableEntry(profile, classroom, itemId);
    if (item.rarity !== 'COMMON') throw new ValidationError('Tu regalo es una prenda común');

    const now = new Date();
    let goalReached = false;
    try {
      await db.transaction(async (tx) => {
        const claimed = await tx.update(studentProfiles)
          .set({ avatarGiftAt: now, updatedAt: now })
          .where(and(eq(studentProfiles.id, profile.id), isNull(studentProfiles.avatarGiftAt)));
        if (affectedRows(claimed) !== 1) throw new ConflictError('Ya elegiste tu prenda de regalo');
        await tx.insert(studentAvatarPurchases).values({
          id: uuidv4(),
          studentProfileId: profile.id,
          avatarItemId: item.id,
          classroomId: profile.classroomId,
          pricePaid: 0,
          purchasedAt: now,
        });
        if (options.equip) await replaceSlot(tx, profile.id, item.id, item.slot);
        goalReached = await clearReachedGoal(tx, profile.id, item.id);
      });
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY' || error?.cause?.code === 'ER_DUP_ENTRY') throw new ConflictError('Ya tienes esta prenda');
      throw error;
    }
    return {
      item: { id: item.id, name: item.name, slot: item.slot },
      pricePaid: 0,
      newBalance: profile.gp,
      equipped: !!options.equip,
      goalReached,
      gift: true,
    };
  }

  /**
   * Meta de ahorro: una prenda a la venta en su clase. Hay una sola meta para premios y prendas, así que
   * reemplaza a la que tuviera. Con null, la quita (sea del tipo que sea).
   */
  async setGoal(profileId: string, itemId: string | null) {
    const profile = await loadProfile(profileId);
    if (!profile) throw new NotFoundError('Perfil no encontrado');
    if (itemId) {
      const classroom = await loadClassroom(profile.classroomId);
      if (!classroom) throw new NotFoundError('Clase no encontrada');
      if (!classroom.avatarShopEnabled) throw new ValidationError('Tu profe desactivó la tienda de avatar');
      await sellableEntry(profile, classroom, itemId);
    }
    await db.update(studentProfiles)
      .set({ shopGoalItemId: itemId, shopGoalKind: itemId ? 'AVATAR' : null, updatedAt: new Date() })
      .where(eq(studentProfiles.id, profile.id));
    return { goalItemId: itemId, goalKind: itemId ? ('AVATAR' as const) : null };
  }

  /** La prenda que el alumno tiene como meta, con su precio en la clase (para la Tienda); null si ya no se puede comprar. */
  async goalSummary(profileId: string) {
    const profile = await loadProfile(profileId);
    if (!profile || profile.goalKind !== 'AVATAR' || !profile.goalItemId) return null;
    const classroom = await loadClassroom(profile.classroomId);
    if (!classroom || !classroom.avatarShopEnabled) return null;
    const found = await lookupItem(profile, classroom, profile.goalItemId);
    if (!found?.entry || found.owned || found.item.gender !== profile.gender) return null;
    return { id: found.item.id, name: found.item.name, price: found.entry.price, imagePath: found.item.imagePath, rarity: found.item.rarity };
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
   * Cambiar de cuerpo (el alumno o su docente; en inicial a 2.º, solo el docente). Cada prenda puesta pasa a
   * su par en el otro cuerpo si lo tiene; si no, vuelve la inicial de esa ranura. Lo comprado sin par se
   * conserva para cuando regrese. Una meta de prenda pasa a su par o se quita.
   */
  async setBody(profileId: string, gender: AvatarGender, options: { byStudent?: boolean } = {}) {
    const profile = await loadProfile(profileId);
    if (!profile) throw new NotFoundError('Perfil no encontrado');
    if (options.byStudent) {
      const classroom = await loadClassroom(profile.classroomId);
      if (classroom && isYoungLevel(classroom.gradeLevel)) {
        throw new ForbiddenError('Pídele a tu profe que cambie el cuerpo de tu personaje');
      }
    }
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

    // La meta de prenda sigue a su par en el nuevo cuerpo (si existe y aún no es suya); si no, se quita.
    let goal: { shopGoalItemId: string | null; shopGoalKind: 'AVATAR' | null } | null = null;
    if (profile.goalKind === 'AVATAR' && profile.goalItemId) {
      const [goalItem] = await db.select({ pairKey: avatarItems.pairKey }).from(avatarItems).where(eq(avatarItems.id, profile.goalItemId));
      const [pair] = goalItem?.pairKey
        ? await db.select({ id: avatarItems.id }).from(avatarItems)
          .where(and(eq(avatarItems.pairKey, goalItem.pairKey), eq(avatarItems.gender, gender), eq(avatarItems.isActive, true), eq(avatarItems.isDefault, false)))
        : [];
      goal = pair && !owned.has(pair.id) ? { shopGoalItemId: pair.id, shopGoalKind: 'AVATAR' } : { shopGoalItemId: null, shopGoalKind: null };
    }

    await db.transaction(async (tx) => {
      await tx.update(studentProfiles).set({ avatarGender: gender, ...goal, updatedAt: new Date() }).where(eq(studentProfiles.id, profile.id));
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

  /** El oro semanal con el que la clase pone precios (los coleccionables lo usan también). */
  async classWeeklyBase(classroomId: string) {
    const classroom = await loadClassroom(classroomId);
    if (!classroom) throw new NotFoundError('Clase no encontrada');
    return ensurePriceBase(classroom);
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
    const [catalog, exceptions, base, economy, weeklyNow, others] = await Promise.all([
      loadCatalog(),
      loadExceptions(classroomId),
      ensurePriceBase(classroom),
      getShopEconomy(classroomId),
      avatarWeekly(classroomId),
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
        // Sin fecha: la clase aún no tiene 3 semanas de actividad y los precios siguen su economía.
        pricesAt: classroom.avatarPriceBase ? classroom.avatarPricesAt : null,
        shopEnabled: classroom.shopEnabled,
      },
      economy: {
        weeklyGold: economy.weeklyGold,
        /** Oro semanal de ahora (corregido en clases nuevas): con él se actualizarían los precios. */
        weeklyNow: weeklyNow.base,
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
        // El docente decide fijarlos con el oro de ahora (aunque la clase sea nueva).
        set.avatarPriceBase = (await avatarWeekly(classroomId)).base;
        set.avatarPricesAt = new Date();
        weeklyCache.delete(classroomId);
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

  /**
   * Copia la configuración de una clase a otra: activada y nivel (salvo `priceLevel: false`); con
   * `exceptions`, también lo oculto (sin precios propios).
   */
  async copySettings(sourceClassroomId: string, targetClassroomId: string, options: { exceptions: boolean; priceLevel?: boolean }) {
    const source = await loadClassroom(sourceClassroomId);
    if (!source) return;
    await db.update(classrooms)
      .set({ avatarShopEnabled: source.avatarShopEnabled, ...(options.priceLevel === false ? {} : { avatarPriceLevel: source.avatarPriceLevel }) })
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

  /**
   * Inicial a 2.º: ropa «Más barata» por defecto (seis semanas de oro son una eternidad a esa edad). Al crear
   * la clase se aplica siempre; al pasar una clase a esos grados, solo si seguía en «Normal». El docente puede cambiarla.
   */
  async applyYoungPrices(classroomId: string, options: { onlyIfNormal?: boolean } = {}) {
    await db.update(classrooms)
      .set({ avatarPriceLevel: 'LOW' })
      .where(options.onlyIfNormal
        ? and(eq(classrooms.id, classroomId), eq(classrooms.avatarPriceLevel, 'NORMAL'))
        : eq(classrooms.id, classroomId));
  }

  /**
   * Una clase nueva hereda la configuración de la clase más reciente del mismo docente. El nivel de precios
   * solo pasa entre clases de la misma edad: una de 5.º no hereda la ropa «Más barata» de una de 1.º, y una
   * de inicial a 2.º empieza siempre en «Más barata».
   */
  async inheritFromTeacher(classroomId: string, teacherId: string) {
    const [target] = await db.select({ gradeLevel: classrooms.gradeLevel }).from(classrooms).where(eq(classrooms.id, classroomId));
    const young = isYoungLevel(target?.gradeLevel);
    const [source] = await db.select({ id: classrooms.id, gradeLevel: classrooms.gradeLevel }).from(classrooms)
      .where(and(eq(classrooms.teacherId, teacherId), eq(classrooms.isActive, true), ne(classrooms.id, classroomId)))
      .orderBy(desc(classrooms.createdAt))
      .limit(1);
    if (source) await this.copySettings(source.id, classroomId, { exceptions: true, priceLevel: isYoungLevel(source.gradeLevel) === young });
    if (young) await this.applyYoungPrices(classroomId);
  }
}

export const avatarCatalogService = new AvatarCatalogService();
