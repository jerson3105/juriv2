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
