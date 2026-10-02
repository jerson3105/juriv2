// Instancia común: token en memoria y renovación de la sesión.
import api from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Capa del avatar en WebP del tamaño en que se muestra (el servidor la genera una vez y la guarda):
 * sm para listas y miniaturas del personaje, md para el personaje grande, thumb para la prenda sola.
 */
export type AvatarImageVariant = 'sm' | 'md' | 'thumb';
export const avatarImageUrl = (path: string, variant: AvatarImageVariant) =>
  `${API_URL}/avatar-img/${variant}?src=${encodeURIComponent(path)}`;

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

export interface EquippedItem {
  id: string;
  slot: AvatarSlot;
  equippedAt: string;
  avatarItem: AvatarItem;
}

/** Nivel de precios de la tienda de avatar de una clase: la mitad, normal o el doble. */
export type AvatarPriceLevel = 'LOW' | 'NORMAL' | 'HIGH';

export interface TeacherCatalogItem {
  id: string;
  name: string;
  slot: AvatarSlot;
  gender: AvatarGender;
  rarity: ItemRarity;
  imagePath: string;
  /** La misma prenda en el otro cuerpo comparte pairKey. */
  pairKey: string | null;
  /** Precio en esta clase (el propio o el calculado). */
  price: number;
  customPrice: number | null;
  hidden: boolean;
  isNew: boolean;
}

export interface TeacherCatalogCollection {
  /** Vacío para «Otras prendas» (sin colección: no se puede ocultar entera). */
  id: string;
  name: string;
  description: string | null;
  hidden: boolean;
  items: TeacherCatalogItem[];
}

export interface TeacherAvatarCatalog {
  classroomId: string;
  settings: {
    enabled: boolean;
    priceLevel: AvatarPriceLevel;
    /** Oro semanal con el que se calcularon los precios (fijo hasta «Actualizar precios»). */
    priceBase: number;
    pricesAt: string | null;
    /** La tienda de la clase (premios); cerrada, tampoco se compra avatar. */
    shopEnabled: boolean;
  };
  /** weeklyNow: oro semanal de ahora (corregido en clases nuevas), con el que se actualizarían los precios. */
  economy: { weeklyGold: number; weeklyNow: number; activeStudents: number; behaviorsGiveGold: boolean };
  /** Precio actual por rareza (1, 3 y 6 semanas de oro, según el nivel). */
  prices: Record<ItemRarity, number>;
  collections: TeacherCatalogCollection[];
  otherClassrooms: { id: string; name: string }[];
}

export interface StudentAvatarItem {
  id: string;
  name: string;
  slot: AvatarSlot;
  rarity: ItemRarity;
  imagePath: string;
  layerOrder: number;
  collection: { id: string; name: string } | null;
  /** Se vende en la tienda de su clase ahora. */
  inShop: boolean;
  price: number | null;
  /** La tiene: comprada, su par o una inicial. */
  owned: boolean;
  isDefault: boolean;
  isNew: boolean;
}

export type AvatarShopReason = 'SHOP_CLOSED' | 'AVATAR_OFF' | 'RESTING';

/** La única meta de ahorro del alumno: una prenda (está en items) o un premio de la Tienda. */
export type StudentGoal =
  | { kind: 'AVATAR'; itemId: string }
  | { kind: 'ITEM'; itemId: string; name: string; price: number };

export interface StudentEquipped {
  slot: AvatarSlot;
  itemId: string;
  name: string;
  imagePath: string;
  layerOrder: number;
  isDefault: boolean;
}

export interface StudentAvatarView {
  /** pendingGold: oro que espera a su profe en la tienda de premios (no se puede gastar en ropa). */
  profile: { id: string; gender: AvatarGender; gold: number; pendingGold: number };
  classroomName: string;
  gradeLevel: string | null;
  /** Inicial a 2.º: vista sencilla; el cuerpo lo cambia su profe. */
  young: boolean;
  canChangeBody: boolean;
  /** Comprar: cerrada por la tienda de la clase, desactivada la de avatar o en descanso. Vestirse siempre se puede. */
  shop: { open: boolean; reason: AvatarShopReason | null };
  /** Aún puede elegir su prenda de regalo (una común, una vez). */
  giftAvailable: boolean;
  goal: StudentGoal | null;
  items: StudentAvatarItem[];
  equipped: StudentEquipped[];
}

export interface AvatarPurchaseResult {
  item: { id: string; name: string; slot: AvatarSlot };
  pricePaid: number;
  newBalance: number;
  equipped: boolean;
  /** La prenda era su meta de ahorro (ya se liberó). */
  goalReached: boolean;
  gift: boolean;
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
  // ==================== DOCENTE: CATÁLOGO AUTOMÁTICO DE LA CLASE ====================
  // applyTo: otras clases del docente donde se aplica el mismo cambio («Aplicar a mis otras clases»).

  getTeacherCatalog: async (classroomId: string): Promise<TeacherAvatarCatalog> => {
    const response = await api.get(`/avatars/classroom/${classroomId}/catalog`);
    return response.data.data;
  },

  updateSettings: async (
    classroomId: string,
    patch: { enabled?: boolean; priceLevel?: AvatarPriceLevel; refreshPrices?: boolean; applyTo?: string[] },
  ): Promise<void> => {
    await api.put(`/avatars/classroom/${classroomId}/settings`, patch);
  },

  setCollectionHidden: async (classroomId: string, collectionId: string, hidden: boolean, applyTo?: string[]): Promise<void> => {
    await api.put(`/avatars/classroom/${classroomId}/collections/${collectionId}`, { hidden, applyTo });
  },

  /** price: número = precio propio; null = volver al calculado. */
  setItemException: async (
    classroomId: string,
    avatarItemId: string,
    patch: { hidden?: boolean; price?: number | null; applyTo?: string[] },
  ): Promise<void> => {
    await api.put(`/avatars/classroom/${classroomId}/items/${avatarItemId}`, patch);
  },

  // ==================== ALUMNO ====================

  /** «Mi avatar» en una carga (solo el dueño del perfil). */
  getStudentView: async (studentProfileId: string): Promise<StudentAvatarView> => {
    const response = await api.get(`/avatars/student/${studentProfileId}/view`);
    return response.data.data;
  },

  /** Comprar con el oro de su clase; con equip, también ponérsela. */
  purchase: async (studentProfileId: string, avatarItemId: string, equip = false): Promise<AvatarPurchaseResult> => {
    const response = await api.post('/avatars/purchase', { studentProfileId, avatarItemId, equip });
    return response.data.data;
  },

  /** La prenda de regalo: una común, gratis, una vez por perfil. */
  claimGift: async (studentProfileId: string, avatarItemId: string, equip = false): Promise<AvatarPurchaseResult> => {
    const response = await api.post('/avatars/gift', { studentProfileId, avatarItemId, equip });
    return response.data.data;
  },

  /** Meta de ahorro con una prenda (reemplaza a la de premios); null la quita. */
  setGoal: async (studentProfileId: string, avatarItemId: string | null): Promise<{ goalItemId: string | null; goalKind: 'AVATAR' | null }> => {
    const response = await api.put(`/avatars/student/${studentProfileId}/goal`, { avatarItemId });
    return response.data.data;
  },

  /** Cambiar de cuerpo (el alumno o el docente de su clase): lo comprado pasa a su par si lo tiene. */
  setBody: async (studentProfileId: string, gender: AvatarGender): Promise<EquippedItem[]> => {
    const response = await api.put(`/avatars/student/${studentProfileId}/body`, { gender });
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
};
