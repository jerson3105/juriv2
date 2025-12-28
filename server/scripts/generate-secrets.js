#!/usr/bin/env node

/**
 * Script para generar secrets seguros para JWT y otras configuraciones
 * Uso: node scripts/generate-secrets.js
 */

import crypto from 'crypto';

console.log('\n🔐 GENERADOR DE SECRETS SEGUROS - JURIED\n');
console.log('═'.repeat(60));

// Generar JWT Secret (64 bytes = 128 caracteres hex)
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('\n📝 JWT_SECRET (64 bytes):');
console.log(jwtSecret);

// Generar JWT Refresh Secret (64 bytes = 128 caracteres hex)
const jwtRefreshSecret = crypto.randomBytes(64).toString('hex');
console.log('\n📝 JWT_REFRESH_SECRET (64 bytes):');
console.log(jwtRefreshSecret);

// Generar contraseña de base de datos (32 caracteres alfanuméricos)
const dbPassword = crypto.randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
console.log('\n📝 DB_PASSWORD (32 caracteres):');
console.log(dbPassword);

// Generar session secret (si se necesita)
const sessionSecret = crypto.randomBytes(32).toString('hex');
console.log('\n📝 SESSION_SECRET (32 bytes):');
console.log(sessionSecret);

console.log('\n═'.repeat(60));
console.log('\n✅ Secrets generados exitosamente');
console.log('\n⚠️  IMPORTANTE:');
console.log('   1. Copia estos valores a tu archivo .env.production');
console.log('   2. NUNCA compartas estos valores');
console.log('   3. NUNCA los subas a Git');
console.log('   4. Guárdalos en un lugar seguro (gestor de contraseñas)');
console.log('\n📋 Ejemplo de uso en .env.production:');
console.log(`
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}
DB_PASSWORD=${dbPassword}
`);
console.log('═'.repeat(60) + '\n');
