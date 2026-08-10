import type { AreaId, CombatAvailability, CombatRegionId, CombatSubRegionId } from '../game/types';

export interface CombatSubRegionDefinition {
  id: CombatSubRegionId;
  regionId: CombatRegionId;
  name: string;
  description: string;
  areaIds: AreaId[];
  availability: CombatAvailability;
  presentation: { accent: string; iconKey: 'tree' | 'mountain' | 'flame' | 'target' };
}

export const COMBAT_SUB_REGIONS: CombatSubRegionDefinition[] = [
  {
    id: 'lornwick-vale',
    regionId: 'tauraque',
    name: 'Lornwick Vale',
    description: 'Settled starting valley of roads, pastureland, farms, scattered woods, and small settlements.',
    areaIds: ['redknife-road-camp', 'greyfang-pastures', 'brambletooth-camp'],
    availability: 'available',
    presentation: { accent: '#b58b53', iconKey: 'tree' },
  },
  {
    id: 'greymoss-woods',
    regionId: 'tauraque',
    name: 'Greymoss Woods',
    description: 'Old-growth forest containing hidden camps, predators, ruins, and deeper wilderness.',
    areaIds: ['mossfang-encampment', 'deepwood-den', 'thornhide-grove'],
    availability: 'locked',
    presentation: { accent: '#78936e', iconKey: 'tree' },
  },
  {
    id: 'whitecliff-coast',
    regionId: 'tauraque',
    name: 'Whitecliff Coast',
    description: "Cliffs, beaches, caves, coastal settlements, and smugglers' routes.",
    areaIds: ['saltknife-cove', 'reefback-shore', 'gullwatch-cliffs'],
    availability: 'locked',
    presentation: { accent: '#6d8e9b', iconKey: 'mountain' },
  },
  {
    id: 'redwater-basin',
    regionId: 'tauraque',
    name: 'Redwater Basin',
    description: 'River country of reeds, farms, crossings, mills, and trade roads.',
    areaIds: ['broken-banner-camp', 'redwater-reedbanks', 'mudtusk-crossing'],
    availability: 'locked',
    presentation: { accent: '#96785f', iconKey: 'target' },
  },
  {
    id: 'brackenmoor',
    regionId: 'tauraque',
    name: 'Brackenmoor',
    description: 'Wet lowlands of mist, flooded ground, old ruins, and strange marsh life.',
    areaIds: ['the-drowned-fen', 'mirecrawler-nest', 'fenclaw-grounds'],
    availability: 'locked',
    presentation: { accent: '#687b69', iconKey: 'tree' },
  },
  {
    id: 'crowmere-hills',
    regionId: 'tauraque',
    name: 'Crowmere Hills',
    description: 'Windswept uplands containing old roads, watchposts, raiders, and harsh wildlife.',
    areaIds: ['crowclaw-warband', 'ramstone-slopes', 'cragwing-roost'],
    availability: 'locked',
    presentation: { accent: '#8a877c', iconKey: 'mountain' },
  },
  {
    id: 'alderwatch',
    regionId: 'tauraque',
    name: 'Alderwatch',
    description: 'The developed heart of Tauraque: larger settlements, guarded roads, criminal groups, and old military infrastructure.',
    areaIds: ['blackcloak-hideout', 'rookery-slums', 'old-barracks'],
    availability: 'locked',
    presentation: { accent: '#806c62', iconKey: 'target' },
  },
  {
    id: 'veyran-reach',
    regionId: 'tauraque',
    name: 'Veyran Reach',
    description: "Tauraque's dangerous eastern frontier where the region becomes significantly wilder.",
    areaIds: ['gloomfang-territory', 'razorhorn-range', 'ashmane-hunting-grounds'],
    availability: 'locked',
    presentation: { accent: '#895d57', iconKey: 'mountain' },
  },
];

export const combatSubRegionById = Object.fromEntries(
  COMBAT_SUB_REGIONS.map((subRegion) => [subRegion.id, subRegion]),
) as Record<CombatSubRegionId, CombatSubRegionDefinition>;
