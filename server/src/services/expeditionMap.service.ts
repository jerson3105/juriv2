import { db } from '../db/index.js';
import { expeditionMaps } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export class ExpeditionMapService {
  
  // Obtener todos los mapas (para admin)
  async getAll() {
    return db.select()
      .from(expeditionMaps)
      .orderBy(desc(expeditionMaps.createdAt));
  }
  
  // Obtener solo mapas activos (para profesores)
  async getActive() {
    return db.select()
      .from(expeditionMaps)
      .where(eq(expeditionMaps.isActive, true))
      .orderBy(expeditionMaps.category, expeditionMaps.name);
  }
  
  // Obtener un mapa por ID
  async getById(id: string) {
    const [map] = await db.select()
      .from(expeditionMaps)
      .where(eq(expeditionMaps.id, id));
    return map || null;
  }
  
  // Crear un nuevo mapa
  async create(data: {
    name: string;
    description?: string;
    imageUrl: string;
    thumbnailUrl?: string;
    category?: string;
  }) {
    const now = new Date();
    const id = uuidv4();
    
    await db.insert(expeditionMaps).values({
      id,
      name: data.name,
      description: data.description || null,
      imageUrl: data.imageUrl,
      thumbnailUrl: data.thumbnailUrl || null,
      category: data.category || 'general',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    
    return this.getById(id);
  }
  
  // Actualizar un mapa
  async update(id: string, data: {
    name?: string;
    description?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    category?: string;
    isActive?: boolean;
  }) {
    const now = new Date();
    
    await db.update(expeditionMaps)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(expeditionMaps.id, id));
    
    return this.getById(id);
  }
  
  // Eliminar un mapa
  async delete(id: string) {
    await db.delete(expeditionMaps)
      .where(eq(expeditionMaps.id, id));
    return { success: true };
  }
  
  // Obtener categorías únicas
  async getCategories() {
    const maps = await db.select({ category: expeditionMaps.category })
      .from(expeditionMaps)
      .groupBy(expeditionMaps.category);
    return maps.map(m => m.category);
  }
}

export const expeditionMapService = new ExpeditionMapService();
