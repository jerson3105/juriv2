import api from './api';

// ==================== TYPES ====================

export type CardRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type ImageStyle = 'CARTOON' | 'REALISTIC' | 'PIXEL_ART' | 'ANIME' | 'WATERCOLOR' | 'MINIMALIST';
/** Nivel de precio del álbum sobre el oro semanal de la clase: la mitad, normal o el doble. */
export type CollectiblePriceLevel = 'LOW' | 'NORMAL' | 'HIGH';

/** El precio que calcula el servidor (coleccionables v2): sobre, límite diario y lo que cuesta completarlo. */
export interface AlbumPricing {
  weeklyGold: number;
  young: boolean;
  packCards: number;
  packPrice: number;
  dailyPacks: number;
  duplicatePercent: number;
  welcomeCards: number;
  completeCost: number;
  completeWeeks: number;
}

export interface PricingPreview {
  weeklyGold: number;
  young: boolean;
  levels: Record<CollectiblePriceLevel, AlbumPricing>;
}

export interface CollectibleAlbum {
  id: string;
  classroomId: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  theme: string | null;
  imageStyle: ImageStyle | null;
  priceLevel: CollectiblePriceLevel;
  rewardHp: number;
  rewardGp: number;
  rewardBadgeId: string | null;
  allowTrades: boolean;
  isActive: boolean;
  totalCards?: number;
  /** Solo en la lista y el detalle del profe. */
  pricing?: AlbumPricing;
  createdAt: string;
  updatedAt: string;
}

export interface CollectibleCard {
  id: string;
  albumId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  icon: string | null;
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
  previewCards: StudentProgressPreviewCard[];
}

export interface StudentProgressPreviewCard {
  cardId: string;
  name: string;
  imageUrl: string | null;
  rarity: CardRarity;
  slotNumber: number;
  hasShiny: boolean;
}

export interface ClassroomProgress {
  album: AlbumWithCards;
  students: StudentProgress[];
  totalStudents: number;
  completedCount: number;
  averageProgress: number;
}

// ==================== ALUMNO (coleccionables v2) ====================

/** Una figurita del álbum del alumno. Las que le faltan llegan sin dibujo, emoji ni dato (solo número, nombre y rareza). */
export interface StickerView {
  id: string;
  slotNumber: number;
  name: string;
  rarity: CardRarity;
  owned: boolean;
  icon: string | null;
  imageUrl: string | null;
  description: string | null;
  /** Copias que tiene (normales y brillantes). */
  count: number;
  shiny: boolean;
  /** La consiguió en los últimos 7 días. */
  isNew: boolean;
}

export interface AlbumRewards {
  gp: number;
  hp: number;
  badge: { name: string; icon: string; customImage: string | null } | null;
}

export interface StudentAlbumView {
  id: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  /** false: archivado (se mira, ya no hay sobres). */
  isActive: boolean;
  totalCards: number;
  owned: number;
  missing: number;
  /** Copias de más (las que se podrán cambiar). */
  duplicates: number;
  completedAt: string | null;
  /** Sobre de bienvenida gratis (null si ya lo abrió o no aplica). */
  welcome: { cards: number } | null;
  /** El sobre de hoy: figuritas que trae y precio (null con el álbum completo o archivado). */
  pack: { cards: number; price: number } | null;
  rewards: AlbumRewards;
  cards: StickerView[];
}

export interface AlbumCompletion {
  albumId: string;
  albumName: string;
  rewards: AlbumRewards;
}

export interface StudentCollectiblesView {
  profile: { id: string; gold: number; pendingGold: number };
  classroomName: string;
  /** Inicial a 2.º: sobre de 3, uno al día y sin repetidas. */
  young: boolean;
  kiosk: { open: boolean; reason: 'SHOP_CLOSED' | 'RESTING' | null };
  daily: { limit: number; used: number; left: number };
  albums: StudentAlbumView[];
  /** Álbumes que se completaron al mirar (la última figurita llegó por la Historia). */
  justCompleted: AlbumCompletion[];
}

export interface OpenPackResult {
  cards: StickerView[];
  price?: number;
  newBalance?: number;
  dailyLeft?: number;
  completed: AlbumCompletion | null;
}

export interface GeneratedCard {
  name: string;
  description: string;
  rarity: CardRarity;
  icon?: string;
  imageUrl?: string;
}

export interface GeneratedAlbum {
  name: string;
  description: string;
  cards: GeneratedCard[];
}

export interface CreateAlbumData {
  name: string;
  description?: string | null;
  coverImage?: string | null;
  theme?: string;
  imageStyle?: ImageStyle;
  priceLevel?: CollectiblePriceLevel;
  rewardHp?: number;
  rewardGp?: number;
  rewardBadgeId?: string | null;
  allowTrades?: boolean;
}

export interface CreateCardData {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  icon?: string | null;
  rarity?: CardRarity;
  slotNumber?: number;
}

export interface CardOwners {
  cardId: string;
  owners: number;
}

// URL de imágenes de figuritas/portadas: las subidas viven en /api/uploads/collectibles (junto a la API);
// las antiguas pueden ser URLs externas y se usan tal cual.
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');
const UPLOADED_IMAGE = /^\/api\/uploads\/collectibles\/[\w.-]+\.(png|jpe?g|gif|webp)$/i;
/**
 * Con `variant`, una subida se pide como miniatura WebP del tamaño que se muestra (sm: cartas del álbum y la mesa;
 * md: cartas grandes, detalle y portadas). Sin variante, el original (el profe al editar).
 */
export const collectibleImageUrl = (path: string, variant?: 'sm' | 'md') => {
  if (variant && UPLOADED_IMAGE.test(path)) return `${API_ORIGIN}/api/collectible-img/${variant}?src=${encodeURIComponent(path)}`;
  return path.startsWith('/api/') ? `${API_ORIGIN}${path}` : path;
};

export interface ImportableAlbumSource {
  classroomId: string;
  classroomName: string;
  albums: CollectibleAlbum[];
}

export interface CloneAlbumResult {
  sourceAlbumId: string;
  sourceAlbumName: string;
  totalCards: number;
  skippedRewardBadge: boolean;
  created: Array<{
    classroomId: string;
    classroomName: string;
    albumId: string;
  }>;
}

export interface MoveCardsResult {
  sourceAlbumId: string;
  sourceAlbumName: string;
  targetAlbumId: string;
  targetAlbumName: string;
  movedCount: number;
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

  // Los tres niveles de precio con el oro de la clase, para un álbum de `cards` figuritas.
  getPricingPreview: async (classroomId: string, cards: number): Promise<PricingPreview> => {
    const response = await api.get(`/collectibles/classroom/${classroomId}/pricing`, { params: { cards } });
    return response.data.data;
  },

  getImportableAlbums: async (classroomId: string): Promise<ImportableAlbumSource[]> => {
    const response = await api.get(`/collectibles/classroom/${classroomId}/importable-albums`);
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

  cloneAlbum: async (albumId: string, targetClassroomIds: string[]): Promise<CloneAlbumResult> => {
    const response = await api.post(`/collectibles/albums/${albumId}/clone`, { targetClassroomIds });
    return response.data;
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

  moveCards: async (albumId: string, targetAlbumId: string, cardIds: string[]): Promise<MoveCardsResult> => {
    const response = await api.post(`/collectibles/albums/${albumId}/cards/move`, {
      targetAlbumId,
      cardIds,
    });
    return response.data;
  },

  updateCard: async (cardId: string, data: Partial<CreateCardData>): Promise<CollectibleCard> => {
    const response = await api.put(`/collectibles/cards/${cardId}`, data);
    return response.data;
  },

  deleteCard: async (cardId: string): Promise<void> => {
    await api.delete(`/collectibles/cards/${cardId}`);
  },

  // Cuántos estudiantes tienen cada figurita (una figurita con dueños no se puede borrar)
  getCardOwners: async (albumId: string): Promise<CardOwners[]> => {
    const response = await api.get(`/collectibles/albums/${albumId}/card-owners`);
    return response.data;
  },

  // Subir imagen de figurita o portada
  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/collectibles/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data.imageUrl;
  },

  // ==================== ALUMNO ====================

  // Sus álbumes con sus figuritas, el sobre del día y el de bienvenida (tz: getTimezoneOffset, para «hoy»).
  getStudentView: async (profileId: string): Promise<StudentCollectiblesView> => {
    const response = await api.get(`/collectibles/student/${profileId}/view`, { params: { tz: new Date().getTimezoneOffset() } });
    return response.data.data;
  },

  // Abre el sobre del álbum: el servidor cobra y sortea.
  openPack: async (profileId: string, albumId: string): Promise<OpenPackResult> => {
    const response = await api.post(`/collectibles/student/${profileId}/albums/${albumId}/open`, { tz: new Date().getTimezoneOffset() });
    return response.data.data;
  },

  // El sobre de bienvenida: gratis, uno por álbum.
  openWelcome: async (profileId: string, albumId: string): Promise<OpenPackResult> => {
    const response = await api.post(`/collectibles/student/${profileId}/albums/${albumId}/welcome`);
    return response.data.data;
  },

  // ==================== COLECCIÓN DE UN ESTUDIANTE (PROFESOR) ====================

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

export default collectibleApi;
