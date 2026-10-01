import crypto from 'crypto';

/**
 * Código aleatorio legible (sin I, O, 0, 1 para evitar confusión) generado con un
 * CSPRNG. Los códigos de clase y de vinculación actúan como secretos: con
 * `Math.random` podrían predecirse a partir de otros códigos observados.
 */
export const generateRandomCode = (length: number): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(crypto.randomInt(chars.length));
  }
  return code;
};

/**
 * Genera un código único para aulas (8 caracteres alfanuméricos)
 */
export const generateClassCode = (): string => generateRandomCode(8);

/**
 * Calcula el nivel basado en XP (sistema progresivo)
 * Nivel N requiere N * xpPerLevel para subir al siguiente
 * XP total para nivel N = xpPerLevel * N * (N-1) / 2
 * Nivel 1→2: 100 XP, Nivel 2→3: 200 XP, Nivel 3→4: 300 XP, etc.
 */
export const calculateLevel = (xp: number, xpPerLevel: number = 100): number => {
  const level = Math.floor((1 + Math.sqrt(1 + (8 * xp) / xpPerLevel)) / 2);
  return Math.max(1, level);
};

/**
 * Calcula XP total necesario para alcanzar un nivel
 */
export const xpForLevel = (level: number, xpPerLevel: number = 100): number => {
  return (xpPerLevel * level * (level - 1)) / 2;
};

/**
 * Calcula XP necesario para subir del nivel actual al siguiente
 */
export const xpForNextLevel = (currentLevel: number, xpPerLevel: number = 100): number => {
  return currentLevel * xpPerLevel;
};

/**
 * Genera un ID único usando crypto
 */
export const generateUniqueId = (): string => {
  return crypto.randomUUID();
};

/**
 * Formatea una fecha a formato legible en español
 */
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/**
 * Selecciona un elemento aleatorio de un array
 */
export const randomElement = <T>(array: T[]): T | undefined => {
  if (array.length === 0) return undefined;
  return array[Math.floor(Math.random() * array.length)];
};

/**
 * Mezcla un array (Fisher-Yates shuffle)
 */
export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Selecciona N elementos aleatorios de un array
 */
export const randomElements = <T>(array: T[], count: number): T[] => {
  const shuffled = shuffleArray(array);
  return shuffled.slice(0, Math.min(count, array.length));
};

/**
 * Valida formato de email
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Sanitiza string para prevenir XSS básico
 */
export const sanitizeString = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

/**
 * Nombre parcial para confirmar un código antes de iniciar sesión ("María R."): basta para que el
 * alumno reconozca su perfil y no expone el nombre completo de un menor a quien adivine códigos.
 */
export const maskPersonName = (name: string | null | undefined): string | null => {
  const tokens = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  if (tokens.length === 1) return tokens[0];
  return `${tokens[0]} ${tokens[tokens.length - 1].charAt(0).toUpperCase()}.`;
};
