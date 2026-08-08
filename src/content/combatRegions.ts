import type { CombatRegionId, AreaId } from '../game/types';

export interface CombatRegionDefinition {
  id: CombatRegionId;
  name: string;
  description: string;
  areaIds: AreaId[];
  presentation: {
    accent: string;
    iconKey: 'tree';
  };
}

export const COMBAT_REGIONS: CombatRegionDefinition[] = [
  {
    id: 'greenvale',
    name: 'Greenvale',
    description: 'Verdant frontier country surrounding the early settlements.',
    areaIds: ['forest-path', 'wolf-den', 'abandoned-camp', 'old-shrine'],
    presentation: { accent: '#78936e', iconKey: 'tree' },
  },
];

export const combatRegionById = Object.fromEntries(
  COMBAT_REGIONS.map((region) => [region.id, region]),
) as Record<CombatRegionId, CombatRegionDefinition>;
