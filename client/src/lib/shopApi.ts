import api from './api';

export type ItemCategory = 'AVATAR' | 'ACCESSORY' | 'CONSUMABLE' | 'SPECIAL';
export type ItemRarity = 'COMMON' | 'RARE' | 'LEGENDARY';
export type PurchaseType = 'SELF' | 'GIFT' | 'TEACHER';

export interface ShopItem {
  id: string;
  classroomId: string;
  name: string;
  description: string | null;
  category: ItemCategory;
  rarity: ItemRarity;
  price: number;
  imageUrl: string | null;
  icon: string | null;
  effectType: string | null;
  effectValue: number | null;
  stock: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Purchase {
  id: string;
  quantity: number;
  usedQuantity: number;
  totalPrice: number;
  purchaseType: PurchaseType;
  giftMessage: string | null;
  purchasedAt: string;
  item: {
    id: string;
    name: string;
    description?: string;
    icon: string | null;
    imageUrl?: string | null;
    rarity: ItemRarity;
    category?: ItemCategory;
  };
}

export interface GiftReceived extends Purchase {
  from: {
    id: string;
    characterName: string | null;
  } | null;
}

export interface GiftSent extends Purchase {
  to: {
    id: string;
    characterName: string | null;
  };
}

export interface ItemUsage {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  usedAt: string;
  student: {
    id: string;
    characterName: string | null;
    characterClass: string;
  };
  item: {
    id: string;
    name: string;
    icon: string | null;
    imageUrl: string | null;
    rarity: ItemRarity;
  };
}

export interface PendingPurchase {
  id: string;
  quantity: number;
  totalPrice: number;
  purchasedAt: string;
  student: {
    id: string;
    characterName: string | null;
    gp?: number;
  };
  item: {
    id: string;
    name: string;
    icon: string | null;
    imageUrl?: string | null;
    rarity?: ItemRarity;
    price: number;
  };
}

export interface InventoryStudentRef {
  id: string;
  characterName: string | null;
}

export interface ClassroomInventory {
  owned: {
    purchaseId: string;
    quantity: number;
    usedQuantity: number;
    purchaseType: PurchaseType;
    purchasedAt: string;
    student: InventoryStudentRef;
    item: { id: string; name: string; icon: string | null; imageUrl: string | null; rarity: ItemRarity; category: ItemCategory };
  }[];
  usages: {
    id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    usedAt: string;
    reviewedAt: string | null;
    student: InventoryStudentRef;
    item: { id: string; name: string; icon: string | null; imageUrl: string | null; rarity: ItemRarity };
  }[];
}

export interface GiveBulkResult {
  given: { studentId: string; purchaseId: string }[];
  failed: { studentId: string; message: string }[];
}

// URL de la imagen de un artículo: las subidas viven en /api/uploads/shop-items (junto a la API).
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');
export const shopImageUrl = (path: string) => (path.startsWith('/api/') ? `${API_ORIGIN}${path}` : path);

export interface Notification {
  id: string;
  userId: string;
  classroomId: string | null;
  type: 'ITEM_USED' | 'GIFT_RECEIVED' | 'BATTLE_STARTED' | 'LEVEL_UP';
  title: string;
  message: string;
  data: string | null;
  isRead: boolean;
  createdAt: string;
}

// Colores y estilos por rareza
export const RARITY_CONFIG: Record<ItemRarity, { 
  label: string; 
  color: string; 
  bgColor: string;
  borderColor: string;
  gradient: string;
  glowColor: string;
}> = {
  COMMON: {
    label: 'Común',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    gradient: 'from-gray-400 to-gray-500',
    glowColor: 'gray',
  },
  RARE: {
    label: 'Raro',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-400',
    gradient: 'from-blue-400 to-blue-600',
    glowColor: 'blue',
  },
  LEGENDARY: {
    label: 'Legendario',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-500',
    gradient: 'from-amber-400 to-orange-500',
    glowColor: 'amber',
  },
};

export const CATEGORY_CONFIG: Record<ItemCategory, { 
  label: string; 
  icon: string; 
  description: string;
}> = {
  AVATAR: { 
    label: 'Avatar', 
    icon: '🎭',
    description: 'Cambia la apariencia del personaje (permanente)',
  },
  ACCESSORY: { 
    label: 'Accesorio', 
    icon: '💎',
    description: 'Decoración visual para el perfil (permanente)',
  },
  CONSUMABLE: { 
    label: 'Consumible', 
    icon: '🧪',
    description: 'Se gasta al usarlo; tú apruebas cada uso (ej: elegir asiento)',
  },
  SPECIAL: { 
    label: 'Permanente',
    icon: '⭐',
    description: 'No se gasta; el beneficio lo aplicas tú (ej: amuleto, título)',
  },
};

export const shopApi = {
  // ==================== ITEMS ====================
  
  getItems: async (classroomId: string): Promise<ShopItem[]> => {
    const { data } = await api.get(`/shop/classroom/${classroomId}/items`);
    return data;
  },

  createItem: async (itemData: {
    classroomId: string;
    name: string;
    description?: string;
    category: ItemCategory;
    rarity: ItemRarity;
    price: number;
    imageUrl?: string;
    icon?: string;
    effectType?: string;
    effectValue?: number;
    stock?: number;
  }): Promise<ShopItem> => {
    const { data } = await api.post('/shop/items', itemData);
    return data;
  },

  updateItem: async (itemId: string, itemData: Partial<{
    name: string;
    description: string | null;
    category: ItemCategory;
    rarity: ItemRarity;
    price: number;
    imageUrl: string | null;
    icon: string;
    effectType: string;
    effectValue: number;
    stock: number | null;
    isActive: boolean;
  }>): Promise<ShopItem> => {
    const { data } = await api.put(`/shop/items/${itemId}`, itemData);
    return data;
  },

  deleteItem: async (itemId: string): Promise<void> => {
    await api.delete(`/shop/items/${itemId}`);
  },

  restoreItem: async (itemId: string): Promise<void> => {
    await api.put(`/shop/items/${itemId}`, { isActive: true });
  },

  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const { data } = await api.post('/shop/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return data.imageUrl;
  },

  // Dar un artículo a varios estudiantes (gratis)
  giveBulk: async (itemId: string, studentIds: string[]): Promise<GiveBulkResult> => {
    try {
      const { data } = await api.post('/shop/teacher/give-bulk', { itemId, studentIds });
      return data;
    } catch (error) {
      const data = (error as { response?: { data?: GiveBulkResult } }).response?.data;
      if (data && Array.isArray(data.failed)) return data;
      throw error;
    }
  },

  // Deshacer una entrega del profesor (si no se usó)
  undoGive: async (purchaseId: string): Promise<void> => {
    await api.delete(`/shop/teacher/purchases/${purchaseId}`);
  },

  getInventory: async (classroomId: string): Promise<ClassroomInventory> => {
    const { data } = await api.get(`/shop/classroom/${classroomId}/inventory`);
    return data;
  },

  // ==================== COMPRAS ====================

  purchase: async (studentId: string, itemId: string, quantity = 1): Promise<{
    success: boolean;
    message: string;
    purchase?: Purchase;
  }> => {
    const { data } = await api.post(`/shop/student/${studentId}/purchase`, {
      itemId,
      quantity,
    });
    return data;
  },

  gift: async (
    buyerId: string,
    recipientId: string,
    itemId: string,
    quantity = 1,
    message?: string
  ): Promise<{
    success: boolean;
    message: string;
    purchase?: Purchase;
  }> => {
    const { data } = await api.post(`/shop/student/${buyerId}/gift`, {
      itemId,
      recipientId,
      quantity,
      message,
    });
    return data;
  },

  teacherPurchase: async (
    studentId: string,
    itemId: string,
    quantity = 1
  ): Promise<{
    success: boolean;
    message: string;
    purchase?: Purchase;
  }> => {
    const { data } = await api.post('/shop/teacher/purchase', {
      studentId,
      itemId,
      quantity,
    });
    return data;
  },

  // ==================== HISTORIAL ====================

  getPurchases: async (studentId: string): Promise<Purchase[]> => {
    const { data } = await api.get(`/shop/student/${studentId}/purchases`);
    return data;
  },

  getGiftsReceived: async (studentId: string): Promise<GiftReceived[]> => {
    const { data } = await api.get(`/shop/student/${studentId}/gifts/received`);
    return data;
  },

  getGiftsSent: async (studentId: string): Promise<GiftSent[]> => {
    const { data } = await api.get(`/shop/student/${studentId}/gifts/sent`);
    return data;
  },

  // ==================== USO DE ITEMS ====================

  useItem: async (studentId: string, purchaseId: string): Promise<{
    success: boolean;
    message: string;
    usage?: { id: string; itemName: string; remaining: number };
  }> => {
    const { data } = await api.post(`/shop/student/${studentId}/use/${purchaseId}`);
    return data;
  },

  getPendingUsages: async (classroomId: string): Promise<ItemUsage[]> => {
    const { data } = await api.get(`/shop/classroom/${classroomId}/usages/pending`);
    return data;
  },

  reviewUsage: async (usageId: string, status: 'APPROVED' | 'REJECTED'): Promise<{
    success: boolean;
    message: string;
  }> => {
    const { data } = await api.put(`/shop/usages/${usageId}/review`, { status });
    return data;
  },

  // ==================== COMPRAS PENDIENTES ====================

  getPendingPurchases: async (classroomId: string): Promise<PendingPurchase[]> => {
    const { data } = await api.get(`/shop/classroom/${classroomId}/purchases/pending`);
    return data;
  },

  approvePurchase: async (purchaseId: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.put(`/shop/purchases/${purchaseId}/approve`);
    return data;
  },

  rejectPurchase: async (purchaseId: string, reason?: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.put(`/shop/purchases/${purchaseId}/reject`, { reason });
    return data;
  },

  // ==================== NOTIFICACIONES ====================

  getNotifications: async (options?: { unreadOnly?: boolean; classroomId?: string }): Promise<Notification[]> => {
    const params = new URLSearchParams();
    if (options?.unreadOnly) params.append('unread', 'true');
    if (options?.classroomId) params.append('classroomId', options.classroomId);
    const queryString = params.toString();
    const { data } = await api.get(`/shop/notifications${queryString ? `?${queryString}` : ''}`);
    // Manejar respuesta paginada o array directo
    return Array.isArray(data) ? data : data.data;
  },

  getUnreadCount: async (classroomId?: string): Promise<number> => {
    const params = classroomId ? { classroomId } : {};
    const { data } = await api.get('/shop/notifications/unread-count', { params });
    return data.count;
  },

  markNotificationRead: async (notificationId: string): Promise<void> => {
    await api.put(`/shop/notifications/${notificationId}/read`);
  },

  markAllNotificationsRead: async (): Promise<void> => {
    await api.put('/shop/notifications/read-all');
  },

  // ==================== GENERACIÓN CON IA ====================

  generateWithAI: async (params: {
    description: string;
    level: string;
    count?: number;
    itemType?: 'PRIVILEGES' | 'REWARDS' | 'POWERS' | 'MIXED';
  }): Promise<{
    success: boolean;
    data?: {
      items: Array<{
        name: string;
        description: string;
        category: ItemCategory;
        rarity: ItemRarity;
        price: number;
        icon: string;
      }>;
    };
    message?: string;
  }> => {
    const { data } = await api.post('/shop/generate-ai', params);
    return data;
  },
};
