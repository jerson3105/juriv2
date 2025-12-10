import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Interceptor para agregar token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

export const avatarApi = {
  // ==================== ITEMS GLOBALES ====================

  getAllItems: async (gender?: AvatarGender): Promise<AvatarItem[]> => {
    const params = gender ? { gender } : {};
    const response = await api.get('/avatars/items', { params });
    return response.data.data;
  },

  getItemsBySlot: async (slot: AvatarSlot, gender?: AvatarGender): Promise<AvatarItem[]> => {
    const params = gender ? { gender } : {};
    const response = await api.get(`/avatars/items/slot/${slot}`, { params });
    return response.data.data;
  },

  createItem: async (data: Omit<AvatarItem, 'id' | 'isActive'>): Promise<AvatarItem> => {
    const response = await api.post('/avatars/items', data);
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

  getEquippedItems: async (studentProfileId: string): Promise<EquippedItem[]> => {
    const response = await api.get(`/avatars/student/${studentProfileId}/equipped`);
    return response.data.data;
  },

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
