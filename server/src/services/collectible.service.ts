import { GoogleGenAI } from '@google/genai';
import { db } from '../db/index.js';
import { 
  collectibleAlbums, 
  collectibleCards, 
  studentCollectibles, 
  collectiblePurchases,
  completedAlbums,
  studentProfiles,
  badges,
  classrooms,
  type CardRarity,
  type PackType,
  type ImageStyle,
} from '../db/schema.js';
import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { studentService } from './student.service.js';
import { logger } from '../utils/logger.js';

// Probabilidades de rareza
const RARITY_PROBABILITIES: Record<CardRarity, number> = {
  COMMON: 50,
  UNCOMMON: 30,
  RARE: 15,
  EPIC: 4,
  LEGENDARY: 1,
};

// Probabilidad de obtener versión brillante (shiny)
const SHINY_PROBABILITY = 5; // 5%

// Cantidad de cartas por tipo de paquete
const PACK_SIZES: Record<PackType, number> = {
  SINGLE: 1,
  PACK_5: 5,
  PACK_10: 10,
};

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
      this.ai = new GoogleGenAI({ apiKey });
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

  // ==================== ÁLBUMES ====================

  async createAlbum(data: {
    classroomId: string;
    name: string;
    description?: string;
    coverImage?: string;
    theme?: string;
    imageStyle?: ImageStyle;
    singlePackPrice?: number;
    fivePackPrice?: number;
    tenPackPrice?: number;
    rewardXp?: number;
    rewardHp?: number;
    rewardGp?: number;
    rewardBadgeId?: string;
    allowTrades?: boolean;
  }) {
    const now = new Date();
    const album = {
      id: uuidv4(),
      classroomId: data.classroomId,
      name: data.name,
      description: data.description || null,
      coverImage: data.coverImage || null,
      theme: data.theme || null,
      imageStyle: data.imageStyle || 'CARTOON' as ImageStyle,
      singlePackPrice: data.singlePackPrice ?? 10,
      fivePackPrice: data.fivePackPrice ?? 45,
      tenPackPrice: data.tenPackPrice ?? 80,
      rewardXp: data.rewardXp ?? 0,
      rewardHp: data.rewardHp ?? 0,
      rewardGp: data.rewardGp ?? 0,
      rewardBadgeId: data.rewardBadgeId || null,
      allowTrades: data.allowTrades ?? false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(collectibleAlbums).values(album);
    return album;
  }

  async getAlbumsByClassroom(classroomId: string) {
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
          totalCards: cards[0]?.count || 0,
        };
      })
    );

    return albumsWithCount;
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
    singlePackPrice: number;
    fivePackPrice: number;
    tenPackPrice: number;
    rewardXp: number;
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

    return this.getAlbumById(albumId);
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
      .select({ id: classrooms.id, name: classrooms.name })
      .from(classrooms)
      .where(and(eq(classrooms.teacherId, teacherId), inArray(classrooms.id, uniqueTargetIds)));

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
          singlePackPrice: sourceAlbum.singlePackPrice,
          fivePackPrice: sourceAlbum.fivePackPrice,
          tenPackPrice: sourceAlbum.tenPackPrice,
          rewardXp: sourceAlbum.rewardXp,
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

  async deleteAlbum(albumId: string) {
    // Eliminar en orden: purchases, student_collectibles, cards, completed_albums, album
    await db.delete(collectiblePurchases).where(eq(collectiblePurchases.albumId, albumId));
    
    // Obtener IDs de cartas para eliminar student_collectibles
    const cards = await db
      .select({ id: collectibleCards.id })
      .from(collectibleCards)
      .where(eq(collectibleCards.albumId, albumId));
    
    for (const card of cards) {
      await db.delete(studentCollectibles).where(eq(studentCollectibles.cardId, card.id));
    }
    
    await db.delete(collectibleCards).where(eq(collectibleCards.albumId, albumId));
    await db.delete(completedAlbums).where(eq(completedAlbums.albumId, albumId));
    await db.delete(collectibleAlbums).where(eq(collectibleAlbums.id, albumId));
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
      throw new Error('Selecciona al menos un cromo');
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
      throw new Error('Solo puedes mover cromos entre álbumes de la misma clase');
    }

    return db.transaction(async (tx) => {
      const [sourceHasUsage, targetHasUsage] = await Promise.all([
        this.albumHasStudentUsage(tx, sourceAlbumId),
        this.albumHasStudentUsage(tx, targetAlbumId),
      ]);

      if (sourceHasUsage || targetHasUsage) {
        throw new Error('No puedes mover cromos porque uno de los álbumes ya tiene progreso de estudiantes');
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
        throw new Error('Hay cromos inválidos para mover');
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
    rarity?: CardRarity;
    slotNumber?: number;
  }) {
    // Si no se especifica slot, obtener el siguiente
    let slotNumber = data.slotNumber;
    if (slotNumber === undefined) {
      const [maxSlot] = await db
        .select({ max: sql<number>`COALESCE(MAX(slot_number), 0)` })
        .from(collectibleCards)
        .where(eq(collectibleCards.albumId, data.albumId));
      slotNumber = (maxSlot?.max || 0) + 1;
    }

    const now = new Date();
    const card = {
      id: uuidv4(),
      albumId: data.albumId,
      name: data.name,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      rarity: data.rarity || 'COMMON' as CardRarity,
      slotNumber,
      isShiny: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(collectibleCards).values(card);
    return card;
  }

  async createManyCards(albumId: string, cards: Array<{
    name: string;
    description?: string;
    imageUrl?: string;
    rarity?: CardRarity;
  }>) {
    const now = new Date();
    const cardsToInsert = cards.map((card, index) => ({
      id: uuidv4(),
      albumId,
      name: card.name,
      description: card.description || null,
      imageUrl: card.imageUrl || null,
      rarity: card.rarity || 'COMMON' as CardRarity,
      slotNumber: index + 1,
      isShiny: false,
      createdAt: now,
      updatedAt: now,
    }));

    await db.insert(collectibleCards).values(cardsToInsert);
    return cardsToInsert;
  }

  async updateCard(cardId: string, data: Partial<{
    name: string;
    description: string;
    imageUrl: string;
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

  async deleteCard(cardId: string) {
    await db.delete(studentCollectibles).where(eq(studentCollectibles.cardId, cardId));
    await db.delete(collectibleCards).where(eq(collectibleCards.id, cardId));
  }

  // ==================== COMPRA DE SOBRES ====================

  async purchasePack(studentProfileId: string, albumId: string, packType: PackType) {
    // Obtener álbum y cartas
    const album = await this.getAlbumById(albumId);
    if (!album || !album.isActive) {
      throw new Error('Álbum no disponible');
    }

    const packSize = PACK_SIZES[packType];
    
    // Verificar que hay suficientes cartas
    if (album.totalCards < packSize) {
      throw new Error(`El álbum necesita al menos ${packSize} cromos para este paquete`);
    }

    // Obtener precio
    const price = packType === 'SINGLE' 
      ? album.singlePackPrice 
      : packType === 'PACK_5' 
        ? album.fivePackPrice 
        : album.tenPackPrice;

    // Verificar GP del estudiante
    const [student] = await db
      .select({ gp: studentProfiles.gp })
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));

    if (!student || student.gp < price) {
      throw new Error('No tienes suficiente oro');
    }

    // Seleccionar cartas aleatorias según rareza
    const obtainedCards = this.selectRandomCards(album.cards, packSize);

    // Procesar cada carta obtenida
    const cardsObtained: Array<{
      cardId: string;
      cardName: string;
      rarity: string;
      imageUrl: string | null;
      isShiny: boolean;
      isNew: boolean;
    }> = [];

    const now = new Date();

    for (const card of obtainedCards) {
      // Determinar si es shiny
      const isShiny = Math.random() * 100 < SHINY_PROBABILITY;

      // Verificar si ya tiene esta carta
      const [existing] = await db
        .select()
        .from(studentCollectibles)
        .where(and(
          eq(studentCollectibles.studentProfileId, studentProfileId),
          eq(studentCollectibles.cardId, card.id),
          eq(studentCollectibles.isShiny, isShiny)
        ));

      const isNew = !existing;

      if (existing) {
        // Incrementar cantidad
        await db
          .update(studentCollectibles)
          .set({ 
            quantity: existing.quantity + 1,
            updatedAt: now 
          })
          .where(eq(studentCollectibles.id, existing.id));
      } else {
        // Crear nuevo registro
        await db.insert(studentCollectibles).values({
          id: uuidv4(),
          studentProfileId,
          cardId: card.id,
          quantity: 1,
          isShiny,
          obtainedAt: now,
          updatedAt: now,
        });
      }

      cardsObtained.push({
        cardId: card.id,
        cardName: card.name,
        rarity: card.rarity,
        imageUrl: card.imageUrl,
        isShiny,
        isNew,
      });
    }

    // Descontar GP
    await db
      .update(studentProfiles)
      .set({ gp: student.gp - price })
      .where(eq(studentProfiles.id, studentProfileId));

    // Registrar compra
    const purchase = {
      id: uuidv4(),
      studentProfileId,
      albumId,
      packType,
      gpSpent: price,
      cardsObtained,
      purchasedAt: now,
    };

    await db.insert(collectiblePurchases).values(purchase);

    // Verificar si completó el álbum
    await this.checkAlbumCompletion(studentProfileId, albumId);

    return {
      purchase,
      cards: cardsObtained,
      newGpBalance: student.gp - price,
    };
  }

  private selectRandomCards(cards: typeof collectibleCards.$inferSelect[], count: number) {
    const selected: typeof cards = [];
    
    // Agrupar cartas por rareza
    const cardsByRarity: Record<CardRarity, typeof cards> = {
      COMMON: [],
      UNCOMMON: [],
      RARE: [],
      EPIC: [],
      LEGENDARY: [],
    };
    
    for (const card of cards) {
      cardsByRarity[card.rarity as CardRarity].push(card);
    }
    
    for (let i = 0; i < count; i++) {
      // Seleccionar rareza según probabilidades
      const rarityRoll = Math.random() * 100;
      let cumulative = 0;
      let selectedRarity: CardRarity = 'COMMON';
      
      for (const [rarity, prob] of Object.entries(RARITY_PROBABILITIES)) {
        cumulative += prob;
        if (rarityRoll < cumulative) {
          selectedRarity = rarity as CardRarity;
          break;
        }
      }

      // Obtener cartas de esa rareza
      let eligibleCards = cardsByRarity[selectedRarity];
      
      // Si no hay cartas de esa rareza, buscar en rarezas adyacentes
      if (eligibleCards.length === 0) {
        const rarityOrder: CardRarity[] = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
        const currentIndex = rarityOrder.indexOf(selectedRarity);
        
        // Buscar hacia abajo primero, luego hacia arriba
        for (let offset = 1; offset < rarityOrder.length; offset++) {
          if (currentIndex - offset >= 0 && cardsByRarity[rarityOrder[currentIndex - offset]].length > 0) {
            eligibleCards = cardsByRarity[rarityOrder[currentIndex - offset]];
            break;
          }
          if (currentIndex + offset < rarityOrder.length && cardsByRarity[rarityOrder[currentIndex + offset]].length > 0) {
            eligibleCards = cardsByRarity[rarityOrder[currentIndex + offset]];
            break;
          }
        }
        
        // Fallback: usar todas las cartas
        if (eligibleCards.length === 0) {
          eligibleCards = cards;
        }
      }

      // Seleccionar carta COMPLETAMENTE aleatoria de las elegibles
      // Esto permite repetidos naturalmente
      const randomIndex = Math.floor(Math.random() * eligibleCards.length);
      selected.push(eligibleCards[randomIndex]);
    }

    return selected;
  }

  // ==================== PROGRESO Y COMPLETADO ====================

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

    const uniqueCollected = new Set(collected.filter(c => !c.isShiny).map(c => c.cardId)).size;
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

  async checkAlbumCompletion(studentProfileId: string, albumId: string) {
    const collection = await this.getStudentCollection(studentProfileId, albumId);
    if (!collection || collection.isCompleted) return false;

    // Verificar si tiene todas las cartas (no shiny, al menos 1 de cada una)
    const hasAllCards = collection.uniqueCollected >= collection.totalCards;
    
    if (hasAllCards) {
      const now = new Date();
      const album = collection.album;
      
      // Obtener teacherId del classroom
      const [classroom] = await db
        .select({ teacherId: classrooms.teacherId })
        .from(classrooms)
        .where(eq(classrooms.id, album.classroomId));
      
      const teacherId = classroom?.teacherId || '';
      
      // Registrar completado
      await db.insert(completedAlbums).values({
        id: uuidv4(),
        studentProfileId,
        albumId,
        rewardsGiven: false,
        completedAt: now,
      });

      // Dar recompensas
      const rewardReason = `Álbum completado: ${album.name}`;
      
      if (album.rewardXp > 0) {
        await studentService.updatePoints({
          studentId: studentProfileId,
          pointType: 'XP',
          amount: album.rewardXp,
          reason: rewardReason,
          teacherId,
        });
      }
      if (album.rewardHp > 0) {
        await studentService.updatePoints({
          studentId: studentProfileId,
          pointType: 'HP',
          amount: album.rewardHp,
          reason: rewardReason,
          teacherId,
        });
      }
      if (album.rewardGp > 0) {
        await studentService.updatePoints({
          studentId: studentProfileId,
          pointType: 'GP',
          amount: album.rewardGp,
          reason: rewardReason,
          teacherId,
        });
      }

      // Marcar recompensas como dadas
      await db
        .update(completedAlbums)
        .set({ rewardsGiven: true })
        .where(and(
          eq(completedAlbums.studentProfileId, studentProfileId),
          eq(completedAlbums.albumId, albumId)
        ));

      return true;
    }

    return false;
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
    }));

    try {
      const studentIds = students.map(student => student.id);

      let collectedRows: Array<{
        studentProfileId: string;
        cardId: string;
        isShiny: boolean;
      }> = [];

      try {
        collectedRows = await db
          .select({
            studentProfileId: studentCollectibles.studentProfileId,
            cardId: studentCollectibles.cardId,
            isShiny: studentCollectibles.isShiny,
          })
          .from(studentCollectibles)
          .innerJoin(collectibleCards, eq(studentCollectibles.cardId, collectibleCards.id))
          .where(and(
            inArray(studentCollectibles.studentProfileId, studentIds),
            eq(collectibleCards.albumId, albumId)
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
      for (const row of collectedRows) {
        if (row.isShiny) continue;

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

        return {
          studentId: student.id,
          studentName: student.displayName || student.characterName || 'Sin nombre',
          progress,
          uniqueCollected,
          isCompleted: !!completedAt,
          completedAt,
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

  // ==================== PROGRESO DE ESTUDIANTE (TODOS LOS ÁLBUMES) ====================

  async getStudentAlbumsProgress(studentProfileId: string, classroomId: string) {
    const albums = await this.getAlbumsByClassroom(classroomId);
    
    const albumsWithProgress = await Promise.all(
      albums.filter(a => a.isActive).map(async (album) => {
        const collection = await this.getStudentCollection(studentProfileId, album.id);
        return {
          albumId: album.id,
          progress: collection?.progress || 0,
          uniqueCollected: collection?.uniqueCollected || 0,
          totalCards: album.totalCards || 0,
          isCompleted: collection?.isCompleted || false,
        };
      })
    );

    return albumsWithProgress;
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
      "rarity": "COMMON|UNCOMMON|RARE|EPIC|LEGENDARY"
    }
  ]
}

Los cromos legendarios y épicos deben ser los más especiales/importantes del tema.
Los nombres deben ser concisos (2-4 palabras máximo).
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
