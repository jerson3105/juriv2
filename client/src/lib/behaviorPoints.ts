import type { Behavior } from './behaviorApi';

export type BehaviorReward = { type: 'XP' | 'HP' | 'GP'; amount: number };

// Misma regla que el servidor (behavior.service): valor > 0 → max(1, round(valor × multiplicador)).
const scale = (value: number, multiplier: number) => (value > 0 ? Math.max(1, Math.round(value * multiplier)) : 0);

export const getBehaviorRewards = (behavior: Behavior, multiplier = 1): BehaviorReward[] => {
  const xp = behavior.xpValue ?? (behavior.pointType === 'XP' ? behavior.pointValue : 0);
  const hp = behavior.hpValue ?? (behavior.pointType === 'HP' ? behavior.pointValue : 0);
  const gp = behavior.gpValue ?? (behavior.pointType === 'GP' ? behavior.pointValue : 0);
  const rewards: BehaviorReward[] = [
    { type: 'XP', amount: scale(xp || 0, multiplier) },
    { type: 'HP', amount: scale(hp || 0, multiplier) },
    { type: 'GP', amount: scale(gp || 0, multiplier) },
  ];
  return rewards.filter((reward) => reward.amount > 0);
};

// "+10 XP · +5 GP" (o con "−" si el comportamiento es negativo).
export const formatBehaviorRewards = (behavior: Behavior, multiplier = 1): string => {
  const sign = behavior.isPositive ? '+' : '−';
  return getBehaviorRewards(behavior, multiplier).map((reward) => `${sign}${reward.amount} ${reward.type}`).join(' · ');
};

// Pastillas de recompensa con contraste AA en claro y oscuro (clases estáticas para Tailwind).
export const REWARD_PILL_CLASS: Record<BehaviorReward['type'], string> = {
  XP: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200',
  HP: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200',
  GP: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
};
