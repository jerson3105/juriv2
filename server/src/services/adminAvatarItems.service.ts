import { and, count, eq, inArray, ne, notInArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { avatarItems, avatarCollections, studentAvatarPurchases, studentEquippedItems, studentProfiles } from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { hashAvatarFile, removeUploadedLayer, storeAvatarLayer } from '../utils/avatarUpload.js';

export type AvatarSlot = typeof avatarItems.$inferSelect['slot'];
export type AvatarGender = typeof avatarItems.$inferSelect['gender'];
export type AvatarRarity = typeof avatarItems.$inferSelect['rarity'];
type AvatarItemRow = typeof avatarItems.$inferSelect;

/** Borrador = inactiva sin publicar nunca; publicada = activa; retirada = inactiva que ya salió. */
export type AvatarItemStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
export const statusOf = (item: Pick<AvatarItemRow, 'isActive' | 'publishedAt'>): AvatarItemStatus =>
  item.isActive ? 'PUBLISHED' : item.publishedAt ? 'RETIRED' : 'DRAFT';

/** Orden de capa por ranura (el mismo de client/src/components/avatar/avatarLayers.ts). */
export const LAYER_ORDER: Record<AvatarSlot, number> = {
  BACKGROUND: -10, FLAG: -2, BACK: -1, SHOES: 1, BOTTOM: 2, TOP: 3, LEFT_HAND: 4, RIGHT_HAND: 5, EYES: 6, HEAD: 7, HAIR: 8,
};

const BODY_NAME: Record<AvatarGender, string> = { MALE: 'Chico', FEMALE: 'Chica' };
const RARITY_NAME: Record<AvatarRarity, string> = { COMMON: 'Común', RARE: 'Rara', LEGENDARY: 'Legendaria' };

const affectedRows = (result: unknown): number => {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number }).affectedRows ?? 0);
};

const serialize = (item: AvatarItemRow, usage?: { owners: number; equipped: number }) => ({
  id: item.id,
  name: item.name,
  description: item.description,
  gender: item.gender,
  slot: item.slot,
  rarity: item.rarity,
  imagePath: item.imagePath,
  isDefault: item.isDefault,
  status: statusOf(item),
  pairKey: item.pairKey,
  publishedAt: item.publishedAt,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  owners: usage?.owners ?? 0,
  equipped: usage?.equipped ?? 0,
});
export type AdminAvatarItemView = ReturnType<typeof serialize>;

const findItem = async (id: string, tx: any = db): Promise<AvatarItemRow> => {
  const [item] = await tx.select().from(avatarItems).where(eq(avatarItems.id, id)).limit(1);
  if (!item) throw new NotFoundError('Prenda no encontrada');
  return item;
};

/** La otra versión (el otro cuerpo) de una prenda con par. */
const partnerOf = async (item: AvatarItemRow, tx: any = db): Promise<AvatarItemRow | null> => {
  if (!item.pairKey) return null;
  const [partner] = await tx.select().from(avatarItems)
    .where(and(eq(avatarItems.pairKey, item.pairKey), ne(avatarItems.id, item.id))).limit(1);
  return partner ?? null;
};

/** Huella de la imagen; si falta (capas sembradas), se calcula del archivo y se guarda. */
const ensureHash = async (item: AvatarItemRow): Promise<string | null> => {
  if (item.imageHash) return item.imageHash;
  const hash = await hashAvatarFile(item.imagePath);
  if (hash) await db.update(avatarItems).set({ imageHash: hash }).where(eq(avatarItems.id, item.id));
  return hash;
};

/** «Cada cuerpo tiene su propia imagen» (los fondos no dependen del cuerpo: ahí sí se repiten). */
const assertDifferentImages = (slot: AvatarSlot, a: { imagePath: string; hash: string | null }, b: { imagePath: string; hash: string | null }, otherGender: AvatarGender) => {
  if (slot === 'BACKGROUND') return;
  if (a.imagePath === b.imagePath || (a.hash && b.hash && a.hash === b.hash)) {
    throw new ConflictError(`Es la misma imagen que la versión ${BODY_NAME[otherGender]}: cada cuerpo necesita su propia imagen.`);
  }
};

const usageFor = async (ids: string[]) => {
  if (ids.length === 0) return new Map<string, { owners: number; equipped: number }>();
  const [owners, equipped] = await Promise.all([
    db.select({ id: studentAvatarPurchases.avatarItemId, n: count() }).from(studentAvatarPurchases)
      .where(inArray(studentAvatarPurchases.avatarItemId, ids)).groupBy(studentAvatarPurchases.avatarItemId),
    db.select({ id: studentEquippedItems.avatarItemId, n: count() }).from(studentEquippedItems)
      .where(inArray(studentEquippedItems.avatarItemId, ids)).groupBy(studentEquippedItems.avatarItemId),
  ]);
  const usage = new Map(ids.map((id) => [id, { owners: 0, equipped: 0 }]));
  owners.forEach((row) => { usage.get(row.id)!.owners = Number(row.n); });
  equipped.forEach((row) => { usage.get(row.id)!.equipped = Number(row.n); });
  return usage;
};

const audit = (actorId: string, action: string, itemId: string, extra: Record<string, unknown> = {}) =>
  logger.info('admin.avatar_item', { actorId, action, itemId, ...extra });

export interface CreateAvatarItemInput {
  name: string;
  description?: string | null;
  gender: AvatarGender;
  slot: AvatarSlot;
  rarity: AvatarRarity;
  /** Versión del otro cuerpo con la que queda vinculada (la nueva toma su ranura y rareza). */
  pairWith?: string;
}

export interface UpdateAvatarItemInput {
  name?: string;
  description?: string | null;
  rarity?: AvatarRarity;
  isDefault?: boolean;
  slot?: AvatarSlot;
}

export const adminAvatarItemsService = {
  async list() {
    const items = await db.select().from(avatarItems).orderBy(sql`${avatarItems.createdAt} DESC`);
    const usage = await usageFor(items.map((item) => item.id));
    return items.map((item) => serialize(item, usage.get(item.id)));
  },

  async get(id: string) {
    const item = await findItem(id);
    const partner = await partnerOf(item);
    const usage = await usageFor([item.id, ...(partner ? [partner.id] : [])]);
    const [goals] = await db.select({ n: count() }).from(studentProfiles)
      .where(and(eq(studentProfiles.shopGoalItemId, item.id), eq(studentProfiles.shopGoalKind, 'AVATAR')));
    return {
      item: serialize(item, usage.get(item.id)),
      partner: partner ? serialize(partner, usage.get(partner.id)) : null,
      goals: Number(goals?.n ?? 0),
    };
  },

  /** Crea un borrador con la imagen ya preparada en «Completa». No llega a ninguna clase hasta publicarlo. */
  async create(actorId: string, input: CreateAvatarItemInput, png: Buffer) {
    let partner: AvatarItemRow | null = null;
    let rarity = input.rarity;
    if (input.pairWith) {
      partner = await findItem(input.pairWith);
      if (partner.gender === input.gender) throw new ConflictError(`La otra versión debe ser del otro cuerpo (esa es de ${BODY_NAME[partner.gender]}).`);
      if (partner.slot !== input.slot) throw new ConflictError('Las dos versiones van en la misma ranura.');
      if (await partnerOf(partner)) throw new ConflictError(`Esa prenda ya tiene su versión ${BODY_NAME[input.gender]}.`);
      rarity = partner.rarity;
    }

    const stored = await storeAvatarLayer(png, input.slot);
    try {
      if (partner) {
        assertDifferentImages(input.slot, { imagePath: stored.imagePath, hash: stored.imageHash }, { imagePath: partner.imagePath, hash: await ensureHash(partner) }, partner.gender);
      }
      const [basicos] = await db.select({ id: avatarCollections.id }).from(avatarCollections).where(eq(avatarCollections.slug, 'basicos'));
      const id = uuidv4();
      const now = new Date();
      await db.transaction(async (tx) => {
        let pairKey: string | null = null;
        if (partner) {
          const [locked] = await tx.select().from(avatarItems).where(eq(avatarItems.id, partner.id)).for('update');
          if (!locked) throw new NotFoundError('La otra versión ya no existe');
          pairKey = locked.pairKey ?? uuidv4();
          if (!locked.pairKey) await tx.update(avatarItems).set({ pairKey, updatedAt: now }).where(eq(avatarItems.id, locked.id));
        }
        await tx.insert(avatarItems).values({
          id,
          name: input.name,
          description: input.description || null,
          gender: input.gender,
          slot: input.slot,
          imagePath: stored.imagePath,
          imageHash: stored.imageHash,
          layerOrder: LAYER_ORDER[input.slot],
          basePrice: 100,
          rarity,
          collectionId: basicos?.id ?? null,
          pairKey,
          isDefault: false,
          isActive: false,
          publishedAt: null,
          createdAt: now,
          updatedAt: now,
        });
      });
      audit(actorId, 'create', id, { slot: input.slot, gender: input.gender, pairWith: partner?.id ?? null });
      return this.get(id);
    } catch (error) {
      await removeUploadedLayer(stored.imagePath);
      throw error;
    }
  },

  async update(actorId: string, id: string, input: UpdateAvatarItemInput) {
    const item = await findItem(id);
    const status = statusOf(item);
    const partner = await partnerOf(item);
    if (input.slot && input.slot !== item.slot) {
      if (status !== 'DRAFT') throw new ConflictError('La ranura solo se cambia en un borrador (lo publicado ya puede estar puesto).');
      if (partner) throw new ConflictError('Desvincula la otra versión antes de cambiar la ranura.');
    }
    if (input.isDefault && status !== 'PUBLISHED') throw new ConflictError('Solo una prenda publicada puede ser inicial.');

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(avatarItems).set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.rarity !== undefined ? { rarity: input.rarity } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.slot !== undefined ? { slot: input.slot, layerOrder: LAYER_ORDER[input.slot] } : {}),
        updatedAt: now,
      }).where(eq(avatarItems.id, id));
      // Las dos versiones de un par cuestan lo mismo: si no, comprar la común daría la legendaria.
      if (partner && input.rarity !== undefined && input.rarity !== partner.rarity) {
        await tx.update(avatarItems).set({ rarity: input.rarity, updatedAt: now }).where(eq(avatarItems.id, partner.id));
      }
    });
    audit(actorId, 'update', id, { fields: Object.keys(input) });
    return this.get(id);
  },

  /** Cambia la imagen (siempre un archivo nuevo) y borra la anterior si era del panel y nadie más la usa. */
  async replaceImage(actorId: string, id: string, png: Buffer) {
    const item = await findItem(id);
    const stored = await storeAvatarLayer(png, item.slot);
    let previous: string;
    try {
      const partner = await partnerOf(item);
      if (partner) {
        assertDifferentImages(item.slot, { imagePath: stored.imagePath, hash: stored.imageHash }, { imagePath: partner.imagePath, hash: await ensureHash(partner) }, partner.gender);
      }
      previous = await db.transaction(async (tx) => {
        const [locked] = await tx.select().from(avatarItems).where(eq(avatarItems.id, id)).for('update');
        if (!locked) throw new NotFoundError('Prenda no encontrada');
        await tx.update(avatarItems).set({ imagePath: stored.imagePath, imageHash: stored.imageHash, updatedAt: new Date() }).where(eq(avatarItems.id, id));
        return locked.imagePath;
      });
    } catch (error) {
      await removeUploadedLayer(stored.imagePath);
      throw error;
    }
    const [stillUsed] = await db.select({ n: count() }).from(avatarItems).where(eq(avatarItems.imagePath, previous));
    if (Number(stillUsed?.n ?? 0) === 0) await removeUploadedLayer(previous);
    audit(actorId, 'replace_image', id, { previous, next: stored.imagePath });
    return this.get(id);
  },

  /** Publica la prenda y, si su otra versión sigue en borrador, también esa (salen juntas). */
  async publish(actorId: string, id: string) {
    const item = await findItem(id);
    const partner = await partnerOf(item);
    const ids = [item, partner].filter((row): row is AvatarItemRow => !!row && statusOf(row) === 'DRAFT').map((row) => row.id);
    if (ids.length === 0) throw new ConflictError(statusOf(item) === 'PUBLISHED' ? 'Ya está publicada.' : 'Una prenda retirada se reactiva, no se publica.');
    const now = new Date();
    await db.update(avatarItems).set({ isActive: true, publishedAt: now, updatedAt: now })
      .where(and(inArray(avatarItems.id, ids), eq(avatarItems.isActive, false), sql`${avatarItems.publishedAt} IS NULL`));
    audit(actorId, 'publish', id, { ids });
    return this.get(id);
  },

  /** Deja de venderse en todas las clases; quien la compró la conserva. */
  async retire(actorId: string, id: string, withPair: boolean) {
    const item = await findItem(id);
    if (statusOf(item) !== 'PUBLISHED') throw new ConflictError('Solo se retira una prenda publicada.');
    const partner = withPair ? await partnerOf(item) : null;
    const ids = [item.id, ...(partner && statusOf(partner) === 'PUBLISHED' ? [partner.id] : [])];
    await db.update(avatarItems).set({ isActive: false, updatedAt: new Date() }).where(inArray(avatarItems.id, ids));
    audit(actorId, 'retire', id, { ids });
    return this.get(id);
  },

  async restore(actorId: string, id: string, withPair: boolean) {
    const item = await findItem(id);
    if (statusOf(item) !== 'RETIRED') throw new ConflictError('Solo se reactiva una prenda retirada.');
    const partner = withPair ? await partnerOf(item) : null;
    const ids = [item.id, ...(partner && statusOf(partner) === 'RETIRED' ? [partner.id] : [])];
    await db.update(avatarItems).set({ isActive: true, updatedAt: new Date() }).where(inArray(avatarItems.id, ids));
    audit(actorId, 'restore', id, { ids });
    return this.get(id);
  },

  /**
   * Vincula dos versiones como la misma prenda (lo comprado pasa al otro cuerpo): misma ranura y rareza,
   * cuerpos distintos, archivos distintos y ninguna con otro par.
   */
  async pair(actorId: string, id: string, otherId: string) {
    if (id === otherId) throw new ValidationError('Elige la versión del otro cuerpo.');
    const [a, b] = await Promise.all([findItem(id), findItem(otherId)]);
    if (a.gender === b.gender) throw new ConflictError('Las dos versiones deben ser de cuerpos distintos.');
    if (a.slot !== b.slot) throw new ConflictError('Las dos versiones van en la misma ranura.');
    if (a.rarity !== b.rarity) {
      throw new ConflictError(`Tienen rareza distinta (${RARITY_NAME[a.rarity]} y ${RARITY_NAME[b.rarity]}): iguálalas antes de vincularlas.`);
    }
    assertDifferentImages(a.slot, { imagePath: a.imagePath, hash: await ensureHash(a) }, { imagePath: b.imagePath, hash: await ensureHash(b) }, b.gender);

    await db.transaction(async (tx) => {
      const rows: AvatarItemRow[] = await tx.select().from(avatarItems).where(inArray(avatarItems.id, [a.id, b.id])).for('update');
      if (rows.length !== 2) throw new NotFoundError('Prenda no encontrada');
      const keys = [...new Set(rows.map((row) => row.pairKey).filter((key): key is string => !!key))];
      if (keys.length > 1) throw new ConflictError('Una de las dos ya tiene otro par: desvincúlala primero.');
      const pairKey = keys[0] ?? uuidv4();
      if (keys[0]) {
        const [others] = await tx.select({ n: count() }).from(avatarItems)
          .where(and(eq(avatarItems.pairKey, pairKey), notInArray(avatarItems.id, [a.id, b.id])));
        if (Number(others?.n ?? 0) > 0) throw new ConflictError('Una de las dos ya tiene otro par: desvincúlala primero.');
      }
      const result = await tx.update(avatarItems).set({ pairKey, updatedAt: new Date() }).where(inArray(avatarItems.id, [a.id, b.id]));
      if (affectedRows(result) < 1) throw new ConflictError('No se pudo vincular. Recarga e inténtalo de nuevo.');
    });
    audit(actorId, 'pair', id, { otherId });
    return this.get(id);
  },

  /** Separa las dos versiones. Lo que ya se compró no se quita. */
  async unpair(actorId: string, id: string) {
    const item = await findItem(id);
    if (!item.pairKey) throw new ConflictError('Esta prenda no tiene par.');
    await db.update(avatarItems).set({ pairKey: null, updatedAt: new Date() }).where(eq(avatarItems.pairKey, item.pairKey));
    audit(actorId, 'unpair', id, { pairKey: item.pairKey });
    return this.get(id);
  },
};
