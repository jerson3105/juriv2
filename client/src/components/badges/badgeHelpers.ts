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

// Recompensa sugerida por rareza (misma escala que usa la IA).
export const REWARD_PRESETS: Record<BadgeRarity, { xp: number; gp: number }> = {
  COMMON: { xp: 10, gp: 5 },
  RARE: { xp: 25, gp: 15 },
  EPIC: { xp: 50, gp: 30 },
  LEGENDARY: { xp: 100, gp: 50 },
};

export const ASSIGNMENT_NAME: Record<BadgeAssignment, string> = {
  MANUAL: 'Manual',
  AUTOMATIC: 'Automática',
  BOTH: 'Manual y automática',
};

// La condición puede venir como texto JSON desde la base.
export const parseCondition = (value: unknown): BadgeCondition | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as BadgeCondition;
    } catch {
      return null;
    }
  }
  return value as BadgeCondition;
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
    case 'ANY_BEHAVIOR':
      return `al recibir ${condition.count ?? 0} comportamientos`;
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

// Una sugerida automática solo se puede importar si su condición es completa y usa comportamientos de esta clase.
export const isImportable = (badge: GeneratedBadge, behaviors: Behavior[]) => {
  if (!badge.name.trim()) return false;
  if (badge.assignmentMode === 'MANUAL') return true;
  const condition = parseCondition(badge.unlockCondition);
  if (!condition) return false;
  switch (condition.type) {
    case 'BEHAVIOR_COUNT':
      return !!condition.behaviorId && behaviors.some((b) => b.id === condition.behaviorId) && (condition.count ?? 0) >= 1;
    case 'BEHAVIOR_CATEGORY':
    case 'ANY_BEHAVIOR':
      return (condition.count ?? 0) >= 1;
    case 'XP_TOTAL':
    case 'LEVEL':
      return (condition.value ?? 0) >= 1;
    default:
      return false;
  }
};
