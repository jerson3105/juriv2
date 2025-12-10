/**
 * Script para crear un usuario administrador de Juried
 * Ejecutar: npx tsx scripts/createAdmin.ts
 */

import { db } from '../src/db/index.js';
import { users } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const ADMIN_EMAIL = 'admin@juried.com';
const ADMIN_PASSWORD = 'Admin123!'; // Cambiar después del primer login
const ADMIN_FIRST_NAME = 'Admin';
const ADMIN_LAST_NAME = 'Juried';

async function createAdmin() {
  try {
    console.log('🔍 Verificando si ya existe un admin...');
    
    // Verificar si ya existe
    const existingAdmin = await db.query.users.findFirst({
      where: eq(users.email, ADMIN_EMAIL),
    });

    if (existingAdmin) {
      console.log('⚠️  Ya existe un usuario con este email:', ADMIN_EMAIL);
      console.log('   Rol actual:', existingAdmin.role);
      
      if (existingAdmin.role !== 'ADMIN') {
        console.log('🔄 Actualizando rol a ADMIN...');
        await db.update(users)
          .set({ role: 'ADMIN', updatedAt: new Date() })
          .where(eq(users.id, existingAdmin.id));
        console.log('✅ Rol actualizado a ADMIN');
      }
      
      process.exit(0);
    }

    console.log('🔐 Hasheando contraseña...');
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    console.log('👤 Creando usuario administrador...');
    const now = new Date();
    
    await db.insert(users).values({
      id: uuidv4(),
      email: ADMIN_EMAIL,
      password: hashedPassword,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      role: 'ADMIN',
      provider: 'LOCAL',
      isActive: true,
      notifyBadges: true,
      notifyLevelUp: true,
      createdAt: now,
      updatedAt: now,
    });

    console.log('');
    console.log('✅ ¡Usuario administrador creado exitosamente!');
    console.log('');
    console.log('📧 Email:', ADMIN_EMAIL);
    console.log('🔑 Contraseña:', ADMIN_PASSWORD);
    console.log('');
    console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer login');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear admin:', error);
    process.exit(1);
  }
}

createAdmin();
