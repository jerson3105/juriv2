import { db } from '../db/index.js';
import { avatarItems } from '../db/schema.js';
import { v4 as uuidv4 } from 'uuid';

interface AvatarItemSeed {
  name: string;
  description: string;
  gender: 'MALE' | 'FEMALE';
  slot: 'HEAD' | 'HAIR' | 'EYES' | 'TOP' | 'BOTTOM' | 'LEFT_HAND' | 'RIGHT_HAND' | 'SHOES' | 'BACK' | 'FLAG';
  imagePath: string;
  layerOrder: number;
  basePrice: number;
  rarity: 'COMMON' | 'RARE' | 'LEGENDARY';
}

// Layer order por slot (de atrás hacia adelante)
const LAYER_ORDER: Record<string, number> = {
  FLAG: 0,
  BACK: 1,
  SHOES: 2,
  BOTTOM: 3,
  TOP: 4,
  LEFT_HAND: 5,
  RIGHT_HAND: 6,
  EYES: 7,
  HEAD: 8,
  HAIR: 9,
};

const avatarItemsData: AvatarItemSeed[] = [
  // ==================== MALE ITEMS ====================
  {
    name: 'Pantalón Elegante',
    description: 'Un pantalón elegante para ocasiones especiales',
    gender: 'MALE',
    slot: 'BOTTOM',
    imagePath: '/avatars/male/bottom/pantalon_elegante.png',
    layerOrder: LAYER_ORDER.BOTTOM,
    basePrice: 150,
    rarity: 'RARE',
  },
  {
    name: 'Abrigo Largo',
    description: 'Un abrigo largo y elegante para el frío',
    gender: 'MALE',
    slot: 'TOP',
    imagePath: '/avatars/male/top/abrigo_largo.png',
    layerOrder: LAYER_ORDER.TOP,
    basePrice: 200,
    rarity: 'RARE',
  },
  
  // Items adicionales de ejemplo (sin imagen por ahora)
  // Puedes agregar más cuando tengas las imágenes
];

async function seedAvatarItems() {
  console.log('🎨 Iniciando seed de items de avatar...\n');

  try {
    for (const itemData of avatarItemsData) {
      const id = uuidv4();
      const now = new Date();

      await db.insert(avatarItems).values({
        id,
        name: itemData.name,
        description: itemData.description,
        gender: itemData.gender,
        slot: itemData.slot,
        imagePath: itemData.imagePath,
        layerOrder: itemData.layerOrder,
        basePrice: itemData.basePrice,
        rarity: itemData.rarity,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      console.log(`✅ Creado: ${itemData.name} (${itemData.gender} - ${itemData.slot})`);
    }

    console.log(`\n🎉 Seed completado! ${avatarItemsData.length} items creados.`);
  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  }
}

// Ejecutar
seedAvatarItems()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
