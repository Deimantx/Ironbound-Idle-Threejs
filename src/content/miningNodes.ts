import type { MiningNodeDefinition, MiningNodeId, MiningStageDefinition } from '../game/types';

const stageNames = [
  'Outer Crust',
  'Exposed Seam',
  'Dense Vein',
  'Rich Core',
  'Heart of Deposit',
] as const;
const stageMultipliers = [0.5, 0.75, 1, 1.35, 1.8] as const;

const stages = (nodeId: string, durability: number[]): MiningStageDefinition[] =>
  durability.map((value, index) => ({
    id: `${nodeId}-stage-${index + 1}`,
    name: stageNames[index],
    durability: value,
    bonusChanceMultiplier: stageMultipliers[index],
  }));

const node = (
  definition: Omit<MiningNodeDefinition, 'stages'> & { durability: number[] },
): MiningNodeDefinition => {
  const { durability, ...rest } = definition;
  return {
    ...rest,
    stages: stages(definition.id, durability),
    intervalMs: 3000,
    rewardItemId: definition.primaryRewardItemId,
    xp: definition.xpPerSwing,
  };
};

export const MINING_NODES: MiningNodeDefinition[] = [
  node({
    id: 'copper-vein',
    name: 'Copper Vein',
    level: 1,
    requiredPenetration: 10,
    damagePerPrimaryReward: 10,
    xpPerSwing: 8,
    primaryRewardItemId: 'copper-ore',
    respawnMs: 15_000,
    durability: [100, 90, 80, 70, 60],
    bonusDrops: [
      { itemId: 'stone-fragment', chance: 0.08, minQuantity: 1, maxQuantity: 2 },
      { itemId: 'rough-gem', chance: 0.004, minQuantity: 1, maxQuantity: 1 },
    ],
    description: 'Soft ore with a sunset sheen.',
    theme: 'copper',
  }),
  node({
    id: 'tin-vein',
    name: 'Tin Vein',
    level: 1,
    requiredPenetration: 12,
    damagePerPrimaryReward: 10,
    xpPerSwing: 8,
    primaryRewardItemId: 'tin-ore',
    respawnMs: 15_000,
    durability: [100, 90, 80, 70, 60],
    bonusDrops: [
      { itemId: 'stone-fragment', chance: 0.08, minQuantity: 1, maxQuantity: 2 },
      { itemId: 'rough-gem', chance: 0.004, minQuantity: 1, maxQuantity: 1 },
    ],
    description: 'A pale mineral found beside copper.',
    theme: 'tin',
  }),
  node({
    id: 'iron-vein',
    name: 'Iron Vein',
    level: 15,
    requiredPenetration: 35,
    damagePerPrimaryReward: 14,
    xpPerSwing: 18,
    primaryRewardItemId: 'iron-ore',
    respawnMs: 15_000,
    durability: [180, 160, 140, 120, 100],
    bonusDrops: [
      { itemId: 'stone-fragment', chance: 0.1, minQuantity: 1, maxQuantity: 2 },
      { itemId: 'sharpening-grit', chance: 0.03, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'rough-gem', chance: 0.007, minQuantity: 1, maxQuantity: 1 },
    ],
    description: 'A stubborn seam for seasoned miners.',
    theme: 'iron',
  }),
  node({
    id: 'coal-seam',
    name: 'Coal Seam',
    level: 25,
    requiredPenetration: 45,
    damagePerPrimaryReward: 16,
    xpPerSwing: 24,
    primaryRewardItemId: 'coal',
    respawnMs: 15_000,
    durability: [200, 180, 160, 140, 120],
    bonusDrops: [
      { itemId: 'stone-fragment', chance: 0.12, minQuantity: 1, maxQuantity: 2 },
      { itemId: 'sharpening-grit', chance: 0.04, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'rough-gem', chance: 0.008, minQuantity: 1, maxQuantity: 1 },
    ],
    description: 'Dense fuel hidden behind black stone.',
    theme: 'coal',
  }),
  node({
    id: 'mithril-deposit',
    name: 'Mithril Deposit',
    level: 50,
    requiredPenetration: 70,
    damagePerPrimaryReward: 20,
    xpPerSwing: 45,
    primaryRewardItemId: 'mithril-ore',
    respawnMs: 15_000,
    durability: [280, 250, 220, 190, 160],
    bonusDrops: [
      { itemId: 'stone-fragment', chance: 0.12, minQuantity: 1, maxQuantity: 2 },
      { itemId: 'sharpening-grit', chance: 0.06, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'rough-gem', chance: 0.015, minQuantity: 1, maxQuantity: 1 },
    ],
    description: 'A shimmer glimpsed in an unreachable shaft.',
    theme: 'mithril',
  }),
];

export const miningNodeById = Object.fromEntries(
  MINING_NODES.map((node) => [node.id, node]),
) as Record<MiningNodeId, MiningNodeDefinition>;
