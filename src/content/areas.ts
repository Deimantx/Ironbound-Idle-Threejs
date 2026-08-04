import type { AreaDefinition, GameState } from '../game/types';

const combatLevel = (state: GameState): number =>
  Math.floor(
    (state.skills.attack.level + state.skills.strength.level + state.skills.defence.level) / 3,
  );

export const AREAS: AreaDefinition[] = [
  {
    id: 'training-grounds',
    name: 'Training Grounds',
    description: 'An old practice yard at the edge of the settlement.',
    requirement: 'Available from the beginning',
    unlock: () => true,
    enemyIds: ['forest-rat', 'goblin-scavenger'],
    accent: '#b58b53',
    recommendedLevel: [1, 8],
    presentation: { iconKey: 'target', theme: 'training', environmentKey: 'practice-yard' },
  },
  {
    id: 'copper-hills',
    name: 'Copper Hills',
    description: 'Warm caverns threaded with bright mineral veins.',
    requirement: 'Combat level 5 or 5 Training Grounds kills',
    unlock: (state) =>
      combatLevel(state) >= 5 ||
      (state.killCounts['forest-rat'] ?? 0) + (state.killCounts['goblin-scavenger'] ?? 0) >= 5,
    enemyIds: ['cave-bat', 'stoneback-crab'],
    accent: '#c67b53',
    recommendedLevel: [8, 18],
    presentation: { iconKey: 'crystal', theme: 'copper-cavern', environmentKey: 'copper-cavern' },
  },
  {
    id: 'ironwood-pass',
    name: 'Ironwood Pass',
    description: 'A cold road cut through dark, iron-streaked trees.',
    requirement: 'Combat level 15 and 8 Copper Hills kills',
    unlock: (state) =>
      combatLevel(state) >= 15 &&
      (state.killCounts['cave-bat'] ?? 0) + (state.killCounts['stoneback-crab'] ?? 0) >= 8,
    enemyIds: ['grey-wolf', 'road-bandit'],
    accent: '#71839a',
    recommendedLevel: [18, 35],
    presentation: { iconKey: 'tree', theme: 'ironwood', environmentKey: 'ironwood-pass' },
  },
];

export const areaById = Object.fromEntries(AREAS.map((area) => [area.id, area]));
