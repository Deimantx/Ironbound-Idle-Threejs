import type { AreaDefinition, AreaId, CombatSubRegionId, LootEntry } from '../game/types';
import { getRegionForSubRegion } from './combatRegions';

const noLoot: LootEntry[] = [];
const lockedArea = (
  id: AreaId,
  subRegionId: Exclude<CombatSubRegionId, 'lornwick-vale'>,
  name: string,
  identity: string,
  description: string,
  accent: string,
): AreaDefinition => ({
  id,
  regionId: 'tauraque',
  subRegionId,
  name,
  description,
  identity,
  activityType: 'area',
  availability: 'locked',
  requiredCombatLevel: 0,
  enemyIds: [],
  sharedLoot: noLoot,
  accent,
  recommendedLevel: [0, 0],
  presentation: { iconKey: 'target', theme: 'locked-area', environmentKey: 'locked-area' },
});

export const AREAS: AreaDefinition[] = [
  {
    id: 'redknife-road-camp',
    regionId: 'tauraque',
    subRegionId: 'lornwick-vale',
    name: 'Redknife Road Camp',
    description: 'A disciplined bandit camp controlling the roads through the settled vale.',
    identity: 'Redknife Bandits',
    activityType: 'area',
    availability: 'available',
    requiredCombatLevel: 1,
    enemyIds: ['redknife-lookout', 'redknife-brigand', 'redknife-bowhand', 'redknife-enforcer'],
    sharedLoot: [
      { itemId: 'redknife-token', chance: 0.35, min: 1, max: 1 },
      { itemId: 'torn-cloth', chance: 0.45, min: 1, max: 1 },
      { itemId: 'leather-scraps', chance: 0.32, min: 1, max: 1 },
      { itemId: 'iron-metal-scraps', chance: 0.25, min: 1, max: 1 },
    ],
    gold: [2, 6],
    accent: '#a47b5f',
    recommendedLevel: [1, 7],
    presentation: { iconKey: 'target', theme: 'redknife-road', environmentKey: 'redknife-road' },
  },
  {
    id: 'greyfang-pastures',
    regionId: 'tauraque',
    subRegionId: 'lornwick-vale',
    name: 'Greyfang Pastures',
    description: 'Open pastureland where a coordinated Greyfang pack hunts along the hedgerows.',
    identity: 'Greyfang Wolf Pack',
    activityType: 'area',
    availability: 'available',
    requiredCombatLevel: 4,
    enemyIds: ['greyfang-wolf', 'greyfang-stalker', 'greyfang-ravager', 'greyfang-alpha'],
    sharedLoot: [
      { itemId: 'raw-wolf-meat', chance: 0.65, min: 1, max: 2 },
      { itemId: 'vial-of-wolf-blood', chance: 0.25, min: 1, max: 1 },
      { itemId: 'wolf-pelt', chance: 0.45, min: 1, max: 1 },
      { itemId: 'wolf-fang', chance: 0.3, min: 1, max: 1 },
      { itemId: 'trace-of-nature', chance: 0.05, min: 1, max: 1 },
    ],
    accent: '#71839a',
    recommendedLevel: [4, 10],
    presentation: { iconKey: 'tree', theme: 'greyfang-pastures', environmentKey: 'greyfang-pastures' },
  },
  {
    id: 'brambletooth-camp',
    regionId: 'tauraque',
    subRegionId: 'lornwick-vale',
    name: 'Brambletooth Camp',
    description: 'A rough goblin camp built from stolen timber, scrap, and crude traps.',
    identity: 'Brambletooth Goblins',
    activityType: 'area',
    availability: 'available',
    requiredCombatLevel: 7,
    enemyIds: ['brambletooth-scavenger', 'brambletooth-spearman', 'brambletooth-trapper', 'brambletooth-boarhandler'],
    sharedLoot: [
      { itemId: 'goblin-scrap', chance: 0.55, min: 1, max: 1 },
      { itemId: 'iron-metal-scraps', chance: 0.22, min: 1, max: 1 },
      { itemId: 'frayed-cloth', chance: 0.4, min: 1, max: 1 },
      { itemId: 'rough-leather', chance: 0.3, min: 1, max: 1 },
      { itemId: 'small-coin-pouch', chance: 0.2, min: 1, max: 1 },
    ],
    accent: '#668356',
    recommendedLevel: [7, 13],
    presentation: { iconKey: 'target', theme: 'brambletooth-camp', environmentKey: 'brambletooth-camp' },
  },
  lockedArea('mossfang-encampment', 'greymoss-woods', 'Mossfang Encampment', 'Hidden Camps', 'A locked woodland activity awaiting future content.', '#78936e'),
  lockedArea('deepwood-den', 'greymoss-woods', 'Deepwood Den', 'Predator Den', 'A locked woodland activity awaiting future content.', '#6f846b'),
  lockedArea('thornhide-grove', 'greymoss-woods', 'Thornhide Grove', 'Thorned Wilderness', 'A locked woodland activity awaiting future content.', '#637c63'),
  lockedArea('saltknife-cove', 'whitecliff-coast', 'Saltknife Cove', 'Smugglers Route', 'A locked coastal activity awaiting future content.', '#6d8e9b'),
  lockedArea('reefback-shore', 'whitecliff-coast', 'Reefback Shore', 'Tidal Shore', 'A locked coastal activity awaiting future content.', '#6d8e9b'),
  lockedArea('gullwatch-cliffs', 'whitecliff-coast', 'Gullwatch Cliffs', 'Cliffside Watch', 'A locked coastal activity awaiting future content.', '#6d8e9b'),
  lockedArea('broken-banner-camp', 'redwater-basin', 'Broken Banner Camp', 'Raider Camp', 'A locked riverland activity awaiting future content.', '#96785f'),
  lockedArea('redwater-reedbanks', 'redwater-basin', 'Redwater Reedbanks', 'River Reeds', 'A locked riverland activity awaiting future content.', '#96785f'),
  lockedArea('mudtusk-crossing', 'redwater-basin', 'Mudtusk Crossing', 'River Crossing', 'A locked riverland activity awaiting future content.', '#96785f'),
  lockedArea('the-drowned-fen', 'brackenmoor', 'The Drowned Fen', 'Flooded Ruins', 'A locked marsh activity awaiting future content.', '#687b69'),
  lockedArea('mirecrawler-nest', 'brackenmoor', 'Mirecrawler Nest', 'Marsh Nest', 'A locked marsh activity awaiting future content.', '#687b69'),
  lockedArea('fenclaw-grounds', 'brackenmoor', 'Fenclaw Grounds', 'Marsh Hunting Ground', 'A locked marsh activity awaiting future content.', '#687b69'),
  lockedArea('crowclaw-warband', 'crowmere-hills', 'Crowclaw Warband', 'Hill Warband', 'A locked hill activity awaiting future content.', '#8a877c'),
  lockedArea('ramstone-slopes', 'crowmere-hills', 'Ramstone Slopes', 'Windworn Slopes', 'A locked hill activity awaiting future content.', '#8a877c'),
  lockedArea('cragwing-roost', 'crowmere-hills', 'Cragwing Roost', 'High Roost', 'A locked hill activity awaiting future content.', '#8a877c'),
  lockedArea('blackcloak-hideout', 'alderwatch', 'Blackcloak Hideout', 'Criminal Hideout', 'A locked Alderwatch activity awaiting future content.', '#806c62'),
  lockedArea('rookery-slums', 'alderwatch', 'Rookery Slums', 'City Underworld', 'A locked Alderwatch activity awaiting future content.', '#806c62'),
  lockedArea('old-barracks', 'alderwatch', 'Old Barracks', 'Military Ruin', 'A locked Alderwatch activity awaiting future content.', '#806c62'),
  lockedArea('gloomfang-territory', 'veyran-reach', 'Gloomfang Territory', 'Eastern Wilds', 'A locked frontier activity awaiting future content.', '#895d57'),
  lockedArea('razorhorn-range', 'veyran-reach', 'Razorhorn Range', 'Eastern Range', 'A locked frontier activity awaiting future content.', '#895d57'),
  lockedArea('ashmane-hunting-grounds', 'veyran-reach', 'Ashmane Hunting Grounds', 'Frontier Hunting Ground', 'A locked frontier activity awaiting future content.', '#895d57'),
];

export const areaById = Object.fromEntries(AREAS.map((area) => [area.id, area])) as Record<string, AreaDefinition>;

export const getSubRegionForArea = (areaId: AreaId) => areaById[areaId]?.subRegionId;

export const getRegionForArea = (areaId: AreaId) => {
  const subRegionId = getSubRegionForArea(areaId);
  return subRegionId ? getRegionForSubRegion(subRegionId) : undefined;
};
