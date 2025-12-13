import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SOURCE_ICON = join(__dirname, '../public/iconojuried.png');
const OUTPUT_DIR = join(__dirname, '../public');

const sizes = [
  { name: 'pwa-64x64.png', size: 64 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'maskable-icon-512x512.png', size: 512, maskable: true },
];

async function generateIcons() {
  console.log('Generando iconos PWA...');
  
  for (const icon of sizes) {
    const outputPath = join(OUTPUT_DIR, icon.name);
    
    try {
      if (icon.maskable) {
        // Para iconos maskable, agregar padding (safe zone del 10%)
        const padding = Math.round(icon.size * 0.1);
        const innerSize = icon.size - (padding * 2);
        
        await sharp(SOURCE_ICON)
          .resize(innerSize, innerSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .extend({
            top: padding,
            bottom: padding,
            left: padding,
            right: padding,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          })
          .png()
          .toFile(outputPath);
      } else {
        await sharp(SOURCE_ICON)
          .resize(icon.size, icon.size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
          .png()
          .toFile(outputPath);
      }
      
      console.log(`✓ ${icon.name} (${icon.size}x${icon.size})`);
    } catch (error) {
      console.error(`✗ Error generando ${icon.name}:`, error.message);
    }
  }
  
  console.log('\n¡Iconos PWA generados exitosamente!');
}

generateIcons();
