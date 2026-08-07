import { itemById } from './items';
import type { SmithingToolDefinition } from '../game/types';

export const SMITHING_TOOLS: SmithingToolDefinition[] = [
  {
    itemId: 'iron-smithing-hammer',
    requiredSmithingLevel: 15,
    speedBonus: 0.08,
    materialPreservationChance: 0.03,
  },
  {
    itemId: 'steel-smithing-hammer',
    requiredSmithingLevel: 32,
    speedBonus: 0.15,
    materialPreservationChance: 0.06,
  },
];

export const smithingToolByItemId = Object.fromEntries(
  SMITHING_TOOLS.map((tool) => [tool.itemId, tool]),
) as Record<string, SmithingToolDefinition>;

export const getSmithingHammerDefinition = (
  itemId: string | undefined,
): SmithingToolDefinition | null =>
  itemId && smithingToolByItemId[itemId] && itemById[itemId] ? smithingToolByItemId[itemId] : null;
