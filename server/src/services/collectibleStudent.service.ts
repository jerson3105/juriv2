import { and, asc, count, desc, eq, gt, gte, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  badges,
  classrooms,
  collectibleAlbums,
  collectibleCards,
  collectiblePurchases,
  collectibleWelcomePacks,
  completedAlbums,
  pointLogs,
  studentCollectibles,
  studentProfiles,
  type CardRarity,
} from '../db/schema.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { spendGp } from '../utils/points.js';
import { isInitialLevel, isYoungLevel } from '../utils/energy.js';
import { localDayStart } from '../utils/shopRules.js';
import { COLLECTIBLE_PACK_PREFIX } from '../utils/pointReasons.js';
import { NEW_CARD_DAYS, albumPricing, drawPack, packRules, welcomeCards } from '../utils/collectibleRules.js';
import { logger } from '../utils/logger.js';
import { avatarCatalogService, pendingGoldOf } from './avatarCatalog.service.js';
import { studentService } from './student.service.js';
import { badgeService } from './badge.service.js';

// «Coleccionables» del alumno (v2): su álbum, el sobre del día y el de bienvenida. Las reglas de precio y
// sorteo están en utils/collectibleRules.ts; las del docente (álbumes y figuritas), en collectible.service.ts.

type Executor = Pick<typeof db, 'select' | 'insert' | 'update'>;
type Album = typeof collectibleAlbums.$inferSelect;

const RESTING_MESSAGE = 'Estás descansando: completa tu misión de recuperación para volver a abrir sobres.';

const loadOwnProfile = async (profileId: string, userId: string) => {
  const [row] = await db
    .select({
      id: studentProfiles.id,
      userId: studentProfiles.userId,
      classroomId: studentProfiles.classroomId,
      gp: studentProfiles.gp,
      hp: studentProfiles.hp,
      isActive: studentProfiles.isActive,
      classroomName: classrooms.name,
      teacherId: classrooms.teacherId,
      gradeLevel: classrooms.gradeLevel,
      shopEnabled: classrooms.shopEnabled,
    })
    .from(studentProfiles)
    .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
    .where(eq(studentProfiles.id, profileId));
  if (!row || row.userId !== userId) throw new NotFoundError('Perfil no encontrado');
  return row;
};
type OwnProfile = Awaited<ReturnType<typeof loadOwnProfile>>;

/** Los sobres se venden en la tienda: cerrada o en descanso se mira el álbum, pero no se abren sobres. */
const kioskState = (profile: OwnProfile) => {
  if (!profile.shopEnabled) return { open: false, reason: 'SHOP_CLOSED' as const };
  if (profile.hp <= 0 && !isInitialLevel(profile.gradeLevel)) return { open: false, reason: 'RESTING' as const };
  return { open: true, reason: null };
};

const assertKioskOpen = (profile: OwnProfile) => {
  if (!profile.isActive) throw new ForbiddenError('No puedes abrir sobres en esta clase');
  const kiosk = kioskState(profile);
  if (kiosk.reason === 'SHOP_CLOSED') throw new ValidationError('Tu profe cerró la tienda por ahora: puedes mirar tu álbum, pero no abrir sobres.');
  if (kiosk.reason === 'RESTING') throw new ValidationError(RESTING_MESSAGE);
};

/** El álbum de la clase del alumno que todavía tiene sobres. */
const loadOpenAlbum = async (profile: OwnProfile, albumId: string) => {
  const [album] = await db.select().from(collectibleAlbums).where(eq(collectibleAlbums.id, albumId));
  if (!album || album.classroomId !== profile.classroomId) throw new NotFoundError('Álbum no encontrado');
  if (!album.isActive) throw new ValidationError('Este álbum ya no tiene sobres');
  const cards = await db.select().from(collectibleCards).where(eq(collectibleCards.albumId, album.id)).orderBy(asc(collectibleCards.slotNumber));
  if (cards.length === 0) throw new ValidationError('Este álbum todavía no tiene figuritas');
  return { album, cards };
};
type Card = Awaited<ReturnType<typeof loadOpenAlbum>>['cards'][number];

/** Las copias del alumno por figurita: cuántas tiene (normales y brillantes) y desde cuándo. */
const loadCopies = async (exec: Executor, profileId: string, albumIds: string[]) => {
  const rows = albumIds.length
    ? await exec
      .select({
        cardId: studentCollectibles.cardId,
        quantity: studentCollectibles.quantity,
        isShiny: studentCollectibles.isShiny,
        obtainedAt: studentCollectibles.obtainedAt,
      })
      .from(studentCollectibles)
      .innerJoin(collectibleCards, eq(collectibleCards.id, studentCollectibles.cardId))
      .where(and(eq(studentCollectibles.studentProfileId, profileId), inArray(collectibleCards.albumId, albumIds)))
    : [];
  const copies = new Map<string, { count: number; shiny: boolean; obtainedAt: Date }>();
  for (const row of rows) {
    const copy = copies.get(row.cardId);
    const obtainedAt = new Date(row.obtainedAt);
    if (!copy) {
      copies.set(row.cardId, { count: row.quantity, shiny: row.isShiny, obtainedAt });
      continue;
    }
    copy.count += row.quantity;
    copy.shiny = copy.shiny || row.isShiny;
    if (obtainedAt < copy.obtainedAt) copy.obtainedAt = obtainedAt;
  }
  return copies;
};
type Copies = Awaited<ReturnType<typeof loadCopies>>;

/** Una figurita para el alumno. Las que le faltan van solo con número, nombre y rareza (sin dibujo ni dato). */
const cardView = (card: Card, copy: { count: number; shiny: boolean; obtainedAt: Date } | undefined, now = Date.now()) => ({
  id: card.id,
  slotNumber: card.slotNumber,
  name: card.name,
  rarity: card.rarity as CardRarity,
  owned: !!copy,
  icon: copy ? card.icon : null,
  imageUrl: copy ? card.imageUrl : null,
  description: copy ? card.description : null,
  count: copy?.count ?? 0,
  shiny: copy?.shiny ?? false,
  isNew: !!copy && now - copy.obtainedAt.getTime() < NEW_CARD_DAYS * 86_400_000,
});

/** Pega las figuritas del sobre: una nueva crea su fila y una repetida suma una copia. */
const giveCards = async (tx: Executor, profileId: string, cards: Card[], now: Date) => {
  for (const card of cards) {
    await tx.insert(studentCollectibles)
      .values({ id: uuidv4(), studentProfileId: profileId, cardId: card.id, quantity: 1, isShiny: false, obtainedAt: now, updatedAt: now })
      .onDuplicateKeyUpdate({ set: { quantity: sql`${studentCollectibles.quantity} + 1`, updatedAt: now } });
  }
};

/** Bloquea al alumno: sus sobres se abren de a uno y lo que se lee después ya incluye el anterior. */
const lockProfile = async (tx: Executor, profileId: string) => {
  const [row] = await tx.select({ gp: studentProfiles.gp }).from(studentProfiles).where(eq(studentProfiles.id, profileId)).for('update');
  if (!row) throw new NotFoundError('Perfil no encontrado');
  return row;
};

const isDuplicateKey = (error: any) => error?.code === 'ER_DUP_ENTRY' || error?.cause?.code === 'ER_DUP_ENTRY';

const openedCards = (drawn: Array<{ card: Card; isNew: boolean }>, copies: Copies) => drawn.map(({ card, isNew }) => {
  const before = copies.get(card.id);
  return {
    ...cardView(card, { count: (before?.count ?? 0) + 1, shiny: before?.shiny ?? false, obtainedAt: before?.obtainedAt ?? new Date() }),
    isNew,
  };
});

class CollectibleStudentService {
  /**
   * «Coleccionables» en una carga: sus álbumes (los activos con figuritas y los archivados donde tiene alguna), cada
   * uno con sus figuritas, el sobre del día y el de bienvenida. Si completó un álbum sin abrir un sobre (la figurita
   * de la Historia), aquí se registra y se entrega su premio (`justCompleted`).
   */
  async getView(profileId: string, userId: string, tz: number) {
    let profile = await loadOwnProfile(profileId, userId);
    const young = isYoungLevel(profile.gradeLevel);
    const rules = packRules(young);
    const albums = await db.select().from(collectibleAlbums)
      .where(eq(collectibleAlbums.classroomId, profile.classroomId))
      .orderBy(desc(collectibleAlbums.isActive), desc(collectibleAlbums.createdAt));
    const albumIds = albums.map((album) => album.id);
    const badgeIds = [...new Set(albums.map((album) => album.rewardBadgeId).filter((id): id is string => !!id))];

    const [cards, copies, completedRows, welcomeRows, [daily], pendingGold, badgeRows] = await Promise.all([
      albumIds.length
        ? db.select().from(collectibleCards).where(inArray(collectibleCards.albumId, albumIds)).orderBy(asc(collectibleCards.slotNumber))
        : Promise.resolve([]),
      loadCopies(db, profile.id, albumIds),
      albumIds.length
        ? db.select({ albumId: completedAlbums.albumId, completedAt: completedAlbums.completedAt }).from(completedAlbums)
          .where(and(eq(completedAlbums.studentProfileId, profile.id), inArray(completedAlbums.albumId, albumIds)))
        : Promise.resolve([]),
      albumIds.length
        ? db.select({ albumId: collectibleWelcomePacks.albumId }).from(collectibleWelcomePacks)
          .where(and(eq(collectibleWelcomePacks.studentProfileId, profile.id), inArray(collectibleWelcomePacks.albumId, albumIds)))
        : Promise.resolve([]),
      db.select({ used: count() }).from(collectiblePurchases).where(and(
        eq(collectiblePurchases.studentProfileId, profile.id),
        gt(collectiblePurchases.gpSpent, 0),
        gte(collectiblePurchases.purchasedAt, localDayStart(tz)),
      )),
      pendingGoldOf(profile.id),
      badgeIds.length ? db.select({ id: badges.id, name: badges.name, icon: badges.icon, customImage: badges.customImage }).from(badges).where(inArray(badges.id, badgeIds)) : Promise.resolve([]),
    ]);

    const cardsByAlbum = new Map<string, Card[]>();
    for (const card of cards) cardsByAlbum.set(card.albumId, [...(cardsByAlbum.get(card.albumId) ?? []), card]);
    const completedByAlbum = new Map(completedRows.map((row) => [row.albumId, row.completedAt]));
    const welcomed = new Set(welcomeRows.map((row) => row.albumId));
    const badgeById = new Map(badgeRows.map((badge) => [badge.id, badge]));
    const visible = albums.filter((album) => {
      const albumCards = cardsByAlbum.get(album.id) ?? [];
      return albumCards.length > 0 && (album.isActive || albumCards.some((card) => copies.has(card.id)));
    });
    // El precio sale del oro semanal de la clase (solo si hay algo que vender).
    const weekly = visible.some((album) => album.isActive) ? await avatarCatalogService.classWeeklyBase(profile.classroomId) : 0;

    const justCompleted: NonNullable<Awaited<ReturnType<CollectibleStudentService['completeIfFull']>>>[] = [];
    const now = Date.now();
    const views = [];
    for (const album of visible) {
      const albumCards = cardsByAlbum.get(album.id)!;
      const owned = albumCards.filter((card) => copies.has(card.id));
      let completedAt: Date | null = completedByAlbum.get(album.id) ?? null;
      if (!completedAt && owned.length === albumCards.length) {
        const completion = await this.completeIfFull(profile, album, albumCards.length);
        if (completion) justCompleted.push(completion);
        completedAt = new Date();
      }
      const missing = albumCards.length - owned.length;
      const pricing = albumPricing(weekly, album.priceLevel, albumCards.length, young);
      const size = Math.min(pricing.packCards, missing);
      const badge = album.rewardBadgeId ? badgeById.get(album.rewardBadgeId) ?? null : null;
      views.push({
        id: album.id,
        name: album.name,
        description: album.description,
        coverImage: album.coverImage,
        isActive: album.isActive,
        totalCards: albumCards.length,
        owned: owned.length,
        missing,
        // Copias de más: las que se podrán cambiar (el intercambio llega después).
        duplicates: owned.reduce((sum, card) => sum + copies.get(card.id)!.count - 1, 0),
        completedAt,
        welcome: album.isActive && missing > 0 && !welcomed.has(album.id) ? { cards: welcomeCards(young, albumCards.length, missing) } : null,
        pack: album.isActive && missing > 0 ? { cards: size, price: pricing.priceFor(size) } : null,
        rewards: { gp: album.rewardGp, hp: album.rewardHp, badge: badge ? { name: badge.name, icon: badge.icon, customImage: badge.customImage } : null },
        cards: albumCards.map((card) => cardView(card, copies.get(card.id), now)),
      });
    }
    // El premio del álbum recién completado pudo traer oro.
    if (justCompleted.length) profile = await loadOwnProfile(profileId, userId);
    const used = Number(daily?.used ?? 0);

    return {
      profile: { id: profile.id, gold: profile.gp, pendingGold },
      classroomName: profile.classroomName,
      // Inicial a 2.º: sobre de 3, uno al día y sin repetidas.
      young,
      kiosk: kioskState(profile),
      daily: { limit: rules.dailyPacks, used, left: Math.max(0, rules.dailyPacks - used) },
      albums: views,
      justCompleted,
    };
  }

  /**
   * Abre el sobre del álbum: cobra, sortea (una de cada cinco, en promedio, repetida; el resto entre las que faltan)
   * y pega las figuritas. Todo en una transacción con el alumno bloqueado: con dos pestañas no se pasa del límite
   * diario ni se gasta el oro dos veces. Como en la Tienda: no se gasta el oro que espera a tu profe.
   */
  async openPack(profileId: string, userId: string, albumId: string, tz: number) {
    const profile = await loadOwnProfile(profileId, userId);
    assertKioskOpen(profile);
    const { album, cards } = await loadOpenAlbum(profile, albumId);
    const young = isYoungLevel(profile.gradeLevel);
    const pricing = albumPricing(await avatarCatalogService.classWeeklyBase(profile.classroomId), album.priceLevel, cards.length, young);
    const now = new Date();
    const dayStart = localDayStart(tz, now);

    const outcome = await db.transaction(async (tx) => {
      const { gp } = await lockProfile(tx, profile.id);
      const copies = await loadCopies(tx, profile.id, [album.id]);
      const missing = cards.filter((card) => !copies.has(card.id));
      if (missing.length === 0) throw new ConflictError('Ya completaste este álbum');
      const [{ used }] = await tx.select({ used: count() }).from(collectiblePurchases).where(and(
        eq(collectiblePurchases.studentProfileId, profile.id),
        gt(collectiblePurchases.gpSpent, 0),
        gte(collectiblePurchases.purchasedAt, dayStart),
      ));
      if (Number(used) >= pricing.dailyPacks) {
        throw new ValidationError(pricing.dailyPacks === 1
          ? 'Hoy ya abriste tu sobre. Mañana puedes abrir otro.'
          : `Hoy ya abriste tus ${pricing.dailyPacks} sobres. Mañana puedes abrir más.`);
      }
      const size = Math.min(pricing.packCards, missing.length);
      const price = pricing.priceFor(size);
      const pendingGold = await pendingGoldOf(profile.id);
      if (gp - pendingGold < price || !(await spendGp(tx, profile.id, price))) {
        throw new ValidationError(pendingGold > 0
          ? `No te alcanza: tienes ${gp} de oro y ${pendingGold} ya esperan a tu profe.`
          : `No te alcanza: el sobre cuesta ${price} de oro.`);
      }
      const drawn = drawPack(missing, cards.filter((card) => copies.has(card.id)), size, pricing.duplicateChance);
      await giveCards(tx, profile.id, drawn.map(({ card }) => card), now);
      await tx.insert(collectiblePurchases).values({
        id: uuidv4(),
        studentProfileId: profile.id,
        albumId: album.id,
        packType: 'PACK',
        gpSpent: price,
        cardsObtained: drawn.map(({ card, isNew }) => ({ cardId: card.id, cardName: card.name, rarity: card.rarity, isShiny: false, isNew })),
        purchasedAt: now,
      });
      // El gasto queda en el registro: «Mi progreso» lo muestra como gasto propio.
      await tx.insert(pointLogs).values({
        id: uuidv4(),
        studentId: profile.id,
        pointType: 'GP',
        action: 'REMOVE',
        amount: price,
        reason: `${COLLECTIBLE_PACK_PREFIX}${album.name}`,
        createdAt: now,
      });
      return { cards: openedCards(drawn, copies), price, newBalance: gp - price, dailyLeft: pricing.dailyPacks - Number(used) - 1 };
    });

    const completed = await this.completeIfFull(profile, album, cards.length);
    return { ...outcome, completed };
  }

  /** El sobre de bienvenida: gratis, uno por alumno y álbum, todas nuevas. La marca con índice único va primero. */
  async openWelcome(profileId: string, userId: string, albumId: string) {
    const profile = await loadOwnProfile(profileId, userId);
    assertKioskOpen(profile);
    const { album, cards } = await loadOpenAlbum(profile, albumId);
    const young = isYoungLevel(profile.gradeLevel);
    const now = new Date();

    let outcome;
    try {
      outcome = await db.transaction(async (tx) => {
        await lockProfile(tx, profile.id);
        await tx.insert(collectibleWelcomePacks).values({ id: uuidv4(), studentProfileId: profile.id, albumId: album.id, openedAt: now });
        const copies = await loadCopies(tx, profile.id, [album.id]);
        const missing = cards.filter((card) => !copies.has(card.id));
        if (missing.length === 0) throw new ConflictError('Ya completaste este álbum');
        const drawn = drawPack(missing, [], welcomeCards(young, cards.length, missing.length), 0);
        await giveCards(tx, profile.id, drawn.map(({ card }) => card), now);
        await tx.insert(collectiblePurchases).values({
          id: uuidv4(),
          studentProfileId: profile.id,
          albumId: album.id,
          packType: 'WELCOME',
          gpSpent: 0,
          cardsObtained: drawn.map(({ card }) => ({ cardId: card.id, cardName: card.name, rarity: card.rarity, isShiny: false, isNew: true })),
          purchasedAt: now,
        });
        return { cards: openedCards(drawn, copies) };
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw new ConflictError('Ya abriste tu sobre de bienvenida');
      throw error;
    }

    const completed = await this.completeIfFull(profile, album, cards.length);
    return { ...outcome, completed };
  }

  /**
   * Si ya tiene todas las figuritas (normal o brillante, cualquiera cuenta), registra el álbum completo y entrega su
   * premio: oro, PV y la insignia del profe. Sin XP: lo comprado con oro no sube de nivel ni llega a «Hoy subieron».
   * El índice único (alumno, álbum) hace que, con dos sobres a la vez, el premio se entregue una sola vez.
   */
  async completeIfFull(profile: Pick<OwnProfile, 'id' | 'teacherId'>, album: Album, totalCards: number) {
    if (totalCards === 0) return null;
    const [{ owned }] = await db.select({ owned: sql<string>`COUNT(DISTINCT ${studentCollectibles.cardId})` })
      .from(studentCollectibles)
      .innerJoin(collectibleCards, eq(collectibleCards.id, studentCollectibles.cardId))
      .where(and(eq(studentCollectibles.studentProfileId, profile.id), eq(collectibleCards.albumId, album.id)));
    if (Number(owned) < totalCards) return null;

    try {
      await db.insert(completedAlbums).values({ id: uuidv4(), studentProfileId: profile.id, albumId: album.id, rewardsGiven: false, completedAt: new Date() });
    } catch (error) {
      if (isDuplicateKey(error)) return null;
      throw error;
    }

    const reason = `Álbum completado: ${album.name}`;
    for (const [pointType, amount] of [['HP', album.rewardHp], ['GP', album.rewardGp]] as const) {
      if (amount > 0) await studentService.updatePoints({ studentId: profile.id, pointType, amount, reason, teacherId: profile.teacherId });
    }
    let badge: { name: string; icon: string; customImage: string | null } | null = null;
    if (album.rewardBadgeId) {
      try {
        await badgeService.awardBadgeAutomatic(profile.id, album.rewardBadgeId, reason);
        const [row] = await db.select({ name: badges.name, icon: badges.icon, customImage: badges.customImage }).from(badges).where(eq(badges.id, album.rewardBadgeId));
        badge = row ?? null;
      } catch (error) {
        logger.warn('No se pudo otorgar la insignia del álbum', { albumId: album.id, error: (error as Error).message });
      }
    }
    await db.update(completedAlbums)
      .set({ rewardsGiven: true })
      .where(and(eq(completedAlbums.studentProfileId, profile.id), eq(completedAlbums.albumId, album.id)));

    return { albumId: album.id, albumName: album.name, rewards: { gp: album.rewardGp, hp: album.rewardHp, badge } };
  }
}

export const collectibleStudentService = new CollectibleStudentService();
