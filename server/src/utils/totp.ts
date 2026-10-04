import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Códigos de verificación de 6 números (TOTP, RFC 6238: HMAC-SHA1 y pasos de 30 segundos): los de Google
 * Authenticator, Microsoft Authenticator y similares. Sin dependencias externas.
 */
const STEP_SECONDS = 30;
const DIGITS = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const base32Encode = (bytes: Buffer): string => {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(value >>> bits) & 31];
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
};

export const base32Decode = (text: string): Buffer => {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text.toUpperCase().replace(/[\s=-]/g, '')) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Clave base32 inválida');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
    value &= (1 << bits) - 1;
  }
  return Buffer.from(out);
};

/** Clave nueva de 160 bits, en base32 (como la piden las apps). */
export const generateTotpSecret = (): string => base32Encode(randomBytes(20));

const hotp = (secret: Buffer, counter: number): string => {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
};

export const totpStep = (nowMs = Date.now()): number => Math.floor(nowMs / 1000 / STEP_SECONDS);

/** Código de un paso (para pruebas). */
export const totpCode = (secretBase32: string, step = totpStep()): string => hotp(base32Decode(secretBase32), step);

/**
 * Revisa un código con un paso de tolerancia hacia cada lado (relojes desfasados). Devuelve el paso que coincidió o
 * null. `afterStep`: el último paso ya usado; un código de ese paso o de uno anterior no vale dos veces.
 */
export const verifyTotp = (
  secretBase32: string,
  code: string,
  options: { nowMs?: number; afterStep?: number | null } = {},
): number | null => {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const current = totpStep(options.nowMs);
  for (const step of [current - 1, current, current + 1]) {
    if (options.afterStep != null && step <= options.afterStep) continue;
    if (timingSafeEqual(Buffer.from(hotp(secret, step)), Buffer.from(code))) return step;
  }
  return null;
};

/** Enlace que leen las apps (el código QR lo contiene). */
export const otpauthUri = (secretBase32: string, account: string, issuer = 'Juried'): string =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
