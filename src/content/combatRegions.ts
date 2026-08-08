import type {
  AreaId,
  CombatRegionAvailability,
  CombatRegionId,
} from '../game/types';

export interface CombatRegionDefinition {
  id: CombatRegionId;
  name: string;
  description: string;
  areaIds: AreaId[];
  availability: CombatRegionAvailability;
  presentation: {
    accent: string;
    iconKey: 'tree' | 'mountain' | 'flame';
  };
}

export const COMBAT_REGIONS: CombatRegionDefinition[] = [
  {
    id: 'greenvale',
    name: 'Greenvale',
    description: 'Verdant frontier country surrounding the early settlements.',
    areaIds: ['forest-path', 'wolf-den', 'abandoned-camp', 'old-shrine'],
    availability: 'available',
    presentation: { accent: '#78936e', iconKey: 'tree' },
  },
  {
    id: 'stonehill',
    name: 'Stonehill',
    description: 'Rocky uplands of old mines, broken roads, and fortified ruins.',
    areaIds: ['rocky-foothills', 'abandoned-mine', 'mountain-pass', 'ruined-watchtower'],
    availability: 'available',
    presentation: { accent: '#8a877c', iconKey: 'mountain' },
  },
  {
    id: 'ashmoor',
    name: 'Ashmoor',
    description: 'A scarred frontier of ash fields, dead woods, and forgotten strongholds.',
    areaIds: [],
    availability: 'coming-soon',
    presentation: { accent: '#9b6f5a', iconKey: 'flame' },
  },
];

export const combatRegionById = Object.fromEntries(
  COMBAT_REGIONS.map((region) => [region.id, region]),
) as Record<CombatRegionId, CombatRegionDefinition>;
