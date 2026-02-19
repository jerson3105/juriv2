import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { config_app } from '../config/env.js';

export type OAuthRole = 'TEACHER' | 'STUDENT' | 'PARENT';

interface OAuthStatePayload {
  nonce: string;
  iat: number;
  role?: OAuthRole;
}

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const ALLOWED_ROLES = new Set<OAuthRole>(['TEACHER', 'STUDENT', 'PARENT']);

export const OAUTH_STATE_COOKIE_NAME = 'oauth_state_nonce';
export const OAUTH_STATE_MAX_AGE_MS = OAUTH_STATE_TTL_MS;

const parseRole = (role: unknown): OAuthRole | undefined => {
  if (typeof role !== 'string') return undefined;
  if (!ALLOWED_ROLES.has(role as OAuthRole)) return undefined;
  return role as OAuthRole;
};

const signPayload = (payloadBase64: string): string => {
  return createHmac('sha256', config_app.jwt.secret)
    .update(payloadBase64)
    .digest('base64url');
};

export const generateOAuthState = (role?: string): { state: string; nonce: string } => {
  const payload: OAuthStatePayload = {
    nonce: randomBytes(24).toString('hex'),
    iat: Date.now(),
  };

  const normalizedRole = parseRole(role);
  if (normalizedRole) {
    payload.role = normalizedRole;
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signPayload(encodedPayload);

  return {
    state: `${encodedPayload}.${signature}`,
    nonce: payload.nonce,
  };
};

export const verifyOAuthState = (
  stateToken: string | undefined,
  expectedNonce: string | undefined
): { isValid: boolean; role?: OAuthRole } => {
  if (!stateToken || !expectedNonce) {
    return { isValid: false };
  }

  const stateParts = stateToken.split('.');
  if (stateParts.length !== 2) {
    return { isValid: false };
  }

  const [encodedPayload, signature] = stateParts;
  if (!encodedPayload || !signature) {
    return { isValid: false };
  }

  const expectedSignature = signPayload(encodedPayload);
  const providedSignatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    providedSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)
  ) {
    return { isValid: false };
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as OAuthStatePayload;
  } catch {
    return { isValid: false };
  }

  if (!payload?.nonce || typeof payload.iat !== 'number') {
    return { isValid: false };
  }

  if (Date.now() - payload.iat > OAUTH_STATE_TTL_MS) {
    return { isValid: false };
  }

  if (payload.nonce !== expectedNonce) {
    return { isValid: false };
  }

  const role = parseRole(payload.role);
  return role ? { isValid: true, role } : { isValid: true };
};
