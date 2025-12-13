import api from './api';

export interface ExpeditionMap {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const expeditionMapApi = {
  // Obtener todos los mapas (admin)
  getAll: async (): Promise<ExpeditionMap[]> => {
    const response = await api.get('/expedition-maps');
    return response.data;
  },

  // Obtener mapas activos (profesores)
  getActive: async (): Promise<ExpeditionMap[]> => {
    const response = await api.get('/expedition-maps/active');
    return response.data;
  },

  // Obtener un mapa por ID
  getById: async (id: string): Promise<ExpeditionMap> => {
    const response = await api.get(`/expedition-maps/${id}`);
    return response.data;
  },

  // Crear un nuevo mapa
  create: async (data: {
    name: string;
    description?: string;
    imageUrl: string;
    thumbnailUrl?: string;
    category?: string;
  }): Promise<ExpeditionMap> => {
    const response = await api.post('/expedition-maps', data);
    return response.data;
  },

  // Actualizar un mapa
  update: async (id: string, data: Partial<{
    name: string;
    description: string;
    imageUrl: string;
    thumbnailUrl: string;
    category: string;
    isActive: boolean;
  }>): Promise<ExpeditionMap> => {
    const response = await api.put(`/expedition-maps/${id}`, data);
    return response.data;
  },

  // Eliminar un mapa
  delete: async (id: string): Promise<void> => {
    await api.delete(`/expedition-maps/${id}`);
  },

  // Subir imagen de mapa
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/expedition-maps/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Obtener categorías
  getCategories: async (): Promise<string[]> => {
    const response = await api.get('/expedition-maps/categories');
    return response.data;
  },
};

export default expeditionMapApi;
