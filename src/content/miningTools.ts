import { itemById } from './items';
import type { MiningToolDefinition } from '../game/types';

export const MINING_TOOLS: MiningToolDefinition[] = [
  {
    itemId: 'worn-pickaxe',
    requiredMiningLevel: 1,
    rockDamage: 10,
    penetration: 10,
    swingIntervalMs: 3_000,
    staminaCost: 20,
  },
  {
    itemId: 'iron-pickaxe',
    requiredMiningLevel: 20,
    rockDamage: 28,
    penetration: 45,
    swingIntervalMs: 2_500,
    staminaCost: 16,
  },
  {
    itemId: 'steel-pickaxe',
    requiredMiningLevel: 35,
    rockDamage: 42,
    penetration: 70,
    swingIntervalMs: 2_200,
    staminaCost: 14,
  },
];

export const miningToolByItemId = Object.fromEntries(
  MINING_TOOLS.map((tool) => [tool.itemId, tool]),
) as Record<string, MiningToolDefinition>;

export const getMiningToolDefinition = (itemId: string | undefined): MiningToolDefinition | null =>
  itemId && miningToolByItemId[itemId] && itemById[itemId] ? miningToolByItemId[itemId] : null;
