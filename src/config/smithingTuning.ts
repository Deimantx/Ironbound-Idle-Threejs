export type SmithingTier = 'iron' | 'steel';

export const SMITHING_TUNING = {
  baseForgeFuelCapacity: 20,
  xpPerBarByTier: {
    iron: 20,
    steel: 40,
  } satisfies Record<SmithingTier, number>,
} as const;

export const SMITHING_BAR_BY_TIER: Record<SmithingTier, string> = {
  iron: 'iron-bar',
  steel: 'steel-bar',
};

export const getSmithingXpPerBar = (tier: SmithingTier): number =>
  SMITHING_TUNING.xpPerBarByTier[tier];
