// Instancia común: token en memoria y renovación de la sesión.
import api from './api';

export type AvatarGender = 'MALE' | 'FEMALE';
export type AvatarSlot = 'HEAD' | 'HAIR' | 'EYES' | 'TOP' | 'BOTTOM' | 'LEFT_HAND' | 'RIGHT_HAND' | 'SHOES' | 'BACK' | 'FLAG' | 'BACKGROUND';
export type ItemRarity = 'COMMON' | 'RARE' | 'LEGENDARY';

export interface AvatarItem {
  id: string;
  name: string;
  description?: string;
  gender: AvatarGender;
  slot: AvatarSlot;
  imagePath: string;
  layerOrder: number;
  basePrice: number;
  rarity: ItemRarity;
  isActive: boolean;
}

export interface ClassroomShopItem {
  id: string;
  classroomId: string;
  avatarItemId: string;
  price: number;
  isAvailable: boolean;
  avatarItem: AvatarItem;
}

export interface EquippedItem {
  id: string;
  slot: AvatarSlot;
  equippedAt: string;
  avatarItem: AvatarItem;
}

export interface StudentAvatarData {
  gender: AvatarGender;
  equippedItems: {
    slot: AvatarSlot;
    imagePath: string;
    layerOrder: number;
  }[];
}

// ==================== AGRUPADOR DE ITEMS EQUIPADOS ====================
// Cada mini-avatar pide sus items; en una lista eran N peticiones. Se juntan las pedidas en la
// misma ventana corta y se resuelven con POST /avatars/equipped/batch (máx. 100 por llamada).
type EquippedWaiter = { resolve: (items: EquippedItem[]) => void; reject: (error: unknown) => void };
const EQUIPPED_BATCH_WINDOW_MS = 10;
const EQUIPPED_BATCH_MAX = 100;
let pendingEquipped = new Map<string, EquippedWaiter[]>();
let equippedTimer: ReturnType<typeof setTimeout> | null = null;

const flushEquipped = () => {
  const batch = pendingEquipped;
  pendingEquipped = new Map();
  equippedTimer = null;

  const ids = [...batch.keys()];
  for (let i = 0; i < ids.length; i += EQUIPPED_BATCH_MAX) {
    const chunk = ids.slice(i, i + EQUIPPED_BATCH_MAX);
    api
      .post('/avatars/equipped/batch', { studentProfileIds: chunk })
      .then((response) => {
        const byStudent: Record<string, EquippedItem[]> = response.data.data || {};
        for (const id of chunk) batch.get(id)?.forEach((w) => w.resolve(byStudent[id] || []));
      })
      .catch((error) => {
        for (const id of chunk) batch.get(id)?.forEach((w) => w.reject(error));
      });
  }
};

const loadEquippedItems = (studentProfileId: string): Promise<EquippedItem[]> =>
  new Promise((resolve, reject) => {
    const waiters = pendingEquipped.get(studentProfileId) ?? [];
    waiters.push({ resolve, reject });
    pendingEquipped.set(studentProfileId, waiters);
    if (!equippedTimer) equippedTimer = setTimeout(flushEquipped, EQUIPPED_BATCH_WINDOW_MS);
  });

export const avatarApi = {
  // ==================== ITEMS GLOBALES ====================

  getAllItems: async (gender?: AvatarGender): Promise<AvatarItem[]> => {
    const params = gender ? { gender } : {};
    const response = await api.get('/avatars/items', { params });
    return response.data.data;
  },

  // ==================== TIENDA DE CLASE ====================

  getClassroomShopItems: async (classroomId: string, gender?: AvatarGender): Promise<ClassroomShopItem[]> => {
    const params = gender ? { gender } : {};
    const response = await api.get(`/avatars/classroom/${classroomId}/shop`, { params });
    return response.data.data;
  },

  // Obtener todos los items de la tienda (sin filtro de género) - para el docente
  getClassroomShopItemsAll: async (classroomId: string): Promise<ClassroomShopItem[]> => {
    const response = await api.get(`/avatars/classroom/${classroomId}/shop`);
    return response.data.data;
  },

  addToClassroomShop: async (classroomId: string, avatarItemId: string, price: number): Promise<ClassroomShopItem> => {
    const response = await api.post(`/avatars/classroom/${classroomId}/shop`, { avatarItemId, price });
    return response.data.data;
  },

  removeFromClassroomShop: async (shopItemId: string): Promise<void> => {
    await api.delete(`/avatars/classroom-shop/${shopItemId}`);
  },

  updateClassroomShopItemPrice: async (shopItemId: string, price: number): Promise<ClassroomShopItem> => {
    const response = await api.patch(`/avatars/classroom-shop/${shopItemId}`, { price });
    return response.data.data;
  },

  // ==================== COMPRAS ====================

  purchaseItem: async (studentProfileId: string, classroomId: string, avatarItemId: string) => {
    const response = await api.post('/avatars/purchase', {
      studentProfileId,
      classroomId,
      avatarItemId,
    });
    return response.data.data;
  },

  getStudentPurchases: async (studentProfileId: string) => {
    const response = await api.get(`/avatars/student/${studentProfileId}/purchases`);
    return response.data.data;
  },

  // ==================== EQUIPAR ====================

  equipItem: async (studentProfileId: string, avatarItemId: string): Promise<EquippedItem[]> => {
    const response = await api.post('/avatars/equip', { studentProfileId, avatarItemId });
    return response.data.data;
  },

  unequipItem: async (studentProfileId: string, slot: AvatarSlot): Promise<EquippedItem[]> => {
    const response = await api.post('/avatars/unequip', { studentProfileId, slot });
    return response.data.data;
  },

  // Agrupa las peticiones hechas en el mismo instante (p. ej. una lista de mini-avatares) en
  // una sola llamada al servidor. Misma firma y mismo resultado por alumno que antes.
  getEquippedItems: (studentProfileId: string): Promise<EquippedItem[]> => loadEquippedItems(studentProfileId),

  getStudentAvatarData: async (studentProfileId: string): Promise<StudentAvatarData> => {
    const response = await api.get(`/avatars/student/${studentProfileId}/avatar`);
    return response.data.data;
  },
};

// Constantes útiles
export const SLOT_LABELS: Record<AvatarSlot, string> = {
  HEAD: 'Cabeza',
  HAIR: 'Pelo',
  EYES: 'Ojos',
  TOP: 'Superior',
  BOTTOM: 'Inferior',
  LEFT_HAND: 'Mano Izquierda',
  RIGHT_HAND: 'Mano Derecha',
  SHOES: 'Zapatos',
  BACK: 'Espalda',
  FLAG: 'Bandera',
  BACKGROUND: 'Fondo',
};

// Orden de renderizado (de atrás hacia adelante)
export const SLOT_ORDER: AvatarSlot[] = [
  'BACKGROUND', // Fondo va primero (más atrás)
  'FLAG',
  'BACK',
  'SHOES',
  'BOTTOM',
  'TOP',
  'LEFT_HAND',
  'RIGHT_HAND',
  'EYES',
  'HEAD',
  'HAIR',
];

export const RARITY_COLORS: Record<ItemRarity, string> = {
  COMMON: 'text-gray-600 bg-gray-100',
  RARE: 'text-blue-600 bg-blue-100',
  LEGENDARY: 'text-amber-600 bg-amber-100',
};
