import type { Badge, BadgeAssignment, BadgeCondition, BadgeRarity, GeneratedBadge } from '../../lib/badgeApi';
import type { Behavior } from '../../lib/behaviorApi';
import type { Student } from '../../lib/classroomApi';

export const badgeAwardCountsKey = (classroomId: string) => ['badge-award-counts', classroomId] as const;

export const RARITY_ORDER: BadgeRarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];

// Estilos estáticos por rareza (Tailwind no ve clases armadas dinámicamente).
export const RARITY_STYLE: Record<BadgeRarity, {
  disc: string;
  ring: string | null;
  chip: string;
  tile: string;
  glow: boolean;
  shine: boolean;
}> = {
  COMMON: {
    disc: 'bg-gradient-to-br from-slate-100 via-slate-300 to-slate-500 dark:from-slate-400 dark:via-slate-500 dark:to-slate-700',
    ring: null,
    chip: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
    tile: 'border-slate-200 from-slate-50 dark:border-slate-700 dark:from-slate-800/60',
    glow: false,
    shine: false,
  },
  RARE: {
    disc: 'bg-gradient-to-br from-sky-200 via-sky-400 to-blue-700',
    ring: 'conic-gradient(from 0deg, #38bdf8, #1d4ed8, #7dd3fc, #2563eb, #38bdf8)',
    chip: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-100',
    tile: 'border-blue-200 from-blue-50 dark:border-blue-900 dark:from-blue-950/50',
    glow: false,
    shine: true,
  },
  EPIC: {
    disc: 'bg-gradient-to-br from-fuchsia-300 via-purple-500 to-violet-800',
    ring: 'conic-gradient(from 0deg, #e879f9, #7c3aed, #f0abfc, #6d28d9, #e879f9)',
    chip: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-100',
    tile: 'border-purple-200 from-purple-50 dark:border-purple-900 dark:from-purple-950/50',
    glow: false,
    shine: true,
  },
  LEGENDARY: {
    disc: 'bg-gradient-to-br from-yellow-200 via-amber-400 to-orange-600',
    ring: 'conic-gradient(from 0deg, #fde047, #f59e0b, #fff7ae, #ea580c, #fde047)',
    chip: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100',
    tile: 'border-amber-300 from-amber-50 dark:border-amber-800 dark:from-amber-950/50',
    glow: true,
    shine: true,
  },
};

// Recompensa sugerida por rareza, en proporción al XP por nivel de la clase (misma escala que la IA:
// común 10 % de un nivel, rara 25 %, épica 50 %, legendaria un nivel). El oro no depende del nivel.
const REWARD_SCALE: Record<BadgeRarity, { xp: number; gp: number }> = {
  COMMON: { xp: 0.1, gp: 5 },
  RARE: { xp: 0.25, gp: 15 },
  EPIC: { xp: 0.5, gp: 30 },
  LEGENDARY: { xp: 1, gp: 50 },
};
export const rewardPreset = (rarity: BadgeRarity, xpPerLevel?: number | null) => {
  const perLevel = xpPerLevel && xpPerLevel > 0 ? xpPerLevel : 100;
  return { xp: Math.min(1000, Math.max(1, Math.round(perLevel * REWARD_SCALE[rarity].xp))), gp: REWARD_SCALE[rarity].gp };
};

// Peso en la nota de su competencia (grade.service): por periodo cuenta la de mayor rareza.
export const GRADE_WEIGHT: Record<BadgeRarity, number> = { COMMON: 15, RARE: 20, EPIC: 25, LEGENDARY: 30 };

export const ASSIGNMENT_NAME: Record<BadgeAssignment, string> = {
  MANUAL: 'Manual',
  AUTOMATIC: 'Automática',
  BOTH: 'Manual y automática',
};

// La condición puede venir como texto JSON desde la base (datos viejos: dos veces).
export const parseCondition = (value: unknown): BadgeCondition | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === 'string' ? parseCondition(parsed) : (parsed as BadgeCondition | null);
    } catch {
      return null;
    }
  }
  return typeof value === 'object' ? (value as BadgeCondition) : null;
};

const SIMPLE_TYPES = ['BEHAVIOR_COUNT', 'BEHAVIOR_CATEGORY', 'ANY_BEHAVIOR', 'XP_TOTAL', 'LEVEL', 'PURCHASES'];

// Igual que el servidor (utils/badgeConditions): tipo conocido, con su meta y, si cita un comportamiento, con él.
const isCompleteCondition = (condition: BadgeCondition | null): boolean => {
  if (!condition) return false;
  if (condition.type === 'COMPOUND') {
    return Array.isArray(condition.conditions) && condition.conditions.length > 0 && condition.conditions.every(isCompleteCondition);
  }
  if (!SIMPLE_TYPES.includes(condition.type)) return false;
  if (condition.type === 'BEHAVIOR_COUNT' && !condition.behaviorId) return false;
  return (condition.count ?? condition.value ?? 0) >= 1;
};

// Los comportamientos negativos ya no cuentan para insignias (se manejan con la energía).
const isNegativeCondition = (condition: BadgeCondition | null, behaviors: Behavior[]): boolean => {
  if (!condition) return false;
  if (condition.type === 'COMPOUND') return (condition.conditions ?? []).some((sub) => isNegativeCondition(sub, behaviors));
  if (condition.type === 'BEHAVIOR_CATEGORY') return condition.category === 'negative';
  if (condition.type === 'BEHAVIOR_COUNT') return behaviors.find((b) => b.id === condition.behaviorId)?.isPositive === false;
  return false;
};

/**
 * Por qué una automática (o mixta) nunca se ganaría sola; null si sí puede.
 * La mixta igual se puede dar a mano; la automática queda inalcanzable.
 */
export const stuckReason = (badge: Pick<Badge, 'assignmentMode' | 'unlockCondition'>, behaviors: Behavior[]): string | null => {
  if (badge.assignmentMode === 'MANUAL') return null;
  const condition = parseCondition(badge.unlockCondition);
  if (!isCompleteCondition(condition)) return 'No tiene una condición completa.';
  if (isNegativeCondition(condition, behaviors)) return 'Su condición usa comportamientos negativos, que ya no cuentan.';
  return null;
};

const times = (n?: number) => `${n ?? 0} ${n === 1 ? 'vez' : 'veces'}`;

// "al recibir Participación 3 veces", "al llegar al nivel 5"...
export const conditionText = (value: unknown, behaviors: Behavior[] = []): string | null => {
  const condition = parseCondition(value);
  if (!condition) return null;
  switch (condition.type) {
    case 'BEHAVIOR_COUNT': {
      const behavior = behaviors.find((b) => b.id === condition.behaviorId);
      return `al recibir «${behavior?.name ?? 'un comportamiento'}» ${times(condition.count)}`;
    }
    case 'BEHAVIOR_CATEGORY':
      return `al recibir ${condition.count ?? 0} comportamientos ${condition.category === 'negative' ? 'negativos' : 'positivos'}`;
    // Solo cuentan los positivos (badge.service).
    case 'ANY_BEHAVIOR':
      return `al recibir ${condition.count ?? 0} comportamientos positivos`;
    case 'XP_TOTAL':
      return `al juntar ${condition.value ?? 0} XP`;
    case 'LEVEL':
      return `al llegar al nivel ${condition.value ?? 0}`;
    case 'PURCHASES':
      return `al hacer ${condition.value ?? 0} compras en la tienda`;
    case 'COMPOUND':
      return 'al cumplir varias condiciones';
    default:
      return null;
  }
};

export const canAwardManually = (badge: Pick<Badge, 'assignmentMode'>) => badge.assignmentMode !== 'AUTOMATIC';

// Nombre visible del alumno según la configuración de la clase.
export const studentLabel = (student: Pick<Student, 'characterName' | 'realName' | 'realLastName'>, showCharacterName: boolean) => {
  if (!showCharacterName) {
    if (student.realName && student.realLastName) return `${student.realLastName}, ${student.realName}`;
    return student.realName || student.characterName || 'Sin nombre';
  }
  return student.characterName || student.realName || 'Sin nombre';
};

// Una sugerida automática solo se puede importar si su condición es completa y usa comportamientos
// positivos de esta clase (el servidor rechaza las negativas).
export const isImportable = (badge: GeneratedBadge, behaviors: Behavior[]) => {
  if (!badge.name.trim()) return false;
  if (badge.assignmentMode === 'MANUAL') return true;
  const condition = parseCondition(badge.unlockCondition);
  if (!condition) return false;
  switch (condition.type) {
    case 'BEHAVIOR_COUNT':
      return !!condition.behaviorId && behaviors.some((b) => b.id === condition.behaviorId && b.isPositive) && (condition.count ?? 0) >= 1;
    case 'BEHAVIOR_CATEGORY':
      return condition.category !== 'negative' && (condition.count ?? 0) >= 1;
    case 'ANY_BEHAVIOR':
      return (condition.count ?? 0) >= 1;
    case 'XP_TOTAL':
    case 'LEVEL':
      return (condition.value ?? 0) >= 1;
    default:
      return false;
  }
};
