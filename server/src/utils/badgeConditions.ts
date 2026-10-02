// Condiciones de insignias: lectura (la base a veces las guarda como texto JSON), cuáles dependen del XP y
// reglas que comparten crear, copiar e importar insignias.

export interface BadgeConditionShape {
  type: string;
  value?: number;
  count?: number;
  behaviorId?: string;
  category?: 'positive' | 'negative';
  conditions?: BadgeConditionShape[];
  operator?: 'AND' | 'OR';
}

export const parseBadgeCondition = (value: unknown): BadgeConditionShape | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      // Datos viejos guardaron el JSON dos veces como texto.
      return typeof parsed === 'string' ? parseBadgeCondition(parsed) : (parsed as BadgeConditionShape | null);
    } catch {
      return null;
    }
  }
  return typeof value === 'object' ? (value as BadgeConditionShape) : null;
};

const SIMPLE_TYPES = ['BEHAVIOR_COUNT', 'BEHAVIOR_CATEGORY', 'ANY_BEHAVIOR', 'XP_TOTAL', 'LEVEL', 'PURCHASES'];

/** ¿Se puede evaluar? (tipo conocido y con su meta; si cita un comportamiento, que lo tenga). */
export const isCompleteCondition = (condition: BadgeConditionShape | null): boolean => {
  if (!condition) return false;
  if (condition.type === 'COMPOUND') {
    return Array.isArray(condition.conditions) && condition.conditions.length > 0 && condition.conditions.every(isCompleteCondition);
  }
  if (!SIMPLE_TYPES.includes(condition.type)) return false;
  if (condition.type === 'BEHAVIOR_COUNT' && !condition.behaviorId) return false;
  return (condition.count ?? condition.value ?? 0) >= 1;
};

/** Las de XP o nivel cambian con cualquier fuente de XP (no solo con comportamientos). */
export const dependsOnXp = (condition: BadgeConditionShape | null): boolean => {
  if (!condition) return false;
  if (condition.type === 'COMPOUND') return (condition.conditions ?? []).some(dependsOnXp);
  return condition.type === 'XP_TOTAL' || condition.type === 'LEVEL';
};

/** Comportamientos que cita la condición (para validarlos o mapearlos al copiar). */
export const conditionBehaviorIds = (condition: BadgeConditionShape | null): string[] => {
  if (!condition) return [];
  if (condition.type === 'COMPOUND') return (condition.conditions ?? []).flatMap(conditionBehaviorIds);
  return condition.behaviorId ? [condition.behaviorId] : [];
};

/**
 * Nunca insignias por lo negativo: la conducta se maneja con la energía. Cuenta la categoría
 * «negativos» y, si se pasa `isNegativeBehavior`, un comportamiento concreto negativo.
 */
export const isNegativeCondition = (
  condition: BadgeConditionShape | null,
  isNegativeBehavior: (behaviorId: string) => boolean = () => false,
): boolean => {
  if (!condition) return false;
  if (condition.type === 'COMPOUND') return (condition.conditions ?? []).some((sub) => isNegativeCondition(sub, isNegativeBehavior));
  if (condition.type === 'BEHAVIOR_CATEGORY') return condition.category === 'negative';
  if (condition.type === 'BEHAVIOR_COUNT' && condition.behaviorId) return isNegativeBehavior(condition.behaviorId);
  return false;
};

export const NEGATIVE_BADGE_MESSAGE = 'Las insignias reconocen logros: no pueden ganarse con comportamientos negativos';

/**
 * Al copiar o importar: una automática o mixta sin condición válida (o con una negativa) nunca se
 * ganaría sola, así que pasa a «La das tú» (manual) sin condición.
 */
export const normalizeBadgeAssignment = <M extends string>(
  assignmentMode: M,
  condition: BadgeConditionShape | null,
  isNegativeBehavior?: (behaviorId: string) => boolean,
): { assignmentMode: M | 'MANUAL'; unlockCondition: BadgeConditionShape | null } => {
  if (assignmentMode === 'MANUAL') return { assignmentMode, unlockCondition: null };
  if (!isCompleteCondition(condition) || isNegativeCondition(condition, isNegativeBehavior)) {
    return { assignmentMode: 'MANUAL', unlockCondition: null };
  }
  return { assignmentMode, unlockCondition: condition };
};

/** Solo imágenes subidas a la plataforma (POST /badges/upload-image); nada de URLs externas. */
export const BADGE_IMAGE_PATTERN = /^\/badges\/[\w.-]+$/;
export const safeBadgeImage = (value: string | null | undefined) => (value && BADGE_IMAGE_PATTERN.test(value) ? value : null);
