import QRCode from 'qrcode';
import { config_app } from '../config/env.js';

/** Enlace directo para que una familia pida unirse con el código de su hijo o hija (lo aprueba el docente). */
export const familyJoinUrl = (code: string) =>
  `${(config_app.clientUrl || 'https://juried.app').replace(/\/+$/, '')}/familia/${encodeURIComponent(code)}`;

/** QR (SVG) del enlace, para los folletos impresos. */
export const familyJoinQrSvg = (code: string) =>
  QRCode.toString(familyJoinUrl(code), { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0f172a', light: '#ffffff' } });
