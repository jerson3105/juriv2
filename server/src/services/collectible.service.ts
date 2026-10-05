import type { GoogleGenAI } from '@google/genai';
import { createGenAI } from '../utils/aiClient.js';
import { db } from '../db/index.js';
import {
  collectibleAlbums,
  collectibleBoxItems,
  collectibleCards,
  studentCollectibles,
  collectiblePurchases,
  completedAlbums,
  studentProfiles,
  classrooms,
  users,
  type CardRarity,
  type ImageStyle,
} from '../db/schema.js';
import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { isYoungLevel } from '../utils/energy.js';
import { albumPricing, welcomeCards } from '../utils/collectibleRules.js';
import { avatarCatalogService, type AvatarPriceLevel } from './avatarCatalog.service.js';
import { assertClassroomWritable } from '../utils/access.js';

// Álbumes y figuritas del docente. Lo del alumno (su álbum, los sobres y el completado) está en
// collectibleStudent.service.ts, y las reglas de precio y sorteo en utils/collectibleRules.ts.

const PRICE_LEVELS: AvatarPriceLevel[] = ['LOW', 'NORMAL', 'HIGH'];
type PricingContext = { weekly: number; young: boolean };

export interface GenerateAlbumRequest {
  classroomId: string;
  theme: string;
  cardCount: number;
  imageStyle: ImageStyle;
  rarityDistribution?: 'auto' | {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
  };
}

export interface GeneratedCard {
  name: string;
  description: string;
  icon?: string;
  rarity: CardRarity;
}

export interface GeneratedAlbum {
  name: string;
  description: string;
  cards: GeneratedCard[];
}

class CollectibleService {
  private ai: GoogleGenAI | null = null;

  private async getTeacherClassroom(teacherId: string, classroomId: string) {
    const [classroom] = await db
      .select({ id: classrooms.id, name: classrooms.name })
      .from(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)));

    return classroom ?? null;
  }

  private getAI(): GoogleGenAI {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY no configurada');
      }
      this.ai = createGenAI(apiKey);
    }
    return this.ai;
  }

  private async albumHasStudentUsage(executor: any, albumId: string) {
    const [[purchaseUsage], [completionUsage], [collectionUsage]] = await Promise.all([
      executor
        .select({ count: sql<number>`count(*)` })
        .from(collectiblePurchases)
        .where(eq(collectiblePurchases.albumId, albumId)),
      executor
        .select({ count: sql<number>`count(*)` })
        .from(completedAlbums)
        .where(eq(completedAlbums.albumId, albumId)),
      executor
        .select({ count: sql<number>`count(*)` })
        .from(studentCollectibles)
        .innerJoin(collectibleCards, eq(studentCollectibles.cardId, collectibleCards.id))
        .where(eq(collectibleCards.albumId, albumId)),
    ]);

    return (purchaseUsage?.count || 0) > 0
      || (completionUsage?.count || 0) > 0
      || (collectionUsage?.count || 0) > 0;
  }

  private async resequenceAlbumCards(executor: any, albumId: string) {
    const cards = await executor
      .select({ id: collectibleCards.id })
      .from(collectibleCards)
      .where(eq(collectibleCards.albumId, albumId))
      .orderBy(asc(collectibleCards.slotNumber), asc(collectibleCards.createdAt));

    for (const [index, card] of cards.entries()) {
      await executor
        .update(collectibleCards)
        .set({ slotNumber: index + 1 })
        .where(eq(collectibleCards.id, card.id));
    }
  }

  // ==================== PRECIOS (ORO SEMANAL DE LA CLASE) ====================

  private async pricingContext(classroomId: string): Promise<PricingContext> {
    const [classroom] = await db.select({ gradeLevel: classrooms.gradeLevel }).from(classrooms).where(eq(classrooms.id, classroomId));
    return { weekly: await avatarCatalogService.classWeeklyBase(classroomId), young: isYoungLevel(classroom?.gradeLevel) };
  }

  /** Lo que el docente ve del precio de un álbum: el sobre, cuántos al día y lo que cuesta completarlo. */
  private pricingFor(context: PricingContext, level: AvatarPriceLevel, totalCards: number) {
    const pricing = albumPricing(context.weekly, level, totalCards, context.young);
    return {
      weeklyGold: context.weekly,
      young: context.young,
      packCards: pricing.packCards,
      packPrice: pricing.packPrice,
      dailyPacks: pricing.dailyPacks,
      duplicatePercent: Math.round(pricing.duplicateChance * 100),
      welcomeCards: welcomeCards(context.young, totalCards, totalCards),
      completeCost: pricing.completeCost,
      completeWeeks: Math.round(pricing.completeWeeks * 10) / 10,
    };
  }

  /** Los tres niveles de precio de un álbum de `totalCards` figuritas en esta clase (para elegir en el formulario). */
  async getPricingPreview(classroomId: string, totalCards: number) {
    const context = await this.pricingContext(classroomId);
    return {
      weeklyGold: context.weekly,
      young: context.young,
      levels: Object.fromEntries(PRICE_LEVELS.map((level) => [level, this.pricingFor(context, level, totalCards)])) as Record<AvatarPriceLevel, ReturnType<CollectibleService['pricingFor']>>,
    };
  }

  async getAlbumWithPricing(albumId: string) {
    const album = await this.getAlbumById(albumId);
    if (!album) return null;
    const context = await this.pricingContext(album.classroomId);
    return { ...album, pricing: this.pricingFor(context, album.priceLevel, album.totalCards) };
  }

  // ==================== ÁLBUMES ====================

  async createAlbum(data: {
    classroomId: string;
    name: string;
    description?: string;
    coverImage?: string;
    theme?: string;
    imageStyle?: ImageStyle;
    priceLevel?: AvatarPriceLevel;
    rewardHp?: number;
    rewardGp?: number;
    rewardBadgeId?: string;
    allowTrades?: boolean;
  }) {
    const now = new Date();
    // Inicial a 2.º: «Más barato» por defecto, como la ropa del avatar.
    const [classroom] = await db.select({ gradeLevel: classrooms.gradeLevel }).from(classrooms).where(eq(classrooms.id, data.classroomId));
    const album = {
      id: uuidv4(),
      classroomId: data.classroomId,
      name: data.name,
      description: data.description || null,
      coverImage: data.coverImage || null,
      theme: data.theme || null,
      imageStyle: data.imageStyle || 'CARTOON' as ImageStyle,
      priceLevel: data.priceLevel ?? (isYoungLevel(classroom?.gradeLevel) ? 'LOW' as const : 'NORMAL' as const),
      rewardHp: data.rewardHp ?? 0,
      rewardGp: data.rewardGp ?? 0,
      rewardBadgeId: data.rewardBadgeId || null,
      allowTrades: data.allowTrades ?? true, // la caja de la clase, encendida por defecto
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(collectibleAlbums).values(album);
    return album;
  }

  async getAlbumsByClassroom(classroomId: string, options: { pricing?: boolean } = {}) {
    const albums = await db
      .select()
      .from(collectibleAlbums)
      .where(eq(collectibleAlbums.classroomId, classroomId))
      .orderBy(desc(collectibleAlbums.createdAt));

    // Agregar conteo de cartas para cada álbum
    const albumsWithCount = await Promise.all(
      albums.map(async (album) => {
        const cards = await db
          .select({ count: sql<number>`count(*)` })
          .from(collectibleCards)
          .where(eq(collectibleCards.albumId, album.id));

        return {
          ...album,
          totalCards: Number(cards[0]?.count || 0),
        };
      })
    );

    if (!options.pricing || albumsWithCount.length === 0) return albumsWithCount;
    const context = await this.pricingContext(classroomId);
    return albumsWithCount.map((album) => ({ ...album, pricing: this.pricingFor(context, album.priceLevel, album.totalCards) }));
  }

  async getImportableAlbumsForTeacher(teacherId: string, currentClassroomId: string) {
    const currentClassroom = await this.getTeacherClassroom(teacherId, currentClassroomId);

    if (!currentClassroom) {
      throw new Error('Aula no encontrada');
    }

    const teacherClassrooms = await db
      .select({ id: classrooms.id, name: classrooms.name })
      .from(classrooms)
      .where(eq(classrooms.teacherId, teacherId));

    const sources = await Promise.all(
      teacherClassrooms
        .filter((classroom) => classroom.id !== currentClassroomId)
        .map(async (classroom) => ({
          classroomId: classroom.id,
          classroomName: classroom.name,
          albums: await this.getAlbumsByClassroom(classroom.id),
        }))
    );

    return sources.filter((source) => source.albums.length > 0);
  }

  async getAlbumById(albumId: string) {
    const [album] = await db
      .select()
      .from(collectibleAlbums)
      .where(eq(collectibleAlbums.id, albumId));
    
    if (!album) return null;

    const cards = await db
      .select()
      .from(collectibleCards)
      .where(eq(collectibleCards.albumId, albumId))
      .orderBy(asc(collectibleCards.slotNumber));

    return { ...album, cards, totalCards: cards.length };
  }

  async updateAlbum(albumId: string, data: Partial<{
    name: string;
    description: string;
    coverImage: string;
    theme: string;
    imageStyle: ImageStyle;
    priceLevel: AvatarPriceLevel;
    rewardHp: number;
    rewardGp: number;
    rewardBadgeId: string | null;
    allowTrades: boolean;
    isActive: boolean;
  }>) {
    await db
      .update(collectibleAlbums)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(collectibleAlbums.id, albumId));

    return this.getAlbumWithPricing(albumId);
  }

  async cloneAlbumToClassrooms(teacherId: string, albumId: string, targetClassroomIds: string[]) {
    if (targetClassroomIds.length === 0) {
      throw new Error('Selecciona al menos una clase destino');
    }

    const sourceAlbum = await this.getAlbumById(albumId);

    if (!sourceAlbum) {
      throw new Error('Álbum no encontrado');
    }

    const sourceClassroom = await this.getTeacherClassroom(teacherId, sourceAlbum.classroomId);

    if (!sourceClassroom) {
      throw new Error('No tienes acceso a este álbum');
    }

    const uniqueTargetIds = Array.from(new Set(targetClassroomIds))
      .map((classroomId) => classroomId?.trim())
      .filter((classroomId): classroomId is string => Boolean(classroomId) && classroomId !== sourceAlbum.classroomId);

    if (uniqueTargetIds.length === 0) {
      throw new Error('Selecciona otra clase destino');
    }

    const targetClassrooms = await db
      .select({ id: classrooms.id, name: classrooms.name, gradeLevel: classrooms.gradeLevel })
      .from(classrooms)
      // Los destinos no pueden estar archivados (el álbum de origen sí: se reutiliza).
      .where(and(eq(classrooms.teacherId, teacherId), inArray(classrooms.id, uniqueTargetIds), eq(classrooms.isActive, true)));
    // El nivel de precio pasa solo entre clases de la misma edad; inicial a 2.º, siempre «Más barato».
    const [sourceGrade] = await db.select({ gradeLevel: classrooms.gradeLevel }).from(classrooms).where(eq(classrooms.id, sourceAlbum.classroomId));
    const sourceYoung = isYoungLevel(sourceGrade?.gradeLevel);
    const priceLevelFor = (gradeLevel: string | null) => isYoungLevel(gradeLevel) ? 'LOW' as const
      : sourceYoung ? 'NORMAL' as const : sourceAlbum.priceLevel;

    if (targetClassrooms.length !== uniqueTargetIds.length) {
      throw new Error('Hay clases destino no válidas');
    }

    const created = await db.transaction(async (tx) => {
      const createdAlbums: Array<{ classroomId: string; classroomName: string; albumId: string }> = [];

      for (const targetClassroom of targetClassrooms) {
        const now = new Date();
        const clonedAlbumId = uuidv4();

        await tx.insert(collectibleAlbums).values({
          id: clonedAlbumId,
          classroomId: targetClassroom.id,
          name: sourceAlbum.name,
          description: sourceAlbum.description,
          coverImage: sourceAlbum.coverImage,
          theme: sourceAlbum.theme,
          imageStyle: sourceAlbum.imageStyle,
          priceLevel: priceLevelFor(targetClassroom.gradeLevel),
          rewardHp: sourceAlbum.rewardHp,
          rewardGp: sourceAlbum.rewardGp,
          rewardBadgeId: null,
          allowTrades: sourceAlbum.allowTrades,
          isActive: sourceAlbum.isActive,
          createdAt: now,
          updatedAt: now,
        });

        if (sourceAlbum.cards.length > 0) {
          await tx.insert(collectibleCards).values(
            sourceAlbum.cards.map((card) => ({
              id: uuidv4(),
              albumId: clonedAlbumId,
              name: card.name,
              description: card.description,
              imageUrl: card.imageUrl,
              icon: card.icon,
              rarity: card.rarity,
              slotNumber: card.slotNumber,
              isShiny: card.isShiny,
              createdAt: now,
              updatedAt: now,
            }))
          );
        }

        createdAlbums.push({
          classroomId: targetClassroom.id,
          classroomName: targetClassroom.name,
          albumId: clonedAlbumId,
        });
      }

      return createdAlbums;
    });

    return {
      sourceAlbumId: sourceAlbum.id,
      sourceAlbumName: sourceAlbum.name,
      totalCards: sourceAlbum.cards.length,
      skippedRewardBadge: Boolean(sourceAlbum.rewardBadgeId),
      created,
    };
  }

  // Archivar: deja de venderse y de mostrarse como activo; los estudiantes conservan sus figuritas,
  // compras y álbumes completados (antes se borraba todo). Se restaura con isActive = true.
  async deleteAlbum(albumId: string) {
    await db
      .update(collectibleAlbums)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(collectibleAlbums.id, albumId));
  }

  async moveCardsBetweenAlbums(
    teacherId: string,
    sourceAlbumId: string,
    targetAlbumId: string,
    cardIds: string[]
  ) {
    const uniqueCardIds = Array.from(new Set(
      cardIds
        .map((cardId) => cardId?.trim())
        .filter((cardId): cardId is string => Boolean(cardId))
    ));

    if (uniqueCardIds.length === 0) {
      throw new Error('Selecciona al menos una figurita');
    }

    if (!targetAlbumId?.trim()) {
      throw new Error('Selecciona un álbum destino');
    }

    if (sourceAlbumId === targetAlbumId) {
      throw new Error('Selecciona otro álbum destino');
    }

    const sourceAlbum = await this.getAlbumById(sourceAlbumId);
    const targetAlbum = await this.getAlbumById(targetAlbumId);

    if (!sourceAlbum || !targetAlbum) {
      throw new Error('Álbum no encontrado');
    }

    const [sourceClassroom, targetClassroom] = await Promise.all([
      this.getTeacherClassroom(teacherId, sourceAlbum.classroomId),
      this.getTeacherClassroom(teacherId, targetAlbum.classroomId),
    ]);

    if (!sourceClassroom || !targetClassroom) {
      throw new Error('No tienes acceso a este álbum');
    }

    if (sourceAlbum.classroomId !== targetAlbum.classroomId) {
      throw new Error('Solo puedes mover figuritas entre álbumes de la misma clase');
    }
    await assertClassroomWritable(sourceAlbum.classroomId);

    return db.transaction(async (tx) => {
      const [sourceHasUsage, targetHasUsage] = await Promise.all([
        this.albumHasStudentUsage(tx, sourceAlbumId),
        this.albumHasStudentUsage(tx, targetAlbumId),
      ]);

      if (sourceHasUsage || targetHasUsage) {
        throw new Error('No puedes mover figuritas porque uno de los álbumes ya tiene progreso de estudiantes');
      }

      const cardsToMove = await tx
        .select({
          id: collectibleCards.id,
          name: collectibleCards.name,
          slotNumber: collectibleCards.slotNumber,
        })
        .from(collectibleCards)
        .where(and(
          eq(collectibleCards.albumId, sourceAlbumId),
          inArray(collectibleCards.id, uniqueCardIds)
        ))
        .orderBy(asc(collectibleCards.slotNumber), asc(collectibleCards.createdAt));

      if (cardsToMove.length !== uniqueCardIds.length) {
        throw new Error('Hay figuritas inválidas para mover');
      }

      const [maxSlotRow] = await tx
        .select({ max: sql<number>`COALESCE(MAX(slot_number), 0)` })
        .from(collectibleCards)
        .where(eq(collectibleCards.albumId, targetAlbumId));

      let nextSlotNumber = (maxSlotRow?.max || 0) + 1;
      const now = new Date();

      for (const card of cardsToMove) {
        await tx
          .update(collectibleCards)
          .set({
            albumId: targetAlbumId,
            slotNumber: nextSlotNumber,
            updatedAt: now,
          })
          .where(eq(collectibleCards.id, card.id));

        nextSlotNumber += 1;
      }

      await this.resequenceAlbumCards(tx, sourceAlbumId);

      await tx
        .update(collectibleAlbums)
        .set({ updatedAt: now })
        .where(inArray(collectibleAlbums.id, [sourceAlbumId, targetAlbumId]));

      return {
        sourceAlbumId,
        sourceAlbumName: sourceAlbum.name,
        targetAlbumId,
        targetAlbumName: targetAlbum.name,
        movedCount: cardsToMove.length,
      };
    });
  }

  // ==================== CARTAS ====================

  async createCard(data: {
    albumId: string;
    name: string;
    description?: string;
    imageUrl?: string;
    icon?: string;
    rarity?: CardRarity;
    slotNumber?: number;
  }) {
    const now = new Date();
    const card = {
      id: uuidv4(),
      albumId: data.albumId,
      name: data.name,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      icon: data.icon || null,
      rarity: data.rarity || 'COMMON' as CardRarity,
      slotNumber: 0,
      isShiny: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.transaction(async (tx) => {
      const [maxSlot] = await tx
        .select({ max: sql<number>`COALESCE(MAX(slot_number), 0)` })
        .from(collectibleCards)
        .where(eq(collectibleCards.albumId, data.albumId));
      const last = Number(maxSlot?.max || 0);
      // Sin casilla: al final. Con casilla (p. ej. "Deshacer" de un borrado): se inserta ahí y
      // las siguientes se corren una posición.
      if (data.slotNumber === undefined || data.slotNumber > last) {
        card.slotNumber = last + 1;
      } else {
        card.slotNumber = Math.max(1, data.slotNumber);
        await tx
          .update(collectibleCards)
          .set({ slotNumber: sql`${collectibleCards.slotNumber} + 1` })
          .where(and(eq(collectibleCards.albumId, data.albumId), sql`${collectibleCards.slotNumber} >= ${card.slotNumber}`));
      }
      await tx.insert(collectibleCards).values(card);
    });
    return card;
  }

  async createManyCards(albumId: string, cards: Array<{
    name: string;
    description?: string;
    imageUrl?: string;
    icon?: string;
    rarity?: CardRarity;
  }>) {
    const now = new Date();
    // Continúa la numeración: antes empezaba en 1 y duplicaba casillas al añadir a un álbum con figuritas.
    const [maxSlot] = await db
      .select({ max: sql<number>`COALESCE(MAX(slot_number), 0)` })
      .from(collectibleCards)
      .where(eq(collectibleCards.albumId, albumId));
    const start = Number(maxSlot?.max || 0);
    const cardsToInsert = cards.map((card, index) => ({
      id: uuidv4(),
      albumId,
      name: card.name,
      description: card.description || null,
      imageUrl: card.imageUrl || null,
      icon: card.icon || null,
      rarity: card.rarity || 'COMMON' as CardRarity,
      slotNumber: start + index + 1,
      isShiny: false,
      createdAt: now,
      updatedAt: now,
    }));

    await db.insert(collectibleCards).values(cardsToInsert);
    return cardsToInsert;
  }

  async updateCard(cardId: string, data: Partial<{
    name: string;
    description: string | null;
    imageUrl: string | null;
    icon: string | null;
    rarity: CardRarity;
    slotNumber: number;
  }>) {
    await db
      .update(collectibleCards)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(collectibleCards.id, cardId));

    const [card] = await db
      .select()
      .from(collectibleCards)
      .where(eq(collectibleCards.id, cardId));
    
    return card;
  }

  // Solo se borra si ningún estudiante lo tiene (no se quitan figuritas ya pagadas). Las casillas
  // posteriores se corren para no dejar huecos.
  async deleteCard(cardId: string): Promise<{ deleted: boolean; owners: number }> {
    return db.transaction(async (tx) => {
      const [card] = await tx.select().from(collectibleCards).where(eq(collectibleCards.id, cardId)).for('update');
      if (!card) return { deleted: false, owners: 0 };
      const [{ owners }] = await tx
        .select({ owners: sql<number>`COUNT(DISTINCT ${studentCollectibles.studentProfileId})` })
        .from(studentCollectibles)
        .where(eq(studentCollectibles.cardId, cardId));
      if (Number(owners) > 0) return { deleted: false, owners: Number(owners) };
      await tx.delete(collectibleCards).where(eq(collectibleCards.id, cardId));
      await tx
        .update(collectibleCards)
        .set({ slotNumber: sql`${collectibleCards.slotNumber} - 1` })
        .where(and(eq(collectibleCards.albumId, card.albumId), sql`${collectibleCards.slotNumber} > ${card.slotNumber}`));
      return { deleted: true, owners: 0 };
    });
  }

  /**
   * La caja de la clase para el profe (los alumnos no ven quién dona): lo que queda, lo donado y lo tomado, y los
   * últimos 100 movimientos con nombres.
   */
  async getBoxLog(albumId: string) {
    const rows = await db
      .select({
        id: collectibleBoxItems.id,
        slotNumber: collectibleCards.slotNumber,
        cardName: collectibleCards.name,
        donorId: collectibleBoxItems.donorProfileId,
        donatedAt: collectibleBoxItems.donatedAt,
        takerId: collectibleBoxItems.takerProfileId,
        takenAt: collectibleBoxItems.takenAt,
      })
      .from(collectibleBoxItems)
      .innerJoin(collectibleCards, eq(collectibleCards.id, collectibleBoxItems.cardId))
      .where(eq(collectibleBoxItems.albumId, albumId))
      .orderBy(desc(sql`COALESCE(${collectibleBoxItems.takenAt}, ${collectibleBoxItems.donatedAt})`));
    const ids = [...new Set(rows.flatMap((row) => [row.donorId, row.takerId]).filter((id): id is string => !!id))];
    const people = ids.length
      ? await db.select({ id: studentProfiles.id, firstName: users.firstName, lastName: users.lastName, displayName: studentProfiles.displayName, characterName: studentProfiles.characterName })
        .from(studentProfiles)
        .leftJoin(users, eq(users.id, studentProfiles.userId))
        .where(inArray(studentProfiles.id, ids))
      : [];
    const nameOf = new Map(people.map((p) => [p.id, [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.displayName || p.characterName || 'Estudiante']));
    return {
      inBox: rows.filter((row) => !row.takerId).length,
      donated: rows.length,
      taken: rows.filter((row) => row.takerId).length,
      items: rows.slice(0, 100).map((row) => ({
        id: row.id,
        card: { slotNumber: row.slotNumber, name: row.cardName },
        donor: nameOf.get(row.donorId) ?? 'Estudiante',
        donatedAt: row.donatedAt,
        taker: row.takerId ? nameOf.get(row.takerId) ?? 'Estudiante' : null,
        takenAt: row.takenAt,
      })),
    };
  }

  // Cuántos estudiantes tienen cada figurita del álbum (para avisar antes de borrar).
  async getCardOwnerCounts(albumId: string) {
    const rows = await db
      .select({
        cardId: studentCollectibles.cardId,
        owners: sql<number>`COUNT(DISTINCT ${studentCollectibles.studentProfileId})`,
      })
      .from(studentCollectibles)
      .innerJoin(collectibleCards, eq(studentCollectibles.cardId, collectibleCards.id))
      .where(eq(collectibleCards.albumId, albumId))
      .groupBy(studentCollectibles.cardId);
    return rows.map((row) => ({ cardId: row.cardId, owners: Number(row.owners) }));
  }

  // ==================== COLECCIÓN DE UN ESTUDIANTE (VISTA PROFESOR) ====================

  async getStudentCollection(studentProfileId: string, albumId: string) {
    const album = await this.getAlbumById(albumId);
    if (!album) return null;

    const collected = await db
      .select({
        cardId: studentCollectibles.cardId,
        quantity: studentCollectibles.quantity,
        isShiny: studentCollectibles.isShiny,
        obtainedAt: studentCollectibles.obtainedAt,
      })
      .from(studentCollectibles)
      .innerJoin(collectibleCards, eq(studentCollectibles.cardId, collectibleCards.id))
      .where(and(
        eq(studentCollectibles.studentProfileId, studentProfileId),
        eq(collectibleCards.albumId, albumId)
      ));

    // Agrupar por cardId (normal y shiny separados)
    const collectedMap = new Map<string, { quantity: number; isShiny: boolean; obtainedAt: Date }[]>();
    for (const item of collected) {
      const existing = collectedMap.get(item.cardId) || [];
      existing.push({ quantity: item.quantity, isShiny: item.isShiny, obtainedAt: item.obtainedAt });
      collectedMap.set(item.cardId, existing);
    }

    const cardsWithStatus = album.cards.map(card => ({
      ...card,
      collected: collectedMap.get(card.id) || [],
      hasNormal: collected.some(c => c.cardId === card.id && !c.isShiny),
      hasShiny: collected.some(c => c.cardId === card.id && c.isShiny),
    }));

    // Normal o brillante: cualquier copia cuenta como tener la figurita (igual que al completar).
    const uniqueCollected = new Set(collected.map(c => c.cardId)).size;
    const progress = album.totalCards > 0 ? (uniqueCollected / album.totalCards) * 100 : 0;

    // Verificar si está completado
    const [completed] = await db
      .select()
      .from(completedAlbums)
      .where(and(
        eq(completedAlbums.studentProfileId, studentProfileId),
        eq(completedAlbums.albumId, albumId)
      ));

    return {
      album,
      cards: cardsWithStatus,
      progress: Math.round(progress * 100) / 100,
      uniqueCollected,
      totalCards: album.totalCards,
      isCompleted: !!completed,
      completedAt: completed?.completedAt,
    };
  }

  // ==================== PROGRESO DE CLASE (VISTA PROFESOR) ====================

  async getClassroomProgress(classroomId: string, albumId: string) {
    const album = await this.getAlbumById(albumId);
    if (!album) return null;
    if (album.classroomId !== classroomId) return null;

    // Obtener todos los estudiantes de la clase
    const students = await db
      .select({
        id: studentProfiles.id,
        displayName: studentProfiles.displayName,
        characterName: studentProfiles.characterName,
      })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true)
      ));

    const totalCards = album.totalCards || album.cards.length || 0;

    const buildResponse = (studentsProgress: Array<{
      studentId: string;
      studentName: string;
      progress: number;
      uniqueCollected: number;
      isCompleted: boolean;
      completedAt?: Date | null;
      previewCards: Array<{
        cardId: string;
        name: string;
        imageUrl: string | null;
        rarity: CardRarity;
        slotNumber: number;
        hasShiny: boolean;
      }>;
    }>) => {
      studentsProgress.sort((a, b) => b.progress - a.progress);

      const completedCount = studentsProgress.filter(s => s.isCompleted).length;
      const avgProgress = studentsProgress.length > 0
        ? studentsProgress.reduce((sum, s) => sum + s.progress, 0) / studentsProgress.length
        : 0;

      return {
        album,
        students: studentsProgress,
        totalStudents: students.length,
        completedCount,
        averageProgress: Math.round(avgProgress * 100) / 100,
      };
    };

    if (students.length === 0) {
      return buildResponse([]);
    }

    const emptyStudentsProgress = students.map((student) => ({
      studentId: student.id,
      studentName: student.displayName || student.characterName || 'Sin nombre',
      progress: 0,
      uniqueCollected: 0,
      isCompleted: false,
      completedAt: null,
      previewCards: [],
    }));

    try {
      const studentIds = students.map(student => student.id);

      let collectedRows: Array<{
        studentProfileId: string;
        cardId: string;
        isShiny: boolean;
        cardName: string;
        cardImageUrl: string | null;
        cardRarity: CardRarity;
        slotNumber: number;
      }> = [];

      try {
        collectedRows = await db
          .select({
            studentProfileId: studentCollectibles.studentProfileId,
            cardId: studentCollectibles.cardId,
            isShiny: studentCollectibles.isShiny,
            cardName: collectibleCards.name,
            cardImageUrl: collectibleCards.imageUrl,
            cardRarity: collectibleCards.rarity,
            slotNumber: collectibleCards.slotNumber,
          })
          .from(studentCollectibles)
          .innerJoin(collectibleCards, eq(studentCollectibles.cardId, collectibleCards.id))
          .where(and(
            inArray(studentCollectibles.studentProfileId, studentIds),
            eq(collectibleCards.albumId, albumId)
          ))
          .orderBy(asc(collectibleCards.slotNumber), asc(studentCollectibles.obtainedAt));
      } catch (error) {
        const dbError = error as {
          code?: string;
          errno?: number;
          message?: string;
          sqlMessage?: string;
        };
        const errorDetails = `${dbError.message || ''} ${dbError.sqlMessage || ''}`;
        const isSchemaIssue = dbError.code === 'ER_NO_SUCH_TABLE'
          || dbError.code === 'ER_BAD_FIELD_ERROR'
          || /student_collectibles|collectible_cards/i.test(errorDetails);

        logger.error('Error al consultar cartas recolectadas para progreso de álbum', {
          classroomId,
          albumId,
          studentCount: students.length,
          error: dbError.message,
          code: dbError.code,
          errno: dbError.errno,
          sqlMessage: dbError.sqlMessage,
        });

        if (!isSchemaIssue) {
          throw error;
        }
      }

      let completedRows: Array<{
        studentProfileId: string;
        completedAt: Date;
      }> = [];

      try {
        completedRows = await db
          .select({
            studentProfileId: completedAlbums.studentProfileId,
            completedAt: completedAlbums.completedAt,
          })
          .from(completedAlbums)
          .where(and(
            inArray(completedAlbums.studentProfileId, studentIds),
            eq(completedAlbums.albumId, albumId)
          ));
      } catch (error) {
        const dbError = error as {
          code?: string;
          errno?: number;
          message?: string;
          sqlMessage?: string;
        };
        const errorDetails = `${dbError.message || ''} ${dbError.sqlMessage || ''}`;
        const isSchemaIssue = dbError.code === 'ER_NO_SUCH_TABLE'
          || dbError.code === 'ER_BAD_FIELD_ERROR'
          || /completed_albums/i.test(errorDetails);

        logger.error('Error al consultar álbumes completados para progreso de álbum', {
          classroomId,
          albumId,
          studentCount: students.length,
          error: dbError.message,
          code: dbError.code,
          errno: dbError.errno,
          sqlMessage: dbError.sqlMessage,
        });

        if (!isSchemaIssue) {
          throw error;
        }
      }

      const uniqueCollectedByStudent = new Map<string, Set<string>>();
      const previewCardsByStudent = new Map<string, Map<string, {
        cardId: string;
        name: string;
        imageUrl: string | null;
        rarity: CardRarity;
        slotNumber: number;
        hasShiny: boolean;
      }>>();

      for (const row of collectedRows) {
        const existingPreviewCards = previewCardsByStudent.get(row.studentProfileId) || new Map<string, {
          cardId: string;
          name: string;
          imageUrl: string | null;
          rarity: CardRarity;
          slotNumber: number;
          hasShiny: boolean;
        }>();
        const existingPreview = existingPreviewCards.get(row.cardId);

        existingPreviewCards.set(row.cardId, {
          cardId: row.cardId,
          name: row.cardName,
          imageUrl: row.cardImageUrl,
          rarity: row.cardRarity,
          slotNumber: row.slotNumber,
          hasShiny: existingPreview?.hasShiny || row.isShiny,
        });

        previewCardsByStudent.set(row.studentProfileId, existingPreviewCards);

        const existing = uniqueCollectedByStudent.get(row.studentProfileId) || new Set<string>();
        existing.add(row.cardId);
        uniqueCollectedByStudent.set(row.studentProfileId, existing);
      }

      const completedByStudent = new Map(
        completedRows.map((row) => [row.studentProfileId, row.completedAt] as const)
      );

      const studentsProgress = students.map((student) => {
        const uniqueCollected = uniqueCollectedByStudent.get(student.id)?.size || 0;
        const progress = totalCards > 0
          ? Math.round(((uniqueCollected / totalCards) * 100) * 100) / 100
          : 0;
        const completedAt = completedByStudent.get(student.id) || null;
        const previewCards = Array.from(previewCardsByStudent.get(student.id)?.values() || [])
          .sort((a, b) => a.slotNumber - b.slotNumber)
          .slice(0, 4);

        return {
          studentId: student.id,
          studentName: student.displayName || student.characterName || 'Sin nombre',
          progress,
          uniqueCollected,
          isCompleted: !!completedAt,
          completedAt,
          previewCards,
        };
      });

      return buildResponse(studentsProgress);
    } catch (error) {
      const dbError = error as {
        code?: string;
        errno?: number;
        message?: string;
        sqlMessage?: string;
      };
      const errorDetails = `${dbError.message || ''} ${dbError.sqlMessage || ''}`;
      const isSchemaIssue = dbError.code === 'ER_NO_SUCH_TABLE'
        || dbError.code === 'ER_BAD_FIELD_ERROR'
        || /completed_albums|student_collectibles|collectible_cards/i.test(errorDetails);

      logger.error('Error al calcular progreso de álbum de coleccionables', {
        classroomId,
        albumId,
        studentCount: students.length,
        error: dbError.message,
        code: dbError.code,
        errno: dbError.errno,
        sqlMessage: dbError.sqlMessage,
      });

      if (isSchemaIssue) {
        return buildResponse(emptyStudentsProgress);
      }

      throw error;
    }
  }

  // ==================== GENERACIÓN CON IA ====================

  async generateAlbumWithAI(request: GenerateAlbumRequest): Promise<GeneratedAlbum> {
    const ai = this.getAI();

    // Calcular distribución de rarezas
    let rarityDist: Record<CardRarity, number>;
    if (request.rarityDistribution === 'auto' || !request.rarityDistribution) {
      rarityDist = this.calculateAutoRarityDistribution(request.cardCount);
    } else {
      rarityDist = {
        COMMON: request.rarityDistribution.common,
        UNCOMMON: request.rarityDistribution.uncommon,
        RARE: request.rarityDistribution.rare,
        EPIC: request.rarityDistribution.epic,
        LEGENDARY: request.rarityDistribution.legendary,
      };
    }

    const prompt = `Eres un generador de contenido educativo para un álbum de cromos coleccionables.

Genera un álbum de cromos sobre el tema: "${request.theme}"

Necesito exactamente ${request.cardCount} cromos con la siguiente distribución de rarezas:
- Común (COMMON): ${rarityDist.COMMON} cromos
- Poco común (UNCOMMON): ${rarityDist.UNCOMMON} cromos
- Raro (RARE): ${rarityDist.RARE} cromos
- Épico (EPIC): ${rarityDist.EPIC} cromos
- Legendario (LEGENDARY): ${rarityDist.LEGENDARY} cromos

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "name": "Nombre del álbum",
  "description": "Descripción breve del álbum (1-2 oraciones)",
  "cards": [
    {
      "name": "Nombre del cromo",
      "description": "Descripción educativa breve (1 oración)",
      "icon": "un solo emoji a color que represente al cromo (no símbolos de texto como ☿ o ♃)",
      "rarity": "COMMON|UNCOMMON|RARE|EPIC|LEGENDARY"
    }
  ]
}

Los cromos legendarios y épicos deben ser los más especiales/importantes del tema.
Los nombres deben ser concisos (2-4 palabras máximo).
Cada cromo debe tener en "icon" un emoji a color distinto y reconocible (por ejemplo 🪐 🌕 ☄️), nunca un símbolo de texto.
Las descripciones deben ser educativas y apropiadas para estudiantes.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: prompt,
      });

      const text = response.text || '';
      
      // Extraer JSON de la respuesta
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se pudo extraer JSON de la respuesta');
      }

      const parsed = JSON.parse(jsonMatch[0]) as GeneratedAlbum;
      
      return parsed;
    } catch (error) {
      console.error('Error generando álbum con IA:', error);
      throw new Error('Error al generar contenido con IA');
    }
  }

  async generateCardWithAI(prompt: string, rarity: CardRarity = 'COMMON'): Promise<GeneratedCard> {
    const ai = this.getAI();

    const aiPrompt = `Genera un cromo coleccionable basado en: "${prompt}"

Responde ÚNICAMENTE con un JSON válido:
{
  "name": "Nombre corto (2-4 palabras)",
  "description": "Descripción educativa breve (1 oración)",
  "icon": "un solo emoji a color que represente al cromo (no símbolos de texto como ☿ o ♃)",
  "rarity": "${rarity}"
}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: aiPrompt,
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se pudo extraer JSON');
      }

      return JSON.parse(jsonMatch[0]) as GeneratedCard;
    } catch (error) {
      console.error('Error generando carta con IA:', error);
      throw new Error('Error al generar carta');
    }
  }

  private calculateAutoRarityDistribution(total: number): Record<CardRarity, number> {
    // Distribución automática basada en probabilidades
    const dist: Record<CardRarity, number> = {
      COMMON: 0,
      UNCOMMON: 0,
      RARE: 0,
      EPIC: 0,
      LEGENDARY: 0,
    };

    // Al menos 1 legendario si hay 10+ cartas
    if (total >= 10) {
      dist.LEGENDARY = 1;
      total -= 1;
    }

    // Al menos 1-2 épicos si hay 8+ cartas
    if (total >= 8) {
      dist.EPIC = Math.min(2, Math.floor(total * 0.1));
      total -= dist.EPIC;
    }

    // ~15% raros
    dist.RARE = Math.max(1, Math.floor(total * 0.15));
    total -= dist.RARE;

    // ~30% poco comunes
    dist.UNCOMMON = Math.max(1, Math.floor(total * 0.35));
    total -= dist.UNCOMMON;

    // El resto comunes
    dist.COMMON = Math.max(1, total);

    return dist;
  }
}

export const collectibleService = new CollectibleService();
