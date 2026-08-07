import type { SmithingFuelDefinition } from '../game/types';

export const SMITHING_FUELS: SmithingFuelDefinition[] = [
  {
    itemId: 'coal',
    name: 'Coal',
    fuelValue: 1,
  },
];

export const smithingFuelById = Object.fromEntries(
  SMITHING_FUELS.map((fuel) => [fuel.itemId, fuel]),
) as Record<string, SmithingFuelDefinition>;
