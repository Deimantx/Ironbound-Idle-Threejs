import type { AreaDefinition } from '../game/types';

export const AREAS: AreaDefinition[] = [
  {
    id: 'forest-path',
    regionId: 'greenvale',
    name: 'Forest Path',
    description: 'A woodland trail where the frontier gives way to tangled green.',
    identity: 'Woodland Trail',
    requiredCombatLevel: 1,
    enemyIds: ['forest-rat', 'goblin-scavenger'],
    accent: '#b58b53',
    recommendedLevel: [1, 8],
    presentation: { iconKey: 'tree', theme: 'forest-path', environmentKey: 'forest-path' },
  },
  {
    id: 'wolf-den',
    regionId: 'greenvale',
    name: 'Wolf Den',
    description: 'A cold hollow beneath the pines, marked by old tracks and watchful eyes.',
    identity: 'Predator Den',
    requiredCombatLevel: 18,
    enemyIds: ['grey-wolf'],
    accent: '#71839a',
    recommendedLevel: [18, 28],
    presentation: { iconKey: 'tree', theme: 'wolf-den', environmentKey: 'wolf-den' },
  },
  {
    id: 'abandoned-camp',
    regionId: 'greenvale',
    name: 'Abandoned Camp',
    description: 'A weathered campsite where the fire is cold but the outlaws are not.',
    identity: 'Outlaw Camp',
    requiredCombatLevel: 24,
    enemyIds: ['road-bandit'],
    accent: '#a47b5f',
    recommendedLevel: [24, 35],
    presentation: { iconKey: 'target', theme: 'abandoned-camp', environmentKey: 'abandoned-camp' },
  },
  {
    id: 'old-shrine',
    regionId: 'greenvale',
    name: 'Old Shrine',
    description: 'Ruined stone and a forgotten altar draw creatures from the dark.',
    identity: 'Ancient Ruins',
    requiredCombatLevel: 8,
    enemyIds: ['cave-bat', 'stoneback-crab'],
    accent: '#7d748d',
    recommendedLevel: [8, 18],
    presentation: { iconKey: 'crystal', theme: 'old-shrine', environmentKey: 'old-shrine' },
  },
];

export const areaById = Object.fromEntries(AREAS.map((area) => [area.id, area]));
