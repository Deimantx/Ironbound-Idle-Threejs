import type { MiningNodeDefinition } from '../game/types';

export const MINING_NODES: MiningNodeDefinition[] = [
  {
    id: 'copper-vein',
    name: 'Copper Vein',
    level: 1,
    intervalMs: 3000,
    rewardItemId: 'copper-ore',
    xp: 18,
    description: 'Soft ore with a sunset sheen.',
    theme: 'copper',
  },
  {
    id: 'tin-vein',
    name: 'Tin Vein',
    level: 1,
    intervalMs: 3200,
    rewardItemId: 'tin-ore',
    xp: 18,
    description: 'A pale mineral found beside copper.',
    theme: 'tin',
  },
  {
    id: 'iron-vein',
    name: 'Iron Vein',
    level: 15,
    intervalMs: 5000,
    rewardItemId: 'iron-ore',
    xp: 42,
    description: 'A stubborn seam for seasoned miners.',
    theme: 'iron',
  },
  {
    id: 'coal-seam',
    name: 'Coal Seam',
    level: 25,
    intervalMs: 6000,
    rewardItemId: 'coal',
    xp: 58,
    description: 'Dense fuel hidden behind black stone.',
    theme: 'coal',
  },
  {
    id: 'mithril-deposit',
    name: 'Mithril Deposit',
    level: 50,
    intervalMs: 8000,
    rewardItemId: 'mithril-ore',
    xp: 100,
    description: 'A shimmer glimpsed in an unreachable shaft.',
    theme: 'mithril',
  },
];

export const miningNodeById = Object.fromEntries(MINING_NODES.map((node) => [node.id, node]));
