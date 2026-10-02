import api from './api';

export type ItemCategory = 'AVATAR' | 'ACCESSORY' | 'CONSUMABLE' | 'SPECIAL';
export type ItemRarity = 'COMMON' | 'RARE' | 'LEGENDARY';
// REDEEM = canje del profe con el oro del alumno; REWARD = premio de otra parte de la plataforma.
export type PurchaseType = 'SELF' | 'GIFT' | 'TEACHER' | 'REWARD' | 'REDEEM';

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
    /** 0 = descansando: el uso espera a que vuelva (salvo en Inicial). */
    hp?: number;
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
  purchaseType?: PurchaseType;
  /** Quien recibe. */
  student: {
    id: string;
    characterName: string | null;
    gp?: number;
    hp?: number;
  };
  /** En un regalo, quien lo paga (su oro y su descanso cuentan al aprobar). */
  buyer?: { id: string; characterName: string | null; gp: number; hp: number } | null;
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

export interface RedeemResult {
  redeemed: { studentId: string; purchaseId: string }[];
  failed: { studentId: string; message: string }[];
}

// ---------- Tienda del alumno (GET /shop/student/:id/view) ----------

export interface StudentShopItem {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  imageUrl: string | null;
  rarity: ItemRarity;
  category: ItemCategory;
  price: number;
  stock: number | null;
}

export interface StudentShopItemRef {
  itemId: string;
  name: string;
  icon: string | null;
  imageUrl: string | null;
  rarity: ItemRarity;
  category: ItemCategory;
}

/** Lo que espera a tu profe: una compra, un regalo que pagas tú o un uso pedido. */
export interface StudentShopWaiting extends StudentShopItemRef {
  kind: 'purchase' | 'gift' | 'use';
  id: string;
  price: number;
  at: string;
  toName: string | null;
}

/** Un premio de «Mis premios», con lo que queda, de dónde salió y sus usos. */
export interface StudentShopOwned extends StudentShopItemRef {
  consumable: boolean;
  available: number;
  waitingUses: number;
  lastUsedAt: string | null;
  usePurchaseId: string | null;
  origins: { kind: PurchaseType; from: string | null }[];
  giftMessage: string | null;
  lastAt: string;
}

export interface StudentShopView {
  shop: {
    enabled: boolean;
    requiresApproval: boolean;
    dailyLimit: number | null;
    boughtToday: number;
    giftsToday: number;
    giftsPerDay: number;
    /** Descansando (0 de energía): comprar, regalar y usar esperan. */
    paused: boolean;
    /** Inicial a 2.º de primaria: vista simple. */
    initial: boolean;
    gradeLevel: string | null;
  };
  gold: number;
  pendingGold: number;
  /** Su única meta de ahorro: un premio (goalItemId) o una prenda de «Mi personaje» (avatarGoal; null si ya no se vende). */
  goalKind: 'ITEM' | 'AVATAR' | null;
  goalItemId: string | null;
  avatarGoal: StudentAvatarGoal | null;
  items: StudentShopItem[];
  waiting: StudentShopWaiting[];
  mine: StudentShopOwned[];
}

export interface StudentAvatarGoal {
  id: string;
  name: string;
  price: number;
  imagePath: string;
  rarity: ItemRarity;
}

export interface ShopClassmate {
  id: string;
  name: string;
  characterClass: string;
  characterClassId: string | null;
}

// Igual que GIFT_PHRASES del servidor (server/src/utils/shopRules.ts): se manda la clave.
export const GIFT_PHRASES = {
  gracias: '¡Gracias por ayudarme!',
  'buen-trabajo': '¡Buen trabajo!',
  disfrutalo: 'Para que lo disfrutes',
  'en-la-clase': 'Me alegra tenerte en la clase',
} as const;
export type GiftPhraseKey = keyof typeof GIFT_PHRASES;

// ---------- Economía de la tienda (profesor) ----------

export interface ShopEconomy {
  /** Mediana del oro semanal de los alumnos activos; 0 si nadie ganó oro en 4 semanas. */
  weeklyGold: number;
  /** El ingreso semanal con el que se calculan las bandas (weeklyGold o 10 por defecto). */
  effectiveWeekly: number;
  activeStudents: number;
  behaviorsGiveGold: boolean;
  bands: Record<ItemRarity, { min: number; max: number }>;
  firstPrizeMax: number;
  maxPrice: number;
}

export interface ShopEconomyResponse {
  economy: ShopEconomy;
  goals: { itemId: string; count: number }[];
}

/** La rareza sale del precio (igual que el servidor): hasta 2 semanas común, hasta 5 raro, más legendario. */
export const rarityForPrice = (price: number, weekly: number): ItemRarity => {
  if (price <= weekly * 2) return 'COMMON';
  if (price <= weekly * 5) return 'RARE';
  return 'LEGENDARY';
};

const browserTz = () => new Date().getTimezoneOffset();

// URL de la imagen de un artículo: las subidas viven en /api/uploads/shop-items (junto a la API).
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');
export const shopImageUrl = (path: string) => (path.startsWith('/api/') ? `${API_ORIGIN}${path}` : path);

export interface Notification {
  id: string;
  userId: string;
  classroomId: string | null;
  // Igual que el enum notification_type del servidor (server/src/db/schema.ts).
  type: 'ITEM_USED' | 'GIFT_RECEIVED' | 'BATTLE_STARTED' | 'LEVEL_UP' | 'POINTS' | 'PURCHASE_APPROVED' | 'PURCHASE_REJECTED'
    | 'BADGE' | 'SCROLL_RECEIVED' | 'SCROLL_APPROVED' | 'SCROLL_REJECTED' | 'ANNOUNCEMENT';
  title: string;
  message: string;
  data: string | null;
  isRead: boolean;
  createdAt: string;
}

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
    effectType?: 'HEAL_HP' | null;
    effectValue?: number | null;
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
    effectType: 'HEAL_HP' | null;
    effectValue: number | null;
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
    requiresApproval?: boolean;
  }> => {
    const { data } = await api.post(`/shop/student/${studentId}/purchase`, {
      itemId,
      quantity,
      tz: browserTz(),
    });
    return data;
  },

  // Un regalo es de una unidad; el mensaje es una frase predefinida y puede ser anónimo.
  gift: async (
    buyerId: string,
    recipientId: string,
    itemId: string,
    options: { phrase?: GiftPhraseKey | null; anonymous?: boolean } = {}
  ): Promise<{
    success: boolean;
    message: string;
    purchase?: Purchase;
    requiresApproval?: boolean;
  }> => {
    const { data } = await api.post(`/shop/student/${buyerId}/gift`, {
      itemId,
      recipientId,
      phrase: options.phrase ?? null,
      anonymous: !!options.anonymous,
      tz: browserTz(),
    });
    return data;
  },

  // ==================== TIENDA DEL ALUMNO ====================

  getStudentView: async (studentId: string): Promise<StudentShopView> => {
    const { data } = await api.get(`/shop/student/${studentId}/view`, { params: { tz: browserTz() } });
    return data.data;
  },

  setGoal: async (studentId: string, itemId: string | null): Promise<{ goalItemId: string | null }> => {
    const { data } = await api.put(`/shop/student/${studentId}/goal`, { itemId });
    return data.data;
  },

  getClassmates: async (studentId: string): Promise<ShopClassmate[]> => {
    const { data } = await api.get(`/shop/student/${studentId}/classmates`);
    return data.data;
  },

  // ==================== CANJE Y ECONOMÍA (PROFESOR) ====================

  // Canjear con el oro del alumno; si falla para todos, el servidor responde 400 con el detalle.
  redeem: async (itemId: string, studentIds: string[], useNow = true): Promise<RedeemResult> => {
    try {
      const { data } = await api.post('/shop/teacher/redeem', { itemId, studentIds, useNow });
      return data.data;
    } catch (error) {
      const data = (error as { response?: { data?: { data?: RedeemResult } } }).response?.data?.data;
      if (data && Array.isArray(data.failed)) return data;
      throw error;
    }
  },

  undoRedeem: async (purchaseId: string): Promise<void> => {
    await api.delete(`/shop/teacher/redeem/${purchaseId}`);
  },

  getEconomy: async (classroomId: string): Promise<ShopEconomyResponse> => {
    const { data } = await api.get(`/shop/classroom/${classroomId}/economy`);
    return data.data;
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
    itemType?: 'PRIVILEGES' | 'RESPONSIBILITIES' | 'EXPERIENCES' | 'MIXED';
    /** Con la clase, los precios salen de lo que ganan sus alumnos en una semana. */
    classroomId?: string;
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
