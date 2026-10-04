/**
 * Verificación en dos pasos de una cuenta de administración. Se corre en el servidor, nunca desde la web:
 *   npm run admin:totp -- estado <correo>
 *   npm run admin:totp -- activar <correo>
 *   npm run admin:totp -- desactivar <correo>
 * (en desarrollo: npx tsx src/scripts/adminTotp.ts …). «activar» muestra un QR para la app de autenticación y pide un
 * código para confirmar: la clave no se guarda hasta confirmarla, y al guardarla se cierran las sesiones abiertas.
 */
import { createInterface } from 'node:readline/promises';
import QRCode from 'qrcode';
import { eq } from 'drizzle-orm';
import { db, disconnectDatabase, users } from '../db/index.js';
import { adminTotpService } from '../services/adminTotp.service.js';
import { piiReady } from '../utils/piiCrypto.js';

const USAGE = 'Uso: npm run admin:totp -- <estado|activar|desactivar> <correo>';

const main = async (): Promise<number> => {
  const [command, rawEmail] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!command || !['estado', 'activar', 'desactivar'].includes(command) || !email) {
    console.log(USAGE);
    return 1;
  }
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, role: true, provider: true, password: true },
  });
  if (!user || user.role !== 'ADMIN') {
    console.log('No hay una cuenta de administración con ese correo.');
    return 1;
  }
  const enabled = await adminTotpService.isEnabled(user.id);

  if (command === 'estado') {
    console.log(enabled ? 'Verificación en dos pasos: activa.' : 'Verificación en dos pasos: sin activar (entra solo con contraseña).');
    return 0;
  }
  if (command === 'desactivar') {
    const removed = await adminTotpService.disable(user.id);
    console.log(removed ? 'Desactivada: la cuenta vuelve a entrar solo con contraseña.' : 'No estaba activa.');
    return 0;
  }

  if (user.provider !== 'LOCAL' || !user.password) {
    console.log('Esta cuenta no entra con contraseña: la verificación en dos pasos necesita correo y contraseña.');
    return 1;
  }
  if (!piiReady()) {
    console.log('Faltan PII_ENC_KEY y PII_INDEX_KEY en el .env: genéralas con node scripts/generate-secrets.js y vuelve a intentarlo.');
    return 1;
  }
  if (enabled) console.log('Ya estaba activa: al confirmar, la clave anterior deja de servir.');

  const { secret, uri } = adminTotpService.newEnrollment(email);
  console.log('\nEscanea este código con tu app de autenticación (Google Authenticator, Microsoft Authenticator…):\n');
  console.log(await QRCode.toString(uri, { type: 'terminal', small: true }));
  console.log(`¿No puedes escanear? Escribe la clave a mano: ${secret.match(/.{1,4}/g)?.join(' ')}\n`);

  // Líneas con iterador (no question()): si la entrada se cierra (Ctrl+D o una tubería), termina en vez de esperar.
  const rl = createInterface({ input: process.stdin, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      process.stdout.write('Código de 6 números que muestra la app: ');
      const next = await lines.next();
      if (next.done) break;
      const code = String(next.value).trim();
      try {
        await adminTotpService.confirmEnrollment(user.id, secret, code);
        console.log('\nListo: desde ahora esta cuenta pide el código al entrar. Se cerraron sus sesiones abiertas.');
        return 0;
      } catch (error) {
        console.log(error instanceof Error ? error.message : String(error));
      }
    }
  } finally {
    rl.close();
  }
  console.log('No se activó: no se guardó nada.');
  return 1;
};

main()
  .then(async (code) => {
    await disconnectDatabase();
    process.exit(code);
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await disconnectDatabase().catch(() => undefined);
    process.exit(1);
  });
