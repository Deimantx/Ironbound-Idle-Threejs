import type { CombatRegionAvailability, CombatRegionId, LootEntry } from '../game/types';
import { COMBAT_SUB_REGIONS } from './combatSubRegions';

export interface CombatRegionDefinition {
  id: CombatRegionId;
  name: string;
  description: string;
  subRegionIds: typeof COMBAT_SUB_REGIONS[number]['id'][];
  availability: CombatRegionAvailability;
  sharedLoot: LootEntry[];
  presentation: { accent: string; iconKey: 'tree' | 'mountain' | 'flame' };
  /** @deprecated Compatibility view; navigation uses subRegionIds. */
  areaIds?: string[];
}

export const TAURAQUE_SHARED_LOOT: LootEntry[] = [
  { itemId: 'black-stone', chance: 0.02, min: 1, max: 1 },
  { itemId: 'magic-crystal-box', chance: 0.005, min: 1, max: 1 },
];

export const COMBAT_REGIONS: CombatRegionDefinition[] = [
  {
    id: 'tauraque',
    name: 'Tauraque',
    description: 'A broad temperate region of settled valleys, ancient forests, riverlands, coastlines, wetlands, hills, towns, and an increasingly wild eastern frontier.',
    subRegionIds: COMBAT_SUB_REGIONS.map((subRegion) => subRegion.id),
    availability: 'available',
    sharedLoot: TAURAQUE_SHARED_LOOT,
    presentation: { accent: '#b58b53', iconKey: 'tree' },
  },
];

export const combatRegionById = Object.fromEntries(
  COMBAT_REGIONS.map((region) => [region.id, region]),
) as Record<string, CombatRegionDefinition>;

export const getRegionForSubRegion = (subRegionId: string) =>
  COMBAT_REGIONS.find((region) => region.subRegionIds.includes(subRegionId as never));
