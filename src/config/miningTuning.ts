export const MINING_TUNING = {
  maxStamina: 100,
  restDurationMs: 10_000,
  minimumEffectiveness: 0.1,
  noTool: {
    itemId: '',
    requiredMiningLevel: 1,
    rockDamage: 1,
    penetration: 0,
    swingIntervalMs: 5_000,
    staminaCost: 25,
  },
} as const;
