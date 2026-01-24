import api from './api';

// ==================== TYPES ====================

export type CardRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type PackType = 'SINGLE' | 'PACK_5' | 'PACK_10';
export type ImageStyle = 'CARTOON' | 'REALISTIC' | 'PIXEL_ART' | 'ANIME' | 'WATERCOLOR' | 'MINIMALIST';

export interface CollectibleAlbum {
  id: string;
  classroomId: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  theme: string | null;
  imageStyle: ImageStyle | null;
  singlePackPrice: number;
  fivePackPrice: number;
  tenPackPrice: number;
  rewardXp: number;
  rewardHp: number;
  rewardGp: number;
  rewardBadgeId: string | null;
  allowTrades: boolean;
  isActive: boolean;
  totalCards?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectibleCard {
  id: string;
  albumId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  rarity: CardRarity;
  slotNumber: number;
  isShiny: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlbumWithCards extends CollectibleAlbum {
  cards: CollectibleCard[];
}

export interface StudentCollectible {
  quantity: number;
  isShiny: boolean;
  obtainedAt: string;
}

export interface CardWithStatus extends CollectibleCard {
  collected: StudentCollectible[];
  hasNormal: boolean;
  hasShiny: boolean;
}

export interface StudentCollection {
  album: AlbumWithCards;
  cards: CardWithStatus[];
  progress: number;
  uniqueCollected: number;
  totalCards: number;
  isCompleted: boolean;
  completedAt?: string;
}

export interface StudentProgress {
  studentId: string;
  studentName: string;
  progress: number;
  uniqueCollected: number;
  isCompleted: boolean;
  completedAt?: string;
}

export interface ClassroomProgress {
  album: AlbumWithCards;
  students: StudentProgress[];
  totalStudents: number;
  completedCount: number;
  averageProgress: number;
}

export interface PurchaseResult {
  purchase: {
    id: string;
    studentProfileId: string;
    albumId: string;
    packType: PackType;
    gpSpent: number;
    cardsObtained: Array<{
      cardId: string;
      cardName: string;
      rarity: string;
      isShiny: boolean;
      isNew: boolean;
    }>;
    purchasedAt: string;
  };
  cards: Array<{
    cardId: string;
    cardName: string;
    rarity: string;
    imageUrl: string | null;
    isShiny: boolean;
    isNew: boolean;
  }>;
  newGpBalance: number;
}

export interface GeneratedCard {
  name: string;
  description: string;
  rarity: CardRarity;
  imageUrl?: string;
}

export interface GeneratedAlbum {
  name: string;
  description: string;
  cards: GeneratedCard[];
}

export interface CreateAlbumData {
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
  rewardBadgeId?: string | null;
  allowTrades?: boolean;
}

export interface CreateCardData {
  name: string;
  description?: string;
  imageUrl?: string;
  rarity?: CardRarity;
  slotNumber?: number;
}

export interface GenerateAlbumRequest {
  theme: string;
  cardCount: number;
  imageStyle?: ImageStyle;
  rarityDistribution?: 'auto' | {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
  };
}

// ==================== API ====================

export const collectibleApi = {
  // ==================== ÁLBUMES ====================

  createAlbum: async (classroomId: string, data: CreateAlbumData): Promise<CollectibleAlbum> => {
    const response = await api.post(`/collectibles/classroom/${classroomId}/albums`, data);
    return response.data;
  },

  getAlbums: async (classroomId: string): Promise<CollectibleAlbum[]> => {
    const response = await api.get(`/collectibles/classroom/${classroomId}/albums`);
    return response.data;
  },

  getAlbumById: async (albumId: string): Promise<AlbumWithCards> => {
    const response = await api.get(`/collectibles/albums/${albumId}`);
    return response.data;
  },

  updateAlbum: async (albumId: string, data: Partial<CreateAlbumData & { isActive: boolean }>): Promise<AlbumWithCards> => {
    const response = await api.put(`/collectibles/albums/${albumId}`, data);
    return response.data;
  },

  deleteAlbum: async (albumId: string): Promise<void> => {
    await api.delete(`/collectibles/albums/${albumId}`);
  },

  // ==================== CARTAS ====================

  createCard: async (albumId: string, data: CreateCardData): Promise<CollectibleCard> => {
    const response = await api.post(`/collectibles/albums/${albumId}/cards`, data);
    return response.data;
  },

  createManyCards: async (albumId: string, cards: CreateCardData[]): Promise<CollectibleCard[]> => {
    const response = await api.post(`/collectibles/albums/${albumId}/cards/batch`, { cards });
    return response.data;
  },

  updateCard: async (cardId: string, data: Partial<CreateCardData>): Promise<CollectibleCard> => {
    const response = await api.put(`/collectibles/cards/${cardId}`, data);
    return response.data;
  },

  deleteCard: async (cardId: string): Promise<void> => {
    await api.delete(`/collectibles/cards/${cardId}`);
  },

  // ==================== COMPRAS (ESTUDIANTE) ====================

  purchasePack: async (albumId: string, packType: PackType): Promise<PurchaseResult> => {
    const response = await api.post(`/collectibles/albums/${albumId}/purchase`, { packType });
    return response.data;
  },

  // ==================== COLECCIÓN ====================

  getMyCollection: async (albumId: string): Promise<StudentCollection> => {
    const response = await api.get(`/collectibles/albums/${albumId}/my-collection`);
    return response.data;
  },

  getMyAlbumsProgress: async (classroomId: string): Promise<Array<{
    albumId: string;
    progress: number;
    uniqueCollected: number;
    totalCards: number;
    isCompleted: boolean;
  }>> => {
    const response = await api.get(`/collectibles/classroom/${classroomId}/my-progress`);
    return response.data;
  },

  getStudentCollection: async (albumId: string, studentProfileId: string): Promise<StudentCollection> => {
    const response = await api.get(`/collectibles/albums/${albumId}/student/${studentProfileId}/collection`);
    return response.data;
  },

  // ==================== PROGRESO (PROFESOR) ====================

  getClassroomProgress: async (classroomId: string, albumId: string): Promise<ClassroomProgress> => {
    const response = await api.get(`/collectibles/classroom/${classroomId}/albums/${albumId}/progress`);
    return response.data;
  },

  // ==================== GENERACIÓN CON IA ====================

  generateAlbumWithAI: async (classroomId: string, request: GenerateAlbumRequest): Promise<GeneratedAlbum> => {
    const response = await api.post(`/collectibles/classroom/${classroomId}/generate-album`, request);
    return response.data;
  },

  generateCardWithAI: async (prompt: string, rarity?: CardRarity): Promise<GeneratedCard> => {
    const response = await api.post('/collectibles/generate-card', { prompt, rarity });
    return response.data;
  },
};

// ==================== HELPERS ====================

export const RARITY_CONFIG: Record<CardRarity, { label: string; color: string; bgColor: string; probability: number; icon: string; gradient: string }> = {
  COMMON: { label: 'Común', color: 'text-gray-600', bgColor: 'bg-gray-100', probability: 50, icon: '⚪', gradient: 'from-gray-400 to-gray-500' },
  UNCOMMON: { label: 'Poco común', color: 'text-green-600', bgColor: 'bg-green-100', probability: 30, icon: '🟢', gradient: 'from-green-400 to-emerald-500' },
  RARE: { label: 'Raro', color: 'text-blue-600', bgColor: 'bg-blue-100', probability: 15, icon: '🔵', gradient: 'from-blue-400 to-indigo-500' },
  EPIC: { label: 'Épico', color: 'text-purple-600', bgColor: 'bg-purple-100', probability: 4, icon: '🟣', gradient: 'from-purple-400 to-pink-500' },
  LEGENDARY: { label: 'Legendario', color: 'text-amber-600', bgColor: 'bg-amber-100', probability: 1, icon: '🌟', gradient: 'from-amber-400 to-orange-500' },
};

export const PACK_CONFIG: Record<PackType, { label: string; cards: number; icon: string }> = {
  SINGLE: { label: 'Sobre Simple', cards: 1, icon: '📦' },
  PACK_5: { label: 'Paquete x5', cards: 5, icon: '📦📦' },
  PACK_10: { label: 'Super Paquete x10', cards: 10, icon: '🎁' },
};

export default collectibleApi;
