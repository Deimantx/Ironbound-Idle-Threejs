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
  return { ...rest, stages: stages(definition.id, durability) };
};

export const MINING_NODES: MiningNodeDefinition[] = [
  node({
    id: 'stone-outcrop',
    name: 'Stone Outcrop',
    level: 1,
    requiredPenetration: 10,
    damagePerPrimaryReward: 10,
    xpPerSwing: 8,
    primaryRewardItemId: 'stone-ore',
    respawnMs: 15_000,
    durability: [60, 70, 80, 90, 100],
    bonusDrops: [
      { itemId: 'iron-ore', chance: 0.08, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'rough-gem', chance: 0.004, minQuantity: 1, maxQuantity: 1 },
    ],
    description: 'A weathered stone outcrop with useful iron traces.',
    theme: 'stone',
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
    durability: [100, 120, 140, 160, 180],
    bonusDrops: [{ itemId: 'rough-gem', chance: 0.007, minQuantity: 1, maxQuantity: 1 }],
    description: 'A stubborn seam for seasoned miners.',
    theme: 'iron',
  }),
  node({
    id: 'coal-seam',
    name: 'Coal Seam',
    level: 30,
    requiredPenetration: 45,
    damagePerPrimaryReward: 16,
    xpPerSwing: 26,
    primaryRewardItemId: 'coal',
    respawnMs: 15_000,
    durability: [120, 140, 160, 180, 200],
    bonusDrops: [{ itemId: 'rough-gem', chance: 0.008, minQuantity: 1, maxQuantity: 1 }],
    description: 'Dense fuel ore hidden behind dark stone.',
    theme: 'coal',
  }),
];

export const miningNodeById = Object.fromEntries(
  MINING_NODES.map((node) => [node.id, node]),
) as Record<MiningNodeId, MiningNodeDefinition>;
