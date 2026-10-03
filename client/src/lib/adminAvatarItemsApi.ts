import { api } from './api';
import type { AvatarGender, AvatarSlot, ItemRarity } from './avatarApi';

/** Borrador = no llega a ninguna clase; publicada = a la venta; retirada = ya no se vende (quien la tiene la conserva). */
export type AvatarItemStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';

export interface AdminAvatarItem {
  id: string;
  name: string;
  description: string | null;
  gender: AvatarGender;
  slot: AvatarSlot;
  rarity: ItemRarity;
  imagePath: string;
  isDefault: boolean;
  status: AvatarItemStatus;
  /** La misma prenda en el otro cuerpo comparte la clave. */
  pairKey: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Alumnos que la compraron y que la llevan puesta. */
  owners: number;
  equipped: number;
}

export interface AdminAvatarItemDetail {
  item: AdminAvatarItem;
  partner: AdminAvatarItem | null;
  /** Alumnos que ahorran para esta prenda. */
  goals: number;
}

export interface NewAvatarItemFields {
  name: string;
  description?: string;
  gender: AvatarGender;
  slot: AvatarSlot;
  rarity: ItemRarity;
  /** Versión del otro cuerpo con la que queda vinculada. */
  pairWith?: string;
}

export interface AvatarItemPatch {
  name?: string;
  description?: string | null;
  rarity?: ItemRarity;
  isDefault?: boolean;
  slot?: AvatarSlot;
}

export const adminAvatarItemsKey = ['admin-avatar-items'] as const;
export const adminAvatarItemKey = (id: string) => ['admin-avatar-item', id] as const;

// La instancia manda JSON por defecto: con FormData hay que pedir multipart (axios pone el boundary).
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

const imageForm = (png: Blob, fields: Record<string, string | undefined> = {}) => {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => { if (value !== undefined && value !== '') form.append(key, value); });
  form.append('image', png, 'capa.png');
  return form;
};

export const adminAvatarItemsApi = {
  async list(): Promise<AdminAvatarItem[]> {
    const response = await api.get('/admin/avatar-items');
    return response.data.data;
  },

  async get(id: string): Promise<AdminAvatarItemDetail> {
    const response = await api.get(`/admin/avatar-items/${id}`);
    return response.data.data;
  },

  /** Crea un borrador con el PNG de 395×959 que entrega «Completa». */
  async create(fields: NewAvatarItemFields, png: Blob): Promise<AdminAvatarItemDetail> {
    const response = await api.post('/admin/avatar-items', imageForm(png, { ...fields }), MULTIPART);
    return response.data.data;
  },

  async update(id: string, patch: AvatarItemPatch): Promise<AdminAvatarItemDetail> {
    const response = await api.patch(`/admin/avatar-items/${id}`, patch);
    return response.data.data;
  },

  async replaceImage(id: string, png: Blob): Promise<AdminAvatarItemDetail> {
    const response = await api.post(`/admin/avatar-items/${id}/image`, imageForm(png), MULTIPART);
    return response.data.data;
  },

  async publish(id: string): Promise<AdminAvatarItemDetail> {
    const response = await api.post(`/admin/avatar-items/${id}/publish`);
    return response.data.data;
  },

  async retire(id: string, withPair: boolean): Promise<AdminAvatarItemDetail> {
    const response = await api.post(`/admin/avatar-items/${id}/retire`, { withPair });
    return response.data.data;
  },

  async restore(id: string, withPair: boolean): Promise<AdminAvatarItemDetail> {
    const response = await api.post(`/admin/avatar-items/${id}/restore`, { withPair });
    return response.data.data;
  },

  async pair(id: string, otherItemId: string): Promise<AdminAvatarItemDetail> {
    const response = await api.put(`/admin/avatar-items/${id}/pair`, { otherItemId });
    return response.data.data;
  },

  async unpair(id: string): Promise<AdminAvatarItemDetail> {
    const response = await api.delete(`/admin/avatar-items/${id}/pair`);
    return response.data.data;
  },
};
